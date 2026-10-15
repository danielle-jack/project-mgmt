// How a project or milestone is doing, worked out from milestone, team and budget data.
// The thresholds are a starting point. Change them freely.
//
// Milestone:
//   red    "Overdue"            past its due date and not completed
//   amber  "Dependency blocked" should have started, but something it depends on isn't completed
//   amber  "Date conflict"      something it depends on is due after it (from the API's dateConflicts)
//   green  "On track"           everything else
// Project: a list of risks (projectRisks), then
//   red    "Needs attention"    any red risk: an overdue milestone, or more spent than budgeted
//   amber  "At risk"            any amber risk: a blocked or conflicting milestone, the end date has passed,
//                               progress is well behind the time used, spending is forecast to go over
//                               budget, or nobody is assigned
//   green  "On track"           no risks

import { formatMoney, todayISO } from './format'
import { activeAssignments, countWorkdays, dependencyOf } from './rules'

export const TONE = { GREEN: 'green', AMBER: 'amber', RED: 'red' }

// "Behind schedule" once milestone progress trails the share of workdays used by this many points.
export const SCHEDULE_SLACK_POINTS = 25

export function milestoneHealth(milestone, milestonesById) {
  const today = todayISO()
  if (milestone.status === 'COMPLETED') return { tone: TONE.GREEN, label: 'Completed', blocked: false }
  if (milestone.dueDate < today) return { tone: TONE.RED, label: 'Overdue', blocked: false }

  const blocked = milestone.dependsOn.some((id) => dependencyOf(milestone, id, milestonesById)?.status !== 'COMPLETED')
  if (blocked && milestone.startDate <= today) return { tone: TONE.AMBER, label: 'At risk', blocked: true }
  if (milestone.dateConflicts?.length) return { tone: TONE.AMBER, label: 'Date conflict', blocked }
  return { tone: TONE.GREEN, label: 'On track', blocked }
}

/** { tone, label, risks } where risks is the list from projectRisks. */
export function projectHealth(project, milestones) {
  if (project.status === 'COMPLETED') return { tone: TONE.GREEN, label: 'Completed', risks: [] }

  const risks = projectRisks(project, milestones)
  if (risks.some((r) => r.tone === TONE.RED)) return { tone: TONE.RED, label: 'Needs attention', risks }
  if (risks.length) return { tone: TONE.AMBER, label: 'At risk', risks }
  return { tone: TONE.GREEN, label: 'On track', risks }
}

/** Everything that puts an active project's deadline or budget at risk: [{ key, tone, text }], worst first. */
export function projectRisks(project, milestones) {
  if (project.status !== 'ACTIVE') return []
  const today = todayISO()
  const byId = new Map(milestones.map((m) => [m.id, m]))
  const health = milestones.map((m) => milestoneHealth(m, byId))
  const risks = []
  const add = (key, tone, text) => risks.push({ key, tone, text })

  const overdue = health.filter((h) => h.tone === TONE.RED).length
  if (overdue) add('overdue', TONE.RED, `${count(overdue, 'milestone')} overdue`)

  const budget = project.budget
  if (budget && budget.plannedBudget > 0) {
    if (budget.spentToDate > budget.plannedBudget) {
      add('over-budget', TONE.RED, `Over budget by ${formatMoney(budget.spentToDate - budget.plannedBudget)}`)
    } else if (budget.forecastTotal > budget.plannedBudget) {
      add('forecast-over', TONE.AMBER, `Forecast to go over budget by ${formatMoney(budget.forecastTotal - budget.plannedBudget)}`)
    }
  }

  if (project.predictedEndDate < today) add('late', TONE.AMBER, 'Past its predicted end date')

  const schedule = scheduleStatus(project, milestones)
  if (schedule.behind) {
    add('behind', TONE.AMBER, `Behind schedule: ${schedule.elapsed}% of the time used, ${schedule.progress}% done`)
  }

  const blocked = health.filter((h) => h.blocked && h.tone === TONE.AMBER).length
  if (blocked) add('blocked', TONE.AMBER, `${count(blocked, 'milestone')} waiting on unfinished dependencies`)
  const conflicts = health.filter((h) => h.label === 'Date conflict').length
  if (conflicts) add('conflict', TONE.AMBER, `${count(conflicts, 'milestone')} due before something it depends on`)

  if (activeAssignments(project).length === 0) add('understaffed', TONE.AMBER, 'Nobody is assigned to this project')

  return risks
}

/**
 * Share of the project's workdays used so far versus milestone progress.
 * behind is true once progress trails time by SCHEDULE_SLACK_POINTS or more.
 */
export function scheduleStatus(project, milestones) {
  const progress = projectProgress(project, milestones)
  const today = todayISO()
  const total = countWorkdays(project.startDate, project.predictedEndDate)
  const used = today < project.startDate ? 0
    : countWorkdays(project.startDate, today < project.predictedEndDate ? today : project.predictedEndDate)
  const elapsed = total ? Math.round((used / total) * 100) : 0
  return { elapsed, progress, behind: project.status === 'ACTIVE' && elapsed - progress >= SCHEDULE_SLACK_POINTS }
}

/** Average milestone progress, 0-100. A project with no milestones shows 0%. */
export function projectProgress(project, milestones) {
  if (project.status === 'COMPLETED') return 100
  if (milestones.length === 0) return 0
  return Math.round(milestones.reduce((sum, m) => sum + m.progressPercent, 0) / milestones.length)
}

function count(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
