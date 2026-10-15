package com.tracker.service;

import com.tracker.dto.ExpenseRequest;
import com.tracker.exception.BadRequestException;
import com.tracker.exception.BusinessRuleException;
import com.tracker.exception.NotFoundException;
import com.tracker.model.Expense;
import com.tracker.model.Project;
import com.tracker.model.User;
import com.tracker.repository.ExpenseRepository;
import com.tracker.security.AccessPolicy;
import com.tracker.util.Validate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static com.tracker.service.AuditService.details;

/**
 * Non-labour spending on a project. Only admins and the project's manager can see,
 * log or void expenses. Expenses are never deleted; voiding keeps the row and the reason.
 */
public class ExpenseService {
    private final ExpenseRepository expenses;
    private final AccessPolicy access;
    private final AuditService audit;

    public ExpenseService(ExpenseRepository expenses, AccessPolicy access, AuditService audit) {
        this.expenses = expenses;
        this.access = access;
        this.audit = audit;
    }

    public List<Expense> listForProject(User actor, long projectId) {
        access.requireManagedProject(actor, projectId);
        return expenses.findByProject(projectId);
    }

    public Expense create(User actor, long projectId, ExpenseRequest req) {
        Project project = access.requireManagedProject(actor, projectId);
        access.requireWritable(project);

        double amount = Validate.money(req.amount(), "Amount");
        if (amount == 0) throw new BadRequestException("Amount must be more than 0.");
        String description = Validate.text(req.description(), "Description");
        if (description.length() > 200) throw new BadRequestException("Keep the description under 200 characters.");
        LocalDate spentOn = req.spentOn() != null ? req.spentOn() : LocalDate.now(ZoneOffset.UTC);
        if (spentOn.isAfter(LocalDate.now(ZoneOffset.UTC))) {
            throw new BadRequestException("Expenses can't be dated in the future.");
        }

        Expense expense = new Expense(projectId, amount, spentOn, description);
        expense.setCreatedBy(actor.getId());
        Expense saved = expenses.insert(expense);
        audit.record(actor, "ADD_EXPENSE", "EXPENSE", saved.getId(), details(
                "projectId", projectId, "amount", amount, "spentOn", spentOn, "description", description));
        return saved;
    }

    /** The expense stops counting toward the budget. */
    public Expense voidExpense(User actor, long id, String reasonText) {
        Expense expense = expenses.findById(id).orElseThrow(() -> new NotFoundException("Expense not found."));
        access.requireWritable(access.requireManagedProject(actor, expense.getProjectId()));
        String reason = Validate.reason(reasonText);
        if (!expense.isActive()) throw new BusinessRuleException("This expense has already been voided.");

        expense.setActive(false);
        expense.setVoidedAt(Instant.now());
        expense.setVoidReason(reason);
        Expense saved = expenses.update(expense);
        audit.record(actor, "VOID_EXPENSE", "EXPENSE", id, details(
                "projectId", saved.getProjectId(), "amount", saved.getAmount(), "reason", reason));
        return saved;
    }
}
