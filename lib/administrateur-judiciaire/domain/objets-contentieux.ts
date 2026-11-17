import { normaliserNomPersonne } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Objets de contentieux observés dans Gestéam (point 57 du bilan). Module tenu À PART du référentiel du point 29
 * (lib/data/referentiels-gesteam-judiciaire.ts, en cours de modification ailleurs) : il sera repris dans
 * REFERENTIELS_TRACABILITE quand le point 29 le permettra. Fonction pure, sans écran ni table.
 *
 * Gestéam — 🟢 lu :
 * - tranche 28 : l'Objet figure à l'en-tête de la fiche contentieux (noté « liste », jamais ouverte) et parmi les
 *   critères de la recherche ;
 * - tranche 42, fiche réelle : « Précontentieux (suivi, relance etc..) », alors que la phase saisie est « Procédure
 *   Judiciaire » (l'objet ne suit pas l'avancement de la procédure) ;
 * - tranche 43, § 5 : « Procédure en recouvrement de charges ».
 *
 * Le droit — 🟢 lu sur Légifrance le 29/10/2026 : aucune définition légale de ces deux libellés. Les seules catégories
 * lues sont l'action en recouvrement de créance et les voies d'exécution (décret n° 67-223, art. 55, al. 3) et la phase
 * qui précède la mise en demeure, d'où partent les frais imputables au seul débiteur (loi n° 65-557, art. 10-1, a).
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J34 ; question 27 de la liste) :
 * - J34 : relevé fait le 03/11/2026 dans Gestéam 5.4.23, en lecture seule (Contentieux → Recherche de contentieux) : le
 *   critère « Objet » est un champ de saisie libre, sans liste de valeurs ni flèche de choix (contrairement à Type et
 *   Phase). Gestéam n'a donc pas de référentiel des objets : l'objet reste un texte libre dans VitFix
 *   (`SaisieContentieux.objet`, jamais contraint), et ce module ne reconnaît que les libellés observés sur des fiches.
 *   `reconnaitreObjetContentieux` ne sert qu'à un futur import des contentieux Gestéam (absent de domain/import/). La
 *   question de la liste complète est fermée.
 *
 * @portee copropriete
 * @statut ECHANTILLON — 2 valeurs lues sur des fiches ; l'Objet est un texte libre (relevé du 03/11/2026, J34)
 * @source Gestéam 5.4.22 — module Contentieux (tranches 28, 42 et 43) ; Gestéam 5.4.23 — Contentieux → Recherche de
 *   contentieux (critère Objet, relevé du 03/11/2026)
 */
export const OBJETS_CONTENTIEUX_OBSERVES = [
  'Précontentieux (suivi, relance etc..)',
  'Procédure en recouvrement de charges',
] as const
export type ObjetContentieuxObserve = (typeof OBJETS_CONTENTIEUX_OBSERVES)[number]

/** Clé de comparaison : minuscules sans accents, espaces réduits, ponctuation conservée. */
const cle = (texte: string): string => normaliserNomPersonne(texte)

const OBJET_PAR_CLE = new Map<string, ObjetContentieuxObserve>(OBJETS_CONTENTIEUX_OBSERVES.map((objet) => [cle(objet), objet]))

/** Libellé Gestéam observé (casse, accents et espaces ignorés) ; null : texte libre (J34), conservé tel quel par l'appelant. */
export function reconnaitreObjetContentieux(objet: string): ObjetContentieuxObserve | null {
  return OBJET_PAR_CLE.get(cle(objet)) ?? null
}
