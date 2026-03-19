'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { LeaAvatar } from '@/components/common/RobotAvatars'
import { useLocale } from '@/lib/i18n/context'
import { safeMarkdownToHTML } from '@/lib/sanitize'

/* ══════════ AGENT COMPTABLE LÉA ══════════ */

function AgentComptable({ bookings, artisan, services, expenses, annualHT, annualCA, totalExpenses, quarterData, currentMonth, currentYear, formatEur, orgRole }: {
  bookings: any[]; artisan: any; services: any[]; expenses: any[]; annualHT: number; annualCA: number; totalExpenses: number; quarterData: number[]; currentMonth: number; currentYear: number; formatEur: (v: number) => string; orgRole?: string
}) {
  const locale = useLocale()
  const isPt = locale === 'pt'
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
    // Statut juridique (micro-entrepreneur ou entreprise)
    orgRole: orgRole || 'artisan',
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

  const QUICK_QUESTIONS = isPt ? [
    { label: '🔧 Materiais vs mão de obra', q: 'Dá-me o total gasto em materiais e em mão de obra separadamente desde o início do ano, com o detalhe linha a linha.' },
    { label: '💳 Contribuições Seg. Social', q: 'Quanto vou pagar à Segurança Social este trimestre e no ano inteiro? Detalha por trimestre.' },
    { label: '📊 Resultado líquido real', q: 'Qual é o meu resultado líquido real depois de todas as despesas, contribuições SS e IRS? Faz o cálculo completo.' },
    { label: '📅 Análise do mês', q: 'Analisa as minhas receitas e despesas do mês passado: quanto faturei, gastei, e qual é o meu resultado líquido?' },
    { label: '⚠️ Regime Simplificado', q: 'Estou próximo do limite do Regime Simplificado? A que ritmo chegarei ao limite de 200.000 €?' },
    { label: '🚗 Despesas de deslocação', q: 'Quanto gastei em transporte e deslocações? Há despesas quilométricas a otimizar?' },
    { label: '🏗️ Despesas dedutíveis', q: 'Quais são todas as despesas dedutíveis específicas da construção e serviços que posso registar?' },
    { label: '📋 Preparar declaração SS/IRS', q: 'Prepara um resumo completo dos meus dados para a próxima declaração SS e Mod. 3 IRS.' },
  ] : [
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
          locale,
        }),
      })
      const data = await res.json()
      const responseText = data.response || (isPt ? 'Não foi possível gerar uma resposta. Tente novamente.' : 'Je n\'ai pas pu générer une réponse. Veuillez réessayer.')
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: isPt ? '❌ Erro de ligação. Verifique a sua ligação à internet e tente novamente.' : '❌ Erreur de connexion. Vérifiez votre connexion internet et réessayez.' }])
    }
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const formatMessage = (text: string) => safeMarkdownToHTML(text)

  return (
    <div className="flex flex-col gap-5">
      {/* Header Léa */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] p-6 rounded-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#FFC107]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-center gap-4 mb-3 relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center shadow-lg overflow-hidden">
            <LeaAvatar size={42} />
          </div>
          <div>
            <div className="text-xl font-black">{isPt ? 'Léa — A sua Contabilista IA' : 'Léa — Votre Agent Comptable IA'}</div>
            <div className="text-sm text-gray-300">{isPt ? 'Especializada em construção e serviços · Sempre disponível' : 'Spécialisée micro-entreprise · Toujours disponible'}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-300 font-medium">En ligne</span>
          </div>
        </div>
        <p className="text-sm text-gray-300 relative">
          {isPt
            ? 'Coloque-me todas as suas questões de contabilidade, fiscalidade e gestão. Analiso os seus dados financeiros reais para lhe dar respostas precisas e personalizadas.'
            : 'Posez-moi toutes vos questions de comptabilité, fiscalité et gestion. J\'analyse vos données financières réelles pour vous donner des réponses précises et personnalisées.'}
        </p>
      </div>

      {/* Financial snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(isPt ? [
          { label: 'Faturação anual c/IVA', value: formatEur(annualCA), icon: '💰', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Despesas deduzidas', value: formatEur(totalExpenses), icon: '🧾', color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Seg. Social est. (21,4%)', value: formatEur(annualHT * 0.214), icon: '🏛️', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Resultado est.', value: formatEur(annualHT * 0.786 - totalExpenses), icon: '📈', color: 'text-gray-900', bg: 'bg-amber-50' },
        ] : [
          { label: 'CA TTC annuel', value: formatEur(annualCA), icon: '💰', color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Charges déduites', value: formatEur(totalExpenses), icon: '🧾', color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'URSSAF estimé', value: formatEur(annualHT * 0.212), icon: '🏛️', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Net estimé', value: formatEur(annualHT * 0.771 - totalExpenses), icon: '📈', color: 'text-gray-900', bg: 'bg-amber-50' },
        ]).map((stat, i) => (
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center flex-shrink-0 overflow-hidden"><LeaAvatar size={26} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900">{isPt ? 'Léa — Contabilista IA' : 'Léa — Agent Comptable IA'}</div>
            <div className="text-xs text-gray-500 truncate">
              {isPt ? (
                <>Acesso a <strong className="text-gray-600">{bookings.filter(b => b.status === 'completed').length} intervenções</strong> · <strong className="text-gray-600">{expenses.length} despesas</strong> · cálculos em qualquer período</>
              ) : (
                <>Accès à <strong className="text-gray-600">{bookings.filter(b => b.status === 'completed').length} interventions</strong> · <strong className="text-gray-600">{expenses.length} dépenses</strong> · calculs sur toute période</>
              )}
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
                {isPt ? '↺ Nova conversa' : '↺ Nouveau'}
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden"><LeaAvatar size={30} /></div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[82%]">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {isPt ? (
                      <>Olá! Sou a <strong>Léa</strong>, a sua contabilista IA especializada em construção e serviços.<br /><br />
                      Tenho acesso em tempo real a <strong>todos os seus dados</strong>: cada intervenção, cada despesa com a data e categoria exatas.<br /><br />
                      Pode perguntar-me qualquer cálculo em qualquer período — por exemplo <em>&ldquo;quanto gastei em materiais de 1 de janeiro a 15 de março&rdquo;</em> e farei o cálculo linha a linha.</>
                    ) : (
                      <>Bonjour ! Je suis <strong>Léa</strong>, votre agent comptable IA spécialisée BTP.<br /><br />
                      J&apos;ai accès en temps réel à <strong>toutes vos données</strong> : chaque intervention, chaque dépense avec leur date et catégorie exactes.<br /><br />
                      Vous pouvez me demander n&apos;importe quel calcul sur n&apos;importe quelle période — par exemple <em>&ldquo;combien j&apos;ai dépensé en matériaux du 1er janvier au 15 mars&rdquo;</em> et je ferai le calcul ligne par ligne.</>
                    )}
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
                    {msg.role === 'assistant' ? <LeaAvatar size={22} /> : '👤'}
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
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center flex-shrink-0 overflow-hidden"><LeaAvatar size={30} /></div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">{isPt ? 'Léa está a analisar os seus dados' : 'Léa analyse vos données'}</span>
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
            {(isPt ? [
              { label: '🔧 Materiais', q: 'Total gasto em materiais este ano, detalhe linha a linha?' },
              { label: '👷 Mão de obra', q: 'Total gasto em mão de obra e subempreiteiros este ano?' },
              { label: '📆 Este mês', q: 'Resultado líquido do mês em curso: receitas menos despesas menos contribuições?' },
              { label: '💳 SS trimestre atual', q: 'Quanto devo pagar à Segurança Social no trimestre atual?' },
              { label: '📊 Por serviço', q: 'Qual é a minha faturação por tipo de intervenção este ano?' },
              { label: '🧾 Top despesas', q: 'Quais são as minhas 5 maiores despesas do ano?' },
            ] : [
              { label: '🔧 Matériaux', q: 'Total dépensé en matériaux cette année, détail ligne par ligne ?' },
              { label: '👷 Main d\'œuvre', q: 'Total dépensé en main d\'œuvre et sous-traitance cette année ?' },
              { label: '📆 Ce mois', q: 'Résultat net du mois en cours : revenus moins charges moins cotisations ?' },
              { label: '💳 URSSAF T en cours', q: 'Combien je dois payer à l\'URSSAF pour le trimestre en cours ?' },
              { label: '📊 Par service', q: 'Quel est mon chiffre d\'affaires par type d\'intervention cette année ?' },
              { label: '🧾 Top dépenses', q: 'Quelles sont mes 5 plus grosses dépenses de l\'année ?' },
            ]).map((s, i) => (
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
            placeholder={isPt
              ? 'Coloque a sua questão à Léa...\nEx: "Quanto gastei em materiais de janeiro a março?"\nEx: "Qual é o meu resultado líquido no 2.º trimestre?"'
              : 'Posez votre question à Léa...\nEx: "Combien j\'ai dépensé en matériaux de janvier à mars ?"\nEx: "Quel est mon bénéfice net sur le 2e trimestre ?"'}
            rows={3}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] bg-gray-50 resize-none"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="bg-[#FFC107] hover:bg-[#FFD54F] disabled:opacity-40 text-gray-900 px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex-shrink-0 self-end"
          >
            {isLoading ? '⏳' : isPt ? '↑ Enviar' : '↑ Envoyer'}
          </button>
        </div>
        <div className="px-4 pb-3 text-[10px] text-gray-300 text-center">
          {isPt ? 'Enter = enviar · Shift+Enter = nova linha' : 'Entrée = envoyer · Maj+Entrée = saut de ligne'}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-500 text-center">
        {isPt
          ? 'ℹ️ Léa fornece informações indicativas baseadas nos seus dados Fixit. Para aconselhamento fiscal vinculativo, consulte um TOC/ROC certificado.'
          : 'ℹ️ Léa fournit des informations indicatives basées sur vos données Vitfix. Pour des conseils fiscaux engageant votre responsabilité, consultez un expert-comptable agréé.'}
      </div>
    </div>
  )
}

/* ══════════ COMPTABILITÉ SECTION ══════════ */

export default function ComptabiliteSection({ bookings, artisan, services, orgRole }: { bookings: any[]; artisan: any; services: any[]; orgRole?: string }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dateFmtLocale = isPt ? 'pt-PT' : 'fr-FR'
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

  const MONTH_NAMES = isPt
    ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    : ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
  const MONTH_FULL = isPt
    ? ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const EXPENSE_CATEGORIES = isPt ? [
    { key: 'materiel', label: 'Materiais & fornecimentos de obra', icon: '🔧' },
    { key: 'mainoeuvre', label: 'Mão de obra & subempreiteiros', icon: '👷' },
    { key: 'transport', label: 'Transporte & combustível', icon: '🚗' },
    { key: 'outillage', label: 'Ferramentas & equipamentos', icon: '🛠️' },
    { key: 'assurance', label: 'Seguros (RC Prof., responsabilidade…)', icon: '🛡️' },
    { key: 'formation', label: 'Formação & certificações', icon: '📚' },
    { key: 'logiciel', label: 'Software & subscrições', icon: '💻' },
    { key: 'telephone', label: 'Telefone & internet', icon: '📱' },
    { key: 'comptable', label: 'Contabilista (TOC/ROC) & jurídico', icon: '🧮' },
    { key: 'publicite', label: 'Publicidade & marketing', icon: '📣' },
    { key: 'bureau', label: 'Despesas de escritório', icon: '🏢' },
    { key: 'autre', label: 'Outras despesas', icon: '📦' },
  ] : [
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
  const quarterLabels = isPt
    ? ['T1 (Jan-Mar)', 'T2 (Abr-Jun)', 'T3 (Jul-Set)', 'T4 (Out-Dez)']
    : ['T1 (Jan-Mars)', 'T2 (Avr-Juin)', 'T3 (Juil-Sept)', 'T4 (Oct-Déc)']
  const quarterData = [0, 1, 2, 3].map(q => {
    const qb = bookings.filter(b => {
      if (!b.booking_date || b.status !== 'completed') return false
      const d = new Date(b.booking_date)
      return d.getFullYear() === selectedYear && Math.floor(d.getMonth() / 3) === q
    })
    return qb.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
  })

  const annualHT = quarterData.reduce((s, v) => s + v, 0)
  // PT: Regime Simplificado threshold €200k; FR: micro-entrepreneur €77,700
  const isAutoEntrepreneur = isPt ? annualHT < 200000 : annualHT < 77700
  // PT: Segurança Social trabalhador independente 21.4% on rendimento relevante (70% services)
  // FR: URSSAF micro-entrepreneur artisan BTP 21.2%
  const tauxCotisation = isPt ? 0.214 : 0.212
  const cotisationsSociales = isPt
    ? annualHT * 0.70 * tauxCotisation   // SS calcula sobre rendimento relevante (70%)
    : annualHT * tauxCotisation
  // PT: IRS retenção na fonte 25% (art.º 101.º CIRS, cat. B — regra geral); FR: IR libératoire 1.1%
  const impotRevenu = isPt ? annualHT * 0.25 : annualHT * 0.011
  const resultatApresCharges = annualHT - cotisationsSociales

  const formatEur = (v: number) => new Intl.NumberFormat(dateFmtLocale, { style: 'currency', currency: 'EUR' }).format(v)

  return (
    <div className="animate-fadeIn">
      <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold leading-tight">{isPt ? '🧮 Contabilidade & Fiscalidade' : '🧮 Comptabilité & Fiscalité'}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{isPt ? 'Gestão contabilística e agente IA Léa' : 'Gestion comptable et agent IA Léa'}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-[#FFC107]">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex bg-gray-100 rounded-lg overflow-hidden">
            {(['mois', 'trimestre', 'annee'] as const).map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${selectedPeriod === p ? 'bg-[#FFC107] text-gray-900' : 'text-gray-500 hover:bg-gray-200'}`}>
                {isPt
                  ? (p === 'mois' ? 'Mês' : p === 'trimestre' ? 'Trimestre' : 'Ano')
                  : (p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année')}
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
          {(isPt ? ([
            { key: 'dashboard' as const, label: '📊 Painel' },
            { key: 'revenus' as const, label: '💰 Receitas' },
            { key: 'depenses' as const, label: '🧾 Despesas' },
            { key: 'declaration' as const, label: '🏛️ Declarações' },
            { key: 'assistant' as const, label: '🤖 Assistente IA' },
          ]) : ([
            { key: 'dashboard' as const, label: '📊 Tableau de bord' },
            { key: 'revenus' as const, label: '💰 Revenus' },
            { key: 'depenses' as const, label: '🧾 Dépenses' },
            { key: 'declaration' as const, label: '🏛️ Déclaration' },
            { key: 'assistant' as const, label: '🤖 Assistant IA' },
          ])).map(t => (
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
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{isPt ? 'Faturação c/IVA' : 'Chiffre d\'affaires TTC'}</div>
                <div className="text-3xl font-black text-green-600">{formatEur(chiffreAffaires)}</div>
                <div className="text-xs text-gray-500 mt-1">{completedFiltered.length} {isPt ? 'intervenção(ões)' : 'intervention(s)'}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{isPt ? 'Faturação s/IVA' : 'CA Hors Taxes'}</div>
                <div className="text-3xl font-black text-blue-600">{formatEur(chiffreAffairesHT)}</div>
                <div className="text-xs text-gray-500 mt-1">{isPt ? 'IVA' : 'TVA'} : {formatEur(tvaCollectee)}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-400">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{isPt ? 'Despesas dedutíveis' : 'Charges déductibles'}</div>
                <div className="text-3xl font-black text-red-500">{formatEur(totalExpenses)}</div>
                <div className="text-xs text-gray-500 mt-1">{filteredExpenses.length} {isPt ? 'despesa(s)' : 'dépense(s)'}</div>
              </div>
              <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${resultatNet >= 0 ? 'border-[#FFC107]' : 'border-red-500'}`}>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{isPt ? 'Resultado líquido' : 'Résultat net'}</div>
                <div className={`text-3xl font-black ${resultatNet >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{formatEur(resultatNet)}</div>
                <div className="text-xs text-gray-500 mt-1">{isPt ? 'antes de impostos' : 'avant impôts'}</div>
              </div>
            </div>

            {/* Revenue chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
              <h3 className="font-bold text-lg mb-5">{isPt ? `📈 Evolução da faturação mensal ${selectedYear}` : `📈 Évolution du CA mensuel ${selectedYear}`}</h3>
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
                <div className="font-bold text-green-800 mb-2">✅ {isPt ? 'Estatuto fiscal' : 'Statut fiscal'}</div>
                <div className="text-sm text-green-700">
                  {isPt
                    ? (isAutoEntrepreneur ? 'Regime Simplificado (Recibos Verdes)' : '⚠️ Ultrapassou o limite!')
                    : (isAutoEntrepreneur ? 'Micro-entrepreneur' : 'Dépassement plafond !')}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {isPt ? 'Faturação anual' : 'CA annuel'} : {formatEur(bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear).reduce((s, b) => s + (b.price_ht || 0), 0))}
                  {' / '}{isPt ? '200 000 €' : '77 700 €'}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl">
                <div className="font-bold text-blue-800 mb-2">{isPt ? '💳 Contrib. estimadas' : '💳 Cotisations estimées'}</div>
                <div className="text-2xl font-black text-blue-700">{formatEur(cotisationsSociales)}</div>
                <div className="text-xs text-blue-600 mt-1">{isPt ? '21,4% SS sobre rend. relevante (70%)' : '21,7% du CA HT annuel'}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                <div className="font-bold text-amber-800 mb-2">📋 {isPt ? 'Próxima declaração' : 'Prochaine déclaration'}</div>
                <div className="text-sm text-amber-700 font-semibold">
                  {isPt ? (() => {
                    const q = Math.floor(currentMonth / 3)
                    const dates = ['15 Mai (IVA T1)', '15 Ago (IVA T2)', '15 Nov (IVA T3)', '15 Fev (IVA T4)']
                    return dates[q] || 'Ver calendário'
                  })() : (() => {
                    const q = Math.floor(currentMonth / 3)
                    const dates = ['30 Avril', '31 Juillet', '31 Oct', '31 Jan']
                    return dates[q] || 'Voir calendrier'
                  })()}
                </div>
                <div className="text-xs text-amber-600 mt-1">{isPt ? 'Declaração Periódica IVA (trimestral)' : 'Déclaration URSSAF trimestrielle'}</div>
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
                  {isPt ? '💰 Receitas — ' : '💰 Revenus — '}{selectedPeriod === 'mois' ? MONTH_FULL[selectedMonth] : selectedPeriod === 'trimestre' ? quarterLabels[getQuarter()] : selectedYear}
                </h3>
                <div className="flex gap-6 mt-3">
                  <div><span className="text-2xl font-black text-green-600">{formatEur(chiffreAffaires)}</span><span className="text-xs text-gray-500 ml-1">{isPt ? 'c/IVA' : 'TTC'}</span></div>
                  <div><span className="text-2xl font-black text-blue-500">{formatEur(chiffreAffairesHT)}</span><span className="text-xs text-gray-500 ml-1">{isPt ? 's/IVA' : 'HT'}</span></div>
                  <div><span className="text-2xl font-black text-gray-500">{formatEur(tvaCollectee)}</span><span className="text-xs text-gray-500 ml-1">{isPt ? 'IVA 23%' : 'TVA 20%'}</span></div>
                </div>
              </div>
              {completedFiltered.length === 0 ? (
                <div className="p-10 text-center text-gray-500">{isPt ? 'Nenhuma intervenção concluída neste período' : 'Aucune intervention terminée sur cette période'}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold">Data</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold">{isPt ? 'Cliente / Serviço' : 'Client / Service'}</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">{isPt ? 's/IVA' : 'HT'}</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">{isPt ? 'IVA' : 'TVA'}</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold">{isPt ? 'c/IVA' : 'TTC'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedFiltered.sort((a, b) => b.booking_date.localeCompare(a.booking_date)).map(b => {
                      const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                      const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                      const tva = (b.price_ttc || 0) - ht
                      return (
                        <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-500">{new Date(b.booking_date).toLocaleDateString(dateFmtLocale)}</td>
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
                      <td colSpan={2} className="px-5 py-3 font-bold">{isPt ? 'TOTAL' : 'TOTAL'}</td>
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
                <h3 className="font-bold mb-4">{isPt ? `🔧 Faturação por serviço (${selectedYear})` : `🔧 CA par motif (${selectedYear})`}</h3>
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
                <h3 className="font-bold text-lg">{isPt ? '🧾 Despesas dedutíveis' : '🧾 Charges déductibles'}</h3>
                <p className="text-sm text-gray-500">{isPt ? 'Total' : 'Total'} : <span className="font-bold text-red-500">{formatEur(totalExpenses)}</span></p>
              </div>
              <button onClick={() => setShowAddExpense(true)}
                className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-xl font-semibold shadow-sm text-sm transition-all">
                {isPt ? '+ Adicionar despesa' : '+ Ajouter une charge'}
              </button>
            </div>

            {showAddExpense && (
              <div className="bg-white border-2 border-[#FFC107] p-6 rounded-2xl mb-5">
                <h4 className="font-bold mb-4">{isPt ? 'Nova despesa dedutível' : 'Nouvelle charge déductible'}</h4>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">{isPt ? 'Descrição *' : 'Libellé *'}</label>
                    <input value={expenseForm.label} onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                      placeholder={isPt ? 'Ex: Compra de parafusos e buchas' : 'Ex: Achat vis et boulons'} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">{isPt ? 'Montante c/IVA (€) *' : 'Montant TTC (€) *'}</label>
                    <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">{isPt ? 'Categoria' : 'Catégorie'}</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Data</label>
                    <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 block mb-1">{isPt ? 'Notas (opcional)' : 'Notes (optionnel)'}</label>
                    <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder={isPt ? 'Número de fatura, fornecedor...' : 'Numéro de facture, fournisseur...'} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddExpense(false)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">{isPt ? 'Cancelar' : 'Annuler'}</button>
                  <button onClick={saveExpense} disabled={!expenseForm.label || !expenseForm.amount}
                    className="flex-1 bg-[#FFC107] text-gray-900 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">{isPt ? 'Guardar' : 'Enregistrer'}</button>
                </div>
              </div>
            )}

            {/* Breakdown by category */}
            {expenseByCategory.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-sm mb-5">
                <h4 className="font-semibold mb-4">{isPt ? 'Distribuição por categoria' : 'Répartition par catégorie'}</h4>
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
                {isPt ? `Lista de despesas (${filteredExpenses.length})` : `Liste des charges (${filteredExpenses.length})`}
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <div className="text-4xl mb-3">🧾</div>
                  <div>{isPt ? 'Nenhuma despesa registada neste período' : 'Aucune charge enregistrée sur cette période'}</div>
                  <button onClick={() => setShowAddExpense(true)} className="mt-3 text-[#FFC107] font-semibold text-sm">{isPt ? '+ Adicionar despesa' : '+ Ajouter une charge'}</button>
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
                          <div className="text-xs text-gray-500">{cat?.label} · {new Date(e.date).toLocaleDateString(dateFmtLocale)}</div>
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
                  {isPt
                    ? (isAutoEntrepreneur ? 'Regime Simplificado (Trabalhador Independente / Recibos Verdes)' : '⚠️ Atenção: Limite de Regime Simplificado ultrapassado')
                    : (isAutoEntrepreneur ? 'Régime Micro-Entrepreneur (Auto-entrepreneur)' : '⚠️ Attention : Dépassement de plafond possible')}
                </div>
                <div className={`text-sm mt-1 ${isAutoEntrepreneur ? 'text-green-700' : 'text-red-600'}`}>
                  {isPt
                    ? (isAutoEntrepreneur
                        ? `Faturação anual s/IVA estimada: ${formatEur(annualHT)} sobre ${formatEur(200000)} de limite autorizado`
                        : `A sua faturação ultrapassa os 200 000 €. Consulte um TOC/ROC para mudança para contabilidade organizada.`)
                    : (isAutoEntrepreneur
                        ? `CA HT annuel estimé : ${formatEur(annualHT)} sur ${formatEur(77700)} de plafond autorisé`
                        : `Votre CA dépasse le seuil de 77 700 €. Consultez un expert-comptable pour le passage en régime réel.`)}
                </div>
              </div>
            </div>

            {/* Quarterly declaration */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-5">
                {isPt ? `📋 Declarações trimestrais ${selectedYear}` : `📋 Déclarations URSSAF trimestrielles ${selectedYear}`}
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {quarterData.map((ca, q) => {
                  // PT: IVA declaração até dia 15 do 2.º mês após o trimestre; SS declaração trimestral em jan/abr/jul/out
                  const deadlineIVA = isPt
                    ? ['15 maio', '15 agosto', '15 novembro', '15 fevereiro'][q]
                    : ['30 avril', '31 juillet', '31 octobre', '31 janvier'][q]
                  const deadlineSS = isPt
                    ? ['Janeiro', 'Abril', 'Julho', 'Outubro'][q]
                    : null
                  // PT: SS sobre rendimento relevante (70% do CA s/IVA)
                  const cotis = isPt ? ca * 0.70 * tauxCotisation : ca * tauxCotisation
                  const isPast = (q < Math.floor(currentMonth / 3)) && selectedYear <= currentYear
                  return (
                    <div key={q} className={`p-5 rounded-xl border-2 ${isPast ? 'border-gray-200 bg-gray-50' : 'border-[#FFC107] bg-amber-50'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-bold text-gray-900">{quarterLabels[q]}</div>
                        {isPast && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">{isPt ? 'Passado' : 'Passé'}</span>}
                        {!isPast && <span className="text-xs bg-[#FFC107] text-gray-900 px-2 py-0.5 rounded-full font-semibold">{isPt ? 'A declarar' : 'À déclarer'}</span>}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{isPt ? 'Faturação s/IVA' : 'CA HT réalisé'}</span>
                          <span className="font-bold">{formatEur(ca)}</span>
                        </div>
                        {isPt && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rend. relevante (70%)</span>
                            <span className="font-bold">{formatEur(ca * 0.70)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-500">{isPt ? 'Seg. Social (21,4%)' : 'Cotisations (21,7%)'}</span>
                          <span className="font-bold text-red-500">{formatEur(cotis)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold">
                          <span>{isPt ? 'A pagar' : 'À payer'}</span>
                          <span className="text-red-600">{formatEur(cotis)}</span>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                        <div>⏰ {isPt ? 'IVA (décl. periódica)' : 'Délai'} : {deadlineIVA}</div>
                        {isPt && deadlineSS && (
                          <div>📋 SS (décl. trimestral) : {deadlineSS} | Pagamento: dia 20/mês</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Annual summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-lg mb-5">📊 {isPt ? `Resumo anual ${selectedYear}` : `Récapitulatif annuel ${selectedYear}`}</h3>
              <div className="space-y-3">
                {(isPt ? [
                  { label: 'Faturação c/IVA', value: chiffreAffaires + (bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear && filteredBookings.indexOf(b) === -1).reduce((s, b) => s + (b.price_ttc || 0), 0)), color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Faturação s/IVA (declarável)', value: annualHT, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Seg. Social (21,4% × 70%)', value: -cotisationsSociales, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'IRS retido na fonte (25% art.º 101.º CIRS)', value: -impotRevenu, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Resultado líquido estimado', value: resultatApresCharges - impotRevenu, color: 'text-gray-900', bg: 'bg-gray-50', bold: true },
                ] : [
                  { label: 'Chiffre d\'affaires TTC', value: chiffreAffaires + (bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear && filteredBookings.indexOf(b) === -1).reduce((s, b) => s + (b.price_ttc || 0), 0)), color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'CA Hors Taxes (déclarable)', value: annualHT, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Cotisations sociales URSSAF (21,7%)', value: -cotisationsSociales, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Prélèvement libératoire IR (1,1%)', value: -impotRevenu, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Résultat net estimé', value: resultatApresCharges - impotRevenu, color: 'text-gray-900', bg: 'bg-gray-50', bold: true },
                ]).map((row, i) => (
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
              <h3 className="font-bold text-lg mb-2">{isPt ? '📤 Exportação contabilística mensal' : '📤 Export comptable mensuel'}</h3>
              <p className="text-sm text-gray-500 mb-5">{isPt ? 'Gere um ficheiro CSV completo para o seu TOC/ROC: receitas, faturas, despesas e resumo do mês selecionado.' : 'Générez un fichier CSV complet pour votre comptable : revenus, factures, dépenses et récapitulatif du mois sélectionné.'}</p>

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
                    {/* Aperçu du mois / Resumo do mês */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-green-600">{mBookings.length}</div>
                        <div className="text-xs text-gray-500">{isPt ? 'Intervenções' : 'Interventions'}</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-blue-600">{mFactures.length}</div>
                        <div className="text-xs text-gray-500">{isPt ? 'Faturas' : 'Factures'}</div>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-amber-600">{formatEur(totalRevenuHT)}</div>
                        <div className="text-xs text-gray-500">{isPt ? 'Faturação s/IVA' : 'CA HT'}</div>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-black text-red-500">{formatEur(totalDep)}</div>
                        <div className="text-xs text-gray-500">{isPt ? 'Despesas' : 'Dépenses'}</div>
                      </div>
                    </div>

                    {/* Boutons d'export */}
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => {
                        const sep = ';'
                        const lines: string[] = []
                        const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
                        // Header
                        lines.push(`${isPt ? 'EXPORTAÇÃO CONTABILÍSTICA' : 'EXPORT COMPTABLE'} - ${MONTH_FULL[exportMonth].toUpperCase()} ${selectedYear}`)
                        lines.push(`${isPt ? 'Empresa' : 'Entreprise'}: ${artisan?.company_name || artisan?.name || ''}`)
                        lines.push(`${isPt ? 'NIF' : 'SIRET'}: ${artisan?.siret || ''}`)
                        lines.push(`${isPt ? 'Gerado em' : 'Généré le'}: ${new Date().toLocaleDateString(dateFmtLocale)}`)
                        lines.push('')

                        // Section Revenus / Receitas
                        lines.push(isPt ? '=== RECEITAS (intervenções concluídas) ===' : '=== REVENUS (interventions terminées) ===')
                        lines.push((isPt ? ['Data', 'Cliente', 'Serviço', 'Montante s/IVA', 'IVA', 'Montante c/IVA', 'Endereço'] : ['Date', 'Client', 'Service', 'Montant HT', 'TVA', 'Montant TTC', 'Adresse']).join(sep))
                        mBookings.forEach(b => {
                          const client = b.notes?.match(/Client:\s*([^|.\n]+)/)?.[1]?.trim() || 'Client'
                          const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                          const tva = (b.price_ttc || 0) - ht
                          lines.push([b.booking_date, esc(client), esc(b.services?.name || ''), ht.toFixed(2), tva.toFixed(2), (b.price_ttc || 0).toFixed(2), esc(b.address || '')].join(sep))
                        })
                        lines.push(`${isPt ? 'TOTAL RECEITAS' : 'TOTAL REVENUS'}${sep}${sep}${sep}${totalRevenuHT.toFixed(2)}${sep}${(totalRevenuTTC - totalRevenuHT).toFixed(2)}${sep}${totalRevenuTTC.toFixed(2)}`)
                        lines.push('')

                        // Section Factures / Faturas
                        lines.push(isPt ? '=== FATURAS EMITIDAS ===' : '=== FACTURES ÉMISES ===')
                        lines.push((isPt ? ['N.º Fatura', 'Data', 'Cliente', 'Objeto', 'Montante s/IVA', 'IVA', 'Montante c/IVA', 'Modo pagamento'] : ['N° Facture', 'Date', 'Client', 'Objet', 'Montant HT', 'TVA', 'Montant TTC', 'Mode paiement']).join(sep))
                        mFactures.forEach((f: any) => {
                          const fLines: any[] = f.lines || []
                          const totalHT = fLines.reduce((s: number, l: any) => s + (l.totalHT || l.qty * l.priceHT || 0), 0)
                          const totalTVA = f.tvaEnabled ? fLines.reduce((s: number, l: any) => s + ((l.totalHT || 0) * (l.tvaRate || 0) / 100), 0) : 0
                          lines.push([esc(f.docNumber), f.docDate || '', esc(f.clientName), esc(f.docTitle), totalHT.toFixed(2), totalTVA.toFixed(2), (totalHT + totalTVA).toFixed(2), esc(f.paymentMode || '')].join(sep))
                        })
                        if (mFactures.length === 0) lines.push(isPt ? 'Nenhuma fatura este mês' : 'Aucune facture ce mois')
                        lines.push('')

                        // Section Dépenses / Despesas
                        lines.push(isPt ? '=== DESPESAS ===' : '=== DÉPENSES ===')
                        lines.push((isPt ? ['Data', 'Descrição', 'Categoria', 'Montante c/IVA', 'Notas'] : ['Date', 'Libellé', 'Catégorie', 'Montant TTC', 'Notes']).join(sep))
                        mExpenses.forEach(e => {
                          const catLabel = EXPENSE_CATEGORIES.find(c => c.key === e.category)?.label || e.category
                          lines.push([e.date, esc(e.label), esc(catLabel), parseFloat(e.amount || 0).toFixed(2), esc(e.notes || '')].join(sep))
                        })
                        lines.push(`${isPt ? 'TOTAL DESPESAS' : 'TOTAL DÉPENSES'}${sep}${sep}${sep}${totalDep.toFixed(2)}`)
                        lines.push('')

                        // Récapitulatif / Resumo
                        lines.push(isPt ? '=== RESUMO ===' : '=== RÉCAPITULATIF ===')
                        lines.push(`${isPt ? 'Faturação c/IVA' : 'CA TTC'}${sep}${totalRevenuTTC.toFixed(2)}`)
                        lines.push(`${isPt ? 'Faturação s/IVA' : 'CA HT'}${sep}${totalRevenuHT.toFixed(2)}`)
                        lines.push(`${isPt ? 'IVA liquidado' : 'TVA collectée'}${sep}${(totalRevenuTTC - totalRevenuHT).toFixed(2)}`)
                        lines.push(`${isPt ? 'Total despesas' : 'Total dépenses'}${sep}${totalDep.toFixed(2)}`)
                        lines.push(`${isPt ? 'Resultado líquido s/IVA' : 'Résultat net HT'}${sep}${(totalRevenuHT - totalDep).toFixed(2)}`)
                        if (isPt) {
                          lines.push(`Seg. Social estimada (21,4% × 70%)${sep}${(totalRevenuHT * 0.70 * 0.214).toFixed(2)}`)
                          lines.push(`Resultado após contribuições${sep}${(totalRevenuHT - totalDep - totalRevenuHT * 0.70 * 0.214).toFixed(2)}`)
                        } else {
                          lines.push(`Cotisations URSSAF estimées (21.2%)${sep}${(totalRevenuHT * 0.212).toFixed(2)}`)
                          lines.push(`Résultat après charges${sep}${(totalRevenuHT - totalDep - totalRevenuHT * 0.212).toFixed(2)}`)
                        }

                        const csv = lines.join('\n')
                        const bom = '\uFEFF'
                        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${isPt ? 'contabilidade' : 'comptabilite'}-${MONTH_FULL[exportMonth].toLowerCase()}-${selectedYear}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                        className="flex items-center gap-2 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm">
                        {isPt ? '📥 Exportação completa (.csv)' : '📥 Export complet (.csv)'}
                      </button>

                      <button onClick={() => {
                        const sep = ';'
                        const lines: string[] = []
                        const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
                        lines.push((isPt ? ['N.º Fatura', 'Data', 'Cliente', 'Email cliente', 'Objeto', 'Montante s/IVA', 'IVA', 'Montante c/IVA', 'Modo pagamento', 'Prazo pagamento'] : ['N° Facture', 'Date', 'Client', 'Email client', 'Objet', 'Montant HT', 'TVA', 'Montant TTC', 'Mode paiement', 'Échéance']).join(sep))
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
                        if (lines.length === 1) { lines.push(isPt ? 'Nenhuma fatura validada este mês' : 'Aucune facture validée ce mois'); }
                        const bom = '\uFEFF'
                        const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${isPt ? 'faturas' : 'factures'}-${MONTH_FULL[exportMonth].toLowerCase()}-${selectedYear}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                        className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-[#FFC107] text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
                        {isPt ? '🧾 Faturas apenas' : '🧾 Factures seules'}
                      </button>

                      <button onClick={() => {
                        const sep = ';'
                        const lines: string[] = []
                        const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
                        lines.push((isPt ? ['Data', 'Descrição', 'Categoria', 'Montante c/IVA', 'Notas'] : ['Date', 'Libellé', 'Catégorie', 'Montant TTC', 'Notes']).join(sep))
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
                        a.download = `${isPt ? 'despesas' : 'depenses'}-${MONTH_FULL[exportMonth].toLowerCase()}-${selectedYear}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                        className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-[#FFC107] text-gray-700 px-5 py-2.5 rounded-xl font-semibold text-sm transition">
                        {isPt ? '💸 Despesas apenas' : '💸 Dépenses seules'}
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 mt-3">{isPt ? 'O ficheiro CSV abre no Excel, Google Sheets ou qualquer software contabilístico. Codificação UTF-8 com BOM para acentos.' : 'Le fichier CSV s\'ouvre dans Excel, Google Sheets ou tout logiciel comptable. Encodage UTF-8 avec BOM pour les accents.'}</p>
                  </div>
                )
              })()}
            </div>

            {/* Action links */}
            {isPt ? (
              <div className="grid sm:grid-cols-3 gap-4">
                <a href="https://www.portaldasfinancas.gov.pt" target="_blank" rel="noopener noreferrer"
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                  <div className="text-3xl mb-2">🏛️</div>
                  <div className="font-semibold text-sm">Portal das Finanças (AT)</div>
                  <div className="text-xs text-gray-500">Declaração IVA & IRS Mod.3</div>
                </a>
                <a href="https://www.seg-social.pt" target="_blank" rel="noopener noreferrer"
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                  <div className="text-3xl mb-2">🛡️</div>
                  <div className="font-semibold text-sm">Segurança Social Direta</div>
                  <div className="text-xs text-gray-500">Contribuições SS trimestral</div>
                </a>
                <a href="https://www.e-fatura.pt" target="_blank" rel="noopener noreferrer"
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:-translate-y-1 transition-transform cursor-pointer text-center">
                  <div className="text-3xl mb-2">🧾</div>
                  <div className="font-semibold text-sm">e-Fatura</div>
                  <div className="text-xs text-gray-500">Comunicação faturas à AT</div>
                </a>
              </div>
            ) : (
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
            )}
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
