// Small display helpers. Dates from the API are 'YYYY-MM-DD' strings in local time;
// timestamps (createdAt, archivedAt...) are ISO strings and are shown by their date part.

export const ROLE_LABELS = { ADMIN: 'Administrator', MANAGER: 'Manager', EMPLOYEE: 'Employee' }
export const ROLE_SHORT = { ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' }

/** "Olivia Chen" -> "OC" */
export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('')
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Accepts a date ('2026-07-10') or a timestamp ('2026-07-10T12:00:00Z'); only the date part is used.
function toDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Budgets, rates and expenses are all in this currency.
export const CURRENCY = 'USD'

/** 12500 -> "$12,500", 87.5 -> "$87.50" */
export function formatMoney(amount) {
  const whole = Number.isInteger(Math.round(amount * 100) / 100)
  return amount.toLocaleString('en-US', {
    style: 'currency', currency: CURRENCY, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
  })
}

/** "2026-12-18" -> "Dec 18, 2026" */
export function formatDate(iso) {
  return toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Whole days from today until the date; negative if it's past. */
export function daysUntil(iso) {
  return Math.round((toDate(iso) - toDate(todayISO())) / 86_400_000)
}

/** "In 2 days", "Tomorrow", "Today", "3 days overdue" */
export function relativeDue(iso) {
  const days = daysUntil(iso)
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

/** { day: '20', month: 'NOV' } for the date badges. */
export function dateBadge(iso) {
  const date = toDate(iso)
  return { day: String(date.getDate()), month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() }
}

export function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Monday, November 18" */
export function longToday() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
