"use client"

import { useState, useEffect, useCallback } from "react"

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

/* ===== UFs ===== */
const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
]

/* ===== CARRIERS CONFIG ===== */
const CARRIERS = [
  {
    id: "imile",
    name: "iMile",
    description: "Entrega expressa e standard para todo o Brasil",
    logo: "https://www.imile.com/favicon.ico",
    hasApiIntegration: true,
    fields: ["imile_product_code"],
  },
  {
    id: "correios",
    name: "Correios",
    description: "PAC, SEDEX e Mini Envios via Correios",
    logo: "",
    hasApiIntegration: false,
    fields: [],
  },
  {
    id: "jadlog",
    name: "Jadlog",
    description: "Transportadora rodoviaria para e-commerce",
    logo: "",
    hasApiIntegration: false,
    fields: [],
  },
  {
    id: "manual",
    name: "Manual / Proprio",
    description: "Entrega propria ou transportadora sem integracao",
    logo: "",
    hasApiIntegration: false,
    fields: [],
  },
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
  const [activeCarrier, setActiveCarrier] = useState("imile")
  const [imileProductCode, setImileProductCode] = useState("")
  const [imileStatus, setImileStatus] = useState<"checking" | "online" | "offline" | null>(null)
  const [extraDays, setExtraDays] = useState("0")
  const [extraCost, setExtraCost] = useState("")
  const [senderZipcode, setSenderZipcode] = useState("")

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
        setActiveCarrier(cfg.carrier || "imile")
        setImileProductCode(cfg.imile_product_code || "")
        setExtraDays(String(cfg.extra_days || 0))
        setExtraCost(cfg.extra_cost ? centsToBRL(cfg.extra_cost) : "")
        setSenderZipcode(cfg.sender_zipcode || "")
      }

      setZones(zonesRes.zones || [])
    } catch (e: any) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Check iMile status
  const checkImileStatus = async () => {
    setImileStatus("checking")
    try {
      const res = await api("/admin/fulfillment?action=stats")
      if (res.stats || res.pending !== undefined) {
        setImileStatus("online")
      } else {
        setImileStatus("offline")
      }
    } catch {
      setImileStatus("offline")
    }
  }

  useEffect(() => {
    if (activeCarrier === "imile") checkImileStatus()
  }, [activeCarrier])

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
            carrier: activeCarrier,
            imile_product_code: imileProductCode || null,
            extra_days: parseInt(extraDays) || 0,
            extra_cost: extraCost ? brlToCents(extraCost) : 0,
            sender_zipcode: senderZipcode || null,
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
          <p className="text-zinc-500 text-sm mt-1">Transportadoras, regras de envio e zonas de entrega</p>
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

      {/* ========== TRANSPORTADORAS ========== */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Transportadoras</h3>
        <p className="text-xs text-zinc-400 mb-4">Selecione a transportadora ativa para calculo de frete no checkout</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CARRIERS.map((c) => {
            const isActive = activeCarrier === c.id
            return (
              <div
                key={c.id}
                className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                  isActive
                    ? "border-blue-500 bg-blue-50/50"
                    : "border-zinc-200 hover:border-zinc-300 bg-white"
                }`}
                onClick={() => setActiveCarrier(c.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isActive ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-zinc-500">{c.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      isActive ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {isActive ? "Ativa" : "Inativa"}
                    </span>
                    {c.hasApiIntegration && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">API</span>
                    )}
                  </div>
                </div>

                {/* iMile specific config */}
                {isActive && c.id === "imile" && (
                  <div className="mt-4 pt-3 border-t border-blue-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-600">Status API:</span>
                      {imileStatus === "checking" ? (
                        <span className="text-xs text-zinc-400">Verificando...</span>
                      ) : imileStatus === "online" ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Online
                        </span>
                      ) : imileStatus === "offline" ? (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <span className="w-2 h-2 rounded-full bg-red-500" /> Offline
                        </span>
                      ) : null}
                      <button
                        onClick={(e) => { e.stopPropagation(); checkImileStatus() }}
                        className="text-xs text-blue-600 hover:underline ml-1"
                      >
                        Testar
                      </button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <label className="text-xs text-zinc-500">Codigo Produto iMile</label>
                      <input
                        type="text"
                        value={imileProductCode}
                        onChange={(e) => setImileProductCode(e.target.value)}
                        placeholder="Ex: STD"
                        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Correios - coming soon */}
                {isActive && c.id === "correios" && (
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                      Integracao com API Correios em breve. Por enquanto, use zonas de frete manuais.
                    </p>
                  </div>
                )}

                {/* Jadlog - coming soon */}
                {isActive && c.id === "jadlog" && (
                  <div className="mt-4 pt-3 border-t border-blue-200">
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                      Integracao com Jadlog em breve. Por enquanto, use zonas de frete manuais.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ========== REGRAS DE FRETE ========== */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Regras de Frete</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Frete Gratis */}
          <div className={`border rounded-xl p-4 ${freeShippingEnabled ? "border-green-300 bg-green-50/30" : "border-zinc-200"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Frete Gratis</span>
              <button
                type="button"
                onClick={() => setFreeShippingEnabled(!freeShippingEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${freeShippingEnabled ? "bg-zinc-900" : "bg-zinc-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${freeShippingEnabled ? "translate-x-5" : ""}`} />
              </button>
            </div>
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
            {!freeShippingEnabled && (
              <p className="text-xs text-zinc-400">Ative para oferecer frete gratis acima de um valor minimo</p>
            )}
          </div>

          {/* Frete Fixo */}
          <div className={`border rounded-xl p-4 ${flatRateEnabled ? "border-blue-300 bg-blue-50/30" : "border-zinc-200"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Frete Fixo</span>
              <button
                type="button"
                onClick={() => setFlatRateEnabled(!flatRateEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${flatRateEnabled ? "bg-zinc-900" : "bg-zinc-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${flatRateEnabled ? "translate-x-5" : ""}`} />
              </button>
            </div>
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
            {!flatRateEnabled && (
              <p className="text-xs text-zinc-400">Ative para cobrar um valor fixo independente do destino</p>
            )}
          </div>
        </div>

        {/* Ajustes Extras */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-semibold text-zinc-700 mb-3">Ajustes sobre o calculo da transportadora</h4>
          <p className="text-xs text-zinc-400 mb-4">Adicione dias ou valor extra sobre o que a transportadora (iMile) calcular. Aplicado tambem sobre zonas manuais.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-500">CEP de Origem (remetente)</label>
              <input
                type="text"
                value={senderZipcode}
                onChange={(e) => setSenderZipcode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Ex: 01001000"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Dias extras (+)</label>
              <input
                type="number"
                value={extraDays}
                onChange={(e) => setExtraDays(e.target.value)}
                min="0"
                placeholder="0"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-zinc-400 mt-1">Ex: +5 dias sobre o prazo calculado</p>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Valor extra (R$)</label>
              <input
                type="text"
                value={extraCost}
                onChange={(e) => setExtraCost(e.target.value)}
                placeholder="0,00"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-zinc-400 mt-1">Ex: +R$4,00 sobre o valor calculado</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
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
          <div>
            <h3 className="text-lg font-semibold">Zonas de Frete</h3>
            <p className="text-xs text-zinc-400 mt-1">Defina valores e prazos por regiao</p>
          </div>
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
                  <th className="pb-2 font-medium">Status</th>
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
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          zone.active ? "bg-zinc-900" : "bg-zinc-300"
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${zone.active ? "translate-x-5" : ""}`} />
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
