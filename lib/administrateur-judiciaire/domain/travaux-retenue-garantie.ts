import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import { ajouterJours, ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  COMPTE_ATTENTE_RETENUE_GARANTIE,
  estAuCentieme,
  factureAuDelaDeLAvancement,
  retenueAuDelaDuPlafond,
  retenueAuTaux,
  TAUX_MAXIMAL_RETENUE_GARANTIE_PCT,
  type EnTeteFactureTravaux,
} from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { ReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import type { ApprobationComptes } from '@/lib/administrateur-judiciaire/domain/regularisation-charges'
import type { ElementAFaire } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { creerTraitement, estPourcentage, type LiensMouvement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { reglementsDeLOperation, type OperationTravaux } from '@/lib/administrateur-judiciaire/domain/travaux-operations'

/**
 * Retenue de garantie et déduction fiscale des marchés d'une opération de travaux (point 32 du bilan ; cartographie
 * Gestéam, tranches 32 et 36). Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran ni table : le
 * stockage (marchés, consignations, restitutions ; avancement et retenue de la facture) reste à Frédéric. Complète
 * travaux-operations.ts (opération, point 30), travaux-budget.ts (budget, point 31) et facture-ventilee.ts (avancement et
 * retenue de la facture, écriture « Saisie de factures », reste dû net de retenue).
 *
 * Gestéam — 🟢 lu :
 * - tranche 32, onglet Budget, lignes de marché par entreprise : « Garantie (taux, montant, restituée), Déduction
 *   fiscale € » ; factures de l'opération, pied « Budget / Fact. · Garantie · Réglé · Dû » ; recherche des travaux :
 *   critères « Déduction fiscale » et « Réceptionnés depuis le » ; fiche : Réception (date) ; onglet Chantier :
 *   « Avancement % » par prestation ;
 * - tranche 36, en-tête de la fiche facture : « Travaux (opération) ; Avancement %, Retenue de garantie € » ; par ligne de
 *   l'onglet Détail : « Code fiscal » ;
 * - tranche 43 § 21 : 47150 « Compte d'attente_ » (type « Compte d'attente ») et « COMPTE D'ATTENTE DE TRESORERIE » (type
 *   « Bascule gérance copropriété ») : le compte de la retenue n'a pas été observé ; tranche 43 § 20 : type de document
 *   « Facture / avoir fournisseur » (la saisie d'un avoir sur un marché de travaux n'a pas été observée).
 *
 * Le droit — 🟢 lu sur Légifrance le 04/11/2026 (versions en vigueur au 03/11/2026) :
 * - loi n° 71-584 du 16 juillet 1971, art. 1er (version en vigueur depuis le 1er janvier 2020) : « Les paiements des
 *   acomptes sur la valeur définitive des marchés de travaux privés visés à l'article 1779-3° du code civil peuvent être
 *   amputés d'une retenue égale au plus à 5 p. 100 de leur montant et garantissant contractuellement l'exécution des
 *   travaux » (al. 1) ; « Le maître de l'ouvrage doit consigner entre les mains d'un consignataire, accepté par les deux
 *   parties ou à défaut désigné par le président du tribunal judiciaire ou du tribunal de commerce, une somme égale à la
 *   retenue effectuée » (al. 2) ; si les retenues dépassent la consignation, il « devra compléter celle-ci jusqu'au
 *   montant des sommes ainsi retenues » (al. 3) ; « la retenue de garantie stipulée contractuellement n'est pas pratiquée
 *   si l'entrepreneur fournit pour un montant égal une caution personnelle et solidaire » d'un établissement financier
 *   (al. 4) ; C. civ. art. 1779, 3° : louage d'ouvrage « des architectes, entrepreneurs d'ouvrages et techniciens par
 *   suite d'études, devis ou marchés » ;
 * - loi n° 71-584, art. 2 : « A l'expiration du délai d'une année à compter de la date de réception, faite avec ou sans
 *   réserve, des travaux », la caution est libérée ou les sommes consignées sont versées à l'entrepreneur, « même en
 *   l'absence de mainlevée, si le maître de l'ouvrage n'a pas notifié à la caution ou au consignataire, par lettre
 *   recommandée, son opposition motivée par l'inexécution des obligations de l'entrepreneur » ; art. 3 : sont nuls les
 *   arrangements qui font échec aux art. 1er et 2 ; art. 4 : applicable aux conventions de sous-traitance ;
 * - arrêté du 14 mars 2005, art. 7 : 401 « Factures parvenues », 461 « Débiteurs divers », 472 « Compte en attente
 *   d'imputation créditeur » ; aucun compte de retenue de garantie ; art. 10 : « Le compte 47 "Compte d'attente" doit être
 *   soldé à la fin de l'exercice ou à défaut justifié ligne à ligne » ; art. 5 : écriture erronée annulée par une
 *   écriture contraire ;
 * - CGI art. 31 (version en vigueur depuis le 21 février 2026), I, 1°, propriétés urbaines, charges déductibles : « a)
 *   Les dépenses de réparation et d'entretien effectivement supportées par le propriétaire » ; « a quater) Les provisions
 *   pour dépenses, comprises ou non dans le budget prévisionnel de la copropriété, prévues à l'article 14-1 de la loi n°
 *   65-557 du 10 juillet 1965 [...], supportées par le propriétaire, diminuées du montant des provisions déduites l'année
 *   précédente qui correspond à des charges non déductibles » ; « b) Les dépenses d'amélioration afférentes aux locaux
 *   d'habitation, à l'exclusion des frais correspondant à des travaux de construction, de reconstruction ou
 *   d'agrandissement » (et des dépenses ouvrant droit aux crédits d'impôt des art. 200 quater et 200 quater A) ; b bis)
 *   locaux professionnels et commerciaux : amélioration « destinées à protéger ces locaux des effets de l'amiante ou à
 *   faciliter l'accueil des handicapés » ; L. 1965 art. 14-1, I (budget prévisionnel) et II (travaux hors budget, « Les
 *   sommes afférentes à ces dépenses sont exigibles selon les modalités votées par l'assemblée générale »).
 *   Non trouvé dans l'art. 31 : la retenue de garantie ; qui établit la part déductible ; une obligation du syndic de la
 *   communiquer aux bailleurs.
 *
 * Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67 et J70 : recommandations validées en bloc ;
 * textes relus sur Légifrance le 17/11/2026 : loi n° 71-584, art. 1er, 2 et 3 ; arrêté du 14 mars 2005, art. 3 ; CPC
 * art. 640 à 642 et 668 ; CGI art. 31, I, 1° ; Cass. 3e civ., 22/09/2004, n° 03-12.639, 13/04/2010, n° 09-11.173, et
 * 09/02/2000, n° 98-15.139) :
 * - J67, R62 : la retenue et son plafond de 5 % se calculent sur le TTC de chaque situation (art. 1er : « au plus à 5 p.
 *   100 de leur montant » ; le syndicat, non assujetti, enregistre TTC : arrêté, art. 3) ; le taux du marché, s'il est
 *   plus faible, s'applique ; code confirmé ;
 * - J67, R63 : échéance au même quantième un an après la réception, somme à libérer le lendemain, sans report au jour
 *   ouvrable (code gardé ; la variante du lendemain, sans base, reste une simple information du suivi et quitte le
 *   libellé de l'échéance) ; l'opposition est à temps si la lettre a été présentée (ou remise) à la caution ou au
 *   consignataire au plus tard le jour de l'échéance (notifieeLe) ; envoyée à temps (envoyeeLe) mais présentée après, ou
 *   présentée après sans date d'envoi saisie (un envoi à temps n'est alors pas exclu) : « opposition peut-être tardive, à
 *   confirmer », ni blocage ni libération automatiques ; destinataire saisi qui n'est
 *   ni la caution ni le consignataire : alerte ; rappel « opposition à envoyer » avant l'échéance, au réglage du cabinet
 *   (delaiRappelOppositionJours) ; la marque « à confirmer » reste ;
 * - J67, R64 : une opposition notifiée avant la réception, ou sans réception datée, n'a pas de validité établie : plus de
 *   blocage automatique ; alerte pour la notifier de nouveau dès la réception datée, avant l'échéance ; à l'échéance,
 *   sans nouvelle opposition, ni blocage ni libération automatiques : la libération demande une confirmation motivée et
 *   tracée du gestionnaire (ConfirmationLiberation, portée sur la restitution ; pour une caution, qui ne passe par
 *   aucune écriture, datée et portée sur le marché : liberationCautionConfirmee) ; l'opposition remplacée reste tracée
 *   (oppositionsPrecedentes) ; la marque « à confirmer » reste ;
 * - J67, R65 : une caution fournie en cours de chantier n'oblige pas à rendre les retenues déjà faites ; leur restitution
 *   avant l'expiration reste une mainlevée anticipée, en information, qui rappelle Cass. 3e civ., 09/02/2000 ; ajout de
 *   l'historique daté des cautions (cautions : montant, date de fourniture, établissement) : la condition « pour un
 *   montant égal » se juge à la date de chaque facture avec la caution alors fournie ;
 * - J67, R66 : aucun texte n'impose au syndic de communiquer la part déductible : « à la demande » gardé ; vue par
 *   exercice approuvé et par lot (partsDeductiblesDeLExercice : provisions pour travaux appelées, part déductible, part
 *   non déductible), répartition inchangée (charges de chaque copropriétaire dans l'opération), mention gardée ;
 * - J70 (Q3) : caution inférieure à la retenue stipulée : par défaut, la retenue stipulée est pratiquée en entier, avec
 *   l'alerte « caution insuffisante » ; la seule différence (retenue stipulée − caution, au prorata de la facture) est
 *   permise marché par marché, avec un motif enregistré (retenueLimiteeALaDifference) : l'alerte devient alors une
 *   information qui rappelle le motif.
 *
 * Règles :
 * - garantie du marché : retenue (taux stipulé, 5 % au plus, art. 1er, al. 1), caution ou aucune ; sous caution, la
 *   retenue reste stipulée (taux exigé aussi) et « n'est pas pratiquée » si la caution est fournie « pour un montant
 *   égal » (art. 1er, al. 4) : la caution se compare à la retenue stipulée (taux du marché appliqué à son montant,
 *   retenueAuTaux) ; la caution se date (cautionFournieLe ; absente : fournie dès le marché) et la condition s'apprécie
 *   à la date de chaque facture ; une retenue sur une facture d'un marché sans retenue stipulée, ou couvert à sa date
 *   par une caution d'un montant au moins égal, est bloquante ; au-delà de 5 % du TTC de la facture aussi
 *   (facture-ventilee.ts, retenueAuDelaDuPlafond) ;
 * - délai d'un an « à compter de la date de réception, faite avec ou sans réserve » (art. 2) : sans réception datée, pas
 *   d'échéance ; des réserves à la réception ne changent pas le délai (gardées pour l'information) ; l'opposition se
 *   saisit avec sa date de présentation (ou de remise), sa date d'envoi et son destinataire (J67, R63), son motif
 *   (« motivée par l'inexécution des obligations de l'entrepreneur »), et sa mainlevée (date et origine : amiable ou
 *   décision de justice) : l'art. 2 verse les sommes « même en l'absence de mainlevée » faute d'opposition, la mainlevée
 *   est donc l'issue d'une opposition notifiée ;
 * - consignation (art. 1er, al. 2 et 3) : consigné inférieur au retenu → avertissement ;
 * - saisies contrôlées : factures (TTC en centimes entiers strictement positifs, date AAAA-MM-JJ du calendrier),
 *   consignations et restitutions (montant en centimes entiers strictement positifs, date AAAA-MM-JJ du calendrier) ;
 *   une saisie invalide est bloquante (facture_invalide, consignation_invalide, restitution_invalide), signalée sans
 *   erreur, et n'entre dans aucun total ni aucun classement (avancement, retenue « malgré la caution », restitution
 *   anticipée ou malgré l'opposition, dernière restitution), comme une retenue invalide, sauf la restitution dont seule
 *   la date est invalide : son montant reste compté au restitué (reste retenu, garantie, dû), seule sa date est écartée
 *   (dernière restitution, restitution anticipée ou malgré l'opposition) ; les règlements d'une facture écartée sont
 *   retirés du réglé, du marché comme du pied de l'opération (le réglé fourni à suiviRetenueMarche s'entend sans eux) ;
 * - suivi par marché (Gestéam « Garantie (taux, montant, restituée) », pied « Garantie · Réglé · Dû ») : facturé,
 *   retenu, consigné, restitué et date de la dernière restitution, reste retenu, réglé fourni, dû, dernier avancement,
 *   expiration du délai (et, en simple information, sa variante du lendemain), opposition, état ; anomalies au format
 *   du point 31
 *   (code, gravité, message, fondement, aConfirmer) avec l'objet concerné ;
 * - pied de l'opération (garantieDeLOperation, « Budget / Fact. · Garantie · Réglé · Dû ») : facturé de toutes les
 *   factures de l'opération (hors marché comprises), garantie restant retenue, réglé des règlements de l'opération
 *   (reglementsDeLOperation, point 30) sans ceux d'une facture écartée, dû net de la garantie ; un marché d'une autre
 *   opération ou d'un autre syndicat est refusé (D1) ;
 * - en-tête de la facture d'un marché (enTeteFactureDuMarche) : retenue au taux du marché, bornée à 5 % du TTC
 *   (retenueAuTaux), aucune sous caution d'un montant égal (à la date de la facture, sinon la caution actuelle) ni sans
 *   retenue stipulée ; entrée d'ecritureFactureVentilee ;
 * - écritures : la facture (facture-ventilee.ts) crédite le 401 de son montant entier (arrêté, art. 10) puis fait passer
 *   la retenue au 47200 ; la libération la ramène du 47200 au 401 du fournisseur (« Saisie de mouvements »), réglée
 *   ensuite comme toute facture (reglements-fournisseurs.ts) ; refusée au-delà du reste retenu, sous opposition à temps
 *   en cours à sa date (sans mainlevée), sous une opposition de validité non établie sans la confirmation du gestionnaire
 *   (J67, R63 et R64), sans rien de retenu sur un marché qui ne pratique pas la retenue, ou tant que le suivi
 *   porte une saisie écartée qui fausse le reste retenu (resteRetenuFaussePar : facture invalide portant une retenue,
 *   retenue invalide, restitution au montant invalide) ; une retenue pratiquée avant une caution, ou malgré elle, est au
 *   47200 et reste libérable ;
 * - échéance de libération pour le suivi « à faire » (echeancesLiberationGarantie) : à l'expiration du délai ; une
 *   retenue tant qu'il en reste à restituer, une caution jusqu'à l'expiration ; sous opposition à temps en cours,
 *   l'élément reste (« sous opposition depuis le … ») jusqu'à la mainlevée ; sous une opposition de validité non établie,
 *   il demande la confirmation du gestionnaire ; une saisie écartée qui fausse le reste retenu est rappelée au libellé
 *   (libération suspendue jusqu'à sa correction) ; rappel « opposition à envoyer » au réglage du cabinet (J67, R63) ;
 * - total à passer au retour après rejet d'un virement (statuts-facture.ts, J9) quand le reste dû est net de la
 *   retenue : TTC − retenue (baseRetourApresRejet) ;
 * - part déductible : saisie par marché (Gestéam « Déduction fiscale € »), au plus le montant du marché, avec sa
 *   qualification (réparation et entretien : a ; amélioration : b et b bis ; construction, reconstruction ou
 *   agrandissement : exclue du b) ; répartie entre les copropriétaires au prorata de leurs charges de l'opération (plus
 *   forts restes), rendue pour les bailleurs avec la part non déductible (a quater : provisions déduites puis diminuées
 *   de la part non déductible) et une mention : information du cabinet, à apprécier par le copropriétaire selon son
 *   régime d'imposition ; par opération, et par exercice approuvé et par lot (J67, R66).
 *
 * 🔵 Déduit :
 * - expiration du délai d'un an : même quantième un an après la réception (dernier jour du mois s'il n'existe pas,
 *   ajouterMois ; J67, R63) ; la retenue est « à libérer » le lendemain ; une opposition présentée après n'empêche pas
 *   la libération (art. 2 : versées « si le maître de l'ouvrage n'a pas notifié ») : avertissement ;
 * - l'opposition à temps retient la garantie de sa présentation à sa mainlevée (le jour de la mainlevée, elle ne retient
 *   plus) ; la mainlevée se date au plus tôt le jour de l'opposition ; une opposition peut-être tardive vaut, pour la
 *   confirmation qu'elle demande, dès son envoi, ou dès l'échéance quand l'envoi n'est pas saisi (le dernier jour où il
 *   aurait été à temps) ;
 * - la retenue stipulée est le taux du marché appliqué à son montant TTC, suppléments compris ;
 * - caution fournie en cours de marché (al. 4, substitution, ou marché passé de la retenue à la caution) : elle vaut pour
 *   les factures datées du jour de sa fourniture ou après (la date de la facture tient lieu de celle du paiement de
 *   l'acompte) ; les retenues déjà pratiquées ne sont pas requalifiées, restent au 47200 et se libèrent (avant
 *   l'expiration : mainlevée anticipée, information) ; sans historique saisi, la caution actuelle tient lieu
 *   d'historique (J67, R65) ;
 * - différence de la retenue avec la caution (J70) : la retenue stipulée moins la caution fournie à la date de la
 *   facture, répartie au prorata du TTC de la facture sur le montant du marché (plus forts restes), au plus la retenue
 *   au taux ;
 * - états : une caution, l'expiration passée sans opposition en cours, est « libérée » (art. 2 : « la caution est
 *   libérée ») ; une retenue stipulée sans rien de retenu est « sans retenue » (ni en délai, ni à libérer) ;
 * - une restitution au plus tard le jour de l'expiration est une mainlevée anticipée, à justifier (information) ; datée
 *   du jour de la notification d'une opposition à temps ou après, avant sa mainlevée : avertissement ; sous une
 *   opposition de validité non établie, sans confirmation du gestionnaire : avertissement ; antérieure à la
 *   notification : mainlevée anticipée ;
 * - la retenue d'une facture se compare au taux du marché (au centime le plus proche, le demi-centime au-dessus, en
 *   calcul entier, bornée au plafond de 5 % arrondi au centime inférieur : retenueAuTaux) : un écart est un
 *   avertissement, au-delà de 5 % un blocage ; une facture sans retenue (nulle ou absente, confondues) sur un marché à
 *   retenue stipulée est un avertissement (paiement non garanti ; l'art. 1er dit « peuvent être amputés ») ; une
 *   retenue invalide (non entière, négative, au-delà du TTC) est bloquante et n'entre dans aucun total ; taux et
 *   avancement ont deux décimales au plus (calcul entier) ;
 * - l'avancement se lit dans l'ordre des factures (date, puis identifiant) : une baisse, un facturé au-delà du marché ou
 *   de l'avancement déclaré (montant du marché × dernier avancement, en calcul entier) sont des avertissements ;
 * - dû du marché = facturé − reste retenu − réglé ; un réglé au-delà du dû est un avertissement ; dans le pied de
 *   l'opération, le réglé d'un marché est celui des règlements de ses factures (factureId), hors facture écartée, dont le
 *   règlement suit la facture hors des totaux (sinon, le dû des factures comptées s'effacerait) ; une retenue sur une
 *   facture hors marché compte dans la garantie et est signalée (ni taux, ni réception, ni libération suivis) ;
 * - une restitution dont seule la date est invalide garde son montant au restitué : ce montant est connu, et l'écarter
 *   laisserait le reste retenu et la garantie au-dessus du réel, le dû des factures comptées réduit d'autant (le
 *   règlement qui l'a versée reste au réglé) ; bloquante jusqu'à sa correction, elle n'entre dans aucun classement par
 *   date (dernière restitution, anticipée, malgré l'opposition) et ne fausse pas le reste retenu ;
 * - une saisie écartée fausse le reste retenu quand elle en retire un montant : retenue d'une facture invalide ou
 *   retenue invalide (reste minoré), restitution au montant invalide (le restitué réel n'est pas connu : le reste et la
 *   garantie peuvent être majorés, le dû réduit d'autant, et la même somme libérée deux fois) ; la libération attend sa
 *   correction, et un réglé au-delà du dû nomme ces saisies (dû à revoir après leur correction) ; une consignation
 *   invalide, une restitution dont seule la date est invalide (comptée), une retenue pratiquée malgré une caution, sans
 *   retenue stipulée ou au-delà de 5 % (comptée, au 47200) ne la bloquent pas ;
 * - le 47200 garde la retenue au compte du fournisseur (auxiliaire), avec les liens fournisseur et travaux : la
 *   justification ligne à ligne de l'art. 10 est le suivi par marché ;
 * - l'élément « à faire » garde la date d'expiration du délai, sous opposition comme sans ;
 * - part déductible : la déduction retenue de tous les marchés est répartie une seule fois au prorata des charges (plus
 *   forts restes : la somme des parts égale la déduction, chacune au plus les charges du lot), puis la part de chaque
 *   lot se ventile entre les marchés au prorata de leurs déductions (plus forts restes) ; d'une amélioration : comptée
 *   pour un lot d'habitation (b) ; pour un lot professionnel ou commercial, écartée et signalée « à vérifier » (b bis :
 *   amiante ou accueil des handicapés seulement) ; usage non renseigné : comptée et signalée ; une déduction saisie sur
 *   un marché de construction, reconstruction ou agrandissement est écartée (avertissement) ;
 * - l'échéance de libération est `aConfirmer` : le délai d'un an est lu (art. 2), son jour exact reste à confirmer
 *   faute d'arrêt (J67, R63) ; les anomalies qui dépendent de ce jour (opposition tardive ou peut-être tardive,
 *   restitution anticipée, malgré l'opposition ou sans confirmation) le sont aussi, comme l'opposition antérieure à la
 *   réception (J67, R64).
 *
 * 🔴 Non établi (questions pour Frédéric ou Hugo) :
 * - « Comment Gestéam enregistre-t-il la mainlevée d'une opposition à la retenue : date, origine (levée amiable du maître
 *   de l'ouvrage, décision de justice), pièce ? » (VitFix : date et origine) ;
 * - (relevé Gestéam, Hugo ; J67, R65) « Gestéam garde-t-il plusieurs cautions successives sur une ligne de marché (zone
 *   Garantie), ou une seule ? » (VitFix : historique daté des cautions) ;
 * - « Le cabinet consigne-t-il les retenues (art. 1er, al. 2), auprès de quel consignataire, et comment Gestéam
 *   l'enregistre-t-il (compte 461 "Débiteurs divers" ?, compte bancaire distinct ?) ; à la libération, le consignataire
 *   verse-t-il directement à l'entrepreneur ? » (VitFix : consignation suivie en montant et en date, sans écriture ; la
 *   libération passe par le 401 et un règlement du syndicat) ;
 * - « Où Gestéam porte-t-il la retenue : 472xx, 47150 "Compte d'attente_", subdivision du 401 (arrêté, art. 8) ? »
 *   (VitFix : 47200, à l'auxiliaire du fournisseur) ; « Quelle famille de traitement porte le reclassement 47200 → 401 à
 *   la libération ? » (VitFix : « Saisie de mouvements ») ;
 * - « Une facture soldée hors retenue est-elle "Réglée" ou "Rgt. partiel" ? » (statuts-facture.ts la laisse
 *   « Rgt. partiel » tant que le réglé est inférieur au TTC ; après le rejet d'un virement, le réglé se déduit du total
 *   net de la retenue, baseRetourApresRejet, et le statut rétabli n'en dépend pas) ; « "Restituée", sur la ligne de
 *   marché Gestéam, est-elle une case, une date ou un montant ? » (VitFix : montant restitué et date de la dernière
 *   restitution) ;
 * - « Que mesure l'"Avancement %" de la facture : l'avancement cumulé du marché, ou celui de la situation ? » (VitFix :
 *   cumulé) ; « La "Déduction fiscale €" d'un marché est-elle un montant saisi par le gestionnaire, ou calculé depuis les
 *   codes fiscaux des lignes de facture ? Que codent ces codes fiscaux ? » (VitFix : montant saisi par marché ; codes
 *   fiscaux des lignes non interprétés) ;
 * - « Un avoir de l'entreprise sur un marché de travaux (type de document « Facture / avoir fournisseur », tranche 43
 *   § 20) se saisit-il en facture au TTC négatif ? Diminue-t-il le facturé du marché et la retenue pratiquée ? »
 *   (VitFix : TTC strictement positif, comme l'en-tête de la facture ; une facture au TTC nul ou négatif est bloquante et
 *   écartée des totaux, l'avoir n'est pas suivi ici) ;
 * - « Qui qualifie l'usage du lot (habitation, professionnel) pour le b et le b bis du CGI art. 31 ? » (VitFix : donnée
 *   fournie par l'appelant, non vérifiée) ;
 * - « La marque "Non déductible" des lignes de facture (point 28) doit-elle se rapprocher de la déduction du marché ? »
 *   (VitFix : non rapprochées).
 *
 * Ajouts hors de ce module : facture-ventilee.ts — TAUX_MAXIMAL_RETENUE_GARANTIE_PCT, COMPTE_ATTENTE_RETENUE_GARANTIE,
 * plafondRetenueGarantie et retenueAuTaux (plafond au centime inférieur, retenue au taux en calcul entier bornée au
 * plafond), estAuCentieme (deux décimales au plus), factureAuDelaDeLAvancement (calcul entier), en-tête « travaux » de la
 * facture (avancementPct, retenueGarantie) contrôlé par controlerEnTeteFactureTravaux (avancement à deux décimales au
 * plus ; retenue sur une opération dont relève une ligne : « retenue_sans_travaux ») et passé à ecritureFactureVentilee
 * (le 401 crédité du TTC, puis 401 → 47200), retenueGarantieCentimes d'echeanceReglement (reste dû net de retenue ; sans
 * retenue, résultat inchangé) ; travaux-operations.ts — retenueGarantie refuse un taux non fini ou à plus de deux
 * décimales et borne l'arrondi au plafond (signature, sortie et date de libération inchangées), son en-tête renvoie à ce
 * module ; suivi-a-faire.ts — nature « liberation_garantie » de la famille travaux et adaptateur depuisRetenuesGarantie,
 * qui rend echeancesLiberationGarantie (branchement fait le 17/11/2026).
 * Branchements à faire hors de ce module (fichiers non modifiés) : suivi-a-faire.ts — FactureSuivie complétée de
 * retenueGarantieCentimes pour que depuisFactures passe la retenue à echeanceReglement ; statuts-facture.ts — l'appelant qui calcule FactureAPayer.resteDuCentimes passe aussi la
 * retenue, et passe alors baseRetourApresRejet (TTC − retenue) en totalTtcCentimes de retourFactureApresRejet : le réglé
 * déduit y est TTC − retenue − reste dû (avec le TTC brut, le rejet d'un virement net laisserait « Rgt. partiel » sans
 * rien de réglé et admettrait un rejet supérieur au virement) ; à défaut, un paramètre retenueGarantieCentimes dans
 * statuts-facture.ts ; statutSaisieApresReglement attend la réponse sur « Réglée » ou « Rgt. partiel » ;
 * travaux-budget.ts — colonne « Garantie » et dû net de la garantie dans suiviFinancierOperationTravaux
 * (garantieDeLOperation la calcule) ; reglements-fournisseurs.ts — objet « libération de retenue » et marché du
 * règlement ; plan comptable importé — compte 47200 (ou le 47150 de Gestéam selon la réponse) ; db/schema.ts (Frédéric)
 * — Facture : avancementPct, retenueGarantieCentimes, marcheId ; tables des marchés de travaux (garantie, taux, caution
 * et sa date de fourniture, réception, opposition et sa mainlevée, qualification et déduction fiscales), des
 * consignations et des restitutions ; enregistrement des ajouts J67 et J70, à brancher : historique des cautions,
 * retenue limitée à la différence et son motif, date d'envoi et destinataire de l'opposition, oppositions remplacées,
 * confirmation de la restitution et de la libération de la caution (liberationCautionConfirmee) ; réglage du cabinet
 * du rappel « opposition à envoyer » (delaiRappelOppositionJours, à passer par suivi-a-faire.depuisRetenuesGarantie) ;
 * lots des charges et provisions appelées de l'exercice
 * (partsDeductiblesDeLExercice) ; écrans : Frédéric ;
 * fiche-entreprise.ts — le fournisseur du marché.
 */

// ─── Marché et garantie ──────────────────────────────────────────────────────────────────────

/** Garantie du marché : retenue stipulée, caution qui la remplace « pour un montant égal » (art. 1er, al. 4), ou aucune. */
export const MODES_GARANTIE_MARCHE = ['retenue', 'caution', 'aucune'] as const
export type ModeGarantieMarche = (typeof MODES_GARANTIE_MARCHE)[number]

/** Qualification fiscale du marché, d'après le CGI art. 31, I, 1° (a, b, b bis), lu. */
export const QUALIFICATIONS_FISCALES_TRAVAUX = ['reparation_entretien', 'amelioration', 'construction_reconstruction_agrandissement'] as const
export type QualificationFiscaleTravaux = (typeof QUALIFICATIONS_FISCALES_TRAVAUX)[number]

export const LIBELLES_QUALIFICATIONS_FISCALES: Readonly<Record<QualificationFiscaleTravaux, string>> = {
  reparation_entretien: 'Réparation et entretien (CGI art. 31, I, 1°, a)',
  amelioration:
    "Amélioration (CGI art. 31, I, 1°, b : locaux d'habitation ; b bis : locaux professionnels et commerciaux, amiante ou accueil des handicapés)",
  construction_reconstruction_agrandissement: 'Construction, reconstruction ou agrandissement (exclus du CGI art. 31, I, 1°, b)',
}

/** Origine de la mainlevée de l'opposition : levée amiable du maître de l'ouvrage, ou décision de justice (🔴 forme). */
export const ORIGINES_MAINLEVEE = ['amiable', 'decision_de_justice'] as const
export type OrigineMainlevee = (typeof ORIGINES_MAINLEVEE)[number]

/** Mainlevée de l'opposition : à sa date, l'opposition ne retient plus la garantie. */
export interface MainleveeOpposition {
  le: string
  origine: OrigineMainlevee
}

/** Destinataire de la lettre d'opposition : l'art. 2 la veut notifiée « à la caution ou au consignataire » (J67, R63). */
export const DESTINATAIRES_OPPOSITION = ['caution', 'consignataire', 'entreprise', 'autre'] as const
export type DestinataireOpposition = (typeof DESTINATAIRES_OPPOSITION)[number]

/** Opposition motivée notifiée par lettre recommandée à la caution ou au consignataire (art. 2), et sa mainlevée. */
export interface OppositionGarantie {
  /**
   * Date de présentation (ou de remise) de la lettre à la caution ou au consignataire : celle qui se compare à l'échéance
   * (J67, R63 : la date d'envoi ne suffit pas).
   */
  notifieeLe: string
  /** Date d'envoi de la lettre recommandée, au plus tard sa présentation ; absente : non saisie (J67, R63). */
  envoyeeLe?: string | null
  /** Destinataire de la lettre ; absent : non saisi (J67, R63). */
  destinataire?: DestinataireOpposition | null
  motif: string
  /** Absente : opposition en cours. */
  mainlevee?: MainleveeOpposition | null
}

/** Caution de l'historique daté des cautions du marché (art. 1er, al. 4 ; J67, R65). */
export interface CautionDuMarche {
  montantCentimes: number
  /** Date de fourniture ; null : dès le marché (la première seulement). */
  fournieLe: string | null
  /** Établissement qui se porte caution (identifiant) ; absent : non saisi. */
  etablissementId?: string | null
}

/**
 * Confirmation motivée et tracée du gestionnaire qui libère la garantie malgré une opposition dont la validité n'est pas
 * établie : antérieure à la réception (J67, R64) ou peut-être tardive (J67, R63).
 */
export interface ConfirmationLiberation {
  motif: string
  /** Collaborateur qui confirme (identifiant). */
  confirmeePar: string
}

/**
 * Libération de la caution confirmée par le gestionnaire, datée (J67, R64) : la caution ne passe pas par une écriture
 * (ecritureLiberationRetenue ne libère que la retenue pratiquée) ; la confirmation se porte donc sur le marché.
 */
export interface ConfirmationLiberationCaution extends ConfirmationLiberation {
  /** Date de la confirmation, après l'expiration du délai (avant, elle ne compte pas). */
  le: string
}

export interface SaisieMarcheTravaux {
  id: string
  coproprieteId: string
  /** N° de l'opération de travaux (5 caractères), unique au sein du syndicat (D1). */
  travauxId: string
  fournisseurId: string
  libelle: string
  /** Montant du marché TTC, suppléments compris (Gestéam « Budget € » de la ligne de marché). */
  montantTtcCentimes: number
  garantie: ModeGarantieMarche
  /** Taux de la retenue stipulée au marché (5 % au plus, deux décimales au plus) ; exigé sous retenue et sous caution. */
  tauxRetenuePct?: number | null
  /** Montant de la caution (art. 1er, al. 4) ; exigé pour une caution, sans objet sinon. */
  cautionCentimes?: number | null
  /**
   * Date de fourniture de la caution (substitution en cours de marché, al. 4) : la caution vaut pour les factures datées
   * de ce jour ou après ; absente : fournie dès le marché. Sans objet hors caution.
   */
  cautionFournieLe?: string | null
  /**
   * Historique daté des cautions (J67, R65), dans l'ordre de fourniture ; la dernière est la caution actuelle
   * (cautionCentimes et cautionFournieLe, s'ils sont saisis, doivent l'égaler) ; absent : la seule caution actuelle.
   */
  cautions?: readonly CautionDuMarche[] | null
  /**
   * Retenue limitée à la différence entre la retenue stipulée et une caution inférieure, au prorata de chaque facture :
   * permis marché par marché, avec un motif enregistré (J70) ; absente : retenue stipulée pratiquée en entier.
   */
  retenueLimiteeALaDifference?: { motif: string } | null
  /** Date de réception des travaux, avec ou sans réserve (art. 2) ; absente : délai non commencé. */
  dateReception?: string | null
  reserves?: boolean | null
  opposition?: OppositionGarantie | null
  /** Oppositions remplacées par une nouvelle notification (trace : J67, R64) ; sans effet sur la garantie. */
  oppositionsPrecedentes?: readonly OppositionGarantie[] | null
  /**
   * Caution : libération confirmée par le gestionnaire sous une opposition de validité non établie (antérieure à la
   * réception, ou peut-être tardive : J67, R63 et R64), motivée, tracée et datée ; sans objet hors caution. La retenue
   * pratiquée, s'il en reste, se libère à part (ecritureLiberationRetenue, avec sa propre confirmation).
   */
  liberationCautionConfirmee?: ConfirmationLiberationCaution | null
  qualificationFiscale?: QualificationFiscaleTravaux | null
  /** Gestéam « Déduction fiscale € » de la ligne de marché ; absente : aucune part déductible. */
  deductionFiscaleCentimes?: number | null
}

export interface MarcheTravaux extends SaisieMarcheTravaux {
  tauxRetenuePct: number
  cautionCentimes: number
  cautionFournieLe: string | null
  cautions: CautionDuMarche[]
  retenueLimiteeALaDifference: { motif: string } | null
  dateReception: string | null
  reserves: boolean
  opposition: OppositionGarantie | null
  oppositionsPrecedentes: OppositionGarantie[]
  liberationCautionConfirmee: ConfirmationLiberationCaution | null
  qualificationFiscale: QualificationFiscaleTravaux | null
  deductionFiscaleCentimes: number
}

const MODES_CONNUS: ReadonlySet<string> = new Set(MODES_GARANTIE_MARCHE)
const QUALIFICATIONS_CONNUES: ReadonlySet<string> = new Set(QUALIFICATIONS_FISCALES_TRAVAUX)
const ORIGINES_CONNUES: ReadonlySet<string> = new Set(ORIGINES_MAINLEVEE)

const estCentimesPositifs = (valeur: unknown): valeur is number => Number.isInteger(valeur) && (valeur as number) > 0
const eur = (centimes: number): string => formatEurosCentimes(centimes / 100)

function verifierDate(date: string, objet: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${objet} : date invalide (${date}), AAAA-MM-JJ attendu.`)
}

/**
 * Garantie : taux stipulé de 5 % au plus (deux décimales au plus) sous retenue comme sous caution, montant pour une
 * caution ; ni taux ni caution sans garantie.
 */
function verifierGarantie({ id, garantie, tauxRetenuePct, cautionCentimes }: SaisieMarcheTravaux): void {
  if (!MODES_CONNUS.has(garantie)) throw new Error(`Marché ${id} : garantie inconnue « ${garantie} ».`)
  const taux = tauxRetenuePct ?? 0
  const caution = cautionCentimes ?? 0
  if (garantie === 'aucune') {
    if (taux !== 0) throw new Error(`Marché ${id} : taux de retenue sans retenue stipulée (garantie « aucune »).`)
    if (caution !== 0) throw new Error(`Marché ${id} : montant de caution sans caution (garantie « aucune »).`)
    return
  }
  if (!(taux > 0 && taux <= TAUX_MAXIMAL_RETENUE_GARANTIE_PCT && estAuCentieme(taux)))
    throw new Error(
      `Marché ${id} : retenue de garantie à ${taux} % ; taux stipulé au marché, ${TAUX_MAXIMAL_RETENUE_GARANTIE_PCT} % au plus, deux décimales au plus (loi n° 71-584 du 16 juillet 1971, art. 1er), sous caution aussi (al. 4 : la caution remplace la retenue stipulée « pour un montant égal »).`,
    )
  if (garantie === 'caution' && !estCentimesPositifs(cautionCentimes))
    throw new Error(`Marché ${id} : montant de la caution exigé (art. 1er, al. 4 : caution « pour un montant égal » à la retenue stipulée).`)
  if (garantie === 'retenue' && caution !== 0) throw new Error(`Marché ${id} : montant de caution sans caution (garantie « retenue »).`)
}

/** Date de fourniture de la caution : valide, sous caution seulement. */
function verifierDateCaution({ id, garantie, cautionFournieLe }: SaisieMarcheTravaux): void {
  if (cautionFournieLe == null) return
  if (garantie !== 'caution') throw new Error(`Marché ${id} : date de caution sans caution (garantie « ${garantie} »).`)
  verifierDate(cautionFournieLe, `Marché ${id}, fourniture de la caution`)
}

/** Mainlevée datée, d'origine connue, au plus tôt le jour de l'opposition. */
function verifierMainlevee(id: string, { notifieeLe, mainlevee }: OppositionGarantie): void {
  if (!mainlevee) return
  verifierDate(mainlevee.le, `Marché ${id}, mainlevée de l'opposition`)
  if (!ORIGINES_CONNUES.has(mainlevee.origine) || mainlevee.le < notifieeLe)
    throw new Error(
      `Marché ${id} : mainlevée de l'opposition (« ${mainlevee.origine} », le ${mainlevee.le}) : amiable ou décision de justice, au plus tôt le jour de l'opposition (${notifieeLe}).`,
    )
}

const DESTINATAIRES_CONNUS: ReadonlySet<string> = new Set(DESTINATAIRES_OPPOSITION)

/**
 * Opposition motivée, datée de sa présentation ; envoi au plus tard ce jour-là et destinataire connu (J67, R63) ; sa
 * mainlevée.
 */
function verifierOpposition(id: string, opposition: OppositionGarantie): void {
  verifierDate(opposition.notifieeLe, `Marché ${id}, opposition`)
  if (!opposition.motif.trim())
    throw new Error(`Marché ${id} : opposition « motivée par l'inexécution des obligations de l'entrepreneur » (loi n° 71-584, art. 2) : motif exigé.`)
  const { envoyeeLe, destinataire } = opposition
  if (envoyeeLe != null) {
    verifierDate(envoyeeLe, `Marché ${id}, envoi de l'opposition`)
    if (envoyeeLe > opposition.notifieeLe)
      throw new Error(`Marché ${id} : envoi de l'opposition le ${envoyeeLe}, après sa présentation le ${opposition.notifieeLe} (J67, R63).`)
  }
  if (destinataire != null && !DESTINATAIRES_CONNUS.has(destinataire))
    throw new Error(`Marché ${id} : destinataire de l'opposition inconnu « ${destinataire} » (caution, consignataire, entreprise ou autre).`)
  verifierMainlevee(id, opposition)
}

/**
 * Réception datée ; opposition (et oppositions remplacées, J67, R64) motivées sur un marché garanti, et leur mainlevée ;
 * une opposition antérieure à la réception est admise et signalée (J67, R64).
 */
function verifierReceptionEtOpposition({ id, garantie, dateReception, opposition, oppositionsPrecedentes }: SaisieMarcheTravaux): void {
  if (dateReception) verifierDate(dateReception, `Marché ${id}, réception`)
  const oppositions = [...(oppositionsPrecedentes ?? []), ...(opposition ? [opposition] : [])]
  if (oppositions.length === 0) return
  if (garantie === 'aucune') throw new Error(`Marché ${id} : opposition sans garantie (ni retenue ni caution).`)
  for (const o of oppositions) verifierOpposition(id, o)
}

/**
 * Historique des cautions (J67, R65) : celui saisi, à défaut la seule caution actuelle ; vide hors caution. Saisi : sous
 * caution, non vide, montants en centimes entiers strictement positifs, dates de fourniture croissantes, la première
 * seule sans date ; la caution actuelle saisie (montant, date) égale la dernière.
 */
function cautionsDuMarche({ id, garantie, cautions, cautionCentimes, cautionFournieLe }: SaisieMarcheTravaux): CautionDuMarche[] {
  if (cautions == null) return garantie === 'caution' && estCentimesPositifs(cautionCentimes) ? [{ montantCentimes: cautionCentimes, fournieLe: cautionFournieLe ?? null }] : []
  const refus = (raison: string): Error => new Error(`Marché ${id} : historique des cautions ${raison} (J67, R65).`)
  if (garantie !== 'caution') throw refus(`sans caution (garantie « ${garantie} »)`)
  if (cautions.length === 0) throw refus('vide')
  let precedente: string | null = null
  cautions.forEach(({ montantCentimes, fournieLe }, rang) => {
    if (!estCentimesPositifs(montantCentimes)) throw refus(`: montant (${montantCentimes}) en centimes entiers strictement positifs attendu`)
    if (fournieLe === null) {
      if (rang > 0) throw refus(': seule la première caution peut être sans date de fourniture')
      return
    }
    verifierDate(fournieLe, `Marché ${id}, fourniture de la caution`)
    if (precedente !== null && fournieLe <= precedente) throw refus(': dates de fourniture croissantes attendues')
    precedente = fournieLe
  })
  const actuelle = cautions[cautions.length - 1]
  if ((cautionCentimes != null && cautionCentimes !== actuelle.montantCentimes) || (cautionFournieLe != null && cautionFournieLe !== actuelle.fournieLe))
    throw new Error(`Marché ${id} : caution actuelle (montant, date) différente de la dernière de l'historique des cautions (J67, R65).`)
  return cautions.map((c) => ({ ...c }))
}

/** Retenue limitée à la différence (J70) : sous caution seulement, avec un motif enregistré. */
function verifierRetenueALaDifference({ id, garantie, retenueLimiteeALaDifference: option }: SaisieMarcheTravaux): void {
  if (option == null) return
  if (garantie !== 'caution') throw new Error(`Marché ${id} : retenue limitée à la différence avec la caution, sous caution seulement (J70).`)
  if (!option.motif.trim()) throw new Error(`Marché ${id} : retenue limitée à la différence avec la caution : motif exigé (J70).`)
}

/** Libération de la caution confirmée (J67, R64) : sous caution seulement, datée, motif et collaborateur saisis. */
function verifierLiberationCaution({ id, garantie, liberationCautionConfirmee: confirmation }: SaisieMarcheTravaux): void {
  if (confirmation == null) return
  if (garantie !== 'caution') throw new Error(`Marché ${id} : libération de la caution confirmée sans caution (garantie « ${garantie} »).`)
  verifierDate(confirmation.le, `Marché ${id}, confirmation de la libération de la caution`)
  if (!confirmationSaisie(confirmation))
    throw new Error(`Marché ${id} : confirmation de la libération de la caution : motif et collaborateur exigés (J67, R64).`)
}

/** Déduction fiscale : centimes entiers, au plus le marché, qualifiée dès qu'elle est positive. */
function verifierDeduction({ id, montantTtcCentimes, qualificationFiscale, deductionFiscaleCentimes }: SaisieMarcheTravaux): void {
  if (qualificationFiscale != null && !QUALIFICATIONS_CONNUES.has(qualificationFiscale))
    throw new Error(`Marché ${id} : qualification fiscale inconnue « ${qualificationFiscale} ».`)
  const deduction = deductionFiscaleCentimes ?? 0
  if (!Number.isInteger(deduction) || deduction < 0 || deduction > montantTtcCentimes)
    throw new Error(`Marché ${id} : déduction fiscale (${deduction}) en centimes entiers positifs, au plus le montant du marché.`)
  if (deduction > 0 && !qualificationFiscale)
    throw new Error(`Marché ${id} : déduction fiscale sans qualification des travaux (CGI art. 31, I, 1°, a, b ou b bis).`)
}

/**
 * Champs facultatifs à leur valeur par défaut : ni taux, ni caution, ni réception, ni opposition, ni déduction ; la
 * caution actuelle est la dernière de l'historique (J67, R65).
 */
function normaliserMarche(saisie: SaisieMarcheTravaux, cautions: CautionDuMarche[]): MarcheTravaux {
  const actuelle = cautions.at(-1)
  return {
    ...saisie,
    tauxRetenuePct: saisie.tauxRetenuePct ?? 0,
    cautionCentimes: actuelle?.montantCentimes ?? saisie.cautionCentimes ?? 0,
    cautionFournieLe: actuelle ? actuelle.fournieLe : (saisie.cautionFournieLe ?? null),
    cautions,
    retenueLimiteeALaDifference: saisie.retenueLimiteeALaDifference ?? null,
    dateReception: saisie.dateReception ?? null,
    reserves: saisie.reserves ?? false,
    opposition: saisie.opposition ?? null,
    oppositionsPrecedentes: [...(saisie.oppositionsPrecedentes ?? [])],
    liberationCautionConfirmee: saisie.liberationCautionConfirmee ?? null,
    qualificationFiscale: saisie.qualificationFiscale ?? null,
    deductionFiscaleCentimes: saisie.deductionFiscaleCentimes ?? 0,
  }
}

/**
 * Crée le marché garanti d'une opération : garantie (historique des cautions, J67, R65 ; retenue limitée à la
 * différence, J70), réception, opposition, libération de la caution confirmée (J67, R64), qualification et déduction
 * fiscales.
 */
export function creerMarcheTravaux(saisie: SaisieMarcheTravaux): MarcheTravaux {
  const { id, travauxId, montantTtcCentimes } = saisie
  if (!id.trim() || !saisie.coproprieteId.trim() || !saisie.fournisseurId.trim())
    throw new Error('Marché : identifiant, syndicat et fournisseur exigés.')
  if (!/^[0-9A-Z]{5}$/.test(travauxId)) throw new Error(`Marché ${id} : n° d'opération « ${travauxId} », 5 caractères attendus.`)
  if (!estCentimesPositifs(montantTtcCentimes)) throw new Error(`Marché ${id} : montant (${montantTtcCentimes}) en centimes entiers strictement positifs.`)
  const cautions = cautionsDuMarche(saisie)
  const actuelle = cautions.at(-1)
  const avecCautionActuelle = actuelle ? { ...saisie, cautionCentimes: actuelle.montantCentimes, cautionFournieLe: actuelle.fournieLe } : saisie
  verifierGarantie(avecCautionActuelle)
  verifierDateCaution(avecCautionActuelle)
  verifierRetenueALaDifference(saisie)
  verifierReceptionEtOpposition(saisie)
  verifierLiberationCaution(saisie)
  verifierDeduction(saisie)
  return normaliserMarche(saisie, cautions)
}

/** Retenue stipulée sur le montant du marché (taux du marché, retenueAuTaux) : ce que la caution doit égaler (al. 4). */
export const retenueStipuleeDuMarche = (marche: Pick<MarcheTravaux, 'montantTtcCentimes' | 'tauxRetenuePct'>): number =>
  retenueAuTaux(marche.montantTtcCentimes, marche.tauxRetenuePct)

/**
 * Caution fournie à la date donnée : la dernière de l'historique fournie ce jour ou avant (sans date de fourniture : dès
 * le marché) ; null : aucune, ou hors caution. Date null : la caution actuelle (J67, R65).
 */
function cautionALaDate(marche: MarcheTravaux, le: string | null): CautionDuMarche | null {
  if (marche.garantie !== 'caution') return null
  const fournies = le === null ? marche.cautions : marche.cautions.filter((c) => c.fournieLe === null || c.fournieLe <= le)
  return fournies.at(-1) ?? null
}

/**
 * Caution fournie « pour un montant égal » à la retenue stipulée (art. 1er, al. 4), à la date donnée (null : la caution
 * actuelle) : la retenue n'est pas pratiquée.
 */
function cautionCouvreLaRetenue(marche: MarcheTravaux, le: string | null = null): boolean {
  const caution = cautionALaDate(marche, le)
  return caution !== null && caution.montantCentimes >= retenueStipuleeDuMarche(marche)
}

/**
 * Motif pour lequel la retenue n'est pas pratiquée à la date donnée (null : à ce jour) : sans retenue stipulée (art. 1er,
 * al. 1), ou sous une caution d'un montant au moins égal déjà fournie (al. 4) ; null quand elle se pratique (retenue
 * stipulée, caution inférieure à elle, ou pas encore fournie).
 */
function motifRetenueInterdite(marche: MarcheTravaux, le: string | null = null): string | null {
  if (marche.garantie === 'aucune')
    return `sans retenue stipulée au marché ${marche.id} (art. 1er : retenue « garantissant contractuellement l'exécution des travaux »)`
  const caution = cautionALaDate(marche, le)
  if (caution === null || !cautionCouvreLaRetenue(marche, le)) return null
  const fournie = caution.fournieLe ? ` fournie le ${dateIsoVersFr(caution.fournieLe)}` : ''
  return `sur un marché couvert par une caution de ${eur(caution.montantCentimes)}${fournie}, « pour un montant égal » à la retenue stipulée de ${eur(retenueStipuleeDuMarche(marche))} : la retenue « n'est pas pratiquée » (loi n° 71-584, art. 1er, al. 4)`
}

/**
 * Retenue attendue sur une facture du marché, à sa date (null : à ce jour) : au taux du marché (retenueAuTaux) ; sous une
 * caution inférieure et l'option « différence » du marché (J70), la retenue stipulée moins la caution alors fournie, au
 * prorata de la facture (plus forts restes, en calcul entier), bornée par la retenue au taux.
 */
function retenueAttendue(marche: MarcheTravaux, totalTtcCentimes: number, le: string | null): number {
  const auTaux = retenueAuTaux(totalTtcCentimes, marche.tauxRetenuePct)
  const caution = marche.retenueLimiteeALaDifference ? cautionALaDate(marche, le) : null
  if (caution === null) return auTaux
  const difference = Math.max(0, retenueStipuleeDuMarche(marche) - caution.montantCentimes)
  const [prorata] = repartirAuxPlusFortsRestes(difference, [totalTtcCentimes, Math.max(0, marche.montantTtcCentimes - totalTtcCentimes)])
  return Math.min(auTaux, prorata)
}

/**
 * Expiration du délai d'un an à compter de la réception (art. 2) : même quantième un an après, sans report au jour
 * ouvrable (J67, R63 ; par analogie, CPC art. 641 et 642) ; null sans réception.
 */
export const expirationDelaiGarantie = ({ dateReception }: Pick<MarcheTravaux, 'dateReception'>): string | null =>
  dateReception ? ajouterMois(dateReception, 12) : null

/**
 * Simple information, jamais retenue : délai parti du lendemain de la réception ; cette variante n'a pas de base (J67,
 * R63 : le lendemain de J1 vient de D. 1967 art. 64-1, qui ne vise pas la retenue) ; null sans réception.
 */
export const expirationDelaiGarantieSiDepartLendemain = ({ dateReception }: Pick<MarcheTravaux, 'dateReception'>): string | null =>
  dateReception ? ajouterMois(ajouterJours(dateReception, 1), 12) : null

/**
 * Portée de l'opposition au regard du délai de l'art. 2 : à temps, présentée (ou remise) à la caution ou au consignataire
 * au plus tard le jour de l'échéance (J67, R63) ; de validité non établie, soit antérieure à la réception ou sans
 * réception datée (J67, R64), soit peut-être tardive, présentée après l'échéance mais envoyée à temps, ou sans date
 * d'envoi saisie (J67, R63 : un envoi dans le délai n'est alors pas exclu, et libérer ne se rattrape pas) ; tardive,
 * envoyée et présentée après l'échéance. `depuis` : date à partir de laquelle elle vaut (pour une opposition peut-être
 * tardive, l'envoi, ou l'échéance quand l'envoi n'est pas saisi : le dernier jour où il aurait été à temps).
 */
type PorteeOpposition = 'a_temps' | 'avant_reception' | 'peut_etre_tardive' | 'tardive'

function porteeDeLOpposition(marche: MarcheTravaux, expiration: string | null): { portee: PorteeOpposition; depuis: string } | null {
  const { opposition, dateReception } = marche
  if (!opposition) return null
  const { notifieeLe, envoyeeLe } = opposition
  if (!dateReception || expiration === null || notifieeLe < dateReception) return { portee: 'avant_reception', depuis: notifieeLe }
  if (notifieeLe <= expiration) return { portee: 'a_temps', depuis: notifieeLe }
  if (envoyeeLe == null) return { portee: 'peut_etre_tardive', depuis: expiration }
  if (envoyeeLe <= expiration) return { portee: 'peut_etre_tardive', depuis: envoyeeLe }
  return { portee: 'tardive', depuis: notifieeLe }
}

const PORTEES_DOUTEUSES: ReadonlySet<PorteeOpposition> = new Set<PorteeOpposition>(['avant_reception', 'peut_etre_tardive'])

/** L'opposition d'une portée donnée vaut au jour donné : depuis sa date, sans mainlevée à cette date. */
function oppositionValantLe(marche: MarcheTravaux, expiration: string | null, le: string, douteuse: boolean): boolean {
  const lecture = porteeDeLOpposition(marche, expiration)
  if (!lecture || PORTEES_DOUTEUSES.has(lecture.portee) !== douteuse || lecture.portee === 'tardive' || lecture.depuis > le) return false
  const mainlevee = marche.opposition?.mainlevee
  return !mainlevee || mainlevee.le > le
}

/** Opposition qui retient la garantie au jour donné : à temps, ce jour ou avant, sans mainlevée à cette date. */
const oppositionEnCours = (marche: MarcheTravaux, expiration: string | null, le: string): boolean => oppositionValantLe(marche, expiration, le, false)

/**
 * Opposition dont la validité n'est pas établie, en cours au jour donné : ni blocage ni libération automatiques, la
 * libération demande une confirmation motivée et tracée du gestionnaire (J67, R63 et R64).
 */
const oppositionDouteuseEnCours = (marche: MarcheTravaux, expiration: string | null, le: string): boolean => oppositionValantLe(marche, expiration, le, true)

// ─── Factures, consignations, restitutions ───────────────────────────────────────────────────

interface RattacheAuMarche {
  coproprieteId: string
  marcheId: string
}

/** Facture du marché : TTC, avancement et retenue de l'en-tête (facture-ventilee.ts, EnTeteFactureTravaux). */
export interface FactureDuMarche extends RattacheAuMarche {
  id: string
  date: string
  totalTtcCentimes: number
  avancementPct?: number | null
  retenueGarantieCentimes?: number | null
}

/** Somme consignée (art. 1er, al. 2) ; consignataire désigné par son identifiant, sans donnée personnelle. */
export interface ConsignationRetenue extends RattacheAuMarche {
  id: string
  le: string
  montantCentimes: number
  consignataireId: string
}

/** Retenue restituée à l'entrepreneur (libération, ou mainlevée anticipée). */
export interface RestitutionRetenue extends RattacheAuMarche {
  id: string
  le: string
  montantCentimes: number
  /** Écriture de libération (ecritureLiberationRetenue) ; absente : saisie sans écriture. */
  traitementId?: string | null
  /** Confirmation du gestionnaire, quand une opposition de validité non établie est en cours (J67, R63 et R64). */
  confirmation?: ConfirmationLiberation | null
}

const duMarche =
  (marche: MarcheTravaux) =>
  (objet: RattacheAuMarche): boolean =>
    objet.marcheId === marche.id && objet.coproprieteId === marche.coproprieteId

const somme = (objets: readonly { montantCentimes: number }[]): number => objets.reduce((s, o) => s + o.montantCentimes, 0)

const retenueDe = (f: Pick<FactureDuMarche, 'retenueGarantieCentimes'>): number => f.retenueGarantieCentimes ?? 0

/** Retenue en centimes entiers, positive ou nulle, au plus le TTC de la facture. */
const retenueValide = (f: Pick<FactureDuMarche, 'retenueGarantieCentimes' | 'totalTtcCentimes'>): boolean => {
  const retenue = retenueDe(f)
  return Number.isInteger(retenue) && retenue >= 0 && retenue <= f.totalTtcCentimes
}

/** Retenue comptée dans les totaux : une retenue invalide (signalée, bloquante) n'y entre pas. */
const retenueComptee = (f: Pick<FactureDuMarche, 'retenueGarantieCentimes' | 'totalTtcCentimes'>): number => (retenueValide(f) ? retenueDe(f) : 0)

/**
 * En-tête « travaux » de la facture d'un marché, entrée d'ecritureFactureVentilee : avancement déclaré et retenue, au taux
 * du marché par défaut (retenueAuTaux) ; aucune retenue sans retenue stipulée ni sous une caution « pour un montant égal »
 * (art. 1er, al. 1 et 4), fournie à la date de la facture (sans date : la caution actuelle) ; sous une caution
 * inférieure, ou avant sa fourniture, la retenue stipulée se pratique en entier (J70, défaut), ou, si le marché le
 * choisit avec un motif, la seule différence avec la caution, au prorata de la facture (J70 : retenueAttendue).
 */
export function enTeteFactureDuMarche(
  marche: MarcheTravaux,
  {
    totalTtcCentimes,
    avancementPct,
    retenueCentimes = null,
    date = null,
  }: { totalTtcCentimes: number; avancementPct: number | null; retenueCentimes?: number | null; date?: string | null },
): Required<EnTeteFactureTravaux> {
  if (!estCentimesPositifs(totalTtcCentimes)) throw new Error(`Marché ${marche.id} : TTC de la facture (${totalTtcCentimes}) en centimes entiers strictement positifs.`)
  if (date !== null) verifierDate(date, `Marché ${marche.id}, facture`)
  const interdite = motifRetenueInterdite(marche, date)
  if (interdite) {
    if ((retenueCentimes ?? 0) !== 0) throw new Error(`Marché ${marche.id} : retenue ${interdite}.`)
    return { avancementPct, retenueGarantie: null }
  }
  const montantCentimes = retenueCentimes ?? retenueAttendue(marche, totalTtcCentimes, date)
  return { avancementPct, retenueGarantie: { montantCentimes, travauxId: marche.travauxId, marcheId: marche.id } }
}

const parDateEtId = <T extends { id: string }>(date: (o: T) => string) => (a: T, b: T): number =>
  date(a).localeCompare(date(b)) || a.id.localeCompare(b.id)

// ─── Anomalies ───────────────────────────────────────────────────────────────────────────────

export type GraviteAnomalieRetenue = 'bloquant' | 'avertissement' | 'information'

export type CodeAnomalieRetenue =
  | 'facture_invalide'
  | 'retenue_invalide'
  | 'avancement_invalide'
  | 'retenue_non_stipulee'
  | 'retenue_malgre_caution'
  | 'retenue_non_pratiquee'
  | 'retenue_au_dela_du_plafond'
  | 'ecart_taux_contractuel'
  | 'caution_insuffisante'
  | 'avancement_en_baisse'
  | 'facture_au_dela_du_marche'
  | 'facture_au_dela_de_l_avancement'
  | 'consignation_invalide'
  | 'consignation_insuffisante'
  | 'restitution_invalide'
  | 'restitution_au_dela_du_retenu'
  | 'restitution_anticipee'
  | 'restitution_malgre_opposition'
  | 'restitution_sans_confirmation'
  | 'opposition_tardive'
  | 'opposition_peut_etre_tardive'
  | 'opposition_avant_reception'
  | 'opposition_mauvais_destinataire'
  | 'reception_non_datee'
  | 'regle_au_dela_du_du'
  | 'deduction_sur_construction'
  | 'retenue_hors_marche'

/** Anomalie au format du point 31 (travaux-budget.ts), avec l'objet concerné. */
export interface AnomalieRetenue {
  code: CodeAnomalieRetenue
  gravite: GraviteAnomalieRetenue
  /** Marché, facture ou restitution concernés. */
  objetId: string
  message: string
  /** Texte qui fonde le signalement ; null pour une règle de gestion (aucun texte cité). */
  fondement: string | null
  /**
   * Repère qui reste à confirmer (J67, R63 et R64 : jour exact du délai de l'art. 2, opposition antérieure à la réception
   * ou peut-être tardive, faute de texte ou d'arrêt).
   */
  aConfirmer: boolean
}

const LOI_1971 = 'Loi n° 71-584 du 16/07/1971'
const FONDEMENTS = {
  plafond: `${LOI_1971}, art. 1er, al. 1`,
  consignation: `${LOI_1971}, art. 1er, al. 2 et 3`,
  caution: `${LOI_1971}, art. 1er, al. 4`,
  liberation: `${LOI_1971}, art. 2`,
  construction: 'CGI art. 31, I, 1°, b',
} as const

const anomalie = (
  code: CodeAnomalieRetenue,
  gravite: GraviteAnomalieRetenue,
  objetId: string,
  message: string,
  fondement: string | null = null,
  aConfirmer = false,
): AnomalieRetenue => ({ code, gravite, objetId, message, fondement, aConfirmer })

/** Facture sans retenue (nulle ou absente) sur un marché à retenue stipulée : paiement non garanti (avertissement). */
function anomalieSansRetenue(marche: MarcheTravaux, f: FactureDuMarche): AnomalieRetenue | null {
  if (marche.garantie !== 'retenue') return null
  const attendue = retenueAuTaux(f.totalTtcCentimes, marche.tauxRetenuePct)
  if (attendue === 0) return null
  return anomalie('retenue_non_pratiquee', 'avertissement', f.id, `Facture ${f.id} : aucune retenue, ${eur(attendue)} au taux du marché (${marche.tauxRetenuePct} %) ; ce paiement n'est pas garanti par la retenue stipulée.`)
}

/** Retenue non entière, négative ou au-delà du TTC : bloquante, et hors des totaux (retenueComptee). */
const anomalieRetenueInvalide = (f: Pick<FactureDuMarche, 'id' | 'retenueGarantieCentimes'>): AnomalieRetenue =>
  anomalie('retenue_invalide', 'bloquant', f.id, `Facture ${f.id} : retenue de ${retenueDe(f)} centimes ; entier positif, au plus le TTC de la facture.`)

/** Retenue d'une facture : pratiquée au marché, entière, 5 % au plus du TTC, au taux du marché. */
function anomalieRetenueFacture(marche: MarcheTravaux, f: FactureDuMarche): AnomalieRetenue | null {
  const retenue = retenueDe(f)
  if (retenue === 0) return anomalieSansRetenue(marche, f)
  if (!retenueValide(f)) return anomalieRetenueInvalide(f)
  const interdite = motifRetenueInterdite(marche, f.date)
  if (interdite) {
    const parCaution = marche.garantie === 'caution'
    return anomalie(parCaution ? 'retenue_malgre_caution' : 'retenue_non_stipulee', 'bloquant', f.id, `Facture ${f.id} : retenue de ${eur(retenue)} ${interdite}.`, parCaution ? FONDEMENTS.caution : FONDEMENTS.plafond)
  }
  if (retenueAuDelaDuPlafond(f.totalTtcCentimes, retenue))
    return anomalie('retenue_au_dela_du_plafond', 'bloquant', f.id, `Facture ${f.id} : retenue de ${eur(retenue)} au-delà de ${TAUX_MAXIMAL_RETENUE_GARANTIE_PCT} % de ${eur(f.totalTtcCentimes)} (art. 1er, al. 1).`, FONDEMENTS.plafond)
  const attendue = retenueAttendue(marche, f.totalTtcCentimes, f.date)
  if (retenue === attendue) return null
  const base =
    attendue === retenueAuTaux(f.totalTtcCentimes, marche.tauxRetenuePct)
      ? `au taux du marché (${marche.tauxRetenuePct} %)`
      : 'attendus : différence entre la retenue stipulée et la caution, au prorata de la facture (J70)'
  return anomalie('ecart_taux_contractuel', 'avertissement', f.id, `Facture ${f.id} : retenue de ${eur(retenue)}, ${eur(attendue)} ${base}.`)
}

/** Date saisie (AAAA-MM-JJ, jour du calendrier) : null si valide, le motif sinon. */
const motifDate = (date: unknown): string | null => (estDateIsoValide(date) ? null : `date « ${String(date)} » invalide, AAAA-MM-JJ attendu`)

/** Montant saisi (centimes entiers strictement positifs) : null si valide, le motif sinon. */
const motifMontant = (libelle: string, centimes: number): string | null =>
  estCentimesPositifs(centimes) ? null : `${libelle} de ${centimes} centimes, entier strictement positif attendu`

/** Facture : date et TTC (comme l'en-tête de la facture, enTeteFactureDuMarche). */
const motifsFacture = (f: Pick<FactureDuMarche, 'date' | 'totalTtcCentimes'>): (string | null)[] => [motifDate(f.date), motifMontant('TTC', f.totalTtcCentimes)]

/** Consignation ou restitution : date et montant. */
const motifsMouvementRetenue = (o: { le: string; montantCentimes: number }): (string | null)[] => [motifDate(o.le), motifMontant('montant', o.montantCentimes)]

const estFactureValide = (f: Pick<FactureDuMarche, 'date' | 'totalTtcCentimes'>): boolean => motifsFacture(f).every((motif) => motif === null)

/** Saisie contrôlée : facture, consignation ou restitution. */
interface RegleSaisie<T> {
  code: 'facture_invalide' | 'consignation_invalide' | 'restitution_invalide'
  nature: 'Facture' | 'Consignation' | 'Restitution'
  motifs: (objet: T) => (string | null)[]
  /** Sort de la saisie invalide, à la fin du message ; absent : « écartée des totaux ». */
  sort?: (objet: T) => string
}

/**
 * Restitution au montant valide (centimes entiers strictement positifs) : comptée au restitué même mal datée, son montant
 * étant connu (🔵) ; seule sa date est écartée.
 */
const restitutionComptee = (r: Pick<RestitutionRetenue, 'montantCentimes'>): boolean => estCentimesPositifs(r.montantCentimes)

const REGLE_FACTURE: RegleSaisie<Pick<FactureDuMarche, 'date' | 'totalTtcCentimes'>> = { code: 'facture_invalide', nature: 'Facture', motifs: motifsFacture }
const REGLE_CONSIGNATION: RegleSaisie<ConsignationRetenue> = { code: 'consignation_invalide', nature: 'Consignation', motifs: motifsMouvementRetenue }
const REGLE_RESTITUTION: RegleSaisie<RestitutionRetenue> = {
  code: 'restitution_invalide',
  nature: 'Restitution',
  motifs: motifsMouvementRetenue,
  sort: (r) => (restitutionComptee(r) ? "montant compté au restitué, date écartée (dernière restitution, restitution anticipée ou malgré l'opposition)" : 'écartée des totaux'),
}

/**
 * Saisies valides (date et montant) et anomalies bloquantes des autres, écartées de tous les totaux et de tous les
 * classements comme une retenue invalide (facturé, retenu, avancement, consigné, restitué, dernière restitution, reste
 * retenu, dû, garantie de l'opération, échéance), sans erreur qui interrompe le suivi ; l'ordre est conservé. Le message
 * dit le sort de la saisie : une restitution dont seule la date est invalide garde son montant au restitué
 * (REGLE_RESTITUTION, restitutionComptee).
 */
function separerSaisiesValides<T extends { id: string }>(objets: readonly T[], { code, nature, motifs, sort }: RegleSaisie<T>): { valides: T[]; anomalies: AnomalieRetenue[] } {
  const valides: T[] = []
  const anomalies: AnomalieRetenue[] = []
  for (const objet of objets) {
    const releves = motifs(objet).filter((motif): motif is string => motif !== null)
    if (releves.length === 0) valides.push(objet)
    else anomalies.push(anomalie(code, 'bloquant', objet.id, `${nature} ${objet.id} : ${releves.join(' ; ')} ; ${sort?.(objet) ?? 'écartée des totaux'}.`))
  }
  return { valides, anomalies }
}

/** Avancement : jamais en baisse d'une facture à l'autre (ordre des dates) ; rend le dernier avancement déclaré. */
function lireAvancements(factures: readonly FactureDuMarche[], anomalies: AnomalieRetenue[]): number | null {
  let dernier: number | null = null
  for (const f of factures) {
    const avancement = f.avancementPct
    if (avancement == null) continue
    if (!estPourcentage(avancement) || !estAuCentieme(avancement)) {
      anomalies.push(anomalie('avancement_invalide', 'bloquant', f.id, `Facture ${f.id} : avancement de ${avancement} % ; entre 0 et 100, deux décimales au plus, attendu.`))
      continue
    }
    if (dernier !== null && avancement < dernier)
      anomalies.push(anomalie('avancement_en_baisse', 'avertissement', f.id, `Facture ${f.id} : avancement de ${avancement} % après ${dernier} % ; l'avancement déclaré est cumulé.`))
    dernier = avancement
  }
  return dernier
}

/** Facturé au-delà du marché, ou de l'avancement déclaré (montant × dernier avancement), en calcul entier exact. */
function anomaliesFacture(marche: MarcheTravaux, factureCentimes: number, avancement: number | null): AnomalieRetenue[] {
  const anomalies: AnomalieRetenue[] = []
  if (factureCentimes > marche.montantTtcCentimes)
    anomalies.push(anomalie('facture_au_dela_du_marche', 'avertissement', marche.id, `Marché ${marche.id} : facturé ${eur(factureCentimes)} pour un marché de ${eur(marche.montantTtcCentimes)} (suppléments compris).`))
  else if (avancement !== null && factureAuDelaDeLAvancement(factureCentimes, marche.montantTtcCentimes, avancement))
    anomalies.push(anomalie('facture_au_dela_de_l_avancement', 'avertissement', marche.id, `Marché ${marche.id} : facturé ${eur(factureCentimes)} au-delà de l'avancement déclaré (${avancement} %).`))
  return anomalies
}

/** Confirmation du gestionnaire saisie : motif et collaborateur non vides (J67, R63 et R64). */
const confirmationSaisie = (c: ConfirmationLiberation | null | undefined): c is ConfirmationLiberation =>
  Boolean(c?.motif.trim() && c.confirmeePar.trim())

const SANS_LIBERATION_AUTOMATIQUE =
  'ni blocage ni libération automatiques : la libération demande une confirmation motivée et tracée du gestionnaire'

/**
 * Restitutions : le restitué (restitutions mal datées comprises) au plus le retenu ; les restitutions datées, malgré une
 * opposition à temps en cours à leur date (ce jour ou avant, sans mainlevée), sous une opposition de validité non établie
 * sans confirmation du gestionnaire (J67, R63 et R64), ou anticipées (au plus tard à l'expiration : mainlevée anticipée,
 * information qui rappelle Cass. 3e civ., 09/02/2000, n° 98-15.139 ; J67, R65).
 */
function anomaliesRestitutions(
  marche: MarcheTravaux,
  { datees, restitue, retenu, expiration }: { datees: readonly RestitutionRetenue[]; restitue: number; retenu: number; expiration: string | null },
): AnomalieRetenue[] {
  const anomalies: AnomalieRetenue[] = []
  if (restitue > retenu)
    anomalies.push(anomalie('restitution_au_dela_du_retenu', 'bloquant', marche.id, `Marché ${marche.id} : restitué ${eur(restitue)} pour ${eur(retenu)} retenus.`))
  for (const r of datees) {
    const quand = `Restitution ${r.id} du ${dateIsoVersFr(r.le)}`
    if (oppositionEnCours(marche, expiration, r.le))
      anomalies.push(anomalie('restitution_malgre_opposition', 'avertissement', r.id, `${quand} malgré l'opposition notifiée le ${dateIsoVersFr(marche.opposition?.notifieeLe ?? r.le)}, sans mainlevée (art. 2).`, FONDEMENTS.liberation, true))
    else if (oppositionDouteuseEnCours(marche, expiration, r.le) && !confirmationSaisie(r.confirmation))
      anomalies.push(
        anomalie('restitution_sans_confirmation', 'avertissement', r.id, `${quand} sous une opposition dont la validité n'est pas établie, sans confirmation : ${SANS_LIBERATION_AUTOMATIQUE} (art. 2 ; J67, R63 et R64).`, FONDEMENTS.liberation, true),
      )
    else if (!expiration || r.le <= expiration)
      anomalies.push(
        anomalie(
          'restitution_anticipee',
          'information',
          r.id,
          `${quand} avant l'expiration du délai d'un an depuis la réception : mainlevée anticipée à justifier ; admise après une réception sans réserve, sans réclamation précise du maître de l'ouvrage (Cass. 3e civ., 09/02/2000, n° 98-15.139 ; J67, R65).`,
          FONDEMENTS.liberation,
          true,
        ),
      )
  }
  return anomalies
}

/**
 * Caution actuelle inférieure à la retenue stipulée : la condition « pour un montant égal » (art. 1er, al. 4) n'est pas
 * remplie ; par défaut, avertissement, la retenue stipulée se pratique en entier ; avec l'option « différence » du marché,
 * information qui en rappelle le motif (J70).
 */
function anomalieCaution(marche: MarcheTravaux): AnomalieRetenue[] {
  if (marche.garantie !== 'caution' || cautionCouvreLaRetenue(marche)) return []
  const stipulee = retenueStipuleeDuMarche(marche)
  const constat = `Marché ${marche.id} : caution de ${eur(marche.cautionCentimes)} pour une retenue stipulée de ${eur(stipulee)} (${marche.tauxRetenuePct} % de ${eur(marche.montantTtcCentimes)}) ; la retenue « n'est pas pratiquée » si la caution est fournie « pour un montant égal » (loi n° 71-584, art. 1er, al. 4) : condition non remplie`
  const option = marche.retenueLimiteeALaDifference
  if (option)
    return [
      anomalie(
        'caution_insuffisante',
        'information',
        marche.id,
        `${constat} ; retenue limitée à la différence (${eur(stipulee - marche.cautionCentimes)}), au prorata de chaque facture, choix du cabinet pour ce marché (motif : ${option.motif.trim()} ; J70).`,
        FONDEMENTS.caution,
      ),
    ]
  return [anomalie('caution_insuffisante', 'avertissement', marche.id, `${constat}, la retenue stipulée peut être pratiquée.`, FONDEMENTS.caution)]
}

/** Garantie : caution d'un montant égal, consignation complète (art. 1er, al. 2 à 4), réception datée (art. 2). */
function anomaliesGarantie(marche: MarcheTravaux, { retenu, consigne, expiration }: { retenu: number; consigne: number; expiration: string | null }): AnomalieRetenue[] {
  const anomalies: AnomalieRetenue[] = anomalieCaution(marche)
  if (consigne < retenu)
    anomalies.push(anomalie('consignation_insuffisante', 'avertissement', marche.id, `Marché ${marche.id} : ${eur(retenu)} retenus, ${eur(consigne)} consignés ; le maître de l'ouvrage consigne une somme égale à la retenue et complète la consignation (loi n° 71-584, art. 1er, al. 2 et 3).`, FONDEMENTS.consignation))
  if (!expiration && (retenu > 0 || marche.garantie === 'caution'))
    anomalies.push(anomalie('reception_non_datee', 'information', marche.id, `Marché ${marche.id} : réception non datée ; le délai d'un an de l'art. 2 ne court pas.`, FONDEMENTS.liberation))
  return anomalies
}

const RENOUVELER_L_OPPOSITION = "la notifier de nouveau, motivée par les réserves ou l'inexécution, à la caution ou au consignataire"

/**
 * Opposition présentée après l'échéance, envoyée dans le délai ou sans date d'envoi saisie (J67, R63) : peut-être
 * tardive, à confirmer ; sans date d'envoi, le message dit de la saisir (envoyée après l'échéance, elle est tardive).
 */
function messagePeutEtreTardive(id: string, opposition: OppositionGarantie, expiration: string): string {
  const presentee = `présentée le ${dateIsoVersFr(opposition.notifieeLe)}, après l'expiration du ${dateIsoVersFr(expiration)}`
  const suite = `opposition peut-être tardive, à confirmer ; ${SANS_LIBERATION_AUTOMATIQUE} (loi n° 71-584, art. 2 ; J67, R63).`
  if (opposition.envoyeeLe == null)
    return `Marché ${id} : opposition ${presentee}, sans date d'envoi saisie : un envoi dans le délai n'est pas exclu ; saisir la date d'envoi (envoyée après l'échéance, elle n'empêche pas la libération) ; d'ici là, ${suite}`
  return `Marché ${id} : opposition envoyée le ${dateIsoVersFr(opposition.envoyeeLe)}, dans le délai, mais ${presentee} : ${suite}`
}

/** Message selon la portée de l'opposition (J67, R63 et R64) ; null quand elle est à temps. */
function messageDeLaPortee(marche: MarcheTravaux, portee: PorteeOpposition, expiration: string | null): string | null {
  const { opposition, dateReception } = marche
  if (!opposition || portee === 'a_temps') return null
  const notifiee = `Marché ${marche.id} : opposition notifiée le ${dateIsoVersFr(opposition.notifieeLe)}`
  if (portee === 'tardive')
    return `${notifiee}, après l'expiration du délai le ${dateIsoVersFr(expiration ?? opposition.notifieeLe)} (art. 2) : elle n'empêche pas la libération.`
  if (portee === 'peut_etre_tardive') return messagePeutEtreTardive(marche.id, opposition, expiration ?? opposition.notifieeLe)
  if (dateReception && expiration)
    return `${notifiee}, avant la réception du ${dateIsoVersFr(dateReception)} : sa validité n'est pas établie ; ${RENOUVELER_L_OPPOSITION}, avant le ${dateIsoVersFr(expiration)} ; à l'échéance, sans nouvelle opposition, ${SANS_LIBERATION_AUTOMATIQUE} (loi n° 71-584, art. 2 ; J67, R64).`
  return `${notifiee}, sans réception datée : sa validité n'est pas établie ; dès la réception datée, ${RENOUVELER_L_OPPOSITION}, avant l'échéance ; d'ici là, ${SANS_LIBERATION_AUTOMATIQUE} (loi n° 71-584, art. 2 ; J67, R64).`
}

const CODES_DE_LA_PORTEE: Readonly<Record<Exclude<PorteeOpposition, 'a_temps'>, CodeAnomalieRetenue>> = {
  avant_reception: 'opposition_avant_reception',
  peut_etre_tardive: 'opposition_peut_etre_tardive',
  tardive: 'opposition_tardive',
}

/**
 * Opposition : antérieure à la réception (J67, R64), peut-être tardive (J67, R63) ou tardive (art. 2) : avertissement à
 * confirmer ; destinataire saisi qui n'est ni la caution ni le consignataire : avertissement (J67, R63).
 */
function anomaliesOpposition(marche: MarcheTravaux, expiration: string | null): AnomalieRetenue[] {
  const lecture = porteeDeLOpposition(marche, expiration)
  if (!lecture) return []
  const anomalies: AnomalieRetenue[] = []
  const message = messageDeLaPortee(marche, lecture.portee, expiration)
  if (message && lecture.portee !== 'a_temps') anomalies.push(anomalie(CODES_DE_LA_PORTEE[lecture.portee], 'avertissement', marche.id, message, FONDEMENTS.liberation, true))
  const destinataire = marche.opposition?.destinataire ?? null
  if (destinataire === 'entreprise' || destinataire === 'autre')
    anomalies.push(
      anomalie(
        'opposition_mauvais_destinataire',
        'avertissement',
        marche.id,
        `Marché ${marche.id} : opposition adressée ${destinataire === 'entreprise' ? "à l'entreprise" : 'à un autre destinataire'} ; l'art. 2 la veut notifiée à la caution ou au consignataire (J67, R63).`,
        FONDEMENTS.liberation,
      ),
    )
  return anomalies
}

// ─── Suivi par marché ────────────────────────────────────────────────────────────────────────

/**
 * État de la garantie : sans garantie ; restituée (tout le retenu rendu) ; sans retenue (retenue stipulée, rien de
 * retenu) ; sous opposition à temps en cours (sans mainlevée) ; avant réception ; en délai (jusqu'au jour de l'expiration
 * compris) ; opposition à confirmer (après l'expiration, sous une opposition de validité non établie : ni blocage ni
 * libération automatiques, J67, R63 et R64) ; à libérer (après l'expiration, retenue restant à verser) ; libérée
 * (caution, après l'expiration, rien de retenu : art. 2, « la caution est libérée » ; sous une opposition de validité
 * non établie, sur la confirmation du gestionnaire portée au marché, J67, R64).
 */
export type EtatGarantieMarche =
  | 'sans_garantie'
  | 'restituee'
  | 'sans_retenue'
  | 'avant_reception'
  | 'en_delai'
  | 'opposition'
  | 'opposition_a_confirmer'
  | 'a_liberer'
  | 'liberee'

export interface SuiviRetenueMarche {
  marcheId: string
  coproprieteId: string
  travauxId: string
  libelle: string
  garantie: ModeGarantieMarche
  tauxRetenuePct: number
  cautionCentimes: number
  /** Factures comptées, dans l'ordre des dates ; une facture invalide n'y est pas (anomalie « facture_invalide »). */
  factureIds: string[]
  /** Gestéam « Budget / Fact. » : facturé TTC du marché (factures invalides écartées). */
  factureCentimes: number
  /** Gestéam « Garantie » : retenu sur les factures du marché (retenues invalides écartées). */
  retenuCentimes: number
  consigneCentimes: number
  /** Restitutions au montant valide, mal datées comprises (seule leur date est écartée) ; montant invalide écarté. */
  restitueCentimes: number
  /** Date de la dernière restitution valide (Gestéam « restituée ») ; null sans restitution valide. */
  restitueLe: string | null
  resteRetenuCentimes: number
  /**
   * Saisies écartées qui faussent le reste retenu (facture invalide portant une retenue, retenue invalide, restitution au
   * montant invalide), dans l'ordre des factures puis des restitutions : la libération est refusée tant qu'il en reste.
   */
  resteRetenuFaussePar: string[]
  /**
   * Gestéam « Réglé » : fourni par l'appelant, règlements des factures comptées du marché, sans ceux d'une facture
   * écartée (facture_invalide) ; 0 par défaut.
   */
  regleCentimes: number
  /** Gestéam « Dû » : facturé − reste retenu − réglé. */
  duCentimes: number
  dernierAvancementPct: number | null
  dateReception: string | null
  /** Expiration retenue (même quantième un an après la réception, date la plus courte). */
  expirationLe: string | null
  /** Simple information, sans base (délai parti du lendemain ; J67, R63), jamais retenue ; null sans réception. */
  expirationSiDepartLendemainLe: string | null
  /** Opposition du marché (notification, motif, mainlevée) ; null sans opposition. */
  opposition: OppositionGarantie | null
  etat: EtatGarantieMarche
  anomalies: AnomalieRetenue[]
}

/**
 * Caution libérée sur la confirmation du gestionnaire (J67, R64) : confirmation datée après l'expiration, au plus tard
 * au jour donné, et plus rien de retenu à libérer (la retenue pratiquée se libère à part, avec sa propre confirmation).
 */
function cautionLibereeSurConfirmation(marche: MarcheTravaux, resteRetenu: number, expiration: string, aujourdhui: string): boolean {
  const confirmation = marche.liberationCautionConfirmee
  return marche.garantie === 'caution' && resteRetenu <= 0 && confirmation !== null && confirmation.le > expiration && confirmation.le <= aujourdhui
}

function etatGarantie(marche: MarcheTravaux, { retenu, resteRetenu, expiration, aujourdhui }: { retenu: number; resteRetenu: number; expiration: string | null; aujourdhui: string }): EtatGarantieMarche {
  if (marche.garantie === 'aucune') return 'sans_garantie'
  if (marche.garantie === 'retenue' && retenu > 0 && resteRetenu <= 0) return 'restituee'
  if (marche.garantie === 'retenue' && retenu === 0) return 'sans_retenue'
  if (oppositionEnCours(marche, expiration, aujourdhui)) return 'opposition'
  if (!expiration) return 'avant_reception'
  if (aujourdhui <= expiration) return 'en_delai'
  if (oppositionDouteuseEnCours(marche, expiration, aujourdhui) && !cautionLibereeSurConfirmation(marche, resteRetenu, expiration, aujourdhui))
    return 'opposition_a_confirmer'
  return resteRetenu > 0 ? 'a_liberer' : 'liberee'
}

/**
 * Saisies écartées qui faussent le reste retenu (🔵) : facture invalide portant une retenue et retenue invalide (leur
 * retenue manque au retenu), restitution au montant invalide (le restitué réel n'est pas connu) ; une restitution dont
 * seule la date est invalide est comptée (restitutionComptee) et ne le fausse pas.
 */
function saisiesQuiFaussentLeReste(factures: readonly FactureDuMarche[], restitutions: readonly RestitutionRetenue[]): string[] {
  const retenuesEcartees = factures.filter((f) => retenueDe(f) !== 0 && !(estFactureValide(f) && retenueValide(f)))
  return [...retenuesEcartees.map((f) => f.id), ...restitutions.filter((r) => !restitutionComptee(r)).map((r) => r.id)]
}

/** Suite d'un message quand des saisies écartées faussent le reste retenu ; vide sinon. */
const siResteFausse = (faussePar: readonly string[], suite: (liste: string) => string): string => (faussePar.length > 0 ? suite(faussePar.join(', ')) : '')

/** Réglé au-delà du dû : les saisies qui faussent le reste retenu (donc le dû) sont nommées (🔵). */
const precisionDuFausse = (faussePar: readonly string[]): string =>
  siResteFausse(faussePar, (liste) => ` ; reste retenu faussé par des saisies écartées (${liste}) : dû à revoir après leur correction`)

/**
 * Suivi de la garantie d'un marché au jour donné : factures (retenue, avancement), consignations et restitutions du
 * marché (même syndicat, D1), réglé fourni par l'appelant (sans les règlements d'une facture écartée) ; anomalies
 * bloquantes, avertissements et informations ; facture, consignation ou restitution invalide (montant, date) signalée,
 * bloquante, et écartée de tout le suivi, sauf le montant d'une restitution dont seule la date est invalide, compté au
 * restitué ; les saisies écartées qui faussent le reste retenu sont rendues (resteRetenuFaussePar).
 */
export function suiviRetenueMarche(
  marche: MarcheTravaux,
  sources: {
    factures?: readonly FactureDuMarche[]
    consignations?: readonly ConsignationRetenue[]
    restitutions?: readonly RestitutionRetenue[]
    regleCentimes?: number
  },
  aujourdhui: string,
): SuiviRetenueMarche {
  verifierDate(aujourdhui, `Suivi du marché ${marche.id}`)
  const estDuMarche = duMarche(marche)
  const facturesDuMarche = (sources.factures ?? []).filter(estDuMarche).sort(parDateEtId((f) => f.date))
  const saisies = separerSaisiesValides(facturesDuMarche, REGLE_FACTURE)
  const factures = saisies.valides
  const restitutionsDuMarche = (sources.restitutions ?? []).filter(estDuMarche).sort(parDateEtId((r) => r.le))
  const restitutions = separerSaisiesValides(restitutionsDuMarche, REGLE_RESTITUTION)
  const consignations = separerSaisiesValides((sources.consignations ?? []).filter(estDuMarche), REGLE_CONSIGNATION)
  const consigne = somme(consignations.valides)
  const factureCentimes = factures.reduce((s, f) => s + f.totalTtcCentimes, 0)
  const retenu = factures.reduce((s, f) => s + retenueComptee(f), 0)
  const restitue = somme(restitutionsDuMarche.filter(restitutionComptee))
  const regle = sources.regleCentimes ?? 0
  if (!Number.isInteger(regle) || regle < 0) throw new Error(`Marché ${marche.id} : réglé (${regle}) en centimes entiers positifs ou nuls.`)
  const expiration = expirationDelaiGarantie(marche)
  const anomalies: AnomalieRetenue[] = [...saisies.anomalies, ...factures.map((f) => anomalieRetenueFacture(marche, f)).filter((a): a is AnomalieRetenue => a !== null)]
  const avancement = lireAvancements(factures, anomalies)
  anomalies.push(
    ...anomaliesFacture(marche, factureCentimes, avancement),
    ...consignations.anomalies,
    ...anomaliesGarantie(marche, { retenu, consigne, expiration }),
    ...anomaliesOpposition(marche, expiration),
    ...restitutions.anomalies,
    ...anomaliesRestitutions(marche, { datees: restitutions.valides, restitue, retenu, expiration }),
  )
  const resteRetenu = retenu - restitue
  const faussePar = saisiesQuiFaussentLeReste(facturesDuMarche, restitutionsDuMarche)
  const du = factureCentimes - Math.max(0, resteRetenu) - regle
  if (du < 0)
    anomalies.push(anomalie('regle_au_dela_du_du', 'avertissement', marche.id, `Marché ${marche.id} : réglé ${eur(regle)}, au-delà du dû net de retenue${precisionDuFausse(faussePar)}.`))
  return {
    marcheId: marche.id,
    coproprieteId: marche.coproprieteId,
    travauxId: marche.travauxId,
    libelle: marche.libelle,
    garantie: marche.garantie,
    tauxRetenuePct: marche.tauxRetenuePct,
    cautionCentimes: marche.cautionCentimes,
    factureIds: factures.map((f) => f.id),
    factureCentimes,
    retenuCentimes: retenu,
    consigneCentimes: consigne,
    restitueCentimes: restitue,
    restitueLe: restitutions.valides.at(-1)?.le ?? null,
    resteRetenuCentimes: Math.max(0, resteRetenu),
    resteRetenuFaussePar: faussePar,
    regleCentimes: regle,
    duCentimes: Math.max(0, du),
    dernierAvancementPct: avancement,
    dateReception: marche.dateReception,
    expirationLe: expiration,
    expirationSiDepartLendemainLe: expirationDelaiGarantieSiDepartLendemain(marche),
    opposition: marche.opposition,
    etat: etatGarantie(marche, { retenu, resteRetenu, expiration, aujourdhui }),
    anomalies,
  }
}

// ─── Pied de l'opération (Gestéam « Budget / Fact. · Garantie · Réglé · Dû ») ───────────────

/** Facture de l'opération (liste des factures de la fiche travaux) : d'un marché, ou hors marché (honoraires, DO…). */
export interface FactureDeLOperation extends Omit<FactureDuMarche, 'marcheId'> {
  /** N° de l'opération de travaux (5 caractères). */
  travauxId: string
  marcheId: string | null
}

export interface PiedGarantieOperation {
  coproprieteId: string
  travauxId: string
  /** Suivi de chaque marché, réglé compris (règlements de ses factures comptées). */
  marches: SuiviRetenueMarche[]
  /** « Fact. » : facturé TTC de l'opération, factures hors marché comprises (factures invalides écartées et signalées). */
  factureCentimes: number
  /** « Garantie » : retenue restant au 47200 (reste retenu des marchés, retenues hors marché ; invalides écartées). */
  garantieCentimes: number
  /** « Réglé » : règlements payés de l'opération (reglementsDeLOperation, point 30), sans ceux d'une facture écartée. */
  regleCentimes: number
  /** « Dû » : facturé − garantie − réglé. */
  duCentimes: number
  anomalies: AnomalieRetenue[]
}

interface SourcesGarantieOperation {
  marches: readonly MarcheTravaux[]
  factures?: readonly FactureDeLOperation[]
  consignations?: readonly ConsignationRetenue[]
  restitutions?: readonly RestitutionRetenue[]
  reglements?: readonly ReglementFournisseur[]
}

/** Marchés de l'opération : même syndicat (D1), même n°. */
function verifierMarchesDeLOperation(operation: OperationTravaux, marches: readonly MarcheTravaux[]): void {
  const etranger = marches.find((m) => m.coproprieteId !== operation.coproprieteId || m.travauxId !== operation.numero)
  if (etranger)
    throw new Error(`Marché ${etranger.id} : marché d'une autre opération ou d'un autre syndicat que l'opération ${operation.numero} de ${operation.coproprieteId} (D1).`)
}

/**
 * Suivi d'un marché dans l'opération : ses factures, et le réglé des règlements de ses factures comptées (valides) ; le
 * règlement d'une facture écartée en est retiré avec elle (🔵).
 */
function suiviDansLOperation(
  operation: OperationTravaux,
  marche: MarcheTravaux,
  { factures, sources, aujourdhui }: { factures: readonly FactureDeLOperation[]; sources: SourcesGarantieOperation; aujourdhui: string },
): SuiviRetenueMarche {
  const siennes = factures.filter((f): f is FactureDeLOperation & FactureDuMarche => f.marcheId === marche.id)
  const comptees = new Set(siennes.filter(estFactureValide).map((f) => f.id))
  const reglements = (sources.reglements ?? []).filter((r) => r.factureId !== null && comptees.has(r.factureId))
  const regleCentimes = reglementsDeLOperation(operation, reglements).regleCentimes
  return suiviRetenueMarche(marche, { factures: siennes, consignations: sources.consignations, restitutions: sources.restitutions, regleCentimes }, aujourdhui)
}

/** Règlements de l'opération comptés au pied : ceux d'une facture écartée (facture_invalide) en sont retirés avec elle (🔵). */
function sansReglementsDesFacturesEcartees(reglements: readonly ReglementFournisseur[], factures: readonly FactureDeLOperation[]): ReglementFournisseur[] {
  const ecartees = new Set(factures.filter((f) => !estFactureValide(f)).map((f) => f.id))
  return reglements.filter((r) => r.factureId === null || !ecartees.has(r.factureId))
}

/** Retenue d'une facture hors marché : invalide (bloquant, hors des totaux), ou sans suivi de libération (avertissement). */
function anomalieHorsMarche(f: FactureDeLOperation, numero: string): AnomalieRetenue {
  if (!retenueValide(f)) return anomalieRetenueInvalide(f)
  return anomalie('retenue_hors_marche', 'avertissement', f.id, `Facture ${f.id} : retenue de ${eur(retenueDe(f))} sans marché garanti de l'opération ${numero} ; ni taux, ni réception, ni libération suivis.`)
}

/**
 * Pied des factures de l'opération (Gestéam, tranche 32) : facturé, garantie restant retenue, réglé et dû net de la
 * garantie, avec le suivi de chaque marché ; factures et règlements d'un autre syndicat ou d'une autre opération ignorés
 * (D1) ; marché d'une autre opération refusé ; retenue sur une facture hors marché signalée (aucun suivi de libération) ;
 * facture invalide (TTC, date) écartée et signalée une fois : par le suivi de son marché, ou ici hors marché ; ses
 * règlements sont écartés avec elle, du réglé du marché comme de celui du pied.
 */
export function garantieDeLOperation(operation: OperationTravaux, sources: SourcesGarantieOperation, aujourdhui: string): PiedGarantieOperation {
  verifierDate(aujourdhui, `Garantie de l'opération ${operation.numero}`)
  verifierMarchesDeLOperation(operation, sources.marches)
  const factures = (sources.factures ?? []).filter((f) => f.coproprieteId === operation.coproprieteId && f.travauxId === operation.numero)
  const marches = sources.marches.map((marche) => suiviDansLOperation(operation, marche, { factures, sources, aujourdhui }))
  const connus = new Set(sources.marches.map((m) => m.id))
  const horsMarche = separerSaisiesValides(
    factures.filter((f) => f.marcheId === null || !connus.has(f.marcheId)),
    REGLE_FACTURE,
  )
  const retenuesHorsMarche = horsMarche.valides.filter((f) => retenueDe(f) !== 0)
  const anomalies = [...marches.flatMap((s) => s.anomalies), ...horsMarche.anomalies, ...retenuesHorsMarche.map((f) => anomalieHorsMarche(f, operation.numero))]
  const factureCentimes = factures.filter(estFactureValide).reduce((s, f) => s + f.totalTtcCentimes, 0)
  const garantieCentimes = marches.reduce((s, m) => s + m.resteRetenuCentimes, 0) + retenuesHorsMarche.reduce((s, f) => s + retenueComptee(f), 0)
  const regleCentimes = reglementsDeLOperation(operation, sansReglementsDesFacturesEcartees(sources.reglements ?? [], factures)).regleCentimes
  const du = factureCentimes - garantieCentimes - regleCentimes
  if (du < 0) {
    const precision = precisionDuFausse(marches.flatMap((s) => s.resteRetenuFaussePar))
    anomalies.push(anomalie('regle_au_dela_du_du', 'avertissement', operation.numero, `Opération ${operation.numero} : réglé ${eur(regleCentimes)}, au-delà du facturé net de la garantie${precision}.`))
  }
  return { coproprieteId: operation.coproprieteId, travauxId: operation.numero, marches, factureCentimes, garantieCentimes, regleCentimes, duCentimes: Math.max(0, du), anomalies }
}

// ─── Libération ──────────────────────────────────────────────────────────────────────────────

/**
 * Libération de la retenue (« Saisie de mouvements ») : débit du 47200, crédit du 401 du fournisseur, au même auxiliaire,
 * liens fournisseur et travaux ; la somme se règle ensuite comme une facture (reglements-fournisseurs.ts). Refusée sans
 * rien de retenu sur un marché qui ne pratique pas la retenue (ni retenue stipulée, ni caution inférieure à elle), sous
 * opposition en cours à la date de la libération (notifiée dans le délai, réception datée ou non, sans mainlevée), tant
 * que le suivi porte une saisie écartée qui fausse le reste retenu (resteRetenuFaussePar), ou au-delà du reste retenu ;
 * sous une opposition dont la validité n'est pas établie (antérieure à la réception, ou peut-être tardive), refusée sans
 * la confirmation motivée du gestionnaire, qui est alors tracée sur la restitution (J67, R63 et R64) ; une retenue
 * pratiquée avant la fourniture d'une caution, ou malgré elle, est au 47200 et se libère. Rend aussi la restitution à
 * enregistrer.
 */
export function ecritureLiberationRetenue({
  id,
  date,
  segmentSyndicat,
  auxiliaireFournisseur,
  marche,
  suivi,
  montantCentimes,
  confirmation = null,
}: {
  id: string
  date: string
  segmentSyndicat: string
  auxiliaireFournisseur: string
  marche: MarcheTravaux
  suivi: SuiviRetenueMarche
  montantCentimes: number
  /** Confirmation motivée du gestionnaire, exigée sous une opposition de validité non établie (J67, R63 et R64). */
  confirmation?: ConfirmationLiberation | null
}): { traitement: Traitement; restitution: RestitutionRetenue } {
  const sansRetenue = suivi.retenuCentimes === 0 && motifRetenueInterdite(marche) !== null
  if (sansRetenue || suivi.marcheId !== marche.id || suivi.coproprieteId !== marche.coproprieteId)
    throw new Error(
      `Marché ${marche.id} : libération d'une retenue pratiquée, sur le suivi de ce marché, attendue (rien de retenu sur un marché sans retenue stipulée ou sous une caution d'un montant égal).`,
    )
  verifierDate(date, `Libération de la retenue du marché ${marche.id}`)
  if (oppositionEnCours(marche, suivi.expirationLe, date))
    throw new Error(`Marché ${marche.id} : opposition notifiée le ${dateIsoVersFr(marche.opposition?.notifieeLe ?? date)}, sans mainlevée au ${dateIsoVersFr(date)} (loi n° 71-584, art. 2) ; libération refusée.`)
  const douteuse = oppositionDouteuseEnCours(marche, suivi.expirationLe, date)
  if (douteuse && !confirmationSaisie(confirmation))
    throw new Error(
      `Marché ${marche.id} : opposition notifiée le ${dateIsoVersFr(marche.opposition?.notifieeLe ?? date)}, de validité non établie (antérieure à la réception, ou peut-être tardive) ; libération soumise à une confirmation motivée et tracée du gestionnaire (motif et collaborateur ; J67, R63 et R64).`,
    )
  if (!douteuse && confirmation !== null)
    throw new Error(`Marché ${marche.id} : confirmation sans objet, aucune opposition de validité non établie au ${dateIsoVersFr(date)}.`)
  if (suivi.resteRetenuFaussePar.length > 0)
    throw new Error(
      `Marché ${marche.id} : reste retenu faussé par des saisies écartées du suivi (${suivi.resteRetenuFaussePar.join(', ')}) : facture invalide portant une retenue, retenue invalide ou restitution au montant invalide ; libération refusée jusqu'à leur correction.`,
    )
  if (!estCentimesPositifs(montantCentimes) || montantCentimes > suivi.resteRetenuCentimes)
    throw new Error(`Marché ${marche.id} : libération de ${montantCentimes} centimes ; reste retenu ${suivi.resteRetenuCentimes}.`)
  const liens: LiensMouvement = { fournisseurId: marche.fournisseurId, travauxId: marche.travauxId }
  const traitement = creerTraitement({
    id,
    famille: 'Saisie de mouvements',
    date,
    mouvements: [
      { compte: `${segmentSyndicat}.${COMPTE_ATTENTE_RETENUE_GARANTIE.planCode}.${auxiliaireFournisseur}.0`, sens: 'debit', montantCentimes, liens },
      { compte: `${segmentSyndicat}.40100.${auxiliaireFournisseur}.0`, sens: 'credit', montantCentimes, liens },
    ],
  })
  return {
    traitement,
    restitution: {
      id: `${id}:restitution`,
      coproprieteId: marche.coproprieteId,
      marcheId: marche.id,
      le: date,
      montantCentimes,
      traitementId: id,
      ...(confirmation ? { confirmation: { motif: confirmation.motif.trim(), confirmeePar: confirmation.confirmeePar.trim() } } : {}),
    },
  }
}

/**
 * Total à passer à retourFactureApresRejet (statuts-facture.ts, J9) pour une facture dont le reste dû est net de la
 * retenue (echeanceReglement) : TTC − retenue, pour que le réglé déduit (total − reste dû) soit le réglé réel, que le
 * rejet ne dépasse jamais le virement et que la retenue ne redevienne pas payable avant sa libération. Branchement :
 * statuts-facture.ts (non modifié).
 */
export function baseRetourApresRejet({
  totalTtcCentimes,
  retenueGarantieCentimes,
}: {
  totalTtcCentimes: number
  retenueGarantieCentimes: number | null
}): { totalTtcCentimes: number } {
  const retenue = retenueGarantieCentimes ?? 0
  if (!Number.isInteger(totalTtcCentimes) || !Number.isInteger(retenue) || retenue < 0 || retenue > totalTtcCentimes)
    throw new Error(`Facture : retenue de garantie (${retenue} centimes) en centimes entiers, entre 0 et le TTC (${totalTtcCentimes}).`)
  return { totalTtcCentimes: totalTtcCentimes - retenue }
}

// ─── Échéance de libération (suivi « à faire ») ──────────────────────────────────────────────

/**
 * Élément du suivi « à faire », au format ElementAFaire, sous la nature « liberation_garantie » de suivi-a-faire.ts (comme
 * RelanceOsAFaire d'envoi-ordre-service.ts), rendu par depuisRetenuesGarantie.
 */
export type EcheanceLiberationGarantie = Omit<ElementAFaire, 'famille' | 'nature'> & { famille: 'travaux'; nature: 'liberation_garantie' }

const ETATS_SUIVIS: ReadonlySet<EtatGarantieMarche> = new Set<EtatGarantieMarche>(['en_delai', 'a_liberer', 'opposition', 'opposition_a_confirmer'])

/** Garanties du marché : la caution, la retenue restant à verser. */
function garantiesDuMarche(suivi: SuiviRetenueMarche): string {
  const objets: string[] = []
  if (suivi.garantie === 'caution') objets.push(`caution de ${eur(suivi.cautionCentimes)}`)
  if (suivi.resteRetenuCentimes > 0) objets.push(`retenue de ${eur(suivi.resteRetenuCentimes)}`)
  return objets.join(' et ')
}

function libelleLiberation(suivi: SuiviRetenueMarche, expiration: string): string {
  const garanties = garantiesDuMarche(suivi)
  const opposition = suivi.opposition
  if (opposition && suivi.etat === 'opposition')
    return `${suivi.libelle} — ${garanties} sous opposition depuis le ${dateIsoVersFr(opposition.notifieeLe)} (motif : ${opposition.motif}) : libération suspendue jusqu'à la mainlevée de l'opposition, amiable ou par décision de justice (loi n° 71-584, art. 2 ; délai de garantie expirant le ${dateIsoVersFr(expiration)}, à confirmer).`
  if (opposition && suivi.etat === 'opposition_a_confirmer')
    return `${suivi.libelle} — ${garanties} : opposition notifiée le ${dateIsoVersFr(opposition.notifieeLe)} (motif : ${opposition.motif}), de validité non établie (antérieure à la réception, ou peut-être tardive) ; ${SANS_LIBERATION_AUTOMATIQUE} (loi n° 71-584, art. 2 ; J67, R63 et R64 ; délai de garantie expiré le ${dateIsoVersFr(expiration)}, à confirmer).`
  const suite = suivi.resteRetenuCentimes > 0 ? 'à libérer' : 'libérée'
  return `${suivi.libelle} — délai de garantie d'un an depuis la réception du ${dateIsoVersFr(suivi.dateReception ?? expiration)} expirant le ${dateIsoVersFr(expiration)} : opposition motivée par lettre recommandée, présentée (ou remise) à la caution ou au consignataire au plus tard ce jour, à défaut ${garanties} ${suite} (loi n° 71-584, art. 2 ; J67, R63).`
}

/**
 * Rappel « opposition à envoyer » (J67, R63) : la lettre doit être présentée à la caution ou au consignataire au plus
 * tard le jour de l'échéance ; le rappel tombe `jours` avant (réglage du cabinet, aucun texte) ; seulement en délai, sans
 * opposition à temps, pour une garantie à protéger ; null sinon.
 */
function rappelOppositionAEnvoyer(mandatId: string, suivi: SuiviRetenueMarche, expiration: string, jours: number): EcheanceLiberationGarantie | null {
  if (suivi.etat !== 'en_delai') return null
  return {
    id: `travaux:${suivi.coproprieteId}:${suivi.marcheId}:opposition_a_envoyer`,
    famille: 'travaux',
    nature: 'liberation_garantie',
    libelle: `${suivi.libelle} — opposition éventuelle à la libération (${garantiesDuMarche(suivi)}) : la lettre recommandée motivée doit être présentée au plus tard le ${dateIsoVersFr(expiration)} à la caution ou au consignataire ; à envoyer dès maintenant (réglage du cabinet : ${jours} jours avant ; loi n° 71-584, art. 2 ; J67, R63).`,
    date: ajouterJours(expiration, -jours),
    mandatId,
    objetId: `${suivi.coproprieteId}:${suivi.travauxId}`,
    assigneId: null,
    aConfirmer: true,
  }
}

/** Rappel d'une saisie écartée qui fausse le reste retenu : la libération attend sa correction (ecritureLiberationRetenue). */
const mentionSaisiesEcartees = ({ resteRetenuFaussePar }: SuiviRetenueMarche): string =>
  siResteFausse(resteRetenuFaussePar, (liste) => ` Libération suspendue jusqu'à la correction des saisies écartées qui faussent le reste retenu (${liste}).`)

/**
 * Échéances de libération des garanties pour le suivi « à faire » : à la date d'expiration du délai d'un an depuis la
 * réception (la plus courte des deux lectures) ; une retenue tant qu'il en reste à restituer, même le délai passé (la
 * somme est à verser) ; une caution jusqu'à l'expiration seulement (elle est ensuite libérée de plein droit) ; sous
 * opposition à temps en cours, l'élément reste, « sous opposition depuis le … », jusqu'à la mainlevée ; sous une
 * opposition de validité non établie, après l'échéance, il demande la confirmation du gestionnaire (J67, R63 et R64) ;
 * une saisie écartée qui fausse le reste retenu est rappelée au libellé (libération suspendue jusqu'à sa correction).
 * Avec `delaiRappelOppositionJours` (réglage du cabinet, aucun texte ; absent : pas de rappel), un rappel « opposition
 * à envoyer » tombe ce nombre de jours avant l'échéance (J67, R63). `aConfirmer` : le jour exact du délai reste à
 * confirmer (J67, R63). La clé et la fiche d'origine portent le syndicat (D1), comme depuisOperationsTravaux.
 * Branchement : suivi-a-faire.depuisRetenuesGarantie (sans le réglage du rappel : à brancher).
 */
export function echeancesLiberationGarantie(
  items: readonly { mandatId: string; suivi: SuiviRetenueMarche }[],
  { delaiRappelOppositionJours = null }: { delaiRappelOppositionJours?: number | null } = {},
): EcheanceLiberationGarantie[] {
  if (delaiRappelOppositionJours !== null && (!Number.isInteger(delaiRappelOppositionJours) || delaiRappelOppositionJours <= 0))
    throw new Error(`Rappel « opposition à envoyer » : ${delaiRappelOppositionJours} jours ; entier strictement positif attendu (réglage du cabinet).`)
  return items.flatMap(({ mandatId, suivi }): EcheanceLiberationGarantie[] => {
    const expiration = suivi.expirationLe
    if (!expiration || !ETATS_SUIVIS.has(suivi.etat)) return []
    if (suivi.garantie !== 'caution' && suivi.resteRetenuCentimes <= 0) return []
    const rappel = delaiRappelOppositionJours === null ? null : rappelOppositionAEnvoyer(mandatId, suivi, expiration, delaiRappelOppositionJours)
    return [
      {
        id: `travaux:${suivi.coproprieteId}:${suivi.marcheId}:liberation_garantie`,
        famille: 'travaux',
        nature: 'liberation_garantie',
        libelle: libelleLiberation(suivi, expiration) + mentionSaisiesEcartees(suivi),
        date: expiration,
        mandatId,
        objetId: `${suivi.coproprieteId}:${suivi.travauxId}`,
        assigneId: null,
        aConfirmer: true,
      },
      ...(rappel ? [rappel] : []),
    ]
  })
}

// ─── Part déductible à communiquer aux bailleurs ─────────────────────────────────────────────

/** Mention portée sur chaque part : une information du cabinet, jamais un calcul d'impôt. */
export const MENTION_PART_DEDUCTIBLE =
  "Part des dépenses de l'opération qualifiée déductible par le cabinet (CGI art. 31, I, 1°), à apprécier par le copropriétaire selon son régime d'imposition."

export type UsageLotFiscal = 'habitation' | 'professionnel'

/** Charges d'un copropriétaire dans l'opération (sa part des dépenses réparties) ; bailleur et usage du lot fournis. */
export interface ChargesCoproprietaireOperation {
  compteId: string
  /** Lot de ces charges, pour la vue par lot (J67, R66) ; absent : charges du compte, tous lots. */
  lotId?: string | null
  chargesCentimes: number
  bailleur: boolean
  usage?: UsageLotFiscal | null
}

export interface PartDeductibleBailleur {
  compteId: string
  chargesCentimes: number
  partDeductibleCentimes: number
  /** Charges − part déductible : la part non déductible des provisions déduites (CGI art. 31, I, 1°, a quater). */
  partNonDeductibleCentimes: number
  aVerifier: string[]
  mention: string
}

/** Part d'un marché pour un copropriétaire : comptée, ou écartée avec un motif à vérifier (b bis), selon l'usage du lot. */
function partPourLeLot(marche: MarcheTravaux, centimes: number, usage: UsageLotFiscal | null): { centimes: number; aVerifier: string | null } {
  if (marche.qualificationFiscale !== 'amelioration' || centimes === 0) return { centimes, aVerifier: null }
  if (usage === 'professionnel')
    return { centimes: 0, aVerifier: `Marché ${marche.id} (amélioration) : lot professionnel ou commercial, déductible seulement contre l'amiante ou pour l'accueil des handicapés (CGI art. 31, I, 1°, b bis) ; ${eur(centimes)} écartés.` }
  if (usage === 'habitation') return { centimes, aVerifier: null }
  return { centimes, aVerifier: `Marché ${marche.id} (amélioration) : usage du lot non renseigné ; le b vise les locaux d'habitation (CGI art. 31, I, 1°, b).` }
}

const surConstruction = (m: MarcheTravaux): boolean => m.qualificationFiscale === 'construction_reconstruction_agrandissement'

/** Marchés d'une seule opération d'un seul syndicat (D1) ; charges en centimes entiers positifs ou nuls. */
function verifierMarchesEtCharges(marches: readonly MarcheTravaux[], charges: readonly ChargesCoproprietaireOperation[]): void {
  const operations = new Set(marches.map((m) => `${m.coproprieteId}:${m.travauxId}`))
  if (operations.size > 1) throw new Error("Parts déductibles : marchés d'une seule opération, d'un seul syndicat (D1), attendus.")
  const invalide = charges.find((c) => !Number.isInteger(c.chargesCentimes) || c.chargesCentimes < 0)
  if (invalide) throw new Error(`Compte ${invalide.compteId} : charges (${invalide.chargesCentimes}) en centimes entiers positifs ou nuls.`)
}

/**
 * Ligne d'un bailleur : sa part de la déduction totale, ventilée entre les marchés au prorata de leurs déductions (plus
 * forts restes) pour écarter l'amélioration d'un lot professionnel ; au plus ses charges (garde-fou : la répartition
 * unique ne les dépasse pas), part non déductible, motifs à vérifier, mention.
 */
function ligneDuBailleur(c: ChargesCoproprietaireOperation, partTotale: number, marches: readonly MarcheTravaux[]): PartDeductibleBailleur {
  const parMarche = repartirAuxPlusFortsRestes(
    partTotale,
    marches.map((m) => m.deductionFiscaleCentimes),
  )
  const parts = marches.map((marche, i) => partPourLeLot(marche, parMarche[i], c.usage ?? null))
  const partDeductibleCentimes = Math.min(
    c.chargesCentimes,
    parts.reduce((s, p) => s + p.centimes, 0),
  )
  return {
    compteId: c.compteId,
    chargesCentimes: c.chargesCentimes,
    partDeductibleCentimes,
    partNonDeductibleCentimes: c.chargesCentimes - partDeductibleCentimes,
    aVerifier: parts.map((p) => p.aVerifier).filter((motif): motif is string => motif !== null),
    mention: MENTION_PART_DEDUCTIBLE,
  }
}

/**
 * Parts déductibles des bailleurs pour les marchés d'une opération (même opération, même syndicat) : la déduction
 * retenue de tous les marchés, répartie une seule fois au prorata des charges de tous les copropriétaires de l'opération
 * (plus forts restes : la somme des parts égale la déduction), rendue pour les bailleurs avec la part non déductible ;
 * déduction saisie sur des travaux de construction, reconstruction ou agrandissement écartée et signalée.
 */
export function partsDeductiblesBailleurs(
  marches: readonly MarcheTravaux[],
  charges: readonly ChargesCoproprietaireOperation[],
): { lignes: PartDeductibleBailleur[]; anomalies: AnomalieRetenue[] } {
  verifierMarchesEtCharges(marches, charges)
  const avecDeduction = marches.filter((m) => m.deductionFiscaleCentimes > 0)
  const anomalies = avecDeduction
    .filter(surConstruction)
    .map((m) =>
      anomalie(
        'deduction_sur_construction',
        'avertissement',
        m.id,
        `Marché ${m.id} : déduction de ${eur(m.deductionFiscaleCentimes)} sur des travaux de construction, reconstruction ou agrandissement, exclus du CGI art. 31, I, 1°, b ; écartée.`,
        FONDEMENTS.construction,
      ),
    )
  const retenus = avecDeduction.filter((m) => !surConstruction(m))
  const totalDeduction = retenus.reduce((s, m) => s + m.deductionFiscaleCentimes, 0)
  const totalCharges = charges.reduce((s, c) => s + c.chargesCentimes, 0)
  if (totalDeduction > totalCharges)
    throw new Error(`Parts déductibles : déduction des marchés (${totalDeduction} centimes) au-delà des charges réparties de l'opération (${totalCharges}).`)
  if (totalDeduction === 0) return { lignes: [], anomalies }
  const partsTotales = repartirAuxPlusFortsRestes(
    totalDeduction,
    charges.map((c) => c.chargesCentimes),
  )
  const lignes = charges.flatMap((c, rang) => (c.bailleur ? [ligneDuBailleur(c, partsTotales[rang], retenus)] : []))
  return { lignes, anomalies }
}

// ─── Part déductible par exercice approuvé et par lot (J67, R66) ─────────────────────────────

/** Provisions pour travaux appelées sur l'exercice, pour un bailleur et un lot (lues sur les appels de l'exercice). */
export interface ProvisionsTravauxAppelees {
  compteId: string
  /** Lot appelé ; absent : provisions du compte, tous lots. */
  lotId?: string | null
  montantCentimes: number
}

export interface LignePartDeductibleExercice {
  compteId: string
  lotId: string | null
  /** Provisions pour travaux appelées sur l'exercice (CGI art. 31, I, 1°, a quater : provisions de l'année). */
  provisionsAppeleesCentimes: number
  /** Charges des opérations de l'exercice, cumulées. */
  chargesCentimes: number
  partDeductibleCentimes: number
  /** Part non déductible : celle qui diminue, l'année suivante, les provisions déduites (a quater). */
  partNonDeductibleCentimes: number
  aVerifier: string[]
  mention: string
}

export interface PartsDeductiblesDeLExercice {
  coproprieteId: string
  exerciceId: string
  approbation: ApprobationComptes
  /** Une ligne par compte et par lot, dans l'ordre des opérations puis des provisions. */
  lignes: LignePartDeductibleExercice[]
  anomalies: AnomalieRetenue[]
}

/**
 * Parts déductibles des bailleurs par exercice approuvé et par lot (J67, R66), à la demande : aucun texte n'impose au
 * syndic de les communiquer ; le propriétaire déduit les provisions de l'année, diminuées de la part non déductible des
 * provisions déduites l'année précédente, connue à l'approbation des comptes (CGI art. 31, I, 1°, a quater). Pour chaque
 * opération de l'exercice, la répartition reste celle de partsDeductiblesBailleurs (charges de chaque copropriétaire
 * dans l'opération ; une opération sans déduction laisse toutes ses charges non déductibles) ; les lignes sont cumulées
 * par compte et par lot, avec les provisions pour travaux appelées sur l'exercice et la mention. Refus : exercice sans
 * approbation datée et référencée, marché d'un autre syndicat (D1), provisions qui ne sont pas en centimes entiers.
 */
export function partsDeductiblesDeLExercice(
  { coproprieteId, exerciceId, approbation }: { coproprieteId: string; exerciceId: string; approbation: ApprobationComptes },
  operations: readonly { marches: readonly MarcheTravaux[]; charges: readonly ChargesCoproprietaireOperation[] }[],
  provisions: readonly ProvisionsTravauxAppelees[] = [],
): PartsDeductiblesDeLExercice {
  if (!exerciceId.trim() || !estDateIsoValide(approbation.date) || !approbation.reference.trim())
    throw new Error(
      `Parts déductibles de l'exercice « ${exerciceId} » : exercice approuvé attendu (date AAAA-MM-JJ et référence de l'approbation des comptes ; J67, R66).`,
    )
  const lignes = new Map<string, LignePartDeductibleExercice>()
  const ligneDe = (compteId: string, lotId: string | null): LignePartDeductibleExercice => {
    const cle = `${compteId}|${lotId ?? ''}`
    const existante = lignes.get(cle)
    if (existante) return existante
    const nouvelle: LignePartDeductibleExercice = {
      compteId,
      lotId,
      provisionsAppeleesCentimes: 0,
      chargesCentimes: 0,
      partDeductibleCentimes: 0,
      partNonDeductibleCentimes: 0,
      aVerifier: [],
      mention: MENTION_PART_DEDUCTIBLE,
    }
    lignes.set(cle, nouvelle)
    return nouvelle
  }
  const anomalies: AnomalieRetenue[] = []
  for (const { marches, charges } of operations) {
    const etranger = marches.find((m) => m.coproprieteId !== coproprieteId)
    if (etranger) throw new Error(`Marché ${etranger.id} d'un autre syndicat que ${coproprieteId} (D1).`)
    const resultat = partsDeductiblesBailleurs(marches, charges)
    anomalies.push(...resultat.anomalies)
    charges
      .filter((c) => c.bailleur)
      .forEach((c, rang) => {
        const part = resultat.lignes.at(rang)
        const ligne = ligneDe(c.compteId, c.lotId ?? null)
        ligne.chargesCentimes += c.chargesCentimes
        ligne.partDeductibleCentimes += part?.partDeductibleCentimes ?? 0
        ligne.partNonDeductibleCentimes += part?.partNonDeductibleCentimes ?? c.chargesCentimes
        ligne.aVerifier.push(...(part?.aVerifier ?? []))
      })
  }
  for (const p of provisions) {
    if (!Number.isInteger(p.montantCentimes) || p.montantCentimes < 0)
      throw new Error(`Compte ${p.compteId} : provisions pour travaux appelées (${p.montantCentimes}) en centimes entiers positifs ou nuls.`)
    ligneDe(p.compteId, p.lotId ?? null).provisionsAppeleesCentimes += p.montantCentimes
  }
  return { coproprieteId, exerciceId, approbation: { ...approbation }, lignes: [...lignes.values()], anomalies }
}
