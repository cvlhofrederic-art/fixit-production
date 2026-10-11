'use client'

import { useRef, useState } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { messageErreurOrdre } from '@/components/administrateur-judiciaire/modules/gestion/vitfix/api'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  LIBELLE_DOCUMENT,
  LIBELLE_STATUT_ORDRE,
  TEINTE_STATUT_ORDRE,
  etapesOrdre,
  type MessageOrdrePrestataire,
  type OrdrePrestataire,
} from '@/lib/administrateur-judiciaire/ordres-prestataire'
import type { DocumentPrestataire } from '@/lib/syndic/messagerie-pro'

/** « AAAA-MM-JJ » → « JJ/MM/AAAA » (sans passer par un fuseau horaire). */
export const dateCourte = (iso: string): string => {
  const [annee, mois, jour] = iso.split('-')
  return annee && mois && jour ? `${jour.slice(0, 2)}/${mois}/${annee}` : iso
}

/** Horodatage d'un message : « 12/10 09:05 ». */
const horodatage = (iso: string): string => {
  const date = new Date(iso)
  return isNaN(date.getTime())
    ? ''
    : date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export interface SuiviPrestataireProps {
  ordre: OrdrePrestataire
  chargement: boolean
  misAJourLe: Date | null
  onRafraichir: () => void
  /** Rejette en cas d'échec (le brouillon est conservé). */
  onRepondre: (contenu: string) => Promise<void>
}

/**
 * Suivi d'un ordre de service transmis à un prestataire Vitfix : statut (en attente, accepté, en cours, terminé,
 * refusé), étapes, fil des échanges (réponses du prestataire, avancement, documents devis / rapport / facture) et
 * zone de réponse. Balisage repris du Canal de communication (bulles, zone de réponse, étapes).
 */
export function SuiviPrestataire({ ordre, chargement, misAJourLe, onRafraichir, onRepondre }: SuiviPrestataireProps) {
  const { push } = useToast()
  const [brouillon, setBrouillon] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const verrou = useRef(false)

  const ouvrirDocument = (document: DocumentPrestataire, message: MessageOrdrePrestataire) => {
    const libelle = LIBELLE_DOCUMENT[document.type]
    push({
      kind: 'doc',
      icon: 'doc',
      title: `${libelle}${document.reference ? ` ${document.reference}` : ''}`,
      eyebrow: `${ordre.prestataire.nom} · ${ordre.copropriete}`,
      docTitle: `${libelle}${document.reference ? ` n° ${document.reference}` : ''}`,
      meta: `Reçu via Vitfix le ${horodatage(message.creeLe)}`,
      lines: [
        { k: 'Ordre de service', v: ordre.referenceAj ? `${ordre.referenceAj} — ${ordre.titre}` : ordre.titre },
        { k: 'Copropriété', v: ordre.copropriete },
        { k: 'Prestataire', v: ordre.prestataire.nom },
        { k: 'Date du document', v: document.date ? dateCourte(document.date) : '—' },
        ...(document.montant_ttc !== undefined ? [{ k: 'Montant TTC', v: formatEurosCentimes(document.montant_ttc) }] : []),
        { h: 'Description' },
        document.description || message.contenu || '—',
      ],
    })
  }

  const envoyer = async () => {
    const contenu = brouillon.trim()
    if (!contenu || verrou.current) return
    verrou.current = true
    setEnvoiEnCours(true)
    try {
      await onRepondre(contenu)
      setBrouillon('')
    } catch (echec) {
      push({ kind: 'error', title: 'Message non envoyé', desc: messageErreurOrdre(echec) })
    } finally {
      verrou.current = false
      setEnvoiEnCours(false)
    }
  }

  const etapes = etapesOrdre(ordre.statut)

  return (
    <section
      aria-label={`Suivi prestataire — ${ordre.titre}`}
      style={{ marginTop: 14, border: '1px solid var(--gold-200)', borderRadius: 12, background: 'var(--paper)', overflow: 'hidden' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '10px 14px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--gold-50)',
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-700)' }}>
          Suivi prestataire
        </span>
        <Pill kind={TEINTE_STATUT_ORDRE[ordre.statut]}>{LIBELLE_STATUT_ORDRE[ordre.statut]}</Pill>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy-900)' }}>
          {ordre.prestataire.nom}
          {ordre.prestataire.metier ? ` · ${ordre.prestataire.metier}` : ''}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--navy-500)' }}>
          {ordre.dateIntervention ? `Intervention le ${dateCourte(ordre.dateIntervention)}` : ''}
          {ordre.heureArrivee ? ` · arrivée ${ordre.heureArrivee}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        {misAJourLe && (
          <span style={{ fontSize: 11, color: 'var(--navy-300)' }}>
            {'Mis à jour à '}
            {misAJourLe.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button type="button" className="btn sm ghost" onClick={onRafraichir} disabled={chargement} aria-busy={chargement}>
          <Icon name="refresh" />
          Rafraîchir
        </button>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '14px 14px 6px' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }} aria-live="polite">
          {ordre.messages.length === 0 ? (
            <p style={{ margin: '4px 0 12px', fontSize: 12.5, color: 'var(--navy-400)' }}>
              {ordre.statut === 'en_attente'
                ? `Ordre transmis à ${ordre.prestataire.nom} : en attente de sa réponse.`
                : 'Aucun échange pour le moment.'}
            </p>
          ) : (
            ordre.messages.map((message) => (
              <MessageSuivi key={message.id} message={message} nomPrestataire={ordre.prestataire.nom} onOuvrirDocument={ouvrirDocument} />
            ))
          )}
        </div>
        <ol className="canal-progress" style={{ flex: '0 1 190px', minWidth: 160 }} aria-label="Avancement de l’ordre">
          {etapes.map((etape) => (
            <li className={`canal-progress-step state-${etape.etat}`} key={etape.nom}>
              <span className="canal-progress-marker" />
              <div className="canal-progress-content">
                <div className="canal-progress-step-name">{etape.nom}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {ordre.conversationId ? (
        <div className="canal-chat-footer">
          <div className="canal-chat-input-row">
            <input
              aria-label={`Message à ${ordre.prestataire.nom}`}
              className="canal-chat-input"
              value={brouillon}
              onChange={(evenement) => setBrouillon(evenement.target.value)}
              onKeyDown={(evenement) => {
                if (evenement.key === 'Enter') void envoyer()
              }}
              placeholder={`Répondre à ${ordre.prestataire.nom}…`}
              maxLength={5000}
            />
            <button
              type="button"
              aria-label="Envoyer le message au prestataire"
              className="canal-chat-send btn primary"
              onClick={() => void envoyer()}
              disabled={envoiEnCours || !brouillon.trim()}
            >
              <Icon name="arrow" />
            </button>
          </div>
          <p className="canal-chat-hint" style={{ marginTop: 6 }}>
            Le message arrive dans la messagerie Vitfix du prestataire. Actualisation automatique toutes les 15 s.
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, padding: '0 14px 12px', fontSize: 12, color: 'var(--navy-400)' }}>
          Fil de l’ordre introuvable dans la messagerie : seul le statut de la mission est suivi.
        </p>
      )}
    </section>
  )
}

interface MessageSuiviProps {
  message: MessageOrdrePrestataire
  nomPrestataire: string
  onOuvrirDocument: (document: DocumentPrestataire, message: MessageOrdrePrestataire) => void
}

/** Ligne du fil : avancement (message système), document du prestataire ou bulle de texte. */
function MessageSuivi({ message, nomPrestataire, onOuvrirDocument }: MessageSuiviProps) {
  const moi = message.cote === 'donneur_ordre'
  if (message.type === 'system') {
    return (
      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--navy-500)', margin: '6px 0 12px' }}>
        {message.contenu}
        <span style={{ color: 'var(--navy-300)' }}>
          {' · '}
          {horodatage(message.creeLe)}
        </span>
      </div>
    )
  }
  const document = message.document
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: moi ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--navy-300)', marginBottom: 3 }}>
        {moi ? 'Vous' : nomPrestataire}
        {' · '}
        {horodatage(message.creeLe)}
      </div>
      {document ? (
        <div
          style={{
            maxWidth: '78%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--gold-200)',
            background: 'var(--gold-50)',
          }}
        >
          <Icon name="doc" aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-900)' }}>
              {LIBELLE_DOCUMENT[document.type]}
              {document.reference ? ` ${document.reference}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--navy-500)' }}>
              {document.montant_ttc !== undefined ? `${formatEurosCentimes(document.montant_ttc)} TTC` : ''}
              {document.montant_ttc !== undefined && document.date ? ' · ' : ''}
              {document.date ? dateCourte(document.date) : ''}
            </div>
            {document.description && <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 2 }}>{document.description}</div>}
          </div>
          <button type="button" className="btn sm ghost" onClick={() => onOuvrirDocument(document, message)}>
            Ouvrir
          </button>
        </div>
      ) : (
        <div
          style={{
            maxWidth: '78%',
            padding: '10px 14px',
            borderRadius: 14,
            fontSize: 13,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            background: moi ? 'var(--navy-700)' : 'var(--cream)',
            color: moi ? '#fff' : 'var(--ink)',
            border: moi ? 'none' : '1px solid var(--line)',
          }}
        >
          {message.contenu}
        </div>
      )}
    </div>
  )
}
