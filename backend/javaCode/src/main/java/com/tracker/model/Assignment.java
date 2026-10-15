package com.tracker.model;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One employee working on one project, for a set number of hours per week.
 * A project's team is the set of its active assignments; there is no separate team.
 * Maps to the project_assignments table.
 *
 * Assignments are never deleted. Removing someone from a team sets active = false.
 */
public class Assignment {
    private Long id;               // null until saved to the database
    private Long projectId;
    private Long employeeId;
    private double hoursPerWeek;   // planned, not logged; an employee's active total can't exceed 40
    private LocalDate startDate;   // defaults to the project's start date
    private LocalDate endDate;     // defaults to the project's predicted end date
    private boolean active = true;
    private Long assignedBy;       // the manager (or admin) who made the assignment
    private Instant deactivatedAt; // set when the employee is removed from the team
    private String removalReason;  // why they were removed
    private Instant createdAt;
    private Instant updatedAt;

    public Assignment() {}

    public Assignment(Long projectId, Long employeeId, double hoursPerWeek,
                      LocalDate startDate, LocalDate endDate) {
        this.projectId = projectId;
        this.employeeId = employeeId;
        this.hoursPerWeek = hoursPerWeek;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }

    public double getHoursPerWeek() { return hoursPerWeek; }
    public void setHoursPerWeek(double hoursPerWeek) { this.hoursPerWeek = hoursPerWeek; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Long getAssignedBy() { return assignedBy; }
    public void setAssignedBy(Long assignedBy) { this.assignedBy = assignedBy; }

    public Instant getDeactivatedAt() { return deactivatedAt; }
    public void setDeactivatedAt(Instant deactivatedAt) { this.deactivatedAt = deactivatedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getRemovalReason() { return removalReason; }
    public void setRemovalReason(String removalReason) { this.removalReason = removalReason; }
}
