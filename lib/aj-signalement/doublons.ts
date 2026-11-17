// ── AJ Signalement : doublons de copropriétés (SPEC § 1.6, RG-08) ─────────────────────────────────────────────
//
// Règles pures partagées par la saisie, la modification et l'import, au navigateur (aperçu) comme au serveur
// (pré-contrôle avant la fonction SQL de création). Comparaison à TOUTES les copropriétés du cabinet, actives ou non ;
// la clé du nom est recalculée ici depuis le nom (cle_nom est NULL pour les lignes antérieures, dont Parc Belle Ombre).
//   certain  : même immatriculation, même référence du cabinet (index uniques : jamais forçable) ;
//              même nom normalisé + même code postal (forçable par le super admin seul, journal doublon.force) ;
//   probable : même adresse normalisée + même code postal ; même nom, code postal différent ou absent.
// La fonction SQL revérifie nom + CP sous le verrou du cabinet : la course entre deux créations est fermée en base.

import { sansAccentsMinuscules } from '@/lib/administrateur-judiciaire/domain/texte'
import type {
  CoproprieteDoublonQr, DecisionDoublonsQr, DoublonQr, FicheDoublonQr, ProfilActeurQr,
} from '@/lib/aj-signalement/types'

/** CHECK de la migration : cle_nom de 200 caractères au plus. */
export const LONGUEUR_MAX_CLE_NOM_QR = 200

/** Minuscules sans accents, ligatures développées, tout caractère hors lettres et chiffres → espace, espaces réduits. */
export function cleTexteQr(valeur: string): string {
  return sansAccentsMinuscules(valeur)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Mots vides d'un nom de copropriété, retirés en tête comme isolés au milieu (mots entiers seulement : « Lescure »
 * reste). Liste à revoir sur le vrai fichier d'un client.
 */
const MOTS_VIDES_NOM_QR = new Set([
  'residence', 'res', 'copropriete', 'copro', 'immeuble', 'syndicat', 'des', 'coproprietaires',
  'le', 'la', 'les', 'l', 'du', 'de', 'd',
])

/** « Résidence Le Parc » = « LE PARC » = « parc ». Un nom fait seulement de mots vides garde ses mots. */
export function cleNomCoproQr(nom: string): string {
  const mots = cleTexteQr(nom).split(' ').filter(Boolean)
  const utiles = mots.filter((mot) => !MOTS_VIDES_NOM_QR.has(mot))
  return (utiles.length > 0 ? utiles : mots).join(' ').slice(0, LONGUEUR_MAX_CLE_NOM_QR).trim()
}

/** Abréviations d'adresse développées (mots entiers). Liste à revoir sur le vrai fichier d'un client. */
const ABREVIATIONS_ADRESSE_QR: ReadonlyMap<string, string> = new Map([
  ['bd', 'boulevard'], ['bld', 'boulevard'], ['blvd', 'boulevard'], ['bvd', 'boulevard'],
  ['av', 'avenue'], ['ave', 'avenue'], ['r', 'rue'], ['pl', 'place'], ['ch', 'chemin'], ['chem', 'chemin'],
  ['imp', 'impasse'], ['rte', 'route'], ['sq', 'square'], ['fbg', 'faubourg'], ['all', 'allee'],
  ['st', 'saint'], ['ste', 'sainte'],
])

/** « 12bis bd St-Exemple » = « 12 BIS boulevard Saint Exemple » : abréviations développées, numéro séparé de son indice. */
export function cleAdresseQr(adresse: string): string {
  return cleTexteQr(adresse)
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((mot) => ABREVIATIONS_ADRESSE_QR.get(mot) ?? mot)
    .join(' ')
}

/** Immatriculation comparée comme l'écrit la saisie (majuscules, sans espaces, points ni tirets). */
const cleImmatriculation = (valeur: string | null): string => (valeur ?? '').toUpperCase().replace(/[\s.-]/g, '')

/** Référence comparée exactement (rognée), comme l'index unique de la base. */
const cleReference = (valeur: string | null): string => (valeur ?? '').trim()

interface ClesQr {
  immatriculation: string
  reference: string
  nom: string
  adresse: string
  codePostal: string
}

/**
 * Clés déjà calculées, par fiche (objet) : un import de 500 lignes compare chaque ligne aux précédentes et aux
 * copropriétés du cabinet ; sans ce cache, chaque comparaison renormaliserait les deux fiches (≈ 2 s pour 500 lignes).
 * Les fiches comparées ne sont jamais modifiées après coup (objets construits pour la comparaison).
 */
const CLES_CALCULEES = new WeakMap<FicheDoublonQr, ClesQr>()

function cles(f: FicheDoublonQr): ClesQr {
  const connues = CLES_CALCULEES.get(f)
  if (connues) return connues
  const calculees: ClesQr = {
    immatriculation: cleImmatriculation(f.immatriculation),
    reference: cleReference(f.referenceCabinet),
    nom: cleNomCoproQr(f.nom),
    adresse: cleAdresseQr(f.adresse),
    codePostal: f.codePostal.trim(),
  }
  CLES_CALCULEES.set(f, calculees)
  return calculees
}

/** Rang de gravité : certains non forçables, certains forçables, probables. */
const rang = (d: DoublonQr): number => (d.certitude === 'certain' ? (d.forcable ? 1 : 0) : 2)

/** Le critère le plus sûr qui rapproche deux fiches, ou null. Champs vides jamais comparés. */
function critereCommun(a: ClesQr, b: ClesQr): Pick<DoublonQr, 'certitude' | 'critere' | 'forcable'> | null {
  if (a.immatriculation && a.immatriculation === b.immatriculation) return { certitude: 'certain', critere: 'immatriculation', forcable: false }
  if (a.reference && a.reference === b.reference) return { certitude: 'certain', critere: 'reference_cabinet', forcable: false }
  const memeCodePostal = a.codePostal !== '' && a.codePostal === b.codePostal
  if (a.nom && a.nom === b.nom && memeCodePostal) return { certitude: 'certain', critere: 'nom_code_postal', forcable: true }
  if (a.adresse && a.adresse === b.adresse && memeCodePostal) return { certitude: 'probable', critere: 'adresse_code_postal', forcable: false }
  if (a.nom && a.nom === b.nom) return { certitude: 'probable', critere: 'nom', forcable: false }
  return null
}

/**
 * Doublons d'une fiche parmi les copropriétés existantes du cabinet (actives ou non) : une entrée par copropriété, son
 * critère le plus sûr, triées du plus grave au moins grave. `ignorerId` : la copropriété modifiée elle-même.
 */
export function doublonsCoproprieteQr(
  candidat: FicheDoublonQr, existantes: readonly CoproprieteDoublonQr[], options: { ignorerId?: string } = {},
): DoublonQr[] {
  const a = cles(candidat)
  const doublons: DoublonQr[] = []
  for (const e of existantes) {
    if (options.ignorerId !== undefined && e.id === options.ignorerId) continue
    const commun = critereCommun(a, cles(e))
    if (commun) doublons.push({ ...commun, copropriete: { id: e.id, nom: e.nom, ville: e.ville } })
  }
  return doublons.sort((x, y) => rang(x) - rang(y))
}

/**
 * Décision sur des doublons (du plus grave au moins grave) : immatriculation ou référence → refus, toujours ; nom + CP →
 * refus sauf forçage du super admin (doublonForce) ; probable → refus sauf confirmation (confirmerDoublonProbable, ou
 * forçage du super admin, qui vaut confirmation : une seule question à l'écran). Un gestionnaire (PR 2) ne force rien.
 */
export function decisionDoublonsQr(
  doublons: readonly DoublonQr[],
  options: { profil: Exclude<ProfilActeurQr, 'systeme'>; forcerDoublon: boolean; confirmerDoublonProbable: boolean },
): DecisionDoublonsQr {
  const forcage = options.profil === 'super_admin' && options.forcerDoublon
  let doublonForce = false
  let probableConfirme = false
  for (const doublon of [...doublons].sort((x, y) => rang(x) - rang(y))) {
    if (doublon.certitude === 'certain') {
      if (!doublon.forcable || !forcage) return { ok: false, doublon }
      doublonForce = true
    } else {
      if (!options.confirmerDoublonProbable && !forcage) return { ok: false, doublon }
      probableConfirme = true
    }
  }
  return { ok: true, doublonForce, probableConfirme }
}
