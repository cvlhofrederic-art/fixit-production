'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ObraPlaneada {
  id: string
  ano: number
  categoria: string
  descricao: string
  custoEstimado: number
  estado: 'previsto' | 'em_curso' | 'realizado' | 'adiado'
  notas?: string
}

interface PlanoConservacao {
  id: string
  edificioNom: string
  edificioMorada: string
  nbFracoes: number
  anoConstrucao: number
  estadoGlobal: 'preparacao' | 'submetido_ag' | 'aprovado' | 'em_execucao' | 'arquivado'
  dataAprovacaoAG?: string
  obras: ObraPlaneada[]
  notas?: string
  createdAt: string
  updatedAt: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ANO_ATUAL = new Date().getFullYear()

const CATEGORIAS = [
  { key: 'estrutura',        label: 'Estrutura / Obra grossa',         icon: '🏗️' },
  { key: 'fachada',          label: 'Fachadas / Revestimentos',        icon: '🧱' },
  { key: 'cobertura',        label: 'Cobertura / Impermeabilização',   icon: '🏠' },
  { key: 'partes_comuns',    label: 'Partes comuns',                   icon: '🚪' },
  { key: 'equipamentos',     label: 'Equipamentos técnicos',           icon: '⚙️' },
  { key: 'acessibilidade',   label: 'Acessibilidade PMR',              icon: '♿' },
  { key: 'seguranca',        label: 'Segurança / Incêndio',           icon: '🔥' },
  { key: 'energia',          label: 'Eficiência energética',           icon: '⚡' },
  { key: 'canalizacoes',     label: 'Canalizações / Redes',           icon: '🔧' },
  { key: 'outras',           label: 'Outras obras',                    icon: '📋' },
]

const ESTADOS_GLOBAL = {
  preparacao:   { label: 'Em preparação',       dot: 'bg-yellow-400',  badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  submetido_ag: { label: 'Submetido em AG',     dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  aprovado:     { label: 'Aprovado em AG',      dot: 'bg-green-400',   badge: 'bg-green-50 text-green-700 border-green-200' },
  em_execucao:  { label: 'Em execução',         dot: 'bg-purple-400',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  arquivado:    { label: 'Arquivado',           dot: 'bg-gray-400',    badge: 'bg-gray-50 text-gray-500 border-gray-200' },
}

const ESTADOS_OBRA = {
  previsto:  { label: 'Previsto',   color: 'bg-blue-50 text-blue-600' },
  em_curso:  { label: 'Em curso',   color: 'bg-orange-50 text-orange-600' },
  realizado: { label: 'Realizado',  color: 'bg-green-50 text-green-600' },
  adiado:    { label: 'Adiado',     color: 'bg-gray-50 text-gray-500' },
}

const formatEur = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const orcamentoTotal = (plano: PlanoConservacao) => plano.obras.reduce((s, o) => s + o.custoEstimado, 0)
const avanco = (plano: PlanoConservacao) => {
  if (!plano.obras.length) return 0
  return Math.round((plano.obras.filter(o => o.estado === 'realizado').length / plano.obras.length) * 100)
}

function getObrigacao(nbFracoes: number, anoConstrucao: number) {
  const idade = ANO_ATUAL - anoConstrucao
  if (idade < 8) return { obrigatorio: false, razao: `Edifício com menos de 8 anos (${idade} anos) — conservação não exigida ainda` }
  return { obrigatorio: true, razao: `Conservação obrigatória a cada 8 anos — DL 555/99 art. 89.º (${idade} anos de idade)` }
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function PlanoManutencaoSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_plano_manutencao_${user.id}`

  const [planos, setPlanos] = useState<PlanoConservacao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PlanoConservacao | null>(null)
  const [selectedPlano, setSelectedPlano] = useState<PlanoConservacao | null>(null)
  const [form, setForm] = useState<Partial<PlanoConservacao>>({})
  const [obras, setObras] = useState<ObraPlaneada[]>([])
  const [showAddObra, setShowAddObra] = useState(false)
  const [obraForm, setObraForm] = useState<Partial<ObraPlaneada>>({ ano: ANO_ATUAL, estado: 'previsto' })

  useEffect(() => {
    try { setPlanos(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const savePlanos = (updated: PlanoConservacao[]) => { setPlanos(updated); localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) }

  const openCreate = () => { setEditing(null); setForm({ estadoGlobal: 'preparacao', nbFracoes: 20, anoConstrucao: 1990 }); setObras([]); setShowAddObra(false); setShowModal(true) }
  const openEdit = (p: PlanoConservacao) => { setEditing(p); setForm({ ...p }); setObras([...p.obras]); setShowAddObra(false); setShowModal(true) }

  const handleSave = () => {
    if (!form.edificioNom?.trim()) return
    const now = new Date().toISOString()
    if (editing) {
      savePlanos(planos.map(p => p.id === editing.id ? { ...editing, ...form, obras, updatedAt: now } as PlanoConservacao : p))
    } else {
      savePlanos([...planos, { id: crypto.randomUUID(), edificioNom: form.edificioNom!, edificioMorada: form.edificioMorada || '', nbFracoes: form.nbFracoes || 1, anoConstrucao: form.anoConstrucao || 2000, estadoGlobal: form.estadoGlobal || 'preparacao', dataAprovacaoAG: form.dataAprovacaoAG, notas: form.notas, obras, createdAt: now, updatedAt: now } as PlanoConservacao])
    }
    setShowModal(false); setEditing(null)
  }

  const handleAddObra = () => {
    if (!obraForm.descricao?.trim() || !obraForm.ano) return
    setObras(prev => [...prev, { id: crypto.randomUUID(), ano: obraForm.ano!, categoria: obraForm.categoria || 'outras', descricao: obraForm.descricao!, custoEstimado: obraForm.custoEstimado || 0, estado: obraForm.estado || 'previsto', notas: obraForm.notas } as ObraPlaneada])
    setObraForm({ ano: ANO_ATUAL, estado: 'previsto' }); setShowAddObra(false)
  }

  const totalOrcamento = planos.reduce((s, p) => s + orcamentoTotal(p), 0)
  const countAprovados = planos.filter(p => p.estadoGlobal === 'aprovado' || p.estadoGlobal === 'em_execucao').length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏗️ Plano de Manutenção</h1>
          <p className="text-sm text-gray-500 mt-0.5">Conservação obrigatória 8 anos — DL 555/99 art. 89.º</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Novo plano</button>
      </div>

      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <span className="text-xl">⚖️</span>
        <div>
          <p className="font-semibold text-amber-800 text-sm">Obrigação Legal — DL 555/99 art. 89.º</p>
          <p className="text-amber-700 text-sm mt-0.5">
            Os edifícios devem ser objeto de obras de conservação pelo menos uma vez em cada período de 8 anos.
            A câmara municipal pode determinar a execução de obras de conservação necessárias.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Planos criados', value: planos.length, color: 'text-gray-900' },
          { label: 'Aprovados em AG', value: countAprovados, color: 'text-green-600' },
          { label: 'Em preparação', value: planos.filter(p => p.estadoGlobal === 'preparacao' || p.estadoGlobal === 'submetido_ag').length, color: 'text-yellow-600' },
          { label: 'Orçamento total', value: totalOrcamento > 0 ? formatEur(totalOrcamento) : '—', color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {planos.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">🏗️</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum plano de manutenção</h3>
          <p className="text-gray-400 text-sm mb-6">Comece por criar o plano de conservação<br />para os seus edifícios.</p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Criar plano</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {planos.map(plano => {
            const obrig = getObrigacao(plano.nbFracoes, plano.anoConstrucao)
            const avc = avanco(plano)
            const budget = orcamentoTotal(plano)
            const estado = ESTADOS_GLOBAL[plano.estadoGlobal]
            return (
              <div key={plano.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{plano.edificioNom}</h3>
                    {plano.edificioMorada && <p className="text-xs text-gray-400 truncate">{plano.edificioMorada}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{plano.nbFracoes} frações · Construído em {plano.anoConstrucao}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 ml-2 flex-shrink-0 ${estado.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${estado.dot}`} />{estado.label}
                  </span>
                </div>
                <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${obrig.obrigatorio ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                  {obrig.obrigatorio ? '⚖️' : '✅'} {obrig.razao}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Orçamento total</span>
                  <span className="font-bold text-gray-900">{budget > 0 ? formatEur(budget) : '—'}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Avanço ({plano.obras.filter(o => o.estado === 'realizado').length}/{plano.obras.length} obras)</span>
                    <span className="text-xs font-semibold text-gray-700">{avc}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${avc}%` }} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button onClick={() => setSelectedPlano(plano)} className="flex-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors">👁️ Ver plano</button>
                  <button onClick={() => openEdit(plano)} className="text-xs bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-100 transition-colors">✏️</button>
                  <button onClick={() => { if (confirm('Eliminar este plano?')) savePlanos(planos.filter(p => p.id !== plano.id)) }} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors">🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal détail */}
      {selectedPlano && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setSelectedPlano(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPlano.edificioNom}</h2>
                <p className="text-sm text-gray-500">Plano de manutenção · {selectedPlano.obras.length} obras · {formatEur(orcamentoTotal(selectedPlano))}</p>
              </div>
              <button onClick={() => setSelectedPlano(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6">
              {Array.from({ length: 10 }, (_, i) => ANO_ATUAL + i).map(ano => {
                const anoObras = selectedPlano.obras.filter(o => o.ano === ano)
                if (!anoObras.length) return null
                const anoOrc = anoObras.reduce((s, o) => s + o.custoEstimado, 0)
                return (
                  <div key={ano} className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold text-sm px-3 py-0.5 rounded-full ${ano === ANO_ATUAL ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{ano}</span>
                      <span className="font-bold text-gray-900">{formatEur(anoOrc)}</span>
                    </div>
                    <div className="space-y-2">
                      {anoObras.map(o => {
                        const cat = CATEGORIAS.find(c => c.key === o.categoria)
                        return (
                          <div key={o.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                            <span className="text-xl">{cat?.icon || '🔧'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{o.descricao}</p>
                              <p className="text-xs text-gray-400">{cat?.label}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADOS_OBRA[o.estado].color}`}>{ESTADOS_OBRA[o.estado].label}</span>
                            <span className="font-bold text-gray-900 text-sm flex-shrink-0">{formatEur(o.custoEstimado)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {selectedPlano.obras.length === 0 && <div className="text-center py-12 text-gray-400">Nenhuma obra planeada neste plano.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Modal création */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">{editing ? '✏️ Modificar plano' : '+ Novo Plano de Manutenção'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📍 Edifício</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Nome do edifício *</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Edifício Sol Nascente" value={form.edificioNom || ''} onChange={e => setForm({ ...form, edificioNom: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Morada</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Rua das Flores, 12, 1000-001 Lisboa" value={form.edificioMorada || ''} onChange={e => setForm({ ...form, edificioMorada: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Número de frações</label>
                    <input type="number" min={1} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.nbFracoes || ''} onChange={e => setForm({ ...form, nbFracoes: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Ano de construção</label>
                    <input type="number" min={1800} max={ANO_ATUAL} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.anoConstrucao || ''} onChange={e => setForm({ ...form, anoConstrucao: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                {!!form.nbFracoes && !!form.anoConstrucao && (() => {
                  const obrig = getObrigacao(form.nbFracoes!, form.anoConstrucao!)
                  return <div className={`mt-2 text-xs px-3 py-2 rounded-xl ${obrig.obrigatorio ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>{obrig.obrigatorio ? '⚖️' : '✅'} {obrig.razao}</div>
                })()}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Estado do plano</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Estado</label>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.estadoGlobal || 'preparacao'} onChange={e => setForm({ ...form, estadoGlobal: e.target.value as PlanoConservacao['estadoGlobal'] })}>
                      {Object.entries(ESTADOS_GLOBAL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Data aprovação AG</label>
                    <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dataAprovacaoAG || ''} onChange={e => setForm({ ...form, dataAprovacaoAG: e.target.value })} />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">🔨 Obras planeadas ({obras.length})</h3>
                  <button onClick={() => setShowAddObra(v => !v)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors">{showAddObra ? 'Cancelar' : '+ Adicionar'}</button>
                </div>
                {showAddObra && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Ano</label>
                        <input type="number" min={ANO_ATUAL - 5} max={ANO_ATUAL + 15} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={obraForm.ano || ANO_ATUAL} onChange={e => setObraForm({ ...obraForm, ano: parseInt(e.target.value) || ANO_ATUAL })} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
                        <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={obraForm.categoria || ''} onChange={e => setObraForm({ ...obraForm, categoria: e.target.value })}>
                          <option value="">Escolher...</option>
                          {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Descrição *</label>
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Ex: Reparação completa da cobertura..." value={obraForm.descricao || ''} onChange={e => setObraForm({ ...obraForm, descricao: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Custo estimado (€)</label>
                        <input type="number" min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={obraForm.custoEstimado || ''} onChange={e => setObraForm({ ...obraForm, custoEstimado: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Estado</label>
                        <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" value={obraForm.estado || 'previsto'} onChange={e => setObraForm({ ...obraForm, estado: e.target.value as ObraPlaneada['estado'] })}>
                          {Object.entries(ESTADOS_OBRA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={handleAddObra} disabled={!obraForm.descricao?.trim()} className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">Adicionar obra</button>
                  </div>
                )}
                {obras.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-200 rounded-xl">Nenhuma obra planeada — clique em &quot;+ Adicionar&quot;</div>
                ) : (
                  <div className="space-y-2">
                    {obras.sort((a, b) => a.ano - b.ano).map(o => {
                      const cat = CATEGORIAS.find(c => c.key === o.categoria)
                      return (
                        <div key={o.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                          <span>{cat?.icon || '🔧'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{o.descricao}</p>
                            <p className="text-xs text-gray-400">{o.ano} · {cat?.label}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADOS_OBRA[o.estado].color}`}>{ESTADOS_OBRA[o.estado].label}</span>
                          <span className="text-sm font-bold text-gray-900 flex-shrink-0">{formatEur(o.custoEstimado)}</span>
                          <button onClick={() => setObras(prev => prev.filter(x => x.id !== o.id))} className="text-gray-300 hover:text-red-400 transition-colors ml-1">✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <div className="flex gap-3 pt-1">
                <button onClick={handleSave} disabled={!form.edificioNom?.trim()} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">{editing ? '💾 Guardar alterações' : '✅ Criar plano'}</button>
                <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
