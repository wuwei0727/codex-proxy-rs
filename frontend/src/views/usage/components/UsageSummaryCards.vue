<script setup lang="ts">
import type { getUsageRecordSummary, UsageRecordStatus } from '@/api'

import { ZCard, ZMotionIcon } from '@codex-proxy/ui'
import { Activity, CircleAlert, Database, FileText, Timer } from '@lucide/vue'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  summary: Omit<Awaited<ReturnType<typeof getUsageRecordSummary>>, 'analytics'> | null
  error?: string
  status?: UsageRecordStatus
}>()

const { t } = useI18n({ useScope: 'global' })

const averageLatency = computed(() => {
  const raw = props.summary?.averageLatencyMsValue
  const value = raw == null || !Number.isFinite(raw) || raw < 0
    ? 0
    : raw
  if (value < 1_000) {
    return {
      value: String(Math.round(value)),
      unit: 'ms',
    }
  }
  if (value < 60_000) {
    return {
      value: (value / 1_000).toFixed(2),
      unit: 's',
    }
  }
  if (value < 3_600_000) {
    return {
      value: (value / 60_000).toFixed(1),
      unit: 'min',
    }
  }
  return {
    value: (value / 3_600_000).toFixed(1),
    unit: 'h',
  }
})

const items = computed(() => [
  {
    key: 'requests',
    label: props.status === 'error'
      ? t('usage.failedRequests')
      : (props.status === 'all' ? t('usage.totalRequests') : t('usage.successfulRequest')),
    icon: props.status === 'error' ? CircleAlert : Activity,
    value: props.summary?.totalRequests,
    detail: t('usage.withinFilterRange'),
    tone: props.status === 'error'
      ? 'bg-z-error-container text-z-error-on-container'
      : 'bg-z-blue-container text-z-blue-on-container',
  },
  {
    key: 'tokens',
    label: t('usage.tokens.totalTokens'),
    icon: FileText,
    value: props.summary?.totalTokens,
    detail: t('usage.inputOutput', { inputTokens: props.summary?.inputTokens ?? '0', outputTokens: props.summary?.outputTokens ?? '0' }),
    tone: 'bg-z-green-container text-z-green-on-container',
  },
  {
    key: 'cached',
    label: t('usage.cachedTokens'),
    icon: Database,
    value: props.summary?.cachedInputTokens,
    detail: t('usage.cacheReadHit'),
    tone: 'bg-z-orange-container text-z-orange-on-container',
  },
  {
    key: 'latency',
    label: t('usage.averageTimeTaken'),
    icon: Timer,
    value: averageLatency.value.value,
    unit: averageLatency.value.unit,
    detail: t('usage.successfulRequestAverage'),
    tone: 'bg-z-cyan-container text-z-cyan-on-container',
  },
])
</script>

<template>
  <section class="grid shrink-0 grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4" :aria-label="t('usage.usageOverview')">
    <ZCard
      v-for="item in items"
      :key="item.key"
      as="article"
      padding="none"
      class="flex items-center gap-3 p-3 transition-colors"
    >
      <ZMotionIcon class="inline-flex size-8 shrink-0 items-center justify-center rounded-z" :class="item.tone">
        <component :is="item.icon" class="size-4" />
      </ZMotionIcon>
      <div class="flex min-w-0 flex-1 flex-col justify-center">
        <span class="block truncate text-xs font-semibold text-z-text-secondary">
          {{ item.label }}
        </span>
        <strong class="my-0.5 block truncate font-mono text-[19px] leading-tight font-extrabold text-z-text">
          {{ item.value ?? '0' }}<span v-if="item.unit" class="ml-0.5 font-sans text-xs font-semibold text-z-text-secondary">{{ item.unit }}</span>
        </strong>
        <span class="block truncate text-[11px] leading-none text-z-text-quaternary" :title="error || item.detail">
          {{ error || item.detail }}
        </span>
      </div>
    </ZCard>
  </section>
</template>
