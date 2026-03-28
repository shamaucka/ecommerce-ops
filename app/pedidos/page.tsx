"use client"

import { useState, useEffect, useCallback, useRef } from "react"

import { API, ADMIN_EMAIL, ADMIN_PASS } from "../lib/api-url"

/* ===== AUTH HELPER ===== */
let _tokenCache: { token: string; ts: number } | null = null
async function getToken() {
  if (_tokenCache && Date.now() - _tokenCache.ts < 300_000) return _tokenCache.token
  const res = await fetch(`${API}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
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

/* ===== CONSTANTES ===== */
const STATUS_TABS = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Aguardando Pagamento" },
  { value: "processing", label: "Pago / Processar" },
  { value: "shipped", label: "Em Transporte" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
]

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-green-100 text-green-700",
  shipped: "bg-amber-100 text-amber-700",
  delivered: "bg-purple-100 text-purple-700",
  cancelled: "bg-gray-100 text-gray-500",
  canceled: "bg-gray-100 text-gray-500",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando Pgto",
  processing: "Pago",
  shipped: "Em Transporte",
  delivered: "Entregue",
  cancelled: "Cancelado",
  canceled: "Cancelado",
}

function formatBRL(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---"
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/* ===== TIPOS ===== */
interface ProductVariant { id: string; sku: string; title: string; prices: { amount: number }[] }
interface Product { id: string; title: string; thumbnail?: string; variants: ProductVariant[] }
interface OrderItem { sku: string; titulo_produto: string; qtde: number; valor: number } // valor em centavos

/* ===== MODAL CRIAR PEDIDO ===== */
function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [items, setItems] = useState<OrderItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api("/admin/products?limit=500").then((data) => {
      setProducts(data.products || [])
      setLoadingProducts(false)
    })
  }, [])

  // close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filtered = search.trim()
    ? products.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.variants.some((v) => v.sku?.toLowerCase().includes(search.toLowerCase()))
      ).slice(0, 8)
    : []

  const addItem = (product: Product, variant: ProductVariant) => {
    const price = variant.prices[0]?.amount ?? 0
    setItems((prev) => {
      const existing = prev.find((i) => i.sku === variant.sku)
      if (existing) return prev.map((i) => i.sku === variant.sku ? { ...i, qtde: i.qtde + 1 } : i)
      return [...prev, {
        sku: variant.sku,
        titulo_produto: variant.title && variant.title !== "Padrao" ? `${product.title} — ${variant.title}` : product.title,
        qtde: 1,
        valor: price,
      }]
    })
    setSearch("")
    setShowDropdown(false)
  }

  const removeItem = (sku: string) => setItems((prev) => prev.filter((i) => i.sku !== sku))
  const updateItem = (sku: string, field: "qtde" | "valor", val: number) =>
    setItems((prev) => prev.map((i) => i.sku === sku ? { ...i, [field]: val } : i))

  const totalCents = items.reduce((s, i) => s + i.qtde * i.valor, 0)

  const handleSubmit = async () => {
    setError("")
    if (!nome.trim()) { setError("Informe o nome da cliente"); return }
    if (!items.length) { setError("Adicione pelo menos um item"); return }
    setSubmitting(true)
    try {
      const data = await api("/admin/orders", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          cliente: { nome, email, cpf_cnpj: cpf },
          itens: items.map((i) => ({ sku: i.sku, titulo_produto: i.titulo_produto, qtde: i.qtde, valor: i.valor })),
        }),
      })
      if (!data.ok) { setError(data.error || "Erro ao criar pedido"); return }
      onCreated(data.order?.display_id || data.order?.id || "")
      onClose()
    } catch {
      setError("Erro de conexao. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Criar Pedido Manual</h2>
            <p className="text-zinc-500 text-sm mt-0.5">Preencha os dados da cliente e adicione os itens</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-2xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* CLIENTE */}
          <div className="bg-zinc-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-700">Dados da Cliente</h3>
            <div>
              <label className="text-xs font-medium text-zinc-500">Nome Completo *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Maria da Silva"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-500">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria@email.com"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">CPF / CNPJ</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* BUSCAR PRODUTO */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">Itens do Pedido</h3>
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                placeholder={loadingProducts ? "Carregando produtos..." : "Buscar produto por nome ou SKU..."}
                disabled={loadingProducts}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-100"
              />
              {showDropdown && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                  {filtered.map((product) =>
                    product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onMouseDown={() => addItem(product, variant)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left"
                      >
                        {product.thumbnail && (
                          <img src={product.thumbnail} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{product.title}{variant.title !== "Padrao" ? ` — ${variant.title}` : ""}</p>
                          <p className="text-xs text-zinc-400 font-mono">{variant.sku}</p>
                        </div>
                        <span className="text-sm font-medium shrink-0">
                          {variant.prices[0] ? formatBRL(variant.prices[0].amount) : "---"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ITENS */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.sku} className="flex items-center gap-3 bg-zinc-50 rounded-xl px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.titulo_produto}</p>
                    <p className="text-xs font-mono text-zinc-400">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <label className="text-[10px] text-zinc-400 uppercase">Qtd</label>
                    <input
                      type="number"
                      min={1}
                      value={item.qtde}
                      onChange={(e) => updateItem(item.sku, "qtde", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <label className="text-[10px] text-zinc-400 uppercase">R$</label>
                    <input
                      type="number"
                      min={0}
                      value={(item.valor / 100).toFixed(2)}
                      onChange={(e) => updateItem(item.sku, "valor", Math.round((parseFloat(e.target.value) || 0) * 100))}
                      className="w-20 border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-sm font-medium w-20 text-right shrink-0">{formatBRL(item.qtde * item.valor)}</p>
                  <button onClick={() => removeItem(item.sku)} className="text-zinc-300 hover:text-red-500 transition-colors shrink-0 text-lg leading-none">✕</button>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t mt-2">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold">{formatBRL(totalCents)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-xs font-medium text-center">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Criando pedido..." : "Criar Pedido"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ===== PAGINA PRINCIPAL ===== */
export default function PedidosPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [trackingInput, setTrackingInput] = useState("")
  const [message, setMessage] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter ? `&status=${statusFilter}` : ""
      const data = await api(`/admin/orders?action=list${params}`)
      setOrders(data.orders || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { loadOrders() }, [loadOrders])

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  const updateStatus = async (orderId: string, newStatus: string, tracking?: string) => {
    try {
      const payload: any = { action: "update_status", id: orderId, status: newStatus }
      if (tracking) payload.tracking_code = tracking
      await api("/admin/orders", { method: "POST", body: JSON.stringify(payload) })
      showMsg(`Pedido atualizado para: ${STATUS_LABELS[newStatus] || newStatus}`)
      await loadOrders()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const cancelOrder = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return
    try {
      await api("/admin/orders", { method: "POST", body: JSON.stringify({ action: "cancel", id: orderId }) })
      showMsg("Pedido cancelado!")
      await loadOrders()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
    setTrackingInput("")
  }

  return (
    <div>
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            showMsg(`Pedido ${id} criado com sucesso!`)
            loadOrders()
          }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Pedidos</h2>
          <p className="text-zinc-500 text-sm mt-1">{orders.length} pedido(s)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Criar Pedido
          </button>
          <button onClick={loadOrders} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* STATUS TABS */}
      <div className="flex gap-1 mb-4 bg-zinc-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              statusFilter === tab.value ? "bg-white shadow text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando pedidos...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="p-3 text-left">Pedido</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-left">Pagamento</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  expanded={expandedId === order.id}
                  onToggle={() => toggleExpand(order.id)}
                  onUpdateStatus={updateStatus}
                  onCancel={cancelOrder}
                  trackingInput={trackingInput}
                  setTrackingInput={setTrackingInput}
                />
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="text-center py-8 text-zinc-400">Nenhum pedido encontrado</div>
          )}
        </div>
      )}
    </div>
  )
}

/* ===== COMPONENTE DE LINHA DO PEDIDO ===== */
function OrderRow({
  order, expanded, onToggle, onUpdateStatus, onCancel, trackingInput, setTrackingInput,
}: {
  order: any
  expanded: boolean
  onToggle: () => void
  onUpdateStatus: (id: string, status: string, tracking?: string) => void
  onCancel: (id: string) => void
  trackingInput: string
  setTrackingInput: (v: string) => void
}) {
  const status = order.status || "pending"
  const statusColor = STATUS_COLORS[status] || "bg-zinc-100 text-zinc-600"
  const statusLabel = STATUS_LABELS[status] || status

  return (
    <>
      <tr className="border-b hover:bg-zinc-50 cursor-pointer" onClick={onToggle}>
        <td className="p-3 font-medium font-mono">#{order.display_id || order.id?.slice(-6)}</td>
        <td className="p-3">{order.customer_name || order.customer?.first_name || order.email || "---"}</td>
        <td className="p-3 text-center">
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        </td>
        <td className="p-3 text-right font-medium">{order.total ? formatBRL(order.total) : "---"}</td>
        <td className="p-3 text-xs">{order.payment_method || order.payments?.[0]?.provider_id || "---"}</td>
        <td className="p-3 text-xs text-zinc-500">{formatDate(order.created_at)}</td>
        <td className="p-3 text-center">
          <span className="text-zinc-400 text-xs">{expanded ? "▲" : "▼"}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-zinc-50">
          <td colSpan={7} className="p-4">
            <div className="grid grid-cols-3 gap-6">
              {/* ITENS */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Itens do Pedido</h4>
                <div className="space-y-2">
                  {(order.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.title || item.product_title} x{item.quantity}</span>
                      <span className="font-medium">{item.unit_price ? formatBRL(item.unit_price * item.quantity) : "---"}</span>
                    </div>
                  ))}
                  {(!order.items || order.items.length === 0) && <p className="text-xs text-zinc-400">Sem itens</p>}
                </div>
              </div>

              {/* CLIENTE */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Cliente</h4>
                <div className="text-sm space-y-1">
                  <p className="font-medium">{order.customer_name || order.customer?.first_name + " " + (order.customer?.last_name || "")}</p>
                  <p className="text-zinc-500">{order.customer_email || order.email}</p>
                  <p className="text-zinc-500">{order.customer_phone || order.metadata?.phone || "---"}</p>
                  <p className="text-zinc-400 text-xs">CPF: {order.customer_cpf || order.metadata?.cpf || "---"}</p>
                </div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2 mt-4">Endereco de Entrega</h4>
                <div className="text-sm text-zinc-500 space-y-0.5">
                  {order.shipping_address_line1 ? (
                    <>
                      <p>{order.shipping_address_line1}</p>
                      {order.shipping_address_line2 && <p>{order.shipping_address_line2}</p>}
                      <p>{order.shipping_neighborhood && order.shipping_neighborhood + " — "}{order.shipping_city} - {order.shipping_state}</p>
                      <p>CEP: {order.shipping_postal_code}</p>
                    </>
                  ) : order.shipping_address ? (
                    <>
                      <p>{order.shipping_address.address_1}</p>
                      {order.shipping_address.address_2 && <p>{order.shipping_address.address_2}</p>}
                      <p>{order.shipping_address.city} - {order.shipping_address.province}</p>
                      <p>CEP: {order.shipping_address.postal_code}</p>
                    </>
                  ) : (
                    <p>Endereco nao informado</p>
                  )}
                </div>
              </div>

              {/* ACOES */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Acoes</h4>
                <div className="space-y-2">
                  {status === "pending" && (
                    <button onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, "processing") }} className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      Marcar como Pago
                    </button>
                  )}
                  {(status === "processing") && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Codigo de rastreio..."
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, "shipped", trackingInput) }}
                        className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                      >
                        Marcar como Enviado
                      </button>
                    </div>
                  )}
                  {status === "shipped" && (
                    <button onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, "delivered") }} className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                      Marcar como Entregue
                    </button>
                  )}
                  {order.tracking_code && (
                    <div className="text-sm">
                      <span className="text-zinc-500">Rastreio: </span>
                      <span className="font-mono font-medium">{order.tracking_code}</span>
                    </div>
                  )}
                  {status !== "canceled" && status !== "delivered" && (
                    <button onClick={(e) => { e.stopPropagation(); onCancel(order.id) }} className="w-full px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                      Cancelar Pedido
                    </button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
