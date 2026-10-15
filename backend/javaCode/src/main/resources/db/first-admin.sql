-- Only admins can create users, so the very first admin has to be added by hand.
--
-- ON AWS (Aurora can't be reached with psql): invoke the deployed Lambda directly. Only
-- someone with AWS credentials can do this, and it refuses once any admin exists:
--
--   aws lambda invoke --function-name coding-workshop-javaCode-<app id> \
--     --cli-binary-format raw-in-base64-out \
--     --payload '{"bootstrapAdmin":{"name":"Your Name","email":"you@example.com","password":"choose-a-password"}}' \
--     /dev/stdout
--
--   (`aws lambda list-functions --query 'Functions[].FunctionName'` shows the exact name.)
--
-- LOCALLY, either use the same command against LocalStack (add
-- --endpoint-url http://localhost.localstack.cloud:4566), or the SQL below:
--
-- 1. Make a password hash (from backend/javaCode, after ./bin/start-dev.sh has built the jar):
--      java -cp target/lib/javaCode-1.0.0.jar com.tracker.security.Passwords 'choose-a-password'
-- 2. Paste the printed hash below, and change the name and email.
-- 3. Run it once the tables exist:
--      PGPASSWORD=postgres123 psql -h localhost -U postgres -d postgres -f first-admin.sql
--
-- Until the hash is pasted in, this account can't log in.

INSERT INTO users (name, email, role, password_hash)
VALUES ('First Admin', 'admin@example.com', 'ADMIN', 'PASTE_HASH_HERE')
ON CONFLICT (email) DO NOTHING;
