<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('App Launch')
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.container {
  padding: 20rpx;
}

.card {
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  padding: 24rpx;
  font-size: 32rpx;
  margin: 20rpx 0;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: none;
  border-radius: 40rpx;
  padding: 24rpx;
  font-size: 32rpx;
  margin: 20rpx 0;
}

.flex {
  display: flex;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.text-center {
  text-align: center;
}

.text-primary {
  color: #667eea;
}

.text-gray {
  color: #999;
}

.text-sm {
  font-size: 24rpx;
}

.text-lg {
  font-size: 36rpx;
}

.text-xl {
  font-size: 48rpx;
}

.bold {
  font-weight: 600;
}
</style>
