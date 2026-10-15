package com.tracker.controller;

import com.tracker.dto.ExpenseRequest;
import com.tracker.dto.ReasonRequest;
import com.tracker.service.ExpenseService;

/**
 * Routes for /projects/{id}/expenses and /expenses/{id}.
 */
public class ExpenseController {
    private final ExpenseService expenses;

    public ExpenseController(ExpenseService expenses) {
        this.expenses = expenses;
    }

    public void register(Router router) {
        router.get("/projects/{id}/expenses", (actor, req, id) -> expenses.listForProject(actor, id));
        router.create("/projects/{id}/expenses",
                (actor, req, id) -> expenses.create(actor, id, req.body(ExpenseRequest.class)));
        router.post("/expenses/{id}/void",
                (actor, req, id) -> expenses.voidExpense(actor, id, req.body(ReasonRequest.class).reason()));
    }
}
