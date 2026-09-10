<template>
  <view class="container">
    <text v-if="courseName" class="course-name">{{ courseName }}</text>
    <view class="mode-switch">
      <view
        v-for="item in modeOptions"
        :key="item.id"
        :class="['mode-btn', mode === item.id ? 'active' : '', modeLocked ? 'disabled' : '']"
        @tap="selectMode(item.id)"
      >
        <text class="mode-label">
          {{ item.label }}
          <text v-if="modeCounts[item.id] != null" class="mode-count">{{ modeCounts[item.id] }}</text>
        </text>
        <text class="mode-hint">{{ item.hint }}</text>
      </view>
    </view>

    <text v-if="loading" class="muted">正在准备今日默写…</text>
    <template v-else>
      <view class="card status" :class="progress.status">
        <text class="today-title">{{ statusTitle }}</text>
        <text class="hint">{{ statusHint }}</text>
        <text v-if="cheerText" class="cheer">{{ cheerText }}</text>
      </view>
      <text class="hint">{{ modeHint }}</text>
      <view class="pref" @tap="toggleReviewPref">
        <text class="check">{{ reviewDefaultTest ? '☑' : '☐' }}</text>
        <text>有到期复习时，默认进入复习测验</text>
      </view>

      <template v-if="card">
        <text class="muted">
          {{ card.grade || '未分年级' }} · {{ difficultyLabel(card.difficulty) || levelLabel(card.level) }} · {{ kindLabel(card.kind) }}
          · {{ mode === 'recite' ? '朗读背诵' : card.role === 'review' ? '复习' : '新学' }}
          · 第 {{ card.taskIndex || index + 1 }} / {{ card.taskCount || queue.length }} 张学习卡
        </text>
        <text v-if="card.groupSize > 1" class="muted">
          本卡 {{ card.groupIndex }} / {{ card.groupSize }}
          <template v-if="mode !== 'recite'"> · {{ card.groupEnergy || 0 }} 能</template>
        </text>
        <text v-if="card.parts > 1" class="muted">大卡拆天：{{ card.part }} / {{ card.parts }}</text>
        <text v-if="card.source && mode !== 'test'" class="muted">{{ card.source }}</text>
        <text class="muted">{{ questionTypeLabel(questionType) }}<template v-if="mode !== 'test' && card.lemma && !isJudgeWidget && !isChoiceWidget"> · {{ card.lemma }}</template></text>
        <text class="prompt">{{ card.prompt }}</text>

        <template v-if="isReciteWidget && !result">
          <button class="btn-secondary" @tap="speak">听写朗读</button>
          <view class="recite-lines">
            <text v-for="(line, lineIndex) in reciteLines" :key="lineIndex" class="recite-line">
              {{ lineIndex >= revealedCount ? '（已遮住）' : line }}
            </text>
          </view>
          <button class="btn-secondary compact" @tap="revealNext">显示下一行</button>
          <button v-if="revealedCount < reciteLines.length" class="btn-secondary compact" @tap="revealAll">对照全文</button>
          <button class="btn-primary compact" @tap="nextCard">下一题</button>
        </template>

        <template v-else-if="isJudgeWidget && !result">
          <text class="judge">{{ judgeDisplay }}</text>
          <view class="choice-row">
            <button class="btn-primary compact" @tap="pickAnswer('对')">对</button>
            <button class="btn-secondary compact" @tap="pickAnswer('错')">错</button>
          </view>
        </template>

        <template v-else-if="isChoiceWidget && !result">
          <button
            v-for="(choice, choiceIndex) in choiceOptions"
            :key="choiceIndex"
            class="btn-secondary choice"
            @tap="pickAnswer(choice)"
          >{{ choice }}</button>
        </template>

        <template v-else-if="!result">
          <textarea class="answer" v-model="answer" placeholder="默写答案" />
          <button class="btn-primary" :disabled="busy" @tap="submit(false)">提交</button>
          <button v-if="mode === 'learn'" class="btn-secondary" :disabled="busy" @tap="submit(true)">不会，看答案</button>
          <button class="btn-secondary" @tap="speak">听写朗读</button>
        </template>

        <view v-else class="card result" :class="resultTone">
          <text class="today-title">{{ feedbackTitle }}</text>
          <text class="hint">{{ feedbackHint }}</text>
          <text v-if="wrongChars.length" class="bad">不一样的字：{{ wrongChars.join('、') }}</text>
          <text>标准答案：{{ result.answer }}</text>
          <text v-if="card.options?.explanation" class="hint">解析：{{ card.options.explanation }}</text>
          <view v-if="!result.revealed && result.chars && result.chars.length" class="diff">
            <text
              v-for="(ch, i) in result.chars"
              :key="i"
              :class="ch.ok ? 'ok' : 'bad'"
            >{{ ch.char }}</text>
          </view>
          <text class="muted">{{ feedbackNext }}</text>
          <button class="btn-primary" @tap="nextCard">下一题</button>
        </view>
      </template>

      <view v-else-if="itemCount === 0" class="card empty">
        <text class="today-title">这门课还没有知识点</text>
        <text class="hint">请回课程页点「同步新词」，或去组课按年级生成一份。</text>
      </view>
      <view v-else class="card empty">
        <text class="today-title">{{ emptyTitle }}</text>
        <text class="hint">{{ emptyHint }}</text>
        <text v-if="cheerText" class="cheer">{{ cheerText }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { chineseAPI } from '@/utils/api'
import { difficultyLabel, kindLabel, levelLabel, questionTypeLabel } from '@/utils/chinese'
import { requireSubject } from '@/utils/subject'

const FALLBACK_MODES = [
  { id: 'learn', label: '学一学', hint: '新题＋提示' },
  { id: 'test', label: '复习测验', hint: '只测到期' },
  { id: 'recite', label: '朗读背诵', hint: '不计成绩' }
]

const courseId = ref('')
const courseName = ref('')
const queue = ref<any[]>([])
const index = ref(0)
const answer = ref('')
const result = ref<any>(null)
const loading = ref(true)
const busy = ref(false)
const itemCount = ref(0)
const mode = ref('learn')
const modeOptions = ref(FALLBACK_MODES)
const modeCounts = ref<Record<string, number>>({})
const progress = ref<any>({})
const sessionStreak = ref(0)
const sessionDoneCount = ref(0)
const sessionAttempts = ref(0)
const revealedCount = ref(0)
const reviewDefaultTest = ref(false)
const prefBusy = ref(false)

const card = computed(() => queue.value[index.value] || null)
const questionType = computed(() => card.value?.questionType || 'dictation')
const isJudgeWidget = computed(() => ['char_judge', 'usage_judge'].includes(questionType.value))
const isChoiceWidget = computed(() => ['meaning_choice', 'context_choice'].includes(questionType.value))
const isReciteWidget = computed(() => {
  if (mode.value === 'test' || isJudgeWidget.value || isChoiceWidget.value) return false
  return questionType.value === 'recite' || mode.value === 'recite'
})
const judgeDisplay = computed(() => card.value?.options?.display || card.value?.lemma || '')
const choiceOptions = computed(() => (Array.isArray(card.value?.options?.choices) ? card.value.options.choices : []))
const reciteLines = computed(() => {
  if (!card.value) return []
  if (Array.isArray(card.value.lines) && card.value.lines.length) return card.value.lines
  const text = String(card.value.answer || '').trim()
  return text ? [text] : ['（暂无原文）']
})
const modeLocked = computed(() => loading.value || busy.value || !!result.value || !!answer.value.trim() || revealedCount.value > 0)
const modeHint = computed(() => {
  if (mode.value === 'test') return '复习测验只检查到期内容：不显示词条和来源，提交前不能看答案。'
  if (mode.value === 'recite') return '朗读背诵只安排适合读背的诗文和名句，不计成绩，不改变复习日期。'
  return '学一学包含新题和到期复习；不会时可以看答案，系统仍会安排后续复习。'
})
const cheerText = computed(() => {
  const parts = []
  const streak = sessionAttempts.value > 0 ? sessionStreak.value : Number(progress.value.todayStreak) || 0
  const done = (Number(progress.value.todayDoneCount) || 0) + sessionDoneCount.value
  if (streak > 0) parts.push(`连续正确 ${streak}`)
  if (done > 0) parts.push(`今日已完成 ${done} 条`)
  return parts.join(' · ')
})
const statusTitle = computed(() => {
  if (mode.value === 'test') return queue.value.length ? `到期复习 ${queue.value.length} 张` : '今天没有到期复习'
  if (mode.value === 'recite') return queue.value.length ? `可朗读背诵 ${queue.value.length} 张` : '今天没有读背内容'
  return progress.value.title || '今日学习'
})
const statusHint = computed(() => {
  if (mode.value === 'test') return queue.value.length ? '独立完成后再核对答案。' : '可以切到「学一学」练新卡。'
  if (mode.value === 'recite') return queue.value.length ? '按顺序朗读、逐行背诵，不计入学习进度。' : '今天的任务中没有诗文或名句。'
  return progress.value.hint || ''
})
const emptyTitle = computed(() => {
  if (mode.value === 'test') return '没有需要测验的题卡'
  if (mode.value === 'recite') return '没有可读背的题卡'
  if (progress.value.status === 'done' || progress.value.todayDone) return '今天练完了'
  return statusTitle.value || '今天的学习完成了'
})
const emptyHint = computed(() => {
  if (mode.value === 'test') return '可以切到「学一学」练新卡，或明天再来复习。'
  if (mode.value === 'recite') return '今天的任务中没有适合朗读背诵的诗文或名句。'
  return progress.value.hint || '今天没有要练的卡片。'
})
const feedback = computed(() => result.value?.feedback || {})
const feedbackTitle = computed(() => feedback.value.title || (result.value?.correct ? '全对！' : '这题先记下'))
const feedbackHint = computed(() => feedback.value.hint || '')
const feedbackNext = computed(() => feedback.value.next || '')
const wrongChars = computed(() => {
  if (result.value?.revealed) return []
  return Array.isArray(feedback.value.wrongChars) ? feedback.value.wrongChars : []
})
const resultTone = computed(() => (result.value?.revealed ? 'warn' : result.value?.correct ? 'ok' : 'error'))

async function loadToday(requestedMode = '') {
  loading.value = true
  try {
    const data = (await chineseAPI.today(courseId.value, requestedMode || undefined)) as any
    itemCount.value = Number(data.itemCount) || 0
    progress.value = data.progress || {}
    courseName.value = String(data.courseName || '')
    if (courseName.value) {
      uni.setNavigationBarTitle({ title: courseName.value })
    }
    reviewDefaultTest.value = !!data.reviewDefaultTest
    if (Array.isArray(data.modes) && data.modes.length) modeOptions.value = data.modes
    modeCounts.value = data.modeCounts || {}
    sessionStreak.value = 0
    sessionDoneCount.value = 0
    sessionAttempts.value = 0
    mode.value = data.mode || data.defaultMode || requestedMode || 'learn'
    queue.value = data.items || []
    index.value = 0
    result.value = null
    answer.value = ''
    revealedCount.value = 0
  } catch (error: any) {
    uni.showToast({ title: error.message || '加载失败', icon: 'none' })
    queue.value = []
  } finally {
    loading.value = false
  }
}

function selectMode(id: string) {
  if (id === mode.value || modeLocked.value) return
  loadToday(id)
}

async function submit(reveal: boolean) {
  if (!card.value) return
  busy.value = true
  try {
    const data = (await chineseAPI.review(courseId.value, {
      pointId: card.value.id,
      answer: answer.value,
      reveal,
      mode: mode.value
    })) as any
    result.value = data
    if (data.updateSm2 !== false) {
      sessionAttempts.value += 1
      sessionStreak.value = data.correct ? sessionStreak.value + 1 : 0
      if (Number(data.quality) >= 3) sessionDoneCount.value += 1
      if (data.quality < 3) queue.value.push(card.value)
    }
  } catch (error: any) {
    uni.showToast({ title: error.message || '提交失败', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function nextCard() {
  index.value += 1
  result.value = null
  answer.value = ''
  revealedCount.value = 0
}

function revealNext() {
  if (revealedCount.value < reciteLines.value.length) revealedCount.value += 1
}

function revealAll() {
  revealedCount.value = reciteLines.value.length
}

async function toggleReviewPref() {
  if (prefBusy.value) return
  prefBusy.value = true
  try {
    const result = (await chineseAPI.patchCourse(courseId.value, { reviewDefaultTest: !reviewDefaultTest.value })) as any
    reviewDefaultTest.value = !!result.reviewDefaultTest
  } catch (error: any) {
    uni.showToast({ title: error.message || '保存失败', icon: 'none' })
  } finally {
    prefBusy.value = false
  }
}

function pickAnswer(value: string) {
  answer.value = value
  submit(false)
}

function speak() {
  if (!card.value || typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  let text = card.value.prompt
  if (isJudgeWidget.value) text = judgeDisplay.value || text
  else if (!isChoiceWidget.value && card.value.lemma) text = card.value.lemma
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-CN'
  utter.rate = 0.85
  window.speechSynthesis.speak(utter)
}

onLoad(async (query) => {
  if (!(await requireSubject('chinese', 'student'))) return
  courseId.value = String(query?.id || '')
  loadToday()
})
</script>

<style lang="scss" scoped>
.mode-switch { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.mode-btn { flex: 1; background: #fff; border-radius: 16rpx; padding: 16rpx; text-align: center; }
.mode-btn.active { background: #667eea; }
.mode-btn.active .mode-label, .mode-btn.active .mode-hint { color: #fff; }
.mode-label { display: block; font-weight: 700; font-size: 28rpx; }
.mode-count { display: inline-block; min-width: 32rpx; margin-left: 6rpx; padding: 0 8rpx; border-radius: 999rpx; background: rgba(102, 126, 234, .12); font-size: 20rpx; }
.mode-btn.active .mode-count { background: rgba(255, 255, 255, .24); }
.mode-hint { display: block; font-size: 22rpx; color: #888; }
.pref { display: flex; align-items: center; gap: 12rpx; margin: 12rpx 0; font-size: 26rpx; }
.check { color: #667eea; font-size: 32rpx; }
.muted, .hint { display: block; color: #888; font-size: 24rpx; margin-top: 8rpx; }
.course-name { display: block; font-size: 36rpx; font-weight: 700; color: #222; margin: 8rpx 8rpx 16rpx; }
.today-title { display: block; font-size: 32rpx; font-weight: 700; }
.cheer { display: block; margin-top: 8rpx; color: #667eea; }
.prompt { display: block; margin: 24rpx 0; font-size: 36rpx; font-weight: 700; }
.answer { width: 100%; min-height: 180rpx; background: #fff; border-radius: 16rpx; padding: 20rpx; margin: 16rpx 0; }
.judge { display: block; font-size: 48rpx; text-align: center; margin: 24rpx 0; }
.choice-row, .recite-lines { margin: 16rpx 0; }
.recite-line { display: block; padding: 12rpx 0; font-size: 30rpx; }
.compact { margin: 8rpx 0; }
.choice { margin: 8rpx 0; }
.diff { margin-top: 12rpx; font-size: 32rpx; letter-spacing: 4rpx; }
.ok { color: #16a34a; }
.bad { color: #dc2626; }
.result.ok { border-left: 8rpx solid #16a34a; }
.result.error { border-left: 8rpx solid #dc2626; }
.result.warn { border-left: 8rpx solid #d97706; }
</style>
