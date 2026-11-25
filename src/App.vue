<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useVocabularyStore } from '@/stores/vocabulary'
import { applyAppShell } from '@/utils/subject'
import { isBrowserH5 } from '@/platform/runtime'
import { installPcRouteSync } from '@/utils/pc-route'
import { applyPcTheme } from '@/utils/pc-theme'
import { getAuthToken } from '@/utils/api'

onLaunch(() => {
  if (!isBrowserH5()) return
  applyPcTheme()
  installPcRouteSync(() => applyAppShell())
})

onShow(async () => {
  const userStore = useUserStore()
  await userStore.checkLogin()
  applyAppShell()
  if (getAuthToken()) void useVocabularyStore().flushPracticeQueue()
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
:root {
  /* 默认 = 日间米色全层；切换主题由 pc-theme.applyPcTheme 覆盖 */
  --pc-rail-bg: #e8eaed;
  --pc-main-bg: #f4f1ea;
  --pc-surface-1: #efe6d6;
  --pc-surface-2: #fffdf8;
  --pc-solid: #1f1a14;
  --pc-accent: #0f6e6a;
  --pc-accent-soft: #e7f3ef;
  --pc-danger: #9a3b2f;
  --pc-danger-soft: #f8ebe6;
  --pc-text: #1f1a14;
  --pc-text-2: #6d645b;
  --pc-text-3: #8a8175;
  --pc-on-accent: #ffffff;
  --pc-on-solid: #f4f1ea;
  --pc-border: rgba(31, 26, 20, 0.10);
  --pc-border-strong: #cfc6b8;
  --pc-shadow: 0 18px 40px -18px rgba(26, 32, 53, 0.35);
  --pc-rail-text: #1f1a14;
  --pc-rail-muted: #8a8175;
  --pc-rail-border: var(--pc-border);
  --pc-rail-hover: color-mix(in srgb, var(--pc-rail-bg) 86%, var(--pc-text));
  --pc-rail-on: color-mix(in srgb, var(--pc-rail-bg) 74%, var(--pc-text));
  --atlas-paper: var(--pc-main-bg);
}

page {
  background-color: var(--pc-main-bg, #f4f1ea);
  color: var(--pc-text, #1f1a14);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.container {
  padding: 20rpx;
}

.card {
  background: var(--pc-surface-2, #fffdf8);
  color: var(--pc-text, #1f1a14);
  border: 1px solid var(--pc-border, rgba(31, 26, 20, 0.1));
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: var(--pc-shadow, 0 2rpx 12rpx rgba(0, 0, 0, 0.06));
}

.btn-primary {
  background: var(--pc-accent, #0f6e6a);
  color: var(--pc-on-accent, #ffffff);
  border: none;
  border-radius: 40rpx;
  padding: 24rpx;
  font-size: 32rpx;
  margin: 20rpx 0;
}

.btn-secondary {
  background: var(--pc-surface-1, #efe6d6);
  color: var(--pc-text, #1f1a14);
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
  color: var(--pc-accent, #0f6e6a);
}

.text-gray {
  color: var(--pc-text-3, #8a8175);
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

  /*
   * PC 壳层（html.pc-shell）：左栏固定，仅右侧 uni-main 滚动。
   * 改页面内容时不要动这里；约束见 doc/pc-shell-layout.md
   */
  html.pc-shell,
  html.pc-shell body {
    height: 100%;
    overflow: hidden;
  }

  html.pc-shell uni-app,
  html.pc-shell uni-layout,
  html.pc-shell uni-content {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  html.pc-shell uni-left-window,
  html.pc-shell .uni-left-window {
    flex-shrink: 0;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    background: var(--pc-rail-bg, #ebe4d8);
  }

  html.pc-shell uni-main {
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--pc-main-bg, #f4f1ea);
  }

  /* 统一内容区底：认读 .desk / 图鉴 .atlas-page / 各页 .container 都跟主题 */
  html.pc-shell uni-page-body,
  html.pc-shell uni-main page {
    background: var(--pc-main-bg, #f4f1ea) !important;
  }

  html.pc-shell uni-main .container,
  html.pc-shell uni-main .desk,
  html.pc-shell uni-main .atlas-page {
    background-color: var(--pc-main-bg, #f4f1ea) !important;
    background-image: none !important;
  }

  html.pc-chromeless uni-main .container {
    max-width: 1080px;
    margin-left: auto;
    margin-right: auto;
    box-sizing: border-box;
  }
}
</style>
