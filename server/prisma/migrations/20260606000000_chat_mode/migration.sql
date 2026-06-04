-- AlterTable
ALTER TABLE "ChatRecord" ADD COLUMN "mode" TEXT;

-- CreateTable
CREATE TABLE "SpeechUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeechUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeechUsageLog_userId_createdAt_idx" ON "SpeechUsageLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SpeechUsageLog" ADD CONSTRAINT "SpeechUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
