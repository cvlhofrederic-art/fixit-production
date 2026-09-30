/**
 * Fondements juridiques des mandats judiciaires : régimes (syndic judiciaire art. 46, administrateur provisoire
 * art. 47 et art. 29-1), textes de référence et reconnaissance du régime à partir du libellé saisi.
 * Les textes sont ceux de la maquette, au caractère près.
 */

/** Régime du mandat : syndic judiciaire (art. 46), AP carence (art. 47), AP copropriété en difficulté (art. 29-1). */
export type Regime = 'sj' | 'ap47' | 'ap291'

/** Synonyme employé par le moteur de délais légaux. */
export type RegimeMandat = Regime

export interface FicheRegime {
  code: Regime
  label: string
  short: string
  basis: string
  duree: string
  mission: string
  pouvoirs: string[]
}

/** Fiches descriptives des régimes (écrans Dossier juridictionnel et Étendue des pouvoirs). */
export const FICHES_REGIMES: Record<Regime, FicheRegime> = {
  sj: {
    code: 'sj',
    label: 'Syndic judiciaire',
    short: 'Syndic judiciaire',
    basis: 'art. 17 L. 1965 · art. 46 décret 1967',
    duree: "fixée par l'ordonnance",
    mission: "Assurer la gestion et convoquer l'AG en vue d'élire un syndic.",
    pouvoirs: [
      'Tous les pouvoirs du syndic (art. 18 à 18-2)',
      "L'AG et le conseil syndical conservent leurs pouvoirs",
      'Rémunération fixée / soumise à taxation',
    ],
  },
  ap47: {
    code: 'ap47',
    label: 'Administrateur provisoire — carence',
    short: 'AP carence',
    basis: 'art. 47 du décret du 17 mars 1967',
    duree: 'fixée par le juge',
    mission: "Pallier l'absence de syndic et convoquer l'AG élective.",
    pouvoirs: ['Pouvoirs du syndic', 'Aucune preuve de difficulté requise', 'Se faire remettre archives et fonds'],
  },
  ap291: {
    code: 'ap291',
    label: 'Administrateur provisoire — difficulté',
    short: 'AP art. 29-1',
    basis: 'art. 29-1 de la loi du 10 juillet 1965',
    duree: '≥ 12 mois',
    mission: 'Rétablir le fonctionnement normal et redresser la situation financière.',
    pouvoirs: [
      'Pouvoirs du syndic',
      "Tout ou partie des pouvoirs de l'AG (sauf art. 26 a et b)",
      'Tout ou partie des pouvoirs du conseil syndical',
      "Rapport intermédiaire au plus tard à 6 mois (art. 29-1 I), sauf rapport de mandataire ad hoc l'année précédente",
    ],
  },
}

/**
 * Fiche du régime d'une copropriété, par une heuristique plus grossière que regimeDepuisFondement
 * (« 29-1 » n'importe où → ap291, « 47 » → ap47, sinon sj, y compris pour un mandat ad hoc).
 * Les deux lectures coexistent dans la maquette : ne pas les fusionner.
 */
export const ficheRegimeCopro = (copro: { fondement?: string | null } | null | undefined): FicheRegime => {
  const fondement = (copro && copro.fondement) || ''
  return fondement.includes('29-1') ? FICHES_REGIMES.ap291 : /\b47\b/.test(fondement) ? FICHES_REGIMES.ap47 : FICHES_REGIMES.sj
}

export interface LibelleRegime {
  libelle: string
  fondement: string
}

/** Libellés longs des régimes (distincts des fiches : textes différents, à conserver tous les deux). */
export const LIBELLES_REGIMES: Record<Regime, LibelleRegime> = {
  sj: {
    libelle: "Syndic désigné en justice (carence de l'assemblée)",
    fondement: 'L. 1965 art. 17 · D. 1967 art. 46',
  },
  ap47: {
    libelle: 'Administrateur provisoire · syndicat dépourvu de syndic',
    fondement: 'L. 1965 art. 17 · D. 1967 art. 47',
  },
  ap291: {
    libelle: 'Administrateur provisoire · copropriété en difficulté',
    fondement: 'L. 1965 art. 29-1 et s.',
  },
}

export type TexteReference = 'L1965' | 'D1967' | 'CPC'

export const TEXTES_REFERENCE: Record<TexteReference, { court: string; long: string }> = {
  L1965: {
    court: 'L. 1965',
    long: 'Loi n° 65-557 du 10 juillet 1965',
  },
  D1967: {
    court: 'D. 1967',
    long: 'Décret n° 67-223 du 17 mars 1967',
  },
  CPC: {
    court: 'CPC',
    long: 'Code de procédure civile',
  },
}

/** Référence à un article d'un texte (ex. { texte: 'D1967', article: '59, dernier al.' }). */
export interface ReferenceTexte {
  texte: TexteReference
  article: string
}

/** « L. 1965 art. 18-2 », « D. 1967 art. 59, dernier al. »… */
export function citerFondement(reference: ReferenceTexte): string {
  return `${TEXTES_REFERENCE[reference.texte].court} art. ${reference.article}`
}

/**
 * Régime reconnu dans un libellé de fondement. L'ordre des tests compte : vide, « ad hoc » ou « 29-1 A/B » → null ;
 * puis « 29-1 » → ap291 ; « 47 » → ap47 ; « 46 » ou « syndic judiciaire » → sj ; sinon null (hors moteur de délais).
 */
export function regimeDepuisFondement(fondement: string | null | undefined): Regime | null {
  const texte = (fondement || '').toLowerCase()
  return !texte.trim() || /ad\s*hoc|29-1\s*[ab]\b/.test(texte)
    ? null
    : /29-1/.test(texte)
      ? 'ap291'
      : /\b47\b/.test(texte)
        ? 'ap47'
        : /\b46\b/.test(texte) || texte.includes('syndic judiciaire')
          ? 'sj'
          : null
}

/** Choix du formulaire de copropriété (reconnus par regimeDepuisFondement, sauf le mandat ad hoc). */
export const FONDEMENTS_FORMULAIRE_COPROPRIETE = [
  'Syndic judiciaire (art. 46)',
  'Administrateur provisoire (art. 47)',
  'Administration provisoire (art. 29-1)',
  'Mandat ad hoc',
] as const

/** Choix de l'assistant de mandat (le premier est la valeur par défaut). */
export const FONDEMENTS_ASSISTANT_MANDAT = [
  'art. 46 décret du 17 mars 1967 (carence)',
  'art. 47 décret du 17 mars 1967 (syndicat dépourvu de syndic)',
  'art. 29-1 loi du 10 juillet 1965 (copropriété en difficulté)',
] as const
