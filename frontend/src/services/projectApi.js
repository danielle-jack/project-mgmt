import { get, post, patch } from './api'

/**
 * Admins see every project, managers see their own, employees see the ones
 * they're assigned to. Each project includes a calculated totalHours.
 */
export const getProjects = () => get('/projects')

export const getProject = (id) => get(`/projects/${id}`)

/** Admin only. project = { title, description, managerId, startDate, predictedEndDate } */
export const createProject = (project) => post('/projects', project)

/** Admin, or the project's manager. Only active projects can change. changes.dependsOn = project ids. */
export const updateProject = (id, changes) => patch(`/projects/${id}`, changes)

/** The project's manager (or an admin) marks it completed. */
export const completeProject = (id) => post(`/projects/${id}/complete`)

/** Admin only. Archived projects become read-only; a reason (3+ characters) is required. */
export const archiveProject = (id, reason) => post(`/projects/${id}/archive`, { reason })

/**
 * The project's dependency chain: { upstream, downstream }, each a list of
 * { id, title, status, managerName, progressPercent, direct, canOpen, milestones }.
 * Direct upstream projects include their milestones (for the dependency picker).
 */
export const getProjectChain = (id) => get(`/projects/${id}/chain`)

/** Projects that can be picked as dependencies (admins and managers): { id, title, status, managerName }. */
export const getProjectOptions = () => get('/projects/options')
