-- Indexes backing the hottest list/history queries.
CREATE INDEX "BookVocabulary_bookId_sortOrder_idx" ON "BookVocabulary"("bookId", "sort_order");

CREATE INDEX "TrainingRecord_learnerId_createdAt_idx" ON "TrainingRecord"("learnerId", "createdAt");

CREATE INDEX "ChatRecord_learnerId_createdAt_idx" ON "ChatRecord"("learnerId", "createdAt");

-- The unique constraint already provides the (learnerId, date) lookup path.
DROP INDEX IF EXISTS "DailyStudyLog_learnerId_date_idx";
