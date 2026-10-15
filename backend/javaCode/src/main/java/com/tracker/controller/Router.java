package com.tracker.controller;

import com.tracker.exception.NotFoundException;
import com.tracker.model.User;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Matches a method and path to a handler. Paths use {id} for the one numeric
 * id a route can contain, e.g. "/projects/{id}/milestones".
 */
public class Router {

    @FunctionalInterface
    public interface Handler {
        Object handle(User actor, ApiRequest request, long id);
    }

    private record Route(String method, Pattern pattern, int status, boolean isPublic, Handler handler) {}

    private final List<Route> routes = new ArrayList<>();

    public void get(String path, Handler handler) { add("GET", path, 200, false, handler); }
    public void patch(String path, Handler handler) { add("PATCH", path, 200, false, handler); }
    /** PUT replaces one value outright, e.g. a profile photo. */
    public void put(String path, Handler handler) { add("PUT", path, 200, false, handler); }
    /** POST that changes an existing record, e.g. /projects/{id}/archive. */
    public void post(String path, Handler handler) { add("POST", path, 200, false, handler); }
    /** POST that creates a record; answers 201 Created. */
    public void create(String path, Handler handler) { add("POST", path, 201, false, handler); }
    /** POST that works without being logged in (only login itself). The handler gets a null actor. */
    public void publicPost(String path, Handler handler) { add("POST", path, 200, true, handler); }

    /**
     * Finds the route, then asks for the logged-in user and runs the handler.
     * The user is only looked up once a route matches, so unknown paths answer 404.
     */
    public ApiResponse dispatch(ApiRequest request, Supplier<User> currentUser) {
        for (Route route : routes) {
            Matcher match = route.pattern().matcher(request.path());
            if (route.method().equals(request.method()) && match.matches()) {
                long id = match.groupCount() > 0 ? Long.parseLong(match.group(1)) : 0;
                User actor = route.isPublic() ? null : currentUser.get();
                Object result = route.handler().handle(actor, request, id);
                return new ApiResponse(route.status(), result);
            }
        }
        throw new NotFoundException("No route for " + request.method() + " " + request.path());
    }

    private void add(String method, String path, int status, boolean isPublic, Handler handler) {
        Pattern pattern = Pattern.compile(path.replace("{id}", "(\\d+)"));
        routes.add(new Route(method, pattern, status, isPublic, handler));
    }
}
