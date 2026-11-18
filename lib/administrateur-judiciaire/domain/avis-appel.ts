import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { preparerCourrier } from '@/lib/administrateur-judiciaire/domain/courriers'
import { ajouterJours, ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  controlerAffectationFondsTravaux,
  controlerSeuilFondsTravaux,
  type DecaissementFondsTravaux,
  type ObjetDecaissementFondsTravaux,
  type ReglagesFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { controlerContexteFusion } from '@/lib/administrateur-judiciaire/domain/gabarits-courrier'
import {
  adressePourCourrierSimple,
  controlerAdresseDeCourrierSimple,
  estQualiteCopropriete,
  numeroCompteCoproprietaire,
  statutPositionA,
  type AdresseDatee,
  type AnomalieAdresse,
  type CompteCoproprietaire,
  type Identite,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { postesDepuisAvis, type PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { validerIcs, type EcheancePrelevement } from '@/lib/administrateur-judiciaire/domain/prelevements-sepa'
import {
  repartir,
  type AvisAppels,
  type AvisCompte,
  type CleRepartition,
  type EcheanceAppel,
  type NatureEcheance,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import {
  ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE,
  adresseElectroniqueDeNotification,
  communicationsDesRenonciations,
  mentionFaculteVoiePostale,
  voieDeNotification,
  type CommunicationAdresseElectronique,
  type DemandeVoiePostale,
  type RenonciationVoiePostale,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'
import type { FormeEnvoiCourrier, ModeReglement, TypeAppelLieAuMouvement } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Avis d'appel de fonds d'un copropriétaire : contenu, adaptateur vers le prélèvement SEPA, préparation de la diffusion
 * par le circuit Courrier (point 17 du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran ni
 * table : le corps et le PDF de l'avis, l'écran et l'envoi restent à faire.
 *
 * Gestéam — 🟢 tranche 30 § Appels copropriétaires : fiche de l'avis (grille « Type · Libellé · Budget · Copro. · Clé ·
 * Quote-part », « À régler avant le », « Prélevé le », « Règlement », Total appels, Solde antérieur, « Souscription fonds
 * trav. », « Emploi fonds trav. », Mode d'envoi, Diffusion) ; § Échéancier : « Montant € maximum d'emploi des fonds
 * travaux » porté par l'échéance ; tranche 43 § 8 : l'avis se décompose en postes de terme (traitement émis une dizaine
 * de jours avant l'exigibilité) ; § 22 : modèle « appel provisions » en e-mail direct, contexte « Appel copropriétaire » ;
 * tranches 25 et 29 : onglet Banque du compte 450 (Encaissement : Mode · Hors budget ; Prélèvement : Budget × · Autres ×
 * · Maxi ; mandat SEPA ; R.U.M. ; Ordre FIRST ; Détenteur · Identité · Part %, IBAN, BIC). ⚪ Non observé : arithmétique
 * de « Emploi fonds trav. », contenu imprimé de l'avis, règle de « À régler avant le », pré-notification distincte.
 *
 * Le droit — 🟢 relu sur Légifrance le 29/10/2026 :
 * - L. 1965 art. 14-1 : provision exigible le premier jour de chaque trimestre ou de la période fixée par l'assemblée ;
 *   hors budget, selon les modalités votées ; art. 14-2-1, I, al. 6 : cotisation au fonds de travaux selon les mêmes
 *   modalités que les provisions ; al. 7 : affectation par l'assemblée, en tenant compte des clés de répartition ; III :
 *   sommes attachées aux lots, acquises au syndicat dès leur versement, sans remboursement PAR LE SYNDICAT à la cession
 *   d'un lot, l'acquéreur pouvant verser au vendeur un montant équivalent (texte recopié dans la mention) ; art. 18, II :
 *   cotisations versées sans délai sur le compte séparé rémunéré, virements depuis le compte courant autorisés ;
 * - L. 1965 art. 29-1, I, al. 2 : le président du tribunal confie à l'administrateur provisoire « tous les pouvoirs du
 *   syndic dont le mandat cesse de plein droit » et tout ou partie des pouvoirs de l'assemblée générale ;
 * - D. 1967 art. 35-2 (décret n° 2025-1292, en vigueur le 25/12/2025) : avis adressé PRÉALABLEMENT à la date
 *   d'exigibilité, indiquant le montant exigible et, hors budget, l'objet de la dépense ; par voie électronique à
 *   l'adresse communiquée à cet effet, sinon par lettre simple (avant le 25/12/2025 : lettre simple, ou courriel avec
 *   l'accord exprès) ; art. 62-9 : « L'administrateur provisoire adresse copie aux copropriétaires de la ou des décisions
 *   prises et joint, s'il y a lieu, l'appel de fonds correspondant » ; art. 64-2 : mention de la faculté de voie postale
 *   sur les avis d'appels de charges (texte et fondement repris de voie-notification.ts) ; art. 64-9 : les art. 64-1 à
 *   64-4 s'appliquent quand un administrateur provisoire est désigné en application de L. 1965 art. 29-1 (la mention de
 *   l'art. 64-2 lui incombe donc) ; art. 65, al. 1 : adresse électronique notifiée au syndic « en vue de l'application
 *   des articles 64 et 64-1 » (notifications et mises en demeure) ; art. 10, dernier alinéa : le syndic rappelle les
 *   dispositions de cet article sur les appels de fonds (texte recopié dans la mention) ;
 * - C. monét. fin. art. L. 133-6 II et L. 133-7 : la série de prélèvements repose sur le mandat ; son retrait rend les
 *   opérations postérieures non autorisées ;
 * - règlement (UE) n° 260/2012 (relu sur EUR-Lex) : art. 5, § 3, a) ii) : consentement du payeur, que le mandat exprime
 *   (art. 2, 21)) ; art. 5, § 3, et annexe, point 3 a) : le créancier fournit type de prélèvement, nom du payeur « si
 *   disponible », IBAN du payeur, RUM, date de signature du mandat, montant, identifiant créancier ; art. 5, § 1, b) et
 *   d), et annexe, point 1 b) : format de message ISO 20022 XML.
 * 🟢 Lu dans le recueil EPC SDD Core 2025 v1.0 (règles du schéma, pas des textes de loi : voir 🔴) : DS-01, le nom du
 * débiteur figure sur tout mandat ; PT-04.02, le créancier notifie au DÉBITEUR, « toujours le détenteur du compte à
 * débiter » (glossaire), le montant et la date du débit.
 *
 * 🔵 Déduit :
 * - « À régler avant le » = l'exigibilité la plus tardive des lignes dues (quote-part non nulle), plus un délai de
 *   gestion facultatif (0 par défaut, jamais négatif) : il ne repousse pas l'exigibilité ; une quote-part arrondie à zéro
 *   ne fait ni ligne ni exigibilité, et un compte sans aucune ligne ne reçoit pas d'avis ;
 * - emploi du fonds de travaux : INFORMATION ventilée sur la clé de la dépense (art. 14-2-1, I, al. 7), hors du total
 *   appelé (les échéances de travaux sont déjà nettes de la part du fonds, travaux-operations.ts) ; le plafond par
 *   tranche reprend le « maximum d'emploi » de Gestéam ;
 * - prélèvement : natures « Budget » = provisions, « Autres » = travaux et cotisations au fonds (hors budget) ; montant
 *   = min(natures couvertes, maxi du mandat, total à payer), jamais le solde antérieur ; pas de débit avant
 *   l'exigibilité, même si le mandat le prévoit (J67, R97, ci-dessous) ;
 *   mandat signé après l'émission de l'avis : bloquant (le consentement doit précéder la pré-notification qui le cite) ;
 *   mandat sans prélèvement présenté depuis 36 mois : bloquant et non simple avertissement, le recueil EPC (§ 4.2)
 *   interdisant alors au créancier tout prélèvement sous ce mandat ;
 * - rien à prélever (compte créditeur, nature non couverte) : aucun débit à pré-notifier, les contrôles du débit (date,
 *   ICS, préavis, exigibilité) sont sans objet et un mandat absent, révoqué, caduc, incomplet ou non signé n'est qu'un
 *   avertissement, à régulariser avant le prochain prélèvement : l'avis de l'art. 35-2 reste dû ; sans mandat, seul un
 *   total à payer nul ou créditeur garantit que rien ne serait prélevé (sinon « mandat_absent » reste bloquant, comme un
 *   mandat incomplet sur un compte débiteur) ;
 * - reste hors prélèvement, appel d'un compte en contentieux ou dont le détenteur ne peut recevoir la pré-notification :
 *   virement au compte courant du syndicat, à défaut d'IBAN valide chèque ; compte en contentieux : prélèvement suspendu
 *   (preparerLotPrelevements l'exclut par défaut), l'avis n'annonce donc aucun débit ;
 * - l'avis vaut pré-notification SEPA quand il porte le montant et la date du débit (recueil EPC, PT-04.02 : « together
 *   with or as part of other commercial documents ») ; référence de virement = n° de compte 450 (clé de rapprochement) ;
 *   le détenteur du compte (identité du mandat) le reçoit, en plus des copropriétaires s'il n'en est pas ; seul est
 *   prélevé le compte dont le détenteur a un courrier préparé, sans anomalie bloquante à la date de diffusion, qui porte
 *   CE débit (même n° de compte et date d'émission, même montant, même date, même RUM et ICS) : le courrier préparé tient
 *   lieu d'envoi tant que le circuit Courrier n'enregistre pas l'envoi (point 16) ;
 * - l'avis n'annonce jamais un débit que le lot écartera : détenteur non rattaché à une identité, comme en contentieux,
 *   aucun débit annoncé et règlement hors prélèvement (contenu) ; détenteur sans courrier possible à la diffusion
 *   (adresse, fusion), les courriers des autres destinataires partent sans le débit, tout le total réglé hors
 *   prélèvement ; un blocage commun au compte (contenu, préavis recompté) ne laisse partir aucun courrier ;
 * - diffusion : l'avis n'est pas une notification (forme libre, aucun contrôle LRE) ; canal et adresse électronique :
 *   J69, ci-dessous ; un courrier par identité du compte (indivision, démembrement : J67, R100, ci-dessous) ; diffusé
 *   après son émission, l'avis recompte la pré-notification depuis la diffusion (bloquant) et signale une diffusion à
 *   l'exigibilité ou après ; une diffusion antérieure à l'émission est refusée ;
 * - les art. 35-2 et 10, écrits pour « le syndic », valent pour l'administrateur provisoire de l'art. 29-1, qui reçoit
 *   « tous les pouvoirs du syndic » (art. 29-1, I, al. 2) : le passage de ces pouvoirs aux obligations du syndic est
 *   déduit ; administrateurProvisoire donne le régime de l'administrateur (29-1 ou 47 : J67, R99, ci-dessous) ;
 * - D. 1967 art. 62-9 : l'appelant porte la décision de l'administrateur provisoire sur l'échéance dont l'appel accompagne la
 *   copie (premier appel consécutif à la décision) ; le circuit Courrier ne joint pas encore de pièce : avertissement.
 *
 * Décisions de Hugo du 03/11/2026 (registre des décisions juridiques, J30 ; question 21 de la liste) :
 * - J30 : la décision d'affectation (date de l'AG et n° de la résolution, confirmée par J42) et l'ordonnance de l'art.
 *   29-14, 2° (juridiction, date, n°) de l'emploi du fonds (EmploiFondsEcheance.affectation) se reçoivent en forme
 *   structurée, aux types de DecaissementFondsTravaux (fonds-travaux.ts), ou en texte libre d'avant J30. Elles se
 *   contrôlent comme des valeurs enregistrées, `aujourdhui: null` : forme contrôlée, date non comparée au jour, jamais
 *   d'erreur levée pour l'avoir omise. Un refus (forme structurée incomplète comprise) reste bloquant ; un texte libre
 *   d'avant J30 reste admis, signalé par une anomalie non bloquante (emploi_fonds_forme_incomplete, avertissement), à
 *   compléter. travaux-operations.ts, hors de ce lot, fournit encore ces références en texte libre (il convertit même
 *   la résolution de l'opération en texte) : chaque emploi d'une opération porte ce signalement jusqu'à ce que sa
 *   saisie passe à la forme structurée, que l'avis reçoit déjà.
 * - J25 et J29 (espèces ; registre, décisions du 03/11/2026, appliquées ici le 17/11/2026) : aucun encaissement en
 *   espèces, compte 53 non tenu ; un compte au mode « Espèces » ne voit jamais ce mode sur l'avis : règlement hors
 *   prélèvement (instructionsHorsPrelevement : virement, à défaut chèque) et avertissement especes_refusees, qui
 *   demande de changer le mode du compte ; l'avis n'est pas bloqué (il précède l'exigibilité, D. 1967 art. 35-2).
 *
 * Décisions de Hugo du 06/11/2026 (registre des décisions juridiques, J42 ; PR #643, suite de J30) :
 * - J42 : la décision d'affectation de l'AG prend la forme date de l'AG + n° de la résolution, obligatoires ; un texte
 *   libre est refusé pour toute nouvelle saisie. L'interprétation de J30 est confirmée : sa marque de doute est retirée,
 *   comportement inchangé (l'avis reçoit des valeurs enregistrées : un texte libre d'avant J30 reste admis et signalé).
 *
 * Décisions de Hugo du 17/11/2026 (registre des décisions juridiques, J67 : recommandations validées en bloc, et J69 ;
 * textes relus sur Légifrance le 17/11/2026) :
 * - J69 (J67, R20 ; modifie J52 pour l'avis d'appel) : l'avis part par voie électronique « à l'adresse communiquée par le
 *   copropriétaire à cet effet », ou par lettre simple à défaut (D. 1967 art. 35-2, dernier al.) ; la demande de voie
 *   postale vise les « notifications et mises en demeure » (art. 64-1, 64-4), pas les avis. Une adresse électronique
 *   donnée pour les avis (communicationsAvis) sert donc même si la voie postale est demandée ; sans elle, l'adresse des
 *   notifications (art. 65) sert, sauf demande de voie postale (lettre simple) : le premier avis envoyé ainsi invite à
 *   confirmer l'adresse pour les avis ou à demander la lettre simple (mention.confirmationAdresse) ; la demande de
 *   lettre simple pour les avis (demandesLettreSimpleAvis) donne la lettre simple dès sa réception, sans toucher aux
 *   notifications, tant qu'aucune adresse n'est donnée ensuite pour les avis ; la lettre simple remplace aussi le
 *   courriel dès qu'un avis revient en erreur à cette adresse (courrielsAvis, anomalie courriel_avis_en_erreur ;
 *   enregistrement des demandes, des envois et des retours : à brancher). J52 reste valable pour les notifications.
 *   L'avis garde la mention de l'art. 64-2 ; avant le 25/12/2025, régime antérieur inchangé. J74 (décision de Hugo du
 *   18/11/2026) : la renonciation à la voie postale (renonciations) lève la demande à son effet, le lendemain du
 *   huitième jour suivant sa réception (voieDeNotification) ; son adresse sert d'adresse des notifications ;
 * - J67, R97 : pas de prélèvement avant l'exigibilité, même si le mandat le prévoit : la provision est exigible à la date
 *   fixée par la loi ou l'AG (L. 1965 art. 14-1, I, al. 3) ; le terme profite au débiteur, qui seul peut y renoncer
 *   (C. civ. art. 1305 et 1305-3) ; signer un mandat SEPA n'y renonce pas ; pour des débits plus tôt ou mensuels, une
 *   modalité votée par l'AG déplace l'exigibilité elle-même (art. 14-1, I, al. 2). Blocage avant_exigibilite gardé ;
 * - J67, R98 : provision de l'art. 43, al. 2 (EcheanceAppel.provisionArt43 : budget voté en cours d'exercice) : mention
 *   « provision_art_43 » sur l'avis ; ses postes sont « hors art. 19-2 » (imputation-encaissements.postesDepuisAvis ;
 *   lecture par le contentieux : à brancher après la PR #741) ; sans l'autorisation préalable de l'AG (ou de
 *   l'administrateur provisoire qui en a les pouvoirs), anomalie bloquante « autorisation_art_43_manquante », à confirmer.
 *   L'ajustement porté par l'avis qui suit le vote du budget n'est pas calculé ici (appels-budget.ts) ;
 * - J67, R99 : administrateurProvisoire est un régime, 29-1 (« ap291 ») ou 47 (« ap47 »). L'art. 64-9 étend les art. 64-1
 *   à 64-4 à celui de l'art. 29-1, pas à l'administrateur provisoire de l'art. 47 : pour lui, les mentions des art. 10 et
 *   64-2 et l'envoi de l'art. 35-2 sont gardés par prudence (il agit à la place du syndic absent), sans citer l'art. 64-9 ;
 *   la copie de l'art. 62-9 n'est demandée (decision_a_joindre) que si une décision fonde l'appel : toujours possible en
 *   29-1, en 47 seulement si l'ordonnance lui donne un pouvoir de décision (la décision fournie en atteste) ;
 * - J67, R100 : indivision ou démembrement : un avis par personne connue du compte, un seul montant, et sur chacun
 *   « Même somme pour tout le lot, à payer une seule fois. » (mention.payerUneFois) ; si un mandataire commun est désigné
 *   (CompteCoproprietaire.mandataireCommunId, L. 1965 art. 23 ; J10), il reçoit l'avis principal, les autres une copie
 *   (DiffusionAvisCompte.exemplaire) ;
 * - J67, R113 : vente du lot entre l'avis et l'exigibilité : les postes exigibles après la vente passent à l'acquéreur,
 *   qui reçoit un avis ; le poste exigible le jour même reste au vendeur (D. 1967 art. 6-2, 1° et 2° ; J5 à J10) ;
 *   effetsMutationSurAvis compare l'avis d'avant et celui d'après la mutation : postes transférés, comptes à rediffuser,
 *   et message au vendeur dont le débit annoncé n'aura pas lieu ; l'adaptateur ne le prélève plus (son courrier ne porte
 *   plus le débit du nouvel avis). Le syndic apprend la vente par la notification de l'art. 6 (toujours due) et, si le
 *   vendeur n'a pas présenté de certificat du syndic, par l'avis de mutation du notaire (L. 1965 art. 20, I). Écriture
 *   déjà passée de l'appel : son annulation et un nouvel appel suivent echeancier-appels.annulerAppelees.
 *
 * 🔴 Non établi (questions pour Hugo ou Frédéric) :
 * - pré-notification de 14 jours calendaires, séquence FRST facultative depuis 2016, caducité d'un mandat inutilisé
 *   36 mois : règles du recueil EPC SDD Core 2025 (§ 4.3 et PT-04.02 ; historique des versions, v9.3 de 2016 ; § 4.2),
 *   pas des textes de loi ; v1.1 et v1.2 non lues ; format pain.008 et longueur de 35 caractères de l'EndToEndId
 *   (Implementation Guidelines non lues) : à valider avec la banque du syndicat, comme son ICS ;
 * - « "À régler avant le" : la date d'exigibilité seule, ou une date de courtoisie postérieure, et de combien de
 *   jours ? » (VitFix : l'exigibilité, plus delaiReglementJours fourni par l'appelant, 0 par défaut) ;
 * - « L'emploi du fonds de travaux figure-t-il sur l'avis pour information, hors du total (VitFix), ou en déduction du
 *   montant appelé ? Le plafond par échéance vient-il de la résolution d'affectation ou d'un réglage du cabinet ? »
 *   (VitFix : part du fonds de l'opération × taux de la tranche, emploisFondsTravauxDesTranches) ;
 * - « Le reste hors prélèvement et l'appel d'un compte en contentieux se règlent-ils par virement, ou selon le mode
 *   "Encaissement" (« Hors budget ») de l'onglet Banque ? » (VitFix : virement, à défaut chèque) ;
 * - « Contentieux ouvert entre l'avis et le débit : l'avis a annoncé un débit que preparerLotPrelevements exclut par
 *   défaut ; faut-il en informer le copropriétaire ? » (VitFix : non traité) ;
 * - « Copie des décisions de l'administrateur provisoire (art. 62-9) : faut-il un gabarit de courrier propre, auquel
 *   l'avis serait joint ? » (VitFix : avertissement « decision_a_joindre ») ;
 * - « Mandat jamais utilisé : la caducité de 36 mois court-elle de sa signature ? » (VitFix : non contrôlée) ;
 * - TIP : signalé, sans instructions ;
 * - plafond d'emploi par lot (part du fonds attachée au lot, point 20) : non fait.
 */

/** Recueil EPC SDD Core 2025, § 4.3 et PT-04.02 : pré-notification 14 jours calendaires avant le débit, sauf délai convenu. */
export const DELAI_PREAVIS_SEPA_JOURS = 14
/** Recueil EPC SDD Core 2025, § 4.2 : sans prélèvement présenté pendant 36 mois, le créancier annule le mandat. */
export const MOIS_CADUCITE_MANDAT_SEPA = 36
/** ISO 20022 : identifiant de bout en bout (EndToEndId) de 35 caractères au plus. */
export const LONGUEUR_MAX_ID_PRELEVEMENT = 35

const FONDEMENT_AVIS = 'D. 1967 art. 35-2'
const FONDEMENT_DECISION_ADMINISTRATEUR = 'D. 1967 art. 62-9'
const FONDEMENT_DONNEES_SEPA = 'Règl. (UE) n° 260/2012, art. 5, § 3, et annexe, point 3 a)'
const FONDEMENT_MANDAT_COMPLET = `${FONDEMENT_DONNEES_SEPA} ; recueil EPC SDD Core 2025, DS-01 (nom du débiteur sur le mandat)`
const FONDEMENT_CONSENTEMENT =
  "Règl. (UE) n° 260/2012, art. 5, § 3, a) ii) ; C. monét. fin. art. L. 133-6 II (consentement par mandat ; antériorité à l'avis : règle déduite)"
const FONDEMENT_FORMAT_SEPA =
  'format ISO 20022 XML : Règl. (UE) n° 260/2012, art. 5, § 1, b) et d), et annexe, point 1 b) ; longueur : guides de mise en œuvre non lus'
const FONDEMENT_PRENOTIFICATION = 'Recueil EPC SDD Core 2025, § 4.3 et PT-04.02 (règle du schéma, pas un texte de loi)'
const FONDEMENT_CADUCITE = 'Recueil EPC SDD Core 2025, § 4.2 (règle du schéma, pas un texte de loi)'

// ─── Types ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Mandat de prélèvement SEPA du compte 450 (Gestéam, onglet Banque). */
export interface MandatPrelevement {
  /** Référence unique du mandat. */
  rum: string
  dateSignature: string
  /** Détenteur du compte débité (Gestéam « Détenteur »), nom porté sur le mandat : le débiteur du recueil EPC. */
  debiteur: string
  /** Identité du détenteur (Gestéam « Détenteur · Identité ») : destinataire de la pré-notification ; null : non rattachée. */
  debiteurIdentiteId: string | null
  iban: string
  bic: string | null
  /** Dernier prélèvement présenté sous ce mandat ; null : jamais utilisé (séquence FRST). */
  dernierPrelevementLe: string | null
  /** Retrait du consentement par le payeur ; null ou absent : en vigueur. */
  revoqueLe?: string | null
  /** Natures prélevées (Gestéam « Budget × » · « Autres × »). */
  natures: { budget: boolean; autres: boolean }
  /** Plafond par prélèvement (Gestéam « Maxi (€) ») ; null : sans plafond. */
  maxiCentimes: number | null
  /** Délai de pré-notification convenu dans le mandat ; absent : 14 jours (recueil EPC). */
  delaiPreavisJours?: number | null
}

export interface ReglementCompte {
  compteId: string
  mode: ModeReglement
  mandat?: MandatPrelevement | null
}

/**
 * Plafond d'emploi du fonds de travaux sur une échéance de travaux, et la décision qui affecte le fonds : décision d'AG
 * et ordonnance du juge aux types de DecaissementFondsTravaux (J30 : forme structurée, ou texte libre d'avant J30).
 */
export interface EmploiFondsEcheance {
  echeanceId: string
  plafondCentimes: number
  affectation: {
    objet: ObjetDecaissementFondsTravaux
    decisionAg?: DecaissementFondsTravaux['decisionAg']
    autorisationJuge?: DecaissementFondsTravaux['autorisationJuge']
  }
}

export interface EmploiFondsCompte {
  echeanceId: string
  lotId: string
  cle: string
  centimes: number
}

/** Ligne de la grille « Fonds appelés » de Gestéam. */
export interface LigneContenuAvis {
  echeanceId: string
  nature: NatureEcheance
  typeAppel: TypeAppelLieAuMouvement | null
  libelle: string
  exigibilite: string
  lotId: string | null
  cle: string | null
  baseCentimes: number | null
  quotePartCentimes: number
  tantiemes: { lot: number; total: number } | null
}

export interface InstructionsVirement {
  mode: 'Virement'
  beneficiaire: string
  iban: string
  /** N° du compte 450 (clé de rapprochement). */
  reference: string
}

export interface InstructionsCheque {
  mode: 'Chèque'
  ordre: string
  adresseEnvoi: string
  reference: string
}

/** Règlement hors prélèvement : virement au compte courant du syndicat, à défaut d'IBAN valide, chèque (🔵). */
export type InstructionsHorsPrelevement = InstructionsVirement | InstructionsCheque

export interface InstructionsPrelevement {
  mode: 'Prélèvement'
  /** Date du débit ; null seulement quand rien n'est prélevé et qu'aucune date n'est fixée. */
  date: string | null
  /** Montant pré-notifié : le prélèvement ne le dépassera jamais ; 0 : rien n'est prélevé sur cet avis. */
  montantCentimes: number
  /** Total à payer moins le prélèvement (négatif : crédit). */
  resteHorsPrelevementCentimes: number
  /**
   * Règlement hors prélèvement : celui du reste quand il est positif, et de tout le total quand le débit ne peut être
   * pré-notifié au détenteur du compte (courrier impossible à la diffusion).
   */
  horsPrelevement: InstructionsHorsPrelevement
  /** RUM du mandat ; null sans mandat (rien n'est prélevé). */
  rum: string | null
  /** ICS du syndicat ; null seulement quand rien n'est prélevé et qu'il manque ou est invalide. */
  ics: string | null
  /** null : aucun mandat rattaché au compte, ce qui n'est admis que lorsque rien n'est à prélever. */
  mandat: MandatPrelevement | null
}

/** Jamais « Espèces » : l'avis n'invite pas à payer en espèces (J25, J29), il donne le règlement hors prélèvement. */
export type InstructionsReglement = InstructionsPrelevement | InstructionsVirement | InstructionsCheque | { mode: 'TIP' | 'Pas de règlement' }

export type CleMentionAvis = 'voie_postale' | 'ordre_du_jour' | 'fonds_travaux' | 'prenotification' | 'decision_administrateur' | 'provision_art_43'

export interface MentionAvis {
  cle: CleMentionAvis
  texte: string
  fondement: string
}

export type GraviteAnomalieAvis = 'bloquant' | 'avertissement' | 'information'

export type CodeAnomalieAvis =
  | 'emis_apres_exigibilite'
  | 'exigibilites_multiples'
  | 'sans_appel'
  | 'decision_a_joindre'
  | 'prelevement_suspendu'
  | 'prenotification_sans_detenteur'
  | 'regime_anterieur'
  | 'reglement_absent'
  | 'mandat_absent'
  | 'mandat_incomplet'
  | 'mandat_non_signe'
  | 'mandat_revoque'
  | 'mandat_caduc'
  | 'ics_invalide'
  | 'date_prelevement_absente'
  | 'preavis_insuffisant'
  | 'avant_exigibilite'
  | 'nature_non_couverte'
  | 'iban_syndicat_invalide'
  | 'mode_non_pris_en_charge'
  | 'especes_refusees'
  | 'reglement_attendu'
  | 'emploi_fonds_non_autorise'
  | 'emploi_fonds_forme_incomplete'
  | 'emploi_superieur_au_fonds'
  | 'sous_montant_bloque'
  | 'cotisation_a_virer'
  | 'autorisation_art_43_manquante'

export interface AnomalieAvis {
  code: CodeAnomalieAvis
  gravite: GraviteAnomalieAvis
  message: string
  /** Texte qui fonde le contrôle ; null pour une règle de gestion. */
  fondement: string | null
}

export interface ContenuAvisCompte {
  compteId: string
  serie: string
  /** N° du compte 450 : <syndicat>.45000.<série>.0. */
  numeroCompte: string
  libelleCompte: string
  /** Mandataire commun des indivisaires (J10) : il reçoit l'avis principal (J67, R100) ; null : aucun désigné. */
  mandataireCommunId: string | null
  dateEmission: string
  aReglerAvantLe: string
  parExigibilite: { exigibilite: string; montantCentimes: number }[]
  lignes: LigneContenuAvis[]
  provisionsCentimes: number
  travauxCentimes: number
  souscriptionFondsTravauxCentimes: number
  /** Information : la part du fonds de travaux employée, hors du total appelé. */
  emploiFondsTravaux: EmploiFondsCompte[]
  emploiFondsTravauxCentimes: number
  totalAppeleCentimes: number
  soldeAnterieurCentimes: number
  totalAPayerCentimes: number
  modeReglement: ModeReglement | null
  instructions: InstructionsReglement | null
  mentions: MentionAvis[]
  anomalies: AnomalieAvis[]
}

export interface ContenuAvisAppel {
  dateEmission: string
  datePrelevement: string | null
  parCompte: ContenuAvisCompte[]
  /** Anomalies de l'avis entier : une anomalie bloquante bloque tous les comptes. */
  anomalies: AnomalieAvis[]
}

/** Régime de l'administrateur provisoire (fondements.ts) : L. 1965 art. 29-1 ou D. 1967 art. 47 (J67, R99). */
export type RegimeAdministrateurProvisoire = Extract<Regime, 'ap291' | 'ap47'>

/** Décision de l'administrateur provisoire qui fonde l'appel d'une échéance (L. 1965 art. 29-1, I, al. 2 ; D. 1967 art. 62-9). */
export interface DecisionAdministrateurEcheance {
  echeanceId: string
  /** Référence de la décision, dont la copie accompagne l'avis. */
  decision: string
}

export interface OptionsContenuAvis {
  cles: CleRepartition[]
  comptes: CompteCoproprietaire[]
  segmentSyndicat: string
  syndicat: { nom: string; adresse: string }
  /** IBAN du compte courant du syndicat (virement) ; null : non renseigné. */
  ibanSyndicat: string | null
  /** Identifiant créancier SEPA du syndicat ; null : non renseigné. */
  ics: string | null
  dateEmission: string
  /** Délai de gestion ajouté à l'exigibilité pour « À régler avant le » ; 0 par défaut. */
  delaiReglementJours?: number
  reglements: ReglementCompte[]
  /** Date du débit, portée sur l'avis (pré-notification) et reprise par le fichier de prélèvement. */
  datePrelevement?: string | null
  emploisFonds?: EmploiFondsEcheance[]
  /** Solde du fonds de travaux avant emploi ; absent : non contrôlé. */
  soldeFondsCentimes?: number | null
  reglagesFonds?: ReglagesFondsTravaux | null
  /**
   * Régime de l'administrateur provisoire désigné (J67, R99) : art. 29-1 (mentions des art. 64-2 et 64-9) ou art. 47
   * (mentions gardées par prudence, sans l'art. 64-9) ; absent ou null : syndic.
   */
  administrateurProvisoire?: RegimeAdministrateurProvisoire | null
  /**
   * Décisions de l'administrateur provisoire qui fondent l'appel (D. 1967 art. 62-9) ; exige administrateurProvisoire ; en
   * art. 47, seulement si l'ordonnance lui donne un pouvoir de décision.
   */
  decisionsAdministrateur?: DecisionAdministrateurEcheance[]
  /** Comptes en contentieux (colonne « Ctx ») : prélèvement suspendu, l'avis donne le règlement hors prélèvement. */
  comptesEnContentieux?: ReadonlySet<string>
}

// ─── Outils ──────────────────────────────────────────────────────────────────────────────────────────────────────

const anomalie = (code: CodeAnomalieAvis, gravite: GraviteAnomalieAvis, message: string, fondement: string | null = null): AnomalieAvis => ({
  code,
  gravite,
  message,
  fondement,
})

const eur = (centimes: number): string => formatEurosCentimes(centimes / 100)
const somme = (lignes: { quotePartCentimes: number }[]): number => lignes.reduce((s, l) => s + l.quotePartCentimes, 0)
const ibanCompact = (iban: string): string => iban.replace(/\s+/g, '').toUpperCase()

function verifierDate(libelle: string, date: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${libelle} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

function echeanceDe(echeances: Map<string, EcheanceAppel>, id: string): EcheanceAppel {
  const echeance = echeances.get(id)
  if (!echeance) throw new Error(`Échéance « ${id} » absente de l'avis.`)
  return echeance
}

const natureCouverte = (mandat: MandatPrelevement, nature: NatureEcheance): boolean =>
  nature === 'budget' ? mandat.natures.budget : mandat.natures.autres

/** Pré-notification : le délai convenu dans le mandat, à défaut celui du recueil EPC. */
const delaiPreavis = (mandat: MandatPrelevement): number => mandat.delaiPreavisJours ?? DELAI_PREAVIS_SEPA_JOURS

/** L'avis envoyé à cette date ne précède pas le débit du délai de pré-notification. */
const preavisInsuffisant = (envoi: string, mandat: MandatPrelevement, debit: string): boolean => ajouterJours(envoi, delaiPreavis(mandat)) > debit

const messagePreavis = (avis: string, mandat: MandatPrelevement, debit: string): string =>
  `Prélèvement le ${dateIsoVersFr(debit)} : ${avis}, qui vaut pré-notification, doit le précéder de ${delaiPreavis(mandat)} jours calendaires.`

const codesBloquants = (contenu: ContenuAvisAppel, compte: ContenuAvisCompte): CodeAnomalieAvis[] =>
  [...contenu.anomalies, ...compte.anomalies].filter((a) => a.gravite === 'bloquant').map((a) => a.code)

/** Débit annoncé par l'avis : montant positif, date, ICS et mandat fixés. */
type DebitAnnonce = InstructionsPrelevement & { date: string; ics: string; rum: string; mandat: MandatPrelevement }

/** Débit annoncé par l'avis ; null quand rien n'est prélevé. */
function debitAnnonce(i: InstructionsReglement | null): DebitAnnonce | null {
  if (i?.mode !== 'Prélèvement' || i.montantCentimes <= 0 || !i.date || !i.ics || !i.rum || !i.mandat) return null
  return { ...i, date: i.date, ics: i.ics, rum: i.rum, mandat: i.mandat }
}

const texteVirement = (i: InstructionsVirement): string => `virement à ${i.beneficiaire}, IBAN ${i.iban}, en indiquant la référence ${i.reference}`
const texteCheque = (i: InstructionsCheque): string => `chèque à l'ordre de ${i.ordre}, adressé à ${i.adresseEnvoi}, référence ${i.reference} au dos`
const texteHorsPrelevement = (i: InstructionsHorsPrelevement): string => (i.mode === 'Virement' ? texteVirement(i) : texteCheque(i))

/** « Reste à régler hors prélèvement » et son mode de règlement ; vide sans reste positif. */
const texteReste = (i: InstructionsPrelevement): string =>
  i.resteHorsPrelevementCentimes > 0 ? ` Reste à régler hors prélèvement : ${eur(i.resteHorsPrelevementCentimes)}, par ${texteHorsPrelevement(i.horsPrelevement)}.` : ''

function verifierOptions(options: OptionsContenuAvis): void {
  verifierDate("Date d'émission", options.dateEmission)
  if (options.datePrelevement) verifierDate('Date de prélèvement', options.datePrelevement)
  const delai = options.delaiReglementJours ?? 0
  if (!Number.isInteger(delai) || delai < 0) throw new Error(`Délai de règlement invalide (${delai}) : jours entiers positifs ou nuls attendus.`)
  const solde = options.soldeFondsCentimes
  if (solde !== null && solde !== undefined && !Number.isInteger(solde))
    throw new Error(`Solde du fonds de travaux invalide (${solde}) : centimes entiers attendus.`)
  const vus = new Set<string>()
  for (const r of options.reglements) {
    if (vus.has(r.compteId)) throw new Error(`Règlement du compte « ${r.compteId} » en double.`)
    vus.add(r.compteId)
  }
}

function verifierMandat(m: MandatPrelevement): void {
  const delai = m.delaiPreavisJours
  if (delai !== null && delai !== undefined && (!Number.isInteger(delai) || delai < 0))
    throw new Error(`Mandat ${m.rum} : délai de pré-notification invalide (${delai}), jours entiers positifs ou nuls attendus.`)
  if (m.maxiCentimes !== null && (!Number.isInteger(m.maxiCentimes) || m.maxiCentimes < 0))
    throw new Error(`Mandat ${m.rum} : plafond invalide (${m.maxiCentimes}), centimes entiers positifs ou nuls attendus.`)
  if (m.dernierPrelevementLe !== null) verifierDate(`Mandat ${m.rum} : date du dernier prélèvement`, m.dernierPrelevementLe)
  if (m.revoqueLe) verifierDate(`Mandat ${m.rum} : date de révocation`, m.revoqueLe)
}

// ─── Mentions ────────────────────────────────────────────────────────────────────────────────────────────────────

/** D. 1967 art. 10, al. 1 à 3 (version en vigueur depuis le 04/07/2020, relue le 29/10/2026), recopiés tels quels. */
const TEXTE_ARTICLE_10 = [
  "A tout moment, un ou plusieurs copropriétaires, ou le conseil syndical, peuvent notifier au syndic la ou les questions dont ils demandent qu'elles soient inscrites à l'ordre du jour d'une assemblée générale. Le syndic porte ces questions à l'ordre du jour de la convocation de la prochaine assemblée générale. Toutefois, si la ou les questions notifiées ne peuvent être inscrites à cette assemblée compte tenu de la date de réception de la demande par le syndic, elles le sont à l'assemblée suivante.",
  "Lorsque la convocation de l'assemblée générale est sollicitée en application de l'article 17-1 AA de la loi du 10 juillet 1965, le syndic ne porte à l'ordre du jour de cette assemblée que les questions relatives aux droits et obligations du ou des copropriétaires demandeurs.",
  "Le ou les copropriétaires ou le conseil syndical qui demandent l'inscription d'une question à l'ordre du jour notifient au syndic, avec leur demande, le projet de résolution lorsque cette notification est requise en application des 7° et 8° du I de l'article 11. Lorsque le projet de résolution porte sur l'application du b de l'article 25 de la loi du 10 juillet 1965, il est accompagné d'un document précisant l'implantation et la consistance des travaux.",
]

const MENTION_ORDRE_DU_JOUR: MentionAvis = {
  cle: 'ordre_du_jour',
  texte: `Article 10 du décret n° 67-223 du 17 mars 1967 : « ${TEXTE_ARTICLE_10.join(' ')} »`,
  fondement: 'D. 1967 art. 10',
}

/** L. 1965 art. 14-2-1, III (version en vigueur depuis le 01/01/2023, relue le 29/10/2026), recopié tel quel. */
const TEXTE_ARTICLE_14_2_1_III = [
  'Les sommes versées au titre du fonds de travaux sont attachées aux lots et entrent définitivement, dès leur versement, dans le patrimoine du syndicat des copropriétaires.',
  "Elles ne donnent pas lieu à un remboursement par le syndicat des copropriétaires à l'occasion de la cession d'un lot.",
  "L'acquéreur peut consentir à verser au vendeur un montant équivalent à ces sommes en sus du prix de vente du lot.",
]

const MENTION_FONDS_TRAVAUX: MentionAvis = {
  cle: 'fonds_travaux',
  texte: `Article 14-2-1, III, de la loi n° 65-557 du 10 juillet 1965 : « ${TEXTE_ARTICLE_14_2_1_III.join(' ')} »`,
  fondement: 'L. 1965 art. 14-2-1, III',
}

function mentionPrenotification(debit: DebitAnnonce): MentionAvis {
  return {
    cle: 'prenotification',
    texte: `Prélèvement SEPA de ${eur(debit.montantCentimes)} le ${dateIsoVersFr(debit.date)}, au titre du mandat ${debit.rum} (identifiant créancier SEPA ${debit.ics}) : le présent avis vaut pré-notification de ce prélèvement.${texteReste(debit)}`,
    fondement: FONDEMENT_PRENOTIFICATION,
  }
}

const mentionDecision = (decisions: string[]): MentionAvis => ({
  cle: 'decision_administrateur',
  texte: `Le présent appel de fonds est joint à la copie de la décision de l'administrateur provisoire qui le fonde : ${decisions.join(' ; ')}.`,
  fondement: FONDEMENT_DECISION_ADMINISTRATEUR,
})

const FONDEMENT_ART_43 = 'D. 1967 art. 43, al. 2 ; J67, R98'

/** J67, R98 : texte demandé par la recommandation, mot pour mot. */
const MENTION_PROVISION_ART_43: MentionAvis = {
  cle: 'provision_art_43',
  texte: "Provision calculée sur le budget de l'exercice précédent (D. 1967 art. 43, al. 2), régularisée après le vote du budget.",
  fondement: FONDEMENT_ART_43,
}

/**
 * D. 1967 art. 64-2 : faculté de voie postale. L'art. 64-9 ne vise que l'administrateur de l'art. 29-1 ; pour celui de
 * l'art. 47, la mention est gardée par prudence, adressée à lui, sans citer l'art. 64-9 (J67, R99).
 */
function mentionVoiePostale(regime: RegimeAdministrateurProvisoire | null): MentionAvis {
  const mention = mentionFaculteVoiePostale({ administrateurProvisoire: regime !== null })
  const fondement = regime === 'ap47' ? "D. 1967 art. 64-2, 64-4 (administrateur de l'art. 47 : par prudence, J67, R99)" : mention.fondement
  return { cle: 'voie_postale', texte: mention.texte, fondement }
}

function mentionsDuCompte(lignes: LigneContenuAvis[], instructions: InstructionsReglement | null, decisions: string[], ctx: ContexteAvis): MentionAvis[] {
  const mentions: MentionAvis[] = [mentionVoiePostale(ctx.options.administrateurProvisoire ?? null), MENTION_ORDRE_DU_JOUR]
  if (totalNature(lignes, 'fonds_travaux') > 0) mentions.push(MENTION_FONDS_TRAVAUX)
  const debit = debitAnnonce(instructions)
  if (debit) mentions.push(mentionPrenotification(debit))
  if (decisions.length > 0) mentions.push(mentionDecision(decisions))
  if (lignes.some((l) => ctx.echeances.get(l.echeanceId)?.provisionArt43)) mentions.push(MENTION_PROVISION_ART_43)
  return mentions
}

/** J67, R98 : sans l'autorisation préalable de l'AG, la provision de l'art. 43 bloque l'avis (à confirmer). */
const anomaliesArt43 = (echeances: readonly EcheanceAppel[]): AnomalieAvis[] =>
  echeances
    .filter((e) => e.provisionArt43 && !e.provisionArt43.autorisation?.trim())
    .map((e) =>
      anomalie(
        'autorisation_art_43_manquante',
        'bloquant',
        `${e.libelle} : autorisation de l'art. 43 manquante ; la provision sur le budget précédent exige l'autorisation préalable de l'assemblée générale (ou de l'administrateur provisoire qui en a les pouvoirs) ; blocage à confirmer.`,
        FONDEMENT_ART_43,
      ),
    )

// ─── Décisions de l'administrateur provisoire (D. 1967 art. 62-9) ────────────────────────────────────────────────

/** Référence de la décision par échéance ; refuse une décision sans administrateur provisoire, inconnue, vide ou en double. */
function decisionsParEcheance(options: OptionsContenuAvis, echeances: Map<string, EcheanceAppel>): Map<string, string> {
  const decisions = options.decisionsAdministrateur ?? []
  if (decisions.length > 0 && !options.administrateurProvisoire)
    throw new Error(`Décision de l'administrateur provisoire sans administrateur provisoire désigné (${FONDEMENT_DECISION_ADMINISTRATEUR}).`)
  const parEcheance = new Map<string, string>()
  for (const d of decisions) {
    echeanceDe(echeances, d.echeanceId)
    const reference = d.decision.trim()
    if (!reference) throw new Error(`Décision de l'administrateur provisoire sur « ${d.echeanceId} » : référence attendue.`)
    if (parEcheance.has(d.echeanceId)) throw new Error(`Décision de l'administrateur provisoire en double sur l'échéance « ${d.echeanceId} ».`)
    parEcheance.set(d.echeanceId, reference)
  }
  return parEcheance
}

/** Décisions qui fondent les lignes dues du compte, sans doublon. */
const decisionsDuCompte = (lignes: LigneContenuAvis[], parEcheance: Map<string, string>): string[] => [
  ...new Set(lignes.flatMap((l) => parEcheance.get(l.echeanceId) ?? [])),
]

const anomaliesDecisions = (decisions: string[]): AnomalieAvis[] =>
  decisions.length === 0
    ? []
    : [
        anomalie(
          'decision_a_joindre',
          'avertissement',
          `Joindre à l'avis la copie de la décision de l'administrateur provisoire (${decisions.join(' ; ')}) : le circuit Courrier ne joint pas encore de pièce.`,
          FONDEMENT_DECISION_ADMINISTRATEUR,
        ),
      ]

// ─── Emploi du fonds de travaux ──────────────────────────────────────────────────────────────────────────────────

function compteDuLot(avis: AvisAppels, echeanceId: string, lotId: string): string {
  const compte = avis.parCompte.find((c) => c.lignes.some((l) => l.echeanceId === echeanceId && l.lotId === lotId))
  if (!compte) throw new Error(`Avis incohérent : lot « ${lotId} » sans compte pour l'échéance « ${echeanceId} ».`)
  return compte.compteId
}

/**
 * Contrôle J4 de l'affectation (fonds-travaux.ts) d'une valeur enregistrée (J30 : `aujourdhui: null`, la date d'une
 * décision ou d'une ordonnance structurée n'est pas comparée au jour) : un refus devient une anomalie bloquante de
 * l'avis ; une décision ou une ordonnance admise mais en texte libre d'avant J30, un avertissement « forme
 * incomplète ».
 */
function controlerEmploi(emploi: EmploiFondsEcheance, echeance: EcheanceAppel): AnomalieAvis[] {
  if (echeance.nature !== 'travaux')
    throw new Error(`Emploi du fonds de travaux sur « ${echeance.id} » : seule une échéance de travaux peut l'employer (L. 1965 art. 14-2-1, I).`)
  const controle = controlerAffectationFondsTravaux(
    {
      objet: emploi.affectation.objet,
      montantCentimes: emploi.plafondCentimes,
      decisionAg: emploi.affectation.decisionAg ?? null,
      autorisationJuge: emploi.affectation.autorisationJuge ?? null,
    },
    { aujourdhui: null },
  )
  if (!controle.autorise) return [anomalie('emploi_fonds_non_autorise', 'bloquant', `${echeance.libelle} : ${controle.motif}`, controle.fondement)]
  if (controle.formeIncomplete)
    return [anomalie('emploi_fonds_forme_incomplete', 'avertissement', `${echeance.libelle} : ${controle.formeIncomplete.message}`, controle.fondement)]
  return []
}

/** Plafond réparti sur la clé de la dépense (art. 14-2-1, I, al. 7), rattaché aux comptes par les lignes de l'avis. */
function ventilerUnEmploi(avis: AvisAppels, echeance: EcheanceAppel, plafondCentimes: number, cles: CleRepartition[]) {
  const cle = cles.find((c) => c.id === echeance.cleId)
  if (!cle) throw new Error(`Clé « ${echeance.cleId} » de l'échéance « ${echeance.id} » absente des clés fournies.`)
  return repartir(plafondCentimes, cle)
    .filter((part) => part.centimes > 0)
    .map((part) => ({
      compteId: compteDuLot(avis, echeance.id, part.lotId),
      emploi: { echeanceId: echeance.id, lotId: part.lotId, cle: cle.code, centimes: part.centimes },
    }))
}

function anomaliesSoldeFonds(options: OptionsContenuAvis, totalCentimes: number): AnomalieAvis[] {
  const solde = options.soldeFondsCentimes
  if (solde === null || solde === undefined || totalCentimes === 0) return []
  const anomalies: AnomalieAvis[] = []
  if (totalCentimes > solde)
    anomalies.push(anomalie('emploi_superieur_au_fonds', 'bloquant', `Emploi du fonds de travaux (${eur(totalCentimes)}) supérieur à son solde (${eur(solde)}).`))
  const alerte = options.reglagesFonds ? controlerSeuilFondsTravaux(solde - totalCentimes, options.reglagesFonds) : null
  if (alerte) anomalies.push(anomalie('sous_montant_bloque', 'avertissement', alerte.message))
  return anomalies
}

function ventilerEmploisFonds(
  avis: AvisAppels,
  echeances: Map<string, EcheanceAppel>,
  options: OptionsContenuAvis,
): { parCompte: Map<string, EmploiFondsCompte[]>; anomalies: AnomalieAvis[] } {
  const parCompte = new Map<string, EmploiFondsCompte[]>()
  const anomalies: AnomalieAvis[] = []
  const vus = new Set<string>()
  let totalCentimes = 0
  for (const emploi of options.emploisFonds ?? []) {
    if (vus.has(emploi.echeanceId)) throw new Error(`Emploi du fonds de travaux en double sur l'échéance « ${emploi.echeanceId} ».`)
    vus.add(emploi.echeanceId)
    const echeance = echeanceDe(echeances, emploi.echeanceId)
    anomalies.push(...controlerEmploi(emploi, echeance))
    totalCentimes += emploi.plafondCentimes
    for (const { compteId, emploi: part } of ventilerUnEmploi(avis, echeance, emploi.plafondCentimes, options.cles))
      parCompte.set(compteId, [...(parCompte.get(compteId) ?? []), part])
  }
  return { parCompte, anomalies: [...anomalies, ...anomaliesSoldeFonds(options, totalCentimes)] }
}

// ─── Règlement ───────────────────────────────────────────────────────────────────────────────────────────────────

interface BaseCompte {
  compteId: string
  numeroCompte: string
  lignes: LigneContenuAvis[]
  totalAPayerCentimes: number
}

interface ResultatReglement {
  instructions: InstructionsReglement | null
  anomalies: AnomalieAvis[]
}

type ResultatReglementMode = ResultatReglement & { mode: ModeReglement | null }

function anomaliesIdentiteMandat(m: MandatPrelevement, dateEmission: string): AnomalieAvis[] {
  if (!m.rum.trim() || !m.debiteur.trim() || !validerIban(m.iban) || !estDateIsoValide(m.dateSignature))
    return [anomalie('mandat_incomplet', 'bloquant', 'Mandat SEPA incomplet : RUM, détenteur, IBAN valide et date de signature attendus.', FONDEMENT_MANDAT_COMPLET)]
  if (m.dateSignature > dateEmission)
    return [anomalie('mandat_non_signe', 'bloquant', `Mandat ${m.rum} signé le ${dateIsoVersFr(m.dateSignature)}, après l'émission de l'avis.`, FONDEMENT_CONSENTEMENT)]
  return []
}

/** Dernière exigibilité des lignes que le mandat prélève (quote-part non nulle) ; null s'il n'en prélève aucune. */
function derniereExigibiliteCouverte(lignes: LigneContenuAvis[], mandat: MandatPrelevement): string | null {
  const dates = lignes.filter((l) => l.quotePartCentimes > 0 && natureCouverte(mandat, l.nature)).map((l) => l.exigibilite)
  return dates.reduce<string | null>((plusTardive, d) => (plusTardive === null || d > plusTardive ? d : plusTardive), null)
}

/** État du mandat à la date : révoqué (C. monét. fin. art. L. 133-7) ou caduc (recueil EPC, § 4.2). */
function anomaliesEtatMandat(m: MandatPrelevement, date: string): AnomalieAvis[] {
  const anomalies: AnomalieAvis[] = []
  if (m.revoqueLe && m.revoqueLe <= date)
    anomalies.push(anomalie('mandat_revoque', 'bloquant', `Mandat ${m.rum} révoqué le ${dateIsoVersFr(m.revoqueLe)} : plus de prélèvement à ce titre.`, 'C. monét. fin. art. L. 133-7'))
  if (m.dernierPrelevementLe && ajouterMois(m.dernierPrelevementLe, MOIS_CADUCITE_MANDAT_SEPA) <= date)
    anomalies.push(
      anomalie('mandat_caduc', 'bloquant', `Mandat ${m.rum} sans prélèvement depuis le ${dateIsoVersFr(m.dernierPrelevementLe)} : caduc après ${MOIS_CADUCITE_MANDAT_SEPA} mois, faire signer un nouveau mandat.`, FONDEMENT_CADUCITE),
    )
  return anomalies
}

function anomaliesDateDebit(m: MandatPrelevement, date: string, base: BaseCompte, dateEmission: string): AnomalieAvis[] {
  const anomalies: AnomalieAvis[] = []
  if (preavisInsuffisant(dateEmission, m, date))
    anomalies.push(anomalie('preavis_insuffisant', 'bloquant', messagePreavis(`l'avis du ${dateIsoVersFr(dateEmission)}`, m, date), FONDEMENT_PRENOTIFICATION))
  const exigibilite = derniereExigibiliteCouverte(base.lignes, m)
  if (exigibilite && date < exigibilite)
    anomalies.push(
      anomalie('avant_exigibilite', 'bloquant', `Prélèvement le ${dateIsoVersFr(date)}, avant l'exigibilité du ${dateIsoVersFr(exigibilite)} : le terme profite au débiteur.`, 'L. 1965 art. 14-1 ; C. civ. art. 1305-3'),
    )
  return anomalies
}

/** Contrôles du mandat et du débit ; sans date de débit, l'état du mandat s'apprécie à l'émission. */
function anomaliesPrelevement(base: BaseCompte, mandat: MandatPrelevement, options: OptionsContenuAvis): AnomalieAvis[] {
  const anomalies = anomaliesIdentiteMandat(mandat, options.dateEmission)
  if (!validerIcs(options.ics ?? '')) anomalies.push(anomalie('ics_invalide', 'bloquant', 'Identifiant créancier SEPA (ICS) du syndicat absent ou invalide.', FONDEMENT_DONNEES_SEPA))
  const date = options.datePrelevement
  if (!date)
    return [
      ...anomalies,
      ...anomaliesEtatMandat(mandat, options.dateEmission),
      anomalie('date_prelevement_absente', 'bloquant', "Date du prélèvement à fixer : l'avis la porte et vaut pré-notification.", FONDEMENT_PRENOTIFICATION),
    ]
  return [...anomalies, ...anomaliesEtatMandat(mandat, date), ...anomaliesDateDebit(mandat, date, base, options.dateEmission)]
}

/** Contrôles propres au débit : sans objet quand rien n'est prélevé. */
const CODES_DU_DEBIT: ReadonlySet<CodeAnomalieAvis> = new Set<CodeAnomalieAvis>(['ics_invalide', 'date_prelevement_absente', 'preavis_insuffisant', 'avant_exigibilite'])

/** Rien n'est prélevé : un mandat à régulariser n'empêche pas l'avis de l'art. 35-2. */
const aRegulariser = (a: AnomalieAvis): AnomalieAvis =>
  a.gravite === 'bloquant'
    ? { ...a, gravite: 'avertissement', message: `${a.message} Rien n'est prélevé sur cet avis : à régulariser avant le prochain prélèvement.` }
    : a

/** Rien n'est prélevé : contrôles du débit sans objet, mandat à régulariser. */
const sansDebitARegulariser = (anomalies: AnomalieAvis[]): AnomalieAvis[] => anomalies.filter((a) => !CODES_DU_DEBIT.has(a.code)).map(aRegulariser)

const instructionsVirement = (base: BaseCompte, options: OptionsContenuAvis, iban: string): InstructionsVirement => ({
  mode: 'Virement',
  beneficiaire: options.syndicat.nom,
  iban: ibanCompact(iban),
  reference: base.numeroCompte,
})

const instructionsCheque = (base: BaseCompte, options: OptionsContenuAvis): InstructionsCheque => ({
  mode: 'Chèque',
  ordre: options.syndicat.nom,
  adresseEnvoi: options.syndicat.adresse,
  reference: base.numeroCompte,
})

/** Règlement hors prélèvement : virement au compte courant du syndicat, à défaut d'IBAN valide, chèque (🔵). */
function instructionsHorsPrelevement(base: BaseCompte, options: OptionsContenuAvis): InstructionsHorsPrelevement {
  const iban = options.ibanSyndicat
  return iban && validerIban(iban) ? instructionsVirement(base, options, iban) : instructionsCheque(base, options)
}

/** Montant pré-notifié = min(natures couvertes par le mandat, maxi, total à payer), jamais négatif. */
function montantPreleve(base: BaseCompte, mandat: MandatPrelevement): { couvertCentimes: number; montantCentimes: number } {
  const couvertCentimes = somme(base.lignes.filter((l) => natureCouverte(mandat, l.nature)))
  return { couvertCentimes, montantCentimes: Math.max(0, Math.min(couvertCentimes, mandat.maxiCentimes ?? couvertCentimes, base.totalAPayerCentimes)) }
}

function instructionsPrelevement(base: BaseCompte, options: OptionsContenuAvis, mandat: MandatPrelevement | null, montantCentimes: number): InstructionsPrelevement {
  const ics = (options.ics ?? '').trim().toUpperCase()
  return {
    mode: 'Prélèvement',
    date: options.datePrelevement ?? null,
    montantCentimes,
    resteHorsPrelevementCentimes: base.totalAPayerCentimes - montantCentimes,
    horsPrelevement: instructionsHorsPrelevement(base, options),
    rum: mandat?.rum.trim() ?? null,
    ics: validerIcs(ics) ? ics : null,
    mandat,
  }
}

/**
 * Prélèvement sans mandat : bloquant tant qu'un débit est possible. Total à payer nul ou créditeur : aucun mandat n'y
 * prélèverait rien (montantPreleve), « mandat_absent » est à régulariser et l'avis de l'art. 35-2 part, comme sous un
 * mandat incomplet.
 */
function reglementSansMandat(base: BaseCompte, options: OptionsContenuAvis): ResultatReglementMode {
  const absent = anomalie('mandat_absent', 'bloquant', `Compte ${base.numeroCompte} : prélèvement sans mandat SEPA rattaché au compte.`, FONDEMENT_DONNEES_SEPA)
  if (base.totalAPayerCentimes > 0) return { mode: 'Prélèvement', instructions: null, anomalies: [absent] }
  return { mode: 'Prélèvement', instructions: instructionsPrelevement(base, options, null, 0), anomalies: [aRegulariser(absent)] }
}

/**
 * Détenteur du compte débité non rattaché à une identité : la pré-notification ne peut lui être adressée (recueil EPC,
 * PT-04.02) et le lot écarterait le débit. Comme en contentieux, l'avis n'annonce aucun débit et donne le règlement hors
 * prélèvement ; le mandat reste à régulariser.
 */
function reglementSansDetenteur(base: BaseCompte, mandat: MandatPrelevement, anomalies: AnomalieAvis[], options: OptionsContenuAvis): ResultatReglementMode {
  const instructions = instructionsHorsPrelevement(base, options)
  const message = `Mandat ${mandat.rum} : détenteur du compte débité (« ${mandat.debiteur} ») non rattaché à une identité, la pré-notification ne peut lui être adressée ; l'avis n'annonce aucun débit et indique le règlement par ${texteHorsPrelevement(instructions)}.`
  return {
    mode: instructions.mode,
    instructions,
    anomalies: [...sansDebitARegulariser(anomalies), anomalie('prenotification_sans_detenteur', 'avertissement', message, FONDEMENT_PRENOTIFICATION)],
  }
}

function reglementParPrelevement(base: BaseCompte, mandat: MandatPrelevement | null, options: OptionsContenuAvis): ResultatReglementMode {
  if (!mandat) return reglementSansMandat(base, options)
  verifierMandat(mandat)
  const { couvertCentimes, montantCentimes } = montantPreleve(base, mandat)
  const anomalies = anomaliesPrelevement(base, mandat, options)
  if (montantCentimes > 0 && !mandat.debiteurIdentiteId) return reglementSansDetenteur(base, mandat, anomalies, options)
  const instructions = instructionsPrelevement(base, options, mandat, montantCentimes)
  if (montantCentimes > 0) return { mode: 'Prélèvement', instructions: instructions.date && instructions.ics ? instructions : null, anomalies }
  const nonCouverte =
    couvertCentimes === 0 && somme(base.lignes) > 0
      ? [anomalie('nature_non_couverte', 'avertissement', `Mandat ${mandat.rum} : aucune des natures appelées n'est prélevée ; tout le montant est à régler autrement.`)]
      : []
  return { mode: 'Prélèvement', instructions, anomalies: [...sansDebitARegulariser(anomalies), ...nonCouverte] }
}

function reglementParVirement(base: BaseCompte, options: OptionsContenuAvis): ResultatReglement {
  const iban = options.ibanSyndicat
  if (!iban || !validerIban(iban))
    return { instructions: null, anomalies: [anomalie('iban_syndicat_invalide', 'bloquant', 'Virement : IBAN du compte courant du syndicat absent ou invalide.')] }
  return { instructions: instructionsVirement(base, options, iban), anomalies: [] }
}

/** Règlement hors prélèvement à la place du mode du compte : l'avis le donne, un avertissement dit pourquoi (`motif` reçoit son texte). */
function reglementHorsPrelevementAuLieuDuMode(
  base: BaseCompte,
  options: OptionsContenuAvis,
  code: CodeAnomalieAvis,
  motif: (reglement: string) => string,
): ResultatReglement & { mode: ModeReglement } {
  const instructions = instructionsHorsPrelevement(base, options)
  return { mode: instructions.mode, instructions, anomalies: [anomalie(code, 'avertissement', motif(texteHorsPrelevement(instructions)))] }
}

/** Compte en contentieux : prélèvement suspendu (preparerLotPrelevements l'exclut par défaut), règlement hors prélèvement. */
const reglementSuspendu = (base: BaseCompte, options: OptionsContenuAvis): ResultatReglement & { mode: ModeReglement } =>
  reglementHorsPrelevementAuLieuDuMode(
    base,
    options,
    'prelevement_suspendu',
    (reglement) => `Compte ${base.numeroCompte} en contentieux : prélèvement suspendu, l'avis n'annonce aucun débit et indique le règlement par ${reglement}.`,
  )

/**
 * Mode « Espèces » (J25, J29 : aucun encaissement en espèces, compte 53 non tenu) : l'avis n'en parle jamais et donne le
 * règlement hors prélèvement ; il n'est pas bloqué, il doit partir avant l'exigibilité (D. 1967 art. 35-2).
 */
const reglementEspecesRefusees = (base: BaseCompte, options: OptionsContenuAvis): ResultatReglement & { mode: ModeReglement } =>
  reglementHorsPrelevementAuLieuDuMode(
    base,
    options,
    'especes_refusees',
    (reglement) =>
      `Compte ${base.numeroCompte} : mode « Espèces » refusé (aucun encaissement en espèces, compte 53 « Caisse » non tenu : décisions J25, J29) ; l'avis indique le règlement par ${reglement} ; changer le mode de règlement du compte.`,
  )

function reglementDuCompte(base: BaseCompte, options: OptionsContenuAvis): ResultatReglementMode {
  const reglement = options.reglements.find((r) => r.compteId === base.compteId)
  if (!reglement)
    return { mode: null, instructions: null, anomalies: [anomalie('reglement_absent', 'bloquant', `Compte ${base.numeroCompte} : mode de règlement à renseigner.`)] }
  const { mode } = reglement
  switch (mode) {
    case 'Prélèvement':
      if (options.comptesEnContentieux?.has(base.compteId)) return reglementSuspendu(base, options)
      return reglementParPrelevement(base, reglement.mandat ?? null, options)
    case 'Virement':
      return { mode, ...reglementParVirement(base, options) }
    case 'Chèque':
      return { mode, instructions: instructionsCheque(base, options), anomalies: [] }
    case 'Espèces':
      return reglementEspecesRefusees(base, options)
    case 'Pas de règlement':
      return {
        mode,
        instructions: { mode },
        anomalies: base.totalAPayerCentimes > 0 ? [anomalie('reglement_attendu', 'avertissement', `Compte ${base.numeroCompte} : « Pas de règlement » alors que ${eur(base.totalAPayerCentimes)} sont à payer.`)] : [],
      }
    default:
      return { mode, instructions: { mode }, anomalies: [anomalie('mode_non_pris_en_charge', 'avertissement', `${mode} : mode de règlement sans instructions automatiques ; les rédiger sur l'avis.`)] }
  }
}

// ─── Contenu ─────────────────────────────────────────────────────────────────────────────────────────────────────

interface ContexteAvis {
  options: OptionsContenuAvis
  echeances: Map<string, EcheanceAppel>
  postes: PosteDette[]
  emplois: Map<string, EmploiFondsCompte[]>
  /** Référence de la décision de l'administrateur provisoire par échéance (D. 1967 art. 62-9). */
  decisions: Map<string, string>
}

function ligneDuPoste(poste: PosteDette, echeances: Map<string, EcheanceAppel>): LigneContenuAvis {
  const echeance = echeanceDe(echeances, poste.appelId ?? '')
  return {
    echeanceId: echeance.id,
    nature: echeance.nature,
    typeAppel: poste.typeAppel,
    libelle: poste.libelle,
    exigibilite: poste.exigibilite,
    lotId: poste.lotId ?? null,
    cle: poste.cle ?? null,
    baseCentimes: poste.baseCentimes ?? null,
    quotePartCentimes: poste.montantCentimes,
    tantiemes: poste.tantiemes ?? null,
  }
}

/** Exigibilités des lignes dues, sans quote-part nulle (postesDepuisAvis les écarte) ; aucune : rien n'est appelé. */
function anomaliesCalendrier(dateEmission: string, exigibilites: string[]): AnomalieAvis[] {
  if (exigibilites.length === 0)
    return [anomalie('sans_appel', 'information', "Aucun fonds appelé sur ce compte (quotes-parts nulles) : pas d'avis à diffuser.")]
  const anomalies: AnomalieAvis[] = []
  const premiere = exigibilites[0]
  if (dateEmission >= premiere)
    anomalies.push(
      anomalie('emis_apres_exigibilite', 'avertissement', `Avis émis le ${dateIsoVersFr(dateEmission)}, sans précéder l'exigibilité du ${dateIsoVersFr(premiere)} ; l'exigibilité n'en est pas reportée.`, FONDEMENT_AVIS),
    )
  if (exigibilites.length > 1)
    anomalies.push(anomalie('exigibilites_multiples', 'information', `Avis à ${exigibilites.length} exigibilités (${exigibilites.map(dateIsoVersFr).join(', ')}) : la date limite suit la plus tardive.`))
  return anomalies
}

const totalNature = (lignes: LigneContenuAvis[], nature: NatureEcheance): number => somme(lignes.filter((l) => l.nature === nature))

function contenuDuCompte(avisCompte: AvisCompte, ctx: ContexteAvis): ContenuAvisCompte {
  const { options } = ctx
  const compte = options.comptes.find((c) => c.id === avisCompte.compteId)
  if (!compte) throw new Error(`Compte copropriétaire introuvable : « ${avisCompte.compteId} ».`)
  const numeroCompte = numeroCompteCoproprietaire(compte, options.segmentSyndicat)
  const lignes = ctx.postes.filter((p) => p.compteId === compte.id).map((p) => ligneDuPoste(p, ctx.echeances))
  const exigibilites = [...new Set(lignes.map((l) => l.exigibilite))].sort((a, b) => a.localeCompare(b))
  const emploiFondsTravaux = ctx.emplois.get(compte.id) ?? []
  const souscriptionFondsTravauxCentimes = totalNature(lignes, 'fonds_travaux')
  const decisions = decisionsDuCompte(lignes, ctx.decisions)
  const reglement = reglementDuCompte({ compteId: compte.id, numeroCompte, lignes, totalAPayerCentimes: avisCompte.totalAPayerCentimes }, options)
  return {
    compteId: compte.id,
    serie: compte.serie,
    numeroCompte,
    libelleCompte: compte.libelle,
    mandataireCommunId: compte.mandataireCommunId?.trim() || null,
    dateEmission: options.dateEmission,
    aReglerAvantLe: ajouterJours(exigibilites.at(-1) ?? options.dateEmission, options.delaiReglementJours ?? 0),
    parExigibilite: exigibilites.map((exigibilite) => ({ exigibilite, montantCentimes: somme(lignes.filter((l) => l.exigibilite === exigibilite)) })),
    lignes,
    provisionsCentimes: totalNature(lignes, 'budget'),
    travauxCentimes: totalNature(lignes, 'travaux'),
    souscriptionFondsTravauxCentimes,
    emploiFondsTravaux,
    emploiFondsTravauxCentimes: emploiFondsTravaux.reduce((s, e) => s + e.centimes, 0),
    totalAppeleCentimes: avisCompte.totalAppeleCentimes,
    soldeAnterieurCentimes: avisCompte.soldeAnterieurCentimes,
    totalAPayerCentimes: avisCompte.totalAPayerCentimes,
    modeReglement: reglement.mode,
    instructions: reglement.instructions,
    mentions: mentionsDuCompte(lignes, reglement.instructions, decisions, ctx),
    anomalies: [...anomaliesCalendrier(options.dateEmission, exigibilites), ...anomaliesDecisions(decisions), ...reglement.anomalies],
  }
}

function anomaliesDeLAvis(dateEmission: string, parCompte: ContenuAvisCompte[]): AnomalieAvis[] {
  const anomalies: AnomalieAvis[] = []
  if (dateEmission < ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)
    anomalies.push(
      anomalie(
        'regime_anterieur',
        'avertissement',
        `Avis émis avant le ${dateIsoVersFr(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE)} : lettre simple, ou courriel avec l'accord exprès du copropriétaire ; mention de l'art. 64-2 dans sa rédaction actuelle non encore exigée.`,
        'D. 1967 art. 35-2 et 64-2, rédaction antérieure au décret n° 2025-1292',
      ),
    )
  const cotisations = parCompte.reduce((s, c) => s + c.souscriptionFondsTravauxCentimes, 0)
  if (cotisations > 0)
    anomalies.push(
      anomalie('cotisation_a_virer', 'information', `Cotisations au fonds de travaux appelées (${eur(cotisations)}) : à verser sans délai sur le compte séparé rémunéré du syndicat ; encaissées sur le compte courant, elles y sont virées.`, 'L. 1965 art. 18, II'),
    )
  return anomalies
}

/**
 * Contenu de l'avis d'appel par compte : grille des fonds appelés, totaux par nature, solde antérieur et total à payer,
 * date limite, emploi du fonds de travaux (information), instructions de règlement, mentions et anomalies. Refuse un
 * avis qui porte des anomalies de répartition, comme l'écriture de l'appel.
 */
export function contenuAvisAppel(avis: AvisAppels, options: OptionsContenuAvis): ContenuAvisAppel {
  if (avis.anomalies.length > 0) throw new Error(`Avis non établi : ${avis.anomalies.length} anomalie(s) de répartition à lever d'abord.`)
  verifierOptions(options)
  const echeances = new Map(avis.echeances.map((e) => [e.id, e]))
  const emplois = ventilerEmploisFonds(avis, echeances, options)
  const contexte: ContexteAvis = {
    options,
    echeances,
    postes: postesDepuisAvis(avis, options.cles),
    emplois: emplois.parCompte,
    decisions: decisionsParEcheance(options, echeances),
  }
  const parCompte = avis.parCompte.map((a) => contenuDuCompte(a, contexte))
  return {
    dateEmission: options.dateEmission,
    datePrelevement: options.datePrelevement ?? null,
    parCompte,
    anomalies: [...anomaliesDeLAvis(options.dateEmission, parCompte), ...emplois.anomalies, ...anomaliesArt43(avis.echeances)],
  }
}

// ─── Adaptateur vers le prélèvement ──────────────────────────────────────────────────────────────────────────────

export type MotifEcartPrelevement = 'mode_reglement' | 'contentieux' | 'contenu_bloque' | 'montant_nul' | 'prenotification_absente'

/**
 * Code propre à l'adaptateur, « prenotification_autre_debit » : le courrier préparé pour le détenteur porte un autre débit
 * que ce contenu (autre avis, autre montant, autre date, autre mandat ou autre détenteur) ; il ne pré-notifie pas celui-ci.
 */
export type CodeEcartPrelevement = CodeAnomalieAvis | CodeAnomalieDiffusion | 'prenotification_autre_debit'

export interface EcartPrelevement {
  compteId: string
  motif: MotifEcartPrelevement
  /** Anomalies en cause : du contenu (« contenu_bloque », débit retiré), ou de la diffusion au détenteur (« prenotification_absente »). */
  codes: CodeEcartPrelevement[]
}

export interface OptionsEcheancesPrelevement {
  /** Préfixe de l'identifiant de bout en bout, complété par la série du compte. */
  prefixeId: string
  /**
   * Diffusion de l'avis (preparerDiffusionAvis, à la date réelle d'envoi) : seul est prélevé le compte dont le détenteur
   * du compte débité a un courrier préparé, qui vaut pré-notification (recueil EPC, PT-04.02) s'il porte CE débit : même
   * avis (n° de compte, date d'émission), même montant, même date, même mandat (RUM, ICS) et même détenteur.
   */
  diffusions: readonly DiffusionAvisCompte[]
  /**
   * Contentieux ouvert après l'avis (colonne « Ctx ») : preparerLotPrelevements l'exclut par défaut. À l'émission, le
   * passer plutôt à contenuAvisAppel (comptesEnContentieux), pour que l'avis n'annonce pas de débit.
   */
  comptesEnContentieux?: ReadonlySet<string>
  /** Solde dû par compte, à défaut le total à payer de l'avis. */
  soldesDus?: Readonly<Record<string, number>>
}

/** Débit retiré de l'avis par son contenu, et motif de l'écart : contentieux, détenteur que la pré-notification ne peut atteindre. */
const DEBITS_RETIRES: readonly (readonly [CodeAnomalieAvis, MotifEcartPrelevement])[] = [
  ['prelevement_suspendu', 'contentieux'],
  ['prenotification_sans_detenteur', 'prenotification_absente'],
]

/**
 * Codes qui privent CE débit de pré-notification ; null : un courrier préparé pour le détenteur du compte débité porte ce
 * débit (champsDuDebit). Courrier préparé pour un autre débit : « prenotification_autre_debit » ; à défaut, anomalies des
 * courriers du détenteur, puis de ceux du compte.
 */
function defautDePrenotification(compte: ContenuAvisCompte, debit: DebitAnnonce, diffusions: readonly DiffusionAvisCompte[]): CodeEcartPrelevement[] | null {
  const duCompte = diffusions.filter((d) => d.compteId === compte.compteId)
  const preparees = duCompte.filter((d) => d.prenotification && d.courrier !== null)
  const attendus = Object.entries(champsDuDebit(compte, debit))
  const porteCeDebit = (d: DiffusionAvisCompte): boolean =>
    d.identiteId === debit.mandat.debiteurIdentiteId && attendus.every(([cle, valeur]) => d.valeursFusion[cle] === valeur)
  if (preparees.some(porteCeDebit)) return null
  if (preparees.length > 0) return ['prenotification_autre_debit']
  const auDetenteur = duCompte.filter((d) => d.prenotification)
  const enCause = (auDetenteur.length > 0 ? auDetenteur : duCompte).flatMap((d) => d.anomalies)
  return [...new Set(enCause.filter((a) => a.gravite === 'bloquant' || a.code === 'prenotification_impossible').map((a) => a.code))]
}

function echeanceDuDebit(compte: ContenuAvisCompte, debit: DebitAnnonce, options: OptionsEcheancesPrelevement): EcheancePrelevement {
  const id = `${options.prefixeId}-${compte.serie}`
  if (id.length > LONGUEUR_MAX_ID_PRELEVEMENT)
    throw new Error(`Identifiant de prélèvement « ${id} » : ${LONGUEUR_MAX_ID_PRELEVEMENT} caractères au plus (${FONDEMENT_FORMAT_SEPA}).`)
  const soldeDuCentimes = options.soldesDus?.[compte.compteId] ?? compte.totalAPayerCentimes
  if (!Number.isInteger(soldeDuCentimes)) throw new Error(`Solde dû du compte ${compte.numeroCompte} invalide (${soldeDuCentimes}) : centimes entiers attendus.`)
  const { mandat } = debit
  return {
    id,
    compteCoproprietaire: compte.numeroCompte,
    debiteur: mandat.debiteur.trim(),
    iban: mandat.iban,
    bic: mandat.bic,
    rum: debit.rum,
    dateSignatureMandat: mandat.dateSignature,
    sequence: mandat.dernierPrelevementLe ? 'RCUR' : 'FRST',
    montantEcheanceCentimes: debit.montantCentimes,
    soldeDuCentimes,
    contentieux: options.comptesEnContentieux?.has(compte.compteId) ?? false,
  }
}

function echeanceDuCompte(
  contenu: ContenuAvisAppel,
  compte: ContenuAvisCompte,
  options: OptionsEcheancesPrelevement,
): EcheancePrelevement | EcartPrelevement {
  const ecart = (motif: MotifEcartPrelevement, codes: CodeEcartPrelevement[]): EcartPrelevement => ({ compteId: compte.compteId, motif, codes })
  const retrait = DEBITS_RETIRES.find(([code]) => compte.anomalies.some((a) => a.code === code))
  if (retrait) return ecart(retrait[1], [retrait[0]])
  if (compte.modeReglement !== 'Prélèvement') return ecart('mode_reglement', [])
  const bloquants = codesBloquants(contenu, compte)
  const instructions = compte.instructions
  if (bloquants.length > 0 || instructions?.mode !== 'Prélèvement') return ecart('contenu_bloque', bloquants)
  if (instructions.montantCentimes === 0)
    return ecart('montant_nul', compte.anomalies.filter((a) => a.code === 'nature_non_couverte').map((a) => a.code))
  const debit = debitAnnonce(instructions)
  // Montant positif sans date, ICS ou RUM : le contenu porte déjà l'anomalie bloquante ; garde de typage.
  if (!debit) return ecart('contenu_bloque', bloquants)
  const sansPrenotification = defautDePrenotification(compte, debit, options.diffusions)
  if (sansPrenotification) return ecart('prenotification_absente', sansPrenotification)
  return echeanceDuDebit(compte, debit, options)
}

/**
 * Échéances de prélèvement tirées de l'avis et de sa diffusion (entrée de prelevements-sepa.preparerLotPrelevements,
 * puis genererPain008 avec la date de prélèvement de l'avis) : le montant est celui que l'avis pré-notifie, jamais plus ;
 * le débiteur lit son n° de compte 450 ; le détenteur du compte doit avoir reçu l'avis à temps. Les comptes qui ne se
 * prélèvent pas sont écartés avec leur motif.
 */
export function echeancesPrelevementDepuisAvis(
  contenu: ContenuAvisAppel,
  options: OptionsEcheancesPrelevement,
): { echeances: EcheancePrelevement[]; ecartees: EcartPrelevement[] } {
  const echeances: EcheancePrelevement[] = []
  const ecartees: EcartPrelevement[] = []
  for (const compte of contenu.parCompte) {
    const issue = echeanceDuCompte(contenu, compte, options)
    if ('motif' in issue) ecartees.push(issue)
    else echeances.push(issue)
  }
  return { echeances, ecartees }
}

// ─── Diffusion ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface ModeleCourrierAvis {
  id: string
  formeEnvoi: FormeEnvoiCourrier
}

export interface OptionsDiffusionAvis {
  date: string
  coproprieteId: string
  mandatId: string
  /** Champs du socle des gabarits : copropriete.*, mandat.* (gabarits-courrier.ts). */
  socle: Readonly<Record<string, unknown>>
  modeles: { electronique: ModeleCourrierAvis; postal: ModeleCourrierAvis }
  /** Identités des copropriétaires, et du détenteur du compte débité quand il n'en est pas. */
  identites: Identite[]
  positions: Position[]
  demandesVoiePostale: DemandeVoiePostale[]
  /**
   * J74 : renonciations à la voie postale, qui lèvent la demande à leur effet (voieDeNotification) ; l'adresse donnée
   * avec chacune sert d'adresse des notifications dès sa réception (communicationsDesRenonciations, D. 1967 art. 65).
   * Absentes : aucune (enregistrement : à brancher).
   */
  renonciations?: readonly RenonciationVoiePostale[]
  /** Adresses électroniques notifiées pour les notifications (D. 1967 art. 65) : à défaut d'adresse propre aux avis. */
  communications: CommunicationAdresseElectronique[]
  /** Adresses électroniques communiquées pour recevoir les avis (D. 1967 art. 35-2, « à cet effet »). */
  communicationsAvis?: CommunicationAdresseElectronique[]
  /** Avis déjà envoyés par courriel, avec leur retour en erreur (J69 ; enregistrement : à brancher). */
  courrielsAvis?: readonly CourrielAvisEnvoye[]
  /** Demandes de recevoir les avis par lettre simple, réponses à l'invitation (J69 ; enregistrement : à brancher). */
  demandesLettreSimpleAvis?: readonly DemandeLettreSimpleAvis[]
}

/**
 * J69 : le copropriétaire demande à recevoir les avis d'appel par lettre simple (réponse à l'invitation du premier avis
 * envoyé à l'adresse des notifications). Elle vaut dès sa réception ; ce n'est pas une demande de voie postale pour les
 * notifications (art. 64-1, 64-4), qui restent inchangées. Une adresse donnée ensuite pour les avis la remplace.
 */
export interface DemandeLettreSimpleAvis {
  identiteId: string
  recueLe: string
}

/** Avis d'appel envoyé par courriel à une identité (J69) : premier envoi à une adresse, retour en erreur. */
export interface CourrielAvisEnvoye {
  identiteId: string
  adresse: string
  envoyeLe: string
  /** Date du retour en erreur ; null : aucun. */
  retourEnErreurLe: string | null
}

export type CanalAvis = 'electronique' | 'postal'

/** Origine de l'adresse électronique de l'avis (J69) : donnée pour les avis, ou pour les notifications (art. 65). */
export type OrigineAdresseAvis = 'avis' | 'notifications'

export type CodeAnomalieDiffusion =
  | 'sans_destinataire'
  | 'sans_appel'
  | 'contenu_bloque'
  | 'fusion_incomplete'
  | 'preavis_insuffisant'
  | 'diffuse_apres_exigibilite'
  | 'prenotification_impossible'
  | 'courriel_avis_en_erreur'
  | AnomalieAdresse['code']

export interface AnomalieDiffusion {
  code: CodeAnomalieDiffusion
  gravite: 'bloquant' | 'avertissement'
  message: string
}

export interface DiffusionAvisCompte {
  compteId: string
  identiteId: string | null
  canal: CanalAvis | null
  formeEnvoi: FormeEnvoiCourrier | null
  adresseElectronique: string | null
  /** Origine de l'adresse électronique (J69) ; null : lettre simple. */
  origineAdresse: OrigineAdresseAvis | null
  /** Avis principal ou copie : le mandataire commun désigné reçoit l'avis principal, les autres une copie (J67, R100). */
  exemplaire: 'principal' | 'copie'
  adressePostale: AdresseDatee | null
  valeursFusion: Record<string, unknown>
  /** Courrier au statut « Préparation » ; null tant qu'une anomalie bloquante subsiste. */
  courrier: ReturnType<typeof preparerCourrier> | null
  /** Courrier adressé au détenteur du compte débité : il vaut pré-notification du prélèvement (recueil EPC, PT-04.02). */
  prenotification: boolean
  anomalies: AnomalieDiffusion[]
}

const nomDestinataire = (identite: Identite): string => [identite.civilite, identite.prenom, identite.nom].filter(Boolean).join(' ')

const texteAdresse = (a: AdresseDatee): string => [...a.lignes, `${a.codePostal} ${a.ville}`, ...(a.pays === 'France' ? [] : [a.pays])].join(', ')

const texteLignes = (lignes: LigneContenuAvis[]): string =>
  lignes
    .map((l) => {
      const taux = l.tantiemes ? ` (${l.tantiemes.lot}/${l.tantiemes.total})` : ''
      const base = l.baseCentimes === null ? '' : ` — base ${eur(l.baseCentimes)}`
      return `${l.typeAppel ?? l.nature} — ${l.libelle}${base} — clé ${l.cle ?? '·'}${taux} — quote-part ${eur(l.quotePartCentimes)}`
    })
    .join('\n')

/** Débit annoncé, puis le reste hors prélèvement et son mode de règlement ; rien n'est prélevé : il est dit. */
function texteInstructionsPrelevement(i: InstructionsPrelevement): string {
  const debit = debitAnnonce(i)
  const mandat = i.rum ? ` (mandat ${i.rum})` : ''
  const tete = debit ? `Prélèvement SEPA de ${eur(debit.montantCentimes)} le ${dateIsoVersFr(debit.date)} (mandat ${debit.rum}).` : `Aucun prélèvement sur cet avis${mandat}.`
  return `${tete}${texteReste(i)}`
}

function texteInstructions(i: InstructionsReglement | null): string | null {
  if (!i) return null
  switch (i.mode) {
    case 'Prélèvement':
      return texteInstructionsPrelevement(i)
    case 'Virement':
      return `Par ${texteVirement(i)}.`
    case 'Chèque':
      return `Par ${texteCheque(i)}.`
    default:
      return i.mode
  }
}

const texteMention = (compte: ContenuAvisCompte, cle: CleMentionAvis): string | null => compte.mentions.find((m) => m.cle === cle)?.texte ?? null

function valeursFusionAvis(compte: ContenuAvisCompte, destinataire: { nom: string; adresse: string | null }, socle: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const valeurs: Record<string, unknown> = {
    ...socle,
    'destinataire.nom': destinataire.nom,
    'destinataire.adresse': destinataire.adresse,
    'compte.numero': compte.numeroCompte,
    'appel.dateEmission': compte.dateEmission,
    'appel.aReglerAvantLe': compte.aReglerAvantLe,
    'appel.lignes': texteLignes(compte.lignes),
    'appel.totalAppeleCentimes': compte.totalAppeleCentimes,
    'appel.soldeAnterieurCentimes': compte.soldeAnterieurCentimes,
    'appel.totalAPayerCentimes': compte.totalAPayerCentimes,
    'appel.souscriptionFondsTravauxCentimes': compte.souscriptionFondsTravauxCentimes,
    'appel.emploiFondsTravauxCentimes': compte.emploiFondsTravauxCentimes,
    'reglement.mode': compte.modeReglement,
    'reglement.instructions': texteInstructions(compte.instructions),
    'mention.voiePostale': texteMention(compte, 'voie_postale'),
    'mention.ordreDuJour': texteMention(compte, 'ordre_du_jour'),
    'mention.fondsTravaux': texteMention(compte, 'fonds_travaux'),
    'mention.prenotification': texteMention(compte, 'prenotification'),
    'mention.decisionAdministrateur': texteMention(compte, 'decision_administrateur'),
    'mention.provisionArt43': texteMention(compte, 'provision_art_43'),
  }
  const debit = debitAnnonce(compte.instructions)
  if (debit) Object.assign(valeurs, champsDuDebit(compte, debit), { 'prelevement.resteCentimes': debit.resteHorsPrelevementCentimes })
  return valeurs
}

/**
 * Champs de fusion qui identifient le débit pré-notifié : l'avis (n° de compte, date d'émission), le montant, la date, le
 * mandat (RUM) et le créancier (ICS) ; l'adaptateur n'accepte que le courrier qui les porte tous.
 */
function champsDuDebit(compte: ContenuAvisCompte, debit: DebitAnnonce): Record<string, unknown> {
  return {
    'compte.numero': compte.numeroCompte,
    'appel.dateEmission': compte.dateEmission,
    'prelevement.date': debit.date,
    'prelevement.montantCentimes': debit.montantCentimes,
    'prelevement.rum': debit.rum,
    'creancier.ics': debit.ics,
  }
}

function identiteDuCompte(id: string, compteId: string, options: OptionsDiffusionAvis): Identite {
  const identite = options.identites.find((i) => i.id === id)
  if (!identite) throw new Error(`Identité « ${id} » introuvable pour le compte « ${compteId} ».`)
  return identite
}

/** Identités des positions de copropriété du compte, en place à la date (D2), dans l'ordre des positions. */
function destinatairesDuCompte(compteId: string, options: OptionsDiffusionAvis): Identite[] {
  const ids = options.positions
    .filter((p) => p.compteId === compteId && estQualiteCopropriete(p.qualite) && statutPositionA(p, options.date) === 'En place')
    .map((p) => p.identiteId)
  return [...new Set(ids)].map((id) => identiteDuCompte(id, compteId, options))
}

/**
 * Recueil EPC, PT-04.02 : le débit est pré-notifié au débiteur, toujours détenteur du compte débité. Il reçoit l'avis en
 * plus des copropriétaires quand il n'en est pas (le contenu n'annonce aucun débit sans détenteur rattaché).
 */
function destinatairesDuDebit(compte: ContenuAvisCompte, coproprietaires: Identite[], debit: DebitAnnonce, options: OptionsDiffusionAvis): Identite[] {
  const detenteurId = debit.mandat.debiteurIdentiteId
  if (!detenteurId || coproprietaires.some((i) => i.id === detenteurId)) return coproprietaires
  return [...coproprietaires, identiteDuCompte(detenteurId, compte.compteId, options)]
}

/** L'avis sans le débit : tout le total se règle hors prélèvement, sans mention de pré-notification (🔵). */
const sansLeDebit = (compte: ContenuAvisCompte, debit: DebitAnnonce): ContenuAvisCompte => ({
  ...compte,
  modeReglement: debit.horsPrelevement.mode,
  instructions: debit.horsPrelevement,
  mentions: compte.mentions.filter((m) => m.cle !== 'prenotification'),
})

const anomaliePrenotificationImpossible = (debit: DebitAnnonce): AnomalieDiffusion => ({
  code: 'prenotification_impossible',
  gravite: 'avertissement',
  message: `Pas de courrier préparé pour le détenteur du compte débité (« ${debit.mandat.debiteur} ») : la pré-notification lui manque, le prélèvement sera écarté du lot ; cet avis n'annonce donc aucun débit et indique le règlement par ${texteHorsPrelevement(debit.horsPrelevement)}.`,
})

/** Canal de l'avis pour une identité, l'origine de l'adresse électronique, l'invitation à la confirmer, le retour en erreur. */
interface CanalDiffusion {
  canal: CanalAvis
  adresseElectronique: string | null
  origineAdresse: OrigineAdresseAvis | null
  /** J69 : premier avis envoyé à l'adresse des notifications : texte de l'invitation à confirmer ; null sinon. */
  invitation: string | null
  anomalies: AnomalieDiffusion[]
}

const LETTRE_SIMPLE: CanalDiffusion = { canal: 'postal', adresseElectronique: null, origineAdresse: null, invitation: null, anomalies: [] }

/** J69 : texte de l'invitation portée par le premier avis envoyé à l'adresse des notifications. */
const INVITATION_CONFIRMATION_ADRESSE =
  "Cet avis vous est envoyé à l'adresse électronique donnée pour les notifications (D. 1967 art. 65). Pour recevoir les avis d'appel de fonds à cette adresse, confirmez-la ; vous pouvez aussi demander à les recevoir par lettre simple (D. 1967 art. 35-2)."

/** Avis déjà envoyés à cette adresse des notifications depuis sa communication, au plus tard à la date. */
const envoisAAdresse = (identiteId: string, communication: CommunicationAdresseElectronique, options: OptionsDiffusionAvis): CourrielAvisEnvoye[] =>
  (options.courrielsAvis ?? []).filter(
    (c) =>
      c.identiteId === identiteId &&
      c.adresse.trim().toLowerCase() === communication.adresse.toLowerCase() &&
      c.envoyeLe >= communication.communiqueeLe &&
      c.envoyeLe <= options.date,
  )

/** J69 : dernière demande de lettre simple pour les avis de l'identité, reçue au plus tard à la date ; null sinon. */
function demandeLettreSimple(identiteId: string, options: OptionsDiffusionAvis): DemandeLettreSimpleAvis | null {
  let derniere: DemandeLettreSimpleAvis | null = null
  for (const d of options.demandesLettreSimpleAvis ?? [])
    if (d.identiteId === identiteId && d.recueLe <= options.date && (derniere === null || d.recueLe > derniere.recueLe)) derniere = d
  return derniere
}

/**
 * J69 (J67, R20) — D. 1967 art. 35-2 : par voie électronique « à l'adresse communiquée par le copropriétaire à cet
 * effet », ou par lettre simple à défaut. L'adresse donnée pour les avis sert même si la voie postale est demandée pour
 * les notifications (art. 64-1, 64-4) ; sans elle, l'adresse des notifications (art. 65), sauf demande de voie postale :
 * invitation à confirmer sur le premier avis envoyé ainsi, lettre simple après un retour en erreur. Une demande de
 * lettre simple pour les avis (réponse à l'invitation) donne la lettre simple, sauf adresse donnée pour les avis après
 * elle ; à date égale, la lettre simple. Avant le 25/12/2025 (voie non calculée), lettre simple, comme avant. J74 : une
 * renonciation à la voie postale lève la demande à son effet ; son adresse compte parmi celles des notifications.
 */
function canalDeDiffusion(identiteId: string, options: OptionsDiffusionAvis): CanalDiffusion {
  const renonciations = options.renonciations ?? []
  const { voie } = voieDeNotification({ identiteId, demandes: options.demandesVoiePostale, renonciations, date: options.date })
  if (voie === null) return LETTRE_SIMPLE
  const pourAvis = adresseElectroniqueDeNotification({ identiteId, communications: options.communicationsAvis ?? [], date: options.date })
  const lettreSimple = demandeLettreSimple(identiteId, options)
  if (lettreSimple && (!pourAvis || pourAvis.communiqueeLe <= lettreSimple.recueLe)) return LETTRE_SIMPLE
  if (pourAvis) return { ...LETTRE_SIMPLE, canal: 'electronique', adresseElectronique: pourAvis.adresse, origineAdresse: 'avis' }
  const notification = adresseElectroniqueDeNotification({
    identiteId,
    communications: [...options.communications, ...communicationsDesRenonciations(renonciations)],
    date: options.date,
  })
  if (voie !== 'electronique' || !notification) return LETTRE_SIMPLE
  const envois = envoisAAdresse(identiteId, notification, options)
  const retour = envois.find((c) => c.retourEnErreurLe !== null && c.retourEnErreurLe <= options.date)
  if (retour)
    return {
      ...LETTRE_SIMPLE,
      anomalies: [
        {
          code: 'courriel_avis_en_erreur',
          gravite: 'avertissement',
          message: `Avis du ${dateIsoVersFr(retour.envoyeLe)} revenu en erreur le ${dateIsoVersFr(retour.retourEnErreurLe ?? retour.envoyeLe)} à ${notification.adresse} : lettre simple jusqu'à une nouvelle adresse (D. 1967 art. 35-2 ; J69).`,
        },
      ],
    }
  return {
    ...LETTRE_SIMPLE,
    canal: 'electronique',
    adresseElectronique: notification.adresse,
    origineAdresse: 'notifications',
    invitation: envois.length === 0 ? INVITATION_CONFIRMATION_ADRESSE : null,
  }
}

/**
 * Lettre simple : sans adresse postale, pas d'envoi ; adresses concurrentes ou échue : avertissement (identites-positions.ts).
 * L'avis n'est pas une notification : à défaut d'adresse de notification, une adresse d'origine « autre » sert, avec un
 * avertissement (J67, R19).
 */
function anomaliesAdressePostale(identite: Identite, date: string): AnomalieDiffusion[] {
  return controlerAdresseDeCourrierSimple(identite, date).map((a) => {
    const gravite: AnomalieDiffusion['gravite'] = a.code === 'sans_adresse' ? 'bloquant' : 'avertissement'
    return { code: a.code, gravite, message: a.message }
  })
}

/**
 * Diffusion postérieure à l'émission : la pré-notification se recompte depuis la diffusion (bloquant) et l'avis diffusé
 * à l'exigibilité ou après est signalé (D. 1967 art. 35-2 : avis préalable). À la date d'émission, le contenu l'a déjà fait.
 */
function anomaliesDateDiffusion(compte: ContenuAvisCompte, date: string): AnomalieDiffusion[] {
  if (date <= compte.dateEmission) return []
  const anomalies: AnomalieDiffusion[] = []
  const premiere = compte.parExigibilite[0]?.exigibilite
  if (premiere && date >= premiere)
    anomalies.push({
      code: 'diffuse_apres_exigibilite',
      gravite: 'avertissement',
      message: `Avis diffusé le ${dateIsoVersFr(date)}, sans précéder l'exigibilité du ${dateIsoVersFr(premiere)} (${FONDEMENT_AVIS}) ; l'exigibilité n'en est pas reportée.`,
    })
  const debit = debitAnnonce(compte.instructions)
  if (debit && preavisInsuffisant(date, debit.mandat, debit.date))
    anomalies.push({ code: 'preavis_insuffisant', gravite: 'bloquant', message: messagePreavis(`l'avis diffusé le ${dateIsoVersFr(date)}`, debit.mandat, debit.date) })
  return anomalies
}

interface DiffusionDuCompte {
  bloque: boolean
  detenteurId: string | null
  anomalies: AnomalieDiffusion[]
  /** J67, R100 : plusieurs personnes connues du compte reçoivent l'avis ; mandataire commun désigné, ou null. */
  plusieurs: boolean
  mandataireId: string | null
}

/** J67, R100 : texte de la recommandation, mot pour mot ; la copie dit où va l'avis principal. */
const MENTION_PAYER_UNE_FOIS = 'Même somme pour tout le lot, à payer une seule fois.'
const MENTION_COPIE_MANDATAIRE = `${MENTION_PAYER_UNE_FOIS} Copie : l'avis principal est adressé au mandataire commun (L. 1965 art. 23).`

const exemplaireDe = (identiteId: string, duCompte: DiffusionDuCompte): DiffusionAvisCompte['exemplaire'] =>
  duCompte.mandataireId === null || duCompte.mandataireId === identiteId ? 'principal' : 'copie'

function mentionPayerUneFois(exemplaire: DiffusionAvisCompte['exemplaire'], duCompte: DiffusionDuCompte): string | null {
  if (!duCompte.plusieurs) return null
  return exemplaire === 'copie' ? MENTION_COPIE_MANDATAIRE : MENTION_PAYER_UNE_FOIS
}

function diffusionPour(compte: ContenuAvisCompte, identite: Identite, duCompte: DiffusionDuCompte, options: OptionsDiffusionAvis): DiffusionAvisCompte {
  const { canal, adresseElectronique, origineAdresse, invitation, anomalies: anomaliesCanal } = canalDeDiffusion(identite.id, options)
  const adressePostale = adressePourCourrierSimple(identite, options.date)
  const anomalies: AnomalieDiffusion[] = [
    ...anomaliesCanal,
    ...(canal === 'postal' ? anomaliesAdressePostale(identite, options.date) : []),
    ...anomaliesDateDiffusion(compte, options.date),
    ...duCompte.anomalies,
  ]
  const adresse = adressePostale ? texteAdresse(adressePostale) : adresseElectronique
  const exemplaire = exemplaireDe(identite.id, duCompte)
  const valeursFusion = {
    ...valeursFusionAvis(compte, { nom: nomDestinataire(identite), adresse }, options.socle),
    'mention.confirmationAdresse': invitation,
    'mention.payerUneFois': mentionPayerUneFois(exemplaire, duCompte),
  }
  const fusion = controlerContexteFusion('avis_appel_fonds', valeursFusion)
  if (!fusion.complet)
    anomalies.push({ code: 'fusion_incomplete', gravite: 'bloquant', message: `Champs à compléter : ${[...fusion.manquants.map((c) => c.cle), ...fusion.invalides.map((c) => c.cle)].join(', ')}.` })
  if (duCompte.bloque) anomalies.push({ code: 'contenu_bloque', gravite: 'bloquant', message: `Avis du compte ${compte.numeroCompte} : lever d'abord ses anomalies bloquantes.` })
  const modele = canal === 'electronique' ? options.modeles.electronique : options.modeles.postal
  const courrier = anomalies.some((a) => a.gravite === 'bloquant')
    ? null
    : preparerCourrier(modele, {
        objet: `Avis d'appel de fonds — compte ${compte.numeroCompte} — à régler avant le ${dateIsoVersFr(compte.aReglerAvantLe)}`,
        coproprieteId: options.coproprieteId,
        mandatId: options.mandatId,
        personneId: identite.id,
      })
  return {
    compteId: compte.compteId,
    identiteId: identite.id,
    canal,
    formeEnvoi: modele.formeEnvoi,
    adresseElectronique,
    origineAdresse,
    exemplaire,
    adressePostale,
    valeursFusion,
    courrier,
    prenotification: identite.id === duCompte.detenteurId,
    anomalies,
  }
}

/** Compte sans courrier possible : une seule sortie, qui porte l'anomalie. */
const diffusionSansCourrier = (compte: ContenuAvisCompte, anomalieDiffusion: AnomalieDiffusion): DiffusionAvisCompte => ({
  compteId: compte.compteId,
  identiteId: null,
  canal: null,
  formeEnvoi: null,
  adresseElectronique: null,
  origineAdresse: null,
  exemplaire: 'principal',
  adressePostale: null,
  valeursFusion: {},
  courrier: null,
  prenotification: false,
  anomalies: [anomalieDiffusion],
})

/**
 * Courriers d'un compte qui a des fonds appelés et des copropriétaires en place. 🔵 Débit annoncé que son détenteur ne
 * peut recevoir (courrier impossible : adresse, fusion) : les courriers préparés pour les autres destinataires le sont
 * sans le débit (sansLeDebit), que le lot écarte ; un blocage commun au compte (contenu, préavis) les laisse tous sans
 * courrier.
 */
function diffusionsDuCompte(contenu: ContenuAvisAppel, compte: ContenuAvisCompte, coproprietaires: Identite[], options: OptionsDiffusionAvis): DiffusionAvisCompte[] {
  const bloque = codesBloquants(contenu, compte).length > 0
  const debit = debitAnnonce(compte.instructions)
  const personnes = { plusieurs: coproprietaires.length > 1, mandataireId: compte.mandataireCommunId }
  if (!debit) return coproprietaires.map((identite) => diffusionPour(compte, identite, { bloque, detenteurId: null, anomalies: [], ...personnes }, options))
  const detenteurId = debit.mandat.debiteurIdentiteId
  const identites = destinatairesDuDebit(compte, coproprietaires, debit, options)
  const sorties = identites.map((identite) => diffusionPour(compte, identite, { bloque, detenteurId, anomalies: [], ...personnes }, options))
  if (sorties.some((s) => s.prenotification && s.courrier !== null)) return sorties
  const sansDebit = sansLeDebit(compte, debit)
  const duCompte: DiffusionDuCompte = { bloque, detenteurId, anomalies: [anomaliePrenotificationImpossible(debit)], ...personnes }
  return sorties.map((s, n) => (s.prenotification || s.courrier === null ? s : diffusionPour(sansDebit, identites[n], duCompte, options)))
}

/**
 * J67, R100 : personnes connues du compte, le mandataire commun désigné en tête (L. 1965 art. 23 ; J10), même s'il n'est
 * pas lui-même indivisaire.
 */
function personnesDuCompte(compte: ContenuAvisCompte, coproprietaires: Identite[], options: OptionsDiffusionAvis): Identite[] {
  const mandataireId = compte.mandataireCommunId
  if (mandataireId === null) return coproprietaires
  const mandataire = identiteDuCompte(mandataireId, compte.compteId, options)
  return [mandataire, ...coproprietaires.filter((i) => i.id !== mandataireId)]
}

/**
 * Préparation de la diffusion par le circuit Courrier (gabarit « avis_appel_fonds ») : un courrier par compte et par
 * identité destinataire (mandataire commun en tête, copropriétaires, et détenteur du compte débité s'il n'en est pas),
 * canal choisi selon l'art. 35-2 (J69), valeurs de fusion contrôlées. Aucun envoi : le courrier reste en « Préparation » ; aucun courrier tant
 * qu'une anomalie bloquante subsiste (contenu, adresse, fusion), ni pour un compte sans fonds appelé ; aucun débit
 * annoncé que son détenteur ne reçoit pas.
 */
export function preparerDiffusionAvis(contenu: ContenuAvisAppel, options: OptionsDiffusionAvis): DiffusionAvisCompte[] {
  verifierDate('Date de diffusion', options.date)
  if (options.date < contenu.dateEmission)
    throw new Error(`Diffusion le ${dateIsoVersFr(options.date)}, avant l'émission de l'avis du ${dateIsoVersFr(contenu.dateEmission)}.`)
  return contenu.parCompte.flatMap((compte) => {
    if (compte.lignes.length === 0)
      return [diffusionSansCourrier(compte, { code: 'sans_appel', gravite: 'avertissement', message: `Compte ${compte.numeroCompte} : aucun fonds appelé, pas d'avis à diffuser.` })]
    const coproprietaires = destinatairesDuCompte(compte.compteId, options)
    if (coproprietaires.length === 0)
      return [
        diffusionSansCourrier(compte, {
          code: 'sans_destinataire',
          gravite: 'bloquant',
          message: `Compte ${compte.numeroCompte} : aucun copropriétaire en place au ${dateIsoVersFr(options.date)} pour recevoir l'avis.`,
        }),
      ]
    return diffusionsDuCompte(contenu, compte, personnesDuCompte(compte, coproprietaires, options), options)
  })
}

// ─── Mutation entre l'avis et l'exigibilité (J67, R113) ──────────────────────────────────────────────────────────

/** Ligne de l'avis passée d'un compte à un autre par la mutation du lot. */
export interface PosteTransfere {
  echeanceId: string
  lotId: string
  exigibilite: string
  deCompteId: string
  versCompteId: string
  quotePartCentimes: number
}

/** Débit pré-notifié au détenteur du compte, qui n'aura pas lieu : le message à lui adresser. */
export interface PrelevementAnnule {
  compteId: string
  identiteId: string
  montantCentimes: number
  date: string
  message: string
}

export interface EffetsMutationAvis {
  postesTransferes: PosteTransfere[]
  /** Comptes dont l'avis change (vendeur, acquéreur), dans l'ordre des séries : à diffuser de nouveau (preparerDiffusionAvis). */
  comptesARediffuser: string[]
  prelevementsAnnules: PrelevementAnnule[]
}

const cleLigne = (l: Pick<LigneContenuAvis, 'echeanceId' | 'lotId'>): string => `${l.echeanceId}:${l.lotId ?? ''}`

/** Compte de chaque ligne (échéance, lot) d'un avis. */
function comptesDesLignes(contenu: ContenuAvisAppel): Map<string, { compteId: string; ligne: LigneContenuAvis }> {
  return new Map(contenu.parCompte.flatMap((c) => c.lignes.map((ligne) => [cleLigne(ligne), { compteId: c.compteId, ligne }] as const)))
}

/** Le débit du compte change (montant ou date), ou disparaît, entre les deux avis. */
function debitChange(avant: DebitAnnonce, apres: ContenuAvisCompte | undefined): boolean {
  const nouveau = apres ? debitAnnonce(apres.instructions) : null
  return !nouveau || nouveau.montantCentimes !== avant.montantCentimes || nouveau.date !== avant.date
}

function messageAnnulation(avant: ContenuAvisCompte, debit: DebitAnnonce, apres: ContenuAvisCompte | undefined): string {
  const nouveau = apres ? debitAnnonce(apres.instructions) : null
  const suite = nouveau ? ` Un nouvel avis annonce le prélèvement de ${eur(nouveau.montantCentimes)} le ${dateIsoVersFr(nouveau.date)}.` : ''
  return `Le prélèvement SEPA de ${eur(debit.montantCentimes)} du ${dateIsoVersFr(debit.date)} (mandat ${debit.rum}), annoncé par l'avis du ${dateIsoVersFr(avant.dateEmission)}, n'aura pas lieu : après la vente du lot, les sommes exigibles après le jour de la vente sont dues par l'acquéreur ; celle exigible le jour même reste à votre charge (D. 1967 art. 6-2).${suite}`
}

/**
 * Comptes VENDEURS de l'avis d'avant dont le débit pré-notifié (courrier préparé au détenteur) ne tient plus (J67, R113
 * (3) : le message ne va qu'au vendeur ; l'acquéreur reçoit le nouvel avis, qui vaut nouvelle pré-notification).
 */
function prelevementsAnnules(avant: ContenuAvisAppel, apres: ContenuAvisAppel, vendeurs: ReadonlySet<string>, diffusions: readonly DiffusionAvisCompte[]): PrelevementAnnule[] {
  return avant.parCompte.flatMap((compte) => {
    const debit = debitAnnonce(compte.instructions)
    const nouveau = apres.parCompte.find((c) => c.compteId === compte.compteId)
    if (!debit || !vendeurs.has(compte.compteId) || !debitChange(debit, nouveau)) return []
    const prevenu = diffusions.find((d) => d.compteId === compte.compteId && d.prenotification && d.courrier !== null && d.identiteId !== null)
    if (!prevenu?.identiteId) return []
    return [{ compteId: compte.compteId, identiteId: prevenu.identiteId, montantCentimes: debit.montantCentimes, date: debit.date, message: messageAnnulation(compte, debit, nouveau) }]
  })
}

/**
 * Effets d'une mutation enregistrée entre l'avis et l'exigibilité (J67, R113 ; D. 1967 art. 6-2, 1° et 2°) : `avant` est
 * l'avis émis, `apres` le même avis recalculé avec les positions après la mutation (avisDAppel : le poste exigible le jour
 * même reste au vendeur, les suivants vont à l'acquéreur). Rend les postes transférés, les comptes à rediffuser (l'acquéreur
 * reçoit un avis) et, pour le seul vendeur dont le détenteur a reçu la pré-notification d'un débit qui ne tient plus, le
 * message disant que le prélèvement n'aura pas lieu (un acquéreur déjà prélevé reçoit le nouvel avis, rien de plus).
 * L'adaptateur echeancesPrelevementDepuisAvis, lancé sur `apres`, ne prélève plus le vendeur pour ces postes. Refuse
 * deux avis d'émissions différentes.
 */
export function effetsMutationSurAvis(avant: ContenuAvisAppel, apres: ContenuAvisAppel, diffusionsAvant: readonly DiffusionAvisCompte[]): EffetsMutationAvis {
  if (avant.dateEmission !== apres.dateEmission)
    throw new Error(`Avis du ${dateIsoVersFr(avant.dateEmission)} et du ${dateIsoVersFr(apres.dateEmission)} : comparer le même avis, avant et après la mutation.`)
  const nouveaux = comptesDesLignes(apres)
  const postesTransferes: PosteTransfere[] = []
  for (const [cle, { compteId, ligne }] of comptesDesLignes(avant)) {
    const nouveau = nouveaux.get(cle)
    if (nouveau && nouveau.compteId !== compteId)
      postesTransferes.push({
        echeanceId: ligne.echeanceId,
        lotId: ligne.lotId ?? '',
        exigibilite: ligne.exigibilite,
        deCompteId: compteId,
        versCompteId: nouveau.compteId,
        quotePartCentimes: ligne.quotePartCentimes,
      })
  }
  const touches = new Set(postesTransferes.flatMap((p) => [p.deCompteId, p.versCompteId]))
  const ordre = [...avant.parCompte, ...apres.parCompte].map((c) => c.compteId)
  return {
    postesTransferes,
    comptesARediffuser: [...new Set(ordre)].filter((id) => touches.has(id)),
    prelevementsAnnules: prelevementsAnnules(avant, apres, new Set(postesTransferes.map((p) => p.deCompteId)), diffusionsAvant),
  }
}
