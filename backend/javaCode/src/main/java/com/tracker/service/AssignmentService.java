package com.tracker.service;

import com.tracker.dto.AssignmentRequest;
import com.tracker.dto.AssignmentView;
import com.tracker.dto.WeeklyHours;
import com.tracker.exception.BusinessRuleException;
import com.tracker.exception.NotFoundException;
import com.tracker.model.Assignment;
import com.tracker.model.Project;
import com.tracker.model.Role;
import com.tracker.model.User;
import com.tracker.repository.AssignmentRepository;
import com.tracker.repository.ProjectRepository;
import com.tracker.repository.UserRepository;
import com.tracker.security.AccessPolicy;
import com.tracker.util.Validate;
import com.tracker.util.WorkWeek;

import java.time.Instant;
import java.util.List;

import static com.tracker.service.AuditService.details;

/**
 * Managers assign employees to projects; employees may be on many projects.
 * Total active hours per employee must not exceed 40/week.
 * Assignment dates must fall within the project's dates.
 * Managers may assign any active employee, not just the ones who report to them.
 */
public class AssignmentService {
    private final AssignmentRepository assignments;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final AccessPolicy access;
    private final AuditService audit;

    public AssignmentService(AssignmentRepository assignments, ProjectRepository projects,
                             UserRepository users, AccessPolicy access, AuditService audit) {
        this.assignments = assignments;
        this.projects = projects;
        this.users = users;
        this.access = access;
        this.audit = audit;
    }

    /** The project's team. includeInactive also returns people who were removed. */
    public List<AssignmentView> listForProject(User actor, long projectId, boolean includeInactive) {
        access.requireVisibleProject(actor, projectId);
        return assignments.findByProject(projectId, includeInactive).stream()
                .map(a -> AssignmentView.of(a, employeeName(a), null))
                .toList();
    }

    /** Every project one employee is or was on. */
    public List<AssignmentView> listForEmployee(User actor, long employeeId) {
        access.requireCanSeeUserWork(actor, employeeId);
        requireUser(employeeId);
        return assignments.findByEmployee(employeeId).stream()
                .map(a -> AssignmentView.of(a, employeeName(a), projectTitle(a)))
                .toList();
    }

    public WeeklyHours weeklyHours(User actor, long employeeId) {
        access.requireCanSeeUserWork(actor, employeeId);
        requireUser(employeeId);
        double allocated = assignments.sumActiveHours(employeeId, null);
        return new WeeklyHours(employeeId, allocated, WorkWeek.HOURS_PER_WEEK - allocated);
    }

    public AssignmentView create(User actor, long projectId, AssignmentRequest req) {
        Project project = access.requireManagedProject(actor, projectId);
        access.requireWritable(project);

        // Lock the employee so two requests can't both squeeze under 40 hours at once.
        User employee = users.lockById(Validate.required(req.employeeId(), "Employee"))
                .orElseThrow(() -> new NotFoundException("User not found."));
        if (employee.getRole() != Role.EMPLOYEE || !employee.isActive()) {
            throw new BusinessRuleException("Only active employees can be assigned to projects.");
        }
        if (assignments.existsActive(projectId, employee.getId())) {
            throw new BusinessRuleException(employee.getName() + " is already on this project.");
        }

        Assignment assignment = new Assignment(projectId, employee.getId(),
                Validate.hoursPerWeek(req.hoursPerWeek()),
                req.startDate() != null ? req.startDate() : project.getStartDate(),
                req.endDate() != null ? req.endDate() : project.getPredictedEndDate());
        assignment.setAssignedBy(actor.getId());
        requireFits(assignment, project, employee);

        Assignment saved = assignments.insert(assignment);
        audit.record(actor, "ASSIGN_EMPLOYEE", "ASSIGNMENT", saved.getId(), details(
                "projectId", projectId, "employeeId", employee.getId(), "hoursPerWeek", saved.getHoursPerWeek(),
                "startDate", saved.getStartDate(), "endDate", saved.getEndDate()));
        return AssignmentView.of(saved, employee.getName(), null);
    }

    /** Change hours and/or dates. The same 40-hour and date checks apply. */
    public AssignmentView update(User actor, long id, AssignmentRequest req) {
        Assignment assignment = find(id);
        Project project = access.requireManagedProject(actor, assignment.getProjectId());
        access.requireWritable(project);
        if (!assignment.isActive()) throw new BusinessRuleException("This person has been removed from the team.");

        User employee = users.lockById(assignment.getEmployeeId()).orElseThrow();
        if (req.hoursPerWeek() != null) assignment.setHoursPerWeek(Validate.hoursPerWeek(req.hoursPerWeek()));
        if (req.startDate() != null) assignment.setStartDate(req.startDate());
        if (req.endDate() != null) assignment.setEndDate(req.endDate());
        requireFits(assignment, project, employee);

        Assignment saved = assignments.update(assignment);
        audit.record(actor, "UPDATE_ASSIGNMENT", "ASSIGNMENT", id, details(
                "projectId", saved.getProjectId(), "employeeId", saved.getEmployeeId(),
                "hoursPerWeek", req.hoursPerWeek(), "startDate", req.startDate(), "endDate", req.endDate()));
        return AssignmentView.of(saved, employee.getName(), null);
    }

    /** Remove from the team. The assignment is kept, marked inactive. */
    public AssignmentView deactivate(User actor, long id, String reasonText) {
        Assignment assignment = find(id);
        access.requireWritable(access.requireManagedProject(actor, assignment.getProjectId()));
        String reason = Validate.reason(reasonText);
        if (!assignment.isActive()) {
            throw new BusinessRuleException("This person has already been removed from the team.");
        }
        assignment.setActive(false);
        assignment.setDeactivatedAt(Instant.now());
        assignment.setRemovalReason(reason);
        Assignment saved = assignments.update(assignment);
        audit.record(actor, "REMOVE_FROM_TEAM", "ASSIGNMENT", id,
                details("projectId", saved.getProjectId(), "employeeId", saved.getEmployeeId(), "reason", reason));
        return AssignmentView.of(saved, employeeName(saved), null);
    }

    private void requireFits(Assignment a, Project project, User employee) {
        Validate.ordered(a.getStartDate(), a.getEndDate(), "The end date");
        if (a.getStartDate().isBefore(project.getStartDate()) || a.getEndDate().isAfter(project.getPredictedEndDate())) {
            throw new BusinessRuleException("Assignment dates must be within the project ("
                    + project.getStartDate() + " to " + project.getPredictedEndDate() + ").");
        }

        double otherHours = assignments.sumActiveHours(employee.getId(), a.getId());
        if (otherHours + a.getHoursPerWeek() > WorkWeek.HOURS_PER_WEEK) {
            throw new BusinessRuleException(employee.getName() + " already has " + format(otherHours)
                    + " hrs/week on other projects, so at most "
                    + format(WorkWeek.HOURS_PER_WEEK - otherHours) + " more fit.");
        }
    }

    private Assignment find(long id) {
        return assignments.findById(id).orElseThrow(() -> new NotFoundException("Assignment not found."));
    }

    private void requireUser(long id) {
        if (users.findById(id).isEmpty()) throw new NotFoundException("User not found.");
    }

    private String employeeName(Assignment a) {
        return users.findById(a.getEmployeeId()).map(User::getName).orElse(null);
    }

    private String projectTitle(Assignment a) {
        return projects.findById(a.getProjectId()).map(Project::getName).orElse(null);
    }

    /** 20.0 -> "20", 7.5 -> "7.5" */
    private static String format(double hours) {
        return hours == Math.floor(hours) ? String.valueOf((long) hours) : String.valueOf(hours);
    }
}
