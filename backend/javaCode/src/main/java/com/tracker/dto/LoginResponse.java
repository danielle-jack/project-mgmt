package com.tracker.dto;

import com.tracker.model.User;

/**
 * A successful login: the token to send back in X-Auth-Token, and who logged in.
 */
public record LoginResponse(String token, User user) {}
