import { MODES_TENUE_COMPTES, NATURES_COMPTE_BANCAIRE, validerIban, type ModeTenueComptes, type NatureCompteBancaire } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { refLoi1965 } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { statutPositionA, type Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  verifierIdentifiantsVirement,
  type LigneVirement,
  type OrdreVirement,
  type StatutOrdre,
} from '@/lib/administrateur-judiciaire/domain/ordres-banque'
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
 * Règlements fournisseurs : objet et cycle (point 38 du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS, dates
 * ISO, sans écran ni table (la table `reglements` du schéma reste une coquille : à refaire par Frédéric).
 *
 * Gestéam —
 * - tranche 36 § Règlements : liste Date · N° · Mode · Bénéficiaire · Montant · Statut ; fiche : Statut, Traitement,
 *   Journal, Compte, Libellé, Montant, Mode, N° de pièce, Ordre de banque, IBAN, Bénéficiaire (Fournisseur, Mandant,
 *   Indivisaire, Client), grille de répartition Mandat · Origine · Montant ;
 * - tranche 43 § 10 : détail des règlements, une ligne par facture réglée : Échéance · Imputé · Statut ; Traitement
 *   « Règlement de factures » ; Immeuble · Mandat · Compte (401 du fournisseur) ; Facture · Demande · Contrat · Travaux ·
 *   Tranche ; Libellé · Montant · Mode · Contrepartie (512) ; statuts Demandé · À régler · Enregistré · Rapproché ·
 *   Annulé ; statut comptable Imputé / Non imputé ;
 * - tranche 43 § 12 : l'ordre de banque est une ligne d'un lot rattachée au traitement « Règlement de factures » ; il passe
 *   d'« Enregistré » à « Émis » quand le fichier part.
 * VitFix : ReglementFournisseur = la ligne du détail (un syndicat, un mandat, un compte payeur). La grille Mandat ·
 * Origine · Montant de Gestéam est la liste des règlements d'un même paiement, pas une répartition interne au règlement.
 *
 * 🟢 Lu sur le texte (Légifrance, versions en vigueur au 29/10/2026) :
 * - L. 1965 art. 14-3, al. 2 : les charges sont enregistrées dès leur engagement juridique, « l'engagement est soldé par
 *   le règlement » → le règlement d'une facture débite le 401 crédité à la saisie de la facture, jamais la charge ;
 * - arrêté du 14 mars 2005, art. 3 : les opérations sont enregistrées « dans les comptes dont l'intitulé correspond à
 *   leur nature » ; art. 7 : « 512 Banques » et « 53 Caisse » sont deux comptes distincts ; art. 8 : ces comptes sont
 *   les seuls utilisables par le syndic ;
 * - arrêté du 14 mars 2005, art. 4 : tout enregistrement identifie sa pièce, « date et référence du paiement » → n° de
 *   pièce (chèque, identifiant du virement) ; art. 5 : « une écriture erronée est annulée par une écriture contraire » ;
 *   art. 9 : aucune compensation entre comptes ; art. 10 : le 450 enregistre les dettes du syndicat envers chaque
 *   copropriétaire → un remboursement à un copropriétaire débite son 450 ;
 * - arrêté du 16 août 1999 (contrôle des administrateurs judiciaires), annexe, 1re partie, II, 2, D : « Contrôle des
 *   mouvements en espèces » (carnet de reçus) ;
 * - L. 1965 art. 18, II, al. 3 et 4 : compte séparé du syndicat et compte séparé du fonds de travaux, sans convention de
 *   fusion ni compensation ;
 * - C. civ. art. 1342-2 : « le paiement doit être fait au créancier ou à la personne désignée pour le recevoir » →
 *   bénéficiaire typé, pas un texte libre ;
 * - aucun des textes lus ne fixe de cycle de statuts pour un règlement : le cycle est une règle de GESTION (Gestéam).
 * 🔵 Déduit :
 * - sens des statuts : « Demandé » = règlement préparé, hors de tout ordre ; « À régler » = dans un ordre de virement
 *   non émis ; « Enregistré » = ordre émis, ou chèque, prélèvement ou TIP constaté hors ordre ; « Rapproché » = pointé
 *   dans un arrêté (propagé seulement, par rapprochement-pieces.ts : au pointage, hypothèse de travail, voir son 🔴) ;
 *   « Annulé » = abandonné avant tout paiement ;
 * - un virement ne se paie que par un ordre de virement (identifiant de bout en bout = n° de pièce, unique dans
 *   l'ordre) ; un ordre ne se compose que de règlements, exactement ceux de ses lignes, tous d'une même famille (il n'a
 *   qu'un traitement) ; une ligne groupée garde ses règlements (reglementIds), jamais son identifiant synthétique ;
 * - écriture et imputation au paiement seulement : traitementReglements ne prend que des règlements payés
 *   (« Enregistré » ou « Rapproché ») et les rend imputés, rattachés au traitement qui porte leur propre paire débit /
 *   crédit. Dans VitFix, un traitement compte dès qu'il existe (balance, grand livre : etats-comptables.ts) : passée
 *   avant le paiement, l'écriture d'un règlement sorti de son ordre ou annulé resterait sans écriture contraire (arrêté
 *   du 14 mars 2005, art. 5). Aucune écriture n'existe donc pour un règlement demandé, à régler, sorti ou annulé ; un
 *   règlement imputé n'entre dans aucun autre traitement. Le traitement Gestéam qui produit l'ordre (tranche 43 § 10 et
 *   § 12) n'est ici que l'identifiant traitementId de l'ordre, sous lequel l'écriture de tous ses règlements est passée
 *   en une fois, avec l'ordre émis : jamais en partie, jamais avec un règlement hors de l'ordre ;
 * - contrepartie : un compte 512 du syndicat (D1) ; chaque part d'un paiement a la sienne ;
 * - paiement sur plusieurs mandats, syndicats ou comptes : seulement depuis le compte centralisateur du cabinet
 *   (décision D-BANQUE), jamais avec le compte du fonds de travaux ; un paiement groupé sur ce seul compte, pour un seul
 *   mandat, n'est pas visé ;
 * - type de bénéficiaire fermé (fournisseur, copropriétaire, indivisaire) : Mandant, Propriétaire et Cpte gérance
 *   relèvent de la gérance, hors champ ; la paie du personnel du syndicat n'y entre pas (point 42 : compte 421).
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - paiement en espèces : refusé ici ; il sortirait du compte 53 « Caisse » et non d'un 512 (arrêté du 14 mars 2005,
 *   art. 3 et 7), compte que le domaine ne tient pas, avec le contrôle des espèces propre à l'administrateur judiciaire
 *   (carnet de reçus, arrêté du 16 août 1999) ; à modéliser avec une contrepartie 53, hors rapprochement bancaire ;
 * - Gestéam passe-t-il l'écriture du « Règlement de factures » dès le traitement qui produit l'ordre (imputée plus
 *   tard), ou au paiement ? Non observé ; VitFix l'écrit au paiement (ci-dessus) ;
 * - annulation après émission (virement rejeté ou retourné) : refusée ici ; elle demanderait une écriture contraire
 *   (« Annulation de règlements ») et un retour de la facture, que statuts-facture.ts n'admet pas depuis « Réglée » ;
 * - contre-passation du traitement d'un règlement (annulerTraitement de traitements.ts, famille « Annulation de
 *   règlements ») : non prise en charge ici ; le règlement reste « Enregistré », imputé et rattaché au traitement
 *   annulé, et ne peut ni être réécrit ni passer « Annulé ». Question : une fois son traitement contre-passé, le
 *   règlement redevient-il « Non imputé » (à réécrire dans un nouveau traitement), passe-t-il « Annulé », ou reste-t-il
 *   « Enregistré » imputé avec un renvoi vers l'annulation, et la facture qu'il réglait quitte-t-elle « Réglée » ?
 * - créances nées avant la désignation (L. 1965 art. 29-3, I et II : suspension de l'exigibilité) : aucun blocage ici ;
 * - bénéficiaire indivisaire : à qui payer (mandataire commun de L. 1965 art. 23, al. 2, indivisaire mandaté selon
 *   C. civ. art. 815-3, ou tous) ; seul est contrôlé que l'identité est indivisaire en place sur le compte débité ;
 * - remboursement de solde (copropriétaire, indivisaire) dans ce même objet, ou dans un objet frère ;
 * - sens de « Tranche » (non observé) : donnée opaque, rattachée à des travaux ; à ne pas confondre avec les tranches
 *   d'appel « <n°>-T<n> » de travaux-operations.ts ;
 * - honoraires du cabinet réglés par le même circuit (tranche 43 § 12) : aucun bénéficiaire « cabinet » ;
 * - acompte versé sur commande sans facture (compte 409) : non pris en charge, un fournisseur exige une facture.
 */

export const STATUTS_REGLEMENT_FOURNISSEUR = ['Demandé', 'À régler', 'Enregistré', 'Rapproché', 'Annulé'] as const
export type StatutReglementFournisseur = (typeof STATUTS_REGLEMENT_FOURNISSEUR)[number]

/** Bénéficiaire typé : le compte débité en découle (401 du fournisseur, 450 du compte copropriétaire). */
export type BeneficiaireReglement =
  | { type: 'fournisseur'; prestataireId: string; auxiliaire401: string }
  | { type: 'coproprietaire'; compteCoproprietaireId: string; serie450: string }
  | { type: 'indivisaire'; compteCoproprietaireId: string; serie450: string; identiteId: string }

/** Modes admis : ni « Pas de règlement », ni « Espèces » (compte 53 non tenu, 🔴). */
export type ModePaiementReglement = Exclude<ModeReglement, 'Pas de règlement' | 'Espèces'>

export interface ReglementFournisseur {
  id: string
  /** D1 : le syndicat (un seul par règlement). */
  coproprieteId: string
  /** D1 : la mission qui règle. */
  mandatId: string
  /** Compte bancaire payeur du syndicat (D-BANQUE). */
  banqueId: string
  /** Compte 512 crédité : <syndicat>.512xx.<auxiliaire>.<repère>. */
  contrepartie512: string
  beneficiaire: BeneficiaireReglement
  /** Facture réglée : obligatoire pour un fournisseur, null sinon. */
  factureId: string | null
  contratId: string | null
  /** Demande ou ordre de service : identifiant opaque. */
  demandeId: string | null
  /** N° d'opération de travaux (5 caractères). */
  travauxId: string | null
  /** 🔴 Sens non observé ; exige travauxId. */
  tranche: string | null
  echeance: string
  libelle: string
  montantCentimes: number
  mode: ModePaiementReglement
  iban: string | null
  bic: string | null
  /** N° de chèque, ou identifiant de bout en bout de la ligne de virement. */
  numeroPiece: string | null
  /** Traitement « Règlement de factures » ou « Règlement de soldes de compte » qui l'enregistre. */
  traitementId: string | null
  ordreId: string | null
  statut: StatutReglementFournisseur
  /** Gestéam Imputé / Non imputé : axe distinct du statut. */
  impute: boolean
  /** Posé par la propagation depuis l'arrêté seulement (rapprocherReglements). */
  rapprochement: RapprochementPiece | null
}

export interface SaisieReglementFournisseur {
  id: string
  coproprieteId: string
  mandatId: string
  banqueId: string
  contrepartie512: string
  beneficiaire: BeneficiaireReglement
  echeance: string
  libelle: string
  montantCentimes: number
  mode: ModeReglement
  iban?: string | null
  bic?: string | null
  numeroPiece?: string | null
  factureId?: string | null
  contratId?: string | null
  demandeId?: string | null
  travauxId?: string | null
  tranche?: string | null
}

export type CodeAnomalieReglement =
  | 'plusieurs_mandats_hors_compte_cabinet'
  | 'fonds_travaux_regroupe'
  | 'beneficiaires_differents'
  | 'modes_differents'
  | 'indivisaire_sans_position'

export interface AnomalieReglement {
  code: CodeAnomalieReglement
  message: string
  /** Texte cité ; null pour une règle de gestion ou une décision du cabinet. */
  fondement: string | null
}

const FONDEMENT_FONDS_TRAVAUX_SEPARE = citerFondement(refLoi1965('18, II, al. 4'))
const CODE_5 = /^[0-9A-Z]{5}$/
const CONTREPARTIE_512 = /^([^.]{4})\.512[0-9A-Z]{2}\.[0-9A-Z]{5}\.[0-9A-Z]$/

const ibanNormalise = (iban: string): string => iban.replace(/\s+/g, '').toUpperCase()
const optionnel = (valeur: string | null | undefined): string | null => {
  const brut = valeur?.trim()
  return brut ? brut : null
}

function texteRequis(valeur: string | null | undefined, message: string): void {
  if (!valeur?.trim()) throw new Error(message)
}

function verifierCode5(valeur: string, nom: string): void {
  if (!CODE_5.test(valeur)) throw new Error(`${nom} « ${valeur} » : 5 caractères (chiffres ou majuscules) attendus.`)
}

// ─── Création ───────────────────────────────────────────────────────────────────────────────

function verifierMode(mode: ModeReglement, iban: string | null): ModePaiementReglement {
  if (!(MODE_REGLEMENT as readonly string[]).includes(mode)) throw new Error(`Mode de règlement inconnu : « ${mode} ».`)
  if (mode === 'Pas de règlement') throw new Error('Mode « Pas de règlement » : aucun règlement à créer.')
  if (mode === 'Espèces')
    throw new Error(
      'Espèces : paiement refusé ; il sortirait du compte 53 « Caisse », que VitFix ne tient pas, et non d’un compte 512 (arrêté du 14 mars 2005, art. 3 et 7) ; à trancher.',
    )
  if (mode === 'Virement' && (iban === null || !validerIban(iban))) throw new Error('Virement : IBAN du bénéficiaire absent ou invalide.')
  return mode
}

/** Remboursement d'un solde (copropriétaire, indivisaire) : compte 450, ni facture ni contrat. */
function verifierSolde(b: { compteCoproprietaireId: string; serie450: string }, factureId: string | null, contratId: string | null): void {
  texteRequis(b.compteCoproprietaireId, 'Bénéficiaire copropriétaire : compte copropriétaire attendu.')
  verifierCode5(b.serie450, 'Série du compte 450')
  if (factureId !== null) throw new Error('Remboursement à un copropriétaire : aucune facture (le 450 est débité, pas un 401).')
  if (contratId !== null) throw new Error('Remboursement à un copropriétaire : aucun contrat.')
}

function verifierBeneficiaire(b: BeneficiaireReglement, factureId: string | null, contratId: string | null): void {
  switch (b.type) {
    case 'fournisseur':
      texteRequis(b.prestataireId, 'Bénéficiaire fournisseur : identifiant du fournisseur attendu.')
      verifierCode5(b.auxiliaire401, 'Auxiliaire 401 du fournisseur')
      if (factureId === null) throw new Error('Règlement d’un fournisseur : la facture réglée est obligatoire (le règlement solde la facture enregistrée).')
      return
    case 'indivisaire':
      texteRequis(b.identiteId, 'Bénéficiaire indivisaire : identité de l’indivisaire attendue.')
      verifierSolde(b, factureId, contratId)
      return
    case 'coproprietaire':
      verifierSolde(b, factureId, contratId)
      return
    default:
      throw new Error(`Type de bénéficiaire inconnu : « ${(b as { type: string }).type} ».`)
  }
}

function verifierTravaux(travauxId: string | null, tranche: string | null): void {
  if (travauxId !== null) verifierCode5(travauxId, "N° d'opération de travaux")
  if (tranche !== null && travauxId === null) throw new Error('Tranche sans opération de travaux : la tranche se rattache à des travaux.')
}

function verifierContrepartie(contrepartie: string, segmentSyndicat: string): void {
  const lu = CONTREPARTIE_512.exec(contrepartie)
  if (!lu) throw new Error(`Contrepartie « ${contrepartie} » : compte 512 au format <syndicat>.512xx.<auxiliaire>.<repère> attendu.`)
  if (lu[1] !== segmentSyndicat)
    throw new Error(`Contrepartie « ${contrepartie} » : compte d'un autre syndicat (segment « ${segmentSyndicat} » attendu, D1).`)
}

function verifierEnTete(saisie: SaisieReglementFournisseur): void {
  texteRequis(saisie.id, 'Règlement sans identifiant.')
  texteRequis(saisie.coproprieteId, 'Règlement sans syndicat (D1).')
  texteRequis(saisie.mandatId, 'Règlement sans mandat (D1 : la mission qui règle).')
  texteRequis(saisie.banqueId, 'Règlement sans compte payeur (D-BANQUE).')
  texteRequis(saisie.libelle, 'Libellé du règlement attendu.')
  if (!Number.isInteger(saisie.montantCentimes) || saisie.montantCentimes <= 0)
    throw new Error(`Montant invalide (${saisie.montantCentimes}) : centimes entiers strictement positifs attendus.`)
  if (!estDateIsoValide(saisie.echeance)) throw new Error(`Échéance invalide (${saisie.echeance}) : AAAA-MM-JJ attendu.`)
}

/**
 * Crée un règlement « Demandé », non imputé, hors de tout ordre, traitement et arrêté. Refuse un montant qui n'est pas
 * un nombre entier de centimes > 0, une échéance non ISO, un mode inconnu, « Pas de règlement » ou « Espèces » (🔴), un
 * virement sans IBAN valide, un fournisseur sans facture, un remboursement avec facture ou contrat, une tranche sans
 * travaux, une contrepartie qui n'est pas un 512 du syndicat.
 */
export function creerReglementFournisseur(saisie: SaisieReglementFournisseur, { segmentSyndicat }: { segmentSyndicat: string }): ReglementFournisseur {
  verifierEnTete(saisie)
  const iban = optionnel(saisie.iban)
  const mode = verifierMode(saisie.mode, iban)
  const factureId = optionnel(saisie.factureId)
  const contratId = optionnel(saisie.contratId)
  verifierBeneficiaire(saisie.beneficiaire, factureId, contratId)
  const travauxId = optionnel(saisie.travauxId)
  const tranche = optionnel(saisie.tranche)
  verifierTravaux(travauxId, tranche)
  verifierContrepartie(saisie.contrepartie512, segmentSyndicat)
  return {
    id: saisie.id,
    coproprieteId: saisie.coproprieteId,
    mandatId: saisie.mandatId,
    banqueId: saisie.banqueId,
    contrepartie512: saisie.contrepartie512,
    beneficiaire: { ...saisie.beneficiaire },
    factureId,
    contratId,
    demandeId: optionnel(saisie.demandeId),
    travauxId,
    tranche,
    echeance: saisie.echeance,
    libelle: saisie.libelle.trim(),
    montantCentimes: saisie.montantCentimes,
    mode,
    iban,
    bic: optionnel(saisie.bic),
    numeroPiece: optionnel(saisie.numeroPiece),
    traitementId: null,
    ordreId: null,
    statut: 'Demandé',
    impute: false,
    rapprochement: null,
  }
}

// ─── Ordre de virement ──────────────────────────────────────────────────────────────────────

/** Règlements d'une ligne de virement : ses reglementIds (ligne groupée), sinon son identifiant. */
export function reglementsDeLigne(ligne: LigneVirement): string[] {
  if (ligne.reglementIds === undefined) return [ligne.reglementId]
  if (ligne.reglementIds.length === 0) throw new Error(`Ligne de virement « ${ligne.reglementId} » sans aucun règlement.`)
  return [...ligne.reglementIds]
}

/** Identité du bénéficiaire, pour comparer les règlements d'un même paiement. */
function cleBeneficiaire({ beneficiaire: b }: ReglementFournisseur): string {
  switch (b.type) {
    case 'fournisseur':
      return `fournisseur|${b.prestataireId}`
    case 'coproprietaire':
      return `coproprietaire|${b.compteCoproprietaireId}`
    case 'indivisaire':
      return `indivisaire|${b.identiteId}`
  }
}

const familleDe = (r: ReglementFournisseur): FamilleTraitement =>
  r.beneficiaire.type === 'fournisseur' ? 'Règlement de factures' : 'Règlement de soldes de compte'

/** Un ordre comme un traitement : une seule famille, jamais factures et remboursements de soldes mêlés. */
function verifierUneFamille(reglements: ReglementFournisseur[], objet: string): void {
  if (new Set(reglements.map(familleDe)).size > 1)
    throw new Error(`${objet} : on ne peut mêler règlements de factures et remboursements de soldes de compte (un traitement, une famille).`)
}

function indexer(reglements: ReglementFournisseur[]): Map<string, ReglementFournisseur> {
  const index = new Map<string, ReglementFournisseur>()
  for (const r of reglements) {
    if (index.has(r.id)) throw new Error(`Règlement ${r.id} en double.`)
    index.set(r.id, r)
  }
  return index
}

function verifierLigne(ligne: LigneVirement, reglements: ReglementFournisseur[]): void {
  const nom = `Ligne « ${ligne.reglementId} »`
  const somme = reglements.reduce((s, r) => s + r.montantCentimes, 0)
  if (somme !== ligne.montantCentimes) throw new Error(`${nom} : montant ${ligne.montantCentimes} centimes, ses règlements ${somme} centimes.`)
  if (reglements.some((r) => r.iban === null || ibanNormalise(r.iban) !== ibanNormalise(ligne.iban)))
    throw new Error(`${nom} : IBAN différent de celui de ses règlements.`)
  if (new Set(reglements.map((r) => r.mandatId)).size > 1)
    throw new Error(`${nom} : règlements de plusieurs mandats ; un tel paiement ne part que du compte centralisateur du cabinet (D-BANQUE).`)
  if (new Set(reglements.map(cleBeneficiaire)).size > 1) throw new Error(`${nom} : bénéficiaires différents.`)
}

function verifierRattachementOrdre(r: ReglementFournisseur, ordre: OrdreVirement): void {
  if (r.coproprieteId !== ordre.coproprieteId) throw new Error(`Règlement ${r.id} : autre syndicat que l'ordre ${ordre.numero} (D1).`)
  if (r.banqueId !== ordre.banqueId) throw new Error(`Règlement ${r.id} : compte payeur différent du compte de l'ordre ${ordre.numero}.`)
  if (r.mode !== 'Virement') throw new Error(`Règlement ${r.id} (${r.mode}) : seul un virement entre dans un ordre de virement.`)
}

/**
 * Contrôle qu'un ordre de virement se compose exactement des règlements donnés (chaque règlement dans une seule ligne,
 * chaque ligne entièrement fournie), d'une seule famille (l'ordre n'a qu'un traitement), puis rattachement et lignes ;
 * renvoie la ligne de chaque règlement. Les identifiants de bout en bout sont recontrôlés : l'ordre reçu peut avoir été
 * relu ou recomposé sans passer par creerOrdreVirement.
 */
function lignesDesReglements(reglements: ReglementFournisseur[], ordre: OrdreVirement): Map<string, LigneVirement> {
  verifierIdentifiantsVirement(ordre.lignes)
  const index = indexer(reglements)
  verifierUneFamille(reglements, `Ordre ${ordre.numero}`)
  const ligneDe = new Map<string, LigneVirement>()
  for (const ligne of ordre.lignes) {
    const siens: ReglementFournisseur[] = []
    for (const id of reglementsDeLigne(ligne)) {
      const r = index.get(id)
      if (!r) throw new Error(`Règlement ${id} de la ligne « ${ligne.reglementId} » non fourni : passer tous les règlements de l'ordre ${ordre.numero}.`)
      if (ligneDe.has(id)) throw new Error(`Règlement ${id} dans deux lignes de l'ordre ${ordre.numero}.`)
      ligneDe.set(id, ligne)
      siens.push(r)
    }
    siens.forEach((r) => verifierRattachementOrdre(r, ordre))
    verifierLigne(ligne, siens)
  }
  for (const r of reglements) if (!ligneDe.has(r.id)) throw new Error(`Règlement ${r.id} absent de l'ordre ${ordre.numero}.`)
  return ligneDe
}

/**
 * Entrée dans un ordre de virement non émis : les règlements « Demandé » de l'ordre passent « À régler », avec l'ordre,
 * le traitement de l'ordre et le n° de pièce = identifiant de bout en bout de leur ligne. Les règlements donnés doivent
 * être exactement ceux de l'ordre ; même syndicat et même compte payeur ; par ligne, montant égal à la somme des
 * règlements, même IBAN, un seul mandat, un seul bénéficiaire.
 */
export function mettreDansOrdre(reglements: ReglementFournisseur[], ordre: OrdreVirement): ReglementFournisseur[] {
  if (ordre.statut === 'Émis') throw new Error(`Ordre ${ordre.numero} déjà émis : plus aucun règlement n'y entre.`)
  const ligneDe = lignesDesReglements(reglements, ordre)
  return reglements.map((r): ReglementFournisseur => {
    if (r.statut !== 'Demandé') throw new Error(`Règlement ${r.id} « ${r.statut} » : seul un règlement « Demandé » entre dans un ordre.`)
    return { ...r, statut: 'À régler', ordreId: ordre.id, traitementId: ordre.traitementId, numeroPiece: ligneDe.get(r.id)?.reglementId ?? null }
  })
}

/**
 * Émission constatée : tous les règlements de l'ordre émis passent « Enregistré ». Refuse un ordre non émis, et signale
 * un règlement que l'ordre paie alors qu'il n'est plus à régler dans cet ordre (sorti ou annulé sans que l'ordre soit
 * refait) : le paiement est à vérifier.
 */
export function enregistrerOrdreEmis(reglements: ReglementFournisseur[], ordre: OrdreVirement): ReglementFournisseur[] {
  if (ordre.statut !== 'Émis') throw new Error(`Ordre ${ordre.numero} pas émis : ses règlements ne sont pas encore payés.`)
  lignesDesReglements(reglements, ordre)
  return reglements.map((r): ReglementFournisseur => {
    if (r.statut !== 'À régler' || r.ordreId !== ordre.id)
      throw new Error(
        `Règlement ${r.id} (${r.statut}) : il n'est plus à régler dans l'ordre ${ordre.numero}, que l'ordre émis paie pourtant ; vérifier le paiement.`,
      )
    return { ...r, statut: 'Enregistré' }
  })
}

// ─── Changements de statut à la main ────────────────────────────────────────────────────────

const TRANSITIONS: Record<StatutReglementFournisseur, readonly StatutReglementFournisseur[]> = {
  Demandé: ['Enregistré', 'Annulé'],
  'À régler': ['Demandé', 'Annulé'],
  Enregistré: [],
  Rapproché: [],
  Annulé: [],
}

function sortirDeLOrdre(r: ReglementFournisseur, nouveau: StatutReglementFournisseur, ordre: StatutOrdre | undefined): ReglementFournisseur {
  if (ordre === undefined) throw new Error(`Règlement ${r.id} à régler : le statut de son ordre de virement est requis.`)
  if (ordre === 'Émis') throw new Error(`Règlement ${r.id} : son ordre est déjà émis, il ne peut plus en sortir (risque de double paiement).`)
  return { ...r, statut: nouveau, ordreId: null, traitementId: null, numeroPiece: null }
}

function enregistrerHorsOrdre(r: ReglementFournisseur, numeroPiece: string | undefined): ReglementFournisseur {
  if (r.mode === 'Virement')
    throw new Error(`Règlement ${r.id} : un virement passe par un ordre de virement (mettreDansOrdre, puis enregistrerOrdreEmis).`)
  const piece = numeroPiece === undefined || numeroPiece.trim() === '' ? r.numeroPiece : numeroPiece.trim()
  if (r.mode === 'Chèque' && piece === null) throw new Error(`Règlement ${r.id} par chèque : n° de chèque exigé (référence du paiement).`)
  return { ...r, statut: 'Enregistré', numeroPiece: piece }
}

/**
 * Change le statut à la main : « Demandé » → « Enregistré » (chèque avec son numéro, prélèvement, TIP ; jamais un
 * virement) ou « Annulé » ; « À régler » → « Demandé » ou « Annulé » tant que l'ordre n'est pas émis (statut de l'ordre
 * requis ; l'ordre est alors à refaire sans le règlement). Avant le paiement, aucune écriture n'existe
 * (traitementReglements) : rien à contre-passer. « À régler » et l'enregistrement d'un virement passent par l'ordre ;
 * « Rapproché » n'est jamais posé ni retiré à la main. Renvoie une copie.
 */
export function changerStatutReglementFournisseur(
  r: ReglementFournisseur,
  nouveau: StatutReglementFournisseur,
  { ordre, numeroPiece }: { ordre?: StatutOrdre; numeroPiece?: string } = {},
): ReglementFournisseur {
  if (nouveau === 'Rapproché' || r.statut === 'Rapproché')
    throw new Error(`Règlement ${r.id} : « Rapproché » est propagé depuis l'arrêté de rapprochement, jamais posé ni retiré à la main.`)
  if (nouveau === 'À régler') throw new Error(`Règlement ${r.id} : « À régler » s'obtient par l'entrée dans un ordre de virement (mettreDansOrdre).`)
  if (r.statut === 'À régler' && nouveau === 'Enregistré')
    throw new Error(`Règlement ${r.id} : un règlement à régler est enregistré par l'émission de son ordre (enregistrerOrdreEmis).`)
  if (!TRANSITIONS[r.statut].includes(nouveau)) {
    const suite = r.statut === 'Enregistré' ? ' ; un règlement enregistré ne s’annule que par une écriture contraire, non prise en charge ici' : ''
    throw new Error(`Transition refusée : « ${r.statut} » → « ${nouveau} »${suite}.`)
  }
  if (r.statut === 'À régler') return sortirDeLOrdre(r, nouveau, ordre)
  if (nouveau === 'Enregistré') return enregistrerHorsOrdre(r, numeroPiece)
  return { ...r, statut: nouveau }
}

// ─── Écriture et imputation ─────────────────────────────────────────────────────────────────

/** Compte débité : 401 du fournisseur ou 450 du compte copropriétaire, au segment du syndicat (celui de la contrepartie). */
function debitReglement(r: ReglementFournisseur): { compte: string; liens: LiensMouvement } {
  const mandat = r.contrepartie512.split('.')[0]
  const b = r.beneficiaire
  if (b.type === 'fournisseur')
    return {
      compte: formaterNumeroCompte({ mandat, planCode: '40100', auxiliaire: b.auxiliaire401 }),
      liens: {
        fournisseurId: b.prestataireId,
        ...(r.contratId ? { contratId: r.contratId } : {}),
        ...(r.travauxId ? { travauxId: r.travauxId } : {}),
      },
    }
  return {
    compte: formaterNumeroCompte({ mandat, planCode: '45000', auxiliaire: b.serie450 }),
    liens: { compteCoproprietaireId: b.compteCoproprietaireId },
  }
}

/**
 * Lignes d'écriture du règlement : débit du 401 du fournisseur (le compte crédité par la saisie de la facture) ou du 450
 * du copropriétaire, crédit de la contrepartie 512. Jamais le compte de charge (mouvementsDecaissement, R7) : la charge
 * est déjà passée à la saisie de la facture.
 */
export function mouvementsReglement(r: ReglementFournisseur): LigneMouvement[] {
  const { compte, liens } = debitReglement(r)
  return [
    { compte, sens: 'debit', montantCentimes: r.montantCentimes, liens },
    { compte: r.contrepartie512, sens: 'credit', montantCentimes: r.montantCentimes },
  ]
}

/** Règlement à écrire dans le traitement `id` : payé, pas encore imputé, et pas rattaché à un autre traitement. */
function verifierAEcrire(r: ReglementFournisseur, id: string): void {
  if (r.statut !== 'Enregistré' && r.statut !== 'Rapproché')
    throw new Error(`Règlement ${r.id} « ${r.statut} » : seul un règlement payé (enregistré ou rapproché) s'écrit ; aucune écriture avant le paiement.`)
  if (r.impute) throw new Error(`Règlement ${r.id} déjà imputé : son écriture est dans le traitement ${r.traitementId}.`)
  if (r.traitementId !== null && r.traitementId !== id)
    throw new Error(`Règlement ${r.id} rattaché au traitement ${r.traitementId} (celui de son ordre), pas à ${id}.`)
}

/**
 * Un ordre de virement s'écrit en un seul traitement, le sien, qui n'écrit que lui : sans ordre, aucun règlement payé
 * par un ordre ; avec l'ordre, celui-ci est émis, porte l'identifiant du traitement, et les règlements donnés sont
 * exactement les siens (lignesDesReglements). Une écriture partielle, qui ferait un second traitement de même
 * identifiant pour le reste de l'ordre, est ainsi refusée, comme un règlement hors de l'ordre écrit sous son traitement.
 */
function verifierOrdreDuTraitement(reglements: ReglementFournisseur[], id: string, ordre: OrdreVirement | undefined): void {
  if (ordre === undefined) {
    const paye = reglements.find((r) => r.ordreId !== null)
    if (paye)
      throw new Error(`Règlement ${paye.id} payé par l'ordre ${paye.ordreId} : passer cet ordre, dont tous les règlements s'écrivent dans un seul traitement.`)
    return
  }
  if (ordre.statut !== 'Émis') throw new Error(`Ordre ${ordre.numero} pas émis : ses règlements ne sont pas encore payés.`)
  if (ordre.traitementId !== id) throw new Error(`Ordre ${ordre.numero} : traitement ${ordre.traitementId}, pas ${id}.`)
  const horsOrdre = reglements.find((r) => r.ordreId !== ordre.id)
  if (horsOrdre) throw new Error(`Règlement ${horsOrdre.id} hors de l'ordre ${ordre.numero} : le traitement d'un ordre n'écrit que ses règlements.`)
  lignesDesReglements(reglements, ordre)
}

/**
 * Écriture et imputation, en une fois, de règlements payés d'un même syndicat : un traitement « Règlement de factures »
 * (fournisseurs) ou « Règlement de soldes de compte » (copropriétaires, indivisaires), jamais les deux, avec une paire
 * débit / crédit construite depuis chaque règlement ; les règlements sont rendus imputés et rattachés à ce traitement.
 * L'imputation ne repose donc jamais sur la paire d'un autre règlement, et un règlement imputé n'entre dans aucun autre
 * traitement. Refuse un règlement non payé (seuls « Enregistré » et « Rapproché » : aucune écriture avant le paiement,
 * rien à contre-passer quand un règlement sort d'un ordre ou est abandonné), en double, déjà imputé, ou rattaché à un
 * autre traitement (celui de son ordre). Les règlements payés par un ordre de virement s'écrivent tous ensemble, avec
 * l'ordre émis, sous son traitementId (verifierOrdreDuTraitement) ; les règlements hors ordre (chèque, prélèvement,
 * TIP), sans ordre. Limite d'une fonction pure : elle ne voit pas les traitements déjà écrits ; qu'un identifiant de
 * traitement ne serve qu'une fois (en particulier, que celui d'un ordre ne serve pas d'abord à un chèque hors ordre)
 * incombe à l'appelant, comme l'unicité de toute pièce.
 */
export function traitementReglements(
  reglements: ReglementFournisseur[],
  { id, date, ordre }: { id: string; date: string; ordre?: OrdreVirement },
): { traitement: Traitement; reglements: ReglementFournisseur[] } {
  if (reglements.length === 0) throw new Error('Traitement de règlements : aucun règlement.')
  texteRequis(id, 'Traitement de règlements sans identifiant.')
  indexer(reglements)
  reglements.forEach((r) => verifierAEcrire(r, id))
  verifierOrdreDuTraitement(reglements, id, ordre)
  verifierUneFamille(reglements, 'Traitement refusé')
  if (new Set(reglements.map((r) => r.coproprieteId)).size > 1) throw new Error('Traitement refusé : règlements de plusieurs syndicats (D1).')
  const traitement = creerTraitement({ id, famille: familleDe(reglements[0]), date, mouvements: reglements.flatMap(mouvementsReglement) })
  return { traitement, reglements: reglements.map((r): ReglementFournisseur => ({ ...r, impute: true, traitementId: id })) }
}

// ─── Contrôles ──────────────────────────────────────────────────────────────────────────────

export interface ContextePaiement {
  /** Mode de tenue résolu du mandat (comptes-bancaires.resoudreModeComptes). */
  modeDuMandat: (mandatId: string) => ModeTenueComptes
  natureDuCompte: (banqueId: string) => NatureCompteBancaire
}

function anomaliesBeneficiaire(reglements: ReglementFournisseur[]): AnomalieReglement[] {
  const anomalies: AnomalieReglement[] = []
  const ibans = new Set(reglements.filter((r) => r.mode === 'Virement').map((r) => ibanNormalise(r.iban ?? '')))
  if (new Set(reglements.map(cleBeneficiaire)).size > 1 || ibans.size > 1)
    anomalies.push({ code: 'beneficiaires_differents', message: 'Un paiement va à un seul bénéficiaire, sur un seul IBAN : règlements à séparer.', fondement: null })
  if (new Set(reglements.map((r) => r.mode)).size > 1)
    anomalies.push({ code: 'modes_differents', message: 'Un paiement part par un seul mode : règlements à séparer.', fondement: null })
  return anomalies
}

function anomaliesCompteCabinet(
  reglements: ReglementFournisseur[],
  { modeDuMandat, natureDuCompte }: ContextePaiement,
): AnomalieReglement[] {
  const anomalies: AnomalieReglement[] = []
  for (const mandatId of new Set(reglements.map((r) => r.mandatId))) {
    const mode = modeDuMandat(mandatId)
    if (mode !== 'centralisateur_cabinet')
      anomalies.push({
        code: 'plusieurs_mandats_hors_compte_cabinet',
        message: `Mandat ${mandatId} (${MODES_TENUE_COMPTES[mode].libelle}) : un paiement sur plusieurs mandats ou comptes ne part que du compte centralisateur du cabinet (D-BANQUE).`,
        fondement: null,
      })
  }
  for (const banqueId of new Set(reglements.map((r) => r.banqueId))) {
    const nature = natureDuCompte(banqueId)
    if (nature === 'fonds_travaux')
      anomalies.push({
        code: 'fonds_travaux_regroupe',
        message: `Compte ${banqueId} : le fonds de travaux est sur un compte séparé, sans fusion ni compensation ; jamais regroupé avec un autre compte, mandat ou syndicat dans un même paiement.`,
        fondement: FONDEMENT_FONDS_TRAVAUX_SEPARE,
      })
    else if (nature !== 'sous_compte_centralisateur')
      anomalies.push({
        code: 'plusieurs_mandats_hors_compte_cabinet',
        message: `Compte ${banqueId} (${NATURES_COMPTE_BANCAIRE[nature].libelle}) : un paiement sur plusieurs mandats ou comptes ne part que des sous-comptes du compte centralisateur du cabinet (D-BANQUE).`,
        fondement: null,
      })
  }
  return anomalies
}

/**
 * Contrôle d'un paiement (une ligne de virement ou un chèque) qui regroupe des règlements : un seul bénéficiaire, un seul
 * IBAN, un seul mode ; s'il couvre plusieurs mandats, syndicats ou comptes payeurs, chaque mandat doit être tenu en
 * compte centralisateur du cabinet et chaque compte être un sous-compte centralisateur, jamais le fonds de travaux.
 * Anomalies bloquantes ; aucune pour un paiement d'un seul mandat sur un seul compte et un seul bénéficiaire, ce compte
 * fût-il celui du fonds de travaux.
 */
export function controlerPaiementPlusieursMandats(reglements: ReglementFournisseur[], contexte: ContextePaiement): AnomalieReglement[] {
  const anomalies = anomaliesBeneficiaire(reglements)
  const parts = new Set(reglements.map((r) => `${r.coproprieteId}|${r.mandatId}|${r.banqueId}`))
  return parts.size > 1 ? [...anomalies, ...anomaliesCompteCabinet(reglements, contexte)] : anomalies
}

/**
 * Bénéficiaire indivisaire : l'identité doit tenir une position « Indivisaire » en place à la date sur le compte débité
 * (D2). 🔴 Ne dit pas si l'indivisaire peut recevoir seul le paiement. Sans objet pour un autre bénéficiaire.
 */
export function controlerBeneficiaireIndivisaire(r: ReglementFournisseur, positions: Position[], date: string): AnomalieReglement[] {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const b = r.beneficiaire
  if (b.type !== 'indivisaire') return []
  const enPlace = positions.some(
    (p) => p.identiteId === b.identiteId && p.compteId === b.compteCoproprietaireId && p.qualite === 'Indivisaire' && statutPositionA(p, date) === 'En place',
  )
  if (enPlace) return []
  return [
    {
      code: 'indivisaire_sans_position',
      message: `Règlement ${r.id} : l'identité ${b.identiteId} n'est pas indivisaire en place le ${date} sur le compte débité (${b.compteCoproprietaireId}).`,
      fondement: null,
    },
  ]
}

// ─── Rapprochement ──────────────────────────────────────────────────────────────────────────

/**
 * Statut « Rapproché » propagé depuis les arrêtés (rapprochement-pieces.ts, partagé avec les encaissements) : un
 * règlement « Enregistré » pointé passe « Rapproché », un règlement dépointé revient « Enregistré ». Passer tous les
 * règlements des comptes concernés.
 */
export function rapprocherReglements(
  reglements: ReglementFournisseur[],
  arretes: ArreteRapprochement[],
  { aLaDate }: { aLaDate?: string } = {},
): { reglements: ReglementFournisseur[]; anomalies: AnomalieLienRapprochement[] } {
  const { pieces, anomalies } = propagerStatutRapproche(reglements, arretes, { type: 'reglement', rapproche: 'Rapproché', avant: 'Enregistré', aLaDate })
  return { reglements: pieces, anomalies }
}
