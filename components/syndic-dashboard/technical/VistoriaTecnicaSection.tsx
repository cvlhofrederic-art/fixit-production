'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EstadoItem = 'bom' | 'vigiar' | 'deficiente' | 'ausente' | 'na'
type EstadoVistoria = 'em_curso' | 'concluida' | 'enviada'

interface ItemChecklist {
  id: string
  categoria: string
  descricao: string
  estado: EstadoItem
  notas: string
}

interface Vistoria {
  id: string
  edificio: string
  morada: string
  inspetor: string
  dataVistoria: string
  estado: EstadoVistoria
  items: ItemChecklist[]
  observacoes: string
  createdAt: string
  updatedAt: string
}

// ─── Checklist de referência ─────────────────────────────────────────────────

const CHECKLIST_REF: { categoria: string; icon: string; items: string[] }[] = [
  {
    categoria: 'Partes comuns',
    icon: '🚪',
    items: [
      'Hall de entrada — limpeza e iluminação',
      'Caixas de correio — estado e fecho',
      'Escadas — estado dos degraus e corrimãos',
      'Corredores — limpeza e iluminação de emergência',
      'Cave / sala do lixo — limpeza',
      'Parque de estacionamento — iluminação e sinalética',
    ]
  },
  {
    categoria: 'Fachadas e Exterior',
    icon: '🏢',
    items: [
      'Fachada principal — fissuras, degradações',
      'Fachadas laterais e traseira',
      'Cobertura visível — telhas, caleiras',
      'Espaços verdes — manutenção, limpeza',
      'Portão / vedação — funcionamento',
      'Iluminação exterior',
    ]
  },
  {
    categoria: 'Equipamentos técnicos',
    icon: '⚙️',
    items: [
      'Elevador — certificado de inspeção afixado (DL 320/2002)',
      'Intercomunicador / videoporteiro — funcionamento',
      'Caldeira coletiva — indicadores e pressão',
      'Instalação de gás — data última inspeção (DL 97/2017)',
      'Contadores de água — legibilidade',
      'Quadro elétrico — estado e sinalética (RTIEBT)',
    ]
  },
  {
    categoria: 'Segurança contra incêndios',
    icon: '🔥',
    items: [
      'Extintores — presença, data de verificação (DL 220/2008)',
      'Detetores de fumo nas partes comuns',
      'Iluminação de emergência — blocos de socorro',
      'Plano de evacuação — afixação e legibilidade',
      'Saídas de emergência — desobstrução',
      'Colunas secas / montantes — tampões presentes',
    ]
  },
  {
    categoria: 'Acessibilidade PMR',
    icon: '♿',
    items: [
      'Rampa de acesso entrada — estado',
      'Elevador — dimensões e sinalética PMR',
      'Estacionamento PMR — marcação',
      'Pavimento exterior — anti-derrapante',
    ]
  },
  {
    categoria: 'Limpeza e Manutenção',
    icon: '🧹',
    items: [
      'Limpeza geral das partes comuns',
      'Ausência de objetos volumosos abandonados',
      'Estado das pinturas corredores / caixas de escada',
      'Limpeza de vidros da entrada',
    ]
  },
]

// ─── Config estados ──────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoItem, { label: string; icon: string; bg: string; text: string; dot: string }> = {
  bom:        { label: 'Bom estado',   icon: '✅', bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400'  },
  vigiar:     { label: 'A vigiar',     icon: '⚠️', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  deficiente: { label: 'Deficiente',   icon: '🔴', bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
  ausente:    { label: 'Ausente',      icon: '❌', bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
  na:         { label: 'N/A',          icon: '—',  bg: 'bg-gray-50',   text: 'text-gray-400',   dot: 'bg-gray-200'   },
}

const formatDate = (s: string) => { try { return new Date(s).toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) } catch { return s } }

// ─── Composant ────────────────────────────────────────────────────────────────

export default function VistoriaTecnicaSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_vistorias_pt_${user.id}`

  const [vistorias, setVistorias] = useState<Vistoria[]>([])
  const [vista, setVista] = useState<'lista' | 'nova' | 'detalhe'>('lista')
  const [selectedVistoria, setSelected] = useState<Vistoria | null>(null)
  const [filtroEstado, setFiltro] = useState<string>('all')

  const [formEdificio, setFormEdificio] = useState('')
  const [formMorada, setFormMorada] = useState('')
  const [formInspetor, setFormInspetor] = useState('')
  const [formData, setFormData] = useState(new Date().toISOString().split('T')[0])
  const [formObs, setFormObs] = useState('')
  const [items, setItems] = useState<ItemChecklist[]>([])

  useEffect(() => {
    try { setVistorias(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const save = (updated: Vistoria[]) => { setVistorias(updated); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) }

  const initChecklist = () => {
    const all: ItemChecklist[] = []
    CHECKLIST_REF.forEach(cat => {
      cat.items.forEach(desc => {
        all.push({ id: crypto.randomUUID(), categoria: cat.categoria, descricao: desc, estado: 'bom', notas: '' })
      })
    })
    setItems(all)
  }

  const openNova = () => { initChecklist(); setFormEdificio(''); setFormMorada(''); setFormInspetor(''); setFormData(new Date().toISOString().split('T')[0]); setFormObs(''); setVista('nova') }
  const updateItem = (id: string, field: keyof ItemChecklist, value: string) => { setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it)) }

  const scoreVistoria = (v: Vistoria) => {
    const ativos = v.items.filter(it => it.estado !== 'na')
    if (!ativos.length) return 100
    return Math.round((ativos.filter(it => it.estado === 'bom').length / ativos.length) * 100)
  }

  const scoreColor = (score: number) => score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'

  const handleSaveVistoria = (estado: EstadoVistoria = 'concluida') => {
    if (!formEdificio) return
    const now = new Date().toISOString()
    const nova: Vistoria = { id: crypto.randomUUID(), edificio: formEdificio, morada: formMorada, inspetor: formInspetor, dataVistoria: formData, estado, items: [...items], observacoes: formObs, createdAt: now, updatedAt: now }
    const updated = [nova, ...vistorias]
    save(updated); setSelected(nova); setVista('detalhe')
  }

  const filtered = useMemo(() => vistorias.filter(v => filtroEstado === 'all' || v.estado === filtroEstado), [vistorias, filtroEstado])
  const stats = useMemo(() => ({ total: vistorias.length, anomalias: vistorias.flatMap(v => v.items).filter(it => it.estado === 'deficiente' || it.estado === 'vigiar').length, criticas: vistorias.flatMap(v => v.items).filter(it => it.estado === 'deficiente').length }), [vistorias])

  // ─── Vista Lista ────────────────────────────────────────────────────────────

  if (vista === 'lista') return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Vistoria Técnica</h1>
          <p className="text-sm text-gray-500 mt-0.5">Checklist de terreno → Relatório PDF · DL 555/99 · DL 97/2017 · DL 320/2002</p>
        </div>
        <button onClick={openNova} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Nova vistoria</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Vistorias realizadas', value: stats.total, color: 'text-gray-900' },
          { label: 'Pontos a vigiar', value: stats.anomalias, color: stats.anomalias > 0 ? 'text-yellow-600' : 'text-gray-900' },
          { label: 'Pontos deficientes', value: stats.criticas, color: stats.criticas > 0 ? 'text-red-600 font-black' : 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {[{ key: 'all', label: 'Todas' }, { key: 'concluida', label: 'Concluídas' }, { key: 'em_curso', label: 'Em curso' }, { key: 'enviada', label: 'Enviadas' }].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} className={`text-xs px-4 py-1.5 rounded-full font-medium transition-colors ${filtroEstado === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma vistoria registada</h3>
          <p className="text-gray-400 text-sm mb-6">Comece a sua primeira vistoria técnica.</p>
          <button onClick={openNova} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Nova vistoria</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => {
            const score = scoreVistoria(v)
            const deficientes = v.items.filter(it => it.estado === 'deficiente')
            const vigiar = v.items.filter(it => it.estado === 'vigiar')
            return (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelected(v); setVista('detalhe') }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{v.edificio}</h3>
                    {v.morada && <p className="text-xs text-gray-400 truncate">{v.morada}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(v.dataVistoria)}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className={`text-2xl font-bold ${scoreColor(score)}`}>{score}%</p>
                    <p className="text-xs text-gray-400">conformidade</p>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div className={`h-1.5 rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
                </div>
                <div className="flex gap-2 text-xs mb-3">
                  {deficientes.length > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">🔴 {deficientes.length} deficiente{deficientes.length > 1 ? 's' : ''}</span>}
                  {vigiar.length > 0 && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">⚠️ {vigiar.length} a vigiar</span>}
                  {deficientes.length === 0 && vigiar.length === 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Sem anomalias</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>👷 {v.inspetor || 'Inspetor não indicado'}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${v.estado === 'enviada' ? 'bg-blue-100 text-blue-700' : v.estado === 'concluida' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {v.estado === 'enviada' ? '📤 Enviada' : v.estado === 'concluida' ? '✅ Concluída' : '⏳ Em curso'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ─── Vista Nova vistoria ────────────────────────────────────────────────────

  if (vista === 'nova') return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setVista('lista')} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">← Voltar</button>
        <h1 className="text-2xl font-bold text-gray-900">📋 Nova vistoria técnica</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-gray-700 mb-3">📍 Informações</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Edifício *</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome do edifício" value={formEdificio} onChange={e => setFormEdificio(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Morada</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={formMorada} onChange={e => setFormMorada(e.target.value)} /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Data</label><input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData} onChange={e => setFormData(e.target.value)} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Inspetor</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="João Silva — Gestor Técnico" value={formInspetor} onChange={e => setFormInspetor(e.target.value)} /></div>
        </div>
      </div>

      {CHECKLIST_REF.map(cat => {
        const catItems = items.filter(it => it.categoria === cat.categoria)
        const deficientes = catItems.filter(it => it.estado === 'deficiente').length
        const vigiar = catItems.filter(it => it.estado === 'vigiar').length
        return (
          <div key={cat.categoria} className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">{cat.icon}</span>
              <h3 className="font-bold text-gray-900">{cat.categoria}</h3>
              {deficientes > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium ml-auto">{deficientes} deficiente{deficientes > 1 ? 's' : ''}</span>}
              {vigiar > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium ml-auto">{vigiar} a vigiar</span>}
            </div>
            <div className="space-y-3">
              {catItems.map(item => (
                <div key={item.id} className={`border rounded-xl p-3 transition-colors ${ESTADO_CFG[item.estado].bg}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{ESTADO_CFG[item.estado].icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium mb-2 ${ESTADO_CFG[item.estado].text}`}>{item.descricao}</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(Object.keys(ESTADO_CFG) as EstadoItem[]).map(e => (
                          <button key={e} onClick={() => updateItem(item.id, 'estado', e)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${item.estado === e ? ESTADO_CFG[e].bg + ' ' + ESTADO_CFG[e].text + ' ring-1 ring-current font-bold' : 'bg-white/70 text-gray-500 hover:bg-white'}`}>
                            {ESTADO_CFG[e].icon} {ESTADO_CFG[e].label}
                          </button>
                        ))}
                      </div>
                      {(item.estado === 'deficiente' || item.estado === 'vigiar') && (
                        <input className="w-full border border-white/60 rounded-lg px-2 py-1 text-xs bg-white/60 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Observação, localização precisa..." value={item.notas} onChange={e => updateItem(item.id, 'notas', e.target.value)} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">💬 Observações gerais</label>
        <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} placeholder="Comentários globais, pontos de atenção, obras urgentes..." value={formObs} onChange={e => setFormObs(e.target.value)} />
      </div>

      <div className="flex gap-3 sticky bottom-4">
        <button onClick={() => handleSaveVistoria('concluida')} disabled={!formEdificio} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg">✅ Concluir e gerar relatório</button>
        <button onClick={() => handleSaveVistoria('em_curso')} disabled={!formEdificio} className="px-5 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-sm">💾 Guardar</button>
        <button onClick={() => setVista('lista')} className="px-5 py-3 bg-white border border-gray-200 text-gray-400 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
      </div>
    </div>
  )

  // ─── Vista Detalhe / Relatório ──────────────────────────────────────────────

  if (vista === 'detalhe' && selectedVistoria) {
    const score = scoreVistoria(selectedVistoria)
    const anomalias = selectedVistoria.items.filter(it => it.estado === 'deficiente' || it.estado === 'vigiar')

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <button onClick={() => setVista('lista')} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">← Voltar à lista</button>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">🖨️ Imprimir / PDF</button>
            <button onClick={() => { save(vistorias.map(v => v.id === selectedVistoria.id ? { ...v, estado: 'enviada' as EstadoVistoria } : v)); setSelected({ ...selectedVistoria, estado: 'enviada' }) }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">📤 Marcar como enviada</button>
            <button onClick={() => { if (confirm('Eliminar esta vistoria?')) { save(vistorias.filter(v => v.id !== selectedVistoria.id)); setVista('lista') } }} className="p-2 text-gray-300 hover:text-red-500 transition-colors">🗑️</button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-900 text-white px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Relatório de Vistoria Técnica</p>
                <h1 className="text-2xl font-black">{selectedVistoria.edificio}</h1>
                {selectedVistoria.morada && <p className="text-gray-300 mt-0.5">{selectedVistoria.morada}</p>}
              </div>
              <div className="text-right">
                <p className={`text-5xl font-black ${score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{score}%</p>
                <p className="text-gray-400 text-xs">Taxa de conformidade</p>
              </div>
            </div>
            <div className="mt-4 flex gap-6 text-sm">
              <span>📅 {formatDate(selectedVistoria.dataVistoria)}</span>
              {selectedVistoria.inspetor && <span>👷 {selectedVistoria.inspetor}</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedVistoria.estado === 'enviada' ? 'bg-blue-600' : 'bg-green-600'}`}>
                {selectedVistoria.estado === 'enviada' ? '📤 Enviada' : '✅ Concluída'}
              </span>
            </div>
          </div>

          {anomalias.length > 0 && (
            <div className="px-8 py-5 border-b border-gray-100 bg-red-50">
              <h2 className="font-bold text-gray-900 mb-3">⚠️ Pontos de atenção ({anomalias.length})</h2>
              <div className="space-y-1.5">
                {anomalias.map(item => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className="flex-shrink-0">{ESTADO_CFG[item.estado].icon}</span>
                    <div>
                      <span className={`text-sm font-medium ${ESTADO_CFG[item.estado].text}`}>[{item.categoria}] {item.descricao}</span>
                      {item.notas && <span className="text-xs text-gray-500"> — {item.notas}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-8 py-5">
            {CHECKLIST_REF.map(cat => {
              const catItems = selectedVistoria.items.filter(it => it.categoria === cat.categoria)
              return (
                <div key={cat.categoria} className="mb-6">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3"><span>{cat.icon}</span> {cat.categoria}</h3>
                  <div className="grid grid-cols-1 gap-1.5">
                    {catItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50">
                        <span className="flex-shrink-0">{ESTADO_CFG[item.estado].icon}</span>
                        <span className="flex-1 text-sm text-gray-700">{item.descricao}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_CFG[item.estado].bg} ${ESTADO_CFG[item.estado].text}`}>{ESTADO_CFG[item.estado].label}</span>
                        {item.notas && <span className="text-xs text-gray-400 truncate max-w-32">{item.notas}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {selectedVistoria.observacoes && (
              <div className="bg-gray-50 rounded-xl p-4 mt-4">
                <h3 className="font-bold text-gray-900 mb-2">💬 Observações gerais</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedVistoria.observacoes}</p>
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
              <span>Relatório gerado por VITFIX — {new Date().toLocaleDateString('pt-PT')}</span>
              <span>Confidencial — Uso interno</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
