'use client'

import { useState } from 'react'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { SelecteurCopropriete } from '@/components/administrateur-judiciaire/ui/SelecteurCopropriete'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproParCode } from '@/lib/administrateur-judiciaire/db/hooks'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { ETAPES_TAXATION } from '@/lib/administrateur-judiciaire/domain/honoraires'
import { codeCoproSelectionne } from '@/lib/administrateur-judiciaire/selection'

/** Diligence du relevé : date « JJ/MM/AAAA », nature, temps passé (h) et taux horaire HT (€/h). */
export interface DiligenceTaxation {
  date: string
  nature: string
  h: number
  taux: number
}

/** Étape de taxation en cours par code de copropriété (démonstration) ; 0 pour un code absent. */
export const ETAPE_TAXATION_PAR_CODE: Record<string, number> = {
  LM: 1,
  CV: 0,
  TL: 2,
  VM: 0,
}

/** Relevé des diligences de démonstration (identique pour toutes les copropriétés). */
export const DILIGENCES_TAXATION_DEMO: DiligenceTaxation[] = [
  {
    date: '12/03/2026',
    nature: 'Constitution et étude du dossier de désignation',
    h: 6,
    taux: 180,
  },
  {
    date: '18/03/2026',
    nature: 'Reprise comptable et ouverture du compte séparé',
    h: 9,
    taux: 150,
  },
  {
    date: '02/04/2026',
    nature: 'Gestion courante et coordination des prestataires',
    h: 14,
    taux: 150,
  },
  {
    date: '21/04/2026',
    nature: 'Préparation et tenue du conseil syndical',
    h: 4,
    taux: 180,
  },
  {
    date: '15/05/2026',
    nature: 'Recouvrement amiable et mises en demeure',
    h: 7,
    taux: 180,
  },
]

/**
 * Honoraires & taxation (CPC art. 704 à 718) : cycle de taxation de la copropriété choisie (« LM » à défaut),
 * relevé des diligences (HT = Σ heures × taux, TVA 20 % arrondie, TTC) et documents simulés.
 */
export function HonorairesTaxationModule() {
  const { push } = useToast(),
    [code, setCode] = useState(() => codeCoproSelectionne('LM')),
    copro = useCoproParCode(code),
    etapeCourante = ETAPE_TAXATION_PAR_CODE[code] || 0,
    diligences = DILIGENCES_TAXATION_DEMO,
    totalHt = diligences.reduce((total, diligence) => total + diligence.h * diligence.taux, 0),
    tva = Math.round(totalHt * 0.2),
    totalTtc = totalHt + tva
  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Honoraires & taxation"
        lede="En auxiliaire de justice, la rémunération ne suit pas le contrat-type syndic mais les articles 704 à 718 du CPC : état de frais soumis à la taxation du président du tribunal."
        actions={
          <>
            <SelecteurCopropriete value={code} onChange={setCode} />
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'coin',
                  title: 'État de frais',
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: 'État de frais et débours',
                  meta: 'Cabinet Delaunay',
                  lines: [
                    {
                      h: 'Détail',
                    },
                    {
                      k: 'Frais postaux',
                      v: '186 €',
                    },
                    {
                      k: 'Copies',
                      v: '42 €',
                    },
                    {
                      k: 'Déplacements',
                      v: '120 €',
                    },
                    {
                      k: 'Total',
                      v: '348 €',
                    },
                  ],
                })
              }
            >
              <Icon name="coin" />
              {"Établir l'état de frais"}
            </button>
          </>
        }
      />
      <Panel title="Cycle de taxation" sub={`${copro.nom} · ${copro.tribunal}`} icon="scale">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {ETAPES_TAXATION.map((etape, index) => (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flex: '1 1 auto',
                minWidth: 130,
              }}
              key={index}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background:
                    index < etapeCourante
                      ? 'var(--sage-500)'
                      : index === etapeCourante
                        ? 'var(--gold-500)'
                        : 'var(--cream)',
                  color: index <= etapeCourante ? '#fff' : 'var(--navy-300)',
                }}
              >
                {index < etapeCourante ? '✓' : index + 1}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: index === etapeCourante ? 700 : 500,
                  color: index <= etapeCourante ? 'var(--navy-700)' : 'var(--navy-300)',
                }}
              >
                {etape}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Kpis
        items={[
          {
            icon: 'coin',
            num: formatEuros(totalHt),
            lbl: 'Honoraires (HT)',
            sub: `${diligences.reduce((total, diligence) => total + diligence.h, 0)} h de diligences`,
          },
          {
            icon: 'fact',
            num: formatEuros(totalTtc),
            lbl: 'Total à taxer (TTC)',
            sub: 'TVA 20% incluse',
            accent: 'gold',
          },
          {
            icon: 'scale',
            num: ETAPES_TAXATION[etapeCourante],
            lbl: 'Étape en cours',
            sub: 'CPC 704-718',
            accent: 'amber',
          },
          {
            icon: 'clock',
            num: '1 mois',
            lbl: 'Recours en taxe',
            sub: 'à compter de la notification',
            accent: 'gold',
          },
        ]}
      />
      <Panel
        title="Relevé des diligences"
        sub="Base de l'état de frais soumis au juge taxateur"
        icon="clipboard"
        right={
          <button
            className="btn"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'clipboard',
                title: 'Nouvelle diligence',
                fields: [
                  CHAMP_COPROPRIETE,
                  {
                    label: 'Nature',
                    placeholder: 'ex. Mise en demeure',
                    full: true,
                  },
                  {
                    label: 'Échéance',
                    placeholder: 'JJ/MM/AAAA',
                    full: true,
                  },
                  {
                    label: 'Temps estimé',
                    placeholder: 'ex. 2 h',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Diligence enregistrée',
                },
              })
            }
          >
            <Icon name="plus" />
            Ajouter une diligence
          </button>
        }
        flush
      >
        <DataTable<DiligenceTaxation>
          rowKey="nature"
          columns={[
            {
              h: 'Date',
              render: (diligence) => (
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                  }}
                >
                  {diligence.date}
                </span>
              ),
            },
            {
              h: 'Nature de la diligence',
              render: (diligence) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {diligence.nature}
                </b>
              ),
            },
            {
              h: 'Temps',
              style: {
                textAlign: 'right',
              },
              tdStyle: {
                textAlign: 'right',
              },
              render: (diligence) => `${diligence.h} h`,
            },
            {
              h: 'Taux',
              style: {
                textAlign: 'right',
              },
              tdStyle: {
                textAlign: 'right',
              },
              render: (diligence) => `${diligence.taux} €/h`,
            },
            {
              h: 'Montant HT',
              style: {
                textAlign: 'right',
              },
              tdStyle: {
                textAlign: 'right',
              },
              render: (diligence) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {formatEuros(diligence.h * diligence.taux)}
                </b>
              ),
            },
          ]}
          rows={diligences}
        />
      </Panel>
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <button
          className="btn"
          onClick={() =>
            push({
              kind: 'doc',
              icon: 'coin',
              title: 'Requête en taxation des honoraires',
              eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
              docTitle: 'Requête en taxation',
              meta: 'Président du tribunal judiciaire',
              lines: [
                {
                  h: 'Décompte',
                },
                {
                  k: 'Heures',
                  v: '42 h',
                },
                {
                  k: 'Taux horaire',
                  v: '180 € HT',
                },
                {
                  k: 'Honoraires',
                  v: '7 560 € HT',
                },
              ],
            })
          }
        >
          <Icon name="scale" />
          Déposer la requête en taxation
        </button>
        <button
          className="btn"
          onClick={() =>
            push({
              kind: 'info',
              title: 'Recouvrement engagé',
              desc: "Sur le fondement de l'ordonnance de taxation",
            })
          }
        >
          <Icon name="coin" />
          Recouvrer après taxation
        </button>
      </div>
    </>
  )
}
