package com.tracker.service;

import com.tracker.dto.BudgetSummary;
import com.tracker.model.Assignment;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class BudgetCalculatorTest {
    // Monday 5 Oct 2026 to Friday 16 Oct 2026: 10 workdays.
    private static final LocalDate MON = LocalDate.of(2026, 10, 5);
    private static final LocalDate FRI_NEXT = LocalDate.of(2026, 10, 16);

    private static Assignment assignment(double hoursPerWeek) {
        return new Assignment(1L, 2L, hoursPerWeek, MON, FRI_NEXT);
    }

    @Test
    void fullAssignmentCostsRateTimesHours() {
        // 20h/week for 2 weeks at 50/h = 2000
        assertEquals(2000, BudgetCalculator.labourCost(assignment(20), 50, null), 0.001);
    }

    @Test
    void cutoffStopsTheClock() {
        // Up to Friday 9 Oct: 1 week
        assertEquals(1000, BudgetCalculator.labourCost(assignment(20), 50, LocalDate.of(2026, 10, 9)), 0.001);
    }

    @Test
    void nothingBeforeTheStart() {
        assertEquals(0, BudgetCalculator.labourCost(assignment(20), 50, LocalDate.of(2026, 10, 1)), 0.001);
    }

    @Test
    void removedMembersCountUntilTheyLeft() {
        Assignment a = assignment(40);
        a.setActive(false);
        a.setDeactivatedAt(Instant.parse("2026-10-07T15:00:00Z")); // Mon-Wed: 3 workdays = 24h
        assertEquals(24 * 10, BudgetCalculator.labourCost(a, 10, null), 0.001);
    }

    @Test
    void summaryAddsExpensesAndForecast() {
        BudgetSummary s = BudgetSummary.of(10_000, 3_000, 9_000, 500.25);
        assertEquals(3_500.25, s.spentToDate(), 0.001);
        assertEquals(9_500.25, s.forecastTotal(), 0.001);
        assertEquals(6_499.75, s.remaining(), 0.001);
        assertEquals(35, s.percentUsed());
    }

    @Test
    void noBudgetMeansNoPercent() {
        assertNull(BudgetSummary.of(0, 100, 100, 0).percentUsed());
    }
}
