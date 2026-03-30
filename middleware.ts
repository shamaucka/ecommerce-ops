import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// In-memory brute force protection (resets on server restart)
// Tracks per-IP login failures across the middleware
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"

  // Rate limit for login endpoint
  if (pathname === "/api/auth/login" && request.method === "POST") {
    const now = Date.now()
    const attempts = loginAttempts.get(ip)
    if (attempts && now < attempts.resetAt && attempts.count >= 5) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde 15 minutos." },
        { status: 429, headers: { "Retry-After": "900" } }
      )
    }
    return NextResponse.next()
  }

  // Allow public paths
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Check auth cookie for all other routes
  const session = request.cookies.get("admin_session")
  if (!session?.value) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}

// Export for use in the login route to record failed attempts
export { loginAttempts }
