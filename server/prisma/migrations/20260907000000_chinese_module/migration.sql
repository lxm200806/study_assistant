-- CreateTable
CREATE TABLE "chinese_resources" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT,
    "path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT,
    "slug" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'stored',
    "uploadedBy" TEXT,
    "syncedVersion" INTEGER NOT NULL DEFAULT 0,
    "syncedHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chinese_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chinese_drafts" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "sourceResourceId" TEXT,
    "createdBy" TEXT,
    "pointKey" TEXT NOT NULL DEFAULT '',
    "groupKey" TEXT NOT NULL DEFAULT '',
    "subGroupKey" TEXT NOT NULL DEFAULT '',
    "entryKey" TEXT NOT NULL DEFAULT '',
    "lemma" TEXT NOT NULL DEFAULT '',
    "questionType" TEXT NOT NULL DEFAULT 'dictation',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "options" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chinese_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chinese_published" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT '',
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "sourceResourceId" TEXT,
    "draftId" TEXT,
    "pointKey" TEXT,
    "groupKey" TEXT NOT NULL DEFAULT '',
    "subGroupKey" TEXT NOT NULL DEFAULT '',
    "entryKey" TEXT NOT NULL DEFAULT '',
    "lemma" TEXT NOT NULL DEFAULT '',
    "questionType" TEXT NOT NULL DEFAULT 'dictation',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "options" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chinese_published_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chinese_entries" (
    "id" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lemma" TEXT NOT NULL DEFAULT '',
    "grade" TEXT NOT NULL DEFAULT '',
    "grades" TEXT NOT NULL DEFAULT '',
    "levels" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chinese_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chinese_entry_grades" (
    "entryKey" TEXT NOT NULL,
    "grade" TEXT NOT NULL,

    CONSTRAINT "chinese_entry_grades_pkey" PRIMARY KEY ("entryKey","grade")
);

-- CreateTable
CREATE TABLE "chinese_entry_levels" (
    "entryKey" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "chinese_entry_levels_pkey" PRIMARY KEY ("entryKey","level")
);

-- CreateTable
CREATE TABLE "chinese_courses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "kinds" TEXT NOT NULL DEFAULT '',
    "levels" TEXT NOT NULL DEFAULT '',
    "grades" TEXT NOT NULL DEFAULT '',
    "newEnergy" INTEGER NOT NULL DEFAULT 30,
    "reviewEnergy" INTEGER NOT NULL DEFAULT 30,
    "reviewDefaultTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chinese_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chinese_course_items" (
    "courseId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chinese_course_items_pkey" PRIMARY KEY ("courseId","pointId")
);

-- CreateTable
CREATE TABLE "chinese_review_states" (
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 0,
    "ef" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "due" DATE,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "last" DATE,

    CONSTRAINT "chinese_review_states_pkey" PRIMARY KEY ("userId","courseId","pointId")
);

-- CreateTable
CREATE TABLE "chinese_review_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "isNew" BOOLEAN NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chinese_review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chinese_resources_ownerType_slug_idx" ON "chinese_resources"("ownerType", "slug");

-- CreateIndex
CREATE INDEX "chinese_drafts_status_pointKey_idx" ON "chinese_drafts"("status", "pointKey");

-- CreateIndex
CREATE UNIQUE INDEX "chinese_published_pointKey_key" ON "chinese_published"("pointKey");

-- CreateIndex
CREATE INDEX "chinese_published_kind_level_grade_idx" ON "chinese_published"("kind", "level", "grade");

-- CreateIndex
CREATE INDEX "chinese_published_entryKey_idx" ON "chinese_published"("entryKey");

-- CreateIndex
CREATE INDEX "chinese_published_groupKey_idx" ON "chinese_published"("groupKey");

-- CreateIndex
CREATE INDEX "chinese_published_questionType_idx" ON "chinese_published"("questionType");

-- CreateIndex
CREATE UNIQUE INDEX "chinese_entries_entryKey_key" ON "chinese_entries"("entryKey");

-- CreateIndex
CREATE INDEX "chinese_entry_grades_grade_idx" ON "chinese_entry_grades"("grade");

-- CreateIndex
CREATE INDEX "chinese_courses_userId_idx" ON "chinese_courses"("userId");

-- CreateIndex
CREATE INDEX "chinese_review_states_userId_courseId_due_idx" ON "chinese_review_states"("userId", "courseId", "due");

-- CreateIndex
CREATE INDEX "chinese_review_logs_userId_courseId_createdAt_idx" ON "chinese_review_logs"("userId", "courseId", "createdAt");

-- AddForeignKey
ALTER TABLE "chinese_resources" ADD CONSTRAINT "chinese_resources_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_drafts" ADD CONSTRAINT "chinese_drafts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_published" ADD CONSTRAINT "chinese_published_sourceResourceId_fkey" FOREIGN KEY ("sourceResourceId") REFERENCES "chinese_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_entry_grades" ADD CONSTRAINT "chinese_entry_grades_entryKey_fkey" FOREIGN KEY ("entryKey") REFERENCES "chinese_entries"("entryKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_entry_levels" ADD CONSTRAINT "chinese_entry_levels_entryKey_fkey" FOREIGN KEY ("entryKey") REFERENCES "chinese_entries"("entryKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_courses" ADD CONSTRAINT "chinese_courses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_course_items" ADD CONSTRAINT "chinese_course_items_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "chinese_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_course_items" ADD CONSTRAINT "chinese_course_items_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "chinese_published"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_review_states" ADD CONSTRAINT "chinese_review_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_review_states" ADD CONSTRAINT "chinese_review_states_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "chinese_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_review_states" ADD CONSTRAINT "chinese_review_states_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "chinese_published"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_review_logs" ADD CONSTRAINT "chinese_review_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_review_logs" ADD CONSTRAINT "chinese_review_logs_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "chinese_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chinese_review_logs" ADD CONSTRAINT "chinese_review_logs_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "chinese_published"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
