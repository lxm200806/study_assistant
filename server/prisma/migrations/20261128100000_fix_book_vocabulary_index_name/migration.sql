-- Align the manually created index name with Prisma expected DB column name.
ALTER INDEX IF EXISTS "BookVocabulary_bookId_sortOrder_idx" RENAME TO "BookVocabulary_bookId_sort_order_idx";
