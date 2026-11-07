import type { SelectOption } from '@codex-proxy/ui'
import { computed, shallowRef } from 'vue'
import { getAccounts, getUsageRecordInsightsDiagnostics } from '@/api'

export interface FilterOptionsParams {
  startTime: string
  endTime: string
  provider?: string
}

export function useUsageFilterOptions(scopedParams: () => FilterOptionsParams) {
  const rawAccounts = shallowRef<string[]>([])
  const rawKeys = shallowRef<string[]>([])
  const rawModels = shallowRef<string[]>([])
  const loading = shallowRef(false)

  const accountOptions = computed<SelectOption[]>(() => {
    return rawAccounts.value.map(acc => ({ label: acc, value: acc }))
  })

  const keyOptions = computed<SelectOption[]>(() => {
    return rawKeys.value.map(k => ({ label: k, value: k }))
  })

  const modelOptions = computed<SelectOption[]>(() => {
    return rawModels.value.map(m => ({ label: m, value: m }))
  })

  async function loadFilterOptions() {
    loading.value = true
    try {
      const params = scopedParams()
      const [accRes, diagKeyRes, diagModelRes] = await Promise.allSettled([
        getAccounts({ page: 1, pageSize: 200 }),
        getUsageRecordInsightsDiagnostics({ ...params, dimension: 'apiKey' }),
        getUsageRecordInsightsDiagnostics({ ...params, dimension: 'model' }),
      ])

      // 提取账号：严格以系统当前配置的真实账号为准，避免带入已删除的历史脏账号
      const accountSet = new Set<string>()
      if (accRes.status === 'fulfilled' && accRes.value?.items) {
        for (const acc of accRes.value.items) {
          const name = acc.name?.trim()
          const email = acc.email?.trim()
          // 优先展示有辨识度的名称/邮箱
          const display = name || email
          if (display)
            accountSet.add(display)
        }
      }
      rawAccounts.value = Array.from(accountSet).sort()

      // 提取密钥：仅展示当前选定时间范围内实际产生过请求(requestCount > 0)的活跃密钥
      const keySet = new Set<string>()
      if (diagKeyRes.status === 'fulfilled' && diagKeyRes.value?.items) {
        for (const item of diagKeyRes.value.items) {
          const name = item.name?.trim() || item.key?.trim()
          const count = item.requestCount ?? 0
          if (name && name !== 'unrouted' && count > 0)
            keySet.add(name)
        }
      }
      rawKeys.value = Array.from(keySet).sort()

      // 提取模型：仅展示当前选定时间范围内实际产生过请求(requestCount > 0)的活跃模型
      const modelSet = new Set<string>()
      if (diagModelRes.status === 'fulfilled' && diagModelRes.value?.items) {
        for (const item of diagModelRes.value.items) {
          const key = item.key?.trim() || item.name?.trim()
          const count = item.requestCount ?? 0
          if (key && key !== 'unrouted' && count > 0)
            modelSet.add(key)
        }
      }
      rawModels.value = Array.from(modelSet).sort()
    }
    finally {
      loading.value = false
    }
  }

  return {
    accountOptions,
    keyOptions,
    modelOptions,
    loadingFilterOptions: loading,
    loadFilterOptions,
  }
}
