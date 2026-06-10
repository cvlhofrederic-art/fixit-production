'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { PageHead } from '@/components/syndic-dashboard/v54/primitives/page-head'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import btnCss from '@/components/syndic-dashboard/v54/primitives/button/Button.module.css'

/** Canal de communication — port FR du ModCanal du mockup v8 (messagerie par dossier
 * de mandat). Réutilise les classes CSS globales `canal-*` du module PT
 * (components/syndic-dashboard/v54/modules/canal.css, chargé par le layout) :
 * structure alignée sur le ModCanal PT, textes et données du mockup FR. */

type CanalDot = 'gold' | 'amber' | 'sage' | 'rust'
/** [auteur, horodatage, texte, 'me' | 'them'] */
type CanalMsg = [string, string, string, string]
/** [initiales, nom, rôle, 'on' | ''] */
type CanalParticipant = [string, string, string, string]
/** [nom, date?, état 'done' | 'now' | ''] — dernière case = état. */
type CanalStep = string[]

interface CanalMission {
  id: string
  dot: CanalDot
  title: string
  sub: string
  tags: string[]
  unread: number
  participants: CanalParticipant[]
  steps: CanalStep[]
  msgs: CanalMsg[]
}

const CANAL_MISSIONS: CanalMission[] = [
  { id: 'm1', dot: 'gold', title: 'Le Méridien — Conseil syndical', sub: 'RG 26/00892 · 36 lots', tags: ['art.46', 'En cours'], unread: 3,
    participants: [['CN', 'Camille Noël', 'Juriste', 'on'], ['AD', 'Awa Diallo', 'Gestionnaire', 'on'], ['PR', 'Paul Renaud', 'Cons. syndical', '']],
    steps: [['Désignation', '12/03', 'done'], ['État des lieux', '28/03', 'done'], ['Convocation AG', '08/06', 'now'], ['Reddition', '—', '']],
    msgs: [['Awa Diallo', 'Hier 16:20', 'Bonjour, l\'état des lieux financier est finalisé, je vous transmets le projet de convocation.', 'them'],
      ['Paul Renaud', 'Hier 17:05', 'Parfait. Le conseil syndical valide la date du 8 juin.', 'them'],
      ['Vous', '09:12', 'Convocation envoyée en LRAR à l\'ensemble des copropriétaires ce matin.', 'me']] },
  { id: 'm2', dot: 'amber', title: 'Le Clos des Vignes — AG élective', sub: '48 lots · échéance 22/07/2026', tags: ['art.46', 'AG'], unread: 1,
    participants: [['CD', 'Cabinet Delaunay', 'Direction', 'on'], ['CN', 'Camille Noël', 'Juriste', '']],
    steps: [['Désignation', '—', 'done'], ['Préparation AG', 'En cours', 'now'], ['Tenue AG', '22/07', '']],
    msgs: [['Cabinet Delaunay', 'Lun 10:40', 'Ordre du jour de l\'AG élective à finaliser avant le 30 juin.', 'them'],
      ['Vous', 'Lun 11:15', 'Je prépare le projet de résolutions, retour demain.', 'me']] },
  { id: 'm3', dot: 'sage', title: 'Les Tilleuls — Travaux toiture', sub: 'art.29-1 · 24 lots', tags: ['art.29-1', 'Technique'], unread: 0,
    participants: [['ML', 'Marc Léautaud', 'Gestionnaire', 'on'], ['ET', 'Ent. Toitures Nord', 'Prestataire', '']],
    steps: [['Diagnostic', 'done'], ['Devis', 'done'], ['Vote travaux', 'À planifier', 'now']],
    msgs: [['Marc Léautaud', 'Mar 14:00', 'Devis reçu de l\'entreprise : 18 400 € HT. Visite technique programmée lundi.', 'them']] },
  { id: 'm4', dot: 'rust', title: 'Villa Montaigne — Notification', sub: '12 lots · notification en cours', tags: ['art.46', 'Urgent'], unread: 2,
    participants: [['SV', 'Sophie Vidal', 'Assistante', 'on'], ['CN', 'Camille Noël', 'Juriste', 'on']],
    steps: [['Ordonnance', '28/01', 'done'], ['Notification copro', 'En cours', 'now'], ['Prise de fonction', '—', '']],
    msgs: [['Sophie Vidal', '08:30', 'La notification de l\'ordonnance part aujourd\'hui à tous les copropriétaires.', 'them'],
      ['Camille Noël', '08:45', 'Pensez à joindre la copie certifiée de l\'ordonnance du 28/01.', 'them']] },
]

const DOT_COLOR: Record<CanalDot, string> = {
  gold: 'var(--v54-gold-500)',
  amber: 'var(--v54-amber-500)',
  sage: 'var(--v54-sage-500)',
  rust: 'var(--v54-rust-500)',
}

/** Dernière case d'une étape mockup ('done' | 'now' | '') → état des classes canal.css. */
const stepState = (s: CanalStep): 'done' | 'current' | 'pending' => {
  const last = s[s.length - 1]
  if (last === 'done') return 'done'
  if (last === 'now') return 'current'
  return 'pending'
}

const missionRowStyle = { display: 'flex', gap: 10, alignItems: 'flex-start' } as const
const msgMetaStyle = { fontSize: 11, color: 'var(--v54-navy-300)', marginBottom: 3 } as const
const msgBubbleBase = { maxWidth: '78%', padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.45 } as const

export default function ModCanal() {
  const { push } = useToast()
  const [active, setActive] = useState('m1')
  const [text, setText] = useState('')
  const [threads, setThreads] = useState<Record<string, CanalMsg[]>>(() => {
    const o: Record<string, CanalMsg[]> = {}
    CANAL_MISSIONS.forEach(mi => { o[mi.id] = mi.msgs.slice() })
    return o
  })
  const [sub, setSub] = useState<'all' | 'unread'>('all')
  const visMissions = sub === 'unread' ? CANAL_MISSIONS.filter(x => x.unread > 0) : CANAL_MISSIONS
  const mission = CANAL_MISSIONS.find(x => x.id === active) || CANAL_MISSIONS[0]
  const send = () => {
    const t = text.trim()
    if (!t) return
    setThreads(s => ({ ...s, [mission.id]: [...(s[mission.id] || []), ['Vous', 'À l\'instant', t, 'me']] }))
    setText('')
  }

  return (
    <>
      <PageHead eyebrow="Gestion courante" title="Canal de communication"
        lede="Échangez par dossier avec le conseil syndical, les copropriétaires et les intervenants."
        actions={<Button variant="gold" onClick={() => push({ kind: 'info', title: 'Nouveau canal', desc: 'Ouvrir un fil sur un dossier de mandat' })}><Icon name="plus" />Nouveau canal</Button>} />
      <div className="canal-grid">
        {/* Colonne 1 — dossiers */}
        <aside className="canal-missions-col" aria-label="Liste des dossiers">
          <div className="canal-missions-head">
            <div className="canal-missions-label">Dossiers</div>
            <div className="canal-missions-subtabs">
              <button type="button" className={clsx('canal-chip', sub === 'all' && 'active')} onClick={() => setSub('all')}>
                Tous <span className="canal-chip-count">{CANAL_MISSIONS.length}</span>
              </button>
              <button type="button" className={clsx('canal-chip', sub === 'unread' && 'active')} onClick={() => setSub('unread')}>
                Non lus <span className="canal-chip-count">{CANAL_MISSIONS.filter(x => x.unread > 0).length}</span>
              </button>
            </div>
            <div className="canal-search">
              <Icon name="search" />
              <input type="text" aria-label="Rechercher un dossier" placeholder="Rechercher…" />
            </div>
          </div>
          <div className="canal-missions-list">
            {visMissions.map(x => (
              <button key={x.id} type="button" className={clsx('canal-mission-card', active === x.id && 'active')}
                onClick={() => setActive(x.id)} aria-current={active === x.id ? 'true' : undefined} style={missionRowStyle}>
                <span className="canal-mission-dot" style={{ background: DOT_COLOR[x.dot], marginTop: 5 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="canal-mission-title" style={{ display: 'block' }}>{x.title}</span>
                  <span className="canal-mission-sub">{x.sub}</span>
                  <span className="canal-mission-tags">{x.tags.map((t, i) => <Pill key={i} noDot>{t}</Pill>)}</span>
                </span>
                {x.unread > 0 && <span className="canal-mission-unread">{x.unread}</span>}
              </button>
            ))}
          </div>
        </aside>
        {/* Colonne 2 — fil de discussion */}
        <section className="canal-chat-col" aria-label="Conversation">
          <header className="canal-chat-head">
            <div className="canal-chat-head-info">
              <h3 className="canal-chat-title">{mission.title}</h3>
              <p className="canal-chat-meta"><span className="canal-chat-meta-id">{mission.sub}</span></p>
            </div>
            <div className="canal-chat-head-actions">
              <Button variant="ghost" size="sm" aria-label="Voir les participants"
                onClick={() => push({ kind: 'info', title: 'Participants', desc: mission.participants.length + ' membres' })}><Icon name="users" /></Button>
            </div>
          </header>
          <div className="canal-chat-body" style={{ display: 'block' }}>
            {(threads[mission.id] || []).map((mm, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: mm[3] === 'me' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                <div style={msgMetaStyle}>{mm[0]} · {mm[1]}</div>
                <div style={{ ...msgBubbleBase, background: mm[3] === 'me' ? 'var(--v54-navy-700)' : 'var(--v54-cream)', color: mm[3] === 'me' ? '#fff' : 'var(--v54-ink)' }}>{mm[2]}</div>
              </div>
            ))}
          </div>
          <footer className="canal-chat-footer">
            <form className="canal-chat-input-row" onSubmit={e => { e.preventDefault(); send() }}>
              <input type="text" aria-label="Message" className="canal-chat-input" value={text}
                onChange={e => setText(e.target.value)} placeholder="Écrire un message…" />
              <button type="submit" aria-label="Envoyer le message" className={clsx('canal-chat-send', btnCss.btn, btnCss.primary)}><Icon name="arrow" /></button>
            </form>
            <div className="canal-chat-footer-row">
              <p className="canal-chat-hint">Les échanges sont horodatés et versés au journal du mandat.</p>
              <div className="canal-chat-quickactions">
                <button type="button" className="canal-action gold" onClick={() => push({ kind: 'success', title: 'Convocation', desc: 'Modèle de convocation joint au fil' })}><Icon name="mail" /><span>Convoquer</span></button>
                <button type="button" className="canal-action sage" onClick={() => push({ kind: 'info', title: 'Pièce jointe', desc: 'Joindre une pièce du dossier' })}><Icon name="doc" /><span>Pièce</span></button>
                <button type="button" className="canal-action rust" onClick={() => push({ kind: 'info', title: 'Clore le fil', desc: 'Archiver ce canal' })}><Icon name="check" /><span>Clore</span></button>
              </div>
            </div>
          </footer>
        </section>
        {/* Colonne 3 — détails du mandat */}
        <aside className="canal-details-col" aria-label="Détails du mandat">
          <section className="canal-details-section">
            <h4 className="canal-details-label">Mandat</h4>
            <h3 className="canal-details-title">{mission.title}</h3>
            <div className="canal-details-pills">{mission.tags.map((t, i) => <Pill key={i} noDot>{t}</Pill>)}</div>
          </section>
          <section className="canal-details-section">
            <h4 className="canal-details-label">Participants</h4>
            <ul className="canal-participants">
              {mission.participants.map((p, i) => (
                <li key={i} className="canal-participant">
                  <span className="canal-participant-avatar">{p[0]}</span>
                  <div className="canal-participant-info">
                    <div className="canal-participant-name">{p[1]}</div>
                    <div className="canal-participant-role">{p[2]}</div>
                  </div>
                  {p[3] === 'on' && <span className="canal-participant-online" aria-label="En ligne" />}
                </li>
              ))}
            </ul>
          </section>
          <section className="canal-details-section">
            <h4 className="canal-details-label">Étapes de la mission</h4>
            <ol className="canal-progress">
              {mission.steps.map((s, i) => (
                <li key={i} className={`canal-progress-step state-${stepState(s)}`}>
                  <span className="canal-progress-marker" />
                  <div className="canal-progress-content">
                    <div className="canal-progress-step-name">{s[0]}</div>
                    <div className="canal-progress-step-date">{s.length > 2 ? s[1] : ''}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  )
}
