'use client'

import { useState, type ReactNode } from 'react'
import { DEMO_COPROPRIETES, type CoproprieteDemo } from '@/components/administrateur-judiciaire/data/coproprietes'
import {
  DEMO_DETAILS_DOSSIERS_SUIVI,
  type DetailDossierSuivi,
  type DiligenceDossier,
  type DossierSuivi,
  type EtapeChecklistDossier,
} from '@/components/administrateur-judiciaire/data/suivi-dossiers'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { ProgressBar } from '@/components/administrateur-judiciaire/ui/ProgressBar'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import {
  preparerCourrierEtapeDossier,
  type CourrierEtapeDossier,
} from '@/lib/administrateur-judiciaire/domain/actes/courriers-suivi-dossier'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import type { StatutSuiviDossier } from '@/lib/administrateur-judiciaire/domain/suivi-dossiers'

/** Dossier affiché dans la modale : ligne du suivi des dossiers avec son statut calculé. */
export type DossierSuiviAvecStatut = DossierSuivi & { stat: StatutSuiviDossier }

/** Étape de la checklist, complétée du courrier pré-rempli correspondant (modifiable). */
export type EtapeDossierAvecCourrier = EtapeChecklistDossier & CourrierEtapeDossier

/** Champ modifiable du courrier d'une étape. */
export type ChampCourrierEtape = 'objet' | 'dest' | 'body'

/** Valeurs transmises à la validation de la modale. */
export interface ResultatDossierSuivi {
  statut: string
  done: number
  total: number
}

export interface DossierSuiviModalProps {
  dossier: DossierSuiviAvecStatut
  onClose: () => void
  onSave: (resultat: ResultatDossierSuivi) => void
}

/** Détail utilisé pour un code sans données de démonstration. */
const DETAIL_DOSSIER_VIDE: DetailDossierSuivi = {
  checklist: [],
  diligences: [],
  pieces: [],
  echObjet: '—',
}

/** Options du sélecteur de statut (le statut initial de la copropriété n'en fait pas forcément partie). */
const STATUTS_DOSSIER = ['En cours', 'En attente de pièces', 'À valider', 'Clôturé']

/** Style commun des intertitres de section de la modale. */
const styleIntertitre = (margeBasse: number) => ({
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '.06em',
  color: 'var(--navy-400)',
  marginBottom: margeBasse,
})

/** Ligne clé / valeur des données de la copropriété ; une couleur donne la valeur en var(--<couleur>-600). */
function LigneCleValeur({
  libelle,
  valeur,
  couleur,
}: {
  libelle: ReactNode
  valeur: ReactNode
  couleur?: string | null
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid var(--line)',
        fontSize: 12.5,
      }}
    >
      <span
        style={{
          color: 'var(--navy-400)',
        }}
      >
        {libelle}
      </span>
      <b
        style={
          couleur
            ? {
                color: 'var(--' + couleur + '-600)',
              }
            : undefined
        }
      >
        {valeur}
      </b>
    </div>
  )
}

/**
 * Dossier d'une copropriété suivie : données du mandat, prochaine échéance, checklist avec courriers pré-remplis
 * (envoi simulé), journal des diligences et pièces. Rien n'est enregistré durablement.
 */
export function DossierSuiviModal({ dossier, onClose, onSave }: DossierSuiviModalProps) {
  const { push } = useToast()
  const copro: Partial<CoproprieteDemo> = DEMO_COPROPRIETES.find((c) => c.code === dossier.code) || {}
  const detail = DEMO_DETAILS_DOSSIERS_SUIVI[dossier.code] || DETAIL_DOSSIER_VIDE
  const [etapes, setEtapes] = useState<EtapeDossierAvecCourrier[]>(() =>
    detail.checklist.map((etape) => ({
      ...etape,
      ...preparerCourrierEtapeDossier(etape.label, dossier, copro),
    })),
  )
  const [diligences, setDiligences] = useState<DiligenceDossier[]>(() => detail.diligences.slice())
  const [statut, setStatut] = useState(copro.statut || 'En cours')
  const [nouvelleDiligence, setNouvelleDiligence] = useState('')
  const etapesFaites = etapes.filter((etape) => etape.done).length
  const totalEtapes = etapes.length
  const basculerEtape = (index: number) =>
    setEtapes((liste) =>
      liste.map((etape, i) =>
        i === index
          ? {
              ...etape,
              done: !etape.done,
            }
          : etape,
      ),
    )
  const [etapeOuverte, setEtapeOuverte] = useState<number | null>(null)
  const modifierCourrier = (index: number, champ: ChampCourrierEtape, valeur: string) =>
    setEtapes((liste) =>
      liste.map((etape, i) =>
        i === index
          ? {
              ...etape,
              [champ]: valeur,
            }
          : etape,
      ),
    )
  const envoyerCourrier = (index: number) => {
    const etape = etapes[index]
    setEtapes((liste) =>
      liste.map((courante, i) =>
        i === index
          ? {
              ...courante,
              done: true,
            }
          : courante,
      ),
    )
    setEtapeOuverte(null)
    push({
      kind: 'success',
      title: 'Simulation — ' + (etape.sendLabel || 'Envoyé'),
      desc: "Rien n'a été envoyé à " + etape.dest + ' pour : ' + etape.objet,
    })
  }
  const enregistrerCourrier = (index: number) =>
    push({
      kind: 'info',
      title: 'Modifications enregistrées',
      desc: etapes[index].objet,
    })
  const ajouterDiligence = () => {
    const texte = nouvelleDiligence.trim()
    if (texte) {
      setDiligences((liste) => [
        {
          d: '19/06',
          q: 'Cabinet Delaunay',
          t: texte,
        },
        ...liste,
      ])
      setNouvelleDiligence('')
      push({
        kind: 'info',
        title: 'Diligence ajoutée',
        desc: 'Versée au journal du dossier.',
      })
    }
  }
  const ouvrirPiece = (piece: string) =>
    push({
      kind: 'doc',
      icon: 'doc',
      title: piece,
      eyebrow: 'Dossier ' + dossier.nom,
      docTitle: piece,
      meta: 'Cabinet Delaunay · RG ' + (copro.rg || '—'),
      lines: [
        'Pièce versée au dossier du mandat judiciaire.',
        {
          h: 'Référence',
        },
        {
          k: 'Copropriété',
          v: dossier.nom,
        },
        {
          k: 'Tribunal',
          v: copro.tribunal || '—',
        },
        {
          k: 'Ordonnance',
          v: copro.ordonnance || '—',
        },
      ],
    })

  return (
    <Modal open onClose={onClose} size="lg" labelledBy="doss-t">
      <ModalHeader id="doss-t" icon="folder" title={'Dossier — ' + dossier.nom} onClose={onClose} />
      <ModalBody>
        <div
          style={{
            background: 'var(--cream)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'JetBrains Mono,monospace',
                fontSize: 12,
                background: 'var(--navy-700)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {'RG '}
              {copro.rg || '—'}
            </span>
            <b
              style={{
                fontSize: 13.5,
              }}
            >
              {copro.fondement ? 'Syndic judiciaire — ' + copro.fondement : 'Mandat de syndic judiciaire'}
            </b>
            <span
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <label
                htmlFor="doss-statut"
                style={{
                  fontSize: 12,
                  color: 'var(--navy-400)',
                }}
              >
                Statut :
              </label>
              <select
                id="doss-statut"
                value={statut}
                onChange={(evenement) => setStatut(evenement.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  fontSize: 12.5,
                }}
              >
                {STATUTS_DOSSIER.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px 24px',
              fontSize: 12.5,
            }}
          >
            <div>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                {'Tribunal : '}
              </span>
              {copro.tribunal || '—'}
            </div>
            <div>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                {'Ordonnance : '}
              </span>
              {copro.ordonnance || '—'}
            </div>
            <div>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                {'Fin de mission : '}
              </span>
              {copro.echeance || '—'}
              {copro.dureeMois ? ' (' + copro.dureeMois + ' mois)' : ''}
            </div>
            <div>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                {'Responsable : '}
              </span>
              {dossier.gest}
            </div>
            <div>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                {'Adresse : '}
              </span>
              {copro.adresse || '—'}
            </div>
            <div>
              <span
                style={{
                  color: 'var(--navy-300)',
                }}
              >
                {'Notification : '}
              </span>
              {copro.notifOrdonnance || '—'}
            </div>
          </div>
          {copro.motif && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--line)',
                fontSize: 12,
                fontStyle: 'italic',
                color: 'var(--navy-500)',
              }}
            >
              {'Motif : '}
              {copro.motif}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={styleIntertitre(6)}>Données de la copropriété</div>
            <LigneCleValeur libelle="Lots" valeur={copro.lots || '—'} />
            <LigneCleValeur libelle="Budget prévisionnel" valeur={formatEuros(copro.budget || 0)} />
            <LigneCleValeur libelle="Dépenses engagées" valeur={formatEuros(copro.depense || 0)} />
            <LigneCleValeur
              libelle="Impayés"
              valeur={formatEuros(copro.impayes || 0)}
              couleur={(copro.impayes || 0) > 0 ? 'rust' : null}
            />
            <LigneCleValeur libelle="Fonds de travaux" valeur={formatEuros(copro.fondsTravaux || 0)} />
          </div>
          <div>
            <div style={styleIntertitre(6)}>Prochaine échéance</div>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontFamily: 'Cormorant Garamond,serif',
                  fontSize: 20,
                  marginBottom: 4,
                }}
              >
                {dossier.echeance}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--navy-500)',
                  marginBottom: 8,
                }}
              >
                {detail.echObjet}
              </div>
              <Pill kind={dossier.stat ? dossier.stat.pill : 'sage'} noDot>
                {dossier.stat ? dossier.stat.label : 'À jour'}
              </Pill>
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 12.5,
              }}
            >
              <span
                style={{
                  color: 'var(--navy-400)',
                }}
              >
                {'Avancement : '}
              </span>
              <b>
                {etapesFaites}/{totalEtapes}
                {' étapes'}
              </b>
            </div>
            <div
              style={{
                marginTop: 6,
              }}
            >
              <ProgressBar pct={Math.round((etapesFaites / totalEtapes) * 100)} kind="gold" />
            </div>
          </div>
        </div>
        <div
          style={{
            marginBottom: 16,
          }}
        >
          <div style={styleIntertitre(8)}>Checklist du dossier</div>
          <div
            style={{
              display: 'grid',
              gap: 6,
            }}
          >
            {etapes.map((etape, index) => (
              <div
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
                key={index}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    background: etape.done ? 'var(--sage-50)' : '#fff',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={etape.done}
                    onChange={() => basculerEtape(index)}
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: 'var(--sage-600)',
                      flexShrink: 0,
                    }}
                    aria-label={'Étape : ' + etape.label}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      textDecoration: etape.done ? 'line-through' : 'none',
                      color: etape.done ? 'var(--navy-400)' : 'var(--ink)',
                    }}
                  >
                    {etape.label}
                  </span>
                  <button
                    className="btn ghost sm"
                    onClick={() => setEtapeOuverte(etapeOuverte === index ? null : index)}
                  >
                    <Icon name="folder" width="14" height="14" />
                    {etapeOuverte === index ? 'Fermer' : 'Ouvrir'}
                  </button>
                  <button className="btn sm" onClick={() => envoyerCourrier(index)}>
                    <Icon name="mail" width="14" height="14" />
                    Envoyer
                  </button>
                </div>
                {etapeOuverte === index && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderTop: '1px solid var(--line)',
                      background: 'var(--cream)',
                    }}
                  >
                    <FieldRow>
                      <Field label="Objet">
                        <input
                          value={etape.objet}
                          onChange={(evenement) => modifierCourrier(index, 'objet', evenement.target.value)}
                        />
                      </Field>
                      <Field label="Destinataire">
                        <input
                          value={etape.dest}
                          onChange={(evenement) => modifierCourrier(index, 'dest', evenement.target.value)}
                        />
                      </Field>
                    </FieldRow>
                    <Field label="Contenu — modifiable" full>
                      <textarea
                        rows={8}
                        value={etape.body}
                        onChange={(evenement) => modifierCourrier(index, 'body', evenement.target.value)}
                        style={{
                          width: '100%',
                          resize: 'vertical',
                          fontSize: 13,
                          lineHeight: 1.55,
                          fontFamily: 'inherit',
                        }}
                      />
                    </Field>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 10,
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button className="btn ghost sm" onClick={() => setEtapeOuverte(null)}>
                        Fermer
                      </button>
                      <button className="btn sm" onClick={() => enregistrerCourrier(index)}>
                        <Icon name="check" width="14" height="14" />
                        Enregistrer
                      </button>
                      <button className="btn gold sm" onClick={() => envoyerCourrier(index)}>
                        <Icon name="mail" width="14" height="14" />
                        {etape.sendLabel || 'Envoyer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            marginBottom: 16,
          }}
        >
          <div style={styleIntertitre(8)}>Diligences</div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <input
              value={nouvelleDiligence}
              onChange={(evenement) => setNouvelleDiligence(evenement.target.value)}
              onKeyDown={(evenement) => {
                if (evenement.key === 'Enter') ajouterDiligence()
              }}
              placeholder="Ajouter une diligence (action, appel, courrier…)"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                fontSize: 13,
              }}
            />
            <button className="btn sm" onClick={ajouterDiligence}>
              <Icon name="plus" width="14" height="14" />
              Ajouter
            </button>
          </div>
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              borderLeft: '2px solid var(--line)',
            }}
          >
            {diligences.map((diligence, index) => (
              <li
                style={{
                  position: 'relative',
                  padding: '0 0 14px 16px',
                }}
                key={index}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: -5,
                    top: 4,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: index === 0 ? 'var(--gold-500)' : 'var(--navy-300)',
                  }}
                />
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--navy-300)',
                  }}
                >
                  {diligence.d}
                  {' · '}
                  {diligence.q}
                </div>
                <div
                  style={{
                    fontSize: 13,
                  }}
                >
                  {diligence.t}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div style={styleIntertitre(8)}>Pièces du dossier</div>
          <div
            style={{
              display: 'grid',
              gap: 6,
            }}
          >
            {detail.pieces.map((piece, index) => (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                }}
                key={index}
              >
                <Icon name="doc" width="16" height="16" />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                  }}
                >
                  {piece}
                </span>
                <button className="btn ghost sm" onClick={() => ouvrirPiece(piece)}>
                  Ouvrir
                </button>
              </div>
            ))}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: 'var(--navy-500)',
            alignSelf: 'center',
          }}
        >
          <b>
            {etapesFaites}/{totalEtapes}
          </b>
          {' étapes · '}
          {statut}
        </span>
        <button className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        <button
          className="btn gold"
          onClick={() =>
            onSave({
              statut,
              done: etapesFaites,
              total: totalEtapes,
            })
          }
        >
          <Icon name="check" />
          Valider et enregistrer
        </button>
      </ModalFooter>
    </Modal>
  )
}
