'use client'

import React, { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import MarkdownIA from '@/components/common/MarkdownIA'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CoproProfile {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  tantiemes: number
  quotePart: number
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  profile: CoproProfile
  /**
   * N'est plus envoyé : le serveur ignore tout prompt venant du navigateur
   * (audit anti-injection du 2026-06-10) et construit lui-même le contexte de
   * Fixy (lib/copro-ia-contexte.ts). Gardé optionnel pour l'appel de page.tsx.
   */
  buildCoproSystemPrompt?: () => string
}

type MessageAssistant = { role: 'user' | 'assistant'; content: string }

// coproAiSchema (lib/validation.ts) refuse plus de 30 messages et plus de
// 10 000 caractères par message : on n'envoie que la fin de la conversation.
const MAX_MESSAGES_ENVOYES = 20
const MAX_CARACTERES_MESSAGE = 10_000

const TEXTES_SECOURS = {
  fr: {
    pasDeReponse: 'Désolée, je n\'ai pas pu répondre pour le moment.',
    erreur: 'Une erreur est survenue. Veuillez réessayer.',
  },
  pt: {
    pasDeReponse: 'Desculpe, não consegui responder de momento.',
    erreur: 'Ocorreu um erro. Tente novamente.',
  },
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproAssistantSection({ t, profile }: Props) {
  const locale = useLocale()
  const [assistantMessages, setAssistantMessages] = useState<MessageAssistant[]>([])
  const [assistantInput, setAssistantInput] = useState('')
  // Attente du premier mot : indicateur de saisie affiché, saisie bloquée.
  const [assistantLoading, setAssistantLoading] = useState(false)
  // Réponse en cours d'écriture : on peut taper la question suivante, mais elle
  // ne part qu'une fois la réponse finie (deux flux mêleraient leurs bulles).
  const [assistantStreaming, setAssistantStreaming] = useState(false)
  const assistantEndRef = useRef<HTMLDivElement>(null)
  const envoiEnCoursRef = useRef<AbortController | null>(null)

  const nouvelleConversation = () => {
    envoiEnCoursRef.current?.abort()
    setAssistantMessages([])
  }

  const sendAssistantMessage = async () => {
    if (!assistantInput.trim() || assistantLoading || assistantStreaming) return
    const userMsg = { role: 'user' as const, content: assistantInput.trim() }
    const newMessages = [...assistantMessages, userMsg]
    setAssistantMessages(newMessages)
    setAssistantInput('')
    setAssistantLoading(true)
    setTimeout(() => assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const textes = locale === 'pt' ? TEXTES_SECOURS.pt : TEXTES_SECOURS.fr
    const ajouterReponse = (content: string) => setAssistantMessages(prev => [...prev, { role: 'assistant', content }])
    const controleur = new AbortController()
    envoiEnCoursRef.current = controleur

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || ''

      const res = await fetch('/api/copro-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // Pas de prompt : le serveur fournit à Fixy les données de la copropriété.
        body: JSON.stringify({
          messages: newMessages
            .slice(-MAX_MESSAGES_ENVOYES)
            .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CARACTERES_MESSAGE) })),
          stream: true,
          locale,
        }),
        signal: controleur.signal,
      })

      // Réponse JSON {reply} au lieu d'un flux : erreur, ou aucune clé IA côté serveur.
      const enFlux = (res.headers.get('content-type') || '').includes('text/event-stream')
      if (!res.ok || !res.body || !enFlux) {
        const data = await res.json().catch(() => ({}))
        ajouterReponse(data.reply || data.response || textes.pasDeReponse)
        return
      }

      setAssistantStreaming(true)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let buffer = ''
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
          let morceau = ''
          try {
            morceau = JSON.parse(payload).text || ''
          } catch (e) {
            console.warn('[copro-ai] fragment de flux illisible ignoré', e)
          }
          if (!morceau) continue
          // Avec Claude, le premier mot peut arriver après quelques secondes :
          // la bulle n'apparaît qu'avec lui et remplace l'indicateur de saisie.
          const premier = !fullText
          fullText += morceau
          const currentText = fullText
          setAssistantMessages(prev => premier
            ? [...prev, { role: 'assistant', content: currentText }]
            : [...prev.slice(0, -1), { role: 'assistant', content: currentText }])
          if (premier) setAssistantLoading(false)
          assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      }

      if (!fullText) ajouterReponse(textes.pasDeReponse)
    } catch (err) {
      // Conversation effacée pendant la réponse : rien à afficher.
      if (controleur.signal.aborted) return
      console.warn('[copro-ai] échec de la requête', err)
      ajouterReponse(textes.erreur)
    } finally {
      if (envoiEnCoursRef.current === controleur) envoiEnCoursRef.current = null
      setAssistantLoading(false)
      setAssistantStreaming(false)
      setTimeout(() => assistantEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">

      {/* En-tete assistant */}
      <div className="bg-gradient-to-r from-[#C9A84C] to-[#F0D898] rounded-xl p-5 mb-4 flex items-center gap-4 shadow-md">
        <div className="w-14 h-14 bg-white/30 rounded-full flex items-center justify-center text-3xl flex-shrink-0">
          <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="25" y="45" width="50" height="35" rx="8" fill="#C9A84C"/>
            <rect x="28" y="18" width="44" height="30" rx="10" fill="#F0D898"/>
            <circle cx="40" cy="30" r="5" fill="#1a1a2e"/><circle cx="60" cy="30" r="5" fill="#1a1a2e"/>
            <circle cx="42" cy="28" r="1.5" fill="white"/><circle cx="62" cy="28" r="1.5" fill="white"/>
            <path d="M42 38 Q50 44 58 38" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <line x1="50" y1="18" x2="50" y2="8" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="50" cy="6" r="4" fill="#FF9800"/>
            <rect x="12" y="50" width="13" height="6" rx="3" fill="#F0D898"/>
            <rect x="33" y="80" width="10" height="12" rx="4" fill="#F0D898"/>
            <rect x="57" y="80" width="10" height="12" rx="4" fill="#F0D898"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0D1B2E]">{t.assistantTitre}</h2>
          <p className="text-[#4A5E78] text-sm">{t.assistantDesc}</p>
        </div>
        {assistantMessages.length > 0 && (
          <button
            onClick={nouvelleConversation}
            className="ml-auto text-xs bg-[#0D1B2E]/10 hover:bg-[#0D1B2E]/20 text-[#0D1B2E] px-3 py-1.5 rounded-lg transition"
          >
            {t.nouvelleConversation}
          </button>
        )}
      </div>

      {/* Zone de chat */}
      <div className="flex-1 bg-white rounded-xl border border-[#E4DDD0] shadow-sm flex flex-col overflow-hidden">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {assistantMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-[#4A5E78] font-medium text-lg mb-2">{t.bonjourPrenom} {profile.prenom} !</p>
              <p className="text-[#8A9BB0] text-sm mb-6 max-w-md">
                {t.assistantIntro} <strong>{profile.immeuble}</strong>{t.assistantIntro2}
              </p>
              <p className="text-xs text-[#8A9BB0] mb-4 font-medium">{t.questionsFréquentes}</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  t.assistantQ1,
                  t.assistantQ2,
                  t.assistantQ3,
                  t.assistantQ4,
                  t.assistantQ5,
                  t.assistantQ6,
                  t.assistantQ7,
                  t.assistantQ8,
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => {
                      setAssistantInput(q)
                      setTimeout(() => {
                        const input = document.getElementById('assistant-input')
                        if (input) (input as HTMLInputElement).focus()
                      }, 50)
                    }}
                    className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-2 rounded-full transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {assistantMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 bg-[#C9A84C] rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">
                      🤖
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#0D1B2E] text-white rounded-tr-sm'
                        : 'bg-white border border-[#E4DDD0] text-[#0D1B2E] rounded-tl-sm'
                    }`}
                  >
                    {msg.role === 'assistant' ? <MarkdownIA texte={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}
              {assistantLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 bg-[#C9A84C] rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">
                    🤖
                  </div>
                  <div className="bg-white border border-[#E4DDD0] rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={assistantEndRef} />
            </>
          )}
        </div>

        {/* Suggestions rapides quand il y a deja des messages */}
        {assistantMessages.length > 0 && (
          <div className="px-4 py-2 border-t border-[#E4DDD0] flex gap-2 overflow-x-auto">
            {[t.suggestionQ1, t.suggestionQ2, t.suggestionQ3, t.suggestionQ4].map(q => (
              <button
                key={q}
                onClick={() => {
                  setAssistantInput(q)
                  setTimeout(() => {
                    const input = document.getElementById('assistant-input')
                    if (input) (input as HTMLInputElement).focus()
                  }, 50)
                }}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-full transition flex-shrink-0"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-[#E4DDD0]">
          <form
            onSubmit={e => { e.preventDefault(); sendAssistantMessage() }}
            className="flex gap-2"
          >
            <input
              id="assistant-input"
              type="text"
              value={assistantInput}
              onChange={e => setAssistantInput(e.target.value)}
              placeholder={t.placeholderInput}
              disabled={assistantLoading}
              className="flex-1 bg-[#F7F4EE] border border-[#E4DDD0] rounded-xl px-4 py-3 text-sm text-[#0D1B2E] placeholder-gray-400 focus:outline-none focus:border-[#C9A84C] focus:bg-white disabled:opacity-60 transition"
            />
            <button
              type="submit"
              disabled={!assistantInput.trim() || assistantLoading}
              className="bg-[#0D1B2E] hover:bg-[#152338] disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl transition"
            >
              {assistantLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
          <p className="text-xs text-[#8A9BB0] mt-2 text-center">
            {t.assistantPied}
          </p>
        </div>
      </div>
    </div>
  )
}
