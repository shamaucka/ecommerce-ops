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

/* ===== CONSTANTES ===== */
const SERIE_TABS = [
  { value: "4", label: "Saida (Serie 4)" },
  { value: "3", label: "Entrada (Serie 3)" },
]

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "autorizada", label: "Autorizada" },
  { value: "rejeitada", label: "Rejeitada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "pendente", label: "Pendente" },
  { value: "denegada", label: "Denegada" },
]

const STATUS_COLORS: Record<string, string> = {
  autorizada: "bg-green-100 text-green-700",
  rejeitada: "bg-red-100 text-red-700",
  cancelada: "bg-gray-100 text-gray-500",
  pendente: "bg-yellow-100 text-yellow-700",
  denegada: "bg-red-200 text-red-900",
}

const STATUS_LABELS: Record<string, string> = {
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  pendente: "Pendente",
  denegada: "Denegada",
}

function formatBRL(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---"
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/* ===== PAGINA PRINCIPAL ===== */
export default function NotasFiscaisPage() {
  const [notas, setNotas] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [serieTab, setSerieTab] = useState("4")
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modal emitir saida
  const [showEmitModal, setShowEmitModal] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [emitLoading, setEmitLoading] = useState(false)

  // Modal nova entrada
  const [showEntradaModal, setShowEntradaModal] = useState(false)
  const [entradaForm, setEntradaForm] = useState({ chave_acesso: "", fornecedor: "", valor: "" })
  const [entradaLoading, setEntradaLoading] = useState(false)

  // Modal estorno/devolucao
  const [showEstornoModal, setShowEstornoModal] = useState(false)
  const [estornoNfe, setEstornoNfe] = useState<any>(null)
  const [estornoLoading, setEstornoLoading] = useState(false)

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  /* ===== CARREGAR NOTAS ===== */
  const loadNotas = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { action: "list", serie: serieTab }
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      const query = new URLSearchParams(params).toString()
      const data = await api(`/admin/nfe-manager?${query}`)
      setNotas(data.notas || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [serieTab, statusFilter, search])

  const loadStats = useCallback(async () => {
    try {
      const data = await api(`/admin/nfe-manager?action=stats&serie=${serieTab}`)
      setStats(data.stats || {})
    } catch (e: any) {
      console.error(e)
    }
  }, [serieTab])

  useEffect(() => {
    loadNotas()
    loadStats()
  }, [loadNotas, loadStats])

  /* ===== ACOES ===== */
  const handleDanfe = async (nfeId: string) => {
    setActionLoading(nfeId + "_danfe")
    try {
      const data = await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({ action: "danfe", id: nfeId }),
      })
      if (data.url) {
        window.open(data.url, "_blank")
      } else {
        showMsg("DANFE gerado com sucesso")
      }
    } catch (e: any) {
      showMsg("Erro ao gerar DANFE: " + e.message)
    }
    setActionLoading(null)
  }

  const handleConsultar = async (nfeId: string) => {
    setActionLoading(nfeId + "_consult")
    try {
      const data = await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({ action: "consult", id: nfeId }),
      })
      showMsg(data.message || "Consulta realizada")
      await loadNotas()
      await loadStats()
    } catch (e: any) {
      showMsg("Erro ao consultar: " + e.message)
    }
    setActionLoading(null)
  }

  const handleCancelar = async (nfeId: string) => {
    if (!confirm("Confirma o cancelamento da NFe na SEFAZ?")) return
    const justificativa = "Pedido cancelado pela cliente conforme solicitacao"
    setActionLoading(nfeId + "_cancel")
    try {
      const data = await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({ action: "cancel", id: nfeId, justificativa }),
      })
      if (data.result?.success) {
        showMsg("NFe cancelada com sucesso na SEFAZ")
      } else {
        showMsg("Erro SEFAZ: " + (data.result?.error || data.error || "Falha no cancelamento"))
      }
      await loadNotas()
      await loadStats()
    } catch (e: any) {
      showMsg("Erro ao cancelar: " + e.message)
    }
    setActionLoading(null)
  }

  const handleRetentar = async (nfeId: string) => {
    setActionLoading(nfeId + "_retry")
    try {
      await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({ action: "retry", id: nfeId }),
      })
      showMsg("NFe reenviada para processamento")
      await loadNotas()
      await loadStats()
    } catch (e: any) {
      showMsg("Erro ao retentar: " + e.message)
    }
    setActionLoading(null)
  }

  /* ===== DANFE SIMPLIFICADA 10x15 ===== */
  const handleDanfeSimplificada = async (nfe: any) => {
    setActionLoading(nfe.id + "_danfe10x15")
    try {
      const printHtml = generateDanfeSimplificadaHtml(nfe)
      const printWindow = window.open("", "_blank", "width=400,height=600")
      if (printWindow) {
        printWindow.document.write(printHtml)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => printWindow.print(), 300)
      }
    } catch (e: any) {
      showMsg("Erro ao gerar DANFE simplificada: " + e.message)
    }
    setActionLoading(null)
  }

  /* ===== ETIQUETA IMILE ===== */
  const handleEtiqueta = async (nfe: any) => {
    setActionLoading(nfe.id + "_etiqueta")
    try {
      const data = await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({ action: "get_imile_label", id: nfe.id }),
      })
      if (data.labelBase64) {
        // Converter base64 para blob e abrir em nova aba
        const byteChars = atob(data.labelBase64)
        const byteArr = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
        const blob = new Blob([byteArr], { type: "application/pdf" })
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
      } else if (data.url) {
        window.open(data.url, "_blank")
      } else {
        showMsg("Etiqueta iMile nao disponivel para esta nota fiscal")
      }
    } catch (e: any) {
      showMsg("Erro ao buscar etiqueta: " + e.message)
    }
    setActionLoading(null)
  }

  /* ===== EMITIR SAIDA ===== */
  const openEmitModal = async () => {
    setShowEmitModal(true)
    setLoadingOrders(true)
    try {
      const data = await api("/admin/orders?action=list&status=processing")
      setOrders(data.orders || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoadingOrders(false)
  }

  const emitSaida = async (orderId: string) => {
    setEmitLoading(true)
    try {
      await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({ action: "emit_saida", order_id: orderId }),
      })
      showMsg("NFe de saida emitida com sucesso!")
      setShowEmitModal(false)
      await loadNotas()
      await loadStats()
    } catch (e: any) {
      showMsg("Erro ao emitir NFe: " + e.message)
    }
    setEmitLoading(false)
  }

  /* ===== NOVA ENTRADA ===== */
  const submitEntrada = async () => {
    if (!entradaForm.chave_acesso) {
      showMsg("Erro: Informe a chave de acesso")
      return
    }
    setEntradaLoading(true)
    try {
      await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({
          action: "emit_entrada",
          chave_acesso: entradaForm.chave_acesso,
          fornecedor: entradaForm.fornecedor,
          valor: entradaForm.valor ? Math.round(parseFloat(entradaForm.valor) * 100) : undefined,
        }),
      })
      showMsg("NFe de entrada registrada com sucesso!")
      setShowEntradaModal(false)
      setEntradaForm({ chave_acesso: "", fornecedor: "", valor: "" })
      await loadNotas()
      await loadStats()
    } catch (e: any) {
      showMsg("Erro ao registrar entrada: " + e.message)
    }
    setEntradaLoading(false)
  }

  /* ===== ESTORNO / DEVOLUCAO ===== */
  const handleEstorno = (nfe: any) => {
    setEstornoNfe(nfe)
    setShowEstornoModal(true)
  }

  const submitEstorno = async () => {
    if (!estornoNfe) return
    setEstornoLoading(true)
    try {
      const data = await api("/admin/nfe-manager", {
        method: "POST",
        body: JSON.stringify({
          action: "emit_estorno",
          nfe_referenciada: estornoNfe.chave_acesso,
          order_id: estornoNfe.order_id,
          valor_total: estornoNfe.valor_total,
          motivo: "Devolucao de mercadoria pelo cliente",
        }),
      })
      if (data.result?.status === "autorizada") {
        showMsg("Nota de estorno emitida com sucesso!")
      } else {
        showMsg("Estorno criado: " + (data.result?.status || "pendente"))
      }
      setShowEstornoModal(false)
      setEstornoNfe(null)
      await loadNotas()
      await loadStats()
    } catch (e: any) {
      showMsg("Erro ao emitir estorno: " + e.message)
    }
    setEstornoLoading(false)
  }

  /* ===== FILTRO LOCAL ===== */
  const filteredNotas = notas

  const totalCount = stats.total || 0
  const autorizadasCount = stats.autorizada || 0
  const rejeitadasCount = stats.rejeitada || 0
  const canceladasCount = stats.cancelada || 0
  const pendentesCount = stats.pendente || 0

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Notas Fiscais</h2>
          <p className="text-zinc-500 text-sm mt-1">{filteredNotas.length} nota(s) fiscal(is)</p>
        </div>
        <div className="flex gap-2">
          {serieTab === "3" ? (
            <button onClick={openEmitModal} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800">
              Emitir NFe Saida
            </button>
          ) : (
            <button onClick={() => setShowEntradaModal(true)} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800">
              Nova Entrada
            </button>
          )}
          <button onClick={() => { loadNotas(); loadStats() }} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">
            Atualizar
          </button>
        </div>
      </div>

      {/* MENSAGEM */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total" value={totalCount} color="bg-zinc-100 text-zinc-700" />
        <StatCard label="Autorizadas" value={autorizadasCount} color="bg-green-50 text-green-700" />
        <StatCard label="Rejeitadas" value={rejeitadasCount} color="bg-red-50 text-red-700" />
        <StatCard label="Canceladas" value={canceladasCount} color="bg-gray-50 text-gray-500" />
        <StatCard label="Pendentes" value={pendentesCount} color="bg-yellow-50 text-yellow-700" />
      </div>

      {/* SERIE TABS */}
      <div className="flex gap-1 mb-4 bg-zinc-100 p-1 rounded-lg w-fit">
        {SERIE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setSerieTab(tab.value); setStatusFilter(""); setSearch("") }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              serieTab === tab.value ? "bg-white shadow text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* FILTROS */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Buscar por numero, cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") loadNotas() }}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 w-64"
        />
        <button onClick={loadNotas} className="px-3 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">
          Buscar
        </button>
      </div>

      {/* TABELA */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando notas fiscais...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="p-3 text-left">Numero</th>
                <th className="p-3 text-center">Serie</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-right">Valor (R$)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotas.map((nfe) => {
                const status = nfe.status || "pendente"
                const statusColor = STATUS_COLORS[status] || "bg-zinc-100 text-zinc-600"
                const statusLabel = STATUS_LABELS[status] || status
                return (
                  <tr key={nfe.id} className="border-b hover:bg-zinc-50">
                    <td className="p-3 font-medium font-mono">{nfe.numero || "---"}</td>
                    <td className="p-3 text-center">{nfe.serie || serieTab}</td>
                    <td className="p-3">{nfe.cliente_nome || nfe.destinatario?.nome || "---"}</td>
                    <td className="p-3 text-right font-medium">{nfe.valor ? formatBRL(nfe.valor) : "---"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                    </td>
                    <td className="p-3 text-xs text-zinc-500">{formatDate(nfe.created_at || nfe.data_emissao)}</td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <button
                          onClick={() => handleDanfe(nfe.id)}
                          disabled={actionLoading === nfe.id + "_danfe"}
                          className="px-2 py-1 bg-zinc-900 text-white rounded text-xs font-medium hover:bg-zinc-800 disabled:opacity-50"
                        >
                          {actionLoading === nfe.id + "_danfe" ? "..." : "DANFE"}
                        </button>
                        {(status !== "cancelada") && (
                          <>
                            <button
                              onClick={() => handleDanfeSimplificada(nfe)}
                              disabled={actionLoading === nfe.id + "_danfe10x15"}
                              className="px-2 py-1 bg-sky-600 text-white rounded text-xs font-medium hover:bg-sky-700 disabled:opacity-50"
                            >
                              {actionLoading === nfe.id + "_danfe10x15" ? "..." : "DANFE 10x15"}
                            </button>
                            <button
                              onClick={() => handleEtiqueta(nfe)}
                              disabled={actionLoading === nfe.id + "_etiqueta"}
                              className="px-2 py-1 bg-zinc-900 text-white rounded text-xs font-medium hover:bg-zinc-800 disabled:opacity-50"
                            >
                              {actionLoading === nfe.id + "_etiqueta" ? "..." : "Etiqueta"}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleConsultar(nfe.id)}
                          disabled={actionLoading === nfe.id + "_consult"}
                          className="px-2 py-1 bg-slate-600 text-white rounded text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
                        >
                          {actionLoading === nfe.id + "_consult" ? "..." : "Consultar"}
                        </button>
                        {status === "autorizada" && (
                          <button
                            onClick={() => handleEstorno(nfe)}
                            className="px-2 py-1 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700"
                          >
                            Estorno
                          </button>
                        )}
                        {(status !== "cancelada") && (
                          <button
                            onClick={() => handleCancelar(nfe.id)}
                            disabled={actionLoading === nfe.id + "_cancel"}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            {actionLoading === nfe.id + "_cancel" ? "..." : "Cancelar"}
                          </button>
                        )}
                        {status === "rejeitada" && (
                          <button
                            onClick={() => handleRetentar(nfe.id)}
                            disabled={actionLoading === nfe.id + "_retry"}
                            className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                          >
                            {actionLoading === nfe.id + "_retry" ? "..." : "Retentar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredNotas.length === 0 && (
            <div className="text-center py-8 text-zinc-400">Nenhuma nota fiscal encontrada</div>
          )}
        </div>
      )}

      {/* MODAL EMITIR NFE SAIDA */}
      {showEmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEmitModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Emitir NFe de Saida</h3>
              <button onClick={() => setShowEmitModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl">&times;</button>
            </div>
            <p className="text-sm text-zinc-500 mb-4">Selecione um pedido com status &quot;Pago / Processar&quot; para emitir a nota fiscal:</p>

            {loadingOrders ? (
              <div className="text-center py-8 text-zinc-400">Carregando pedidos...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">Nenhum pedido com status &quot;processing&quot; encontrado</div>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-zinc-50">
                    <div>
                      <p className="font-medium text-sm font-mono">#{order.display_id || order.id?.slice(-6)}</p>
                      <p className="text-xs text-zinc-500">{order.customer_name || order.email || "---"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{order.total ? formatBRL(order.total) : "---"}</span>
                      <button
                        onClick={() => emitSaida(order.id)}
                        disabled={emitLoading}
                        className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {emitLoading ? "Emitindo..." : "Emitir NFe"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL NOVA ENTRADA */}
      {showEntradaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEntradaModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nova NFe de Entrada</h3>
              <button onClick={() => setShowEntradaModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Chave de Acesso *</label>
                <input
                  type="text"
                  value={entradaForm.chave_acesso}
                  onChange={(e) => setEntradaForm({ ...entradaForm, chave_acesso: e.target.value })}
                  placeholder="44 digitos da chave de acesso"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={entradaForm.fornecedor}
                  onChange={(e) => setEntradaForm({ ...entradaForm, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Valor (R$)</label>
                <input
                  type="text"
                  value={entradaForm.valor}
                  onChange={(e) => setEntradaForm({ ...entradaForm, valor: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>
              <button
                onClick={submitEntrada}
                disabled={entradaLoading}
                className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 mt-2"
              >
                {entradaLoading ? "Registrando..." : "Registrar Entrada"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL ESTORNO / DEVOLUCAO */}
      {showEstornoModal && estornoNfe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEstornoModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nota de Estorno / Devolucao</h3>
              <button onClick={() => setShowEstornoModal(false)} className="text-zinc-400 hover:text-zinc-600 text-xl">&times;</button>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm">
              <p><strong>NFe Original:</strong> Numero {estornoNfe.numero}, Serie {estornoNfe.serie}</p>
              <p><strong>Cliente:</strong> {estornoNfe.customer_name || "---"}</p>
              <p><strong>Valor:</strong> {estornoNfe.valor_total ? `R$ ${(estornoNfe.valor_total / 100).toFixed(2)}` : "---"}</p>
              <p><strong>Chave:</strong> <span className="font-mono text-xs break-all">{estornoNfe.chave_acesso || "---"}</span></p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3 mb-4 text-xs text-zinc-600">
              <p><strong>CFOP:</strong> 1.202 - Devolucao de compra para comercializacao</p>
              <p><strong>Serie:</strong> 4 (Saida)</p>
              <p><strong>Natureza:</strong> Devolucao de mercadoria adquirida</p>
              <p className="mt-1">A nota de estorno sera emitida referenciando a NFe original.</p>
            </div>
            <button
              onClick={submitEstorno}
              disabled={estornoLoading}
              className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
            >
              {estornoLoading ? "Emitindo Estorno..." : "Emitir Nota de Estorno"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ===== COMPONENTE STAT CARD ===== */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-xs font-medium uppercase opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

/* ===== DANFE SIMPLIFICADA 10x15 HTML ===== */
function generateDanfeSimplificadaHtml(nfe: any): string {
  const chave = nfe.chave_acesso || ""
  const chaveFormatada = chave.replace(/(\d{4})/g, "$1 ").trim()
  const protocolo = nfe.protocolo || ""
  const nfNum = nfe.numero || "---"
  const serie = nfe.serie || "3"
  const dataEmissao = nfe.created_at ? new Date(nfe.created_at).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR")
  const horaEmissao = nfe.created_at ? new Date(nfe.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const valorTotal = nfe.valor_total ? (nfe.valor_total / 100).toFixed(2) : "0.00"
  const clienteNome = nfe.customer_name || nfe.cliente_nome || "---"

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>DANFE - NF-e ${nfNum}</title>
<style>
  @page { size: 100mm 150mm; margin: 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 7pt; width: 96mm; margin: 0 auto; color: #000; }
  .border { border: 1px solid #000; }
  .header { text-align: center; padding: 2px; border-bottom: 2px solid #000; }
  .header h1 { font-size: 10pt; font-weight: bold; margin: 0; letter-spacing: 1px; }
  .header p { font-size: 6pt; margin: 1px 0; }
  .section { padding: 2px 3px; border-bottom: 1px solid #000; }
  .section-title { font-size: 6pt; font-weight: bold; text-transform: uppercase; color: #333; margin-bottom: 1px; letter-spacing: 0.5px; }
  .row { display: flex; justify-content: space-between; line-height: 1.4; }
  .label { font-weight: bold; font-size: 6.5pt; text-transform: uppercase; }
  .chave { font-family: 'Courier New', monospace; font-size: 6pt; word-break: break-all; letter-spacing: 0.3px; text-align: center; padding: 2px 0; }
  .bc-wrap { text-align: center; padding: 3px 0; }
  .bc-wrap canvas { display: block; margin: 0 auto; max-width: 100%; height: auto; }
  .bold { font-weight: bold; }
  .emit-info { font-size: 6.5pt; line-height: 1.3; }
  .dest-box { background: #f5f5f5; padding: 2px 3px; }
  .footer { font-size: 5.5pt; text-align: center; color: #666; padding: 2px; }
</style>
</head><body>
<div class="border">
  <div class="header">
    <h1>DANFE SIMPLIFICADA</h1>
    <p>DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA</p>
  </div>
  <div class="section">
    <div class="section-title">Emitente</div>
    <div class="emit-info">
      <div class="bold" style="font-size:8pt">AMERICA FULLCOMMERCE LTDA</div>
      <div>CNPJ: 53.768.405/0001-30 | IE: 262795078</div>
      <div>Rod. Jorge Lacerda, 2670 - Poco Grande - Gaspar/SC</div>
      <div>CEP: 89115-100</div>
    </div>
  </div>
  <div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div class="section-title">NF-e</div>
        <div style="font-size:12pt;font-weight:bold">${nfNum}</div>
      </div>
      <div style="text-align:right">
        <div class="label">Serie: ${serie}</div>
        <div class="label">Emissao: ${dataEmissao}</div>
        <div class="label">Hora: ${horaEmissao}</div>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Chave de Acesso</div>
    <div class="bc-wrap"><canvas id="bc-chave"></canvas></div>
    <div class="chave">${chaveFormatada || "CHAVE PENDENTE"}</div>
    ${protocolo ? '<div style="font-size:5.5pt;text-align:center;color:#555">Protocolo: ' + protocolo + '</div>' : ''}
  </div>
  <div class="section dest-box">
    <div class="section-title">Destinatario</div>
    <div class="bold">${clienteNome}</div>
    <div>CPF/CNPJ: ${nfe.customer_cpf || "---"}</div>
  </div>
  <div class="section">
    <div class="section-title">Dados da Nota</div>
    <div class="row"><span class="label">CFOP: ${nfe.cfop || "---"}</span><span class="label">Nat. Op.: ${nfe.natureza_operacao || "---"}</span></div>
    <div class="row"><span class="bold" style="font-size:9pt">Valor NF: R$ ${valorTotal}</span></div>
  </div>
  <div class="footer">
    Consulte a autenticidade em www.nfe.fazenda.gov.br<br>
    Impresso em ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
  </div>
</div>
<script>
(function() {
  var P = ["11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000","11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100","11001001110","11011100100","11001110100","11100110100","11100100110","11100010110","11101100100","11100110010","11100011010","11101101110","11101110110","11100010010","11101110010","11011110000","11100011110","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000","10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010","10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110","11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110","10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","11000110100","11000100010","11000010010","10110001000","10001100010","10001000110","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101011000","11101000110","11100010110","11011101000","11011100010","11000111010","11011101110","11011000110","11000110110","10010111000","10010001110","10001001110","11010111000","11010001110","11000101110","11010111000","1100011101011"];
  function enc(t){var c=[104];for(var i=0;i<t.length;i++)c.push(t.charCodeAt(i)-32);var s=c[0];for(var i=1;i<c.length;i++)s+=c[i]*i;c.push(s%103);c.push(106);return c.map(function(v){return P[v]}).join('')}
  function render(id,text,h){var el=document.getElementById(id);if(!el||!text||text==='CHAVE PENDENTE')return;var bits=enc(text),bw=1;el.width=bits.length*bw;el.height=h||40;var ctx=el.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,el.width,el.height);ctx.fillStyle='#000';for(var i=0;i<bits.length;i++){if(bits[i]==='1')ctx.fillRect(i*bw,0,bw,el.height)}}
  render('bc-chave','${chave}',40);
})();
</script>
</body></html>`
}
