<template>
  <view :class="['state-hint', `is-${tone}`]">
    <text v-if="text" class="state-text">{{ text }}</text>
    <slot />
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'loading' | 'empty' | 'error'
    text?: string
  }>(),
  {
    tone: 'empty',
    text: ''
  }
)
</script>

<style scoped lang="scss">
.state-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: var(--pc-surface-1, #efe6d6);
  color: var(--pc-text-2, #6d645b);
  font-size: 26rpx;
  line-height: 1.6;
}

.state-hint.is-loading {
  color: var(--pc-text-3, #8a8175);
}

.state-hint.is-error {
  background: var(--pc-danger-soft, #f8ebe6);
  color: var(--pc-danger, #9a3b2f);
}

.state-text {
  text-align: center;
}
</style>
