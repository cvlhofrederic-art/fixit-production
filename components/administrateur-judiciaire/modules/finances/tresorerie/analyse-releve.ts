import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { COMPTE_BANQUE_NON_RATTACHE, compteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { ibanGroupe } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { dateIsoVersFr, dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import { dedoublonnerRelevesStructures } from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
import { lireReleve, type FormatReleve, type LectureReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import {
  cleLigneReleve,
  dedoublonnerReleve,
  proposerImputations,
  type ConfianceImputation,
  type LigneReleve,
  type PropositionImputation,
} from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { designationReleve, formaterMontantMineur, type ReleveCompte } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'
import type { SoldeOuverture } from '@/lib/administrateur-judiciaire/domain/solde-ouverture-compte'

/**
 * Analyse d'un relevé avant son import, pour l'écran « Banque et recouvrement » (ImportRelevePanel.tsx) : lecture,
 * doublons et imputations proposées, sur le compte bancaire choisi. Lecture et dédoublonnage sont ceux du domaine
 * (domain/import/, mémo de branchement des relevés du 20/11/2026). Fonctions pures.
 * - Format détecté par lireReleve : CSV, CFONB 120 ou camt.053 ; l'IBAN du compte choisi est le seul compte attendu
 *   (comptesAttendus) : un relevé d'un autre compte est refusé.
 * - Doublons d'un CSV : dedoublonnerReleve, inchangé, sur les lignes déjà enregistrées au sous-compte 512 du compte
 *   choisi et les lignes non rattachées (« 512 » seul, importées avant le choix du compte, dont le compte n'est pas
 *   connu) ; sans compte choisi, toutes les lignes de banque de la copropriété, comme avant.
 * - Doublons d'un relevé structuré : dedoublonnerRelevesStructures, JAMAIS dedoublonnerReleve (qui confondrait deux
 *   mouvements identiques d'un relevé dont le solde vient d'être contrôlé). Les empreintes des relevés importés ne sont
 *   gardées nulle part (aucune table) : `dejaImporte` est vide, seul un relevé présent deux fois dans le fichier est
 *   reconnu, et l'analyse le dit (`limiteEmpreintes`). Un mouvement de même date, montant et libellé qu'une ligne déjà
 *   enregistrée sur le compte est gardé, avec un avertissement.
 * - Import bloqué (`blocage`) : fichier structuré ou non reconnu dont la lecture a rendu une erreur (relevé refusé,
 *   fichier illisible) ; les relevés lus restent montrés. Compte choisi sans IBAN : un relevé structuré ne peut pas lui
 *   être rapproché. Un CSV garde son comportement : lignes non lues signalées, les autres importables.
 * - Solde d'ouverture du compte choisi (décision du 26/11/2026, PR 799, point 2 ; réponses du référent métier du
 *   28/11/2026, PR 848, points 2 et 3 : solde de fin de journée, lignes déjà comprises gardées) : une ligne retenue datée
 *   de son jour ou d'avant est gardée, avec un avertissement : elle n'entrera pas dans le solde du compte
 *   (db/sous-comptes-banque.ts).
 */

/** Pastille de confiance d'un rapprochement proposé (clés = champ confiance de proposerImputations). */
export const PILL_CONFIANCE_RAPPROCHEMENT: Record<ConfianceImputation, { kind: string; label: string }> = {
  forte: {
    kind: 'sage',
    label: 'Forte',
  },
  probable: {
    kind: 'amber',
    label: 'Probable',
  },
}

/** Libellé de chaque format lu. */
export const LIBELLES_FORMAT_RELEVE: Record<FormatReleve, string> = {
  csv: 'CSV',
  cfonb120: 'CFONB 120',
  camt053: 'camt.053 (ISO 20022)',
  inconnu: 'non reconnu',
}

/** Copropriétaire proposé à l'imputation d'un encaissement. */
export interface CoproprietaireImputable {
  id: string
  nom: string
  solde: number
}

/** Copropriétaire choisi pour chaque ligne retenue (index de ligne → id, « » = ne pas imputer). */
export type SelectionsImputation = Record<string, string>

/** Relevé structuré lu, tel que l'écran le montre. */
export interface ReleveLu {
  rang: number
  /** « Relevé 1 (IBAN …, du … au …) ». */
  designation: string
  ancienSolde: string
  nouveauSolde: string
  mouvements: number
  /** « deja_importe » : même relevé plus haut dans le fichier, aucun de ses mouvements n'est repris. */
  etat: 'nouveau' | 'deja_importe'
}

/** Relevé analysé : lignes retenues et doublons écartés, rapprochements proposés, erreurs de lecture. */
export interface AnalyseReleve {
  /** Compte bancaire choisi au moment de l'analyse ; null : aucun (import impossible). */
  compteId: string | null
  /** IBAN de ce compte au moment de l'analyse (seul compte attendu d'un relevé structuré) ; null : aucun. */
  compteIban: string | null
  format: FormatReleve
  retenues: LigneReleve[]
  doublons: LigneReleve[]
  rapprochements: PropositionImputation<LigneReleve, CoproprietaireImputable>[]
  /** CSV : lignes non lues ; relevé structuré : relevés refusés, fichier illisible. Toutes gardées. */
  erreurs: string[]
  avertissements: string[]
  /** Relevés structurés lus (vide pour un CSV), dans l'ordre du fichier. */
  releves: ReleveLu[]
  /** Motif qui bloque l'import du fichier ; null : import possible (si un compte est choisi). */
  blocage: string | null
  /** Relevé structuré : un relevé importé lors d'un import précédent n'est pas reconnu (voir l'en-tête). */
  limiteEmpreintes: boolean
}

export interface EntreeAnalyseReleve {
  texte: string
  /** Compte bancaire choisi, avec son solde d'ouverture s'il en a un ; null : aucun. */
  compte: { id: string; iban: string | null; soldeOuverture?: SoldeOuverture | null } | null
  /** Écritures de banque (« 512 » et sous-comptes) du journal de la copropriété. */
  lignesBanque: readonly Pick<Ecriture, 'compte' | 'date' | 'libelle' | 'montant' | 'sens'>[]
  personnes: readonly CoproprietaireImputable[]
}

export const BLOCAGE_ERREUR_FICHIER =
  'Import bloqué : le fichier contient une erreur. Un relevé manquant fausserait le solde du compte et le rapprochement : corriger le fichier, puis l’analyser à nouveau.'

export const BLOCAGE_COMPTE_SANS_IBAN =
  'Import bloqué : compte choisi sans IBAN, un relevé CFONB 120 ou camt.053 ne peut pas lui être rapproché. Saisir son IBAN dans « Comptes bancaires du mandat ».'

/** Seuil de taille d'un fichier de relevé, lu en entier en mémoire (🔵 seuil provisoire du mémo, à fixer). */
export const TAILLE_MAX_RELEVE_OCTETS = 10 * 1024 * 1024

/** Refus d'un fichier trop gros, avant sa lecture ; null s'il peut être lu. */
export function refusTailleReleve(octets: number): string | null {
  if (octets <= TAILLE_MAX_RELEVE_OCTETS) return null
  const mo = (octets / (1024 * 1024)).toFixed(1).replace('.', ',')
  return `Fichier de ${mo} Mo : au-delà de ${TAILLE_MAX_RELEVE_OCTETS / (1024 * 1024)} Mo, le relevé n’est pas lu (seuil provisoire).`
}

/**
 * Marques d'ordre des octets (BOM) reconnues, comme le faisait FileReader.readAsText (détection du standard Encoding) :
 * un fichier « Texte Unicode » (UTF-16 avec sa marque, souvent séparé par des tabulations) reste lisible.
 */
const MARQUES_ORDRE_OCTETS: readonly { octets: readonly number[]; encodage: string }[] = [
  { octets: [0xef, 0xbb, 0xbf], encodage: 'utf-8' },
  { octets: [0xff, 0xfe], encodage: 'utf-16le' },
  { octets: [0xfe, 0xff], encodage: 'utf-16be' },
]

/** Encodage désigné par la marque d'ordre des octets du début du fichier ; null sans marque. */
function encodageDeLaMarque(octets: ArrayBuffer): string | null {
  const debut = new Uint8Array(octets, 0, Math.min(3, octets.byteLength))
  return MARQUES_ORDRE_OCTETS.find((marque) => marque.octets.every((octet, rang) => debut[rang] === octet))?.encodage ?? null
}

/**
 * Texte d'un fichier de relevé. Avec une marque d'ordre des octets : l'encodage qu'elle désigne (UTF-8, UTF-16), marque
 * retirée. Sans marque : UTF-8 (camt.053 déclaré en UTF-8, CFONB en ASCII), à défaut Windows-1252 (CFONB en Latin-1 avec
 * accents, hors norme mais possible). Un caractère par octet dans ce dernier cas : la longueur de 120 caractères des
 * enregistrements CFONB est préservée.
 */
export function decoderTexteReleve(octets: ArrayBuffer): string {
  const marque = encodageDeLaMarque(octets)
  if (marque) return new TextDecoder(marque).decode(octets)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets)
  } catch (erreur) {
    // Octets invalides en UTF-8 (seule erreur levée par un décodeur « fatal ») : relecture en Windows-1252.
    if (!(erreur instanceof TypeError)) throw erreur
    return new TextDecoder('windows-1252').decode(octets)
  }
}

/** Ligne de relevé d'une écriture de banque : date ISO, montant signé (débit = encaissement positif). */
const ligneDeLEcriture = (ecriture: Pick<Ecriture, 'date' | 'libelle' | 'montant' | 'sens'>): LigneReleve => ({
  date: dateVersIso(ecriture.date) || '',
  libelle: ecriture.libelle,
  montant: ecriture.sens === 'debit' ? ecriture.montant : -ecriture.montant,
})

/** Lignes déjà enregistrées comparées au relevé : voir l'en-tête. */
function lignesExistantes(entree: EntreeAnalyseReleve): LigneReleve[] {
  const comptes = entree.compte ? new Set([compteBanque(entree.compte.id), COMPTE_BANQUE_NON_RATTACHE]) : null
  return entree.lignesBanque.filter((ecriture) => comptes === null || comptes.has(ecriture.compte)).map(ligneDeLEcriture)
}

/**
 * Texte du domaine tel que l'écran le montre (décision du 26/11/2026, PR 799, rb-c08 A) : l'IBAN d'un relevé camt.053 est
 * groupé par quatre, comme partout ailleurs dans le module. Le domaine garde l'IBAN tel que lu dans le fichier.
 */
export const textePourEcran = (texte: string): string =>
  texte.replaceAll(/\bIBAN ([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/g, (_, iban: string) => `IBAN ${ibanGroupe(iban)}`)

/** Montant d'un relevé lu pour « Relevés lus » : le symbole de l'euro à la place du code « EUR » (rb-c08 A) ; autre devise : son code. */
const montantLu = (montantMineur: number, decimales: number, devise: string): string =>
  formaterMontantMineur(montantMineur, decimales, devise).replace(/ EUR$/, ' €')

/** Motif du blocage sans son préambule « Import bloqué : » (le bandeau le porte en titre), première lettre en majuscule. */
export function texteBlocage(blocage: string): string {
  const texte = blocage.replace(/^Import bloqué\s*:\s*/, '')
  return texte.charAt(0).toLocaleUpperCase('fr-FR') + texte.slice(1)
}

const releveLu = (releve: ReleveCompte, etat: ReleveLu['etat']): ReleveLu => ({
  rang: releve.rang,
  designation: textePourEcran(designationReleve(releve.rang, releve.compte, releve.dateOuverture, releve.dateCloture)),
  ancienSolde: montantLu(releve.soldeOuvertureMineur, releve.decimales, releve.devise),
  nouveauSolde: montantLu(releve.soldeClotureMineur, releve.decimales, releve.devise),
  mouvements: releve.mouvements.length,
  etat,
})

/** Avertissement des mouvements qui ressemblent à des lignes déjà enregistrées (gardés : voir l'en-tête). */
function avertissementRessemblances(lignes: readonly LigneReleve[], existantes: readonly LigneReleve[]): string[] {
  const cles = new Set(existantes.map(cleLigneReleve)),
    nombre = lignes.filter((ligne) => cles.has(cleLigneReleve(ligne))).length
  if (nombre === 0) return []
  const accord = nombre > 1 ? 'mouvements' : 'mouvement'
  return [
    `${nombre} ${accord} de même date, même montant et même libellé qu’une ligne déjà enregistrée sur ce compte : relevé peut-être déjà importé, à vérifier.`,
  ]
}

/** Avertissement des lignes retenues datées du jour du solde d'ouverture du compte choisi, ou d'avant (gardées : voir l'en-tête). */
function avertissementAvantOuverture(lignes: readonly LigneReleve[], ouverture: SoldeOuverture | null | undefined): string[] {
  if (!ouverture) return []
  const nombre = lignes.filter((ligne) => ligne.date <= ouverture.au).length
  if (nombre === 0) return []
  const au = dateIsoVersFr(ouverture.au)
  return [
    nombre > 1
      ? `${nombre} lignes datées au plus tard du ${au}, date du solde d’ouverture du compte : tenues pour déjà comprises dans ce solde, elles n’entreront pas dans le solde du compte.`
      : `1 ligne datée au plus tard du ${au}, date du solde d’ouverture du compte : tenue pour déjà comprise dans ce solde, elle n’entrera pas dans le solde du compte.`,
  ]
}

type ResultatLecture = Pick<AnalyseReleve, 'retenues' | 'doublons' | 'avertissements' | 'releves' | 'limiteEmpreintes'>

/** CSV : dédoublonnage de l'import existant, inchangé. */
function lectureCsv(lecture: LectureReleve, existantes: LigneReleve[]): ResultatLecture {
  const { retenues, doublons } = dedoublonnerReleve(lecture.lignes, existantes)
  return { retenues, doublons, avertissements: lecture.avertissements, releves: [], limiteEmpreintes: false }
}

/** Relevés structurés : dédoublonnage par relevé et par mouvement, sans empreinte d'un import précédent. */
function lectureStructuree(lecture: LectureReleve, existantes: LigneReleve[]): ResultatLecture {
  const resultat = dedoublonnerRelevesStructures(lecture.releves, { releves: [], mouvements: [] }),
    dejaImportes = new Set(resultat.dejaImportes)
  return {
    retenues: resultat.lignes,
    doublons: resultat.doublons,
    avertissements: [...lecture.avertissements, ...resultat.avertissements, ...avertissementRessemblances(resultat.lignes, existantes)],
    releves: lecture.releves.map((releve) => releveLu(releve, dejaImportes.has(releve) ? 'deja_importe' : 'nouveau')),
    // Format non reconnu : aucun relevé lu, la limite n'a rien à dire.
    limiteEmpreintes: lecture.format !== 'inconnu',
  }
}

/** Motif de blocage du fichier (voir l'en-tête) ; null : rien ne bloque. */
function blocageDuFichier(lecture: LectureReleve, compte: EntreeAnalyseReleve['compte']): string | null {
  if (lecture.format === 'csv') return null
  if (lecture.erreurs.length > 0) return BLOCAGE_ERREUR_FICHIER
  return compte && !compte.iban ? BLOCAGE_COMPTE_SANS_IBAN : null
}

/** Analyse du relevé collé ou choisi, sur le compte choisi. */
export function analyserReleve(entree: EntreeAnalyseReleve): AnalyseReleve {
  const lecture = lireReleve(entree.texte, { comptesAttendus: entree.compte?.iban ? [entree.compte.iban] : [] }),
    existantes = lignesExistantes(entree),
    resultat = lecture.format === 'csv' ? lectureCsv(lecture, existantes) : lectureStructuree(lecture, existantes)
  return {
    ...resultat,
    avertissements: [...resultat.avertissements, ...avertissementAvantOuverture(resultat.retenues, entree.compte?.soldeOuverture)],
    compteId: entree.compte?.id ?? null,
    compteIban: entree.compte?.iban ?? null,
    format: lecture.format,
    rapprochements: proposerImputations(resultat.retenues, [...entree.personnes]),
    erreurs: lecture.erreurs,
    blocage: blocageDuFichier(lecture, entree.compte),
  }
}

/**
 * Vrai si l'analyse vaut pour ce compte tel qu'il est maintenant : même compte et même IBAN. Un IBAN modifié après
 * l'analyse (« Modifier » de « Comptes bancaires du mandat ») la rend caduque : le relevé a été contrôlé contre l'ancien.
 */
export const analyseValablePour = (analyse: AnalyseReleve, compte: EntreeAnalyseReleve['compte']): boolean =>
  analyse.compteId === (compte?.id ?? null) && analyse.compteIban === (compte?.iban ?? null)
