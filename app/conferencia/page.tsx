"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { apiPost } from "../components/api"

interface TaskItem {
  id: string
  sku: string
  barcode?: string
  product_title: string
  variant_title?: string
  quantity: number
  location?: string
  checked: boolean
}

interface Task {
  id: string
  order_id: string
  display_id: string
  customer_name: string
  customer_email: string
  items_total: number
  items_checked: number
  carrier: string
  invoice_number: string
  invoice_key: string
  tracking_code: string
  items: TaskItem[]
}

export default function ConferenciaPage() {
  const [task, setTask] = useState<Task | null>(null)
  const [orderBarcode, setOrderBarcode] = useState("")
  const [itemInput, setItemInput] = useState("")
  const [checkerName, setCheckerName] = useState("")
  const [totalChecked, setTotalChecked] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [autoPrinting, setAutoPrinting] = useState(false)

  const orderInputRef = useRef<HTMLInputElement>(null)
  const itemInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    orderInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (task && !allDone) {
      itemInputRef.current?.focus()
    }
  }, [task, allDone])

  const scanOrder = async () => {
    if (!orderBarcode.trim()) return
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const data = await apiPost("scan_order", { barcode: orderBarcode.trim() })
      setTask(data.task)
      setTotalChecked(data.task.items_checked || 0)
      setTotalItems(data.task.items_total || data.task.items?.length || 0)
      setAllDone(false)
      setOrderBarcode("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ===== IMPRESSÃO AUTOMÁTICA =====
  // Usa window.print() via popup — o navegador reconhece automaticamente
  // a impressora padrão configurada na máquina.
  // Não precisa de integração extra: basta configurar a impressora padrão no SO.
  const autoPrint = useCallback(async (taskData: Task) => {
    setAutoPrinting(true)
    try {
      await apiPost("mark_conference_printed", { task_id: taskData.id })

      const printHtml = generateDanfeAndLabelHtml(taskData)
      const printWindow = window.open("", "_blank", "width=400,height=600")
      if (printWindow) {
        printWindow.document.write(printHtml)
        printWindow.document.close()
        printWindow.focus()
        // Pequeno delay para renderizar os barcodes no canvas antes de imprimir
        setTimeout(() => {
          printWindow.print()
        }, 300)
      }

      setSuccess("✅ Conferência completa! DANFE + Etiqueta enviados para impressora.")
    } catch (err: any) {
      setError("Erro ao imprimir: " + err.message)
    } finally {
      setAutoPrinting(false)
    }
  }, [])

  const checkItem = useCallback(async (identifier: string) => {
    if (!task || !identifier.trim()) return
    setError("")
    setSuccess("")

    try {
      const data = await apiPost("check_item", {
        task_id: task.id,
        identifier: identifier.trim(),
        checker_name: checkerName || undefined,
      })

      setTotalChecked(data.totalChecked)
      setTotalItems(data.totalItems)

      // Atualizar item na lista
      const updatedTask = {
        ...task,
        items: task.items.map((i) =>
          i.id === data.item.id ? { ...i, checked: true } : i
        ),
        items_checked: data.totalChecked,
      }
      setTask(updatedTask)

      setSuccess(`✓ ${data.item.product_title} conferido (${data.totalChecked}/${data.totalItems})`)
      setItemInput("")

      if (data.allDone) {
        setAllDone(true)
        // 🔥 IMPRESSÃO AUTOMÁTICA — dispara assim que todos os itens foram conferidos
        autoPrint(updatedTask)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }, [task, checkerName, autoPrint])

  const handleItemScan = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkItem(itemInput)
    }
  }

  const resetTask = () => {
    setTask(null)
    setAllDone(false)
    setTotalChecked(0)
    setTotalItems(0)
    setError("")
    setSuccess("")
    setAutoPrinting(false)
    orderInputRef.current?.focus()
  }

  // Reimpressão manual caso necessário
  const manualReprint = () => {
    if (!task) return
    const printHtml = generateDanfeAndLabelHtml(task)
    const printWindow = window.open("", "_blank", "width=400,height=600")
    if (printWindow) {
      printWindow.document.write(printHtml)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 300)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Conferência</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Bipe o pedido, depois bipe cada item — ao conferir tudo, imprime automaticamente
          </p>
        </div>
        {task && (
          <button
            onClick={resetTask}
            className="px-4 py-2 bg-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-300"
          >
            Novo Pedido
          </button>
        )}
      </div>

      {/* Nome do conferente */}
      <div className="mb-4">
        <label className="text-sm text-zinc-500 block mb-1">Conferente</label>
        <input
          type="text"
          value={checkerName}
          onChange={(e) => setCheckerName(e.target.value)}
          placeholder="Nome do conferente (opcional)"
          className="border rounded-lg px-4 py-2 text-sm w-64"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-4">
          {success}
        </div>
      )}

      {!task ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center max-w-lg mx-auto">
          <p className="text-lg font-medium mb-4">Bipe ou digite o código do pedido</p>
          <div className="flex gap-2">
            <input
              ref={orderInputRef}
              type="text"
              value={orderBarcode}
              onChange={(e) => setOrderBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scanOrder()}
              placeholder="Código do pedido..."
              className="flex-1 border rounded-lg px-4 py-3 text-lg font-mono"
              autoFocus
            />
            <button
              onClick={scanOrder}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "..." : "Buscar"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Header do pedido */}
          <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold font-mono">#{task.display_id}</span>
                <span className="ml-3 text-zinc-500">{task.customer_name}</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  {totalChecked}/{totalItems}
                </div>
                <div className="text-sm text-zinc-500">itens conferidos</div>
              </div>
            </div>

            <div className="mt-3 bg-zinc-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  allDone ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${totalItems > 0 ? (totalChecked / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Input de bipagem de item */}
          {!allDone && (
            <div className="bg-white rounded-xl shadow-sm border p-5 mb-4">
              <label className="text-sm text-zinc-500 block mb-2">
                Bipe o SKU ou código de barras do item
              </label>
              <div className="flex gap-2">
                <input
                  ref={itemInputRef}
                  type="text"
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  onKeyDown={handleItemScan}
                  placeholder="SKU ou código de barras..."
                  className="flex-1 border rounded-lg px-4 py-3 text-lg font-mono"
                  autoFocus
                />
                <button
                  onClick={() => checkItem(itemInput)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Conferir
                </button>
              </div>
            </div>
          )}

          {/* Conferência completa — impressão automática já foi disparada */}
          {allDone && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4 text-center">
              <p className="text-green-700 font-bold text-lg mb-2">
                {autoPrinting ? "⏳ Imprimindo DANFE + Etiqueta..." : "✅ Todos os itens conferidos!"}
              </p>
              <p className="text-green-600 text-sm mb-3">
                A impressão foi enviada automaticamente para a impressora padrão.
              </p>
              <button
                onClick={manualReprint}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                Reimprimir DANFE + Etiqueta
              </button>
            </div>
          )}

          {/* Lista de itens */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Local</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-center">Qtd</th>
                  <th className="p-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {task.items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b ${
                      item.checked ? "bg-green-50 text-green-700" : "hover:bg-zinc-50"
                    }`}
                  >
                    <td className="p-3">
                      {item.checked ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-zinc-300">○</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{item.location || "—"}</td>
                    <td className="p-3 font-mono font-bold">{item.sku}</td>
                    <td className="p-3">
                      {item.product_title}
                      {item.variant_title && (
                        <span className="text-zinc-400 ml-1">({item.variant_title})</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold">{item.quantity}</td>
                    <td className="p-3 text-center">
                      {!item.checked && (
                        <button
                          onClick={() => checkItem(item.id)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
                        >
                          Conferir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function generateDanfeAndLabelHtml(task: any): string {
  const nfBarcode = task.invoice_key || task.invoice_number || task.display_id
  const trackingBarcode = task.tracking_code || task.display_id

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>DANFE + Etiqueta - #${task.display_id}</title>
<style>
  @page { size: 100mm 150mm; margin: 3mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; width: 94mm; margin: 0 auto; }
  .section { border: 1px solid #000; padding: 4px; margin-bottom: 4px; }
  .title { font-size: 14px; font-weight: bold; text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .label { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #ccc; padding: 2px 4px; }
  th { background: #eee; }
  .bc-wrap { text-align: center; margin: 8px 0 4px; }
  .bc-wrap canvas { display: block; margin: 0 auto; }
  .bc-text { font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-top: 2px; }
  .cut-line { position: relative; text-align: center; margin: 4px 0; height: 16px; page-break-after: always; }
  .cut-line .scissors { position: absolute; left: 0; top: -4px; font-size: 14px; }
  .cut-line .dash { display: block; border-top: 2px dashed #000; margin-top: 7px; margin-left: 16px; }
  .shipping-label { border: 3px solid #000; padding: 8px; }
  .shipping-label .big { font-size: 20px; font-weight: bold; text-align: center; }
</style>
</head><body>
<!-- DANFE SIMPLIFICADA -->
<div>
  <div class="title">DANFE SIMPLIFICADA</div>
  <div class="section">
    <div class="row"><span class="label">Pedido:</span> <span>#${task.display_id}</span></div>
    <div class="row"><span class="label">Cliente:</span> <span>${task.customer_name || "—"}</span></div>
    <div class="row"><span class="label">NF-e:</span> <span>${task.invoice_number || "Pendente"}</span></div>
    <div class="row"><span class="label">Chave:</span></div>
    <div style="font-family:monospace;font-size:8px;word-break:break-all">${task.invoice_key || "—"}</div>
    <div class="row"><span class="label">Data:</span> <span>${new Date().toLocaleDateString("pt-BR")}</span></div>
  </div>
  <table>
    <tr><th>Produto</th><th>SKU</th><th>Qtd</th></tr>
    ${(task.items || []).map((i: any) => `<tr><td>${i.product_title}${i.variant_title ? ` - ${i.variant_title}` : ""}</td><td style="font-family:monospace;font-size:8px">${i.sku}</td><td style="text-align:center">${i.quantity}</td></tr>`).join("")}
  </table>
  <div style="margin-top:6px;font-size:9px;text-align:center">Total de itens: ${task.items_total}</div>
  <div class="bc-wrap">
    <canvas id="bc-nf"></canvas>
    <div class="bc-text">${task.invoice_number || task.display_id}</div>
  </div>
</div>
<div class="cut-line"><span class="scissors">✂</span><span class="dash"></span></div>
<!-- ETIQUETA DE ENVIO -->
<div>
  <div class="shipping-label">
    <div class="big" style="margin-bottom:8px">ETIQUETA DE ENVIO</div>
    <div class="section">
      <div class="label">DESTINATÁRIO:</div>
      <div style="font-size:14px;font-weight:bold;margin:4px 0">${task.customer_name || "—"}</div>
      <div>${task.customer_email || ""}</div>
    </div>
    <div class="section">
      <div class="row"><span class="label">Pedido:</span> <span style="font-size:14px;font-weight:bold">#${task.display_id}</span></div>
      <div class="row"><span class="label">NF-e:</span> <span>${task.invoice_number || "—"}</span></div>
      <div class="row"><span class="label">Transportadora:</span> <span>${task.carrier || "—"}</span></div>
      <div class="row"><span class="label">Rastreio:</span> <span style="font-weight:bold">${task.tracking_code || "—"}</span></div>
      <div class="row"><span class="label">Volumes:</span> <span>1</span></div>
    </div>
    <div class="bc-wrap">
      <canvas id="bc-tracking" style="height:50px"></canvas>
      <div class="bc-text" style="font-size:13px;letter-spacing:2px">${task.tracking_code || task.display_id}</div>
    </div>
    <div style="text-align:center;font-size:8px;margin-top:4px">
      ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}
    </div>
  </div>
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
  function render(id, text, h) {
    const el = document.getElementById(id);
    if (!el) return;
    const bits = enc(text), bw = 2;
    el.width = bits.length * bw; el.height = h || 50;
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, el.width, el.height);
    ctx.fillStyle = '#000';
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') ctx.fillRect(i * bw, 0, bw, el.height);
    }
  }
  render('bc-nf', '${nfBarcode}', 35);
  render('bc-tracking', '${trackingBarcode}', 50);
})();
</script>
</body></html>`
}
