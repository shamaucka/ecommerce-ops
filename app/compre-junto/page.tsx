"use client"

import { useState, useEffect, useCallback } from "react"

import { API } from "../lib/api-url"

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

function formatBRL(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/* ===== PAGINA PRINCIPAL ===== */
export default function CompreJuntoPage() {
  const [bundles, setBundles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("")
  const [relatedProducts, setRelatedProducts] = useState<{ product_id: string; discount: string }[]>([
    { product_id: "", discount: "10" },
  ])
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [bundlesData, productsData] = await Promise.all([
        api("/admin/bundles?action=list"),
        api("/admin/products?limit=200"),
      ])
      setBundles(bundlesData.bundles || [])
      setProducts(productsData.products || [])
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

  const addRelated = () => {
    if (relatedProducts.length >= 3) return
    setRelatedProducts([...relatedProducts, { product_id: "", discount: "10" }])
  }

  const removeRelated = (idx: number) => {
    setRelatedProducts(relatedProducts.filter((_, i) => i !== idx))
  }

  const updateRelated = (idx: number, field: "product_id" | "discount", value: string) => {
    const updated = [...relatedProducts]
    updated[idx] = { ...updated[idx], [field]: value }
    setRelatedProducts(updated)
  }

  const createBundle = async () => {
    if (!selectedProduct) { showMsg("Erro: Selecione o produto principal"); return }
    const valid = relatedProducts.filter((r) => r.product_id)
    if (valid.length === 0) { showMsg("Erro: Adicione pelo menos 1 produto relacionado"); return }
    setSaving(true)
    try {
      await api("/admin/bundles", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          product_id: selectedProduct,
          related_products: valid.map((r) => ({
            product_id: r.product_id,
            discount_percent: Number(r.discount) || 0,
          })),
        }),
      })
      showMsg("Bundle criado com sucesso!")
      setSelectedProduct("")
      setRelatedProducts([{ product_id: "", discount: "10" }])
      await loadData()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
    setSaving(false)
  }

  const deleteBundle = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este bundle?")) return
    try {
      await api("/admin/bundles", { method: "POST", body: JSON.stringify({ action: "delete", id }) })
      showMsg("Bundle excluido!")
      await loadData()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const getProductName = (id: string) => {
    const p = products.find((prod) => prod.id === id)
    return p?.title || id
  }

  const getProductPrice = (id: string) => {
    const p = products.find((prod) => prod.id === id)
    const price = p?.variants?.[0]?.prices?.find((pr: any) => pr.currency_code === "brl")
    return price ? formatBRL(price.amount) : "---"
  }

  // Group bundles by product
  const bundlesByProduct: Record<string, any[]> = {}
  bundles.forEach((b) => {
    const key = b.product_id || "unknown"
    if (!bundlesByProduct[key]) bundlesByProduct[key] = []
    bundlesByProduct[key].push(b)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Compre Junto</h2>
          <p className="text-zinc-500 text-sm mt-1">Configure combos de produtos com desconto</p>
        </div>
        <button onClick={loadData} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">Atualizar</button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* FORMULARIO DE CRIACAO */}
      <section className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-bold mb-4 pb-2 border-b">Novo Bundle</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Produto Principal</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um produto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2">Produtos Relacionados (max 3)</label>
            {relatedProducts.map((related, idx) => (
              <div key={idx} className="flex gap-3 mb-2 items-end">
                <div className="flex-1">
                  <select
                    value={related.product_id}
                    onChange={(e) => updateRelated(idx, "product_id", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {products.filter((p) => p.id !== selectedProduct).map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="block text-xs text-zinc-500 mb-1">Desconto %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={related.discount}
                    onChange={(e) => updateRelated(idx, "discount", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {relatedProducts.length > 1 && (
                  <button onClick={() => removeRelated(idx)} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200">Remover</button>
                )}
              </div>
            ))}
            {relatedProducts.length < 3 && (
              <button onClick={addRelated} className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1">+ Adicionar produto</button>
            )}
          </div>

          <button
            onClick={createBundle}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Criar Bundle"}
          </button>
        </div>
      </section>

      {/* LISTA DE BUNDLES */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando bundles...</div>
      ) : Object.keys(bundlesByProduct).length === 0 ? (
        <div className="text-center py-12 text-zinc-400">Nenhum bundle configurado</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(bundlesByProduct).map(([productId, productBundles]) => (
            <div key={productId} className="bg-white rounded-xl shadow p-5">
              <h4 className="font-bold text-sm mb-1">{getProductName(productId)}</h4>
              <p className="text-xs text-zinc-400 mb-3">{getProductPrice(productId)}</p>
              <div className="space-y-2">
                {productBundles.map((bundle: any) => (
                  <div key={bundle.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                    <div className="flex-1">
                      {(bundle.related_products || []).map((rp: any, i: number) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{getProductName(rp.product_id)}</span>
                          <span className="text-green-600 ml-2 text-xs font-medium">-{rp.discount_percent}%</span>
                        </div>
                      ))}
                      {bundle.related_product_id && (
                        <div className="text-sm">
                          <span className="font-medium">{getProductName(bundle.related_product_id)}</span>
                          <span className="text-green-600 ml-2 text-xs font-medium">-{bundle.discount_percent || 0}%</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteBundle(bundle.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Excluir</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
