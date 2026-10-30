'use client'

import { useState } from 'react'
import {
  DEMO_DOLEANCES,
  type DoleanceDemo,
  type PrioriteDoleance,
} from '@/components/administrateur-judiciaire/data/doleances'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { DonutGauge } from '@/components/administrateur-judiciaire/ui/DonutGauge'
import { EmptyState } from '@/components/administrateur-judiciaire/ui/EmptyState'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { ProgressBar } from '@/components/administrateur-judiciaire/ui/ProgressBar'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import {
  champCoproprieteChoisie,
  sousTitreFige,
  titreListeVide,
  useCoproChoisie,
} from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { pourcentageArrondi } from '@/lib/administrateur-judiciaire/domain/format'
import { codeDeNomCopro, filtrerParCopro } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'

/** Ligne de la répartition par priorité : [priorité, nombre, teinte de la pastille et de la barre]. */
export type RepartitionPrioriteDoleances = [priorite: PrioriteDoleance, nombre: number, teinte: string]

/** Priorités de la répartition, dans l'ordre d'affichage, avec la teinte de leur pastille et de leur barre. */
const PRIORITES: readonly (readonly [priorite: PrioriteDoleance, teinte: string])[] = [
  ['Urgente', 'rust'],
  ['Haute', 'amber'],
  ['Moyenne', ''],
  ['Basse', 'sage'],
]

/** Répartition par priorité des doléances affichées (chaque barre est rapportée à leur nombre). */
const repartirParPriorite = (doleances: readonly DoleanceDemo[]): RepartitionPrioriteDoleances[] =>
  PRIORITES.map(([priorite, teinte]) => [
    priorite,
    doleances.filter((doleance) => doleance[2] === priorite).length,
    teinte,
  ])

/**
 * Doléances & réclamations (écran de démonstration ; surtitre « Gestion courante »), affiché selon la copropriété
 * choisie dans le sélecteur du haut de page : doléances filtrées, nouvelle doléance préremplie. Total, ouvertes, en
 * cours, résolues et répartition par priorité sont calculés sur les doléances affichées ; le délai moyen (« 4j ») et
 * la conformité SLA (83 %) restent en dur, marqués « Tous les mandats » quand une copropriété est choisie. Les onglets sont autonomes ; chaque ligne de la liste ouvre la fiche
 * détail de la doléance.
 */
export function DoleancesModule() {
  const { push } = useToast()
  const [doleanceOuverte, setDoleanceOuverte] = useState<DoleanceDemo | null>(null)
  const { code, nom } = useCoproChoisie()
  const doleances = filtrerParCopro(DEMO_DOLEANCES, code, (doleance) => codeDeNomCopro(doleance[1]))
  const compter = (statut: DoleanceDemo[4]) => doleances.filter((doleance) => doleance[4] === statut).length
  const repartition = repartirParPriorite(doleances)

  return (
    <>
      <PageHead
        eyebrow="Gestion courante"
        title="Doléances & réclamations"
        lede="Centralisez les incidents et réclamations signalés par les copropriétaires."
        actions={
          <button
            className="btn gold"
            onClick={() =>
              push({
                kind: 'form',
                icon: 'chat',
                title: 'Nouvelle doléance',
                fields: [
                  champCoproprieteChoisie(nom),
                  {
                    label: 'Copropriétaire',
                    placeholder: 'Nom · lot',
                    full: true,
                  },
                  {
                    label: 'Objet',
                    placeholder: 'ex. Nuisance sonore',
                    full: true,
                  },
                  {
                    label: 'Description',
                    type: 'textarea',
                    placeholder: 'Détaillez la doléance…',
                    full: true,
                  },
                ],
                submitLabel: 'Enregistrer',
                toast: {
                  title: 'Doléance enregistrée',
                },
              })
            }
          >
            <Icon name="plus" />
            Nouvelle doléance
          </button>
        }
      />
      <Tabs
        defaultActive="panel"
        tabs={[
          {
            id: 'panel',
            icon: 'chart',
            label: 'Tableau',
          },
          {
            id: 'liste',
            icon: 'clipboard',
            label: 'Doléances',
          },
          {
            id: 'carte',
            icon: 'map',
            label: 'Carte',
          },
          {
            id: 'qr',
            icon: 'qr',
            label: 'QR codes',
          },
        ]}
      />
      <Kpis
        items={[
          {
            icon: 'clipboard',
            num: doleances.length,
            lbl: 'Total doléances',
          },
          {
            icon: 'bell',
            num: compter('Ouverte'),
            lbl: 'Ouvertes',
            accent: 'rust',
          },
          {
            icon: 'wrench',
            num: compter('En cours'),
            lbl: 'En cours',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: compter('Résolue'),
            lbl: 'Résolues',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: '4j',
            lbl: 'Délai moyen',
            sub: sousTitreFige(code),
          },
        ]}
      />
      <div
        className="card-grid cols-2"
        style={{
          marginBottom: 16,
        }}
      >
        <Panel title="Répartition par priorité" icon="chart">
          {repartition.map((ligne, index) => (
            <div
              style={{
                marginBottom: 14,
              }}
              key={index}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  marginBottom: 5,
                }}
              >
                <span>
                  <span className={`dot-status ${ligne[2]}`} />
                  {' '}
                  {ligne[0]}
                </span>
                <b>{ligne[1]}</b>
              </div>
              <ProgressBar pct={pourcentageArrondi(ligne[1], doleances.length)} kind={ligne[2]} />
            </div>
          ))}
        </Panel>
        <Panel title="Conformité SLA" sub={sousTitreFige(code)} icon="clock">
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px 0',
            }}
          >
            <DonutGauge pct={83} kind="gold" label="dans les délais" size={150} />
          </div>
        </Panel>
      </div>
      <Panel flush>
        {doleances.length === 0 && (
          <EmptyState icon="clipboard" title={titreListeVide('Aucune doléance', nom)} />
        )}
        {doleances.map((doleance, index) => (
          <div
            className="list-row"
            onClick={() => setDoleanceOuverte(doleance)}
            onKeyDown={surActivationClavier(() => setDoleanceOuverte(doleance))}
            role="button"
            tabIndex={0}
            style={{
              cursor: 'pointer',
            }}
            key={index}
          >
            <div className="thumb">
              <Icon name={doleance[4] === 'Résolue' ? 'check' : doleance[2] === 'Urgente' ? 'siren' : 'wrench'} />
            </div>
            <div className="info">
              <b>{doleance[0]}</b>
              <div className="meta">
                <Pill kind={doleance[3]} noDot>
                  {doleance[2]}
                </Pill>
                <Pill kind={doleance[4] === 'Résolue' ? 'sage' : doleance[4] === 'En cours' ? 'amber' : 'rust'} noDot>
                  {doleance[4]}
                </Pill>
                <span
                  style={{
                    fontSize: 11.5,
                    color: 'var(--navy-500)',
                  }}
                >
                  {doleance[1]}
                </span>
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--navy-300)',
              }}
            >
              {doleance[6]}
            </div>
          </div>
        ))}
      </Panel>
      <DetailModal
        open={!!doleanceOuverte}
        onClose={() => setDoleanceOuverte(null)}
        title={doleanceOuverte ? doleanceOuverte[0] : ''}
        icon="clipboard"
        fields={
          doleanceOuverte
            ? [
                {
                  k: 'Copropriété',
                  v: doleanceOuverte[1],
                },
                {
                  k: 'Priorité',
                  v: doleanceOuverte[2],
                },
                {
                  k: 'Statut',
                  v: doleanceOuverte[4],
                },
                {
                  k: 'Signalé le',
                  v: doleanceOuverte[6],
                },
                {
                  k: 'Description',
                  v: doleanceOuverte[5],
                  full: true,
                },
              ]
            : []
        }
        footnote="Doléance versée au suivi du mandat."
      />
    </>
  )
}
