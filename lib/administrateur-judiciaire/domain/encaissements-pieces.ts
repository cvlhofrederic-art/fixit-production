import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { numeroCompteCoproprietaire, type CompteCoproprietaire } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  mouvementsEncaissementImpute,
  type Encaissement,
  type ResultatImputation,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import type { LigneCheque, RemiseCheques } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import { formaterNumeroCompte } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import {
  propagerStatutRapproche,
  type AnomalieLienRapprochement,
  type RapprochementPiece,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-pieces'
import {
  creerTraitement,
  type FamilleTraitement,
  type LigneMouvement,
  type LiensMouvement,
  type Traitement,
} from '@/lib/administrateur-judiciaire/domain/traitements'
import { MODE_REGLEMENT, type ModeReglement } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Encaissements : n° de pièce, journal de banque, statut, état imputé et traitement ; recettes hors copropriétaires
 * (point 16 du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran ni table : les tables et
 * l'écran (avec le retrait de l'ancien circuit donnees-store.imputerEncaissement) restent à faire (Frédéric).
 *
 * Gestéam —
 * - 🟢 tranche 30 § Encaissements : recherche par Banque, Compte, Journal, Mode de règlement, N° pièce, Statut ; liste
 *   Compte (crédité) · Date · Émetteur · N° pièce · Mode · Montant · Jo(urnal) · Statut (Enregistré) ; l'encaissement
 *   crédite le 450 du copropriétaire, « mais aussi 47x et comptes de produits 7xx » pour les recettes non copropriétaires ;
 *   il est numéroté par pièce (n° de chèque / remise) et rattaché à son journal de banque et à son traitement
 *   « Encaissement » (R7) ;
 * - 🟢 tranche 43 § 2 : statut « Rapproché » après « Enregistré » ; état « Imputé » (bouton) ; Banque : Journal (BA,
 *   banque du regroupement), Cpte encais. (512 du mandat) ; Pièce : mode, N°, Banque, Détenteur (parfois un tiers payeur :
 *   le champ `payeur` de l'encaissement, PR #599), Libellé ; Reste à imputer ; Traitement (« Fichier Virement reçus ») ;
 * - tranche 29 : le code d'un journal n'est pas une clé (il se distingue par le sous-compte 512 de sa contrepartie).
 * Réutilisés : imputation-encaissements.ts (imputation et écriture R7/R8), rapprochement-pieces.ts (statut
 * « Rapproché » propagé, décision J8 : au POINTAGE), ordres-banque.ts (remise de chèques), plan-comptable.ts.
 *
 * 🟢 Lu sur Légifrance (versions en vigueur au 29/10/2026) :
 * - arrêté du 14 mars 2005, art. 4 : tout enregistrement identifie sa pièce, « date et référence du paiement » → n° de
 *   pièce (sans format imposé) ; art. 2 : livre journal, « comptabilités auxiliaires [...] ouvertes en tant que de
 *   besoin » → le journal de banque est un réglage du cabinet (D-BANQUE), aucun code « BA » imposé ; le livre journal,
 *   « tenu selon les dispositions du décret n° 83-1020 du 29 novembre 1983, enregistre chronologiquement les opérations
 *   ayant une incidence financière sur le fonctionnement du syndicat » ; art. 5 : écriture erronée annulée par une
 *   écriture contraire ; art. 7 et 8 : nomenclature fermée (47 « Compte d'attente » : 471, 472 ;
 *   71 « Autres produits » : 711 subventions, 712 emprunts, 713 indemnités d'assurances, 714 produits divers, 716
 *   produits financiers, 718 produits exceptionnels ; 78 reprises de dépréciations ; 53 « Caisse » distinct de 512) ;
 *   art. 10 : le 450 est crédité des règlements « par le débit du compte de trésorerie » ; « A réception des fonds
 *   empruntés, le compte 712 "Emprunt" est crédité par le débit du compte 51 » ; subvention : 131 crédité à la
 *   notification par le débit de 441 ou 443, « La constatation en produit au compte 711 est effectuée au fur et à
 *   mesure de la réalisation de la charge qu'elle couvre » ; le compte 47 « doit être soldé à la fin de l'exercice ou à
 *   défaut justifié ligne à ligne » ;
 * - décret n° 83-1020, art. 3 : abrogé le 27 mars 2007 par le D. 2007-431, art. 3 ; D. 2007-431 art. 2 : « Les références
 *   contenues dans les dispositions de nature réglementaire à des dispositions abrogées par l'article 3 du présent décret
 *   sont remplacées par les références aux dispositions correspondantes du code de commerce » ; C. com. R. 123-174 :
 *   « Les mouvements affectant le patrimoine de l'entreprise sont enregistrés opération par opération et jour par jour
 *   pour le livre-journal » ; « Les opérations de même nature, réalisées en un même lieu et au cours d'une même journée,
 *   peuvent être récapitulées sur une pièce justificative unique » ;
 * - L. 1965 art. 14-3, al. 2 : « L'engagement est soldé par le règlement » ; L. 1965 art. 18, II : sommes reçues sur le
 *   compte séparé du syndicat, cotisations au fonds de travaux sur un compte séparé distinct ;
 * - aucun texte ne fixe de statut d'encaissement (Enregistré, Rapproché), ni laquelle des dates bancaires (remise, valeur,
 *   relevé) fait le jour de l'encaissement.
 * 🔵 Déduit :
 * - le renvoi de l'arrêté au décret n° 83-1020, abrogé, vaut renvoi à C. com. R. 123-174 (D. 2007-431 art. 2 ; ni
 *   l'arrêté ni le code ne l'énoncent) : un traitement d'encaissements n'écrit que les opérations d'un même jour et porte
 *   la date de ce jour : une entrée reçue un autre jour est refusée, même en fin d'exercice (l'état financier, qui
 *   « présente l'état des créances et des dettes », D. 2005-240 art. 8, la compte dans l'exercice de sa réception) ; le
 *   jour d'un chèque remis est celui de sa remise (un chèque n'est pas remis avant d'être reçu) ;
 * - statut « Enregistré » à l'enregistrement, « Rapproché » propagé depuis les arrêtés (au pointage, J8), retour à
 *   « Enregistré » au dépointage, comme le règlement fournisseur (point 38) ; « imputé » = écrit dans son traitement
 *   (statut comptable, comme pour les règlements), distinct du reste à imputer sur les postes ; un encaissement pointé
 *   avant son écriture se rapproche (même règle qu'au point 38) ;
 * - n° de pièce exigé pour un chèque (le n° du chèque est sa référence de paiement) ; facultatif pour les autres modes ;
 *   un chèque entre dans une remise (son n° et son montant sont ceux de la ligne de remise, une ligne par chèque, et la
 *   remise totalise ses chèques) qui réserve son traitement (ordres-banque.ts : le traitement de rattachement d'une remise
 *   est l'encaissement) et s'écrit entière ;
 * - imputations d'un même traitement enchaînées : chaque encaissement s'impute sur les soldes laissés par le précédent
 *   (imputation-encaissements.imputerEncaissements) ; deux résultats qui imputent un même poste depuis le même réglé
 *   porteraient au 450 des origines (R8) au-delà du dû et sont refusés ;
 * - journal : compte bancaire du syndicat (D-BANQUE) et compte 512 débité, dans le segment du syndicat (D1) ; le code
 *   ne sert qu'à l'affichage ;
 * - familles d'écriture : « Encaissement » (tout mode), « Prélèvement », « Fichier TIP », « Fichier Virement reçus »
 *   (chacune pour son seul mode) ; « Relances », « Annulation d'encaissement » et « Encaissement des RNA » n'écrivent pas
 *   un encaissement ; le compte 450 crédité est calculé depuis le compte copropriétaire
 *   (identites-positions.numeroCompteCoproprietaire), jamais saisi ;
 * - recettes hors copropriétaires (crédit d'un autre compte que le 450) : comptes admis 471 et 472 (attente), 712
 *   (emprunt, art. 10), 713, 714, 716, 718 (produits encaissés), 441 et 443 (subvention notifiée : la créance constatée
 *   à la notification se solde) ; refusés : 45 (encaissement d'un copropriétaire), 70 (appels), 10 (provisions et fonds de
 *   travaux, appelés au 450), 711 (subvention : produit constaté au rythme de la charge, art. 10), 78 (reprise sans
 *   trésorerie) et tout autre compte.
 * 🔴 Non établi (questions pour Frédéric ou Hugo) :
 * - espèces : refusées ; elles entreraient au compte 53 « Caisse », que VitFix ne tient pas (même question qu'au point
 *   38) ;
 * - « Chèque impayé ou virement reçu retourné : l'encaissement passe-t-il "Annulé" sous une écriture "Annulation
 *   d'encaissement", et son imputation sur les postes est-elle défaite ? Un encaissement isolé d'un lot (fichier de
 *   virements, remise) peut-il être annulé seul ? » (VitFix : aucun statut d'annulation, rien n'est pris en charge) ;
 * - « Famille "Fichier carte bancaire" : quel mode de règlement ? » (le référentiel des modes n'a pas de carte ; refusée) ;
 * - « Faut-il admettre aussi en recette 401 ou 409 (remboursement d'un fournisseur), 461 (débiteurs divers), 487
 *   (produits encaissés d'avance) ? Une subvention versée sans notification préalable se crédite-t-elle en 711 ? » ;
 * - « Date de prise en compte d'un encaissement : remise, valeur ou relevé ? » (VitFix : le traitement est daté du jour de
 *   l'opération, qui est la date de l'encaissement — celle de la ligne du relevé à l'import — ou, pour un chèque remis, la
 *   date de la remise ; l'imputation sur les postes lit la date de l'encaissement ; le choix entre ces dates bancaires
 *   n'est fixé par aucun texte) ;
 * - cotisation au fonds de travaux encaissée sur un autre compte que le compte séparé (L. 1965 art. 18, II) : contrôle
 *   laissé au point 39 ; petites copropriétés sans partie double (L. 1965 art. 41-10) : non traitées.
 */

export const STATUTS_ENCAISSEMENT = ['Enregistré', 'Rapproché'] as const
export type StatutEncaissement = (typeof STATUTS_ENCAISSEMENT)[number]

/** Modes admis : ni « Pas de règlement », ni « Espèces » (compte 53 non tenu, 🔴). */
export type ModeEncaissement = Exclude<ModeReglement, 'Pas de règlement' | 'Espèces'>

/** Pièce de l'encaissement (Gestéam, tranche 43 § 2 : mode · N° · Banque · Libellé). */
export interface PieceEncaissement {
  mode: ModeEncaissement
  /** N° de chèque, référence du virement, du prélèvement ou du TIP. */
  numero: string | null
  /** Banque émettrice de la pièce. */
  banqueEmettrice: string | null
  /** Libellé lu sur la pièce (il peut nommer un tiers payeur). */
  libelle: string | null
  /** Remise de chèques qui porte le chèque (ordres-banque.ts) ; posée par rattacherRemise seulement. */
  remiseId: string | null
}

export interface SaisiePieceEncaissement {
  mode: ModeReglement
  numero?: string | null
  banqueEmettrice?: string | null
  libelle?: string | null
}

/** Journal de banque de l'encaissement : réglage du cabinet (D-BANQUE). */
export interface JournalEncaissement {
  /** Code affiché (« BA »…) ; jamais une clé. */
  code: string
  /** Compte bancaire du syndicat : celui des arrêtés de rapprochement. */
  banqueId: string
  /** Compte 512 débité : <syndicat>.512xx.<auxiliaire>.<repère>. */
  compteEncaissement: string
}

export interface SuiviEncaissement {
  piece: PieceEncaissement
  journal: JournalEncaissement
  statut: StatutEncaissement
  /** Gestéam « Imputé » : écrit dans son traitement (traitementEncaissements). */
  impute: boolean
  /** Traitement de la famille Encaissement qui l'écrit, ou réservé par sa remise. */
  traitementId: string | null
  /** Posé par la propagation depuis les arrêtés seulement (rapprocherEncaissements). */
  rapprochement: RapprochementPiece | null
}

/** Encaissement d'un copropriétaire (crédit de son 450), avec sa pièce, son journal et son suivi. */
export type EncaissementEnregistre = Encaissement & SuiviEncaissement

/** Recette qui ne vient pas d'un copropriétaire : crédit d'un compte d'attente, d'un produit ou d'une subvention. */
export interface RecetteHorsCoproprietaires extends SuiviEncaissement {
  id: string
  date: string
  montantCentimes: number
  /** Compte crédité : <syndicat>.<plan>.<auxiliaire>.<repère>. */
  compteCredite: string
  /** Tiers qui paie (assureur, prêteur, organisme…). */
  tiers: string | null
  libelle: string
  /** Liens de la ligne créditée (sinistre d'une indemnité, travaux d'un emprunt…). */
  liens: LiensMouvement | null
}

/** Entrée en banque : encaissement d'un copropriétaire ou recette hors copropriétaires. */
export type EntreeBanque = EncaissementEnregistre | RecetteHorsCoproprietaires

export interface SaisieRecette {
  id: string
  date: string
  montantCentimes: number
  /** Code du plan crédité, 5 chiffres (préfixe admis : COMPTES_RECETTE_HORS_COPROPRIETAIRES). */
  planCode: string
  /** Segment auxiliaire, 5 caractères ; « 00000 » par défaut. */
  auxiliaire?: string
  tiers?: string | null
  libelle: string
  piece: SaisiePieceEncaissement
  journal: JournalEncaissement
  liens?: LiensMouvement | null
}

const COMPTE_512 = /^([^.]{4})\.512[0-9A-Z]{2}\.[0-9A-Z]{5}\.[0-9A-Z]$/
const CODE_PLAN = /^\d{5}$/
const AUXILIAIRE = /^[0-9A-Z]{5}$/

const texteOuNull = (valeur: string | null | undefined): string | null => {
  const brut = valeur?.trim()
  return brut ? brut : null
}

function verifierMontantEtDate(objet: string, date: string, montantCentimes: number): void {
  if (!estDateIsoValide(date)) throw new Error(`${objet} : date invalide (${date}), AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0)
    throw new Error(`${objet} : montant invalide (${montantCentimes}), centimes entiers strictement positifs attendus.`)
}

function verifierPiece(saisie: SaisiePieceEncaissement): PieceEncaissement {
  const { mode } = saisie
  if (!(MODE_REGLEMENT as readonly string[]).includes(mode)) throw new Error(`Mode de règlement inconnu : « ${mode} ».`)
  if (mode === 'Pas de règlement') throw new Error('Mode « Pas de règlement » : aucun encaissement à enregistrer.')
  if (mode === 'Espèces')
    throw new Error(
      'Espèces : encaissement refusé ; il entrerait au compte 53 « Caisse », que VitFix ne tient pas, et non à un compte 512 (arrêté du 14 mars 2005, art. 7) ; à trancher.',
    )
  const numero = texteOuNull(saisie.numero)
  if (mode === 'Chèque' && numero === null)
    throw new Error('Chèque : numéro du chèque attendu (référence du paiement, arrêté du 14 mars 2005, art. 4).')
  return { mode, numero, banqueEmettrice: texteOuNull(saisie.banqueEmettrice), libelle: texteOuNull(saisie.libelle), remiseId: null }
}

function verifierJournal(journal: JournalEncaissement, segmentSyndicat: string): JournalEncaissement {
  if (!journal.banqueId.trim()) throw new Error('Journal sans compte bancaire du syndicat (D-BANQUE).')
  if (!journal.code.trim()) throw new Error('Journal sans code : le code s’affiche sur chaque encaissement.')
  const lu = COMPTE_512.exec(journal.compteEncaissement)
  if (!lu)
    throw new Error(`Compte d'encaissement « ${journal.compteEncaissement} » : compte 512 au format <syndicat>.512xx.<auxiliaire>.<repère> attendu.`)
  if (lu[1] !== segmentSyndicat)
    throw new Error(`Compte d'encaissement « ${journal.compteEncaissement} » : compte d'un autre syndicat (segment « ${segmentSyndicat} » attendu, D1).`)
  return { ...journal }
}

const SUIVI_INITIAL = { statut: 'Enregistré', impute: false, traitementId: null, rapprochement: null } as const

/**
 * Enregistre un encaissement de copropriétaire (imputation-encaissements.Encaissement, par exemple issu de
 * encaissementDepuisReleve) avec sa pièce et son journal : statut « Enregistré », non imputé, sans traitement ni
 * rapprochement ; l'encaissement reçu n'est pas modifié. Refuse un encaissement sans compte ou déjà enregistré, une date
 * ou un montant invalides, un mode inconnu, « Pas de règlement » ou « Espèces » (🔴), un chèque sans numéro, un journal
 * sans compte bancaire ou sans code, un compte d'encaissement qui n'est pas un 512 du syndicat (D1).
 */
export function enregistrerEncaissement(
  encaissement: Encaissement,
  { piece, journal, segmentSyndicat }: { piece: SaisiePieceEncaissement; journal: JournalEncaissement; segmentSyndicat: string },
): EncaissementEnregistre {
  if (!encaissement.id.trim()) throw new Error('Encaissement sans identifiant.')
  if ('piece' in encaissement) throw new Error(`Encaissement ${encaissement.id} déjà enregistré (pièce et journal posés).`)
  if (!encaissement.compteId.trim()) throw new Error(`Encaissement ${encaissement.id} sans compte copropriétaire crédité.`)
  verifierMontantEtDate(`Encaissement ${encaissement.id}`, encaissement.date, encaissement.montantCentimes)
  return { ...encaissement, piece: verifierPiece(piece), journal: verifierJournal(journal, segmentSyndicat), ...SUIVI_INITIAL }
}

// ─── Recettes hors copropriétaires ──────────────────────────────────────────────────────────

/** Comptes admis au crédit d'une recette hors copropriétaires : préfixe du code de plan → objet (🔵, voir l'en-tête). */
export const COMPTES_RECETTE_HORS_COPROPRIETAIRES: ReadonlyMap<string, string> = new Map([
  ['441', 'Subvention notifiée de l’État ou d’un organisme, à recevoir'],
  ['443', 'Aide notifiée d’une collectivité territoriale, à recevoir'],
  ['471', 'Compte en attente d’imputation débiteur'],
  ['472', 'Compte en attente d’imputation créditeur'],
  ['712', 'Emprunt'],
  ['713', 'Indemnités d’assurances'],
  ['714', 'Produits divers'],
  ['716', 'Produits financiers'],
  ['718', 'Produits exceptionnels'],
])

/** Comptes refusés, du plus précis au plus large, avec le circuit à suivre. */
const COMPTES_REFUSES: readonly (readonly [string, string])[] = [
  ['45', 'compte copropriétaire : enregistrer un encaissement (enregistrerEncaissement), imputé sur ses postes'],
  ['70', "appel de fonds : produit constaté au débit des comptes 450 par l'appel (traitementAppelDeFonds), jamais à l'encaissement"],
  ['10', 'provisions, avances et fonds de travaux : appelés au débit du compte 450 de chaque copropriétaire'],
  ['711', 'subvention : créditer la créance 441 ou 443 constatée à la notification ; le produit 711 suit la charge (arrêté du 14 mars 2005, art. 10)'],
  ['78', 'reprise de dépréciation : écriture sans trésorerie'],
]

const MOTIF_COMPTE_NON_ADMIS = `compte non admis (admis : ${[...COMPTES_RECETTE_HORS_COPROPRIETAIRES.keys()].join(', ')})`

function verifierPlanRecette(planCode: string): void {
  if (!CODE_PLAN.test(planCode)) throw new Error(`Code de plan « ${planCode} » : 5 chiffres attendus.`)
  if (COMPTES_RECETTE_HORS_COPROPRIETAIRES.has(planCode.slice(0, 3))) return
  const refus = COMPTES_REFUSES.find(([prefixe]) => planCode.startsWith(prefixe))
  throw new Error(`Compte ${planCode} refusé pour une recette hors copropriétaires : ${refus?.[1] ?? MOTIF_COMPTE_NON_ADMIS}.`)
}

/**
 * Enregistre une recette hors copropriétaires : compte crédité <syndicat>.<plan>.<auxiliaire>.0 (préfixe admis :
 * COMPTES_RECETTE_HORS_COPROPRIETAIRES), pièce, journal, liens, statut « Enregistré », non imputée. Refuse un code de plan
 * mal formé ou non admis (le motif dit le circuit à suivre), un auxiliaire invalide, un libellé vide, et les mêmes
 * défauts de date, de montant, de pièce et de journal qu'un encaissement.
 */
export function enregistrerRecette(saisie: SaisieRecette, { segmentSyndicat }: { segmentSyndicat: string }): RecetteHorsCoproprietaires {
  if (!saisie.id.trim()) throw new Error('Recette sans identifiant.')
  verifierMontantEtDate(`Recette ${saisie.id}`, saisie.date, saisie.montantCentimes)
  const libelle = saisie.libelle.trim()
  if (!libelle) throw new Error(`Recette ${saisie.id} : libellé attendu (identification de la pièce, arrêté du 14 mars 2005, art. 4).`)
  verifierPlanRecette(saisie.planCode)
  const auxiliaire = saisie.auxiliaire ?? '00000'
  if (!AUXILIAIRE.test(auxiliaire)) throw new Error(`Recette ${saisie.id} : auxiliaire « ${auxiliaire} », 5 caractères (chiffres ou majuscules) attendus.`)
  return {
    id: saisie.id,
    date: saisie.date,
    montantCentimes: saisie.montantCentimes,
    compteCredite: formaterNumeroCompte({ mandat: segmentSyndicat, planCode: saisie.planCode, auxiliaire }),
    tiers: texteOuNull(saisie.tiers),
    libelle,
    liens: saisie.liens ? { ...saisie.liens } : null,
    piece: verifierPiece(saisie.piece),
    journal: verifierJournal(saisie.journal, segmentSyndicat),
    ...SUIVI_INITIAL,
  }
}

/** Écriture d'une recette : débit du 512 du journal, crédit du compte de la recette (avec ses liens). */
export function mouvementsRecette(recette: RecetteHorsCoproprietaires): LigneMouvement[] {
  return [
    { compte: recette.journal.compteEncaissement, sens: 'debit', montantCentimes: recette.montantCentimes },
    { compte: recette.compteCredite, sens: 'credit', montantCentimes: recette.montantCentimes, ...(recette.liens ? { liens: { ...recette.liens } } : {}) },
  ]
}

// ─── Remise de chèques ──────────────────────────────────────────────────────────────────────

function indexerEntrees<P extends { id: string }>(entrees: P[]): Map<string, P> {
  const index = new Map<string, P>()
  for (const e of entrees) {
    if (index.has(e.id)) throw new Error(`Encaissement ${e.id} en double.`)
    index.set(e.id, e)
  }
  return index
}

function verifierChequeDeRemise(e: EntreeBanque, ligne: LigneCheque, remise: RemiseCheques): void {
  const nom = `Encaissement ${e.id} (remise ${remise.numero})`
  if (e.piece.mode !== 'Chèque') throw new Error(`${nom} : mode « ${e.piece.mode} », seul un chèque entre dans une remise.`)
  if (e.piece.numero !== ligne.numeroCheque.trim()) throw new Error(`${nom} : chèque n° ${e.piece.numero}, la remise porte le n° ${ligne.numeroCheque.trim()}.`)
  if (e.montantCentimes !== ligne.montantCentimes) throw new Error(`${nom} : ${e.montantCentimes} centimes, la remise porte ${ligne.montantCentimes} centimes.`)
  if (e.journal.banqueId !== remise.banqueId) throw new Error(`${nom} : compte bancaire « ${e.journal.banqueId} », la remise est déposée sur « ${remise.banqueId} ».`)
  if (e.date > remise.date) throw new Error(`${nom} : chèque du ${e.date}, postérieur à la remise du ${remise.date} ; un chèque n'est remis qu'une fois reçu.`)
  if (e.piece.remiseId !== null && e.piece.remiseId !== remise.id) throw new Error(`${nom} : déjà dans la remise ${e.piece.remiseId}.`)
  if (e.impute || (e.traitementId !== null && e.traitementId !== remise.traitementId))
    throw new Error(`${nom} : déjà rattaché au traitement ${e.traitementId}.`)
}

/** Une ligne par chèque : un encaissement sur deux lignes ne se rattache pas (la remise ne s'écrirait pas entière). */
function lignesDeRemise(remise: RemiseCheques): Map<string, LigneCheque> {
  const lignes = new Map<string, LigneCheque>()
  for (const l of remise.lignes) {
    if (lignes.has(l.encaissementId))
      throw new Error(`Remise ${remise.numero} : encaissement ${l.encaissementId} sur deux lignes ; une ligne de remise par chèque.`)
    lignes.set(l.encaissementId, l)
  }
  return lignes
}

/** La remise totalise ses chèques : nombre de pièces et total égaux à ceux des entrées. */
function verifierTotauxDeRemise(entrees: EntreeBanque[], remise: RemiseCheques): void {
  const total = entrees.reduce((s, e) => s + e.montantCentimes, 0)
  if (remise.nombrePieces !== entrees.length)
    throw new Error(`Remise ${remise.numero} : ${remise.nombrePieces} pièces annoncées pour ${entrees.length} chèques.`)
  if (remise.totalCentimes !== total)
    throw new Error(`Remise ${remise.numero} : total de ${remise.totalCentimes} centimes annoncé, chèques de ${total} centimes.`)
}

/**
 * Rattache les chèques d'une remise (ordres-banque.creerRemiseCheques) : chacun reçoit le n° de la remise (remiseId) et
 * le traitement qu'elle réserve. Les entrées données sont exactement les chèques de la remise (une ligne par chèque, même
 * nombre de pièces, même total) ; pour chacun, mode chèque, même n°, même montant, même compte bancaire, reçu au plus tard
 * le jour de la remise, aucune autre remise ni autre traitement. Idempotent.
 */
export function rattacherRemise<P extends EntreeBanque>(entrees: P[], remise: RemiseCheques): P[] {
  const index = indexerEntrees(entrees)
  const lignes = lignesDeRemise(remise)
  const manquante = remise.lignes.find((l) => !index.has(l.encaissementId))
  if (manquante) throw new Error(`Remise ${remise.numero} : encaissement ${manquante.encaissementId} non fourni ; passer tous les chèques de la remise.`)
  const rattaches = entrees.map((e): P => {
    const ligne = lignes.get(e.id)
    if (!ligne) throw new Error(`Encaissement ${e.id} absent de la remise ${remise.numero}.`)
    verifierChequeDeRemise(e, ligne, remise)
    return { ...e, piece: { ...e.piece, remiseId: remise.id }, traitementId: remise.traitementId }
  })
  verifierTotauxDeRemise(entrees, remise)
  return rattaches
}

// ─── Écriture ───────────────────────────────────────────────────────────────────────────────

export const FAMILLES_ENCAISSEMENT = ['Encaissement', 'Prélèvement', 'Fichier TIP', 'Fichier Virement reçus'] as const
export type FamilleEncaissement = (typeof FAMILLES_ENCAISSEMENT)[number]

/** Mode seul admis par famille (🔵 déduit des libellés) ; « Encaissement » admet tous les modes. */
const MODE_DE_FAMILLE: Partial<Record<FamilleEncaissement, ModeEncaissement>> = {
  Prélèvement: 'Prélèvement',
  'Fichier TIP': 'TIP',
  'Fichier Virement reçus': 'Virement',
}

const LISTE_FAMILLES_ENCAISSEMENT = FAMILLES_ENCAISSEMENT.map((f) => `« ${f} »`).join(', ')

function verifierFamille(famille: FamilleTraitement): FamilleEncaissement {
  if (famille === 'Fichier carte bancaire')
    throw new Error('Famille « Fichier carte bancaire » : aucun mode « carte » au référentiel des modes de règlement ; à trancher.')
  if (!(FAMILLES_ENCAISSEMENT as readonly string[]).includes(famille))
    throw new Error(`Famille « ${famille} » : un encaissement s'écrit sous ${LISTE_FAMILLES_ENCAISSEMENT}.`)
  return famille as FamilleEncaissement
}

interface ContexteEcriture {
  id: string
  famille: FamilleEncaissement
  segmentSyndicat: string
}

function verifierAEcrire(e: EntreeBanque, { id, famille, segmentSyndicat }: ContexteEcriture): void {
  if (e.impute) throw new Error(`Encaissement ${e.id} déjà écrit dans le traitement ${e.traitementId}.`)
  if (e.traitementId !== null && e.traitementId !== id)
    throw new Error(`Encaissement ${e.id} rattaché au traitement ${e.traitementId} (celui de sa remise), pas à ${id}.`)
  const mode = MODE_DE_FAMILLE[famille]
  if (mode && e.piece.mode !== mode)
    throw new Error(`Encaissement ${e.id} (${e.piece.mode}) : un traitement « ${famille} » n'écrit que des encaissements « ${mode} ».`)
  if (!e.journal.compteEncaissement.startsWith(`${segmentSyndicat}.`))
    throw new Error(`Encaissement ${e.id} : compte ${e.journal.compteEncaissement} d'un autre syndicat (segment « ${segmentSyndicat} » attendu, D1).`)
}

/** Une remise s'écrit entière, sous le traitement qu'elle réserve. Rend les remises des entrées, par identifiant. */
function verifierRemisesEntieres(entrees: EntreeBanque[], remises: RemiseCheques[], id: string): Map<string, RemiseCheques> {
  const ids = new Set(entrees.map((e) => e.id))
  const ecrites = new Map<string, RemiseCheques>()
  for (const remiseId of new Set(entrees.map((e) => e.piece.remiseId).filter((r): r is string => r !== null))) {
    const remise = remises.find((r) => r.id === remiseId)
    if (!remise) throw new Error(`Remise ${remiseId} non fournie : une remise de chèques s'écrit entière, dans son traitement.`)
    if (remise.traitementId !== id) throw new Error(`Remise ${remise.numero} : traitement ${remise.traitementId}, pas ${id}.`)
    const manquante = remise.lignes.find((l) => !ids.has(l.encaissementId))
    if (manquante) throw new Error(`Remise ${remise.numero} : encaissement ${manquante.encaissementId} non fourni ; la remise s'écrit entière.`)
    ecrites.set(remiseId, remise)
  }
  return ecrites
}

/**
 * Le traitement porte le jour de l'opération de chaque entrée (C. com. R. 123-174, 🔵 voir l'en-tête) : celui de
 * l'encaissement ou de la recette, ou, pour un chèque remis, celui de sa remise.
 */
function verifierJourDeLOperation(e: EntreeBanque, remises: ReadonlyMap<string, RemiseCheques>, date: string): void {
  const remise = e.piece.remiseId === null ? undefined : remises.get(e.piece.remiseId)
  if (remise && remise.date !== date)
    throw new Error(
      `Encaissement ${e.id} (remise ${remise.numero} du ${remise.date}) : traitement daté du ${date} ; un chèque remis s'écrit au jour de sa remise (C. com. R. 123-174).`,
    )
  if (!remise && e.date !== date)
    throw new Error(
      `Encaissement ${e.id} du ${e.date} : traitement daté du ${date} ; le livre journal enregistre jour par jour (C. com. R. 123-174) : écrire l'entrée dans un traitement de son jour.`,
    )
}

interface ImputationSurPoste {
  encaissementId: string
  /** Réglé du poste avant ce résultat, puis après. */
  avant: number
  apres: number
}

/** Pour chaque poste imputé, le réglé avant et après chaque résultat qui l'impute (lus dans resultat.postes). */
function imputationsParPoste(resultats: ResultatImputation[]): Map<string, ImputationSurPoste[]> {
  const parPoste = new Map<string, ImputationSurPoste[]>()
  for (const r of resultats) {
    const imputeSur = new Map<string, number>()
    for (const l of r.lignes) imputeSur.set(l.posteId, (imputeSur.get(l.posteId) ?? 0) + l.montantCentimes)
    for (const [posteId, impute] of imputeSur) {
      const poste = r.postes.find((p) => p.id === posteId)
      if (!poste) continue // poste imputé absent du résultat : refusé par mouvementsEncaissementImpute
      const apres = poste.regleCentimes
      parPoste.set(posteId, [...(parPoste.get(posteId) ?? []), { encaissementId: r.encaissementId, avant: apres - impute, apres }])
    }
  }
  return parPoste
}

/**
 * Imputations enchaînées : sur chaque poste, chaque résultat part du réglé laissé par le précédent, quel que soit
 * l'ordre des entrées ; deux résultats calculés sur le même état des postes porteraient au 450 des origines (R8) au-delà
 * du dû.
 */
function verifierImputationsEnchainees(resultats: ResultatImputation[]): void {
  for (const [posteId, imputations] of imputationsParPoste(resultats)) {
    const ordonnees = [...imputations].sort((a, b) => a.avant - b.avant)
    for (let i = 1; i < ordonnees.length; i++) {
      const [precedente, suivante] = [ordonnees[i - 1], ordonnees[i]]
      if (suivante.avant !== precedente.apres)
        throw new Error(
          `Poste ${posteId} imputé par ${precedente.encaissementId} et ${suivante.encaissementId} : le second part d'un réglé de ${suivante.avant} centimes au lieu de ${precedente.apres} ; imputer les encaissements d'un même traitement ensemble (imputerEncaissements), chacun sur les soldes laissés par le précédent.`,
        )
    }
  }
}

function compte450(e: EncaissementEnregistre, comptes: CompteCoproprietaire[], segmentSyndicat: string): string {
  const compte = comptes.find((c) => c.id === e.compteId)
  if (!compte) throw new Error(`Encaissement ${e.id} : compte copropriétaire « ${e.compteId} » introuvable.`)
  return numeroCompteCoproprietaire(compte, segmentSyndicat)
}

/**
 * Écriture, en un traitement de la famille Encaissement (R6), d'encaissements de copropriétaires imputés et de recettes
 * hors copropriétaires d'un même jour : par encaissement, débit du 512 de son journal et crédit du 450 du compte
 * (calculé depuis le compte copropriétaire, D1), une ligne par poste imputé portant l'appel d'origine, plus le reliquat
 * (imputation-encaissements.mouvementsEncaissementImpute, R7 et R8) ; par recette, mouvementsRecette. Les entrées sont
 * rendues imputées et rattachées au traitement. Refuse une famille hors encaissement ou « Fichier carte bancaire » (🔴),
 * un mode étranger à la famille, une entrée déjà écrite, en double, rattachée à un autre traitement, d'un autre syndicat,
 * d'un autre jour que le traitement (pour un chèque remis : le jour de sa remise ; C. com. R. 123-174), un compte
 * copropriétaire introuvable, une remise incomplète ou non fournie, des imputations qui ne s'enchaînent pas sur un même
 * poste (les résultats d'imputerEncaissements s'enchaînent ; ils doivent partir de l'état courant des postes).
 */
export function traitementEncaissements(
  {
    encaissements = [],
    recettes = [],
    remises = [],
  }: {
    encaissements?: { encaissement: EncaissementEnregistre; resultat: ResultatImputation }[]
    recettes?: RecetteHorsCoproprietaires[]
    remises?: RemiseCheques[]
  },
  {
    id,
    date,
    famille = 'Encaissement',
    segmentSyndicat,
    comptes,
  }: { id: string; date: string; famille?: FamilleTraitement; segmentSyndicat: string; comptes: CompteCoproprietaire[] },
): { traitement: Traitement; encaissements: EncaissementEnregistre[]; recettes: RecetteHorsCoproprietaires[] } {
  if (!id.trim()) throw new Error("Traitement d'encaissements sans identifiant.")
  if (!estDateIsoValide(date)) throw new Error(`Date du traitement invalide (${date}) : AAAA-MM-JJ attendu.`)
  const familleEcrite = verifierFamille(famille)
  const entrees: EntreeBanque[] = [...encaissements.map((l) => l.encaissement), ...recettes]
  if (entrees.length === 0) throw new Error("Traitement d'encaissements : aucun encaissement.")
  indexerEntrees(entrees)
  entrees.forEach((e) => verifierAEcrire(e, { id, famille: familleEcrite, segmentSyndicat }))
  const remisesEcrites = verifierRemisesEntieres(entrees, remises, id)
  entrees.forEach((e) => verifierJourDeLOperation(e, remisesEcrites, date))
  verifierImputationsEnchainees(encaissements.map((l) => l.resultat))
  const mouvements: LigneMouvement[] = [
    ...encaissements.flatMap(({ encaissement, resultat }) =>
      mouvementsEncaissementImpute({
        encaissement,
        resultat,
        compteBanque: encaissement.journal.compteEncaissement,
        compteCoproprietaire: compte450(encaissement, comptes, segmentSyndicat),
      }),
    ),
    ...recettes.flatMap(mouvementsRecette),
  ]
  const traitement = creerTraitement({ id, famille: familleEcrite, date, mouvements })
  return {
    traitement,
    encaissements: encaissements.map(({ encaissement }): EncaissementEnregistre => ({ ...encaissement, impute: true, traitementId: id })),
    recettes: recettes.map((r): RecetteHorsCoproprietaires => ({ ...r, impute: true, traitementId: id })),
  }
}

// ─── Rapprochement ──────────────────────────────────────────────────────────────────────────

/**
 * Statut « Rapproché » propagé depuis les arrêtés (rapprochement-pieces.ts, type « encaissement », au pointage : J8) :
 * une entrée « Enregistré » pointée passe « Rapproché » avec la trace de son rapprochement, une entrée dépointée revient
 * « Enregistré » ; le compte bancaire de l'entrée est celui de son journal. Encaissements et recettes se rapprochent
 * ensemble (identifiants uniques) ; une ligne de relevé d'une remise porte tous ses chèques. Passer toutes les entrées
 * des comptes concernés. L'ordre reçu est conservé.
 */
export function rapprocherEncaissements<P extends EntreeBanque>(
  entrees: P[],
  arretes: ArreteRapprochement[],
  { aLaDate }: { aLaDate?: string } = {},
): { entrees: P[]; anomalies: AnomalieLienRapprochement[] } {
  const { pieces, anomalies } = propagerStatutRapproche(
    entrees.map((e) => ({ id: e.id, statut: e.statut, montantCentimes: e.montantCentimes, banqueId: e.journal.banqueId, rapprochement: e.rapprochement })),
    arretes,
    { type: 'encaissement', rapproche: 'Rapproché', avant: 'Enregistré', aLaDate },
  )
  return { entrees: entrees.map((e, i): P => ({ ...e, statut: pieces[i].statut, rapprochement: pieces[i].rapprochement })), anomalies }
}
