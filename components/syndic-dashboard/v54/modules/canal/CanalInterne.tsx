'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useToast } from '../../primitives/toast'
import Icon from '../../primitives/icon/Icon'
import btnCss from '../../primitives/button/Button.module.css'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { envoyerMessageInterne, fetchCanalInterne, type MessageInterne } from '@/lib/syndic/v54/api'
import type { TeamMember } from '@/components/syndic-dashboard/types'
import { CANAL_REEL_MESSAGES } from '../i18n/ModCanalReel.messages'
import { horodatage, initiales } from './format'
import { usePolling } from './use-polling'

/**
 * Onglet « Interne » (données réelles) : fil de l'équipe du cabinet (GET/POST /api/syndic/canal-interne,
 * table syndic_messages type 'canal_interne'), rechargé comme le reste du canal.
 */
export function CanalInterne({ token, equipe }: Readonly<{ token: string; equipe: TeamMember[] }>) {
  const t = useMessages(CANAL_REEL_MESSAGES)
  const it = t.interne
  const locale = useV54Locale()
  const { push } = useToast()
  const [messages, setMessages] = useState<MessageInterne[] | null>(null)
  const [brouillon, setBrouillon] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const erreurSignalee = useRef(false)
  const fil = useRef<HTMLDivElement>(null)

  const charger = useCallback(() => {
    fetchCanalInterne(token)
      .then((liste) => { setMessages(liste); erreurSignalee.current = false })
      .catch(() => {
        setMessages((m) => m ?? [])
        // Une seule alerte tant que l'échec persiste (le rechargement automatique continue).
        if (!erreurSignalee.current) push({ kind: 'error', title: t.erreurChargement, desc: t.erreurChargementDesc })
        erreurSignalee.current = true
      })
  }, [token, push, t.erreurChargement, t.erreurChargementDesc])
  usePolling(charger)

  useEffect(() => {
    const el = fil.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages?.length])

  const envoyer = async () => {
    const texte = brouillon.trim()
    if (!texte) return
    setEnvoi(true)
    try {
      await envoyerMessageInterne(token, texte)
      setBrouillon('')
      push({ kind: 'success', title: it.envoye })
      charger()
    } catch {
      push({ kind: 'error', title: it.erreurEnvoi, desc: t.validation.toasts.reessayer })
    } finally {
      setEnvoi(false)
    }
  }

  const liste = messages ?? []
  return (
    <div className="canal-grid">
      <aside className="canal-missions-col" aria-label={it.listeAria}>
        <div className="canal-missions-head">
          <div className="canal-missions-label">{it.label}</div>
        </div>
        <div className="canal-missions-list">
          {equipe.length === 0 ? (
            <p className="canal-empty">{it.aucunMembre}</p>
          ) : (
            <ul className="canal-participants canal-equipe">
              {equipe.map((m) => (
                <li key={m.id} className="canal-participant">
                  <span className="canal-participant-avatar">{initiales(m.full_name || m.email)}</span>
                  <div className="canal-participant-info">
                    <div className="canal-participant-name">{m.full_name || m.email}</div>
                    <div className="canal-participant-role">{m.email}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="canal-chat-col" aria-label={t.messageAria}>
        <header className="canal-chat-head">
          <div className="canal-chat-head-info">
            <h3 className="canal-chat-title">{it.titre}</h3>
            <p className="canal-chat-meta"><span className="canal-mission-dot" />{it.meta(liste.length)}</p>
          </div>
        </header>
        <div className={clsx('canal-chat-body', liste.length > 0 && 'canal-thread')} ref={fil}>
          {messages === null ? (
            <p className="canal-empty">{t.chargement}</p>
          ) : liste.length === 0 ? (
            <p className="canal-empty">{it.aucun}</p>
          ) : liste.map((m) => (
            <div key={m.id} className="canal-msg">
              <div className="canal-msg-meta">{m.auteur} · {horodatage(m.createdAt, locale)}</div>
              {m.texte}
            </div>
          ))}
        </div>
        <footer className="canal-chat-footer">
          <form className="canal-chat-input-row" onSubmit={(e) => { e.preventDefault(); void envoyer() }}>
            <input type="text" className="canal-chat-input" placeholder={it.placeholder} value={brouillon} onChange={(e) => setBrouillon(e.target.value)} aria-label={t.messageAria} />
            <button type="submit" className={clsx('canal-chat-send', btnCss.btn, btnCss.primary)} disabled={!brouillon.trim() || envoi} aria-label={t.envoyerAria}><Icon name="arrow" /></button>
          </form>
        </footer>
      </section>

      <aside className="canal-details-col" aria-label={it.details.aria}>
        <section className="canal-details-section">
          <h4 className="canal-details-label">{it.details.canal}</h4>
          <h3 className="canal-details-title">{it.titre}</h3>
          <p className="canal-chat-meta">{it.details.texte}</p>
        </section>
      </aside>
    </div>
  )
}
