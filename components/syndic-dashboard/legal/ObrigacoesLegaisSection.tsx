'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoObrigacao = 'conservacao' | 'gas' | 'elevador' | 'eletrica' | 'seguro' | 'assembleia' | 'energia' | 'incendio' | 'outra'
type EstadoObrigacao = 'expirado' | 'urgente' | 'proximo' | 'ok'

interface Obrigacao {
  id: string
  edificio: string
  tipo: TipoObrigacao
  descricao: string
  dataLimite: string
  periodicidade: number // anos
  notas?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoObrigacao, { label: string; emoji: string; color: string; lei: string }> = {
  conservacao:  { label: 'Conservação obrigatória',     emoji: '🏗️', color: 'bg-blue-50 text-blue-700 border-blue-200',     lei: 'DL 555/99 art. 89.º — 8 anos' },
  gas:          { label: 'Inspeção de gás',             emoji: '🔥', color: 'bg-orange-50 text-orange-700 border-orange-200', lei: 'DL 97/2017 — 5 anos' },
  elevador:     { label: 'Inspeção de elevadores',      emoji: '🛗', color: 'bg-purple-50 text-purple-700 border-purple-200', lei: 'DL 320/2002 — 2 a 6 anos' },
  eletrica:     { label: 'Inspeção elétrica',           emoji: '⚡', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', lei: 'RTIEBT — 10 anos' },
  seguro:       { label: 'Seguro do edifício',          emoji: '🛡️', color: 'bg-green-50 text-green-700 border-green-200',   lei: 'DL 267/94 — anual' },
  assembleia:   { label: 'Assembleia geral anual',      emoji: '🏛️', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', lei: 'CC art. 1431.º — anual' },
  energia:      { label: 'Certificado energético',      emoji: '🌱', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', lei: 'DL 101-D/2020 — 10 anos' },
  incendio:     { label: 'Segurança contra incêndios',  emoji: '🧯', color: 'bg-red-50 text-red-700 border-red-200',         lei: 'DL 220/2008 — anual' },
  outra:        { label: 'Outra obrigação',             emoji: '📋', color: 'bg-gray-50 text-gray-700 border-gray-200',       lei: '—' },
}

const ESTADO_CONFIG: Record<EstadoObrigacao, { label: string; dot: string; color: string }> = {
  expirado: { label: 'Expirado',   dot: 'bg-red-500',    color: 'bg-red-50 border-red-200' },
  urgente:  { label: 'Urgente',    dot: 'bg-orange-400', color: 'bg-orange-50 border-orange-200' },
  proximo:  { label: 'Próximo',    dot: 'bg-yellow-400', color: 'bg-yellow-50 border-yellow-200' },
  ok:       { label: 'Em dia',     dot: 'bg-green-400',  color: 'bg-green-50 border-green-200' },
}

function getEstado(dataLimite: string): EstadoObrigacao {
  const dias = Math.ceil((new Date(dataLimite).getTime() - Date.now()) / 86400000)
  if (dias < 0) return 'expirado'
  if (dias <= 30) return 'urgente'
  if (dias <= 180) return 'proximo'
  return 'ok'
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ObrigacoesLegaisSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_obrigacoes_${user.id}`

  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([])
  const [filtroEdificio, setFiltroEdificio] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<Obrigacao>>({ tipo: 'outra', periodicidade: 1 })

  useEffect(() => {
    try { setObrigacoes(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const save = (updated: Obrigacao[]) => {
    setObrigacoes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const filtered = obrigacoes.filter(o => {
    const matchEdif = !filtroEdificio || o.edificio === filtroEdificio
    const estado = getEstado(o.dataLimite)
    const matchEstado = !filtroEstado || estado === filtroEstado
    return matchEdif && matchEstado
  }).sort((a, b) => new Date(a.dataLimite).getTime() - new Date(b.dataLimite).getTime())

  const edificios = [...new Set(obrigacoes.map(o => o.edificio))].filter(Boolean)

  const stats = {
    expirado: obrigacoes.filter(o => getEstado(o.dataLimite) === 'expirado').length,
    urgente:  obrigacoes.filter(o => getEstado(o.dataLimite) === 'urgente').length,
    proximo:  obrigacoes.filter(o => getEstado(o.dataLimite) === 'proximo').length,
    ok:       obrigacoes.filter(o => getEstado(o.dataLimite) === 'ok').length,
  }

  const handleAdd = () => {
    if (!form.descricao || !form.edificio || !form.dataLimite) return
    save([...obrigacoes, { ...form, id: Date.now().toString() } as Obrigacao])
    setShowModal(false)
    setForm({ tipo: 'outra', periodicidade: 1 })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚖️ Obrigações Legais</h1>
          <p className="text-sm text-gray-500 mt-0.5">Calendário de obrigações · Prazos legais · Lei 8/2022 · DL 555/99</p>
        </div>
        <div className="flex gap-2">
          <select value={filtroEdificio} onChange={e => setFiltroEdificio(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            <option value="">Todos os edifícios</option>
            {edificios.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:border-[#C9A84C] focus:outline-none">
            <option value="">Todos os estados</option>
            <option value="expirado">🔴 Expirado</option>
            <option value="urgente">🟠 Urgente</option>
            <option value="proximo">🟡 Próximo</option>
            <option value="ok">🟢 Em dia</option>
          </select>
          <button onClick={() => setShowModal(true)} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition">+ Adicionar</button>
        </div>
      </div>

      {/* Alerta legal */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <span className="text-xl">⚖️</span>
        <div>
          <p className="font-semibold text-amber-800 text-sm">Enquadramento Legal Português</p>
          <p className="text-amber-700 text-sm mt-0.5">
            Conservação obrigatória a cada 8 anos (DL 555/99) · Inspeção de gás a cada 5 anos (DL 97/2017) ·
            Elevadores a cada 2-6 anos (DL 320/2002) · Assembleia anual obrigatória (CC art. 1431.º) · Lei 8/2022
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {([['expirado', '🔴', 'Expirados'], ['urgente', '🟠', 'Urgentes'], ['proximo', '🟡', 'Próximos'], ['ok', '🟢', 'Em dia']] as [EstadoObrigacao, string, string][]).map(([key, emoji, label]) => (
          <button key={key} onClick={() => setFiltroEstado(filtroEstado === key ? '' : key)}
            className={`rounded-xl border-2 p-3 text-left transition hover:shadow-sm ${ESTADO_CONFIG[key].color} ${filtroEstado === key ? 'ring-2 ring-[#C9A84C]' : ''}`}>
            <div className="text-xl mb-0.5">{emoji}</div>
            <div className="text-xl font-bold">{stats[key]}</div>
            <div className="text-xs">{label}</div>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#F7F4EE] text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-3">Edifício</div>
          <div className="col-span-3">Tipo</div>
          <div className="col-span-2">Descrição</div>
          <div className="col-span-2">Prazo</div>
          <div className="col-span-1">Estado</div>
          <div className="col-span-1"></div>
        </div>
        {filtered.map(o => {
          const estado = getEstado(o.dataLimite)
          const eCfg = ESTADO_CONFIG[estado]
          const tCfg = TIPO_CONFIG[o.tipo]
          const diasRestantes = Math.ceil((new Date(o.dataLimite).getTime() - Date.now()) / 86400000)
          return (
            <div key={o.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50 hover:bg-[#F7F4EE] group items-center ${estado === 'expirado' ? 'bg-red-50/40' : estado === 'urgente' ? 'bg-orange-50/30' : ''}`}>
              <div className="col-span-3 text-sm font-medium text-gray-800 truncate">{o.edificio}</div>
              <div className="col-span-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full border ${tCfg.color}`}>{tCfg.emoji} {tCfg.label}</span></div>
              <div className="col-span-2 text-sm text-gray-600 truncate">{o.descricao}</div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-[#0D1B2E]">{new Date(o.dataLimite).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                <p className="text-xs text-gray-500">{diasRestantes < 0 ? `Há ${Math.abs(diasRestantes)} dias` : `Em ${diasRestantes} dias`}</p>
              </div>
              <div className="col-span-1 flex justify-center">
                <div className={`w-2.5 h-2.5 rounded-full ${eCfg.dot}`} title={eCfg.label} />
              </div>
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={() => { if (window.confirm('Eliminar esta obrigação?')) save(obrigacoes.filter(x => x.id !== o.id)) }}
                  className="opacity-0 group-hover:opacity-100 transition text-gray-500 hover:text-red-500 text-sm p-1 rounded"
                >🗑️</button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-500 text-sm">
            Nenhuma obrigação registada. Clique em &quot;+ Adicionar&quot; para começar.
          </div>
        )}
      </div>

      {/* Referências legais */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 mb-3">📚 Referências Legais Portuguesas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(TIPO_CONFIG).filter(([k]) => k !== 'outra').map(([key, cfg]) => (
            <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${cfg.color}`}>
              <span className="text-lg">{cfg.emoji}</span>
              <div>
                <p className="text-sm font-semibold">{cfg.label}</p>
                <p className="text-xs opacity-75">{cfg.lei}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0D1B2E] mb-4">Adicionar Obrigação Legal</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Edifício *</label>
                <input type="text" value={form.edificio || ''} onChange={e => setForm({ ...form, edificio: e.target.value })} placeholder="Nome do edifício" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de obrigação</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoObrigacao })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none bg-white text-sm">
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
                <input type="text" value={form.descricao || ''} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Inspeção gás — bloco A" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Data limite *</label>
                  <input type="date" value={form.dataLimite || ''} onChange={e => setForm({ ...form, dataLimite: e.target.value })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Periodicidade (anos)</label>
                  <input type="number" min={1} value={form.periodicidade || 1} onChange={e => setForm({ ...form, periodicidade: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">Cancelar</button>
              <button onClick={handleAdd} disabled={!form.descricao || !form.edificio || !form.dataLimite} className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
