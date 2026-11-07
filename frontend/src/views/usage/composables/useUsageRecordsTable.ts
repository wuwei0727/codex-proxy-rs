import type { Ref } from 'vue'
import type { UsageTimeRangeParams } from './useUsageTimeRange'
import type { UsageRecordStatus } from '@/api'

import { computed, onMounted, shallowRef, watch } from 'vue'
import { getUsageRecords } from '@/api'
import { useStablePagedQuery } from '@/composables/useStablePagedQuery'
import { formatCompactNumber, formatInteger } from '@/utils/format'
import { withMinimumDuration } from '@/utils/operation'
import { useUsageFilterOptions } from './useUsageFilterOptions'
import { useUsageInsights } from './useUsageInsights'

interface UseUsageRecordsTableOptions {
  timeRangeParams: Readonly<Ref<UsageTimeRangeParams>>
  latestTimeRangeParams: () => UsageTimeRangeParams
  status: Readonly<Ref<UsageRecordStatus>>
}

type UsageLoadScope = 'all' | 'table'

interface UsageLoadOptions {
  scope?: UsageLoadScope
}

export function useUsageRecordsTable(options: UseUsageRecordsTableOptions) {
  const filterAccount = shallowRef<string | undefined>(undefined)
  const filterKey = shallowRef<string | undefined>(undefined)
  const filterModel = shallowRef<string | undefined>(undefined)

  const hasActiveFilters = computed(() => {
    return Boolean(filterAccount.value || filterKey.value || filterModel.value)
  })

  function resetFilters() {
    filterAccount.value = undefined
    filterKey.value = undefined
    filterModel.value = undefined
  }

  const filterParams = computed(() => {
    return {
      accountName: filterAccount.value?.trim() || undefined,
      clientApiKeyName: filterKey.value?.trim() || undefined,
      model: filterModel.value?.trim() || undefined,
    }
  })

  const providerQuery = shallowRef('')
  let tableParams = snapshot()
  const table = useStablePagedQuery({
    initialPageSize: 10,
    load: (pagination, requestOptions) => getUsageRecords({
      ...pagination,
      ...tableParams,
    }, requestOptions),
  })
  const { currentPage, pageSize, loading, error, items: records, total: totalRecords } = table
  const refreshingList = shallowRef(false)
  const scopedParams = () => ({
    ...options.timeRangeParams.value,
    ...(providerQuery.value
      ? { provider: providerQuery.value }
      : {}),
  })
  const { loadUsageAnalytics, ...insights } = useUsageInsights(scopedParams)
  const { accountOptions, keyOptions, modelOptions, loadingFilterOptions, loadFilterOptions } = useUsageFilterOptions(scopedParams)

  const usagePagination = computed(() => ({
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    total: totalRecords.value,
  }))

  function snapshot() {
    return {
      ...options.latestTimeRangeParams(),
      provider: providerQuery.value || undefined,
      ...filterParams.value,
      status: options.status.value,
    }
  }

  function filterChanged() {
    const filter = filterParams.value
    return tableParams.clientApiKeyName !== filter.clientApiKeyName
      || tableParams.accountName !== filter.accountName
      || tableParams.model !== filter.model
  }

  const isFineGrainedFiltered = computed(() => {
    return Boolean(
      filterAccount.value
      || filterKey.value
      || filterModel.value
      || options.status.value !== 'success',
    )
  })

  type SummaryData = Omit<Awaited<ReturnType<typeof import('@/api').getUsageRecordSummary>>, 'analytics'>
  const filteredSummary = shallowRef<SummaryData | null>(null)

  async function updateFilteredSummary() {
    if (!isFineGrainedFiltered.value) {
      filteredSummary.value = null
      return
    }

    const total = totalRecords.value
    if (total === 0) {
      filteredSummary.value = {
        totalRequests: '0',
        totalTokens: '0',
        inputTokens: '0',
        outputTokens: '0',
        cachedInputTokens: '0',
        cacheWriteInputTokens: '0',
        averageLatencyMsValue: 0,
        averageLatencyMs: '0 s',
      }
      return
    }

    let sourceRecords = records.value
    if (total > sourceRecords.length) {
      try {
        const sample = await getUsageRecords({
          ...snapshot(),
          currentPage: 1,
          pageSize: Math.min(total, 100),
        })
        if (sample.items && sample.items.length > 0) {
          sourceRecords = sample.items
        }
      }
      catch {
        // fallback to records.value
      }
    }

    let sumTotal = 0
    let sumInput = 0
    let sumOutput = 0
    let sumCached = 0
    let sumLatency = 0
    let latencyCount = 0

    for (const r of sourceRecords) {
      const td = r.tokenDetails
      sumTotal += td?.totalTokens ?? 0
      sumInput += td?.inputTokens ?? 0
      sumOutput += td?.outputTokens ?? 0
      sumCached += td?.cachedInputTokens ?? 0
      if (r.latencyMs != null && r.latencyMs > 0) {
        sumLatency += r.latencyMs
        latencyCount++
      }
    }

    const sampleCount = Math.max(sourceRecords.length, 1)
    const scale = total / sampleCount

    const scaledTotal = Math.round(sumTotal * scale)
    const scaledInput = Math.round(sumInput * scale)
    const scaledOutput = Math.round(sumOutput * scale)
    const scaledCached = Math.round(sumCached * scale)
    const avgLatency = latencyCount > 0
      ? sumLatency / latencyCount
      : 0

    filteredSummary.value = {
      totalRequests: formatInteger(total),
      totalTokens: formatCompactNumber(scaledTotal),
      inputTokens: formatCompactNumber(scaledInput),
      outputTokens: formatCompactNumber(scaledOutput),
      cachedInputTokens: formatCompactNumber(scaledCached),
      cacheWriteInputTokens: '0',
      averageLatencyMsValue: avgLatency,
      averageLatencyMs: avgLatency < 1000
        ? `${Math.round(avgLatency)} ms`
        : `${(avgLatency / 1000).toFixed(2)} s`,
    }
  }

  const displaySummary = computed(() => {
    if (isFineGrainedFiltered.value && filteredSummary.value) {
      return filteredSummary.value
    }
    return insights.summary.value.data
  })

  function resetTable() {
    tableParams = snapshot()
    // 筛选范围变化后不能继续展示上一范围的数据，即使新查询失败。
    records.value = []
    currentPage.value = 1
    totalRecords.value = 0
  }

  async function loadUsageRecords(loadOptions: UsageLoadOptions = {}) {
    const { scope = 'all' } = loadOptions
    const globalParams = scopedParams()
    if (scope === 'all')
      resetTable()

    await Promise.all([
      table.execute(),
      ...(scope === 'all'
        ? [
            loadUsageAnalytics(globalParams),
            loadFilterOptions(),
          ]
        : []),
    ])
    void updateFilteredSummary()
  }

  async function refreshUsageRecords() {
    if (refreshingList.value || loading.value)
      return
    refreshingList.value = true
    try {
      await withMinimumDuration(reloadLatestTable)
    }
    finally {
      refreshingList.value = false
    }
  }

  function reloadLatestTable() {
    resetTable()
    return loadUsageRecords({ scope: 'table' })
  }

  function handlePageChange(nextPage: number) {
    if (filterChanged()) {
      void reloadLatestTable()
      return
    }
    void table.execute(nextPage)
  }

  function handlePageSizeChange(nextPageSize: number) {
    pageSize.value = nextPageSize
    if (filterChanged()) {
      void reloadLatestTable()
      return
    }
    void table.reloadFromStart()
  }

  onMounted(() => {
    loadUsageRecords()
  })

  watch(providerQuery, () => {
    void loadUsageRecords()
  })

  watch(options.status, () => {
    void reloadLatestTable()
  })

  watch([records, totalRecords, isFineGrainedFiltered], () => {
    void updateFilteredSummary()
  })

  watch(filterParams, (_value, _previous, onCleanup) => {
    const timer = setTimeout(() => {
      if (filterChanged())
        void reloadLatestTable()
    }, 250)
    onCleanup(() => clearTimeout(timer))
  })

  return {
    currentPage,
    pageSize,
    filterAccount,
    filterKey,
    filterModel,
    hasActiveFilters,
    resetFilters,
    accountOptions,
    keyOptions,
    modelOptions,
    loadingFilterOptions,
    loadFilterOptions,
    providerQuery,
    usagePagination,
    loading,
    error,
    records,
    ...insights,
    displaySummary,
    refreshingList,
    loadUsageRecords,
    refreshUsageRecords,
    handlePageChange,
    handlePageSizeChange,
  }
}
