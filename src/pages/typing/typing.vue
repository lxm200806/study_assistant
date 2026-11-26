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
        <StateHint v-if="!historyLoaded" tone="loading" text="正在读取练习记录。" />
        <StateHint
          v-else-if="!hasHistory"
          tone="empty"
          text="完成一组后，这里会显示速度和每天练了多少。"
        />
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
import { onUnmounted, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import BookSwitcher from '@/components/BookSwitcher.vue'
import StateHint from '@/components/StateHint.vue'
import TypingWordCore from '@/components/typing/TypingWordCore.vue'
import TypingPassageCore from '@/components/typing/TypingPassageCore.vue'
import { WordPracticeType } from '@/typing-engine/types'
import { useVocabularyStore } from '@/stores/vocabulary'
import { typingAPI } from '@/utils/api'
import { isBrowserH5 } from '@/platform/runtime'
import { requireSubject } from '@/utils/subject'
import { speakPassage, speakSentence, speakText, unlockTtsPlayback } from '@/utils/tts'
import { splitTextForTts } from '@/utils/tts-text'
import {
  answersMatch,
  saveEnabledWordModes,
  type PersistedWordMode
} from '@/utils/typing'
import { unlockTypingAudio } from '@/typing-engine/sounds'
import type {
  Answered,
  ArticleMode,
  ArticleRow,
  ExamCard,
  ExamMode,
  RejectedToken,
  SentenceItem,
  Stage,
  TypingWord,
  WordMode,
  WordPhase
} from './typing.types'
import { useTypingSetup } from './useTypingSetup'
import {
  EXAM_MODE_ORDER,
  LEARN_MODE_ORDER,
  buildExamQueue,
  loadExamModes,
  shuffleInPlace
} from './exam-builder'
import { useTypingArticleEditor } from './useTypingArticleEditor'
import { useTypingPreferences } from './useTypingPreferences'
import { useTypingPresentation } from './useTypingPresentation'
import { useTypingSetupOptions } from './useTypingSetupOptions'

const vocabStore = useVocabularyStore()
const isH5 = isBrowserH5()

const stage = ref<Stage>('setup')
const lane = ref<'words' | 'article'>('words')
const wordPhase = ref<WordPhase>('learn')
const enabledExamModes = ref<ExamMode[]>(loadExamModes())
const wordMode = ref<WordMode>('follow')
const articleMode = ref<ArticleMode>('follow')
const learnModes: Array<{ key: WordMode; label: string }> = [
  { key: 'follow', label: '跟写' },
  { key: 'self', label: '自测' }
]
const examModeOptions: Array<{ key: ExamMode; label: string }> = [
  { key: 'recall', label: '默写' },
  { key: 'dictation', label: '听写' }
]

function isDueWord(value?: string | null) {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time <= Date.now()
}

const {
  summary,
  articles,
  historyLoaded,
  history,
  hasHistory,
  maxSpeed,
  refreshSummary,
  refreshArticles,
  refreshHistory,
  localDate,
  barHeight
} = useTypingSetup(wordMode)

const {
  source,
  moreSources,
  allBooks,
  groupSize,
  counts,
  extraSources,
  pickSource,
  sourceLabel
} = useTypingSetupOptions(summary)

const sentenceWrongWords = ref<string[]>([])
const roundStartedAt = ref(0)
const typedChars = ref(0)
const correctChars = ref(0)
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
const scopedToBook = ref(false)
const answered = ref<Answered[]>([])
const correctCount = ref(0)
const suspendKeys = ref(false)
const activeExampleIndex = ref(-1)
const typingShowResult = ref(false)
const typingShowFull = ref(false)
const committing = ref(false)
const cardKey = ref(0)

const {
  articleTitle,
  articleBody,
  articleTranslation,
  editingId,
  editingBuiltin,
  editImpact,
  beginEdit,
  cancelEdit,
  onArticleFieldBlur,
  saveArticle,
  removeArticle,
  pickArticleFile
} = useTypingArticleEditor({ refreshArticles, suspendKeys })

const {
  shortcuts,
  keySound,
  autoSpeak,
  autoExample,
  ttsGender,
  capturing,
  shortcutRows,
  hotkeyLabel,
  toggleSound,
  toggleAutoSpeak,
  toggleAutoExample,
  setGender
} = useTypingPreferences({
  stage,
  suspendKeys,
  onReplay: () => void replay(),
  onExample: () => void playExample(),
  onFavorite: () => void toggleFavorite(),
  onMastered: () => void toggleMastered(),
  onHint: () => bumpHint(),
  onToggleAccent: () => {
    accent.value = accent.value === 'us' ? 'uk' : 'us'
  }
})

let selfTimer: ReturnType<typeof setTimeout> | null = null
let lastAction = 0

const enginePracticeType = WordPracticeType.FollowWrite
const activeArticleId = ref('')
const roundSaved = ref(false)

const {
  currentWord,
  currentSentence,
  expectedText,
  total,
  examModes,
  activeModeChain,
  progressLabel,
  progressPct,
  engineMasked,
  usePassageTyping,
  dictationMode,
  maskedPrompt,
  followLive,
  showSpelling,
  marks,
  graded,
  phoneticLine,
  showPhonetic,
  showMeaningLine,
  meaningLine,
  firstLetter,
  exampleList,
  showExamplesPanel,
  sentenceTranslation,
  showAside,
  promptKicker,
  placeholder,
  accuracy,
  missed
} = useTypingPresentation({
  lane,
  wordPhase,
  wordMode,
  articleMode,
  enabledExamModes,
  words,
  sentences,
  index,
  examQueue,
  examCursor,
  userInput,
  showResult,
  selfVisible,
  hintLevel,
  accent,
  typingShowResult,
  committing,
  answered,
  correctCount,
  fullTranslation,
  showFullTranslation
})

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

async function loadSetup() {
  vocabStore.loadSettings()
  await vocabStore.loadBooks()
  await Promise.all([refreshSummary(), refreshArticles(), refreshHistory()])
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

onUnmounted(() => {
  if (selfTimer) clearTimeout(selfTimer)
})
</script>

<style scoped lang="scss" src="./typing.scss"></style>
