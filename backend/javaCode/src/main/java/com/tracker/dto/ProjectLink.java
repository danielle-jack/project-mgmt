package com.tracker.dto;

import com.tracker.model.ProjectStatus;

import java.util.List;

/**
 * One project in a dependency chain. direct means it's an immediate neighbour of the
 * project being viewed; canOpen says whether the viewer may open its page. Direct
 * upstream projects also list their milestones, so the viewer can pick them as dependencies.
 */
public record ProjectLink(
        Long id,
        String title,
        ProjectStatus status,
        String managerName,
        int progressPercent,
        boolean direct,
        boolean canOpen,
        List<MilestoneRef> milestones) {}
