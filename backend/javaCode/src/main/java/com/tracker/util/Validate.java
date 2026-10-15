package com.tracker.util;

import com.tracker.exception.BadRequestException;

import java.time.LocalDate;
import java.util.regex.Pattern;

/**
 * Checks on single request values. Each one throws BadRequestException (HTTP 400)
 * with a message that can be shown to the user.
 */
public final class Validate {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHOTO = Pattern.compile("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$");
    private static final int MAX_PHOTO_CHARS = 140_000; // about 100 KB of image once decoded

    private Validate() {}

    public static <T> T required(T value, String label) {
        if (value == null) throw new BadRequestException(label + " is required.");
        return value;
    }

    /** Trimmed, non-blank text. */
    public static String text(String value, String label) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) throw new BadRequestException(label + " is required.");
        return trimmed;
    }

    /** Lower-cased, roughly valid email address. Uniqueness is checked by UserService. */
    public static String email(String value) {
        String email = text(value, "Email").toLowerCase();
        if (!EMAIL.matcher(email).matches()) throw new BadRequestException("Enter a valid email address.");
        return email;
    }

    /** At least 8 characters. Capped so a huge "password" can't tie up the server hashing it. */
    public static String password(String value) {
        if (value == null || value.length() < 8) {
            throw new BadRequestException("Password must be at least 8 characters.");
        }
        if (value.length() > 128) throw new BadRequestException("Password must be at most 128 characters.");
        return value;
    }

    /** The reason given for "deleting" something: 3 to 500 characters. */
    public static String reason(String value) {
        String text = value == null ? "" : value.trim();
        if (text.length() < 3) throw new BadRequestException("Give a short reason (at least 3 characters).");
        if (text.length() > 500) throw new BadRequestException("Keep the reason under 500 characters.");
        return text;
    }

    /** A small profile photo: a JPEG, PNG or WebP data URL of at most about 100 KB. Null means "remove". */
    public static String photo(String value) {
        if (value == null) return null;
        if (!PHOTO.matcher(value).matches()) {
            throw new BadRequestException("The photo must be a JPEG, PNG or WebP image.");
        }
        if (value.length() > MAX_PHOTO_CHARS) throw new BadRequestException("That photo is too large. Use a smaller image.");
        return value;
    }

    public static void ordered(LocalDate start, LocalDate end, String endLabel) {
        if (end.isBefore(start)) throw new BadRequestException(endLabel + " can't be before the start date.");
    }

    public static double hoursPerWeek(Double value) {
        if (value == null || value.isNaN() || value <= 0 || value > WorkWeek.HOURS_PER_WEEK) {
            throw new BadRequestException(
                    "Hours per week must be more than 0 and at most " + WorkWeek.HOURS_PER_WEEK + ".");
        }
        return value;
    }

    /** An amount of money: 0 or more, rounded to cents. */
    public static double money(Double value, String label) {
        if (value == null || value.isNaN() || value.isInfinite()) throw new BadRequestException(label + " is required.");
        if (value < 0) throw new BadRequestException(label + " can't be negative.");
        if (value > 1_000_000_000) throw new BadRequestException(label + " is too large.");
        return Math.round(value * 100) / 100.0;
    }

    public static int percent(Integer value) {
        if (value == null || value < 0 || value > 100) {
            throw new BadRequestException("Progress must be a whole number from 0 to 100.");
        }
        return value;
    }
}
