'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { LeaAvatar } from '@/components/common/RobotAvatars'
import { useThemeVars } from './useThemeVars'
import { useLocale } from '@/lib/i18n/context'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { supabase } from '@/lib/supabase'
import DeclarationSocialeSection from '@/components/dashboard/DeclarationSocialeSection'
import { getTvaStatus, type TvaCountry, type TvaStatusResult } from '@/lib/tva-thresholds'

/* ══════════ AGENT COMPTABLE LÉA ══════════ */

interface Expense { id?: string; label?: string; amount?: number | string; category?: string; date?: string; notes?: string }

function AgentComptable({ bookings, artisan, services, expenses, annualHT, annualCA, totalExpenses, quarterData, currentMonth, currentYear, formatEur, orgRole }: {
  bookings: import('@/lib/types').Booking[]; artisan: import('@/lib/types').Artisan; services: import('@/lib/types').Service[]; expenses: Expense[]; annualHT: number; annualCA: number; totalExpenses: number; quarterData: number[]; currentMonth: number; currentYear: number; formatEur: (v: number) => string; orgRole?: string
}) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
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

  const financialContext = {
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
    // ── DONNÉES BRUTES COMPLÈTES (pour calculs sur période)
    allBookings: allBookingsEnriched,   // Toutes les interventions avec client + service résolus
    allExpenses: expenses,              // Toutes les dépenses avec date, catégorie, montant, notes
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

export default function ComptabiliteSection({ bookings, artisan, services, orgRole }: { bookings: import('@/lib/types').Booking[]; artisan: import('@/lib/types').Artisan; services: import('@/lib/types').Service[]; orgRole?: string }) {
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
  const [exportMonth, setExportMonth] = useState(currentMonth)

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
  const isEntreprise = orgRole === 'pro_societe'
  // Micro-entrepreneur only if artisan role AND under threshold
  const isAutoEntrepreneur = !isEntreprise && (isPt ? annualHT < 200000 : annualHT < 77700)

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
    impotRevenu = annualHT * 0.011
    resultatApresCharges = annualHT - cotisationsSociales
  }

  const formatEur = (v: number) => new Intl.NumberFormat(dateFmtLocale, { style: 'currency', currency: 'EUR' }).format(v)

  // ── TVA : calcul status en temps réel ────────────────────────────────────
  const tvaCountry: TvaCountry = ((artisan as unknown as { country?: string })?.country || (isPt ? 'PT' : 'FR')) as TvaCountry
  const tvaStatus: TvaStatusResult = getTvaStatus(annualHT, tvaCountry)

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
      } catch {}
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
      } catch {}
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

  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)

  /* ── Tab style helpers (v22 compta-tab pattern) ── */
  const tabStyle = (active: boolean): React.CSSProperties => isV5 ? {} : ({
    fontSize: 12, fontWeight: active ? 600 : 500, padding: '8px 16px',
    borderBottom: `2px solid ${active ? tv.primary : 'transparent'}`,
    background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
    borderBottomColor: active ? tv.primary : 'transparent',
    cursor: 'pointer', color: active ? tv.text : tv.textMuted,
    whiteSpace: 'nowrap', transition: 'all 0.15s',
  })

  const pillStyle = (active: boolean): React.CSSProperties => isV5 ? {} : ({
    fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
    border: active ? 'none' : `1px solid ${tv.border}`,
    background: active ? tv.primary : tv.cardBg,
    color: active ? tv.text : tv.textMuted,
    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
  })

  return (
    <div className={isV5 ? 'v5-fade' : ''}>
      {/* Page header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'} style={isV5 ? { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' } : undefined}>
        <div>
          {isV5
            ? <><h1>{isPt ? 'Contabilidade & Fiscalidade' : 'Comptabilite & Fiscalite'}</h1><p>{isPt ? 'Gestao contabilistica e agente IA Lea' : 'Gestion comptable et agent IA Lea'}</p></>
            : <><h1 className="v22-page-title">{isPt ? '🧮 Contabilidade & Fiscalidade' : '🧮 Comptabilité & Fiscalité'}</h1><p className="v22-page-sub">{isPt ? 'Gestão contabilística e agente IA Léa' : 'Gestion comptable et agent IA Léa'}</p></>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className={isV5 ? 'v5-filter-sel' : 'v22-form-input'} style={{ width: 'auto', padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={isV5 ? { display: 'flex', gap: 4 } : { display: 'flex', background: tv.bg, borderRadius: 6, overflow: 'hidden', border: `1px solid ${tv.border}` }}>
            {(['mois', 'trimestre', 'annee'] as const).map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)}
                className={isV5 ? `v5-btn v5-btn-sm${selectedPeriod === p ? ' v5-btn-p' : ''}` : ''}
                style={pillStyle(selectedPeriod === p)}>
                {isPt
                  ? (p === 'mois' ? 'Mes' : p === 'trimestre' ? 'Trimestre' : 'Ano')
                  : (p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Annee')}
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
              <button key={i} onClick={() => setSelectedMonthC(i)}
                className={isV5 ? `v5-btn v5-btn-sm${selectedMonth === i ? ' v5-btn-p' : ''}` : ''}
                style={pillStyle(selectedMonth === i)}>
                {m}
              </button>
            ))}
          </div>
        )}
        {selectedPeriod === 'trimestre' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[0, 1, 2, 3].map(q => (
              <button key={q} onClick={() => setSelectedMonthC(q * 3)}
                className={isV5 ? `v5-btn v5-btn-sm${getQuarter() === q ? ' v5-btn-p' : ''}` : ''}
                style={isV5 ? { flex: 1 } : { ...pillStyle(getQuarter() === q), flex: 1 }}>
                {quarterLabels[q]}
              </button>
            ))}
          </div>
        )}

        {/* Sub-tabs */}
        <div className={isV5 ? 'v5-tabs' : ''} style={isV5 ? { marginBottom: 20 } : { display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${tv.border}` }}>
          {(isPt ? ([
            { key: 'dashboard' as const, label: 'Painel' },
            { key: 'revenus' as const, label: 'Receitas' },
            { key: 'depenses' as const, label: 'Despesas' },
            { key: 'declaration' as const, label: 'Declaracoes' },
            { key: 'assistant' as const, label: 'Assistente IA' },
          ]) : ([
            { key: 'dashboard' as const, label: 'Tableau de bord' },
            { key: 'revenus' as const, label: 'Revenus' },
            { key: 'depenses' as const, label: 'Depenses' },
            { key: 'declaration' as const, label: 'Declaration' },
            { key: 'assistant' as const, label: 'Assistant IA' },
          ])).map(t => (
            <button key={t.key} onClick={() => setActiveComptaTab(t.key)}
              className={isV5 ? `v5-tab-b${activeComptaTab === t.key ? ' active' : ''}` : ''}
              style={tabStyle(activeComptaTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeComptaTab === 'dashboard' && (
          <div>
            {/* KPI Cards */}
            <div className={isV5 ? 'v5-kpi-g' : 'v22-stats'} style={{ marginBottom: 24 }}>
              <div className={isV5 ? 'v5-kpi' : 'v22-stat'} style={isV5 ? undefined : { borderLeft: `3px solid ${tv.green}` }}>
                <div className={isV5 ? 'v5-kpi-l' : 'v22-stat-label'}>{isPt ? 'Faturacao c/IVA' : 'Chiffre d\'affaires TTC'}</div>
                <div className={isV5 ? 'v5-kpi-v' : 'v22-stat-val'} style={{ color: isV5 ? '#2E7D32' : tv.green, fontSize: isV5 ? undefined : 22 }}>{formatEur(chiffreAffaires)}</div>
                <div className={isV5 ? 'v5-kpi-s' : ''} style={isV5 ? undefined : { fontSize: 11, color: tv.textMuted }}>{completedFiltered.length} {isPt ? 'intervencao(oes)' : 'intervention(s)'}</div>
              </div>
              <div className={isV5 ? 'v5-kpi' : 'v22-stat'} style={isV5 ? undefined : { borderLeft: '3px solid #3b82f6' }}>
                <div className={isV5 ? 'v5-kpi-l' : 'v22-stat-label'}>{isPt ? 'Faturacao s/IVA' : 'CA Hors Taxes'}</div>
                <div className={isV5 ? 'v5-kpi-v' : 'v22-stat-val'} style={{ color: '#3b82f6', fontSize: isV5 ? undefined : 22 }}>{formatEur(chiffreAffairesHT)}</div>
                <div className={isV5 ? 'v5-kpi-s' : ''} style={isV5 ? undefined : { fontSize: 11, color: tv.textMuted }}>{isPt ? 'IVA' : 'TVA'} : {formatEur(tvaCollectee)}</div>
              </div>
              <div className={isV5 ? 'v5-kpi' : 'v22-stat'} style={isV5 ? undefined : { borderLeft: `3px solid ${tv.red}` }}>
                <div className={isV5 ? 'v5-kpi-l' : 'v22-stat-label'}>{isPt ? 'Despesas dedutiveis' : 'Charges deductibles'}</div>
                <div className={isV5 ? 'v5-kpi-v' : 'v22-stat-val'} style={{ color: isV5 ? '#C62828' : tv.red, fontSize: isV5 ? undefined : 22 }}>{formatEur(totalExpenses)}</div>
                <div className={isV5 ? 'v5-kpi-s' : ''} style={isV5 ? undefined : { fontSize: 11, color: tv.textMuted }}>{filteredExpenses.length} {isPt ? 'despesa(s)' : 'depense(s)'}</div>
              </div>
              <div className={isV5 ? `v5-kpi${resultatNet >= 0 ? ' hl' : ''}` : `v22-stat ${resultatNet >= 0 ? 'v22-stat-yellow' : ''}`} style={!isV5 && resultatNet < 0 ? { borderLeft: `3px solid ${tv.red}` } : undefined}>
                <div className={isV5 ? 'v5-kpi-l' : 'v22-stat-label'}>{isPt ? 'Resultado liquido' : 'Resultat net'}</div>
                <div className={isV5 ? 'v5-kpi-v' : 'v22-stat-val'} style={{ color: resultatNet >= 0 ? (isV5 ? '#1a1a1a' : tv.text) : (isV5 ? '#C62828' : tv.red), fontSize: isV5 ? undefined : 22 }}>{formatEur(resultatNet)}</div>
                <div className={isV5 ? 'v5-kpi-s' : ''} style={isV5 ? undefined : { fontSize: 11, color: tv.textMuted }}>{isPt ? 'antes de impostos' : 'avant impots'}</div>
              </div>
            </div>

            {/* ── TVA STATUS CARD ── */}
            {selectedPeriod === 'annee' || selectedYear === currentYear ? (
              <div className={isV5 ? 'v5-card' : 'v22-card'} style={isV5 ? { marginBottom: 20 } : { marginBottom: 20, borderLeft: `3px solid ${tvaStatus.color}`, background: tvaStatus.bgColor }}>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: tvaStatus.color }}>
                          {isPt ? tvaStatus.title.pt : tvaStatus.title.fr}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                          color: tvaStatus.color, border: `1px solid ${tvaStatus.color}`,
                          borderRadius: 3, padding: '2px 5px',
                        }}>
                          {isPt ? tvaStatus.badge.pt : tvaStatus.badge.fr}
                        </span>
                      </div>
                      <p style={{ fontSize: 11.5, color: tv.textMuted, lineHeight: 1.5, margin: 0, marginBottom: 10 }}>
                        {isPt ? tvaStatus.message.pt : tvaStatus.message.fr}
                      </p>
                      {/* Barre de progression */}
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tv.textMuted, marginBottom: 4 }}>
                          <span>0</span>
                          <span style={{ color: tvaStatus.color, fontWeight: 600 }}>
                            {tvaStatus.percent}% {isPt ? 'do limite' : 'du seuil'}
                          </span>
                          <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(tvaStatus.seuil)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: tv.border, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            background: tvaStatus.color,
                            width: `${Math.min(tvaStatus.percent, 100)}%`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                        {tvaStatus.seuilMajore && (
                          <div style={{ fontSize: 10, color: tv.textMuted, marginTop: 4 }}>
                            {isPt ? 'Limite majorado' : 'Seuil majoré'} : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(tvaStatus.seuilMajore)}
                            {' · '}{isPt ? 'Taxa aplicável' : 'Taux applicable'} : {(tvaStatus.taux * 100).toFixed(0)} %
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setActiveComptaTab('declaration')}
                        className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn'}
                        style={isV5 ? { color: tvaStatus.color } : { fontSize: 11, padding: '5px 10px', border: `1px solid ${tvaStatus.color}`, color: tvaStatus.color, background: 'transparent' }}
                      >
                        {isPt ? 'Ver detalhes →' : 'Voir détails →'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Revenue chart */}
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 20 }}>
              <div className={isV5 ? '' : 'v22-card-head'}><div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? `📈 Evolução da faturação mensal ${selectedYear}` : `📈 Évolution du CA mensuel ${selectedYear}`}</div></div>
              <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                  {monthlyRevenue.map((m, i) => (
                    <div key={i} className={isV5 ? 'v5-ch-bar' : ''} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div className={isV5 ? 'v5-ch-bar-v' : ''} style={isV5 ? {} : { fontSize: 9, color: tv.textMuted, fontWeight: 600 }}>
                        {m.ca > 0 ? formatEur(m.ca).replace('€', '') + '€' : ''}
                      </div>
                      <div
                        className={isV5 ? 'v5-ch-bar-i' : ''}
                        style={{
                          width: '100%', borderRadius: '4px 4px 0 0', transition: 'all 0.2s',
                          height: `${Math.max(4, (m.ca / maxCA) * 100)}%`,
                          background: (i === currentMonth && selectedYear === currentYear) ? (isV5 ? 'var(--v5-accent, #FFC107)' : tv.primary) : '#dbeafe',
                        }}
                      />
                      <div className={isV5 ? 'v5-ch-bar-lb' : ''} style={isV5 ? {} : { fontSize: 9, color: tv.textMuted }}>{m.month}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Health indicator */}
            <div className={isV5 ? 'v5-kpi-g' : ''} style={isV5 ? {} : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className={isV5 ? 'v5-kpi' : 'v22-card'} style={isV5 ? {} : { background: tv.greenLight, borderColor: tv.green, padding: 16 }}>
                <div className={isV5 ? 'v5-kpi-l' : ''} style={isV5 ? {} : { fontWeight: 600, color: tv.green, marginBottom: 6 }}>✅ {isPt ? 'Estatuto fiscal' : 'Statut fiscal'}</div>
                <div className={isV5 ? 'v5-kpi-v' : ''} style={isV5 ? { fontSize: 13 } : { fontSize: 13, color: tv.green }}>
                  {isEntreprise
                    ? (isPt ? 'Empresa (Regime Real)' : 'Société BTP (Régime réel)')
                    : isPt
                      ? (isAutoEntrepreneur ? 'Regime Simplificado (Recibos Verdes)' : '⚠️ Ultrapassou o limite!')
                      : (isAutoEntrepreneur ? 'Micro-entrepreneur' : 'Dépassement plafond !')}
                </div>
                <div className={isV5 ? 'v5-kpi-s' : ''} style={isV5 ? {} : { fontSize: 11, color: tv.green, marginTop: 4 }}>
                  {isEntreprise
                    ? (isPt ? 'IS 15% ≤42 500€ · 25% além' : 'IS 15% ≤42 500€ · 25% au-delà')
                    : <>{isPt ? 'Faturação anual' : 'CA annuel'} : {formatEur(bookings.filter(b => b.status === 'completed' && b.booking_date && new Date(b.booking_date).getFullYear() === selectedYear).reduce((s, b) => s + (b.price_ht || 0), 0))}
                  {' / '}{isPt ? '200 000 €' : '77 700 €'}</>}
                </div>
              </div>
              <div className={isV5 ? 'v5-kpi' : 'v22-card'} style={isV5 ? {} : { background: '#EFF6FF', borderColor: '#3b82f6', padding: 16 }}>
                <div className={isV5 ? 'v5-kpi-l' : ''} style={isV5 ? {} : { fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>
                  {isEntreprise
                    ? (isPt ? '💳 IS estimado' : '💳 IS estimé')
                    : (isPt ? '💳 Contrib. estimadas' : '💳 Cotisations estimées')}
                </div>
                <div className={isV5 ? 'v5-kpi-v' : ''} style={isV5 ? {} : { fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{formatEur(isEntreprise ? impotRevenu : cotisationsSociales)}</div>
                <div className={isV5 ? 'v5-kpi-s' : ''} style={isV5 ? {} : { fontSize: 11, color: '#2563eb', marginTop: 4 }}>
                  {isEntreprise
                    ? (isPt ? 'IS estimado sobre resultado' : 'IS estimé sur résultat')
                    : (isPt ? '21,4% SS sobre rend. relevante (70%)' : '21,7% du CA HT annuel')}
                </div>
              </div>
              <div className={isV5 ? 'v5-kpi' : 'v22-card'} style={isV5 ? {} : { background: tv.primaryLight, borderColor: tv.primary, padding: 16 }}>
                <div className={isV5 ? 'v5-kpi-l' : ''} style={isV5 ? {} : { fontWeight: 600, color: tv.primary, marginBottom: 6 }}>📋 {isPt ? 'Próxima declaração' : 'Prochaine déclaration'}</div>
                <div className={isV5 ? 'v5-kpi-v' : ''} style={isV5 ? { fontSize: 13 } : { fontSize: 13, color: '#92400e', fontWeight: 600 }}>
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
                <div className={isV5 ? 'v5-kpi-s' : ''} style={isV5 ? {} : { fontSize: 11, color: tv.primary, marginTop: 4 }}>
                  {isEntreprise
                    ? (isPt ? 'Declaração IVA + IRC trimestral' : 'Déclaration TVA + acompte IS')
                    : (isPt ? 'Declaração Periódica IVA (trimestral)' : 'Déclaration URSSAF trimestrielle')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUS TAB ── */}
        {activeComptaTab === 'revenus' && (
          <div>
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <div className={isV5 ? '' : 'v22-card-head'}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'}>
                  {isPt ? '💰 Receitas — ' : '💰 Revenus — '}{selectedPeriod === 'mois' ? MONTH_FULL[selectedMonth] : selectedPeriod === 'trimestre' ? quarterLabels[getQuarter()] : selectedYear}
                </div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', gap: 20 }}>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: tv.green }}>{formatEur(chiffreAffaires)}</span><span style={{ fontSize: 11, color: tv.textMuted, marginLeft: 4 }}>{isPt ? 'c/IVA' : 'TTC'}</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{formatEur(chiffreAffairesHT)}</span><span style={{ fontSize: 11, color: tv.textMuted, marginLeft: 4 }}>{isPt ? 's/IVA' : 'HT'}</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: tv.textMuted }}>{formatEur(tvaCollectee)}</span><span style={{ fontSize: 11, color: tv.textMuted, marginLeft: 4 }}>{isPt ? 'IVA 23%' : 'TVA 20%'}</span></div>
              </div>
              {completedFiltered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: tv.textMuted }}>{isPt ? 'Nenhuma intervenção concluída neste período' : 'Aucune intervention terminée sur cette période'}</div>
              ) : (
                <table className={isV5 ? 'v5-dt' : ''} style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: tv.bg }}>
                      <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: tv.textMuted, fontWeight: 600 }}>Data</th>
                      <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: tv.textMuted, fontWeight: 600 }}>{isPt ? 'Cliente / Serviço' : 'Client / Service'}</th>
                      <th style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: tv.textMuted, fontWeight: 600 }}>{isPt ? 's/IVA' : 'HT'}</th>
                      <th style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: tv.textMuted, fontWeight: 600 }}>{isPt ? 'IVA' : 'TVA'}</th>
                      <th style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: tv.textMuted, fontWeight: 600 }}>{isPt ? 'c/IVA' : 'TTC'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedFiltered.sort((a, b) => (b.booking_date ?? '').localeCompare(a.booking_date ?? '')).map(b => {
                      const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                      const ht = b.price_ht || (b.price_ttc || 0) / 1.2
                      const tva = (b.price_ttc || 0) - ht
                      return (
                        <tr key={b.id} style={{ borderTop: `1px solid ${tv.border}` }}>
                          <td style={{ padding: '10px 16px', color: tv.textMuted }}>{b.booking_date ? new Date(b.booking_date).toLocaleDateString(dateFmtLocale) : ''}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <div className="v22-client-name">{clientName}</div>
                            <div style={{ fontSize: 11, color: tv.textMuted }}>{b.services?.name}</div>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{formatEur(ht)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: tv.textMuted }}>{formatEur(tva)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: tv.green }}>{formatEur(b.price_ttc || 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: tv.bg, borderTop: `2px solid ${tv.borderDark}` }}>
                      <td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700 }}>{isPt ? 'TOTAL' : 'TOTAL'}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{formatEur(chiffreAffairesHT)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: tv.textMuted }}>{formatEur(tvaCollectee)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: tv.green }}>{formatEur(chiffreAffaires)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Revenue by service */}
            {services.length > 0 && (
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'}><div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? `🔧 Faturação por serviço (${selectedYear})` : `🔧 CA par motif (${selectedYear})`}</div></div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {services.map(s => {
                    const sBookings = bookings.filter(b => b.service_id === s.id && b.status === 'completed' && b.booking_date && new Date(b.booking_date).getFullYear() === selectedYear)
                    const sCA = sBookings.reduce((sum, b) => sum + (b.price_ttc || 0), 0)
                    const pct = maxCA > 0 ? (sCA / (chiffreAffaires || 1)) * 100 : 0
                    return (
                      <div key={s.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500 }}>{s.name}</span>
                          <span style={{ fontWeight: 700, color: tv.green }}>{formatEur(sCA)} ({sBookings.length} RDV)</span>
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
                <div className={isV5 ? 'v5-st' : ''} style={isV5 ? {} : { fontWeight: 700, fontSize: 15 }}>{isPt ? '🧾 Despesas dedutíveis' : '🧾 Charges déductibles'}</div>
                <div style={{ fontSize: 13, color: tv.textMuted }}>{isPt ? 'Total' : 'Total'} : <span style={{ fontWeight: 700, color: tv.red }}>{formatEur(totalExpenses)}</span></div>
              </div>
              <button onClick={() => setShowAddExpense(true)} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}>
                {isPt ? '+ Adicionar despesa' : '+ Ajouter une charge'}
              </button>
            </div>

            {showAddExpense && (
              <div className={isV5 ? 'v5-card' : 'v22-card'} style={isV5 ? { marginBottom: 16 } : { borderColor: tv.primary, borderWidth: 2, marginBottom: 16 }}>
                <div className={isV5 ? '' : 'v22-card-head'}><div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Nova despesa dedutível' : 'Nouvelle charge déductible'}</div></div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div className={isV5 ? 'v5-fg' : ''}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Descrição *' : 'Libellé *'}</label>
                      <input value={expenseForm.label} onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                        placeholder={isPt ? 'Ex: Compra de parafusos e buchas' : 'Ex: Achat vis et boulons'} className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : ''}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Montante c/IVA (€) *' : 'Montant TTC (€) *'}</label>
                      <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00" className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : ''}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Categoria' : 'Catégorie'}</label>
                      <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'}>
                        {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                      </select>
                    </div>
                    <div className={isV5 ? 'v5-fg' : ''}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Data</label>
                      <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : ''} style={{ gridColumn: 'span 2' }}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Notas (opcional)' : 'Notes (optionnel)'}</label>
                      <input value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder={isPt ? 'Número de fatura, fornecedor...' : 'Numéro de facture, fournisseur...'} className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowAddExpense(false)} className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1 }}>{isPt ? 'Cancelar' : 'Annuler'}</button>
                    <button onClick={saveExpense} disabled={!expenseForm.label || !expenseForm.amount}
                      className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ flex: 1, opacity: (!expenseForm.label || !expenseForm.amount) ? 0.5 : 1 }}>{isPt ? 'Guardar' : 'Enregistrer'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown by category */}
            {expenseByCategory.length > 0 && (
              <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
                <div className={isV5 ? '' : 'v22-card-head'}><div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Distribuição por categoria' : 'Répartition par catégorie'}</div></div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {expenseByCategory.map(c => (
                    <div key={c.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>{c.icon} {c.label}</span>
                        <span style={{ fontWeight: 700, color: tv.red }}>{formatEur(c.total)}</span>
                      </div>
                      <div className="v22-prog-bar">
                        <div className="v22-prog-fill" style={{ width: `${(c.total / (totalExpenses || 1)) * 100}%`, background: tv.red }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses list */}
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 0, overflow: 'hidden' }}>
              <div className={isV5 ? '' : 'v22-card-head'}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'}>
                  {isPt ? `Lista de despesas (${filteredExpenses.length})` : `Liste des charges (${filteredExpenses.length})`}
                </div>
              </div>
              {filteredExpenses.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: tv.textMuted }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🧾</div>
                  <div>{isPt ? 'Nenhuma despesa registada neste período' : 'Aucune charge enregistrée sur cette période'}</div>
                  <button onClick={() => setShowAddExpense(true)} className={isV5 ? 'v5-btn v5-btn-sm' : ''} style={isV5 ? { marginTop: 10 } : { marginTop: 10, color: tv.primary, fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>{isPt ? '+ Adicionar despesa' : '+ Ajouter une charge'}</button>
                </div>
              ) : (
                <div>
                  {filteredExpenses.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(e => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.key === e.category)
                    return (
                      <div key={e.id} className="expense-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: `1px solid ${tv.border}` }}>
                        <div style={{ fontSize: 20 }}>{cat?.icon || '📦'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{e.label}</div>
                          <div style={{ fontSize: 11, color: tv.textMuted }}>{cat?.label} · {e.date ? new Date(e.date).toLocaleDateString(dateFmtLocale) : ''}</div>
                          {e.notes && <div style={{ fontSize: 11, color: tv.textMuted, fontStyle: 'italic' }}>{e.notes}</div>}
                        </div>
                        <div className="v22-amount" style={{ color: tv.red }}>{formatEur(parseFloat(String(e.amount ?? 0)))}</div>
                        <button onClick={() => deleteExpense(e.id ?? '')}
                          style={{ opacity: 0, color: tv.red, cursor: 'pointer', background: 'none', border: 'none', fontSize: 16, marginLeft: 6, transition: 'opacity 0.15s' }}
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
          <div>
            {/* ── BLOC TVA / IVA ─────────────────────────────────────────────── */}
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={isV5 ? { marginBottom: 20 } : { marginBottom: 20, borderLeft: `3px solid ${tvaStatus.color}` }}>
              <div className={isV5 ? '' : 'v22-card-head'} style={isV5 ? { padding: '10px 14px', borderBottom: '1px solid #E8E8E8' } : undefined}>
                <div className={isV5 ? 'v5-st' : 'v22-card-title'}>
                  {isPt ? '🧾 Situação de IVA' : '🧾 Statut TVA'}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  color: tvaStatus.color, border: `1px solid ${tvaStatus.color}`,
                  borderRadius: 3, padding: '2px 6px',
                }}>
                  {isPt ? tvaStatus.badge.pt : tvaStatus.badge.fr}
                </span>
              </div>
              <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: 16 }}>

                {/* Jauge */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: tv.textMuted }}>
                      {isPt ? 'Volume de negócios HT' : 'CA HT annuel'} : <strong style={{ color: tv.text }}>{formatEur(annualHT)}</strong>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: tvaStatus.color }}>
                      {tvaStatus.percent}%
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: tv.border, overflow: 'hidden', position: 'relative' }}>
                    {/* Marqueur 80% */}
                    <div style={{ position: 'absolute', left: '80%', top: 0, bottom: 0, width: 1, background: '#eab308', zIndex: 1 }} />
                    <div style={{
                      height: '100%', borderRadius: 5,
                      background: tvaStatus.status === 'safe'
                        ? 'linear-gradient(90deg, #22c55e, #86efac)'
                        : tvaStatus.status === 'warning'
                        ? 'linear-gradient(90deg, #eab308, #fde047)'
                        : 'linear-gradient(90deg, #f97316, #ef4444)',
                      width: `${Math.min(tvaStatus.percent, 100)}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: tv.textMuted, marginTop: 3 }}>
                    <span>0</span>
                    <span style={{ color: '#eab308' }}>80%</span>
                    <span>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(tvaStatus.seuil)}</span>
                  </div>
                </div>

                {/* Message contextuel */}
                <div style={{ fontSize: 12, color: tv.textMuted, lineHeight: 1.6, marginBottom: 16, padding: '10px 12px', borderRadius: 6, background: tvaStatus.bgColor }}>
                  {isPt ? tvaStatus.message.pt : tvaStatus.message.fr}
                </div>

                {/* Détails techniques */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 6, background: tv.bg, border: `1px solid ${tv.border}` }}>
                    <div style={{ fontSize: 10, color: tv.textMuted, marginBottom: 3 }}>
                      {isPt ? 'Limite de isenção' : 'Seuil de franchise'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tv.text }}>
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(tvaStatus.seuil)}
                    </div>
                  </div>
                  {tvaStatus.seuilMajore && (
                    <div style={{ padding: '10px 12px', borderRadius: 6, background: tv.bg, border: `1px solid ${tv.border}` }}>
                      <div style={{ fontSize: 10, color: tv.textMuted, marginBottom: 3 }}>
                        {isPt ? 'Limite majorado' : 'Seuil majoré'}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: tv.text }}>
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(tvaStatus.seuilMajore)}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '10px 12px', borderRadius: 6, background: tv.bg, border: `1px solid ${tv.border}` }}>
                    <div style={{ fontSize: 10, color: tv.textMuted, marginBottom: 3 }}>
                      {isPt ? 'Taxa de IVA aplicável' : 'Taux TVA applicable'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tv.text }}>
                      {(tvaStatus.taux * 100).toFixed(0)} %
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 6, background: tv.bg, border: `1px solid ${tv.border}` }}>
                    <div style={{ fontSize: 10, color: tv.textMuted, marginBottom: 3 }}>
                      {isPt ? 'IVA estimado se aplicável' : 'TVA estimée si applicable'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tv.text }}>
                      {formatEur(annualHT * tvaStatus.taux)}
                    </div>
                  </div>
                </div>

                {/* Toggle activation automatique */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 8,
                  border: `1px solid ${tv.border}`, background: tv.cardBg,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: tv.text, marginBottom: 2 }}>
                      {isPt
                        ? '🔔 Ativar IVA automaticamente ao ultrapassar o limite'
                        : '🔔 Activer la TVA automatiquement dès dépassement du seuil'}
                    </div>
                    <div style={{ fontSize: 11, color: tv.textMuted }}>
                      {isPt
                        ? 'Receba alertas imediatos e acompanhe a sua obrigação de registo no IVA'
                        : 'Recevez des alertes immédiates et suivez votre obligation de passage à la TVA'}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleTvaAutoActivate(!tvaAutoActivate)}
                    disabled={tvaTogglingLoading}
                    aria-pressed={tvaAutoActivate}
                    style={{
                      flexShrink: 0, marginLeft: 16,
                      width: 44, height: 24, borderRadius: 12,
                      background: tvaAutoActivate ? tv.primary : tv.border,
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

                {/* Aide contextuelle FR */}
                {!isPt && tvaStatus.status !== 'safe' && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, background: tv.bg, border: `1px solid ${tv.border}`, fontSize: 11, color: tv.textMuted, lineHeight: 1.6 }}>
                    <strong style={{ color: tv.text }}>📋 Mentions obligatoires sur vos factures :</strong>
                    <br />
                    {'Une fois assujetti, indiquez le taux TVA (20 %), le montant HT, la TVA et le montant TTC sur chaque facture. Déposez votre déclaration CA12/CA3 auprès du SIE.'}
                  </div>
                )}
                {isPt && tvaStatus.status !== 'safe' && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 6, background: tv.bg, border: `1px solid ${tv.border}`, fontSize: 11, color: tv.textMuted, lineHeight: 1.6 }}>
                    <strong style={{ color: tv.text }}>📋 Obrigações após registo no IVA :</strong>
                    <br />
                    Emita faturas com IVA a 23 %, envie a Declaração Periódica de IVA trimestralmente (ou mensal se VN &gt; 650 000 €) e mantenha o e-fatura em dia.
                  </div>
                )}
              </div>
            </div>

            {/* Déclaration sociale existante */}
            <DeclarationSocialeSection />
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
            annualCA={bookings.filter(b => b.status === 'completed' && b.booking_date && new Date(b.booking_date).getFullYear() === currentYear).reduce((s, b) => s + (b.price_ttc || 0), 0)}
            totalExpenses={expenses.filter(e => e.date && new Date(e.date).getFullYear() === currentYear).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0)}
            quarterData={quarterData}
            currentMonth={currentMonth}
            currentYear={currentYear}
            formatEur={formatEur}
            orgRole={orgRole}
          />
        )}

      </div>
    </div>
  )
}
