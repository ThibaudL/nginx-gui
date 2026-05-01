import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useApi } from './useApi'

export function useNginxControl() {
  const toast = useToast()
  const { apiFetch } = useApi()

  const needsSetup = ref(false)
  const isRunning = ref(false)
  const isLoading = ref(false)
  const isValidating = ref(false)
  const autoStartOnStartup = ref(false)

  async function checkIsRunning() {
    const setup = await apiFetch('/api/nginx/setup')
    needsSetup.value = !setup.found
    if (!needsSetup.value) {
      isRunning.value = await apiFetch('/api/nginx/running')
    }
  }

  async function loadSettings() {
    const data = await apiFetch('/api/nginx/settings')
    autoStartOnStartup.value = !!data?.autoStartOnStartup
  }

  async function saveAutoStart() {
    await apiFetch('/api/nginx/settings', { method: 'POST', body: { autoStartOnStartup: autoStartOnStartup.value } })
  }

  async function onBinaryReady() {
    needsSetup.value = false
    isRunning.value = await apiFetch('/api/nginx/running')
  }

  async function runNginx() {
    isLoading.value = true
    toast.add({ severity: 'info', summary: 'Nginx', detail: 'Starting…', life: 3000 })
    try {
      const data = await apiFetch('/api/nginx/run', { method: 'POST' })
      const detail = data?.log || 'Started'
      toast.add({ severity: data?.status === 'error' ? 'error' : 'success', summary: 'Nginx', detail, life: 4000 })
    } catch {
      toast.add({ severity: 'error', summary: 'Nginx', detail: 'Request failed', life: 4000 })
    } finally {
      await checkIsRunning()
      isLoading.value = false
    }
  }

  async function killNginx() {
    isLoading.value = true
    toast.add({ severity: 'info', summary: 'Nginx', detail: 'Stopping…', life: 3000 })
    try {
      const data = await apiFetch('/api/nginx/kill', { method: 'POST' })
      const detail = data?.log || 'Stopped'
      toast.add({ severity: data?.status === 'error' ? 'error' : 'success', summary: 'Nginx', detail, life: 4000 })
    } catch {
      toast.add({ severity: 'error', summary: 'Nginx', detail: 'Request failed', life: 4000 })
    } finally {
      await checkIsRunning()
      isLoading.value = false
    }
  }

  async function restartNginx() {
    isLoading.value = true
    toast.add({ severity: 'info', summary: 'Nginx', detail: 'Restarting…', life: 3000 })
    try {
      const data = await apiFetch('/api/nginx/restart', { method: 'POST' })
      const detail = data?.log || 'Restarted'
      toast.add({ severity: data?.status === 'error' ? 'error' : 'success', summary: 'Nginx', detail, life: 4000 })
    } catch {
      toast.add({ severity: 'error', summary: 'Nginx', detail: 'Request failed', life: 4000 })
    } finally {
      await checkIsRunning()
      isLoading.value = false
    }
  }

  async function testConfig() {
    isValidating.value = true
    try {
      const data = await apiFetch('/api/nginx/validate', { method: 'POST' })
      if (data?.valid) {
        toast.add({ severity: 'success', summary: 'Config OK', detail: data.output || 'nginx -t passed', life: 4000 })
      } else {
        toast.add({ severity: 'error', summary: 'Config invalid', detail: data?.error || 'Validation failed', life: 8000 })
      }
    } catch {
      toast.add({ severity: 'error', summary: 'Config test', detail: 'Request failed', life: 4000 })
    } finally {
      isValidating.value = false
    }
  }

  return {
    needsSetup,
    isRunning,
    isLoading,
    isValidating,
    autoStartOnStartup,
    checkIsRunning,
    loadSettings,
    saveAutoStart,
    onBinaryReady,
    runNginx,
    killNginx,
    restartNginx,
    testConfig,
  }
}
