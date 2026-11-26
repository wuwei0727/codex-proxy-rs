<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  apiKey: {
    enabled: boolean
  }
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <button
    type="button"
    class="inline-flex h-6 min-w-14 items-center justify-center gap-1 rounded-full px-2.5 text-z-sm leading-none font-bold transition-all focus-visible:ring-2 focus-visible:ring-z-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    :class="[
      apiKey.enabled
        ? 'bg-z-success-container text-z-success-on-container hover:ring-1 hover:ring-z-success/40 hover:brightness-110'
        : 'bg-z-fill-quaternary text-z-text-secondary hover:bg-z-fill-tertiary hover:text-z-text hover:ring-1 hover:ring-z-border-primary',
      loading ? 'cursor-wait opacity-75' : 'cursor-pointer',
    ]"
    :disabled="disabled || loading"
    :title="apiKey.enabled ? t('keys.actions.disableKey') : t('keys.actions.enableKey')"
    :aria-label="apiKey.enabled ? t('keys.actions.disableKey') : t('keys.actions.enableKey')"
    @click.stop="emit('toggle')"
  >
    <Loader2 v-if="loading" class="size-3 animate-spin" />
    {{ apiKey.enabled ? t('common.status.enabled') : t('common.status.disabled') }}
  </button>
</template>
