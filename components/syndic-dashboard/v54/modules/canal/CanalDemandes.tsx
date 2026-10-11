'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Pill } from '../../primitives/pill'
import { Button } from '../../primitives/button'
import { useToast } from '../../primitives/toast'
import Icon from '../../primitives/icon/Icon'
import btnCss from '../../primitives/button/Button.module.css'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { dateApi } from '@/lib/syndic/v54/i18n/dates'
import { envoyerMessageSignalement, type Signalement } from '@/lib/syndic/v54/api'
import { CANAL_REEL_MESSAGES } from '../i18n/ModCanalReel.messages'
import { PILL_STATUT_DEMANDE, horodatage } from './format'

type FiltreDemande = 'toutes' | 'urgentes' | 'enAttente' | 'confiees'
const FILTRES: [FiltreDemande, string | null][] = [['toutes', null], ['urgentes', 'rust'], ['enAttente', 'gold'], ['confiees', 'amber']]

const correspond = (s: Signalement, f: FiltreDemande) =>
  f === 'toutes'
  || (f === 'urgentes' && s.priorite === 'urgente')
  || (f === 'enAttente' && s.statut === 'en_attente')
  || (f === 'confiees' && s.statut !== 'en_attente' && s.statut !== 'annulee')

/** Rôles des messages écrits côté cabinet (affichés à droite). */
const ROLES_CABINET = new Set(['syndic', 'gestionnaire'])

/**
 * Onglet « Demandes » (données réelles) : signalements des copropriétaires du cabinet, du plus récent
 * au plus ancien, avec leur fil d'échanges et « Valider la mission » pour une demande en attente.
 */
export function CanalDemandes({
  signalements,
  selectedId,
  onSelect,
  onValider,
  token,
  onRafraichir,
}: Readonly<{
  signalements: Signalement[]
  selectedId: string | null
  onSelect: (id: string) => void
  onValider: (s: Signalement) => void
  token: string
  onRafraichir: () => void
}>) {
  const t = useMessages(CANAL_REEL_MESSAGES)
  const d = t.demandes
  const locale = useV54Locale()
  const { push } = useToast()
  const [filtre, setFiltre] = useState<FiltreDemande>('toutes')
  const [recherche, setRecherche] = useState('')
  const [brouillon, setBrouillon] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const triees = [...signalements].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const q = recherche.trim().toLowerCase()
  const visibles = triees.filter((s) =>
    correspond(s, filtre)
    && (!q || [s.immeuble, s.demandeurNom, s.typeIntervention, s.numLot].some((v) => (v || '').toLowerCase().includes(q))))
  const selected = triees.find((s) => s.id === selectedId) ?? visibles[0] ?? null
  const idSelection = selected?.id ?? null

  // Demande affichée retenue comme sélection : un rafraîchissement (polling 15 s) qui apporte une
  // demande plus récente ne fait plus changer la demande ouverte. Sans sélection (ou demande
  // disparue), la plus récente est retenue.
  useEffect(() => {
    if (idSelection && idSelection !== selectedId) onSelect(idSelection)
  }, [idSelection, selectedId, onSelect])

  // Brouillon de réponse propre à la demande ouverte : effacé quand on en change.
  useEffect(() => {
    setBrouillon('')
  }, [idSelection])

  // Fil d'échanges dans l'ordre chronologique.
  const fil = [...(selected?.messages ?? [])].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  const libellePriorite = (p: string) => (p === 'urgente' || p === 'planifiee' ? t.priorites[p] : t.priorites.normale)
  const localisation = (s: Signalement) => s.estPartieCommune
    ? [d.partiesCommunes, s.zoneSignalee].filter(Boolean).join(' — ')
    : [s.batiment && `${d.batiment} ${s.batiment}`, s.etage && `${d.etage} ${s.etage}`, s.numLot && `${d.lot} ${s.numLot}`].filter(Boolean).join(' · ')

  const repondre = async () => {
    const texte = brouillon.trim()
    if (!texte || !selected) return
    setEnvoi(true)
    try {
      await envoyerMessageSignalement(token, selected.id, texte)
      setBrouillon('')
      push({ kind: 'success', title: d.envoye, desc: d.envoyeDesc })
      onRafraichir()
    } catch {
      push({ kind: 'error', title: d.erreurEnvoi, desc: t.validation.toasts.reessayer })
    } finally {
      setEnvoi(false)
    }
  }

  const statut = selected?.statut || 'en_attente'
  const etapes = selected
    ? statut === 'annulee'
      ? [{ nom: d.details.etapes.recue, etat: 'done' }, { nom: d.details.etapes.annulee, etat: 'current' }]
      : [
          { nom: d.details.etapes.recue, etat: 'done' },
          { nom: d.details.etapes.confiee, etat: statut === 'en_attente' ? 'current' : 'done' },
          { nom: d.details.etapes.enCours, etat: statut === 'en_cours' ? 'current' : statut === 'terminee' ? 'done' : 'pending' },
          { nom: d.details.etapes.terminee, etat: statut === 'terminee' ? 'done' : 'pending' },
        ]
    : []

  return (
    <div className="canal-grid">
      <aside className="canal-missions-col" aria-label={d.listeAria}>
        <div className="canal-missions-head">
          <div className="canal-missions-label">{d.label}</div>
          <div className="canal-search">
            <Icon name="search" />
            <input type="text" placeholder={d.recherche} value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label={d.rechercheAria} />
          </div>
          <div className="canal-filters" role="group" aria-label={d.filtresAria}>
            {FILTRES.map(([k, kind]) => (
              <button key={k} type="button" className={clsx('canal-filter', filtre === k && 'active', kind)} onClick={() => setFiltre(k)}>
                {kind && <span className="canal-filter-dot" />}
                {d.filtres[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="canal-missions-list">
          {visibles.length === 0 ? (
            <p className="canal-empty">{triees.length === 0 ? d.aucune : d.aucuneFiltre}</p>
          ) : visibles.map((s) => (
            <button key={s.id} type="button" className={clsx('canal-mission-card', s.id === selected?.id && 'active')} onClick={() => onSelect(s.id)} aria-current={s.id === selected?.id ? 'true' : undefined}>
              <div className="canal-mission-title">{s.immeuble || s.typeIntervention}</div>
              <div className="canal-mission-sub"><span className="canal-mission-dot" />{s.demandeurNom}{s.typeIntervention ? ` · ${s.typeIntervention}` : ''}</div>
              <div className="canal-mission-tags">
                <Pill kind={PILL_STATUT_DEMANDE[s.statut]} noDot>{t.statutsDemande[s.statut as keyof typeof t.statutsDemande] ?? s.statut}</Pill>
                {s.priorite === 'urgente' && <Pill kind="rust" noDot>{t.priorites.urgente}</Pill>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="canal-chat-col" aria-label={t.messageAria}>
        {!selected ? (
          <div className="canal-chat-body"><p className="canal-empty">{triees.length === 0 ? d.aucune : d.choisir}</p></div>
        ) : (
          <>
            <header className="canal-chat-head">
              <div className="canal-chat-head-info">
                <h3 className="canal-chat-title">{selected.immeuble} <span className="canal-chat-title-sep">·</span> {selected.typeIntervention}</h3>
                <p className="canal-chat-meta">
                  <span className="canal-mission-dot" />{selected.demandeurNom}
                  <span className="canal-chat-meta-sep">·</span>
                  {d.demande}<span className="canal-chat-meta-id">#{selected.id.slice(0, 8)}</span>
                  {selected.createdAt && <><span className="canal-chat-meta-sep">·</span>{d.recueLe}{dateApi(selected.createdAt, locale)}</>}
                </p>
              </div>
              <div className="canal-chat-head-actions">
                {statut === 'en_attente' ? (
                  <Button variant="primary" size="sm" onClick={() => onValider(selected)}><Icon name="check" />{d.valider}</Button>
                ) : selected.artisanAssigne ? (
                  <Pill kind="sage" noDot>{d.confieeA(selected.artisanAssigne)}</Pill>
                ) : null}
              </div>
            </header>

            <div className="canal-chat-body canal-thread">
              <div className="canal-msg">
                <div className="canal-msg-meta">{selected.demandeurNom} · {horodatage(selected.createdAt, locale)}</div>
                {selected.description}
              </div>
              {fil.map((m) => m.role === 'system' ? (
                <div key={m.id} className="canal-msg-system">{m.texte}</div>
              ) : (
                <div key={m.id} className={clsx('canal-msg', ROLES_CABINET.has(m.role) && 'out')}>
                  <div className="canal-msg-meta">{m.auteur} · {horodatage(m.createdAt, locale)}</div>
                  {m.texte}
                </div>
              ))}
            </div>

            <footer className="canal-chat-footer">
              <form className="canal-chat-input-row" onSubmit={(e) => { e.preventDefault(); void repondre() }}>
                <input type="text" className="canal-chat-input" placeholder={d.repondreA(selected.demandeurNom)} value={brouillon} onChange={(e) => setBrouillon(e.target.value)} aria-label={t.messageAria} />
                <button type="submit" className={clsx('canal-chat-send', btnCss.btn, btnCss.primary)} disabled={!brouillon.trim() || envoi} aria-label={t.envoyerAria}><Icon name="arrow" /></button>
              </form>
            </footer>
          </>
        )}
      </section>

      <aside className="canal-details-col" aria-label={d.details.aria}>
        {selected && (
          <>
            <section className="canal-details-section">
              <h4 className="canal-details-label">{d.details.demande}</h4>
              <h3 className="canal-details-title">{selected.typeIntervention} — {selected.immeuble}</h3>
              <p className="canal-details-id">#{selected.id.slice(0, 8)}</p>
              <div className="canal-details-pills">
                <Pill kind={selected.priorite === 'urgente' ? 'rust' : 'dark'} noDot>{libellePriorite(selected.priorite)}</Pill>
                <Pill kind={PILL_STATUT_DEMANDE[statut]} noDot>{t.statutsDemande[statut as keyof typeof t.statutsDemande] ?? statut}</Pill>
              </div>
            </section>

            <section className="canal-details-section">
              <h4 className="canal-details-label">{d.details.informations}</h4>
              <ul className="canal-info-list">
                <li><Icon name="building" /><div><div className="canal-info-k">{d.details.immeuble}</div><div className="canal-info-v">{selected.immeuble || '—'}</div></div></li>
                <li><Icon name="pin" /><div><div className="canal-info-k">{d.details.localisation}</div><div className="canal-info-v">{localisation(selected) || '—'}</div></div></li>
                <li><Icon name="users" /><div><div className="canal-info-k">{d.details.demandeur}</div><div className="canal-info-v">{selected.demandeurNom}{selected.demandeurRole && t.roles[selected.demandeurRole] ? ` (${t.roles[selected.demandeurRole]})` : ''}</div></div></li>
                <li><Icon name="phone" /><div><div className="canal-info-k">{d.details.contact}</div><div className="canal-info-v">{[selected.demandeurEmail, selected.demandeurTelephone].filter(Boolean).join(' · ') || '—'}</div></div></li>
                <li><Icon name="calendar" /><div><div className="canal-info-k">{d.details.dateDemande}</div><div className="canal-info-v">{dateApi(selected.createdAt, locale) || '—'}</div></div></li>
                <li><Icon name="wrench" /><div><div className="canal-info-k">{d.details.prestataire}</div><div className="canal-info-v">{selected.artisanAssigne || '—'}</div></div></li>
              </ul>
            </section>

            <section className="canal-details-section">
              <h4 className="canal-details-label">{d.details.avancement}</h4>
              <ol className="canal-progress">
                {etapes.map((e) => (
                  <li key={e.nom} className={`canal-progress-step state-${e.etat}`}>
                    <span className="canal-progress-marker" />
                    <div className="canal-progress-content"><div className="canal-progress-step-name">{e.nom}</div></div>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </aside>
    </div>
  )
}
