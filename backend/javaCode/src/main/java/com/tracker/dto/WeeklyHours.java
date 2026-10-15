package com.tracker.dto;

/**
 * An employee's planned hours per week across all active assignments, and what's left of 40.
 */
public record WeeklyHours(Long employeeId, double allocatedHours, double availableHours) {}
