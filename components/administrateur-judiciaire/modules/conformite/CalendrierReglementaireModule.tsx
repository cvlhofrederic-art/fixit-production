'use client'

import { useState } from 'react'
import {
  DEMO_ECHEANCES_REGLEMENTAIRES,
  PILL_PAR_STATUT_ECHEANCE_REGLEMENTAIRE,
} from '@/components/administrateur-judiciaire/data/echeances-reglementaires'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { ListeEcheancesLegales } from '@/components/administrateur-judiciaire/ui/ListeEcheancesLegales'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useEcheancesPortefeuille } from '@/lib/administrateur-judiciaire/db/use-echeances'
import {
  statutEcheanceReglementaire,
  type StatutEcheanceReglementaire,
} from '@/lib/administrateur-judiciaire/domain/calendrier-reglementaire'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { MESSAGES_ETAT_ECHEANCES } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/** Ligne du tableau des échéances réglementaires, avec le statut recalculé au jour courant de l'application. */
export type LigneEcheanceReglementaire = [
  obligation: string,
  fondement: string,
  copropriete: string,
  date: string,
  statut: StatutEcheanceReglementaire,
]

/**
 * Calendrier réglementaire (statut « partiel ») : échéances réglementaires de démonstration, dont le statut est recalculé
 * selon la date du jour, et échéances légales des mandats calculées par le moteur de délais depuis la base locale.
 * L'export est simulé (même document « Export de données » que plusieurs autres écrans).
 */
export function CalendrierReglementaireModule() {
  const { push } = useToast()
  const [ligneOuverte, setLigneOuverte] = useState<LigneEcheanceReglementaire | null>(null)
  const lignes = DEMO_ECHEANCES_REGLEMENTAIRES.map(
    (echeance): LigneEcheanceReglementaire => [
      echeance[0],
      echeance[1],
      echeance[2],
      echeance[3],
      statutEcheanceReglementaire(echeance[3], echeance[4]),
    ],
  )
  const portefeuille = useEcheancesPortefeuille()
  const echeancesDatees = portefeuille.items.filter((item) => item.echeance.dateRetenue)

  return (
    <>
      <PageHead
        eyebrow="Conformité"
        title="Calendrier réglementaire"
        lede="Échéances légales et réglementaires des copropriétés sous mandat."
        actions={
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
        }
      />
      <Kpis
        items={[
          {
            icon: 'calendar',
            num: lignes.length + echeancesDatees.length,
            lbl: 'Échéances suivies',
            sub: `${lignes.length} réglementaires · ${echeancesDatees.length} de mandat`,
          },
          {
            icon: 'clock',
            num: lignes.filter((ligne) => ligne[4] === 'proche').length,
            lbl: 'À venir < 30 j',
            accent: 'amber',
          },
          {
            icon: 'siren',
            num: lignes.filter((ligne) => ligne[4] === 'en retard').length,
            lbl: 'En retard',
            accent: 'rust',
          },
          {
            icon: 'check',
            num: lignes.filter((ligne) => ligne[4] === 'conforme').length,
            lbl: 'Conformes',
            accent: 'sage',
          },
        ]}
      />
      <Panel title="Échéances réglementaires" icon="calendar" flush>
        <DataTable
          columns={[
            {
              h: 'Obligation',
              render: (ligne) => <b>{ligne[0]}</b>,
            },
            {
              h: 'Base légale',
              render: (ligne) => (
                <span
                  style={{
                    color: 'var(--navy-500)',
                    fontSize: 12,
                  }}
                >
                  {ligne[1]}
                </span>
              ),
            },
            {
              h: 'Copropriété',
              render: (ligne) => ligne[2],
            },
            {
              h: 'Échéance',
              render: (ligne) => <span className="mono">{ligne[3]}</span>,
            },
            {
              h: 'Statut',
              render: (ligne) => (
                <Pill kind={PILL_PAR_STATUT_ECHEANCE_REGLEMENTAIRE[ligne[4]]} noDot>
                  {ligne[4]}
                </Pill>
              ),
            },
          ]}
          rows={lignes}
          onRow={setLigneOuverte}
        />
      </Panel>
      <Panel
        title="Échéances légales des mandats"
        sub={`Moteur de délais légaux · tous les mandats · date de référence ${dateIsoVersFr(AUJOURDHUI_ISO)}`}
        icon="clock"
        flush
      >
        {portefeuille.loading ? (
          <div
            style={{
              padding: '22px',
              textAlign: 'center',
              color: 'var(--navy-300)',
              fontSize: 13,
            }}
          >
            {MESSAGES_ETAT_ECHEANCES.chargement}
          </div>
        ) : (
          <ListeEcheancesLegales
            items={echeancesDatees}
            reference={AUJOURDHUI_ISO}
            grouper
            vide={portefeuille.erreur ? MESSAGES_ETAT_ECHEANCES.indisponible : 'Aucune échéance datée.'}
          />
        )}
      </Panel>
      <DetailModal
        open={!!ligneOuverte}
        onClose={() => setLigneOuverte(null)}
        title={ligneOuverte ? ligneOuverte[0] : ''}
        icon="calendar"
        fields={
          ligneOuverte
            ? [
                {
                  k: 'Base légale',
                  v: ligneOuverte[1],
                },
                {
                  k: 'Copropriété',
                  v: ligneOuverte[2],
                },
                {
                  k: 'Échéance',
                  v: ligneOuverte[3],
                },
                {
                  k: 'Statut',
                  v: ligneOuverte[4],
                },
              ]
            : []
        }
      />
    </>
  )
}
