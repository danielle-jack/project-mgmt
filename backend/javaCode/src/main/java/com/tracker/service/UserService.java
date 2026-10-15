package com.tracker.service;

import com.tracker.dto.ChangePasswordRequest;
import com.tracker.dto.CreateUserRequest;
import com.tracker.dto.LoginRequest;
import com.tracker.dto.LoginResponse;
import com.tracker.dto.UpdateProfileRequest;
import com.tracker.dto.UserSummary;
import com.tracker.exception.BadRequestException;
import com.tracker.exception.BusinessRuleException;
import com.tracker.exception.ForbiddenException;
import com.tracker.exception.NotFoundException;
import com.tracker.exception.UnauthorizedException;
import com.tracker.model.Role;
import com.tracker.model.User;
import com.tracker.repository.AssignmentRepository;
import com.tracker.repository.ProjectRepository;
import com.tracker.repository.UserRepository;
import com.tracker.security.AccessPolicy;
import com.tracker.security.Passwords;
import com.tracker.security.Tokens;
import com.tracker.util.Validate;

import java.util.List;
import java.util.Map;

import static com.tracker.service.AuditService.details;

/**
 * Logging in, and managing people.
 * Admins create users (with a temporary password) and move employees between managers.
 * Employees update only their own name, email and password. Deactivate, never delete.
 */
public class UserService {
    private final UserRepository users;
    private final ProjectRepository projects;
    private final AssignmentRepository assignments;
    private final AccessPolicy access;
    private final Tokens tokens;
    private final AuditService audit;

    public UserService(UserRepository users, ProjectRepository projects, AssignmentRepository assignments,
                       AccessPolicy access, Tokens tokens, AuditService audit) {
        this.users = users;
        this.projects = projects;
        this.assignments = assignments;
        this.access = access;
        this.tokens = tokens;
        this.audit = audit;
    }

    /**
     * Checks the email and password and hands back a login token.
     * Every failure (unknown email, wrong password, deactivated account) gets the same
     * message, so the login form can't be used to discover who has an account.
     */
    public LoginResponse login(LoginRequest req) {
        String email = Validate.email(req.email());
        String password = Validate.text(req.password(), "Password");

        User user = users.findByEmail(email).orElse(null);
        String hash = user == null ? null : users.findPasswordHash(user.getId()).orElse(null);
        boolean ok = Passwords.matches(password, hash);
        if (!ok || !user.isActive()) throw new UnauthorizedException("Email or password is incorrect.");

        return new LoginResponse(tokens.issue(user.getId()), user);
    }

    /**
     * Anyone can change their own password by giving the current one.
     * Admins can reset anyone else's to a new temporary password.
     */
    public User changePassword(User actor, long id, ChangePasswordRequest req) {
        String newPassword = Validate.password(req.newPassword());
        User user = find(id);

        if (actor.getId() == id) {
            String current = users.findPasswordHash(id).orElse(null);
            if (!Passwords.matches(req.currentPassword(), current)) {
                throw new BadRequestException("Your current password is incorrect.");
            }
        } else if (actor.getRole() != Role.ADMIN) {
            throw new ForbiddenException("You can only change your own password.");
        }

        users.setPasswordHash(id, Passwords.hash(newPassword));
        audit.record(actor, actor.getId() == id ? "CHANGE_OWN_PASSWORD" : "RESET_PASSWORD", "USER", id, details());
        return user;
    }

    /**
     * Admins and managers see everyone (managers need this to build teams).
     * Employees see themselves and their manager. Employees come with their booked hours.
     */
    public List<UserSummary> list(User actor) {
        List<User> visible;
        if (actor.getRole() == Role.EMPLOYEE) {
            visible = actor.getManagerId() == null ? List.of(actor)
                    : List.of(actor, find(actor.getManagerId()));
        } else {
            visible = users.findAll();
        }
        Map<Long, Double> booked = assignments.bookedHoursByEmployee();
        return visible.stream()
                .map(u -> UserSummary.of(u, u.getRole() == Role.EMPLOYEE ? booked.getOrDefault(u.getId(), 0.0) : null))
                .toList();
    }

    /** Employees may view themselves and their own manager. */
    public User get(User actor, long id) {
        if (actor.getRole() == Role.EMPLOYEE && actor.getId() != id && !Long.valueOf(id).equals(actor.getManagerId())) {
            throw new ForbiddenException("Employees can only view themselves and their manager.");
        }
        return find(id);
    }

    public User create(User actor, CreateUserRequest req) {
        access.requireAdmin(actor, "Only admins can create users.");

        String name = Validate.text(req.name(), "Name");
        String email = uniqueEmail(req.email(), null);
        String password = Validate.password(req.password());
        if (req.role() == null) throw new BadRequestException("Role must be one of ADMIN, MANAGER, EMPLOYEE.");

        User user = new User(name, email, req.role());
        if (req.role() == Role.EMPLOYEE) {
            if (req.managerId() == null) throw new BadRequestException("Every employee needs a manager.");
            user.setManagerId(requireActiveManager(req.managerId()).getId());
        }
        User saved = users.insert(user, actor.getId(), Passwords.hash(password));
        audit.record(actor, "CREATE_USER", "USER", saved.getId(), details(
                "name", saved.getName(), "email", saved.getEmail(), "role", saved.getRole(),
                "managerId", saved.getManagerId()));
        return saved;
    }

    /** Anyone may change their own name and email; admins may change anyone's. */
    public User updateProfile(User actor, long id, UpdateProfileRequest req) {
        if (actor.getRole() != Role.ADMIN && actor.getId() != id) {
            throw new ForbiddenException("You can only edit your own profile.");
        }
        User user = find(id);
        if (req.name() != null) user.setName(Validate.text(req.name(), "Name"));
        if (req.email() != null) user.setEmail(uniqueEmail(req.email(), id));
        User saved = users.update(user);
        audit.record(actor, "UPDATE_PROFILE", "USER", id, details("name", req.name(), "email", req.email()));
        return saved;
    }

    public User changeManager(User actor, long id, Long managerId) {
        access.requireAdmin(actor, "Only admins can move an employee to a different manager.");
        User user = find(id);
        if (user.getRole() != Role.EMPLOYEE) throw new BusinessRuleException("Only employees have a manager.");

        Long previousManagerId = user.getManagerId();
        user.setManagerId(requireActiveManager(Validate.required(managerId, "Manager")).getId());
        User saved = users.update(user);
        audit.record(actor, "MOVE_EMPLOYEE", "USER", id,
                details("fromManagerId", previousManagerId, "toManagerId", saved.getManagerId()));
        return saved;
    }

    /**
     * Users are never deleted. A manager can only be deactivated once their employees and
     * projects have moved to someone else. A deactivated employee is taken off every team,
     * which frees up their hours.
     */
    public User deactivate(User actor, long id, String reasonText) {
        access.requireAdmin(actor, "Only admins can deactivate users.");
        String reason = Validate.reason(reasonText);
        if (actor.getId() == id) throw new BusinessRuleException("You can't deactivate yourself.");
        User user = find(id);

        if (user.getRole() == Role.MANAGER) {
            if (users.countActiveEmployeesOf(id) > 0) {
                throw new BusinessRuleException("Move this manager's employees to another manager first.");
            }
            if (projects.countUnarchivedForManager(id) > 0) {
                throw new BusinessRuleException("Give this manager's projects to another manager first.");
            }
        }

        assignments.deactivateAllForEmployee(id, "Deactivated: " + reason);
        user.setActive(false);
        user.setDeactivationReason(reason);
        User saved = users.update(user);
        audit.record(actor, "DEACTIVATE_USER", "USER", id, details("name", saved.getName(), "reason", reason));
        return saved;
    }

    public User reactivate(User actor, long id) {
        access.requireAdmin(actor, "Only admins can reactivate users.");
        User user = find(id);
        if (user.getRole() == Role.EMPLOYEE) requireActiveManager(user.getManagerId());

        user.setActive(true);
        user.setDeactivationReason(null);
        User saved = users.update(user);
        audit.record(actor, "REACTIVATE_USER", "USER", id, details("name", saved.getName()));
        return saved;
    }

    /** Set or remove (null) a profile photo. Your own, or anyone's if you're an admin. */
    public User setPhoto(User actor, long id, String photo) {
        if (actor.getRole() != Role.ADMIN && actor.getId() != id) {
            throw new ForbiddenException("You can only change your own photo.");
        }
        User user = find(id);
        String checked = Validate.photo(photo);
        users.setPhoto(id, checked);
        audit.record(actor, checked == null ? "REMOVE_PHOTO" : "SET_PHOTO", "USER", id, details("name", user.getName()));
        return find(id);
    }

    /** Used wherever a manager is chosen: for an employee, or for a project. */
    public User requireActiveManager(long managerId) {
        return users.findById(managerId)
                .filter(u -> u.getRole() == Role.MANAGER && u.isActive())
                .orElseThrow(() -> new BusinessRuleException(
                        "The manager must be an active user with the Manager role."));
    }

    User find(long id) {
        return users.findById(id).orElseThrow(() -> new NotFoundException("User not found."));
    }

    private String uniqueEmail(String value, Long ownUserId) {
        String email = Validate.email(value);
        if (users.emailTaken(email, ownUserId)) {
            throw new BusinessRuleException("Another user already has that email.");
        }
        return email;
    }
}
