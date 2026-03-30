"use client"

import { useState, useEffect } from "react"

import { API } from "../lib/api-url"
import { getToken, clearAuth, redirectToLogin } from "../lib/auth-token"

const REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
]

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"]

const ORIGENS = [
  { value: 0, label: "0 - Nacional" },
  { value: 1, label: "1 - Estrangeira (importacao direta)" },
  { value: 2, label: "2 - Estrangeira (mercado interno)" },
  { value: 3, label: "3 - Nacional (import. superior 40%)" },
  { value: 5, label: "5 - Nacional (import. inferior 40%)" },
]

const CST_ICMS = ["00","10","20","30","40","41","50","51","60","70","90"]
const CSOSN = ["101","102","103","201","202","203","300","400","500","900"]
const CST_PIS_COFINS = ["01","02","04","05","06","07","08","09","49","99"]
const UNIDADES = ["UN","KG","G","M","M2","M3","L","ML","CX","PCT","PR","DZ","TON","PAR","JG"]

async function fetchAuth(path: string, options?: RequestInit) {
  const token = getToken()
  if (!token) { redirectToLogin(); return {} as any }
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
  })
  if (res.status === 401) { clearAuth(); redirectToLogin(); return {} as any }
  return res.json()
}

/* ===== COMPONENTES DE CAMPO (fora do componente pai para nao perder foco) ===== */
function FField({ label, field, placeholder, type = "text", span = 1, value, onChange }: {
  label: string; field: string; placeholder?: string; type?: string; span?: number; value: any; onChange: (field: string, value: any) => void
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label className="block text-xs font-semibold text-zinc-600 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(field, type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
      />
    </div>
  )
}

function FSel({ label, field, options, span = 1, value, onChange }: {
  label: string; field: string; options: string[] | { value: any; label: string }[]; span?: number; value: any; onChange: (field: string, value: any) => void
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label className="block text-xs font-semibold text-zinc-600 mb-1">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
      >
        <option value="">Selecione...</option>
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value
          const lbl = typeof o === "string" ? o : o.label
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
    </div>
  )
}

export default function FiscalLojaPage() {
  const [config, setConfig] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    (async () => {
      const data = await fetchAuth("/admin/fiscal-br?action=store_config")
      if (data.config) setConfig(data.config)
      setLoading(false)
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const { id, created_at, updated_at, deleted_at, ...payload } = config
      await fetchAuth("/admin/fiscal-br", {
        method: "POST",
        body: JSON.stringify({ action: "save_store_config", ...payload }),
      })
      setMessage("Configuracao fiscal salva com sucesso!")
      setTimeout(() => setMessage(""), 4000)
    } catch (e: any) {
      setMessage("Erro: " + e.message)
    }
    setSaving(false)
  }

  const u = (field: string, value: any) => setConfig((c: any) => ({ ...c, [field]: value }))

  if (loading) return <div className="text-center py-12 text-zinc-400">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Fiscal Loja</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Configuracao fiscal padrao da loja. Todos os produtos usarao estas configuracoes na emissao de NF-e.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Configuracao"}
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.includes("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}>{message}</div>
      )}

      <div className="space-y-6">
        {/* DADOS DA EMPRESA */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Dados da Empresa</h3>
          <div className="grid grid-cols-4 gap-4">
            <FField label="Razao Social" field="razao_social" placeholder="Empresa Ltda" span={2} value={config.razao_social} onChange={u} />
            <FField label="Nome Fantasia" field="nome_fantasia" placeholder="Minha Loja" span={2} value={config.nome_fantasia} onChange={u} />
            <FField label="CNPJ" field="cnpj" placeholder="00.000.000/0001-00" value={config.cnpj} onChange={u} />
            <FField label="Inscricao Estadual" field="inscricao_estadual" placeholder="000.000.000.000" value={config.inscricao_estadual} onChange={u} />
            <FField label="Inscricao Municipal" field="inscricao_municipal" value={config.inscricao_municipal} onChange={u} />
            <FSel label="Regime Tributario" field="regime_tributario" options={REGIMES} value={config.regime_tributario} onChange={u} />
          </div>
        </section>

        {/* ENDERECO */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Endereco do Emitente</h3>
          <div className="grid grid-cols-4 gap-4">
            <FField label="CEP" field="cep" placeholder="00000-000" value={config.cep} onChange={u} />
            <FField label="Logradouro" field="logradouro" placeholder="Rua Exemplo" span={2} value={config.logradouro} onChange={u} />
            <FField label="Numero" field="numero" placeholder="123" value={config.numero} onChange={u} />
            <FField label="Complemento" field="complemento" placeholder="Sala 1" value={config.complemento} onChange={u} />
            <FField label="Bairro" field="bairro" placeholder="Centro" value={config.bairro} onChange={u} />
            <FField label="Cidade" field="cidade" placeholder="Sao Paulo" value={config.cidade} onChange={u} />
            <FSel label="UF" field="uf" options={UFS} value={config.uf} onChange={u} />
            <FField label="Cod. Municipio IBGE" field="codigo_municipio" placeholder="3550308" value={config.codigo_municipio} onChange={u} />
          </div>
        </section>

        {/* CLASSIFICACAO FISCAL */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Classificacao Fiscal Padrao</h3>
          <p className="text-xs text-zinc-400 mb-4">Estes valores serao aplicados para todos os produtos na emissao da NF-e</p>
          <div className="grid grid-cols-4 gap-4">
            <FField label="NCM Padrao (8 digitos)" field="ncm_padrao" placeholder="61091000" value={config.ncm_padrao} onChange={u} />
            <FField label="CEST Padrao" field="cest_padrao" placeholder="2804100" value={config.cest_padrao} onChange={u} />
            <FSel label="Origem da Mercadoria" field="origem_padrao" options={ORIGENS} value={config.origem_padrao} onChange={u} />
            <FSel label="Unidade Comercial" field="unidade_comercial" options={UNIDADES} value={config.unidade_comercial} onChange={u} />
            <FSel label="Unidade Tributavel" field="unidade_tributavel" options={UNIDADES} value={config.unidade_tributavel} onChange={u} />
          </div>
        </section>

        {/* ICMS */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">ICMS Padrao</h3>
          <div className="grid grid-cols-4 gap-4">
            <FSel label="CST ICMS (Lucro Presumido/Real)" field="cst_icms_padrao" options={CST_ICMS} value={config.cst_icms_padrao} onChange={u} />
            <FSel label="CSOSN (Simples Nacional)" field="csosn_padrao" options={CSOSN} value={config.csosn_padrao} onChange={u} />
            <FField label="CFOP Dentro do Estado" field="cfop_dentro_estado" placeholder="5102" value={config.cfop_dentro_estado} onChange={u} />
            <FField label="CFOP Fora do Estado" field="cfop_fora_estado" placeholder="6102" value={config.cfop_fora_estado} onChange={u} />
            <FField label="Aliquota ICMS (%)" field="aliquota_icms" type="number" value={config.aliquota_icms} onChange={u} />
            <FField label="Aliquota ICMS-ST (%)" field="aliquota_icms_st" type="number" value={config.aliquota_icms_st} onChange={u} />
            <FField label="MVA ST (%)" field="mva_st" type="number" value={config.mva_st} onChange={u} />
            <FField label="Reducao BC ICMS (%)" field="reducao_bc_icms" type="number" value={config.reducao_bc_icms} onChange={u} />
            <FField label="FCP (%)" field="fcp" type="number" value={config.fcp} onChange={u} />
          </div>
        </section>

        {/* PIS / COFINS */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">PIS / COFINS Padrao</h3>
          <div className="grid grid-cols-4 gap-4">
            <FSel label="CST PIS" field="cst_pis_padrao" options={CST_PIS_COFINS} value={config.cst_pis_padrao} onChange={u} />
            <FField label="Aliquota PIS (%)" field="aliquota_pis" placeholder="1.65" type="number" value={config.aliquota_pis} onChange={u} />
            <FSel label="CST COFINS" field="cst_cofins_padrao" options={CST_PIS_COFINS} value={config.cst_cofins_padrao} onChange={u} />
            <FField label="Aliquota COFINS (%)" field="aliquota_cofins" placeholder="7.60" type="number" value={config.aliquota_cofins} onChange={u} />
          </div>
        </section>

        {/* IPI */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">IPI Padrao</h3>
          <div className="grid grid-cols-4 gap-4">
            <FSel label="CST IPI" field="cst_ipi_padrao" options={["50","51","52","53","54","55","99"]} value={config.cst_ipi_padrao} onChange={u} />
            <FField label="Aliquota IPI (%)" field="aliquota_ipi" type="number" value={config.aliquota_ipi} onChange={u} />
            <FField label="Cod. Enquadramento IPI" field="codigo_enquadramento_ipi" placeholder="999" value={config.codigo_enquadramento_ipi} onChange={u} />
          </div>
        </section>

        {/* NATUREZA OPERACAO */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Natureza da Operacao</h3>
          <div className="grid grid-cols-2 gap-4">
            <FField label="Natureza da Operacao" field="natureza_operacao" placeholder="Venda de mercadoria" value={config.natureza_operacao} onChange={u} />
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Informacao Complementar (rodape NF-e)</label>
              <textarea
                value={config.info_complementar ?? ""}
                onChange={(e) => u("info_complementar", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                rows={3}
                placeholder="Documento emitido por ME ou EPP optante pelo Simples Nacional..."
              />
            </div>
          </div>
        </section>

        {/* CERTIFICADO DIGITAL A1 */}
        <section className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Certificado Digital A1</h3>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-bold mb-1">Como funciona:</p>
              <p>O certificado A1 (.pfx) e usado para assinar as notas fiscais e comunicar com a SEFAZ. Custo: ~R$150/ano.</p>
              <p className="mt-1">Compre em: <a href="https://serasa.certificadodigital.com.br" target="_blank" className="underline">Serasa</a> ou <a href="https://www.certisign.com.br" target="_blank" className="underline">Certisign</a></p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Arquivo do Certificado (.pfx)</label>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const formData = new FormData()
                    formData.append("file", file)
                    try {
                      const loginRes = await fetch(`${API}/auth/user/emailpass`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
                      })
                      const { token } = await loginRes.json()
                      const res = await fetch(`${API}/admin/uploads`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                      })
                      const data = await res.json()
                      if (data.files?.[0]?.url) {
                        u("certificado_path", data.files[0].url)
                        setMessage("Certificado enviado com sucesso!")
                      }
                    } catch (err) {
                      setMessage("Erro ao enviar certificado")
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {config.certificado_path && (
                  <p className="text-xs text-green-600 mt-1">Certificado carregado: {config.certificado_path}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Senha do Certificado</label>
                <input
                  type="password"
                  value={config.certificado_senha ?? ""}
                  onChange={(e) => u("certificado_senha", e.target.value)}
                  placeholder="Senha do .pfx"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FField label="Serie NF-e" field="serie_nfe" placeholder="1" value={config.serie_nfe} onChange={u} />
              <FSel label="Ambiente" field="ambiente" options={[
                { value: "homologacao", label: "Homologacao (testes)" },
                { value: "producao", label: "Producao" },
              ]} value={config.ambiente} onChange={u} />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const loginRes = await fetch(`${API}/auth/user/emailpass`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
                      })
                      const { token } = await loginRes.json()
                      const res = await fetch(`${API}/admin/nfe`, { headers: { Authorization: `Bearer ${token}` } })
                      const data = await res.json()
                      if (data.sefaz?.online) {
                        setMessage("SEFAZ Online! Status: " + data.sefaz.motivo)
                      } else {
                        setMessage("SEFAZ: " + (data.sefaz?.error || data.error || "Offline"))
                      }
                    } catch (err) {
                      setMessage("Erro ao verificar SEFAZ")
                    }
                  }}
                  className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
                >
                  Testar Conexao SEFAZ
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
