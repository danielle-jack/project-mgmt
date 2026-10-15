package com.tracker.dto;

import com.tracker.model.Role;
import com.tracker.model.User;

import java.time.Instant;

/**
 * A user as the people list shows them. allocatedHours is the employee's booked
 * hours per week on active projects (null for admins and managers), so the list
 * doesn't need a separate request per person.
 */
public record UserSummary(
        Long id,
        String name,
        String email,
        Role role,
        Long managerId,
        boolean active,
        String deactivationReason,
        String photo,
        Double allocatedHours,
        Instant createdAt,
        Instant updatedAt) {

    public static UserSummary of(User u, Double allocatedHours) {
        return new UserSummary(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.getManagerId(), u.isActive(),
                u.getDeactivationReason(), u.getPhoto(), allocatedHours, u.getCreatedAt(), u.getUpdatedAt());
    }
}
