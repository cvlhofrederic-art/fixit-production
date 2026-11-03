import { etatNotificationCourrier, type CourrierSuivi, type EtatNotificationCourrier } from '@/lib/administrateur-judiciaire/domain/courriers'
import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { seuilsAtteints, type DecisionAnnuelle } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import {
  controleDeclaratifDemande,
  estRefusee,
  montantHtOperationDemande,
  prevuDemande,
  verifierSansBloquant,
  type Demande,
  type OptionsControleDeclaratif,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import { creerRattachement, FICHES_PORTEUSES, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { MAJORITES_AG, type TypeMajorite } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import { ROLES_CABINET, type RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import type { ElementAFaire } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'
import {
  SEUIL_VIGILANCE_HT_CENTIMES,
  type AnomalieEntreprise,
  type CodeAnomalieEntreprise,
  type PiecesEntreprise,
} from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import type { DemandeEnvoiOrdre, UrgenceOrdreAJ } from '@/lib/administrateur-judiciaire/ordres-prestataire'
import type { FormeEnvoiCourrier } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Ordres de service : numérotation, visa de sortie, envoi et journal de diffusion (point 44 du bilan 2, partie domaine).
 * Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, heures HH:MM, sans écran ni table. L'état d'envoi d'une
 * demande (SortieOrdreService) est un objet FRÈRE de la Demande (demandes.ts, point 43), lié par demandeId : l'interface
 * Demande n'est pas modifiée. Aucune donnée personnelle : signataire, viseurs, collaborateurs et destinataires sont des
 * identifiants.
 *
 * Gestéam — 🟢 lu :
 * - tranche 34 § Fiche : N° au format <mandat>.<plan>.<n°> (numéro d'ordre de service) ; suivi interne : Signature
 *   (signataire pour le cabinet), Délai (ex. Urgent), Envoi (ex. E-mail), Relance (date), bouton Diffuser ; § Onglet Suivi,
 *   bloc Diffusion : Diffusable, Fax / SMS envoyés, journal horodaté des envois (date, heure, collaborateur, canal,
 *   destinataire) ; critères de recherche Visa de sortie et Référence diffusion. Les listes Délai, Envoi et Signature n'ont
 *   pas été ouvertes, le bouton Délégation n'a pas été cliqué ;
 * - tranche 40 : référentiel Visa de sortie, 5 valeurs (Demande de visa, Visa refusé, Visa nécessaire, Visa donné, Sortie
 *   libre) ; la tranche en déduit (🔵) un circuit d'approbation avant envoi : sortie libre, ou visa demandé puis donné ou
 *   refusé ;
 * - tranche 20 et tranche 43 § 15 : Visa de sortie et Référence diffusion sont aussi des critères des courriers (le visa
 *   vaut pour tout document de sortie : circuit écrit ici pour être réutilisé) ; l'exécution forcée par huissier suit le
 *   même circuit que les OS (envoi, suivi, facture).
 *
 * VitFix avant ce point : ordres-prestataire.ts (referenceAj libre, urgence, un seul canal, la messagerie VitFix ;
 * StatutOrdreMission suit la réponse du prestataire, gardé tel quel : le silence ne vaut pas acceptation, C. civ. art.
 * 1120) ; CircuitValidationModule.tsx (préparé → vérifié par le juriste → validé et signé par la direction : démonstration
 * sans persistance) ; ROLES_CABINET (roles-cabinet.ts), base du rôle de viseur.
 *
 * Le droit — relevé du 30/10/2026 (Légifrance, textes lus) :
 * - fondement de l'OS (FondementOs) : le syndic, donc l'administrateur provisoire qui reçoit ses pouvoirs (L. 1965 art.
 *   29-1, I), assure l'exécution des délibérations de l'assemblée, administre l'immeuble et, en cas d'urgence, fait
 *   procéder de sa propre initiative aux travaux nécessaires à la sauvegarde (L. 1965 art. 18, I) ; il représente le
 *   syndicat dans les actes civils, si bien que l'OS signé engage le syndicat (🔵) ; après des travaux urgents, il informe
 *   les copropriétaires et convoque immédiatement une assemblée ; en vue de l'ouverture du chantier et de son premier
 *   approvisionnement, il peut demander, sans délibération préalable de l'assemblée mais après avis du conseil syndical
 *   s'il en existe un, une provision d'au plus le tiers du devis estimatif (D. 1967 art. 37) ; un OS peut aussi exécuter
 *   une décision du conseil syndical délégataire, consignée dans un procès-verbal signé par deux membres (L. 1965 art.
 *   21-1, 21-5 ; D. 1967 art. 21-1) : la délégation est décidée par l'assemblée pour un conseil d'au moins trois membres
 *   (L. 1965 art. 21-1), pour un montant maximum fixé par elle (art. 21-2), pour deux ans au plus, renouvelable par
 *   décision expresse (art. 21-3) ; une délégation à une fin déterminée peut aussi être donnée au conseil syndical (art.
 *   25 a) ; les décisions de l'administrateur provisoire sont mentionnées, à leur date, au registre (D. 1967 art. 62-8) ;
 * - exécution d'une résolution : sauf urgence, l'exécution des travaux décidés par l'assemblée en application des art. 25
 *   et 26 est suspendue jusqu'à l'expiration du délai de contestation de deux mois (L. 1965 art. 42, al. 3) : BLOQUANT
 *   quand l'intervention prévue (à défaut, l'envoi) tombe dans ce délai, alerte quand la majorité ou la fin du délai
 *   manquent ;
 * - déclencheurs légaux du visa (MotifVisa ; intervention seulement : une demande de devis ne conclut aucun marché) :
 *   seuil de consultation du conseil syndical et seuil de mise en concurrence fixés par l'assemblée, obligatoires « à
 *   partir » de ces montants (L. 1965 art. 21, al. 2 ; sans conditions fixées par l'assemblée, la mise en concurrence
 *   résulte de la demande de plusieurs devis ou d'un devis descriptif soumis à plusieurs entreprises : D. 1967 art. 19-2),
 *   comparés au prévu TTC (décision J6 de Hugo du 30/10/2026 ; seuilsAtteints de decisions-annuelles-ag.ts, lu sans
 *   modification) ; convention à autoriser spécialement par l'assemblée : avec le syndic, ses préposés, son conjoint, le
 *   partenaire lié à lui par un pacte civil de solidarité, son concubin, ses parents ou alliés jusqu'au deuxième degré
 *   inclus, avec une entreprise dont ces personnes sont propriétaires ou associées, qu'elles dirigent ou contrôlent, ou
 *   dont elles sont salariées ou préposées, et, pour un syndic personne morale, avec une entreprise qui détient une
 *   participation dans son capital (D. 1967 art. 39) ; non autorisée, la convention avec une personne ou une entreprise
 *   avec laquelle le syndic a des liens de nature capitalistique ou juridique n'est pas opposable au syndicat (L. 1965 art.
 *   18-1 A, II) : BLOQUANT sans référence de l'autorisation ; avis préalable du conseil syndical quand l'administrateur
 *   provisoire décide au titre des pouvoirs de l'assemblée, sauf urgence, et précision du mode de financement à cette
 *   occasion (D. 1967 art. 62-7, al. 1 ; art. 62-7, al. 3) : BLOQUANT sans avis recueilli au plus tard le jour de la décision
 *   inscrite au registre (à défaut de date saisie, le jour de l'envoi, signalé), alerte sans mode de financement
 *   (application aux OS 🔵) ;
 * - preuve : le contrat est conclu quand l'acceptation parvient à l'offrant (C. civ. art. 1121) ;
 *   hors les cas prévus aux art. 1125 et 1126, la remise d'un écrit électronique est effective lorsque le destinataire,
 *   après avoir pu en prendre connaissance, en a accusé réception (C. civ. art. 1127-4) : le journal distingue l'envoi de
 *   la réception, pour tous les canaux (nature
 *   « reception ») ; le courriel est admis pour une entreprise qui a communiqué son adresse électronique ou accepté ce
 *   moyen (C. civ. art. 1126, 1127, al. 1 ; 🔵 pour l'OS) ; le SMS est un courrier électronique (loi n° 2004-575 du 21
 *   juin 2004, art. 1er, IV) : même contrôle que le courriel (🔵) ;
 * - un OS qui modifie le devis vaut offre nouvelle (C. civ. art. 1118, al. 3) et l'offre est caduque à l'expiration du
 *   délai fixé par son auteur (C. civ. art. 1117, al. 1) (🔵) : après le premier envoi, la sortie et son visa sont figés ;
 *   un devis associé échu avant que l'OS parvienne à l'entreprise est signalé ;
 * - AUCUN TEXTE pour la numérotation, le référentiel des visas, le refus d'envoyer sans visa, le signataire, le délai, la
 *   relance ni le journal : règles de gestion. Aucun texte lu ne fixe la forme ni le canal d'envoi d'un OS (🔵 : les formes
 *   de D. 1967 art. 64 visent les notifications et mises en demeure).
 *
 * 🔵 Déduit (règles de ce module) :
 * - N° : séquence PAR MANDAT (plus grand rang du segment mandat + 1, tous plans confondus), attribué une fois puis figé ;
 *   un N° hors du format, ou d'un autre segment mandat que celui de la séquence (segmentMandat), est signalé hors
 *   séquence, un N° déjà porté par une autre demande du mandat (numerosDuMandat) est signalé en double, jamais
 *   renuméroté ; corps de la messagerie VitFix : bornes de ajOrdrePrestataireSchema (lib/validation.ts) sur les champs tirés
 *   de la demande, N° (reference_aj) de 50 caractères au plus, objet requis et de 200 caractères au plus (bloquants au
 *   contrôle avant l'envoi, erreur dans demandeEnvoiDepuisOs) ;
 * - visa : « Sortie libre » sans motif, sinon « Visa nécessaire » ; nécessaire ou refusé → demandé → donné ou refusé ;
 *   un collaborateur peut exiger un visa sur une sortie libre ; la demande soumise au visa, puis visée, est figée par une
 *   empreinte (prévu, entreprise, objet, nature, devis associé) : à la revue, un visa demandé ou donné, ou une sortie
 *   libre, repasse à « Visa nécessaire » quand un motif nouveau apparaît ou que la demande ne correspond plus à
 *   l'empreinte, et le contrôle avant l'envoi le bloque ; seuls « Visa donné » et « Sortie libre » permettent l'envoi ;
 *   aucun événement du visa ne précède la demande, et le premier envoi ne précède pas le dernier événement du visa ;
 * - viseur : un rôle de rolesViseurs (Direction par défaut, d'après CircuitValidationModule : « validé et signé par la
 *   direction »), autre que le collaborateur qui a demandé le visa ; le refus est motivé ;
 * - premier envoi : à l'entreprise de la demande, par le canal choisi, après controlerAvantEnvoiOs ; les envois suivants
 *   sont des rediffusions (copie à une fiche porteuse) d'un OS diffusable ; « Diffusable » se règle avant comme après le
 *   premier envoi (marquerDiffusable) ; relance et réception concernent l'entreprise du premier envoi ; horodatages
 *   croissants ; preuve propre au canal : missionId pour la messagerie VitFix, courrierId pour le courrier AR (état de
 *   notification tiré de courriers.ts) ;
 * - date de relance : jamais avant la demande (refusée à la création), ni avant le premier envoi (refusée après l'envoi ;
 *   avant l'envoi, une date antérieure bloque celui-ci) ;
 * - canaux « courriel » et « sms » : bloquant si l'entreprise n'a pas communiqué la coordonnée, alerte si on ne le sait
 *   pas ;
 * - caducité du devis associé : appréciée quand l'OS parvient à l'entreprise ; le jour de l'envoi pour la messagerie, le
 *   courriel et le SMS ; pour le courrier simple ou AR, qui ne parvient pas le jour même, une fin de validité au jour de
 *   l'envoi ou avant est signalée (à confirmer) ; à la réception enregistrée, devisCaducALaReception ;
 * - contrôle déclaratif (point 37) avant l'envoi d'une intervention, avec les gravités de vigilance-entreprises.ts : c'est le
 *   blocage de l'envoi que le point 37 renvoie au 44 ; pièces non fournies : bloquant si l'opération atteint le seuil de
 *   vigilance, si son montant HT est inconnu ou si la décennale est obligatoire, sinon alerte ;
 * - urgence DÉCLARÉE : délai « urgence » ou fondement « urgence de sauvegarde », AVEC un motif (alerte sans motif) ; elle
 *   seule lève l'avis préalable de D. 1967 art. 62-7 et la suspension de L. 1965 art. 42, al. 3 ; un motif saisi sans
 *   délai « urgence » est signalé (alerte) et ne lève rien ;
 * - convention liée sous administration provisoire : le « syndic » de D. 1967 art. 39 est l'administrateur provisoire,
 *   ses « préposés » les collaborateurs du cabinet ; la réponse sur le lien (entrepriseLiee) vaut pour l'entreprise de la
 *   demande au moment où elle est saisie (entrepriseLieeDeclareePour) : l'entreprise changée, la réponse est périmée
 *   (bloquant jusqu'à ce qu'elle soit redite, ni motif de visa ni autorisation tirés d'elle) ; l'autorisation spéciale de
 *   l'assemblée vise la convention avec une entreprise : elle vaut pour l'entreprise de la demande au moment où elle est
 *   saisie (autorisationConventionLieePour), que la réponse sur le lien soit alors connue ou non ; pour une autre
 *   entreprise elle ne compte pas (bloquant convention_liee_non_autorisee), et redire la réponse sur le lien pour une autre
 *   entreprise que celle de l'autorisation efface celle-ci ;
 * - date de la décision qui fonde l'OS (decisionLe : résolution, procès-verbal du conseil syndical, registre des
 *   décisions de l'administrateur provisoire, mentionnées « à leur date » : D. 1967 art. 62-8) postérieure à l'envoi :
 *   bloquant, l'OS ne part pas avant la décision qu'il exécute ;
 * - conseil syndical délégataire : alerte à confirmer quand aucune délégation (générale, ou de l'art. 25 a au conseil
 *   syndical) ne figure dans les décisions d'assemblée en vigueur fournies ;
 * - majorité de la résolution exécutée : « art25 » aussi pour une décision de l'art. 25 adoptée au second vote de l'art.
 *   25-1 ;
 * - relance due (suivi « à faire ») : assignée au collaborateur du premier envoi.
 *
 * 🔴 Non établi — questions :
 * - Hugo : sens du segment <plan> du N° ; séquence par mandat (retenue) ou par mandat et plan ; N° attribué à la création ou
 *   au premier envoi ; rang complété de zéros ?
 * - Hugo : valeurs des listes Délai, Envoi et Signature (tranche 34) ; ici, Délai = UrgenceOrdreAJ, Envoi = CANAUX_ENVOI_OS.
 * - Hugo : la relance vise-t-elle seulement la réponse à l'OS, ou aussi l'accusé et le rapport (« Accusé demandé »,
 *   « Rapport demandé ») ?
 * - Hugo : le visa des courriers (tranche 20) suit-il le même circuit ?
 * - Frédéric : quand un visa de gestion est-il nécessaire (seuil, natures, exécution forcée : aucun par défaut) et quels
 *   rôles visent (Direction par défaut ; Juridique ?) ; le rédacteur ou le signataire peut-il viser ; un visa donné
 *   tombe-t-il quand l'OS change (oui ici) ?
 * - Frédéric ou Hugo : les seuils de L. 1965 art. 21, al. 2 déclenchent-ils le visa automatiquement (oui ici) ? Sans montant
 *   fixé par l'assemblée, la consultation n'est pas obligatoire : faut-il un seuil par défaut du cabinet
 *   (seuilPrevuTtcCentimes, règle de gestion) ?
 * - Hugo : L. 1965 art. 21, al. 6 (pas de conseil syndical : mise en concurrence non obligatoire) vaut-il pour les marchés
 *   de travaux ? Le motif « mise en concurrence » est gardé ici. Les conditions fixées par l'assemblée se réduisent-elles à
 *   un nombre de devis (devisExigesParAssemblee) ?
 * - Hugo : critère de l'avis préalable sous administration provisoire (D. 1967 art. 62-7) : un OS d'entretien courant, ou qui
 *   exécute une décision déjà prise, relève des pouvoirs du syndic (sans avis) ; des travaux décidés au titre des pouvoirs
 *   de l'assemblée exigent l'avis, sauf urgence. Juste ? Qui constate l'urgence (motifUrgence) ? Un délai « prioritaire »
 *   motivé vaut-il urgence (non ici) ?
 * - Hugo : L. 1965 art. 42, al. 3 : bloquant (retenu) ou alerte ? L'intervention d'une entreprise qui exécute une
 *   résolution des art. 25 ou 26 est-elle toujours une exécution de « travaux » (oui ici) ? Une décision prise à
 *   l'unanimité relève-t-elle de la suspension (non ici) ?
 * - Hugo : un collaborateur peut-il signer l'OS, ou seulement l'administrateur désigné (L. 1965 art. 18, IV ; art. 29-1,
 *   I) ? (liste signatairesHabilites au choix de l'appelant ; textes sur l'habilitation des collaborateurs non lus)
 * - non établi : l'administrateur provisoire investi des pouvoirs de l'assemblée peut-il autoriser lui-même une convention
 *   liée ? (la référence d'une autorisation est exigée ici) Le « syndic » de D. 1967 art. 39 est-il bien l'administrateur
 *   provisoire, et ses « préposés » les collaborateurs du cabinet (oui ici) ?
 * - Frédéric : la fiche entreprise portera-t-elle le lien avec le cabinet ou le syndic ? Sinon entrepriseLiee se déclare à
 *   la main, pour l'entreprise de la demande (alerte tant qu'il est inconnu, bloquant quand l'entreprise a changé depuis
 *   la réponse).
 * - Hugo ou Frédéric : délégation du conseil syndical appréciée sur les décisions fournies (decisionsAgEnVigueur, à la date
 *   de l'envoi), et non à la date de la décision du conseil syndical (decisionLe) : l'appelant doit-il fournir les
 *   décisions en vigueur à cette date ? Le prévu n'est pas comparé au montant maximum alloué au conseil syndical (L. 1965
 *   art. 21-2 : enveloppe_delegation_cs, annuelle et cumulée ; plafond_travaux_cs, par dépense) : quel cumul retenir ?
 * - Hugo, preuve : la réception distincte de l'envoi convient-elle ? Quelle preuve pour un courrier papier (simple ou
 *   recommandé) ? La première présentation d'un AR (décision J1) vaut-elle réception de l'OS au sens de C. civ. art. 1121 ?
 *   Quel délai d'acheminement d'un courrier retenir pour la caducité du devis (jour même ici) ?
 * - vigilance du code du travail (relevée au point 43, non relue le 30/10/2026) : bloquante avant l'envoi par le contrôle
 *   déclaratif, y compris quand les pièces ne sont pas fournies, à confirmer.
 *
 * Branchements à faire plus tard (fichiers non modifiés) : suivi-a-faire.ts, famille « demandes » et nature « relance_os »
 * (relancesOsDues, point 46) ; route /api/administrateur-judiciaire/ordres-prestataire : controlerAvantEnvoiOs avant
 * l'envoi (avec segmentMandat, numerosDuMandat, decisionsAgEnVigueur et finDelaiContestationAg, échéance retenue par
 * finDelaiContestationAg de statut-assemblee.ts), corps par demandeEnvoiDepuisOs, puis envoyerOs avec le missionId créé ;
 * devisCaducALaReception après enregistrerReception ; VISAS_SORTIE, CANAUX_ENVOI_OS et FORME_ENVOI_PAR_CANAL vers
 * referentiels-gesteam-judiciaire.ts ; table de SortieOrdreService et écran (Frédéric).
 */

// ─── Référentiels ─────────────────────────────────────────────────────────────────────────────

export const VISAS_SORTIE = ['Demande de visa', 'Visa refusé', 'Visa nécessaire', 'Visa donné', 'Sortie libre'] as const
export type VisaSortie = (typeof VISAS_SORTIE)[number]

/** Visas qui laissent partir l'ordre de service (🔵). */
export const VISAS_PERMETTANT_ENVOI: ReadonlySet<VisaSortie> = new Set<VisaSortie>(['Visa donné', 'Sortie libre'])

/** Canal d'envoi (liste « Envoi » non ouverte, 🔴) : la messagerie VitFix, puis les formes d'envoi des courriers. */
export const CANAUX_ENVOI_OS = ['messagerie_vitfix', 'courriel', 'courrier', 'courrier_ar', 'sms'] as const
export type CanalEnvoiOs = (typeof CANAUX_ENVOI_OS)[number]
const CANAUX: ReadonlySet<string> = new Set(CANAUX_ENVOI_OS)

/** Canaux papier : le pli ne parvient pas à l'entreprise le jour de l'envoi (🔵). */
const CANAUX_PAPIER: ReadonlySet<CanalEnvoiOs> = new Set<CanalEnvoiOs>(['courrier', 'courrier_ar'])

/** Forme d'envoi Gestéam (FORME_ENVOI_COURRIER) de chaque canal hors messagerie VitFix. */
export const FORME_ENVOI_PAR_CANAL: Readonly<Record<Exclude<CanalEnvoiOs, 'messagerie_vitfix'>, FormeEnvoiCourrier>> = {
  courriel: 'Email',
  courrier: 'Normal',
  courrier_ar: 'AR',
  sms: 'SMS',
}

export const NATURES_DIFFUSION = ['envoi', 'rediffusion', 'relance', 'reception'] as const
export type NatureDiffusion = (typeof NATURES_DIFFUSION)[number]

export const ACTIONS_VISA = ['exige', 'demande', 'donne', 'refuse', 'revu'] as const
export type ActionVisa = (typeof ACTIONS_VISA)[number]

export const FONDEMENTS_OS = [
  'execution_resolution_ag',
  'decision_conseil_syndical',
  'administration_courante',
  'urgence_sauvegarde',
  'decision_aj_pouvoirs_ag',
] as const
export type FondementOs = (typeof FONDEMENTS_OS)[number]
const FONDEMENTS: ReadonlySet<string> = new Set(FONDEMENTS_OS)

/** Texte du fondement, et référence attendue (résolution, procès-verbal du conseil syndical, registre des décisions). */
const CADRE_PAR_FONDEMENT: Readonly<Record<FondementOs, { libelle: string; texte: string; referenceAttendue: boolean }>> = {
  execution_resolution_ag: { libelle: "exécution d'une résolution d'assemblée", texte: 'L. 1965 art. 18, I', referenceAttendue: true },
  decision_conseil_syndical: {
    libelle: 'décision du conseil syndical délégataire',
    texte: 'L. 1965 art. 21-1, 21-5 ; D. 1967 art. 21-1',
    referenceAttendue: true,
  },
  administration_courante: { libelle: "administration et entretien de l'immeuble", texte: 'L. 1965 art. 18, I', referenceAttendue: false },
  urgence_sauvegarde: { libelle: 'travaux urgents de sauvegarde', texte: 'L. 1965 art. 18, I ; D. 1967 art. 37', referenceAttendue: false },
  decision_aj_pouvoirs_ag: {
    libelle: "décision de l'administrateur provisoire au titre des pouvoirs de l'assemblée",
    texte: 'L. 1965 art. 29-1, I ; D. 1967 art. 62-7, 62-8',
    referenceAttendue: true,
  },
}

/** Majorités dont les travaux ne s'exécutent pas pendant le délai de contestation (L. 1965 art. 42, al. 3), et leur article. */
const MAJORITES_SUSPENSIVES: ReadonlyMap<TypeMajorite, string> = new Map<TypeMajorite, string>([
  ['art25', 'art. 25'],
  ['art26', 'art. 26'],
])

const DELAIS: ReadonlySet<string> = new Set<UrgenceOrdreAJ>(['normale', 'prioritaire', 'urgence'])
const ROLES: ReadonlySet<string> = new Set(ROLES_CABINET)
const DESTINATAIRES: ReadonlySet<string> = new Set(FICHES_PORTEUSES)

/** Borne de reference_aj (ajOrdrePrestataireSchema, lib/validation.ts). */
export const LONGUEUR_MAX_NUMERO_OS = 50
/** Borne de objet (ajOrdrePrestataireSchema, lib/validation.ts : requis, 200 caractères au plus après suppression des espaces). */
export const LONGUEUR_MAX_OBJET_OS = 200
/** « Plusieurs devis » (D. 1967 art. 19-2) : au moins deux (🔵). */
export const NOMBRE_MIN_DEVIS_CONCURRENCE = 2

const FONDEMENT_CONSULTATION = 'L. 1965 art. 21, al. 2 ; D. 1967 art. 26'
const FONDEMENT_CONCURRENCE = 'L. 1965 art. 21, al. 2 ; D. 1967 art. 19-2'
const FONDEMENT_CONDITIONS_AG = 'L. 1965 art. 21, al. 2'
const FONDEMENT_CONVENTION_LIEE = 'L. 1965 art. 18-1 A, II ; D. 1967 art. 39'
const FONDEMENT_LIEN = 'D. 1967 art. 39 ; L. 1965 art. 18-1 A, II'
const FONDEMENT_AVIS_AJ = 'L. 1965 art. 29-1, I ; D. 1967 art. 62-7'
const FONDEMENT_COURRIEL = 'C. civ. art. 1126, 1127, al. 1'
const FONDEMENT_SMS = 'C. civ. art. 1126, 1127, al. 1 ; loi n° 2004-575 du 21 juin 2004, art. 1er, IV'
const FONDEMENT_SUSPENSION = 'L. 1965 art. 42, al. 3'
const FONDEMENT_DELEGATION_CS = 'L. 1965 art. 21-1, 21-3, 25 a'
const FONDEMENT_CADUCITE = 'C. civ. art. 1117, al. 1 ; art. 1121'
const FONDEMENT_VIGILANCE = 'C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5'
const FONDEMENT_DECENNALE = 'C. ass. art. L. 241-1, L. 243-2'

// ─── Outils ───────────────────────────────────────────────────────────────────────────────────

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

const fr = dateIsoVersFr

const texteOuNull = (valeur: string | null | undefined): string | null => {
  const texte = (valeur ?? '').trim()
  return texte === '' ? null : texte
}

/** Valeur saisie, ou valeur actuelle quand le champ n'est pas fourni. */
const garder = <T>(nouveau: T | undefined, actuel: T): T => (nouveau === undefined ? actuel : nouveau)

const messageErreur = (erreur: unknown): string => (erreur instanceof Error ? erreur.message : String(erreur))

function verifierDate(libelle: string, valeur: string | null | undefined): void {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`${libelle} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
}

function verifierNombre(libelle: string, valeur: number | null, minimum: number): void {
  if (valeur !== null && (!Number.isInteger(valeur) || valeur < minimum)) throw new Error(`${libelle} invalide (${valeur}) : entier à partir de ${minimum} attendu.`)
}

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

function verifierHorodatage(libelle: string, date: string, heure: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${libelle} : date invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (!HEURE.test(heure)) throw new Error(`${libelle} : heure invalide (${heure}) : HH:MM attendu.`)
}

const horodatage = (e: { date: string; heure: string }): string => `${e.date} ${e.heure}`

const horodatageFr = (e: { date: string; heure: string }): string => `${fr(e.date)} ${e.heure}`

// ─── Numérotation <mandat>.<plan>.<rang> ──────────────────────────────────────────────────────

export interface SegmentsNumeroOs {
  /** Code du mandat dans le N° (🔴 sens exact des segments à confirmer). */
  mandat: string
  plan: string
}

export interface NumeroOs extends SegmentsNumeroOs {
  rang: number
}

const SEGMENT_NUMERO = /^[^.\s]+$/
const NUMERO_OS = /^([^.\s]+)\.([^.\s]+)\.(\d{1,9})$/

/** N° « mandat.plan.rang » : segments non vides sans point ni espace, rang entier ≥ 1, au plus 50 caractères. */
export function formaterNumeroOs({ mandat, plan, rang }: NumeroOs): string {
  const segments: [string, string][] = [
    ['mandat', mandat],
    ['plan', plan],
  ]
  for (const [libelle, segment] of segments)
    if (!SEGMENT_NUMERO.test(segment)) throw new Error(`Segment « ${libelle} » du N° d'OS invalide (« ${segment} ») : non vide, sans point ni espace.`)
  if (!Number.isInteger(rang) || rang < 1) throw new Error(`Rang du N° d'OS invalide (${rang}) : entier à partir de 1 attendu.`)
  const numero = `${mandat}.${plan}.${rang}`
  if (numero.length > LONGUEUR_MAX_NUMERO_OS)
    throw new Error(`N° d'OS « ${numero} » trop long : ${LONGUEUR_MAX_NUMERO_OS} caractères au plus (reference_aj).`)
  return numero
}

/** Segments d'un N° « mandat.plan.rang » ; null pour un N° libre ou repris d'ailleurs. */
export function lireNumeroOs(numero: string | null): NumeroOs | null {
  const lu = NUMERO_OS.exec((numero ?? '').trim())
  if (!lu) return null
  const rang = Number(lu[3])
  return rang >= 1 ? { mandat: lu[1], plan: lu[2], rang } : null
}

/** Rang suivant dans la séquence du mandat : le plus grand rang de ce segment mandat, tous plans confondus, + 1. */
export function rangOsSuivant(numeros: readonly (string | null)[], mandat: string): number {
  const rangs = numeros.flatMap((numero) => {
    const lu = lireNumeroOs(numero)
    return lu?.mandat === mandat ? [lu.rang] : []
  })
  return rangs.reduce((plusGrand, rang) => Math.max(plusGrand, rang), 0) + 1
}

/**
 * Numérote la demande (copie) dans la séquence de son mandat. Refusé si un N° est déjà posé (figé), sans mandat, sur une
 * demande terminée, ou si la liste reçue contient une demande d'un autre mandat.
 */
export function numeroterDemande(d: Demande, demandesDuMandat: readonly Demande[], segments: SegmentsNumeroOs): Demande {
  if (d.numero !== null) throw new Error(`Demande ${d.id} : N° d'OS « ${d.numero} » déjà attribué, il est figé.`)
  if (d.mandatId === null) throw new Error(`Demande ${d.id} sans mandat : la séquence des N° d'OS est celle du mandat.`)
  if (d.statut === 'Terminé') throw new Error(`Demande ${d.id} terminée : plus de numérotation.`)
  const etrangere = demandesDuMandat.find((autre) => autre.mandatId !== d.mandatId)
  if (etrangere) throw new Error(`Demande ${etrangere.id} d'un autre mandat dans la séquence du mandat ${d.mandatId}.`)
  const rang = rangOsSuivant(
    demandesDuMandat.map((autre) => autre.numero),
    segments.mandat,
  )
  return { ...d, numero: formaterNumeroOs({ ...segments, rang }) }
}

// ─── Sortie de l'ordre de service ─────────────────────────────────────────────────────────────

export interface EvenementVisa {
  date: string
  heure: string
  collaborateurId: string
  role: RoleCabinet
  action: ActionVisa
  motif: string | null
}

export interface SaisieEvenementVisa {
  date: string
  heure: string
  collaborateurId: string
  role: RoleCabinet
  motif?: string | null
}

/** Ligne du journal de diffusion (tranche 34 : date, heure, collaborateur, canal, destinataire). */
export interface EvenementDiffusion {
  date: string
  heure: string
  collaborateurId: string
  canal: CanalEnvoiOs
  /** Fiche porteuse destinataire ; pour une réception, l'entreprise qui en accuse réception. */
  destinataire: Rattachement
  nature: NatureDiffusion
  /** Référence diffusion (routeur, numéro de pli). */
  referenceDiffusion: string | null
  /** Courrier lié (courriers.ts), exigé pour le courrier AR. */
  courrierId: string | null
  /** Mission syndic_missions créée par la route, exigée pour la messagerie VitFix. */
  missionId: string | null
}

export interface SaisieDiffusion {
  date: string
  heure: string
  collaborateurId: string
  canal: CanalEnvoiOs
  destinataire: Rattachement
  referenceDiffusion?: string | null
  courrierId?: string | null
  missionId?: string | null
}

export interface JustificatifsOs {
  /** Avis du conseil syndical recueilli le (L. 1965 art. 21, al. 2 ; D. 1967 art. 62-7). */
  avisConseilSyndicalLe: string | null
  /** Mode de financement précisé lors de la consultation par l'administrateur provisoire (D. 1967 art. 62-7, al. 3). */
  modeFinancement: string | null
  /** Nombre de devis demandés, ou d'entreprises consultées sur un devis descriptif (D. 1967 art. 19-2). */
  devisDemandes: number | null
  /**
   * Nombre de devis exigé par les conditions de mise en concurrence fixées par l'assemblée (L. 1965 art. 21, al. 2) ;
   * null : aucune condition fixée, plusieurs devis (D. 1967 art. 19-2).
   */
  devisExigesParAssemblee: number | null
  /**
   * Référence de la résolution qui autorise la convention liée (L. 1965 art. 18-1 A, II ; D. 1967 art. 39) ; elle vaut pour
   * l'entreprise de la demande au moment où elle est saisie (SortieOrdreService.autorisationConventionLieePour).
   */
  autorisationConventionLiee: string | null
}

export interface SortieOrdreService {
  demandeId: string
  /** Signature : signataire pour le cabinet. */
  signataireId: string | null
  /** Délai (🔵 liste non ouverte : l'urgence de l'écran Ordres de service). */
  delai: UrgenceOrdreAJ
  motifUrgence: string | null
  /** Envoi : canal choisi pour le premier envoi. */
  canal: CanalEnvoiOs | null
  diffusable: boolean
  relanceLe: string | null
  fondement: FondementOs | null
  /** Résolution, procès-verbal du conseil syndical ou registre des décisions qui fonde l'OS. */
  fondementReference: string | null
  /**
   * Date de la décision qui fonde l'OS : résolution, procès-verbal du conseil syndical, ou mention au registre des
   * décisions de l'administrateur provisoire (D. 1967 art. 62-8).
   */
  decisionLe: string | null
  /** Majorité de la résolution exécutée (L. 1965 art. 42, al. 3) ; null : non renseignée. */
  majoriteResolution: TypeMajorite | null
  /**
   * Convention liée au sens de D. 1967 art. 39 : avec le syndic (ici l'administrateur provisoire), ses préposés, son
   * conjoint, partenaire de PACS ou concubin, ses parents ou alliés jusqu'au deuxième degré, avec une entreprise dont l'une
   * de ces personnes est propriétaire ou associée, qu'elle dirige ou contrôle, ou dont elle est salariée ou préposée, ou,
   * pour un syndic personne morale, avec une entreprise qui détient une participation dans son capital ; null : non
   * renseigné.
   */
  entrepriseLiee: boolean | null
  /**
   * Entreprise (prestataireId de la demande) à laquelle répondait entrepriseLiee quand elle a été saisie : la réponse ne
   * vaut pas pour une autre entreprise (lienEntreprise).
   */
  entrepriseLieeDeclareePour: string | null
  justificatifs: JustificatifsOs
  /**
   * Entreprise (prestataireId de la demande) pour laquelle l'autorisation de l'assemblée (justificatifs.
   * autorisationConventionLiee) a été saisie : elle ne vaut pas pour une autre entreprise (autorisationConvention) ; null
   * sans autorisation.
   */
  autorisationConventionLieePour: string | null
  visa: VisaSortie
  /** Motifs relevés à la création ou à la dernière revue : le visa donné porte sur eux. */
  motifsVisa: CodeMotifVisa[]
  /** Empreinte de la demande soumise au visa (visa demandé), puis visée (visa donné) ; null sinon. */
  empreinteVisee: string | null
  historiqueVisa: EvenementVisa[]
  /** Journal de diffusion, en ajout seul. */
  journal: EvenementDiffusion[]
}

export interface SaisieSortieOs {
  signataireId?: string | null
  delai?: UrgenceOrdreAJ
  motifUrgence?: string | null
  canal?: CanalEnvoiOs | null
  diffusable?: boolean
  relanceLe?: string | null
  fondement?: FondementOs | null
  fondementReference?: string | null
  decisionLe?: string | null
  majoriteResolution?: TypeMajorite | null
  entrepriseLiee?: boolean | null
  justificatifs?: Partial<JustificatifsOs>
}

/** Champs modifiables avant l'envoi (la date de relance passe par fixerRelance). */
export type ChangementsSortieOs = Omit<SaisieSortieOs, 'relanceLe'>

const JUSTIFICATIFS_VIDES: JustificatifsOs = {
  avisConseilSyndicalLe: null,
  modeFinancement: null,
  devisDemandes: null,
  devisExigesParAssemblee: null,
  autorisationConventionLiee: null,
}

function verifierSortie(s: SortieOrdreService): void {
  if (!DELAIS.has(s.delai)) throw new Error(`Délai inconnu : « ${s.delai} » (normale, prioritaire ou urgence).`)
  if (s.canal !== null && !CANAUX.has(s.canal)) throw new Error(`Canal d'envoi inconnu : « ${s.canal} ».`)
  if (s.fondement !== null && !FONDEMENTS.has(s.fondement)) throw new Error(`Fondement de l'OS inconnu : « ${s.fondement} ».`)
  if (s.majoriteResolution !== null && !Object.hasOwn(MAJORITES_AG, s.majoriteResolution))
    throw new Error(`Majorité de la résolution inconnue : « ${s.majoriteResolution} » (${Object.keys(MAJORITES_AG).join(', ')}).`)
  verifierDate('Date de relance', s.relanceLe)
  verifierDate('Date de la décision', s.decisionLe)
  verifierDate('Avis du conseil syndical', s.justificatifs.avisConseilSyndicalLe)
  verifierNombre('Nombre de devis demandés', s.justificatifs.devisDemandes, 0)
  verifierNombre("Nombre de devis exigé par l'assemblée", s.justificatifs.devisExigesParAssemblee, 1)
}

function appliquerJustificatifs(actuels: JustificatifsOs, j: Partial<JustificatifsOs>): JustificatifsOs {
  return {
    avisConseilSyndicalLe: garder(j.avisConseilSyndicalLe, actuels.avisConseilSyndicalLe),
    modeFinancement: texteOuNull(garder(j.modeFinancement, actuels.modeFinancement)),
    devisDemandes: garder(j.devisDemandes, actuels.devisDemandes),
    devisExigesParAssemblee: garder(j.devisExigesParAssemblee, actuels.devisExigesParAssemblee),
    autorisationConventionLiee: texteOuNull(garder(j.autorisationConventionLiee, actuels.autorisationConventionLiee)),
  }
}

/** La réponse sur le lien a été saisie pour une autre entreprise que celle de la demande (entreprise changée depuis). */
const lienPerime = (d: Pick<Demande, 'prestataireId'>, c: Pick<SortieOrdreService, 'entrepriseLiee' | 'entrepriseLieeDeclareePour'>): boolean =>
  c.entrepriseLiee !== null && c.entrepriseLieeDeclareePour !== d.prestataireId

type AutorisationSaisie = Pick<SortieOrdreService, 'justificatifs' | 'autorisationConventionLieePour'>

/** Une autorisation de l'assemblée est saisie, mais pour une autre entreprise que `prestataireId` (ou sans entreprise). */
const autorisationPourAutre = (s: AutorisationSaisie, prestataireId: string | null): boolean =>
  s.justificatifs.autorisationConventionLiee !== null && s.autorisationConventionLieePour !== prestataireId

/**
 * Réponse sur le lien (D. 1967 art. 39) saisie : elle vaut pour l'entreprise de la demande à ce moment. Redite alors que
 * l'autorisation de l'assemblée a été saisie pour une autre entreprise, elle efface celle-ci, qui visait la convention avec
 * cette autre entreprise, que la réponse précédente ait été connue ou non (sauf autorisation saisie avec la réponse).
 */
function appliquerLien(s: SortieOrdreService, saisie: SaisieSortieOs, prestataireId: string | null): SortieOrdreService {
  if (saisie.entrepriseLiee === undefined) return s
  const lien: SortieOrdreService = { ...s, entrepriseLiee: saisie.entrepriseLiee, entrepriseLieeDeclareePour: prestataireId }
  if (!autorisationPourAutre(s, prestataireId)) return lien
  return { ...lien, justificatifs: { ...s.justificatifs, autorisationConventionLiee: null }, autorisationConventionLieePour: null }
}

/** Entreprise de l'autorisation : celle de la demande quand l'autorisation est saisie, aucune quand elle est effacée. */
function entrepriseDeLAutorisation(actuelle: string | null, saisie: SaisieSortieOs, autorisation: string | null, prestataireId: string | null): string | null {
  if (saisie.justificatifs?.autorisationConventionLiee === undefined) return actuelle
  return autorisation === null ? null : prestataireId
}

function appliquerSaisie(base: SortieOrdreService, saisie: SaisieSortieOs, prestataireId: string | null): SortieOrdreService {
  const s = appliquerLien(base, saisie, prestataireId)
  const justificatifs = appliquerJustificatifs(s.justificatifs, saisie.justificatifs ?? {})
  const suite: SortieOrdreService = {
    ...s,
    signataireId: texteOuNull(garder(saisie.signataireId, s.signataireId)),
    delai: garder(saisie.delai, s.delai),
    motifUrgence: texteOuNull(garder(saisie.motifUrgence, s.motifUrgence)),
    canal: garder(saisie.canal, s.canal),
    diffusable: garder(saisie.diffusable, s.diffusable),
    relanceLe: garder(saisie.relanceLe, s.relanceLe),
    fondement: garder(saisie.fondement, s.fondement),
    fondementReference: texteOuNull(garder(saisie.fondementReference, s.fondementReference)),
    decisionLe: garder(saisie.decisionLe, s.decisionLe),
    majoriteResolution: garder(saisie.majoriteResolution, s.majoriteResolution),
    justificatifs,
    autorisationConventionLieePour: entrepriseDeLAutorisation(
      s.autorisationConventionLieePour,
      saisie,
      justificatifs.autorisationConventionLiee,
      prestataireId,
    ),
  }
  verifierSortie(suite)
  return suite
}

function verifierLien(d: Demande, s: SortieOrdreService): void {
  if (s.demandeId !== d.id) throw new Error(`Sortie de l'OS ${s.demandeId} reçue pour une autre demande (${d.id}).`)
}

/**
 * Réponse sur le lien (D. 1967 art. 39) pour l'entreprise ACTUELLE de la demande ; null : non renseignée, ou donnée pour
 * une autre entreprise (périmée).
 */
export const lienEntreprise = (
  d: Pick<Demande, 'prestataireId'>,
  c: Pick<SortieOrdreService, 'entrepriseLiee' | 'entrepriseLieeDeclareePour'>,
): boolean | null => (lienPerime(d, c) ? null : c.entrepriseLiee)

/**
 * Autorisation de l'assemblée (L. 1965 art. 18-1 A, II ; D. 1967 art. 39) pour l'entreprise ACTUELLE de la demande ; null :
 * non saisie, ou saisie pour une autre entreprise.
 */
export const autorisationConvention = (d: Pick<Demande, 'prestataireId'>, s: AutorisationSaisie): string | null =>
  autorisationPourAutre(s, d.prestataireId) ? null : s.justificatifs.autorisationConventionLiee

/** Premier envoi du journal ; null si l'OS n'est jamais parti. */
export const premierEnvoi = (s: SortieOrdreService): EvenementDiffusion | null => s.journal.find((e) => e.nature === 'envoi') ?? null

export const estEnvoye = (s: SortieOrdreService): boolean => premierEnvoi(s) !== null

/**
 * L'entreprise a accusé réception de l'OS : le contrat se forme quand l'acceptation parvient (C. civ. art. 1121) ; pour un
 * écrit électronique hors des cas des art. 1125 et 1126, la remise est effective à l'accusé de réception (art. 1127-4).
 */
export const estRecu = (s: SortieOrdreService): boolean => s.journal.some((e) => e.nature === 'reception')

function verifierNonEnvoye(s: SortieOrdreService, action: string): void {
  const envoi = premierEnvoi(s)
  if (envoi)
    throw new Error(
      `OS ${s.demandeId} déjà envoyé le ${horodatageFr(envoi)} : impossible de ${action} (preuve figée ; une modification vaut offre nouvelle, établir un nouvel ordre de service).`,
    )
}

// ─── Motifs du visa ───────────────────────────────────────────────────────────────────────────

export type CodeMotifVisa =
  | 'seuil_cabinet'
  | 'prevu_inconnu'
  | 'nature_soumise'
  | 'execution_forcee'
  | 'consultation_conseil_syndical'
  | 'mise_en_concurrence'
  | 'convention_liee'
  | 'avis_conseil_syndical_aj'

export interface MotifVisa {
  code: CodeMotifVisa
  message: string
  /** Texte qui fonde le motif ; null pour une règle de gestion du cabinet. */
  fondement: string | null
  aConfirmer: boolean
}

/** Règles de gestion du visa (paramètres du cabinet). */
export interface ReglesVisaOs {
  /** Prévu TTC à partir duquel (inclus) le visa est nécessaire ; null : aucun seuil. */
  seuilPrevuTtcCentimes: number | null
  /** Natures soumises au visa (comparées sans casse ni accents). */
  naturesSoumises: ReadonlySet<string>
  executionForceeSoumise: boolean
  rolesViseurs: ReadonlySet<RoleCabinet>
}

/** Aucun visa de gestion par défaut ; viseur : la Direction (🔵, 🔴 à Frédéric). */
export const REGLES_VISA_PAR_DEFAUT: ReglesVisaOs = Object.freeze({
  seuilPrevuTtcCentimes: null,
  naturesSoumises: new Set<string>(),
  executionForceeSoumise: false,
  rolesViseurs: new Set<RoleCabinet>(['Direction']),
})

export interface OptionsVisa {
  regles?: ReglesVisaOs
  /** Décisions d'assemblée en vigueur à la date de l'envoi (decisionsEnVigueur) : seuils de L. 1965 art. 21, al. 2. */
  decisionsAgEnVigueur?: readonly DecisionAnnuelle[]
}

/** Ce que la sortie dit du cadre de l'OS. */
export type CadreVisa = Pick<SortieOrdreService, 'fondement' | 'motifUrgence' | 'entrepriseLiee' | 'entrepriseLieeDeclareePour' | 'delai'>

/** Urgence déclarée : délai « urgence » ou fondement « urgence de sauvegarde », avec un motif (🔵). */
const urgenceDeclaree = (c: Pick<SortieOrdreService, 'delai' | 'fondement' | 'motifUrgence'>): boolean =>
  c.motifUrgence !== null && (c.delai === 'urgence' || c.fondement === 'urgence_sauvegarde')

const motif = (code: CodeMotifVisa, message: string, fondement: string | null = null, aConfirmer = false): MotifVisa => ({
  code,
  message,
  fondement,
  aConfirmer,
})

const motifPrevuInconnu = (): MotifVisa =>
  motif('prevu_inconnu', 'Prévu inconnu (ni prix ni devis associé) : les seuils du visa ne peuvent pas être appréciés.')

function motifsDeGestion(d: Demande, regles: ReglesVisaOs): MotifVisa[] {
  const motifs: MotifVisa[] = []
  const prevu = prevuDemande(d)
  const seuil = regles.seuilPrevuTtcCentimes
  if (seuil !== null && prevu === null) motifs.push(motifPrevuInconnu())
  else if (seuil !== null && prevu !== null && prevu >= seuil)
    motifs.push(motif('seuil_cabinet', `Prévu de ${euros(prevu)} TTC, au moins égal au seuil du cabinet (${euros(seuil)}) : règle de gestion.`))
  const natures = new Set([...regles.naturesSoumises].map(normaliserTexte))
  if (natures.has(normaliserTexte(d.nature))) motifs.push(motif('nature_soumise', `Nature « ${d.nature} » soumise au visa : règle de gestion.`))
  if (d.executionForcee && regles.executionForceeSoumise) motifs.push(motif('execution_forcee', 'Exécution forcée soumise au visa : règle de gestion.'))
  return motifs
}

/** Seuils de L. 1965 art. 21, al. 2, comparés au prévu TTC (décision J6) ; prévu inconnu face à un seuil décidé : motif. */
function motifsSeuilsArt21(prevu: number | null, decisions: readonly DecisionAnnuelle[] | undefined): MotifVisa[] {
  if (!decisions) return []
  const atteints = seuilsAtteints(prevu ?? 0, decisions)
  if (prevu === null) return atteints.consultationCs === null && atteints.miseEnConcurrence === null ? [] : [motifPrevuInconnu()]
  const motifs: MotifVisa[] = []
  if (atteints.consultationCs)
    motifs.push(
      motif(
        'consultation_conseil_syndical',
        `Prévu de ${euros(prevu)} TTC : consultation du conseil syndical obligatoire à partir du seuil fixé par l'assemblée (montant égal compris).`,
        FONDEMENT_CONSULTATION,
      ),
    )
  if (atteints.miseEnConcurrence)
    motifs.push(
      motif(
        'mise_en_concurrence',
        `Prévu de ${euros(prevu)} TTC : mise en concurrence obligatoire à partir du seuil fixé par l'assemblée (montant égal compris).`,
        FONDEMENT_CONCURRENCE,
      ),
    )
  return motifs
}

function motifsLegaux(d: Demande, cadre: CadreVisa, decisions: readonly DecisionAnnuelle[] | undefined): MotifVisa[] {
  if (d.type !== 'intervention') return []
  const motifs = motifsSeuilsArt21(prevuDemande(d), decisions)
  if (lienEntreprise(d, cadre) === true)
    motifs.push(
      motif(
        'convention_liee',
        "Convention liée (D. 1967 art. 39 : avec le syndic, l'un de ses préposés ou de ses proches, ou une entreprise où l'un d'eux a une part, une fonction de direction ou de contrôle, ou un emploi) : à autoriser spécialement par l'assemblée ; sans autorisation, la convention avec une entreprise liée au syndic n'est pas opposable au syndicat.",
        FONDEMENT_CONVENTION_LIEE,
      ),
    )
  if (cadre.fondement === 'decision_aj_pouvoirs_ag' && !urgenceDeclaree(cadre))
    motifs.push(
      motif(
        'avis_conseil_syndical_aj',
        "Décision de l'administrateur provisoire au titre des pouvoirs de l'assemblée : avis préalable du conseil syndical, sauf urgence déclarée.",
        FONDEMENT_AVIS_AJ,
        true,
      ),
    )
  return motifs
}

/** Motifs du visa : règles de gestion du cabinet et déclencheurs légaux (intervention seulement), sans doublon. */
export function motifsVisa(d: Demande, cadre: CadreVisa, options: OptionsVisa = {}): MotifVisa[] {
  const tous = [...motifsDeGestion(d, options.regles ?? REGLES_VISA_PAR_DEFAUT), ...motifsLegaux(d, cadre, options.decisionsAgEnVigueur)]
  return [...new Map(tous.map((m) => [m.code, m])).values()]
}

/**
 * Sortie de l'OS d'une demande ouverte : visa initial « Visa nécessaire » s'il y a un motif, sinon « Sortie libre ». Une
 * date de relance antérieure à la demande est refusée.
 */
export function creerSortieOs(d: Demande, saisie: SaisieSortieOs = {}, options: OptionsVisa = {}): SortieOrdreService {
  if (d.statut === 'Terminé' || estRefusee(d)) throw new Error(`Demande ${d.id} terminée ou refusée : aucun ordre de service à préparer.`)
  const vierge: SortieOrdreService = {
    demandeId: d.id,
    signataireId: null,
    delai: 'normale',
    motifUrgence: null,
    canal: null,
    diffusable: true,
    relanceLe: null,
    fondement: null,
    fondementReference: null,
    decisionLe: null,
    majoriteResolution: null,
    entrepriseLiee: null,
    entrepriseLieeDeclareePour: null,
    justificatifs: JUSTIFICATIFS_VIDES,
    autorisationConventionLieePour: null,
    visa: 'Sortie libre',
    motifsVisa: [],
    empreinteVisee: null,
    historiqueVisa: [],
    journal: [],
  }
  const s = appliquerSaisie(vierge, saisie, d.prestataireId)
  if (s.relanceLe !== null && s.relanceLe < d.demandeLe)
    throw new Error(`Date de relance (${fr(s.relanceLe)}) antérieure à la demande du ${fr(d.demandeLe)}.`)
  const codes = motifsVisa(d, s, options).map((m) => m.code)
  return { ...s, visa: codes.length > 0 ? 'Visa nécessaire' : 'Sortie libre', motifsVisa: codes }
}

/**
 * Modifie la sortie (copie) avant le premier envoi ; le visa n'est pas touché (revoirVisa ; le contrôle avant l'envoi le
 * voit). La réponse sur le lien (entrepriseLiee) vaut pour l'entreprise actuelle de la demande `d`.
 */
export function modifierSortieOs(s: SortieOrdreService, d: Demande, changements: ChangementsSortieOs): SortieOrdreService {
  verifierLien(d, s)
  verifierNonEnvoye(s, 'modifier la sortie')
  return appliquerSaisie(s, changements, d.prestataireId)
}

/** « Diffusable » (copie) : se règle avant comme après le premier envoi ; un OS non diffusable ne part pas et n'est pas rediffusé. */
export const marquerDiffusable = (s: SortieOrdreService, diffusable: boolean): SortieOrdreService => ({ ...s, diffusable })

// ─── Circuit du visa ──────────────────────────────────────────────────────────────────────────

const TRANSITIONS_VISA: Readonly<Record<ActionVisa, { depuis: ReadonlySet<VisaSortie>; vers: VisaSortie }>> = {
  exige: { depuis: new Set<VisaSortie>(['Sortie libre']), vers: 'Visa nécessaire' },
  demande: { depuis: new Set<VisaSortie>(['Visa nécessaire', 'Visa refusé']), vers: 'Demande de visa' },
  donne: { depuis: new Set<VisaSortie>(['Demande de visa']), vers: 'Visa donné' },
  refuse: { depuis: new Set<VisaSortie>(['Demande de visa']), vers: 'Visa refusé' },
  revu: { depuis: new Set<VisaSortie>(['Sortie libre', 'Demande de visa', 'Visa donné']), vers: 'Visa nécessaire' },
}

const ACTIONS_DU_VISEUR: ReadonlySet<ActionVisa> = new Set<ActionVisa>(['donne', 'refuse'])

/** Actions qui figent l'empreinte de la demande soumise au visa (demande), puis visée (donne). */
const ACTIONS_EMPREINTE: ReadonlySet<ActionVisa> = new Set<ActionVisa>(['demande', 'donne'])

/** Champs de la demande sur lesquels porte le visa (🔵). */
const CHAMPS_VISES: readonly ((d: Demande) => unknown)[] = [
  prevuDemande,
  (d) => d.prestataireId,
  (d) => d.objet,
  (d) => d.nature,
  (d) => d.devisAssocie?.devisId ?? null,
]

/** Empreinte de la demande sur les champs visés (prévu, entreprise, objet, nature, devis associé). */
export const empreinteDemande = (d: Demande): string => JSON.stringify(CHAMPS_VISES.map((champ) => champ(d)))

/** Visa demandé ou donné sur une demande qui ne correspond plus à l'empreinte figée. */
const demandeChangeeDepuisVisa = (s: SortieOrdreService, d: Demande): boolean =>
  (s.visa === 'Demande de visa' || s.visa === 'Visa donné') && s.empreinteVisee !== empreinteDemande(d)

function evenementVisa(s: SortieOrdreService, d: Demande, action: ActionVisa, saisie: SaisieEvenementVisa): EvenementVisa {
  verifierHorodatage('Visa', saisie.date, saisie.heure)
  const collaborateurId = saisie.collaborateurId.trim()
  if (!collaborateurId) throw new Error('Visa : identifiant du collaborateur attendu.')
  if (!ROLES.has(saisie.role)) throw new Error(`Rôle inconnu : « ${saisie.role} » (${ROLES_CABINET.join(', ')}).`)
  if (saisie.date < d.demandeLe) throw new Error(`Visa : horodatage (${horodatageFr(saisie)}) antérieur à la demande du ${fr(d.demandeLe)}.`)
  const dernier = s.historiqueVisa.at(-1)
  if (dernier && horodatage(saisie) < horodatage(dernier))
    throw new Error(`Visa : horodatage (${horodatageFr(saisie)}) antérieur au dernier événement du visa (${horodatageFr(dernier)}).`)
  return { date: saisie.date, heure: saisie.heure, collaborateurId, role: saisie.role, action, motif: texteOuNull(saisie.motif) }
}

function verifierViseur(s: SortieOrdreService, viseur: EvenementVisa, regles: ReglesVisaOs): void {
  if (!regles.rolesViseurs.has(viseur.role))
    throw new Error(`Rôle « ${viseur.role} » non habilité à viser (viseurs : ${[...regles.rolesViseurs].join(', ')}).`)
  const demande = s.historiqueVisa.findLast((e) => e.action === 'demande')
  if (demande?.collaborateurId === viseur.collaborateurId) throw new Error('Le visa est donné ou refusé par un autre collaborateur que celui qui l’a demandé.')
}

function changerVisa(
  s: SortieOrdreService,
  d: Demande,
  action: ActionVisa,
  saisie: SaisieEvenementVisa,
  regles: ReglesVisaOs = REGLES_VISA_PAR_DEFAUT,
  motifs: CodeMotifVisa[] = s.motifsVisa,
): SortieOrdreService {
  verifierLien(d, s)
  verifierNonEnvoye(s, 'changer le visa')
  const evenement = evenementVisa(s, d, action, saisie)
  const transition = TRANSITIONS_VISA[action]
  if (!transition.depuis.has(s.visa))
    throw new Error(`Visa « ${s.visa} » : action « ${action} » impossible (attendu : ${[...transition.depuis].join(', ')}).`)
  if (ACTIONS_DU_VISEUR.has(action)) verifierViseur(s, evenement, regles)
  if (action === 'refuse' && evenement.motif === null) throw new Error('Refus de visa : motif obligatoire.')
  return {
    ...s,
    visa: transition.vers,
    motifsVisa: motifs,
    empreinteVisee: ACTIONS_EMPREINTE.has(action) ? empreinteDemande(d) : null,
    historiqueVisa: [...s.historiqueVisa, evenement],
  }
}

/** Un collaborateur exige un visa sur une sortie libre. */
export const exigerVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa): SortieOrdreService => changerVisa(s, d, 'exige', saisie)

/** Demande de visa (visa nécessaire, ou nouvelle demande après un refus) : l'empreinte de la demande soumise est figée. */
export const demanderVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa): SortieOrdreService => changerVisa(s, d, 'demande', saisie)

/** Visa donné par un viseur (rôle de rolesViseurs, autre que le demandeur) : l'empreinte de la demande visée est figée. */
export const donnerVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa, regles: ReglesVisaOs = REGLES_VISA_PAR_DEFAUT): SortieOrdreService =>
  changerVisa(s, d, 'donne', saisie, regles)

/** Visa refusé par un viseur, avec un motif. */
export const refuserVisa = (s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa, regles: ReglesVisaOs = REGLES_VISA_PAR_DEFAUT): SortieOrdreService =>
  changerVisa(s, d, 'refuse', saisie, regles)

/**
 * Revue du visa avant l'envoi (copie) : une sortie libre qui reçoit un motif, ou un visa demandé ou donné quand un motif
 * nouveau apparaît ou que la demande ne correspond plus à l'empreinte figée, repasse à « Visa nécessaire » (action
 * « revu ») ; sinon seuls les motifs relevés sont mis à jour. Après le premier envoi : refusé (offre nouvelle, nouvel OS).
 */
export function revoirVisa(s: SortieOrdreService, d: Demande, saisie: SaisieEvenementVisa, options: OptionsVisa = {}): SortieOrdreService {
  verifierLien(d, s)
  verifierNonEnvoye(s, 'revoir le visa')
  const codes = motifsVisa(d, s, options).map((m) => m.code)
  const vises = new Set(s.motifsVisa)
  const nouveau = codes.some((code) => !vises.has(code))
  const aRevoir = s.visa === 'Sortie libre' ? codes.length > 0 : nouveau || demandeChangeeDepuisVisa(s, d)
  if (aRevoir && TRANSITIONS_VISA.revu.depuis.has(s.visa)) return changerVisa(s, d, 'revu', saisie, REGLES_VISA_PAR_DEFAUT, codes)
  return { ...s, motifsVisa: codes }
}

// ─── Contrôle avant l'envoi ───────────────────────────────────────────────────────────────────

export type CodeAnomalieEnvoiOs =
  | 'demande_close'
  | 'numero_absent'
  | 'numero_hors_sequence'
  | 'numero_en_double'
  | 'numero_trop_long'
  | 'entreprise_absente'
  | 'signataire_absent'
  | 'signataire_non_habilite'
  | 'canal_absent'
  | 'non_diffusable'
  | 'relance_avant_envoi'
  | 'decision_posterieure_envoi'
  | 'objet_absent'
  | 'objet_trop_long'
  | 'sans_compte_vitfix'
  | 'courriel_non_communique'
  | 'courriel_a_verifier'
  | 'sms_non_communique'
  | 'sms_a_verifier'
  | 'urgence_non_motivee'
  | 'motif_urgence_sans_urgence'
  | 'visa_manquant'
  | 'visa_devenu_necessaire'
  | 'visa_a_revoir'
  | 'lien_entreprise_perime'
  | 'lien_entreprise_non_renseigne'
  | 'convention_liee_non_autorisee'
  | 'avis_conseil_syndical_aj_absent'
  | 'date_decision_non_renseignee'
  | 'mode_financement_non_precise'
  | 'avis_conseil_syndical_non_enregistre'
  | 'mise_en_concurrence_non_justifiee'
  | 'fondement_non_renseigne'
  | 'fondement_sans_reference'
  | 'urgence_suites'
  | 'delegation_cs_absente'
  | 'majorite_resolution_non_renseignee'
  | 'delai_contestation_inconnu'
  | 'execution_suspendue_art42'
  | 'devis_caduc'
  | 'controle_declaratif_non_fait'
  | 'controle_declaratif_impossible'

export interface AnomalieEnvoiOs {
  /** Code du point 44, ou code du contrôle déclaratif de l'entreprise (vigilance-entreprises.ts). */
  code: CodeAnomalieEnvoiOs | CodeAnomalieEntreprise
  gravite: 'bloquant' | 'alerte'
  message: string
  /** Texte qui fonde l'anomalie ; null pour une règle de gestion. */
  fondement: string | null
  aConfirmer: boolean
}

export interface ContexteEnvoiOs extends OptionsVisa {
  /** Date de l'envoi. */
  date: string
  /** Pièces de l'entreprise pour le contrôle déclaratif (intervention). */
  pieces?: PiecesEntreprise
  controle?: Partial<Omit<OptionsControleDeclaratif, 'moment' | 'date'>>
  /** Le prestataire a un compte VitFix (canal messagerie). */
  prestataireAvecCompteVitfix?: boolean
  /** L'entreprise a communiqué son adresse électronique (canal courriel) ; null ou absent : on ne sait pas. */
  courrielCommunique?: boolean | null
  /** L'entreprise a communiqué un numéro pour recevoir des SMS (canal sms) ; null ou absent : on ne sait pas. */
  smsCommunique?: boolean | null
  /** Collaborateurs habilités à signer un OS (🔴) ; absent : non contrôlé. */
  signatairesHabilites?: ReadonlySet<string>
  /** Fin de validité du devis associé, fixée par l'entreprise. */
  validiteDevisAu?: string | null
  /** Segment mandat de la séquence des N° (SegmentsNumeroOs.mandat) ; absent : non contrôlé. */
  segmentMandat?: string
  /** N° des autres demandes du mandat (doublons) ; absent : non contrôlé. */
  numerosDuMandat?: readonly Pick<Demande, 'id' | 'numero'>[]
  /**
   * Fin du délai de contestation de l'assemblée dont la résolution est exécutée (échéance retenue par finDelaiContestationAg,
   * statut-assemblee.ts) ; null ou absent : non calculée.
   */
  finDelaiContestationAg?: string | null
}

type Gravite = AnomalieEnvoiOs['gravite']

const anomalie = (
  code: AnomalieEnvoiOs['code'],
  gravite: Gravite,
  message: string,
  fondement: string | null = null,
  aConfirmer = false,
): AnomalieEnvoiOs => ({ code, gravite, message, fondement, aConfirmer })

function anomaliesNumero(d: Demande, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const numero = d.numero
  if (numero === null)
    return [anomalie('numero_absent', 'bloquant', "N° d'ordre de service absent : numéroter la demande dans la séquence du mandat avant l'envoi.")]
  const anomalies: AnomalieEnvoiOs[] = []
  const lu = lireNumeroOs(numero)
  if (lu === null)
    anomalies.push(
      anomalie('numero_hors_sequence', 'alerte', `N° « ${numero} » hors du format <mandat>.<plan>.<rang> : repris d'ailleurs, il reste hors de la séquence du mandat.`),
    )
  else if (contexte.segmentMandat !== undefined && lu.mandat !== contexte.segmentMandat)
    anomalies.push(
      anomalie('numero_hors_sequence', 'alerte', `N° « ${numero} » du segment mandat « ${lu.mandat} » : hors de la séquence du mandat (« ${contexte.segmentMandat} »).`),
    )
  const doublon = contexte.numerosDuMandat?.find((autre) => autre.id !== d.id && autre.numero?.trim() === numero)
  if (doublon) anomalies.push(anomalie('numero_en_double', 'alerte', `N° « ${numero} » déjà porté par la demande ${doublon.id} du mandat.`))
  return anomalies
}

/** Champ du corps de la route tiré de la demande, borné par ajOrdrePrestataireSchema (lib/validation.ts). */
interface ChampCorpsMessagerie {
  /** Nom du champ dans le corps. */
  champ: 'reference_aj' | 'objet'
  libelle: string
  lire: (d: Demande) => string | null
  /** Longueur maximale, après suppression des espaces de début et de fin (comme le schéma). */
  max: number
  /** Champ requis : vide, la route refuse le corps ; null : facultatif (ou contrôlé ailleurs, comme le N° : numero_absent). */
  absent: { code: CodeAnomalieEnvoiOs; conseil: string } | null
  tropLong: { code: CodeAnomalieEnvoiOs; conseil: string }
}

const CHAMPS_CORPS_MESSAGERIE: readonly ChampCorpsMessagerie[] = [
  {
    champ: 'reference_aj',
    libelle: "N° d'OS",
    lire: (d) => d.numero,
    max: LONGUEUR_MAX_NUMERO_OS,
    absent: null,
    tropLong: { code: 'numero_trop_long', conseil: 'choisir un autre canal ou un N° plus court' },
  },
  {
    champ: 'objet',
    libelle: 'Objet',
    lire: (d) => d.objet,
    max: LONGUEUR_MAX_OBJET_OS,
    absent: { code: 'objet_absent', conseil: "saisir l'objet de la demande" },
    tropLong: { code: 'objet_trop_long', conseil: "choisir un autre canal ou raccourcir l'objet de la demande" },
  },
]

interface ChampRefuse {
  code: CodeAnomalieEnvoiOs
  /** Constat, sans conseil. */
  constat: string
  conseil: string
}

/** Champs de la demande que la route refuserait dans le corps de la messagerie VitFix (vides et requis, ou trop longs). */
function champsRefusesParLaRoute(d: Demande): ChampRefuse[] {
  return CHAMPS_CORPS_MESSAGERIE.flatMap(({ champ, libelle, lire, max, absent, tropLong }): ChampRefuse[] => {
    const longueur = (lire(d) ?? '').trim().length
    if (longueur === 0 && absent) return [{ ...absent, constat: `${libelle} absent : la messagerie VitFix l'exige (${champ})` }]
    if (longueur <= max) return []
    return [{ ...tropLong, constat: `${libelle} de ${longueur} caractères : la messagerie VitFix en accepte ${max} au plus (${champ})` }]
  })
}

/** Corps de la messagerie VitFix : bloquant pour chaque champ que la route refuserait. */
function anomaliesCorpsMessagerie(d: Demande, canal: CanalEnvoiOs | null): AnomalieEnvoiOs[] {
  if (canal !== 'messagerie_vitfix') return []
  return champsRefusesParLaRoute(d).map(({ code, constat, conseil }) => anomalie(code, 'bloquant', `${constat} ; ${conseil}.`))
}

function anomaliesDemande(d: Demande, canal: CanalEnvoiOs | null, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const anomalies: AnomalieEnvoiOs[] = []
  if (d.statut === 'Terminé' || estRefusee(d)) anomalies.push(anomalie('demande_close', 'bloquant', `Demande ${d.id} terminée ou refusée : aucun ordre de service à envoyer.`))
  anomalies.push(...anomaliesNumero(d, contexte), ...anomaliesCorpsMessagerie(d, canal))
  if (d.prestataireId === null) anomalies.push(anomalie('entreprise_absente', 'bloquant', "Entreprise absente : choisir le destinataire de l'ordre de service."))
  return anomalies
}

/** Coordonnée électronique exigée par un canal (C. civ. art. 1126, 1127, al. 1). */
interface ControleCoordonnee {
  communiquee: (contexte: ContexteEnvoiOs) => boolean | null | undefined
  absente: { code: CodeAnomalieEnvoiOs; message: string }
  aVerifier: { code: CodeAnomalieEnvoiOs; message: string }
  fondement: string
}

const COORDONNEE_PAR_CANAL: ReadonlyMap<CanalEnvoiOs, ControleCoordonnee> = new Map<CanalEnvoiOs, ControleCoordonnee>([
  [
    'courriel',
    {
      communiquee: (contexte) => contexte.courrielCommunique,
      absente: { code: 'courriel_non_communique', message: "L'entreprise n'a pas communiqué d'adresse électronique : envoi par courriel impossible." },
      aVerifier: { code: 'courriel_a_verifier', message: "Vérifier que l'entreprise a communiqué son adresse électronique avant l'envoi par courriel." },
      fondement: FONDEMENT_COURRIEL,
    },
  ],
  [
    'sms',
    {
      communiquee: (contexte) => contexte.smsCommunique,
      absente: { code: 'sms_non_communique', message: "L'entreprise n'a pas communiqué de numéro pour recevoir des SMS : envoi par SMS impossible." },
      aVerifier: { code: 'sms_a_verifier', message: "Vérifier que l'entreprise a communiqué un numéro pour recevoir des SMS avant l'envoi par SMS." },
      fondement: FONDEMENT_SMS,
    },
  ],
])

function anomaliesCanal(canal: CanalEnvoiOs | null, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (canal === 'messagerie_vitfix' && contexte.prestataireAvecCompteVitfix === false)
    return [anomalie('sans_compte_vitfix', 'bloquant', "Prestataire sans compte VitFix : choisir un autre canal (courriel, courrier).")]
  const controle = canal === null ? undefined : COORDONNEE_PAR_CANAL.get(canal)
  if (!controle) return []
  const communiquee = controle.communiquee(contexte)
  if (communiquee === true) return []
  if (communiquee === false) return [anomalie(controle.absente.code, 'bloquant', controle.absente.message, controle.fondement, true)]
  return [anomalie(controle.aVerifier.code, 'alerte', controle.aVerifier.message, controle.fondement, true)]
}

function anomaliesUrgence(s: SortieOrdreService): AnomalieEnvoiOs[] {
  const urgenceDemandee = s.delai === 'urgence' || s.fondement === 'urgence_sauvegarde'
  if (urgenceDemandee && s.motifUrgence === null)
    return [anomalie('urgence_non_motivee', 'alerte', "Urgence sans motif : dire pourquoi les travaux ne peuvent pas attendre.", 'L. 1965 art. 18, I')]
  if (!urgenceDemandee && s.motifUrgence !== null)
    return [
      anomalie(
        'motif_urgence_sans_urgence',
        'alerte',
        `Motif d'urgence saisi avec le délai « ${s.delai} » : l'urgence n'est pas déclarée (l'avis du conseil syndical et la suspension de l'art. 42 restent dus) ; choisir le délai « urgence » ou effacer le motif.`,
        null,
        true,
      ),
    ]
  return []
}

function anomaliesSortie(s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const anomalies: AnomalieEnvoiOs[] = []
  if (s.signataireId === null) anomalies.push(anomalie('signataire_absent', 'bloquant', 'Signataire pour le cabinet absent.'))
  else if (contexte.signatairesHabilites && !contexte.signatairesHabilites.has(s.signataireId))
    anomalies.push(
      anomalie('signataire_non_habilite', 'bloquant', `Signataire ${s.signataireId} hors des collaborateurs habilités à signer un OS.`, 'L. 1965 art. 18, IV ; art. 29-1, I', true),
    )
  if (s.canal === null) anomalies.push(anomalie('canal_absent', 'bloquant', "Canal d'envoi absent (messagerie VitFix, courriel, courrier…)."))
  if (!s.diffusable) anomalies.push(anomalie('non_diffusable', 'bloquant', 'Ordre de service non diffusable : cocher « Diffusable » pour l’envoyer.'))
  return [...anomalies, ...anomaliesChronologie(s, contexte.date), ...anomaliesUrgence(s), ...anomaliesCanal(s.canal, contexte)]
}

/**
 * Dates de la sortie face à l'envoi : relance antérieure, ou décision qui fonde l'OS (résolution, procès-verbal du conseil
 * syndical, registre des décisions de l'administrateur provisoire, mentionnées à leur date : D. 1967 art. 62-8) postérieure.
 */
function anomaliesChronologie(s: SortieOrdreService, date: string): AnomalieEnvoiOs[] {
  const anomalies: AnomalieEnvoiOs[] = []
  if (s.relanceLe !== null && s.relanceLe < date)
    anomalies.push(anomalie('relance_avant_envoi', 'bloquant', `Date de relance (${fr(s.relanceLe)}) antérieure à l'envoi du ${fr(date)} : la reporter (fixerRelance).`))
  if (s.decisionLe !== null && s.decisionLe > date)
    anomalies.push(
      anomalie(
        'decision_posterieure_envoi',
        'bloquant',
        `Décision qui fonde l'ordre de service datée du ${fr(s.decisionLe)}, après l'envoi du ${fr(date)} : l'OS ne part pas avant la décision qui le fonde ; corriger la date de la décision, ou attendre qu'elle soit prise.`,
        s.fondement === null ? null : CADRE_PAR_FONDEMENT[s.fondement].texte,
      ),
    )
  return anomalies
}

const MESSAGE_VISA_MANQUANT: ReadonlyMap<VisaSortie, string> = new Map<VisaSortie, string>([
  ['Visa nécessaire', "Visa nécessaire non demandé : demander le visa avant l'envoi."],
  ['Demande de visa', 'Visa demandé, en attente du viseur : envoi impossible.'],
  ['Visa refusé', "Visa refusé : revoir l'ordre de service, puis demander de nouveau le visa."],
])

const motifDuRefus = (s: SortieOrdreService): string => {
  const refus = s.historiqueVisa.findLast((e) => e.action === 'refuse')
  return refus?.motif ? ` Motif du refus : ${refus.motif}` : ''
}

function anomaliesVisa(d: Demande, s: SortieOrdreService, motifs: readonly MotifVisa[]): AnomalieEnvoiOs[] {
  const manquant = MESSAGE_VISA_MANQUANT.get(s.visa)
  if (manquant) return [anomalie('visa_manquant', 'bloquant', `${manquant}${motifDuRefus(s)}`)]
  if (demandeChangeeDepuisVisa(s, d))
    return [anomalie('visa_a_revoir', 'bloquant', 'La demande a changé depuis le visa (prévu, entreprise, objet, nature ou devis associé) : revoir le visa.')]
  const vises = new Set(s.motifsVisa)
  const nouveaux = motifs.filter((m) => !vises.has(m.code)).map((m) => m.message)
  if (nouveaux.length === 0) return []
  if (s.visa === 'Sortie libre')
    return [anomalie('visa_devenu_necessaire', 'bloquant', `Sortie libre, mais un visa est désormais nécessaire (revoir le visa) : ${nouveaux.join(' ')}`)]
  return [anomalie('visa_a_revoir', 'bloquant', `Visa donné avant un motif nouveau (revoir le visa) : ${nouveaux.join(' ')}`)]
}

function anomaliesConvention(d: Demande, s: SortieOrdreService, codes: ReadonlySet<CodeMotifVisa>): AnomalieEnvoiOs[] {
  if (lienPerime(d, s))
    return [
      anomalie(
        'lien_entreprise_perime',
        'bloquant',
        `Lien avec le syndic déclaré pour l'entreprise ${s.entrepriseLieeDeclareePour ?? '(aucune)'}, alors que l'ordre de service part à ${d.prestataireId ?? '(aucune)'} : redire si la convention avec cette entreprise est liée (modifierSortieOs).`,
        FONDEMENT_LIEN,
      ),
    ]
  if (s.entrepriseLiee === null)
    return [
      anomalie(
        'lien_entreprise_non_renseigne',
        'alerte',
        "Dire si la convention est passée avec le syndic, ses préposés, son conjoint, le partenaire lié à lui par un pacte civil de solidarité, son concubin, ses parents ou alliés jusqu'au deuxième degré inclus, ou avec une entreprise dont ces personnes sont propriétaires ou détiennent une participation dans son capital, dans laquelle elles exercent des fonctions de direction ou de contrôle, ou dont elles sont salariées ou préposées ; ou, pour un syndic personne morale, avec une entreprise qui détient une participation dans son capital.",
        FONDEMENT_LIEN,
        true,
      ),
    ]
  if (!codes.has('convention_liee') || autorisationConvention(d, s) !== null) return []
  const message = autorisationPourAutre(s, d.prestataireId)
    ? `Autorisation de l'assemblée (« ${s.justificatifs.autorisationConventionLiee} ») saisie pour l'entreprise ${s.autorisationConventionLieePour ?? '(aucune)'}, alors que l'ordre de service part à ${d.prestataireId ?? '(aucune)'} : elle ne vaut pas pour la convention avec cette entreprise, inopposable au syndicat sans autorisation spéciale de l'assemblée ; saisir la résolution qui l'autorise.`
    : "Convention liée sans autorisation spéciale de l'assemblée : inopposable au syndicat ; saisir la résolution qui l'autorise."
  return [anomalie('convention_liee_non_autorisee', 'bloquant', message, FONDEMENT_CONVENTION_LIEE)]
}

/**
 * Jour où l'avis doit être recueilli : celui de la décision au registre (D. 1967 art. 62-8), au plus tard celui de l'envoi
 * (une décision datée après l'envoi bloque celui-ci : decision_posterieure_envoi).
 */
const borneAvisAj = (s: SortieOrdreService, date: string): string => (s.decisionLe !== null && s.decisionLe < date ? s.decisionLe : date)

/** Consultation du conseil syndical par l'administrateur provisoire (D. 1967 art. 62-7, al. 1 et 3 ; art. 62-8). */
function anomaliesAvisAj(s: SortieOrdreService, date: string): AnomalieEnvoiOs[] {
  const anomalies: AnomalieEnvoiOs[] = []
  const avisLe = s.justificatifs.avisConseilSyndicalLe
  if (avisLe === null || avisLe > borneAvisAj(s, date))
    anomalies.push(
      anomalie(
        'avis_conseil_syndical_aj_absent',
        'bloquant',
        "Avis du conseil syndical non recueilli avant la décision de l'administrateur provisoire (ou urgence non déclarée : délai « urgence » et motif).",
        FONDEMENT_AVIS_AJ,
        true,
      ),
    )
  if (s.decisionLe === null)
    anomalies.push(
      anomalie(
        'date_decision_non_renseignee',
        'alerte',
        "Date de la décision au registre non saisie : l'avis du conseil syndical est comparé à la date de l'envoi, alors qu'il doit précéder la décision.",
        'D. 1967 art. 62-7, 62-8',
        true,
      ),
    )
  if (s.justificatifs.modeFinancement === null)
    anomalies.push(
      anomalie('mode_financement_non_precise', 'alerte', 'Mode de financement de la décision non précisé lors de la consultation du conseil syndical.', 'D. 1967 art. 62-7, al. 3', true),
    )
  return anomalies
}

function anomaliesMiseEnConcurrence(s: SortieOrdreService): AnomalieEnvoiOs[] {
  const { devisDemandes, devisExigesParAssemblee } = s.justificatifs
  const demandes = devisDemandes ?? 0
  if (devisExigesParAssemblee !== null)
    return demandes >= devisExigesParAssemblee
      ? []
      : [
          anomalie(
            'mise_en_concurrence_non_justifiee',
            'alerte',
            `Mise en concurrence obligatoire à partir du seuil fixé par l'assemblée : ${devisExigesParAssemblee} devis à demander selon ses conditions ; nombre de devis demandés : ${demandes}.`,
            FONDEMENT_CONDITIONS_AG,
            true,
          ),
        ]
  if (demandes >= NOMBRE_MIN_DEVIS_CONCURRENCE) return []
  return [
    anomalie(
      'mise_en_concurrence_non_justifiee',
      'alerte',
      `Mise en concurrence obligatoire à partir du seuil fixé par l'assemblée : sans conditions fixées par elle, demander plusieurs devis (au moins ${NOMBRE_MIN_DEVIS_CONCURRENCE}) ou soumettre un devis descriptif à plusieurs entreprises ; nombre de devis demandés : ${demandes}.`,
      FONDEMENT_CONCURRENCE,
      true,
    ),
  ]
}

function anomaliesConseilSyndical(s: SortieOrdreService, codes: ReadonlySet<CodeMotifVisa>, date: string): AnomalieEnvoiOs[] {
  const anomalies = codes.has('avis_conseil_syndical_aj') ? anomaliesAvisAj(s, date) : []
  const avisLe = s.justificatifs.avisConseilSyndicalLe
  if (codes.has('consultation_conseil_syndical') && (avisLe === null || avisLe > date))
    anomalies.push(
      anomalie(
        'avis_conseil_syndical_non_enregistre',
        'alerte',
        "Consultation du conseil syndical obligatoire à partir du seuil fixé par l'assemblée : avis non enregistré.",
        FONDEMENT_CONSULTATION,
        true,
      ),
    )
  if (codes.has('mise_en_concurrence')) anomalies.push(...anomaliesMiseEnConcurrence(s))
  return anomalies
}

const delegueAuConseilSyndical = (decision: DecisionAnnuelle): boolean =>
  decision.type === 'delegation_generale_cs' || (decision.type === 'delegation_art25a' && decision.delegataire === 'conseil_syndical')

/** Délégation de pouvoirs au conseil syndical dans les décisions d'assemblée fournies (absentes : non contrôlé). */
function anomaliesDelegationCs(decisions: readonly DecisionAnnuelle[] | undefined): AnomalieEnvoiOs[] {
  if (!decisions || decisions.some(delegueAuConseilSyndical)) return []
  return [
    anomalie(
      'delegation_cs_absente',
      'alerte',
      "Aucune délégation de pouvoirs au conseil syndical dans les décisions d'assemblée en vigueur fournies (délégation générale de deux ans au plus, renouvelable par décision expresse, ou délégation de l'art. 25 a) : vérifier qu'elle était en vigueur à la date de la décision du conseil syndical.",
      FONDEMENT_DELEGATION_CS,
      true,
    ),
  ]
}

/** Suspension de l'exécution des travaux votés aux art. 25 et 26 pendant le délai de contestation, sauf urgence. */
function anomaliesSuspensionArt42(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (s.majoriteResolution === null)
    return [
      anomalie(
        'majorite_resolution_non_renseignee',
        'alerte',
        "Majorité de la résolution exécutée non renseignée : sauf urgence, les travaux votés aux art. 25 et 26 ne s'exécutent pas avant la fin du délai de contestation.",
        FONDEMENT_SUSPENSION,
        true,
      ),
    ]
  const article = MAJORITES_SUSPENSIVES.get(s.majoriteResolution)
  if (article === undefined || urgenceDeclaree(s)) return []
  const fin = contexte.finDelaiContestationAg ?? null
  if (fin === null)
    return [
      anomalie(
        'delai_contestation_inconnu',
        'alerte',
        `Résolution votée à la majorité de l'${article} : fin du délai de contestation non calculée, vérifier que l'intervention ne tombe pas pendant la suspension de l'exécution.`,
        FONDEMENT_SUSPENSION,
        true,
      ),
    ]
  const execution = d.prevuLe ?? contexte.date
  if (execution > fin) return []
  return [
    anomalie(
      'execution_suspendue_art42',
      'bloquant',
      `Travaux votés à la majorité de l'${article} : exécution suspendue jusqu'à la fin du délai de contestation (${fr(fin)} inclus), sauf urgence déclarée ; intervention au ${fr(execution)}.`,
      FONDEMENT_SUSPENSION,
      true,
    ),
  ]
}

function anomaliesFondement(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (s.fondement === null)
    return [anomalie('fondement_non_renseigne', 'alerte', "Fondement de l'OS non renseigné (résolution, conseil syndical, entretien, urgence…).", null, true)]
  const cadre = CADRE_PAR_FONDEMENT[s.fondement]
  const anomalies: AnomalieEnvoiOs[] = []
  if (cadre.referenceAttendue && s.fondementReference === null)
    anomalies.push(anomalie('fondement_sans_reference', 'alerte', `OS en ${cadre.libelle} : référence de la décision à saisir.`, cadre.texte))
  if (s.fondement === 'urgence_sauvegarde')
    anomalies.push(
      anomalie(
        'urgence_suites',
        'alerte',
        "Travaux urgents de sa propre initiative : informer les copropriétaires et convoquer immédiatement une assemblée ; en vue de l'ouverture du chantier et de son premier approvisionnement, provision d'au plus le tiers du devis estimatif, sans délibération préalable de l'assemblée mais après avis du conseil syndical s'il en existe un.",
        'D. 1967 art. 37',
      ),
    )
  if (s.fondement === 'decision_conseil_syndical') anomalies.push(...anomaliesDelegationCs(contexte.decisionsAgEnVigueur))
  if (s.fondement === 'execution_resolution_ag') anomalies.push(...anomaliesSuspensionArt42(d, s, contexte))
  return anomalies
}

/** Cadre légal du marché (intervention seulement) : convention liée, conseil syndical, mise en concurrence, fondement. */
function anomaliesCadreLegal(d: Demande, s: SortieOrdreService, motifs: readonly MotifVisa[], contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (d.type !== 'intervention') return []
  const codes = new Set(motifs.map((m) => m.code))
  return [...anomaliesConvention(d, s, codes), ...anomaliesConseilSyndical(s, codes, contexte.date), ...anomaliesFondement(d, s, contexte)]
}

/** Devis associé échu avant que l'OS parvienne à l'entreprise (le jour même, sauf courrier : dès le jour de l'envoi). */
function anomaliesDevisAssocie(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  const validiteAu = contexte.validiteDevisAu ?? null
  if (d.devisAssocie === null || validiteAu === null) return []
  const papier = s.canal !== null && CANAUX_PAPIER.has(s.canal)
  if (papier && validiteAu <= contexte.date)
    return [
      anomalie(
        'devis_caduc',
        'alerte',
        `Devis associé valable jusqu'au ${fr(validiteAu)} : un courrier posté le ${fr(contexte.date)} ne parvient pas à l'entreprise avant l'échéance ; le devis sera caduc à la réception, l'OS vaudra offre nouvelle, à faire accepter par l'entreprise.`,
        FONDEMENT_CADUCITE,
        true,
      ),
    ]
  if (validiteAu >= contexte.date) return []
  return [
    anomalie(
      'devis_caduc',
      'alerte',
      `Devis associé valable jusqu'au ${fr(validiteAu)} : échu avant que l'OS parvienne à l'entreprise, il ne forme plus le contrat ; l'OS vaut offre nouvelle, à faire accepter par l'entreprise.`,
      FONDEMENT_CADUCITE,
    ),
  ]
}

const depuisAnomalieEntreprise = (a: AnomalieEntreprise): AnomalieEnvoiOs => anomalie(a.code, a.gravite, a.message, a.fondement, a.aConfirmer)

/** Pourquoi l'absence des pièces de l'entreprise bloque l'envoi (point 37 : vigilance, décennale) ; null : simple alerte. */
function blocageSansPieces(d: Demande, contexte: ContexteEnvoiOs): { raison: string; fondement: string } | null {
  if (contexte.controle?.decennaleObligatoire === true) return { raison: "les travaux sont soumis à l'assurance décennale obligatoire", fondement: FONDEMENT_DECENNALE }
  let montant: number | null
  try {
    montant = montantHtOperationDemande(d, contexte.controle?.montantHtOperationCentimes)
  } catch (erreur) {
    return { raison: `le montant HT de l'opération n'est pas établi (${messageErreur(erreur)})`, fondement: FONDEMENT_VIGILANCE }
  }
  if (montant === null) return { raison: "le montant HT de l'opération est inconnu (seuil de vigilance non appréciable)", fondement: FONDEMENT_VIGILANCE }
  if (montant >= SEUIL_VIGILANCE_HT_CENTIMES)
    return { raison: `l'opération de ${euros(montant)} HT atteint le seuil de vigilance (${euros(SEUIL_VIGILANCE_HT_CENTIMES)} HT)`, fondement: FONDEMENT_VIGILANCE }
  return null
}

/** Contrôle déclaratif de l'entreprise avant l'OS (point 37, via demandes.ts) ; une saisie impossible bloque l'envoi. */
function anomaliesControleDeclaratif(d: Demande, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  if (d.type !== 'intervention' || d.prestataireId === null) return []
  if (!contexte.pieces) {
    const blocage = blocageSansPieces(d, contexte)
    if (blocage)
      return [
        anomalie(
          'controle_declaratif_non_fait',
          'bloquant',
          `Contrôle déclaratif de l'entreprise non fait alors que ${blocage.raison} : fournir ses pièces (vigilance, décennale) avant l'envoi.`,
          blocage.fondement,
          true,
        ),
      ]
    return [anomalie('controle_declaratif_non_fait', 'alerte', "Contrôle déclaratif de l'entreprise non fait : fournir ses pièces (vigilance, décennale) avant l'envoi.")]
  }
  const options: OptionsControleDeclaratif = {
    ...contexte.controle,
    moment: 'ordre_de_service',
    date: contexte.date,
    decennaleObligatoire: contexte.controle?.decennaleObligatoire ?? null,
  }
  try {
    return controleDeclaratifDemande(d, contexte.pieces, options).map(depuisAnomalieEntreprise)
  } catch (erreur) {
    return [anomalie('controle_declaratif_impossible', 'bloquant', `Contrôle déclaratif impossible : ${messageErreur(erreur)}`)]
  }
}

/**
 * Contrôle avant l'envoi de l'OS : bloquants (l'envoi est refusé) et alertes. La route « envoyer » devra l'appeler avant
 * de créer la mission (branchement à faire).
 */
export function controlerAvantEnvoiOs(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiOs): AnomalieEnvoiOs[] {
  verifierLien(d, s)
  if (!estDateIsoValide(contexte.date)) throw new Error(`Date de l'envoi invalide (${contexte.date}) : AAAA-MM-JJ attendu.`)
  verifierDate('Fin de validité du devis associé', contexte.validiteDevisAu)
  verifierDate('Fin du délai de contestation', contexte.finDelaiContestationAg)
  const motifs = motifsVisa(d, s, contexte)
  return [
    ...anomaliesDemande(d, s.canal, contexte),
    ...anomaliesSortie(s, contexte),
    ...anomaliesVisa(d, s, motifs),
    ...anomaliesCadreLegal(d, s, motifs, contexte),
    ...anomaliesDevisAssocie(d, s, contexte),
    ...anomaliesControleDeclaratif(d, contexte),
  ]
}

// ─── Envoi, journal de diffusion et relance ───────────────────────────────────────────────────

type PieceDePreuve = 'missionId' | 'courrierId'

/** Pièce qui prouve l'envoi selon le canal (🔵). */
const PREUVE_PAR_CANAL: ReadonlyMap<CanalEnvoiOs, PieceDePreuve> = new Map<CanalEnvoiOs, PieceDePreuve>([
  ['messagerie_vitfix', 'missionId'],
  ['courrier_ar', 'courrierId'],
])

function evenementDiffusion(s: SortieOrdreService, saisie: SaisieDiffusion, nature: NatureDiffusion): EvenementDiffusion {
  verifierHorodatage('Diffusion', saisie.date, saisie.heure)
  const collaborateurId = saisie.collaborateurId.trim()
  if (!collaborateurId) throw new Error('Diffusion : identifiant du collaborateur attendu.')
  if (!CANAUX.has(saisie.canal)) throw new Error(`Canal d'envoi inconnu : « ${saisie.canal} ».`)
  if (!DESTINATAIRES.has(saisie.destinataire.type))
    throw new Error(`Destinataire « ${saisie.destinataire.type} » : une fiche porteuse est attendue (${FICHES_PORTEUSES.join(', ')}).`)
  const evenement: EvenementDiffusion = {
    date: saisie.date,
    heure: saisie.heure,
    collaborateurId,
    canal: saisie.canal,
    destinataire: creerRattachement(saisie.destinataire.type, saisie.destinataire.id),
    nature,
    referenceDiffusion: texteOuNull(saisie.referenceDiffusion),
    courrierId: texteOuNull(saisie.courrierId),
    missionId: texteOuNull(saisie.missionId),
  }
  const preuve = PREUVE_PAR_CANAL.get(evenement.canal)
  if (preuve && evenement[preuve] === null) throw new Error(`Diffusion par « ${evenement.canal} » : ${preuve} attendu (preuve de l'envoi).`)
  const dernier = s.journal.at(-1)
  if (dernier && horodatage(evenement) < horodatage(dernier))
    throw new Error(`Diffusion du ${horodatageFr(evenement)} antérieure à la dernière ligne du journal (${horodatageFr(dernier)}).`)
  return evenement
}

const ajouter = (s: SortieOrdreService, evenement: EvenementDiffusion): SortieOrdreService => ({ ...s, journal: [...s.journal, evenement] })

function verifierPremierEnvoi(d: Demande, s: SortieOrdreService, evenement: EvenementDiffusion, contexte: Omit<ContexteEnvoiOs, 'date'>): void {
  verifierSansBloquant(controlerAvantEnvoiOs(d, s, { ...contexte, date: evenement.date }), `OS ${d.numero ?? d.id} non envoyé`)
  if (evenement.destinataire.type !== 'Entreprise' || evenement.destinataire.id !== d.prestataireId)
    throw new Error(`Premier envoi : l'ordre de service part à l'entreprise de la demande (${d.prestataireId}).`)
  if (evenement.canal !== s.canal) throw new Error(`Premier envoi par « ${evenement.canal} » : le canal choisi est « ${s.canal ?? 'aucun'} ».`)
  const dernierVisa = s.historiqueVisa.at(-1)
  if (dernierVisa && horodatage(evenement) < horodatage(dernierVisa))
    throw new Error(
      `Premier envoi du ${horodatageFr(evenement)} antérieur au dernier événement du visa (${dernierVisa.action}, ${horodatageFr(dernierVisa)}) : le journal de preuve ne montre pas un OS parti avant son visa.`,
    )
}

function verifierRediffusion(d: Demande, s: SortieOrdreService): void {
  if (!s.diffusable) throw new Error(`OS ${d.numero ?? d.id} non diffusable : rediffusion impossible.`)
}

/**
 * Envoie l'OS (copie de la sortie, journal complété) : le premier envoi passe le contrôle avant l'envoi (contexte
 * obligatoire : pièces de l'entreprise, compte VitFix…) et part à l'entreprise par le canal choisi, jamais avant le dernier
 * événement du visa ; les suivants sont des rediffusions (copie, autre canal) d'un OS diffusable.
 */
export function envoyerOs(d: Demande, s: SortieOrdreService, saisie: SaisieDiffusion, contexte: Omit<ContexteEnvoiOs, 'date'>): SortieOrdreService {
  verifierLien(d, s)
  const dejaEnvoye = estEnvoye(s)
  const evenement = evenementDiffusion(s, saisie, dejaEnvoye ? 'rediffusion' : 'envoi')
  if (evenement.date < d.demandeLe)
    throw new Error(`Envoi du ${fr(evenement.date)} antérieur à la demande du ${fr(d.demandeLe)}.`)
  if (dejaEnvoye) verifierRediffusion(d, s)
  else verifierPremierEnvoi(d, s, evenement, contexte)
  return ajouter(s, evenement)
}

/** Ligne adressée à l'entreprise du premier envoi (relance, réception). */
function evenementVersEntreprise(s: SortieOrdreService, saisie: SaisieDiffusion, nature: NatureDiffusion, action: string): EvenementDiffusion {
  const envoi = premierEnvoi(s)
  if (!envoi) throw new Error(`${action} impossible : ordre de service jamais envoyé.`)
  const evenement = evenementDiffusion(s, saisie, nature)
  if (evenement.destinataire.type !== 'Entreprise' || evenement.destinataire.id !== envoi.destinataire.id)
    throw new Error(`${action} : elle concerne l'entreprise du premier envoi (${envoi.destinataire.id}).`)
  return evenement
}

/** Relance de l'entreprise (journal « relance ») ; la date de relance est vidée. */
export function relancerOs(s: SortieOrdreService, saisie: SaisieDiffusion): SortieOrdreService {
  const evenement = evenementVersEntreprise(s, saisie, 'relance', 'Relance')
  return { ...ajouter(s, evenement), relanceLe: null }
}

/**
 * Accusé de réception de l'entreprise (journal « reception »), distinct de l'envoi : le contrat se forme quand
 * l'acceptation parvient (C. civ. art. 1121) ; pour un écrit électronique hors des cas des art. 1125 et 1126, la remise
 * est effective à l'accusé de réception (art. 1127-4). Puis devisCaducALaReception.
 */
export function enregistrerReception(s: SortieOrdreService, saisie: SaisieDiffusion): SortieOrdreService {
  return ajouter(s, evenementVersEntreprise(s, saisie, 'reception', 'Réception'))
}

/**
 * Devis associé échu avant la réception enregistrée de l'OS : l'offre est caduque à l'expiration du délai fixé par son
 * auteur (C. civ. art. 1117, al. 1) et le contrat se forme quand l'acceptation parvient (art. 1121).
 */
export function devisCaducALaReception(d: Demande, s: SortieOrdreService, validiteDevisAu: string | null): AnomalieEnvoiOs[] {
  verifierLien(d, s)
  verifierDate('Fin de validité du devis associé', validiteDevisAu)
  const reception = s.journal.find((e) => e.nature === 'reception')
  if (d.devisAssocie === null || validiteDevisAu === null || !reception || reception.date <= validiteDevisAu) return []
  return [
    anomalie(
      'devis_caduc',
      'alerte',
      `Réception de l'OS le ${fr(reception.date)}, après la fin de validité du devis associé (${fr(validiteDevisAu)}) : le contrat ne s'est pas formé sur le devis ; l'OS vaut offre nouvelle, à faire accepter par l'entreprise.`,
      FONDEMENT_CADUCITE,
      true,
    ),
  ]
}

/**
 * Date de relance (copie) ; null l'efface. Après le premier envoi, une date antérieure à celui-ci est refusée ; avant,
 * elle bloque l'envoi (relance_avant_envoi).
 */
export function fixerRelance(s: SortieOrdreService, date: string | null): SortieOrdreService {
  if (date === null) return { ...s, relanceLe: null }
  verifierDate('Date de relance', date)
  const envoi = premierEnvoi(s)
  if (envoi && date < envoi.date)
    throw new Error(`Date de relance (${fr(date)}) antérieure au premier envoi (${fr(envoi.date)}).`)
  return { ...s, relanceLe: date }
}

export type PreuveDiffusion = 'trace_interne' | EtatNotificationCourrier

/**
 * Preuve d'une ligne du journal : la trace interne (journal horodaté) pour la messagerie, le courriel, le SMS et le
 * courrier simple ; pour le courrier AR, l'état de notification du courrier lié (courriers.ts).
 */
export function preuveDeDiffusion(evenement: EvenementDiffusion, courrier?: CourrierSuivi): PreuveDiffusion {
  if (evenement.canal !== 'courrier_ar') return 'trace_interne'
  if (!courrier) throw new Error(`Courrier AR ${evenement.courrierId ?? ''} : le courrier lié est attendu (preuve de notification).`)
  if (courrier.formeEnvoi !== FORME_ENVOI_PAR_CANAL.courrier_ar)
    throw new Error(`Courrier lié envoyé en « ${courrier.formeEnvoi} » : un courrier en AR est attendu pour ce canal.`)
  return etatNotificationCourrier(courrier)
}

// ─── Adaptateurs (branchements à faire plus tard) ─────────────────────────────────────────────

/** Élément du suivi « à faire » (famille et nature à ajouter à suivi-a-faire.ts, point 46). */
export type RelanceOsAFaire = Omit<ElementAFaire, 'famille' | 'nature'> & { famille: 'demandes'; nature: 'relance_os' }

/** Relances dues des OS envoyés, ni terminés ni refusés, triées par date. */
export function relancesOsDues(items: readonly { demande: Demande; sortie: SortieOrdreService }[]): RelanceOsAFaire[] {
  return items
    .flatMap(({ demande: d, sortie: s }): RelanceOsAFaire[] => {
      verifierLien(d, s)
      const envoi = premierEnvoi(s)
      if (s.relanceLe === null || envoi === null || d.statut === 'Terminé' || estRefusee(d)) return []
      return [
        {
          id: `demandes:relance_os:${d.id}`,
          famille: 'demandes',
          nature: 'relance_os',
          libelle: `Relancer l'entreprise : ordre de service ${d.numero ?? d.id} (${d.objet})`,
          date: s.relanceLe,
          mandatId: d.mandatId,
          objetId: d.id,
          assigneId: envoi.collaborateurId,
          aConfirmer: false,
        },
      ]
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export interface ContexteEnvoiVitfix {
  syndicArtisanId: string
  /** Libellé de la copropriété affiché au prestataire. */
  copropriete: string
  adresse?: string
  description?: string
  localisation?: string
  note?: string
}

/** Corps de l'action « envoyer » de la route, pour un OS envoyé par la messagerie VitFix. */
export function demandeEnvoiDepuisOs(d: Demande, s: SortieOrdreService, contexte: ContexteEnvoiVitfix): DemandeEnvoiOrdre {
  verifierLien(d, s)
  if (s.canal !== 'messagerie_vitfix') throw new Error(`OS ${d.numero ?? d.id} : canal « ${s.canal ?? 'aucun'} », pas la messagerie VitFix.`)
  if (d.numero === null) throw new Error(`Demande ${d.id} : N° d'OS absent, à numéroter avant l'envoi.`)
  const refuses = champsRefusesParLaRoute(d)
  if (refuses.length > 0) throw new Error(`Demande ${d.id} : ${refuses.map((r) => r.constat).join(' ; ')}.`)
  return {
    syndic_artisan_id: contexte.syndicArtisanId,
    copropriete: contexte.copropriete,
    adresse: contexte.adresse,
    objet: d.objet,
    description: contexte.description,
    localisation: contexte.localisation,
    urgence: s.delai,
    date_intervention: d.prevuLe ?? undefined,
    note: contexte.note,
    reference_aj: d.numero,
  }
}
