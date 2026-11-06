import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  AFFECTATION_FONDS_TRAVAUX,
  controlerAffectationFondsTravaux,
  type CauseAffectation,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import type { EmploiFondsTravaux } from '@/lib/administrateur-judiciaire/domain/fonds-travaux-lots'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import type { TypeMajorite } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import type { ReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import {
  affectationFondsDeLOperation,
  etatPartFondsTravaux,
  reglementsDeLOperation,
  statutsDesTranches,
  type OperationTravaux,
} from '@/lib/administrateur-judiciaire/domain/travaux-operations'

/**
 * Budget et suivi financier d'une opération de travaux (point 31 du bilan ; cartographie Gestéam, tranches 21, 26, 27,
 * 32 et 43). Fonctions pures, montants en CENTIMES ENTIERS, sans écran ni table : le stockage du budget dans la table
 * Travaux (db/schema.ts, coquille) et l'onglet Budget restent à Frédéric. Complète travaux-operations.ts (point 30), qui
 * porte le budget TTC adopté, la part du fonds de travaux, les tranches et les règlements de l'opération.
 *
 * Gestéam — 🟢 lu :
 * - tranche 32, onglet Budget : honoraires (forfait TTC ou taux % sur montant HT ; cases Supplément, Autres honoraires,
 *   hono. suppl., DO ; bouton Facturer) ; dommages-ouvrage (forfait, s/hono. syndic, suppl.) ; tableau Budget TTC ·
 *   Suppléments · Règlements des lignes Travaux · Dommages-ouvrage · Honoraires cabinet · Honoraires presta. · Total
 *   engagé ; puis Budget adopté · Solde budgétaire · Appels votés · Fonds de prévoyance · Prime, subvention · Indemnités ;
 *   puis Règlements / budget · Fonds appelés · Appels non reçus · Solde de trésorerie ; bouton « Ne pas utiliser les
 *   fonds travaux » ; grille des devis par clé ; lignes de marché par entreprise (garantie, déduction fiscale : point 32) ;
 * - tranche 26 : types de compte « Travaux - Honoraires », « Travaux - Subventions », « Travaux - Emprunts », « Travaux -
 *   Fonds travaux appelés » ; cinq natures de fonds (avance de trésorerie, prévoyance, réserve, solidarité, travaux), à
 *   ne pas fusionner ;
 * - tranche 27 : tarifs « Travaux - HONORAIRES TRAVAUX » et « Travaux - HONORAIRES Diligences travaux d'urgence » ;
 *   tranche 21 : comptes 62xxx « honoraires administrateur provisoire » (62001), « honoraires administrateur
 *   judiciaire » (62111), « honoraires travaux » ;
 * - tranche 43 § 11 : chaque opération a sa série de comptes (point 30).
 *
 * Le droit — 🟢 lu sur Légifrance le 03/11/2026 (versions en vigueur à cette date) :
 * - L. 1965 art. 14-3, al. 2 : charges et produits « enregistrés dès leur engagement juridique par le syndic
 *   indépendamment de leur règlement. L'engagement est soldé par le règlement. » ;
 * - L. 1965 art. 14-2-1, I, al. 7 : l'assemblée affecte le fonds de travaux « par un vote à la même majorité que celle
 *   applicable aux dépenses concernées » (contrôle J4 : fonds-travaux.ts, controlerAffectationFondsTravaux), en tenant
 *   compte « de l'existence de parties communes spéciales ou de clefs de répartition des charges » (texte cité par
 *   travaux-operations.ts, point 30 ; J4 : « en tenant compte des parties communes spéciales et des clés de
 *   répartition ») ; art. 29-14, 2° : le juge peut autoriser l'administrateur provisoire à utiliser le fonds ;
 * - D. 2005-240 art. 4 : produits pour travaux : sommes reçues ou à recevoir des copropriétaires, emprunts, « subventions
 *   notifiées », « indemnités d'assurance » ; art. 8 : l'état des travaux « fait apparaître en fin d'exercice le réalisé
 *   et le prévisionnel de chaque opération » ;
 * - arrêté du 14 mars 2005, art. 7 : 102 « Provisions pour travaux décidés », 671 « Travaux décidés par l'assemblée
 *   générale », 702 « Provisions sur travaux du I de l'article 14-2 et opérations exceptionnelles » (intitulés de la
 *   série du point 30, vérifiés), 711 « Subventions », 712 « Emprunts », 713 « Indemnités d'assurances », 616 « Primes
 *   d'assurances », 6221 « Honoraires travaux », 623 « Rémunérations de tiers intervenants » ; AUCUN compte de
 *   dommages-ouvrage dans la nomenclature ;
 * - honoraires du syndic sur travaux : L. 1965 art. 18-1 A, III — travaux du II de l'art. 14-1 votés en application des
 *   art. 24, 25, 26-3 et 30 ; honoraires spécifiques « votés lors de la même assemblée générale que les travaux
 *   concernés, aux mêmes règles de majorité », exprimés « en pourcentage du montant hors taxes des travaux, à un taux
 *   dégressif » ; l'article vise le syndic, ni l'administrateur provisoire, ni le syndic désigné en justice ;
 * - rémunération de l'administrateur provisoire de l'art. 29-1 : L. 1965 art. 29-1, II (« fixées par décret ») ; D. 1967
 *   art. 61-1-5 : droits proportionnels dégressifs par tranche sur « le montant des travaux exceptionnels » (I, 2°),
 *   acomptes fixés chaque année par le président du tribunal judiciaire (II), rémunération arrêtée par lui à l'issue de
 *   la mission (III) ; arrêté du 8 octobre 2015, art. 11 : droit proportionnel sur « le montant total hors taxes des
 *   travaux mentionnés à l'article 44 du décret du 17 mars 1967 susvisé ou des travaux urgents au sens de l'article 37 »,
 *   votés en assemblée ou décidés par l'administrateur provisoire investi des pouvoirs de l'assemblée : 2 % de 1 à
 *   12 500 euros, 1,5 % de 12 501 à 25 000 euros, 1 % au-delà ; pas en administration provisoire renforcée ; art. 3 : à
 *   500 lots et plus, « l'entière rémunération » est fixée par le juge ; art. 15 : droits proportionnels des art. 11, 12
 *   et 13 au-delà de 75 000 euros (HT) → D. 1967 art. 61-1-5, III, al. 2 et 3 ; art. 14 : les actes accomplis pour le
 *   placement sous administration provisoire renforcée sont rémunérés hors droits fixes et proportionnels ;
 * - D. 1967 art. 46, al. 3 : le syndic désigné par le président du tribunal judiciaire administre selon les art. 18 à
 *   18-2 de la loi ; art. 47 (administrateur provisoire faute de syndic) : rien sur sa rémunération.
 *
 * Règles :
 * - budget de l'opération en quatre postes (Travaux, Dommages-ouvrage, Honoraires cabinet, Honoraires presta.) : montant
 *   engagé TTC et suppléments, réglé et reste à régler par poste ; total engagé ; budget adopté (celui de la décision)
 *   et solde budgétaire ; appels votés, part du fonds de travaux, autres financements (accordé, reçu) ;
 * - suivi : fonds appelés (échéances « Appelé » de l'opération, même syndicat, D1), encaissé (réglé des postes de dette
 *   nés de ses échéances, comme statutsDesTranches), appels non reçus, réglé et en cours (reglementsDeLOperation), emploi
 *   du fonds de travaux, solde de trésorerie ;
 * - fonds de travaux : la part de l'opération passe le contrôle d'affectation (etatPartFondsTravaux, J4) ; chaque emploi
 *   rattaché à l'opération (fonds-travaux-lots.ts) le passe aussi (controlerAffectationFondsTravaux), comme valeur
 *   enregistrée (décision J30, PR #643 : `aujourdhui: null`, la forme d'une décision d'affectation ou d'une ordonnance
 *   de l'art. 29-14, 2° structurée est contrôlée, sa date n'est pas comparée au jour) : un refus, dont une forme
 *   structurée incomplète, est bloquant (emploi_fonds_non_autorise) ; une décision ou une ordonnance admise mais en
 *   texte libre d'avant J30, un avertissement non bloquant (emploi_fonds_forme_incomplete, message du contrôle et son
 *   fondement), comme avis-appel.ts ; « Ne pas utiliser les fonds travaux » : aucune part (refusée à la création,
 *   travaux-operations.ts) et tout emploi est signalé bloquant, en plus du rapprochement des emplois avec la part nulle
 *   (al. 7), que la case ne masque pas ; un emploi rattaché à une opération sans décision (« Projet », « Rejeté ») est
 *   bloquant : aucune dépense décidée à financer (comme le point 30 : pas d'appel sans décision) ; des emplois au-delà
 *   de la part de l'opération sont signalés (pas de décision d'affectation au-delà, al. 7 ; usage judiciaire :
 *   art. 29-14, 2°) ; regroupés par clé
 *   (EmploiFondsTravaux.cleId), au-delà de la part de leur clé (cles[].financementFondsTravauxCentimes, plusieurs clés)
 *   ou sur une clé étrangère à l'opération, ils sont signalés aussi (al. 7 : l'affectation tient compte des clés de
 *   répartition ; usage judiciaire : art. 29-14, 2°, à confirmer) ; un règlement de l'opération payé depuis un compte du
 *   fonds est bloquant sans part (al. 7 ; usage judiciaire : art. 29-14, 2° ; case cochée ou non, la case rappelée au
 *   message) ou case cochée ;
 * - avant le décaissement, controlerEmploiFondsOperation contrôle un nouvel emploi pour l'opération, sur la clé de la
 *   dépense (exigée avec plusieurs clés, avec le déjà employé sur la clé), dans l'ordre : opération sans décision, part
 *   nulle (refus qui ne dépendent pas du bouton : la case cochée, qui exige une part nulle, est rappelée au motif sans les
 *   masquer), case
 *   cochée (seule cause avec une part : données incohérentes), clé sans part ou étrangère, cumul au-delà de la part de
 *   l'opération, cumul au-delà de la part de la clé, puis controlerAffectationFondsTravaux sur l'affectation de la part
 *   (affectationFondsDeLOperation), au montant de l'emploi ;
 * - constat : contrairement à la ligne 31 du bilan, controlerAffectationFondsTravaux est déjà appelé depuis le point 30
 *   (création et appels de l'opération, avis d'appel, virement qui sort du compte du fonds) ; ce module l'appelle en plus
 *   à chaque emploi du fonds pour l'opération ;
 * - honoraires sur travaux : un poste du budget, jamais un élément à facturer (honoraires-facturation.ts inchangé) ;
 *   cadre selon le régime du mandat (cadreHonorairesTravaux) ; sous le cadre de l'art. 18-1 A, III, le vote est
 *   contrôlé (même assemblée, même majorité, pourcentage du hors taxes) ; sous administration provisoire de l'art. 29-1,
 *   le poste est une prévision soumise au juge, estimée au barème de l'art. 11 de l'arrêté du 8 octobre 2015
 *   (droitProportionnelTravauxAdministrateurProvisoire) ;
 * - le budget contrôlé est celui de l'opération (même n°, même syndicat, D1), au suivi comme au contrôle des honoraires ;
 *   la date de l'assemblée qui vote les honoraires est une date ISO valide.
 *
 * 🔵 Déduit :
 * - « engagé » d'un poste = « Budget TTC » + « Suppléments » (marchés et devis commandés, contrat dommages-ouvrage,
 *   honoraires votés : l'engagement juridique de l'art. 14-3), soldé par ses règlements ; « Total engagé » = somme des
 *   postes ; « Solde budgétaire » = budget adopté − total engagé ; budget adopté et appels votés sans objet sans décision ;
 * - « Appels votés » = somme des tranches (le montant à appeler quand elles font 100 %) ; « Fonds appelés » = échéances
 *   appelées ; « Appels non reçus » = appelé − encaissé ; « Solde de trésorerie » = encaissé + emploi du fonds de travaux
 *   + financements reçus − réglé ; aucun calcul daté : l'état des données fournies ;
 * - un règlement se rattache à un poste par la ventilation du budget (id du règlement → poste) ; non ventilé, il compte
 *   au réglé de l'opération, pas à celui d'un poste ;
 * - un emploi du fonds compte dans la trésorerie de l'opération même signalé : la somme a quitté le fonds ; la
 *   ventilation et le contrôle restent ceux du syndicat de l'opération (emplois fournis : ceux de son fonds, D1) ;
 * - un règlement payé depuis un compte du fonds n'est pas compté comme un emploi : seul l'emploi saisi
 *   (emploiDepuisOperation) entre à la trésorerie, pour ne pas compter deux fois la même sortie ;
 * - « Ne pas utiliser les fonds travaux » est une règle de gestion VitFix (L. 1965 art. 14-2-1 lu en entier : rien sur ce
 *   cas) : ses refus et signalements ne citent aucun fondement ; le refus d'un emploi et l'emploi signalé sont à
 *   confirmer (ils suivent la lecture large de la question 🔴 sur le bouton) ; le règlement depuis le compte du fonds,
 *   exclu dans les deux lectures, ne l'est pas ; la case exige une part nulle : les refus qu'elle accompagne (opération
 *   sans décision, part nulle, emplois au-delà de la part nulle, règlement depuis le compte du fonds sans part) gardent
 *   leur fondement et ne dépendent pas du bouton (al. 7 : certains ; usage judiciaire : art. 29-14, 2°, à confirmer pour
 *   la seule question de la borne de l'usage judiciaire) ;
 * - un emploi sans clé fournie, pour une opération à une seule clé, finance cette clé ; avec plusieurs clés, l'appelant
 *   donne la clé de la dépense et le déjà employé sur cette clé : aucune clé n'est choisie par défaut ;
 * - régime null (regimeDepuisFondement : mandat ad hoc, fondement vide ou non reconnu) : régime inconnu, cadre des
 *   honoraires non établi ; le syndic désigné par l'assemblée se passe explicitement (« syndic »), comme le cadre du
 *   contrat type que l'appelant passe à honoraires-sinistre.ts ;
 * - barème de l'art. 11 appliqué par tranches (« dégressifs par tranche », D. 1967 art. 61-1-5, I, 2°), bornes à 12 500
 *   et 25 000 euros, arrondi au centime le plus proche (demi au-dessus) du total ;
 * - la rémunération de l'administrateur provisoire ne se vote pas : des honoraires votés sous ce régime sont signalés.
 *
 * 🔴 Non établi (questions pour Frédéric ou Hugo) :
 * - « La ligne "Fonds de prévoyance" de l'onglet Budget porte-t-elle la part financée par le fonds de travaux (art.
 *   14-2-1), sous son ancien nom, ou un fonds de prévoyance distinct (nature "Fonds de prévoyance" du plan) ? » (VitFix :
 *   la part du fonds de travaux de l'opération, et un financement « fonds de prévoyance » distinct, jamais fusionnés) ;
 * - « Le bouton "Ne pas utiliser les fonds travaux" exclut-il tout emploi du fonds pour l'opération (part, emploi,
 *   règlement depuis le compte du fonds), ou seulement le règlement de ses factures depuis ce compte ? » (VitFix : tout
 *   emploi exclu) ; « Quand l'opération a une part du fonds, ses factures se règlent-elles directement depuis le compte
 *   du fonds (le règlement vaut emploi), ou après un virement du compte du fonds vers le compte courant (l'emploi est le
 *   virement) ? » (VitFix : l'emploi se saisit à part ; un règlement depuis le compte du fonds n'est contrôlé que sans
 *   part ou case cochée) ;
 * - « Quand l'administrateur provisoire utilise le fonds sur ordonnance du juge (art. 29-14, 2°), l'ordonnance fixe-t-elle
 *   un montant, et la part du fonds de l'opération (et de chacune de ses clés) borne-t-elle ses emplois ? » (VitFix : la
 *   part de l'opération et celle de chaque clé bornent l'emploi ; refus et signalements, par opération comme par clé,
 *   fondés sur l'art. 29-14, 2°, à confirmer : aucune affectation n'est votée par l'assemblée) ;
 * - « Que signifie la ligne "Règlements / budget" : le total des règlements, ou leur rapport au budget ? » (VitFix : le
 *   réglé) ; « Le "Solde de trésorerie" de Gestéam compte-t-il l'emploi du fonds de travaux et les financements reçus ? »
 *   (VitFix : oui) ;
 * - « La prime dommages-ouvrage d'une opération s'impute-t-elle au 671 de l'opération ou au 616 "Primes d'assurances" ?
 *   Les honoraires des prestataires (maître d'œuvre, bureau de contrôle) au 671 ou au 623 "Rémunérations de tiers
 *   intervenants" ? » (VitFix : aucun compte imposé par poste ; la facture garde son compte par ligne,
 *   facture-ventilee.ts) ;
 * - « Les postes du budget se ventilent-ils par clé, comme la grille des devis de l'onglet Budget ? » (VitFix : par
 *   opération) ; « Un engagement au-delà du budget adopté exige-t-il une nouvelle décision avant la commande ? » (VitFix :
 *   signalé, non bloqué) ;
 * - « Le barème de l'art. 11 de l'arrêté du 8 octobre 2015 s'applique-t-il opération par opération, ou une seule fois au
 *   "montant total" des travaux de la mission ? Sur quelle assiette : les seuls travaux, ou aussi les études, la
 *   dommages-ouvrage et les honoraires des prestataires (Gestéam : cases DO, Autres honoraires) ? » (VitFix : sur le
 *   montant hors taxes fourni, opération par opération, à confirmer) ; « Comment le cabinet présente-t-il ce droit au
 *   juge (compte provisoire détaillé des émoluments, D. 1967 art. 61-1-5, II) ? » ;
 * - « Le syndic désigné en justice (D. 1967 art. 46) perçoit-il des honoraires de travaux votés selon l'art. 18-1 A,
 *   III ? Qui fixe sa rémunération ? » (VitFix : cadre de l'art. 18-1 A, III, à confirmer) ; « Quelle rémunération pour
 *   l'administrateur provisoire de l'art. 47 ? » (aucun texte trouvé : cadre non établi) ; « En administration
 *   provisoire renforcée, les honoraires sur travaux relèvent-ils des actes hors tarif de l'art. 14 de l'arrêté ? »
 *   (VitFix : rémunération arrêtée par le juge, à confirmer) ;
 * - « Le taux "dégressif selon l'importance des travaux" de l'art. 18-1 A, III se contrôle-t-il ? » (VitFix : non ; seul
 *   le forfait, qui n'est pas un pourcentage du hors taxes, est signalé).
 * Ajouts hors de ce module : travaux-operations.ts (ajout du point 31) — champ facultatif nePasUtiliserFondsTravaux de
 * SaisieOperationTravaux, refus d'une part du fonds quand il est coché (verifierPartFondsSaisie), export
 * affectationFondsDeLOperation, extrait de controlerPartFonds et d'emploisFondsTravauxDesTranches (comportement
 * inchangé) ; fonds-travaux.ts et honoraires-facturation.ts inchangés.
 * Branchements à faire hors de ce module (fichiers non modifiés) : db/schema.ts (Frédéric) — table Travaux : postes du
 * budget, financements, ventilation des règlements, nePasUtiliserFondsTravaux ; fonds-travaux-lots.ts,
 * emploiDepuisOperation — l'emploi est rattaché à operation.cleId (la première clé) et borné par la part de l'opération :
 * un emploi par clé (cles[k], borné par cles[k].financementFondsTravauxCentimes), sinon le suivi signale tout emploi
 * d'une opération à plusieurs clés au-delà de la part de sa première clé (déjà signalé au point 30) ; et
 * emploiDepuisOperation refuserait un emploi pour une opération sans décision, comme controlerEmploiFondsOperation ;
 * reglements-fournisseurs.ts — un poste du budget sur le règlement rendrait la ventilation par id inutile ;
 * virement-interne.ts — un n° d'opération et une clé sur le virement qui sort du compte du fonds le rattacheraient à
 * l'opération : controlerEmploiFondsOperation à sa saisie (cleId, déjà employé de l'opération et de la clé), et
 * affectationFondsDeLOperation comme emploi du virement ; comptes-bancaires.ts — banquesDuFondsTravaux = comptes de
 * nature « fonds_travaux » du syndicat, lus par l'appelant ; suivi-a-faire.ts — anomalies bloquantes et
 * avertissements du suivi financier (emploi du fonds exclu, non autorisé, sans décision ou au-delà de la part de sa clé,
 * règlement sur le compte du fonds, dépassement du budget, trésorerie négative) ; appelant de cadreHonorairesTravaux —
 * regimeDepuisFondement(mandat.fondement) pour un mandat de justice, « syndic » pour un mandat de syndic désigné par
 * l'assemblée ; honoraires-facturation.ts — aucun élément d'honoraires sur travaux
 * n'est créé ici : sous le cadre de l'art. 18-1 A, III, un élément « Travaux - HONORAIRES TRAVAUX » (tranche 27) se
 * rattacherait au vote contrôlé par controlerHonorairesTravaux ; sous administration provisoire, un signalement « à
 * soumettre au juge », comme honoraires-sinistre.ts.
 */

// ─── Postes et financements ────────────────────────────────────────────────────────────────────

/** Lignes de coût du tableau Budget (Gestéam, tranche 32), dans l'ordre de l'écran. */
export const POSTES_BUDGET_TRAVAUX = ['travaux', 'dommagesOuvrage', 'honorairesCabinet', 'honorairesPrestataires'] as const
export type PosteBudgetTravaux = (typeof POSTES_BUDGET_TRAVAUX)[number]

export const LIBELLES_POSTES_BUDGET_TRAVAUX: Readonly<Record<PosteBudgetTravaux, string>> = {
  travaux: 'Travaux',
  dommagesOuvrage: 'Dommages-ouvrage',
  honorairesCabinet: 'Honoraires cabinet',
  honorairesPrestataires: 'Honoraires presta.',
}

/**
 * Financements autres que les appels et la part du fonds de travaux : lignes Gestéam « Prime, subvention »,
 * « Indemnités », « Fonds de prévoyance » (🔴 en-tête), et emprunt (D. 2005-240 art. 4 ; type « Travaux - Emprunts »).
 */
export const NATURES_FINANCEMENT_TRAVAUX = ['subvention', 'indemnite_assurance', 'emprunt', 'fonds_de_prevoyance'] as const
export type NatureFinancementTravaux = (typeof NATURES_FINANCEMENT_TRAVAUX)[number]

export const LIBELLES_FINANCEMENT_TRAVAUX: Readonly<Record<NatureFinancementTravaux, string>> = {
  subvention: 'Prime, subvention',
  indemnite_assurance: 'Indemnités',
  emprunt: 'Emprunt',
  fonds_de_prevoyance: 'Fonds de prévoyance',
}

const POSTES_CONNUS: ReadonlySet<string> = new Set(POSTES_BUDGET_TRAVAUX)
const NATURES_FINANCEMENT_CONNUES: ReadonlySet<string> = new Set(NATURES_FINANCEMENT_TRAVAUX)

export interface LigneBudgetTravaux {
  poste: PosteBudgetTravaux
  /** Gestéam « Budget TTC » : montant engagé du poste (marchés et devis commandés, contrat DO, honoraires). */
  budgetTtcCentimes: number
  /** Gestéam « Suppléments » (travaux supplémentaires, avenants) ; 0 par défaut. */
  supplementsTtcCentimes?: number
}

export interface FinancementTravaux {
  nature: NatureFinancementTravaux
  /** Libellé libre (organisme, assureur) ; à défaut, celui de la nature. */
  libelle?: string | null
  /** Montant accordé : subvention notifiée, indemnité acceptée, emprunt accordé. */
  accordeCentimes: number
  /** Montant reçu sur le compte du syndicat ; au plus l'accordé. */
  recuCentimes: number
}

export interface SaisieBudgetOperationTravaux {
  /** Une ligne par poste au plus ; un poste absent vaut zéro. */
  lignes: LigneBudgetTravaux[]
  financements?: FinancementTravaux[]
  /** Ventilation des règlements de l'opération : identifiant du règlement → poste. */
  postesDesReglements?: Readonly<Record<string, PosteBudgetTravaux>>
}

export interface BudgetOperationTravaux {
  /** Opération du budget : n° et syndicat (le n° n'est unique qu'au sein du syndicat, D1). */
  numero: string
  coproprieteId: string
  /** Les quatre postes, dans l'ordre de POSTES_BUDGET_TRAVAUX. */
  lignes: Required<LigneBudgetTravaux>[]
  financements: (FinancementTravaux & { libelle: string })[]
  postesDesReglements: Readonly<Record<string, PosteBudgetTravaux>>
}

const eur = (centimes: number): string => formatEurosCentimes(centimes / 100)
const somme = (montants: readonly number[]): number => montants.reduce((s, m) => s + m, 0)

function verifierCentimes(montant: number, objet: string): void {
  if (!Number.isInteger(montant) || montant < 0) throw new Error(`${objet} : montant invalide (${montant}), centimes entiers positifs ou nuls attendus.`)
}

function verifierPoste(poste: string, objet: string): void {
  if (!POSTES_CONNUS.has(poste)) throw new Error(`${objet} : poste du budget inconnu « ${poste} » (POSTES_BUDGET_TRAVAUX).`)
}

/** Lignes normalisées : poste connu et unique, centimes ; les quatre postes, un poste absent à zéro. */
function lignesDuBudget(numero: string, lignes: readonly LigneBudgetTravaux[]): Required<LigneBudgetTravaux>[] {
  const parPoste = new Map<PosteBudgetTravaux, Required<LigneBudgetTravaux>>()
  for (const ligne of lignes) {
    verifierPoste(ligne.poste, `Opération ${numero}`)
    if (parPoste.has(ligne.poste)) throw new Error(`Opération ${numero} : poste « ${LIBELLES_POSTES_BUDGET_TRAVAUX[ligne.poste]} » en double.`)
    const supplementsTtcCentimes = ligne.supplementsTtcCentimes ?? 0
    verifierCentimes(ligne.budgetTtcCentimes, `Opération ${numero}, ${LIBELLES_POSTES_BUDGET_TRAVAUX[ligne.poste]}`)
    verifierCentimes(supplementsTtcCentimes, `Opération ${numero}, suppléments ${LIBELLES_POSTES_BUDGET_TRAVAUX[ligne.poste]}`)
    parPoste.set(ligne.poste, { poste: ligne.poste, budgetTtcCentimes: ligne.budgetTtcCentimes, supplementsTtcCentimes })
  }
  return POSTES_BUDGET_TRAVAUX.map((poste) => parPoste.get(poste) ?? { poste, budgetTtcCentimes: 0, supplementsTtcCentimes: 0 })
}

function financementDuBudget(numero: string, f: FinancementTravaux): FinancementTravaux & { libelle: string } {
  if (!NATURES_FINANCEMENT_CONNUES.has(f.nature))
    throw new Error(`Opération ${numero} : nature de financement inconnue « ${f.nature} » (NATURES_FINANCEMENT_TRAVAUX).`)
  const libelle = f.libelle?.trim() || LIBELLES_FINANCEMENT_TRAVAUX[f.nature]
  verifierCentimes(f.accordeCentimes, `Opération ${numero}, ${libelle} accordé`)
  verifierCentimes(f.recuCentimes, `Opération ${numero}, ${libelle} reçu`)
  if (f.recuCentimes > f.accordeCentimes)
    throw new Error(`Opération ${numero}, ${libelle} : reçu (${eur(f.recuCentimes)}) supérieur à l'accordé (${eur(f.accordeCentimes)}).`)
  return { ...f, libelle }
}

/** Budget de l'opération : quatre postes, financements, ventilation des règlements. */
export function creerBudgetOperationTravaux(operation: OperationTravaux, saisie: SaisieBudgetOperationTravaux): BudgetOperationTravaux {
  const { numero, coproprieteId } = operation
  const postesDesReglements = saisie.postesDesReglements ?? {}
  for (const [reglementId, poste] of Object.entries(postesDesReglements)) verifierPoste(poste, `Règlement ${reglementId}`)
  return {
    numero,
    coproprieteId,
    lignes: lignesDuBudget(numero, saisie.lignes),
    financements: (saisie.financements ?? []).map((f) => financementDuBudget(numero, f)),
    postesDesReglements: { ...postesDesReglements },
  }
}

// ─── « Ne pas utiliser les fonds travaux » ─────────────────────────────────────────────────────

/**
 * Bouton Gestéam « Ne pas utiliser les fonds travaux » : l'opération ne puise pas dans le fonds. Refusé quand elle porte
 * une part du fonds de travaux (la part fait partie de sa décision : travaux-operations.ts) ; toujours admis pour revenir
 * à l'usage du fonds.
 */
export function marquerNePasUtiliserFondsTravaux(operation: OperationTravaux, nePasUtiliser: boolean): OperationTravaux {
  if (nePasUtiliser && operation.financementFondsTravauxCentimes > 0)
    throw new Error(
      `Opération ${operation.numero} : part du fonds de travaux de ${eur(operation.financementFondsTravauxCentimes)} ; « Ne pas utiliser les fonds travaux » exige une opération sans part du fonds.`,
    )
  return { ...operation, nePasUtiliserFondsTravaux: nePasUtiliser }
}

// ─── Suivi financier ───────────────────────────────────────────────────────────────────────────

export type GraviteAnomalieBudgetTravaux = 'bloquant' | 'avertissement' | 'information'

export type CodeAnomalieBudgetTravaux =
  | 'sans_decision'
  | 'engage_superieur_au_budget'
  | 'tranches_inferieures_au_montant_a_appeler'
  | 'part_fonds_non_autorisee'
  | 'emploi_fonds_non_autorise'
  | 'emploi_fonds_forme_incomplete'
  | 'emploi_fonds_exclu'
  | 'emploi_sans_decision'
  | 'emploi_au_dela_de_la_part'
  | 'emploi_au_dela_de_la_part_de_la_cle'
  | 'reglement_sur_compte_du_fonds'
  | 'regle_superieur_a_l_engage'
  | 'encaisse_superieur_a_l_appele'
  | 'tresorerie_negative'
  | 'reglements_non_ventiles'
  | 'honoraires_sans_vote'
  | 'honoraires_autre_assemblee'
  | 'honoraires_majorite_differente'
  | 'honoraires_au_forfait'
  | 'honoraires_arretes_par_le_juge'
  | 'honoraires_votes_sous_administration_provisoire'
  | 'honoraires_cadre_non_etabli'

export interface AnomalieBudgetTravaux {
  code: CodeAnomalieBudgetTravaux
  gravite: GraviteAnomalieBudgetTravaux
  message: string
  /** Texte qui fonde le signalement ; null pour une règle de gestion (aucun texte cité). */
  fondement: string | null
  aConfirmer: boolean
}

const anomalie = (
  code: CodeAnomalieBudgetTravaux,
  gravite: GraviteAnomalieBudgetTravaux,
  message: string,
  fondement: string | null = null,
  aConfirmer = false,
): AnomalieBudgetTravaux => ({ code, gravite, message, fondement, aConfirmer })

export interface SuiviPosteBudgetTravaux {
  poste: PosteBudgetTravaux
  libelle: string
  budgetTtcCentimes: number
  supplementsTtcCentimes: number
  /** Budget TTC + suppléments (🔵). */
  engageCentimes: number
  /** Règlements ventilés sur le poste : enregistrés ou rapprochés. */
  regleCentimes: number
  /** Règlements ventilés sur le poste : demandés ou à régler. */
  enCoursCentimes: number
  /** Engagé − réglé (art. 14-3 : l'engagement est soldé par le règlement) ; négatif si le réglé dépasse l'engagé. */
  resteAReglerCentimes: number
}

export interface SuiviFinancementTravaux {
  nature: NatureFinancementTravaux
  libelle: string
  accordeCentimes: number
  recuCentimes: number
}

export interface SuiviFinancierOperationTravaux {
  numero: string
  coproprieteId: string
  postes: SuiviPosteBudgetTravaux[]
  totalEngageCentimes: number
  /** Budget TTC de la décision ; null sans décision. */
  budgetAdopteCentimes: number | null
  /** Budget adopté − total engagé ; null sans décision. */
  soldeBudgetaireCentimes: number | null
  /** Somme des tranches votées ; null sans décision. */
  appelsVotesCentimes: number | null
  /** Part du fonds de travaux de l'opération (0 avec « Ne pas utiliser les fonds travaux »). */
  fondsTravauxCentimes: number
  nePasUtiliserFondsTravaux: boolean
  /** Financements par nature, dans l'ordre de NATURES_FINANCEMENT_TRAVAUX ; natures sans montant omises. */
  financements: SuiviFinancementTravaux[]
  fondsAppelesCentimes: number
  encaisseCentimes: number
  appelsNonRecusCentimes: number
  regleCentimes: number
  reglementsEnCoursCentimes: number
  /** Réglé de l'opération qu'aucune ventilation ne rattache à un poste. */
  regleNonVentileCentimes: number
  /** Somme des emplois du fonds de travaux rattachés à l'opération (signalés compris : sortis du fonds). */
  emploiFondsTravauxCentimes: number
  soldeTresorerieCentimes: number
  anomalies: AnomalieBudgetTravaux[]
}

export interface SourcesSuiviTravaux {
  /** Échéances suivies (echeancier-appels.ts) ; seules celles du syndicat de l'opération comptent (D1). */
  suivies?: readonly EcheanceAppelSuivie[]
  /** Postes de dette des comptes du syndicat de l'opération (imputation-encaissements.ts). */
  postes?: readonly PosteDette[]
  reglements?: readonly ReglementFournisseur[]
  /** Emplois du fonds de travaux du syndicat de l'opération (fonds-travaux-lots.ts). */
  emploisFonds?: readonly EmploiFondsTravaux[]
  /**
   * Identifiants (banqueId) des comptes bancaires du syndicat qui tiennent le fonds de travaux (comptes-bancaires.ts,
   * nature « fonds_travaux » ; D-BANQUE) : un règlement de l'opération payé depuis l'un d'eux est contrôlé.
   */
  banquesDuFondsTravaux?: readonly string[]
}

function suiviDesPostes(operation: OperationTravaux, budget: BudgetOperationTravaux, reglements: readonly ReglementFournisseur[]): SuiviPosteBudgetTravaux[] {
  return budget.lignes.map(({ poste, budgetTtcCentimes, supplementsTtcCentimes }) => {
    const ventiles = reglements.filter((r) => budget.postesDesReglements[r.id] === poste)
    const { regleCentimes, enCoursCentimes } = reglementsDeLOperation(operation, ventiles)
    const engageCentimes = budgetTtcCentimes + supplementsTtcCentimes
    return {
      poste,
      libelle: LIBELLES_POSTES_BUDGET_TRAVAUX[poste],
      budgetTtcCentimes,
      supplementsTtcCentimes,
      engageCentimes,
      regleCentimes,
      enCoursCentimes,
      resteAReglerCentimes: engageCentimes - regleCentimes,
    }
  })
}

function suiviDesFinancements(budget: BudgetOperationTravaux): SuiviFinancementTravaux[] {
  return NATURES_FINANCEMENT_TRAVAUX.map((nature) => {
    const lignes = budget.financements.filter((f) => f.nature === nature)
    return {
      nature,
      libelle: LIBELLES_FINANCEMENT_TRAVAUX[nature],
      accordeCentimes: somme(lignes.map((f) => f.accordeCentimes)),
      recuCentimes: somme(lignes.map((f) => f.recuCentimes)),
    }
  }).filter((f) => f.accordeCentimes > 0)
}

/** Appelé, encaissé et appels votés de l'opération, depuis ses tranches (statutsDesTranches). */
function suiviDesAppels(operation: OperationTravaux, suivies: readonly EcheanceAppelSuivie[], postes: readonly PosteDette[]) {
  const tranches = statutsDesTranches(operation, suivies, postes)
  const ids: ReadonlySet<string> = new Set(tranches.flatMap((t) => t.echeanceIds))
  const appelees = suivies.filter((e) => e.coproprieteId === operation.coproprieteId && ids.has(e.id) && e.statut === 'Appelé')
  return {
    votesCentimes: somme(tranches.map((t) => t.montantCentimes)),
    appeleCentimes: somme(appelees.map((e) => e.montantCentimes)),
    encaisseCentimes: somme(tranches.map((t) => t.encaisseCentimes)),
  }
}

/** La part de l'opération repose sur l'ordonnance du juge (art. 29-14, 2°), non sur une affectation par l'assemblée. */
function usageJudiciaire(operation: OperationTravaux): boolean {
  const objet = operation.affectationFonds?.objet
  return objet !== undefined && AFFECTATION_FONDS_TRAVAUX[objet].base === 'autorisation_juge'
}

const FONDEMENT_USAGE_JUDICIAIRE = 'L. 1965 art. 29-14, 2°'

/** Fondement du contrôle de la part : l'ordonnance du juge pour l'usage judiciaire, l'affectation par l'assemblée sinon. */
function fondementDeLaPart(operation: OperationTravaux): string {
  return usageJudiciaire(operation) ? FONDEMENT_USAGE_JUDICIAIRE : 'L. 1965 art. 14-2-1, I'
}

/**
 * L'assemblée affecte le fonds « par un vote à la même majorité que celle applicable aux dépenses concernées », en
 * tenant compte « de l'existence de parties communes spéciales ou de clefs de répartition des charges ».
 */
const FONDEMENT_VOTE_AFFECTATION = 'L. 1965 art. 14-2-1, I, al. 7'

/** Ce que borne la part : celle de l'opération, une part nulle, ou celle de chacune de ses clés. */
type PorteeDeLaBorne = 'operation' | 'part_nulle' | 'cle'

const RAISONS_DE_LA_BORNE: Readonly<Record<PorteeDeLaBorne, { assemblee: string; juge: string }>> = {
  operation: {
    assemblee: "aucune décision d'affectation au-delà",
    juge: "usage du fonds autorisé par l'ordonnance du juge, borné par la part fixée pour l'opération (à confirmer)",
  },
  part_nulle: {
    assemblee: "aucune décision n'affecte le fonds à ses dépenses",
    juge: "usage du fonds autorisé par l'ordonnance du juge, borné par la part fixée pour l'opération, nulle (à confirmer)",
  },
  cle: {
    assemblee: "l'affectation tient compte des clés de répartition",
    juge: "usage du fonds autorisé par l'ordonnance du juge, borné par la part fixée pour chaque clé de l'opération (à confirmer)",
  },
}

/**
 * Ce qui borne les emplois du fonds pour l'opération (sa part, nulle ou non), ou pour une de ses clés : la décision
 * d'affectation de l'assemblée (al. 7 ; par clé : elle tient compte des clés de répartition), ou, pour l'usage
 * judiciaire, la part fixée par la décision de l'opération (et pour chaque clé) sur l'usage autorisé par l'ordonnance
 * (art. 29-14, 2° ; aucune affectation votée par l'assemblée ; que la part borne cet usage est un choix VitFix, à
 * confirmer : 🔴 en-tête).
 */
function borneDesEmplois(operation: OperationTravaux, portee: PorteeDeLaBorne = 'operation'): { fondement: string; raison: string; aConfirmer: boolean } {
  const raisons = RAISONS_DE_LA_BORNE[portee]
  if (usageJudiciaire(operation)) return { fondement: FONDEMENT_USAGE_JUDICIAIRE, raison: raisons.juge, aConfirmer: true }
  return { fondement: FONDEMENT_VOTE_AFFECTATION, raison: raisons.assemblee, aConfirmer: false }
}

const CASE_NE_PAS_UTILISER = '« Ne pas utiliser les fonds travaux »'

/**
 * Règlements de l'opération (même syndicat, D1), non annulés, payés depuis un compte qui tient le fonds de travaux,
 * quand l'opération ne puise pas dans le fonds : aucune part du fonds (aucune décision ne l'affecte à l'opération, al. 7 ;
 * usage judiciaire : part nulle, art. 29-14, 2°, à confirmer) ou case « Ne pas utiliser les fonds travaux » (règle de
 * gestion, aucun texte). La case exige une part nulle : cochée, elle est rappelée au message sans retirer le fondement de
 * l'absence de part ; seule (part et case : données incohérentes), aucun texte n'est cité. Avec une part, l'emploi se
 * contrôle à sa saisie (controlerEmploiFondsOperation) et dans le suivi. Case cochée, jamais à confirmer : elle exclut ce
 * règlement dans les deux lectures de la question ouverte sur le bouton (🔴 en-tête).
 */
function anomaliesReglementsSurLeFonds(
  operation: OperationTravaux,
  reglements: readonly ReglementFournisseur[],
  banquesDuFonds: ReadonlySet<string>,
): AnomalieBudgetTravaux[] {
  const { numero } = operation
  const exclu = Boolean(operation.nePasUtiliserFondsTravaux)
  const sansPart = operation.financementFondsTravauxCentimes === 0
  if (banquesDuFonds.size === 0 || (!exclu && !sansPart)) return []
  const borne = borneDesEmplois(operation, 'part_nulle')
  const rappel = exclu ? `, marquée de plus ${CASE_NE_PAS_UTILISER}` : ''
  const raison = sansPart ? `aucune part du fonds de travaux n'est affectée à l'opération ${numero}${rappel}` : `l'opération ${numero} est marquée ${CASE_NE_PAS_UTILISER}`
  const fondement = sansPart ? borne.fondement : null
  return reglements
    .filter((r) => r.coproprieteId === operation.coproprieteId && r.travauxId === operation.numero)
    .filter((r) => r.statut !== 'Annulé' && banquesDuFonds.has(r.banqueId))
    .map((r) =>
      anomalie(
        'reglement_sur_compte_du_fonds',
        'bloquant',
        `Règlement ${r.id} (${eur(r.montantCentimes)}, ${r.statut}) payé depuis un compte du fonds de travaux alors que ${raison} ; le régler depuis un autre compte du syndicat.`,
        fondement,
        !exclu && borne.aConfirmer,
      ),
    )
}

export type CauseEmploiFondsOperation =
  | CauseAffectation
  | 'fonds_non_utilise'
  | 'sans_part'
  | 'cle_sans_part'
  | 'au_dela_de_la_part'
  | 'au_dela_de_la_part_de_la_cle'

export interface ControleEmploiFondsOperation {
  autorise: boolean
  cause: CauseEmploiFondsOperation
  motif: string
  /** null pour la cause « fonds_non_utilise » (« Ne pas utiliser les fonds travaux ») : règle de gestion, aucun texte cité. */
  fondement: string | null
  /** Le refus repose sur un choix VitFix encore ouvert (🔴 en-tête) : « Ne pas utiliser », borne de l'usage judiciaire. */
  aConfirmer: boolean
  /** Clé de la dépense financée : celle fournie, ou la seule clé de l'opération. */
  cleId: string
  /** Part du fonds de l'opération pas encore employée, avant cet emploi (zéro au plus bas). */
  resteCentimes: number
  /** Part du fonds de la clé pas encore employée sur cette clé, avant cet emploi (zéro au plus bas, et pour une clé étrangère). */
  resteCleCentimes: number
}

export interface EmploiFondsOperationAControler {
  montantCentimes: number
  /** Clé de la dépense financée ; exigée quand l'opération porte plusieurs clés, sa seule clé sinon. */
  cleId?: string
  /** Emplois déjà faits du fonds pour l'opération, toutes clés ; 0 par défaut. */
  dejaEmployeCentimes?: number
  /**
   * Emplois déjà faits pour l'opération sur cette clé, compris dans dejaEmployeCentimes ; exigé avec plusieurs clés dès
   * qu'il y a un déjà employé ; une seule clé : dejaEmployeCentimes.
   */
  dejaEmployeSurLaCleCentimes?: number
}

interface ContexteEmploiFonds {
  montantCentimes: number
  cleId: string
  /** Part de la clé dans l'opération ; null pour une clé étrangère à l'opération. */
  partCle: number | null
  resteCentimes: number
  resteCleCentimes: number
}

/**
 * Clé de l'emploi : la clé fournie ; à défaut, la seule clé de l'opération (art. 14-2-1, I, al. 7 : clés de répartition ;
 * usage judiciaire : part de chaque clé, art. 29-14, 2°, à confirmer).
 */
function cleDeLEmploi(operation: OperationTravaux, cleId: string | undefined): string {
  if (cleId !== undefined) {
    if (!cleId.trim()) throw new Error(`Opération ${operation.numero}, emploi du fonds de travaux : clé de la dépense vide.`)
    return cleId
  }
  if (operation.cles.length > 1) {
    const borne = borneDesEmplois(operation, 'cle')
    throw new Error(
      `Opération ${operation.numero}, emploi du fonds de travaux : clé de la dépense exigée, l'opération porte plusieurs clés (${borne.fondement} : ${borne.raison}).`,
    )
  }
  return operation.cleId
}

/** Déjà employé sur la clé : fourni (au plus celui de l'opération) ; la seule clé porte tout ; plusieurs clés : exigé. */
function dejaEmployeSurLaCle(operation: OperationTravaux, cleId: string, dejaEmploye: number, surLaCle: number | undefined): number {
  const { numero } = operation
  if (surLaCle === undefined) {
    if (operation.cles.length === 1) return dejaEmploye
    if (dejaEmploye === 0) return 0
    throw new Error(`Opération ${numero}, emploi du fonds de travaux : emplois déjà faits sur la clé « ${cleId} » exigés, l'opération porte plusieurs clés.`)
  }
  verifierCentimes(surLaCle, `Opération ${numero}, emplois déjà faits du fonds de travaux sur la clé « ${cleId} »`)
  if (surLaCle > dejaEmploye)
    throw new Error(`Opération ${numero} : emplois déjà faits sur la clé « ${cleId} » (${eur(surLaCle)}) supérieurs à ceux de l'opération (${eur(dejaEmploye)}).`)
  return surLaCle
}

function contexteDeLEmploi(operation: OperationTravaux, entree: EmploiFondsOperationAControler): ContexteEmploiFonds {
  const { numero } = operation
  const { montantCentimes, dejaEmployeCentimes = 0 } = entree
  if (!Number.isInteger(montantCentimes) || montantCentimes <= 0)
    throw new Error(`Opération ${numero}, emploi du fonds de travaux : montant invalide (${montantCentimes}), centimes entiers strictement positifs attendus.`)
  verifierCentimes(dejaEmployeCentimes, `Opération ${numero}, emplois déjà faits du fonds de travaux`)
  const cleId = cleDeLEmploi(operation, entree.cleId)
  const surLaCle = dejaEmployeSurLaCle(operation, cleId, dejaEmployeCentimes, entree.dejaEmployeSurLaCleCentimes)
  const partCle = operation.cles.find((c) => c.cleId === cleId)?.financementFondsTravauxCentimes ?? null
  return {
    montantCentimes,
    cleId,
    partCle,
    resteCentimes: Math.max(0, operation.financementFondsTravauxCentimes - dejaEmployeCentimes),
    resteCleCentimes: Math.max(0, (partCle ?? 0) - surLaCle),
  }
}

type RefusEmploiFonds = Pick<ControleEmploiFondsOperation, 'cause' | 'motif' | 'fondement' | 'aConfirmer'>

/** Clé sans part : étrangère à l'opération, ou sans part du fonds dans l'opération (al. 7 ; usage judiciaire : 29-14, 2°). */
function refusCleSansPart(operation: OperationTravaux, { cleId, partCle }: ContexteEmploiFonds): RefusEmploiFonds {
  const situation = partCle === null ? `étrangère à l'opération ${operation.numero}` : `sans part du fonds de travaux dans l'opération ${operation.numero}`
  const borne = borneDesEmplois(operation, 'cle')
  return {
    cause: 'cle_sans_part',
    motif: `Clé « ${cleId} » ${situation} : aucune part du fonds n'est fixée pour ses dépenses ; ${borne.raison}.`,
    fondement: borne.fondement,
    aConfirmer: borne.aConfirmer,
  }
}

/**
 * Refus qui ne dépendent pas de la réponse à la question ouverte sur le bouton « Ne pas utiliser les fonds travaux »
 * (🔴 en-tête), dans l'ordre : opération sans décision (Projet ou Rejeté : aucune dépense décidée à financer), part nulle
 * (aucune décision n'affecte le fonds à ses dépenses, al. 7, refus certain ; usage judiciaire : part nulle, art. 29-14,
 * 2°, à confirmer). La case exige une part nulle : cochée, elle est rappelée au motif sans masquer ces refus ; null si
 * aucun.
 */
function refusCertainDeLOperation(operation: OperationTravaux): RefusEmploiFonds | null {
  const { numero } = operation
  const rappel = operation.nePasUtiliserFondsTravaux ? ` L'opération est aussi marquée ${CASE_NE_PAS_UTILISER}.` : ''
  if (!operation.decision)
    return {
      cause: 'decision_manquante',
      motif: `Opération ${numero} sans décision (statut « ${operation.statut} ») : aucune dépense décidée à financer par le fonds de travaux.${rappel}`,
      fondement: borneDesEmplois(operation).fondement,
      aConfirmer: false,
    }
  if (operation.financementFondsTravauxCentimes === 0) {
    const borne = borneDesEmplois(operation, 'part_nulle')
    return { cause: 'sans_part', motif: `Opération ${numero} sans part du fonds de travaux : ${borne.raison}.${rappel}`, fondement: borne.fondement, aConfirmer: borne.aConfirmer }
  }
  return null
}

/**
 * Refus avant le contrôle J4, dans l'ordre : refus certains (opération sans décision, part nulle), case cochée (règle de
 * gestion, à confirmer ; seule cause quand l'opération porte une part : données incohérentes, la case exigeant une part
 * nulle), clé sans part, cumul de l'opération au-delà de sa part, cumul de la clé au-delà de la part de la clé ; null si
 * aucun.
 */
function refusAvantAffectation(operation: OperationTravaux, contexte: ContexteEmploiFonds): RefusEmploiFonds | null {
  const { numero } = operation
  const { montantCentimes, cleId, resteCentimes, resteCleCentimes, partCle } = contexte
  const certain = refusCertainDeLOperation(operation)
  if (certain) return certain
  if (operation.nePasUtiliserFondsTravaux)
    return { cause: 'fonds_non_utilise', motif: `Opération ${numero} marquée ${CASE_NE_PAS_UTILISER} : aucun emploi du fonds pour elle.`, fondement: null, aConfirmer: true }
  if (!partCle) return refusCleSansPart(operation, contexte)
  if (montantCentimes > resteCentimes) {
    const borne = borneDesEmplois(operation)
    return {
      cause: 'au_dela_de_la_part',
      motif: `Emploi de ${eur(montantCentimes)} au-delà du reste de la part du fonds de travaux de l'opération ${numero} (${eur(resteCentimes)} sur ${eur(operation.financementFondsTravauxCentimes)}) : ${borne.raison}.`,
      fondement: borne.fondement,
      aConfirmer: borne.aConfirmer,
    }
  }
  if (montantCentimes > resteCleCentimes) {
    const borne = borneDesEmplois(operation, 'cle')
    return {
      cause: 'au_dela_de_la_part_de_la_cle',
      motif: `Emploi de ${eur(montantCentimes)} au-delà du reste de la part du fonds de travaux de la clé « ${cleId} » dans l'opération ${numero} (${eur(resteCleCentimes)} sur ${eur(partCle)}) : ${borne.raison}.`,
      fondement: borne.fondement,
      aConfirmer: borne.aConfirmer,
    }
  }
  return null
}

/**
 * Contrôle d'un emploi du fonds de travaux pour l'opération, avant le décaissement (virement qui sort du compte du
 * fonds, règlement payé depuis ce compte) : décision de l'opération et part du fonds (refus certains, la case « Ne pas
 * utiliser les fonds travaux » rappelée au motif) ; case cochée ; part du fonds de la clé de la dépense ; cumul des
 * emplois borné par la part de l'opération (aucune décision d'affectation au-delà, art. 14-2-1, I, al. 7 ; usage
 * judiciaire : art. 29-14, 2°) et par celle de la clé (al. 7 : l'affectation tient compte des clés de répartition ; usage
 * judiciaire : art. 29-14, 2°) ; puis le contrôle d'affectation J4 (controlerAffectationFondsTravaux) sur l'affectation
 * de la part, au montant de l'emploi.
 */
export function controlerEmploiFondsOperation(operation: OperationTravaux, entree: EmploiFondsOperationAControler): ControleEmploiFondsOperation {
  const contexte = contexteDeLEmploi(operation, entree)
  const { cleId, resteCentimes, resteCleCentimes } = contexte
  const restes = { cleId, resteCentimes, resteCleCentimes }
  const refus = refusAvantAffectation(operation, contexte)
  if (refus) return { autorise: false, ...refus, ...restes }
  const affectation = affectationFondsDeLOperation(operation)
  if (!affectation)
    return {
      autorise: false,
      cause: 'decision_manquante',
      motif: `Opération ${operation.numero} : affectation de la part du fonds de travaux non précisée (art. 14-2-1, I, 1° à 4°, ou art. 29-14, 2°).`,
      fondement: FONDEMENT_VOTE_AFFECTATION,
      aConfirmer: false,
      ...restes,
    }
  const { autorise, cause, motif } = controlerAffectationFondsTravaux({ ...affectation, montantCentimes: contexte.montantCentimes })
  return { autorise, cause, motif, fondement: fondementDeLaPart(operation), aConfirmer: false, ...restes }
}

/**
 * Contrôle d'affectation J4 d'un emploi enregistré (J30, PR #643 : `aujourdhui: null`, la date d'une décision ou d'une
 * ordonnance structurée n'est pas comparée au jour, et le suivi ne lève jamais d'erreur pour l'avoir omise) : un refus
 * est bloquant ; une décision ou une ordonnance admise mais en texte libre d'avant J30, un avertissement « forme
 * incomplète », comme avis-appel.ts ; null sinon.
 */
function anomalieDAffectation(emploi: EmploiFondsTravaux): AnomalieBudgetTravaux | null {
  const controle = controlerAffectationFondsTravaux(emploi.decaissement, { aujourdhui: null })
  const objet = `Emploi ${emploi.id} du fonds de travaux`
  if (!controle.autorise) return anomalie('emploi_fonds_non_autorise', 'bloquant', `${objet} : ${controle.motif}`, controle.fondement)
  if (controle.formeIncomplete)
    return anomalie('emploi_fonds_forme_incomplete', 'avertissement', `${objet} : ${controle.formeIncomplete.message}`, controle.fondement)
  return null
}

/**
 * Un emploi rattaché à l'opération : case cochée (à confirmer), opération sans décision, contrôle d'affectation J4
 * (refus, ou texte libre d'avant J30 signalé « forme incomplète »).
 */
function anomaliesDeLEmploi(operation: OperationTravaux, emploi: EmploiFondsTravaux): AnomalieBudgetTravaux[] {
  const { numero } = operation
  const objet = `Emploi ${emploi.id} du fonds de travaux (${eur(emploi.montantCentimes)})`
  const anomalies: AnomalieBudgetTravaux[] = []
  if (operation.nePasUtiliserFondsTravaux)
    anomalies.push(anomalie('emploi_fonds_exclu', 'bloquant', `${objet} alors que l'opération ${numero} est marquée ${CASE_NE_PAS_UTILISER}.`, null, true))
  if (!operation.decision)
    anomalies.push(
      anomalie(
        'emploi_sans_decision',
        'bloquant',
        `${objet} pour l'opération ${numero} sans décision (statut « ${operation.statut} ») : aucune dépense décidée à financer par le fonds.`,
        borneDesEmplois(operation).fondement,
      ),
    )
  const affectation = anomalieDAffectation(emploi)
  if (affectation) anomalies.push(affectation)
  return anomalies
}

/**
 * Emplois regroupés par clé, rapprochés de la part de leur clé : une clé étrangère à l'opération n'a aucune part ; avec
 * une seule clé, le rapprochement de l'opération suffit.
 */
function anomaliesParCle(operation: OperationTravaux, emplois: readonly EmploiFondsTravaux[]): AnomalieBudgetTravaux[] {
  const { numero } = operation
  const parts = new Map(operation.cles.map((c) => [c.cleId, c.financementFondsTravauxCentimes]))
  const cumuls = new Map<string, number>()
  for (const e of emplois) cumuls.set(e.cleId, (cumuls.get(e.cleId) ?? 0) + e.montantCentimes)
  /** Écart de la clé : étrangère à l'opération, ou au-delà de sa part ; null sinon. */
  const ecartDeLaCle = (part: number | undefined, cumul: number): string | null => {
    if (part === undefined) return `, étrangère à l'opération ${numero} : aucune part du fonds n'y est fixée`
    return parts.size > 1 && cumul > part ? ` au-delà de sa part (${eur(part)}) dans l'opération ${numero}` : null
  }
  const borne = borneDesEmplois(operation, 'cle')
  const anomalies: AnomalieBudgetTravaux[] = []
  for (const [cleId, cumul] of cumuls) {
    const ecart = ecartDeLaCle(parts.get(cleId), cumul)
    if (ecart)
      anomalies.push(
        anomalie(
          'emploi_au_dela_de_la_part_de_la_cle',
          'bloquant',
          `Emplois du fonds de travaux (${eur(cumul)}) sur la clé « ${cleId} »${ecart} ; ${borne.raison}.`,
          borne.fondement,
          borne.aConfirmer,
        ),
      )
  }
  return anomalies
}

/** Cumul des emplois rapproché de la part de l'opération, puis de la part de chaque clé. */
function anomaliesDesCumuls(operation: OperationTravaux, emplois: readonly EmploiFondsTravaux[]): AnomalieBudgetTravaux[] {
  const anomalies: AnomalieBudgetTravaux[] = []
  const total = somme(emplois.map((e) => e.montantCentimes))
  const part = operation.financementFondsTravauxCentimes
  if (total > part) {
    const borne = borneDesEmplois(operation)
    anomalies.push(
      anomalie(
        'emploi_au_dela_de_la_part',
        'bloquant',
        `Emplois du fonds de travaux (${eur(total)}) au-delà de la part affectée à l'opération ${operation.numero} (${eur(part)}) : ${borne.raison}.`,
        borne.fondement,
        borne.aConfirmer,
      ),
    )
  }
  return [...anomalies, ...anomaliesParCle(operation, emplois)]
}

/**
 * Part du fonds (contrôle J4 de point 30) et emplois rattachés à l'opération : affectation, « Ne pas utiliser »,
 * décision, parts. Le rapprochement des cumuls se fait même case cochée : la case exige une part nulle, et un emploi
 * au-delà d'une part nulle reste refusé quelle que soit la réponse à la question ouverte sur le bouton (al. 7).
 */
function anomaliesFondsTravaux(operation: OperationTravaux, emplois: readonly EmploiFondsTravaux[]): AnomalieBudgetTravaux[] {
  const anomalies: AnomalieBudgetTravaux[] = []
  const etat = etatPartFondsTravaux(operation)
  if (etat && !etat.autorise)
    anomalies.push(anomalie('part_fonds_non_autorisee', 'bloquant', `Part du fonds de travaux de l'opération ${operation.numero} : ${etat.motif}`, fondementDeLaPart(operation)))
  for (const emploi of emplois) anomalies.push(...anomaliesDeLEmploi(operation, emploi))
  anomalies.push(...anomaliesDesCumuls(operation, emplois))
  return anomalies
}

/** Budget adopté, appels votés et engagé : décision, tranches incomplètes, dépassement. */
function anomaliesDuBudget(operation: OperationTravaux, totalEngage: number, appelsVotes: number): AnomalieBudgetTravaux[] {
  if (!operation.decision)
    return [anomalie('sans_decision', 'information', `Opération ${operation.numero} sans décision : ni budget adopté, ni appels votés.`)]
  const anomalies: AnomalieBudgetTravaux[] = []
  if (totalEngage > operation.budgetTtcCentimes)
    anomalies.push(
      anomalie(
        'engage_superieur_au_budget',
        'avertissement',
        `Total engagé (${eur(totalEngage)}) supérieur au budget adopté (${eur(operation.budgetTtcCentimes)}) de ${eur(totalEngage - operation.budgetTtcCentimes)}.`,
        null,
        true,
      ),
    )
  if (appelsVotes < operation.montantAAppelerCentimes)
    anomalies.push(
      anomalie(
        'tranches_inferieures_au_montant_a_appeler',
        'information',
        `Tranches votées : ${eur(appelsVotes)} pour un montant à appeler de ${eur(operation.montantAAppelerCentimes)} ; ${eur(operation.montantAAppelerCentimes - appelsVotes)} sans tranche.`,
      ),
    )
  return anomalies
}

/** Postes réglés au-delà de leur engagement ; règlements non ventilés. */
function anomaliesDesReglements(postes: readonly SuiviPosteBudgetTravaux[], nonVentile: number): AnomalieBudgetTravaux[] {
  const anomalies = postes
    .filter((p) => p.resteAReglerCentimes < 0)
    .map((p) =>
      anomalie(
        'regle_superieur_a_l_engage',
        'avertissement',
        `${p.libelle} : réglé (${eur(p.regleCentimes)}) supérieur à l'engagé (${eur(p.engageCentimes)}) ; engagement (budget ou supplément) à saisir.`,
        'L. 1965 art. 14-3, al. 2',
      ),
    )
  if (nonVentile > 0)
    anomalies.push(anomalie('reglements_non_ventiles', 'information', `Règlements de ${eur(nonVentile)} rattachés à l'opération sans poste du budget.`))
  return anomalies
}

/** Encaissé au-delà de l'appelé ; trésorerie négative. */
function anomaliesDeTresorerie(appele: number, encaisse: number, tresorerie: number): AnomalieBudgetTravaux[] {
  const anomalies: AnomalieBudgetTravaux[] = []
  if (encaisse > appele)
    anomalies.push(
      anomalie('encaisse_superieur_a_l_appele', 'avertissement', `Encaissé (${eur(encaisse)}) supérieur aux fonds appelés (${eur(appele)}) : échéance annulée après encaissement, ou imputation à revoir.`),
    )
  if (tresorerie < 0)
    anomalies.push(
      anomalie('tresorerie_negative', 'avertissement', `Solde de trésorerie de l'opération négatif (${eur(tresorerie)}) : règlements supérieurs aux sommes reçues pour elle.`),
    )
  return anomalies
}

/** Le budget est celui de l'opération : même n° et même syndicat (le n° n'est unique qu'au sein du syndicat, D1). */
function verifierBudgetDeLOperation(operation: OperationTravaux, budget: BudgetOperationTravaux): void {
  if (budget.numero !== operation.numero || budget.coproprieteId !== operation.coproprieteId)
    throw new Error(`Budget de l'opération ${budget.numero} (${budget.coproprieteId}) appliqué à l'opération ${operation.numero} (${operation.coproprieteId}).`)
}

/**
 * Suivi financier de l'opération (onglet Budget de Gestéam) : postes engagés et réglés, budget adopté et solde
 * budgétaire, appels votés, part du fonds de travaux et autres financements, fonds appelés, encaissé, appels non reçus,
 * réglé, emploi du fonds, solde de trésorerie ; avec les anomalies (contrôle d'affectation du fonds, « Ne pas utiliser
 * les fonds travaux », dépassements).
 */
export function suiviFinancierOperationTravaux(
  operation: OperationTravaux,
  budget: BudgetOperationTravaux,
  { suivies = [], postes = [], reglements = [], emploisFonds = [], banquesDuFondsTravaux = [] }: SourcesSuiviTravaux = {},
): SuiviFinancierOperationTravaux {
  verifierBudgetDeLOperation(operation, budget)
  const suiviPostes = suiviDesPostes(operation, budget, reglements)
  const financements = suiviDesFinancements(budget)
  const appels = suiviDesAppels(operation, suivies, postes)
  const reglesOperation = reglementsDeLOperation(operation, reglements)
  const emplois = emploisFonds.filter((e) => e.operationNumero === operation.numero)
  const totalEngageCentimes = somme(suiviPostes.map((p) => p.engageCentimes))
  const emploiFondsTravauxCentimes = somme(emplois.map((e) => e.montantCentimes))
  const recuFinancements = somme(financements.map((f) => f.recuCentimes))
  const soldeTresorerieCentimes = appels.encaisseCentimes + emploiFondsTravauxCentimes + recuFinancements - reglesOperation.regleCentimes
  const regleNonVentileCentimes = reglesOperation.regleCentimes - somme(suiviPostes.map((p) => p.regleCentimes))
  const decidee = operation.decision !== null
  return {
    numero: operation.numero,
    coproprieteId: operation.coproprieteId,
    postes: suiviPostes,
    totalEngageCentimes,
    budgetAdopteCentimes: decidee ? operation.budgetTtcCentimes : null,
    soldeBudgetaireCentimes: decidee ? operation.budgetTtcCentimes - totalEngageCentimes : null,
    appelsVotesCentimes: decidee ? appels.votesCentimes : null,
    fondsTravauxCentimes: operation.financementFondsTravauxCentimes,
    nePasUtiliserFondsTravaux: Boolean(operation.nePasUtiliserFondsTravaux),
    financements,
    fondsAppelesCentimes: appels.appeleCentimes,
    encaisseCentimes: appels.encaisseCentimes,
    appelsNonRecusCentimes: appels.appeleCentimes - appels.encaisseCentimes,
    regleCentimes: reglesOperation.regleCentimes,
    reglementsEnCoursCentimes: reglesOperation.enCoursCentimes,
    regleNonVentileCentimes,
    emploiFondsTravauxCentimes,
    soldeTresorerieCentimes,
    anomalies: [
      ...anomaliesDuBudget(operation, totalEngageCentimes, appels.votesCentimes),
      ...anomaliesFondsTravaux(operation, emplois),
      ...anomaliesReglementsSurLeFonds(operation, reglements, new Set(banquesDuFondsTravaux)),
      ...anomaliesDesReglements(suiviPostes, regleNonVentileCentimes),
      ...anomaliesDeTresorerie(appels.appeleCentimes, appels.encaisseCentimes, soldeTresorerieCentimes),
    ],
  }
}

// ─── Honoraires sur travaux ────────────────────────────────────────────────────────────────────

export const CADRES_HONORAIRES_TRAVAUX = [
  'vote_avec_les_travaux',
  'droit_proportionnel_administrateur_provisoire',
  'fixe_par_le_juge',
  'non_etabli',
] as const
export type CodeCadreHonorairesTravaux = (typeof CADRES_HONORAIRES_TRAVAUX)[number]

export interface CadreHonorairesTravaux {
  cadre: CodeCadreHonorairesTravaux
  fondements: readonly string[]
  motif: string
  /** La rémunération est arrêtée par le président du tribunal judiciaire (D. 1967 art. 61-1-5, II et III). */
  arreteParLeJuge: boolean
  aConfirmer: boolean
}

/** Arrêté du 8 octobre 2015, art. 3 : à partir de ce nombre de lots, le juge fixe l'entière rémunération. */
export const SEUIL_LOTS_HONORAIRES_FIXES_PAR_LE_JUGE = 500

const FONDEMENTS_AP = ['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5'] as const

const CADRE_SYNDIC: CadreHonorairesTravaux = {
  cadre: 'vote_avec_les_travaux',
  fondements: ['L. 1965 art. 18-1 A, III'],
  motif:
    "Honoraires spécifiques du syndic sur travaux : votés lors de la même assemblée que les travaux, aux mêmes règles de majorité, en pourcentage du montant hors taxes des travaux, à un taux dégressif.",
  arreteParLeJuge: false,
  aConfirmer: false,
}

const CADRE_SYNDIC_JUDICIAIRE: CadreHonorairesTravaux = {
  cadre: 'vote_avec_les_travaux',
  fondements: ['D. 1967 art. 46, al. 3', 'L. 1965 art. 18-1 A, III'],
  motif:
    "Syndic désigné par le président du tribunal judiciaire : il administre selon les art. 18 à 18-2 de la loi (D. 1967 art. 46, al. 3) ; honoraires de travaux votés avec les travaux (art. 18-1 A, III), à confirmer : aucun texte relu ne fixe sa rémunération.",
  arreteParLeJuge: false,
  aConfirmer: true,
}

const CADRE_AP47: CadreHonorairesTravaux = {
  cadre: 'non_etabli',
  fondements: ['D. 1967 art. 47'],
  motif:
    "Administrateur provisoire désigné faute de syndic (D. 1967 art. 47) : aucun texte trouvé sur sa rémunération ; le tarif de l'art. 61-1-5 vise l'administrateur provisoire de l'art. 29-1.",
  arreteParLeJuge: false,
  aConfirmer: true,
}

const CADRE_AP_TARIF: CadreHonorairesTravaux = {
  cadre: 'droit_proportionnel_administrateur_provisoire',
  fondements: [...FONDEMENTS_AP, 'Arrêté du 8 octobre 2015, art. 11'],
  motif:
    "Administrateur provisoire (L. 1965 art. 29-1) : droit proportionnel sur le montant hors taxes des travaux votés ou décidés par lui (arrêté du 8 octobre 2015, art. 11) ; acomptes fixés chaque année et rémunération arrêtée par le président du tribunal judiciaire (D. 1967 art. 61-1-5, II et III).",
  arreteParLeJuge: true,
  aConfirmer: false,
}

const CADRE_AP_500_LOTS: CadreHonorairesTravaux = {
  cadre: 'fixe_par_le_juge',
  fondements: [...FONDEMENTS_AP, 'Arrêté du 8 octobre 2015, art. 3'],
  motif: `Administrateur provisoire d'une copropriété de ${SEUIL_LOTS_HONORAIRES_FIXES_PAR_LE_JUGE} lots et plus : l'entière rémunération est fixée par le juge en fonction des frais engagés et des diligences accomplies (arrêté du 8 octobre 2015, art. 3).`,
  arreteParLeJuge: true,
  aConfirmer: false,
}

const CADRE_AP_RENFORCEE: CadreHonorairesTravaux = {
  cadre: 'fixe_par_le_juge',
  fondements: [...FONDEMENTS_AP, 'Arrêté du 8 octobre 2015, art. 11 et 14'],
  motif:
    "Administration provisoire renforcée : le droit proportionnel sur travaux ne s'applique pas (arrêté du 8 octobre 2015, art. 11) ; les actes du placement sous administration renforcée sont rémunérés hors droits fixes et proportionnels (art. 14), rémunération arrêtée par le président du tribunal judiciaire (D. 1967 art. 61-1-5, III) ; à confirmer pour les honoraires sur travaux.",
  arreteParLeJuge: true,
  aConfirmer: true,
}

const CADRE_REGIME_INCONNU: CadreHonorairesTravaux = {
  cadre: 'non_etabli',
  fondements: [],
  motif:
    "Régime du mandat inconnu (mandat ad hoc, fondement vide ou non reconnu : regimeDepuisFondement rend null) : cadre des honoraires sur travaux non établi ; pour un syndic désigné par l'assemblée, passer le régime « syndic ».",
  arreteParLeJuge: false,
  aConfirmer: true,
}

/** Régime du mandat pour les honoraires sur travaux : un régime judiciaire, ou le syndic désigné par l'assemblée. */
export type RegimeHonorairesTravaux = Regime | 'syndic'

const CADRES_HORS_ARTICLE_29_1: Readonly<Record<'syndic' | 'sj' | 'ap47', CadreHonorairesTravaux>> = {
  syndic: CADRE_SYNDIC,
  sj: CADRE_SYNDIC_JUDICIAIRE,
  ap47: CADRE_AP47,
}

/**
 * Cadre des honoraires sur travaux selon le régime du mandat : 'syndic' = syndic désigné par l'assemblée (hors mandat de
 * justice), passé explicitement par l'appelant ; 'sj' = syndic désigné en justice (D. 1967 art. 46) ; 'ap47' ; 'ap291' =
 * administrateur provisoire de l'art. 29-1, selon le nombre de lots de la copropriété (exigé) et l'administration
 * provisoire renforcée ; null = régime inconnu (regimeDepuisFondement : mandat ad hoc, fondement vide ou non reconnu) :
 * cadre non établi, à confirmer — jamais le cadre du syndic par défaut.
 */
export function cadreHonorairesTravaux({
  regime,
  nbLots,
  administrationRenforcee = false,
}: {
  regime: RegimeHonorairesTravaux | null
  nbLots?: number | null
  administrationRenforcee?: boolean
}): CadreHonorairesTravaux {
  if (regime !== 'ap291') {
    if (administrationRenforcee) throw new Error("Administration provisoire renforcée hors d'une administration provisoire de l'art. 29-1.")
    return regime === null ? CADRE_REGIME_INCONNU : CADRES_HORS_ARTICLE_29_1[regime]
  }
  if (administrationRenforcee) return CADRE_AP_RENFORCEE
  const lots = nbLots ?? 0
  if (!Number.isInteger(lots) || lots <= 0)
    throw new Error(`Nombre de lots invalide (${nbLots}) : entier strictement positif attendu pour l'administrateur provisoire (arrêté du 8 octobre 2015, art. 3).`)
  return lots >= SEUIL_LOTS_HONORAIRES_FIXES_PAR_LE_JUGE ? CADRE_AP_500_LOTS : CADRE_AP_TARIF
}

/** Arrêté du 8 octobre 2015, art. 11 : tranches en centimes hors taxes, taux en pour mille (2 %, 1,5 %, 1 %). */
export const BAREME_DROIT_PROPORTIONNEL_TRAVAUX: readonly { jusquACentimes: number | null; tauxPourMille: number }[] = [
  { jusquACentimes: 1_250_000, tauxPourMille: 20 },
  { jusquACentimes: 2_500_000, tauxPourMille: 15 },
  { jusquACentimes: null, tauxPourMille: 10 },
]

/** Arrêté du 8 octobre 2015, art. 15 : au-delà, D. 1967 art. 61-1-5, III, al. 2 et 3 (rémunération arrêtée par le juge). */
export const SEUIL_DROITS_PROPORTIONNELS_HT_CENTIMES = 7_500_000

export interface DroitProportionnelTravaux {
  /** Droit hors taxes, arrondi au centime. */
  droitHtCentimes: number
  /** Assiette de chaque tranche du barème. */
  tranches: { tauxPct: number; baseCentimes: number }[]
  /**
   * Le droit de la seule opération excède 75 000 euros HT : D. 1967 art. 61-1-5, III, al. 2 et 3. Le seuil de l'art. 15
   * porte sur l'ensemble des droits des art. 11, 12 et 13 de la mission, que ce calcul ne connaît pas.
   */
  depasseSeuilArticle15: boolean
  fondements: readonly string[]
  /** Toujours vrai : assiette et application opération par opération à confirmer (🔴 en-tête). */
  aConfirmer: true
}

/**
 * Estimation du droit proportionnel de l'administrateur provisoire sur des travaux (arrêté du 8 octobre 2015, art. 11),
 * par tranches, sur le montant hors taxes fourni. Prévision du poste « Honoraires cabinet » : la rémunération est
 * arrêtée par le juge (D. 1967 art. 61-1-5, II et III), jamais facturée sur ce calcul.
 */
export function droitProportionnelTravauxAdministrateurProvisoire(montantTravauxHtCentimes: number): DroitProportionnelTravaux {
  verifierCentimes(montantTravauxHtCentimes, 'Montant hors taxes des travaux')
  let plancher = 0
  let produitPourMille = 0
  const tranches: DroitProportionnelTravaux['tranches'] = []
  for (const { jusquACentimes, tauxPourMille } of BAREME_DROIT_PROPORTIONNEL_TRAVAUX) {
    const plafond = jusquACentimes ?? montantTravauxHtCentimes
    const baseCentimes = Math.max(0, Math.min(montantTravauxHtCentimes, plafond) - plancher)
    tranches.push({ tauxPct: tauxPourMille / 10, baseCentimes })
    produitPourMille += baseCentimes * tauxPourMille
    plancher = Math.max(plancher, plafond)
  }
  const droitHtCentimes = Math.round(produitPourMille / 1000)
  return {
    droitHtCentimes,
    tranches,
    depasseSeuilArticle15: droitHtCentimes > SEUIL_DROITS_PROPORTIONNELS_HT_CENTIMES,
    fondements: ['Arrêté du 8 octobre 2015, art. 11 et 15', 'D. 1967 art. 61-1-5, I, 2°'],
    aConfirmer: true,
  }
}

/** Résolution qui vote les honoraires sur travaux (cadre de l'art. 18-1 A, III). */
export interface ResolutionHonorairesTravaux {
  /** Date de l'assemblée qui vote les honoraires. */
  date: string
  resolution: string
  majorite?: TypeMajorite | null
  /** Gestéam « forfait TTC ou taux % sur montant HT ». */
  mode: 'pourcentage_ht' | 'forfait_ttc'
}

const FONDEMENT_18_1_A = 'L. 1965 art. 18-1 A, III'

/** Cadre de l'art. 18-1 A, III : même assemblée que les travaux, même majorité, pourcentage du hors taxes. */
function controlerVoteHonoraires(
  operation: OperationTravaux,
  resolution: ResolutionHonorairesTravaux | null,
  aConfirmer: boolean,
): AnomalieBudgetTravaux[] {
  const { decision, numero } = operation
  if (!decision || !resolution)
    return [
      anomalie(
        'honoraires_sans_vote',
        'avertissement',
        `Honoraires cabinet de l'opération ${numero} sans ${decision ? 'résolution qui les vote' : 'travaux votés'} : les honoraires sur travaux se votent lors de la même assemblée que les travaux.`,
        FONDEMENT_18_1_A,
        aConfirmer,
      ),
    ]
  const anomalies: AnomalieBudgetTravaux[] = []
  if (resolution.date !== decision.date)
    anomalies.push(
      anomalie('honoraires_autre_assemblee', 'avertissement', `${resolution.resolution} : honoraires votés à une autre assemblée que les travaux de l'opération ${numero}.`, FONDEMENT_18_1_A, aConfirmer),
    )
  if (resolution.majorite && decision.majorite && resolution.majorite !== decision.majorite)
    anomalies.push(
      anomalie(
        'honoraires_majorite_differente',
        'avertissement',
        `${resolution.resolution} : honoraires à la majorité « ${resolution.majorite} », travaux à « ${decision.majorite} » ; mêmes règles de majorité que les travaux.`,
        FONDEMENT_18_1_A,
        aConfirmer,
      ),
    )
  if (resolution.mode === 'forfait_ttc')
    anomalies.push(
      anomalie('honoraires_au_forfait', 'avertissement', `${resolution.resolution} : honoraires au forfait ; la rémunération s'exprime en pourcentage du montant hors taxes des travaux.`, FONDEMENT_18_1_A, aConfirmer),
    )
  return anomalies
}

/** Administrateur provisoire : le poste est une prévision ; un vote d'honoraires est signalé. */
function anomaliesSousLeJuge(cadre: CadreHonorairesTravaux, honoraires: number, resolution: ResolutionHonorairesTravaux | null): AnomalieBudgetTravaux[] {
  const fondement = cadre.fondements.join(' ; ')
  const anomalies: AnomalieBudgetTravaux[] = []
  if (honoraires > 0)
    anomalies.push(
      anomalie(
        'honoraires_arretes_par_le_juge',
        'information',
        `Honoraires cabinet de ${eur(honoraires)} : prévision du budget, à soumettre au juge ; aucun élément à facturer au syndicat. ${cadre.motif}`,
        fondement,
        cadre.aConfirmer,
      ),
    )
  if (resolution)
    anomalies.push(
      anomalie(
        'honoraires_votes_sous_administration_provisoire',
        'avertissement',
        `${resolution.resolution} : honoraires votés par l'assemblée, alors que la rémunération de l'administrateur provisoire suit le décret et la décision du juge (L. 1965 art. 29-1, II), pas un vote de l'art. 18-1 A, III.`,
        fondement,
        cadre.aConfirmer,
      ),
    )
  return anomalies
}

/**
 * Contrôle du poste « Honoraires cabinet » selon le cadre (cadreHonorairesTravaux) : vote de l'art. 18-1 A, III ;
 * prévision soumise au juge sous administration provisoire ; cadre non établi. Aucun contrôle sans honoraires ni vote.
 */
export function controlerHonorairesTravaux(
  operation: OperationTravaux,
  budget: BudgetOperationTravaux,
  { cadre, resolutionHonoraires = null }: { cadre: CadreHonorairesTravaux; resolutionHonoraires?: ResolutionHonorairesTravaux | null },
): AnomalieBudgetTravaux[] {
  verifierBudgetDeLOperation(operation, budget)
  if (resolutionHonoraires && !estDateIsoValide(resolutionHonoraires.date))
    throw new Error(`${resolutionHonoraires.resolution} : date de l'assemblée qui vote les honoraires invalide (${resolutionHonoraires.date}), AAAA-MM-JJ attendu.`)
  const ligne = budget.lignes.find((l) => l.poste === 'honorairesCabinet')
  const honoraires = ligne ? ligne.budgetTtcCentimes + ligne.supplementsTtcCentimes : 0
  if (honoraires === 0 && !resolutionHonoraires) return []
  if (cadre.cadre === 'vote_avec_les_travaux') return controlerVoteHonoraires(operation, resolutionHonoraires, cadre.aConfirmer)
  if (cadre.arreteParLeJuge) return anomaliesSousLeJuge(cadre, honoraires, resolutionHonoraires)
  return [
    anomalie(
      'honoraires_cadre_non_etabli',
      'avertissement',
      `Honoraires cabinet de ${eur(honoraires)} : ${cadre.motif}`,
      cadre.fondements.length > 0 ? cadre.fondements.join(' ; ') : null,
      true,
    ),
  ]
}
