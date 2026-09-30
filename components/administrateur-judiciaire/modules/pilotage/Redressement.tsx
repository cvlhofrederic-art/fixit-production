'use client'

import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useCoproParCode } from '@/lib/administrateur-judiciaire/db/hooks'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/** Créancier du syndicat et son échéancier d'apurement. */
export interface CreancierRedressement {
  nom: string
  type: string
  montant: number
  plan: string
  statut: string
  pill: string
}

/** Créanciers de démonstration (chiffres figés). */
export const CREANCIERS_REDRESSEMENT: CreancierRedressement[] = [
  {
    nom: 'Atlantic Plomberie SARL',
    type: 'Fournisseur',
    montant: 8400,
    plan: '6 mensualités',
    statut: 'Échéancier accepté',
    pill: 'sage',
  },
  {
    nom: 'Régie ENEDIS (parties communes)',
    type: 'Énergie',
    montant: 5200,
    plan: 'Apurement T3',
    statut: 'En négociation',
    pill: 'amber',
  },
  {
    nom: 'ELEC92 Services',
    type: 'Fournisseur',
    montant: 3100,
    plan: '3 mensualités',
    statut: 'Échéancier accepté',
    pill: 'sage',
  },
  {
    nom: "Cabinet d'avocats (contentieux)",
    type: 'Honoraires',
    montant: 2600,
    plan: 'À provisionner',
    statut: 'À traiter',
    pill: 'rust',
  },
]

/**
 * Redressement d'une copropriété en difficulté (statut partiel), toujours sur le mandat « TL » (Les Tilleuls), sans
 * sélecteur : taux d'impayés face au seuil de 25 %, dette fournisseurs et plan d'apurement des créanciers.
 * Le document « Plan d'apurement » reprend des chiffres figés (34 800 €, 1 933 €, 18 mois).
 */
export function RedressementModule() {
  const { push } = useToast()
  const copro = useCoproParCode('TL')
  const tauxImpayes = Math.round((copro.impayes / copro.budget) * 100)
  const detteFournisseurs = CREANCIERS_REDRESSEMENT.reduce((total, creancier) => total + creancier.montant, 0)
  return (
    <>
      <PageHead
        eyebrow="Pilotage judiciaire"
        title="Redressement — copropriété en difficulté"
        lede="Mandat art. 29-1 : rétablir l'équilibre financier et le fonctionnement normal. Seuil d'alerte des impayés, plan d'apurement et suspension des poursuites."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'doc',
                icon: 'coin',
                title: "Plan d'apurement",
                eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
                docTitle: "Plan d'apurement de la dette",
                meta: 'Copropriété Les Tilleuls · dette 34 800 €',
                lines: [
                  "Échéancier proposé pour l'apurement de la dette de copropriété sur 18 mois.",
                  {
                    h: 'Échéancier',
                  },
                  {
                    k: 'Mensualité',
                    v: '1 933 €',
                  },
                  {
                    k: 'Durée',
                    v: '18 mois',
                  },
                  {
                    k: 'Première échéance',
                    v: '01/07/2026',
                  },
                  {
                    k: 'Solde à apurer',
                    v: '34 800 €',
                  },
                ],
              })
            }
          >
            <Icon name="download" />
            {"Plan d'apurement"}
          </button>
        }
      />
      <Alert kind="warn" icon="siren" title={`${copro.nom} — administration provisoire (art. 29-1)`}>
        {copro.tribunal}
        {' · RG '}
        {copro.rg}
        {
          '. La mission vise le rétablissement du fonctionnement normal de la copropriété et le redressement de sa situation financière.'
        }
      </Alert>
      <Kpis
        items={[
          {
            icon: 'alert',
            num: `${tauxImpayes}%`,
            lbl: "Taux d'impayés",
            sub: 'seuil critique : 25%',
            accent: tauxImpayes >= 25 ? 'rust' : 'amber',
            trend:
              tauxImpayes >= 25
                ? {
                    kind: 'bad',
                    label: 'au-dessus du seuil',
                  }
                : {
                    kind: 'warn',
                    label: 'à surveiller',
                  },
          },
          {
            icon: 'coin',
            num: formatEuros(copro.impayes),
            lbl: 'Impayés à recouvrer',
            accent: 'rust',
          },
          {
            icon: 'fact',
            num: formatEuros(detteFournisseurs),
            lbl: 'Dette fournisseurs',
            sub: `${CREANCIERS_REDRESSEMENT.length} créanciers`,
            accent: 'amber',
          },
          {
            icon: 'shield',
            num: 'Active',
            lbl: 'Suspension des poursuites',
            sub: 'protège le syndicat',
            accent: 'sage',
          },
        ]}
      />
      <Panel
        title="Taux d'impayés vs seuil légal"
        sub="Seuil de 25 % : saisine du juge pour un mandataire ad hoc (art. 29-1 A) ; l'administration provisoire suppose un équilibre financier gravement compromis (art. 29-1)"
        icon="chart"
      >
        <div
          style={{
            position: 'relative',
            height: 14,
            borderRadius: 7,
            background: 'var(--cream)',
            overflow: 'visible',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: `${Math.min(100, tauxImpayes)}%`,
              height: '100%',
              borderRadius: 7,
              background:
                tauxImpayes >= 25
                  ? 'linear-gradient(90deg,var(--rust-700),var(--rust-500))'
                  : 'linear-gradient(90deg,var(--amber-700),var(--amber-500))',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '25%',
              top: -4,
              bottom: -4,
              width: 2,
              background: 'var(--navy-700)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '25%',
              top: -20,
              transform: 'translateX(-50%)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--navy-700)',
            }}
          >
            seuil 25%
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--navy-500)',
          }}
        >
          {tauxImpayes}
          {"% d'impayés sur un budget de "}
          {formatEuros(copro.budget)}
          {'.'}
        </div>
      </Panel>
      <Panel
        title="Plan d'apurement des créanciers"
        sub="Échéanciers négociés sous la protection de la procédure"
        icon="handshake"
        flush
      >
        <DataTable
          rowKey="nom"
          columns={[
            {
              h: 'Créancier',
              render: (creancier) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {creancier.nom}
                </b>
              ),
            },
            {
              h: 'Nature',
              render: (creancier) => (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--navy-500)',
                  }}
                >
                  {creancier.type}
                </span>
              ),
            },
            {
              h: 'Montant',
              style: {
                textAlign: 'right',
              },
              tdStyle: {
                textAlign: 'right',
              },
              render: (creancier) => (
                <b
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {formatEuros(creancier.montant)}
                </b>
              ),
            },
            {
              h: 'Plan',
              render: (creancier) => creancier.plan,
            },
            {
              h: 'Statut',
              render: (creancier) => (
                <Pill kind={creancier.pill} noDot>
                  {creancier.statut}
                </Pill>
              ),
            },
          ]}
          rows={CREANCIERS_REDRESSEMENT}
        />
      </Panel>
    </>
  )
}
