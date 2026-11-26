import type { Ref } from 'vue'
import type { ApiKey } from '@/api'
import { shallowRef, watch } from 'vue'
import { deleteApiKey, disableApiKey, enableApiKey } from '@/api'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useIdSet } from '@/composables/useIdSet'
import { t } from '@/i18n'
import { notification as ZNotification } from '@/plugins/notification'

export function useApiKeyMutations(options: {
  selectedIds: Ref<Set<string>>
  reload: () => Promise<unknown>
  setKeysEnabled: (ids: Iterable<string>, enabled: boolean) => void
}) {
  const showDeleteModal = shallowRef(false)
  const showSingleDeleteModal = shallowRef(false)
  const pendingDeleteKey = shallowRef<ApiKey | null>(null)
  const deleteCount = shallowRef(0)
  const deletingKeyAction = useAsyncAction()
  const batchDeletingAction = useAsyncAction()
  const batchTogglingAction = useAsyncAction()
  const updatingStatusKeys = useIdSet<string>()
  const deletingKey = deletingKeyAction.loading
  const batchDeleting = batchDeletingAction.loading
  const batchToggling = batchTogglingAction.loading
  const updatingStatusKeyIds = updatingStatusKeys.ids

  watch([showDeleteModal, batchDeleting], ([open, busy]) => {
    if (open && !busy)
      deleteCount.value = options.selectedIds.value.size
  })

  function requestDeleteKey(key: ApiKey) {
    pendingDeleteKey.value = key
    showSingleDeleteModal.value = true
  }

  async function handleDelete() {
    if (deletingKey.value)
      return
    const keyId = pendingDeleteKey.value?.id
    if (!keyId)
      return

    await deletingKeyAction.run(
      async () => {
        await deleteApiKey({ id: keyId })
        const remaining = new Set(options.selectedIds.value)
        remaining.delete(keyId)
        options.selectedIds.value = remaining
        showSingleDeleteModal.value = false
        await options.reload()
        ZNotification.success({
          message: t('common.feedback.deleted'),
        })
      },
      {
        onError: () => void options.reload(),
      },
    )
  }

  async function handleBatchDelete() {
    if (batchDeleting.value || options.selectedIds.value.size === 0)
      return

    await batchDeletingAction.run(
      async () => {
        const deleteCount = options.selectedIds.value.size
        for (const keyId of [...options.selectedIds.value]) {
          await deleteApiKey({ id: keyId })
          const remaining = new Set(options.selectedIds.value)
          remaining.delete(keyId)
          options.selectedIds.value = remaining
        }
        showDeleteModal.value = false
        await options.reload()
        ZNotification.success({
          message: t('keys.actions.deletedApiKeyDeletedApiKeys', { count: deleteCount }),
        })
      },
      {
        onError: () => void options.reload(),
      },
    )
  }

  async function handleToggleStatus(key: ApiKey) {
    await updatingStatusKeys.run(key.id, async () => {
      try {
        const nextEnabled = !key.enabled
        const mutation = nextEnabled ? enableApiKey : disableApiKey
        await mutation({ id: key.id })
        options.setKeysEnabled([key.id], nextEnabled)
        ZNotification.success({
          message: nextEnabled
            ? t('common.status.enabled')
            : t('common.status.disabled'),
        })
      }
      catch {
        void options.reload()
      }
    })
  }

  async function handleBatchToggleStatus(enabled: boolean) {
    if (batchToggling.value || options.selectedIds.value.size === 0)
      return

    await batchTogglingAction.run(
      async () => {
        const targetIds = [...options.selectedIds.value]
        const mutation = enabled ? enableApiKey : disableApiKey
        for (const keyId of targetIds) {
          await mutation({ id: keyId })
        }
        options.setKeysEnabled(targetIds, enabled)
        ZNotification.success({
          message: enabled
            ? t('common.status.enabled')
            : t('common.status.disabled'),
        })
      },
      {
        onError: () => void options.reload(),
      },
    )
  }

  return {
    showDeleteModal,
    showSingleDeleteModal,
    pendingDeleteKey,
    deleteCount,
    deletingKey,
    batchDeleting,
    batchToggling,
    updatingStatusKeyIds,
    requestDeleteKey,
    handleDelete,
    handleBatchDelete,
    handleToggleStatus,
    handleBatchToggleStatus,
  }
}
