<template>
  <aside class="sidebar">

    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-icon">
        <i class="pi pi-desktop" />
      </div>
      <div>
        <div class="logo-title">Nginx</div>
        <div class="logo-sub">Configuration GUI</div>
      </div>
    </div>

    <!-- Setup wizard or controls -->
    <NginxSetup v-if="needsSetup" @ready="onBinaryReady" class="sidebar-setup" />
    <template v-else>
      <div class="sidebar-status">
        <span class="status-dot" :class="{ running: isRunning }" />
        <span class="status-text">{{ isRunning ? 'Running' : 'Stopped' }}</span>
      </div>
      <div class="sidebar-btn-wrap">
        <Button
          :label="isRunning ? 'Stop Nginx' : 'Start Nginx'"
          :severity="isRunning ? 'danger' : 'success'"
          :disabled="isLoading"
          outlined
          fluid
          @click="isRunning ? killNginx() : runNginx()"
        />
      </div>
    </template>

    <Divider class="sidebar-divider" />

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <button
        class="nav-item"
        :class="{ active: activeView === 'topology' }"
        @click="$emit('navigate', 'topology')"
      >
        <i class="pi pi-sitemap" />
        <span>Topology</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'servers' }"
        @click="$emit('navigate', 'servers')"
      >
        <i class="pi pi-server" />
        <span>Servers</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'http-config' }"
        @click="$emit('navigate', 'http-config')"
      >
        <i class="pi pi-globe" />
        <span>HTTP Config</span>
      </button>
      <button
        class="nav-item"
        :class="{ active: activeView === 'view-config' }"
        @click="$emit('navigate', 'view-config')"
      >
        <i class="pi pi-eye" />
        <span>View Config</span>
      </button>
    </nav>

    <div class="sidebar-spacer" />

    <!-- Access Logs button -->
    <div class="access-logs-section">
      <button class="access-logs-toggle" @click="showLog">
        <i class="pi pi-chevron-right" style="font-size:0.65rem" />
        <span>Access Logs</span>
        <i class="pi pi-chevron-right" style="font-size:0.65rem;opacity:0.5" />
      </button>
    </div>

  </aside>

  <!-- Access Logs Dialog -->
  <Dialog
    v-model:visible="logDialogOpen"
    header="Access Logs"
    modal
    maximizable
    style="width:90vw"
  >
    <div class="mb-2 log-filter-row">
      <InputText v-model="filter" placeholder="Filter…" style="flex:1" />
      <span class="live-badge" :class="{ connected: liveConnected }">
        <span class="live-dot" />
        {{ liveConnected ? 'Live' : 'Connecting…' }}
      </span>
    </div>
    <DataTable
      :value="filteredLogs"
      size="small"
      scrollable
      scroll-height="60vh"
      style="width:100%"
    >
      <Column field="remote_addr" header="Remote ADDR" />
      <Column field="time_local" header="Time" />
      <Column field="server_name" header="Server" />
      <Column field="correlation_id" header="Correlation ID" />
      <Column field="request" header="Request" />
      <Column field="status" header="Status" style="width:5rem" />
      <Column field="body_bytes_sent" header="Bytes" style="width:6rem" />
      <Column field="proxy_host" header="Proxy host" />
    </DataTable>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import NginxSetup from './NginxSetup.vue'

defineProps({ activeView: String })
defineEmits(['navigate'])

const toast = useToast()

const needsSetup = ref(false)
const isRunning = ref(false)
const isLoading = ref(false)
const accessLogs = ref([])
const logDialogOpen = ref(false)
const filter = ref('')
const liveConnected = ref(false)

let eventSource = null

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

onUnmounted(() => { if (eventSource) eventSource.close() })

const filteredLogs = computed(() => {
  if (!filter.value) return accessLogs.value
  const q = filter.value.toLowerCase()
  return accessLogs.value.filter((row) =>
    Object.values(row).some((v) => String(v).toLowerCase().includes(q))
  )
})

async function apiFetch(url, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const r = await fetch(url, opts)
  if (r.status === 204) return null
  return r.json()
}

async function checkIsRunning() {
  const setup = await apiFetch('/api/nginx/setup')
  needsSetup.value = !setup.found
  if (!needsSetup.value) {
    isRunning.value = await apiFetch('/api/nginx/running')
  }
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
    const isError = data?.status === 'error'
    toast.add({ severity: isError ? 'error' : 'success', summary: 'Nginx', detail, life: 4000 })
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
    const isError = data?.status === 'error'
    toast.add({ severity: isError ? 'error' : 'success', summary: 'Nginx', detail, life: 4000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Nginx', detail: 'Request failed', life: 4000 })
  } finally {
    await checkIsRunning()
    isLoading.value = false
  }
}

async function showLog() {
  const data = await apiFetch('/api/nginx/logs/access')
  let id = 0
  accessLogs.value = data.map((raw) => {
    try { return { ...JSON.parse(raw), id: id++ } } catch { return { id: id++ } }
  })
  logDialogOpen.value = true
}

checkIsRunning()
</script>

<style scoped>
.sidebar {
  width: 210px;
  min-width: 210px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1c27;
  color: #e2e8f0;
  overflow: hidden;
  flex-shrink: 0;
}

/* Logo */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: #22c55e;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.logo-title {
  font-weight: 700;
  font-size: 1rem;
  color: #fff;
  line-height: 1.2;
}

.logo-sub {
  font-size: 0.62rem;
  color: #94a3b8;
  line-height: 1.3;
}

.sidebar-setup { padding: 0.75rem; }

.sidebar-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem 0.25rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #475569;
  flex-shrink: 0;
  transition: background 0.3s;
}

.status-dot.running {
  background: #22c55e;
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
  70%  { box-shadow: 0 0 0 7px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}

.status-text { font-size: 0.85rem; font-weight: 500; }

.sidebar-btn-wrap { padding: 0.4rem 1rem 0.25rem; }

.sidebar-divider {
  margin: 0.25rem 0 !important;
  border-color: rgba(255,255,255,0.07) !important;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #94a3b8;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover { background: #252838; color: #e2e8f0; }
.nav-item.active { background: #252838; color: #fff; }
.nav-item i { font-size: 0.88rem; }

.sidebar-spacer { flex: 1; min-height: 0.5rem; }

.access-logs-section {
  border-top: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}

.access-logs-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.6rem 1rem;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 0.8rem;
  transition: color 0.15s;
}
.access-logs-toggle:hover { color: #94a3b8; }

.mb-2 { margin-bottom: 0.5rem; }

.log-filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  white-space: nowrap;
}

.live-badge.connected { color: #16a34a; }

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9ca3af;
  flex-shrink: 0;
}

.live-badge.connected .live-dot {
  background: #22c55e;
  animation: pulse 1.8s infinite;
}
</style>
