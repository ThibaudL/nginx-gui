<template>
  <div class="topology-wrap">
    <div class="topology-toolbar">
      <span class="topology-title">Topology</span>
      <div class="legend">
        <span class="legend-item">
          <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 3" /></svg>
          Config link
        </span>
        <span class="legend-item">
          <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#6366f1" stroke-width="2" /></svg>
          Observed traffic
        </span>
        <span class="legend-item">
          <svg width="16" height="16"><circle cx="8" cy="8" r="5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" /></svg>
          Live request
        </span>
      </div>
      <span class="sse-counter" :class="{ active: sseEvents > 0 }">
        {{ sseEvents }} events · {{ dotCount }} dots
      </span>
      <span class="log-disclaimer">Traffic is built from <code class="log-path-link" @click="logPathPopover.toggle($event)">access.log</code> — clear the file to reset</span>
      <Popover ref="logPathPopover">
        <div class="log-path-popover">
          <span class="log-path-label">Access log path</span>
          <div class="log-path-row">
            <code class="log-path-value">{{ accessLogPath }}</code>
            <button class="log-path-copy" @click="copyLogPath" :title="copied ? 'Copied!' : 'Copy'">
              <i :class="copied ? 'pi pi-check' : 'pi pi-copy'" />
            </button>
          </div>
        </div>
      </Popover>
      <Button icon="pi pi-list" label="Access Logs" size="small" outlined @click="emit('open-access-logs')" />
      <Button icon="pi pi-refresh" label="Refresh" size="small" outlined @click="load" :disabled="loading" />
    </div>

    <div v-if="loading" class="topology-state">Loading…</div>
    <div v-else-if="empty" class="topology-state">No servers configured yet.</div>
    <svg v-else ref="svgEl" class="topology-svg">
      <defs>
        <marker id="arrow-config" markerWidth="7" markerHeight="7" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#94a3b8" />
        </marker>
        <marker id="arrow-log" markerWidth="7" markerHeight="7" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#6366f1" />
        </marker>
      </defs>
    </svg>

    <!-- Paths modal -->
    <Dialog v-model:visible="modalOpen" :header="modalTitle" modal dismissableMask style="width:360px">
      <ul class="path-list">
        <li v-for="p in modalPaths" :key="p">
          <code>{{ p }}</code>
        </li>
      </ul>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Popover from 'primevue/popover'
import { useTheme } from '../composables/useTheme'
import { useApi } from '../composables/useApi'

const emit = defineEmits(['open-access-logs'])
const { isDark } = useTheme()
const { apiFetch } = useApi()

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const logPathPopover = ref(null)
const accessLogPath  = ref('')
const copied         = ref(false)

async function copyLogPath() {
  await navigator.clipboard.writeText(accessLogPath.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

const svgEl   = ref(null)
const loading = ref(false)
const empty   = ref(false)
const modalOpen  = ref(false)
const modalTitle = ref('')
const modalPaths = ref([])
const sseEvents = ref(0)
const dotCount  = ref(0)

// Component-scope state shared between renderGraph and animateDot
let simulation   = null
let graphNodes   = []   // D3 mutates x/y on these directly
let graphServers = []
let dotsLayer    = null

// Per correlation_id: buffer hops for a short window, then reverse & play
// (nginx logs downstream first, so entries arrive in reverse chain order)
const pendingDots = new Map()

// Persistent color mapping: same correlation_id → same color across hops
const correlationColors = new Map()
const palette = d3.schemeTableau10
let paletteIdx = 0
function colorFor(correlationId) {
  if (!correlationId) return palette[0]
  if (!correlationColors.has(correlationId)) {
    correlationColors.set(correlationId, palette[paletteIdx % palette.length])
    paletteIdx++
    // Evict when map grows large to avoid memory leak
    if (correlationColors.size > 500) {
      correlationColors.delete(correlationColors.keys().next().value)
    }
  }
  return correlationColors.get(correlationId)
}

// Returns true if a server's name list (space-separated) + port matches a "host" or "host:port" string
function serverMatchesHost(s, raw) {
  const h = raw.includes(':') ? raw.split(':')[0] : raw
  const p = raw.includes(':') ? raw.split(':')[1] : null
  if (p && s.port !== p) return false
  return (s.name || '').split(/\s+/).filter(Boolean).some(n => n === h)
}

// Resolve a "host" or "host:port" string to an existing node id (read-only, no creation)
function findNodeId(host) {
  if (!host || host === '-') return null
  const serverMatch = graphServers.find(s => serverMatchesHost(s, host))
  if (serverMatch) return `server:${serverMatch.$loki}`
  const id = `host:${host}`
  return graphNodes.find(n => n.id === id) ? id : null
}

function launchDot(fromId, toId, color) {
  return new Promise(resolve => {
    // Re-lookup at launch time: positions are current, and handles graph refresh
    if (!dotsLayer) return resolve()
    const fromNode = graphNodes.find(n => n.id === fromId)
    const toNode   = graphNodes.find(n => n.id === toId)
    if (!fromNode || !toNode) return resolve()

    const x0 = fromNode.x, y0 = fromNode.y
    const x1 = toNode.x,   y1 = toNode.y

    dotCount.value++
    dotsLayer.append('circle')
      .attr('r', 5)
      .attr('fill', color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.92)
      .attr('pointer-events', 'none')
      .attr('cx', x0).attr('cy', y0)
      .transition().duration(1400).ease(d3.easeLinear)
        .attrTween('cx', () => t => x0 + t * (x1 - x0))
        .attrTween('cy', () => t => y0 + t * (y1 - y0))
      .transition().duration(280)
        .attr('r', 9)
        .attr('opacity', 0)
      .on('end', function () { d3.select(this).remove(); resolve() })
  })
}

function animateDot(entry) {
  sseEvents.value++
  const dbg = (reason) => console.debug('[topology dot] dropped —', reason, entry)

  if (!entry.server_name)      return dbg('no server_name')
  if (!entry.proxy_host || entry.proxy_host === '-') return dbg('no proxy_host')

  const src = graphServers.find(s => (s.displayName || s.name) === entry.server_name)
  if (!src) return dbg(`server_name "${entry.server_name}" not matched (known: ${graphServers.map(s => s.displayName || s.name).join(', ')})`)

  const fromId = `server:${src.$loki}`
  const toId   = findNodeId(entry.proxy_host)
  if (!toId) return dbg(`proxy_host "${entry.proxy_host}" not in graph`)

  const corrId = entry.correlation_id || `_${Date.now()}`
  const color  = colorFor(entry.correlation_id)

  if (!pendingDots.has(corrId)) {
    pendingDots.set(corrId, [])
    // Flush after 200 ms — enough to collect all hops in the same SSE batch
    setTimeout(() => {
      const hops = pendingDots.get(corrId)
      pendingDots.delete(corrId)
      if (!hops || !hops.length) return
      // Reverse: SSE delivers downstream-first, we want upstream-first
      hops.reverse()
      hops.reduce((chain, hop) => chain.then(() => launchDot(hop.fromId, hop.toId, hop.color)), Promise.resolve())
    }, 200)
  }
  pendingDots.get(corrId).push({ fromId, toId, color })
}

// ─── SSE ─────────────────────────────────────────────────────────────────────

let sseSource = null

function connectSSE() {
  if (sseSource) return
  sseSource = new EventSource('/api/nginx/logs/access/stream')
  sseSource.onmessage = (e) => {
    try { animateDot(JSON.parse(e.data)) } catch (err) { console.warn('[topology SSE parse]', err) }
  }
}

function disconnectSSE() {
  if (sseSource) { sseSource.close(); sseSource = null }
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function buildGraphData() {
  const [servers, rawLogs] = await Promise.all([
    apiFetch('/api/nginx/servers'),
    apiFetch('/api/nginx/logs/access')
  ])

  const enabledServers = servers.filter(s => s.enable)
  graphServers = enabledServers  // expose to animateDot

  const nodesMap = new Map()
  const edgesMap = new Map()

  enabledServers.forEach(s => {
    nodesMap.set(`server:${s.$loki}`, {
      id: `server:${s.$loki}`,
      label: s.displayName || s.name,
      sublabel: `:${s.port}`,
      type: 'server',
      enabled: s.enable
    })
  })

  function resolveHost(raw) {
    const serverMatch = servers.find(s => serverMatchesHost(s, raw))
    if (serverMatch) return `server:${serverMatch.$loki}`
    const id = `host:${raw}`
    if (!nodesMap.has(id)) nodesMap.set(id, { id, label: raw, type: 'external' })
    return id
  }

  enabledServers.forEach(s => {
    const byTarget = new Map()
    ;(s.locations || []).filter(l => l.enable && l.proxyPass).forEach(l => {
      try {
        const url = new URL(l.proxyPass)
        const hostKey = url.port ? `${url.hostname}:${url.port}` : url.hostname
        const target = resolveHost(hostKey)
        if (!byTarget.has(target)) byTarget.set(target, [])
        byTarget.get(target).push(l.location)
      } catch {}
    })
    byTarget.forEach((paths, target) => {
      edgesMap.set(`config:server:${s.$loki}→${target}`, {
        source: `server:${s.$loki}`, target, paths,
        label: paths.length === 1 ? paths[0] : `${paths.length} paths`,
        type: 'config'
      })
    })
  })

  const logCounts = new Map()
  ;(Array.isArray(rawLogs) ? rawLogs : []).forEach(line => {
    try {
      const e = JSON.parse(line)
      if (!e.server_name || !e.proxy_host || e.proxy_host === '-' || e.proxy_host === '') return
      const src = enabledServers.find(s => s.displayName === e.server_name)
      if (!src) return
      const fromId = `server:${src.$loki}`
      const toId = resolveHost(e.proxy_host)
      const key = `${fromId}→${toId}`
      logCounts.set(key, (logCounts.get(key) || 0) + 1)
    } catch {}
  })
  logCounts.forEach((count, key) => {
    const sep = key.indexOf('→')
    edgesMap.set(`log:${key}`, {
      source: key.slice(0, sep), target: key.slice(sep + 1), count, type: 'log'
    })
  })

  return { nodes: [...nodesMap.values()], edges: [...edgesMap.values()] }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderGraph(nodes, edges) {
  dotsLayer = null  // guard: discard any SSE events that arrive during re-render
  graphNodes = nodes

  const svg = d3.select(svgEl.value)
  svg.selectAll('*').remove()

  const rect = svgEl.value.getBoundingClientRect()
  const W = rect.width  || 900
  const H = rect.height || 600

  const g = svg.append('g')

  svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', (e) => g.attr('transform', e.transform)))

  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const linkData = edges.map(e => ({
    ...e,
    source: nodeById.get(e.source) || e.source,
    target: nodeById.get(e.target) || e.target
  }))

  simulation = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(linkData).id(d => d.id).distance(150))
    .force('charge',    d3.forceManyBody().strength(-250))
    .force('center',    d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(20))

  // 1 — edges
  const link = g.append('g').selectAll('line')
    .data(linkData).join('line')
    .attr('stroke', d => d.type === 'log' ? '#6366f1' : '#94a3b8')
    .attr('stroke-width', d => d.type === 'log' ? Math.min(1 + (d.count || 0) / 20, 5) : 1.5)
    .attr('stroke-dasharray', d => d.type === 'config' ? '6 3' : null)
    .attr('marker-end', d => `url(#arrow-${d.type === 'log' ? 'log' : 'config'})`)
    .attr('cursor', d => (d.type === 'config' && d.paths.length > 1) ? 'pointer' : 'default')
    .on('click', openModal)

  function openModal(event, d) {
    if (d.type !== 'config' || d.paths.length <= 1) return
    modalTitle.value = `${d.source.label || d.source.id} → ${d.target.label || d.target.id}`
    modalPaths.value = d.paths
    modalOpen.value = true
    event.stopPropagation()
  }

  // 2 — edge labels
  const linkLabel = g.append('g').selectAll('text')
    .data(linkData).join('text')
    .attr('font-size', 9)
    .attr('fill', d => d.type === 'log' ? '#6366f1' : '#94a3b8')
    .attr('text-anchor', 'middle')
    .attr('font-weight', d => (d.type === 'config' && d.paths.length > 1) ? 600 : 400)
    .attr('cursor', d => (d.type === 'config' && d.paths.length > 1) ? 'pointer' : 'default')
    .on('click', openModal)
    .text(d => d.type === 'log' ? '' : (d.paths.length === 1 ? d.paths[0] : `${d.paths.length} paths ↗`))

  // 3 — dots layer (above edges, below nodes)
  dotsLayer = g.append('g')

  // 4 — node groups (on top, interactive)
  const node = g.append('g').selectAll('g')
    .data(nodes).join('g')
    .attr('cursor', 'grab')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
    )

  const serverFill = cssVar('--bg-surface')
  const serverFillDisabled = cssVar('--bg-surface-alt')
  const externalFill = cssVar('--bg-code')
  const externalStroke = cssVar('--border')
  const externalText = cssVar('--text-secondary')
  const sublabelText = cssVar('--text-muted')

  node.filter(d => d.type === 'server').append('rect')
    .attr('rx', 7).attr('ry', 7).attr('width', 116).attr('height', 40)
    .attr('x', -58).attr('y', -20)
    .attr('fill', d => d.enabled ? serverFill : serverFillDisabled)
    .attr('stroke', d => d.enabled ? '#6366f1' : '#6b7280')
    .attr('stroke-width', 1.5)

  node.filter(d => d.type === 'server').append('text')
    .attr('y', -3).attr('text-anchor', 'middle').attr('fill', cssVar('--text-primary'))
    .attr('font-size', 11).attr('font-weight', 600).text(d => d.label)

  node.filter(d => d.type === 'server').append('text')
    .attr('y', 11).attr('text-anchor', 'middle').attr('fill', sublabelText)
    .attr('font-size', 10).text(d => d.sublabel)

  node.filter(d => d.type === 'external').append('ellipse')
    .attr('rx', 52).attr('ry', 18)
    .attr('fill', externalFill).attr('stroke', externalStroke).attr('stroke-width', 1.5)

  node.filter(d => d.type === 'external').append('text')
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('fill', externalText).attr('font-size', 10).text(d => d.label)

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
    linkLabel
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 - 5)
    node.attr('transform', d => `translate(${d.x},${d.y})`)
  })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  if (simulation) { simulation.stop(); simulation = null }
  try {
    const { nodes, edges } = await buildGraphData()
    empty.value = nodes.length === 0
    loading.value = false
    if (!empty.value) {
      await nextTick()
      renderGraph(nodes, edges)
    }
  } catch (e) {
    loading.value = false
    throw e
  }
}

onMounted(() => {
  load()
  connectSSE()
  apiFetch('/api/nginx/logs/access/path').then(d => { accessLogPath.value = d.path || '' }).catch(() => {})
})
onBeforeUnmount(() => { if (simulation) simulation.stop(); disconnectSSE() })

watch(isDark, () => { if (!loading.value && !empty.value) load() })
</script>

<style scoped>
.topology-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main);
}

.topology-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 1rem;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.topology-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-right: auto;
}

.legend {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.topology-svg {
  flex: 1;
  width: 100%;
  display: block;
}

.sse-counter {
  font-size: 0.75rem;
  color: var(--border);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sse-counter.active { color: var(--text-muted); }

.log-disclaimer {
  font-size: 0.72rem;
  color: var(--text-subtle);
  white-space: nowrap;
}
.log-disclaimer code {
  font-size: 0.72rem;
  color: #6366f1;
}

.log-path-link {
  cursor: pointer;
  text-decoration: underline dotted;
}
.log-path-link:hover { color: #4f46e5; }

.log-path-popover {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 260px;
}

.log-path-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.log-path-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-code);
  border-radius: 5px;
  padding: 0.35rem 0.5rem;
}

.log-path-value {
  flex: 1;
  font-size: 0.8rem;
  color: var(--text-primary);
  word-break: break-all;
}

.log-path-copy {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.log-path-copy:hover { color: #6366f1; }

.topology-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-subtle);
  font-size: 0.95rem;
}

.path-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.path-list li {
  padding: 0.35rem 0.6rem;
  background: var(--bg-code);
  border-radius: 4px;
}

.path-list code {
  font-size: 0.85rem;
  color: var(--text-primary);
}
</style>
