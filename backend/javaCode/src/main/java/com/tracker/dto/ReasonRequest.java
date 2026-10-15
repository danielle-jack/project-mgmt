package com.tracker.dto;

/**
 * Why something is being "deleted": deactivating a user, archiving a project,
 * or removing someone from a team. Required, so the history explains itself.
 */
public record ReasonRequest(String reason) {}
