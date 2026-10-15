package com.tracker.dto;

/**
 * Admin-only: the new manager for an employee.
 */
public record ChangeManagerRequest(Long managerId) {}
