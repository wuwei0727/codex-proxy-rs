<script setup lang="ts">
import type { UsagePerformanceRecord } from './shared/presenter'

import { computed } from 'vue'

import { usagePerformanceDetails } from './shared/presenter'

const props = defineProps<{
  record: UsagePerformanceRecord
}>()

const performance = computed(() => usagePerformanceDetails(props.record))
</script>

<template>
  <div class="flex items-center justify-end whitespace-nowrap font-mono text-z-sm leading-none font-heavy tabular-nums">
    <span class="text-z-text">{{ performance.throughputDisplay }}</span>
  </div>
</template>
