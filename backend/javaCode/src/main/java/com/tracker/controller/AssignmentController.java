package com.tracker.controller;

import com.tracker.dto.AssignmentRequest;
import com.tracker.dto.ReasonRequest;
import com.tracker.service.AssignmentService;

/**
 * Routes for /projects/{id}/assignments and /assignments/{id}.
 */
public class AssignmentController {
    private final AssignmentService assignments;

    public AssignmentController(AssignmentService assignments) {
        this.assignments = assignments;
    }

    public void register(Router router) {
        router.get("/projects/{id}/assignments",
                (actor, req, id) -> assignments.listForProject(actor, id, req.flag("includeInactive")));
        router.create("/projects/{id}/assignments",
                (actor, req, id) -> assignments.create(actor, id, req.body(AssignmentRequest.class)));
        router.patch("/assignments/{id}",
                (actor, req, id) -> assignments.update(actor, id, req.body(AssignmentRequest.class)));
        router.post("/assignments/{id}/deactivate",
                (actor, req, id) -> assignments.deactivate(actor, id, req.body(ReasonRequest.class).reason()));
    }
}
