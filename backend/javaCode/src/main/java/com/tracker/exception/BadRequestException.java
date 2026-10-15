package com.tracker.exception;

/**
 * The request is missing something or has a badly formed value (HTTP 400).
 */
public class BadRequestException extends ApiException {
    public BadRequestException(String message) {
        super(400, message);
    }
}
