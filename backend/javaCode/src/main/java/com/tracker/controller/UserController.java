package com.tracker.controller;

import com.tracker.dto.ChangeManagerRequest;
import com.tracker.dto.ChangePasswordRequest;
import com.tracker.dto.CreateUserRequest;
import com.tracker.dto.HourlyRateRequest;
import com.tracker.dto.LoginRequest;
import com.tracker.dto.PhotoRequest;
import com.tracker.dto.ReasonRequest;
import com.tracker.dto.UpdateProfileRequest;
import com.tracker.service.AssignmentService;
import com.tracker.service.UserService;

/**
 * Routes for /users, plus /auth/login.
 */
public class UserController {
    private final UserService users;
    private final AssignmentService assignments;

    public UserController(UserService users, AssignmentService assignments) {
        this.users = users;
        this.assignments = assignments;
    }

    public void register(Router router) {
        router.publicPost("/auth/login", (actor, req, id) -> users.login(req.body(LoginRequest.class)));
        router.get("/users/me", (actor, req, id) -> actor);
        router.get("/users", (actor, req, id) -> users.list(actor));
        router.get("/users/{id}", (actor, req, id) -> users.get(actor, id));
        router.create("/users", (actor, req, id) -> users.create(actor, req.body(CreateUserRequest.class)));
        router.patch("/users/{id}/profile",
                (actor, req, id) -> users.updateProfile(actor, id, req.body(UpdateProfileRequest.class)));
        router.patch("/users/{id}/password",
                (actor, req, id) -> users.changePassword(actor, id, req.body(ChangePasswordRequest.class)));
        router.patch("/users/{id}/manager",
                (actor, req, id) -> users.changeManager(actor, id, req.body(ChangeManagerRequest.class).managerId()));
        router.post("/users/{id}/deactivate",
                (actor, req, id) -> users.deactivate(actor, id, req.body(ReasonRequest.class).reason()));
        router.patch("/users/{id}/rate",
                (actor, req, id) -> users.setHourlyRate(actor, id, req.body(HourlyRateRequest.class).hourlyRate()));
        router.put("/users/{id}/photo", (actor, req, id) -> users.setPhoto(actor, id, req.body(PhotoRequest.class).photo()));
        router.post("/users/{id}/reactivate", (actor, req, id) -> users.reactivate(actor, id));
        router.get("/users/{id}/hours", (actor, req, id) -> assignments.weeklyHours(actor, id));
        router.get("/users/{id}/assignments", (actor, req, id) -> assignments.listForEmployee(actor, id));
    }
}
