package com.tracker.dto;

import com.tracker.model.Milestone;
import com.tracker.model.MilestoneStatus;

import java.time.LocalDate;

/**
 * A milestone as seen from elsewhere: enough to show it as a dependency (possibly in
 * another project) or to offer it in the dependency picker.
 */
public record MilestoneRef(
        Long id,
        Long projectId,
        String projectTitle,
        String title,
        LocalDate startDate,
        LocalDate dueDate,
        MilestoneStatus status,
        int progressPercent) {

    public static MilestoneRef of(Milestone m, String projectTitle) {
        return new MilestoneRef(m.getId(), m.getProjectId(), projectTitle, m.getName(), m.getStartDate(), m.getEndDate(),
                m.getStatus(), m.getProgressPercent());
    }
}
