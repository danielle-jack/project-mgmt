package com.tracker.dto;

/**
 * Changing your own password needs currentPassword. An admin resetting someone
 * else's password only sends newPassword (a temporary one to share with them).
 */
public record ChangePasswordRequest(String currentPassword, String newPassword) {}
