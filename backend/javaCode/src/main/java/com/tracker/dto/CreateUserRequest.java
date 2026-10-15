package com.tracker.dto;

import com.tracker.model.Role;

/**
 * Admin-only: name, email, role, managerId (required for employees, ignored otherwise),
 * a temporary password for the admin to share with the new user, and an optional
 * hourly cost rate (employees only; defaults to 0).
 */
public record CreateUserRequest(String name, String email, Role role, Long managerId, String password,
                                Double hourlyRate) {}
