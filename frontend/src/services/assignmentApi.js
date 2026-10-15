import { get, post, patch } from './api'

/**
 * The project's team. Pass { includeInactive: true } to also get people who
 * were removed from the team.
 */
export const getAssignments = (projectId, { includeInactive = false } = {}) =>
  get(`/projects/${projectId}/assignments${includeInactive ? '?includeInactive=true' : ''}`)

/**
 * Put an employee on the project's team.
 * assignment = { employeeId, hoursPerWeek, startDate?, endDate?, allowOverAllocation? }
 * Dates default to the project's dates. allowOverAllocation: true confirms going past 40h a week.
 */
export const createAssignment = (projectId, assignment) =>
  post(`/projects/${projectId}/assignments`, assignment)

/** Change hoursPerWeek, startDate or endDate (and allowOverAllocation, as above). */
export const updateAssignment = (id, changes) => patch(`/assignments/${id}`, changes)

/** Remove from the team. The assignment is deactivated, not deleted; a reason is required. */
export const removeFromTeam = (id, reason) => post(`/assignments/${id}/deactivate`, { reason })
