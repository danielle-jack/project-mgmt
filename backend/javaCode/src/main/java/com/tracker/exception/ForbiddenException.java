package com.tracker.exception;

/**
 * Caller's role or ownership does not permit the action (HTTP 403).
 */
public class ForbiddenException extends ApiException {
    public ForbiddenException(String message) {
        super(403, message);
    }
}
