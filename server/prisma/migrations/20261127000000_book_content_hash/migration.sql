-- 词书内容指纹：只有内容变化时才重写整本书。
ALTER TABLE "Book" ADD COLUMN "contentHash" TEXT;
