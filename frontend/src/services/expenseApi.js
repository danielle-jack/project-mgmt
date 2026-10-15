import { get, post } from './api'

/** Admins and the project's manager: every expense, newest first, voided ones included. */
export const getExpenses = (projectId) => get(`/projects/${projectId}/expenses`)

/** expense = { amount, spentOn?, description }. spentOn defaults to today and can't be in the future. */
export const createExpense = (projectId, expense) => post(`/projects/${projectId}/expenses`, expense)

/** Expenses are never deleted; voiding one stops it counting. A reason is required. */
export const voidExpense = (id, reason) => post(`/expenses/${id}/void`, { reason })
