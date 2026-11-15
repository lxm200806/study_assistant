<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { applyAppShell } from '@/utils/subject'
import { isBrowserH5 } from '@/utils/audio-recording'
import { installPcRouteSync } from '@/utils/pc-route'

onLaunch(() => {
  if (!isBrowserH5()) return
  installPcRouteSync(() => applyAppShell())
})

onShow(async () => {
  const userStore = useUserStore()
  await userStore.checkLogin()
  applyAppShell()
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

@media (min-width: 768px) {
  html.pc-chromeless .uni-page-head,
  html.pc-chromeless .uni-page-head ~ .uni-placeholder {
    display: none !important;
  }

  uni-layout.uni-app--showleftwindow ~ uni-tabbar {
    display: none !important;
  }

  uni-left-window,
  .uni-left-window {
    background: #f7f7f7;
  }

  html.pc-chromeless uni-main .container {
    max-width: 1080px;
    margin-left: auto;
    margin-right: auto;
    box-sizing: border-box;
  }
}
</style>
