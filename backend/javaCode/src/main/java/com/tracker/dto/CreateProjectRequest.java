package com.tracker.dto;

import java.time.LocalDate;

/**
 * Admin-only: everything needed to start a project. plannedBudget defaults to 0.
 */
public record CreateProjectRequest(
        String title,
        String description,
        Long managerId,
        LocalDate startDate,
        LocalDate predictedEndDate,
        Double plannedBudget) {}
