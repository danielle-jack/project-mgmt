// An in-memory stand-in for the Java backend. It answers the same paths and
// enforces the same business rules, so pages behave the same once the real API
// is switched on. Delete this folder when the backend is done.

import { ApiError } from '../errors'
import { HOURS_PER_WEEK, assignmentTotalHours } from '../hours'
import { createSeedData, DEMO_PASSWORD } from './fakeData'

const db = createSeedData()
// Fake only: plain-text passwords kept apart from the user records. The real backend stores hashes.
const passwords = new Map(db.users.map((u) => [u.id, DEMO_PASSWORD]))
const auditLogs = [] // newest last; see record()
let nextAuditId = 1
const nextId = Object.fromEntries(
  Object.entries(db).map(([name, rows]) => [name, Math.max(0, ...rows.map((r) => r.id)) + 1]),
)

const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE']
const MILESTONE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']
const FAKE_DELAY_MS = 150

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function handleFakeRequest(method, fullPath, body, token) {
  await new Promise((resolve) => setTimeout(resolve, FAKE_DELAY_MS))

  const [path, queryString = ''] = fullPath.split('?')
  const query = Object.fromEntries(new URLSearchParams(queryString))

  for (const [routeMethod, pattern, handler, options] of routes) {
    const match = method === routeMethod && path.match(pattern)
    if (match) {
      const actor = options?.public ? null : requireActor(token)
      const result = handler({ id: Number(match[1]), body: body ?? {}, query, actor })
      return structuredClone(result) // so pages can't mutate the fake database
    }
  }
  fail(404, `No route for ${method} ${path}`)
}

const PUBLIC = { public: true } // no login needed

const routes = [
  ['POST', /^\/auth\/login$/, login, PUBLIC],
  ['GET', /^\/users\/me$/, ({ actor }) => actor],
  ['GET', /^\/users$/, listUsers],
  ['GET', /^\/users\/(\d+)$/, getUser],
  ['POST', /^\/users$/, createUser],
  ['PATCH', /^\/users\/(\d+)\/profile$/, updateProfile],
  ['PATCH', /^\/users\/(\d+)\/password$/, changePassword],
  ['PATCH', /^\/users\/(\d+)\/manager$/, changeManager],
  ['PUT', /^\/users\/(\d+)\/photo$/, setPhoto],
  ['POST', /^\/users\/(\d+)\/deactivate$/, deactivateUser],
  ['POST', /^\/users\/(\d+)\/reactivate$/, reactivateUser],
  ['GET', /^\/users\/(\d+)\/hours$/, getWeeklyHours],
  ['GET', /^\/users\/(\d+)\/assignments$/, getUserAssignments],

  ['GET', /^\/projects$/, listProjects],
  ['GET', /^\/projects\/options$/, listProjectOptions],
  ['GET', /^\/projects\/(\d+)\/chain$/, getProjectChain],
  ['GET', /^\/projects\/(\d+)$/, getProject],
  ['POST', /^\/projects$/, createProject],
  ['PATCH', /^\/projects\/(\d+)$/, updateProject],
  ['POST', /^\/projects\/(\d+)\/complete$/, completeProject],
  ['POST', /^\/projects\/(\d+)\/archive$/, archiveProject],

  ['GET', /^\/projects\/(\d+)\/assignments$/, listAssignments],
  ['POST', /^\/projects\/(\d+)\/assignments$/, createAssignment],
  ['PATCH', /^\/assignments\/(\d+)$/, updateAssignment],
  ['POST', /^\/assignments\/(\d+)\/deactivate$/, deactivateAssignment],

  ['GET', /^\/projects\/(\d+)\/milestones$/, listMilestones],
  ['POST', /^\/projects\/(\d+)\/milestones$/, createMilestone],
  ['PATCH', /^\/milestones\/(\d+)$/, updateMilestone],

  ['GET', /^\/audit-logs$/, listAuditLogs],
]

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// Fake tokens are just "fake-<id>"; the real backend signs them.
function login({ body }) {
  const email = requireText(body.email, 'Email').toLowerCase()
  const password = requireText(body.password, 'Password')
  const user = db.users.find((u) => u.email === email)
  if (!user || !user.active || passwords.get(user.id) !== password) {
    fail(401, 'Email or password is incorrect.')
  }
  return { token: `fake-${user.id}`, user }
}

function changePassword({ id, body, actor }) {
  const newPassword = requirePassword(body.newPassword)
  findUser(id)
  if (actor.id === id) {
    if (passwords.get(id) !== body.currentPassword) fail(400, 'Your current password is incorrect.')
  } else if (actor.role !== 'ADMIN') {
    fail(403, 'You can only change your own password.')
  }
  passwords.set(id, newPassword)
  record(actor, actor.id === id ? 'CHANGE_OWN_PASSWORD' : 'RESET_PASSWORD', 'USER', id, {})
  return findUser(id)
}

// Admins and managers see everyone; employees see themselves and their manager.
// Employees come with their booked hours (allocatedHours).
function listUsers({ actor }) {
  const visible = actor.role === 'EMPLOYEE'
    ? [actor, ...(actor.managerId ? [findUser(actor.managerId)] : [])]
    : db.users
  return visible.map((u) => ({ ...u, allocatedHours: u.role === 'EMPLOYEE' ? weeklyHours(u.id) : null }))
}

function getUser({ id, actor }) {
  if (actor.role === 'EMPLOYEE' && id !== actor.id && id !== actor.managerId) {
    fail(403, 'Employees can only view themselves and their manager.')
  }
  return findUser(id)
}

function createUser({ body, actor }) {
  requireAdmin(actor, 'Only admins can create users.')

  const name = requireText(body.name, 'Name')
  const email = requireEmail(body.email)
  const password = requirePassword(body.password)
  if (!ROLES.includes(body.role)) fail(400, `Role must be one of ${ROLES.join(', ')}.`)

  let managerId = null
  if (body.role === 'EMPLOYEE') {
    if (body.managerId == null) fail(400, 'Every employee needs a manager.')
    managerId = requireActiveManager(body.managerId).id
  }

  const user = {
    id: null, // set by insert()
    name, email, role: body.role, managerId,
    active: true, deactivationReason: null, photo: null, createdAt: now(), updatedAt: now(),
  }
  insert('users', user)
  passwords.set(user.id, password)
  record(actor, 'CREATE_USER', 'USER', user.id, { name, email, role: body.role, managerId })
  return user
}

function updateProfile({ id, body, actor }) {
  if (actor.role !== 'ADMIN' && id !== actor.id) fail(403, 'You can only edit your own profile.')
  const user = findUser(id)

  if (body.name !== undefined) user.name = requireText(body.name, 'Name')
  if (body.email !== undefined) user.email = requireEmail(body.email, user.id)
  user.updatedAt = now()
  record(actor, 'UPDATE_PROFILE', 'USER', id, { name: body.name, email: body.email })
  return user
}

function changeManager({ id, body, actor }) {
  requireAdmin(actor, 'Only admins can move an employee to a different manager.')
  const user = findUser(id)
  if (user.role !== 'EMPLOYEE') fail(409, 'Only employees have a manager.')

  const fromManagerId = user.managerId
  user.managerId = requireActiveManager(body.managerId).id
  user.updatedAt = now()
  record(actor, 'MOVE_EMPLOYEE', 'USER', id, { fromManagerId, toManagerId: user.managerId })
  return user
}

function deactivateUser({ id, body, actor }) {
  requireAdmin(actor, 'Only admins can deactivate users.')
  const reason = requireReason(body.reason)
  if (id === actor.id) fail(409, "You can't deactivate yourself.")
  const user = findUser(id)

  if (user.role === 'MANAGER') {
    if (db.users.some((u) => u.active && u.managerId === id)) {
      fail(409, 'Move this manager’s employees to another manager first.')
    }
    if (db.projects.some((p) => p.managerId === id && p.status !== 'ARCHIVED')) {
      fail(409, 'Give this manager’s projects to another manager first.')
    }
  }

  // A deactivated employee is taken off every team so their hours are freed.
  for (const a of db.assignments) {
    if (a.employeeId === id && a.active) markAssignmentInactive(a, `Deactivated: ${reason}`)
  }

  user.active = false
  user.deactivationReason = reason
  user.updatedAt = now()
  record(actor, 'DEACTIVATE_USER', 'USER', id, { name: user.name, reason })
  return user
}

function reactivateUser({ id, actor }) {
  requireAdmin(actor, 'Only admins can reactivate users.')
  const user = findUser(id)
  if (user.role === 'EMPLOYEE') requireActiveManager(user.managerId)

  user.active = true
  user.deactivationReason = null
  user.updatedAt = now()
  record(actor, 'REACTIVATE_USER', 'USER', id, { name: user.name })
  return user
}

// Your own photo, or anyone's if you're an admin. null removes it.
function setPhoto({ id, body, actor }) {
  if (actor.role !== 'ADMIN' && actor.id !== id) fail(403, 'You can only change your own photo.')
  const user = findUser(id)
  const photo = requirePhoto(body.photo)
  user.photo = photo
  user.updatedAt = now()
  record(actor, photo ? 'SET_PHOTO' : 'REMOVE_PHOTO', 'USER', id, { name: user.name })
  return user
}

function getWeeklyHours({ id, actor }) {
  requireCanSeeUserWork(actor, id)
  const allocatedHours = weeklyHours(id)
  return { employeeId: id, allocatedHours, availableHours: HOURS_PER_WEEK - allocatedHours }
}

function getUserAssignments({ id, actor }) {
  requireCanSeeUserWork(actor, id)
  return db.assignments
    .filter((a) => a.employeeId === id)
    .map((a) => ({ ...assignmentView(a), projectTitle: findProject(a.projectId).title }))
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

function listProjects({ actor }) {
  return db.projects.filter((p) => canSeeProject(actor, p)).map(projectView)
}

function getProject({ id, actor }) {
  return projectView(findVisibleProject(id, actor))
}

function createProject({ body, actor }) {
  requireAdmin(actor, 'Only admins can create projects.')

  const project = {
    id: null, // set by insert()
    title: requireText(body.title, 'Title'),
    description: body.description ?? '',
    managerId: requireActiveManager(body.managerId).id,
    startDate: requireDate(body.startDate, 'Start date'),
    predictedEndDate: requireDate(body.predictedEndDate, 'Predicted end date'),
    status: 'ACTIVE', completedAt: null, archivedAt: null, archiveReason: null, dependsOn: [],
    createdBy: actor.id, createdAt: now(), updatedAt: now(),
  }
  requireOrdered(project.startDate, project.predictedEndDate, 'The predicted end date')
  insert('projects', project)
  record(actor, 'CREATE_PROJECT', 'PROJECT', project.id, {
    title: project.title, managerId: project.managerId,
    startDate: project.startDate, predictedEndDate: project.predictedEndDate,
  })
  return projectView(project)
}

// Managers may change everything on their own projects except who manages them.
function updateProject({ id, body, actor }) {
  const project = findManagedProject(id, actor)
  requireWritable(project)
  if (actor.role !== 'ADMIN' && body.managerId !== undefined) {
    fail(403, 'Only admins can give a project to another manager.')
  }

  const next = { ...project }
  if (body.title !== undefined) next.title = requireText(body.title, 'Title')
  if (body.description !== undefined) next.description = body.description ?? ''
  if (body.startDate !== undefined) next.startDate = requireDate(body.startDate, 'Start date')
  if (body.predictedEndDate !== undefined) {
    next.predictedEndDate = requireDate(body.predictedEndDate, 'Predicted end date')
  }
  if (body.managerId !== undefined) next.managerId = requireActiveManager(body.managerId).id
  requireOrdered(next.startDate, next.predictedEndDate, 'The predicted end date')
  if (body.dependsOn !== undefined) next.dependsOn = requireValidProjectDependencies(project, body.dependsOn)

  const outside = db.assignments.filter(
    (a) => a.projectId === id && a.active && (a.startDate < next.startDate || a.endDate > next.predictedEndDate),
  )
  if (outside.length) {
    fail(409, `${outside.length} team assignment(s) fall outside the new dates. Adjust them first.`)
  }
  const outsideMilestones = db.milestones.filter(
    (m) => m.projectId === id && (m.startDate < next.startDate || m.dueDate > next.predictedEndDate),
  )
  if (outsideMilestones.length) {
    fail(409, `${outsideMilestones.length} milestone(s) fall outside the new dates. Adjust them first.`)
  }

  Object.assign(project, next, { updatedAt: now() })
  record(actor, 'UPDATE_PROJECT', 'PROJECT', id, {
    title: body.title, description: body.description, startDate: body.startDate,
    predictedEndDate: body.predictedEndDate, managerId: body.managerId, dependsOn: body.dependsOn,
  })
  return projectView(project)
}

function completeProject({ id, actor }) {
  const project = findManagedProject(id, actor)
  if (project.status !== 'ACTIVE') fail(409, `This project is already ${project.status.toLowerCase()}.`)
  for (const depId of project.dependsOn) {
    const dep = findProject(depId)
    if (dep.status === 'ACTIVE') fail(409, `Finish "${dep.title}" first. This project depends on it.`)
  }

  project.status = 'COMPLETED'
  project.completedAt = now()
  project.updatedAt = now()
  record(actor, 'COMPLETE_PROJECT', 'PROJECT', id, { title: project.title })
  return projectView(project)
}

// Projects can depend on projects (same rules as ProjectService.java): no loops, and a
// project can only be dropped from the list once no milestone here depends on its milestones.
function requireValidProjectDependencies(project, dependsOn) {
  if (!Array.isArray(dependsOn)) fail(400, 'dependsOn must be a list of project ids.')
  const ids = [...new Set(dependsOn.map(Number))]
  for (const depId of ids) {
    if (depId === project.id) fail(409, "A project can't depend on itself.")
    const dep = findProject(depId)
    if (projectReaches(depId, project.id)) fail(409, `"${dep.title}" already depends on this project, so that would create a loop.`)
  }
  for (const removed of project.dependsOn.filter((d) => !ids.includes(d))) {
    const linked = db.milestones.some((m) => m.projectId === project.id
      && m.dependsOn.some((depId) => findMilestone(depId).projectId === removed))
    if (linked) {
      fail(409, `Milestones here still depend on milestones in "${findProject(removed).title}". Remove those milestone dependencies first.`)
    }
  }
  return ids
}

/** True if project `fromId` depends on `targetId`, directly or through others. */
function projectReaches(fromId, targetId, seen = new Set()) {
  if (seen.has(fromId)) return false
  seen.add(fromId)
  return findProject(fromId).dependsOn.some((id) => id === targetId || projectReaches(id, targetId, seen))
}

function listProjectOptions({ actor }) {
  if (actor.role === 'EMPLOYEE') fail(403, 'Only admins and managers can set project dependencies.')
  return db.projects.filter((p) => p.status !== 'ARCHIVED')
    .map((p) => ({ id: p.id, title: p.title, status: p.status, managerName: findUser(p.managerId).name }))
}

/** Upstream (what it waits on) and downstream (what waits on it), however far away. */
function getProjectChain({ id, actor }) {
  const project = findVisibleProject(id, actor)
  const upstream = walk(project.dependsOn, (p) => p.dependsOn)
  const dependents = (pid) => db.projects.filter((p) => p.dependsOn.includes(pid)).map((p) => p.id)
  const downstream = walk(dependents(id), (p) => dependents(p.id))
  const link = (pid, direct, withMilestones) => {
    const p = findProject(pid)
    const ms = db.milestones.filter((m) => m.projectId === pid)
    const progress = p.status !== 'ACTIVE' ? 100
      : ms.length ? Math.round(ms.reduce((s, m) => s + m.progressPercent, 0) / ms.length) : 0
    return {
      id: p.id, title: p.title, status: p.status, managerName: findUser(p.managerId).name, progressPercent: progress,
      direct, canOpen: canSeeProject(actor, p), milestones: withMilestones ? ms.map(milestoneRef) : [],
    }
  }
  return {
    upstream: upstream.filter((pid) => pid !== id).map((pid) => link(pid, project.dependsOn.includes(pid), project.dependsOn.includes(pid))),
    downstream: downstream.filter((pid) => pid !== id).map((pid) => link(pid, dependents(id).includes(pid), false)),
  }
}

/** Breadth-first: start ids, then whatever `next(project)` leads to. Nearest first, no repeats. */
function walk(startIds, next) {
  const found = []
  const queue = [...startIds]
  while (queue.length) {
    const pid = queue.shift()
    if (found.includes(pid)) continue
    found.push(pid)
    queue.push(...next(findProject(pid)))
  }
  return found
}

// Managers complete projects; only admins archive them.
function archiveProject({ id, body, actor }) {
  requireAdmin(actor, 'Only admins can archive projects.')
  const reason = requireReason(body.reason)
  const project = findProject(id)
  if (project.status === 'ARCHIVED') fail(409, 'This project is already archived.')

  project.status = 'ARCHIVED'
  project.completedAt ??= now()
  project.archivedAt = now()
  project.archiveReason = reason
  project.updatedAt = now()
  record(actor, 'ARCHIVE_PROJECT', 'PROJECT', id, { title: project.title, reason })
  return projectView(project)
}

// ---------------------------------------------------------------------------
// Assignments (a project's team)
// ---------------------------------------------------------------------------

function listAssignments({ id, query, actor }) {
  findVisibleProject(id, actor)
  return db.assignments
    .filter((a) => a.projectId === id && (a.active || query.includeInactive === 'true'))
    .map(assignmentView)
}

// Managers may assign any active employee, not just the ones who report to them.
function createAssignment({ id, body, actor }) {
  const project = findManagedProject(id, actor)
  requireWritable(project)

  const employee = findUser(Number(body.employeeId))
  if (employee.role !== 'EMPLOYEE' || !employee.active) {
    fail(409, 'Only active employees can be assigned to projects.')
  }
  if (db.assignments.some((a) => a.projectId === id && a.employeeId === employee.id && a.active)) {
    fail(409, `${employee.name} is already on this project.`)
  }

  const assignment = {
    id: null, // set by insert()
    projectId: id,
    employeeId: employee.id,
    hoursPerWeek: requireHours(body.hoursPerWeek),
    startDate: body.startDate ? requireDate(body.startDate, 'Start date') : project.startDate,
    endDate: body.endDate ? requireDate(body.endDate, 'End date') : project.predictedEndDate,
    active: true, deactivatedAt: null, removalReason: null,
    assignedBy: actor.id, createdAt: now(), updatedAt: now(),
  }
  requireAssignmentFits(assignment, project)

  insert('assignments', assignment)
  record(actor, 'ASSIGN_EMPLOYEE', 'ASSIGNMENT', assignment.id, {
    projectId: id, employeeId: employee.id, hoursPerWeek: assignment.hoursPerWeek,
    startDate: assignment.startDate, endDate: assignment.endDate,
  })
  return assignmentView(assignment)
}

function updateAssignment({ id, body, actor }) {
  const assignment = findAssignment(id)
  const project = findManagedProject(assignment.projectId, actor)
  requireWritable(project)
  if (!assignment.active) fail(409, 'This person has been removed from the team.')

  const next = { ...assignment }
  if (body.hoursPerWeek !== undefined) next.hoursPerWeek = requireHours(body.hoursPerWeek)
  if (body.startDate !== undefined) next.startDate = requireDate(body.startDate, 'Start date')
  if (body.endDate !== undefined) next.endDate = requireDate(body.endDate, 'End date')
  requireAssignmentFits(next, project)

  Object.assign(assignment, next, { updatedAt: now() })
  record(actor, 'UPDATE_ASSIGNMENT', 'ASSIGNMENT', id, {
    projectId: assignment.projectId, employeeId: assignment.employeeId,
    hoursPerWeek: body.hoursPerWeek, startDate: body.startDate, endDate: body.endDate,
  })
  return assignmentView(assignment)
}

function deactivateAssignment({ id, body, actor }) {
  const assignment = findAssignment(id)
  requireWritable(findManagedProject(assignment.projectId, actor))
  const reason = requireReason(body.reason)
  if (!assignment.active) fail(409, 'This person has already been removed from the team.')

  markAssignmentInactive(assignment, reason)
  record(actor, 'REMOVE_FROM_TEAM', 'ASSIGNMENT', id, {
    projectId: assignment.projectId, employeeId: assignment.employeeId, reason,
  })
  return assignmentView(assignment)
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

// Rules (same as MilestoneService.java):
// - dates must fall within the project's dates
// - dependencies can be in this project or in a project this project depends on; no loops
// - a milestone can't be completed until everything it depends on is completed (any project)
// - moving dates never shifts other milestones; dateConflicts lists dependencies due after it

function listMilestones({ id, actor }) {
  findVisibleProject(id, actor)
  return db.milestones.filter((m) => m.projectId === id).map(milestoneView)
}

function createMilestone({ id, body, actor }) {
  const project = findManagedProject(id, actor)
  requireWritable(project)

  const milestone = {
    id: null, // set by insert()
    projectId: id,
    title: requireText(body.title, 'Title'),
    description: body.description ?? '',
    startDate: requireDate(body.startDate, 'Start date'),
    dueDate: requireDate(body.dueDate, 'Due date'),
    status: 'NOT_STARTED', progressPercent: 0, completedAt: null,
    dependsOn: [],
    createdBy: actor.id, createdAt: now(), updatedAt: now(),
  }
  requireMilestoneDates(milestone, project)
  milestone.dependsOn = requireValidDependencies(milestone, body.dependsOn ?? [])

  insert('milestones', milestone)
  record(actor, 'CREATE_MILESTONE', 'MILESTONE', milestone.id, {
    projectId: id, title: milestone.title, startDate: milestone.startDate,
    dueDate: milestone.dueDate, dependsOn: body.dependsOn,
  })
  return milestoneView(milestone)
}

function updateMilestone({ id, body, actor }) {
  const milestone = findMilestone(id)
  const project = findManagedProject(milestone.projectId, actor)
  requireWritable(project)

  const next = { ...milestone }
  if (body.title !== undefined) next.title = requireText(body.title, 'Title')
  if (body.description !== undefined) next.description = body.description ?? ''
  if (body.startDate !== undefined) next.startDate = requireDate(body.startDate, 'Start date')
  if (body.dueDate !== undefined) next.dueDate = requireDate(body.dueDate, 'Due date')
  requireMilestoneDates(next, project)

  if (body.progressPercent !== undefined) {
    const progress = Number(body.progressPercent)
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      fail(400, 'Progress must be a whole number from 0 to 100.')
    }
    next.progressPercent = progress
  }
  if (body.status !== undefined) {
    if (!MILESTONE_STATUSES.includes(body.status)) {
      fail(400, `Status must be one of ${MILESTONE_STATUSES.join(', ')}.`)
    }
    next.status = body.status
  }
  if (next.status === 'COMPLETED') {
    next.progressPercent = 100
    next.completedAt ??= now()
  } else {
    next.completedAt = null
  }

  if (body.dependsOn !== undefined) next.dependsOn = requireValidDependencies(next, body.dependsOn)
  requireCompletionOrder(next)

  Object.assign(milestone, next, { updatedAt: now() })
  record(actor, 'UPDATE_MILESTONE', 'MILESTONE', id, {
    projectId: milestone.projectId, title: body.title, startDate: body.startDate, dueDate: body.dueDate,
    status: body.status, progressPercent: body.progressPercent, dependsOn: body.dependsOn,
  })
  return milestoneView(milestone)
}

function requireMilestoneDates(milestone, project) {
  requireOrdered(milestone.startDate, milestone.dueDate, 'The due date')
  if (milestone.startDate < project.startDate || milestone.dueDate > project.predictedEndDate) {
    fail(409, `Milestone dates must be within the project (${project.startDate} to ${project.predictedEndDate}).`)
  }
}

/** Checked against the project as it would look after the change. */
function requireCompletionOrder(next) {
  const others = db.milestones.filter((m) => m.id !== next.id)
  if (next.status === 'COMPLETED') {
    for (const depId of next.dependsOn) {
      const dep = others.find((m) => m.id === depId)
      if (dep && dep.status !== 'COMPLETED') fail(409, `Finish "${dep.title}" first. This milestone depends on it.`)
    }
  } else {
    const finished = others.find((m) => m.status === 'COMPLETED' && m.dependsOn.includes(next.id))
    if (finished) {
      fail(409, `"${finished.title}" is already completed and depends on this milestone, so it can't be reopened.`)
    }
  }
}

function requireValidDependencies(milestone, dependsOn) {
  if (!Array.isArray(dependsOn)) fail(400, 'dependsOn must be a list of milestone ids.')
  const ids = [...new Set(dependsOn.map(Number))]

  for (const depId of ids) {
    if (depId === milestone.id) fail(409, "A milestone can't depend on itself.")
    const dep = findMilestone(depId)
    const allowed = [milestone.projectId, ...findProject(milestone.projectId).dependsOn]
    if (!allowed.includes(dep.projectId)) {
      fail(409, `"${dep.title}" is in a project this project doesn't depend on. Add that project as a dependency first.`)
    }
    if (dependsOnTransitively(depId, milestone.id)) {
      fail(409, `"${dep.title}" already depends on this milestone, so that would create a loop.`)
    }
  }
  return ids
}

/** True if milestone `fromId` depends on `targetId`, directly or through others. */
function dependsOnTransitively(fromId, targetId, seen = new Set()) {
  if (seen.has(fromId)) return false
  seen.add(fromId)
  const from = db.milestones.find((m) => m.id === fromId)
  return (from?.dependsOn ?? []).some(
    (id) => id === targetId || dependsOnTransitively(id, targetId, seen),
  )
}

// ---------------------------------------------------------------------------
// Audit log (same as AuditService.java): every change an admin makes
// ---------------------------------------------------------------------------

const AUDIT_ENTITY_TYPES = ['USER', 'PROJECT', 'ASSIGNMENT', 'MILESTONE']

/** Records the action if the actor is an admin. Never pass passwords in details. */
function record(actor, action, entityType, entityId, details) {
  if (actor.role !== 'ADMIN') return
  const kept = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined && v !== null))
  auditLogs.push({
    id: nextAuditId++, actorId: actor.id, actorName: actor.name,
    action, entityType, entityId, details: kept, createdAt: now(),
  })
}

function listAuditLogs({ query, actor }) {
  requireAdmin(actor, 'Only admins can view the audit log.')
  const { entityType } = query
  if (entityType && !AUDIT_ENTITY_TYPES.includes(entityType)) {
    fail(400, `entityType must be one of ${AUDIT_ENTITY_TYPES.join(', ')}.`)
  }
  const entityId = query.entityId ? Number(query.entityId) : null
  if (query.entityId && !Number.isInteger(entityId)) fail(400, 'entityId must be a number.')
  const limit = Math.max(1, Math.min(Number(query.limit) || 100, 500))

  return auditLogs
    .filter((l) => (!entityType || l.entityType === entityType) && (entityId == null || l.entityId === entityId))
    .slice()
    .reverse()
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Views: what the API returns, including calculated fields
// ---------------------------------------------------------------------------

function projectView(project) {
  const team = db.assignments.filter((a) => a.projectId === project.id && a.active)
  const totalHours = team.reduce((sum, a) => sum + assignmentTotalHours(a), 0)
  return {
    ...project,
    managerName: findUser(project.managerId).name,
    teamSize: team.length,
    totalHours: Math.round(totalHours * 10) / 10,
  }
}

function milestoneView(milestone) {
  const deps = [...milestone.dependsOn].sort((a, b) => a - b)
    .map((depId) => db.milestones.find((m) => m.id === depId)).filter(Boolean)
  const dateConflicts = deps
    .filter((dep) => dep.status !== 'COMPLETED' && dep.dueDate > milestone.dueDate)
    .map((dep) => dep.id)
  return { ...milestone, dependencies: deps.map(milestoneRef), dateConflicts }
}

/** A milestone as seen from elsewhere (as a dependency, or in the picker). */
function milestoneRef(m) {
  return {
    id: m.id, projectId: m.projectId, projectTitle: findProject(m.projectId).title, title: m.title,
    startDate: m.startDate, dueDate: m.dueDate, status: m.status, progressPercent: m.progressPercent,
  }
}

function assignmentView(assignment) {
  return { ...assignment, employeeName: findUser(assignment.employeeId).name }
}

// ---------------------------------------------------------------------------
// Permission checks
// ---------------------------------------------------------------------------

function requireActor(token) {
  if (!token) fail(401, 'Please log in.')
  const actor = db.users.find((u) => `fake-${u.id}` === token)
  if (!actor) fail(401, 'Your session has expired. Please log in again.')
  if (!actor.active) fail(401, 'This account has been deactivated.')
  return actor
}

function requireAdmin(actor, message) {
  if (actor.role !== 'ADMIN') fail(403, message)
}

function canSeeProject(actor, project) {
  if (actor.role === 'ADMIN') return true
  if (actor.role === 'MANAGER') return project.managerId === actor.id
  return db.assignments.some((a) => a.projectId === project.id && a.employeeId === actor.id)
}

function canManageProject(actor, project) {
  return actor.role === 'ADMIN' || (actor.role === 'MANAGER' && project.managerId === actor.id)
}

function findVisibleProject(id, actor) {
  const project = findProject(id)
  if (!canSeeProject(actor, project)) fail(404, 'Project not found.')
  return project
}

function findManagedProject(id, actor) {
  const project = findVisibleProject(id, actor)
  if (!canManageProject(actor, project)) fail(403, 'Only this project’s manager or an admin can do that.')
  return project
}

// Only active projects can change; completing a project freezes it until it's archived.
function requireWritable(project) {
  if (project.status === 'ARCHIVED') fail(409, 'Archived projects are read-only.')
  if (project.status === 'COMPLETED') fail(409, "This project is completed, so it can't be changed. An admin can archive it.")
}

function requireCanSeeUserWork(actor, userId) {
  if (actor.role === 'EMPLOYEE' && actor.id !== userId) fail(403, 'You can only view your own hours.')
  findUser(userId)
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function requireAssignmentFits(assignment, project) {
  requireOrdered(assignment.startDate, assignment.endDate, 'The end date')
  if (assignment.startDate < project.startDate || assignment.endDate > project.predictedEndDate) {
    fail(409, `Assignment dates must be within the project (${project.startDate} to ${project.predictedEndDate}).`)
  }

  const otherHours = weeklyHours(assignment.employeeId, assignment.id)
  if (otherHours + assignment.hoursPerWeek > HOURS_PER_WEEK) {
    const name = findUser(assignment.employeeId).name
    fail(409, `${name} already has ${otherHours} hrs/week on other projects, so at most ${HOURS_PER_WEEK - otherHours} more fit.`)
  }
}

/** Sum of an employee's active weekly hours, optionally leaving one assignment out. */
/**
 * Booked hours per week, optionally leaving one assignment out. Only active assignments
 * on ACTIVE projects count: completing or archiving a project frees its team's hours.
 */
function weeklyHours(employeeId, excludeAssignmentId) {
  return db.assignments
    .filter((a) => a.employeeId === employeeId && a.active && a.id !== excludeAssignmentId
      && findProject(a.projectId).status === 'ACTIVE')
    .reduce((sum, a) => sum + a.hoursPerWeek, 0)
}

function requireActiveManager(managerId) {
  const manager = db.users.find((u) => u.id === Number(managerId))
  if (!manager || manager.role !== 'MANAGER' || !manager.active) {
    fail(409, 'The manager must be an active user with the Manager role.')
  }
  return manager
}

function requireText(value, label) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) fail(400, `${label} is required.`)
  return text
}

function requireEmail(value, ownUserId) {
  const email = requireText(value, 'Email').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.')
  if (db.users.some((u) => u.email === email && u.id !== ownUserId)) {
    fail(409, 'Another user already has that email.')
  }
  return email
}

function requireReason(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length < 3) fail(400, 'Give a short reason (at least 3 characters).')
  if (text.length > 500) fail(400, 'Keep the reason under 500 characters.')
  return text
}

function requirePhoto(value) {
  if (value == null) return null
  if (typeof value !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) {
    fail(400, 'The photo must be a JPEG, PNG or WebP image.')
  }
  if (value.length > 140000) fail(400, 'That photo is too large. Use a smaller image.')
  return value
}

function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 8) fail(400, 'Password must be at least 8 characters.')
  if (value.length > 128) fail(400, 'Password must be at most 128 characters.')
  return value
}

function requireDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(400, `${label} must be a date (YYYY-MM-DD).`)
  }
  return value
}

function requireOrdered(start, end, endLabel) {
  if (end < start) fail(400, `${endLabel} can't be before the start date.`)
}

function requireHours(value) {
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0 || hours > HOURS_PER_WEEK) {
    fail(400, `Hours per week must be more than 0 and at most ${HOURS_PER_WEEK}.`)
  }
  return hours
}

// ---------------------------------------------------------------------------
// Lookups and small helpers
// ---------------------------------------------------------------------------

const finder = (collection, label) => (id) =>
  db[collection].find((row) => row.id === Number(id)) ?? fail(404, `${label} not found.`)

const findUser = finder('users', 'User')
const findProject = finder('projects', 'Project')
const findAssignment = finder('assignments', 'Assignment')
const findMilestone = finder('milestones', 'Milestone')

/** Saves a new record, giving it an id only once it has passed validation. */
function insert(collection, row) {
  row.id = nextId[collection]++
  db[collection].push(row)
}

function markAssignmentInactive(assignment, reason) {
  assignment.active = false
  assignment.removalReason = reason
  assignment.deactivatedAt = now()
  assignment.updatedAt = now()
}

function now() {
  return new Date().toISOString()
}

function fail(status, message) {
  throw new ApiError(status, message)
}
