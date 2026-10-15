// Starting data for the fake server. Changes made in the app live in memory
// and reset when the page reloads.

/** Every sample account logs in with this password. */
export const DEMO_PASSWORD = 'password123'

/** 'YYYY-MM-DD' this many days from today, so some milestones are always "coming up". */
function daysFromToday(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function createSeedData() {
  const created = '2026-09-01T09:00:00Z'

  const users = [
    { id: 1, name: 'Avery Admin', email: 'avery@example.com', role: 'ADMIN', managerId: null },
    { id: 2, name: 'Morgan Lee', email: 'morgan@example.com', role: 'MANAGER', managerId: null },
    { id: 3, name: 'Sam Patel', email: 'sam@example.com', role: 'MANAGER', managerId: null },
    { id: 4, name: 'Jordan Kim', email: 'jordan@example.com', role: 'EMPLOYEE', managerId: 2 },
    { id: 5, name: 'Riley Chen', email: 'riley@example.com', role: 'EMPLOYEE', managerId: 2 },
    { id: 6, name: 'Casey Brooks', email: 'casey@example.com', role: 'EMPLOYEE', managerId: 3 },
    { id: 7, name: 'Taylor Nguyen', email: 'taylor@example.com', role: 'EMPLOYEE', managerId: 3 },
    { id: 8, name: 'Drew Garcia', email: 'drew@example.com', role: 'EMPLOYEE', managerId: 2, active: false,
      deactivationReason: 'Left the company' },
  ].map((u) => ({ active: true, deactivationReason: null, photo: null, createdAt: created, updatedAt: created, ...u }))

  const projects = [
    {
      id: 1, title: 'Customer Portal Redesign', description: 'New self-service portal.',
      managerId: 2, startDate: '2026-09-07', predictedEndDate: '2026-12-18', status: 'ACTIVE',
      dependsOn: [2], // the portal needs the new warehouse's data
    },
    {
      id: 2, title: 'Data Warehouse Migration', description: 'Move reporting to the new warehouse.',
      managerId: 3, startDate: '2026-10-05', predictedEndDate: '2027-02-26', status: 'ACTIVE',
    },
    {
      id: 3, title: 'Mobile App MVP', description: 'First release of the mobile app.',
      managerId: 2, startDate: '2026-06-01', predictedEndDate: '2026-09-25', status: 'COMPLETED',
      completedAt: '2026-09-25T17:00:00Z',
    },
    {
      id: 4, title: 'Legacy CRM Cleanup', description: 'Retire unused CRM modules.',
      managerId: 3, startDate: '2026-03-02', predictedEndDate: '2026-06-26', status: 'ARCHIVED',
      completedAt: '2026-06-26T17:00:00Z', archivedAt: '2026-07-10T12:00:00Z',
      archiveReason: 'Old CRM switched off',
    },
  ].map((p) => ({
    completedAt: null, archivedAt: null, archiveReason: null, dependsOn: [],
    createdBy: 1, createdAt: created, updatedAt: created, ...p,
  }))

  const assignments = [
    { id: 1, projectId: 1, employeeId: 4, hoursPerWeek: 24, startDate: '2026-09-07', endDate: '2026-12-18' },
    { id: 2, projectId: 1, employeeId: 5, hoursPerWeek: 16, startDate: '2026-09-07', endDate: '2026-12-18' },
    { id: 3, projectId: 2, employeeId: 4, hoursPerWeek: 16, startDate: '2026-10-05', endDate: '2027-02-26' },
    { id: 4, projectId: 2, employeeId: 6, hoursPerWeek: 32, startDate: '2026-10-05', endDate: '2027-02-26' },
    { id: 5, projectId: 2, employeeId: 7, hoursPerWeek: 20, startDate: '2026-11-02', endDate: '2027-02-26' },
    { id: 6, projectId: 3, employeeId: 5, hoursPerWeek: 20, startDate: '2026-06-01', endDate: '2026-09-25',
      active: false, deactivatedAt: '2026-09-25T17:00:00Z', removalReason: 'Project finished' },
    { id: 7, projectId: 4, employeeId: 6, hoursPerWeek: 8, startDate: '2026-03-02', endDate: '2026-06-26',
      active: false, deactivatedAt: '2026-06-26T17:00:00Z', removalReason: 'Project finished' },
  ].map((a) => ({
    active: true, deactivatedAt: null, removalReason: null, assignedBy: 2, createdAt: created, updatedAt: created, ...a,
  }))

  const milestones = [
    { id: 1, projectId: 1, title: 'Design sign-off', startDate: '2026-09-07', dueDate: '2026-09-30',
      status: 'COMPLETED', progressPercent: 100, completedAt: '2026-09-29T16:00:00Z' },
    { id: 2, projectId: 1, title: 'Account pages', startDate: '2026-10-01', dueDate: '2026-11-13',
      status: 'IN_PROGRESS', progressPercent: 45, dependsOn: [1] },
    // Should have started, but waits on "Account pages", so it shows as "Dependency blocked".
    { id: 3, projectId: 1, title: 'Billing pages', startDate: daysFromToday(-2), dueDate: daysFromToday(5),
      status: 'NOT_STARTED', progressPercent: 0, dependsOn: [1, 2] },
    { id: 4, projectId: 1, title: 'Launch', startDate: '2026-11-30', dueDate: '2026-12-18',
      status: 'NOT_STARTED', progressPercent: 0, dependsOn: [2, 3, 5] }, // 5 is in the warehouse project
    { id: 5, projectId: 2, title: 'Schema mapping', startDate: '2026-10-05', dueDate: daysFromToday(2),
      status: 'IN_PROGRESS', progressPercent: 70 },
    { id: 6, projectId: 2, title: 'Data backfill', startDate: '2026-11-09', dueDate: '2027-01-15',
      status: 'NOT_STARTED', progressPercent: 0, dependsOn: [5] },
    { id: 7, projectId: 3, title: 'App store release', startDate: '2026-08-31', dueDate: '2026-09-25',
      status: 'COMPLETED', progressPercent: 100, completedAt: '2026-09-25T15:00:00Z' },
  ].map((m) => ({
    description: '', dependsOn: [], completedAt: null, createdBy: 2,
    createdAt: created, updatedAt: created, ...m,
  }))

  return { users, projects, assignments, milestones }
}
