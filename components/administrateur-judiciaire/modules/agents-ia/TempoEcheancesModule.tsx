'use client'

import { useState } from 'react'
import {
  DEMO_AUTOMATISATIONS,
  type Automatisation,
} from '@/components/administrateur-judiciaire/data/automatisations'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { AgentChatPage } from '@/components/administrateur-judiciaire/modules/agents-ia/AgentChatPage'
import {
  CreerAutomatisationModal,
  type NouvelleAutomatisation,
} from '@/components/administrateur-judiciaire/modules/agents-ia/CreerAutomatisationModal'
import { DataTable } from '@/components/administrateur-judiciaire/ui/DataTable'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'

type OngletTempo = 'assistant' | 'tableau'

/** Prochaine exécution affichée (libellé t, moment w, couleur k de la pastille et du statut, statut s). */
interface ProchaineExecution {
  t: string
  w: string
  k: 'sage' | 'amber' | 'rust'
  s: string
}

/** Prochaines exécutions de la semaine (liste fixe de la maquette). */
const PROCHAINES_EXECUTIONS: ProchaineExecution[] = [
  {
    t: 'Sauvegarde des documents',
    w: 'dim. 7 juin · 2 h',
    k: 'sage',
    s: 'Planifié',
  },
  {
    t: 'Relance des impayés',
    w: 'lun. 8 juin · 10 h',
    k: 'amber',
    s: 'Planifié',
  },
  {
    t: 'Alerte échéance — Le Méridien',
    w: 'quotidien · 8 h',
    k: 'sage',
    s: 'Planifié',
  },
  {
    t: 'Échec : relance quotas 21 mai',
    w: 'à rejouer',
    k: 'rust',
    s: 'Échec',
  },
]

/**
 * Tempo — Échéances : onglet « Assistant » (conversation simulée) et onglet « Tableau » des automatisations
 * (activation / pause, création simulée). Chiffres en dur : 90 exécutions ce mois, 1 échec, et « 7 automatisations
 * actives » dans l'introduction, quelle que soit la liste.
 */
export function TempoEcheancesModule() {
  const { push } = useToast()
  const [onglet, setOnglet] = useState<OngletTempo>('assistant')
  const [automatisations, setAutomatisations] = useState<Automatisation[]>(DEMO_AUTOMATISATIONS)
  const [creationOuverte, setCreationOuverte] = useState(false)

  const basculer = (id: string) =>
    setAutomatisations((liste) =>
      liste.map((automatisation) =>
        automatisation.id === id
          ? automatisation.statut === 'En pause'
            ? {
                ...automatisation,
                statut: 'Succès',
                pill: 'sage',
              }
            : {
                ...automatisation,
                statut: 'En pause',
                pill: 'gold',
              }
          : automatisation,
      ),
    )

  const nbActives = automatisations.filter((automatisation) => automatisation.statut !== 'En pause').length
  const nbEnPause = automatisations.filter((automatisation) => automatisation.statut === 'En pause').length

  const creer = (saisie: NouvelleAutomatisation) => {
    setAutomatisations((liste) => [
      {
        id: 'a' + Date.now(),
        nom: saisie.nom.trim(),
        type: saisie.type,
        agenda: saisie.agenda.trim() || saisie.freq,
        last: '—',
        statut: 'Succès',
        pill: 'sage',
      },
      ...liste,
    ])
    push({
      kind: 'success',
      title: 'Simulation',
      desc: `${saisie.nom.trim()} — ajoutée à la liste, non activée, non exécutée`,
    })
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
        }}
      >
        <button className={`chip ${onglet === 'assistant' ? 'active' : ''}`} onClick={() => setOnglet('assistant')}>
          <Icon
            name="bot"
            style={{
              width: 13,
              height: 13,
              verticalAlign: '-2px',
              marginRight: 5,
            }}
          />
          Assistant
        </button>
        <button className={`chip ${onglet === 'tableau' ? 'active' : ''}`} onClick={() => setOnglet('tableau')}>
          <Icon
            name="grid"
            style={{
              width: 13,
              height: 13,
              verticalAlign: '-2px',
              marginRight: 5,
            }}
          />
          Tableau
        </button>
      </div>
      {onglet === 'assistant' && (
        <AgentChatPage
          mascot="tempo"
          domain="echeances"
          conversations={[
            {
              id: 't1',
              title: 'Échéances légales du mois',
              bucket: 'hier',
            },
            {
              id: 't2',
              title: 'Relances impayés en pause',
              bucket: 'cette-semaine',
            },
          ]}
          name="Tempo — Échéances"
          title="Pilotage des délais légaux, échéances de mission et obligations"
          intro="Bonjour, je suis Tempo."
          introDetail="Je surveille vos échéances : fin de mission, convocation de l'AG, reddition, taxation, obligations réglementaires. 7 automatisations actives, 90 exécutions ce mois."
          contextSelector={{
            label: 'Copropriété',
            options: DEMO_NOMS_COPROPRIETES,
          }}
          suggestions={[
            'Quelles automatisations sont actives en ce moment ?',
            'Programme un rappel mensuel des échéances légales',
            'Quelles exécutions ont échoué cette semaine ?',
            "Mets en pause les relances d'impayés",
          ]}
        />
      )}
      {onglet === 'tableau' && (
        <>
          <PageHead
            eyebrow="Automatisations"
            title="Tableau des automatisations"
            lede="Routines planifiées — sauvegardes, relances, alertes d'échéances légales, rapports mensuels. Créez de nouvelles automatisations manuellement."
            actions={
              <button className="btn gold" onClick={() => setCreationOuverte(true)}>
                <Icon name="plus" />
                Créer une automatisation
              </button>
            }
          />
          <Kpis
            items={[
              {
                icon: 'bolt',
                num: nbActives,
                lbl: 'Automatisations actives',
                accent: 'sage',
              },
              {
                icon: 'clock',
                num: nbEnPause,
                lbl: 'En pause',
                accent: 'gold',
              },
              {
                icon: 'check',
                num: 90,
                lbl: 'Exécutions ce mois',
              },
              {
                icon: 'alert',
                num: 1,
                lbl: 'Échecs cette semaine',
                sub: 'Relance quotas 21 mai',
                accent: 'rust',
              },
            ]}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: 16,
            }}
          >
            <Panel title="Prochaines exécutions" sub="Cette semaine" icon="clock" flush>
              {PROCHAINES_EXECUTIONS.map((execution, index) => (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 20px',
                    borderBottom: '1px solid var(--line)',
                  }}
                  key={index}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: `var(--${execution.k}-500)`,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                    >
                      {execution.t}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--navy-300)',
                      }}
                    >
                      {execution.w}
                    </div>
                  </div>
                  <Pill kind={execution.k} noDot>
                    {execution.s}
                  </Pill>
                </div>
              ))}
            </Panel>
            <Panel
              title="Automatisations actives"
              sub={`${nbActives} actives · ${nbEnPause} en pause · 90 exécutions ce mois`}
              icon="bot"
              right={
                <button className="btn gold" onClick={() => setCreationOuverte(true)}>
                  <Icon name="plus" />
                  Créer
                </button>
              }
              flush
            >
              <DataTable<Automatisation>
                rowKey="id"
                columns={[
                  {
                    h: 'Nom',
                    render: (automatisation) => (
                      <b
                        style={{
                          fontWeight: 600,
                        }}
                      >
                        {automatisation.nom}
                      </b>
                    ),
                  },
                  {
                    h: 'Type',
                    render: (automatisation) => (
                      <span
                        style={{
                          fontSize: 12.5,
                          color: 'var(--navy-500)',
                        }}
                      >
                        {automatisation.type}
                      </span>
                    ),
                  },
                  {
                    h: 'Agenda',
                    render: (automatisation) => (
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--navy-300)',
                        }}
                      >
                        {automatisation.agenda}
                      </span>
                    ),
                  },
                  {
                    h: 'Dernière exéc.',
                    render: (automatisation) => automatisation.last,
                  },
                  {
                    h: 'Statut',
                    render: (automatisation) => (
                      <Pill kind={automatisation.pill} noDot>
                        {automatisation.statut}
                      </Pill>
                    ),
                  },
                  {
                    h: '',
                    style: {
                      width: 120,
                      textAlign: 'right',
                    },
                    tdStyle: {
                      textAlign: 'right',
                    },
                    render: (automatisation) => (
                      <button className="btn ghost sm" onClick={() => basculer(automatisation.id)}>
                        {automatisation.statut === 'En pause' ? 'Activer' : 'Mettre en pause'}
                      </button>
                    ),
                  },
                ]}
                rows={automatisations}
              />
            </Panel>
          </div>
          <CreerAutomatisationModal
            open={creationOuverte}
            onClose={() => setCreationOuverte(false)}
            onCreate={creer}
          />
        </>
      )}
    </>
  )
}
