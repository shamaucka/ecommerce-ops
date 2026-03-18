const API_BASE = "http://localhost:4000/api/admin/fulfillment-ops"
const AUTH_URL = "http://localhost:4000/api/auth/user/emailpass"

// Credenciais do admin (em produção usar env vars)
const ADMIN_EMAIL = "admin@sualoja.com.br"
const ADMIN_PASSWORD = "admin123"

let cachedToken: string | null = null

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })

  if (!res.ok) throw new Error("Falha na autenticação")
  const data = await res.json()
  cachedToken = data.token
  return cachedToken!
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken()
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  }
}

export async function apiGet(action: string, params?: Record<string, string>) {
  const url = new URL(API_BASE)
  url.searchParams.set("action", action)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const headers = await authHeaders()
  const res = await fetch(url.toString(), { headers })

  if (res.status === 401) {
    // Token expirado, renovar
    cachedToken = null
    const newHeaders = await authHeaders()
    const retry = await fetch(url.toString(), { headers: newHeaders })
    if (!retry.ok) {
      const err = await retry.json().catch(() => ({ error: retry.statusText }))
      throw new Error(err.error || retry.statusText)
    }
    return retry.json()
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export async function apiPost(action: string, data?: Record<string, any>) {
  const headers = await authHeaders()
  const res = await fetch(API_BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...data }),
  })

  if (res.status === 401) {
    cachedToken = null
    const newHeaders = await authHeaders()
    const retry = await fetch(API_BASE, {
      method: "POST",
      headers: newHeaders,
      body: JSON.stringify({ action, ...data }),
    })
    if (!retry.ok) {
      const err = await retry.json().catch(() => ({ error: retry.statusText }))
      throw new Error(err.error || retry.statusText)
    }
    return retry.json()
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}
