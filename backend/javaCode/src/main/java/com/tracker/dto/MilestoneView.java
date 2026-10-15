package com.tracker.dto;

import com.tracker.model.Milestone;
import com.tracker.model.MilestoneStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * What the API returns for a milestone. dependsOn lists the ids it depends on, and
 * dependencies describes them (they can be in other projects); dateConflicts lists the
 * unfinished ones that are due after this milestone is.
 */
public record MilestoneView(
        Long id,
        Long projectId,
        String title,
        String description,
        LocalDate startDate,
        LocalDate dueDate,
        MilestoneStatus status,
        int progressPercent,
        List<Long> dependsOn,
        List<MilestoneRef> dependencies,
        List<Long> dateConflicts,
        Instant completedAt,
        Long createdBy,
        Instant createdAt,
        Instant updatedAt) {

    public static MilestoneView of(Milestone m, List<MilestoneRef> dependencies, List<Long> dateConflicts) {
        return new MilestoneView(m.getId(), m.getProjectId(), m.getName(), m.getDescription(), m.getStartDate(),
                m.getEndDate(), m.getStatus(), m.getProgressPercent(),
                m.getDependsOnMilestoneIds().stream().sorted().toList(), dependencies, dateConflicts,
                m.getCompletedAt(), m.getCreatedById(), m.getCreatedAt(), m.getUpdatedAt());
    }
}
