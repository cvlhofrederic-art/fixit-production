import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import * as hooks from '@/lib/administrateur-judiciaire/db/hooks'
import { ALPHABET_IDENTIFIANTS, genererId } from '@/lib/administrateur-judiciaire/db/ids'
import * as repositories from '@/lib/administrateur-judiciaire/db/repositories'
import { creerRepository, journaliserActivite, type Repository } from '@/lib/administrateur-judiciaire/db/repository'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type EntiteEnregistree } from '@/lib/administrateur-judiciaire/db/schema'
import * as seedDemo from '@/lib/administrateur-judiciaire/db/seed-demo'
import * as useEcheances from '@/lib/administrateur-judiciaire/db/use-echeances'
import * as useFiches360 from '@/lib/administrateur-judiciaire/db/use-fiches-360'
import { useIndexRecherche } from '@/lib/administrateur-judiciaire/db/use-index-recherche'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { rejouerOracle, type CasOracle } from './oracle'
import fixturePure from './fixtures/base-locale.json'

/**
 * Non-régression « oracle » de l'unité « Base locale Dexie (db/) ».
 *
 * 1. Fonctions pures du seed (ancienneté des notifications, tantièmes) : fixture base-locale.json (proto/fixture.mjs).
 * 2. Scénarios sur la base (fake-indexeddb) : fixture base-locale-scenarios.json. Chaque scénario est du JavaScript
 *    qui n'utilise que l'adaptateur X ci-dessous ; il a été exécuté tel quel sur la maquette d'origine (même prélude,
 *    X construit sur ses définitions minifiées, hooks rendus une fois hors composant) et son résultat normalisé enregistré.
 *    Le prélude remplace crypto.getRandomValues par un générateur à graine : les identifiants aléatoires (mandats, lots,
 *    journal d'activité…) sont donc identiques des deux côtés si les appels à genererId se font dans le même ordre.
 *    Les horodatages « maintenant » (createdAt, updatedAt, quand) sont masqués.
 * Couvert : schéma (tables, index, version), seed de démonstration complet (tables et journal), gardes du seed
 * (mode réel, base déjà remplie), repositories (list/get/create/update/remove, erreurs, journal), store des données
 * (chargement, garde, erreurs, et chaque action d'écriture), et tous les hooks de lecture (chargé, en chargement,
 * en erreur, base vide, données orphelines).
 * Non couvert (écart voulu) : deux initialiserBaseDemo concurrents partagent une seule exécution dans le portage (la maquette
 * dupliquerait les lots) ; passerEnModeReel / restaurerDemonstration rechargent la page.
 */

describe('base locale — fonctions pures du seed (oracle)', () => {
  rejouerOracle({ ...seedDemo }, fixturePure as CasOracle[])
})

type RepositoryGenerique = Repository<EntiteEnregistree>

const REPOSITORIES: Record<string, RepositoryGenerique> = {
  cabinets: repositories.repoCabinets,
  societes: repositories.repoSocietes,
  utilisateurs: repositories.repoUtilisateurs,
  roles: repositories.repoRoles,
  mandats: repositories.repoMandats,
  coproprietes: repositories.repoCoproprietes,
  immeubles: repositories.repoImmeubles,
  batiments: repositories.repoBatiments,
  cages: repositories.repoCages,
  lots: repositories.repoLots,
  coproprietaires: repositories.repoCoproprietaires,
  occupants: repositories.repoOccupants,
  prestataires: repositories.repoPrestataires,
  contrats: repositories.repoContrats,
  assurances: repositories.repoAssurances,
  comptes: repositories.repoComptes,
  exercices: repositories.repoExercices,
  journaux: repositories.repoJournaux,
  ecritures: repositories.repoEcritures,
  factures: repositories.repoFactures,
  reglements: repositories.repoReglements,
  budgets: repositories.repoBudgets,
  appelsDeFonds: repositories.repoAppelsDeFonds,
  impayes: repositories.repoImpayes,
  fondsTravaux: repositories.repoFondsTravaux,
  banques: repositories.repoBanques,
  rapprochements: repositories.repoRapprochements,
  ags: repositories.repoAgs,
  resolutions: repositories.repoResolutions,
  procurations: repositories.repoProcurations,
  presences: repositories.repoPresences,
  travaux: repositories.repoTravaux,
  devis: repositories.repoDevis,
  interventions: repositories.repoInterventions,
  sinistres: repositories.repoSinistres,
  documents: repositories.repoDocuments,
  taches: repositories.repoTaches,
  echeances: repositories.repoEcheances,
  notifications: repositories.repoNotifications,
}

const HOOKS: Record<string, (...args: never[]) => unknown> = {
  useCoproprietes: hooks.useCoproprietes,
  usePrestataires: hooks.usePrestataires,
  useCoproprietesAffichees: hooks.useCoproprietesAffichees,
  useTrouverCopro: hooks.useTrouverCopro,
  useCoproParCode: hooks.useCoproParCode,
  useDonneesLocales: hooks.useDonneesLocales,
  useEcheancesMandat: useEcheances.useEcheancesMandat,
  useEcheancesPortefeuille: useEcheances.useEcheancesPortefeuille,
  useObligationsPortefeuille: useEcheances.useObligationsPortefeuille,
  useFiche360Copropriete: useFiches360.useFiche360Copropriete,
  useFiche360Personne: useFiches360.useFiche360Personne,
  useIndexRecherche,
}

/** Adaptateur X côté portage : mêmes primitives que l'adaptateur de la maquette (scratchpad dbtest/generer.mjs). */
const X = {
  db: ajDb,
  store: useDonneesStore,
  seed: seedDemo.initialiserBaseDemo,
  vider: viderBaseLocale,
  cleMode: CLE_STOCKAGE_MODE,
  repo(table: string): RepositoryGenerique {
    const repo = REPOSITORIES[table]
    if (!repo) throw new Error(`Repository porté introuvable : ${table}`)
    return repo
  },
  creerRepository,
  journaliser: journaliserActivite,
  genererId,
  ALPHABET: ALPHABET_IDENTIFIANTS,
  INSTANT_REFERENCE_DEMO: seedDemo.INSTANT_REFERENCE_DEMO,
  dateDepuisAncienneteDemo: seedDemo.dateDepuisAncienneteDemo,
  decomposerTantiemesDemo: seedDemo.decomposerTantiemesDemo,
  /** Rendu unique du hook (effets compris), valeur renvoyée par ce rendu. */
  async hook(nom: string, ...args: unknown[]): Promise<unknown> {
    const hook = HOOKS[nom] as ((...a: unknown[]) => unknown) | undefined
    if (!hook) throw new Error(`Hook porté introuvable : ${nom}`)
    const { result, unmount } = renderHook(() => hook(...args))
    const valeur = result.current
    unmount()
    return valeur
  },
}

interface Scenario {
  id: string
  code: string
  attendu: unknown
}

// Fixture de plusieurs centaines de Ko : lue à l'exécution plutôt qu'importée (inférence de type épargnée à tsc).
const scenarios = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'base-locale-scenarios.json'), 'utf8')) as {
  prelude: string
  cas: Scenario[]
}

/** Même composition que sur la maquette : prélude, puis le code du scénario, résultat normalisé par le prélude. */
function executerScenario(code: string): Promise<unknown> {
  // Code de la fixture, exécuté tel quel comme il l'a été sur la maquette d'origine.
  const scenario = new Function(
    'X',
    `return (async () => {\n${scenarios.prelude}\nreturn normaliser(await (async () => {\n${code}\n})())\n})()`,
  ) as (x: typeof X) => Promise<unknown>
  return scenario(X)
}

describe('base locale — scénarios sur la base, le store et les hooks (oracle)', () => {
  for (const scenario of scenarios.cas) {
    it(scenario.id, async () => {
      expect(await executerScenario(scenario.code)).toEqual(scenario.attendu)
    })
  }
})
