import { get } from './api'

/**
 * Admin only: recorded admin actions, newest first.
 * Each entry: { id, actorId, actorName, action, entityType, entityId, details, createdAt }
 * e.g. action 'CREATE_USER', entityType 'USER', details { name, email, role }.
 *
 * filters (all optional): { entityType: 'USER' | 'PROJECT' | 'ASSIGNMENT' | 'MILESTONE', entityId, limit }
 */
export function getAuditLogs({ entityType, entityId, limit } = {}) {
  const params = new URLSearchParams()
  if (entityType) params.set('entityType', entityType)
  if (entityId != null) params.set('entityId', String(entityId))
  if (limit != null) params.set('limit', String(limit))
  const query = params.toString()
  return get(`/audit-logs${query ? `?${query}` : ''}`)
}
