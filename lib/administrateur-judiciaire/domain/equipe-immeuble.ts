import { normaliserEspaces } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Équipe de l'immeuble (point 71 du bilan 2) : collaborateurs du cabinet affectés à l'immeuble d'un mandat, chacun avec
 * sa fonction, et le repère « => » de la grille Gestéam. Fonctions pures, sans date, sans écran ni table, sans donnée
 * personnelle (identifiants de collaborateurs seulement). Les rôles du mandat (responsable, comptable, assistant :
 * Mandat.roles, RolesMandat de suivi-a-faire.ts) restent une notion DISTINCTE, que ce module ne lit ni ne modifie.
 *
 * Sources Gestéam :
 * - 🟢 Tranche 41 § Fiche mandat — équipe et rôles : trois listes Responsable, Assistant(e), Comptable (les rôles du
 *   mandat) ; à côté, la grille « Équipe de l'immeuble » : Collaborateur · Fonction (Chargé(e) de relation,
 *   Gestionnaire, Comptable, Assistante…), un repère « => » sur certaines lignes, une case « Gestion manuelle »,
 *   `Ajouter`. La tranche déduisait (🔵) une équipe calculée depuis les rôles sauf « Gestion manuelle » cochée.
 * - 🟢 Tranche 43 § 17 (mandat en gestion) : cinq membres, cinq fonctions — chargé(e) de relation, associé, comptable,
 *   gestionnaire, assistante ; le repère « => » sur trois d'entre eux ; « Gestion manuelle » décochée ; pas d'infobulle.
 *   CORRECTION de la tranche 41 : l'équipe ne reprend pas les rôles du mandat (le responsable du mandat n'y figure pas,
 *   le comptable du mandat n'est pas celui de l'équipe, seule l'assistante est commune) : les deux notions sont
 *   indépendantes. 🔵 « => » marque les membres actifs ou destinataires (sens non confirmé, ⚪ dans la tranche).
 * - 🟢 Tranche 38 (suivi des éléments en cours) : rattachement par Responsable, Comptable ou Assistant du mandat, ou
 *   responsable de la fiche ; l'équipe de l'immeuble n'y figure pas.
 *
 * Règles du module :
 * - Fonctions : les cinq relevées en tranche 43 § 17 (FONCTIONS_EQUIPE_IMMEUBLE). Libellés : quatre lus dans la grille
 *   en tranche 41 (« Chargé(e) de relation », « Gestionnaire », « Comptable », « Assistante ») ; 🔵 « Associé » : forme
 *   exacte non relevée, déduite de la tranche 43 § 17 (texte courant, en minuscules : la phrase garde le « (e) » de
 *   « chargé(e) » et n'en met pas à « associé », mais Gestéam écrit « Associé(e) » dans d'autres listes, tranches 20 et
 *   23 ; 🔴 ci-dessous). La saisie donne le code ou le libellé de la grille (reprise Gestéam), lu par
 *   lireFonctionEquipe : seuls la forme Unicode et les espaces sont normalisés, ni la casse ni une forme voisine
 *   (« Chargé de relation », « Associé(e) ») ne sont devinées. Une autre valeur est refusée (🔴 liste complète et forme
 *   d'« Associé » non relevées, ci-dessous) : l'ajouter ici le jour où elle est connue. Les rôles du mandat
 *   (« Responsable », « Assistant(e) ») ne sont pas des fonctions ; « Comptable » est un mot commun aux deux.
 * - Un membre : un collaborateur (identifiant), une fonction, le repère `principal` (« => »). Un même collaborateur peut
 *   tenir plusieurs fonctions (une ligne par fonction) ; la même ligne (collaborateur et fonction) deux fois est refusée.
 * - 🔴 Repère « => » : lu ici « destinataire des notifications » (sens retenu par le bilan, non confirmé). AUCUNE règle
 *   d'unicité n'a été relevée : sur la seule fiche vue, chaque fonction n'avait qu'un membre (cinq membres, cinq
 *   fonctions) et trois lignes sur cinq portaient le repère ; on ne sait donc ni si une fonction peut compter deux
 *   membres, ni si deux membres d'une même fonction peuvent tous deux porter le repère. VitFix n'impose rien :
 *   plusieurs membres et plusieurs repères par fonction sont acceptés, une fonction sans repère aussi.
 * - 🔵 L'équipe n'entre PAS dans le portefeuille du suivi « à faire » ni dans la balance âgée (suivi-a-faire.ts) : ils
 *   restent fondés sur les trois rôles du mandat (tranche 38). L'équipe n'est pas déduite des rôles (tranche 43 § 17).
 * - 🔵 « Gestion manuelle » est conservée telle quelle et n'a aucun effet : la déduction de la tranche 41 (équipe calculée
 *   depuis les rôles) est démentie par la tranche 43, et ce qui serait calculé quand la case est décochée n'est pas connu.
 * - 🔵 D1 : l'équipe est rattachée au MANDAT (mandatId), comme ses rôles : la fiche Gestéam qui la porte est la fiche
 *   mandat ; un nouveau mandat sur la même copropriété a sa propre équipe. Une seule équipe par mandat, même quand il
 *   couvre plusieurs immeubles (🔴 ci-dessous).
 * - 🔵 Les fonctions de l'équipe ne sont pas les rôles de travail du cabinet (roles-cabinet.ts : Direction, Secrétariat,
 *   Gestion, Comptabilité, Juridique), qui règlent l'application ; aucune correspondance n'est faite. La fonction
 *   « Associé » n'est pas lue comme l'« Associé 1 / Associé 2 » du volet judiciaire (mandat-judiciaire.ts : les
 *   administrateurs désignés) : aucun lien relevé.
 *
 * Droit (relevé Légifrance du 04/11/2026, loi n° 65-557 et décret n° 67-223 en vigueur au 03/11/2026) : AUCUN TEXTE.
 * L'équipe de l'immeuble relève de l'organisation du cabinet (aucune occurrence d'« équipe » ni de « collaborateur »
 * dans la loi ; dans le décret, « collaboration » n'apparaît que pour le budget établi « en collaboration avec le conseil
 * syndical », annexe 1, III-7°). C'est une RÈGLE DE GESTION reprise de Gestéam.
 *
 * Branchements à faire (hors de ce module : schéma et écrans non modifiés) :
 * - Frédéric : stocker l'équipe sur le mandat, par exemple `Mandat.equipeImmeuble?: EquipeImmeuble` non indexé (comme
 *   `Mandat.roles`, sans changement de version de la base), créé par creerEquipeImmeuble.
 * - Écran de la fiche copropriété : fiche-copropriete.ts porte déjà une maquette `equipe: MembreEquipe[]` (rôle
 *   « Responsable », « Comptable », « Assistant(e) » ou « Gestionnaire », nom affiché du collaborateur), affichée par
 *   FicheCoproprieteDetail.tsx et nourrie par data/coproprietes.ts. Elle mêle les rôles du mandat et une fonction, ce
 *   que la tranche 43 § 17 dément, et n'a pas d'identifiant ni de repère « => » : à remplacer par EquipeImmeuble (le
 *   bilan disait « ni équipe » : seule cette maquette d'affichage existe).
 * - Notifications : un envoi « aux destinataires de l'équipe » lit destinatairesNotifications ; aucun envoi n'est codé.
 *
 * 🔴 Non établi (questions) :
 * - Hugo : le repère « => » désigne-t-il les destinataires des notifications, les membres actifs, ou autre chose ? Une
 *   fonction peut-elle compter deux membres, et deux repères ? (VitFix accepte les deux.)
 * - Hugo : liste complète des fonctions de la grille (tranche 41 : « Assistante… », liste déroulante non ouverte) :
 *   d'autres que les cinq relevées ?
 * - Hugo : libellé exact de la fonction associé dans la grille : Associé, Associé(e) ? VitFix lit « Associé » seul ;
 *   une reprise portant une autre forme est refusée (fonction inconnue) tant que la forme n'est pas relevée.
 * - Hugo ou Frédéric : que fait « Gestion manuelle » quand elle est décochée (équipe proposée depuis le portefeuille, le
 *   cabinet, autre) ? VitFix la garde sans effet.
 * - Hugo : dans le suivi « à faire », « de mon portefeuille » comprend-il les mandats où le collaborateur n'est que
 *   membre de l'équipe de l'immeuble ? Le réglage Gestéam (tranche 38) ne nomme que les trois rôles du mandat ; VitFix
 *   s'en tient à eux.
 * - Hugo : un mandat qui couvre plusieurs immeubles a-t-il une équipe par immeuble, ou une seule ? VitFix : une par
 *   mandat (la grille n'a été vue que sur la fiche mandat).
 */

/**
 * Fonctions relevées dans la grille « Équipe de l'immeuble » (tranche 43 § 17). Libellés de la grille lus en tranche 41,
 * sauf « Associé » (🔵 forme exacte non relevée, déduite de la tranche 43 § 17 ; 🔴 question dans l'en-tête).
 */
export const FONCTIONS_EQUIPE_IMMEUBLE = ['charge_de_relation', 'associe', 'comptable', 'gestionnaire', 'assistante'] as const
export type FonctionEquipeImmeuble = (typeof FONCTIONS_EQUIPE_IMMEUBLE)[number]

export const LIBELLES_FONCTIONS_EQUIPE_IMMEUBLE: Readonly<Record<FonctionEquipeImmeuble, string>> = {
  charge_de_relation: 'Chargé(e) de relation',
  associe: 'Associé',
  comptable: 'Comptable',
  gestionnaire: 'Gestionnaire',
  assistante: 'Assistante',
}

const FONCTIONS_CONNUES: ReadonlySet<string> = new Set<string>(FONCTIONS_EQUIPE_IMMEUBLE)

/** La valeur est-elle l'une des fonctions relevées (code) ? */
export const estFonctionEquipeImmeuble = (valeur: string): valeur is FonctionEquipeImmeuble => FONCTIONS_CONNUES.has(valeur)

/** Code ou libellé de la grille (normalisés) → fonction. */
const FONCTION_PAR_SAISIE: ReadonlyMap<string, FonctionEquipeImmeuble> = new Map(
  FONCTIONS_EQUIPE_IMMEUBLE.flatMap((fonction): [string, FonctionEquipeImmeuble][] => [
    [fonction, fonction],
    [normaliserEspaces(LIBELLES_FONCTIONS_EQUIPE_IMMEUBLE[fonction]), fonction],
  ]),
)

/**
 * Fonction désignée par son code ou par le libellé de la grille Gestéam (reprise ; « Associé » 🔵 déduit) ; null sinon.
 * Seuls la forme Unicode et les espaces sont normalisés : ni la casse ni une forme voisine ne sont devinées.
 */
export const lireFonctionEquipe = (valeur: string): FonctionEquipeImmeuble | null =>
  FONCTION_PAR_SAISIE.get(normaliserEspaces(valeur)) ?? null

/** Une ligne de la grille : collaborateur, fonction, repère « => ». */
export interface MembreEquipeImmeuble {
  collaborateurId: string
  fonction: FonctionEquipeImmeuble
  /** Repère « => » de la grille : 🔴 lu « destinataire des notifications », sens non confirmé ; sans règle d'unicité. */
  principal: boolean
}

/** Équipe de l'immeuble d'un mandat ; distincte des rôles du mandat (RolesMandat). */
export interface EquipeImmeuble {
  mandatId: string
  /** Lignes de la grille, dans l'ordre de saisie. */
  membres: MembreEquipeImmeuble[]
  /** Case « Gestion manuelle » : conservée, sans effet (🔴 sens non établi). */
  gestionManuelle: boolean
}

export interface SaisieEquipeImmeuble {
  mandatId: string
  /** `fonction` : code (FONCTIONS_EQUIPE_IMMEUBLE) ou libellé de la grille (lireFonctionEquipe). */
  membres: readonly { collaborateurId: string; fonction: string; principal?: boolean }[]
  gestionManuelle?: boolean
}

const cleMembre = (collaborateurId: string, fonction: FonctionEquipeImmeuble): string => JSON.stringify([collaborateurId, fonction])

function verifierMembre(
  membre: SaisieEquipeImmeuble['membres'][number],
  rang: number,
  vus: Set<string>,
): MembreEquipeImmeuble {
  const collaborateurId = membre.collaborateurId.trim()
  if (!collaborateurId) throw new Error(`Équipe de l'immeuble, ligne ${rang} : collaborateur non désigné.`)
  const fonction = lireFonctionEquipe(membre.fonction)
  if (fonction === null)
    throw new Error(
      `Équipe de l'immeuble, ligne ${rang} : fonction « ${membre.fonction} » inconnue (${Object.values(LIBELLES_FONCTIONS_EQUIPE_IMMEUBLE).join(', ')}).`,
    )
  const cle = cleMembre(collaborateurId, fonction)
  if (vus.has(cle))
    throw new Error(
      `Équipe de l'immeuble, ligne ${rang} : collaborateur ${collaborateurId} déjà inscrit comme « ${LIBELLES_FONCTIONS_EQUIPE_IMMEUBLE[fonction]} ».`,
    )
  vus.add(cle)
  return { collaborateurId, fonction, principal: membre.principal === true }
}

/**
 * Équipe de l'immeuble d'un mandat, vérifiée : mandat désigné, chaque ligne avec un collaborateur et une fonction
 * relevée (code ou libellé de la grille), pas deux fois la même ligne. Ordre conservé ; une équipe vide est admise.
 * Lève une erreur sinon.
 */
export function creerEquipeImmeuble(saisie: SaisieEquipeImmeuble): EquipeImmeuble {
  const mandatId = saisie.mandatId.trim()
  if (!mandatId) throw new Error("Équipe de l'immeuble sans mandat : l'équipe est rattachée au mandat (D1).")
  const vus = new Set<string>()
  const membres = saisie.membres.map((membre, i) => verifierMembre(membre, i + 1, vus))
  return { mandatId, membres, gestionManuelle: saisie.gestionManuelle === true }
}

const sansDoublon = (identifiants: readonly string[]): string[] => [...new Set(identifiants)]

/**
 * Collaborateurs portant le repère « => » (🔴 lu « destinataires des notifications »), dans l'ordre de la grille, une
 * fois chacun ; limité à une fonction si elle est donnée. Liste vide si aucun repère : rien n'est déduit des rôles.
 */
export function destinatairesNotifications(equipe: EquipeImmeuble, fonction?: FonctionEquipeImmeuble): string[] {
  return sansDoublon(
    equipe.membres
      .filter((membre) => membre.principal && (fonction === undefined || membre.fonction === fonction))
      .map((membre) => membre.collaborateurId),
  )
}

/** Collaborateurs de l'équipe tenant la fonction, repère ou non, dans l'ordre de la grille. */
export function membresDeFonction(equipe: EquipeImmeuble, fonction: FonctionEquipeImmeuble): string[] {
  return sansDoublon(equipe.membres.filter((membre) => membre.fonction === fonction).map((membre) => membre.collaborateurId))
}
