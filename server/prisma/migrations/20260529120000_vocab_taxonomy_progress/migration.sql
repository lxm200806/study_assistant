-- AlterTable
ALTER TABLE "Vocabulary" ADD COLUMN "contentType" TEXT,
ADD COLUMN "topic" TEXT,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "BookStudyProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "cycleStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "practicedWordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "BookStudyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookStudyProgress_userId_bookId_key" ON "BookStudyProgress"("userId", "bookId");

-- AddForeignKey
ALTER TABLE "BookStudyProgress" ADD CONSTRAINT "BookStudyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookStudyProgress" ADD CONSTRAINT "BookStudyProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
