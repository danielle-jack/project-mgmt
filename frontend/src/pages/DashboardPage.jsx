import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { Avatar } from '../components/ui'
import { milestoneHealth, projectHealth, projectProgress, TONE } from '../utils/projectHealth'
import { dateBadge, daysUntil, formatDate, greeting, longToday, relativeDue, ROLE_SHORT } from '../utils/format'

const FILTERS = ['All projects', 'On track', 'At risk']
const UPCOMING_DAYS = 7
const MAX_TEAM_AVATARS = 4

const PORTFOLIO_SUBTITLE = {
  ADMIN: 'Active work across all managers',
  MANAGER: 'Projects you manage',
  EMPLOYEE: 'Projects you’re assigned to',
}

/** The "Overview" page from the wireframe, filled with the user's real data. */
export default function DashboardPage({ user, data, query, onNavigate, onOpenProject }) {
  const [filter, setFilter] = useState('All projects')

  const projects = useMemo(() => data.projects.map((project) => ({
    ...project,
    health: projectHealth(project, project.milestones),
    progress: projectProgress(project, project.milestones),
  })), [data.projects])

  const visibleProjects = projects.filter((project) => {
    const matchesQuery = project.title.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All projects'
      || (filter === 'At risk' ? project.health.tone !== TONE.GREEN : project.health.tone === TONE.GREEN)
    return matchesQuery && matchesFilter
  })

  const upcoming = upcomingMilestones(projects)
  const overdueCount = upcoming.filter((m) => m.health.tone === TONE.RED).length
  const attentionCount = projects.filter((p) => p.health.tone !== TONE.GREEN).length
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length
  const completedCount = projects.length - activeCount

  const { capacity } = data
  const capacityPercent = capacity.total ? Math.round((capacity.allocated / capacity.total) * 100) : 0
  const isEmployee = user.role === 'EMPLOYEE'

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">{longToday()}</div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p>Here’s what’s happening across {user.role === 'ADMIN' ? 'your organization' : 'your projects'}.</p>
        </div>
        <div className="role-pill"><span>Viewing as</span><strong>{ROLE_SHORT[user.role]}</strong></div>
      </section>

      <section className="metrics">
        <article className="metric-card">
          <div className="metric-top"><span>Active projects</span><span className="metric-icon violet"><Icon name="folder" /></span></div>
          <strong>{activeCount}</strong>
          <small><b>{completedCount}</b> completed · {data.archivedCount} archived</small>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span>{isEmployee ? 'Your week' : 'Team capacity'}</span><span className="metric-icon blue"><Icon name="users" /></span></div>
          <strong>{capacityPercent}%</strong>
          <small>{formatHours(capacity.allocated)} of {capacity.total} hrs allocated</small>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span>Upcoming milestones</span><span className="metric-icon amber"><Icon name="calendar" /></span></div>
          <strong>{upcoming.length}</strong>
          <small><b className="warn">{upcoming.filter((m) => daysUntil(m.dueDate) >= 0).length} due</b> in the next {UPCOMING_DAYS} days</small>
        </article>
        <article className="metric-card">
          <div className="metric-top"><span>Needs attention</span><span className="metric-icon coral"><Icon name="alert" /></span></div>
          <strong>{attentionCount}</strong>
          <small>{plural(attentionCount, 'project')} · {plural(overdueCount, 'overdue milestone')}</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="panel projects-panel">
          <div className="panel-header">
            <div><h2>Project portfolio</h2><p>{PORTFOLIO_SUBTITLE[user.role]}</p></div>
            <div className="filter-tabs">
              {FILTERS.map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
          </div>
          <div className="project-list">
            {visibleProjects.map((project) => <ProjectRow key={project.id} project={project} onOpen={() => onOpenProject(project.id)} />)}
            {visibleProjects.length === 0 && (
              <div className="empty">{projects.length === 0 ? 'No projects yet.' : 'No projects match your search.'}</div>
            )}
          </div>
          <button className="view-all" onClick={() => onNavigate('Projects')}>View all projects <Icon name="arrow" size={15} /></button>
        </div>

        <aside className="right-column">
          <div className="panel capacity-panel">
            <div className="panel-header">
              <div><h2>{isEmployee ? 'Your capacity' : 'Team capacity'}</h2><p>This week · {capacity.total} hours</p></div>
              {!isEmployee && <button className="text-button" onClick={() => onNavigate('People')}>Manage</button>}
            </div>
            <div className="capacity-chart">
              <div className="donut" style={{ background: `conic-gradient(#6757d9 0 ${capacityPercent}%, #88b7e8 ${capacityPercent}% 100%)` }}>
                <div><strong>{capacityPercent}%</strong><small>allocated</small></div>
              </div>
              <div className="legend">
                <span><i className="dot violet-dot" /><small>Project work</small><strong>{formatHours(capacity.allocated)}h</strong></span>
                <span><i className="dot blue-dot" /><small>Available</small><strong>{formatHours(capacity.total - capacity.allocated)}h</strong></span>
              </div>
            </div>
            {!isEmployee && <CapacityAlert capacity={capacity} />}
          </div>

          <div className="panel milestones-panel">
            <div className="panel-header"><div><h2>Upcoming milestones</h2><p>Next {UPCOMING_DAYS} days</p></div><button className="text-button" onClick={() => onNavigate('Milestones')}>View all</button></div>
            {upcoming.slice(0, 5).map((milestone) => <MilestoneRow key={milestone.id} milestone={milestone} />)}
            {upcoming.length === 0 && <div className="empty">Nothing due in the next {UPCOMING_DAYS} days.</div>}
          </div>
        </aside>
      </section>
    </>
  )
}

function ProjectRow({ project, onOpen }) {
  const members = project.team.filter((a) => a.active) // team also lists people who were removed
  const team = members.slice(0, MAX_TEAM_AVATARS)
  const extra = members.length - team.length

  return (
    <article className="project-row">
      <div className="project-title"><span className="project-icon"><Icon name="folder" /></span><span><strong>{project.title}</strong><small>#{project.id}</small></span></div>
      <div className="manager"><Avatar name={project.managerName} userId={project.managerId} /><span><small>Manager</small><strong>{project.managerName}</strong></span></div>
      <div className="progress-block"><span><small>Progress</small><strong>{project.progress}%</strong></span><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div></div>
      <div className="due"><small>Due date</small><strong>{formatDate(project.predictedEndDate)}</strong></div>
      <div className="team">
        {team.map((member) => <Avatar key={member.id} name={member.employeeName} userId={member.employeeId} small />)}
        {extra > 0 && <span className="avatar avatar-small extra">+{extra}</span>}
      </div>
      <span className={`status ${project.health.tone}`}><i />{project.health.label}</span>
      <button className="row-action" onClick={onOpen} aria-label={`Open ${project.title}`}><Icon name="arrow" size={17} /></button>
    </article>
  )
}

function MilestoneRow({ milestone }) {
  const badge = dateBadge(milestone.dueDate)
  const { health } = milestone

  return (
    <div className="milestone">
      <div className={`date-badge ${health.tone !== TONE.GREEN ? 'urgent' : ''}`}><strong>{badge.day}</strong><small>{badge.month}</small></div>
      <div className="milestone-copy">
        <strong>{milestone.title}</strong>
        <small>{milestone.projectTitle}</small>
        {health.blocked
          ? <span className="warning-text"><Icon name="alert" size={13} /> Dependency blocked</span>
          : <span className={health.tone === TONE.RED ? 'warning-text' : ''}><Icon name="clock" size={13} /> {relativeDue(milestone.dueDate)}</span>}
      </div>
      <span className={`status ${health.tone}`}><i />{health.label}</span>
    </div>
  )
}

function CapacityAlert({ capacity }) {
  if (capacity.people === 0) return null
  if (capacity.fullyBooked > 0) {
    return (
      <div className="capacity-alert">
        <Icon name="alert" size={17} />
        <span><strong>{plural(capacity.fullyBooked, 'employee')} fully booked</strong><small>No hours left for new assignments</small></span>
        <Icon name="arrow" size={15} />
      </div>
    )
  }
  if (capacity.unassigned > 0) {
    return (
      <div className="capacity-alert">
        <Icon name="alert" size={17} />
        <span><strong>{plural(capacity.unassigned, 'employee')} without a project</strong><small>Available for new assignments</small></span>
        <Icon name="arrow" size={15} />
      </div>
    )
  }
  return null
}

/** Unfinished milestones that are overdue or due within the next week, soonest first. */
function upcomingMilestones(projects) {
  return projects.flatMap((project) => {
    const byId = new Map(project.milestones.map((m) => [m.id, m]))
    return project.milestones
      .filter((m) => m.status !== 'COMPLETED' && daysUntil(m.dueDate) <= UPCOMING_DAYS)
      .map((m) => ({ ...m, projectTitle: project.title, health: milestoneHealth(m, byId) }))
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** 312 -> "312", 7.5 -> "7.5" */
function formatHours(hours) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}
