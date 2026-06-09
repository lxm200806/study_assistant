import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { colors, spacing } from '@/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
          paddingBottom: spacing.xs,
          paddingTop: spacing.xs,
          height: 64,
        }
      }}
    >
      <Tabs.Screen name="home" options={{
        title: '首页',
        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />
      }} />
      <Tabs.Screen name="vocabulary" options={{
        title: '词汇',
        tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} />
      }} />
      <Tabs.Screen name="recognition" options={{
        title: '认读',
        tabBarIcon: ({ color, size }) => <Ionicons name="eye-outline" color={color} size={size} />
      }} />
      <Tabs.Screen name="chat" options={{
        title: 'AI陪聊',
        tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
      }} />
      <Tabs.Screen name="mine" options={{
        title: '我的',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />
      }} />
    </Tabs>
  )
}
