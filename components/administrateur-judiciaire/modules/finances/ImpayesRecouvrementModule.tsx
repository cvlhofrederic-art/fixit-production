'use client'

import { useState } from 'react'
import { DEMO_COPROPRIETAIRES } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_TOTAL_IMPAYES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { FormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros, formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'

/** Fiche détail d'un compte débiteur (titre, icône, note de bas de fiche et champs). */
export interface DetailCompteDebiteur {
  title: string
  icon: string
  footnote: string
  fields: ChampDetail[]
}

/**
 * Impayés et recouvrement (copropriétaires de démonstration au solde négatif). Indicateurs en partie saisis en dur
 * (1 contentieux SCI Belvédère 9 200 €, 18 %, 36 %). « Engager le recouvrement » ouvre un formulaire simulé ;
 * « Exporter » ouvre le document d'export générique (simulé).
 */
export function ImpayesRecouvrementModule() {
  const { push } = useToast()
  const [formulaireOuvert, setFormulaireOuvert] = useState(false)
  const [detail, setDetail] = useState<DetailCompteDebiteur | null>(null)
  const debiteurs = DEMO_COPROPRIETAIRES.filter((coproprietaire) => coproprietaire.solde < 0)

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Impayés & recouvrement"
        lede="Charges impayées et procédures de recouvrement — mise en demeure, mise en œuvre de l'article 19-2 (déchéance du terme)."
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
            <button className="btn gold" onClick={() => setFormulaireOuvert(true)}>
              <Icon name="scale" />
              Engager le recouvrement
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'coin',
            num: formatEuros(DEMO_TOTAL_IMPAYES),
            lbl: 'Total des impayés',
            sub: 'sur 4 copropriétés',
            accent: 'rust',
            trend: {
              kind: 'bad',
              label: 'à recouvrer',
            },
          },
          {
            icon: 'users',
            num: debiteurs.length,
            lbl: 'Copropriétaires concernés',
            sub: '1 en contentieux',
            accent: 'amber',
          },
          {
            icon: 'scale',
            num: 1,
            lbl: 'Procédure contentieuse',
            sub: 'SCI Belvédère · 9 200 €',
            accent: 'rust',
          },
          {
            icon: 'check',
            num: '18%',
            lbl: "Taux d'impayés moyen",
            sub: 'Les Tilleuls : 36 %',
            accent: 'amber',
          },
        ]}
      />
      <Panel title="Comptes débiteurs" sub="Copropriétaires en retard ou en contentieux" icon="alert" flush>
        <DataTable
          rowKey="id"
          columns={[
            {
              h: 'Copropriétaire',
              render: (coproprietaire) => (
                <div>
                  <b
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {coproprietaire.nom}
                  </b>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--navy-300)',
                    }}
                  >
                    {coproprietaire.lot}
                  </div>
                </div>
              ),
            },
            {
              h: 'Copropriété',
              render: (coproprietaire) => coproprietaire.copro,
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
                    color: 'var(--rust-700)',
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
          rows={debiteurs}
          onRow={(coproprietaire) =>
            setDetail({
              title: coproprietaire.nom,
              icon: 'users',
              footnote:
                "À défaut de paiement après mise en demeure, l'article 19-2 de la loi de 1965 permet la déchéance du terme et la saisine du juge.",
              fields: [
                {
                  k: 'Lot',
                  v: coproprietaire.lot,
                },
                {
                  k: 'Copropriété',
                  v: coproprietaire.copro,
                },
                {
                  k: 'Tantièmes',
                  v: coproprietaire.tantiemes,
                },
                {
                  k: 'Solde débiteur',
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
        open={formulaireOuvert}
        onClose={() => setFormulaireOuvert(false)}
        title="Engager une procédure de recouvrement"
        icon="scale"
        fields={[
          {
            label: 'Copropriétaire',
            type: 'select',
            options: debiteurs.map((coproprietaire) => coproprietaire.nom),
            required: true,
            full: true,
          },
          {
            label: 'Type de procédure',
            type: 'select',
            options: [
              'Relance amiable',
              'Mise en demeure (LRAR)',
              'Déchéance du terme (art. 19-2)',
              'Injonction de payer',
              'Assignation',
            ],
          },
          {
            label: 'Montant réclamé (€)',
            type: 'number',
            placeholder: '0',
            required: true,
          },
          {
            label: 'Observations',
            type: 'textarea',
            full: true,
          },
        ]}
        submitLabel="Engager la procédure"
        onDone={() =>
          push({
            kind: 'success',
            title: 'Simulation',
            desc: "Aucune procédure n'est engagée, aucun courrier n'est généré.",
          })
        }
      />
      <DetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title}
        icon={detail?.icon}
        fields={detail?.fields || []}
        footnote={detail?.footnote}
      />
    </>
  )
}
