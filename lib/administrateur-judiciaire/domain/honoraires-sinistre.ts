import {
  fichesLiees,
  creerRattachement,
  rattachementsDuCourrier,
  type FicheLiee,
  type OptionsFichesLiees,
  type PageFichesLiees,
  type Rattachement,
} from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  creerElement,
  totalElement,
  type ElementAFacturer,
  type NatureElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Honoraires rattachés à une fiche sinistre (point 66 du bilan 2). Fonctions pures, montants en CENTIMES ENTIERS (taux
 * horaire HT en dix-millièmes d'euro, comme honoraires-facturation.ts), sans écran ni table : la table des éléments à
 * facturer viendra avec l'accord de Frédéric.
 *
 * Sources Gestéam :
 * - 🟢 Tranche 42 § Flux : nœud « Honoraires lignes » (« Suivi et gestion MRI », À facturer) rattaché au sinistre dès son
 *   ouverture ; bouton « Honoraires (€) » de la barre d'outils de la fiche.
 * - 🟢 Tranche 42 § Complément (28/10/2026, 00:06) : Dossier = type « Sinistre » + la fiche précise ; nature
 *   « Prestations » ; calcul « Coût Horaire » (horaires début / fin hh:mm, coût horaire HT, Nbre d'heure 1,00 par défaut,
 *   Total HT) ; destinataire « Syndicat des copropriétaires » ; date de l'élément = ouverture du dossier, pas la survenance.
 * - 🟢 Tranche 27 § Catalogue des tarifs : les quatre tarifs « Sinistre - SINISTRE … » des diligences hors forfait, plus
 *   « SINISTRE PRESTATION EN DEHORS JOURS ET HEURES OUVRABLES ». Le même catalogue porte « Gestion - REGLEMENT
 *   COPROPRIETE- ETAT DESCRIPTIF DES DIVISIONS » et « Contentieux - RET - DECLARATION DE LA CREANCE » : ni l'un ni l'autre
 *   n'est une diligence de sinistre.
 *
 * Droit (relevé sur Légifrance le 29/10/2026, texte en vigueur) :
 * - 🟢 Contrat type de syndic (D. 1967 annexe 1) : seules quatre diligences de sinistre sont rémunérées hors forfait
 *   (7.2.4 ; liste limitative de l'annexe 2, III, 6° à 9°), au coût horaire au prorata du temps passé ou au forfait convenu
 *   (7.2.1) ; la déclaration et le règlement des indemnités restent au forfait (7.1.1) ; toute somme versée par l'assureur
 *   au syndic pour ces diligences vient en déduction de la rémunération due au titre du 7.2.4 (dernier alinéa).
 *   🔵 elementAOuvertureSinistre ne crée que l'élément au coût horaire (seul observé, tranche 42) ; un tarif forfaitaire
 *   convenu passe par creerElement (calcul « Coût unitaire », quantité 1), que le contrôle et le solde traitent de même.
 * - 🟢 Administrateur provisoire de l'art. 29-1, copropriété de MOINS de 500 lots : la gestion administrative et
 *   matérielle des sinistres, hors déclaration de sinistre et déduction faite des sommes versées par l'assureur, est un
 *   acte rémunéré hors droits fixes et proportionnels (arrêté du 8 octobre 2015, art. 14, qui ne donne aucune liste de
 *   diligences). Ceci corrige la tranche 42 et la ligne 66 du bilan (« aucune base ») : il y a une base, mais le juge fixe
 *   les acomptes et arrête la rémunération (D. 1967 art. 61-1-5, II et III). 🔵 Donc AUCUN élément « A facturer » au
 *   syndicat : un signalement « à soumettre au juge ». La désignation de l'AP met fin au contrat de syndic (annexe 1,
 *   point 10 ; L. 1965 art. 29-1, I, al. 2) : ni son coût horaire, ni son forfait (7.1.1), ni l'annexe 2 ne s'appliquent.
 * - 🟢 Copropriété de 500 lots et plus : « par dérogation aux articles 4 à 15 », l'entière rémunération de l'AP est
 *   fixée par le juge en fonction des frais engagés et des diligences accomplies (arrêté du 8 octobre 2015, art. 3) :
 *   l'art. 14 et son exclusion de la déclaration ne s'appliquent pas. Cadre « rémunération fixée par le juge ». 🔵 Aucun
 *   élément, aucune diligence refusée ; les frais aussi sont signalés, puisque le juge en tient compte. 🔵 Le seuil se
 *   compare au nombre de lots de la copropriété passé par l'appelant (l'article ne distingue pas les lots).
 * - 🔴 Aucun texte trouvé sur la rémunération de l'AP désigné faute de syndic (D. 1967 art. 47) ni de l'administrateur ad
 *   hoc (art. 49) : le tarif de l'art. 61-1-5 vise le seul AP de l'art. 29-1. Syndic judiciaire (art. 46) : non relu.
 *   D'où le cadre « non établi » pour ces régimes : signalement, aucun élément, aucune diligence refusée.
 * 🔵 Le cadre « contrat type de syndic » ne se déduit d'aucun régime judiciaire : l'appelant le passe pour un mandat de
 * syndic conventionnel.
 * - 🟢 Frais d'envoi, contrat type : remboursés au syndic à part, pour les prestations du forfait (7.1.5, dernier alinéa)
 *   comme pour les prestations particulières (7.2.1, al. 2). Ces deux textes ne visent que l'affranchissement et
 *   l'acheminement. 🟢 Les frais de reprographie afférents aux prestations du forfait sont inclus dans le forfait
 *   (7.1.1, al. 2), et la déclaration comme le règlement des indemnités en font partie (7.1.1). 🔵 Une copie dont le
 *   tarif nomme l'une ou l'autre en relève : au contrat type, signalée « diligence_au_forfait » et écartée du solde, ni
 *   frais ni honoraires ; son envoi reste un frais remboursé (7.1.5, dernier alinéa). 🔵 Natures de la reprographie :
 *   Copie et Diffuseur copie. 🔵 Seules les natures Vacations, Honoraires et Prestations rémunèrent une diligence ; les autres
 *   (timbre, AR, copie, envois, diffuseurs) sont des frais : hors contrôle des diligences (sauf cette reprographie) et
 *   hors déduction de l'assureur (un timbre n'est ni une diligence ni un acte de l'art. 14).
 * - 🟢 Contrat type, 7.2.4 : la prestation faite hors jours et heures ouvrables, rendue nécessaire par l'urgence, est
 *   facturée sans majoration ou au coût horaire majoré du pourcentage fixé au contrat (coutHoraireUrgence).
 * 🔵 Le tarif d'urgence hors jours et heures ouvrables est une modalité de l'une des quatre diligences ; la majoration,
 * au centième de point au plus, est calculée en entiers et portée par le coût horaire passé par l'appelant, arrondie au
 * dix-millième d'euro (demi au-dessus).
 * 🔵 « Gestion - Gestion des sinistres, rendez-vous constat » (tranche 27) n'est rattaché à aucune des quatre diligences :
 * diligence non identifiée sous le contrat type, dont l'annexe 2 est limitative ; sans objet hors du contrat type.
 *
 * Questions ouvertes :
 * - 🔴 (Frédéric) En administration provisoire (art. 29-1), comment le cabinet chiffre-t-il les actes hors tarif de
 *   l'art. 14 de l'arrêté (sinistres, recouvrement, mutation, réunions d'information) : temps passé × un taux horaire du
 *   cabinet, présenté au juge dans le compte provisoire détaillé des émoluments ? Aucun texte ne fixe le mode de calcul.
 * - 🔴 (Frédéric) En administration provisoire, un élément d'honoraires est-il prélevé directement sur le compte du
 *   syndicat (« A facturer »), ou seulement après l'ordonnance d'acompte ou de fin de mission (« À soumettre au juge ») ?
 * - 🔴 (Frédéric) En administration provisoire de moins de 500 lots, et pour un mandat au cadre non établi, les frais
 *   d'envoi d'un dossier sinistre (timbre, AR) sont-ils remboursés à part au cabinet, et sur quel texte ? Le 7.2.1, al. 2
 *   ne vise que le contrat type de syndic ; l'arrêté du 8 octobre 2015 ne parle de frais qu'aux art. 3 et 8, III. Choix
 *   actuel : seule l'absence de fiche est signalée.
 * - 🔴 (Frédéric) Quelle base de rémunération le cabinet applique-t-il pour un AP désigné faute de syndic (art. 47), un
 *   administrateur ad hoc (art. 49) ou un syndic judiciaire (art. 46) : ce que fixe l'ordonnance ?
 * - 🔴 (Frédéric) Le cabinet gère-t-il dans VitFix des mandats de syndic conventionnels (seul cas où l'élément est créé) ?
 * - 🔴 (Hugo) Gestéam crée l'élément à l'ouverture pour 1 heure ; le contrat type dit « au prorata du temps passé ».
 *   Garder 1 heure par défaut (choix actuel), ou créer l'élément à 0 heure, à compléter (creerElement refuse aujourd'hui
 *   une quantité nulle) ?
 * - 🔴 (Frédéric ou Hugo) Quel arrondi pour taux horaire × durée ? Choix actuel : durée en minutes exactes, heures au
 *   centième (comme le « Nbre d'heure » Gestéam), montant arrondi au centime par totalElement.
 * - 🔴 (Frédéric) La déduction des sommes de l'assureur s'impute-t-elle sur le TTC (choix actuel) ou sur le HT ?
 *   S'applique-t-elle aussi quand l'assureur verse au SYNDICAT une indemnité pour frais de gestion ? Et à 500 lots et
 *   plus, où l'art. 14 ne s'applique pas : choix actuel, la déduction est calculée et présentée au juge.
 * - 🔴 (Frédéric) Taux horaire et taux de TVA par défaut : réglages du cabinet, non relevés (passés par l'appelant).
 * - 🔴 (Frédéric) Au contrat type, les copies d'un dossier sinistre afférentes à l'une des quatre diligences hors forfait :
 *   frais remboursés à part, ou comprises dans la rémunération du 7.2.4 ? Le 7.2.1, al. 2 ne vise que les frais d'envoi,
 *   et le 7.1.1, al. 2 que la reprographie des prestations du forfait (celle-ci est déjà signalée et écartée). Choix
 *   actuel : des frais, sans anomalie, comme une copie dont le tarif ne nomme aucune diligence (rien ne dit alors à
 *   quelle diligence elle se rapporte).
 */

export const CADRES_REMUNERATION_SINISTRE = [
  'contrat_type_syndic',
  'tarif_administrateur_provisoire',
  'remuneration_fixee_par_le_juge',
  'non_etabli',
] as const
export type CadreRemunerationSinistre = (typeof CADRES_REMUNERATION_SINISTRE)[number]
type CadreSansElement = Exclude<CadreRemunerationSinistre, 'contrat_type_syndic'>

/** 🟢 À partir de ce nombre de lots, l'entière rémunération de l'AP est fixée par le juge (arrêté du 8 octobre 2015, art. 3). */
export const SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE = 500

/** 🟢 Diligences rémunérées hors forfait (D. 1967 annexe 1, 7.2.4 ; annexe 2, III) et tarifs du catalogue (tranche 27). */
export const DILIGENCES_SINISTRE_HORS_FORFAIT = [
  {
    code: 'deplacement',
    libelle: 'Déplacements sur les lieux',
    rubrique: 'D. 1967 annexe 2, III, 6°',
    tarifGesteam: 'SINISTRE VACATIONS DEPLACEMENT SUR LES LIEUX',
  },
  {
    code: 'mesures_conservatoires',
    libelle: 'Prise de mesures conservatoires',
    rubrique: 'D. 1967 annexe 2, III, 7°',
    tarifGesteam: 'SINISTRE MESURES CONSERVATOIRES',
  },
  {
    code: 'assistance_expertise',
    libelle: "Assistance aux mesures d'expertise",
    rubrique: 'D. 1967 annexe 2, III, 8°',
    tarifGesteam: "SINISTRE ASSISTANCE AUX MESURES D'EXPERTISE",
  },
  {
    code: 'suivi_assureur',
    libelle: "Suivi du dossier auprès de l'assureur",
    rubrique: 'D. 1967 annexe 2, III, 9°',
    tarifGesteam: "SINISTRE SUIVI DU DOSSIER AUPRES DE L'ASSUREUR",
  },
] as const
export type DiligenceSinistreHorsForfait = (typeof DILIGENCES_SINISTRE_HORS_FORFAIT)[number]['code']

/** 🟢 Diligences comprises dans le forfait du contrat type : aucune rémunération supplémentaire. */
export const DILIGENCES_SINISTRE_AU_FORFAIT = [
  {
    code: 'declaration',
    libelle: 'Formalités de déclaration du sinistre',
    rubrique: 'D. 1967 annexe 1, 7.1.1 ; liste annexée au contrat, V-17°',
  },
  {
    code: 'reglement_indemnites',
    libelle: 'Gestion des règlements aux bénéficiaires',
    rubrique: 'D. 1967 annexe 1, 7.1.1 ; liste annexée au contrat, V-18°',
  },
] as const
export type DiligenceSinistreAuForfait = (typeof DILIGENCES_SINISTRE_AU_FORFAIT)[number]['code']

/** Diligence de sinistre : l'une des quatre hors forfait, ou l'une des deux au forfait du contrat type. */
export type DiligenceSinistre = DiligenceSinistreHorsForfait | DiligenceSinistreAuForfait

const DILIGENCES_SINISTRE: readonly { code: DiligenceSinistre; libelle: string }[] = [
  ...DILIGENCES_SINISTRE_HORS_FORFAIT,
  ...DILIGENCES_SINISTRE_AU_FORFAIT,
]

/** 🟢 Tarif d'urgence (7.2.4) : prestation hors jours et heures ouvrables, sans majoration ou au coût horaire majoré. */
export const TARIF_SINISTRE_HORS_HEURES_OUVRABLES = 'SINISTRE PRESTATION EN DEHORS JOURS ET HEURES OUVRABLES'

/** 🔵 Natures qui rémunèrent une diligence ; les autres sont des frais (envoi, copie…), hors rémunération. */
export const NATURES_REMUNERATION_SINISTRE = ['Vacations', 'Honoraires', 'Prestations'] as const satisfies readonly NatureElement[]

/** 🔵 Natures de la reprographie (copies du cabinet ou du diffuseur), seuls frais visés par le 7.1.1, al. 2. */
export const NATURES_REPROGRAPHIE_SINISTRE = ['Copie', 'Diffuseur copie'] as const satisfies readonly NatureElement[]

const aLaNature =
  (natures: readonly NatureElement[]) =>
  (element: ElementAFacturer): boolean =>
    natures.includes(element.nature)

const estRemuneration = aLaNature(NATURES_REMUNERATION_SINISTRE)
const estReprographie = aLaNature(NATURES_REPROGRAPHIE_SINISTRE)

/** Majoration en centièmes de point de pourcentage ; dix-millièmes d'unité pour 100 % (base du calcul entier). */
const CENTIEMES_PAR_POINT = 100
const BASE_MAJORATION = 100 * CENTIEMES_PAR_POINT
/** Écart toléré entre la majoration × 100 et son entier le plus proche (imprécision binaire, pas une décimale de plus). */
const TOLERANCE_CENTIEMES = 1e-6

/**
 * Coût horaire HT d'urgence (7.2.4) : coût horaire du contrat majoré du pourcentage convenu (0 : sans majoration).
 * 🔵 Calcul en entiers (majoration au centième de point au plus), arrondi au dix-millième d'euro, demi au-dessus.
 */
export function coutHoraireUrgence(coutHoraireHtDixMilliemes: number, majorationPct: number): number {
  if (!Number.isInteger(coutHoraireHtDixMilliemes) || coutHoraireHtDixMilliemes < 0)
    throw new Error(`Coût horaire invalide (${coutHoraireHtDixMilliemes}) : dix-millièmes d'euro entiers positifs attendus.`)
  if (!Number.isFinite(majorationPct) || majorationPct < 0) throw new Error(`Majoration invalide (${majorationPct}) : pourcentage positif attendu.`)
  const majorationCentiemes = Math.round(majorationPct * CENTIEMES_PAR_POINT)
  if (Math.abs(majorationPct * CENTIEMES_PAR_POINT - majorationCentiemes) > TOLERANCE_CENTIEMES)
    throw new Error(`Majoration invalide (${majorationPct}) : deux décimales au plus attendues.`)
  const produit = coutHoraireHtDixMilliemes * (BASE_MAJORATION + majorationCentiemes)
  if (!Number.isSafeInteger(produit)) throw new Error(`Coût horaire trop élevé (${coutHoraireHtDixMilliemes}) pour un calcul exact.`)
  return Math.round(produit / BASE_MAJORATION)
}

export type DiligenceLueDansTarif = DiligenceSinistre | 'hors_heures_ouvrables'

export const FONDEMENTS_HONORAIRES_SINISTRE: Readonly<Record<CadreRemunerationSinistre, readonly string[]>> = {
  contrat_type_syndic: [
    'L. 1965 art. 18-1 A, I',
    'D. 1967 art. 29 ; annexe 2, III, 6° à 9°',
    'D. 1967 annexe 1, points 7.1.1, 7.2.1 et 7.2.4',
  ],
  tarif_administrateur_provisoire: ['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5, I à III', 'Arrêté du 8 octobre 2015, art. 14'],
  remuneration_fixee_par_le_juge: ['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5, II et III', 'Arrêté du 8 octobre 2015, art. 3'],
  non_etabli: [
    "D. 1967 art. 61-1-5, I : tarif du seul administrateur provisoire de l'art. 29-1 de la loi",
    'D. 1967 art. 47 et 49 : aucune disposition trouvée sur la rémunération',
  ],
}

const SOURCE_TARIF_AP = 'arrêté du 8 octobre 2015, art. 14'
const SOURCE_REMUNERATION_PAR_LE_JUGE = 'arrêté du 8 octobre 2015, art. 3'
const SOURCE_FORFAIT = 'D. 1967 annexe 1, 7.1.1'
const SOURCE_REPROGRAPHIE = 'D. 1967 annexe 1, 7.1.1, al. 2'
const SOURCE_HORS_FORFAIT = 'D. 1967 annexe 2, III, 6° à 9°'
const MANDATS_SANS_BASE = 'AP art. 47, administrateur ad hoc, syndic judiciaire'
const AP_PAR_LE_JUGE =
  `Administration provisoire (art. 29-1), copropriété de ${SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE} lots et plus : l'entière ` +
  `rémunération est fixée par le juge en fonction des frais engagés et des diligences accomplies`

function verifierCadre(cadre: CadreRemunerationSinistre): void {
  if (!(CADRES_REMUNERATION_SINISTRE as readonly string[]).includes(cadre)) throw new Error(`Cadre de rémunération inconnu : « ${cadre} ».`)
}

/**
 * Cadre de rémunération d'un mandat judiciaire : seul l'AP de l'art. 29-1 a un tarif écrit (art. 61-1-5), sauf à 500 lots
 * et plus, où le juge fixe toute la rémunération (arrêté art. 3). Le nombre de lots n'est lu que pour l'AP de l'art. 29-1.
 */
export function cadreRemunerationDuRegime(regime: Regime | null, nbLots: number): CadreRemunerationSinistre {
  if (regime !== 'ap291') return 'non_etabli'
  if (!Number.isInteger(nbLots) || nbLots <= 0) throw new Error(`Nombre de lots invalide (${nbLots}) : entier strictement positif attendu.`)
  return nbLots >= SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE ? 'remuneration_fixee_par_le_juge' : 'tarif_administrateur_provisoire'
}

type LectureTarif = (aLeMot: (racine: string) => boolean, normalise: string) => boolean

/** Le règlement de copropriété (et l'état descriptif de division) n'est pas le règlement d'un sinistre. */
const REGLEMENT_DE_COPROPRIETE = /REGLEMENTS? (DE (LA )?)?COPROPRIETE/

/**
 * Lecture du tarif, dans cet ordre : d'abord les diligences au forfait (une mention de la déclaration ou du règlement
 * l'emporte, par prudence), puis l'urgence, puis les quatre diligences. La déclaration d'une créance n'est pas celle du
 * sinistre ; le règlement suppose les indemnités ou les bénéficiaires, et n'est pas le règlement de copropriété.
 * 🔵 « SUIVI ET GESTION » (tarif de l'élément créé à l'ouverture, tranche 42) = suivi du dossier auprès de l'assureur.
 */
const LECTURES_TARIF: readonly (readonly [LectureTarif, DiligenceLueDansTarif])[] = [
  [(aLeMot) => aLeMot('DECLARATION') && !aLeMot('CREANCE'), 'declaration'],
  [
    (aLeMot, normalise) =>
      aLeMot('REGLEMENT') && (aLeMot('INDEMNIT') || aLeMot('BENEFICIAIR')) && !REGLEMENT_DE_COPROPRIETE.test(normalise),
    'reglement_indemnites',
  ],
  [(aLeMot) => aLeMot('OUVRABLE'), 'hors_heures_ouvrables'],
  [(aLeMot) => aLeMot('DEPLACEMENT'), 'deplacement'],
  [(aLeMot) => aLeMot('EXPERTISE'), 'assistance_expertise'],
  [(aLeMot) => aLeMot('CONSERVATOIRE'), 'mesures_conservatoires'],
  [(aLeMot, normalise) => (aLeMot('SUIVI') && aLeMot('ASSUREUR')) || normalise.includes('SUIVI ET GESTION'), 'suivi_assureur'],
]

export function diligenceDuTarif(tarif: string): DiligenceLueDansTarif | null {
  const normalise = normaliserTexte(tarif)
  const mots = normalise.split(' ')
  const aLeMot = (racine: string) => mots.some((mot) => mot.startsWith(racine))
  return LECTURES_TARIF.find(([lecture]) => lecture(aLeMot, normalise))?.[1] ?? null
}

const estAuForfait = (lue: DiligenceLueDansTarif | null): lue is DiligenceSinistreAuForfait =>
  DILIGENCES_SINISTRE_AU_FORFAIT.some((d) => d.code === lue)

type FicheDiligenceHorsForfait = (typeof DILIGENCES_SINISTRE_HORS_FORFAIT)[number]
type FicheDiligence = (typeof DILIGENCES_SINISTRE)[number]

const diligenceInconnue = (code: string): never => {
  throw new Error(`Diligence de sinistre inconnue : « ${code} ».`)
}

const ficheDiligence = (code: DiligenceSinistre): FicheDiligence =>
  DILIGENCES_SINISTRE.find((d) => d.code === code) ?? diligenceInconnue(code)

/** Contrat type : l'une des quatre diligences hors forfait (7.2.4), jamais une diligence au forfait (7.1.1). */
function diligenceHorsForfait(code: DiligenceSinistre): FicheDiligenceHorsForfait {
  if (estAuForfait(code)) throw new Error(`Diligence « ${code} » : comprise dans le forfait (${SOURCE_FORFAIT}), aucun élément.`)
  return DILIGENCES_SINISTRE_HORS_FORFAIT.find((d) => d.code === code) ?? diligenceInconnue(code)
}

/** Cohérence des données, sans règle de droit : un tarif qui nomme une diligence doit nommer celle de l'élément. */
function verifierTarifCoherent(tarif: string, lue: DiligenceLueDansTarif | null, diligence: FicheDiligence): void {
  if (lue !== null && lue !== 'hors_heures_ouvrables' && lue !== diligence.code)
    throw new Error(`Tarif « ${tarif} » : il vise une autre diligence (${lue}) que « ${diligence.libelle} ».`)
}

/** Contrat type : tarif du catalogue pour la diligence, ou celui de l'appelant s'il vise bien cette diligence. */
function tarifDeLaDiligence(diligence: FicheDiligenceHorsForfait, tarif: string | undefined): string {
  if (tarif === undefined) return `Sinistre - ${diligence.tarifGesteam}`
  const lue = diligenceDuTarif(tarif)
  if (estAuForfait(lue)) throw new Error(`Tarif « ${tarif} » : diligence comprise dans le forfait (${SOURCE_FORFAIT}), aucun élément.`)
  if (lue === null) throw new Error(`Tarif « ${tarif} » : diligence de sinistre non identifiée (${SOURCE_HORS_FORFAIT}).`)
  verifierTarifCoherent(tarif, lue, diligence)
  return tarif
}

/**
 * Hors contrat type, ni le forfait (7.1.1) ni l'annexe 2 : en AP de moins de 500 lots, seule la déclaration est refusée
 * (arrêté art. 14) ; à 500 lots et plus et en cadre non établi, rien n'est refusé. La cohérence du tarif reste contrôlée.
 */
function verifierHorsContratType(code: DiligenceSinistre, tarif: string | undefined, cadre: CadreSansElement): void {
  const diligence = ficheDiligence(code)
  const lue = tarif === undefined ? null : diligenceDuTarif(tarif)
  if (cadre === 'tarif_administrateur_provisoire' && (code === 'declaration' || lue === 'declaration'))
    throw new Error(`Déclaration du sinistre : exclue des actes hors tarif (${SOURCE_TARIF_AP}), aucun signalement.`)
  if (tarif !== undefined) verifierTarifCoherent(tarif, lue, diligence)
}

export interface OuvertureSinistre {
  elementId: string
  sinistreId: string
  coproprieteId: string
  mandatId: string
  /** Date d'ouverture du dossier dans le logiciel (🟢 pas la survenance). */
  dateOuverture: string
  /** Coût horaire HT du contrat (majoré le cas échéant pour l'urgence), en dix-millièmes d'euro. */
  coutHoraireHtDixMilliemes: number
  soumisTva: boolean
  tauxTvaPct: number
  /**
   * 🔵 Par défaut : suivi du dossier auprès de l'assureur (« Suivi et gestion MRI » de Gestéam). Une diligence au forfait
   * n'est admise que hors contrat type (signalement, sauf la déclaration en AP de moins de 500 lots).
   */
  diligence?: DiligenceSinistre
  /** Par défaut : le tarif du catalogue pour la diligence. */
  tarif?: string
  /** 🔵 Par défaut : 1 heure (Gestéam), à corriger ensuite (corrigerHeures). */
  heures?: number
  /** 🟢 Par défaut : « Syndicat des copropriétaires ». */
  destinataire?: string
}

export type MotifSansElement = 'a_soumettre_au_juge' | 'base_non_etablie'

export type ResultatOuvertureSinistre =
  | { genere: true; element: ElementAFacturer }
  | {
      genere: false
      motif: MotifSansElement
      signalement: string
      fiche: Rattachement
      diligence: DiligenceSinistre
      fondements: readonly string[]
    }

const BASE_NON_ETABLIE = `Base de rémunération non établie pour ce mandat (${MANDATS_SANS_BASE})`
const AUCUN_ELEMENT = "aucun élément « A facturer » n'est créé"

const SANS_ELEMENT: Readonly<Record<CadreSansElement, { motif: MotifSansElement; signalement: string }>> = {
  tarif_administrateur_provisoire: {
    motif: 'a_soumettre_au_juge',
    signalement:
      `Administration provisoire (art. 29-1) : la gestion du sinistre est un acte hors tarif (${SOURCE_TARIF_AP}), à justifier ` +
      `auprès du juge (acompte annuel ou ordonnance de fin de mission, D. 1967 art. 61-1-5, II et III) ; ${AUCUN_ELEMENT}.`,
  },
  remuneration_fixee_par_le_juge: {
    motif: 'a_soumettre_au_juge',
    signalement: `${AP_PAR_LE_JUGE} (${SOURCE_REMUNERATION_PAR_LE_JUGE} ; D. 1967 art. 61-1-5, II et III) ; ${AUCUN_ELEMENT}.`,
  },
  non_etabli: {
    motif: 'base_non_etablie',
    signalement: `${BASE_NON_ETABLIE} : ${AUCUN_ELEMENT} ; rémunération à confirmer selon l'ordonnance.`,
  },
}

/**
 * Élément d'honoraires créé à l'ouverture d'un sinistre. Contrat type de syndic : élément « A facturer » du dossier
 * Sinistre, rattaché à la fiche, au coût horaire ; diligence au forfait (7.1.1) ou hors de l'annexe 2 refusée. Autre
 * cadre : pas d'élément, un signalement, selon les seules règles du cadre (verifierHorsContratType).
 */
export function elementAOuvertureSinistre(ouverture: OuvertureSinistre, cadre: CadreRemunerationSinistre): ResultatOuvertureSinistre {
  verifierCadre(cadre)
  const code = ouverture.diligence ?? 'suivi_assureur'
  if (cadre !== 'contrat_type_syndic') {
    verifierHorsContratType(code, ouverture.tarif, cadre)
    return {
      genere: false,
      ...SANS_ELEMENT[cadre],
      fiche: creerRattachement('Sinistre', ouverture.sinistreId),
      diligence: code,
      fondements: FONDEMENTS_HONORAIRES_SINISTRE[cadre],
    }
  }
  const diligence = diligenceHorsForfait(code)
  const tarif = tarifDeLaDiligence(diligence, ouverture.tarif)
  const element = creerElement({
    id: ouverture.elementId,
    coproprieteId: ouverture.coproprieteId,
    mandatId: ouverture.mandatId,
    date: ouverture.dateOuverture,
    dossier: 'Sinistre',
    fiche: creerRattachement('Sinistre', ouverture.sinistreId),
    nature: 'Prestations',
    tarif,
    calcul: 'Coût horaire',
    quantite: ouverture.heures ?? 1,
    prixUnitaireHtDixMilliemes: ouverture.coutHoraireHtDixMilliemes,
    soumisTva: ouverture.soumisTva,
    tauxTvaPct: ouverture.tauxTvaPct,
    destinataire: ouverture.destinataire ?? 'Syndicat des copropriétaires',
  })
  return { genere: true, element }
}

const HORAIRE = /^([01]\d|2[0-3]):([0-5]\d)$/

function minutesDepuisHoraire(horaire: string): number {
  const morceaux = HORAIRE.exec(horaire)
  if (!morceaux) throw new Error(`Horaire invalide (${horaire}) : hh:mm de 00:00 à 23:59 attendu.`)
  return Number(morceaux[1]) * 60 + Number(morceaux[2])
}

/** Temps passé depuis les horaires début / fin de la fiche élément : minutes exactes, heures au centième (🔵 arrondi). */
export function dureeDepuisHoraires(debut: string, fin: string): { minutes: number; heures: number } {
  const minutes = minutesDepuisHoraire(fin) - minutesDepuisHoraire(debut)
  if (minutes <= 0) throw new Error(`L'horaire de fin (${fin}) doit être après celui de début (${debut}).`)
  return { minutes, heures: Math.round((minutes * 100) / 60) / 100 }
}

/** Corrige le nombre d'heures d'un élément au coût horaire encore « A facturer » ; l'élément reçu n'est pas modifié. */
export function corrigerHeures(element: ElementAFacturer, heures: number): ElementAFacturer {
  if (element.statut !== 'A facturer') throw new Error(`Correction refusée : l'élément ${element.id} est déjà facturé.`)
  if (element.calcul !== 'Coût horaire') throw new Error(`Correction refusée : l'élément ${element.id} n'est pas au coût horaire (${element.calcul}).`)
  if (!Number.isFinite(heures) || heures <= 0) throw new Error(`Nombre d'heures invalide (${heures}) : strictement positif attendu.`)
  return creerElement({ ...element, quantite: heures })
}

export type NatureAnomalieHonorairesSinistre =
  | 'sans_fiche'
  | 'diligence_au_forfait'
  | 'diligence_non_identifiee'
  | 'hors_tarif_ap'
  | 'remuneration_fixee_par_le_juge'
  | 'cadre_non_etabli'

export interface AnomalieHonorairesSinistre {
  elementId: string
  nature: NatureAnomalieHonorairesSinistre
  message: string
}

/**
 * Diligence non due selon le cadre : contrat type, déclaration et règlement des indemnités (7.1.1), et tarif hors de la
 * liste limitative de l'annexe 2 ; AP de moins de 500 lots, la seule déclaration (arrêté art. 14, sans liste de
 * diligences) ; 500 lots et plus (arrêté art. 3) et cadre non établi : aucune règle appliquée.
 */
function anomalieDeDiligence(element: ElementAFacturer, cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre | null {
  const lue = diligenceDuTarif(element.tarif)
  const base = { elementId: element.id }
  if (cadre === 'tarif_administrateur_provisoire') {
    if (lue !== 'declaration') return null
    return { ...base, nature: 'diligence_au_forfait', message: `Tarif « ${element.tarif} » : la déclaration du sinistre est exclue des actes hors tarif (${SOURCE_TARIF_AP}).` }
  }
  if (cadre !== 'contrat_type_syndic') return null
  if (estAuForfait(lue))
    return {
      ...base,
      nature: 'diligence_au_forfait',
      message: `Tarif « ${element.tarif} » : diligence comprise dans le forfait (${SOURCE_FORFAIT}), aucune rémunération supplémentaire.`,
    }
  if (lue === null)
    return { ...base, nature: 'diligence_non_identifiee', message: `Tarif « ${element.tarif} » : diligence de sinistre non identifiée (${SOURCE_HORS_FORFAIT}).` }
  return null
}

/**
 * Contrat type : la copie d'une diligence au forfait (tarif qui nomme la déclaration ou le règlement des indemnités) est
 * comprise dans le forfait (7.1.1, al. 2). Les autres copies, et tout autre cadre (le contrat a pris fin) : rien (🔴).
 */
function anomalieDeReprographie(element: ElementAFacturer, cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre | null {
  if (cadre !== 'contrat_type_syndic' || !estReprographie(element) || !estAuForfait(diligenceDuTarif(element.tarif))) return null
  return {
    elementId: element.id,
    nature: 'diligence_au_forfait',
    message:
      `Tarif « ${element.tarif} » : reprographie d'une diligence comprise dans le forfait, incluse dans la rémunération ` +
      `forfaitaire (${SOURCE_REPROGRAPHIE}), aucun remboursement.`,
  }
}

const ANOMALIE_DU_CADRE: Readonly<Record<CadreSansElement, { nature: NatureAnomalieHonorairesSinistre; message: string }>> = {
  tarif_administrateur_provisoire: {
    nature: 'hors_tarif_ap',
    message: `Administration provisoire (art. 29-1) : acte hors tarif (${SOURCE_TARIF_AP}), à justifier auprès du juge, pas à facturer au syndicat.`,
  },
  remuneration_fixee_par_le_juge: {
    nature: 'remuneration_fixee_par_le_juge',
    message: `${AP_PAR_LE_JUGE} (${SOURCE_REMUNERATION_PAR_LE_JUGE}) : à lui soumettre, pas à facturer au syndicat.`,
  },
  non_etabli: { nature: 'cadre_non_etabli', message: `${BASE_NON_ETABLIE} : rémunération à confirmer selon l'ordonnance.` },
}

function anomalieDeCadre(element: ElementAFacturer, cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre | null {
  if (cadre === 'contrat_type_syndic') return null
  return { elementId: element.id, ...ANOMALIE_DU_CADRE[cadre] }
}

const anomalieSansFiche = (element: ElementAFacturer): AnomalieHonorairesSinistre | null =>
  element.fiche
    ? null
    : { elementId: element.id, nature: 'sans_fiche', message: 'Élément du dossier Sinistre sans fiche : rattacher le sinistre précis (point 47).' }

/**
 * Anomalies d'un élément. Rémunération : fiche, diligence, puis cadre, sauf pour une diligence non due (elle n'est pas un
 * acte hors tarif). Frais : la fiche, puis à 500 lots et plus le cadre (le juge tient compte des frais engagés), au
 * contrat type la reprographie d'une diligence au forfait (7.1.1, al. 2).
 */
function anomaliesDeLElement(element: ElementAFacturer, cadre: CadreRemunerationSinistre): (AnomalieHonorairesSinistre | null)[] {
  if (!estRemuneration(element))
    return [
      anomalieSansFiche(element),
      cadre === 'remuneration_fixee_par_le_juge' ? anomalieDeCadre(element, cadre) : anomalieDeReprographie(element, cadre),
    ]
  const diligence = anomalieDeDiligence(element, cadre)
  const duCadre = diligence?.nature === 'diligence_au_forfait' ? null : anomalieDeCadre(element, cadre)
  return [anomalieSansFiche(element), diligence, duCadre]
}

/**
 * Élément non dû dans le cadre, avec la règle du contrôle (signalé « diligence_au_forfait ») : au contrat type, une
 * diligence au forfait ou sa reprographie ; en AP de moins de 500 lots, la déclaration.
 */
const estNonDu = (element: ElementAFacturer, cadre: CadreRemunerationSinistre): boolean =>
  anomaliesDeLElement(element, cadre).some((anomalie) => anomalie?.nature === 'diligence_au_forfait')

/** Contrôle des éléments du dossier Sinistre : signale, ne refuse pas. Les autres dossiers sont ignorés. */
export function controlerHonorairesSinistre(elements: readonly ElementAFacturer[], cadre: CadreRemunerationSinistre): AnomalieHonorairesSinistre[] {
  verifierCadre(cadre)
  return elements
    .filter((e) => e.dossier === 'Sinistre')
    .flatMap((element) => anomaliesDeLElement(element, cadre).filter((a): a is AnomalieHonorairesSinistre => a !== null))
}

export interface SoldeHonorairesSinistre {
  /** Éléments de rémunération retenus dans la base de la déduction. */
  elementIds: string[]
  /**
   * Éléments non dus dans le cadre (signalés « diligence_au_forfait ») : rémunération d'une diligence au forfait ou, au
   * contrat type, sa reprographie (7.1.1, al. 2). Hors base, hors total, hors frais.
   */
  ecartesIds: string[]
  totalHtCentimes: number
  totalTtcCentimes: number
  versementsCentimes: number
  deductionCentimes: number
  resteAChargeTtcCentimes: number
  /** Versements de l'assureur au-delà des honoraires : signalés, jamais un reste négatif. */
  excedentCentimes: number
  /** Frais de la fiche (envoi, copie…) qui ne sont pas écartés : hors honoraires, hors déduction. */
  fraisTtcCentimes: number
}

const sommeTtc = (elements: readonly ElementAFacturer[]): number => elements.reduce((s, e) => s + totalElement(e).ttcCentimes, 0)

const visent = (element: ElementAFacturer, fiche: Rattachement): boolean => element.fiche?.type === fiche.type && element.fiche.id === fiche.id

/**
 * Honoraires d'un sinistre, déduction faite des sommes versées par l'assureur au titre des diligences. 🟢 La déduction
 * porte sur la rémunération due (7.2.4, dernier alinéa ; arrêté art. 14, hors déclaration) : les éléments non dus dans
 * le cadre en sont écartés, avec la règle du contrôle ; au contrat type, la reprographie d'une diligence au forfait est
 * écartée des frais (7.1.1, al. 2). 🔵 Éléments de rémunération de la fiche, facturés ou non ; une diligence non
 * identifiée reste dans la base (à vérifier, pas déclarée non due) ; les autres frais restent à part ; déduction
 * sur le TTC (🔴 question), plafonnée au total. Les indemnités versées au SYNDICAT (sinistres.ts) ne sont pas ces sommes.
 */
export function soldeHonorairesSinistre(
  elements: readonly ElementAFacturer[],
  sinistreId: string,
  versementsAssureurCentimes: readonly number[],
  cadre: CadreRemunerationSinistre,
): SoldeHonorairesSinistre {
  verifierCadre(cadre)
  const fiche = creerRattachement('Sinistre', sinistreId)
  for (const versement of versementsAssureurCentimes)
    if (!Number.isInteger(versement) || versement <= 0)
      throw new Error(`Versement de l'assureur invalide (${versement}) : centimes entiers strictement positifs attendus.`)
  const ficheVisee = elements.filter((e) => visent(e, fiche))
  const ecartes = ficheVisee.filter((e) => estNonDu(e, cadre))
  const dus = ficheVisee.filter((e) => !ecartes.includes(e))
  const retenus = dus.filter(estRemuneration)
  const totaux = retenus.map(totalElement)
  const totalHtCentimes = totaux.reduce((s, t) => s + t.htCentimes, 0)
  const totalTtcCentimes = totaux.reduce((s, t) => s + t.ttcCentimes, 0)
  const versementsCentimes = versementsAssureurCentimes.reduce((s, v) => s + v, 0)
  const deductionCentimes = Math.min(versementsCentimes, totalTtcCentimes)
  return {
    elementIds: retenus.map((e) => e.id),
    ecartesIds: ecartes.map((e) => e.id),
    totalHtCentimes,
    totalTtcCentimes,
    versementsCentimes,
    deductionCentimes,
    resteAChargeTtcCentimes: totalTtcCentimes - deductionCentimes,
    excedentCentimes: versementsCentimes - deductionCentimes,
    fraisTtcCentimes: sommeTtc(dus.filter((e) => !estRemuneration(e))),
  }
}

export type FicheElementHonoraires = FicheLiee & { element: ElementAFacturer }

/** Un élément comme fiche liée : sa fiche de dossier, puis la copropriété et le mandat (comme un courrier). */
export function elementCommeFicheLiee(element: ElementAFacturer): FicheElementHonoraires {
  const porteurs = rattachementsDuCourrier({ coproprieteId: element.coproprieteId, mandatId: element.mandatId, personneId: null, entrepriseId: null })
  return {
    id: element.id,
    date: element.date,
    statut: element.statut,
    rattachements: element.fiche ? [element.fiche, ...porteurs] : porteurs,
    element,
  }
}

/** Liste « Honoraires (€) » de la fiche sinistre et nœud « Honoraires lignes » du Flux : éléments rattachés, paginés. */
export function honorairesDuSinistre(
  elements: readonly ElementAFacturer[],
  sinistreId: string,
  options: OptionsFichesLiees = {},
): PageFichesLiees<FicheElementHonoraires> {
  return fichesLiees(elements.map(elementCommeFicheLiee), creerRattachement('Sinistre', sinistreId), options)
}
