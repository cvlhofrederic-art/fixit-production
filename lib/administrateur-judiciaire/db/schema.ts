import Dexie, { type Table } from 'dexie'
import type { Tantiemes } from '@/lib/administrateur-judiciaire/domain/format'
import type { PlanComptable } from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import type {
  FamilleModeleCourrier,
  FormeEnvoiCourrier,
  NatureAssemblee,
  StatutAssemblee,
  StatutContrat,
  StatutCourrier,
  TypeContrat,
  TypeLot,
} from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'

/**
 * Base locale IndexedDB de la succursale (Dexie) : schéma, types des entités et instance unique.
 * La base s'appelle « vitfix-administrateur-judiciaire » (la maquette utilisait « vitfix »).
 *
 * Dates : les dates métier (ordonnance, échéance, date, due, dateCreation) sont des objets Date locaux ;
 * les horodatages posés par le repository (createdAt, updatedAt) sont des chaînes ISO.
 */

export const NOM_BASE_LOCALE = 'vitfix-administrateur-judiciaire'

/** Champs posés par le repository à la création, puis à chaque modification (updatedAt, updatedBy). */
export interface ChampsSuivi {
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
}

/** Entité enregistrée par un repository : identifiant et champs de suivi. */
export interface EntiteEnregistree extends ChampsSuivi {
  id: string
}

// ─── Entités lues et écrites par l'application ─────────────────────────────────────────────

export interface Copropriete extends EntiteEnregistree {
  code: string
  nom: string
  adresse: string
  nbLots: number
  budget: number
  depense: number
  impayes: number
  fondsTravaux: number
}

export interface Mandat extends EntiteEnregistree {
  coproprieteId: string
  fondement: string
  motif: string
  tribunal: string
  rg: string
  ordonnance: Date
  dureeMois: number
  echeance: Date
  statut: string
  pill: string
  notifOrdonnance: string
}

export interface Lot extends EntiteEnregistree {
  coproprieteId: string
  numero: string
  tantiemes: Tantiemes
  /**
   * Type de lot (TYPE_LOT, Gestéam 5.4.22 — un seul référentiel pour lots privatifs, locaux communs et droits de
   * jouissance exclusive). Optionnel : les lots créés avant l'intégration n'en ont pas.
   * Non observés comme champs dans Gestéam (critères de recherche seulement) : étage, bâtiment, escalier, rattachement
   * cave / parking — non modélisés.
   */
  type?: TypeLot
}

/** Copropriétaire (solde négatif = dette). */
export interface Coproprietaire extends EntiteEnregistree {
  lotId: string
  nom: string
  tel: string
  mail: string
  solde: number
  statut: string
}

export interface Prestataire extends EntiteEnregistree {
  nom: string
  metier: string
  ville: string
  siret: string
  decennale: boolean
  note: number
  interventions: number
  statut: string
  pill: string
  /**
   * Assurances de l'entreprise suivies par Gestéam (T15) : pour chacune, « nécessaire » et date d'échéance de
   * l'attestation (AAAA-MM-JJ). Optionnels : absents des prestataires créés avant l'intégration.
   * Distincts de `decennale` (indicateur d'affichage hérité de la maquette, sans échéance).
   */
  rcDecennaleNecessaire?: boolean
  rcDecennaleEcheance?: string | null
  rcpNecessaire?: boolean
  rcpEcheance?: string | null
}

/** Contrat (jamais écrit par l'application : lu pour la fiche 360). */
export interface Contrat extends EntiteEnregistree {
  prestataireId: string
  coproprieteId: string
  /** TYPE_CONTRAT (10 valeurs, Gestéam 5.4.22). */
  type?: TypeContrat
  /** STATUT_CONTRAT : En cours · Résilié · Plus géré. */
  statut?: StatutContrat
  /** Fenêtre de TACITE RECONDUCTION (AAAA-MM-JJ). Ne pas confondre avec la fenêtre de mise en concurrence. */
  reconductionDu?: string | null
  reconductionAu?: string | null
  /** Fenêtre pendant laquelle le contrat peut être REMIS EN CONCURRENCE (AAAA-MM-JJ). */
  concurrenceDu?: string | null
  concurrenceAu?: string | null
  /** Contrôle Gestéam « facture en retard de N jours ». */
  retardFactureJours?: number | null
  // Non observés dans Gestéam sans ouvrir une fiche réelle : objet, montant — non modélisés.
}

/** Sinistre (jamais écrit par l'application : lu pour la fiche 360). */
export interface Sinistre extends EntiteEnregistree {
  coproprieteId: string
}

/** Journal de banque d'une copropriété (créé à la volée au premier import de relevé). */
export interface Journal extends EntiteEnregistree {
  coproprieteId: string
}

export type SensEcriture = 'debit' | 'credit'

/** Écriture comptable (512 banque, 471 à ventiler, 450-<id copropriétaire>). */
export interface Ecriture extends EntiteEnregistree {
  journalId: string
  date: Date
  compte: string
  libelle: string
  montant: number
  sens: SensEcriture
}

/** Dossier d'impayé ; statut « étape:AAAA-MM-JJ » (voir domain/recouvrement). */
export interface Impaye extends EntiteEnregistree {
  coproprietaireId: string
  montant: number
  statut: string
}

/**
 * Pièce enregistrée : ordonnance source d'un mandat (entiteType « mandat », type « ordonnance ») ou journal des pièces
 * de reprise (entiteType « reprise », type = clé de pièce ou « retrait:clé »).
 */
export interface DocumentLocal extends EntiteEnregistree {
  entiteType: string
  entiteId: string
  nom: string
  type: string
  dateCreation: Date
}

/** Obligation suivie par le cabinet ; date null quand la date de démonstration n'est pas « JJ/MM/AAAA ». */
export interface EcheanceSuivi extends EntiteEnregistree {
  coproprieteId: string
  objet: string
  base: string
  date: Date | null
  statut: string
}

export interface NotificationLocale extends EntiteEnregistree {
  kind: string
  titre: string
  description: string
  date: Date
  lu: boolean
  coproprieteId: string | null
}

export interface Tache extends EntiteEnregistree {
  libelle: string
  due: Date
  assigneId: string | null
}

// ─── Tables déclarées mais jamais alimentées (seuls les champs indexés sont connus) ────────

export type Cabinet = EntiteEnregistree

export interface Societe extends EntiteEnregistree {
  cabinetId: string
}

export interface Utilisateur extends EntiteEnregistree {
  roleId: string
  email: string
}

export type Role = EntiteEnregistree

export interface Immeuble extends EntiteEnregistree {
  coproprieteId: string
}

export interface Batiment extends EntiteEnregistree {
  immeubleId: string
}

export interface Cage extends EntiteEnregistree {
  batimentId: string
}

export interface Occupant extends EntiteEnregistree {
  lotId: string
}

export interface Assurance extends EntiteEnregistree {
  coproprieteId: string
}

export interface Compte extends EntiteEnregistree {
  coproprieteId: string
  numero: string
}

export interface Exercice extends EntiteEnregistree {
  coproprieteId: string
  annee: number
}

export interface Facture extends EntiteEnregistree {
  prestataireId: string
  coproprieteId: string
}

export interface Reglement extends EntiteEnregistree {
  factureId: string
  appelDeFondsId: string
}

export interface Budget extends EntiteEnregistree {
  coproprieteId: string
  exerciceId: string
}

export interface AppelDeFonds extends EntiteEnregistree {
  coproprieteId: string
}

export interface FondsTravaux extends EntiteEnregistree {
  coproprieteId: string
}

export interface Banque extends EntiteEnregistree {
  coproprieteId: string
}

export interface Rapprochement extends EntiteEnregistree {
  bancaireId: string
}

/**
 * Assemblée générale. Deux axes distincts (Règle 5, ne pas fusionner) relevés dans Gestéam 5.4.22 :
 * - `nature` : Annuelle · Spéciale · Judiciaire (NATURE_ASSEMBLEE) ;
 * - `statut` : Projet → Convoquée → PV signé → Notifiée (STATUT_ASSEMBLEE), cycle légal.
 * Le statut ne se modifie QUE par changerStatutAg (db/statut-assemblee.ts), qui l'historise dans
 * `changementsStatut` avec sa date d'effet ; le repository refuse toute autre écriture du statut.
 */
export interface Ag extends EntiteEnregistree {
  coproprieteId: string
  date: Date
  nature: NatureAssemblee
  statut: StatutAssemblee
}

/**
 * Modèle de courrier (T30) : porte la famille et la FORME D'ENVOI (dont « AR »). Libellés relevés dans Gestéam
 * (tranche 22) ; aucun modèle n'est amorcé en base.
 */
export interface ModeleCourrier extends EntiteEnregistree {
  famille: FamilleModeleCourrier
  libelle: string
  contexte: string | null
  formeEnvoi: FormeEnvoiCourrier
}

/**
 * Courrier (T30) : l'envoi comme objet suivi, support de la PREUVE de notification. Entité autonome — Courrier ≠
 * Document (Règle 5) : un document peut avoir un courrier d'origine et un courrier de suite, sans fusion.
 * `formeEnvoi` est FIGÉE à la création (copie de celle du modèle) : modifier le modèle ne réécrit pas l'histoire.
 * Dates AAAA-MM-JJ. Rattachements facultatifs (identifiants libres, en attendant D1 / D2).
 */
export interface Courrier extends EntiteEnregistree {
  modeleId: string
  formeEnvoi: FormeEnvoiCourrier
  statut: StatutCourrier
  objet: string
  coproprieteId: string | null
  mandatId: string | null
  personneId: string | null
  entrepriseId: string | null
  dateDepot: string | null
  dateAccuseReception: string | null
  referenceDiffusion: string | null
}

/** Entités dont le statut est historisé (seule l'AG à ce stade). */
export type EntiteAStatutHistorise = 'ag'

/**
 * Changement de statut historisé (décision du 08/10/2026 : historiser, pas seulement stocker le statut courant).
 * `dateEffet` (AAAA-MM-JJ) est la date de l'ACTE ; `createdAt` celle de la SAISIE : elles diffèrent en pratique, et
 * le moteur de délais lit `dateEffet`. `courrierId` reliera le changement au courrier AR qui le prouve (T30) : null
 * tant que l'entité Courrier n'existe pas.
 */
export interface ChangementStatut extends EntiteEnregistree {
  entiteType: EntiteAStatutHistorise
  entiteId: string
  statutAncien: string | null
  statutNouveau: string
  dateEffet: string
  courrierId: string | null
}

export interface Resolution extends EntiteEnregistree {
  agId: string
}

export interface Procuration extends EntiteEnregistree {
  agId: string
  coproprietaireId: string
}

export interface Presence extends EntiteEnregistree {
  agId: string
  coproprietaireId: string
}

export interface Travaux extends EntiteEnregistree {
  coproprieteId: string
}

export interface Devis extends EntiteEnregistree {
  travauxId: string
  prestataireId: string
}

export interface Intervention extends EntiteEnregistree {
  coproprieteId: string
  prestataireId: string
}

// ─── Journal d'activité ────────────────────────────────────────────────────────────────────

export type ActionJournal = 'create' | 'update' | 'remove'

/** Entrée du journal d'activité : une par écriture d'un repository, avec l'état avant et après. */
export interface EntreeJournalActivite {
  id: string
  /** Horodatage ISO. */
  quand: string
  entite: string
  entiteId: string
  action: ActionJournal
  qui: string | null
  avant: unknown
  apres: unknown
}

// ─── Base ──────────────────────────────────────────────────────────────────────────────────

export class AdministrateurJudiciaireDb extends Dexie {
  declare cabinets: Table<Cabinet, string>
  declare societes: Table<Societe, string>
  declare utilisateurs: Table<Utilisateur, string>
  declare roles: Table<Role, string>
  declare mandats: Table<Mandat, string>
  declare coproprietes: Table<Copropriete, string>
  declare immeubles: Table<Immeuble, string>
  declare batiments: Table<Batiment, string>
  declare cages: Table<Cage, string>
  declare lots: Table<Lot, string>
  declare coproprietaires: Table<Coproprietaire, string>
  declare occupants: Table<Occupant, string>
  declare prestataires: Table<Prestataire, string>
  declare contrats: Table<Contrat, string>
  declare assurances: Table<Assurance, string>
  declare comptes: Table<Compte, string>
  declare exercices: Table<Exercice, string>
  declare journaux: Table<Journal, string>
  declare ecritures: Table<Ecriture, string>
  declare factures: Table<Facture, string>
  declare reglements: Table<Reglement, string>
  declare budgets: Table<Budget, string>
  declare appelsDeFonds: Table<AppelDeFonds, string>
  declare impayes: Table<Impaye, string>
  declare fondsTravaux: Table<FondsTravaux, string>
  declare banques: Table<Banque, string>
  declare rapprochements: Table<Rapprochement, string>
  declare ags: Table<Ag, string>
  declare resolutions: Table<Resolution, string>
  declare procurations: Table<Procuration, string>
  declare presences: Table<Presence, string>
  declare travaux: Table<Travaux, string>
  declare devis: Table<Devis, string>
  declare interventions: Table<Intervention, string>
  declare sinistres: Table<Sinistre, string>
  declare documents: Table<DocumentLocal, string>
  declare taches: Table<Tache, string>
  declare echeances: Table<EcheanceSuivi, string>
  declare notifications: Table<NotificationLocale, string>
  declare activityLog: Table<EntreeJournalActivite, string>
  declare changementsStatut: Table<ChangementStatut, string>
  declare planComptable: Table<PlanComptable, string>
  declare modelesCourrier: Table<ModeleCourrier, string>
  declare courriers: Table<Courrier, string>

  constructor() {
    super(NOM_BASE_LOCALE)
    this.version(1).stores({
      cabinets: 'id',
      societes: 'id, cabinetId',
      utilisateurs: 'id, roleId, email',
      roles: 'id',
      mandats: 'id, coproprieteId',
      coproprietes: 'id, code',
      immeubles: 'id, coproprieteId',
      batiments: 'id, immeubleId',
      cages: 'id, batimentId',
      lots: 'id, coproprieteId',
      coproprietaires: 'id, lotId',
      occupants: 'id, lotId',
      prestataires: 'id, nom',
      contrats: 'id, prestataireId, coproprieteId',
      assurances: 'id, coproprieteId',
      comptes: 'id, coproprieteId, numero',
      exercices: 'id, coproprieteId, annee',
      journaux: 'id, coproprieteId',
      ecritures: 'id, journalId, date',
      factures: 'id, prestataireId, coproprieteId',
      reglements: 'id, factureId, appelDeFondsId',
      budgets: 'id, coproprieteId, exerciceId',
      appelsDeFonds: 'id, coproprieteId',
      impayes: 'id, coproprietaireId',
      fondsTravaux: 'id, coproprieteId',
      banques: 'id, coproprieteId',
      rapprochements: 'id, bancaireId',
      ags: 'id, coproprieteId, date',
      resolutions: 'id, agId',
      procurations: 'id, agId, coproprietaireId',
      presences: 'id, agId, coproprietaireId',
      travaux: 'id, coproprieteId',
      devis: 'id, travauxId, prestataireId',
      interventions: 'id, coproprieteId, prestataireId',
      sinistres: 'id, coproprieteId',
      documents: 'id, entiteType, entiteId',
      taches: 'id, assigneId, due',
      echeances: 'id, coproprieteId, date',
      notifications: 'id, coproprieteId, date',
      activityLog: 'id, entite, entiteId, quand',
    })
    // Version 2 (intégration Gestéam, T12) : AJOUTE la table d'historique des statuts. Le bloc version(1) ci-dessus
    // n'est jamais modifié ; Dexie conserve les tables et les données existantes lors de la montée de version.
    // T20 : plan comptable (nomenclature qui génère les comptes ; ≠ `comptes`, les instances). Sans clé étrangère vers
    // la copropriété : praticable avant la décision D1.
    this.version(2).stores({
      changementsStatut: 'id, entiteType, entiteId, statutNouveau, dateEffet, courrierId, [entiteType+entiteId]',
      planComptable: 'id, code, source, nature, typeSru, horsService, [source+code]',
      // T30 : courrier, support de la preuve de notification, et son modèle (≠ documents).
      modelesCourrier: 'id, famille, libelle, contexte, formeEnvoi',
      courriers:
        'id, coproprieteId, mandatId, personneId, entrepriseId, modeleId, statut, formeEnvoi, dateDepot, dateAccuseReception, referenceDiffusion',
    })
  }
}

/**
 * Instance unique, créée au chargement du module comme dans la maquette : Dexie n'ouvre IndexedDB qu'au premier
 * accès à une table, la construction ne touche donc pas au navigateur (import serveur ou test sans IndexedDB possible).
 */
export const ajDb = new AdministrateurJudiciaireDb()
