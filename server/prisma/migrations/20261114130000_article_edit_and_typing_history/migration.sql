-- Article edits keep sentence cards by text. Keyboard sessions feed the
-- speed chart and day heatmap. A missed sentence can mark known words wrong.

ALTER TABLE "learner_word_marks" ADD COLUMN "wrongSource" TEXT NOT NULL DEFAULT '';

CREATE TABLE "typing_session_logs" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "typedChars" INTEGER NOT NULL,
    "correctChars" INTEGER NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "typing_session_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "typing_session_logs_learnerId_date_idx" ON "typing_session_logs"("learnerId", "date");

ALTER TABLE "typing_session_logs" ADD CONSTRAINT "typing_session_logs_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
