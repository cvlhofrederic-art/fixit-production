'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import { Alert, type AlertProps } from '../alert'
import { useToast } from '../toast'
import styles from './AgentChatPage.module.css'

export interface AgentConversation {
  id: string
  title: string
  /** Regroupement temporel dans la sidebar. Défaut : 'mais-antigas'. */
  bucket?: 'ontem' | 'esta-semana' | 'mais-antigas'
}

export interface AgentChatPageProps {
  /** Source de l'image mascotte (le bundle passait une clé d'un map global ;
   *  ici on découple : le consommateur fournit l'src). */
  mascot?: string
  name: string
  title?: ReactNode
  intro: ReactNode
  introDetail?: ReactNode
  suggestions?: string[]
  conversations?: AgentConversation[]
  alert?: AlertProps
  contextSelector?: { label: ReactNode; options: string[] }
  showDocsBtn?: boolean
  inputPlaceholder?: string
  /** Overrides optionnels ; par défaut → toast (comportement byte-exact bundle). */
  onSend?: (value: string) => void
  /** Envoi async : retourne la réponse de l'agent. Prioritaire sur onSend (Phase 2). */
  onAsk?: (message: string) => Promise<string>
  onNewConversation?: () => void
  onOpenDocs?: () => void
  onSelectConversation?: (conv: AgentConversation) => void
}

const BUCKETS = ['ontem', 'esta-semana', 'mais-antigas'] as const
const BUCKET_LABEL: Record<(typeof BUCKETS)[number], string> = {
  ontem: 'ONTEM',
  'esta-semana': 'ESTA SEMANA',
  'mais-antigas': 'MAIS ANTIGAS',
}

/**
 * AgentChatPage v54 — page composite agent IA (port byte-exact du bundle V5.7).
 * Sidebar « Conversas » (recherche + buckets temporels) + zone chat principale
 * (en-tête mascotte + badge IA, sélecteur de contexte, Alert optionnelle,
 * accueil mascotte, suggestions, champ de saisie). Responsive : stack ≤1100px,
 * suggestions 1 colonne ≤820px.
 *
 * Découplages/choix validés : `mascot` est une src d'image (pas une clé d'un map
 * global) ; les actions (send / nouvelle conversa / docs / sélection) ont un
 * callback optionnel, à défaut un toast (comportement bundle). Réutilise les
 * primitives v54 Icon, Alert, useToast — doit donc vivre dans un `ToastProvider`.
 * Classes en CSS Module (les `.agent-*` / `.btn` du bundle étaient globales).
 */
export default function AgentChatPage({
  mascot, name, title, intro, introDetail,
  suggestions = [], conversations = [], alert, contextSelector, showDocsBtn,
  inputPlaceholder = 'Faça uma pergunta…',
  onSend, onAsk, onNewConversation, onOpenDocs, onSelectConversation,
}: AgentChatPageProps) {
  const [inputVal, setInputVal] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [ctxVal, setCtxVal] = useState(contextSelector?.options?.[0] ?? '')
  const { push } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const shortName = name.split(' ').pop()

  const applySuggestion = (s: string) => {
    setInputVal(s)
    inputRef.current?.focus()
  }
  const handleSend = (e?: FormEvent) => {
    e?.preventDefault()
    const v = inputVal.trim()
    if (!v || busy) return
    if (onAsk) {
      setMessages((prev) => [...prev, { role: 'user', content: v }])
      setInputVal('')
      setBusy(true)
      onAsk(v)
        .then((resp) => setMessages((prev) => [...prev, { role: 'assistant', content: resp }]))
        .catch(() => setMessages((prev) => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao contactar o assistente. Tente novamente.' }]))
        .finally(() => setBusy(false))
      return
    }
    if (onSend) onSend(v)
    else push({ kind: 'info', title: `Pergunta enviada a ${shortName}`, desc: 'Em breve a resposta IA (em desenvolvimento)' })
    setInputVal('')
  }
  const newConv = () => {
    if (onNewConversation) onNewConversation()
    else push({ kind: 'success', title: 'Nova conversa', desc: `Conversa iniciada com ${shortName}` })
  }
  const openDocs = () => {
    if (onOpenDocs) onOpenDocs()
    else push({ kind: 'info', title: 'Documentos do condomínio', desc: 'Painel de documentos em preparação' })
  }
  const selectConv = (c: AgentConversation) => {
    if (onSelectConversation) onSelectConversation(c)
    else push({ kind: 'info', title: 'Conversa carregada', desc: c.title })
  }

  const buckets: Record<string, AgentConversation[]> = { ontem: [], 'esta-semana': [], 'mais-antigas': [] }
  conversations.forEach((c) => {
    (buckets[c.bucket ?? 'mais-antigas'] ?? buckets['mais-antigas']).push(c)
  })

  return (
    <div className={styles.page}>
      <aside className={styles.convSide} aria-label="Histórico de conversas">
        <div className={styles.convHead}>
          <h3>CONVERSAS</h3>
          <button type="button" className={styles.iconOnly} aria-label="Esconder painel" title="Esconder">
            <Icon name="chevron-left" />
          </button>
        </div>
        <button type="button" className={clsx(styles.btn, styles.gold, styles.newconv)} onClick={newConv}>
          + Nova conversa
        </button>
        <div className={styles.convSearch}>
          <Icon name="search" />
          <input type="text" placeholder="Procurar conversas…" aria-label="Procurar conversas" />
        </div>
        <div className={styles.convList}>
          {conversations.length === 0 ? (
            <p className={styles.convEmpty}>Nenhuma conversa ainda. Inicie a primeira para começar.</p>
          ) : (
            BUCKETS.map((bk) =>
              buckets[bk].length > 0 ? (
                <section key={bk}>
                  <div className={styles.convBucket}>{BUCKET_LABEL[bk]}</div>
                  {buckets[bk].map((c) => (
                    <button key={c.id} type="button" className={styles.convItem} onClick={() => selectConv(c)}>
                      <Icon name="chat" />
                      <span>{c.title}</span>
                    </button>
                  ))}
                </section>
              ) : null,
            )
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.head}>
          {mascot && <img className={styles.mascotSm} src={mascot} alt="" />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className={styles.name}>
              {name}
              <span className={styles.iaBadge}>IA</span>
            </h2>
            {title && <p className={styles.titleText}>{title}</p>}
          </div>
        </div>

        {(contextSelector || showDocsBtn) && (
          <div className={styles.contextRow}>
            {contextSelector && (
              <div className={styles.ctxField}>
                <label htmlFor="agent-ctx-sel">{contextSelector.label} :</label>
                <select id="agent-ctx-sel" value={ctxVal} onChange={(e) => setCtxVal(e.target.value)}>
                  {contextSelector.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )}
            {showDocsBtn && (
              <button type="button" className={styles.btn} onClick={openDocs}>
                <Icon name="doc" />Documentos
              </button>
            )}
          </div>
        )}

        {alert && <Alert {...alert} />}

        {messages.length === 0 ? (
          <>
            <div className={styles.welcome}>
              {mascot && <img className={styles.mascotLg} src={mascot} alt="" />}
              <h3 className={styles.intro}>{intro}</h3>
              {introDetail && <p className={styles.introDetail}>{introDetail}</p>}
            </div>

            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <button key={i} type="button" className={styles.suggestion} onClick={() => applySuggestion(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 8px', flex: 1, overflowY: 'auto' }} aria-live="polite" aria-busy={busy}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  background: msg.role === 'user' ? 'var(--v54-gold-500)' : 'var(--v54-cream)',
                  color: msg.role === 'user' ? '#fff' : 'var(--v54-ink)',
                }}
              >
                {msg.content}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', color: 'var(--v54-navy-300)', fontSize: 13 }}>A escrever…</div>}
          </div>
        )}

        <form className={styles.inputRow} onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={inputPlaceholder}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            aria-label={`Pergunta a ${name}`}
          />
          <button type="submit" className={clsx(styles.btn, styles.gold, styles.send)} disabled={!inputVal.trim() || busy}>
            Enviar
          </button>
        </form>
      </main>
    </div>
  )
}
