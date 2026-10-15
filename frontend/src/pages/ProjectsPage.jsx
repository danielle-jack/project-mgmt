import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import ProjectDetail from '../components/ProjectDetail'
import { ProjectForm } from '../components/forms'
import { Avatar, EmptyState, formatHours, PageHeading, plural, Progress, Status, Tabs } from '../components/ui'
import { projectHealth, projectProgress } from '../utils/projectHealth'
import { formatDate } from '../utils/format'
import { activeAssignments, can, projectWeeklyHours, ROLES } from '../utils/rules'

const SUBTITLE = {
  ADMIN: 'Every project in your organization. Only admins can create projects.',
  MANAGER: 'Projects you manage. Assign your team and track milestones here.',
  EMPLOYEE: 'Projects you’re assigned to.',
}
const MAX_AVATARS = 4

/**
 * Props: user, data ({ users, projects }), query (top-bar search), actions.
 * Pass `projectId` / `onOpenProject` if you want the open project in the URL;
 * otherwise the page keeps it in local state.
 */
export default function ProjectsPage({ user, data, query = '', actions, projectId, onOpenProject }) {
  const [localId, setLocalId] = useState(null)
  const openId = projectId !== undefined ? projectId : localId
  const open = onOpenProject ?? setLocalId

  const [tab, setTab] = useState('ACTIVE')
  const [managerId, setManagerId] = useState('')
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')

  const projects = useMemo(() => data.projects.map((p) => ({
    ...p,
    health: projectHealth(p, p.milestones),
    progress: projectProgress(p, p.milestones),
  })), [data.projects])

  const selected = projects.find((p) => p.id === openId)
  if (selected) {
    return (
      <>
        {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}
        <ProjectDetail user={user} data={data} project={selected} actions={actions}
          backLabel="All projects" onBack={() => open(null)} onNotice={setNotice} onOpenProject={open} />
      </>
    )
  }

  const counts = {
    ACTIVE: projects.filter((p) => p.status === 'ACTIVE').length,
    COMPLETED: projects.filter((p) => p.status === 'COMPLETED').length,
  }
  const managers = [...new Map(projects.map((p) => [p.managerId, p.managerName])).entries()]
  const visible = projects
    .filter((p) => tab === 'ALL' || p.status === tab)
    .filter((p) => !managerId || String(p.managerId) === managerId) // <select> values are strings
    .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.predictedEndDate.localeCompare(b.predictedEndDate))

  return (
    <>
      <PageHeading title="Projects" subtitle={SUBTITLE[user.role]}>
        {can.createProjects(user) && (
          <button className="primary-button" onClick={() => setCreating(true)}><Icon name="folder" size={15} /> New project</button>
        )}
      </PageHeading>

      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}

      <div className="panel">
        <div className="panel-header toolbar">
          <Tabs value={tab} onChange={setTab} items={[
            { value: 'ACTIVE', label: 'Active', count: counts.ACTIVE },
            { value: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
            { value: 'ALL', label: 'All', count: projects.length },
          ]} />
          {user.role === ROLES.ADMIN && managers.length > 1 && (
            <select className="compact-select" value={managerId} onChange={(e) => setManagerId(e.target.value)} aria-label="Filter by manager">
              <option value="">All managers</option>
              {managers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>

        <div className="list-head project-grid" aria-hidden="true">
          <span>Project</span><span>Manager</span><span>Timeline</span><span>Team</span><span>Progress</span><span>Status</span>
        </div>
        {visible.map((p) => <ProjectListRow key={p.id} project={p} onOpen={() => open(p.id)} />)}

        {visible.length === 0 && (
          query || managerId
            ? <EmptyState title="No projects match">Try a different search or clear the manager filter.</EmptyState>
            : <EmptyState title={tab === 'COMPLETED' ? 'No completed projects' : 'No projects yet'}
                action={can.createProjects(user) && tab !== 'COMPLETED'
                  ? <button className="primary-button" onClick={() => setCreating(true)}>Create the first project</button> : null}>
                {emptyCopy(user, tab)}
              </EmptyState>
        )}
      </div>

      {creating && <ProjectForm user={user} users={data.users} actions={actions} onClose={() => setCreating(false)} onSaved={setNotice} />}
    </>
  )
}

function ProjectListRow({ project, onOpen }) {
  const team = activeAssignments(project)
  const shown = team.slice(0, MAX_AVATARS)
  return (
    <button className="list-row project-grid" onClick={onOpen}>
      <span className="project-title">
        <span className="project-icon"><Icon name="folder" /></span>
        <span><strong>{project.title}</strong><small>#{project.id}</small></span>
      </span>
      <span className="manager"><Avatar name={project.managerName} userId={project.managerId} /><span><strong>{project.managerName}</strong></span></span>
      <span className="cell-stack"><strong>{formatDate(project.predictedEndDate)}</strong><small>from {formatDate(project.startDate)}</small></span>
      <span className="cell-team">
        <span className="team">{shown.map((a) => <Avatar key={a.id} name={a.employeeName} userId={a.employeeId} small />)}
          {team.length > shown.length && <span className="avatar avatar-small extra">+{team.length - shown.length}</span>}</span>
        <small>{team.length ? `${formatHours(projectWeeklyHours(project))}h / wk` : 'No team'}</small>
      </span>
      <span className="progress-block"><span><small>{plural(project.milestones.length, 'milestone')}</small><strong>{project.progress}%</strong></span><Progress value={project.progress} /></span>
      <span>{project.status === 'COMPLETED' ? <Status tone="green">Completed</Status> : <Status tone={project.health.tone}>{project.health.label}</Status>}</span>
    </button>
  )
}

function emptyCopy(user, tab) {
  if (tab === 'COMPLETED') return 'Projects show here once their manager marks them completed.'
  if (user.role === ROLES.ADMIN) return 'Create a project, give it a manager, and they can build the team.'
  if (user.role === ROLES.MANAGER) return 'An admin hasn’t made you the manager of any projects yet.'
  return 'Your manager hasn’t assigned you to a project yet.'
}

export function Notice({ text, onDismiss }) {
  return (
    <div className="notice" role="status">
      <span><Icon name="check" /> {text}</span>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  )
}
