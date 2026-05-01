<template>
  <div class="servers">

    <!-- Toolbar -->
    <div class="toolbar">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search servers..." />
      </IconField>
      <Button label="Add Server" icon="pi pi-plus" severity="success" @click="addServer" />
    </div>

    <!-- Servers table -->
    <DataTable
      :value="filteredServers"
      v-model:expandedRows="expandedRows"
      dataKey="$loki"
      :row-class="serverRowClass"
      style="width:100%"
    >
      <!-- Expander -->
      <Column expander style="width:3rem" />

      <!-- Display Name + location count badge -->
      <Column header="Display Name">
        <template #body="{ data }">
          <span class="editable-link" @click.stop="openEdit($event, data, 'displayName')">
            {{ data.displayName || 'SET VALUE' }}
          </span>
          <Tag
            v-if="data.locations?.length"
            :value="`${data.locations.length} loc`"
            severity="success"
            class="loc-badge"
          />
        </template>
      </Column>

      <!-- Server Names (monospace, truncated) -->
      <Column header="Server Names">
        <template #body="{ data }">
          <code
            class="server-name"
            :title="data.name"
            @click.stop="openEdit($event, data, 'name')"
          >{{ data.name || 'SET VALUE' }}</code>
        </template>
      </Column>

      <!-- Port -->
      <Column header="Port" style="width:6rem;text-align:right">
        <template #body="{ data }">
          <span
            class="port-val"
            :class="{ 'port-enabled': data.enable }"
            @click.stop="openEdit($event, data, 'port')"
          >{{ data.port || '—' }}</span>
        </template>
      </Column>

      <!-- Enabled -->
      <Column header="Enabled" style="width:7rem;text-align:center">
        <template #body="{ data }">
          <ToggleSwitch v-model="data.enable" @change="toggleServer(data)" />
        </template>
      </Column>

      <!-- Actions (hover-reveal) -->
      <Column header="Actions" style="width:8rem">
        <template #body="{ data }">
          <div class="actions-cell">
            <Button
              icon="pi pi-pencil"
              v-tooltip.top="'Extra config'"
              text rounded size="small" severity="warn"
              @click.stop="openAdditionalConf(data)"
            >
            </Button>
            <Button
              icon="pi pi-eye"
              v-tooltip.top="'View conf'"
              text rounded size="small"
              @click.stop="showServerConf(data)"
            />
            <Button
              icon="pi pi-copy"
              v-tooltip.top="'Duplicate'"
              text rounded size="small" severity="secondary"
              @click.stop="duplicateServer(data)"
            />
            <Button
              icon="pi pi-trash"
              v-tooltip.top="'Delete'"
              text rounded size="small" severity="danger"
              @click.stop="removeServer(data)"
            />
          </div>
        </template>
      </Column>

      <!-- Locations expansion -->
      <template #expansion="{ data: server }">
        <div class="location-pane">
          <DataTable
            :value="server.locations"
            dataKey="_id"
            size="small"
            :reorderable-rows="true"
            :row-class="locationRowClass"
            style="width:100%"
            @row-reorder="onRowReorder(server, $event)"
          >
            <template #header>
              <div class="loc-header">
                <span class="loc-header-title">
                  <i class="pi pi-map-marker" style="font-size:0.75rem" />
                  LOCATIONS
                </span>
                <Button
                  label="+ Add location"
                  size="small"
                  outlined
                  severity="success"
                  @click="addLocation(server)"
                />
              </div>
            </template>

            <template #empty>
              <div class="empty-locations">No locations yet — add one above</div>
            </template>

            <!-- Drag handle -->
            <Column row-reorder style="width:2.5rem" />

            <!-- Order # -->
            <Column header="#" style="width:3.5rem">
              <template #body="{ index }">
                <span class="loc-num">#{{ index + 1 }}</span>
              </template>
            </Column>

            <!-- Path (monospace) -->
            <Column header="Path">
              <template #body="{ data: loc }">
                <code
                  class="loc-path"
                  @click.stop="openEdit($event, loc, 'location', server)"
                >{{ loc.location }}</code>
                <Tag v-if="isSsl(loc)" value="SSL" severity="success" class="ssl-badge" />
              </template>
            </Column>

            <!-- Proxy Pass -->
            <Column header="Proxy Pass">
              <template #body="{ data: loc }">
                <span
                  class="proxy-pass"
                  @click.stop="openEdit($event, loc, 'proxyPass', server)"
                >{{ loc.proxyPass || '—' }}</span>
              </template>
            </Column>

            <!-- Port (derived from proxyPass) -->
            <Column header="Port" style="width:5rem">
              <template #body="{ data: loc }">
                <span class="loc-port">{{ getLocPort(loc) }}</span>
              </template>
            </Column>

            <!-- Enabled -->
            <Column header="Enabled" style="width:6rem;text-align:center">
              <template #body="{ data: loc }">
                <ToggleSwitch v-model="loc.enable" @change="toggleLocation(server, loc)" />
              </template>
            </Column>

            <!-- Actions (hover-reveal) -->
            <Column style="width:6rem">
              <template #body="{ data: loc }">
                <div class="actions-cell">
                  <Button
                    icon="pi pi-pencil"
                    v-tooltip.top="'Extra config'"
                    text rounded size="small" severity="warn"
                    @click.stop="openAdditionalConf(server, loc)"
                  />
                  <Button
                    icon="pi pi-copy"
                    v-tooltip.top="'Duplicate'"
                    text rounded size="small" severity="secondary"
                    @click.stop="duplicateLocation(server, loc)"
                  />
                  <Button
                    icon="pi pi-trash"
                    text rounded size="small" severity="danger"
                    @click.stop="removeLocation(server, loc)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </DataTable>

    <!-- Inline edit Popover -->
    <Popover ref="editPopover">
      <div class="edit-popover-content">
        <InputText
          v-model="editValue"
          autofocus
          style="width:260px"
          @keydown.enter="commitEdit"
        />
        <div class="edit-popover-actions">
          <Button label="Save" size="small" @click="commitEdit" />
          <Button label="Cancel" size="small" severity="secondary" @click="editPopover.hide()" />
        </div>
      </div>
    </Popover>

    <!-- Per-server conf viewer -->
    <Dialog
      v-model:visible="confDialogOpen"
      :header="activeServer?.displayName || 'Configuration'"
      modal
      maximizable
      dismissableMask
      style="width:700px"
    >
      <pre class="conf-pre">{{ activeServerConf }}</pre>
    </Dialog>

    <!-- Additional conf editor -->
    <Dialog
      v-model:visible="additionalConfOpen"
      header="Additional Configuration"
      modal
      dismissableMask
      style="width:520px"
      @hide="cancelAdditionalConf"
    >
      <Textarea v-model="tmpAdditionalConf" rows="12" style="width:100%" />
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="cancelAdditionalConf" />
        <Button label="Apply" @click="applyAdditionalConf" />
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'
import Popover from 'primevue/popover'
import Tag from 'primevue/tag'

const confirm = useConfirm()

async function apiFetch(url, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const r = await fetch(url, opts)
  if (r.status === 204) return null
  const ct = r.headers.get('content-type') || ''
  return ct.includes('json') ? r.json() : r.text()
}

const servers = ref([])
const expandedRows = ref({})
const search = ref('')

const filteredServers = computed(() => {
  if (!search.value) return servers.value
  const q = search.value.toLowerCase()
  return servers.value.filter(
    (s) =>
      (s.displayName || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q)
  )
})

const serverRowClass = (data) => (data.enable ? '' : 'row-disabled')
const locationRowClass = (data) => (data.enable ? '' : 'row-disabled')

function getLocPort(loc) {
  if (!loc.proxyPass) return '—'
  try {
    const url = new URL(loc.proxyPass)
    if (url.port) return url.port
    return url.protocol === 'https:' ? '443' : '80'
  } catch {
    return '—'
  }
}

function isSsl(loc) {
  return getLocPort(loc) === '443' || (loc.proxyPass || '').startsWith('https://')
}

// Inline edit popover
const editPopover = ref(null)
const editCtx = ref(null)
const editValue = ref('')

function openEdit(event, obj, field, server = null) {
  editCtx.value = { obj, field, server }
  editValue.value = String(obj[field] ?? '')
  editPopover.value.show(event)
}

function commitEdit() {
  const { obj, field, server } = editCtx.value
  obj[field] = editValue.value
  editPopover.value.hide()
  save()
}

// Per-server conf viewer
const confDialogOpen = ref(false)
const activeServer = ref(null)
const activeServerConf = ref('')

async function showServerConf(server) {
  activeServer.value = server
  activeServerConf.value = await apiFetch('/api/nginx/servers/' + server.$loki + '/conf')
  confDialogOpen.value = true
}

// Additional conf dialog
const additionalConfOpen = ref(false)
const additionalConfCtx = ref(null)
const tmpAdditionalConf = ref('')

function openAdditionalConf(server, location = null) {
  additionalConfCtx.value = { server, location }
  tmpAdditionalConf.value = location ? (location.extraConf || '') : (server.extraConf || '')
  additionalConfOpen.value = true
}

function cancelAdditionalConf() {
  additionalConfOpen.value = false
  additionalConfCtx.value = null
  tmpAdditionalConf.value = ''
}

function applyAdditionalConf() {
  const { server, location } = additionalConfCtx.value
  if (location) {
    location.extraConf = tmpAdditionalConf.value
  } else {
    server.extraConf = tmpAdditionalConf.value
  }
  additionalConfOpen.value = false
  additionalConfCtx.value = null
  save()
}

// Server CRUD
function addServer() {
  servers.value.push({
    displayName: 'New Server',
    name: 'example.com',
    port: '80',
    enable: false,
    extraConf: '',
    locations: []
  })
  save()
}

function duplicateServer(server) {
  const copy = JSON.parse(JSON.stringify(server))
  delete copy.$loki
  delete copy.meta
  copy.displayName = (copy.displayName || copy.name) + ' (copy)'
  copy.enable = false
  copy.locations = copy.locations.map((loc) => ({ ...loc, _id: Date.now() + Math.random() }))
  servers.value.push(copy)
  save()
}

function removeServer(server) {
  if (!server.$loki) return
  confirm.require({
    message: `Delete server "${server.displayName || server.name}"?`,
    header: 'Confirm',
    acceptLabel: 'Yes',
    rejectLabel: 'No',
    accept: () => {
      apiFetch('/api/nginx/servers/' + server.$loki, { method: 'DELETE' }).then(loadServers)
    }
  })
}

function toggleServer(server) {
  if (server.enable) {
    servers.value
      .filter((s) => s.port === server.port && s.$loki !== server.$loki)
      .forEach((s) => (s.enable = false))
  }
  save()
}

// Location CRUD
async function addLocation(server) {
  server.locations.push({
    _id: Date.now() + Math.random(),
    location: '/path',
    proxyPass: 'http://target',
    enable: false,
    extraConf: ''
  })
  await save()
}

async function duplicateLocation(server, loc) {
  const copy = { ...loc, _id: Date.now() + Math.random(), enable: false }
  const idx = server.locations.indexOf(loc)
  server.locations.splice(idx + 1, 0, copy)
  await save()
}

function removeLocation(server, loc) {
  confirm.require({
    message: `Delete location "${loc.location}"?`,
    header: 'Confirm',
    acceptLabel: 'Yes',
    rejectLabel: 'No',
    accept: async () => {
      const idx = server.locations.indexOf(loc)
      if (idx !== -1) server.locations.splice(idx, 1)
      await save()
    }
  })
}

function onRowReorder(server, event) {
  server.locations = event.value
  save()
}

async function toggleLocation(server, location) {
  if (location.enable) {
    console.log("enabling",server.locations)
    server.locations
      .filter((aLocation) => aLocation.location === location.location && aLocation._id !== location._id)
      .forEach((aLocation) => (aLocation.enable = false))
  }
  await save()
}

// API
async function save() {
  servers.value = await apiFetch('/api/nginx/servers', { method: 'POST', body: servers.value })
}

async function loadServers() {
  const data = await apiFetch('/api/nginx/servers')
  data.forEach((s) =>
    s.locations.forEach((l) => { if (!l._id) l._id = Date.now() + Math.random() })
  )
  servers.value = data
}

onMounted(loadServers)
</script>

<style scoped>
.servers {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  gap: 0.75rem;
  flex-shrink: 0;
}

/* Server names */
.server-name {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  display: block;
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.server-name:hover { color: var(--p-primary-color, #6366f1); }

.editable-link {
  color: var(--p-primary-color, #6366f1);
  font-weight: 500;
  cursor: pointer;
}
.editable-link:hover { text-decoration: underline; }

.loc-badge {
  font-size: 0.68rem;
  margin-left: 0.4rem;
  vertical-align: middle;
}

.port-val {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  font-family: monospace;
}
.port-val.port-enabled { color: #16a34a; }

/* Hover-reveal actions */
.actions-cell {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  opacity: 0;
  transition: opacity 0.15s;
}

:deep(.p-datatable-tbody > tr:hover) .actions-cell {
  opacity: 1;
}

/* Disabled rows */
:deep(.row-disabled) {
  opacity: 0.55;
}
.row-disabled .editable-link{
  color: #43423b;
}

/* Location expansion pane */
.location-pane {
  background: var(--bg-surface-alt);
  border-top: 2px solid var(--border);
}

.loc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.loc-header-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  text-transform: uppercase;
}

.loc-num {
  font-size: 0.78rem;
  color: var(--text-subtle);
  font-family: monospace;
}

.loc-path {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
}
.loc-path:hover { color: var(--p-primary-color, #6366f1); }

.ssl-badge {
  font-size: 0.63rem;
  margin-left: 0.35rem;
  vertical-align: middle;
}

.proxy-pass {
  font-size: 0.83rem;
  color: var(--text-secondary);
  cursor: pointer;
  display: block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proxy-pass:hover { color: var(--p-primary-color, #6366f1); }

.loc-port {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.empty-locations {
  text-align: center;
  color: var(--text-subtle);
  padding: 1.5rem;
  font-size: 0.88rem;
}

/* Edit popover */
.edit-popover-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.25rem;
}
.edit-popover-actions { display: flex; gap: 0.5rem; }

/* Conf pre */
.conf-pre {
  font-family: monospace;
  font-size: 0.82rem;
  white-space: pre;
  overflow: auto;
  max-height: 70vh;
  background: var(--bg-code);
  color: var(--text-secondary);
  padding: 0.75rem;
  border-radius: 4px;
}
</style>
