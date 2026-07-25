-- Backfill active-user grace window for existing accounts
UPDATE "User"
SET "isActive" = true,
    "activeGraceUntil" = COALESCE("activeGraceUntil", "createdAt" + INTERVAL '7 days')
WHERE "activeGraceUntil" IS NULL;

-- Promote your Product Admin account (edit email before running)
UPDATE "User"
SET "role" = 'admin'
WHERE lower(email) = lower('mehtabatkips@gmail.com');

-- Optional: verify new columns exist
-- SELECT id, email, role, "isDeveloper", "isActive", "activeGraceUntil", "lastActiveAt" FROM "User" LIMIT 20;
