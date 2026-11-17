'use client'

import { DEMO_POUVOIRS_AG } from '@/components/administrateur-judiciaire/data/procurations'
import { CarteCritere } from '@/components/administrateur-judiciaire/ui/CarteCritere'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import {
  champCoproprieteChoisie,
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Règle de représentation en assemblée : [règle, précision, teinte de la carte]. */
export type RegleRepresentation = readonly [regle: string, precision: string, teinte: 'sage' | 'amber' | 'rust']

/** Règles de l'article 22 (constante locale de la maquette, hissée au niveau du module sans changer le rendu). */
const REGLES_REPRESENTATION: readonly RegleRepresentation[] = [
  ['Mandataire de son choix', 'Tout copropriétaire peut se faire représenter', 'sage'],
  ['Limite de 3 pouvoirs', 'Un mandataire ne peut recevoir plus de 3 délégations de vote', 'amber'],
  ['Exception 10 %', 'Plus de 3 pouvoirs possibles si le total des voix (siennes + mandants) ≤ 10 %', 'sage'],
  ['Syndic exclu', 'Le syndic ne peut être mandataire (art. 22)', 'rust'],
]

/**
 * Procurations & pouvoirs pour l'assemblée générale (art. 22 loi 1965), écran de démonstration affiché selon la
 * copropriété choisie dans le sélecteur du haut de page : pouvoirs filtrés, « Pouvoirs reçus » et « Pouvoir en blanc »
 * (à attribuer) calculés sur eux, pouvoir prérempli ; le seuil dérogatoire (« 10 % ») est une règle fixe. Tableau des
 * pouvoirs sans fiche détail. « Enregistrer un pouvoir » est un formulaire simulé.
 */
export function ProcurationsModule() {
  const { push } = useToast()
  const { code, nom } = useCoproChoisie()
  const pouvoirs = filtrerParCopro(DEMO_POUVOIRS_AG, code, (pouvoir) => codeDeNomCopro(pouvoir[0]))
  const recus = pouvoirs.filter((pouvoir) => pouvoir[4] === 'reçu').length

  return (
    <>
      <PageHead
        eyebrow="Assemblée générale · Art. 22 Loi 1965"
        title="Procurations & pouvoirs"
        lede="Gestion des pouvoirs reçus pour l'assemblée générale et contrôle des règles de représentation."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'handshake',
                title: 'Enregistrer un pouvoir',
                fields: [
                  champCoproprieteChoisie(nom),
                  {
                    label: 'Mandant',
                    placeholder: 'Copropriétaire représenté · lot',
                    full: true,
                  },
                  {
                    label: 'Mandataire',
                    placeholder: 'Personne recevant le pouvoir',
                    full: true,
                  },
                  {
                    label: 'Assemblée',
                    placeholder: 'ex. AG du 08/07/2026',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Pouvoir enregistré',
                },
              })
            }
          >
            <Icon name="doc" />
            Enregistrer un pouvoir
          </button>
        }
      />
      <Kpis
        items={[
          {
            icon: 'doc',
            num: recus,
            lbl: 'Pouvoirs reçus',
            accent: 'sage',
          },
          {
            icon: 'alert',
            num: pouvoirs.length - recus,
            lbl: 'Pouvoir en blanc',
            accent: 'amber',
          },
          {
            icon: 'scale',
            num: '10 %',
            lbl: 'Seuil dérogatoire (>3 pouvoirs)',
          },
        ]}
      />
      <Panel title="Règles de représentation (art. 22)" icon="scale">
        <div className="card-grid cols-2">
          {REGLES_REPRESENTATION.map(([regle, precision, teinte], index) => (
            <CarteCritere titre={regle} detail={precision} teinte={teinte} key={index} />
          ))}
        </div>
      </Panel>
      <Panel title="Pouvoirs reçus — prochaine AG" icon="clipboard" flush>
        {pouvoirs.length === 0 ? (
          <EmptyState icon="clipboard" title={titreListeVide('Aucun pouvoir', nom)} />
        ) : (
          <DataTable
            columns={[
              {
                h: 'Copropriété',
                render: (pouvoir) => pouvoir[0],
              },
              {
                h: 'Mandant',
                render: (pouvoir) => pouvoir[1],
              },
              {
                h: 'Mandataire',
                render: (pouvoir) => pouvoir[2],
              },
              {
                h: 'Voix',
                render: (pouvoir) => <span className="mono">{pouvoir[3]}</span>,
              },
              {
                h: 'Statut',
                render: (pouvoir) => (
                  <Pill kind={pouvoir[4] === 'reçu' ? 'sage' : 'amber'} noDot>
                    {pouvoir[4]}
                  </Pill>
                ),
              },
            ]}
            rows={pouvoirs}
          />
        )}
      </Panel>
    </>
  )
}
