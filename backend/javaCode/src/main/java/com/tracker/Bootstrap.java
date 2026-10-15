package com.tracker;

import com.tracker.exception.ApiException;
import com.tracker.exception.BusinessRuleException;
import com.tracker.model.Role;
import com.tracker.model.User;
import com.tracker.repository.Database;
import com.tracker.repository.UserRepository;
import com.tracker.security.Passwords;
import com.tracker.util.Validate;

import java.util.Map;

/**
 * Creates the very first admin on a fresh deployment, where the database can't be
 * reached with psql (Aurora on AWS). It's triggered by invoking the Lambda directly:
 *
 *   aws lambda invoke --function-name <name> --cli-binary-format raw-in-base64-out \
 *     --payload '{"bootstrapAdmin":{"name":"...","email":"...","password":"..."}}' out.json
 *
 * Only someone with AWS credentials can invoke the Lambda directly; requests from the
 * website always arrive with a requestContext and never reach this. It also refuses
 * once any admin exists, so it can't be used to take over a running system.
 */
public final class Bootstrap {
    private Bootstrap() {}

    public static boolean isBootstrapEvent(Map<String, Object> event) {
        return event.containsKey("bootstrapAdmin") && !event.containsKey("requestContext");
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> createFirstAdmin(Database db, Map<String, Object> event) {
        try {
            Map<String, Object> input = (Map<String, Object>) event.get("bootstrapAdmin");
            UserRepository users = new UserRepository(db);
            if (users.anyAdmin()) throw new BusinessRuleException("An admin already exists. Log in as them to add more.");

            User admin = new User(
                    Validate.text((String) input.get("name"), "Name"),
                    Validate.email((String) input.get("email")),
                    Role.ADMIN);
            String password = Validate.password((String) input.get("password"));
            User saved = users.insert(admin, null, Passwords.hash(password));
            return Map.of("ok", true, "userId", saved.getId(), "email", saved.getEmail(),
                    "message", "Admin created. Log in on the website with this email and password.");
        } catch (ApiException | ClassCastException | NullPointerException e) {
            return Map.of("ok", false, "message", e instanceof ApiException ? e.getMessage()
                    : "Send {\"bootstrapAdmin\": {\"name\": ..., \"email\": ..., \"password\": ...}}");
        }
    }
}
