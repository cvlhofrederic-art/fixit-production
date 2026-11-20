import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/**
 * Fiche « validation banque » d'un compte bancaire du syndicat, et mention portée par les fichiers SEPA tant qu'elle
 * manque. Fonctions pures, dates ISO, sans écran ni table : l'enregistrement de la fiche, compte par compte, reste à
 * brancher (donnée que le domaine n'a pas encore : elle se passe en paramètre, validationBanque).
 *
 * Décision du 20/11/2026 (partie C, F103) : VitFix produit les fichiers, il ne les transmet jamais. Chaque compte
 * bancaire du syndicat reçoit une fiche « validation banque » : date du test, format accepté (pain.001.001.03,
 * pain.008.001.02 ou une variante), ICS vérifié, longueur maximale des références, délais de remise. Sans elle, le
 * fichier porte la mention « non validé par la banque ». Fondement : le règlement (UE) n° 260/2012 fixe des exigences
 * générales (art. 5 et annexe, version consolidée du 08/04/2024, lue) ; il ne fixe ni la longueur des références ni le
 * format de l'ICS : les détails relèvent du guide de chaque banque (non lu), et seul un test réel le prouve.
 *
 * 🔵 Déduit :
 * - la mention s'écrit en commentaire XML juste après la déclaration : elle se lit dans le fichier sans changer le
 *   message ISO 20022 (un commentaire n'est pas un élément du schéma) ;
 * - le fichier est validé quand la fiche est celle du compte du fichier (comparée quand l'appelant connaît le compte),
 *   que la banque accepte son format exact (une variante acceptée seule ne valide pas le format produit), que l'ICS du
 *   créancier est celui que la banque a vérifié (prélèvement), et qu'aucune référence ne dépasse la longueur maximale
 *   donnée par la banque (sans longueur donnée, rien n'est comparé) ;
 * - les délais de remise sont gardés tels que la banque les donne (texte) : ils ne sont pas calculés ici.
 */

/** Formats produits par VitFix (ordres-banque.genererPain001, prelevements-sepa.genererPain008). */
export const FORMATS_FICHIERS_BANQUE = ['pain.001.001.03', 'pain.008.001.02'] as const
export type FormatFichierBanque = (typeof FORMATS_FICHIERS_BANQUE)[number]

/** Décision du 20/11/2026 (partie C, F103). */
export const MENTION_NON_VALIDE_PAR_LA_BANQUE = 'non validé par la banque'

const FONDEMENT_VALIDATION = 'décision du 20/11/2026 (partie C, F103) ; règl. (UE) n° 260/2012, art. 5 et annexe'
const ICS = /^FR\d{2}[A-Z0-9]{3}[A-Z0-9]{6}$/

export interface FicheValidationBanque {
  /** Compte bancaire du syndicat que la banque a validé (D-BANQUE). */
  banqueId: string
  /** Date du test réel de dépôt (AAAA-MM-JJ). */
  dateTest: string
  /** Formats acceptés par la banque, en minuscules (pain.001.001.03, pain.008.001.02 ou une variante). */
  formatsAcceptes: string[]
  /** ICS vérifié avec la banque ; null : non vérifié. */
  icsVerifie: string | null
  /** Longueur maximale des références donnée par la banque ; null : non donnée. */
  longueurMaxReferences: number | null
  /** Délais de remise donnés par la banque, en texte ; null : non donnés. */
  delaisRemise: string | null
}

export interface SaisieFicheValidationBanque {
  banqueId: string
  dateTest: string
  formatsAcceptes: readonly string[]
  icsVerifie?: string | null
  longueurMaxReferences?: number | null
  delaisRemise?: string | null
}

const texteOuNull = (valeur: string | null | undefined): string | null => valeur?.trim() || null

function icsLu(ics: string | null | undefined): string | null {
  const brut = texteOuNull(ics)?.toUpperCase() ?? null
  if (brut !== null && !ICS.test(brut)) throw new Error(`Validation banque : ICS vérifié invalide (« ${brut} »).`)
  return brut
}

function longueurLue(longueur: number | null | undefined): number | null {
  if (longueur === null || longueur === undefined) return null
  if (!Number.isInteger(longueur) || longueur < 1)
    throw new Error(`Validation banque : longueur maximale des références invalide (${longueur}), entier positif attendu.`)
  return longueur
}

/**
 * Fiche « validation banque » contrôlée : compte bancaire, date du test, au moins un format, ICS au format français,
 * longueur maximale entière positive. Les formats sont gardés en minuscules, sans espaces autour.
 */
export function creerFicheValidationBanque(saisie: SaisieFicheValidationBanque): FicheValidationBanque {
  const banqueId = saisie.banqueId.trim()
  if (!banqueId) throw new Error('Validation banque : compte bancaire du syndicat attendu.')
  if (!estDateIsoValide(saisie.dateTest)) throw new Error(`Validation banque : date du test invalide (${saisie.dateTest}), AAAA-MM-JJ attendu.`)
  const formatsAcceptes = [...new Set(saisie.formatsAcceptes.map((f) => f.trim().toLowerCase()).filter((f) => f !== ''))]
  if (formatsAcceptes.length === 0) throw new Error('Validation banque : au moins un format accepté par la banque attendu.')
  return {
    banqueId,
    dateTest: saisie.dateTest,
    formatsAcceptes,
    icsVerifie: icsLu(saisie.icsVerifie),
    longueurMaxReferences: longueurLue(saisie.longueurMaxReferences),
    delaisRemise: texteOuNull(saisie.delaisRemise),
  }
}

/** Ce que le fichier produit expose à la comparaison avec la fiche. */
export interface FichierAValider {
  /** Compte bancaire du fichier ; absent : non comparé (l'appelant passe la fiche de ce compte). */
  banqueId?: string
  format: FormatFichierBanque
  /** ICS du créancier (prélèvement) ; absent pour un virement. */
  ics?: string | null
  /** Références du fichier (identifiants de bout en bout, RUM). */
  references: readonly string[]
}

export interface ControleValidationBanque {
  valide: boolean
  /** Mention à porter sur le fichier ; null : validé par la banque. */
  mention: string | null
  motifs: string[]
}

function motifsDeLaFiche(fiche: FicheValidationBanque, fichier: FichierAValider): string[] {
  const motifs: string[] = []
  const test = `test du ${dateIsoVersFr(fiche.dateTest)}`
  if (fichier.banqueId !== undefined && fichier.banqueId !== fiche.banqueId)
    motifs.push(`fiche « validation banque » d'un autre compte (${fiche.banqueId}, fichier du compte ${fichier.banqueId})`)
  if (!fiche.formatsAcceptes.includes(fichier.format))
    motifs.push(`format accepté par la banque (${test}) : ${fiche.formatsAcceptes.join(', ')} ; fichier produit : ${fichier.format}`)
  const ics = fichier.ics?.trim().toUpperCase()
  if (ics && ics !== fiche.icsVerifie) motifs.push(`ICS ${ics} non vérifié par la banque`)
  const max = fiche.longueurMaxReferences
  const longues = max === null ? [] : fichier.references.filter((r) => r.length > max)
  if (longues.length > 0) motifs.push(`référence(s) ${longues.join(', ')} au-delà de ${max} caractères (longueur maximale donnée par la banque)`)
  return motifs
}

/**
 * Décision du 20/11/2026 (partie C, F103) : le fichier est-il validé par la banque ? Sans fiche, jamais ; avec une fiche,
 * s'il n'y a aucun motif (compte, format, ICS, longueur des références). Sinon, la mention « non validé par la banque »
 * et ses motifs.
 */
export function controlerValidationBanque(fiche: FicheValidationBanque | null | undefined, fichier: FichierAValider): ControleValidationBanque {
  const motifs = fiche ? motifsDeLaFiche(fiche, fichier) : ['aucune fiche « validation banque » pour ce compte']
  if (motifs.length === 0) return { valide: true, mention: null, motifs }
  return { valide: false, mention: `${MENTION_NON_VALIDE_PAR_LA_BANQUE} : ${motifs.join(' ; ')}`, motifs }
}

/** Un commentaire XML ne contient jamais « -- » ni ne finit par « - ». */
const sansDoubleTiret = (texte: string): string => texte.replaceAll(/-{2,}/g, '-').replace(/-$/, '')

/**
 * Ligne de commentaire XML portée par le fichier après la déclaration ; vide si le fichier est validé (décision du
 * 20/11/2026, partie C, F103).
 */
export function commentaireValidationBanque(controle: ControleValidationBanque): string {
  if (controle.mention === null) return ''
  return `<!-- ${sansDoubleTiret(`${controle.mention}. Fichier produit par VitFix, jamais transmis par VitFix (${FONDEMENT_VALIDATION}).`)} -->\n`
}
