import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getMembershipInfo } from '@/api/client'
import { colors, spacing } from '@/theme'

interface MembershipPlan { id: string; name: string; price: string; duration: string; features: string[] }

export default function MembershipScreen() {
  const [isPremium, setIsPremium] = useState(false)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMembershipInfo().then(r => {
      if (r.data) {
        setIsPremium(r.data.isPremium || false)
        setPlans(r.data.plans || [])
      } else {
        // Default plans for demo
        setPlans([
          { id: 'monthly', name: '月度会员', price: '¥29/月', duration: '30天', features: ['全部词汇书', 'AI 陪聊无限次', '所有训练模式', '发音评估'] },
          { id: 'yearly', name: '年度会员', price: '¥199/年', duration: '365天', features: ['全部词汇书', 'AI 陪聊无限次', '所有训练模式', '发音评估', '学习分析报告'], popular: true },
          { id: 'lifetime', name: '终身会员', price: '¥499', duration: '永久', features: ['全部词汇书', 'AI 陪聊无限次', '所有训练模式', '发音评估', '学习分析报告', '优先客服'] },
        ])
      }
    }).catch(() => {
      setPlans([
        { id: 'monthly', name: '月度会员', price: '¥29/月', duration: '30天', features: ['全部词汇书', 'AI 陪聊无限次', '所有训练模式', '发音评估'] },
        { id: 'yearly', name: '年度会员', price: '¥199/年', duration: '365天', features: ['全部词汇书', 'AI 陪聊无限次', '所有训练模式', '发音评估', '学习分析报告'], popular: true },
        { id: 'lifetime', name: '终身会员', price: '¥499', duration: '永久', features: ['全部词汇书', 'AI 陪聊无限次', '所有训练模式', '发音评估', '学习分析报告', '优先客服'] },
      ])
    }).finally(() => setLoading(false))
  }, [])

  const handleSubscribe = (planId: string) => {
    if (!isPremium) Alert.alert('功能开发中', `选择 ${plans.find(p => p.id === planId)?.name} 计划\n支付功能即将上线`)
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>开通会员</Text>
      <Text style={styles.subtitle">解锁全部学习功能</Text>

      {isPremium ? (
        <View style={styles.premiumBanner}>
          <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>👑</Text>
          <Text style={styles.premiumTitle}>您是尊贵会员</Text>
          <Text style={styles.premiumSub">已解锁全部功能</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ alignItems: 'center', padding: spacing.xxl }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : plans.length > 0 ? (
        <View style={styles.plansList}>
          {plans.map(plan => (
            <View key={plan.id} style={[styles.planCard, plan.popular && styles.planPopular]}>
              {plan.popular && <Text style={styles.popularBadge}>推荐</Text>}
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <View style={styles.featuresList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureItem}>
                    <Text style={{ color: colors.accent }}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Pressable onPress={() => handleSubscribe(plan.id)}
                style={[styles.subscribeBtn, plan.popular ? styles.subscribeBtnPrimary : styles.subscribeBtnSecondary]}>
                <Text style={styles.subscribeBtnText}>{plan.popular ? '立即开通' : '选择此方案'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48, marginBottom: spacing.md }}>📋</Text>
          <Text style={styles.emptyText}>暂无可用计划</Text>
        </View>
      )}

      <View style={styles.guaranteeCard}>
        <Text style={styles.guaranteeTitle}>💰 7天无理由退款</Text>
        <Text style={styles.guaranteeSub">开通后7天内，如不满意可申请全额退款</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingTop: 64, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.xxl },
  premiumBanner: { backgroundColor: '#fff8e1', borderRadius: 16, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  premiumTitle: { fontSize: 20, fontWeight: '700', color: '#92400e' },
  premiumSub: { fontSize: 14, color: '#b45309', marginTop: spacing.xs },
  plansList: { gap: spacing.md },
  planCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, borderWidth: 2, borderColor: colors.line, position: 'relative' },
  planPopular: { borderColor: colors.primary, borderWidth: 2 },
  popularBadge: { position: 'absolute', top: -10, right: spacing.md, backgroundColor: colors.primary, color: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 8, fontSize: 12, fontWeight: '700' },
  planName: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  planPrice: { fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: spacing.md },
  featuresList: { gap: spacing.sm, marginBottom: spacing.lg },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  featureText: { fontSize: 14, color: '#666' },
  subscribeBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  subscribeBtnPrimary: { backgroundColor: colors.primary },
  subscribeBtnSecondary: { backgroundColor: '#eef2ff' },
  subscribeBtnText: { color: colors.surface, fontSize: 17, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 16, color: colors.muted },
  guaranteeCard: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: '#f0fdf4', borderRadius: 12 },
  guaranteeTitle: { fontSize: 17, fontWeight: '600', color: '#15803d' },
  guaranteeSub: { fontSize: 14, color: '#16a34a', marginTop: spacing.xs },
})
