<script setup lang="ts">
import type { getAccounts } from '@/api'

import { ZCard, ZMotionIcon } from '@codex-proxy/ui'
import { AlertTriangle, Gauge, ShieldCheck, Users } from '@lucide/vue'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatInteger } from '@/utils/format'

const props = defineProps<{
  summary: Awaited<ReturnType<typeof getAccounts>>['summary']
}>()

const { t } = useI18n({ useScope: 'global' })

const overviewItems = computed(() => [
  {
    label: t('accounts.overview.totalAccounts'),
    value: formatInteger(props.summary.total),
    caption: t('accounts.overview.accountPoolSize'),
    tone: 'neutral',
    icon: Users,
  },
  {
    label: t('accounts.overview.availableAccounts'),
    value: formatInteger(props.summary.normal),
    caption: t('accounts.overview.availableHelp'),
    tone: 'success',
    icon: ShieldCheck,
  },
  {
    label: t('accounts.overview.quotaLimited'),
    value: formatInteger(props.summary.quotaPaused + (props.summary.quotaExhausted ?? 0) + (props.summary.rateLimited ?? 0)),
    caption: t('accounts.overview.waitingForQuota'),
    tone: 'warning',
    icon: Gauge,
  },
  {
    label: t('accounts.overview.pending'),
    value: formatInteger((props.summary.disabled ?? 0) + (props.summary.error ?? 0)),
    caption: t('accounts.overview.disabledError'),
    tone: 'danger',
    icon: AlertTriangle,
  },
])

function overviewIconClass(tone: string) {
  if (tone === 'success') {
    return 'bg-z-green-container text-z-green-on-container'
  }
  if (tone === 'warning') {
    return 'bg-z-orange-container text-z-orange-on-container'
  }
  if (tone === 'danger') {
    return 'bg-z-error-container text-z-error-on-container'
  }
  return 'bg-z-blue-container text-z-blue-on-container'
}
</script>

<template>
  <div class="mt-3 grid shrink-0 grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
    <ZCard
      v-for="item in overviewItems"
      :key="item.label"
      as="article"
      padding="none"
      class="flex items-center gap-3 p-3 transition-colors"
    >
      <ZMotionIcon
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-z"
        :class="overviewIconClass(item.tone)"
      >
        <component :is="item.icon" class="size-4" />
      </ZMotionIcon>
      <div class="flex min-w-0 flex-1 flex-col justify-center">
        <span class="block truncate text-xs font-semibold text-z-text-secondary">
          {{ item.label }}
        </span>
        <strong class="my-0.5 block truncate font-mono text-[19px] leading-tight font-extrabold text-z-text">
          {{ item.value }}
        </strong>
        <span class="block truncate text-[11px] leading-none text-z-text-quaternary" :title="item.caption">
          {{ item.caption }}
        </span>
      </div>
    </ZCard>
  </div>
</template>
