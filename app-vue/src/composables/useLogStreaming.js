import { ref, computed, watch, onUnmounted } from 'vue'
import { useApi } from './useApi'

export function useLogStreaming() {
  const { apiFetch } = useApi()

  const accessLogs = ref([])
  const logDialogOpen = ref(false)
  const filter = ref('')
  const liveConnected = ref(false)

  const errorLogs = ref([])
  const errorLogDialogOpen = ref(false)
  const errorFilter = ref('')
  const errorLiveConnected = ref(false)

  let eventSource = null
  let errorEventSource = null

  watch(logDialogOpen, (open) => {
    if (open) {
      eventSource = new EventSource('/api/nginx/logs/access/stream')
      eventSource.onopen = () => { liveConnected.value = true }
      eventSource.onmessage = (e) => {
        try {
          const entry = { ...JSON.parse(e.data), id: Date.now() + Math.random() }
          accessLogs.value.unshift(entry)
          if (accessLogs.value.length > 1000) accessLogs.value.length = 1000
        } catch {}
      }
      eventSource.onerror = () => { liveConnected.value = false }
    } else {
      if (eventSource) { eventSource.close(); eventSource = null }
      liveConnected.value = false
    }
  })

  watch(errorLogDialogOpen, (open) => {
    if (open) {
      errorEventSource = new EventSource('/api/nginx/logs/error/stream')
      errorEventSource.onopen = () => { errorLiveConnected.value = true }
      errorEventSource.onmessage = (e) => {
        errorLogs.value.unshift({ text: e.data, id: Date.now() + Math.random() })
        if (errorLogs.value.length > 1000) errorLogs.value.length = 1000
      }
      errorEventSource.onerror = () => { errorLiveConnected.value = false }
    } else {
      if (errorEventSource) { errorEventSource.close(); errorEventSource = null }
      errorLiveConnected.value = false
    }
  })

  onUnmounted(() => {
    if (eventSource) eventSource.close()
    if (errorEventSource) errorEventSource.close()
  })

  const filteredLogs = computed(() => {
    if (!filter.value) return accessLogs.value
    const q = filter.value.toLowerCase()
    return accessLogs.value.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q))
    )
  })

  const filteredErrorLogs = computed(() => {
    if (!errorFilter.value) return errorLogs.value
    const q = errorFilter.value.toLowerCase()
    return errorLogs.value.filter((row) => row.text.toLowerCase().includes(q))
  })

  function clearLogs() { accessLogs.value = [] }
  function clearErrorLogs() { errorLogs.value = [] }

  async function showLog() {
    const data = await apiFetch('/api/nginx/logs/access')
    let id = 0
    accessLogs.value = data.map((raw) => {
      try { return { ...JSON.parse(raw), id: id++ } } catch { return { id: id++ } }
    })
    logDialogOpen.value = true
  }

  async function showErrorLog() {
    const data = await apiFetch('/api/nginx/logs/error')
    let id = 0
    errorLogs.value = data.map((raw) => ({ text: raw, id: id++ }))
    errorLogDialogOpen.value = true
  }

  return {
    accessLogs,
    logDialogOpen,
    filter,
    liveConnected,
    filteredLogs,
    errorLogs,
    errorLogDialogOpen,
    errorFilter,
    errorLiveConnected,
    filteredErrorLogs,
    clearLogs,
    clearErrorLogs,
    showLog,
    showErrorLog,
  }
}
