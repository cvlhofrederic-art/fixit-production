'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { StatCard } from '../types'

// ─── Types ──────────────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'transacoes' | 'reconciliacao' | 'configuracao'
type MatchStatus = 'matched' | 'partial' | 'unmatched' | 'manual'
type TransactionType = 'credit' | 'debit'

interface BankTransaction {
  id: string; date: string; description: string; amount: number
  type: TransactionType; bankAccount: string; matchStatus: MatchStatus
  matchedChargeId?: string; category?: string
}

interface ExpectedCharge {
  id: string; condominoNome: string; fracao: string; imovel: string
  amount: number; dueDate: string; type: 'quota' | 'fundo_reserva' | 'extra' | 'obras'
  matchedTransactionId?: string
}

interface BankAccount {
  id: string; bankName: string; iban: string; lastSync: string
  balance: number; isConnected: boolean
}

interface MatchingConfig {
  toleranceAmount: number
  toleranceDays: number
  autoReconcile: boolean
  syncFrequency: 'hourly' | 'daily' | 'weekly'
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: 'dashboard', emoji: '📊', label: 'Dashboard' },
  { id: 'transacoes', emoji: '💳', label: 'Transações' },
  { id: 'reconciliacao', emoji: '🔗', label: 'Reconciliação' },
  { id: 'configuracao', emoji: '⚙️', label: 'Configuração' },
]

const CHARGE_TYPE_LABELS: Record<ExpectedCharge['type'], string> = {
  quota: 'Quota mensal',
  fundo_reserva: 'Fundo de reserva',
  extra: 'Quota extraordinária',
  obras: 'Obras / Derramas',
}

const STATUS_STYLES: Record<MatchStatus, { bg: string; color: string; label: string }> = {
  matched:   { bg: '#E6F4F2', color: '#1A7A6E', label: 'Reconciliado' },
  partial:   { bg: '#FEF5E4', color: '#D4830A', label: 'Parcial' },
  unmatched: { bg: '#FDECEA', color: '#C0392B', label: 'Pendente' },
  manual:    { bg: '#E8EDF4', color: '#2C5282', label: 'Manual' },
}

const NOMES_PT = [
  'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues',
  'Martins', 'Sousa', 'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques',
  'Almeida', 'Alves', 'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira',
]

const PRENOMES_PT = [
  'Ana', 'João', 'Maria', 'Pedro', 'Sofia', 'Carlos', 'Isabel', 'Miguel',
  'Teresa', 'Rui', 'Catarina', 'André', 'Beatriz', 'Nuno', 'Luísa',
]

const FRACOES = ['A', 'B', 'C', 'D', 'E', 'F', '1-A', '1-B', '2-A', '2-B', '3-A', '3-B', 'R/C-A', 'R/C-B']

const IMOVEIS = [
  'Edifício Atlântico', 'Residencial Douro', 'Condomínio Ribeira',
  'Edifício Boavista', 'Torre São João',
]

const BANK_DESCS_CREDIT = [
  'TRF SEPA {nome} quota', 'MB Way {nome}', 'Transferência {nome} ref.{ref}',
  'Pagamento quota {nome}', 'TRF {nome} fundo reserva', 'Débito direto {nome}',
]

const BANK_DESCS_DEBIT = [
  'Pagamento EDP Comercial', 'Águas do Porto fatura', 'Seguro Fidelidade Condomínio',
  'Manutenção elevador ThyssenKrupp', 'Limpeza Brilliance Lda', 'Jardinagem GreenPT',
  'Reparação canalização urgente', 'Serviço portaria Securitas', 'Material elétrico',
  'Pintura fachada parcial',
]

// ─── Seeded Random ──────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647 }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  const abs = Math.abs(n)
  const parts = abs.toFixed(2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${n < 0 ? '-' : ''}${intPart},${parts[1]} €`
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

// ─── Data Generation ────────────────────────────────────────────────────────────

function generateDemoData(userId: string) {
  const seed = hashStr(userId || 'demo-user')
  const rand = seededRandom(seed)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

  // Generate expected charges (20)
  const charges: ExpectedCharge[] = []
  for (let i = 0; i < 20; i++) {
    const month = Math.floor(rand() * 6) + 1
    const day = Math.floor(rand() * 25) + 1
    const types: ExpectedCharge['type'][] = ['quota', 'quota', 'quota', 'fundo_reserva', 'extra', 'obras']
    const tp = pick(types)
    const baseAmount = tp === 'quota' ? 80 + Math.floor(rand() * 120) :
                       tp === 'fundo_reserva' ? 30 + Math.floor(rand() * 50) :
                       tp === 'extra' ? 150 + Math.floor(rand() * 300) :
                       500 + Math.floor(rand() * 2000)
    charges.push({
      id: `chg-${i}`,
      condominoNome: `${pick(PRENOMES_PT)} ${pick(NOMES_PT)}`,
      fracao: pick(FRACOES),
      imovel: pick(IMOVEIS),
      amount: baseAmount + Math.floor(rand() * 100) / 100,
      dueDate: `2026-0${month}-${String(day).padStart(2, '0')}`,
      type: tp,
    })
  }

  // Generate bank transactions (30)
  const transactions: BankTransaction[] = []
  const accounts = ['acc-1', 'acc-2']

  for (let i = 0; i < 30; i++) {
    const isCredit = rand() > 0.35
    const month = Math.floor(rand() * 6) + 1
    const day = Math.floor(rand() * 27) + 1
    const nome = `${pick(PRENOMES_PT)} ${pick(NOMES_PT)}`

    let desc: string
    let amount: number
    if (isCredit) {
      desc = pick(BANK_DESCS_CREDIT)
        .replace('{nome}', nome)
        .replace('{ref}', String(Math.floor(rand() * 90000) + 10000))
      amount = 50 + Math.floor(rand() * 400) + Math.floor(rand() * 100) / 100
    } else {
      desc = pick(BANK_DESCS_DEBIT)
      amount = 80 + Math.floor(rand() * 1500) + Math.floor(rand() * 100) / 100
    }

    transactions.push({
      id: `txn-${i}`,
      date: `2026-0${month}-${String(day).padStart(2, '0')}`,
      description: desc,
      amount,
      type: isCredit ? 'credit' : 'debit',
      bankAccount: pick(accounts),
      matchStatus: 'unmatched',
      category: isCredit ? 'Receita condóminos' : 'Despesa operacional',
    })
  }

  // Pre-match ~60% of credits to charges
  const creditTxns = transactions.filter(t => t.type === 'credit' && t.matchStatus === 'unmatched')
  const unmatchedCharges = [...charges]
  let matchCount = 0
  const targetMatches = Math.floor(Math.min(creditTxns.length, unmatchedCharges.length) * 0.6)

  for (const txn of creditTxns) {
    if (matchCount >= targetMatches) break
    const idx = Math.floor(rand() * unmatchedCharges.length)
    const charge = unmatchedCharges[idx]
    if (!charge) continue

    // Adjust txn amount to be close to charge for realism
    if (rand() > 0.3) {
      txn.amount = charge.amount + (rand() > 0.8 ? Math.floor(rand() * 5) / 100 : 0)
    }
    txn.matchStatus = 'matched'
    txn.matchedChargeId = charge.id
    charge.matchedTransactionId = txn.id
    unmatchedCharges.splice(idx, 1)
    matchCount++
  }

  // Bank accounts
  const bankAccounts: BankAccount[] = [
    {
      id: 'acc-1', bankName: 'Millennium BCP', iban: 'PT50 0033 0000 4534 7890 1234 5',
      lastSync: '2026-03-25T08:30:00', balance: 18450.67, isConnected: true,
    },
    {
      id: 'acc-2', bankName: 'Caixa Geral de Depósitos', iban: 'PT50 0035 0000 1234 5678 9012 3',
      lastSync: '2026-03-25T08:30:00', balance: 7823.41, isConnected: true,
    },
    {
      id: 'acc-3', bankName: 'Novo Banco', iban: 'PT50 0007 0000 9876 5432 1098 7',
      lastSync: '', balance: 0, isConnected: false,
    },
  ]

  return { transactions, charges, bankAccounts }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ReconciliationBancaireSection({ user, userRole }: { user: any; userRole: string }) {
  const storageKey = `fixit_reconciliation_${user?.id}`

  // ── State
  const [tab, setTab] = useState<TabId>('dashboard')
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [charges, setCharges] = useState<ExpectedCharge[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [config, setConfig] = useState<MatchingConfig>({
    toleranceAmount: 0.50,
    toleranceDays: 5,
    autoReconcile: false,
    syncFrequency: 'daily',
  })

  // Transações tab filters
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | MatchStatus>('all')
  const [filterSearch, setFilterSearch] = useState('')
  const [sortCol, setSortCol] = useState<'date' | 'amount' | 'description'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null)

  // Reconciliação tab
  const [selectedLeftTxn, setSelectedLeftTxn] = useState<string | null>(null)
  const [selectedRightCharge, setSelectedRightCharge] = useState<string | null>(null)
  const [matchMessage, setMatchMessage] = useState('')

  // ── Init
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setTransactions(data.transactions || [])
        setCharges(data.charges || [])
        setBankAccounts(data.bankAccounts || [])
        if (data.config) setConfig(data.config)
        return
      } catch { /* fall through to demo data */ }
    }
    const demo = generateDemoData(user?.id || 'demo')
    setTransactions(demo.transactions)
    setCharges(demo.charges)
    setBankAccounts(demo.bankAccounts)
  }, [storageKey, user?.id])

  // ── Persist
  useEffect(() => {
    if (transactions.length === 0) return
    localStorage.setItem(storageKey, JSON.stringify({ transactions, charges, bankAccounts, config }))
  }, [transactions, charges, bankAccounts, config, storageKey])

  // ── Stats
  const stats = useMemo(() => {
    const total = transactions.length
    const matched = transactions.filter(t => t.matchStatus === 'matched' || t.matchStatus === 'manual').length
    const unmatched = transactions.filter(t => t.matchStatus === 'unmatched').length
    const partial = transactions.filter(t => t.matchStatus === 'partial').length
    const matchRate = total > 0 ? Math.round((matched / total) * 100) : 0
    const reconciledAmount = transactions
      .filter(t => t.matchStatus === 'matched' || t.matchStatus === 'manual')
      .reduce((s, t) => s + t.amount, 0)
    const totalCredits = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
    const totalDebits = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)

    // Monthly breakdown for progress bars
    const months = [1, 2, 3, 4, 5, 6].map(m => {
      const monthStr = `2026-0${m}`
      const monthTxns = transactions.filter(t => t.date.startsWith(monthStr))
      const mMatched = monthTxns.filter(t => t.matchStatus === 'matched' || t.matchStatus === 'manual').length
      return {
        month: m,
        label: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][m - 1],
        total: monthTxns.length,
        matched: mMatched,
        ratio: monthTxns.length > 0 ? mMatched / monthTxns.length : 0,
      }
    })

    return { total, matched, unmatched, partial, matchRate, reconciledAmount, totalCredits, totalDebits, months }
  }, [transactions])

  // ── Filtered & sorted transactions
  const filteredTransactions = useMemo(() => {
    let list = [...transactions]
    if (filterType !== 'all') list = list.filter(t => t.type === filterType)
    if (filterStatus !== 'all') list = list.filter(t => t.matchStatus === filterStatus)
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      list = list.filter(t => t.description.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q))
    }
    if (filterDateFrom) list = list.filter(t => t.date >= filterDateFrom)
    if (filterDateTo) list = list.filter(t => t.date <= filterDateTo)

    list.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortCol === 'amount') cmp = a.amount - b.amount
      else cmp = a.description.localeCompare(b.description)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [transactions, filterType, filterStatus, filterSearch, filterDateFrom, filterDateTo, sortCol, sortDir])

  // ── Unmatched lists for reconciliation
  const unmatchedTxns = useMemo(() =>
    transactions.filter(t => t.matchStatus === 'unmatched' && t.type === 'credit'),
    [transactions]
  )

  const unmatchedCharges = useMemo(() =>
    charges.filter(c => !c.matchedTransactionId),
    [charges]
  )

  // ── Auto-match
  const autoMatch = useCallback(() => {
    const newTxns = [...transactions]
    const newCharges = [...charges]
    let count = 0

    for (const txn of newTxns) {
      if (txn.matchStatus !== 'unmatched' || txn.type !== 'credit') continue

      const candidateIdx = newCharges.findIndex(c => {
        if (c.matchedTransactionId) return false
        const amountDiff = Math.abs(txn.amount - c.amount)
        const dateDiff = daysBetween(txn.date, c.dueDate)
        return amountDiff <= config.toleranceAmount && dateDiff <= config.toleranceDays
      })

      if (candidateIdx >= 0) {
        const charge = newCharges[candidateIdx]
        txn.matchStatus = 'matched'
        txn.matchedChargeId = charge.id
        charge.matchedTransactionId = txn.id
        count++
      }
    }

    setTransactions(newTxns)
    setCharges(newCharges)
    setMatchMessage(count > 0
      ? `${count} transação(ões) reconciliada(s) automaticamente.`
      : 'Nenhuma correspondência encontrada com a tolerância atual.'
    )
    setTimeout(() => setMatchMessage(''), 4000)
  }, [transactions, charges, config.toleranceAmount, config.toleranceDays])

  // ── Manual match
  const manualMatch = useCallback((transId: string, chargeId: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === transId ? { ...t, matchStatus: 'manual' as MatchStatus, matchedChargeId: chargeId } : t
    ))
    setCharges(prev => prev.map(c =>
      c.id === chargeId ? { ...c, matchedTransactionId: transId } : c
    ))
    setSelectedLeftTxn(null)
    setSelectedRightCharge(null)
    setMatchMessage('Reconciliação manual registada.')
    setTimeout(() => setMatchMessage(''), 3000)
  }, [])

  // ── Sort handler
  const handleSort = (col: 'date' | 'amount' | 'description') => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortArrow = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  // ── Shared styles
  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', fontSize: 13, border: '1px solid #E4DDD0', borderRadius: 6,
    background: '#fff', color: '#0D1B2E', outline: 'none',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#fff',
    background: '#1A7A6E', border: 'none', borderRadius: 6, cursor: 'pointer',
  }
  const btnOutline: React.CSSProperties = {
    padding: '8px 18px', fontSize: 13, fontWeight: 500, color: '#0D1B2E',
    background: 'none', border: '1px solid #E4DDD0', borderRadius: 6, cursor: 'pointer',
  }
  const thStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#8A9BB0',
    textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left',
    borderBottom: '1px solid #E4DDD0', cursor: 'pointer', userSelect: 'none',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, color: '#0D1B2E', borderBottom: '1px solid #F0ECE4',
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: '#0D1B2E', margin: 0 }}>
          Reconciliação Bancária
        </h2>
        <p style={{ fontSize: 14, color: '#8A9BB0', marginTop: 4 }}>
          Open Banking &middot; Correspondência automática de pagamentos
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E4DDD0', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? '#0D1B2E' : '#8A9BB0',
              borderBottom: tab === t.id ? '2px solid #C9A84C' : '2px solid transparent',
              background: 'none', border: 'none', cursor: 'pointer',
            }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Dashboard Tab ──────────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
            <StatCard emoji="💳" label="Total transações" value={stats.total} sub={`${stats.matched} reconciliadas`} color="blue" />
            <StatCard emoji="📊" label="Taxa de reconciliação" value={`${stats.matchRate}%`} sub={`${stats.unmatched} pendentes`} color={stats.matchRate >= 80 ? 'green' : 'yellow'} />
            <StatCard emoji="⚠️" label="Não reconciliadas" value={stats.unmatched} sub="Ação necessária" color={stats.unmatched > 5 ? 'red' : 'yellow'} />
            <StatCard emoji="✅" label="Valor reconciliado" value={formatCurrency(stats.reconciledAmount)} sub={`Créditos: ${formatCurrency(stats.totalCredits)}`} color="green" />
          </div>

          {/* Monthly progress */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#0D1B2E', margin: '0 0 20px' }}>
              Progresso mensal de reconciliação
            </h3>
            {stats.months.map(m => (
              <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ width: 36, fontSize: 13, fontWeight: 600, color: '#4A5E78' }}>{m.label}</span>
                <div style={{ flex: 1, height: 20, background: '#F0ECE4', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${m.ratio * 100}%`, height: '100%', background: '#1A7A6E',
                    borderRadius: 10, transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ width: 60, fontSize: 12, color: '#8A9BB0', textAlign: 'right' }}>
                  {m.matched}/{m.total}
                </span>
              </div>
            ))}
          </div>

          {/* Top 5 unmatched */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#0D1B2E', margin: '0 0 16px' }}>
              Transações pendentes de reconciliação
            </h3>
            {transactions.filter(t => t.matchStatus === 'unmatched').slice(0, 5).length === 0 ? (
              <p style={{ fontSize: 14, color: '#8A9BB0' }}>Todas as transações foram reconciliadas.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Data</th>
                    <th style={thStyle}>Descrição</th>
                    <th style={thStyle}>Montante</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter(t => t.matchStatus === 'unmatched').slice(0, 5).map(txn => (
                    <tr key={txn.id}>
                      <td style={tdStyle}>{formatDate(txn.date)}</td>
                      <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: txn.type === 'credit' ? '#1A7A6E' : '#C0392B' }}>
                        {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: txn.type === 'credit' ? '#E6F4F2' : '#FDECEA', color: txn.type === 'credit' ? '#1A7A6E' : '#C0392B', fontWeight: 500 }}>
                          {txn.type === 'credit' ? 'Crédito' : 'Débito'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => { setTab('reconciliacao'); setSelectedLeftTxn(txn.id) }}
                          style={{ ...btnOutline, padding: '4px 12px', fontSize: 12 }}
                        >
                          Reconciliar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── Transações Tab ─────────────────────────────────────────────────────── */}
      {tab === 'transacoes' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BB0', marginBottom: 4 }}>De</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inputStyle, width: 140 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BB0', marginBottom: 4 }}>Até</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...inputStyle, width: 140 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BB0', marginBottom: 4 }}>Tipo</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={{ ...inputStyle, width: 120 }}>
                <option value="all">Todos</option>
                <option value="credit">Crédito</option>
                <option value="debit">Débito</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BB0', marginBottom: 4 }}>Estado</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={{ ...inputStyle, width: 140 }}>
                <option value="all">Todos</option>
                <option value="matched">Reconciliado</option>
                <option value="unmatched">Pendente</option>
                <option value="partial">Parcial</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BB0', marginBottom: 4 }}>Pesquisar</label>
              <input type="text" placeholder="Descrição..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} style={{ ...inputStyle, width: 180 }} />
            </div>
            <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterType('all'); setFilterStatus('all'); setFilterSearch('') }}
              style={{ ...btnOutline, padding: '7px 14px', fontSize: 12 }}>
              Limpar
            </button>
          </div>

          {/* Table */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAF7' }}>
                  <th style={thStyle} onClick={() => handleSort('date')}>Data{sortArrow('date')}</th>
                  <th style={thStyle} onClick={() => handleSort('description')}>Descrição{sortArrow('description')}</th>
                  <th style={thStyle} onClick={() => handleSort('amount')}>Montante{sortArrow('amount')}</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#8A9BB0', padding: 40 }}>Nenhuma transação encontrada.</td></tr>
                ) : filteredTransactions.map(txn => {
                  const ss = STATUS_STYLES[txn.matchStatus]
                  const isSelected = selectedTxn === txn.id
                  return (
                    <React.Fragment key={txn.id}>
                      <tr
                        onClick={() => setSelectedTxn(isSelected ? null : txn.id)}
                        style={{ cursor: 'pointer', background: isSelected ? '#FAFAF7' : 'transparent' }}
                      >
                        <td style={tdStyle}>{formatDate(txn.date)}</td>
                        <td style={{ ...tdStyle, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {txn.description}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: txn.type === 'credit' ? '#1A7A6E' : '#C0392B', fontFamily: 'monospace' }}>
                          {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: txn.type === 'credit' ? '#E6F4F2' : '#FDECEA', color: txn.type === 'credit' ? '#1A7A6E' : '#C0392B', fontWeight: 500 }}>
                            {txn.type === 'credit' ? 'Crédito' : 'Débito'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: ss.bg, color: ss.color }}>
                            {ss.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {txn.matchStatus === 'unmatched' && (
                            <button onClick={e => { e.stopPropagation(); setTab('reconciliacao'); setSelectedLeftTxn(txn.id) }}
                              style={{ ...btnOutline, padding: '4px 10px', fontSize: 11 }}>
                              Reconciliar
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Detail row */}
                      {isSelected && (
                        <tr>
                          <td colSpan={6} style={{ padding: '12px 24px', background: '#FAFAF7', borderBottom: '1px solid #E4DDD0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 13 }}>
                              <div>
                                <span style={{ color: '#8A9BB0', fontSize: 11 }}>Conta bancária</span>
                                <div style={{ color: '#0D1B2E', marginTop: 2 }}>
                                  {bankAccounts.find(a => a.id === txn.bankAccount)?.bankName || txn.bankAccount}
                                </div>
                              </div>
                              <div>
                                <span style={{ color: '#8A9BB0', fontSize: 11 }}>Categoria</span>
                                <div style={{ color: '#0D1B2E', marginTop: 2 }}>{txn.category || 'Não categorizada'}</div>
                              </div>
                              <div>
                                <span style={{ color: '#8A9BB0', fontSize: 11 }}>Correspondência</span>
                                <div style={{ color: '#0D1B2E', marginTop: 2 }}>
                                  {txn.matchedChargeId
                                    ? (() => { const c = charges.find(ch => ch.id === txn.matchedChargeId); return c ? `${c.condominoNome} - ${c.fracao} (${formatCurrency(c.amount)})` : txn.matchedChargeId })()
                                    : 'Nenhuma'}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 10, textAlign: 'right' }}>
            {filteredTransactions.length} transação(ões) encontrada(s)
          </div>
        </div>
      )}

      {/* ─── Reconciliação Tab ──────────────────────────────────────────────────── */}
      {tab === 'reconciliacao' && (
        <div>
          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#4A5E78' }}>
                Pendentes: <strong style={{ color: '#C0392B' }}>{unmatchedTxns.length}</strong> transações, <strong style={{ color: '#C0392B' }}>{unmatchedCharges.length}</strong> cobranças
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={autoMatch} style={btnPrimary}>
                🤖 Auto-match
              </button>
              <button
                onClick={() => {
                  if (selectedLeftTxn && selectedRightCharge) manualMatch(selectedLeftTxn, selectedRightCharge)
                  else setMatchMessage('Selecione uma transação e uma cobrança para reconciliar.')
                }}
                disabled={!selectedLeftTxn || !selectedRightCharge}
                style={{
                  ...btnPrimary,
                  background: selectedLeftTxn && selectedRightCharge ? '#C9A84C' : '#ccc',
                  cursor: selectedLeftTxn && selectedRightCharge ? 'pointer' : 'not-allowed',
                }}
              >
                🔗 Rapprocher
              </button>
            </div>
          </div>

          {/* Match message */}
          {matchMessage && (
            <div style={{
              padding: '10px 16px', marginBottom: 16, borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: matchMessage.includes('Nenhuma') || matchMessage.includes('Selecione') ? '#FEF5E4' : '#E6F4F2',
              color: matchMessage.includes('Nenhuma') || matchMessage.includes('Selecione') ? '#D4830A' : '#1A7A6E',
              border: `1px solid ${matchMessage.includes('Nenhuma') || matchMessage.includes('Selecione') ? '#F0D9A0' : '#B0DDD5'}`,
            }}>
              {matchMessage}
            </div>
          )}

          {/* Split view */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Left panel: bank transactions */}
            <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4DDD0', background: '#FAFAF7' }}>
                <h4 style={{ margin: 0, fontSize: 14, color: '#0D1B2E', fontWeight: 600 }}>
                  💳 Transações bancárias ({unmatchedTxns.length})
                </h4>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {unmatchedTxns.length === 0 ? (
                  <p style={{ padding: 20, fontSize: 13, color: '#8A9BB0', textAlign: 'center' }}>
                    Todas as transações de crédito foram reconciliadas.
                  </p>
                ) : unmatchedTxns.map(txn => (
                  <div
                    key={txn.id}
                    onClick={() => setSelectedLeftTxn(selectedLeftTxn === txn.id ? null : txn.id)}
                    style={{
                      padding: '12px 18px', borderBottom: '1px solid #F0ECE4', cursor: 'pointer',
                      background: selectedLeftTxn === txn.id ? '#E6F4F2' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#8A9BB0' }}>{formatDate(txn.date)}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1A7A6E', fontFamily: 'monospace' }}>
                        +{formatCurrency(txn.amount)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#0D1B2E', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txn.description}
                    </div>
                    {selectedLeftTxn === txn.id && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#1A7A6E', fontWeight: 500 }}>
                        ✓ Selecionada &mdash; escolha uma cobrança à direita
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel: expected charges */}
            <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4DDD0', background: '#FAFAF7' }}>
                <h4 style={{ margin: 0, fontSize: 14, color: '#0D1B2E', fontWeight: 600 }}>
                  📋 Cobranças esperadas ({unmatchedCharges.length})
                </h4>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {unmatchedCharges.length === 0 ? (
                  <p style={{ padding: 20, fontSize: 13, color: '#8A9BB0', textAlign: 'center' }}>
                    Todas as cobranças foram reconciliadas.
                  </p>
                ) : unmatchedCharges.map(charge => {
                  const isSelected = selectedRightCharge === charge.id
                  // Highlight if selected txn amount is close
                  let amountMatch = false
                  if (selectedLeftTxn) {
                    const txn = transactions.find(t => t.id === selectedLeftTxn)
                    if (txn) amountMatch = Math.abs(txn.amount - charge.amount) <= config.toleranceAmount
                  }
                  return (
                    <div
                      key={charge.id}
                      onClick={() => setSelectedRightCharge(isSelected ? null : charge.id)}
                      style={{
                        padding: '12px 18px', borderBottom: '1px solid #F0ECE4', cursor: 'pointer',
                        background: isSelected ? '#E6F4F2' : amountMatch ? '#F0FBF9' : 'transparent',
                        transition: 'background 0.15s',
                        borderLeft: amountMatch && !isSelected ? '3px solid #1A7A6E' : '3px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#0D1B2E', fontWeight: 500 }}>
                          {charge.condominoNome}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2E', fontFamily: 'monospace' }}>
                          {formatCurrency(charge.amount)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: '#8A9BB0' }}>
                          {charge.imovel} &middot; {charge.fracao}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#F7F4EE', color: '#4A5E78' }}>
                          {CHARGE_TYPE_LABELS[charge.type]}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#8A9BB0', marginTop: 2 }}>
                        Vencimento: {formatDate(charge.dueDate)}
                      </div>
                      {isSelected && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#1A7A6E', fontWeight: 500 }}>
                          ✓ Selecionada &mdash; clique &quot;Rapprocher&quot; para confirmar
                        </div>
                      )}
                      {amountMatch && !isSelected && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#1A7A6E', fontStyle: 'italic' }}>
                          Montante compatível
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Configuração Tab ───────────────────────────────────────────────────── */}
      {tab === 'configuracao' && (
        <div>
          {/* Bank accounts */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#0D1B2E', margin: 0 }}>
                Contas bancárias
              </h3>
              <button style={{ ...btnOutline, opacity: 0.5, cursor: 'not-allowed' }} disabled>
                + Conectar banco
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {bankAccounts.map(acc => (
                <div key={acc.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 20px', border: '1px solid #E4DDD0', borderRadius: 10,
                  background: acc.isConnected ? '#fff' : '#FAFAF7',
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0D1B2E' }}>{acc.bankName}</div>
                    <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 2, fontFamily: 'monospace' }}>{acc.iban}</div>
                    {acc.lastSync && (
                      <div style={{ fontSize: 11, color: '#8A9BB0', marginTop: 4 }}>
                        Última sincronização: {new Date(acc.lastSync).toLocaleString('pt-PT')}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#0D1B2E', fontFamily: "'Playfair Display',serif" }}>
                      {acc.isConnected ? formatCurrency(acc.balance) : '--'}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, marginTop: 4, display: 'inline-block',
                      background: acc.isConnected ? '#E6F4F2' : '#FDECEA',
                      color: acc.isConnected ? '#1A7A6E' : '#C0392B',
                    }}>
                      {acc.isConnected ? 'Conectada' : 'Desconectada'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#8A9BB0', marginTop: 14 }}>
              A integração Open Banking (PSD2) será disponibilizada em breve. Os dados apresentados são de demonstração.
            </p>
          </div>

          {/* Matching rules */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#0D1B2E', margin: '0 0 20px' }}>
              Regras de correspondência
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#4A5E78', marginBottom: 6, fontWeight: 500 }}>
                  Tolerância de montante (€)
                </label>
                <input
                  type="number" step="0.01" min="0" max="50"
                  value={config.toleranceAmount}
                  onChange={e => setConfig(c => ({ ...c, toleranceAmount: parseFloat(e.target.value) || 0 }))}
                  style={{ ...inputStyle, width: '100%' }}
                />
                <span style={{ fontSize: 11, color: '#8A9BB0', marginTop: 4, display: 'block' }}>
                  Diferença máxima aceite entre transação e cobrança
                </span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#4A5E78', marginBottom: 6, fontWeight: 500 }}>
                  Tolerância de data (dias)
                </label>
                <input
                  type="number" step="1" min="0" max="30"
                  value={config.toleranceDays}
                  onChange={e => setConfig(c => ({ ...c, toleranceDays: parseInt(e.target.value) || 0 }))}
                  style={{ ...inputStyle, width: '100%' }}
                />
                <span style={{ fontSize: 11, color: '#8A9BB0', marginTop: 4, display: 'block' }}>
                  Diferença máxima de dias entre data da transação e vencimento
                </span>
              </div>
            </div>
          </div>

          {/* Auto reconciliation & sync */}
          <div style={{ background: '#fff', border: '1px solid #E4DDD0', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: '#0D1B2E', margin: '0 0 20px' }}>
              Automação
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Auto-reconcile toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, color: '#0D1B2E', fontWeight: 500 }}>Reconciliação automática</div>
                  <div style={{ fontSize: 12, color: '#8A9BB0', marginTop: 2 }}>
                    Reconciliar automaticamente quando a correspondência é exata (tolerância &le; regras definidas)
                  </div>
                </div>
                <button
                  onClick={() => setConfig(c => ({ ...c, autoReconcile: !c.autoReconcile }))}
                  style={{
                    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: config.autoReconcile ? '#1A7A6E' : '#ccc',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 10, background: '#fff',
                    position: 'absolute', top: 3,
                    left: config.autoReconcile ? 25 : 3,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>

              {/* Sync frequency */}
              <div>
                <label style={{ display: 'block', fontSize: 14, color: '#0D1B2E', fontWeight: 500, marginBottom: 6 }}>
                  Frequência de sincronização
                </label>
                <select
                  value={config.syncFrequency}
                  onChange={e => setConfig(c => ({ ...c, syncFrequency: e.target.value as MatchingConfig['syncFrequency'] }))}
                  style={{ ...inputStyle, width: 220 }}
                >
                  <option value="hourly">A cada hora</option>
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                </select>
                <span style={{ fontSize: 11, color: '#8A9BB0', marginTop: 4, display: 'block' }}>
                  Frequência com que os dados bancários são atualizados via Open Banking
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
