package com.tracker.dto;

import com.tracker.model.ProjectStatus;

/**
 * A project offered in the "depends on projects" picker.
 */
public record ProjectOption(Long id, String title, ProjectStatus status, String managerName) {}
