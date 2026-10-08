'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useNomsCoproprietesSelonMode } from '@/lib/administrateur-judiciaire/db/hooks'
import { saisieAssistantMandatParDefaut } from '@/lib/administrateur-judiciaire/donnees-selon-mode'
import type { CertitudeRegle } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { BADGES_CERTITUDE_ECHEANCE } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import { FONDEMENTS_ASSISTANT_MANDAT } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  planifierMandat,
  type PlanMandat,
  type SaisieAssistantMandat,
} from '@/lib/administrateur-judiciaire/domain/planification-mandat'
import { MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'

/**
 * Pastille de certitude d'une règle (« À confirmer », « Source secondaire ») ; les autres certitudes n'en ont pas.
 * Doublon exact de BADGES_CERTITUDE_ECHEANCE dans la maquette : alias de la même table.
 */
export const PILL_PAR_CERTITUDE = BADGES_CERTITUDE_ECHEANCE

export interface LignePlanMandatProps {
  /** Numéro de la ligne (à partir de 1) ; un filet sépare les lignes suivantes. */
  n: number
  label: ReactNode
  sub: ReactNode
  /** Date ou moment, aligné à droite. */
  right: ReactNode
  pills?: ReactNode
  /** Infobulle (note de la règle) ; une chaîne vide n'en donne aucune. */
  title?: string
}

/** Ligne numérotée d'une section du plan de mandat. */
export function LignePlanMandat({ n, label, sub, right, pills, title }: LignePlanMandatProps) {
  return (
    <div
      title={title || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderTop: n > 1 ? '1px solid var(--line)' : 'none',
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: 'var(--cream)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--navy-700)',
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {label}
          {pills}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--navy-300)',
          }}
        >
          {sub}
        </div>
      </div>
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: 'var(--navy-700)',
          fontWeight: 600,
          textAlign: 'right',
          maxWidth: 220,
        }}
      >
        {right}
      </span>
    </div>
  )
}

/** Section titrée du plan de mandat (titre en capitales, lignes dans un cadre). */
export function SectionPlanMandat({ titre, children }: { titre: ReactNode; children?: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          color: 'var(--navy-500)',
          margin: '0 0 6px',
        }}
      >
        {titre}
      </div>
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Pastille de certitude placée après le libellé d'une échéance (rien pour une certitude sans pastille). */
export function PillCertitude({ certitude }: { certitude: CertitudeRegle }) {
  const pastille = PILL_PAR_CERTITUDE[certitude]
  return pastille ? (
    <span
      style={{
        marginLeft: 8,
      }}
    >
      <Pill kind={pastille.kind} noDot>
        {pastille.label}
      </Pill>
    </span>
  ) : null
}

/**
 * Valeurs initiales du formulaire (réappliquées à chaque ouverture) : dossier fictif en démonstration, rien
 * d'inventé en mode réel (voir saisieAssistantMandatParDefaut).
 */
const saisieParDefaut = (nomsCoproprietes: string[]): SaisieAssistantMandat =>
  saisieAssistantMandatParDefaut(MODE_ACTIF, nomsCoproprietes, FONDEMENTS_ASSISTANT_MANDAT[0])

type ChampSaisieAssistant = keyof SaisieAssistantMandat

/**
 * Plan du mandat ; une exception du calcul devient un plan en erreur (message de l'exception).
 * Correctif d'un défaut hérité de la maquette : « Générer le plan » appelait planifierMandat sans protection, et une
 * exception (ordonnance de fin 9999, durée démesurée) s'échappait du gestionnaire de clic : aucun plan, aucun message.
 * Elle suit désormais le chemin d'erreur existant (paragraphe role="alert", comme une date d'ordonnance invalide).
 * Sans exception, le plan est inchangé.
 */
function planifierMandatSansException(saisie: SaisieAssistantMandat): PlanMandat {
  try {
    return planifierMandat(saisie)
  } catch (erreur) {
    return {
      ech: '',
      calendar: [],
      pending: [],
      taches: [],
      docs: [],
      anomalies: [],
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    }
  }
}

export interface AssistantMandatModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Assistant de mandat — auto-planification : à partir de l'ordonnance saisie, le moteur de délais dérive le calendrier
 * légal, les échéances à déclencher, les tâches de gestion et les actes à pré-rédiger. Toute modification du formulaire
 * efface le plan ; la confirmation est simulée (toast).
 */
export function AssistantMandatModal({ open, onClose }: AssistantMandatModalProps) {
  const { push } = useToast(),
    nomsCoproprietes = useNomsCoproprietesSelonMode(),
    [saisie, setSaisie] = useState<SaisieAssistantMandat>(() => saisieParDefaut(nomsCoproprietes)),
    [plan, setPlan] = useState<PlanMandat | null>(null)

  useEffect(() => {
    // Réinitialisation à chaque ouverture (effet de la maquette, conservé tel quel).
    if (open) {
      setSaisie(saisieParDefaut(nomsCoproprietes))
      setPlan(null)
    }
    // Volontairement limité à l'ouverture : un rechargement de la liste ne doit pas effacer une saisie en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const modifier = (champ: ChampSaisieAssistant, valeur: string) => {
      setSaisie((precedente) => ({
        ...precedente,
        [champ]: valeur,
      }))
      setPlan(null)
    },
    generer = () => setPlan(planifierMandatSansException(saisie)),
    confirmer = () => {
      push({
        kind: 'success',
        title: 'Simulation',
        desc: "Aucune échéance, tâche ou acte n'a été réellement créé.",
      })
      onClose()
    },
    erreurPlan = plan && 'erreur' in plan ? plan.erreur : null,
    planGenere = plan && !('erreur' in plan) ? plan : null

  return (
    <Modal open={open} onClose={onClose} size="lg" labelledBy="mw-t">
      <ModalHeader id="mw-t" icon="scale" title="Assistant de mandat — auto-planification" onClose={onClose} />
      <ModalBody>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--navy-500)',
            margin: '0 0 16px',
          }}
        >
          {
            "Saisissez l'ordonnance : le calendrier légal est dérivé de sa date par le moteur de délais, chaque échéance citant son texte. Les délais marqués « À confirmer » attendent une validation juridique."
          }
        </p>
        <div className="field-row">
          <Field label="Copropriété" name="mw-copro" full>
            <select value={saisie.copro} onChange={(evenement) => modifier('copro', evenement.target.value)}>
              {saisie.copro === '' && <option value="">—</option>}
              {[...nomsCoproprietes, '+ Nouvelle copropriété'].map((nom) => (
                <option key={nom}>{nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Tribunal" name="mw-trib">
            <input
              type="text"
              value={saisie.tribunal}
              onChange={(evenement) => modifier('tribunal', evenement.target.value)}
            />
          </Field>
          <Field label="N° RG" name="mw-rg">
            <input type="text" value={saisie.rg} onChange={(evenement) => modifier('rg', evenement.target.value)} />
          </Field>
          <Field label="Date de l'ordonnance" name="mw-date">
            <input
              type="text"
              value={saisie.ordonnance}
              onChange={(evenement) => modifier('ordonnance', evenement.target.value)}
              placeholder="JJ/MM/AAAA"
            />
          </Field>
          <Field label="Durée (mois)" name="mw-duree">
            <input type="text" value={saisie.duree} onChange={(evenement) => modifier('duree', evenement.target.value)} />
          </Field>
          <Field label="Fondement" name="mw-fond" full>
            <select value={saisie.fondement} onChange={(evenement) => modifier('fondement', evenement.target.value)}>
              {FONDEMENTS_ASSISTANT_MANDAT.map((fondement) => (
                <option key={fondement}>{fondement}</option>
              ))}
            </select>
          </Field>
        </div>
        {!plan && (
          <button
            className="btn gold"
            style={{
              marginTop: 6,
            }}
            onClick={generer}
          >
            <Icon name="sparkle" />
            Générer le plan automatiquement
          </button>
        )}
        {erreurPlan && (
          <p
            role="alert"
            style={{
              fontSize: 12.5,
              color: 'var(--rust-500)',
              margin: '8px 0 0',
            }}
          >
            {erreurPlan}
          </p>
        )}
        {planGenere && (
          <div
            style={{
              marginTop: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                flexWrap: 'wrap',
              }}
            >
              <Pill kind="sage" noDot>
                Plan généré
              </Pill>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--navy-500)',
                }}
              >
                {planGenere.regimeLibelle}
                {planGenere.ech && (
                  <>
                    {' · fin de mission : '}
                    <b>{planGenere.ech}</b>
                  </>
                )}
              </span>
            </div>
            {planGenere.anomalies.map((anomalie, index) => (
              <p
                style={{
                  fontSize: 11.5,
                  margin: '4px 0',
                  color: anomalie.niveau === 'erreur' ? 'var(--rust-500)' : 'var(--navy-500)',
                }}
                key={index}
              >
                {anomalie.niveau === 'erreur' ? 'Erreur' : 'Alerte'}
                {' : '}
                {anomalie.message}
              </p>
            ))}
            <SectionPlanMandat titre={`Échéances légales (${planGenere.calendar.length})`}>
              {planGenere.calendar.map((echeance, index) => (
                <LignePlanMandat
                  n={index + 1}
                  title={echeance.note}
                  label={echeance.label}
                  pills={<PillCertitude certitude={echeance.certitude} />}
                  sub={
                    <>
                      {echeance.basis}
                      {' · '}
                      {echeance.role}
                      {echeance.report && (
                        <>
                          {' · '}
                          {echeance.report}
                        </>
                      )}
                      {echeance.aVerifier.length > 0 && (
                        <>
                          {' · à vérifier : '}
                          {echeance.aVerifier.join(' ; ')}
                        </>
                      )}
                    </>
                  }
                  right={echeance.date}
                  key={echeance.id}
                />
              ))}
            </SectionPlanMandat>
            {planGenere.pending.length > 0 && (
              <SectionPlanMandat
                titre={`À déclencher (${planGenere.pending.length}) · la date dépend d'un événement à venir`}
              >
                {planGenere.pending.map((echeance, index) => (
                  <LignePlanMandat
                    n={index + 1}
                    title={echeance.note}
                    label={echeance.label}
                    pills={<PillCertitude certitude={echeance.certitude} />}
                    sub={
                      <>
                        {echeance.basis}
                        {' · '}
                        {echeance.role}
                        {echeance.aVerifier.length > 0 && (
                          <>
                            {' · à vérifier : '}
                            {echeance.aVerifier.join(' ; ')}
                          </>
                        )}
                      </>
                    }
                    right={echeance.quand}
                    key={echeance.id}
                  />
                ))}
              </SectionPlanMandat>
            )}
            <SectionPlanMandat
              titre={`Tâches de gestion (${planGenere.taches.length}) · délais indicatifs de la maquette, sans texte vérifié`}
            >
              {planGenere.taches.map((tache, index) => (
                <LignePlanMandat
                  n={index + 1}
                  label={tache.label}
                  pills={
                    <span
                      style={{
                        marginLeft: 8,
                      }}
                    >
                      <Pill kind="navy" noDot>
                        Indicatif
                      </Pill>
                    </span>
                  }
                  sub={`${tache.basis} · ${tache.role}`}
                  right={tache.date}
                  key={tache.label}
                />
              ))}
            </SectionPlanMandat>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                flexWrap: 'wrap',
              }}
            >
              <Pill kind="navy" noDot>
                {planGenere.calendar.length + planGenere.pending.length + planGenere.taches.length}
                {' tâches'}
              </Pill>
              <Pill kind="gold" noDot>
                {planGenere.docs.length}
                {' actes pré-rédigés'}
              </Pill>
              <span
                style={{
                  fontSize: 11.5,
                  color: 'var(--navy-300)',
                  alignSelf: 'center',
                }}
              >
                {planGenere.docs.join(' · ')}
              </span>
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        {planGenere ? (
          <button className="btn gold" onClick={confirmer}>
            <Icon name="check" />
            Confirmer la mise en place
          </button>
        ) : (
          <button className="btn" onClick={generer}>
            <Icon name="sparkle" />
            Générer le plan
          </button>
        )}
      </ModalFooter>
    </Modal>
  )
}
