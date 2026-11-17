import { ajouterJours, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { estRefusee, type Demande, type TypeDemande } from '@/lib/administrateur-judiciaire/domain/demandes'
import { premierEnvoi, type NatureDiffusion, type SortieOrdreService } from '@/lib/administrateur-judiciaire/domain/envoi-ordre-service'
import type { FicheEntreprise, RelanceEntreprise, RelancesService } from '@/lib/administrateur-judiciaire/domain/fiche-entreprise'
import {
  SERVICE_CABINET,
  type ServiceCabinet,
  type StadeIntervention,
  type StatutDemande,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Relance des demandes par entreprise (point 46 du bilan 2, partie domaine) : réglage de relance par service et par
 * type (devis, interventions), relances dues, demandes en cours au-delà du seuil d'alerte ou du maximum. Fonctions pures,
 * dates ISO, sans écran ni table : le réglage est porté par la fiche de l'entreprise (FicheEntreprise.relances et
 * relancesParService, champ facultatif non indexé de Prestataire.fiche) ; le suivi « à faire » lit ce module par
 * depuisDemandes (suivi-a-faire.ts, famille « demandes »). Aucune donnée personnelle : entreprises, demandes et
 * collaborateurs sont des identifiants.
 *
 * Gestéam — 🟢 lu :
 * - tranche 39 § Entreprise, onglet Demandes : filtre Demande (En cours …), Date du / au, liste Date · Immeuble · Objet ;
 *   réglages de relance de l'entreprise PAR SERVICE, en deux colonnes Devis et Interventions : « Délai de relance des
 *   demandes », « Nombre maximum de demandes en cours », « Alerte si nombre de demandes en cours > » (seuil) ; ils
 *   alimentent le bloc « Dem. interv. / Demandes devis — À relancer » du Suivi ; valeurs non relevées ;
 * - tranche 43 § 5 : mêmes réglages par service (Devis / Interventions) ; pas d'infobulle, unité du délai non affichée ;
 * - tranche 38 § Réglage du Suivi : blocs « Dem. interv. » et « Demandes devis », critères « À relancer » et « En cours »,
 *   chacun avec un horizon ;
 * - tranche 20 (référentiel Service) et SERVICE_CABINET (referentiels-gesteam-judiciaire.ts) : Copropriété · Gérance ·
 *   Direction · Transaction ; seul « Copropriété » est dans le périmètre VitFix.
 *
 * Le droit — relevé du 03/11/2026 (Légifrance, textes consolidés en vigueur au 03/11/2026, recherche dans leur texte
 * complet, tableaux des annexes 1 et 2 du décret compris) : AUCUN TEXTE de la loi n° 65-557 du 10 juillet 1965 ni du
 * décret n° 67-223 du 17 mars 1967 ne fixe un délai de relance d'une entreprise, un nombre maximum de demandes en cours
 * ni un seuil d'alerte : les trois réglages sont des RÈGLES DE GESTION du cabinet, jamais des délais légaux (aConfirmer
 * reste faux : ce ne sont pas des repères juridiques). Les relances des deux textes visent le recouvrement d'une
 * créance : contre un copropriétaire (L. 1965 art. 10-1 a ; D. 1967 art. 38 ; D. 1967 annexe 1, point 9.1 « Relance
 * après mise en demeure ») ou contre un tiers (D. 1967 annexe 1, annexe au contrat de syndic, III-10° b : « relance par
 * lettre simple avant mise en demeure ») ; aucune ne vise une demande de devis ou d'intervention. Fondement général, pas
 * une règle de relance : le syndic, donc l'administrateur provisoire qui reçoit tous ses pouvoirs (L. 1965 art. 29-1, I),
 * administre l'immeuble et pourvoit à sa conservation, à sa garde et à son entretien (L. 1965 art. 18, I) ; le contrat
 * type range dans le forfait la gestion des travaux d'entretien courant et de maintenance (D. 1967 art. 45) et la
 * « négociation, passation, suivi des marchés des prestataires » (D. 1967 annexe 1, annexe au contrat de syndic, IV-15° b
 * et d), sans délai ni plafond. La mise en concurrence des marchés de travaux et contrats autres que le contrat de syndic prévue par
 * L. 1965 art. 21, al. 2, lorsque l'assemblée n'en a pas fixé les conditions, résulte de la demande de plusieurs devis ou
 * de l'établissement d'un devis descriptif soumis à l'évaluation de plusieurs entreprises (D. 1967 art. 19-2) : le texte
 * ne règle ni la relance ni le nombre de demandes en cours.
 *
 * 🔵 Déduit (règles de ce module) :
 * - délai de relance en jours calendaires ; le réglage d'un service sur la fiche (relancesParService) prévaut ; à défaut,
 *   le réglage `relances` de la fiche vaut pour le service Copropriété ; un autre service sans réglage, ou une entreprise
 *   sans fiche : ni relance ni alerte (aucune valeur n'est supposée) ;
 * - service d'une demande : donné par l'appelant, à défaut Copropriété (la Demande ne le porte pas) ;
 * - une demande vue plusieurs fois (même identifiant) ne compte qu'une fois, quel que soit l'ordre (demandesUniques,
 *   appliqué avant tout calcul) : la sortie et le service donnés par l'une de ses occurrences valent pour elle ; deux
 *   versions différentes de la demande, deux sorties différentes ou deux services différents : erreur (entrée
 *   contradictoire, aucune occurrence n'est choisie) ;
 * - demande EN COURS : demandée au plus tard à la date du jour, ni « Terminé » ni refusée (statut « Refusé » ou stade
 *   « Refusée ») ; elle compte pour son entreprise, son service et son type ;
 * - EN ATTENTE de l'entreprise : statut « Accusé demandé » ou « Rapport demandé » ; sinon, devis : aucun devis associé et
 *   statut autre que « Accepté » ; intervention : ni date de réalisation, ni stade Réalisée, Contestée ou Validée, ni facture
 *   rattachée (une facture vaut réponse de l'entreprise, comme pour realiseeOuFacturee de demandes.ts : l'entreprise qui a
 *   facturé n'est pas relancée, sauf accusé ou rapport demandé) — sans réalisation ni facture, les stades « Proposition en
 *   cours » et « Proposition résident » comptent donc comme en attente de l'entreprise (🔴) ;
 * - relance due au point de départ + délai : le point de départ est le plus tardif de la date de la demande, de
 *   l'intervention prévue (intervention seulement), de sa réalisation (accusé ou rapport demandé après elle) et de la
 *   dernière ligne du journal de diffusion adressée à l'entreprise (envoi, relance, réception : envoi-ordre-service.ts) ;
 *   une relance faite (relancerOs) repousse donc la suivante ; émise même future : selectionnerAFaire y applique l'horizon
 *   et la règle du week-end ;
 * - sortie d'OS fournie mais jamais envoyée : rien n'est parti, rien à relancer ; date de relance saisie sur la sortie
 *   (fixerRelance) : elle prévaut (relancesOsDues, nature « relance_os »), sans relance automatique en plus ;
 * - relance assignée au collaborateur du premier envoi (comme relancesOsDues), sinon à personne (le portefeuille du
 *   mandat la suit) ;
 * - seuil d'alerte franchi strictement (« > ») ; maximum atteint à égalité, dépassé au-delà ; « depuis le » : date de la
 *   demande en cours qui a fait franchir le niveau, parmi les demandes ENCORE en cours (celles closes entre-temps ne sont
 *   pas reconstituées) ; l'alerte est un élément du cabinet (aucun mandat), visible au périmètre « cabinet » ;
 * - avant d'attribuer une demande à une entreprise (controlerPlafondAvantAttribution) : alerte, jamais bloquante, quand
 *   elle porterait ses demandes en cours au-delà du seuil d'alerte ou du maximum.
 *
 * 🔴 Non établi — questions :
 * - Frédéric : valeurs par défaut de nouvelleFicheEntreprise (devis : 8 jours, 5, 4 ; interventions : 3 jours, 10, 8),
 *   non relevées dans Gestéam (tranche 39) : les garder comme réglages du cabinet ? Elles déclenchent ici les relances de
 *   toute entreprise qui a une fiche.
 * - Frédéric : le maximum de demandes en cours doit-il BLOQUER l'attribution d'une nouvelle demande (alerte ici) ?
 * - Hugo : le « Service » de l'onglet Demandes est-il le service du cabinet (Copropriété, Gérance… : retenu ici) ou celui
 *   de l'entreprise (contacts « service, agence », tranche 37) ? Le service d'une demande se lit-il sur sa Nature
 *   (« … Copro », « … Gérance ») ?
 * - Hugo : délai en jours calendaires (ici) ou ouvrés ? Point de départ : demande, envoi, dernière relance, réception,
 *   intervention prévue, réalisation (tous retenus ici, le plus tardif) ?
 * - Hugo : demandes « en cours » du plafond : statut « En cours » seulement, ou toutes celles ni terminées ni refusées
 *   (ici) ? Une intervention réalisée en attente de sa facture, ou facturée mais non terminée, compte-t-elle (oui ici) ?
 * - Hugo : critère « En cours » des blocs « Dem. interv. » et « Demandes devis » du Suivi : quelles demandes, à quelle
 *   date (prévu le ?) — non codé.
 * - Hugo : la relance vise-t-elle aussi l'accusé et le rapport demandés (oui ici : statuts « Accusé demandé » et
 *   « Rapport demandé ») ? (question déjà posée au point 44)
 * - Hugo : pendant les stades « Proposition en cours » et « Proposition résident », la relance de l'entreprise court-elle
 *   (oui ici), ou la réponse attendue est-elle celle du résident ou du cabinet ? (le référentiel STADE_INTERVENTION note
 *   que « Proposition résident » intègre le résident au circuit ; demandes.ts demande déjà à quelle étape ces stades
 *   appartiennent)
 *
 * Branchements à faire plus tard (fichiers non modifiés) : écran de la fiche entreprise (réglage par service) et du Suivi ;
 * controlerPlafondAvantAttribution au choix de l'entreprise d'une demande (écran Ordres de service), voire en alerte dans
 * controlerAvantEnvoiOs (envoi-ordre-service.ts) ; table de SortieOrdreService (Frédéric).
 */

// ─── Réglage de l'entreprise ──────────────────────────────────────────────────────────────────

/** Service retenu quand l'appelant n'en donne pas : le seul du périmètre VitFix (🔵). */
export const SERVICE_DEMANDE_PAR_DEFAUT: ServiceCabinet = 'Copropriété'

/** Fiche de l'entreprise, ou ses seuls réglages de relance (Prestataire.fiche, db/schema.ts). */
export type ReglagesFicheEntreprise = Pick<FicheEntreprise, 'relances' | 'relancesParService'>

/** Entreprise et sa fiche (un Prestataire convient) ; sans fiche : aucun réglage. */
export interface EntrepriseRelance {
  /** Identifiant de l'entreprise (prestataireId des demandes). */
  id: string
  fiche?: ReglagesFicheEntreprise | null
}

/** Colonne Gestéam de chaque type de demande. */
const COLONNE: Readonly<Record<TypeDemande, keyof RelancesService>> = { devis: 'devis', intervention: 'interventions' }

const LIBELLE_COLONNE: Readonly<Record<TypeDemande, string>> = { devis: 'Devis', intervention: 'Interventions' }

/** Nom d'une demande de chaque type, au singulier et au pluriel, pour les libellés. */
export const LIBELLES_TYPE_DEMANDE: Readonly<Record<TypeDemande, { un: string; plusieurs: string }>> = {
  devis: { un: 'demande de devis', plusieurs: 'demandes de devis' },
  intervention: { un: "demande d'intervention", plusieurs: "demandes d'intervention" },
}

const SERVICES: ReadonlySet<string> = new Set<string>(SERVICE_CABINET)

const CHAMPS_REGLAGE = ['delaiRelanceJours', 'maxDemandesEnCours', 'alerteAuDela'] as const satisfies readonly (keyof RelanceEntreprise)[]

const verifierDate = (date: string, quoi: string): void => {
  if (!estDateIsoValide(date)) throw new Error(`${quoi} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

function verifierReglage(reglage: RelanceEntreprise, contexte: string): RelanceEntreprise {
  for (const champ of CHAMPS_REGLAGE) {
    const valeur = reglage[champ]
    if (!Number.isInteger(valeur) || valeur < 0)
      throw new Error(`Réglage de relance invalide (${contexte}, ${champ} = ${valeur}) : nombre entier positif ou nul attendu.`)
  }
  return reglage
}

/**
 * Réglage de relance de l'entreprise pour un service et un type de demande : celui du service (relancesParService), à
 * défaut, pour le service Copropriété, le réglage `relances` de la fiche ; null : aucun réglage (ni relance ni alerte).
 */
export function reglageRelance(
  fiche: ReglagesFicheEntreprise | null | undefined,
  service: ServiceCabinet,
  type: TypeDemande,
): RelanceEntreprise | null {
  if (!SERVICES.has(service)) throw new Error(`Service inconnu : « ${service} » (${SERVICE_CABINET.join(', ')}).`)
  if (!Object.hasOwn(COLONNE, type)) throw new Error(`Type de demande inconnu : « ${type} » (devis ou intervention).`)
  if (!fiche) return null
  const duService = fiche.relancesParService?.[service] ?? (service === SERVICE_DEMANDE_PAR_DEFAUT ? fiche.relances : undefined)
  const colonne = duService?.[COLONNE[type]]
  return colonne ? verifierReglage(colonne, `${service}, ${LIBELLE_COLONNE[type]}`) : null
}

const fichesParEntreprise = (entreprises: readonly EntrepriseRelance[]): Map<string, ReglagesFicheEntreprise | null> =>
  new Map(entreprises.map((e) => [e.id, e.fiche ?? null]))

// ─── Demandes en cours, en attente de l'entreprise ────────────────────────────────────────────

/** Demande suivie : la demande, la sortie de son OS si elle en a une, son service (à défaut Copropriété). */
export interface DemandeSuivie {
  demande: Demande
  sortie?: SortieOrdreService | null
  service?: ServiceCabinet
}

const serviceDe = (item: DemandeSuivie): ServiceCabinet => item.service ?? SERVICE_DEMANDE_PAR_DEFAUT

/** Contenu d'une donnée, clés triées : deux copies d'une même version donnent la même chaîne. */
const contenu = (valeur: unknown): string =>
  JSON.stringify(valeur, (_cle, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  )

/** La valeur donnée par l'une ou l'autre occurrence (null : aucune) ; deux valeurs différentes : erreur. */
function valeurCommune<T>(a: T | null | undefined, b: T | null | undefined, erreur: string): T | null {
  const premiere = a ?? null
  const seconde = b ?? null
  if (premiere !== null && seconde !== null && premiere !== seconde && contenu(premiere) !== contenu(seconde)) throw new Error(erreur)
  return premiere ?? seconde
}

function fusionner(deja: DemandeSuivie, autre: DemandeSuivie): DemandeSuivie {
  const id = deja.demande.id
  valeurCommune(deja.demande, autre.demande, `Demande ${id} reçue en deux versions différentes : une seule attendue.`)
  const sortie = valeurCommune(deja.sortie, autre.sortie, `Demande ${id} reçue avec deux sorties d'OS différentes : une seule attendue.`)
  const service = valeurCommune(deja.service, autre.service, `Demande ${id} reçue pour deux services (${deja.service}, ${autre.service}) : un seul attendu.`)
  return { demande: deja.demande, sortie, service: service ?? undefined }
}

/**
 * Une occurrence par demande (identifiant), dans l'ordre de première apparition, quel que soit l'ordre des copies (🔵) :
 * la sortie et le service donnés par l'une d'elles valent pour la demande ; deux versions différentes de la demande, deux
 * sorties ou deux services différents : erreur (entrée contradictoire). Appliqué avant tout calcul du module.
 */
export function demandesUniques(items: readonly DemandeSuivie[]): DemandeSuivie[] {
  const uniques = new Map<string, DemandeSuivie>()
  for (const item of items) {
    const deja = uniques.get(item.demande.id)
    uniques.set(item.demande.id, deja ? fusionner(deja, item) : item)
  }
  return [...uniques.values()]
}

/** Demande en cours à la date (🔵) : demandée au plus tard ce jour-là, ni terminée ni refusée. */
export function estDemandeEnCours(d: Demande, aujourdhui: string): boolean {
  verifierDate(aujourdhui, 'Date de référence')
  verifierDate(d.demandeLe, `Date de la demande ${d.id}`)
  return d.demandeLe <= aujourdhui && d.statut !== 'Terminé' && !estRefusee(d)
}

/** Statuts qui attendent quelque chose de l'entreprise (accusé, rapport). */
const STATUTS_ATTENTE_ENTREPRISE: ReadonlySet<StatutDemande> = new Set<StatutDemande>(['Accusé demandé', 'Rapport demandé'])

/** Stades d'une intervention faite : l'entreprise a répondu par son exécution. */
const STADES_INTERVENTION_FAITE: ReadonlySet<StadeIntervention> = new Set<StadeIntervention>(['Réalisée', 'Contestée', 'Validée'])

/**
 * La demande attend l'entreprise (🔵) : accusé ou rapport demandé ; sinon, devis : aucun devis associé, demande non
 * acceptée ; intervention : ni réalisée ni facturée (une facture rattachée vaut réponse de l'entreprise).
 */
export function attendEntreprise(d: Demande): boolean {
  if (STATUTS_ATTENTE_ENTREPRISE.has(d.statut)) return true
  if (d.type === 'devis') return d.devisAssocie === null && d.statut !== 'Accepté'
  if (d.factureIds.length > 0) return false
  return d.realiseeLe === null && (d.stade === null || !STADES_INTERVENTION_FAITE.has(d.stade))
}

// ─── Relances dues ────────────────────────────────────────────────────────────────────────────

export const DEPARTS_RELANCE = ['demandee', 'intervention_prevue', 'realisation', 'envoi', 'relance', 'reception'] as const
export type DepartRelance = (typeof DEPARTS_RELANCE)[number]

const LIBELLE_DEPART: Readonly<Record<DepartRelance, string>> = {
  demandee: 'demandée le',
  intervention_prevue: 'intervention prévue le',
  realisation: 'réalisée le',
  envoi: 'envoyée le',
  relance: 'relancée le',
  reception: "reçue par l'entreprise le",
}

/** Lignes du journal de diffusion qui font repartir le délai (adressées à l'entreprise de la demande). */
const DEPART_PAR_NATURE: ReadonlyMap<NatureDiffusion, DepartRelance> = new Map<NatureDiffusion, DepartRelance>([
  ['envoi', 'envoi'],
  ['relance', 'relance'],
  ['reception', 'reception'],
])

export interface DepartDelai {
  date: string
  depuis: DepartRelance
}

/**
 * Le plus tardif de la demande, de l'intervention prévue, de sa réalisation (accusé ou rapport demandé ensuite) et de la
 * dernière ligne du journal adressée à l'entreprise.
 */
function departRelance(d: Demande, sortie: SortieOrdreService | null): DepartDelai {
  const departs: DepartDelai[] = [{ date: d.demandeLe, depuis: 'demandee' }]
  if (d.type === 'intervention' && d.prevuLe !== null) departs.push({ date: d.prevuLe, depuis: 'intervention_prevue' })
  if (d.realiseeLe !== null) departs.push({ date: d.realiseeLe, depuis: 'realisation' })
  for (const ligne of sortie?.journal ?? []) {
    const depuis = DEPART_PAR_NATURE.get(ligne.nature)
    if (depuis && ligne.destinataire.type === 'Entreprise' && ligne.destinataire.id === d.prestataireId) departs.push({ date: ligne.date, depuis })
  }
  return departs.reduce((plusTardif, depart) => (depart.date >= plusTardif.date ? depart : plusTardif), departs[0])
}

export interface RelanceDemandeDue {
  demandeId: string
  prestataireId: string
  type: TypeDemande
  service: ServiceCabinet
  mandatId: string | null
  /** N° d'ordre de service, à défaut l'identifiant de la demande. */
  reference: string
  objet: string
  /** Date à laquelle relancer : départ + délai. */
  date: string
  depart: DepartDelai
  delaiJours: number
  /** Collaborateur du premier envoi ; null sans envoi. */
  assigneId: string | null
}

function verifierSortie(d: Demande, sortie: SortieOrdreService | null): void {
  if (sortie !== null && sortie.demandeId !== d.id) throw new Error(`Sortie de l'OS ${sortie.demandeId} reçue pour une autre demande (${d.id}).`)
}

/** Sortie absente, ou envoyée sans date de relance saisie (celle-ci prévaut : relancesOsDues). */
const sortieRelancable = (sortie: SortieOrdreService | null): boolean =>
  sortie === null || (sortie.relanceLe === null && premierEnvoi(sortie) !== null)

function relanceDue(item: DemandeSuivie, fiches: Map<string, ReglagesFicheEntreprise | null>, aujourdhui: string): RelanceDemandeDue | null {
  const d = item.demande
  const sortie = item.sortie ?? null
  verifierSortie(d, sortie)
  const { prestataireId } = d
  if (prestataireId === null || !estDemandeEnCours(d, aujourdhui) || !attendEntreprise(d) || !sortieRelancable(sortie)) return null
  const service = serviceDe(item)
  const reglage = reglageRelance(fiches.get(prestataireId), service, d.type)
  if (reglage === null) return null
  const depart = departRelance(d, sortie)
  const date = ajouterJours(depart.date, reglage.delaiRelanceJours)
  if (!estDateIsoValide(date)) throw new Error(`Relance de la demande ${d.id} hors calendrier : ${depart.date} + ${reglage.delaiRelanceJours} jours.`)
  return {
    demandeId: d.id,
    prestataireId,
    type: d.type,
    service,
    mandatId: d.mandatId,
    reference: d.numero ?? d.id,
    objet: d.objet,
    date,
    depart,
    delaiJours: reglage.delaiRelanceJours,
    assigneId: sortie === null ? null : (premierEnvoi(sortie)?.collaborateurId ?? null),
  }
}

/**
 * Relances dues des demandes en cours qui attendent l'entreprise, selon le délai de relance de sa fiche (service et
 * type), triées par date ; une demande vue plusieurs fois ne compte qu'une fois, quel que soit l'ordre (demandesUniques).
 */
export function relancesDemandesDues(
  items: readonly DemandeSuivie[],
  entreprises: readonly EntrepriseRelance[],
  aujourdhui: string,
): RelanceDemandeDue[] {
  verifierDate(aujourdhui, 'Date de référence')
  const fiches = fichesParEntreprise(entreprises)
  return demandesUniques(items)
    .flatMap((item) => {
      const relance = relanceDue(item, fiches, aujourdhui)
      return relance ? [relance] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.demandeId.localeCompare(b.demandeId))
}

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Libellé du suivi « à faire » : quoi relancer, depuis quand, selon quel délai. */
export function libelleRelanceDemande(r: RelanceDemandeDue): string {
  return `Relancer l'entreprise : ${LIBELLES_TYPE_DEMANDE[r.type].un} ${r.reference} (${r.objet}), ${LIBELLE_DEPART[r.depart.depuis]} ${dateIsoVersFr(r.depart.date)} ; délai de relance de ${pluriel(r.delaiJours, 'jour')} (${r.service})`
}

// ─── Demandes en cours face au seuil d'alerte et au maximum ───────────────────────────────────

export const NIVEAUX_CHARGE = ['normal', 'alerte', 'maximum_atteint', 'maximum_depasse'] as const
export type NiveauCharge = (typeof NIVEAUX_CHARGE)[number]

export interface ChargeEntreprise {
  prestataireId: string
  service: ServiceCabinet
  type: TypeDemande
  enCours: number
  /** Demandes en cours, de la plus ancienne à la plus récente. */
  demandeIds: string[]
  alerteAuDela: number
  maxDemandesEnCours: number
  niveau: NiveauCharge
  /** Date de la demande qui a fait franchir le niveau, parmi celles encore en cours ; null au niveau normal. */
  depuisLe: string | null
}

/** Niveau atteint et rang (1 : la plus ancienne) de la demande qui l'a fait franchir ; 0 au niveau normal. */
function niveauCharge(enCours: number, reglage: RelanceEntreprise): { niveau: NiveauCharge; rang: number } {
  const { maxDemandesEnCours: maximum, alerteAuDela: seuil } = reglage
  if (enCours > maximum) return { niveau: 'maximum_depasse', rang: maximum + 1 }
  if (enCours === maximum && maximum > 0) return { niveau: 'maximum_atteint', rang: maximum }
  if (enCours > seuil) return { niveau: 'alerte', rang: seuil + 1 }
  return { niveau: 'normal', rang: 0 }
}

interface GroupeCharge {
  prestataireId: string
  service: ServiceCabinet
  type: TypeDemande
  demandes: Demande[]
}

/**
 * Demandes en cours à la date, groupées par entreprise, service et type ; une demande vue plusieurs fois compte une fois,
 * dans un seul groupe (demandesUniques).
 */
function grouperEnCours(items: readonly DemandeSuivie[], aujourdhui: string): GroupeCharge[] {
  const groupes = new Map<string, GroupeCharge>()
  for (const item of demandesUniques(items)) {
    const d = item.demande
    if (d.prestataireId === null || !estDemandeEnCours(d, aujourdhui)) continue
    const service = serviceDe(item)
    const cle = JSON.stringify([d.prestataireId, service, d.type])
    const groupe = groupes.get(cle) ?? { prestataireId: d.prestataireId, service, type: d.type, demandes: [] }
    groupes.set(cle, groupe)
    groupe.demandes.push(d)
  }
  return [...groupes.values()]
}

function charge(groupe: GroupeCharge, reglage: RelanceEntreprise): ChargeEntreprise {
  const triees = [...groupe.demandes].sort((a, b) => a.demandeLe.localeCompare(b.demandeLe) || a.id.localeCompare(b.id))
  const { niveau, rang } = niveauCharge(triees.length, reglage)
  return {
    prestataireId: groupe.prestataireId,
    service: groupe.service,
    type: groupe.type,
    enCours: triees.length,
    demandeIds: triees.map((d) => d.id),
    alerteAuDela: reglage.alerteAuDela,
    maxDemandesEnCours: reglage.maxDemandesEnCours,
    niveau,
    depuisLe: rang > 0 ? triees[rang - 1].demandeLe : null,
  }
}

/**
 * Demandes en cours de chaque entreprise (par service et type) qui a un réglage, face à son seuil d'alerte et à son
 * maximum ; triées par entreprise, service, type.
 */
export function chargesEntreprises(
  items: readonly DemandeSuivie[],
  entreprises: readonly EntrepriseRelance[],
  aujourdhui: string,
): ChargeEntreprise[] {
  verifierDate(aujourdhui, 'Date de référence')
  const fiches = fichesParEntreprise(entreprises)
  return grouperEnCours(items, aujourdhui)
    .flatMap((groupe) => {
      const reglage = reglageRelance(fiches.get(groupe.prestataireId), groupe.service, groupe.type)
      return reglage ? [charge(groupe, reglage)] : []
    })
    .sort((a, b) => a.prestataireId.localeCompare(b.prestataireId) || a.service.localeCompare(b.service) || a.type.localeCompare(b.type))
}

/** Charges au-delà du seuil d'alerte, ou au maximum (atteint ou dépassé). */
export const alertesChargeEntreprises = (
  items: readonly DemandeSuivie[],
  entreprises: readonly EntrepriseRelance[],
  aujourdhui: string,
): ChargeEntreprise[] => chargesEntreprises(items, entreprises, aujourdhui).filter((c) => c.niveau !== 'normal')

const CONSTAT_PAR_NIVEAU: Readonly<Record<Exclude<NiveauCharge, 'normal'>, (c: ChargeEntreprise) => string>> = {
  alerte: (c) => `au-delà du seuil d'alerte de ${c.alerteAuDela}`,
  maximum_atteint: (c) => `maximum de ${c.maxDemandesEnCours} atteint`,
  maximum_depasse: (c) => `au-delà du maximum de ${c.maxDemandesEnCours}`,
}

/** « 1 demande de devis », « 2 demandes de devis » : accordé au nombre. */
const nombreDeDemandes = (n: number, type: TypeDemande): string => {
  const { un, plusieurs } = LIBELLES_TYPE_DEMANDE[type]
  return `${n} ${n > 1 ? plusieurs : un}`
}

/** Libellé du suivi « à faire » d'une charge au-delà du seuil (l'écran remplace l'identifiant par le nom). */
export function libelleChargeEntreprise(c: ChargeEntreprise): string {
  if (c.niveau === 'normal') throw new Error(`Entreprise ${c.prestataireId} : demandes en cours sous le seuil d'alerte, rien à signaler.`)
  const depuis = c.depuisLe === null ? '' : ` depuis le ${dateIsoVersFr(c.depuisLe)}`
  return `Entreprise ${c.prestataireId} (${c.service}) : ${nombreDeDemandes(c.enCours, c.type)} en cours, ${CONSTAT_PAR_NIVEAU[c.niveau](c)}${depuis} (règle de gestion du cabinet)`
}

// ─── Contrôle avant d'attribuer une demande ───────────────────────────────────────────────────

export type CodeAnomaliePlafond = 'seuil_alerte_depasse' | 'maximum_depasse'

export interface AnomaliePlafond {
  code: CodeAnomaliePlafond
  /** Toujours une alerte : 🔴 blocage au-delà du maximum à confirmer par Frédéric. */
  gravite: 'alerte'
  message: string
}

/**
 * Avant d'attribuer la demande à son entreprise : alerte quand ses demandes en cours (même service, même type), celle-ci
 * comprise, dépasseraient le maximum (« maximum_depasse ») ou, à défaut, le seuil d'alerte (« seuil_alerte_depasse »).
 * Sans entreprise ou sans réglage : rien. Les autres demandes passent par demandesUniques ; une version antérieure de la
 * nouvelle demande, dans `items`, est remplacée par celle-ci.
 */
export function controlerPlafondAvantAttribution(
  nouvelle: DemandeSuivie,
  items: readonly DemandeSuivie[],
  entreprises: readonly EntrepriseRelance[],
  aujourdhui: string,
): AnomaliePlafond[] {
  verifierDate(aujourdhui, 'Date de référence')
  const d = nouvelle.demande
  if (d.prestataireId === null) return []
  const service = serviceDe(nouvelle)
  const reglage = reglageRelance(fichesParEntreprise(entreprises).get(d.prestataireId), service, d.type)
  if (reglage === null) return []
  const autres = demandesUniques(items.filter((i) => i.demande.id !== d.id))
    .filter((i) => i.demande.prestataireId === d.prestataireId && serviceDe(i) === service && i.demande.type === d.type)
    .filter((i) => estDemandeEnCours(i.demande, aujourdhui))
  const apres = autres.length + 1
  const constat = `Entreprise ${d.prestataireId} (${service}) : ${nombreDeDemandes(apres, d.type)} en cours avec celle-ci`
  if (apres > reglage.maxDemandesEnCours)
    return [{ code: 'maximum_depasse', gravite: 'alerte', message: `${constat}, au-delà du maximum de ${reglage.maxDemandesEnCours} fixé sur sa fiche (règle de gestion du cabinet).` }]
  if (apres > reglage.alerteAuDela)
    return [{ code: 'seuil_alerte_depasse', gravite: 'alerte', message: `${constat}, au-delà du seuil d'alerte de ${reglage.alerteAuDela} fixé sur sa fiche (règle de gestion du cabinet).` }]
  return []
}
