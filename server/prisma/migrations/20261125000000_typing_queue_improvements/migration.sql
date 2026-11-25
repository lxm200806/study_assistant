ALTER TABLE "VocabularyStat" ADD COLUMN "learningSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VocabularyStat" ADD COLUMN "scheduledDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "typing_mode_stats" ADD COLUMN "learningSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "typing_mode_stats" ADD COLUMN "scheduledDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "article_sentence_cards" ADD COLUMN "learningSteps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "article_sentence_cards" ADD COLUMN "scheduledDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "learner_word_marks" ADD COLUMN "wrongStreak" INTEGER NOT NULL DEFAULT 0;
