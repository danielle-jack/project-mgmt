package com.tracker.repository;

import com.tracker.model.Role;
import com.tracker.model.User;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * SQL for users. No delete method: users are deactivated.
 */
public class UserRepository {
    private static final String COLUMNS =
            "user_id, name, email, role, manager_id, active, deactivation_reason, photo, created_at, updated_at";

    private final Database db;

    public UserRepository(Database db) {
        this.db = db;
    }

    public Optional<User> findById(long id) {
        return db.one("SELECT " + COLUMNS + " FROM users WHERE user_id = ?", UserRepository::map, id);
    }

    public Optional<User> findByEmail(String email) {
        return db.one("SELECT " + COLUMNS + " FROM users WHERE email = ?", UserRepository::map, email);
    }

    /**
     * Same as findById, but locks the row until the request's transaction ends.
     * Used before changing an employee's hours so two requests can't both pass the 40-hour check.
     */
    public Optional<User> lockById(long id) {
        return db.one("SELECT " + COLUMNS + " FROM users WHERE user_id = ? FOR UPDATE", UserRepository::map, id);
    }

    public List<User> findAll() {
        return db.list("SELECT " + COLUMNS + " FROM users ORDER BY name", UserRepository::map);
    }

    public boolean emailTaken(String email, Long exceptUserId) {
        return db.one("SELECT 1 FROM users WHERE email = ? AND user_id IS DISTINCT FROM ?",
                rs -> true, email, exceptUserId).isPresent();
    }

    public int countActiveEmployeesOf(long managerId) {
        return db.one("SELECT COUNT(*) FROM users WHERE manager_id = ? AND active",
                rs -> rs.getInt(1), managerId).orElse(0);
    }

    /** Saves a new user and fills in its id and timestamps. */
    public User insert(User user, Long createdBy, String passwordHash) {
        return db.one("""
                INSERT INTO users (name, email, role, manager_id, active, created_by, password_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING\s""" + COLUMNS,
                UserRepository::map,
                user.getName(), user.getEmail(), user.getRole(), user.getManagerId(), user.isActive(), createdBy,
                passwordHash)
                .orElseThrow();
    }

    // The password hash is read and written separately and never put on the User
    // model, so it can't end up in an API response by accident.

    public Optional<String> findPasswordHash(long id) {
        return db.one("SELECT password_hash FROM users WHERE user_id = ?", rs -> rs.getString(1), id);
    }

    public void setPasswordHash(long id, String passwordHash) {
        db.execute("UPDATE users SET password_hash = ?, updated_at = now() WHERE user_id = ?", passwordHash, id);
    }

    /** Sets or clears (null) the profile photo. */
    public void setPhoto(long id, String photo) {
        db.execute("UPDATE users SET photo = ?, updated_at = now() WHERE user_id = ?", photo, id);
    }

    /** True once any admin exists (active or not). Used to allow creating the very first one. */
    public boolean anyAdmin() {
        return db.one("SELECT 1 FROM users WHERE role = 'ADMIN' LIMIT 1", rs -> true).isPresent();
    }

    /** Saves name, email, manager, active flag and deactivation reason. */
    public User update(User user) {
        return db.one("""
                UPDATE users
                SET name = ?, email = ?, manager_id = ?, active = ?, deactivation_reason = ?, updated_at = now()
                WHERE user_id = ?
                RETURNING\s""" + COLUMNS,
                UserRepository::map,
                user.getName(), user.getEmail(), user.getManagerId(), user.isActive(), user.getDeactivationReason(),
                user.getId())
                .orElseThrow();
    }

    private static User map(ResultSet rs) throws SQLException {
        User user = new User(rs.getString("name"), rs.getString("email"), Role.valueOf(rs.getString("role")));
        user.setId(rs.getLong("user_id"));
        user.setManagerId(Database.nullableLong(rs, "manager_id"));
        user.setActive(rs.getBoolean("active"));
        user.setDeactivationReason(rs.getString("deactivation_reason"));
        user.setPhoto(rs.getString("photo"));
        user.setCreatedAt(Database.instant(rs, "created_at"));
        user.setUpdatedAt(Database.instant(rs, "updated_at"));
        return user;
    }
}
