'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { TempoAvatar } from '@/components/common/RobotAvatars'
import { useLocale } from '@/lib/i18n/context'
import AutomationsListView from '../AutomationsListView'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

type Msg = { role: 'user' | 'assistant'; content: string }
type Mode = 'tableau' | 'chat'

export default function TempoAgentPage({ user: _user }: { user: UserWithProfile }) {
  const uiLocale = useLocale()
  const locale = uiLocale === 'pt' ? 'pt' : 'fr'

  const [mode, setMode] = useState<Mode>('tableau')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const SUGGESTIONS = locale === 'pt'
    ? [
        'Envia em cada 1.º trimestre as chamadas de quotas',
        'Lista as minhas automatizações ativas',
        'Programa um lembrete para dívidas > 30 dias',
        'Qual o balanço das execuções este mês ?',
        'Cria uma rotina semanal para verificar alertas',
        'Pausa todas as automatizações da gestão Costa',
        'Programa a convocação anual da AG em outubro',
        'Mostra os erros das últimas execuções',
      ]
    : [
        'Envoie chaque 1er trimestre les appels de charges',
        'Liste mes automatisations actives',
        'Programme une relance amiable pour les impayés > 30 jours',
        'Quel bilan des exécutions ce mois ?',
        'Crée une routine hebdomadaire pour vérifier les alertes',
        'Mets en pause toutes les automatisations de la gestion Dupont',
        "Programme la convocation annuelle d'AG en octobre",
        'Montre les erreurs des dernières exécutions',
      ]

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/syndic/tempo-ai', {
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
      const reply = data.response || data.reply || data.content
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

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full">
      {/* Header + mode toggle */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-[#0D1B2E] flex items-center gap-2">
              <TempoAvatar size={28} />
              {locale === 'pt' ? 'Agente Automatizações Tempo' : 'Agent Automatisations Tempo'}
              <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full font-medium">IA</span>
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {locale === 'pt'
                ? 'Programa, executa e supervisiona as suas tarefas recorrentes (crons, relances, convocações…)'
                : 'Programme, exécute et supervise vos tâches récurrentes (crons, relances, convocations…)'}
            </p>
          </div>
          {/* Toggle Tableau / Discussion */}
          <div className="flex bg-[#F7F4EE] rounded-lg p-1 gap-1">
            <button onClick={() => setMode('tableau')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === 'tableau' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500 hover:text-gray-700'}`}>
              📊 {locale === 'pt' ? 'Tabela' : 'Tableau'}
            </button>
            <button onClick={() => setMode('chat')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === 'chat' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500 hover:text-gray-700'}`}>
              💬 {locale === 'pt' ? 'Conversa' : 'Écrit'}
            </button>
          </div>
        </div>
      </div>

      {mode === 'tableau' ? (
        <div className="flex-1 overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 min-h-0">
          <AutomationsListView locale={locale} />
        </div>
      ) : (
        <>
          {/* Zone messages */}
          <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-4">
                <div><TempoAvatar size={64} /></div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">
                    {locale === 'pt' ? 'Olá, sou o Tempo!' : 'Bonjour, je suis Tempo !'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md">
                    {locale === 'pt'
                      ? 'Crio, monitorizo e ajusto automatizações em linguagem natural — crons, lembretes, convocações, relatórios periódicos.'
                      : 'Je crée, surveille et ajuste des automatisations en langage naturel — crons, relances, convocations, rapports périodiques.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 w-full max-w-5xl">
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
                      {msg.role === 'user' ? '👤' : <TempoAvatar size={20} />}
                    </div>
                    <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#0D1B2E] text-white rounded-tr-sm' : 'bg-[#F7F4EE] text-gray-800 border border-gray-200 rounded-tl-sm'}`}
                      dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msg.content) }}
                    />
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D1B2E] to-[#152338] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <TempoAvatar size={28} />
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
                  ? 'Descreva a automatização desejada… (cron, condição, ação)'
                  : "Décrivez l'automatisation souhaitée… (cron, condition, action)"}
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
      )}
    </div>
  )
}
