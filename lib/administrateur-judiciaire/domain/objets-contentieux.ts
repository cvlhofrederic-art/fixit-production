import { normaliserNomPersonne } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Objets de contentieux observés dans Gestéam (point 57 du bilan). Module tenu À PART du référentiel du point 29
 * (lib/data/referentiels-gesteam-judiciaire.ts, en cours de modification ailleurs) : il sera repris dans
 * REFERENTIELS_TRACABILITE quand le point 29 le permettra. Fonction pure, sans écran ni table.
 *
 * Gestéam — 🟢 lu :
 * - tranche 28 : l'Objet est une liste de la fiche contentieux et un critère de la recherche ;
 * - tranche 42, fiche réelle : « Précontentieux (suivi, relance etc..) », alors que la phase saisie est « Procédure
 *   Judiciaire » (l'objet ne suit pas l'avancement de la procédure) ;
 * - tranche 43, § 5 : « Procédure en recouvrement de charges ».
 * La liste n'a jamais été ouverte (risque de passage en modification) : elle est PARTIELLE.
 *
 * Le droit — 🟢 lu sur Légifrance le 29/10/2026 : aucune définition légale de ces deux libellés. Les seules catégories
 * lues sont l'action en recouvrement de créance et les voies d'exécution (décret n° 67-223, art. 55, al. 3) et la phase
 * qui précède la mise en demeure, d'où partent les frais imputables au seul débiteur (loi n° 65-557, art. 10-1, a).
 *
 * 🔵 Déduit : `SaisieContentieux.objet` reste un texte libre, non contraint tant que la liste est partielle ;
 * `reconnaitreObjetContentieux` ne sert qu'à un futur import des contentieux Gestéam (absent de domain/import/).
 * 🔴 Non établi : (Hugo) peut-on relever la liste complète des Objets en lecture seule depuis le critère Objet de la
 * recherche des contentieux (tranche 28) ?
 *
 * @portee copropriete
 * @statut ECHANTILLON — 2 valeurs lues sur des fiches, liste jamais ouverte
 * @source Gestéam 5.4.22 — module Contentieux (tranches 28, 42 et 43)
 */
export const OBJETS_CONTENTIEUX_OBSERVES = [
  'Précontentieux (suivi, relance etc..)',
  'Procédure en recouvrement de charges',
] as const
export type ObjetContentieuxObserve = (typeof OBJETS_CONTENTIEUX_OBSERVES)[number]

/** Clé de comparaison : minuscules sans accents, espaces réduits, ponctuation conservée. */
const cle = (texte: string): string => normaliserNomPersonne(texte)

const OBJET_PAR_CLE = new Map<string, ObjetContentieuxObserve>(OBJETS_CONTENTIEUX_OBSERVES.map((objet) => [cle(objet), objet]))

/** Libellé Gestéam reconnu (casse, accents et espaces ignorés) ; null : texte libre, conservé tel quel par l'appelant. */
export function reconnaitreObjetContentieux(objet: string): ObjetContentieuxObserve | null {
  return OBJET_PAR_CLE.get(cle(objet)) ?? null
}
