-- Backfill grace, premium plan (until Mar 15 2027), and promote admin
UPDATE "User"
SET "isActive" = true,
    "activeGraceUntil" = COALESCE("activeGraceUntil", "createdAt" + INTERVAL '7 days'),
    "plan" = COALESCE(NULLIF("plan", ''), 'premium'),
    "planExpiresAt" = COALESCE("planExpiresAt", TIMESTAMP '2027-03-15 23:59:59'),
    "loginCount" = COALESCE("loginCount", 0),
    "legalSettings" = COALESCE("legalSettings", '{}'::jsonb)
WHERE "activeGraceUntil" IS NULL
   OR "planExpiresAt" IS NULL
   OR "loginCount" IS NULL;

UPDATE "User"
SET "role" = 'admin'
WHERE lower(email) = lower('mehtabatkips@gmail.com');

-- After Mar 15 2027 everyone on premium without platinum becomes common (run later if needed)
-- UPDATE "User" SET plan = 'common' WHERE plan = 'premium' AND "planExpiresAt" < NOW();

