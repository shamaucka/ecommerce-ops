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

/* ===== SLUG GENERATOR ===== */
function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/* ===== TIPOS ===== */
interface CategoryForm {
  name: string
  slug: string
  description: string
  seo_title: string
  seo_description: string
  image_url: string
  parent_id: string
  position: string
  active: boolean
}

const emptyForm: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  seo_title: "",
  seo_description: "",
  image_url: "",
  parent_id: "",
  position: "0",
  active: true,
}

/* ===== PAGINA PRINCIPAL ===== */
export default function CategoriasPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [form, setForm] = useState<CategoryForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api("/admin/categories?action=list")
      setCategories(data.categories || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setMode("create")
    setMessage("")
  }

  const openEdit = (cat: any) => {
    setForm({
      name: cat.name || "",
      slug: cat.slug || "",
      description: cat.description || "",
      seo_title: cat.seo_title || "",
      seo_description: cat.seo_description || "",
      image_url: cat.image_url || "",
      parent_id: cat.parent_id || "",
      position: cat.position != null ? String(cat.position) : "0",
      active: cat.active !== false,
    })
    setEditingId(cat.id)
    setMode("edit")
    setMessage("")
  }

  const saveCategory = async () => {
    if (!form.name.trim()) { showMsg("Erro: Nome obrigatorio"); return }
    setSaving(true)
    try {
      const slug = form.slug || slugify(form.name)
      const payload: any = {
        action: editingId ? "update" : "create",
        name: form.name,
        slug,
        description: form.description || undefined,
        seo_title: form.seo_title || undefined,
        seo_description: form.seo_description || undefined,
        image_url: form.image_url || undefined,
        parent_id: form.parent_id || undefined,
        position: form.position ? Number(form.position) : 0,
        active: form.active,
      }
      if (editingId) payload.id = editingId

      await api("/admin/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      showMsg(editingId ? "Categoria atualizada com sucesso!" : "Categoria criada com sucesso!")
      await loadCategories()
      setMode("list")
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
    setSaving(false)
  }

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return
    try {
      await api("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      })
      showMsg("Categoria excluida!")
      await loadCategories()
    } catch (e: any) {
      showMsg("Erro ao excluir: " + e.message)
    }
  }

  const movePosition = async (cat: any, direction: "up" | "down") => {
    const sorted = [...categories].sort((a, b) => (a.position || 0) - (b.position || 0))
    const idx = sorted.findIndex((c) => c.id === cat.id)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    try {
      await api("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ action: "update", id: cat.id, position: sorted[swapIdx].position ?? swapIdx }),
      })
      await api("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ action: "update", id: sorted[swapIdx].id, position: cat.position ?? idx }),
      })
      await loadCategories()
    } catch (e: any) {
      showMsg("Erro ao reordenar: " + e.message)
    }
  }

  const update = (field: keyof CategoryForm, value: any) => {
    const updated = { ...form, [field]: value }
    if (field === "name" && !editingId) {
      updated.slug = slugify(value)
    }
    if (field === "name" && !form.seo_title) {
      updated.seo_title = value
    }
    setForm(updated)
  }

  /* ===== RENDER FORMULARIO ===== */
  if (mode !== "list") {
    const parentOptions = categories.filter((c) => c.id !== editingId)
    return (
      <div>
        <button onClick={() => { setMode("list"); setMessage("") }} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar para lista
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{editingId ? "Editar Categoria" : "Nova Categoria"}</h2>
            {form.slug && <p className="text-zinc-500 text-sm mt-1">/{form.slug}</p>}
          </div>
          <button onClick={saveCategory} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Salvando..." : editingId ? "Salvar Alteracoes" : "Criar Categoria"}
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
                <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Quadros Decorativos" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Slug / URL</label>
                <input type="text" value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="quadros-decorativos" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Categoria Pai</label>
                <select value={form.parent_id} onChange={(e) => update("parent_id", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Nenhuma (raiz)</option>
                  {parentOptions.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Descricao</label>
                <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Descricao da categoria..." className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">URL da Imagem</label>
                <input type="text" value={form.image_url} onChange={(e) => update("image_url", e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Posicao</label>
                <input type="number" value={form.position} onChange={(e) => update("position", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <label className="text-xs font-semibold text-zinc-600">Ativa</label>
                <button
                  type="button"
                  onClick={() => update("active", !form.active)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.active ? "bg-blue-600" : "bg-zinc-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-6" : ""}`} />
                </button>
                <span className="text-sm text-zinc-500">{form.active ? "Sim" : "Nao"}</span>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4 pb-2 border-b">SEO</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Titulo SEO</label>
                <input type="text" value={form.seo_title} onChange={(e) => update("seo_title", e.target.value)} placeholder="Titulo para motores de busca" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Descricao SEO</label>
                <textarea value={form.seo_description} onChange={(e) => update("seo_description", e.target.value)} placeholder="Meta description para SEO..." className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} maxLength={160} />
                <p className="text-xs text-zinc-400 mt-1">{form.seo_description.length}/160 caracteres</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  /* ===== RENDER LISTA ===== */
  const sorted = [...categories].sort((a, b) => (a.position || 0) - (b.position || 0))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Categorias</h2>
          <p className="text-zinc-500 text-sm mt-1">{categories.length} categoria(s) cadastrada(s)</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadCategories} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ Nova Categoria</button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando categorias...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="p-3 text-left w-16">Pos.</th>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Slug</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ordem</th>
                <th className="p-3 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cat, idx) => (
                <tr key={cat.id} className="border-b hover:bg-zinc-50">
                  <td className="p-3 text-zinc-500 font-mono text-xs">{cat.position ?? idx}</td>
                  <td className="p-3">
                    <div className="font-medium">{cat.name}</div>
                    {cat.parent_id && <div className="text-xs text-zinc-400">Sub-categoria</div>}
                  </td>
                  <td className="p-3 text-xs text-zinc-500 font-mono">{cat.slug}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${cat.active !== false ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {cat.active !== false ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => movePosition(cat, "up")} disabled={idx === 0} className="px-2 py-1 bg-zinc-100 rounded text-xs hover:bg-zinc-200 disabled:opacity-30" title="Subir">&#9650;</button>
                      <button onClick={() => movePosition(cat, "down")} disabled={idx === sorted.length - 1} className="px-2 py-1 bg-zinc-100 rounded text-xs hover:bg-zinc-200 disabled:opacity-30" title="Descer">&#9660;</button>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(cat)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Editar</button>
                      <button onClick={() => deleteCategory(cat.id, cat.name)} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.length === 0 && (
            <div className="text-center py-8 text-zinc-400">Nenhuma categoria cadastrada</div>
          )}
        </div>
      )}
    </div>
  )
}
