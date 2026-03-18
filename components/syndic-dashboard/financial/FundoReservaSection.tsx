'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoMovimento = 'entrada' | 'saida'
type CategoriaEntrada = 'quota_ordinaria' | 'quota_extraordinaria' | 'juros' | 'outro'
type CategoriaSaida = 'obra_conservacao' | 'reparacao_urgente' | 'obra_valorizacao' | 'outro'

interface MovimentoFundo {
  id: string
  edificioNom: string
  data: string
  tipo: TipoMovimento
  categoriaEntrada?: CategoriaEntrada
  categoriaSaida?: CategoriaSaida
  descricao: string
  valor: number
  aprovadoAG?: boolean         // Saídas > limite precisam de aprovação AG
  referenciaAta?: string       // Referência à ata da AG que aprovou
  observacoes?: string
}

interface EdificioFundo {
  id: string
  nome: string
  orcamentoAnual: number       // Orçamento anual total do condomínio
  percentagemFundo: number     // % destinada ao fundo (mínimo legal 10%)
  saldoAtual: number           // Calculado automaticamente
}

interface Props {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const PERCENTAGEM_MINIMA_LEGAL = 10 // DL 268/94, art.º 4.º

const CATEGORIAS_ENTRADA: Record<CategoriaEntrada, { emoji: string; label: string }> = {
  quota_ordinaria:      { emoji: '📥', label: 'Quota Ordinária (10%+)' },
  quota_extraordinaria: { emoji: '📋', label: 'Quota Extraordinária' },
  juros:                { emoji: '📈', label: 'Juros / Rendimentos' },
  outro:                { emoji: '📄', label: 'Outro' },
}

const CATEGORIAS_SAIDA: Record<CategoriaSaida, { emoji: string; label: string }> = {
  obra_conservacao:  { emoji: '🔧', label: 'Obra de Conservação' },
  reparacao_urgente: { emoji: '🚨', label: 'Reparação Urgente' },
  obra_valorizacao:  { emoji: '🏗️', label: 'Obra de Valorização' },
  outro:             { emoji: '📄', label: 'Outro' },
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FundoReservaSection({ user, userRole }: Props) {
  // ── State
  const [edificios, setEdificios] = useState<EdificioFundo[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoFundo[]>([])
  const [view, setView] = useState<'dashboard' | 'movimentos' | 'novo_edificio' | 'novo_movimento'>('dashboard')
  const [filtroEdificio, setFiltroEdificio] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimento | 'todos'>('todos')

  // ── Form: Edifício
  const [formNome, setFormNome] = useState('')
  const [formOrcamento, setFormOrcamento] = useState('')
  const [formPercentagem, setFormPercentagem] = useState('10')

  // ── Form: Movimento
  const [movEdificio, setMovEdificio] = useState('')
  const [movData, setMovData] = useState('')
  const [movTipo, setMovTipo] = useState<TipoMovimento>('entrada')
  const [movCatEntrada, setMovCatEntrada] = useState<CategoriaEntrada>('quota_ordinaria')
  const [movCatSaida, setMovCatSaida] = useState<CategoriaSaida>('obra_conservacao')
  const [movDescricao, setMovDescricao] = useState('')
  const [movValor, setMovValor] = useState('')
  const [movAprovadoAG, setMovAprovadoAG] = useState(false)
  const [movRefAta, setMovRefAta] = useState('')
  const [movObs, setMovObs] = useState('')

  // ── Storage
  const STORAGE_KEY_E = `fixit_fundo_edificios_${user.id}`
  const STORAGE_KEY_M = `fixit_fundo_movimentos_${user.id}`

  useEffect(() => {
    try {
      const e = localStorage.getItem(STORAGE_KEY_E)
      if (e) setEdificios(JSON.parse(e))
      const m = localStorage.getItem(STORAGE_KEY_M)
      if (m) setMovimentos(JSON.parse(m))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { localStorage.setItem(STORAGE_KEY_E, JSON.stringify(edificios)) }, [edificios])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_M, JSON.stringify(movimentos)) }, [movimentos])

  // ── Calcular saldo por edifício
  const saldosPorEdificio = useMemo(() => {
    const map: Record<string, number> = {}
    for (const ed of edificios) map[ed.nome] = 0
    for (const m of movimentos) {
      if (!map[m.edificioNom] && map[m.edificioNom] !== 0) map[m.edificioNom] = 0
      if (m.tipo === 'entrada') map[m.edificioNom] += m.valor
      else map[m.edificioNom] -= m.valor
    }
    return map
  }, [edificios, movimentos])

  // ── Stats
  const stats = useMemo(() => {
    const saldoTotal = Object.values(saldosPorEdificio).reduce((a, b) => a + b, 0)
    const totalEntradas = movimentos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
    const totalSaidas = movimentos.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
    const orcamentoTotal = edificios.reduce((s, e) => s + e.orcamentoAnual, 0)
    const contribuicaoAnualDevida = edificios.reduce((s, e) => s + (e.orcamentoAnual * e.percentagemFundo / 100), 0)

    // Compliance check: nenhum edifício abaixo dos 10%
    const naoConformes = edificios.filter(e => e.percentagemFundo < PERCENTAGEM_MINIMA_LEGAL).length

    return { saldoTotal, totalEntradas, totalSaidas, orcamentoTotal, contribuicaoAnualDevida, naoConformes }
  }, [edificios, movimentos, saldosPorEdificio])

  // ── Create edifício
  const criarEdificio = () => {
    if (!formNome.trim()) return
    const pct = parseFloat(formPercentagem) || 10
    const novo: EdificioFundo = {
      id: crypto.randomUUID(),
      nome: formNome.trim(),
      orcamentoAnual: parseFloat(formOrcamento) || 0,
      percentagemFundo: Math.max(pct, PERCENTAGEM_MINIMA_LEGAL),
      saldoAtual: 0,
    }
    setEdificios(prev => [...prev, novo])
    setFormNome(''); setFormOrcamento(''); setFormPercentagem('10')
    setView('dashboard')
  }

  // ── Create movimento
  const criarMovimento = () => {
    if (!movEdificio || !movDescricao.trim() || !movValor) return
    const novo: MovimentoFundo = {
      id: crypto.randomUUID(),
      edificioNom: movEdificio,
      data: movData || new Date().toISOString().slice(0, 10),
      tipo: movTipo,
      categoriaEntrada: movTipo === 'entrada' ? movCatEntrada : undefined,
      categoriaSaida: movTipo === 'saida' ? movCatSaida : undefined,
      descricao: movDescricao.trim(),
      valor: parseFloat(movValor) || 0,
      aprovadoAG: movTipo === 'saida' ? movAprovadoAG : undefined,
      referenciaAta: movRefAta.trim() || undefined,
      observacoes: movObs.trim() || undefined,
    }
    setMovimentos(prev => [novo, ...prev])
    setMovEdificio(''); setMovData(''); setMovDescricao(''); setMovValor(''); setMovAprovadoAG(false); setMovRefAta(''); setMovObs('')
    setView('movimentos')
  }

  // ── Delete
  const eliminarEdificio = (id: string) => {
    const ed = edificios.find(e => e.id === id)
    if (!ed) return
    setEdificios(prev => prev.filter(e => e.id !== id))
    setMovimentos(prev => prev.filter(m => m.edificioNom !== ed.nome))
  }

  const eliminarMovimento = (id: string) => {
    setMovimentos(prev => prev.filter(m => m.id !== id))
  }

  // ── Filtered movimentos
  const movimentosFiltrados = useMemo(() => {
    return movimentos
      .filter(m => filtroEdificio === 'todos' || m.edificioNom === filtroEdificio)
      .filter(m => filtroTipo === 'todos' || m.tipo === filtroTipo)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [movimentos, filtroEdificio, filtroTipo])

  // ── Helpers
  const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2 })

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: '#0D1B2E', margin: 0 }}>🏦 Fundo Comum de Reserva</h2>
          <p style={{ fontSize: 13, color: '#8A9BB0', marginTop: 4 }}>Mínimo legal 10% do orçamento anual · DL 268/94, Art.º 4.º · Código Civil Art.º 1424.º</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('novo_edificio')} style={{ background: '#F7F4EE', color: '#0D1B2E', border: '1px solid #E4DDD0', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            🏢 Novo Edifício
          </button>
          <button onClick={() => setView('novo_movimento')} style={{ background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Registar Movimento
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { emoji: '🏦', label: 'Saldo Total', value: `${fmt(stats.saldoTotal)} €`, color: stats.saldoTotal >= 0 ? '#1A7A6E' : '#C0392B' },
          { emoji: '📥', label: 'Total Entradas', value: `${fmt(stats.totalEntradas)} €`, color: '#1A7A6E' },
          { emoji: '📤', label: 'Total Saídas', value: `${fmt(stats.totalSaidas)} €`, color: '#C0392B' },
          { emoji: '🏢', label: 'Edifícios', value: edificios.length, color: '#0D1B2E' },
          { emoji: '💰', label: 'Contribuição Anual Devida', value: `${fmt(stats.contribuicaoAnualDevida)} €`, color: '#D4830A' },
          { emoji: stats.naoConformes > 0 ? '⚠️' : '✅', label: 'Conformidade Legal', value: stats.naoConformes > 0 ? `${stats.naoConformes} não conforme` : 'OK', color: stats.naoConformes > 0 ? '#C0392B' : '#1A7A6E' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: typeof s.color === 'string' ? s.color : '#0D1B2E' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #E4DDD0', paddingBottom: 12 }}>
        {[
          { key: 'dashboard' as const, label: '📊 Visão Geral', count: edificios.length },
          { key: 'movimentos' as const, label: '💶 Movimentos', count: movimentos.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            style={{
              background: (view === tab.key || (view !== 'dashboard' && view !== 'movimentos' && tab.key === 'dashboard')) ? '#0D1B2E' : 'transparent',
              color: (view === tab.key) ? '#fff' : '#4A5E78',
              border: (view === tab.key) ? 'none' : '1px solid #E4DDD0',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* ── View: Dashboard — cards por edifício ── */}
      {view === 'dashboard' && (
        <div>
          {edificios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8A9BB0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhum edifício configurado</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Registe os edifícios do seu portfólio para gerir o fundo comum de reserva</p>
              <button onClick={() => setView('novo_edificio')} style={{ marginTop: 16, background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🏢 Adicionar Edifício
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {edificios.map(ed => {
                const saldo = saldosPorEdificio[ed.nome] || 0
                const contribuicaoAnual = ed.orcamentoAnual * ed.percentagemFundo / 100
                const conforme = ed.percentagemFundo >= PERCENTAGEM_MINIMA_LEGAL
                const nbMov = movimentos.filter(m => m.edificioNom === ed.nome).length

                // Visual bar: saldo / contribuição anual
                const ratio = contribuicaoAnual > 0 ? Math.min(saldo / contribuicaoAnual, 2) : 0
                const barWidth = Math.max(0, Math.min(ratio * 50, 100))

                return (
                  <div key={ed.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 16, padding: 24, position: 'relative' }}>
                    {/* Conformidade badge */}
                    {!conforme && (
                      <div style={{ position: 'absolute', top: 12, right: 12, background: '#FDECEA', color: '#C0392B', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>
                        ⚠️ ABAIXO DO MÍNIMO LEGAL
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F7F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏢</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#0D1B2E' }}>{ed.nome}</div>
                        <div style={{ fontSize: 12, color: '#8A9BB0' }}>{ed.percentagemFundo}% do orçamento · {nbMov} movimento{nbMov !== 1 ? 's' : ''}</div>
                      </div>
                    </div>

                    {/* Saldo */}
                    <div style={{ background: '#FAFAF7', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#8A9BB0' }}>Saldo Atual</span>
                        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: saldo >= 0 ? '#1A7A6E' : '#C0392B', fontWeight: 700 }}>
                          {fmt(saldo)} €
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ width: '100%', height: 6, background: '#E4DDD0', borderRadius: 3 }}>
                        <div style={{ width: `${barWidth}%`, height: '100%', background: saldo >= 0 ? '#1A7A6E' : '#C0392B', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#8A9BB0' }}>
                        <span>0 €</span>
                        <span>Objetivo anual: {fmt(contribuicaoAnual)} €</span>
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div style={{ background: '#E6F4F2', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#1A7A6E' }}>{fmt(ed.orcamentoAnual)} €</div>
                        <div style={{ color: '#8A9BB0', fontSize: 10, marginTop: 2 }}>Orçamento Anual</div>
                      </div>
                      <div style={{ background: '#FEF5E4', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#D4830A' }}>{fmt(contribuicaoAnual)} €</div>
                        <div style={{ color: '#8A9BB0', fontSize: 10, marginTop: 2 }}>Contribuição ({ed.percentagemFundo}%)</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => { setMovEdificio(ed.nome); setView('novo_movimento') }}
                        style={{ flex: 1, fontSize: 12, background: '#F7F4EE', color: '#0D1B2E', border: '1px solid #E4DDD0', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Movimento
                      </button>
                      <button
                        onClick={() => eliminarEdificio(ed.id)}
                        style={{ fontSize: 14, background: 'none', border: '1px solid #E4DDD0', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#8A9BB0' }}
                        aria-label="Eliminar edifício"
                      >🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Legal info block */}
          {edificios.length > 0 && (
            <div style={{ marginTop: 24, background: '#F7F4EE', borderRadius: 12, padding: 20, border: '1px solid #E4DDD0' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2E', margin: '0 0 8px' }}>⚖️ Enquadramento Legal — Fundo Comum de Reserva</h4>
              <div style={{ fontSize: 12, color: '#4A5E78', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 6px' }}>• <strong>DL 268/94, Art.º 4.º:</strong> Mínimo obrigatório de 10% do orçamento anual do condomínio, constituído como fundo comum de reserva.</p>
                <p style={{ margin: '0 0 6px' }}>• <strong>Código Civil, Art.º 1424.º:</strong> As despesas de conservação e fruição das partes comuns são suportadas proporcionalmente pela permilagem de cada fração.</p>
                <p style={{ margin: '0 0 6px' }}>• <strong>Utilização:</strong> O fundo destina-se a obras de conservação e reparação das partes comuns. Grandes obras podem requerer aprovação em assembleia.</p>
                <p style={{ margin: 0 }}>• <strong>Responsabilidade do Administrador:</strong> A correta constituição e gestão do fundo é dever legal do administrador (Art.º 1436.º CC).</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── View: Movimentos ── */}
      {view === 'movimentos' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select
              value={filtroEdificio}
              onChange={e => setFiltroEdificio(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E4DDD0', fontSize: 12 }}
            >
              <option value="todos">Todos os edifícios</option>
              {edificios.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
            </select>
            {(['todos', 'entrada', 'saida'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltroTipo(f)}
                style={{
                  background: filtroTipo === f ? '#0D1B2E' : '#F7F4EE',
                  color: filtroTipo === f ? '#fff' : '#4A5E78',
                  border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {f === 'todos' ? 'Todos' : f === 'entrada' ? '📥 Entradas' : '📤 Saídas'}
              </button>
            ))}
          </div>

          {movimentosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8A9BB0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💶</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Nenhum movimento registado</p>
              <button onClick={() => setView('novo_movimento')} style={{ marginTop: 12, background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Registar Movimento
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {movimentosFiltrados.map(m => {
                const isEntrada = m.tipo === 'entrada'
                const catInfo = isEntrada
                  ? (m.categoriaEntrada ? CATEGORIAS_ENTRADA[m.categoriaEntrada] : { emoji: '📄', label: 'Outro' })
                  : (m.categoriaSaida ? CATEGORIAS_SAIDA[m.categoriaSaida] : { emoji: '📄', label: 'Outro' })

                return (
                  <div key={m.id} style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: isEntrada ? '#E6F4F2' : '#FDECEA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {isEntrada ? '📥' : '📤'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#0D1B2E' }}>{m.descricao}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                          background: isEntrada ? '#E6F4F2' : '#FDECEA',
                          color: isEntrada ? '#1A7A6E' : '#C0392B',
                        }}>
                          {catInfo.label}
                        </span>
                        {m.aprovadoAG && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: '#F7F4EE', color: '#C9A84C' }}>
                            ✓ Aprovado AG
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 4 }}>
                        {m.edificioNom} · {new Date(m.data).toLocaleDateString('pt-PT')}
                        {m.referenciaAta && ` · Ata: ${m.referenciaAta}`}
                      </div>
                    </div>

                    {/* Valor */}
                    <div style={{
                      fontFamily: "'Playfair Display',serif",
                      fontSize: 18, fontWeight: 700,
                      color: isEntrada ? '#1A7A6E' : '#C0392B',
                      whiteSpace: 'nowrap',
                    }}>
                      {isEntrada ? '+' : '-'}{fmt(m.valor)} €
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => eliminarMovimento(m.id)}
                      style={{ background: 'none', border: 'none', fontSize: 14, color: '#8A9BB0', cursor: 'pointer', flexShrink: 0 }}
                      aria-label="Eliminar movimento"
                    >🗑️</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View: Novo Edifício ── */}
      {view === 'novo_edificio' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 16, padding: 32, maxWidth: 500 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: '0 0 20px' }}>🏢 Novo Edifício</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nome do Edifício *</label>
              <input value={formNome} onChange={e => setFormNome(e.target.value)} style={inputStyle} placeholder="Ex: Edifício Aurora" />
            </div>
            <div>
              <label style={labelStyle}>Orçamento Anual do Condomínio (€)</label>
              <input type="number" value={formOrcamento} onChange={e => setFormOrcamento(e.target.value)} style={inputStyle} placeholder="Ex: 24000" />
            </div>
            <div>
              <label style={labelStyle}>Percentagem para o Fundo (%)</label>
              <input type="number" value={formPercentagem} onChange={e => setFormPercentagem(e.target.value)} style={inputStyle} min="10" placeholder="Mínimo: 10%" />
              {parseFloat(formPercentagem) < 10 && formPercentagem !== '' && (
                <div style={{ fontSize: 11, color: '#C0392B', marginTop: 4, fontWeight: 600 }}>
                  ⚠️ O mínimo legal é 10% (DL 268/94). O valor será corrigido automaticamente.
                </div>
              )}
            </div>

            {/* Preview */}
            {formOrcamento && (
              <div style={{ background: '#F7F4EE', borderRadius: 10, padding: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8A9BB0' }}>Contribuição anual ao fundo:</span>
                  <strong style={{ color: '#0D1B2E' }}>
                    {fmt((parseFloat(formOrcamento) || 0) * Math.max(parseFloat(formPercentagem) || 10, 10) / 100)} €
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: '#8A9BB0' }}>Contribuição mensal:</span>
                  <strong style={{ color: '#0D1B2E' }}>
                    {fmt((parseFloat(formOrcamento) || 0) * Math.max(parseFloat(formPercentagem) || 10, 10) / 100 / 12)} €/mês
                  </strong>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button onClick={criarEdificio} style={{ background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ✓ Adicionar Edifício
            </button>
            <button onClick={() => { setFormNome(''); setFormOrcamento(''); setFormPercentagem('10'); setView('dashboard') }} style={{ background: '#F7F4EE', color: '#4A5E78', border: '1px solid #E4DDD0', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── View: Novo Movimento ── */}
      {view === 'novo_movimento' && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 16, padding: 32, maxWidth: 600 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, margin: '0 0 20px' }}>💶 Registar Movimento</h3>

          {edificios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#8A9BB0' }}>
              <p>Nenhum edifício registado. Adicione primeiro um edifício.</p>
              <button onClick={() => setView('novo_edificio')} style={{ marginTop: 12, background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🏢 Novo Edifício
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Edifício *</label>
                  <select value={movEdificio} onChange={e => setMovEdificio(e.target.value)} style={inputStyle}>
                    <option value="">Selecionar edifício...</option>
                    {edificios.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setMovTipo('entrada')}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: movTipo === 'entrada' ? '#E6F4F2' : '#FAFAF7',
                        color: movTipo === 'entrada' ? '#1A7A6E' : '#8A9BB0',
                        border: movTipo === 'entrada' ? '2px solid #1A7A6E' : '1px solid #E4DDD0',
                      }}
                    >📥 Entrada</button>
                    <button
                      onClick={() => setMovTipo('saida')}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: movTipo === 'saida' ? '#FDECEA' : '#FAFAF7',
                        color: movTipo === 'saida' ? '#C0392B' : '#8A9BB0',
                        border: movTipo === 'saida' ? '2px solid #C0392B' : '1px solid #E4DDD0',
                      }}
                    >📤 Saída</button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Data</label>
                  <input type="date" value={movData} onChange={e => setMovData(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Categoria</label>
                  {movTipo === 'entrada' ? (
                    <select value={movCatEntrada} onChange={e => setMovCatEntrada(e.target.value as CategoriaEntrada)} style={inputStyle}>
                      {Object.entries(CATEGORIAS_ENTRADA).map(([k, v]) => (
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                      ))}
                    </select>
                  ) : (
                    <select value={movCatSaida} onChange={e => setMovCatSaida(e.target.value as CategoriaSaida)} style={inputStyle}>
                      {Object.entries(CATEGORIAS_SAIDA).map(([k, v]) => (
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Valor (€) *</label>
                  <input type="number" value={movValor} onChange={e => setMovValor(e.target.value)} style={inputStyle} placeholder="0.00" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Descrição *</label>
                  <input value={movDescricao} onChange={e => setMovDescricao(e.target.value)} style={inputStyle} placeholder="Ex: Quota fundo reserva — março 2026" />
                </div>

                {/* Aprovação AG (apenas saídas) */}
                {movTipo === 'saida' && (
                  <>
                    <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={movAprovadoAG} onChange={e => setMovAprovadoAG(e.target.checked)} />
                        <span style={{ fontWeight: 600, color: '#4A5E78' }}>Aprovado em Assembleia Geral</span>
                      </label>
                    </div>
                    {movAprovadoAG && (
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelStyle}>Referência da Ata</label>
                        <input value={movRefAta} onChange={e => setMovRefAta(e.target.value)} style={inputStyle} placeholder="Ex: Ata AG 15/01/2026 — Ponto 5" />
                      </div>
                    )}
                  </>
                )}

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Observações</label>
                  <textarea value={movObs} onChange={e => setMovObs(e.target.value)} style={{ ...inputStyle, minHeight: 60 }} placeholder="Notas adicionais..." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button onClick={criarMovimento} style={{ background: '#0D1B2E', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Registar Movimento
                </button>
                <button onClick={() => setView('movimentos')} style={{ background: '#F7F4EE', color: '#4A5E78', border: '1px solid #E4DDD0', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#4A5E78', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E4DDD0',
  fontSize: 13, color: '#0D1B2E', background: '#FAFAF7', outline: 'none',
}
