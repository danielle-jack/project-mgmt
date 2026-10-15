package com.example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.tracker.App;
import com.tracker.Bootstrap;
import com.tracker.controller.ApiRequest;
import com.tracker.controller.ApiResponse;
import com.tracker.repository.Database;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

/**
 * Lambda entry point. The workshop's Terraform always runs com.example.Handler,
 * so this class stays here; the app itself lives in com.tracker.
 *
 * Each request runs in one database transaction: committed if it succeeded,
 * rolled back if it returned an error, so a failed request never half-saves.
 */
public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        if (Bootstrap.isBootstrapEvent(event)) return bootstrap(event);

        ApiRequest request = ApiRequest.fromLambdaEvent(event);
        if (request.method().equals("OPTIONS")) return new ApiResponse(204, null).toLambdaResponse();

        try {
            Connection connection = Database.sharedConnection();
            ApiResponse response = new App(new Database(connection)).handle(request);
            try {
                if (response.status() < 400) connection.commit();
                else connection.rollback();
            } catch (SQLException e) {
                connection.rollback();
                throw e;
            }
            return response.toLambdaResponse();
        } catch (SQLException e) {
            e.printStackTrace();
            return ApiResponse.error(503, "The database is unavailable. Please try again.").toLambdaResponse();
        }
    }

    /** First admin on a fresh deployment; see com.tracker.Bootstrap. */
    private Map<String, Object> bootstrap(Map<String, Object> event) {
        try {
            Connection connection = Database.sharedConnection();
            Map<String, Object> result = Bootstrap.createFirstAdmin(new Database(connection), event);
            if (Boolean.TRUE.equals(result.get("ok"))) connection.commit();
            else connection.rollback();
            return result;
        } catch (SQLException e) {
            e.printStackTrace();
            return Map.of("ok", false, "message", "The database is unavailable: " + e.getMessage());
        }
    }
}
