import { ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  controlerAffectationFondsTravaux,
  type DecaissementFondsTravaux,
  type ObjetDecaissementFondsTravaux,
  type ResultatAffectation,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import type { EmploiFondsEcheance } from '@/lib/administrateur-judiciaire/domain/avis-appel'
import type { EcheanceAppelSuivie, StatutEcheanceAppel } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { estAuCentieme, retenueAuTaux, TAUX_MAXIMAL_RETENUE_GARANTIE_PCT } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import type { CompteCoproprietaire } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import type { PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { MAJORITES_AG, type TypeMajorite } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import { formaterNumeroCompte, genererSegmentAuxiliaire } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import type { ReglementFournisseur, StatutReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import {
  codeContrepartie,
  traitementAppelDeFonds,
  type AvisAppels,
  type EcheanceAppel,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import type { Resolution } from '@/lib/administrateur-judiciaire/domain/resolutions-ag'
import { creerTraitement, type LigneMouvement, type Mouvement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { STATUT_TRAVAUX, TYPE_TRAVAUX, type StatutTravaux, type TypeTravaux } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Opération de travaux d'un syndicat : statut, type, clés, décision et majorité, appels en tranches, série de comptes,
 * règlements (cartographie Gestéam, tranches 19, 24, 32 et 43 ; points 17 et 30 du bilan). Fonctions pures, montants en
 * CENTIMES ENTIERS, dates ISO, sans écran ni table : le stockage dans la table Travaux (db/schema.ts, coquille) et
 * l'écran restent à Frédéric.
 *
 * Gestéam — 🟢 lu :
 * - tranche 32, fiche : n° d'opération (repris dans comptes et analytique), bouton de statut (ex. « Adopté »), Type,
 *   Nature ; clé de répartition en grille (une ou plusieurs clés) ; Décision le … par (Assemblée), Résolution, Budget
 *   TTC ; grille des appels Dates d'appel · Libellé « Appel n° 1 » · Taux % · Montant · Statut (ex. « Appelé ») ; onglet
 *   Budget : fonds de travaux (« Ne pas utiliser les fonds travaux »), garantie par marché, règlements (Objet · Montant ·
 *   Statut), pied Réglé · Dû ; liste ouverte sur le statut « En cours », qui montre Adopté · À clôturer · Proj. ;
 * - tranche 19 § 4 : STATUT_TRAVAUX (9 valeurs, dans l'ordre Projet · Adopté · Commandé · Commencé · Terminé ·
 *   À clôturer · Réparti · En cours · Rejeté) et TYPE_TRAVAUX (42 valeurs), referentiels-gesteam-judiciaire.ts ;
 * - tranche 43 § 18 : décision (date, Assemblée, statut « Adoptée »), notes « PV AG <date> résolution <n> » ;
 * - tranche 43 § 11 : chaque opération a sa série de comptes, même n° de série dans 102xx, 120xx, 671xx, 702xx ; le
 *   libellé du compte reprend l'objet de l'opération ; § 21 : 71147 « Travaux - Subventions », « N° de compte = No des
 *   travaux » ; tranche 24 § 3 : 10200 (type « Travaux - Appels »), 67100 (« Travaux - Dépenses »), 70200 (« Travaux -
 *   Provisions »), tous à la règle « No des travaux ».
 *
 * Le droit — 🟢 lu sur Légifrance le 03/11/2026 (versions en vigueur à cette date) :
 * - L. 1965 art. 14-1, II : les dépenses pour travaux hors budget « sont exigibles selon les modalités votées par
 *   l'assemblée générale » ; D. 1967 art. 44 (dépenses hors budget : conservation ou entretien autres que la
 *   maintenance, éléments d'équipement communs, amélioration, études techniques) et art. 45 (maintenance) ; art. 35 :
 *   « Le syndic peut exiger le versement » (3° : des provisions de ces dépenses) ; art. 37, par dérogation à l'art. 35 :
 *   en cas d'urgence, une provision d'au plus le tiers du devis estimatif, sans délibération préalable de l'assemblée,
 *   après avis du conseil syndical s'il en existe un (travaux urgents de sauvegarde, L. 1965 art. 18, I : hors de ce
 *   module, 🔴 ci-dessous) ;
 * - majorités : art. 24, II, a (travaux de conservation, santé et sécurité des occupants) ; art. 25, f (économies
 *   d'énergie) et n (« L'ensemble des travaux comportant transformation, addition ou amélioration ») ; art. 30
 *   (amélioration, majorité de l'art. 25) ; art. 35 (surélévation, majorité de l'art. 26) ; art. 25-1, al. 1 : sous
 *   l'art. 25, au moins le tiers des voix → second vote immédiat à la majorité de l'art. 24 ; art. 26-1 : second vote
 *   immédiat à la majorité des voix de tous les copropriétaires (art. 25) ;
 * - art. 29-1, I, al. 2 : l'administrateur provisoire reçoit « tout ou partie des pouvoirs de l'assemblée générale des
 *   copropriétaires, à l'exception de ceux prévus aux a et b de l'article 26 » ; D. 1967 art. 62-8 : ses décisions sont
 *   mentionnées, à leur date, sur le registre des décisions ;
 * - art. 14-2-1, I, al. 7 : l'assemblée affecte le fonds de travaux « par un vote à la même majorité que celle
 *   applicable aux dépenses concernées », en tenant compte « de l'existence de parties communes spéciales ou de clefs de
 *   répartition des charges » ;
 * - D. 1967 art. 11, I, 3° et 7° : conditions essentielles du contrat, devis ou marché de travaux et projet de résolution
 *   notifiés avec l'ordre du jour (non contrôlés ici : convocation, votes-ag.ts) ;
 * - arrêté du 14 mars 2005, art. 7 (nomenclature, version en vigueur depuis le 31/12/2020) : 102 « Provisions pour
 *   travaux décidés » ; 12 « Solde en attente sur travaux et opérations exceptionnelles » (12-1 « Travaux décidés par
 *   l'assemblée générale ») ; 671 « Travaux décidés par l'assemblée générale » ; 702 « Provisions sur travaux du I de
 *   l'article 14-2 et opérations exceptionnelles » ; 711 « Subventions ». Ni 120 ni 7114x : art. 8, le syndicat « peut
 *   ouvrir toute subdivision nécessaire » (🔵 12000 et 71147 de Gestéam sont des subdivisions de 12 et de 711) ;
 * - arrêté, art. 10 : 102 « crédité des provisions appelées par le débit du compte 450 », « débité par le crédit du
 *   compte 702 [...] au fur et à mesure de la réalisation des travaux » ; 12 « reçoit le solde des opérations sur travaux
 *   [...] qui ne peuvent pas être clôturées en fin d'exercice » ; art. 5 : « Une écriture erronée est annulée par une
 *   écriture contraire » (cité par echeancier-appels.ts) ;
 * - D. 2005-240 art. 4 : charges des travaux comptabilisées « au fur et à mesure de la réalisation des travaux » (sur
 *   plusieurs exercices, à l'exercice de réalisation) ; produits « à constater au titre de l'exercice de leur
 *   exigibilité » ; art. 8 : pour les travaux, la répartition « ne peut intervenir qu'à la clôture définitive de chacune
 *   des opérations concernées ».
 *
 * Règles :
 * - statut de l'opération typé sur STATUT_TRAVAUX, distinct du statut de chaque tranche (statutsDesTranches, typé sur
 *   les statuts d'échéance d'echeancier-appels.ts) ; type typé sur TYPE_TRAVAUX ;
 * - « Adopté » exige la décision (date, résolution) : tout statut du cycle à partir d'« Adopté » la porte, « Projet » et
 *   « Rejeté » jamais ; l'adoption s'enregistre avec sa décision, à sa date (adopterOperationTravaux, ou la création) ;
 * - la création trace son statut comme un changement : l'adoption à la date de la décision ; un statut saisi au-delà
 *   d'« Adopté » (reprise d'une opération engagée) ou « Rejeté » porte sa date et son motif (changementStatut), aux
 *   règles des transitions (J2 : un saut d'étape se motive et reste tracé, à la reprise aussi) ;
 * - « Réparti » suit la répartition : posé par le traitement « Répartition de charges » qui mouvemente l'opération au
 *   segment de son syndicat (D1), daté au plus tôt de la décision, depuis « A clôturer » seulement (D. 2005-240 art. 8),
 *   une seule fois par traitement, retiré par son annulation, datée au plus tôt de la répartition qu'elle contre-passe ;
 * - un statut ne recule pas ; un saut d'étape est admis avec un motif et tracé ; l'erreur se corrige par une annulation
 *   tracée, jamais en effaçant l'historique ; chaque annulation remonte d'un changement en vigueur, l'adoption exclue
 *   (🔵 par analogie avec J2, statuts d'AG) ;
 * - dates des changements, lues sur les changements en vigueur (🔵, J2 : « Une donnée fausse vaut moins qu'une donnée
 *   incomplète et signalée ») : un changement suit le dernier en vigueur ; une annulation est datée de la correction, au
 *   plus tôt à la date du statut qu'elle rétablit, même avant la date, peut-être erronée, du changement qu'elle annule ;
 *   un changement annulé ne borne plus aucune date, ni son annulation : la date vraie, même antérieure à la date erronée,
 *   se saisit après l'annulation (statut, adoption après un rejet annulé, répartition) ; l'historique garde l'ordre de
 *   saisie, qui n'est alors plus celui des dates ; sauf l'annulation d'une répartition : écriture contraire, elle ne
 *   précède pas la répartition qu'elle contre-passe (arrêté, art. 5 ; comme J9, reglements-fournisseurs.ts) ;
 * - majorité de la décision : majorité requise de la résolution (Gestéam tranche 31, « Majorité : Art. … ») et, le cas
 *   échéant, celle du second vote immédiat qui l'a adoptée ; sans objet pour une décision de l'administrateur provisoire ;
 * - pas d'appel de travaux sans décision ; montant à appeler = budget TTC − part du fonds de travaux ; tranches en % de ce
 *   montant, au centime près, la dernière absorbant l'arrondi quand elles font 100 % ;
 * - opération sur plusieurs clés : budget et part du fonds par clé (sommes égales à ceux de l'opération) ; chaque
 *   tranche donne une échéance par clé, sur le montant à appeler de la clé ;
 * - part du fonds de travaux (J4, fonds-travaux.ts) : affectation exigée dès qu'elle est positive ; objet exclu refusé
 *   dès la création ; l'appel exige la décision qui affecte le fonds (ou, art. 29-14, 2°, l'ordonnance du juge) ; une
 *   affectation votée à part l'est à la même majorité que les travaux (art. 14-2-1, I, al. 7) ; « Ne pas utiliser les
 *   fonds travaux » (point 31) refuse toute part du fonds ; affectationFondsDeLOperation (point 31) rend l'affectation
 *   sans montant, pour le contrôle de chaque emploi du fonds (travaux-budget.ts) ;
 * - série de comptes générée à la création : 10200, 12000, 67100, 70200, 71147, auxiliaire = n° d'opération (règle
 *   « No des travaux ») ; les appels sont crédités sur l'auxiliaire de l'opération (traitementAppelDeFondsTravaux, qui
 *   retrouve l'opération par l'identifiant de l'échéance ; les échéances elles-mêmes restent celles d'avant le point 30),
 *   les règlements fournisseurs s'y rattachent par leur n° d'opération (reglementsDeLOperation) ; les factures le sont
 *   déjà (facture-ventilee.ts) ; l'encaissé de chaque tranche vient des postes de dette nés de ses échéances
 *   (statutsDesTranches) ;
 * - historique des statuts prêt pour la table des changements de statut (changementsStatutAHistoriser), comme l'AG (J2) ;
 * - retenue de garantie : 5 % au plus (loi n° 71-584 du 16 juillet 1971, art. 1er), libérée à l'expiration du délai
 *   d'une année à compter de la réception sauf opposition motivée notifiée par lettre recommandée (art. 2, lu sur
 *   Légifrance le 04/11/2026, point 32) ; marchés, consignation, libération, échéance du suivi « à faire » et part
 *   déductible : travaux-retenue-garantie.ts ; retenueGarantie, ici, reste le calcul simple d'un règlement (taux fini à
 *   deux décimales au plus, arrondi entier borné au plafond de 5 % : retenueAuTaux, facture-ventilee.ts).
 * Point 17 du bilan 2 — plafond d'emploi du fonds par tranche (Gestéam, tranche 30 : « Montant € maximum d'emploi des
 * fonds travaux » de l'échéance) : la part du fonds répartie comme les appels (emploisFondsTravauxDesTranches), entrée
 * de l'avis d'appel (avis-appel.ts).
 *
 * 🔵 Déduit :
 * - « En cours » n'est pas un statut d'opération mais un regroupement de la recherche (la liste « En cours » montre
 *   Adopté, À clôturer, Proj.) : refusé comme statut ; estOperationEnCours le reproduit (cycle sans « Réparti », ni
 *   « Rejeté ») ;
 * - statut par défaut : « Adopté » avec une décision, « Projet » sans ; « Rejeté » depuis « Projet » seulement, avec son
 *   motif ; « Réparti » et « Rejeté » sont définitifs, sans changement en avant : « Réparti » ne se quitte que par
 *   l'annulation de sa répartition (annulerRepartitionOperation), « Rejeté » que par l'annulation tracée du rejet
 *   (annulerDernierChangementStatut) ;
 * - ventilation d'un appel entre plusieurs clés : au prorata du montant à appeler de chaque clé (budget de la clé − part
 *   du fonds de travaux de la clé), une seule grille d'appels dans Gestéam ; identifiant « <n°>-T<tranche> » avec une
 *   seule clé (inchangé), « <n°>-T<tranche>-C<rang de la clé> » avec plusieurs ;
 * - référence de la décision qui affecte le fonds, à défaut d'une décision distincte : « <résolution> (AG du <date>) »
 *   pour l'assemblée, « <référence au registre> (décision de l'administrateur provisoire du <date>) » pour
 *   l'administrateur provisoire (D. 1967 art. 62-8 : registre des décisions, sans assemblée) ;
 * - statut d'une tranche : celui de ses échéances (« Prévu » sans suivi, défaut d'echeancier-appels.ts) ; null quand les
 *   clés divergent ;
 * - compte crédité par l'appel : 70200 (défaut de repartition-appels.ts), sur l'auxiliaire de l'opération ; règlement
 *   « réglé » : enregistré ou rapproché ; « en cours » : demandé ou à régler ; annulé ou rejeté : exclu ;
 * - « Encaissements effectués » d'une tranche : réglé des postes de dette dont l'échéance d'origine est une échéance de
 *   la tranche ; les postes fournis sont ceux du syndicat de l'opération (D1) ;
 * - historique : l'annulation et le traitement de répartition, sans colonne dans la table ChangementStatut, sont repris
 *   dans le motif.
 * 🔴 Non établi (questions pour Frédéric ou Hugo) :
 * - « L'appel de travaux crédite-t-il le 102 de l'opération (arrêté, art. 10 ; type Gestéam "Travaux - Appels" du
 *   10200), viré au 702 au fur et à mesure de la réalisation, ou directement le 702 (D. 2005-240 art. 4 : produits
 *   constatés à l'exigibilité ; défaut VitFix 70200) ? » (VitFix : 70200, inchangé) ;
 * - « Le solde en attente d'une opération va-t-il au 12000 (série "120xx" de Gestéam) ou à la subdivision 12-1 "Travaux
 *   décidés par l'assemblée générale" ? » (VitFix : 12000) ; « Le 71147 de l'opération s'ouvre-t-il à sa création ou à
 *   la première subvention notifiée ? » (VitFix : à la création) ;
 * - « Un appel d'une opération sur plusieurs clés se ventile-t-il au prorata du montant à appeler de chaque clé (budget
 *   de la clé − part du fonds de travaux de la clé) ? » (VitFix : oui) ; « La part du fonds de travaux par clé doit-elle
 *   être rapprochée des cotisations versées sur cette clé (fonds-travaux-lots.ts) ? » (VitFix : part par clé saisie, non
 *   rapprochée) ;
 * - « La décision de l'administrateur provisoire investi des pouvoirs de l'assemblée (art. 29-1, I, al. 2) tient-elle
 *   lieu de la décision d'affectation du fonds de travaux par l'assemblée (art. 14-2-1, I, al. 7) ? » (VitFix : oui,
 *   comme la résolution des travaux) ;
 * - « Une opération reprise d'un précédent syndic, déjà répartie, se crée-t-elle "Réparti" sans le traitement de
 *   répartition ? » (VitFix : non, création à "Réparti" refusée) ; « Une adoption saisie par erreur s'annule-t-elle ? »
 *   (VitFix : non, ni la décision ni le retour à "Projet") ;
 * - « Une opération adoptée dont la résolution est annulée par jugement ou abandonnée par une nouvelle assemblée
 *   passe-t-elle à "Rejeté", et depuis quels statuts ? » (VitFix : aucune transition, « Rejeté » depuis « Projet »
 *   seulement ; l'opération garde son statut, ses échéances se suspendent ou s'annulent dans echeancier-appels.ts :
 *   mettreEnAttente, annulerAvantAppel, annulerAppelees ; contestation des décisions : L. 1965 art. 42, al. 2) ;
 * - « Les travaux urgents (L. 1965 art. 18, I ; D. 1967 art. 37 ; compte 672 "Travaux urgents" ; Gestéam "Appel travaux
 *   urgents" et "Travaux urgents - Provisions") forment-ils une filière distincte de l'opération décidée ? » (VitFix :
 *   oui, hors de ce module, qui n'admet ni statut décidé ni appel sans décision ; provision au tiers du devis non codée,
 *   demandes.ts) ;
 * - « Les opérations d'études, de diagnostic ou d'expertise gardent-elles le 671xx de Gestéam ou passent-elles au 673
 *   "Etudes techniques, diagnostic, consultation" (arrêté, art. 7 et 8) ? » (VitFix : 67100 dans la série de toute
 *   opération, comme Gestéam tranche 43 § 11 ; la facture garde son compte de charge par ligne, facture-ventilee.ts) ;
 * - « La majorité requise se contrôle-t-elle selon la nature des travaux ? » (VitFix : non ; un même TYPE_TRAVAUX, par
 *   exemple "Ascenseur", relève de l'art. 24, II, a ou de l'art. 25, n selon l'objet) ; « Faut-il vérifier que
 *   l'ordonnance confie à l'administrateur provisoire le pouvoir de décider ces travaux ? » (VitFix : non vérifié) ;
 * - « Le virement 102 → 702 et le passage au 12 en fin d'exercice sont-ils à produire ici ? » (VitFix : non) ;
 * - « Quel statut donner à une tranche dont les clés n'ont pas le même statut d'échéance ? » (VitFix : null) ;
 * - « Que portent le bouton "À voter" et le champ "Approbation" du bloc Décision de la fiche ? » (non repris).
 * Branchements à faire hors de ce module (fichiers non modifiés) : repartition-appels.ts — un champ
 * `auxiliaireContrepartie` de l'échéance, lu par traitementAppelDeFonds, rendrait traitementAppelDeFondsTravaux inutile ;
 * suivi-a-faire.ts, depuisOperationsTravaux — identifiants « -C<k> » des opérations sur plusieurs clés
 * (idsEcheancesDeLaTranche) dans la branche « fonds bloqué », et opérations hors « En cours » ignorées
 * (estOperationEnCours) ; fonds-travaux-lots.ts, emploiDepuisOperation — un emploi par clé (cles[k]) au lieu de
 * operation.cleId, et la référence de la décision par referenceDecisionTravaux (son « (AG du …) » vaut aussi pour une
 * décision de l'administrateur provisoire) ; db/schema.ts (Frédéric) — table Travaux : statut, type, cles, décision
 * (origine, majorité, second vote), serieComptes, historiqueStatuts ; EntiteAStatutHistorise complété de 'travaux'
 * (changementsStatutAHistoriser), lignes écrites et relues dans l'ordre de saisie (createdAt), pas par date d'effet
 * comme historiqueTrie des AG (statut-assemblee.ts) : la date vraie d'un changement corrigé peut précéder son annulation.
 */

export interface TrancheAppel {
  date: string
  tauxPct: number
}

/** Ligne de la grille des clés (Gestéam « Clé de répartition », une ou plusieurs clés). */
export interface CleOperationTravaux {
  cleId: string
  budgetTtcCentimes: number
  /**
   * Part du fonds de travaux portée par la clé (art. 14-2-1, I, al. 7 : l'affectation tient compte des clés). Exigée
   * avec plusieurs clés dès que la part de l'opération est positive ; une seule clé porte toute la part.
   */
  financementFondsTravauxCentimes?: number
}

export interface CleOperationNormalisee extends CleOperationTravaux {
  financementFondsTravauxCentimes: number
}

/** Qui décide : l'assemblée (défaut), ou l'administrateur provisoire investi des pouvoirs de l'assemblée (art. 29-1). */
export type OrigineDecisionTravaux = 'assemblee' | 'administrateur'

export interface DecisionTravaux {
  /** Date de l'assemblée, ou de la décision de l'administrateur provisoire (registre, D. 1967 art. 62-8). */
  date: string
  /** Résolution, ou référence de la décision au registre. */
  resolution: string
  origine?: OrigineDecisionTravaux
  /** Majorité requise de la résolution (Gestéam tranche 31, « Majorité : Art. … ») ; sans objet hors assemblée. */
  majorite?: TypeMajorite | null
  /** Majorité du second vote immédiat qui l'a adoptée : art. 24 après l'art. 25 (art. 25-1), art. 25 après l'art. 26 (art. 26-1). */
  secondVote?: 'art24' | 'art25' | null
}

export interface SaisieOperationTravaux {
  /** N° d'opération, 5 caractères (segment repris dans les comptes de travaux). */
  numero: string
  coproprieteId: string
  libelle: string
  /** TYPE_TRAVAUX (Gestéam « Type ») ; facultatif. */
  type?: TypeTravaux | null
  /** STATUT_TRAVAUX ; par défaut « Adopté » avec une décision, « Projet » sans. */
  statut?: StatutTravaux
  /**
   * Date et motif du statut saisi quand il n'est ni « Projet » ni « Adopté » : rejet, ou reprise d'une opération déjà
   * engagée ; tracé comme un changement (J2 : un saut d'étape se motive et reste tracé). Sans objet sinon (l'adoption est
   * datée de la décision).
   */
  changementStatut?: { le: string; motif?: string | null } | null
  /** Clé de l'opération ; avec la grille `cles`, la clé de sa première ligne. */
  cleId: string
  /** Grille des clés, quand l'opération en porte plusieurs ; absente, la seule clé `cleId` porte tout. */
  cles?: CleOperationTravaux[]
  decision: DecisionTravaux | null
  budgetTtcCentimes: number
  financementFondsTravauxCentimes: number
  /**
   * Affectation de la part du fonds de travaux (J4) ; exigée dès que cette part est positive. `decisionAg` : référence
   * d'une décision d'affectation distincte ; à défaut, la résolution qui vote les travaux en tient lieu (🔵).
   * `majorite` : majorité requise de cette décision distincte (art. 14-2-1, I, al. 7 : celle des travaux).
   */
  affectationFonds?: {
    objet: ObjetDecaissementFondsTravaux
    decisionAg?: string | null
    autorisationJuge?: string | null
    majorite?: TypeMajorite | null
  } | null
  /**
   * Gestéam « Ne pas utiliser les fonds travaux » (onglet Budget, point 31) : l'opération ne puise pas dans le fonds de
   * travaux ; sa part du fonds est alors nulle (travaux-budget.ts : marquerNePasUtiliserFondsTravaux, suivi financier).
   */
  nePasUtiliserFondsTravaux?: boolean | null
  tranches: TrancheAppel[]
}

/** Changement de statut tracé : jamais effacé ; une annulation est un nouveau changement. */
export interface ChangementStatutTravaux {
  de: StatutTravaux
  vers: StatutTravaux
  le: string
  motif: string | null
  /** Saut d'une ou plusieurs étapes du cycle (motif exigé). */
  horsSequence: boolean
  /** Retour au statut précédent par annulation tracée. */
  annulation: boolean
  /** Traitement « Répartition de charges » (vers « Réparti ») ou son annulation (retour). */
  traitementId: string | null
}

export const ROLES_COMPTES_TRAVAUX = [
  'provisionsTravauxDecides',
  'soldeEnAttente',
  'travauxDecides',
  'provisionsSurTravaux',
  'subventions',
] as const
export type RoleCompteTravaux = (typeof ROLES_COMPTES_TRAVAUX)[number]

/** Compte de la série d'une opération : code du plan, auxiliaire = n° d'opération. */
export interface CompteSerieTravaux {
  role: RoleCompteTravaux
  planCode: string
  auxiliaire: string
  /** Intitulé du compte dans la nomenclature (arrêté du 14 mars 2005, art. 7). */
  intitule: string
  /** Libellé du compte : l'objet de l'opération (Gestéam, tranche 43 § 11). */
  libelle: string
}

/** Série de comptes d'une opération (tranche 43 § 11 et § 21 ; tranche 24 § 3) ; intitulés de l'arrêté, art. 7. */
export const SERIE_COMPTES_TRAVAUX: readonly { role: RoleCompteTravaux; planCode: string; intitule: string }[] = [
  { role: 'provisionsTravauxDecides', planCode: '10200', intitule: 'Provisions pour travaux décidés' },
  { role: 'soldeEnAttente', planCode: '12000', intitule: 'Solde en attente sur travaux et opérations exceptionnelles' },
  { role: 'travauxDecides', planCode: '67100', intitule: "Travaux décidés par l'assemblée générale" },
  { role: 'provisionsSurTravaux', planCode: '70200', intitule: "Provisions sur travaux du I de l'article 14-2 et opérations exceptionnelles" },
  { role: 'subventions', planCode: '71147', intitule: 'Subventions' },
]

export interface OperationTravaux extends SaisieOperationTravaux {
  type: TypeTravaux | null
  statut: StatutTravaux
  cles: CleOperationNormalisee[]
  montantAAppelerCentimes: number
  serieComptes: CompteSerieTravaux[]
  historiqueStatuts: ChangementStatutTravaux[]
}

// ─── Statuts ─────────────────────────────────────────────────────────────────────────────────

/** Cycle de STATUT_TRAVAUX, dans l'ordre de la liste Gestéam ; « Rejeté » et « En cours » sont hors cycle. */
const CYCLE_STATUTS: readonly StatutTravaux[] = ['Projet', 'Adopté', 'Commandé', 'Commencé', 'Terminé', 'A clôturer', 'Réparti']
const STATUTS_CONNUS: ReadonlySet<string> = new Set(STATUT_TRAVAUX)
const STATUTS_DECIDES: ReadonlySet<StatutTravaux> = new Set(CYCLE_STATUTS.slice(1))
/** Statuts définitifs (aucun changement en avant) et la seule voie qui les quitte. */
const SORTIES_DES_STATUTS_DEFINITIFS: ReadonlyMap<StatutTravaux, string> = new Map<StatutTravaux, string>([
  ['Réparti', "l'annulation de sa répartition (annulerRepartitionOperation)"],
  ['Rejeté', "l'annulation tracée du rejet (annulerDernierChangementStatut)"],
])
const TYPES_CONNUS: ReadonlySet<string> = new Set(TYPE_TRAVAUX)
const ORIGINES_DECISION: ReadonlySet<string> = new Set<OrigineDecisionTravaux>(['assemblee', 'administrateur'])
/** Majorité du second vote immédiat, selon la majorité requise (art. 25-1, al. 1 ; art. 26-1). */
const SECOND_VOTE: Partial<Record<TypeMajorite, 'art24' | 'art25'>> = { art25: 'art24', art26: 'art25' }

const rangDansLeCycle = (statut: StatutTravaux): number => CYCLE_STATUTS.indexOf(statut)

/** Clé d'un objet dans son syndicat : le n° d'opération (comme l'id d'échéance) n'est unique qu'au sein du syndicat (D1). */
const dansLeSyndicat = (coproprieteId: string, id: string): string => `${coproprieteId}:${id}`

function verifierDate(date: string, objet: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${objet} : date invalide (${date}), AAAA-MM-JJ attendu.`)
}

/** Statut connu et du cycle : « En cours » est un regroupement de la recherche (🔵), pas un statut d'opération. */
function verifierStatutDuCycle(statut: StatutTravaux, numero: string): void {
  if (!STATUTS_CONNUS.has(statut)) throw new Error(`Opération ${numero} : statut inconnu « ${statut} » (STATUT_TRAVAUX).`)
  if (statut === 'En cours')
    throw new Error(`Opération ${numero} : « En cours » regroupe les opérations non closes dans la recherche ; choisir un statut du cycle.`)
}

/** « Adopté » exige la décision : tout statut à partir d'« Adopté » la porte, « Projet » et « Rejeté » jamais. */
function verifierDecisionDuStatut(statut: StatutTravaux, decision: DecisionTravaux | null, numero: string): void {
  if (STATUTS_DECIDES.has(statut) && !decision)
    throw new Error(
      `Opération ${numero} : statut « ${statut} » sans décision (assemblée ou administrateur provisoire) ; « Adopté » exige la décision (date, résolution) : adopterOperationTravaux.`,
    )
  if (!STATUTS_DECIDES.has(statut) && decision)
    throw new Error(`Opération ${numero} : statut « ${statut} » avec une décision enregistrée ; la décision enregistrée est celle qui adopte les travaux.`)
}

/** Majorité requise connue ; second vote cohérent avec elle (art. 25-1, al. 1 ; art. 26-1). */
function verifierMajoriteDecision({ majorite, secondVote }: DecisionTravaux, numero: string): void {
  if (majorite && !Object.hasOwn(MAJORITES_AG, majorite)) throw new Error(`Opération ${numero} : majorité inconnue « ${majorite} ».`)
  if (secondVote && (!majorite || SECOND_VOTE[majorite] !== secondVote))
    throw new Error(
      `Opération ${numero} : second vote « ${secondVote} » après la majorité « ${majorite ?? 'non précisée'} » ; second vote immédiat à l'art. 24 après l'art. 25 (art. 25-1), à l'art. 25 après l'art. 26 (art. 26-1).`,
    )
}

/** Décision : date et résolution ; majorité et second vote pour l'assemblée seulement. */
function verifierDecision(decision: DecisionTravaux, numero: string): void {
  if (!estDateIsoValide(decision.date) || !decision.resolution.trim())
    throw new Error('Décision incomplète (assemblée ou administrateur provisoire) : date (AAAA-MM-JJ) et résolution ou référence au registre attendues.')
  const origine = decision.origine ?? 'assemblee'
  if (!ORIGINES_DECISION.has(origine)) throw new Error(`Opération ${numero} : origine de décision inconnue « ${origine} ».`)
  if (origine === 'assemblee') verifierMajoriteDecision(decision, numero)
  else if (decision.majorite || decision.secondVote)
    throw new Error(`Opération ${numero} : décision de l'administrateur provisoire (L. 1965 art. 29-1) : ni vote ni majorité.`)
}

/** Art. 14-2-1, I, al. 7 : une affectation du fonds votée à part l'est à la même majorité que les travaux. */
function verifierMajoriteAffectation({ numero, decision, affectationFonds }: SaisieOperationTravaux): void {
  const majorite = affectationFonds?.majorite
  if (!majorite) return
  if (!Object.hasOwn(MAJORITES_AG, majorite)) throw new Error(`Opération ${numero} : majorité d'affectation inconnue « ${majorite} ».`)
  if (decision?.majorite && decision.majorite !== majorite)
    throw new Error(
      `Opération ${numero} : affectation du fonds à la majorité « ${majorite} », travaux à « ${decision.majorite} » ; l'affectation se vote à la même majorité que les dépenses concernées (art. 14-2-1, I, al. 7).`,
    )
}

/**
 * Décision tirée d'une résolution adoptée (resolutions-ag.ts) : majorité requise et, si le second vote l'a adoptée, sa
 * majorité. Refuse une résolution qui n'est pas adoptée.
 */
export function decisionDepuisResolution(resolution: Resolution, dateAssemblee: string): DecisionTravaux {
  verifierDate(dateAssemblee, `Résolution n° ${resolution.numero}`)
  if (resolution.etat !== 'adoptee')
    throw new Error(`Résolution n° ${resolution.numero} « ${resolution.etat} » : seule une résolution adoptée décide des travaux.`)
  const secondVote = resolution.secondVote?.adopte ? (SECOND_VOTE[resolution.majorite] ?? null) : null
  return { date: dateAssemblee, resolution: `Résolution n° ${resolution.numero}`, origine: 'assemblee', majorite: resolution.majorite, secondVote }
}

/**
 * Changements encore en vigueur, dans l'ordre de saisie : chaque annulation neutralise le changement en vigueur qui la
 * précède. Deux erreurs successives se corrigent ainsi par deux annulations.
 */
function changementsEnVigueur(operation: OperationTravaux): ChangementStatutTravaux[] {
  const enVigueur: ChangementStatutTravaux[] = []
  for (const changement of operation.historiqueStatuts) {
    if (changement.annulation) enVigueur.pop()
    else enVigueur.push(changement)
  }
  return enVigueur
}

/** Dernier changement encore en vigueur ; undefined quand tous sont annulés. */
const dernierChangementEnVigueur = (operation: OperationTravaux): ChangementStatutTravaux | undefined => changementsEnVigueur(operation).at(-1)

/**
 * Date au plus tôt d'un changement, lue sur les changements en vigueur : un changement suit le dernier en vigueur ; une
 * annulation suit le statut qu'elle rétablit (l'avant-dernier en vigueur), même si elle précède la date, peut-être
 * erronée, du changement qu'elle annule. Un changement annulé, comme son annulation, ne borne plus aucune date : la date
 * vraie d'un changement corrigé, même antérieure à la date erronée, se saisit après l'annulation (J2). L'annulation d'une
 * répartition est en outre bornée par la répartition qu'elle contre-passe (annulerRepartitionOperation).
 */
function verifierDateDuChangement(operation: OperationTravaux, { le, annulation }: Pick<ChangementStatutTravaux, 'le' | 'annulation'>): void {
  const borne = changementsEnVigueur(operation).at(annulation ? -2 : -1)
  if (!borne || le >= borne.le) return
  const { numero } = operation
  if (annulation)
    throw new Error(
      `Opération ${numero} : annulation du ${dateIsoVersFr(le)} antérieure au statut « ${borne.vers} » qu'elle rétablit (depuis le ${dateIsoVersFr(borne.le)}).`,
    )
  throw new Error(
    `Opération ${numero} : changement du ${dateIsoVersFr(le)} antérieur au dernier changement en vigueur (« ${borne.de} » → « ${borne.vers} » du ${dateIsoVersFr(borne.le)}).`,
  )
}

/**
 * Ajoute le changement à l'historique, dans l'ordre de saisie (qui n'est pas toujours celui des dates : la date vraie
 * d'un changement corrigé peut précéder son annulation).
 */
function ajouterChangement(operation: OperationTravaux, changement: Omit<ChangementStatutTravaux, 'de'>): OperationTravaux {
  verifierDate(changement.le, `Opération ${operation.numero}, statut « ${changement.vers} »`)
  verifierDateDuChangement(operation, changement)
  return {
    ...operation,
    statut: changement.vers,
    historiqueStatuts: [...operation.historiqueStatuts, { de: operation.statut, ...changement }],
  }
}

/** Adoption à la date de la décision (adopterOperationTravaux, ou création avec la décision). */
const changementAdoption = (le: string): Omit<ChangementStatutTravaux, 'de'> => ({
  vers: 'Adopté',
  le,
  motif: null,
  horsSequence: false,
  annulation: false,
  traitementId: null,
})

/** Aucun acte de l'opération (statut, répartition) avant la décision qui l'adopte. */
function verifierApresLaDecision({ numero, decision }: OperationTravaux, le: string, objet: string): void {
  if (decision && le < decision.date)
    throw new Error(`Opération ${numero} : ${objet} au ${dateIsoVersFr(le)}, avant la décision du ${dateIsoVersFr(decision.date)}.`)
}

const motifSaisi = (motif: string | null | undefined): string | null => motif?.trim() || null

/** Sens du changement : en avant ; un saut exige un motif ; « Rejeté » depuis « Projet » seulement, avec motif. */
function horsSequence(operation: OperationTravaux, vers: StatutTravaux, motif: string | null): boolean {
  const { numero, statut } = operation
  if (vers === 'Rejeté') {
    if (statut !== 'Projet')
      throw new Error(
        `Opération ${numero} « ${statut} » : seul un projet est rejeté. Décision annulée en justice (L. 1965 art. 42, al. 2) ou rapportée par une nouvelle assemblée : transition non établie ; suspendre ou annuler ses échéances (echeancier-appels.ts).`,
      )
    if (!motif) throw new Error(`Opération ${numero} : motif du rejet exigé (résolution rejetée, abandon).`)
    return false
  }
  const ecart = rangDansLeCycle(vers) - rangDansLeCycle(statut)
  if (ecart <= 0)
    throw new Error(`Opération ${numero} : « ${statut} » → « ${vers} » refusé ; un statut ne recule pas (annulerDernierChangementStatut).`)
  if (ecart > 1 && !motif) throw new Error(`Opération ${numero} : saut « ${statut} » → « ${vers} » sans motif ; un saut d'étape se justifie.`)
  return ecart > 1
}

/**
 * Change le statut de l'opération : en avant dans le cycle (un saut exige un motif et reste tracé), « Rejeté » depuis
 * « Projet ». « Réparti » passe par constaterRepartitionOperation, l'adoption par adopterOperationTravaux. Une décision
 * annulée en justice ou rapportée par une nouvelle assemblée n'a pas de transition (🔴, en-tête) : l'opération garde son
 * statut, ses échéances se suspendent ou s'annulent dans echeancier-appels.ts.
 */
export function changerStatutOperationTravaux(
  operation: OperationTravaux,
  vers: StatutTravaux,
  { le, motif }: { le: string; motif?: string | null },
): OperationTravaux {
  const { numero, statut, decision } = operation
  const sortie = SORTIES_DES_STATUTS_DEFINITIFS.get(statut)
  if (sortie) throw new Error(`Opération ${numero} « ${statut} » : statut définitif ; seule ${sortie} le quitte.`)
  verifierStatutDuCycle(vers, numero)
  if (vers === 'Réparti') throw new Error(`Opération ${numero} : « Réparti » suit la répartition de l'opération (constaterRepartitionOperation).`)
  const motifDuChangement = motifSaisi(motif)
  const saut = horsSequence(operation, vers, motifDuChangement)
  verifierDecisionDuStatut(vers, decision, numero)
  verifierApresLaDecision(operation, le, `statut « ${vers} »`)
  return ajouterChangement(operation, { vers, le, motif: motifDuChangement, horsSequence: saut, annulation: false, traitementId: null })
}

/** Adoption d'un projet : enregistre la décision (date, résolution, majorité) et passe « Adopté » à sa date. */
export function adopterOperationTravaux(operation: OperationTravaux, decision: DecisionTravaux): OperationTravaux {
  if (operation.statut !== 'Projet') throw new Error(`Opération ${operation.numero} « ${operation.statut} » : seul un projet s'adopte.`)
  verifierDecision(decision, operation.numero)
  const adoptee = { ...operation, decision }
  verifierMajoriteAffectation(adoptee)
  return ajouterChangement(adoptee, changementAdoption(decision.date))
}

const CODES_SERIE: ReadonlySet<string> = new Set(SERIE_COMPTES_TRAVAUX.map((c) => c.planCode))

/**
 * Mouvement de l'opération : au segment de son syndicat (le n° n'est unique qu'en son sein, D1), lien travaux ou compte
 * de sa série (code du plan de la série, auxiliaire = n°).
 */
function concerneOperation(m: Mouvement, numero: string, segmentSyndicat: string): boolean {
  const [syndicat, planCode, auxiliaire] = m.compte.split('.')
  if (syndicat !== segmentSyndicat) return false
  return m.liens?.travauxId === numero || (auxiliaire === numero && CODES_SERIE.has(planCode))
}

/**
 * « Réparti » suit la répartition : le traitement « Répartition de charges » qui mouvemente l'opération au segment de son
 * syndicat (D1) la passe « Réparti » à sa date, depuis « A clôturer » seulement (D. 2005-240 art. 8 : répartition à la
 * clôture définitive de l'opération), jamais avant la décision ; un traitement déjà porté par l'historique (répartition
 * constatée puis annulée) ne la repose pas.
 */
export function constaterRepartitionOperation(operation: OperationTravaux, repartition: Traitement, segmentSyndicat: string): OperationTravaux {
  const { numero, statut } = operation
  if (statut !== 'A clôturer')
    throw new Error(
      `Opération ${numero} « ${statut} » : la répartition des travaux n'intervient qu'à la clôture définitive de l'opération (D. 2005-240 art. 8) ; passer d'abord « A clôturer ».`,
    )
  if (repartition.famille !== 'Répartition de charges')
    throw new Error(`Traitement ${repartition.id} de la famille « ${repartition.famille} » : une « Répartition de charges » est attendue.`)
  if (operation.historiqueStatuts.some((c) => c.traitementId === repartition.id))
    throw new Error(`Opération ${numero} : répartition ${repartition.id} déjà constatée puis annulée ; une nouvelle répartition est attendue.`)
  verifierApresLaDecision(operation, repartition.date, `répartition ${repartition.id}`)
  if (!repartition.mouvements.some((m) => concerneOperation(m, numero, segmentSyndicat)))
    throw new Error(
      `Traitement ${repartition.id} : aucun mouvement de l'opération ${numero} au segment ${segmentSyndicat} (lien travaux ou compte de sa série ; D1).`,
    )
  return ajouterChangement(operation, { vers: 'Réparti', le: repartition.date, motif: null, horsSequence: false, annulation: false, traitementId: repartition.id })
}

/**
 * Annulation de la répartition (« Annulation répartition de charges » du traitement qui l'a posée) : retour tracé. Écriture
 * contraire, elle est datée au plus tôt de la répartition qu'elle contre-passe (arrêté du 14 mars 2005, art. 5 ; même
 * règle que J9, reglements-fournisseurs.ts), et non du seul statut qu'elle rétablit : entre les deux dates, les comptes
 * 450 et 671 porteraient la contre-passation d'une répartition pas encore passée.
 */
export function annulerRepartitionOperation(
  operation: OperationTravaux,
  annulation: Traitement,
  { motif }: { motif: string },
): OperationTravaux {
  const { numero, statut } = operation
  const repartie = dernierChangementEnVigueur(operation)
  if (statut !== 'Réparti' || !repartie?.traitementId) throw new Error(`Opération ${numero} « ${statut} » : aucune répartition à annuler.`)
  if (annulation.famille !== 'Annulation répartition de charges' || annulation.annule !== repartie.traitementId)
    throw new Error(`Traitement ${annulation.id} : l'annulation de la répartition ${repartie.traitementId} est attendue.`)
  const motifDuRetour = motifSaisi(motif)
  if (!motifDuRetour) throw new Error(`Opération ${numero} : motif de l'annulation exigé.`)
  if (annulation.date < repartie.le)
    throw new Error(
      `Opération ${numero} : annulation ${annulation.id} du ${dateIsoVersFr(annulation.date)} antérieure à la répartition ${repartie.traitementId} du ${dateIsoVersFr(repartie.le)} qu'elle contre-passe ; l'écriture contraire annule une écriture passée (arrêté du 14 mars 2005, art. 5), elle ne la précède pas.`,
    )
  return ajouterChangement(operation, { vers: repartie.de, le: annulation.date, motif: motifDuRetour, horsSequence: false, annulation: true, traitementId: annulation.id })
}

/**
 * Correction d'un changement de statut erroné : un NOUVEAU changement, motivé, qui revient au statut d'avant le dernier
 * changement encore en vigueur ; l'historique est conservé. Deux erreurs successives se corrigent par deux annulations
 * (chacune remonte d'un changement en vigueur). Ni la répartition (annulerRepartitionOperation), ni l'adoption (sa
 * décision reste) ; un rejet erroné s'annule ici. L'annulation est datée de la correction, au plus tôt à la date du
 * statut qu'elle rétablit ; ensuite, la date vraie du changement corrigé se saisit, même antérieure à la date erronée.
 */
export function annulerDernierChangementStatut(
  operation: OperationTravaux,
  { le, motif }: { le: string; motif: string },
): OperationTravaux {
  const { numero } = operation
  const enVigueur = dernierChangementEnVigueur(operation)
  if (!enVigueur) throw new Error(`Opération ${numero} : aucun changement de statut en vigueur à annuler.`)
  if (enVigueur.traitementId) throw new Error(`Opération ${numero} : « Réparti » s'annule avec sa répartition (annulerRepartitionOperation).`)
  if (enVigueur.de === 'Projet' && enVigueur.vers === 'Adopté')
    throw new Error(`Opération ${numero} : l'adoption porte la décision ; elle ne s'annule pas ici.`)
  const motifDuRetour = motifSaisi(motif)
  if (!motifDuRetour) throw new Error(`Opération ${numero} : motif de l'annulation exigé.`)
  return ajouterChangement(operation, { vers: enVigueur.de, le, motif: motifDuRetour, horsSequence: false, annulation: true, traitementId: null })
}

const STATUTS_OPERATION_EN_COURS: ReadonlySet<StatutTravaux> = new Set(CYCLE_STATUTS.filter((s) => s !== 'Réparti'))

/** Filtre « En cours » de la recherche Gestéam (🔵) : opération du cycle ni répartie ni rejetée, projets compris. */
export const estOperationEnCours = (statut: StatutTravaux): boolean => STATUTS_OPERATION_EN_COURS.has(statut)

/**
 * Ligne de la table des changements de statut (db/schema.ts, ChangementStatut, hors champs d'enregistrement). L'entité
 * « travaux » reste à ajouter à EntiteAStatutHistorise (Frédéric) ; la clé porte le syndicat, le n° n'étant unique
 * qu'en son sein (D1).
 */
export interface ChangementStatutTravauxAHistoriser {
  entiteType: 'travaux'
  entiteId: string
  statutAncien: StatutTravaux
  statutNouveau: StatutTravaux
  dateEffet: string
  courrierId: null
  horsSequence: boolean
  motif: string | null
}

/** Motif historisé : l'annulation et le traitement, sans colonne propre dans la table, y sont repris. */
function motifAHistoriser({ annulation, motif, traitementId }: ChangementStatutTravaux): string | null {
  const parties = [annulation ? 'Annulation' : null, motif, traitementId ? `traitement ${traitementId}` : null].filter(
    (partie): partie is string => Boolean(partie),
  )
  return parties.length > 0 ? parties.join(' — ') : null
}

/**
 * Historique des statuts de l'opération, prêt pour la table des changements de statut (date d'effet = date de l'acte),
 * dans l'ordre de saisie : la chaîne se relit dans cet ordre, pas par date d'effet.
 */
export function changementsStatutAHistoriser(operation: OperationTravaux): ChangementStatutTravauxAHistoriser[] {
  const entiteId = dansLeSyndicat(operation.coproprieteId, operation.numero)
  return operation.historiqueStatuts.map((c) => ({
    entiteType: 'travaux',
    entiteId,
    statutAncien: c.de,
    statutNouveau: c.vers,
    dateEffet: c.le,
    courrierId: null,
    horsSequence: c.horsSequence,
    motif: motifAHistoriser(c),
  }))
}

// ─── Création ────────────────────────────────────────────────────────────────────────────────

const MOTIF_AFFECTATION_ABSENTE =
  "préciser l'affectation de la part du fonds de travaux (art. 14-2-1, I, 1° à 4°, ou art. 29-14, 2°)."

/**
 * Référence de la décision des travaux selon qui la prend : « <résolution> (AG du <date>) » pour l'assemblée,
 * « <référence au registre> (décision de l'administrateur provisoire du <date>) » pour l'administrateur provisoire, dont
 * les décisions sont mentionnées au registre sans assemblée (D. 1967 art. 62-8).
 */
export function referenceDecisionTravaux({ resolution, date, origine }: DecisionTravaux): string {
  const auteur = origine === 'administrateur' ? "décision de l'administrateur provisoire du" : 'AG du'
  return `${resolution} (${auteur} ${dateIsoVersFr(date)})`
}

/** Décision qui affecte le fonds : la décision distincte, à défaut celle qui décide les travaux (🔵). */
function decisionAffectationFonds({ affectationFonds, decision }: SaisieOperationTravaux): string | null {
  const distincte = affectationFonds?.decisionAg?.trim()
  return distincte || (decision ? referenceDecisionTravaux(decision) : null)
}

/**
 * Affectation de la part du fonds de l'opération, sans montant : objet, décision qui affecte le fonds (la distincte, à
 * défaut celle des travaux), ordonnance du juge ; null si l'affectation n'est pas précisée. Le décaissement de
 * controlerAffectationFondsTravaux, au montant près (point 31 : travaux-budget.ts, controlerEmploiFondsOperation).
 */
export function affectationFondsDeLOperation(operation: SaisieOperationTravaux): Omit<DecaissementFondsTravaux, 'montantCentimes'> | null {
  const { affectationFonds } = operation
  if (!affectationFonds) return null
  return {
    objet: affectationFonds.objet,
    decisionAg: decisionAffectationFonds(operation),
    autorisationJuge: affectationFonds.autorisationJuge ?? null,
  }
}

/** Contrôle d'affectation de la part (positive) du fonds ; null si l'affectation n'est pas précisée. */
function controlerPartFonds(operation: SaisieOperationTravaux): ResultatAffectation | null {
  const affectation = affectationFondsDeLOperation(operation)
  if (!affectation) return null
  return controlerAffectationFondsTravaux({ ...affectation, montantCentimes: operation.financementFondsTravauxCentimes })
}

/**
 * État de la part du fonds de travaux d'une opération, sans lever d'erreur : null sans part du fonds ; sinon, si les
 * appels peuvent la prendre en compte, et pourquoi pas. Sert aux listes (suivi « à faire ») qu'une opération en attente
 * d'une décision ou d'une ordonnance ne doit pas interrompre.
 */
export function etatPartFondsTravaux(operation: SaisieOperationTravaux): { autorise: boolean; motif: string } | null {
  if (operation.financementFondsTravauxCentimes <= 0) return null
  const controle = controlerPartFonds(operation)
  return controle ? { autorise: controle.autorise, motif: controle.motif } : { autorise: false, motif: MOTIF_AFFECTATION_ABSENTE }
}

const estCentimes = (valeur: number): boolean => Number.isInteger(valeur) && valeur >= 0

function verifierEnTete(saisie: SaisieOperationTravaux): void {
  if (!/^[0-9A-Z]{5}$/.test(saisie.numero)) throw new Error(`Numéro d'opération « ${saisie.numero} » : 5 caractères attendus.`)
  if (saisie.type !== undefined && saisie.type !== null && !TYPES_CONNUS.has(saisie.type))
    throw new Error(`Opération ${saisie.numero} : type de travaux inconnu « ${saisie.type} » (TYPE_TRAVAUX).`)
  if (!Number.isInteger(saisie.budgetTtcCentimes) || saisie.budgetTtcCentimes <= 0)
    throw new Error(`Budget invalide (${saisie.budgetTtcCentimes}) : centimes entiers strictement positifs attendus.`)
  if (!estCentimes(saisie.financementFondsTravauxCentimes))
    throw new Error('Part du fonds de travaux invalide : centimes entiers positifs attendus.')
  if (saisie.financementFondsTravauxCentimes > saisie.budgetTtcCentimes)
    throw new Error('Part du fonds de travaux supérieure au budget de l’opération.')
}

function verifierPartFondsSaisie(saisie: SaisieOperationTravaux): void {
  verifierMajoriteAffectation(saisie)
  if (saisie.financementFondsTravauxCentimes <= 0) return
  if (saisie.nePasUtiliserFondsTravaux)
    throw new Error(`Opération ${saisie.numero} : « Ne pas utiliser les fonds travaux » avec une part du fonds de travaux ; la part est alors nulle.`)
  const controle = controlerPartFonds(saisie)
  if (!controle) throw new Error(`Opération ${saisie.numero} : ${MOTIF_AFFECTATION_ABSENTE}`)
  if (controle.cause === 'exclu') throw new Error(`Opération ${saisie.numero} : ${controle.motif}`)
}

function verifierTranches(tranches: TrancheAppel[]): void {
  for (const t of tranches) {
    if (!estDateIsoValide(t.date)) throw new Error(`Date de tranche invalide (${t.date}) : AAAA-MM-JJ attendu.`)
    if (!(t.tauxPct > 0)) throw new Error(`Taux de tranche invalide (${t.tauxPct}) : strictement positif attendu.`)
  }
  const total = tranches.reduce((s, t) => s + t.tauxPct, 0)
  if (total > 100 + 1e-9) throw new Error(`Tranches à ${total} % : 100 % au plus.`)
}

/** Part du fonds de la clé : la sienne ; une clé seule porte toute la part ; plusieurs clés : exigée si la part est positive. */
function partFondsDeLaCle(cle: CleOperationTravaux, saisie: SaisieOperationTravaux, plusieurs: boolean): number {
  const part = cle.financementFondsTravauxCentimes
  if (part !== undefined) {
    if (!estCentimes(part) || part > cle.budgetTtcCentimes)
      throw new Error(`Opération ${saisie.numero}, clé « ${cle.cleId} » : part du fonds (${part}) en centimes entiers, au plus le budget de la clé.`)
    return part
  }
  if (!plusieurs) return saisie.financementFondsTravauxCentimes
  if (saisie.financementFondsTravauxCentimes > 0)
    throw new Error(
      `Opération ${saisie.numero}, clé « ${cle.cleId} » : part du fonds de travaux par clé exigée (art. 14-2-1, I, al. 7 : l'affectation tient compte des clés de répartition).`,
    )
  return 0
}

function verifierTotalDesCles(numero: string, montants: number[], attendu: number, objet: string): void {
  const total = montants.reduce((s, m) => s + m, 0)
  if (total !== attendu) throw new Error(`Opération ${numero} : ${objet} des clés ${total} centimes, celui de l'opération ${attendu}.`)
}

/** Ligne de la grille : clé non vide et unique, budget en centimes entiers strictement positifs. */
function verifierLigneDeCle(cle: CleOperationTravaux, numero: string, vues: Set<string>): void {
  if (!cle.cleId.trim() || vues.has(cle.cleId)) throw new Error(`Opération ${numero} : clé « ${cle.cleId} » vide ou en double.`)
  vues.add(cle.cleId)
  if (!Number.isInteger(cle.budgetTtcCentimes) || cle.budgetTtcCentimes <= 0)
    throw new Error(`Opération ${numero}, clé « ${cle.cleId} » : budget (${cle.budgetTtcCentimes}) en centimes entiers strictement positifs.`)
}

/** Grille des clés normalisée : une seule clé sans grille ; sinon clés distinctes, budgets et parts du fonds aux totaux. */
function clesDeLaSaisie(saisie: SaisieOperationTravaux): CleOperationNormalisee[] {
  const { numero, cles } = saisie
  if (!cles)
    return [{ cleId: saisie.cleId, budgetTtcCentimes: saisie.budgetTtcCentimes, financementFondsTravauxCentimes: saisie.financementFondsTravauxCentimes }]
  if (cles.length === 0 || cles[0].cleId !== saisie.cleId)
    throw new Error(`Opération ${numero} : grille des clés vide, ou dont la première ligne n'est pas la clé « ${saisie.cleId} ».`)
  const vues = new Set<string>()
  const normalisees = cles.map((cle) => {
    verifierLigneDeCle(cle, numero, vues)
    return { ...cle, financementFondsTravauxCentimes: partFondsDeLaCle(cle, saisie, cles.length > 1) }
  })
  verifierTotalDesCles(numero, normalisees.map((c) => c.budgetTtcCentimes), saisie.budgetTtcCentimes, 'budget')
  verifierTotalDesCles(numero, normalisees.map((c) => c.financementFondsTravauxCentimes), saisie.financementFondsTravauxCentimes, 'part du fonds')
  return normalisees
}

/** Série de comptes de l'opération, générée à sa création : auxiliaire = n° d'opération (règle « No des travaux »). */
function serieComptesDe({ numero, libelle }: SaisieOperationTravaux): CompteSerieTravaux[] {
  const auxiliaire = genererSegmentAuxiliaire({ regleNumeroCompte: 'No des travaux' }, { regle: 'No des travaux', valeur: numero })
  return SERIE_COMPTES_TRAVAUX.map(({ role, planCode, intitule }) => ({ role, planCode, auxiliaire, intitule, libelle }))
}

const STATUTS_DATES_PAR_LA_DECISION: ReadonlySet<StatutTravaux> = new Set<StatutTravaux>(['Projet', 'Adopté'])

/**
 * Statut saisi à la création, tracé comme un changement : l'adoption à la date de la décision ; au-delà d'« Adopté »
 * (reprise) ou « Rejeté », le changement saisi (date, motif), aux règles des transitions (J2 : un saut se motive et reste
 * tracé, à la reprise aussi).
 */
function tracerStatutDeCreation(
  projet: OperationTravaux,
  statut: StatutTravaux,
  changement: SaisieOperationTravaux['changementStatut'],
): OperationTravaux {
  const { numero, decision } = projet
  const adoptee = decision ? ajouterChangement(projet, changementAdoption(decision.date)) : projet
  if (STATUTS_DATES_PAR_LA_DECISION.has(statut)) {
    if (changement)
      throw new Error(`Opération ${numero} « ${statut} » : date et motif du statut sans objet ; l'adoption est datée de la décision.`)
    return adoptee
  }
  if (!changement)
    throw new Error(
      `Opération ${numero} : statut « ${statut} » à la création sans sa date ni son motif (changementStatut) ; il se trace comme un changement (J2).`,
    )
  return changerStatutOperationTravaux(adoptee, statut, changement)
}

/**
 * Crée l'opération : n° (5 caractères), type, budget, clés, décision et majorité, statut (« Adopté » exige la décision ;
 * ni « En cours » ni « Réparti » à la création ; tracé dans l'historique), part du fonds de travaux, tranches ; génère la
 * série de comptes.
 */
export function creerOperationTravaux(saisie: SaisieOperationTravaux): OperationTravaux {
  verifierEnTete(saisie)
  if (saisie.decision) verifierDecision(saisie.decision, saisie.numero)
  const statut = saisie.statut ?? (saisie.decision ? 'Adopté' : 'Projet')
  verifierStatutDuCycle(statut, saisie.numero)
  if (statut === 'Réparti')
    throw new Error(`Opération ${saisie.numero} : « Réparti » suit la répartition de l'opération (constaterRepartitionOperation), pas la saisie.`)
  verifierDecisionDuStatut(statut, saisie.decision, saisie.numero)
  verifierPartFondsSaisie(saisie)
  verifierTranches(saisie.tranches)
  const { changementStatut, ...sansChangement } = saisie
  const projet: OperationTravaux = {
    ...sansChangement,
    type: saisie.type ?? null,
    statut: 'Projet',
    cles: clesDeLaSaisie(saisie),
    montantAAppelerCentimes: saisie.budgetTtcCentimes - saisie.financementFondsTravauxCentimes,
    serieComptes: serieComptesDe(saisie),
    historiqueStatuts: [],
  }
  return tracerStatutDeCreation(projet, statut, changementStatut)
}

/** Numéro du compte de la série de l'opération, au segment du syndicat (D1) : `<syndicat>.<plan>.<n°>.0`. */
export function numeroCompteTravaux(operation: OperationTravaux, role: RoleCompteTravaux, segmentSyndicat: string): string {
  const compte = operation.serieComptes.find((c) => c.role === role)
  if (!compte) throw new Error(`Opération ${operation.numero} : compte « ${role} » absent de sa série.`)
  return formaterNumeroCompte({ mandat: segmentSyndicat, planCode: compte.planCode, auxiliaire: compte.auxiliaire })
}

// ─── Appels ──────────────────────────────────────────────────────────────────────────────────

/** Montant réparti sur les tranches, au centime ; quand elles font 100 %, la dernière absorbe l'arrondi. */
function montantsDesTranches(montantCentimes: number, tranches: TrancheAppel[]): number[] {
  const montants = tranches.map((t) => Math.round((montantCentimes * t.tauxPct) / 100))
  const total = tranches.reduce((s, t) => s + t.tauxPct, 0)
  if (Math.abs(total - 100) < 1e-9 && montants.length > 0)
    montants[montants.length - 1] += montantCentimes - montants.reduce((s, m) => s + m, 0)
  return montants
}

/** Identifiant de l'échéance : « <n°>-T<tranche> » avec une seule clé, « <n°>-T<tranche>-C<rang de la clé> » sinon. */
const idEcheanceTravaux = (numero: string, tranche: number, rangCle: number | null): string =>
  rangCle === null ? `${numero}-T${tranche}` : `${numero}-T${tranche}-C${rangCle}`

interface LigneAppelTravaux {
  id: string
  rang: number
  tranche: TrancheAppel
  cleId: string
  montantCentimes: number
  plafondFondsCentimes: number
}

/** Une ligne par tranche et par clé, dans l'ordre des tranches puis des clés. */
function lignesAppel(operation: OperationTravaux): LigneAppelTravaux[] {
  const plusieurs = operation.cles.length > 1
  const parCle = operation.cles.map((cle) => ({
    cleId: cle.cleId,
    montants: montantsDesTranches(cle.budgetTtcCentimes - cle.financementFondsTravauxCentimes, operation.tranches),
    plafonds: montantsDesTranches(cle.financementFondsTravauxCentimes, operation.tranches),
  }))
  return operation.tranches.flatMap((tranche, i) =>
    parCle.map((cle, k) => ({
      id: idEcheanceTravaux(operation.numero, i + 1, plusieurs ? k + 1 : null),
      rang: i + 1,
      tranche,
      cleId: cle.cleId,
      montantCentimes: cle.montants[i],
      plafondFondsCentimes: cle.plafonds[i],
    })),
  )
}

/** Identifiants des échéances d'une tranche (rang à partir de 1), une par clé. */
export function idsEcheancesDeLaTranche(operation: OperationTravaux, rang: number): string[] {
  return lignesAppel(operation)
    .filter((l) => l.rang === rang)
    .map((l) => l.id)
}

/**
 * Échéances « travaux » des tranches, une par clé (entrée de repartition-appels.avisDAppel) ; exige la décision
 * (assemblée ou administrateur provisoire) et, quand le fonds de travaux finance une part, une affectation admise. Avec
 * une seule clé, les échéances sont celles d'avant le point 30 ; le crédit sur l'auxiliaire de l'opération est posé par
 * traitementAppelDeFondsTravaux.
 */
export function echeancesTravaux(operation: OperationTravaux): EcheanceAppel[] {
  if (!operation.decision)
    throw new Error(`Opération ${operation.numero} : pas d'appel de travaux sans décision (assemblée ou administrateur provisoire).`)
  const etatFonds = etatPartFondsTravaux(operation)
  if (etatFonds && !etatFonds.autorise) throw new Error(`Opération ${operation.numero} : ${etatFonds.motif}`)
  return lignesAppel(operation).map((l) => ({
    id: l.id,
    coproprieteId: operation.coproprieteId,
    cleId: l.cleId,
    exigibilite: l.tranche.date,
    libelle: `${operation.libelle} — appel n° ${l.rang} (${l.tranche.tauxPct} %)`,
    montantCentimes: l.montantCentimes,
    nature: 'travaux' as const,
    compteContrepartie: '70200',
  }))
}

/**
 * Plafond d'emploi du fonds de travaux de chaque échéance (Gestéam « Montant € maximum d'emploi des fonds travaux ») : la
 * part du fonds de chaque clé répartie comme ses appels, avec la même affectation (décision distincte, à défaut la
 * résolution des travaux). Mêmes exigences que echeancesTravaux ; [] sans part du fonds ; une échéance dont le plafond
 * s'arrondit à zéro n'emploie pas le fonds.
 */
export function emploisFondsTravauxDesTranches(operation: OperationTravaux): EmploiFondsEcheance[] {
  if (operation.financementFondsTravauxCentimes <= 0) return []
  echeancesTravaux(operation)
  const affectation = affectationFondsDeLOperation(operation)
  if (!affectation) throw new Error(`Opération ${operation.numero} : ${MOTIF_AFFECTATION_ABSENTE}`)
  return lignesAppel(operation)
    .filter((l) => l.plafondFondsCentimes > 0)
    .map((l) => ({ echeanceId: l.id, plafondCentimes: l.plafondFondsCentimes, affectation }))
}

const AUXILIAIRE_A_ZERO = '00000'

/**
 * Index « <syndicat>:<id d'échéance> » → n° de l'opération qui l'émet (une ligne par tranche et par clé). Le n° n'est
 * unique qu'au sein du syndicat (D1) : deux opérations d'un même syndicat sous le même n° sont refusées.
 */
function indexEcheancesDesOperations(operations: readonly OperationTravaux[]): Map<string, string> {
  const numeros = new Set<string>()
  const index = new Map<string, string>()
  for (const operation of operations) {
    const { coproprieteId, numero } = operation
    const cle = dansLeSyndicat(coproprieteId, numero)
    if (numeros.has(cle)) throw new Error(`n° d'opération ${numero} en double dans le syndicat ${coproprieteId} (D1 : unique au sein du syndicat).`)
    numeros.add(cle)
    for (const ligne of lignesAppel(operation)) index.set(dansLeSyndicat(coproprieteId, ligne.id), numero)
  }
  return index
}

/**
 * Écriture de l'appel (famille « Appel de fonds ») dont les crédits portent l'auxiliaire de l'opération : débits des
 * comptes 450 de repartition-appels.traitementAppelDeFonds (mêmes contrôles), crédits cumulés par compte complet
 * `<syndicat>.<contrepartie>.<n° d'opération>.0`, lien travaux sur le crédit. L'opération d'une échéance est retrouvée
 * par son identifiant parmi les échéances des `operations` de son syndicat (D1) ; une échéance d'aucune opération reste
 * sur 00000. Les totaux par contrepartie sont ceux de traitementAppelDeFonds (echeancier-appels.marquerAppelees les
 * admet).
 */
export function traitementAppelDeFondsTravaux(
  avis: AvisAppels,
  contexte: { id: string; date: string; segmentSyndicat: string; comptes: CompteCoproprietaire[]; operations: readonly OperationTravaux[] },
): Traitement {
  const base = traitementAppelDeFonds(avis, contexte)
  const index = indexEcheancesDesOperations(contexte.operations)
  const debits: LigneMouvement[] = base.mouvements
    .filter((m) => m.sens === 'debit')
    .map(({ compte, sens, montantCentimes }) => ({ compte, sens, montantCentimes }))
  const credits = new Map<string, LigneMouvement>()
  for (const e of avis.echeances) {
    if (e.montantCentimes === 0) continue
    const auxiliaire = index.get(dansLeSyndicat(e.coproprieteId, e.id)) ?? AUXILIAIRE_A_ZERO
    const compte = `${contexte.segmentSyndicat}.${codeContrepartie(e)}.${auxiliaire}.0`
    const ligne = credits.get(compte)
    if (ligne) ligne.montantCentimes += e.montantCentimes
    else
      credits.set(compte, {
        compte,
        sens: 'credit',
        montantCentimes: e.montantCentimes,
        ...(auxiliaire === AUXILIAIRE_A_ZERO ? {} : { liens: { travauxId: auxiliaire } }),
      })
  }
  return creerTraitement({ id: base.id, famille: base.famille, date: base.date, mouvements: [...debits, ...credits.values()] })
}

// ─── Statut des tranches ─────────────────────────────────────────────────────────────────────

export interface StatutTrancheTravaux {
  /** Rang de la tranche, à partir de 1 (« Appel n° 1 »). */
  rang: number
  date: string
  tauxPct: number
  /** Total appelé de la tranche, toutes clés. */
  montantCentimes: number
  echeanceIds: string[]
  /** Statut commun de ses échéances (echeancier-appels.ts) ; null quand il diffère d'une clé à l'autre. */
  statut: StatutEcheanceAppel | null
  /** Gestéam « Encaissements effectués » : réglé des postes nés des échéances de la tranche. */
  encaisseCentimes: number
}

/**
 * Statut de chaque tranche, distinct du statut de l'opération : celui de ses échéances suivies (même syndicat, D1),
 * « Prévu » pour une échéance sans suivi ; null si les clés divergent. `postes` : postes de dette des comptes du syndicat
 * de l'opération (imputation-encaissements.ts) ; leur réglé, par échéance d'origine, donne l'encaissé de la tranche.
 */
export function statutsDesTranches(
  operation: OperationTravaux,
  suivies: readonly EcheanceAppelSuivie[],
  postes: readonly PosteDette[] = [],
): StatutTrancheTravaux[] {
  const index = new Map(suivies.filter((e) => e.coproprieteId === operation.coproprieteId).map((e) => [e.id, e.statut]))
  const lignes = lignesAppel(operation)
  return operation.tranches.map((tranche, i) => {
    const deLaTranche = lignes.filter((l) => l.rang === i + 1)
    const ids: ReadonlySet<string> = new Set(deLaTranche.map((l) => l.id))
    const statuts = new Set(deLaTranche.map((l): StatutEcheanceAppel => index.get(l.id) ?? 'Prévu'))
    const [commun] = statuts
    return {
      rang: i + 1,
      date: tranche.date,
      tauxPct: tranche.tauxPct,
      montantCentimes: deLaTranche.reduce((s, l) => s + l.montantCentimes, 0),
      echeanceIds: [...ids],
      statut: statuts.size === 1 ? commun : null,
      encaisseCentimes: postes.filter((p) => p.appelId !== null && ids.has(p.appelId)).reduce((s, p) => s + p.regleCentimes, 0),
    }
  })
}

// ─── Règlements ──────────────────────────────────────────────────────────────────────────────

const STATUTS_REGLES: ReadonlySet<StatutReglementFournisseur> = new Set<StatutReglementFournisseur>(['Enregistré', 'Rapproché'])
const STATUTS_EN_COURS: ReadonlySet<StatutReglementFournisseur> = new Set<StatutReglementFournisseur>(['Demandé', 'À régler'])

export interface ReglementsOperationTravaux {
  reglementIds: string[]
  /** Payé : enregistré ou rapproché (un virement rejeté est « Annulé », J9). */
  regleCentimes: number
  /** Demandé ou à régler. */
  enCoursCentimes: number
}

/** Règlements rattachés à l'opération par son n° (même syndicat, D1) : réglé et en cours (Gestéam, pied « Réglé »). */
export function reglementsDeLOperation(operation: OperationTravaux, reglements: readonly ReglementFournisseur[]): ReglementsOperationTravaux {
  const siens = reglements.filter((r) => r.coproprieteId === operation.coproprieteId && r.travauxId === operation.numero)
  const total = (statuts: ReadonlySet<StatutReglementFournisseur>): number =>
    siens.filter((r) => statuts.has(r.statut)).reduce((s, r) => s + r.montantCentimes, 0)
  return { reglementIds: siens.map((r) => r.id), regleCentimes: total(STATUTS_REGLES), enCoursCentimes: total(STATUTS_EN_COURS) }
}

/** Règlements dont le n° d'opération ne désigne aucune opération de leur syndicat. */
export function reglementsSansOperation(operations: readonly OperationTravaux[], reglements: readonly ReglementFournisseur[]): string[] {
  const connues = new Set(operations.map((o) => dansLeSyndicat(o.coproprieteId, o.numero)))
  return reglements.filter((r) => r.travauxId !== null && !connues.has(dansLeSyndicat(r.coproprieteId, r.travauxId))).map((r) => r.id)
}

// ─── Retenue de garantie ─────────────────────────────────────────────────────────────────────

/**
 * Retenue de garantie sur un règlement de travaux : 5 % au plus (loi n° 71-584, art. 1er), taux fini à deux décimales au
 * plus exigé, montant au centime le plus proche borné au plafond (retenueAuTaux, facture-ventilee.ts, en calcul entier :
 * l'arrondi ne dépasse jamais 5 % du TTC) ;
 * `liberationLe` : expiration du délai d'une année à compter de la réception (art. 2), même date que
 * expirationDelaiGarantie (travaux-retenue-garantie.ts, point 32, qui suit la garantie par marché).
 */
export function retenueGarantie({
  montantTtcCentimes,
  tauxPct,
  dateReception,
}: {
  montantTtcCentimes: number
  tauxPct: number
  dateReception: string | null
}): { retenueCentimes: number; netAPayerCentimes: number; liberationLe: string | null } {
  if (!estAuCentieme(tauxPct) || tauxPct < 0 || tauxPct > TAUX_MAXIMAL_RETENUE_GARANTIE_PCT)
    throw new Error(`Retenue de garantie à ${tauxPct} % : ${TAUX_MAXIMAL_RETENUE_GARANTIE_PCT} % au plus, deux décimales au plus (loi n° 71-584, art. 1er).`)
  if (!Number.isInteger(montantTtcCentimes) || montantTtcCentimes <= 0) throw new Error('Montant invalide : centimes entiers positifs attendus.')
  if (dateReception !== null && !estDateIsoValide(dateReception)) throw new Error(`Date de réception invalide (${dateReception}).`)
  const retenueCentimes = retenueAuTaux(montantTtcCentimes, tauxPct)
  return {
    retenueCentimes,
    netAPayerCentimes: montantTtcCentimes - retenueCentimes,
    liberationLe: dateReception ? ajouterMois(dateReception, 12) : null,
  }
}
