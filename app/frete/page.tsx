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

/* ===== UFs ===== */
const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
]

/* ===== HELPERS ===== */
function centsToBRL(cents: number | null | undefined) {
  if (!cents && cents !== 0) return ""
  return (cents / 100).toFixed(2).replace(".", ",")
}

function brlToCents(value: string) {
  const num = parseFloat(value.replace(",", "."))
  return isNaN(num) ? 0 : Math.round(num * 100)
}

/* ===== PAGINA PRINCIPAL ===== */
export default function FretePage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  // Config state
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
  const [freeShippingMin, setFreeShippingMin] = useState("")
  const [flatRateEnabled, setFlatRateEnabled] = useState(false)
  const [flatRateAmount, setFlatRateAmount] = useState("")
  const [carrier, setCarrier] = useState("imile")
  const [imileProductCode, setImileProductCode] = useState("")

  // Zones state
  const [zones, setZones] = useState<any[]>([])
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [editingZone, setEditingZone] = useState<any>(null)
  const [zoneName, setZoneName] = useState("")
  const [zoneStates, setZoneStates] = useState<string[]>([])
  const [zoneRate, setZoneRate] = useState("")
  const [zoneDaysMin, setZoneDaysMin] = useState("1")
  const [zoneDaysMax, setZoneDaysMax] = useState("5")

  const showMsg = (msg: string, duration = 4000) => {
    setMessage(msg)
    setTimeout(() => setMessage(""), duration)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, zonesRes] = await Promise.all([
        api("/admin/shipping?action=config"),
        api("/admin/shipping?action=zones"),
      ])

      const cfg = configRes.config
      if (cfg) {
        setFreeShippingEnabled(cfg.free_shipping_min > 0)
        setFreeShippingMin(cfg.free_shipping_min ? centsToBRL(cfg.free_shipping_min) : "")
        setFlatRateEnabled(cfg.flat_rate_enabled || false)
        setFlatRateAmount(cfg.flat_rate_amount ? centsToBRL(cfg.flat_rate_amount) : "")
        setCarrier(cfg.carrier || "imile")
        setImileProductCode(cfg.imile_product_code || "")
      }

      setZones(zonesRes.zones || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ========== SAVE CONFIG ==========
  const saveConfig = async () => {
    try {
      await api("/admin/shipping", {
        method: "POST",
        body: JSON.stringify({
          action: "save_config",
          data: {
            free_shipping_min: freeShippingEnabled ? brlToCents(freeShippingMin) : 0,
            flat_rate_enabled: flatRateEnabled,
            flat_rate_amount: flatRateEnabled ? brlToCents(flatRateAmount) : 0,
            carrier,
            imile_product_code: imileProductCode || null,
            active: true,
          },
        }),
      })
      showMsg("Configuracao salva!")
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  // ========== ZONE CRUD ==========
  const resetZoneForm = () => {
    setEditingZone(null)
    setZoneName("")
    setZoneStates([])
    setZoneRate("")
    setZoneDaysMin("1")
    setZoneDaysMax("5")
    setShowZoneForm(false)
  }

  const openEditZone = (zone: any) => {
    setEditingZone(zone)
    setZoneName(zone.name)
    setZoneStates(zone.states || [])
    setZoneRate(centsToBRL(zone.rate))
    setZoneDaysMin(String(zone.delivery_days_min))
    setZoneDaysMax(String(zone.delivery_days_max))
    setShowZoneForm(true)
  }

  const saveZone = async () => {
    if (!zoneName || zoneStates.length === 0 || !zoneRate) {
      showMsg("Erro: Preencha nome, estados e valor")
      return
    }

    try {
      if (editingZone) {
        await api("/admin/shipping", {
          method: "POST",
          body: JSON.stringify({
            action: "update_zone",
            id: editingZone.id,
            data: {
              name: zoneName,
              states: zoneStates,
              rate: brlToCents(zoneRate),
              delivery_days_min: parseInt(zoneDaysMin) || 1,
              delivery_days_max: parseInt(zoneDaysMax) || 5,
            },
          }),
        })
        showMsg("Zona atualizada!")
      } else {
        await api("/admin/shipping", {
          method: "POST",
          body: JSON.stringify({
            action: "create_zone",
            data: {
              name: zoneName,
              states: zoneStates,
              rate: brlToCents(zoneRate),
              delivery_days_min: parseInt(zoneDaysMin) || 1,
              delivery_days_max: parseInt(zoneDaysMax) || 5,
            },
          }),
        })
        showMsg("Zona criada!")
      }
      resetZoneForm()
      await loadData()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const deleteZone = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta zona?")) return
    try {
      await api("/admin/shipping", {
        method: "POST",
        body: JSON.stringify({ action: "delete_zone", id }),
      })
      showMsg("Zona excluida!")
      await loadData()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const toggleZoneActive = async (zone: any) => {
    try {
      await api("/admin/shipping", {
        method: "POST",
        body: JSON.stringify({
          action: "update_zone",
          id: zone.id,
          data: { active: !zone.active },
        }),
      })
      await loadData()
    } catch (e: any) {
      showMsg("Erro: " + e.message)
    }
  }

  const toggleState = (uf: string) => {
    setZoneStates((prev) =>
      prev.includes(uf) ? prev.filter((s) => s !== uf) : [...prev, uf]
    )
  }

  if (loading) {
    return <div className="text-center py-12 text-zinc-400">Carregando configuracao de frete...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Frete</h2>
          <p className="text-zinc-500 text-sm mt-1">Configuracao de envio e zonas de entrega</p>
        </div>
        <button onClick={loadData} className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300">
          Atualizar
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* ========== CONFIGURACAO GERAL ========== */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Configuracao Geral</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frete Gratis */}
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={freeShippingEnabled}
                onChange={(e) => setFreeShippingEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">Frete Gratis</span>
            </label>
            {freeShippingEnabled && (
              <div>
                <label className="text-xs text-zinc-500">Valor minimo para frete gratis (R$)</label>
                <input
                  type="text"
                  value={freeShippingMin}
                  onChange={(e) => setFreeShippingMin(e.target.value)}
                  placeholder="199,90"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            )}
          </div>

          {/* Frete Fixo */}
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={flatRateEnabled}
                onChange={(e) => setFlatRateEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">Frete Fixo</span>
            </label>
            {flatRateEnabled && (
              <div>
                <label className="text-xs text-zinc-500">Valor do frete fixo (R$)</label>
                <input
                  type="text"
                  value={flatRateAmount}
                  onChange={(e) => setFlatRateAmount(e.target.value)}
                  placeholder="14,90"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            )}
          </div>

          {/* Transportadora */}
          <div>
            <label className="text-sm font-medium block mb-1">Transportadora</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="imile">iMile</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* Codigo Produto iMile */}
          {carrier === "imile" && (
            <div>
              <label className="text-sm font-medium block mb-1">Codigo Produto iMile</label>
              <input
                type="text"
                value={imileProductCode}
                onChange={(e) => setImileProductCode(e.target.value)}
                placeholder="Ex: STD"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={saveConfig}
            className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
          >
            Salvar Configuracao
          </button>
        </div>
      </div>

      {/* ========== ZONAS DE FRETE ========== */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Zonas de Frete</h3>
          <button
            onClick={() => { resetZoneForm(); setShowZoneForm(true) }}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
          >
            + Nova Zona
          </button>
        </div>

        {/* Zone Form */}
        {showZoneForm && (
          <div className="border rounded-lg p-4 mb-4 bg-zinc-50">
            <h4 className="font-medium text-sm mb-3">{editingZone ? "Editar Zona" : "Nova Zona"}</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-zinc-500">Nome</label>
                <input
                  type="text"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Ex: Sudeste"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Valor do Frete (R$)</label>
                <input
                  type="text"
                  value={zoneRate}
                  onChange={(e) => setZoneRate(e.target.value)}
                  placeholder="14,90"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Prazo Minimo (dias)</label>
                <input
                  type="number"
                  value={zoneDaysMin}
                  onChange={(e) => setZoneDaysMin(e.target.value)}
                  min="1"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Prazo Maximo (dias)</label>
                <input
                  type="number"
                  value={zoneDaysMax}
                  onChange={(e) => setZoneDaysMax(e.target.value)}
                  min="1"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-zinc-500 block mb-2">Estados</label>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS_BR.map((uf) => (
                  <button
                    key={uf}
                    onClick={() => toggleState(uf)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      zoneStates.includes(uf)
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {uf}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveZone}
                className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
              >
                {editingZone ? "Salvar Alteracoes" : "Criar Zona"}
              </button>
              <button
                onClick={resetZoneForm}
                className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Zones Table */}
        {zones.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-sm">Nenhuma zona de frete cadastrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="pb-2 font-medium">Nome</th>
                  <th className="pb-2 font-medium">Estados</th>
                  <th className="pb-2 font-medium">Valor</th>
                  <th className="pb-2 font-medium">Prazo</th>
                  <th className="pb-2 font-medium">Ativo</th>
                  <th className="pb-2 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{zone.name}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {(zone.states as string[] || []).map((uf: string) => (
                          <span key={uf} className="px-1.5 py-0.5 bg-zinc-100 rounded text-xs">{uf}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">R$ {centsToBRL(zone.rate)}</td>
                    <td className="py-3">{zone.delivery_days_min}-{zone.delivery_days_max} dias</td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleZoneActive(zone)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          zone.active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {zone.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditZone(zone)}
                          className="px-3 py-1 bg-zinc-200 rounded text-xs font-medium hover:bg-zinc-300"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteZone(zone.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
