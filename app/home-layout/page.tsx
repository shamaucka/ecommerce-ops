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

/* ===== TIPOS ===== */
interface BannerSection {
  type: "banner"
  image_mobile: string
  image_desktop: string
  link: string
  alt: string
}

interface VitrineSection {
  type: "vitrine"
  category_id: string
  title: string
  limit: number
}

type Section = BannerSection | VitrineSection

function emptyBanner(): BannerSection {
  return { type: "banner", image_mobile: "", image_desktop: "", link: "", alt: "" }
}

function emptyVitrine(): VitrineSection {
  return { type: "vitrine", category_id: "", title: "", limit: 8 }
}

/* ===== PAGINA PRINCIPAL ===== */
export default function HomeLayoutPage() {
  const [sections, setSections] = useState<Section[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [layoutData, catData] = await Promise.all([
        api("/admin/home-layout"),
        api("/admin/categories?action=list"),
      ])
      setSections(layoutData.sections || [])
      setCategories(catData.categories || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  const addSection = (type: "banner" | "vitrine") => {
    if (type === "banner") {
      setSections([...sections, emptyBanner()])
    } else {
      setSections([...sections, emptyVitrine()])
    }
    setAddMenuOpen(false)
  }

  const removeSection = (idx: number) => {
    if (!confirm("Remover esta secao?")) return
    setSections(sections.filter((_, i) => i !== idx))
  }

  const moveSection = (idx: number, direction: "up" | "down") => {
    const arr = [...sections]
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= arr.length) return
    ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
    setSections(arr)
  }

  const updateSection = (idx: number, field: string, value: any) => {
    const arr = [...sections]
    arr[idx] = { ...arr[idx], [field]: value } as Section
    setSections(arr)
  }

  const saveLayout = async () => {
    setSaving(true)
    try {
      await api("/admin/home-layout", {
        method: "POST",
        body: JSON.stringify({ action: "save", sections }),
      })
      showMsg("Layout salvo com sucesso!")
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Layout da Home</h2>
          <p className="text-zinc-500 text-sm mt-1">Configure as secoes da pagina inicial</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
          <button onClick={saveLayout} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar Layout"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando layout...</div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow p-5">
              {/* HEADER DA SECAO */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase bg-zinc-100 px-2 py-1 rounded">
                    {idx + 1}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    section.type === "banner" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {section.type === "banner" ? "Banner" : "Vitrine de Produtos"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveSection(idx, "up")}
                    disabled={idx === 0}
                    className="px-2 py-1 bg-zinc-100 rounded text-xs hover:bg-zinc-200 disabled:opacity-30"
                    title="Subir"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => moveSection(idx, "down")}
                    disabled={idx === sections.length - 1}
                    className="px-2 py-1 bg-zinc-100 rounded text-xs hover:bg-zinc-200 disabled:opacity-30"
                    title="Descer"
                  >
                    &#9660;
                  </button>
                  <button
                    onClick={() => removeSection(idx)}
                    className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200 ml-2"
                  >
                    Remover
                  </button>
                </div>
              </div>

              {/* CAMPOS DO BANNER */}
              {section.type === "banner" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Imagem Mobile (URL)</label>
                    <input
                      type="text"
                      value={(section as BannerSection).image_mobile}
                      onChange={(e) => updateSection(idx, "image_mobile", e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Imagem Desktop (URL)</label>
                    <input
                      type="text"
                      value={(section as BannerSection).image_desktop}
                      onChange={(e) => updateSection(idx, "image_desktop", e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Link</label>
                    <input
                      type="text"
                      value={(section as BannerSection).link}
                      onChange={(e) => updateSection(idx, "link", e.target.value)}
                      placeholder="/promocoes ou https://..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Texto Alternativo (Alt)</label>
                    <input
                      type="text"
                      value={(section as BannerSection).alt}
                      onChange={(e) => updateSection(idx, "alt", e.target.value)}
                      placeholder="Descricao do banner"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* Preview */}
                  {(section as BannerSection).image_desktop && (
                    <div className="col-span-2">
                      <p className="text-xs text-zinc-400 mb-1">Preview Desktop:</p>
                      <img
                        src={(section as BannerSection).image_desktop}
                        alt={(section as BannerSection).alt}
                        className="w-full max-h-40 object-cover rounded-lg border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CAMPOS DA VITRINE */}
              {section.type === "vitrine" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Titulo da Vitrine</label>
                    <input
                      type="text"
                      value={(section as VitrineSection).title}
                      onChange={(e) => updateSection(idx, "title", e.target.value)}
                      placeholder="Ex: Mais Vendidos"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Limite de Produtos</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={(section as VitrineSection).limit}
                      onChange={(e) => updateSection(idx, "limit", Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Categoria</label>
                    <select
                      value={(section as VitrineSection).category_id}
                      onChange={(e) => updateSection(idx, "category_id", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todas as categorias</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* BOTAO ADICIONAR */}
          <div className="relative">
            <button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="w-full py-4 border-2 border-dashed border-zinc-300 rounded-xl text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm font-medium"
            >
              + Adicionar Secao
            </button>
            {addMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-lg border p-2 z-10 flex gap-2">
                <button
                  onClick={() => addSection("banner")}
                  className="px-4 py-3 rounded-lg hover:bg-orange-50 text-sm font-medium flex flex-col items-center gap-1 min-w-[120px]"
                >
                  <span className="text-orange-600 text-lg">&#9881;</span>
                  <span>Banner</span>
                </button>
                <button
                  onClick={() => addSection("vitrine")}
                  className="px-4 py-3 rounded-lg hover:bg-blue-50 text-sm font-medium flex flex-col items-center gap-1 min-w-[120px]"
                >
                  <span className="text-blue-600 text-lg">&#9733;</span>
                  <span>Vitrine de Produtos</span>
                </button>
              </div>
            )}
          </div>

          {sections.length === 0 && !loading && (
            <div className="text-center py-8 text-zinc-400">Nenhuma secao configurada. Clique em &quot;Adicionar Secao&quot; para comecar.</div>
          )}
        </div>
      )}
    </div>
  )
}
