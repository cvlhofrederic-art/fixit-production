import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Relevé de compte lu d'un fichier structuré (CFONB 120 : releve-cfonb.ts ; ISO 20022 camt.053 : releve-camt.ts) : types
 * communs, contrôle des soldes, désignation du compte. Fonctions pures, montants en UNITÉS MINEURES ENTIÈRES de la devise
 * du relevé (les centimes pour l'euro), positifs pour un crédit au compte (encaissement), négatifs pour un débit.
 *
 * Un mouvement est une LigneReleve (releve-bancaire.ts : date ISO, libellé, montant en euros décimaux, positif =
 * encaissement) : il passe tel quel dans dedoublonnerReleve et proposerImputations. Le montant décimal y est dérivé du
 * montant entier (montantMineur / 10^décimales), jamais l'inverse.
 *
 * Contrôle des soldes — 🟢 CFONB, « Relevé de compte sur support informatique » (juillet 2004), § 2 : le nouveau solde
 * (07) est le solde au dernier jour de la période et « est repris comme ancien solde du relevé de la période suivante » ;
 * 🟢 guide CFONB camt.053.001.02 (V1.2, juillet 2019), p. 31-32 : ancien solde OPBD et nouveau solde CLBD, une occurrence
 * chacun. 🔵 Déduit : ancien solde + somme des mouvements comptabilisés = nouveau solde, au centime (unité mineure) près ;
 * un relevé qui ne vérifie pas l'égalité est refusé en entier (un mouvement manque, est en trop ou est mal lu).
 * 🔵 La continuité entre deux relevés successifs d'un même compte du fichier (ancien solde = nouveau solde du précédent)
 * n'est qu'un avertissement : un relevé intermédiaire peut manquer au fichier sans que les relevés lus soient faux.
 *
 * Décimales des devises — 🟢 ISO 4217, liste 1 publiée le 17/09/2026 (SIX, relevée le 20/11/2026) : 0 décimale pour BIF,
 * CLP, DJF, GNF, ISK, JPY, KMF, KRW, PYG, RWF, UGX, UYI, VND, VUV, XAF, XOF, XPF ; 3 pour BHD, IQD, JOD, KWD, LYD, OMR,
 * TND ; 4 pour CLF, UYW. 🔵 Toute autre devise : 2 décimales (cas de toutes les autres devises actives de la liste ; les
 * codes sans unité mineure, métaux et unités de compte, ne sont pas attendus sur un relevé de syndicat).
 *
 * Clé RIB — 🔵 formule usuelle (97 − (89 × banque + 15 × guichet + 3 × compte) mod 97, lettres du numéro de compte
 * remplacées par 1 à 9 : A J → 1, B K S → 2 … I R Z → 9), vérifiée sur l'exemple courant 30002 00550 0000157841Z clé 25 ;
 * 🔴 non relue dans un texte officiel. La clé n'est pas dans le relevé CFONB : elle est calculée.
 */

export type FormatReleveStructure = 'cfonb120' | 'camt053'

/** RIB français : banque (5 chiffres), guichet (5 chiffres), numéro de compte (11 caractères), clé calculée. */
export interface Rib {
  banque: string
  guichet: string
  numero: string
  cle: string
}

/** Compte du relevé : IBAN (camt.053) ou RIB (CFONB 120), ou autre identifiant (camt.053, Acct/Id/Othr/Id). */
export interface CompteReleve {
  iban: string | null
  rib: Rib | null
  autreIdentifiant: string | null
  /** Titulaire du compte (camt.053, Acct/Ownr/Nm) ; null s'il n'est pas restitué. */
  titulaire: string | null
}

/** Information complémentaire d'un mouvement CFONB (enregistrement 05) : qualifiant et zone de 70 caractères. */
export interface ComplementReleve {
  qualifiant: string
  texte: string
}

export interface MouvementReleve extends LigneReleve {
  /** Montant signé en unités mineures de la devise du relevé (centimes pour l'euro) ; positif = encaissement. */
  montantMineur: number
  dateValeur: string | null
  /** CFONB : code opération interbancaire (2-I) ; camt.053 : code ISO domaine/famille/sous-famille, à défaut code propriétaire. */
  codeOperation: string | null
  /** Référence de la banque : CFONB zone référence (2-S) ; camt.053 AcctSvcrRef. */
  referenceBanque: string | null
  /** CFONB : numéro d'écriture (2-O, null s'il est à zéro) ; camt.053 : NtryRef. */
  numeroEcriture: string | null
  /** Nom du payeur (CFONB 05 NPY ; camt.053 Dbtr/Nm). */
  payeur: string | null
  /** Nom du bénéficiaire (CFONB 05 NBE ; camt.053 Cdtr/Nm). */
  beneficiaire: string | null
  /** Référence de bout en bout (CFONB 05 RCN ; camt.053 EndToEndId, hors « NOTPROVIDED »). */
  referenceClient: string | null
  /** Code motif de rejet ou de retour (CFONB 2-K ; camt.053 RtrInf/Rsn/Cd). */
  motifRejet: string | null
  /** Écriture de contre-passation (camt.053 RvslInd) ; toujours false en CFONB 120, qui n'a pas cette marque. */
  contrepassation: boolean
  /** Enregistrements 05 du mouvement (CFONB) ; vide en camt.053. */
  complements: ComplementReleve[]
}

export interface ReleveCompte {
  format: FormatReleveStructure
  /** Rang du relevé dans le fichier, à partir de 1 (relevés refusés compris). */
  rang: number
  /** Identifiant du relevé (camt.053 Stmt/Id) ; null en CFONB 120. */
  identifiant: string | null
  compte: CompteReleve
  devise: string
  decimales: number
  dateOuverture: string
  dateCloture: string
  soldeOuvertureMineur: number
  soldeClotureMineur: number
  totalCreditsMineur: number
  /** Somme des débits, en valeur absolue. */
  totalDebitsMineur: number
  mouvements: MouvementReleve[]
}

/** Relevés retenus (contrôlés), erreurs (relevés refusés, fichier illisible) et avertissements (sans refus). */
export interface ResultatLectureReleves {
  releves: ReleveCompte[]
  erreurs: string[]
  avertissements: string[]
}

const DECIMALES_PARTICULIERES: Readonly<Record<string, number>> = {
  ...Object.fromEntries(
    ['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'].map((code) => [code, 0]),
  ),
  ...Object.fromEntries(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'].map((code) => [code, 3])),
  CLF: 4,
  UYW: 4,
}

/** Nombre de décimales de la devise (ISO 4217) ; 2 hors des devises listées à part. */
export const decimalesDevise = (devise: string): number => DECIMALES_PARTICULIERES[devise] ?? 2

/** Montant décimal (unités majeures) d'un montant entier en unités mineures ; zéro négatif rendu comme zéro. */
export const montantMajeur = (montantMineur: number, decimales: number): number => montantMineur / 10 ** decimales || 0

/** « 1 234,56 EUR », « -777,06 EUR », « 175 000 XPF » : groupes de trois chiffres séparés par une espace. */
export function formaterMontantMineur(montantMineur: number, decimales: number, devise: string): string {
  const chiffres = String(Math.abs(montantMineur)).padStart(decimales + 1, '0'),
    entier = chiffres.slice(0, chiffres.length - decimales).replaceAll(/\B(?=(\d{3})+$)/g, ' '),
    fraction = decimales > 0 ? `,${chiffres.slice(-decimales)}` : ''
  return `${montantMineur < 0 ? '-' : ''}${entier}${fraction} ${devise}`
}

/** Totaux des crédits et des débits (valeur absolue) d'une liste de mouvements. */
export function totauxMouvements(mouvements: readonly Pick<MouvementReleve, 'montantMineur'>[]): { credits: number; debits: number } {
  let credits = 0,
    debits = 0
  for (const { montantMineur } of mouvements)
    if (montantMineur > 0) credits += montantMineur
    else debits -= montantMineur
  return { credits, debits }
}

type SoldesAControler = Pick<ReleveCompte, 'soldeOuvertureMineur' | 'soldeClotureMineur' | 'devise' | 'decimales'> & {
  mouvements: readonly Pick<MouvementReleve, 'montantMineur'>[]
}

/**
 * Contrôle « ancien solde + mouvements = nouveau solde » ; null s'il est vérifié, sinon le motif du refus. Refuse aussi
 * des sommes hors des entiers exacts (2^53), signe d'un fichier corrompu.
 */
export function controlerSoldes(releve: SoldesAControler): string | null {
  const { credits, debits } = totauxMouvements(releve.mouvements),
    net = credits - debits,
    calcule = releve.soldeOuvertureMineur + net,
    montant = (valeur: number) => formaterMontantMineur(valeur, releve.decimales, releve.devise)
  if (![credits, debits, calcule].every(Number.isSafeInteger)) return 'montants hors des limites de calcul exact.'
  if (calcule === releve.soldeClotureMineur) return null
  return (
    `ancien solde ${montant(releve.soldeOuvertureMineur)} + mouvements ${montant(net)} = ${montant(calcule)}, ` +
    `mais nouveau solde annoncé ${montant(releve.soldeClotureMineur)} (écart ${montant(Math.abs(releve.soldeClotureMineur - calcule))}).`
  )
}

const LETTRES_RIB = '12345678912345678923456789'

/** Clé RIB calculée (voir l'en-tête) ; numéro de compte en chiffres et lettres majuscules. */
export function cleRib(banque: string, guichet: string, numero: string): string {
  const compte = Number(numero.toUpperCase().replaceAll(/[A-Z]/g, (lettre) => LETTRES_RIB[lettre.charCodeAt(0) - 65]))
  return String(97 - ((89 * Number(banque) + 15 * Number(guichet) + 3 * compte) % 97)).padStart(2, '0')
}

/** « IBAN FR76… », « RIB 12345 00010 00012345678 clé 49 » ou « compte <identifiant> ». */
export function designationCompte(compte: CompteReleve): string {
  if (compte.iban) return `IBAN ${compte.iban}`
  if (compte.rib) return `RIB ${compte.rib.banque} ${compte.rib.guichet} ${compte.rib.numero} clé ${compte.rib.cle}`
  return `compte ${compte.autreIdentifiant ?? 'non identifié'}`
}

/** « Relevé 2 (IBAN …, du 30/09/2026 au 05/10/2026) » ; les dates inconnues sont omises. */
export function designationReleve(rang: number, compte: CompteReleve, dateOuverture?: string | null, dateCloture?: string | null): string {
  const periode = dateOuverture && dateCloture ? `, du ${dateIsoVersFr(dateOuverture)} au ${dateIsoVersFr(dateCloture)}` : ''
  return `Relevé ${rang} (${designationCompte(compte)}${periode})`
}

const normaliserIban = (iban: string): string => iban.replaceAll(/\s+/g, '').toUpperCase()

/**
 * Le compte du relevé est-il celui de cet IBAN ? Par IBAN s'il est lu ; sinon par le RIB, comparé à la partie nationale
 * d'un IBAN français ou monégasque (🔵 même structure de 23 caractères : banque, guichet, compte, clé). Faux sans
 * identifiant comparable.
 */
export function compteCorrespond(compte: CompteReleve, iban: string): boolean {
  const cible = normaliserIban(iban)
  if (compte.iban) return normaliserIban(compte.iban) === cible
  if (!compte.rib || !/^(FR|MC)\d{2}[A-Z0-9]{23}$/.test(cible)) return false
  const { banque, guichet, numero, cle } = compte.rib
  return cible.slice(4) === `${banque}${guichet}${numero}${cle}`.toUpperCase()
}

/** Longueur au-delà de laquelle les textes d'un libellé composé sont omis (🔵 borne de sûreté, aucun texte ne la fixe). */
export const LONGUEUR_MAX_LIBELLE = 1_000

export interface LibelleCompose {
  libelle: string
  /** Des textes ont été omis ou coupés pour tenir dans LONGUEUR_MAX_LIBELLE : l'appelant en avertit. */
  tronque: boolean
}

const reduireEspaces = (texte: string | null | undefined): string => (texte ?? '').replaceAll(/\s+/g, ' ').trim()

/** Morceaux non vides, sans répétition (texte normalisé), tant que leur jonction tient dans LONGUEUR_MAX_LIBELLE. */
function morceauxRetenus(morceaux: readonly (string | null | undefined)[]): { retenus: string[]; tronque: boolean } {
  const retenus: string[] = [],
    vus = new Set<string>()
  let longueur = 0
  for (const morceau of morceaux) {
    const propre = reduireEspaces(morceau),
      cle = normaliserTexte(propre)
    if (!propre || vus.has(cle)) continue
    const separateur = retenus.length > 0 ? 1 : 0,
      place = LONGUEUR_MAX_LIBELLE - longueur - separateur
    if (propre.length > place) {
      if (place > 0) retenus.push(propre.slice(0, place).trimEnd())
      return { retenus, tronque: true }
    }
    vus.add(cle)
    longueur += separateur + propre.length
    retenus.push(propre)
  }
  return { retenus, tronque: false }
}

/**
 * Libellé d'un mouvement : morceaux non vides dans l'ordre, sans répétition, espaces réduits, coupés au-delà de
 * LONGUEUR_MAX_LIBELLE caractères (`tronque`) ; la contrepartie (payeur d'un crédit, bénéficiaire d'un débit) est ensuite
 * ajoutée si l'un de ses mots manque au libellé — 🔵 choix fait pour que proposerImputations, qui ne lit que le libellé,
 * trouve le nom du copropriétaire. Vide → « (sans libellé) ». Temps linéaire en la longueur des morceaux (ensemble des
 * textes déjà vus, arrêt à la borne), y compris pour un fichier hostile à milliers de compléments.
 */
export function composerLibelle(morceaux: readonly (string | null | undefined)[], contrepartie: string | null): LibelleCompose {
  const { retenus, tronque } = morceauxRetenus(morceaux),
    nom = reduireEspaces(contrepartie)
  if (nom) {
    const motsLibelle = new Set(normaliserTexte(retenus.join(' ')).split(' '))
    if (normaliserTexte(nom).split(' ').some((mot) => !motsLibelle.has(mot))) retenus.push(nom)
  }
  return { libelle: retenus.join(' ') || '(sans libellé)', tronque }
}

/** « <désignation> : libellé limité à 1 000 caractères, textes suivants omis. » */
export const avertissementLibelleTronque = (designation: string): string =>
  `${designation} : libellé limité à ${String(LONGUEUR_MAX_LIBELLE).replaceAll(/\B(?=(\d{3})+$)/g, ' ')} caractères, textes suivants omis.`

/** Clé de compte pour la continuité : IBAN, sinon RIB, sinon autre identifiant, plus la devise. */
const cleCompte = (releve: ReleveCompte): string => `${designationCompte(releve.compte)}|${releve.devise}`

/**
 * Avertissements de continuité : pour deux relevés retenus successifs d'un même compte (ordre du fichier), l'ancien solde
 * du second doit égaler le nouveau solde du premier.
 */
export function avertissementsContinuite(releves: readonly ReleveCompte[]): string[] {
  const precedents = new Map<string, ReleveCompte>(),
    avertissements: string[] = []
  for (const releve of releves) {
    const precedent = precedents.get(cleCompte(releve))
    if (precedent && precedent.soldeClotureMineur !== releve.soldeOuvertureMineur) {
      const montant = (valeur: number) => formaterMontantMineur(valeur, releve.decimales, releve.devise)
      avertissements.push(
        `${designationReleve(releve.rang, releve.compte, releve.dateOuverture, releve.dateCloture)} : ancien solde ` +
          `${montant(releve.soldeOuvertureMineur)} différent du nouveau solde ${montant(precedent.soldeClotureMineur)} du relevé ` +
          `${precedent.rang} du même compte.`,
      )
    }
    precedents.set(cleCompte(releve), releve)
  }
  return avertissements
}
