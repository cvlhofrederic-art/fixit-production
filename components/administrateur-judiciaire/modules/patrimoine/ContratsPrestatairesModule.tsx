'use client'

import { useState, type ReactNode } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { FormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Contrat de prestation de la copropriété (démonstration). pill : couleur de l'étiquette de statut. */
export interface ContratPrestataireDemo {
  id: string
  objet: string
  prestataire: string
  copro: string
  /** Montant annuel en euros. */
  montant: number
  /** « JJ/MM/AAAA ». */
  echeance: string
  statut: string
  pill: 'sage' | 'amber' | 'rust'
}

/**
 * Contrats K1 à K5. La maquette déclarait cette liste dans le rendu ; elle est hissée ici à l'identique
 * (le manifeste prévoyait data/contrats.ts, fichier hors de cette unité).
 */
export const DEMO_CONTRATS_PRESTATAIRES: ContratPrestataireDemo[] = [
  {
    id: 'K1',
    objet: 'Maintenance ascenseur',
    prestataire: 'OTIS Maintenance',
    copro: 'Le Clos des Vignes',
    montant: 3480,
    echeance: '31/12/2026',
    statut: 'Actif',
    pill: 'sage',
  },
  {
    id: 'K2',
    objet: 'Nettoyage parties communes',
    prestataire: 'Net Hall Propreté',
    copro: 'Résidence Le Méridien',
    montant: 6120,
    echeance: '30/09/2026',
    statut: 'Actif',
    pill: 'sage',
  },
  {
    id: 'K3',
    objet: 'Contrat de chauffage',
    prestataire: 'Atlantic Plomberie SARL',
    copro: 'Copropriété Les Tilleuls',
    montant: 8900,
    echeance: '15/06/2026',
    statut: 'À renégocier',
    pill: 'amber',
  },
  {
    id: 'K4',
    objet: 'Sécurité incendie (vérifications)',
    prestataire: 'Sécurité Incendie 92',
    copro: 'Résidence Le Méridien',
    montant: 1450,
    echeance: '31/03/2027',
    statut: 'Actif',
    pill: 'sage',
  },
  {
    id: 'K5',
    objet: 'Espaces verts',
    prestataire: 'Vert Pro Espaces',
    copro: 'Villa Montaigne',
    montant: 2200,
    echeance: '01/05/2026',
    statut: 'Échu',
    pill: 'rust',
  },
]

/** Fiche détail ouverte au clic sur une ligne (footnote n'est jamais renseignée par la maquette). */
interface FicheContrat {
  title: string
  icon: string
  fields: ChampDetail[]
  footnote?: ReactNode
}

/**
 * Contrats avec les prestataires (registre de démonstration). L'indicateur « Contrats actifs » compte tous les
 * contrats, y compris échus et à renégocier (comme la maquette). « Exporter » ouvre un récapitulatif simulé ;
 * « Nouveau contrat » ouvre une FormModal sans validation suivie d'un toast « Simulation ».
 */
export function ContratsPrestatairesModule() {
  const { push } = useToast()
  const [creationOuverte, setCreationOuverte] = useState(false)
  const [fiche, setFiche] = useState<FicheContrat | null>(null)
  const contrats = DEMO_CONTRATS_PRESTATAIRES

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Contrats avec les prestataires"
        lede="Contrats de la copropriété en cours — révision, mise en concurrence et résiliation dans l'intérêt du syndicat."
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
            <button className="btn gold" onClick={() => setCreationOuverte(true)}>
              <Icon name="plus" />
              Nouveau contrat
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'handshake',
            num: contrats.length,
            lbl: 'Contrats actifs',
            sub: '4 copropriétés',
          },
          {
            icon: 'coin',
            num: formatEuros(contrats.reduce((total, contrat) => total + contrat.montant, 0)),
            lbl: 'Engagement annuel',
            sub: 'cumulé',
          },
          {
            icon: 'clock',
            num: contrats.filter((contrat) => contrat.pill === 'amber').length,
            lbl: 'À renégocier',
            sub: 'sous 90 jours',
            accent: 'amber',
          },
          {
            icon: 'alert',
            num: contrats.filter((contrat) => contrat.pill === 'rust').length,
            lbl: 'Échus',
            sub: 'à renouveler',
            accent: 'rust',
          },
        ]}
      />
      <Panel title="Registre des contrats" sub="Objet · prestataire · échéance" icon="handshake" flush>
        <DataTable
          rowKey="id"
          columns={[
            {
              h: 'Objet',
              render: (contrat) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {contrat.objet}
                </b>
              ),
            },
            {
              h: 'Prestataire',
              render: (contrat) => contrat.prestataire,
            },
            {
              h: 'Copropriété',
              render: (contrat) => contrat.copro,
            },
            {
              h: 'Montant / an',
              render: (contrat) => formatEuros(contrat.montant),
            },
            {
              h: 'Échéance',
              render: (contrat) => contrat.echeance,
            },
            {
              h: 'Statut',
              render: (contrat) => <Pill kind={contrat.pill}>{contrat.statut}</Pill>,
            },
          ]}
          rows={contrats}
          onRow={(contrat) =>
            setFiche({
              title: contrat.objet,
              icon: 'handshake',
              fields: [
                {
                  k: 'Prestataire',
                  v: contrat.prestataire,
                },
                {
                  k: 'Copropriété',
                  v: contrat.copro,
                },
                {
                  k: 'Montant annuel',
                  v: formatEuros(contrat.montant),
                },
                {
                  k: 'Échéance',
                  v: contrat.echeance,
                },
                {
                  k: 'Statut',
                  v: contrat.statut,
                },
              ],
            })
          }
        />
      </Panel>
      <FormModal
        open={creationOuverte}
        onClose={() => setCreationOuverte(false)}
        title="Nouveau contrat"
        icon="handshake"
        fields={[
          {
            label: 'Objet',
            required: true,
            full: true,
          },
          {
            label: 'Prestataire',
            type: 'select',
            options: DEMO_PRESTATAIRES.map((prestataire) => prestataire.nom),
          },
          {
            label: 'Copropriété',
            type: 'select',
            options: DEMO_NOMS_COPROPRIETES,
          },
          {
            label: 'Montant annuel (€)',
            type: 'number',
          },
          {
            label: 'Échéance',
            type: 'date',
          },
        ]}
        submitLabel="Enregistrer"
        onDone={() =>
          push({
            kind: 'success',
            title: 'Simulation',
            desc: "Le contrat n'a pas été enregistré.",
          })
        }
      />
      <DetailModal
        open={!!fiche}
        onClose={() => setFiche(null)}
        title={fiche?.title}
        icon={fiche?.icon}
        fields={fiche?.fields || []}
        footnote={fiche?.footnote}
      />
    </>
  )
}
