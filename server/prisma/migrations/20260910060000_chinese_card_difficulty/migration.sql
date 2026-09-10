-- 题卡难度标记：小学 / 小升初 / 初中
ALTER TABLE "chinese_published" ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT '';

CREATE INDEX "chinese_published_difficulty_idx" ON "chinese_published"("difficulty");
