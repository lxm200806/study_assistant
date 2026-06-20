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
import { useUserStore } from '@/stores/user'
import { isBookAccessible } from '@/composables/useTrainingStart'

const props = withDefaults(defineProps<{
  trainingType?: 'listening' | 'speaking' | 'reading' | 'writing'
  compact?: boolean
  showDue?: boolean
}>(), {
  compact: false,
  showDue: true
})

const emit = defineEmits<{
  change: [code: string]
}>()

const vocabStore = useVocabularyStore()
const userStore = useUserStore()

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
  const list = vocabStore.books
  if (list.length === 0) {
    uni.showToast({ title: '词书加载中', icon: 'none' })
    return
  }

  uni.showActionSheet({
    itemList: list.map(b => {
      const locked = !isBookAccessible(b.code, b.isFree)
      return `${locked ? '🔒 ' : ''}${b.name} (${b.level})`
    }),
    success: async (res) => {
      const book = list[res.tapIndex]
      if (!book || book.code === vocabStore.currentBookCode) return
      if (!isBookAccessible(book.code, book.isFree)) {
        uni.showModal({
          title: '词书未解锁',
          content: `「${book.name}」需开通会员，免费用户可使用 KET 词书。`,
          confirmText: '了解会员',
          cancelText: '取消',
          success: (modal) => {
            if (modal.confirm) {
              uni.navigateTo({ url: '/pages/membership/membership' })
            }
          }
        })
        return
      }
      vocabStore.setCurrentBook(book.code)
      await refreshBookMeta(book.code)
      emit('change', book.code)
      uni.showToast({ title: `已切换 ${book.name}`, icon: 'success' })
    }
  })
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
  background: white;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
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
  color: #333;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-name.placeholder {
  color: #667eea;
}

.book-meta {
  font-size: 22rpx;
  color: #999;
  display: block;
  margin-top: 6rpx;
}

.switch-hint {
  font-size: 24rpx;
  color: #667eea;
  flex-shrink: 0;
  margin-left: 16rpx;
}
</style>
