<template>
  <view class="desk">
    <view v-if="stage === 'setup'" class="setup">
      <text class="eyebrow">键盘练习</text>
      <text class="lede">在电脑上连续输入。Enter 提交，Alt 加字母做发音、收藏和提示。</text>

      <BookSwitcher training-type="writing" @change="onBookChange" />

      <view class="segment">
        <view :class="['seg', lane === 'words' ? 'on' : '']" @tap="lane = 'words'">单词</view>
        <view :class="['seg', lane === 'article' ? 'on' : '']" @tap="lane = 'article'">短文</view>
      </view>

      <template v-if="lane === 'words'">
        <view class="summary" v-if="summary">
          <text>到期 {{ summary.due }}</text>
          <text>新词 {{ summary.unseen }}</text>
          <text>错词 {{ summary.wrong }}</text>
          <text>收藏 {{ summary.favorite }}</text>
          <text>已跳过 {{ summary.skipped }}</text>
        </view>

        <text class="label">方式</text>
        <view class="chips">
          <view
            v-for="item in wordModes"
            :key="item.key"
            :class="['chip', wordMode === item.key ? 'on' : '']"
            @tap="wordMode = item.key"
          >{{ item.label }}</view>
        </view>

        <text class="label">词从哪来</text>
        <view class="chips">
          <view
            v-for="item in sources"
            :key="item.key"
            :class="['chip', source === item.key ? 'on' : '']"
            @tap="source = item.key"
          >{{ item.label }}</view>
        </view>
        <text class="hint">智能先练刚写错和到期的词，再补新词。标记已掌握的词会在智能、随机和词表里跳过。</text>

        <text class="label">这一组</text>
        <view class="chips">
          <view
            v-for="count in counts"
            :key="count"
            :class="['chip', groupSize === count ? 'on' : '']"
            @tap="groupSize = count"
          >{{ count }}</view>
        </view>

        <button class="start" :disabled="busy" @tap="startWords">开始</button>

        <view class="panel">
          <text class="panel-title">词表</text>
          <view v-for="item in lists" :key="item.id" class="saved-row">
            <text class="saved-name" @tap="startList(item.id)">{{ item.name }} · {{ item.count }}</text>
            <text class="saved-delete" @tap="removeList(item.id)">删除</text>
          </view>
          <text v-if="!lists.length" class="hint">还没有词表。粘贴已在词书里的单词即可。</text>
          <input
            class="field"
            v-model="listName"
            placeholder="词表名称"
            @focus="suspendKeys = true"
            @blur="suspendKeys = false"
          />
          <textarea
            class="area"
            v-model="listText"
            placeholder="每行一个，或用逗号分隔"
            @focus="suspendKeys = true"
            @blur="suspendKeys = false"
          />
          <button class="ghost" @tap="saveList">保存词表</button>
          <text v-if="listNote" class="hint">{{ listNote }}</text>
        </view>
      </template>

      <template v-else>
        <text class="label">方式</text>
        <view class="chips">
          <view :class="['chip', articleMode === 'follow' ? 'on' : '']" @tap="articleMode = 'follow'">跟写</view>
          <view :class="['chip', articleMode === 'dictation' ? 'on' : '']" @tap="articleMode = 'dictation'">听写</view>
        </view>
        <text class="hint">一句一句输入。有音频时会朗读当前句。译文按句对齐时才会在每句下面出现。</text>

        <view class="panel">
          <text class="panel-title">短文</text>
          <view v-for="item in articles" :key="item.id" class="saved-row">
            <text class="saved-name" @tap="startArticle(item.id)">{{ item.title }} · {{ item.sentenceCount }} 句</text>
            <text class="saved-delete" @tap="removeArticle(item.id)">删除</text>
          </view>
          <input
            class="field"
            v-model="articleTitle"
            placeholder="标题"
            @focus="suspendKeys = true"
            @blur="suspendKeys = false"
          />
          <textarea
            class="area"
            v-model="articleBody"
            placeholder="粘贴英文短文"
            @focus="suspendKeys = true"
            @blur="suspendKeys = false"
          />
          <textarea
            class="area"
            v-model="articleTranslation"
            placeholder="译文，可选。句数一致时会逐句对照"
            @focus="suspendKeys = true"
            @blur="suspendKeys = false"
          />
          <button class="ghost" @tap="saveArticle">保存短文</button>
        </view>
      </template>

      <view class="panel">
        <text class="panel-title">快捷键</text>
        <text class="hint">练习时按住 Alt。点按某一项后按一个字母即可更换。</text>
        <view v-for="item in shortcutRows" :key="item.action" class="saved-row" @tap="capturing = item.action">
          <text>{{ item.label }}</text>
          <text class="keycap">{{ capturing === item.action ? '按一个键' : 'Alt+' + shortcuts[item.action].toUpperCase() }}</text>
        </view>
        <view class="saved-row" @tap="toggleSound">
          <text>按键轻响</text>
          <text class="keycap">{{ keySound ? '开' : '关' }}</text>
        </view>
      </view>
    </view>

    <view v-else-if="stage === 'practice'" class="practice">
      <view class="topbar">
        <text class="top-meta">{{ progressLabel }}</text>
        <view class="accent-switch">
          <view :class="['mini', accent === 'uk' ? 'on' : '']" @tap="accent = 'uk'">英音</view>
          <view :class="['mini', accent === 'us' ? 'on' : '']" @tap="accent = 'us'">美音</view>
        </view>
        <text class="top-link" @tap="finishEarly">结束</text>
      </view>

      <view class="prompt">
        <text v-if="promptKicker" class="kicker">{{ promptKicker }}</text>
        <view v-if="showSpelling && followLive" :class="['live-line', lane === 'article' ? 'sentence' : '']">
          <text v-for="(mark, markIndex) in marks" :key="markIndex" :class="['glyph', mark.kind]">{{ mark.ch }}</text>
        </view>
        <text v-else-if="showSpelling" :class="['big-word', lane === 'article' ? 'sentence' : '']">{{ expectedText }}</text>
        <text v-else-if="lane === 'words' && wordMode === 'recall'" class="big-word meaning">{{ currentWord?.meaning }}</text>
        <view v-else-if="dictationMode" class="listen-mark" @tap="replay">
          <text class="listen-icon">听</text>
          <text class="listen-copy">{{ lane === 'article' ? '听这一句，再输入' : '听发音，再输入' }}</text>
        </view>
        <text v-else class="big-word mask">{{ maskedPrompt }}</text>
        <text v-if="showPhonetic && currentWord?.phonetic" class="phonetic">{{ currentWord.phonetic }}</text>
        <text v-if="showMeaningLine" class="meaning-line">{{ meaningLine }}</text>
        <text v-if="firstLetter" class="phonetic">首字母 {{ firstLetter }}</text>
      </view>

      <input
        class="answer"
        v-model="userInput"
        :focus="inputArmed"
        :disabled="showResult"
        confirm-type="done"
        :placeholder="placeholder"
        @confirm="onInputConfirm"
      />

      <view class="actions">
        <button v-if="!showResult" class="start slim" @tap="submit">提交</button>
        <button v-else class="start slim" @tap="nextItem">下一题</button>
        <button class="ghost slim" @tap="replay">发音</button>
        <button class="ghost slim" @tap="bumpHint">提示</button>
        <button v-if="currentWord" class="ghost slim" @tap="toggleFavorite">{{ currentWord.favorite ? '已收藏' : '收藏' }}</button>
        <button v-if="currentWord" class="ghost slim" @tap="toggleMastered">{{ currentWord.skipMastered ? '取消跳过' : '已掌握' }}</button>
        <button v-if="fullTranslation" class="ghost slim" @tap="showFullTranslation = !showFullTranslation">译文</button>
      </view>

      <view v-if="showResult" :class="['result', isCorrect ? 'good' : 'bad']">
        <text class="result-title">{{ isCorrect ? '正确' : '再看一眼' }}</text>
        <text class="result-word">{{ expectedText }}</text>
        <text v-if="!isCorrect && currentWord" class="hint">已记入错词本，之后可用「错词」复习。</text>
        <text v-else-if="clearedWrong" class="hint">这一题写对了，已从错词本移出。</text>
        <view v-if="graded.length" class="live-line result-line">
          <text v-for="(mark, index) in graded" :key="'g' + index" :class="['glyph', mark.kind]">{{ mark.ch }}</text>
        </view>
      </view>

      <view v-if="showExample || (showFullTranslation && fullTranslation)" class="aside">
        <text v-if="currentWord?.englishMeaning" class="aside-line">{{ currentWord.englishMeaning }}</text>
        <text v-if="exampleText" class="aside-line">{{ exampleText }}</text>
        <text v-if="sentenceTranslation" class="aside-line">{{ sentenceTranslation }}</text>
        <text v-else-if="showFullTranslation && fullTranslation" class="aside-line">{{ fullTranslation }}</text>
        <text v-if="currentWord?.topic" class="aside-line">{{ currentWord.topic }}</text>
      </view>

      <text class="legend">Enter 提交或下一题 · Alt+{{ shortcuts.replay.toUpperCase() }} 发音 · Alt+{{ shortcuts.favorite.toUpperCase() }} 收藏 · Alt+{{ shortcuts.mastered.toUpperCase() }} 已掌握 · Alt+{{ shortcuts.hint.toUpperCase() }} 提示 · Alt+{{ shortcuts.accent.toUpperCase() }} 英美</text>
    </view>

    <view v-else class="setup done">
      <text class="eyebrow">这一组完成</text>
      <text class="score">{{ correctCount }}/{{ answered.length }}</text>
      <text class="lede">正确率 {{ accuracy }}%</text>
      <view v-if="missed.length" class="panel">
        <text class="panel-title">写错的</text>
        <text v-for="item in missed" :key="item.id" class="missed">{{ item.label }}</text>
      </view>
      <button class="start" @tap="again">再来一组</button>
      <button v-if="lane === 'words'" class="ghost" @tap="againWrong">只练错词</button>
      <button class="ghost" @tap="backToSetup">返回选择</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BookSwitcher from '@/components/BookSwitcher.vue'
import { useVocabularyStore } from '@/stores/vocabulary'
import { typingAPI } from '@/utils/api'
import { isBrowserH5 } from '@/utils/audio-recording'
import { requireSubject } from '@/utils/subject'
import { speakPassage, speakText } from '@/utils/tts'
import {
  answersMatch,
  liveMarks,
  loadKeySound,
  loadShortcuts,
  playKeyClick,
  saveKeySound,
  saveShortcuts,
  type ShortcutAction
} from '@/utils/typing'

interface TypingWord {
  id: string
  word: string
  meaning: string
  phonetic: string
  englishMeaning?: string
  example?: string
  examples?: string[]
  topic?: string
  tags?: string[]
  favorite: boolean
  skipMastered: boolean
  inWrongBook: boolean
}

interface Summary {
  due: number
  unseen: number
  skipped: number
  wrong: number
  favorite: number
}

interface ListRow { id: string; name: string; count: number }
interface ArticleRow { id: string; title: string; sentenceCount: number }
interface SentenceItem { text: string; translation: string }
interface Answered { id: string; label: string; ok: boolean }

type WordMode = 'follow' | 'dictation' | 'self' | 'recall'
type ArticleMode = 'follow' | 'dictation'
type Source = 'smart' | 'wrong' | 'favorite' | 'random' | 'list'
type Stage = 'setup' | 'practice' | 'done'

const vocabStore = useVocabularyStore()
const isH5 = isBrowserH5()

const stage = ref<Stage>('setup')
const lane = ref<'words' | 'article'>('words')
const wordMode = ref<WordMode>('follow')
const articleMode = ref<ArticleMode>('follow')
const source = ref<Source>('smart')
const groupSize = ref(20)
const counts = [10, 20, 30]
const wordModes: Array<{ key: WordMode; label: string }> = [
  { key: 'follow', label: '跟写' },
  { key: 'dictation', label: '听写' },
  { key: 'self', label: '自测' },
  { key: 'recall', label: '默写' }
]
const sources: Array<{ key: Source; label: string }> = [
  { key: 'smart', label: '智能' },
  { key: 'wrong', label: '错词' },
  { key: 'favorite', label: '收藏' },
  { key: 'random', label: '随机' },
  { key: 'list', label: '词表' }
]

const summary = ref<Summary | null>(null)
const lists = ref<ListRow[]>([])
const articles = ref<ArticleRow[]>([])
const listName = ref('')
const listText = ref('')
const listNote = ref('')
const articleTitle = ref('')
const articleBody = ref('')
const articleTranslation = ref('')
const busy = ref(false)
const ready = ref(false)

const words = ref<TypingWord[]>([])
const sentences = ref<SentenceItem[]>([])
const fullTranslation = ref('')
const showFullTranslation = ref(false)
const index = ref(0)
const userInput = ref('')
const showResult = ref(false)
const isCorrect = ref(false)
const clearedWrong = ref(false)
const hintLevel = ref(0)
const selfVisible = ref(false)
const inputArmed = ref(false)
const accent = ref<'us' | 'uk'>('us')
const scopedToBook = ref(false)
const activeListId = ref('')
const answered = ref<Answered[]>([])
const correctCount = ref(0)
const suspendKeys = ref(false)
const shortcuts = ref(loadShortcuts())
const keySound = ref(loadKeySound())
const capturing = ref<ShortcutAction | null>(null)

const shortcutRows: Array<{ action: ShortcutAction; label: string }> = [
  { action: 'replay', label: '发音' },
  { action: 'favorite', label: '收藏' },
  { action: 'mastered', label: '已掌握' },
  { action: 'hint', label: '提示' },
  { action: 'accent', label: '切换英美' },
  { action: 'sound', label: '按键轻响' }
]

let selfTimer: ReturnType<typeof setTimeout> | null = null
let lastAction = 0

const currentWord = computed(() => (lane.value === 'words' ? words.value[index.value] : undefined))
const currentSentence = computed(() => (lane.value === 'article' ? sentences.value[index.value] : undefined))
const expectedText = computed(() => currentWord.value?.word || currentSentence.value?.text || '')
const total = computed(() => (lane.value === 'words' ? words.value.length : sentences.value.length))
const progressLabel = computed(() => {
  const mode = lane.value === 'words'
    ? wordModes.find(item => item.key === wordMode.value)?.label
    : (articleMode.value === 'follow' ? '跟写' : '听写')
  return `${mode} · ${Math.min(index.value + 1, total.value)}/${total.value}`
})
const activeArticleId = ref('')
const roundSaved = ref(false)
const dictationMode = computed(() => (
  (lane.value === 'words' && wordMode.value === 'dictation')
  || (lane.value === 'article' && articleMode.value === 'dictation')
))
const maskedPrompt = computed(() => '·'.repeat(Math.max(4, Math.min(expectedText.value.length, 24))))
const followLive = computed(() => {
  if (showResult.value) return false
  if (lane.value === 'article') return articleMode.value === 'follow'
  return wordMode.value === 'follow'
})
const showSpelling = computed(() => {
  if (!expectedText.value) return false
  if (showResult.value) return true
  if (lane.value === 'article') return articleMode.value === 'follow'
  if (wordMode.value === 'follow') return true
  if (wordMode.value === 'self') return selfVisible.value
  return false
})
const marks = computed(() => liveMarks(expectedText.value, userInput.value))
const graded = computed(() => (showResult.value ? liveMarks(expectedText.value, userInput.value) : []))
const showPhonetic = computed(() => {
  if (lane.value !== 'words' || !currentWord.value?.phonetic) return false
  if (showResult.value || wordMode.value === 'follow') return true
  return hintLevel.value >= 1
})
const showMeaningLine = computed(() => {
  if (lane.value !== 'words' || !currentWord.value) return false
  if (wordMode.value === 'recall' && !showResult.value) return !!currentWord.value.englishMeaning
  if (showResult.value || wordMode.value === 'follow') return true
  return hintLevel.value >= 1
})
const meaningLine = computed(() => {
  if (!currentWord.value) return ''
  if (wordMode.value === 'recall' && !showResult.value) return currentWord.value.englishMeaning || ''
  return currentWord.value.meaning
})
const firstLetter = computed(() => {
  if (showSpelling.value || hintLevel.value < 2) return ''
  return expectedText.value.trim().charAt(0)
})
const showExample = computed(() => showResult.value || (lane.value === 'words' && wordMode.value === 'follow'))
const exampleText = computed(() => currentWord.value?.example || currentWord.value?.examples?.[0] || '')
const sentenceTranslation = computed(() => (showResult.value ? currentSentence.value?.translation || '' : ''))
const promptKicker = computed(() => {
  if (lane.value === 'article') return articleMode.value === 'follow' ? '跟着这一句输入' : '听写这一句'
  if (wordMode.value === 'self' && selfVisible.value) return '看一眼，马上遮住'
  if (wordMode.value === 'self') return '凭刚才的印象输入'
  if (wordMode.value === 'recall') return '根据释义默写'
  if (wordMode.value === 'dictation') return '听写'
  return '跟着拼写'
})
const placeholder = computed(() => (lane.value === 'article' ? '输入这一句' : '输入单词'))
const accuracy = computed(() => (
  answered.value.length ? Math.round((correctCount.value / answered.value.length) * 100) : 0
))
const missed = computed(() => answered.value.filter(item => !item.ok))

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

async function loadSetup() {
  vocabStore.loadSettings()
  await vocabStore.loadBooks()
  await Promise.all([refreshSummary(), refreshLists(), refreshArticles()])
}

async function refreshSummary() {
  if (!vocabStore.currentBookCode) return
  try {
    const result = await typingAPI.summary(vocabStore.currentBookCode)
    summary.value = (result.data as Summary) || null
  } catch {
    summary.value = null
  }
}

async function refreshLists() {
  try {
    const result = await typingAPI.lists()
    lists.value = (result.data as ListRow[]) || []
  } catch {
    lists.value = []
  }
}

async function refreshArticles() {
  try {
    const result = await typingAPI.articles()
    articles.value = (result.data as ArticleRow[]) || []
  } catch {
    articles.value = []
  }
}

function onBookChange() {
  void refreshSummary()
}

function resetRound() {
  index.value = 0
  userInput.value = ''
  showResult.value = false
  isCorrect.value = false
  clearedWrong.value = false
  hintLevel.value = 0
  answered.value = []
  correctCount.value = 0
  roundSaved.value = false
}

function armSelf() {
  if (selfTimer) clearTimeout(selfTimer)
  selfVisible.value = lane.value === 'words' && wordMode.value === 'self'
  if (selfVisible.value) {
    selfTimer = setTimeout(() => {
      selfVisible.value = false
    }, 1600)
  }
}

async function focusInput() {
  inputArmed.value = false
  await Promise.resolve()
  inputArmed.value = true
}

function prepareCard() {
  userInput.value = ''
  showResult.value = false
  isCorrect.value = false
  clearedWrong.value = false
  hintLevel.value = 0
  showFullTranslation.value = false
  armSelf()
  void focusInput()
  if (dictationMode.value) void replay()
}

async function startWords() {
  if (source.value === 'list' && !activeListId.value && !lists.value[0]) {
    toast('先保存一个词表')
    return
  }
  const listId = source.value === 'list' ? (activeListId.value || lists.value[0]?.id) : undefined
  busy.value = true
  try {
    const result = await typingAPI.queue({
      bookCode: vocabStore.currentBookCode,
      source: source.value,
      count: groupSize.value,
      listId
    })
    const data = result.data as { words: TypingWord[]; scopedToBook: boolean; missing?: string[] }
    words.value = data?.words || []
    sentences.value = []
    fullTranslation.value = ''
    scopedToBook.value = !!data?.scopedToBook
    if (!words.value.length) {
      toast(source.value === 'wrong' ? '错词本是空的' : '这一组没有可练的词')
      return
    }
    if (data?.missing?.length) {
      toast(`有 ${data.missing.length} 个词不在词库里`)
    }
    lane.value = 'words'
    capturing.value = null
    resetRound()
    stage.value = 'practice'
    prepareCard()
  } catch (error) {
    toast((error as Error).message || '没能开始')
  } finally {
    busy.value = false
  }
}

async function startList(id: string) {
  activeListId.value = id
  source.value = 'list'
  await startWords()
}

async function startArticle(id: string) {
  busy.value = true
  try {
    const result = await typingAPI.article(id)
    const data = result.data as { sentences: SentenceItem[]; translation?: string }
    sentences.value = data?.sentences || []
    const paired = sentences.value.some(item => item.translation)
    fullTranslation.value = paired ? '' : (data?.translation || '')
    words.value = []
    scopedToBook.value = false
    activeArticleId.value = id
    if (!sentences.value.length) {
      toast('这篇短文没有英文句子')
      return
    }
    lane.value = 'article'
    capturing.value = null
    resetRound()
    stage.value = 'practice'
    prepareCard()
  } catch (error) {
    toast((error as Error).message || '没能打开短文')
  } finally {
    busy.value = false
  }
}

async function saveList() {
  if (!listText.value.trim()) {
    toast('先粘贴单词')
    return
  }
  try {
    const result = await typingAPI.createList(listName.value, listText.value)
    const data = result.data as { id: string; missing: string[]; matched: number }
    listText.value = ''
    listName.value = ''
    listNote.value = data?.missing?.length
      ? `已保存。未收录：${data.missing.slice(0, 8).join('、')}`
      : '已保存，词都在词库里'
    if (data?.id) activeListId.value = data.id
    await refreshLists()
  } catch (error) {
    toast((error as Error).message || '没能保存')
  }
}

async function removeList(id: string) {
  await typingAPI.deleteList(id)
  if (activeListId.value === id) activeListId.value = ''
  await refreshLists()
}

async function saveArticle() {
  if (!articleBody.value.trim()) {
    toast('先粘贴短文')
    return
  }
  try {
    await typingAPI.createArticle(articleTitle.value, articleBody.value, articleTranslation.value)
    articleTitle.value = ''
    articleBody.value = ''
    articleTranslation.value = ''
    await refreshArticles()
    toast('短文已保存')
  } catch (error) {
    toast((error as Error).message || '没能保存')
  }
}

async function removeArticle(id: string) {
  await typingAPI.deleteArticle(id)
  await refreshArticles()
}

async function replay() {
  const text = expectedText.value
  if (!text) return
  try {
    if (lane.value === 'article') await speakPassage(text, accent.value)
    else await speakText(text, 120, accent.value)
  } catch {
    toast('播放失败')
  }
}

function bumpHint() {
  hintLevel.value = Math.min(2, hintLevel.value + 1)
}

async function toggleFavorite() {
  const word = currentWord.value
  if (!word) return
  const next = !word.favorite
  word.favorite = next
  try {
    await typingAPI.mark(word.id, { favorite: next })
  } catch {
    word.favorite = !next
    toast('收藏没保存')
  }
}

async function toggleMastered() {
  const word = currentWord.value
  if (!word) return
  const next = !word.skipMastered
  word.skipMastered = next
  try {
    await typingAPI.mark(word.id, { skipMastered: next })
    toast(next ? '之后的智能、随机和词表会跳过它' : '已取消跳过')
  } catch {
    word.skipMastered = !next
    toast('没能保存')
  }
}

function guardAction() {
  const now = Date.now()
  if (now - lastAction < 250) return false
  lastAction = now
  return true
}

async function submit() {
  if (stage.value !== 'practice' || showResult.value || !expectedText.value) return
  if (!guardAction()) return
  if (!userInput.value.trim()) {
    toast('先输入')
    return
  }
  const ok = answersMatch(expectedText.value, userInput.value, lane.value === 'words' ? 'word' : 'sentence')
  isCorrect.value = ok
  showResult.value = true
  if (ok) correctCount.value += 1
  const word = currentWord.value
  answered.value.push({
    id: word?.id || `s${index.value}`,
    label: expectedText.value,
    ok
  })
  if (!word) return
  const wasWrong = word.inWrongBook
  try {
    const result = await typingAPI.answer(word.id, ok)
    const data = result.data as { favorite: boolean; skipMastered: boolean; inWrongBook: boolean }
    if (data) {
      word.favorite = data.favorite
      word.skipMastered = data.skipMastered
      word.inWrongBook = data.inWrongBook
      clearedWrong.value = ok && wasWrong && !data.inWrongBook
    }
  } catch {
    toast('这题的进度没保存')
  }
}

function onInputConfirm() {
  if (isH5) return
  void submit()
}

async function finishRound() {
  if (roundSaved.value) {
    stage.value = 'done'
    return
  }
  roundSaved.value = true
  const ids = lane.value === 'words' ? answered.value.map(item => item.id) : []
  try {
    if (scopedToBook.value && ids.length) {
      await vocabStore.completeSession(ids)
    } else if (answered.value.length) {
      await typingAPI.activity(answered.value.length)
    }
  } catch {
    toast('今日进度没记上')
  }
  stage.value = 'done'
}

function nextItem() {
  if (!showResult.value) return
  if (index.value + 1 >= total.value) {
    void finishRound()
    return
  }
  index.value += 1
  prepareCard()
}

function finishEarly() {
  if (!answered.value.length) {
    stage.value = 'setup'
    return
  }
  void finishRound()
}

function again() {
  if (lane.value === 'article' && activeArticleId.value) {
    void startArticle(activeArticleId.value)
    return
  }
  void startWords()
}

function againWrong() {
  source.value = 'wrong'
  void startWords()
}

function backToSetup() {
  stage.value = 'setup'
  void refreshSummary()
}

function toggleSound() {
  keySound.value = !keySound.value
  saveKeySound(keySound.value)
}

function runShortcut(action: ShortcutAction) {
  if (action === 'replay') void replay()
  else if (action === 'favorite') void toggleFavorite()
  else if (action === 'mastered') void toggleMastered()
  else if (action === 'hint') bumpHint()
  else if (action === 'accent') accent.value = accent.value === 'us' ? 'uk' : 'us'
  else if (action === 'sound') toggleSound()
}

function onKeyDown(event: KeyboardEvent) {
  if (!isH5 || suspendKeys.value || event.isComposing) return
  if (capturing.value && /^[a-z0-9]$/i.test(event.key)) {
    event.preventDefault()
    shortcuts.value = { ...shortcuts.value, [capturing.value]: event.key.toLowerCase() }
    saveShortcuts(shortcuts.value)
    capturing.value = null
    return
  }
  if (event.altKey && !event.repeat && stage.value === 'practice') {
    const key = event.key.toLowerCase()
    const action = (Object.keys(shortcuts.value) as ShortcutAction[]).find(name => shortcuts.value[name] === key)
    if (action) {
      event.preventDefault()
      runShortcut(action)
    }
    return
  }
  if (
    keySound.value
    && stage.value === 'practice'
    && !showResult.value
    && event.key.length === 1
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
  ) {
    playKeyClick()
  }
  if (event.key === 'Enter' && !event.shiftKey && stage.value === 'practice') {
    event.preventDefault()
    if (showResult.value) nextItem()
    else void submit()
  }
}

onShow(async () => {
  if (!(await requireSubject('english', 'student'))) return
  if (ready.value) return
  ready.value = true
  await loadSetup()
})

if (isH5 && typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeyDown)
}

onUnmounted(() => {
  if (selfTimer) clearTimeout(selfTimer)
  if (isH5 && typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown)
  }
})
</script>

<style scoped lang="scss">
.desk {
  min-height: 100vh;
  background: #f4f1ea;
  color: #1f1a14;
  font-family: "Avenir Next", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
}

.setup, .practice {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 22px 80px;
}

.eyebrow {
  display: block;
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8a8175;
}

.lede, .hint {
  display: block;
  color: #6d645b;
  font-size: 14px;
  line-height: 1.6;
  margin: 8px 0 18px;
}

.label, .panel-title {
  display: block;
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 650;
}

.segment, .chips, .accent-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.seg, .chip, .mini, .keycap {
  border: 1px solid #ddd4c6;
  background: transparent;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
}

.seg.on, .chip.on, .mini.on {
  background: #1f1a14;
  color: #f4f1ea;
  border-color: #1f1a14;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 14px 0;
  color: #3d4f4d;
  font-size: 14px;
}

.start, .ghost {
  margin-top: 16px;
  border-radius: 999px;
  font-size: 16px;
}

.start {
  background: #0f6e6a;
  color: white;
}

.ghost {
  background: transparent;
  color: #1f1a14;
  border: 1px solid #cfc6b8;
}

.start.slim, .ghost.slim {
  margin-top: 0;
  font-size: 14px;
  padding: 0 16px;
}

.panel {
  margin-top: 22px;
  padding-top: 8px;
  border-top: 1px solid #e4dccf;
}

.saved-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #efe7db;
  font-size: 15px;
}

.saved-name {
  color: #0f6e6a;
}

.saved-delete {
  color: #9a5b45;
}

.field, .area, .answer {
  width: 100%;
  box-sizing: border-box;
  margin-top: 10px;
  background: white;
  border: 1px solid #ddd4c6;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px;
}

.area {
  min-height: 96px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.top-meta, .top-link, .legend, .kicker, .phonetic, .meaning-line, .aside-line {
  font-size: 14px;
  color: #6d645b;
}

.top-link {
  color: #0f6e6a;
}

.prompt {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin: 28px 0 12px;
}

.big-word, .live-line {
  font-family: Palatino, "Palatino Linotype", "Iowan Old Style", "Songti SC", serif;
  font-size: 64px;
  line-height: 1.15;
  color: #1f1a14;
}

.big-word.sentence, .live-line.sentence, .big-word.mask {
  font-size: 32px;
  line-height: 1.45;
}

button.slim {
  width: auto;
  margin-left: 0;
  margin-right: 0;
}

.big-word.meaning {
  font-size: 42px;
}

.live-line {
  display: flex;
  flex-wrap: wrap;
  white-space: pre-wrap;
}

.glyph.ok { color: #0f6e6a; }
.glyph.bad, .glyph.extra { color: #9a3b2f; }
.glyph.pending { color: #c3b8a8; }

.listen-mark {
  display: flex;
  align-items: center;
  gap: 14px;
}

.listen-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #1f1a14;
  color: #f4f1ea;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.answer {
  font-size: 28px;
  padding: 16px 18px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.result {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 16px;
  background: white;
}

.result.good { box-shadow: inset 3px 0 0 #0f6e6a; }
.result.bad { box-shadow: inset 3px 0 0 #9a3b2f; }

.result-title, .result-word {
  display: block;
}

.result-word {
  font-size: 28px;
  margin-top: 4px;
}

.result-line {
  font-size: 22px;
  margin-top: 8px;
}

.aside {
  margin-top: 16px;
}

.legend {
  display: block;
  margin-top: 28px;
}

.done .score {
  display: block;
  font-family: Palatino, "Palatino Linotype", "Songti SC", serif;
  font-size: 72px;
  margin-top: 12px;
}

.missed {
  display: block;
  padding: 6px 0;
  font-size: 16px;
}

@media (max-width: 720px) {
  .big-word, .live-line {
    font-size: 40px;
  }
}
</style>
