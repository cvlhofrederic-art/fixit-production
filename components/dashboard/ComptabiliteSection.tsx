'use client'

import { useState, useEffect, useRef, useMemo } from 'react'

/* ══════════ AGENT COMPTABLE LÉA ══════════ */

function AgentComptable({ bookings, artisan, services, expenses, annualHT, annualCA, totalExpenses, quarterData, currentMonth, currentYear, formatEur }: {
  bookings: any[]; artisan: any; services: any[]; expenses: any[]; annualHT: number; annualCA: number; totalExpenses: number; quarterData: number[]; currentMonth: number; currentYear: number; formatEur: (v: number) => string
}) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const expenseCategories = expenses.reduce((acc: any, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount || 0)
    return acc
  }, {})

  // ── Enrichir chaque booking avec clientName et serviceName déjà résolus
  const allBookingsEnriched = useMemo(() => bookings.map((b: any) => ({
    ...b,
    clientName: b.notes?.match(/Client:\s*([^|.\n]+)/)?.[1]?.trim() || 'Client',
    serviceName: b.services?.name || services.find((s: any) => s.id === b.service_id)?.name || 'Intervention',
  })), [bookings, services])

  const financialContext = {
    // Agrégats (référence rapide)
    annualCA,
    annualCAHT: annualHT,
    completedCount: bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === currentYear).length,
    tvaCollectee: annualCA - annualHT,
    avgMonthlyCA: annualCA / (currentMonth + 1),
    totalExpenses,
    expenseCategories,
    quarterData,
    // ── DONNÉES BRUTES COMPLÈTES (pour calculs sur période)
    allBookings: allBookingsEnriched,   // Toutes les interventions avec client + service résolus
    allExpenses: expenses,              // Toutes les dépenses avec date, catégorie, montant, notes
  }

  const QUICK_QUESTIONS = [
    { label: '🔧 Matériaux vs main d\'œuvre', q: 'Donne-moi le total dépensé en matériaux et en main d\'œuvre séparément depuis le début de l\'année, avec le détail ligne par ligne.' },
    { label: '💳 Cotisations URSSAF', q: 'Combien vais-je payer à l\'URSSAF ce trimestre et sur l\'année entière ? Détaille par trimestre.' },
    { label: '📊 Bénéfice net réel', q: 'Quel est mon bénéfice net réel après toutes les charges, cotisations URSSAF et impôt ? Fais le calcul complet.' },
    { label: '📅 Analyse du mois', q: `Analyse mes revenus et dépenses du mois dernier : combien j'ai encaissé, dépensé, et quel est mon résultat net ?` },
    { label: '⚠️ Plafond micro', q: 'Suis-je proche du plafond micro-entrepreneur ? À quel rythme je l\'atteindrai ?' },
    { label: '🚗 Frais de déplacement', q: 'Combien j\'ai dépensé en transport et déplacements ? Y a-t-il des frais kilométriques à optimiser ?' },
    { label: '🏗️ Charges déductibles BTP', q: 'Quelles sont toutes les charges déductibles spécifiques au BTP que je peux enregistrer ?' },
    { label: '📋 Préparer ma déclaration', q: 'Prépare un récapitulatif complet de mes données pour ma prochaine déclaration URSSAF.' },
  ]

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    setChatStarted(true)
    const userMsg = { role: 'user' as const, content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/comptable-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          financialContext,
          conversationHistory: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const responseText = data.response || 'Je n\'ai pas pu générer une réponse. Veuillez réessayer.'
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur de connexion. Vérifiez votre connexion internet et réessayez.' }])
    }
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const formatMessage = (text: string) => {
    // 1. Escape HTML first (XSS prevention)
    const escaped = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
    // 2. Apply markdown transforms on escaped content
    return escaped
      // gras
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // code inline
      .replace(/`([^`]+)`/g, '<code class="bg-gray-200 rounded px-1 text-xs font-mono">$1</code>')
      // lignes tiret → liste
      .replace(/(^|\n)(- .+)/g, (_, pre, item) =>
        `${pre}<span class="flex gap-1.5 mt-0.5"><span class="text-[#FFC107] font-bold mt-px">›</span><span>${item.slice(2)}</span></span>`
      )
      // saut de ligne
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header Léa */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] p-6 rounded-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#FFC107]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-4 mb-3 relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-2xl shadow-lg">
            🧮
          </div>
          <div>
            <div className="text-xl font-black">Léa — Votre Agent Comptable IA</div>
            <div className="text-sm text-gray-300">Spécialisée micro-entreprise · Toujours disponible</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-300 font-medium">En ligne</span>
          </div>
        </div>
        <p className="text-sm text-gray-300 relative">
          Posez-moi toutes vos questions de comptabilité, fiscalité et gestion. J&apos;analyse vos données financières réelles pour vous donner des réponses précises et personnalisées.
        </p>
      </div>

      {/* Financial snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'CA TTC annuel', value: formatEur(annualCA), icon: '💰', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Charges déduites', value: formatEur(totalExpenses), icon: '🧾', color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'URSSAF estimé', value: formatEur(annualHT * 0.212), icon: '🏛️', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Net estimé', value: formatEur(annualHT * 0.771 - totalExpenses), icon: '📈', color: 'text-gray-900', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} rounded-2xl p-4 border border-white`}>
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className={`font-black text-lg ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>

        {/* Chat header */}
        <div className="border-b border-gray-100 px-5 py-3 flex items-center gap-3 bg-gray-50">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-sm flex-shrink-0">🧮</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">Léa — Agent Comptable IA</div>
            <div className="text-xs text-gray-500 truncate">
              Accès à <strong className="text-gray-600">{bookings.filter(b => b.status === 'completed').length} interventions</strong> · <strong className="text-gray-600">{expenses.length} dépenses</strong> · calculs sur toute période
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-600 font-medium">En ligne</span>
            </div>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setChatStarted(false) }}
                className="text-xs text-gray-500 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1 transition">
                ↺ Nouveau
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: '420px', minHeight: '320px' }}>
          {!chatStarted ? (
            <div className="py-4">
              {/* Welcome */}
              <div className="flex gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-base flex-shrink-0 shadow-sm">🧮</div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[82%]">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    Bonjour ! Je suis <strong>Léa</strong>, votre agent comptable IA spécialisée BTP.<br /><br />
                    J&apos;ai accès en temps réel à <strong>toutes vos données</strong> : chaque intervention, chaque dépense avec leur date et catégorie exactes.<br /><br />
                    Vous pouvez me demander n&apos;importe quel calcul sur n&apos;importe quelle période — par exemple <em>&ldquo;combien j&apos;ai dépensé en matériaux du 1er janvier au 15 mars&rdquo;</em> et je ferai le calcul ligne par ligne.
                  </p>
                </div>
              </div>

              {/* Quick question grid */}
              <div className="grid grid-cols-2 gap-2">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q.q)}
                    className="text-left text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2.5 hover:bg-amber-100 transition font-medium leading-snug">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 shadow-sm ${
                    msg.role === 'assistant'
                      ? 'bg-gradient-to-br from-[#FFC107] to-[#FFD54F]'
                      : 'bg-[#2C3E50] text-white'
                  }`}>
                    {msg.role === 'assistant' ? '🧮' : '👤'}
                  </div>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#FFC107] text-gray-900 rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-sm flex-shrink-0">🧮</div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">Léa analyse vos données</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Suggestions rapides pendant le chat */}
        {chatStarted && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto border-t border-gray-50 pt-2">
            {[
              { label: '🔧 Matériaux', q: 'Total dépensé en matériaux cette année, détail ligne par ligne ?' },
              { label: '👷 Main d\'œuvre', q: 'Total dépensé en main d\'œuvre et sous-traitance cette année ?' },
              { label: '📆 Ce mois', q: 'Résultat net du mois en cours : revenus moins charges moins cotisations ?' },
              { label: '💳 URSSAF T en cours', q: 'Combien je dois payer à l\'URSSAF pour le trimestre en cours ?' },
              { label: '📊 Par service', q: 'Quel est mon chiffre d\'affaires par type d\'intervention cette année ?' },
              { label: '🧾 Top dépenses', q: 'Quelles sont mes 5 plus grosses dépenses de l\'année ?' },
            ].map((s, i) => (
              <button key={i} onClick={() => sendMessage(s.q)}
                className="flex-shrink-0 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-1.5 hover:bg-amber-100 transition font-medium whitespace-nowrap">
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-100 p-4 flex gap-3 items-end">
          <textarea
            ref={inputRef as any}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(inputValue)
              }
            }}
            placeholder={'Posez votre question à Léa...\nEx: "Combien j\'ai dépensé en matériaux de janvier à mars ?"\nEx: "Quel est mon bénéfice net sur le 2e trimestre ?"'}
            rows={3}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] bg-gray-50 resize-none"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="bg-[#FFC107] hover:bg-[#FFD54F] disabled:opacity-40 text-gray-900 px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex-shrink-0 self-end"
          >
            {isLoading ? '⏳' : '↑ Envoyer'}
          </button>
        </div>
        <div className="px-4 pb-3 text-[10px] text-gray-300 text-center">
          Entrée = envoyer · Maj+Entrée = saut de ligne
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-500 text-center">
        ℹ️ Léa fournit des informations indicatives basées sur vos données Vitfix. Pour des conseils fiscaux engageant votre responsabilité, consultez un expert-comptable agréé.
      </div>
    </div>
  )
}

/* ══════════ COMPTABILITÉ SECTION ══════════ */

export default function ComptabiliteSection({ bookings, artisan, services }: { bookings: any[]; artisan: any; services: any[] }) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedPeriod, setSelectedPeriod] = useState<'mois' | 'trimestre' | 'annee'>('mois')
  const [selectedMonth, setSelectedMonthC] = useState(currentMonth)
  const [expenses, setExpenses] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_expenses_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ label: '', amount: '', category: 'materiel', date: new Date().toISOString().split('T')[0], notes: '' })
  const [activeComptaTab, setActiveComptaTab] = useState<'dashboard' | 'revenus' | 'depenses' | 'declaration' | 'assistant'>('dashboard')
  const [exportMonth, setExportMonth] = useState(currentMonth)

  const MONTH_NAMES = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
  const MONTH_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const EXPENSE_CATEGORIES = [
    { key: 'materiel', label: 'Matériaux & fournitures chantier', icon: '🔧' },
    { key: 'mainoeuvre', label: 'Main d\'œuvre & sous-traitance', icon: '👷' },
    { key: 'transport', label: 'Transport & carburant', icon: '🚗' },
    { key: 'outillage', label: 'Outillage & machines', icon: '🛠️' },
    { key: 'assurance', label: 'Assurance (RC Pro, décennale…)', icon: '🛡️' },
    { key: 'formation', label: 'Formation & certifications', icon: '📚' },
    { key: 'logiciel', label: 'Logiciels & abonnements', icon: '💻' },
    { key: 'telephone', label: 'Téléphone & internet', icon: '📱' },
    { key: 'comptable', label: 'Expert-comptable & juridique', icon: '🧮' },
    { key: 'publicite', label: 'Publicité & marketing', icon: '📣' },
    { key: 'bureau', label: 'Frais de bureau', icon: '🏢' },
    { key: 'autre', label: 'Autres charges', icon: '📦' },
  ]

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getBookingsForPeriod = (year: number, month?: number, quarter?: number) => {
    return bookings.filter(b => {
      if (!b.booking_date) return false
      const d = new Date(b.booking_date)
      if (d.getFullYear() !== year) return false
      if (selectedPeriod === 'mois' && month !== undefined) return d.getMonth() === month
      if (selectedPeriod === 'trimestre' && quarter !== undefined) return Math.floor(d.getMonth() / 3) === quarter
      return true
    })
  }

  const getQuarter = () => Math.floor(selectedMonth / 3)

  const filteredBookings = selectedPeriod === 'mois'
    ? getBookingsForPeriod(selectedYear, selectedMonth)
    : selectedPeriod === 'trimestre'
    ? getBookingsForPeriod(selectedYear, undefined, getQuarter())
    : getBookingsForPeriod(selectedYear)

  const completedFiltered = filteredBookings.filter(b => b.status === 'completed')
  const chiffreAffaires = completedFiltered.reduce((s, b) => s + (b.price_ttc || 0), 0)
  const chiffreAffairesHT = completedFiltered.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
  const tvaCollectee = chiffreAffaires - chiffreAffairesHT

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date)
    if (d.getFullYear() !== selectedYear) return false
    if (selectedPeriod === 'mois') return d.getMonth() === selectedMonth
    if (selectedPeriod === 'trimestre') return Math.floor(d.getMonth() / 3) === getQuarter()
    return true
  })

  const totalExpenses = filteredExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const resultatNet = chiffreAffairesHT - totalExpenses

  // Monthly revenue for chart
  const monthlyRevenue = Array.from({ length: 12 }, (_, m) => {
    const mb = bookings.filter(b => {
      if (!b.booking_date || b.status !== 'completed') return false
      const d = new Date(b.booking_date)
      return d.getFullYear() === selectedYear && d.getMonth() === m
    })
    return { month: MONTH_NAMES[m], ca: mb.reduce((s, b) => s + (b.price_ttc || 0), 0) }
  })

  const maxCA = Math.max(...monthlyRevenue.map(m => m.ca), 1)

  // Expense breakdown by category
  const expenseByCategory = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.key && new Date(e.date).getFullYear() === selectedYear)
      .reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const saveExpense = () => {
    if (!expenseForm.label || !expenseForm.amount) return
    const newExpense = { ...expenseForm, id: Date.now().toString(), amount: parseFloat(expenseForm.amount) }
    const updated = [...expenses, newExpense]
    setExpenses(updated)
    localStorage.setItem(`fixit_expenses_${artisan?.id}`, JSON.stringify(updated))
    setShowAddExpense(false)
    setExpenseForm({ label: '', amount: '', category: 'materiel', date: new Date().toISOString().split('T')[0], notes: '' })
  }

  const deleteExpense = (id: string) => {
    const updated = expenses.filter(e => e.id !== id)
    setExpenses(updated)
    localStorage.setItem(`fixit_expenses_${artisan?.id}`, JSON.stringify(updated))
  }

  // Declaration data
  const quarterLabels = ['T1 (Jan-Mars)', 'T2 (Avr-Juin)', 'T3 (Juil-Sept)', 'T4 (Oct-Déc)']
  const quarterData = [0, 1, 2, 3].map(q => {
    const qb = bookings.filter(b => {
      if (!b.booking_date || b.status !== 'completed') return false
      const d = new Date(b.booking_date)
      return d.getFullYear() === selectedYear && Math.floor(d.getMonth() / 3) === q
    })
    return qb.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
  })

  const annualHT = quarterData.reduce((s, v) => s + v, 0)
  const isAutoEntrepreneur = annualHT < 77700 // plafond micro-entreprise artisans 2024
  const tauxCotisation = 0.212 // 21.2% pour artisans BTP micro-entrepreneur 2026
  const cotisationsSociales = annualHT * tauxCotisation
  const impotRevenu = annualHT * 0.011 // 1.1% prélèvement libératoire optionnel artisans
  const resultatApresCharges = annualHT - cotisationsSociales

  const formatEur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-semibold">🧮 Comptabilité & Fiscalité</h1>
        <div className="flex items-center gap-3">
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-[#FFC107]">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex bg-gray-100 rounded-lg overflow-hidden">
            {(['mois', 'trimestre', 'annee'] as const).map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${selectedPeriod === p ? 'bg-[#FFC107] text-gray-900' : 'text-gray-500 hover:bg-gray-200'}`}>
                {p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">

        {/* Period selector */}
        {selectedPeriod === 'mois' && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {MONTH_NAMES.map((m, i) => (
              <button key={i} onClick={() => setSelectedMonthC(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${selectedMonth === i ? 'bg-[#FFC107] text-gray-900' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#FFC107]'}`}>
                {m}
              </button>
            ))}
          </div>
        )}
        {selectedPeriod === 'trimestre' && (
          <div className="flex gap-2 mb-6">
            {[0, 1, 2, 3].map(q => (
              <button key={q} onClick={() => setSelectedMonthC(q * 3)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${getQuarter() === q ? 'bg-[#FFC107] text-gray-900' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#FFC107]'}`}>
                {quarterLabels[q]}
              </button>
            ))}
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {([
            { key: 'dashboard', label: '📊 Tableau de bord' },
            { key: 'revenus', label: '💰 Revenus' },
            { key: 'depenses', label: '🧾 Dépenses' },
            { key: 'declaration', label: '🏛️ Déclaration' },
            { key: 'assistant', label: '🤖 Assistant IA' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveComptaTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${activeComptaTab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeComptaTab === 'dashboard' && (
          <div>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Chiffre d&apos;affaires TTC</div>
                <div className="text-3xl font-black text-green-600">{formatEur(chiffreAffaires)}</div>
                <div className="text-xs text-gray-500 mt-1">{completedFiltered.length} intervention(s)</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">CA Hors Taxes</div>
                <div className="text-3xl font-black text-blue-600">{formatEur(chiffreAffairesHT)}</div>
                <div className="text-xs text-gray-500 mt-1">TVA : {formatEur(tvaCollectee)}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Charges déductibles</div>
                <div className="text-3xl font-black text-red-500">{formatEur(totalExpenses)}</div>
                <div className="text-xs text-gray-500 mt-1">{filteredExpenses.length} dépense(s)</div>
              </div>
              <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${resultatNet >= 0 ? 'border-[#FFC107]' : 'border-red-500'}`}>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Résultat net</div>
                <div className={`text-3xl font-black ${resultatNet >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{formatEur(resultatNet)}</div>
                <div className="text-xs text-gray-500 mt-1">avant impôts</div>
              </div>
            </div>

            {/* Revenue chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
              <h3 className="font-bold text-lg mb-5">📈 Évolution du CA mensuel {selectedYear}</h3>
              <div className="flex items-end gap-2 h-40">
                {monthlyRevenue.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[9px] text-gray-500 font-semibold">
                      {m.ca > 0 ? formatEur(m.ca).replace('€', '') + '€' : ''}
                    </div>
                    <div
                      className={`w-full rounded-t-lg transition-all ${i === currentMonth && selectedYear === currentYear ? 'bg-[#FFC107]' : 'bg-blue-100'}`}
                      style={{ height: `${Math.max(4, (m.ca / maxCA) * 100)}%` }}
                    />
                    <div className="text-[9px] text-gray-500">{m.month}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Health indicator */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 p-5 rounded-2xl">
                <div className="font-bold text-green-800 mb-2">✅ Statut fiscal</div>
                <div className="text-sm text-green-700">
                  {isAutoEntrepreneur ? 'Micro-entrepreneur' : 'Dépassement plafond !'}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  CA annuel : {formatEur(bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear).reduce((s, b) => s + (b.price_ht || 0), 0))}
                  {' / '}77 700 €
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl">
                <div className="font-bold text-blue-800 mb-2">💳 Cotisations estimées</div>
                <div className="text-2xl font-black text-blue-700">{formatEur(cotisationsSociales)}</div>
                <div className="text-xs text-blue-600 mt-1">21,7% du CA HT annuel</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                <div className="font-bold text-amber-800 mb-2">📋 Prochaine déclaration</div>
                <div className="text-sm text-amber-700 font-semibold">
                  {(() => {
                    const q = Math.floor(currentMonth / 3)
                    const dates = ['30 Avril', '31 Juillet', '31 Oct', '31 Jan']
                    return dates[q] || 'Voir calendrier'
                  })()}
                </div>
                <div className="text-xs text-amber-600 mt-1">Déclaration URSSAF trimestrielle</div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUS TAB ── */}
        {activeComptaTab === 'revenus' && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-lg">
                  💰 Revenus — {selectedPeriod === 'mois' ? MONTH_FULL[selectedMonth] : selectedPeriod === 'trimestre' ? quarterLabels[getQuarter()] : selectedYear}
                </h3>
                <div className="flex gap-6 mt-3">
                  <div><span className="text-2xl font-black text-green-600">{formatEur(chiffreAffaires)}</span><span className="text-xs text-gray-500 ml-1">TTC</span></div>
                  <div><span className="text-2xl font-black text-blue-500">{formatEur(chiffreAffairesHT)}</span><span className="text-xs text-gray-500 ml-1">HT</span></div>
                  <div><span className="text-2xl font-black text-gray-500">{formatEur(tvaCollectee)}</span><span className="text-xs text-gray-500 ml-1">TVA 20%</span></div>
                </div>
              </div>
              {completedFiltered.length === 0 ? (
                <div className="p-10 text-center text-gray-500">Aucune intervention terminée sur cette période</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold">Date</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold">Client / Service</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">HT</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">TVA</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedFiltered.sort((a, b) => b.booking_date.localeCompare(a.booking_date)).map(b => {
                      const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                      const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                      const tva = (b.price_ttc || 0) - ht
                      return (
                        <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-500">{new Date(b.booking_date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium">{clientName}</div>
                            <div className="text-xs text-gray-500">{b.services?.name}</div>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold">{formatEur(ht)}</td>
                          <td className="px-5 py-3 text-right text-gray-500">{formatEur(tva)}</td>
                          <td className="px-5 py-3 text-right font-bold text-green-600">{formatEur(b.price_ttc || 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-5 py-3 font-bold">TOTAL</td>
                      <td className="px-5 py-3 text-right font-bold">{formatEur(chiffreAffairesHT)}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-500">{formatEur(tvaCollectee)}</td>
                      <td className="px-5 py-3 text-right font-bold text-green-600">{formatEur(chiffreAffaires)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Revenue by service */}
            {services.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="font-bold mb-4">🔧 CA par motif ({selectedYear})</h3>
                <div className="space-y-3">
                  {services.map(s => {
                    const sBookings = bookings.filter(b => b.service_id === s.id && b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear)
                    const sCA = sBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0)
                    const pct = maxCA > 0 ? (sCA / (chiffreAffaires || 1)) * 100 : 0
                    return (
                      <div key={s.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{s.name}</span>
                          <span className="font-bold text-green-600">{formatEur(sCA)} ({sBookings.length} RDV)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#FFC107] to-[#FFD54F] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DÉPENSES TAB ── */}
        {activeComptaTab === 'depenses' && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-lg">🧾 Charges déductibles</h3>
                <p className="text-sm text-gray-500">Total : <span className="font-bold text-red-500">{formatEur(totalExpenses)}</span></p>
              </div>
              <button onClick={() => setShowAddExpense(true)}
                className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-xl font-semibold shadow-sm text-sm transition-all">
                + Ajouter une charge
              </button>
            </div>

            {showAddExpense && (
              <div className="bg-white border-2 border-[#FFC107] p-6 rounded-2xl mb-5">
                <h4 className="font-bold mb-4">Nouvelle charge déductible</h4>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Libellé *</label>
                    <input value={expenseForm.label} onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                      placeholder="Ex: Achat vis et boulons" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Montant TTC (€) *</label>
                    <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Catégorie</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Date</label>
                    <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Notes (optionnel)</label>
                    <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Numéro de facture, fournisseur..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddExpense(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">Annuler</button>
                  <button onClick={saveExpense} disabled={!expenseForm.label || !expenseForm.amount}
                    className="flex-1 bg-[#FFC107] text-gray-900 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">Enregistrer</button>
                </div>
              </div>
            )}

            {/* Breakdown by category */}
            {expenseByCategory.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-sm mb-5">
                <h4 className="font-semibold mb-4">Répartition par catégorie</h4>
                <div className="space-y-3">
                  {expenseByCategory.map(c => (
                    <div key={c.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{c.icon} {c.label}</span>
                        <span className="font-bold text-red-500">{formatEur(c.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(c.total / (totalExpenses || 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses list */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 font-semibold text-sm text-gray-700">
                Liste des charges ({filteredExpenses.length})
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <div className="text-4xl mb-3">🧾</div>
                  <div>Aucune charge enregistrée sur cette période</div>
                  <button onClick={() => setShowAddExpense(true)} className="mt-3 text-[#FFC107] font-semibold text-sm">+ Ajouter une charge</button>
                </div>
              ) : (
                <div>
                  {filteredExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(e => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.key === e.category)
                    return (
                      <div key={e.id} className="flex items-center gap-4 px-5 py-4 border-t border-gray-100 hover:bg-gray-50 group">
                        <div className="text-2xl">{cat?.icon || '📦'}</div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{e.label}</div>
                          <div className="text-xs text-gray-500">{cat?.label} · {new Date(e.date).toLocaleDateString('fr-FR')}</div>
                          {e.notes && <div className="text-xs text-gray-500 italic">{e.notes}</div>}
                        </div>
                        <div className="font-bold text-red-500">{formatEur(parseFloat(e.amount))}</div>
                        <button onClick={() => deleteExpense(e.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition ml-2 text-lg">🗑</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DÉCLARATION TAB ── */}
        {activeComptaTab === 'declaration' && (
          <div className="space-y-6">
            {/* Status badge */}
            <div className={`p-5 rounded-2xl border-2 flex items-start gap-4 ${isAutoEntrepreneur ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <div className="text-3xl">{isAutoEntrepreneur ? '✅' : '⚠️'}</div>
              <div>
                <div className={`font-bold text-lg ${isAutoEntrepreneur ? 'text-green-800' : 'text-red-700'}`}>
                  {isAutoEntrepreneur ? 'Régime Micro-Entrepreneur (Auto-entrepreneur)' : '⚠️ Attention : Dépassement de plafond possible'}
                </div>
                <div className={`text-sm mt-1 ${isAutoEntrepreneur ? 'text-green-700' : 'text-red-600'}`}>
                  {isAutoEntrepreneur
                    ? `CA HT annuel estimé : ${formatEur(annualHT)} sur ${formatEur(77700)} de plafond autorisé`
                    : `Votre CA dépasse le seuil de 77 700 €. Consultez un expert-comptable pour le passage en régime réel.`}
                </div>
              </div>
            </div>

            {/* Quarterly declaration */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-5">📋 Déclarations URSSAF trimestrielles {selectedYear}</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {quarterData.map((ca, q) => {
                  const deadline = ['30 avril', '31 juillet', '31 octobre', '31 janvier'][q]
                  const cotis = ca * tauxCotisation
                  const isPast = (q < Math.floor(currentMonth / 3)) && selectedYear <= currentYear
                  return (
                    <div key={q} className={`p-5 rounded-xl border-2 ${isPast ? 'border-gray-200 bg-gray-50' : 'border-[#FFC107] bg-amber-50'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-bold text-gray-900">{quarterLabels[q]}</div>
                        {isPast && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Passé</span>}
                        {!isPast && <span className="text-xs bg-[#FFC107] text-gray-900 px-2 py-0.5 rounded-full font-semibold">À déclarer</span>}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">CA HT réalisé</span>
                          <span className="font-bold">{formatEur(ca)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cotisations (21,7%)</span>
                          <span className="font-bold text-red-500">{formatEur(cotis)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>À payer</span>
                          <span className="text-red-600">{formatEur(cotis)}</span>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">⏰ Délai : {deadline}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Annual summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-5">📊 Récapitulatif annuel {selectedYear}</h3>
              <div className="space-y-3">
                {[
                  { label: 'Chiffre d\'affaires TTC', value: chiffreAffaires + (bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear && filteredBookings.indexOf(b) === -1).reduce((s, b) => s + (b.price_ttc || 0), 0)), color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'CA Hors Taxes (déclarable)', value: annualHT, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Cotisations sociales URSSAF (21,7%)', value: -cotisationsSociales, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Prélèvement libératoire IR (1,1%)', value: -impotRevenu, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Résultat net estimé', value: resultatApresCharges - impotRevenu, color: 'text-gray-900', bg: 'bg-gray-50', bold: true },
                ].map((row, i) => (
                  <div key={i} className={`flex justify-between items-center px-4 py-3 rounded-xl ${row.bg}`}>
                    <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'} text-gray-700`}>{row.label}</span>
                    <span className={`font-bold ${row.color} ${row.bold ? 'text-lg' : ''}`}>
                      {row.value < 0 ? `- ${formatEur(Math.abs(row.value))}` : formatEur(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Export comptable mensuel ── */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-2">📤 Export comptable mensuel</h3>
              <p className="text-sm text-gray-500 mb-5">Générez un fichier CSV complet pour votre comptable : revenus, factures, dépenses et récapitulatif du mois sélectionné.</p>

              <div className="flex flex-wrap gap-2 mb-5">
                {MONTH_FULL.map((m, i) => (
                  <button key={i} onClick={() => setExportMonth(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${exportMonth === i ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {MONTH_NAMES[i]} {selectedYear}
                  </button>
                ))}
              </div>

              {(() => {
                const mBookings = bookings.filter(b => {
                  if (!b.booking_date || b.status !== 'completed') return false
                  const d = new Date(b.booking_date)
                  return d.getFullYear() === selectedYear && d.getMonth() === exportMonth
                })
                const mExpenses = expenses.filter(e => {
                  const d = new Date(e.date)
                  return d.getFullYear() === selectedYear && d.getMonth() === exportMonth
                })
                const docs: any[] = (() => { try { return JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]') } catch { return [] } })()
                const mFactures = docs.filter((d: any) => {
                  if (d.docType !== 'facture' || d.status === 'brouillon') return false
                  const dt = new Date(d.docDate || d.savedAt)
                  return dt.getFullYear() === selectedYear && dt.getMonth() === exportMonth
                })
                const totalRevenuHT = mBookings.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
                const totalRevenuTTC = mBookings.reduce((s, b) => s + (b.price_ttc || 0), 0)
                const totalDep = mExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                return (
                  <div>
                    {/* Aperçu du mois */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-green-600">{mBookings.length}</div>
                        <div className="text-xs text-gray-500">Interventions</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-blue-600">{mFactures.length}</div>
                        <div className="text-xs text-gray-500">Factures</div>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-amber-600">{formatEur(totalRevenuHT)}</div>
                        <div className="text-xs text-gray-500">CA HT</div>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-red-500">{formatEur(totalDep)}</div>
                        <div className="text-xs text-gray-500">Dépenses</div>
                      </div>
                    </div>

                    {/* Boutons d'export */}
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => {
                        const sep = ';'
                        const lines: string[] = []
                        const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
                        // Header
                        lines.push(`EXPORT COMPTABLE - ${MONTH_FULL[exportMonth].toUpperCase()} ${selectedYear}`)
                        lines.push(`Entreprise: ${artisan?.company_name || artisan?.name || ''}`)
                        lines.push(`SIRET: ${artisan?.siret || ''}`)
                        lines.push(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`)
                        lines.push('')

                        // Section Revenus
                        lines.push('=== REVENUS (interventions terminées) ===')
                        lines.push(['Date', 'Client', 'Service', 'Montant HT', 'TVA', 'Montant TTC', 'Adresse'].join(sep))
                        mBookings.forEach(b => {
                          const client = b.notes?.match(/Client:\s*([^|.\n]+)/)?.[1]?.trim() || 'Client'
                          const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                          const tva = (b.price_ttc || 0) - ht
                          lines.push([b.booking_date, esc(client), esc(b.services?.name || ''), ht.toFixed(2), tva.toFixed(2), (b.price_ttc || 0).toFixed(2), esc(b.address || '')].join(sep))
                        })
                        lines.push(`TOTAL REVENUS${sep}${sep}${sep}${totalRevenuHT.toFixed(2)}${sep}${(totalRevenuTTC - totalRevenuHT).toFixed(2)}${sep}${totalRevenuTTC.toFixed(2)}`)
                        lines.push('')

                        // Section Factures
                        lines.push('=== FACTURES ÉMISES ===')
                        lines.push(['N° Facture', 'Date', 'Client', 'Objet', 'Montant HT', 'TVA', 'Montant TTC', 'Mode paiement'].join(sep))
                        mFactures.forEach((f: any) => {
                          const fLines: any[] = f.lines || []
                          const totalHT = fLines.reduce((s: number, l: any) => s + (l.totalHT || l.qty * l.priceHT || 0), 0)
                          const totalTVA = f.tvaEnabled ? fLines.reduce((s: number, l: any) => s + ((l.totalHT || 0) * (l.tvaRate || 0) / 100), 0) : 0
                          lines.push([esc(f.docNumber), f.docDate || '', esc(f.clientName), esc(f.docTitle), totalHT.toFixed(2), totalTVA.toFixed(2), (totalHT + totalTVA).toFixed(2), esc(f.paymentMode || '')].join(sep))
                        })
                        if (mFactures.length === 0) lines.push('Aucune facture ce mois')
                        lines.push('')

                        // Section Dépenses
                        lines.push('=== DÉPENSES ===')
                        lines.push(['Date', 'Libellé', 'Catégorie', 'Montant TTC', 'Notes'].join(sep))
                        mExpenses.forEach(e => {
                          const catLabel = EXPENSE_CATEGORIES.find(c => c.key === e.category)?.label || e.category
                          lines.push([e.date, esc(e.label), esc(catLabel), parseFloat(e.amount || 0).toFixed(2), esc(e.notes || '')].join(sep))
                        })
                        lines.push(`TOTAL DÉPENSES${sep}${sep}${sep}${totalDep.toFixed(2)}`)
                        lines.push('')

                        // Récapitulatif
                        lines.push('=== RÉCAPITULATIF ===')
                        lines.push(`CA TTC${sep}${totalRevenuTTC.toFixed(2)}`)
                        lines.push(`CA HT${sep}${totalRevenuHT.toFixed(2)}`)
                        lines.push(`TVA collectée${sep}${(totalRevenuTTC - totalRevenuHT).toFixed(2)}`)
                        lines.push(`Total dépenses${sep}${totalDep.toFixed(2)}`)
                        lines.push(`Résultat net HT${sep}${(totalRevenuHT - totalDep).toFixed(2)}`)
                        lines.push(`Cotisations URSSAF estimées (21.2%)${sep}${(totalRevenuHT * 0.212).toFixed(2)}`)
                        lines.push(`Résultat après charges${sep}${(totalRevenuHT - totalDep - totalRevenuHT * 0.212).toFixed(2)}`)

                        const csv = lines.join('\n')
                        const bom = '\uFEFF'
                        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `comptabilite-${MONTH_FULL[exportMonth].toLowerCase()}-${selectedYear}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                        className="flex items-center gap-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                        📥 Export complet (.csv)
                      </button>

                      <button onClick={() => {
                        const sep = ';'
                        const lines: string[] = []
                        const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
                        lines.push(['N° Facture', 'Date', 'Client', 'Email client', 'Objet', 'Montant HT', 'TVA', 'Montant TTC', 'Mode paiement', 'Échéance'].join(sep))
                        const docs: any[] = (() => { try { return JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]') } catch { return [] } })()
                        docs.filter((d: any) => {
                          if (d.docType !== 'facture' || d.status === 'brouillon') return false
                          const dt = new Date(d.docDate || d.savedAt)
                          return dt.getFullYear() === selectedYear && dt.getMonth() === exportMonth
                        }).forEach((f: any) => {
                          const fLines: any[] = f.lines || []
                          const totalHT = fLines.reduce((s: number, l: any) => s + (l.totalHT || l.qty * l.priceHT || 0), 0)
                          const totalTVA = f.tvaEnabled ? fLines.reduce((s: number, l: any) => s + ((l.totalHT || 0) * (l.tvaRate || 0) / 100), 0) : 0
                          lines.push([esc(f.docNumber), f.docDate || '', esc(f.clientName), esc(f.clientEmail || ''), esc(f.docTitle), totalHT.toFixed(2), totalTVA.toFixed(2), (totalHT + totalTVA).toFixed(2), esc(f.paymentMode || ''), f.paymentDue || ''].join(sep))
                        })
                        if (lines.length === 1) { lines.push('Aucune facture validée ce mois'); }
                        const bom = '\uFEFF'
                        const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `factures-${MONTH_FULL[exportMonth].toLowerCase()}-${selectedYear}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                        className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-[#FFC107] text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
                        🧾 Factures seules
                      </button>

                      <button onClick={() => {
                        const sep = ';'
                        const lines: string[] = []
                        const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
                        lines.push(['Date', 'Libellé', 'Catégorie', 'Montant TTC', 'Notes'].join(sep))
                        mExpenses.forEach(e => {
                          const catLabel = EXPENSE_CATEGORIES.find(c => c.key === e.category)?.label || e.category
                          lines.push([e.date, esc(e.label), esc(catLabel), parseFloat(e.amount || 0).toFixed(2), esc(e.notes || '')].join(sep))
                        })
                        lines.push(`TOTAL${sep}${sep}${sep}${totalDep.toFixed(2)}`)
                        const bom = '\uFEFF'
                        const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `depenses-${MONTH_FULL[exportMonth].toLowerCase()}-${selectedYear}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                        className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-[#FFC107] text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
                        💸 Dépenses seules
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 mt-3">Le fichier CSV s&apos;ouvre dans Excel, Google Sheets ou tout logiciel comptable. Encodage UTF-8 avec BOM pour les accents.</p>
                  </div>
                )
              })()}
            </div>

            {/* Action links */}
            <div className="grid sm:grid-cols-2 gap-4">
              <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer"
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                <div className="text-3xl mb-2">🏛️</div>
                <div className="font-semibold text-sm">URSSAF</div>
                <div className="text-xs text-gray-500">Déclarer votre CA</div>
              </a>
              <a href="https://www.impots.gouv.fr" target="_blank" rel="noopener noreferrer"
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                <div className="text-3xl mb-2">📋</div>
                <div className="font-semibold text-sm">impots.gouv.fr</div>
                <div className="text-xs text-gray-500">Déclaration de revenus</div>
              </a>
            </div>
          </div>
        )}

        {/* ── AGENT COMPTABLE LÉAU ── */}
        {activeComptaTab === 'assistant' && (
          <AgentComptable
            bookings={bookings}
            artisan={artisan}
            services={services}
            expenses={expenses}
            annualHT={annualHT}
            annualCA={bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === currentYear).reduce((s, b) => s + (b.price_ttc || 0), 0)}
            totalExpenses={expenses.filter(e => new Date(e.date).getFullYear() === currentYear).reduce((s, e) => s + parseFloat(e.amount || 0), 0)}
            quarterData={quarterData}
            currentMonth={currentMonth}
            currentYear={currentYear}
            formatEur={formatEur}
          />
        )}

      </div>
    </div>
  )
}
