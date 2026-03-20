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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Léa */}
      <div className="v22-card" style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff', position: 'relative', overflow: 'hidden', padding: '20px' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 160, height: 160, background: 'rgba(255,193,7,0.1)', borderRadius: '50%', transform: 'translate(50%,-50%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px', position: 'relative' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <LeaAvatar size={36} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{isPt ? 'Léa — A sua Contabilista IA' : 'Léa — Votre Agent Comptable IA'}</div>
            <div style={{ fontSize: 12, color: '#ccc' }}>{isPt ? 'Especializada em construção e serviços · Sempre disponível' : 'Spécialisée micro-entreprise · Toujours disponible'}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: '#86efac', fontWeight: 500 }}>En ligne</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#ccc', position: 'relative', margin: 0, lineHeight: 1.5 }}>
          {isPt
            ? 'Coloque-me todas as suas questões de contabilidade, fiscalidade e gestão. Analiso os seus dados financeiros reais para lhe dar respostas precisas e personalizadas.'
            : 'Posez-moi toutes vos questions de comptabilité, fiscalité et gestion. J\'analyse vos données financières réelles pour vous donner des réponses précises et personnalisées.'}
        </p>
      </div>

      {/* Financial snapshot */}
      <div className="v22-stats">
        {(isPt ? [
          { label: 'Faturação anual c/IVA', value: formatEur(annualCA), icon: '💰', variant: 'green' },
          { label: 'Despesas deduzidas', value: formatEur(totalExpenses), icon: '🧾', variant: 'red' },
          { label: 'Seg. Social est. (21,4%)', value: formatEur(annualHT * 0.214), icon: '🏛️', variant: '' },
          { label: 'Resultado est.', value: formatEur(annualHT * 0.786 - totalExpenses), icon: '📈', variant: 'yellow' },
        ] : [
          { label: 'CA TTC annuel', value: formatEur(annualCA), icon: '💰', variant: 'green' },
          { label: 'Charges déduites', value: formatEur(totalExpenses), icon: '🧾', variant: 'red' },
          { label: 'URSSAF estimé', value: formatEur(annualHT * 0.212), icon: '🏛️', variant: '' },
          { label: 'Net estimé', value: formatEur(annualHT * 0.771 - totalExpenses), icon: '📈', variant: 'yellow' },
        ]).map((stat, i) => (
          <div key={i} className={`v22-stat ${stat.variant === 'yellow' ? 'v22-stat-yellow' : ''}`}
            style={stat.variant === 'green' ? { background: 'var(--v22-green-light)' } : stat.variant === 'red' ? { background: 'var(--v22-red-light)' } : undefined}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{stat.icon}</div>
            <div className="v22-stat-val" style={stat.variant === 'green' ? { color: 'var(--v22-green)' } : stat.variant === 'red' ? { color: 'var(--v22-red)' } : undefined}>{stat.value}</div>
            <div className="v22-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="v22-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 500, padding: 0 }}>

        {/* Chat header */}
        <div style={{ borderBottom: '1px solid var(--v22-border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--v22-bg)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}><LeaAvatar size={22} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v22-text)' }}>{isPt ? 'Léa — Contabilista IA' : 'Léa — Agent Comptable IA'}</div>
            <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isPt ? (
                <>Acesso a <strong style={{ color: 'var(--v22-text-mid)' }}>{bookings.filter(b => b.status === 'completed').length} intervenções</strong> · <strong style={{ color: 'var(--v22-text-mid)' }}>{expenses.length} despesas</strong> · cálculos em qualquer período</>
              ) : (
                <>Accès à <strong style={{ color: 'var(--v22-text-mid)' }}>{bookings.filter(b => b.status === 'completed').length} interventions</strong> · <strong style={{ color: 'var(--v22-text-mid)' }}>{expenses.length} dépenses</strong> · calculs sur toute période</>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: 'var(--v22-green)', fontWeight: 500 }}>En ligne</span>
            </div>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setChatStarted(false) }}
                className="v22-btn v22-btn-sm">
                {isPt ? '↺ Nova conversa' : '↺ Nouveau'}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, maxHeight: 420, minHeight: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!chatStarted ? (
            <div style={{ paddingTop: 12 }}>
              {/* Welcome */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}><LeaAvatar size={26} /></div>
                <div style={{ background: 'var(--v22-bg)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', maxWidth: '82%' }}>
                  <p style={{ fontSize: 13, color: 'var(--v22-text)', lineHeight: 1.6, margin: 0 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUICK_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q.q)}
                    className="v22-btn" style={{ textAlign: 'left', fontSize: 11, background: 'var(--v22-amber-light)', border: '1px solid var(--v22-yellow-border)', color: '#7A6000', padding: '8px 12px', lineHeight: 1.4, fontWeight: 500 }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
                    background: msg.role === 'assistant' ? 'linear-gradient(135deg, #FFC107, #FFD54F)' : '#2C3E50',
                    color: msg.role === 'user' ? '#fff' : undefined,
                  }}>
                    {msg.role === 'assistant' ? <LeaAvatar size={20} /> : '👤'}
                  </div>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
                    borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                    background: msg.role === 'user' ? 'var(--v22-yellow)' : 'var(--v22-bg)',
                    color: 'var(--v22-text)',
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}><LeaAvatar size={26} /></div>
                  <div style={{ background: 'var(--v22-bg)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginRight: 4 }}>{isPt ? 'Léa está a analisar os seus dados' : 'Léa analyse vos données'}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--v22-text-muted)', animation: 'bounce 1s infinite', animationDelay: '0ms' }} />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--v22-text-muted)', animation: 'bounce 1s infinite', animationDelay: '150ms' }} />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--v22-text-muted)', animation: 'bounce 1s infinite', animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Suggestions rapides pendant le chat */}
        {chatStarted && (
          <div style={{ padding: '8px 14px', display: 'flex', gap: 8, overflowX: 'auto', borderTop: '1px solid var(--v22-border)' }}>
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
                className="v22-btn v22-btn-sm" style={{ flexShrink: 0, background: 'var(--v22-amber-light)', border: '1px solid var(--v22-yellow-border)', color: '#7A6000', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--v22-border)', padding: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
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
            className="v22-form-input"
            style={{ flex: 1, resize: 'none' }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="v22-btn v22-btn-primary"
            style={{ padding: '10px 18px', fontWeight: 700, fontSize: 13, flexShrink: 0, alignSelf: 'flex-end', opacity: (!inputValue.trim() || isLoading) ? 0.4 : 1 }}
          >
            {isLoading ? '⏳' : isPt ? '↑ Enviar' : '↑ Envoyer'}
          </button>
        </div>
        <div style={{ padding: '0 14px 10px', fontSize: 10, color: 'var(--v22-text-muted)', textAlign: 'center' }}>
          {isPt ? 'Enter = enviar · Shift+Enter = nova linha' : 'Entrée = envoyer · Maj+Entrée = saut de ligne'}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="v22-card" style={{ padding: 10, textAlign: 'center', fontSize: 11, color: 'var(--v22-text-muted)' }}>
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

  /* ── Tab style helpers (v22 compta-tab pattern) ── */
  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 12, fontWeight: active ? 600 : 500, padding: '8px 16px',
    borderBottom: `2px solid ${active ? 'var(--v22-yellow)' : 'transparent'}`,
    background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
    borderBottomColor: active ? 'var(--v22-yellow)' : 'transparent',
    cursor: 'pointer', color: active ? 'var(--v22-text)' : 'var(--v22-text-muted)',
    whiteSpace: 'nowrap', transition: 'all 0.15s',
  })

  const pillStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
    border: active ? 'none' : '1px solid var(--v22-border)',
    background: active ? 'var(--v22-yellow)' : 'var(--v22-surface)',
    color: active ? 'var(--v22-text)' : 'var(--v22-text-muted)',
    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
  })

  return (
    <div>
      {/* Page header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">{isPt ? '🧮 Contabilidade & Fiscalidade' : '🧮 Comptabilité & Fiscalité'}</h1>
          <p className="v22-page-sub">{isPt ? 'Gestão contabilística e agente IA Léa' : 'Gestion comptable et agent IA Léa'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="v22-form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ display: 'flex', background: 'var(--v22-bg)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--v22-border)' }}>
            {(['mois', 'trimestre', 'annee'] as const).map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)} style={pillStyle(selectedPeriod === p)}>
                {isPt
                  ? (p === 'mois' ? 'Mês' : p === 'trimestre' ? 'Trimestre' : 'Ano')
                  : (p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* Period selector */}
        {selectedPeriod === 'mois' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
            {MONTH_NAMES.map((m, i) => (
              <button key={i} onClick={() => setSelectedMonthC(i)} style={pillStyle(selectedMonth === i)}>
                {m}
              </button>
            ))}
          </div>
        )}
        {selectedPeriod === 'trimestre' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[0, 1, 2, 3].map(q => (
              <button key={q} onClick={() => setSelectedMonthC(q * 3)} style={{ ...pillStyle(getQuarter() === q), flex: 1 }}>
                {quarterLabels[q]}
              </button>
            ))}
          </div>
        )}

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--v22-border)' }}>
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
            <button key={t.key} onClick={() => setActiveComptaTab(t.key)} style={tabStyle(activeComptaTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeComptaTab === 'dashboard' && (
          <div>
            {/* KPI Cards */}
            <div className="v22-stats" style={{ marginBottom: 24 }}>
              <div className="v22-stat" style={{ borderLeft: '3px solid var(--v22-green)' }}>
                <div className="v22-stat-label">{isPt ? 'Faturação c/IVA' : 'Chiffre d\'affaires TTC'}</div>
                <div className="v22-stat-val" style={{ color: 'var(--v22-green)', fontSize: 22 }}>{formatEur(chiffreAffaires)}</div>
                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{completedFiltered.length} {isPt ? 'intervenção(ões)' : 'intervention(s)'}</div>
              </div>
              <div className="v22-stat" style={{ borderLeft: '3px solid #3b82f6' }}>
                <div className="v22-stat-label">{isPt ? 'Faturação s/IVA' : 'CA Hors Taxes'}</div>
                <div className="v22-stat-val" style={{ color: '#3b82f6', fontSize: 22 }}>{formatEur(chiffreAffairesHT)}</div>
                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{isPt ? 'IVA' : 'TVA'} : {formatEur(tvaCollectee)}</div>
              </div>
              <div className="v22-stat" style={{ borderLeft: '3px solid var(--v22-red)' }}>
                <div className="v22-stat-label">{isPt ? 'Despesas dedutíveis' : 'Charges déductibles'}</div>
                <div className="v22-stat-val" style={{ color: 'var(--v22-red)', fontSize: 22 }}>{formatEur(totalExpenses)}</div>
                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{filteredExpenses.length} {isPt ? 'despesa(s)' : 'dépense(s)'}</div>
              </div>
              <div className={`v22-stat ${resultatNet >= 0 ? 'v22-stat-yellow' : ''}`} style={resultatNet < 0 ? { borderLeft: '3px solid var(--v22-red)' } : undefined}>
                <div className="v22-stat-label">{isPt ? 'Resultado líquido' : 'Résultat net'}</div>
                <div className="v22-stat-val" style={{ color: resultatNet >= 0 ? 'var(--v22-text)' : 'var(--v22-red)', fontSize: 22 }}>{formatEur(resultatNet)}</div>
                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{isPt ? 'antes de impostos' : 'avant impôts'}</div>
              </div>
            </div>

            {/* Revenue chart */}
            <div className="v22-card" style={{ marginBottom: 20 }}>
              <div className="v22-card-head"><div className="v22-card-title">{isPt ? `📈 Evolução da faturação mensal ${selectedYear}` : `📈 Évolution du CA mensuel ${selectedYear}`}</div></div>
              <div className="v22-card-body" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                  {monthlyRevenue.map((m, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ fontSize: 9, color: 'var(--v22-text-muted)', fontWeight: 600 }}>
                        {m.ca > 0 ? formatEur(m.ca).replace('€', '') + '€' : ''}
                      </div>
                      <div
                        style={{
                          width: '100%', borderRadius: '4px 4px 0 0', transition: 'all 0.2s',
                          height: `${Math.max(4, (m.ca / maxCA) * 100)}%`,
                          background: (i === currentMonth && selectedYear === currentYear) ? 'var(--v22-yellow)' : '#dbeafe',
                        }}
                      />
                      <div style={{ fontSize: 9, color: 'var(--v22-text-muted)' }}>{m.month}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Health indicator */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="v22-card" style={{ background: 'var(--v22-green-light)', borderColor: 'var(--v22-green)', padding: 16 }}>
                <div style={{ fontWeight: 600, color: 'var(--v22-green)', marginBottom: 6 }}>✅ {isPt ? 'Estatuto fiscal' : 'Statut fiscal'}</div>
                <div style={{ fontSize: 13, color: 'var(--v22-green)' }}>
                  {isPt
                    ? (isAutoEntrepreneur ? 'Regime Simplificado (Recibos Verdes)' : '⚠️ Ultrapassou o limite!')
                    : (isAutoEntrepreneur ? 'Micro-entrepreneur' : 'Dépassement plafond !')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--v22-green)', marginTop: 4 }}>
                  {isPt ? 'Faturação anual' : 'CA annuel'} : {formatEur(bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear).reduce((s, b) => s + (b.price_ht || 0), 0))}
                  {' / '}{isPt ? '200 000 €' : '77 700 €'}
                </div>
              </div>
              <div className="v22-card" style={{ background: '#EFF6FF', borderColor: '#3b82f6', padding: 16 }}>
                <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>{isPt ? '💳 Contrib. estimadas' : '💳 Cotisations estimées'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{formatEur(cotisationsSociales)}</div>
                <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4 }}>{isPt ? '21,4% SS sobre rend. relevante (70%)' : '21,7% du CA HT annuel'}</div>
              </div>
              <div className="v22-card" style={{ background: 'var(--v22-amber-light)', borderColor: 'var(--v22-amber)', padding: 16 }}>
                <div style={{ fontWeight: 600, color: 'var(--v22-amber)', marginBottom: 6 }}>📋 {isPt ? 'Próxima declaração' : 'Prochaine déclaration'}</div>
                <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>
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
                <div style={{ fontSize: 11, color: 'var(--v22-amber)', marginTop: 4 }}>{isPt ? 'Declaração Periódica IVA (trimestral)' : 'Déclaration URSSAF trimestrielle'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUS TAB ── */}
        {activeComptaTab === 'revenus' && (
          <div>
            <div className="v22-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <div className="v22-card-head">
                <div className="v22-card-title">
                  {isPt ? '💰 Receitas — ' : '💰 Revenus — '}{selectedPeriod === 'mois' ? MONTH_FULL[selectedMonth] : selectedPeriod === 'trimestre' ? quarterLabels[getQuarter()] : selectedYear}
                </div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', gap: 20 }}>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: 'var(--v22-green)' }}>{formatEur(chiffreAffaires)}</span><span style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginLeft: 4 }}>{isPt ? 'c/IVA' : 'TTC'}</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{formatEur(chiffreAffairesHT)}</span><span style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginLeft: 4 }}>{isPt ? 's/IVA' : 'HT'}</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: 'var(--v22-text-muted)' }}>{formatEur(tvaCollectee)}</span><span style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginLeft: 4 }}>{isPt ? 'IVA 23%' : 'TVA 20%'}</span></div>
              </div>
              {completedFiltered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--v22-text-muted)' }}>{isPt ? 'Nenhuma intervenção concluída neste período' : 'Aucune intervention terminée sur cette période'}</div>
              ) : (
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--v22-bg)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: 'var(--v22-text-muted)', fontWeight: 600 }}>Data</th>
                      <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: 'var(--v22-text-muted)', fontWeight: 600 }}>{isPt ? 'Cliente / Serviço' : 'Client / Service'}</th>
                      <th style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: 'var(--v22-text-muted)', fontWeight: 600 }}>{isPt ? 's/IVA' : 'HT'}</th>
                      <th style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: 'var(--v22-text-muted)', fontWeight: 600 }}>{isPt ? 'IVA' : 'TVA'}</th>
                      <th style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: 'var(--v22-text-muted)', fontWeight: 600 }}>{isPt ? 'c/IVA' : 'TTC'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedFiltered.sort((a, b) => b.booking_date.localeCompare(a.booking_date)).map(b => {
                      const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                      const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                      const tva = (b.price_ttc || 0) - ht
                      return (
                        <tr key={b.id} style={{ borderTop: '1px solid var(--v22-border)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--v22-text-muted)' }}>{new Date(b.booking_date).toLocaleDateString(dateFmtLocale)}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <div className="v22-client-name">{clientName}</div>
                            <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{b.services?.name}</div>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{formatEur(ht)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--v22-text-muted)' }}>{formatEur(tva)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--v22-green)' }}>{formatEur(b.price_ttc || 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--v22-bg)', borderTop: '2px solid var(--v22-border-dark)' }}>
                      <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700 }}>{isPt ? 'TOTAL' : 'TOTAL'}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{formatEur(chiffreAffairesHT)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--v22-text-muted)' }}>{formatEur(tvaCollectee)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--v22-green)' }}>{formatEur(chiffreAffaires)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Revenue by service */}
            {services.length > 0 && (
              <div className="v22-card">
                <div className="v22-card-head"><div className="v22-card-title">{isPt ? `🔧 Faturação por serviço (${selectedYear})` : `🔧 CA par motif (${selectedYear})`}</div></div>
                <div className="v22-card-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {services.map(s => {
                    const sBookings = bookings.filter(b => b.service_id === s.id && b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear)
                    const sCA = sBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0)
                    const pct = maxCA > 0 ? (sCA / (chiffreAffaires || 1)) * 100 : 0
                    return (
                      <div key={s.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500 }}>{s.name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--v22-green)' }}>{formatEur(sCA)} ({sBookings.length} RDV)</span>
                        </div>
                        <div className="v22-prog-bar">
                          <div className="v22-prog-fill" style={{ width: `${pct}%` }} />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{isPt ? '🧾 Despesas dedutíveis' : '🧾 Charges déductibles'}</div>
                <div style={{ fontSize: 13, color: 'var(--v22-text-muted)' }}>{isPt ? 'Total' : 'Total'} : <span style={{ fontWeight: 700, color: 'var(--v22-red)' }}>{formatEur(totalExpenses)}</span></div>
              </div>
              <button onClick={() => setShowAddExpense(true)} className="v22-btn v22-btn-primary">
                {isPt ? '+ Adicionar despesa' : '+ Ajouter une charge'}
              </button>
            </div>

            {showAddExpense && (
              <div className="v22-card" style={{ borderColor: 'var(--v22-yellow)', borderWidth: 2, marginBottom: 16 }}>
                <div className="v22-card-head"><div className="v22-card-title">{isPt ? 'Nova despesa dedutível' : 'Nouvelle charge déductible'}</div></div>
                <div className="v22-card-body" style={{ padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Descrição *' : 'Libellé *'}</label>
                      <input value={expenseForm.label} onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                        placeholder={isPt ? 'Ex: Compra de parafusos e buchas' : 'Ex: Achat vis et boulons'} className="v22-form-input" />
                    </div>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Montante c/IVA (€) *' : 'Montant TTC (€) *'}</label>
                      <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00" className="v22-form-input" />
                    </div>
                    <div>
                      <label className="v22-form-label">{isPt ? 'Categoria' : 'Catégorie'}</label>
                      <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}
                        className="v22-form-input">
                        {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="v22-form-label">Data</label>
                      <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                        className="v22-form-input" />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="v22-form-label">{isPt ? 'Notas (opcional)' : 'Notes (optionnel)'}</label>
                      <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder={isPt ? 'Número de fatura, fornecedor...' : 'Numéro de facture, fournisseur...'} className="v22-form-input" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowAddExpense(false)} className="v22-btn" style={{ flex: 1 }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
                    <button onClick={saveExpense} disabled={!expenseForm.label || !expenseForm.amount}
                      className="v22-btn v22-btn-primary" style={{ flex: 1, opacity: (!expenseForm.label || !expenseForm.amount) ? 0.5 : 1 }}>{isPt ? 'Guardar' : 'Enregistrer'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown by category */}
            {expenseByCategory.length > 0 && (
              <div className="v22-card" style={{ marginBottom: 16 }}>
                <div className="v22-card-head"><div className="v22-card-title">{isPt ? 'Distribuição por categoria' : 'Répartition par catégorie'}</div></div>
                <div className="v22-card-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {expenseByCategory.map(c => (
                    <div key={c.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>{c.icon} {c.label}</span>
                        <span style={{ fontWeight: 700, color: 'var(--v22-red)' }}>{formatEur(c.total)}</span>
                      </div>
                      <div className="v22-prog-bar">
                        <div className="v22-prog-fill" style={{ width: `${(c.total / (totalExpenses || 1)) * 100}%`, background: 'var(--v22-red)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses list */}
            <div className="v22-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="v22-card-head">
                <div className="v22-card-title">
                  {isPt ? `Lista de despesas (${filteredExpenses.length})` : `Liste des charges (${filteredExpenses.length})`}
                </div>
              </div>
              {filteredExpenses.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--v22-text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🧾</div>
                  <div>{isPt ? 'Nenhuma despesa registada neste período' : 'Aucune charge enregistrée sur cette période'}</div>
                  <button onClick={() => setShowAddExpense(true)} style={{ marginTop: 10, color: 'var(--v22-yellow)', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>{isPt ? '+ Adicionar despesa' : '+ Ajouter une charge'}</button>
                </div>
              ) : (
                <div>
                  {filteredExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(e => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.key === e.category)
                    return (
                      <div key={e.id} className="expense-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--v22-border)' }}>
                        <div style={{ fontSize: 20 }}>{cat?.icon || '📦'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{e.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{cat?.label} · {new Date(e.date).toLocaleDateString(dateFmtLocale)}</div>
                          {e.notes && <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>{e.notes}</div>}
                        </div>
                        <div className="v22-amount" style={{ color: 'var(--v22-red)' }}>{formatEur(parseFloat(e.amount))}</div>
                        <button onClick={() => deleteExpense(e.id)}
                          style={{ opacity: 0, color: 'var(--v22-red)', cursor: 'pointer', background: 'none', border: 'none', fontSize: 16, marginLeft: 6, transition: 'opacity 0.15s' }}
                          className="del-btn">🗑</button>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Status badge */}
            <div className={isAutoEntrepreneur ? 'v22-alert' : 'v22-alert v22-alert-red'} style={isAutoEntrepreneur ? { borderLeftColor: 'var(--v22-green)', background: 'var(--v22-green-light)', display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16 } : { display: 'flex', gap: 12, alignItems: 'flex-start', padding: 16 }}>
              <div style={{ fontSize: 24 }}>{isAutoEntrepreneur ? '✅' : '⚠️'}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: isAutoEntrepreneur ? 'var(--v22-green)' : 'var(--v22-red)' }}>
                  {isPt
                    ? (isAutoEntrepreneur ? 'Regime Simplificado (Trabalhador Independente / Recibos Verdes)' : '⚠️ Atenção: Limite de Regime Simplificado ultrapassado')
                    : (isAutoEntrepreneur ? 'Régime Micro-Entrepreneur (Auto-entrepreneur)' : '⚠️ Attention : Dépassement de plafond possible')}
                </div>
                <div style={{ fontSize: 13, marginTop: 4, color: isAutoEntrepreneur ? 'var(--v22-green)' : 'var(--v22-red)' }}>
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
            <div className="v22-card">
              <div className="v22-card-head"><div className="v22-card-title">
                {isPt ? `📋 Declarações trimestrais ${selectedYear}` : `📋 Déclarations URSSAF trimestrielles ${selectedYear}`}
              </div></div>
              <div className="v22-card-body" style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {quarterData.map((ca, q) => {
                    const deadlineIVA = isPt
                      ? ['15 maio', '15 agosto', '15 novembro', '15 fevereiro'][q]
                      : ['30 avril', '31 juillet', '31 octobre', '31 janvier'][q]
                    const deadlineSS = isPt
                      ? ['Janeiro', 'Abril', 'Julho', 'Outubro'][q]
                      : null
                    const cotis = isPt ? ca * 0.70 * tauxCotisation : ca * tauxCotisation
                    const isPast = (q < Math.floor(currentMonth / 3)) && selectedYear <= currentYear
                    return (
                      <div key={q} style={{ padding: 16, borderRadius: 8, border: `2px solid ${isPast ? 'var(--v22-border)' : 'var(--v22-yellow)'}`, background: isPast ? 'var(--v22-bg)' : 'var(--v22-amber-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ fontWeight: 700, color: 'var(--v22-text)' }}>{quarterLabels[q]}</div>
                          {isPast && <span className="v22-tag v22-tag-gray">{isPt ? 'Passado' : 'Passé'}</span>}
                          {!isPast && <span className="v22-tag v22-tag-yellow">{isPt ? 'A declarar' : 'À déclarer'}</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--v22-text-muted)' }}>{isPt ? 'Faturação s/IVA' : 'CA HT réalisé'}</span>
                            <span style={{ fontWeight: 700 }}>{formatEur(ca)}</span>
                          </div>
                          {isPt && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--v22-text-muted)' }}>Rend. relevante (70%)</span>
                              <span style={{ fontWeight: 700 }}>{formatEur(ca * 0.70)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--v22-text-muted)' }}>{isPt ? 'Seg. Social (21,4%)' : 'Cotisations (21,7%)'}</span>
                            <span style={{ fontWeight: 700, color: 'var(--v22-red)' }}>{formatEur(cotis)}</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>{isPt ? 'A pagar' : 'À payer'}</span>
                            <span style={{ color: 'var(--v22-red)' }}>{formatEur(cotis)}</span>
                          </div>
                        </div>
                        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--v22-text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            </div>

            {/* Annual summary */}
            <div className="v22-card">
              <div className="v22-card-head"><div className="v22-card-title">📊 {isPt ? `Resumo anual ${selectedYear}` : `Récapitulatif annuel ${selectedYear}`}</div></div>
              <div className="v22-card-body" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(isPt ? [
                  { label: 'Faturação c/IVA', value: chiffreAffaires + (bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear && filteredBookings.indexOf(b) === -1).reduce((s, b) => s + (b.price_ttc || 0), 0)), color: 'var(--v22-green)', bg: 'var(--v22-green-light)' },
                  { label: 'Faturação s/IVA (declarável)', value: annualHT, color: '#3b82f6', bg: '#EFF6FF' },
                  { label: 'Seg. Social (21,4% × 70%)', value: -cotisationsSociales, color: 'var(--v22-red)', bg: 'var(--v22-red-light)' },
                  { label: 'IRS retido na fonte (25% art.º 101.º CIRS)', value: -impotRevenu, color: '#ea580c', bg: '#FFF7ED' },
                  { label: 'Resultado líquido estimado', value: resultatApresCharges - impotRevenu, color: 'var(--v22-text)', bg: 'var(--v22-bg)', bold: true },
                ] : [
                  { label: 'Chiffre d\'affaires TTC', value: chiffreAffaires + (bookings.filter(b => b.status === 'completed' && new Date(b.booking_date).getFullYear() === selectedYear && filteredBookings.indexOf(b) === -1).reduce((s, b) => s + (b.price_ttc || 0), 0)), color: 'var(--v22-green)', bg: 'var(--v22-green-light)' },
                  { label: 'CA Hors Taxes (déclarable)', value: annualHT, color: '#3b82f6', bg: '#EFF6FF' },
                  { label: 'Cotisations sociales URSSAF (21,7%)', value: -cotisationsSociales, color: 'var(--v22-red)', bg: 'var(--v22-red-light)' },
                  { label: 'Prélèvement libératoire IR (1,1%)', value: -impotRevenu, color: '#ea580c', bg: '#FFF7ED' },
                  { label: 'Résultat net estimé', value: resultatApresCharges - impotRevenu, color: 'var(--v22-text)', bg: 'var(--v22-bg)', bold: true },
                ]).map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: row.bg }}>
                    <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: 'var(--v22-text-mid)' }}>{row.label}</span>
                    <span style={{ fontWeight: 700, color: row.color, fontSize: row.bold ? 16 : 13 }}>
                      {row.value < 0 ? `- ${formatEur(Math.abs(row.value))}` : formatEur(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Export comptable mensuel ── */}
            <div className="v22-card">
              <div className="v22-card-head"><div className="v22-card-title">{isPt ? '📤 Exportação contabilística mensal' : '📤 Export comptable mensuel'}</div></div>
              <div className="v22-card-body" style={{ padding: 14 }}>
                <p style={{ fontSize: 13, color: 'var(--v22-text-muted)', marginBottom: 16, marginTop: 0 }}>{isPt ? 'Gere um ficheiro CSV completo para o seu TOC/ROC: receitas, faturas, despesas e resumo do mês selecionado.' : 'Générez un fichier CSV complet pour votre comptable : revenus, factures, dépenses et récapitulatif du mois sélectionné.'}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {MONTH_FULL.map((m, i) => (
                    <button key={i} onClick={() => setExportMonth(i)} style={pillStyle(exportMonth === i)}>
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
                      <div className="v22-stats" style={{ marginBottom: 16 }}>
                        <div className="v22-stat" style={{ background: 'var(--v22-green-light)', textAlign: 'center' }}>
                          <div className="v22-stat-val" style={{ color: 'var(--v22-green)' }}>{mBookings.length}</div>
                          <div className="v22-stat-label">{isPt ? 'Intervenções' : 'Interventions'}</div>
                        </div>
                        <div className="v22-stat" style={{ background: '#EFF6FF', textAlign: 'center' }}>
                          <div className="v22-stat-val" style={{ color: '#3b82f6' }}>{mFactures.length}</div>
                          <div className="v22-stat-label">{isPt ? 'Faturas' : 'Factures'}</div>
                        </div>
                        <div className="v22-stat" style={{ background: 'var(--v22-amber-light)', textAlign: 'center' }}>
                          <div className="v22-stat-val" style={{ color: 'var(--v22-amber)' }}>{formatEur(totalRevenuHT)}</div>
                          <div className="v22-stat-label">{isPt ? 'Faturação s/IVA' : 'CA HT'}</div>
                        </div>
                        <div className="v22-stat" style={{ background: 'var(--v22-red-light)', textAlign: 'center' }}>
                          <div className="v22-stat-val" style={{ color: 'var(--v22-red)' }}>{formatEur(totalDep)}</div>
                          <div className="v22-stat-label">{isPt ? 'Despesas' : 'Dépenses'}</div>
                        </div>
                      </div>

                      {/* Boutons d'export */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <button onClick={() => {
                          const sep = ';'
                          const lines: string[] = []
                          const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
                          lines.push(`${isPt ? 'EXPORTAÇÃO CONTABILÍSTICA' : 'EXPORT COMPTABLE'} - ${MONTH_FULL[exportMonth].toUpperCase()} ${selectedYear}`)
                          lines.push(`${isPt ? 'Empresa' : 'Entreprise'}: ${artisan?.company_name || artisan?.name || ''}`)
                          lines.push(`${isPt ? 'NIF' : 'SIRET'}: ${artisan?.siret || ''}`)
                          lines.push(`${isPt ? 'Gerado em' : 'Généré le'}: ${new Date().toLocaleDateString(dateFmtLocale)}`)
                          lines.push('')
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
                          lines.push(isPt ? '=== DESPESAS ===' : '=== DÉPENSES ===')
                          lines.push((isPt ? ['Data', 'Descrição', 'Categoria', 'Montante c/IVA', 'Notas'] : ['Date', 'Libellé', 'Catégorie', 'Montant TTC', 'Notes']).join(sep))
                          mExpenses.forEach(e => {
                            const catLabel = EXPENSE_CATEGORIES.find(c => c.key === e.category)?.label || e.category
                            lines.push([e.date, esc(e.label), esc(catLabel), parseFloat(e.amount || 0).toFixed(2), esc(e.notes || '')].join(sep))
                          })
                          lines.push(`${isPt ? 'TOTAL DESPESAS' : 'TOTAL DÉPENSES'}${sep}${sep}${sep}${totalDep.toFixed(2)}`)
                          lines.push('')
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
                          className="v22-btn v22-btn-primary">
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
                          className="v22-btn">
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
                          className="v22-btn">
                          {isPt ? '💸 Despesas apenas' : '💸 Dépenses seules'}
                        </button>
                      </div>

                      <p style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 10 }}>{isPt ? 'O ficheiro CSV abre no Excel, Google Sheets ou qualquer software contabilístico. Codificação UTF-8 com BOM para acentos.' : 'Le fichier CSV s\'ouvre dans Excel, Google Sheets ou tout logiciel comptable. Encodage UTF-8 avec BOM pour les accents.'}</p>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Action links */}
            {isPt ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <a href="https://www.portaldasfinancas.gov.pt" target="_blank" rel="noopener noreferrer"
                  className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit', transition: 'transform 0.15s' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🏛️</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Portal das Finanças (AT)</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>Declaração IVA & IRS Mod.3</div>
                </a>
                <a href="https://www.seg-social.pt" target="_blank" rel="noopener noreferrer"
                  className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit', transition: 'transform 0.15s' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🛡️</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Segurança Social Direta</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>Contribuições SS trimestral</div>
                </a>
                <a href="https://www.e-fatura.pt" target="_blank" rel="noopener noreferrer"
                  className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit', transition: 'transform 0.15s' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🧾</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>e-Fatura</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>Comunicação faturas à AT</div>
                </a>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener noreferrer"
                  className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit', transition: 'transform 0.15s' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🏛️</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>URSSAF</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>Déclarer votre CA</div>
                </a>
                <a href="https://www.impots.gouv.fr" target="_blank" rel="noopener noreferrer"
                  className="v22-card" style={{ textAlign: 'center', padding: 16, textDecoration: 'none', color: 'inherit', transition: 'transform 0.15s' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>impots.gouv.fr</div>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>Déclaration de revenus</div>
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── AGENT COMPTABLE LÉA ── */}
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
