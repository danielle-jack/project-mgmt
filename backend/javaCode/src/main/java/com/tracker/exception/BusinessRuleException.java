package com.tracker.exception;

/**
 * A business rule was violated, e.g. over 40 hours or a milestone loop (HTTP 409).
 */
public class BusinessRuleException extends ApiException {
    public BusinessRuleException(String message) {
        super(409, message);
    }
}
