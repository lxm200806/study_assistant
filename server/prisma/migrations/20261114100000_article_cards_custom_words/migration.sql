-- Sentence review cards, learner-owned spellings, and per-mode keyboard ratings.
-- Word-book FSRS stays on VocabularyStat. These tables do not reuse the writing type.

ALTER TABLE "Vocabulary" ADD COLUMN "ownerLearnerId" TEXT;
ALTER TABLE "Vocabulary" ADD COLUMN "phoneticUk" TEXT;
ALTER TABLE "Vocabulary" ADD COLUMN "phoneticUs" TEXT;
ALTER TABLE "Vocabulary" ADD COLUMN "synonyms" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vocabulary" ADD COLUMN "roots" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vocabulary" ADD COLUMN "etymology" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vocabulary" ADD COLUMN "phrases" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Vocabulary_ownerLearnerId_idx" ON "Vocabulary"("ownerLearnerId");

ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_ownerLearnerId_fkey" FOREIGN KEY ("ownerLearnerId") REFERENCES "Learner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "practice_list_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "spelling" TEXT NOT NULL,
    "gloss" TEXT NOT NULL DEFAULT '',
    "wordId" TEXT NOT NULL,
    "synonyms" TEXT NOT NULL DEFAULT '',
    "roots" TEXT NOT NULL DEFAULT '',
    "etymology" TEXT NOT NULL DEFAULT '',
    "phrases" TEXT NOT NULL DEFAULT '',
    "phoneticUk" TEXT NOT NULL DEFAULT '',
    "phoneticUs" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "practice_list_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "practice_list_items_listId_spelling_key" ON "practice_list_items"("listId", "spelling");
CREATE INDEX "practice_list_items_listId_position_idx" ON "practice_list_items"("listId", "position");

ALTER TABLE "practice_list_items" ADD CONSTRAINT "practice_list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "practice_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practice_list_items" ADD CONSTRAINT "practice_list_items_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "article_sentence_cards" (
    "learnerId" TEXT NOT NULL,
    "articleKey" TEXT NOT NULL,
    "sentenceIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "translation" TEXT NOT NULL DEFAULT '',
    "practiceCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastPractice" TIMESTAMP(3),
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3),
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "fsrsState" TEXT NOT NULL DEFAULT 'New',
    "lastReview" TIMESTAMP(3),
    "retrievability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recentLapse" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "article_sentence_cards_pkey" PRIMARY KEY ("learnerId","articleKey","sentenceIndex")
);

CREATE INDEX "article_sentence_cards_learnerId_due_idx" ON "article_sentence_cards"("learnerId", "due");

ALTER TABLE "article_sentence_cards" ADD CONSTRAINT "article_sentence_cards_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "typing_mode_stats" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "practiceCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastPractice" TIMESTAMP(3),
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3),
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "fsrsState" TEXT NOT NULL DEFAULT 'New',
    "lastReview" TIMESTAMP(3),
    "retrievability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recentLapse" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "typing_mode_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "typing_mode_stats_learnerId_wordId_mode_key" ON "typing_mode_stats"("learnerId", "wordId", "mode");
CREATE INDEX "typing_mode_stats_learnerId_mode_due_idx" ON "typing_mode_stats"("learnerId", "mode", "due");

ALTER TABLE "typing_mode_stats" ADD CONSTRAINT "typing_mode_stats_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "typing_mode_stats" ADD CONSTRAINT "typing_mode_stats_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
