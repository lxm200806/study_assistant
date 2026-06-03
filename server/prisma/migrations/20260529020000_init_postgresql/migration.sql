-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vocabulary" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "phonetic" TEXT,
    "imageUrl" TEXT,
    "exampleSentence" TEXT,
    "englishMeaning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookVocabulary" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BookVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "practiceCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "lastPractice" TIMESTAMP(3),
    "mastery" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VocabularyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Book_name_key" ON "Book"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Book_code_key" ON "Book"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BookVocabulary_bookId_wordId_key" ON "BookVocabulary"("bookId", "wordId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyStat_userId_wordId_type_key" ON "VocabularyStat"("userId", "wordId", "type");

-- AddForeignKey
ALTER TABLE "BookVocabulary" ADD CONSTRAINT "BookVocabulary_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookVocabulary" ADD CONSTRAINT "BookVocabulary_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyStat" ADD CONSTRAINT "VocabularyStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyStat" ADD CONSTRAINT "VocabularyStat_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRecord" ADD CONSTRAINT "ChatRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
