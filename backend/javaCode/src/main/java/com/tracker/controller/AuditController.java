package com.tracker.controller;

import com.tracker.exception.BadRequestException;
import com.tracker.service.AuditService;

/**
 * Routes for /audit-logs (admin only).
 * Optional query: ?entityType=PROJECT&entityId=3&limit=50
 */
public class AuditController {
    private final AuditService audit;

    public AuditController(AuditService audit) {
        this.audit = audit;
    }

    public void register(Router router) {
        router.get("/audit-logs", (actor, req, id) -> audit.list(actor,
                req.query().get("entityType"), number(req, "entityId"), intNumber(req, "limit")));
    }

    private static Long number(ApiRequest req, String name) {
        String raw = req.query().get(name);
        if (raw == null || raw.isBlank()) return null;
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            throw new BadRequestException(name + " must be a number.");
        }
    }

    private static Integer intNumber(ApiRequest req, String name) {
        Long value = number(req, name);
        return value == null ? null : (int) Math.min(value, Integer.MAX_VALUE);
    }
}
