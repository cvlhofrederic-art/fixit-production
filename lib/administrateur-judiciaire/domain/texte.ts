/**
 * Normalisations de texte. Les quatre variantes diffèrent volontairement (casse, ponctuation) :
 * les correspondances CSV, les scores de recherche et les motifs de Fixy en dépendent.
 */

const DIACRITIQUES = /[̀-ͯ]/g

/** Majuscules sans accents, ponctuation → espace (en-têtes CSV, libellés bancaires). */
export const normaliserTexte = (texte: string): string =>
  texte.normalize('NFD').replace(DIACRITIQUES, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Minuscules sans accents, espaces réduits ; la ponctuation est conservée. */
export const normaliserNomPersonne = (texte: string): string =>
  texte.normalize('NFD').replace(DIACRITIQUES, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Minuscules sans accents, rien d'autre. */
export const sansAccentsMinuscules = (texte: string): string =>
  texte.normalize('NFD').replace(DIACRITIQUES, '').toLowerCase()

/** Minuscules sans accents, apostrophes/tirets/ponctuation → espace (« 19-2 » → « 19 2 »). */
export const normaliserTexteLibre = (texte: string): string =>
  texte.normalize('NFD').replace(DIACRITIQUES, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
