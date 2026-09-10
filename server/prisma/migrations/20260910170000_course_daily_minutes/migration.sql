ALTER TABLE "chinese_courses"
ADD COLUMN "dailyMinutes" INTEGER NOT NULL DEFAULT 15;

UPDATE "chinese_courses"
SET "dailyMinutes" = GREATEST(
  5,
  LEAST(60, ROUND(("newEnergy" + "reviewEnergy") / 4.0)::INTEGER)
);
