/**
 * Shared auth token helper.
 * Token is stored in sessionStorage after login (set by app/login/page.tsx).
 * The httpOnly cookie admin_session is used only by the Next.js middleware for route protection.
 */

export function getToken(): string {
  if (typeof window === "undefined") return ""
  return sessionStorage.getItem("admin_token") || ""
}

export function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("admin_token")
    window.location.href = "/login"
  }
}

export function clearAuth(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("admin_token")
  }
}
