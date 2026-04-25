<template>
  <div class="runner">
    <Card>
      <template #content>
        <Button
          v-if="!isRunning"
          label="Run Nginx"
          icon="pi pi-play"
          severity="success"
          :disabled="isLoading"
          fluid
          @click="runNginx"
        />
        <Button
          v-else
          label="Kill Nginx"
          icon="pi pi-stop"
          severity="danger"
          :disabled="isLoading"
          fluid
          @click="killNginx"
        />
        <Button
          label="Show Access Log"
          icon="pi pi-list"
          severity="secondary"
          fluid
          class="mt-2"
          @click="showLog"
        />
      </template>
    </Card>

    <Card class="mt-2">
      <template #title>Nginx logs</template>
      <template #content>
        <div class="log-list">
          <pre
            v-for="(entry, idx) in logs"
            :key="idx"
            :class="['log-entry', entry.status]"
          >{{ entry.log }}</pre>
          <span v-if="!logs.length" class="no-logs">No logs yet.</span>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="logDialogOpen"
      header="Access Logs"
      modal
      maximizable
      style="width: 90vw"
    >
      <div class="mb-2">
        <InputText v-model="filter" placeholder="Filter…" fluid />
      </div>
      <DataTable
        :value="filteredLogs"
        size="small"
        scrollable
        scroll-height="60vh"
        :rows="200"
      >
        <Column field="remote_addr" header="Remote ADDR" />
        <Column field="time_local" header="Time" />
        <Column field="request" header="Request" />
        <Column field="status" header="Status" style="width:5rem" />
        <Column field="body_bytes_sent" header="Bytes" style="width:6rem" />
        <Column field="proxy_host" header="Proxy host" />
        <Column field="http_user_agent" header="User agent" />
      </DataTable>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'

const isRunning = ref(false)
const isLoading = ref(false)
const logs = ref([])
const accessLogs = ref([])
const logDialogOpen = ref(false)
const filter = ref('')

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
  isRunning.value = await apiFetch('/api/nginx/running')
}

async function runNginx() {
  isLoading.value = true
  logs.value.push({ log: 'Starting servers…' })
  try {
    const data = await apiFetch('/api/nginx/run', { method: 'POST' })
    logs.value.push(data)
  } catch {
    logs.value.push({ log: 'Request failed', status: 'error' })
  } finally {
    await checkIsRunning()
    isLoading.value = false
  }
}

async function killNginx() {
  isLoading.value = true
  logs.value.push({ log: 'Stopping nginx…' })
  try {
    const data = await apiFetch('/api/nginx/kill', { method: 'POST' })
    if (data) logs.value.push(data)
  } catch {
    logs.value.push({ log: 'Request failed', status: 'error' })
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
.runner { display: flex; flex-direction: column; }
.mt-2 { margin-top: 0.5rem; }
.mb-2 { margin-bottom: 0.5rem; }
.log-list { max-height: 300px; overflow-y: auto; }
.log-entry { margin: 2px 0; font-size: 0.8rem; white-space: pre-wrap; word-break: break-all; }
.log-entry.error { color: #e53935; }
.log-entry.success { color: #2e7d32; }
.no-logs { font-size: 0.85rem; color: #999; }
</style>
