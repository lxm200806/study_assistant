ALTER TABLE "chinese_published"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "chinese_published_isActive_idx"
ON "chinese_published"("isActive");
