'use client'

import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { changerStatutSignalementQr, chargerTableauQr, type CodeErreurQr } from '@/lib/aj-signalement/api'
import {
  ACTIONS_STATUT_QR, LIBELLE_PRIORITE_QR, LIBELLE_STATUT_QR, compteursTableauQr, dateHeureParis, lieuSignalementQr,
  messageErreurTableauQr, nomDeclarantQr, situationLotQr,
} from '@/lib/aj-signalement/affichage'
import { CHEMIN_TABLEAU_QR, numeroSignalementQr, type SignalementQr, type StatutSignalementQr, type TableauQr } from '@/lib/aj-signalement/types'

/** Teinte de la pastille de statut dans l'AJ. */
const TEINTE_STATUT: Record<StatutSignalementQr, 'rust' | 'amber' | 'sage' | 'navy'> = {
  en_attente: 'rust',
  acceptee: 'amber',
  en_cours: 'amber',
  terminee: 'sage',
  annulee: 'navy',
}

const LIBELLE_CHAMP = {
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--navy-300)',
  fontWeight: 600,
  marginBottom: 3,
}

/** « JJ/MM » d'un horodatage ISO (heure locale), comme les doléances. */
function jourMois(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Etat = { statut: 'chargement' } | { statut: 'pret'; tableau: TableauQr } | { statut: 'erreur'; code: CodeErreurQr }

const TITRE_ERREUR: Record<CodeErreurQr, string> = {
  base_absente: 'Base non initialisée',
  non_authentifie: 'Réservé au super admin',
  interdit: 'Réservé au super admin',
  serveur: 'Chargement impossible',
  reseau: 'Connexion impossible',
  trop_de_demandes: 'Trop de demandes',
  invalide: 'Demande refusée',
  introuvable: 'Introuvable',
}

/**
 * Signalements QR (surtitre « Copropriétaires (Extranet) », données réelles) : ce que les occupants ont déposé après
 * avoir scanné le QR code de leur copropriété (application publique « AJ Signalement »), lu sur le serveur avec la
 * session du compte (cookies). Les copropriétés QR sont indépendantes des copropriétés de l'AJ : l'écran ne suit pas le
 * sélecteur du haut de page. La fiche d'un signalement montre les coordonnées du déclarant et change son statut, ce que
 * le tableau de bord du portail copropriétaire (vue super admin) reflète aussitôt ; les QR codes se gèrent là-bas.
 */
export function SignalementsQrModule() {
  const { push } = useToast()
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    const resultat = await chargerTableauQr(null)
    setEtat(resultat.ok ? { statut: 'pret', tableau: resultat.tableau } : { statut: 'erreur', code: resultat.code })
  }, [])

  // Chargement initial depuis le serveur : l'état n'est posé qu'à la réponse (asynchrone), pas dans le corps de l'effet.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])

  const signalements = etat.statut === 'pret' ? etat.tableau.signalements : []
  const compteurs = compteursTableauQr(signalements)
  const signalement = ouvert ? signalements.find((s) => s.id === ouvert) ?? null : null

  const changerStatut = async (s: SignalementQr, statut: StatutSignalementQr, libelle: string) => {
    if (occupe) return
    setOccupe(true)
    const resultat = await changerStatutSignalementQr(s.id, statut, null)
    setOccupe(false)
    if (!resultat.ok) {
      push({ kind: 'error', title: 'Statut non modifié', desc: messageErreurTableauQr(resultat.code) })
      return
    }
    setEtat((e) => (e.statut === 'pret'
      ? { ...e, tableau: { ...e.tableau, signalements: e.tableau.signalements.map((x) => (x.id === s.id ? { ...x, statut: resultat.statut } : x)) } }
      : e))
    push({ kind: 'success', title: libelle, desc: `${nomDeclarantQr(s)} — ${s.typeIntervention}.` })
  }

  return (
    <>
      <PageHead
        eyebrow="Copropriétaires (Extranet)"
        title="Signalements QR"
        lede="Signalements déposés par les occupants après scan du QR code de leur copropriété (application AJ Signalement) : coordonnées, lieu, description, urgence. Les QR codes et les affiches se gèrent dans le portail copropriétaire."
        actions={
          <a className="btn gold" href={CHEMIN_TABLEAU_QR} target="_blank" rel="noopener">
            <Icon name="qr" />
            Gérer les QR codes
          </a>
        }
      />
      <Kpis
        items={[
          { icon: 'clipboard', num: compteurs.total, lbl: 'Signalements reçus' },
          { icon: 'bell', num: compteurs.aTraiter, lbl: 'À traiter', accent: 'rust' },
          { icon: 'wrench', num: compteurs.enCours, lbl: 'En cours', accent: 'amber' },
          { icon: 'check', num: compteurs.resolus, lbl: 'Résolus', accent: 'sage' },
        ]}
      />
      <Panel flush>
        {etat.statut === 'chargement' && <EmptyState icon="clock" title="Chargement des signalements…" />}
        {etat.statut === 'erreur' && (
          <EmptyState
            icon="alert"
            title={TITRE_ERREUR[etat.code]}
            desc={messageErreurTableauQr(etat.code)}
            action={
              <button type="button" className="btn" onClick={() => { setEtat({ statut: 'chargement' }); void charger() }}>
                Réessayer
              </button>
            }
          />
        )}
        {etat.statut === 'pret' && signalements.length === 0 && (
          <EmptyState icon="qr" title="Aucun signalement reçu" desc="Les signalements déposés par QR code apparaîtront ici." />
        )}
        {signalements.map((s) => (
          <div
            className="list-row"
            onClick={() => setOuvert(s.id)}
            onKeyDown={surActivationClavier(() => setOuvert(s.id))}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            key={s.id}
          >
            <div className="thumb">
              <Icon name={s.statut === 'terminee' ? 'check' : s.priorite === 'urgente' ? 'siren' : 'wrench'} />
            </div>
            <div className="info">
              <b>{s.typeIntervention} — {lieuSignalementQr(s)}</b>
              <div className="meta">
                <Pill kind="gold" noDot>QR · {s.coproprieteNom}</Pill>
                {s.priorite === 'urgente' && <Pill kind="rust" noDot>Urgent</Pill>}
                <Pill kind={TEINTE_STATUT[s.statut]} noDot>{LIBELLE_STATUT_QR[s.statut]}</Pill>
                <span style={{ fontSize: 11.5, color: 'var(--navy-500)' }}>
                  {nomDeclarantQr(s)} · {situationLotQr(s)}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--navy-300)' }}>{jourMois(s.creeLe)}</div>
          </div>
        ))}
      </Panel>

      <Modal open={signalement !== null} onClose={() => setOuvert(null)} size="lg" labelledBy="signalement-qr-titre">
        {signalement && (
          <>
            <ModalHeader id="signalement-qr-titre" icon="qr" title={`${signalement.typeIntervention} — ${signalement.coproprieteNom}`} onClose={() => setOuvert(null)} />
            <ModalBody>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Pill kind="gold" noDot>AJ Signalement · QR code</Pill>
                <Pill kind={TEINTE_STATUT[signalement.statut]} noDot>{LIBELLE_STATUT_QR[signalement.statut]}</Pill>
                {signalement.priorite === 'urgente' && <Pill kind="rust" noDot>Urgent</Pill>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                {[
                  ['Déclarant', nomDeclarantQr(signalement)],
                  ['Téléphone', signalement.telephone],
                  ['E-mail', signalement.email],
                  ['Lot', situationLotQr(signalement)],
                  ['Copropriété', signalement.coproprieteNom],
                  ['Lieu', lieuSignalementQr(signalement)],
                  ['Urgence', LIBELLE_PRIORITE_QR[signalement.priorite]],
                  ['Déposé le', dateHeureParis(signalement.creeLe)],
                  ['Numéro', numeroSignalementQr(signalement.id)],
                  ['E-mail à l’administrateur', signalement.emailEnvoyeLe ? `reçu le ${dateHeureParis(signalement.emailEnvoyeLe)}` : `non envoyé (${signalement.emailErreur || 'erreur inconnue'})`],
                ].map(([libelle, valeur]) => (
                  <div key={libelle}>
                    <div style={LIBELLE_CHAMP}>{libelle}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--navy-700)', overflowWrap: 'anywhere' }}>{valeur}</div>
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={LIBELLE_CHAMP}>Description</div>
                  <div style={{ fontSize: 13.5, color: 'var(--navy-700)', whiteSpace: 'pre-wrap' }}>{signalement.description}</div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              {ACTIONS_STATUT_QR[signalement.statut].map((action) => (
                <button key={action.statut} type="button" className="btn" disabled={occupe} onClick={() => { void changerStatut(signalement, action.statut, action.libelle) }}>
                  {action.libelle}
                </button>
              ))}
              <button type="button" className="btn" onClick={() => setOuvert(null)}>
                Fermer
              </button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  )
}
