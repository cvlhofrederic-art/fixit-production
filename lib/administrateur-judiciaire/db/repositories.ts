import { creerRepository, type Repository } from '@/lib/administrateur-judiciaire/db/repository'
import {
  ajDb,
  type Ag,
  type Courrier,
  type IdentiteEnregistree,
  type PieceTraitementEnregistree,
} from '@/lib/administrateur-judiciaire/db/schema'

/**
 * Un repository par table, créé une seule fois au chargement du module (même ordre que la maquette).
 * Les repositories sans usage dans la maquette sont exportés pour complétude ; leur création n'a aucun effet de bord.
 */

/** Réglage du cabinet (mode de tenue des comptes), écrit par db/comptes-bancaires.ts. */
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
/** Comptes bancaires des copropriétés, écrits par db/comptes-bancaires.ts (écran « Banque et recouvrement »). */
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
/** Store des données (lecture) ; écrit par enregistrerSinistre (db/sinistres.ts, écran Sinistres en mode réel). */
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

// ─── D1 et D2 (version 3) ─────────────────────────────────────────────────────────────────────────────────────────
// Les échéances d'appel (clé composée [coproprieteId+id]) n'ont pas de repository : db/echeances-appel.ts.
// Les encaissements des copropriétaires (version 4) non plus : ils s'écrivent avec leur pièce, db/encaissements.ts.
// Les relevés importés (version 5) non plus : ils s'écrivent avec les lignes de leur relevé, db/releves-importes.ts.

const repoIdentitesSansGarde = creerRepository(ajDb.identites, 'identites')

/** Champs de la case « professionnel » (J78), écrits par enregistrerQualiteProfessionnelle seulement. */
const CHAMPS_QUALITE_PROFESSIONNELLE = ['professionnel', 'historiqueProfessionnel'] as const

function refuserQualiteProfessionnelle(donnees: object): void {
  const champs = CHAMPS_QUALITE_PROFESSIONNELLE.filter((champ) => champ in donnees)
  if (champs.length > 0)
    throw new Error(
      `Identité : ${champs.join(', ')} ne s'écrit que par enregistrerQualiteProfessionnelle (db/identites.ts) : case datée, cochée sur justification écrite (J78).`,
    )
}

/**
 * Identités (D2). La case « professionnel » et ses états datés (J78) ne s'écrivent que par enregistrerQualiteProfessionnelle
 * (db/identites.ts) : création et modification qui les portent sont refusées. La modification se fait dans une
 * transaction (lecture puis écriture), sérialisée avec enregistrerQualiteProfessionnelle : une modification concurrente
 * de la fiche ne réécrit jamais la ligne lue avant l'ajout d'un état daté.
 */
export const repoIdentites: Repository<IdentiteEnregistree> = {
  ...repoIdentitesSansGarde,
  async create(donnees, options) {
    refuserQualiteProfessionnelle(donnees)
    return repoIdentitesSansGarde.create(donnees, options)
  },
  async update(id, patch, options) {
    refuserQualiteProfessionnelle(patch)
    return ajDb.transaction('rw', ajDb.identites, ajDb.activityLog, () => repoIdentitesSansGarde.update(id, patch, options))
  },
}

/** Positions (D2). Écrites par les fonctions du domaine (creerPosition, muterLot) et par la migration des fiches. */
export const repoPositions = creerRepository(ajDb.positions, 'positions')
/** Comptes copropriétaires (D2, compte 450 à série). Écrits par le domaine (creerCompteCoproprietaire) et la migration. */
export const repoComptesCoproprietaires = creerRepository(ajDb.comptesCoproprietaires, 'comptesCoproprietaires')
/** Clés de répartition du syndicat. Écrites par le domaine (creerCleRepartition). */
export const repoClesRepartition = creerRepository(ajDb.clesRepartition, 'clesRepartition')

const repoTraitementsSansGarde = creerRepository(ajDb.traitements, 'traitements')

/** Champs d'une pièce figés après son enregistrement : seules les fonctions de db/traitements.ts les écrivent. */
const CHAMPS_FIGES_PIECE = [
  'numero',
  'famille',
  'date',
  'coproprieteId',
  'mandatId',
  'nbLignes',
  'statut',
  'parametres',
  'traitement',
  'annuleePar',
] as const

/**
 * Pièces du journal des traitements (D1), en lecture. Une pièce s'enregistre par enregistrerPieceTraitement (numéro de
 * la séquence du cabinet, segment du syndicat), son statut avance par changerStatutTraitement et elle s'annule par une
 * écriture contraire (annulerPieceTraitement, R6) : db/traitements.ts. Le repository refuse la création, toute
 * modification d'un champ de la pièce et la suppression.
 */
export const repoTraitements: Repository<PieceTraitementEnregistree> = {
  ...repoTraitementsSansGarde,
  async create() {
    throw new Error(
      'Une pièce de traitement s’enregistre par enregistrerPieceTraitement (db/traitements.ts) : numéro de la séquence du cabinet, segment du syndicat.',
    )
  },
  async update(id, patch, options) {
    const figes = CHAMPS_FIGES_PIECE.filter((champ) => champ in patch)
    if (figes.length > 0)
      throw new Error(
        `Pièce de traitement : ${figes.join(', ')} figé(s) ; le statut change par changerStatutTraitement, l'annulation par une écriture contraire (annulerPieceTraitement).`,
      )
    return repoTraitementsSansGarde.update(id, patch, options)
  },
  async remove() {
    throw new Error('Une pièce de traitement ne se supprime pas : elle s’annule par une écriture contraire (R6 ; annulerPieceTraitement).')
  },
}
