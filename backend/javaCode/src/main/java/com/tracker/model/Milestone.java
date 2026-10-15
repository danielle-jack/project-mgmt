package com.tracker.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

/**
 * An important deliverable inside a project, with its own dates.
 * Dates can be changed even while IN_PROGRESS.
 * A milestone can depend on other milestones in the same project.
 */
public class Milestone {
    private Long id;
    private Long projectId;
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;                     // the due date
    private MilestoneStatus status = MilestoneStatus.NOT_STARTED;
    private int progressPercent;                   // 0 to 100
    private Set<Long> dependsOnMilestoneIds = new HashSet<>(); // milestones that must finish first
    private Long createdById;                      // the manager who created it
    private Instant completedAt;
    private Instant createdAt;
    private Instant updatedAt;

    public Milestone() {}

    public Milestone(Long projectId, String name, LocalDate startDate, LocalDate endDate) {
        this.projectId = projectId;
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public MilestoneStatus getStatus() { return status; }
    public void setStatus(MilestoneStatus status) { this.status = status; }

    public int getProgressPercent() { return progressPercent; }
    public void setProgressPercent(int progressPercent) { this.progressPercent = progressPercent; }

    public Set<Long> getDependsOnMilestoneIds() { return dependsOnMilestoneIds; }
    public void setDependsOnMilestoneIds(Set<Long> ids) { this.dependsOnMilestoneIds = ids; }

    public Long getCreatedById() { return createdById; }
    public void setCreatedById(Long createdById) { this.createdById = createdById; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
