import {
  NATURES_COMPTE_BANCAIRE,
  estCompteDuFondsTravaux,
  validerIban,
  verifierMarquesFondsTravaux,
  type MarquesFondsTravaux,
  type NatureCompteBancaire,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { refDecret1967, refLoi1965 } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  controlerAffectationFondsTravaux,
  estDecisionAdministrateurProvisoire,
  type DecaissementFondsTravaux,
  type ResultatAffectation,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { creerOrdreVirement, genererPain001, verifierEmission, type StatutOrdre } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import type { ReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import { creerTraitement, type FamilleTraitement, type LigneMouvement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import {
  TYPE_VIREMENT_INTERNE,
  controlerRangsDuLot,
  verifierRang,
  type OrdreDuLot,
} from '@/lib/administrateur-judiciaire/domain/types-ordres-banque'
import type { FicheValidationBanque } from '@/lib/administrateur-judiciaire/domain/validation-banque'

/**
 * Virement de banque à banque entre comptes du syndicat (point 39 du bilan 2). Fonctions pures, montants en CENTIMES
 * ENTIERS, dates ISO, sans écran ni table.
 *
 * Gestéam —
 * - tranche 43 § 12 : 🟢 un virement de banque à banque (par exemple du compte courant vers le compte du fonds de travaux,
 *   ou entre un compte séparé et un compte de regroupement) est un traitement distinct, « Règlement de banque à banque » ;
 *   ses ordres sont des lignes du lot, avec leur rang ;
 * - tranche 29 : 🟢 « Règlement de banque à banque » figure parmi les traitements du journal ; les comptes de trésorerie
 *   d'un mandat sont des sous-comptes 512 <mandat>.512xx.00000.0 (Banque, regroupement, avance travaux, fonds travaux,
 *   placements, CDC travaux, comptes de l'ancien syndic ou de l'ancien AJ) ;
 * - décision D-BANQUE (27/10/2026) : la tenue des comptes est un réglage du cabinet ; le compte du fonds de travaux est
 *   toujours distinct ; chaque compte a une nature (comptes-bancaires.ts).
 *
 * 🟢 Lu sur le texte (Légifrance, versions en vigueur au 30/10/2026) :
 * - L. 1965 art. 18, II, al. 3 : compte séparé au nom du syndicat, sans convention de fusion ni compensation avec tout
 *   autre compte ; al. 4 : compte séparé rémunéré du fonds de travaux, dans le même établissement, sans fusion ni
 *   compensation, et « Les virements en provenance du compte mentionné au troisième alinéa du présent II sont
 *   autorisés » (seule occurrence du mot « virement » dans la loi) ; dernier al. : le syndic ne peut avancer de fonds au
 *   syndicat, à l'exception du syndic provisoire et de l'administrateur provisoire désigné en application des art. 29-1
 *   et 29-11 ;
 * - L. 1965 art. 14-2-1, I, al. 7 : l'assemblée affecte les sommes du fonds aux dépenses des 1° à 4°, à la majorité de la
 *   dépense ; III : les sommes sont attachées aux lots et jamais remboursées au vendeur ;
 * - L. 1965 art. 29-14, 2° : le juge peut autoriser l'administrateur provisoire à utiliser le fonds pour le redressement
 *   ou la gestion courante ; art. 29-1, I, al. 2 : l'administrateur provisoire reçoit tout ou partie des pouvoirs de
 *   l'assemblée selon l'ordonnance ;
 * - D. 1967 art. 35-1 : l'assemblée décide, s'il y a lieu, du placement des fonds recueillis ;
 * - arrêté du 14 mars 2005, art. 7 et 8 : classe 5 = 50 Fonds placés, 512 Banques, 514, 53 Caisse ; ni 5115 ni 58
 *   « Virements internes » ; seuls ces comptes et leurs subdivisions sont utilisables ; art. 10 : le compte 105 « Fonds de
 *   travaux » est crédité des cotisations et débité par le 705 « Affectation du fonds de travaux ».
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J30, J31 et J37 ; questions 21 à 23 de la liste) :
 * - J30 : l'ordonnance de l'art. 29-14, 2° (autorisationJuge) se saisit en forme structurée : juridiction, date et n° de
 *   l'ordonnance, chacun obligatoire, date jamais postérieure à aujourd'hui (fonds-travaux.ts, OrdonnanceJuge). La
 *   décision d'affectation de l'assemblée (decisionAg) : date de l'AG et n° de la résolution (DecisionAffectationAg ;
 *   confirmée par J42, ci-dessous). Une sortie du fonds dont la forme structurée est incomplète, ou datée après aujourd'hui,
 *   est refusée, motif à l'appui. creerVirementInterne et creerLotVirementsInternes sont des saisies nouvelles : un
 *   texte libre est refusé, motif « forme incomplète » à l'appui (contrôle d'affectation avec `nouvelleSaisie`) ; la
 *   lecture d'une valeur enregistrée avant J30 reste celle de fonds-travaux.ts (lireOrdonnanceJuge,
 *   lireDecisionAffectationAg ; formeIncomplete du contrôle). creerVirementInterne reçoit la date du jour
 *   (`aujourdhui`), exigée dès qu'une forme structurée est contrôlée.
 * - J31 : aucune avance de fonds au syndicat, ni par le syndic désigné en justice (D. 1967 art. 46), ni par
 *   l'administrateur provisoire de l'art. 47. Le refus devient une décision : ce module n'enregistre aucune avance, et un
 *   compte d'un autre syndicat (ou du cabinet) reste refusé.
 * - J37 : le compte de l'administrateur provisoire est un compte à la Caisse des dépôts, pas un compte centralisateur du
 *   cabinet (pratique du cabinet, comptes-bancaires.ts : MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE) ; le fonds de travaux y
 *   reste sur un compte distinct (L. 1965 art. 18, II, al. 4) : nature « fonds_travaux », identifiant et 512 propres,
 *   même sans IBAN (verifierPaire). D-BANQUE est inchangée : aucun mode n'est imposé.
 *
 * Décisions de Hugo du 06/11/2026 (registre des décisions juridiques, J42 ; PR #643, suite de J30) :
 * - J42 : la décision d'affectation de l'AG prend la forme date de l'AG + n° de la résolution, obligatoires ; un texte
 *   libre est refusé pour toute nouvelle saisie (creerVirementInterne, creerLotVirementsInternes). L'interprétation de
 *   J30 est confirmée : sa marque de doute est retirée, comportement inchangé (mêmes refus, mêmes motifs :
 *   fonds-travaux.ts).
 *
 * Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67, J68 et J71 ; validées en bloc ; textes lus sur
 * Légifrance le 17/11/2026) :
 * - J67, R82 : le syndic ne prend jamais seul sur le fonds pour des travaux urgents. L'art. 14-2-1, I, 3° dit à quoi le
 *   fonds peut servir ; c'est l'assemblée qui l'affecte (al. 7). En urgence, le syndic n'a qu'un pouvoir propre : une
 *   provision d'au plus un tiers du devis, après avis du conseil syndical, l'assemblée étant convoquée immédiatement
 *   (D. 1967 art. 37). Blocage gardé (controlerAffectationFondsTravaux). En administration provisoire, deux voies :
 *   l'ordonnance de l'art. 29-14, 2°, ou la décision de l'administrateur qui a reçu les pouvoirs de l'assemblée (art.
 *   29-1, I), sans avis du conseil syndical en cas d'urgence (D. 1967 art. 62-7 ; J16) ; la forme de cette décision est
 *   fixée par la décision du 20/11/2026 (partie C, F96, ci-dessous).
 * - J67, R83 : écriture directe de 512 à 512, sans compte d'attente : aucun texte ne l'impose ; le 47 sert aux opérations
 *   en attente d'imputation et se solde à la clôture ou se justifie ligne à ligne (arrêté du 14 mars 2005, art. 7 et
 *   10) ; un décalage entre les deux relevés se voit au rapprochement bancaire. Le compte séparé rémunéré du fonds (L.
 *   1965 art. 18, II, al. 4) est une subdivision du 512 (arrêté du 14 mars 2005, art. 8 : « toute subdivision
 *   nécessaire »), comme chez Gestéam ; le 50 « Fonds placés » reste pour un vrai placement (D. 1967 art. 35-1), non
 *   pris en charge ici (ci-dessous).
 * - J67, R94 : le dépôt à la Caisse des dépôts des fonds de l'administrateur provisoire a pour fondement probable C. com.
 *   R. 814-41 (mandats « en matière civile » ; compte au nom de l'administrateur) ; « matière civile » : déduit, à
 *   confirmer ; le dépôt n'est pas présenté comme imposé par la loi de 1965 (art. 29-3, V le présuppose). Détail :
 *   comptes-bancaires.ts. Aucun changement de comportement.
 * - J68 (point D13, extension de J9 aux virements internes ; modèle : rejeterVirement de reglements-fournisseurs.ts) : un
 *   virement d'un lot émis que la banque rejette ne sort pas du lot, qui a été émis et s'écrit entier ;
 *   rejeterVirementInterne passe l'écriture contraire de sa seule ligne (débit du 512 source, crédit du 512 de
 *   destination), datée du retour (au plus tôt du jour de l'écriture du lot, qu'elle annule : arrêté du 14 mars 2005, art.
 *   5), avec le motif donné par la banque. Une sortie du fonds rejetée y revient : l'emploi rattaché n'a pas eu lieu ;
 *   une alimentation rejetée n'y est jamais entrée. Le virement reste émis, imputé, à son rang, et porte son rejet ; un
 *   rejet ne s'écrit qu'une fois. Famille : « Annulation de règlements », comme pour les règlements de factures (à
 *   confirmer au relevé Gestéam, ci-dessous). Enregistrement du rejet : à brancher.
 * - J71 (point E2 ; L. 1965 art. 18, II, al. 4 ; D. 1967 art. 35, 5°, et 35-1 ; décret n° 2005-240, art. 4) : placement du
 *   fonds de travaux. Sans décision de placement, refus (comportement antérieur). Avec une décision (assemblée,
 *   administrateur provisoire qui a reçu ce pouvoir, ou ordonnance), le virement du compte du fonds vers un compte de
 *   placement au nom du syndicat, réservé au fonds (reserveAuFondsTravaux, comptes-bancaires.ts), est admis. L'argent
 *   reste au fonds : ce n'est pas un emploi (aucun contrôle d'affectation, compte 105 inchangé). Le placement réservé ne
 *   revient qu'à un compte du fonds, et n'est alimenté que depuis un compte du fonds (les cotisations sont versées sur le
 *   compte séparé du fonds : art. 18, II, al. 4). Un placement non réservé au fonds reste refusé. Les intérêts restent
 *   acquis au syndicat, hors des parts des lots (fonds-travaux-lots.ts, J67, R88).
 *
 * Décisions du 20/11/2026 (partie C du relevé des questions ouvertes du code, recommandations acceptées par le
 * responsable du projet) :
 * - Décision du 20/11/2026 (partie C, F95), même question que G28 (partie B) : la loi autorise les virements du compte
 *   courant vers le compte du fonds et ne dit rien des sorties (L. 1965 art. 18, II, al. 4) ; une sortie est un emploi,
 *   qui exige une affectation (art. 14-2-1, I, al. 7). Par défaut, la facture se paie directement depuis le compte du
 *   fonds : une seule sortie, traçable, sous contrôle d'affectation (travaux-budget.ts,
 *   controlerReglementDepuisLeFondsOperation). Le virement vers le compte courant reste admis, pour le seul montant
 *   affecté (plafondAffectation, fourni par l'appelant : la décision d'affectation ne porte pas de montant ; absent, non
 *   contrôlé et signalé dans alertes) et avec la référence de la décision (emploiFondsTravaux) ; il est alors marqué
 *   « emploi » (marque), et la facture payée ensuite s'y rattache (rattacherReglementAuVirementEmploi) ;
 * - Décision du 20/11/2026 (partie C, F96) : en administration provisoire, la décision de l'administrateur qui affecte
 *   le fonds sous l'art. 29-1 se saisit dans la troisième forme structurée « décision de l'administrateur provisoire »
 *   (fonds-travaux.ts, DecisionAdministrateurProvisoire, dans decisionAg) : l'ordonnance de l'art. 29-1 (juridiction,
 *   date, n°) et la case « pouvoirs de l'AG confiés », la date et le n° de la décision au registre des décisions (D. 1967
 *   art. 62-8), l'avis du conseil syndical ou le constat d'urgence (art. 62-7 ; J16, J46) ; contrôlée à la saisie comme
 *   les autres formes (J30 : date jamais postérieure au jour), copiée en profondeur avec l'emploi ; la date comparée à la
 *   dépense est celle de la décision (fonds-travaux-lots.ts). Sous l'art. 29-1, ce n'est pas l'ordonnance qui affecte le
 *   fonds : c'est l'administrateur qui décide, avec les pouvoirs qu'elle lui confie ;
 * - Décision du 20/11/2026 (partie C, F103) : le fichier pain.001 d'un virement interne reçoit la fiche « validation
 *   banque » du compte source (fichierVirementInterne, option validationBanque) ; sans elle, il porte la mention « non
 *   validé par la banque » (validation-banque.ts) ;
 * - Décision du 20/11/2026 (partie C, F112) : une part du fonds de travaux reçue sur le compte courant n'est pas
 *   bloquée ; elle est signalée et reste à virer jusqu'au virement interne qui alimente le fonds depuis ce compte :
 *   alimentationsDuFonds rend ces alimentations, émises et non rejetées, qui soldent la part « à virer »
 *   (encaissements-pieces.partsFondsTravauxAVirer), avec une alerte passé le délai réglé par le cabinet.
 *
 * 🔵 Déduit :
 * - un virement interne relie deux comptes ACTIFS, distincts, du MÊME syndicat (D1), sans tiers ; une avance de fonds du
 *   gestionnaire au syndicat (interdite au syndic par l'art. 18, II, dernier al., sauf au syndic provisoire et à
 *   l'administrateur provisoire désigné en application des art. 29-1 et 29-11) viendrait d'un tiers : ce n'est jamais un
 *   virement interne ; refusée ici, ce module n'en enregistre aucune (J31 pour les régimes des art. 46 et 47) ;
 * - rang : chaque virement porte son rang dans le lot (colonne « Or. ») et la taille de son lot (nombreOrdresDuLot,
 *   donnée VitFix : la fiche Gestéam ne montre que « Traitement n° + rang »), saisis ensemble (rang ≤ taille) ou
 *   attribués par creerLotVirementsInternes ; le lot est fermé comme un ordre de virement l'est par ses lignes, et
 *   contrôlé AVANT l'envoi à la banque : emettreLotVirementsInternes émet le lot entier, en une fois (comme emettreOrdre
 *   pour un ordre de virement), s'il compte exactement les rangs 1 à cette taille, chacun une fois (controlerRangsDuLot),
 *   sous un traitement libre (absent du journal, réservé par aucun autre virement déjà émis) ; l'écriture refait ces
 *   contrôles ; un lot émis s'écrit donc toujours, en une fois, jamais en partie ni deux fois ; avant l'émission, un lot
 *   refusé se recompose (recomposerLotVirementsInternes : virement abandonné retiré, rangs refaits, traitement neuf) ;
 *   émis, il ne change plus ;
 * - le « compte mentionné au troisième alinéa » est le compte séparé principal ; l'alimentation du fonds depuis un autre
 *   compte du syndicat n'est interdite par aucun texte (l'argent entre au fonds, il n'en sort pas) : admise ;
 * - sortie du fonds vers un autre compte : elle se rattache à un emploi du fonds, contrôlé par
 *   controlerAffectationFondsTravaux (fonds-travaux.ts, J4) : décision d'affectation de l'assemblée, ou ordonnance du
 *   juge (art. 29-14, 2°) ; en administration provisoire, la décision de l'administrateur qui a reçu les pouvoirs de
 *   l'assemblée (art. 29-1) se cite dans sa forme structurée (F96, ci-dessus), pour les seules dépenses du I, 1° à 4°
 *   (decisionAg) : l'assemblée ne pouvant affecter le
 *   fonds qu'à ces dépenses, le redressement ou le maintien de la gestion courante exigent l'ordonnance de l'art. 29-14,
 *   2° (autorisationJuge) ;
 * - d'un compte du fonds à un autre compte du fonds (changement de banque, dépôt à la Caisse des dépôts, retour d'un
 *   placement réservé au fonds) : l'argent reste au fonds ; admis sans décision ;
 * - vers un compte de placement : c'est un placement des fonds (D. 1967 art. 35-1), décision de l'assemblée exigée (ou
 *   ordonnance qui en confie le pouvoir) ; depuis le fonds de travaux, seulement vers un placement réservé au fonds
 *   (J71, ci-dessus) ;
 * - un compte repris de l'ancien gestionnaire se solde vers le compte du mandat puis se clôture (comptes-bancaires.ts) :
 *   jamais alimenté ; s'il tenait le fonds de travaux (tenaitFondsTravaux), ses sommes restent des cotisations au fonds
 *   (art. 18, II, al. 4 ; art. 14-2-1, I, al. 7) : vers un compte du fonds, c'est un changement de compte ; ailleurs, une
 *   sortie du fonds, sous contrôle d'affectation ;
 * - sans compensation (art. 18, II, al. 3 et 4) : chaque virement s'écrit pour son montant brut, dans son sens, jamais
 *   par solde net, même dans un lot qui en compte de sens contraires ;
 * - écriture au paiement, comme un règlement : après l'émission, débit du 512 de destination, crédit du 512 de source,
 *   sans compte de transit ; le compte 105 n'est pas touché : l'affectation (105 → 705) est une écriture distincte, non
 *   passée ici ;
 * - même IBAN pour deux comptes : un seul compte bancaire ; avec le fonds de travaux, il serait confondu (art. 18, II,
 *   al. 4).
 *
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - Frédéric : un compte repris qui tenait le fonds de travaux se distingue-t-il dans Gestéam (tranche 29 : un seul
 *   libellé « Banque ancien AJ / ancien syndic ») ? VitFix le marque à la saisie du compte (tenaitFondsTravaux) ;
 * - Frédéric : Gestéam rattache-t-il le virement de banque à banque à un ordre de type « Ordre de virement », le syndicat
 *   pour tiers ? Le bilan a retenu un type VitFix à part, sans tiers ;
 * - Frédéric : Gestéam laisse-t-il « Enregistré » un ordre d'un lot dont les autres sont « Émis » (statut affiché par
 *   ordre) ? Non observé ; VitFix émet le lot entier (un virement rejeté se corrige ensuite : J68, ci-dessus) ;
 * - aucune famille d'annulation observée pour « Règlement de banque à banque » (relevé Gestéam à faire) : l'écriture
 *   contraire d'un virement rejeté (J68) prend « Annulation de règlements », la famille des règlements de factures ;
 *   annulerTraitement (traitements.ts) refuse toujours la contre-passation générale de ce traitement ; laquelle retenir ?
 * - que recouvre la famille « Ajustement bancaire fonds travaux » du référentiel (non observée) ? Non utilisée ici ;
 * - compte de placement (J71 compris) lu en sous-compte 512 (COMPTE_512), comme les placements de Gestéam (tranche 29) ;
 *   un placement décidé par l'assemblée relève pourtant du 50 « Fonds placés » (D. 1967 art. 35-1) : classe 50 « Fonds
 *   placés » (J67, R83) non prise en charge, à trancher (fonds-detenus.ts compte les placements de classe 50 depuis la
 *   décision du 20/11/2026, partie C, F98).
 */

/** Famille Gestéam du traitement d'un virement interne (référentiel FAMILLE_TRAITEMENT, bloc Règlements). */
export const FAMILLE_VIREMENT_INTERNE: FamilleTraitement = 'Règlement de banque à banque'

/**
 * J68 — famille de l'écriture contraire d'un virement interne rejeté : celle des règlements de factures (J9), seule
 * annulation du bloc Règlements du référentiel ; 🔴 à confirmer au relevé Gestéam (en-tête).
 */
export const FAMILLE_REJET_VIREMENT_INTERNE: FamilleTraitement = 'Annulation de règlements'

const FONDEMENT_FONDS_SEPARE = citerFondement(refLoi1965('18, II, al. 4'))
const FONDEMENT_AVANCE = citerFondement(refLoi1965('18, II, dernier al.'))
const FONDEMENT_AFFECTATION = citerFondement(refLoi1965('14-2-1, I, al. 7'))
const FONDEMENT_29_14 = citerFondement(refLoi1965('29-14, 2°'))
const FONDEMENT_PLACEMENT = citerFondement(refDecret1967('35-1'))
const FONDEMENT_POUVOIRS_AP = citerFondement(refLoi1965('29-1, I'))
const COMPTE_512 = /^([^.]{4})\.512[0-9A-Z]{2}\.[0-9A-Z]{5}\.[0-9A-Z]$/

/**
 * Compte bancaire du syndicat, tel que le virement le lit (D-BANQUE : nature ; plan comptable : son 512). Marques du fonds
 * de travaux (comptes-bancaires.ts) : tenaitFondsTravaux, réservé à un compte repris de l'ancien gestionnaire qui tenait
 * le fonds ; reserveAuFondsTravaux, réservé à un compte de placement au nom du syndicat réservé au fonds (J71) ; absentes :
 * faux.
 */
export interface CompteVirementInterne extends MarquesFondsTravaux {
  banqueId: string
  coproprieteId: string
  nature: NatureCompteBancaire
  /** Null pour un compte sans IBAN propre (Caisse des dépôts, sous-compte centralisateur) : pas de fichier. */
  iban: string | null
  bic: string | null
  /** Sous-compte 512 du syndicat : <syndicat>.512xx.<auxiliaire>.<repère>. */
  compte512: string
  actif: boolean
}

/** Ce que le sens au regard du fonds de travaux lit d'un compte. */
export type CompteFonds = MarquesFondsTravaux

/** Emploi du fonds de travaux auquel se rattache un virement qui en sort (fonds-travaux.ts, montant = le virement). */
export type EmploiFondsTravaux = Omit<DecaissementFondsTravaux, 'montantCentimes'>

export interface SaisieVirementInterne {
  id: string
  numero: string
  date: string
  coproprieteId: string
  /** D1 : la mission qui ordonne le virement. */
  mandatId: string
  /** Traitement « Règlement de banque à banque » sous lequel le virement s'écrit, une fois émis. */
  traitementId: string
  /** Rang du virement dans son lot (colonne « Or. », fiche « Traitement n° + rang »), à partir de 1. */
  rang: number
  /** Nombre de virements du lot, saisi avec le rang (rang ≤ taille) : le traitement exige exactement les rangs 1 à ce nombre. */
  nombreOrdresDuLot: number
  source: CompteVirementInterne
  destination: CompteVirementInterne
  montantCentimes: number
  libelle: string
  /** Exigé pour une sortie du fonds de travaux, refusé sinon. */
  emploiFondsTravaux?: EmploiFondsTravaux | null
  /** Exigée vers un compte de placement (D. 1967 art. 35-1), refusée sinon : décision d'assemblée ou ordonnance. */
  decisionPlacement?: string | null
  /**
   * Sortie du fonds (F95) : montant affecté par la décision et déjà employé sous elle, fournis par l'appelant (la décision
   * d'affectation de l'assemblée ne porte pas de montant : DecisionAffectationAg) ; le virement ne va pas au-delà.
   * Absent : non contrôlé, signalé (alertes). Sans objet hors d'une sortie du fonds.
   */
  plafondAffectation?: { montantAffecteCentimes: number; dejaEmployeCentimes?: number } | null
}

/** Marque d'un virement qui sort du fonds de travaux vers un autre compte du syndicat : un emploi du fonds (F95). */
export type MarqueVirementFondsTravaux = 'emploi'

/** Effet du virement sur le fonds de travaux, selon la nature des deux comptes. */
export type MouvementFondsTravaux = 'aucun' | 'alimentation' | 'sortie' | 'changement_de_compte'

export interface VirementInterne {
  id: string
  numero: string
  date: string
  coproprieteId: string
  mandatId: string
  traitementId: string
  rang: number
  nombreOrdresDuLot: number
  source: CompteVirementInterne
  destination: CompteVirementInterne
  montantCentimes: number
  libelle: string
  type: typeof TYPE_VIREMENT_INTERNE
  famille: FamilleTraitement
  mouvementFondsTravaux: MouvementFondsTravaux
  emploiFondsTravaux: EmploiFondsTravaux | null
  /** Contrôle d'affectation d'une sortie du fonds (admis) ; null sinon. */
  affectation: ResultatAffectation | null
  /** F95 : « emploi » pour une sortie du fonds (la facture payée ensuite s'y rattache) ; null sinon. */
  marque: MarqueVirementFondsTravaux | null
  /** F95 : alertes non bloquantes de la saisie (montant affecté non fourni). */
  alertes: string[]
  decisionPlacement: string | null
  statut: StatutOrdre
  dateEmission: string | null
  impute: boolean
  /** J68 — rejet par la banque après l'émission et l'écriture du lot (rejeterVirementInterne) ; null sinon. */
  rejet: RejetVirementInterne | null
}

/** J68 — rejet d'un virement interne d'un lot émis et écrit. */
export interface RejetVirementInterne {
  /** Jour où le retour est constaté (AAAA-MM-JJ). */
  le: string
  /** Motif donné par la banque. */
  motif: string
  /** Traitement « Annulation de règlements » qui porte l'écriture contraire de la seule ligne rejetée. */
  traitementId: string
}

const ibanNormalise = (iban: string): string => iban.replaceAll(/\s+/g, '').toUpperCase()

function texteRequis(valeur: string | null | undefined, message: string): void {
  if (!valeur?.trim()) throw new Error(message)
}

/** J71 : compte de placement réservé au fonds de travaux. */
const estPlacementDuFonds = (c: CompteFonds): boolean => c.nature === 'placement' && c.reserveAuFondsTravaux === true

/** Sens du virement au regard du fonds de travaux : y entre, en sort, passe d'un compte du fonds à un autre, ou rien. */
export function mouvementFondsTravaux(source: CompteFonds, destination: CompteFonds): MouvementFondsTravaux {
  const depuisFonds = estCompteDuFondsTravaux(source)
  const versFonds = estCompteDuFondsTravaux(destination)
  if (depuisFonds && versFonds) return 'changement_de_compte'
  if (depuisFonds) return 'sortie'
  if (versFonds) return 'alimentation'
  return 'aucun'
}

/**
 * Décision du 20/11/2026 (partie C, F112) — virements qui versent au fonds de travaux depuis un compte qui ne le tient pas
 * (alimentation), émis et non rejetés (J68) : ils soldent la part « à virer » des cotisations reçues sur ce compte
 * (encaissements-pieces.partsFondsTravauxAVirer). L'ordre reçu est conservé.
 */
export function alimentationsDuFonds(virements: readonly VirementInterne[]): VirementInterne[] {
  return virements.filter((v) => v.mouvementFondsTravaux === 'alimentation' && v.statut === 'Émis' && v.rejet === null)
}

// ─── Création ───────────────────────────────────────────────────────────────────────────────

const MESSAGE_SANS_TRAITEMENT = 'Virement interne sans traitement de rattachement (« Règlement de banque à banque »).'

/** Place du virement dans son lot : rang entier ≥ 1, taille du lot entière ≥ 1, rang compris dans le lot. */
function verifierPlaceDansLot(rang: number, nombreOrdresDuLot: number): void {
  verifierRang(rang)
  if (!Number.isInteger(nombreOrdresDuLot) || nombreOrdresDuLot < 1)
    throw new Error(`Taille du lot invalide (${nombreOrdresDuLot}) : nombre entier de virements, à partir de 1, attendu avec le rang.`)
  if (rang > nombreOrdresDuLot) throw new Error(`Rang ${rang} hors du lot de ${nombreOrdresDuLot} virements : rangs 1 à ${nombreOrdresDuLot} attendus.`)
}

function verifierEnTete(saisie: SaisieVirementInterne): void {
  texteRequis(saisie.id, 'Virement interne sans identifiant.')
  texteRequis(saisie.numero, 'Virement interne sans numéro.')
  texteRequis(saisie.coproprieteId, 'Virement interne sans syndicat (D1).')
  texteRequis(saisie.mandatId, 'Virement interne sans mandat (D1 : la mission qui ordonne le virement).')
  texteRequis(saisie.traitementId, MESSAGE_SANS_TRAITEMENT)
  texteRequis(saisie.libelle, 'Libellé du virement attendu.')
  verifierPlaceDansLot(saisie.rang, saisie.nombreOrdresDuLot)
  if (!Number.isInteger(saisie.montantCentimes) || saisie.montantCentimes <= 0)
    throw new Error(`Montant invalide (${saisie.montantCentimes}) : centimes entiers strictement positifs attendus.`)
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
}

function verifierCompte(c: CompteVirementInterne, role: 'source' | 'destination', coproprieteId: string, segmentSyndicat: string): void {
  texteRequis(c.banqueId, `Compte ${role} sans identifiant.`)
  const nom = `Compte ${role} ${c.banqueId}`
  if (!Object.hasOwn(NATURES_COMPTE_BANCAIRE, c.nature)) throw new Error(`${nom} : nature inconnue « ${c.nature} ».`)
  verifierMarquesFondsTravaux(c, nom)
  if (c.coproprieteId !== coproprieteId)
    throw new Error(
      `${nom} : compte d'un autre syndicat ; un virement interne relie deux comptes du même syndicat (D1). Une avance de fonds au syndicat n'est pas un virement interne ; le syndic ne peut en faire, sauf le syndic provisoire et l'administrateur provisoire désigné en application des art. 29-1 et 29-11 (${FONDEMENT_AVANCE}).`,
    )
  if (!c.actif) throw new Error(`${nom} : compte inactif.`)
  if (c.iban !== null && !validerIban(c.iban)) throw new Error(`${nom} : IBAN invalide (format ou clé).`)
  const lu = COMPTE_512.exec(c.compte512)
  if (!lu) throw new Error(`${nom} : compte « ${c.compte512} », 512 au format <syndicat>.512xx.<auxiliaire>.<repère> attendu.`)
  if (lu[1] !== segmentSyndicat)
    throw new Error(`${nom} : compte « ${c.compte512} » d'un autre syndicat (segment « ${segmentSyndicat} » attendu, D1).`)
}

function verifierPaire(source: CompteVirementInterne, destination: CompteVirementInterne): void {
  if (source.banqueId === destination.banqueId) throw new Error(`Source et destination : même compte (${source.banqueId}).`)
  if (source.compte512 === destination.compte512) throw new Error(`Source et destination : même compte 512 (${source.compte512}).`)
  const memeIban = source.iban !== null && destination.iban !== null && ibanNormalise(source.iban) === ibanNormalise(destination.iban)
  const avecFonds = estCompteDuFondsTravaux(source) || estCompteDuFondsTravaux(destination)
  if (memeIban && avecFonds)
    throw new Error(
      `Fonds de travaux : même IBAN qu'un autre compte du syndicat ; le fonds est déposé sur un compte séparé, sans fusion ni compensation (${FONDEMENT_FONDS_SEPARE}).`,
    )
  if (memeIban) throw new Error('Source et destination : même IBAN, donc un seul compte bancaire.')
  if (destination.nature === 'repris_ancien_gestionnaire')
    throw new Error(`Compte ${destination.banqueId} repris de l'ancien gestionnaire : il se solde vers le compte du mandat puis se clôture, jamais alimenté.`)
}

/** Copie d'une référence de l'emploi : une forme structurée (J30) n'est pas partagée avec la saisie. */
const copieReference = <R>(reference: R): R => (typeof reference === 'object' && reference !== null ? { ...reference } : reference)

/** Copie de la décision d'affectation : la décision de l'administrateur provisoire (F96) est copiée en profondeur. */
function copieDecisionAffectation(decision: EmploiFondsTravaux['decisionAg']): EmploiFondsTravaux['decisionAg'] {
  if (!estDecisionAdministrateurProvisoire(decision)) return copieReference(decision)
  return { ...decision, ordonnance: { ...decision.ordonnance }, decision: { ...decision.decision }, avisOuUrgence: { ...decision.avisOuUrgence } }
}

const F95 = 'décision du 20/11/2026, partie C, F95'

/** F95 : alerte d'une sortie du fonds dont le montant affecté n'est pas fourni. */
export const ALERTE_MONTANT_AFFECTE_NON_FOURNI = `Sortie du fonds de travaux : montant affecté par la décision non fourni : non contrôlé ; le virement vers le compte courant n'est admis que pour le seul montant affecté (${F95}).`

/**
 * F95 — le virement qui sort du fonds ne va pas au-delà du montant affecté par la décision, déjà employé compris
 * (plafondAffectation, fourni par l'appelant) ; montant affecté non fourni : admis, signalé (alertes).
 */
function controlerMontantAffecte({ plafondAffectation, montantCentimes }: SaisieVirementInterne): string[] {
  if (!plafondAffectation) return [ALERTE_MONTANT_AFFECTE_NON_FOURNI]
  const { montantAffecteCentimes, dejaEmployeCentimes = 0 } = plafondAffectation
  if (!Number.isInteger(montantAffecteCentimes) || montantAffecteCentimes <= 0 || !Number.isInteger(dejaEmployeCentimes) || dejaEmployeCentimes < 0)
    throw new Error(
      `Montant affecté (${montantAffecteCentimes}) et déjà employé (${dejaEmployeCentimes}) : centimes entiers, strictement positifs pour le montant affecté, positifs ou nuls pour le déjà employé.`,
    )
  if (dejaEmployeCentimes + montantCentimes > montantAffecteCentimes)
    throw new Error(
      `Sortie du fonds de travaux de ${montantCentimes} centimes au-delà du montant affecté par la décision (${montantAffecteCentimes} centimes, dont ${dejaEmployeCentimes} déjà employés) : le virement vers le compte courant n'est admis que pour le seul montant affecté (${F95}).`,
    )
  return []
}

/**
 * Sortie du fonds de travaux : jamais vers un placement qui n'est pas réservé au fonds, jamais depuis un placement réservé
 * au fonds (J71 : il ne revient qu'à un compte du fonds) ; sinon un emploi admis par le contrôle d'affectation, en saisie
 * nouvelle (J30) : forme structurée contrôlée à la date du jour, texte libre refusé.
 */
function controlerSortieDuFonds(
  saisie: SaisieVirementInterne,
  aujourdhui: string | undefined,
): { affectation: ResultatAffectation; emploi: EmploiFondsTravaux; alertes: string[] } {
  if (saisie.destination.nature === 'placement')
    throw new Error(
      `Fonds de travaux vers un compte de placement qui n'est pas réservé au fonds : refusé ; le placement du fonds, sur décision, se fait vers un compte de placement au nom du syndicat réservé au fonds (J71 ; ${FONDEMENT_PLACEMENT} ; ${FONDEMENT_FONDS_SEPARE}).`,
    )
  if (estPlacementDuFonds(saisie.source))
    throw new Error(`Placement du fonds de travaux : il ne revient qu'à un compte du fonds (J71 ; ${FONDEMENT_FONDS_SEPARE}).`)
  const emploi = saisie.emploiFondsTravaux
  if (!emploi)
    throw new Error(
      `Sortie du fonds de travaux : rattacher l'emploi du fonds, avec la décision d'affectation de l'assemblée (${FONDEMENT_AFFECTATION}) ou l'ordonnance du juge (${FONDEMENT_29_14}).`,
    )
  const affectation = controlerAffectationFondsTravaux({ ...emploi, montantCentimes: saisie.montantCentimes }, { aujourdhui, nouvelleSaisie: true })
  if (!affectation.autorise) throw new Error(`Sortie du fonds de travaux refusée : ${affectation.motif} (${affectation.fondement})`)
  const alertes = controlerMontantAffecte(saisie)
  return {
    affectation,
    emploi: { ...emploi, decisionAg: copieDecisionAffectation(emploi.decisionAg), autorisationJuge: copieReference(emploi.autorisationJuge) },
    alertes,
  }
}

function controlerFondsTravaux(
  saisie: SaisieVirementInterne,
  mouvement: MouvementFondsTravaux,
  aujourdhui: string | undefined,
): { affectation: ResultatAffectation | null; emploi: EmploiFondsTravaux | null; alertes: string[] } {
  if (mouvement === 'sortie') return controlerSortieDuFonds(saisie, aujourdhui)
  if (saisie.plafondAffectation) throw new Error(`Montant affecté rattaché à un virement qui ne sort pas du fonds (${mouvement}) : sans objet (${F95}).`)
  if (mouvement === 'alimentation' && estPlacementDuFonds(saisie.destination))
    throw new Error(
      `Placement du fonds de travaux : alimenté seulement depuis un compte du fonds ; les cotisations sont versées sur le compte séparé du fonds (J71 ; ${FONDEMENT_FONDS_SEPARE}).`,
    )
  if (saisie.emploiFondsTravaux)
    throw new Error(`Emploi du fonds de travaux rattaché à un virement qui ne sort pas du fonds (${mouvement}) : vérifier le sens du virement.`)
  return { affectation: null, emploi: null, alertes: [] }
}

function controlerPlacement(saisie: SaisieVirementInterne): string | null {
  const brut = saisie.decisionPlacement?.trim()
  const decision = brut ? brut : null
  if (saisie.destination.nature !== 'placement') {
    if (decision) throw new Error('Décision de placement sans compte de placement en destination : vérifier le compte.')
    return null
  }
  if (!decision)
    throw new Error(
      `Virement vers un compte de placement : rattacher la décision de l'assemblée qui place les fonds (${FONDEMENT_PLACEMENT}), ou l'ordonnance qui en confie le pouvoir à l'administrateur provisoire (${FONDEMENT_POUVOIRS_AP}).`,
    )
  return decision
}

/**
 * Crée un virement interne « Enregistré », non émis, non imputé, sans tiers, à son rang dans un lot de taille donnée.
 * Refuse une saisie invalide (identifiants, libellé, rang ou taille du lot qui n'est pas un entier ≥ 1, rang au-delà de
 * la taille du lot, montant qui n'est pas un nombre entier de centimes > 0, date non ISO), un compte d'un autre
 * syndicat, inactif, de nature inconnue, d'IBAN invalide ou hors 512 du
 * syndicat, deux fois le même compte (identifiant, 512 ou IBAN), un compte repris en destination, la mention « tenait le
 * fonds de travaux » sur un compte non repris ou « réservé au fonds de travaux » sur un compte qui n'est pas un placement,
 * une sortie du fonds de travaux (compte du fonds, compte repris qui le tenait, placement réservé au fonds) sans emploi
 * admis, vers un placement non réservé au fonds ou depuis un placement réservé au fonds (J71), un placement réservé au
 * fonds alimenté hors du fonds, un placement sans décision, un emploi ou une décision de placement sans objet, une
 * décision ou une ordonnance saisie en texte libre (J30 : forme incomplète). `aujourdhui` : la date du jour, exigée pour
 * contrôler une décision ou une ordonnance en forme structurée (J30).
 */
export function creerVirementInterne(
  saisie: SaisieVirementInterne,
  { segmentSyndicat, aujourdhui }: { segmentSyndicat: string; aujourdhui?: string },
): VirementInterne {
  verifierEnTete(saisie)
  verifierCompte(saisie.source, 'source', saisie.coproprieteId, segmentSyndicat)
  verifierCompte(saisie.destination, 'destination', saisie.coproprieteId, segmentSyndicat)
  verifierPaire(saisie.source, saisie.destination)
  const mouvement = mouvementFondsTravaux(saisie.source, saisie.destination)
  const { affectation, emploi, alertes } = controlerFondsTravaux(saisie, mouvement, aujourdhui)
  const decisionPlacement = controlerPlacement(saisie)
  return {
    id: saisie.id,
    numero: saisie.numero.trim(),
    date: saisie.date,
    coproprieteId: saisie.coproprieteId,
    mandatId: saisie.mandatId,
    traitementId: saisie.traitementId,
    rang: saisie.rang,
    nombreOrdresDuLot: saisie.nombreOrdresDuLot,
    source: { ...saisie.source },
    destination: { ...saisie.destination },
    montantCentimes: saisie.montantCentimes,
    libelle: saisie.libelle.trim(),
    type: TYPE_VIREMENT_INTERNE,
    famille: FAMILLE_VIREMENT_INTERNE,
    mouvementFondsTravaux: mouvement,
    emploiFondsTravaux: emploi,
    affectation,
    marque: mouvement === 'sortie' ? 'emploi' : null,
    alertes,
    decisionPlacement,
    statut: 'Enregistré',
    dateEmission: null,
    impute: false,
    rejet: null,
  }
}

/** F95 — facture payée depuis le compte courant, rattachée au virement « emploi » qui l'a alimenté. */
export interface RattachementFactureEmploi {
  virementId: string
  reglementId: string
  factureId: string
  montantCentimes: number
}

/**
 * Rattache au virement « emploi » (sortie du fonds vers le compte courant) la facture payée ensuite (décision du
 * 20/11/2026, partie C, F95) : règlement du même syndicat (D1), non annulé, d'une facture, payé depuis le compte qui a
 * reçu le virement, dans la limite du virement, rattachements déjà faits compris (dejaRattacheCentimes, fournis par
 * l'appelant). Refus : virement qui n'est pas un « emploi », ou rejeté par la banque (J68 : l'emploi n'a pas eu lieu).
 */
export function rattacherReglementAuVirementEmploi(
  virement: VirementInterne,
  reglement: Pick<ReglementFournisseur, 'id' | 'coproprieteId' | 'banqueId' | 'factureId' | 'statut' | 'montantCentimes'>,
  { dejaRattacheCentimes = 0 }: { dejaRattacheCentimes?: number } = {},
): RattachementFactureEmploi {
  const nom = `Règlement ${reglement.id}`
  if (virement.marque !== 'emploi' || virement.rejet)
    throw new Error(`Virement ${virement.numero} : pas un virement « emploi » du fonds de travaux en vigueur (sortie du fonds, non rejetée) ; ${nom} ne s'y rattache pas.`)
  if (reglement.coproprieteId !== virement.coproprieteId) throw new Error(`${nom} d'un autre syndicat que le virement ${virement.numero} (D1).`)
  if (reglement.statut === 'Annulé') throw new Error(`${nom} annulé : rien à rattacher au virement ${virement.numero}.`)
  if (!reglement.factureId) throw new Error(`${nom} sans facture : seule la facture payée se rattache au virement « emploi » (${F95}).`)
  if (reglement.banqueId !== virement.destination.banqueId)
    throw new Error(`${nom} payé depuis le compte ${reglement.banqueId}, pas depuis le compte qui a reçu le virement « emploi » ${virement.numero} (${virement.destination.banqueId}).`)
  if (!Number.isInteger(dejaRattacheCentimes) || dejaRattacheCentimes < 0)
    throw new Error(`Déjà rattaché au virement ${virement.numero} invalide (${dejaRattacheCentimes}) : centimes entiers positifs ou nuls attendus.`)
  if (dejaRattacheCentimes + reglement.montantCentimes > virement.montantCentimes)
    throw new Error(
      `${nom} (${reglement.montantCentimes} centimes) au-delà du virement « emploi » ${virement.numero} (${virement.montantCentimes} centimes, dont ${dejaRattacheCentimes} déjà rattachés).`,
    )
  return { virementId: virement.id, reglementId: reglement.id, factureId: reglement.factureId, montantCentimes: reglement.montantCentimes }
}

/** Saisie d'un virement d'un lot créé d'un coup : sa place (traitement, rang, taille du lot) est attribuée. */
export type SaisieVirementDuLot = Omit<SaisieVirementInterne, 'traitementId' | 'rang' | 'nombreOrdresDuLot'>

/** Composition d'un lot : au moins un virement, un traitement, un seul syndicat (D1), chaque virement une fois. */
function verifierCompositionDuLot(elements: readonly { id: string; coproprieteId: string }[], traitementId: string): void {
  if (elements.length === 0) throw new Error('Lot de virements internes : aucun virement.')
  texteRequis(traitementId, MESSAGE_SANS_TRAITEMENT)
  if (new Set(elements.map((e) => e.coproprieteId)).size > 1) throw new Error('Lot refusé : virements de plusieurs syndicats (D1).')
  const vus = new Set<string>()
  for (const e of elements) {
    if (vus.has(e.id)) throw new Error(`Virement ${e.id} en double dans le lot.`)
    vus.add(e.id)
  }
}

/**
 * Crée d'un coup les virements d'un lot, sous un même traitement : rang = position dans la saisie (1 à n), taille du lot
 * = n ; chaque virement est contrôlé par creerVirementInterne (avec `aujourdhui` pour une forme structurée, J30).
 * Refuse un lot vide, un traitement absent, un virement en double et des virements de plusieurs syndicats (D1).
 */
export function creerLotVirementsInternes(
  saisies: SaisieVirementDuLot[],
  { traitementId, segmentSyndicat, aujourdhui }: { traitementId: string; segmentSyndicat: string; aujourdhui?: string },
): VirementInterne[] {
  verifierCompositionDuLot(saisies, traitementId)
  return saisies.map((s, i) =>
    creerVirementInterne({ ...s, traitementId, rang: i + 1, nombreOrdresDuLot: saisies.length }, { segmentSyndicat, aujourdhui }),
  )
}

/**
 * Recompose un lot avant son émission : rang = position dans la liste passée (1 à n), taille du lot = n, sous le
 * traitement donné ; le reste de chaque virement est inchangé. Retire un virement abandonné (ne pas le passer), refait
 * des rangs saisis deux fois ou change de traitement (identifiant déjà au journal ou réservé par un autre lot émis).
 * Refuse un lot vide, un traitement absent, un virement en double, des virements de plusieurs syndicats (D1) et un
 * virement déjà émis : un lot envoyé à la banque ne se recompose plus.
 */
export function recomposerLotVirementsInternes(virements: VirementInterne[], { traitementId }: { traitementId: string }): VirementInterne[] {
  verifierCompositionDuLot(virements, traitementId)
  const dejaEmis = virements.find((v) => v.statut === 'Émis')
  if (dejaEmis)
    throw new Error(
      `Virement ${dejaEmis.numero} déjà émis le ${dejaEmis.dateEmission} (traitement ${dejaEmis.traitementId}) : un lot envoyé à la banque ne se recompose plus.`,
    )
  return virements.map((v, i): VirementInterne => ({ ...v, traitementId, rang: i + 1, nombreOrdresDuLot: virements.length }))
}

// ─── Émission, écriture et imputation ───────────────────────────────────────────────────────

/** Traitements déjà passés au journal, quelle que soit leur famille. */
type Journal = readonly Pick<Traitement, 'id'>[]

/** Ce que l'émission lit des virements internes déjà enregistrés : un virement émis réserve son traitement. */
export type VirementConnu = Pick<VirementInterne, 'id' | 'numero' | 'traitementId' | 'statut'>

/** Écriture d'un virement : débit du 512 de destination, crédit du 512 de source, montant brut (aucune compensation). */
export function mouvementsVirementInterne(v: VirementInterne): LigneMouvement[] {
  return [
    { compte: v.destination.compte512, sens: 'debit', montantCentimes: v.montantCentimes },
    { compte: v.source.compte512, sens: 'credit', montantCentimes: v.montantCentimes },
  ]
}

function verifierAEcrire(v: VirementInterne, id: string): void {
  if (v.statut !== 'Émis') throw new Error(`Virement ${v.numero} pas émis : aucune écriture avant l'ordre donné à la banque.`)
  if (v.impute) throw new Error(`Virement ${v.numero} déjà imputé : son écriture est dans le traitement ${v.traitementId}.`)
  if (v.traitementId !== id) throw new Error(`Virement ${v.numero} : traitement ${v.traitementId}, pas ${id}.`)
}

/**
 * Lot complet : tous les virements déclarent la même taille de lot, en nombre égal aux virements passés, aux rangs 1 à
 * cette taille, chacun une fois (controlerRangsDuLot).
 */
function verifierLotComplet(virements: VirementInterne[], id: string): void {
  const tailles = new Set(virements.map((v) => v.nombreOrdresDuLot))
  if (tailles.size > 1)
    throw new Error(`Traitement ${id} refusé : virements qui déclarent des lots de tailles différentes (${[...tailles].join(', ')}) ; vérifier la saisie.`)
  const [taille] = tailles
  if (virements.length !== taille)
    throw new Error(
      `Traitement ${id} refusé : le lot compte ${taille} virement(s), ${virements.length} passé(s) ; passer tous les virements du lot, en une fois.`,
    )
  const anomalies = controlerRangsDuLot(ordresDuLotVirementsInternes(virements))
  if (anomalies.length > 0)
    throw new Error(`Traitement ${id} refusé : ${anomalies.map((a) => a.message).join(' ')} Passer tous les virements du lot.`)
}

/**
 * Contrôles communs à l'émission et à l'écriture d'un lot : composition (verifierCompositionDuLot), traitement absent du
 * journal, contrôle propre à chaque virement (verifierUn), lot complet (verifierLotComplet).
 */
function verifierLotEntier(virements: VirementInterne[], id: string, journal: Journal, verifierUn: (v: VirementInterne) => void): void {
  verifierCompositionDuLot(virements, id)
  if (journal.some((t) => t.id === id))
    throw new Error(`Traitement ${id} déjà passé au journal : un lot s'écrit une seule fois, sous un identifiant de traitement neuf.`)
  for (const v of virements) verifierUn(v)
  verifierLotComplet(virements, id)
}

/** Traitement libre : réservé par aucun virement émis d'un autre lot ; un virement du lot déjà émis ne l'est pas deux fois. */
function verifierTraitementLibre(virements: VirementInterne[], id: string, connus: readonly VirementConnu[]): void {
  const duLot = new Set(virements.map((v) => v.id))
  for (const c of connus.filter((connu) => connu.statut === 'Émis')) {
    if (duLot.has(c.id)) throw new Error(`Virement ${c.numero} déjà émis (traitement ${c.traitementId}) : un virement s'émet une seule fois.`)
    if (c.traitementId === id)
      throw new Error(
        `Traitement ${id} déjà réservé par le virement ${c.numero}, émis dans un autre lot : recomposer ce lot sous un traitement neuf (recomposerLotVirementsInternes).`,
      )
  }
}

/**
 * Émission d'un lot de virements internes (l'ordre donné à la banque : fichiers et ordres hors fichier) : le lot entier,
 * en une fois, à une date ISO ; renvoie les virements émis. Le lot est contrôlé AVANT l'envoi comme il le sera à
 * l'écriture (traitementVirementsInternes), et son traitement doit être libre : un lot émis s'écrit donc toujours.
 * journal : les traitements déjà passés ; virementsConnus : les virements internes déjà enregistrés (le lot lui-même
 * peut y figurer, non émis). Refuse un lot vide, un virement en double, déjà émis, d'un autre traitement ou d'un autre
 * syndicat (D1), une date non ISO, des tailles de lot différentes, un nombre de virements autre que la taille du lot, des
 * rangs qui ne sont pas exactement 1 à cette taille, un traitement déjà au journal ou réservé par un virement émis d'un
 * autre lot. Un lot refusé se corrige avant l'émission par recomposerLotVirementsInternes ; un virement seul est un lot
 * de un.
 */
export function emettreLotVirementsInternes(
  virements: VirementInterne[],
  { dateEmission, journal, virementsConnus }: { dateEmission: string; journal: Journal; virementsConnus: readonly VirementConnu[] },
): VirementInterne[] {
  const id = virements[0]?.traitementId ?? ''
  verifierLotEntier(virements, id, journal, (v) => {
    verifierEmission(v, dateEmission)
    if (v.traitementId !== id)
      throw new Error(`Lot refusé : virements de plusieurs traitements (${id}, ${v.traitementId}) ; un lot est un seul traitement.`)
  })
  verifierTraitementLibre(virements, id, virementsConnus)
  return virements.map((v): VirementInterne => ({ ...v, statut: 'Émis', dateEmission }))
}

/**
 * Écriture et imputation, en une fois, d'un lot de virements internes émis d'un même syndicat : un traitement
 * « Règlement de banque à banque » dont chaque virement porte sa propre paire débit / crédit, pour son montant brut ; les
 * virements sont rendus imputés. Refait les contrôles de l'émission sur les virements passés (relus, ils peuvent n'être
 * pas passés par emettreLotVirementsInternes) : refuse un lot vide, un identifiant de traitement déjà au journal, un
 * virement en double, non émis, déjà imputé, rattaché à un autre traitement, des virements de plusieurs syndicats (D1),
 * des tailles de lot différentes, un nombre de virements autre que la taille du lot, et des rangs qui ne sont pas
 * exactement 1 à cette taille (controlerRangsDuLot). Un lot ne s'écrit donc ni en partie ni en deux fois.
 */
export function traitementVirementsInternes(
  virements: VirementInterne[],
  { id, date, journal }: { id: string; date: string; journal: Journal },
): { traitement: Traitement; virements: VirementInterne[] } {
  verifierLotEntier(virements, id, journal, (v) => verifierAEcrire(v, id))
  const traitement = creerTraitement({ id, famille: FAMILLE_VIREMENT_INTERNE, date, mouvements: virements.flatMap(mouvementsVirementInterne) })
  return { traitement, virements: virements.map((v): VirementInterne => ({ ...v, impute: true })) }
}

// ─── Virement rejeté par la banque (J68) ────────────────────────────────────────────────────

/** Le virement se rejette : émis, rejet daté au plus tôt de l'émission, jamais rejeté, déjà écrit dans son lot. */
function verifierARejeter(v: VirementInterne, rejet: { id: string; date: string; motif: string }, ecritureLot: Traitement): void {
  if (v.statut !== 'Émis')
    throw new Error(`Virement ${v.numero} pas émis : le retirer du lot avant l'émission (recomposerLotVirementsInternes), sans écriture contraire.`)
  if (!estDateIsoValide(rejet.date)) throw new Error(`Date du rejet invalide (${rejet.date}) : AAAA-MM-JJ attendu.`)
  if (v.dateEmission !== null && rejet.date < v.dateEmission)
    throw new Error(`Rejet du ${rejet.date} antérieur à l'émission du virement ${v.numero} (${v.dateEmission}).`)
  if (v.rejet)
    throw new Error(`Virement ${v.numero} déjà rejeté le ${v.rejet.le} (${v.rejet.motif}) : son écriture contraire est le traitement ${v.rejet.traitementId}.`)
  if (!v.impute)
    throw new Error(`Virement ${v.numero} : écrire d'abord le lot (traitementVirementsInternes, traitement ${v.traitementId}) ; le rejet en passe ensuite l'écriture contraire.`)
  if (ecritureLot.id !== v.traitementId)
    throw new Error(`Rejet du virement ${v.numero} : écriture ${ecritureLot.id} fournie, alors que son lot est écrit dans le traitement ${v.traitementId}.`)
}

/**
 * J68 — virement d'un lot émis et écrit, rejeté par la banque : le lot reste entier ; la seule ligne rejetée reçoit une
 * écriture contraire (débit du 512 source, crédit du 512 de destination), sous son propre identifiant, famille
 * « Annulation de règlements », qui renvoie (annule) au traitement du lot, datée du retour, ou du jour de l'écriture du
 * lot si le retour le précède (arrêté du 14 mars 2005, art. 5 : l'écriture contraire annule une écriture passée). Le
 * virement reste émis, imputé, à son rang, et porte son rejet (date réelle, motif, traitement). Une sortie du fonds
 * rejetée y revient : son emploi n'a pas eu lieu. Refuse un virement non émis (à retirer du lot avant l'émission), pas
 * encore écrit ou déjà rejeté, un rejet antérieur à l'émission, sans motif, sous l'identifiant du lot ou à une date non
 * ISO, une écriture qui n'est pas celle du lot ou ne porte pas la ligne.
 */
export function rejeterVirementInterne(
  virement: VirementInterne,
  rejet: { id: string; date: string; motif: string },
  ecritureLot: Traitement,
): { traitement: Traitement; virement: VirementInterne } {
  texteRequis(rejet.id, 'Rejet de virement interne : identifiant du traitement de l’écriture contraire attendu.')
  if (rejet.id === virement.traitementId)
    throw new Error(`Rejet de virement interne : l'écriture contraire a son propre identifiant, distinct de celui du lot (${rejet.id}).`)
  texteRequis(rejet.motif, 'Rejet de virement interne : motif du rejet attendu (motif donné par la banque).')
  verifierARejeter(virement, rejet, ecritureLot)
  const ligne = mouvementsVirementInterne(virement)
  const absente = ligne.find(
    (attendu) => !ecritureLot.mouvements.some((m) => m.compte === attendu.compte && m.sens === attendu.sens && m.montantCentimes === attendu.montantCentimes),
  )
  if (absente)
    throw new Error(
      `Écriture ${ecritureLot.id} du lot : mouvement ${absente.sens} ${absente.compte} de ${absente.montantCentimes} centimes introuvable ; l'écriture contraire ne contre-passe que ce qui a été écrit.`,
    )
  const traitement = creerTraitement({
    id: rejet.id,
    famille: FAMILLE_REJET_VIREMENT_INTERNE,
    date: rejet.date < ecritureLot.date ? ecritureLot.date : rejet.date,
    annule: ecritureLot.id,
    mouvements: ligne.map((m): LigneMouvement => ({ ...m, sens: m.sens === 'debit' ? 'credit' : 'debit' })),
  })
  return { traitement, virement: { ...virement, rejet: { le: rejet.date, motif: rejet.motif.trim(), traitementId: rejet.id } } }
}

// ─── Lot et fichier ─────────────────────────────────────────────────────────────────────────

/**
 * Ordres du lot (types-ordres-banque.ts) : rang = celui de chaque virement (jamais sa position dans la liste passée),
 * compte = la source, sans tiers, une pièce ; statut et état imputé sont ceux du virement.
 */
export function ordresDuLotVirementsInternes(virements: VirementInterne[]): OrdreDuLot[] {
  return virements.map((v) => ({
    id: v.id,
    sourceId: v.id,
    numero: v.numero,
    traitementId: v.traitementId,
    rang: v.rang,
    type: TYPE_VIREMENT_INTERNE,
    date: v.date,
    coproprieteId: v.coproprieteId,
    banqueId: v.source.banqueId,
    tiers: null,
    libelle: v.libelle,
    numeroPiece: v.numero,
    nombrePieces: 1,
    montantCentimes: v.montantCentimes,
    statut: v.statut,
    dateEmission: v.dateEmission,
    impute: v.impute,
  }))
}

/**
 * Fichier pain.001.001.03 d'un virement interne (genererPain001) : débiteur = le syndicat sur le compte source,
 * créancier = le syndicat sur le compte de destination, identifiant de bout en bout = n° du virement. Refuse un compte
 * source sans IBAN ou sans BIC, une destination sans IBAN (Caisse des dépôts, sous-compte centralisateur : virement à
 * ordonner hors fichier). Décision du 20/11/2026 (partie C, F103) : sans fiche « validation banque » du compte source
 * (validationBanque), le fichier porte la mention « non validé par la banque ».
 */
export function fichierVirementInterne(
  v: VirementInterne,
  {
    nomSyndicat,
    messageId,
    dateCreation,
    dateExecution,
    validationBanque = null,
  }: { nomSyndicat: string; messageId: string; dateCreation: string; dateExecution: string; validationBanque?: FicheValidationBanque | null },
): string {
  texteRequis(nomSyndicat, 'Nom du syndicat attendu (débiteur et créancier du virement).')
  const { source, destination } = v
  if (source.iban === null || source.bic === null)
    throw new Error(`Compte source ${source.banqueId} sans IBAN ou BIC : virement à ordonner hors fichier.`)
  if (destination.iban === null) throw new Error(`Compte destination ${destination.banqueId} sans IBAN : virement à ordonner hors fichier.`)
  const ordre = creerOrdreVirement({
    id: v.id,
    numero: v.numero,
    date: v.date,
    coproprieteId: v.coproprieteId,
    banqueId: source.banqueId,
    traitementId: v.traitementId,
    lignes: [
      { reglementId: v.numero, beneficiaire: nomSyndicat, iban: destination.iban, bic: destination.bic, montantCentimes: v.montantCentimes, libelle: v.libelle },
    ],
  })
  return genererPain001(ordre, { nom: nomSyndicat, iban: source.iban, bic: source.bic }, { messageId, dateCreation, dateExecution, validationBanque })
}
