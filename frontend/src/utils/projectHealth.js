// How a project or milestone is doing, worked out from milestone data.
// The business rules don't define "at risk", so these are a starting point. Change them freely.
//
// Milestone:
//   red    "Overdue"            past its due date and not completed
//   amber  "Dependency blocked" should have started, but something it depends on isn't completed
//   amber  "Date conflict"      something it depends on is due after it (from the API's dateConflicts)
//   green  "On track"           everything else
// Project:
//   red    "Needs attention"    any milestone is overdue
//   amber  "At risk"            any milestone is blocked or has a date conflict, or the end date has passed
//   green  "On track"           everything else

import { todayISO } from './format'
import { dependencyOf } from './rules'

export const TONE = { GREEN: 'green', AMBER: 'amber', RED: 'red' }

export function milestoneHealth(milestone, milestonesById) {
  const today = todayISO()
  if (milestone.status === 'COMPLETED') return { tone: TONE.GREEN, label: 'Completed', blocked: false }
  if (milestone.dueDate < today) return { tone: TONE.RED, label: 'Overdue', blocked: false }

  const blocked = milestone.dependsOn.some((id) => dependencyOf(milestone, id, milestonesById)?.status !== 'COMPLETED')
  if (blocked && milestone.startDate <= today) return { tone: TONE.AMBER, label: 'At risk', blocked: true }
  if (milestone.dateConflicts?.length) return { tone: TONE.AMBER, label: 'Date conflict', blocked }
  return { tone: TONE.GREEN, label: 'On track', blocked }
}

export function projectHealth(project, milestones) {
  if (project.status === 'COMPLETED') return { tone: TONE.GREEN, label: 'Completed' }

  const byId = new Map(milestones.map((m) => [m.id, m]))
  const tones = milestones.map((m) => milestoneHealth(m, byId).tone)
  if (tones.includes(TONE.RED)) return { tone: TONE.RED, label: 'Needs attention' }
  if (tones.includes(TONE.AMBER) || project.predictedEndDate < todayISO()) {
    return { tone: TONE.AMBER, label: 'At risk' }
  }
  return { tone: TONE.GREEN, label: 'On track' }
}

/** Average milestone progress, 0-100. A project with no milestones shows 0%. */
export function projectProgress(project, milestones) {
  if (project.status === 'COMPLETED') return 100
  if (milestones.length === 0) return 0
  return Math.round(milestones.reduce((sum, m) => sum + m.progressPercent, 0) / milestones.length)
}
