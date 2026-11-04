<script setup lang="ts">
import { computed } from 'vue'
import { usageClientIp } from './shared/presenter'

const props = defineProps<{
  record: { clientIp?: string | null }
}>()

const clientIp = computed(() => usageClientIp(props.record))
</script>

<template>
  <span
    class="inline-flex h-5.5 max-w-full items-center rounded-full bg-z-blue-container px-2 font-mono text-[11px] leading-none font-bold text-z-blue-on-container"
    :title="clientIp"
  >
    <span class="min-w-0 truncate">
      {{ clientIp }}
    </span>
  </span>
</template>
