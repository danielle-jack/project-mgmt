package com.tracker.security;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Password hashing with PBKDF2-HMAC-SHA256 (built into Java, no extra library).
 *
 * Stored format: pbkdf2_sha256$<iterations>$<salt>$<hash>, salt and hash in Base64.
 * The iteration count is part of the stored value, so ITERATIONS can be raised later
 * and old passwords keep working. It's modest because Lambda runs with 128 MB of
 * memory, which comes with very little CPU; check login time after deploying.
 *
 * To create a hash by hand (e.g. for the first admin):
 *   java -cp target/lib/javaCode-1.0.0.jar com.tracker.security.Passwords 'the-password'
 */
public final class Passwords {
    static final int ITERATIONS = 100_000;
    private static final String PREFIX = "pbkdf2_sha256";
    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int SALT_BYTES = 16;
    private static final int KEY_BITS = 256;
    private static final SecureRandom RANDOM = new SecureRandom();

    // Checked when the email doesn't exist, so a wrong email takes as long as a wrong password.
    private static final String DUMMY_HASH = hash("not-a-real-password");

    private Passwords() {}

    public static String hash(String password) {
        byte[] salt = new byte[SALT_BYTES];
        RANDOM.nextBytes(salt);
        byte[] key = derive(password, salt, ITERATIONS);
        Base64.Encoder b64 = Base64.getEncoder();
        return PREFIX + "$" + ITERATIONS + "$" + b64.encodeToString(salt) + "$" + b64.encodeToString(key);
    }

    /** False for a wrong password, a missing hash, or a stored value in the wrong format. */
    public static boolean matches(String password, String stored) {
        if (password == null) return false;
        if (stored == null) {
            matches(password, DUMMY_HASH);
            return false;
        }
        String[] parts = stored.split("\\$");
        if (parts.length != 4 || !parts[0].equals(PREFIX)) return false;
        try {
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expected = Base64.getDecoder().decode(parts[3]);
            return MessageDigest.isEqual(derive(password, salt, iterations), expected);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static byte[] derive(String password, byte[] salt, int iterations) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2 is not available", e);
        } finally {
            spec.clearPassword();
        }
    }

    public static void main(String[] args) {
        if (args.length != 1) {
            System.err.println("Usage: java -cp <jar> com.tracker.security.Passwords '<password>'");
            System.exit(1);
        }
        System.out.println(hash(args[0]));
    }
}
