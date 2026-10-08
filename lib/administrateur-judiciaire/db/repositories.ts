import { creerRepository, type Repository } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type Ag, type Courrier } from '@/lib/administrateur-judiciaire/db/schema'

/**
 * Un repository par table, créé une seule fois au chargement du module (même ordre que la maquette).
 * Les repositories sans usage dans la maquette sont exportés pour complétude ; leur création n'a aucun effet de bord.
 */

/** Sans usage dans la maquette. */
export const repoCabinets = creerRepository(ajDb.cabinets, 'cabinets')
/** Sans usage dans la maquette. */
export const repoSocietes = creerRepository(ajDb.societes, 'societes')
/** Sans usage dans la maquette. */
export const repoUtilisateurs = creerRepository(ajDb.utilisateurs, 'utilisateurs')
/** Sans usage dans la maquette. */
export const repoRoles = creerRepository(ajDb.roles, 'roles')
/** Store des données et seed. */
export const repoMandats = creerRepository(ajDb.mandats, 'mandats')
/** Store des données et seed (le seed impose les ids C1 à C4). */
export const repoCoproprietes = creerRepository(ajDb.coproprietes, 'coproprietes')
/** Sans usage dans la maquette. */
export const repoImmeubles = creerRepository(ajDb.immeubles, 'immeubles')
/** Sans usage dans la maquette. */
export const repoBatiments = creerRepository(ajDb.batiments, 'batiments')
/** Sans usage dans la maquette. */
export const repoCages = creerRepository(ajDb.cages, 'cages')
/** Store des données et seed. */
export const repoLots = creerRepository(ajDb.lots, 'lots')
/** Store des données et seed. */
export const repoCoproprietaires = creerRepository(ajDb.coproprietaires, 'coproprietaires')
/** Sans usage dans la maquette. */
export const repoOccupants = creerRepository(ajDb.occupants, 'occupants')
/** Store des données et seed. */
export const repoPrestataires = creerRepository(ajDb.prestataires, 'prestataires')
/** Lecture seule (store des données). */
export const repoContrats = creerRepository(ajDb.contrats, 'contrats')
/** Sans usage dans la maquette. */
export const repoAssurances = creerRepository(ajDb.assurances, 'assurances')
/** Sans usage dans la maquette. */
export const repoComptes = creerRepository(ajDb.comptes, 'comptes')
/** Sans usage dans la maquette. */
export const repoExercices = creerRepository(ajDb.exercices, 'exercices')
/** Créé à la volée par importerReleve. */
export const repoJournaux = creerRepository(ajDb.journaux, 'journaux')
/** Écrit par importerReleve et imputerEncaissement. */
export const repoEcritures = creerRepository(ajDb.ecritures, 'ecritures')
/** Sans usage dans la maquette. */
export const repoFactures = creerRepository(ajDb.factures, 'factures')
/** Sans usage dans la maquette. */
export const repoReglements = creerRepository(ajDb.reglements, 'reglements')
/** Sans usage dans la maquette. */
export const repoBudgets = creerRepository(ajDb.budgets, 'budgets')
/** Sans usage dans la maquette. */
export const repoAppelsDeFonds = creerRepository(ajDb.appelsDeFonds, 'appelsDeFonds')
/** Écrit par imputerEncaissement et avancerRecouvrement. */
export const repoImpayes = creerRepository(ajDb.impayes, 'impayes')
/** Sans usage dans la maquette. */
export const repoFondsTravaux = creerRepository(ajDb.fondsTravaux, 'fondsTravaux')
/** Sans usage dans la maquette. */
export const repoBanques = creerRepository(ajDb.banques, 'banques')
/** Sans usage dans la maquette. */
export const repoRapprochements = creerRepository(ajDb.rapprochements, 'rapprochements')
const repoAgsSansGarde = creerRepository(ajDb.ags, 'ags')

/**
 * Assemblées générales. Le statut est verrouillé (T12) : une AG se crée au statut « Projet », et son statut ne change
 * ensuite QUE par changerStatutAg (db/statut-assemblee.ts), qui l'historise avec sa date d'effet. Les autres champs
 * se modifient normalement.
 */
export const repoAgs: Repository<Ag> = {
  ...repoAgsSansGarde,
  async create(donnees, options) {
    if (donnees.statut !== 'Projet')
      throw new Error(
        `Une assemblée se crée au statut « Projet » (reçu : « ${donnees.statut} ») ; son statut change ensuite par changerStatutAg.`,
      )
    return repoAgsSansGarde.create(donnees, options)
  },
  async update(id, patch, options) {
    if ('statut' in patch)
      throw new Error("Le statut d'une assemblée ne se modifie que par changerStatutAg (historisation obligatoire).")
    return repoAgsSansGarde.update(id, patch, options)
  },
}
/** Sans usage dans la maquette. */
export const repoResolutions = creerRepository(ajDb.resolutions, 'resolutions')
/** Sans usage dans la maquette. */
export const repoProcurations = creerRepository(ajDb.procurations, 'procurations')
/** Sans usage dans la maquette. */
export const repoPresences = creerRepository(ajDb.presences, 'presences')
/** Sans usage dans la maquette. */
export const repoTravaux = creerRepository(ajDb.travaux, 'travaux')
/** Sans usage dans la maquette. */
export const repoDevis = creerRepository(ajDb.devis, 'devis')
/** Sans usage dans la maquette. */
export const repoInterventions = creerRepository(ajDb.interventions, 'interventions')
/** Lecture seule (store des données). */
export const repoSinistres = creerRepository(ajDb.sinistres, 'sinistres')
/**
 * Pièces : ordonnance source d'un mandat, et journal append-only des pièces de reprise
 * (entiteType « reprise », type = clé ou « retrait:clé »).
 */
export const repoDocuments = creerRepository(ajDb.documents, 'documents')
/** Lecture (store des données), écriture par le seed. */
export const repoTaches = creerRepository(ajDb.taches, 'taches')
/** Lecture (store des données), écriture par le seed. */
export const repoEcheances = creerRepository(ajDb.echeances, 'echeances')
/** Écrit par creerNote (kind « note ») et par le seed. */
export const repoNotifications = creerRepository(ajDb.notifications, 'notifications')

/** Modèles de courrier (T30). Aucun modèle n'est amorcé en base. */
export const repoModelesCourrier = creerRepository(ajDb.modelesCourrier, 'modelesCourrier')

const repoCourriersSansGarde = creerRepository(ajDb.courriers, 'courriers')

/**
 * Courriers (T30). La forme d'envoi est figée à la création (copie de celle du modèle, voir db/courriers.ts) : toute
 * modification ultérieure de `formeEnvoi` est refusée, sinon un envoi pourrait cesser — ou devenir — un AR après coup.
 */
export const repoCourriers: Repository<Courrier> = {
  ...repoCourriersSansGarde,
  async update(id, patch, options) {
    if ('formeEnvoi' in patch) throw new Error("La forme d'envoi d'un courrier est figée à sa création.")
    return repoCourriersSansGarde.update(id, patch, options)
  },
}
