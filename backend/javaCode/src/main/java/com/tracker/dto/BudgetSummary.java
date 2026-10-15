package com.tracker.dto;

/**
 * Planned versus consumed money for one project. Only admins and the project's
 * manager get this; for everyone else ProjectSummary.budget is null.
 *
 *   labourToDate     hours worked so far (assignment dates up to today) x each person's hourly rate
 *   expensesToDate   logged expenses that haven't been voided
 *   spentToDate      labourToDate + expensesToDate
 *   forecastTotal    spentToDate + the labour still planned until the assignments end
 *   remaining        plannedBudget - spentToDate (negative when over budget)
 *   percentUsed      spentToDate / plannedBudget x 100, or null when no budget is set
 */
public record BudgetSummary(
        double plannedBudget,
        double labourToDate,
        double expensesToDate,
        double spentToDate,
        double forecastTotal,
        double remaining,
        Integer percentUsed) {

    public static BudgetSummary of(double planned, double labourToDate, double labourForecast, double expenses) {
        double spent = cents(labourToDate + expenses);
        Integer percent = planned > 0 ? (int) Math.round(spent / planned * 100) : null;
        return new BudgetSummary(planned, cents(labourToDate), cents(expenses), spent,
                cents(labourForecast + expenses), cents(planned - spent), percent);
    }

    private static double cents(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
