"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { apiGet, apiPost } from "../components/api"

interface Romaneio {
  id: string
  carrier: string
  status: string
  packages_count: number
  created_at: string
  closed_at?: string
  closed_by?: string
}

interface Task {
  id: string
  order_id: string
  display_id: string
  customer_name: string
  carrier: string
  tracking_code: string
  invoice_number: string
}

// ===== SOM DE ERRO ALTO (beep via Web Audio API) =====
function playErrorSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Beep 1 - agudo
    const osc1 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    osc1.type = "square"
    osc1.frequency.setValueAtTime(880, audioCtx.currentTime)
    gain1.gain.setValueAtTime(1, audioCtx.currentTime)
    osc1.connect(gain1)
    gain1.connect(audioCtx.destination)
    osc1.start(audioCtx.currentTime)
    osc1.stop(audioCtx.currentTime + 0.15)

    // Beep 2 - mais agudo
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.type = "square"
    osc2.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2)
    gain2.gain.setValueAtTime(1, audioCtx.currentTime + 0.2)
    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)
    osc2.start(audioCtx.currentTime + 0.2)
    osc2.stop(audioCtx.currentTime + 0.35)

    // Beep 3 - agudo longo
    const osc3 = audioCtx.createOscillator()
    const gain3 = audioCtx.createGain()
    osc3.type = "square"
    osc3.frequency.setValueAtTime(1500, audioCtx.currentTime + 0.4)
    gain3.gain.setValueAtTime(1, audioCtx.currentTime + 0.4)
    osc3.connect(gain3)
    gain3.connect(audioCtx.destination)
    osc3.start(audioCtx.currentTime + 0.4)
    osc3.stop(audioCtx.currentTime + 0.8)

    // Cleanup
    setTimeout(() => audioCtx.close(), 1000)
  } catch {
    // Fallback: alert
  }
}

function playSuccessSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(800, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.1)
    setTimeout(() => audioCtx.close(), 200)
  } catch {
    // silent
  }
}

export default function DespachoPage() {
  const [romaneios, setRomaneios] = useState<Romaneio[]>([])
  const [selectedRomaneio, setSelectedRomaneio] = useState<Romaneio | null>(null)
  const [romaneioTasks, setRomaneioTasks] = useState<Task[]>([])
  const [newCarrier, setNewCarrier] = useState("")
  const [scanInput, setScanInput] = useState("")
  const [closedBy, setClosedBy] = useState("")
  const [error, setError] = useState("")
  const [errorFlash, setErrorFlash] = useState(false)
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(true)
  const [allRomaneios, setAllRomaneios] = useState<Romaneio[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const scanRef = useRef<HTMLInputElement>(null)

  const loadRomaneios = useCallback(() => {
    setLoading(true)
    Promise.all([
      apiGet("romaneios_abertos"),
      apiGet("romaneios_todos"),
    ])
      .then(([openData, allData]) => {
        setRomaneios(openData.romaneios || [])
        setAllRomaneios(allData.romaneios || [])
        setError("")
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadRomaneios() }, [loadRomaneios])

  const loadRomaneioTasks = useCallback(async (romaneio: Romaneio) => {
    setSelectedRomaneio(romaneio)
    try {
      const data = await apiGet("romaneio_tasks", { romaneio_id: romaneio.id })
      setRomaneioTasks(data.tasks || [])
      setTimeout(() => scanRef.current?.focus(), 100)
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  const createRomaneio = async () => {
    if (!newCarrier.trim()) return
    setError("")
    try {
      const data = await apiPost("create_romaneio", { carrier: newCarrier.trim() })
      setNewCarrier("")
      loadRomaneios()
      setSuccess(`Romaneio criado para ${data.romaneio.carrier}`)
    } catch (err: any) {
      setError(err.message)
    }
  }

  // ===== ALERTA DE ERRO COM SOM ALTO =====
  const showCriticalError = (message: string) => {
    setError(message)
    setErrorFlash(true)
    playErrorSound()

    // Flash vermelho na tela por 3 segundos
    setTimeout(() => setErrorFlash(false), 3000)
  }

  const addToRomaneio = async () => {
    if (!selectedRomaneio || !scanInput.trim()) return
    setError("")
    setSuccess("")
    setErrorFlash(false)

    try {
      const data = await apiPost("add_to_romaneio", {
        romaneio_id: selectedRomaneio.id,
        invoice_barcode: scanInput.trim(),
      })
      setScanInput("")
      setSuccess(`Pedido #${data.task.display_id} adicionado ao romaneio`)
      playSuccessSound()

      setSelectedRomaneio((prev) =>
        prev ? { ...prev, packages_count: data.romaneio.packages_count } : prev
      )
      loadRomaneioTasks(selectedRomaneio)
      scanRef.current?.focus()
    } catch (err: any) {
      setScanInput("")

      // Verifica se o erro é de duplicata/cancelado e mostra alerta crítico
      const msg = err.message || "Erro desconhecido"
      if (
        msg.includes("já está") ||
        msg.includes("cancelado") ||
        msg.includes("duplicad") ||
        msg.includes("romaneio") ||
        msg.includes("transporte")
      ) {
        showCriticalError(`🚨 ATENÇÃO: ${msg}`)
      } else {
        showCriticalError(msg)
      }

      scanRef.current?.focus()
    }
  }

  const removeFromRomaneio = async (taskId: string) => {
    if (!selectedRomaneio) return
    setError("")
    try {
      await apiPost("remove_from_romaneio", { task_id: taskId })
      setSuccess("Pedido removido do romaneio")
      setSelectedRomaneio((prev) =>
        prev ? { ...prev, packages_count: Math.max(0, prev.packages_count - 1) } : prev
      )
      loadRomaneioTasks(selectedRomaneio)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const closeRomaneio = async () => {
    if (!selectedRomaneio) return
    if (romaneioTasks.length === 0) {
      setError("Romaneio vazio — adicione pedidos antes de fechar")
      return
    }

    const confirm = window.confirm(
      `Fechar romaneio ${selectedRomaneio.carrier} com ${romaneioTasks.length} pacote(s)?\n\nTodos os pedidos serão marcados como "em transporte".`
    )
    if (!confirm) return

    setError("")
    try {
      const data = await apiPost("close_romaneio", {
        romaneio_id: selectedRomaneio.id,
        closed_by: closedBy || undefined,
      })

      setSuccess(
        `Romaneio fechado! ${data.tasks_count} pedido(s) marcados como em transporte.`
      )

      // Print romaneio A4
      const printHtml = generateRomaneioHtml(selectedRomaneio, romaneioTasks, closedBy)
      const printWindow = window.open("", "_blank", "width=800,height=600")
      if (printWindow) {
        printWindow.document.write(printHtml)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
      }

      setSelectedRomaneio(null)
      setRomaneioTasks([])
      loadRomaneios()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className={errorFlash ? "animate-pulse" : ""}>
      {/* Flash vermelho full-screen overlay */}
      {errorFlash && (
        <div className="fixed inset-0 bg-red-600 bg-opacity-20 z-50 pointer-events-none animate-ping" style={{ animationDuration: "0.5s", animationIterationCount: "4" }} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Despacho / Romaneio</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Agrupe pedidos por transportadora e feche o romaneio para despachar
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedRomaneio(null)
            setRomaneioTasks([])
            loadRomaneios()
          }}
          className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300"
        >
          Atualizar
        </button>
      </div>

      {error && (
        <div className={`border p-4 rounded-lg mb-4 ${
          errorFlash
            ? "bg-red-600 border-red-700 text-white text-lg font-bold animate-bounce"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-4">
          {success}
        </div>
      )}

      {!selectedRomaneio ? (
        <div>
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
            <h3 className="font-bold mb-3">Novo Romaneio</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCarrier}
                onChange={(e) => setNewCarrier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createRomaneio()}
                placeholder="Nome da transportadora..."
                className="flex-1 border rounded-lg px-4 py-2 text-sm"
              />
              <button
                onClick={createRomaneio}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Criar
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm text-zinc-500 block mb-1">Responsável pelo despacho</label>
            <input
              type="text"
              value={closedBy}
              onChange={(e) => setClosedBy(e.target.value)}
              placeholder="Nome (opcional)"
              className="border rounded-lg px-4 py-2 text-sm w-64"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-400">Carregando...</div>
          ) : romaneios.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              Nenhum romaneio aberto — crie um acima
            </div>
          ) : (
            <div className="grid gap-4">
              {romaneios.map((r) => (
                <div
                  key={r.id}
                  onClick={() => loadRomaneioTasks(r)}
                  className="bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{r.carrier}</h3>
                      <p className="text-zinc-500 text-sm">
                        Criado em {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{r.packages_count}</div>
                      <div className="text-xs text-zinc-500">pacote(s)</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* HISTORICO DE ROMANEIOS */}
          <div className="mt-8">
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-3">
              {showHistory ? "▼" : "▶"} Historico de Romaneios ({allRomaneios.length})
            </button>
            {showHistory && allRomaneios.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100">
                    <tr>
                      <th className="p-3 text-left">Transportadora</th>
                      <th className="p-3 text-center">Pacotes</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-left">Criado</th>
                      <th className="p-3 text-left">Fechado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRomaneios.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-zinc-50 cursor-pointer" onClick={() => loadRomaneioTasks(r)}>
                        <td className="p-3 font-medium">{r.carrier}</td>
                        <td className="p-3 text-center">{r.packages_count}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${r.status === "aberto" ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"}`}>
                            {r.status === "aberto" ? "Aberto" : "Fechado"}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-zinc-500">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                        <td className="p-3 text-xs text-zinc-500">{r.closed_at ? new Date(r.closed_at).toLocaleString("pt-BR") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => {
                    setSelectedRomaneio(null)
                    setRomaneioTasks([])
                  }}
                  className="text-blue-600 text-sm mb-2 hover:underline"
                >
                  ← Voltar
                </button>
                <h3 className="font-bold text-xl">{selectedRomaneio.carrier}</h3>
                <p className="text-zinc-500 text-sm">{romaneioTasks.length} pacote(s)</p>
              </div>
              <button
                onClick={closeRomaneio}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Fechar Romaneio
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
            <label className="text-sm text-zinc-500 block mb-2">
              Bipe a NF-e ou código do pedido para adicionar ao romaneio
            </label>
            <div className="flex gap-2">
              <input
                ref={scanRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addToRomaneio()}
                placeholder="NF-e, chave ou código do pedido..."
                className="flex-1 border rounded-lg px-4 py-3 text-lg font-mono"
                autoFocus
              />
              <button
                onClick={addToRomaneio}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Adicionar
              </button>
            </div>
          </div>

          {romaneioTasks.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              Nenhum pedido adicionado — bipe a NF acima
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Pedido</th>
                    <th className="p-3 text-left">Cliente</th>
                    <th className="p-3 text-left">NF</th>
                    <th className="p-3 text-left">Rastreio</th>
                    <th className="p-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {romaneioTasks.map((task, idx) => (
                    <tr key={task.id} className="border-b hover:bg-zinc-50">
                      <td className="p-3 text-zinc-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold">#{task.display_id}</td>
                      <td className="p-3">{task.customer_name || "—"}</td>
                      <td className="p-3 font-mono text-xs">{task.invoice_number || "—"}</td>
                      <td className="p-3 font-mono text-xs">{task.tracking_code || "—"}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => removeFromRomaneio(task.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function generateRomaneioHtml(romaneio: Romaneio, tasks: Task[], closedBy: string): string {
  const rows = tasks
    .map(
      (t, i) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #999;text-align:center">${i + 1}</td>
      <td style="padding:6px 10px;border:1px solid #999;font-weight:bold;font-size:13px">#${t.display_id}</td>
      <td style="padding:6px 10px;border:1px solid #999">${t.customer_name || "—"}</td>
      <td style="padding:6px 10px;border:1px solid #999;font-family:monospace;font-size:11px">${t.invoice_number || "—"}</td>
      <td style="padding:6px 10px;border:1px solid #999;font-family:monospace;font-size:11px">${t.tracking_code || "—"}</td>
      <td style="padding:6px 10px;border:1px solid #999;text-align:center">☐</td>
    </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Romaneio de Carga - ${romaneio.carrier}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #333; color: #fff; padding: 8px 10px; border: 1px solid #333; text-align: left; font-size: 11px; text-transform: uppercase; }
  .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 24px; letter-spacing: 2px; }
  .header-info { display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; }
  .header-info div { text-align: left; }
  .summary { margin-top: 20px; padding: 12px; border: 2px solid #000; display: flex; justify-content: space-between; font-size: 14px; }
  .summary strong { font-size: 16px; }
  .signatures { margin-top: 50px; }
  .sig-row { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .sig-block { width: 45%; text-align: center; }
  .sig-line { border-top: 1px solid #000; padding-top: 6px; margin-top: 30px; font-size: 12px; }
  .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
  .obs-section { margin-top: 20px; border: 1px solid #999; padding: 10px; min-height: 60px; }
  .obs-section h4 { margin: 0 0 6px 0; font-size: 12px; }
</style>
</head><body>

<div class="header">
  <h1>ROMANEIO DE CARGA</h1>
  <div class="header-info">
    <div>
      <strong>Transportadora:</strong> ${romaneio.carrier}<br>
      <strong>Romaneio ID:</strong> ${romaneio.id.substring(0, 12)}
    </div>
    <div style="text-align:right">
      <strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}<br>
      <strong>Hora:</strong> ${new Date().toLocaleTimeString("pt-BR")}<br>
      <strong>Responsável:</strong> ${closedBy || "—"}
    </div>
  </div>
</div>

<table>
  <tr>
    <th style="width:35px">#</th>
    <th style="width:80px">Pedido</th>
    <th>Cliente</th>
    <th style="width:110px">NF-e</th>
    <th style="width:130px">Rastreio</th>
    <th style="width:50px">Conf.</th>
  </tr>
  ${rows}
</table>

<div class="summary">
  <div>
    <strong>Total de pacotes: ${tasks.length}</strong>
  </div>
  <div>
    <strong>Transportadora: ${romaneio.carrier}</strong>
  </div>
  <div>
    <strong>Data: ${new Date().toLocaleDateString("pt-BR")}</strong>
  </div>
</div>

<div class="obs-section">
  <h4>Observações:</h4>
  <div style="min-height:40px"></div>
</div>

<div class="signatures">
  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-line">
        <strong>Expedição / Conferência</strong><br>
        Nome: ________________________________<br>
        Data: ____/____/________ &nbsp; Hora: ____:____
      </div>
    </div>
    <div class="sig-block">
      <div class="sig-line">
        <strong>Motorista / Transportadora</strong><br>
        Nome: ________________________________<br>
        RG/CPF: ________________________________<br>
        Placa: ________________________________
      </div>
    </div>
  </div>

  <div style="text-align:center;margin-top:10px;padding:10px;border:2px solid #000;background:#f5f5f5">
    <strong style="font-size:13px">Declaro que recebi os ${tasks.length} volume(s) listados acima em perfeito estado.</strong>
  </div>

  <div class="sig-row" style="margin-top:30px">
    <div class="sig-block">
      <div class="sig-line">
        <strong>Assinatura do Motorista</strong>
      </div>
    </div>
    <div class="sig-block">
      <div class="sig-line">
        <strong>Assinatura da Expedição</strong>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  Documento gerado automaticamente em ${new Date().toLocaleString("pt-BR")} | Romaneio ${romaneio.id.substring(0, 12)}
</div>

</body></html>`
}
