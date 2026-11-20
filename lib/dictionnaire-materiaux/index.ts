// ── Dictionnaire matériaux ───────────────────────────────────────────────────
//
// « Dans telle situation, quels matériaux utiliser ? » — par situation (« infiltração em fachada ») ou
// par catégorie de matériau (silicones, espátulas…), uniquement avec des produits faciles à trouver
// dans les grandes surfaces de bricolage du pays. Deux modes dans l'écran
// (components/dashboard/DictionnaireMateriauxSection.tsx) : la recherche manuelle, sans réseau
// (`recherche.ts`), et la description en langage naturel avec photos (`ia/`, route
// app/api/dictionnaire-materiaux/analyse).
//
// Un dictionnaire par pays, jamais mélangés. Ajouter un pays : ses données sous `donnees/<pays>/`,
// ses enseignes dans `enseignes.ts`, puis l'inscrire ici et dans `disponibilite.ts`.

import { DICTIONNAIRE_PT } from './donnees/pt'
import type { Dictionnaire, Pays } from './types'

const DICTIONNAIRES: Partial<Record<Pays, Dictionnaire>> = {
  PT: DICTIONNAIRE_PT,
}

/** Dictionnaire du pays, ou `null` s'il n'existe pas encore. */
export function dictionnairePour(pays: Pays): Dictionnaire | null {
  return DICTIONNAIRES[pays] ?? null
}

/** Pays inscrits au registre (même liste que `PAYS_AVEC_DICTIONNAIRE`, vérifié par les tests). */
export function paysInscrits(): Pays[] {
  return Object.keys(DICTIONNAIRES) as Pays[]
}

export * from './types'
export * from './disponibilite'
export { enseignesDuPays, lienVersEnseigne, termeDeRecherche } from './enseignes'
export {
  rechercher,
  resoudreEtapes,
  situationsUtilisant,
  listeEnTexte,
  normaliser,
  type EtapeResolue,
  type LigneMateriau,
  type ResultatsDictionnaire,
} from './recherche'
