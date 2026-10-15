package com.tracker.dto;

/**
 * A profile photo as a small image data URL ("data:image/jpeg;base64,..."), or null to remove it.
 */
public record PhotoRequest(String photo) {}
