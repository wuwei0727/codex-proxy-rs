<script setup lang="ts">
import { ZInput, ZPopover, ZScrollbar } from '@codex-proxy/ui'
import { Check, ChevronDown, ChevronRight, Search } from '@lucide/vue'
import { computed, shallowRef, watch } from 'vue'

export interface ModelOptionGroup {
  key: string
  label: string
  models: string[]
}

const props = withDefaults(defineProps<{
  groups: ModelOptionGroup[]
  modelValue?: string
  placeholder?: string
  ariaLabel?: string
  size?: 'small' | 'default'
  loading?: boolean
}>(), {
  modelValue: '',
  placeholder: '',
  ariaLabel: '',
  size: 'default',
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = shallowRef(false)
const searchQuery = shallowRef('')
const expandedKeys = shallowRef<Set<string>>(new Set())

watch(open, (isOpen) => {
  if (!isOpen)
    searchQuery.value = ''
})

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase())

const filteredGroups = computed(() => {
  const query = normalizedQuery.value
  if (!query)
    return props.groups.filter(group => group.models.length > 0)

  return props.groups
    .map((group) => {
      const groupMatches = group.label.toLowerCase().includes(query) || group.key.toLowerCase().includes(query)
      const models = groupMatches
        ? group.models
        : group.models.filter(model => model.toLowerCase().includes(query))
      return {
        ...group,
        models,
      }
    })
    .filter(group => group.models.length > 0)
})

function isExpanded(key: string): boolean {
  return Boolean(normalizedQuery.value) || expandedKeys.value.has(key)
}

function toggleGroup(key: string) {
  const next = new Set(expandedKeys.value)
  if (next.has(key))
    next.delete(key)
  else
    next.add(key)
  expandedKeys.value = next
}

function selectModel(model: string, close: () => void) {
  emit('update:modelValue', model)
  close()
}
</script>

<template>
  <ZPopover v-model="open" placement="bottom-start" trigger="click" :offset="4">
    <template #reference="{ open: isOpen, id }">
      <button
        type="button"
        :aria-expanded="isOpen"
        :aria-controls="id"
        :aria-label="ariaLabel || placeholder"
        class="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-z-sm border border-z-border bg-z-bg-container px-2.5 text-left transition-colors hover:border-z-border-hover focus-visible:ring-2 focus-visible:ring-z-control-outline focus-visible:outline-none"
        :class="size === 'small' ? 'h-7 text-z-xs' : 'h-8 text-z-sm'"
      >
        <span class="truncate" :class="modelValue ? 'font-mono text-z-text' : 'text-z-text-quaternary'">
          {{ modelValue || placeholder }}
        </span>
        <ChevronDown
          class="size-3.5 shrink-0 text-z-text-tertiary transition-transform duration-150"
          :class="isOpen ? 'rotate-180' : ''"
          aria-hidden="true"
        />
      </button>
    </template>

    <template #default="{ close }">
      <div class="w-72 p-2 sm:w-80">
        <ZInput
          v-model="searchQuery"
          size="small"
          clearable
          :placeholder="loading ? '正在加载模型...' : '搜索平台或模型名称...'"
        >
          <template #prefix>
            <Search class="size-3.5 text-z-text-quaternary" />
          </template>
        </ZInput>

        <ZScrollbar class="mt-2 max-h-64">
          <p v-if="!filteredGroups.length" class="m-0 py-4 text-center text-z-xs text-z-text-tertiary">
            {{ loading ? '正在加载模型...' : '无匹配模型' }}
          </p>
          <div v-else class="grid gap-1 pr-1">
            <div v-for="group in filteredGroups" :key="group.key" class="grid gap-0.5">
              <button
                type="button"
                class="flex w-full cursor-pointer items-center justify-between rounded-z-sm px-2 py-1.5 text-left text-z-xs font-semibold text-z-text-secondary transition-colors hover:bg-z-fill-hover hover:text-z-text"
                @click="toggleGroup(group.key)"
              >
                <span class="flex min-w-0 items-center gap-1.5">
                  <ChevronDown v-if="isExpanded(group.key)" class="size-3.5 shrink-0 text-z-text-tertiary" />
                  <ChevronRight v-else class="size-3.5 shrink-0 text-z-text-tertiary" />
                  <span class="truncate">{{ group.label }}</span>
                </span>
                <span class="shrink-0 rounded-full bg-z-fill-tertiary px-1.5 py-0.5 font-mono text-[10px] leading-none text-z-text-tertiary">
                  {{ group.models.length }}
                </span>
              </button>

              <div v-if="isExpanded(group.key)" class="grid gap-0.5 pl-4">
                <button
                  v-for="model in group.models"
                  :key="model"
                  type="button"
                  class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-z-sm px-2 py-1 text-left font-mono text-z-xs transition-colors"
                  :class="model === modelValue
                    ? 'bg-z-primary-container font-semibold text-z-primary-on-container'
                    : 'text-z-text hover:bg-z-fill-hover'"
                  @click="selectModel(model, close)"
                >
                  <span class="truncate">{{ model }}</span>
                  <Check v-if="model === modelValue" class="size-3.5 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </ZScrollbar>
      </div>
    </template>
  </ZPopover>
</template>
