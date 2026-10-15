package com.tracker.dto;

import java.time.LocalDate;

/**
 * Log money spent on a project. spentOn defaults to today and can't be in the future.
 */
public record ExpenseRequest(Double amount, LocalDate spentOn, String description) {}
