// Enseignes de bricolage par pays, et lien vers la recherche de chacune.
//
// Les liens mènent à la page de recherche du magasin pour un terme générique : une adresse de
// produit vieillit (référence retirée, page renommée), une recherche reste juste.
// Adresses ouvertes dans un navigateur le 15/11/2026 :
// - Leroy Merlin Portugal : https://www.leroymerlin.pt/search?q=<terme> (page « Pesquisa Leroy Merlin ») ;
// - Maxmat : https://www.maxmat.pt/pt/?term=<terme>. La recherche de Maxmat est un panneau de la page, qui s'ouvre
//   de lui-même quand l'adresse porte `term` ; la page /pt/pesquisa_36.html visée par son formulaire est vide.

import type { Enseigne, IdEnseigne, Materiau, Pays } from './types'

/** Terme à passer à la recherche d'une enseigne pour ce matériau : le sien si elle nomme le produit autrement. */
export function termeDeRecherche(materiau: Pick<Materiau, 'recherche' | 'rechercheEnseigne'>, enseigne: IdEnseigne): string {
  return materiau.rechercheEnseigne?.[enseigne]?.trim() || materiau.recherche
}

/** Adresse de la recherche de l'enseigne pour ce matériau. */
export function lienVersEnseigne(enseigne: Enseigne, materiau: Pick<Materiau, 'recherche' | 'rechercheEnseigne'>): string {
  return enseigne.lienRecherche(termeDeRecherche(materiau, enseigne.id))
}

const LEROY_MERLIN_PT: Enseigne = {
  id: 'leroy-merlin',
  nom: 'Leroy Merlin',
  lienRecherche: (terme) => `https://www.leroymerlin.pt/search?q=${encodeURIComponent(terme.trim())}`,
}

const MAXMAT_PT: Enseigne = {
  id: 'maxmat',
  nom: 'Maxmat',
  lienRecherche: (terme) => `https://www.maxmat.pt/pt/?term=${encodeURIComponent(terme.trim())}`,
}

const ENSEIGNES: Record<Pays, Enseigne[]> = {
  PT: [LEROY_MERLIN_PT, MAXMAT_PT],
  FR: [],
}

export function enseignesDuPays(pays: Pays): Enseigne[] {
  return ENSEIGNES[pays]
}

/** Domaine du site de chaque enseigne, par pays : sert à contrôler les preuves du catalogue. */
export const DOMAINES_ENSEIGNES: Record<Pays, Partial<Record<IdEnseigne, string>>> = {
  PT: { 'leroy-merlin': 'leroymerlin.pt', maxmat: 'maxmat.pt' },
  FR: {},
}
