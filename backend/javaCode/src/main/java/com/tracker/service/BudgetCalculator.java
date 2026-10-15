package com.tracker.service;

import com.tracker.dto.BudgetSummary;
import com.tracker.model.Assignment;
import com.tracker.model.Project;
import com.tracker.repository.AssignmentRepository;
import com.tracker.repository.ExpenseRepository;
import com.tracker.repository.UserRepository;
import com.tracker.util.WorkWeek;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

/**
 * Money math. Nothing here is stored; totals are worked out on request.
 *
 * Labour for one assignment = hourlyRate x hoursPerWeek x (workdays / 5), counting workdays
 * from the assignment's start to whichever comes first: its end date, the day the person
 * was removed from the team, the day the project was completed, or (for "to date") today.
 * Removed people still count for the time they were on the team.
 *
 * Rates are the employee's current rate, so changing a rate also changes past labour cost.
 */
public class BudgetCalculator {
    private final AssignmentRepository assignments;
    private final ExpenseRepository expenses;
    private final UserRepository users;

    public BudgetCalculator(AssignmentRepository assignments, ExpenseRepository expenses, UserRepository users) {
        this.assignments = assignments;
        this.expenses = expenses;
        this.users = users;
    }

    public BudgetSummary summarize(Project project) {
        List<Assignment> everyone = assignments.findByProject(project.getId(), true);
        Map<Long, Double> rates = users.hourlyRates();
        LocalDate completed = project.getCompletedAt() == null ? null
                : project.getCompletedAt().atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate toDate = completed != null && completed.isBefore(today) ? completed : today;

        double labourToDate = 0;
        double labourForecast = 0;
        for (Assignment a : everyone) {
            double rate = rates.getOrDefault(a.getEmployeeId(), 0.0);
            labourToDate += labourCost(a, rate, toDate);
            labourForecast += labourCost(a, rate, completed);
        }
        return BudgetSummary.of(project.getPlannedBudget(), labourToDate, labourForecast,
                expenses.sumActive(project.getId()));
    }

    /** Cost of the assignment's workdays up to cutoff (null = no cutoff). */
    static double labourCost(Assignment a, double rate, LocalDate cutoff) {
        LocalDate end = a.getEndDate();
        if (!a.isActive() && a.getDeactivatedAt() != null) {
            end = earlier(end, a.getDeactivatedAt().atZone(ZoneOffset.UTC).toLocalDate());
        }
        if (cutoff != null) end = earlier(end, cutoff);
        int workdays = WorkWeek.countWorkdays(a.getStartDate(), end);
        return rate * a.getHoursPerWeek() * workdays / WorkWeek.DAYS_PER_WEEK;
    }

    private static LocalDate earlier(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }
}
