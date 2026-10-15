package com.tracker.exception;

/**
 * An error the caller should see, with the HTTP status to send back.
 * The message is shown to the user as-is, so keep it plain.
 */
public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() { return status; }
}
