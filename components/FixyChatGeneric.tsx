'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Loader2 } from 'lucide-react'

// Avatar Fixy : petit robot
function FixyAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="25" y="45" width="50" height="35" rx="8" fill="#FFC107"/>
      <rect x="28" y="18" width="44" height="30" rx="10" fill="#FFD54F"/>
      <circle cx="40" cy="30" r="5" fill="#1a1a2e"/>
      <circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
      <circle cx="42" cy="28" r="1.5" fill="white"/>
      <circle cx="62" cy="28" r="1.5" fill="white"/>
      <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <line x1="50" y1="18" x2="50" y2="8" stroke="#FFC107" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="50" cy="6" r="4" fill="#FF9800"/>
      <rect x="12" y="50" width="13" height="6" rx="3" fill="#FFD54F"/>
      <g transform="translate(72, 42) rotate(30)">
        <rect x="0" y="8" width="5" height="20" rx="2" fill="#78909C"/>
        <circle cx="2.5" cy="6" r="7" fill="none" stroke="#78909C" strokeWidth="4"/>
        <circle cx="2.5" cy="6" r="3" fill="#FFD54F"/>
      </g>
      <rect x="33" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
      <rect x="57" y="80" width="10" height="12" rx="4" fill="#FFD54F"/>
      <rect x="30" y="62" width="40" height="4" rx="2" fill="#FF9800"/>
      <circle cx="50" cy="55" r="3" fill="#FF9800"/>
    </svg>
  )
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type FixyChatGenericProps = {
  role: 'syndic' | 'syndic_tech' | 'copro' | 'locataire'
  userName?: string
  context?: Record<string, string>
  getAuthToken: () => Promise<string | null>
}

const WELCOME_MESSAGES: Record<string, string> = {
  syndic: "Bonjour ! Je suis Fixy 🤖, votre assistant IA pour la gestion de copropriété. Je peux vous aider sur : interventions, ordres de mission, réglementation, communication copropriétaires, budgets... Posez-moi votre question !",
  syndic_tech: "Bonjour ! Je suis Fixy 🔧, votre assistant technique. Je peux vous aider sur : diagnostics techniques, priorisation d'urgences, normes DTU/NF, comptes-rendus d'intervention, planification des travaux... Que puis-je faire pour vous ?",
  copro: "Bonjour ! Je suis Fixy 🏠, votre assistant pour la copropriété. Je peux vous aider sur : signalement d'incidents, charges, assemblées générales, droits et obligations, urgences... Comment puis-je vous aider ?",
  locataire: "Bonjour ! Je suis Fixy 🏠, votre assistant. Je peux vous aider sur : signalement de problèmes, suivi d'interventions, charges, vie en copropriété, urgences... N'hésitez pas à me poser vos questions !",
}

const QUICK_ACTIONS: Record<string, { label: string; message: string }[]> = {
  syndic: [
    { label: '📋 Préparer une AG', message: "Comment préparer une assemblée générale de copropriété ?" },
    { label: '🔧 Urgence technique', message: "J'ai une urgence technique dans un immeuble, quelle est la procédure ?" },
    { label: '⚖️ Loi ALUR', message: "Quelles sont les obligations du syndic selon la loi ALUR ?" },
    { label: '📊 Budget prévisionnel', message: "Comment élaborer le budget prévisionnel annuel ?" },
  ],
  syndic_tech: [
    { label: '🔍 Diagnostic humidité', message: "Comment diagnostiquer un problème d'humidité dans un immeuble ?" },
    { label: '🛗 Panne ascenseur', message: "Procédure en cas de panne d'ascenseur : délais et obligations ?" },
    { label: '🔥 Sécurité incendie', message: "Quelles sont les vérifications obligatoires de sécurité incendie en copropriété ?" },
    { label: '📋 Compte-rendu', message: "Aide-moi à rédiger un compte-rendu d'intervention technique" },
  ],
  copro: [
    { label: '🔧 Signaler un problème', message: "Comment signaler un problème dans les parties communes ?" },
    { label: '💰 Comprendre mes charges', message: "Comment sont calculées mes charges de copropriété ?" },
    { label: '📅 Assemblée générale', message: "Comment fonctionne le vote en assemblée générale ?" },
    { label: '🚨 Urgence', message: "J'ai une fuite d'eau, que dois-je faire en urgence ?" },
  ],
  locataire: [
    { label: '🔧 Signaler un problème', message: "Comment signaler un problème dans mon logement ou les parties communes ?" },
    { label: '💰 Mes charges', message: "Comment comprendre ma répartition de charges ?" },
    { label: '🚨 Urgence fuite', message: "J'ai une fuite d'eau chez moi, que faire ?" },
    { label: '📞 Contacter le syndic', message: "Comment et quand contacter le syndic de copropriété ?" },
  ],
}

export default function FixyChatGeneric({ role, userName, context, getAuthToken }: FixyChatGenericProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const conversationRef = useRef<{ role: string; content: string }[]>([])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: WELCOME_MESSAGES[role] || WELCOME_MESSAGES.copro,
      }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setHasInteracted(true)
    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    conversationRef.current.push({ role: 'user', content: text.trim() })

    try {
      const token = await getAuthToken()
      if (!token) {
        setMessages(prev => [...prev, { id: `e_${Date.now()}`, role: 'assistant', content: "⚠️ Session expirée. Veuillez vous reconnecter." }])
        setLoading(false)
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25000)

      const res = await fetch('/api/fixy-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: text.trim(),
          role,
          context: { userName: userName || '', ...context },
          conversation_history: conversationRef.current.slice(-10),
        }),
      })
      clearTimeout(timeout)

      const data = await res.json()
      const response = data.response || "Je n'ai pas pu traiter votre demande."

      conversationRef.current.push({ role: 'assistant', content: response })

      setMessages(prev => [...prev, {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: response,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: "⚠️ Erreur de connexion. Vérifiez votre connexion internet et réessayez.",
      }])
    }
    setLoading(false)
  }

  const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.copro

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-full p-4 shadow-lg hover:shadow-xl transition-all hover:scale-105 group"
          title="Parler à Fixy"
        >
          <div className="relative">
            <FixyAvatar size={32} />
            {!hasInteracted && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: 'min(580px, calc(100vh - 6rem))' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <FixyAvatar size={36} />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-sm">Fixy — Assistant IA</h3>
              <p className="text-[10px] text-gray-700">
                {role === 'syndic' ? 'Syndic & Gestion' : role === 'syndic_tech' ? 'Technique & Diagnostic' : 'Copropriété & Aide'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-700 hover:text-gray-900 transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1"><FixyAvatar size={24} /></div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#FFC107] text-gray-900 rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="flex-shrink-0"><FixyAvatar size={24} /></div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFC107]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions (only if no interaction yet) */}
          {!hasInteracted && (
            <div className="px-3 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-1.5">
              {quickActions.map((qa, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(qa.message)}
                  className="text-[11px] px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-full border border-amber-200 transition font-medium"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-2 bg-white border-t border-gray-200 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="Posez votre question à Fixy..."
              disabled={loading}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 p-2.5 rounded-xl transition disabled:opacity-40 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
