<template>
  <!-- Space slot: wrong=red, correct=green, wait=slate (masked placeholder) -->
  <span v-if="isWrong" class="word-space wrong" />
  <span v-else-if="isCorrect" class="word-space correct" />
  <span v-else class="word-space wait" :class="[isWait ? 'show' : 'hide', isShake ? 'shake' : '']" />
</template>

<script setup lang="ts">
defineProps<{
  isWrong?: boolean
  isCorrect?: boolean
  isWait?: boolean
  isShake?: boolean
}>()
</script>

<style scoped lang="scss">
.word-space {
  position: relative;
  display: inline-block;
  width: 0.6rem;
  height: 1.5rem;
  box-sizing: border-box;
  margin: 0 1px;
  border-bottom: 2px solid transparent;
  vertical-align: baseline;
}

.word-space.wrong {
  border-bottom: 2px solid red;
}

.word-space.correct {
  border-bottom: 2px solid rgb(22, 163, 74);
  margin-left: 0.125rem;
  margin-right: 0.125rem;

  &::after,
  &::before {
    content: '';
    position: absolute;
    width: 2px;
    height: 0.25rem;
    background: rgb(22, 163, 74);
    bottom: 0;
  }

  &::after {
    right: 0;
  }

  &::before {
    left: 0;
  }
}

.word-space.wait {
  border-bottom: 2px solid #94a3b8;
  margin-left: 0.125rem;
  margin-right: 0.125rem;

  &::after,
  &::before {
    content: '';
    position: absolute;
    width: 2px;
    height: 0.25rem;
    background: #94a3b8;
    bottom: 0;
  }

  &::after {
    right: 0;
  }

  &::before {
    left: 0;
  }
}

.word-space.wait.hide {
  opacity: 0;
}

.word-space.wait.show {
  opacity: 1;
}

.word-space.wait.shake {
  border-bottom-color: red !important;
  animation: space-shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;

  &::after,
  &::before {
    background: red !important;
  }
}

@keyframes space-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}
</style>