'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import { FixyAvatar } from '@/components/common/RobotAvatars'
import { useLocale } from '@/lib/i18n/context'
import ConversationSidebar from '../ConversationSidebar'
import { useAgentConversation } from '../hooks/useAgentConversation'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

interface Props {
  user: UserWithProfile
  onNavigate?: (page: string) => void
}

interface ParsedAction {
  type: string
  args: Record<string, unknown>
}

const ACTION_RE = /##ACTION##\s*(\{[\s\S]*?\})\s*##/

function extractAction(text: string): ParsedAction | null {
  const match = text.match(ACTION_RE)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>
    const { type, ...args } = parsed
    if (typeof type !== 'string') return null
    return { type, args }
  } catch {
    return null
  }
}

function stripActionMarkers(text: string): string {
  return text.replace(/##ACTION##[\s\S]*?##/g, '').trim()
}

const ACTION_LABELS: Record<string, { fr: string; pt: string }> = {
  create_event: { fr: 'Créer un rendez-vous', pt: 'Criar marcação' },
  create_mission: { fr: 'Créer une mission', pt: 'Criar missão' },
  assign_mission: { fr: 'Attribuer une mission', pt: 'Atribuir missão' },
  update_mission: { fr: 'Mettre à jour mission', pt: 'Atualizar missão' },
  create_alert: { fr: 'Créer une alerte', pt: 'Criar alerta' },
  send_message: { fr: 'Envoyer un email', pt: 'Enviar email' },
  create_document: { fr: 'Générer un document', pt: 'Gerar documento' },
}

const DISPLAY_KEYS: Record<string, string> = {
  titre: 'Titre', date: 'Date', heure: 'Heure', category: 'Catégorie',
  description: 'Description', artisan: 'Artisan', immeuble: 'Immeuble',
  priorite: 'Priorité', type_travaux: 'Type', to: 'Destinataire',
  subject: 'Objet', body: 'Message', message: 'Message', urgence: 'Urgence',
  assigneA: 'Assigné à', dureeMin: 'Durée (min)', date_intervention: 'Intervention',
}

export default function FixyAgentPage({ user: _user, onNavigate }: Props) {
  const uiLocale = useLocale()
  const locale = uiLocale === 'pt' ? 'pt' : 'fr'
  const l = locale === 'pt' ? 'pt' : 'fr'

  const conv = useAgentConversation('fixy', locale)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<ParsedAction | null>(null)
  const [executingAction, setExecutingAction] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const SUGGESTIONS = locale === 'pt'
    ? [
        'Encontra o processo da Sra. Costa',
        'Cria uma missão para fuga de água, apartamento 3B',
        'Envia lembrete de AG aos condóminos atrasados',
        'Mostra as alertas urgentes do dia',
        'Procura todas as missões em atraso',
        'Abre o painel de impagos',
        'Cria um alerta para a inspeção do elevador',
        'Resume a atividade da semana',
      ]
    : [
        'Trouve le dossier de Madame Dupont',
        'Crée une mission pour fuite eau, appartement 3B',
        "Envoie un rappel d'AG aux copropriétaires retardataires",
        'Montre les alertes urgentes du jour',
        'Cherche toutes les missions en retard',
        'Ouvre le panneau des impayés',
        "Crée une alerte pour l'inspection de l'ascenseur",
        "Résume l'activité de la semaine",
      ]

  const executeAction = useCallback(async (action: ParsedAction) => {
    setExecutingAction(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/syndic/fixy-syndic/execute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: { type: action.type, args: action.args } }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        conv.setMessages(prev => [...prev, {
          role: 'assistant',
          content: l === 'pt' ? '✅ Ação executada com sucesso.' : '✅ Action exécutée avec succès.',
        }])
      } else {
        conv.setMessages(prev => [...prev, {
          role: 'assistant',
          content: l === 'pt'
            ? `❌ Erro: ${data.error || 'falha na execução'}`
            : `❌ Erreur : ${data.error || 'échec de l\'exécution'}`,
        }])
      }
    } catch {
      conv.setMessages(prev => [...prev, {
        role: 'assistant',
        content: l === 'pt' ? '❌ Erro de ligação.' : '❌ Erreur de connexion.',
      }])
    } finally {
      setPendingAction(null)
      setExecutingAction(false)
    }
  }, [conv, l])

  const send = async () => {
    if (!input.trim() || loading) return
    const userText = input.trim()
    setInput('')
    setLoading(true)

    try {
      const convId = await conv.ensureConversation(userText)
      conv.setMessages(prev => [...prev, { role: 'user', content: userText }])
      void conv.persistMessage(convId, 'user', userText)

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/syndic/fixy-syndic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: userText,
          conversation_history: conv.messages.map(m => ({ role: m.role, content: m.content })),
          locale,
        }),
      })
      const data = await res.json()
      const rawReply = data.response || data.reply || data.content
        || (locale === 'pt' ? 'Desculpe, ocorreu um erro.' : 'Désolé, une erreur est survenue.')

      // Backend extracts ##ACTION## and returns it as `data.action` (already stripped from response text).
      // Fallback: try extracting from response in case backend didn't parse it.
      let action: ParsedAction | null = null
      if (data.action && typeof data.action === 'object' && data.action.type) {
        const { type, ...args } = data.action as Record<string, unknown>
        action = { type: String(type), args }
      } else {
        action = extractAction(rawReply)
      }

      const displayReply = stripActionMarkers(rawReply) || rawReply
      conv.setMessages(prev => [...prev, { role: 'assistant', content: displayReply }])
      void conv.persistMessage(convId, 'assistant', displayReply)

      if (action) {
        if (action.type === 'navigate') {
          const page = action.args.page as string | undefined
          if (page && onNavigate) onNavigate(page)
        } else {
          setPendingAction(action)
        }
      }
    } catch {
      conv.setMessages(prev => [...prev, {
        role: 'assistant',
        content: locale === 'pt' ? '❌ Erro de ligação à IA.' : '❌ Erreur de connexion à l\'IA.',
      }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conv.messages, loading, pendingAction])

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] w-full">
      <ConversationSidebar
        conversations={conv.conversations}
        activeId={conv.activeId}
        onSelect={conv.handleSelect}
        onNew={conv.handleNew}
        onDelete={conv.handleDelete}
        onRename={conv.handleRename}
        locale={locale}
      />

      <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-[#0D1B2E] flex items-center gap-2">
              <FixyAvatar size={28} />
              {locale === 'pt' ? 'Secretária IA Fixy' : 'Secrétaire IA Fixy'}
              <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full font-medium">IA</span>
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {locale === 'pt'
                ? 'Assistente de ação — encontra processos, cria missões, navega no painel'
                : "Assistant d'action — trouve les dossiers, crée des missions, navigue dans le dashboard"}
            </p>
          </div>
        </div>
      </div>

      {/* Zone messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4 min-h-0">
        {conv.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-4">
            <div><FixyAvatar size={64} /></div>
            <div>
              <p className="font-bold text-gray-800 text-lg">
                {locale === 'pt' ? 'Olá, sou a Fixy!' : 'Bonjour, je suis Fixy !'}
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                {locale === 'pt'
                  ? 'Sou a sua secretária IA. Posso encontrar processos, criar missões, enviar lembretes, abrir páginas e gerar documentos — em linguagem natural.'
                  : "Je suis votre secrétaire IA. Je peux trouver des dossiers, créer des missions, envoyer des rappels, ouvrir des pages et générer des documents — en langage naturel."}
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
            {conv.messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold ${msg.role === 'user' ? 'bg-orange-400 text-white' : 'bg-gradient-to-br from-[#C9A84C] to-[#F0D898] text-white'}`}>
                  {msg.role === 'user' ? '👤' : <FixyAvatar size={20} />}
                </div>
                <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#0D1B2E] text-white rounded-tr-sm' : 'bg-[#F7F4EE] text-gray-800 border border-gray-200 rounded-tl-sm'}`}
                  dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(msg.content) }}
                />
              </div>
            ))}
            {pendingAction && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">⚡</div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-md">
                  <p className="text-sm font-semibold text-amber-900 mb-2">
                    {ACTION_LABELS[pendingAction.type]?.[l] ?? pendingAction.type}
                  </p>
                  <div className="text-xs text-amber-800 space-y-0.5 mb-3">
                    {Object.entries(pendingAction.args)
                      .filter(([, v]) => v !== undefined && v !== null && v !== '')
                      .map(([k, v]) => (
                        <div key={k}><span className="font-medium">{DISPLAY_KEYS[k] || k} :</span> {String(v)}</div>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => executeAction(pendingAction)}
                      disabled={executingAction}
                      className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-semibold transition"
                    >
                      {executingAction
                        ? (l === 'pt' ? 'A executar…' : 'Exécution…')
                        : (l === 'pt' ? '✓ Confirmar' : '✓ Confirmer')}
                    </button>
                    <button
                      onClick={() => setPendingAction(null)}
                      disabled={executingAction}
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-lg font-medium transition"
                    >
                      {l === 'pt' ? 'Cancelar' : 'Annuler'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {(loading || executingAction) && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0D1B2E] to-[#152338] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <FixyAvatar size={28} />
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
        {conv.messages.length > 0 && (
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
              ? 'Diga à Fixy o que fazer… (encontrar, criar, enviar, abrir…)'
              : 'Dites à Fixy quoi faire… (trouver, créer, envoyer, ouvrir…)'}
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-orange-400 outline-none resize-none"
          />
          <div className="flex flex-col gap-1">
            <button onClick={send} disabled={!input.trim() || loading}
              className="flex-1 bg-[#C9A84C] hover:bg-[#C9A84C] disabled:opacity-40 text-white px-5 rounded-xl font-bold text-sm transition">
              {locale === 'pt' ? 'Enviar' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
