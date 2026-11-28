import {
  NATURES_COMPTE_BANCAIRE,
  estCompteDuFondsTravaux,
  resoudreModeComptes,
  verifierMarquesFondsTravaux,
  type ModeTenueComptes,
  type NatureCompteBancaire,
  type ReglagesComptesCabinet,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import {
  ANNEE_PLANCHER,
  ajouterJours,
  ajouterMois,
  avancerAuJourOuvrable,
  composerDateIso,
  dateIsoVersFr,
  decomposerDateIso,
  estDateIsoValide,
  type OptionsJoursFeries,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { balance, grandLivre, type CompteGrandLivre } from '@/lib/administrateur-judiciaire/domain/etats-comptables'
import { LIBELLES_REGIMES, regimeDepuisFondement, type Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { suspensA, type ElementRapprochement, type SuspensALaDate } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { normaliserEspaces, sansAccentsMinuscules } from '@/lib/administrateur-judiciaire/domain/texte'
import type { Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import type { CompteVirementInterne } from '@/lib/administrateur-judiciaire/domain/virement-interne'

/**
 * Fonds détenus pour autrui à une date (point 72 du bilan Gestéam, « Pointe de garantie », remplacé). Fonctions pures,
 * montants en CENTIMES ENTIERS, dates ISO (AAAA-MM-JJ), sans écran, sans table, sans migration.
 *
 * Source : note de recherche du 17/11/2026, contre-vérifiée le même jour, à valider par le référent métier, qui n'est pas un avis
 * juridique (Syndic-judiciaire/NOTE-POINT-72-POINTE-DE-GARANTIE.md, § 1, 2.2, 2.3, 2.6, 4.1 à 4.3 et 6). Elle conclut
 * que la « pointe de garantie » de Gestéam relève de la loi Hoguet (décret n° 72-678, art. 28, 29, 31 et 38), à laquelle
 * l'administrateur judiciaire inscrit n'est pas soumis : elle n'est pas calculée (etats-comptables.ts la garde « non
 * calculée »). Ce module fait le calcul que la note propose à la place (§ 4.2) : les fonds détenus pour autrui À UNE DATE.
 *
 * 🟢 Lu (textes ouverts sur Légifrance le 17/11/2026 par la note ; Code de commerce dans sa version en vigueur à cette date,
 * règles professionnelles dans la version initiale publiée au JORF, Légifrance n'en donnant pas de version consolidée) :
 * - C. com. R. 814-21 : la cotisation à la caisse de garantie a pour base les « fonds non distribués » au 31 décembre de
 *   l'année précédente ;
 * - C. com. R. 814-29 : un compte par mandat dans une comptabilité spéciale, arrêtée au 30 juin et au 31 décembre ;
 *   R. 814-30 : attestation du commissaire aux comptes avant le 15 mars et le 15 septembre, qui indique le montant des
 *   fonds détenus par catégorie de mission et par établissement de crédit ;
 * - C. com. R. 814-34 et R. 814-35 : états trimestriels de tous les mandats non clos (mouvements et solde par compte
 *   ouvert à la Caisse des dépôts et dans d'autres établissements), envoyés dans les quinze jours suivant la fin du
 *   trimestre au greffe et au procureur de la République ;
 * - C. com. R. 814-37 : à tout moment, ce que l'administrateur doit au titre d'un mandat doit être couvert par les fonds
 *   déposés et les espèces ; les fonds d'un mandat ne peuvent jamais servir un autre mandat ;
 * - règles professionnelles (arrêté du 18 juillet 2018), 1033.4 et 1033.5 : les états trimestriels doivent pouvoir être
 *   transmis sur tout support ; les états comptables doivent pouvoir être réédités dans leur état de la fin de chaque
 *   trimestre.
 *
 * Décisions appliquées :
 * - D-BANQUE (27/10/2026) : la tenue des comptes est un réglage du cabinet, remplaçable par mandat
 *   (comptes-bancaires.resoudreModeComptes) ; le fonds de travaux reste sur un compte distinct ; chaque compte a une
 *   nature (NATURES_COMPTE_BANCAIRE) ;
 * - J37 (03/11/2026) : le compte de l'administrateur provisoire est un compte à la Caisse des dépôts, le fonds de
 *   travaux sur un compte distinct ;
 * - J25 et J29 : le compte 53 « Caisse » n'est pas tenu : aucune espèce n'entre dans le calcul ;
 * - J62 (décision du 17/11/2026 (J62), notes de décision du 17/11/2026, section « Suite » : recommandations validées
 *   en bloc, numéro de registre proposé) : un compte sans IBAN est traité comme le compte global de l'administrateur tant
 *   que son IBAN n'est pas saisi : au solde négatif, sa couverture n'est pas vérifiable (couverture_non_verifiable,
 *   bloquant) ; saisir l'IBAN de chaque compte du mandat. C. com. R. 814-37, R. 814-41 ; règle professionnelle 512.5.
 *   Comportement inchangé (mutualise : null, jamais supposé propre au mandat), lecture désormais décidée ;
 * - J63 (décision du 17/11/2026 (J63), même section) : « avant le 15 mars » et « avant le 15 septembre »
 *   (C. com. R. 814-30) = le 14 au plus tard (lecture prudente) : dates limites de l'attestation du commissaire aux
 *   comptes le 14/03 et le 14/09 (echeancesFondsDetenusDeLAnnee, comportement inchangé).
 *
 * Décisions du 17/11/2026 (registre des décisions juridiques, J67 et J71 ; validées en bloc ; C. com. relu sur
 * Légifrance le 17/11/2026) :
 * - J67, R90 : R. 814-21 calcule la cotisation sur « les fonds non distribués » au 31 décembre, sans dire ce qu'ils
 *   comprennent ; R. 814-37 et R. 814-34 vont dans le sens d'un périmètre large. Le défaut « tout inclus » est gardé par
 *   prudence, avec le détail par rubrique et par nature, pour que le cabinet retire ce que la caisse exclurait ; à
 *   ajuster après la réponse de la caisse de garantie (J65 ; courriel préparé). Comportement inchangé.
 * - J67, R91 : R. 814-30 demande les fonds « par catégorie de mission », sans les définir ; R. 814-34 demande déjà, pour
 *   chaque mandat, « la nature de la mission concernée ». La liste des catégories est un réglage du cabinet
 *   (creerCategoriesMission ; option categoriesMission), par défaut le régime du mandat (art. 46, art. 47, art. 29-1) ; à
 *   faire valider par le commissaire aux comptes (J65). Un régime reconnu que le cabinet n'a rangé dans aucune catégorie
 *   va dans « Régime hors des catégories du cabinet », distinct d'un fondement non reconnu. Enregistrement du réglage : à
 *   brancher.
 * - J67, R92 : les fonds détenus restent le solde comptable des comptes 512 (la comptabilité spéciale contrôlée, R.
 *   814-29) ; en annexe, le solde bancaire à la même date et les suspens de rapprochement (annexeSoldeBancaireEtSuspens,
 *   qui lit rapprochement-bancaire.suspensA) ; un écart que les suspens n'expliquent pas est signalé. Le commissaire aux
 *   comptes choisit la présentation. Branchement du relevé à la date : à faire.
 * - J67, R93 : « avant le 15 mars », « avant le 15 septembre » (R. 814-30) et « dans les quinze jours » (R. 814-35) : aucun
 *   report à un jour ouvrable (l'art. 642 du code de procédure civile vise les délais de procédure ; J63). Une date
 *   limite qui tombe un samedi, un dimanche ou un jour férié porte une alerte : envoyer au plus tard le dernier jour
 *   ouvré précédent (dernierJourOuvre, alerteJourNonOuvre), date la plus prudente, comme pour J1.
 * - J71 : un compte de placement au nom du syndicat réservé au fonds de travaux est rangé dans la rubrique « fonds de
 *   travaux » (comptes-bancaires.estCompteDuFondsTravaux).
 *
 * Décisions du 20/11/2026 (partie C, recommandations acceptées par le responsable du projet) :
 * - Décision du 20/11/2026 (partie C, F98) : les comptes de placement de classe 50 (501 « Compte à terme », 502 « Autre
 *   compte » : arrêté du 14/03/2005, art. 7) sont comptés dans les fonds détenus, sur une ligne à part « fonds placés »
 *   (rubrique fonds_places), inclus par défaut, par prudence : R. 814-30 vise les « fonds, effets, titres et autres
 *   valeurs détenus », et un placement reste un fonds appartenant à autrui (R. 814-37). Le cabinet peut les exclure
 *   (creerPerimetreFondsDetenus, fonds_places: false). Un tel compte se déclare comme les autres (CompteFondsDetenus, son
 *   numéro de classe 50 à la place du 512), de nature « placement » ; le placement du fonds de travaux admis par J71,
 *   sous-compte 512, reste dans la rubrique « fonds de travaux » ;
 * - Décision du 20/11/2026 (partie C, F99) : total sur les seuls soldes positifs, découverts totalisés à part et
 *   signalés : un découvert est une dette envers la banque, pas un fonds détenu ; les fonds d'un mandat ne servent jamais
 *   un autre mandat (R. 814-37) ; aucune compensation entre comptes du syndicat (L. 1965 art. 18, II, al. 3 et 4 ; arrêté
 *   du 14/03/2005, art. 9). Aucun changement de calcul.
 *
 * 🔵 Déduit (par la note, ou choix de ce module) :
 * - (note) un stock à une date, jamais un maximum : 31/12 (cotisation), 30/06 et 31/12 (commissaire aux comptes), fins
 *   de trimestre (états par mandat) ; la note rattache l'attestation du 15/03 à l'arrêté du 31/12 et celle du 15/09 à
 *   l'arrêté du 30/06 ;
 * - source des soldes : la comptabilité du syndicat (traitements.ts), lue par la balance d'etats-comptables.ts arrêtée
 *   à la date (écritures datées au plus tard ce jour, ce jour compris) : solde débit − crédit du sous-compte 512 de chaque
 *   compte bancaire, comme la comptabilité spéciale arrêtée de R. 814-29. Ni le solde porté par le compte
 *   (CompteBancaireMandat.soldeCentimes, sans date) ni l'arrêté de rapprochement (rapprochement-bancaire.ts, à ses seules
 *   dates) ne donnent un solde à une date quelconque ; aucune autre source n'est créée ; le solde bancaire n'est lu
 *   qu'en annexe, sur le relevé à la date fourni par l'appelant (J67, R92) ;
 * - date limite = dernier jour pour agir, sans report au jour ouvrable : état trimestriel, fin du trimestre + 15 jours
 *   (« dans les quinze jours suivant ») ; attestation du commissaire aux comptes, le 14 mars et le 14 septembre (« avant
 *   le 15 » : décision J63 ci-dessus) ; un jour non ouvré porte une alerte (J67, R93) ;
 * - rubrique de chaque compte (rubriqueDuCompte) : compte de classe 50 d'abord, « fonds placés » (F98), puis fonds de
 *   travaux (compte séparé, compte repris qui le tenait, ou placement réservé au fonds, comme virement-interne.ts),
 *   Caisse des dépôts, compte courant (seule nature dont le libellé dit « au nom du syndicat »), autres natures (avance
 *   travaux, placement en sous-compte 512, sous-compte du centralisateur, compte repris : le domaine ne porte pas leur
 *   titulaire) ; un compte de classe 50 n'est admis qu'avec la nature « placement » ;
 * - ventilation : par mandat, par compte, par nature (D-BANQUE), par établissement (Banque.etablissement ; un compte de
 *   nature « Caisse des dépôts » sans établissement saisi y est rangé ; casse, accents et espaces ne séparent pas deux
 *   établissements), par catégorie de mission (réglage du cabinet, J67, R91 ; par défaut le régime du mandat,
 *   regimeDepuisFondement : art. 46, art. 47, art. 29-1 ; à part, un régime reconnu hors de la liste du cabinet
 *   (« hors catégories ») et tout autre fondement (« non reconnu ») ;
 * - montants : un compte au solde négatif n'est pas un fonds détenu et ne vient jamais en déduction des autres comptes,
 *   ni des autres mandats : les totaux additionnent les soldes positifs ; les négatifs sont totalisés à part et signalés ;
 * - couverture (R. 814-37), sur tous les comptes du mandat, quel que soit le périmètre : sous-compte d'un compte partagé
 *   entre mandats (sous-compte du centralisateur du cabinet, ou même IBAN sous plusieurs mandats) au solde négatif :
 *   servi par un autre mandat (bloquant) ; compte sans IBAN au solde négatif : couverture non vérifiable (bloquant), le
 *   compte étant traité comme le compte global de l'administrateur tant que son IBAN n'est pas saisi (décision J62
 *   ci-dessus ; la note cite le compte global de R. 814-40 et le compte « général » de la règle 512.5) : il n'est jamais
 *   supposé propre ; mandat au solde net négatif (bloquant ; s'il
 *   est incomplet, le solde ne porte que sur ses comptes ventilés) ; compte propre identifié par son IBAN au solde
 *   négatif : découvert (alerte) ;
 * - compte partagé sans ventilation : un mandat tenu en compte centralisateur du cabinet sans sous-compte, ou un même
 *   compte 512 déclaré sous plusieurs mandats, n'a pas de part calculable : rien n'est attribué ni inventé, le mandat est
 *   incomplet et l'anomalie le dit. Un compte déclaré sous plusieurs mandats doit l'être à l'identique (identifiant,
 *   nature, IBAN, établissement), et un identifiant de compte ne désigne qu'un 512 : sinon les données sont refusées.
 *
 * 🔴 Non établi (note, § 4.3 et 6.6 ; à trancher par le référent métier) :
 * - rééditer un état « dans son état de la fin du trimestre » (1033.5) : le calcul relit les écritures datées au plus
 *   tard ce jour ; une écriture passée après coup à une date antérieure le changerait. La garantie relève du verrou de
 *   saisie (verrou-saisie.ts : édition figée, arrêté des comptes), que ce module ne pose pas ;
 * - mandats successifs d'un même syndicat (Frédéric, données de l'appelant) : ses comptes sont au syndicat (D1), et ce
 *   module ne connaît pas les dates des mandats ; deux mandats qui déclarent le même compte ne sont pas départagés par
 *   date (compte non ventilé) : l'appelant ne passe que les mandats qui détiennent les fonds à la date ;
 * - les grilles de vérification des contrôleurs (C. com. A. 814-4, annexes 8-5-1 et 8-5-2) n'ont pas été lues par la
 *   note : elles pourraient demander d'autres chiffres ;
 * - l'indicateur interne de maximum (maximumInterneFondsDetenus) : à garder ou non (note, § 4.3, question 6). Il n'a
 *   aucune valeur réglementaire et n'est pas une « pointe de garantie ».
 *
 * ⚪ Non trouvé (note) : comment la caisse de garantie recueille les fonds non distribués au 31 décembre, d'où aucune
 * date limite pour la cotisation. Hors de ce module : la répartition des intérêts « au prorata des soldes moyens »
 * (R. 814-40) et l'administrateur provisoire non inscrit (L. 1965 art. 29-1, III, al. 2).
 */

const FONDEMENT_COUVERTURE = 'C. com. R. 814-37'
const FONDEMENT_ATTESTATION = 'C. com. R. 814-30'
const ETABLISSEMENT_CAISSE_DEPOTS = 'Caisse des dépôts et consignations'
/** Compte financier lu : sous-compte 512, ou compte de placement de classe 50, 501 ou 502 (F98). */
const COMPTE_FINANCIER = /^([^.]{4})\.(?:512[0-9A-Z]{2}|50[12][0-9A-Z]{2})\.[0-9A-Z]{5}\.[0-9A-Z]$/
const COMPTE_50 = /^[^.]{4}\.50[12]/
const SEGMENT_SYNDICAT = /^[^.]{4}$/

/** Décision du 20/11/2026 (partie C, F98) : compte de placement de classe 50 (arrêté du 14/03/2005, art. 7). */
const estCompteDeClasse50 = (compte: string | undefined): boolean => compte !== undefined && COMPTE_50.test(compte)

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)
const positif = (centimes: number): number => Math.max(centimes, 0)
const sommePositive = (lignes: readonly { soldeCentimes: number }[]): number => lignes.reduce((s, l) => s + positif(l.soldeCentimes), 0)

function verifierDate(date: string, nom = 'Date'): void {
  if (!estDateIsoValide(date)) throw new Error(`${nom} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

// ─── Périmètre (réglage du cabinet ; J67, R90) ──────────────────────────────────────────────

/** Rubriques dont l'inclusion dans les « fonds non distribués » n'est pas établie (note, § 2.6 et 4.3). */
export const RUBRIQUES_FONDS_DETENUS = {
  caisse_depots: { libelle: 'Comptes à la Caisse des dépôts' },
  au_nom_du_syndicat: { libelle: 'Comptes au nom du syndicat (L. 1965 art. 18, II)' },
  fonds_travaux: { libelle: 'Fonds de travaux' },
  autres_comptes: { libelle: 'Autres comptes (avance travaux, placement, sous-compte du cabinet, compte repris)' },
  /** Décision du 20/11/2026 (partie C, F98) : ligne à part, incluse par défaut. */
  fonds_places: { libelle: 'Fonds placés (classe 50 : 501 « Compte à terme », 502 « Autre compte »)' },
} as const satisfies Record<string, { libelle: string }>
export type RubriqueFondsDetenus = keyof typeof RUBRIQUES_FONDS_DETENUS

const RUBRIQUES = Object.keys(RUBRIQUES_FONDS_DETENUS) as RubriqueFondsDetenus[]

/** Rubriques comptées dans les fonds détenus : réglage du cabinet, jamais une règle légale. */
export type PerimetreFondsDetenus = Readonly<Record<RubriqueFondsDetenus, boolean>>

/**
 * Valeur par défaut prudente : tout inclure (J67, R90), qu'aucun texte lu ne fixe ; à ajuster après la réponse de la caisse
 * de garantie (J65). Fonds placés inclus par défaut (décision du 20/11/2026, partie C, F98).
 */
export const PERIMETRE_FONDS_DETENUS_PAR_DEFAUT: PerimetreFondsDetenus = Object.freeze({
  caisse_depots: true,
  au_nom_du_syndicat: true,
  fonds_travaux: true,
  autres_comptes: true,
  fonds_places: true,
})

export const AVERTISSEMENT_FONDS_DETENUS =
  'Fonds détenus pour autrui : solde comptable des comptes des mandats à la date. Le périmètre est un réglage du cabinet : ' +
  'aucun texte lu ne dit ce que comprennent les « fonds non distribués » (C. com. R. 814-21). Par défaut, tout est ' +
  'inclus, à confirmer auprès de la caisse de garantie.'

/** Réglage du périmètre : chaque rubrique absente prend la valeur par défaut ; valeur non booléenne ou rubrique inconnue refusées. */
export function creerPerimetreFondsDetenus(saisie: Partial<Record<RubriqueFondsDetenus, boolean>>): PerimetreFondsDetenus {
  for (const [rubrique, valeur] of Object.entries(saisie)) {
    if (!Object.hasOwn(RUBRIQUES_FONDS_DETENUS, rubrique)) throw new Error(`Rubrique de fonds inconnue : « ${rubrique} ».`)
    if (valeur !== undefined && typeof valeur !== 'boolean') throw new Error(`Rubrique « ${rubrique} » : inclus oui ou non attendu.`)
  }
  return Object.freeze(Object.fromEntries(RUBRIQUES.map((r) => [r, saisie[r] ?? PERIMETRE_FONDS_DETENUS_PAR_DEFAUT[r]]))) as PerimetreFondsDetenus
}

/**
 * Rubrique d'un compte : un compte de classe 50 d'abord, « fonds placés » (décision du 20/11/2026, partie C, F98), puis le
 * fonds de travaux (compte séparé, compte repris qui le tenait, placement réservé au fonds : J71), la Caisse des dépôts,
 * le compte courant au nom du syndicat, les autres natures (le domaine ne porte pas leur titulaire).
 */
export function rubriqueDuCompte(
  compte: Pick<CompteFondsDetenus, 'nature' | 'tenaitFondsTravaux' | 'reserveAuFondsTravaux'> & { compte512?: string },
): RubriqueFondsDetenus {
  if (estCompteDeClasse50(compte.compte512)) return 'fonds_places'
  if (estCompteDuFondsTravaux(compte)) return 'fonds_travaux'
  if (compte.nature === 'caisse_depots') return 'caisse_depots'
  if (compte.nature === 'courant') return 'au_nom_du_syndicat'
  return 'autres_comptes'
}

// ─── Données ────────────────────────────────────────────────────────────────────────────────

/**
 * Catégorie de mission du cabinet (J67, R91 ; C. com. R. 814-30 ne la définit pas) : son libellé et les régimes de mandat
 * qu'elle regroupe.
 */
export interface CategorieMissionCabinet {
  cle: string
  libelle: string
  regimes: readonly Regime[]
}

/** Liste des catégories de mission du cabinet, dans son ordre ; un régime est au plus dans une catégorie. */
export type CategoriesMission = readonly CategorieMissionCabinet[]

/** Clé de catégorie de mission : celle d'une catégorie du cabinet, CATEGORIE_HORS_CABINET ou CATEGORIE_NON_RECONNUE. */
export type CategorieMission = string

/** Mandat dont le régime est reconnu (art. 46, art. 47, art. 29-1) mais rangé dans aucune catégorie du cabinet (J67, R91). */
export const CATEGORIE_HORS_CABINET: CategorieMission = 'hors_categories'
const LIBELLE_HORS_CABINET = 'Régime hors des catégories du cabinet'
/** Mandat dont le fondement n'est pas reconnu (mandat ad hoc…). */
export const CATEGORIE_NON_RECONNUE: CategorieMission = 'non_reconnue'
const LIBELLE_NON_RECONNUE = 'Fondement non reconnu (mandat ad hoc ou autre)'
const CLE_NON_VENTILE = 'non_ventile'
const CLES_RESERVEES: ReadonlySet<string> = new Set([CATEGORIE_HORS_CABINET, CATEGORIE_NON_RECONNUE, CLE_NON_VENTILE])
const REGIMES = Object.keys(LIBELLES_REGIMES) as Regime[]

/** J67, R91 — par défaut : une catégorie par régime du mandat (art. 46, art. 47, art. 29-1), avec son libellé. */
export const CATEGORIES_MISSION_PAR_DEFAUT: CategoriesMission = Object.freeze(
  REGIMES.map((regime) => Object.freeze({ cle: regime, libelle: LIBELLES_REGIMES[regime].libelle, regimes: Object.freeze([regime]) })),
)

function verifierCategorie(c: CategorieMissionCabinet, cles: Set<string>, rangs: Map<Regime, string>): CategorieMissionCabinet {
  const cle = c.cle.trim()
  if (!cle) throw new Error('Catégorie de mission sans clé.')
  if (CLES_RESERVEES.has(cle)) throw new Error(`Catégorie de mission « ${cle} » : clé réservée.`)
  if (cles.has(cle)) throw new Error(`Catégorie de mission « ${cle} » en double.`)
  cles.add(cle)
  const libelle = normaliserEspaces(c.libelle)
  if (!libelle) throw new Error(`Catégorie de mission « ${cle} » sans libellé.`)
  if (c.regimes.length === 0) throw new Error(`Catégorie de mission « ${cle} » : aucun régime.`)
  for (const regime of c.regimes) {
    if (!Object.hasOwn(LIBELLES_REGIMES, regime)) throw new Error(`Catégorie de mission « ${cle} » : régime inconnu « ${regime} ».`)
    const deja = rangs.get(regime)
    if (deja !== undefined) throw new Error(`Régime « ${regime} » rangé dans deux catégories de mission (« ${deja} », « ${cle} »).`)
    rangs.set(regime, cle)
  }
  return Object.freeze({ cle, libelle, regimes: Object.freeze([...c.regimes]) })
}

/**
 * J67, R91 — réglage du cabinet : sa liste de catégories de mission, à faire valider par le commissaire aux comptes
 * (J65). Refuse une liste vide, une clé vide, en double ou réservée (« hors_categories », « non_reconnue »,
 * « non_ventile »), un libellé vide, une catégorie sans régime, un régime inconnu ou rangé dans deux catégories. Un
 * régime absent de la liste n'est pas refusé : ses mandats vont dans « hors_categories ».
 */
export function creerCategoriesMission(saisie: readonly CategorieMissionCabinet[]): CategoriesMission {
  if (saisie.length === 0) throw new Error('Catégories de mission : au moins une catégorie attendue.')
  const cles = new Set<string>()
  const rangs = new Map<Regime, string>()
  return Object.freeze(saisie.map((c) => verifierCategorie(c, cles, rangs)))
}

/**
 * Catégorie d'un mandat : celle du cabinet qui contient son régime ; régime reconnu absent de la liste du cabinet :
 * « hors catégories » ; fondement non reconnu : « non reconnue ».
 */
function categorieDuMandat(fondement: string, categories: CategoriesMission): CategorieMission {
  const regime = regimeDepuisFondement(fondement)
  if (regime === null) return CATEGORIE_NON_RECONNUE
  return categories.find((c) => c.regimes.includes(regime))?.cle ?? CATEGORIE_HORS_CABINET
}

const LIBELLE_NON_VENTILE = 'Comptes partagés entre mandats, non ventilés'
const LIBELLE_ETABLISSEMENT_NON_RENSEIGNE = 'Établissement non renseigné'

/**
 * Compte bancaire d'un mandat, tel que le calcul le lit (D-BANQUE : nature ; plan comptable : son 512, ou son compte de
 * classe 50, 501 ou 502, pour un placement : décision du 20/11/2026, partie C, F98).
 */
export interface CompteFondsDetenus
  extends Pick<CompteVirementInterne, 'banqueId' | 'nature' | 'iban' | 'compte512' | 'tenaitFondsTravaux' | 'reserveAuFondsTravaux'> {
  /** Établissement de crédit (Banque.etablissement) ; null ou vide : non renseigné. */
  etablissement: string | null
}

export interface MandatFondsDetenus {
  mandatId: string
  /** Syndicat dont la comptabilité porte les comptes du mandat (D1). */
  coproprieteId: string
  /** Segment du syndicat dans ses numéros de compte : « <syndicat>.512xx.<auxiliaire>.<repère> ». */
  segmentSyndicat: string
  /** Libellé du fondement (Mandat.fondement) : la catégorie de mission en est tirée. */
  fondement: string
  /** Mode de tenue propre au mandat (Mandat.modeComptesBancaires) ; null ou absent : celui du cabinet. */
  modeComptes?: ModeTenueComptes | null
  comptes: readonly CompteFondsDetenus[]
}

/** Comptabilité d'un syndicat : ses traitements (R6 : tout mouvement appartient à un traitement). */
export interface ComptabiliteSyndicat {
  coproprieteId: string
  traitements: Traitement[]
}

export interface DonneesFondsDetenus {
  reglagesComptes: ReglagesComptesCabinet
  mandats: readonly MandatFondsDetenus[]
  comptabilites: readonly ComptabiliteSyndicat[]
}

export interface OptionsFondsDetenus {
  /** Réglage du cabinet ; absent : PERIMETRE_FONDS_DETENUS_PAR_DEFAUT. */
  perimetre?: PerimetreFondsDetenus
  /** Réglage du cabinet (J67, R91) ; absent : CATEGORIES_MISSION_PAR_DEFAUT, le régime du mandat. */
  categoriesMission?: CategoriesMission
  /** Filtre de mandats ; absent : tous. Un identifiant inconnu est refusé. */
  mandatIds?: readonly string[]
}

// ─── Résultat ───────────────────────────────────────────────────────────────────────────────

/** Solde d'un compte à la date (R. 814-34 : solde par compte). */
export interface LigneFondsDetenus {
  /** Mandat du compte ; null : compte déclaré sous plusieurs mandats, sans ventilation (🔴, attribué à aucun). */
  mandatId: string | null
  /** Mandats qui déclarent le compte. */
  mandatIds: string[]
  coproprieteId: string
  banqueId: string
  compte512: string
  nature: NatureCompteBancaire
  rubrique: RubriqueFondsDetenus
  /** Établissement retenu ; null : non renseigné. */
  etablissement: string | null
  /** Catégorie du mandat ; null pour un compte non ventilé. */
  categorie: CategorieMission | null
  /** Solde comptable signé (débit − crédit) à la date. */
  soldeCentimes: number
  /** Rubrique comptée par le périmètre. */
  inclus: boolean
  /**
   * true : compte bancaire partagé entre mandats (sous-compte du centralisateur, IBAN ou 512 communs) ; false : compte
   * identifié par son IBAN, propre au mandat ; null : compte sans IBAN, traité comme le compte global de l'administrateur
   * tant que son IBAN n'est pas saisi (décision du 17/11/2026, J62) : jamais supposé propre au mandat.
   */
  mutualise: boolean | null
}

export interface FondsDuMandat {
  mandatId: string
  coproprieteId: string
  categorie: CategorieMission
  mode: ModeTenueComptes
  /** Soldes positifs des comptes inclus dans le périmètre. */
  fondsDetenusCentimes: number
  /** Soldes positifs des comptes hors périmètre. */
  horsPerimetreCentimes: number
  /** Somme signée de tous ses comptes ventilés : base du contrôle de couverture. */
  soldeNetCentimes: number
  nombreComptes: number
  /** false : une part de ses fonds n'est pas ventilée dans les données (ou aucun compte n'est déclaré). */
  complet: boolean
}

export interface TotalFondsDetenus<C extends string> {
  cle: C
  libelle: string
  fondsDetenusCentimes: number
  nombreComptes: number
}

export type CodeAnomalieFondsDetenus =
  | 'ventilation_absente'
  | 'aucun_compte'
  | 'compte_partage_entre_mandats'
  | 'etablissement_non_renseigne'
  | 'servi_par_un_autre_mandat'
  | 'couverture_non_verifiable'
  | 'compte_solde_negatif'
  | 'mandat_solde_negatif'
  | 'ecart_banque_non_explique'

export interface AnomalieFondsDetenus {
  code: CodeAnomalieFondsDetenus
  /** « bloquant » : couverture non assurée ou non vérifiable ; « alerte » : donnée à compléter ou découvert. */
  gravite: 'bloquant' | 'alerte'
  mandatIds: string[]
  /** Compte visé ; null pour une anomalie du mandat. */
  banqueId: string | null
  message: string
  /** Texte cité, null pour une règle de gestion. */
  fondement: string | null
}

const CODES_COUVERTURE: ReadonlySet<CodeAnomalieFondsDetenus> = new Set<CodeAnomalieFondsDetenus>([
  'ventilation_absente',
  'compte_partage_entre_mandats',
  'servi_par_un_autre_mandat',
  'couverture_non_verifiable',
  'compte_solde_negatif',
  'mandat_solde_negatif',
])

export interface FondsDetenus {
  date: string
  perimetre: PerimetreFondsDetenus
  /** Le périmètre est celui par défaut (valeur prudente, non fixée par un texte lu ; J67, R90). */
  perimetreParDefaut: boolean
  avertissement: string
  /** Tous les comptes, inclus ou non, dans l'ordre des mandats. */
  comptes: LigneFondsDetenus[]
  mandats: FondsDuMandat[]
  /** Les quatre rubriques, avec leur inclusion. */
  parRubrique: (TotalFondsDetenus<RubriqueFondsDetenus> & { inclus: boolean })[]
  parNature: TotalFondsDetenus<NatureCompteBancaire>[]
  /** Clé : nom normalisé (minuscules, sans accents), ou « non_renseigne ». */
  parEtablissement: TotalFondsDetenus<string>[]
  /** Catégories du cabinet dans son ordre, puis « hors_categories », « non_reconnue » et « non_ventile » (J67, R91). */
  parCategorie: TotalFondsDetenus<CategorieMission>[]
  /** Soldes positifs des comptes inclus. */
  totalCentimes: number
  /** Part du total tenue sur des comptes non ventilés entre mandats. */
  nonVentileCentimes: number
  horsPerimetreCentimes: number
  /** Somme des soldes négatifs (≤ 0), tous comptes : jamais déduite du total. */
  soldesNegatifsCentimes: number
  anomalies: AnomalieFondsDetenus[]
}

// ─── Lecture des données ────────────────────────────────────────────────────────────────────

interface MandatResolu {
  mandatId: string
  coproprieteId: string
  categorie: CategorieMission
  mode: ModeTenueComptes
  ventilationAbsente: boolean
  sansCompte: boolean
}

interface CompteResolu {
  coproprieteId: string
  banqueId: string
  compte512: string
  nature: NatureCompteBancaire
  rubrique: RubriqueFondsDetenus
  etablissement: string | null
  iban: string | null
  mandatIds: string[]
}

interface Resolution {
  mandats: MandatResolu[]
  comptes: (CompteResolu & { mutualise: boolean | null })[]
  traitements: ReadonlyMap<string, Traitement[]>
}

const ibanNormalise = (iban: string): string => iban.replaceAll(/\s+/g, '').toUpperCase()

function etablissementRetenu(compte: CompteFondsDetenus): string | null {
  const saisi = normaliserEspaces(compte.etablissement ?? '')
  if (saisi) return saisi
  return compte.nature === 'caisse_depots' ? ETABLISSEMENT_CAISSE_DEPOTS : null
}

const texteVide = (valeur: string | null | undefined): boolean => !valeur?.trim()

function verifierCompte(c: CompteFondsDetenus, m: MandatFondsDetenus): void {
  const nom = `Mandat ${m.mandatId}, compte ${c.banqueId}`
  if (texteVide(c.banqueId)) throw new Error(`Mandat ${m.mandatId} : compte sans identifiant.`)
  if (!Object.hasOwn(NATURES_COMPTE_BANCAIRE, c.nature)) throw new Error(`${nom} : nature inconnue « ${c.nature} ».`)
  verifierMarquesFondsTravaux(c, nom)
  const lu = COMPTE_FINANCIER.exec(c.compte512)
  if (!lu)
    throw new Error(
      `${nom} : compte « ${c.compte512} », 512 au format <syndicat>.512xx.<auxiliaire>.<repère>, ou placement de classe 50 (501xx, 502xx), attendu.`,
    )
  if (lu[1] !== m.segmentSyndicat)
    throw new Error(`${nom} : compte « ${c.compte512} » d'un autre syndicat (segment « ${m.segmentSyndicat} » attendu, D1).`)
  if (estCompteDeClasse50(c.compte512) && c.nature !== 'placement')
    throw new Error(`${nom} : compte « ${c.compte512} » de classe 50 (fonds placés) : nature « placement » attendue (décision du 20/11/2026, partie C, F98).`)
}

function verifierMandat(m: MandatFondsDetenus, segments: Map<string, string>): void {
  if (texteVide(m.mandatId)) throw new Error('Mandat sans identifiant.')
  if (texteVide(m.coproprieteId)) throw new Error(`Mandat ${m.mandatId} sans syndicat (D1).`)
  if (!SEGMENT_SYNDICAT.test(m.segmentSyndicat))
    throw new Error(`Mandat ${m.mandatId} : segment du syndicat « ${m.segmentSyndicat} » invalide (quatre caractères attendus).`)
  const segment = segments.get(m.coproprieteId)
  if (segment !== undefined && segment !== m.segmentSyndicat)
    throw new Error(`Syndicat ${m.coproprieteId} : deux segments (« ${segment} », « ${m.segmentSyndicat} ») selon les mandats.`)
  segments.set(m.coproprieteId, m.segmentSyndicat)
  const vus = new Set<string>()
  for (const c of m.comptes) {
    verifierCompte(c, m)
    for (const cle of [`b:${c.banqueId}`, `c:${c.compte512}`]) {
      if (vus.has(cle)) throw new Error(`Mandat ${m.mandatId} : compte ${c.banqueId} (${c.compte512}) déclaré deux fois.`)
      vus.add(cle)
    }
  }
}

function indexerComptabilites(comptabilites: readonly ComptabiliteSyndicat[]): Map<string, Traitement[]> {
  const index = new Map<string, Traitement[]>()
  for (const { coproprieteId, traitements } of comptabilites) {
    if (index.has(coproprieteId)) throw new Error(`Comptabilité du syndicat ${coproprieteId} fournie deux fois.`)
    index.set(coproprieteId, traitements)
  }
  return index
}

function mandatsRetenus(mandats: readonly MandatFondsDetenus[], filtre: readonly string[] | undefined): MandatFondsDetenus[] {
  const ids = new Set<string>()
  for (const m of mandats) {
    if (ids.has(m.mandatId)) throw new Error(`Mandat ${m.mandatId} fourni deux fois.`)
    ids.add(m.mandatId)
  }
  if (filtre === undefined) return [...mandats]
  const inconnu = filtre.find((id) => !ids.has(id))
  if (inconnu !== undefined) throw new Error(`Mandat demandé inconnu : « ${inconnu} ».`)
  return mandats.filter((m) => filtre.includes(m.mandatId))
}

const cleEtablissement = (etablissement: string | null): string | null => (etablissement === null ? null : sansAccentsMinuscules(etablissement))

function compteResolu(c: CompteFondsDetenus, m: MandatFondsDetenus): CompteResolu {
  return {
    coproprieteId: m.coproprieteId,
    banqueId: c.banqueId,
    compte512: c.compte512,
    nature: c.nature,
    rubrique: rubriqueDuCompte(c),
    etablissement: etablissementRetenu(c),
    iban: c.iban ? ibanNormalise(c.iban) : null,
    mandatIds: [m.mandatId],
  }
}

/**
 * Un compte déclaré sous plusieurs mandats doit l'être à l'identique (identifiant, nature, rubrique, IBAN, établissement
 * à la casse, aux accents et aux espaces près) : sinon la première description l'emporterait en silence.
 */
function verifierMemeCompte(deja: CompteResolu, neuf: CompteResolu, mandatId: string): void {
  const ecart = [
    deja.banqueId !== neuf.banqueId && 'identifiant',
    deja.nature !== neuf.nature && 'nature',
    deja.rubrique !== neuf.rubrique && 'fonds de travaux',
    deja.iban !== neuf.iban && 'IBAN',
    cleEtablissement(deja.etablissement) !== cleEtablissement(neuf.etablissement) && 'établissement',
  ].filter((champ) => champ !== false)
  if (ecart.length > 0)
    throw new Error(
      `Compte ${neuf.compte512} du syndicat ${neuf.coproprieteId} décrit différemment sous les mandats ${deja.mandatIds[0]} et ${mandatId} (${ecart.join(', ')}).`,
    )
}

/** Ajoute les comptes d'un mandat à l'index des comptes du cabinet, un par compte 512 du syndicat. */
function indexerComptes(m: MandatFondsDetenus, comptes: Map<string, CompteResolu>, parBanque: Map<string, CompteResolu>): void {
  for (const c of m.comptes) {
    const neuf = compteResolu(c, m)
    const memeBanque = parBanque.get(c.banqueId)
    if (memeBanque && (memeBanque.coproprieteId !== neuf.coproprieteId || memeBanque.compte512 !== neuf.compte512))
      throw new Error(
        `Compte ${c.banqueId} déclaré avec deux comptes 512 (« ${memeBanque.compte512} » du syndicat ${memeBanque.coproprieteId} sous le mandat ${memeBanque.mandatIds[0]}, « ${c.compte512} » du syndicat ${m.coproprieteId} sous le mandat ${m.mandatId}).`,
      )
    const cle = `${m.coproprieteId}|${c.compte512}`
    const deja = comptes.get(cle)
    if (deja) {
      verifierMemeCompte(deja, neuf, m.mandatId)
      deja.mandatIds.push(m.mandatId)
    } else {
      comptes.set(cle, neuf)
      parBanque.set(c.banqueId, neuf)
    }
  }
}

/**
 * Partage du compte bancaire : un sous-compte du centralisateur, un 512 déclaré sous plusieurs mandats ou un IBAN commun
 * à plusieurs mandats est partagé ; un compte identifié par son IBAN, propre au mandat ; sans IBAN, traité comme le
 * compte global de l'administrateur tant que l'IBAN n'est pas saisi (J62 : null, jamais supposé propre).
 */
function partageDuCompte(c: CompteResolu, mandatsParIban: ReadonlyMap<string, ReadonlySet<string>>): boolean | null {
  if (c.nature === 'sous_compte_centralisateur' || c.mandatIds.length > 1) return true
  if (c.iban === null) return null
  return (mandatsParIban.get(c.iban)?.size ?? 0) > 1
}

/**
 * Lit et contrôle les données : chaque compte une fois, avec tous les mandats qui le déclarent. Le partage d'un compte
 * (même 512, même IBAN) se lit sur TOUS les mandats, filtre ou non : filtrer ne fait pas d'un compte partagé un compte
 * propre. Seuls les mandats retenus, et les comptes que l'un d'eux déclare, restent ; leur comptabilité est exigée.
 * La catégorie de chaque mandat suit les catégories du cabinet (J67, R91).
 */
function resoudre(donnees: DonneesFondsDetenus, filtre: readonly string[] | undefined, categories: CategoriesMission): Resolution {
  const traitements = indexerComptabilites(donnees.comptabilites)
  const retenus = new Set(mandatsRetenus(donnees.mandats, filtre).map((m) => m.mandatId))
  const segments = new Map<string, string>()
  const comptes = new Map<string, CompteResolu>()
  const parBanque = new Map<string, CompteResolu>()
  const mandats = donnees.mandats.map((m): MandatResolu => {
    verifierMandat(m, segments)
    const { mode } = resoudreModeComptes(donnees.reglagesComptes, m.modeComptes)
    indexerComptes(m, comptes, parBanque)
    return {
      mandatId: m.mandatId,
      coproprieteId: m.coproprieteId,
      categorie: categorieDuMandat(m.fondement, categories),
      mode,
      ventilationAbsente: mode === 'centralisateur_cabinet' && !m.comptes.some((c) => c.nature === 'sous_compte_centralisateur'),
      sansCompte: m.comptes.length === 0,
    }
  })
  for (const m of mandats)
    if (retenus.has(m.mandatId) && !traitements.has(m.coproprieteId))
      throw new Error(`Comptabilité du syndicat ${m.coproprieteId} absente (mandat ${m.mandatId}) : ses soldes ne peuvent pas être calculés.`)
  const mandatsParIban = new Map<string, Set<string>>()
  for (const c of comptes.values())
    if (c.iban) mandatsParIban.set(c.iban, new Set([...(mandatsParIban.get(c.iban) ?? []), ...c.mandatIds]))
  const lus = [...comptes.values()]
    .filter((c) => c.mandatIds.some((id) => retenus.has(id)))
    .map((c) => ({ ...c, mutualise: partageDuCompte(c, mandatsParIban) }))
  return { mandats: mandats.filter((m) => retenus.has(m.mandatId)), comptes: lus, traitements }
}

const categoriesRetenues = (categories: CategoriesMission | undefined): CategoriesMission =>
  categories === undefined ? CATEGORIES_MISSION_PAR_DEFAUT : creerCategoriesMission(categories)

function perimetreRetenu(perimetre: PerimetreFondsDetenus | undefined): PerimetreFondsDetenus {
  return perimetre === undefined ? PERIMETRE_FONDS_DETENUS_PAR_DEFAUT : creerPerimetreFondsDetenus(perimetre)
}

/** Solde (débit − crédit) de chaque compte à la date, par syndicat : balance arrêtée à la date (etats-comptables.ts). */
function soldesA(date: string, resolution: Resolution): Map<string, Map<string, number>> {
  const parSyndicat = new Map<string, Map<string, number>>()
  for (const coproprieteId of new Set(resolution.comptes.map((c) => c.coproprieteId))) {
    const { lignes } = balance(resolution.traitements.get(coproprieteId) ?? [], { au: date })
    parSyndicat.set(coproprieteId, new Map(lignes.map((l) => [l.compte, l.debitCentimes - l.creditCentimes])))
  }
  return parSyndicat
}

function lignesA(date: string, resolution: Resolution, perimetre: PerimetreFondsDetenus): LigneFondsDetenus[] {
  const soldes = soldesA(date, resolution)
  const categories = new Map(resolution.mandats.map((m) => [m.mandatId, m.categorie]))
  return resolution.comptes.map((c) => {
    const mandatId = c.mandatIds.length === 1 ? c.mandatIds[0] : null
    return {
      mandatId,
      mandatIds: [...c.mandatIds],
      coproprieteId: c.coproprieteId,
      banqueId: c.banqueId,
      compte512: c.compte512,
      nature: c.nature,
      rubrique: c.rubrique,
      etablissement: c.etablissement,
      categorie: mandatId === null ? null : (categories.get(mandatId) ?? null),
      soldeCentimes: soldes.get(c.coproprieteId)?.get(c.compte512) ?? 0,
      inclus: perimetre[c.rubrique],
      mutualise: c.mutualise,
    }
  })
}

// ─── Anomalies ──────────────────────────────────────────────────────────────────────────────

function anomaliesDesMandats(mandats: readonly MandatResolu[], lignes: readonly LigneFondsDetenus[]): AnomalieFondsDetenus[] {
  const anomalies: AnomalieFondsDetenus[] = []
  for (const m of mandats) {
    if (m.ventilationAbsente)
      anomalies.push({
        code: 'ventilation_absente',
        gravite: 'bloquant',
        mandatIds: [m.mandatId],
        banqueId: null,
        message: `Mandat ${m.mandatId} tenu en compte centralisateur du cabinet sans sous-compte : sa part du compte du cabinet n'est pas ventilée dans les données ; elle est non calculée. Les fonds d'un mandat ne servent jamais un autre mandat : ouvrir le sous-compte du mandat.`,
        fondement: FONDEMENT_COUVERTURE,
      })
    if (m.sansCompte)
      anomalies.push({
        code: 'aucun_compte',
        gravite: 'alerte',
        mandatIds: [m.mandatId],
        banqueId: null,
        message: `Mandat ${m.mandatId} : aucun compte déclaré ; ses fonds détenus ne sont pas calculables.`,
        fondement: null,
      })
  }
  for (const l of lignes)
    if (l.mandatId === null)
      anomalies.push({
        code: 'compte_partage_entre_mandats',
        gravite: 'bloquant',
        mandatIds: [...l.mandatIds],
        banqueId: l.banqueId,
        message: `Compte ${l.banqueId} (${l.compte512}) déclaré sous plusieurs mandats (${l.mandatIds.join(', ')}) : son solde n'est pas ventilé entre eux dans les données ; il n'est attribué à aucun.`,
        fondement: FONDEMENT_COUVERTURE,
      })
  return anomalies
}

/**
 * Compte ventilé au solde négatif, selon son partage : partagé, ses sorties ont été servies par un autre mandat ;
 * sans IBAN, traité comme le compte global de l'administrateur (J62), la couverture n'est pas vérifiable ; propre au
 * mandat, découvert.
 */
function anomalieDuSoldeNegatif(l: LigneFondsDetenus, mandatId: string, jour: string): AnomalieFondsDetenus {
  const solde = `Compte ${l.banqueId} du mandat ${mandatId} : solde de ${euros(l.soldeCentimes)} au ${jour}`
  const commun = { mandatIds: [mandatId], banqueId: l.banqueId }
  if (l.mutualise === true)
    return {
      ...commun,
      code: 'servi_par_un_autre_mandat',
      gravite: 'bloquant',
      message: `${solde} sur un compte partagé avec d'autres mandats ; ses sorties ont été servies par les fonds d'un autre mandat.`,
      fondement: FONDEMENT_COUVERTURE,
    }
  if (l.mutualise === null)
    return {
      ...commun,
      code: 'couverture_non_verifiable',
      gravite: 'bloquant',
      message: `${solde}, sur un compte sans IBAN, traité comme le compte global de l'administrateur tant que son IBAN n'est pas saisi (J62 ; C. com. R. 814-37, R. 814-41 ; règle professionnelle 512.5) : découvert ou fonds d'un autre mandat, la couverture n'est pas vérifiable ; saisir l'IBAN de chaque compte du mandat.`,
      fondement: FONDEMENT_COUVERTURE,
    }
  return {
    ...commun,
    code: 'compte_solde_negatif',
    gravite: 'alerte',
    message: `${solde} (découvert) ; il n'est pas compensé par les autres comptes du mandat.`,
    fondement: null,
  }
}

function anomaliesDesComptes(date: string, lignes: readonly LigneFondsDetenus[]): AnomalieFondsDetenus[] {
  const jour = dateIsoVersFr(date)
  const anomalies: AnomalieFondsDetenus[] = []
  for (const l of lignes) {
    if (l.etablissement === null)
      anomalies.push({
        code: 'etablissement_non_renseigne',
        gravite: 'alerte',
        mandatIds: [...l.mandatIds],
        banqueId: l.banqueId,
        message: `Compte ${l.banqueId} : établissement de crédit non renseigné ; l'attestation du commissaire aux comptes indique les fonds par établissement.`,
        fondement: FONDEMENT_ATTESTATION,
      })
    if (l.mandatId !== null && l.soldeCentimes < 0) anomalies.push(anomalieDuSoldeNegatif(l, l.mandatId, jour))
  }
  return anomalies
}

function anomaliesDesSoldesNets(date: string, mandats: readonly FondsDuMandat[]): AnomalieFondsDetenus[] {
  return mandats
    .filter((m) => m.soldeNetCentimes < 0)
    .map((m) => ({
      code: 'mandat_solde_negatif',
      gravite: 'bloquant',
      mandatIds: [m.mandatId],
      banqueId: null,
      message: m.complet
        ? `Mandat ${m.mandatId} : solde net de ${euros(m.soldeNetCentimes)} au ${dateIsoVersFr(date)} ; ses fonds ne couvrent pas ses sorties.`
        : `Mandat ${m.mandatId} : solde net de ${euros(m.soldeNetCentimes)} au ${dateIsoVersFr(date)} sur ses seuls comptes ventilés (le solde de ses comptes non ventilés n'est pas connu) ; ses fonds ventilés ne couvrent pas ses sorties.`,
      fondement: FONDEMENT_COUVERTURE,
    }))
}

// ─── Agrégats ───────────────────────────────────────────────────────────────────────────────

function fondsDesMandats(mandats: readonly MandatResolu[], lignes: readonly LigneFondsDetenus[]): FondsDuMandat[] {
  return mandats.map((m) => {
    const siennes = lignes.filter((l) => l.mandatId === m.mandatId)
    const partage = lignes.some((l) => l.mandatId === null && l.mandatIds.includes(m.mandatId))
    return {
      mandatId: m.mandatId,
      coproprieteId: m.coproprieteId,
      categorie: m.categorie,
      mode: m.mode,
      fondsDetenusCentimes: sommePositive(siennes.filter((l) => l.inclus)),
      horsPerimetreCentimes: sommePositive(siennes.filter((l) => !l.inclus)),
      soldeNetCentimes: siennes.reduce((s, l) => s + l.soldeCentimes, 0),
      nombreComptes: siennes.length,
      complet: !m.ventilationAbsente && !m.sansCompte && !partage,
    }
  })
}

function totaliser<C extends string>(cles: readonly C[], lignes: readonly LigneFondsDetenus[], cleDe: (l: LigneFondsDetenus) => C, libelleDe: (cle: C) => string): TotalFondsDetenus<C>[] {
  return cles.flatMap((cle) => {
    const du = lignes.filter((l) => cleDe(l) === cle)
    return du.length === 0 ? [] : [{ cle, libelle: libelleDe(cle), fondsDetenusCentimes: sommePositive(du), nombreComptes: du.length }]
  })
}

function parEtablissement(lignes: readonly LigneFondsDetenus[]): TotalFondsDetenus<string>[] {
  const groupes = new Map<string, TotalFondsDetenus<string>>()
  for (const l of lignes) {
    const cle = l.etablissement === null ? 'non_renseigne' : sansAccentsMinuscules(l.etablissement)
    const groupe = groupes.get(cle) ?? { cle, libelle: l.etablissement ?? LIBELLE_ETABLISSEMENT_NON_RENSEIGNE, fondsDetenusCentimes: 0, nombreComptes: 0 }
    groupe.fondsDetenusCentimes += positif(l.soldeCentimes)
    groupe.nombreComptes += 1
    groupes.set(cle, groupe)
  }
  const rang = (g: TotalFondsDetenus<string>) => (g.cle === 'non_renseigne' ? 1 : 0)
  return [...groupes.values()].sort((a, b) => rang(a) - rang(b) || a.libelle.localeCompare(b.libelle, 'fr'))
}

const NATURES = Object.keys(NATURES_COMPTE_BANCAIRE) as NatureCompteBancaire[]

/**
 * Totaux par catégorie : celles du cabinet dans son ordre, puis les régimes hors de ses catégories, les fondements non
 * reconnus et les comptes non ventilés.
 */
function parCategorie(inclus: readonly LigneFondsDetenus[], categories: CategoriesMission): TotalFondsDetenus<CategorieMission>[] {
  const libelles = new Map<string, string>([
    ...categories.map((c): [string, string] => [c.cle, c.libelle]),
    [CATEGORIE_HORS_CABINET, LIBELLE_HORS_CABINET],
    [CATEGORIE_NON_RECONNUE, LIBELLE_NON_RECONNUE],
    [CLE_NON_VENTILE, LIBELLE_NON_VENTILE],
  ])
  return totaliser([...libelles.keys()], inclus, (l) => l.categorie ?? CLE_NON_VENTILE, (cle) => libelles.get(cle) ?? cle)
}

// ─── Calcul à une date ──────────────────────────────────────────────────────────────────────

/**
 * Fonds détenus pour autrui à une date : solde comptable de chaque compte des mandats (écritures datées au plus tard ce
 * jour), ventilé par mandat, nature, établissement, catégorie de mission et rubrique, avec le total des comptes compris
 * dans le périmètre du cabinet et les anomalies (ventilation, établissement, couverture R. 814-37).
 */
export function fondsDetenusA(date: string, donnees: DonneesFondsDetenus, options: OptionsFondsDetenus = {}): FondsDetenus {
  verifierDate(date)
  const perimetre = perimetreRetenu(options.perimetre)
  const categories = categoriesRetenues(options.categoriesMission)
  const resolution = resoudre(donnees, options.mandatIds, categories)
  const comptes = lignesA(date, resolution, perimetre)
  const mandats = fondsDesMandats(resolution.mandats, comptes)
  const inclus = comptes.filter((l) => l.inclus)
  return {
    date,
    perimetre,
    perimetreParDefaut: RUBRIQUES.every((r) => perimetre[r] === PERIMETRE_FONDS_DETENUS_PAR_DEFAUT[r]),
    avertissement: AVERTISSEMENT_FONDS_DETENUS,
    comptes,
    mandats,
    parRubrique: RUBRIQUES.map((cle) => {
      const du = comptes.filter((l) => l.rubrique === cle)
      return { cle, libelle: RUBRIQUES_FONDS_DETENUS[cle].libelle, inclus: perimetre[cle], fondsDetenusCentimes: sommePositive(du), nombreComptes: du.length }
    }),
    parNature: totaliser(NATURES, inclus, (l) => l.nature, (cle) => NATURES_COMPTE_BANCAIRE[cle].libelle),
    parEtablissement: parEtablissement(inclus),
    parCategorie: parCategorie(inclus, categories),
    totalCentimes: sommePositive(inclus),
    nonVentileCentimes: sommePositive(inclus.filter((l) => l.mandatId === null)),
    horsPerimetreCentimes: sommePositive(comptes.filter((l) => !l.inclus)),
    soldesNegatifsCentimes: comptes.reduce((s, l) => s + Math.min(l.soldeCentimes, 0), 0),
    anomalies: [...anomaliesDesMandats(resolution.mandats, comptes), ...anomaliesDesComptes(date, comptes), ...anomaliesDesSoldesNets(date, mandats)],
  }
}

/**
 * Contrôle de couverture à une date (C. com. R. 814-37, « à tout moment ») : ventilation absente, compte partagé non
 * ventilé, compte servi par un autre mandat, compte sans IBAN au solde négatif (couverture non vérifiable), compte en
 * découvert, mandat au solde net négatif. Tous les comptes du mandat comptent, quel que soit le périmètre.
 */
export function controlerCouvertureA(date: string, donnees: DonneesFondsDetenus, options: Pick<OptionsFondsDetenus, 'mandatIds'> = {}): AnomalieFondsDetenus[] {
  return fondsDetenusA(date, donnees, options).anomalies.filter((a) => CODES_COUVERTURE.has(a.code))
}

// ─── Annexe : solde bancaire et suspens de rapprochement (J67, R92) ─────────────────────────

/** Relevé d'un compte à la date des fonds : solde en banque et éléments de rapprochement du compte. */
export interface ReleveBancaireALaDate {
  banqueId: string
  /** Solde du relevé bancaire à la date, en centimes signés. */
  soldeBanqueCentimes: number
  /** Éléments de rapprochement du compte (rapprochement-bancaire.ts) : seuls leurs suspens à la date sont lus. */
  elements: readonly ElementRapprochement[]
}

export interface LigneAnnexeBancaire {
  mandatId: string | null
  banqueId: string
  compte512: string
  /** Solde comptable : la base des fonds détenus, inchangée. */
  soldeComptableCentimes: number
  /** Solde bancaire à la date ; null : relevé non fourni. */
  soldeBancaireCentimes: number | null
  /** Suspens de rapprochement à la date (suspensA) ; null sans relevé. */
  suspens: SuspensALaDate | null
  /** (banque − suspens banque) − (compta − suspens compta) : 0 quand les suspens expliquent l'écart ; null sans relevé. */
  ecartNonExpliqueCentimes: number | null
}

export interface AnnexeSoldeBancaire {
  date: string
  lignes: LigneAnnexeBancaire[]
  anomalies: AnomalieFondsDetenus[]
}

function relevesParCompte(fonds: FondsDetenus, releves: readonly ReleveBancaireALaDate[]): Map<string, ReleveBancaireALaDate> {
  const parBanque = new Map<string, ReleveBancaireALaDate>()
  for (const r of releves) {
    if (!fonds.comptes.some((l) => l.banqueId === r.banqueId))
      throw new Error(`Relevé du compte ${r.banqueId} : compte absent des fonds détenus au ${dateIsoVersFr(fonds.date)}.`)
    if (parBanque.has(r.banqueId)) throw new Error(`Relevé du compte ${r.banqueId} fourni deux fois.`)
    if (!Number.isInteger(r.soldeBanqueCentimes))
      throw new Error(`Relevé du compte ${r.banqueId} : solde invalide (${r.soldeBanqueCentimes}), centimes entiers attendus.`)
    parBanque.set(r.banqueId, r)
  }
  return parBanque
}

function ligneAnnexe(l: LigneFondsDetenus, releve: ReleveBancaireALaDate | undefined, date: string): LigneAnnexeBancaire {
  const commun = { mandatId: l.mandatId, banqueId: l.banqueId, compte512: l.compte512, soldeComptableCentimes: l.soldeCentimes }
  if (!releve) return { ...commun, soldeBancaireCentimes: null, suspens: null, ecartNonExpliqueCentimes: null }
  const suspens = suspensA([...releve.elements], date)
  const ecart = releve.soldeBanqueCentimes - suspens.totalBanqueCentimes - (l.soldeCentimes - suspens.totalComptaCentimes)
  return { ...commun, soldeBancaireCentimes: releve.soldeBanqueCentimes, suspens, ecartNonExpliqueCentimes: ecart }
}

/**
 * J67, R92 — annexe aux fonds détenus à une date : pour chaque compte, à côté du solde comptable (la base des fonds
 * détenus, inchangée), le solde bancaire à la même date et les suspens de rapprochement (rapprochement-bancaire.suspensA) ;
 * un écart que les suspens n'expliquent pas est signalé (alerte, sans blocage). Le commissaire aux comptes choisit la
 * présentation. Refuse le relevé d'un compte absent des fonds, un relevé fourni deux fois, un solde qui n'est pas un
 * nombre entier de centimes.
 */
export function annexeSoldeBancaireEtSuspens(fonds: FondsDetenus, releves: readonly ReleveBancaireALaDate[]): AnnexeSoldeBancaire {
  const parBanque = relevesParCompte(fonds, releves)
  const jour = dateIsoVersFr(fonds.date)
  const anomalies: AnomalieFondsDetenus[] = []
  const lignes = fonds.comptes.map((l) => {
    const ligne = ligneAnnexe(l, parBanque.get(l.banqueId), fonds.date)
    if (ligne.ecartNonExpliqueCentimes)
      anomalies.push({
        code: 'ecart_banque_non_explique',
        gravite: 'alerte',
        mandatIds: [...l.mandatIds],
        banqueId: l.banqueId,
        message: `Compte ${l.banqueId} au ${jour} : solde bancaire de ${euros(ligne.soldeBancaireCentimes ?? 0)}, solde comptable de ${euros(l.soldeCentimes)} ; écart de ${euros(ligne.ecartNonExpliqueCentimes)} que les suspens de rapprochement n'expliquent pas : vérifier le rapprochement bancaire.`,
        fondement: null,
      })
    return ligne
  })
  return { date: fonds.date, lignes, anomalies }
}

// ─── Dates de référence et échéances ────────────────────────────────────────────────────────

export const OBJETS_ECHEANCE_FONDS_DETENUS = {
  cotisation_caisse_garantie: { fondement: 'C. com. R. 814-21' },
  arrete_comptabilite_speciale: { fondement: 'C. com. R. 814-29 ; R. 814-30' },
  etat_trimestriel: { fondement: 'C. com. R. 814-34 ; R. 814-35' },
} as const satisfies Record<string, { fondement: string }>
export type ObjetEcheanceFondsDetenus = keyof typeof OBJETS_ECHEANCE_FONDS_DETENUS

const ORDRE_OBJETS = Object.keys(OBJETS_ECHEANCE_FONDS_DETENUS) as ObjetEcheanceFondsDetenus[]
/** Bornes des années calculées : l'arrêté du 31/12 a sa date limite l'année suivante. */
const ANNEE_MIN = ANNEE_PLANCHER
const ANNEE_MAX = 9998

export interface EcheanceFondsDetenus {
  /** Date à laquelle les fonds se calculent. */
  date: string
  objet: ObjetEcheanceFondsDetenus
  libelle: string
  fondement: string
  /**
   * Dernier jour pour l'acte qui suit : « dans les quinze jours suivant » la fin du trimestre, le quinzième ; « avant le
   * 15 mars » (ou le 15 septembre), le 14 (J63). Null : aucun texte lu n'en fixe (⚪).
   */
  dateLimite: string | null
  acteAttendu: string | null
  /** 🔵 La date limite se déduit du texte (décompte des quinze jours, rattachement de l'attestation à l'arrêté). */
  dateLimiteDeduite: boolean | null
  /** Date limite, sinon date des fonds : ce qui reste à faire jusqu'à ce jour. */
  echeance: string
  /**
   * J67, R93 — date limite un samedi, un dimanche ou un jour férié : elle n'est pas reportée (J63) ; dernier jour ouvré qui
   * la précède, date d'envoi la plus prudente. Null : date limite un jour ouvré, ou aucune date limite.
   */
  dernierJourOuvre: string | null
  /** Alerte qui accompagne dernierJourOuvre ; null sinon. */
  alerteJourNonOuvre: string | null
}

const acteAttestation = (avantLe: string): string =>
  `Attestation du commissaire aux comptes, avant le ${dateIsoVersFr(avantLe)} : fonds détenus par catégorie de mission et par établissement de crédit`
const ACTE_ETATS = 'Envoi des états trimestriels de chaque mandat non clos au greffe et au procureur de la République'

/** J67, R93 — dernier jour ouvré avant une date limite non ouvrée, et son alerte ; rien pour un jour ouvré. */
function jourNonOuvre(dateLimite: string | null, options: OptionsJoursFeries): Pick<EcheanceFondsDetenus, 'dernierJourOuvre' | 'alerteJourNonOuvre'> {
  const ouvre = dateLimite === null ? null : avancerAuJourOuvrable(dateLimite, options)
  if (dateLimite === null || ouvre === dateLimite || ouvre === null) return { dernierJourOuvre: null, alerteJourNonOuvre: null }
  return {
    dernierJourOuvre: ouvre,
    alerteJourNonOuvre: `Date limite du ${dateIsoVersFr(dateLimite)}, jour non ouvré, sans report (J63) : envoyer au plus tard le dernier jour ouvré précédent, le ${dateIsoVersFr(ouvre)} (J67, R93).`,
  }
}

function echeance(
  date: string,
  objet: ObjetEcheanceFondsDetenus,
  libelle: string,
  limite: { date: string; acte: string } | null,
  options: OptionsJoursFeries,
): EcheanceFondsDetenus {
  return {
    date,
    objet,
    libelle,
    fondement: OBJETS_ECHEANCE_FONDS_DETENUS[objet].fondement,
    dateLimite: limite?.date ?? null,
    acteAttendu: limite?.acte ?? null,
    dateLimiteDeduite: limite === null ? null : true,
    echeance: limite?.date ?? date,
    ...jourNonOuvre(limite?.date ?? null, options),
  }
}

const comparerEcheances = (a: EcheanceFondsDetenus, b: EcheanceFondsDetenus): number =>
  a.date.localeCompare(b.date) || ORDRE_OBJETS.indexOf(a.objet) - ORDRE_OBJETS.indexOf(b.objet)

/**
 * Dates de référence d'une année : fins de trimestre, 30/06 et 31/12 (commissaire aux comptes), 31/12 (caisse de
 * garantie). `options` : jours fériés du cabinet (Alsace-Moselle), pour l'alerte d'une date limite non ouvrée (J67, R93).
 */
export function echeancesFondsDetenusDeLAnnee(annee: number, options: OptionsJoursFeries = {}): EcheanceFondsDetenus[] {
  if (!Number.isInteger(annee) || annee < ANNEE_MIN || annee > ANNEE_MAX)
    throw new Error(`Année invalide (${annee}) : entier de ${ANNEE_MIN} à ${ANNEE_MAX} attendu.`)
  const liste: EcheanceFondsDetenus[] = []
  for (const [mois, jour] of [
    [3, 31],
    [6, 30],
    [9, 30],
    [12, 31],
  ] as const) {
    const fin = composerDateIso(annee, mois, jour)
    const fr = dateIsoVersFr(fin)
    liste.push(
      echeance(fin, 'etat_trimestriel', `États du trimestre clos le ${fr}, pour chaque mandat non clos`, { date: ajouterJours(fin, 15), acte: ACTE_ETATS }, options),
    )
    if (mois === 6 || mois === 12) {
      // R. 814-30 : « avant le 15 mars et le 15 septembre » : le 14 au plus tard (décision du 17/11/2026, J63).
      const avantLe = mois === 6 ? composerDateIso(annee, 9, 15) : composerDateIso(annee + 1, 3, 15)
      liste.push(
        echeance(
          fin,
          'arrete_comptabilite_speciale',
          `Arrêté de la comptabilité spéciale au ${fr}`,
          { date: ajouterJours(avantLe, -1), acte: acteAttestation(avantLe) },
          options,
        ),
      )
    }
    if (mois === 12)
      liste.push(echeance(fin, 'cotisation_caisse_garantie', `Fonds non distribués au ${fr} : base de la cotisation ${annee + 1} à la caisse de garantie`, null, options))
  }
  return liste.sort(comparerEcheances)
}

/**
 * Prochaines échéances à partir d'une date : celles dont l'échéance (date limite, sinon date des fonds) tombe ce jour ou
 * après, pour des dates de fonds jusqu'à `jusquAu` (par défaut douze mois plus tard), triées par échéance. Jours fériés
 * du cabinet (Alsace-Moselle) : pour l'alerte d'une date limite non ouvrée (J67, R93).
 */
export function prochainesEcheancesFondsDetenus(
  depuis: string,
  { jusquAu, ...joursFeries }: { jusquAu?: string } & OptionsJoursFeries = {},
): EcheanceFondsDetenus[] {
  verifierDate(depuis, 'Date de départ')
  const fin = jusquAu ?? ajouterMois(depuis, 12)
  verifierDate(fin, 'Fin de l’horizon')
  if (fin < depuis) throw new Error(`Horizon invalide : du ${depuis} au ${fin}.`)
  const liste: EcheanceFondsDetenus[] = []
  const derniere = Math.min(decomposerDateIso(fin).a, ANNEE_MAX)
  for (let annee = Math.max(decomposerDateIso(depuis).a - 1, ANNEE_MIN); annee <= derniere; annee += 1)
    liste.push(...echeancesFondsDetenusDeLAnnee(annee, joursFeries).filter((e) => e.echeance >= depuis && e.date <= fin))
  return liste.sort((a, b) => a.echeance.localeCompare(b.echeance) || comparerEcheances(a, b))
}

// ─── Indicateur interne (sans valeur réglementaire) ─────────────────────────────────────────

export interface MaximumInterneFondsDetenus {
  nature: 'indicateur_interne'
  libelle: string
  du: string
  au: string
  /** Plus haut total des fonds détenus (soldes positifs des comptes inclus) en fin de journée sur la période. */
  maximumCentimes: number
  /** Premier jour où il est atteint. */
  atteintLe: string
  perimetre: PerimetreFondsDetenus
}

const LIBELLE_MAXIMUM_INTERNE = 'Maximum des fonds détenus sur la période : indicateur interne, sans valeur réglementaire'

/**
 * Maximum, sur une période, du total des fonds détenus en fin de journée : INDICATEUR INTERNE seulement (note, § 4.2,
 * option ; 🔴 à garder ou non). Aucun texte lu ne le demande à un administrateur judiciaire inscrit.
 */
export function maximumInterneFondsDetenus(du: string, au: string, donnees: DonneesFondsDetenus, options: OptionsFondsDetenus = {}): MaximumInterneFondsDetenus {
  verifierDate(du, 'Début de période')
  verifierDate(au, 'Fin de période')
  if (du > au) throw new Error(`Période invalide : du ${du} au ${au}.`)
  const perimetre = perimetreRetenu(options.perimetre)
  const resolution = resoudre(donnees, options.mandatIds, categoriesRetenues(options.categoriesMission))
  const livres = new Map<string, Map<string, CompteGrandLivre>>()
  for (const coproprieteId of new Set(resolution.comptes.map((c) => c.coproprieteId)))
    livres.set(coproprieteId, new Map(grandLivre(resolution.traitements.get(coproprieteId) ?? [], { du, au }).map((g) => [g.compte, g])))
  const evolutions = resolution.comptes
    .filter((c) => perimetre[c.rubrique])
    .map((c) => {
      const livre = livres.get(c.coproprieteId)?.get(c.compte512)
      return { report: livre?.reportCentimes ?? 0, mouvements: livre?.mouvements ?? [] }
    })
  const jours = [...new Set([du, ...evolutions.flatMap((e) => e.mouvements.map((m) => m.date))])].sort((a, b) => a.localeCompare(b))
  const curseurs = evolutions.map(() => -1)
  let maximum: { centimes: number; le: string } | null = null
  for (const jour of jours) {
    let total = 0
    evolutions.forEach((e, i) => {
      while (curseurs[i] + 1 < e.mouvements.length && e.mouvements[curseurs[i] + 1].date <= jour) curseurs[i] += 1
      total += positif(curseurs[i] < 0 ? e.report : e.mouvements[curseurs[i]].soldeCentimes)
    })
    if (maximum === null || total > maximum.centimes) maximum = { centimes: total, le: jour }
  }
  return {
    nature: 'indicateur_interne',
    libelle: LIBELLE_MAXIMUM_INTERNE,
    du,
    au,
    maximumCentimes: maximum?.centimes ?? 0,
    atteintLe: maximum?.le ?? du,
    perimetre,
  }
}
