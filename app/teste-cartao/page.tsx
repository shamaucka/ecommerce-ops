"use client"

import { useState } from "react"
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

type LogEntry = {
  ts: string
  type: "req" | "res" | "err" | "info"
  label: string
  data: any
}

function maskCard(num: string) {
  const clean = num.replace(/\D/g, "")
  if (clean.length < 4) return num
  return "**** **** **** " + clean.slice(-4)
}

export default function TesteCartaoPage() {
  const [cardNumber, setCardNumber] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  const [name, setName] = useState("")
  const [installments, setInstallments] = useState("1")
  const [amount, setAmount] = useState("99.90")
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null)

  function addLog(type: LogEntry["type"], label: string, data: any) {
    setLogs((prev) => [
      ...prev,
      { ts: new Date().toLocaleTimeString("pt-BR"), type, label, data },
    ])
  }

  function clearLogs() {
    setLogs([])
    setResult(null)
  }

  function maskCardNumber(v: string) {
    return v.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").substring(0, 19)
  }
  function maskExpiry(v: string) {
    const d = v.replace(/\D/g, "").substring(0, 4)
    return d.length >= 3 ? d.substring(0, 2) + "/" + d.substring(2) : d
  }

  async function handleTest() {
    const cleanNum = cardNumber.replace(/\s/g, "")
    if (!cleanNum || cleanNum.length < 13) { alert("Numero do cartao invalido"); return }
    if (!expiry || expiry.length < 5) { alert("Validade invalida (MM/AA)"); return }
    if (!cvv || cvv.length < 3) { alert("CVV invalido"); return }
    if (!name.trim()) { alert("Nome no cartao obrigatorio"); return }

    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100)
    if (!amountCents || amountCents <= 0) { alert("Valor invalido"); return }

    clearLogs()
    setLoading(true)

    const [expMonth, expYear] = expiry.split("/")
    const cardPayload = {
      number: cleanNum,
      expiry_month: expMonth,
      expiry_year: "20" + expYear,
      cvv,
      name: name.toUpperCase(),
    }

    addLog("info", "Iniciando teste", {
      cartao: maskCard(cleanNum),
      validade: expiry,
      nome: name,
      valor: `R$ ${amount}`,
      parcelas: installments,
    })

    // Step 1: create test order
    addLog("req", "POST /store/orders", {
      action: "create",
      email: ADMIN_EMAIL,
      name: "Teste Admin",
      cpf: "00000000000",
      phone: "00000000000",
      items: [{ product_id: "test", title: "Teste Cartao", sku: "test", quantity: 1, unit_price: amountCents }],
      shipping: { address_line1: "Rua Teste, 1", neighborhood: "Centro", city: "Sao Paulo", state: "SP", postal_code: "01310100" },
    })

    let orderId: string | null = null
    try {
      const orderData = await apiCall("/store/orders", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          email: ADMIN_EMAIL,
          name: "Teste Admin",
          cpf: "00000000000",
          phone: "00000000000",
          items: [{ product_id: "test", title: "Teste Cartao", sku: "test", quantity: 1, unit_price: amountCents }],
          shipping: { address_line1: "Rua Teste, 1", neighborhood: "Centro", city: "Sao Paulo", state: "SP", postal_code: "01310100" },
        }),
      })
      addLog("res", "Pedido criado", { orderId: orderData.order?.id, displayId: orderData.order?.display_id, error: orderData.error })
      orderId = orderData.order?.id || null
    } catch (e: any) {
      addLog("err", "Erro ao criar pedido", { message: e.message })
      setLoading(false)
      setResult({ success: false, msg: "Erro ao criar pedido de teste: " + e.message })
      return
    }

    if (!orderId) {
      setLoading(false)
      setResult({ success: false, msg: "Pedido de teste nao foi criado" })
      return
    }

    // Step 2: process card payment
    const payPayload = {
      action: "card_pay",
      orderId,
      displayId: orderId.substring(0, 8),
      amount: amountCents,
      customerEmail: ADMIN_EMAIL,
      card: cardPayload,
      items: [{ name: "Teste Cartao", quantity: 1, unitPrice: amountCents }],
      installments: parseInt(installments),
    }
    addLog("req", "POST /store/payments (card_pay)", {
      ...payPayload,
      card: { ...payPayload.card, number: maskCard(cleanNum), cvv: "***" },
    })

    try {
      const payData = await apiCall("/store/payments", {
        method: "POST",
        body: JSON.stringify(payPayload),
      })
      addLog("res", "Resposta pagamento", payData)

      if (payData.paid) {
        setResult({ success: true, msg: `Pagamento APROVADO! ID: ${payData.paymentId || payData.id || orderId}` })
        // Cancel the test order immediately
        try {
          await apiCall("/admin/orders", {
            method: "POST",
            body: JSON.stringify({ action: "cancel", id: orderId }),
          })
          addLog("info", "Pedido de teste cancelado automaticamente", { orderId })
        } catch {}
      } else {
        setResult({ success: false, msg: payData.error || "Pagamento NAO aprovado" })
      }
    } catch (e: any) {
      addLog("err", "Erro no pagamento", { message: e.message })
      setResult({ success: false, msg: "Erro no pagamento: " + e.message })
    }

    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Teste de Cartao</h2>
        <p className="text-zinc-500 text-sm mt-1">Teste o processamento de pagamento com seus proprios cartoes. Pedidos de teste sao cancelados automaticamente.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h3 className="font-bold text-zinc-800 mb-4">Dados do Cartao</h3>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Numero do Cartao</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Validade</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(maskExpiry(e.target.value))}
                placeholder="MM/AA"
                maxLength={5}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">CVV</label>
              <input
                type="text"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").substring(0, 4))}
                placeholder="000"
                maxLength={4}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Nome no Cartao</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="NOME SOBRENOME"
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Valor (R$)</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="99.90"
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Parcelas</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}x sem juros</option>
                ))}
              </select>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-lg text-sm font-bold ${result.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {result.success ? "✓ " : "✗ "}{result.msg}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleTest}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processando..." : "Testar Pagamento"}
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-3 bg-zinc-100 text-zinc-600 rounded-lg text-sm font-medium hover:bg-zinc-200"
            >
              Limpar
            </button>
          </div>

          <p className="text-[11px] text-zinc-400">O cartao nao sera salvo. O pedido de teste e cancelado automaticamente apos o teste.</p>
        </div>

        {/* Logs */}
        <div className="bg-zinc-950 rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-300 text-sm font-mono">Console de Logs</h3>
            <span className="text-xs text-zinc-500">{logs.length} entrada(s)</span>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto font-mono text-xs">
            {logs.length === 0 && (
              <p className="text-zinc-600 italic">Aguardando teste...</p>
            )}
            {logs.map((log, i) => (
              <div key={i} className="border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-zinc-500">{log.ts}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    log.type === "req" ? "bg-blue-900 text-blue-300" :
                    log.type === "res" ? "bg-green-900 text-green-300" :
                    log.type === "err" ? "bg-red-900 text-red-300" :
                    "bg-zinc-800 text-zinc-400"
                  }`}>{log.type}</span>
                  <span className="text-zinc-300">{log.label}</span>
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
  )
}
