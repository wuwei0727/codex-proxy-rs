<script setup lang="ts">
import type { SelectOption } from '@codex-proxy/ui'
import type { AccountGroupRef } from '@/api'

import { ZSelect } from '@codex-proxy/ui'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    groups: AccountGroupRef[]
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    loading: false,
    disabled: false,
  },
)

const { t } = useI18n({ useScope: 'global' })

const selectedGroupIds = defineModel<string[]>({ required: true })

const groupById = computed(() => new Map(props.groups.map(group => [group.id, group])))

const groupOptions = computed<SelectOption[]>(() =>
  props.groups.map(group => ({
    label: group.name,
    value: group.id,
    description: !group.enabled
      ? t('common.status.disabled')
      : undefined,
  })),
)
</script>

<template>
  <ZSelect
    v-model="selectedGroupIds"
    multiple
    filterable
    clearable
    collapse-tags
    collapse-tags-tooltip
    :max-collapse-tags="4"
    :loading="loading"
    :disabled="disabled"
    :options="groupOptions"
    :empty-text="loading ? t('groups.selector.loading') : t('groups.selector.empty')"
    :placeholder="loading ? t('groups.selector.loading') : t('groups.page.selectGroup')"
  >
    <template #option="{ option }">
      <span class="flex min-w-0 items-center gap-2">
        <span
          class="size-2.5 shrink-0 rounded-sm"
          :style="{ backgroundColor: groupById.get(String(option.value))?.color }"
        />
        <span class="truncate">{{ option.label }}</span>
        <span
          v-if="option.description"
          class="shrink-0 text-z-xs text-z-text-quaternary"
        >
          ({{ option.description }})
        </span>
      </span>
    </template>
  </ZSelect>
</template>
