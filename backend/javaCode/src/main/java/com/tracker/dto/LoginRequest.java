package com.tracker.dto;

/**
 * Log in with email and password.
 */
public record LoginRequest(String email, String password) {}
