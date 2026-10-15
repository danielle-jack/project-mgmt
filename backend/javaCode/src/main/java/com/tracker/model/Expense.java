package com.tracker.model;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Non-labour money spent on a project (licences, hardware, travel...).
 * Never deleted: a mistake is voided with a reason and stops counting.
 * Maps to the project_expenses table.
 */
public class Expense {
    private Long id;
    private Long projectId;
    private double amount;
    private LocalDate spentOn;
    private String description;
    private boolean active = true;  // false once voided
    private Long createdBy;
    private Instant voidedAt;
    private String voidReason;
    private Instant createdAt;

    public Expense() {}

    public Expense(Long projectId, double amount, LocalDate spentOn, String description) {
        this.projectId = projectId;
        this.amount = amount;
        this.spentOn = spentOn;
        this.description = description;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public LocalDate getSpentOn() { return spentOn; }
    public void setSpentOn(LocalDate spentOn) { this.spentOn = spentOn; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }

    public Instant getVoidedAt() { return voidedAt; }
    public void setVoidedAt(Instant voidedAt) { this.voidedAt = voidedAt; }

    public String getVoidReason() { return voidReason; }
    public void setVoidReason(String voidReason) { this.voidReason = voidReason; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
