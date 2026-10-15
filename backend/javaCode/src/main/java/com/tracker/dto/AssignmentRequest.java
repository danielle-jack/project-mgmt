package com.tracker.dto;

import java.time.LocalDate;

/**
 * Put an employee on a project, or change an existing assignment.
 * On create, startDate and endDate default to the project's dates.
 * On update, employeeId is ignored and null fields are kept.
 * allowOverAllocation must be true to take the employee past 40 hours/week in total.
 */
public record AssignmentRequest(Long employeeId, Double hoursPerWeek, LocalDate startDate, LocalDate endDate,
                                Boolean allowOverAllocation) {}
