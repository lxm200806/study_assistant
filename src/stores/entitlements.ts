import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { entitlementsAPI, type EntitlementsSnapshot } from '@/api/entitlements'

export const useEntitlementsStore = defineStore('entitlements', () => {
  const snapshot = ref<EntitlementsSnapshot | null>(null)
  const loading = ref(false)
  let inflight: Promise<void> | null = null

  const permissions = computed(() => snapshot.value?.permissions || {})
  const subscriptions = computed(() => snapshot.value?.subscriptions || [])
  const credits = computed(() => snapshot.value?.credits?.balance || 0)
  const isAdmin = computed(() => snapshot.value?.isAdmin || false)

  function has(key: string): boolean {
    if (isAdmin.value) return true
    return permissions.value[key]?.active === true
  }

  function remaining(key: string): number | null {
    return permissions.value[key]?.remaining ?? null
  }

  function limit(key: string): number | null {
    return permissions.value[key]?.limitValue ?? null
  }

  function reset(): void {
    snapshot.value = null
    inflight = null
    loading.value = false
  }

  async function load(force = false): Promise<void> {
    if (!force && snapshot.value) return
    if (inflight) return inflight
    loading.value = true
    inflight = entitlementsAPI
      .get()
      .then(result => {
        if (result?.data) snapshot.value = result.data
      })
      .catch(() => {
        // 权限接口失败不应阻塞登录/页面，保留上一份快照
      })
      .finally(() => {
        loading.value = false
        inflight = null
      })
    return inflight
  }

  function apply(data: EntitlementsSnapshot): void {
    snapshot.value = data
  }

  return {
    snapshot,
    loading,
    permissions,
    subscriptions,
    credits,
    isAdmin,
    has,
    remaining,
    limit,
    load,
    apply,
    reset
  }
})
