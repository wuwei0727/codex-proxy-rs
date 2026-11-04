<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value?: string | null
}>()

const currentYear = new Date().getFullYear().toString()

const parsedTime = computed(() => {
  const raw = props.value?.trim()
  if (!raw) {
    return { time: '', date: '', full: '—' }
  }

  // 支持 "2026-11-03 15:17:38" 或 "2026-11-03T15:17:38"
  const parts = raw.split(/[ T]/)
  if (parts.length >= 2) {
    const rawDate = parts[0]
    const rawTime = parts[1].split('.')[0]

    // 若当年，月日精简为 MM-DD；跨年则保留完整 YYYY-MM-DD
    const dateDisplay = rawDate.startsWith(`${currentYear}-`)
      ? rawDate.slice(currentYear.length + 1)
      : rawDate

    return {
      time: rawTime,
      date: dateDisplay,
      full: raw,
    }
  }

  return {
    time: raw,
    date: '',
    full: raw,
  }
})
</script>

<template>
  <div v-if="parsedTime.time" class="min-w-0 text-center" :title="parsedTime.full">
    <!-- 主显：秒级时分秒（高亮突出，清晰易读） -->
    <span class="block truncate font-mono text-z-sm leading-none font-bold text-z-text tabular-nums tracking-tight">
      {{ parsedTime.time }}
    </span>
    <!-- 次显：月-日（柔和弱化，节约空间） -->
    <span
      v-if="parsedTime.date"
      class="mt-1 block truncate font-mono text-[10.5px] leading-none font-medium text-z-text-quaternary tabular-nums tracking-tight"
    >
      {{ parsedTime.date }}
    </span>
  </div>
  <span v-else class="text-z-text-quaternary">—</span>
</template>
