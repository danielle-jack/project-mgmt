import { useState } from 'react'
import Icon from '../components/Icon'
import ProjectDetail, { ConfirmDialog } from '../components/ProjectDetail'
import { Avatar, EmptyState, formatHours, PageHeading, plural } from '../components/ui'
import { Notice } from './ProjectsPage'
import { formatDate } from '../utils/format'
import { can, projectPlannedHours, ROLES } from '../utils/rules'

/** Props: user, data ({ projects, archivedProjects }), query (top-bar search), actions. */
export default function ArchivePage({ user, data, query = '', actions }) {
  const [openId, setOpenId] = useState(null)
  const [archiving, setArchiving] = useState(null)
  const [notice, setNotice] = useState('')

  const archived = (data.archivedProjects ?? []).map((p) => ({ ...p, status: 'ARCHIVED' }))
  const selected = archived.find((p) => p.id === openId)
  if (selected) {
    return <ProjectDetail user={user} data={data} project={selected} actions={actions} backLabel="Archive" onBack={() => setOpenId(null)} />
  }

  const ready = data.projects.filter((p) => p.status === 'COMPLETED' && can.archiveProject(user, p))
  const visible = archived
    .filter((p) => `${p.title} ${p.managerName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))

  return (
    <>
      <PageHeading title="Archive" subtitle="Finished projects, kept for reference. Archived projects are read-only." />

      {notice && <Notice text={notice} onDismiss={() => setNotice('')} />}

      {user.role === ROLES.ADMIN && ready.length > 0 && (
        <div className="panel ready-panel">
          <div className="panel-header">
            <div><h2>Ready to archive</h2><p>{plural(ready.length, 'project')} marked completed by {ready.length === 1 ? 'its manager' : 'their managers'}</p></div>
          </div>
          {ready.map((p) => (
            <div className="list-row archive-grid" key={p.id}>
              <span className="project-title"><span className="project-icon"><Icon name="check" /></span><span><strong>{p.title}</strong><small>{p.managerName}</small></span></span>
              <span className="cell-stack"><strong>{formatDate(p.predictedEndDate)}</strong><small>Predicted end</small></span>
              <span className="cell-stack"><strong>{p.milestones.filter((m) => m.status === 'COMPLETED').length} of {p.milestones.length}</strong><small>Milestones done</small></span>
              <span className="row-buttons"><button className="secondary-button" onClick={() => setArchiving(p)}>Archive</button></span>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-header"><div><h2>Archived projects</h2><p>{plural(archived.length, 'project')}</p></div></div>
        <div className="list-head archive-grid" aria-hidden="true"><span>Project</span><span>Ran</span><span>Planned hours</span><span>Archived</span></div>
        {visible.map((p) => (
          <button className="list-row archive-grid" key={p.id} onClick={() => setOpenId(p.id)}>
            <span className="manager"><Avatar name={p.managerName} userId={p.managerId} muted /><span><strong>{p.title}</strong><small>{p.managerName}</small></span></span>
            <span className="cell-stack"><strong>{formatDate(p.startDate)} – {formatDate(p.predictedEndDate)}</strong><small>{plural(p.milestones.length, 'milestone')}</small></span>
            <span className="cell-stack"><strong>{formatHours(projectPlannedHours(p))}h</strong><small>{plural(p.team.length, 'assignment')}</small></span>
            <span className="cell-stack"><strong>{p.archivedAt ? formatDate(p.archivedAt) : '—'}</strong>{p.archiveReason && <small>{p.archiveReason}</small>}</span>
          </button>
        ))}
        {visible.length === 0 && (
          <EmptyState title={query ? 'No archived projects match' : 'Nothing archived yet'}>
            {query ? 'Try a different project or manager name.' : 'When a manager marks a project completed, an admin archives it and it moves here.'}
          </EmptyState>
        )}
      </div>

      {archiving && (
        <ConfirmDialog title={`Archive ${archiving.title}?`} confirmLabel="Archive project" primary onClose={() => setArchiving(null)}
          reasonLabel="Why is it being archived?"
          onConfirm={(reason) => actions.archiveProject(archiving.id, reason)} onDone={() => setNotice(`${archiving.title} archived.`)}>
          It becomes read-only and its team’s hours stop counting toward their weekly limit.
        </ConfirmDialog>
      )}
    </>
  )
}
