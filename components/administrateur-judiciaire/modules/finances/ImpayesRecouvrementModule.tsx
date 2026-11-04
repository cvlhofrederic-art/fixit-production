'use client'

import { useState } from 'react'
import {
  DEMO_COPROPRIETAIRES,
  type CoproprietaireDemo,
} from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_TOTAL_IMPAYES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DOCUMENT_EXPORT_DONNEES } from '@/components/administrateur-judiciaire/data/elements-communs'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { DetailModal, type ChampDetail } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { FormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis, type KpiProps } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import type { CoproprieteAffichee } from '@/lib/administrateur-judiciaire/db/hooks'
import { formatEuros, formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useCodeCoproCourant, useCoproCourante } from '@/lib/administrateur-judiciaire/selection'

/** Fiche détail d'un compte débiteur (titre, icône, note de bas de fiche et champs). */
export interface DetailCompteDebiteur {
  title: string
  icon: string
  footnote: string
  fields: ChampDetail[]
}

/** Indicateurs sans copropriété choisie (écran rendu seul) : cumul des copropriétés et valeurs saisies en dur. */
function indicateursTousMandats(nombreDebiteurs: number): KpiProps[] {
  return [
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
      num: nombreDebiteurs,
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
  ]
}

/** Indicateurs de la copropriété choisie : ses impayés, son budget et ses débiteurs (dont ceux en contentieux). */
function indicateursCopro(
  copro: Pick<CoproprieteAffichee, 'nom' | 'budget' | 'impayes'>,
  debiteurs: readonly CoproprietaireDemo[],
): KpiProps[] {
  const enContentieux = debiteurs.filter((coproprietaire) => coproprietaire.statut === 'Contentieux')
  const premier = enContentieux[0]
  return [
    {
      icon: 'coin',
      num: formatEuros(copro.impayes),
      lbl: 'Total des impayés',
      sub: copro.nom,
      accent: 'rust',
      trend: copro.impayes > 0 ? { kind: 'bad', label: 'à recouvrer' } : null,
    },
    {
      icon: 'users',
      num: debiteurs.length,
      lbl: 'Copropriétaires concernés',
      sub: `${enContentieux.length} en contentieux`,
      accent: 'amber',
    },
    {
      icon: 'scale',
      num: enContentieux.length,
      lbl: 'Procédure contentieuse',
      sub: premier ? `${premier.nom} · ${formatEuros(-premier.solde)}` : 'Aucune',
      accent: 'rust',
    },
    {
      icon: 'check',
      // Budget nul (copropriété de la base sans budget saisi) : pas de taux plutôt que « NaN % ».
      num: copro.budget > 0 ? Math.round((copro.impayes / copro.budget) * 100) + ' %' : '—',
      lbl: "Taux d'impayés",
      sub: `sur un budget de ${formatEuros(copro.budget)}`,
      accent: 'amber',
    },
  ]
}

/**
 * Impayés et recouvrement de la copropriété choisie en haut de page (copropriétaires de démonstration au solde
 * négatif) ; sans copropriété choisie (écran rendu seul), ceux de toutes les copropriétés, avec des indicateurs en
 * partie saisis en dur (1 contentieux SCI Belvédère 9 200 €, 18 %, 36 %). « Engager le recouvrement » ouvre un
 * formulaire simulé ; « Exporter » ouvre le document d'export générique (simulé).
 */
export function ImpayesRecouvrementModule() {
  const { push } = useToast()
  const [formulaireOuvert, setFormulaireOuvert] = useState(false)
  const [detail, setDetail] = useState<DetailCompteDebiteur | null>(null)
  const code = useCodeCoproCourant()
  const copro = useCoproCourante()
  const debiteurs = filtrerParCopro(
    DEMO_COPROPRIETAIRES.filter((coproprietaire) => coproprietaire.solde < 0),
    code,
    (coproprietaire) => codeDeNomCopro(coproprietaire.copro),
  )

  return (
    <>
      <PageHead
        eyebrow="Comptabilité & finances"
        title="Impayés & recouvrement"
        lede="Charges impayées et procédures de recouvrement — mise en demeure, mise en œuvre de l'article 19-2 (déchéance du terme)."
        actions={
          <>
            <button className="btn" onClick={() => push(DOCUMENT_EXPORT_DONNEES)}>
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
      <Kpis items={code ? indicateursCopro(copro, debiteurs) : indicateursTousMandats(debiteurs.length)} />
      <Panel title="Comptes débiteurs" sub="Copropriétaires en retard ou en contentieux" icon="alert" flush>
        {debiteurs.length > 0 ? (
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
        ) : (
          <EmptyState icon="users" title={`Aucun compte débiteur pour ${copro.nom}`} />
        )}
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
