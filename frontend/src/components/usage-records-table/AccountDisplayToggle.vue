<script setup lang="ts">
import { Eye, EyeOff } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useAccountDisplayMode } from '@/composables/useAccountDisplayMode'

const { t } = useI18n({ useScope: 'global' })
const { isFull, toggle } = useAccountDisplayMode()
</script>

<template>
  <button
    type="button"
    class="inline-flex h-z-control shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-z-sm px-2.5 text-z-sm leading-none transition-all duration-150 select-none motion-safe:active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-z-control-outline focus-visible:ring-offset-2 focus-visible:ring-offset-z-bg-container cursor-pointer"
    :class="[
      isFull
        ? 'border border-z-primary-border bg-z-primary-container font-bold text-z-primary-on-container hover:bg-z-primary-container-hover active:bg-z-primary-container-hover'
        : 'border border-z-border bg-z-fill-tertiary font-medium text-z-text-secondary hover:bg-z-fill-hover hover:text-z-text active:bg-z-fill-secondary',
    ]"
    :title="isFull ? t('usage.accountDisplay.showMaskedHint') : t('usage.accountDisplay.showFullHint')"
    :aria-label="isFull ? t('usage.accountDisplay.showMaskedHint') : t('usage.accountDisplay.showFullHint')"
    @click="toggle"
  >
    <component :is="isFull ? Eye : EyeOff" class="size-4 shrink-0" />
    <span>{{ isFull ? t('usage.accountDisplay.full') : t('usage.accountDisplay.masked') }}</span>
  </button>
</template>
