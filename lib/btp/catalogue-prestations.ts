/**
 * Catalogue de prestations et matériaux d'une société BTP (pro_societe), tenu par le module Prestations
 * (components/dashboard/PrestationsBTPSection.tsx) dans le navigateur, recopié sur le serveur par le miroir du
 * stockage (lib/storage-sync.ts, table user_storage). Le formulaire de devis et facture BTP
 * (components/DevisFactureFormBTP.tsx) le lit sans jamais l'écrire.
 *
 * Constat stockage-local-miroir-10 de l'audit du 11/11/2026 : le formulaire lisait une ancienne copie (clé v4)
 * qu'il remplissait lui-même du jeu par défaut. Aucune clé n'est supprimée ni remplacée : on lit au bon endroit.
 */

/** Clé du catalogue tenu par le module Prestations depuis le 16/04/2026. */
export const cleCatalogueBTP = (artisanId: string): string => `fixit_prestations_btp_v5_${artisanId}`

/**
 * Ancienne clé : le module ne l'écrit plus depuis le 16/04/2026, le formulaire y recopiait le jeu par défaut. Lue
 * en repli tant que le module n'a rien enregistré, jamais écrite ni supprimée.
 */
export const cleCatalogueBTPAncienne = (artisanId: string): string => `fixit_prestations_btp_v4_${artisanId}`

export type LectureLocale<T> =
  | { etat: 'present'; catalogue: T[] }
  | { etat: 'absent' }
  /** Stockage illisible (bloqué par le navigateur) ou valeur qui n'est pas une liste. */
  | { etat: 'illisible' }

/** Catalogue enregistré sous `cle` dans ce navigateur. Ne lève jamais. */
export function lireCatalogueLocal<T>(cle: string): LectureLocale<T> {
  // Rendu côté serveur : pas de stockage à lire.
  if (typeof window === 'undefined') return { etat: 'illisible' }
  let brut: string | null
  try {
    brut = window.localStorage.getItem(cle)
  } catch (erreur) {
    console.warn('[catalogue BTP] stockage du navigateur illisible :', erreur)
    return { etat: 'illisible' }
  }
  if (brut === null) return { etat: 'absent' }
  try {
    const valeur: unknown = JSON.parse(brut)
    if (Array.isArray(valeur)) return { etat: 'present', catalogue: valeur as T[] }
    console.warn('[catalogue BTP] valeur enregistrée qui n\'est pas une liste :', cle)
  } catch (erreur) {
    console.warn('[catalogue BTP] valeur enregistrée illisible :', cle, erreur)
  }
  return { etat: 'illisible' }
}

/**
 * Catalogue proposé par le formulaire de devis et facture : celui du module (clé v5), à défaut l'ancienne copie
 * (clé v4), à défaut le jeu par défaut en mémoire. Rien n'est écrit. Sans fiche, ou si la valeur trouvée est
 * illisible, aucun catalogue (comme avant, où la lecture en échec ne proposait rien) ; un élément qui n'est pas un
 * objet est écarté.
 */
export function lireCatalogueBTPNavigateur<T>(artisanId: string | null | undefined, parDefaut: () => T[]): T[] {
  if (!artisanId) return []
  for (const cle of [cleCatalogueBTP(artisanId), cleCatalogueBTPAncienne(artisanId)]) {
    const lecture = lireCatalogueLocal<T>(cle)
    if (lecture.etat === 'present') return lecture.catalogue.filter((element) => typeof element === 'object' && element !== null)
    if (lecture.etat === 'illisible') return []
  }
  return parDefaut()
}
