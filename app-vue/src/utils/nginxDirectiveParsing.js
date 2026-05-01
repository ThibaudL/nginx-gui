const propLabels = {
  clientMaxBodySize: 'max body size', gzip: 'gzip', gzipTypes: 'gzip types',
  accessLog: 'access log', ssl: 'SSL', sslCertificate: 'SSL cert',
  sslCertificateKey: 'SSL key', sslProtocols: 'SSL protocols',
  websocket: 'WebSocket', proxyReadTimeout: 'read timeout',
  proxyConnectTimeout: 'connect timeout', proxySendTimeout: 'send timeout',
  proxyBuffering: 'buffering', cors: 'CORS', corsOrigin: 'CORS origin',
  rateLimit: 'rate limit', rateLimitZone: 'RL zone', rateLimitBurst: 'RL burst',
  authBasic: 'basic auth', authBasicRealm: 'auth realm', authBasicUserFile: 'auth file',
}

export function formatExtractedProps(props) {
  return Object.keys(props).map(k => propLabels[k] || k).join(', ')
}

export function parseServerDirectives(text) {
  const props = {}
  const kept = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    let m
    if (!t || t.startsWith('#')) { kept.push(line); continue }
    if (m = t.match(/^client_max_body_size\s+(.+?);$/))       { props.clientMaxBodySize = m[1] }
    else if (m = t.match(/^gzip\s+(on|off);$/))                { props.gzip = m[1] === 'on' }
    else if (m = t.match(/^gzip_types\s+(.+?);$/))             { props.gzipTypes = m[1] }
    else if (m = t.match(/^access_log\s+(off|on);$/))          { props.accessLog = m[1] !== 'off' }
    else if (m = t.match(/^ssl_certificate\s+(.+?);$/))        { props.ssl = true; props.sslCertificate = m[1] }
    else if (m = t.match(/^ssl_certificate_key\s+(.+?);$/))    { props.ssl = true; props.sslCertificateKey = m[1] }
    else if (m = t.match(/^ssl_protocols\s+(.+?);$/))          { props.ssl = true; props.sslProtocols = m[1].trim().split(/\s+/) }
    else { kept.push(line) }
  }
  return { props, remaining: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim() }
}

export function parseLocationDirectives(text) {
  const lines = text.split('\n')
  const props = {}
  const skipIdx = new Set()

  const wsVersionIdx = lines.findIndex(l => /^proxy_http_version\s+1\.1;$/.test(l.trim()))
  const wsUpgradeIdx = lines.findIndex(l => /^proxy_set_header\s+Upgrade\s+\$http_upgrade;$/.test(l.trim()))
  const wsConnIdx    = lines.findIndex(l => /^proxy_set_header\s+Connection\s+"upgrade";$/.test(l.trim()))
  if (wsVersionIdx >= 0 && wsUpgradeIdx >= 0 && wsConnIdx >= 0) {
    props.websocket = true
    skipIdx.add(wsVersionIdx); skipIdx.add(wsUpgradeIdx); skipIdx.add(wsConnIdx)
  }

  for (let i = 0; i < lines.length; i++) {
    if (skipIdx.has(i)) continue
    const t = lines[i].trim()
    let m
    if (!t || t.startsWith('#')) continue
    if (m = t.match(/^proxy_read_timeout\s+(.+?);$/))
      { props.proxyReadTimeout = m[1]; skipIdx.add(i) }
    else if (m = t.match(/^proxy_connect_timeout\s+(.+?);$/))
      { props.proxyConnectTimeout = m[1]; skipIdx.add(i) }
    else if (m = t.match(/^proxy_send_timeout\s+(.+?);$/))
      { props.proxySendTimeout = m[1]; skipIdx.add(i) }
    else if (m = t.match(/^proxy_buffering\s+(on|off);$/))
      { props.proxyBuffering = m[1] === 'on' ? 'On' : 'Off'; skipIdx.add(i) }
    else if (m = t.match(/^add_header\s+Access-Control-Allow-Origin\s+"?([^";]+?)"?\s*always;$/))
      { props.cors = true; props.corsOrigin = m[1]; skipIdx.add(i) }
    else if (m = t.match(/^limit_req\s+zone=(\S+?)(?:\s+burst=(\d+))?(?:\s+nodelay)?;$/))
      { props.rateLimit = true; props.rateLimitZone = m[1]; if (m[2]) props.rateLimitBurst = m[2]; skipIdx.add(i) }
    else if (m = t.match(/^auth_basic\s+"([^"]*)";$/))
      { props.authBasic = true; props.authBasicRealm = m[1]; skipIdx.add(i) }
    else if (m = t.match(/^auth_basic_user_file\s+(.+?);$/))
      { props.authBasicUserFile = m[1]; skipIdx.add(i) }
  }

  if (props.cors) {
    for (let i = 0; i < lines.length; i++) {
      if (skipIdx.has(i)) continue
      const t = lines[i].trim()
      if (/^add_header\s+Access-Control-Allow-Methods/.test(t) ||
          /^add_header\s+Access-Control-Allow-Headers/.test(t)) skipIdx.add(i)
    }
  }

  const kept = lines.filter((_, i) => !skipIdx.has(i))
  return { props, remaining: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim() }
}
