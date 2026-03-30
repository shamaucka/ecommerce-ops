"use client"

import { useState, useEffect, useCallback, useMemo } from "react"

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

/* ===== TIPOS ===== */
interface PromoForm {
  name: string
  type: string
  code: string
  discount_type: string
  discount_value: string
  min_purchase: string
  category: string
  min_items: string
  max_uses: string
  valid_from: string
  valid_until: string
  active: boolean
}

const emptyForm: PromoForm = {
  name: "",
  type: "cupom",
  code: "",
  discount_type: "percentual",
  discount_value: "",
  min_purchase: "",
  category: "",
  min_items: "",
  max_uses: "",
  valid_from: "",
  valid_until: "",
  active: true,
}

const TYPE_LABELS: Record<string, string> = {
  cupom: "Cupom",
  regra: "Regra",
}

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentual: "Percentual",
  fixo: "Fixo (R$)",
}

function formatBRL(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(dateStr: string) {
  if (!dateStr) return "---"
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/* ===== PAGINA PRINCIPAL ===== */
export default function PromocoesPage() {
  const [promotions, setPromotions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [form, setForm] = useState<PromoForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [promoData, catData] = await Promise.all([
        api("/admin/promotions?action=list"),
        api("/admin/categories?action=list"),
      ])
      setPromotions(promoData.promotions || [])
      setCategories(catData.categories || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ===== SUMMARY STATS ===== */
  const stats = useMemo(() => {
    const now = new Date()
    let active = 0
    let expired = 0
    for (const p of promotions) {
      const isExpired = p.valid_until && new Date(p.valid_until) < now
      if (p.active && !isExpired) active++
      else if (isExpired) expired++
    }
    return { total: promotions.length, active, expired }
  }, [promotions])

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      showMsg("Erro ao copiar codigo")
    }
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setMode("create")
    setMessage("")
  }

  const openEdit = (promo: any) => {
    const discountForForm =
      promo.discount_type === "fixo" && promo.discount_value != null
        ? String(promo.discount_value / 100)
        : promo.discount_value != null
          ? String(promo.discount_value)
          : ""

    setForm({
      name: promo.name || "",
      type: promo.type || "cupom",
      code: promo.code || "",
      discount_type: promo.discount_type || "percentual",
      discount_value: discountForForm,
      min_purchase: promo.min_purchase != null ? String(promo.min_purchase) : "",
      category: promo.category || promo.category_id || "",
      min_items: promo.min_items != null ? String(promo.min_items) : "",
      max_uses: promo.max_uses != null ? String(promo.max_uses) : "",
      valid_from: promo.valid_from ? promo.valid_from.slice(0, 10) : "",
      valid_until: promo.valid_until ? promo.valid_until.slice(0, 10) : "",
      active: promo.active !== false,
    })
    setEditingId(promo.id)
    setMode("edit")
    setMessage("")
  }

  const savePromotion = async () => {
    if (!form.name.trim()) { showMsg("Erro: Nome obrigatorio"); return }
    if (!form.discount_value) { showMsg("Erro: Valor do desconto obrigatorio"); return }
    setSaving(true)
    try {
      const rawValue = Number(form.discount_value)
      const discountValue = form.discount_type === "fixo" ? Math.round(rawValue * 100) : rawValue

      const payload: any = {
        action: editingId ? "update" : "create",
        name: form.name,
        type: form.type,
        code: form.code || undefined,
        discount_type: form.discount_type,
        discount_value: discountValue,
        min_purchase: form.min_purchase ? Number(form.min_purchase) : undefined,
        category: form.category || undefined,
        min_items: form.min_items ? Number(form.min_items) : undefined,
        max_uses: form.max_uses ? Number(form.max_uses) : undefined,
        valid_from: form.valid_from || undefined,
        valid_until: form.valid_until || undefined,
        active: form.active,
      }
      if (editingId) payload.id = editingId

      await api("/admin/promotions", { method: "POST", body: JSON.stringify(payload) })
      showMsg(editingId ? "Promocao atualizada!" : "Promocao criada!")
      await loadData()
      setMode("list")
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
    setSaving(false)
  }

  const deletePromotion = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return
    try {
      await api("/admin/promotions", { method: "POST", body: JSON.stringify({ action: "delete", id }) })
      showMsg("Promocao excluida!")
      await loadData()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const update = (field: keyof PromoForm, value: any) => {
    setForm({ ...form, [field]: value })
  }

  /* ===== RENDER FORMULARIO ===== */
  if (mode !== "list") {
    return (
      <div>
        <button onClick={() => { setMode("list"); setMessage("") }} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar para lista
        </button>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{editingId ? "Editar Promocao" : "Nova Promocao"}</h2>
          <button onClick={savePromotion} disabled={saving} className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">
            {saving ? "Salvando..." : editingId ? "Salvar Alteracoes" : "Criar Promocao"}
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          <section className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4 pb-2 border-b">Informacoes Basicas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Nome <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Black Friday 2026" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Tipo</label>
                <select value={form.type} onChange={(e) => update("type", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-500">
                  <option value="cupom">Cupom</option>
                  <option value="regra">Regra Automatica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Codigo do Cupom</label>
                <input type="text" value={form.code} onChange={(e) => update("code", e.target.value.toUpperCase())} placeholder="DESCONTO10" className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4 pb-2 border-b">Desconto</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Tipo de Desconto</label>
                <select value={form.discount_type} onChange={(e) => update("discount_type", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-500">
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Valor do Desconto <span className="text-red-500">*</span></label>
                <input type="number" value={form.discount_value} onChange={(e) => update("discount_value", e.target.value)} placeholder={form.discount_type === "percentual" ? "10" : "50.00"} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Compra Minima (R$)</label>
                <input type="number" value={form.min_purchase} onChange={(e) => update("min_purchase", e.target.value)} placeholder="100.00" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4 pb-2 border-b">Restricoes</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Categoria</label>
                <select value={form.category} onChange={(e) => update("category", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-500">
                  <option value="">Todas</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Itens Minimos</label>
                <input type="number" value={form.min_items} onChange={(e) => update("min_items", e.target.value)} placeholder="1" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Usos Maximos</label>
                <input type="number" value={form.max_uses} onChange={(e) => update("max_uses", e.target.value)} placeholder="100" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4 pb-2 border-b">Validade</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Valido de</label>
                <input type="date" value={form.valid_from} onChange={(e) => update("valid_from", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Valido ate</label>
                <input type="date" value={form.valid_until} onChange={(e) => update("valid_until", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500" />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <label className="text-xs font-semibold text-zinc-600">Ativa</label>
                <button
                  type="button"
                  onClick={() => update("active", !form.active)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.active ? "bg-zinc-900" : "bg-zinc-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-6" : ""}`} />
                </button>
                <span className="text-sm text-zinc-500">{form.active ? "Sim" : "Nao"}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  /* ===== RENDER LISTA ===== */
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Promocoes</h2>
          <p className="text-zinc-500 text-sm mt-1">{promotions.length} promocao(oes) cadastrada(s)</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
          <button onClick={openCreate} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800">+ Nova Promocao</button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-2xl font-bold text-zinc-800">{stats.total}</p>
          <p className="text-xs text-zinc-500 mt-1">Total de Promocoes</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-zinc-500 mt-1">Ativas</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
          <p className="text-xs text-zinc-500 mt-1">Expiradas</p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando promocoes...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Codigo</th>
                <th className="p-3 text-center">Tipo</th>
                <th className="p-3 text-center">Desconto</th>
                <th className="p-3 text-center">Usos</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-left">Validade</th>
                <th className="p-3 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => {
                const now = new Date()
                const isExpired = promo.valid_until && new Date(promo.valid_until) < now
                const isActive = promo.active && !isExpired
                const discountLabel = promo.discount_type === "percentual"
                  ? `${promo.discount_value}%`
                  : formatBRL(promo.discount_value)

                return (
                  <tr key={promo.id} className="border-b hover:bg-zinc-50">
                    <td className="p-3 font-medium">{promo.name}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{promo.code || "---"}</span>
                        {promo.code && (
                          <button
                            onClick={() => copyCode(promo.code)}
                            title="Copiar Codigo"
                            className="p-1 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors"
                          >
                            {copiedCode === promo.code ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${promo.type === "cupom" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {TYPE_LABELS[promo.type] || promo.type}
                      </span>
                    </td>
                    <td className="p-3 text-center font-medium text-green-600">{discountLabel}</td>
                    <td className="p-3 text-center text-xs">{promo.used_count ?? 0}/{promo.max_uses || "ilim."}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        isActive ? "bg-green-100 text-green-700" : isExpired ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-500"
                      }`}>
                        {isActive ? "Ativa" : isExpired ? "Expirada" : "Inativa"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-zinc-500">
                      {promo.valid_from ? formatDate(promo.valid_from) : "---"} a {promo.valid_until ? formatDate(promo.valid_until) : "---"}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(promo)} className="px-2 py-1 bg-zinc-900 text-white rounded text-xs hover:bg-zinc-800">Editar</button>
                        <button onClick={() => deletePromotion(promo.id, promo.name)} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {promotions.length === 0 && (
            <div className="text-center py-8 text-zinc-400">Nenhuma promocao cadastrada</div>
          )}
        </div>
      )}
    </div>
  )
}
