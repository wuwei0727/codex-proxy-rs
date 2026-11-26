<script setup lang="ts">
import type { FormRule } from '@codex-proxy/ui'
import type { ModelOptionGroup } from './GroupedModelSelect.vue'
import type { PricingCatalog } from '@/api'
import { ZButton, ZCard, ZEmpty, ZFormItem, ZIconButton } from '@codex-proxy/ui'

import { Plus, Trash2 } from '@lucide/vue'

import { computed, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPricing } from '@/api'
import { formatProviderLabel } from '@/providers/catalog'
import GroupedModelSelect from './GroupedModelSelect.vue'

const props = withDefaults(defineProps<{
  mappings: Array<{ requestedModel: string, upstreamModel: string }>
  loading?: boolean
  compact?: boolean
}>(), {
  loading: false,
  compact: false,
})

const emit = defineEmits<{
  addMapping: []
  updateMapping: [index: number, key: 'requestedModel' | 'upstreamModel', value: string]
  removeMapping: [index: number]
}>()

const { t } = useI18n({ useScope: 'global' })

const claudeModels = shallowRef<string[]>([])
const pricingCatalog = shallowRef<PricingCatalog | null>(null)
const loadingCatalog = shallowRef(false)

async function fetchAnthropicModels(): Promise<string[]> {
  const response = await fetch('https://models.dev/api.json')
  if (!response.ok)
    return []
  const data = await response.json() as { anthropic?: { models?: Record<string, unknown> } }
  const models = data?.anthropic?.models
  return models && typeof models === 'object'
    ? Object.keys(models).sort((a, b) => b.localeCompare(a))
    : []
}

onMounted(async () => {
  loadingCatalog.value = true
  try {
    const [pricing, anthropic] = await Promise.allSettled([
      getPricing(),
      fetchAnthropicModels(),
    ])
    if (pricing.status === 'fulfilled')
      pricingCatalog.value = pricing.value
    if (anthropic.status === 'fulfilled')
      claudeModels.value = anthropic.value
  }
  finally {
    loadingCatalog.value = false
  }
})

const catalogModelsByProvider = computed(() => {
  const catalog = pricingCatalog.value
  const map = new Map<string, Set<string>>()
  if (!catalog)
    return map
  for (const source of [catalog.defaults, catalog.synced, catalog.overrides]) {
    for (const [provider, models] of Object.entries(source)) {
      let set = map.get(provider)
      if (!set) {
        set = new Set<string>()
        map.set(provider, set)
      }
      for (const model of Object.keys(models))
        set.add(model)
    }
  }
  return map
})

const upstreamGroups = computed<ModelOptionGroup[]>(() => {
  const groups: ModelOptionGroup[] = []
  const seen = new Set<string>()

  for (const [provider, models] of catalogModelsByProvider.value.entries()) {
    const sorted = [...models].sort()
    for (const model of sorted)
      seen.add(model)
    groups.push({
      key: provider,
      label: formatProviderLabel(provider),
      models: sorted,
    })
  }

  const customModels: string[] = []
  for (const row of props.mappings) {
    const value = row.upstreamModel.trim()
    if (value && !seen.has(value)) {
      seen.add(value)
      customModels.push(value)
    }
  }
  if (customModels.length) {
    groups.push({
      key: 'custom',
      label: '已保存',
      models: customModels,
    })
  }

  return groups
})

const requestedGroups = computed<ModelOptionGroup[]>(() => {
  const groups: ModelOptionGroup[] = []
  const seen = new Set<string>()

  if (claudeModels.value.length) {
    for (const model of claudeModels.value)
      seen.add(model)
    groups.push({
      key: 'anthropic',
      label: 'Claude (Anthropic)',
      models: claudeModels.value,
    })
  }

  for (const [provider, models] of catalogModelsByProvider.value.entries()) {
    const sorted = [...models].sort().filter(model => !seen.has(model))
    for (const model of sorted)
      seen.add(model)
    if (sorted.length) {
      groups.push({
        key: provider,
        label: formatProviderLabel(provider),
        models: sorted,
      })
    }
  }

  const customModels: string[] = []
  for (const row of props.mappings) {
    const value = row.requestedModel.trim()
    if (value && !seen.has(value)) {
      seen.add(value)
      customModels.push(value)
    }
  }
  if (customModels.length) {
    groups.push({
      key: 'custom',
      label: '已保存',
      models: customModels,
    })
  }

  return groups
})

const requiredRule = computed<FormRule>(() => ({
  required: true,
  whitespace: true,
  trigger: ['blur', 'change'],
  message: t('settings.form.fillInModelMappingCompletely'),
}))
const uniqueModelRule = computed<FormRule>(() => ({
  trigger: ['blur', 'change'],
  validator: (_rule, value: string) => {
    const requested = value.trim()
    return !requested || props.mappings.filter(row => row.requestedModel.trim() === requested).length < 2
      || new Error(t('settings.form.duplicateClientModel', { requested }))
  },
}))
</script>

<template>
  <div v-if="compact" class="@container grid gap-2 rounded-z-card border border-z-border-secondary/60 bg-z-fill-quaternary/50 p-3">
    <div class="flex items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="text-z-sm font-semibold text-z-text">
          {{ t('settings.modelMapping') }}
        </div>
        <p class="m-0 text-z-xs text-z-text-tertiary">
          {{ t('settings.routing.modelMapHelp') }}
        </p>
      </div>
      <ZButton size="small" :disabled="loading" @click="emit('addMapping')">
        <template #icon>
          <Plus class="size-3.5" />
        </template>
        {{ t('settings.addMapping') }}
      </ZButton>
    </div>

    <p
      v-if="loading"
      role="status"
      class="m-0 py-2 text-center text-z-xs text-z-text-tertiary"
    >
      {{ t('settings.loadingModelMapping') }}
    </p>
    <p
      v-else-if="!mappings.length"
      role="status"
      class="m-0 rounded-z border border-dashed border-z-border-secondary/70 py-2.5 text-center text-z-xs text-z-text-quaternary"
    >
      {{ t('settings.emptyModelMapping') }}
    </p>
    <div v-else class="grid gap-2">
      <div
        v-for="(row, index) in mappings"
        :key="index"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 rounded-z bg-z-bg-container/70 p-2 @lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
      >
        <ZFormItem :prop="`modelMappings.${index}.requestedModel`" :rules="[requiredRule, uniqueModelRule]" :show-message="Boolean(row.requestedModel.trim())">
          <GroupedModelSelect
            size="small"
            :loading="loadingCatalog"
            :groups="requestedGroups"
            :model-value="row.requestedModel"
            :placeholder="t('settings.requestModel')"
            :aria-label="t('settings.requestModel')"
            @update:model-value="emit('updateMapping', index, 'requestedModel', $event)"
          />
        </ZFormItem>
        <span class="hidden text-z-text-quaternary @lg:block" aria-hidden="true">→</span>
        <ZFormItem :prop="`modelMappings.${index}.upstreamModel`" :rules="requiredRule" :show-message="false" class="col-start-1 row-start-2 @lg:col-start-auto @lg:row-start-auto">
          <GroupedModelSelect
            size="small"
            :loading="loadingCatalog"
            :groups="upstreamGroups"
            :model-value="row.upstreamModel"
            :placeholder="t('settings.upstreamModel')"
            :aria-label="t('settings.upstreamModelName')"
            @update:model-value="emit('updateMapping', index, 'upstreamModel', $event)"
          />
        </ZFormItem>
        <ZIconButton
          size="small"
          class="col-start-2 row-span-2 row-start-1 @lg:col-start-auto @lg:row-span-1 @lg:row-start-auto"
          :aria-label="t('settings.deleteMapping')"
          @click="emit('removeMapping', index)"
        >
          <Trash2 class="size-3.5 text-z-error" />
        </ZIconButton>
      </div>
    </div>
  </div>

  <ZCard
    v-else
    class="@container"
    :title="t('settings.modelMapping')"
    :description="t('settings.routing.modelMapHelp')"
  >
    <template #actions>
      <ZButton :disabled="loading" @click="emit('addMapping')">
        <template #icon>
          <Plus class="size-4" />
        </template>
        {{ t('settings.addMapping') }}
      </ZButton>
    </template>
    <template #body>
      <p
        v-if="loading"
        role="status"
        class="m-0 px-4 py-4 text-center text-z-sm text-z-text-tertiary"
      >
        {{ t('settings.loadingModelMapping') }}
      </p>
      <ZEmpty v-else-if="!mappings.length" :title="t('settings.emptyModelMapping')" size="small" surface="none" role="status" class="flex-1 content-center py-3!" />
      <div v-else class="grid gap-3">
        <div
          v-for="(row, index) in mappings"
          :key="index"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-4.5 rounded-z-card bg-z-fill-quaternary p-3 @lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
        >
          <ZFormItem :prop="`modelMappings.${index}.requestedModel`" :rules="[requiredRule, uniqueModelRule]" :show-message="Boolean(row.requestedModel.trim())">
            <GroupedModelSelect
              :loading="loadingCatalog"
              :groups="requestedGroups"
              :model-value="row.requestedModel"
              :placeholder="t('settings.requestModel')"
              :aria-label="t('settings.requestModel')"
              @update:model-value="emit('updateMapping', index, 'requestedModel', $event)"
            />
          </ZFormItem>
          <span class="hidden text-z-text-quaternary @lg:block" aria-hidden="true">→</span>
          <ZFormItem :prop="`modelMappings.${index}.upstreamModel`" :rules="requiredRule" :show-message="false" class="col-start-1 row-start-2 @lg:col-start-auto @lg:row-start-auto">
            <GroupedModelSelect
              :loading="loadingCatalog"
              :groups="upstreamGroups"
              :model-value="row.upstreamModel"
              :placeholder="t('settings.upstreamModel')"
              :aria-label="t('settings.upstreamModelName')"
              @update:model-value="emit('updateMapping', index, 'upstreamModel', $event)"
            />
          </ZFormItem>
          <ZIconButton
            class="col-start-2 row-span-2 row-start-1 @lg:col-start-auto @lg:row-span-1 @lg:row-start-auto"
            :aria-label="t('settings.deleteMapping')"
            @click="emit('removeMapping', index)"
          >
            <Trash2 class="size-4 text-z-error" />
          </ZIconButton>
        </div>
      </div>
    </template>
  </ZCard>
</template>
