import type { AlerteMandataireAdHoc } from '@/lib/administrateur-judiciaire/domain/alerte-mandataire-ad-hoc'
import { etapeRecouvrementContentieux, type DossierContentieux } from '@/lib/administrateur-judiciaire/domain/contentieux'
import { dateLimiteResiliation, factureEnRetard, type FacturationContrat } from '@/lib/administrateur-judiciaire/domain/contrats-facturation'
import {
  ajouterJours,
  ajouterMois,
  dateIsoVersFr,
  dateVersIso,
  ecartJours,
  estDateIsoValide,
  jourSemaine,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { SuiviEcheancier } from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import type { EcheanceCalculee } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { estEcheanceAccomplieOuRevolue } from '@/lib/administrateur-judiciaire/domain/echeances-affichage'
import {
  echeancesEquipement,
  type FicheEquipement,
  type TypeEcheanceEquipement,
} from '@/lib/administrateur-judiciaire/domain/equipements'
import { etatEtape, type Etape } from '@/lib/administrateur-judiciaire/domain/etapes'
import type { Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { echeanceReglement } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { echeancesDiagnostics, type Diagnostic } from '@/lib/administrateur-judiciaire/domain/immeuble-juridique'
import {
  etapeSuiviSinistre,
  reperesDelaisSinistre,
  statutSinistre,
  type FicheSinistre,
} from '@/lib/administrateur-judiciaire/domain/sinistres'
import {
  echeancesTravaux,
  etatPartFondsTravaux,
  type OperationTravaux,
} from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import type { StatutAssemblee, StatutContrat, TypeContrat } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Suivi « à faire » transversal (cartographie Gestéam, tranche 38 : Gestion → Suivi). Fonctions pures, dates AAAA-MM-JJ,
 * sans écran. Chaque module fournit ses éléments datés par un adaptateur `depuis…`, qui reprend la règle du module sans la
 * recalculer ; le collaborateur règle ce qu'il suit ; le résultat se range par jour de la semaine.
 *
 * Gestéam — onglet Réglage : un bloc par famille (Dem. interv., Courriers, Documents, Mémos, Étapes, Évènements, Agenda,
 * Tickets appel, Sinistres, Équipements, Travaux, Assemblées, Contrats, Contentieux, Baux…), un bouton « de mon
 * portefeuille », des critères à cocher, chacun avec un horizon (« Maintenant » ou un nombre et une unité) ; Copier /
 * Coller d'un collaborateur à l'autre. Onglet Suivi : colonnes Avant · lundi … vendredi. Suivi des éléments en cours :
 * dossiers ouverts par collaborateur (responsable, comptable ou assistant du mandat, ou responsable de la fiche), en quatre
 * tranches d'ancienneté selon la périodicité (sur 30 jours, mensuelle, trimestre, année), sous-total par cabinet, total.
 *
 * 🔵 Déduits : le portefeuille réunit les trois rôles du mandat ; un élément désigné à un collaborateur le suit hors de son
 * portefeuille ; un élément du week-end revient au vendredi qui précède (mieux vaut le traiter avant) ; les tranches des
 * périodicités autres que mensuelle (seule la mensuelle a été observée) ; un âge de trois périodes exactement tombe dans
 * la dernière tranche ; unités d'horizon jours / semaines / mois (listes non ouvertes dans Gestéam).
 * 🔴 Signalés `aConfirmer` : repères de déclaration et de prescription des sinistres (sinistres.ts) ; échéances légales
 * dont la certitude n'est pas TEXTE. Les 21 jours francs de convocation (décompte de votes-ag.ts) sont confirmés (J5).
 * 🔵 Contentieux (réglage Gestéam : « Commandement depuis n », « Non réglés depuis n », « Soldés ») : les n jours sont des
 * réglages de GESTION du cabinet (DELAIS_SUIVI_CONTENTIEUX, modifiables), jamais des délais légaux ; les délais des voies
 * d'exécution relèvent du moteur de délais. Relances « non réglé » et « soldé, à clore » et échéancier impayé : dossiers
 * de recouvrement seulement (contentieux.etapeRecouvrementContentieux). Exercices : en rouge dans Gestéam (tranche 43 § 9),
 * l'exercice passé qui n'est pas « Réparti » ; l'exclusion de « Non géré » (exercice hors mission) est 🔵 déduite.
 * Alerte de l'art. 29-1 A (alerte-mandataire-ad-hoc.ts) : famille Exercices, une par syndicat ; 🔴 sous mandat de justice,
 * signalée `aConfirmer`.
 * Sans source dans VitFix à ce jour, donc sans adaptateur : courriers à relancer, mouvement crédit d'un contentieux,
 * mémos, tickets d'appel, agenda ; libération de la retenue de garantie (🔴 à confirmer dans travaux-operations.ts).
 * Source disponible, adaptateur à écrire : factures en attente de bon à payer (statuts-facture.ts).
 */

export const FAMILLES_SUIVI = [
  'mandat',
  'assemblees',
  'etapes',
  'taches',
  'travaux',
  'contrats',
  'factures',
  'sinistres',
  'equipements',
  'diagnostics',
  'contentieux',
  'exercices',
] as const
export type FamilleSuivi = (typeof FAMILLES_SUIVI)[number]

/** Critères de chaque famille (les cases à cocher d'un bloc du réglage Gestéam). */
export const NATURES_SUIVI = {
  mandat: ['echeance_legale'],
  assemblees: ['convocation_a_presenter', 'pv_a_signer'],
  etapes: ['a_faire', 'a_valider'],
  taches: ['tache'],
  travaux: ['fonds_a_appeler'],
  contrats: ['limite_resiliation', 'a_resilier', 'mise_en_concurrence', 'facture_attendue'],
  factures: ['reglement'],
  sinistres: ['a_declarer', 'prescription', 'indemnite_differee'],
  equipements: ['a_reviser', 'a_remplacer', 'fin_garantie'],
  diagnostics: ['a_renouveler'],
  contentieux: ['suite_commandement', 'echeancier_impaye', 'non_regle', 'a_clore'],
  exercices: ['repartition_en_retard', 'alerte_29_1_a'],
} as const satisfies Record<FamilleSuivi, readonly string[]>
export type NatureSuivi = (typeof NATURES_SUIVI)[FamilleSuivi][number]

export const LIBELLES_FAMILLES_SUIVI: Record<FamilleSuivi, string> = {
  mandat: 'Échéances du mandat',
  assemblees: 'Assemblées',
  etapes: 'Étapes',
  taches: 'Tâches',
  travaux: 'Travaux',
  contrats: 'Contrats',
  factures: 'Factures fournisseurs',
  sinistres: 'Sinistres',
  equipements: 'Équipements',
  diagnostics: 'Diagnostics',
  contentieux: 'Contentieux',
  exercices: 'Exercices',
}

export const LIBELLES_NATURES_SUIVI: Record<NatureSuivi, string> = {
  echeance_legale: 'Échéance légale',
  convocation_a_presenter: 'Convocation à présenter',
  pv_a_signer: 'PV à signer',
  a_faire: 'À faire',
  a_valider: 'À valider',
  tache: 'Tâche',
  fonds_a_appeler: 'Fonds à appeler',
  limite_resiliation: 'Limite de résiliation',
  a_resilier: 'À résilier',
  mise_en_concurrence: 'Mise en concurrence',
  facture_attendue: 'Facture attendue',
  reglement: 'Règlement',
  a_declarer: 'À déclarer',
  prescription: 'Prescription',
  indemnite_differee: 'Indemnité différée',
  suite_commandement: 'Suite au commandement',
  echeancier_impaye: 'Échéancier impayé',
  non_regle: 'Non réglé',
  a_clore: 'Soldé, à clore',
  repartition_en_retard: 'Répartition en retard',
  alerte_29_1_a: 'Alerte art. 29-1 A (mandataire ad hoc)',
  a_reviser: 'À réviser',
  a_remplacer: 'À remplacer',
  fin_garantie: 'Fin de garantie',
  a_renouveler: 'À renouveler',
}

export interface ElementAFaire {
  /** Clé stable « famille:… » : deux éléments de même id n'en font qu'un. */
  id: string
  famille: FamilleSuivi
  nature: NatureSuivi
  libelle: string
  /** Date à laquelle l'élément est dû. */
  date: string
  /** Mandat du portefeuille ; null : élément du cabinet, rattaché à aucun mandat. */
  mandatId: string | null
  /** Fiche d'origine (contrat, sinistre, étape…) ; null quand la source n'a pas d'identifiant. */
  objetId: string | null
  /** Collaborateur désigné (réalisateur ou validateur d'une étape, tâche assignée) : l'élément le suit hors portefeuille. */
  assigneId: string | null
  /** Repère juridique non confirmé (🔴) : à afficher comme tel, jamais comme un délai certain. */
  aConfirmer: boolean
}

// ─── Portefeuille ───────────────────────────────────────────────────────────────────────────

export const ROLES_MANDAT = ['responsable', 'comptable', 'assistant'] as const
export type RoleMandat = (typeof ROLES_MANDAT)[number]

/** Titulaires des trois rôles Gestéam sur un mandat (identifiants de collaborateurs ; null : rôle non pourvu). */
export interface RolesMandat {
  responsableId: string | null
  comptableId: string | null
  assistantId: string | null
}

export interface AffectationMandat extends RolesMandat {
  mandatId: string
  cabinetId: string | null
}

const CHAMP_ROLE: Record<RoleMandat, keyof RolesMandat> = {
  responsable: 'responsableId',
  comptable: 'comptableId',
  assistant: 'assistantId',
}

/** Mandats du collaborateur : ceux où il tient l'un des rôles demandés (les trois par défaut). */
export function portefeuille(
  collaborateurId: string,
  affectations: AffectationMandat[],
  roles: readonly RoleMandat[] = ROLES_MANDAT,
): Set<string> {
  return new Set(
    affectations.filter((a) => roles.some((role) => a[CHAMP_ROLE[role]] === collaborateurId)).map((a) => a.mandatId),
  )
}

// ─── Réglage ────────────────────────────────────────────────────────────────────────────────

export type Horizon = { unite: 'maintenant' } | { nombre: number; unite: 'jours' | 'semaines' | 'mois' }
export type PerimetreSuivi = 'portefeuille' | 'cabinet'

export interface ReglageFamille {
  actif: boolean
  perimetre: PerimetreSuivi
  horizon: Horizon
  /** Natures suivies ; null : toutes celles de la famille. */
  natures: NatureSuivi[] | null
  /** Horizon propre à une nature (Gestéam : un horizon par critère) ; à défaut, celui de la famille. */
  horizonsParNature?: Partial<Record<NatureSuivi, Horizon>>
}

export interface ReglageSuivi {
  collaborateurId: string
  /** Une famille absente n'est pas suivie. */
  familles: Partial<Record<FamilleSuivi, ReglageFamille>>
}

const verifierDate = (date: string, quoi = 'Date de référence'): void => {
  if (!estDateIsoValide(date)) throw new Error(`${quoi} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

/** Toutes les familles suivies, dans le portefeuille du collaborateur, à l'horizon « Maintenant ». */
export function reglageParDefaut(collaborateurId: string): ReglageSuivi {
  const familles: ReglageSuivi['familles'] = {}
  for (const famille of FAMILLES_SUIVI)
    familles[famille] = { actif: true, perimetre: 'portefeuille', horizon: { unite: 'maintenant' }, natures: null }
  return { collaborateurId, familles }
}

/** « Copier / Coller » : le même réglage pour un autre collaborateur, sans objet partagé avec l'original. */
export function copierReglage(reglage: ReglageSuivi, versCollaborateurId: string): ReglageSuivi {
  const familles: ReglageSuivi['familles'] = {}
  for (const famille of FAMILLES_SUIVI) {
    const source = reglage.familles[famille]
    if (!source) continue
    const copie: ReglageFamille = {
      actif: source.actif,
      perimetre: source.perimetre,
      horizon: { ...source.horizon },
      natures: source.natures ? [...source.natures] : null,
    }
    if (source.horizonsParNature) {
      const horizons: Partial<Record<NatureSuivi, Horizon>> = {}
      for (const [nature, horizon] of Object.entries(source.horizonsParNature) as [NatureSuivi, Horizon | undefined][])
        if (horizon) horizons[nature] = { ...horizon }
      copie.horizonsParNature = horizons
    }
    familles[famille] = copie
  }
  return { collaborateurId: versCollaborateurId, familles }
}

/** Dernier jour couvert par l'horizon (le mois est borné à sa fin, comme ajouterMois). */
export function limiteHorizon(aujourdhui: string, horizon: Horizon): string {
  verifierDate(aujourdhui)
  if (horizon.unite === 'maintenant') return aujourdhui
  if (!Number.isInteger(horizon.nombre) || horizon.nombre < 0)
    throw new Error(`Horizon invalide (${horizon.nombre} ${horizon.unite}) : nombre entier positif ou nul attendu.`)
  if (horizon.unite === 'jours') return ajouterJours(aujourdhui, horizon.nombre)
  if (horizon.unite === 'semaines') return ajouterJours(aujourdhui, 7 * horizon.nombre)
  return ajouterMois(aujourdhui, horizon.nombre)
}

const trier = (elements: ElementAFaire[]): ElementAFaire[] =>
  [...elements].sort((a, b) => a.date.localeCompare(b.date) || a.famille.localeCompare(b.famille) || a.id.localeCompare(b.id))

/** Jour où l'élément se traite : un samedi ou un dimanche revient au vendredi qui précède (🔵). */
const jourDeTraitement = (date: string): string => {
  const jour = jourSemaine(date)
  if (jour === 6) return ajouterJours(date, -1)
  if (jour === 0) return ajouterJours(date, -2)
  return date
}

/**
 * Éléments que le réglage retient au jour donné : famille suivie, nature cochée, à traiter au plus tard à la fin de
 * l'horizon (un élément du week-end compte pour le vendredi), et dans le périmètre (tout le cabinet, ou le portefeuille du
 * collaborateur et ce qui lui est désigné). Tri par date.
 */
/**
 * L'élément « à résilier » remplace la limite générique d'un contrat marqué : un réglage qui suit la « Limite de
 * résiliation » le suit aussi, avec l'horizon de cette nature s'il n'en a pas un propre.
 */
const natureCochee = (natures: readonly NatureSuivi[], nature: NatureSuivi): boolean =>
  natures.includes(nature) || (nature === 'a_resilier' && natures.includes('limite_resiliation'))

const horizonDeNature = (regle: ReglageFamille, nature: NatureSuivi): Horizon =>
  regle.horizonsParNature?.[nature] ?? (nature === 'a_resilier' ? regle.horizonsParNature?.limite_resiliation : undefined) ?? regle.horizon

export function selectionnerAFaire(
  elements: ElementAFaire[],
  reglage: ReglageSuivi,
  affectations: AffectationMandat[],
  aujourdhui: string,
): ElementAFaire[] {
  verifierDate(aujourdhui)
  const mesMandats = portefeuille(reglage.collaborateurId, affectations)
  const retenus = new Map<string, ElementAFaire>()
  for (const element of elements) {
    verifierDate(element.date, `Date de l'élément ${element.id}`)
    const regle = reglage.familles[element.famille]
    if (!regle?.actif || retenus.has(element.id)) continue
    if (regle.natures && !natureCochee(regle.natures, element.nature)) continue
    const limite = limiteHorizon(aujourdhui, horizonDeNature(regle, element.nature))
    if (jourDeTraitement(element.date) > limite) continue
    const dansPerimetre =
      regle.perimetre === 'cabinet' ||
      element.assigneId === reglage.collaborateurId ||
      (element.mandatId !== null && mesMandats.has(element.mandatId))
    if (dansPerimetre) retenus.set(element.id, element)
  }
  return trier([...retenus.values()])
}

// ─── Semaine ────────────────────────────────────────────────────────────────────────────────

export interface JourSuivi {
  date: string
  elements: ElementAFaire[]
}

export interface PlanSemaine {
  lundi: string
  /** Dû avant le lundi de la semaine affichée. */
  avant: ElementAFaire[]
  /** Du lundi au vendredi ; le samedi et le dimanche reviennent au vendredi. */
  jours: JourSuivi[]
}

/** Semaine qui contient `jourDeLaSemaine` (du lundi au dimanche) ; ce qui tombe après le dimanche n'y figure pas. */
export function planSemaine(elements: ElementAFaire[], jourDeLaSemaine: string): PlanSemaine {
  verifierDate(jourDeLaSemaine, 'Date de la semaine')
  const lundi = ajouterJours(jourDeLaSemaine, -((jourSemaine(jourDeLaSemaine) + 6) % 7))
  const dimanche = ajouterJours(lundi, 6)
  const jours: JourSuivi[] = [0, 1, 2, 3, 4].map((i) => ({ date: ajouterJours(lundi, i), elements: [] }))
  const avant: ElementAFaire[] = []
  for (const element of trier(elements)) {
    verifierDate(element.date, `Date de l'élément ${element.id}`)
    if (element.date < lundi) avant.push(element)
    else if (element.date <= dimanche) jours[ecartJours(lundi, jourDeTraitement(element.date))].elements.push(element)
  }
  return { lundi, avant, jours }
}

// ─── Sources ────────────────────────────────────────────────────────────────────────────────

interface ChampsElement {
  libelle: string
  date: string
  mandatId: string | null
  objetId: string | null
  assigneId?: string | null
  aConfirmer?: boolean
}

const elementSuivi = (famille: FamilleSuivi, nature: NatureSuivi, cle: string, champs: ChampsElement): ElementAFaire => ({
  id: `${famille}:${cle}`,
  famille,
  nature,
  libelle: champs.libelle,
  date: champs.date,
  mandatId: champs.mandatId,
  objetId: champs.objetId,
  assigneId: champs.assigneId ?? null,
  aConfirmer: champs.aConfirmer ?? false,
})

/** Échéances du moteur légal (delais-legaux) calculées, datées, ni accomplies ni révolues (echeances-affichage). */
export function depuisEcheancesLegales(items: { mandatId: string; echeance: EcheanceCalculee }[], aujourdhui: string): ElementAFaire[] {
  verifierDate(aujourdhui)
  return items.flatMap(({ mandatId, echeance }) =>
    echeance.statut !== 'CALCULEE' || !echeance.dateRetenue || estEcheanceAccomplieOuRevolue(echeance, aujourdhui)
      ? []
      : [
          elementSuivi('mandat', 'echeance_legale', `${mandatId}:${echeance.regleId}`, {
            libelle: echeance.libelle,
            date: echeance.dateRetenue,
            mandatId,
            objetId: echeance.regleId,
            aConfirmer: echeance.certitude !== 'TEXTE',
          }),
        ],
  )
}

/**
 * 21 jours francs entre la première présentation de la convocation et la réunion, au décompte de controlerConvocation
 * (votes-ag.ts) : présentation 22 jours avant la réunion au plus tard. Décompte confirmé par Hugo le 30/10/2026 (J5).
 */
const JOURS_PRESENTATION_AVANT_AG = 22

export interface AssembleeSuivie {
  id: string
  mandatId: string
  libelle: string
  date: string
  statut: StatutAssemblee
}

/** En projet : dernier jour pour présenter la convocation ; convoquée (réunion tenue ou à tenir) : PV à signer. */
export function depuisAssemblees(ags: AssembleeSuivie[]): ElementAFaire[] {
  return ags.flatMap((ag) => {
    verifierDate(ag.date, `Date de l'assemblée ${ag.id}`)
    const champs = { libelle: ag.libelle, mandatId: ag.mandatId, objetId: ag.id }
    if (ag.statut === 'Projet')
      return [
        elementSuivi('assemblees', 'convocation_a_presenter', `${ag.id}:convocation_a_presenter`, {
          ...champs,
          date: ajouterJours(ag.date, -JOURS_PRESENTATION_AVANT_AG),
          aConfirmer: false,
        }),
      ]
    if (ag.statut === 'Convoquée') return [elementSuivi('assemblees', 'pv_a_signer', `${ag.id}:pv_a_signer`, { ...champs, date: ag.date })]
    return []
  })
}

/** Étape à faire : à la plus proche de son alerte et de sa limite, pour son réalisateur ; à valider : pour son validateur. */
export function depuisEtapes(items: { mandatId: string | null; etape: Etape }[], aujourdhui: string): ElementAFaire[] {
  verifierDate(aujourdhui)
  return items.flatMap(({ mandatId, etape }) => {
    const { statut } = etatEtape(etape, aujourdhui)
    const champs = { libelle: etape.titre, mandatId, objetId: etape.id }
    if (statut === 'a_faire') {
      const dates = [etape.alerteSecurite, etape.limite].filter((d): d is string => d !== null)
      if (dates.length === 0) return []
      for (const d of dates) verifierDate(d, `Date de l'étape ${etape.id}`)
      const date = dates.reduce((a, b) => (a < b ? a : b), dates[0])
      return [elementSuivi('etapes', 'a_faire', `${etape.id}:a_faire`, { ...champs, date, assigneId: etape.realisateurId })]
    }
    if (statut === 'a_valider' && etape.faitLe)
      return [elementSuivi('etapes', 'a_valider', `${etape.id}:a_valider`, { ...champs, date: etape.faitLe, assigneId: etape.validateurId })]
    return []
  })
}

export interface TacheSuivie {
  id: string
  libelle: string
  /** Date locale (table Dexie) ou AAAA-MM-JJ. */
  due: Date | string
  assigneId: string | null
  mandatId?: string | null
}

export function depuisTaches(taches: TacheSuivie[]): ElementAFaire[] {
  return taches.map((tache) => {
    const date = typeof tache.due === 'string' ? tache.due : dateVersIso(tache.due)
    if (!date || !estDateIsoValide(date)) throw new Error(`Date due invalide pour la tâche ${tache.id} : date ou AAAA-MM-JJ attendue.`)
    return elementSuivi('taches', 'tache', tache.id, {
      libelle: tache.libelle,
      date,
      mandatId: tache.mandatId ?? null,
      objetId: tache.id,
      assigneId: tache.assigneId,
    })
  })
}

/**
 * Travaux votés : chaque appel de tranche pas encore lancé, à son exigibilité (travaux-operations) ; non votés : rien.
 * Part du fonds de travaux pas encore autorisée (décision d'affectation ou ordonnance du juge attendue) : un seul
 * élément, à la date du premier appel à lancer, qui dit ce qui bloque, sans interrompre la liste des autres opérations.
 * `appelees` : ids d'appel (« 00042-T1 ») déjà lancés. Le n° d'opération n'est unique qu'au sein du syndicat (D1) : la clé
 * et la fiche d'origine portent la copropriété.
 */
export function depuisOperationsTravaux(
  items: { mandatId: string; operation: OperationTravaux; appelees: string[] }[],
): ElementAFaire[] {
  return items.flatMap(({ mandatId, operation, appelees }) => {
    if (!operation.decision) return []
    const objetId = `${operation.coproprieteId}:${operation.numero}`
    const etatFonds = etatPartFondsTravaux(operation)
    if (etatFonds && !etatFonds.autorise) {
      const premiere = operation.tranches.find((_, i) => !appelees.includes(`${operation.numero}-T${i + 1}`))
      return premiere
        ? [
            elementSuivi('travaux', 'fonds_a_appeler', `${objetId}:affectation_fonds`, {
              libelle: `${operation.libelle} — appels bloqués : ${etatFonds.motif}`,
              date: premiere.date,
              mandatId,
              objetId,
            }),
          ]
        : []
    }
    return echeancesTravaux(operation)
      .filter((appel) => !appelees.includes(appel.id))
      .map((appel) =>
        elementSuivi('travaux', 'fonds_a_appeler', `${operation.coproprieteId}:${appel.id}`, {
          libelle: appel.libelle,
          date: appel.exigibilite,
          mandatId,
          objetId,
        }),
      )
  })
}

export interface ContratSuivi {
  id: string
  mandatId: string
  libelle: string
  /** Absent : en cours (contrats saisis avant l'intégration, comme contrats.ts). */
  statut?: StatutContrat
  concurrenceDu?: string | null
  concurrenceAu?: string | null
  facturation?: FacturationContrat
  type?: TypeContrat
  /** Case « À résilier » : la limite générique cède la place à l'élément « à résilier » (contrats-a-resilier.ts). */
  aResilier?: boolean
}

/**
 * Contrat suivi par contrats-a-resilier.ts : marqué « à résilier », en cours, hors contrat de travail (un licenciement,
 * pas une résiliation). Seul un tel contrat voit sa limite générique remplacée par l'élément « à résilier ».
 */
export const contratMarqueAResilier = (contrat: { statut?: StatutContrat; type?: TypeContrat; aResilier?: boolean }): boolean =>
  Boolean(contrat.aResilier) && (contrat.statut ?? 'En cours') === 'En cours' && contrat.type !== 'Contrat de travail'

/**
 * Contrat en cours : limite de résiliation s'il se reconduit tacitement (contrats-facturation) et n'est pas marqué « à
 * résilier » ; mise en concurrence à l'ouverture de sa fenêtre, tant qu'elle n'est pas close ; facture attendue au premier
 * jour de retard au-delà de la tolérance du contrat.
 */
export function depuisContrats(contrats: ContratSuivi[], aujourdhui: string): ElementAFaire[] {
  verifierDate(aujourdhui)
  return contrats.flatMap((contrat) => {
    if ((contrat.statut ?? 'En cours') !== 'En cours') return []
    const champs = { libelle: contrat.libelle, mandatId: contrat.mandatId, objetId: contrat.id }
    const elements: ElementAFaire[] = []
    const { facturation } = contrat
    if (facturation?.tacite && !contratMarqueAResilier(contrat))
      elements.push(
        elementSuivi('contrats', 'limite_resiliation', `${contrat.id}:limite_resiliation`, {
          ...champs,
          date: dateLimiteResiliation(facturation, aujourdhui),
        }),
      )
    if (contrat.concurrenceDu && contrat.concurrenceAu) {
      verifierDate(contrat.concurrenceDu, `Ouverture de la mise en concurrence du contrat ${contrat.id}`)
      verifierDate(contrat.concurrenceAu, `Clôture de la mise en concurrence du contrat ${contrat.id}`)
      if (aujourdhui <= contrat.concurrenceAu)
        elements.push(
          elementSuivi('contrats', 'mise_en_concurrence', `${contrat.id}:mise_en_concurrence`, { ...champs, date: contrat.concurrenceDu }),
        )
    }
    const retard = facturation ? factureEnRetard(facturation, aujourdhui) : null
    if (facturation && retard)
      elements.push(
        elementSuivi('contrats', 'facture_attendue', `${contrat.id}:facture_attendue`, {
          ...champs,
          date: ajouterJours(retard.attendueLe, Math.max(0, (facturation.retardFactureJours ?? 0) + 1)),
        }),
      )
    return elements
  })
}

export interface FactureSuivie {
  id: string
  mandatId: string
  libelle: string
  dateFacture: string
  joursEcheance: number
  totalTtcCentimes: number
  acomptesCentimes: number
}

/** Facture fournisseur : règlement à son échéance (facture-ventilee) tant qu'il reste dû. */
export function depuisFactures(factures: FactureSuivie[], aujourdhui: string): ElementAFaire[] {
  verifierDate(aujourdhui)
  return factures.flatMap((facture) => {
    const { echeance, resteDuCentimes } = echeanceReglement(facture, aujourdhui)
    return resteDuCentimes > 0
      ? [elementSuivi('factures', 'reglement', facture.id, { libelle: facture.libelle, date: echeance, mandatId: facture.mandatId, objetId: facture.id })]
      : []
  })
}

/**
 * Sinistre en cours : repère de déclaration tant qu'il n'est pas déclaré, et prescription (sinistres.ts) — deux repères
 * indicatifs, 🔴 à confirmer : le contrat peut allonger le délai de déclaration. Indemnité différée non réglée : à
 * réclamer depuis le règlement de l'indemnité immédiate (à défaut le rapport, la déclaration, la survenance) ; c'est un
 * suivi de gestion, pas un repère légal.
 */
export function depuisSinistres(
  items: { id: string; mandatId: string; libelle: string; fiche: FicheSinistre; delaiContratJoursOuvres?: number }[],
): ElementAFaire[] {
  return items.flatMap(({ id, mandatId, libelle, fiche, delaiContratJoursOuvres }) => {
    if (statutSinistre(fiche) !== 'En cours') return []
    const reperes = reperesDelaisSinistre(fiche, { delaiContratJoursOuvres })
    const champs = { libelle, mandatId, objetId: id, aConfirmer: true }
    const elements: ElementAFaire[] = []
    if (etapeSuiviSinistre(fiche) === 'a_declarer')
      elements.push(elementSuivi('sinistres', 'a_declarer', `${id}:a_declarer`, { ...champs, date: reperes.declarationAuPlusTard }))
    elements.push(elementSuivi('sinistres', 'prescription', `${id}:prescription`, { ...champs, date: reperes.prescription }))
    if (fiche.indemniteDiffereeCentimes > 0 && !fiche.indemniteDiffereeReglee)
      elements.push(
        elementSuivi('sinistres', 'indemnite_differee', `${id}:indemnite_differee`, {
          libelle: `${libelle} — ${fiche.reparationsFaites ? 'indemnité différée à réclamer (réparations faites)' : 'indemnité différée en attente des réparations'}`,
          date: fiche.dateReglement ?? fiche.dateRapport ?? fiche.dateDeclaration ?? fiche.dateSurvenance,
          mandatId,
          objetId: id,
        }),
      )
    return elements
  })
}

/** Réglages de gestion du suivi des contentieux (Gestéam : « Commandement depuis n », « Non réglés depuis n »). */
export interface DelaisSuiviContentieux {
  joursApresCommandement: number
  joursSansReglement: number
}

/** 🔵 Valeurs par défaut de GESTION, modifiables par le cabinet ; aucune n'est un délai légal. */
export const DELAIS_SUIVI_CONTENTIEUX: DelaisSuiviContentieux = { joursApresCommandement: 30, joursSansReglement: 60 }

export interface ContentieuxSuivi {
  id: string
  mandatId: string
  libelle: string
  dossier: DossierContentieux
  /** Date du dernier règlement du débiteur ; absente : aucun règlement. Postérieure à aujourd'hui : ignorée. */
  dernierReglementLe?: string | null
  /**
   * Solde dû par le débiteur (decompte-contentieux.calculerDecompte) ; négatif : excédent à imputer sur son compte.
   * Absent : le montant demandé fait foi s'il est positif, sinon le solde est inconnu.
   */
  soldeDuCentimes?: number | null
  /** Suivi de l'échéancier du débiteur (decompte-contentieux.suivreEcheancier), s'il y en a un. */
  echeancier?: SuiviEcheancier | null
}

/**
 * Contentieux ouvert : suite à donner n jours après le commandement, sauf dossier soldé. Dossier de recouvrement :
 * échéancier du débiteur impayé, à la première échéance échue non soldée ; soldé (solde connu ≤ 0) mais non clos : à
 * clore ; sinon relance n jours après le dernier règlement (ou l'ouverture), sauf échéancier en cours et respecté. Solde
 * inconnu : ni relance ni clôture. Un dossier clos ne donne rien.
 */
export function depuisContentieux(
  items: ContentieuxSuivi[],
  aujourdhui: string,
  delais: DelaisSuiviContentieux = DELAIS_SUIVI_CONTENTIEUX,
): ElementAFaire[] {
  verifierDate(aujourdhui)
  for (const jours of [delais.joursApresCommandement, delais.joursSansReglement])
    if (!Number.isInteger(jours) || jours < 0) throw new Error(`Délai de suivi invalide (${jours}) : nombre entier de jours positif ou nul attendu.`)
  return items.flatMap(({ id, mandatId, libelle, dossier, dernierReglementLe, soldeDuCentimes, echeancier }) => {
    if (dernierReglementLe != null) verifierDate(dernierReglementLe, `Date du dernier règlement du contentieux ${id}`)
    if (soldeDuCentimes != null && !Number.isInteger(soldeDuCentimes))
      throw new Error(`Solde dû invalide pour le contentieux ${id} (${soldeDuCentimes}) : centimes entiers attendus.`)
    if (dossier.dateCloture) return []
    const champs = { mandatId, objetId: id }
    const elements: ElementAFaire[] = []
    const solde = soldeDuCentimes ?? (dossier.montantDemandeCentimes > 0 ? dossier.montantDemandeCentimes : null)
    const solde0 = solde !== null && solde <= 0
    const { commandement } = dossier.jalons
    if (commandement && !solde0)
      elements.push(
        elementSuivi('contentieux', 'suite_commandement', `${id}:suite_commandement`, {
          ...champs,
          libelle: `${libelle} — suite au commandement du ${dateIsoVersFr(commandement)}`,
          date: ajouterJours(commandement, delais.joursApresCommandement),
        }),
      )
    if (etapeRecouvrementContentieux(dossier) === null) return elements
    const impayee = echeancier?.respecte === false ? echeancier.echeances.find((e) => e.date < aujourdhui && e.payeCentimes < e.montantCentimes) : undefined
    if (impayee)
      elements.push(
        elementSuivi('contentieux', 'echeancier_impaye', `${id}:echeancier_impaye`, {
          ...champs,
          libelle: `${libelle} — échéancier impayé depuis le ${dateIsoVersFr(impayee.date)}`,
          date: impayee.date,
        }),
      )
    if (solde === null) return elements
    const depuis = dernierReglementLe && dernierReglementLe <= aujourdhui ? dernierReglementLe : dossier.dateOuverture
    if (solde0)
      elements.push(
        elementSuivi('contentieux', 'a_clore', `${id}:a_clore`, {
          ...champs,
          libelle: `${libelle} — soldé${solde < 0 ? ` (excédent de ${formatEurosCentimes(-solde / 100)} à imputer sur le compte)` : ''}, à clore`,
          date: depuis,
        }),
      )
    else if (!(echeancier?.respecte === true && echeancier.prochaine !== null))
      elements.push(
        elementSuivi('contentieux', 'non_regle', `${id}:non_regle`, {
          ...champs,
          libelle: `${libelle} — aucun règlement depuis le ${dateIsoVersFr(depuis)}`,
          date: ajouterJours(depuis, delais.joursSansReglement),
        }),
      )
    return elements
  })
}

const STATUTS_EXERCICE_TERMINES: readonly Exercice['statut'][] = ['Réparti', 'Non géré']

/**
 * Exercice clos (clôture passée) qui n'est pas « Réparti » (ni, 🔵, « Non géré ») : répartition en retard, dès le
 * lendemain. `id` : identifiant de l'enregistrement, à défaut la clé « syndicat:nom » (le nom doit alors être renseigné).
 */
export function depuisExercices(items: { id?: string; mandatId: string; exercice: Exercice }[], aujourdhui: string): ElementAFaire[] {
  verifierDate(aujourdhui)
  return items.flatMap(({ id, mandatId, exercice }) => {
    verifierDate(exercice.cloture, `Clôture de l'exercice ${exercice.nom}`)
    if (!id?.trim() && !exercice.nom.trim())
      throw new Error(`Exercice clos le ${exercice.cloture} sans identifiant ni nom : impossible de le suivre sans doublon.`)
    if (exercice.cloture >= aujourdhui || STATUTS_EXERCICE_TERMINES.includes(exercice.statut)) return []
    const cle = id?.trim() || `${exercice.coproprieteId}:${exercice.nom}`
    return [
      elementSuivi('exercices', 'repartition_en_retard', `${cle}:repartition_en_retard`, {
        libelle: `Exercice ${exercice.nom} clos le ${dateIsoVersFr(exercice.cloture)}, statut « ${exercice.statut} » : répartition en retard`,
        date: ajouterJours(exercice.cloture, 1),
        mandatId,
        objetId: cle,
      }),
    ]
  })
}

/**
 * Alerte de l'art. 29-1 A (alerte-mandataire-ad-hoc.alerteMandataireAdHoc), une par syndicat : déclenchée, avec un
 * critère atteint que la requête au juge ne couvre pas (lecture critère par critère), à la date du plus tôt de ces
 * critères et avec leurs seuls constats ; pas encore déclenchée, à la date où le délai sans vote de l'assemblée sur
 * l'approbation des comptes sera atteint (repère pour la faire voter à temps). Chaque critère atteint couvert par la
 * requête, ou aucun vote connu sans déclenchement : rien. `aConfirmer` reprend celui de l'alerte (🔴 sous mandat de
 * justice, arriérés comptés).
 */
export function depuisAlertesMandataireAdHoc(items: { mandatId: string; alerte: AlerteMandataireAdHoc }[]): ElementAFaire[] {
  return items.flatMap(({ mandatId, alerte }) => {
    if (alerte.saisineFaite) return []
    const cle = `${alerte.coproprieteId}:alerte_29_1_a`
    const champs = { mandatId, objetId: alerte.coproprieteId, aConfirmer: alerte.aConfirmer }
    if (alerte.aTraiterLe !== null) {
      const constats = [alerte.impayes, alerte.comptes].filter((c) => c.etat === 'atteint' && !c.traite).map((c) => c.message)
      return [
        elementSuivi('exercices', 'alerte_29_1_a', cle, {
          ...champs,
          libelle: `Alerte de l'art. 29-1 A (mandataire ad hoc) : ${constats.join(' ')}`,
          date: alerte.aTraiterLe,
        }),
      ]
    }
    const { atteintLe, message } = alerte.comptes
    if (atteintLe === null) return []
    return [
      elementSuivi('exercices', 'alerte_29_1_a', cle, {
        ...champs,
        libelle: `Alerte de l'art. 29-1 A (mandataire ad hoc) à venir : ${message}`,
        date: atteintLe,
      }),
    ]
  })
}

const NATURE_ECHEANCE_EQUIPEMENT: Record<TypeEcheanceEquipement, NatureSuivi> = {
  entretien: 'a_reviser',
  remplacement: 'a_remplacer',
  garantie: 'fin_garantie',
}

/** Équipement : révision et remplacement, même dépassés ; fin de garantie seulement si elle est à venir (equipements). */
export function depuisEquipements(
  items: { id: string; mandatId: string; libelle: string; fiche: FicheEquipement }[],
  aujourdhui: string,
): ElementAFaire[] {
  return items.flatMap(({ id, mandatId, libelle, fiche }) =>
    echeancesEquipement(fiche, aujourdhui)
      .filter((echeance) => echeance.type !== 'garantie' || echeance.jours >= 0)
      .map((echeance) => {
        const nature = NATURE_ECHEANCE_EQUIPEMENT[echeance.type]
        return elementSuivi('equipements', nature, `${id}:${nature}`, { libelle, date: echeance.date, mandatId, objetId: id })
      }),
  )
}

/**
 * Diagnostic de l'immeuble : à renouveler à la fin de sa validité, même dépassée ; le plus récent par type compte
 * (immeuble-juridique). Un mandat peut couvrir plusieurs immeubles : la clé porte l'immeuble.
 */
export function depuisDiagnostics(
  items: { mandatId: string; immeubleId: string; diagnostics: Diagnostic[] }[],
  aujourdhui: string,
): ElementAFaire[] {
  verifierDate(aujourdhui)
  return items.flatMap(({ mandatId, immeubleId, diagnostics }) =>
    echeancesDiagnostics(diagnostics, aujourdhui).flatMap((echeance) =>
      echeance.validite === null
        ? []
        : [
            elementSuivi('diagnostics', 'a_renouveler', `${mandatId}:${immeubleId}:${echeance.famille}:${echeance.typeDocument}`, {
              libelle: echeance.typeDocument,
              date: echeance.validite,
              mandatId,
              objetId: immeubleId,
            }),
          ],
    ),
  )
}

// ─── Balance âgée des dossiers ouverts ─────────────────────────────────────────────────────

export const PERIODICITES_ANALYSE = ['trente_jours', 'mensuelle', 'trimestre', 'annee'] as const
export type PeriodiciteAnalyse = (typeof PERIODICITES_ANALYSE)[number]

/** Rattachement d'un dossier à un collaborateur : son rôle sur le mandat, ou responsable de la fiche elle-même. */
export const RATTACHEMENTS_ANALYSE = ['responsable', 'comptable', 'assistant', 'responsable_fiche'] as const
export type RattachementAnalyse = (typeof RATTACHEMENTS_ANALYSE)[number]

export type Tranches = [number, number, number, number]
export type LibellesTranches = [string, string, string, string]

export const LIBELLES_TRANCHES: Record<PeriodiciteAnalyse, LibellesTranches> = {
  trente_jours: ['< 30 jours', 'de 30 à 60 jours', 'de 60 à 90 jours', '> 90 jours'],
  mensuelle: ['< 1 mois', 'de 1 à 2 mois', 'de 2 à 3 mois', '> 3 mois'],
  trimestre: ['< 1 trimestre', 'de 1 à 2 trimestres', 'de 2 à 3 trimestres', '> 3 trimestres'],
  annee: ['< 1 an', 'de 1 à 2 ans', 'de 2 à 3 ans', '> 3 ans'],
}

/** Fiche suivie (demande, sinistre, contentieux, étape…) : ouverte le, close le (null : en cours). */
export interface DossierOuvert {
  id: string
  mandatId: string | null
  ouvertLe: string
  closLe: string | null
  responsableFicheId: string | null
}

export interface CompteurDossiers {
  /** Dossiers ouverts au plus tard à la date de référence, clos compris. */
  tous: number
  /** Dossiers encore ouverts à la date de référence. */
  enCours: number
  /** Les dossiers en cours, par ancienneté. */
  tranches: Tranches
}

export interface LigneBalanceAgee extends CompteurDossiers {
  cabinetId: string | null
  /** Null : rôle non pourvu, ligne « non affecté ». */
  collaborateurId: string | null
}

export interface BalanceAgee {
  libellesTranches: LibellesTranches
  lignes: LigneBalanceAgee[]
  sousTotaux: (CompteurDossiers & { cabinetId: string | null })[]
  total: CompteurDossiers
}

const MOIS_PAR_PERIODE: Record<Exclude<PeriodiciteAnalyse, 'trente_jours'>, number> = { mensuelle: 1, trimestre: 3, annee: 12 }

/** Périodes entières écoulées depuis l'ouverture (bornées à 3) ; les mois se comptent du jour d'ouverture, sans dérive. */
function periodesEcoulees(ouvertLe: string, reference: string, periodicite: PeriodiciteAnalyse): number {
  if (periodicite === 'trente_jours') return Math.min(3, Math.floor(ecartJours(ouvertLe, reference) / 30))
  const mois = MOIS_PAR_PERIODE[periodicite]
  let periodes = 0
  while (periodes < 3 && ajouterMois(ouvertLe, (periodes + 1) * mois) <= reference) periodes++
  return periodes
}

const compteurVide = (): CompteurDossiers => ({ tous: 0, enCours: 0, tranches: [0, 0, 0, 0] })

const cumuler = (cible: CompteurDossiers, source: CompteurDossiers): void => {
  cible.tous += source.tous
  cible.enCours += source.enCours
  source.tranches.forEach((n, i) => (cible.tranches[i] += n))
}

/** Tri des lignes : les valeurs absentes (cabinet ou collaborateur non renseigné) en dernier. */
const nullEnDernier = (a: string | null, b: string | null): number => {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
}

/** Dates du dossier valides ; une clôture ne peut précéder l'ouverture. */
function controlerDossier(dossier: DossierOuvert): void {
  verifierDate(dossier.ouvertLe, `Date d'ouverture du dossier ${dossier.id}`)
  if (dossier.closLe === null) return
  verifierDate(dossier.closLe, `Date de clôture du dossier ${dossier.id}`)
  if (dossier.closLe < dossier.ouvertLe)
    throw new Error(`Dossier ${dossier.id} : clôture (${dossier.closLe}) antérieure à l'ouverture (${dossier.ouvertLe}).`)
}

/** Collaborateur auquel le dossier est rattaché : titulaire du rôle sur le mandat, ou responsable de la fiche. */
const collaborateurRattache = (
  dossier: DossierOuvert,
  affectation: AffectationMandat | undefined,
  rattachement: RattachementAnalyse,
): string | null =>
  rattachement === 'responsable_fiche' ? dossier.responsableFicheId : (affectation?.[CHAMP_ROLE[rattachement]] ?? null)

/** Sous-totaux par cabinet (dans l'ordre des lignes) et total général. */
function totaliser(lignes: LigneBalanceAgee[]): Pick<BalanceAgee, 'sousTotaux' | 'total'> {
  const sousTotaux: BalanceAgee['sousTotaux'] = []
  const total = compteurVide()
  for (const ligne of lignes) {
    let sousTotal = sousTotaux.find((s) => s.cabinetId === ligne.cabinetId)
    if (!sousTotal) {
      sousTotal = { cabinetId: ligne.cabinetId, ...compteurVide() }
      sousTotaux.push(sousTotal)
    }
    cumuler(sousTotal, ligne)
    cumuler(total, ligne)
  }
  return { sousTotaux, total }
}

/**
 * « Suivi des éléments en cours » : par cabinet et collaborateur, les dossiers ouverts à la date de référence, puis
 * ceux en cours par ancienneté ; sous-total par cabinet, total général. Un dossier ouvert après la date est ignoré.
 */
export function balanceAgee(
  dossiers: DossierOuvert[],
  affectations: AffectationMandat[],
  {
    rattachement,
    periodicite,
    dateReference,
    cabinets,
  }: { rattachement: RattachementAnalyse; periodicite: PeriodiciteAnalyse; dateReference: string; cabinets?: (string | null)[] },
): BalanceAgee {
  verifierDate(dateReference)
  const parMandat = new Map(affectations.map((a) => [a.mandatId, a]))
  const lignes = new Map<string, LigneBalanceAgee>()
  for (const dossier of dossiers) {
    controlerDossier(dossier)
    if (dossier.ouvertLe > dateReference) continue
    const affectation = dossier.mandatId === null ? undefined : parMandat.get(dossier.mandatId)
    const cabinetId = affectation?.cabinetId ?? null
    if (cabinets && !cabinets.includes(cabinetId)) continue
    const collaborateurId = collaborateurRattache(dossier, affectation, rattachement)
    const cle = JSON.stringify([cabinetId, collaborateurId])
    const ligne = lignes.get(cle) ?? { cabinetId, collaborateurId, ...compteurVide() }
    lignes.set(cle, ligne)
    ligne.tous++
    if (dossier.closLe !== null && dossier.closLe <= dateReference) continue
    ligne.enCours++
    ligne.tranches[periodesEcoulees(dossier.ouvertLe, dateReference, periodicite)]++
  }
  const triees = [...lignes.values()].sort(
    (a, b) => nullEnDernier(a.cabinetId, b.cabinetId) || nullEnDernier(a.collaborateurId, b.collaborateurId),
  )
  const [t1, t2, t3, t4] = LIBELLES_TRANCHES[periodicite]
  return { libellesTranches: [t1, t2, t3, t4], lignes: triees, ...totaliser(triees) }
}
