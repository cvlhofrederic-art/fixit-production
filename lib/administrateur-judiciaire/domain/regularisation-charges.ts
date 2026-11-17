import { ajouterJours, dateIsoVersFr, ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { DecisionAnnuelle, SourceDecisionAnnuelle } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import type { EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import type { Exercice, StatutExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import {
  estQualiteCopropriete,
  numeroCompteCoproprietaire,
  positionsEnPlace,
  type CompteCoproprietaire,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import type { PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import {
  STATUT_PIECE_ANNULEE,
  annulerPiece,
  changerStatutPiece,
  creerPieceTraitement,
  dateEffetPiece,
  type ParametreTraitement,
  type PieceTraitement,
  type StatutPiece,
} from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import { formaterNumeroCompte } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import { repartir, type AvisAppels, type CleRepartition, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import {
  creerTraitement,
  mouvementsARepartir,
  type FamilleTraitement,
  type LigneMouvement,
  type Mouvement,
  type OptionsTraitement,
  type SensMouvement,
  type Traitement,
} from '@/lib/administrateur-judiciaire/domain/traitements'
import { planDuCompte } from '@/lib/administrateur-judiciaire/domain/verrou-saisie'

/**
 * Répartition et régularisation des charges de l'exercice clos (point 25 du bilan 2). Fonctions pures, montants en
 * CENTIMES ENTIERS, dates ISO, sans écran ni table, aucune donnée personnelle (identifiants seulement).
 *
 * D1 (27/10/2026) — exercice, clés, comptes 450 et pièce appartiennent au SYNDICAT ; la pièce garde le mandat qui l'a
 * produite (journal-traitements.ts).
 *
 * Gestéam — 🟢 lu dans la cartographie :
 * - tranche 43 § 6 (trace d'une répartition) : la répartition est un TRAITEMENT daté et paramétré, famille « Répartition
 *   de charges » ; statuts Enregistré · Annulé · Imputé ; « annulées puis relancées » le même jour, « elle se rejoue
 *   (annulation puis nouvelle répartition) tant qu'elle n'est pas imputée » ; compte de la fiche : <mandat>471…
 *   « COMPTE EN ATTENTE D'IMPUTATION DÉBITEUR » ; paramètres (Date · Alpha · Entier long · Réel) : 1. début d'exercice +
 *   code du mandat + option « Solde » ; 2. fin d'exercice + « Répartition des dépenses » ; 3. date de passage des
 *   écritures (le jour du traitement) + entier 1 ; 4. une date quinze jours plus tard (🔵 dans la tranche : exigibilité
 *   du solde) ; documents individuels diffusés le lendemain ;
 * - tranche 43 § 7 (mouvements d'une répartition) : par copropriétaire (compte <mandat>.45000.<série>.0), deux écritures
 *   au journal P2 datées du DERNIER JOUR DE L'EXERCICE : « Remboursement de provisions <année> » au crédit, « Répartition
 *   des dépenses <immeuble> » au débit ; fiche : date comptable (fin d'exercice) · Effet (date du traitement) · Statut ;
 *   débit = crédit au total ;
 * - tranche 43 § 9 : échéancier de l'exercice, quatre appels trimestriels puis « un appel de régularisation daté de la
 *   répartition, égal à réalisé − budget » par clé (soldesParCle) ; cycle … Clôture → Répart. en cours → Réparti ;
 * - tranche 17 : familles « Répartition de charges » et « Annulation répartition de charges » ; tranche 18 : mouvement
 *   « lié à une répartition de charges » (origine R8) ; tranche 29 : pièce numérotée, cycle Enregistré → Imputé ;
 *   tranche 21 : 47xxx « comptes d'attente : d'imputation (débiteur, créditeur…) » ; tranche 37 : état « À répartir »
 *   des mouvements (traitements.mouvementsARepartir) ; aucune tranche ne relève l'état « Réparti » d'un mouvement.
 *
 * Le droit — 🟢 lu sur Légifrance le 03/11/2026 (versions en vigueur ce jour) :
 * - L. 1965 art. 10, al. 1 et 2 : charges des services collectifs et éléments d'équipement commun « en fonction de
 *   l'utilité objective » ; charges de conservation, d'entretien et d'administration des parties communes
 *   « proportionnellement aux valeurs relatives des parties privatives » ; al. 3 : le règlement de copropriété « fixe la
 *   quote-part afférente à chaque lot dans chacune des catégories de charges » → une clé = une catégorie, la quote-part
 *   du lot = ses tantièmes ;
 * - L. 1965 art. 14-1, I : provisions égales au quart du budget voté, sauf modalités votées, exigibles « le premier jour
 *   de chaque trimestre ou le premier jour de la période fixée par l'assemblée générale » ; l'article ne dit rien de la
 *   régularisation ; art. 14-3, al. 2 : charges et produits « enregistrés dès leur engagement juridique par le syndic
 *   indépendamment de leur règlement » ;
 * - L. 1965 art. 18, II : le syndic établit les comptes du syndicat, les soumet au vote de l'AG et tient une
 *   comptabilité « qui fait apparaître la position de chaque copropriétaire à l'égard du syndicat » ; art. 18-1 : pièces
 *   justificatives tenues à disposition entre la convocation et l'AG (rien sur la répartition elle-même) ;
 * - D. 1967 art. 45-1 : « L'approbation des comptes du syndicat par l'assemblée générale ne constitue pas une
 *   approbation du compte individuel de chacun des copropriétaires » ; provisions sur charges = sommes « en attente du
 *   solde définitif qui résultera de l'approbation des comptes du syndicat » ;
 * - D. 1967 art. 6-2 : « A l'occasion de la mutation à titre onéreux d'un lot : […] 3° Le trop ou moins perçu sur
 *   provisions, révélé par l'approbation des comptes, est porté au crédit ou au débit du compte de celui qui est
 *   copropriétaire lors de l'approbation des comptes » (chapeau relu aussi dans repartition-appels.ts) : le 3° ne vise que
 *   la mutation à titre onéreux ;
 * - D. 1967 art. 11, I, 1° : état financier et compte de gestion général notifiés avec l'ordre du jour, pour la validité
 *   de l'approbation ; II, 5° : « En vue de l'approbation des comptes par l'assemblée générale, le projet d'état
 *   individuel de répartition des comptes de chaque copropriétaire » (pour information) ;
 * - D. 1967 art. 35, 2° : le syndic peut exiger les provisions du budget prévisionnel ; aucun délai de paiement du solde ;
 * - décret n° 2005-240, art. 2 : le syndicat « approuve les comptes de l'exercice clos » ; art. 3 : produits des
 *   opérations courantes « enregistrées à la date d'exigibilité », plus les « produits divers affectés aux opérations
 *   courantes suivant affectation décidée ou approuvée par l'assemblée générale » ; art. 4 : travaux et opérations
 *   exceptionnelles, dépréciations de créances comprises ; art. 5 : « Les comptes sont arrêtés à la date de clôture de
 *   l'exercice » ; art. 8 : « Les excédents ou insuffisances des charges ou produits sur opérations courantes sont
 *   répartis à l'arrêté des comptes entre chacun des copropriétaires en fonction des quotes-parts afférentes à chaque
 *   lot dans chacune des catégories de charges » ; pour les travaux et opérations exceptionnelles, la répartition « ne
 *   peut intervenir qu'à la clôture définitive de chacune des opérations concernées » ;
 * - arrêté du 14 mars 2005, art. 7 : 450 « Copropriétaire individualisé », 471 « Compte en attente d'imputation
 *   débiteur », 701 « Provisions sur opérations courantes », classe 67 (travaux et opérations exceptionnelles), 68
 *   (dotations aux dépréciations sur créances douteuses) ; art. 10 : la classe 4 enregistre « les écritures de
 *   régularisation des charges et des produits » ; le 450 (ou, s'il est créé, le sous-compte 450-1) est débité des
 *   provisions appelées par le crédit du 701 et, « A l'arrêté des comptes, il est débité ou crédité de l'excédent ou de
 *   l'insuffisance sur opérations courantes par la contrepartie du compte 701 » ; « Le compte 47 "Compte d'attente" doit
 *   être soldé à la fin de l'exercice ou à défaut justifié ligne à ligne » ; art. 4 : tout enregistrement comporte un
 *   libellé « permettant une identification de la pièce justificative » ; art. 5 : « Une écriture erronée est annulée
 *   par une écriture contraire ».
 * - Aucun texte ne fixe l'exigibilité du solde de régularisation (ni L. 1965 art. 14-1, ni D. 1967 art. 6-2, 35 et
 *   45-1, ni le décret n° 2005-240) : le délai de quinze jours est une RÈGLE DE GESTION observée chez Gestéam. Règle
 *   commune J1-J10 : aucune durée en dur ; l'appelant fournit toujours un délai ou une date
 *   (DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS n'est qu'une valeur proposée) et le calcul sort sa justification
 *   (justificationExigibilite) selon l'ORIGINE réelle de l'exigibilité : délai de N jours retenu par le gestionnaire (la
 *   mention « valeur observée chez Gestéam » seulement si N est cette valeur) ou date fixée par le gestionnaire ;
 *   toujours suivie de l'absence de texte et du plancher retenu (pas avant l'approbation, art. 45-1, ci-dessous).
 * - Annexes 1 à 5 du décret n° 2005-240 (état financier, compte de gestion, ventilation par clé) : non lues (Légifrance :
 *   « Annexe non reproduite »).
 *
 * 🔵 Déduit :
 * - date comptable = date de clôture (Gestéam § 7 ; « à l'arrêté des comptes », décret art. 8, arrêtés « à la date de
 *   clôture », art. 5) ; date d'effet = date de passage (paramètre 3), postérieure à la clôture (exercice clos) ; le
 *   Traitement ne porte qu'une date, la date d'effet est dans les paramètres de la pièce ;
 * - annulation d'une répartition, par annulerRepartition comme par la voie générique journal-traitements.annulerPiece
 *   (qui porte la règle) : écriture contraire datée de la clôture, ni avant ni après : les comptes étant arrêtés à la
 *   clôture (art. 5), une annulation datée de l'exercice suivant laisserait à l'exercice clos la répartition annulée et la
 *   répartition relancée ; le jour de l'annulation, que cette date ne dit plus, est sa date d'effet, obligatoire, en
 *   ligne 1 des paramètres de la pièce d'annulation (choix VitFix : la fiche d'une annulation n'a jamais été ouverte,
 *   § 6 ne clique que sur une ligne « Imputé »), jamais antérieure à la date de passage de la répartition annulée ; une
 *   relance n'est pas passée avant cette date d'effet (« annulation puis nouvelle répartition », § 6), d'où la pièce
 *   d'annulation exigée parmi les pièces fournies à lancerRepartition. La chronologie (annulation avant ou après la
 *   diffusion J+1 des projets de décompte, ou la convocation de l'AG qui les joint, D. 1967 art. 11, II, 5°) se relit sur
 *   les dates d'effet (journal-traitements.dateEffetPiece) ;
 * - écriture : par compte 450, crédit des provisions appelées (remboursement) et débit de la quote-part réelle
 *   (répartition) ; contreparties au 471 ; le 471 est soldé dans le même traitement par le 701 (excédent : débit 701 ;
 *   insuffisance : crédit 701). Effet net : chaque 450 débité ou crédité de son insuffisance ou de son excédent par la
 *   contrepartie du 701 (arrêté art. 10), 471 soldé (art. 10) ;
 * - provisions = lignes « budget » des avis d'appel exigibles dans l'exercice, PAR LOT (quel que soit le compte appelé),
 *   car le trop ou moins perçu du lot va à celui qui est copropriétaire lors de l'approbation (art. 6-2, 3° pour une
 *   mutation à titre onéreux ; art. 45-1 pour une autre mutation, ci-dessous) ; ce sont les provisions APPELÉES, pas
 *   les provisions payées ; l'échéancier, s'il est fourni, fait foi (seules les échéances « Appelé » comptent) ; une
 *   échéance retenue n'est appelée que dans un avis (avisDAppel, echeancier-appels.marquerAppelees) : la retrouver dans
 *   un second avis est refusé (avis en double), sinon ses provisions compteraient deux fois sans aucun signal ;
 * - autre mutation (succession, donation, démembrement) : l'art. 6-2 ne vise que la mutation à titre onéreux ; la même
 *   règle (le compte de celui qui est copropriétaire lors de l'approbation) est déduite de l'art. 45-1, les provisions
 *   n'étant qu'« en attente du solde définitif qui résultera de l'approbation des comptes du syndicat » ; muterLot ne
 *   portant pas la nature de la mutation, la règle s'applique à tout changement de position (question 🔴 ci-dessous) ;
 * - dépenses = mouvements « à répartir » de l'exercice (mouvementsARepartir), débits moins crédits, par clé, hors
 *   traitements de répartition et d'annulation de répartition ; les classes 67 et 68 (travaux, opérations
 *   exceptionnelles, dépréciations : décret art. 4) et les lignes liées à une opération de travaux (liens.travauxId)
 *   sont écartées, leur répartition attendant la clôture de chaque opération (art. 8) ; une ligne hors classe 6 marquée
 *   « à répartir » (produit affecté par l'AG, art. 3) vient en déduction de sa clé ; « Réparti », état VitFix d'un
 *   mouvement réparti (traitements.ETATS_REPARTITION), non relevé chez Gestéam (la tranche 37 ne montre que
 *   « À répartir ») ;
 * - paramètre 4 : la tranche 43 § 6 ne relève que la date ; VitFix porte en plus le délai retenu dans l'entier de cette
 *   ligne (vide pour une date fixée), pour que la justification de l'exigibilité se relise sur la pièce ;
 * - statut Enregistré = projet : décompte individuel = « projet d'état individuel de répartition » (D. 1967 art. 11,
 *   II, 5°) ; Imputé = définitif, seulement après l'approbation des comptes (art. 45-1 ; 6-2, 3° pour une vente) :
 *   l'imputation exige l'approbation, refuse un lot dont le copropriétaire n'est plus le même à cette date (rejouer la
 *   répartition) et une exigibilité antérieure à l'approbation (le solde définitif « résultera de l'approbation ») ;
 *   l'appel et le poste de régularisation suivent l'imputation (J3 : un poste de régularisation n'est éligible au 19-2
 *   qu'après l'approbation) ;
 * - seul un exercice « Voté » ou « Répart. en cours » se répartit (cycle de exercices-budgets.changerStatutExercice) ;
 *   une seule répartition non annulée par exercice ; la décision de l'administrateur provisoire investi des pouvoirs de
 *   l'assemblée tient lieu d'approbation (comme dans decisions-annuelles-ag.ts) ;
 * - le solde dû devient un poste de dette sans appel d'origine (appelId null, imputable par echeancier-appels) ;
 *   l'excédent reste au crédit du 450.
 *
 * 🔴 Non établi (questions pour Hugo ou Frédéric) :
 * - « Dans Gestéam, quelle est la contrepartie des écritures 450 de la répartition : le 471 soldé par le 701 (choix
 *   VitFix, arrêté art. 10), les comptes de charges, ou le 471 laissé ouvert jusqu'à l'imputation ? » (seuls les 450 ont
 *   été vus, § 7) ;
 * - « Code du plan exact du 471 de la répartition chez Gestéam (47100 ?) » (§ 6 ne montre que « 471… » ; 47100 par
 *   défaut, remplaçable) ;
 * - « Dans Gestéam, quelle date comptable porte l'annulation d'une répartition : la clôture, ou le jour de l'annulation
 *   (la répartition annulée restant alors dans l'exercice clos) ? » (§ 6 ne montre que les statuts ; VitFix : la clôture,
 *   toute autre date refusée) ; « La fiche de l'annulation porte-t-elle le jour de l'annulation, et où (paramètres,
 *   « Effet » des mouvements, suivi) ? » (VitFix : date d'effet en ligne 1 des paramètres) ;
 * - « Sens de l'option « Solde » (paramètre 1) et de l'entier 1 (paramètre 3) » (l'entier est repris tel quel, « Solde »
 *   n'est pas stocké, sans effet sur le calcul) ;
 * - « Le solde de régularisation peut-il être exigible avant l'approbation des comptes ? » (VitFix : non, l'imputation
 *   est refusée) ; « Faut-il proposer quinze jours après la date de passage comme exigibilité, sans texte ? » ;
 * - « Lot vendu le jour même de l'approbation : vendeur ou acquéreur pour le trop ou moins perçu (art. 6-2, 3°) ? »
 *   (positions semi-ouvertes : l'acquéreur, en place ce jour-là) ;
 * - « Mutation à titre gratuit (succession, donation) ou démembrement du lot entre la clôture et l'approbation : le trop
 *   ou moins perçu va-t-il aussi au compte de celui qui est copropriétaire lors de l'approbation ? » (l'art. 6-2 ne vise
 *   que la mutation à titre onéreux ; muterLot n'en porte pas la nature ; VitFix : même règle, déduite de l'art. 45-1) ;
 * - « Sous-compte 450-1 (arrêté art. 10, s'il est créé par l'AG) : faut-il y écrire la régularisation ? » (VitFix :
 *   45000, comme l'appel) ;
 * - « Un exercice dont le budget n'a pas été voté (Préparation, Budgété : carence d'assemblée) se répartit-il, et sur
 *   quelles provisions ? » (VitFix : refusé) ;
 * - « La répartition solde-t-elle aussi les comptes de charges (classe 6) et le 701 de l'exercice, ou ces soldes
 *   attendent-ils l'approbation ? » (annexes du décret n° 2005-240 non lues) ;
 * - « Usufruit et nue-propriété d'un même lot : à quel compte va la régularisation ? » (Gestéam « Nu propr. » par poste,
 *   T43 § 8 ; VitFix : anomalie « comptes_multiples », répartition refusée) ;
 * - « Quel acte fait passer la répartition à « Imputé » chez Gestéam : la diffusion, l'approbation, une action du
 *   gestionnaire ? » (VitFix : après l'approbation seulement).
 *
 * Branchements à faire (fichiers non modifiés ici) :
 * - traitements.ts : LigneMouvement n'a pas de libellé (arrêté art. 4 ; art. 10 : « Le libellé de l'écriture précise le
 *   nom du copropriétaire ») : les libellés « Remboursement de provisions » / « Répartition des dépenses » sont portés par
 *   le décompte (libellesRegularisation), pas par les lignes ;
 * - après imputation, marquer « Réparti » les mouvements de charges retenus (traitements.ts, attributs.etatRepartition)
 *   et faire passer l'exercice à « Répart. en cours » puis « Réparti » (statutExerciceApresRepartition, à l'appelant) ;
 * - referentiels-gesteam-judiciaire.ts : le type d'appel « Répartition de charges » (T43 § 8, liste 13) manque à
 *   TYPE_APPEL_LIE_AU_MOUVEMENT ; le poste de régularisation porte donc typeAppel null et un encaissement imputé dessus
 *   ne reçoit pas d'origine R8 (imputation-encaissements.mouvementsEncaissementImpute) ;
 * - « Compensation de solde » (T43 § 8) : l'excédent n'est pas imputé d'office sur les provisions impayées ;
 * - echeancier-appels.ts : l'appel de régularisation par clé (T43 § 9, soldesParCle) n'entre pas dans l'échéancier,
 *   qui refuse un montant négatif ;
 * - travaux-operations.ts : régularisation de chaque opération à sa clôture (lignes de travaux écartées ici) ;
 * - postes-creance.ts : nature « solde approuvé » du poste de régularisation (J3) ;
 * - gabarits-courrier.ts : courrier du décompte individuel (diffusion J+1) ;
 * - verrou : la borne de l'arrêté (verrou-saisie.borneArreteDesComptes, date de clôture incluse) refuse la répartition
 *   et son annulation, toutes deux datées de la clôture : une fois la borne posée, la répartition ne se rejoue plus (une
 *   annulation datée après la clôture est refusée) ; elle ne se pose qu'après la procédure de clôture ;
 * - tables (pièces, décomptes) : Frédéric ; aucune modification de db/schema.ts.
 * Déjà en place, rien à brancher : l'alerte « exercice clos non réparti » (T43 § 9) est suivi-a-faire.depuisExercices
 * (élément « repartition_en_retard ») ; elle lit le statut de l'exercice, que l'appelant fait passer à « Réparti » à
 * l'imputation (statutExerciceApresRepartition).
 */

export const FAMILLE_REPARTITION = 'Répartition de charges'
const FAMILLE_ANNULATION_REPARTITION = 'Annulation répartition de charges'

/** Familles écartées de la base des dépenses : une répartition ne se répartit pas (comme analytiques.ts). */
const FAMILLES_REPARTITION: ReadonlySet<FamilleTraitement> = new Set<FamilleTraitement>([
  FAMILLE_REPARTITION,
  FAMILLE_ANNULATION_REPARTITION,
])

/**
 * 🟢 Observé chez Gestéam (tranche 43 § 6, paramètre 4 : « une date quinze jours plus tard ») ; 🔵 son sens (exigibilité
 * du solde) ; aucun texte. Valeur PROPOSÉE à l'appelant, jamais appliquée d'office (aucune durée en dur, règle J).
 */
export const DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS = 15

const SANS_TEXTE_EXIGIBILITE =
  "aucun texte ne fixe l'exigibilité du solde de régularisation (L. 1965 art. 14-1 ; D. 1967 art. 6-2, 35 et 45-1 ; décret n° 2005-240)"
const FONDEMENT_PLANCHER_EXIGIBILITE = "le solde définitif « résultera de l'approbation des comptes du syndicat » (D. 1967 art. 45-1)."

/** 🔵 Code du plan du 471 (tranche 43 § 6 : « 471… ») ; remplaçable. */
export const PLAN_ATTENTE_DEBITEUR_PAR_DEFAUT = '47100'
/** 🔵 Code du plan du 701, comme l'appel de fonds (repartition-appels.ts) ; remplaçable. */
export const PLAN_PROVISIONS_COURANTES_PAR_DEFAUT = '70100'
const AUXILIAIRE_GENERAL = '00000'

/** Libellé du paramètre 2 (tranche 43 § 6). */
const LIBELLE_PARAMETRE_FIN = 'Répartition des dépenses'
/** Entier du paramètre 3, observé, ⚪ sens non établi. */
const ENTIER_PARAMETRE_PASSAGE = 1

/** Charges hors opérations courantes (arrêté art. 7 ; décret n° 2005-240 art. 4 et 8) : écartées de la régularisation. */
const CLASSES_HORS_COURANTES: ReadonlySet<string> = new Set(['67', '68'])

/** Statuts d'exercice qui admettent une répartition (🔵 cycle de changerStatutExercice). */
const STATUTS_REPARTISSABLES: ReadonlySet<StatutExercice> = new Set<StatutExercice>(['Voté', 'Répart. en cours'])

const fr = dateIsoVersFr

// ─── Paramètres typés ───────────────────────────────────────────────────────────────────────

/** Paramètres typés de la répartition (les quatre lignes génériques de la pièce, tranche 43 § 6). */
export interface ParametresRepartition {
  /** Début de l'exercice, inclus. */
  du: string
  /** Fin de l'exercice (clôture), incluse : date comptable des écritures. */
  au: string
  /** Date de passage des écritures (jour du traitement) : date d'effet. */
  dateEffet: string
  /** Exigibilité du solde de régularisation. */
  exigibilite: string
  /**
   * Origine de l'exigibilité : délai retenu, en jours après la date de passage (entier du paramètre 4), ou null pour une
   * date fixée par le gestionnaire. La justification en dépend (justificationExigibilite).
   */
  delaiExigibiliteJours: number | null
  /** Code du mandat (paramètre 1, alpha). */
  mandatCode: string
}

/** Exigibilité du solde : un délai en jours après la date de passage, ou une date ; toujours fournie (aucune par défaut). */
export type ExigibiliteSolde = { delaiJours: number } | { date: string }

function verifierDelai(delaiJours: number): void {
  if (!Number.isInteger(delaiJours) || delaiJours < 0)
    throw new Error(`Délai d'exigibilité invalide (${delaiJours} jours) : entier positif ou nul attendu.`)
}

/** Un délai retenu doit donner l'exigibilité portée par les paramètres : sinon l'origine annoncée serait fausse. */
function verifierOrigineExigibilite({ dateEffet, exigibilite, delaiExigibiliteJours: delai }: ParametresRepartition): void {
  if (delai === null) return
  verifierDelai(delai)
  const attendue = ajouterJours(dateEffet, delai)
  if (attendue !== exigibilite)
    throw new Error(
      `Répartition : délai d'exigibilité de ${delai} jour(s) après le ${fr(dateEffet)}, soit le ${fr(attendue)}, incohérent avec l'exigibilité du ${fr(exigibilite)}.`,
    )
}

function verifierParametres(p: ParametresRepartition): void {
  const dates: [string, string][] = [
    ["début d'exercice", p.du],
    ["fin d'exercice", p.au],
    ['date de passage', p.dateEffet],
    ["date d'exigibilité", p.exigibilite],
  ]
  for (const [nom, valeur] of dates)
    if (!estDateIsoValide(valeur)) throw new Error(`Répartition : ${nom} invalide (« ${valeur} ») : AAAA-MM-JJ attendu.`)
  if (p.du >= p.au) throw new Error(`Répartition : exercice du ${p.du} au ${p.au}, bornes inversées.`)
  if (p.dateEffet <= p.au)
    throw new Error(`Répartition : date de passage ${p.dateEffet} au plus tôt le lendemain de la clôture (${p.au}) : l'exercice doit être clos.`)
  if (p.exigibilite < p.dateEffet)
    throw new Error(`Répartition : exigibilité ${p.exigibilite} antérieure à la date de passage ${p.dateEffet}.`)
  if (!p.mandatCode.trim()) throw new Error('Répartition : code du mandat attendu (paramètre 1).')
  verifierOrigineExigibilite(p)
}

function exigibiliteTypee(
  dateEffet: string,
  exigibilite: ExigibiliteSolde,
): Pick<ParametresRepartition, 'exigibilite' | 'delaiExigibiliteJours'> {
  if ('date' in exigibilite) return { exigibilite: exigibilite.date, delaiExigibiliteJours: null }
  verifierDelai(exigibilite.delaiJours)
  return { exigibilite: ajouterJours(dateEffet, exigibilite.delaiJours), delaiExigibiliteJours: exigibilite.delaiJours }
}

/**
 * Paramètres de la répartition d'un exercice : bornes de l'exercice, date de passage, exigibilité (délai après la date de
 * passage ou date, toujours fournie), code du mandat. Refuse un exercice qui n'est ni « Voté » ni « Répart. en cours »,
 * une date de passage qui n'est pas postérieure à la clôture, une exigibilité antérieure à la date de passage.
 */
export function parametresRepartition({
  exercice,
  dateEffet,
  mandatCode,
  exigibilite,
}: {
  exercice: Exercice
  dateEffet: string
  mandatCode: string
  exigibilite: ExigibiliteSolde
}): ParametresRepartition {
  if (!STATUTS_REPARTISSABLES.has(exercice.statut))
    throw new Error(
      `Exercice ${exercice.nom} au statut « ${exercice.statut} » : répartition des charges refusée (exercice « Voté » ou « Répart. en cours » attendu).`,
    )
  if (!estDateIsoValide(dateEffet)) throw new Error(`Répartition : date de passage invalide (« ${dateEffet} ») : AAAA-MM-JJ attendu.`)
  const parametres: ParametresRepartition = {
    du: exercice.ouverture,
    au: exercice.cloture,
    dateEffet,
    ...exigibiliteTypee(dateEffet, exigibilite),
    mandatCode: mandatCode.trim(),
  }
  verifierParametres(parametres)
  return parametres
}

/** Origine de l'exigibilité, en clair : délai retenu (valeur Gestéam ou non) ou date fixée. */
function origineExigibilite({ dateEffet, exigibilite, delaiExigibiliteJours: delai }: ParametresRepartition): string {
  const depart = `après la date de passage du ${fr(dateEffet)}`
  if (delai === null) return `date fixée par le gestionnaire, ${ecartJours(dateEffet, exigibilite)} jour(s) ${depart}`
  const gesteam = delai === DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS ? ' (valeur observée chez Gestéam)' : ''
  return `délai de ${delai} jour(s) ${depart}, retenu par le gestionnaire${gesteam}`
}

/**
 * Justification de l'exigibilité (règle J : un délai sort sa justification, pas seulement sa date) : origine réelle
 * (délai retenu ou date fixée), absence de texte, plancher retenu par VitFix (pas avant l'approbation des comptes, art.
 * 45-1, contrôlé à l'imputation ; daté quand l'approbation est connue).
 */
export function justificationExigibilite(p: ParametresRepartition, approbation: Pick<ApprobationComptes, 'date'> | null = null): string {
  verifierParametres(p)
  const approuves = approbation ? ` du ${fr(approbation.date)}` : " (contrôlé à l'imputation)"
  return `Solde exigible le ${fr(p.exigibilite)} : ${origineExigibilite(p)} — ${SANS_TEXTE_EXIGIBILITE} ; plancher retenu : pas avant l'approbation des comptes${approuves}, ${FONDEMENT_PLANCHER_EXIGIBILITE}`
}

/**
 * Les quatre lignes génériques de la pièce (Date · Alpha · Entier long · Réel), dans l'ordre observé ; l'entier de la
 * ligne 4 porte le délai retenu (vide pour une date fixée), 🔵 VitFix.
 */
export function parametresVersLignes(p: ParametresRepartition): ParametreTraitement[] {
  verifierParametres(p)
  return [
    { date: p.du, alpha: p.mandatCode, entier: null, reel: null },
    { date: p.au, alpha: LIBELLE_PARAMETRE_FIN, entier: null, reel: null },
    { date: p.dateEffet, alpha: null, entier: ENTIER_PARAMETRE_PASSAGE, reel: null },
    { date: p.exigibilite, alpha: null, entier: p.delaiExigibiliteJours, reel: null },
  ]
}

const CHAMPS_PARAMETRE = ['date', 'alpha', 'entier', 'reel'] as const

const afficherChamp = (valeur: string | number | null): string => {
  if (valeur === null) return 'vide'
  return typeof valeur === 'string' ? `« ${valeur} »` : String(valeur)
}

/**
 * Relit les paramètres typés d'une pièce de répartition ; refuse des lignes qui ne sont pas celles d'une répartition :
 * dates invalides ou incohérentes, délai incohérent avec l'exigibilité, et toute case qui diffère de ce qu'écrit
 * parametresVersLignes (libellé « Répartition des dépenses » en ligne 2, entier 1 en ligne 3, cases vides).
 */
export function lireParametresRepartition(lignes: readonly ParametreTraitement[]): ParametresRepartition {
  if (lignes.length !== 4) throw new Error(`Paramètres de répartition : quatre lignes attendues, ${lignes.length} reçues.`)
  const [debut, fin, passage, exigible] = lignes
  const parametres: ParametresRepartition = {
    du: debut.date ?? '',
    au: fin.date ?? '',
    dateEffet: passage.date ?? '',
    exigibilite: exigible.date ?? '',
    delaiExigibiliteJours: exigible.entier,
    mandatCode: debut.alpha ?? '',
  }
  verifierParametres(parametres)
  parametresVersLignes(parametres).forEach((attendue, rang) => {
    const champ = CHAMPS_PARAMETRE.find((c) => lignes[rang][c] !== attendue[c])
    if (champ)
      throw new Error(
        `Paramètres de répartition : ligne ${rang + 1}, ${champ} ${afficherChamp(lignes[rang][champ])} au lieu de ${afficherChamp(attendue[champ])} : ce ne sont pas les lignes d'une répartition.`,
      )
  })
  return parametres
}

// ─── Données de la régularisation ───────────────────────────────────────────────────────────

/** Provision appelée sur un lot pour une clé (code), en centimes. */
export interface ProvisionLot {
  lotId: string
  cle: string
  centimes: number
}

/** Dépenses nettes d'une clé (code) : débits moins crédits, en centimes (négatif si les produits l'emportent). */
export interface DepenseCle {
  cle: string
  centimes: number
}

export type CodeAnomalieRegularisation =
  | 'cle_inconnue'
  | 'charge_sans_cle'
  | 'lot_hors_cle'
  | 'lot_sans_compte'
  | 'comptes_multiples'
  | 'compte_inconnu'
  | 'ecart_provisions_701'

export interface AnomalieRegularisation {
  code: CodeAnomalieRegularisation
  cle: string | null
  lotId: string | null
  detail?: string
}

export interface DepensesARepartir {
  parCle: DepenseCle[]
  /**
   * Lignes écartées de la régularisation courante : classes 67 et 68, lignes liées à une opération de travaux (décret
   * n° 2005-240 art. 4 et 8 : réparties à la clôture de chaque opération).
   */
  exclues: Mouvement[]
  anomalies: AnomalieRegularisation[]
}

const estHorsOperationsCourantes = (m: Mouvement): boolean =>
  CLASSES_HORS_COURANTES.has(planDuCompte(m.compte).slice(0, 2)) || Boolean(m.liens?.travauxId)

/**
 * Dépenses par clé tirées des mouvements « à répartir » (traitements.mouvementsARepartir) : débits moins crédits ; les
 * classes 67 et 68 et les lignes de travaux sont écartées ; une ligne sans clé est une anomalie.
 */
export function depensesDepuisMouvements(mouvements: readonly Mouvement[]): DepensesARepartir {
  const parCle = new Map<string, number>()
  const exclues: Mouvement[] = []
  const anomalies: AnomalieRegularisation[] = []
  for (const m of mouvements) {
    const cle = m.attributs?.cle?.trim()
    if (estHorsOperationsCourantes(m)) exclues.push(m)
    else if (cle) parCle.set(cle, (parCle.get(cle) ?? 0) + (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes))
    else anomalies.push({ code: 'charge_sans_cle', cle: null, lotId: null, detail: `${m.compte} (traitement ${m.traitementId})` })
  }
  return {
    parCle: [...parCle.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cle, centimes]) => ({ cle, centimes })),
    exclues,
    anomalies,
  }
}

/**
 * Dépenses de l'exercice : mouvementsARepartir sur les bornes, hors traitements de répartition et de leur annulation
 * (une contre-passation remet « à répartir » les lignes qu'elle inverse), puis depensesDepuisMouvements.
 */
export const depensesDeLExercice = (
  traitements: readonly Traitement[],
  { du, au }: Pick<ParametresRepartition, 'du' | 'au'>,
): DepensesARepartir =>
  depensesDepuisMouvements(
    mouvementsARepartir(
      traitements.filter((t) => !FAMILLES_REPARTITION.has(t.famille)),
      { du, au },
    ),
  )

/** Note les échéances retenues d'un avis ; refuse celle déjà vue dans un autre avis : ses provisions compteraient deux fois. */
function noterEcheancesRetenues(vues: Set<string>, retenues: ReadonlySet<string>): void {
  for (const id of retenues) {
    if (vues.has(id))
      throw new Error(`Provisions : échéance ${id} présente dans deux avis d'appel ; une échéance n'est appelée qu'une fois (avis en double ?).`)
    vues.add(id)
  }
}

/**
 * Provisions appelées par lot et par clé : lignes des avis d'appel dont l'échéance est de nature « budget » et exigible
 * dans l'exercice (bornes incluses). Avec le suivi de l'échéancier (echeancier-appels.ts), seules les échéances
 * « Appelé » comptent : une échéance annulée n'a rien appelé. Une échéance retenue présente dans deux avis est refusée.
 */
export function provisionsDepuisAvis(
  avis: readonly AvisAppels[],
  { du, au, suivi }: Pick<ParametresRepartition, 'du' | 'au'> & { suivi?: readonly Pick<EcheanceAppelSuivie, 'id' | 'statut'>[] },
): ProvisionLot[] {
  const appelees = suivi ? new Set(suivi.filter((e) => e.statut === 'Appelé').map((e) => e.id)) : null
  const retenue = (e: EcheanceAppel): boolean =>
    e.nature === 'budget' && e.exigibilite >= du && e.exigibilite <= au && (appelees === null || appelees.has(e.id))
  const vues = new Set<string>()
  const provisions: ProvisionLot[] = []
  for (const a of avis) {
    const budget = new Set(a.echeances.filter(retenue).map((e) => e.id))
    noterEcheancesRetenues(vues, budget)
    for (const ligne of a.parCompte.flatMap((compte) => compte.lignes))
      if (budget.has(ligne.echeanceId)) provisions.push({ lotId: ligne.lotId, cle: ligne.cle, centimes: ligne.centimes })
  }
  return provisions
}

// ─── Calcul réalisé − provisions ────────────────────────────────────────────────────────────

export interface LigneDecompte {
  lotId: string
  /** Code de la clé (catégorie de charges). */
  cle: string
  libelleCle: string
  tantiemes: number
  totalTantiemes: number
  /** Dépenses nettes de toute la clé sur l'exercice. */
  depensesCleCentimes: number
  /** Quote-part du lot : dépenses de la clé × tantièmes du lot / total (plus forts restes). */
  quotePartCentimes: number
  /** Provisions appelées sur le lot pour cette clé. */
  provisionsCentimes: number
  /** Quote-part − provisions : positif, dû par le copropriétaire ; négatif, à lui rembourser. */
  soldeCentimes: number
}

export interface DecompteIndividuel {
  compteId: string
  lignes: LigneDecompte[]
  totalProvisionsCentimes: number
  totalDepensesCentimes: number
  /** Total dépenses − total provisions : positif, insuffisance due ; négatif, excédent à rembourser. */
  soldeCentimes: number
}

export interface Regularisation {
  /**
   * Date à laquelle les copropriétaires redevables ont été lus : celle de l'approbation, une fois connue (art. 6-2, 3°
   * pour une mutation à titre onéreux ; art. 45-1, 🔵, pour une autre mutation).
   */
  coproprietairesAu: string
  decomptes: DecompteIndividuel[]
  totalProvisionsCentimes: number
  totalDepensesCentimes: number
  /** Provisions − dépenses : positif, excédent ; négatif, insuffisance (arrêté art. 10). */
  excedentCentimes: number
  anomalies: AnomalieRegularisation[]
}

export interface EntreeRegularisation {
  /** D1 : le syndicat. */
  coproprieteId: string
  cles: readonly CleRepartition[]
  provisions: readonly ProvisionLot[]
  depenses: readonly DepenseCle[]
  positions: Position[]
  comptes: readonly CompteCoproprietaire[]
  /** Date de lecture des copropriétaires (date de passage par défaut dans lancerRepartition ; approbation si connue). */
  coproprietairesAu: string
  /** Solde créditeur du 701 de l'exercice, lu sur la comptabilité : contrôlé contre les provisions des avis s'il est fourni. */
  provisions701Centimes?: number
}

const somme = (valeurs: readonly number[]): number => valeurs.reduce((total, v) => total + v, 0)

function verifierCentimes(nature: string, centimes: number, signe: 'positif' | 'signe'): void {
  if (!Number.isSafeInteger(centimes) || (signe === 'positif' && centimes < 0))
    throw new Error(`${nature} invalide (${centimes}) : centimes entiers${signe === 'positif' ? ' positifs ou nuls' : ''} attendus.`)
}

function indexerProvisions(provisions: readonly ProvisionLot[]): Map<string, Map<string, number>> {
  const index = new Map<string, Map<string, number>>()
  for (const p of provisions) {
    verifierCentimes(`Provision du lot ${p.lotId}`, p.centimes, 'positif')
    const parLot = index.get(p.cle) ?? new Map<string, number>()
    parLot.set(p.lotId, (parLot.get(p.lotId) ?? 0) + p.centimes)
    index.set(p.cle, parLot)
  }
  return index
}

function indexerDepenses(depenses: readonly DepenseCle[]): Map<string, number> {
  const index = new Map<string, number>()
  for (const d of depenses) {
    verifierCentimes(`Dépense de la clé ${d.cle}`, d.centimes, 'signe')
    index.set(d.cle, (index.get(d.cle) ?? 0) + d.centimes)
  }
  return index
}

/** Répartition au tantième d'un montant signé (un crédit net se répartit comme un débit, de signe contraire). */
function repartirSigne(montant: number, cle: CleRepartition): number[] {
  const parts = repartir(Math.abs(montant), cle).map((p) => p.centimes)
  // 0 - part : jamais de zéro négatif.
  return montant < 0 ? parts.map((part) => 0 - part) : parts
}

function lignesDeLaCle(
  cle: CleRepartition,
  depensesCentimes: number,
  provisionsParLot: ReadonlyMap<string, number>,
  anomalies: AnomalieRegularisation[],
): LigneDecompte[] {
  const lotsDeLaCle = new Set(cle.lots.map((l) => l.lotId))
  for (const lotId of provisionsParLot.keys())
    if (!lotsDeLaCle.has(lotId)) anomalies.push({ code: 'lot_hors_cle', cle: cle.code, lotId, detail: 'provision appelée sur un lot absent de la clé' })
  const parts = repartirSigne(depensesCentimes, cle)
  return cle.lots
    .map((l, rang): LigneDecompte => {
      const provisionsCentimes = provisionsParLot.get(l.lotId) ?? 0
      return {
        lotId: l.lotId,
        cle: cle.code,
        libelleCle: cle.libelle,
        tantiemes: l.tantiemes,
        totalTantiemes: cle.totalTantiemes,
        depensesCleCentimes: depensesCentimes,
        quotePartCentimes: parts[rang],
        provisionsCentimes,
        soldeCentimes: parts[rang] - provisionsCentimes,
      }
    })
    .filter((l) => l.quotePartCentimes !== 0 || l.provisionsCentimes !== 0)
}

/** Comptes des positions de copropriété en place sur le lot à la date (D2 : un seul attendu). */
const comptesDuLot = (positions: Position[], lotId: string, date: string): Set<string> =>
  new Set(
    positionsEnPlace(positions, lotId, date)
      .filter((p) => estQualiteCopropriete(p.qualite))
      .flatMap((p) => (p.compteId ? [p.compteId] : [])),
  )

function attribuerAuxComptes(
  lignes: readonly LigneDecompte[],
  positions: Position[],
  date: string,
  anomalies: AnomalieRegularisation[],
): Map<string, LigneDecompte[]> {
  const parCompte = new Map<string, LigneDecompte[]>()
  for (const ligne of lignes) {
    const comptes = comptesDuLot(positions, ligne.lotId, date)
    if (comptes.size === 1) {
      const [compteId] = comptes
      parCompte.set(compteId, [...(parCompte.get(compteId) ?? []), ligne])
    } else anomalies.push({ code: comptes.size === 0 ? 'lot_sans_compte' : 'comptes_multiples', cle: ligne.cle, lotId: ligne.lotId })
  }
  return parCompte
}

function decompte(compteId: string, lignes: LigneDecompte[]): DecompteIndividuel {
  const totalProvisionsCentimes = somme(lignes.map((l) => l.provisionsCentimes))
  const totalDepensesCentimes = somme(lignes.map((l) => l.quotePartCentimes))
  return { compteId, lignes, totalProvisionsCentimes, totalDepensesCentimes, soldeCentimes: totalDepensesCentimes - totalProvisionsCentimes }
}

/**
 * Calcul réalisé − provisions par copropriétaire et par clé (décret n° 2005-240 art. 8 ; D. 1967 art. 6-2, 3° et
 * 45-1) : pour chaque clé, dépenses nettes réparties au tantième entre ses lots, provisions appelées sur chaque lot,
 * solde ; chaque lot au compte du copropriétaire en place à `coproprietairesAu`. Les anomalies (clé inconnue du syndicat, lot hors clé, lot
 * sans compte ou à plusieurs comptes, compte inconnu, écart au 701) empêchent l'écriture, pas le calcul.
 */
export function calculerRegularisation(entree: EntreeRegularisation): Regularisation {
  const { coproprieteId, coproprietairesAu, provisions701Centimes } = entree
  if (!estDateIsoValide(coproprietairesAu))
    throw new Error(`Date de lecture des copropriétaires invalide (« ${coproprietairesAu} ») : AAAA-MM-JJ attendu.`)
  const anomalies: AnomalieRegularisation[] = []
  const cles = new Map(entree.cles.filter((c) => c.coproprieteId === coproprieteId).map((c) => [c.code, c]))
  const provisionsParCle = indexerProvisions(entree.provisions)
  const depensesParCle = indexerDepenses(entree.depenses)
  const lignes: LigneDecompte[] = []
  for (const code of [...new Set([...provisionsParCle.keys(), ...depensesParCle.keys()])].sort((a, b) => a.localeCompare(b))) {
    const cle = cles.get(code)
    if (cle) lignes.push(...lignesDeLaCle(cle, depensesParCle.get(code) ?? 0, provisionsParCle.get(code) ?? new Map(), anomalies))
    else anomalies.push({ code: 'cle_inconnue', cle: code, lotId: null, detail: `clé absente des clés du syndicat ${coproprieteId}` })
  }
  const comptes = new Map(entree.comptes.filter((c) => c.coproprieteId === coproprieteId).map((c) => [c.id, c]))
  const decomptes = [...attribuerAuxComptes(lignes, entree.positions, coproprietairesAu, anomalies).entries()].map(([compteId, l]) => {
    if (!comptes.has(compteId)) anomalies.push({ code: 'compte_inconnu', cle: null, lotId: l[0].lotId, detail: `compte ${compteId} absent des comptes du syndicat` })
    return decompte(compteId, l)
  })
  const ordre = (id: string) => comptes.get(id)?.serie ?? id
  decomptes.sort((a, b) => ordre(a.compteId).localeCompare(ordre(b.compteId)))
  const totalProvisionsCentimes = somme(lignes.map((l) => l.provisionsCentimes))
  const totalDepensesCentimes = somme(lignes.map((l) => l.quotePartCentimes))
  const provisionsDesAvis = somme(entree.provisions.map((p) => p.centimes))
  if (provisions701Centimes !== undefined && provisions701Centimes !== provisionsDesAvis)
    anomalies.push({
      code: 'ecart_provisions_701',
      cle: null,
      lotId: null,
      detail: `701 : ${provisions701Centimes} centimes ; provisions des avis : ${provisionsDesAvis} centimes`,
    })
  return {
    coproprietairesAu,
    decomptes,
    totalProvisionsCentimes,
    totalDepensesCentimes,
    excedentCentimes: totalProvisionsCentimes - totalDepensesCentimes,
    anomalies,
  }
}

/** Réalisé − provisions d'une clé (tranche 43 § 9 : appel de régularisation par clé de l'échéancier de l'exercice). */
export interface SoldeCle {
  cle: string
  libelleCle: string
  /** Quotes-parts réparties entre les lots (égales aux dépenses de la clé quand aucun lot n'est en anomalie). */
  depensesCentimes: number
  provisionsCentimes: number
  soldeCentimes: number
}

/** Soldes de la régularisation par clé, tirés des décomptes individuels, dans l'ordre des codes. */
export function soldesParCle(regularisation: Regularisation): SoldeCle[] {
  const parCle = new Map<string, SoldeCle>()
  for (const l of regularisation.decomptes.flatMap((d) => d.lignes)) {
    const cumul = parCle.get(l.cle) ?? { cle: l.cle, libelleCle: l.libelleCle, depensesCentimes: 0, provisionsCentimes: 0, soldeCentimes: 0 }
    parCle.set(l.cle, {
      ...cumul,
      depensesCentimes: cumul.depensesCentimes + l.quotePartCentimes,
      provisionsCentimes: cumul.provisionsCentimes + l.provisionsCentimes,
      soldeCentimes: cumul.soldeCentimes + l.soldeCentimes,
    })
  }
  return [...parCle.values()].sort((a, b) => a.cle.localeCompare(b.cle))
}

// ─── Écriture ───────────────────────────────────────────────────────────────────────────────

export interface OptionsEcritureRegularisation extends OptionsTraitement {
  /** Identifiant du traitement, repris comme lien d'origine des mouvements (R8). */
  id: string
  segmentSyndicat: string
  comptes: readonly CompteCoproprietaire[]
  planAttente?: string
  planProvisions?: string
}

const SENS_INVERSE: Record<SensMouvement, SensMouvement> = { debit: 'credit', credit: 'debit' }

/** Ligne d'un montant signé : positif au `sens`, négatif au sens inverse, nul : aucune ligne. */
function ligneSignee(compte: string, montant: number, sens: SensMouvement, base: Pick<LigneMouvement, 'origine' | 'liens'>): LigneMouvement[] {
  if (montant === 0) return []
  return [{ compte, sens: montant > 0 ? sens : SENS_INVERSE[sens], montantCentimes: Math.abs(montant), ...base }]
}

/**
 * Écriture de la régularisation (famille « Répartition de charges »), datée de la clôture : par compte 450, crédit des
 * provisions (remboursement) et débit de la quote-part réelle (répartition), contreparties au 471 ; le 471 est soldé par
 * le 701 (excédent : débit 701 ; insuffisance : crédit 701). Refuse une régularisation à anomalies ou vide.
 */
export function traitementRegularisation(
  regularisation: Regularisation,
  parametres: ParametresRepartition,
  {
    id,
    segmentSyndicat,
    comptes,
    verrou,
    planAttente = PLAN_ATTENTE_DEBITEUR_PAR_DEFAUT,
    planProvisions = PLAN_PROVISIONS_COURANTES_PAR_DEFAUT,
  }: OptionsEcritureRegularisation,
): Traitement {
  if (regularisation.anomalies.length > 0)
    throw new Error(`Régularisation non écrite : ${regularisation.anomalies.length} anomalie(s) à lever d'abord.`)
  if (regularisation.decomptes.length === 0) throw new Error('Régularisation non écrite : ni provision ni dépense à répartir.')
  verifierParametres(parametres)
  const origine = { origine: { type: 'repartition' as const, repartitionId: id } }
  const lignes450 = regularisation.decomptes.flatMap((d) => {
    const compte = comptes.find((c) => c.id === d.compteId)
    if (!compte) throw new Error(`Compte copropriétaire introuvable : « ${d.compteId} ».`)
    const numero = numeroCompteCoproprietaire(compte, segmentSyndicat)
    const base = { ...origine, liens: { compteCoproprietaireId: d.compteId } }
    return [...ligneSignee(numero, d.totalProvisionsCentimes, 'credit', base), ...ligneSignee(numero, d.totalDepensesCentimes, 'debit', base)]
  })
  const compte471 = formaterNumeroCompte({ mandat: segmentSyndicat, planCode: planAttente, auxiliaire: AUXILIAIRE_GENERAL })
  const compte701 = formaterNumeroCompte({ mandat: segmentSyndicat, planCode: planProvisions, auxiliaire: AUXILIAIRE_GENERAL })
  const { totalProvisionsCentimes, totalDepensesCentimes, excedentCentimes } = regularisation
  return creerTraitement(
    {
      id,
      famille: FAMILLE_REPARTITION,
      date: parametres.au,
      mouvements: [
        ...lignes450,
        ...ligneSignee(compte471, totalProvisionsCentimes, 'debit', origine),
        ...ligneSignee(compte471, totalDepensesCentimes, 'credit', origine),
        ...ligneSignee(compte471, excedentCentimes, 'credit', origine),
        ...ligneSignee(compte701, excedentCentimes, 'debit', origine),
      ],
    },
    { verrou },
  )
}

// ─── Pièce : lancer, imputer, annuler ───────────────────────────────────────────────────────

/** Approbation des comptes de l'exercice : date et référence (assemblée et résolution, ou décision qui en tient lieu). */
export interface ApprobationComptes {
  date: string
  reference: string
}

export interface RepartitionCharges {
  /** Nom de l'exercice réparti (l'année chez Gestéam). */
  exercice: string
  /** D1 : segment comptable du syndicat (comptes de l'écriture, pièce d'annulation). */
  segmentSyndicat: string
  parametres: ParametresRepartition
  regularisation: Regularisation
  piece: PieceTraitement
  approbation: ApprobationComptes | null
}

export interface SaisieRepartition {
  exercice: Exercice
  dateEffet: string
  mandatCode: string
  exigibilite: ExigibiliteSolde
  cles: readonly CleRepartition[]
  provisions: readonly ProvisionLot[]
  depenses: readonly DepenseCle[]
  positions: Position[]
  comptes: readonly CompteCoproprietaire[]
  /**
   * Pièces du journal : répartitions déjà lancées et pièces d'annulation de celles qui sont annulées. Une seule
   * répartition non annulée par exercice ; une relance n'est pas passée avant l'annulation qui la précède.
   */
  repartitionsExistantes: readonly PieceTraitement[]
  /** Date de lecture des copropriétaires ; par défaut la date de passage (projet avant l'approbation). */
  coproprietairesAu?: string
  provisions701Centimes?: number
}

export interface OptionsPieceRepartition extends Omit<OptionsEcritureRegularisation, 'comptes'> {
  numero: number
  mandatId: string
}

type ExerciceDuSyndicat = { coproprieteId: string } & Pick<ParametresRepartition, 'du' | 'au'>

/** Pièce de répartition du syndicat pour ces bornes d'exercice (lignes 1 et 2 des paramètres), quel que soit son statut. */
const estRepartitionDe = (p: PieceTraitement, { coproprieteId, du, au }: ExerciceDuSyndicat): boolean =>
  p.famille === FAMILLE_REPARTITION && p.coproprieteId === coproprieteId && p.parametres[0]?.date === du && p.parametres[1]?.date === au

/** Répartition non annulée du syndicat pour ces bornes d'exercice (tranche 43 § 6 : on annule avant de relancer), ou null. */
export function repartitionActive(pieces: readonly PieceTraitement[], exercice: ExerciceDuSyndicat): PieceTraitement | null {
  return pieces.find((p) => estRepartitionDe(p, exercice) && p.statut !== STATUT_PIECE_ANNULEE) ?? null
}

/**
 * 🔵 On annule avant de relancer (tranche 43 § 6 : « annulation puis nouvelle répartition », vues le même jour) : pour
 * chaque répartition annulée du même exercice, sa pièce d'annulation figure parmi les pièces fournies, et la date de
 * passage de la relance ne précède pas la date d'effet de cette annulation (journal-traitements.dateEffetPiece) ; le
 * même jour est admis.
 */
function verifierRelanceApresAnnulations(
  pieces: readonly PieceTraitement[],
  { dateEffet, ...exercice }: ExerciceDuSyndicat & Pick<ParametresRepartition, 'dateEffet'>,
): void {
  const annulations = new Map(pieces.filter((p) => p.famille === FAMILLE_ANNULATION_REPARTITION).map((p) => [p.id, p]))
  for (const annulee of pieces.filter((p) => estRepartitionDe(p, exercice) && p.statut === STATUT_PIECE_ANNULEE)) {
    const annulation = annulee.annuleePar === undefined ? undefined : annulations.get(annulee.annuleePar)
    if (!annulation)
      throw new Error(
        `Répartition n° ${annulee.numero} annulée : pièce d'annulation absente des pièces fournies ; une relance se date après l'annulation qui la précède (tranche 43 § 6).`,
      )
    const effetAnnulation = dateEffetPiece(annulation)
    if (dateEffet < effetAnnulation)
      throw new Error(
        `Relance passée le ${fr(dateEffet)}, avant l'annulation n° ${annulation.numero} de la répartition n° ${annulee.numero}, d'effet le ${fr(effetAnnulation)} : on annule avant de relancer (tranche 43 § 6).`,
      )
  }
}

const libelleAnomalie = (a: AnomalieRegularisation): string => [a.code, a.cle, a.lotId].filter(Boolean).join(' ')

/**
 * Lance la répartition d'un exercice clos : paramètres typés, calcul réalisé − provisions, écriture datée de la clôture,
 * pièce numérotée au statut « Enregistré » (projet, annulable). Refuse une seconde répartition active du même exercice,
 * une relance passée avant l'annulation qui la précède ou sans sa pièce d'annulation, et un calcul à anomalies (la liste
 * est dans le refus).
 */
export function lancerRepartition(saisie: SaisieRepartition, options: OptionsPieceRepartition): RepartitionCharges {
  const { exercice } = saisie
  const parametres = parametresRepartition(saisie)
  const exerciceDuSyndicat = { coproprieteId: exercice.coproprieteId, du: parametres.du, au: parametres.au }
  const active = repartitionActive(saisie.repartitionsExistantes, exerciceDuSyndicat)
  if (active)
    throw new Error(
      `Exercice ${exercice.nom} : la répartition n° ${active.numero} (${active.statut}) est active ; l'annuler avant d'en relancer une (tranche 43 § 6).`,
    )
  verifierRelanceApresAnnulations(saisie.repartitionsExistantes, { ...exerciceDuSyndicat, dateEffet: parametres.dateEffet })
  const regularisation = calculerRegularisation({
    coproprieteId: exercice.coproprieteId,
    cles: saisie.cles,
    provisions: saisie.provisions,
    depenses: saisie.depenses,
    positions: saisie.positions,
    comptes: saisie.comptes,
    coproprietairesAu: saisie.coproprietairesAu ?? parametres.dateEffet,
    provisions701Centimes: saisie.provisions701Centimes,
  })
  if (regularisation.anomalies.length > 0)
    throw new Error(`Répartition de l'exercice ${exercice.nom} refusée : ${regularisation.anomalies.map(libelleAnomalie).join(' ; ')}.`)
  const traitement = traitementRegularisation(regularisation, parametres, { ...options, comptes: saisie.comptes })
  const piece = creerPieceTraitement({
    traitement,
    numero: options.numero,
    coproprieteId: exercice.coproprieteId,
    segmentSyndicat: options.segmentSyndicat,
    mandatId: options.mandatId,
    parametres: parametresVersLignes(parametres),
  })
  return { exercice: exercice.nom, segmentSyndicat: options.segmentSyndicat, parametres, regularisation, piece, approbation: null }
}

const referenceDecision = (source: SourceDecisionAnnuelle): string =>
  source.origine === 'assemblee'
    ? `assemblée ${source.agId}, résolution ${source.resolutionId}`
    : `décision de l'administrateur provisoire : ${source.reference}`

/**
 * Approbation des comptes tirée de la décision annuelle enregistrée (decisions-annuelles-ag.ts, type
 * « approbation_comptes ») : vote de l'assemblée, ou décision de l'administrateur provisoire qui en tient lieu. Refuse une
 * décision d'un autre type, d'un autre syndicat, ou d'un autre exercice que celui indiqué.
 */
export function approbationDepuisDecision(
  decision: DecisionAnnuelle,
  { coproprieteId, exerciceId }: { coproprieteId: string; exerciceId?: string },
): ApprobationComptes {
  if (decision.type !== 'approbation_comptes')
    throw new Error(`Décision ${decision.id} (« ${decision.type} ») : approbation des comptes attendue.`)
  if (decision.coproprieteId !== coproprieteId) throw new Error(`Décision ${decision.id} d'un autre syndicat que ${coproprieteId} (D1).`)
  if (exerciceId !== undefined && decision.exerciceId !== exerciceId)
    throw new Error(`Décision ${decision.id} : comptes de l'exercice ${decision.exerciceId}, pas de l'exercice ${exerciceId}.`)
  return { date: decision.date, reference: referenceDecision(decision.source) }
}

/**
 * Lots dont le copropriétaire à la date n'est pas le compte du décompte (D. 1967 art. 6-2, 3° pour une mutation à titre
 * onéreux ; art. 45-1, 🔵, pour une autre mutation : muterLot ne distingue pas la nature de la mutation).
 */
function lotsAReattribuer(regularisation: Regularisation, positions: Position[], date: string): string[] {
  const lots = new Set<string>()
  for (const d of regularisation.decomptes)
    for (const ligne of d.lignes) {
      const comptes = comptesDuLot(positions, ligne.lotId, date)
      if (comptes.size !== 1 || !comptes.has(d.compteId)) lots.add(ligne.lotId)
    }
  return [...lots]
}

function verifierApprobation(approbation: ApprobationComptes, parametres: ParametresRepartition): void {
  if (!estDateIsoValide(approbation.date))
    throw new Error(`Date d'approbation des comptes invalide (« ${approbation.date} ») : AAAA-MM-JJ attendu.`)
  if (approbation.date <= parametres.au)
    throw new Error(`Approbation du ${approbation.date} : les comptes approuvés sont ceux de l'exercice clos le ${parametres.au}.`)
  if (!approbation.reference.trim()) throw new Error("Approbation des comptes : référence de l'assemblée et de la résolution attendue.")
  if (parametres.exigibilite < approbation.date)
    throw new Error(
      `Exigibilité ${parametres.exigibilite} antérieure à l'approbation du ${approbation.date} : le solde définitif résulte de l'approbation (D. 1967 art. 45-1) ; annuler et relancer la répartition.`,
    )
}

/**
 * Impute une répartition enregistrée après l'approbation des comptes : le décompte devient définitif. Refuse une pièce
 * qui n'est pas « Enregistré », une approbation sans date, sans référence ou antérieure à la clôture, une exigibilité
 * antérieure à l'approbation, et tout lot dont le copropriétaire à l'approbation n'est pas celui du décompte (D. 1967
 * art. 6-2, 3° pour une mutation à titre onéreux, art. 45-1 pour une autre mutation : la répartition se rejoue,
 * annulation puis nouvelle répartition).
 */
export function imputerRepartition(
  repartition: RepartitionCharges,
  { approbation, positions }: { approbation: ApprobationComptes; positions: Position[] },
): RepartitionCharges {
  const piece = changerStatutPiece(repartition.piece, 'Imputé')
  verifierApprobation(approbation, repartition.parametres)
  const lots = lotsAReattribuer(repartition.regularisation, positions, approbation.date)
  if (lots.length > 0)
    throw new Error(
      `Imputation refusée : copropriétaire changé à l'approbation du ${approbation.date} pour ${lots.join(', ')} ; le trop ou moins perçu va au copropriétaire lors de l'approbation (D. 1967 art. 6-2, 3° pour une mutation à titre onéreux ; art. 45-1 pour une autre mutation, le solde définitif résultant de l'approbation) ; annuler et relancer la répartition avec les copropriétaires à cette date.`,
    )
  return { ...repartition, piece, approbation: { date: approbation.date, reference: approbation.reference.trim() } }
}

/**
 * Annule une répartition enregistrée (tranche 43 § 6) : pièce « Annulé » et pièce d'annulation (écriture contraire),
 * du mandat de la répartition par défaut. Date comptable : la clôture (date de la répartition), seule admise ; date
 * d'effet (dateEffet) : le jour de l'annulation, obligatoire, jamais antérieure à la date de passage de la répartition,
 * portée par la ligne 1 des paramètres de la pièce d'annulation. Les deux règles sont celles de
 * journal-traitements.annulerPiece, qui les applique à toute annulation d'une répartition. Une répartition imputée ne
 * s'annule pas ; l'annulation a son propre identifiant.
 */
export function annulerRepartition(
  repartition: RepartitionCharges,
  {
    id,
    numero,
    dateEffet,
    date = repartition.parametres.au,
    mandatId,
    verrou,
  }: { id: string; numero: number; dateEffet: string; date?: string; mandatId?: string } & OptionsTraitement,
): { repartition: RepartitionCharges; annulation: PieceTraitement } {
  const { piece, annulation } = annulerPiece(repartition.piece, {
    id,
    numero,
    date,
    dateEffet,
    segmentSyndicat: repartition.segmentSyndicat,
    mandatId,
    verrou,
  })
  return { repartition: { ...repartition, piece }, annulation }
}

/** Statut de l'exercice qui suit la pièce de répartition (🔵 ; cycle de exercices-budgets.changerStatutExercice). */
const STATUT_EXERCICE_PAR_STATUT_PIECE: Partial<Record<StatutPiece, StatutExercice>> = {
  Enregistré: 'Répart. en cours',
  Annulé: 'Répart. en cours',
  Imputé: 'Réparti',
}

/** « Répart. en cours » tant que la répartition est enregistrée ou annulée (à relancer), « Réparti » une fois imputée. */
export function statutExerciceApresRepartition(statut: StatutPiece): StatutExercice {
  const statutExercice = STATUT_EXERCICE_PAR_STATUT_PIECE[statut]
  if (!statutExercice) throw new Error(`Statut « ${statut} » : pas celui d'une pièce de répartition.`)
  return statutExercice
}

// ─── Décompte individuel et appel de régularisation ─────────────────────────────────────────

export type EtatDecompte = 'projet' | 'definitif' | 'annule'

const ETAT_PAR_STATUT: Partial<Record<StatutPiece, EtatDecompte>> = { Enregistré: 'projet', Imputé: 'definitif', Annulé: 'annule' }

/** Projet (pièce enregistrée, D. 1967 art. 11, II, 5°), définitif (imputée, après approbation) ou annulé. */
export function etatDecompte(repartition: Pick<RepartitionCharges, 'piece'>): EtatDecompte {
  const etat = ETAT_PAR_STATUT[repartition.piece.statut]
  if (!etat) throw new Error(`Pièce n° ${repartition.piece.numero} au statut « ${repartition.piece.statut} » : pas une répartition.`)
  return etat
}

function exigerDefinitif(repartition: RepartitionCharges, quoi: string): void {
  if (etatDecompte(repartition) !== 'definitif')
    throw new Error(
      `${quoi} de l'exercice ${repartition.exercice} : répartition imputée attendue (comptes approuvés) ; une répartition enregistrée ne donne qu'un projet de décompte (D. 1967 art. 11, II, 5°).`,
    )
}

/** Libellés des deux écritures par copropriétaire (tranche 43 § 7 ; Gestéam suffixe la seconde du nom de l'immeuble). */
export const libellesRegularisation = (exercice: string) => ({
  remboursement: `Remboursement de provisions ${exercice}`,
  repartition: `Répartition des dépenses ${exercice}`,
})

export interface DecompteDiffusable extends DecompteIndividuel {
  etat: EtatDecompte
  exercice: string
  du: string
  au: string
  exigibilite: string
  justificationExigibilite: string
  libelles: ReturnType<typeof libellesRegularisation>
}

/** Décomptes individuels de la répartition, un par compte, avec leur état et l'exigibilité justifiée du solde. */
export function decomptesIndividuels(repartition: RepartitionCharges): DecompteDiffusable[] {
  const etat = etatDecompte(repartition)
  const { du, au, exigibilite } = repartition.parametres
  const justification = justificationExigibilite(repartition.parametres, repartition.approbation)
  const libelles = libellesRegularisation(repartition.exercice)
  return repartition.regularisation.decomptes.map((d) => ({
    ...d,
    etat,
    exercice: repartition.exercice,
    du,
    au,
    exigibilite,
    justificationExigibilite: justification,
    libelles,
  }))
}

export type SensSolde = 'a_payer' | 'a_rembourser' | 'nul'

export function sensDuSolde(soldeCentimes: number): SensSolde {
  if (soldeCentimes > 0) return 'a_payer'
  if (soldeCentimes < 0) return 'a_rembourser'
  return 'nul'
}

export interface AppelRegularisation extends DecompteDiffusable {
  sens: SensSolde
  soldeAnterieurCentimes: number
  /** Solde antérieur + solde de régularisation. */
  totalCentimes: number
}

/**
 * Appels de régularisation, un par compte : solde de régularisation exigible à la date des paramètres, solde antérieur
 * repris. Seulement pour une répartition imputée (comptes approuvés) ; avant, le décompte n'est qu'un projet.
 */
export function appelsRegularisation(
  repartition: RepartitionCharges,
  { soldesAnterieurs = {} }: { soldesAnterieurs?: Readonly<Record<string, number>> } = {},
): AppelRegularisation[] {
  exigerDefinitif(repartition, 'Appel de régularisation')
  return decomptesIndividuels(repartition).map((d) => {
    const soldeAnterieurCentimes = soldesAnterieurs[d.compteId] ?? 0
    return { ...d, sens: sensDuSolde(d.soldeCentimes), soldeAnterieurCentimes, totalCentimes: soldeAnterieurCentimes + d.soldeCentimes }
  })
}

/**
 * Postes de dette du solde de régularisation (entrée de imputation-encaissements) : un par compte dont le solde est dû,
 * sans appel d'origine (appelId null : ce n'est pas une échéance de l'échéancier, le montant est déjà par compte),
 * exigible à la date des paramètres. L'excédent ne fait pas de poste : il reste au crédit du 450. Seulement pour une
 * répartition imputée (D. 1967 art. 45-1 : le solde définitif résulte de l'approbation ; J3 : éligibilité au 19-2 après
 * l'approbation).
 */
export function postesRegularisation(repartition: RepartitionCharges): PosteDette[] {
  exigerDefinitif(repartition, 'Poste de régularisation')
  return repartition.regularisation.decomptes
    .filter((d) => d.soldeCentimes > 0)
    .map((d) => ({
      id: `${repartition.piece.id}:${d.compteId}`,
      compteId: d.compteId,
      appelId: null,
      typeAppel: null,
      libelle: `Régularisation des charges ${repartition.exercice}`,
      exigibilite: repartition.parametres.exigibilite,
      montantCentimes: d.soldeCentimes,
      regleCentimes: 0,
      contentieux: false,
    }))
}
