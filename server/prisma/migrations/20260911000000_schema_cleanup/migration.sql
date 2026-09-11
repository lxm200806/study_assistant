-- 账号与学习者拆分，删除机构表，合并语文草稿，统一题卡 JSON，去掉冗余字段。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "Learner" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeSubject" TEXT NOT NULL DEFAULT 'english',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Learner_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Learner" ("id", "accountId", "name", "activeSubject", "archivedAt", "createdAt", "updatedAt")
SELECT
    "id",
    "parentId",
    COALESCE(NULLIF("displayName", ''), "username"),
    COALESCE("activeSubject", 'english'),
    "archivedAt",
    "createdAt",
    "updatedAt"
FROM "User"
WHERE "parentId" IS NOT NULL;

INSERT INTO "Learner" ("id", "accountId", "name", "activeSubject", "archivedAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    u."id",
    COALESCE(NULLIF(u."displayName", ''), u."username"),
    COALESCE(u."activeSubject", 'english'),
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE u."parentId" IS NULL
  AND (
    EXISTS (SELECT 1 FROM "VocabularyStat" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "TrainingRecord" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "ChatRecord" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "SpeechUsageLog" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "BookStudyProgress" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "DailyStudyLog" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "chinese_courses" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "chinese_review_states" s WHERE s."userId" = u."id")
    OR EXISTS (SELECT 1 FROM "chinese_review_logs" s WHERE s."userId" = u."id")
  )
  AND NOT EXISTS (SELECT 1 FROM "Learner" l WHERE l."id" = u."id");

CREATE TEMP TABLE "parent_learner_map" AS
SELECT u."id" AS "accountId", l."id" AS "learnerId"
FROM "User" u
JOIN "Learner" l ON l."accountId" = u."id"
WHERE u."parentId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "User" c WHERE c."id" = l."id");

ALTER TABLE "VocabularyStat" DROP CONSTRAINT "VocabularyStat_userId_fkey";
ALTER TABLE "TrainingRecord" DROP CONSTRAINT "TrainingRecord_userId_fkey";
ALTER TABLE "ChatRecord" DROP CONSTRAINT "ChatRecord_userId_fkey";
ALTER TABLE "SpeechUsageLog" DROP CONSTRAINT "SpeechUsageLog_userId_fkey";
ALTER TABLE "BookStudyProgress" DROP CONSTRAINT "BookStudyProgress_userId_fkey";
ALTER TABLE "DailyStudyLog" DROP CONSTRAINT "DailyStudyLog_userId_fkey";
ALTER TABLE "chinese_courses" DROP CONSTRAINT "chinese_courses_userId_fkey";
ALTER TABLE "chinese_review_states" DROP CONSTRAINT "chinese_review_states_userId_fkey";
ALTER TABLE "chinese_review_logs" DROP CONSTRAINT "chinese_review_logs_userId_fkey";

UPDATE "VocabularyStat" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "TrainingRecord" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "ChatRecord" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "SpeechUsageLog" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "BookStudyProgress" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "DailyStudyLog" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "chinese_courses" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "chinese_review_states" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";
UPDATE "chinese_review_logs" t SET "userId" = m."learnerId" FROM "parent_learner_map" m WHERE t."userId" = m."accountId";

UPDATE "UserBookUnlock" u
SET "userId" = p."parentId"
FROM "User" p
WHERE u."userId" = p."id"
  AND p."parentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UserBookUnlock" x
    WHERE x."userId" = p."parentId" AND x."bookId" = u."bookId"
  );
DELETE FROM "UserBookUnlock"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "parentId" IS NOT NULL);

ALTER TABLE "VocabularyStat" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "TrainingRecord" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "ChatRecord" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "SpeechUsageLog" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "BookStudyProgress" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "DailyStudyLog" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "chinese_courses" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "chinese_review_states" RENAME COLUMN "userId" TO "learnerId";
ALTER TABLE "chinese_review_logs" RENAME COLUMN "userId" TO "learnerId";

ALTER INDEX "VocabularyStat_userId_wordId_type_key" RENAME TO "VocabularyStat_learnerId_wordId_type_key";
ALTER INDEX "VocabularyStat_userId_type_due_idx" RENAME TO "VocabularyStat_learnerId_type_due_idx";
ALTER INDEX "BookStudyProgress_userId_bookId_key" RENAME TO "BookStudyProgress_learnerId_bookId_key";
ALTER INDEX "DailyStudyLog_userId_date_key" RENAME TO "DailyStudyLog_learnerId_date_key";
ALTER INDEX "DailyStudyLog_userId_date_idx" RENAME TO "DailyStudyLog_learnerId_date_idx";
ALTER INDEX "SpeechUsageLog_userId_createdAt_idx" RENAME TO "SpeechUsageLog_learnerId_createdAt_idx";
ALTER INDEX "chinese_courses_userId_idx" RENAME TO "chinese_courses_learnerId_idx";
ALTER INDEX "chinese_review_states_userId_courseId_due_idx" RENAME TO "chinese_review_states_learnerId_courseId_due_idx";
ALTER INDEX "chinese_review_logs_userId_courseId_createdAt_idx" RENAME TO "chinese_review_logs_learnerId_courseId_createdAt_idx";

ALTER TABLE "Learner" ADD CONSTRAINT "Learner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Learner_accountId_idx" ON "Learner"("accountId");

ALTER TABLE "VocabularyStat" ADD CONSTRAINT "VocabularyStat_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRecord" ADD CONSTRAINT "ChatRecord_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeechUsageLog" ADD CONSTRAINT "SpeechUsageLog_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookStudyProgress" ADD CONSTRAINT "BookStudyProgress_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyStudyLog" ADD CONSTRAINT "DailyStudyLog_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chinese_courses" ADD CONSTRAINT "chinese_courses_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chinese_review_states" ADD CONSTRAINT "chinese_review_states_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chinese_review_logs" ADD CONSTRAINT "chinese_review_logs_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "User" WHERE "parentId" IS NOT NULL;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_parentId_fkey";
DROP INDEX IF EXISTS "User_parentId_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "parentId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "accountType";
ALTER TABLE "User" DROP COLUMN IF EXISTS "archivedAt";

UPDATE "User" u
SET "activeLearnerId" = l."id"
FROM "Learner" l
WHERE l."accountId" = u."id"
  AND (
    u."activeLearnerId" IS NULL
    OR u."activeLearnerId" = l."id"
    OR NOT EXISTS (SELECT 1 FROM "Learner" x WHERE x."id" = u."activeLearnerId")
  );

UPDATE "User" SET "activeLearnerId" = NULL
WHERE "activeLearnerId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Learner" l WHERE l."id" = "User"."activeLearnerId");

CREATE UNIQUE INDEX "User_activeLearnerId_key" ON "User"("activeLearnerId");
ALTER TABLE "User" ADD CONSTRAINT "User_activeLearnerId_fkey" FOREIGN KEY ("activeLearnerId") REFERENCES "Learner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "account_daily_actives" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_daily_actives_pkey" PRIMARY KEY ("userId", "date")
);
ALTER TABLE "account_daily_actives" ADD CONSTRAINT "account_daily_actives_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS "OrgMember";
DROP TABLE IF EXISTS "OrgClass";
DROP TABLE IF EXISTS "Organization";

ALTER TABLE "chinese_courses" DROP COLUMN IF EXISTS "newEnergy";
ALTER TABLE "chinese_courses" DROP COLUMN IF EXISTS "reviewEnergy";

ALTER TABLE "chinese_entries" DROP COLUMN IF EXISTS "grade";
ALTER TABLE "chinese_entries" DROP COLUMN IF EXISTS "grades";
ALTER TABLE "chinese_entries" DROP COLUMN IF EXISTS "levels";

ALTER TABLE "chinese_published" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "chinese_published" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "chinese_published" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "chinese_published" ALTER COLUMN "publishedAt" DROP NOT NULL;
UPDATE "chinese_published" SET "createdAt" = COALESCE("publishedAt", "createdAt");

CREATE OR REPLACE FUNCTION try_jsonb(t text) RETURNS jsonb AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('display', t);
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "chinese_published" ADD COLUMN "options_json" JSONB NOT NULL DEFAULT '{}';
UPDATE "chinese_published" SET "options_json" = try_jsonb("options");
ALTER TABLE "chinese_published" DROP COLUMN "options";
ALTER TABLE "chinese_published" RENAME COLUMN "options_json" TO "options";

UPDATE "chinese_published" SET "pointKey" = NULL WHERE "pointKey" = '';

INSERT INTO "chinese_published" (
  "id", "kind", "level", "grade", "prompt", "answer", "tags", "source",
  "sourceResourceId", "draftId", "pointKey", "groupKey", "subGroupKey",
  "entryKey", "lemma", "questionType", "audience", "difficulty", "isActive",
  "options", "status", "createdBy", "createdAt", "publishedAt"
)
SELECT
  d."id",
  d."kind",
  d."level",
  d."grade",
  d."prompt",
  d."answer",
  d."tags",
  d."source",
  d."sourceResourceId",
  d."id",
  CASE
    WHEN NULLIF(d."pointKey", '') IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM "chinese_published" p WHERE p."pointKey" = d."pointKey") THEN NULL
    ELSE d."pointKey"
  END,
  d."groupKey",
  d."subGroupKey",
  d."entryKey",
  d."lemma",
  d."questionType",
  d."audience",
  '',
  false,
  try_jsonb(d."options"),
  CASE WHEN d."status" IN ('draft', 'discarded', 'published') THEN d."status" ELSE 'draft' END,
  d."createdBy",
  d."createdAt",
  NULL
FROM "chinese_drafts" d
WHERE d."status" IS DISTINCT FROM 'published'
  AND NOT EXISTS (SELECT 1 FROM "chinese_published" p WHERE p."id" = d."id");

DROP FUNCTION try_jsonb(text);

ALTER TABLE "chinese_published" ADD CONSTRAINT "chinese_published_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "chinese_published_status_idx" ON "chinese_published"("status");

DROP TABLE IF EXISTS "chinese_drafts";
