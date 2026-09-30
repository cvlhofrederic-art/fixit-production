'use client'

import { useState, type ReactNode } from 'react'
import { DEMO_COPROPRIETAIRES } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_NOMS_COPROPRIETES, DEMO_TOTAL_LOTS } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { FormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'

/** Fiche détail ouverte au clic sur une ligne (footnote n'est jamais renseignée par la maquette). */
interface FicheCoproprietaire {
  title: string
  icon: string
  fields: ChampDetail[]
  footnote?: ReactNode
}

/**
 * Lots & copropriétaires. Registre de démonstration (échantillon statique, et non la base locale contrairement à
 * l'écran Copropriétés) ; l'indicateur « 10 000 » tantièmes est en dur. Solde en rouge s'il est négatif, en vert
 * sinon. « Exporter » ouvre un récapitulatif simulé ; « Ajouter un copropriétaire » ouvre une FormModal sans
 * validation suivie d'un toast « Simulation ».
 */
export function LotsCoproprietairesModule() {
  const { push } = useToast()
  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [fiche, setFiche] = useState<FicheCoproprietaire | null>(null)

  return (
    <>
      <PageHead
        eyebrow="Patrimoine"
        title="Lots & copropriétaires"
        lede="Registre des copropriétaires, lots et tantièmes — base de la convocation des assemblées et de la répartition des charges."
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
            <button className="btn gold" onClick={() => setAjoutOuvert(true)}>
              <Icon name="plus" />
              Ajouter un copropriétaire
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'users',
            num: DEMO_COPROPRIETAIRES.length,
            lbl: 'Copropriétaires (échantillon)',
            sub: `${DEMO_TOTAL_LOTS} lots au total`,
          },
          {
            icon: 'check',
            num: DEMO_COPROPRIETAIRES.filter((coproprietaire) => coproprietaire.statut === 'À jour').length,
            lbl: 'À jour',
            sub: 'charges réglées',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: DEMO_COPROPRIETAIRES.filter((coproprietaire) => coproprietaire.solde < 0).length,
            lbl: 'En retard / impayé',
            sub: 'à relancer',
            accent: 'rust',
          },
          {
            icon: 'doc',
            num: '10 000',
            lbl: 'Tantièmes (total)',
            sub: 'clé de répartition générale',
          },
        ]}
      />
      <Panel
        title="Registre des copropriétaires"
        sub="Lots, tantièmes et situation de compte"
        icon="users"
        flush
      >
        <DataTable
          rowKey="id"
          columns={[
            {
              h: 'Copropriétaire',
              render: (coproprietaire) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {coproprietaire.nom}
                </b>
              ),
            },
            {
              h: 'Copropriété',
              render: (coproprietaire) => coproprietaire.copro,
            },
            {
              h: 'Lot',
              render: (coproprietaire) => coproprietaire.lot,
            },
            {
              h: 'Tantièmes',
              render: (coproprietaire) => (
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                  }}
                >
                  {coproprietaire.tantiemes}
                </span>
              ),
            },
            {
              h: 'Solde',
              render: (coproprietaire) => (
                <span
                  style={{
                    color: coproprietaire.solde < 0 ? 'var(--rust-700)' : 'var(--sage-700)',
                    fontWeight: 600,
                  }}
                >
                  {formatEurosCentimes(coproprietaire.solde)}
                </span>
              ),
            },
            {
              h: 'Statut',
              render: (coproprietaire) => <Pill kind={coproprietaire.pill}>{coproprietaire.statut}</Pill>,
            },
          ]}
          rows={DEMO_COPROPRIETAIRES}
          onRow={(coproprietaire) =>
            setFiche({
              title: coproprietaire.nom,
              icon: 'users',
              fields: [
                {
                  k: 'Copropriété',
                  v: coproprietaire.copro,
                },
                {
                  k: 'Lot',
                  v: coproprietaire.lot,
                },
                {
                  k: 'Tantièmes',
                  v: coproprietaire.tantiemes,
                },
                {
                  k: 'Solde',
                  v: formatEurosCentimes(coproprietaire.solde),
                },
                {
                  k: 'Statut',
                  v: coproprietaire.statut,
                },
                {
                  k: 'Téléphone',
                  v: coproprietaire.tel,
                },
                {
                  k: 'Courriel',
                  v: coproprietaire.mail,
                  full: true,
                },
              ],
            })
          }
        />
      </Panel>
      <FormModal
        open={ajoutOuvert}
        onClose={() => setAjoutOuvert(false)}
        title="Ajouter un copropriétaire"
        icon="users"
        fields={[
          {
            label: 'Nom / Raison sociale',
            required: true,
            full: true,
          },
          {
            label: 'Copropriété',
            type: 'select',
            options: DEMO_NOMS_COPROPRIETES,
          },
          {
            label: 'Lot',
            placeholder: 'ex. Lot 12 — Apt B3',
          },
          {
            label: 'Tantièmes',
            placeholder: 'ex. 350/10000',
          },
          {
            label: 'Courriel',
            type: 'email',
            placeholder: 'nom@email.fr',
          },
        ]}
        submitLabel="Ajouter"
        onDone={() =>
          push({
            kind: 'success',
            title: 'Simulation',
            desc: "Le copropriétaire n'a pas été enregistré.",
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
