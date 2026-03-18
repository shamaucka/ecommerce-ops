"use client"

import { useState, useEffect, useCallback } from "react"

const API = "http://localhost:4000/api"

async function fetchAuth(path: string, options?: RequestInit) {
  const loginRes = await fetch(`${API}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sualoja.com.br", password: "admin123" }),
  })
  const { token } = await loginRes.json()
  return fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  }).then((r) => r.json())
}

export default function EstoquePage() {
  const [products, setProducts] = useState<any[]>([])
  const [stockMap, setStockMap] = useState<Record<string, any>>({})
  const [locations, setLocations] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"produtos" | "historico" | "localizacoes">("produtos")

  // Modal state
  const [modal, setModal] = useState<{ type: "entrada" | "saida" | "ajuste"; product: any } | null>(null)
  const [modalForm, setModalForm] = useState({ location_code: "", quantity: 0, cost_price: 0, reason: "", user_name: "", notes: "" })
  const [modalMsg, setModalMsg] = useState("")
  const [modalSaving, setModalSaving] = useState(false)

  // Loc modal
  const [showLocForm, setShowLocForm] = useState(false)
  const [locForm, setLocForm] = useState({ code: "", name: "", zone: "Picking", capacity: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    const [prodData, summaryData, locData, movData] = await Promise.all([
      fetchAuth("/admin/products?limit=200&fields=id,title,handle,thumbnail,status,variants.id,variants.title,variants.sku"),
      fetchAuth("/admin/estoque-ops?action=summary"),
      fetchAuth("/admin/estoque-ops?action=locations"),
      fetchAuth("/admin/estoque-ops?action=movements&limit=50"),
    ])
    setProducts(prodData.products || [])
    setLocations(locData.locations || [])
    setMovements(movData.movements || [])

    const map: Record<string, any> = {}
    for (const s of (summaryData.summary || [])) {
      map[s.sku] = s
    }
    setStockMap(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openModal = (type: "entrada" | "saida" | "ajuste", product: any) => {
    setModal({ type, product })
    setModalForm({ location_code: locations[0]?.code || "", quantity: 0, cost_price: 0, reason: "", user_name: "", notes: "" })
    setModalMsg("")
  }

  const submitModal = async () => {
    if (!modal) return
    const sku = modal.product.variants?.[0]?.sku
    if (!sku || !modalForm.location_code || modalForm.quantity <= 0) {
      setModalMsg("Preencha todos os campos obrigatorios")
      return
    }
    setModalSaving(true)
    try {
      const action = modal.type === "entrada" ? "entry" : modal.type === "saida" ? "exit" : "adjust"
      const payload: any = {
        action,
        sku,
        location_code: modalForm.location_code,
        user_name: modalForm.user_name,
        notes: modalForm.notes,
      }
      if (modal.type === "entrada") {
        payload.product_id = modal.product.id
        payload.product_title = modal.product.title
        payload.variant_title = modal.product.variants?.[0]?.title || ""
        payload.quantity = modalForm.quantity
        payload.cost_price = modalForm.cost_price
        payload.reason = modalForm.reason || "Compra de fornecedor"
      } else if (modal.type === "saida") {
        payload.quantity = modalForm.quantity
        payload.reason = modalForm.reason || "Saida manual"
      } else {
        payload.new_quantity = modalForm.quantity
      }

      const res = await fetchAuth("/admin/estoque-ops", { method: "POST", body: JSON.stringify(payload) })
      if (res.error) throw new Error(res.error)
      setModal(null)
      load()
    } catch (e: any) {
      setModalMsg("Erro: " + e.message)
    }
    setModalSaving(false)
  }

  const createLocation = async () => {
    if (!locForm.code) return
    await fetchAuth("/admin/estoque-ops", {
      method: "POST",
      body: JSON.stringify({ action: "create_location", ...locForm }),
    })
    setShowLocForm(false)
    setLocForm({ code: "", name: "", zone: "Picking", capacity: 0 })
    load()
  }

  const filtered = products.filter((p) =>
    !search ||
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.variants?.some((v: any) => v.sku?.toLowerCase().includes(search.toLowerCase()))
  )

  const totalStock = Object.values(stockMap).reduce((s: number, i: any) => s + (i.total || 0), 0)
  const totalValue = Object.values(stockMap).reduce((s: number, i: any) => s + (i.cost_total || 0), 0)

  const tabs = [
    { key: "produtos" as const, label: "Produtos e Estoque" },
    { key: "historico" as const, label: "Historico" },
    { key: "localizacoes" as const, label: "Localizacoes" },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Estoque</h2>
        <p className="text-zinc-500 text-sm mt-1">Controle de estoque por produto com entradas, saidas e historico</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-zinc-500">Produtos</div>
          <div className="text-2xl font-bold">{products.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-zinc-500">SKUs com Estoque</div>
          <div className="text-2xl font-bold">{Object.keys(stockMap).length}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-zinc-500">Total em Estoque</div>
          <div className="text-2xl font-bold">{totalStock} un</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-sm text-zinc-500">Valor Total (custo)</div>
          <div className="text-2xl font-bold">R$ {totalValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-200 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-white text-zinc-900 shadow" : "text-zinc-600 hover:text-zinc-900"}`}
          >{t.label}</button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-zinc-400">Carregando...</div>}

      {/* TAB: PRODUTOS E ESTOQUE */}
      {!loading && tab === "produtos" && (
        <>
          <div className="flex gap-4 mb-4">
            <input type="text" placeholder="Buscar por nome ou SKU..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-md px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={load} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-right">Estoque</th>
                  <th className="p-3 text-right">Custo Total</th>
                  <th className="p-3 text-left">Localizacoes</th>
                  <th className="p-3 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const sku = product.variants?.[0]?.sku || ""
                  const stock = stockMap[sku]
                  const qty = stock?.total || 0
                  const cost = stock?.cost_total || 0
                  return (
                    <tr key={product.id} className="border-b hover:bg-zinc-50">
                      <td className="p-3">
                        <div className="font-medium">{product.title}</div>
                        <div className="text-xs text-zinc-400">{product.handle}</div>
                      </td>
                      <td className="p-3 font-mono text-xs font-bold">{sku || "---"}</td>
                      <td className="p-3 text-right">
                        <span className={`font-bold ${qty === 0 ? "text-red-500" : qty <= 5 ? "text-orange-500" : "text-green-600"}`}>
                          {qty}
                        </span>
                      </td>
                      <td className="p-3 text-right text-zinc-600">{cost > 0 ? `R$ ${cost.toFixed(2)}` : "---"}</td>
                      <td className="p-3">
                        {stock?.locations?.map((loc: any) => (
                          <span key={loc.code} className="inline-block mr-1 mb-1 px-2 py-0.5 bg-zinc-100 rounded text-xs font-mono">
                            {loc.code}: {loc.quantity}
                          </span>
                        )) || <span className="text-zinc-400 text-xs">Sem estoque</span>}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => openModal("entrada", product)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">
                            +Entrada
                          </button>
                          <button onClick={() => openModal("saida", product)} disabled={qty === 0}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-30">
                            -Saida
                          </button>
                          <button onClick={() => openModal("ajuste", product)} disabled={qty === 0}
                            className="px-2 py-1 bg-yellow-600 text-white rounded text-xs font-medium hover:bg-yellow-700 disabled:opacity-30">
                            Ajuste
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-8 text-zinc-400">Nenhum produto encontrado</div>}
          </div>
        </>
      )}

      {/* TAB: HISTORICO */}
      {!loading && tab === "historico" && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Tipo</th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-right">Qtd</th>
                <th className="p-3 text-right">Antes</th>
                <th className="p-3 text-right">Depois</th>
                <th className="p-3 text-left">Local</th>
                <th className="p-3 text-left">Motivo</th>
                <th className="p-3 text-left">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m: any) => (
                <tr key={m.id} className="border-b hover:bg-zinc-50">
                  <td className="p-3 text-xs text-zinc-500">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      m.type === "entrada" ? "bg-green-100 text-green-700" :
                      m.type === "saida" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{m.type}</span>
                  </td>
                  <td className="p-3 font-mono font-bold">{m.sku}</td>
                  <td className={`p-3 text-right font-bold ${m.quantity >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="p-3 text-right text-zinc-500">{m.quantity_before}</td>
                  <td className="p-3 text-right font-medium">{m.quantity_after}</td>
                  <td className="p-3 font-mono text-xs">{m.location_code || "---"}</td>
                  <td className="p-3 text-xs">{m.reason || "---"}</td>
                  <td className="p-3 text-xs">{m.user_name || "---"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && <div className="text-center py-8 text-zinc-400">Nenhuma movimentacao</div>}
        </div>
      )}

      {/* TAB: LOCALIZACOES */}
      {!loading && tab === "localizacoes" && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowLocForm(!showLocForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              {showLocForm ? "Cancelar" : "Nova Localizacao"}
            </button>
          </div>
          {showLocForm && (
            <div className="bg-white rounded-xl shadow p-6 mb-4 max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Codigo</label>
                  <input value={locForm.code} onChange={(e) => setLocForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="A1-P2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Nome</label>
                  <input value={locForm.name} onChange={(e) => setLocForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Corredor A" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Zona</label>
                  <select value={locForm.zone} onChange={(e) => setLocForm(f => ({ ...f, zone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    {["Picking","Reserva","Devolucao","Avaria","Expedicao"].map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Capacidade</label>
                  <input type="number" value={locForm.capacity} onChange={(e) => setLocForm(f => ({ ...f, capacity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <button onClick={createLocation} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Criar
              </button>
            </div>
          )}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="p-3 text-left">Codigo</th>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Zona</th>
                  <th className="p-3 text-right">Capacidade</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l: any) => (
                  <tr key={l.id} className="border-b hover:bg-zinc-50">
                    <td className="p-3 font-mono font-bold">{l.code}</td>
                    <td className="p-3">{l.name || "---"}</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-zinc-100 rounded text-xs">{l.zone || "---"}</span></td>
                    <td className="p-3 text-right">{l.capacity || "---"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${l.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {l.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {locations.length === 0 && <div className="text-center py-8 text-zinc-400">Nenhuma localizacao</div>}
          </div>
        </>
      )}

      {/* MODAL ENTRADA/SAIDA/AJUSTE */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">
              {modal.type === "entrada" ? "Entrada de Estoque" : modal.type === "saida" ? "Saida de Estoque" : "Ajuste de Inventario"}
            </h3>
            <p className="text-sm text-zinc-500 mb-4">
              {modal.product.title} — SKU: {modal.product.variants?.[0]?.sku}
            </p>

            {modalMsg && (
              <div className={`mb-3 p-2 rounded text-sm ${modalMsg.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {modalMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Localizacao</label>
                <select value={modalForm.location_code} onChange={(e) => setModalForm(f => ({ ...f, location_code: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  <option value="">Selecione...</option>
                  {locations.map((l: any) => <option key={l.id} value={l.code}>{l.code} - {l.name || l.zone}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  {modal.type === "ajuste" ? "Nova Quantidade" : "Quantidade"}
                </label>
                <input type="number" min="0" value={modalForm.quantity}
                  onChange={(e) => setModalForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>

              {modal.type === "entrada" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Custo Unitario (R$)</label>
                  <input type="number" step="0.01" value={modalForm.cost_price}
                    onChange={(e) => setModalForm(f => ({ ...f, cost_price: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Motivo</label>
                <input value={modalForm.reason} onChange={(e) => setModalForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder={modal.type === "entrada" ? "Compra de fornecedor" : modal.type === "saida" ? "Venda / avaria" : "Contagem fisica"} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Responsavel</label>
                <input value={modalForm.user_name} onChange={(e) => setModalForm(f => ({ ...f, user_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nome" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-zinc-50">
                Cancelar
              </button>
              <button onClick={submitModal} disabled={modalSaving}
                className={`flex-1 py-2 text-white rounded-lg text-sm font-bold disabled:opacity-50 ${
                  modal.type === "entrada" ? "bg-green-600 hover:bg-green-700" :
                  modal.type === "saida" ? "bg-red-600 hover:bg-red-700" :
                  "bg-yellow-600 hover:bg-yellow-700"
                }`}>
                {modalSaving ? "Salvando..." : modal.type === "entrada" ? "Registrar Entrada" : modal.type === "saida" ? "Registrar Saida" : "Ajustar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
