<template>
  <view class="finish-actions">
    <button class="btn-home" @tap="goHome">返回首页</button>
  </view>
</template>

<script setup lang="ts">
const goHome = () => {
  uni.switchTab({ url: '/pages/home/home' })
}
</script>

<style lang="scss" scoped>
.finish-actions {
  width: 100%;
  padding: 0 20rpx;
}

.btn-home {
  width: 100%;
  border: none;
  border-radius: 40rpx;
  padding: 24rpx;
  font-size: 32rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-home::after {
  border: none;
}
</style>
