'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'
import { FixyAvatar } from '@/components/common/RobotAvatars'
import { useLocale } from '@/lib/i18n/context'

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

const WELCOME_MESSAGES: Record<string, Record<string, string>> = {
  fr: {
    syndic: "Bonjour ! Je suis Fixy 🤖, votre assistant IA pour la gestion de copropriété. Je peux vous aider sur : interventions, ordres de mission, réglementation, communication copropriétaires, budgets... Posez-moi votre question !",
    syndic_tech: "Bonjour ! Je suis Fixy 🔧, votre assistant technique. Je peux vous aider sur : diagnostics techniques, priorisation d'urgences, normes DTU/NF, comptes-rendus d'intervention, planification des travaux... Que puis-je faire pour vous ?",
    copro: "Bonjour ! Je suis Fixy 🏠, votre assistant pour la copropriété. Je peux vous aider sur : signalement d'incidents, charges, assemblées générales, droits et obligations, urgences... Comment puis-je vous aider ?",
    locataire: "Bonjour ! Je suis Fixy 🏠, votre assistant. Je peux vous aider sur : signalement de problèmes, suivi d'interventions, charges, vie en copropriété, urgences... N'hésitez pas à me poser vos questions !",
  },
  pt: {
    syndic: "Olá! Sou o Fixy 🤖, o seu assistente IA para gestão de condomínios. Posso ajudá-lo com: intervenções, ordens de serviço, regulamentação, comunicação com condóminos, orçamentos... Coloque a sua questão!",
    syndic_tech: "Olá! Sou o Fixy 🔧, o seu assistente técnico. Posso ajudá-lo com: diagnósticos técnicos, priorização de urgências, normas técnicas, relatórios de intervenção, planeamento de obras... Como posso ajudá-lo?",
    copro: "Olá! Sou o Fixy 🏠, o seu assistente para o condomínio. Posso ajudá-lo com: relato de incidentes, quotas, assembleias gerais, direitos e obrigações, urgências... Como posso ajudá-lo?",
    locataire: "Olá! Sou o Fixy 🏠, o seu assistente. Posso ajudá-lo com: relato de problemas, acompanhamento de intervenções, quotas, vida em condomínio, urgências... Não hesite em colocar as suas questões!",
  },
}

const QUICK_ACTIONS: Record<string, Record<string, { label: string; message: string }[]>> = {
  fr: {
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
  },
  pt: {
    syndic: [
      { label: '📋 Preparar AG', message: "Como preparar uma assembleia geral de condomínio?" },
      { label: '🔧 Urgência técnica', message: "Tenho uma urgência técnica num edifício, qual é o procedimento?" },
      { label: '⚖️ Legislação', message: "Quais são as obrigações do administrador segundo a legislação de condomínio?" },
      { label: '📊 Orçamento', message: "Como elaborar o orçamento anual do condomínio?" },
    ],
    syndic_tech: [
      { label: '🔍 Diagnóstico humidade', message: "Como diagnosticar um problema de humidade num edifício?" },
      { label: '🛗 Avaria elevador', message: "Procedimento em caso de avaria de elevador: prazos e obrigações?" },
      { label: '🔥 Segurança incêndio', message: "Quais são as verificações obrigatórias de segurança contra incêndios em condomínio?" },
      { label: '📋 Relatório', message: "Ajuda-me a redigir um relatório de intervenção técnica" },
    ],
    copro: [
      { label: '🔧 Reportar problema', message: "Como reportar um problema nas partes comuns?" },
      { label: '💰 Compreender quotas', message: "Como são calculadas as minhas quotas de condomínio?" },
      { label: '📅 Assembleia geral', message: "Como funciona a votação em assembleia geral?" },
      { label: '🚨 Urgência', message: "Tenho uma fuga de água, o que devo fazer?" },
    ],
    locataire: [
      { label: '🔧 Reportar problema', message: "Como reportar um problema no meu alojamento ou nas partes comuns?" },
      { label: '💰 Minhas quotas', message: "Como compreender a minha repartição de quotas?" },
      { label: '🚨 Urgência fuga', message: "Tenho uma fuga de água em casa, o que fazer?" },
      { label: '📞 Contactar administração', message: "Como e quando contactar a administração do condomínio?" },
    ],
  },
}

const UI_TEXTS = {
  fr: {
    title: 'Fixy — Assistant IA',
    subtitle: { syndic: 'Syndic & Gestion', syndic_tech: 'Technique & Diagnostic', copro: 'Copropriété & Aide', locataire: 'Logement & Aide' },
    placeholder: 'Posez votre question à Fixy...',
    buttonTitle: 'Parler à Fixy',
    sessionExpired: '⚠️ Session expirée. Veuillez vous reconnecter.',
    connectionError: '⚠️ Erreur de connexion. Vérifiez votre connexion internet et réessayez.',
  },
  pt: {
    title: 'Fixy — Assistente IA',
    subtitle: { syndic: 'Administração & Gestão', syndic_tech: 'Técnico & Diagnóstico', copro: 'Condomínio & Ajuda', locataire: 'Alojamento & Ajuda' },
    placeholder: 'Coloque a sua questão ao Fixy...',
    buttonTitle: 'Falar com o Fixy',
    sessionExpired: '⚠️ Sessão expirada. Por favor, volte a iniciar sessão.',
    connectionError: '⚠️ Erro de ligação. Verifique a sua ligação à internet e tente novamente.',
  },
}

const BUTTON_SIZE = 64 // px — taille du bouton flottant
const STORAGE_KEY = 'fixy_btn_pos'

export default function FixyChatGeneric({ role, userName, context, getAuthToken }: FixyChatGenericProps) {
  const locale = useLocale()
  const L = locale === 'pt' ? 'pt' : 'fr'
  const ui = UI_TEXTS[L]
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const conversationRef = useRef<{ role: string; content: string }[]>([])

  // ── Draggable button state ──
  const [btnPos, setBtnPos] = useState<{ x: number; y: number }>({ x: -1, y: -1 })
  const dragRef = useRef<{ startX: number; startY: number; startBtnX: number; startBtnY: number; dragging: boolean; moved: boolean }>({
    startX: 0, startY: 0, startBtnX: 0, startBtnY: 0, dragging: false, moved: false,
  })

  // Initialiser la position (bottom-right par défaut ou depuis localStorage)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const pos = JSON.parse(saved)
        // Vérifier que la position est dans la fenêtre
        const vw = window.innerWidth
        const vh = window.innerHeight
        const x = Math.min(Math.max(0, pos.x), vw - BUTTON_SIZE)
        const y = Math.min(Math.max(0, pos.y), vh - BUTTON_SIZE)
        setBtnPos({ x, y })
        return
      }
    } catch { /* ignore */ }
    // Default: bottom-right
    setBtnPos({ x: window.innerWidth - BUTTON_SIZE - 24, y: window.innerHeight - BUTTON_SIZE - 24 })
  }, [])

  // Recalculer si la fenêtre change de taille
  useEffect(() => {
    const onResize = () => {
      setBtnPos(prev => {
        if (prev.x < 0) return prev
        const vw = window.innerWidth
        const vh = window.innerHeight
        return {
          x: Math.min(prev.x, vw - BUTTON_SIZE),
          y: Math.min(prev.y, vh - BUTTON_SIZE),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Drag handlers (mouse + touch) ──
  const handleDragStart = (clientX: number, clientY: number) => {
    dragRef.current = { startX: clientX, startY: clientY, startBtnX: btnPos.x, startBtnY: btnPos.y, dragging: true, moved: false }
  }

  const handleDragMove = (clientX: number, clientY: number) => {
    const d = dragRef.current
    if (!d.dragging) return
    const dx = clientX - d.startX
    const dy = clientY - d.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.moved = true
    if (!d.moved) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    setBtnPos({
      x: Math.min(Math.max(0, d.startBtnX + dx), vw - BUTTON_SIZE),
      y: Math.min(Math.max(0, d.startBtnY + dy), vh - BUTTON_SIZE),
    })
  }

  const handleDragEnd = () => {
    const d = dragRef.current
    d.dragging = false
    if (d.moved) {
      // Sauvegarder la position
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(btnPos)) } catch { /* ignore */ }
    } else {
      // C'était un clic → ouvrir le chat
      setOpen(true)
    }
  }

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); handleDragStart(e.clientX, e.clientY) }
  // Touch events
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; handleDragStart(t.clientX, t.clientY) }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY)
    const onMouseUp = () => { if (dragRef.current.dragging) handleDragEnd() }
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; handleDragMove(t.clientX, t.clientY) }
    const onTouchEnd = () => { if (dragRef.current.dragging) handleDragEnd() }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btnPos])

  // ── Calculer la position de la fenêtre chat relative au bouton ──
  const getChatStyle = (): React.CSSProperties => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const chatW = Math.min(380, vw - 32)
    const chatH = Math.min(580, vh - 96)
    const btnCenterX = btnPos.x + BUTTON_SIZE / 2
    const btnCenterY = btnPos.y + BUTTON_SIZE / 2
    const style: React.CSSProperties = { width: chatW, height: chatH, position: 'fixed', zIndex: 50 }

    // Horizontal: si bouton à droite → aligner chat à droite, sinon à gauche
    if (btnCenterX > vw / 2) {
      style.right = Math.max(16, vw - btnPos.x - BUTTON_SIZE)
    } else {
      style.left = Math.max(16, btnPos.x)
    }

    // Vertical: si bouton en bas → chat au-dessus, sinon en dessous
    if (btnCenterY > vh / 2) {
      const bottomSpace = vh - btnPos.y + 8
      style.bottom = Math.max(16, bottomSpace)
    } else {
      const topSpace = btnPos.y + BUTTON_SIZE + 8
      style.top = Math.max(16, topSpace)
    }

    return style
  }

  useEffect(() => {
    if (open && messages.length === 0) {
      const welcomeMessages = WELCOME_MESSAGES[L] || WELCOME_MESSAGES.fr
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: welcomeMessages[role] || welcomeMessages.copro,
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
    if (!text.trim() || loading || streaming) return
    setHasInteracted(true)
    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    conversationRef.current.push({ role: 'user', content: text.trim() })

    try {
      const token = await getAuthToken()
      if (!token) {
        setMessages(prev => [...prev, { id: `e_${Date.now()}`, role: 'assistant', content: ui.sessionExpired }])
        setLoading(false)
        return
      }

      const res = await fetch('/api/fixy-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          role,
          context: { userName: userName || '', ...context },
          conversation_history: conversationRef.current.slice(-10),
          locale,
          stream: true,
        }),
      })

      // Check if we got a streaming response
      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('text/event-stream') && res.body) {
        // Streaming mode
        setLoading(false)
        setStreaming(true)
        const assistantMsgId = `a_${Date.now()}`
        setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }])

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const payload = trimmed.slice(6)
            if (payload === '[DONE]') break
            try {
              const json = JSON.parse(payload)
              if (json.text) {
                fullText += json.text
                const currentText = fullText
                setMessages(prev => {
                  const updated = [...prev]
                  const lastIdx = updated.findIndex(m => m.id === assistantMsgId)
                  if (lastIdx >= 0) updated[lastIdx] = { ...updated[lastIdx], content: currentText }
                  return updated
                })
              }
            } catch { /* skip */ }
          }
        }

        conversationRef.current.push({ role: 'assistant', content: fullText })
        setStreaming(false)
      } else {
        // Fallback: non-streaming response
        const data = await res.json()
        const response = data.response || data.reply || (L === 'pt' ? "Não consegui processar o seu pedido." : "Je n'ai pas pu traiter votre demande.")
        conversationRef.current.push({ role: 'assistant', content: response })
        setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'assistant', content: response }])
        setLoading(false)
      }
    } catch (error) {
      console.error('[FixyChatGeneric] API call failed:', error instanceof Error ? error.message : error)
      setMessages(prev => [...prev, { id: `e_${Date.now()}`, role: 'assistant', content: ui.connectionError }])
      setLoading(false)
      setStreaming(false)
    }
  }

  const quickActionsLocale = QUICK_ACTIONS[L] || QUICK_ACTIONS.fr
  const quickActions = quickActionsLocale[role] || quickActionsLocale.copro

  return (
    <>
      {/* Floating draggable button */}
      {!open && btnPos.x >= 0 && (
        <div
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className="fixed z-50 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-full shadow-lg hover:shadow-xl transition-shadow cursor-grab active:cursor-grabbing select-none"
          style={{ left: btnPos.x, top: btnPos.y, width: BUTTON_SIZE, height: BUTTON_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}
          title={ui.buttonTitle}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(true) }}
        >
          <div className="relative pointer-events-none">
            <FixyAvatar size={32} />
            {!hasInteracted && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Chat window — positioned relative to button */}
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden max-w-[calc(100vw-2rem)]" style={getChatStyle()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <FixyAvatar size={36} />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-sm">{ui.title}</h3>
              <p className="text-[10px] text-gray-700">
                {ui.subtitle[role] || ui.subtitle.copro}
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
                  {msg.content || (streaming && msg.id.startsWith('a_') ? '' : msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="flex-shrink-0"><FixyAvatar size={24} /></div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[#FFC107] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
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
              placeholder={ui.placeholder}
              disabled={loading || streaming}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || streaming || !input.trim()}
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
