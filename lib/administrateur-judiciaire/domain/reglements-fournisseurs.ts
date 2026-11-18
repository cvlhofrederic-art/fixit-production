import { MODES_TENUE_COMPTES, NATURES_COMPTE_BANCAIRE, validerIban, type ModeTenueComptes, type NatureCompteBancaire } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  MOIS_MAX_SUSPENSION_PROROGEE,
  MOIS_SUSPENSION_EXIGIBILITE,
  finSuspensionExigibilite,
  refLoi1965,
} from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  estQualiteCopropriete,
  statutPositionA,
  type CompteCoproprietaire,
  type Position,
  type QualitePosition,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
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
  annulerTraitement,
  creerTraitement,
  type FamilleTraitement,
  type LigneMouvement,
  type LiensMouvement,
  type Mouvement,
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
 * - L. 1965 art. 23, al. 2 (version en vigueur depuis le 01/06/2020, ord. n° 2019-1101 ; relu le 30/10/2026 et le
 *   17/11/2026) : « En cas d'indivision, les indivisaires sont représentés par un mandataire commun qui est, à défaut
 *   d'accord, désigné par le président du tribunal judiciaire saisi par l'un d'entre eux ou par le syndic » ; al. 4 : la désignation judiciaire
 *   est aux frais des indivisaires ;
 * - aucun des textes lus ne fixe de cycle de statuts pour un règlement : le cycle est une règle de GESTION (Gestéam).
 * 🔵 Déduit :
 * - sens des statuts : « Demandé » = règlement préparé, hors de tout ordre ; « À régler » = dans un ordre de virement
 *   non émis ; « Enregistré » = ordre émis, ou chèque, prélèvement ou TIP constaté hors ordre ; « Rapproché » = pointé
 *   dans un arrêté (propagé seulement, par rapprochement-pieces.ts : au pointage, décision J8 de Hugo du 30/10/2026) ;
 *   « Annulé » = abandonné avant tout paiement, ou virement rejeté ou retourné après émission (rejet renseigné, J9
 *   ci-dessous) ;
 * - un virement ne se paie que par un ordre de virement (identifiant de bout en bout = n° de pièce, unique dans
 *   l'ordre) ; un ordre ne se compose que de règlements, exactement ceux de ses lignes, tous d'une même famille (il n'a
 *   qu'un traitement) ; une ligne groupée garde ses règlements (reglementIds), jamais son identifiant synthétique ;
 * - écriture et imputation au paiement seulement : traitementReglements ne prend que des règlements payés
 *   (« Enregistré » ou « Rapproché ») et les rend imputés, rattachés au traitement qui porte leur propre paire débit /
 *   crédit. Dans VitFix, un traitement compte dès qu'il existe (balance, grand livre : etats-comptables.ts) : passée
 *   avant le paiement, l'écriture d'un règlement sorti de son ordre ou annulé resterait sans écriture contraire (arrêté
 *   du 14 mars 2005, art. 5). Aucune écriture n'existe donc pour un règlement demandé, à régler, sorti ou annulé avant
 *   paiement ; un règlement imputé n'entre dans aucun autre traitement. Le traitement Gestéam qui produit l'ordre
 *   (tranche 43 § 10 et § 12) n'est ici que l'identifiant traitementId de l'ordre, sous lequel l'écriture de tous ses
 *   règlements est passée en une fois, avec l'ordre émis : jamais en partie, jamais avec un règlement hors de l'ordre ;
 * - contrepartie : un compte 512 du syndicat (D1) ; chaque part d'un paiement a la sienne ;
 * - paiement sur plusieurs mandats, syndicats ou comptes : seulement depuis le compte centralisateur du cabinet
 *   (décision D-BANQUE), jamais avec le compte du fonds de travaux ; un paiement groupé sur ce seul compte, pour un seul
 *   mandat, n'est pas visé ;
 * - type de bénéficiaire fermé (fournisseur, copropriétaire, indivisaire) : Mandant, Propriétaire et Cpte gérance
 *   relèvent de la gérance, hors champ ; la paie du personnel du syndicat n'y entre pas (point 42 : compte 421).
 * Décision J9 de Hugo du 30/10/2026 — virement rejeté ou retourné après émission : écriture contraire « Annulation de
 * règlements », par le même circuit de traitements que l'écriture du règlement ; retour de la facture à l'état d'avant
 * (statuts-facture.ts, retourFactureApresRejet), avec le motif et la date du rejet ; le règlement passe « Annulé »
 * (rejeterVirement).
 * 🔵 Déduit pour J9 :
 * - le rejet porte sur tout un virement : une ligne de l'ordre et tous ses règlements (une ligne groupée se rejette
 *   entière), jamais deux lignes à la fois ; ordre émis, rejet daté au plus tôt du jour de l'émission ;
 * - seulement après l'écriture de l'ordre (règlements imputés dans son traitement) : l'écriture contraire contre-passe
 *   une écriture passée ; avant, il n'y a rien à contre-passer, et l'ordre s'écrit d'abord en une fois ;
 * - écriture contraire : les paires débit / crédit des règlements du virement (mouvementsReglement), prises dans
 *   l'écriture de l'ordre, fournie (ce qui a été écrit, non une reconstruction), inversées par annulerTraitement (R6,
 *   traitements.ts) dans un traitement « Annulation de règlements » qui renvoie (annule) au traitement de l'ordre :
 *   contre-passation partielle de ce traitement quand l'ordre porte d'autres virements ; datée du jour du rejet, ou du
 *   jour de l'écriture de l'ordre si le rejet le précède (l'écriture contraire annule une écriture passée, arrêté du
 *   14 mars 2005, art. 5 : elle ne la précède pas), le rejet gardant sa date réelle ; sous son propre identifiant ;
 * - le règlement rejeté reste imputé et rattaché au traitement de l'ordre, garde son ordre, son n° de pièce et son
 *   pointage, et porte son rejet (date, motif, traitement d'annulation) ; « Annulé » est définitif : un double rejet est
 *   refusé, la facture se paie par un nouveau règlement ;
 * - après rapprochement : traité, non refusé (J8 : « Rapproché » est posé au pointage, un retour peut donc arriver
 *   après le pointage de la sortie). La sortie du relevé reste pointée : le virement est parti puis revenu ; le retour,
 *   ligne au crédit du relevé, se pointe avec l'écriture contraire, sans pièce (une pièce « règlement » est une sortie).
 *   rapprocherReglements lit un virement rejeté comme payé, pour ne pas signaler le pointage de sa sortie, puis lui rend
 *   « Annulé », sauf à une date (aLaDate) antérieure au rejet : il garde alors le statut propagé à cette date.
 * Décision J10 de Hugo du 30/10/2026 — bénéficiaire indivisaire : le règlement va au mandataire commun des indivisaires
 * (L. 1965 art. 23, al. 2) ; un règlement à l'indivision n'est admis qu'au mandataire commun désigné, indivisaire ou non
 * (tiers désigné par le président du tribunal judiciaire, L. 1965 art. 23, al. 2 : ni J10 ni le texte n'exigent qu'il
 * soit indivisaire) ; sans mandataire désigné, il est refusé (controlerBeneficiaireIndivisaire).
 * 🔵 Déduit pour J10 :
 * - l'art. 23, al. 2 fait représenter les indivisaires par le mandataire commun sans viser le paiement ; la décision en
 *   fait la « personne désignée pour le recevoir » (C. civ. art. 1342-2) ;
 * - le mandataire est porté par le compte copropriétaire débité (identites-positions.ts, mandataireCommunId : un compte,
 *   une indivision, un mandataire), donnée facultative et non indexée ; le bénéficiaire doit être ce mandataire ; le
 *   tiers désigné, qui n'a aucune position « Indivisaire » sur ce compte, n'a pas de position à tenir (J10 appliquée le
 *   17/11/2026 ; lecture de Claude, à confirmer par Hugo) ; un autre bénéficiaire est refusé et sa position
 *   « Indivisaire » en place sur ce compte reste contrôlée (D2) : les deux défauts se cumulent, chacun bloquant ;
 * - la désignation n'étant pas datée, la position reste le seul signal d'un mandataire périmé (relecture du 17/11/2026) :
 *   le mandataire désigné qui a tenu une position « Indivisaire » sur ce compte et n'en tient plus aucune en place à la
 *   date (part cédée) est refusé (mandataire_commun_position_sortie) ; sans aucun indivisaire en place sur le compte à
 *   la date, l'indivision a pu prendre fin : refus (indivision_sans_indivisaire_en_place) ; dans les deux cas, vérifier
 *   que la désignation vaut encore.
 * Décision J25 de Hugo du 03/11/2026 — aucun paiement en espèces, ni des salaires ni des fournisseurs ; le compte 53
 * « Caisse » n'est pas tenu. Le refus du mode « Espèces » devient une décision du cabinet, et non plus un choix
 * provisoire de VitFix : un tel paiement sortirait du compte 53 et non d'un 512 (arrêté du 14 mars 2005, art. 3 et 7),
 * avec le contrôle des espèces propre à l'administrateur judiciaire (carnet de reçus, arrêté du 16 août 1999). La
 * réserve de C. trav. L3241-1 (salaire payé en espèces au salarié qui le demande, sous un seuil) ne vise que les
 * salaires (personnel-syndicat.ts), pas un fournisseur.
 * Décisions de Hugo du 06/11/2026 (J40) — cette réserve est tranchée : aucun salaire n'est payé en espèces, même sous le
 * seuil et à la demande du salarié (personnel-syndicat.ts, choix du cabinet plus strict que la loi). Rien ne change ici :
 * le mode « Espèces » reste refusé pour un fournisseur (J25).
 * Recommandations validées par Hugo le 17/11/2026 (J67 ; textes lus sur Légifrance le 17/11/2026) :
 * - J67, R79 (dettes nées avant la désignation) : la décision qui désigne l'administrateur provisoire « emporte
 *   suspension de l'exigibilité des créances, autres que les créances publiques et sociales, ayant leur origine
 *   antérieurement à cette décision, pour une période de douze mois » (L. 1965 art. 29-3, I) ; le juge peut proroger
 *   jusqu'à trente mois (II) ; les créanciers déclarent leurs créances (art. 29-4) ; tant que le plan d'apurement homologué
 *   est respecté, les suspensions sont maintenues (art. 29-5). Le texte n'interdit pas en toutes lettres de payer, mais
 *   payer un créancier ancien hors du plan romprait l'égalité que ce mécanisme organise : le paiement d'une facture dont
 *   la créance a son origine avant la décision est bloqué pendant la période de suspension (controlerCreanceAnterieure :
 *   douze mois, MOIS_SUSPENSION_EXIGIBILITE, ou la durée prorogée, au plus MOIS_MAX_SUSPENSION_PROROGEE (durées et fin
 *   tirées de delais-legaux.ts, finSuspensionExigibilite, comme l'échéance du mandat), puis tant que le plan homologué
 *   s'applique et est respecté). Origine : la date de la prestation ; non saisie, une facture datée avant la décision
 *   est bloquée, une facture datée après donne l'alerte « origine à vérifier » (une facture récente peut porter une
 *   prestation ancienne). Levée par un motif tracé : créance publique ou sociale ; paiement prévu à l'échéancier du plan
 *   homologué ; autre, avec un texte ; elle vaut tracée au plus tard le jour du règlement, et l'échéancier seulement avec
 *   un plan homologué à cette date (relecture du 18/11/2026). Le motif « contrat dont le juge a ordonné la poursuite »
 *   n'est pas retenu : le III de l'art. 29-3 ne dit rien des sommes dues avant la désignation, et une prestation faite
 *   après la décision a une origine postérieure, non bloquée. D. 1967 art. 62-17 à 62-23 non rouverts ; aucun arrêt lu ;
 * - J67, R80 (remboursement d'un compte en indivision ou démembré ; lecture prudente) : « Le paiement doit être fait au
 *   créancier ou à la personne désignée pour le recevoir » (C. civ. art. 1342-2) ; L. 1965 art. 23 organise la
 *   représentation à l'assemblée (indivisaires : mandataire commun, al. 2 ; usufruit : nu-propriétaire à défaut d'accord,
 *   al. 3), pas le paiement. Contrôle du bénéficiaire quel que soit son type (controlerBeneficiaireCompte) : (1) compte en
 *   indivision : même règle que J10, le mandataire commun, ou tous les indivisaires ensemble (compte à leurs noms) ; un
 *   paiement à un seul indivisaire qui n'est pas mandataire est bloqué ; (2) usufruit ou nue-propriété : la personne
 *   désignée par un accord écrit des deux (CompteCoproprietaire.accordPaiementDemembrement), ou les deux ensemble ; sans
 *   cet accord, bloqué (jamais le nu-propriétaire par défaut : la règle de l'al. 3 vise le vote, et l'usufruitier qui a
 *   payé les provisions peut être le créancier) ; (3) un règlement qui ne nomme personne est bloqué (identiteIds du
 *   bénéficiaire « copropriétaire »). Accord écrit et identités payées : enregistrement à brancher. Relecture du
 *   18/11/2026 : payé seul, le mandataire commun passe par les contrôles de J10 quel que soit le type saisi (position
 *   d'indivisaire sortie, aucun indivisaire en place : refusé) ; « tous ensemble » ne paie personne d'autre que les
 *   titulaires en place du compte.
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - Gestéam passe-t-il l'écriture du « Règlement de factures » dès le traitement qui produit l'ordre (imputée plus
 *   tard), ou au paiement ? Non observé ; VitFix l'écrit au paiement (ci-dessus) ;
 * - J9, retour amputé de frais par la banque (montant revenu moindre) : non pris en charge ; l'écriture contraire porte
 *   le montant du règlement, l'écart reste à écrire ;
 * - chèque émis puis perdu, frappé d'opposition ou jamais présenté, prélèvement contesté : hors de J9 (virement), aucune
 *   annulation après enregistrement ;
 * - contre-passation du traitement d'un règlement (annulerTraitement de traitements.ts, famille « Annulation de
 *   règlements ») hors rejet de virement (J9) : non prise en charge ici ; le règlement reste « Enregistré », imputé et
 *   rattaché au traitement annulé, et ne peut ni être réécrit ni passer « Annulé ». Question : une fois son traitement
 *   contre-passé, le règlement redevient-il « Non imputé » (à réécrire dans un nouveau traitement), passe-t-il
 *   « Annulé », ou reste-t-il « Enregistré » imputé avec un renvoi vers l'annulation, et la facture qu'il réglait
 *   quitte-t-elle « Réglée » ?
 * - J10, désignation non datée : le mandataire porté sur le compte vaut à la date du contrôle, sans historique des
 *   mandataires successifs ; gravité de ces deux refus (bloquants par prudence) à confirmer par Hugo : bloquer, ou
 *   seulement avertir ;
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
  | {
      type: 'coproprietaire'
      compteCoproprietaireId: string
      serie450: string
      /** Identités payées (une, ou tous les titulaires ensemble, compte à leurs noms) ; absent ou vide : personne (J67, R80). */
      identiteIds?: readonly string[]
    }
  | { type: 'indivisaire'; compteCoproprietaireId: string; serie450: string; identiteId: string }

/** Modes admis : ni « Pas de règlement », ni « Espèces » (décision J25 : compte 53 non tenu). */
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
  /** Virement rejeté ou retourné après émission (J9, rejeterVirement) ; null sinon. */
  rejet: RejetReglement | null
}

/** Rejet ou retour d'un virement après émission (J9). */
export interface RejetReglement {
  /** Jour où le rejet est constaté (AAAA-MM-JJ) : date de l'écriture contraire. */
  le: string
  /** Motif donné par la banque. */
  motif: string
  /** Traitement « Annulation de règlements » qui porte l'écriture contraire. */
  traitementId: string
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
  | 'indivisaire_sans_mandataire_commun'
  | 'indivisaire_non_mandataire_commun'
  | 'mandataire_commun_position_sortie'
  | 'indivision_sans_indivisaire_en_place'
  | 'beneficiaire_non_nomme'
  | 'paiement_indivision_hors_mandataire'
  | 'demembrement_sans_accord'
  | 'creance_anterieure_suspendue'
  | 'origine_creance_a_verifier'

export interface AnomalieReglement {
  code: CodeAnomalieReglement
  message: string
  /** Texte cité ; null pour une règle de gestion ou une décision du cabinet. */
  fondement: string | null
}

const FONDEMENT_FONDS_TRAVAUX_SEPARE = citerFondement(refLoi1965('18, II, al. 4'))
const FONDEMENT_MANDATAIRE_COMMUN = citerFondement(refLoi1965('23, al. 2'))
const FONDEMENT_PAIEMENT = 'C. civ. art. 1342-2'
const FONDEMENT_SUSPENSION = `${citerFondement(refLoi1965('29-3, I et II'))} ; art. 29-5`
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
      'Espèces : paiement refusé (décision J25 : aucun paiement en espèces) ; il sortirait du compte 53 « Caisse », que VitFix ne tient pas, et non d’un compte 512 (arrêté du 14 mars 2005, art. 3 et 7).',
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
 * un nombre entier de centimes > 0, une échéance non ISO, un mode inconnu, « Pas de règlement » ou « Espèces » (J25), un
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
    rejet: null,
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
    const suite =
      r.statut === 'Enregistré'
        ? ' ; un règlement enregistré ne s’annule que par une écriture contraire : virement rejeté ou retourné (rejeterVirement, J9), toute autre contre-passation non prise en charge ici'
        : ''
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

// ─── Virement rejeté ou retourné (J9) ───────────────────────────────────────────────────────

function verifierEnTeteRejet(ordre: OrdreVirement, { id, date, motif }: { id: string; date: string; motif: string }): void {
  texteRequis(id, 'Rejet de virement : identifiant du traitement d’annulation attendu.')
  if (id === ordre.traitementId)
    throw new Error(`Rejet de virement : le traitement d'annulation a son propre identifiant, distinct de celui de l'ordre ${ordre.numero} (${id}).`)
  texteRequis(motif, 'Rejet de virement : motif du rejet attendu (motif donné par la banque).')
  if (!estDateIsoValide(date)) throw new Error(`Date du rejet invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (ordre.statut !== 'Émis')
    throw new Error(`Ordre ${ordre.numero} pas émis : aucun virement n'est parti ; sortir le règlement de l'ordre (changerStatutReglementFournisseur).`)
  if (ordre.dateEmission !== null && date < ordre.dateEmission)
    throw new Error(`Rejet du ${date} antérieur à l'émission de l'ordre ${ordre.numero} (${ordre.dateEmission}).`)
}

/** Règlement à rejeter : jamais rejeté, virement de l'ordre, payé, et déjà écrit dans le traitement de l'ordre. */
function verifierARejeter(r: ReglementFournisseur, ordre: OrdreVirement): void {
  if (r.rejet)
    throw new Error(
      `Règlement ${r.id} déjà rejeté le ${r.rejet.le} (${r.rejet.motif}) : son écriture contraire est le traitement ${r.rejet.traitementId} ; un rejet ne s'écrit qu'une fois.`,
    )
  if (r.ordreId !== ordre.id) throw new Error(`Règlement ${r.id} hors de l'ordre ${ordre.numero} : seul un virement de cet ordre se rejette avec lui.`)
  verifierRattachementOrdre(r, ordre)
  if (r.statut !== 'Enregistré' && r.statut !== 'Rapproché')
    throw new Error(`Règlement ${r.id} « ${r.statut} » : seul un virement payé (enregistré ou rapproché) se rejette.`)
  if (!r.impute || r.traitementId !== ordre.traitementId)
    throw new Error(
      `Règlement ${r.id} : écrire d'abord l'ordre ${ordre.numero} (traitementReglements, traitement ${ordre.traitementId}) ; le rejet en passe ensuite l'écriture contraire.`,
    )
}

/** Le virement rejeté : la ligne de l'ordre que les règlements donnés composent exactement (une ligne, tous ses règlements). */
function verifierVirementEntier(reglements: ReglementFournisseur[], ordre: OrdreVirement): void {
  const pieces = [...new Set(reglements.map((r) => r.numeroPiece))]
  if (pieces.length > 1) throw new Error(`Rejet refusé : règlements de plusieurs virements (${pieces.join(', ')}) ; un rejet porte sur un seul virement.`)
  const ligne = ordre.lignes.find((l) => l.reglementId === pieces[0])
  if (!ligne) throw new Error(`Virement « ${pieces[0]} » absent de l'ordre ${ordre.numero}.`)
  const siens = reglementsDeLigne(ligne)
  const fournis = new Set(reglements.map((r) => r.id))
  const manquant = siens.find((id) => !fournis.has(id))
  if (manquant) throw new Error(`Virement « ${ligne.reglementId} » : le rejet porte sur tout le virement ; règlement ${manquant} non fourni.`)
  const etranger = reglements.find((r) => !siens.includes(r.id))
  if (etranger) throw new Error(`Règlement ${etranger.id} absent du virement « ${ligne.reglementId} » de l'ordre ${ordre.numero}.`)
  verifierLigne(ligne, reglements)
}

/** L'écriture fournie est celle du traitement de l'ordre. */
function verifierEcritureOrdre(ecriture: Traitement, ordre: OrdreVirement): void {
  if (ecriture.id !== ordre.traitementId)
    throw new Error(`Rejet de virement : écriture ${ecriture.id} fournie, alors que l'ordre ${ordre.numero} est écrit dans le traitement ${ordre.traitementId}.`)
}

const memesLiens = (a: LiensMouvement = {}, b: LiensMouvement = {}): boolean =>
  [...new Set([...Object.keys(a), ...Object.keys(b)] as (keyof LiensMouvement)[])].every((cle) => (a[cle] ?? null) === (b[cle] ?? null))

const memeLigne = (m: Mouvement, attendu: LigneMouvement): boolean =>
  m.compte === attendu.compte && m.sens === attendu.sens && m.montantCentimes === attendu.montantCentimes && memesLiens(m.liens, attendu.liens)

/**
 * Mouvements de l'écriture de l'ordre qui portent le virement : chaque ligne de mouvementsReglement y est cherchée
 * (compte, sens, montant, liens) et prise une seule fois. L'écriture contraire inverse ce qui a été écrit, non une
 * reconstruction.
 */
function mouvementsDuVirement(reglements: ReglementFournisseur[], ecriture: Traitement): Mouvement[] {
  const restants = [...ecriture.mouvements]
  return reglements.flatMap(mouvementsReglement).map((attendu) => {
    const i = restants.findIndex((m) => memeLigne(m, attendu))
    if (i < 0)
      throw new Error(
        `Écriture ${ecriture.id} de l'ordre : mouvement ${attendu.sens} ${attendu.compte} de ${attendu.montantCentimes} centimes introuvable ; l'écriture contraire ne contre-passe que ce qui a été écrit.`,
      )
    return restants.splice(i, 1)[0]
  })
}

/**
 * J9 — virement rejeté ou retourné après émission : les règlements d'une ligne de l'ordre émis, déjà écrits dans le
 * traitement de l'ordre, reçoivent une écriture contraire, et passent « Annulé » avec leur rejet (date réelle, motif,
 * traitement d'annulation). L'écriture contraire est la part de l'écriture de l'ordre (`ecritureOrdre`, le traitement de
 * l'ordre) qui porte ce virement, prise dans ses mouvements, contre-passée par annulerTraitement : un traitement
 * « Annulation de règlements » qui renvoie au traitement de l'ordre, daté du jour du rejet, ou de celui de l'écriture de
 * l'ordre si le rejet le précède. Ils restent imputés et rattachés au traitement de l'ordre, gardent ordre, n° de pièce
 * et pointage. Refuse un ordre non émis, un rejet daté d'avant l'émission, sans motif ou sous l'identifiant de l'ordre,
 * une écriture qui n'est pas celle de l'ordre ou ne porte pas le virement, un règlement hors de l'ordre, non payé, non
 * encore écrit ou déjà rejeté, une partie seulement d'un virement ou plusieurs virements. La facture se rétablit à part
 * (statuts-facture.ts, retourFactureApresRejet).
 */
export function rejeterVirement(
  reglements: ReglementFournisseur[],
  ordre: OrdreVirement,
  rejet: { id: string; date: string; motif: string },
  ecritureOrdre: Traitement,
): { traitement: Traitement; reglements: ReglementFournisseur[] } {
  if (reglements.length === 0) throw new Error('Rejet de virement : aucun règlement.')
  verifierEnTeteRejet(ordre, rejet)
  verifierEcritureOrdre(ecritureOrdre, ordre)
  indexer(reglements)
  reglements.forEach((r) => verifierARejeter(r, ordre))
  verifierVirementEntier(reglements, ordre)
  const { id, date } = rejet
  const partDuVirement: Traitement = { ...ecritureOrdre, mouvements: mouvementsDuVirement(reglements, ecritureOrdre) }
  const traitement = annulerTraitement(partDuVirement, { id, date: date < ecritureOrdre.date ? ecritureOrdre.date : date })
  const trace: RejetReglement = { le: date, motif: rejet.motif.trim(), traitementId: id }
  return { traitement, reglements: reglements.map((r): ReglementFournisseur => ({ ...r, statut: 'Annulé', rejet: { ...trace } })) }
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

type BeneficiaireIndivisaire = Extract<BeneficiaireReglement, { type: 'indivisaire' }>

function anomaliePositionIndivisaire(r: ReglementFournisseur, b: BeneficiaireIndivisaire, positions: Position[], date: string): AnomalieReglement[] {
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

/** J10 — le règlement va au mandataire commun désigné sur le compte débité, et à lui seul. */
function anomalieMandataireCommun(
  r: ReglementFournisseur,
  b: BeneficiaireIndivisaire,
  compte: Pick<CompteCoproprietaire, 'mandataireCommunId'>,
): AnomalieReglement[] {
  const mandataire = optionnel(compte.mandataireCommunId)
  if (mandataire === null)
    return [
      {
        code: 'indivisaire_sans_mandataire_commun',
        message: `Règlement ${r.id} refusé : aucun mandataire commun désigné pour l'indivision du compte ${b.compteCoproprietaireId}. Le règlement va au seul mandataire commun des indivisaires ; le faire désigner (accord des indivisaires ou, à défaut, président du tribunal judiciaire saisi par l'un d'eux ou par le syndic) et le porter sur le compte.`,
        fondement: FONDEMENT_MANDATAIRE_COMMUN,
      },
    ]
  if (mandataire === b.identiteId.trim()) return []
  return [
    {
      code: 'indivisaire_non_mandataire_commun',
      message: `Règlement ${r.id} refusé : l'identité ${b.identiteId} n'est pas le mandataire commun de l'indivision du compte ${b.compteCoproprietaireId} (mandataire désigné : ${mandataire}) ; régler le mandataire commun.`,
      fondement: FONDEMENT_MANDATAIRE_COMMUN,
    },
  ]
}

/**
 * Mandataire commun désigné (J10) : dispensé de position s'il n'a jamais tenu de position « Indivisaire » sur le compte
 * débité (tiers désigné, L. 1965 art. 23, al. 2). La désignation n'étant pas datée, la position reste le seul signal d'un
 * mandataire périmé (relecture du 17/11/2026) : sa position d'indivisaire sur ce compte n'est pas en place à la date, ou
 * aucun indivisaire n'y est en place : refus, désignation à vérifier (gravité à confirmer par Hugo).
 */
function anomalieMandataireDesigne(r: ReglementFournisseur, b: BeneficiaireIndivisaire, positions: Position[], date: string): AnomalieReglement[] {
  const duCompte = positions.filter((p) => p.compteId === b.compteCoproprietaireId && p.qualite === 'Indivisaire')
  const siennes = duCompte.filter((p) => p.identiteId === b.identiteId)
  const enPlace = (p: Position): boolean => statutPositionA(p, date) === 'En place'
  if (siennes.length > 0 && !siennes.some(enPlace)) {
    const sortie = siennes
      .map((p) => p.dateSortie)
      .filter((d): d is string => d !== null && d <= date)
      .reduce<string | null>((plusTardive, d) => (plusTardive === null || d > plusTardive ? d : plusTardive), null)
    return [
      {
        code: 'mandataire_commun_position_sortie',
        message: `Règlement ${r.id} refusé : l'identité ${b.identiteId}, mandataire commun désigné sur le compte ${b.compteCoproprietaireId}, n'y est pas indivisaire en place le ${date} (${sortie === null ? 'position future' : `position sortie le ${sortie}`}) ; la désignation n'est pas datée : vérifier que la désignation vaut encore, puis mettre à jour le mandataire porté sur le compte.`,
        fondement: FONDEMENT_MANDATAIRE_COMMUN,
      },
    ]
  }
  if (duCompte.some(enPlace)) return []
  return [
    {
      code: 'indivision_sans_indivisaire_en_place',
      message: `Règlement ${r.id} refusé : aucun indivisaire en place le ${date} sur le compte ${b.compteCoproprietaireId} ; l'indivision a pu prendre fin : vérifier que la désignation vaut encore (mandataire commun désigné : ${b.identiteId}), ou mettre à jour les positions du compte.`,
      fondement: FONDEMENT_MANDATAIRE_COMMUN,
    },
  ]
}

/**
 * Bénéficiaire indivisaire (décision J10) : l'identité doit être le mandataire commun désigné sur le compte débité
 * (L. 1965 art. 23, al. 2), indivisaire ou non : le tiers désigné par le président du tribunal judiciaire n'a pas de
 * position à tenir ; un mandataire dont la position d'indivisaire sur ce compte n'est plus en place, ou un compte sans
 * indivisaire en place, est refusé (anomalieMandataireDesigne). Sans mandataire désigné, ou réglé à une autre identité :
 * refusé, et la position « Indivisaire » en place à la date sur ce compte (D2) reste contrôlée. Anomalies bloquantes,
 * cumulées. Le compte débité doit figurer parmi `comptes` (il porte le mandataire). Sans objet pour un autre
 * bénéficiaire.
 */
export function controlerBeneficiaireIndivisaire(
  r: ReglementFournisseur,
  positions: Position[],
  date: string,
  comptes: Pick<CompteCoproprietaire, 'id' | 'mandataireCommunId'>[],
): AnomalieReglement[] {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const b = r.beneficiaire
  if (b.type !== 'indivisaire') return []
  const compte = comptes.find((c) => c.id === b.compteCoproprietaireId)
  if (!compte)
    throw new Error(`Règlement ${r.id} : compte débité ${b.compteCoproprietaireId} non fourni ; il porte le mandataire commun des indivisaires (J10).`)
  const auMandataire = anomalieMandataireCommun(r, b, compte)
  if (auMandataire.length === 0) return anomalieMandataireDesigne(r, b, positions, date)
  return [...anomaliePositionIndivisaire(r, b, positions, date), ...auMandataire]
}

// ─── Bénéficiaire d'un compte en indivision ou démembré (J67, R80) ──────────────────────────

type BeneficiaireCoproprietaire = Extract<BeneficiaireReglement, { type: 'coproprietaire' }>
type CompteDuReglement = Pick<CompteCoproprietaire, 'id' | 'mandataireCommunId' | 'accordPaiementDemembrement'>

/** Titulaires en place à la date, sur le compte, dont la qualité est retenue. */
const titulairesEnPlace = (positions: readonly Position[], compteId: string, retenue: (qualite: QualitePosition) => boolean, date: string): string[] => [
  ...new Set(
    positions
      .filter((p) => p.compteId === compteId && retenue(p.qualite) && statutPositionA(p, date) === 'En place')
      .map((p) => p.identiteId),
  ),
]

/** Le règlement débité d'un compte copropriétaire, tel que le contrôle du bénéficiaire le lit (J67, R80). */
interface PaiementDuCompte {
  r: ReglementFournisseur
  b: BeneficiaireCoproprietaire
  /** Identités payées, sans doublon. */
  payes: string[]
  /** Titulaires en place du compte à la date, toutes qualités de copropriété confondues. */
  titulaires: string[]
  compte: CompteDuReglement
  positions: Position[]
  date: string
}

/**
 * Paiement à tous ensemble (J67, R80 : « compte à leurs noms ») : chaque titulaire du groupe est payé, et personne d'autre
 * qu'un titulaire en place du compte (C. civ. art. 1342-2 : le créancier ou la personne désignée pour recevoir).
 */
const tousEnsemble = (p: PaiementDuCompte, groupe: readonly string[]): boolean =>
  groupe.every((id) => p.payes.includes(id)) && p.payes.every((id) => p.titulaires.includes(id))

/** Payé seul : l'identité attendue (mandataire commun, bénéficiaire de l'accord écrit), et elle seule. */
const payeSeul = (p: PaiementDuCompte, attendu: string): boolean => p.payes.length === 1 && p.payes[0] === attendu

/** Identités payées qui ne sont pas titulaires en place du compte, pour le message ; vide : aucune. */
function horsTitulaires(p: PaiementDuCompte): string {
  const autres = p.payes.filter((id) => !p.titulaires.includes(id))
  return autres.length === 0 ? '' : ` ; identités payées qui ne sont pas titulaires en place du compte : ${autres.join(', ')}`
}

/**
 * Compte en indivision (J10 ; J67, R80) : le mandataire commun, ou tous les indivisaires ensemble. Payé seul, le mandataire
 * passe par le contrôle de J10 (anomalieMandataireDesigne) : sa position d'indivisaire sortie, ou aucun indivisaire en
 * place, refuse le paiement, quel que soit le type de bénéficiaire saisi.
 */
function anomalieIndivision(p: PaiementDuCompte, indivisaires: string[]): AnomalieReglement[] {
  if (tousEnsemble(p, indivisaires)) return []
  const { r, b } = p
  const mandataire = optionnel(p.compte.mandataireCommunId)
  if (mandataire !== null && payeSeul(p, mandataire))
    return anomalieMandataireDesigne(r, { type: 'indivisaire', compteCoproprietaireId: b.compteCoproprietaireId, serie450: b.serie450, identiteId: mandataire }, p.positions, p.date)
  return [
    {
      code: 'paiement_indivision_hors_mandataire',
      message: `Règlement ${r.id} refusé : le compte ${b.compteCoproprietaireId} est en indivision ; payer le mandataire commun${mandataire === null ? ' (aucun désigné)' : ` (${mandataire})`}, ou tous les indivisaires ensemble (compte à leurs noms : ${indivisaires.join(', ')}) ; un paiement à un seul indivisaire qui n'est pas mandataire est refusé${horsTitulaires(p)} (J10 ; J67, R80).`,
      fondement: `${FONDEMENT_PAIEMENT} ; ${FONDEMENT_MANDATAIRE_COMMUN}`,
    },
  ]
}

/** Compte démembré (J67, R80) : la personne désignée par l'accord écrit des deux, en vigueur à la date, ou les deux ensemble. */
function anomalieDemembrement(p: PaiementDuCompte, demembrement: string[]): AnomalieReglement[] {
  const { r, compte, date } = p
  const accord = compte.accordPaiementDemembrement ?? null
  if (accord !== null && !estDateIsoValide(accord.signeLe))
    throw new Error(`Compte ${compte.id} : date de l'accord écrit invalide (${accord.signeLe}) : AAAA-MM-JJ attendu.`)
  const parAccord = accord !== null && accord.signeLe <= date && payeSeul(p, accord.beneficiaireId.trim())
  if (parAccord || tousEnsemble(p, demembrement)) return []
  const accordLu = accord === null ? 'aucun accord écrit' : `accord écrit du ${dateIsoVersFr(accord.signeLe)} pour ${accord.beneficiaireId}`
  return [
    {
      code: 'demembrement_sans_accord',
      message: `Règlement ${r.id} refusé : compte ${compte.id} démembré (usufruit et nue-propriété ; ${accordLu}) ; payer la personne désignée par un accord écrit des deux, en vigueur au règlement, ou les deux ensemble (${demembrement.join(', ')})${horsTitulaires(p)} ; jamais le nu-propriétaire par défaut : la règle de L. 1965 art. 23, al. 3 vise le vote, et l'usufruitier qui a payé les provisions peut être le créancier (J67, R80).`,
      fondement: FONDEMENT_PAIEMENT,
    },
  ]
}

/**
 * Bénéficiaire d'un règlement débité d'un compte copropriétaire, quel que soit son type (J67, R80 ; C. civ. art. 1342-2) :
 * « indivisaire », la règle de J10 (controlerBeneficiaireIndivisaire) ; « copropriétaire », un règlement qui ne nomme
 * personne est refusé ; compte en indivision à la date, le mandataire commun ou tous les indivisaires ensemble ; compte
 * démembré, la personne désignée par l'accord écrit des deux ou les deux ensemble. Anomalies bloquantes, cumulées. Le
 * compte débité doit figurer parmi `comptes`. Sans objet pour un fournisseur.
 */
export function controlerBeneficiaireCompte(r: ReglementFournisseur, positions: Position[], date: string, comptes: CompteDuReglement[]): AnomalieReglement[] {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const b = r.beneficiaire
  if (b.type === 'fournisseur') return []
  if (b.type === 'indivisaire') return controlerBeneficiaireIndivisaire(r, positions, date, comptes)
  const compte = comptes.find((c) => c.id === b.compteCoproprietaireId)
  if (!compte) throw new Error(`Règlement ${r.id} : compte débité ${b.compteCoproprietaireId} non fourni ; il porte le mandataire commun ou l'accord écrit (J67, R80).`)
  const payes = [...new Set((b.identiteIds ?? []).map((id) => id.trim()).filter((id) => id !== ''))]
  if (payes.length === 0)
    return [
      {
        code: 'beneficiaire_non_nomme',
        message: `Règlement ${r.id} refusé : il ne nomme personne ; le paiement est fait au créancier ou à la personne désignée pour le recevoir : nommer le ou les titulaires du compte ${b.compteCoproprietaireId} qui le reçoivent (J67, R80).`,
        fondement: FONDEMENT_PAIEMENT,
      },
    ]
  const compteId = b.compteCoproprietaireId
  const paiement: PaiementDuCompte = { r, b, payes, titulaires: titulairesEnPlace(positions, compteId, estQualiteCopropriete, date), compte, positions, date }
  const indivisaires = titulairesEnPlace(positions, compteId, (qualite) => qualite === 'Indivisaire', date)
  const demembrement = titulairesEnPlace(positions, compteId, (qualite) => qualite === 'Usufruitier' || qualite === 'Nu propriétaire', date)
  return [
    ...(indivisaires.length > 0 ? anomalieIndivision(paiement, indivisaires) : []),
    ...(demembrement.length > 0 ? anomalieDemembrement(paiement, demembrement) : []),
  ]
}

// ─── Créances nées avant la désignation (J67, R79) ──────────────────────────────────────────

/** Ce que l'ordonnance et le plan disent de la suspension (enregistrement : à brancher ; fin calculée par delais-legaux.ts). */
export interface SuspensionExigibilite {
  /** Date de la décision qui désigne l'administrateur provisoire. */
  designationLe: string
  /** Durée totale de la suspension après prorogation par le juge (art. 29-3, II) ; null : douze mois. */
  dureeProrogeeMois: number | null
  /** Plan d'apurement homologué (art. 29-5) : tant qu'il s'applique et qu'il est respecté, la suspension est maintenue. */
  planApurement: { homologueLe: string; termeLe: string | null; respecte: boolean } | null
}

/** Origine de la créance réglée : la date de la prestation ; à défaut, celle de la facture (indice seulement). */
export interface OrigineCreance {
  prestationLe: string | null
  factureLe: string
}

/** Motifs qui lèvent le blocage (J67, R79) ; « contrat poursuivi » n'en est pas un (art. 29-3, III : rien sur les sommes dues avant). */
export const MOTIFS_LEVEE_SUSPENSION = ['creance_publique_ou_sociale', 'echeancier_plan_homologue', 'autre'] as const
export type MotifLeveeSuspension = (typeof MOTIFS_LEVEE_SUSPENSION)[number]

/**
 * Levée tracée du blocage : motif, texte (obligatoire pour « autre »), collaborateur et date. Elle vaut pour un règlement
 * fait le jour où elle est tracée ou après ; « échéancier du plan homologué » suppose un plan homologué à la date du
 * règlement (leveeSansEffet).
 */
export interface LeveeSuspensionExigibilite {
  motif: MotifLeveeSuspension
  precision: string | null
  collaborateurId: string
  le: string
}

export interface AnomalieCreanceAnterieure extends AnomalieReglement {
  gravite: 'bloquant' | 'alerte'
  /** Le calcul de la période de suspension, pour le contrôle. */
  justification: string
}

function verifierSuspension(s: SuspensionExigibilite): void {
  if (!estDateIsoValide(s.designationLe)) throw new Error(`Date de la désignation invalide (${s.designationLe}) : AAAA-MM-JJ attendu.`)
  const duree = s.dureeProrogeeMois
  if (duree !== null && (!Number.isInteger(duree) || duree < MOIS_SUSPENSION_EXIGIBILITE || duree > MOIS_MAX_SUSPENSION_PROROGEE))
    throw new Error(
      `Suspension de l'exigibilité prorogée : durée totale entre ${MOIS_SUSPENSION_EXIGIBILITE} et ${MOIS_MAX_SUSPENSION_PROROGEE} mois (L. 1965 art. 29-3, II), et non ${duree}.`,
    )
  const plan = s.planApurement
  if (plan && (!estDateIsoValide(plan.homologueLe) || (plan.termeLe !== null && !estDateIsoValide(plan.termeLe))))
    throw new Error("Plan d'apurement : dates d'homologation et de terme AAAA-MM-JJ attendues.")
}

function verifierLevee(levee: LeveeSuspensionExigibilite): void {
  if (!(MOTIFS_LEVEE_SUSPENSION as readonly string[]).includes(levee.motif))
    throw new Error(
      `Motif de levée « ${levee.motif} » refusé : seuls créance publique ou sociale, échéancier du plan homologué, ou autre avec un texte ; un contrat dont le juge a ordonné la poursuite n'en est pas un (L. 1965 art. 29-3, III : rien sur les sommes dues avant la désignation).`,
    )
  if (levee.motif === 'autre' && !optionnel(levee.precision)) throw new Error('Levée du blocage « autre » : texte du motif obligatoire.')
  texteRequis(levee.collaborateurId, 'Levée du blocage : identifiant du collaborateur qui la trace attendu.')
  if (!estDateIsoValide(levee.le)) throw new Error(`Date de la levée invalide (${levee.le}) : AAAA-MM-JJ attendu.`)
}

/**
 * Levée qui ne vaut pas pour le règlement du `date` (relecture du 18/11/2026), motif à l'appui ; null : elle vaut. Une levée
 * tracée après le règlement ne l'a pas autorisé ; le motif « échéancier du plan homologué » ne vaut que si un plan
 * d'apurement est homologué au plus tard ce jour (L. 1965 art. 29-5 ; J67, R79).
 */
function leveeSansEffet(levee: LeveeSuspensionExigibilite, suspension: SuspensionExigibilite, date: string): string | null {
  if (levee.le > date) return `levée tracée le ${dateIsoVersFr(levee.le)}, après le règlement du ${dateIsoVersFr(date)} : elle ne vaut pas pour lui`
  const plan = suspension.planApurement
  if (levee.motif === 'echeancier_plan_homologue' && (plan === null || plan.homologueLe > date))
    return `levée « échéancier du plan homologué » sans plan d'apurement homologué au ${dateIsoVersFr(date)}`
  return null
}

/** Période de suspension à la date : jusqu'à la fin des douze mois (ou de la prorogation), puis tant que le plan est respecté. */
function periodeDeSuspension(s: SuspensionExigibilite, date: string): { suspendue: boolean; justification: string } {
  const mois = s.dureeProrogeeMois ?? MOIS_SUSPENSION_EXIGIBILITE
  const fin = finSuspensionExigibilite(s.designationLe, s.dureeProrogeeMois)
  const plan = s.planApurement
  const planEnCours = plan !== null && plan.respecte && plan.homologueLe <= date && (plan.termeLe === null || date <= plan.termeLe)
  const duree = s.dureeProrogeeMois === null ? `${mois} mois (art. 29-3, I)` : `${mois} mois après prorogation (art. 29-3, II)`
  const planLu = plan === null ? '' : ` ; plan d'apurement homologué le ${dateIsoVersFr(plan.homologueLe)}${plan.respecte ? ', respecté' : ', non respecté'} (art. 29-5)`
  return {
    suspendue: date >= s.designationLe && (date <= fin || planEnCours),
    justification: `Désignation du ${dateIsoVersFr(s.designationLe)} : exigibilité suspendue ${duree}, jusqu'au ${dateIsoVersFr(fin)}${planLu}.`,
  }
}

/**
 * Créance d'origine antérieure à la désignation de l'administrateur provisoire (J67, R79 ; L. 1965 art. 29-3, 29-5) :
 * pendant la période de suspension, le règlement d'une facture dont la prestation précède la décision est bloqué, sauf
 * levée tracée au plus tard le jour du règlement (créance publique ou sociale, échéancier du plan homologué quand un plan
 * est homologué à cette date, autre motif écrit ; leveeSansEffet) ; prestation non datée et
 * facture postérieure à la décision : alerte « origine à vérifier ». Hors période, prestation postérieure, remboursement
 * à un copropriétaire : rien.
 */
export function controlerCreanceAnterieure(
  r: ReglementFournisseur,
  origine: OrigineCreance,
  suspension: SuspensionExigibilite,
  date: string,
  levee: LeveeSuspensionExigibilite | null = null,
): AnomalieCreanceAnterieure[] {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (!estDateIsoValide(origine.factureLe) || (origine.prestationLe !== null && !estDateIsoValide(origine.prestationLe)))
    throw new Error('Origine de la créance : dates de la facture et de la prestation AAAA-MM-JJ attendues.')
  verifierSuspension(suspension)
  if (levee !== null) verifierLevee(levee)
  if (r.beneficiaire.type !== 'fournisseur') return []
  const periode = periodeDeSuspension(suspension, date)
  const sansEffet = levee === null ? null : leveeSansEffet(levee, suspension, date)
  if (!periode.suspendue || (levee !== null && sansEffet === null)) return []
  const reference = origine.prestationLe ?? origine.factureLe
  if (reference >= suspension.designationLe)
    return origine.prestationLe === null
      ? [
          {
            code: 'origine_creance_a_verifier',
            gravite: 'alerte',
            message: `Règlement ${r.id} : prestation non datée, facture du ${dateIsoVersFr(origine.factureLe)} postérieure à la désignation ; une facture récente peut porter une prestation ancienne, dont l'exigibilité est suspendue : saisir la date de la prestation.`,
            fondement: FONDEMENT_SUSPENSION,
            justification: periode.justification,
          },
        ]
      : []
  const datee = origine.prestationLe === null ? `facture du ${dateIsoVersFr(origine.factureLe)}` : `prestation du ${dateIsoVersFr(origine.prestationLe)}`
  return [
    {
      code: 'creance_anterieure_suspendue',
      gravite: 'bloquant',
      message: `Règlement ${r.id} refusé : créance d'origine antérieure à la désignation (${datee}), dont l'exigibilité est suspendue ; payer hors du plan romprait l'égalité des créanciers ; lever par un motif tracé : créance publique ou sociale, paiement prévu à l'échéancier du plan homologué, ou autre motif écrit${sansEffet === null ? '' : ` (${sansEffet})`}.`,
      fondement: FONDEMENT_SUSPENSION,
      justification: periode.justification,
    },
  ]
}

// ─── Rapprochement ──────────────────────────────────────────────────────────────────────────

/** J9 — rejeté à la date de la vue : sans date, dès qu'il porte son rejet ; à une date, si le rejet date de ce jour ou d'avant. */
function rejeteA(r: ReglementFournisseur, aLaDate: string | undefined): boolean {
  if (!r.rejet) return false
  return aLaDate === undefined || r.rejet.le <= aLaDate
}

/** J9 — un virement rejeté se lit comme payé : sa sortie a pu être pointée au relevé avant son retour. */
function commePaye(r: ReglementFournisseur): ReglementFournisseur {
  if (!r.rejet) return r
  const statut: StatutReglementFournisseur = r.rapprochement ? 'Rapproché' : 'Enregistré'
  return { ...r, statut }
}

/**
 * Statut « Rapproché » propagé depuis les arrêtés (rapprochement-pieces.ts, partagé avec les encaissements) : un
 * règlement « Enregistré » pointé passe « Rapproché », un règlement dépointé revient « Enregistré ». Un virement rejeté
 * (J9) prend ou perd le pointage de sa sortie sans anomalie et reste « Annulé » ; à une date (`aLaDate`) antérieure à son
 * rejet, il garde le statut propagé à cette date. Passer tous les règlements des comptes concernés.
 */
export function rapprocherReglements(
  reglements: ReglementFournisseur[],
  arretes: ArreteRapprochement[],
  { aLaDate }: { aLaDate?: string } = {},
): { reglements: ReglementFournisseur[]; anomalies: AnomalieLienRapprochement[] } {
  const { pieces, anomalies } = propagerStatutRapproche(reglements.map(commePaye), arretes, {
    type: 'reglement',
    rapproche: 'Rapproché',
    avant: 'Enregistré',
    aLaDate,
  })
  return { reglements: pieces.map((r): ReglementFournisseur => (rejeteA(r, aLaDate) ? { ...r, statut: 'Annulé' } : r)), anomalies }
}
