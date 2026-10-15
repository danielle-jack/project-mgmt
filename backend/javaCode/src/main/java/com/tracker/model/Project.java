package com.tracker.model;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Has exactly one manager, a start date and a predicted end date.
 * Total hours and money spent are calculated from assignments and expenses, never stored.
 */
public class Project {
    private Long id;
    private String name;
    private String description;
    private Long managerId;              // required: every project has exactly one manager
    private LocalDate startDate;
    private LocalDate predictedEndDate;  // used together with startDate to plan employee hours
    private ProjectStatus status = ProjectStatus.ACTIVE;
    private Instant completedAt;         // set when the manager marks it COMPLETED
    private Instant archivedAt;          // set when an admin archives it
    private String archiveReason;        // why it was archived
    private double plannedBudget;        // total money planned for labour + expenses
    private Instant createdAt;
    private Instant updatedAt;

    public Project() {}

    public Project(String name, Long managerId, LocalDate startDate, LocalDate predictedEndDate) {
        this.name = name;
        this.managerId = managerId;
        this.startDate = startDate;
        this.predictedEndDate = predictedEndDate;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getManagerId() { return managerId; }
    public void setManagerId(Long managerId) { this.managerId = managerId; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getPredictedEndDate() { return predictedEndDate; }
    public void setPredictedEndDate(LocalDate predictedEndDate) { this.predictedEndDate = predictedEndDate; }

    public ProjectStatus getStatus() { return status; }
    public void setStatus(ProjectStatus status) { this.status = status; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getArchiveReason() { return archiveReason; }
    public void setArchiveReason(String archiveReason) { this.archiveReason = archiveReason; }

    public double getPlannedBudget() { return plannedBudget; }
    public void setPlannedBudget(double plannedBudget) { this.plannedBudget = plannedBudget; }
}

