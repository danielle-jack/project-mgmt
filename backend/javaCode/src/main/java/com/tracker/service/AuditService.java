package com.tracker.service;

import com.tracker.dto.AuditLogEntry;
import com.tracker.exception.BadRequestException;
import com.tracker.model.Role;
import com.tracker.model.User;
import com.tracker.repository.AuditLogRepository;
import com.tracker.security.AccessPolicy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Records every change an admin makes, and lets admins read the log.
 *
 * Entries are written in the same database transaction as the change itself, so a
 * change that fails (and is rolled back) leaves no entry behind. Never put
 * passwords or password hashes in the details.
 */
public class AuditService {
    public static final Set<String> ENTITY_TYPES = Set.of("USER", "PROJECT", "ASSIGNMENT", "MILESTONE");
    private static final int DEFAULT_LIMIT = 100;
    private static final int MAX_LIMIT = 500;

    private final AuditLogRepository logs;
    private final AccessPolicy access;

    public AuditService(AuditLogRepository logs, AccessPolicy access) {
        this.logs = logs;
        this.access = access;
    }

    /**
     * Records the action if the actor is an admin; does nothing for anyone else.
     * details are key/value pairs, e.g. details("role", "MANAGER"). Null values are skipped.
     */
    public void record(User actor, String action, String entityType, long entityId, Map<String, Object> details) {
        if (actor.getRole() != Role.ADMIN) return;
        logs.insert(actor.getId(), action, entityType, entityId, details);
    }

    /** Admin only. Newest first; filter by entityType ("USER", ...) and/or entityId. */
    public List<AuditLogEntry> list(User actor, String entityType, Long entityId, Integer limit) {
        access.requireAdmin(actor, "Only admins can view the audit log.");
        if (entityType != null && !ENTITY_TYPES.contains(entityType)) {
            throw new BadRequestException("entityType must be one of " + String.join(", ", ENTITY_TYPES) + ".");
        }
        int size = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
        return logs.find(entityType, entityId, size);
    }

    /** details("role", "MANAGER", "email", "a@b.com"): keys and values in pairs, nulls dropped. */
    public static Map<String, Object> details(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            if (pairs[i + 1] != null) map.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        return map;
    }
}
