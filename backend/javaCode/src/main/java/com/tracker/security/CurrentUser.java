package com.tracker.security;

import com.tracker.exception.UnauthorizedException;
import com.tracker.model.User;
import com.tracker.repository.UserRepository;

import java.util.Map;

/**
 * Works out who is making the request from the login token in the X-Auth-Token header.
 *
 * It's a custom header rather than "Authorization" because CloudFront, with this
 * project's no-caching policy, doesn't pass Authorization through to the Lambda.
 */
public final class CurrentUser {
    public static final String HEADER = "x-auth-token";

    private CurrentUser() {}

    /** The active user the token belongs to (header names lower-cased). */
    public static User resolve(Map<String, String> headers, UserRepository users, Tokens tokens) {
        String token = headers.get(HEADER);
        if (token == null || token.isBlank()) throw new UnauthorizedException("Please log in.");

        long id = tokens.verify(token)
                .orElseThrow(() -> new UnauthorizedException("Your session has expired. Please log in again."));
        User user = users.findById(id)
                .orElseThrow(() -> new UnauthorizedException("Your session has expired. Please log in again."));
        if (!user.isActive()) throw new UnauthorizedException("This account has been deactivated.");
        return user;
    }
}
