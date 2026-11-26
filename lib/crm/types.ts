// ── CRM du secrétariat : valeurs fixes et formes des données ────────────────
// Module pur, sans dépendance : importable par le navigateur, les routes serveur et les tests.
// Les listes reprennent exactement les CHECK de supabase/migrations/20261122_crm_secretariat.sql
// (tests/migrations/crm_secretariat.execution.test.ts vérifie qu'elles ne divergent pas).

/**
 * Rôle du compte de la secrétaire (app_metadata.role, posé côté serveur seulement : il n'est pas dans
 * lib/auth/roles-auto-attribuables.ts). Il n'ouvre que le CRM ; le super admin y a accès aussi.
 */
export const ROLE_SECRETARIAT = 'secretariat'

/** Adresse de l'écran du CRM (route interne sans langue, comme le panneau admin ; barre finale : trailingSlash). */
export const CHEMIN_CRM = '/admin/crm/'

export const MOTIFS_CRM = ['devis', 'urgence', 'rdv', 'sav', 'info', 'reclamation', 'autre'] as const
export const CANAUX_CRM = ['appel', 'appel_manque', 'whatsapp', 'telephone', 'email', 'autre'] as const
export const PRIORITES_CRM = ['normale', 'urgente'] as const
export const STATUTS_CRM = ['nouvelle', 'en_cours', 'en_attente', 'resolue'] as const
export const TYPES_EVENEMENT_CRM = ['creation', 'statut', 'note', 'appel', 'message_entrant', 'message_sortant'] as const
export const LANGUES_CRM = ['fr', 'pt'] as const

export type MotifCrm = (typeof MOTIFS_CRM)[number]
export type CanalCrm = (typeof CANAUX_CRM)[number]
export type PrioriteCrm = (typeof PRIORITES_CRM)[number]
export type StatutCrm = (typeof STATUTS_CRM)[number]
export type TypeEvenementCrm = (typeof TYPES_EVENEMENT_CRM)[number]
export type LangueCrm = (typeof LANGUES_CRM)[number]

export interface ContactCrm {
  id: string
  nom: string
  telephone: string | null
  email: string | null
  ville: string
  langue: LangueCrm
  notes: string
  created_at: string
  updated_at: string
}

/** Contact résumé, joint à une demande dans les listes. */
export interface ContactResumeCrm {
  id: string
  nom: string
  telephone: string | null
}

export interface DemandeCrm {
  id: string
  numero: number
  contact_id: string | null
  titre: string
  description: string
  motif: MotifCrm
  canal: CanalCrm
  priorite: PrioriteCrm
  statut: StatutCrm
  rappel_le: string | null
  resolue_le: string | null
  created_at: string
  updated_at: string
  contact: ContactResumeCrm | null
}

export interface EvenementCrm {
  id: string
  demande_id: string | null
  contact_id: string | null
  type: TypeEvenementCrm
  contenu: string
  auteur_nom: string
  created_at: string
}

export interface CompteursCrm {
  aTraiterAujourdhui: number
  enRetard: number
  resoluesSemaine: number
}

/** Une demande avec la fiche complète du client et son historique (écran de détail). */
export interface DetailDemandeCrm {
  demande: DemandeCrm
  contact: ContactCrm | null
  evenements: EvenementCrm[]
}

/** Fiche retrouvée par son numéro, avec le nombre de demandes déjà enregistrées. */
export interface ContactTrouveCrm {
  contact: ContactCrm
  nbDemandes: number
}
