package com.tracker.dto;

import com.tracker.model.Role;
import com.tracker.model.User;
import com.tracker.util.WorkWeek;

import java.time.Instant;

/**
 * A user as the people list shows them. allocatedHours is the employee's booked
 * hours per week on active projects (null for admins and managers), so the list
 * doesn't need a separate request per person. overAllocated is true above 40 hours.
 * hourlyRate is only filled in for admins, managers and the user themselves.
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
        boolean overAllocated,
        Double hourlyRate,
        Instant createdAt,
        Instant updatedAt) {

    public static UserSummary of(User u, Double allocatedHours, boolean showRate) {
        boolean over = allocatedHours != null && allocatedHours > WorkWeek.HOURS_PER_WEEK;
        return new UserSummary(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.getManagerId(), u.isActive(),
                u.getDeactivationReason(), u.getPhoto(), allocatedHours, over, showRate ? u.getHourlyRate() : null,
                u.getCreatedAt(), u.getUpdatedAt());
    }
}
