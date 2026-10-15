package com.tracker.repository;

import com.tracker.model.Project;
import com.tracker.model.ProjectStatus;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

/**
 * SQL for projects. No delete method: projects are archived.
 * The model's "name" is stored in the "title" column.
 */
public class ProjectRepository {
    private static final String COLUMNS = """
            project_id, title, description, manager_id, start_date, predicted_end_date,
            status, completed_at, archived_at, archive_reason, planned_budget, created_at, updated_at""";

    private final Database db;

    public ProjectRepository(Database db) {
        this.db = db;
    }

    public Optional<Project> findById(long id) {
        return db.one("SELECT " + COLUMNS + " FROM projects WHERE project_id = ?", ProjectRepository::map, id);
    }

    public List<Project> findAll() {
        return db.list("SELECT " + COLUMNS + " FROM projects ORDER BY start_date DESC, title",
                ProjectRepository::map);
    }

    public List<Project> findByManager(long managerId) {
        return db.list("SELECT " + COLUMNS + " FROM projects WHERE manager_id = ? ORDER BY start_date DESC, title",
                ProjectRepository::map, managerId);
    }

    /** Projects the employee is or was assigned to. */
    public List<Project> findForEmployee(long employeeId) {
        return db.list("SELECT " + COLUMNS + " FROM projects p WHERE EXISTS ("
                        + " SELECT 1 FROM project_assignments a"
                        + " WHERE a.project_id = p.project_id AND a.employee_id = ?)"
                        + " ORDER BY start_date DESC, title",
                ProjectRepository::map, employeeId);
    }

    public int countUnarchivedForManager(long managerId) {
        return db.one("SELECT COUNT(*) FROM projects WHERE manager_id = ? AND status <> 'ARCHIVED'",
                rs -> rs.getInt(1), managerId).orElse(0);
    }

    // ---- Project dependencies: a project can't be completed until the ones it depends on are done.

    /** Ids of the projects this project depends on. */
    public Set<Long> dependsOn(long projectId) {
        return new TreeSet<>(db.list("SELECT depends_on_project_id FROM project_dependencies WHERE project_id = ?",
                rs -> rs.getLong(1), projectId));
    }

    /** Every project dependency: project id -> ids it depends on. Used to find chains and loops. */
    public Map<Long, Set<Long>> dependencyGraph() {
        Map<Long, Set<Long>> graph = new HashMap<>();
        db.list("SELECT project_id, depends_on_project_id FROM project_dependencies",
                        rs -> new long[] { rs.getLong(1), rs.getLong(2) })
                .forEach(edge -> graph.computeIfAbsent(edge[0], k -> new TreeSet<>()).add(edge[1]));
        return graph;
    }

    /** Replaces the list of projects this project depends on. These are links, not records, so replacing is fine. */
    public void setDependencies(long projectId, Set<Long> dependsOn) {
        db.execute("DELETE FROM project_dependencies WHERE project_id = ?", projectId);
        for (Long id : dependsOn) {
            db.execute("INSERT INTO project_dependencies (project_id, depends_on_project_id) VALUES (?, ?)", projectId, id);
        }
    }

    /** Saves a new project and fills in its id and timestamps. */
    public Project insert(Project p, long createdBy) {
        return db.one("""
                INSERT INTO projects (title, description, manager_id, start_date, predicted_end_date, status,
                                      planned_budget, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING\s""" + COLUMNS,
                ProjectRepository::map,
                p.getName(), p.getDescription(), p.getManagerId(), p.getStartDate(), p.getPredictedEndDate(),
                p.getStatus(), p.getPlannedBudget(), createdBy)
                .orElseThrow();
    }

    /** Saves every editable column, including status changes. */
    public Project update(Project p) {
        return db.one("""
                UPDATE projects
                SET title = ?, description = ?, manager_id = ?, start_date = ?, predicted_end_date = ?,
                    status = ?, completed_at = ?, archived_at = ?, archive_reason = ?, planned_budget = ?,
                    updated_at = now()
                WHERE project_id = ?
                RETURNING\s""" + COLUMNS,
                ProjectRepository::map,
                p.getName(), p.getDescription(), p.getManagerId(), p.getStartDate(), p.getPredictedEndDate(),
                p.getStatus(), p.getCompletedAt(), p.getArchivedAt(), p.getArchiveReason(), p.getPlannedBudget(),
                p.getId())
                .orElseThrow();
    }

    private static Project map(ResultSet rs) throws SQLException {
        Project p = new Project(rs.getString("title"), rs.getLong("manager_id"),
                rs.getObject("start_date", LocalDate.class), rs.getObject("predicted_end_date", LocalDate.class));
        p.setId(rs.getLong("project_id"));
        p.setDescription(rs.getString("description"));
        p.setStatus(ProjectStatus.valueOf(rs.getString("status")));
        p.setCompletedAt(Database.instant(rs, "completed_at"));
        p.setArchivedAt(Database.instant(rs, "archived_at"));
        p.setArchiveReason(rs.getString("archive_reason"));
        p.setPlannedBudget(rs.getDouble("planned_budget"));
        p.setCreatedAt(Database.instant(rs, "created_at"));
        p.setUpdatedAt(Database.instant(rs, "updated_at"));
        return p;
    }
}
