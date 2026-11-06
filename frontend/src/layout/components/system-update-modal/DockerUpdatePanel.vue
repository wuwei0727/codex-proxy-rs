<script setup lang="ts">
import type { SystemUpdateDetail, SystemVersion } from '@/api'
import { ZMarkdown, ZSkeleton } from '@codex-proxy/ui'
import { ExternalLink } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  detail: SystemUpdateDetail | null
  version: SystemVersion | null
  loading: boolean
  error: string
}>()
const { t } = useI18n({ useScope: 'global' })
const docker = computed(() => props.detail?.docker)
const currentSha = computed(() => docker.value?.currentSha || props.version?.gitSha || '—')
const state = computed(() => props.error || props.detail?.warning
  ? 'unknown'
  : docker.value?.status ?? 'unknown')
</script>

<template>
  <div class="grid gap-3.5">
    <section class="grid gap-3 rounded-z-card bg-z-fill-quaternary p-4">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="m-0 text-lg font-heavy text-z-text">
          {{ t('systemUpdate.docker.mine') }}
        </h3>
        <span class="rounded-full px-2.5 py-1 text-z-xs font-bold" :class="state === 'available' ? 'bg-z-success-container text-z-success-on-container' : 'bg-z-fill-tertiary text-z-text-secondary'">
          {{ loading ? t('systemUpdate.status.checkingVersion') : t(`systemUpdate.docker.states.${state}`) }}
        </span>
      </header>
      <a v-if="docker?.repository" :href="`https://github.com/${docker.repository}`" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 break-all text-z-sm text-z-link hover:text-z-link-hover">
        {{ docker.repository }}<ExternalLink class="size-3 shrink-0" />
      </a>
      <div class="grid gap-2 sm:grid-cols-3">
        <div class="rounded-z bg-z-bg-container p-3">
          <p class="m-0 text-z-xs text-z-text-secondary">
            {{ t('systemUpdate.docker.running') }}
          </p>
          <p class="mt-2 mb-0 font-mono text-z-sm text-z-text">
            {{ version?.version ?? detail?.currentVersion ?? '—' }}
          </p>
          <p class="mt-1 mb-0 font-mono text-z-xs text-z-text-secondary" :title="currentSha">
            {{ currentSha.slice(0, 12) }}
          </p>
        </div>
        <div class="rounded-z bg-z-bg-container p-3">
          <p class="m-0 text-z-xs text-z-text-secondary">
            {{ t('systemUpdate.docker.latestBuild') }}
          </p>
          <ZSkeleton v-if="loading" class="mt-2 h-4 w-24" />
          <a v-else-if="docker?.latestSha && docker.buildUrl" :href="docker.buildUrl" target="_blank" rel="noreferrer" class="mt-2 inline-flex items-center gap-1 font-mono text-z-sm text-z-link" :title="docker.latestSha">
            {{ docker.latestSha.slice(0, 12) }}<ExternalLink class="size-3" />
          </a>
          <p v-else class="mt-2 mb-0 text-z-sm text-z-text">
            —
          </p>
        </div>
        <div class="rounded-z bg-z-bg-container p-3">
          <p class="m-0 text-z-xs text-z-text-secondary">
            {{ t('systemUpdate.docker.channel') }}
          </p>
          <p class="mt-2 mb-0 font-mono text-z-sm text-z-text">
            main · latest
          </p>
        </div>
      </div>
      <p v-if="error || detail?.warning" class="m-0 text-z-sm text-z-error-text">
        {{ error || detail?.warning }}
      </p>
      <p class="m-0 text-z-sm leading-relaxed text-z-text-secondary">
        {{ t('systemUpdate.docker.help') }}
      </p>
      <code class="rounded-z bg-z-bg-container px-3 py-2 text-z-sm text-z-text">cpr update</code>
    </section>
    <section class="grid gap-3 rounded-z-card bg-z-fill-quaternary p-4">
      <header class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="m-0 text-z font-heavy text-z-text">
          {{ t('systemUpdate.docker.upstream') }}
        </h3>
        <span class="font-mono text-z-sm text-z-text">{{ docker?.upstreamVersion ?? '—' }}</span>
      </header>
      <div class="flex flex-wrap gap-4 text-z-sm">
        <a href="https://github.com/zyycn/codex-proxy-rs" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-z-link hover:text-z-link-hover">
          {{ t('systemUpdate.docker.home') }}<ExternalLink class="size-3" />
        </a>
        <a href="https://github.com/zyycn/codex-proxy-rs/releases/latest" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-z-link hover:text-z-link-hover">
          {{ t('systemUpdate.releasePage') }}<ExternalLink class="size-3" />
        </a>
      </div>
      <p class="m-0 text-z-sm text-z-text-secondary">
        {{ t('systemUpdate.docker.upstreamHelp') }}
      </p>
      <p v-if="docker?.upstreamWarning" class="m-0 text-z-sm text-z-error-text">
        {{ docker.upstreamWarning }}
      </p>
      <div v-if="docker?.upstreamNotes" class="max-h-48 overflow-auto">
        <ZMarkdown :source="docker.upstreamNotes" />
      </div>
    </section>
  </div>
</template>
