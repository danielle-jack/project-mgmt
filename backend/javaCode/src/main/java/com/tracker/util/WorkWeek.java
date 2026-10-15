package com.tracker.util;

import java.time.DayOfWeek;
import java.time.LocalDate;

/**
 * 40-hour week: 8 hours a day over 5 days.
 * Counts workdays between two dates for project hour totals.
 */
public final class WorkWeek {
    public static final int HOURS_PER_DAY = 8;
    public static final int DAYS_PER_WEEK = 5;
    public static final int HOURS_PER_WEEK = HOURS_PER_DAY * DAYS_PER_WEEK;

    private WorkWeek() {}

    /** Monday-Friday days from start to end, both included. 0 if end is before start. */
    public static int countWorkdays(LocalDate start, LocalDate end) {
        int count = 0;
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            DayOfWeek weekday = day.getDayOfWeek();
            if (weekday != DayOfWeek.SATURDAY && weekday != DayOfWeek.SUNDAY) count++;
        }
        return count;
    }
}
