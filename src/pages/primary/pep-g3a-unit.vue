<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

onLoad((query) => {
  const id = encodeURIComponent(String(query?.id || query?.unit || 'u1'))
  uni.redirectTo({ url: `/pages/primary/unit?code=pep-g3a-2024&id=${id}` })
})
</script>

<template>
  <view />
</template>
