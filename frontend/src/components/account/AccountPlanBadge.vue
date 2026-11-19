<script setup lang="ts">
import type { AccountUpstream } from '@/api'
import { computed } from 'vue'

import { stableVisualIndex } from '@/utils/color'
import AccountUpstreamBadge from './AccountUpstreamBadge.vue'

const props = withDefaults(
  defineProps<{
    planType?: string | null
    authenticationKind?: string
    upstream?: AccountUpstream | null
    upstreamPeer?: boolean | null
    planTypeDisplay: string
    count?: number
    size?: 'xs' | 'sm' | 'md'
  }>(),
  {
    planType: null,
    size: 'md',
  },
)

const planPalettes: Record<string, string> = {
  'api': 'bg-z-cyan-container-strong text-z-cyan-on-container',
  'free': 'bg-z-cyan-container text-z-cyan-on-container',
  'plus': 'bg-z-blue-container-strong text-z-blue-on-container',
  'pro': 'bg-z-purple-container-strong text-z-purple-on-container',
  'pro_20x': 'bg-z-purple-container-strong text-z-purple-on-container',
  'pro20x': 'bg-z-purple-container-strong text-z-purple-on-container',
  '20x': 'bg-z-purple-container-strong text-z-purple-on-container',
  'prolite': 'bg-z-purple-container text-z-purple-on-container',
  'pro_5x': 'bg-z-purple-container text-z-purple-on-container',
  'promax': 'bg-z-purple-container-strong text-z-purple-on-container ring-1 ring-z-purple-border/50',
  'pro_10x': 'bg-z-purple-container-strong text-z-purple-on-container ring-1 ring-z-purple-border/50',
  'self_serve_business_prolite': 'bg-z-purple-container text-z-purple-on-container',
  'business_5x': 'bg-z-purple-container text-z-purple-on-container',
}

const PLAN_DISPLAY_ALIASES: Record<string, string> = {
  'pro': 'Pro 200',
  'pro_20x': 'Pro 200',
  'pro-20x': 'Pro 200',
  'pro20x': 'Pro 200',
  '20x': 'Pro 200',
  'prolite': 'Pro 100',
  'pro_lite': 'Pro 100',
  'pro-lite': 'Pro 100',
  'pro_5x': 'Pro 100',
  'promax': 'Pro 500',
  'pro_max': 'Pro 500',
  'pro-max': 'Pro 500',
  'pro_10x': 'Pro 10x',
  'self_serve_business_prolite': 'Business 5x',
  'business': '企业',
  'ent26': '企业',
  'enterprise': '企业',
  'hc': '企业',
  'enterprise_cbp_usage_based': '企业',
  'enterprise_cbp_automation': '自动化',
  'enterprise_(automation)': '自动化',
  'sci': '科研',
  'academic_researchers': '科研',
  'sci_plus': '科研 Plus',
  'academic_researchers_plus': '科研 Plus',
}

const fallbackPalettes = [
  'bg-z-blue-container text-z-blue-on-container',
  'bg-z-green-container text-z-green-on-container',
  'bg-z-cyan-container text-z-cyan-on-container',
  'bg-z-orange-container text-z-orange-on-container',
] as const

const rawPlanType = computed(() => props.authenticationKind === 'api_key'
  ? 'api'
  : props.planType?.trim() || props.planTypeDisplay?.trim() || '')

const displayText = computed(() => {
  if (props.authenticationKind === 'api_key')
    return 'API'

  const normalizedKey = (props.planType || props.planTypeDisplay || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (PLAN_DISPLAY_ALIASES[normalizedKey])
    return PLAN_DISPLAY_ALIASES[normalizedKey]

  return props.planTypeDisplay || props.planType || ''
})

const tooltipText = computed(() => {
  if (!displayText.value)
    return undefined
  const proPrice = /^Pro (100|200|500)$/.exec(displayText.value)?.[1]
  if (proPrice) {
    const rawPlan = props.planType
      ? ` (${props.planType})`
      : ''
    return `${displayText.value} · 官方月费档位：${proPrice} 美元/月${rawPlan}`
  }
  if (props.planType && props.planType.toLowerCase() !== displayText.value.toLowerCase())
    return `${displayText.value} (${props.planType})`
  return displayText.value
})

const sizeClass = computed(() => {
  if (props.size === 'xs')
    return 'h-4.5 rounded-full px-1.5 text-[10px] font-bold'
  return props.size === 'sm'
    ? 'h-5 rounded-full px-1.75 text-z-xs font-bold'
    : 'h-5.5 rounded-full px-2 text-z-xs font-heavy'
})

const paletteClass = computed(() => {
  const key = rawPlanType.value.toLowerCase().replace(/[\s-]+/g, '_')
  const planPalette = planPalettes[key]
  if (planPalette)
    return planPalette

  return fallbackPalettes[stableVisualIndex(key, fallbackPalettes.length)]
})
</script>

<template>
  <AccountUpstreamBadge v-if="upstreamPeer || upstream?.discovered" :size="size" />
  <span
    v-else
    class="inline-flex min-w-0 max-w-full items-center justify-center gap-1 whitespace-nowrap leading-none shadow-z-tertiary"
    :class="[sizeClass, paletteClass]"
    :title="tooltipText"
  >
    <span class="truncate">{{ displayText }}</span>
    <span v-if="count !== undefined" class="shrink-0 tabular-nums">{{ count }}</span>
  </span>
</template>
