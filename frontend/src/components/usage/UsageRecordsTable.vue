<script setup lang="ts">
import type { TableColumn } from '@codex-proxy/ui'

import type { UsageListRecord } from '@/api'
import { ZTable } from '@codex-proxy/ui'

import { computed } from 'vue'
import { Copy } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useCopyText } from '@/composables/useCopyText'
import { useAccountDisplayMode } from '@/composables/useAccountDisplayMode'
import { maskAccountText } from '@/utils/mask'
import AccountPlanBadge from '@/components/account/AccountPlanBadge.vue'
import ProviderIconGroup from '@/components/ProviderIconGroup.vue'
import UsageBillingCell from '@/components/usage/UsageBillingCell.vue'
import UsageClientIpCell from '@/components/usage/UsageClientIpCell.vue'
import UsageErrorCell from '@/components/usage/UsageErrorCell.vue'
import UsageLatencyCell from '@/components/usage/UsageLatencyCell.vue'
import UsageModelCell from '@/components/usage/UsageModelCell.vue'
import UsagePerformanceCell from '@/components/usage/UsagePerformanceCell.vue'
import UsageReasoningEffortCell from '@/components/usage/UsageReasoningEffortCell.vue'
import UsageRouteCell from '@/components/usage/UsageRouteCell.vue'
import UsageTimeCell from '@/components/usage/UsageTimeCell.vue'
import UsageTokenCell from '@/components/usage/UsageTokenCell.vue'
import UsageTransportBadge from '@/components/usage/UsageTransportBadge.vue'
import {
  usageAccountDisplayText,
  usageAccountText,
  usageUserAgent,
} from './shared/presenter'

// 使用记录表只负责该领域的单元格呈现；筛选与分页由页面组合。
const props = withDefaults(
  defineProps<{
    columns: TableColumn<UsageListRecord>[]
    rows: UsageListRecord[]
    loading?: boolean
    emptyText?: string
  }>(),
  {
    loading: false,
  },
)

const { t } = useI18n({ useScope: 'global' })
const copyText = useCopyText()
const { accountDisplayMode, isFull } = useAccountDisplayMode()

// 联动脱敏：完整模式展开所有有 UA 的记录；脱敏模式全部收起隐藏，不占任何多余空间
const expandedRowKeys = computed(() => {
  if (!isFull.value)
    return []
  return props.rows.filter(r => Boolean(r.userAgent?.trim())).map(r => r.id)
})

function handleCopyUserAgent(ua?: string | null) {
  if (!ua)
    return
  copyText(ua, { successText: t('common.messages.copied') })
}


</script>

<template>
  <ZTable
    table-id="usage-records"
    resizable
    :columns="columns"
    :data="rows"
    :loading="loading"
    :expanded-row-keys="expandedRowKeys"
    :empty-text="emptyText ?? t('usage.noUsageRecords')"
  >
    <template #clientApiKeyName="{ displayValue }">
      <span
        class="block max-w-full truncate font-mono text-z-sm leading-none font-bold text-z-text"
        :title="String(displayValue)"
      >
        {{ displayValue }}
      </span>
    </template>

    <template #provider="{ row }">
      <ProviderIconGroup
        :provider="String(row.provider || '')"
        :authentication-kind="row.authenticationKind"
        hide-authentication-kind
        size="sm"
      />
    </template>

    <template #accountEmail="{ row }">
      <span
        class="block max-w-full truncate font-mono text-z-sm leading-none font-bold text-z-text"
        :title="usageAccountText(row)"
      >
        {{ usageAccountDisplayText(row, accountDisplayMode) }}
      </span>
      <div
        v-if="row.clientApiKeyName?.trim()"
        class="mt-1 flex max-w-full items-center gap-1.5 text-z-xs text-z-text-secondary"
        :title="`API Key: ${row.clientApiKeyName}`"
      >
        <span class="shrink-0 text-[11px] leading-none select-none">🔑</span>
        <span class="truncate font-medium">{{ row.clientApiKeyName }}</span>
      </div>
      <div
        v-if="row.accountNotes?.trim() && row.accountNotes?.trim() !== row.accountEmail?.trim() && row.accountNotes?.trim() !== usageAccountText(row)"
        class="mt-0.5 flex max-w-full items-center gap-1.5 text-z-xs text-z-text-secondary"
        :title="`账号备注: ${row.accountNotes}`"
      >
        <span class="shrink-0 text-[11px] leading-none select-none">📝</span>
        <span class="truncate">{{ accountDisplayMode === 'masked' ? maskAccountText(row.accountNotes) : row.accountNotes }}</span>
      </div>
    </template>

    <template #accountPlanType="{ row }">
      <AccountPlanBadge
        v-if="row.accountUpstreamPeer || row.authenticationKind === 'api_key' || row.accountPlanType"
        :authentication-kind="row.authenticationKind ?? undefined"
        :upstream-peer="row.accountUpstreamPeer"
        :plan-type="row.accountPlanType"
        :plan-type-display="row.accountPlanTypeDisplay || row.accountPlanType || ''"
        size="sm"
      />
      <span v-else class="text-z-text-quaternary">—</span>
    </template>

    <template #createdAtDisplay="{ row }">
      <UsageTimeCell :value="row.createdAtDisplay" />
    </template>

    <template #clientIp="{ row }">
      <UsageClientIpCell :record="row" />
    </template>

    <template #expanded="{ row }">
      <div
        v-if="row.userAgent?.trim()"
        class="flex h-6.5 items-center justify-between gap-3 px-3 font-mono text-[11px] text-z-text-secondary select-text"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span class="inline-flex shrink-0 items-center rounded bg-z-fill-secondary px-1.5 py-0.5 text-[10px] font-bold text-z-text-tertiary select-none">
            UA
          </span>
          <span
            class="truncate font-mono text-[11px] text-z-text-secondary select-all"
            :title="usageUserAgent(row)"
          >
            {{ usageUserAgent(row) }}
          </span>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-z-text-tertiary hover:bg-z-fill-hover hover:text-z-text transition-colors select-none cursor-pointer"
          :title="t('common.actions.copy')"
          @click.stop="handleCopyUserAgent(row.userAgent)"
        >
          <Copy class="size-3" />
          <span>{{ t('common.actions.copy') }}</span>
        </button>
      </div>
    </template>

    <template #model="{ row }">
      <UsageModelCell :record="row" />
    </template>

    <template #reasoningEffort="{ row }">
      <UsageReasoningEffortCell :record="row" />
    </template>

    <template #route="{ row }">
      <UsageRouteCell :record="row" />
    </template>

    <template #errorMessage="{ row }">
      <UsageErrorCell :record="row" />
    </template>

    <template #transport="{ row }">
      <UsageTransportBadge
        :client-transport="row.clientTransport"
        :upstream-transport="row.upstreamTransport"
      />
    </template>

    <template #tokenDetails="{ row }">
      <UsageTokenCell :record="row" />
    </template>

    <template #billing="{ row }">
      <UsageBillingCell :record="row" />
    </template>

    <template #latency="{ row }">
      <UsageLatencyCell :record="row" />
    </template>

    <template #performance="{ row }">
      <UsagePerformanceCell :record="row" />
    </template>

    <template v-if="$slots.actions" #actions="scope">
      <slot name="actions" v-bind="scope" />
    </template>
  </ZTable>
</template>
