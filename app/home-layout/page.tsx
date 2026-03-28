"use client"

import { useState, useEffect, useCallback } from "react"

import { API, API_HOST, ADMIN_EMAIL, ADMIN_PASS } from "../lib/api-url"

let _tc: { token: string; ts: number } | null = null
async function getToken() {
  if (_tc && Date.now() - _tc.ts < 300000) return _tc.token
  const res = await fetch(API + "/auth/user/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  })
  const d = await res.json()
  _tc = { token: d.token, ts: Date.now() }
  return d.token
}
async function apiFetch(path: string, opts?: RequestInit) {
  const token = await getToken()
  const res = await fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...opts?.headers },
  })
  return res.json()
}

async function uploadFile(file: File): Promise<string> {
  const token = await getToken()
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(API + "/admin/uploads", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: fd,
  })
  const data = await res.json()
  if (data.files && data.files[0]) {
    const url = data.files[0].url
    return url.startsWith("http") ? url : API_HOST + url
  }
  return ""
}

interface BannerData {
  type: "banner"
  image_mobile: string
  image_desktop: string
  link: string
  alt: string
}

interface VitrineData {
  type: "vitrine"
  title: string
  limit: number
  category_id: string
  sort_by: string
}

type SectionData = BannerData | VitrineData

export default function HomeLayoutPage() {
  const [sections, setSections] = useState<SectionData[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [layoutData, catData] = await Promise.all([
        apiFetch("/admin/home-layout"),
        apiFetch("/admin/categories?action=list"),
      ])
      setSections(layoutData.layout?.sections || layoutData.sections || [])
      setCategories(catData.categories || catData || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch("/admin/home-layout", { method: "POST", body: JSON.stringify({ action: "save", sections }) })
      setMessage("Layout salvo!")
      setTimeout(() => setMessage(""), 3000)
    } catch (e: any) {
      setMessage("Erro: " + e.message)
    }
    setSaving(false)
  }

  const add = (type: "banner" | "vitrine") => {
    if (type === "banner") {
      setSections([...sections, { type: "banner", image_mobile: "", image_desktop: "", link: "/quadros", alt: "Banner" }])
    } else {
      setSections([...sections, { type: "vitrine", title: "Mais Vendidos", limit: 8, category_id: "", sort_by: "recent" }])
    }
  }

  const remove = (i: number) => {
    setSections(sections.filter((_, idx) => idx !== i))
  }

  const move = (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= sections.length) return
    const arr = [...sections]
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
    setSections(arr)
  }

  const update = (i: number, key: string, val: any) => {
    const arr = [...sections]
    arr[i] = { ...arr[i], [key]: val } as any
    setSections(arr)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Layout da Home</h2>
          <p className="text-zinc-500 text-sm mt-1">Arraste e configure as secoes da pagina inicial</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => add("banner")} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">+ Banner</button>
          <button onClick={() => add("vitrine")} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800">+ Vitrine</button>
          <button onClick={save} disabled={saving} className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar Layout"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg text-sm font-medium bg-green-50 text-green-700">{message}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando...</div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">Nenhuma secao configurada. Adicione Banners e Vitrines acima.</div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded">{i + 1}</span>
                  <span className={sec.type === "banner" ? "px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700" : "px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700"}>
                    {sec.type === "banner" ? "Banner" : "Vitrine de Produtos"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-1 bg-zinc-100 rounded text-xs hover:bg-zinc-200 disabled:opacity-30">Up</button>
                  <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="px-2 py-1 bg-zinc-100 rounded text-xs hover:bg-zinc-200 disabled:opacity-30">Down</button>
                  <button onClick={() => remove(i)} className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200 ml-2">Remover</button>
                </div>
              </div>

              {sec.type === "banner" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <UploadField label="Imagem Mobile (4:5)" value={(sec as BannerData).image_mobile} onChange={(v) => update(i, "image_mobile", v)} />
                    <UploadField label="Imagem Desktop (16:9)" value={(sec as BannerData).image_desktop} onChange={(v) => update(i, "image_desktop", v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 mb-1">Link</label>
                      <input type="text" value={(sec as BannerData).link} onChange={(e) => update(i, "link", e.target.value)} placeholder="/quadros" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 mb-1">Texto Alt</label>
                      <input type="text" value={(sec as BannerData).alt} onChange={(e) => update(i, "alt", e.target.value)} placeholder="Banner promocional" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Titulo da Vitrine</label>
                    <input type="text" value={(sec as VitrineData).title} onChange={(e) => update(i, "title", e.target.value)} placeholder="Mais Vendidos" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Quantidade de Produtos</label>
                    <input type="number" value={(sec as VitrineData).limit} onChange={(e) => update(i, "limit", Number(e.target.value))} min={1} max={48} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Categoria</label>
                    <select value={(sec as VitrineData).category_id} onChange={(e) => update(i, "category_id", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                      <option value="">Todas</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">Ordenar por</label>
                    <select value={(sec as VitrineData).sort_by || "recent"} onChange={(e) => update(i, "sort_by", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                      <option value="recent">Mais Recentes</option>
                      <option value="menor-preco">Menor Preco</option>
                      <option value="maior-preco">Maior Preco</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UploadField(props: { label: string; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false)

  return (
    <div>
      <p className="text-xs font-semibold text-zinc-600 mb-1">{props.label}</p>
      {props.value ? (
        <div className="mb-2 border rounded-lg overflow-hidden bg-zinc-50">
          <img src={props.value} alt="" className="w-full h-32 object-cover" />
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder="URL da imagem"
          className="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <label className={busy ? "px-3 py-2 rounded-lg text-sm font-medium bg-zinc-200 text-zinc-500 cursor-wait" : "px-3 py-2 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"}>
          {busy ? "..." : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setBusy(true)
              const url = await uploadFile(f)
              if (url) props.onChange(url)
              setBusy(false)
            }}
          />
        </label>
      </div>
    </div>
  )
}
