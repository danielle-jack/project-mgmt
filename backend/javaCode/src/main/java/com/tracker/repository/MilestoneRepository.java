package com.tracker.repository;

import com.tracker.model.Milestone;
import com.tracker.model.MilestoneStatus;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * SQL for milestones and their dependency edges.
 * The model's "name" is stored in "title" and its "endDate" in "due_date".
 */
public class MilestoneRepository {
    private static final String COLUMNS = """
            milestone_id, project_id, title, description, start_date, due_date, status,
            progress_percent, completed_at, created_by, created_at, updated_at""";

    private final Database db;

    public MilestoneRepository(Database db) {
        this.db = db;
    }

    public Optional<Milestone> findById(long id) {
        Optional<Milestone> milestone = db.one("SELECT " + COLUMNS + " FROM milestones WHERE milestone_id = ?",
                MilestoneRepository::map, id);
        milestone.ifPresent(m -> m.setDependsOnMilestoneIds(
                dependencyGraph(m.getProjectId()).getOrDefault(m.getId(), new HashSet<>())));
        return milestone;
    }

    public List<Milestone> findByProject(long projectId) {
        List<Milestone> milestones = db.list(
                "SELECT " + COLUMNS + " FROM milestones WHERE project_id = ? ORDER BY start_date, milestone_id",
                MilestoneRepository::map, projectId);
        Map<Long, Set<Long>> graph = dependencyGraph(projectId);
        milestones.forEach(m -> m.setDependsOnMilestoneIds(graph.getOrDefault(m.getId(), new HashSet<>())));
        return milestones;
    }

    /** Every milestone dependency in every project: milestone id -> ids it depends on. Used to find loops. */
    public Map<Long, Set<Long>> dependencyGraphAll() {
        Map<Long, Set<Long>> graph = new HashMap<>();
        db.list("SELECT milestone_id, depends_on_id FROM milestone_dependencies",
                        rs -> new long[] { rs.getLong(1), rs.getLong(2) })
                .forEach(edge -> graph.computeIfAbsent(edge[0], k -> new HashSet<>()).add(edge[1]));
        return graph;
    }

    /** Milestones (in any project) that depend on this one. */
    public List<Milestone> findDependents(long milestoneId) {
        return db.list("SELECT milestone_id FROM milestone_dependencies WHERE depends_on_id = ?",
                        rs -> rs.getLong(1), milestoneId)
                .stream().map(id -> findById(id).orElseThrow()).toList();
    }

    /** How many milestones in `projectId` depend on milestones in `otherProjectId`. */
    public int countDependenciesBetween(long projectId, long otherProjectId) {
        return db.one("""
                SELECT COUNT(*) FROM milestone_dependencies d JOIN milestones m ON m.milestone_id = d.depends_on_id
                WHERE d.project_id = ? AND m.project_id = ?""",
                rs -> rs.getInt(1), projectId, otherProjectId).orElse(0);
    }

    /** For each milestone in the project, the ids it depends on (in any project). */
    public Map<Long, Set<Long>> dependencyGraph(long projectId) {
        Map<Long, Set<Long>> graph = new HashMap<>();
        db.list("SELECT milestone_id, depends_on_id FROM milestone_dependencies WHERE project_id = ?",
                        rs -> new long[] { rs.getLong(1), rs.getLong(2) }, projectId)
                .forEach(edge -> graph.computeIfAbsent(edge[0], k -> new HashSet<>()).add(edge[1]));
        return graph;
    }

    /** Milestones in the project that start before or are due after the given dates. */
    public int countOutsideDates(long projectId, LocalDate start, LocalDate end) {
        return db.one("""
                SELECT COUNT(*) FROM milestones
                WHERE project_id = ? AND (start_date < ? OR due_date > ?)""",
                rs -> rs.getInt(1), projectId, start, end).orElse(0);
    }

    /** Saves a new milestone and its dependencies, and fills in its id and timestamps. */
    public Milestone insert(Milestone m) {
        Milestone saved = db.one("""
                INSERT INTO milestones (project_id, title, description, start_date, due_date, status,
                                        progress_percent, completed_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING\s""" + COLUMNS,
                MilestoneRepository::map,
                m.getProjectId(), m.getName(), m.getDescription(), m.getStartDate(), m.getEndDate(), m.getStatus(),
                m.getProgressPercent(), m.getCompletedAt(), m.getCreatedById())
                .orElseThrow();
        saveDependencies(saved, m.getDependsOnMilestoneIds());
        return saved;
    }

    /** Saves every editable field and replaces the dependency list. */
    public Milestone update(Milestone m) {
        Milestone saved = db.one("""
                UPDATE milestones
                SET title = ?, description = ?, start_date = ?, due_date = ?, status = ?,
                    progress_percent = ?, completed_at = ?, updated_at = now()
                WHERE milestone_id = ?
                RETURNING\s""" + COLUMNS,
                MilestoneRepository::map,
                m.getName(), m.getDescription(), m.getStartDate(), m.getEndDate(), m.getStatus(),
                m.getProgressPercent(), m.getCompletedAt(), m.getId())
                .orElseThrow();
        db.execute("DELETE FROM milestone_dependencies WHERE milestone_id = ?", m.getId());
        saveDependencies(saved, m.getDependsOnMilestoneIds());
        return saved;
    }

    // Dependency rows are links between milestones, not records in their own right,
    // so replacing them is fine; the milestones themselves are never deleted.
    private void saveDependencies(Milestone saved, Set<Long> dependsOn) {
        for (Long dependsOnId : dependsOn) {
            db.execute("INSERT INTO milestone_dependencies (milestone_id, depends_on_id, project_id) VALUES (?, ?, ?)",
                    saved.getId(), dependsOnId, saved.getProjectId());
        }
        saved.setDependsOnMilestoneIds(new HashSet<>(dependsOn));
    }

    private static Milestone map(ResultSet rs) throws SQLException {
        Milestone m = new Milestone(rs.getLong("project_id"), rs.getString("title"),
                rs.getObject("start_date", LocalDate.class), rs.getObject("due_date", LocalDate.class));
        m.setId(rs.getLong("milestone_id"));
        m.setDescription(rs.getString("description"));
        m.setStatus(MilestoneStatus.valueOf(rs.getString("status")));
        m.setProgressPercent(rs.getInt("progress_percent"));
        m.setCompletedAt(Database.instant(rs, "completed_at"));
        m.setCreatedById(rs.getLong("created_by"));
        m.setCreatedAt(Database.instant(rs, "created_at"));
        m.setUpdatedAt(Database.instant(rs, "updated_at"));
        return m;
    }
}
