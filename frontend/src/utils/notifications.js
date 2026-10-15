// Notifications for the bell in the top bar. They're worked out from the data the
// app already loads (so each person only hears about what their role lets them see),
// not stored anywhere.
//
// Each notification: { id, tone, title, detail, target }
//   id      stable, so "already seen" survives reloads (e.g. 'overdue:12')
//   tone    'red' | 'amber' | 'blue', most urgent first
//   target  where clicking it goes: { page, projectId? }

import { daysUntil, formatDate, formatMoney, todayISO } from './format'
import { dependencyOf, unfinishedUpstream, WEEK_HOURS } from './rules'

const DUE_SOON_DAYS = 3
const TONE_ORDER = { red: 0, amber: 1, blue: 2 }

export function buildNotifications(user, data) {
  const list = []
  const today = todayISO()

  for (const project of data.projects.filter((p) => p.status === 'ACTIVE')) {
    const target = { page: 'Projects', projectId: project.id }
    const byId = new Map(project.milestones.map((m) => [m.id, m]))

    for (const upstream of unfinishedUpstream(project)) {
      list.push({
        id: `waiting-project:${project.id}:${upstream.id}`, tone: 'blue', target,
        title: `${project.title} is waiting on ${upstream.title}`,
        detail: `${upstream.title} is ${upstream.progressPercent}% done. ${project.title} can’t be completed until it’s finished.`,
      })
    }

    const { budget } = project // only admins and the project's manager get one
    if (budget?.plannedBudget > 0 && budget.spentToDate > budget.plannedBudget) {
      list.push({
        id: `over-budget:${project.id}`, tone: 'red', target,
        title: `${project.title} is over budget`,
        detail: `${formatMoney(budget.spentToDate)} spent of ${formatMoney(budget.plannedBudget)} planned`,
      })
    } else if (budget?.plannedBudget > 0 && budget.forecastTotal > budget.plannedBudget) {
      list.push({
        id: `forecast-over:${project.id}`, tone: 'amber', target,
        title: `${project.title} is forecast to go over budget`,
        detail: `Forecast ${formatMoney(budget.forecastTotal)} against ${formatMoney(budget.plannedBudget)} planned`,
      })
    }

    if (daysUntil(project.predictedEndDate) < 0) {
      list.push({
        id: `late:${project.id}`, tone: 'red', target,
        title: `${project.title} is past its predicted end date`,
        detail: `It was due ${formatDate(project.predictedEndDate)}. Move the date or mark it completed.`,
      })
    }

    for (const m of project.milestones) {
      if (m.status === 'COMPLETED') continue
      const days = daysUntil(m.dueDate)

      if (days < 0) {
        list.push({
          id: `overdue:${m.id}`, tone: 'red', target,
          title: `“${m.title}” is ${plural(-days, 'day')} overdue`,
          detail: `${project.title} · was due ${formatDate(m.dueDate)}`,
        })
      } else if (days <= DUE_SOON_DAYS) {
        list.push({
          id: `soon:${m.id}`, tone: 'blue', target,
          title: `“${m.title}” is due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`,
          detail: `${project.title} · ${m.progressPercent}% done`,
        })
      }

      const waiting = m.dependsOn.map((id) => dependencyOf(m, id, byId)).filter((d) => d && d.status !== 'COMPLETED')
      if (waiting.length && m.startDate <= today) {
        list.push({
          id: `blocked:${m.id}`, tone: 'amber', target,
          title: `“${m.title}” is waiting on ${waiting.map((d) => `“${d.title}”${d.projectId && d.projectId !== project.id ? ` (${d.projectTitle})` : ''}`).join(', ')}`,
          detail: `${project.title} · it can’t be completed until ${waiting.length === 1 ? 'that is' : 'those are'} done`,
        })
      }

      for (const depId of m.dateConflicts ?? []) {
        const dep = dependencyOf(m, depId, byId)
        if (!dep) continue
        list.push({
          id: `conflict:${m.id}:${depId}`, tone: 'amber', target,
          title: `“${m.title}” is due before “${dep.title}”`,
          detail: `${project.title} · it depends on “${dep.title}”, due ${formatDate(dep.dueDate)}`,
        })
      }
    }
  }

  if (user.role === 'ADMIN') {
    for (const project of data.projects.filter((p) => p.status === 'COMPLETED')) {
      list.push({
        id: `archive:${project.id}`, tone: 'blue', target: { page: 'Archive' },
        title: `${project.title} is ready to archive`,
        detail: `Marked completed by ${project.managerName}`,
      })
    }
  }

  // Admins hear about everyone who's over-allocated; managers about their own reports.
  if (user.role !== 'EMPLOYEE') {
    for (const person of data.users) {
      if (!person.active || (user.role === 'MANAGER' && person.managerId !== user.id)) continue
      if ((person.allocatedHours ?? 0) > WEEK_HOURS) {
        list.push({
          id: `over-allocated:${person.id}:${person.allocatedHours}`, tone: 'amber', target: { page: 'People' },
          title: `${person.name} is over-allocated`,
          detail: `${person.allocatedHours}h a week across projects, ${person.allocatedHours - WEEK_HOURS}h over the ${WEEK_HOURS}h week`,
        })
      }
    }
  }

  if (user.role === 'MANAGER') {
    for (const person of data.users) {
      if (person.active && person.managerId === user.id && (person.allocatedHours ?? 0) === WEEK_HOURS) {
        list.push({
          id: `booked:${person.id}`, tone: 'blue', target: { page: 'People' },
          title: `${person.name} is fully booked`,
          detail: `${person.allocatedHours}h of ${WEEK_HOURS}h a week, so they can’t take on more project work`,
        })
      }
    }
  }

  return list.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
