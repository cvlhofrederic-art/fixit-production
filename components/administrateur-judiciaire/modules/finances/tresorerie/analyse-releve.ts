import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { COMPTE_BANQUE_NON_RATTACHE, compteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { ibanGroupe } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { dateIsoVersFr, dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  dedoublonnerRelevesStructures,
  type ComparaisonReleve,
  type ReleveReconnu,
} from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
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
import { dejaImporteSurCompte, type ReleveImporte, type ReleveRepris } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'

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
 *   mouvements identiques d'un relevé dont le solde vient d'être contrôlé). Décision du 26/11/2026 du référent métier
 *   (PR 799, points 10 B et 11 B) : les relevés importés sont gardés (table « relevesImportes ») avec, sur chaque ligne,
 *   les informations de son mouvement ; ceux de la copropriété sont relus ici (dejaImporteSurCompte). Un relevé déjà
 *   importé est reconnu : ses mouvements sont écartés, relevé par relevé, et les autres relevés du fichier
 *   restent importables (🔵 choix : chaque relevé retenu a son solde contrôlé, l'écarter ne fausse pas les autres, et
 *   une banque redonne souvent dans un fichier des relevés déjà transmis ; bloquer tout le fichier obligerait à le
 *   retoucher à la main). L'analyse le dit par un message par relevé (`relevesDejaImportes`), hors des avertissements.
 *   Un mouvement d'un relevé nouveau déjà importé d'un autre relevé (même référence de la banque) est écarté seul.
 *   Les relevés nouveaux, avec leurs mouvements repris, sont rendus pour être gardés à l'import (`relevesAImporter`) ;
 *   un relevé nouveau sans mouvement repris en fait partie (il est gardé pour son solde de clôture).
 * - Retours de la relecture du 27/11/2026. Le relevé est comparé aux relevés gardés de TOUTE la copropriété, et non à
 *   ceux de la seule fiche de compte choisie : deux fiches peuvent porter le même IBAN (fiche clôturée puis recréée,
 *   saisie en double ; domain/comptes-bancaires.ts : « deux fiches d'un même IBAN sont un seul compte »), et le même
 *   relevé écrit sur les deux serait compté deux fois dans la trésorerie du syndicat. La comparaison du domaine porte
 *   sur le compte en banque du relevé (IBAN ou RIB) : un relevé d'un autre compte en banque n'est jamais confondu. Le
 *   message dit sur quelle fiche le relevé a été importé (`comptes`). Même identifiant qu'un relevé gardé mais contenu
 *   différent : ce n'est pas le même relevé, il n'est pas dit « déjà importé » ; il a ses messages (`relevesAVerifier`)
 *   et son état (« a_verifier »).
 * - Réponse du référent métier du 28/11/2026 (point #858 · 2, choix A) : ce relevé reste refusé, et l'écran dit quoi
 *   faire, « demander à la banque un relevé sous un nouvel identifiant » (`motifsAVerifier`,
 *   MARCHES_A_SUIVRE_RELEVE_A_VERIFIER). Un relevé sans identifiant commun avec un relevé gardé (CFONB 120), de même
 *   compte et de même période (mêmes dates de début et de fin) mais de soldes ou de totaux différents, est traité de
 *   même (domain/import/doublons-releves.ts, comparaison « periode ») : non repris, à vérifier, avec sa marche à suivre
 *   (🔵 texte proposé, à valider : un relevé sur une autre période, seule issue que le dédoublonnage laisse sans
 *   identifiant de relevé).
 * - Lignes sans relevé gardé (CSV, import antérieur à la table : aucune empreinte, et aucune n'est inventée) : un relevé
 *   qui les contient n'est pas reconnu ; l'analyse d'un relevé structuré le dit (`limiteEmpreintes`), en distinguant les
 *   lignes du compte choisi des lignes non rattachées à un compte (« 512 » seul). 🔴 Non traité : de telles lignes sur
 *   une autre fiche du même IBAN ne sont pas signalées. Un mouvement de même date, montant et libellé qu'une telle ligne
 *   est gardé, avec un avertissement, comme avant. Réponse du référent métier du 28/11/2026 (point #858 · 6, choix A) :
 *   la limite n'est dite que « si la période du relevé analysé recouvre la date de ces lignes », c'est-à-dire si une de
 *   ces lignes au moins est datée dans la période d'un relevé lu du fichier, bornes comprises ; seules ces lignes
 *   décident de ce qui est dit (du compte, non rattachées, ou les deux). 🔵 Choix déduits, à valider : fichier de
 *   plusieurs relevés, la période de chacun compte, qu'il soit nouveau ou déjà importé ; une ligne à la date illisible
 *   est tenue pour datée dans la période (on ne peut pas l'exclure).
 * - Import bloqué (`blocage`) : fichier structuré ou non reconnu dont la lecture a rendu une erreur (relevé refusé,
 *   fichier illisible) ; les relevés lus restent montrés. Compte choisi sans IBAN : un relevé structuré ne peut pas lui
 *   être rapproché. Un CSV garde son comportement : lignes non lues signalées, les autres importables.
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
  /**
   * « deja_importe » : même relevé plus haut dans le fichier ; « importe_avant » : relevé gardé d'un import précédent
   * (sur ce compte ou sur une autre fiche du même compte en banque) ; « a_verifier » : même identifiant qu'un relevé gardé,
   * contenu différent, ou, sans identifiant commun, même période et soldes ou totaux différents. Dans les trois cas,
   * aucun de ses mouvements n'est repris.
   */
  etat: 'nouveau' | 'deja_importe' | 'importe_avant' | 'a_verifier'
}

/** Ce qui fait écarter un relevé « à vérifier » : l'identifiant d'un relevé gardé, ou sa période (relevé sans identifiant commun). */
export type MotifAVerifier = Exclude<ComparaisonReleve, 'identique'>

/**
 * Marche à suivre dite dans le bandeau « Relevé non repris, à vérifier », une par motif (réponse du référent métier du
 * 28/11/2026, point #858 · 2, choix A : « dire à l'écran quoi faire (demander à la banque un relevé sous un nouvel
 * identifiant) »). 🔵 Texte du motif « periode » proposé, à valider : sans identifiant de relevé, un relevé n'est tenu
 * pour distinct d'un relevé gardé du même compte que si sa période diffère.
 */
export const MARCHES_A_SUIVRE_RELEVE_A_VERIFIER: Record<MotifAVerifier, string> = {
  identifiant: 'Marche à suivre : demander à la banque un relevé sous un nouvel identifiant.',
  periode: 'Marche à suivre : demander à la banque un relevé sur une autre période (un relevé CFONB 120 n’a pas d’identifiant).',
}

/** Ordre dans lequel les marches à suivre sont dites. */
const MOTIFS_A_VERIFIER: readonly MotifAVerifier[] = ['identifiant', 'periode']

/**
 * Lignes sans relevé gardé qui limitent la reconnaissance d'un relevé : celles du compte choisi, celles qui ne sont
 * rattachées à aucun compte (« 512 » seul), ou les deux.
 */
export type LimiteEmpreintes = 'compte' | 'non_rattachees' | 'compte_et_non_rattachees'

/** Fiche de compte bancaire de la copropriété, telle que l'écran la nomme (« Compte principal · …0189 »). */
export interface CompteNomme {
  id: string
  libelle: string
  /** Fiche clôturée. */
  cloture: boolean
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
  /**
   * Relevé structuré : des lignes sans relevé gardé (CSV, import antérieur à la table), datées dans la période d'un relevé
   * lu du fichier, existent sur le compte, ou sans compte ; un relevé qui les contient n'est pas reconnu (voir
   * l'en-tête). Null : aucune.
   */
  limiteEmpreintes: LimiteEmpreintes | null
  /**
   * Un message par relevé du fichier déjà importé lors d'un import précédent, sur ce compte ou sur une autre fiche de la
   * copropriété (bandeau de l'écran).
   */
  relevesDejaImportes: string[]
  /**
   * Un message par relevé du fichier non repris pour son identifiant, celui d'un relevé gardé d'un autre contenu, ou pour
   * sa période, celle d'un relevé gardé du même compte aux soldes ou aux totaux différents (relevé sans identifiant commun).
   */
  relevesAVerifier: string[]
  /** Motifs de ces relevés, chacun une fois, « identifiant » avant « periode » : une marche à suivre par motif. */
  motifsAVerifier: MotifAVerifier[]
  /** Relevés nouveaux du fichier, chacun avec ses mouvements repris : à garder à l'import (vide pour un CSV). */
  relevesAImporter: ReleveRepris[]
}

export interface EntreeAnalyseReleve {
  texte: string
  /** Compte bancaire choisi ; null : aucun. */
  compte: { id: string; iban: string | null } | null
  /** Écritures de banque (« 512 » et sous-comptes) du journal de la copropriété, avec leur origine (`releve`) si elles en ont une. */
  lignesBanque: readonly Pick<Ecriture, 'compte' | 'date' | 'libelle' | 'montant' | 'sens' | 'releve'>[]
  personnes: readonly CoproprietaireImputable[]
  /** Relevés importés gardés de la copropriété, toutes ses fiches de compte : tous sont comparés. Absent : aucun. */
  relevesImportes?: readonly ReleveImporte[]
  /** Fiches de compte de la copropriété, actives et clôturées, pour dire sur laquelle un relevé a été importé. Absent : aucune. */
  comptes?: readonly CompteNomme[]
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
  texte
    .replaceAll(/\bIBAN ([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/g, (_, iban: string) => `IBAN ${ibanGroupe(iban)}`)
    // Nom court d'une fiche (« Compte principal · …7849 ») : « … » et les quatre chiffres restent sur la même ligne (joint insécable).
    .replaceAll(/…(?=\d)/g, '…⁠')

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

type ResultatLecture = Pick<
  AnalyseReleve,
  | 'retenues'
  | 'doublons'
  | 'avertissements'
  | 'releves'
  | 'limiteEmpreintes'
  | 'relevesDejaImportes'
  | 'relevesAVerifier'
  | 'motifsAVerifier'
  | 'relevesAImporter'
>

/** CSV : dédoublonnage de l'import existant, inchangé ; ni relevé à garder, ni relevé reconnu. */
function lectureCsv(lecture: LectureReleve, existantes: LigneReleve[]): ResultatLecture {
  const { retenues, doublons } = dedoublonnerReleve(lecture.lignes, existantes)
  return {
    retenues,
    doublons,
    avertissements: lecture.avertissements,
    releves: [],
    limiteEmpreintes: null,
    relevesDejaImportes: [],
    relevesAVerifier: [],
    motifsAVerifier: [],
    relevesAImporter: [],
  }
}

/** « ses 4 mouvements ne sont pas repris », « son mouvement n'est pas repris », « aucun mouvement ». */
function mouvementsNonRepris(nombre: number): string {
  if (nombre === 0) return 'aucun mouvement'
  return nombre === 1 ? 'son mouvement n’est pas repris' : `ses ${nombre} mouvements ne sont pas repris`
}

/**
 * « sur ce compte le JJ/MM/AAAA » pour un relevé gardé sur la fiche choisie ; sinon « le JJ/MM/AAAA sur un autre compte de
 * la copropriété », avec le nom de la fiche quand l'écran la connaît, et « clôturé » si elle l'est.
 */
function ouEtQuand(garde: ReleveImporte, entree: EntreeAnalyseReleve): string {
  const le = dateIsoVersFr(garde.dateImport)
  if (garde.banqueId === entree.compte?.id) return `sur ce compte le ${le}`
  const fiche = entree.comptes?.find((compte) => compte.id === garde.banqueId),
    nom = fiche ? ` (« ${fiche.libelle} »${fiche.cloture ? ', clôturé' : ''})` : ''
  return `le ${le} sur un autre compte de la copropriété${nom}`
}

/** Message d'un relevé du fichier reconnu dans un relevé gardé d'un import précédent : où et quand il a été importé. */
function messageDejaImporte({ releve, comparaison }: ReleveReconnu, garde: ReleveImporte, entree: EntreeAnalyseReleve): string {
  const designation = designationReleve(releve.rang, releve.compte, releve.dateOuverture, releve.dateCloture),
    ou = ouEtQuand(garde, entree)
  if (comparaison === 'identifiant')
    return (
      `${designation} : même identifiant « ${releve.identifiant ?? ''} » qu’un relevé importé ${ou}, mais période, soldes ou ` +
      'totaux différents ; relevé non repris, à vérifier.'
    )
  if (comparaison === 'periode')
    return `${designation} : même période qu’un relevé importé ${ou}, mais soldes ou totaux différents ; relevé non repris, à vérifier.`
  return `${designation} : déjà importé ${ou}, ${mouvementsNonRepris(releve.mouvements.length)}.`
}

/**
 * Vrai si la date est dans la période d'un des relevés, bornes comprises (réponse du 28/11/2026, point #858 · 6 A). Date
 * illisible : tenue pour dans la période, faute de pouvoir l'exclure.
 */
function dansUnePeriode(date: unknown, releves: readonly ReleveCompte[]): boolean {
  const iso = dateVersIso(date)
  return iso === null || releves.some((releve) => releve.dateOuverture <= iso && iso <= releve.dateCloture)
}

/**
 * Limite des lignes sans relevé gardé : voir l'en-tête ; null sans compte choisi, ou sans aucune de ces lignes datée dans
 * la période d'un relevé lu du fichier.
 */
function limiteDesEmpreintes(entree: EntreeAnalyseReleve, sousCompte: string | null, releves: readonly ReleveCompte[]): LimiteEmpreintes | null {
  if (sousCompte === null) return null
  const sansReleve = entree.lignesBanque.filter((ecriture) => !ecriture.releve && dansUnePeriode(ecriture.date, releves)),
    duCompte = sansReleve.some((ecriture) => ecriture.compte === sousCompte),
    nonRattachees = sansReleve.some((ecriture) => ecriture.compte === COMPTE_BANQUE_NON_RATTACHE)
  if (duCompte) return nonRattachees ? 'compte_et_non_rattachees' : 'compte'
  return nonRattachees ? 'non_rattachees' : null
}

/** Relevés du fichier reconnus dans un relevé gardé d'un import précédent, avec ce relevé gardé (les autres : déjà dans le fichier). */
function reconnusAvant(reconnus: readonly ReleveReconnu[], gardes: readonly ReleveImporte[]): Map<ReleveCompte, { reconnu: ReleveReconnu; garde: ReleveImporte }> {
  const avant = new Map<ReleveCompte, { reconnu: ReleveReconnu; garde: ReleveImporte }>()
  for (const reconnu of reconnus) {
    const garde = gardes.find((candidat) => candidat === reconnu.connu)
    if (garde) avant.set(reconnu.releve, { reconnu, garde })
  }
  return avant
}

/**
 * Relevés structurés : dédoublonnage par relevé et par mouvement, contre les relevés gardés de la copropriété (toutes ses
 * fiches de compte) et les lignes qui en viennent (voir l'en-tête). Sans compte choisi, rien n'est comparé : l'import est
 * de toute façon impossible.
 */
function lectureStructuree(lecture: LectureReleve, existantes: LigneReleve[], entree: EntreeAnalyseReleve): ResultatLecture {
  const sousCompte = entree.compte ? compteBanque(entree.compte.id) : null,
    gardes = entree.compte ? (entree.relevesImportes ?? []) : [],
    resultat = dedoublonnerRelevesStructures(
      lecture.releves,
      // Seules les lignes venues d'un de ces relevés gardés donnent une empreinte, sur quelque fiche qu'elles soient.
      dejaImporteSurCompte(
        gardes,
        entree.lignesBanque.map((ecriture) => ({ date: dateVersIso(ecriture.date) || '', releve: ecriture.releve })),
      ),
    ),
    // Relevés d'un import précédent : dits à part, avec la date et le compte de cet import, et non dans les avertissements.
    avant = [...reconnusAvant(resultat.reconnus, gardes)],
    etats = new Map(avant.map(([releve, { reconnu }]) => [releve, reconnu.comparaison === 'identique' ? 'importe_avant' : 'a_verifier'] as const)),
    // Relevés à vérifier (même identifiant, ou même période sans identifiant commun), dans l'ordre du fichier.
    aVerifier = avant.filter(([, { reconnu }]) => reconnu.comparaison !== 'identique'),
    ditsAPart = new Set(avant.map(([, { reconnu }]) => reconnu.avertissement)),
    dejaDansLeFichier = new Set(resultat.dejaImportes),
    ecartes = new Set(resultat.doublons),
    etat = (releve: ReleveCompte): ReleveLu['etat'] => etats.get(releve) ?? (dejaDansLeFichier.has(releve) ? 'deja_importe' : 'nouveau'),
    messages = (reconnus: typeof avant): string[] => reconnus.map(([, { reconnu, garde }]) => messageDejaImporte(reconnu, garde, entree))
  return {
    retenues: resultat.lignes,
    doublons: resultat.doublons,
    avertissements: [
      ...lecture.avertissements,
      ...resultat.avertissements.filter((avertissement) => !ditsAPart.has(avertissement)),
      ...avertissementRessemblances(resultat.lignes, existantes),
    ],
    releves: lecture.releves.map((releve) => releveLu(releve, etat(releve))),
    // Lignes du compte, ou non rattachées (compte inconnu), sans relevé gardé, datées dans la période d'un relevé lu : un
    // relevé qui les contient n'est pas reconnu. Format non reconnu : aucun relevé lu, la limite n'a rien à dire.
    limiteEmpreintes: lecture.format === 'inconnu' ? null : limiteDesEmpreintes(entree, sousCompte, lecture.releves),
    relevesDejaImportes: messages(avant.filter(([, { reconnu }]) => reconnu.comparaison === 'identique')),
    relevesAVerifier: messages(aVerifier),
    motifsAVerifier: MOTIFS_A_VERIFIER.filter((motif) => aVerifier.some(([, { reconnu }]) => reconnu.comparaison === motif)),
    relevesAImporter: resultat.nouveaux.map((releve) => ({ releve, repris: releve.mouvements.filter((mouvement) => !ecartes.has(mouvement)) })),
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
    resultat = lecture.format === 'csv' ? lectureCsv(lecture, existantes) : lectureStructuree(lecture, existantes, entree)
  return {
    ...resultat,
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
