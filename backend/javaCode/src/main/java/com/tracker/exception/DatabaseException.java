package com.tracker.exception;

import java.sql.SQLException;

/**
 * Wraps a SQLException so repository methods don't need "throws SQLException".
 * App turns known SQL states (e.g. a duplicate email) into friendly errors.
 */
public class DatabaseException extends RuntimeException {
    public DatabaseException(SQLException cause) {
        super(cause.getMessage(), cause);
    }

    public String getSqlState() {
        return ((SQLException) getCause()).getSQLState();
    }
}
