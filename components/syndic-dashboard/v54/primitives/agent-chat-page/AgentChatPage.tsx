'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import { Alert, type AlertProps } from '../alert'
import { useToast } from '../toast'
import { useMessages } from '@/lib/syndic/v54/i18n'
import MarkdownIA from '@/components/common/MarkdownIA'
import { AGENT_CHAT_PAGE_MESSAGES } from './agent-chat-page.messages'
import styles from './AgentChatPage.module.css'

/** Message du fil de conversation, tel que transmis à l'agent comme historique. */
export interface AgentChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Action proposée par l'agent (ex. Fixy : créer une mission), exécutée seulement après confirmation. */
export interface AgentActionProposee {
  libelle: string
  details: string[]
  /** Exécute l'action ; renvoie le message de confirmation à afficher. */
  executer: () => Promise<string>
}

/** Réponse riche d'un agent : texte et, éventuellement, action à faire confirmer. */
export interface AgentReponse {
  texte: string
  action?: AgentActionProposee
}

export interface AgentConversation {
  id: string
  title: string
  /** Regroupement temporel dans la sidebar. Défaut : 'mais-antigas'. */
  bucket?: 'ontem' | 'esta-semana' | 'mais-antigas'
}

/** Textes de l'interface — surchargeables par locale (défauts = bundle PT, byte-exact). */
export interface AgentChatPageLabels {
  asideAria: string
  heading: string
  hidePanel: string
  newConversation: string
  searchPlaceholder: string
  searchAria: string
  empty: string
  bucketLabels: Record<'ontem' | 'esta-semana' | 'mais-antigas', string>
  docsButton: string
  send: string
  typing: string
  inputAria: (name: string) => string
  errorReply: string
  actionConfirm: string
  actionIgnore: string
  actionFailed: string
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
  /** Surcharge partielle des textes UI (locale FR…). Omis = chaînes PT du bundle. */
  labels?: Partial<AgentChatPageLabels>
  /** Overrides optionnels ; par défaut → toast (comportement byte-exact bundle). */
  onSend?: (value: string) => void
  /** Envoi async : retourne la réponse de l'agent. Prioritaire sur onSend (Phase 2).
   *  `historique` : messages déjà affichés avant `message` (mémoire de conversation),
   *  sans les réponses d'erreur locales (`errorReply`), qui ne viennent pas de l'agent. */
  onAsk?: (message: string, historique: AgentChatMessage[]) => Promise<string | AgentReponse>
  onNewConversation?: () => void
  onOpenDocs?: () => void
  onSelectConversation?: (conv: AgentConversation) => void
}

const BUCKETS = ['ontem', 'esta-semana', 'mais-antigas'] as const

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
  inputPlaceholder,
  labels,
  onSend, onAsk, onNewConversation, onOpenDocs, onSelectConversation,
}: AgentChatPageProps) {
  const D = useMessages(AGENT_CHAT_PAGE_MESSAGES)
  const L: AgentChatPageLabels = { ...D.labels, ...labels, bucketLabels: { ...D.labels.bucketLabels, ...labels?.bucketLabels } }
  const placeholder = inputPlaceholder ?? D.placeholder
  const [inputVal, setInputVal] = useState('')
  // `erreur` marque la réponse de repli affichée quand l'agent échoue (exclue de l'historique).
  // `action` : action proposée par l'agent sous sa réponse (carte Confirmer / Ignorer tant qu'elle est en attente).
  const [messages, setMessages] = useState<(AgentChatMessage & {
    erreur?: boolean
    action?: AgentActionProposee & { etat: 'proposee' | 'en_cours' | 'terminee' }
  })[]>([])
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
      // Historique = fil affiché avant cette question (pas d'envoi concurrent : `busy`).
      const historique = messages.filter((m) => !m.erreur).map(({ role, content }) => ({ role, content }))
      setMessages((prev) => [...prev, { role: 'user', content: v }])
      setInputVal('')
      setBusy(true)
      onAsk(v, historique)
        .then((resp) => setMessages((prev) => [
          ...prev,
          typeof resp === 'string'
            ? { role: 'assistant', content: resp }
            : { role: 'assistant', content: resp.texte, action: resp.action && { ...resp.action, etat: 'proposee' } },
        ]))
        .catch(() => setMessages((prev) => [...prev, { role: 'assistant', content: L.errorReply, erreur: true }]))
        .finally(() => setBusy(false))
      return
    }
    if (onSend) onSend(v)
    else push({ kind: 'info', title: D.envoyee(shortName ?? name), desc: D.envoyeeDetail })
    setInputVal('')
  }
  /** Confirme (exécute) ou ignore l'action proposée sous le message `index`. */
  const traiterAction = (index: number, confirmer: boolean) => {
    const cible = messages[index]?.action
    if (!cible || cible.etat !== 'proposee') return
    const majEtat = (etat: 'proposee' | 'en_cours' | 'terminee') =>
      setMessages((prev) => prev.map((m, i) => (i === index && m.action ? { ...m, action: { ...m.action, etat } } : m)))
    if (!confirmer) {
      majEtat('terminee')
      return
    }
    majEtat('en_cours')
    cible.executer()
      .then((confirmation) => {
        majEtat('terminee')
        setMessages((prev) => [...prev, { role: 'assistant', content: confirmation }])
      })
      .catch(() => {
        majEtat('proposee')
        push({ kind: 'error', title: L.actionFailed })
      })
  }

  const newConv = () => {
    if (onNewConversation) onNewConversation()
    else push({ kind: 'success', title: D.nouvelleConversation, desc: D.conversationDemarree(shortName ?? name) })
  }
  const openDocs = () => {
    if (onOpenDocs) onOpenDocs()
    else push({ kind: 'info', title: D.documents, desc: D.documentsDetail })
  }
  const selectConv = (c: AgentConversation) => {
    if (onSelectConversation) onSelectConversation(c)
    else push({ kind: 'info', title: D.conversationChargee, desc: c.title })
  }

  const buckets: Record<string, AgentConversation[]> = { ontem: [], 'esta-semana': [], 'mais-antigas': [] }
  conversations.forEach((c) => {
    (buckets[c.bucket ?? 'mais-antigas'] ?? buckets['mais-antigas']).push(c)
  })

  return (
    <div className={styles.page}>
      <aside className={styles.convSide} aria-label={L.asideAria}>
        <div className={styles.convHead}>
          <h3>{L.heading}</h3>
          <button type="button" className={styles.iconOnly} aria-label={L.hidePanel} title={L.hidePanel}>
            <Icon name="chevron-left" />
          </button>
        </div>
        <button type="button" className={clsx(styles.btn, styles.gold, styles.newconv)} onClick={newConv}>
          {L.newConversation}
        </button>
        <div className={styles.convSearch}>
          <Icon name="search" />
          <input type="text" placeholder={L.searchPlaceholder} aria-label={L.searchAria} />
        </div>
        <div className={styles.convList}>
          {conversations.length === 0 ? (
            <p className={styles.convEmpty}>{L.empty}</p>
          ) : (
            BUCKETS.map((bk) =>
              buckets[bk].length > 0 ? (
                <section key={bk}>
                  <div className={styles.convBucket}>{L.bucketLabels[bk]}</div>
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
                <Icon name="doc" />{L.docsButton}
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
                  // Réponses de l'agent en Markdown (MarkdownIA gère les retours à la ligne).
                  whiteSpace: msg.role === 'user' ? 'pre-wrap' : undefined,
                  background: msg.role === 'user' ? 'var(--v54-gold-500)' : 'var(--v54-cream)',
                  color: msg.role === 'user' ? '#fff' : 'var(--v54-ink)',
                }}
              >
                {msg.role === 'assistant' ? <MarkdownIA texte={msg.content} /> : msg.content}
                {msg.action && msg.action.etat !== 'terminee' && (
                  <div
                    role="group"
                    aria-label={msg.action.libelle}
                    style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--v54-line, rgba(0,0,0,.1))' }}
                  >
                    <strong>{msg.action.libelle}</strong>
                    {msg.action.details.length > 0 && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18, listStyleType: 'disc', fontSize: 12.5 }}>
                        {msg.action.details.map((d, j) => <li key={j}>{d}</li>)}
                      </ul>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        className={clsx(styles.btn, styles.gold)}
                        disabled={msg.action.etat === 'en_cours'}
                        onClick={() => traiterAction(i, true)}
                      >
                        {L.actionConfirm}
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={msg.action.etat === 'en_cours'}
                        onClick={() => traiterAction(i, false)}
                      >
                        {L.actionIgnore}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', color: 'var(--v54-navy-300)', fontSize: 13 }}>{L.typing}</div>}
          </div>
        )}

        <form className={styles.inputRow} onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={placeholder}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            aria-label={L.inputAria(name)}
          />
          <button type="submit" className={clsx(styles.btn, styles.gold, styles.send)} disabled={!inputVal.trim() || busy}>
            {L.send}
          </button>
        </form>
      </main>
    </div>
  )
}
