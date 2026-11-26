import type { Ref } from 'vue'
import type { UsageTimeRangeParams } from './useUsageTimeRange'
import type { UsageErrorOrigin, UsageRecordStatus } from '@/api'

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
  errorOrigin: Readonly<Ref<UsageErrorOrigin | 'all'>>
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
      accountSearch: filterAccount.value?.trim() || undefined,
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
      errorOrigin: options.status.value === 'error' && options.errorOrigin.value !== 'all'
        ? options.errorOrigin.value
        : undefined,
    }
  }

  function filterChanged() {
    const filter = filterParams.value
    return tableParams.clientApiKeyName !== filter.clientApiKeyName
      || tableParams.accountSearch !== filter.accountSearch
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
  const filteredEstimatedCost = shallowRef<string | null>(null)

  function parseUsdAmount(display?: string | null): number {
    if (!display)
      return 0
    const normalized = display.replace(/[^0-9.-]/g, '')
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed)
      ? parsed
      : 0
  }

  async function updateFilteredSummary() {
    if (!isFineGrainedFiltered.value) {
      filteredSummary.value = null
      filteredEstimatedCost.value = null
      return
    }

    const total = totalRecords.value
    const isErrorStatus = options.status.value === 'error'
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
        logicalRequests: {
          requestCount: 0,
          successCount: 0,
          failureCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          cacheWriteInputTokens: 0,
          reasoningOutputTokens: 0,
          totalTokens: 0,
        },
      }
      filteredEstimatedCost.value = '0'
      if (!isErrorStatus && (filterAccount.value || filterKey.value || filterModel.value)) {
        try {
          const errRes = await getUsageRecords({
            ...snapshot(),
            status: 'error',
            currentPage: 1,
            pageSize: 1,
          })
          if (filteredSummary.value?.logicalRequests) {
            const errTotal = errRes.total ?? 0
            filteredSummary.value = {
              ...filteredSummary.value,
              logicalRequests: {
                ...filteredSummary.value.logicalRequests,
                requestCount: errTotal,
                failureCount: errTotal,
              },
            }
          }
        }
        catch {
          // ignore
        }
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
    let sumReasoning = 0
    let sumCostUsd = 0
    let sumLatency = 0
    let latencyCount = 0

    for (const r of sourceRecords) {
      const td = r.tokenDetails
      sumTotal += td?.totalTokens ?? 0
      sumInput += td?.inputTokens ?? 0
      sumOutput += td?.outputTokens ?? 0
      sumCached += td?.cachedInputTokens ?? 0
      sumReasoning += td?.reasoningOutputTokens ?? 0
      sumCostUsd += parseUsdAmount(r.billing?.totalAmountDisplay)
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
    const scaledReasoning = Math.round(sumReasoning * scale)
    const scaledCost = sumCostUsd * scale
    const avgLatency = latencyCount > 0
      ? sumLatency / latencyCount
      : 0

    let failureCount = isErrorStatus ? total : 0
    if (!isErrorStatus) {
      try {
        const errRes = await getUsageRecords({
          ...snapshot(),
          status: 'error',
          currentPage: 1,
          pageSize: 1,
        })
        failureCount = errRes.total ?? 0
      }
      catch {
        // ignore
      }
    }

    const totalWithFailures = isErrorStatus
      ? total
      : total + failureCount

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
      logicalRequests: {
        requestCount: totalWithFailures,
        successCount: isErrorStatus ? 0 : total,
        failureCount,
        inputTokens: scaledInput,
        outputTokens: scaledOutput,
        cachedInputTokens: scaledCached,
        cacheWriteInputTokens: 0,
        reasoningOutputTokens: scaledReasoning,
        totalTokens: scaledTotal,
      },
    }
    filteredEstimatedCost.value = String(scaledCost)
  }

  const displaySummary = computed(() => {
    if (isFineGrainedFiltered.value && filteredSummary.value) {
      return filteredSummary.value
    }
    return insights.summary.value.data
  })

  const displayCost = computed(() => {
    if (isFineGrainedFiltered.value && filteredEstimatedCost.value !== null) {
      return filteredEstimatedCost.value
    }
    return insights.cost.value.data?.data.summary.estimatedCost ?? null
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

  watch([options.status, options.errorOrigin], () => {
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
    displayCost,
    refreshingList,
    loadUsageRecords,
    refreshUsageRecords,
    handlePageChange,
    handlePageSizeChange,
  }
}
