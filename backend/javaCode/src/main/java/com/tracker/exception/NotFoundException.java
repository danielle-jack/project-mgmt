package com.tracker.exception;

/**
 * Requested record does not exist, or the caller isn't allowed to know it exists (HTTP 404).
 */
public class NotFoundException extends ApiException {
    public NotFoundException(String message) {
        super(404, message);
    }
}
