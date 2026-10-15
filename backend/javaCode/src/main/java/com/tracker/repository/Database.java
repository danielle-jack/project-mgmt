package com.tracker.repository;

import com.tracker.exception.DatabaseException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Opens PostgreSQL connections using the POSTGRES_* environment variables,
 * and gives repositories small helpers for running SQL.
 *
 * One connection is kept per Lambda container and reused across requests.
 * Each request runs in a transaction that the Handler commits or rolls back.
 */
public class Database {

    /** Turns the current row of a ResultSet into an object. */
    @FunctionalInterface
    public interface RowMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    private static final String TOKEN_SECRET_NAME = "token_signing_key";

    private static Connection shared;
    private static boolean schemaReady;
    private static byte[] tokenSecret;

    private final Connection connection;

    public Database(Connection connection) {
        this.connection = connection;
    }

    /**
     * The container's connection, reconnecting if it dropped. The first time,
     * it also runs db/schema.sql, which only creates tables that don't exist yet.
     */
    public static synchronized Connection sharedConnection() throws SQLException {
        if (shared == null || !shared.isValid(2)) {
            loadDriver();
            // On AWS the database pauses when idle and takes up to ~30s to wake up,
            // so wait longer than the driver's default 10s before giving up.
            String url = String.format("jdbc:postgresql://%s:%s/%s?connectTimeout=45&loginTimeout=60",
                    env("POSTGRES_HOST", "localhost"), env("POSTGRES_PORT", "5432"), env("POSTGRES_NAME", ""));
            shared = DriverManager.getConnection(url, env("POSTGRES_USER", ""), env("POSTGRES_PASS", ""));
            shared.setAutoCommit(false);
        }
        if (!schemaReady) {
            try (Statement stmt = shared.createStatement()) {
                stmt.execute(readSchema());
                tokenSecret = loadOrCreateTokenSecret(shared);
                shared.commit();
                schemaReady = true;
            } catch (SQLException e) {
                shared.rollback();
                throw e;
            }
        }
        return shared;
    }

    /** The key login tokens are signed with. Available once sharedConnection() has run. */
    public static synchronized byte[] tokenSecret() {
        if (tokenSecret == null) throw new IllegalStateException("Database.sharedConnection() hasn't run yet");
        return tokenSecret;
    }

    /**
     * The first container to start generates a random key; everyone else reads the same one.
     * It's committed straight away so every Lambda container signs tokens with the same key.
     */
    private static byte[] loadOrCreateTokenSecret(Connection connection) throws SQLException {
        byte[] fresh = new byte[32];
        new SecureRandom().nextBytes(fresh);
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO app_secrets (name, value) VALUES (?, ?) ON CONFLICT (name) DO NOTHING")) {
            insert.setString(1, TOKEN_SECRET_NAME);
            insert.setString(2, Base64.getEncoder().encodeToString(fresh));
            insert.executeUpdate();
        }
        try (PreparedStatement select = connection.prepareStatement("SELECT value FROM app_secrets WHERE name = ?")) {
            select.setString(1, TOKEN_SECRET_NAME);
            try (ResultSet rs = select.executeQuery()) {
                rs.next();
                return Base64.getDecoder().decode(rs.getString(1));
            }
        }
    }

    // -------------------------------------------------------------------------
    // Helpers for repositories. Parameters are bound in order to the ? marks.
    // -------------------------------------------------------------------------

    public <T> List<T> list(String sql, RowMapper<T> mapper, Object... params) {
        try (PreparedStatement stmt = prepare(sql, params); ResultSet rs = stmt.executeQuery()) {
            List<T> rows = new ArrayList<>();
            while (rs.next()) rows.add(mapper.map(rs));
            return rows;
        } catch (SQLException e) {
            throw new DatabaseException(e);
        }
    }

    public <T> Optional<T> one(String sql, RowMapper<T> mapper, Object... params) {
        List<T> rows = list(sql, mapper, params);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /** Runs an INSERT/UPDATE/DELETE and returns how many rows it touched. */
    public int execute(String sql, Object... params) {
        try (PreparedStatement stmt = prepare(sql, params)) {
            return stmt.executeUpdate();
        } catch (SQLException e) {
            throw new DatabaseException(e);
        }
    }

    /** Reads a TIMESTAMPTZ column as an Instant (null stays null). */
    public static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    /** Reads a nullable BIGINT column. */
    public static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private PreparedStatement prepare(String sql, Object... params) throws SQLException {
        PreparedStatement stmt = connection.prepareStatement(sql);
        for (int i = 0; i < params.length; i++) {
            Object value = params[i];
            if (value instanceof Instant instant) value = instant.atOffset(ZoneOffset.UTC);
            if (value instanceof Enum<?> e) value = e.name();
            stmt.setObject(i + 1, value);
        }
        return stmt;
    }

    // The shaded jar drops META-INF/services, so DriverManager can't discover the
    // driver by itself. Loading the class registers it.
    private static void loadDriver() {
        try {
            Class.forName("org.postgresql.Driver");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("PostgreSQL driver is missing from the jar", e);
        }
    }

    private static String readSchema() {
        try (InputStream in = Database.class.getResourceAsStream("/db/schema.sql")) {
            if (in == null) throw new IllegalStateException("db/schema.sql is missing from the jar");
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read db/schema.sql", e);
        }
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value != null ? value : fallback;
    }
}
