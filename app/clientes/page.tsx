"use client"

import { useState, useEffect, useCallback } from "react"

import { API } from "../lib/api-url"
import { getToken, clearAuth, redirectToLogin } from "../lib/auth-token"

async function api(path: string, options?: RequestInit) {
  const token = getToken()
  if (!token) { redirectToLogin(); return {} as any }
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  })
  if (res.status === 401) { clearAuth(); redirectToLogin(); return {} as any }
  return res.json()
}

function formatBRL(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---"
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/* ===== PAGINA PRINCIPAL ===== */
export default function ClientesPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [message, setMessage] = useState("")

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const searchParam = searchDebounced ? `&search=${encodeURIComponent(searchDebounced)}` : ""
      const data = await api(`/admin/customers?action=list${searchParam}`)
      setCustomers(data.customers || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [searchDebounced])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-zinc-500 text-sm mt-1">{customers.length} cliente(s)</p>
        </div>
        <button onClick={loadCustomers} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* BUSCA */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando clientes...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Telefone</th>
                <th className="p-3 text-left">CPF</th>
                <th className="p-3 text-center">Pedidos</th>
                <th className="p-3 text-right">Total Gasto</th>
                <th className="p-3 text-left">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b hover:bg-zinc-50">
                  <td className="p-3">
                    <div className="font-medium">{customer.first_name || ""} {customer.last_name || ""}</div>
                  </td>
                  <td className="p-3 text-zinc-500">{customer.email || "---"}</td>
                  <td className="p-3 text-zinc-500">{customer.phone || customer.metadata?.phone || "---"}</td>
                  <td className="p-3 text-zinc-500 font-mono text-xs">{customer.metadata?.cpf || "---"}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-1 bg-zinc-100 rounded text-xs font-medium">{customer.order_count ?? customer.orders?.length ?? 0}</span>
                  </td>
                  <td className="p-3 text-right font-medium">
                    {customer.total_spent != null ? formatBRL(customer.total_spent) : "---"}
                  </td>
                  <td className="p-3 text-xs text-zinc-500">{formatDate(customer.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="text-center py-8 text-zinc-400">Nenhum cliente encontrado</div>
          )}
        </div>
      )}
    </div>
  )
}
