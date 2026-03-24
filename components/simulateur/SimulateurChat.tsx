'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SimulateurChatProps {
  userId?: string
  onPublishBourse?: (data: { messages: Message[]; estimation: string }) => void
  embedded?: boolean // true when inside dashboard
}

const EXEMPLES = [
  'Refaire la peinture de mon salon',
  'Élaguer 3 arbres dans mon jardin',
  'Rénovation complète salle de bain',
  'Installer une clim dans un T3',
]

export default function SimulateurChat({ userId, onPublishBourse, embedded = false }: SimulateurChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationCount, setConversationCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Rate limit for anonymous users: 3 conversations/day
  useEffect(() => {
    if (!userId) {
      const stored = localStorage.getItem('vitfix_simulateur_count')
      if (stored) {
        const { count, date } = JSON.parse(stored)
        const today = new Date().toDateString()
        if (date === today) {
          setConversationCount(count)
        } else {
          localStorage.setItem('vitfix_simulateur_count', JSON.stringify({ count: 0, date: today }))
        }
      }
    }
  }, [userId])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    // Check rate limit for anonymous
    if (!userId && conversationCount >= 3 && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Vous avez atteint la limite de 3 estimations par jour. Créez un compte gratuit pour des estimations illimitées et un historique sauvegardé !\n\n[Créer un compte →](/auth/signup)',
      }])
      return
    }

    const userMessage: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    // Track conversation count for anonymous
    if (!userId && messages.length === 0) {
      const newCount = conversationCount + 1
      setConversationCount(newCount)
      localStorage.setItem('vitfix_simulateur_count', JSON.stringify({
        count: newCount,
        date: new Date().toDateString(),
      }))
    }

    try {
      const res = await fetch('/api/simulateur-travaux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          userId,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let assistantText = ''
      let buffer = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

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
              assistantText += json.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantText }
                return updated
              })
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      console.error('[SimulateurChat] Error:', err)
      setMessages(prev => [
        ...prev.filter(m => m.content !== ''),
        { role: 'assistant', content: 'Désolé, une erreur est survenue. Réessayez dans quelques secondes.' },
      ])
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }, [messages, isStreaming, userId, conversationCount])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleExemple = (text: string) => {
    sendMessage(text)
  }

  const handlePublishBourse = () => {
    if (onPublishBourse) {
      const lastAssistant = messages.filter(m => m.role === 'assistant').pop()
      onPublishBourse({
        messages,
        estimation: lastAssistant?.content || '',
      })
    }
  }

  // Render message content with CTA buttons
  const renderContent = (content: string) => {
    const parts = content.split(/(\[CTA_BOURSE_AUX_MARCHES\]|\[CTA_CONSEILLER_VITFIX\]|\[CTA_PDF\])/)

    return parts.map((part, i) => {
      if (part === '[CTA_BOURSE_AUX_MARCHES]') {
        return (
          <button
            key={i}
            onClick={handlePublishBourse}
            className="mt-3 w-full rounded-xl bg-amber-500 px-4 py-3 text-left text-white transition hover:bg-amber-600"
          >
            <div className="font-semibold">📋 Publier dans la Bourse aux Marchés</div>
            <div className="text-sm opacity-90">Les artisans de votre zone verront votre demande et vous contacteront</div>
          </button>
        )
      }
      if (part === '[CTA_CONSEILLER_VITFIX]') {
        return (
          <a
            key={i}
            href="tel:+33651466698"
            className="mt-2 block w-full rounded-xl border-2 border-amber-500 bg-white px-4 py-3 text-left transition hover:bg-amber-50"
          >
            <div className="font-semibold text-gray-900">📞 Contacter un conseiller Vitfix</div>
            <div className="text-sm text-gray-600">Un expert vous rappelle sous 24h pour vous accompagner</div>
          </a>
        )
      }
      if (part === '[CTA_PDF]') {
        return (
          <button
            key={i}
            className="mt-2 w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-left transition hover:bg-gray-50"
          >
            <div className="font-semibold text-gray-900">📥 Télécharger mon estimation en PDF</div>
            <div className="text-sm text-gray-600">Gardez ce document pour comparer vos devis</div>
          </button>
        )
      }
      if (!part.trim()) return null

      // Render markdown-like formatting
      return (
        <div key={i} className="whitespace-pre-wrap">
          {part.split('\n').map((line, j) => {
            // Bold
            const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            if (formatted !== line) {
              return <div key={j} dangerouslySetInnerHTML={{ __html: formatted }} />
            }
            // Separator lines
            if (line.match(/^[━─═]{3,}/)) {
              return <hr key={j} className="my-2 border-gray-300" />
            }
            return <div key={j}>{line || '\u00A0'}</div>
          })}
        </div>
      )
    })
  }

  const containerClass = embedded
    ? 'flex h-full flex-col'
    : 'mx-auto flex h-[calc(100vh-80px)] max-w-3xl flex-col px-4 py-6'

  return (
    <div className={containerClass}>
      {/* Header */}
      {!embedded && (
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900">🏠 Estimateur de travaux Vitfix</h1>
          <p className="mt-1 text-sm text-gray-500">
            Décrivez vos travaux, obtenez une estimation en quelques questions
          </p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl bg-gray-50 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm max-w-md w-full">
              <p className="mb-4 text-center text-gray-700">
                Décrivez les travaux que vous souhaitez réaliser et j&apos;estime le prix pour vous.
              </p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase">Exemples</p>
                {EXEMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleExemple(ex)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 transition hover:border-amber-400 hover:bg-amber-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-sm leading-relaxed">
                      {renderContent(msg.content)}
                      {isStreaming && i === messages.length - 1 && (
                        <span className="inline-block animate-pulse">▊</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Décrivez vos travaux..."
          disabled={isStreaming}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
          autoFocus
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          {isStreaming ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            'Envoyer'
          )}
        </button>
      </form>

      {/* Disclaimer */}
      <p className="mt-2 text-center text-[10px] text-gray-400">
        Les estimations sont indicatives et basées sur les prix moyens constatés en France en 2026.
        Seul un devis personnalisé après visite sur site fait foi.
      </p>
    </div>
  )
}
