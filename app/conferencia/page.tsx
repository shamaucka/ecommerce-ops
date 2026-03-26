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
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeResult, setFinalizeResult] = useState<any>(null)
  const [labelBase64, setLabelBase64] = useState<string | null>(null)

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

  // ===== FINALIZAR CONFERÊNCIA (sem impressão automática) =====
  const finalizeOrder = useCallback(async (taskData: Task) => {
    setFinalizing(true)
    try {
      setSuccess("⏳ Emitindo NF-e e gerando etiqueta iMile...")
      const result = await apiPost("finalize_conferencia", { task_id: taskData.id })

      // Atualizar taskData com dados reais retornados
      const updatedTask = {
        ...taskData,
        invoice_number: result.nfe?.numero || taskData.invoice_number || "PENDENTE",
        invoice_key: result.nfe?.chave || taskData.invoice_key || "",
        protocolo: result.nfe?.protocolo || "",
        serie: result.nfe?.serie || "4",
        tracking_code: result.imile?.expressNo || result.imile?.trackingCode || taskData.tracking_code || "",
        carrier: "iMile",
      }
      setTask(updatedTask)
      setFinalizeResult(result)

      // Armazenar labelBase64 para reimpressão
      if (result.imile?.labelBase64) {
        setLabelBase64(result.imile.labelBase64)
      }

      if (result.errors?.length > 0) {
        const errMsgs = result.errors.map((e: any) => `${e.step}: ${e.error}`).join("; ")
        setError("Avisos: " + errMsgs)
      }

      setSuccess("✅ Conferência completa! NF-e emitida, etiqueta iMile gerada. Use os botões abaixo para imprimir.")
    } catch (err: any) {
      setError("Erro ao finalizar: " + err.message)
    } finally {
      setFinalizing(false)
    }
  }, [])

  // ===== IMPRIMIR DANFE SIMPLIFICADA (10x15) =====
  const printDanfe = useCallback(() => {
    if (!task) return
    const printHtml = generateDanfeHtml(task)
    const printWindow = window.open("", "_blank", "width=400,height=600")
    if (printWindow) {
      printWindow.document.write(printHtml)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 300)
    }
  }, [task])

  // ===== IMPRIMIR ETIQUETA IMILE (PDF base64) =====
  const printEtiqueta = useCallback(() => {
    if (!labelBase64) {
      setError("Etiqueta iMile não disponível. Verifique se o pedido iMile foi criado com sucesso.")
      return
    }
    // Convert base64 to blob URL for full-page PDF rendering
    const byteChars = atob(labelBase64)
    const byteNumbers = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" })
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, "_blank")
  }, [labelBase64])

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
        // Finaliza (emite NF-e + cria pedido iMile) mas NÃO imprime automaticamente
        finalizeOrder(updatedTask)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }, [task, checkerName, finalizeOrder])

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
    setFinalizing(false)
    setFinalizeResult(null)
    setLabelBase64(null)
    orderInputRef.current?.focus()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Conferência</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Bipe o pedido, depois bipe cada item — ao conferir tudo, emite NF-e e gera etiqueta
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

          {/* Conferência completa — botões separados para DANFE e Etiqueta */}
          {allDone && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4 text-center">
              <p className="text-green-700 font-bold text-lg mb-2">
                {finalizing ? "⏳ Emitindo NF-e e gerando etiqueta iMile..." : "✅ Todos os itens conferidos!"}
              </p>
              {!finalizing && finalizeResult && (
                <>
                  <p className="text-green-600 text-sm mb-4">
                    NF-e emitida e pedido iMile criado. Imprima a DANFE e a etiqueta separadamente:
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={printDanfe}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      Imprimir DANFE Simplificada
                    </button>
                    <button
                      onClick={printEtiqueta}
                      className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                    >
                      Imprimir Etiqueta Transportadora
                    </button>
                  </div>
                </>
              )}
              {!finalizing && !finalizeResult && (
                <p className="text-yellow-600 text-sm">
                  Aguardando finalização...
                </p>
              )}
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

function generateDanfeHtml(task: any): string {
  const chave = task.invoice_key || ""
  const chaveFormatada = chave.replace(/(\d{4})/g, "$1 ").trim()
  const protocolo = task.protocolo || ""
  const nfNum = task.invoice_number || "---"
  const serie = task.serie || "4"
  const dataEmissao = new Date().toLocaleDateString("pt-BR")
  const horaEmissao = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const totalItens = (task.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0)
  const valorTotal = task.order_total ? (task.order_total / 100).toFixed(2) : "0.00"

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>DANFE - NF-e ${nfNum}</title>
<style>
  @page { size: 100mm 150mm; margin: 2mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 7pt; width: 96mm; margin: 0 auto; color: #000; }
  .border { border: 1px solid #000; }
  .header { text-align: center; padding: 2px; border-bottom: 2px solid #000; }
  .header h1 { font-size: 10pt; font-weight: bold; margin: 0; letter-spacing: 1px; }
  .header p { font-size: 6pt; margin: 1px 0; }
  .section { padding: 2px 3px; border-bottom: 1px solid #000; }
  .section-title { font-size: 6pt; font-weight: bold; text-transform: uppercase; color: #333; margin-bottom: 1px; letter-spacing: 0.5px; }
  .row { display: flex; justify-content: space-between; line-height: 1.4; }
  .label { font-weight: bold; font-size: 6.5pt; text-transform: uppercase; }
  .value { font-size: 7pt; }
  .chave { font-family: 'Courier New', monospace; font-size: 6pt; word-break: break-all; letter-spacing: 0.3px; text-align: center; padding: 2px 0; }
  .bc-wrap { text-align: center; padding: 3px 0; }
  .bc-wrap canvas { display: block; margin: 0 auto; max-width: 100%; height: auto; }
  .bc-text { font-family: 'Courier New', monospace; font-size: 7pt; font-weight: bold; letter-spacing: 1px; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; font-size: 6.5pt; }
  th { background: #e0e0e0; font-size: 6pt; text-transform: uppercase; padding: 1px 2px; border: 1px solid #999; text-align: left; }
  td { padding: 1px 2px; border: 1px solid #ccc; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .emit-info { font-size: 6.5pt; line-height: 1.3; }
  .footer { font-size: 5.5pt; text-align: center; color: #666; padding: 2px; }
  .dest-box { background: #f5f5f5; padding: 2px 3px; }
</style>
</head><body>
<div class="border">
  <!-- CABECALHO -->
  <div class="header">
    <h1>DANFE SIMPLIFICADA</h1>
    <p>DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA</p>
  </div>

  <!-- EMITENTE -->
  <div class="section">
    <div class="section-title">Emitente</div>
    <div class="emit-info">
      <div class="bold" style="font-size:8pt">AMERICA FULLCOMMERCE LTDA</div>
      <div>CNPJ: 53.768.405/0001-30 | IE: 262795078</div>
      <div>Rod. Jorge Lacerda, 2670 - Poco Grande - Gaspar/SC</div>
      <div>CEP: 89115-100</div>
    </div>
  </div>

  <!-- DADOS DA NF-e -->
  <div class="section">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div class="section-title">NF-e</div>
        <div style="font-size:12pt;font-weight:bold">${nfNum}</div>
      </div>
      <div style="text-align:right">
        <div class="label">Serie: ${serie}</div>
        <div class="label">Emissao: ${dataEmissao}</div>
        <div class="label">Hora: ${horaEmissao}</div>
      </div>
    </div>
  </div>

  <!-- CHAVE DE ACESSO + BARCODE -->
  <div class="section">
    <div class="section-title">Chave de Acesso</div>
    <div class="bc-wrap">
      <canvas id="bc-chave"></canvas>
    </div>
    <div class="chave">${chaveFormatada || "CHAVE PENDENTE"}</div>
    ${protocolo ? '<div style="font-size:5.5pt;text-align:center;color:#555">Protocolo: ' + protocolo + '</div>' : ''}
  </div>

  <!-- DESTINATARIO -->
  <div class="section dest-box">
    <div class="section-title">Destinatario</div>
    <div class="bold">${task.customer_name || "---"}</div>
    <div>Email: ${task.customer_email || "---"}</div>
  </div>

  <!-- PRODUTOS -->
  <div class="section">
    <div class="section-title">Produtos</div>
    <table>
      <tr><th>Descricao</th><th class="center">Qtd</th><th>SKU</th></tr>
      ${(task.items || []).map((i: any) => '<tr><td>' + (i.product_title || "---") + '</td><td class="center">' + (i.quantity || 1) + '</td><td style="font-family:monospace;font-size:6pt">' + (i.sku || "---") + '</td></tr>').join("")}
    </table>
    <div style="margin-top:2px;display:flex;justify-content:space-between">
      <span class="bold">Itens: ${totalItens}</span>
      <span class="bold">Valor NF: R$ ${valorTotal}</span>
    </div>
  </div>

  <!-- TRANSPORTE -->
  <div class="section">
    <div class="section-title">Transporte</div>
    <div class="row">
      <span class="label">Transportadora: ${task.carrier || "---"}</span>
    </div>
    <div class="row">
      <span class="label">Rastreio: ${task.tracking_code || "---"}</span>
    </div>
    <div class="row">
      <span>Pedido: #${task.display_id}</span>
      <span>Volumes: 1</span>
    </div>
  </div>

  <!-- RODAPE -->
  <div class="footer">
    Consulte a autenticidade em www.nfe.fazenda.gov.br<br>
    Impresso em ${dataEmissao} ${horaEmissao}
  </div>
</div>

<script>
(function() {
  var P = [
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
    var c = [104];
    for (var i = 0; i < t.length; i++) c.push(t.charCodeAt(i) - 32);
    var s = c[0];
    for (var i = 1; i < c.length; i++) s += c[i] * i;
    c.push(s % 103);
    c.push(106);
    return c.map(function(v) { return P[v]; }).join('');
  }
  function render(id, text, h) {
    var el = document.getElementById(id);
    if (!el || !text || text === 'CHAVE PENDENTE') return;
    var bits = enc(text), bw = 1;
    el.width = bits.length * bw; el.height = h || 40;
    var ctx = el.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, el.width, el.height);
    ctx.fillStyle = '#000';
    for (var i = 0; i < bits.length; i++) {
      if (bits[i] === '1') ctx.fillRect(i * bw, 0, bw, el.height);
    }
  }
  render('bc-chave', '${chave}', 40);
})();
</script>
</body></html>`
}
