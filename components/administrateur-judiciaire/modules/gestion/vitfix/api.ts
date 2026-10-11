'use client'

import type {
  DemandeEnvoiOrdre,
  MessageOrdrePrestataire,
  ReponseOrdresPrestataire,
} from '@/lib/administrateur-judiciaire/ordres-prestataire'

/**
 * Appels à /api/administrateur-judiciaire/ordres-prestataire (cookie de session, même origine) : ordres de service
 * envoyés aux prestataires Vitfix du cabinet. Ces appels écrivent en base même quand l'application est en mode
 * démonstration : l'ordre part réellement sur le compte du prestataire.
 */
const ROUTE = '/api/administrateur-judiciaire/ordres-prestataire'

/** Échec d'un appel : statut HTTP (0 : réseau injoignable) et code d'erreur renvoyé par la route. */
export class ErreurOrdrePrestataire extends Error {
  constructor(
    readonly statut: number,
    readonly code: string | null,
  ) {
    super(`Ordres prestataire indisponibles (HTTP ${statut}${code ? `, ${code}` : ''})`)
    this.name = 'ErreurOrdrePrestataire'
  }
}

async function appeler<T>(init?: RequestInit): Promise<T> {
  let reponse: Response
  try {
    reponse = await fetch(ROUTE, { cache: 'no-store', credentials: 'same-origin', ...init })
  } catch (erreur) {
    throw Object.assign(new ErreurOrdrePrestataire(0, 'reseau'), { cause: erreur })
  }
  const donnees = (await reponse.json().catch(() => null)) as (T & { error?: unknown }) | null
  if (!reponse.ok || !donnees) {
    throw new ErreurOrdrePrestataire(reponse.status, typeof donnees?.error === 'string' ? donnees.error : null)
  }
  return donnees
}

const enJson = (corps: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corps),
})

/** Prestataires du cabinet et ordres envoyés, avec leur suivi. */
export function lireOrdresPrestataire(): Promise<ReponseOrdresPrestataire> {
  return appeler<ReponseOrdresPrestataire>()
}

export interface ResultatEnvoiOrdre {
  mission_id: string
  conversation_id: string | null
  notification: boolean
}

/** Envoie l'ordre de service au compte Vitfix du prestataire. */
export function envoyerOrdrePrestataire(demande: DemandeEnvoiOrdre): Promise<ResultatEnvoiOrdre> {
  return appeler<ResultatEnvoiOrdre>(enJson({ action: 'envoyer', ...demande }))
}

/** Réponse de l'administrateur dans le fil de l'ordre. */
export async function repondreOrdrePrestataire(missionId: string, content: string): Promise<MessageOrdrePrestataire> {
  const { message } = await appeler<{ message: MessageOrdrePrestataire }>(enJson({ action: 'repondre', mission_id: missionId, content }))
  return message
}

/** Texte affiché pour un échec, selon la réponse de la route. */
export function messageErreurOrdre(erreur: unknown): string {
  if (erreur instanceof ErreurOrdrePrestataire) {
    if (erreur.statut === 0) return 'Connexion impossible : vérifiez le réseau, puis réessayez.'
    if (erreur.statut === 401) {
      return 'Session super admin ou syndic requise. Si la vue prestataire est active, revenez en super admin : le suivi reprendra tout seul.'
    }
    if (erreur.statut === 403) return 'Ce compte n’est rattaché à aucun cabinet : l’envoi aux prestataires Vitfix est indisponible.'
    if (erreur.code === 'prestataire_sans_compte') return 'Ce prestataire n’a pas de compte Vitfix : l’ordre ne peut pas lui être transmis.'
    if (erreur.code === 'prestataire_introuvable') return 'Prestataire introuvable dans le cabinet : rafraîchissez la liste.'
    if (erreur.code === 'ordre_introuvable') return 'Ordre introuvable : rafraîchissez le suivi.'
    if (erreur.code === 'livraison_impossible') return 'L’ordre n’a pas pu être livré au prestataire. Rien n’a été enregistré : réessayez.'
    if (erreur.statut === 429) return 'Trop de demandes en peu de temps : réessayez dans une minute.'
    if (erreur.statut === 400) return 'Champs incomplets ou invalides : vérifiez le formulaire.'
  }
  return 'Service momentanément indisponible. Réessayez dans un instant.'
}
