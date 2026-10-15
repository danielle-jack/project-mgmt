package com.tracker.dto;

import com.tracker.model.Project;
import com.tracker.model.ProjectStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * What the API returns for a project: the stored fields plus calculated ones
 * (manager's name, team size and total planned hours) and the ids of the projects it depends on.
 */
public record ProjectSummary(
        Long id,
        String title,
        String description,
        Long managerId,
        String managerName,
        LocalDate startDate,
        LocalDate predictedEndDate,
        ProjectStatus status,
        Instant completedAt,
        Instant archivedAt,
        String archiveReason,
        List<Long> dependsOn,
        int teamSize,
        double totalHours,
        Instant createdAt,
        Instant updatedAt) {

    public static ProjectSummary of(Project p, String managerName, List<Long> dependsOn, int teamSize, double totalHours) {
        return new ProjectSummary(p.getId(), p.getName(), p.getDescription(), p.getManagerId(), managerName,
                p.getStartDate(), p.getPredictedEndDate(), p.getStatus(), p.getCompletedAt(), p.getArchivedAt(),
                p.getArchiveReason(), dependsOn, teamSize, totalHours, p.getCreatedAt(), p.getUpdatedAt());
    }
}
