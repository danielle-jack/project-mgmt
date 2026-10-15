package com.tracker.dto;

import com.google.gson.JsonElement;

import java.time.Instant;

/**
 * One recorded admin action, e.g. CREATE_USER on USER 7 by Avery, with details
 * such as the new user's role.
 */
public record AuditLogEntry(
        Long id,
        Long actorId,
        String actorName,
        String action,
        String entityType,
        Long entityId,
        JsonElement details,
        Instant createdAt) {}
