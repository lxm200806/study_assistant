<template>
  <view class="desk">
    <view class="setup">
      <text class="eyebrow">账号</text>
      <text class="title">会员</text>
      <text class="lede">按学科购买会员；开通后，这个账号下的角色都可以用。</text>

      <view class="plan current-plan">
        <text class="plan-name">{{ currentPlanTitle }}</text>
        <template v-if="entitlements.subscriptions.length">
          <text
            v-for="item in entitlements.subscriptions"
            :key="item.id"
            class="plan-line"
          >{{ item.planName }} · 到期 {{ formatDate(item.endsAt) }}</text>
        </template>
        <text v-else-if="legacyActive" class="plan-line">
          历史会员授权 · 到期 {{ formatDate(entitlements.snapshot?.legacyPlan.expiresAt) }}
        </text>
        <text v-else class="plan-line">免费词书 + 基础练习</text>
        <text class="plan-line">AI 点数：{{ entitlements.credits }}</text>
      </view>

      <view v-for="group in planGroups" :key="group.subject" class="plan-group">
        <text class="label">{{ group.label }}</text>
        <view
          v-for="plan in group.plans"
          :key="plan.code"
          :class="['plan', group.plans.length === 1 ? 'featured' : '']"
        >
          <text class="plan-name">{{ plan.name }} · {{ planPriceLabel(plan) }}</text>
          <text class="plan-line">{{ plan.description || '开通后解锁对应权限' }}</text>
          <button class="start" :disabled="paying" @tap="subscribe(plan.code)">
            {{ paying ? '处理中…' : hasPlan(plan) ? '续费' : '购买' }}
          </button>
        </view>
      </view>
      <text v-if="!plans.length" class="hint">暂无可购买套餐，请稍后再试。</text>

      <view class="plan">
        <text class="plan-name">免费版</text>
        <text class="plan-line">PEP/JT 小学及 KET 免费词书 · 认读/拼读/文章/测验 · 文本 AI 5 条/天</text>
      </view>

      <text class="label">词书解锁</text>
      <view v-for="book in books" :key="book.code" class="book-row">
        <text class="book-name">{{ book.name }}</text>
        <text :class="['book-status', isUnlocked(book) ? 'on' : '']">
          {{ isUnlocked(book) ? '已解锁' : '会员解锁' }}
        </text>
      </view>

      <text class="label">学习周报</text>
      <view v-if="weeklyReport" class="report">
        <text>本周学习 {{ weeklyReport.totalWords }} 词 · 活跃 {{ weeklyReport.activeDays }} 天</text>
        <text>正确率 {{ weeklyReport.accuracy }}% · 连续打卡 {{ weeklyReport.streak }} 天</text>
      </view>
      <text v-else class="hint">暂无周报数据</text>
      <button class="ghost" @tap="shareReport">复制周报</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import { useUserStore } from '@/stores/user'
import { useEntitlementsStore } from '@/stores/entitlements'
import { billingAPI, statsAPI } from '@/utils/api'
import type { BillingPlan } from '@/api'
import { PERMISSIONS } from '@/utils/permissions'
import { requireReadySession } from '@/utils/subject'

const vocabStore = useVocabularyStore()
const userStore = useUserStore()
const entitlements = useEntitlementsStore()

const books = ref<Array<{ code: string; name: string; isFree?: boolean }>>([])
const plans = ref<BillingPlan[]>([])
const paying = ref(false)
const weeklyReport = ref<{
  totalWords: number
  activeDays: number
  accuracy: number
  streak: number
} | null>(null)

const SUBJECT_LABELS: Record<string, string> = {
  english: '英语',
  chinese: '语文',
  math: '数学',
  ai: 'AI 加购',
  bundle: '全科',
  family: '家庭'
}

const currentPlanTitle = computed(() => {
  if (entitlements.has(PERMISSIONS.ENGLISH_BOOKS_ALL)) return '英语会员已开通'
  if (entitlements.subscriptions.length) return '会员已开通'
  return '免费版'
})

const legacyActive = computed(() => {
  const legacy = entitlements.snapshot?.legacyPlan
  if (!legacy || legacy.plan !== 'premium') return false
  return !legacy.expiresAt || new Date(legacy.expiresAt) > new Date()
})

const planGroups = computed(() => {
  const groups = new Map<string, BillingPlan[]>()
  for (const plan of plans.value) {
    const subject = plan.subject || 'english'
    const list = groups.get(subject) || []
    list.push(plan)
    groups.set(subject, list)
  }
  return [...groups.entries()].map(([subject, groupPlans]) => ({
    subject,
    label: SUBJECT_LABELS[subject] || subject,
    plans: groupPlans
  }))
})

function isUnlocked(book: { isFree?: boolean }) {
  return entitlements.has(PERMISSIONS.ENGLISH_BOOKS_ALL) || book.isFree === true
}

function priceLabel(plan: BillingPlan) {
  return (plan.priceCents / 100).toFixed(2).replace(/\.00$/, '')
}

function planPriceLabel(plan: BillingPlan) {
  const price = `¥${priceLabel(plan)}`
  return plan.days > 0 ? `${price} / ${plan.days} 天` : price
}

function hasPlan(plan: BillingPlan) {
  if (plan.kind === 'credit') return false
  return entitlements.subscriptions.some(item => item.planCode === plan.code)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '长期有效'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN')
}

async function subscribe(planCode: string) {
  if (paying.value) return
  paying.value = true
  try {
    const created = await billingAPI.createOrder(planCode)
    const order = created.data
    if (!order?.id) throw new Error('创建订单失败')
    await billingAPI.payOrder(order.id)
    await userStore.refreshProfile()
    await entitlements.load(true)
    const plan = plans.value.find(item => item.code === planCode)
    uni.showToast({
      title: plan?.kind === 'credit' ? '点数已到账' : '会员已开通',
      icon: 'success'
    })
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '支付失败', icon: 'none' })
  } finally {
    paying.value = false
  }
}

function shareReport() {
  if (!weeklyReport.value) {
    uni.showToast({ title: '暂无周报', icon: 'none' })
    return
  }
  const r = weeklyReport.value
  const text = `本周学习 ${r.totalWords} 词，活跃 ${r.activeDays} 天，正确率 ${r.accuracy}%，连续 ${r.streak} 天`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '周报已复制', icon: 'success' })
  })
}

onMounted(async () => {
  // 账号页：未选角色、还没有角色时也要能打开，避免一直被踢回角色页
  if (!(await requireReadySession({ allowNoStudents: true, allowMissingRole: true }))) return
  if (!userStore.isParent) {
    try {
      await userStore.chooseParentRole()
    } catch {
      return
    }
  }
  await entitlements.load(true)
  try {
    await vocabStore.loadBooks()
    books.value = vocabStore.books as typeof books.value
  } catch {
    books.value = []
  }
  try {
    const result = await billingAPI.plans()
    plans.value = (result.data as BillingPlan[]) || []
  } catch {
    plans.value = []
  }
  try {
    const res = await statsAPI.weeklyReport()
    weeklyReport.value = res.data as typeof weeklyReport.value
  } catch {
    weeklyReport.value = null
  }
})
</script>

<style lang="scss" scoped>
.desk {
  min-height: 100vh;
  background: #f4f1ea;
  color: #1f1a14;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}

.setup {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 22px 80px;
}

.eyebrow {
  display: block;
  font-size: 13px;
  letter-spacing: 0.14em;
  color: #8a8175;
}

.title {
  display: block;
  margin-top: 8px;
  font-family: Palatino, "Palatino Linotype", "Songti SC", serif;
  font-size: 40px;
}

.lede, .hint, .plan-line, .report text {
  display: block;
  color: #6d645b;
  font-size: 14px;
  line-height: 1.6;
}

.lede { margin: 10px 0 22px; }

.label {
  display: block;
  margin: 24px 0 10px;
  font-size: 13px;
  font-weight: 650;
}

.plan-group {
  margin-bottom: 8px;
}

.plan {
  border: 1px solid #e0d7cb;
  border-radius: 16px;
  padding: 16px 18px;
  margin-bottom: 12px;
}

.plan.featured {
  border-color: var(--pc-accent, #0f6e6a);
}

.current-plan {
  background: var(--pc-surface-2, #fffdf8);
  border-color: var(--pc-accent, #0f6e6a);
}

.plan-name {
  display: block;
  font-size: 18px;
  font-weight: 650;
}

.plan-line {
  margin-top: 6px;
}

.start, .ghost {
  margin-top: 14px;
  border-radius: 999px;
  font-size: 15px;
}

.start {
  background: #0f6e6a;
  color: #fff;
}

.ghost {
  background: transparent;
  color: #1f1a14;
  border: 1px solid #e0d7cb;
}

.book-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #efe7da;
}

.book-name { font-size: 15px; }
.book-status { font-size: 13px; color: #8a8175; }
.book-status.on { color: #0f6e6a; }

.report {
  border: 1px solid #e0d7cb;
  border-radius: 12px;
  padding: 14px 16px;
}
</style>
