'use client'

import { useState } from 'react'
import {
  DEMO_COPROPRIETES,
  DEMO_TOTAL_BUDGET,
  DEMO_TOTAL_DEPENSES,
  type CoproprieteDemo,
} from '@/components/administrateur-judiciaire/data/coproprietes'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import type { ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Ligne du tableau des comptes : copropriété de démonstration et solde disponible (budget − charges). */
export type LigneReddition = CoproprieteDemo & {
  disponible: number
}

/** Fiche de reddition préparée au clic sur une ligne (jamais affichée, voir RedditionComptesModule). */
interface FicheReddition {
  title: string
  icon: string
  footnote: string
  fields: ChampDetail[]
}

/**
 * Reddition de comptes (démonstration) : export, dépôt du rapport au greffe (documents figés), indicateurs et
 * comptes par copropriété.
 * Bizarrerie conservée de la maquette : le clic sur une ligne (ou sur « Détails ») prépare une fiche de reddition,
 * mais aucune DetailModal n'est rendue, donc rien ne s'affiche.
 */
export function RedditionComptesModule() {
  const { push } = useToast()
  const [, setFiche] = useState<FicheReddition | null>(null)
  const lignes: LigneReddition[] = DEMO_COPROPRIETES.map((copro) => ({
    ...copro,
    disponible: copro.budget - copro.depense,
  }))

  return (
    <>
      <PageHead
        eyebrow="Mandat judiciaire"
        title="Reddition de comptes"
        lede="Présentation des comptes de la gestion judiciaire — au syndic élu et, le cas échéant, au tribunal (mandats art. 29-1)."
        actions={
          <>
            <button
              className="btn"
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
            <button
              className="btn gold"
              onClick={() =>
                push({
                  kind: 'doc',
                  icon: 'bank',
                  title: 'Dépôt du rapport au greffe',
                  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                  docTitle: "Rapport de l'administrateur provisoire",
                  meta: 'Tribunal judiciaire de Nanterre · RG 26/00892',
                  lines: [
                    "Le rapport périodique de l'administrateur provisoire a été déposé au greffe conformément à la mission ordonnée.",
                    {
                      h: 'Récapitulatif',
                    },
                    {
                      k: 'Période couverte',
                      v: '12/05 — 19/06/2026',
                    },
                    {
                      k: 'Mesures prises',
                      v: '6',
                    },
                    {
                      k: 'Prochaine échéance',
                      v: 'Reddition à 6 mois',
                    },
                  ],
                })
              }
            >
              <Icon name="upload" />
              Déposer le rapport
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'doc',
            num: 2,
            lbl: 'Redditions à produire',
            sub: '1 au tribunal · 1 au syndic élu',
            accent: 'amber',
          },
          {
            icon: 'coin',
            num: formatEuros(DEMO_TOTAL_DEPENSES),
            lbl: 'Charges justifiées',
            sub: 'Pièces rapprochées',
            accent: 'sage',
          },
          {
            icon: 'bank',
            num: formatEuros(DEMO_TOTAL_BUDGET - DEMO_TOTAL_DEPENSES),
            lbl: 'Solde de trésorerie',
            sub: 'Compte séparé · art. 18',
          },
          {
            icon: 'check',
            num: '94%',
            lbl: 'Pièces rapprochées',
            sub: '6 écritures à valider',
            accent: 'sage',
          },
        ]}
      />
      <Panel
        title="Comptes par copropriété"
        sub="Budget · charges engagées · solde — à arrêter pour la reddition"
        icon="chart"
        flush
      >
        <DataTable
          rowKey="id"
          columns={[
            {
              h: 'Copropriété',
              render: (ligne) => ligne.nom,
            },
            {
              h: 'Budget',
              render: (ligne) => formatEuros(ligne.budget),
            },
            {
              h: 'Charges',
              render: (ligne) => (
                <span
                  style={{
                    color: 'var(--rust-700)',
                  }}
                >
                  {formatEuros(ligne.depense)}
                </span>
              ),
            },
            {
              h: 'Solde',
              render: (ligne) => (
                <span
                  style={{
                    color: 'var(--sage-700)',
                    fontWeight: 600,
                  }}
                >
                  {formatEuros(ligne.disponible)}
                </span>
              ),
            },
            {
              h: 'Fonds travaux',
              render: (ligne) => formatEuros(ligne.fondsTravaux),
            },
          ]}
          rows={lignes}
          onRow={(ligne) =>
            setFiche({
              title: `Reddition — ${ligne.nom}`,
              icon: 'doc',
              footnote:
                "La reddition retrace l'intégralité des recettes et dépenses de la période de gestion, justificatifs à l'appui. Pour les mandats fondés sur l'art. 29-1, elle est également présentée au tribunal.",
              fields: [
                {
                  k: 'Budget prévisionnel',
                  v: formatEuros(ligne.budget),
                },
                {
                  k: 'Charges engagées',
                  v: formatEuros(ligne.depense),
                },
                {
                  k: 'Solde de trésorerie',
                  v: formatEuros(ligne.disponible),
                },
                {
                  k: 'Fonds de travaux',
                  v: formatEuros(ligne.fondsTravaux),
                },
                {
                  k: 'Impayés à recouvrer',
                  v: formatEuros(ligne.impayes),
                },
                {
                  k: 'Compte bancaire séparé',
                  v: 'Conforme (art. 18)',
                },
                {
                  k: 'Période',
                  v: `Depuis le ${ligne.ordonnance}`,
                  full: true,
                },
              ],
            })
          }
        />
      </Panel>
    </>
  )
}
