-- 书内释义：中文、英文跟当前词书走。

ALTER TABLE "BookVocabulary" ADD COLUMN "meaning" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BookVocabulary" ADD COLUMN "englishMeaning" TEXT NOT NULL DEFAULT '';
