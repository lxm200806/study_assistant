<template>
  <view class="container">
    <view class="chat-header">
      <text class="header-title">AI陪聊</text>
      <text class="header-subtitle">练习口语和听力</text>
    </view>

    <scroll-view 
      class="chat-messages" 
      scroll-y 
      :scroll-into-view="scrollToId"
      scroll-with-animation
    >
      <view 
        v-for="(msg, index) in messages" 
        :key="msg.id"
        :id="'msg-' + msg.id"
        :class="['message-item', msg.isUser ? 'user' : 'ai']"
      >
        <view class="avatar">
          <text>{{ msg.isUser ? userStore.username.charAt(0) : 'AI' }}</text>
        </view>
        <view class="message-content">
          <text class="message-text">{{ msg.text }}</text>
          <text class="message-time">{{ formatTime(msg.timestamp) }}</text>
        </view>
      </view>
      
      <view v-if="isTyping" class="typing-indicator">
        <view class="typing-dots">
          <view class="dot"></view>
          <view class="dot"></view>
          <view class="dot"></view>
        </view>
        <text class="typing-text">AI正在思考...</text>
      </view>
    </scroll-view>

    <view class="chat-input-bar">
      <view class="input-container">
        <input 
          class="chat-input" 
          v-model="inputText" 
          placeholder="输入消息..."
          @confirm="sendMessage"
        />
      </view>
      <view class="action-buttons">
        <view class="action-btn" @tap="startListening">
          <text class="action-icon">{{ isListening ? '⏹️' : '🎤' }}</text>
        </view>
        <button class="send-btn" :disabled="!inputText.trim()" @tap="sendMessage">
          <text>发送</text>
        </button>
      </view>
    </view>

    <view v-if="showStats" class="stats-modal" @tap="showStats = false">
      <view class="stats-content" @tap.stop>
        <view class="stats-header">
          <text class="stats-title">会话统计</text>
          <text class="close-btn" @tap="showStats = false">✕</text>
        </view>
        <view class="stats-grid">
          <view class="stat-card">
            <text class="stat-icon">👂</text>
            <text class="stat-value">{{ sessionStats.listening }}</text>
            <text class="stat-label">听力词汇</text>
          </view>
          <view class="stat-card">
            <text class="stat-icon">👄</text>
            <text class="stat-value">{{ sessionStats.speaking }}</text>
            <text class="stat-label">口语词汇</text>
          </view>
        </view>
        <view class="session-words">
          <text class="section-title">本次会话词汇</text>
          <view class="word-tags">
            <view v-for="word in sessionWords" :key="word" class="word-tag">
              <text>{{ word }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useVocabularyStore } from '@/stores/vocabulary'
import { chatAPI } from '@/utils/api'

const userStore = useUserStore()
const vocabStore = useVocabularyStore()

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: number
}

const messages = ref<Message[]>([])
const inputText = ref('')
const isTyping = ref(false)
const isListening = ref(false)
const showStats = ref(false)
const scrollToId = ref('')

const sessionStats = ref({
  listening: 0,
  speaking: 0
})

const sessionWords = ref<string[]>([])

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

const addMessage = (text: string, isUser: boolean) => {
  const msg: Message = {
    id: Date.now().toString(),
    text,
    isUser,
    timestamp: Date.now()
  }
  messages.value.push(msg)
  
  setTimeout(() => {
    scrollToId.value = 'msg-' + msg.id
  }, 100)
}

const sendMessage = async () => {
  if (!inputText.value.trim()) return
  
  const userText = inputText.value.trim()
  inputText.value = ''
  
  addMessage(userText, true)
  
  processUserMessage(userText)
  
  isTyping.value = true
  
  try {
    const result = await chatAPI.send(userText)
    isTyping.value = false
    
    if (result.aiResponse) {
      addMessage(result.aiResponse, false)
      
      const aiWords = result.aiResponse.toLowerCase().split(/\s+/)
      aiWords.forEach(word => {
        if (word.length >= 3) {
          vocabStore.updateWordStats('chat', word, 'listening', true)
          vocabStore.addTrainingRecord('listening', word, true)
          sessionStats.value.listening++
        }
      })
    }
  } catch (error) {
    isTyping.value = false
    addMessage('抱歉，暂时无法回复，请稍后再试。', false)
  }
}

const processUserMessage = (text: string) => {
  const words = text.toLowerCase().split(/\s+/)
  
  words.forEach(word => {
    if (word.length >= 3) {
      sessionWords.value.push(word)
      vocabStore.updateWordStats('chat', word, 'speaking', true)
      vocabStore.addTrainingRecord('speaking', word, true)
      sessionStats.value.speaking++
    }
  })
  
  sessionWords.value = [...new Set(sessionWords.value)]
}

const startListening = () => {
  if (isListening.value) {
    isListening.value = false
    uni.showToast({ title: '已停止录音', icon: 'none' })
  } else {
    isListening.value = true
    uni.showToast({ title: '正在录音...', icon: 'none' })
    
    setTimeout(() => {
      isListening.value = false
      const voiceTexts = [
        'Hello, how are you?',
        'I like learning English',
        'This is a good app',
        'I want to practice speaking'
      ]
      const randomText = voiceTexts[Math.floor(Math.random() * voiceTexts.length)]
      inputText.value = randomText
      uni.showToast({ title: '识别完成', icon: 'none' })
    }, 3000)
  }
}

const loadInitialMessages = () => {
  addMessage('你好！我是你的AI学习助手。我们可以用英语聊天来练习口语和听力。', false)
}

onMounted(() => {
  loadInitialMessages()
  vocabStore.loadStats()
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
  padding: 30rpx;
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
  color: rgba(255, 255, 255, 0.8);
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
    
    .avatar {
      background: #667eea;
    }
    
    .message-content {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      
      .message-text {
        color: white;
      }
      
      .message-time {
        color: rgba(255, 255, 255, 0.7);
      }
    }
  }
  
  &.ai {
    .avatar {
      background: #4caf50;
    }
  }
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

.message-time {
  font-size: 22rpx;
  color: #999;
}

.typing-indicator {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: white;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
}

.typing-dots {
  display: flex;
  gap: 8rpx;
  margin-right: 15rpx;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  background: #667eea;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
  
  &:nth-child(1) { animation-delay: 0s; }
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
}

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.typing-text {
  font-size: 26rpx;
  color: #999;
}

.chat-input-bar {
  background: white;
  padding: 20rpx;
  display: flex;
  gap: 20rpx;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.input-container {
  flex: 1;
}

.chat-input {
  width: 100%;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 40rpx;
  padding: 0 30rpx;
  font-size: 30rpx;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.action-btn {
  width: 80rpx;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon {
  font-size: 36rpx;
}

.send-btn {
  height: 80rpx;
  padding: 0 40rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 500;
  
  &[disabled] {
    opacity: 0.5;
  }
}

.stats-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.stats-content {
  width: 600rpx;
  background: white;
  border-radius: 24rpx;
  padding: 30rpx;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.stats-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.close-btn {
  font-size: 36rpx;
  color: #999;
  padding: 10rpx;
}

.stats-grid {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.stat-card {
  flex: 1;
  background: #f8f9fa;
  border-radius: 16rpx;
  padding: 25rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-icon {
  font-size: 48rpx;
  margin-bottom: 10rpx;
}

.stat-value {
  font-size: 40rpx;
  font-weight: 600;
  color: #667eea;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
}

.session-words {
  border-top: 1rpx solid #f0f0f0;
  padding-top: 20rpx;
}

.section-title {
  font-size: 28rpx;
  color: #666;
  display: block;
  margin-bottom: 15rpx;
}

.word-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 15rpx;
}

.word-tag {
  background: #fff3e0;
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
  border: 1rpx solid #ffe0b2;
}

.word-tag text {
  font-size: 24rpx;
  color: #ff9800;
}
</style>
