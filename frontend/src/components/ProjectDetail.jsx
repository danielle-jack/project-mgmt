import { useMemo, useState } from 'react'
import Icon from './Icon'
import { AssignmentForm, ExpenseForm, MilestoneForm, ProjectForm } from './forms'
import { Avatar, EmptyState, formatHours, Modal, plural, Progress, Status, useAction } from './ui'
import { milestoneHealth, projectHealth, projectProgress, TONE } from '../utils/projectHealth'
import { dateBadge, daysUntil, formatDate, formatMoney } from '../utils/format'
import {
  activeAssignments, allocatedHours, can, countWorkdays, dependencyOf, MILESTONE_STATUS, milestoneConflicts,
  milestoneProgress, projectPlannedHours, projectWeeklyHours, ROLES, unfinishedUpstream, WEEK_HOURS,
} from '../utils/rules'

export default function ProjectDetail({ user, data, project, actions, onBack, backLabel, onNotice, onOpenProject }) {
  const [dialog, setDialog] = useState(null) // { kind, item? }
  const [showPast, setShowPast] = useState(false)
  const close = () => setDialog(null)
  const archived = project.status === 'ARCHIVED' || Boolean(project.archivedAt)

  const health = archived ? null : projectHealth(project, project.milestones)
  const progress = projectProgress(project, project.milestones)
  const team = activeAssignments(project)
  const pastTeam = project.team.filter((a) => a.active === false)
  const workdays = countWorkdays(project.startDate, project.predictedEndDate)
  const left = daysUntil(project.predictedEndDate)

  const canEdit = !archived && can.editProject(user, project)
  const canComplete = !archived && can.completeProject(user, project)
  const canArchive = !archived && can.archiveProject(user, project)
  const canTeam = !archived && can.manageTeam(user, project)
  const canMilestones = !archived && can.manageMilestones(user, project)
  const canExpenses = !archived && can.manageExpenses(user, project)

  return (
    <>
      <button className="text-button back-link" onClick={onBack}>← {backLabel}</button>

      <section className="page-heading detail-heading">
        <div>
          <div className="detail-title">
            <span className="project-icon"><Icon name="folder" /></span>
            <h1>{project.title}</h1>
            {archived ? <Status tone="gray">Archived</Status>
              : project.status === 'COMPLETED' ? <Status tone="green">Completed</Status>
                : <Status tone={health.tone}>{health.label}</Status>}
          </div>
          <p>{project.description || 'No description yet.'}</p>
        </div>
        <div className="heading-actions">
          {canEdit && <button className="secondary-button" onClick={() => setDialog({ kind: 'edit' })}>Edit project</button>}
          {canComplete && <button className="primary-button" onClick={() => setDialog({ kind: 'complete' })}><Icon name="check" size={15} /> Mark completed</button>}
          {canArchive && <button className="primary-button" onClick={() => setDialog({ kind: 'archive' })}>Archive project</button>}
        </div>
      </section>

      {archived && (
        <div className="notice readonly-notice"><span><Icon name="alert" size={15} /> Archived {project.archivedAt ? formatDate(project.archivedAt) : ''}{project.archiveReason ? ` — “${project.archiveReason}”` : ''}. Archived projects are read-only.</span></div>
      )}
      {!archived && project.status === 'COMPLETED' && (
        <div className="notice readonly-notice">
          <span><Icon name="check" size={15} /> Marked completed. {user.role === ROLES.ADMIN ? 'Archive it when you’re ready to close it out.' : 'An admin will archive it.'}</span>
        </div>
      )}

      {health?.risks.length > 0 && <RiskPanel risks={health.risks} />}

      <section className="summary-strip">
        <div><small>Manager</small><span className="summary-person"><Avatar name={project.managerName} userId={project.managerId} small /><strong>{project.managerName}</strong></span></div>
        <div><small>Timeline</small><strong>{formatDate(project.startDate)} – {formatDate(project.predictedEndDate)}</strong>
          <span className="summary-note">{plural(workdays, 'workday')}{!archived && project.status === 'ACTIVE' && left >= 0 ? `, ${left} days left` : ''}{!archived && project.status === 'ACTIVE' && left < 0 ? `, ${-left} days past end date` : ''}</span></div>
        <div><small>Team</small><strong>{team.length} {team.length === 1 ? 'person' : 'people'}</strong><span className="summary-note">{formatHours(projectWeeklyHours(project))}h a week</span></div>
        <div><small>Planned hours</small><strong>{formatHours(projectPlannedHours(project))}h</strong><span className="summary-note">From team assignments</span></div>
        <div className="summary-progress"><small>Milestone progress</small><strong>{progress}%</strong><Progress value={progress} /></div>
      </section>

      {project.budget && (
        <BudgetPanel project={project}
          onAdd={canExpenses ? () => setDialog({ kind: 'expense' }) : undefined}
          onVoid={canExpenses ? (expense) => setDialog({ kind: 'void-expense', item: expense }) : undefined} />
      )}

      <DependenciesPanel project={project} onOpenProject={onOpenProject} />

      <section className="detail-grid">
        <div className="panel">
          <div className="panel-header">
            <div><h2>Milestones</h2><p>{plural(project.milestones.length, 'milestone')}</p></div>
            {canMilestones && <button className="text-button" onClick={() => setDialog({ kind: 'milestone' })}>Add milestone</button>}
          </div>
          {sortMilestones(project.milestones).map((m) => (
            <MilestoneItem key={m.id} milestone={m} project={project}
              onEdit={canMilestones ? () => setDialog({ kind: 'milestone', item: m }) : undefined} />
          ))}
          {project.milestones.length === 0 && (
            <EmptyState title="No milestones yet">
              {canMilestones ? 'Add the deliverables this project is working toward.' : 'The project manager hasn’t added any yet.'}
            </EmptyState>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div><h2>Team</h2><p>Planned hours per week</p></div>
            {canTeam && <button className="text-button" onClick={() => setDialog({ kind: 'assign' })}>Add member</button>}
          </div>
          {team.map((a) => (
            <TeamRow key={a.id} assignment={a} isYou={a.employeeId === user.id} data={data}
              onEdit={canTeam ? () => setDialog({ kind: 'assign', item: a }) : undefined}
              onRemove={canTeam ? () => setDialog({ kind: 'remove', item: a }) : undefined} />
          ))}
          {team.length === 0 && (
            <EmptyState title="No one assigned">
              {canTeam ? 'Add employees and the hours they’ll spend here each week.' : 'Nobody is assigned to this project.'}
            </EmptyState>
          )}
          {pastTeam.length > 0 && (
            <>
              <button className="view-all" onClick={() => setShowPast(!showPast)}>
                {showPast ? 'Hide' : 'Show'} {plural(pastTeam.length, 'past member')}
              </button>
              {showPast && pastTeam.map((a) => (
                <div className="team-row past" key={a.id}>
                  <Avatar name={a.employeeName} userId={a.employeeId} muted />
                  <span className="team-copy"><strong>{a.employeeName}</strong><small>{a.hoursPerWeek}h a week · {formatDate(a.startDate)} – {formatDate(a.endDate)} · removed{a.removalReason ? `: ${a.removalReason}` : ''}</small></span>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {dialog?.kind === 'edit' && <ProjectForm user={user} users={data.users} project={project} actions={actions} onClose={close} onSaved={onNotice} />}
      {dialog?.kind === 'assign' && <AssignmentForm user={user} data={data} project={project} assignment={dialog.item} actions={actions} onClose={close} onSaved={onNotice} />}
      {dialog?.kind === 'expense' && <ExpenseForm project={project} actions={actions} onClose={close} onSaved={onNotice} />}
      {dialog?.kind === 'void-expense' && (
        <ConfirmDialog title={`Void “${dialog.item.description}”?`} confirmLabel="Void expense" onClose={close}
          reasonLabel="Why is it being voided?"
          onConfirm={(reason) => actions.voidExpense(dialog.item.id, reason)} onDone={() => onNotice?.('Expense voided.')}>
          {formatMoney(dialog.item.amount)} stops counting toward the budget. The expense stays in the list, marked voided.
        </ConfirmDialog>
      )}
      {dialog?.kind === 'milestone' && <MilestoneForm project={project} milestone={dialog.item} actions={actions} onClose={close} onSaved={onNotice} />}
      {dialog?.kind === 'remove' && (
        <ConfirmDialog title={`Remove ${dialog.item.employeeName}?`} confirmLabel="Remove from team" onClose={close}
          reasonLabel="Why are they leaving the team?"
          onConfirm={(reason) => actions.deactivateAssignment(dialog.item.id, reason)} onDone={() => onNotice?.(`Removed ${dialog.item.employeeName} from the team.`)}>
          This frees up {dialog.item.hoursPerWeek}h of their week. The assignment stays in the project’s history.
        </ConfirmDialog>
      )}
      {dialog?.kind === 'complete' && (
        <ConfirmDialog title={`Mark ${project.title} completed?`} confirmLabel="Mark completed" primary onClose={close}
          blocked={unfinishedUpstream(project).length > 0}
          onConfirm={() => actions.completeProject(project.id)} onDone={() => onNotice?.(`${project.title} marked completed.`)}>
          {unfinishedUpstream(project).length > 0 && (
            <strong className="confirm-warning">
              This project depends on {unfinishedUpstream(project).map((p) => `“${p.title}”`).join(', ')}, which {unfinishedUpstream(project).length === 1 ? 'isn’t' : 'aren’t'} finished yet, so it can’t be completed. </strong>
          )}
          {incompleteCount(project) > 0 && <strong className="confirm-warning">{plural(incompleteCount(project), 'milestone')} {incompleteCount(project) === 1 ? 'isn’t' : 'aren’t'} completed yet. </strong>}
          The team and milestones can’t be changed after this, and an admin will archive the project.
        </ConfirmDialog>
      )}
      {dialog?.kind === 'archive' && (
        <ConfirmDialog title={`Archive ${project.title}?`} confirmLabel="Archive project" primary onClose={close}
          reasonLabel="Why is it being archived?"
          onConfirm={(reason) => actions.archiveProject(project.id, reason)} onDone={() => { onNotice?.(`${project.title} archived.`); onBack() }}>
          It moves to the Archive and becomes read-only. Its team’s hours stop counting toward their weekly limit.
        </ConfirmDialog>
      )}
    </>
  )
}

export function MilestoneItem({ milestone, project, onEdit, showProject }) {
  const byId = useMemo(() => new Map(project.milestones.map((m) => [m.id, m])), [project.milestones])
  const health = milestoneHealth(milestone, byId)
  const badge = dateBadge(milestone.dueDate)
  const progress = milestoneProgress(milestone)
  // A dependency can be in another project; the API describes those in milestone.dependencies.
  const deps = (milestone.dependsOn ?? []).map((id) => dependencyOf(milestone, id, byId)).filter(Boolean)
  const conflicts = milestone.status === 'COMPLETED' ? [] : milestoneConflicts(milestone, byId)

  return (
    <article className="milestone milestone-item">
      <div className={`date-badge ${health.tone !== TONE.GREEN ? 'urgent' : ''}`}><strong>{badge.day}</strong><small>{badge.month}</small></div>
      <div className="milestone-copy">
        <strong>{milestone.title}</strong>
        <small>{showProject ? `${project.title} · ` : ''}{formatDate(milestone.startDate)} – {formatDate(milestone.dueDate)} · {MILESTONE_STATUS[milestone.status]}</small>
        <div className="milestone-progress"><Progress value={progress} /><b>{progress}%</b></div>
        {deps.length > 0 && (
          <span className="dep-line">Depends on {deps.map((d) => (
            <em key={d.id} className={d.status === 'COMPLETED' ? 'done' : ''}>{d.status === 'COMPLETED' ? '✓ ' : ''}{d.projectId && d.projectId !== project.id ? `${d.projectTitle}: ` : ''}{d.title}</em>
          ))}</span>
        )}
        {conflicts.map((c) => <span key={c} className="warning-text"><Icon name="alert" size={13} /> {c}</span>)}
      </div>
      <div className="milestone-side">
        <Status tone={health.tone}>{health.label}</Status>
        {onEdit && <button className="text-button" onClick={onEdit} aria-label={`Edit ${milestone.title}`}>Edit</button>}
      </div>
    </article>
  )
}

function TeamRow({ assignment, isYou, data, onEdit, onRemove }) {
  const employee = data.users.find((u) => u.id === assignment.employeeId)
  const total = employee ? allocatedHours(employee, data.projects) : null
  const over = total != null && total > WEEK_HOURS
  return (
    <div className="team-row">
      <Avatar name={assignment.employeeName} userId={assignment.employeeId} />
      <span className="team-copy">
        <strong>{assignment.employeeName}{isYou && <em className="you-tag">You</em>}</strong>
        <small>{assignment.hoursPerWeek}h a week · {formatDate(assignment.startDate)} – {formatDate(assignment.endDate)}</small>
        {total != null && onEdit && (
          <small className={over ? 'danger-text' : total === WEEK_HOURS ? 'warning-text' : ''}>
            {total}h of {WEEK_HOURS}h booked across all projects{over ? ` · over-allocated by ${total - WEEK_HOURS}h` : ''}
          </small>
        )}
      </span>
      {(onEdit || onRemove) && (
        <span className="row-buttons">
          {onEdit && <button className="text-button" onClick={onEdit}>Edit</button>}
          {onRemove && <button className="text-button danger-text" onClick={onRemove}>Remove</button>}
        </span>
      )}
    </div>
  )
}

/**
 * Pass `reasonLabel` to require a short reason (3+ characters), e.g. for deactivating,
 * archiving or removing someone; onConfirm then receives the reason text.
 */
export function ConfirmDialog({ title, confirmLabel, children, onConfirm, onDone, onClose, primary, reasonLabel, blocked }) {
  const { pending, error, setError, run } = useAction()
  const [reason, setReason] = useState('')
  async function confirm() {
    if (reasonLabel && reason.trim().length < 3) return setError('Give a short reason (at least 3 characters).')
    const ok = await run(() => onConfirm(reason.trim()))
    if (ok) { onDone?.(); onClose() }
  }
  return (
    <Modal title={title} onClose={onClose}
      footer={(
        <>
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className={primary ? 'primary-button' : 'danger-button'} onClick={confirm} disabled={pending || blocked}>{pending ? 'Working…' : confirmLabel}</button>
        </>
      )}>
      <p className="confirm-copy">{children}</p>
      {reasonLabel && (
        <label className="login-field reason-field">
          {reasonLabel}
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
            placeholder="e.g. Left the company, project cancelled…" />
          <small className="field-hint">Saved with the record so everyone can see why.</small>
        </label>
      )}
      {error && <div className="login-error" role="alert">{error}</div>}
    </Modal>
  )
}

/** Why the project is "At risk" or "Needs attention". */
function RiskPanel({ risks }) {
  return (
    <section className="risk-panel" aria-label="Risks">
      {risks.map((r) => (
        <span key={r.key} className={`risk-item ${r.tone}`}><Icon name="alert" size={14} /> {r.text}</span>
      ))}
    </section>
  )
}

/** Planned versus consumed budget, and the expense log. Only admins and the project's manager get a budget. */
function BudgetPanel({ project, onAdd, onVoid }) {
  const [showVoided, setShowVoided] = useState(false)
  const { budget } = project
  const expenses = project.expenses ?? []
  const voided = expenses.filter((e) => !e.active)
  const shown = expenses.filter((e) => e.active || showVoided)
  const planned = budget.plannedBudget
  const pct = (amount) => (planned > 0 ? Math.min(100, (amount / planned) * 100) : 0)
  const over = planned > 0 && budget.spentToDate > planned
  const forecastOver = planned > 0 && budget.forecastTotal > planned

  return (
    <section className="panel budget-panel">
      <div className="panel-header">
        <div><h2>Budget</h2><p>Labour (hours worked × hourly rate) plus logged expenses</p></div>
        {onAdd && <button className="text-button" onClick={onAdd}>Log expense</button>}
      </div>

      <div className="budget-figures">
        <div><small>Planned</small><strong>{planned > 0 ? formatMoney(planned) : 'Not set'}</strong></div>
        <div><small>Spent to date</small><strong className={over ? 'danger-text' : ''}>{formatMoney(budget.spentToDate)}</strong>
          <span className="summary-note">{budget.percentUsed != null ? `${budget.percentUsed}% of budget` : 'No budget to compare'}</span></div>
        <div><small>Labour</small><strong>{formatMoney(budget.labourToDate)}</strong></div>
        <div><small>Expenses</small><strong>{formatMoney(budget.expensesToDate)}</strong></div>
        <div><small>Forecast at finish</small><strong className={forecastOver ? 'warning-text' : ''}>{formatMoney(budget.forecastTotal)}</strong>
          <span className="summary-note">{planned > 0 ? (budget.remaining >= 0 ? `${formatMoney(budget.remaining)} left` : `${formatMoney(-budget.remaining)} over`) : ''}</span></div>
      </div>

      {planned > 0 && (
        <div className={`budget-bar ${over ? 'over' : forecastOver ? 'forecast-over' : ''}`} aria-hidden="true">
          <i className="spent" style={{ width: `${pct(budget.spentToDate)}%` }} />
          <i className="forecast" style={{ width: `${Math.max(0, pct(budget.forecastTotal) - pct(budget.spentToDate))}%` }} />
        </div>
      )}

      <h3 className="budget-subhead">Expenses</h3>
      {shown.map((e) => (
        <div key={e.id} className={`expense-row ${e.active ? '' : 'voided'}`}>
          <span className="cell-stack"><strong>{e.description}</strong>
            <small>{formatDate(e.spentOn)}{e.active ? '' : ` · voided${e.voidReason ? `: ${e.voidReason}` : ''}`}</small></span>
          <strong className="expense-amount">{formatMoney(e.amount)}</strong>
          {onVoid && e.active ? <button className="text-button danger-text" onClick={() => onVoid(e)}>Void</button> : <span />}
        </div>
      ))}
      {expenses.filter((e) => e.active).length === 0 && (
        <p className="muted">{onAdd ? 'No expenses yet. Log licences, hardware, travel and other non-labour costs here.' : 'No expenses logged.'}</p>
      )}
      {voided.length > 0 && (
        <button className="view-all" onClick={() => setShowVoided(!showVoided)}>
          {showVoided ? 'Hide' : 'Show'} {plural(voided.length, 'voided expense')}
        </button>
      )}
    </section>
  )
}

export function sortMilestones(milestones) {
  const order = { IN_PROGRESS: 0, NOT_STARTED: 1, COMPLETED: 2 }
  return [...milestones].sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate))
}

const incompleteCount = (project) => project.milestones.filter((m) => m.status !== 'COMPLETED').length

/**
 * The project's place in the dependency chain: what it's waiting on (upstream) and what's
 * waiting on it (downstream), including projects further along the chain.
 */
function DependenciesPanel({ project, onOpenProject }) {
  const { upstream = [], downstream = [] } = project.chain ?? {}
  if (upstream.length === 0 && downstream.length === 0) return null
  return (
    <section className="panel dependencies-panel">
      <div className="panel-header">
        <div><h2>Dependencies</h2><p>Projects in the same chain as this one</p></div>
      </div>
      <div className="chain-columns">
        <ChainList title="Waiting on" empty="Doesn’t depend on other projects." links={upstream} onOpenProject={onOpenProject} />
        <ChainList title="Needed by" empty="No other project depends on this one." links={downstream} onOpenProject={onOpenProject} />
      </div>
    </section>
  )
}

function ChainList({ title, empty, links, onOpenProject }) {
  return (
    <div className="chain-list">
      <h3>{title}</h3>
      {links.length === 0 && <p className="muted">{empty}</p>}
      {links.map((link) => {
        const body = (
          <>
            <span className="cell-stack">
              <strong>{link.title}</strong>
              <small>{link.managerName}{link.direct ? '' : ' · further along the chain'}</small>
            </span>
            <span className="chain-progress"><Progress value={link.progressPercent} /><b>{link.progressPercent}%</b></span>
            <Status tone={link.status === 'ACTIVE' ? 'amber' : link.status === 'ARCHIVED' ? 'gray' : 'green'}>
              {link.status === 'ACTIVE' ? 'In progress' : link.status === 'ARCHIVED' ? 'Archived' : 'Completed'}
            </Status>
          </>
        )
        return link.canOpen && onOpenProject
          ? <button key={link.id} className="chain-row" onClick={() => onOpenProject(link.id)}>{body}</button>
          : <div key={link.id} className="chain-row" title="You can’t open this project">{body}</div>
      })}
    </div>
  )
}
