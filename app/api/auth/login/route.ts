import { NextRequest, NextResponse } from "next/server"

const API = "https://api.tessquadros.com.br/api"

// In-memory rate limiting: max 5 failed attempts per IP in 15 min
const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
  const now = Date.now()

  // Check if IP is locked out
  const attempts = failedAttempts.get(ip)
  if (attempts && now < attempts.resetAt && attempts.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((attempts.resetAt - now) / 1000)
    return NextResponse.json(
      { error: `Conta bloqueada por tentativas excessivas. Tente novamente em ${Math.ceil(retryAfterSec / 60)} minutos.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    )
  }

  let email: string, password: string
  try {
    const body = await request.json()
    email = body.email
    password = body.password
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 })
  }

  // Validate credentials against ecommerce-astro API
  let token: string | null = null
  try {
    const res = await fetch(`${API}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      // Record failed attempt
      const prev = failedAttempts.get(ip)
      if (!prev || now >= prev.resetAt) {
        failedAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_MS })
      } else {
        failedAttempts.set(ip, { count: prev.count + 1, resetAt: prev.resetAt })
      }
      // Artificial delay to slow brute force
      await new Promise((r) => setTimeout(r, 800))
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    const data = await res.json()
    token = data.token
  } catch {
    return NextResponse.json({ error: "Erro ao conectar com o servidor" }, { status: 502 })
  }

  if (!token) {
    return NextResponse.json({ error: "Falha na autenticação" }, { status: 401 })
  }

  // Clear failed attempts on success
  failedAttempts.delete(ip)

  const isProd = process.env.NODE_ENV === "production"
  const maxAge = 60 * 60 * 24 // 24 hours

  const response = NextResponse.json({ ok: true })

  // admin_token: readable by JS (client components need it for API calls)
  response.cookies.set("admin_token", token, {
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    maxAge,
    path: "/",
  })

  // admin_session: httpOnly, used only by middleware for route protection
  response.cookies.set("admin_session", "1", {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge,
    path: "/",
  })

  return response
}
