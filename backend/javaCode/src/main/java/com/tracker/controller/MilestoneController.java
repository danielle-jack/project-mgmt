package com.tracker.controller;

import com.tracker.dto.MilestoneRequest;
import com.tracker.service.MilestoneService;

/**
 * Routes for /projects/{id}/milestones and /milestones/{id}.
 */
public class MilestoneController {
    private final MilestoneService milestones;

    public MilestoneController(MilestoneService milestones) {
        this.milestones = milestones;
    }

    public void register(Router router) {
        router.get("/projects/{id}/milestones", (actor, req, id) -> milestones.list(actor, id));
        router.create("/projects/{id}/milestones",
                (actor, req, id) -> milestones.create(actor, id, req.body(MilestoneRequest.class)));
        router.patch("/milestones/{id}",
                (actor, req, id) -> milestones.update(actor, id, req.body(MilestoneRequest.class)));
    }
}
