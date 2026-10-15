// The `actions` object the pages call (PeoplePage, ProjectDetail, forms, ...).
// Each action calls the backend, then reloads the workspace data so every page
// shows the change. If the backend refuses, the error's message reaches the
// form or dialog through useAction() in components/ui.jsx.

import * as users from './userApi'
import * as projects from './projectApi'
import * as assignments from './assignmentApi'
import * as milestones from './milestoneApi'
import * as expenses from './expenseApi'

/**
 * @param user           the logged-in user
 * @param reload         re-fetches workspace data; resolves when done
 * @param onUserUpdated  called with the new user record when someone edits their own profile
 */
export function createActions({ user, reload, onUserUpdated }) {
  const then = (call) => async (...args) => {
    const result = await call(...args)
    await reload()
    return result
  }

  return {
    // People
    createUser: then((person) => users.createUser(person)),
    updateUser: then((id, { name, email }) => users.updateProfile(id, { name, email })),
    reassignManager: then((id, managerId) => users.changeManager(id, managerId)),
    setHourlyRate: then((id, hourlyRate) => users.setHourlyRate(id, hourlyRate)),
    setUserActive: then((id, active, reason) => (active ? users.reactivateUser(id) : users.deactivateUser(id, reason))),
    setPhoto: then(async (id, photo) => {
      const updated = await users.setPhoto(id, photo)
      if (id === user.id) onUserUpdated?.(updated)
      return updated
    }),
    changePassword: (currentPassword, newPassword) => users.changePassword(user.id, { currentPassword, newPassword }),
    updateProfile: then(async ({ name, email }) => {
      const me = await users.updateProfile(user.id, { name, email })
      onUserUpdated?.(me)
      return me
    }),

    // Projects
    createProject: then((fields) => projects.createProject(fields)),
    updateProject: then((id, fields) => projects.updateProject(id, fields)),
    completeProject: then((id) => projects.completeProject(id)),
    archiveProject: then((id, reason) => projects.archiveProject(id, reason)),

    // Team
    createAssignment: then((projectId, { employeeId, hoursPerWeek, startDate, endDate, allowOverAllocation }) =>
      assignments.createAssignment(projectId, { employeeId, hoursPerWeek, startDate, endDate, allowOverAllocation })),
    updateAssignment: then((id, { hoursPerWeek, startDate, endDate, allowOverAllocation }) =>
      assignments.updateAssignment(id, { hoursPerWeek, startDate, endDate, allowOverAllocation })),
    deactivateAssignment: then((id, reason) => assignments.removeFromTeam(id, reason)),

    // Budget
    createExpense: then((projectId, { amount, spentOn, description }) =>
      expenses.createExpense(projectId, { amount, spentOn, description })),
    voidExpense: then((id, reason) => expenses.voidExpense(id, reason)),

    // Milestones. The form says `progress`, the API says `progressPercent`.
    createMilestone: then(async (projectId, form) => {
      const created = await milestones.createMilestone(projectId, {
        title: form.title, description: form.description,
        startDate: form.startDate, dueDate: form.dueDate, dependsOn: form.dependsOn,
      })
      // New milestones always start "Not started" at 0%; apply the form's status/progress after.
      const progress = Number(form.progress) || 0
      if ((form.status && form.status !== 'NOT_STARTED') || progress > 0) {
        return milestones.updateMilestone(created.id, { status: form.status, progressPercent: progress })
      }
      return created
    }),
    updateMilestone: then((id, form) => milestones.updateMilestone(id, {
      title: form.title, description: form.description,
      startDate: form.startDate, dueDate: form.dueDate, dependsOn: form.dependsOn,
      status: form.status, progressPercent: form.progress == null ? undefined : Number(form.progress),
    })),
  }
}
