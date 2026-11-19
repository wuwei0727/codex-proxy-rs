import type { TableColumn } from '@codex-proxy/ui'
import type { Ref } from 'vue'
import type { UsageListRecord, UsageRecordStatus } from '@/api'
import { useTableColumns } from '@codex-proxy/ui'
import { computed } from 'vue'
import { usageRecordColumns } from '@/components/usage/shared/columns'
import { t } from '@/i18n'

export function useUsageRecordColumns(status: Ref<UsageRecordStatus>, tableWidth: Readonly<Ref<number>>) {
  const usageTableId = 'usage-records'
  const errorTableId = 'usage-error-records'
  const usage = useTableColumns(usageRecordColumns, usageTableId)
  const errors = useTableColumns(() => [
    {
      key: 'errorMessage',
      label: t('usage.filters.error'),
      kind: 'custom',
      fixed: 'left',
      minWidth: tableWidth.value
        ? Math.min(310, Math.max(96, (tableWidth.value - 44) / 2))
        : 310,
      hideable: false,
    },
    ...usageRecordColumns.value.map(column => ['tokenDetails', 'billing'].includes(column.key)
      ? { ...column, defaultHidden: true }
      : column),
  ] satisfies TableColumn<UsageListRecord>[], errorTableId)

  return {
    tableId: computed(() => status.value === 'error'
      ? errorTableId
      : usageTableId),
    columnSettings: computed(() => status.value === 'error'
      ? errors
      : usage),
  }
}
