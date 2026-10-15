// Planned-hours math. The work week is 40 hours: 8 hours a day over 5 days.

export const HOURS_PER_DAY = 8
export const DAYS_PER_WEEK = 5
export const HOURS_PER_WEEK = HOURS_PER_DAY * DAYS_PER_WEEK

/** Monday-Friday days between two 'YYYY-MM-DD' dates, inclusive. */
export function countWorkdays(startDate, endDate) {
  const day = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  let count = 0
  while (day <= end) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6) count++
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return count
}

/** Total planned hours for one assignment: hours per week spread over its workdays. */
export function assignmentTotalHours({ hoursPerWeek, startDate, endDate }) {
  return (hoursPerWeek * countWorkdays(startDate, endDate)) / DAYS_PER_WEEK
}

/**
 * Labour cost of one assignment (same rule as BudgetCalculator.java): hourly rate x hours per week,
 * over the workdays from its start to whichever comes first of its end date, the day the person was
 * removed from the team, and `cutoff` ('YYYY-MM-DD', or null for no cutoff).
 */
export function labourCost(assignment, rate, cutoff) {
  let end = assignment.endDate
  if (!assignment.active && assignment.deactivatedAt) end = earlier(end, assignment.deactivatedAt.slice(0, 10))
  if (cutoff) end = earlier(end, cutoff)
  if (end < assignment.startDate) return 0
  return (rate * assignment.hoursPerWeek * countWorkdays(assignment.startDate, end)) / DAYS_PER_WEEK
}

const earlier = (a, b) => (a < b ? a : b)
