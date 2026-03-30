"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error || "Muitas tentativas. Aguarde antes de tentar novamente.")
        } else {
          setError("Email ou senha incorretos.")
          if (data.attemptsLeft !== undefined) setAttemptsLeft(data.attemptsLeft)
        }
        return
      }

      router.push("/pedidos")
      router.refresh()
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Painel Lojista</h1>
          <p className="text-zinc-500 text-sm mt-1">Tess Quadros</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="seu@email.com.br"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
              {error}
              {attemptsLeft !== null && attemptsLeft > 0 && (
                <span className="block text-xs mt-1 text-red-400">
                  {attemptsLeft} tentativa{attemptsLeft !== 1 ? "s" : ""} restante{attemptsLeft !== 1 ? "s" : ""} antes do bloqueio.
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-zinc-900 font-bold py-3 rounded-lg text-sm tracking-wide hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  )
}
