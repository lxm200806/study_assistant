ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeRole" TEXT NOT NULL DEFAULT 'parent';

UPDATE "User"
SET "accountType" = 'parent'
WHERE "parentId" IS NULL AND "accountType" <> 'parent';
