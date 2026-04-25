<template>
  <div class="servers">
    <!-- Action bar -->
    <div class="action-bar">
      <Button label="Add server" icon="pi pi-plus" severity="success" @click="addServer" />
      <Button label="View config" icon="pi pi-eye" @click="showFullConfFile" />
      <Button label="HTTP config" icon="pi pi-pencil" severity="warn" @click="openHttpConfDialog" />
    </div>

    <!-- Server table -->
    <DataTable
      :value="servers"
      v-model:expandedRows="expandedRows"
      dataKey="$loki"
      class="server-table"
    >
      <Column expander style="width:3rem" />

      <Column header="Display name" class="text-left">
        <template #body="{ data }">
          <span class="editable-link" @click.stop="openEdit($event, data, 'displayName')">
            {{ data.displayName || 'SET VALUE' }}
          </span>
        </template>
      </Column>

      <Column header="Name" class="text-left">
        <template #body="{ data }">
          <span class="editable-link" @click.stop="openEdit($event, data, 'name')">
            {{ data.name || 'SET VALUE' }}
          </span>
        </template>
      </Column>

      <Column header="Port" style="width:8rem;text-align:center">
        <template #body="{ data }">
          <span class="editable-link" @click.stop="openEdit($event, data, 'port')">
            {{ data.port || 'SET VALUE' }}
          </span>
        </template>
      </Column>

      <Column header="Enabled" style="width:6rem;text-align:center">
        <template #body="{ data }">
          <ToggleSwitch v-model="data.enable" @change="toggleServer(data)" />
        </template>
      </Column>

      <Column header="Addtl. conf" style="width:7rem;text-align:center">
        <template #body="{ data }">
          <Button icon="pi pi-pencil" outlined rounded severity="warn" size="small" @click.stop="openAdditionalConf(data)" />
        </template>
      </Column>

      <Column header="Conf" style="width:5rem;text-align:center">
        <template #body="{ data }">
          <Button icon="pi pi-eye" outlined rounded size="small" @click.stop="showServerConf(data)" />
        </template>
      </Column>

      <Column style="width:5rem;text-align:center">
        <template #body="{ data }">
          <Button icon="pi pi-trash" outlined rounded severity="danger" size="small" @click.stop="removeServer(data)" />
        </template>
      </Column>

      <!-- Locations expansion -->
      <template #expansion="{ data: server }">
        <div class="location-pane">
          <DataTable :value="server.locations" dataKey="_id" size="small">
            <template #header>
              <div style="display:flex;justify-content:flex-end">
                <Button
                  label="Add location"
                  icon="pi pi-plus"
                  size="small"
                  outlined
                  severity="success"
                  @click="addLocation(server)"
                />
              </div>
            </template>

            <Column header="Order" style="width:6rem;text-align:center">
              <template #body="{ data: loc }">
                <Button
                  v-if="server.locations.indexOf(loc) > 0"
                  icon="pi pi-chevron-up"
                  text
                  rounded
                  size="small"
                  @click="moveLocation(server, loc, -1)"
                />
                <Button
                  v-if="server.locations.indexOf(loc) < server.locations.length - 1"
                  icon="pi pi-chevron-down"
                  text
                  rounded
                  size="small"
                  @click="moveLocation(server, loc, 1)"
                />
              </template>
            </Column>

            <Column header="Location">
              <template #body="{ data: loc }">
                <span class="editable-link" @click.stop="openEdit($event, loc, 'location', server)">
                  {{ loc.location }}
                </span>
              </template>
            </Column>

            <Column header="Proxy pass">
              <template #body="{ data: loc }">
                <span class="editable-link" @click.stop="openEdit($event, loc, 'proxyPass', server)">
                  {{ loc.proxyPass }}
                </span>
              </template>
            </Column>

            <Column header="Enabled" style="width:6rem;text-align:center">
              <template #body="{ data: loc }">
                <ToggleSwitch v-model="loc.enable" @change="toggleLocation(server, loc)" />
              </template>
            </Column>

            <Column header="Addtl. conf" style="width:7rem;text-align:center">
              <template #body="{ data: loc }">
                <Button
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  severity="warn"
                  @click.stop="openAdditionalConf(server, loc)"
                />
              </template>
            </Column>

            <Column style="width:5rem;text-align:center">
              <template #body="{ data: loc }">
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  @click.stop="removeLocation(server, loc)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </DataTable>

    <!-- Shared inline edit Popover -->
    <Popover ref="editPopover">
      <div class="edit-popover-content">
        <InputText
          v-model="editValue"
          autofocus
          style="width:250px"
          @keydown.enter="commitEdit"
        />
        <div class="edit-popover-actions">
          <Button label="Save" size="small" @click="commitEdit" />
          <Button label="Cancel" size="small" severity="secondary" @click="editPopover.hide()" />
        </div>
      </div>
    </Popover>

    <!-- Config viewer -->
    <Dialog
      v-model:visible="confDialogOpen"
      :header="activeServer ? activeServer.displayName : 'Configuration File'"
      modal
      maximizable
      style="width:700px"
    >
      <pre class="conf-pre">{{ activeServer ? activeServer.conf : confFileContent }}</pre>
    </Dialog>

    <!-- Additional conf editor (server or location) -->
    <Dialog
      v-model:visible="additionalConfOpen"
      header="Additional Configuration"
      modal
      maximizable
      style="width:520px"
      @hide="cancelAdditionalConf"
    >
      <Textarea v-model="tmpAdditionalConf" rows="12" style="width:100%" />
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="cancelAdditionalConf" />
        <Button label="Apply" @click="applyAdditionalConf" />
      </template>
    </Dialog>

    <!-- HTTP additional conf editor -->
    <Dialog
      v-model:visible="httpConfOpen"
      header="HTTP Additional Configuration"
      modal
      maximizable
      style="width:520px"
      @hide="cancelHttpConf"
    >
      <Textarea v-model="tmpHttpConf" rows="12" style="width:100%" />
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="cancelHttpConf" />
        <Button label="Apply" @click="applyHttpConf" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'
import Popover from 'primevue/popover'
import EditServerCommon from '../../../app-common/EditServerCommon'

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
const httpConf = ref({})
const expandedRows = ref({})

// --- Inline edit popover ---
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
  const target = server || obj
  target.conf = EditServerCommon.sample(target)
  save()
}

// --- Config viewer dialog ---
const confDialogOpen = ref(false)
const activeServer = ref(null)
const confFileContent = ref('')

function showServerConf(server) {
  activeServer.value = server
  confFileContent.value = ''
  confDialogOpen.value = true
}

async function showFullConfFile() {
  confFileContent.value = await apiFetch('/api/nginx/conf')
  activeServer.value = null
  confDialogOpen.value = true
}

// --- Additional conf dialog ---
const additionalConfOpen = ref(false)
const additionalConfCtx = ref(null) // { server, location? }
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
  server.conf = EditServerCommon.sample(server)
  additionalConfOpen.value = false
  additionalConfCtx.value = null
  save()
}

// --- HTTP conf dialog ---
const httpConfOpen = ref(false)
const tmpHttpConf = ref('')

function openHttpConfDialog() {
  tmpHttpConf.value = httpConf.value.additionnalHttpConf || ''
  httpConfOpen.value = true
}

function cancelHttpConf() {
  httpConfOpen.value = false
  tmpHttpConf.value = ''
}

function applyHttpConf() {
  httpConf.value.additionnalHttpConf = tmpHttpConf.value
  apiFetch('/api/nginx/http', { method: 'POST', body: httpConf.value })
  httpConfOpen.value = false
}

// --- Server CRUD ---
function addServer() {
  servers.value.push({ locations: [] })
  save()
}

function removeServer(server) {
  if (!server.$loki) return
  confirm.require({
    message: `Delete server "${server.displayName || server.name}"?`,
    header: 'Confirm',
    acceptLabel: 'Yes',
    rejectLabel: 'No',
    rejectProps: { severity: 'danger' },
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

// --- Location CRUD ---
async function addLocation(server) {
  server.locations.push({ _id: Date.now() + Math.random(), location: '/path', proxyPass: 'http://target', enable: false })
  server.conf = EditServerCommon.sample(server)
  await save()
}

function removeLocation(server, loc) {
  confirm.require({
    message: `Delete location "${loc.location}"?`,
    header: 'Confirm',
    acceptLabel: 'Yes',
    rejectLabel: 'No',
    rejectProps: { severity: 'danger' },
    accept: async () => {
      const idx = server.locations.indexOf(loc)
      if (idx !== -1) server.locations.splice(idx, 1)
      server.conf = EditServerCommon.sample(server)
      await save()
    }
  })
}

async function moveLocation(server, loc, direction) {
  const arr = server.locations
  const index = arr.indexOf(loc)
  const newIndex = index + direction
  arr.splice(newIndex, 0, arr.splice(index, 1)[0])
  server.conf = EditServerCommon.sample(server)
  await save()
}

async function toggleLocation(server, location) {
  if (location.enable) {
    server.locations
      .filter((l) => l.location === location.location && l.proxyPass !== location.proxyPass)
      .forEach((l) => (l.enable = false))
  }
  server.conf = EditServerCommon.sample(server)
  await save()
}

// --- API ---
async function save() {
  servers.value = await apiFetch('/api/nginx/servers', { method: 'POST', body: servers.value })
}

async function loadServers() {
  const data = await apiFetch('/api/nginx/servers')
  data.forEach((s) => s.locations.forEach((l) => { if (!l._id) l._id = Date.now() + Math.random() }))
  servers.value = data
}

async function loadHttpConf() {
  const data = await apiFetch('/api/nginx/http')
  httpConf.value = data && data.length > 0 ? data[0] : {}
}

onMounted(() => {
  loadServers()
  loadHttpConf()
})
</script>

<style scoped>
.servers { padding: 0.5rem; }

.action-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.editable-link {
  color: var(--p-primary-color, #6366f1);
  font-weight: 500;
  cursor: pointer;
  border-bottom: 1px solid currentColor;
  white-space: nowrap;
}
.editable-link:hover { opacity: 0.75; }

.location-pane {
  background: rgba(99, 102, 241, 0.05);
  padding: 0.75rem 1rem;
}

.edit-popover-content { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.25rem; }
.edit-popover-actions { display: flex; gap: 0.5rem; }

.conf-pre {
  font-family: monospace;
  font-size: 0.82rem;
  white-space: pre;
  overflow: auto;
  max-height: 70vh;
  background: var(--p-surface-100, #f3f4f6);
  padding: 0.75rem;
  border-radius: 4px;
}
</style>
