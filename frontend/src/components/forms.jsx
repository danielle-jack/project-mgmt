import { useEffect, useMemo, useState } from 'react'
import { Field, FormModal, useAction } from './ui'
import { getProjectOptions } from '../services/projectApi'
import { CURRENCY, formatDate, todayISO } from '../utils/format'
import {
  activeAssignments, allocatedHours, assignableEmployees, createsCycle, editableProjectFields,
  MILESTONE_STATUS, milestoneConflicts, overAllocationWarning, ROLES, validateAssignment, validateMilestone, WEEK_HOURS,
} from '../utils/rules'

/* -------------------------------------------------------------- project -- */

/** Create a project (admins) or edit one (admins: every field, managers: POLICY.managerEditableFields). */
export function ProjectForm({ user, users, project, actions, onClose, onSaved }) {
  const isNew = !project
  const editable = isNew
    ? ['title', 'description', 'managerId', 'startDate', 'predictedEndDate', 'plannedBudget']
    : editableProjectFields(user, project)
  const managers = users.filter((u) => u.active && u.role === ROLES.MANAGER)
  const [form, setForm] = useState({
    title: project?.title ?? '',
    description: project?.description ?? '',
    managerId: project?.managerId ?? '',
    startDate: project?.startDate ?? '',
    predictedEndDate: project?.predictedEndDate ?? '',
    plannedBudget: project?.plannedBudget || '',
    dependsOn: project?.dependsOn ?? [],
  })
  const { pending, error, setError, run } = useAction()
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const locked = (key) => !editable.includes(key)

  // Projects this one can depend on (any manager's), loaded when editing.
  const pickDeps = !isNew && editable.includes('dependsOn')
  const [options, setOptions] = useState(null)
  useEffect(() => {
    if (!pickDeps) return
    getProjectOptions().then((list) => setOptions(list.filter((p) => p.id !== project.id)))
      .catch(() => setOptions([]))
  }, [pickDeps, project?.id])
  const toggleProject = (id) => setForm({
    ...form, dependsOn: form.dependsOn.includes(id) ? form.dependsOn.filter((d) => d !== id) : [...form.dependsOn, id],
  })

  async function submit() {
    const problem = validateProject(form, project)
    if (problem) return setError(problem)
    const patch = Object.fromEntries(editable.map((key) => [key, form[key]]))
    if ('plannedBudget' in patch) patch.plannedBudget = Number(form.plannedBudget) || 0
    const ok = await run(() => (isNew ? actions.createProject(patch) : actions.updateProject(project.id, patch)))
    if (ok) { onSaved?.(isNew ? `Created ${form.title}.` : 'Project saved.'); onClose() }
  }

  return (
    <FormModal title={isNew ? 'New project' : 'Edit project'} onClose={onClose} onSubmit={submit}
      submitLabel={isNew ? 'Create project' : 'Save changes'} pending={pending} error={error}
      subtitle={!isNew && user.role === ROLES.MANAGER ? 'Only an admin can give the project a different manager.' : undefined}>
      <Field label="Project name" wide>
        <input value={form.title} onChange={set('title')} disabled={locked('title')} maxLength={120} />
      </Field>
      <Field label="Description" wide>
        <textarea rows={3} value={form.description} onChange={set('description')} disabled={locked('description')} />
      </Field>
      <Field label="Manager" wide hint={managers.length === 0 ? 'Add a manager on the People page first.' : undefined}>
        <select value={form.managerId} onChange={set('managerId')} disabled={locked('managerId')}>
          <option value="">Choose a manager</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          {project && !managers.some((m) => m.id === project.managerId) && (
            <option value={project.managerId}>{project.managerName} (deactivated)</option>
          )}
        </select>
      </Field>
      <Field label="Start date">
        <input type="date" value={form.startDate} onChange={set('startDate')} disabled={locked('startDate')} />
      </Field>
      <Field label="Predicted end date">
        <input type="date" value={form.predictedEndDate} onChange={set('predictedEndDate')} disabled={locked('predictedEndDate')} />
      </Field>
      <Field label={`Planned budget (${CURRENCY})`} wide
        hint="Everything the project may spend: team labour (hours × hourly rate) plus expenses. Leave empty for no budget.">
        <input type="number" min="0" step="100" value={form.plannedBudget} onChange={set('plannedBudget')}
          disabled={locked('plannedBudget')} placeholder="e.g. 120000" />
      </Field>
      {pickDeps && (
        <fieldset className="form-wide dependency-picker">
          <legend>Depends on projects</legend>
          <p className="field-hint">This project can’t be completed until these are finished, and its milestones can depend on theirs.</p>
          {options === null && <p className="field-hint">Loading projects…</p>}
          {options?.length === 0 && <p className="field-hint">There are no other projects yet.</p>}
          {options?.map((p) => (
            <label key={p.id} className="check-row">
              <input type="checkbox" checked={form.dependsOn.includes(p.id)} onChange={() => toggleProject(p.id)} />
              <span>{p.title}<small>{p.managerName} · {p.status === 'ACTIVE' ? 'In progress' : 'Completed'}</small></span>
            </label>
          ))}
        </fieldset>
      )}
    </FormModal>
  )
}

function validateProject(form, project) {
  if (!form.title.trim()) return 'Give the project a name.'
  if (!form.managerId) return 'Choose a manager. Every project needs exactly one.'
  if (!form.startDate || !form.predictedEndDate) return 'Enter a start date and a predicted end date.'
  if (form.predictedEndDate < form.startDate) return 'The predicted end date must be on or after the start date.'
  if (form.plannedBudget !== '' && !(Number(form.plannedBudget) >= 0)) return 'The planned budget must be 0 or more.'
  if (!project) return ''
  const outside = activeAssignments(project)
    .filter((a) => a.startDate < form.startDate || a.endDate > form.predictedEndDate)
  if (outside.length) {
    return `${outside.map((a) => a.employeeName).join(', ')} ${outside.length === 1 ? 'is' : 'are'} assigned outside these dates. Adjust their assignment dates first.`
  }
  const milestones = project.milestones
    .filter((m) => m.startDate < form.startDate || m.dueDate > form.predictedEndDate)
  if (milestones.length) {
    return `Move these milestones inside the new dates first: ${milestones.map((m) => m.title).join(', ')}.`
  }
  return ''
}

/* ----------------------------------------------------------- assignment -- */

export function AssignmentForm({ user, data, project, assignment, actions, onClose, onSaved }) {
  const isNew = !assignment
  const onTeam = new Set(activeAssignments(project).map((a) => a.employeeId))
  const options = assignableEmployees(user, data.users).filter((u) => !isNew || !onTeam.has(u.id))
  const [form, setForm] = useState({
    employeeId: assignment?.employeeId ?? '',
    hoursPerWeek: assignment?.hoursPerWeek ?? '',
    startDate: assignment?.startDate ?? project.startDate,
    endDate: assignment?.endDate ?? project.predictedEndDate,
  })
  const [confirmOver, setConfirmOver] = useState(false)
  const { pending, error, setError, run } = useAction()
  const set = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setConfirmOver(false) }

  const employee = data.users.find((u) => String(u.id) === String(form.employeeId)) // <select> values are strings
    ?? (assignment && { id: assignment.employeeId, name: assignment.employeeName })
  const free = employee
    ? WEEK_HOURS - allocatedHours(employee, data.projects, { excludeAssignmentId: assignment?.id })
    : null
  const overWarning = overAllocationWarning(form, { employee, projects: data.projects, assignmentId: assignment?.id })

  async function submit() {
    const problem = validateAssignment(form, { project, employee, projects: data.projects, assignmentId: assignment?.id })
    if (problem) return setError(problem)
    if (overWarning && !confirmOver) return setError('Tick the box to confirm the over-allocation, or lower the hours.')
    const payload = { ...form, hoursPerWeek: Number(form.hoursPerWeek), allowOverAllocation: Boolean(overWarning) }
    const ok = await run(() => (isNew
      ? actions.createAssignment(project.id, payload)
      : actions.updateAssignment(assignment.id, payload)))
    if (ok) { onSaved?.(isNew ? `Added ${employee.name} to the team.` : 'Assignment saved.'); onClose() }
  }

  return (
    <FormModal title={isNew ? 'Add team member' : `Edit ${assignment.employeeName}’s assignment`}
      subtitle={`${project.title} runs ${formatDate(project.startDate)} to ${formatDate(project.predictedEndDate)}.`}
      onClose={onClose} onSubmit={submit} submitLabel={isNew ? 'Add to team' : 'Save changes'}
      pending={pending} error={error}>
      {isNew && (
        <Field label="Employee" wide hint={options.length === 0 ? 'Everyone you can assign is already on this project.' : undefined}>
          <select value={form.employeeId} onChange={set('employeeId')}>
            <option value="">Choose an employee</option>
            {options.map((u) => {
              const left = WEEK_HOURS - allocatedHours(u, data.projects)
              return <option key={u.id} value={u.id}>{u.name} · {left > 0 ? `${left}h free` : left === 0 ? 'fully booked' : `${-left}h over-allocated`}</option>
            })}
          </select>
        </Field>
      )}
      <Field label="Hours per week" wide
        hint={free != null
          ? (free >= 0 ? `${employee.name} has ${free}h of ${WEEK_HOURS}h free each week.` : `${employee.name} is already ${-free}h over the ${WEEK_HOURS}h week.`)
          : `A normal week is ${WEEK_HOURS}h across all projects.`}>
        <input type="number" min="1" max={WEEK_HOURS} step="0.5" value={form.hoursPerWeek} onChange={set('hoursPerWeek')} />
      </Field>
      <Field label="From">
        <input type="date" value={form.startDate} min={project.startDate} max={project.predictedEndDate} onChange={set('startDate')} />
      </Field>
      <Field label="Until">
        <input type="date" value={form.endDate} min={project.startDate} max={project.predictedEndDate} onChange={set('endDate')} />
      </Field>
      {overWarning && (
        <div className="inline-warning form-wide">
          <span>{overWarning}</span>
          <label className="check-row">
            <input type="checkbox" checked={confirmOver} onChange={(e) => setConfirmOver(e.target.checked)} />
            <span>Assign anyway</span>
          </label>
        </div>
      )}
    </FormModal>
  )
}

/* -------------------------------------------------------------- expense -- */

/** Log non-labour spending (licences, hardware, travel...) against a project's budget. */
export function ExpenseForm({ project, actions, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', amount: '', spentOn: todayISO() })
  const { pending, error, setError, run } = useAction()
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit() {
    const amount = Number(form.amount)
    if (!form.description.trim()) return setError('Say what the money was spent on.')
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter an amount more than 0.')
    if (!form.spentOn) return setError('Enter the date it was spent.')
    if (form.spentOn > todayISO()) return setError('Expenses can’t be dated in the future.')
    const ok = await run(() => actions.createExpense(project.id, { ...form, description: form.description.trim(), amount }))
    if (ok) { onSaved?.('Expense logged.'); onClose() }
  }

  return (
    <FormModal title="Log expense" subtitle={`Counts toward ${project.title}’s budget.`} onClose={onClose}
      onSubmit={submit} submitLabel="Log expense" pending={pending} error={error}>
      <Field label="What was it for?" wide>
        <input value={form.description} onChange={set('description')} maxLength={200} placeholder="e.g. Design tool licences" />
      </Field>
      <Field label={`Amount (${CURRENCY})`}>
        <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} />
      </Field>
      <Field label="Date spent">
        <input type="date" value={form.spentOn} max={todayISO()} onChange={set('spentOn')} />
      </Field>
    </FormModal>
  )
}

/* ------------------------------------------------------------ milestone -- */

/**
 * Create or edit a milestone. Pass `project` to fix the project, or `projects`
 * to let the person pick one (the Milestones page).
 */
export function MilestoneForm({ project: fixedProject, projects, milestone, actions, onClose, onSaved }) {
  const isNew = !milestone
  const [projectId, setProjectId] = useState(fixedProject?.id ?? projects?.[0]?.id ?? '')
  const project = fixedProject ?? projects.find((p) => String(p.id) === String(projectId)) // <select> values are strings
  const [form, setForm] = useState({
    title: milestone?.title ?? '',
    startDate: milestone?.startDate ?? '',
    dueDate: milestone?.dueDate ?? '',
    status: milestone?.status ?? 'NOT_STARTED',
    progress: milestone?.progress ?? 0,
    dependsOn: milestone?.dependsOn ?? [],
  })
  const { pending, error, setError, run } = useAction()
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  // Can depend on milestones in this project or in a project this project depends on.
  const candidates = useMemo(() => [...(project?.milestones ?? []), ...(project?.upstreamMilestones ?? [])], [project])
  const others = candidates.filter((m) => m.id !== milestone?.id)
  const byId = useMemo(() => new Map(candidates.map((m) => [m.id, m])), [candidates])
  const groups = groupByProject(others, project)
  const conflicts = form.startDate && form.dueDate ? milestoneConflicts(form, byId) : []

  function toggleDependency(id) {
    const dependsOn = form.dependsOn.includes(id) ? form.dependsOn.filter((d) => d !== id) : [...form.dependsOn, id]
    setForm({ ...form, dependsOn })
  }

  function changeProject(id) {
    setProjectId(id)
    setForm({ ...form, dependsOn: [] })
  }

  async function submit() {
    if (!project) return setError('Choose a project.')
    const problem = validateMilestone(form, { project, milestones: candidates, milestoneId: milestone?.id })
    if (problem) return setError(problem)
    const payload = { ...form, title: form.title.trim(), progress: form.status === 'COMPLETED' ? 100 : Number(form.progress) }
    const ok = await run(() => (isNew ? actions.createMilestone(project.id, payload) : actions.updateMilestone(milestone.id, payload)))
    if (ok) { onSaved?.(isNew ? `Added ${payload.title}.` : 'Milestone saved.'); onClose() }
  }

  return (
    <FormModal title={isNew ? 'New milestone' : 'Edit milestone'} onClose={onClose} onSubmit={submit}
      submitLabel={isNew ? 'Create milestone' : 'Save changes'} pending={pending} error={error}
      subtitle={project ? `${project.title} runs ${formatDate(project.startDate)} to ${formatDate(project.predictedEndDate)}.` : undefined}>
      {!fixedProject && isNew && (
        <Field label="Project" wide>
          <select value={projectId} onChange={(e) => changeProject(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
      )}
      <Field label="Milestone name" wide>
        <input value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Design handoff" />
      </Field>
      <Field label="Start date">
        <input type="date" value={form.startDate} onChange={set('startDate')} />
      </Field>
      <Field label="Due date">
        <input type="date" value={form.dueDate} onChange={set('dueDate')} />
      </Field>
      <Field label="Status">
        <select value={form.status} onChange={set('status')}>
          {Object.entries(MILESTONE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label={`Progress: ${form.status === 'COMPLETED' ? 100 : form.progress}%`}>
        <input type="range" min="0" max="100" step="5" value={form.status === 'COMPLETED' ? 100 : form.progress}
          onChange={set('progress')} disabled={form.status === 'COMPLETED'} />
      </Field>

      <fieldset className="form-wide dependency-picker">
        <legend>Depends on</legend>
        {others.length === 0 && <p className="field-hint">No other milestones in this project yet.</p>}
        {groups.map((group) => (
          <div key={group.title} className="dependency-group">
            {groups.length > 1 && <div className="dependency-group-title">{group.title}</div>}
            {group.items.map((m) => {
              const loops = !form.dependsOn.includes(m.id) && createsCycle(candidates, milestone?.id, [...form.dependsOn, m.id])
              return (
                <label key={m.id} className={`check-row ${loops ? 'disabled' : ''}`}>
                  <input type="checkbox" checked={form.dependsOn.includes(m.id)} disabled={loops} onChange={() => toggleDependency(m.id)} />
                  <span>{m.title}<small>{loops ? 'Already depends on this milestone' : `Due ${formatDate(m.dueDate)} · ${MILESTONE_STATUS[m.status]}`}</small></span>
                </label>
              )
            })}
          </div>
        ))}
      </fieldset>

      {conflicts.length > 0 && (
        <div className="inline-warning form-wide">
          {conflicts.map((c) => <span key={c}>{c}. You can save anyway and adjust dates later.</span>)}
        </div>
      )}
    </FormModal>
  )
}

/** Picker groups: this project's milestones first, then one group per project it depends on. */
function groupByProject(milestones, project) {
  const groups = new Map()
  for (const m of milestones) {
    const own = !m.projectId || m.projectId === project?.id
    const title = own ? 'This project' : m.projectTitle
    if (!groups.has(title)) groups.set(title, { title, items: [] })
    groups.get(title).items.push(m)
  }
  return [...groups.values()].sort((a, b) => (a.title === 'This project' ? -1 : b.title === 'This project' ? 1 : 0))
}
