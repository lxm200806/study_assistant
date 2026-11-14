-- Keyboard practice marks, imported word lists, and learner articles.
-- Scheduling stays on VocabularyStat (FSRS). These tables only store
-- favorites, explicit skip, the wrong-word book, and imported text.

CREATE TABLE "learner_word_marks" (
    "learnerId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "skipMastered" BOOLEAN NOT NULL DEFAULT false,
    "inWrongBook" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_word_marks_pkey" PRIMARY KEY ("learnerId","wordId")
);

CREATE INDEX "learner_word_marks_learnerId_inWrongBook_idx" ON "learner_word_marks"("learnerId", "inWrongBook");
CREATE INDEX "learner_word_marks_learnerId_favorite_idx" ON "learner_word_marks"("learnerId", "favorite");

ALTER TABLE "learner_word_marks" ADD CONSTRAINT "learner_word_marks_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learner_word_marks" ADD CONSTRAINT "learner_word_marks_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "practice_lists" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practice_lists_learnerId_idx" ON "practice_lists"("learnerId");
ALTER TABLE "practice_lists" ADD CONSTRAINT "practice_lists_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "practice_articles" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "translation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practice_articles_learnerId_idx" ON "practice_articles"("learnerId");
ALTER TABLE "practice_articles" ADD CONSTRAINT "practice_articles_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
