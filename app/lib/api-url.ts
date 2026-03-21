const isProd = typeof window !== "undefined" && window.location.hostname !== "localhost"

export const API_HOST = isProd
  ? "https://api.tessquadros.com.br"
  : "http://localhost:4000"

export const API = API_HOST + "/api"

export const ADMIN_EMAIL = isProd ? "admin@tessquadros.com.br" : "admin@sualoja.com.br"
export const ADMIN_PASS = "admin123"
