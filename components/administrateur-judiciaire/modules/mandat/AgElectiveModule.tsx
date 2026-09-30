'use client'

import { useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { CalculateurMajorite } from '@/components/administrateur-judiciaire/modules/mandat/CalculateurMajorite'
import { Alert } from '@/components/administrateur-judiciaire/ui/Alert'
import { FormModal } from '@/components/administrateur-judiciaire/ui/FormModal'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { PageHead } from '@/components/administrateur-judiciaire/ui/PageHead'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import { listerCoproprietairesCopropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/** État d'une étape de la convocation : faite, en cours ou à venir. */
export type EtatEtapeConvocation = 'done' | 'current' | 'pending'

/** Étape de la convocation de l'AG élective : numéro, titre, détail et état. */
export interface EtapeConvocationAg {
  n: string
  t: string
  d: string
  st: EtatEtapeConvocation
}

/** Étapes de démonstration (Le Clos des Vignes), figées. */
const ETAPES_CONVOCATION_AG: EtapeConvocationAg[] = [
  {
    n: '1',
    t: 'Vérification du périmètre',
    d: 'Liste des copropriétaires & tantièmes à jour',
    st: 'done',
  },
  {
    n: '2',
    t: "Projet d'ordre du jour",
    d: 'Désignation du syndic en tête (art. 25)',
    st: 'current',
  },
  {
    n: '3',
    t: 'Convocation (21 j francs min.)',
    d: 'Envoi LRAR / voie électronique',
    st: 'pending',
  },
  {
    n: '4',
    t: "Tenue de l'AG",
    d: 'Vote de désignation du syndic',
    st: 'pending',
  },
  {
    n: '5',
    t: 'PV & transfert de gestion',
    d: 'Remise au syndic élu',
    st: 'pending',
  },
]

/**
 * Assemblée générale élective : indicateurs et étapes figés (Le Clos des Vignes), calculateur de majorité alimenté par
 * la base locale (tantièmes du premier lot et nombre de copropriétaires de la copropriété sélectionnée, « CV » à défaut),
 * projet d'ordre du jour et formulaire de convocation simulé.
 */
export function AgElectiveModule() {
  const donnees = useDonneesLocales(),
    codeSelectionne = useSelectionDossier((etat) => etat.code),
    copro = donnees.copros.find((vue) => vue.code === (codeSelectionne || 'CV')),
    personnes = copro ? listerCoproprietairesCopropriete(copro, donnees.lots, donnees.coproprietaires) : [],
    premierLot = copro ? donnees.lots.find((lot) => lot.coproprieteId === copro.id) : null,
    baseCalcul = {
      voix: (premierLot && premierLot.tantiemes && premierLot.tantiemes.denominateur) || 10000,
      membres: personnes.length,
      source: copro
        ? `${copro.nom} · ${personnes.length} copropriétaire${personnes.length > 1 ? 's' : ''} enregistré${personnes.length > 1 ? 's' : ''}`
        : 'valeurs par défaut',
    },
    { push } = useToast(),
    [convocationOuverte, setConvocationOuverte] = useState(false)
  return (
    <>
      <PageHead
        eyebrow="Mission essentielle du syndic judiciaire"
        title="Assemblée générale élective"
        lede="Convocation de l'AG appelée à désigner un syndic — au plus tard deux mois avant la fin de la mission (art. 17 loi 1965)."
        actions={
          <>
            <button
              className="btn"
              onClick={() =>
                push({
                  kind: 'info',
                  title: 'Ordre du jour',
                  desc: "Aperçu du projet d'ordre du jour",
                })
              }
            >
              <Icon name="doc" />
              Ordre du jour
            </button>
            <button className="btn gold" onClick={() => setConvocationOuverte(true)}>
              <Icon name="bank" />
              {"Convoquer l'AG"}
            </button>
          </>
        }
      />
      <Kpis
        items={[
          {
            icon: 'bank',
            num: '22/07',
            lbl: 'Échéance de mission',
            sub: 'Le Clos des Vignes (2026)',
            accent: 'amber',
          },
          {
            icon: 'calendar',
            num: '22/05',
            lbl: 'Convoquer avant le',
            sub: '2 mois avant la fin',
            accent: 'rust',
            trend: {
              kind: 'bad',
              label: 'J-18',
            },
          },
          {
            icon: 'users',
            num: 48,
            lbl: 'Copropriétaires à convoquer',
            sub: '48 lots · LRAR / électronique',
          },
          {
            icon: 'scale',
            num: 'Art. 25',
            lbl: 'Majorité de désignation',
            sub: 'puis 25-1, 24',
            accent: 'sage',
          },
        ]}
      />
      <CalculateurMajorite voixTotales={baseCalcul.voix} membresTotaux={baseCalcul.membres} source={baseCalcul.source} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 16,
        }}
      >
        <Panel title="Étapes de la convocation" sub="Le Clos des Vignes — AG élective" icon="calendar">
          <div
            className="canal-progress"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {ETAPES_CONVOCATION_AG.map((etape, index) => (
              <div
                className={`canal-progress-step state-${etape.st === 'done' ? 'done' : etape.st === 'current' ? 'current' : 'pending'}`}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: '12px 0',
                  borderBottom: index < ETAPES_CONVOCATION_AG.length - 1 ? '1px solid var(--line)' : 'none',
                  alignItems: 'flex-start',
                }}
                key={index}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    background:
                      etape.st === 'done'
                        ? 'var(--sage-500)'
                        : etape.st === 'current'
                          ? 'var(--gold-500)'
                          : 'var(--cream)',
                    color: etape.st === 'pending' ? 'var(--navy-300)' : '#fff',
                  }}
                >
                  {etape.st === 'done' ? '✓' : etape.n}
                </span>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13.5,
                    }}
                  >
                    {etape.t}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--navy-300)',
                    }}
                  >
                    {etape.d}
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: 'auto',
                  }}
                >
                  {etape.st === 'current' && <Pill kind="gold">En cours</Pill>}
                  {etape.st === 'done' && <Pill kind="sage">Fait</Pill>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Projet d'ordre du jour"
          icon="doc"
          right={
            <button
              className="btn ghost sm"
              onClick={() =>
                push({
                  kind: 'success',
                  title: 'Simulation',
                  desc: "L'ordre du jour n'est pas enregistré dans cette version.",
                })
              }
            >
              Modifier
            </button>
          }
        >
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.9,
            }}
          >
            <li>
              <b>Désignation du syndic</b>
              {' (art. 25) — candidatures'}
            </li>
            <li>Fixation de la durée du mandat et des honoraires</li>
            <li>Approbation des comptes de la période judiciaire</li>
            <li>Quitus au syndic judiciaire</li>
            <li>{"Vote du budget prévisionnel de l'exercice"}</li>
            <li>Renouvellement du conseil syndical</li>
            <li>Questions diverses</li>
          </ol>
          <Alert
            kind="info"
            icon="scale"
            title="La désignation du syndic est portée en tête de l'ordre du jour, conformément à l'objet de la mission."
          />
        </Panel>
      </div>
      <FormModal
        open={convocationOuverte}
        onClose={() => setConvocationOuverte(false)}
        title="Convoquer l'AG élective"
        icon="bank"
        fields={[
          {
            label: 'Copropriété',
            type: 'select',
            options: DEMO_NOMS_COPROPRIETES,
            required: true,
            full: true,
          },
          {
            label: "Date de l'assemblée",
            type: 'date',
            required: true,
          },
          {
            label: 'Lieu',
            placeholder: 'Salle / visioconférence',
          },
          {
            label: "Mode d'envoi",
            type: 'select',
            options: ['LRAR', 'Voie électronique (accord exprès)', 'Remise contre émargement'],
          },
          {
            label: 'Délai de convocation',
            value: '21 jours francs',
            hint: 'Délai minimal légal',
          },
          {
            label: 'Observations',
            type: 'textarea',
            full: true,
            placeholder: "Précisions sur l'ordre du jour…",
          },
        ]}
        submitLabel="Générer la convocation"
        onDone={() =>
          push({
            kind: 'success',
            title: 'Simulation',
            desc: "Aucune convocation n'est générée ni envoyée dans cette version.",
          })
        }
      />
    </>
  )
}
