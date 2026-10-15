package com.tracker.service;

import com.tracker.dto.CreateProjectRequest;
import com.tracker.dto.MilestoneRef;
import com.tracker.dto.ProjectChain;
import com.tracker.dto.ProjectLink;
import com.tracker.dto.ProjectOption;
import com.tracker.dto.ProjectSummary;
import com.tracker.dto.UpdateProjectRequest;
import com.tracker.exception.BusinessRuleException;
import com.tracker.exception.ForbiddenException;
import com.tracker.exception.NotFoundException;
import com.tracker.exception.BadRequestException;
import com.tracker.model.Assignment;
import com.tracker.model.Milestone;
import com.tracker.model.Project;
import com.tracker.model.ProjectStatus;
import com.tracker.model.Role;
import com.tracker.model.User;
import com.tracker.repository.AssignmentRepository;
import com.tracker.repository.MilestoneRepository;
import com.tracker.repository.ProjectRepository;
import com.tracker.repository.UserRepository;
import com.tracker.security.AccessPolicy;
import com.tracker.util.Graphs;
import com.tracker.util.Validate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.tracker.service.AuditService.details;

/**
 * Admins create projects; managers edit their own and mark them completed.
 * Archived projects are read-only.
 * Archiving: managers mark projects completed, then admins archive them.
 *
 * Projects can depend on other projects (no loops). A project can't be completed until
 * every project it depends on is finished, and its milestones may depend on milestones
 * in those projects (see MilestoneService).
 */
public class ProjectService {
    private final ProjectRepository projects;
    private final AssignmentRepository assignments;
    private final MilestoneRepository milestones;
    private final UserRepository users;
    private final UserService userService;
    private final HoursCalculator hours;
    private final AccessPolicy access;
    private final AuditService audit;

    public ProjectService(ProjectRepository projects, AssignmentRepository assignments,
                          MilestoneRepository milestones, UserRepository users,
                          UserService userService, HoursCalculator hours, AccessPolicy access, AuditService audit) {
        this.projects = projects;
        this.assignments = assignments;
        this.milestones = milestones;
        this.users = users;
        this.userService = userService;
        this.hours = hours;
        this.access = access;
        this.audit = audit;
    }

    /** Admins see every project, managers their own, employees the ones they're assigned to. */
    public List<ProjectSummary> list(User actor) {
        List<Project> visible = switch (actor.getRole()) {
            case ADMIN -> projects.findAll();
            case MANAGER -> projects.findByManager(actor.getId());
            case EMPLOYEE -> projects.findForEmployee(actor.getId());
        };
        return visible.stream().map(this::summarize).toList();
    }

    public ProjectSummary get(User actor, long id) {
        return summarize(access.requireVisibleProject(actor, id));
    }

    public ProjectSummary create(User actor, CreateProjectRequest req) {
        access.requireAdmin(actor, "Only admins can create projects.");

        Project project = new Project(
                Validate.text(req.title(), "Title"),
                userService.requireActiveManager(Validate.required(req.managerId(), "Manager")).getId(),
                Validate.required(req.startDate(), "Start date"),
                Validate.required(req.predictedEndDate(), "Predicted end date"));
        project.setDescription(req.description() == null ? "" : req.description());
        Validate.ordered(project.getStartDate(), project.getPredictedEndDate(), "The predicted end date");

        Project saved = projects.insert(project, actor.getId());
        audit.record(actor, "CREATE_PROJECT", "PROJECT", saved.getId(), details(
                "title", saved.getName(), "managerId", saved.getManagerId(),
                "startDate", saved.getStartDate(), "predictedEndDate", saved.getPredictedEndDate()));
        return summarize(saved);
    }

    /**
     * Managers may change title, description, start date and predicted end date on their own
     * projects. Only admins may hand a project to another manager.
     * New dates must still contain every active assignment and every milestone.
     */
    public ProjectSummary update(User actor, long id, UpdateProjectRequest req) {
        Project project = access.requireManagedProject(actor, id);
        access.requireWritable(project);

        if (actor.getRole() != Role.ADMIN && req.managerId() != null) {
            throw new ForbiddenException("Only admins can give a project to another manager.");
        }

        if (req.title() != null) project.setName(Validate.text(req.title(), "Title"));
        if (req.description() != null) project.setDescription(req.description());
        if (req.startDate() != null) project.setStartDate(req.startDate());
        if (req.predictedEndDate() != null) project.setPredictedEndDate(req.predictedEndDate());
        if (req.managerId() != null) project.setManagerId(userService.requireActiveManager(req.managerId()).getId());
        Validate.ordered(project.getStartDate(), project.getPredictedEndDate(), "The predicted end date");
        Set<Long> dependsOn = req.dependsOn() == null ? null : validProjectDependencies(id, req.dependsOn());

        int outsideAssignments =
                assignments.countOutsideDates(id, project.getStartDate(), project.getPredictedEndDate());
        if (outsideAssignments > 0) {
            throw new BusinessRuleException(
                    outsideAssignments + " team assignment(s) fall outside the new dates. Adjust them first.");
        }
        int outsideMilestones =
                milestones.countOutsideDates(id, project.getStartDate(), project.getPredictedEndDate());
        if (outsideMilestones > 0) {
            throw new BusinessRuleException(
                    outsideMilestones + " milestone(s) fall outside the new dates. Adjust them first.");
        }
        Project saved = projects.update(project);
        if (dependsOn != null) projects.setDependencies(id, dependsOn);
        audit.record(actor, "UPDATE_PROJECT", "PROJECT", id, details(
                "title", req.title(), "description", req.description(), "startDate", req.startDate(),
                "predictedEndDate", req.predictedEndDate(), "managerId", req.managerId(), "dependsOn", dependsOn));
        return summarize(saved);
    }

    /**
     * Every id must be another existing project, none may lead back to this one, and a
     * project can only be dropped from the list once no milestone here depends on its milestones.
     */
    private Set<Long> validProjectDependencies(long projectId, List<Long> requested) {
        Set<Long> ids = new LinkedHashSet<>();
        Map<Long, Set<Long>> graph = projects.dependencyGraph();
        for (Long depId : requested) {
            if (depId == null) throw new BadRequestException("dependsOn must be a list of project ids.");
            if (depId == projectId) throw new BusinessRuleException("A project can't depend on itself.");
            Project dep = projects.findById(depId).orElseThrow(() -> new NotFoundException("Project " + depId + " not found."));
            if (Graphs.reaches(graph, depId, projectId)) {
                throw new BusinessRuleException("\"" + dep.getName() + "\" already depends on this project, so that would create a loop.");
            }
            ids.add(depId);
        }
        for (Long removed : projects.dependsOn(projectId)) {
            if (!ids.contains(removed) && milestones.countDependenciesBetween(projectId, removed) > 0) {
                String title = projects.findById(removed).map(Project::getName).orElse("that project");
                throw new BusinessRuleException("Milestones here still depend on milestones in \"" + title
                        + "\". Remove those milestone dependencies first.");
            }
        }
        return ids;
    }

    /**
     * The project's place in the dependency chain: what it waits on and what waits on it,
     * however far away. Anyone who can see the project can see its chain (titles, status,
     * progress), even through projects they can't open.
     */
    public ProjectChain chain(User actor, long id) {
        access.requireVisibleProject(actor, id);
        Map<Long, Set<Long>> graph = projects.dependencyGraph();
        Map<Long, Set<Long>> reversed = Graphs.reversed(graph);
        Set<Long> directUp = graph.getOrDefault(id, Set.of());
        Set<Long> directDown = reversed.getOrDefault(id, Set.of());

        List<ProjectLink> upstream = new ArrayList<>();
        for (Long upId : Graphs.allReachable(graph, id)) {
            upstream.add(link(actor, upId, directUp.contains(upId), directUp.contains(upId)));
        }
        List<ProjectLink> downstream = new ArrayList<>();
        for (Long downId : Graphs.allReachable(reversed, id)) {
            downstream.add(link(actor, downId, directDown.contains(downId), false));
        }
        return new ProjectChain(upstream, downstream);
    }

    /** Projects that can be picked as dependencies (admins and managers). */
    public List<ProjectOption> options(User actor) {
        if (actor.getRole() == Role.EMPLOYEE) throw new ForbiddenException("Only admins and managers can set project dependencies.");
        return projects.findAll().stream()
                .filter(p -> p.getStatus() != ProjectStatus.ARCHIVED)
                .map(p -> new ProjectOption(p.getId(), p.getName(), p.getStatus(), managerName(p)))
                .toList();
    }

    private ProjectLink link(User actor, long projectId, boolean direct, boolean withMilestones) {
        Project p = projects.findById(projectId).orElseThrow();
        List<Milestone> ms = milestones.findByProject(projectId);
        int progress = p.getStatus() != ProjectStatus.ACTIVE ? 100
                : ms.isEmpty() ? 0 : (int) Math.round(ms.stream().mapToInt(Milestone::getProgressPercent).average().orElse(0));
        List<MilestoneRef> refs = withMilestones ? ms.stream().map(m -> MilestoneRef.of(m, p.getName())).toList() : List.of();
        return new ProjectLink(p.getId(), p.getName(), p.getStatus(), managerName(p), progress, direct,
                access.canSeeProject(actor, p), refs);
    }

    private String managerName(Project p) {
        return users.findById(p.getManagerId()).map(User::getName).orElse(null);
    }

    /** The project's manager (or an admin) marks it completed. */
    public ProjectSummary complete(User actor, long id) {
        Project project = access.requireManagedProject(actor, id);
        if (project.getStatus() != ProjectStatus.ACTIVE) {
            throw new BusinessRuleException(
                    "This project is already " + project.getStatus().name().toLowerCase() + ".");
        }
        for (Long depId : projects.dependsOn(id)) {
            Project dep = projects.findById(depId).orElseThrow();
            if (dep.getStatus() == ProjectStatus.ACTIVE) {
                throw new BusinessRuleException("Finish \"" + dep.getName() + "\" first. This project depends on it.");
            }
        }
        project.setStatus(ProjectStatus.COMPLETED);
        project.setCompletedAt(Instant.now());
        Project saved = projects.update(project);
        audit.record(actor, "COMPLETE_PROJECT", "PROJECT", id, details("title", saved.getName()));
        return summarize(saved);
    }

    /** Admin only. After this the project and everything in it is read-only. */
    public ProjectSummary archive(User actor, long id, String reasonText) {
        access.requireAdmin(actor, "Only admins can archive projects.");
        String reason = Validate.reason(reasonText);
        Project project = projects.findById(id).orElseThrow(() -> new NotFoundException("Project not found."));
        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new BusinessRuleException("This project is already archived.");
        }
        Instant now = Instant.now();
        project.setStatus(ProjectStatus.ARCHIVED);
        if (project.getCompletedAt() == null) project.setCompletedAt(now);
        project.setArchivedAt(now);
        project.setArchiveReason(reason);
        Project saved = projects.update(project);
        audit.record(actor, "ARCHIVE_PROJECT", "PROJECT", id, details("title", saved.getName(), "reason", reason));
        return summarize(saved);
    }

    private ProjectSummary summarize(Project project) {
        List<Assignment> team = assignments.findByProject(project.getId(), false);
        List<Long> dependsOn = new ArrayList<>(projects.dependsOn(project.getId()));
        return ProjectSummary.of(project, managerName(project), dependsOn, team.size(), hours.projectTotalHours(team));
    }
}
