import { get, post, patch, put } from './api'

/** The logged-in user. */
export const getMe = () => get('/users/me')

/** Admins and managers see everyone; employees see only themselves. */
export const getUsers = () => get('/users')

export const getUser = (id) => get(`/users/${id}`)

/**
 * Admin only. user = { name, email, role, managerId, password }.
 * managerId is required for employees; password is a temporary one (8+ characters)
 * for the admin to share with the new user.
 */
export const createUser = (user) => post('/users', user)

/** Change name and/or email. Employees may only do this for themselves. */
export const updateProfile = (id, { name, email }) =>
  patch(`/users/${id}/profile`, { name, email })

/**
 * Change your own password (needs currentPassword), or, as an admin, reset
 * someone else's to a new temporary one (currentPassword not needed).
 */
export const changePassword = (id, { currentPassword, newPassword }) =>
  patch(`/users/${id}/password`, { currentPassword, newPassword })

/** Admin only: move an employee to a different manager. */
export const changeManager = (id, managerId) =>
  patch(`/users/${id}/manager`, { managerId })

/** Admin only. Users are never deleted; a reason (3+ characters) is required. */
export const deactivateUser = (id, reason) => post(`/users/${id}/deactivate`, { reason })

/** Your own photo (or anyone's, as an admin): a small image data URL, or null to remove it. */
export const setPhoto = (id, photo) => put(`/users/${id}/photo`, { photo })

export const reactivateUser = (id) => post(`/users/${id}/reactivate`)

/** { employeeId, allocatedHours, availableHours } across all active assignments. */
export const getWeeklyHours = (id) => get(`/users/${id}/hours`)

/** The employee's assignments across all projects. */
export const getUserAssignments = (id) => get(`/users/${id}/assignments`)
