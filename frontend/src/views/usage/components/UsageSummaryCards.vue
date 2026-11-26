<script setup lang="ts">
import type { getUsageRecordSummary, UsageRecordStatus } from '@/api'

import { ZCard, ZMotionIcon } from '@codex-proxy/ui'
import { Activity, ArrowDownToLine, ArrowUpFromLine, CircleAlert, CircleDollarSign, Database, FileText, Timer } from '@lucide/vue'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCompactNumber, formatUsd } from '@/utils/format'

const props = defineProps<{
  summary: Omit<Awaited<ReturnType<typeof getUsageRecordSummary>>, 'analytics'> | null
  estimatedCost?: string | null
  error?: string
  status?: UsageRecordStatus
}>()

const { t } = useI18n({ useScope: 'global' })

function formatPercent(part: number, total: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0)
    return '0%'
  const ratio = (part / total) * 100
  if (ratio <= 0)
    return '0%'
  if (ratio >= 99.95)
    return '100%'
  return `${ratio.toFixed(1)}%`
}

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

const metrics = computed(() => props.summary?.logicalRequests)

const items = computed(() => {
  const logical = metrics.value
  const reqCount = logical?.requestCount ?? 0
  const successCount = logical?.successCount ?? 0
  const failureCount = logical?.failureCount ?? 0
  const inputRaw = logical?.inputTokens ?? 0
  const outputRaw = logical?.outputTokens ?? 0
  const cachedRaw = logical?.cachedInputTokens ?? 0
  const reasoningRaw = logical?.reasoningOutputTokens ?? 0
  const totalRaw = logical?.totalTokens ?? 0

  return [
    {
      key: 'requests',
      label: props.status === 'error'
        ? t('usage.failedRequests')
        : (props.status === 'all'
            ? t('usage.summary.totalRequests')
            : t('usage.successfulRequest')),
      icon: Activity,
      value: props.summary?.totalRequests ?? '0',
      detail: reqCount > 0 && props.status !== 'error'
        ? t('usage.summary.successRate', {
            rate: formatPercent(successCount, reqCount),
          })
        : t('usage.withinFilterRange'),
      tone: 'bg-z-blue-container text-z-blue-on-container',
    },
    {
      key: 'failed',
      label: t('usage.summary.failed'),
      icon: CircleAlert,
      value: formatCompactNumber(failureCount),
      valueClass: failureCount > 0
        ? 'text-z-error-on-container'
        : undefined,
      detail: reqCount > 0
        ? t('usage.summary.failureRate', {
            rate: formatPercent(failureCount, reqCount),
          })
        : t('usage.withinFilterRange'),
      tone: 'bg-z-error-container text-z-error-on-container',
    },
    {
      key: 'cost',
      label: t('usage.summary.cost'),
      icon: CircleDollarSign,
      value: formatUsd(props.estimatedCost),
      detail: t('usage.summary.estimatedCost'),
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
    {
      key: 'tokens',
      label: t('usage.tokens.totalTokens'),
      icon: FileText,
      value: props.summary?.totalTokens ?? '0',
      detail: reasoningRaw > 0
        ? t('usage.summary.reasoningTokens', {
            count: formatCompactNumber(reasoningRaw),
          })
        : t('usage.inputOutput', { inputTokens: props.summary?.inputTokens ?? '0', outputTokens: props.summary?.outputTokens ?? '0' }),
      tone: 'bg-z-purple-container text-z-purple-on-container',
    },
    {
      key: 'input',
      label: t('usage.summary.input'),
      icon: ArrowDownToLine,
      value: props.summary?.inputTokens ?? '0',
      detail: t('usage.summary.shareRate', {
        rate: formatPercent(inputRaw, totalRaw),
      }),
      tone: 'bg-z-blue-container text-z-blue-on-container',
    },
    {
      key: 'output',
      label: t('usage.summary.output'),
      icon: ArrowUpFromLine,
      value: props.summary?.outputTokens ?? '0',
      detail: t('usage.summary.shareRate', {
        rate: formatPercent(outputRaw, totalRaw),
      }),
      tone: 'bg-z-purple-container text-z-purple-on-container',
    },
    {
      key: 'cached',
      label: t('usage.summary.cache'),
      icon: Database,
      value: props.summary?.cachedInputTokens ?? '0',
      detail: t('usage.summary.hitRate', {
        rate: formatPercent(cachedRaw, inputRaw),
      }),
      tone: 'bg-z-green-container text-z-green-on-container',
    },
  ]
})
</script>

<template>
  <section class="grid shrink-0 grid-cols-2 gap-2.5 md:grid-cols-4 2xl:grid-cols-8" :aria-label="t('usage.usageOverview')">
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
        <strong class="my-0.5 block truncate font-mono text-[19px] leading-tight font-extrabold" :class="item.valueClass ?? 'text-z-text'">
          {{ item.value ?? '0' }}<span v-if="item.unit" class="ml-0.5 font-sans text-xs font-semibold text-z-text-secondary">{{ item.unit }}</span>
        </strong>
        <span class="block truncate text-[11px] leading-none text-z-text-quaternary" :title="error || item.detail">
          {{ error || item.detail }}
        </span>
      </div>
    </ZCard>
  </section>
</template>
