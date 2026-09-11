-- AlterTable
ALTER TABLE "Vocabulary" ADD COLUMN "senseKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Vocabulary" ADD COLUMN "senseLabel" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Vocabulary_word_senseKey_key" ON "Vocabulary"("word", "senseKey");
