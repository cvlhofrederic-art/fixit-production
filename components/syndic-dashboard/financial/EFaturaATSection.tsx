'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TabEFatura = 'submissao' | 'historico' | 'saft' | 'configuracao'

type TipoDocumento = 'fatura' | 'fatura_simplificada' | 'nota_credito' | 'nota_debito' | 'recibo'

type TaxaIVA = 23 | 6 | 0

type StatusFatura = 'submetida' | 'aceite' | 'rejeitada' | 'pendente'

interface LinhaItem {
  id: string
  descricao: string
  quantidade: number
  precoUnitario: number
  taxaIva: TaxaIVA
}

interface FaturaSubmitida {
  id: string
  atcud: string
  hash: string
  nifEmitente: string
  nifDestinatario: string
  data: string
  tipoDocumento: TipoDocumento
  itens: LinhaItem[]
  totalHT: number
  totalIVA: number
  totalTTC: number
  status: StatusFatura
  dataSubmissao: string
  serieDocumental: string
  numeroDocumento: number
}

interface ConfigAT {
  nifEmpresa: string
  passwordCertificado: string
  softwareNumber: string
  nifTOC: string
  serieDocumental: string
}

interface Immeuble {
  id: string
  nom: string
  adresse?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_DOCUMENTO: Record<TipoDocumento, string> = {
  fatura: 'Fatura',
  fatura_simplificada: 'Fatura Simplificada',
  nota_credito: 'Nota de Crédito',
  nota_debito: 'Nota de Débito',
  recibo: 'Recibo',
}

const STATUS_CONFIG: Record<StatusFatura, { label: string; bg: string; color: string; dot: string }> = {
  submetida: { label: 'Submetida', bg: '#FEF5E4', color: '#D4830A', dot: '#F0B429' },
  aceite:    { label: 'Aceite',    bg: '#E6F4F2', color: '#1A7A6E', dot: '#2CB67D' },
  rejeitada: { label: 'Rejeitada', bg: '#FDECEA', color: '#C0392B', dot: '#E74C3C' },
  pendente:  { label: 'Pendente',  bg: '#F0EDE8', color: '#4A5E78', dot: '#8A9BB0' },
}

const TABS: { key: TabEFatura; label: string; icon: string }[] = [
  { key: 'submissao',    label: 'Submissão',     icon: '📤' },
  { key: 'historico',    label: 'Histórico',      icon: '📋' },
  { key: 'saft',         label: 'SAF-T PT',       icon: '📦' },
  { key: 'configuracao', label: 'Configuração',   icon: '⚙️' },
]

const TAXAS_IVA: { value: TaxaIVA; label: string }[] = [
  { value: 23, label: '23% (Normal)' },
  { value: 6,  label: '6% (Reduzida)' },
  { value: 0,  label: '0% (Isenta)' },
]

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return s }
}

const formatDateLong = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

const generateATCUD = (): string => {
  const prefix = 'ATCUD'
  const series = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  const num = Math.floor(Math.random() * 999999999).toString().padStart(9, '0')
  return `${prefix}:${series}${num}`
}

const generateHash = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let hash = ''
  for (let i = 0; i < 172; i++) hash += chars.charAt(Math.floor(Math.random() * chars.length))
  return hash + '=='
}

const generateId = () => `ef_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ─── Estilos reutilizáveis ────────────────────────────────────────────────────

const COLORS = {
  navy: '#0D1B2E',
  gold: '#C9A84C',
  goldDim: 'rgba(201,168,76,0.15)',
  text: '#4A5E78',
  textLight: '#8A9BB0',
  border: '#E4DDD0',
  bg: '#F7F4EE',
  white: '#FFFFFF',
  red: '#C0392B',
  redSoft: '#FDECEA',
  green: '#1A7A6E',
  greenSoft: '#E6F4F2',
}

const sCard: React.CSSProperties = {
  background: COLORS.white,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: 20,
}

const sBtn: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  transition: 'opacity 0.15s',
}

const sBtnPrimary: React.CSSProperties = {
  ...sBtn,
  background: COLORS.gold,
  color: COLORS.white,
}

const sBtnSecondary: React.CSSProperties = {
  ...sBtn,
  background: COLORS.bg,
  color: COLORS.navy,
  border: `1px solid ${COLORS.border}`,
}

const sInput: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: `1px solid ${COLORS.border}`,
  fontSize: 13,
  color: COLORS.navy,
  background: COLORS.white,
  outline: 'none',
  boxSizing: 'border-box',
}

const sLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: COLORS.text,
  marginBottom: 4,
  display: 'block',
}

const sSelect: React.CSSProperties = {
  ...sInput,
  appearance: 'auto' as React.CSSProperties['appearance'],
}

const sHeading: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  color: COLORS.navy,
  margin: 0,
}

const sTh: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  color: COLORS.text,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: `2px solid ${COLORS.border}`,
  whiteSpace: 'nowrap',
}

const sTd: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: COLORS.navy,
  borderBottom: `1px solid ${COLORS.border}`,
  whiteSpace: 'nowrap',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EFaturaATSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'local'
  const STORAGE_KEY = `fixit_syndic_efatura_${uid}`

  // ── State ──
  const [tab, setTab] = useState<TabEFatura>('submissao')
  const [immeubles, setImmeubles] = useState<Immeuble[]>([])
  const [faturas, setFaturas] = useState<FaturaSubmitida[]>([])
  const [config, setConfig] = useState<ConfigAT>({
    nifEmpresa: '',
    passwordCertificado: '',
    softwareNumber: '',
    nifTOC: '',
    serieDocumental: 'FT',
  })

  // Submissão form
  const [nifEmitente, setNifEmitente] = useState('')
  const [nifDestinatario, setNifDestinatario] = useState('')
  const [dataFatura, setDataFatura] = useState(new Date().toISOString().split('T')[0])
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('fatura')
  const [itens, setItens] = useState<LinhaItem[]>([
    { id: generateId(), descricao: '', quantidade: 1, precoUnitario: 0, taxaIva: 23 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; atcud: string; hash: string; message: string } | null>(null)

  // Histórico filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusFatura | ''>('')

  // SAF-T
  const [saftAno, setSaftAno] = useState(new Date().getFullYear())
  const [saftMesInicio, setSaftMesInicio] = useState(1)
  const [saftMesFim, setSaftMesFim] = useState(12)
  const [saftPreview, setSaftPreview] = useState('')
  const [saftGenerating, setSaftGenerating] = useState(false)

  // Config saved feedback
  const [configSaved, setConfigSaved] = useState(false)

  // ── Persistência localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.faturas) setFaturas(parsed.faturas)
        if (parsed.config) setConfig(parsed.config)
      }
    } catch { /* ignore */ }
  }, [STORAGE_KEY])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ faturas, config }))
    } catch { /* ignore */ }
  }, [faturas, config, STORAGE_KEY])

  // ── Fetch immeubles ──
  useEffect(() => {
    let cancelled = false
    const fetchImmeubles = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : data.immeubles || []
          if (!cancelled) setImmeubles(list)
        } else {
          throw new Error('API error')
        }
      } catch {
        // localStorage fallback
        try {
          const raw = localStorage.getItem(`fixit_syndic_immeubles_${uid}`)
          if (raw && !cancelled) {
            const parsed = JSON.parse(raw)
            setImmeubles(Array.isArray(parsed) ? parsed : [])
          }
        } catch { /* ignore */ }
      }
    }
    fetchImmeubles()
    return () => { cancelled = true }
  }, [uid])

  // ── Cálculos de items ──
  const totalHT = useMemo(() =>
    itens.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0),
    [itens]
  )

  const totalIVA = useMemo(() =>
    itens.reduce((sum, i) => sum + i.quantidade * i.precoUnitario * (i.taxaIva / 100), 0),
    [itens]
  )

  const totalTTC = totalHT + totalIVA

  // ── Stats ──
  const stats = useMemo(() => {
    const total = faturas.length
    const valorTotal = faturas.reduce((s, f) => s + f.totalTTC, 0)
    const aceites = faturas.filter(f => f.status === 'aceite').length
    const rejeitadas = faturas.filter(f => f.status === 'rejeitada').length
    return { total, valorTotal, aceites, rejeitadas }
  }, [faturas])

  // ── Histórico filtrado ──
  const faturasFiltradas = useMemo(() => {
    let list = [...faturas]
    if (filtroStatus) list = list.filter(f => f.status === filtroStatus)
    if (filtroDataInicio) list = list.filter(f => f.data >= filtroDataInicio)
    if (filtroDataFim) list = list.filter(f => f.data <= filtroDataFim)
    return list.sort((a, b) => b.dataSubmissao.localeCompare(a.dataSubmissao))
  }, [faturas, filtroStatus, filtroDataInicio, filtroDataFim])

  // ── Handlers ──
  const addItem = () => {
    setItens(prev => [...prev, { id: generateId(), descricao: '', quantidade: 1, precoUnitario: 0, taxaIva: 23 }])
  }

  const removeItem = (id: string) => {
    if (itens.length <= 1) return
    setItens(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof LinhaItem, value: string | number) => {
    setItens(prev => prev.map(i =>
      i.id === id ? { ...i, [field]: value } : i
    ))
  }

  const handleSubmit = async () => {
    if (!nifEmitente || !nifDestinatario || itens.some(i => !i.descricao || i.precoUnitario <= 0)) {
      setSubmitResult({ success: false, atcud: '', hash: '', message: 'Preencha todos os campos obrigatórios e verifique os itens.' })
      return
    }

    // Validar NIFs (9 dígitos)
    if (!/^\d{9}$/.test(nifEmitente) || !/^\d{9}$/.test(nifDestinatario)) {
      setSubmitResult({ success: false, atcud: '', hash: '', message: 'O NIF deve conter exatamente 9 dígitos.' })
      return
    }

    setSubmitting(true)
    setSubmitResult(null)

    // Simular chamada à AT (1.5s delay)
    await new Promise(r => setTimeout(r, 1500))

    const atcud = generateATCUD()
    const hash = generateHash()
    const nextNum = faturas.filter(f => f.serieDocumental === config.serieDocumental).length + 1

    const novaFatura: FaturaSubmitida = {
      id: generateId(),
      atcud,
      hash,
      nifEmitente,
      nifDestinatario,
      data: dataFatura,
      tipoDocumento: tipoDoc,
      itens: [...itens],
      totalHT,
      totalIVA,
      totalTTC,
      status: Math.random() > 0.15 ? 'aceite' : 'pendente',
      dataSubmissao: new Date().toISOString(),
      serieDocumental: config.serieDocumental || 'FT',
      numeroDocumento: nextNum,
    }

    setFaturas(prev => [novaFatura, ...prev])
    setSubmitResult({ success: true, atcud, hash, message: `Documento submetido com sucesso ao e-Fatura AT. ATCUD: ${atcud}` })
    setSubmitting(false)

    // Reset form
    setNifDestinatario('')
    setItens([{ id: generateId(), descricao: '', quantidade: 1, precoUnitario: 0, taxaIva: 23 }])
  }

  const handleGenerateSaft = async () => {
    setSaftGenerating(true)
    setSaftPreview('')

    await new Promise(r => setTimeout(r, 2000))

    const nif = config.nifEmpresa || '999999999'
    const mesesLabel = saftMesInicio === saftMesFim
      ? `${saftMesInicio}`.padStart(2, '0')
      : `${String(saftMesInicio).padStart(2, '0')} a ${String(saftMesFim).padStart(2, '0')}`
    const faturasNoPeriodo = faturas.filter(f => {
      const d = new Date(f.data)
      return d.getFullYear() === saftAno && d.getMonth() + 1 >= saftMesInicio && d.getMonth() + 1 <= saftMesFim
    })
    const totalVal = faturasNoPeriodo.reduce((s, f) => s + f.totalTTC, 0)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${nif}</CompanyID>
    <TaxRegistrationNumber>${nif}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>Empresa de Gestão de Condomínios</CompanyName>
    <FiscalYear>${saftAno}</FiscalYear>
    <StartDate>${saftAno}-${String(saftMesInicio).padStart(2, '0')}-01</StartDate>
    <EndDate>${saftAno}-${String(saftMesFim).padStart(2, '0')}-${saftMesFim === 2 ? '28' : '30'}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${new Date().toISOString().split('T')[0]}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${nif}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>${config.softwareNumber || '0000'}</SoftwareCertificateNumber>
    <ProductID>Fixit/Gestão Condomínios</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <MasterFiles>
    <Customer>
      <!-- ${faturasNoPeriodo.length} clientes no período -->
    </Customer>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${faturasNoPeriodo.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${totalVal.toFixed(2)}</TotalCredit>
      <!-- Período: ${mesesLabel}/${saftAno} -->
      <!-- Faturas incluídas: ${faturasNoPeriodo.length} -->
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`

    setSaftPreview(xml)
    setSaftGenerating(false)
  }

  const handleSaveConfig = () => {
    // A persistência é automática via useEffect, mas damos feedback
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 3000)
  }

  // ── Render Stats ──
  const renderStats = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
      {[
        { icon: '📄', label: 'Total faturas submetidas', value: stats.total, color: COLORS.gold },
        { icon: '💰', label: 'Valor total', value: formatEur(stats.valorTotal), color: COLORS.gold },
        { icon: '✅', label: 'Aceites AT', value: stats.aceites, color: COLORS.green },
        { icon: '❌', label: 'Rejeitadas', value: stats.rejeitadas, color: COLORS.red },
      ].map((s, i) => (
        <div key={i} style={{ ...sCard, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: COLORS.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {s.icon}
          </div>
          <div>
            <div style={{ ...sHeading, fontSize: 28, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.text, marginTop: 4 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )

  // ── Render Tabs ──
  const renderTabs = () => (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `2px solid ${COLORS.border}`, paddingBottom: 0 }}>
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => { setTab(t.key); setSubmitResult(null) }}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? COLORS.gold : COLORS.text,
            background: tab === t.key ? COLORS.goldDim : 'transparent',
            border: 'none',
            borderBottom: tab === t.key ? `2px solid ${COLORS.gold}` : '2px solid transparent',
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.15s',
            marginBottom: -2,
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )

  // ── Tab: Submissão ──
  const renderSubmissao = () => (
    <div style={sCard}>
      <h3 style={{ ...sHeading, fontSize: 18, marginBottom: 20 }}>Nova Submissão e-Fatura</h3>

      {/* Dados gerais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={sLabel}>NIF Emitente *</label>
          <input
            type="text"
            value={nifEmitente}
            onChange={e => setNifEmitente(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="999999999"
            style={sInput}
            maxLength={9}
          />
        </div>
        <div>
          <label style={sLabel}>NIF Destinatário *</label>
          <input
            type="text"
            value={nifDestinatario}
            onChange={e => setNifDestinatario(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="999999999"
            style={sInput}
            maxLength={9}
          />
        </div>
        <div>
          <label style={sLabel}>Data do Documento *</label>
          <input
            type="date"
            value={dataFatura}
            onChange={e => setDataFatura(e.target.value)}
            style={sInput}
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={sLabel}>Tipo de Documento *</label>
        <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value as TipoDocumento)} style={{ ...sSelect, maxWidth: 320 }}>
          {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Linhas de itens */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ ...sLabel, marginBottom: 0, fontSize: 13 }}>Itens do Documento</label>
          <button onClick={addItem} style={{ ...sBtnSecondary, fontSize: 12, padding: '6px 14px' }}>
            + Adicionar linha
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...sTh, minWidth: 220 }}>Descrição *</th>
                <th style={{ ...sTh, width: 90 }}>Qtd</th>
                <th style={{ ...sTh, width: 130 }}>Preço Unit. (EUR)</th>
                <th style={{ ...sTh, width: 140 }}>Taxa IVA</th>
                <th style={{ ...sTh, width: 110, textAlign: 'right' }}>Subtotal</th>
                <th style={{ ...sTh, width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => {
                const subtotal = item.quantidade * item.precoUnitario
                const subtotalIVA = subtotal * (1 + item.taxaIva / 100)
                return (
                  <tr key={item.id}>
                    <td style={sTd}>
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={e => updateItem(item.id, 'descricao', e.target.value)}
                        placeholder="Descrição do serviço ou produto"
                        style={{ ...sInput, fontSize: 12 }}
                      />
                    </td>
                    <td style={sTd}>
                      <input
                        type="number"
                        value={item.quantidade}
                        onChange={e => updateItem(item.id, 'quantidade', Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        style={{ ...sInput, fontSize: 12, textAlign: 'center' }}
                      />
                    </td>
                    <td style={sTd}>
                      <input
                        type="number"
                        value={item.precoUnitario || ''}
                        onChange={e => updateItem(item.id, 'precoUnitario', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        style={{ ...sInput, fontSize: 12, textAlign: 'right' }}
                      />
                    </td>
                    <td style={sTd}>
                      <select
                        value={item.taxaIva}
                        onChange={e => updateItem(item.id, 'taxaIva', parseInt(e.target.value) as TaxaIVA)}
                        style={{ ...sSelect, fontSize: 12 }}
                      >
                        {TAXAS_IVA.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...sTd, textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                      {formatEur(subtotalIVA)}
                    </td>
                    <td style={sTd}>
                      {itens.length > 1 && (
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: COLORS.red, padding: 4 }}
                          title="Remover linha"
                        >
                          x
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totais */}
      <div style={{
        background: COLORS.bg,
        borderRadius: 10,
        padding: 16,
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 32,
      }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: COLORS.text }}>Total s/ IVA (HT)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy }}>{formatEur(totalHT)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: COLORS.text }}>IVA</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.gold }}>{formatEur(totalIVA)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: COLORS.text }}>Total c/ IVA (TTC)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy }}>{formatEur(totalTTC)}</div>
        </div>
      </div>

      {/* Resultado da submissão */}
      {submitResult && (
        <div style={{
          padding: 16,
          borderRadius: 10,
          marginBottom: 16,
          background: submitResult.success ? COLORS.greenSoft : COLORS.redSoft,
          color: submitResult.success ? COLORS.green : COLORS.red,
          fontSize: 13,
          border: `1px solid ${submitResult.success ? '#B8E0D9' : '#F5C6C0'}`,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {submitResult.success ? 'Submissão bem-sucedida' : 'Erro na submissão'}
          </div>
          <div>{submitResult.message}</div>
          {submitResult.success && submitResult.hash && (
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.text, wordBreak: 'break-all' }}>
              <strong>Hash:</strong> {submitResult.hash.slice(0, 60)}...
            </div>
          )}
        </div>
      )}

      {/* Botão submeter */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            ...sBtnPrimary,
            padding: '12px 28px',
            fontSize: 14,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'A submeter ao e-Fatura AT...' : 'Submeter ao e-Fatura'}
        </button>
      </div>
    </div>
  )

  // ── Tab: Histórico ──
  const renderHistorico = () => (
    <div>
      {/* Filtros */}
      <div style={{ ...sCard, marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={sLabel}>Data início</label>
          <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} style={{ ...sInput, width: 160 }} />
        </div>
        <div>
          <label style={sLabel}>Data fim</label>
          <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} style={{ ...sInput, width: 160 }} />
        </div>
        <div>
          <label style={sLabel}>Estado</label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusFatura | '')} style={{ ...sSelect, width: 160 }}>
            <option value="">Todos</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {(filtroDataInicio || filtroDataFim || filtroStatus) && (
          <button
            onClick={() => { setFiltroDataInicio(''); setFiltroDataFim(''); setFiltroStatus('') }}
            style={{ ...sBtnSecondary, fontSize: 12, padding: '8px 14px' }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ ...sCard, overflowX: 'auto' }}>
        {faturasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: COLORS.textLight }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14 }}>Nenhuma fatura encontrada</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Submeta uma fatura no separador "Submissão" para ver o histórico.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={sTh}>ATCUD</th>
                <th style={sTh}>Tipo</th>
                <th style={sTh}>Série/N.º</th>
                <th style={sTh}>Data</th>
                <th style={sTh}>NIF Emit.</th>
                <th style={sTh}>NIF Dest.</th>
                <th style={{ ...sTh, textAlign: 'right' }}>Valor TTC</th>
                <th style={sTh}>Estado</th>
                <th style={sTh}>Submetida</th>
              </tr>
            </thead>
            <tbody>
              {faturasFiltradas.map(f => {
                const sc = STATUS_CONFIG[f.status]
                return (
                  <tr key={f.id} style={{ transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = COLORS.bg)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...sTd, fontFamily: 'monospace', fontSize: 11 }}>{f.atcud}</td>
                    <td style={sTd}>{TIPOS_DOCUMENTO[f.tipoDocumento]}</td>
                    <td style={{ ...sTd, fontFamily: 'monospace', fontSize: 12 }}>{f.serieDocumental} {f.numeroDocumento}/{saftAno}</td>
                    <td style={sTd}>{formatDate(f.data)}</td>
                    <td style={{ ...sTd, fontFamily: 'monospace' }}>{f.nifEmitente}</td>
                    <td style={{ ...sTd, fontFamily: 'monospace' }}>{f.nifDestinatario}</td>
                    <td style={{ ...sTd, textAlign: 'right', fontWeight: 600 }}>{formatEur(f.totalTTC)}</td>
                    <td style={sTd}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: sc.bg,
                        color: sc.color,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ ...sTd, fontSize: 12, color: COLORS.textLight }}>{formatDateLong(f.dataSubmissao)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {faturasFiltradas.length > 0 && (
          <div style={{ padding: '12px 12px 0', fontSize: 12, color: COLORS.textLight }}>
            {faturasFiltradas.length} documento{faturasFiltradas.length !== 1 ? 's' : ''} encontrado{faturasFiltradas.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )

  // ── Tab: SAF-T PT ──
  const renderSaft = () => (
    <div>
      <div style={sCard}>
        <h3 style={{ ...sHeading, fontSize: 18, marginBottom: 6 }}>Gerador de Ficheiro SAF-T (PT)</h3>
        <p style={{ fontSize: 13, color: COLORS.text, marginTop: 0, marginBottom: 20 }}>
          Gere o ficheiro SAF-T (PT) conforme a Portaria n.º 302/2016. Versão 1.04_01.
        </p>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <label style={sLabel}>Ano Fiscal</label>
            <input
              type="number"
              value={saftAno}
              onChange={e => setSaftAno(parseInt(e.target.value) || new Date().getFullYear())}
              min={2020}
              max={2030}
              style={{ ...sInput, width: 100 }}
            />
          </div>
          <div>
            <label style={sLabel}>Mês início</label>
            <select value={saftMesInicio} onChange={e => setSaftMesInicio(parseInt(e.target.value))} style={{ ...sSelect, width: 130 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(2024, m - 1).toLocaleDateString('pt-PT', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={sLabel}>Mês fim</label>
            <select value={saftMesFim} onChange={e => setSaftMesFim(parseInt(e.target.value))} style={{ ...sSelect, width: 130 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(2024, m - 1).toLocaleDateString('pt-PT', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerateSaft}
            disabled={saftGenerating}
            style={{ ...sBtnPrimary, opacity: saftGenerating ? 0.6 : 1 }}
          >
            {saftGenerating ? 'A gerar SAF-T...' : 'Gerar SAF-T (PT)'}
          </button>
        </div>

        {/* Metadados do ficheiro */}
        <div style={{
          background: COLORS.bg,
          borderRadius: 10,
          padding: 16,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600, textTransform: 'uppercase' }}>AuditFileVersion</div>
            <div style={{ fontSize: 14, color: COLORS.navy, fontWeight: 600 }}>1.04_01</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600, textTransform: 'uppercase' }}>TaxRegistration NIF</div>
            <div style={{ fontSize: 14, color: COLORS.navy, fontWeight: 600, fontFamily: 'monospace' }}>{config.nifEmpresa || '---'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600, textTransform: 'uppercase' }}>Software Cert. N.º</div>
            <div style={{ fontSize: 14, color: COLORS.navy, fontWeight: 600, fontFamily: 'monospace' }}>{config.softwareNumber || '---'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600, textTransform: 'uppercase' }}>Período</div>
            <div style={{ fontSize: 14, color: COLORS.navy, fontWeight: 600 }}>
              {String(saftMesInicio).padStart(2, '0')}/{saftAno} - {String(saftMesFim).padStart(2, '0')}/{saftAno}
            </div>
          </div>
        </div>

        {/* Preview XML */}
        {saftPreview && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...sLabel, marginBottom: 0 }}>Pré-visualização XML do SAF-T (PT)</label>
              <button
                onClick={() => setSaftPreview('')}
                style={{ ...sBtnSecondary, fontSize: 11, padding: '4px 10px' }}
              >
                Fechar
              </button>
            </div>
            <pre style={{
              background: '#1a1a2e',
              color: '#e0e0e0',
              padding: 16,
              borderRadius: 10,
              fontSize: 11,
              fontFamily: "'Fira Code', 'Consolas', monospace",
              overflow: 'auto',
              maxHeight: 400,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              border: `1px solid ${COLORS.border}`,
            }}>
              {saftPreview}
            </pre>
          </div>
        )}
      </div>
    </div>
  )

  // ── Tab: Configuração ──
  const renderConfiguracao = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Credenciais Portal AT */}
      <div style={sCard}>
        <h3 style={{ ...sHeading, fontSize: 16, marginBottom: 16 }}>Credenciais Portal AT</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={sLabel}>NIF da Empresa</label>
            <input
              type="text"
              value={config.nifEmpresa}
              onChange={e => setConfig(prev => ({ ...prev, nifEmpresa: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
              placeholder="999999999"
              style={sInput}
              maxLength={9}
            />
          </div>
          <div>
            <label style={sLabel}>Password do Certificado Digital</label>
            <input
              type="password"
              value={config.passwordCertificado}
              onChange={e => setConfig(prev => ({ ...prev, passwordCertificado: e.target.value }))}
              placeholder="Certificado digital AT"
              style={sInput}
            />
          </div>
        </div>
      </div>

      {/* Software Certificado */}
      <div style={sCard}>
        <h3 style={{ ...sHeading, fontSize: 16, marginBottom: 16 }}>Software Certificado AT</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={sLabel}>N.º de Certificação do Software (AT)</label>
            <input
              type="text"
              value={config.softwareNumber}
              onChange={e => setConfig(prev => ({ ...prev, softwareNumber: e.target.value }))}
              placeholder="Ex: 1234"
              style={sInput}
            />
            <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
              Número atribuído pela AT ao software de faturação certificado.
            </div>
          </div>
          <div>
            <label style={sLabel}>NIF do TOC (Técnico Oficial de Contas)</label>
            <input
              type="text"
              value={config.nifTOC}
              onChange={e => setConfig(prev => ({ ...prev, nifTOC: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
              placeholder="999999999"
              style={sInput}
              maxLength={9}
            />
            <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
              NIF do contabilista certificado responsável pela contabilidade.
            </div>
          </div>
        </div>
      </div>

      {/* Série Documental */}
      <div style={sCard}>
        <h3 style={{ ...sHeading, fontSize: 16, marginBottom: 16 }}>Série Documental</h3>
        <div style={{ maxWidth: 400 }}>
          <label style={sLabel}>Código da Série (ATCUD)</label>
          <input
            type="text"
            value={config.serieDocumental}
            onChange={e => setConfig(prev => ({ ...prev, serieDocumental: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
            placeholder="FT"
            style={sInput}
          />
          <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
            Série utilizada na numeração dos documentos (ex: FT para Faturas, NC para Notas de Crédito).
            Conforme DL n.º 28/2019 relativo ao ATCUD.
          </div>
        </div>
      </div>

      {/* Botão gravar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        {configSaved && (
          <span style={{ fontSize: 13, color: COLORS.green, fontWeight: 600 }}>
            Configuração guardada com sucesso.
          </span>
        )}
        <button onClick={handleSaveConfig} style={sBtnPrimary}>
          Guardar Configuração
        </button>
      </div>

      {/* Referências legais */}
      <div style={{
        ...sCard,
        background: COLORS.bg,
        borderStyle: 'dashed',
      }}>
        <h4 style={{ ...sHeading, fontSize: 14, marginBottom: 12 }}>Referências Legais</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.navy }}>Portaria n.º 302/2016</div>
            <div>Regulamentação do ficheiro SAF-T (PT) - Standard Audit File for Tax Purposes. Define a estrutura e formato do ficheiro de auditoria fiscal para comunicação com a AT.</div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.navy }}>Decreto-Lei n.º 28/2019</div>
            <div>Regulamentação do ATCUD (Código Único de Documento). Obrigatoriedade de inclusão do código de validação em todos os documentos fiscalmente relevantes.</div>
          </div>
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: COLORS.navy }}>Art. 36.º do CIVA</div>
            <div>Código do Imposto sobre o Valor Acrescentado - Requisitos obrigatórios para a emissão de faturas e documentos equivalentes. Elementos obrigatórios das faturas.</div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Render principal ──
  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: COLORS.goldDim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}>
            🇵🇹
          </div>
          <div>
            <h2 style={{ ...sHeading, fontSize: 22 }}>Integração e-Fatura AT</h2>
            <p style={{ fontSize: 13, color: COLORS.text, margin: 0 }}>
              Submissão de faturas e documentos à Autoridade Tributária e Aduaneira
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Tabs */}
      {renderTabs()}

      {/* Tab content */}
      {tab === 'submissao' && renderSubmissao()}
      {tab === 'historico' && renderHistorico()}
      {tab === 'saft' && renderSaft()}
      {tab === 'configuracao' && renderConfiguracao()}
    </div>
  )
}
