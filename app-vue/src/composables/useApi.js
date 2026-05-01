export function useApi() {
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
  return { apiFetch }
}
