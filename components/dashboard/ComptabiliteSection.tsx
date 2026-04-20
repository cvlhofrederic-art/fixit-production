'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { LeaAvatar } from '@/components/common/RobotAvatars'
import { useThemeVars } from './useThemeVars'
import { useLocale } from '@/lib/i18n/context'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { supabase } from '@/lib/supabase'
// DeclarationSocialeSection removed — IS estimation is now inline in Declaration tab
import { getTvaStatus, type TvaCountry, type TvaStatusResult } from '@/lib/tva-thresholds'

/* ══════════ AGENT COMPTABLE LÉA ══════════ */

interface Expense { id?: string; label?: string; amount?: number | string; category?: string; date?: string; notes?: string }

function AgentComptable({ bookings, artisan, services, expenses, annualHT, annualCA, totalExpenses, quarterData, currentMonth, currentYear, formatEur, orgRole }: {
  bookings: import('@/lib/types').Booking[]; artisan: import('@/lib/types').Artisan; services: import('@/lib/types').Service[]; expenses: Expense[]; annualHT: number; annualCA: number; totalExpenses: number; quarterData: number[]; currentMonth: number; currentYear: number; formatEur: (v: number) => string; orgRole?: string
}) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const tv = useThemeVars(true)
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

  // Permet aux boutons de questions fréquentes (hors AgentComptable) de déclencher une question
  const sendMessageRef = useRef<((text: string) => void) | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail === 'string' && sendMessageRef.current) sendMessageRef.current(detail)
    }
    window.addEventListener('lea-ask', handler as EventListener)
    return () => window.removeEventListener('lea-ask', handler as EventListener)
  }, [])

  const expenseCategories = expenses.reduce((acc: Record<string, number>, e: Expense) => {
    const cat = e.category ?? 'autre'
    acc[cat] = (acc[cat] || 0) + parseFloat(String(e.amount || 0))
    return acc
  }, {})

  // ── Enrichir chaque booking avec clientName et serviceName déjà résolus
  const allBookingsEnriched = useMemo(() => bookings.map((b: import('@/lib/types').Booking) => ({
    ...b,
    clientName: b.notes?.match(/Client:\s*([^|.\n]+)/)?.[1]?.trim() || 'Client',
    serviceName: b.services?.name || services.find((s: import('@/lib/types').Service) => s.id === b.service_id)?.name || 'Intervention',
  })), [bookings, services])

  // ── Données équipe / paie (source : localStorage pointage + profile artisan) ──
  interface StoredTeamMember { id: string; nom: string; prenom?: string; typeContrat?: string; salaireBrutMensuel?: number; coutHoraireTTC?: number; heuresMois?: number }
  let teamPayroll: StoredTeamMember[] = []
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`fixit_team_payroll_${artisan?.id}`) : null
    if (raw) teamPayroll = JSON.parse(raw)
  } catch { /* no-op : pas de données paie synchronisées */ }
  const masseSalarialeAnnuelle = teamPayroll.reduce((s, m) => s + (m.salaireBrutMensuel || 0) * 12, 0)

  const financialContext = {
    // ── PAYS & FORME JURIDIQUE (verrou fiscalité — ne jamais mélanger FR/PT) ──
    country: locale === 'pt' ? 'PT' : 'FR',
    locale,
    legalForm: (artisan as { legal_form?: string })?.legal_form || undefined,

    // Statut juridique (micro-entrepreneur ou entreprise)
    orgRole: orgRole || 'artisan',

    // Agrégats (référence rapide)
    annualCA,
    annualCAHT: annualHT,
    completedCount: bookings.filter(b => b.status === 'completed' && b.booking_date && new Date(b.booking_date).getFullYear() === currentYear).length,
    tvaCollectee: annualCA - annualHT,
    avgMonthlyCA: annualCA / (currentMonth + 1),
    totalExpenses,
    expenseCategories,
    quarterData,

    // ── DONNÉES BRUTES COMPLÈTES (pour calculs sur période) ──
    allBookings: allBookingsEnriched,   // Toutes les interventions avec client + service résolus
    allExpenses: expenses,              // Toutes les dépenses avec date, catégorie, montant, notes

    // ── ÉQUIPES & PAIE (frais par ouvrier) ──
    teamPayroll,
    masseSalariale: masseSalarialeAnnuelle,
  }

  const isEntreprise = orgRole === 'pro_societe'

  const QUICK_QUESTIONS = isPt ? [
    { label: '🔧 Materiais vs mão de obra', q: 'Dá-me o total gasto em materiais e em mão de obra separadamente desde o início do ano, com o detalhe linha a linha.' },
    { label: '💳 Contribuições Seg. Social', q: 'Quanto vou pagar à Segurança Social este trimestre e no ano inteiro? Detalha por trimestre.' },
    { label: '📊 Resultado líquido real', q: 'Qual é o meu resultado líquido real depois de todas as despesas, contribuições SS e IRS? Faz o cálculo completo.' },
    { label: '📅 Análise do mês', q: 'Analisa as minhas receitas e despesas do mês passado: quanto faturei, gastei, e qual é o meu resultado líquido?' },
    { label: '⚠️ Regime Simplificado', q: 'Estou próximo do limite do Regime Simplificado? A que ritmo chegarei ao limite de 200.000 €?' },
    { label: '🚗 Despesas de deslocação', q: 'Quanto gastei em transporte e deslocações? Há despesas quilométricas a otimizar?' },
    { label: '🏗️ Despesas dedutíveis', q: 'Quais são todas as despesas dedutíveis específicas da construção e serviços que posso registar?' },
    { label: '📋 Preparar declaração SS/IRS', q: 'Prepara um resumo completo dos meus dados para a próxima declaração SS e Mod. 3 IRS.' },
  ] : isEntreprise ? [
    { label: '🔧 Matériaux vs main d\'œuvre', q: 'Donne-moi le total dépensé en matériaux et en main d\'œuvre séparément depuis le début de l\'année, avec le détail ligne par ligne.' },
    { label: '💳 IS et charges', q: 'Calcule mon IS estimé (15% + 25%) et mes charges sociales dirigeant pour cette année. Détaille le calcul.' },
    { label: '📊 Bénéfice net réel', q: 'Quel est mon bénéfice net réel après charges d\'exploitation, IS et charges dirigeant ? Fais le calcul complet.' },
    { label: '📅 Analyse du mois', q: `Analyse mes revenus et dépenses du mois dernier : combien j'ai facturé, dépensé, et quel est mon résultat net ?` },
    { label: '📈 Marge par chantier', q: 'Analyse la rentabilité de chaque chantier : CA facturé vs charges engagées, et identifie les plus et moins rentables.' },
    { label: '🚗 Frais de déplacement', q: 'Combien j\'ai dépensé en transport et déplacements ? Y a-t-il des frais kilométriques à optimiser ?' },
    { label: '🏗️ Charges déductibles BTP', q: 'Quelles sont toutes les charges déductibles spécifiques au BTP que je peux enregistrer ? Amortissements, provisions, sous-traitance.' },
    { label: '📋 Préparer liasse fiscale', q: 'Prépare un récapitulatif de mes données pour la liasse fiscale : résultat, charges, TVA collectée/déductible.' },
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMessages(prev => [...prev, { role: 'assistant', content: isPt ? '🔒 Sessão expirada. Por favor, reconecte-se.' : '🔒 Session expirée. Veuillez vous reconnecter.' }])
        setIsLoading(false)
        return
      }
      const res = await fetch('/api/comptable-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          message: text.trim(),
          financialContext,
          conversationHistory: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          locale,
        }),
      })
      if (!res.ok) {
        const errMsg = res.status === 401
          ? (isPt ? '🔒 Sessão expirada. Reconecte-se.' : '🔒 Session expirée. Reconnectez-vous.')
          : res.status === 429
            ? (isPt ? '⏳ Demasiados pedidos. Aguarde um momento.' : '⏳ Trop de requêtes. Patientez un instant.')
            : (isPt ? `❌ Erro do servidor (${res.status})` : `❌ Erreur serveur (${res.status})`)
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
        setIsLoading(false)
        return
      }
      const data = await res.json()
      const responseText = data.response || (isPt ? 'Não foi possível gerar uma resposta. Tente novamente.' : 'Je n\'ai pas pu générer une réponse. Veuillez réessayer.')
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: isPt ? '❌ Erro de ligação. Verifique a sua ligação à internet e tente novamente.' : '❌ Erreur de connexion. Vérifiez votre connexion internet et réessayez.' }])
    }
    setIsLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // Expose sendMessage pour les questions fréquentes externes (FAQ Comptabilité)
  sendMessageRef.current = sendMessage

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
            style={stat.variant === 'green' ? { background: tv.greenLight } : stat.variant === 'red' ? { background: tv.redBg } : undefined}>
            <div style={{ fontSize: 18, marginBottom: 2 }}>{stat.icon}</div>
            <div className="v22-stat-val" style={stat.variant === 'green' ? { color: tv.green } : stat.variant === 'red' ? { color: tv.red } : undefined}>{stat.value}</div>
            <div className="v22-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="v22-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 500, padding: 0 }}>

        {/* Chat header */}
        <div style={{ borderBottom: `1px solid ${tv.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: tv.bg }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}><LeaAvatar size={22} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: tv.text }}>{isPt ? 'Léa — Contabilista IA' : 'Léa — Agent Comptable IA'}</div>
            <div style={{ fontSize: 11, color: tv.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isPt ? (
                <>Acesso a <strong style={{ color: tv.textMid }}>{bookings.filter(b => b.status === 'completed').length} intervenções</strong> · <strong style={{ color: tv.textMid }}>{expenses.length} despesas</strong> · cálculos em qualquer período</>
              ) : (
                <>Accès à <strong style={{ color: tv.textMid }}>{bookings.filter(b => b.status === 'completed').length} interventions</strong> · <strong style={{ color: tv.textMid }}>{expenses.length} dépenses</strong> · calculs sur toute période</>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: tv.green, fontWeight: 500 }}>En ligne</span>
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
                <div style={{ background: tv.bg, borderRadius: '14px 14px 14px 4px', padding: '10px 14px', maxWidth: '82%' }}>
                  <p style={{ fontSize: 13, color: tv.text, lineHeight: 1.6, margin: 0 }}>
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
                    className="v22-btn" style={{ textAlign: 'left', fontSize: 11, background: tv.primaryLight, border: `1px solid ${tv.primaryBorder}`, color: '#7A6000', padding: '8px 12px', lineHeight: 1.4, fontWeight: 500 }}>
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
                    background: msg.role === 'user' ? tv.primary : tv.bg,
                    color: tv.text,
                  }}>
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}><LeaAvatar size={26} /></div>
                  <div style={{ background: tv.bg, borderRadius: '4px 14px 14px 14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: tv.textMuted, marginRight: 4 }}>{isPt ? 'Léa está a analisar os seus dados' : 'Léa analyse vos données'}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: tv.textMuted, animation: 'bounce 1s infinite', animationDelay: '0ms' }} />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: tv.textMuted, animation: 'bounce 1s infinite', animationDelay: '150ms' }} />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: tv.textMuted, animation: 'bounce 1s infinite', animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Suggestions rapides pendant le chat */}
        {chatStarted && (
          <div style={{ padding: '8px 14px', display: 'flex', gap: 8, overflowX: 'auto', borderTop: `1px solid ${tv.border}` }}>
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
                className="v22-btn v22-btn-sm" style={{ flexShrink: 0, background: tv.primaryLight, border: `1px solid ${tv.primaryBorder}`, color: '#7A6000', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ borderTop: `1px solid ${tv.border}`, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
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
        <div style={{ padding: '0 14px 10px', fontSize: 10, color: tv.textMuted, textAlign: 'center' }}>
          {isPt ? 'Enter = enviar · Shift+Enter = nova linha' : 'Entrée = envoyer · Maj+Entrée = saut de ligne'}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="v22-card" style={{ padding: 10, textAlign: 'center', fontSize: 11, color: tv.textMuted }}>
        {isPt
          ? 'ℹ️ Léa fornece informações indicativas baseadas nos seus dados Fixit. Para aconselhamento fiscal vinculativo, consulte um TOC/ROC certificado.'
          : 'ℹ️ Léa fournit des informations indicatives basées sur vos données Vitfix. Pour des conseils fiscaux engageant votre responsabilité, consultez un expert-comptable agréé.'}
      </div>
    </div>
  )
}

/* ══════════ COMPTABILITÉ SECTION ══════════ */

export default function ComptabiliteSection({ bookings, artisan, services, orgRole, navigateTo }: { bookings: import('@/lib/types').Booking[]; artisan: import('@/lib/types').Artisan; services: import('@/lib/types').Service[]; orgRole?: string; navigateTo?: (page: string) => void }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dateFmtLocale = isPt ? 'pt-PT' : 'fr-FR'
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedPeriod, setSelectedPeriod] = useState<'mois' | 'trimestre' | 'annee'>('mois')
  const [selectedMonth, setSelectedMonthC] = useState(currentMonth)
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try { return JSON.parse(localStorage.getItem(`fixit_expenses_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ label: '', amount: '', category: 'materiel', date: new Date().toISOString().split('T')[0], notes: '' })
  const [activeComptaTab, setActiveComptaTab] = useState<'dashboard' | 'revenus' | 'depenses' | 'declaration' | 'assistant'>('dashboard')
  // ── TVA / IVA ───────────────────────────────────────────────────────────────
  const [tvaAutoActivate, setTvaAutoActivate] = useState(false)
  const [tvaTogglingLoading, setTvaTogglingLoading] = useState(false)
  const [tvaCheckDone, setTvaCheckDone] = useState(false)

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
    const d = new Date(e.date ?? '')
    if (d.getFullYear() !== selectedYear) return false
    if (selectedPeriod === 'mois') return d.getMonth() === selectedMonth
    if (selectedPeriod === 'trimestre') return Math.floor(d.getMonth() / 3) === getQuarter()
    return true
  })

  const totalExpenses = filteredExpenses.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0)
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
    total: expenses.filter(e => e.category === cat.key && e.date && new Date(e.date).getFullYear() === selectedYear)
      .reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const saveExpense = () => {
    if (!expenseForm.label || !expenseForm.amount) return
    const newExpense = { ...expenseForm, id: Date.now().toString(), amount: parseFloat(expenseForm.amount) }
    const updated = [...expenses, newExpense]
    setExpenses(updated)
    try { localStorage.setItem(`fixit_expenses_${artisan?.id}`, JSON.stringify(updated)) } catch (e) { console.warn('[storage] saveExpense', e) }
    setShowAddExpense(false)
    setExpenseForm({ label: '', amount: '', category: 'materiel', date: new Date().toISOString().split('T')[0], notes: '' })
  }

  const deleteExpense = (id: string) => {
    const updated = expenses.filter(e => e.id !== id)
    setExpenses(updated)
    try { localStorage.setItem(`fixit_expenses_${artisan?.id}`, JSON.stringify(updated)) } catch (e) { console.warn('[storage] deleteExpense', e) }
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
  const isEntreprise = orgRole === 'pro_societe'
  // Micro-entrepreneur : seuil BTP (vente/fourniture) = 188 700 € ; services = 77 700 € (2024+)
  // Pour les artisans BTP, le seuil applicable est celui du commerce (art. 293B CGI)
  const seuilMicroFR = 188700 // Seuil BTP (activités mixtes vente + prestation)
  const isAutoEntrepreneur = !isEntreprise && (isPt ? annualHT < 200000 : annualHT < seuilMicroFR)

  // Fiscal calculations differ by status
  let cotisationsSociales: number
  let impotRevenu: number
  let resultatApresCharges: number

  if (isEntreprise) {
    // Entreprise BTP: IS 15% ≤42500€, 25% au-delà + charges dirigeant estimées ~45% TNS
    const resultatAvantIS = annualHT - totalExpenses
    const is15 = Math.min(Math.max(resultatAvantIS, 0), 42500) * 0.15
    const is25 = Math.max(resultatAvantIS - 42500, 0) * 0.25
    impotRevenu = is15 + is25
    cotisationsSociales = 0 // charges sociales dépendent du salaire dirigeant, pas du CA
    resultatApresCharges = resultatAvantIS - impotRevenu
  } else if (isPt) {
    cotisationsSociales = annualHT * 0.70 * 0.214
    impotRevenu = annualHT * 0.25
    resultatApresCharges = annualHT - cotisationsSociales
  } else {
    cotisationsSociales = annualHT * 0.212
    impotRevenu = annualHT * 0.017 // versement libératoire IR prestations de services (art. 151-0 CGI)
    resultatApresCharges = annualHT - cotisationsSociales
  }

  const formatEur = (v: number) => new Intl.NumberFormat(dateFmtLocale, { style: 'currency', currency: 'EUR' }).format(v)

  // ── TVA : calcul status en temps réel ────────────────────────────────────
  // Sociétés au régime réel : toujours assujetties à la TVA (pas de franchise art. 293B)
  const tvaCountry: TvaCountry = ((artisan as unknown as { country?: string })?.country || (isPt ? 'PT' : 'FR')) as TvaCountry
  const tvaStatus: TvaStatusResult = isEntreprise
    ? {
        status: 'exceeded' as const, percent: 100, caHT: annualHT,
        seuil: 0, taux: tvaCountry === 'PT' ? 0.23 : 0.20,
        color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)',
        badge: { fr: 'ASSUJETTI TVA', pt: 'SUJEITO A IVA' },
        title: { fr: '📋 Assujetti à la TVA (régime réel)', pt: '📋 Sujeito a IVA (regime real)' },
        message: {
          fr: `En tant que société au régime réel, vous collectez la TVA à ${tvaCountry === 'PT' ? '23' : '20'} % sur toutes vos factures. La franchise en base (art. 293B CGI) ne s'applique pas aux sociétés.`,
          pt: `Como empresa no regime real, cobra IVA a ${tvaCountry === 'PT' ? '23' : '20'} % em todas as suas faturas. A isenção do art.º 53.º CIVA não se aplica a sociedades.`,
        },
      }
    : getTvaStatus(annualHT, tvaCountry)

  // Charger les settings TVA une fois au montage
  useEffect(() => {
    const loadTvaSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch('/api/tva/settings', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setTvaAutoActivate(data.tva_auto_activate ?? false)
        }
      } catch (e) { console.warn('[compta] TVA settings error:', e) }
    }
    loadTvaSettings()
  }, [])

  // Vérifier le seuil TVA et créer une notification si nécessaire (run une seule fois par session)
  useEffect(() => {
    if (tvaCheckDone || annualHT === 0) return
    const checkTva = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        setTvaCheckDone(true)
        await fetch('/api/tva/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ca_ht: annualHT, country: tvaCountry }),
        })
      } catch (e) { console.warn('[compta] TVA check error:', e) }
    }
    checkTva()
  }, [annualHT, tvaCountry, tvaCheckDone])

  const toggleTvaAutoActivate = useCallback(async (value: boolean) => {
    setTvaTogglingLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch('/api/tva/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tva_auto_activate: value }),
      })
      if (res.ok) setTvaAutoActivate(value)
    } catch {}
    setTvaTogglingLoading(false)
  }, [])

  const tv = useThemeVars(true)

  // (tabStyle and pillStyle removed — now using cpta-* CSS classes)


  // ── Expense search/filter state for Revenus & Dépenses tabs ──
  const [revenusSearch, setRevenusSearch] = useState('')
  const [revenusFilter, setRevenusFilter] = useState('all')
  const [depensesSearch, setDepensesSearch] = useState('')
  const [depensesFilter, setDepensesFilter] = useState('all')

  // Filtered revenus
  const filteredRevenus = completedFiltered.filter(b => {
    const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || ''
    const serviceName = b.services?.name || ''
    const matchSearch = !revenusSearch || clientName.toLowerCase().includes(revenusSearch.toLowerCase()) || serviceName.toLowerCase().includes(revenusSearch.toLowerCase())
    const matchFilter = revenusFilter === 'all' || (revenusFilter === 'completed' && b.status === 'completed')
    return matchSearch && matchFilter
  })

  // Filtered depenses with search
  const searchedExpenses = filteredExpenses.filter(e => {
    const matchSearch = !depensesSearch || (e.label || '').toLowerCase().includes(depensesSearch.toLowerCase()) || (e.notes || '').toLowerCase().includes(depensesSearch.toLowerCase())
    const matchFilter = depensesFilter === 'all' || e.category === depensesFilter
    return matchSearch && matchFilter
  })

  // TVA deductible from expenses
  const tvaDeductible = filteredExpenses.reduce((s, e) => {
    const amount = parseFloat(String(e.amount || 0))
    return s + (amount - amount / 1.2)
  }, 0)
  const tvaCreditDebit = tvaCollectee - tvaDeductible

  return (
    <div>
      {/* ═══ Page Header ═══ */}
      <div className="v5-pg-t" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{isPt ? 'Contabilidade & Fiscalidade' : 'Comptabilité & Fiscalité'}</h1>
          <p>{isPt ? 'Gestão contabil\u00edstica e agente IA Léa' : 'Gestion comptable et agent IA Léa'}</p>
        </div>
      </div>

      {/* ═══ Period Controls ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.65rem', marginBottom: '.85rem' }}>
        <div className="cpta-period-bar" style={{ margin: 0 }}>
          <div className="cpta-yr">
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span style={{ fontSize: 10, color: '#CCC' }}>{'\u25BE'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.3rem' }}>
          {(['mois', 'trimestre', 'annee'] as const).map(p => (
            <button
              key={p}
              className={`cpta-view-btn${selectedPeriod === p ? ' active' : ''}`}
              onClick={() => setSelectedPeriod(p)}
            >
              {isPt
                ? (p === 'mois' ? 'M\u00eas' : p === 'trimestre' ? 'Trimestre' : 'Ano')
                : (p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année')}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Month Bar ═══ */}
      {selectedPeriod === 'mois' && (
        <div className="cpta-month-bar">
          {MONTH_NAMES.map((m, i) => (
            <button
              key={i}
              className={`cpta-month${selectedMonth === i ? ' active' : ''}`}
              onClick={() => setSelectedMonthC(i)}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      {selectedPeriod === 'trimestre' && (
        <div className="cpta-month-bar">
          {[0, 1, 2, 3].map(q => (
            <button
              key={q}
              className={`cpta-month${getQuarter() === q ? ' active' : ''}`}
              onClick={() => setSelectedMonthC(q * 3)}
              style={{ flex: 1 }}
            >
              {quarterLabels[q]}
            </button>
          ))}
        </div>
      )}

      {/* ═══ Tabs Bar ═══ */}
      <div className="cpta-tabs">
        {([
          { key: 'dashboard' as const, label: isPt ? 'Painel' : 'Tableau de bord' },
          { key: 'revenus' as const, label: isPt ? 'Receitas' : 'Revenus' },
          { key: 'depenses' as const, label: isPt ? 'Despesas' : 'Dépenses' },
          { key: 'declaration' as const, label: isPt ? 'Declara\u00e7ão' : 'Déclaration' },
          { key: 'assistant' as const, label: isPt ? 'Assistente IA' : 'Assistant IA' },
        ]).map(t => (
          <button
            key={t.key}
            className={`cpta-tab${activeComptaTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveComptaTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
           TAB 1: TABLEAU DE BORD
         ══════════════════════════════════════════════════════════════ */}
      {activeComptaTab === 'dashboard' && (
        <div>
          {/* KPI Grid */}
          <div className="cpta-kpi-g">
            <div className="cpta-kpi">
              <div className="cpta-kpi-lbl">{isPt ? 'Fatura\u00e7ão c/IVA' : "Chiffre d'affaires TTC"}</div>
              <div className="cpta-kpi-val green">{formatEur(chiffreAffaires)}</div>
              <div className="cpta-kpi-sub">{completedFiltered.length} {isPt ? 'interven\u00e7ão(\u00f5es)' : 'intervention(s)'}</div>
            </div>
            <div className="cpta-kpi">
              <div className="cpta-kpi-lbl">{isPt ? 'Fatura\u00e7ão s/IVA' : 'CA Hors Taxes'}</div>
              <div className="cpta-kpi-val orange">{formatEur(chiffreAffairesHT)}</div>
              <div className="cpta-kpi-sub">{isPt ? 'IVA' : 'TVA'} : {formatEur(tvaCollectee)}</div>
            </div>
            <div className="cpta-kpi">
              <div className="cpta-kpi-lbl">{isPt ? 'Despesas dedut\u00edveis' : 'Charges déductibles'}</div>
              <div className="cpta-kpi-val red">{formatEur(totalExpenses)}</div>
              <div className="cpta-kpi-sub">{filteredExpenses.length} {isPt ? 'despesa(s)' : 'dépense(s)'}</div>
            </div>
            <div className="cpta-kpi">
              <div className="cpta-kpi-lbl">{isPt ? 'Resultado l\u00edquido' : 'Résultat net'}</div>
              <div className={`cpta-kpi-val ${resultatNet >= 0 ? 'green' : 'red'}`}>{formatEur(resultatNet)}</div>
              <div className="cpta-kpi-sub">{isPt ? 'antes de impostos' : 'avant imp\u00f4ts'}</div>
            </div>
          </div>

          {/* TVA Banner */}
          <div className="cpta-tva-banner">
            <div className="cpta-tva-top">
              <div className="cpta-tva-left">
                <span style={{ fontSize: 14 }}>{'\uD83D\uDCCA'}</span>
                <span className="cpta-tva-title">{isPt ? tvaStatus.title.pt : tvaStatus.title.fr}</span>
                <span className="cpta-tva-badge">{isPt ? tvaStatus.badge.pt : tvaStatus.badge.fr}</span>
              </div>
              <span className="cpta-tva-link" onClick={() => setActiveComptaTab('declaration')}>
                {isPt ? 'Ver detalhes \u2192' : 'Voir détails \u2192'}
              </span>
            </div>
            <div className="cpta-tva-desc">{isPt ? tvaStatus.message.pt : tvaStatus.message.fr}</div>
            <div className="cpta-tva-prog">
              <span style={{ fontSize: 10, color: '#999' }}>0</span>
              <div className="cpta-tva-prog-bg">
                <div className="cpta-tva-prog-fill" style={{ width: `${Math.min(tvaStatus.percent, 100)}%` }} />
              </div>
              <span className="cpta-tva-prog-label">{tvaStatus.percent}% {isPt ? 'do limite' : 'du seuil'}</span>
              <span style={{ fontSize: 10, color: '#999' }}>
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(tvaStatus.seuil)}
              </span>
            </div>
          </div>

          {/* CA Chart */}
          <div className="cpta-chart-card">
            <div className="cpta-chart-title">{'\uD83D\uDCC8'} {isPt ? `Evolu\u00e7ão da fatura\u00e7ão mensal ${selectedYear}` : `\u00c9volution du CA mensuel ${selectedYear}`}</div>
            <div className="cpta-bars">
              {monthlyRevenue.map((m, i) => (
                <div key={i} className="cpta-bar-col">
                  <div
                    className={`cpta-bar ${m.ca > 0 ? 'filled' : 'empty'}`}
                    style={{ height: `${Math.max(4, (m.ca / maxCA) * 100)}%` }}
                    title={`${m.month}: ${formatEur(m.ca)}`}
                    onClick={() => setSelectedMonthC(i)}
                  />
                </div>
              ))}
            </div>
            <div className="cpta-bar-months">
              {monthlyRevenue.map((m, i) => (
                <button
                  key={i}
                  className={`cpta-bar-lbl${selectedMonth === i ? ' active' : ''}`}
                  onClick={() => setSelectedMonthC(i)}
                >
                  {m.month}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Stats */}
          <div className="cpta-bottom-g">
            <div className="cpta-stat-card">
              <div className="cpta-stat-icon">{'\u2705'}</div>
              <div className="cpta-stat-title">{isPt ? 'Estatuto fiscal' : 'Statut fiscal'}</div>
              <div className="cpta-stat-val" style={{ fontSize: 14 }}>
                {isEntreprise
                  ? (isPt ? 'Empresa BTP (Regime real)' : 'Société BTP (Régime réel)')
                  : isPt
                    ? (isAutoEntrepreneur ? 'Regime Simplificado' : 'Ultrapassou o limite!')
                    : (isAutoEntrepreneur ? 'Micro-entrepreneur' : 'Dépassement plafond !')}
              </div>
              <div className="cpta-stat-sub">
                {isEntreprise
                  ? (isPt ? 'IS 15% \u226442 500\u20ac \u00b7 25% além' : 'IS 15% \u226442 500\u20ac \u00b7 25% au-del\u00e0')
                  : isPt
                    ? 'Regime Simplificado (Recibos Verdes)'
                    : 'Franchise en base TVA'}
              </div>
            </div>
            <div className="cpta-stat-card">
              <div className="cpta-stat-icon">{'\uD83E\uDDFE'}</div>
              <div className="cpta-stat-title">{isEntreprise ? (isPt ? 'IS estimado' : 'IS estimé') : (isPt ? 'Contrib. estimadas' : 'Cotisations estimées')}</div>
              <div className="cpta-stat-val" style={{ color: '#43A047' }}>{formatEur(isEntreprise ? impotRevenu : cotisationsSociales)}</div>
              <div className="cpta-stat-sub">
                {isEntreprise
                  ? (isPt ? 'IS estimado sobre resultado' : 'IS estimé sur résultat')
                  : isPt ? '21,4% SS sobre rend. relevante' : '21,7% du CA HT annuel'}
              </div>
            </div>
            <div className="cpta-stat-card">
              <div className="cpta-stat-icon">{'\uD83D\uDCC5'}</div>
              <div className="cpta-stat-title">{isPt ? 'Pr\u00f3xima declara\u00e7ão' : 'Prochaine déclaration'}</div>
              <div className="cpta-stat-val" style={{ fontSize: 15 }}>
                {isPt ? (() => {
                  const q = Math.floor(currentMonth / 3)
                  const dates = ['15 Mai (IVA T1)', '15 Ago (IVA T2)', '15 Nov (IVA T3)', '15 Fev (IVA T4)']
                  return dates[q] || 'Ver calend\u00e1rio'
                })() : (() => {
                  const q = Math.floor(currentMonth / 3)
                  const dates = ['30 Avril', '31 Juillet', '31 Oct', '31 Jan']
                  return dates[q] || 'Voir calendrier'
                })()}
              </div>
              <div className="cpta-stat-sub">
                {isEntreprise
                  ? (isPt ? 'Declara\u00e7ão IVA + IRC trimestral' : 'Déclaration TVA + acompte IS')
                  : (isPt ? 'Declara\u00e7ão Peri\u00f3dica IVA' : 'Déclaration URSSAF trimestrielle')}
              </div>
            </div>
          </div>

          {/* Journal de ventes */}
          <div className="v5-card" style={{ marginBottom: '1rem' }}>
            <div className="v5-st">
              {isPt
                ? `Jornal de vendas — ${MONTH_FULL[selectedMonth]} ${selectedYear}`
                : `Journal de ventes — ${MONTH_FULL[selectedMonth]} ${selectedYear}`}
            </div>
            {completedFiltered.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#999', fontSize: 12 }}>
                {isPt ? 'Nenhuma interven\u00e7ão conclu\u00edda neste per\u00edodo' : 'Aucune intervention terminée sur cette période'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="v5-dt">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{isPt ? 'Pe\u00e7a' : 'Pi\u00e8ce'}</th>
                      <th>{isPt ? 'Descri\u00e7ão' : 'Libellé'}</th>
                      <th>{isPt ? 'Débito' : 'Débit'}</th>
                      <th>{isPt ? 'Crédito' : 'Crédit'}</th>
                      <th>{isPt ? 'Estado' : 'Statut'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedFiltered.sort((a, b) => (b.booking_date ?? '').localeCompare(a.booking_date ?? '')).map((b, idx) => {
                      const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || (isPt ? 'Cliente' : 'Client')
                      const serviceName = b.services?.name || (isPt ? 'Interven\u00e7ão' : 'Intervention')
                      return (
                        <tr key={b.id || idx}>
                          <td>{b.booking_date ? new Date(b.booking_date).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'short' }) : '—'}</td>
                          <td style={{ fontWeight: 600 }}>FAC-{String(idx + 1).padStart(3, '0')}</td>
                          <td>{clientName} — {serviceName}</td>
                          <td>—</td>
                          <td style={{ fontWeight: 600, color: '#2E7D32' }}>{formatEur(b.price_ttc || 0)}</td>
                          <td><span className="badge badge-green">{isPt ? 'Recebido' : 'Encaissé'}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           TAB 2: REVENUS
         ══════════════════════════════════════════════════════════════ */}
      {activeComptaTab === 'revenus' && (
        <div>
          {/* Search bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="v5-fi"
              placeholder={isPt ? 'Pesquisar uma fatura, um cliente\u2026' : 'Rechercher une facture, un client\u2026'}
              value={revenusSearch}
              onChange={e => setRevenusSearch(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <select
              className="v5-filter-sel"
              value={revenusFilter}
              onChange={e => setRevenusFilter(e.target.value)}
            >
              <option value="all">{isPt ? 'Todos os estados' : 'Tous statuts'}</option>
              <option value="completed">{isPt ? 'Recebido' : 'Encaissé'}</option>
            </select>
            <button
              className="v5-btn v5-btn-p"
              onClick={() => navigateTo?.('factures')}
              title={isPt ? 'Abrir o módulo Faturas' : 'Ouvrir le module Factures'}
            >
              + {isPt ? 'Nova fatura' : 'Nouvelle facture'}
            </button>
          </div>

          {/* Revenue table */}
          <div className="v5-card" style={{ overflow: 'hidden', padding: 0 }}>
            {filteredRevenus.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 12 }}>
                {isPt ? 'Nenhuma receita encontrada' : 'Aucun revenu trouvé'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="v5-dt">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{isPt ? 'Servi\u00e7o' : 'Service'}</th>
                      <th>Client</th>
                      <th>{isPt ? 's/IVA' : 'HT'}</th>
                      <th>{isPt ? 'c/IVA' : 'TTC'}</th>
                      <th>{isPt ? 'Estado' : 'Statut'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRevenus.sort((a, b) => (b.booking_date ?? '').localeCompare(a.booking_date ?? '')).map((b, idx) => {
                      const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || (isPt ? 'Cliente' : 'Client')
                      const serviceName = b.services?.name || (isPt ? 'Interven\u00e7ão' : 'Intervention')
                      const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                      return (
                        <tr key={b.id || idx}>
                          <td>{b.booking_date ? new Date(b.booking_date).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'short' }) : '—'}</td>
                          <td style={{ fontWeight: 600 }}>{serviceName}</td>
                          <td>{clientName}</td>
                          <td>{formatEur(ht)}</td>
                          <td style={{ fontWeight: 600 }}>{formatEur(b.price_ttc || 0)}</td>
                          <td><span className="badge badge-green">{isPt ? 'Recebido' : 'Encaissé'}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           TAB 3: DEPENSES
         ══════════════════════════════════════════════════════════════ */}
      {activeComptaTab === 'depenses' && (
        <div>
          {/* Search bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="v5-fi"
              placeholder={isPt ? 'Pesquisar uma despesa, um fornecedor\u2026' : 'Rechercher une charge, un fournisseur\u2026'}
              value={depensesSearch}
              onChange={e => setDepensesSearch(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <select
              className="v5-filter-sel"
              value={depensesFilter}
              onChange={e => setDepensesFilter(e.target.value)}
            >
              <option value="all">{isPt ? 'Todas as categorias' : 'Toutes catégories'}</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>
            <button className="v5-btn v5-btn-p" onClick={() => setShowAddExpense(true)}>
              + {isPt ? 'Adicionar despesa' : 'Ajouter une charge'}
            </button>
          </div>

          {/* Add expense form */}
          {showAddExpense && (
            <div className="v5-card" style={{ marginBottom: '1rem', border: '2px solid #FFC107' }}>
              <div className="v5-st">{isPt ? 'Nova despesa dedut\u00edvel' : 'Nouvelle charge déductible'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="v5-fg">
                  <label className="v5-fl">{isPt ? 'Descri\u00e7ão *' : 'Libellé *'}</label>
                  <input value={expenseForm.label} onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                    placeholder={isPt ? 'Ex: Compra de parafusos e buchas' : 'Ex: Achat vis et boulons'} className="v5-fi" />
                </div>
                <div className="v5-fg">
                  <label className="v5-fl">{isPt ? 'Montante c/IVA (\u20ac) *' : 'Montant TTC (\u20ac) *'}</label>
                  <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00" className="v5-fi" />
                </div>
                <div className="v5-fg">
                  <label className="v5-fl">{isPt ? 'Categoria' : 'Catégorie'}</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} className="v5-fi">
                    {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div className="v5-fg">
                  <label className="v5-fl">Date</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className="v5-fi" />
                </div>
                <div className="v5-fg" style={{ gridColumn: 'span 2' }}>
                  <label className="v5-fl">{isPt ? 'Notas (opcional)' : 'Notes (optionnel)'}</label>
                  <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder={isPt ? 'N\u00famero de fatura, fornecedor...' : 'Numéro de facture, fournisseur...'} className="v5-fi" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowAddExpense(false)} className="v5-btn" style={{ flex: 1 }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
                <button onClick={saveExpense} disabled={!expenseForm.label || !expenseForm.amount}
                  className="v5-btn v5-btn-p" style={{ flex: 1, opacity: (!expenseForm.label || !expenseForm.amount) ? 0.5 : 1 }}>
                  {isPt ? 'Guardar' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}

          {/* Expense KPI by top 4 categories */}
          {expenseByCategory.length > 0 && (
            <div className="cpta-kpi-g" style={{ marginBottom: '1rem' }}>
              {expenseByCategory.slice(0, 4).map(c => {
                const colorMap: Record<string, string> = {
                  materiel: '#1565C0', mainoeuvre: '#7B1FA2', outillage: '#EF6C00',
                  transport: '#00838F', assurance: '#2E7D32', formation: '#4527A0',
                  logiciel: '#1565C0', telephone: '#00695C', comptable: '#5D4037',
                  publicite: '#AD1457', bureau: '#37474F', autre: '#555',
                }
                const count = expenses.filter(e => e.category === c.key && e.date && new Date(e.date).getFullYear() === selectedYear).length
                return (
                  <div key={c.key} className="cpta-kpi">
                    <div className="cpta-kpi-lbl">{c.label}</div>
                    <div className="cpta-kpi-val" style={{ color: colorMap[c.key] || '#555', fontSize: 20 }}>{formatEur(c.total)}</div>
                    <div className="cpta-kpi-sub">{count} {isPt ? 'compra(s)' : 'achat(s)'}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Expenses table */}
          <div className="v5-card" style={{ overflow: 'hidden', padding: 0 }}>
            {searchedExpenses.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{'\uD83E\uDDFE'}</div>
                <div style={{ fontSize: 12 }}>{isPt ? 'Nenhuma despesa registada neste per\u00edodo' : 'Aucune charge enregistrée sur cette période'}</div>
                <button onClick={() => setShowAddExpense(true)} className="v5-btn v5-btn-sm" style={{ marginTop: 10 }}>
                  + {isPt ? 'Adicionar despesa' : 'Ajouter une charge'}
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="v5-dt">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>{isPt ? 'Descri\u00e7ão' : 'Libellé'}</th>
                      <th>{isPt ? 'Categoria' : 'Catégorie'}</th>
                      <th>{isPt ? 'Montante' : 'Montant'}</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedExpenses.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(e => {
                      const cat = EXPENSE_CATEGORIES.find(c => c.key === e.category)
                      const badgeColor: Record<string, string> = {
                        materiel: 'badge-blue', mainoeuvre: 'badge-purple', outillage: 'badge-orange',
                        transport: 'badge-green', assurance: 'badge-green', formation: 'badge-blue',
                        logiciel: 'badge-blue', telephone: 'badge-gray', comptable: 'badge-gray',
                        publicite: 'badge-yellow', bureau: 'badge-gray', autre: 'badge-gray',
                      }
                      return (
                        <tr key={e.id}>
                          <td>{e.date ? new Date(e.date).toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'short' }) : '—'}</td>
                          <td style={{ fontWeight: 600 }}>{e.label}</td>
                          <td><span className={`badge ${badgeColor[e.category || 'autre'] || 'badge-gray'}`}>{cat?.label || e.category}</span></td>
                          <td style={{ fontWeight: 600 }}>{formatEur(parseFloat(String(e.amount ?? 0)))}</td>
                          <td style={{ color: '#888', fontSize: 11 }}>{e.notes || '—'}</td>
                          <td>
                            <button
                              onClick={() => deleteExpense(e.id ?? '')}
                              className="v5-btn v5-btn-d v5-btn-sm"
                              title={isPt ? 'Eliminar' : 'Supprimer'}
                            >
                              {'\uD83D\uDDD1'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           TAB 4: DECLARATION
         ══════════════════════════════════════════════════════════════ */}
      {activeComptaTab === 'declaration' && (
        <div>
          {/* TVA + Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '.75rem', marginBottom: '1rem' }}>
            {/* TVA Declaration Card */}
            <div className="v5-card">
              <div className="v5-st">
                {isPt
                  ? `Declara\u00e7ão IVA — ${MONTH_FULL[selectedMonth]} ${selectedYear}`
                  : `Déclaration TVA — CA3 ${MONTH_FULL[selectedMonth]} ${selectedYear}`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '.75rem' }}>
                <div style={{ background: '#F5F5F5', borderRadius: 5, padding: '.75rem' }}>
                  <div style={{ fontSize: 10, color: '#999', marginBottom: 3, textTransform: 'uppercase', fontWeight: 600 }}>
                    {isPt ? 'IVA cobrado' : 'TVA collectée'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{formatEur(tvaCollectee)}</div>
                </div>
                <div style={{ background: '#F5F5F5', borderRadius: 5, padding: '.75rem' }}>
                  <div style={{ fontSize: 10, color: '#999', marginBottom: 3, textTransform: 'uppercase', fontWeight: 600 }}>
                    {isPt ? 'IVA dedut\u00edvel' : 'TVA déductible'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{formatEur(tvaDeductible)}</div>
                </div>
              </div>
              <div style={{ background: tvaCreditDebit >= 0 ? '#FFF8E1' : '#E8F5E9', border: `1px solid ${tvaCreditDebit >= 0 ? '#FFE082' : '#A5D6A7'}`, borderRadius: 5, padding: '.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: tvaCreditDebit >= 0 ? '#8B7D00' : '#2E7D32', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.2px' }}>
                    {tvaCreditDebit >= 0
                      ? (isPt ? 'IVA a pagar' : 'TVA \u00e0 payer')
                      : (isPt ? 'Crédito de IVA' : 'Crédit de TVA')}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                    {tvaCreditDebit >= 0
                      ? (isPt ? 'Montante a entregar ao Estado' : 'Montant \u00e0 reverser')
                      : (isPt ? 'Montante recuper\u00e1vel na pr\u00f3xima declara\u00e7ão' : 'Montant récupérable sur prochaine déclaration')}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: tvaCreditDebit >= 0 ? '#F57C00' : '#2E7D32' }}>
                  {tvaCreditDebit < 0 ? '\u2212' : ''}{formatEur(Math.abs(tvaCreditDebit))}
                </div>
              </div>
              <div style={{ marginTop: '.75rem', display: 'flex', gap: '.4rem' }}>
                <a
                  href={isPt ? 'https://www.portaldasfinancas.gov.pt/' : 'https://www.impots.gouv.fr/accueil'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="v5-btn v5-btn-p"
                  style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                >
                  {'\uD83D\uDCE4'} {isPt ? 'Submeter declara\u00e7ão' : 'Déposer CA3'}
                </a>
                <button
                  className="v5-btn"
                  onClick={() => {
                    const header = [isPt ? 'Período' : 'Période', isPt ? 'Montante' : 'Montant'].join(',')
                    const rows = [
                      header,
                      `${isPt ? 'Volume de negócios TTC' : 'CA TTC'} ${currentYear},${chiffreAffaires.toFixed(2)}`,
                      `${isPt ? 'Volume HT' : 'CA HT'} ${currentYear},${chiffreAffairesHT.toFixed(2)}`,
                      `${isPt ? 'IVA recolhido' : 'TVA collectée'},${tvaCollectee.toFixed(2)}`,
                      `${isPt ? 'IVA dedutível' : 'TVA déductible'},${tvaDeductible.toFixed(2)}`,
                      `${isPt ? 'Saldo IVA' : 'Solde TVA'},${tvaCreditDebit.toFixed(2)}`,
                    ].join('\n')
                    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `tva-${currentYear}.csv`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}
                >
                  {'\uD83D\uDCE5'} {isPt ? 'Descarregar CSV' : 'Télécharger CSV'}
                </button>
              </div>
            </div>

            {/* Fiscal Calendar */}
            <div className="v5-card">
              <div className="v5-st">{isPt ? `Calend\u00e1rio fiscal ${selectedYear}` : `Calendrier fiscal ${selectedYear}`}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {(isPt ? [
                  { title: 'Declara\u00e7ão Peri\u00f3dica IVA', sub: 'Trimestral', badge: '15 mai', badgeClass: 'badge-yellow', highlight: true },
                  { title: isEntreprise ? 'Acompanhamento IRC — 1\u00ba pagamento' : 'SS — Contribui\u00e7ão trimestral', sub: isEntreprise ? '15% do lucro N-1' : '21,4% sobre rend. relevante', badge: '15 mar', badgeClass: 'badge-blue', highlight: false },
                  { title: isEntreprise ? 'Modelo 22 (IRC)' : 'Modelo 3 IRS', sub: isEntreprise ? 'Dep\u00f3sito anual' : 'Entrega anual', badge: '30 abr', badgeClass: 'badge-orange', highlight: false },
                  { title: 'Declara\u00e7ão IVA + acompanhamento', sub: '2\u00ba pagamento', badge: '31 jul', badgeClass: 'badge-gray', highlight: false },
                ] : [
                  { title: isEntreprise ? 'CA3 — Déclaration TVA' : 'Déclaration URSSAF', sub: isEntreprise ? 'Mensuelle' : 'Trimestrielle', badge: '15 mai', badgeClass: 'badge-yellow', highlight: true },
                  { title: isEntreprise ? 'Acompte IS — 1er versement' : 'CFE — Cotisation fonci\u00e8re', sub: isEntreprise ? '15% du bénéfice N-1' : 'Avis d\'imposition', badge: '15 mars', badgeClass: 'badge-blue', highlight: false },
                  { title: isEntreprise ? 'Liasse fiscale' : 'Déclaration revenus', sub: isEntreprise ? `Dép\u00f4t 2065` : 'Mod\u00e8le 2042-C-PRO', badge: `30 avr. \u26A0\uFE0F`, badgeClass: 'badge-orange', highlight: false },
                  { title: 'Déclaration TVA + acompte IS', sub: '2e versement', badge: '31 juil.', badgeClass: 'badge-gray', highlight: false },
                ]).map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '.5rem .65rem', borderRadius: 4,
                    background: item.highlight ? '#FFF8E1' : '#F5F5F5',
                    borderLeft: item.highlight ? '3px solid #FFC107' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: '#999' }}>{item.sub}</div>
                    </div>
                    <span className={`badge ${item.badgeClass}`}>{item.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* IS Grid */}
          <div className="v5-card">
            <div className="v5-st">
              {isEntreprise
                ? (isPt ? `IRC — Imposto sobre as Sociedades estimado ${selectedYear}` : `IS — Imp\u00f4t sur les sociétés estimé ${selectedYear}`)
                : (isPt ? `Impostos estimados ${selectedYear}` : `Imp\u00f4t estimé ${selectedYear}`)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.75rem' }}>
              <div style={{ textAlign: 'center', padding: '.75rem', background: '#F5F5F5', borderRadius: 5 }}>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
                  {isPt ? 'Resultado fiscal' : 'Résultat fiscal'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: resultatNet >= 0 ? '#1a1a1a' : '#E53935' }}>
                  {formatEur(resultatNet)}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '.75rem', background: '#F5F5F5', borderRadius: 5 }}>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
                  {isEntreprise
                    ? (isPt ? 'Taxa IS aplic\u00e1vel' : 'Taux IS applicable')
                    : (isPt ? 'Taxa aplic\u00e1vel' : 'Taux applicable')}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1565C0' }}>
                  {isEntreprise ? '15%' : isPt ? '21,4% SS' : '21,2% URSSAF'}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '.75rem', background: '#F5F5F5', borderRadius: 5 }}>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
                  {isEntreprise ? (isPt ? 'IS estimado' : 'IS estimé') : (isPt ? 'Contribui\u00e7\u00f5es est.' : 'Cotisations est.')}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#43A047' }}>
                  {formatEur(isEntreprise ? impotRevenu : cotisationsSociales)}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '.75rem', background: '#FFF8E1', borderRadius: 5, border: '1px solid #FFE082' }}>
                <div style={{ fontSize: 10, color: '#8B7D00', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
                  {isPt ? 'Provisão aconselhada' : 'Provision conseillée'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F57C00' }}>
                  {formatEur(Math.max(0, isEntreprise ? impotRevenu * 0.25 : cotisationsSociales / 4))}
                </div>
              </div>
            </div>
          </div>

          {/* TVA auto-activate toggle */}
          <div className="v5-card" style={{ marginTop: '.75rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>
                  {isPt
                    ? '\uD83D\uDD14 Ativar IVA automaticamente ao ultrapassar o limite'
                    : '\uD83D\uDD14 Activer la TVA automatiquement d\u00e8s dépassement du seuil'}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {isPt
                    ? 'Receba alertas imediatos e acompanhe a sua obriga\u00e7ão de registo no IVA'
                    : 'Recevez des alertes immédiates et suivez votre obligation de passage \u00e0 la TVA'}
                </div>
              </div>
              <button
                onClick={() => toggleTvaAutoActivate(!tvaAutoActivate)}
                disabled={tvaTogglingLoading}
                aria-pressed={tvaAutoActivate}
                style={{
                  flexShrink: 0, width: 44, height: 24, borderRadius: 12,
                  background: tvaAutoActivate ? '#FFC107' : '#E0E0E0',
                  border: 'none', cursor: tvaTogglingLoading ? 'not-allowed' : 'pointer',
                  position: 'relative', transition: 'background 0.2s',
                  opacity: tvaTogglingLoading ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, borderRadius: '50%',
                  width: 18, height: 18, background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  left: tvaAutoActivate ? 23 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
           TAB 5: ASSISTANT IA (design v7) — FAQ en chips haut + chat pleine largeur
         ══════════════════════════════════════════════════════════════ */}
      {activeComptaTab === 'assistant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', width: '100%' }}>
          {/* FAQ chips — ribbon haut */}
          <div className="card" style={{ padding: '.65rem .9rem' }}>
            <div className="st" style={{ marginBottom: '.5rem' }}>{isPt ? 'Perguntas frequentes' : 'Questions fréquentes'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              {[
                isPt ? '💡 Qual é a minha taxa de IVA aplicável?' : '💡 Quel est mon taux de TVA applicable ?',
                isPt ? `📊 Resumo do mês de ${MONTH_FULL[currentMonth]} ${currentYear}` : `📊 Résumé du mois de ${MONTH_FULL[currentMonth]} ${currentYear}`,
                isPt ? '📅 Próximas obrigações fiscais?' : '📅 Prochaines obligations fiscales ?',
                isPt ? '🧾 Como otimizar as minhas despesas?' : '🧾 Comment optimiser mes charges ?',
                isPt ? `📈 Projeção do volume de negócios fim de ${currentYear}` : `📈 Projection CA fin d'année ${currentYear}`,
              ].map((q, i) => (
                <button
                  key={i}
                  className="btn"
                  style={{ padding: '.35rem .75rem', fontSize: '.85rem', lineHeight: 1.3, cursor: 'pointer', borderRadius: '16px' }}
                  onClick={() => window.dispatchEvent(new CustomEvent('lea-ask', { detail: q }))}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          {/* Chat Léa — pleine largeur */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <AgentComptable
              bookings={bookings}
              artisan={artisan}
              services={services}
              expenses={expenses}
              annualHT={annualHT}
              annualCA={bookings.filter(b => b.status === 'completed' && b.booking_date && new Date(b.booking_date).getFullYear() === currentYear).reduce((s, b) => s + (b.price_ttc || 0), 0)}
              totalExpenses={expenses.filter(e => e.date && new Date(e.date).getFullYear() === currentYear).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0)}
              quarterData={quarterData}
              currentMonth={currentMonth}
              currentYear={currentYear}
              formatEur={formatEur}
              orgRole={orgRole}
            />
          </div>
        </div>
      )}
    </div>
  )
}
