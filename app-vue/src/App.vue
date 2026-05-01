<template>
  <div id="app">
    <Runner ref="runnerRef" :active-view="activeView" @navigate="onNavigate" />

    <main class="main-content">
      <Servers v-if="activeView === 'servers'" />

      <div v-else-if="activeView === 'http-config'" class="config-view">
        <div class="view-header">
          <h2>HTTP Additional Configuration</h2>
          <Button label="Save" icon="pi pi-save" @click="saveHttpConf" />
        </div>
        <Textarea
          v-model="httpConfText"
          rows="24"
          style="width:100%;font-family:monospace;font-size:0.85rem;resize:vertical"
        />
      </div>

      <Topology v-else-if="activeView === 'topology'" @open-access-logs="runnerRef?.showLog()" />

      <div v-else-if="activeView === 'view-config'" class="config-view">
        <div class="view-header">
          <h2>nginx.conf</h2>
          <Button icon="pi pi-copy" label="Copy" size="small" outlined @click="copyConf" />
        </div>
        <pre class="conf-pre">{{ confContent }}</pre>
      </div>
    </main>

    <ConfirmDialog />
    <Toast position="bottom-right" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Runner from './components/Runner.vue'
import Servers from './components/Servers.vue'
import Topology from './components/Topology.vue'
import { useApi } from './composables/useApi'

const activeView = ref('servers')
const runnerRef = ref(null)

const httpConf = ref({})
const httpConfText = ref('')
const confContent = ref('')

const { apiFetch } = useApi()

async function loadHttpConf() {
  const data = await apiFetch('/api/nginx/http')
  httpConf.value = data && data.length > 0 ? data[0] : {}
  httpConfText.value = httpConf.value.additionnalHttpConf || ''
}

async function saveHttpConf() {
  httpConf.value.additionnalHttpConf = httpConfText.value
  await apiFetch('/api/nginx/http', { method: 'POST', body: httpConf.value })
}

async function loadConf() {
  confContent.value = await apiFetch('/api/nginx/conf')
}

async function copyConf() {
  await navigator.clipboard.writeText(confContent.value)
}

function onNavigate(view) {
  activeView.value = view
}

watch(activeView, (v) => {
  if (v === 'http-config') loadHttpConf()
  if (v === 'view-config') loadConf()
})
</script>

<style>
:root {
  --bg-main: #f8f9fc;
  --bg-surface: #ffffff;
  --bg-surface-alt: #f9fafb;
  --bg-code: #f3f4f6;
  --border: #e5e7eb;
  --text-primary: #111827;
  --text-secondary: #374151;
  --text-muted: #6b7280;
  --text-subtle: #9ca3af;
}

html.dark {
  --bg-main: #0f1117;
  --bg-surface: #1a1c27;
  --bg-surface-alt: #1e2132;
  --bg-code: #252838;
  --border: rgba(255,255,255,0.08);
  --text-primary: #e2e8f0;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  --text-subtle: #64748b;
}

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body { font-family: var(--p-font-family, system-ui, sans-serif); }

#app {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-main);
  min-width: 0;
}

.config-view {
  padding: 1.5rem;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.view-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.p-datatable-table { width: 100%; }

.conf-pre {
  font-family: monospace;
  font-size: 0.82rem;
  white-space: pre;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 1rem;
  overflow: auto;
  max-height: calc(100vh - 100px);
}
</style>
