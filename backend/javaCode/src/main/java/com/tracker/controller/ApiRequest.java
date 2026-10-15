package com.tracker.controller;

import com.google.gson.JsonParseException;
import com.tracker.exception.BadRequestException;
import com.tracker.util.Json;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * One incoming HTTP request, pulled out of the Lambda event.
 * path has the "/api/javaCode" prefix removed, e.g. "/projects/3".
 */
public record ApiRequest(
        String method,
        String path,
        Map<String, String> query,
        Map<String, String> headers,
        String body) {

    /** Parses the JSON body into the given request class. An empty body becomes an empty object. */
    public <T> T body(Class<T> type) {
        String json = body == null || body.isBlank() ? "{}" : body;
        try {
            T parsed = Json.GSON.fromJson(json, type);
            if (parsed == null) throw new BadRequestException("The request body must be a JSON object.");
            return parsed;
        } catch (JsonParseException e) {
            throw new BadRequestException("The request body has a missing or badly formatted value: "
                    + rootMessage(e));
        }
    }

    public boolean flag(String name) {
        return "true".equalsIgnoreCase(query.get(name));
    }

    /**
     * Builds a request from a Lambda Function URL event (payload format 2.0),
     * falling back to the older API Gateway format.
     */
    @SuppressWarnings("unchecked")
    public static ApiRequest fromLambdaEvent(Map<String, Object> event) {
        Map<String, Object> context = (Map<String, Object>) event.getOrDefault("requestContext", Map.of());
        Map<String, Object> http = (Map<String, Object>) context.getOrDefault("http", Map.of());

        String method = (String) http.getOrDefault("method", event.getOrDefault("httpMethod", "GET"));
        String path = (String) event.getOrDefault("rawPath", event.getOrDefault("path", "/"));

        Map<String, String> headers = new HashMap<>();
        Map<String, Object> rawHeaders = (Map<String, Object>) event.get("headers");
        if (rawHeaders != null) rawHeaders.forEach((k, v) -> headers.put(k.toLowerCase(), String.valueOf(v)));

        String body = (String) event.get("body");
        if (body != null && Boolean.TRUE.equals(event.get("isBase64Encoded"))) {
            body = new String(Base64.getDecoder().decode(body), StandardCharsets.UTF_8);
        }

        return new ApiRequest(method.toUpperCase(), stripPrefix(path),
                parseQuery((String) event.get("rawQueryString")), headers, body);
    }

    /** "/api/javaCode/projects/3/" -> "/projects/3". Locally the proxy already strips the prefix. */
    static String stripPrefix(String path) {
        String stripped = path.replaceFirst("^/api/[^/]+", "");
        if (stripped.length() > 1 && stripped.endsWith("/")) stripped = stripped.substring(0, stripped.length() - 1);
        return stripped.isEmpty() ? "/" : stripped;
    }

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> query = new HashMap<>();
        if (raw == null || raw.isBlank()) return query;
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            query.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "");
        }
        return query;
    }

    private static String rootMessage(Throwable e) {
        while (e.getCause() != null) e = e.getCause();
        return e.getMessage();
    }
}
