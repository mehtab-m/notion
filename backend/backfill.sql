UPDATE "User"
SET "isActive" = true,
    "activeGraceUntil" = COALESCE("activeGraceUntil", "createdAt" + INTERVAL '7 days')
WHERE "activeGraceUntil" IS NULL;

UPDATE "User"
SET "role" = 'admin'
WHERE lower(email) = lower('mehtabatkips@gmail.com');
