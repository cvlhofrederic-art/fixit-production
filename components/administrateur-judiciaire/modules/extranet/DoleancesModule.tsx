'use client'

import { useState } from 'react'
import {
  DEMO_DOLEANCES,
  type DoleanceDemo,
  type PrioriteDoleance,
} from '@/components/administrateur-judiciaire/data/doleances'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { DetailModal } from '@/components/administrateur-judiciaire/ui/DetailModal'
import { DonutGauge } from '@/components/administrateur-judiciaire/ui/DonutGauge'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { ProgressBar } from '@/components/administrateur-judiciaire/ui/ProgressBar'
import { Tabs } from '@/components/administrateur-judiciaire/ui/Tabs'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { pourcentageArrondi } from '@/lib/administrateur-judiciaire/domain/format'

/** Ligne de la répartition par priorité : [priorité, nombre, teinte de la pastille et de la barre]. */
export type RepartitionPrioriteDoleances = [priorite: PrioriteDoleance, nombre: number, teinte: string]

/**
 * Répartition par priorité, saisie en dur (non dérivée de DEMO_DOLEANCES). Chaque barre est rapportée
 * à un total de 6 lui aussi en dur.
 */
const REPARTITION_PRIORITES: readonly RepartitionPrioriteDoleances[] = [
  ['Urgente', 2, 'rust'],
  ['Haute', 2, 'amber'],
  ['Moyenne', 1, ''],
  ['Basse', 1, 'sage'],
]

/** Total servant de base aux barres de la répartition (en dur dans la maquette). */
const TOTAL_REPARTITION_PRIORITES = 6

/**
 * Doléances & réclamations (écran de démonstration ; surtitre « Gestion courante »).
 * Les onglets sont autonomes et les indicateurs sont saisis en dur (6, 2, 2, 2, « 4j ») ;
 * chaque ligne de la liste ouvre la fiche détail de la doléance.
 */
export function DoleancesModule() {
  const { push } = useToast()
  const [doleanceOuverte, setDoleanceOuverte] = useState<DoleanceDemo | null>(null)

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
                  CHAMP_COPROPRIETE,
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
            num: 6,
            lbl: 'Total doléances',
          },
          {
            icon: 'bell',
            num: 2,
            lbl: 'Ouvertes',
            accent: 'rust',
          },
          {
            icon: 'wrench',
            num: 2,
            lbl: 'En cours',
            accent: 'amber',
          },
          {
            icon: 'check',
            num: 2,
            lbl: 'Résolues',
            accent: 'sage',
          },
          {
            icon: 'clock',
            num: '4j',
            lbl: 'Délai moyen',
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
          {REPARTITION_PRIORITES.map((repartition, index) => (
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
                  <span className={`dot-status ${repartition[2]}`} />
                  {' '}
                  {repartition[0]}
                </span>
                <b>{repartition[1]}</b>
              </div>
              <ProgressBar pct={pourcentageArrondi(repartition[1], TOTAL_REPARTITION_PRIORITES)} kind={repartition[2]} />
            </div>
          ))}
        </Panel>
        <Panel title="Conformité SLA" icon="clock">
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
        {DEMO_DOLEANCES.map((doleance, index) => (
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
