'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { AlfredoAvatar } from '@/components/common/RobotAvatars'
import { useLocale } from '@/lib/i18n/context'
import AlfredoInboxView from '../AlfredoInboxView'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

type Msg = { role: 'user' | 'assistant'; content: string }
type Mode = 'chat' | 'inbox'

interface GmailStatus {
  connected: boolean
  email_compte: string | null
  drafts_pending: number
  emails_analysed: number
}

// user prop conservé pour cohérence d'API avec le dashboard (page === 'alfredo_agent' && <AlfredoAgentPage user={user} />)
export default function AlfredoAgentPage({ user: _user }: { user: UserWithProfile }) {
  const uiLocale = useLocale()
  const locale = uiLocale === 'pt' ? 'pt' : 'fr'

  const [mode, setMode] = useState<Mode>('chat')
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch Gmail status on mount
  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/email-agent/status', {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        if (!aborted && res.ok) {
          const data = await res.json()
          setStatus({
            connected: !!data.connected,
            email_compte: data.email_compte || null,
            drafts_pending: data.drafts_pending || 0,
            emails_analysed: data.emails_analysed || 0,
          })
        }
      } catch {
        // silent — keep status null
      } finally {
        if (!aborted) setStatusLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [])

  const SUGGESTIONS = locale === 'pt'
    ? [
        'Resume a minha inbox de hoje',
        'Quais emails são urgentes esta semana ?',
        'Procura os emails da Sra. Costa sobre a infiltração',
        'Redige um lembrete amigável para quotas em atraso > 3 meses',
        'Arquiva todos os emails de spam dos últimos 30 dias',
        'Mostra os rascunhos pendentes para revisão',
        'Lista os emails sem resposta há mais de 7 dias',
        'Sugere uma resposta padrão para reclamações de ruído',
      ]
    : [
        'Résume mon inbox du jour',
        'Quels emails sont urgents cette semaine ?',
        'Cherche les emails de Mme Dupont sur la fuite',
        'Rédige une relance amiable pour tous les impayés > 3 mois',
        'Archive tous les emails de spam des 30 derniers jours',
        'Montre les brouillons en attente de validation',
        'Liste les emails sans réponse depuis plus de 7 jours',
        'Suggère une réponse standard pour les plaintes de bruit',
      ]

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/syndic/alfredo-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: userMsg.content,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
          locale,
        }),
      })
      const data = await res.json()
      const reply = data.content || data.response || data.reply
        || (locale === 'pt' ? 'Desculpe, ocorreu um erro.' : 'Désolé, une erreur est survenue.')
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: locale === 'pt' ? '❌ Erro de ligação à IA.' : '❌ Erreur de connexion à l\'IA.',
      }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const isConnected = !!status?.connected
  const draftsPending = status?.drafts_pending ?? 0

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-4xl">
      {/* Header + statut Gmail + tabs Chat/Inbox */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-[#0D1B2E] flex items-center gap-2">
              <AlfredoAvatar size={28} />
              {locale === 'pt' ? 'Agente Emails Alfredo' : 'Agent Emails Alfredo'}
              <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full font-medium">IA</span>
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {locale === 'pt'
                ? 'Gestor emails IA — analisa a sua caixa, classifica e prepara rascunhos de resposta'
                : 'Gestionnaire emails IA — analyse votre boîte, classe et prépare des brouillons de réponse'}
            </p>
          </div>
          {/* Tabs Chat / Inbox */}
          <div className="flex bg-[#F7F4EE] rounded-lg p-1 gap-1">
            <button onClick={() => setMode('chat')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === 'chat' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500 hover:text-gray-700'}`}>
              💬 {locale === 'pt' ? 'Conversa' : 'Discussion'}
            </button>
            <button onClick={() => setMode('inbox')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === 'inbox' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500 hover:text-gray-700'}`}>
              📬 {locale === 'pt' ? 'Inbox' : 'Inbox'}
              {draftsPending > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#C9A84C] text-white text-[10px] font-bold">
                  {draftsPending}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Badge statut Gmail */}
        {!statusLoading && (
          <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${isConnected ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isConnected ? (
              <>✅ {locale === 'pt' ? 'Gmail ligado' : 'Gmail connecté'} — <strong>{status?.email_compte}</strong>
                {(status?.emails_analysed ?? 0) > 0 && (
                  <span className="text-gray-500 font-normal ml-1">
                    · {status?.emails_analysed} {locale === 'pt' ? 'emails analisados' : 'emails analysés'}
                  </span>
                )}
              </>
            ) : (
              <>⚠️ {locale === 'pt'
                ? 'Sem Gmail ligado — Vá à secção Emails Fixy para ligar a sua caixa'
                : 'Aucun Gmail connecté — Allez dans la section Emails Fixy pour connecter votre boîte'}</>
            )}
          </div>
        )}
      </div>

      {/* Zone messages OU Inbox */}
      {mode === 'chat' ? (
        <>
          <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-4">
                <div><AlfredoAvatar size={64} /></div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">
                    {locale === 'pt' ? 'Olá, sou o Alfredo!' : 'Bonjour, je suis Alfredo !'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md">
                    {locale === 'pt'
                      ? <>Sou o seu assistente emails IA. {isConnected
                          ? <>A sua caixa <strong>{status?.email_compte}</strong> está ligada — pode pedir-me análises, rascunhos ou pesquisas.</>
                          : 'Ligue a sua caixa Gmail na secção Emails Fixy para começar.'}</>
                      : <>Je suis votre assistant emails IA. {isConnected
                          ? <>Votre boîte <strong>{status?.email_compte}</strong> est connectée — vous pouvez me demander analyses, brouillons ou recherches.</>
                          : 'Connectez votre boîte Gmail dans la section Emails Fixy pour démarrer.'}</>}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => setInput(s)}
                      className="text-left text-xs bg-[#F7F4EE] hover:bg-orange-50 hover:text-orange-700 border border-gray-200 hover:border-orange-200 px-3 py-2 rounded-xl transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold ${msg.role === 'user' ? 'bg-orange-400 text-white' : 'bg-gradient-to-br from-[#C9A84C] to-[#F0D898] text-white'}`}>
                      {msg.role === 'user' ? '👤' : <AlfredoAvatar size={20} />}
                    </div>
                    <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#0D1B2E] text-white rounded-tr-sm' : 'bg-[#F7F4EE] text-gray-800 border border-gray-200 rounded-tl-sm'}`}
                      dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msg.content) }}
                    />
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D1B2E] to-[#152338] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <AlfredoAvatar size={28} />
                    </div>
                    <div className="bg-[#F7F4EE] border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Saisie */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex-shrink-0">
            {messages.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {SUGGESTIONS.slice(0, 4).map((s, i) => (
                  <button key={i} onClick={() => setInput(s)}
                    className="text-xs bg-[#F7F4EE] hover:bg-orange-50 hover:text-orange-700 px-2.5 py-1 rounded-full transition border border-transparent hover:border-orange-200">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                rows={2}
                placeholder={locale === 'pt'
                  ? 'Faça uma pergunta sobre os seus emails… (urgências, rascunhos, pesquisa…)'
                  : 'Posez une question sur vos emails… (urgences, brouillons, recherche…)'}
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-orange-400 outline-none resize-none"
              />
              <div className="flex flex-col gap-1">
                <button onClick={send} disabled={!input.trim() || loading}
                  className="flex-1 bg-[#C9A84C] hover:bg-[#C9A84C] disabled:opacity-40 text-white px-5 rounded-xl font-bold text-sm transition">
                  {locale === 'pt' ? 'Enviar' : 'Envoyer'}
                </button>
                {messages.length > 0 && (
                  <button onClick={() => setMessages([])} className="text-xs text-gray-500 hover:text-gray-600 text-center">
                    {locale === 'pt' ? 'Limpar' : 'Effacer'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 min-h-0">
          <AlfredoInboxView locale={locale} />
        </div>
      )}
    </div>
  )
}
