package com.tracker.repository;

import com.tracker.model.Expense;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * SQL for project expenses. No delete method: expenses are voided.
 */
public class ExpenseRepository {
    private static final String COLUMNS = """
            expense_id, project_id, amount, spent_on, description, active, created_by,
            voided_at, void_reason, created_at""";

    private final Database db;

    public ExpenseRepository(Database db) {
        this.db = db;
    }

    public Optional<Expense> findById(long id) {
        return db.one("SELECT " + COLUMNS + " FROM project_expenses WHERE expense_id = ?",
                ExpenseRepository::map, id);
    }

    /** Newest first, voided ones included. */
    public List<Expense> findByProject(long projectId) {
        return db.list("SELECT " + COLUMNS + " FROM project_expenses WHERE project_id = ?"
                        + " ORDER BY spent_on DESC, expense_id DESC",
                ExpenseRepository::map, projectId);
    }

    /** Sum of the project's expenses that haven't been voided. */
    public double sumActive(long projectId) {
        return db.one("SELECT COALESCE(SUM(amount), 0) FROM project_expenses WHERE project_id = ? AND active",
                rs -> rs.getDouble(1), projectId).orElse(0.0);
    }

    /** Saves a new expense and fills in its id and timestamp. */
    public Expense insert(Expense e) {
        return db.one("""
                INSERT INTO project_expenses (project_id, amount, spent_on, description, created_by)
                VALUES (?, ?, ?, ?, ?)
                RETURNING\s""" + COLUMNS,
                ExpenseRepository::map,
                e.getProjectId(), e.getAmount(), e.getSpentOn(), e.getDescription(), e.getCreatedBy())
                .orElseThrow();
    }

    /** Saves the active flag, voided time and reason. */
    public Expense update(Expense e) {
        return db.one("""
                UPDATE project_expenses SET active = ?, voided_at = ?, void_reason = ?
                WHERE expense_id = ?
                RETURNING\s""" + COLUMNS,
                ExpenseRepository::map,
                e.isActive(), e.getVoidedAt(), e.getVoidReason(), e.getId())
                .orElseThrow();
    }

    private static Expense map(ResultSet rs) throws SQLException {
        Expense e = new Expense(rs.getLong("project_id"), rs.getDouble("amount"),
                rs.getObject("spent_on", LocalDate.class), rs.getString("description"));
        e.setId(rs.getLong("expense_id"));
        e.setActive(rs.getBoolean("active"));
        e.setCreatedBy(rs.getLong("created_by"));
        e.setVoidedAt(Database.instant(rs, "voided_at"));
        e.setVoidReason(rs.getString("void_reason"));
        e.setCreatedAt(Database.instant(rs, "created_at"));
        return e;
    }
}
