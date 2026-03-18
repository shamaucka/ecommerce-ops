"use client"

import { useEffect, useState, useCallback } from "react"
import { apiGet, apiPost } from "../components/api"

interface Task {
  id: string
  order_id: string
  display_id: string
  customer_name: string
  items_total: number
  status: string
  created_at: string
  items?: TaskItem[]
}

interface TaskItem {
  id: string
  sku: string
  barcode?: string
  product_title: string
  variant_title?: string
  quantity: number
  location?: string
}

type FilterMode = "aguardando" | "em_separacao"

export default function SeparacaoPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<FilterMode>("aguardando")

  const load = useCallback(() => {
    setLoading(true)
    setSelected(new Set())

    if (filter === "aguardando") {
      apiGet("separacao")
        .then((data) => {
          setTasks(data.tasks || [])
          setError("")
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    } else {
      // Em separação - buscar via list com filtro de status
      apiGet("list", { status: "em_separacao" })
        .then((data) => {
          setTasks(data.tasks || [])
          setError("")
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === tasks.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tasks.map((t) => t.id)))
    }
  }

  const printPickingList = async () => {
    if (selected.size === 0) return
    setPrinting(true)
    setError("")

    try {
      let tasksWithItems: Task[]

      if (filter === "aguardando") {
        // Modo normal: chama print_picking_list que muda status para em_separacao
        const data = await apiPost("print_picking_list", {
          task_ids: Array.from(selected),
        })
        tasksWithItems = data.tasks || []
      } else {
        // Modo reimpressão: buscar detalhes de cada task selecionada sem mudar status
        const details = await Promise.all(
          Array.from(selected).map((id) => apiGet("detail", { task_id: id }))
        )
        tasksWithItems = details.map((d) => d.task)
      }

      const printHtml = generatePickingListHtml(tasksWithItems)
      const printWindow = window.open("", "_blank", "width=320,height=600")
      if (printWindow) {
        printWindow.document.write(printHtml)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
      }

      setSelected(new Set())
      if (filter === "aguardando") load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Separação</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {filter === "aguardando"
              ? "Pedidos aguardando separação — selecione e imprima a lista de picking"
              : "Pedidos já em separação — selecione para reimprimir a lista"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={load}
            className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300"
          >
            Atualizar
          </button>
          <button
            onClick={printPickingList}
            disabled={selected.size === 0 || printing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {printing
              ? "Gerando..."
              : filter === "aguardando"
                ? `Imprimir Lista (${selected.size})`
                : `Reimprimir Lista (${selected.size})`}
          </button>
        </div>
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("aguardando")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "aguardando"
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          Aguardando Separação
        </button>
        <button
          onClick={() => setFilter("em_separacao")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "em_separacao"
              ? "bg-orange-500 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          Em Separação (Reimprimir)
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          {filter === "aguardando"
            ? "Nenhum pedido aguardando separação"
            : "Nenhum pedido em separação"}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === tasks.length && tasks.length > 0}
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left">Pedido</th>
                <th className="p-3 text-left">Cliente</th>
                <th className="p-3 text-left">Itens</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-b hover:bg-zinc-50 cursor-pointer ${
                    selected.has(task.id) ? "bg-blue-50" : ""
                  }`}
                  onClick={() => toggleSelect(task.id)}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(task.id)}
                      onChange={() => toggleSelect(task.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold">#{task.display_id}</td>
                  <td className="p-3">{task.customer_name || "—"}</td>
                  <td className="p-3">{task.items_total} itens</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      task.status === "em_separacao"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {task.status === "em_separacao" ? "Em Separação" : "Aguardando"}
                    </span>
                  </td>
                  <td className="p-3 text-zinc-500">
                    {new Date(task.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function generatePickingListHtml(tasks: any[]): string {
  const rows = tasks
    .map((task, idx) => {
      const itemRows = (task.items || [])
        .map(
          (item: any) => `
        <tr>
          <td style="padding:3px 4px;border-bottom:1px dotted #ccc">${item.location || "—"}</td>
          <td style="padding:3px 4px;border-bottom:1px dotted #ccc">${item.sku}</td>
          <td style="padding:3px 4px;border-bottom:1px dotted #ccc;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.product_title}${item.variant_title ? ` - ${item.variant_title}` : ""}</td>
          <td style="padding:3px 4px;border-bottom:1px dotted #ccc;text-align:center;font-weight:bold">${item.quantity}</td>
          <td style="padding:3px 4px;border-bottom:1px dotted #ccc;text-align:center">☐</td>
        </tr>`
        )
        .join("")

      const cutLine = idx < tasks.length - 1 ? `
        <div class="cut-line">
          <span class="scissors">✂</span>
          <span class="cut-dash"></span>
        </div>` : ""

      return `
        <div class="order-block">
          <div style="text-align:center;font-size:18px;font-weight:bold;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:6px">
            PEDIDO #${task.display_id}
          </div>
          <div style="font-size:10px;margin-bottom:6px">
            <strong>Cliente:</strong> ${task.customer_name || "—"}<br>
            <strong>Itens:</strong> ${task.items_total}
          </div>
          <table style="width:100%;font-size:9px;border-collapse:collapse">
            <tr style="background:#eee">
              <th style="padding:2px 4px;text-align:left">Local</th>
              <th style="padding:2px 4px;text-align:left">SKU</th>
              <th style="padding:2px 4px;text-align:left">Produto</th>
              <th style="padding:2px 4px;text-align:center">Qtd</th>
              <th style="padding:2px 4px;text-align:center">✓</th>
            </tr>
            ${itemRows}
          </table>
          <div style="text-align:center;margin-top:8px">
            <canvas id="bc-${task.display_id}" class="barcode-canvas"></canvas>
            <div style="font-size:11px;font-weight:bold;margin-top:2px;letter-spacing:2px">${task.display_id}</div>
          </div>
        </div>
        ${cutLine}`
    })
    .join("")

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Lista de Separação</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; width: 76mm; margin: 0 auto; padding: 0; }
  .order-block { border: 1px solid #000; padding: 6px; margin-bottom: 0; page-break-inside: avoid; }
  .barcode-canvas { display: block; margin: 0 auto; height: 40px; width: 200px; }
  .cut-line { position: relative; text-align: center; margin: 6px 0; height: 16px; page-break-after: always; }
  .scissors { position: absolute; left: 0; top: -4px; font-size: 14px; line-height: 1; }
  .cut-dash { display: block; border-top: 2px dashed #000; margin-top: 7px; margin-left: 16px; }
  @media print { body { width: 76mm; } .cut-line { page-break-after: always; } }
</style>
</head><body>
<div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:8px;border-bottom:2px solid #000;padding-bottom:4px">
  LISTA DE SEPARAÇÃO<br>
  <span style="font-size:10px;font-weight:normal">${new Date().toLocaleString("pt-BR")}</span>
</div>
${rows}
<div style="text-align:center;margin-top:8px;font-size:9px;border-top:1px solid #000;padding-top:4px">
  Total: ${tasks.length} pedido(s) — ${tasks.reduce((s: number, t: any) => s + (t.items_total || 0), 0)} itens
</div>
<script>
(function() {
  // Code128 completo: 107 padrões (0-106)
  const P = [
    "11011001100","11001101100","11001100110","10010011000","10010001100",
    "10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110",
    "10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11100110100","11100100110",
    "11100010110","11101100100","11100110010","11100011010","11101101110",
    "11101110110","11100010010","11101110010","11011110000","11100011110",
    "10100110000","10100001100","10010110000","10010000110","10000101100",
    "10000100110","10110010000","10110000100","10011010000","10011000010",
    "10000110100","10000110010","11000010010","11001010000","11110111010",
    "11000010100","10001111010","10100111100","10010111100","10010011110",
    "10111100100","10011110100","10011110010","11110100100","11110010100",
    "11110010010","11011011110","11011110110","11110110110","10101111000",
    "10100011110","10001011110","10111101000","10111100010","11110101000",
    "11110100010","10111011110","10111101110","11101011110","11110101110",
    "11010000100","11010010000","11010011100","11000110100","11000100010",
    "11000010010","10110001000","10001100010","10001000110","10110111000",
    "10110001110","10001101110","10111011000","10111000110","10001110110",
    "11101011000","11101000110","11100010110","11011101000","11011100010",
    "11000111010","11011101110","11011000110","11000110110","10010111000",
    "10010001110","10001001110","11010111000","11010001110","11000101110",
    "11010111000","1100011101011"
  ];
  function enc(t) {
    let c = [104]; // START B
    for (let i = 0; i < t.length; i++) c.push(t.charCodeAt(i) - 32);
    let s = c[0];
    for (let i = 1; i < c.length; i++) s += c[i] * i;
    c.push(s % 103);
    c.push(106); // STOP
    return c.map(v => P[v]).join('');
  }
  function render(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    const bits = enc(text), bw = 2;
    el.width = bits.length * bw; el.height = 50;
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, el.width, el.height);
    ctx.fillStyle = '#000';
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') ctx.fillRect(i * bw, 0, bw, 50);
    }
  }
  ${tasks.map((t: any) => `render('bc-${t.display_id}', '${t.display_id}');`).join('\n  ')}
})();
</script>
</body></html>`
}
