/**
 * Shared auth token helper - reads JWT from cookie set on login
 * Cookie: admin_token (set by /api/auth/login, readable by JS)
 */

export function getToken(): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ""
}

export function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.href = "/login"
  }
}

export function clearAuth(): void {
  if (typeof document === "undefined") return
  const expired = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  document.cookie = `admin_token=; ${expired}`
  document.cookie = `admin_session=; ${expired}`
}
