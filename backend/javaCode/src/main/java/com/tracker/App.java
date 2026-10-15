package com.tracker;

import com.tracker.controller.ApiRequest;
import com.tracker.controller.ApiResponse;
import com.tracker.controller.AssignmentController;
import com.tracker.controller.AuditController;
import com.tracker.controller.MilestoneController;
import com.tracker.controller.ProjectController;
import com.tracker.controller.Router;
import com.tracker.controller.UserController;
import com.tracker.exception.ApiException;
import com.tracker.exception.DatabaseException;
import com.tracker.repository.AssignmentRepository;
import com.tracker.repository.AuditLogRepository;
import com.tracker.repository.Database;
import com.tracker.repository.MilestoneRepository;
import com.tracker.repository.ProjectRepository;
import com.tracker.repository.UserRepository;
import com.tracker.security.AccessPolicy;
import com.tracker.security.CurrentUser;
import com.tracker.security.Tokens;
import com.tracker.service.AssignmentService;
import com.tracker.service.AuditService;
import com.tracker.service.HoursCalculator;
import com.tracker.service.MilestoneService;
import com.tracker.service.ProjectService;
import com.tracker.service.UserService;

/**
 * Wires repositories, services and controllers together for one request,
 * and turns any exception into an error response.
 */
public class App {
    private final Router router = new Router();
    private final UserRepository users;
    private final Tokens tokens;

    public App(Database db) {
        users = new UserRepository(db);
        tokens = new Tokens(Database.tokenSecret());
        ProjectRepository projects = new ProjectRepository(db);
        AssignmentRepository assignments = new AssignmentRepository(db);
        MilestoneRepository milestones = new MilestoneRepository(db);

        AccessPolicy access = new AccessPolicy(projects, assignments);
        AuditService audit = new AuditService(new AuditLogRepository(db), access);
        UserService userService = new UserService(users, projects, assignments, access, tokens, audit);
        AssignmentService assignmentService = new AssignmentService(assignments, projects, users, access, audit);
        ProjectService projectService = new ProjectService(
                projects, assignments, milestones, users, userService, new HoursCalculator(), access, audit);
        MilestoneService milestoneService = new MilestoneService(milestones, projects, access, audit);

        new UserController(userService, assignmentService).register(router);
        new ProjectController(projectService).register(router);
        new AssignmentController(assignmentService).register(router);
        new MilestoneController(milestoneService).register(router);
        new AuditController(audit).register(router);
    }

    public ApiResponse handle(ApiRequest request) {
        try {
            return router.dispatch(request, () -> CurrentUser.resolve(request.headers(), users, tokens));
        } catch (ApiException e) {
            return ApiResponse.error(e.getStatus(), e.getMessage());
        } catch (DatabaseException e) {
            return fromDatabaseError(e);
        } catch (RuntimeException e) {
            e.printStackTrace();
            return ApiResponse.error(500, "Something went wrong on the server.");
        }
    }

    /** Database rules are the last line of defence; most are checked earlier by the services. */
    private static ApiResponse fromDatabaseError(DatabaseException e) {
        return switch (String.valueOf(e.getSqlState())) {
            case "23505" -> ApiResponse.error(409, "That would create a duplicate record.");
            case "23514", "23502" -> ApiResponse.error(400, "That value isn't allowed.");
            case "23503" -> ApiResponse.error(409, "That refers to a record that doesn't exist.");
            default -> {
                e.printStackTrace();
                yield ApiResponse.error(500, "Something went wrong on the server.");
            }
        };
    }
}
