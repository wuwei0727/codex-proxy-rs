import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

export type AccountDisplayMode = 'masked' | 'full'

const accountDisplayMode = useStorage<AccountDisplayMode>(
  'codex-proxy:usage-account-display-mode',
  'full',
)

export function useAccountDisplayMode() {
  const isMasked = computed(() => accountDisplayMode.value === 'masked')
  const isFull = computed(() => accountDisplayMode.value === 'full')

  function toggle() {
    accountDisplayMode.value = accountDisplayMode.value === 'masked' ? 'full' : 'masked'
  }

  function setMode(mode: AccountDisplayMode) {
    accountDisplayMode.value = mode
  }

  return {
    accountDisplayMode,
    isMasked,
    isFull,
    toggle,
    setMode,
  }
}
