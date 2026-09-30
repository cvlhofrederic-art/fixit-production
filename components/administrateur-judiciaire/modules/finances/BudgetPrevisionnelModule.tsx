'use client'

import { useState } from 'react'
import { REPARTITION_POSTES_BUDGET } from '@/components/administrateur-judiciaire/data/budget-previsionnel'
import { DEMO_COPROPRIETES, DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Ligne du tableau des postes : poste, voté, réalisé et reste (montants formatés en euros). */
export type LignePosteBudget = [poste: string, vote: string, realise: string, reste: string]

/**
 * Budget prévisionnel d'une copropriété de démonstration (sélecteur « Copropriété ») : voté et réalisé par poste,
 * selon la répartition fixe REPARTITION_POSTES_BUDGET. « Exporter » ouvre le document d'export générique (simulé).
 */
export function BudgetPrevisionnelModule() {
  const { push } = useToast()
  const [nomCopro, setNomCopro] = useState(DEMO_NOMS_COPROPRIETES[0])
  const copro = DEMO_COPROPRIETES.find((candidate) => candidate.nom === nomCopro) || DEMO_COPROPRIETES[0]
  const lignes: LignePosteBudget[] = REPARTITION_POSTES_BUDGET.map(([poste, part]) => {
    const vote = Math.round(copro.budget * part),
      realise = Math.round(copro.depense * part)
    return [poste, formatEuros(vote), formatEuros(realise), formatEuros(vote - realise)]
  })
  const tauxRealisation = Math.round((copro.depense / copro.budget) * 100)

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Budget prévisionnel"
        lede="Suivi du budget voté par poste : engagé, réalisé et reste à engager."
        actions={
          <>
            <select
              className="btn"
              aria-label="Copropriété"
              value={nomCopro}
              onChange={(evenement) => setNomCopro(evenement.target.value)}
            >
              {DEMO_NOMS_COPROPRIETES.map((nom) => (
                <option key={nom}>{nom}</option>
              ))}
            </select>
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'download',
                  title: 'Export de données',
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: "Récapitulatif d'export",
                  meta: 'Généré le 19/06/2026 · format CSV / XLSX',
                  lines: [
                    "L'export contient l'ensemble des données du module sur la période sélectionnée.",
                    {
                      h: 'Contenu',
                    },
                    {
                      k: 'Lignes exportées',
                      v: '248',
                    },
                    {
                      k: 'Période',
                      v: '01/01/2026 — 19/06/2026',
                    },
                    {
                      k: 'Format',
                      v: 'CSV (UTF-8) et XLSX',
                    },
                    {
                      k: 'Colonnes',
                      v: '12',
                    },
                  ],
                })
              }
            >
              <Icon name="download" />
              Exporter
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'bank',
            num: formatEuros(copro.budget),
            lbl: 'Budget voté',
          },
          {
            icon: 'coin',
            num: formatEuros(copro.depense),
            lbl: 'Réalisé',
            accent: 'gold',
          },
          {
            icon: 'check',
            num: tauxRealisation + ' %',
            lbl: 'Taux de réalisation',
            accent: tauxRealisation > 90 ? 'amber' : 'sage',
          },
          {
            icon: 'chart',
            num: formatEuros(copro.budget - copro.depense),
            lbl: 'Reste à engager',
            accent: 'sage',
          },
        ]}
      />
      <Panel title={`Postes budgétaires — ${nomCopro}`} icon="chart" flush>
        <DataTable
          columns={[
            {
              h: 'Poste',
              render: (ligne) => <b>{ligne[0]}</b>,
            },
            {
              h: 'Voté',
              render: (ligne) => <span className="mono">{ligne[1]}</span>,
            },
            {
              h: 'Réalisé',
              render: (ligne) => <span className="mono">{ligne[2]}</span>,
            },
            {
              h: 'Reste',
              render: (ligne) => (
                <span
                  className="mono"
                  style={{
                    color: 'var(--sage-600)',
                  }}
                >
                  {ligne[3]}
                </span>
              ),
            },
          ]}
          rows={lignes}
        />
      </Panel>
    </>
  )
}
