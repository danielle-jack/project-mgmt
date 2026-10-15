import { useEffect, useState } from 'react'
import { Avatar, EmptyState, PageHeading, Tabs } from '../components/ui'
import { getAuditLogs } from '../services/auditApi'
import { ROLE_LABEL } from '../utils/rules'
import { formatMoney } from '../utils/format'

const PAGE_SIZE = 100
const TABS = [
  { value: '', label: 'All' },
  { value: 'USER', label: 'People' },
  { value: 'PROJECT', label: 'Projects' },
  { value: 'ASSIGNMENT', label: 'Team' },
  { value: 'MILESTONE', label: 'Milestones' },
  { value: 'EXPENSE', label: 'Expenses' },
]

/**
 * Admin only: everything admins have changed, newest first (the audit log).
 * Props: user, data ({ users, projects, archivedProjects }), query (top-bar search), onOpenProject, onNavigate.
 */
export default function ActivityPage({ data, query = '', onOpenProject, onNavigate }) {
  const [entityType, setEntityType] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [state, setState] = useState({ entries: [], loading: true, error: '' })

  useEffect(() => {
    let cancelled = false
    getAuditLogs({ entityType: entityType || undefined, limit })
      .then((entries) => !cancelled && setState({ entries, loading: false, error: '' }))
      .catch((err) => !cancelled && setState({ entries: [], loading: false, error: err.message }))
    return () => { cancelled = true }
  }, [entityType, limit])

  const names = lookups(data)
  const rows = state.entries
    .map((entry) => ({ entry, text: describe(entry, names) }))
    .filter(({ entry, text }) => `${entry.actorName} ${text} ${entry.details?.reason ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  function open(entry) {
    const projectId = entry.entityType === 'PROJECT' ? entry.entityId : entry.details?.projectId
    if (projectId == null) return null
    if (data.projects.some((p) => p.id === projectId)) return () => onOpenProject(projectId)
    if (data.archivedProjects.some((p) => p.id === projectId)) return () => onNavigate('Archive')
    return null
  }

  return (
    <>
      <PageHeading title="Activity" subtitle="Every change an admin has made, newest first. Only admins can see this." />

      <div className="panel">
        <div className="panel-header toolbar">
          <Tabs value={entityType} onChange={(value) => { setEntityType(value); setLimit(PAGE_SIZE) }} items={TABS} />
        </div>

        {state.error && <div className="empty">Couldn’t load the activity log: {state.error}</div>}
        {state.loading && rows.length === 0 && <div className="empty">Loading activity…</div>}

        {rows.map(({ entry, text }) => {
          const onClick = open(entry)
          const body = (
            <>
              <Avatar name={entry.actorName} userId={entry.actorId} />
              <span className="activity-copy">
                <span><strong>{entry.actorName}</strong> {text}</span>
                {entry.details?.reason && <small className="activity-reason">Reason: {entry.details.reason}</small>}
              </span>
              <time dateTime={entry.createdAt}>{formatWhen(entry.createdAt)}</time>
            </>
          )
          return onClick
            ? <button key={entry.id} className="list-row activity-row" onClick={onClick}>{body}</button>
            : <div key={entry.id} className="list-row activity-row">{body}</div>
        })}

        {!state.loading && !state.error && rows.length === 0 && (
          <EmptyState title={query ? 'Nothing matches' : 'No activity yet'}>
            {query ? 'Try a different name or word.' : 'Changes admins make (adding people, creating and archiving projects…) show up here.'}
          </EmptyState>
        )}

        {state.entries.length >= limit && (
          <button className="view-all" onClick={() => setLimit(limit + PAGE_SIZE)}>Load older activity</button>
        )}
      </div>
    </>
  )
}

/** Names for ids that appear in the log. */
function lookups(data) {
  const projects = [...data.projects, ...(data.archivedProjects ?? [])]
  return {
    user: (id) => data.users.find((u) => u.id === id)?.name ?? `user #${id}`,
    project: (id) => projects.find((p) => p.id === id)?.title ?? `project #${id}`,
    milestone: (id) => projects.flatMap((p) => p.milestones).find((m) => m.id === id)?.title ?? `milestone #${id}`,
  }
}

/** One log entry as the end of a sentence that starts with the admin's name. */
function describe(entry, names) {
  const d = entry.details ?? {}
  const user = d.name ?? names.user(entry.entityId)
  const project = (id) => names.project(id)
  switch (entry.action) {
    case 'CREATE_USER': return `added ${d.name} as ${ROLE_LABEL[d.role]?.toLowerCase() ?? 'a user'}`
    case 'UPDATE_PROFILE': return `updated ${names.user(entry.entityId)}’s profile${changes(d, { name: 'name', email: 'email' })}`
    case 'MOVE_EMPLOYEE': return `moved ${names.user(entry.entityId)} from ${names.user(d.fromManagerId)}’s team to ${names.user(d.toManagerId)}’s`
    case 'DEACTIVATE_USER': return `deactivated ${user}`
    case 'REACTIVATE_USER': return `reactivated ${user}`
    case 'RESET_PASSWORD': return `reset ${names.user(entry.entityId)}’s password`
    case 'CHANGE_OWN_PASSWORD': return 'changed their own password'
    case 'SET_PHOTO': return `updated ${user}’s photo`
    case 'REMOVE_PHOTO': return `removed ${user}’s photo`
    case 'CREATE_PROJECT': return `created ${d.title}`
    case 'UPDATE_PROJECT': return `edited ${project(entry.entityId)}${changes(d, { title: 'name', description: 'description', startDate: 'start date', predictedEndDate: 'end date', managerId: 'manager', dependsOn: 'dependencies', plannedBudget: 'budget' })}`
    case 'ADD_EXPENSE': return `logged ${formatMoney(d.amount)} for “${d.description}” on ${project(d.projectId)}`
    case 'VOID_EXPENSE': return `voided a ${formatMoney(d.amount)} expense on ${project(d.projectId)}`
    case 'SET_HOURLY_RATE': return `set ${user}’s hourly rate to ${formatMoney(d.to)}`
    case 'COMPLETE_PROJECT': return `marked ${d.title ?? project(entry.entityId)} completed`
    case 'ARCHIVE_PROJECT': return `archived ${d.title ?? project(entry.entityId)}`
    case 'ASSIGN_EMPLOYEE': return `added ${names.user(d.employeeId)} to ${project(d.projectId)} for ${d.hoursPerWeek}h a week`
    case 'UPDATE_ASSIGNMENT': return `changed ${names.user(d.employeeId)}’s assignment on ${project(d.projectId)}${changes(d, { hoursPerWeek: 'hours', startDate: 'start date', endDate: 'end date' })}`
    case 'REMOVE_FROM_TEAM': return `removed ${names.user(d.employeeId)} from ${project(d.projectId)}`
    case 'CREATE_MILESTONE': return `added milestone “${d.title}” to ${project(d.projectId)}`
    case 'UPDATE_MILESTONE': return `updated milestone “${d.title ?? names.milestone(entry.entityId)}” on ${project(d.projectId)}${changes(d, { startDate: 'start date', dueDate: 'due date', status: 'status', progressPercent: 'progress', dependsOn: 'dependencies' })}`
    default: return entry.action.toLowerCase().replaceAll('_', ' ')
  }
}

/** " (changed name, email)" for the fields present in the details. */
function changes(details, labels) {
  const changed = Object.keys(labels).filter((key) => details[key] !== undefined).map((key) => labels[key])
  return changed.length ? ` (${changed.join(', ')})` : ''
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
