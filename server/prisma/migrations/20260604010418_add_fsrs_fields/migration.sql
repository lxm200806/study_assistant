-- AlterTable
ALTER TABLE "VocabularyStat" ADD COLUMN     "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "due" TIMESTAMP(3),
ADD COLUMN     "fsrsState" TEXT NOT NULL DEFAULT 'New',
ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReview" TIMESTAMP(3),
ADD COLUMN     "recentLapse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retrievability" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "stability" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "VocabularyStat_userId_type_due_idx" ON "VocabularyStat"("userId", "type", "due");
