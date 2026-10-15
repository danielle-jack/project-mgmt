package com.tracker.exception;

/**
 * No logged-in user, or the user is deactivated (HTTP 401).
 */
public class UnauthorizedException extends ApiException {
    public UnauthorizedException(String message) {
        super(401, message);
    }
}
