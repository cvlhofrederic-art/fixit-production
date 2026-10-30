import {
  ajouterJours,
  dateIsoVersFr,
  ecartJours,
  estDateIsoValide,
  verifierAujourdhui,
} from '@/lib/administrateur-judiciaire/domain/dates'
import {
  enchainer,
  etatEtape,
  realiserEtape,
  validerEtape,
  type Etape,
  type EtapeTypeProcessus,
  type StatutEtape,
} from '@/lib/administrateur-judiciaire/domain/etapes'
import { creerRattachement, memeRattachement, type FicheLiee, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'

/**
 * Étapes d'un dossier (point 48 du bilan 2) : rattachement, instructions, « à faire le », durées, accusé au demandeur,
 * date de création et origine, règle de suivi « étape automatique non réalisée après N jours ». Fonctions pures, dates
 * AAAA-MM-JJ, durées en minutes entières, sans écran ni table : la table d'étapes (à la place de la table `taches`) et
 * l'écran relèvent de Frédéric. Complète etapes.ts (PR #566), inchangé : une EtapeDossier est une Etape enrichie, donc
 * etatEtape, realiserEtape, validerEtape, enchainer et suivi-a-faire.depuisEtapes la prennent telle quelle.
 *
 * Gestéam (cartographie, tranches lues) :
 * 🟢 Tranche 35 § Étapes, fiche : « Le » (date, heure) ; Titre ; Étape type ; rattachement Immeuble, Mandat, Entreprise,
 *   Personne ; Demandeur ; Limite ; Instructions (texte). Réalisation : « À faire le » (case Fixe), Durée, Collaborateur,
 *   Fait le, case « Accusé de réalisation au demandeur ». Validation : Collaborateur, « Prévue le » (case Fixe), Durée,
 *   Validée le, Sans objet le, Alerte de sécurité. Programmation : durées estimées / réelles (réalisation, validation),
 *   « En cours depuis », Cumul. Boutons Enchaînement, Dupliquer, Ajouter. Recherche : « Créée par / du … au », « À faire
 *   du … au », « À valider du … au », Limite, Dossier.
 * 🟢 Tranche 14 § 6 : cinq acteurs (créateur, demandeur, réalisateur, valideur, collaborateur assigné), quatre dates
 *   (création, à faire, à valider, limite).
 * 🟢 Tranche 42 § Étapes du contentieux : « Copie au CS pour info », créée « Automatique » à la date de la mise en
 *   demeure, rattachée au dossier Contentieux (aucun texte lu ne l'impose ; usage du cabinet ou contrat : question 7).
 * 🟢 Tranche 43 § 1 : une étape automatique, jamais réalisée (date « 00/00/00 » dans le Flux), reste ouverte depuis des
 *   années ; aucune relance ne l'a soldée. D'où la règle « étape automatique non réalisée après N jours », comptée ici
 *   depuis la création (🔵 : la date vide du Flux n'est pas celle de création, connue par la tranche 42).
 * 🟢 Tranche 38, réglage du suivi : famille Étapes « À faire · Relance d'étape · Dossier (filtre) ».
 * 🔵 Déduits :
 * - l'origine se lit dans « Créée par » : « Automatique » à la place d'un collaborateur (creeeParId null) ;
 * - la colonne Date de la liste est la date « Le » de création ; le rattachement passe par le Rattachement générique du
 *   point 47 (Immeuble → Copropriété, Mandat → dossier « Mandat de syndic », Personne → Identité, Dossier → type DOSSIER) ;
 * - libellés de statut autres que « À faire » ; durées en minutes entières ; « En cours depuis » compté de la création
 *   jusqu'à la réalisation (ou aujourd'hui) ; pas d'accusé quand le demandeur a lui-même réalisé l'étape ; anomalies de
 *   programmation (avertissements, jamais bloquants) ; réalisateur et valideur vides ou blancs valent « aucun » ; pas de
 *   validation d'une étape sans valideur ou « sans objet » (« Terminée »), ni de seconde validation ;
 * - l'enchaînement garde le dossier et les acteurs, remet à zéro la saisie propre à l'étape (« sans objet », instructions,
 *   programmation, durées, case d'accusé) : enchainer recopie toute l'étape précédente ; instructions et case d'accusé se
 *   ressaisissent ensuite (programmerEtape, ou la case au moment de réaliser) ;
 * - la règle des N jours s'applique avec ou sans limite, et « Relance d'étape » (tranche 38) en est rapprochée sans
 *   certitude : le suivi reçoit la date de relance, même future, et le réglage y applique l'horizon et le week-end ; N est
 *   plafonné (JOURS_SUIVI_ETAPE_MAX, garde-fou). Heures, agenda et report d'agenda : point 68 ; déclencheur par courrier et
 *   mode de réalisation : point 50 ; modèles par type de dossier : point 49.
 * 🔴 Non établi (fiches lues vides, aucun « Effectuer » actionné ; aucun texte) — questions :
 * 1. Hugo : sur une étape issue d'« Enchaînement », « Créée par » affiche-t-il « Automatique » ou le collaborateur qui a
 *    cliqué ? (origine passée à enchainerEtapeDossier)
 * 2. Frédéric : quelle valeur de N pour « étape automatique non réalisée » (30 jours proposés) ; réglage par cabinet ou
 *    par collaborateur ?
 * 3. Hugo : quelle est l'unité des champs Durée (minutes, heures, hh:mm) ?
 * 4. Hugo : sous quelle forme part l'« Accusé de réalisation au demandeur » (mémo interne, e-mail) ; sert-il seulement
 *    entre collaborateurs, ou aussi envers un demandeur extérieur (copropriétaire, conseil syndical) ?
 * 5. Hugo : que signifie la case « Fixe » à côté de « À faire le » et de « Prévue le » ?
 * 6. Hugo : « En cours depuis » se compte-t-il depuis la création ou depuis « à faire le » ?
 * 7. Hugo : l'étape automatique « Copie au CS pour info » vient-elle d'un usage du cabinet ou du contrat de syndic ?
 * 8. Frédéric ou Hugo : quand un processus d'étapes modélise un délai légal (ex. 30 j de L. 1965 art. 19-2), la limite
 *    de l'étape suivante doit-elle partir de la première présentation ou de la transmission de l'avis électronique
 *    (D. 1967 art. 64 et 64-1) et non de la réalisation (l'envoi) ? Sinon, ces délais restent marqués « de gestion ».
 *    Frédéric : la prorogation au premier jour ouvrable (CPC art. 642) s'applique-t-elle à ce délai de 30 jours ?
 * 9. Frédéric : dans « à compter de la demande » (L. 1965 art. 8-2 et 21), compte-t-on de l'envoi ou de la réception
 *    par le syndic ? La date de création d'une étape n'est pas, à ce jour, la date de la demande.
 *
 * Le droit (relevé sur Légifrance le 29/10/2026) :
 * - aucun texte ne régit le rattachement, les instructions, « à faire le », la date de création, l'origine, les durées,
 *   ni la règle des N jours (loi n° 65-557, décret n° 67-223, recherche plein texte) : ce sont des règles de GESTION, et N
 *   un réglage du cabinet, jamais un délai légal ;
 * - accusé au demandeur : aucun article de la loi n° 65-557 ni du décret n° 67-223 n'oblige le syndic ou l'administrateur
 *   provisoire à accuser réception d'une demande ; 🔵 le CRPA (art. L. 112-3) vise l'« administration » au sens de
 *   l'art. L. 100-3, ce qu'ils ne sont pas (déduit, sans jurisprudence lue). L'accusé reste une description, rien n'est
 *   envoyé ;
 * - 🔵 la date de création d'une étape née d'une demande pourra servir aux délais comptés « à compter de la demande »
 *   (L. 1965 art. 8-2 al. 3, fiche synthétique ; art. 21 al. 7, pièces demandées par le conseil syndical : un mois, puis
 *   pénalités par jour de retard), une fois tranchée la question 9 ; ce module ne calcule aucun de ces délais ;
 * - 🔵 l'enchaînement fixe la limite à « réalisation + délai » : c'est un délai de gestion. Un délai légal ouvert par une
 *   notification part du lendemain de la transmission de l'avis électronique (D. 1967 art. 64, dernier al.) ou de la
 *   première présentation de la lettre recommandée (art. 64-1) : il relève du moteur de délais, pas de ce module ;
 * - 🔵 les durées réelles servent de justificatif du temps passé (contrat type, D. 1967 annexe 1, point 7.2.1 : « au
 *   prorata du temps passé » ; art. 61-1-5 II : acomptes de l'administrateur provisoire sur justification des diligences).
 */

export const ORIGINES_ETAPE = ['manuelle', 'automatique'] as const
export type OrigineEtape = (typeof ORIGINES_ETAPE)[number]

/** Ce qu'affiche « Créée par » : 🟢 « Automatique » pour une étape créée par le logiciel. */
export const LIBELLES_ORIGINE_ETAPE: Record<OrigineEtape, string> = { manuelle: 'Manuelle', automatique: 'Automatique' }

/** 🟢 « À faire » observé ; 🔵 les autres libellés. */
export const LIBELLES_STATUT_ETAPE: Record<StatutEtape, string> = {
  a_faire: 'À faire',
  a_valider: 'À valider',
  validee: 'Validée',
  terminee: 'Terminée',
}

/** Onglet Programmation : durées en minutes entières, positives ou nulles (🔵 unité VitFix ; 🔴 unité Gestéam). */
export interface DureesEtape {
  realisationEstimee: number | null
  realisationReelle: number | null
  validationEstimee: number | null
  validationReelle: number | null
}

export interface EtapeDossier extends Etape {
  /** Date « Le » de la fiche : création (AAAA-MM-JJ). */
  creeeLe: string
  origine: OrigineEtape
  /** Collaborateur créateur ; null pour une étape automatique (« Automatique »). */
  creeeParId: string | null
  /** Dossiers et fiches porteuses de l'étape (point 47). */
  rattachements: Rattachement[]
  instructions: string
  /** « À faire le » (sous-onglet Réalisation). */
  aFaireLe: string | null
  /** Case « Fixe » de « À faire le » (🔴 sens non observé : conservée telle quelle). */
  aFaireLeFixe: boolean
  /** « Prévue le » (sous-onglet Validation). */
  validationPrevueLe: string | null
  /** Case « Fixe » de « Prévue le » (🔴 sens non observé). */
  validationPrevueLeFixe: boolean
  /** Case « Accusé de réalisation au demandeur ». */
  accuseAuDemandeur: boolean
  durees: DureesEtape
}

export interface SaisieEtapeDossier {
  id: string
  titre: string
  etapeType?: string | null
  creeeLe: string
  origine: OrigineEtape
  /** Obligatoire pour une étape manuelle ; absent ou null pour une étape automatique. */
  creeeParId?: string | null
  demandeurId: string
  realisateurId?: string | null
  validateurId?: string | null
  limite?: string | null
  alerteSecurite?: string | null
  rattachements?: readonly Rattachement[]
  instructions?: string
  aFaireLe?: string | null
  aFaireLeFixe?: boolean
  validationPrevueLe?: string | null
  validationPrevueLeFixe?: boolean
  accuseAuDemandeur?: boolean
  /** Durées estimées ; les durées réelles se saisissent à la réalisation et à la validation. */
  durees?: { realisationEstimee?: number | null; validationEstimee?: number | null }
}

// ─── Contrôles ──────────────────────────────────────────────────────────────────────────────

const texteObligatoire = (valeur: string, message: string): string => {
  const brut = valeur.trim()
  if (!brut) throw new Error(message)
  return brut
}

const verifierDateFacultative = (valeur: string | null | undefined, quoi: string): void => {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`${quoi} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
}

const verifierDateObligatoire = (valeur: string, quoi: string): void => {
  if (!estDateIsoValide(valeur)) throw new Error(`${quoi} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
}

const verifierDuree = (valeur: number | null | undefined, quoi: string): void => {
  if (valeur != null && (!Number.isInteger(valeur) || valeur < 0))
    throw new Error(`${quoi} invalide (${valeur}) : minutes entières, positives ou nulles, attendues.`)
}

type ChampDateFacultative = 'limite' | 'alerteSecurite' | 'aFaireLe' | 'validationPrevueLe'

const DATES_FACULTATIVES: readonly [ChampDateFacultative, string][] = [
  ['limite', 'Limite'],
  ['alerteSecurite', 'Alerte de sécurité'],
  ['aFaireLe', 'Date « à faire le »'],
  ['validationPrevueLe', 'Date de validation prévue'],
]

function verifierDatesEtape(saisie: SaisieEtapeDossier): void {
  verifierDateObligatoire(saisie.creeeLe, 'Date de création')
  for (const [champ, quoi] of DATES_FACULTATIVES) verifierDateFacultative(saisie[champ], quoi)
}

/** Créateur retenu : obligatoire pour une étape manuelle ; aucun pour une étape automatique. */
function verifierOrigine(origine: OrigineEtape, creeeParId: string | null | undefined): string | null {
  if (!(ORIGINES_ETAPE as readonly string[]).includes(origine))
    throw new Error(`Origine d’étape inconnue : « ${origine} » (manuelle ou automatique attendue).`)
  const createur = creeeParId?.trim() ?? ''
  if (origine === 'automatique') {
    if (createur) throw new Error('Étape automatique : aucun créateur attendu (affichée « Automatique »).')
    return null
  }
  if (!createur) throw new Error('Étape manuelle : créateur attendu.')
  return createur
}

/** Rattachements contrôlés (creerRattachement), sans doublon, dans l'ordre reçu. */
function rattachementsUniques(rattachements: readonly Rattachement[]): Rattachement[] {
  const retenus: Rattachement[] = []
  for (const r of rattachements) {
    const controle = creerRattachement(r.type, r.id)
    if (!retenus.some((x) => memeRattachement(x, controle))) retenus.push(controle)
  }
  return retenus
}

const dureesVides = (): DureesEtape => ({ realisationEstimee: null, realisationReelle: null, validationEstimee: null, validationReelle: null })

/** Identifiant facultatif (réalisateur, valideur) : espaces retirés ; vide ou blanc = aucun. */
const idFacultatif = (valeur: string | null | undefined): string | null => valeur?.trim() || null

// ─── Création ───────────────────────────────────────────────────────────────────────────────

/** Champs hérités d'Etape : acteurs, limite, alerte ; ni réalisée ni validée. */
function champsEtape(saisie: SaisieEtapeDossier): Etape {
  return {
    id: texteObligatoire(saisie.id, 'Identifiant d’étape attendu.'),
    titre: texteObligatoire(saisie.titre, 'Titre de l’étape attendu.'),
    etapeType: saisie.etapeType ?? null,
    demandeurId: texteObligatoire(saisie.demandeurId, 'Demandeur de l’étape attendu.'),
    realisateurId: idFacultatif(saisie.realisateurId),
    validateurId: idFacultatif(saisie.validateurId),
    limite: saisie.limite ?? null,
    alerteSecurite: saisie.alerteSecurite ?? null,
    faitLe: null,
    valideeLe: null,
    validationSansObjet: false,
    compteRendu: '',
  }
}

/** Programmation saisie à la création : « à faire le », « prévue le », cases Fixe et d'accusé. */
function champsProgrammation(
  saisie: SaisieEtapeDossier,
): Pick<EtapeDossier, 'aFaireLe' | 'aFaireLeFixe' | 'validationPrevueLe' | 'validationPrevueLeFixe' | 'accuseAuDemandeur'> {
  return {
    aFaireLe: saisie.aFaireLe ?? null,
    aFaireLeFixe: saisie.aFaireLeFixe ?? false,
    validationPrevueLe: saisie.validationPrevueLe ?? null,
    validationPrevueLeFixe: saisie.validationPrevueLeFixe ?? false,
    accuseAuDemandeur: saisie.accuseAuDemandeur ?? false,
  }
}

/**
 * Nouvelle étape, à faire. Refus : identifiant, titre ou demandeur vides ; date invalide ; origine inconnue ; étape
 * manuelle sans créateur ou automatique avec un créateur ; durée non entière ou négative ; rattachement hors référentiel.
 * Réalisateur et valideur vides ou blancs : aucun. La saisie reçue n'est pas modifiée.
 */
export function creerEtapeDossier(saisie: SaisieEtapeDossier): EtapeDossier {
  verifierDatesEtape(saisie)
  const creeeParId = verifierOrigine(saisie.origine, saisie.creeeParId)
  const realisationEstimee = saisie.durees?.realisationEstimee ?? null
  const validationEstimee = saisie.durees?.validationEstimee ?? null
  verifierDuree(realisationEstimee, 'Durée de réalisation estimée')
  verifierDuree(validationEstimee, 'Durée de validation estimée')
  return {
    ...champsEtape(saisie),
    creeeLe: saisie.creeeLe,
    origine: saisie.origine,
    creeeParId,
    rattachements: rattachementsUniques(saisie.rattachements ?? []),
    instructions: (saisie.instructions ?? '').trim(),
    ...champsProgrammation(saisie),
    durees: { ...dureesVides(), realisationEstimee, validationEstimee },
  }
}

// ─── Rattachement et onglet Étapes d'un dossier ─────────────────────────────────────────────

/** Ajoute un rattachement (contrôlé, sans doublon). L'étape reçue n'est pas modifiée. */
export function rattacherEtape(etape: EtapeDossier, rattachement: Rattachement): EtapeDossier {
  return { ...etape, rattachements: rattachementsUniques([...etape.rattachements, rattachement]) }
}

export function detacherEtape(etape: EtapeDossier, rattachement: Rattachement): EtapeDossier {
  const cible = creerRattachement(rattachement.type, rattachement.id)
  return { ...etape, rattachements: etape.rattachements.filter((r) => !memeRattachement(r, cible)) }
}

export interface FicheEtape extends FicheLiee {
  titre: string
  statut: string
}

/**
 * Étapes en fiches liées (colonnes Date · Statut · Titre ; le mandat se lit dans les rattachements), à passer à
 * fiches-liees.fichesLiees pour l'onglet Étapes d'un dossier : date de création, statut en clair au jour donné.
 */
export function etapesEnFichesLiees(etapes: readonly EtapeDossier[], aujourdhui: string): FicheEtape[] {
  verifierAujourdhui(aujourdhui)
  return etapes.map((etape) => ({
    id: etape.id,
    date: etape.creeeLe,
    statut: LIBELLES_STATUT_ETAPE[etatEtape(etape, aujourdhui).statut],
    titre: etape.titre,
    rattachements: [...etape.rattachements],
  }))
}

// ─── Programmation ──────────────────────────────────────────────────────────────────────────

/**
 * Champ absent : inchangé ; null : effacé. Instructions et case d'accusé se saisissent aussi après la création (🟢 tranche
 * 35 : Instructions sur la fiche, case d'accusé au sous-onglet Réalisation), notamment sur une étape enchaînée qui les
 * reçoit vides ; instructions blanches : effacées.
 */
export interface ProgrammationEtape {
  aFaireLe?: string | null
  aFaireLeFixe?: boolean
  validationPrevueLe?: string | null
  validationPrevueLeFixe?: boolean
  dureeRealisationEstimee?: number | null
  dureeValidationEstimee?: number | null
  instructions?: string
  accuseAuDemandeur?: boolean
}

const garder = <T>(saisi: T | undefined, actuel: T): T => (saisi === undefined ? actuel : saisi)

export function programmerEtape(etape: EtapeDossier, programmation: ProgrammationEtape): EtapeDossier {
  verifierDateFacultative(programmation.aFaireLe, 'Date « à faire le »')
  verifierDateFacultative(programmation.validationPrevueLe, 'Date de validation prévue')
  verifierDuree(programmation.dureeRealisationEstimee, 'Durée de réalisation estimée')
  verifierDuree(programmation.dureeValidationEstimee, 'Durée de validation estimée')
  return {
    ...etape,
    instructions: garder(programmation.instructions?.trim(), etape.instructions),
    accuseAuDemandeur: garder(programmation.accuseAuDemandeur, etape.accuseAuDemandeur),
    aFaireLe: garder(programmation.aFaireLe, etape.aFaireLe),
    aFaireLeFixe: garder(programmation.aFaireLeFixe, etape.aFaireLeFixe),
    validationPrevueLe: garder(programmation.validationPrevueLe, etape.validationPrevueLe),
    validationPrevueLeFixe: garder(programmation.validationPrevueLeFixe, etape.validationPrevueLeFixe),
    durees: {
      ...etape.durees,
      realisationEstimee: garder(programmation.dureeRealisationEstimee, etape.durees.realisationEstimee),
      validationEstimee: garder(programmation.dureeValidationEstimee, etape.durees.validationEstimee),
    },
  }
}

export const ANOMALIES_PROGRAMMATION = [
  'a_faire_avant_creation',
  'a_faire_apres_limite',
  'validation_prevue_avant_a_faire',
  'validation_prevue_sans_validateur',
] as const
export type AnomalieProgrammation = (typeof ANOMALIES_PROGRAMMATION)[number]

export const LIBELLES_ANOMALIES_PROGRAMMATION: Record<AnomalieProgrammation, string> = {
  a_faire_avant_creation: '« À faire le » antérieur à la création de l’étape',
  a_faire_apres_limite: '« À faire le » postérieur à la limite',
  validation_prevue_avant_a_faire: 'Validation prévue avant la date « à faire le »',
  validation_prevue_sans_validateur: 'Validation prévue sans collaborateur pour valider',
}

/** 🔵 Incohérences de programmation : avertissements à afficher, jamais bloquants. */
export function anomaliesProgrammation(etape: EtapeDossier): AnomalieProgrammation[] {
  const { aFaireLe, validationPrevueLe, limite } = etape
  const anomalies: AnomalieProgrammation[] = []
  if (aFaireLe !== null && aFaireLe < etape.creeeLe) anomalies.push('a_faire_avant_creation')
  if (aFaireLe !== null && limite !== null && aFaireLe > limite) anomalies.push('a_faire_apres_limite')
  if (validationPrevueLe !== null && aFaireLe !== null && validationPrevueLe < aFaireLe) anomalies.push('validation_prevue_avant_a_faire')
  if (validationPrevueLe !== null && !etape.validateurId) anomalies.push('validation_prevue_sans_validateur')
  return anomalies
}

// ─── Réalisation, accusé au demandeur, validation ──────────────────────────────────────────

/** Accusé de réalisation : une description pure, adressée au demandeur ; rien n'est envoyé (🔴 forme Gestéam non vue). */
export interface AccuseRealisation {
  etapeId: string
  /** Le demandeur de l'étape. */
  destinataireId: string
  realiseParId: string | null
  titre: string
  faitLe: string
  compteRendu: string
}

/** Case cochée et étape réalisée par un autre que le demandeur (🔵 : on ne s'accuse pas réception à soi-même). */
function accuseDeRealisation(etape: EtapeDossier): AccuseRealisation | null {
  if (!etape.accuseAuDemandeur || etape.faitLe === null || etape.demandeurId === etape.realisateurId) return null
  return {
    etapeId: etape.id,
    destinataireId: etape.demandeurId,
    realiseParId: etape.realisateurId,
    titre: etape.titre,
    faitLe: etape.faitLe,
    compteRendu: etape.compteRendu,
  }
}

/**
 * Réalise l'étape (etapes.realiserEtape) et note la durée réelle ; produit l'accusé au demandeur si la case est cochée
 * (`accuseAuDemandeur` : la case cochée ou décochée au moment de réaliser, sous-onglet Réalisation ; absente : celle de
 * l'étape). Refus : date invalide, étape déjà réalisée (un second accusé partirait), réalisation antérieure à la création.
 */
export function realiserEtapeDossier(
  etape: EtapeDossier,
  {
    date,
    compteRendu,
    dureeReelleMinutes = null,
    accuseAuDemandeur = etape.accuseAuDemandeur,
  }: { date: string; compteRendu: string; dureeReelleMinutes?: number | null; accuseAuDemandeur?: boolean },
): { etape: EtapeDossier; accuse: AccuseRealisation | null } {
  verifierDateObligatoire(date, 'Date de réalisation')
  if (etape.faitLe !== null) throw new Error(`Réalisation refusée : l’étape est déjà réalisée (le ${dateIsoVersFr(etape.faitLe)}).`)
  if (date < etape.creeeLe)
    throw new Error(`Réalisation refusée : le ${dateIsoVersFr(date)} précède la création de l’étape (${dateIsoVersFr(etape.creeeLe)}).`)
  verifierDuree(dureeReelleMinutes, 'Durée de réalisation réelle')
  const faite: EtapeDossier = {
    ...etape,
    ...realiserEtape(etape, { date, compteRendu }),
    accuseAuDemandeur,
    durees: { ...etape.durees, realisationReelle: dureeReelleMinutes },
  }
  return { etape: faite, accuse: accuseDeRealisation(faite) }
}

/** Refus de validation : avant la réalisation ou à une date antérieure, sans valideur, « sans objet », déjà validée. */
function verifierValidationPossible(etape: EtapeDossier, date: string): void {
  if (etape.faitLe === null) throw new Error('Validation refusée : l’étape n’est pas encore réalisée.')
  if (date < etape.faitLe)
    throw new Error(`Validation refusée : le ${dateIsoVersFr(date)} précède la réalisation (${dateIsoVersFr(etape.faitLe)}).`)
  if (!etape.validateurId) throw new Error('Validation refusée : aucune validation prévue (pas de collaborateur pour valider).')
  if (etape.validationSansObjet) throw new Error('Validation refusée : la validation de cette étape est « sans objet ».')
  if (etape.valideeLe !== null) throw new Error(`Validation refusée : l’étape est déjà validée (le ${dateIsoVersFr(etape.valideeLe)}).`)
}

/**
 * Valide l'étape (etapes.validerEtape) et note la durée réelle de validation, qui entre dans le cumul du temps passé.
 * Refus : date invalide ou durée invalide, et les cas de verifierValidationPossible : une étape sans valideur ou
 * « sans objet » est « Terminée » (etatEtape) et n'attend aucune validation ; une seconde validation écraserait la
 * première date et sa durée.
 */
export function validerEtapeDossier(
  etape: EtapeDossier,
  { date, dureeReelleMinutes = null }: { date: string; dureeReelleMinutes?: number | null },
): EtapeDossier {
  verifierDateObligatoire(date, 'Date de validation')
  verifierValidationPossible(etape, date)
  verifierDuree(dureeReelleMinutes, 'Durée de validation réelle')
  return { ...etape, ...validerEtape(etape, date), durees: { ...etape.durees, validationReelle: dureeReelleMinutes } }
}

// ─── Durées ─────────────────────────────────────────────────────────────────────────────────

export interface BilanDureesEtape {
  /** 🔵 De la création à la réalisation, ou à aujourd'hui tant qu'elle est à faire (🔴 point de départ Gestéam). */
  enCoursDepuisJours: number
  /** Réel − estimé, en minutes ; null si l'une des deux manque. */
  ecartRealisationMinutes: number | null
  ecartValidationMinutes: number | null
  /** Somme des durées réelles connues ; null si aucune. */
  cumulReelMinutes: number | null
}

const ecartDurees = (estimee: number | null, reelle: number | null): number | null =>
  estimee === null || reelle === null ? null : reelle - estimee

export function bilanDurees(etape: EtapeDossier, aujourdhui: string): BilanDureesEtape {
  verifierAujourdhui(aujourdhui)
  const { realisationEstimee, realisationReelle, validationEstimee, validationReelle } = etape.durees
  const reelles = [realisationReelle, validationReelle].filter((d): d is number => d !== null)
  return {
    enCoursDepuisJours: Math.max(0, ecartJours(etape.creeeLe, etape.faitLe ?? aujourdhui)),
    ecartRealisationMinutes: ecartDurees(realisationEstimee, realisationReelle),
    ecartValidationMinutes: ecartDurees(validationEstimee, validationReelle),
    cumulReelMinutes: reelles.length > 0 ? reelles.reduce((a, b) => a + b, 0) : null,
  }
}

// ─── Enchaînement ───────────────────────────────────────────────────────────────────────────

/**
 * Étape suivante du processus (etapes.enchainer : limite = réalisation + délai, délai de GESTION) ; null en fin de
 * processus. Garde le dossier (rattachements) et les acteurs ; la nouvelle étape est créée le `date` (au plus tôt le jour
 * de la réalisation), avec son origine et son créateur (🔴 « Automatique » ou le collaborateur qui enchaîne : non
 * observé) ; « sans objet » de la validation, instructions, programmation, durées et case d'accusé repartent à zéro au
 * lieu d'être recopiés (à ressaisir par programmerEtape).
 */
export function enchainerEtapeDossier(
  etape: EtapeDossier,
  processus: EtapeTypeProcessus[],
  { id, date, origine, creeeParId }: { id: string; date: string; origine: OrigineEtape; creeeParId: string | null },
): EtapeDossier | null {
  const nouvelId = texteObligatoire(id, 'Identifiant d’étape attendu.')
  const createur = verifierOrigine(origine, creeeParId)
  verifierDateObligatoire(date, 'Date de création')
  if (etape.faitLe !== null && date < etape.faitLe)
    throw new Error(`Enchaînement refusé : le ${dateIsoVersFr(date)} précède la réalisation (${dateIsoVersFr(etape.faitLe)}).`)
  const suivante = enchainer(etape, processus, { id: nouvelId })
  if (!suivante) return null
  return {
    ...suivante,
    validationSansObjet: false,
    creeeLe: date,
    origine,
    creeeParId: createur,
    rattachements: etape.rattachements.map((r) => ({ ...r })),
    instructions: '',
    aFaireLe: null,
    aFaireLeFixe: false,
    validationPrevueLe: null,
    validationPrevueLeFixe: false,
    accuseAuDemandeur: false,
    durees: dureesVides(),
  }
}

// ─── Étape automatique non réalisée après N jours ──────────────────────────────────────────

/**
 * N par défaut : réglage de GESTION du cabinet, modifiable (comme DELAIS_SUIVI_CONTENTIEUX) ; aucun texte ne le fixe et
 * il ne s'affiche jamais comme un délai légal. 🔴 Valeur à fixer par Frédéric.
 */
export const JOURS_SUIVI_ETAPE_AUTOMATIQUE = 30

/**
 * Plafond de N (🔵 garde-fou VitFix, cent ans de 365 jours) : au-delà, la date de relance sortirait du calendrier
 * AAAA-MM-JJ et la règle s'inverserait. Pour neutraliser la règle, ne pas suivre la nature dans le réglage.
 */
export const JOURS_SUIVI_ETAPE_MAX = 36_500

export function verifierJoursSuiviEtape(jours: number): void {
  if (!Number.isInteger(jours) || jours < 0 || jours > JOURS_SUIVI_ETAPE_MAX)
    throw new Error(`Nombre de jours de suivi invalide (${jours}) : nombre entier de jours entre 0 et ${JOURS_SUIVI_ETAPE_MAX} attendu.`)
}

/** Étape automatique encore à faire : la seule que vise la règle des N jours. */
const automatiqueAFaire = (etape: EtapeDossier, aujourdhui: string): boolean =>
  etape.origine === 'automatique' && etatEtape(etape, aujourdhui).statut === 'a_faire'

/**
 * Date de relance (création + N) d'une étape automatique encore à faire, même future : le suivi « à faire » la reçoit et
 * le réglage y applique l'horizon et la règle du week-end, comme aux autres natures. Null pour une étape manuelle ou
 * réalisée. Refus : relance au-delà du 31/12/9999 (création aberrante).
 */
export function relanceEtapeAutomatique(
  etape: EtapeDossier,
  aujourdhui: string,
  jours: number = JOURS_SUIVI_ETAPE_AUTOMATIQUE,
): string | null {
  verifierAujourdhui(aujourdhui)
  verifierJoursSuiviEtape(jours)
  if (!automatiqueAFaire(etape, aujourdhui)) return null
  const relanceLe = ajouterJours(etape.creeeLe, jours)
  if (!estDateIsoValide(relanceLe))
    throw new Error(`Relance de l’étape ${etape.id} hors calendrier : création le ${dateIsoVersFr(etape.creeeLe)} + ${jours} jours.`)
  return relanceLe
}

/**
 * La fiche : étape automatique encore à faire N jours après sa création (borne incluse), avec ou sans limite, à relancer
 * depuis le `relanceLe`. Null pour une étape manuelle, réalisée, ou trop récente. Décision sur l'écart en jours, et non
 * sur les chaînes de dates.
 */
export function etapeAutomatiqueNonRealisee(
  etape: EtapeDossier,
  aujourdhui: string,
  jours: number = JOURS_SUIVI_ETAPE_AUTOMATIQUE,
): { relanceLe: string; ouverteDepuisJours: number } | null {
  verifierAujourdhui(aujourdhui)
  verifierJoursSuiviEtape(jours)
  if (!automatiqueAFaire(etape, aujourdhui)) return null
  const ouverteDepuisJours = ecartJours(etape.creeeLe, aujourdhui)
  return ouverteDepuisJours >= jours ? { relanceLe: ajouterJours(etape.creeeLe, jours), ouverteDepuisJours } : null
}
