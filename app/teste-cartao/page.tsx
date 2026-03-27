"use client"

import { useState, useEffect, useCallback } from "react"
import { API, ADMIN_EMAIL, ADMIN_PASS } from "../lib/api-url"

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
async function apiCall(path: string, options?: RequestInit) {
  const token = await getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  })
  return res.json()
}

type Card = {
  id: string
  label: string
  card_number: string
  card_expiry: string
  card_cvv: string
  card_name: string
  customer_email: string
  customer_cpf: string
  customer_name: string
  customer_phone: string
  address_line1: string
  address_neighborhood: string
  address_city: string
  address_state: string
  address_postal_code: string
}

type LogEntry = { ts: string; type: "req" | "res" | "err" | "info"; label: string; data: any }
type PurchaseResult = { success: boolean; msg: string; orderId?: string; paymentId?: string }

function maskNumber(n: string) {
  const c = n.replace(/\D/g, "")
  return c.length >= 4 ? "**** **** **** " + c.slice(-4) : n
}
function fmtCard(n: string) {
  return n.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").substring(0, 19)
}
function fmtExpiry(v: string) {
  const d = v.replace(/\D/g, "").substring(0, 4)
  return d.length >= 3 ? d.substring(0, 2) + "/" + d.substring(2) : d
}
function fmtCPF(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}
function fmtPhone(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2")
}
function fmtCEP(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{5})(\d)/, "$1-$2")
}

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]

const EMPTY_FORM = {
  label: "", card_number: "", card_expiry: "", card_cvv: "", card_name: "",
  customer_email: "", customer_cpf: "", customer_name: "", customer_phone: "",
  address_line1: "", address_neighborhood: "", address_city: "", address_state: "SP", address_postal_code: "",
}

export default function TesteCartaoPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // Purchase state
  const [buyModal, setBuyModal] = useState<Card | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [installments, setInstallments] = useState("1")
  const [buying, setBuying] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null)
  const [lastOrderId, setLastOrderId] = useState<string | null>(null)
  const [cancelingOrder, setCancelingOrder] = useState(false)

  const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 5000) }

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiCall("/admin/test-vault")
      setCards(data.cards || [])
    } catch {}
    setLoading(false)
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/store/products?limit=200`)
      const data = await res.json()
      setProducts(data.products || [])
    } catch {}
  }, [])

  useEffect(() => { loadCards(); loadProducts() }, [loadCards, loadProducts])

  function addLog(type: LogEntry["type"], label: string, data: any) {
    setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString("pt-BR"), type, label, data }])
  }

  async function handleSave() {
    if (!form.label || !form.card_number || !form.card_expiry || !form.card_cvv || !form.customer_email) {
      showMsg("Preencha label, numero, validade, CVV e email")
      return
    }
    setSaving(true)
    try {
      await apiCall("/admin/test-vault", {
        method: "POST",
        body: JSON.stringify({ action: "save", ...form }),
      })
      showMsg("Cartao salvo!")
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      await loadCards()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Remover cartao "${label}"?`)) return
    await apiCall("/admin/test-vault", { method: "POST", body: JSON.stringify({ action: "delete", id }) })
    showMsg("Removido")
    await loadCards()
  }

  function openBuy(card: Card) {
    setBuyModal(card)
    setLogs([])
    setPurchaseResult(null)
    setLastOrderId(null)
    setSelectedProduct("")
    setProductSearch("")
    setInstallments("1")
  }

  const filteredProducts = products.filter(p =>
    !productSearch || p.title?.toLowerCase().includes(productSearch.toLowerCase()) || p.handle?.includes(productSearch.toLowerCase())
  ).slice(0, 20)

  const selectedProd = products.find(p => p.id === selectedProduct)
  const prodPrice = selectedProd ? (selectedProd.variants?.[0]?.prices?.[0]?.amount ?? selectedProd.price ?? 0) : 0

  async function executePurchase(card: Card) {
    if (!selectedProduct) { showMsg("Selecione um produto"); return }
    setBuying(true)
    setPurchaseResult(null)
    setLastOrderId(null)

    const [expMonth, expYear] = card.card_expiry.split("/")
    const amountCents = prodPrice
    const cpfClean = card.customer_cpf.replace(/\D/g, "")
    const phoneClean = card.customer_phone.replace(/\D/g, "")
    const cepClean = card.address_postal_code.replace(/\D/g, "")

    // Step 1: create order
    const orderPayload = {
      action: "create",
      email: card.customer_email,
      name: card.customer_name,
      cpf: cpfClean,
      phone: phoneClean,
      items: [{
        product_id: selectedProduct,
        title: selectedProd?.title || selectedProd?.name || "Produto",
        sku: selectedProduct,
        quantity: 1,
        unit_price: amountCents,
      }],
      shipping: {
        address_line1: card.address_line1,
        address_line2: "",
        neighborhood: card.address_neighborhood,
        city: card.address_city,
        state: card.address_state,
        postal_code: cepClean,
      },
    }
    addLog("req", "POST /store/orders", orderPayload)

    let orderId: string | null = null
    try {
      const orderData = await fetch(`${API}/store/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      }).then(r => r.json())
      addLog("res", "Pedido criado", orderData)
      if (orderData.error) throw new Error(orderData.error)
      orderId = orderData.order?.id || null
      setLastOrderId(orderId)
    } catch (e: any) {
      addLog("err", "Erro ao criar pedido", { message: e.message })
      setPurchaseResult({ success: false, msg: "Erro ao criar pedido: " + e.message })
      setBuying(false)
      return
    }

    // Step 2: process payment
    const payPayload = {
      action: "card_pay",
      orderId,
      displayId: orderId!.substring(0, 8),
      amount: amountCents,
      customerEmail: card.customer_email,
      card: {
        number: card.card_number.replace(/\s/g, ""),
        expiry_month: expMonth,
        expiry_year: "20" + expYear,
        cvv: card.card_cvv,
        name: card.card_name,
      },
      items: [{ name: selectedProd?.title || "Produto", quantity: 1, unitPrice: amountCents }],
      installments: parseInt(installments),
    }
    addLog("req", "POST /store/payments", {
      ...payPayload,
      card: { ...payPayload.card, number: maskNumber(card.card_number), cvv: "***" },
    })

    try {
      const payData = await fetch(`${API}/store/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payPayload),
      }).then(r => r.json())
      addLog("res", "Resposta pagamento", payData)

      if (payData.paid) {
        setPurchaseResult({ success: true, msg: `APROVADO! Pedido: ${orderId?.substring(0, 8)} | Payment ID: ${payData.paymentId || payData.id || "---"}`, orderId: orderId!, paymentId: payData.paymentId })
      } else {
        setPurchaseResult({ success: false, msg: payData.error || payData.message || "Pagamento NAO aprovado", orderId: orderId! })
      }
    } catch (e: any) {
      addLog("err", "Erro no pagamento", { message: e.message })
      setPurchaseResult({ success: false, msg: "Erro: " + e.message, orderId: orderId! })
    }

    setBuying(false)
  }

  async function cancelTestOrder(orderId: string) {
    setCancelingOrder(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/admin/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "cancel", id: orderId }),
      })
      const data = await res.json()
      addLog("info", "Pedido cancelado", data)
      showMsg("Pedido cancelado")
      setPurchaseResult(prev => prev ? { ...prev, msg: prev.msg + " [CANCELADO]" } : null)
    } catch (e: any) {
      addLog("err", "Erro ao cancelar", { message: e.message })
    }
    setCancelingOrder(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Teste de Cartao</h2>
          <p className="text-zinc-500 text-sm mt-1">Cartoes salvos para validar o fluxo completo de compra antes do go-live</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadCards} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
          <button onClick={() => { setShowForm(true); setForm({ ...EMPTY_FORM }) }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ Adicionar Cartao</button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</div>
      )}

      {/* FORM ADICIONAR */}
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-zinc-800">Novo Cartao de Teste</h3>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600 text-xl">✕</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Label (identificacao)</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Visa Pessoal, Mastercard Teste" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Numero do Cartao</label>
              <input value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: fmtCard(e.target.value) }))} placeholder="0000 0000 0000 0000" maxLength={19} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Validade</label>
              <input value={form.card_expiry} onChange={e => setForm(f => ({ ...f, card_expiry: fmtExpiry(e.target.value) }))} placeholder="MM/AA" maxLength={5} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">CVV</label>
              <input value={form.card_cvv} onChange={e => setForm(f => ({ ...f, card_cvv: e.target.value.replace(/\D/g, "").substring(0, 4) }))} placeholder="000" maxLength={4} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Nome no Cartao</label>
              <input value={form.card_name} onChange={e => setForm(f => ({ ...f, card_name: e.target.value.toUpperCase() }))} placeholder="NOME SOBRENOME" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
            </div>

            <div className="border-t border-zinc-100 md:col-span-2 lg:col-span-3 pt-4 mt-2">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Dados do Cliente (para o pedido)</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Nome Completo</label>
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Maria Silva" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} placeholder="email@exemplo.com" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">CPF</label>
              <input value={form.customer_cpf} onChange={e => setForm(f => ({ ...f, customer_cpf: fmtCPF(e.target.value) }))} placeholder="000.000.000-00" maxLength={14} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Telefone</label>
              <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: fmtPhone(e.target.value) }))} placeholder="(11) 99999-9999" maxLength={15} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Endereco (Rua, Numero, Complemento)</label>
              <input value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} placeholder="Rua das Flores, 123, Apto 4" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Bairro</label>
              <input value={form.address_neighborhood} onChange={e => setForm(f => ({ ...f, address_neighborhood: e.target.value }))} placeholder="Centro" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Cidade</label>
              <input value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))} placeholder="Sao Paulo" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Estado</label>
              <select value={form.address_state} onChange={e => setForm(f => ({ ...f, address_state: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">CEP</label>
              <input value={form.address_postal_code} onChange={e => setForm(f => ({ ...f, address_postal_code: fmtCEP(e.target.value) }))} placeholder="00000-000" maxLength={9} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar Cartao"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-zinc-100 text-zinc-600 rounded-lg text-sm font-medium hover:bg-zinc-200">Cancelar</button>
          </div>
        </div>
      )}

      {/* LISTA DE CARTOES */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando...</div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 bg-white rounded-xl shadow">Nenhum cartao salvo. Clique em &quot;+ Adicionar Cartao&quot; para comecar.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map(card => (
            <div key={card.id} className="bg-white rounded-xl shadow p-5 border border-zinc-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-zinc-800">{card.label}</p>
                  <p className="font-mono text-sm text-zinc-500 mt-0.5">{maskNumber(card.card_number)}</p>
                </div>
                <button onClick={() => handleDelete(card.id, card.label)} className="text-zinc-300 hover:text-red-500 text-lg transition-colors">✕</button>
              </div>
              <div className="text-xs text-zinc-500 space-y-0.5 mb-4">
                <p><span className="font-semibold">Validade:</span> {card.card_expiry} &nbsp; <span className="font-semibold">CVV:</span> {"•".repeat(card.card_cvv.length)}</p>
                <p><span className="font-semibold">Nome:</span> {card.card_name}</p>
                <p><span className="font-semibold">Cliente:</span> {card.customer_name}</p>
                <p><span className="font-semibold">Email:</span> {card.customer_email}</p>
                <p><span className="font-semibold">CPF:</span> {card.customer_cpf}</p>
                {card.customer_phone && <p><span className="font-semibold">Tel:</span> {card.customer_phone}</p>}
                {card.address_city && <p><span className="font-semibold">Cidade:</span> {card.address_city}/{card.address_state}</p>}
              </div>
              <button onClick={() => openBuy(card)} className="w-full py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-700 transition-colors">
                Comprar com este cartao →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE COMPRA */}
      {buyModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4 pt-10">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="font-bold text-lg text-zinc-900">Compra com: {buyModal.label}</h3>
                <p className="text-sm text-zinc-500 font-mono">{maskNumber(buyModal.card_number)} — {buyModal.customer_name}</p>
              </div>
              <button onClick={() => setBuyModal(null)} className="text-zinc-400 hover:text-zinc-600 text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-x divide-zinc-100">
              {/* Left: config compra */}
              <div className="p-6 space-y-4">
                <h4 className="font-bold text-zinc-700 text-sm uppercase tracking-wide">Produto</h4>
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="max-h-52 overflow-y-auto border border-zinc-100 rounded-lg">
                  {filteredProducts.length === 0 && <p className="p-3 text-sm text-zinc-400">Nenhum produto</p>}
                  {filteredProducts.map(p => {
                    const price = p.variants?.[0]?.prices?.[0]?.amount ?? p.price ?? 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p.id)}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 border-b border-zinc-50 transition-colors ${selectedProduct === p.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-zinc-700"}`}
                      >
                        <span className="block truncate">{p.title || p.name}</span>
                        <span className="text-xs text-zinc-400">R$ {(price / 100).toFixed(2).replace(".", ",")}</span>
                      </button>
                    )
                  })}
                </div>

                {selectedProd && (
                  <div className="bg-zinc-50 rounded-lg p-3 text-sm">
                    <p className="font-bold text-zinc-800 truncate">{selectedProd.title || selectedProd.name}</p>
                    <p className="text-zinc-500">R$ {(prodPrice / 100).toFixed(2).replace(".", ",")}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Parcelas</label>
                  <select value={installments} onChange={e => setInstallments(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {[1,2,3,4,5,6].map(n => (
                      <option key={n} value={n}>{n}x de R$ {prodPrice > 0 ? ((prodPrice/100)/n).toFixed(2).replace(".",",") : "0,00"} sem juros</option>
                    ))}
                  </select>
                </div>

                {purchaseResult && (
                  <div className={`p-4 rounded-lg text-sm font-bold ${purchaseResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {purchaseResult.success ? "✓ " : "✗ "}{purchaseResult.msg}
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  {(!purchaseResult || !purchaseResult.success) && (
                    <button
                      onClick={() => executePurchase(buyModal)}
                      disabled={buying || !selectedProduct}
                      className="w-full py-3 bg-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {buying ? "Processando..." : purchaseResult ? "↺ Tentar Novamente" : "Finalizar Compra"}
                    </button>
                  )}
                  {purchaseResult?.success && purchaseResult.orderId && (
                    <button
                      onClick={() => cancelTestOrder(purchaseResult.orderId!)}
                      disabled={cancelingOrder}
                      className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelingOrder ? "Cancelando..." : "Cancelar Pedido de Teste"}
                    </button>
                  )}
                  {purchaseResult?.success && (
                    <p className="text-xs text-zinc-400 text-center">Pedido real criado no sistema. Cancele se nao quiser mante-lo.</p>
                  )}
                </div>
              </div>

              {/* Right: logs */}
              <div className="p-6 bg-zinc-950 rounded-r-2xl flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-zinc-300 text-sm font-mono">Console</h4>
                  <span className="text-xs text-zinc-600">{logs.length} log(s)</span>
                </div>
                <div className="flex-1 space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
                  {logs.length === 0 && <p className="text-zinc-600 italic">Aguardando compra...</p>}
                  {logs.map((log, i) => (
                    <div key={i} className="border-b border-zinc-800 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-zinc-600">{log.ts}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.type === "req" ? "bg-blue-900 text-blue-300" :
                          log.type === "res" ? "bg-green-900 text-green-300" :
                          log.type === "err" ? "bg-red-900 text-red-300" :
                          "bg-zinc-800 text-zinc-400"
                        }`}>{log.type}</span>
                        <span className="text-zinc-300 truncate">{log.label}</span>
                      </div>
                      <pre className="text-zinc-400 whitespace-pre-wrap break-all text-[11px] leading-relaxed pl-2">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
