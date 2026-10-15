package com.tracker.repository;

import com.tracker.model.Assignment;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * SQL for assignments, including the sum of an employee's active weekly hours.
 * No delete method: removing someone from a team deactivates the assignment.
 */
public class AssignmentRepository {
    private static final String COLUMNS = """
            assignment_id, project_id, employee_id, hours_per_week, start_date, end_date,
            active, assigned_by, deactivated_at, removal_reason, created_at, updated_at""";

    private final Database db;

    public AssignmentRepository(Database db) {
        this.db = db;
    }

    public Optional<Assignment> findById(long id) {
        return db.one("SELECT " + COLUMNS + " FROM project_assignments WHERE assignment_id = ?",
                AssignmentRepository::map, id);
    }

    public List<Assignment> findByProject(long projectId, boolean includeInactive) {
        return db.list("SELECT " + COLUMNS + " FROM project_assignments WHERE project_id = ?"
                        + (includeInactive ? "" : " AND active")
                        + " ORDER BY active DESC, start_date, assignment_id",
                AssignmentRepository::map, projectId);
    }

    public List<Assignment> findByEmployee(long employeeId) {
        return db.list("SELECT " + COLUMNS + " FROM project_assignments WHERE employee_id = ?"
                        + " ORDER BY active DESC, start_date DESC",
                AssignmentRepository::map, employeeId);
    }

    public boolean existsActive(long projectId, long employeeId) {
        return db.one("SELECT 1 FROM project_assignments WHERE project_id = ? AND employee_id = ? AND active",
                rs -> true, projectId, employeeId).isPresent();
    }

    /** True if the employee is on the project now, or was before being removed. */
    public boolean everAssigned(long projectId, long employeeId) {
        return db.one("SELECT 1 FROM project_assignments WHERE project_id = ? AND employee_id = ? LIMIT 1",
                rs -> true, projectId, employeeId).isPresent();
    }

    /**
     * Total hours per week the employee is booked for, optionally leaving one assignment out.
     * Only active assignments on ACTIVE projects count: completing or archiving a project
     * frees its team's hours.
     */
    public double sumActiveHours(long employeeId, Long excludeAssignmentId) {
        return db.one("""
                SELECT COALESCE(SUM(a.hours_per_week), 0)
                FROM project_assignments a JOIN projects p ON p.project_id = a.project_id
                WHERE a.employee_id = ? AND a.active AND p.status = 'ACTIVE'
                  AND a.assignment_id IS DISTINCT FROM ?""",
                rs -> rs.getDouble(1), employeeId, excludeAssignmentId).orElse(0.0);
    }

    /** Booked hours per week for every employee who has any, counted the same way as sumActiveHours. */
    public Map<Long, Double> bookedHoursByEmployee() {
        Map<Long, Double> hours = new HashMap<>();
        db.list("""
                SELECT a.employee_id, SUM(a.hours_per_week)
                FROM project_assignments a JOIN projects p ON p.project_id = a.project_id
                WHERE a.active AND p.status = 'ACTIVE'
                GROUP BY a.employee_id""",
                rs -> Map.entry(rs.getLong(1), rs.getDouble(2)))
                .forEach(e -> hours.put(e.getKey(), e.getValue()));
        return hours;
    }

    /** Active assignments on the project that start before or end after the given dates. */
    public int countOutsideDates(long projectId, LocalDate start, LocalDate end) {
        return db.one("""
                SELECT COUNT(*) FROM project_assignments
                WHERE project_id = ? AND active AND (start_date < ? OR end_date > ?)""",
                rs -> rs.getInt(1), projectId, start, end).orElse(0);
    }

    /** Takes the employee off every team, e.g. when they're deactivated. */
    public void deactivateAllForEmployee(long employeeId, String reason) {
        db.execute("""
                UPDATE project_assignments
                SET active = FALSE, deactivated_at = now(), removal_reason = ?, updated_at = now()
                WHERE employee_id = ? AND active""", reason, employeeId);
    }

    /** Saves a new assignment and fills in its id and timestamps. */
    public Assignment insert(Assignment a) {
        return db.one("""
                INSERT INTO project_assignments (project_id, employee_id, hours_per_week, start_date, end_date, assigned_by)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING\s""" + COLUMNS,
                AssignmentRepository::map,
                a.getProjectId(), a.getEmployeeId(), a.getHoursPerWeek(), a.getStartDate(), a.getEndDate(),
                a.getAssignedBy())
                .orElseThrow();
    }

    /** Saves hours, dates and the active flag. */
    public Assignment update(Assignment a) {
        return db.one("""
                UPDATE project_assignments
                SET hours_per_week = ?, start_date = ?, end_date = ?, active = ?, deactivated_at = ?,
                    removal_reason = ?, updated_at = now()
                WHERE assignment_id = ?
                RETURNING\s""" + COLUMNS,
                AssignmentRepository::map,
                a.getHoursPerWeek(), a.getStartDate(), a.getEndDate(), a.isActive(), a.getDeactivatedAt(),
                a.getRemovalReason(), a.getId())
                .orElseThrow();
    }

    private static Assignment map(ResultSet rs) throws SQLException {
        Assignment a = new Assignment(rs.getLong("project_id"), rs.getLong("employee_id"),
                rs.getDouble("hours_per_week"),
                rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class));
        a.setId(rs.getLong("assignment_id"));
        a.setActive(rs.getBoolean("active"));
        a.setAssignedBy(rs.getLong("assigned_by"));
        a.setDeactivatedAt(Database.instant(rs, "deactivated_at"));
        a.setRemovalReason(rs.getString("removal_reason"));
        a.setCreatedAt(Database.instant(rs, "created_at"));
        a.setUpdatedAt(Database.instant(rs, "updated_at"));
        return a;
    }
}
