import { regimeDepuisFondement, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * En-tête et signature du Cabinet Delaunay, communs aux actes express (cockpit, génération d'actes).
 * Les textes sont ceux de la maquette, au caractère près (sauts de ligne compris).
 */

/**
 * Champs du mandat lus par l'en-tête des actes : vue copropriété affichable (dates « JJ/MM/AAAA »),
 * copropriété de démonstration ou vue vide.
 */
export interface MandatEnteteActe {
  nom: string
  adresse: string
  fondement: string
  tribunal: string
  ordonnance: string
  rg: string
}

const QUALITES_MANDATAIRE: Record<Regime, string> = {
  sj: 'Syndic judiciaire',
  ap47: 'Administrateur provisoire',
  ap291: 'Administrateur provisoire',
}

const ARTICLES_FONDEMENT_DESIGNATION: Record<Regime, string> = {
  sj: 'article 46 du décret du 17 mars 1967',
  ap47: 'article 47 du décret du 17 mars 1967',
  ap291: 'article 29-1 de la loi du 10 juillet 1965',
}

/**
 * Qualité du mandataire selon le régime reconnu dans le fondement (« Mandataire de justice » à défaut).
 * Les actes express comparent ces libellés exacts : ne pas les modifier.
 */
export const qualiteMandataire = (mandat: Pick<MandatEnteteActe, 'fondement'>): string => {
  const regime = regimeDepuisFondement(mandat.fondement)
  return (regime && QUALITES_MANDATAIRE[regime]) || 'Mandataire de justice'
}

/** Article fondant la désignation, ou null si le régime n'est pas reconnu (l'appelant reprend alors le fondement brut). */
export const articleFondementDesignation = (mandat: Pick<MandatEnteteActe, 'fondement'>): string | null => {
  const regime = regimeDepuisFondement(mandat.fondement)
  return (regime && ARTICLES_FONDEMENT_DESIGNATION[regime]) || null
}

/** Signature du cabinet : qualité, puis mention du texte applicable entre parenthèses, sur une seconde ligne. */
export const signatureCabinet = (mandat: Pick<MandatEnteteActe, 'fondement'>): string => {
  const regime = regimeDepuisFondement(mandat.fondement)
  return `Cabinet Delaunay · ${qualiteMandataire(mandat)}
(${regime === 'ap291' ? 'art. 29-1 et suivants de la loi du 10 juillet 1965' : regime === 'ap47' ? 'auxiliaire de justice · art. 47 du décret du 17 mars 1967' : regime === 'sj' ? 'auxiliaire de justice · art. 46 du décret du 17 mars 1967, fonctions des art. 18 à 18-2 de la loi du 10 juillet 1965' : 'mandataire de justice'})`
}

/** En-tête des actes : cabinet et qualité, désignation, copropriété, puis un filet de 58 « ─ » (U+2500). */
export const enteteActe = (mandat: MandatEnteteActe): string => `CABINET DELAUNAY · ${qualiteMandataire(mandat).toUpperCase()}
Désigné par le ${mandat.tribunal} · Ordonnance du ${mandat.ordonnance} (RG ${mandat.rg})
Copropriété : ${mandat.nom} · ${mandat.adresse}
${'─'.repeat(58)}`
