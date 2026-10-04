'use client'

/* eslint-disable @next/next/no-img-element -- fidélité DOM : photo du signalement en <img> simple, comme dans la maquette */

import type { MissionCanal } from '@/components/administrateur-judiciaire/data/missions-canal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import type { OptionsDocument, ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import type { EtatMissionFuite } from '@/lib/administrateur-judiciaire/domain/ordre-mission'

/** Avancement du workflow de la mission « mfuite » et, après dispatch, l'intervention planifiée. */
export interface WorkflowMissionFuite {
  /** « signale » par défaut. */
  state?: EtatMissionFuite
  prestataire?: string
  technicien?: string
  date?: string
  heure?: string
}

export interface FilMissionFuiteColonneProps {
  mission: MissionCanal
  wf: WorkflowMissionFuite
  /** Ouvre la modale de dispatch vers un prestataire. */
  onValidate: () => void
  /** Transmet la facture à la comptabilité. */
  onCompta: () => void
  push: ToastApi['push']
}

/** Rapport d'intervention d'Atlantic Plomberie (document généré, ouvert dans le visualiseur). */
const RAPPORT_INTERVENTION_FUITE: OptionsDocument = {
  kind: 'doc',
  icon: 'fact',
  title: "Rapport d'intervention",
  eyebrow: 'Atlantic Plomberie SARL',
  docTitle: "Rapport d'intervention — Fuite colonne EU",
  meta: 'Bon OM-2026-0142 · 19/06/2026 · Résidence Le Méridien',
  lines: [
    "Intervention sur signalement du gardien : fuite d'eau sur colonne d'évacuation en partie commune (sous-sol, local technique).",
    {
      h: 'Constat',
    },
    {
      li: 'Raccord de la colonne EU fuyard à la jonction fonte / PVC.',
    },
    {
      li: "Traces d'humidité et corrosion sur le collier de fixation.",
    },
    {
      h: 'Travaux réalisés',
    },
    {
      li: 'Dépose et remplacement du raccord défectueux et du collier.',
    },
    {
      li: "Reprise de l'étanchéité (mastic + manchon de réparation).",
    },
    {
      li: 'Essai sous pression — aucune reprise de fuite constatée.',
    },
    {
      h: 'Résultat',
    },
    {
      k: 'État',
      v: 'Fuite stoppée',
    },
    {
      k: 'Durée',
      v: '1 h 40',
    },
    {
      k: 'Garantie',
      v: "Pièces et main-d'œuvre — 1 an",
    },
  ],
}

/** Facture d'Atlantic Plomberie : 510 € HT, 102 € de TVA, 612 € TTC (document généré). */
const FACTURE_FUITE: OptionsDocument = {
  kind: 'doc',
  icon: 'coin',
  title: 'Facture',
  eyebrow: 'Atlantic Plomberie SARL · SIRET 812 446 221 00018',
  docTitle: 'Facture n° FAC-2026-0142',
  meta: 'Émise le 19/06/2026 · Échéance 19/07/2026 · Résidence Le Méridien',
  lines: [
    "Réparation d'une fuite sur colonne d'évacuation en partie commune — sous-sol.",
    {
      h: 'Détail',
    },
    {
      k: "Main-d'œuvre (1 h 40)",
      v: '320,00 €',
    },
    {
      k: 'Raccord + collier + manchon',
      v: '90,00 €',
    },
    {
      k: 'Déplacement',
      v: '100,00 €',
    },
    {
      h: 'Totaux',
    },
    {
      k: 'Total HT',
      v: '510,00 €',
    },
    {
      k: 'TVA 20 %',
      v: '102,00 €',
    },
    {
      k: 'Total TTC',
      v: '612,00 €',
    },
    {
      h: 'Règlement',
    },
    {
      k: 'Mode',
      v: 'Virement — compte bancaire séparé du syndicat',
    },
    {
      k: 'Imputation',
      v: 'Charges communes générales',
    },
  ],
}

/**
 * Fil de la mission « Fuite colonne — Le Méridien » : ordre de mission du gardien (avec photo), puis validation
 * et dispatch par le cabinet, compte rendu du prestataire (rapport, facture) et transmission à la comptabilité.
 */
export function FilMissionFuiteColonne({ mission, wf, onValidate, onCompta, push }: FilMissionFuiteColonneProps) {
  const etat = wf.state || 'signale'
  const lignes: [libelle: string, valeur: string][] = [
    ['Copropriété', mission.building],
    ['Bâtiment', mission.batiment],
    ['Localisation', mission.etage],
    ['Nature du sinistre', mission.desc],
    ['Origine', mission.origine],
    ['Gardien', mission.gardien + ' · ' + mission.gardienTel],
    ["Code d'accès", mission.code],
    ['Date du signalement', mission.date],
  ]
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--navy-300)',
            marginBottom: 4,
          }}
        >
          {mission.gardien}
          {' (gardien) · '}
          {mission.date}
        </div>
        <div
          style={{
            maxWidth: '94%',
            width: '100%',
            border: '1px solid var(--gold-200)',
            borderRadius: 14,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <div
            style={{
              background: 'var(--gold-50)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid var(--gold-200)',
            }}
          >
            <Icon name="clipboard" width="16" height="16" />
            <b
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                color: 'var(--gold-700)',
              }}
            >
              Ordre de mission — Signalement
            </b>
            <span
              style={{
                marginLeft: 'auto',
              }}
            >
              <Pill kind="rust" noDot>
                Urgent
              </Pill>
            </span>
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5,
            }}
          >
            <tbody>
              {lignes.map((ligne, index) => (
                <tr
                  style={{
                    borderBottom: '1px solid var(--line)',
                  }}
                  key={index}
                >
                  <td
                    style={{
                      padding: '8px 16px',
                      color: 'var(--navy-400)',
                      width: '40%',
                      verticalAlign: 'top',
                    }}
                  >
                    {ligne[0]}
                  </td>
                  <td
                    style={{
                      padding: '8px 16px',
                      fontWeight: 500,
                    }}
                  >
                    {ligne[1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              padding: '12px 16px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--navy-300)',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="pin" width="13" height="13" />
              Photo jointe par le gardien
            </div>
            <img
              src={mission.realPhoto}
              alt="Fuite sur colonne en partie commune"
              style={{
                width: '100%',
                maxWidth: 300,
                borderRadius: 10,
                border: '1px solid var(--line)',
                display: 'block',
              }}
            />
          </div>
        </div>
      </div>
      {etat === 'signale' && (
        <div
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 560,
            textAlign: 'center',
            padding: '18px 16px',
            border: '1px dashed var(--gold-300)',
            borderRadius: 14,
            background: 'var(--gold-50)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              marginBottom: 12,
              color: 'var(--navy-600)',
            }}
          >
            Cet ordre de mission attend votre validation pour être dispatché à un prestataire.
          </div>
          <button className="btn gold" onClick={onValidate}>
            <Icon name="check" />
            Valider et choisir le prestataire
          </button>
        </div>
      )}
      {(etat === 'reported' || etat === 'compta') && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--navy-300)',
                marginBottom: 3,
              }}
            >
              {"Cabinet Delaunay · à l'instant"}
            </div>
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: 14,
                fontSize: 13,
                lineHeight: 1.45,
                background: 'var(--navy-700)',
                color: '#fff',
              }}
            >
              {'Ordre validé et transmis à '}
              <b>{wf.prestataire}</b>
              {'. Intervention planifiée le '}
              {wf.date}
              {' à '}
              {wf.heure}.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--navy-300)',
                marginBottom: 4,
              }}
            >
              {wf.prestataire}
              {' · '}
              {wf.date}
              {' '}
              {wf.heure}
            </div>
            <div
              style={{
                maxWidth: '94%',
                width: '100%',
                border: '1px solid var(--sage-300)',
                borderRadius: 14,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <div
                style={{
                  background: 'var(--sage-50)',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid var(--sage-200)',
                }}
              >
                <Icon name="check" width="16" height="16" />
                <b
                  style={{
                    fontSize: 12.5,
                    color: 'var(--sage-700)',
                  }}
                >
                  Ordre de mission validé par le prestataire
                </b>
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  fontSize: 12.5,
                  lineHeight: 1.55,
                }}
              >
                <p
                  style={{
                    margin: '0 0 10px',
                  }}
                >
                  {
                    "Intervention réalisée : remplacement du raccord fuyard sur la colonne d'évacuation (partie commune), reprise de l'étanchéité et essai sous pression. "
                  }
                  <b>Fuite stoppée.</b>
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <button className="btn ghost sm" onClick={() => push(RAPPORT_INTERVENTION_FUITE)}>
                    <Icon name="fact" />
                    {"Rapport d'intervention"}
                  </button>
                  <button className="btn ghost sm" onClick={() => push(FACTURE_FUITE)}>
                    <Icon name="coin" />
                    Facture — 612 € TTC
                  </button>
                </div>
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--line)',
                  background: 'var(--cream)',
                }}
              >
                {etat === 'reported' ? (
                  <button className="btn gold" onClick={onCompta}>
                    <Icon name="check" />
                    Valider et transmettre à la comptabilité
                  </button>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--sage-700)',
                      fontWeight: 600,
                    }}
                  >
                    <Icon name="check" />
                    Validé — facture transmise à la comptabilité
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
