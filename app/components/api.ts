import { API } from "../lib/api-url"
import { getToken, clearAuth, redirectToLogin } from "../lib/auth-token"

const API_BASE = API + "/admin/fulfillment-ops"

async function authHeaders(): Promise<Record<string, string>> {
  const token = getToken()
  if (!token) {
    redirectToLogin()
    return {}
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
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
    clearAuth()
    redirectToLogin()
    return {}
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
    clearAuth()
    redirectToLogin()
    return {}
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}
