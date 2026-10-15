/**
 * Business rules for Planeo, in one place so every page enforces them the same way.
 *
 * These checks keep the UI honest; the Java/Lambda API must enforce the same
 * rules, because anyone can call the API directly.
 *
 * Data shapes the pages expect (`data` prop):
 *   users:            [{ id, name, email, role, managerId, active, allocatedHours? }]
 *   projects:         [{ id, title, description, managerId, managerName, status: 'ACTIVE' | 'COMPLETED',
 *                        startDate, predictedEndDate, team: [Assignment], milestones: [Milestone] }]
 *   archivedProjects: same shape as projects, plus archivedAt
 *   Assignment:       { id, employeeId, employeeName, hoursPerWeek, startDate, endDate, active }
 *   Milestone:        { id, title, startDate, dueDate, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
 *                        progress (0-100), dependsOn: [milestoneId], dependencies: [MilestoneRef] }
 *   Projects can depend on projects: project.dependsOn, project.chain, project.upstreamMilestones.
 * Dates are 'YYYY-MM-DD' strings.
 */

export const ROLES = { ADMIN: 'ADMIN', MANAGER: 'MANAGER', EMPLOYEE: 'EMPLOYEE' }
export const ROLE_LABEL = { ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' }

export const DAY_HOURS = 8
export const WORK_DAYS = 5
export const WEEK_HOURS = DAY_HOURS * WORK_DAYS // 40

export const MILESTONE_STATUS = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
}

/**
 * Decisions the business rules leave open. Each one is a single switch here,
 * so changing your mind later is a one-line edit.
 */
export const POLICY = {
  // Which project fields a manager may edit on their own projects. Admins can edit all of them.
  managerEditableFields: ['title', 'description', 'startDate', 'predictedEndDate'],
  // Managers may only assign their own direct reports (false = any active employee).
  managersAssignOnlyOwnEmployees: false,
  // Admins can create and edit milestones as well as managers.
  adminsManageMilestones: true,
  // Milestone dates must fall inside the project's start and predicted end dates.
  milestonesWithinProjectDates: true,
  // 'START': a milestone can't start until its dependencies are complete.
  // 'FINISH': it can start any time but can't be completed until they are.
  dependencyGate: 'FINISH',
  // When a dependency's dates move, conflicts are flagged, never shifted automatically.
}

const isAdmin = (user) => user.role === ROLES.ADMIN
const managesProject = (user, project) => user.role === ROLES.MANAGER && project.managerId === user.id
const isOpen = (project) => project.status === 'ACTIVE'

export const can = {
  createUsers: (user) => isAdmin(user),
  manageUsers: (user) => isAdmin(user),
  createProjects: (user) => isAdmin(user),
  editProject: (user, project) => isOpen(project) && (isAdmin(user) || managesProject(user, project)),
  completeProject: (user, project) => isOpen(project) && (isAdmin(user) || managesProject(user, project)),
  // Managers mark projects completed; admins archive them (any unarchived project, e.g. a cancelled one).
  archiveProject: (user, project) => isAdmin(user) && project.status !== 'ARCHIVED',
  manageTeam: (user, project) => isOpen(project) && (isAdmin(user) || managesProject(user, project)),
  manageMilestones: (user, project) => isOpen(project)
    && (managesProject(user, project) || (POLICY.adminsManageMilestones && isAdmin(user))),
}

/** The project fields this user may change. */
export function editableProjectFields(user, project) {
  if (!can.editProject(user, project)) return []
  if (isAdmin(user)) return ['title', 'description', 'managerId', 'startDate', 'predictedEndDate', 'dependsOn']
  return [...POLICY.managerEditableFields, 'dependsOn']
}

/** Projects this project waits on that aren't finished yet (it can't be completed until they are). */
export function unfinishedUpstream(project) {
  return (project.chain?.upstream ?? []).filter((p) => p.direct && p.status === 'ACTIVE')
}

/** Employees this user is allowed to put on a project. */
export function assignableEmployees(user, users) {
  return users.filter((u) => u.active && u.role === ROLES.EMPLOYEE
    && (isAdmin(user) || !POLICY.managersAssignOnlyOwnEmployees || u.managerId === user.id))
}

/* ---------------------------------------------------------------- dates -- */

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const todayISO = () => toISODate(new Date())

/** Monday-to-Friday days between two dates, inclusive. */
export function countWorkdays(startISO, endISO) {
  if (!startISO || !endISO || endISO < startISO) return 0
  const start = parseDate(startISO)
  const end = parseDate(endISO)
  const days = Math.round((end - start) / 86400000) + 1
  const fullWeeks = Math.floor(days / 7)
  let count = fullWeeks * WORK_DAYS
  for (let i = 0; i < days % 7; i += 1) {
    const day = (start.getDay() + i) % 7
    if (day !== 0 && day !== 6) count += 1
  }
  return count
}

/* ---------------------------------------------------------------- hours -- */

export const activeAssignments = (project) => project.team.filter((a) => a.active !== false)

/**
 * A project's planned hours, calculated (never stored) from its team:
 * each assignment's hours per week, spread over its workdays.
 */
export function projectPlannedHours(project) {
  return activeAssignments(project).reduce(
    (sum, a) => sum + (a.hoursPerWeek / WORK_DAYS) * countWorkdays(a.startDate, a.endDate), 0)
}

export const projectWeeklyHours = (project) =>
  activeAssignments(project).reduce((sum, a) => sum + a.hoursPerWeek, 0)

/**
 * An employee's weekly hours across all active assignments on open (ACTIVE) projects:
 * completing or archiving a project frees its team's hours. Same rule as the backend.
 * Prefers the server's figure (`allocatedHours`) because the server sees projects
 * this user may not, which matters when a manager checks the 40-hour limit.
 */
export function allocatedHours(employee, projects, { excludeAssignmentId } = {}) {
  let local = 0
  for (const project of projects) {
    if (!isOpen(project)) continue
    for (const a of activeAssignments(project)) {
      if (a.employeeId === employee.id && a.id !== excludeAssignmentId) local += a.hoursPerWeek
    }
  }
  if (typeof employee.allocatedHours !== 'number') return local
  if (!excludeAssignmentId) return employee.allocatedHours
  const excluded = projects.flatMap((p) => p.team).find((a) => a.id === excludeAssignmentId)
  return employee.allocatedHours - (excluded && excluded.active !== false ? excluded.hoursPerWeek : 0)
}

export function employeeAssignments(employeeId, projects) {
  return projects.filter(isOpen).flatMap((project) => activeAssignments(project)
    .filter((a) => a.employeeId === employeeId)
    .map((a) => ({ ...a, projectId: project.id, projectTitle: project.title })))
}

/** Returns an error message, or '' when the assignment is valid. */
export function validateAssignment(form, { project, employee, projects, assignmentId }) {
  const hours = Number(form.hoursPerWeek)
  if (!employee) return 'Choose an employee.'
  if (!Number.isFinite(hours) || hours <= 0) return 'Enter the hours per week, more than 0.'
  if (hours > WEEK_HOURS) return `Hours per week can’t be more than ${WEEK_HOURS}.`
  if (!form.startDate || !form.endDate) return 'Enter a start and end date.'
  if (form.endDate < form.startDate) return 'The end date must be on or after the start date.'
  if (form.startDate < project.startDate || form.endDate > project.predictedEndDate) {
    return 'Assignment dates must fall within the project’s start and predicted end dates.'
  }
  const duplicate = activeAssignments(project)
    .some((a) => a.employeeId === employee.id && a.id !== assignmentId)
  if (duplicate) return `${employee.name} is already on this project. Edit their hours instead.`
  const others = allocatedHours(employee, projects, { excludeAssignmentId: assignmentId })
  if (others + hours > WEEK_HOURS) {
    const left = Math.max(0, WEEK_HOURS - others)
    return `${employee.name} already has ${others}h a week on other projects. Assign ${left}h or less.`
  }
  return ''
}

/* ----------------------------------------------------------- milestones -- */

/** True if making `milestoneId` depend on `dependsOn` would close a loop. */
export function createsCycle(milestones, milestoneId, dependsOn) {
  if (!milestoneId) return false
  const edges = new Map(milestones.map((m) => [m.id, m.dependsOn ?? []]))
  edges.set(milestoneId, dependsOn)
  const seen = new Set()
  const stack = [...dependsOn]
  while (stack.length) {
    const id = stack.pop()
    if (id === milestoneId) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(edges.get(id) ?? []))
  }
  return false
}

/**
 * A milestone's dependency by id. It may be in another project (one this project depends
 * on): then it's not in `byId`, but the API includes it in `milestone.dependencies`.
 */
export function dependencyOf(milestone, id, byId) {
  return byId.get(id) ?? milestone.dependencies?.find((d) => d.id === id)
}

const incompleteDeps = (milestone, byId) =>
  (milestone.dependsOn ?? []).map((id) => dependencyOf(milestone, id, byId)).filter((d) => d && d.status !== 'COMPLETED')

/** Returns an error message, or '' when the milestone is valid. */
export function validateMilestone(form, { project, milestones, milestoneId }) {
  if (!form.title.trim()) return 'Give the milestone a name.'
  if (!form.startDate || !form.dueDate) return 'Enter a start date and a due date.'
  if (form.dueDate < form.startDate) return 'The due date must be on or after the start date.'
  if (POLICY.milestonesWithinProjectDates
    && (form.startDate < project.startDate || form.dueDate > project.predictedEndDate)) {
    return 'Milestone dates must fall within the project’s start and predicted end dates.'
  }
  if (createsCycle(milestones, milestoneId, form.dependsOn)) {
    return 'That dependency would create a loop. A milestone can’t depend on something that depends on it.'
  }
  const byId = new Map(milestones.map((m) => [m.id, m]))
  const waiting = incompleteDeps(form, byId)
  if (waiting.length) {
    const names = waiting.map((d) => d.title).join(', ')
    if (POLICY.dependencyGate === 'START' && form.status !== 'NOT_STARTED') {
      return `This milestone can’t start until these are complete: ${names}.`
    }
    if (POLICY.dependencyGate === 'FINISH' && form.status === 'COMPLETED') {
      return `This milestone can’t be completed until these are complete: ${names}.`
    }
  }
  return ''
}

/**
 * Date conflicts with dependencies. These are flagged, not blocked, because
 * milestone dates are allowed to move while work is in progress.
 */
export function milestoneConflicts(milestone, byId) {
  return (milestone.dependsOn ?? []).map((id) => dependencyOf(milestone, id, byId)).filter(Boolean).flatMap((dep) => {
    if (dep.status === 'COMPLETED') return []
    const limit = POLICY.dependencyGate === 'START' ? milestone.startDate : milestone.dueDate
    if (dep.dueDate <= limit) return []
    return [`${dep.title} is due ${POLICY.dependencyGate === 'START' ? 'after this starts' : 'after this is due'}`]
  })
}

export function milestoneProgress(milestone) {
  if (milestone.status === 'COMPLETED') return 100
  return Math.max(0, Math.min(100, Math.round(milestone.progress ?? 0)))
}
