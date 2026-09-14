-- 一词一行：书内例句挂在 BookVocabulary；合并旧的 senseKey 拆行。

ALTER TABLE "BookVocabulary" ADD COLUMN "exampleSentences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "_vocab_keep" AS
SELECT DISTINCT ON (lower(word)) id, word
FROM "Vocabulary"
ORDER BY lower(word), CASE WHEN "senseKey" = '' THEN 0 ELSE 1 END, "createdAt" ASC;

CREATE TABLE "_vocab_map" AS
SELECT v.id AS old_id, k.id AS new_id
FROM "Vocabulary" v
JOIN "_vocab_keep" k ON lower(v.word) = lower(k.word);

UPDATE "TrainingRecord" t
SET "wordId" = m.new_id
FROM "_vocab_map" m
WHERE t."wordId" = m.old_id AND m.old_id <> m.new_id;

UPDATE "VocabularyStat" s
SET "wordId" = m.new_id
FROM "_vocab_map" m
WHERE s."wordId" = m.old_id
  AND m.old_id <> m.new_id
  AND NOT EXISTS (
    SELECT 1 FROM "VocabularyStat" x
    WHERE x."learnerId" = s."learnerId"
      AND x."wordId" = m.new_id
      AND x.type = s.type
  );

DELETE FROM "VocabularyStat" s
USING "_vocab_map" m
WHERE s."wordId" = m.old_id AND m.old_id <> m.new_id;

-- 同一本书里多个义项行会映射到同一个新 wordId，先删多余关联再改指向。
DELETE FROM "BookVocabulary" b
WHERE b.id IN (
  SELECT extra.id
  FROM "BookVocabulary" extra
  JOIN "_vocab_map" m ON extra."wordId" = m.old_id
  WHERE extra.id <> (
    SELECT b2.id
    FROM "BookVocabulary" b2
    JOIN "_vocab_map" m2 ON b2."wordId" = m2.old_id
    WHERE b2."bookId" = extra."bookId"
      AND m2.new_id = m.new_id
    ORDER BY CASE WHEN b2."wordId" = m2.new_id THEN 0 ELSE 1 END, b2."sort_order", b2.id
    LIMIT 1
  )
);

UPDATE "BookVocabulary" b
SET "wordId" = m.new_id
FROM "_vocab_map" m
WHERE b."wordId" = m.old_id AND m.old_id <> m.new_id;

DELETE FROM "Vocabulary" v
USING "_vocab_map" m
WHERE v.id = m.old_id AND m.old_id <> m.new_id;

DROP TABLE "_vocab_keep";
DROP TABLE "_vocab_map";

UPDATE "Vocabulary" SET word = lower(word) WHERE word <> lower(word);

DROP INDEX IF EXISTS "Vocabulary_word_senseKey_key";
CREATE UNIQUE INDEX "Vocabulary_word_key" ON "Vocabulary"("word");
