<template>
  <svg class="rail-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'home'">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </template>
    <template v-else-if="name === 'keyboard'">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M12 10h.01M17 10h.01M7 14h10" />
    </template>
    <template v-else-if="name === 'atlas'">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8 15 2.5-3 2 2L16 10" />
    </template>
    <template v-else-if="name === 'chart'">
      <path d="M5 19V10M12 19V5M19 19v-7" />
    </template>
    <template v-else-if="name === 'book'">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" />
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3" />
    </template>
    <template v-else-if="name === 'courses'">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </template>
    <template v-else-if="name === 'layers'">
      <path d="m12 4 8 4-8 4-8-4 8-4z" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
    </template>
    <template v-else-if="name === 'chat'">
      <path d="M6 17 4 20V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2z" />
    </template>
    <template v-else-if="name === 'quiz'">
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" />
      <path d="M12 17h.01" />
    </template>
    <template v-else-if="name === 'crown'">
      <path d="m4 16 2-9 6 5 6-5 2 9z" />
      <path d="M5 19h14" />
    </template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="9" r="3" />
      <path d="M4 19c.6-2.4 2.4-4 5-4s4.4 1.6 5 4" />
      <circle cx="17" cy="10" r="2" />
      <path d="M16 19c.3-1.4 1.2-2.6 2.5-3.2" />
    </template>
    <template v-else-if="name === 'gear'">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 7.2l1.9 1.1M17.3 15.7l1.9 1.1M4.8 16.8l1.9-1.1M17.3 8.3l1.9-1.1" />
    </template>
    <template v-else-if="name === 'listen'">
      <path d="M5 13a7 7 0 0 1 14 0" />
      <path d="M6 16v1a2 2 0 0 0 2 2h1v-5H8a2 2 0 0 0-2 2zM18 16v1a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z" />
    </template>
    <template v-else-if="name === 'read'">
      <path d="M3 6.5 12 4l9 2.5V19L12 16.5 3 19z" />
      <path d="M12 4v12.5" />
    </template>
    <template v-else-if="name === 'spell'">
      <path d="M4 20 12 4l8 16" />
      <path d="M7 14h10" />
    </template>
    <template v-else-if="name === 'speak'">
      <path d="M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" />
      <path d="M7 11a5 5 0 0 0 10 0M12 16v3" />
    </template>
    <template v-else-if="name === 'library'">
      <path d="M5 4h4v16H5zM10 4h4v16h-4zM15 4h4v16h-4" />
    </template>
    <template v-else-if="name === 'points'">
      <circle cx="7" cy="7" r="2.2" />
      <circle cx="17" cy="8" r="2.2" />
      <circle cx="12" cy="17" r="2.2" />
      <path d="m8.8 8.4 6.2 1.2M8.4 8.6 11 15.2M15.6 9.6 13 15.2" />
    </template>
    <template v-else-if="name === 'materials'">
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4M9 13h6M9 17h6" />
    </template>
    <template v-else-if="name === 'coverage'">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a12 12 0 0 1 0 16 12 12 0 0 1 0-16zM4 12h16" />
    </template>
    <template v-else-if="name === 'mine'">
      <circle cx="12" cy="9" r="3" />
      <path d="M6 19c1-2.8 3-4 6-4s5 1.2 6 4" />
    </template>
    <template v-else-if="name === 'pin'">
      <path d="m9 4 6 6-2 1-4 6-1-1 2-4-3-1z" />
      <path d="m8 16-3 3" />
    </template>
    <template v-else-if="name === 'theme'">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
      <path d="M12 4a8 8 0 0 1 0 16" fill="currentColor" opacity="0.22" stroke="none" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<style scoped>
.rail-ico {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}
</style>
