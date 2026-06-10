
import { ref, computed, onMounted } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { VOCAB_STORE } from '@/stores/vocabulary'

type ChatMode = 'free' | 'challenge' | 'roleplay'
type UiMode = 'voice' | 'text'

interface Message {
  id: string
  text: string
  isUser: boolean
  timestamp: number
}

export default function ChatScreen() {
  const [messages, setMessages] = ref<Message[]>([])
  const [inputText, setInputText] = ref('')
  const [chatMode, setChatMode] = ref<ChatMode>('free')
  const [uiMode, setUiMode] = ref<UiMode>('voice')
  const [isBusy, setIsBusy] = ref(false)

  const currentBookName = computed(() => {
    return VOCAB_STORE.getCurrentBook?.name || 'KET'
  })

  const modeLabel = computed(() => {
    const labels: Record<ChatMode, string> = {
      free: '自由聊天',
      challenge: '词汇挑战',
      roleplay: '情景'
    }
    return labels[chatMode.value]
  })

  // Load history
  useFocusEffect(
    () => {
      // TODO: 加载历史消息
      console.log('Chat screen focused')
    }
  )

  const sendMessage = async () => {
    if (!inputText.value.trim()) return
    
    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputText.value,
      isUser: true,
      timestamp: Date.now()
    }
    
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsBusy(true)

    try {
      // TODO: 调用后端聊天 API
      const response = await fetch('http://127.0.0.1:3004/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: userMsg.text,
          bookCode: VOCAB_STORE.currentBook,
          mode: chatMode.value
        })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          text: data.aiResponse || '收到',
          isUser: false,
          timestamp: Date.now()
        }
        setMessages(prev => [...prev, aiMsg])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: '发送失败，请重试',
        isUser: false,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI陪聊</Text>
        <Text style={styles.subtitle}>{currentBookName.value} · {modeLabel.value}</Text>
        
        {/* Mode Tabs */}
        <View style={styles.modeTabs}>
          {['free', 'challenge', 'roleplay'].map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.modeTab,
                chatMode.value === m && styles.modeTabActive
              ]}
              onPress={() => setChatMode(m as ChatMode)}
            >
              <Text style={[styles.modeTabText, chatMode.value === m && {color: '#667eea'}]}>
                {m === 'free' ? '自由聊天' : m === 'challenge' ? '词汇挑战' : '情景'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* UI Mode Tabs */}
        <View style={styles.uiTabs}>
          <TouchableOpacity
            style={[styles.uiTab, uiMode.value === 'voice' && styles.uiTabActive]}
            onPress={() => setUiMode('voice')}
          >
            <Text style={[styles.uiTabText, uiMode.value === 'voice' && {color: '#667eea'}]}>语音对话</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.uiTab, uiMode.value === 'text' && styles.uiTabActive]}
            onPress={() => setUiMode('text')}
          >
            <Text style={[styles.uiTabText, uiMode.value === 'text' && {color: '#667eea'}]}>文字</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((msg) => (
          <View key={msg.id} style={[
            styles.messageItem,
            msg.isUser ? styles.userMessage : styles.aiMessage
          ]}>
            <View style={[
              styles.avatar,
              msg.isUser && styles.userAvatar
            ]}>
              <Text style={styles.avatarText}>{msg.isUser ? '我' : 'AI'}</Text>
            </View>
            <View style={[
              styles.messageContent,
              msg.isUser && styles.userMessageContent
            ]}>
              <Text style={[styles.messageText, msg.isUser && {color: '#fff'}]}>{msg.text}</Text>
              <Text style={[styles.messageTime, {fontSize: 12, color: '#999', marginTop: 4}]}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Input Area */}
      {uiMode.value === 'voice' ? (
        <View style={styles.voicePanel}>
          <View style={styles.micButton}>
            <Text style={styles.micIcon}>??</Text>
          </View>
          <Text style={styles.hint}>按住说话，松开发送给 AI</Text>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            value={inputText.value}
            onChangeText={setInputText}
            placeholder='输入消息...'
            multiline
            disabled={isBusy.value}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.value.trim() && styles.sendBtnDisabled
            ]}
            onPress={sendMessage}
            disabled={!inputText.value.trim() || isBusy.value}
          >
            <Text style={styles.sendBtnText}>发送</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#667eea',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  title: {
    fontSize: 36,
    fontWeight: '600',
    color: '#fff'
  },
  subtitle: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6
  },
  modeTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16
  },
  modeTab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  modeTabActive: {
    backgroundColor: '#fff'
  },
  modeTabText: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.75)'
  },
  uiTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16
  },
  uiTab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  uiTabActive: {
    backgroundColor: '#fff'
  },
  uiTabText: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.75)'
  },
  messages: {
    flex: 1
  },
  messagesContent: {
    padding: 20
  },
  messageItem: {
    flexDirection: 'row',
    marginBottom: 30
  },
  userMessage: {
    flexDirection: 'row-reverse'
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15
  },
  userAvatar: {
    backgroundColor: '#667eea'
  },
  messageContent: {
    maxWidth: '70%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 2rpx 8rpx rgba(0,0,0,0.08)'
  },
  userMessageContent: {
    backgroundColor: '#667eea'
  },
  messageText: {
    fontSize: 30,
    color: '#333',
    display: 'block',
    marginBottom: 10
  },
  messageTime: {
    fontSize: 22
  },
  voicePanel: {
    backgroundColor: '#fff',
    padding: 32,
    alignItems: 'center'
  },
  micButton: {
    width: 160,
    height: 160,
    borderRadius: 50,
    backgroundColor: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  micIcon: {
    fontSize: 64,
    color: '#fff'
  },
  hint: {
    fontSize: 24,
    color: '#999'
  },
  inputBar: {
    flexDirection: 'row',
    padding: 20,
    gap: 20
  },
  chatInput: {
    flex: 1,
    height: 80,
    backgroundColor: '#f5f5f5',
    borderRadius: 40,
    paddingHorizontal: 30,
    fontSize: 30
  },
  sendBtn: {
    height: 80,
    paddingHorizontal: 40,
    backgroundColor: '#667eea',
    borderRadius: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendBtnDisabled: {
    opacity: 0.5
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 28
  }
})

