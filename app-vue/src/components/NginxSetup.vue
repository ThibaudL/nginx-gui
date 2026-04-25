<template>
  <Message v-if="platform === 'linux'" severity="warn" :closable="false">
    <p>nginx not found in PATH.</p>
    <p>Install via package manager: <code>sudo apt install nginx</code> or <code>sudo yum install nginx</code></p>
    <p>Then restart nginx-gui.</p>
  </Message>

  <template v-else-if="platform === 'win32'">
    <p class="setup-hint">No nginx binary found. Select a version to download:</p>
    <Select
      v-model="selectedVersion"
      :options="versions"
      optionLabel="label"
      optionValue="version"
      placeholder="Select a version…"
      :loading="loadingVersions"
      class="w-full"
    />
    <Button
      label="Download & Install"
      icon="pi pi-download"
      :disabled="!selectedVersion || downloading"
      :loading="downloading"
      class="mt-2 w-full"
      fluid
      @click="download"
    />
    <ProgressBar v-if="downloading" mode="indeterminate" class="mt-2" />
    <Message v-if="errorMsg" severity="error" class="mt-2" :closable="false">{{ errorMsg }}</Message>
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'

const emit = defineEmits(['ready'])

const platform = ref(null)
const versions = ref([])
const selectedVersion = ref(null)
const loadingVersions = ref(false)
const downloading = ref(false)
const errorMsg = ref(null)

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

onMounted(async () => {
  const setup = await apiFetch('/api/nginx/setup')
  platform.value = setup.platform
  if (!setup.found && setup.platform === 'win32') {
    loadingVersions.value = true
    try {
      const list = await apiFetch('/api/nginx/versions')
      versions.value = list.map(v => ({
        ...v,
        label: `nginx ${v.version} (${v.stable ? 'Stable' : 'Mainline'})`
      }))
    } catch (e) {
      errorMsg.value = 'Could not fetch version list: ' + e.message
    } finally {
      loadingVersions.value = false
    }
  }
})

async function download() {
  downloading.value = true
  errorMsg.value = null
  try {
    await apiFetch('/api/nginx/download', {
      method: 'POST',
      body: JSON.stringify({ version: selectedVersion.value })
    })
    emit('ready')
  } catch (e) {
    errorMsg.value = 'Download failed: ' + e.message
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.setup-hint { margin: 0 0 0.5rem; font-size: 0.9rem; }
</style>
