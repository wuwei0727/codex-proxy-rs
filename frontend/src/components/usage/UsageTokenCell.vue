<script setup lang="ts">
import type { UsageListRecord } from '@/api'

import { Archive, ArrowDown, ArrowUp } from '@lucide/vue'

import { computed } from 'vue'

import { useI18n } from 'vue-i18n'
import { usageTokenDetails } from '@/components/usage/shared/presenter'
import UsageDetailPopover from '@/components/usage/UsageDetailPopover.vue'

const props = defineProps<{
  record: Pick<UsageListRecord, 'tokenDetails'>
}>()

const { t } = useI18n({ useScope: 'global' })

const tokenDetails = computed(() => usageTokenDetails(props.record.tokenDetails))

const hasCache = computed(() => {
  const cached = props.record.tokenDetails?.cachedInputTokens
  return typeof cached === 'number' && cached > 0
})

const tokenItems = computed(() => [
  {
    label: t('usage.tokens.enterToken'),
    value: tokenDetails.value.inputTokensDisplay,
  },
  {
    label: t('usage.tokens.outputToken'),
    value: tokenDetails.value.outputTokensDisplay,
  },
  {
    label: t('usage.tokens.cacheReadTokens'),
    value: tokenDetails.value.cachedInputTokensDisplay,
  },
  {
    label: t('usage.tokens.cacheWriteTokens'),
    value: tokenDetails.value.cacheWriteInputTokensDisplay,
  },
  {
    label: t('usage.tokens.reasoningToken'),
    value: tokenDetails.value.reasoningOutputTokensDisplay,
  },
])
</script>

<template>
  <div class="flex max-w-full min-w-0 items-center justify-end gap-1 overflow-hidden">
    <div class="flex flex-col items-end min-w-0 leading-none">
      <!-- 第一行：总 Token -->
      <span class="font-mono text-[12px] leading-tight font-heavy tabular-nums text-z-text">
        {{ tokenDetails.totalTokensDisplay || '—' }}
      </span>

      <!-- 第二行：输入 ↓ · 输出 ↑ -->
      <div class="mt-0.5 flex items-center justify-end gap-1.5 font-mono text-[10.5px] leading-tight tabular-nums whitespace-nowrap">
        <span class="inline-flex items-center gap-0.5 text-z-success-text font-bold" :title="t('usage.tokens.enterToken')">
          <ArrowDown class="size-2.5" stroke-width="2.5" />
          {{ tokenDetails.inputTokensDisplay }}
        </span>
        <span class="inline-flex items-center gap-0.5 text-z-info-text font-bold" :title="t('usage.tokens.outputToken')">
          <ArrowUp class="size-2.5" stroke-width="2.5" />
          {{ tokenDetails.outputTokensDisplay }}
        </span>
      </div>

      <!-- 第三行：缓存 🗃（专属紫色 text-z-purple-text） -->
      <div
        v-if="hasCache"
        class="mt-0.5 flex items-center justify-end font-mono text-[10px] leading-tight tabular-nums whitespace-nowrap text-z-purple-text font-bold"
        :title="t('usage.tokens.cacheReadTokens')"
      >
        <span class="inline-flex items-center gap-0.5">
          <Archive class="size-2.5" stroke-width="2.5" />
          {{ tokenDetails.cachedInputTokensDisplay }}
        </span>
      </div>
    </div>

    <!-- 详情弹窗触发图标 (i) -->
    <UsageDetailPopover :title="t('usage.tokens.tokenDetails')" :trigger-label="t('usage.tokens.viewTokenDetails')">
      <div class="grid gap-1.5 text-z-text-secondary">
        <div v-for="item in tokenItems" :key="item.label" class="flex justify-between gap-4">
          <span class="whitespace-nowrap">{{ item.label }}</span>
          <span class="whitespace-nowrap font-mono font-heavy text-z-text">
            {{ item.value }}
          </span>
        </div>
      </div>
      <div class="mt-1 flex justify-between border-t border-z-split pt-2">
        <span class="whitespace-nowrap text-z-text-secondary">{{ t('usage.tokens.totalTokens') }}</span>
        <span class="whitespace-nowrap font-mono font-heavy text-z-info-text">
          {{ tokenDetails.totalTokensDisplay }}
        </span>
      </div>
    </UsageDetailPopover>
  </div>
</template>
