package com.tracker.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Project fields that can be changed. Leave a field null to keep it.
 * Managers may change everything except managerId on their own projects;
 * only admins may hand a project to another manager.
 * dependsOn replaces the full list of projects this one depends on.
 */
public record UpdateProjectRequest(
        String title,
        String description,
        LocalDate predictedEndDate,
        LocalDate startDate,
        Long managerId,
        List<Long> dependsOn) {}
