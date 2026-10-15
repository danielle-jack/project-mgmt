package com.tracker.security;

import com.tracker.exception.BusinessRuleException;
import com.tracker.exception.ForbiddenException;
import com.tracker.exception.NotFoundException;
import com.tracker.model.Project;
import com.tracker.model.ProjectStatus;
import com.tracker.model.Role;
import com.tracker.model.User;
import com.tracker.repository.AssignmentRepository;
import com.tracker.repository.ProjectRepository;

/**
 * One place for every "who may do what" rule: admin-only actions,
 * manager-owns-project checks, and rejecting writes to archived projects.
 */
public class AccessPolicy {
    private final ProjectRepository projects;
    private final AssignmentRepository assignments;

    public AccessPolicy(ProjectRepository projects, AssignmentRepository assignments) {
        this.projects = projects;
        this.assignments = assignments;
    }

    public void requireAdmin(User actor, String message) {
        if (actor.getRole() != Role.ADMIN) throw new ForbiddenException(message);
    }

    /**
     * Admins see every project, managers see their own,
     * employees see projects they are or were assigned to.
     */
    public boolean canSeeProject(User actor, Project project) {
        return switch (actor.getRole()) {
            case ADMIN -> true;
            case MANAGER -> project.getManagerId().equals(actor.getId());
            case EMPLOYEE -> assignments.everAssigned(project.getId(), actor.getId());
        };
    }

    /** Admins, or the project's own manager. */
    public boolean canManageProject(User actor, Project project) {
        return actor.getRole() == Role.ADMIN
                || (actor.getRole() == Role.MANAGER && project.getManagerId().equals(actor.getId()));
    }

    /** Loads a project the caller may see. Hidden projects look missing (404), not forbidden. */
    public Project requireVisibleProject(User actor, long projectId) {
        Project project = projects.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found."));
        if (!canSeeProject(actor, project)) throw new NotFoundException("Project not found.");
        return project;
    }

    /** Loads a project the caller may change: an admin, or its manager. */
    public Project requireManagedProject(User actor, long projectId) {
        Project project = requireVisibleProject(actor, projectId);
        if (!canManageProject(actor, project)) {
            throw new ForbiddenException("Only this project's manager or an admin can do that.");
        }
        return project;
    }

    /**
     * Only active projects can be changed. Completing a project freezes its details,
     * team and milestones; after that it can only be archived.
     */
    public void requireWritable(Project project) {
        if (project.getStatus() == ProjectStatus.ARCHIVED) {
            throw new BusinessRuleException("Archived projects are read-only.");
        }
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            throw new BusinessRuleException("This project is completed, so it can't be changed. An admin can archive it.");
        }
    }

    /** Employees may only look at their own hours and assignments. */
    public void requireCanSeeUserWork(User actor, long userId) {
        if (actor.getRole() == Role.EMPLOYEE && actor.getId() != userId) {
            throw new ForbiddenException("You can only view your own hours.");
        }
    }
}
