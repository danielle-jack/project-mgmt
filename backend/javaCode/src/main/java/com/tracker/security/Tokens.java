package com.tracker.security;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

/**
 * Login tokens: standard JWTs signed with HMAC-SHA256 (HS256), built with plain Java.
 * A token says which user it belongs to and when it expires. Anyone can read it,
 * but only the server can create one, because only the server knows the secret.
 *
 * The secret is generated once and kept in the app_secrets table (see Database).
 */
public class Tokens {
    public static final Duration LIFETIME = Duration.ofHours(8);
    private static final String HEADER = base64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

    private final byte[] secret;
    private final Clock clock;

    public Tokens(byte[] secret) {
        this(secret, Clock.systemUTC());
    }

    Tokens(byte[] secret, Clock clock) {
        this.secret = secret;
        this.clock = clock;
    }

    public String issue(long userId) {
        long now = clock.instant().getEpochSecond();
        JsonObject payload = new JsonObject();
        payload.addProperty("sub", String.valueOf(userId));
        payload.addProperty("iat", now);
        payload.addProperty("exp", now + LIFETIME.toSeconds());

        String unsigned = HEADER + "." + base64(payload.toString().getBytes(StandardCharsets.UTF_8));
        return unsigned + "." + base64(sign(unsigned));
    }

    /** The user id in a valid, unexpired token; empty for anything else. */
    public Optional<Long> verify(String token) {
        if (token == null) return Optional.empty();
        String[] parts = token.trim().split("\\.");
        if (parts.length != 3 || !parts[0].equals(HEADER)) return Optional.empty();

        try {
            byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
            if (!MessageDigest.isEqual(signature, sign(parts[0] + "." + parts[1]))) return Optional.empty();

            String json = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            JsonObject payload = JsonParser.parseString(json).getAsJsonObject();
            if (payload.get("exp").getAsLong() <= clock.instant().getEpochSecond()) return Optional.empty();
            return Optional.of(Long.parseLong(payload.get("sub").getAsString()));
        } catch (IllegalArgumentException | IllegalStateException | NullPointerException
                 | UnsupportedOperationException | JsonSyntaxException e) {
            return Optional.empty();
        }
    }

    private byte[] sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 is not available", e);
        }
    }

    private static String base64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
