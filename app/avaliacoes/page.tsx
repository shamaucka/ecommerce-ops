"use client"

import { useState, useEffect, useCallback } from "react"

const API = "http://localhost:4000/api"

/* ===== AUTH HELPER ===== */
let _tokenCache: { token: string; ts: number } | null = null
async function getToken() {
  if (_tokenCache && Date.now() - _tokenCache.ts < 300_000) return _tokenCache.token
  const res = await fetch(`${API}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sualoja.com.br", password: "admin123" }),
  })
  const { token } = await res.json()
  _tokenCache = { token, ts: Date.now() }
  return token
}
async function api(path: string, options?: RequestInit) {
  const token = await getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  })
  return res.json()
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---"
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`text-sm ${star <= rating ? "text-yellow-500" : "text-zinc-300"}`}>
          &#9733;
        </span>
      ))}
    </div>
  )
}

/* ===== PAGINA PRINCIPAL ===== */
export default function AvaliacoesPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"pending" | "approved">("pending")
  const [message, setMessage] = useState("")

  const loadReviews = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = tab === "pending"
        ? "/admin/reviews?action=pending"
        : "/admin/reviews?action=list&approved=true"
      const data = await api(endpoint)
      setReviews(data.reviews || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { loadReviews() }, [loadReviews])

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  const approveReview = async (id: string) => {
    try {
      await api("/admin/reviews", { method: "POST", body: JSON.stringify({ action: "approve", id }) })
      showMsg("Avaliacao aprovada!")
      await loadReviews()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const rejectReview = async (id: string) => {
    if (!confirm("Tem certeza que deseja rejeitar esta avaliacao?")) return
    try {
      await api("/admin/reviews", { method: "POST", body: JSON.stringify({ action: "reject", id }) })
      showMsg("Avaliacao rejeitada!")
      await loadReviews()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Avaliacoes</h2>
          <p className="text-zinc-500 text-sm mt-1">{reviews.length} avaliacao(oes) {tab === "pending" ? "pendente(s)" : "aprovada(s)"}</p>
        </div>
        <button onClick={loadReviews} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1 mb-6 bg-zinc-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "pending" ? "bg-white shadow text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setTab("approved")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "approved" ? "bg-white shadow text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}
        >
          Aprovadas
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando avaliacoes...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">Nenhuma avaliacao {tab === "pending" ? "pendente" : "aprovada"}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-sm">{review.product_name || review.product_title || "Produto"}</h4>
                  <p className="text-xs text-zinc-400">{review.customer_name || review.customer_email || "Cliente"}</p>
                </div>
                <Stars rating={review.rating || 0} />
              </div>

              {review.title && <h5 className="font-semibold text-sm mb-1">{review.title}</h5>}
              <p className="text-sm text-zinc-600 mb-3">{review.comment || review.content || "Sem comentario"}</p>
              <p className="text-xs text-zinc-400 mb-4">{formatDate(review.created_at)}</p>

              {tab === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => approveReview(review.id)} className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                    Aprovar
                  </button>
                  <button onClick={() => rejectReview(review.id)} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                    Rejeitar
                  </button>
                </div>
              )}

              {tab === "approved" && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Aprovada</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
