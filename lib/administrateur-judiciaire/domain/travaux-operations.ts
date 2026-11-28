import { ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { PouvoirsAgConfies } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import {
  AFFECTATION_FONDS_TRAVAUX,
  controlerAffectationFondsTravaux,
  type DecaissementFondsTravaux,
  type ObjetDecaissementFondsTravaux,
  type ResultatAffectation,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import type { EmploiFondsEcheance } from '@/lib/administrateur-judiciaire/domain/avis-appel'
import { annulerAvantAppel, type EcheanceAppelSuivie, type StatutEcheanceAppel } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
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
 * Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67 : recommandations validées en bloc ; textes
 * relus sur Légifrance le 17/11/2026 : arrêté du 14 mars 2005, art. 3, 7, 8 et 10 ; D. 1967 art. 44, 62-7 et 62-8 ; L.
 * 1965 art. 29-1, I et 14-2-1, I, al. 7) :
 * - J67, R60 : une opération qui n'est qu'une étude (diagnostic, DTG, audit, projet de plan de travaux : D. 1967 art.
 *   44, 4° ; champ etude) porte ses charges au 67300 « Etudes techniques, diagnostic, consultation » de l'opération, à la
 *   place du 67100 (arrêté, art. 7 et 8 : même subdivision par opération) ; compteDeChargeDeLOperation rend le compte de
 *   charge (relevé Gestéam à faire : le compte de ces opérations dans la reprise) ;
 * - J67, R61 : l'appel de travaux crédite le 10200 de l'opération (arrêté, art. 10 : 102 « crédité des provisions
 *   appelées par le débit du compte 450 » ; type Gestéam « Travaux - Appels »), et non plus le 70200 ; à chaque charge,
 *   virementProvisionsTravauxALaRealisation vire du 102 au 702 le même montant, dans la limite du 102 (pas encore appelé
 *   à l'écriture des factures : branchement ci-dessous ; d'ici là, le 702 de l'opération reste à zéro) ; en fin
 *   d'exercice, soldeTravauxEnFinDExercice passe au 12000 le solde des charges et des produits d'une opération non
 *   clôturée, chaque compte de produits de la série (702, 71147) débité de son propre solde, et
 *   repriseSoldeTravauxALOuverture le reprend à l'ouverture (écriture contraire, famille « Report de soldes
 *   comptables ») ; relevé Gestéam à faire : le compte crédité par un appel de travaux (s'il crédite le 702, écart de
 *   reprise à signaler à Hugo) ;
 * - J67, R81 : la décision de l'administrateur provisoire tient lieu d'affectation du fonds de travaux à l'opération
 *   (art. 14-2-1, I, al. 7) s'il a reçu de l'ordonnance les pouvoirs de l'assemblée (art. 29-1, I, al. 2) : étendue
 *   saisie sur la décision (pouvoirsAgConfies) ; aucun pouvoir, ou étendue non saisie : refus, il faut un vote de
 *   l'assemblée ou une ordonnance de l'art. 29-14, 2° ; une partie : admise, à vérifier dans l'ordonnance
 *   (pouvoirsDeLAffectationParLAdministrateur) ; l'avis du conseil syndical (D. 1967 art. 62-7) et le registre (art.
 *   62-8) restent les conditions de cette décision.
 *
 * Décisions du 20/11/2026 (partie C du relevé des questions ouvertes du code, recommandations acceptées par le
 * responsable du projet) :
 * - Décision du 20/11/2026 (partie C, F65) : la part du fonds de travaux de chaque clé se compare, dès la décision
 *   (création ou adoption de l'opération), au fonds disponible des lots de la clé (versé, moins les emplois déjà faits),
 *   par une alerte, jamais un blocage : « part de la clé supérieure au fonds disponible de ses lots au [date] »
 *   (fonds-travaux-lots.ts, alertesPartsDesClesAuFondsDisponible, sur l'état des parts à la date de la décision) ; les
 *   cotisations continuent d'arriver d'ici l'emploi (art. 14-2-1, I, al. 7 : l'affectation tient compte des clés de
 *   répartition) ; au décaissement, le contrôle actuel reste inchangé ;
 * - Décision du 20/11/2026 (partie C, F66) : (1) une opération reprise déjà répartie se crée à « Réparti » seulement en
 *   mode « reprise » (repriseRepartie) : motif obligatoire et référence de la répartition d'origine (exercice, date,
 *   assemblée qui a approuvé les comptes), sans aucune écriture ; la répartition ne se fait qu'à la clôture définitive de
 *   l'opération (D. 2005-240 art. 8) et a déjà eu lieu chez l'ancien syndic : la refaire créerait une fausse écriture
 *   (J2) ; (2) une adoption saisie par erreur s'annule par une annulation tracée (annulerAdoptionOperationTravaux : motif,
 *   date, auteur), seulement si l'opération n'a ni appel, ni règlement, ni emploi du fonds (actes fournis par
 *   l'appelant) ; sinon refus, il faut d'abord annuler ces actes (J2 : annuler, c'est créer une ligne, jamais effacer) ;
 * - Décision du 20/11/2026 (partie C, F67) : une résolution annulée en justice ou rapportée par une nouvelle assemblée
 *   fait passer l'opération à « Rejeté » par une transition tracée depuis « Adopté », « Commandé » ou « Commencé »
 *   (rejeterOperationTravauxAdoptee), avec un motif et la référence de l'acte (jugement : juridiction, date, n° ; ou
 *   assemblée et n° de résolution) : plus aucun appel ni ordre de service (refusAppelOuOrdreDeServiceOperation, appliqué
 *   par echeancesTravaux, le suivi « à faire » de suivi-a-faire.ts et controlerAvantEnvoiOs d'envoi-ordre-service.ts
 *   quand l'opération de l'OS est fournie), échéances non appelées annulées (annulerEcheancesNonAppeleesDeLOperation),
 *   écritures passées gardées, dépenses faites à régler et à répartir (la décision reste enregistrée). Depuis « Terminé »,
 *   « A clôturer » ou « Réparti », pas de passage automatique : une alerte à traiter par le gestionnaire du dossier, les
 *   travaux étant faits (contestation : L. 1965 art. 42, al. 2) ;
 * - Décision du 20/11/2026 (partie C, F69) : (1) le mandat porte l'étendue des pouvoirs de l'assemblée confiés par
 *   l'ordonnance (tous, une partie, aucun ; D. 1967 art. 62-5 ; L. 1965 art. 29-1, I) : une décision de l'administrateur
 *   provisoire « au titre des pouvoirs de l'AG » est bloquée s'il n'en a aucun et donne l'alerte « à vérifier dans
 *   l'ordonnance » s'il n'en a qu'une partie (controlerPouvoirsDecisionTravaux ; creerOperationTravaux et
 *   adopterOperationTravaux refusent la première, ContexteMandatTravaux) ; (2) pour la majorité, une aide sans blocage :
 *   la majorité habituelle du type de travaux, et une alerte si la majorité saisie est plus faible
 *   (aideMajoriteDesTravaux, NATURES_JURIDIQUES_TRAVAUX ; une erreur de majorité rend la résolution contestable dans le
 *   délai, elle ne l'annule pas d'office).
 *
 * Règles :
 * - statut de l'opération typé sur STATUT_TRAVAUX, distinct du statut de chaque tranche (statutsDesTranches, typé sur
 *   les statuts d'échéance d'echeancier-appels.ts) ; type typé sur TYPE_TRAVAUX ;
 * - « Adopté » exige la décision (date, résolution) : tout statut du cycle à partir d'« Adopté » la porte, « Projet »
 *   jamais, « Rejeté » seulement quand une décision adoptée est tombée (F67) ; l'adoption s'enregistre avec sa décision,
 *   à sa date (adopterOperationTravaux, ou la création), et s'annule à part (annulerAdoptionOperationTravaux, F66) ;
 * - la création trace son statut comme un changement : l'adoption à la date de la décision ; un statut saisi au-delà
 *   d'« Adopté » (reprise d'une opération engagée) ou « Rejeté » porte sa date et son motif (changementStatut), aux
 *   règles des transitions (J2 : un saut d'étape se motive et reste tracé, à la reprise aussi) ;
 * - « Réparti » suit la répartition : posé par le traitement « Répartition de charges » qui mouvemente l'opération au
 *   segment de son syndicat (D1), daté au plus tôt de la décision, depuis « A clôturer » seulement (D. 2005-240 art. 8),
 *   une seule fois par traitement, retiré par son annulation, datée au plus tôt de la répartition qu'elle contre-passe ;
 *   à la création, seulement en mode « reprise », sans écriture (F66) ;
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
 * - série de comptes générée à la création : 10200, 12000, 67100 (67300 pour une étude, J67, R60), 70200, 71147,
 *   auxiliaire = n° d'opération (règle « No des travaux ») ; les appels sont crédités au 10200 (J67, R61), sur
 *   l'auxiliaire de l'opération (traitementAppelDeFondsTravaux, qui
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
 * - statut par défaut : « Adopté » avec une décision, « Projet » sans ; « Rejeté » depuis « Projet » avec son motif
 *   (changerStatutOperationTravaux), ou depuis « Adopté », « Commandé » ou « Commencé » quand la décision tombe (F67) ;
 *   « Réparti » et « Rejeté » sont définitifs, sans changement en avant : « Réparti » ne se quitte que par
 *   l'annulation de sa répartition (annulerRepartitionOperation), « Rejeté » que par l'annulation tracée du rejet
 *   (annulerDernierChangementStatut) ; une création à « Réparti » en mode « reprise » (F66), sans répartition, par
 *   l'annulation tracée de la reprise (annulerDernierChangementStatut) ;
 * - ventilation d'un appel entre plusieurs clés : au prorata du montant à appeler de chaque clé (budget de la clé − part
 *   du fonds de travaux de la clé), une seule grille d'appels dans Gestéam ; identifiant « <n°>-T<tranche> » avec une
 *   seule clé (inchangé), « <n°>-T<tranche>-C<rang de la clé> » avec plusieurs ;
 * - référence de la décision qui affecte le fonds, à défaut d'une décision distincte : « <résolution> (AG du <date>) »
 *   pour l'assemblée, « <référence au registre> (décision de l'administrateur provisoire du <date>) » pour
 *   l'administrateur provisoire (D. 1967 art. 62-8 : registre des décisions, sans assemblée) ;
 * - statut d'une tranche : celui de ses échéances (« Prévu » sans suivi, défaut d'echeancier-appels.ts) ; null quand les
 *   clés divergent ;
 * - règlement « réglé » : enregistré ou rapproché ; « en cours » : demandé ou à régler ; annulé ou rejeté : exclu ;
 * - « Encaissements effectués » d'une tranche : réglé des postes de dette dont l'échéance d'origine est une échéance de
 *   la tranche ; les postes fournis sont ceux du syndicat de l'opération (D1) ;
 * - historique : l'annulation et le traitement de répartition, sans colonne dans la table ChangementStatut, sont repris
 *   dans le motif ;
 * - virement du 102 au 702 (virementProvisionsTravauxALaRealisation) : ses deux lignes portent la clé de la charge virée
 *   (attributs.cle), à donner pour une opération sur plusieurs clés, la clé unique de l'opération sinon ; une clé
 *   étrangère à l'opération est refusée. Les deux balances, par comptes et par clés, sont « en concordance » (arrêté du 14
 *   mars 2005, art. 2) : un 702 sans clé n'aurait pas de place dans la balance par clés, et les annexes 4 et 5
 *   (comptes-syndicat-annexes.ts) le présenteraient « sans clé de répartition » (relecture des annexes du 20/11/2026).
 * 🔴 Non établi (questions pour Frédéric ou Hugo) :
 * - « Le solde en attente d'une opération va-t-il au 12000 (série "120xx" de Gestéam) ou à la subdivision 12-1 "Travaux
 *   décidés par l'assemblée générale" ? » (VitFix : 12000) ; « Le 71147 de l'opération s'ouvre-t-il à sa création ou à
 *   la première subvention notifiée ? » (VitFix : à la création) ;
 * - « Un appel d'une opération sur plusieurs clés se ventile-t-il au prorata du montant à appeler de chaque clé (budget
 *   de la clé − part du fonds de travaux de la clé) ? » (VitFix : oui) ;
 * - « Les travaux urgents (L. 1965 art. 18, I ; D. 1967 art. 37 ; compte 672 "Travaux urgents" ; Gestéam "Appel travaux
 *   urgents" et "Travaux urgents - Provisions") forment-ils une filière distincte de l'opération décidée ? » (VitFix :
 *   oui, hors de ce module, qui n'admet ni statut décidé ni appel sans décision ; provision au tiers du devis non codée,
 *   demandes.ts) ;
 * - reste de F69 : « Avec une étendue des pouvoirs non saisie au mandat (null), la décision de travaux de
 *   l'administrateur provisoire est-elle refusée, comme l'affectation du fonds (J67, R81), ou admise avec une alerte, comme
 *   l'ordre de service (J67, R68) ? » (VitFix : alerte non bloquante, à confirmer : controlerPouvoirsDecisionTravaux) ;
 *   reste de F67 : « Une
 *   opération "Rejeté" dont les dépenses déjà faites restent à répartir passe-t-elle "Réparti" par sa répartition ? »
 *   (VitFix : non, constaterRepartitionOperation exige "A clôturer" ; l'opération reste "Rejeté", ses écritures restent
 *   possibles) ;
 * - « Quel statut donner à une tranche dont les clés n'ont pas le même statut d'échéance ? » (VitFix : null) ;
 * - « Que portent le bouton "À voter" et le champ "Approbation" du bloc Décision de la fiche ? » (non repris).
 * Branchements à faire hors de ce module (fichiers non modifiés) : appelant d'ecritureFactureVentilee (facture-ventilee.ts,
 * enregistrement d'une facture de l'opération) — pour chaque ligne au 671 ou au 673 de l'opération,
 * virementProvisionsTravauxALaRealisation, avec le solde du 102 de l'opération lu au grand livre (J67, R61) et la clé de
 * la ligne ; et
 * l'alerte des classes 61 et 62 (travaux-budget.ts, anomaliesComptesDesLignesDOperation, ou le suivi financier qui
 * reçoit les lignes des factures ; J67, R60) ; repartition-appels.ts — un champ
 * `auxiliaireContrepartie` de l'échéance, lu par traitementAppelDeFonds, rendrait traitementAppelDeFondsTravaux inutile ;
 * suivi-a-faire.ts, depuisOperationsTravaux — identifiants « -C<k> » des opérations sur plusieurs clés
 * (idsEcheancesDeLaTranche) dans la branche « fonds bloqué », et opérations hors « En cours » ignorées
 * (estOperationEnCours) ; fonds-travaux-lots.ts, emploiDepuisOperation — un emploi par clé (cles[k]) au lieu de
 * operation.cleId, et la référence de la décision par referenceDecisionTravaux (son « (AG du …) » vaut aussi pour une
 * décision de l'administrateur provisoire) ; db/schema.ts (Frédéric) — table Travaux : statut, type, cles, décision
 * (origine, majorité, second vote), serieComptes, historiqueStatuts (reprise, auteur et acte des changements : F66,
 * F67) ; mandat — étendue des pouvoirs de l'assemblée (pouvoirsAgDuMandat, F69), passée à creerOperationTravaux et
 * adopterOperationTravaux ; appelant de controlerAvantEnvoiOs (envoi-ordre-service.ts) — l'opération de l'OS
 * (budgetTravaux), sans quoi le refus de F67 n'y est pas lu ; EntiteAStatutHistorise complété de 'travaux'
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
  /**
   * Décision de l'administrateur provisoire : étendue des pouvoirs de l'assemblée que l'ordonnance lui confie à cette date
   * (L. 1965 art. 29-1, I, al. 2 ; D. 1967 art. 62-5 ; J67, R81) ; absente : non saisie. Sans objet pour l'assemblée.
   */
  pouvoirsAgConfies?: PouvoirsAgConfies | null
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
  /**
   * Mode « reprise » (décision du 20/11/2026, partie C, F66) : création à « Réparti » d'une opération déjà répartie par le
   * précédent gestionnaire, avec un motif obligatoire et la référence de la répartition d'origine, sans aucune écriture ;
   * réservé au statut « Réparti ». Absent : création ordinaire.
   */
  repriseRepartie?: RepriseRepartitionOrigine | null
  /**
   * Opération qui n'est qu'une étude (diagnostic, DTG, audit, projet de plan de travaux : D. 1967 art. 44, 4°) : ses
   * charges vont au 673 « Etudes techniques, diagnostic, consultation » de l'opération, au lieu du 671 (arrêté du 14 mars
   * 2005, art. 7 et 8 ; J67, R60) ; absente : non.
   */
  etude?: boolean | null
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
  /** F66 : référence de la répartition d'origine d'une opération reprise déjà répartie (création à « Réparti »). */
  reprise?: RepriseRepartitionOrigine
  /** F66 : auteur de l'annulation tracée d'une adoption saisie par erreur. */
  auteur?: string
  /** F67 : acte qui annule ou rapporte la décision des travaux (passage à « Rejeté » après l'adoption). */
  acte?: ActeAnnulationDecisionTravaux
}

/**
 * Répartition d'origine d'une opération reprise déjà répartie (décision du 20/11/2026, partie C, F66) : la répartition
 * ne se fait qu'à la clôture définitive de l'opération (D. 2005-240 art. 8) et a déjà eu lieu chez l'ancien syndic ; la
 * refaire créerait une fausse écriture (J2).
 */
export interface RepriseRepartitionOrigine {
  /** Motif de la reprise à « Réparti », obligatoire. */
  motif: string
  /** Exercice de la répartition d'origine (libellé, par exemple « 2025 »). */
  exercice: string
  /** Date de la répartition d'origine (AAAA-MM-JJ) : date du changement tracé. */
  date: string
  /** Assemblée qui a approuvé les comptes de cet exercice : sa date et, si elle est connue, la résolution. */
  assembleeApprobation: { date: string; resolution?: string | null }
}

/**
 * Acte qui fait tomber la décision des travaux (décision du 20/11/2026, partie C, F67) : jugement qui annule la
 * résolution (juridiction, date, n°), ou nouvelle assemblée qui la rapporte (date, n° de la résolution).
 */
export type ActeAnnulationDecisionTravaux =
  | { nature: 'jugement'; juridiction: string; date: string; numero: string }
  | { nature: 'assemblee'; dateAg: string; numeroResolution: string }

export const ROLES_COMPTES_TRAVAUX = [
  'provisionsTravauxDecides',
  'soldeEnAttente',
  'travauxDecides',
  'etudesTechniques',
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

/**
 * Compte crédité par l'appel de travaux : le 102 de l'opération, « crédité des provisions appelées par le débit du compte
 * 450 » (arrêté du 14 mars 2005, art. 10 ; J67, R61), viré au 702 au fur et à mesure des charges.
 */
const COMPTE_APPEL_TRAVAUX = '10200'

/** Compte de charge d'une opération qui n'est qu'une étude, à la place du 671 (arrêté, art. 7 ; J67, R60). */
const COMPTE_ETUDES_TECHNIQUES = { role: 'etudesTechniques', planCode: '67300', intitule: 'Etudes techniques, diagnostic, consultation' } as const

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

const POUVOIRS_AG_CONNUS: ReadonlySet<string> = new Set<PouvoirsAgConfies>(['tous', 'partie', 'aucun'])

/**
 * Décision : date et résolution ; majorité et second vote pour l'assemblée seulement ; étendue des pouvoirs de
 * l'assemblée connue, pour l'administrateur provisoire seulement (J67, R81).
 */
function verifierDecision(decision: DecisionTravaux, numero: string): void {
  if (!estDateIsoValide(decision.date) || !decision.resolution.trim())
    throw new Error('Décision incomplète (assemblée ou administrateur provisoire) : date (AAAA-MM-JJ) et résolution ou référence au registre attendues.')
  const origine = decision.origine ?? 'assemblee'
  if (!ORIGINES_DECISION.has(origine)) throw new Error(`Opération ${numero} : origine de décision inconnue « ${origine} ».`)
  const pouvoirs = decision.pouvoirsAgConfies ?? null
  if (pouvoirs !== null && !POUVOIRS_AG_CONNUS.has(pouvoirs))
    throw new Error(`Opération ${numero} : étendue des pouvoirs inconnue « ${pouvoirs} » (tous, partie ou aucun).`)
  if (origine === 'assemblee') {
    if (pouvoirs !== null) throw new Error(`Opération ${numero} : pouvoirs de l'assemblée confiés à l'administrateur provisoire, sans objet pour une décision de l'assemblée.`)
    verifierMajoriteDecision(decision, numero)
  } else if (decision.majorite || decision.secondVote)
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
        `Opération ${numero} « ${statut} » : seul un projet est rejeté ici. Décision annulée en justice (L. 1965 art. 42, al. 2) ou rapportée par une nouvelle assemblée : rejeterOperationTravauxAdoptee, avec le motif et la référence de l'acte (décision du 20/11/2026, partie C, F67).`,
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
 * annulée en justice ou rapportée par une nouvelle assemblée passe par rejeterOperationTravauxAdoptee (décision du
 * 20/11/2026, partie C, F67).
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

/**
 * Adoption d'un projet : enregistre la décision (date, résolution, majorité) et passe « Adopté » à sa date. `contexte` :
 * l'étendue des pouvoirs de l'assemblée portée par le mandat ; une décision de l'administrateur provisoire sans aucun de
 * ces pouvoirs est refusée (décision du 20/11/2026, partie C, F69 : controlerPouvoirsDecisionTravaux).
 */
export function adopterOperationTravaux(operation: OperationTravaux, decision: DecisionTravaux, contexte: ContexteMandatTravaux = {}): OperationTravaux {
  if (operation.statut !== 'Projet') throw new Error(`Opération ${operation.numero} « ${operation.statut} » : seul un projet s'adopte.`)
  verifierDecision(decision, operation.numero)
  verifierPouvoirsDuMandat(decision, contexte)
  const adoptee = { ...operation, decision }
  verifierMajoriteAffectation(adoptee)
  return ajouterChangement(adoptee, changementAdoption(decision.date))
}

const CODES_SERIE: ReadonlySet<string> = new Set([...SERIE_COMPTES_TRAVAUX.map((c) => c.planCode), COMPTE_ETUDES_TECHNIQUES.planCode])

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
 * (chacune remonte d'un changement en vigueur). Ni la répartition (annulerRepartitionOperation), ni l'adoption, qui porte
 * la décision (annulerAdoptionOperationTravaux, F66) ; un rejet erroné, ou une reprise à « Réparti » erronée (F66), s'annule
 * ici. L'annulation est datée de la correction, au plus tôt à la date du statut qu'elle rétablit ; ensuite, la date vraie
 * du changement corrigé se saisit, même antérieure à la date erronée.
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
    throw new Error(
      `Opération ${numero} : l'adoption porte la décision ; elle s'annule par annulerAdoptionOperationTravaux (motif, date, auteur ; sans appel, règlement ni emploi du fonds : décision du 20/11/2026, partie C, F66).`,
    )
  const motifDuRetour = motifSaisi(motif)
  if (!motifDuRetour) throw new Error(`Opération ${numero} : motif de l'annulation exigé.`)
  return ajouterChangement(operation, { vers: enVigueur.de, le, motif: motifDuRetour, horsSequence: false, annulation: true, traitementId: null })
}

/**
 * Actes déjà faits pour l'opération, fournis par l'appelant (décision du 20/11/2026, partie C, F66) : le domaine ne garde
 * ni les échéances suivies, ni les règlements, ni les emplois du fonds d'une opération.
 */
export interface ActesDeLOperation {
  /** Échéances suivies du syndicat (echeancier-appels.ts) : celles de l'opération « Appelé » sont des appels. */
  suivies: readonly EcheanceAppelSuivie[]
  /** Règlements fournisseurs du syndicat : ceux de l'opération, non annulés. */
  reglements: readonly Pick<ReglementFournisseur, 'id' | 'coproprieteId' | 'travauxId' | 'statut'>[]
  /** Emplois du fonds de travaux du syndicat (fonds-travaux-lots.ts) : ceux de l'opération. */
  emplois: readonly { id: string; operationNumero: string | null }[]
}

/** Appels, règlements non annulés et emplois du fonds de l'opération (même syndicat, D1), décrits pour le motif ; [] sinon. */
function actesFaitsDeLOperation(operation: OperationTravaux, { suivies, reglements, emplois }: ActesDeLOperation): string[] {
  const { coproprieteId, numero } = operation
  const echeances: ReadonlySet<string> = new Set(lignesAppel(operation).map((l) => l.id))
  const groupes: [string, string[]][] = [
    ['appel', suivies.filter((e) => e.coproprieteId === coproprieteId && echeances.has(e.id) && e.statut === 'Appelé').map((e) => e.id)],
    ['règlement', reglements.filter((r) => r.coproprieteId === coproprieteId && r.travauxId === numero && r.statut !== 'Annulé').map((r) => r.id)],
    ['emploi du fonds de travaux', emplois.filter((e) => e.operationNumero === numero).map((e) => e.id)],
  ]
  return groupes.filter(([, ids]) => ids.length > 0).map(([nature, ids]) => `${nature} (${ids.join(', ')})`)
}

/**
 * Annulation tracée d'une adoption saisie par erreur (décision du 20/11/2026, partie C, F66 ; J2 : annuler, c'est créer
 * une ligne, jamais effacer) : motif, date et auteur obligatoires ; seulement si l'opération n'a encore ni appel, ni
 * règlement, ni emploi du fonds (`actes`, fournis par l'appelant) ; sinon refus, il faut d'abord annuler ces actes.
 * L'adoption doit être le dernier changement en vigueur (les changements suivants s'annulent d'abord :
 * annulerDernierChangementStatut). L'opération revient à « Projet », sans décision ; l'historique garde l'adoption et
 * son annulation, avec la référence de la décision annulée. Une nouvelle adoption se saisit ensuite, à sa vraie date.
 */
export function annulerAdoptionOperationTravaux(
  operation: OperationTravaux,
  { le, motif, auteur }: { le: string; motif: string; auteur: string },
  actes: ActesDeLOperation,
): OperationTravaux {
  const { numero, statut, decision } = operation
  const enVigueur = dernierChangementEnVigueur(operation)
  if (statut !== 'Adopté' || !decision || enVigueur?.de !== 'Projet')
    throw new Error(
      `Opération ${numero} « ${statut} » : seule l'adoption encore en vigueur s'annule ici ; annuler d'abord les changements qui la suivent (annulerDernierChangementStatut).`,
    )
  const motifDuRetour = motifSaisi(motif)
  if (!motifDuRetour) throw new Error(`Opération ${numero} : motif de l'annulation de l'adoption exigé.`)
  const auteurSaisi = auteur.trim()
  if (!auteurSaisi) throw new Error(`Opération ${numero} : auteur de l'annulation de l'adoption exigé.`)
  const faits = actesFaitsDeLOperation(operation, actes)
  if (faits.length > 0)
    throw new Error(
      `Opération ${numero} : adoption non annulée, l'opération a déjà ${faits.join(', ')} ; annuler d'abord ces actes (décision du 20/11/2026, partie C, F66).`,
    )
  const annulee = ajouterChangement(operation, {
    vers: 'Projet',
    le,
    motif: `Annulation de l'adoption (${referenceDecisionTravaux(decision)}) — ${motifDuRetour}`,
    horsSequence: false,
    annulation: true,
    traitementId: null,
    auteur: auteurSaisi,
  })
  return { ...annulee, decision: null }
}

// ─── Décision annulée en justice ou rapportée (décision du 20/11/2026, partie C, F67) ─────────

/** Statuts d'où une décision qui tombe fait passer l'opération à « Rejeté » (F67). */
const STATUTS_REJETABLES_APRES_ADOPTION: ReadonlySet<StatutTravaux> = new Set<StatutTravaux>(['Adopté', 'Commandé', 'Commencé'])

/** Contestation des décisions d'assemblée (L. 1965 art. 42, al. 2), citée pour le passage à « Rejeté » (F67). */
const FONDEMENT_CONTESTATION = 'L. 1965 art. 42, al. 2'

/** Alerte d'une décision qui tombe alors que les travaux sont faits (« Terminé », « A clôturer », « Réparti ») : F67. */
export interface AlerteDecisionTravauxAnnulee {
  code: 'decision_annulee_travaux_faits'
  operationNumero: string
  statut: StatutTravaux
  message: string
  fondement: string
}

function texteDeLActe(valeur: string, libelle: string): string {
  const texte = valeur.trim()
  if (!texte) throw new Error(`Acte qui annule ou rapporte la décision des travaux : ${libelle} attendu.`)
  return texte
}

/** Acte lu : sa date et sa désignation ; refus d'un champ vide ou d'une date invalide. */
function lireActeAnnulation(acte: ActeAnnulationDecisionTravaux): { date: string; designation: string } {
  if (acte.nature === 'jugement') {
    const juridiction = texteDeLActe(acte.juridiction, 'juridiction du jugement')
    verifierDate(acte.date, 'Date du jugement')
    const numero = texteDeLActe(acte.numero, 'n° du jugement')
    return { date: acte.date, designation: `jugement n° ${numero} du ${dateIsoVersFr(acte.date)}, ${juridiction}` }
  }
  if (acte.nature === 'assemblee') {
    verifierDate(acte.dateAg, "Date de l'assemblée qui rapporte la décision")
    const resolution = texteDeLActe(acte.numeroResolution, 'n° de la résolution')
    return { date: acte.dateAg, designation: `résolution n° ${resolution} de l'assemblée du ${dateIsoVersFr(acte.dateAg)}` }
  }
  throw new Error('Acte qui annule ou rapporte la décision des travaux : nature inconnue (jugement ou assemblée).')
}

/** L'acte suit la décision qu'il fait tomber ; le passage à « Rejeté » ne le précède pas. */
function verifierDatesDuRejet({ numero, decision }: OperationTravaux, le: string, acte: { date: string; designation: string }): void {
  if (decision && acte.date < decision.date)
    throw new Error(`Opération ${numero} : ${acte.designation} antérieur à la décision du ${dateIsoVersFr(decision.date)} qu'il ferait tomber.`)
  if (le < acte.date) throw new Error(`Opération ${numero} : passage à « Rejeté » au ${dateIsoVersFr(le)}, avant l'acte (${acte.designation}).`)
}

/**
 * Résolution de travaux annulée en justice ou rapportée par une nouvelle assemblée (décision du 20/11/2026, partie C,
 * F67 ; L. 1965 art. 42, al. 2 : une résolution annulée ne fonde plus l'opération). Depuis « Adopté », « Commandé » ou
 * « Commencé » : passage tracé à « Rejeté », avec un motif obligatoire et la référence de l'acte (jugement : juridiction,
 * date, n° ; ou assemblée et n° de résolution) ; la décision reste enregistrée (les écritures passées restent, les
 * dépenses faites restent à régler et à répartir), mais l'opération n'admet plus aucun appel ni ordre de service
 * (refusAppelOuOrdreDeServiceOperation) et ses échéances non appelées s'annulent
 * (annulerEcheancesNonAppeleesDeLOperation). Depuis « Terminé », « A clôturer » ou « Réparti » : pas de passage
 * automatique, l'opération est rendue telle quelle avec une alerte à traiter par le gestionnaire (travaux faits). Un
 * projet se rejette par changerStatutOperationTravaux.
 */
export function rejeterOperationTravauxAdoptee(
  operation: OperationTravaux,
  { le, motif, acte }: { le: string; motif: string; acte: ActeAnnulationDecisionTravaux },
): { operation: OperationTravaux; alerte: AlerteDecisionTravauxAnnulee | null } {
  const { numero, statut } = operation
  if (statut === 'Projet' || statut === 'Rejeté')
    throw new Error(`Opération ${numero} « ${statut} » : sans décision en vigueur ; un projet se rejette par changerStatutOperationTravaux.`)
  const motifDuRejet = motifSaisi(motif)
  if (!motifDuRejet) throw new Error(`Opération ${numero} : motif du passage à « Rejeté » exigé.`)
  const lu = lireActeAnnulation(acte)
  if (!STATUTS_REJETABLES_APRES_ADOPTION.has(statut)) {
    const message = `Opération ${numero} « ${statut} » : travaux faits ; pas de passage automatique à « Rejeté » après ${lu.designation} (${motifDuRejet}) : alerte à traiter par le gestionnaire du dossier (décision du 20/11/2026, partie C, F67).`
    return { operation, alerte: { code: 'decision_annulee_travaux_faits', operationNumero: numero, statut, message, fondement: FONDEMENT_CONTESTATION } }
  }
  verifierDatesDuRejet(operation, le, lu)
  const rejete = ajouterChangement(operation, {
    vers: 'Rejeté',
    le,
    motif: `${motifDuRejet} — ${lu.designation} (décision du 20/11/2026, partie C, F67)`,
    horsSequence: false,
    annulation: false,
    traitementId: null,
    acte: { ...acte },
  })
  return { operation: rejete, alerte: null }
}

/**
 * Refus d'un nouvel appel ou d'un ordre de service pour une opération « Rejeté » (décision du 20/11/2026, partie C,
 * F67) : la décision qui la fondait est tombée, ou le projet a été rejeté ; null sinon. echeancesTravaux, le suivi « à
 * faire » (suivi-a-faire.ts) et controlerAvantEnvoiOs (envoi-ordre-service.ts, opération de l'OS fournie) l'appliquent.
 */
export function refusAppelOuOrdreDeServiceOperation(operation: Pick<OperationTravaux, 'numero' | 'statut'>): { motif: string; fondement: string } | null {
  if (operation.statut !== 'Rejeté') return null
  return {
    motif: `Opération ${operation.numero} « Rejeté » : plus aucun appel ni ordre de service pour l'opération ; les écritures passées restent, les dépenses déjà faites restent à régler et à répartir (décision du 20/11/2026, partie C, F67).`,
    fondement: FONDEMENT_CONTESTATION,
  }
}

/**
 * Échéances non appelées (« Prévu », « En attente ») de l'opération « Rejeté » annulées, sans écriture (annulerAvantAppel,
 * echeancier-appels.ts) ; les échéances appelées restent, leurs écritures aussi ; celles d'une autre opération ou d'un
 * autre syndicat (D1) sont inchangées (décision du 20/11/2026, partie C, F67).
 */
export function annulerEcheancesNonAppeleesDeLOperation<E extends EcheanceAppelSuivie>(operation: OperationTravaux, suivies: readonly E[]): E[] {
  if (operation.statut !== 'Rejeté')
    throw new Error(`Opération ${operation.numero} « ${operation.statut} » : seules les échéances d'une opération « Rejeté » s'annulent ici (F67).`)
  const ids: ReadonlySet<string> = new Set(lignesAppel(operation).map((l) => l.id))
  const nonAppelee = (e: E): boolean => e.statut === 'Prévu' || e.statut === 'En attente'
  return suivies.map((e) => (e.coproprieteId === operation.coproprieteId && ids.has(e.id) && nonAppelee(e) ? annulerAvantAppel(e) : e))
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

/**
 * Motif historisé : l'annulation, le traitement et l'auteur d'une annulation d'adoption (F66), sans colonne propre dans
 * la table, y sont repris ; la référence d'une reprise (F66) ou de l'acte d'un rejet (F67) est déjà dans le motif.
 */
function motifAHistoriser({ annulation, motif, traitementId, auteur }: ChangementStatutTravaux): string | null {
  const parties = [annulation ? 'Annulation' : null, motif, traitementId ? `traitement ${traitementId}` : null, auteur ? `par ${auteur}` : null].filter(
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

export const FONDEMENT_POUVOIRS_AG = 'L. 1965 art. 29-1, I, al. 2'

/** Pouvoirs de l'assemblée de l'administrateur provisoire, pour l'affectation du fonds par sa décision (J67, R81). */
const POUVOIRS_DE_L_AFFECTATION: Readonly<Record<PouvoirsAgConfies | 'inconnue', { refuse: boolean; constat: string } | null>> = {
  tous: null,
  partie: {
    refuse: false,
    constat:
      "l'ordonnance confie à l'administrateur provisoire une partie des pouvoirs de l'assemblée : vérifier que l'ordonnance lui confie l'affectation du fonds de travaux",
  },
  aucun: { refuse: true, constat: "l'ordonnance ne confie à l'administrateur provisoire aucun pouvoir de l'assemblée" },
  inconnue: { refuse: true, constat: "l'étendue des pouvoirs de l'assemblée confiés à l'administrateur provisoire par l'ordonnance n'est pas saisie" },
}

/**
 * Part du fonds affectée par la décision de l'administrateur provisoire qui décide les travaux (objet du I de l'art.
 * 14-2-1, aucune décision d'affectation distincte) : sa décision ne tient lieu d'affectation que s'il a reçu de
 * l'ordonnance les pouvoirs de l'assemblée (L. 1965 art. 29-1, I, al. 2 ; art. 14-2-1, I, al. 7 ; J67, R81). Aucun
 * pouvoir, ou étendue non saisie : refus, il faut un vote de l'assemblée ou une ordonnance de l'art. 29-14, 2° ; une
 * partie seulement : admise, à vérifier dans l'ordonnance ; null hors de ce cas ou avec tous les pouvoirs.
 */
export function pouvoirsDeLAffectationParLAdministrateur(
  operation: SaisieOperationTravaux,
): { refuse: boolean; motif: string; fondement: string } | null {
  const { affectationFonds, decision } = operation
  if (!affectationFonds || decision?.origine !== 'administrateur' || affectationFonds.decisionAg?.trim()) return null
  if (AFFECTATION_FONDS_TRAVAUX[affectationFonds.objet].base !== 'affectation_ag') return null
  const pouvoirs = POUVOIRS_DE_L_AFFECTATION[decision.pouvoirsAgConfies ?? 'inconnue']
  if (pouvoirs === null) return null
  const suite = pouvoirs.refuse
    ? " ; sa décision ne tient pas lieu d'affectation du fonds : il faut un vote de l'assemblée ou une ordonnance de l'art. 29-14, 2°"
    : ' ; à défaut, il faut un vote de l\'assemblée ou une ordonnance de l\'art. 29-14, 2°'
  return { refuse: pouvoirs.refuse, motif: `Opération ${operation.numero} : ${pouvoirs.constat}${suite} (J67, R81).`, fondement: FONDEMENT_POUVOIRS_AG }
}

// ─── Pouvoirs du mandat et majorité des travaux (décision du 20/11/2026, partie C, F69) ───────

/** Ce que le mandat dit de l'ordonnance, pour une décision de travaux (F69 ; enregistrement au mandat : à brancher). */
export interface ContexteMandatTravaux {
  /**
   * Étendue des pouvoirs de l'assemblée que l'ordonnance confie à l'administrateur provisoire (L. 1965 art. 29-1, I ;
   * D. 1967 art. 62-5), portée par le mandat ; null : inconnue ; absent : non contrôlé (même convention que
   * envoi-ordre-service.ts, CadreMandatOs.pouvoirsAg).
   */
  pouvoirsAgDuMandat?: PouvoirsAgConfies | null
}

export interface ControlePouvoirsDecisionTravaux {
  /** Vrai : décision refusée (aucun pouvoir de l'assemblée) ; faux : alerte, sans blocage. */
  bloquant: boolean
  message: string
  fondement: string
  /** Vrai pour l'étendue inconnue au mandat : la décision du 20/11/2026 (F69) ne dit pas quoi en faire. */
  aConfirmer: boolean
}

const F69 = 'décision du 20/11/2026, partie C, F69'

/** Règle de chaque étendue des pouvoirs au mandat (F69) ; null : tous les pouvoirs, rien à signaler. */
const POUVOIRS_DE_LA_DECISION: Readonly<Record<PouvoirsAgConfies | 'inconnue', Omit<ControlePouvoirsDecisionTravaux, 'fondement'> | null>> = {
  tous: null,
  partie: {
    bloquant: false,
    message: `l'ordonnance ne lui confie qu'une partie des pouvoirs de l'assemblée : à vérifier dans l'ordonnance (${F69})`,
    aConfirmer: false,
  },
  aucun: {
    bloquant: true,
    message: `l'ordonnance ne lui confie aucun pouvoir de l'assemblée : décision « au titre des pouvoirs de l'AG » refusée, il faut un vote de l'assemblée (${F69})`,
    aConfirmer: false,
  },
  inconnue: {
    bloquant: false,
    message: `étendue des pouvoirs de l'assemblée non saisie au mandat : à vérifier dans l'ordonnance (règle à confirmer : la ${F69} ne dit pas quoi faire d'une étendue non saisie)`,
    aConfirmer: true,
  },
}

/**
 * Décision de travaux de l'administrateur provisoire « au titre des pouvoirs de l'AG » (décision du 20/11/2026, partie C,
 * F69 ; L. 1965 art. 29-1, I : « tout ou partie » des pouvoirs de l'assemblée ; D. 1967 art. 62-5 : l'ordonnance fixe
 * l'étendue de la mission) : le mandat porte l'étendue des pouvoirs ; aucun : bloquant ; une partie : alerte « à vérifier
 * dans l'ordonnance » ; tous : null. Étendue inconnue au mandat (null) : alerte non bloquante, à confirmer ; absente
 * (undefined) : non contrôlée. Décision de l'assemblée : null. Une étendue saisie sur la décision (J67, R81) différente de
 * celle du mandat est refusée.
 */
export function controlerPouvoirsDecisionTravaux(
  decision: DecisionTravaux,
  pouvoirsAgDuMandat: PouvoirsAgConfies | null | undefined,
): ControlePouvoirsDecisionTravaux | null {
  if (decision.origine !== 'administrateur' || pouvoirsAgDuMandat === undefined) return null
  const reference = `Décision « ${decision.resolution} » de l'administrateur provisoire`
  const surLaDecision = decision.pouvoirsAgConfies ?? null
  if (surLaDecision !== null && pouvoirsAgDuMandat !== null && surLaDecision !== pouvoirsAgDuMandat)
    throw new Error(
      `${reference} : étendue des pouvoirs de l'assemblée saisie sur la décision (${surLaDecision}) différente de celle du mandat (${pouvoirsAgDuMandat}).`,
    )
  const regle = POUVOIRS_DE_LA_DECISION[pouvoirsAgDuMandat ?? 'inconnue']
  if (regle === null) return null
  return { ...regle, message: `${reference} : ${regle.message}.`, fondement: FONDEMENT_POUVOIRS_AG }
}

/** Refus d'une décision de l'administrateur provisoire sans aucun pouvoir de l'assemblée au mandat (F69). */
function verifierPouvoirsDuMandat(decision: DecisionTravaux, { pouvoirsAgDuMandat }: ContexteMandatTravaux): void {
  const controle = controlerPouvoirsDecisionTravaux(decision, pouvoirsAgDuMandat)
  if (controle?.bloquant) throw new Error(controle.message)
}

/**
 * Nature des travaux pour la majorité (F69) : la majorité habituelle de chaque nature, d'après les articles cités en
 * en-tête (L. 1965 art. 24, II, a ; art. 25, f et n ; art. 30 ; art. 35) ; l'entretien suit la majorité de droit commun
 * (art. 24, I). Le classement d'un travail reste un jugement au cas par cas : une aide, jamais un blocage.
 */
export const NATURES_JURIDIQUES_TRAVAUX = {
  conservation_sante_securite: {
    libelle: "conservation de l'immeuble, santé et sécurité physique des occupants",
    majorite: 'art24',
    fondement: 'L. 1965 art. 24, II, a',
  },
  entretien: { libelle: 'entretien', majorite: 'art24', fondement: 'L. 1965 art. 24, I' },
  economies_energie: { libelle: "économies d'énergie", majorite: 'art25', fondement: 'L. 1965 art. 25, f' },
  transformation_amelioration: { libelle: 'transformation, addition ou amélioration', majorite: 'art25', fondement: 'L. 1965 art. 25, n ; art. 30' },
  surelevation: { libelle: 'surélévation', majorite: 'art26', fondement: 'L. 1965 art. 35' },
} as const satisfies Record<string, { libelle: string; majorite: TypeMajorite; fondement: string }>
export type NatureJuridiqueTravaux = keyof typeof NATURES_JURIDIQUES_TRAVAUX

const TYPES_D_ENTRETIEN: readonly TypeTravaux[] = [
  'Anti pigeons',
  'Ascenseur',
  'Boites aux lettres',
  'Chaufferie',
  "Circuit d'eau / Chauffage",
  'Couverture',
  'Dallage',
  'Eclairage',
  'Electricité',
  'Espaces verts',
  'Etanchéité',
  'Gaz',
  'Hygiène / Nettoyage',
  'Maçonnerie',
  'Menuiserie',
  'Peinture',
  'Plomberie',
  'Ravalement',
  "Réfection cage d'escaliers",
  'Serrurerie',
  'Travaux Chauffage',
  'Vide ordures',
]

/**
 * Nature habituelle de chaque TYPE_TRAVAUX (🔵 lecture VitFix, F69) : les types de conservation et de sécurité, ceux
 * d'entretien ; les autres (études, diagnostics, honoraires, procédures, « Travaux », « Réhabilitation »,
 * « Climatisation »…) n'ont pas de majorité habituelle : la nature se donne à l'aide.
 */
const NATURE_HABITUELLE_DU_TYPE: ReadonlyMap<TypeTravaux, NatureJuridiqueTravaux> = new Map<TypeTravaux, NatureJuridiqueTravaux>([
  ["Conservation de l'immeuble", 'conservation_sante_securite'],
  ['Entretien et sécurisation', 'conservation_sante_securite'],
  ['Sécurité', 'conservation_sante_securite'],
  ...TYPES_D_ENTRETIEN.map((type): [TypeTravaux, NatureJuridiqueTravaux] => [type, 'entretien']),
])

export interface MajoriteHabituelleTravaux {
  nature: NatureJuridiqueTravaux
  libelle: string
  majorite: TypeMajorite
  fondement: string
  /** La nature donnée, ou celle du type de travaux. */
  source: 'nature' | 'type'
}

/** Majorité habituelle des travaux (F69) : celle de la nature donnée, à défaut celle du type ; null si aucune. */
export function majoriteHabituelleDesTravaux(
  { type }: Pick<SaisieOperationTravaux, 'type'>,
  nature?: NatureJuridiqueTravaux | null,
): MajoriteHabituelleTravaux | null {
  if (nature && !Object.hasOwn(NATURES_JURIDIQUES_TRAVAUX, nature)) throw new Error(`Nature de travaux inconnue « ${nature} » (NATURES_JURIDIQUES_TRAVAUX).`)
  const retenue = nature ?? (type ? NATURE_HABITUELLE_DU_TYPE.get(type) : undefined)
  if (!retenue) return null
  const { libelle, majorite, fondement } = NATURES_JURIDIQUES_TRAVAUX[retenue]
  return { nature: retenue, libelle, majorite, fondement, source: nature ? 'nature' : 'type' }
}

/** Force des majorités, de la plus faible à la plus forte. */
const RANG_MAJORITE: Readonly<Record<TypeMajorite, number>> = { art24: 0, art25: 1, art26: 2, unanimite: 3 }
const LIBELLE_MAJORITE: Readonly<Record<TypeMajorite, string>> = { art24: 'art. 24', art25: 'art. 25', art26: 'art. 26', unanimite: 'unanimité' }

/**
 * Aide à la majorité d'une décision d'assemblée (décision du 20/11/2026, partie C, F69) : la majorité habituelle du type
 * (ou de la nature donnée) des travaux, et une alerte si la majorité saisie est plus faible ; jamais un blocage (une
 * erreur de majorité rend la résolution contestable dans le délai, L. 1965 art. 42, al. 2, elle ne l'annule pas
 * d'office). Sans majorité saisie, sans majorité habituelle, ou pour une décision de l'administrateur provisoire : aucune
 * alerte.
 */
export function aideMajoriteDesTravaux(
  operation: Pick<SaisieOperationTravaux, 'numero' | 'type' | 'decision'>,
  nature?: NatureJuridiqueTravaux | null,
): { habituelle: MajoriteHabituelleTravaux | null; alerte: string | null } {
  const habituelle = majoriteHabituelleDesTravaux(operation, nature)
  const { decision } = operation
  const saisie = decision?.origine === 'administrateur' ? null : (decision?.majorite ?? null)
  if (!habituelle || !saisie || RANG_MAJORITE[saisie] >= RANG_MAJORITE[habituelle.majorite]) return { habituelle, alerte: null }
  return {
    habituelle,
    alerte: `Opération ${operation.numero} : majorité saisie (${LIBELLE_MAJORITE[saisie]}) plus faible que la majorité habituelle (${LIBELLE_MAJORITE[habituelle.majorite]}) des travaux de ${habituelle.libelle} (${habituelle.fondement}) : à vérifier ; aide, sans blocage, le classement des travaux reste un jugement au cas par cas (${F69}).`,
  }
}

/**
 * Contrôle d'affectation de la part (positive) du fonds ; null si l'affectation n'est pas précisée. Refus quand elle
 * repose sur une décision de l'administrateur provisoire sans les pouvoirs de l'assemblée (J67, R81).
 */
function controlerPartFonds(operation: SaisieOperationTravaux): ResultatAffectation | null {
  const affectation = affectationFondsDeLOperation(operation)
  if (!affectation) return null
  const pouvoirs = pouvoirsDeLAffectationParLAdministrateur(operation)
  if (pouvoirs?.refuse) return { autorise: false, cause: 'decision_manquante', motif: pouvoirs.motif, fondement: pouvoirs.fondement, formeIncomplete: null }
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

/**
 * Série de comptes de l'opération, générée à sa création : auxiliaire = n° d'opération (règle « No des travaux ») ; une
 * opération qui n'est qu'une étude prend le 673 à la place du 671 (J67, R60).
 */
function serieComptesDe({ numero, libelle, etude }: SaisieOperationTravaux): CompteSerieTravaux[] {
  const auxiliaire = genererSegmentAuxiliaire({ regleNumeroCompte: 'No des travaux' }, { regle: 'No des travaux', valeur: numero })
  return SERIE_COMPTES_TRAVAUX.map((compte) => (etude && compte.role === 'travauxDecides' ? COMPTE_ETUDES_TECHNIQUES : compte)).map(
    ({ role, planCode, intitule }) => ({ role, planCode, auxiliaire, intitule, libelle }),
  )
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
  reprise: RepriseRepartitionOrigine | null | undefined,
): OperationTravaux {
  const { numero, decision } = projet
  const adoptee = decision ? ajouterChangement(projet, changementAdoption(decision.date)) : projet
  if (reprise) return ajouterRepriseRepartie(adoptee, reprise)
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

/** Référence de la répartition d'origine d'une reprise (F66) : motif, exercice, dates ISO valides. */
function verifierRepriseRepartie(reprise: RepriseRepartitionOrigine, numero: string): void {
  const objet = `Opération ${numero}, reprise d'une opération déjà répartie`
  if (!reprise.motif.trim()) throw new Error(`${objet} : motif obligatoire (décision du 20/11/2026, partie C, F66).`)
  if (!reprise.exercice.trim()) throw new Error(`${objet} : exercice de la répartition d'origine attendu.`)
  verifierDate(reprise.date, `${objet}, date de la répartition d'origine`)
  verifierDate(reprise.assembleeApprobation.date, `${objet}, assemblée qui a approuvé les comptes de l'exercice`)
}

/**
 * « Réparti » à la création : seulement en mode « reprise » (repriseRepartie), réservé à ce statut, sans date ni motif du
 * statut à part (la reprise les porte ; décision du 20/11/2026, partie C, F66).
 */
function verifierModeReprise({ numero, repriseRepartie, changementStatut }: SaisieOperationTravaux, statut: StatutTravaux): void {
  if (!repriseRepartie) {
    if (statut === 'Réparti')
      throw new Error(
        `Opération ${numero} : « Réparti » suit la répartition de l'opération (constaterRepartitionOperation), pas la saisie ; une opération reprise déjà répartie se crée en mode « reprise » (repriseRepartie : motif et référence de la répartition d'origine ; décision du 20/11/2026, partie C, F66).`,
      )
    return
  }
  if (statut !== 'Réparti') throw new Error(`Opération ${numero} « ${statut} » : mode « reprise » (repriseRepartie) réservé à la création à « Réparti » (F66).`)
  if (changementStatut)
    throw new Error(`Opération ${numero} « Réparti » en mode « reprise » : date et motif du statut (changementStatut) sans objet ; la reprise porte la date et le motif.`)
  verifierRepriseRepartie(repriseRepartie, numero)
}

/**
 * Reprise à « Réparti » d'une opération déjà répartie (F66) : un changement tracé depuis l'adoption, daté de la
 * répartition d'origine (au plus tôt de la décision), motif et référence de la répartition repris, sans aucune écriture.
 */
function ajouterRepriseRepartie(adoptee: OperationTravaux, reprise: RepriseRepartitionOrigine): OperationTravaux {
  verifierApresLaDecision(adoptee, reprise.date, "répartition d'origine reprise")
  const { assembleeApprobation: ag } = reprise
  const resolution = ag.resolution?.trim() ? `, ${ag.resolution.trim()}` : ''
  const motif = `Reprise d'une opération déjà répartie — ${reprise.motif.trim()} — répartition d'origine : exercice ${reprise.exercice.trim()}, du ${dateIsoVersFr(reprise.date)}, comptes approuvés par l'assemblée du ${dateIsoVersFr(ag.date)}${resolution} ; aucune écriture (décision du 20/11/2026, partie C, F66)`
  return ajouterChangement(adoptee, {
    vers: 'Réparti',
    le: reprise.date,
    motif,
    horsSequence: true,
    annulation: false,
    traitementId: null,
    reprise: { ...reprise, assembleeApprobation: { ...ag } },
  })
}

/**
 * Crée l'opération : n° (5 caractères), type, budget, clés, décision et majorité, statut (« Adopté » exige la décision ;
 * ni « En cours » à la création, ni « Réparti » hors du mode « reprise » (F66) ; tracé dans l'historique), part du fonds
 * de travaux, tranches ; génère la série de comptes. `contexte` : l'étendue des pouvoirs de l'assemblée portée par le
 * mandat ; une décision de l'administrateur provisoire sans aucun de ces pouvoirs est refusée (F69).
 */
export function creerOperationTravaux(saisie: SaisieOperationTravaux, contexte: ContexteMandatTravaux = {}): OperationTravaux {
  verifierEnTete(saisie)
  if (saisie.decision) {
    verifierDecision(saisie.decision, saisie.numero)
    verifierPouvoirsDuMandat(saisie.decision, contexte)
  }
  const statut = saisie.statut ?? (saisie.decision ? 'Adopté' : 'Projet')
  verifierStatutDuCycle(statut, saisie.numero)
  verifierModeReprise(saisie, statut)
  verifierDecisionDuStatut(statut, saisie.decision, saisie.numero)
  verifierPartFondsSaisie(saisie)
  verifierTranches(saisie.tranches)
  const { changementStatut, repriseRepartie, ...sansChangement } = saisie
  const projet: OperationTravaux = {
    ...sansChangement,
    type: saisie.type ?? null,
    statut: 'Projet',
    cles: clesDeLaSaisie(saisie),
    montantAAppelerCentimes: saisie.budgetTtcCentimes - saisie.financementFondsTravauxCentimes,
    serieComptes: serieComptesDe(saisie),
    historiqueStatuts: [],
  }
  return tracerStatutDeCreation(projet, statut, changementStatut, repriseRepartie)
}

/** Compte complet d'un compte de la série, au segment du syndicat (D1) : `<syndicat>.<plan>.<n°>.0`. */
const compteComplet = (compte: CompteSerieTravaux, segmentSyndicat: string): string =>
  formaterNumeroCompte({ mandat: segmentSyndicat, planCode: compte.planCode, auxiliaire: compte.auxiliaire })

/** Numéro du compte de la série de l'opération, au segment du syndicat (D1) : `<syndicat>.<plan>.<n°>.0`. */
export function numeroCompteTravaux(operation: OperationTravaux, role: RoleCompteTravaux, segmentSyndicat: string): string {
  const compte = operation.serieComptes.find((c) => c.role === role)
  if (!compte) throw new Error(`Opération ${operation.numero} : compte « ${role} » absent de sa série.`)
  return compteComplet(compte, segmentSyndicat)
}

/** Compte de charge de l'opération : le 673 d'une opération qui n'est qu'une étude, le 671 sinon (J67, R60). */
export function compteDeChargeDeLOperation(operation: OperationTravaux): CompteSerieTravaux {
  const compte = operation.serieComptes.find((c) => c.role === 'travauxDecides' || c.role === 'etudesTechniques')
  if (!compte) throw new Error(`Opération ${operation.numero} : compte de charge absent de sa série.`)
  return compte
}

// ─── Provisions et solde de l'opération (arrêté du 14 mars 2005, art. 10 ; J67, R61) ──────────

/** Opération décidée, pas encore répartie : ses provisions et son solde se suivent encore ; acte daté après la décision. */
function verifierOperationSuivie(operation: OperationTravaux, le: string, objet: string): void {
  if (!operation.decision) throw new Error(`Opération ${operation.numero} sans décision : ${objet} sans objet.`)
  if (operation.statut === 'Réparti') throw new Error(`Opération ${operation.numero} « Réparti » : clôturée, ${objet} sans objet.`)
  verifierDate(le, `Opération ${operation.numero}, ${objet}`)
  verifierApresLaDecision(operation, le, objet)
}

/**
 * Virement du 102 au 702 de l'opération à l'enregistrement d'une de ses charges (671, ou 673 d'une étude) : le 102 est
 * « débité par le crédit du compte 702 [...] au fur et à mesure de la réalisation des travaux » (arrêté du 14 mars 2005,
 * art. 10 ; J67, R61), du montant de la charge, dans la limite du solde créditeur du 102 que l'appelant fournit. Rend le
 * traitement (« Saisie de mouvements », 🔵 : la famille Gestéam de ce virement n'a pas été observée), null quand le 102
 * est soldé, et la part de la charge que le 102 ne couvre pas. Les deux lignes portent la clé de la charge (`cleId`, à
 * donner pour une opération sur plusieurs clés ; la clé unique de l'opération sinon ; 🔵, en-tête). Branchement à faire :
 * à l'écriture de chaque ligne de facture de l'opération, avec sa clé (appelant d'ecritureFactureVentilee, en-tête).
 */
export function virementProvisionsTravauxALaRealisation(
  operation: OperationTravaux,
  {
    id,
    date,
    segmentSyndicat,
    chargeCentimes,
    solde102Centimes,
    cleId,
  }: { id: string; date: string; segmentSyndicat: string; chargeCentimes: number; solde102Centimes: number; cleId?: string },
): { traitement: Traitement | null; vireCentimes: number; nonCouvertCentimes: number } {
  const { numero } = operation
  if (!Number.isInteger(chargeCentimes) || chargeCentimes <= 0)
    throw new Error(`Opération ${numero} : charge de l'opération (${chargeCentimes}) en centimes entiers strictement positifs.`)
  if (!estCentimes(solde102Centimes)) throw new Error(`Opération ${numero} : solde du 102 (${solde102Centimes}) en centimes entiers positifs ou nuls.`)
  const cle = cleDuVirement(operation, cleId)
  verifierOperationSuivie(operation, date, 'virement du 102 au 702')
  const vireCentimes = Math.min(chargeCentimes, solde102Centimes)
  const nonCouvertCentimes = chargeCentimes - vireCentimes
  if (vireCentimes === 0) return { traitement: null, vireCentimes, nonCouvertCentimes }
  const liens = { travauxId: numero }
  const attributs = { cle }
  const traitement = creerTraitement({
    id,
    famille: 'Saisie de mouvements',
    date,
    mouvements: [
      { compte: numeroCompteTravaux(operation, 'provisionsTravauxDecides', segmentSyndicat), sens: 'debit', montantCentimes: vireCentimes, attributs, liens },
      { compte: numeroCompteTravaux(operation, 'provisionsSurTravaux', segmentSyndicat), sens: 'credit', montantCentimes: vireCentimes, attributs, liens },
    ],
  })
  return { traitement, vireCentimes, nonCouvertCentimes }
}

/** Clé du virement : celle de la charge, exigée parmi les clés de l'opération ; à défaut, la clé unique de l'opération. */
function cleDuVirement(operation: OperationTravaux, cleId: string | undefined): string {
  const { numero, cles } = operation
  if (cleId === undefined) {
    if (cles.length > 1)
      throw new Error(`Opération ${numero} sur plusieurs clés (${cles.map((k) => k.cleId).join(', ')}) : clé de la charge à donner pour le virement du 102 au 702.`)
    return cles[0].cleId
  }
  if (!cles.some((k) => k.cleId === cleId)) throw new Error(`Opération ${numero} : clé ${cleId} hors des clés de l'opération (${cles.map((k) => k.cleId).join(', ')}).`)
  return cleId
}

/** Comptes de produits de la série d'une opération : le 702 (provisions virées du 102) et le 71147 (subventions). */
export const ROLES_PRODUITS_TRAVAUX = ['provisionsSurTravaux', 'subventions'] as const satisfies readonly RoleCompteTravaux[]
export type RoleProduitTravaux = (typeof ROLES_PRODUITS_TRAVAUX)[number]

/**
 * Solde au 12 d'une opération non clôturée en fin d'exercice : le compte 12 « reçoit le solde des opérations sur travaux
 * [...] qui ne peuvent pas être clôturées en fin d'exercice » (arrêté du 14 mars 2005, art. 10 ; J67, R61 : « le solde
 * des charges et des produits »). Le compte de charge (671, ou 673) est crédité de son solde débiteur, chaque compte de
 * produits de la série (702, 71147) débité de son propre solde créditeur, la différence au 12000 de l'opération ; soldes
 * fournis par l'appelant, par compte (un compte de produits absent vaut zéro). Reprise à l'ouverture :
 * repriseSoldeTravauxALOuverture.
 */
export function soldeTravauxEnFinDExercice(
  operation: OperationTravaux,
  {
    id,
    date,
    segmentSyndicat,
    soldeChargesCentimes,
    soldesProduitsCentimes,
  }: {
    id: string
    date: string
    segmentSyndicat: string
    soldeChargesCentimes: number
    soldesProduitsCentimes: Readonly<Partial<Record<RoleProduitTravaux, number>>>
  },
): Traitement {
  const { numero } = operation
  const produits = ROLES_PRODUITS_TRAVAUX.map((role) => ({ role, montantCentimes: soldesProduitsCentimes[role] ?? 0 }))
  if (!estCentimes(soldeChargesCentimes) || produits.some((p) => !estCentimes(p.montantCentimes)))
    throw new Error(
      `Opération ${numero} : soldes des charges (${soldeChargesCentimes}) et des produits (${produits.map((p) => `${p.role} ${p.montantCentimes}`).join(', ')}) en centimes entiers positifs ou nuls.`,
    )
  const totalProduits = produits.reduce((s, p) => s + p.montantCentimes, 0)
  if (soldeChargesCentimes === 0 && totalProduits === 0) throw new Error(`Opération ${numero} : aucun solde à passer au 12.`)
  verifierOperationSuivie(operation, date, 'solde au 12')
  const liens = { travauxId: numero }
  const ecart = soldeChargesCentimes - totalProduits
  const mouvements: LigneMouvement[] = [
    { compte: compteComplet(compteDeChargeDeLOperation(operation), segmentSyndicat), sens: 'credit' as const, montantCentimes: soldeChargesCentimes, liens },
    ...produits.map((p) => ({ compte: numeroCompteTravaux(operation, p.role, segmentSyndicat), sens: 'debit' as const, montantCentimes: p.montantCentimes, liens })),
    { compte: numeroCompteTravaux(operation, 'soldeEnAttente', segmentSyndicat), sens: ecart > 0 ? ('debit' as const) : ('credit' as const), montantCentimes: Math.abs(ecart), liens },
  ].filter((ligne) => ligne.montantCentimes > 0)
  return creerTraitement({ id, famille: 'Saisie de mouvements', date, mouvements })
}

/**
 * Reprise à l'ouverture de l'exercice suivant du solde passé au 12 (arrêté du 14 mars 2005, art. 10 : débits et crédits
 * de fin d'exercice repris à l'ouverture ; J67, R61) : l'écriture contraire, datée de l'ouverture, famille « Report de
 * soldes comptables » (🔵 : famille Gestéam non observée pour cette reprise).
 */
export function repriseSoldeTravauxALOuverture(solde: Traitement, { id, date }: { id: string; date: string }): Traitement {
  if (!estDateIsoValide(date) || date <= solde.date)
    throw new Error(`Reprise du solde ${solde.id} : date d'ouverture (${date}) après le solde du ${dateIsoVersFr(solde.date)} attendue.`)
  return creerTraitement({
    id,
    famille: 'Report de soldes comptables',
    date,
    mouvements: solde.mouvements.map(({ compte, sens, montantCentimes, liens }) => ({
      compte,
      sens: sens === 'debit' ? 'credit' : 'debit',
      montantCentimes,
      ...(liens ? { liens } : {}),
    })),
  })
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
 * (assemblée ou administrateur provisoire), jamais pour une opération « Rejeté » (décision du 20/11/2026, partie C,
 * F67), et, quand le fonds de travaux finance une part, une affectation admise. Avec
 * une seule clé, les échéances sont celles d'avant le point 30 ; le crédit sur l'auxiliaire de l'opération est posé par
 * traitementAppelDeFondsTravaux.
 */
export function echeancesTravaux(operation: OperationTravaux): EcheanceAppel[] {
  if (!operation.decision)
    throw new Error(`Opération ${operation.numero} : pas d'appel de travaux sans décision (assemblée ou administrateur provisoire).`)
  const rejetee = refusAppelOuOrdreDeServiceOperation(operation)
  if (rejetee) throw new Error(rejetee.motif)
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
    compteContrepartie: COMPTE_APPEL_TRAVAUX,
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
