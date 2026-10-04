'use client'

import {
  DEMO_COPROPRIETES,
  DEMO_TOTAL_BUDGET,
  DEMO_TOTAL_DEPENSES,
  DEMO_TOTAL_IMPAYES,
  DEMO_TOTAL_LOTS,
} from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_OBLIGATIONS } from '@/components/administrateur-judiciaire/data/obligations'
import { naviguerVers } from '@/components/administrateur-judiciaire/shell/navigation'
import { surActivationClavier } from '@/components/administrateur-judiciaire/ui/clavier'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Kpis } from '@/components/administrateur-judiciaire/ui/Kpis'
import { Panel } from '@/components/administrateur-judiciaire/ui/Panel'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast, type OptionsToast } from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros, pourcentageBorne } from '@/lib/administrateur-judiciaire/domain/format'
import { AUJOURDHUI } from '@/lib/administrateur-judiciaire/mode'

/** Identifiant d'une action rapide du tableau de bord. */
export type IdActionRapide = 'ag' | 'fees' | 'os' | 'notif'

/** Action rapide : titre, précision et toast d'information affiché au clic (aucune action réelle). */
export interface ActionRapide {
  id: IdActionRapide
  titre: string
  precision: string
  toast: OptionsToast
}

/**
 * Actions rapides. La maquette y ajoutait un tracé SVG inutilisé (celui de « fees » était même vidé par un
 * replace) : il n'est pas repris, les pictogrammes venant de ICONES_ACTIONS_RAPIDES.
 */
const ACTIONS_RAPIDES: readonly ActionRapide[] = [
  {
    id: 'ag',
    titre: 'Convoquer une AG élective',
    precision: "Désignation d'un syndic",
    toast: {
      kind: 'info',
      title: "Convocation d'AG",
      desc: "Ouverture de l'assistant de convocation",
    },
  },
  {
    id: 'fees',
    titre: 'Établir un état de frais',
    precision: 'Taxation — CPC 704-718',
    toast: {
      kind: 'info',
      title: 'État de frais',
      desc: "Nouveau bordereau d'honoraires",
    },
  },
  {
    id: 'os',
    titre: 'Enregistrer une intervention',
    precision: 'Ordre de service',
    toast: {
      kind: 'info',
      title: 'Ordre de service',
      desc: "Création d'un ordre de service",
    },
  },
  {
    id: 'notif',
    titre: 'Notifier une ordonnance',
    precision: 'Art. 59 ou 62-5 du décret 1967',
    toast: {
      kind: 'info',
      title: 'Notification',
      desc: 'Assistant de notification aux copropriétaires',
    },
  },
]

/** Pictogramme de chaque action rapide. */
const ICONES_ACTIONS_RAPIDES: Record<IdActionRapide, string> = {
  ag: 'bank',
  fees: 'coin',
  os: 'clipboard',
  notif: 'doc',
}

/** Teintes de départ et d'arrivée du dégradé de chaque copropriété, par rang (quatre au plus). */
const TEINTES_DEBUT_DEGRADE = ['sage-700', 'gold-600', 'rust-700', 'amber-700']
const TEINTES_FIN_DEGRADE = ['sage-500', 'gold-500', 'rust-500', 'amber-500']

/**
 * Dégradé de la copropriété de rang `index` (légende et barre de répartition). Comme dans la maquette, au-delà de
 * quatre copropriétés la variable CSS devient « --undefined ».
 */
const degradeCopropriete = (index: number): string =>
  `linear-gradient(90deg, var(--${TEINTES_DEBUT_DEGRADE[index]}), var(--${TEINTES_FIN_DEGRADE[index]}))`

/** Style commun des surtitres des totaux budgétaires. */
const STYLE_SURTITRE_TOTAL = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--navy-300)',
  fontWeight: 600,
} as const

/**
 * Tableau de bord (démonstration, données statiques) : accueil du cabinet, actions rapides, indicateurs, suivi
 * budgétaire cumulé, échéances prioritaires et état des mandats. Sert aussi d'écran de repli du shell pour toute
 * route inconnue. Plusieurs chiffres sont codés en dur (48 j, 65 k €, « 4 mandats actifs »…).
 */
export function TableauDeBordModule() {
  const { push } = useToast()

  return (
    <>
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div className="date-line">
              {new Intl.DateTimeFormat('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(AUJOURDHUI)}
            </div>
            <h1>
              {'Bonjour, '}
              <i>Cabinet Delaunay</i>
            </h1>
            <div className="lede">
              {
                'Portefeuille des mandats judiciaires — copropriétés administrées par désignation du Tribunal judiciaire de Nanterre. Suivi des missions, échéances et état opérationnel.'
              }
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <Pill kind="sage">4 mandats actifs</Pill>
              <Pill kind="amber">1 AG élective à convoquer</Pill>
              <Pill kind="rust">1 reddition due</Pill>
            </div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="label">Lots sous mandat</div>
            <div className="val">{DEMO_TOTAL_LOTS}</div>
            <div className="sub-stat">en 4 copropriétés</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="label">Échéance la + proche</div>
            <div className="val">
              {'48'}
              <span className="cur">{' j'}</span>
            </div>
            <div className="sub-stat">Clos des Vignes · AG</div>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <div className="label">Impayés à recouvrer</div>
            <div className="val">
              {'65'}
              <span className="cur">k €</span>
            </div>
            <div className="sub-stat">5 copropriétaires</div>
          </div>
        </div>
      </div>
      <div className="section-eyebrow">
        <span>Actions rapides</span>
        <div className="line" />
      </div>
      <div className="quick">
        {ACTIONS_RAPIDES.map((action) => (
          <button type="button" className="qa" onClick={() => push(action.toast)} key={action.id}>
            <div className="ico">
              <Icon name={ICONES_ACTIONS_RAPIDES[action.id]} />
            </div>
            <div>
              <b>{action.titre}</b>
              <span>{action.precision}</span>
            </div>
            <svg
              className="arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="14"
              height="14"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
      <Kpis
        items={[
          {
            icon: 'building',
            num: 4,
            lbl: 'Copropriétés sous mandat',
            sub: `${DEMO_TOTAL_LOTS} lots · TJ Nanterre`,
            trend: {
              kind: 'flat',
              label: 'stable',
            },
          },
          {
            icon: 'scale',
            num: 10,
            lbl: 'Échéances de conformité',
            sub: '3 urgentes · 1 critique',
            accent: 'amber',
            trend: {
              kind: 'warn',
              label: '3 à traiter',
            },
          },
          {
            icon: 'coin',
            num: formatEuros(DEMO_TOTAL_IMPAYES),
            lbl: 'Impayés à recouvrer',
            sub: '5 copropriétaires · 1 contentieux',
            accent: 'rust',
            trend: {
              kind: 'bad',
              label: 'recouvrement',
            },
          },
          {
            icon: 'clock',
            num: '48',
            suffix: 'jours',
            lbl: 'Mission la plus proche',
            sub: 'Clos des Vignes · 22/07/2026',
            accent: 'amber',
            trend: {
              kind: 'warn',
              label: 'AG à convoquer',
            },
          },
        ]}
      />
      <Panel
        title="Suivi budgétaire cumulé — Exercice 2026"
        sub="Répartition par copropriété · charges engagées vs budget prévisionnel"
        right={
          <>
            <Pill kind="sage">À jour</Pill>
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
          </>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr 1fr 1.2fr',
            gap: 32,
            alignItems: 'flex-end',
            marginBottom: 22,
          }}
        >
          <div>
            <div style={STYLE_SURTITRE_TOTAL}>Budgets cumulés</div>
            <div
              style={{
                fontFamily: 'Cormorant Garamond,serif',
                fontSize: 34,
                marginTop: 6,
              }}
            >
              {formatEuros(DEMO_TOTAL_BUDGET)}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--navy-300)',
                marginTop: 4,
              }}
            >
              4 copropriétés
            </div>
          </div>
          <div>
            <div style={STYLE_SURTITRE_TOTAL}>Charges engagées</div>
            <div
              style={{
                fontFamily: 'Cormorant Garamond,serif',
                fontSize: 34,
                marginTop: 6,
                color: 'var(--rust-700)',
              }}
            >
              {formatEuros(DEMO_TOTAL_DEPENSES)}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--navy-300)',
                marginTop: 4,
              }}
            >
              {Math.round(pourcentageBorne(DEMO_TOTAL_DEPENSES, DEMO_TOTAL_BUDGET))}
              {'% consommé'}
            </div>
          </div>
          <div>
            <div style={STYLE_SURTITRE_TOTAL}>Disponible</div>
            <div
              style={{
                fontFamily: 'Cormorant Garamond,serif',
                fontSize: 34,
                marginTop: 6,
                color: 'var(--sage-700)',
              }}
            >
              {formatEuros(DEMO_TOTAL_BUDGET - DEMO_TOTAL_DEPENSES)}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--navy-300)',
                marginTop: 4,
              }}
            >
              Solde prévisionnel
            </div>
          </div>
          <div>
            <div style={STYLE_SURTITRE_TOTAL}>Fonds de travaux</div>
            <div
              style={{
                fontFamily: 'Cormorant Garamond,serif',
                fontSize: 22,
                marginTop: 6,
                color: 'var(--navy-700)',
              }}
            >
              {formatEuros(DEMO_COPROPRIETES.reduce((total, copro) => total + copro.fondsTravaux, 0))}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--amber-700)',
                marginTop: 4,
              }}
            >
              loi ALUR · 1 sous-doté
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 18,
            fontSize: 11.5,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          {DEMO_COPROPRIETES.map((copro, index) => (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              key={copro.id}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: degradeCopropriete(index),
                }}
              />
              {copro.nom}
              {' · '}
              {formatEuros(copro.depense)}
            </span>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            height: 12,
            borderRadius: 6,
            overflow: 'hidden',
            background: 'var(--cream)',
            border: '1px solid var(--line)',
          }}
        >
          {DEMO_COPROPRIETES.map((copro, index) => (
            <div
              style={{
                flex: copro.depense,
                background: degradeCopropriete(index),
              }}
              key={copro.id}
            />
          ))}
          <div
            style={{
              flex: Math.max(1, DEMO_TOTAL_BUDGET - DEMO_TOTAL_DEPENSES),
            }}
          />
        </div>
      </Panel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.25fr',
          gap: 16,
        }}
      >
        <Panel
          title="Échéances prioritaires"
          icon="scale"
          right={
            <a
              style={{
                fontSize: 12,
                color: 'var(--gold-700)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => {
                naviguerVers('obligations')
              }}
              onKeyDown={surActivationClavier(() => naviguerVers('obligations'))}
              role="link"
              tabIndex={0}
            >
              Voir tout →
            </a>
          }
          flush
        >
          {DEMO_OBLIGATIONS.filter((obligation) => obligation.pill === 'rust' || obligation.pill === 'amber')
            .slice(0, 4)
            .map((obligation, index) => {
              const afficherObligation = () =>
                push({
                  kind: 'info',
                  title: obligation.objet,
                  desc: `${obligation.copro} · ${obligation.base}`,
                })
              return (
                <div
                  className="list-row"
                  onClick={afficherObligation}
                  onKeyDown={surActivationClavier(afficherObligation)}
                  role="button"
                  tabIndex={0}
                  key={index}
                >
                  <div className="thumb">
                    {obligation.copro
                      .split(' ')
                      .map((mot) => mot[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="info">
                    <b>{obligation.objet}</b>
                    <div className="meta">
                      <span>{obligation.copro}</span>
                      <span className="dot" />
                      <span>{obligation.date}</span>
                    </div>
                  </div>
                  <div />
                  <Pill kind={obligation.pill}>{obligation.statut}</Pill>
                </div>
              )
            })}
        </Panel>
        <Panel
          title="État des mandats"
          icon="clipboard"
          right={
            <a
              style={{
                fontSize: 12,
                color: 'var(--gold-700)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => {
                naviguerVers('mandats')
              }}
              onKeyDown={surActivationClavier(() => naviguerVers('mandats'))}
              role="link"
              tabIndex={0}
            >
              Voir les ordonnances →
            </a>
          }
          flush
        >
          {DEMO_COPROPRIETES.map((copro) => (
            <div
              className="list-row"
              onClick={() => {
                naviguerVers('mandats')
              }}
              onKeyDown={surActivationClavier(() => naviguerVers('mandats'))}
              role="button"
              tabIndex={0}
              key={copro.id}
            >
              <div className="thumb">{copro.code}</div>
              <div className="info">
                <b>{copro.nom}</b>
                <div className="meta">
                  <span>{copro.fondement}</span>
                  <span className="dot" />
                  <span
                    style={{
                      color: 'var(--navy-500)',
                      fontWeight: 500,
                    }}
                  >
                    {copro.lots}
                    {' lots'}
                  </span>
                  <span className="dot" />
                  <span>
                    {'fin '}
                    {copro.echeance}
                  </span>
                </div>
              </div>
              <div />
              <Pill kind={copro.pill}>{copro.statut}</Pill>
            </div>
          ))}
        </Panel>
      </div>
    </>
  )
}
