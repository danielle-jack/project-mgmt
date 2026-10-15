package com.tracker.dto;

/**
 * The only fields an employee may change about themselves. Leave a field null to keep it.
 */
public record UpdateProfileRequest(String name, String email) {}
