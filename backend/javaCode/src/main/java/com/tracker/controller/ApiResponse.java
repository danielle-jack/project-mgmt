package com.tracker.controller;

import com.tracker.util.Json;

import java.util.Map;

/**
 * Status code plus a JSON body, in the shape Lambda Function URLs expect.
 */
public record ApiResponse(int status, Object body) {

    public static ApiResponse error(int status, String message) {
        return new ApiResponse(status, Map.of("message", message));
    }

    public Map<String, Object> toLambdaResponse() {
        return Map.of(
                "statusCode", status,
                "headers", Map.of("Content-Type", "application/json"),
                "body", body == null ? "" : Json.GSON.toJson(body));
    }
}
