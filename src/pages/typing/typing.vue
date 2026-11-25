<template>
  <view class="desk">
    <view v-if="stage === 'setup'" class="setup">
      <text class="eyebrow">{{ lane === 'article' ? '文章练习' : '拼读练习' }}</text>
      <text class="lede">{{ lane === 'article' ? '按单元顺序逐句练习，不使用记忆曲线，也不计入词汇复习进度。' : '有键盘时先学后考：跟写→自测学一遍，再默写或听写检测。有空格时词间单独按空格；小程序仍用输入框。' }}</text>

      <BookSwitcher v-if="lane === 'words'" training-type="writing" @change="onBookChange" />

      <template v-if="lane === 'words'">
        <view class="summary" v-if="summary">
          <text>到期 {{ summary.due }}</text>
          <text>新词 {{ summary.unseen }}</text>
          <text>错词 {{ summary.wrong }}</text>
          <text>收藏 {{ summary.favorite }}</text>
          <text>已跳过 {{ summary.skipped }}</text>
        </view>

        <text class="label">词从哪来</text>
        <view class="chips">
          <view
            :class="['chip', source === 'smart' ? 'on' : '']"
            @tap="pickSource('smart')"
          >智能</view>
          <template v-if="moreSources">
            <view
              v-for="item in extraSources"
              :key="item.key"
              :class="['chip', source === item.key ? 'on' : '']"
              @tap="pickSource(item.key)"
            >{{ sourceLabel(item) }}</view>
            <view class="chip" @tap="moreSources = false">收起</view>
          </template>
          <view v-else class="chip" @tap="moreSources = true">更多来源</view>
        </view>
        <view v-if="source === 'wrong' || source === 'favorite'" class="chips scope-chips">
          <view :class="['chip', !allBooks ? 'on' : '']" @tap="allBooks = false">本书</view>
          <view :class="['chip', allBooks ? 'on' : '']" @tap="allBooks = true">全部词书</view>
        </view>
        <text class="hint">点开始即可。先跟写再自测，把这一组学完；再默写或听写检测，可关掉其中一种。只有检测计入会写。智能以到期和薄弱词为主，新词不超过三成。</text>

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
      </template>

      <template v-else>
        <text class="hint">一句一句输入。开始后可随时切换跟写 / 听写。能朗读的句子会出声；译文句数一致时会对照显示。</text>

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
          <view :class="['mini', ttsGender === 'female' ? 'on' : '']" @tap="setGender('female')">女声</view>
          <view :class="['mini', ttsGender === 'male' ? 'on' : '']" @tap="setGender('male')">男声</view>
        </view>
        <text class="top-link" @tap="finishEarly">结束</text>
      </view>
      <!-- 学习固定跟写+自测；检测默写/听写可关 -->
      <view v-if="lane === 'words'" class="practice-rail">
        <view
          v-for="item in learnModes"
          :key="item.key"
          :class="['rail-tab', 'is-on', wordMode === item.key ? 'is-current' : '']"
        >
          <text class="rail-label">{{ item.label }}</text>
        </view>
        <view class="rail-gap" aria-hidden="true" />
        <view
          v-for="item in examModeOptions"
          :key="item.key"
          :class="modeChipClass(item.key)"
          @tap="onWordModeChip(item.key)"
        >
          <text class="rail-label">{{ item.label }}</text>
        </view>
        <view class="rail-gap" aria-hidden="true" />
        <view
          :class="['rail-tab', 'rail-toggle', autoExample ? 'is-picked' : '']"
          @tap="toggleAutoExample"
        >
          <text class="rail-label">播例句</text>
        </view>
      </view>
      <view v-else class="practice-rail">
        <view :class="['rail-tab', articleMode === 'follow' ? 'is-on is-current' : 'is-on']" @tap="switchArticleMode('follow')">
          <text class="rail-label">跟写</text>
        </view>
        <view :class="['rail-tab', articleMode === 'dictation' ? 'is-on is-current' : 'is-on']" @tap="switchArticleMode('dictation')">
          <text class="rail-label">听写</text>
        </view>
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
        <view v-if="lane === 'words' && currentWord" class="word-flags">
          <text v-if="isDueWord(currentWord.due)" class="flag due">到期</text>
          <text v-if="!currentWord.practiced" class="flag fresh">新词</text>
          <text v-if="currentWord.recentLapse" class="flag lapse">最近答错</text>
          <text v-if="currentWord.inWrongBook" class="flag wrong">错词本</text>
          <text v-if="currentWord.favorite" class="flag favorite">收藏</text>
        </view>
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
        <button class="ghost slim" @tap="replay">发音 <text class="btn-hotkey">{{ hotkeyLabel('replay') }}</text></button>
        <button v-if="exampleList.length" class="ghost slim" @tap="playExample()">
          例句 <text class="btn-hotkey">{{ hotkeyLabel('example') }}</text>
        </button>
        <button class="ghost slim" @tap="bumpHint">提示 <text class="btn-hotkey">{{ hotkeyLabel('hint') }}</text></button>
        <button v-if="currentWord" class="ghost slim" @tap="toggleFavorite">
          {{ currentWord.favorite ? '已收藏' : '收藏' }}
          <text class="btn-hotkey">{{ hotkeyLabel('favorite') }}</text>
        </button>
        <button v-if="currentWord" class="ghost slim" @tap="toggleMastered">
          {{ currentWord.skipMastered ? '取消跳过' : '已掌握' }}
          <text class="btn-hotkey">{{ hotkeyLabel('mastered') }}</text>
        </button>
        <button v-if="fullTranslation" class="ghost slim" @tap="showFullTranslation = !showFullTranslation">译文</button>
      </view>

      <view v-if="showExamplesPanel" class="examples-panel">
        <text class="examples-title">例句</text>
        <view
          v-for="(ex, exIndex) in exampleList"
          :key="'ex' + exIndex + ex"
          :class="['example-row', activeExampleIndex === exIndex ? 'is-active' : '']"
        >
          <view class="example-text" @tap="playExample(ex, exIndex)">
            <text
              v-for="(part, partIndex) in highlightExampleParts(ex)"
              :key="'p' + exIndex + partIndex"
              :class="part.hit ? 'ex-hit' : ''"
            >{{ part.text }}</text>
          </view>
          <text class="example-play" @tap="playExample(ex, exIndex)">听</text>
        </view>
      </view>

      <view v-if="showResult && !isH5" :class="['result', isCorrect ? 'good' : 'bad']">
        <text class="result-title">{{ isCorrect ? '正确' : '再看一眼' }}</text>
        <text class="result-word">{{ expectedText }}</text>
        <text v-if="!isCorrect && currentWord" class="hint">已记入错词本，之后可用「错词」复习。</text>
        <text v-else-if="!isCorrect && sentenceWrongWords.length" class="hint">这一句没写对的词：{{ sentenceWrongWords.join('、') }}</text>
        <text v-else-if="clearedWrong" class="hint">这一题写对了，已从错词本移出。</text>
        <view v-if="graded.length" class="live-line result-line">
          <text v-for="(mark, index) in graded" :key="'g' + index" :class="['glyph', mark.kind]">{{ mark.ch }}</text>
        </view>
      </view>

      <view v-if="showAside" class="aside">
        <text v-if="currentWord?.englishMeaning" class="aside-line">{{ currentWord.englishMeaning }}</text>
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
        <template v-if="isH5">直接键盘输入 · Backspace 回退 · 快捷键见上方按钮</template>
        <template v-else>Enter 提交 · 快捷键见上方按钮</template>
      </text>
    </view>

    <view v-else-if="stage === 'bridge'" class="setup bridge">
      <text class="eyebrow">拼读练习</text>
      <text class="score-soft">{{ words.length }}</text>
      <text class="lede">这一组已跟写、自测学过一遍。接下来先默写再听写（词序各自打乱；可只开一种），会计入会写。</text>
      <text v-if="!examModes.length" class="hint">默写和听写都关了，直接结束这一组。</text>
      <button v-if="examModes.length" class="start" @tap="startExam">开始检测</button>
      <button v-else class="start" @tap="finishRound">完成</button>
      <button class="ghost" @tap="backToSetup">返回选择</button>
    </view>

    <view v-else class="setup done">
      <text class="eyebrow">{{ lane === 'article' ? '这一篇完成' : '这一组完成' }}</text>
      <text class="score">{{ correctCount }}/{{ answered.length }}</text>
      <text class="lede">正确率 {{ accuracy }}%</text>
      <view v-if="missed.length" class="panel">
        <text class="panel-title">写错的</text>
        <text v-for="item in missed" :key="item.id" class="missed">{{ item.label }}</text>
      </view>
      <button class="start" @tap="again">{{ lane === 'article' ? '再练一遍' : '再来一组' }}</button>
      <button v-if="lane === 'words'" class="ghost" @tap="againWrong">只练错词</button>
      <button class="ghost" @tap="backToSetup">返回选择</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import BookSwitcher from '@/components/BookSwitcher.vue'
import TypingWordCore from '@/components/typing/TypingWordCore.vue'
import TypingPassageCore from '@/components/typing/TypingPassageCore.vue'
import { WordPracticeType } from '@/typing-engine/types'
import { useVocabularyStore } from '@/stores/vocabulary'
import { typingAPI } from '@/utils/api'
import { isBrowserH5 } from '@/platform/runtime'
import { requireSubject } from '@/utils/subject'
import { setTtsGender, speakPassage, speakSentence, speakText, unlockTtsPlayback } from '@/utils/tts'
import { splitTextForTts } from '@/utils/tts-text'
import {
  answersMatch,
  liveMarks,
  loadAutoExample,
  loadAutoSpeak,
  loadEnabledWordModes,
  loadKeySound,
  loadShortcuts,
  loadTtsGender,
  loadTypingSource,
  saveAutoExample,
  saveAutoSpeak,
  saveEnabledWordModes,
  saveKeySound,
  saveShortcuts,
  saveTtsGender,
  saveTypingSource,
  type PersistedWordMode,
  type ShortcutAction,
  type TtsGender
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
  due?: string | null
  practiced?: boolean
  recentLapse?: boolean
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

interface ArticleRow {
  id: string
  title: string
  sentenceCount: number
  builtin?: boolean
  source?: string
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

type WordMode = PersistedWordMode
type ArticleMode = 'follow' | 'dictation'
type Source = 'smart' | 'wrong' | 'favorite' | 'random'
type Stage = 'setup' | 'practice' | 'bridge' | 'done'
type WordPhase = 'learn' | 'exam'
type ExamMode = 'recall' | 'dictation'

const LEARN_MODE_ORDER: WordMode[] = ['follow', 'self']
const EXAM_MODE_ORDER: ExamMode[] = ['recall', 'dictation']

type ExamCard = { wordIndex: number; mode: ExamMode }

function loadExamModes(): ExamMode[] {
  const saved = loadEnabledWordModes().filter((mode): mode is ExamMode =>
    mode === 'recall' || mode === 'dictation'
  )
  return saved.length ? saved : [...EXAM_MODE_ORDER]
}

function shuffleInPlace<T>(list: T[]) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/**
 * 检测题卡：默写相对易、听写更难。
 * 两种都开时，先整组默写（词序打乱），再整组听写（词序再打乱）；
 * 只开一种则只出该种并打乱词序。
 */
function buildExamQueue(wordCount: number, modes: ExamMode[]): ExamCard[] {
  const ordered = EXAM_MODE_ORDER.filter((mode) => modes.includes(mode))
  const cards: ExamCard[] = []
  for (const mode of ordered) {
    const block: ExamCard[] = []
    for (let wordIndex = 0; wordIndex < wordCount; wordIndex++) {
      block.push({ wordIndex, mode })
    }
    shuffleInPlace(block)
    cards.push(...block)
  }
  return cards
}

const vocabStore = useVocabularyStore()
const isH5 = isBrowserH5()

const stage = ref<Stage>('setup')
const lane = ref<'words' | 'article'>('words')
const wordPhase = ref<WordPhase>('learn')
const enabledExamModes = ref<ExamMode[]>(loadExamModes())
const wordMode = ref<WordMode>('follow')
const articleMode = ref<ArticleMode>('follow')
const savedSource = loadTypingSource()
const source = ref<Source>(
  (['smart', 'wrong', 'favorite', 'random'] as Source[]).includes(savedSource as Source)
    ? savedSource as Source
    : 'smart'
)
const moreSources = ref(source.value !== 'smart')
const allBooks = ref(false)
const groupSize = ref(20)
const counts = [5, 10, 15, 20, 30, 40, 50]
const learnModes: Array<{ key: WordMode; label: string }> = [
  { key: 'follow', label: '跟写' },
  { key: 'self', label: '自测' }
]
const examModeOptions: Array<{ key: ExamMode; label: string }> = [
  { key: 'recall', label: '默写' },
  { key: 'dictation', label: '听写' }
]
const wordModes: Array<{ key: WordMode; label: string }> = [
  ...learnModes,
  ...examModeOptions
]
const extraSources: Array<{ key: Source; label: string }> = [
  { key: 'wrong', label: '错词' },
  { key: 'favorite', label: '收藏' },
  { key: 'random', label: '随机' }
]

function pickSource(key: Source) {
  source.value = key
  saveTypingSource(key)
  if (key !== 'wrong' && key !== 'favorite') allBooks.value = false
}

function sourceLabel(item: { key: Source; label: string }) {
  if (!summary.value) return item.label
  if (allBooks.value && (item.key === 'wrong' || item.key === 'favorite')) return item.label
  if (item.key === 'wrong') return `${item.label} ${summary.value.wrong}`
  if (item.key === 'favorite') return `${item.label} ${summary.value.favorite}`
  return item.label
}

function isDueWord(value?: string | null) {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time <= Date.now()
}

const summary = ref<Summary | null>(null)
const articles = ref<ArticleRow[]>([])
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
/** 检测阶段：词×模式打散成一题一卡，避免一词先默写再听写 */
const examQueue = ref<ExamCard[]>([])
const examCursor = ref(0)
const userInput = ref('')
const showResult = ref(false)
const isCorrect = ref(false)
const clearedWrong = ref(false)
const hintLevel = ref(0)
const selfVisible = ref(false)
const inputArmed = ref(false)
const accent = ref<'us' | 'uk'>('us')
const ttsGender = ref<TtsGender>(loadTtsGender())
setTtsGender(ttsGender.value)
const scopedToBook = ref(false)
const answered = ref<Answered[]>([])
const correctCount = ref(0)
const suspendKeys = ref(false)
const shortcuts = ref(loadShortcuts())
const keySound = ref(loadKeySound())
const autoSpeak = ref(loadAutoSpeak())
const autoExample = ref(loadAutoExample())
const activeExampleIndex = ref(-1)
const capturing = ref<ShortcutAction | null>(null)
const typingShowResult = ref(false)
const typingShowFull = ref(false)
const committing = ref(false)
const cardKey = ref(0)

const shortcutRows: Array<{ action: ShortcutAction; label: string }> = [
  { action: 'replay', label: '发音' },
  { action: 'example', label: '例句' },
  { action: 'favorite', label: '收藏' },
  { action: 'mastered', label: '已掌握' },
  { action: 'hint', label: '提示' },
  { action: 'accent', label: '切换英美' },
  { action: 'sound', label: '按键轻响' }
]

let selfTimer: ReturnType<typeof setTimeout> | null = null
let lastAction = 0

const currentWord = computed(() => {
  if (lane.value !== 'words') return undefined
  if (wordPhase.value === 'exam' && examQueue.value.length) {
    const card = examQueue.value[examCursor.value]
    return card ? words.value[card.wordIndex] : undefined
  }
  return words.value[index.value]
})
const currentSentence = computed(() => (lane.value === 'article' ? sentences.value[index.value] : undefined))
const expectedText = computed(() => currentWord.value?.word || currentSentence.value?.text || '')
const total = computed(() => (lane.value === 'words' ? words.value.length : sentences.value.length))
const examModes = computed(() =>
  EXAM_MODE_ORDER.filter((mode) => enabledExamModes.value.includes(mode))
)
const activeModeChain = computed(() => {
  if (lane.value !== 'words') return [] as WordMode[]
  if (wordPhase.value === 'learn') return [...LEARN_MODE_ORDER]
  return examModes.value.length ? [...examModes.value] : ([] as WordMode[])
})
const modeStepIndex = computed(() => {
  const i = activeModeChain.value.indexOf(wordMode.value)
  return i >= 0 ? i : 0
})
const progressLabel = computed(() => {
  if (lane.value === 'article') {
    const mode = articleMode.value === 'follow' ? '跟写' : '听写'
    return `${mode} · ${Math.min(index.value + 1, total.value)}/${total.value}`
  }
  const phaseLabel = wordPhase.value === 'learn' ? '学习' : '检测'
  const mode = wordModes.find(item => item.key === wordMode.value)?.label || '跟写'
  if (wordPhase.value === 'exam' && examQueue.value.length) {
    const n = Math.min(examCursor.value + 1, examQueue.value.length)
    return `${phaseLabel} · ${mode} · ${n}/${examQueue.value.length}`
  }
  return `${phaseLabel} · ${mode} · ${Math.min(index.value + 1, total.value)}/${total.value}`
})
const progressPct = computed(() => {
  if (!total.value) return 0
  if (lane.value !== 'words') {
    return Math.min(100, Math.round(((index.value + (showResult.value || committing.value ? 1 : 0)) / total.value) * 100))
  }
  const learnModesCount = LEARN_MODE_ORDER.length
  const examModesCount = examModes.value.length
  const totalSteps = total.value * learnModesCount + Math.max(examQueue.value.length, total.value * examModesCount)
  if (!totalSteps) return 0
  const doneCard = showResult.value || committing.value ? 1 : 0
  let stepsDone = 0
  if (wordPhase.value === 'learn') {
    stepsDone = index.value * learnModesCount + modeStepIndex.value + doneCard
  } else {
    stepsDone = total.value * learnModesCount + examCursor.value + doneCard
  }
  return Math.min(100, Math.round((stepsDone / totalSteps) * 100))
})
/** 跟写/自测/默写/听写共用 FollowWrite + 下划线占位，视觉与自测对齐（不用 Dictation 单条底线） */
const enginePracticeType = computed((): WordPracticeType => WordPracticeType.FollowWrite)
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
const exampleList = computed(() => {
  const word = currentWord.value
  if (!word || lane.value !== 'words') return [] as string[]
  const list = [
    ...(word.examples || []),
    ...(word.example ? [word.example] : [])
  ]
    .map(item => item.trim())
    .filter(Boolean)
  return [...new Set(list)]
})
const showExamplesPanel = computed(() => {
  if (!exampleList.value.length) return false
  if (showResult.value || typingShowResult.value) return true
  if (wordMode.value === 'follow') return true
  if (wordMode.value === 'self' && selfVisible.value) return true
  return hintLevel.value >= 1
})
const sentenceTranslation = computed(() => {
  const text = currentSentence.value?.translation || ''
  if (!text) return ''
  if (showResult.value || articleMode.value === 'follow') return text
  return ''
})
const showAside = computed(() => (
  !!currentWord.value?.englishMeaning
  || !!sentenceTranslation.value
  || !!(showFullTranslation.value && fullTranslation.value)
  || !!(currentWord.value?.note || currentWord.value?.synonyms || currentWord.value?.roots
    || currentWord.value?.etymology || currentWord.value?.phrases || currentWord.value?.topic)
))
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
  await Promise.all([refreshSummary(), refreshArticles(), refreshHistory()])
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

function persistExamModes(next: ExamMode[]) {
  enabledExamModes.value = EXAM_MODE_ORDER.filter((mode) => next.includes(mode))
  saveEnabledWordModes([...LEARN_MODE_ORDER, ...enabledExamModes.value] as PersistedWordMode[])
}

function modeChipClass(key: WordMode) {
  const classes = ['rail-tab']
  const examOn = key === 'recall' || key === 'dictation'
    ? enabledExamModes.value.includes(key)
    : true
  if (examOn) classes.push('is-on')
  else classes.push('is-off')
  if (wordMode.value === key) classes.push('is-current')
  return classes
}

/** 默写 / 听写可关。跟写、自测固定在学习阶段。检测中途开关会改后续题队列。 */
function onWordModeChip(key: WordMode) {
  if (lane.value !== 'words' || committing.value) return
  if (key !== 'recall' && key !== 'dictation') return
  const examKey = key as ExamMode
  const enabled = enabledExamModes.value.includes(examKey)

  if (!enabled) {
    persistExamModes([...enabledExamModes.value, examKey])
    if (wordPhase.value === 'exam' && stage.value === 'practice' && examQueue.value.length) {
      const done = examQueue.value.slice(0, examCursor.value + 1)
      const rest = examQueue.value.slice(examCursor.value + 1)
      const extra = shuffleInPlace(
        words.value.map((_, wordIndex) => ({ wordIndex, mode: examKey }))
      )
      // 仍保持先默写、后听写
      if (examKey === 'recall') {
        const restRecall = rest.filter((card) => card.mode === 'recall')
        const restDictation = rest.filter((card) => card.mode === 'dictation')
        examQueue.value = [...done, ...restRecall, ...extra, ...restDictation]
      } else {
        examQueue.value = [...done, ...rest, ...extra]
      }
      return
    }
    return
  }

  if (enabledExamModes.value.length <= 1 && wordPhase.value === 'exam') {
    toast('检测至少保留一种方式')
    return
  }

  const next = enabledExamModes.value.filter((mode) => mode !== examKey)
  persistExamModes(next)
  if (wordPhase.value !== 'exam' || stage.value !== 'practice') return
  const current = examQueue.value[examCursor.value]
  const done = examQueue.value.slice(0, examCursor.value)
  const rest = examQueue.value
    .slice(examCursor.value)
    .filter((card) => card.mode !== examKey)
  if (!rest.length) {
    examQueue.value = done
    void finishRound()
    return
  }
  examQueue.value = [...done, ...rest]
  if (current?.mode === examKey) {
    applyExamCard()
  }
}

function hotkeyLabel(action: ShortcutAction) {
  const key = (shortcuts.value[action] || '').toUpperCase()
  return key ? `⌥${key}` : ''
}

function firstEnabledMode(): WordMode {
  return activeModeChain.value[0] || 'follow'
}

function nextEnabledMode(from: WordMode = wordMode.value): WordMode | null {
  const chain = activeModeChain.value
  const i = chain.indexOf(from)
  if (i < 0) return chain[0] || null
  return chain[i + 1] || null
}

function enterBridgeOrFinish() {
  if (examModes.value.length) {
    stage.value = 'bridge'
    return
  }
  void finishRound()
}

function applyExamCard() {
  const card = examQueue.value[examCursor.value]
  if (!card) {
    void finishRound()
    return
  }
  index.value = card.wordIndex
  wordMode.value = card.mode
  prepareCard()
}

function startExam() {
  if (!examModes.value.length) {
    void finishRound()
    return
  }
  wordPhase.value = 'exam'
  examQueue.value = buildExamQueue(words.value.length, examModes.value)
  examCursor.value = 0
  stage.value = 'practice'
  applyExamCard()
}

/** 单词：学习阶段一词跟写→自测；检测阶段题卡（词×模式）整组打乱。短文保持原逻辑。 */
function advanceAfterCard() {
  if (lane.value !== 'words') {
    if (index.value + 1 >= total.value) {
      void finishRound()
      return
    }
    index.value += 1
    prepareCard()
    return
  }

  if (wordPhase.value === 'exam') {
    if (examCursor.value + 1 < examQueue.value.length) {
      examCursor.value += 1
      applyExamCard()
      return
    }
    void finishRound()
    return
  }

  const nextMode = nextEnabledMode()
  if (nextMode) {
    wordMode.value = nextMode
    prepareCard()
    return
  }

  if (index.value + 1 < total.value) {
    index.value += 1
    wordMode.value = firstEnabledMode()
    prepareCard()
    return
  }

  enterBridgeOrFinish()
}

function switchArticleMode(key: ArticleMode) {
  if (lane.value !== 'article' || articleMode.value === key || committing.value) return
  articleMode.value = key
  if (stage.value === 'practice') prepareCard()
}

function articleLabel(item: ArticleRow) {
  return `${item.title} · ${item.sentenceCount} 句`
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

function pickArticleFile() {
  readTextFile(8000, text => {
    articleBody.value = text
    toast(editingId.value ? '已放入短文，确认后保存修改' : '已放入短文，确认后保存')
    void refreshEditImpact()
  })
}

function resetRound() {
  index.value = 0
  examQueue.value = []
  examCursor.value = 0
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
    }, 850)
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
  activeExampleIndex.value = -1
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
  busy.value = true
  try {
    wordPhase.value = 'learn'
    wordMode.value = 'follow'
    vocabStore.resetSessionTokens()
    const result = await typingAPI.queue({
      bookCode: vocabStore.currentBookCode,
      source: source.value,
      count: groupSize.value,
      mode: wordMode.value,
      allBooks: allBooks.value
    })
    const data = result.data as {
      words: TypingWord[]
      scopedToBook: boolean
      sessionToken?: string
      missing?: string[]
      rejected?: RejectedToken[]
    }
    words.value = data?.words || []
    sentences.value = []
    fullTranslation.value = ''
    scopedToBook.value = !!data?.scopedToBook
    if (data?.sessionToken) vocabStore.addSessionToken(data.sessionToken)
    if (!words.value.length) {
      const why = rejectionNote(data?.rejected)
      toast(why ? `没有可练的词：${why}` : (source.value === 'wrong' ? '错词本是空的' : '这一组没有可练的词'))
      return
    }
    const why = rejectionNote(data?.rejected)
    if (why) toast(`有些内容不能使用：${why}`)
    lane.value = 'words'
    capturing.value = null
    resetRound()
    wordPhase.value = 'learn'
    wordMode.value = 'follow'
    stage.value = 'practice'
    prepareCard()
  } catch (error) {
    toast((error as Error).message || '没能开始')
  } finally {
    busy.value = false
  }
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

function highlightExampleParts(sentence: string) {
  const spelling = (currentWord.value?.word || '').trim()
  if (!spelling || !sentence) return [{ text: sentence, hit: false }]
  const parts: Array<{ text: string; hit: boolean }> = []
  const re = new RegExp(`\\b(${spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(sentence))) {
    if (match.index > last) parts.push({ text: sentence.slice(last, match.index), hit: false })
    parts.push({ text: match[0], hit: true })
    last = match.index + match[0].length
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last), hit: false })
  return parts.length ? parts : [{ text: sentence, hit: false }]
}

async function playExample(text?: string, index = 0) {
  const list = exampleList.value
  const line = (text || list[index] || list[0] || '').trim()
  if (!line) {
    toast('这个词还没有例句')
    return
  }
  const token = cardKey.value
  activeExampleIndex.value = Math.max(0, list.indexOf(line))
  try {
    await unlockTtsPlayback()
    await speakSentence(line, accent.value)
  } catch {
    if (token === cardKey.value) toast('例句播放失败')
  } finally {
    if (token === cardKey.value) activeExampleIndex.value = -1
  }
}

async function replay() {
  // Snapshot at call time — index may advance while audio loads
  const text = expectedText.value
  const speakAccent = accent.value
  const speakLane = lane.value
  const token = cardKey.value
  // 播例句：仅跟写时自动接播；自测/默写/听写不播
  const chainExample =
    autoExample.value
    && speakLane === 'words'
    && wordMode.value === 'follow'
    && !!exampleList.value[0]
  if (!text) return
  if (!splitTextForTts(text).length) {
    toast('这一句没有可朗读的英文')
    return
  }
  try {
    if (speakLane === 'article') await speakPassage(text, speakAccent)
    else await speakText(text, 120, speakAccent)
    if (chainExample && token === cardKey.value) {
      await playExample(exampleList.value[0], 0)
    }
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
        const result = await typingAPI.articleAnswer(sentence.articleKey, sentence.index, ok, true)
        const data = result.data as { wrongWords?: string[] }
        sentenceWrongWords.value = data?.wrongWords || []
      } catch {
        toast('这句没保存')
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
  advanceAfterCard()
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
    toast(next ? '之后的智能和随机会跳过它' : '已取消跳过')
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
    } else if (lane.value === 'words' && answered.value.length) {
      await typingAPI.activity(answered.value.length)
    }
  } catch {
    toast('今日进度没记上')
  }
  stage.value = 'done'
}

function nextItem() {
  if (!showResult.value) return
  advanceAfterCard()
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
  void refreshArticles()
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

function toggleAutoExample() {
  autoExample.value = !autoExample.value
  saveAutoExample(autoExample.value)
}

function setGender(gender: TtsGender) {
  if (ttsGender.value === gender) return
  ttsGender.value = gender
  saveTtsGender(gender)
  setTtsGender(gender)
}

function runShortcut(action: ShortcutAction) {
  if (action === 'replay') void replay()
  else if (action === 'example') void playExample()
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

const pendingArticleId = ref('')
const pendingAutoStart = ref(false)

onLoad((query) => {
  if (query?.lane === 'article') lane.value = 'article'
  if (query?.article) pendingArticleId.value = String(query.article)
  if (query?.autoStart === '1') pendingAutoStart.value = true
  // 拼读单词组走记忆曲线；文章练习不改 currentBook，并清掉会话书残留
  if (query?.lane !== 'article') {
    vocabStore.setSessionUnitId(undefined)
    vocabStore.setSessionBookCode(undefined)
  } else {
    // 文章短文练习：不写入会话词书/单元，避免影响认读/拼读
    vocabStore.setSessionUnitId(undefined)
    vocabStore.setSessionBookCode(undefined)
  }
})

onShow(async () => {
  if (!(await requireSubject('english', 'student'))) return
  if (ready.value) return
  ready.value = true
  await loadSetup()
  if (pendingAutoStart.value && pendingArticleId.value) {
    pendingAutoStart.value = false
    await startArticle(pendingArticleId.value)
  } else if (pendingArticleId.value) {
    lane.value = 'article'
  }
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
  background: var(--pc-main-bg, var(--pc-main-bg, #f4f1ea));
  color: var(--pc-text);
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
  color: var(--pc-text-3);
}

.lede, .hint {
  display: block;
  color: var(--pc-text-2);
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

.chips, .accent-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scope-chips {
  margin-top: -4px;
}

.practice-rail {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 2px;
  margin: 8px 0 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.rail-tab {
  position: relative;
  flex: 0 0 auto;
  padding: 8px 12px 10px;
  border: none;
  background: transparent;
  color: var(--pc-text-3);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.rail-label {
  font-size: 14px;
  line-height: 1.2;
}

/* Same language as 一词连练/整组再换: muted = off but still clickable, teal = on */
.rail-tab.is-off {
  color: var(--pc-text-3);
  font-weight: 500;
}

.rail-tab.is-on {
  color: var(--pc-accent);
  font-weight: 650;
}

.rail-tab.is-current::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 2px;
  height: 3px;
  border-radius: 999px;
  background: var(--pc-accent);
}

.rail-gap {
  width: 1px;
  align-self: stretch;
  margin: 6px 8px;
  background: var(--pc-surface-1);
  flex: 0 0 auto;
}

.rail-toggle {
  color: var(--pc-text-3);
  font-weight: 500;
}

.rail-toggle.is-picked {
  color: var(--pc-accent);
  font-weight: 650;
}

.chip, .mini, .keycap {
  border: 1px solid var(--pc-border-strong);
  background: transparent;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
}

.chip.on, .mini.on {
  background: var(--pc-solid);
  color: var(--pc-on-solid);
  border-color: var(--pc-solid);
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 14px 0;
  color: var(--pc-text-2);
  font-size: 14px;
}

.start, .ghost {
  margin-top: 16px;
  border-radius: 999px;
  font-size: 16px;
}

.start {
  background: var(--pc-accent);
  color: white;
}

.ghost {
  background: transparent;
  color: var(--pc-text);
  border: 1px solid var(--pc-border-strong);
}

.start.slim, .ghost.slim {
  margin-top: 0;
  font-size: 14px;
  padding: 0 16px;
}

.btn-hotkey {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--pc-accent);
  opacity: 0.85;
}

.examples-panel {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #e4dccf;
  text-align: left;
  width: 100%;
}

.examples-title {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 650;
  color: var(--pc-text-2);
}

.example-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #efe7db;
}

.example-row.is-active .example-text {
  color: var(--pc-accent);
}

.example-text {
  flex: 1;
  font-size: 16px;
  line-height: 1.55;
  color: var(--pc-text);
  font-family: Palatino, 'Palatino Linotype', 'Iowan Old Style', Georgia, 'Songti SC', serif;
}

.ex-hit {
  color: var(--pc-accent);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.example-play {
  flex: 0 0 auto;
  margin-top: 2px;
  font-size: 13px;
  color: var(--pc-accent);
  font-weight: 650;
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
  color: var(--pc-accent);
}

.saved-delete {
  color: var(--pc-danger);
}

.field, .area, .answer {
  width: 100%;
  box-sizing: border-box;
  margin-top: 10px;
  background: white;
  border: 1px solid var(--pc-border-strong);
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
  color: var(--pc-text-2);
}

.top-link {
  color: var(--pc-accent);
}

.progress-track {
  height: 4px;
  background: var(--pc-surface-1);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: var(--pc-accent);
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

.prompt-h5 .word-flags {
  justify-content: center;
}

.word-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.flag {
  padding: 2px 9px;
  border: 1px solid var(--pc-border-strong);
  border-radius: 999px;
  color: var(--pc-text-3);
  font-size: 12px;
}

.flag.due,
.flag.favorite {
  border-color: var(--pc-accent);
  background: var(--pc-accent-soft);
  color: var(--pc-accent);
}

.flag.lapse,
.flag.wrong {
  border-color: var(--pc-danger);
  background: var(--pc-danger-soft);
  color: var(--pc-danger);
}

.big-word, .live-line {
  font-family: Palatino, "Palatino Linotype", "Iowan Old Style", "Songti SC", serif;
  font-size: 64px;
  line-height: 1.15;
  color: var(--pc-text);
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

.glyph.ok { color: var(--pc-accent); }
.glyph.bad, .glyph.extra { color: var(--pc-danger); }
.glyph.pending { color: var(--pc-text-3); }

.listen-mark {
  display: flex;
  align-items: center;
  gap: 14px;
}

.listen-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--pc-solid);
  color: var(--pc-on-solid);
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

.result.good { box-shadow: inset 3px 0 0 var(--pc-accent); }
.result.bad { box-shadow: inset 3px 0 0 var(--pc-danger); }

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

.done .score,
.score-soft {
  display: block;
  font-family: Palatino, "Palatino Linotype", "Songti SC", serif;
  font-size: 72px;
  margin-top: 12px;
}

.score-soft {
  font-size: 64px;
}

.bridge .lede {
  max-width: 28em;
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
  color: var(--pc-accent);
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
  background: var(--pc-accent);
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
  background: var(--pc-surface-1);
}

.lv-1 { background: #c5ddd4; }
.lv-2 { background: #7fbfb0; }
.lv-3 { background: #2f8f86; }
.lv-4 { background: var(--pc-accent); }

.article-block {
  margin-bottom: 4px;
}

@media (max-width: 720px) {
  .big-word, .live-line {
    font-size: 40px;
  }
}
</style>
