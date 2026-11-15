<template>
  <view :class="['rail', expanded ? '' : 'is-narrow']" @mouseenter="hovering = true" @mouseleave="hovering = false">
    <view class="rail-top">
      <view v-if="expanded" class="brand">
        <text class="brand-name" @tap="open('/pages/home/home')">学习助手</text>
        <view class="pin" :title="pinned ? '取消固定' : '固定侧栏'" @tap="togglePin">
          <PcRailIcon name="pin" />
        </view>
      </view>

      <view
        v-for="item in mainItems"
        :key="item.key"
        :class="['row', isCurrent(item) ? 'is-on' : '']"
        :title="item.label"
        @tap="open(item.url)"
      >
        <PcRailIcon :name="item.icon" />
        <text class="label">{{ item.label }}</text>
      </view>

      <template v-if="moreItems.length">
        <view
          :class="['row', 'more-toggle', !moreOpen && moreCurrent ? 'is-on' : '']"
          title="发展"
          @tap="moreOpen = !moreOpen"
        >
          <PcRailIcon name="layers" />
          <text class="label">发展</text>
          <text class="chev">{{ moreOpen ? '▴' : '▾' }}</text>
        </view>
        <view v-show="expanded && moreOpen" class="more">
          <view
            v-for="item in moreItems"
            :key="item.key"
            :class="['row', 'sub', isCurrent(item) ? 'is-on' : '']"
            :title="item.label"
            @tap="open(item.url)"
          >
            <PcRailIcon :name="item.icon" />
            <text class="label">{{ item.label }}</text>
          </view>
        </view>
      </template>
    </view>

    <view class="rail-foot">
      <view v-if="expanded && userStore.isParent" class="subject">
        <text :class="['subject-btn', !userStore.isChinese ? 'is-on' : '']" @tap="switchSubject('english')">英语</text>
        <text :class="['subject-btn', userStore.isChinese ? 'is-on' : '']" @tap="switchSubject('chinese')">语文</text>
      </view>
      <view :class="['row', isMine ? 'is-on' : '']" title="我的" @tap="open('/pages/mine/mine')">
        <PcRailIcon name="mine" />
        <text class="label">{{ footLabel }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onMounted } from 'vue'
import PcRailIcon from '@/components/PcRailIcon.vue'
import { useUserStore } from '@/stores/user'
import { isTabPage } from '@/utils/navigation'
import { applyRailWidth, installPcRouteSync, pcPath } from '@/utils/pc-route'
import type { Subject } from '@/utils/subject'

type RailItem = {
  key: string
  label: string
  url: string
  icon: string
  show: () => boolean
  match: (path: string) => boolean
}

const userStore = useUserStore()
const pinned = ref(readPinned())
const hovering = ref(false)
const moreOpen = ref(false)
const expanded = computed(() => pinned.value || hovering.value)

const mainItems = computed<RailItem[]>(() => {
  const chinese = userStore.isChinese
  const student = userStore.isStudentRole
  const items: RailItem[] = []
  // 英语：侧栏直接进认读/拼读，不再放今日。语文仍用今日看课程。
  if (chinese) {
    items.push({
      key: 'home',
      label: '今日',
      url: '/pages/home/home',
      icon: 'home',
      show: () => true,
      match: (path) => path === '/pages/home/home'
    })
  }
  if (!chinese) {
    items.push(
      {
        key: 'recognition',
        label: '认读',
        url: '/pages/recognition/recognition',
        icon: 'read',
        show: () => true,
        match: (path) => path.startsWith('/pages/recognition/')
      },
      {
        key: 'typing',
        label: '拼读',
        url: '/pages/typing/typing',
        icon: 'keyboard',
        show: () => true,
        match: (path) => path.startsWith('/pages/typing/')
      },
      {
        key: 'atlas',
        label: '图鉴',
        url: '/pages/vocabulary-map/vocabulary-map',
        icon: 'atlas',
        show: () => true,
        match: (path) =>
          path === '/pages/vocabulary-map/vocabulary-map' ||
          path === '/pages/vocabulary/vocabulary'
      }
    )
  }
  if (!student && chinese) {
    items.push(
      {
        key: 'courses',
        label: '课程',
        url: '/pages/chinese/courses',
        icon: 'courses',
        show: () => true,
        match: (path) =>
          path === '/pages/chinese/courses' ||
          path.startsWith('/pages/chinese/plan') ||
          path.startsWith('/pages/chinese/stats') ||
          path.startsWith('/pages/chinese/drill')
      },
      {
        key: 'mastery',
        label: '掌握',
        url: '/pages/vocabulary/vocabulary',
        icon: 'chart',
        show: () => true,
        match: (path) => path === '/pages/vocabulary/vocabulary'
      },
      {
        key: 'cover',
        label: '覆盖',
        url: '/pages/vocabulary-map/vocabulary-map',
        icon: 'coverage',
        show: () => true,
        match: (path) => path === '/pages/vocabulary-map/vocabulary-map'
      }
    )
  }
  return items.filter((item) => item.show())
})

const moreItems = computed<RailItem[]>(() => {
  const chinese = userStore.isChinese
  const student = userStore.isStudentRole
  const parent = userStore.isParent
  const admin = userStore.isAdmin
  const items: RailItem[] = []

  if (!chinese && student) {
    items.push(item('speak', '口语', '/pages/speaking/speaking', 'speak'))
  }
  if (!chinese && parent) {
    items.push(
      item('books', '词书', '/pages/books/books', 'book'),
      item('chat', '陪聊', '/pages/chat/chat', 'chat'),
      item('quiz', '小测', '/pages/quiz/quiz', 'quiz'),
      item('member', '会员', '/pages/membership/membership', 'crown'),
      item('students', '学生', '/pages/family/students', 'users')
    )
    if (admin) items.push(item('admin', '词库', '/pages/admin/admin', 'gear'))
  }
  if (chinese && parent) {
    items.push(
      item('library', '组课', '/pages/chinese/library', 'library'),
      item('points', '知识点', '/pages/chinese/points', 'points'),
      item('materials', '教材', '/pages/chinese/materials', 'materials'),
      item('coverage', '全库', '/pages/chinese/coverage', 'coverage')
    )
    if (admin) items.push(item('drafts', '草稿', '/pages/chinese/drafts', 'gear'))
  }
  return items
})

const moreCurrent = computed(() => moreItems.value.some((item) => item.match(pcPath.value)))
const isMine = computed(() => pcPath.value === '/pages/mine/mine')
const footLabel = computed(() => {
  if (userStore.isStudentRole) return userStore.learnerName || '我的'
  return userStore.displayName || '我的'
})

watch(expanded, (open) => applyRailWidth(open))
watch(pcPath, (path) => {
  if (moreItems.value.some((item) => item.match(path))) moreOpen.value = true
  applyRailWidth(expanded.value)
})

onMounted(() => {
  installPcRouteSync()
  applyRailWidth(expanded.value)
})

function item(key: string, label: string, url: string, icon: string): RailItem {
  return {
    key,
    label,
    url,
    icon,
    show: () => true,
    match: (path) => path === url || path.startsWith(`${url}?`)
  }
}

function isCurrent(entry: RailItem) {
  return entry.match(pcPath.value)
}

function open(url: string) {
  const path = url.split('?')[0]
  if (path === pcPath.value) return
  if (isTabPage(path)) {
    uni.switchTab({ url: path })
    return
  }
  uni.navigateTo({ url })
}

function togglePin() {
  pinned.value = !pinned.value
  try {
    localStorage.setItem('pc-rail-pinned', pinned.value ? '1' : '0')
  } catch {
    /* storage can be unavailable in private mode */
  }
  if (!pinned.value) hovering.value = true
}

async function switchSubject(subject: Subject) {
  if (userStore.activeSubject === subject) return
  await userStore.setSubject(subject)
  uni.switchTab({ url: '/pages/home/home' })
}

function readPinned() {
  try {
    return localStorage.getItem('pc-rail-pinned') !== '0'
  } catch {
    return true
  }
}
</script>

<style scoped lang="scss">
.rail {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #f7f7f7;
  color: #2c3338;
  box-sizing: border-box;
  user-select: none;
  overflow: hidden;
}

.rail-top {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px 12px 8px;
}

.rail-foot {
  padding: 8px 12px 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 8px 12px;
}

.brand-name {
  font-size: 16px;
  font-weight: 650;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.pin {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d5d8dc;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  flex: 0 0 auto;
}

.pin :deep(.rail-ico) {
  width: 16px;
  height: 16px;
  transform: rotate(-45deg);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  margin: 4px 0;
  padding: 8px 10px;
  border-radius: 8px;
  color: #2c3338;
  cursor: pointer;
  box-sizing: border-box;
}

.row:hover {
  background: #eceef0;
}

.row.is-on {
  background: #dadcde;
  font-weight: 600;
}

.label {
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
}

.chev {
  margin-left: auto;
  color: #8b9198;
  font-size: 11px;
}

.more .sub {
  padding-left: 16px;
}

.subject {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 6px;
  background: #eceef0;
  border-radius: 999px;
}

.subject-btn {
  flex: 1;
  text-align: center;
  height: 28px;
  line-height: 28px;
  border-radius: 999px;
  font-size: 13px;
  color: #5c6570;
  cursor: pointer;
}

.subject-btn.is-on {
  background: #fff;
  color: #1f1a14;
  font-weight: 650;
}

.is-narrow .label,
.is-narrow .chev {
  opacity: 0;
  width: 0;
  overflow: hidden;
  pointer-events: none;
}

.is-narrow .rail-top,
.is-narrow .rail-foot {
  padding-left: 10px;
  padding-right: 10px;
}
</style>
