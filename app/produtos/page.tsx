"use client"

import { useState, useEffect, useCallback } from "react"

import { API, API_HOST, ADMIN_EMAIL, ADMIN_PASS } from "../lib/api-url"

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

async function uploadFile(file: File): Promise<string> {
  const token = await getToken()
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${API}/admin/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json()
  if (data.files && data.files[0]) return API_HOST + data.files[0].url
  return ""
}

/* ===== CATEGORIAS PADRAO ===== */
const CATEGORIAS = [
  "Quadros Decorativos",
  "Camisetas",
  "Calcas",
  "Acessorios",
  "Calcados",
  "Bolsas",
  "Decoracao",
  "Eletronicos",
  "Outros",
]

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "proposed", label: "Proposto" },
  { value: "rejected", label: "Rejeitado" },
]

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
interface ProductForm {
  title: string
  handle: string
  subtitle: string
  description: string
  status: string
  category: string
  tags: string
  sku: string
  barcode: string
  ean: string
  weight: string
  length: string
  width: string
  height: string
  material: string
  origin_country: string
  mid_code: string
  hs_code: string
  price_brl: string
  price_compare_brl: string
  seo_title: string
  seo_description: string
}

const emptyForm: ProductForm = {
  title: "",
  handle: "",
  subtitle: "",
  description: "",
  status: "draft",
  category: "",
  tags: "",
  sku: "",
  barcode: "",
  ean: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  material: "",
  origin_country: "BR",
  mid_code: "",
  hs_code: "",
  price_brl: "",
  price_compare_brl: "",
  seo_title: "",
  seo_description: "",
}

/* ===== PAGINA PRINCIPAL ===== */
export default function ProdutosPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [editThumbnail, setEditThumbnail] = useState("")
  const [productImages, setProductImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  const handleAddImage = async (file: File) => {
    setUploadingImage(true)
    try {
      const url = await uploadFile(file)
      if (url) setProductImages((prev) => [...prev, url])
    } catch (e) {
      console.error("Erro no upload:", e)
    }
    setUploadingImage(false)
  }

  const handleRemoveImage = (idx: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api("/admin/products?limit=200")
      setProducts(data.products || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  /* ===== ABRIR CRIACAO ===== */
  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setProductImages([])
    setMode("create")
    setMessage("")
  }

  /* ===== ABRIR EDICAO ===== */
  const openEdit = async (product: any) => {
    const v = product.variants?.[0]
    const priceBrl = v?.prices?.find((p: any) => p.currency_code === "brl")
    setForm({
      title: product.title || "",
      handle: product.handle || "",
      subtitle: product.subtitle || "",
      description: product.description || "",
      status: product.status || "draft",
      category: product.metadata?.category || "",
      tags: (product.tags || []).map((t: any) => t.value).join(", "),
      sku: v?.sku || "",
      barcode: v?.barcode || "",
      ean: v?.ean || "",
      weight: product.weight ? String(product.weight) : "",
      length: product.length ? String(product.length) : "",
      width: product.width ? String(product.width) : "",
      height: product.height ? String(product.height) : "",
      material: product.material || "",
      origin_country: product.origin_country || "BR",
      mid_code: product.mid_code || "",
      hs_code: product.hs_code || "",
      price_brl: priceBrl ? String(priceBrl.amount / 100) : "",
      price_compare_brl: "",
      seo_title: product.metadata?.seo_title || "",
      seo_description: product.metadata?.seo_description || "",
    })
    setEditingId(product.id)
    setEditThumbnail(product.thumbnail || product.images?.[0]?.url || "")
    const imgs = (product.images || []).map((img: any) => img.url?.startsWith("http") ? img.url : API_HOST + img.url).filter(Boolean)
    if (!imgs.length && product.thumbnail) imgs.push(product.thumbnail.startsWith("http") ? product.thumbnail : API_HOST + product.thumbnail)
    setProductImages(imgs)
    setMode("edit")
    setMessage("")
  }

  /* ===== DUPLICAR ===== */
  const duplicateProduct = async (product: any) => {
    const v = product.variants?.[0]
    const priceBrl = v?.prices?.find((p: any) => p.currency_code === "brl")
    setForm({
      title: product.title + " (Copia)",
      handle: product.handle + "-copia",
      subtitle: product.subtitle || "",
      description: product.description || "",
      status: "draft",
      category: product.metadata?.category || "",
      tags: (product.tags || []).map((t: any) => t.value).join(", "),
      sku: v?.sku ? v.sku + "-COPY" : "",
      barcode: "",
      ean: "",
      weight: product.weight ? String(product.weight) : "",
      length: product.length ? String(product.length) : "",
      width: product.width ? String(product.width) : "",
      height: product.height ? String(product.height) : "",
      material: product.material || "",
      origin_country: product.origin_country || "BR",
      mid_code: product.mid_code || "",
      hs_code: product.hs_code || "",
      price_brl: priceBrl ? String(priceBrl.amount / 100) : "",
      price_compare_brl: "",
      seo_title: product.metadata?.seo_title || "",
      seo_description: product.metadata?.seo_description || "",
    })
    setEditingId(null)
    setProductImages([])
    setMode("create")
    setMessage("")
  }

  /* ===== SALVAR ===== */
  const saveProduct = async () => {
    if (!form.title.trim()) { showMsg("Erro: Titulo obrigatorio"); return }
    if (!form.sku.trim()) { showMsg("Erro: SKU obrigatorio"); return }
    setSaving(true)

    try {
      const handle = form.handle || slugify(form.title)

      // Buscar region BR para precos
      const regData = await api("/admin/regions")
      const brRegion = (regData.regions || []).find((r: any) => r.currency_code === "brl")
      if (!brRegion) { showMsg("Erro: Regiao Brasil (BRL) nao encontrada"); setSaving(false); return }

      const priceBrlCents = form.price_brl ? Math.round(Number(form.price_brl) * 100) : 0

      const thumbUrl = productImages[0] || undefined

      if (editingId) {
        // EDITAR
        await api(`/admin/products/${editingId}`, {
          method: "POST",
          body: JSON.stringify({
            title: form.title,
            handle,
            thumbnail: thumbUrl,
            subtitle: form.subtitle || undefined,
            description: form.description || undefined,
            status: form.status,
            weight: form.weight ? Number(form.weight) : undefined,
            length: form.length ? Number(form.length) : undefined,
            width: form.width ? Number(form.width) : undefined,
            height: form.height ? Number(form.height) : undefined,
            material: form.material || undefined,
            origin_country: form.origin_country || undefined,
            mid_code: form.mid_code || undefined,
            hs_code: form.hs_code || undefined,
            metadata: {
              category: form.category || undefined,
              seo_title: form.seo_title || undefined,
              seo_description: form.seo_description || undefined,
            },
          }),
        })
        showMsg("Produto atualizado com sucesso!")
      } else {
        // CRIAR
        const body: any = {
          title: form.title,
          handle,
          thumbnail: thumbUrl,
          subtitle: form.subtitle || undefined,
          description: form.description || undefined,
          status: form.status,
          weight: form.weight ? Number(form.weight) : undefined,
          length: form.length ? Number(form.length) : undefined,
          width: form.width ? Number(form.width) : undefined,
          height: form.height ? Number(form.height) : undefined,
          material: form.material || undefined,
          origin_country: form.origin_country || "BR",
          mid_code: form.mid_code || undefined,
          hs_code: form.hs_code || undefined,
          metadata: {
            category: form.category || undefined,
            seo_title: form.seo_title || undefined,
            seo_description: form.seo_description || undefined,
          },
          options: [
            { title: "Tamanho", values: ["Unico"] }
          ],
          variants: [
            {
              title: "Padrao",
              sku: form.sku,
              barcode: form.barcode || undefined,
              ean: form.ean || undefined,
              manage_inventory: true,
              options: { Tamanho: "Unico" },
              prices: priceBrlCents > 0 ? [
                { amount: priceBrlCents, currency_code: "brl", region_id: brRegion.id },
              ] : [],
            },
          ],
        }

        await api("/admin/products", { method: "POST", body: JSON.stringify(body) })
        showMsg("Produto criado com sucesso!")
      }

      await loadProducts()
      setMode("list")
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
    setSaving(false)
  }

  /* ===== EXCLUIR ===== */
  const deleteProduct = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${title}"?`)) return
    try {
      await api(`/admin/products/${id}`, { method: "DELETE" })
      showMsg("Produto excluido!")
      await loadProducts()
    } catch (e: any) {
      showMsg("Erro ao excluir: " + e.message)
    }
  }

  /* ===== FILTRO ===== */
  const filtered = products.filter((p) => {
    const matchSearch = !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.handle?.toLowerCase().includes(search.toLowerCase()) ||
      p.variants?.some((v: any) => v.sku?.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  /* ===== RENDER FORMULARIO ===== */
  if (mode !== "list") {
    return (
      <ProductFormView
        form={form}
        setForm={setForm}
        onSave={saveProduct}
        onBack={() => { setMode("list"); setMessage("") }}
        saving={saving}
        message={message}
        isEdit={mode === "edit"}
        thumbnail={editThumbnail}
        images={productImages}
        onAddImage={handleAddImage}
        onRemoveImage={handleRemoveImage}
        uploadingImage={uploadingImage}
      />
    )
  }

  /* ===== RENDER LISTA ===== */
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Produtos</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {products.length} produto(s) cadastrado(s)
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadProducts} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">
            Atualizar
          </button>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Novo Produto
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}>
          {message}
        </div>
      )}

      {/* FILTROS */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, slug ou SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando produtos...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="p-3 text-left w-12"></th>
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-left">Categoria</th>
                <th className="p-3 text-right">Preco (R$)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const v = product.variants?.[0]
                const priceBrl = v?.prices?.find((p: any) => p.currency_code === "brl")
                const priceFormatted = priceBrl
                  ? (priceBrl.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "---"
                return (
                  <tr key={product.id} className="border-b hover:bg-zinc-50">
                    <td className="p-3">
                      {(product.thumbnail || product.images?.[0]?.url) ? (
                        <img src={(() => { const u = product.thumbnail || product.images[0].url; return u?.startsWith("http") ? u : API_HOST + u })()} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-zinc-200 flex items-center justify-center text-zinc-400 text-xs">IMG</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{product.title}</div>
                      <div className="text-xs text-zinc-400">{product.handle}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">{v?.sku || "---"}</td>
                    <td className="p-3 text-xs">{product.metadata?.category || "---"}</td>
                    <td className="p-3 text-right font-medium">{priceFormatted}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        product.status === "published"
                          ? "bg-green-100 text-green-700"
                          : product.status === "draft"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}>
                        {product.status === "published" ? "Publicado" : product.status === "draft" ? "Rascunho" : product.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(product)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => duplicateProduct(product)}
                          className="px-2 py-1 bg-zinc-600 text-white rounded text-xs hover:bg-zinc-700"
                          title="Duplicar"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id, product.title)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                          title="Excluir"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-zinc-400">Nenhum produto encontrado</div>
          )}
        </div>
      )}
    </div>
  )
}

/* ====================================================================
   UPLOAD DE IMAGEM (fora do componente para nao perder foco)
   ==================================================================== */
function ImageUploadField({ images, onAdd, onRemove, uploading }: {
  images: string[]
  onAdd: (file: File) => void
  onRemove: (idx: number) => void
  uploading: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-2">Fotos do Produto</label>
      <div className="flex flex-wrap gap-3">
        {images.map((url, idx) => (
          <div key={idx} className="relative group">
            <img src={url} alt="" className="w-24 h-24 rounded-lg object-cover border" />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              X
            </button>
          </div>
        ))}
        <label className={`w-24 h-24 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? (
            <span className="text-xs text-zinc-400">Enviando...</span>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 mb-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span className="text-xs text-zinc-400">Adicionar</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onAdd(file)
              e.target.value = ""
            }}
          />
        </label>
      </div>
      {images.length === 0 && <p className="text-xs text-zinc-400 mt-1">Clique para adicionar fotos do produto</p>}
    </div>
  )
}

/* ====================================================================
   INPUT ESTAVEL (fora do componente para nao perder foco)
   ==================================================================== */
function ProdInput({ label, field, placeholder, type = "text", required = false, disabled = false, className = "", value, onChange }: {
  label: string; field: keyof ProductForm; placeholder?: string; type?: string; required?: boolean; disabled?: boolean; className?: string; value: string; onChange: (field: keyof ProductForm, value: string) => void
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-zinc-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-zinc-100"
      />
    </div>
  )
}

/* ====================================================================
   FORMULARIO DE PRODUTO
   ==================================================================== */
function ProductFormView({
  form, setForm, onSave, onBack, saving, message, isEdit, thumbnail,
  images, onAddImage, onRemoveImage, uploadingImage,
}: {
  form: ProductForm
  setForm: (f: ProductForm) => void
  onSave: () => void
  onBack: () => void
  saving: boolean
  message: string
  isEdit: boolean
  thumbnail?: string
  images: string[]
  onAddImage: (file: File) => void
  onRemoveImage: (idx: number) => void
  uploadingImage: boolean
}) {
  const update = (field: keyof ProductForm, value: string) => {
    const updated = { ...form, [field]: value }
    if (field === "title" && !isEdit) {
      updated.handle = slugify(value)
    }
    if (field === "title" && !form.seo_title) {
      updated.seo_title = value + " | Compre Online"
    }
    setForm(updated)
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Voltar para lista
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {thumbnail ? (
            <img src={thumbnail?.startsWith("http") ? thumbnail : API_HOST + thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover border" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-400 text-xs border">IMG</div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{isEdit ? "Editar Produto" : "Novo Produto"}</h2>
            {form.handle && <p className="text-zinc-500 text-sm mt-1">/{form.handle}</p>}
          </div>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Salvando..." : isEdit ? "Salvar Alteracoes" : "Criar Produto"}
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* INFORMACOES BASICAS */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Informacoes Basicas</h3>
          <div className="grid grid-cols-2 gap-4">
            <ProdInput label="Nome do Produto" field="title" placeholder="Ex: Quadro Decorativo Girassol" required className="col-span-2" value={form.title} onChange={update} />
            <ProdInput label="Slug / URL" field="handle" placeholder="quadro-decorativo-girassol" required value={form.handle} onChange={update} />
            <ProdInput label="Subtitulo" field="subtitle" placeholder="Frase curta para destaque" value={form.subtitle} onChange={update} />
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Descricao do Produto</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Descreva o produto com beneficios, materiais, diferenciais..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={6}
              />
            </div>
          </div>
        </section>

        {/* FOTOS */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Fotos</h3>
          <ImageUploadField images={images} onAdd={onAddImage} onRemove={onRemoveImage} uploading={uploadingImage} />
          {images.length > 0 && (
            <p className="text-xs text-zinc-400 mt-2">A primeira foto sera usada como thumbnail principal.</p>
          )}
        </section>

        {/* ORGANIZACAO */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Organizacao</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <ProdInput label="Tags (separadas por virgula)" field="tags" placeholder="decoracao, quadro, presente" value={form.tags} onChange={update} />
          </div>
        </section>

        {/* IDENTIFICACAO E PRECO */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Identificacao e Preco</h3>
          <div className="grid grid-cols-4 gap-4">
            <ProdInput label="SKU" field="sku" placeholder="QUADRO001" required disabled={isEdit} value={form.sku} onChange={update} />
            <ProdInput label="Codigo de Barras" field="barcode" placeholder="7891234567890" value={form.barcode} onChange={update} />
            <ProdInput label="EAN" field="ean" placeholder="7891234567890" value={form.ean} onChange={update} />
            <div />
            <ProdInput label="Preco (R$)" field="price_brl" placeholder="149.90" type="number" required value={form.price_brl} onChange={update} />
            <ProdInput label="Preco Comparativo (R$)" field="price_compare_brl" placeholder="199.90" type="number" value={form.price_compare_brl} onChange={update} />
          </div>
        </section>

        {/* DIMENSOES E PESO */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Dimensoes e Envio</h3>
          <div className="grid grid-cols-4 gap-4">
            <ProdInput label="Peso (g)" field="weight" placeholder="500" type="number" value={form.weight} onChange={update} />
            <ProdInput label="Comprimento (cm)" field="length" placeholder="90" type="number" value={form.length} onChange={update} />
            <ProdInput label="Largura (cm)" field="width" placeholder="60" type="number" value={form.width} onChange={update} />
            <ProdInput label="Altura (cm)" field="height" placeholder="5" type="number" value={form.height} onChange={update} />
            <ProdInput label="Material" field="material" placeholder="Canvas, MDF, Tecido" value={form.material} onChange={update} />
            <ProdInput label="Pais de Origem" field="origin_country" placeholder="BR" value={form.origin_country} onChange={update} />
            <ProdInput label="MID Code" field="mid_code" placeholder="" value={form.mid_code} onChange={update} />
            <ProdInput label="HS Code (NCM)" field="hs_code" placeholder="49119900" value={form.hs_code} onChange={update} />
          </div>
        </section>

        {/* SEO */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">SEO</h3>
          <div className="space-y-4">
            <ProdInput label="Titulo SEO" field="seo_title" placeholder="Quadro Decorativo Girassol | Compre Online" className="w-full" value={form.seo_title} onChange={update} />
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Descricao SEO (Meta Description)</label>
              <textarea
                value={form.seo_description}
                onChange={(e) => update("seo_description", e.target.value)}
                placeholder="Quadro decorativo em canvas de alta qualidade. Pronto para pendurar, nunca desbota. Frete gratis..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                maxLength={160}
              />
              <p className="text-xs text-zinc-400 mt-1">{form.seo_description.length}/160 caracteres</p>
            </div>
            {/* Preview Google */}
            {(form.seo_title || form.handle) && (
              <div className="border rounded-lg p-4 bg-zinc-50">
                <p className="text-xs text-zinc-400 mb-1">Preview no Google:</p>
                <div className="text-blue-700 text-base font-medium truncate">
                  {form.seo_title || form.title}
                </div>
                <div className="text-green-700 text-xs">
                  sualoja.com.br/{form.handle}
                </div>
                <div className="text-zinc-600 text-xs mt-1 line-clamp-2">
                  {form.seo_description || form.description?.substring(0, 160) || "Descricao do produto..."}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
