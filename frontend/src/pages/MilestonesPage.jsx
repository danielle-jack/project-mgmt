import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { MilestoneItem } from '../components/ProjectDetail'
import { MilestoneForm } from '../components/forms'
import { EmptyState, PageHeading, Tabs } from '../components/ui'
import { Notice } from './ProjectsPage'
import { milestoneHealth, TONE } from '../utils/projectHealth'
import { daysUntil } from '../utils/format'
import { can, milestoneConflicts, ROLES } from '../utils/rules'

const TABS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ATTENTION', label: 'Needs attention' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ALL', label: 'All' },
]

/** Props: user, data ({ projects }), query (top-bar search), actions. */
export default function MilestonesPage({ user, data, query = '', actions }) {
  const [tab, setTab] = useState('OPEN')
  const [projectId, setProjectId] = useState('')
  const [dialog, setDialog] = useState(null) // { milestone?, project? }
  const [notice, setNotice] = useState('')

  const items = useMemo(() => data.projects.flatMap((project) => {
    const byId = new Map(project.milestones.map((m) => [m.id, m]))
    return project.milestones.map((m) => ({
      milestone: m,
      project,
      health: milestoneHealth(m, byId),
      conflicts: m.status === 'COMPLETED' ? [] : milestoneConflicts(m, byId),
    }))
  }), [data.projects])

  const manageable = data.projects.filter((p) => can.manageMilestones(user, p))
  const open = items.filter((i) => i.milestone.status !== 'COMPLETED')
  const needsAttention = (i) => i.milestone.status !== 'COMPLETED'
    && (i.health.tone !== TONE.GREEN || i.health.blocked || i.conflicts.length > 0)

  const visible = items
    .filter((i) => (tab === 'OPEN' ? i.milestone.status !== 'COMPLETED'
      : tab === 'COMPLETED' ? i.milestone.status === 'COMPLETED'
        : tab === 'ATTENTION' ? needsAttention(i) : true))
    .filter((i) => !projectId || String(i.project.id) === projectId) // <select> values are strings
    .filter((i) => `${i.milestone.title} ${i.project.title}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.milestone.dueDate.localeCompare(b.milestone.dueDate))

  const dueThisWeek = open.filter((i) => { const d = daysUntil(i.milestone.dueDate); return d >= 0 && d <= 7 }).length
  const overdue = open.filter((i) => daysUntil(i.milestone.dueDate) < 0).length
  const blocked = open.filter((i) => i.health.blocked || i.conflicts.length > 0).length

  return (
    <>
      <PageHeading title="Milestones" subtitle={user.role === ROLES.EMPLOYEE
        ? 'Deliverables on the projects you’re assigned to.'
        : 'Deliverables across your projects, with their dependencies and progress.'}>
        {manageable.length > 0 && (
          <button className="primary-button" onClick={() => setDialog({})}><Icon name="calendar" size={15} /> New milestone</button>
        )}
      </PageHeading>

      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}

      <section className="metrics">
        <Metric label="Open" value={open.length} icon="folder" tone="violet" note={`${items.length - open.length} completed`} />
        <Metric label="Due this week" value={dueThisWeek} icon="calendar" tone="amber" note="Next 7 days" />
        <Metric label="Overdue" value={overdue} icon="clock" tone="coral" note="Past their due date" />
        <Metric label="Waiting on others" value={blocked} icon="alert" tone="blue" note="Blocked or dates conflict" />
      </section>

      <div className="panel">
        <div className="panel-header toolbar">
          <Tabs value={tab} onChange={setTab} items={TABS.map((t) => ({
            ...t, count: t.value === 'OPEN' ? open.length : t.value === 'ATTENTION' ? items.filter(needsAttention).length : undefined,
          }))} />
          {data.projects.length > 1 && (
            <select className="compact-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Filter by project">
              <option value="">All projects</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
        </div>

        {visible.map(({ milestone, project }) => (
          <MilestoneItem key={milestone.id} milestone={milestone} project={project} showProject
            onEdit={can.manageMilestones(user, project) ? () => setDialog({ milestone, project }) : undefined} />
        ))}

        {visible.length === 0 && (
          items.length === 0
            ? <EmptyState title="No milestones yet"
                action={manageable.length > 0 ? <button className="primary-button" onClick={() => setDialog({})}>Add a milestone</button> : null}>
                {manageable.length > 0 ? 'Break a project into deliverables so the team knows what’s due when.' : 'Milestones appear here once a project manager adds them.'}
              </EmptyState>
            : <EmptyState title="Nothing here">{tab === 'ATTENTION' ? 'Every open milestone is on track.' : 'No milestones match this view.'}</EmptyState>
        )}
      </div>

      {dialog && (
        <MilestoneForm actions={actions} onClose={() => setDialog(null)} onSaved={setNotice}
          milestone={dialog.milestone} project={dialog.project}
          projects={dialog.project ? undefined : manageable} />
      )}
    </>
  )
}

function Metric({ label, value, icon, tone, note }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon name={icon} /></span></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}
