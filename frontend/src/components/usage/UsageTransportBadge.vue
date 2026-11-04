<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  usageTransportFullLabel,
  usageTransportTextColorClass,
  usageTransportType,
  usageTransportTypeClass,
} from './shared/presenter'

const props = defineProps<{
  /** 兼容单值模式 */
  transport?: string | null
  joined?: boolean
  /** 客户端接入传输协议 */
  clientTransport?: string | null
  /** 上游转发传输协议 */
  upstreamTransport?: string | null
}>()

const { t } = useI18n({ useScope: 'global' })

const client = computed(() => props.clientTransport?.trim() || null)
const upstream = computed(() => props.upstreamTransport?.trim() || null)
const single = computed(() => props.transport?.trim() || null)

// 当 clientTransport 与 upstreamTransport 均未显式传入时，回退到 legacy 单值
const isDualMode = computed(() => client.value !== null || upstream.value !== null)

const clientType = computed(() => usageTransportType(client.value))
const upstreamType = computed(() => usageTransportType(upstream.value))
const singleType = computed(() => usageTransportType(single.value))

// 当接入与上游相同，或仅一侧有值时，显示单徽章
const isSame = computed(() => {
  if (!isDualMode.value)
    return true
  if (client.value && upstream.value)
    return clientType.value === upstreamType.value
  return true
})

// 单徽章模式下展示的文字与类型
const displayType = computed(() => {
  if (!isDualMode.value)
    return singleType.value
  if (client.value)
    return clientType.value
  if (upstream.value)
    return upstreamType.value
  return '—'
})

// 单徽章的样式类型
const displayTransport = computed(() => {
  if (!isDualMode.value)
    return single.value
  return client.value || upstream.value || null
})

// 悬浮完整提示文案
const tooltip = computed(() => {
  if (!isDualMode.value) {
    return single.value ? usageTransportFullLabel(single.value) : undefined
  }
  const clientLabel = usageTransportFullLabel(client.value)
  const upstreamLabel = usageTransportFullLabel(upstream.value)

  if (client.value && upstream.value) {
    if (clientType.value === upstreamType.value) {
      return `${t('usage.fields.access')}: ${clientLabel} · ${t('usage.fields.upstream')}: ${upstreamLabel}`
    }
    return `${t('usage.fields.access')}: ${clientLabel} → ${t('usage.fields.upstream')}: ${upstreamLabel}`
  }
  if (client.value) {
    return `${t('usage.fields.access')}: ${clientLabel}`
  }
  if (upstream.value) {
    return `${t('usage.fields.upstream')}: ${upstreamLabel}`
  }
  return undefined
})
</script>

<template>
  <!-- 协议一致或单侧：精简统一为 h-5 紧凑圆角胶囊 -->
  <span
    v-if="isSame"
    class="inline-flex h-5 min-w-8.5 items-center justify-center px-1.75 font-mono text-[11px] font-bold leading-none select-none"
    :class="[usageTransportTypeClass(displayTransport), { 'rounded-full': !joined }]"
    :title="tooltip"
  >
    {{ displayType }}
  </span>

  <!-- 协议桥接/转换：方案 A 一体化微胶囊（零空白缝隙、字流紧凑排列） -->
  <div
    v-else
    class="inline-flex h-5 items-center rounded-full bg-z-fill-secondary/90 px-1.75 font-mono text-[10.5px] leading-none select-none ring-1 ring-black/5 dark:ring-white/10"
    :title="tooltip"
  >
    <span :class="usageTransportTextColorClass(client)">{{ clientType }}</span>
    <span class="mx-0.5 text-[9px] font-normal text-z-text-quaternary select-none">›</span>
    <span :class="usageTransportTextColorClass(upstream)">{{ upstreamType }}</span>
  </div>
</template>
