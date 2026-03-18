"use client"

import { useEffect, useState } from "react"
import { apiGet } from "./components/api"

interface Stats {
  aguardando_separacao: number
  em_separacao: number
  aguardando_conferencia: number
  conferido: number
  em_transporte: number
  despachados_hoje: number
  total: number
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    apiGet("stats")
      .then((data) => setStats(data.stats))
      .catch((err) => setError(err.message))
  }, [])

  const cards = stats
    ? [
        { label: "Aguardando Separação", value: stats.aguardando_separacao, color: "bg-yellow-500" },
        { label: "Em Separação", value: stats.em_separacao, color: "bg-orange-500" },
        { label: "Aguardando Conferência", value: stats.aguardando_conferencia, color: "bg-blue-500" },
        { label: "Conferido", value: stats.conferido, color: "bg-green-500" },
        { label: "Em Transporte", value: stats.em_transporte, color: "bg-purple-500" },
        { label: "Despachados Hoje", value: stats.despachados_hoje, color: "bg-emerald-600" },
      ]
    : []

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard Operações</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
          Erro ao carregar stats: {error}
          <p className="text-sm mt-1">Verifique se o backend esta rodando em localhost:4000</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-sm border p-5">
            <div className={`w-3 h-3 rounded-full ${c.color} mb-3`} />
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="text-3xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {stats && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-sm text-zinc-500">Total de pedidos no sistema</p>
          <p className="text-4xl font-bold mt-1">{stats.total}</p>
        </div>
      )}
    </div>
  )
}
