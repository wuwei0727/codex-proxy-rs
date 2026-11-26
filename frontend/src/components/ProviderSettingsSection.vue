<script setup lang="ts">
import type { BuiltinProvider } from '@/providers/catalog'
import { useI18n } from 'vue-i18n'
import ProviderSelect from '@/components/ProviderSelect.vue'

defineProps<{ disabled?: boolean, hideHeader?: boolean }>()
const provider = defineModel<BuiltinProvider>({ required: true })
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="grid min-w-0 gap-3 rounded-z-card border border-z-border-secondary/60 bg-z-fill-quaternary/40 p-3" :aria-label="t('common.providers.settings')">
    <div v-if="!hideHeader" class="flex items-center justify-between gap-2 border-b border-z-border-secondary/40 pb-2.5">
      <span class="text-z-sm font-semibold text-z-text">
        {{ t('common.providers.settings') }}
      </span>
      <ProviderSelect
        v-model="provider"
        :disabled="disabled"
        class="shrink-0"
      />
    </div>
    <slot />
  </section>
</template>
