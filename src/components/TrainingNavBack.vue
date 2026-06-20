<template>
  <view
    class="nav-back-fixed"
    :style="{ top: statusBarHeight + 'px', height: navBarHeight + 'px' }"
  >
    <view class="nav-back" hover-class="nav-back-hover" @tap="emit('back')">
      <text class="nav-back-icon">‹</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{ back: [] }>()

const statusBarHeight = ref(0)
const navBarHeight = 44

onMounted(() => {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = info.statusBarHeight || 0
})
</script>

<style lang="scss" scoped>
.nav-back-fixed {
  position: fixed;
  left: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  padding-left: 4px;
}

.nav-back {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-back-icon {
  font-size: 32px;
  font-weight: 300;
  color: #333;
  line-height: 1;
  margin-top: -2px;
}

.nav-back-hover {
  opacity: 0.6;
}
</style>
