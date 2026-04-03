'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'apolices' | 'sinistros' | 'alertas'
type TipoSeguro = 'incendio' | 'multiriscos' | 'rc_condominio' | 'acidentes_trabalho' | 'recheio_comum' | 'obras' | 'outro'
type EstadoApolice = 'ativa' | 'expirada' | 'pendente' | 'cancelada'

interface Apolice {
  id: string
  immeubleId: string
  immeubleNom: string
  tipo: TipoSeguro
  seguradora: string
  numeroApolice: string
  capitalSeguro: number
  premioAnual: number
  franquia: number
  dataInicio: string
  dataFim: string
  estado: EstadoApolice
  coberturas: string[]
  contactoSeguradora: string
  notas: string
}

interface SinistroSeguro {
  id: string
  apoliceId: string
  immeubleNom: string
  tipo: string
  dataOcorrencia: string
  descricao: string
  montanteReclamado: number
  montanteIndemnizado: number
  estado: 'aberto' | 'em_analise' | 'indemnizado' | 'recusado'
  referencia: string
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TIPO_SEGURO_CFG: Record<TipoSeguro, { label: string; icon: string; color: string; obrigatorio: boolean }> = {
  incendio:            { label: 'Incêndio',             icon: '🔥', color: 'bg-red-100 text-red-700',     obrigatorio: true },
  multiriscos:         { label: 'Multiriscos',          icon: '🛡️', color: 'bg-blue-100 text-blue-700',   obrigatorio: false },
  rc_condominio:       { label: 'RC Condomínio',        icon: '⚖️', color: 'bg-purple-100 text-purple-700', obrigatorio: false },
  acidentes_trabalho:  { label: 'Acidentes Trabalho',   icon: '🏗️', color: 'bg-amber-100 text-amber-700', obrigatorio: false },
  recheio_comum:       { label: 'Recheio Comum',        icon: '🏠', color: 'bg-green-100 text-green-700', obrigatorio: false },
  obras:               { label: 'Obras / Construção',   icon: '🔨', color: 'bg-orange-100 text-orange-700', obrigatorio: false },
  outro:               { label: 'Outro',                icon: '📋', color: 'bg-gray-100 text-gray-600',  obrigatorio: false },
}

const ESTADO_CFG: Record<EstadoApolice, { label: string; color: string }> = {
  ativa:     { label: 'Ativa',     color: 'bg-emerald-100 text-emerald-700' },
  expirada:  { label: 'Expirada',  color: 'bg-red-100 text-red-700' },
  pendente:  { label: 'Pendente',  color: 'bg-amber-100 text-amber-700' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600' },
}

const SEGURADORAS_PT = [
  'Fidelidade', 'Ageas', 'Allianz', 'Generali', 'Liberty', 'Zurich',
  'Tranquilidade', 'Mapfre', 'OK! Seguros', 'Lusitania', 'CA Seguros', 'Outra'
]

const COBERTURAS_PADRAO: Record<TipoSeguro, string[]> = {
  incendio: ['Incêndio', 'Explosão', 'Raio', 'Tempestade', 'Inundação'],
  multiriscos: ['Incêndio', 'Danos por água', 'Furto/Roubo', 'Quebra de vidros', 'RC', 'Fenómenos sísmicos', 'Tempestade'],
  rc_condominio: ['RC partes comuns', 'RC elevador', 'RC danos a terceiros', 'Defesa jurídica'],
  acidentes_trabalho: ['AT empregados condomínio', 'Porteiro', 'Limpeza'],
  recheio_comum: ['Mobiliário partes comuns', 'Equipamentos', 'Eletrodomésticos'],
  obras: ['RC obras', 'Danos materiais', 'Acidentes laborais'],
  outro: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 10)
const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT') } catch { return s }
}
const daysDiff = (d: string) => {
  try { return Math.round((new Date(d).getTime() - Date.now()) / 86400000) } catch { return 0 }
}

// ─── Composant ───────────────────────────────────────────────────────────────

interface Props { user: User; userRole: string }

export default function GestaoSegurosSection({ user }: Props) {
  const uid = user?.id || 'demo'
  const lsKey = (k: string) => `fixit_syndic_${uid}_${k}`

  const [tab, setTab] = useState<TabId>('dashboard')
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([])
  const [apolices, setApolices] = useState<Apolice[]>([])
  const [sinistros, setSinistros] = useState<SinistroSeguro[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filterImm, setFilterImm] = useState('')

  // Form
  const [form, setForm] = useState<Partial<Apolice>>({
    tipo: 'incendio', seguradora: '', numeroApolice: '', capitalSeguro: 0,
    premioAnual: 0, franquia: 0, dataInicio: '', dataFim: '', coberturas: [], notas: '', contactoSeguradora: '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/syndic/immeubles?user_id=${uid}`)
        const data = await res.json()
        setImmeubles((data.immeubles || []).map((i: { id: string; nom: string }) => ({ id: i.id, nom: i.nom })))
      } catch {}
      setApolices(JSON.parse(localStorage.getItem(lsKey('apolices_seguros')) || '[]'))
      setSinistros(JSON.parse(localStorage.getItem(lsKey('sinistros_seguros')) || '[]'))
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  const saveApolices = useCallback((a: Apolice[]) => {
    setApolices(a)
    localStorage.setItem(lsKey('apolices_seguros'), JSON.stringify(a))
  }, [lsKey])

  const handleAdd = () => {
    if (!form.seguradora || !form.dataInicio || !form.dataFim || !form.immeubleId) return
    const immNom = immeubles.find(i => i.id === form.immeubleId)?.nom || ''
    const estado: EstadoApolice = daysDiff(form.dataFim!) < 0 ? 'expirada' : 'ativa'
    const newApolice: Apolice = {
      id: genId(),
      immeubleId: form.immeubleId || '',
      immeubleNom: immNom,
      tipo: form.tipo as TipoSeguro || 'incendio',
      seguradora: form.seguradora || '',
      numeroApolice: form.numeroApolice || '',
      capitalSeguro: form.capitalSeguro || 0,
      premioAnual: form.premioAnual || 0,
      franquia: form.franquia || 0,
      dataInicio: form.dataInicio || '',
      dataFim: form.dataFim || '',
      estado,
      coberturas: form.coberturas || [],
      contactoSeguradora: form.contactoSeguradora || '',
      notas: form.notas || '',
    }
    saveApolices([newApolice, ...apolices])
    setShowModal(false)
    setForm({ tipo: 'incendio', seguradora: '', numeroApolice: '', capitalSeguro: 0, premioAnual: 0, franquia: 0, dataInicio: '', dataFim: '', coberturas: [], notas: '', contactoSeguradora: '' })
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const ativas = apolices.filter(a => a.estado === 'ativa')
    const expiradas = apolices.filter(a => a.estado === 'expirada' || daysDiff(a.dataFim) < 0)
    const aExpirar = apolices.filter(a => { const d = daysDiff(a.dataFim); return d >= 0 && d <= 60 })
    const totalPremios = ativas.reduce((s, a) => s + a.premioAnual, 0)
    const totalCapital = ativas.reduce((s, a) => s + a.capitalSeguro, 0)
    // Immeubles sem seguro incêndio obrigatório
    const immComIncendio = new Set(apolices.filter(a => a.tipo === 'incendio' && a.estado === 'ativa').map(a => a.immeubleId))
    const immSemIncendio = immeubles.filter(i => !immComIncendio.has(i.id))
    return { ativas: ativas.length, expiradas: expiradas.length, aExpirar: aExpirar.length, totalPremios, totalCapital, immSemIncendio }
  }, [apolices, immeubles])

  const filteredApolices = useMemo(() =>
    filterImm ? apolices.filter(a => a.immeubleId === filterImm) : apolices
  , [apolices, filterImm])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0D1B2E]">🛡️ Gestão de Seguros</h2>
          <p className="text-sm text-gray-500 mt-1">Apólices, coberturas, sinistros e alertas por edifício</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-[#0D1B2E] text-white rounded-xl text-sm font-medium hover:bg-[#0D1B2E]/90 transition-all">
          ➕ Nova Apólice
        </button>
      </div>

      {/* Alertes urgentes */}
      {stats.immSemIncendio.length > 0 && (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
          <p className="font-semibold text-red-700 text-sm mb-1">🔴 ALERTA: Seguro obrigatório em falta!</p>
          <p className="text-xs text-red-600">
            Art.º 1429.º do Código Civil — O seguro contra incêndio é OBRIGATÓRIO.
            Edifícios sem seguro ativo: <strong>{stats.immSemIncendio.map(i => i.nom).join(', ')}</strong>
          </p>
        </div>
      )}
      {stats.aExpirar > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <p className="font-semibold text-amber-700 text-sm">⚠️ {stats.aExpirar} apólice(s) a expirar nos próximos 60 dias</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Apólices Ativas', value: stats.ativas, color: 'text-emerald-600' },
          { label: 'Expiradas', value: stats.expiradas, color: 'text-red-600' },
          { label: 'A Expirar (60d)', value: stats.aExpirar, color: 'text-amber-600' },
          { label: 'Total Prémios/Ano', value: formatEur(stats.totalPremios), color: 'text-[#0D1B2E]' },
          { label: 'Capital Total', value: formatEur(stats.totalCapital), color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'dashboard' as TabId, label: 'Visão Geral', icon: '📊' },
          { id: 'apolices' as TabId, label: 'Apólices', icon: '📋' },
          { id: 'sinistros' as TabId, label: 'Sinistros', icon: '🚨' },
          { id: 'alertas' as TabId, label: 'Alertas', icon: '🔔' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${tab === t.id ? 'bg-white text-[#0D1B2E] shadow-sm' : 'text-gray-500'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filter par immeuble */}
      <div className="flex items-center gap-3">
        <select value={filterImm} onChange={e => setFilterImm(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
          <option value="">Todos os edifícios</option>
          {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
        </select>
      </div>

      {/* ═══ TAB: Dashboard ═══ */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          {immeubles.map(imm => {
            const immApolices = apolices.filter(a => a.immeubleId === imm.id)
            const hasIncendio = immApolices.some(a => a.tipo === 'incendio' && a.estado === 'ativa')
            return (
              <div key={imm.id} className={`bg-white rounded-xl border p-5 shadow-sm ${!hasIncendio ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-[#0D1B2E]">{imm.nom}</p>
                    <p className="text-xs text-gray-400">{immApolices.length} apólice(s)</p>
                  </div>
                  {!hasIncendio && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">⚠️ Sem seguro incêndio</span>
                  )}
                </div>
                {immApolices.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {immApolices.map(a => {
                      const tipoCfg = TIPO_SEGURO_CFG[a.tipo]
                      const daysLeft = daysDiff(a.dataFim)
                      const realEstado = daysLeft < 0 ? 'expirada' : a.estado
                      return (
                        <div key={a.id} className={`rounded-lg border p-3 ${daysLeft < 0 ? 'border-red-200 bg-red-50/50' : daysLeft < 60 ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tipoCfg.color}`}>{tipoCfg.icon} {tipoCfg.label}</span>
                            {tipoCfg.obrigatorio && <span className="text-xs text-red-500 font-medium">Obrigatório</span>}
                          </div>
                          <p className="text-xs text-gray-600 font-medium">{a.seguradora}</p>
                          <p className="text-xs text-gray-400">N.º {a.numeroApolice || '—'}</p>
                          <div className="flex justify-between mt-2 text-xs">
                            <span className="text-gray-500">Prémio: {formatEur(a.premioAnual)}/ano</span>
                            <span className={`font-medium ${ESTADO_CFG[realEstado].color} px-1.5 py-0.5 rounded`}>
                              {daysLeft < 0 ? `Expirou há ${Math.abs(daysLeft)}d` : daysLeft < 60 ? `Expira em ${daysLeft}d` : ESTADO_CFG[realEstado].label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Nenhuma apólice registada</p>
                )}
              </div>
            )
          })}
          {immeubles.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><p className="text-gray-400">Nenhum edifício registado</p></div>
          )}
        </div>
      )}

      {/* ═══ TAB: Apólices ═══ */}
      {tab === 'apolices' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {filteredApolices.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-4xl mb-2">🛡️</p>
              <p className="text-sm">Nenhuma apólice registada</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50">
                  <th className="text-left px-4 py-3">Edifício</th>
                  <th className="text-left px-3 py-3">Tipo</th>
                  <th className="text-left px-3 py-3">Seguradora</th>
                  <th className="text-right px-3 py-3">Capital</th>
                  <th className="text-right px-3 py-3">Prémio/Ano</th>
                  <th className="text-left px-3 py-3">Validade</th>
                  <th className="text-left px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredApolices.map(a => {
                  const tipoCfg = TIPO_SEGURO_CFG[a.tipo]
                  const daysLeft = daysDiff(a.dataFim)
                  const realEstado = daysLeft < 0 ? 'expirada' : a.estado
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-[#0D1B2E]">{a.immeubleNom}</td>
                      <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${tipoCfg.color}`}>{tipoCfg.icon} {tipoCfg.label}</span></td>
                      <td className="px-3 py-3 text-xs text-gray-600">{a.seguradora}</td>
                      <td className="px-3 py-3 text-xs text-right font-mono">{formatEur(a.capitalSeguro)}</td>
                      <td className="px-3 py-3 text-xs text-right font-mono">{formatEur(a.premioAnual)}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{formatDate(a.dataInicio)} → {formatDate(a.dataFim)}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_CFG[realEstado].color}`}>
                          {ESTADO_CFG[realEstado].label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ TAB: Sinistros ═══ */}
      {tab === 'sinistros' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <p className="text-4xl mb-2">🚨</p>
          <p className="font-semibold text-[#0D1B2E]">Gestão de Sinistros</p>
          <p className="text-xs text-gray-400 mt-1">Registe sinistros ligados às apólices para acompanhar indemnizações</p>
          <p className="text-xs text-gray-400 mt-1">{sinistros.length} sinistro(s) registado(s)</p>
        </div>
      )}

      {/* ═══ TAB: Alertas ═══ */}
      {tab === 'alertas' && (
        <div className="space-y-3">
          {stats.immSemIncendio.length > 0 && stats.immSemIncendio.map(imm => (
            <div key={imm.id} className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-sm font-semibold text-red-700">🔴 {imm.nom} — Sem seguro incêndio obrigatório</p>
              <p className="text-xs text-red-600 mt-1">Art.º 1429.º CC: o seguro contra incêndio é obrigatório para todos os condomínios.</p>
            </div>
          ))}
          {apolices.filter(a => { const d = daysDiff(a.dataFim); return d >= 0 && d <= 60 }).map(a => (
            <div key={a.id} className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <p className="text-sm font-semibold text-amber-700">⚠️ {a.immeubleNom} — {TIPO_SEGURO_CFG[a.tipo].label} expira em {daysDiff(a.dataFim)} dias</p>
              <p className="text-xs text-amber-600 mt-1">{a.seguradora} • N.º {a.numeroApolice} • Expira {formatDate(a.dataFim)}</p>
            </div>
          ))}
          {stats.immSemIncendio.length === 0 && stats.aExpirar === 0 && (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-8 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-medium text-emerald-700">Tudo em ordem!</p>
              <p className="text-xs text-emerald-600">Todos os seguros obrigatórios estão ativos e sem alertas.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Modal Nova Apólice ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-[#0D1B2E]">🛡️ Nova Apólice de Seguro</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Edifício *</label>
                <select value={form.immeubleId || ''} onChange={e => setForm({...form, immeubleId: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Selecionar...</option>
                  {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo de Seguro</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.entries(TIPO_SEGURO_CFG) as [TipoSeguro, typeof TIPO_SEGURO_CFG[TipoSeguro]][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => { setForm({...form, tipo: key, coberturas: COBERTURAS_PADRAO[key]})} } className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${form.tipo === key ? `ring-2 ring-[#C9A84C] ${cfg.color}` : 'bg-gray-50 hover:bg-gray-100'}`}>
                      {cfg.icon} {cfg.label} {cfg.obrigatorio && <span className="text-red-500">*</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Seguradora *</label>
                  <select value={form.seguradora || ''} onChange={e => setForm({...form, seguradora: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Selecionar...</option>
                    {SEGURADORAS_PT.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">N.º Apólice</label>
                  <input value={form.numeroApolice || ''} onChange={e => setForm({...form, numeroApolice: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex: 123456789" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Capital Seguro (EUR)</label>
                  <input type="number" value={form.capitalSeguro || ''} onChange={e => setForm({...form, capitalSeguro: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Prémio Anual (EUR)</label>
                  <input type="number" value={form.premioAnual || ''} onChange={e => setForm({...form, premioAnual: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Franquia (EUR)</label>
                  <input type="number" value={form.franquia || ''} onChange={e => setForm({...form, franquia: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data Início *</label>
                  <input type="date" value={form.dataInicio || ''} onChange={e => setForm({...form, dataInicio: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data Fim *</label>
                  <input type="date" value={form.dataFim || ''} onChange={e => setForm({...form, dataFim: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              {form.coberturas && form.coberturas.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Coberturas incluídas</label>
                  <div className="flex flex-wrap gap-1">
                    {form.coberturas.map(c => (
                      <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Contacto Seguradora</label>
                <input value={form.contactoSeguradora || ''} onChange={e => setForm({...form, contactoSeguradora: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Telefone ou email" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancelar</button>
              <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-[#0D1B2E] text-white rounded-lg text-sm font-medium hover:bg-[#0D1B2E]/90">✅ Registar Apólice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
