package com.tracker.controller;

import com.tracker.dto.CreateProjectRequest;
import com.tracker.dto.ReasonRequest;
import com.tracker.dto.UpdateProjectRequest;
import com.tracker.service.ProjectService;

/**
 * Routes for /projects.
 */
public class ProjectController {
    private final ProjectService projects;

    public ProjectController(ProjectService projects) {
        this.projects = projects;
    }

    public void register(Router router) {
        router.get("/projects", (actor, req, id) -> projects.list(actor));
        router.get("/projects/options", (actor, req, id) -> projects.options(actor));
        router.get("/projects/{id}/chain", (actor, req, id) -> projects.chain(actor, id));
        router.get("/projects/{id}", (actor, req, id) -> projects.get(actor, id));
        router.create("/projects", (actor, req, id) -> projects.create(actor, req.body(CreateProjectRequest.class)));
        router.patch("/projects/{id}",
                (actor, req, id) -> projects.update(actor, id, req.body(UpdateProjectRequest.class)));
        router.post("/projects/{id}/complete", (actor, req, id) -> projects.complete(actor, id));
        router.post("/projects/{id}/archive",
                (actor, req, id) -> projects.archive(actor, id, req.body(ReasonRequest.class).reason()));
    }
}
