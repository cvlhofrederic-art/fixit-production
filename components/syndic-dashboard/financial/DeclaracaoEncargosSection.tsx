'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoDeclaracao = 'pendente' | 'emitida' | 'entregue' | 'venda_concluida'

interface EncargosDeclaracao {
  id: string
  edificioNom: string
  fracaoId: string                  // Ex: "Fração A - 2.º Dto"
  condominoNom: string              // Vendedor
  condominoNIF: string
  compradorNom?: string
  compradorNIF?: string
  compradorEmail?: string
  dataPedido: string
  dataEmissao?: string
  dataEntrega?: string
  dataEscritura?: string
  prazoLegal: string                // dataPedido + 10 dias úteis
  estado: EstadoDeclaracao
  // Dados financeiros
  quotasEmDivida: number
  quotasExtraordinarias: number
  fundoReservaDevido: number
  penalizacoes: number
  totalEncargos: number
  observacoes?: string
  // Notificação novo proprietário
  novoProprietarioNotificado: boolean
  dataNotificacao?: string
  createdAt: string
  updatedAt: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADOS: Record<EstadoDeclaracao, { label: string; icon: string; badge: string; dot: string }> = {
  pendente:         { label: 'Pendente',          icon: '⏳', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
  emitida:          { label: 'Emitida',           icon: '📄', badge: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400'   },
  entregue:         { label: 'Entregue',          icon: '✅', badge: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-400'  },
  venda_concluida:  { label: 'Venda concluída',   icon: '🏠', badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

// Calcular 10 dias úteis a partir de uma data
const add10DiasUteis = (dateStr: string): string => {
  const d = new Date(dateStr)
  let count = 0
  while (count < 10) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return d.toISOString().split('T')[0]
}

const diasRestantes = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DeclaracaoEncargosSection({ user, userRole }: { user: { id: string }; userRole: string }) {
  const STORAGE_KEY = `fixit_declaracoes_${user.id}`

  const [declaracoes, setDeclaracoes] = useState<EncargosDeclaracao[]>([])
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<EncargosDeclaracao | null>(null)
  const [selected, setSelected]       = useState<EncargosDeclaracao | null>(null)
  const [form, setForm]               = useState<Partial<EncargosDeclaracao>>({})
  const [filterEstado, setFilterEstado] = useState<string>('all')
  const printRef                      = useRef<HTMLDivElement>(null)

  // ── Persistência ─────────────────────────────────────────────────────────────

  useEffect(() => {
    try { setDeclaracoes(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }, [])

  const save = (updated: EncargosDeclaracao[]) => {
    setDeclaracoes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setForm({ dataPedido: new Date().toISOString().split('T')[0], quotasEmDivida: 0, quotasExtraordinarias: 0, fundoReservaDevido: 0, penalizacoes: 0 })
    setShowModal(true)
  }

  const openEdit = (d: EncargosDeclaracao) => {
    setEditing(d)
    setForm({ ...d })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.edificioNom || !form.fracaoId || !form.condominoNom || !form.dataPedido) return
    const now = new Date().toISOString()
    const totalEncargos = (form.quotasEmDivida || 0) + (form.quotasExtraordinarias || 0) + (form.fundoReservaDevido || 0) + (form.penalizacoes || 0)
    const prazoLegal = add10DiasUteis(form.dataPedido!)

    if (editing) {
      save(declaracoes.map(d => d.id === editing.id ? { ...editing, ...form, totalEncargos, prazoLegal, updatedAt: now } as EncargosDeclaracao : d))
    } else {
      const nova: EncargosDeclaracao = {
        id: crypto.randomUUID(),
        edificioNom: form.edificioNom!,
        fracaoId: form.fracaoId!,
        condominoNom: form.condominoNom!,
        condominoNIF: form.condominoNIF || '',
        compradorNom: form.compradorNom,
        compradorNIF: form.compradorNIF,
        compradorEmail: form.compradorEmail,
        dataPedido: form.dataPedido!,
        prazoLegal,
        estado: 'pendente',
        quotasEmDivida: form.quotasEmDivida || 0,
        quotasExtraordinarias: form.quotasExtraordinarias || 0,
        fundoReservaDevido: form.fundoReservaDevido || 0,
        penalizacoes: form.penalizacoes || 0,
        totalEncargos,
        observacoes: form.observacoes,
        novoProprietarioNotificado: false,
        createdAt: now,
        updatedAt: now,
      }
      save([nova, ...declaracoes])
    }
    setShowModal(false)
    setEditing(null)
  }

  const updateEstado = (decl: EncargosDeclaracao, novoEstado: EstadoDeclaracao) => {
    const now = new Date().toISOString()
    const updated = {
      ...decl,
      estado: novoEstado,
      updatedAt: now,
      ...(novoEstado === 'emitida' && !decl.dataEmissao ? { dataEmissao: now.split('T')[0] } : {}),
      ...(novoEstado === 'entregue' && !decl.dataEntrega ? { dataEntrega: now.split('T')[0] } : {}),
      ...(novoEstado === 'venda_concluida' && !decl.dataEscritura ? { dataEscritura: now.split('T')[0] } : {}),
    }
    save(declaracoes.map(d => d.id === decl.id ? updated : d))
    if (selected?.id === decl.id) setSelected(updated)
  }

  const marcarNotificado = (decl: EncargosDeclaracao) => {
    const now = new Date().toISOString()
    const updated = { ...decl, novoProprietarioNotificado: true, dataNotificacao: now.split('T')[0], updatedAt: now }
    save(declaracoes.map(d => d.id === decl.id ? updated : d))
    if (selected?.id === decl.id) setSelected(updated)
  }

  // ── Filtres ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => declaracoes.filter(d =>
    filterEstado === 'all' ? true : d.estado === filterEstado
  ), [declaracoes, filterEstado])

  const pendentes = declaracoes.filter(d => d.estado === 'pendente')
  const emAtraso  = pendentes.filter(d => diasRestantes(d.prazoLegal) < 0)

  // ─── Renderização ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Declaração de Encargos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Obrigação legal — Lei n.º 8/2022 de 10 de janeiro · Transmissão de frações</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          + Nova declaração
        </button>
      </div>

      {/* Alerta legal */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <span className="text-xl">⚖️</span>
        <div>
          <p className="font-semibold text-amber-800 text-sm">Obrigação legal — Lei n.º 8/2022 de 10 de janeiro (alteração ao Código Civil)</p>
          <p className="text-amber-700 text-sm mt-0.5">
            O administrador é obrigado a emitir a declaração de encargos em <strong>10 dias úteis</strong> após o pedido.
            Após a escritura, o novo proprietário deve notificar o administrador no prazo de <strong>15 dias</strong>.
          </p>
        </div>
      </div>

      {/* Alerta atrasos */}
      {emAtraso.length > 0 && (
        <div className="mb-4 bg-red-600 text-white rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🔴</span>
          <div>
            <p className="font-bold">{emAtraso.length} declaração(ões) fora do prazo legal</p>
            <p className="text-red-100 text-sm">{emAtraso.map(d => `${d.fracaoId} — ${d.edificioNom}`).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total de declarações', value: declaracoes.length, color: 'text-gray-900' },
          { label: 'Pendentes',         value: pendentes.length,   color: pendentes.length > 0 ? 'text-yellow-600' : 'text-gray-900' },
          { label: 'Fora do prazo',     value: emAtraso.length,    color: emAtraso.length > 0 ? 'text-red-600 font-black' : 'text-gray-900' },
          { label: 'Concluídas',        value: declaracoes.filter(d => d.estado === 'venda_concluida').length, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all',             label: 'Todas' },
          { key: 'pendente',        label: `Pendentes (${pendentes.length})` },
          { key: 'emitida',         label: 'Emitidas' },
          { key: 'venda_concluida', label: 'Concluídas' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterEstado(f.key)} className={`text-xs px-4 py-1.5 rounded-full font-medium transition-colors ${filterEstado === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.label}</button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma declaração registada</h3>
          <p className="text-gray-400 text-sm mb-6">Crie uma declaração de encargos quando um condómino solicitar a venda da sua fração.</p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">+ Nova declaração</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(decl => {
            const est     = ESTADOS[decl.estado]
            const diasP   = diasRestantes(decl.prazoLegal)
            const emAtr   = decl.estado === 'pendente' && diasP < 0

            return (
              <div
                key={decl.id}
                className={`border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${emAtr ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'} ${selected?.id === decl.id ? 'ring-2 ring-blue-400' : ''}`}
                onClick={() => setSelected(s => s?.id === decl.id ? null : decl)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${est.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />{est.icon} {est.label}
                      </span>
                      {emAtr && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">⚠️ Fora do prazo ({Math.abs(diasP)}d)</span>}
                      {decl.estado === 'pendente' && !emAtr && <span className="text-xs text-gray-400">{diasP}d restantes</span>}
                    </div>
                    <p className="font-bold text-gray-900">{decl.fracaoId}</p>
                    <p className="text-xs text-gray-500">📍 {decl.edificioNom} · Vendedor: {decl.condominoNom}</p>
                    {decl.compradorNom && <p className="text-xs text-gray-400 mt-0.5">Comprador: {decl.compradorNom}</p>}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-bold ${decl.totalEncargos > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatEur(decl.totalEncargos)}</p>
                    <p className="text-xs text-gray-400">encargos</p>
                  </div>
                </div>

                {/* Detalhe expandido */}
                {selected?.id === decl.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4" onClick={e => e.stopPropagation()}>
                    {/* Detalhe financeiro */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-xl p-4">
                      <div><p className="text-xs text-gray-400">Quotas em dívida</p><p className="font-bold text-gray-900">{formatEur(decl.quotasEmDivida)}</p></div>
                      <div><p className="text-xs text-gray-400">Quotas extraordinárias</p><p className="font-bold text-gray-900">{formatEur(decl.quotasExtraordinarias)}</p></div>
                      <div><p className="text-xs text-gray-400">Fundo reserva</p><p className="font-bold text-gray-900">{formatEur(decl.fundoReservaDevido)}</p></div>
                      <div><p className="text-xs text-gray-400">Penalizações</p><p className="font-bold text-gray-900">{formatEur(decl.penalizacoes)}</p></div>
                    </div>

                    {/* Datas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-gray-400">Pedido</span><p className="font-semibold">{formatDate(decl.dataPedido)}</p></div>
                      <div><span className="text-gray-400">Prazo legal</span><p className={`font-semibold ${emAtr ? 'text-red-600' : ''}`}>{formatDate(decl.prazoLegal)}</p></div>
                      <div><span className="text-gray-400">Emissão</span><p className="font-semibold">{decl.dataEmissao ? formatDate(decl.dataEmissao) : '—'}</p></div>
                      <div><span className="text-gray-400">Escritura</span><p className="font-semibold">{decl.dataEscritura ? formatDate(decl.dataEscritura) : '—'}</p></div>
                    </div>

                    {/* NIF */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-gray-400">NIF vendedor</span><p className="font-semibold">{decl.condominoNIF || '—'}</p></div>
                      {decl.compradorNIF && <div><span className="text-gray-400">NIF comprador</span><p className="font-semibold">{decl.compradorNIF}</p></div>}
                    </div>

                    {/* Notificação novo proprietário */}
                    {decl.estado === 'venda_concluida' && (
                      <div className={`rounded-xl p-3 flex items-center justify-between ${decl.novoProprietarioNotificado ? 'bg-green-50 border border-green-100' : 'bg-orange-50 border border-orange-100'}`}>
                        <div>
                          <p className="text-sm font-semibold">{decl.novoProprietarioNotificado ? '✅ Novo proprietário notificado' : '⚠️ Aguarda notificação do novo proprietário'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Prazo legal: 15 dias após a escritura</p>
                          {decl.dataNotificacao && <p className="text-xs text-gray-400">Notificado em {formatDate(decl.dataNotificacao)}</p>}
                        </div>
                        {!decl.novoProprietarioNotificado && (
                          <button onClick={() => marcarNotificado(decl)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors">
                            ✅ Marcar notificado
                          </button>
                        )}
                      </div>
                    )}

                    {decl.observacoes && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-600">{decl.observacoes}</p>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2">
                      {decl.estado === 'pendente' && (
                        <button onClick={() => updateEstado(decl, 'emitida')} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors">📄 Marcar como emitida</button>
                      )}
                      {decl.estado === 'emitida' && (
                        <button onClick={() => updateEstado(decl, 'entregue')} className="text-xs bg-green-600 text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-green-700 transition-colors">✅ Marcar como entregue</button>
                      )}
                      {(decl.estado === 'entregue') && (
                        <button onClick={() => updateEstado(decl, 'venda_concluida')} className="text-xs bg-purple-600 text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-purple-700 transition-colors">🏠 Venda concluída</button>
                      )}
                      <button onClick={() => openEdit(decl)} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">✏️ Editar</button>
                      <button onClick={() => window.print()} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">🖨️ Imprimir</button>
                      <button onClick={() => { if (confirm('Eliminar esta declaração?')) { save(declaracoes.filter(x => x.id !== decl.id)); setSelected(null) } }} className="text-xs bg-red-50 text-red-500 px-2 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors">🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-gray-900">{editing ? '✏️ Editar declaração' : '+ Nova declaração de encargos'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Fechar">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">📍 Fração e vendedor</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Edifício *</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Edifício Saldanha" value={form.edificioNom || ''} onChange={e => setForm({ ...form, edificioNom: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Fração *</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Fração A - 2.º Dto" value={form.fracaoId || ''} onChange={e => setForm({ ...form, fracaoId: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Data do pedido *</label><input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dataPedido || ''} onChange={e => setForm({ ...form, dataPedido: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Condómino vendedor *</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="João Silva" value={form.condominoNom || ''} onChange={e => setForm({ ...form, condominoNom: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">NIF vendedor</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="123456789" value={form.condominoNIF || ''} onChange={e => setForm({ ...form, condominoNIF: e.target.value })} /></div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">🏠 Comprador (opcional)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Nome</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Maria Santos" value={form.compradorNom || ''} onChange={e => setForm({ ...form, compradorNom: e.target.value })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">NIF</label><input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="987654321" value={form.compradorNIF || ''} onChange={e => setForm({ ...form, compradorNIF: e.target.value })} /></div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">💶 Encargos em dívida</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Quotas em dívida (€)</label><input type="number" min={0} step={0.01} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.quotasEmDivida || ''} onChange={e => setForm({ ...form, quotasEmDivida: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Quotas extraordinárias (€)</label><input type="number" min={0} step={0.01} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.quotasExtraordinarias || ''} onChange={e => setForm({ ...form, quotasExtraordinarias: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Fundo de reserva (€)</label><input type="number" min={0} step={0.01} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.fundoReservaDevido || ''} onChange={e => setForm({ ...form, fundoReservaDevido: parseFloat(e.target.value) || 0 })} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Penalizações (€)</label><input type="number" min={0} step={0.01} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.penalizacoes || ''} onChange={e => setForm({ ...form, penalizacoes: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div className="mt-2 bg-gray-50 rounded-xl p-3 flex justify-between">
                  <span className="font-bold text-gray-700 text-sm">Total encargos</span>
                  <span className="font-bold text-gray-900">{formatEur((form.quotasEmDivida || 0) + (form.quotasExtraordinarias || 0) + (form.fundoReservaDevido || 0) + (form.penalizacoes || 0))}</span>
                </div>
              </section>

              <section>
                <label className="text-xs text-gray-500 mb-1 block">Observações</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Notas adicionais..." value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
              </section>

              <button
                onClick={handleSave}
                disabled={!form.edificioNom || !form.fracaoId || !form.condominoNom || !form.dataPedido}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editing ? '💾 Guardar alterações' : '✅ Criar declaração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
