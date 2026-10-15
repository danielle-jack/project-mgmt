package com.tracker.dto;

import com.tracker.model.Assignment;

import java.time.Instant;
import java.time.LocalDate;

/**
 * What the API returns for an assignment. Adds the employee's name (so teammates
 * can be shown without access to the user list) and, when listing one employee's
 * work, the project's title.
 */
public record AssignmentView(
        Long id,
        Long projectId,
        String projectTitle,
        Long employeeId,
        String employeeName,
        double hoursPerWeek,
        LocalDate startDate,
        LocalDate endDate,
        boolean active,
        Long assignedBy,
        Instant deactivatedAt,
        String removalReason,
        Instant createdAt,
        Instant updatedAt) {

    public static AssignmentView of(Assignment a, String employeeName, String projectTitle) {
        return new AssignmentView(a.getId(), a.getProjectId(), projectTitle, a.getEmployeeId(), employeeName,
                a.getHoursPerWeek(), a.getStartDate(), a.getEndDate(), a.isActive(), a.getAssignedBy(),
                a.getDeactivatedAt(), a.getRemovalReason(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
