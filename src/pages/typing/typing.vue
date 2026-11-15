<template>
  <view class="desk">
    <view v-if="stage === 'setup'" class="setup">
      <text class="eyebrow">键盘练习</text>
      <text class="lede">电脑端跟打对齐 TypeWords：有空格时词间单独按空格；小程序仍用输入框。</text>

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
            @tap="selectWordMode(item.key)"
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
        <text class="hint">智能先练刚写错和到期的词，再补新词。跟写、听写、自测、默写各自记到期时间。标记已掌握的词会在智能、随机和词表里跳过。</text>

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
          <text v-if="!lists.length" class="hint">还没有词表。词书里没有的拼写也会保存，并可以一起练习。</text>
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
            placeholder="每行一个，或用逗号分隔。释义写成：单词 | 中文 | syn: 同义 | uk: 英音 | us: 美音"
            @focus="suspendKeys = true"
            @blur="suspendKeys = false"
          />
          <button class="ghost" @tap="saveList">保存词表</button>
          <button class="ghost" @tap="pickListFile">从文件导入</button>
          <text v-if="listNote" class="hint">{{ listNote }}</text>
        </view>
      </template>

      <template v-else>
        <text class="label">方式</text>
        <view class="chips">
          <view :class="['chip', articleMode === 'follow' ? 'on' : '']" @tap="articleMode = 'follow'">跟写</view>
          <view :class="['chip', articleMode === 'dictation' ? 'on' : '']" @tap="articleMode = 'dictation'">听写</view>
        </view>
        <text class="hint">一句一句输入。跟写时看着句子，听写时先听再写。能朗读的句子会出声，太长会分段读。译文和英文句数一致时，跟写直接显示，听写在提交后显示。</text>
        <view class="summary" v-if="articleDue">
          <text>到期句子 {{ articleDue }}</text>
        </view>
        <button class="start" :disabled="busy" @tap="startDueReview">复习到期句子</button>
        <text v-if="!articleDue" class="hint">到了复习时间的句子会出现在这里，并单独记复习，不占用单词的书写记录。</text>

        <view class="panel">
          <text class="panel-title">短文</text>
          <view v-for="item in articles" :key="item.id" class="article-block">
            <view class="saved-row">
              <text class="saved-name" @tap="startArticle(item.id)">{{ articleLabel(item) }}</text>
              <text class="saved-edit" @tap="beginEdit(item)">{{ item.builtin ? '改编' : '编辑' }}</text>
              <text v-if="item.builtin" class="keycap">示例</text>
              <text v-else class="saved-delete" @tap="removeArticle(item.id)">删除</text>
            </view>
            <text v-if="item.source" class="hint source-line">{{ item.source }}</text>
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
            @blur="onArticleFieldBlur"
          />
          <textarea
            class="area"
            v-model="articleTranslation"
            placeholder="译文，可选。句数一致时会逐句对照"
            @focus="suspendKeys = true"
            @blur="onArticleFieldBlur"
          />
          <text v-if="editingId" class="hint">没改动的句子会留下复习进度。改过、拆开、合并或删掉的句子会重新开始。</text>
          <text v-if="editingBuiltin" class="hint">示例原文不会改，保存后成为你自己的一篇。</text>
          <text v-if="editImpact && editImpact.kept && (editImpact.reset || editImpact.retired)" class="hint">这次会保留 {{ editImpact.kept }} 句的进度，{{ editImpact.reset + editImpact.retired }} 句重新开始。</text>
          <button class="ghost" @tap="saveArticle">{{ editingId ? '保存修改' : '保存短文' }}</button>
          <button v-if="editingId" class="ghost" @tap="cancelEdit">取消编辑</button>
          <button class="ghost" @tap="pickArticleFile">从文件导入</button>
        </view>
      </template>

      <view class="panel">
        <text class="panel-title">练习记录</text>
        <text v-if="!historyLoaded" class="hint">正在读取练习记录。</text>
        <text v-else-if="!hasHistory" class="hint">完成一组后，这里会显示速度和每天练了多少。</text>
        <template v-else>
          <text class="label">速度 · 每分钟正确字符</text>
          <view v-if="history.speed.length" class="speed-chart">
            <view v-for="(point, pointIndex) in history.speed" :key="point.at + pointIndex" class="speed-col">
              <view class="speed-bar" :style="{ height: barHeight(point.charsPerMinute) }"></view>
            </view>
          </view>
          <text v-if="history.speed.length" class="hint">最近 {{ history.speed.length }} 组，最高 {{ maxSpeed }}。</text>
          <text v-else class="hint">组次太短时先不画速度，天数仍会计入下面的格子。</text>
          <text class="label">每天练习</text>
          <view class="heat">
            <view v-for="day in history.days" :key="day.date" :class="['heat-cell', 'lv-' + day.level]"></view>
          </view>
          <text class="hint">从左到右是时间先后。颜色越深，这一天完成的词或句子越多。</text>
        </template>
      </view>

      <view class="panel">
        <text class="panel-title">快捷键</text>
        <text class="hint">Mac 用 Option ⌥（或 Control）；Windows 用 Alt。点按某一项后按一个字母即可更换。</text>
        <view v-for="item in shortcutRows" :key="item.action" class="saved-row" @tap="capturing = item.action">
          <text>{{ item.label }}</text>
          <text class="keycap">{{ capturing === item.action ? '按一个键' : '⌥/Ctrl/Alt+' + shortcuts[item.action].toUpperCase() }}</text>
        </view>
        <view class="saved-row" @tap="toggleSound">
          <text>按键轻响</text>
          <text class="keycap">{{ keySound ? '开' : '关' }}</text>
        </view>
        <view class="saved-row" @tap="toggleAutoSpeak">
          <text>自动发音</text>
          <text class="keycap">{{ autoSpeak ? '开' : '关' }}</text>
        </view>
      </view>
    </view>

    <view v-else-if="stage === 'practice'" :class="['practice', isH5 ? 'practice-h5' : '']">
      <view class="progress-track" v-if="isH5">
        <view class="progress-fill" :style="{ width: progressPct + '%' }" />
      </view>
      <view class="topbar">
        <text class="top-meta">{{ progressLabel }}</text>
        <view class="accent-switch">
          <view :class="['mini', accent === 'uk' ? 'on' : '']" @tap="accent = 'uk'">英音</view>
          <view :class="['mini', accent === 'us' ? 'on' : '']" @tap="accent = 'us'">美音</view>
        </view>
        <text class="top-link" @tap="finishEarly">结束</text>
      </view>

      <view :class="['prompt', isH5 ? 'prompt-h5' : '']">
        <text v-if="promptKicker" class="kicker">{{ promptKicker }}</text>

        <template v-if="isH5 && expectedText">
          <view v-if="dictationMode && !typingShowResult" class="listen-mark" @tap="replay">
            <text class="listen-icon">听</text>
            <text class="listen-copy">{{ lane === 'article' ? '听这一句，再键盘输入' : '听发音，再键盘输入' }}</text>
          </view>
          <text
            v-if="lane === 'words' && wordMode === 'recall' && !typingShowResult"
            class="big-word meaning"
          >{{ currentWord?.meaning }}</text>
          <!-- 短文/句子：词间等空格（passage 逻辑） -->
          <TypingPassageCore
            v-if="usePassageTyping"
            :key="'p' + cardKey"
            :target="expectedText"
            :font-size="32"
            :active="stage === 'practice' && !committing"
            :key-sound="keySound"
            :is-dictation="dictationMode"
            @complete="onTypingComplete"
            @wrong="onTypingWrong"
          />
          <!-- 单词练习（含短语）：整段跟打，空格当字符，不等词间空格 -->
          <TypingWordCore
            v-else
            :key="'w' + cardKey"
            :target="expectedText"
            :practice-type="enginePracticeType"
            :is-word-masked="engineMasked"
            :show-word-result="typingShowResult"
            :show-full-word="typingShowFull"
            :font-size="expectedText.includes(' ') ? 40 : 52"
            :active="stage === 'practice' && !committing"
            :key-sound="keySound"
            @update:show-word-result="typingShowResult = $event"
            @complete="onTypingComplete"
            @wrong="onTypingWrong"
            @notice="toast"
          />
        </template>

        <template v-else>
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
        </template>

        <text v-if="showPhonetic && phoneticLine" class="phonetic">{{ phoneticLine }}</text>
        <text v-if="showMeaningLine && !(isH5 && wordMode === 'recall' && !typingShowResult)" class="meaning-line">{{ meaningLine }}</text>
        <text v-if="firstLetter && !isH5" class="phonetic">首字母 {{ firstLetter }}</text>
        <text v-if="currentWord?.wrongSource === 'sentence'" class="hint">这个词来自一句没写对的短文。</text>
      </view>

      <input
        v-if="!isH5"
        class="answer"
        v-model="userInput"
        :focus="inputArmed"
        :disabled="showResult"
        confirm-type="done"
        :placeholder="placeholder"
        @confirm="onInputConfirm"
      />

      <view class="actions">
        <template v-if="!isH5">
          <button v-if="!showResult" class="start slim" @tap="submit">提交</button>
          <button v-else class="start slim" @tap="nextItem">下一题</button>
        </template>
        <button class="ghost slim" @tap="replay">发音</button>
        <button class="ghost slim" @tap="bumpHint">提示</button>
        <button v-if="currentWord" class="ghost slim" @tap="toggleFavorite">{{ currentWord.favorite ? '已收藏' : '收藏' }}</button>
        <button v-if="currentWord" class="ghost slim" @tap="toggleMastered">{{ currentWord.skipMastered ? '取消跳过' : '已掌握' }}</button>
        <button v-if="fullTranslation" class="ghost slim" @tap="showFullTranslation = !showFullTranslation">译文</button>
      </view>

      <view v-if="showResult && !isH5" :class="['result', isCorrect ? 'good' : 'bad']">
        <text class="result-title">{{ isCorrect ? '正确' : '再看一眼' }}</text>
        <text class="result-word">{{ expectedText }}</text>
        <text v-if="!isCorrect && currentWord" class="hint">已记入错词本，之后可用「错词」复习。</text>
        <text v-else-if="!isCorrect && sentenceWrongWords.length" class="hint">已把认识的实词放进错词本：{{ sentenceWrongWords.join('、') }}</text>
        <text v-else-if="clearedWrong" class="hint">这一题写对了，已从错词本移出。</text>
        <view v-if="graded.length" class="live-line result-line">
          <text v-for="(mark, index) in graded" :key="'g' + index" :class="['glyph', mark.kind]">{{ mark.ch }}</text>
        </view>
      </view>

      <view v-if="showAside" class="aside">
        <text v-if="currentWord?.englishMeaning" class="aside-line">{{ currentWord.englishMeaning }}</text>
        <text v-if="exampleText" class="aside-line">{{ exampleText }}</text>
        <text v-if="sentenceTranslation" class="aside-line">{{ sentenceTranslation }}</text>
        <text v-else-if="showFullTranslation && fullTranslation" class="aside-line">{{ fullTranslation }}</text>
        <text v-if="currentWord?.note" class="aside-line">注释 {{ currentWord.note }}</text>
        <text v-if="currentWord?.synonyms" class="aside-line">同义 {{ currentWord.synonyms }}</text>
        <text v-if="currentWord?.roots" class="aside-line">词根 {{ currentWord.roots }}</text>
        <text v-if="currentWord?.etymology" class="aside-line">词源 {{ currentWord.etymology }}</text>
        <text v-if="currentWord?.phrases" class="aside-line">搭配 {{ currentWord.phrases }}</text>
        <text v-if="currentWord?.topic" class="aside-line">{{ currentWord.topic }}</text>
      </view>

      <text class="legend">
        <template v-if="isH5">直接键盘输入 · Backspace 回退 · ⌥/Alt+{{ shortcuts.replay.toUpperCase() }} 发音 · ⌥/Alt+{{ shortcuts.favorite.toUpperCase() }} 收藏</template>
        <template v-else>Enter 提交 · ⌥/Alt+{{ shortcuts.replay.toUpperCase() }} 发音 · ⌥/Alt+{{ shortcuts.favorite.toUpperCase() }} 收藏</template>
      </text>
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
import TypingWordCore from '@/components/typing/TypingWordCore.vue'
import TypingPassageCore from '@/components/typing/TypingPassageCore.vue'
import { WordPracticeType } from '@/typing-engine/types'
import { useVocabularyStore } from '@/stores/vocabulary'
import { typingAPI } from '@/utils/api'
import { isBrowserH5 } from '@/utils/audio-recording'
import { requireSubject } from '@/utils/subject'
import { speakPassage, speakText, unlockTtsPlayback } from '@/utils/tts'
import { splitTextForTts } from '@/utils/tts-text'
import {
  answersMatch,
  liveMarks,
  loadAutoSpeak,
  loadKeySound,
  loadShortcuts,
  saveAutoSpeak,
  saveKeySound,
  saveShortcuts,
  type ShortcutAction
} from '@/utils/typing'
import { unlockTypingAudio } from '@/typing-engine/sounds'

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
  phoneticUk?: string
  phoneticUs?: string
  synonyms?: string
  roots?: string
  etymology?: string
  phrases?: string
  note?: string
  wrongSource?: string
}

interface Summary {
  due: number
  unseen: number
  skipped: number
  wrong: number
  favorite: number
}

interface ListRow { id: string; name: string; count: number }
interface ArticleRow {
  id: string
  title: string
  sentenceCount: number
  builtin?: boolean
  source?: string
  dueCount?: number
}
interface SentenceItem {
  text: string
  translation: string
  articleKey: string
  index: number
  title?: string
}
interface RejectedToken { token: string; reason: string }
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
const editingId = ref('')
const editingBuiltin = ref(false)
const editImpact = ref<{ kept: number; reset: number; retired: number } | null>(null)
const sentenceWrongWords = ref<string[]>([])
const roundStartedAt = ref(0)
const typedChars = ref(0)
const correctChars = ref(0)
const historyLoaded = ref(false)
const history = ref<{
  days: Array<{ date: string; items: number; level: number }>
  speed: Array<{ at: string; charsPerMinute: number; items: number }>
}>({ days: [], speed: [] })
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
const roundKind = ref<'words' | 'article' | 'due'>('words')
const answered = ref<Answered[]>([])
const correctCount = ref(0)
const suspendKeys = ref(false)
const shortcuts = ref(loadShortcuts())
const keySound = ref(loadKeySound())
const autoSpeak = ref(loadAutoSpeak())
const capturing = ref<ShortcutAction | null>(null)
const typingShowResult = ref(false)
const typingShowFull = ref(false)
const committing = ref(false)
const cardKey = ref(0)

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
const progressPct = computed(() => {
  if (!total.value) return 0
  return Math.min(100, Math.round(((index.value + (showResult.value || committing.value ? 1 : 0)) / total.value) * 100))
})
const enginePracticeType = computed((): WordPracticeType => {
  if (dictationMode.value || (lane.value === 'words' && wordMode.value === 'recall')) {
    return WordPracticeType.Dictation
  }
  return WordPracticeType.FollowWrite
})
const engineMasked = computed(() => {
  if (lane.value === 'article') return articleMode.value === 'dictation'
  if (wordMode.value === 'dictation' || wordMode.value === 'recall') return true
  if (wordMode.value === 'self') return !selfVisible.value
  return false
})
/** Only article/sentence uses passage (wait-for-space). Word-lane phrases stay on word engine. */
const usePassageTyping = computed(() => lane.value === 'article')
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
const phoneticLine = computed(() => {
  const word = currentWord.value
  if (!word) return ''
  if (accent.value === 'uk' && word.phoneticUk) return word.phoneticUk
  if (accent.value === 'us' && word.phoneticUs) return word.phoneticUs
  return word.phonetic || ''
})
const showPhonetic = computed(() => {
  if (lane.value !== 'words' || !phoneticLine.value) return false
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
const sentenceTranslation = computed(() => {
  const text = currentSentence.value?.translation || ''
  if (!text) return ''
  if (showResult.value || articleMode.value === 'follow') return text
  return ''
})
const showAside = computed(() => (
  showExample.value
  || !!sentenceTranslation.value
  || !!(showFullTranslation.value && fullTranslation.value)
))
const articleDue = computed(() => articles.value.reduce((sum, item) => sum + (item.dueCount || 0), 0))
const hasHistory = computed(() => history.value.days.some(day => day.items > 0) || history.value.speed.length > 0)
const maxSpeed = computed(() => history.value.speed.reduce((max, point) => Math.max(max, point.charsPerMinute), 0))
const promptKicker = computed(() => {
  if (lane.value === 'article') {
    const title = currentSentence.value?.title ? `${currentSentence.value.title} · ` : ''
    return title + (articleMode.value === 'follow' ? '跟着这一句输入' : '听写这一句')
  }
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
  await Promise.all([refreshSummary(), refreshLists(), refreshArticles(), refreshHistory()])
}

async function refreshSummary() {
  if (!vocabStore.currentBookCode) return
  try {
    const result = await typingAPI.summary(vocabStore.currentBookCode, wordMode.value)
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

function localDate() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function barHeight(speed: number) {
  const top = Math.max(maxSpeed.value, 1)
  return `${Math.max(8, Math.round((speed / top) * 100))}%`
}

async function refreshHistory() {
  try {
    const result = await typingAPI.history(localDate())
    const data = result.data as typeof history.value
    history.value = {
      days: data?.days || [],
      speed: data?.speed || []
    }
  } catch {
    history.value = { days: [], speed: [] }
  } finally {
    historyLoaded.value = true
  }
}

function onBookChange() {
  void refreshSummary()
}

function selectWordMode(key: WordMode) {
  wordMode.value = key
  void refreshSummary()
}

function articleLabel(item: ArticleRow) {
  const due = item.dueCount ? ` · 到期 ${item.dueCount}` : ''
  return `${item.title} · ${item.sentenceCount} 句${due}`
}

const REJECT_LABEL: Record<string, string> = {
  not_english: '不是可用的英文拼写',
  too_long: '超过长度限制',
  limit: '超过一次可导入的数量',
  save_failed: '没能写入词库'
}

function rejectionNote(items?: RejectedToken[]) {
  if (!items?.length) return ''
  return items.slice(0, 6).map(item => `${item.token}（${REJECT_LABEL[item.reason] || item.reason}）`).join('、')
}

function readTextFile(limit: number, assign: (text: string) => void) {
  if (!isH5 || typeof document === 'undefined') {
    toast('文件导入请在电脑浏览器里使用，或直接粘贴')
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.txt,text/plain,.md'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 200000) {
      toast('文件太大')
      return
    }
    const reader = new FileReader()
    reader.onload = () => assign(String(reader.result || '').slice(0, limit))
    reader.onerror = () => toast('没能读取文件')
    reader.readAsText(file)
  }
  input.click()
}

function pickListFile() {
  readTextFile(20000, text => {
    listText.value = text
    toast('已放入词表，确认后保存')
  })
}

function pickArticleFile() {
  readTextFile(8000, text => {
    articleBody.value = text
    toast(editingId.value ? '已放入短文，确认后保存修改' : '已放入短文，确认后保存')
    void refreshEditImpact()
  })
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
  roundStartedAt.value = Date.now()
  typedChars.value = 0
  correctChars.value = 0
  sentenceWrongWords.value = []
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
  typingShowResult.value = false
  typingShowFull.value = false
  committing.value = false
  cardKey.value += 1
  armSelf()
  if (isH5) {
    unlockTypingAudio()
    void unlockTtsPlayback()
  }
  if (!isH5) void focusInput()
  // Default: auto-speak every new card (TypeWords wordSound). Dictation always speaks.
  if (autoSpeak.value || dictationMode.value) void replay()
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
      listId,
      mode: wordMode.value
    })
    const data = result.data as { words: TypingWord[]; scopedToBook: boolean; missing?: string[]; rejected?: RejectedToken[] }
    words.value = data?.words || []
    sentences.value = []
    fullTranslation.value = ''
    scopedToBook.value = !!data?.scopedToBook
    if (!words.value.length) {
      const why = rejectionNote(data?.rejected)
      toast(why ? `没有可练的词：${why}` : (source.value === 'wrong' ? '错词本是空的' : '这一组没有可练的词'))
      return
    }
    const why = rejectionNote(data?.rejected)
    if (why) toast(`有些内容不能使用：${why}`)
    lane.value = 'words'
    roundKind.value = 'words'
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

async function startDueReview() {
  busy.value = true
  try {
    const result = await typingAPI.dueArticles(groupSize.value)
    const data = result.data as { total?: number; sentences?: SentenceItem[] }
    sentences.value = data?.sentences || []
    fullTranslation.value = ''
    words.value = []
    scopedToBook.value = false
    if (!sentences.value.length) {
      toast('现在没有到期的句子')
      await refreshArticles()
      return
    }
    lane.value = 'article'
    roundKind.value = 'due'
    capturing.value = null
    resetRound()
    stage.value = 'practice'
    prepareCard()
  } catch (error) {
    toast((error as Error).message || '没能打开复习')
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
    const data = result.data as { title?: string; sentences: SentenceItem[]; translation?: string }
    sentences.value = (data?.sentences || []).map(item => ({ ...item, title: item.title || data?.title || '' }))
    const paired = sentences.value.some(item => item.translation)
    fullTranslation.value = paired ? '' : (data?.translation || '')
    words.value = []
    scopedToBook.value = false
    activeArticleId.value = id
    roundKind.value = 'article'
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
    const data = result.data as {
      id: string
      count?: number
      created?: string[]
      rejected?: RejectedToken[]
    }
    listText.value = ''
    listName.value = ''
    const created = data?.created?.length ? `新收录 ${data.created.length} 个。` : ''
    const rejected = rejectionNote(data?.rejected)
    listNote.value = `已保存 ${data?.count || 0} 个。${created}${rejected ? `不能使用：${rejected}` : '都能练习。'}`
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

async function beginEdit(item: ArticleRow) {
  try {
    const result = await typingAPI.article(item.id)
    const data = result.data as { title?: string; body?: string; sourceTranslation?: string; translation?: string }
    editingId.value = item.id
    editingBuiltin.value = !!item.builtin
    articleTitle.value = data?.title || item.title
    articleBody.value = data?.body || ''
    articleTranslation.value = data?.sourceTranslation || data?.translation || ''
    editImpact.value = null
    await refreshEditImpact()
  } catch (error) {
    toast((error as Error).message || '没能打开短文')
  }
}

function cancelEdit() {
  editingId.value = ''
  editingBuiltin.value = false
  editImpact.value = null
  articleTitle.value = ''
  articleBody.value = ''
  articleTranslation.value = ''
}

async function refreshEditImpact() {
  if (!editingId.value || !articleBody.value.trim()) {
    editImpact.value = null
    return
  }
  try {
    const result = await typingAPI.previewArticle(editingId.value, articleBody.value, articleTranslation.value)
    editImpact.value = (result.data as { kept: number; reset: number; retired: number }) || null
  } catch {
    editImpact.value = null
  }
}

function onArticleFieldBlur() {
  suspendKeys.value = false
  void refreshEditImpact()
}

async function saveArticle() {
  if (!articleBody.value.trim()) {
    toast('先粘贴短文')
    return
  }
  try {
    if (editingId.value) {
      await refreshEditImpact()
      const result = await typingAPI.updateArticle(editingId.value, articleTitle.value, articleBody.value, articleTranslation.value)
      const data = result.data as { kept?: number; reset?: number; retired?: number; copied?: boolean }
      const changed = (data?.reset || 0) + (data?.retired || 0)
      const copied = data?.copied ? '已另存为你的短文。' : ''
      cancelEdit()
      await refreshArticles()
      if (changed) toast(`${copied}${data?.kept || 0} 句保留进度，${changed} 句重新开始`)
      else toast(copied || '短文已保存')
      return
    }
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
  // Snapshot at call time — index may advance while audio loads
  const text = expectedText.value
  const speakAccent = accent.value
  const speakLane = lane.value
  const token = cardKey.value
  if (!text) return
  if (!splitTextForTts(text).length) {
    toast('这一句没有可朗读的英文')
    return
  }
  try {
    if (speakLane === 'article') await speakPassage(text, speakAccent)
    else await speakText(text, 120, speakAccent)
  } catch {
    // Superseded plays resolve quietly; only toast real failures still on this card
    if (token === cardKey.value) toast('播放失败')
  }
}

function bumpHint() {
  hintLevel.value = Math.min(2, hintLevel.value + 1)
  if (isH5 && hintLevel.value >= 2) typingShowFull.value = true
}

async function commitTyped(typed: string, ok: boolean) {
  if (committing.value || stage.value !== 'practice' || !expectedText.value) return
  committing.value = true
  isCorrect.value = ok
  if (!isH5) showResult.value = true
  if (ok) correctCount.value += 1
  typedChars.value += typed.length
  if (ok) correctChars.value += expectedText.value.length
  const word = currentWord.value
  answered.value.push({
    id: word?.id || `s${index.value}`,
    label: expectedText.value,
    ok
  })
  if (!word) {
    const sentence = currentSentence.value
    if (sentence) {
      try {
        const result = await typingAPI.articleAnswer(sentence.articleKey, sentence.index, ok)
        const data = result.data as { wrongWords?: string[] }
        sentenceWrongWords.value = data?.wrongWords || []
      } catch {
        toast('这句的复习没保存')
      }
    }
    committing.value = false
    return
  }
  const wasWrong = word.inWrongBook
  try {
    const result = await typingAPI.answer(word.id, ok, wordMode.value)
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
  committing.value = false
}

async function onTypingComplete(payload: { typed: string; correct: boolean }) {
  await commitTyped(payload.typed || expectedText.value, payload.correct)
  if (index.value + 1 >= total.value) {
    void finishRound()
    return
  }
  index.value += 1
  prepareCard()
}

function onTypingWrong() {
  // visual/audio handled inside TypingWordCore; keep for future analytics
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
  if (isH5) return
  if (stage.value !== 'practice' || showResult.value || !expectedText.value) return
  if (!guardAction()) return
  if (!userInput.value.trim()) {
    toast('先输入')
    return
  }
  const ok = answersMatch(expectedText.value, userInput.value, lane.value === 'words' ? 'word' : 'sentence')
  await commitTyped(userInput.value, ok)
  showResult.value = true
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
  if (answered.value.length && roundStartedAt.value) {
    try {
      await typingAPI.session({
        date: localDate(),
        durationMs: Math.max(0, Date.now() - roundStartedAt.value),
        typedChars: typedChars.value,
        correctChars: correctChars.value,
        itemCount: answered.value.length,
        correctCount: correctCount.value,
        kind: lane.value === 'article' ? 'article' : 'words'
      })
    } catch {
      toast('这组速度没记上')
    }
  }
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
  if (roundKind.value === 'due') {
    void startDueReview()
    return
  }
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
  void refreshArticles()
  void refreshLists()
  void refreshHistory()
}

function toggleSound() {
  keySound.value = !keySound.value
  saveKeySound(keySound.value)
}

function toggleAutoSpeak() {
  autoSpeak.value = !autoSpeak.value
  saveAutoSpeak(autoSpeak.value)
}

function runShortcut(action: ShortcutAction) {
  if (action === 'replay') void replay()
  else if (action === 'favorite') void toggleFavorite()
  else if (action === 'mastered') void toggleMastered()
  else if (action === 'hint') bumpHint()
  else if (action === 'accent') accent.value = accent.value === 'us' ? 'uk' : 'us'
  else if (action === 'sound') toggleSound()
}

/** Mac Option produces symbols in event.key; use event.code (KeyR → r). */
function letterFromEvent(event: KeyboardEvent): string | null {
  if (event.code.startsWith('Key') && event.code.length === 4) {
    return event.code.slice(3).toLowerCase()
  }
  if (event.code.startsWith('Digit') && event.code.length === 6) {
    return event.code.slice(5)
  }
  if (/^[a-z0-9]$/i.test(event.key)) return event.key.toLowerCase()
  return null
}

function onKeyDown(event: KeyboardEvent) {
  if (!isH5 || suspendKeys.value || event.isComposing) return
  const letter = letterFromEvent(event)
  if (capturing.value && letter) {
    event.preventDefault()
    shortcuts.value = { ...shortcuts.value, [capturing.value]: letter }
    saveShortcuts(shortcuts.value)
    capturing.value = null
    return
  }
  // Mac: Option = altKey. Ctrl also accepted for convenience.
  if ((event.altKey || event.ctrlKey) && !event.metaKey && !event.repeat && stage.value === 'practice' && letter) {
    const action = (Object.keys(shortcuts.value) as ShortcutAction[]).find(name => shortcuts.value[name] === letter)
    if (action) {
      event.preventDefault()
      runShortcut(action)
    }
  }
}

onShow(async () => {
  if (!(await requireSubject('english', 'student'))) return
  if (ready.value) return
  ready.value = true
  await loadSetup()
})

if (isH5 && typeof window !== 'undefined') {
  // capture so Option/Ctrl shortcuts work even if children listen first
  window.addEventListener('keydown', onKeyDown, true)
}

onUnmounted(() => {
  if (selfTimer) clearTimeout(selfTimer)
  if (isH5 && typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeyDown, true)
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

.progress-track {
  height: 4px;
  background: #e7dfd3;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: #0f6e6a;
  transition: width 0.2s ease;
}

.practice-h5 {
  max-width: 960px;
}

.prompt {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin: 28px 0 12px;
}

.prompt-h5 {
  min-height: 280px;
  align-items: center;
  text-align: center;
}

.prompt-h5 .kicker,
.prompt-h5 .phonetic,
.prompt-h5 .meaning-line,
.prompt-h5 .hint {
  width: 100%;
  text-align: center;
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

.source-line {
  margin: 0 0 10px;
}

.saved-edit {
  color: #0f6e6a;
  font-size: 13px;
}

.speed-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 72px;
  margin-top: 8px;
}

.speed-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.speed-bar {
  width: 100%;
  background: #0f6e6a;
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}

.heat {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  max-width: 364px;
}

.heat-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #e6e0d6;
}

.lv-1 { background: #c5ddd4; }
.lv-2 { background: #7fbfb0; }
.lv-3 { background: #2f8f86; }
.lv-4 { background: #0f6e6a; }

.article-block {
  margin-bottom: 4px;
}

@media (max-width: 720px) {
  .big-word, .live-line {
    font-size: 40px;
  }
}
</style>
