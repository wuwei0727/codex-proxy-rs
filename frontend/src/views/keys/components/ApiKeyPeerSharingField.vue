<script setup lang="ts">
import type { ApiKeyPeerSharing } from '@/api'
import { ZCheckbox, ZSwitch } from '@codex-proxy/ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import HelpPopover from '@/components/HelpPopover.vue'

defineProps<{ sharing: Partial<ApiKeyPeerSharing>, disabled: boolean, inline?: boolean }>()
const emit = defineEmits<{ change: [field: keyof ApiKeyPeerSharing, value: boolean] }>()
const { t } = useI18n({ useScope: 'global' })
const permissions = computed(() => ({
  sharePool: t('keys.editor.sharePool'),
  shareQuota: t('keys.editor.shareQuota'),
  sharePlans: t('keys.editor.sharePlans'),
}))
</script>

<template>
  <div
    v-if="inline"
    class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-z-border-secondary/40 pt-2.5"
  >
    <div class="flex items-center gap-1.5">
      <span class="text-z-xs font-semibold text-z-text-secondary">
        {{ t('keys.editor.peerSharing') }}
      </span>
      <HelpPopover :label="t('keys.editor.peerSharing')" :content="t('keys.editor.peerSharingHelp')" />
      <ZSwitch
        class="ml-1"
        :model-value="sharing.enabled === true"
        :aria-label="t('keys.editor.peerSharing')"
        :disabled="disabled"
        @update:model-value="emit('change', 'enabled', $event)"
      />
      <span v-if="sharing.enabled === undefined" class="ml-1 text-z-xs text-z-text-secondary">
        {{ t('keys.batch.partiallyEnabled') }}
      </span>
    </div>
    <div v-if="sharing.enabled" class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <ZCheckbox
        v-for="(label, field) in permissions"
        :key="field"
        :model-value="sharing[field] === true"
        :indeterminate="sharing[field] === undefined"
        :label="label"
        :disabled="disabled || (field === 'sharePlans' && !sharing.sharePool)"
        @update:model-value="emit('change', field, $event)"
      />
    </div>
  </div>

  <div v-else class="grid gap-2.5 rounded-z-card border border-z-border-secondary/60 bg-z-fill-quaternary/40 p-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="text-z-sm font-semibold text-z-text">
          {{ t('keys.editor.peerSharing') }}
        </span>
        <HelpPopover :label="t('keys.editor.peerSharing')" :content="t('keys.editor.peerSharingHelp')" />
        <span v-if="sharing.enabled === undefined" class="ml-1 text-z-xs text-z-text-secondary">
          {{ t('keys.batch.partiallyEnabled') }}
        </span>
      </div>
      <ZSwitch
        :model-value="sharing.enabled === true"
        :aria-label="t('keys.editor.peerSharing')"
        :disabled="disabled"
        @update:model-value="emit('change', 'enabled', $event)"
      />
    </div>
    <div
      v-if="sharing.enabled"
      class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-z-border-secondary/40 pt-2.5"
    >
      <ZCheckbox
        v-for="(label, field) in permissions"
        :key="field"
        :model-value="sharing[field] === true"
        :indeterminate="sharing[field] === undefined"
        :label="label"
        :disabled="disabled || (field === 'sharePlans' && !sharing.sharePool)"
        @update:model-value="emit('change', field, $event)"
      />
    </div>
  </div>
</template>
