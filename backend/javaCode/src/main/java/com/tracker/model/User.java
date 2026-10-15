package com.tracker.model;

import java.time.Instant;

/**
 * Anyone who can log in. Never deleted; deactivated via an active flag.
 * Employees reference exactly one manager.
 */
public class User {
    private Long id;               // null until saved to the database
    private String name;
    private String email;
    private Role role;
    private Long managerId;        // the one manager this employee reports to; only an admin may change it
    private boolean active = true;
    private String deactivationReason; // why an admin deactivated them; cleared on reactivation
    private String photo;              // small profile photo as a data URL, or null for initials
    private double hourlyRate;         // cost per hour, used for project labour cost; set by admins
    private Instant createdAt;
    private Instant updatedAt;

    public User() {}

    public User(String name, String email, Role role) {
        this.name = name;
        this.email = email;
        this.role = role;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public Long getManagerId() { return managerId; }
    public void setManagerId(Long managerId) { this.managerId = managerId; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getDeactivationReason() { return deactivationReason; }
    public void setDeactivationReason(String deactivationReason) { this.deactivationReason = deactivationReason; }

    public String getPhoto() { return photo; }
    public void setPhoto(String photo) { this.photo = photo; }

    public double getHourlyRate() { return hourlyRate; }
    public void setHourlyRate(double hourlyRate) { this.hourlyRate = hourlyRate; }
}
