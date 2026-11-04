import { DELAI_CONVOCATION_JOURS } from '@/lib/administrateur-judiciaire/domain/carence-assemblee'
import {
  ajouterJours,
  ajouterMois,
  dateIsoVersFr,
  decomposerDateIso,
  estDateIsoValide,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { MAJORITES_AG, type TypeMajorite } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import { LIBELLES_ETATS_RESOLUTION, type Resolution } from '@/lib/administrateur-judiciaire/domain/resolutions-ag'

/**
 * Décisions annuelles de l'assemblée générale et échéances de l'exercice (point 24 du bilan 2). Fonctions pures, montants
 * en CENTIMES ENTIERS, dates ISO (AAAA-MM-JJ), sans écran ni table : le stockage des décisions et des dates de clôture
 * attend l'accord de Frédéric. Aucune donnée personnelle : les désignés sont des identifiants de positions ou
 * d'identités (D2).
 *
 * Gestéam — fiche assemblée, bloc Exercice (tranche 31 § Fiche) : Exercice approuvé, Nouvel exercice ; Dépenses € ;
 * Budgets € (+/-), N+2, Honoraires TTC ; Délégations syndic, CS, Marché € ; Mandat de syndic : durée (ans, mois), terme ;
 * Mandat du CS : durée, terme. Fiche exercice (tranche 43 § 9) : Budget TTC, Complément, « Vote pour AG (N+2) »,
 * Honoraires, Travaux votés, chacun avec sa Résolution ; onglet « Honoraires, suivi », bloc Clôture : « CS avant AG »,
 * « Rendu des comptes N », Assemblée, Résolution ; bloc Délégation : « Autorisation d'accès, services de police »,
 * Syndic €, Conseil syndical €, Mise en concurrence €, Résolution.
 *
 * Le droit — 🟢 textes relus sur Légifrance le 29/10/2026 :
 * - L. 1965 art. 14-1, I, al. 1 : le syndicat vote chaque année un budget prévisionnel ; l'assemblée appelée à le voter
 *   est réunie dans un délai de six mois à compter du dernier jour de l'exercice comptable précédent ; D. 1967 art. 7 :
 *   une assemblée au moins par an (al. 1), convoquée par le syndic (al. 2) ; al. 3 : ces alinéas ne s'appliquent pas
 *   quand l'administrateur provisoire est investi de tous les pouvoirs de l'assemblée, et l'al. 2 seulement dans la
 *   limite des pouvoirs conservés par l'assemblée quand il n'en a qu'une partie ;
 * - D. 1967 art. 43 : le budget couvre douze mois et se vote avant le début de l'exercice qu'il concerne ; à défaut, deux
 *   provisions trimestrielles au quart du budget précédent, sur autorisation préalable de l'assemblée ;
 * - L. 1965 art. 18, II : le syndic établit le budget en concertation avec le conseil syndical, les comptes et leurs
 *   annexes, et les soumet au vote de l'assemblée ; D. 1967 art. 26 : le conseil syndical contrôle la comptabilité et
 *   l'élaboration du budget, l'ordre du jour est établi en concertation avec lui ;
 * - L. 1965 art. 18-1 et D. 1967 art. 9-1 : entre la convocation de l'assemblée appelée à connaître des comptes et sa
 *   tenue, les pièces justificatives des charges sont tenues à la disposition de chaque copropriétaire, au moins un jour
 *   ouvré, aux lieu, jours et heures indiqués dans la convocation ; D. 1967 art. 11, I, 1° : l'état financier et le compte
 *   de gestion général sont notifiés au plus tard avec l'ordre du jour, pour la validité de l'approbation des comptes ;
 * - L. 1965 art. 21, al. 2 : à la majorité de l'art. 25, l'assemblée arrête le montant des marchés et contrats à partir
 *   duquel la consultation du conseil syndical est obligatoire, et celui (contrat de syndic exclu) à partir duquel une mise
 *   en concurrence l'est ; D. 1967 art. 11, II, 3° : l'avis du conseil syndical, quand sa consultation est obligatoire,
 *   est notifié au plus tard avec l'ordre du jour, pour information ; D. 1967 art. 19-2 : à défaut de conditions fixées,
 *   plusieurs devis ou un devis descriptif ;
 * - L. 1965 art. 25, a et art. 18, IV ; D. 1967 art. 21 : délégation de pouvoir à une fin déterminée, pour un acte ou une
 *   décision de l'art. 24, à la majorité de l'art. 25, acte délégué mentionné expressément ; quand l'assemblée autorise le
 *   délégataire à décider de dépenses, elle fixe le montant maximum des sommes allouées ; à l'issue de la délégation, le
 *   délégataire rend compte à l'assemblée de son exécution ;
 * - L. 1965 art. 21-1 à 21-3 : délégation générale au conseil syndical d'au moins trois membres, à la majorité des voix de
 *   tous les copropriétaires, ni sur l'approbation des comptes ni sur le budget, montant maximum des sommes allouées fixé
 *   par l'assemblée (art. 21-2), deux ans au plus, renouvelable par décision expresse ; D. 1967 art. 26-1 : ce montant
 *   spécifique est alloué au sein du budget prévisionnel voté chaque année (al. 1) ; pour des dépenses de travaux non
 *   comprises dans le budget, l'assemblée précise le montant maximum alloué pour chacune d'elles (al. 2) ;
 * - L. 1965 art. 24, II, h et CSI art. L. 272-1 : seule l'autorisation permanente de la police municipale se vote (art.
 *   24) ; la police et la gendarmerie nationales et les services d'incendie et de secours accèdent sans vote ;
 * - L. 1965 art. 25, c ; art. 18, VI ; D. 1967 art. 28 et 29 : désignation ou révocation du syndic, approbation de son
 *   contrat à la majorité de l'art. 25, trois ans au plus ; le contrat fixe sa durée, ses dates calendaires de prise
 *   d'effet et d'échéance et les éléments de détermination de la rémunération du syndic ; nouveau contrat par décision
 *   expresse ; L. 1965 art. 18, VIII : résiliation pour inexécution suffisamment grave ; D. 1967 art. 22, al. 3 : mandat
 *   des membres du conseil syndical, trois années au plus, renouvelables ;
 * - L. 1965 art. 18-1 A, III : les honoraires spécifiques du syndic sur travaux sont votés lors de la même assemblée que
 *   les travaux, aux mêmes règles de majorité ;
 * - L. 1965 art. 25-1 : la passerelle vaut quand l'assemblée n'a pas décidé à la majorité des voix de tous les
 *   copropriétaires, « en application de l'article 25 ou d'une autre disposition » (art. 21-1 compris) ;
 * - L. 1965 art. 29-1, I, al. 2 : l'administrateur provisoire reçoit tous les pouvoirs du syndic, dont le mandat cesse de
 *   plein droit sans indemnité, et tout ou partie des pouvoirs de l'assemblée (sauf art. 26 a et b) ; l'assemblée
 *   continue d'exercer ceux qui ne sont pas compris dans sa mission ; L. 1965 art. 29-1, II et D. 1967 art. 61-1-5 :
 *   rémunération de cet administrateur provisoire, arrêtée par le président du tribunal judiciaire ; D. 1967 art. 46 : syndic
 *   désigné par le président du tribunal judiciaire, qui administre la copropriété selon les art. 18 à 18-2 de la loi
 *   (al. 3) ; art. 47 : administrateur provisoire d'un syndicat dépourvu de syndic ; D. 1967 art. 62-7 : l'administrateur
 *   provisoire peut convoquer les copropriétaires pour les informer et les entendre ; art. 62-7 à 62-9 : avis du conseil
 *   syndical (sauf urgence), registre, copie aux copropriétaires — non contrôlés ici, faute de donnée.
 *
 * 🔵 Déduit :
 * - approbation des comptes, budget, complément, montant alloué au conseil syndical dans le budget : majorité de l'art.
 *   24, faute de texte qui en fixe une autre (art. 24, I) ; la majorité des voix de tous les copropriétaires (art. 21-1)
 *   porte le code 'art25' ;
 * - une résolution soumise à une majorité plus forte que celle requise fonde la décision ; adoptée au second vote de
 *   l'art. 25-1 ou 26-1, elle garde sa majorité requise (resolutions-ag.ts) et reste régulière ;
 * - la décision de l'administrateur provisoire de l'art. 29-1 investi des pouvoirs de l'assemblée tient lieu de vote ;
 *   aucun autre régime (art. 46, 47) ne reçoit ces pouvoirs ; investi de tous, il décide seul : une résolution de
 *   l'assemblée sur une décision annuelle (aucune ne relève de l'art. 26 a ou b) est signalée ; investi d'une partie, ou
 *   d'une étendue inconnue, elle est à vérifier ;
 * - seuils, délégations, accès de la police municipale et mandats valent jusqu'à une nouvelle décision ou jusqu'à leur
 *   terme, d'un exercice à l'autre ; la fin d'une délégation de l'art. 25 a (exécution, compte rendu) se saisit comme
 *   terme ; « à partir duquel » s'entend d'un montant égal ou supérieur au seuil ; un montant maximum par dépense de
 *   travaux hors budget vaut avec la délégation générale en vigueur, décidée (date de la décision, non de sa prise
 *   d'effet) au plus tard avec lui ;
 * - la délégation générale au conseil syndical ne porte pas de montant : celui de l'art. 21-2 est alloué chaque année au
 *   sein du budget (montant alloué de l'exercice) ou, pour une dépense de travaux hors budget, par montant maximum
 *   (D. 1967 art. 26-1, « pour l'application des dispositions de l'article 21-2 ») ;
 * - terme d'un mandat : veille du même quantième au bout de la durée ; si ce quantième manque dans le mois d'arrivée,
 *   dernier jour de ce mois (29/02 + 36 mois → 28/02) ; prise d'effet par défaut : la date de la décision ; une durée et
 *   un terme saisis qui ne concordent pas sont signalés à vérifier (D. 1967 art. 29 : le contrat fixe les deux) ; mandats
 *   du conseil syndical, délégations de l'art. 25 a et montants maximum par dépense de travaux se cumulent ;
 * - le mandat du syndic cesse à la date de fin fournie (désignation de l'administrateur provisoire de l'art. 29-1,
 *   révocation, résiliation, autre fin constatée) : il sort des décisions en vigueur et son échéance est close ;
 * - le conseil syndical est renouvelé par une désignation postérieure qui le porte au-delà du terme et prend effet moins
 *   de six mois avant lui, ou après, même sans reconduire chaque membre : l'assemblée annuelle se tient dans les six mois
 *   de la clôture (L. 1965 art. 14-1, I), si bien que, pour un conseil élu par l'assemblée annuelle, celle qui le
 *   renouvelle se tient moins de six mois avant son terme, ou après ; il l'est aussi quand chacun de ses membres est
 *   désigné de nouveau au-delà du terme, et sa désignation précédente sort alors des décisions en vigueur (elle n'ajoute
 *   rien, quelle que soit la réponse à la question 🔴 sur le mandat précédent) ; une élection complémentaire, alignée
 *   sur le terme en cours ou de pleine durée plus tôt dans le mandat, ne le renouvelle pas ;
 * - échéance de l'assemblée budgétaire au même quantième six mois après la clôture (borné en fin de mois), accomplie par
 *   un budget décidé après la clôture et au plus tard douze mois après (avant la clôture de l'exercice suivant) ; sous
 *   administrateur provisoire de l'art. 29-1 investi de tous les pouvoirs de l'assemblée, la même date sert de repère à
 *   sa décision budgétaire (à confirmer) ; un exercice « Non géré » (hors mission) n'a pas d'échéance ;
 * - les comptes de l'exercice sont remis au conseil syndical avant la convocation (concertation sur le budget et l'ordre
 *   du jour) ; présentation de la convocation (délai + 1) jours avant la réunion (décompte de votes-ag.ts) ;
 * - Gestéam « Exercice approuvé / Nouvel exercice / N+2 » : dernier exercice clos, exercice en cours, premier exercice
 *   ouvert après l'assemblée ; « Conseil syndical € » de la fiche exercice : montant alloué dans le budget de l'exercice.
 *
 * L'alerte de l'art. 29-1 A (impayés à la clôture ; absence de vote de l'assemblée sur l'approbation des comptes depuis
 * au moins deux ans, un vote de rejet comptant comme un vote) est modélisée à part (alerte-mandataire-ad-hoc.ts) : une
 * approbation des comptes adoptée par l'assemblée et enregistrée ici y compte comme un vote.
 *
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - sens de « Rendu des comptes N » : notification des comptes avec la convocation, ou date de l'assemblée qui les
 *   approuve ? VitFix ne s'en sert que pour tenir la convocation de l'assemblée des comptes pour faite ;
 * - « Délégations Syndic € / CS € » : plafond d'une délégation de l'art. 25 a, montant alloué au conseil syndical dans le
 *   budget (D. 1967 art. 26-1) ou seuil de consultation (art. 21) ? VitFix garde des types distincts ;
 * - remise des comptes au conseil syndical : aucun délai légal ; l'avance est un réglage du cabinet (0 par défaut) ;
 * - honoraires : majorité selon l'objet — rémunération du syndic fixée par son contrat (D. 1967 art. 29 : art. 25) ou
 *   honoraires de travaux (L. 1965 art. 18-1 A, III : majorité des travaux) ; une résolution à l'art. 24 est signalée ;
 * - honoraires votés sous mandat de justice : signalés à vérifier. Administrateur provisoire de l'art. 29-1 : sa
 *   rémunération, fixée selon le décret, est arrêtée par le président du tribunal judiciaire (L. 1965 art. 29-1, II ;
 *   D. 1967 art. 61-1-5) ; syndic désigné par le juge : qui fixe sa rémunération ? Aucun texte relu ne le dit, et il
 *   administre selon les art. 18 à 18-2 de la loi (D. 1967 art. 46, al. 3), honoraires de travaux votés par l'assemblée
 *   compris (art. 18-1 A, III) ; administrateur provisoire de l'art. 47 : qui fixe sa rémunération ? Aucun texte relu ;
 * - majorité du montant maximum par dépense de travaux hors budget (D. 1967 art. 26-1, al. 2) : celle de la délégation
 *   (art. 21-1) est retenue ;
 * - montant maximum par dépense de travaux hors budget au renouvellement exprès de la délégation générale (L. 1965 art.
 *   21-3) : est-il reconduit avec elle, ou l'assemblée doit-elle le fixer de nouveau ? VitFix ne le reconduit pas : un
 *   renouvellement décidé après lui l'écarte ; reconduit par la résolution, il se saisit de nouveau à sa date ;
 * - membre du conseil syndical désigné de nouveau avant le terme de son mandat, quand sa désignation précédente garde
 *   d'autres membres : le mandat précédent prend-il fin ? Les deux décisions restent en vigueur jusqu'à leur terme et ce
 *   membre figure dans les deux ;
 * - conseil syndical élu ou renouvelé par une assemblée tenue hors du délai de six mois après la clôture, ou par une
 *   assemblée extraordinaire : la fenêtre de six mois avant le terme suffit-elle à reconnaître son renouvellement, ou
 *   faut-il le saisir expressément ? VitFix s'en tient à la fenêtre.
 * Tranché par Hugo le 30/10/2026 : le décompte des 21 jours francs de la convocation (présentation au plus tard 22 jours
 * avant la réunion) est confirmé (décision J5) ; les seuils de l'art. 21 (consultation du conseil syndical, mise en
 * concurrence) s'entendent TTC, le texte ne le précisant pas (décision J6). L'alerte du mandataire ad hoc est modélisée
 * à part, dans alerte-mandataire-ad-hoc.ts (décision J7, voir plus haut).
 *
 * La « reddition » de ce module (« Rendu des comptes N » de l'exercice) n'est ni la reddition de comptes de fin de mission
 * (planification-mandat.ts), ni celle de l'ancien syndic (L. 1965 art. 18-2).
 * Hors périmètre : cotisation au fonds de travaux (fonds-travaux.ts), modalités des provisions (appels-budget.ts),
 * décision d'une opération de travaux (travaux-operations.ts), lignes du budget et d'honoraires de gestion, type de banque
 * (D-BANQUE), révocation des membres du conseil syndical, décision de ne pas en instituer (art. 21, art. 26).
 */

export const TYPES_DECISION_ANNUELLE = [
  'approbation_comptes',
  'budget',
  'complement',
  'honoraires',
  'travaux',
  'enveloppe_delegation_cs',
  'seuil_consultation_cs',
  'seuil_mise_en_concurrence',
  'delegation_art25a',
  'delegation_generale_cs',
  'plafond_travaux_cs',
  'acces_police_municipale',
  'mandat_syndic',
  'mandat_cs',
] as const
export type TypeDecisionAnnuelle = (typeof TYPES_DECISION_ANNUELLE)[number]

/** Délégataire d'une délégation de pouvoir de l'art. 25 a (« au syndic, au conseil syndical ou à toute personne »). */
export const DELEGATAIRES = ['syndic', 'conseil_syndical', 'autre'] as const
export type Delegataire = (typeof DELEGATAIRES)[number]

export interface RegleDecisionAnnuelle {
  libelle: string
  /** Majorité requise ; null : selon l'objet de la résolution (honoraires, travaux). */
  majorite: TypeMajorite | null
  fondement: string
  aConfirmer: boolean
  /** Décision d'un exercice (exerciceId requis), ou décision qui vaut jusqu'à la suivante ou jusqu'à son terme. */
  portee: 'exercice' | 'permanente'
  /** Montant : requis, signé (en plus ou en moins), facultatif ; null : sans objet. */
  montant: 'requis' | 'signe' | 'facultatif' | null
  /** Durée maximale en mois ; null : la décision ne porte pas de durée. */
  dureeMaxMois: number | null
  note: string | null
}

const NON_DELEGABLE = 'Ne peut être délégué au conseil syndical (L. 1965 art. 21-1, al. 2).'

export const REGLES_DECISIONS_ANNUELLES: Record<TypeDecisionAnnuelle, RegleDecisionAnnuelle> = {
  approbation_comptes: {
    libelle: "Approbation des comptes de l'exercice",
    majorite: 'art24',
    fondement: 'L. 1965 art. 18, II ; art. 24, I',
    aConfirmer: false,
    portee: 'exercice',
    montant: null,
    dureeMaxMois: null,
    note: NON_DELEGABLE,
  },
  budget: {
    libelle: 'Budget prévisionnel',
    majorite: 'art24',
    fondement: 'L. 1965 art. 14-1, I ; art. 24, I ; D. 1967 art. 43',
    aConfirmer: false,
    portee: 'exercice',
    montant: 'requis',
    dureeMaxMois: null,
    note: `Voté avant le début de l'exercice qu'il concerne : l'assemblée qui approuve les comptes de N vote en général le budget de N+2. ${NON_DELEGABLE}`,
  },
  complement: {
    libelle: 'Complément du budget',
    majorite: 'art24',
    fondement: 'L. 1965 art. 14-1, I ; art. 24, I',
    aConfirmer: false,
    portee: 'exercice',
    montant: 'signe',
    dureeMaxMois: null,
    note: 'Ajustement en plus ou en moins du budget voté (Gestéam : « Budgets € (+/-) »).',
  },
  honoraires: {
    libelle: 'Honoraires',
    majorite: null,
    fondement: 'D. 1967 art. 29 ; L. 1965 art. 18-1 A, III (selon l’objet)',
    aConfirmer: true,
    portee: 'exercice',
    montant: 'requis',
    dureeMaxMois: null,
    note: "Rémunération du syndic : éléments fixés par son contrat, approuvé à la majorité de l'art. 25 (D. 1967 art. 29) ; honoraires spécifiques de travaux : votés avec les travaux, aux mêmes règles de majorité (L. 1965 art. 18-1 A, III). Hors rémunération de l'administrateur provisoire de l'art. 29-1, arrêtée par le président du tribunal judiciaire (L. 1965 art. 29-1, II ; D. 1967 art. 61-1-5).",
  },
  travaux: {
    libelle: 'Travaux votés',
    majorite: null,
    fondement: 'L. 1965 art. 24, II ; art. 25 ; art. 26 (selon la nature des travaux)',
    aConfirmer: false,
    portee: 'exercice',
    montant: 'requis',
    dureeMaxMois: null,
    note: "La décision et le financement d'une opération restent portés par l'opération (travaux-operations.ts).",
  },
  enveloppe_delegation_cs: {
    libelle: 'Montant alloué au conseil syndical pour sa délégation de pouvoirs',
    majorite: 'art24',
    fondement: 'L. 1965 art. 21-2 ; D. 1967 art. 26-1, al. 1',
    aConfirmer: false,
    portee: 'exercice',
    montant: 'requis',
    dureeMaxMois: null,
    note: 'Montant spécifique alloué au sein du budget prévisionnel voté chaque année (Gestéam : « Conseil syndical € » de la fiche exercice).',
  },
  seuil_consultation_cs: {
    libelle: 'Seuil de consultation du conseil syndical (marchés et contrats)',
    majorite: 'art25',
    fondement: 'L. 1965 art. 21, al. 2',
    aConfirmer: false,
    portee: 'permanente',
    montant: 'requis',
    dureeMaxMois: null,
    note: "À partir de ce montant, l'avis du conseil syndical est notifié avec l'ordre du jour, pour information (D. 1967 art. 11, II, 3°).",
  },
  seuil_mise_en_concurrence: {
    libelle: 'Seuil de mise en concurrence des marchés et contrats (hors contrat de syndic)',
    majorite: 'art25',
    fondement: 'L. 1965 art. 21, al. 2 ; D. 1967 art. 19-2',
    aConfirmer: false,
    portee: 'permanente',
    montant: 'requis',
    dureeMaxMois: null,
    note: "Sans conditions fixées par l'assemblée : plusieurs devis, ou un devis descriptif soumis à plusieurs entreprises.",
  },
  delegation_art25a: {
    libelle: "Délégation de pouvoir (acte ou décision de l'art. 24)",
    majorite: 'art25',
    fondement: 'L. 1965 art. 25, a ; art. 18, IV ; D. 1967 art. 21',
    aConfirmer: false,
    portee: 'permanente',
    montant: 'facultatif',
    dureeMaxMois: null,
    note: "Délégation à une fin déterminée ; acte ou décision délégué mentionné expressément ; montant maximum exigé si le délégataire peut décider de dépenses ; à l'issue, le délégataire rend compte à l'assemblée (fin saisie comme terme).",
  },
  delegation_generale_cs: {
    libelle: 'Délégation de pouvoirs au conseil syndical',
    majorite: 'art25',
    fondement: 'L. 1965 art. 21-1 à 21-3 ; D. 1967 art. 26-1',
    aConfirmer: false,
    portee: 'permanente',
    montant: null,
    dureeMaxMois: 24,
    note: "Majorité des voix de tous les copropriétaires ; conseil d'au moins trois membres ; ni l'approbation des comptes ni le budget ; deux ans au plus, renouvelable par décision expresse. Sans montant : le montant alloué se vote chaque année dans le budget (montant alloué au conseil syndical de l'exercice) ; une dépense de travaux hors budget reçoit son propre montant maximum.",
  },
  plafond_travaux_cs: {
    libelle: 'Montant maximum alloué au conseil syndical pour une dépense de travaux hors budget',
    majorite: 'art25',
    fondement: 'L. 1965 art. 21-1 et 21-2 ; D. 1967 art. 26-1, al. 2',
    aConfirmer: true,
    portee: 'permanente',
    montant: 'requis',
    dureeMaxMois: null,
    note: 'Un montant pour chaque dépense de travaux non comprise dans le budget, appelée comme les dépenses hors budget ; vaut avec la délégation générale en vigueur.',
  },
  acces_police_municipale: {
    libelle: 'Autorisation permanente de la police municipale de pénétrer dans les parties communes',
    majorite: 'art24',
    fondement: 'L. 1965 art. 24, II, h ; CSI art. L. 272-1, al. 2',
    aConfirmer: false,
    portee: 'permanente',
    montant: null,
    dureeMaxMois: null,
    note: "La police et la gendarmerie nationales et les services d'incendie et de secours accèdent aux parties communes aux fins d'intervention, sans vote (CSI art. L. 272-1, al. 1).",
  },
  mandat_syndic: {
    libelle: 'Désignation du syndic et approbation de son contrat',
    majorite: 'art25',
    fondement: 'L. 1965 art. 25, c ; art. 18, VI ; D. 1967 art. 28 et 29',
    aConfirmer: false,
    portee: 'permanente',
    montant: null,
    dureeMaxMois: 36,
    note: "Trois ans au plus (un an pendant les délais de l'art. 1792-4-1 du code civil si le syndic a participé à la construction) ; le contrat fixe les dates calendaires de prise d'effet et d'échéance.",
  },
  mandat_cs: {
    libelle: 'Désignation des membres du conseil syndical',
    majorite: 'art25',
    fondement: 'L. 1965 art. 25, c ; D. 1967 art. 22, al. 3',
    aConfirmer: false,
    portee: 'permanente',
    montant: null,
    dureeMaxMois: 36,
    note: 'Trois années au plus, renouvelables.',
  },
}

/**
 * Qui décide : l'assemblée par une résolution (resolutions-ag.ts), ou l'administrateur provisoire de l'art. 29-1 investi
 * des pouvoirs de l'assemblée, dont la décision est inscrite au registre (D. 1967 art. 62-8).
 */
export type SourceDecisionAnnuelle =
  | { origine: 'assemblee'; agId: string; resolutionId: string }
  | { origine: 'administrateur'; reference: string }

export interface SaisieDecisionAnnuelle {
  id: string
  /** D1 : le syndicat. */
  coproprieteId: string
  type: TypeDecisionAnnuelle
  /** Date de l'assemblée, ou de la décision de l'administrateur provisoire. */
  date: string
  source: SourceDecisionAnnuelle
  /**
   * Exercice dont les comptes sont approuvés, dont le budget est voté (N+2 compris) ou ajusté, dont le budget alloue le
   * montant de la délégation au conseil syndical ; null : décision permanente.
   */
  exerciceId?: string | null
  /**
   * Centimes entiers ; sans objet pour la délégation générale au conseil syndical, dont le montant se saisit chaque année
   * (montant alloué de l'exercice) ou par dépense de travaux hors budget (montant maximum).
   */
  montantCentimes?: number | null
  /** Police municipale : true accorde l'autorisation permanente, false la retire. */
  autorisee?: boolean | null
  /** Délégation de l'art. 25 a : délégataire. */
  delegataire?: Delegataire | null
  /** Délégation de l'art. 25 a : acte ou décision délégué ; montant maximum du conseil syndical : dépense de travaux. */
  objet?: string | null
  /** Délégation de l'art. 25 a : le délégataire peut-il décider de dépenses ? true : montant maximum exigé. */
  autoriseDepenses?: boolean | null
  /** Mandats et délégation générale au conseil syndical. */
  dureeMois?: number | null
  /** Par défaut, la date de la décision. */
  prendEffetLe?: string | null
  /**
   * Mandats et délégation générale : par défaut, calculé (veille du même quantième au bout de la durée). Délégation de
   * l'art. 25 a : fin de la délégation (exécution, compte rendu à l'assemblée), facultative.
   */
  terme?: string | null
  /** Mandats : identifiants des positions ou identités désignées (D2), jamais de nom. */
  designesIds?: readonly string[]
}

export interface DecisionAnnuelle {
  id: string
  coproprieteId: string
  type: TypeDecisionAnnuelle
  date: string
  source: SourceDecisionAnnuelle
  exerciceId: string | null
  montantCentimes: number | null
  autorisee: boolean | null
  delegataire: Delegataire | null
  objet: string | null
  autoriseDepenses: boolean | null
  dureeMois: number | null
  prendEffetLe: string | null
  terme: string | null
  designesIds: string[]
}

function verifierDate(valeur: unknown, quoi: string): asserts valeur is string {
  if (!estDateIsoValide(valeur)) throw new Error(`${quoi} invalide (${String(valeur)}) : AAAA-MM-JJ attendu.`)
}

const estAbsent = (valeur: unknown): boolean => valeur === undefined || valeur === null

function exigerAbsent(valeur: unknown, champ: string, regle: RegleDecisionAnnuelle): void {
  if (!estAbsent(valeur)) throw new Error(`${regle.libelle} : le champ « ${champ} » est sans objet pour ce type de décision.`)
}

/**
 * Terme d'une durée en mois : veille du même quantième ; si ce quantième manque dans le mois d'arrivée (borné par
 * dates.ajouterMois), dernier jour de ce mois, sans retirer de jour.
 */
function termeCalcule(debut: string, mois: number): string {
  const memeQuantieme = ajouterMois(debut, mois)
  if (decomposerDateIso(memeQuantieme).j < decomposerDateIso(debut).j) return memeQuantieme
  return ajouterJours(memeQuantieme, -1)
}

const fr = dateIsoVersFr

function verifierSource(source: SourceDecisionAnnuelle): void {
  if (source?.origine === 'assemblee') {
    if (!source.agId?.trim() || !source.resolutionId?.trim())
      throw new Error("Décision d'assemblée : l'assemblée et la résolution qui l'adoptent sont attendues.")
    return
  }
  if (source?.origine === 'administrateur') {
    if (!source.reference?.trim())
      throw new Error("Décision de l'administrateur provisoire : référence de la décision attendue (registre, D. 1967 art. 62-8).")
    return
  }
  throw new Error('Source de la décision inconnue : assemblée ou administrateur provisoire attendus.')
}

function verifierExercice(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): string | null {
  const exerciceId = saisie.exerciceId ?? null
  if (regle.portee === 'exercice') {
    if (!exerciceId?.trim()) throw new Error(`${regle.libelle} : exercice attendu (décision d'exercice).`)
    return exerciceId
  }
  if (exerciceId !== null)
    throw new Error(`${regle.libelle} : décision permanente, sans exercice (elle vaut jusqu'à la décision suivante ou jusqu'à son terme).`)
  return null
}

function verifierMontant(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): number | null {
  const montant = saisie.montantCentimes ?? null
  if (regle.montant === null) {
    exigerAbsent(montant, 'montant', regle)
    return null
  }
  if (montant === null) {
    if (regle.montant === 'facultatif') return null
    throw new Error(`${regle.libelle} : montant attendu (centimes entiers).`)
  }
  const signe = regle.montant === 'signe'
  if (!Number.isInteger(montant) || (!signe && montant < 0)) {
    const attendu = signe ? 'centimes entiers' : 'centimes entiers positifs'
    throw new Error(`${regle.libelle} : montant invalide (${montant}) : ${attendu} attendus.`)
  }
  return montant
}

function verifierAutorisation(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): boolean | null {
  const autorisee = saisie.autorisee ?? null
  if (saisie.type !== 'acces_police_municipale') {
    exigerAbsent(autorisee, 'autorisation', regle)
    return null
  }
  if (typeof autorisee !== 'boolean') throw new Error("Police municipale : dire si l'autorisation permanente est accordée ou retirée.")
  return autorisee
}

function verifierDelegataire(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): Delegataire | null {
  const delegataire = saisie.delegataire ?? null
  if (saisie.type !== 'delegation_art25a') {
    exigerAbsent(delegataire, 'délégataire', regle)
    return null
  }
  if (delegataire === null || !(DELEGATAIRES as readonly string[]).includes(delegataire))
    throw new Error(`Délégation de pouvoir : délégataire attendu (${DELEGATAIRES.join(', ')}).`)
  return delegataire
}

/** Types qui portent un objet, et l'erreur levée quand il manque. */
const OBJET_ATTENDU: Partial<Record<TypeDecisionAnnuelle, string>> = {
  delegation_art25a: "Délégation de pouvoir : mentionner expressément l'acte ou la décision délégué (D. 1967 art. 21).",
  plafond_travaux_cs:
    'Montant maximum alloué au conseil syndical : désigner la dépense de travaux hors budget concernée (D. 1967 art. 26-1, al. 2).',
}

function verifierObjet(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): string | null {
  const objet = saisie.objet ?? null
  const attendu = OBJET_ATTENDU[saisie.type]
  if (attendu === undefined) {
    exigerAbsent(objet, 'objet', regle)
    return null
  }
  if (!objet?.trim()) throw new Error(attendu)
  return objet.replace(/\s+/g, ' ').trim()
}

/** L. 1965 art. 25, a : quand le délégataire peut décider de dépenses, l'assemblée fixe le montant maximum des sommes allouées. */
function verifierDepenses(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle, montant: number | null): boolean | null {
  const autorise = saisie.autoriseDepenses ?? null
  if (saisie.type !== 'delegation_art25a') {
    exigerAbsent(autorise, 'dépenses autorisées', regle)
    return null
  }
  if (typeof autorise !== 'boolean')
    throw new Error('Délégation de pouvoir : dire si le délégataire peut décider de dépenses (L. 1965 art. 25, a).')
  if (autorise && montant === null)
    throw new Error('Délégation de pouvoir autorisant des dépenses : montant maximum des sommes allouées attendu (L. 1965 art. 25, a).')
  if (!autorise && montant !== null) throw new Error('Délégation de pouvoir sans dépense : le montant maximum est sans objet.')
  return autorise
}

type DureeDecision = Pick<DecisionAnnuelle, 'dureeMois' | 'prendEffetLe' | 'terme'>

/** Types dont la fin se saisit sans durée : délégation de l'art. 25 a (exécution, compte rendu à l'assemblée). */
const TYPES_A_FIN_SAISIE: readonly TypeDecisionAnnuelle[] = ['delegation_art25a']

function verifierFin(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): DureeDecision {
  exigerAbsent(saisie.dureeMois, 'durée', regle)
  exigerAbsent(saisie.prendEffetLe, "prise d'effet", regle)
  const fin = saisie.terme ?? null
  if (!TYPES_A_FIN_SAISIE.includes(saisie.type)) exigerAbsent(fin, 'terme', regle)
  if (fin === null) return { dureeMois: null, prendEffetLe: null, terme: null }
  verifierDate(fin, `${regle.libelle} : fin`)
  if (fin < saisie.date) throw new Error(`${regle.libelle} : fin (${fr(fin)}) antérieure à la décision (${fr(saisie.date)}).`)
  return { dureeMois: null, prendEffetLe: null, terme: fin }
}

function verifierDuree(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): DureeDecision {
  if (regle.dureeMaxMois === null) return verifierFin(saisie, regle)
  const dureeMois = saisie.dureeMois ?? null
  const terme = saisie.terme ?? null
  if (dureeMois === null || !Number.isInteger(dureeMois) || dureeMois < 1)
    throw new Error(`${regle.libelle} : durée en mois entiers (au moins 1) attendue.`)
  const debut = saisie.prendEffetLe ?? saisie.date
  verifierDate(debut, `${regle.libelle} : date de prise d'effet`)
  if (debut < saisie.date)
    throw new Error(`${regle.libelle} : prise d'effet (${fr(debut)}) antérieure à la décision (${fr(saisie.date)}).`)
  if (terme === null) return { dureeMois, prendEffetLe: debut, terme: termeCalcule(debut, dureeMois) }
  verifierDate(terme, `${regle.libelle} : terme`)
  if (terme < debut) throw new Error(`${regle.libelle} : terme (${fr(terme)}) antérieur à la prise d'effet (${fr(debut)}).`)
  return { dureeMois, prendEffetLe: debut, terme }
}

function verifierDesignes(saisie: SaisieDecisionAnnuelle, regle: RegleDecisionAnnuelle): string[] {
  const ids = saisie.designesIds ?? []
  if (ids.length > 0 && saisie.type !== 'mandat_syndic' && saisie.type !== 'mandat_cs')
    throw new Error(`${regle.libelle} : le champ « désignés » est sans objet pour ce type de décision.`)
  if (ids.some((id) => typeof id !== 'string' || !id.trim()))
    throw new Error("Désignés : identifiants de positions ou d'identités (D2) attendus, sans valeur vide.")
  if (new Set(ids).size !== ids.length) throw new Error('Désignés : identifiant en double.')
  return [...ids]
}

/** Crée une décision annuelle (adoptée) ; lève une erreur sur une saisie incomplète ou incohérente. */
export function creerDecisionAnnuelle(saisie: SaisieDecisionAnnuelle): DecisionAnnuelle {
  if (!saisie.id?.trim()) throw new Error('Décision annuelle sans identifiant.')
  if (!saisie.coproprieteId?.trim()) throw new Error('Décision annuelle sans syndicat : D1 la rattache à la copropriété.')
  if (!Object.hasOwn(REGLES_DECISIONS_ANNUELLES, saisie.type))
    throw new Error(`Type de décision annuelle inconnu : « ${String(saisie.type)} ».`)
  verifierDate(saisie.date, 'Date de la décision')
  const regle = REGLES_DECISIONS_ANNUELLES[saisie.type]
  verifierSource(saisie.source)
  const exerciceId = verifierExercice(saisie, regle)
  const montantCentimes = verifierMontant(saisie, regle)
  return {
    id: saisie.id.trim(),
    coproprieteId: saisie.coproprieteId,
    type: saisie.type,
    date: saisie.date,
    source: { ...saisie.source },
    exerciceId,
    montantCentimes,
    autorisee: verifierAutorisation(saisie, regle),
    delegataire: verifierDelegataire(saisie, regle),
    objet: verifierObjet(saisie, regle),
    autoriseDepenses: verifierDepenses(saisie, regle, montantCentimes),
    ...verifierDuree(saisie, regle),
    designesIds: verifierDesignes(saisie, regle),
  }
}

export type CodeAnomalieDecisionAnnuelle =
  | 'resolution_a_rattacher'
  | 'resolution_non_adoptee'
  | 'majorite_insuffisante'
  | 'majorite_a_verifier'
  | 'pouvoirs_ag_non_etablis'
  | 'aucun_pouvoir_ag_confie'
  | 'pouvoir_ag_a_verifier'
  | 'pouvoir_ag_confie_a_l_administrateur'
  | 'duree_au_dela_du_maximum'
  | 'duree_et_terme_discordants'
  | 'approbation_avant_cloture'
  | 'budget_vote_apres_ouverture'
  | 'honoraires_sous_mandat_judiciaire'
  | 'conseil_syndical_insuffisant'

export interface AnomalieDecisionAnnuelle {
  code: CodeAnomalieDecisionAnnuelle
  message: string
  fondement: string
  aConfirmer: boolean
}

/** Étendue des pouvoirs de l'assemblée confiés par l'ordonnance à l'administrateur provisoire (L. 1965 art. 29-1). */
export type PouvoirsAgConfies = 'tous' | 'partie' | 'aucun'

export interface ContexteDecisionAnnuelle {
  /** Résolution désignée par la source « assemblée » ; absente ou null : à rattacher. */
  resolution?: Resolution | null
  /** Régime du mandat de justice en cours à la date de la décision ; absent ou null : aucun ou inconnu. */
  regime?: Regime | null
  pouvoirsAgConfies?: PouvoirsAgConfies | null
  /**
   * Exercice désigné par decision.exerciceId (contrôle des dates). Le type Exercice n'ayant pas d'identifiant, seule son
   * appartenance au syndicat est vérifiée : sa correspondance avec decision.exerciceId reste à la charge de l'appelant.
   */
  exercice?: Exercice | null
  /** Nombre de membres du conseil syndical (délégation générale : au moins trois). */
  membresConseilSyndical?: number | null
}

const RANG_MAJORITE: Record<TypeMajorite, number> = { art24: 1, art25: 2, art26: 3, unanimite: 4 }

const nommerMajorite = (majorite: TypeMajorite): string => `${MAJORITES_AG[majorite].libelle} (${MAJORITES_AG[majorite].base})`

const FONDEMENT_POUVOIRS_AG = 'L. 1965 art. 29-1, I, al. 2'

const MAJORITE_HONORAIRES =
  "rémunération du syndic fixée par son contrat, approuvé à la majorité de l'art. 25 (D. 1967 art. 29), ou honoraires de travaux votés aux mêmes règles de majorité que les travaux (L. 1965 art. 18-1 A, III)"

function anomaliesMajorite(decision: DecisionAnnuelle, resolution: Resolution): AnomalieDecisionAnnuelle[] {
  const regle = REGLES_DECISIONS_ANNUELLES[decision.type]
  if (regle.majorite !== null) {
    if (RANG_MAJORITE[resolution.majorite] >= RANG_MAJORITE[regle.majorite]) return []
    return [
      {
        code: 'majorite_insuffisante',
        message: `${regle.libelle} : majorité requise ${nommerMajorite(regle.majorite)} ; la résolution n° ${resolution.numero} est soumise à la ${nommerMajorite(resolution.majorite)}.`,
        fondement: regle.fondement,
        aConfirmer: regle.aConfirmer,
      },
    ]
  }
  if (decision.type !== 'honoraires' || resolution.majorite !== 'art24') return []
  return [
    {
      code: 'majorite_a_verifier',
      message: `${regle.libelle} : majorité selon l'objet — ${MAJORITE_HONORAIRES} ; la résolution n° ${resolution.numero} est soumise à la ${nommerMajorite(resolution.majorite)} : vérifier qu'elle ne porte que sur des honoraires de travaux votés à cette majorité.`,
      fondement: regle.fondement,
      aConfirmer: true,
    },
  ]
}

function anomaliesResolution(
  decision: DecisionAnnuelle,
  source: Extract<SourceDecisionAnnuelle, { origine: 'assemblee' }>,
  resolution: Resolution | null,
): AnomalieDecisionAnnuelle[] {
  const regle = REGLES_DECISIONS_ANNUELLES[decision.type]
  if (resolution === null)
    return [
      {
        code: 'resolution_a_rattacher',
        message: `${regle.libelle} : rattacher la résolution qui l'adopte (assemblée ${source.agId}, résolution ${source.resolutionId}) pour contrôler son adoption et sa majorité.`,
        fondement: regle.fondement,
        aConfirmer: false,
      },
    ]
  if (resolution.agId !== source.agId || resolution.id !== source.resolutionId)
    throw new Error(
      `${regle.libelle} : la résolution fournie (${resolution.agId} / ${resolution.id}) n'est pas celle de la décision (${source.agId} / ${source.resolutionId}).`,
    )
  const anomalies: AnomalieDecisionAnnuelle[] = []
  if (resolution.etat !== 'adoptee')
    anomalies.push({
      code: 'resolution_non_adoptee',
      message: `${regle.libelle} : la résolution n° ${resolution.numero} est ${LIBELLES_ETATS_RESOLUTION[resolution.etat]} ; seule une résolution adoptée fonde la décision.`,
      fondement: regle.fondement,
      aConfirmer: false,
    })
  return [...anomalies, ...anomaliesMajorite(decision, resolution)]
}

/** Étendue des pouvoirs de l'assemblée reçus par l'administrateur provisoire de l'art. 29-1 ; « inconnue » : non saisie. */
type EtenduePouvoirsAg = PouvoirsAgConfies | 'inconnue'

const anomaliePouvoirs = (
  code: CodeAnomalieDecisionAnnuelle,
  message: string,
  aConfirmer: boolean,
): AnomalieDecisionAnnuelle => ({ code, message, fondement: FONDEMENT_POUVOIRS_AG, aConfirmer })

/** Décision prise par l'administrateur provisoire de l'art. 29-1, selon les pouvoirs de l'assemblée qu'il a reçus. */
const ANOMALIES_DECISION_ADMINISTRATEUR: Record<EtenduePouvoirsAg, AnomalieDecisionAnnuelle | null> = {
  tous: null,
  partie: anomaliePouvoirs(
    'pouvoir_ag_a_verifier',
    "Administrateur provisoire investi d'une partie des pouvoirs de l'assemblée : vérifier que l'ordonnance lui confie celui-ci ; à défaut, l'assemblée qu'il convoque et préside décide.",
    true,
  ),
  aucun: anomaliePouvoirs(
    'aucun_pouvoir_ag_confie',
    "Administrateur provisoire : l'ordonnance ne lui confie aucun pouvoir de l'assemblée ; la décision revient à l'assemblée qu'il convoque et préside.",
    false,
  ),
  inconnue: anomaliePouvoirs(
    'pouvoirs_ag_non_etablis',
    "Administrateur provisoire : l'étendue des pouvoirs de l'assemblée confiés par l'ordonnance n'est pas établie ; à défaut, l'assemblée qu'il convoque et préside décide.",
    false,
  ),
}

/** Décision votée par l'assemblée sous administrateur provisoire de l'art. 29-1 : elle garde les pouvoirs hors de sa mission. */
const ANOMALIES_DECISION_ASSEMBLEE_SOUS_AP: Record<EtenduePouvoirsAg, AnomalieDecisionAnnuelle | null> = {
  tous: anomaliePouvoirs(
    'pouvoir_ag_confie_a_l_administrateur',
    "Décision votée par l'assemblée alors que l'ordonnance confie tous ses pouvoirs (hors art. 26 a et b) à l'administrateur provisoire : la décision lui revient (il peut convoquer les copropriétaires pour les informer et les entendre, D. 1967 art. 62-7).",
    false,
  ),
  partie: anomaliePouvoirs(
    'pouvoir_ag_a_verifier',
    "Administrateur provisoire investi d'une partie des pouvoirs de l'assemblée : vérifier que l'ordonnance laisse celui-ci à l'assemblée ; à défaut, la décision revient à l'administrateur provisoire.",
    true,
  ),
  aucun: null,
  inconnue: anomaliePouvoirs(
    'pouvoir_ag_a_verifier',
    "Administrateur provisoire : l'étendue des pouvoirs de l'assemblée confiés par l'ordonnance n'est pas établie ; vérifier que l'assemblée a gardé celui-ci.",
    true,
  ),
}

const SYNDIC_SOUS_AP = "Désignation d'un syndic : vérifier ce que prévoit l'ordonnance pour la fin de la mission."

/** Décision prise hors assemblée sans administrateur provisoire de l'art. 29-1 : régime non renseigné, ou régime sans ces pouvoirs. */
const DECISION_HORS_ASSEMBLEE = {
  regimeInconnu: anomaliePouvoirs(
    'pouvoirs_ag_non_etablis',
    "Décision prise hors assemblée, sans mandat de justice renseigné : seul l'administrateur provisoire de l'art. 29-1 reçoit des pouvoirs de l'assemblée générale ; à défaut, la décision revient à l'assemblée.",
    false,
  ),
  autreRegime: anomaliePouvoirs(
    'aucun_pouvoir_ag_confie',
    "Décision prise hors assemblée : seul l'administrateur provisoire de l'art. 29-1 reçoit des pouvoirs de l'assemblée générale ; la décision revient à l'assemblée.",
    false,
  ),
}

function anomaliesAdministrateur({ regime = null, pouvoirsAgConfies = null }: ContexteDecisionAnnuelle): AnomalieDecisionAnnuelle[] {
  if (regime === null) return [{ ...DECISION_HORS_ASSEMBLEE.regimeInconnu }]
  if (regime !== 'ap291') return [{ ...DECISION_HORS_ASSEMBLEE.autreRegime }]
  const anomalie = ANOMALIES_DECISION_ADMINISTRATEUR[pouvoirsAgConfies ?? 'inconnue']
  return anomalie === null ? [] : [{ ...anomalie }]
}

function anomaliesAssembleeSousAp(
  decision: DecisionAnnuelle,
  { regime = null, pouvoirsAgConfies = null }: ContexteDecisionAnnuelle,
): AnomalieDecisionAnnuelle[] {
  if (regime !== 'ap291') return []
  const anomalie = ANOMALIES_DECISION_ASSEMBLEE_SOUS_AP[pouvoirsAgConfies ?? 'inconnue']
  if (anomalie === null) return []
  if (anomalie.aConfirmer || decision.type !== 'mandat_syndic') return [{ ...anomalie }]
  return [{ ...anomalie, message: `${anomalie.message} ${SYNDIC_SOUS_AP}`, aConfirmer: true }]
}

function anomaliesDuree(decision: DecisionAnnuelle): AnomalieDecisionAnnuelle[] {
  const regle = REGLES_DECISIONS_ANNUELLES[decision.type]
  const { dureeMois, prendEffetLe, terme } = decision
  if (regle.dureeMaxMois === null || dureeMois === null || prendEffetLe === null || terme === null) return []
  const anomalies: AnomalieDecisionAnnuelle[] = []
  const termeMax = termeCalcule(prendEffetLe, regle.dureeMaxMois)
  if (dureeMois > regle.dureeMaxMois || terme > termeMax)
    anomalies.push({
      code: 'duree_au_dela_du_maximum',
      message: `${regle.libelle} : ${dureeMois} mois, terme le ${fr(terme)} ; au plus ${regle.dureeMaxMois} mois, soit un terme le ${fr(termeMax)} au plus tard.`,
      fondement: regle.fondement,
      aConfirmer: false,
    })
  const termeDeLaDuree = termeCalcule(prendEffetLe, dureeMois)
  if (terme !== termeDeLaDuree)
    anomalies.push({
      code: 'duree_et_terme_discordants',
      message: `${regle.libelle} : ${dureeMois} mois à compter du ${fr(prendEffetLe)} donnent un terme le ${fr(termeDeLaDuree)} ; terme saisi le ${fr(terme)} : vérifier la durée et les dates calendaires.`,
      fondement: regle.fondement,
      aConfirmer: true,
    })
  return anomalies
}

function anomaliesExercice(decision: DecisionAnnuelle, exercice: Exercice | null): AnomalieDecisionAnnuelle[] {
  if (exercice === null || decision.exerciceId === null) return []
  if (exercice.coproprieteId !== decision.coproprieteId)
    throw new Error(`Exercice ${exercice.nom} d'un autre syndicat que la décision ${decision.id}.`)
  if (decision.type === 'approbation_comptes' && decision.date <= exercice.cloture)
    return [
      {
        code: 'approbation_avant_cloture',
        message: `Comptes de l'exercice ${exercice.nom} approuvés le ${fr(decision.date)}, avant sa clôture (${fr(exercice.cloture)}) : seuls les comptes d'un exercice clos s'approuvent.`,
        fondement: 'L. 1965 art. 18, II',
        aConfirmer: false,
      },
    ]
  if (decision.type === 'budget' && decision.date >= exercice.ouverture)
    return [
      {
        code: 'budget_vote_apres_ouverture',
        message: `Budget de l'exercice ${exercice.nom} voté le ${fr(decision.date)}, après son ouverture (${fr(exercice.ouverture)}) : il se vote avant le début de l'exercice ; à défaut, deux provisions trimestrielles au quart du budget précédent, sur autorisation préalable de l'assemblée.`,
        fondement: 'D. 1967 art. 43',
        aConfirmer: false,
      },
    ]
  return []
}

/**
 * Honoraires votés sous mandat de justice, selon le régime : rémunération de l'administrateur provisoire de l'art. 29-1
 * arrêtée par le juge (texte relu) ; syndic désigné par le juge et administrateur provisoire de l'art. 47 : aucun texte relu
 * sur leur rémunération (🔴), le fondement ne cite que ce que les textes portent.
 */
const HONORAIRES_SOUS_MANDAT: Record<Regime, { message: string; fondement: string }> = {
  ap291: {
    message:
      "Honoraires votés sous administrateur provisoire de l'art. 29-1 : sa rémunération, fixée selon le décret, est arrêtée par le président du tribunal judiciaire et n'est pas votée par l'assemblée ; vérifier ce que vise la résolution.",
    fondement: 'L. 1965 art. 29-1, II ; D. 1967 art. 61-1-5',
  },
  sj: {
    message:
      "Honoraires votés sous syndic désigné par le président du tribunal judiciaire : aucun texte relu ne dit qui fixe sa rémunération ; il administre selon les art. 18 à 18-2 de la loi, honoraires spécifiques de travaux votés par l'assemblée compris ; vérifier ce que vise la résolution.",
    fondement: 'D. 1967 art. 46, al. 3 ; L. 1965 art. 18-1 A, III',
  },
  ap47: {
    message:
      "Honoraires votés sous administrateur provisoire d'un syndicat dépourvu de syndic : aucun texte relu ne dit qui fixe sa rémunération ; vérifier ce que vise la résolution.",
    fondement: 'D. 1967 art. 47 (régime seul ; aucun texte relu sur la rémunération)',
  },
}

function anomaliesPropres(
  decision: DecisionAnnuelle,
  { regime = null, membresConseilSyndical = null }: ContexteDecisionAnnuelle,
): AnomalieDecisionAnnuelle[] {
  if (membresConseilSyndical !== null && (!Number.isInteger(membresConseilSyndical) || membresConseilSyndical < 0))
    throw new Error(`Nombre de membres du conseil syndical invalide (${membresConseilSyndical}) : entier positif attendu.`)
  if (decision.type === 'honoraires' && regime !== null) {
    const { message, fondement } = HONORAIRES_SOUS_MANDAT[regime]
    return [{ code: 'honoraires_sous_mandat_judiciaire', message, fondement, aConfirmer: true }]
  }
  if (decision.type === 'delegation_generale_cs' && membresConseilSyndical !== null && membresConseilSyndical < 3)
    return [
      {
        code: 'conseil_syndical_insuffisant',
        message: `Délégation de pouvoirs au conseil syndical : ${membresConseilSyndical} membre(s) ; elle exige un conseil d'au moins trois membres.`,
        fondement: 'L. 1965 art. 21-1, al. 1',
        aConfirmer: false,
      },
    ]
  return []
}

/**
 * Contrôle d'une décision annuelle : résolution adoptée à la majorité requise (ou pouvoirs de l'assemblée confiés à
 * l'administrateur provisoire, et pouvoirs que l'assemblée a gardés), durée maximale et concordance durée/terme, dates de
 * l'exercice, cas propres (honoraires sous mandat de justice, conseil syndical de moins de trois membres). Lève une erreur
 * sur une résolution qui n'est pas celle de la décision, ou sur un exercice d'un autre syndicat (la correspondance de
 * l'exercice avec decision.exerciceId reste à la charge de l'appelant) ; renvoie les anomalies (vide si tout va bien).
 */
export function controlerDecisionAnnuelle(
  decision: DecisionAnnuelle,
  contexte: ContexteDecisionAnnuelle = {},
): AnomalieDecisionAnnuelle[] {
  const { source } = decision
  const anomaliesSource =
    source.origine === 'assemblee'
      ? [...anomaliesResolution(decision, source, contexte.resolution ?? null), ...anomaliesAssembleeSousAp(decision, contexte)]
      : anomaliesAdministrateur(contexte)
  return [
    ...anomaliesSource,
    ...anomaliesDuree(decision),
    ...anomaliesExercice(decision, contexte.exercice ?? null),
    ...anomaliesPropres(decision, contexte),
  ]
}

function verifierUnSyndicat(elements: readonly { coproprieteId: string }[]): void {
  if (new Set(elements.map((e) => e.coproprieteId)).size > 1) throw new Error('Éléments de plusieurs syndicats : un seul syndicat attendu.')
}

/** Motif de la fin du mandat du syndic avant son terme. */
export const MOTIFS_FIN_MANDAT_SYNDIC = ['administrateur_provisoire', 'revocation', 'resiliation', 'autre'] as const
export type MotifFinMandatSyndic = (typeof MOTIFS_FIN_MANDAT_SYNDIC)[number]

export interface FinMandatSyndic {
  /** Date à laquelle le mandat en cours cesse (désignation de l'administrateur provisoire, révocation…). */
  date: string
  motif: MotifFinMandatSyndic
}

export interface OptionsMandats {
  /** Fins du mandat du syndic avant son terme : chacune clôt, à sa date, le mandat qui a pris effet avant elle. */
  finsMandatSyndic?: readonly FinMandatSyndic[]
}

const FINS_MANDAT_SYNDIC: Record<MotifFinMandatSyndic, { libelle: string; fondement: string }> = {
  administrateur_provisoire: {
    libelle: "mandat cessé de plein droit, sans indemnité, à la désignation de l'administrateur provisoire",
    fondement: 'L. 1965 art. 29-1, I, al. 2',
  },
  revocation: { libelle: "syndic révoqué par l'assemblée", fondement: 'L. 1965 art. 25, c' },
  resiliation: { libelle: 'contrat résilié pour inexécution suffisamment grave', fondement: 'L. 1965 art. 18, VIII' },
  autre: { libelle: 'fin constatée', fondement: 'L. 1965 art. 18, VI ; D. 1967 art. 29' },
}

function verifierFins(fins: readonly FinMandatSyndic[] = []): readonly FinMandatSyndic[] {
  for (const fin of fins) {
    verifierDate(fin?.date, 'Date de fin du mandat du syndic')
    if (!Object.hasOwn(FINS_MANDAT_SYNDIC, fin.motif))
      throw new Error(`Motif de fin du mandat du syndic inconnu : « ${String(fin.motif)} ».`)
  }
  return fins
}

/** Types dont plusieurs décisions valent ensemble (membres du conseil syndical, délégations, montants par dépense). */
const TYPES_CUMULATIFS: readonly TypeDecisionAnnuelle[] = ['delegation_art25a', 'plafond_travaux_cs', 'mandat_cs']

const debutDecision = (decision: DecisionAnnuelle): string => decision.prendEffetLe ?? decision.date

const comparerDecisions = (a: DecisionAnnuelle, b: DecisionAnnuelle): number =>
  debutDecision(a).localeCompare(debutDecision(b)) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)

/** Première fin du mandat du syndic survenue après sa prise d'effet et au plus tard à la date `jusqua`. */
function finDuMandat(decision: DecisionAnnuelle, fins: readonly FinMandatSyndic[], jusqua: string): FinMandatSyndic | undefined {
  if (decision.type !== 'mandat_syndic') return undefined
  const debut = debutDecision(decision)
  return fins.filter((f) => debut < f.date && f.date <= jusqua).sort((a, b) => a.date.localeCompare(b.date))[0]
}

const enCours = (decision: DecisionAnnuelle, date: string, fins: readonly FinMandatSyndic[]): boolean =>
  (decision.terme === null || date <= decision.terme) && finDuMandat(decision, fins, date) === undefined

/**
 * Un montant maximum par dépense de travaux hors budget vaut avec la délégation générale en vigueur, décidée (date de la
 * décision, non de sa prise d'effet) au plus tard avec lui : un renouvellement décidé après lui ne le reconduit pas (🔴).
 */
function avecDelegationGenerale(enVigueur: DecisionAnnuelle[]): DecisionAnnuelle[] {
  const delegation = enVigueur.find((d) => d.type === 'delegation_generale_cs')
  return enVigueur.filter((d) => d.type !== 'plafond_travaux_cs' || (delegation !== undefined && delegation.date <= d.date))
}

/**
 * Fenêtre, en mois avant le terme du conseil syndical, où une désignation le renouvelle : l'assemblée annuelle se tient
 * dans les six mois de la clôture (L. 1965 art. 14-1, I) ; celle qui renouvelle un conseil élu par l'assemblée annuelle se
 * tient donc moins de six mois avant son terme, ou après (🔵, 🔴 pour une assemblée hors délai ou extraordinaire).
 */
const FENETRE_RENOUVELLEMENT_CS_MOIS = 6

/** Désignations du conseil syndical qui prennent effet après `decision` et vont au-delà de son terme. */
function designationsAuDelaDuTerme(decision: DecisionAnnuelle, decisions: readonly DecisionAnnuelle[]): DecisionAnnuelle[] {
  const { terme } = decision
  if (decision.type !== 'mandat_cs' || terme === null) return []
  return decisions.filter(
    (d) =>
      d.type === 'mandat_cs' &&
      d.id !== decision.id &&
      debutDecision(d) > debutDecision(decision) &&
      d.terme !== null &&
      d.terme > terme,
  )
}

/** Chacun des membres désignés par `decision` l'est de nouveau par l'une des `suivantes`. */
function membresTousRedesignes(decision: DecisionAnnuelle, suivantes: readonly DecisionAnnuelle[]): boolean {
  const redesignes = new Set(suivantes.flatMap((d) => d.designesIds))
  return decision.designesIds.length > 0 && decision.designesIds.every((id) => redesignes.has(id))
}

/**
 * Désignation du conseil syndical dont chaque membre est désigné de nouveau, au-delà de son terme, par une désignation qui a
 * pris effet : elle n'ajoute rien et sort des décisions en vigueur, quelle que soit la réponse à la question 🔴 sur le
 * mandat précédent.
 */
const remplaceeParSesMembres = (decision: DecisionAnnuelle, prises: readonly DecisionAnnuelle[]): boolean =>
  membresTousRedesignes(decision, designationsAuDelaDuTerme(decision, prises))

/**
 * Décisions permanentes en vigueur à une date (décisions enregistrées, donc adoptées) : pour chaque type, la plus récente
 * qui a pris effet, sauf membres du conseil syndical, délégations de l'art. 25 a et montants maximum par dépense de
 * travaux, qui se cumulent ; une décision échue (terme ou fin passés), un mandat du syndic cessé avant son terme
 * (`options.finsMandatSyndic`) ou une désignation du conseil syndical dont chaque membre est désigné de nouveau au-delà de
 * son terme n'est plus en vigueur. Un membre désigné de nouveau alors que sa désignation précédente garde d'autres membres
 * figure dans les deux (🔴). Ordre des types, puis de prise d'effet.
 */
export function decisionsEnVigueur(
  decisions: readonly DecisionAnnuelle[],
  date: string,
  options: OptionsMandats = {},
): DecisionAnnuelle[] {
  verifierDate(date, 'Date de référence')
  verifierUnSyndicat(decisions)
  const fins = verifierFins(options.finsMandatSyndic)
  const prises = decisions
    .filter((d) => REGLES_DECISIONS_ANNUELLES[d.type].portee === 'permanente' && debutDecision(d) <= date)
    .sort(comparerDecisions)
  const enVigueur = TYPES_DECISION_ANNUELLE.flatMap((type) => {
    const duType = prises.filter((d) => d.type === type)
    const retenues = TYPES_CUMULATIFS.includes(type) ? duType : duType.slice(-1)
    return retenues.filter((d) => enCours(d, date, fins) && !remplaceeParSesMembres(d, prises))
  })
  return avecDelegationGenerale(enVigueur)
}

/**
 * Montant alloué au conseil syndical dans le budget d'un exercice pour sa délégation de pouvoirs (D. 1967 art. 26-1,
 * al. 1) : celui de la décision la plus récente ; null : aucun.
 */
export function enveloppeDelegationCs(decisions: readonly DecisionAnnuelle[], exerciceId: string): number | null {
  verifierUnSyndicat(decisions)
  const duBudget = decisions
    .filter((d) => d.type === 'enveloppe_delegation_cs' && d.exerciceId === exerciceId)
    .sort(comparerDecisions)
  return duBudget.at(-1)?.montantCentimes ?? null
}

/**
 * Le montant d'un marché ou d'un contrat (hors contrat de syndic pour la mise en concurrence) atteint-il les seuils en
 * vigueur ? « À partir duquel » : montant égal ou supérieur. null : aucun seuil décidé. `enVigueur` : decisionsEnVigueur.
 */
export function seuilsAtteints(
  montantCentimes: number,
  enVigueur: readonly DecisionAnnuelle[],
): { consultationCs: boolean | null; miseEnConcurrence: boolean | null } {
  if (!Number.isInteger(montantCentimes) || montantCentimes < 0)
    throw new Error(`Montant invalide (${montantCentimes}) : centimes entiers positifs attendus.`)
  const atteint = (type: TypeDecisionAnnuelle): boolean | null => {
    const seuil = enVigueur.findLast((d) => d.type === type)?.montantCentimes
    return seuil === undefined || seuil === null ? null : montantCentimes >= seuil
  }
  return { consultationCs: atteint('seuil_consultation_cs'), miseEnConcurrence: atteint('seuil_mise_en_concurrence') }
}

/**
 * Bloc Exercice de la fiche AG (Gestéam : Exercice approuvé, Nouvel exercice, N+2) : dernier exercice clos avant
 * l'assemblée, exercice en cours, premier exercice ouvert après l'assemblée (celui dont elle vote le budget).
 */
export function exercicesDeLAssemblee<E extends Exercice>(
  dateAg: string,
  exercices: readonly E[],
): { approuve: E | null; enCours: E | null; aVoter: E | null } {
  verifierDate(dateAg, "Date de l'assemblée")
  verifierUnSyndicat(exercices)
  const tries = [...exercices].sort((a, b) => a.ouverture.localeCompare(b.ouverture))
  return {
    approuve: tries.findLast((e) => e.cloture < dateAg) ?? null,
    enCours: tries.find((e) => e.ouverture <= dateAg && dateAg <= e.cloture) ?? null,
    aVoter: tries.find((e) => e.ouverture > dateAg) ?? null,
  }
}

export type CodeEcheanceDecisionAnnuelle =
  | 'assemblee_budget'
  | 'comptes_au_conseil_syndical'
  | 'convocation_comptes'
  | 'terme_mandat_syndic'
  | 'terme_mandat_cs'
  | 'fin_delegation_cs'

export interface EcheanceDecisionAnnuelle {
  code: CodeEcheanceDecisionAnnuelle
  /** Exercice ou décision concerné (clé du suivi « à faire »). */
  objetId: string
  libelle: string
  date: string
  fondement: string
  aConfirmer: boolean
  /** Accomplie, ou close (mandat du syndic cessé avant son terme). */
  accomplie: boolean
}

/** Dates de clôture de l'exercice (Gestéam, onglet « Honoraires, suivi », bloc Clôture). */
export interface SuiviClotureExercice {
  /** « CS avant AG » : comptes remis au conseil syndical. */
  comptesRemisAuCsLe: string | null
  /** « Rendu des comptes N » (🔴 sens à confirmer). */
  redditionComptesLe: string | null
}

export interface OptionsEcheancesExercice {
  exerciceId: string
  /** Assemblée appelée à approuver les comptes de l'exercice ; null : pas encore fixée. */
  dateAg: string | null
  /** Un conseil syndical est en fonction. */
  conseilSyndical: boolean
  suivi?: SuiviClotureExercice | null
  /** Décisions du syndicat (celles d'un autre syndicat sont ignorées). */
  decisions?: readonly DecisionAnnuelle[]
  /** Réglage du cabinet : jours d'avance de la remise des comptes au conseil syndical sur la convocation. */
  avanceRemiseCsJours?: number
  /** Délai de convocation du règlement s'il dépasse 21 jours (D. 1967 art. 9). */
  delaiConvocationJours?: number
  /** Régime du mandat de justice en cours ; absent ou null : aucun ou inconnu. */
  regime?: Regime | null
  /** Avec le régime 'ap291' : pouvoirs de l'assemblée confiés à l'administrateur provisoire (D. 1967 art. 7, al. 3). */
  pouvoirsAgConfies?: PouvoirsAgConfies | null
}

function verifierOptionsExercice(exercice: Exercice, options: OptionsEcheancesExercice): void {
  if (!options.exerciceId?.trim()) throw new Error("Échéances de l'exercice : identifiant de l'exercice attendu.")
  const dates: [string, string | null | undefined][] = [
    ["Date de l'assemblée des comptes", options.dateAg],
    ['Date de remise des comptes au conseil syndical', options.suivi?.comptesRemisAuCsLe],
    ['Date du rendu des comptes', options.suivi?.redditionComptesLe],
  ]
  for (const [quoi, valeur] of dates) {
    if (estAbsent(valeur)) continue
    verifierDate(valeur, quoi)
    if (valeur <= exercice.cloture)
      throw new Error(`${quoi} (${fr(valeur)}) antérieure ou égale à la clôture de l'exercice ${exercice.nom} (${fr(exercice.cloture)}).`)
  }
  const { avanceRemiseCsJours = 0, delaiConvocationJours = DELAI_CONVOCATION_JOURS } = options
  if (!Number.isInteger(avanceRemiseCsJours) || avanceRemiseCsJours < 0)
    throw new Error(`Jours d'avance de la remise au conseil syndical invalides (${avanceRemiseCsJours}) : entier positif attendu.`)
  if (!Number.isInteger(delaiConvocationJours) || delaiConvocationJours < DELAI_CONVOCATION_JOURS)
    throw new Error(`Délai de convocation invalide (${delaiConvocationJours}) : au moins ${DELAI_CONVOCATION_JOURS} jours.`)
}

const parDate = (a: EcheanceDecisionAnnuelle, b: EcheanceDecisionAnnuelle): number =>
  a.date.localeCompare(b.date) || a.code.localeCompare(b.code)

interface FormeEcheanceBudget {
  libelle: (limite: string) => string
  fondement: string
  aConfirmer: boolean
}

/** Qui décide du budget de l'exercice suivant : l'assemblée, l'administrateur provisoire investi de tous ses pouvoirs, ou selon l'ordonnance. */
const FORMES_ECHEANCE_BUDGET: Record<'assemblee' | 'administrateur' | 'selon_ordonnance', FormeEcheanceBudget> = {
  assemblee: {
    libelle: (limite) => `assemblée appelée à voter le budget, à réunir au plus tard le ${limite}`,
    fondement: 'L. 1965 art. 14-1, I, al. 1 ; D. 1967 art. 7, al. 1',
    aConfirmer: false,
  },
  administrateur: {
    libelle: (limite) =>
      `budget à décider par l'administrateur provisoire, investi de tous les pouvoirs de l'assemblée (pas d'assemblée annuelle obligatoire), au plus tard le ${limite} (délai de l'assemblée budgétaire, repère à confirmer)`,
    fondement: 'L. 1965 art. 14-1, I, al. 1 ; D. 1967 art. 7, al. 3',
    aConfirmer: true,
  },
  selon_ordonnance: {
    libelle: (limite) =>
      `budget à voter par l'assemblée ou à décider par l'administrateur provisoire, selon les pouvoirs que lui confie l'ordonnance, au plus tard le ${limite}`,
    fondement: 'L. 1965 art. 14-1, I, al. 1 ; D. 1967 art. 7, al. 1 et 3',
    aConfirmer: true,
  },
}

function formeEcheanceBudget({ regime = null, pouvoirsAgConfies = null }: OptionsEcheancesExercice): FormeEcheanceBudget {
  if (regime !== 'ap291' || pouvoirsAgConfies === 'aucun') return FORMES_ECHEANCE_BUDGET.assemblee
  if (pouvoirsAgConfies === 'tous') return FORMES_ECHEANCE_BUDGET.administrateur
  return FORMES_ECHEANCE_BUDGET.selon_ordonnance
}

/** Budget décidé après la clôture et au plus tard douze mois après (avant la clôture de l'exercice suivant). */
function budgetDecideApresCloture(exercice: Exercice, decisions: readonly DecisionAnnuelle[]): boolean {
  const limite = ajouterMois(exercice.cloture, 12)
  return decisions.some((d) => d.type === 'budget' && exercice.cloture < d.date && d.date <= limite)
}

function echeanceBudget(
  exercice: Exercice,
  options: OptionsEcheancesExercice,
  decisions: readonly DecisionAnnuelle[],
): EcheanceDecisionAnnuelle {
  const limite = ajouterMois(exercice.cloture, 6)
  const forme = formeEcheanceBudget(options)
  return {
    code: 'assemblee_budget',
    objetId: options.exerciceId,
    libelle: `Exercice ${exercice.nom} clos le ${fr(exercice.cloture)} : ${forme.libelle(fr(limite))}`,
    date: limite,
    fondement: forme.fondement,
    aConfirmer: forme.aConfirmer,
    accomplie: budgetDecideApresCloture(exercice, decisions),
  }
}

/**
 * Échéances de l'exercice : assemblée appelée à voter le budget dans les six mois de la clôture (ou décision de
 * l'administrateur provisoire investi de tous les pouvoirs de l'assemblée) ; avec la date de l'assemblée des comptes,
 * remise des comptes au conseil syndical (repère de gestion) et convocation (comptes notifiés, consultation des pièces
 * justificatives). Rien pour un exercice « Non géré ». Triées par date.
 */
export function echeancesExercice(exercice: Exercice, options: OptionsEcheancesExercice): EcheanceDecisionAnnuelle[] {
  verifierOptionsExercice(exercice, options)
  if (exercice.statut === 'Non géré') return []
  const { exerciceId, dateAg, conseilSyndical, suivi = null, avanceRemiseCsJours = 0 } = options
  const delai = options.delaiConvocationJours ?? DELAI_CONVOCATION_JOURS
  const decisions = (options.decisions ?? []).filter((d) => d.coproprieteId === exercice.coproprieteId)
  const echeances: EcheanceDecisionAnnuelle[] = [echeanceBudget(exercice, options, decisions)]
  if (dateAg === null) return echeances
  const convocation = ajouterJours(dateAg, -(delai + 1))
  const comptesApprouves = decisions.some((d) => d.type === 'approbation_comptes' && d.exerciceId === exerciceId)
  if (conseilSyndical)
    echeances.push({
      code: 'comptes_au_conseil_syndical',
      objetId: exerciceId,
      libelle: `Exercice ${exercice.nom} : comptes à remettre au conseil syndical avant la convocation de l'assemblée du ${fr(dateAg)} (repère de gestion, aucun délai légal)`,
      date: ajouterJours(convocation, -avanceRemiseCsJours),
      fondement: 'L. 1965 art. 18, II ; art. 21, al. 1 ; D. 1967 art. 26',
      aConfirmer: true,
      accomplie: !estAbsent(suivi?.comptesRemisAuCsLe),
    })
  echeances.push({
    code: 'convocation_comptes',
    objetId: exerciceId,
    libelle: `Exercice ${exercice.nom} : convocation de l'assemblée du ${fr(dateAg)}, avec l'état financier et le compte de gestion général, et les lieu, jours et heures de consultation des pièces justificatives`,
    date: convocation,
    fondement: 'D. 1967 art. 9, art. 9-1 et art. 11, I, 1° ; L. 1965 art. 18-1',
    aConfirmer: true,
    accomplie: comptesApprouves || !estAbsent(suivi?.redditionComptesLe),
  })
  return echeances.sort(parDate)
}

interface TermeSuivi {
  code: CodeEcheanceDecisionAnnuelle
  fondement: string
  libelle: (decision: DecisionAnnuelle, terme: string) => string
}

const TERMES_SUIVIS: Partial<Record<TypeDecisionAnnuelle, TermeSuivi>> = {
  mandat_syndic: {
    code: 'terme_mandat_syndic',
    fondement: 'L. 1965 art. 18, VI ; D. 1967 art. 29',
    libelle: (d, terme) =>
      `Mandat du syndic désigné le ${fr(d.date)} : terme le ${fr(terme)} ; un nouveau contrat exige une décision expresse de l'assemblée`,
  },
  mandat_cs: {
    code: 'terme_mandat_cs',
    fondement: 'D. 1967 art. 22, al. 3',
    libelle: (d, terme) => `Mandat des membres du conseil syndical désignés le ${fr(d.date)} : terme le ${fr(terme)}`,
  },
  delegation_generale_cs: {
    code: 'fin_delegation_cs',
    fondement: 'L. 1965 art. 21-3',
    libelle: (d, terme) =>
      `Délégation de pouvoirs au conseil syndical décidée le ${fr(d.date)} : fin le ${fr(terme)} ; renouvelable par décision expresse`,
  },
}

/**
 * Conseil syndical renouvelé : une désignation qui le porte au-delà de son terme et prend effet moins de six mois avant lui,
 * ou après, même sans reconduire chaque membre ; ou chacun de ses membres désigné de nouveau au-delà de ce terme. Une
 * élection complémentaire, alignée sur le terme ou de pleine durée plus tôt dans le mandat, ne le renouvelle pas.
 */
function conseilRenouvele(decision: DecisionAnnuelle, decisions: readonly DecisionAnnuelle[]): boolean {
  const suivantes = designationsAuDelaDuTerme(decision, decisions)
  if (decision.terme === null || suivantes.length === 0) return false
  const ouvertureFenetre = ajouterMois(decision.terme, -FENETRE_RENOUVELLEMENT_CS_MOIS)
  return suivantes.some((d) => debutDecision(d) > ouvertureFenetre) || membresTousRedesignes(decision, suivantes)
}

/** Renouvelée : une décision plus récente du même type ; pour le conseil syndical, voir conseilRenouvele. */
function estRenouvelee(decision: DecisionAnnuelle, decisions: readonly DecisionAnnuelle[]): boolean {
  if (decision.type === 'mandat_cs') return conseilRenouvele(decision, decisions)
  return decisions.some((d) => d.type === decision.type && d.id !== decision.id && debutDecision(d) > debutDecision(decision))
}

function echeanceDuTerme(
  decision: DecisionAnnuelle,
  decisions: readonly DecisionAnnuelle[],
  fins: readonly FinMandatSyndic[],
): EcheanceDecisionAnnuelle[] {
  const suivi = TERMES_SUIVIS[decision.type]
  const { terme } = decision
  if (suivi === undefined || terme === null) return []
  const echeance: EcheanceDecisionAnnuelle = {
    code: suivi.code,
    objetId: decision.id,
    libelle: suivi.libelle(decision, terme),
    date: terme,
    fondement: suivi.fondement,
    aConfirmer: false,
    accomplie: true,
  }
  if (estRenouvelee(decision, decisions)) return [echeance]
  const fin = finDuMandat(decision, fins, terme)
  if (fin === undefined) return [{ ...echeance, accomplie: false }]
  const { libelle, fondement } = FINS_MANDAT_SYNDIC[fin.motif]
  return [
    {
      ...echeance,
      libelle: `Mandat du syndic désigné le ${fr(decision.date)} : fin le ${fr(fin.date)} (${libelle}), avant son terme du ${fr(terme)}`,
      fondement,
    },
  ]
}

/**
 * Termes des mandats du syndic et du conseil syndical, fin de la délégation générale au conseil syndical. Un mandat du
 * syndic cessé avant son terme (`options.finsMandatSyndic`) a son échéance close. Triés par date.
 */
export function echeancesMandatsEtDelegations(
  decisions: readonly DecisionAnnuelle[],
  options: OptionsMandats = {},
): EcheanceDecisionAnnuelle[] {
  verifierUnSyndicat(decisions)
  const fins = verifierFins(options.finsMandatSyndic)
  return decisions.flatMap((decision) => echeanceDuTerme(decision, decisions, fins)).sort(parDate)
}
