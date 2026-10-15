import { useState } from 'react'
import Icon from '../components/Icon'
import { ConfirmDialog } from '../components/ProjectDetail'
import { Avatar, EmptyState, Field, FormModal, HoursBar, PageHeading, plural, Status, Tabs, useAction } from '../components/ui'
import { Notice } from './ProjectsPage'
import { CURRENCY, formatDate, formatMoney } from '../utils/format'
import { allocatedHours, employeeAssignments, isOverAllocated, ROLE_LABEL, ROLES, WEEK_HOURS } from '../utils/rules'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Props: user, data ({ users, projects }), query (top-bar search), actions. */
export default function PeoplePage(props) {
  if (props.user.role === ROLES.ADMIN) return <AdminPeople {...props} />
  if (props.user.role === ROLES.MANAGER) return <ManagerPeople {...props} />
  return <EmployeeWeek {...props} />
}

/* ---------------------------------------------------------------- admin -- */

function AdminPeople({ user, data, query = '', actions }) {
  const [tab, setTab] = useState('ALL')
  const [dialog, setDialog] = useState(null) // { kind, person? }
  const [notice, setNotice] = useState('')
  const close = () => setDialog(null)

  const byId = new Map(data.users.map((u) => [u.id, u]))
  const active = data.users.filter((u) => u.active)
  const count = (role) => active.filter((u) => u.role === role).length
  const over = active.filter((u) => u.role === ROLES.EMPLOYEE && isOverAllocated(u, data.projects))
  const inTab = (u) => {
    if (tab === 'DEACTIVATED') return !u.active
    if (tab === 'OVER') return over.includes(u)
    return u.active && (tab === 'ALL' || u.role === tab)
  }
  const visible = data.users
    .filter(inTab)
    .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <PageHeading title="People" subtitle="Everyone in your organization. People are deactivated, never deleted.">
        <button className="primary-button" onClick={() => setDialog({ kind: 'create' })}><Icon name="users" size={15} /> Add person</button>
      </PageHeading>

      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}

      <div className="panel">
        <div className="panel-header toolbar">
          <Tabs value={tab} onChange={setTab} items={[
            { value: 'ALL', label: 'All', count: active.length },
            { value: ROLES.ADMIN, label: 'Admins', count: count(ROLES.ADMIN) },
            { value: ROLES.MANAGER, label: 'Managers', count: count(ROLES.MANAGER) },
            { value: ROLES.EMPLOYEE, label: 'Employees', count: count(ROLES.EMPLOYEE) },
            { value: 'OVER', label: 'Over-allocated', count: over.length },
            { value: 'DEACTIVATED', label: 'Deactivated', count: data.users.length - active.length },
          ]} />
        </div>

        <div className="list-head people-grid" aria-hidden="true">
          <span>Name</span><span>Role</span><span>Reports to</span><span>This week</span><span />
        </div>
        {visible.map((person) => {
          const reports = data.users.filter((u) => u.active && u.managerId === person.id)
          return (
            <div className={`list-row people-grid ${person.active ? '' : 'inactive'}`} key={person.id}>
              <span className="manager"><Avatar name={person.name} userId={person.id} muted={!person.active} />
                <span><strong>{person.name}{person.id === user.id && <em className="you-tag">You</em>}</strong><small>{person.email}</small></span></span>
              <span className="cell-stack"><strong>{ROLE_LABEL[person.role]}</strong>
                {person.role === ROLES.MANAGER && <small>{plural(reports.length, 'direct report')}</small>}
                {person.role === ROLES.EMPLOYEE && person.hourlyRate != null && <small>{person.hourlyRate > 0 ? `${formatMoney(person.hourlyRate)}/hr` : 'No hourly rate'}</small>}</span>
              <span className="cell-stack">{person.role === ROLES.EMPLOYEE
                ? <><strong>{byId.get(person.managerId)?.name ?? 'No manager'}</strong>{byId.get(person.managerId)?.active === false && <small className="warning-text">Manager deactivated</small>}</>
                : <small>—</small>}</span>
              <span>{person.role === ROLES.EMPLOYEE && person.active
                ? <HoursBar hours={allocatedHours(person, data.projects)} limit={WEEK_HOURS} />
                : !person.active ? <span className="cell-stack"><Status tone="gray">Deactivated</Status>{person.deactivationReason && <small>{person.deactivationReason}</small>}</span> : <small className="muted">—</small>}</span>
              <span className="row-buttons">
                {person.active && <button className="text-button" onClick={() => setDialog({ kind: 'edit', person })}>Edit</button>}
                {person.active && person.role === ROLES.EMPLOYEE && <button className="text-button" onClick={() => setDialog({ kind: 'move', person })}>Change manager</button>}
                {person.active && person.id !== user.id && <button className="text-button danger-text" onClick={() => setDialog({ kind: 'deactivate', person })}>Deactivate</button>}
                {!person.active && <button className="text-button" onClick={() => setDialog({ kind: 'reactivate', person })}>Reactivate</button>}
              </span>
            </div>
          )
        })}
        {visible.length === 0 && (
          <EmptyState title={query ? 'No one matches' : tab === 'DEACTIVATED' ? 'No deactivated people' : tab === 'OVER' ? 'No one is over-allocated' : 'No one here yet'}>
            {query ? 'Try a different name or email.' : tab === 'DEACTIVATED' ? 'People you deactivate show up here and can be reactivated.'
              : tab === 'OVER' ? `Employees booked for more than ${WEEK_HOURS}h a week across projects show up here.` : 'Add people and they’ll log in with the email and password you set.'}
          </EmptyState>
        )}
      </div>

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <PersonForm data={data} person={dialog.person} actions={actions} onClose={close} onSaved={setNotice} />
      )}
      {dialog?.kind === 'move' && <MoveForm data={data} person={dialog.person} actions={actions} onClose={close} onSaved={setNotice} />}
      {dialog?.kind === 'deactivate' && <DeactivateDialog data={data} person={dialog.person} actions={actions} onClose={close} onDone={setNotice} />}
      {dialog?.kind === 'reactivate' && (
        <ConfirmDialog title={`Reactivate ${dialog.person.name}?`} confirmLabel="Reactivate" primary onClose={close}
          onConfirm={() => actions.setUserActive(dialog.person.id, true)} onDone={() => setNotice(`${dialog.person.name} reactivated.`)}>
          They’ll be able to log in again with their existing email and password.
        </ConfirmDialog>
      )}
    </>
  )
}

function PersonForm({ data, person, actions, onClose, onSaved }) {
  const isNew = !person
  const managers = data.users.filter((u) => u.active && u.role === ROLES.MANAGER)
  const [form, setForm] = useState({
    name: person?.name ?? '', email: person?.email ?? '', role: person?.role ?? ROLES.EMPLOYEE,
    managerId: person?.managerId ?? '', password: '', hourlyRate: person?.hourlyRate || '',
  })
  const { pending, error, setError, run } = useAction()
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit() {
    const email = form.email.trim().toLowerCase()
    if (!form.name.trim()) return setError('Enter their full name.')
    if (!EMAIL.test(email)) return setError('Enter a valid email address, like name@company.com.')
    if (data.users.some((u) => u.email.toLowerCase() === email && u.id !== person?.id)) return setError('Someone already uses that email. Each person needs their own.')
    if (isNew && form.role === ROLES.EMPLOYEE && !form.managerId) return setError('Choose a manager. Every employee reports to exactly one.')
    if (isNew && form.password.length < 8) return setError('Set a temporary password of at least 8 characters.')
    const isEmployee = form.role === ROLES.EMPLOYEE
    const rate = Number(form.hourlyRate) || 0
    if (isEmployee && rate < 0) return setError('The hourly rate can’t be negative.')
    const payload = isNew
      ? { name: form.name.trim(), email, role: form.role, password: form.password, managerId: isEmployee ? form.managerId : null, hourlyRate: isEmployee ? rate : null }
      : { name: form.name.trim(), email }
    const ok = await run(async () => {
      if (isNew) return actions.createUser(payload)
      await actions.updateUser(person.id, payload)
      if (isEmployee && rate !== (person.hourlyRate ?? 0)) await actions.setHourlyRate(person.id, rate)
    })
    if (ok) { onSaved(isNew ? `Added ${payload.name}. Share their email and temporary password with them.` : 'Changes saved.'); onClose() }
  }

  return (
    <FormModal title={isNew ? 'Add person' : `Edit ${person.name}`} onClose={onClose} onSubmit={submit}
      submitLabel={isNew ? 'Add person' : 'Save changes'} pending={pending} error={error}
      subtitle={isNew ? 'They’ll log in with this email and password.' : `${ROLE_LABEL[person.role]}. Roles can’t be changed after an account is created.`}>
      <Field label="Full name" wide><input value={form.name} onChange={set('name')} autoComplete="off" /></Field>
      <Field label="Email" wide><input type="email" value={form.email} onChange={set('email')} autoComplete="off" /></Field>
      {isNew && (
        <>
          <Field label="Role">
            <select value={form.role} onChange={set('role')}>
              {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          {form.role === ROLES.EMPLOYEE ? (
            <Field label="Manager" hint={managers.length === 0 ? 'Add a manager first.' : undefined}>
              <select value={form.managerId} onChange={set('managerId')}>
                <option value="">Choose a manager</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          ) : <div />}
          <Field label="Temporary password" wide hint="At least 8 characters.">
            <input type="text" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
        </>
      )}
      {form.role === ROLES.EMPLOYEE && (
        <Field label={`Hourly rate (${CURRENCY})`} wide hint="Their cost per hour. Project labour cost = hours worked × this rate. Changing it also changes past labour cost.">
          <input type="number" min="0" step="0.5" value={form.hourlyRate} onChange={set('hourlyRate')} placeholder="e.g. 85" />
        </Field>
      )}
    </FormModal>
  )
}

function MoveForm({ data, person, actions, onClose, onSaved }) {
  const managers = data.users.filter((u) => u.active && u.role === ROLES.MANAGER && u.id !== person.managerId)
  const current = data.users.find((u) => u.id === person.managerId)
  const [managerId, setManagerId] = useState('')
  const { pending, error, setError, run } = useAction()

  async function submit() {
    if (!managerId) return setError('Choose their new manager.')
    const name = managers.find((m) => String(m.id) === managerId).name // <select> values are strings
    const ok = await run(() => actions.reassignManager(person.id, managerId))
    if (ok) { onSaved(`${person.name} now reports to ${name}.`); onClose() }
  }

  return (
    <FormModal title={`Change ${person.name}’s manager`} onClose={onClose} onSubmit={submit}
      submitLabel="Change manager" pending={pending} error={error}
      subtitle={`Currently reports to ${current?.name ?? 'no one'}. Their project assignments stay as they are.`}>
      <Field label="New manager" wide hint={managers.length === 0 ? 'There’s no other active manager to move them to.' : undefined}>
        <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          <option value="">Choose a manager</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
    </FormModal>
  )
}

function DeactivateDialog({ data, person, actions, onClose, onDone }) {
  const reports = data.users.filter((u) => u.active && u.managerId === person.id)
  const managed = data.projects.filter((p) => p.status !== 'ARCHIVED' && p.managerId === person.id)
  const lastAdmin = person.role === ROLES.ADMIN && data.users.filter((u) => u.active && u.role === ROLES.ADMIN).length <= 1
  const assignments = employeeAssignments(person.id, data.projects)

  const blockers = [
    reports.length > 0 && `Move their ${plural(reports.length, 'direct report')} to another manager.`,
    managed.length > 0 && `Give their ${plural(managed.length, 'unarchived project')} a new manager, or archive ${managed.length === 1 ? 'it' : 'them'}.`,
    lastAdmin && 'Add another admin first. The organization needs at least one.',
  ].filter(Boolean)

  if (blockers.length) {
    return (
      <FormModalInfo title={`${person.name} can’t be deactivated yet`} onClose={onClose}>
        <ul className="blocker-list">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
      </FormModalInfo>
    )
  }

  return (
    <ConfirmDialog title={`Deactivate ${person.name}?`} confirmLabel="Deactivate" onClose={onClose}
      reasonLabel="Why are they being deactivated?"
      onConfirm={(reason) => actions.setUserActive(person.id, false, reason)} onDone={() => onDone(`${person.name} deactivated.`)}>
      They won’t be able to log in. Their history stays in Planeo and you can reactivate them later.
      {assignments.length > 0 && ` They’re still on ${plural(assignments.length, 'project')}; remove them from those teams to free the hours.`}
    </ConfirmDialog>
  )
}

function FormModalInfo({ title, onClose, children }) {
  return (
    <FormModal title={title} onClose={onClose} onSubmit={onClose} submitLabel="Got it">{children}</FormModal>
  )
}

/* -------------------------------------------------------------- manager -- */

function ManagerPeople({ user, data, query = '' }) {
  const team = data.users
    .filter((u) => u.active && u.role === ROLES.EMPLOYEE && u.managerId === user.id)
    .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const free = team.reduce((sum, u) => sum + Math.max(0, WEEK_HOURS - allocatedHours(u, data.projects)), 0)
  const over = team.filter((u) => isOverAllocated(u, data.projects)).length

  return (
    <>
      <PageHeading title="Your team" subtitle={`${plural(team.length, 'direct report')} · ${free}h free this week${over ? ` · ${over} over-allocated` : ''}. Ask an admin to add people or move someone to another manager.`} />
      <section className="people-cards">
        {team.map((person) => <PersonCard key={person.id} person={person} data={data} />)}
      </section>
      {team.length === 0 && (
        <div className="panel"><EmptyState title={query ? 'No one matches' : 'No direct reports yet'}>
          {query ? 'Try a different name.' : 'When an admin assigns employees to you, they’ll show up here.'}
        </EmptyState></div>
      )}
    </>
  )
}

function PersonCard({ person, data }) {
  const assignments = employeeAssignments(person.id, data.projects)
  const hours = allocatedHours(person, data.projects)
  return (
    <article className="panel person-card">
      <header className="manager"><Avatar name={person.name} userId={person.id} /><span><strong>{person.name}{hours > WEEK_HOURS && <em className="over-tag">Over-allocated</em>}</strong><small>{person.email}</small></span></header>
      <HoursBar hours={hours} limit={WEEK_HOURS} />
      <ul className="assignment-list">
        {assignments.map((a) => (
          <li key={a.id}><span>{a.projectTitle}</span><strong>{a.hoursPerWeek}h</strong></li>
        ))}
        {assignments.length === 0 && <li className="muted">Not on any project. {WEEK_HOURS}h available.</li>}
      </ul>
    </article>
  )
}

/* ------------------------------------------------------------- employee -- */

function EmployeeWeek({ user, data }) {
  const me = data.users.find((u) => u.id === user.id) ?? user
  const manager = data.users.find((u) => u.id === me.managerId)
  const assignments = employeeAssignments(user.id, data.projects)
  const hours = allocatedHours(me, data.projects)

  return (
    <>
      <PageHeading title="Your week" subtitle={manager ? `You report to ${manager.name}.` : 'Your planned hours across projects.'} />
      <div className="panel person-card single">
        <HoursBar hours={hours} limit={WEEK_HOURS} />
        <ul className="assignment-list">
          {assignments.map((a) => (
            <li key={a.id}><span>{a.projectTitle}<small>{formatDate(a.startDate)} – {formatDate(a.endDate)}</small></span><strong>{a.hoursPerWeek}h / week</strong></li>
          ))}
          {assignments.length === 0 && <li className="muted">You’re not on a project yet. {manager ? `${manager.name} will assign you.` : ''}</li>}
        </ul>
      </div>
    </>
  )
}
