package com.tracker.dto;

import com.tracker.model.Role;

/**
 * Admin-only: name, email, role, managerId (required for employees, ignored otherwise),
 * and a temporary password for the admin to share with the new user.
 */
public record CreateUserRequest(String name, String email, Role role, Long managerId, String password) {}
