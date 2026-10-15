package com.tracker.service;

import com.tracker.dto.MilestoneRef;
import com.tracker.dto.MilestoneRequest;
import com.tracker.dto.MilestoneView;
import com.tracker.exception.BadRequestException;
import com.tracker.exception.BusinessRuleException;
import com.tracker.exception.NotFoundException;
import com.tracker.model.Milestone;
import com.tracker.model.MilestoneStatus;
import com.tracker.model.Project;
import com.tracker.model.User;
import com.tracker.repository.MilestoneRepository;
import com.tracker.repository.ProjectRepository;
import com.tracker.security.AccessPolicy;
import com.tracker.util.Graphs;
import com.tracker.util.Validate;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.tracker.service.AuditService.details;

/**
 * Managers (and admins) create milestones; dates may change while in progress.
 *
 * Rules:
 * - Milestone dates must fall within the project's dates.
 * - A milestone can depend on milestones in its own project, or in any project its
 *   project depends on (see ProjectService). No loops, even across projects.
 * - Work may start early, but a milestone can't be completed until everything it
 *   depends on is completed (and a completed milestone's dependencies can't be reopened).
 * - Moving dates never shifts other milestones. Instead each milestone reports
 *   dateConflicts: unfinished dependencies that are due after it is.
 * - Progress is 0-100%, and 100% once completed.
 */
public class MilestoneService {
    private final MilestoneRepository milestones;
    private final ProjectRepository projects;
    private final AccessPolicy access;
    private final AuditService audit;

    public MilestoneService(MilestoneRepository milestones, ProjectRepository projects, AccessPolicy access,
                            AuditService audit) {
        this.milestones = milestones;
        this.projects = projects;
        this.access = access;
        this.audit = audit;
    }

    public List<MilestoneView> list(User actor, long projectId) {
        access.requireVisibleProject(actor, projectId);
        Lookup lookup = new Lookup();
        List<Milestone> own = milestones.findByProject(projectId);
        own.forEach(lookup::add);
        return own.stream().map(m -> view(m, lookup)).toList();
    }

    public MilestoneView create(User actor, long projectId, MilestoneRequest req) {
        Project project = access.requireManagedProject(actor, projectId);
        access.requireWritable(project);

        Milestone milestone = new Milestone(projectId,
                Validate.text(req.title(), "Title"),
                Validate.required(req.startDate(), "Start date"),
                Validate.required(req.dueDate(), "Due date"));
        milestone.setDescription(req.description() == null ? "" : req.description());
        milestone.setCreatedById(actor.getId());
        requireValidDates(milestone, project);
        if (req.dependsOn() != null) milestone.setDependsOnMilestoneIds(validDependencies(milestone, req.dependsOn()));

        Milestone saved = milestones.insert(milestone);
        audit.record(actor, "CREATE_MILESTONE", "MILESTONE", saved.getId(), details(
                "projectId", projectId, "title", saved.getName(), "startDate", saved.getStartDate(),
                "dueDate", saved.getEndDate(), "dependsOn", req.dependsOn()));
        return view(saved, new Lookup());
    }

    public MilestoneView update(User actor, long id, MilestoneRequest req) {
        Milestone milestone = milestones.findById(id)
                .orElseThrow(() -> new NotFoundException("Milestone not found."));
        Project project = access.requireManagedProject(actor, milestone.getProjectId());
        access.requireWritable(project);

        if (req.title() != null) milestone.setName(Validate.text(req.title(), "Title"));
        if (req.description() != null) milestone.setDescription(req.description());
        if (req.startDate() != null) milestone.setStartDate(req.startDate());
        if (req.dueDate() != null) milestone.setEndDate(req.dueDate());
        requireValidDates(milestone, project);

        if (req.progressPercent() != null) milestone.setProgressPercent(Validate.percent(req.progressPercent()));
        if (req.status() != null) milestone.setStatus(req.status());
        if (milestone.getStatus() == MilestoneStatus.COMPLETED) {
            milestone.setProgressPercent(100);
            if (milestone.getCompletedAt() == null) milestone.setCompletedAt(Instant.now());
        } else {
            milestone.setCompletedAt(null);
        }

        if (req.dependsOn() != null) milestone.setDependsOnMilestoneIds(validDependencies(milestone, req.dependsOn()));
        requireCompletionOrder(milestone);

        Milestone saved = milestones.update(milestone);
        audit.record(actor, "UPDATE_MILESTONE", "MILESTONE", id, details(
                "projectId", saved.getProjectId(), "title", req.title(), "startDate", req.startDate(),
                "dueDate", req.dueDate(), "status", req.status(), "progressPercent", req.progressPercent(),
                "dependsOn", req.dependsOn()));
        return view(saved, new Lookup());
    }

    private void requireValidDates(Milestone m, Project project) {
        Validate.ordered(m.getStartDate(), m.getEndDate(), "The due date");
        if (m.getStartDate().isBefore(project.getStartDate()) || m.getEndDate().isAfter(project.getPredictedEndDate())) {
            throw new BusinessRuleException("Milestone dates must be within the project ("
                    + project.getStartDate() + " to " + project.getPredictedEndDate() + ").");
        }
    }

    /**
     * A completed milestone needs all its dependencies completed, in any project. Checked
     * both ways: completing this one, and reopening one that a completed milestone depends on.
     */
    private void requireCompletionOrder(Milestone milestone) {
        if (milestone.getStatus() == MilestoneStatus.COMPLETED) {
            for (Long depId : milestone.getDependsOnMilestoneIds()) {
                Milestone dep = milestones.findById(depId).orElse(null);
                if (dep != null && dep.getStatus() != MilestoneStatus.COMPLETED) {
                    throw new BusinessRuleException("Finish \"" + dep.getName() + "\" first. This milestone depends on it.");
                }
            }
        } else if (milestone.getId() != null) {
            for (Milestone other : milestones.findDependents(milestone.getId())) {
                if (other.getStatus() == MilestoneStatus.COMPLETED) {
                    throw new BusinessRuleException("\"" + other.getName()
                            + "\" is already completed and depends on this milestone, so it can't be reopened.");
                }
            }
        }
    }

    /**
     * Every id must be another milestone in this project or in a project this project
     * depends on, and none may lead back to this one (checked across all projects).
     */
    private Set<Long> validDependencies(Milestone milestone, List<Long> dependsOn) {
        Set<Long> allowedProjects = new HashSet<>(projects.dependsOn(milestone.getProjectId()));
        allowedProjects.add(milestone.getProjectId());
        Map<Long, Set<Long>> graph = milestones.dependencyGraphAll();
        Set<Long> ids = new LinkedHashSet<>();

        for (Long depId : dependsOn) {
            if (depId == null) throw new BadRequestException("dependsOn must be a list of milestone ids.");
            if (depId.equals(milestone.getId())) throw new BusinessRuleException("A milestone can't depend on itself.");

            Milestone dep = milestones.findById(depId)
                    .orElseThrow(() -> new NotFoundException("Milestone " + depId + " not found."));
            if (!allowedProjects.contains(dep.getProjectId())) {
                throw new BusinessRuleException("\"" + dep.getName() + "\" is in a project this project doesn't depend on. "
                        + "Add that project as a dependency first.");
            }
            if (milestone.getId() != null && Graphs.reaches(graph, depId, milestone.getId())) {
                throw new BusinessRuleException("\"" + dep.getName()
                        + "\" already depends on this milestone, so that would create a loop.");
            }
            ids.add(depId);
        }
        return ids;
    }

    /** Unfinished dependencies (in any project) that are due after this milestone. */
    static List<Long> dateConflicts(Milestone milestone, List<Milestone> dependencies) {
        return dependencies.stream()
                .filter(dep -> dep.getStatus() != MilestoneStatus.COMPLETED && dep.getEndDate().isAfter(milestone.getEndDate()))
                .map(Milestone::getId)
                .sorted()
                .toList();
    }

    private MilestoneView view(Milestone milestone, Lookup lookup) {
        List<Milestone> deps = milestone.getDependsOnMilestoneIds().stream().sorted()
                .map(lookup::milestone).filter(java.util.Objects::nonNull).toList();
        List<MilestoneRef> refs = deps.stream().map(d -> MilestoneRef.of(d, lookup.projectTitle(d.getProjectId()))).toList();
        return MilestoneView.of(milestone, refs, dateConflicts(milestone, deps));
    }

    /** Caches milestones and project titles while building views, so each is loaded once. */
    private final class Lookup {
        private final Map<Long, Milestone> milestonesById = new HashMap<>();
        private final Map<Long, String> projectTitles = new HashMap<>();

        void add(Milestone m) {
            milestonesById.put(m.getId(), m);
        }

        Milestone milestone(long id) {
            return milestonesById.computeIfAbsent(id, key -> milestones.findById(key).orElse(null));
        }

        String projectTitle(long projectId) {
            return projectTitles.computeIfAbsent(projectId,
                    key -> projects.findById(key).map(Project::getName).orElse(null));
        }
    }
}
