package com.tracker.service;

import com.tracker.model.Assignment;
import com.tracker.util.WorkWeek;

import java.util.List;

/**
 * Planned-hours math. Nothing here is stored; totals are worked out on request.
 *
 * One assignment's total = hoursPerWeek x (workdays in its date range / 5).
 * A project's total = the sum over its active assignments.
 */
public class HoursCalculator {

    public double assignmentTotalHours(Assignment a) {
        int workdays = WorkWeek.countWorkdays(a.getStartDate(), a.getEndDate());
        return a.getHoursPerWeek() * workdays / WorkWeek.DAYS_PER_WEEK;
    }

    /** Pass only active assignments. Rounded to one decimal place. */
    public double projectTotalHours(List<Assignment> activeTeam) {
        double total = activeTeam.stream().mapToDouble(this::assignmentTotalHours).sum();
        return Math.round(total * 10) / 10.0;
    }
}
