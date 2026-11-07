<script setup lang="ts">
import type { TableColumn } from '@codex-proxy/ui'

import type { UsageListRecord, UsageRecordStatus } from '@/api'
import { useTableColumns, ZCard, ZDatePicker, ZIconButton, ZPagination, ZSegmented, ZTableColumnSettings } from '@codex-proxy/ui'
import { ChartNoAxesColumn, CircleAlert, Eye, FileText } from '@lucide/vue'
import { useLocalStorage } from '@vueuse/core'

import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AccountDisplayToggle from '@/components/usage/AccountDisplayToggle.vue'
import { usageRecordColumns } from '@/components/usage/shared/columns'
import UsageRecordsTable from '@/components/usage/UsageRecordsTable.vue'
import UsageErrorDetailModal from './components/UsageErrorDetailModal.vue'
import UsageFilters from './components/UsageFilters.vue'
import UsageInsightsGrid from './components/UsageInsightsGrid.vue'
import UsageRecordDetailModal from './components/UsageRecordDetailModal.vue'
import UsageSummaryCards from './components/UsageSummaryCards.vue'
import { useUsageRecordDetail } from './composables/useUsageRecordDetail'
import { useUsageRecordsTable } from './composables/useUsageRecordsTable'
import { useUsageTimeRange } from './composables/useUsageTimeRange'
import { isErrorUsageRecord } from './utils/detail'

const { t } = useI18n({ useScope: 'global' })

type UsageTab = 'records' | 'insights'
const activeTab = useLocalStorage<UsageTab>('codex-proxy-usage-active-tab', 'records')
const tabOptions = computed(() => ([
  {
    label: t('usage.page.recordsTab'),
    value: 'records',
    icon: FileText,
  },
  {
    label: t('usage.page.insightsTab'),
    value: 'insights',
    icon: ChartNoAxesColumn,
  },
]))

const recordView = shallowRef<UsageRecordStatus>('success')
const recordColumns = computed<TableColumn<UsageListRecord>[]>(() => recordView.value === 'error'
  ? usageRecordColumns.value.flatMap(column => column.key === 'route'
      ? [
          column,
          {
            key: 'errorMessage',
            label: t('usage.filters.error'),
            kind: 'custom',
            size: '4xl',
            hideable: false,
          },
        ]
      : [column])
  : usageRecordColumns.value)
const { visibleColumns, columnOptions, setColumnVisible, setColumnOrder, resetColumns } = useTableColumns(recordColumns, 'usage-records')
const { timeRange, timeRangeParams, disabledDate, refreshTimeRangeEnd, latestTimeRangeParams, resetTimeRange, isDefaultTimeRange }
  = useUsageTimeRange()

const {
  filterAccount,
  filterKey,
  filterModel,
  hasActiveFilters,
  resetFilters,
  accountOptions,
  keyOptions,
  modelOptions,
  providerQuery,
  usagePagination,
  loading,
  records,
  summary,
  displaySummary,
  health,
  performance,
  cost,
  diagnostics,
  performanceMetric,
  costMetric,
  refreshingList,
  diagnosticDimension,
  loadUsageRecords,
  refreshUsageRecords,
  handlePageChange,
  handlePageSizeChange,
} = useUsageRecordsTable({
  timeRangeParams,
  latestTimeRangeParams,
  status: recordView,
})

function handleResetAllFilters() {
  resetFilters()
  resetTimeRange()
  providerQuery.value = ''
  recordView.value = 'success'
}

function toggleRecordStatus() {
  recordView.value = recordView.value === 'error' ? 'success' : 'error'
}

const { showDetailModal, selectedUsageRecord, detailIsError, detailLoading, detailError, handleViewDetail, reloadDetail } = useUsageRecordDetail()
const detailComponent = computed(() => detailIsError.value
  ? UsageErrorDetailModal
  : UsageRecordDetailModal)

watch(timeRange, () => {
  refreshTimeRangeEnd()
  void loadUsageRecords()
})
</script>

<template>
  <div class="@container w-full">
    <!-- 顶部极简工具栏：小巧标题 + 分隔线 + 紧凑视图切换胶囊 -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <h1 class="m-0 text-base font-bold tracking-tight text-z-text">
          {{ t('navigation.usage') }}
        </h1>
        <div class="h-3.5 w-px bg-z-border" />
        <ZSegmented
          v-model="activeTab"
          :options="tabOptions"
          :aria-label="t('usage.page.viewModeLabel')"
          size="small"
        />
      </div>

      <!-- 图表洞察视图下，时间选择器靠右展示 -->
      <div v-if="activeTab === 'insights'" class="flex items-center gap-2">
        <ZDatePicker
          v-model="timeRange"
          type="daterange"
          :clearable="false"
          :editable="false"
          :disabled-date="disabledDate"
          single-panel
          :aria-label="t('usage.page.dateRangeLabel')"
          class="w-56"
        />
      </div>
    </header>

    <!-- 核心指标汇总紧凑卡片 -->
    <UsageSummaryCards :summary="displaySummary" :status="recordView" :error="summary.error" class="mt-3" />

    <!-- 图表洞察视图 -->
    <UsageInsightsGrid
      v-if="activeTab === 'insights'"
      v-model:diagnostic-dimension="diagnosticDimension"
      v-model:performance-metric="performanceMetric"
      v-model:cost-metric="costMetric"
      :health="health"
      :performance="performance"
      :cost="cost"
      :diagnostics="diagnostics"
    />

    <!-- 请求明细卡片：移除冗余大标题，顶部直接融入统一筛选栏 -->
    <ZCard
      v-if="activeTab === 'records'"
      class="mt-4 flex flex-col"
    >
      <template #body>
        <div
          class="grid min-h-130 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3"
        >
          <!-- 统一筛选工具栏：时间、平台（默认全部）、账号、密钥、模型、重置 + 操作按钮 -->
          <UsageFilters
            v-model:time-range="timeRange"
            v-model:provider="providerQuery"
            v-model:account="filterAccount"
            v-model:api-key="filterKey"
            v-model:model="filterModel"
            :disabled-date="disabledDate"
            :account-options="accountOptions"
            :key-options="keyOptions"
            :model-options="modelOptions"
            :has-active-filters="hasActiveFilters || !isDefaultTimeRange || Boolean(providerQuery) || recordView !== 'success'"
            :loading="loading"
            :refreshing="refreshingList"
            @refresh="refreshUsageRecords"
            @reset="handleResetAllFilters"
          >
            <template #actions>
              <AccountDisplayToggle />
              <button
                type="button"
                class="inline-flex h-z-control shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-z-sm px-2.5 text-z-sm leading-none transition-all duration-150 select-none motion-safe:active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-z-control-outline focus-visible:ring-offset-2 focus-visible:ring-offset-z-bg-container cursor-pointer"
                :class="[
                  recordView === 'error'
                    ? 'border border-z-error-border bg-z-error-container font-bold text-z-error-on-container hover:bg-z-error-container-hover active:bg-z-error-container-hover'
                    : 'border border-z-border bg-z-fill-tertiary font-medium text-z-text-secondary hover:bg-z-fill-hover hover:text-z-text active:bg-z-fill-secondary',
                ]"
                :title="recordView === 'error' ? t('usage.filters.viewSuccess') : t('usage.filters.viewFailed')"
                :aria-label="recordView === 'error' ? t('usage.filters.viewSuccess') : t('usage.filters.viewFailed')"
                @click="toggleRecordStatus"
              >
                <CircleAlert class="size-4 shrink-0" :class="recordView === 'error' ? 'text-z-error-on-container' : 'text-z-text-secondary'" />
                <span>{{ t('usage.filters.failed') }}</span>
              </button>
              <ZTableColumnSettings
                :options="columnOptions"
                @change="setColumnVisible"
                @reorder="setColumnOrder"
                @reset="resetColumns"
              />
            </template>
          </UsageFilters>

          <div class="flex min-h-0 min-w-0 flex-col">
            <UsageRecordsTable
              class="min-h-0 flex-1"
              :columns="visibleColumns"
              :rows="records"
              :loading="loading"
              :empty-text="t('usage.page.noRequestsMatchTheseFilters')"
            >
              <template #actions="{ row }">
                <div class="flex items-center justify-center">
                  <ZIconButton
                    size="small"
                    :aria-label="isErrorUsageRecord(row) ? t('usage.page.viewErrorDetails') : t('usage.page.viewUsageRecordDetails')"
                    @click="handleViewDetail(row)"
                  >
                    <Eye class="size-3.5" />
                  </ZIconButton>
                </div>
              </template>
            </UsageRecordsTable>
            <ZPagination
              v-bind="usagePagination"
              :disabled="loading"
              @current-change="handlePageChange"
              @size-change="handlePageSizeChange"
            />
          </div>
        </div>
      </template>
    </ZCard>

    <component :is="detailComponent" v-model="showDetailModal" :record="selectedUsageRecord" :loading="detailLoading" :error="detailError" @retry="reloadDetail" />
  </div>
</template>
