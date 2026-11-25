-- 跨书核对：标记「全局练过、本书尚未确认」的词，以及每本书的核对结果。
ALTER TABLE "VocabularyStat" ADD COLUMN "needsReconfirm" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "book_word_checks" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "failStreak" INTEGER NOT NULL DEFAULT 0,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_word_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "book_word_checks_learnerId_bookId_wordId_type_key"
    ON "book_word_checks"("learnerId", "bookId", "wordId", "type");

CREATE INDEX "book_word_checks_learnerId_bookId_type_idx"
    ON "book_word_checks"("learnerId", "bookId", "type");

ALTER TABLE "book_word_checks" ADD CONSTRAINT "book_word_checks_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "book_word_checks" ADD CONSTRAINT "book_word_checks_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "book_word_checks" ADD CONSTRAINT "book_word_checks_wordId_fkey"
    FOREIGN KEY ("wordId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
