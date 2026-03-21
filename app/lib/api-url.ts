export const API_HOST =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://api.tessquadros.com.br"
    : "http://localhost:4000"

export const API = API_HOST + "/api"
