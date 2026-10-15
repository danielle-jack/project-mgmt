package com.tracker.dto;

import com.tracker.model.MilestoneStatus;

import java.time.LocalDate;
import java.util.List;

/**
 * Create or change a milestone. On update, null fields are kept.
 * status and progressPercent are ignored on create (new milestones start NOT_STARTED at 0%).
 * dependsOn replaces the full list of milestones this one depends on.
 */
public record MilestoneRequest(
        String title,
        String description,
        LocalDate startDate,
        LocalDate dueDate,
        MilestoneStatus status,
        Integer progressPercent,
        List<Long> dependsOn) {}
