<template>
  <view :class="['book-switcher', compact ? 'compact' : '']" @tap="openPicker">
    <view class="book-main">
      <text class="book-icon">📚</text>
      <view class="book-info">
        <text v-if="vocabStore.getCurrentBook" class="book-name">{{ vocabStore.getCurrentBook.name }}</text>
        <text v-else class="book-name placeholder">请选择词汇书</text>
        <text v-if="vocabStore.getCurrentBook" class="book-meta">
          {{ vocabStore.getCurrentBook.level }} · {{ vocabStore.getCurrentBook.wordCount }} 词
          <text v-if="currentBookLocked"> · 🔒 未解锁</text>
          <text v-else-if="showDue && vocabStore.dueCount.dueCount > 0">
            · 待复习 {{ vocabStore.dueCount.dueCount }}
          </text>
        </text>
      </view>
    </view>
    <text class="switch-hint">切换 ›</text>
  </view>
</template>

<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import { isBookAccessible } from '@/composables/useTrainingStart'
import { openBooksTab } from '@/utils/navigation'

const props = withDefaults(defineProps<{
  trainingType?: 'listening' | 'speaking' | 'reading' | 'writing'
  compact?: boolean
  showDue?: boolean
}>(), {
  compact: false,
  showDue: true
})

defineEmits<{
  change: [code: string]
}>()

const vocabStore = useVocabularyStore()

const currentBookLocked = computed(() => {
  const book = vocabStore.getCurrentBook
  return book ? !isBookAccessible(book.code, book.isFree) : false
})

const refreshBookMeta = async (code: string) => {
  if (!code) return
  await vocabStore.loadBookProgress(code)
  if (props.trainingType) {
    await vocabStore.loadDueCount(code, props.trainingType)
  }
}

const openPicker = () => {
  openBooksTab()
}

onMounted(() => {
  if (vocabStore.currentBookCode) {
    refreshBookMeta(vocabStore.currentBookCode)
  }
})

watch(() => vocabStore.currentBookCode, (code) => {
  if (code) refreshBookMeta(code)
})
</script>

<style lang="scss" scoped>
.book-switcher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--pc-surface-2, #fff);
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 24rpx;
  box-shadow: var(--pc-shadow, 0 2rpx 12rpx rgba(0, 0, 0, 0.06));
  border: 1px solid var(--pc-border, transparent);
}

.book-switcher.compact {
  margin-bottom: 20rpx;
  padding: 20rpx 24rpx;
}

.book-main {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.book-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.book-info {
  flex: 1;
  min-width: 0;
}

.book-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--pc-text, #333);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-name.placeholder {
  color: var(--pc-accent, #0f6e6a);
}

.book-meta {
  font-size: 22rpx;
  color: var(--pc-text-3, #999);
  display: block;
  margin-top: 6rpx;
}

.switch-hint {
  font-size: 24rpx;
  color: var(--pc-accent, #0f6e6a);
  flex-shrink: 0;
  margin-left: 16rpx;
}
</style>
