import { get, post, patch } from './api'

/** Each milestone includes dependsOn: the ids of milestones it depends on. */
export const getMilestones = (projectId) => get(`/projects/${projectId}/milestones`)

/**
 * milestone = { title, description?, startDate, dueDate, dependsOn? }
 * Rejected if the dependencies would form a loop.
 */
export const createMilestone = (projectId, milestone) =>
  post(`/projects/${projectId}/milestones`, milestone)

/**
 * Change any of: title, description, startDate, dueDate, status,
 * progressPercent, dependsOn. Dates can change while in progress.
 */
export const updateMilestone = (id, changes) => patch(`/milestones/${id}`, changes)
