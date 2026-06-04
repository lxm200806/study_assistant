<template>
  <view class="container">
    <view class="chat-header">
      <text class="header-title">AI陪聊</text>
      <text class="header-subtitle">
        {{ currentBookName }} · {{ modeLabel }}
        <text v-if="!quota.isPremium && quota.remaining >= 0"> · 今日剩余 {{ quota.remaining }} 次</text>
      </text>
      <view class="mode-tabs">
        <text
          v-for="m in chatModes"
          :key="m.id"
          :class="['mode-tab', chatMode === m.id ? 'active' : '']"
          @tap="chatMode = m.id"
        >{{ m.label }}</text>
      </view>
      <view class="ui-tabs">
        <text :class="['ui-tab', uiMode === 'voice' ? 'active' : '']" @tap="uiMode = 'voice'">语音对话</text>
        <text :class="['ui-tab', uiMode === 'text' ? 'active' : '']" @tap="uiMode = 'text'">文字</text>
      </view>
    </view>

    <scroll-view
      class="chat-messages"
      scroll-y
      :scroll-into-view="scrollToId"
      scroll-with-animation
    >
      <view
        v-for="msg in messages"
        :key="msg.id"
        :id="'msg-' + msg.id"
        :class="['message-item', msg.isUser ? 'user' : 'ai']"
      >
        <view class="avatar">
          <text>{{ msg.isUser ? userStore.username.charAt(0) : 'AI' }}</text>
        </view>
        <view class="message-content">
          <text class="message-text">{{ msg.text || (msg.streaming ? '...' : '') }}</text>
          <view class="message-footer">
            <text class="message-time">{{ formatTime(msg.timestamp) }}</text>
            <text v-if="!msg.isUser && msg.text" class="speak-btn" @tap="speakAiMessage(msg.text)">🔊</text>
          </view>
        </view>
      </view>

      <view v-if="voiceStatus === 'transcribing'" class="status-banner">
        <text>识别中：{{ asrPartialText || partialTranscript || '...' }}</text>
      </view>
    </scroll-view>

    <view v-if="sessionWords.length" class="session-bar">
      <text class="session-label">本会话词汇</text>
      <scroll-view scroll-x class="session-scroll">
        <text v-for="word in sessionWords" :key="word" class="session-tag">{{ word }}</text>
      </scroll-view>
    </view>

    <view v-if="uiMode === 'voice'" class="voice-panel">
      <text class="voice-status">{{ voiceStatusLabel }}</text>
      <text v-if="asrProvider === 'xfyun'" class="voice-provider">讯飞流式识别</text>
      <text v-else class="voice-provider">Whisper 识别（建议配置讯飞 ASR）</text>
      <view
        class="voice-mic"
        :class="{ active: voiceStatus === 'listening', disabled: voiceBusy }"
        @touchstart.prevent="onVoicePressStart"
        @touchend.prevent="onVoicePressEnd"
        @mousedown.prevent="onVoicePressStart"
        @mouseup.prevent="onVoicePressEnd"
        @mouseleave.prevent="onVoicePressEnd"
      >
        <text class="voice-mic-icon">{{ voiceStatus === 'listening' ? '⏺' : '🎤' }}</text>
      </view>
      <text class="voice-hint">按住说话，松开后 AI 自动回复并朗读</text>
    </view>

    <view v-else class="chat-input-bar">
      <view class="input-container">
        <input
          class="chat-input"
          v-model="inputText"
          placeholder="输入消息..."
          @confirm="sendTextMessage"
        />
      </view>
      <view class="action-buttons">
        <button class="send-btn" :disabled="!inputText.trim() || isBusy" @tap="sendTextMessage">
          <text>发送</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useVocabularyStore } from '@/stores/vocabulary'
import { chatAPI } from '@/utils/api'
import { speakText, stopSpeak } from '@/utils/tts'
import { streamChatMessage } from '@/utils/chat-stream'
import { useAudioSession } from '@/composables/useAudioSession'
import { useStreamingTts } from '@/composables/useStreamingTts'
import { useStreamingAsr } from '@/composables/useStreamingAsr'

const userStore = useUserStore()
const vocabStore = useVocabularyStore()
const audio = useAudioSession()
const streamingTts = useStreamingTts()
const streamingAsr = useStreamingAsr()
const { partialText: asrPartialText, asrProvider, loadConfig, startSession, uploadRecording } = streamingAsr

type ChatMode = 'free' | 'challenge' | 'roleplay'
type UiMode = 'voice' | 'text'
type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: number
  streaming?: boolean
}

const chatModes = [
  { id: 'free' as ChatMode, label: '自由聊' },
  { id: 'challenge' as ChatMode, label: '用词挑战' },
  { id: 'roleplay' as ChatMode, label: '情景' }
]

const messages = ref<Message[]>([])
const inputText = ref('')
const scrollToId = ref('')
const chatMode = ref<ChatMode>('free')
const uiMode = ref<UiMode>('voice')
const scenario = ref('')
const sessionWords = ref<string[]>([])
const quota = ref({ remaining: -1, isPremium: false })
const voiceStatus = ref<VoiceStatus>('idle')
const partialTranscript = ref('')
const isBusy = ref(false)
let voiceSessionStarted = false

const currentBookName = computed(() => vocabStore.getCurrentBook?.name || vocabStore.currentBookCode || 'KET')
const modeLabel = computed(() => chatModes.find(m => m.id === chatMode.value)?.label || '自由聊')
const voiceBusy = computed(() => voiceStatus.value === 'transcribing' || voiceStatus.value === 'thinking' || voiceStatus.value === 'speaking')

const voiceStatusLabel = computed(() => {
  const map: Record<VoiceStatus, string> = {
    idle: '按住麦克风开始说话',
    listening: '正在聆听...',
    transcribing: '正在识别...',
    thinking: 'AI 思考中...',
    speaking: 'AI 正在回复...'
  }
  return map[voiceStatus.value]
})

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

const scrollToBottom = (id: string) => {
  setTimeout(() => {
    scrollToId.value = 'msg-' + id
  }, 80)
}

const addMessage = (text: string, isUser: boolean, streaming = false): Message => {
  const msg: Message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    isUser,
    timestamp: Date.now(),
    streaming
  }
  messages.value.push(msg)
  scrollToBottom(msg.id)
  return msg
}

const applyMatchedWords = (matched: Array<{ word: string }>) => {
  for (const item of matched) {
    if (!sessionWords.value.includes(item.word)) {
      sessionWords.value.push(item.word)
    }
  }
}

const sendStreamTurn = async (userText: string) => {
  if (!userText.trim() || isBusy.value) return

  isBusy.value = true
  voiceStatus.value = 'thinking'
  streamingTts.reset()
  stopSpeak()

  addMessage(userText, true)
  const aiMsg = addMessage('', false, true)

  await new Promise<void>((resolve) => {
    void streamChatMessage({
      content: userText,
      bookCode: vocabStore.currentBookCode,
      mode: chatMode.value,
      scenario: chatMode.value === 'roleplay' ? scenario.value : undefined,
      onToken: (token) => {
        aiMsg.text += token
        voiceStatus.value = 'speaking'
        streamingTts.feed(token)
      },
      onDone: (payload) => {
        aiMsg.text = payload.fullText || aiMsg.text
        aiMsg.streaming = false
        if (payload.matchedWords?.length) applyMatchedWords(payload.matchedWords)
        if (typeof payload.remainingFree === 'number') quota.value.remaining = payload.remainingFree
        void streamingTts.flush().finally(() => {
          voiceStatus.value = 'idle'
          isBusy.value = false
          resolve()
        })
      },
      onError: (message) => {
        aiMsg.text = message.includes('今日免费') ? '今日免费对话次数已用完。' : '抱歉，暂时无法回复。'
        aiMsg.streaming = false
        voiceStatus.value = 'idle'
        isBusy.value = false
        resolve()
      }
    }).catch((error) => {
      aiMsg.text = (error as Error).message.includes('今日免费')
        ? '今日免费对话次数已用完。'
        : '抱歉，暂时无法回复。'
      aiMsg.streaming = false
      voiceStatus.value = 'idle'
      isBusy.value = false
      resolve()
    })
  })
}

const sendTextMessage = async () => {
  if (!inputText.value.trim() || isBusy.value) return
  const text = inputText.value.trim()
  inputText.value = ''
  await sendStreamTurn(text)
}

const onVoicePressStart = async () => {
  if (voiceBusy.value || voiceStatus.value === 'listening') return
  streamingTts.stop()
  stopSpeak()
  voiceStatus.value = 'listening'
  partialTranscript.value = ''
  voiceSessionStarted = false
  try {
    await startSession()
    voiceSessionStarted = true
    await audio.startRecord()
  } catch {
    voiceStatus.value = 'idle'
    uni.showToast({ title: '无法开始录音', icon: 'none' })
  }
}

const onVoicePressEnd = async () => {
  if (voiceStatus.value !== 'listening') return
  voiceStatus.value = 'transcribing'

  try {
    const path = await audio.stopRecord()
    if (!voiceSessionStarted) throw new Error('session missing')
    const text = await uploadRecording(path)
    partialTranscript.value = text
    if (!text.trim()) {
      voiceStatus.value = 'idle'
      uni.showToast({ title: '未识别到内容', icon: 'none' })
      return
    }
    await sendStreamTurn(text)
  } catch (error) {
    voiceStatus.value = 'idle'
    const msg = (error as Error).message
    uni.showToast({ title: msg.includes('未配置') ? '语音识别未配置' : '语音识别失败', icon: 'none' })
  }
}

const speakAiMessage = async (text: string) => {
  try {
    streamingTts.stop()
    await speakText(text)
  } catch {
    uni.showToast({ title: '播放失败', icon: 'none' })
  }
}

const loadHistory = async () => {
  try {
    const result = await chatAPI.history(1, 30)
    const rows = result.data || []
    messages.value = rows.map(row => ({
      id: row.id,
      text: row.content,
      isUser: row.role === 'user',
      timestamp: new Date(row.createdAt).getTime()
    }))
    if (messages.value.length === 0) {
      addMessage('你好！按住麦克风用英语聊天，我会自动回复并朗读。', false)
    }
  } catch {
    addMessage('你好！按住麦克风用英语聊天，我会自动回复并朗读。', false)
  }
}

const loadQuota = async () => {
  try {
    const result = await chatAPI.quota()
    if (result.data) quota.value = result.data
  } catch {
    // ignore
  }
}

onLoad((query) => {
  if (query?.mode === 'challenge' || query?.mode === 'roleplay' || query?.mode === 'free') {
    chatMode.value = query.mode as ChatMode
  }
  if (query?.scenario) scenario.value = query.scenario as string
  if (query?.ui === 'text') uiMode.value = 'text'
})

onMounted(async () => {
  vocabStore.loadBooks()
  vocabStore.loadSettings()
  await loadConfig()
  await loadHistory()
  await loadQuota()
})

onUnmounted(() => {
  streamingTts.stop()
  stopSpeak()
})
</script>

<style lang="scss" scoped>
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30rpx 24rpx 20rpx;
  text-align: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: 600;
  color: white;
  display: block;
}

.header-subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  display: block;
  margin-top: 6rpx;
}

.mode-tabs, .ui-tabs {
  display: flex;
  justify-content: center;
  gap: 12rpx;
  margin-top: 16rpx;
}

.mode-tab, .ui-tab {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.75);
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.15);

  &.active {
    color: #667eea;
    background: white;
    font-weight: 600;
  }
}

.chat-messages {
  flex: 1;
  padding: 20rpx;
  overflow: hidden;
}

.message-item {
  display: flex;
  margin-bottom: 30rpx;

  &.user {
    flex-direction: row-reverse;
    .avatar { background: #667eea; }
    .message-content {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      .message-text { color: white; }
      .message-time { color: rgba(255, 255, 255, 0.7); }
    }
  }

  &.ai .avatar { background: #4caf50; }
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin: 0 15rpx;
}

.avatar text {
  font-size: 28rpx;
  color: white;
  font-weight: 600;
}

.message-content {
  max-width: 70%;
  background: white;
  border-radius: 20rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.message-text {
  font-size: 30rpx;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.message-time { font-size: 22rpx; color: #999; }
.speak-btn { font-size: 28rpx; padding: 4rpx 8rpx; }

.status-banner {
  background: #eef2ff;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: #667eea;
}

.session-bar {
  background: white;
  padding: 12rpx 20rpx;
  border-top: 1rpx solid #eee;
}

.session-label {
  font-size: 22rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}

.session-scroll { white-space: nowrap; }

.session-tag {
  display: inline-block;
  background: #fff3e0;
  color: #ff9800;
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  margin-right: 12rpx;
}

.voice-panel {
  background: white;
  padding: 32rpx 24rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.voice-status {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 8rpx;
}

.voice-provider {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 24rpx;
}

.voice-mic {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;

  &.active {
    transform: scale(1.06);
    box-shadow: 0 0 0 12rpx rgba(102, 126, 234, 0.25);
  }

  &.disabled {
    opacity: 0.55;
  }
}

.voice-mic-icon {
  font-size: 64rpx;
  color: white;
}

.voice-hint {
  font-size: 24rpx;
  color: #999;
}

.chat-input-bar {
  background: white;
  padding: 20rpx;
  display: flex;
  gap: 20rpx;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.input-container { flex: 1; }

.chat-input {
  width: 100%;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 40rpx;
  padding: 0 30rpx;
  font-size: 30rpx;
}

.send-btn {
  height: 80rpx;
  padding: 0 40rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  font-size: 28rpx;

  &[disabled] { opacity: 0.5; }
}
</style>
