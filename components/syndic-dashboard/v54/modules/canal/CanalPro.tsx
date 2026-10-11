'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Pill } from '../../primitives/pill'
import { useToast } from '../../primitives/toast'
import Icon from '../../primitives/icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import btnCss from '../../primitives/button/Button.module.css'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { envoyerMessageCanalPro, type ConversationCanalPro, type DocumentCanal, type MessageCanalPro, type OrdreMissionCanal } from '@/lib/syndic/v54/api'
import { CANAL_REEL_MESSAGES } from '../i18n/ModCanalReel.messages'
import { PILL_STATUT_ORDRE, RANG_ORDRE, horodatage, initiales, montantEUR } from './format'

type FiltrePro = 'toutes' | 'urgentes' | 'enCours' | 'enAttente'
const FILTRES: [FiltrePro, string | null][] = [['toutes', null], ['urgentes', 'rust'], ['enCours', 'amber'], ['enAttente', 'gold']]

const correspond = (c: ConversationCanalPro, f: FiltrePro) =>
  f === 'toutes'
  || (f === 'urgentes' && c.ordre?.urgence === 'urgente')
  || (f === 'enCours' && (c.ordre?.statut === 'accepte' || c.ordre?.statut === 'en_cours'))
  || (f === 'enAttente' && c.ordre?.statut === 'en_attente')

const ICONE_DOCUMENT: Record<DocumentCanal['type'], IconName> = { devis: 'file-text', rapport: 'file-check', facture: 'coin' }

/**
 * Onglet « Professionnels » (données réelles) : conversations du cabinet avec ses prestataires
 * (GET /api/syndic/canal-pro) — ordres de mission et leur statut, messages, devis / rapports /
 * factures envoyés depuis Messagerie > Pro, et réponse du syndic (POST /api/syndic/canal-pro).
 */
export function CanalPro({
  conversations,
  selectedId,
  onSelect,
  token,
  onRafraichir,
  nbEquipe,
  onEquipe,
}: Readonly<{
  conversations: ConversationCanalPro[] | null
  selectedId: string | null
  onSelect: (id: string) => void
  token: string
  onRafraichir: () => void
  nbEquipe: number
  onEquipe: () => void
}>) {
  const t = useMessages(CANAL_REEL_MESSAGES)
  const p = t.pro
  const locale = useV54Locale()
  const { push } = useToast()
  const [filtre, setFiltre] = useState<FiltrePro>('toutes')
  const [recherche, setRecherche] = useState('')
  const [brouillon, setBrouillon] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const fil = useRef<HTMLDivElement>(null)

  const liste = conversations ?? []
  const q = recherche.trim().toLowerCase()
  const visibles = liste.filter((c) =>
    correspond(c, filtre)
    && (!q || [c.prestataire.nom, c.ordre?.titre, c.ordre?.adresse].some((v) => (v || '').toLowerCase().includes(q))))
  const selected = liste.find((c) => c.id === selectedId) ?? visibles[0] ?? null
  const idSelection = selected?.id ?? null
  const nbMessages = selected?.messages.length ?? 0

  // Conversation affichée retenue comme sélection : un rafraîchissement (polling 15 s) où une autre
  // conversation devient la plus récente ne fait plus changer la conversation ouverte. Sans sélection
  // (ou conversation disparue), la plus récente est retenue.
  useEffect(() => {
    if (idSelection && idSelection !== selectedId) onSelect(idSelection)
  }, [idSelection, selectedId, onSelect])

  // Brouillon de réponse propre à la conversation ouverte : effacé quand on en change.
  useEffect(() => {
    setBrouillon('')
  }, [idSelection])

  // Fil positionné sur le dernier message (ouverture, nouveau message).
  useEffect(() => {
    const el = fil.current
    if (el) el.scrollTop = el.scrollHeight
  }, [selected?.id, nbMessages])

  const repondre = async () => {
    const texte = brouillon.trim()
    if (!texte || !selected) return
    setEnvoi(true)
    try {
      await envoyerMessageCanalPro(token, selected.id, texte)
      setBrouillon('')
      push({ kind: 'success', title: p.envoye, desc: p.envoyeDesc(selected.prestataire.nom) })
      onRafraichir()
    } catch {
      push({ kind: 'error', title: p.erreurEnvoi, desc: t.validation.toasts.reessayer })
    } finally {
      setEnvoi(false)
    }
  }

  const ordreCard = (m: MessageCanalPro, o: OrdreMissionCanal) => (
    <div key={m.id} className="canal-card out">
      <div className="canal-card-head">
        <Icon name="clipboard" />
        <span>{p.ordreDeMission} — {o.titre}</span>
      </div>
      <div className="canal-card-pills">
        <Pill kind={PILL_STATUT_ORDRE[o.statut]} noDot>{t.statutsOrdre[o.statut]}</Pill>
        {o.urgence === 'urgente' && <Pill kind="rust" noDot>{t.priorites.urgente}</Pill>}
      </div>
      {o.adresse && <div className="canal-card-row">{o.adresse}</div>}
      <div className="canal-card-row">
        {p.dateSouhaitee}{dateApi(o.dateSouhaitee, locale) || '—'}
        {o.heureArrivee && <> · {p.arrivee}{o.heureArrivee}</>}
      </div>
      {o.description && <div className="canal-card-desc">{o.description}</div>}
      <div className="canal-msg-meta">{t.vous} · {horodatage(m.creeLe, locale)}</div>
    </div>
  )

  const documentCard = (m: MessageCanalPro, doc: DocumentCanal, nom: string) => (
    <div key={m.id} className={clsx('canal-card', m.cote === 'donneur_ordre' && 'out')}>
      <div className="canal-card-head">
        <Icon name={ICONE_DOCUMENT[doc.type]} />
        <span>{p.documents[doc.type]}</span>
        {doc.reference && <span className="canal-card-ref">{doc.reference}</span>}
      </div>
      {doc.montant_ttc != null && <div className="canal-card-amount">{montantEUR(doc.montant_ttc, locale)} <span className="canal-card-ref">{p.ttc}</span></div>}
      {doc.description && <div className="canal-card-desc">{doc.description}</div>}
      <div className="canal-msg-meta">{nom} · {horodatage(m.creeLe, locale)}</div>
    </div>
  )

  const documents = (selected?.messages ?? []).filter((m) => m.document)
  const ordre = selected?.ordre ?? null
  const rang = ordre ? RANG_ORDRE[ordre.statut] : 0
  const d = p.details
  const etapes = !ordre
    ? []
    : ordre.statut === 'refuse'
      ? [{ nom: d.etapes.envoye, etat: 'done' }, { nom: d.etapes.refuse, etat: 'current' }]
      : [d.etapes.envoye, d.etapes.accepte, d.etapes.demarre, d.etapes.termine].map((nom, i) => ({
          nom,
          etat: i <= rang ? 'done' : i === rang + 1 ? 'current' : 'pending',
        }))

  return (
    <div className="canal-grid">
      <aside className="canal-missions-col" aria-label={p.listeAria}>
        <div className="canal-missions-head">
          <div className="canal-missions-label">{p.label}</div>
          <div className="canal-missions-subtabs">
            <button type="button" className="canal-chip active">
              <Icon name="wrench" /> {p.prestataires} <span className="canal-chip-count">{liste.length}</span>
            </button>
            <button type="button" className="canal-chip" onClick={onEquipe}>
              <Icon name="users" /> {p.equipe} <span className="canal-chip-count">{nbEquipe}</span>
            </button>
          </div>
          <div className="canal-search">
            <Icon name="search" />
            <input type="text" placeholder={p.recherche} value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label={p.rechercheAria} />
          </div>
          <div className="canal-filters" role="group" aria-label={p.filtresAria}>
            {FILTRES.map(([k, kind]) => (
              <button key={k} type="button" className={clsx('canal-filter', filtre === k && 'active', kind)} onClick={() => setFiltre(k)}>
                {kind && <span className="canal-filter-dot" />}
                {p.filtres[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="canal-missions-list">
          {conversations === null ? (
            <p className="canal-empty">{t.chargement}</p>
          ) : visibles.length === 0 ? (
            <p className="canal-empty">{liste.length === 0 ? p.aucune : p.aucuneFiltre}</p>
          ) : visibles.map((c) => (
            <button key={c.id} type="button" className={clsx('canal-mission-card', c.id === selected?.id && 'active')} onClick={() => onSelect(c.id)} aria-current={c.id === selected?.id ? 'true' : undefined}>
              <div className="canal-mission-title">{c.prestataire.nom}</div>
              <div className="canal-mission-sub"><span className="canal-mission-dot" />{c.ordre ? `${c.ordre.titre}${c.ordre.adresse ? ` · ${c.ordre.adresse}` : ''}` : c.apercu}</div>
              {c.ordre && (
                <div className="canal-mission-tags">
                  <Pill kind={PILL_STATUT_ORDRE[c.ordre.statut]} noDot>{t.statutsOrdre[c.ordre.statut]}</Pill>
                  {c.ordre.urgence === 'urgente' && <Pill kind="rust" noDot>{t.priorites.urgente}</Pill>}
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className="canal-chat-col" aria-label={t.messageAria}>
        {!selected ? (
          <div className="canal-chat-body"><p className="canal-empty">{conversations === null ? t.chargement : liste.length === 0 ? p.aucune : p.choisir}</p></div>
        ) : (
          <>
            <header className="canal-chat-head">
              <div className="canal-chat-head-info">
                <h3 className="canal-chat-title">{selected.prestataire.nom}{selected.prestataire.metier && <><span className="canal-chat-title-sep">·</span>{selected.prestataire.metier}</>}</h3>
                <p className="canal-chat-meta">
                  <span className="canal-mission-dot" />{ordre ? ordre.titre : p.details.aucunOrdre}
                  {ordre?.adresse && <><span className="canal-chat-meta-sep">·</span>{ordre.adresse}</>}
                </p>
              </div>
            </header>

            <div className="canal-chat-body canal-thread" ref={fil}>
              {selected.messages.map((m) => {
                if (m.ordreMission) return ordreCard(m, m.ordreMission)
                if (m.type === 'system') return <div key={m.id} className="canal-msg-system">{m.contenu}</div>
                const nom = m.cote === 'donneur_ordre' ? t.vous : selected.prestataire.nom
                if (m.document) return documentCard(m, m.document, nom)
                return (
                  <div key={m.id} className={clsx('canal-msg', m.cote === 'donneur_ordre' && 'out')}>
                    <div className="canal-msg-meta">{nom} · {horodatage(m.creeLe, locale)}</div>
                    {m.contenu}
                  </div>
                )
              })}
            </div>

            <footer className="canal-chat-footer">
              <form className="canal-chat-input-row" onSubmit={(e) => { e.preventDefault(); void repondre() }}>
                <input type="text" className="canal-chat-input" placeholder={p.repondreA(selected.prestataire.nom)} value={brouillon} onChange={(e) => setBrouillon(e.target.value)} aria-label={t.messageAria} />
                <button type="submit" className={clsx('canal-chat-send', btnCss.btn, btnCss.primary)} disabled={!brouillon.trim() || envoi} aria-label={t.envoyerAria}><Icon name="arrow" /></button>
              </form>
            </footer>
          </>
        )}
      </section>

      <aside className="canal-details-col" aria-label={d.aria}>
        {selected && (
          <>
            <section className="canal-details-section">
              <h4 className="canal-details-label">{d.mission}</h4>
              {ordre ? (
                <>
                  <h3 className="canal-details-title">{ordre.titre}{ordre.adresse ? ` — ${ordre.adresse}` : ''}</h3>
                  <div className="canal-details-pills">
                    <Pill kind={ordre.urgence === 'urgente' ? 'rust' : 'dark'} noDot>{ordre.urgence === 'urgente' ? t.priorites.urgente : t.priorites.normale}</Pill>
                    <Pill kind={PILL_STATUT_ORDRE[ordre.statut]} noDot>{t.statutsOrdre[ordre.statut]}</Pill>
                  </div>
                </>
              ) : (
                <p className="canal-empty">{d.aucunOrdre}</p>
              )}
            </section>

            {ordre && (
              <section className="canal-details-section">
                <h4 className="canal-details-label">{d.informations}</h4>
                <ul className="canal-info-list">
                  <li><Icon name="building" /><div><div className="canal-info-k">{d.adresse}</div><div className="canal-info-v">{ordre.adresse || '—'}</div></div></li>
                  <li><Icon name="wrench" /><div><div className="canal-info-k">{d.metier}</div><div className="canal-info-v">{selected.prestataire.metier || ordre.titre || '—'}</div></div></li>
                  <li><Icon name="calendar" /><div><div className="canal-info-k">{d.date}</div><div className="canal-info-v">{dateApi(ordre.dateSouhaitee, locale) || '—'}</div></div></li>
                  <li><Icon name="clock" /><div><div className="canal-info-k">{d.arrivee}</div><div className="canal-info-v">{ordre.heureArrivee || '—'}</div></div></li>
                  <li><Icon name="users" /><div><div className="canal-info-k">{d.prestataire}</div><div className="canal-info-v">{selected.prestataire.nom}</div></div></li>
                </ul>
              </section>
            )}

            {ordre && (
              <section className="canal-details-section">
                <h4 className="canal-details-label">{d.avancement}</h4>
                <ol className="canal-progress">
                  {etapes.map((e) => (
                    <li key={e.nom} className={`canal-progress-step state-${e.etat}`}>
                      <span className="canal-progress-marker" />
                      <div className="canal-progress-content"><div className="canal-progress-step-name">{e.nom}</div></div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="canal-details-section">
              <h4 className="canal-details-label">{d.documents}</h4>
              {documents.length === 0 ? (
                <p className="canal-empty">{d.aucunDocument}</p>
              ) : (
                <ul className="canal-info-list">
                  {documents.map((m) => m.document && (
                    <li key={m.id}>
                      <Icon name={ICONE_DOCUMENT[m.document.type]} />
                      <div>
                        <div className="canal-info-k">{p.documents[m.document.type]}{m.document.reference ? ` · ${m.document.reference}` : ''}</div>
                        <div className="canal-info-v">{m.document.montant_ttc != null ? `${montantEUR(m.document.montant_ttc, locale)} ${p.ttc}` : m.document.description || '—'}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="canal-details-section">
              <h4 className="canal-details-label">{d.participants}</h4>
              <ul className="canal-participants">
                <li className="canal-participant">
                  <span className="canal-participant-avatar">{initiales(t.vous)}</span>
                  <div className="canal-participant-info"><div className="canal-participant-name">{t.vous}</div><div className="canal-participant-role">{d.gestionnaire}</div></div>
                </li>
                <li className="canal-participant">
                  <span className="canal-participant-avatar">{initiales(selected.prestataire.nom)}</span>
                  <div className="canal-participant-info"><div className="canal-participant-name">{selected.prestataire.nom}</div><div className="canal-participant-role">{d.prestataireRole}</div></div>
                </li>
              </ul>
            </section>
          </>
        )}
      </aside>
    </div>
  )
}
