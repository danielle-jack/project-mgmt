package com.tracker.repository;

import com.google.gson.JsonParser;
import com.tracker.dto.AuditLogEntry;
import com.tracker.util.Json;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * SQL for the audit log. Entries are only ever added, never changed or removed.
 */
public class AuditLogRepository {
    private final Database db;

    public AuditLogRepository(Database db) {
        this.db = db;
    }

    public void insert(long actorId, String action, String entityType, long entityId, Map<String, Object> details) {
        db.execute("""
                INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
                VALUES (?, ?, ?, ?, CAST(? AS jsonb))""",
                actorId, action, entityType, entityId, Json.GSON.toJson(details));
    }

    /** Newest first. entityType and entityId are optional filters (pass null to skip). */
    public List<AuditLogEntry> find(String entityType, Long entityId, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT l.log_id, l.actor_id, u.name AS actor_name, l.action, l.entity_type, l.entity_id,
                       l.details::text AS details, l.created_at
                FROM audit_logs l JOIN users u ON u.user_id = l.actor_id
                WHERE TRUE""");
        List<Object> params = new ArrayList<>();
        if (entityType != null) {
            sql.append(" AND l.entity_type = ?");
            params.add(entityType);
        }
        if (entityId != null) {
            sql.append(" AND l.entity_id = ?");
            params.add(entityId);
        }
        sql.append(" ORDER BY l.created_at DESC, l.log_id DESC LIMIT ?");
        params.add(limit);
        return db.list(sql.toString(), AuditLogRepository::map, params.toArray());
    }

    private static AuditLogEntry map(ResultSet rs) throws SQLException {
        String details = rs.getString("details");
        return new AuditLogEntry(
                rs.getLong("log_id"),
                rs.getLong("actor_id"),
                rs.getString("actor_name"),
                rs.getString("action"),
                rs.getString("entity_type"),
                rs.getLong("entity_id"),
                details == null ? null : JsonParser.parseString(details),
                Database.instant(rs, "created_at"));
    }
}
