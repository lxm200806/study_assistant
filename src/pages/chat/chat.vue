<template>
  <view class="container">
    <view class="chat-header">
      <text class="header-title">AI陪聊</text>
      <text class="header-subtitle">
        {{ currentBookName }} · {{ modeLabel }}
        <text v-if="chatMode === 'roleplay' && scenarioChosen && scenario"> · {{ scenarioLabel }}</text>
        <text v-else-if="modeHint && chatMode !== 'roleplay'"> · {{ modeHint }}</text>
        <text v-if="!quota.isPremium && quota.remaining >= 0"> · 今日剩余 {{ quota.remaining }} 次</text>
      </text>
      <view class="mode-tabs">
        <text
          v-for="m in chatModes"
          :key="m.id"
          :class="['mode-tab', chatMode === m.id ? 'active' : '']"
          @tap="onModeTab(m.id)"
        >{{ m.label }}</text>
      </view>
      <view class="ui-tabs">
        <text :class="['ui-tab', uiMode === 'voice' ? 'active' : '']" @tap="uiMode = 'voice'">语音对话</text>
        <text :class="['ui-tab', uiMode === 'text' ? 'active' : '']" @tap="uiMode = 'text'">文字</text>
      </view>
    </view>

    <!-- Scenario picker overlay (shown when roleplay mode is chosen but no scenario yet) -->
    <view v-if="showScenarioPicker" class="scenario-picker">
      <text class="scenario-picker-title">选择一个情景开始对话</text>
      <view class="scenario-grid">
        <view
          v-for="s in builtInScenarios"
          :key="s.id"
          class="scenario-card"
          @tap="selectScenario(s.id, s.label)"
        >
          <text class="scenario-card-icon">{{ s.icon }}</text>
          <text class="scenario-card-label">{{ s.label }}</text>
        </view>
      </view>
      <view class="scenario-custom">
        <input
          class="scenario-custom-input"
          v-model="customScenarioInput"
          placeholder="自定义场景，例如：图书馆借书"
          @confirm="confirmCustomScenario"
        />
        <text class="scenario-custom-btn" @tap="confirmCustomScenario">开始</text>
      </view>
    </view>

    <scroll-view
      v-if="!showScenarioPicker"
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
            <view v-if="!msg.isUser && msg.text && !msg.streaming" class="message-actions">
              <text class="msg-action-btn" @tap.stop="copyMessage(msg.text)">复制</text>
              <text class="msg-action-btn" @tap.stop="speakAiMessage(msg.text)">🔊</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="voiceStatus === 'listening' || voiceStatus === 'transcribing'" class="status-banner">
        <text>识别中：{{ liveTranscriptDisplay }}</text>
      </view>
    </scroll-view>

    <view v-if="!showScenarioPicker && uiMode === 'voice'" class="voice-panel">
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
        <text class="voice-mic-icon">{{ voiceStatus === 'listening' ? '●' : '🎙' }}</text>
      </view>
      <text class="voice-hint">按住说话，松开后 AI 自动回复并朗读</text>
    </view>

    <view v-else-if="!showScenarioPicker" class="chat-input-bar">
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
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useVocabularyStore } from '@/stores/vocabulary'
import { chatAPI } from '@/utils/api'
import { stopSpeak, unlockTtsPlayback, speakReplyText } from '@/utils/tts'
import { streamChatMessage } from '@/utils/chat-stream'
import { isMeaningfulSpeechText } from '@/utils/speech-text'
import { useAudioSession } from '@/composables/useAudioSession'
import { isBrowserH5 } from '@/utils/audio-recording'
import { useStreamingTts } from '@/composables/useStreamingTts'
import { useStreamingAsr } from '@/composables/useStreamingAsr'

const userStore = useUserStore()
const vocabStore = useVocabularyStore()
const audio = useAudioSession()
const streamingTts = useStreamingTts()
const streamingAsr = useStreamingAsr()
const { partialText: asrPartialText, asrProvider, loadConfig, startLiveRecording, stopLiveRecording, stopLiveRecognition } = streamingAsr

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
  { id: 'free' as ChatMode, label: '自由聊天', hint: '像朋友一样自然聊' },
  { id: 'challenge' as ChatMode, label: '用词挑战', hint: '用目标词造句练习' },
  { id: 'roleplay' as ChatMode, label: '情景', hint: '角色扮演对话' }
]

// Built-in scenarios mirrored from the backend constants (label + icon for UI)
const builtInScenarios = [
  { id: 'cafe', label: '咖啡馆点餐', icon: '☕' },
  { id: 'shopping', label: '逛商店', icon: '🛍' },
  { id: 'directions', label: '问路', icon: '🗺' },
  { id: 'doctor', label: '看医生', icon: '🏥' },
  { id: 'hotel', label: '酒店入住', icon: '🏨' },
  { id: 'airport', label: '机场对话', icon: '✈️' },
  { id: 'birthday', label: '生日派对', icon: '🎂' },
  { id: 'interview', label: '工作面试', icon: '💼' },
]

const messages = ref<Message[]>([])
const inputText = ref('')
const scrollToId = ref('')
const chatMode = ref<ChatMode>('free')
const uiMode = ref<UiMode>('voice')
const scenario = ref('')
const scenarioChosen = ref(false)
const customScenarioInput = ref('')
const quota = ref({ remaining: -1, isPremium: false })
const voiceStatus = ref<VoiceStatus>('idle')
const partialTranscript = ref('')
const isBusy = ref(false)
let liveUserDraftMessage: Message | null = null
let voiceDebugStartedAt = 0

const voiceDebugElapsedMs = () => {
  if (!voiceDebugStartedAt) return 0
  return Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - voiceDebugStartedAt)
}

const debugVoiceChat = (event: string, payload: Record<string, unknown> = {}) => {
  try {
    console.debug('[VoiceChat]', {
      event,
      elapsedMs: voiceDebugElapsedMs(),
      voiceStatus: voiceStatus.value,
      ...payload
    })
  } catch {
    // ignore
  }
}

const currentBookName = computed(() => vocabStore.getCurrentBook?.name || vocabStore.currentBookCode || 'KET')
const modeLabel = computed(() => chatModes.find(m => m.id === chatMode.value)?.label || '自由聊天')
const modeHint = computed(() => chatModes.find(m => m.id === chatMode.value)?.hint || '')
const showScenarioPicker = computed(() => chatMode.value === 'roleplay' && !scenarioChosen.value)
const scenarioLabel = computed(() => {
  const found = builtInScenarios.find(s => s.id === scenario.value)
  return found ? found.label : scenario.value
})
const voiceBusy = computed(() => voiceStatus.value === 'transcribing' || voiceStatus.value === 'thinking' || voiceStatus.value === 'speaking')
const liveTranscriptDisplay = computed(() => asrPartialText.value || partialTranscript.value || '...')

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

const onModeTab = (id: ChatMode) => {
  if (chatMode.value === id) return
  chatMode.value = id
  if (id === 'roleplay') {
    // Reset scenario choice so the picker shows again
    scenarioChosen.value = false
    scenario.value = ''
    customScenarioInput.value = ''
  }
}

const selectScenario = (id: string, label: string) => {
  scenario.value = id
  scenarioChosen.value = true
  messages.value = []
  const greeting = `Scene: ${label}. Alex is ready - feel free to start!`
  addMessage(greeting, false)
}

const confirmCustomScenario = () => {
  const text = customScenarioInput.value.trim()
  if (!text) {
    uni.showToast({ title: '请输入场景描述', icon: 'none' })
    return
  }
  scenario.value = text
  scenarioChosen.value = true
  customScenarioInput.value = ''
  messages.value = []
  addMessage(`Custom scene: ${text}. Let's go!`, false)
}

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

const updateMessage = (message: Message | null | undefined, patch: Partial<Message>) => {
  if (!message) return
  const index = messages.value.findIndex(msg => msg.id === message.id)
  if (index < 0) return
  messages.value[index] = { ...messages.value[index], ...patch }
  Object.assign(message, messages.value[index])
  scrollToBottom(message.id)
}

const getMessageText = (message: Message | null | undefined) => {
  if (!message) return ''
  return messages.value.find(msg => msg.id === message.id)?.text || message.text || ''
}

const removeLiveUserDraftMessage = () => {
  if (!liveUserDraftMessage) return
  debugVoiceChat('remove-live-user-draft', { messageId: liveUserDraftMessage.id })
  messages.value = messages.value.filter(msg => msg.id !== liveUserDraftMessage?.id)
  liveUserDraftMessage = null
}

watch(asrPartialText, (text) => {
  if (!liveUserDraftMessage) return
  if (!text) return
  debugVoiceChat('asr-partial-updates-user-bubble', {
    messageId: liveUserDraftMessage.id,
    text
  })
  updateMessage(liveUserDraftMessage, { text, streaming: true })
})

const sendStreamTurn = async (userText: string, existingUserMessage?: Message | null) => {
  if (!userText.trim() || isBusy.value) return

  isBusy.value = true
  voiceStatus.value = 'thinking'
  streamingTts.reset()
  stopSpeak()

  if (existingUserMessage) {
    debugVoiceChat('reuse-live-user-draft-for-send', {
      messageId: existingUserMessage.id,
      finalText: userText
    })
    updateMessage(existingUserMessage, { text: userText, streaming: false })
  } else {
    debugVoiceChat('add-user-message-for-text-send', { text: userText })
    addMessage(userText, true)
  }
  const aiMsg = addMessage('', false, true)
  let voiceSpokeAny = false

  await new Promise<void>((resolve) => {
    void streamChatMessage({
      content: userText,
      bookCode: vocabStore.currentBookCode,
      mode: chatMode.value,
      scenario: chatMode.value === 'roleplay' ? scenario.value : undefined,
      onToken: (token) => {
        updateMessage(aiMsg, { text: getMessageText(aiMsg) + token })
        if (uiMode.value === 'voice' && token) {
          voiceStatus.value = 'speaking'
          voiceSpokeAny = true
          streamingTts.feed(token)
        }
      },
      onDone: (payload) => {
        const finalText = payload.fullText || getMessageText(aiMsg)
        updateMessage(aiMsg, { text: finalText, streaming: false })
        if (typeof payload.remainingFree === 'number') quota.value.remaining = payload.remainingFree
        if (payload.usedFallback) {
          uni.showToast({ title: '模型未连通，已使用备用回复', icon: 'none' })
        }

        void (async () => {
          if (uiMode.value === 'voice' && finalText.trim()) {
            voiceStatus.value = 'speaking'
            if (voiceSpokeAny) {
              await streamingTts.flush()
            } else {
              try {
                await speakReplyText(finalText)
              } catch {
                uni.showToast({ title: '自动朗读失败，请点扬声器', icon: 'none' })
              }
            }
          }
          voiceStatus.value = 'idle'
          isBusy.value = false
          resolve()
        })()
      },
      onError: (message) => {
        updateMessage(aiMsg, {
          text: message.includes('今日免费') ? '今日免费对话次数已用完。' : '抱歉，暂时无法回复。',
          streaming: false
        })
        voiceStatus.value = 'idle'
        isBusy.value = false
        resolve()
      }
    }).catch((error) => {
      updateMessage(aiMsg, {
        text: (error as Error).message.includes('今日免费')
          ? '今日免费对话次数已用完。'
          : '抱歉，暂时无法回复。',
        streaming: false
      })
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
  voiceDebugStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  await unlockTtsPlayback()
  streamingTts.stop()
  stopSpeak()
  voiceStatus.value = 'listening'
  partialTranscript.value = ''
  removeLiveUserDraftMessage()
  liveUserDraftMessage = addMessage('', true, true)
  debugVoiceChat('press-start-created-live-user-draft', {
    messageId: liveUserDraftMessage.id,
    isBrowserH5: isBrowserH5()
  })
  try {
    if (isBrowserH5()) {
      debugVoiceChat('start-h5-live-recording')
      await startLiveRecording()
    } else {
      debugVoiceChat('start-native-recording')
      await audio.startRecord()
    }
  } catch (error) {
    voiceStatus.value = 'idle'
    removeLiveUserDraftMessage()
    debugVoiceChat('press-start-error', {
      message: (error as Error).message
    })
    const msg = (error as Error).message || ''
    if (msg.includes('Unauthorized')) {
      uni.showToast({ title: '请先登录', icon: 'none' })
    } else if (msg.includes('麦克风') || msg.includes('不支持')) {
      uni.showToast({ title: msg, icon: 'none' })
    } else {
      uni.showToast({ title: '无法开始录音', icon: 'none' })
    }
  }
}

const onVoicePressEnd = async () => {
  if (voiceStatus.value !== 'listening') return
  await unlockTtsPlayback()
  voiceStatus.value = 'transcribing'
  debugVoiceChat('press-end-stop-recording')

  try {
    let finalText = ''
    if (isBrowserH5()) {
      finalText = (await stopLiveRecording()).trim()
    } else {
      const path = await audio.stopRecord()
      finalText = (await audio.uploadTranscribe(path)).trim()
    }
    partialTranscript.value = finalText
    debugVoiceChat('press-end-final-asr-text', { finalText })
    if (!isMeaningfulSpeechText(finalText)) {
      voiceStatus.value = 'idle'
      removeLiveUserDraftMessage()
      uni.showToast({ title: '未识别到有效内容，请再说一次', icon: 'none' })
      return
    }
    const userDraft = liveUserDraftMessage
    liveUserDraftMessage = null
    await sendStreamTurn(finalText, userDraft)
  } catch (error) {
    voiceStatus.value = 'idle'
    removeLiveUserDraftMessage()
    debugVoiceChat('press-end-error', {
      message: (error as Error).message
    })
    const msg = (error as Error).message || ''
    const title = msg.includes('未配置') || msg.includes('WHISPER')
      ? '语音识别未配置'
      : msg.includes('今日免费') || msg.includes('SPEECH_LIMIT')
        ? '今日语音识别次数已用完'
        : msg || '语音识别失败'
    uni.showToast({ title, icon: 'none' })
  }
}

const speakAiMessage = async (text: string) => {
  try {
    await unlockTtsPlayback()
    streamingTts.stop()
    await speakReplyText(text)
  } catch {
    uni.showToast({ title: '播放失败', icon: 'none' })
  }
}

const copyMessage = (text: string) => {
  const content = text?.trim()
  if (!content) return
  uni.setClipboardData({
    data: content,
    success: () => uni.showToast({ title: '已复制', icon: 'success' })
  })
}

const welcomeForMode = (mode: ChatMode) => {
  if (mode === 'challenge') {
    return 'Ready for a word challenge? Tell me something, and I\'ll help you practice vocabulary from your book.'
  }
  if (mode === 'roleplay') {
    return scenario.value
      ? `Let's role-play: ${scenario.value}. Say something to start the scene!`
      : 'Pick a scenario or just start talking - we\'ll stay in character.'
  }
  return 'Hi! Chat with me like a friend - say hello or tell me about your day.'
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
      addMessage(welcomeForMode(chatMode.value), false)
    }
  } catch {
    addMessage(welcomeForMode(chatMode.value), false)
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
  if (query?.scenario) {
    scenario.value = query.scenario as string
    scenarioChosen.value = true
  }
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
  stopLiveRecognition()
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

.message-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.msg-action-btn {
  font-size: 24rpx;
  color: #667eea;
  padding: 4rpx 8rpx;
}

.status-banner {
  background: #eef2ff;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: #667eea;
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

// Scenario picker
.scenario-picker {
  flex: 1;
  padding: 40rpx 28rpx 48rpx;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.scenario-picker-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  text-align: center;
  margin-bottom: 36rpx;
  display: block;
}

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-bottom: 40rpx;
}

.scenario-card {
  background: white;
  border-radius: 24rpx;
  padding: 32rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.07);
  active-opacity: 0.7;
}

.scenario-card-icon {
  font-size: 64rpx;
}

.scenario-card-label {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  text-align: center;
}

.scenario-custom {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.scenario-custom-input {
  flex: 1;
  height: 80rpx;
  background: white;
  border-radius: 40rpx;
  padding: 0 30rpx;
  font-size: 28rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.scenario-custom-btn {
  font-size: 28rpx;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 18rpx 32rpx;
  border-radius: 40rpx;
  font-weight: 500;
}
</style>
