package com.tracker.dto;

import java.time.LocalDate;

/**
 * Admin-only: everything needed to start a project.
 */
public record CreateProjectRequest(
        String title,
        String description,
        Long managerId,
        LocalDate startDate,
        LocalDate predictedEndDate) {}
