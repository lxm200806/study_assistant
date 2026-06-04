<template>
  <view class="group-actions">
    <button class="btn-next-group" hover-class="btn-next-group-hover" @tap="$emit('nextGroup')">
      下一组
    </button>
    <button class="btn-finish" hover-class="btn-finish-hover" @tap="$emit('finish')">
      完成训练
    </button>
  </view>
</template>

<script setup lang="ts">
defineEmits<{ nextGroup: []; finish: [] }>()
</script>

<style lang="scss" scoped>
.group-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.btn-next-group,
.btn-finish {
  flex: 1;
  margin: 0;
  border-radius: 40rpx;
  padding: 24rpx 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  line-height: 1.4;
  box-sizing: border-box;
}

.btn-next-group {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  box-shadow: 0 6rpx 16rpx rgba(102, 126, 234, 0.35);
}

.btn-next-group-hover {
  opacity: 0.9;
  transform: scale(0.98);
}

.btn-finish {
  background: #ffffff;
  color: #444;
  border: 2rpx solid #c5cbe8;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.btn-finish-hover {
  background: #f8f9ff;
  border-color: #667eea;
  color: #667eea;
}

.btn-next-group::after,
.btn-finish::after {
  border: none;
}
</style>
