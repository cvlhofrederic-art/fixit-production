'use client'

import { useState } from 'react'
import {
  DEMO_DERNIERS_APPELS_COMPTABILITE,
  DEMO_ECRITURES_COMPTABILITE,
  DEMO_EXERCICES_COMPTABLES,
  DOCUMENTS_COMPTABLES_AG,
  type EcritureComptable,
} from '@/components/administrateur-judiciaire/data/comptabilite'
import {
  DEMO_COPROPRIETES,
  DEMO_TOTAL_BUDGET,
  DEMO_TOTAL_DEPENSES,
  DEMO_TOTAL_IMPAYES,
} from '@/components/administrateur-judiciaire/data/coproprietes'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { ProgressBar } from '@/components/administrateur-judiciaire/ui/ProgressBar'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Criticité d'une étape de clôture : « rust » = critique, « gold » = clé, « sage » = standard. */
export type TonEtapeCloture = 'rust' | 'gold' | 'sage'

/** Étape de la checklist de clôture : identifiant, libellé et criticité. */
export type EtapeClotureExercice = [id: string, libelle: string, ton: TonEtapeCloture]

/** Étapes de la clôture annuelle de l'exercice (définies dans le rendu par la maquette, hissées ici). */
export const ETAPES_CLOTURE_EXERCICE: EtapeClotureExercice[] = [
  ['rappro', 'Rapprochement bancaire du compte séparé', 'rust'],
  ['fact', 'Saisie et ventilation des dernières factures', 'gold'],
  ['impayes', "Arrêté de l'état des impayés", 'gold'],
  ['charges', 'Répartition des charges par lot (tantièmes)', 'sage'],
  ['annexes', 'Édition des annexes comptables (1 à 5)', 'sage'],
  ['cs', 'Présentation au conseil syndical', 'sage'],
  ['ag', "Inscription à l'ordre du jour de l'AG", 'sage'],
]

/**
 * Comptabilité du syndicat (données de démonstration). Onglets contrôlés : tableau de bord, clôture d'exercice
 * (checklist cochable, non persistée) et rapports AG (aperçu et génération simulés). Le solde des comptes séparés
 * (171 400 €) est saisi en dur.
 */
export function ComptabiliteModule() {
  const { push } = useToast()
  const [onglet, setOnglet] = useState('board')
  const [ecritureOuverte, setEcritureOuverte] = useState<EcritureComptable | null>(null)
  const [etapesCochees, setEtapesCochees] = useState<Record<string, boolean>>({})
  const nombreCochees = ETAPES_CLOTURE_EXERCICE.filter((etape) => etapesCochees[etape[0]]).length
  const pourcentage = Math.round((nombreCochees / ETAPES_CLOTURE_EXERCICE.length) * 100)
  const basculerEtape = (id: string) =>
    setEtapesCochees((precedentes) => ({
      ...precedentes,
      [id]: !precedentes[id],
    }))

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Comptabilité"
        lede="Comptabilité du syndicat sur compte bancaire séparé (loi ALUR) : écritures, clôture et annexes."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'coin',
                title: 'Nouvelle écriture comptable',
                fields: [
                  CHAMP_COPROPRIETE,
                  {
                    label: 'Compte',
                    placeholder: 'ex. 614 — Charges',
                    full: true,
                  },
                  {
                    label: 'Libellé',
                    placeholder: 'ex. Facture plomberie',
                    full: true,
                  },
                  {
                    label: 'Montant',
                    placeholder: 'ex. 620 €',
                    full: true,
                  },
                  {
                    label: 'Sens',
                    type: 'select',
                    options: ['Débit', 'Crédit'],
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Écriture enregistrée',
                },
              })
            }
          >
            <Icon name="plus" />
            Nouvelle écriture
          </button>
        }
      />
      <Tabs
        active={onglet}
        onChange={setOnglet}
        tabs={[
          {
            id: 'board',
            icon: 'chart',
            label: 'Tableau de bord',
          },
          {
            id: 'cloture',
            icon: 'check',
            label: "Clôture d'exercice",
          },
          {
            id: 'rapports',
            icon: 'doc',
            label: 'Rapports AG',
          },
        ]}
      />
      {onglet === 'board' && (
        <>
          <Kpis
            items={[
              {
                icon: 'bank',
                num: formatEuros(171400),
                lbl: 'Solde comptes séparés',
                accent: 'sage',
              },
              {
                icon: 'coin',
                num: formatEuros(DEMO_TOTAL_BUDGET),
                lbl: 'Budget annuel voté',
              },
              {
                icon: 'chart',
                num: formatEuros(DEMO_TOTAL_DEPENSES),
                lbl: 'Dépenses engagées',
                accent: 'amber',
              },
              {
                icon: 'alert',
                num: formatEuros(DEMO_TOTAL_IMPAYES),
                lbl: 'Impayés',
                accent: 'rust',
              },
              {
                icon: 'shield',
                num: formatEuros(DEMO_COPROPRIETES.reduce((total, copro) => total + copro.fondsTravaux, 0)),
                lbl: 'Fonds travaux',
                accent: 'sage',
              },
            ]}
          />
          <div className="card-grid cols-2">
            <Panel title="Derniers appels de fonds" icon="coin">
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                }}
              >
                {DEMO_DERNIERS_APPELS_COMPTABILITE.map((appel, index) => (
                  <li
                    style={{
                      padding: '10px 0',
                      borderBottom: index < DEMO_DERNIERS_APPELS_COMPTABILITE.length - 1 ? '1px solid var(--line)' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 13,
                    }}
                    key={index}
                  >
                    <span
                      style={{
                        minWidth: 0,
                      }}
                    >
                      {appel[0]}
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: 'var(--navy-300)',
                        }}
                      >
                        {appel[1]}
                      </span>
                    </span>
                    <span
                      className="mono"
                      style={{
                        flexShrink: 0,
                      }}
                    >
                      {appel[2]}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Dernières écritures" icon="fact">
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                }}
              >
                {DEMO_ECRITURES_COMPTABILITE.slice(0, 5).map((ecriture, index) => (
                  <li
                    style={{
                      padding: '10px 0',
                      borderBottom: index < 4 ? '1px solid var(--line)' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 13,
                    }}
                    key={index}
                  >
                    <span
                      style={{
                        minWidth: 0,
                      }}
                    >
                      {ecriture[2]}
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: 'var(--navy-300)',
                        }}
                      >
                        {ecriture[0]}
                        {' · '}
                        {ecriture[1]}
                      </span>
                    </span>
                    <span
                      className="mono"
                      style={{
                        flexShrink: 0,
                        color: ecriture[4].startsWith('-') ? 'var(--rust-600)' : 'var(--sage-600)',
                      }}
                    >
                      {ecriture[4]}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <Panel title="Journal des écritures" icon="fact" flush>
            <DataTable
              columns={[
                {
                  h: 'Date',
                  render: (ecriture) => <span className="mono">{ecriture[0]}</span>,
                },
                {
                  h: 'Compte',
                  render: (ecriture) => ecriture[1],
                },
                {
                  h: 'Description',
                  render: (ecriture) => <b>{ecriture[2]}</b>,
                },
                {
                  h: 'Type',
                  render: (ecriture) => (
                    <Pill kind={ecriture[3] === 'recette' ? 'sage' : 'amber'} noDot>
                      {ecriture[3]}
                    </Pill>
                  ),
                },
                {
                  h: 'Montant',
                  render: (ecriture) => (
                    <span
                      className="mono"
                      style={{
                        color: ecriture[4].startsWith('-') ? 'var(--rust-600)' : 'var(--sage-600)',
                      }}
                    >
                      {ecriture[4]}
                    </span>
                  ),
                },
              ]}
              rows={DEMO_ECRITURES_COMPTABILITE}
              onRow={setEcritureOuverte}
            />
          </Panel>
        </>
      )}
      {onglet === 'cloture' && (
        <>
          <Alert kind="info" icon="check" title="Clôture de l'exercice comptable">
            {
              "La clôture annuelle précède l'approbation des comptes en assemblée générale. Toutes les étapes doivent être finalisées avant la convocation."
            }
          </Alert>
          <Panel title={`Checklist de clôture — ${nombreCochees}/${ETAPES_CLOTURE_EXERCICE.length} étapes`} icon="check">
            <ProgressBar pct={pourcentage} kind={pourcentage === 100 ? 'sage' : 'gold'} />
            <div
              style={{
                marginTop: 14,
              }}
            >
              {ETAPES_CLOTURE_EXERCICE.map(([id, libelle, ton]) => (
                <div
                  onClick={() => basculerEtape(id)}
                  onKeyDown={surActivationClavier(() => basculerEtape(id))}
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 8px',
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                  key={id}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: '1.5px solid var(--line-strong)',
                      background: etapesCochees[id] ? 'var(--sage-500)' : 'transparent',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {etapesCochees[id] ? '✓' : ''}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      textDecoration: etapesCochees[id] ? 'line-through' : 'none',
                      color: etapesCochees[id] ? 'var(--navy-300)' : 'var(--ink)',
                    }}
                  >
                    {libelle}
                  </span>
                  <Pill kind={ton} noDot>
                    {ton === 'rust' ? 'critique' : ton === 'gold' ? 'clé' : 'standard'}
                  </Pill>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Exercices comptables" icon="folder" flush>
            <DataTable
              columns={[
                {
                  h: 'Année',
                  render: (exercice) => <span className="mono">{exercice[0]}</span>,
                },
                {
                  h: 'Copropriété',
                  render: (exercice) => <b>{exercice[1]}</b>,
                },
                {
                  h: 'Total prévu',
                  render: (exercice) => <span className="mono">{exercice[2]}</span>,
                },
                {
                  h: 'État',
                  render: (exercice) => (
                    <Pill kind={exercice[3] === 'clôturé' ? 'sage' : 'amber'} noDot>
                      {exercice[3]}
                    </Pill>
                  ),
                },
              ]}
              rows={DEMO_EXERCICES_COMPTABLES}
            />
          </Panel>
        </>
      )}
      {onglet === 'rapports' && (
        <>
          <Alert kind="sage" icon="doc" title="Documents comptables pour l'assemblée générale">
            {
              "Les annexes comptables (décret n° 2005-240) sont jointes à la convocation pour l'approbation des comptes."
            }
          </Alert>
          <div className="card-grid cols-2">
            {DOCUMENTS_COMPTABLES_AG.map(([titre, reference, icone], index) => (
              <div
                style={{
                  padding: 18,
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                key={index}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div className="h-ico">
                    <Icon name={icone} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {titre}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--navy-400)',
                      }}
                    >
                      {reference}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'flex-end',
                    marginTop: 4,
                  }}
                >
                  <button
                    className="btn ghost sm"
                    onClick={() =>
                      push({
                        kind: 'info',
                        title: titre,
                        desc: 'Aperçu du document',
                      })
                    }
                  >
                    Aperçu
                  </button>
                  <button
                    className="btn gold sm"
                    onClick={() =>
                      push({
                        kind: 'doc',
                        icon: 'doc',
                        title: 'Document généré',
                        eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                        docTitle: 'Document',
                        meta: 'Cabinet Delaunay · 19/06/2026',
                        lines: [
                          'Le document a été généré à partir du modèle du cabinet et des données du dossier.',
                          'Il est prêt à être notifié aux copropriétaires ou versé au dossier du mandat.',
                        ],
                      })
                    }
                  >
                    <Icon name="download" />
                    Générer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <DetailModal
        open={!!ecritureOuverte}
        onClose={() => setEcritureOuverte(null)}
        title={ecritureOuverte ? ecritureOuverte[2] : ''}
        icon="fact"
        fields={
          ecritureOuverte
            ? [
                {
                  k: 'Date',
                  v: ecritureOuverte[0],
                },
                {
                  k: 'Compte',
                  v: ecritureOuverte[1],
                },
                {
                  k: 'Type',
                  v: ecritureOuverte[3],
                },
                {
                  k: 'Montant',
                  v: ecritureOuverte[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
