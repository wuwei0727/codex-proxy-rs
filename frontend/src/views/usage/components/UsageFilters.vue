<script setup lang="ts">
import type { DatePickerValue, SelectOption } from '@codex-proxy/ui'
import { ZButton, ZDatePicker, ZIconButton, ZSelect } from '@codex-proxy/ui'
import { RefreshCw, RotateCcw } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatProviderLabel, PROVIDER_IDS } from '@/utils/providers'

defineProps<{
  accountOptions: SelectOption[]
  keyOptions: SelectOption[]
  modelOptions: SelectOption[]
  disabledDate?: (date: Date) => boolean
  hasActiveFilters?: boolean
  refreshing: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  reset: []
}>()

const { t } = useI18n({ useScope: 'global' })

const timeRange = defineModel<DatePickerValue>('timeRange')
const provider = defineModel<string | undefined>('provider', { default: undefined })
const account = defineModel<string | undefined>('account', { default: undefined })
const apiKey = defineModel<string | undefined>('apiKey', { default: undefined })
const model = defineModel<string | undefined>('model', { default: undefined })

const providerOptions = computed<SelectOption[]>(() =>
  PROVIDER_IDS.map(id => ({
    label: formatProviderLabel(id),
    value: id,
  })),
)
</script>

<template>
  <div class="flex w-full flex-wrap items-center justify-between gap-2.5" role="group" :aria-label="t('usage.filters.label')">
    <!-- 左侧多个独立筛选框 -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- 时间范围选择 -->
      <div class="w-52 sm:w-56">
        <ZDatePicker
          v-model="timeRange"
          type="daterange"
          :clearable="false"
          :editable="false"
          :disabled-date="disabledDate"
          single-panel
          :aria-label="t('usage.page.dateRangeLabel')"
          class="w-full"
        />
      </div>

      <!-- 平台筛选 (默认全部平台) -->
      <div class="w-28 sm:w-32">
        <ZSelect
          v-model="provider"
          :options="providerOptions"
          clearable
          :placeholder="t('common.providers.all')"
          :aria-label="t('common.providers.filter')"
          class="w-full"
        />
      </div>

      <!-- 账号选择 (可搜索) -->
      <div class="w-40 sm:w-44">
        <ZSelect
          v-model="account"
          :options="accountOptions"
          filterable
          clearable
          :placeholder="t('usage.filters.allAccounts')"
          :aria-label="t('usage.filters.account')"
          class="w-full"
        />
      </div>

      <!-- 密钥选择 (可搜索) -->
      <div class="w-32 sm:w-36">
        <ZSelect
          v-model="apiKey"
          :options="keyOptions"
          filterable
          clearable
          :placeholder="t('usage.filters.allKeys')"
          :aria-label="t('usage.filters.keyName')"
          class="w-full"
        />
      </div>

      <!-- 模型选择 (可搜索) -->
      <div class="w-36 sm:w-40">
        <ZSelect
          v-model="model"
          :options="modelOptions"
          filterable
          clearable
          :placeholder="t('usage.filters.allModels')"
          :aria-label="t('usage.fields.model')"
          class="w-full"
        />
      </div>

      <!-- 重置筛选按钮 -->
      <ZButton
        v-if="hasActiveFilters"
        variant="text"
        size="default"
        class="text-z-text-secondary hover:text-z-text shrink-0"
        @click="emit('reset')"
      >
        <RotateCcw class="size-3.5 mr-1" />
        {{ t('usage.filters.reset') }}
      </ZButton>
    </div>

    <!-- 右侧操作区：插槽（脱敏、失败切换、列设置）与刷新按钮 -->
    <div class="ml-auto flex shrink-0 items-center justify-end gap-2">
      <slot name="actions" />
      <ZIconButton
        size="default"
        :aria-label="t('usage.filters.refreshUsageHistory')"
        :loading="refreshing"
        :disabled="loading || refreshing"
        @click="emit('refresh')"
      >
        <template #loading>
          <RefreshCw class="size-4.5 animate-spin motion-reduce:animate-none" />
        </template>
        <RefreshCw class="size-4.5" />
      </ZIconButton>
    </div>
  </div>
</template>
