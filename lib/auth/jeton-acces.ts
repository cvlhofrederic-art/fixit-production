/**
 * Jeton d'accès de l'utilisateur connecté, sans reprendre le verrou d'auth à chaque appel.
 *
 * Les appels authentifiés des tableaux de bord (storage-sync, /api/btp, messagerie, notifications…) faisaient
 * chacun un getSession(), donc une prise du verrou d'auth partagé entre onglets (lot 1 Sentry, 28/10/2026). Ici la
 * session est tenue à jour par les événements d'auth (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT) et
 * relue seulement quand le jeton approche de son expiration : getSession() le rafraîchit alors.
 */
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { lireSessionSure } from './session-navigateur'

/** Marge avant l'expiration du jeton (secondes) : au-delà, on relit la session pour obtenir un jeton frais. */
export const MARGE_EXPIRATION_S = 60

let sessionCourante: Session | null = null
let abonne = false

function sAbonner(): void {
  if (abonne) return
  abonne = true
  try {
    // Callback synchrone : jamais d'appel Supabase ici (interblocage documenté par Supabase).
    supabase.auth.onAuthStateChange((_event, session) => {
      sessionCourante = session ?? null
    })
  } catch (erreur) {
    console.warn('[auth] abonnement aux événements de session impossible, la session sera relue à chaque appel :', erreur)
  }
}

/** Jeton présent et encore valable `margeS` secondes (une session sans `expires_at` est tenue pour valable). */
export function jetonEncoreValable(session: Session | null, margeS: number = MARGE_EXPIRATION_S): session is Session {
  if (!session?.access_token) return false
  if (typeof session.expires_at !== 'number') return true
  return session.expires_at - margeS > Date.now() / 1000
}

export interface JetonAcces {
  jeton: string | null
  /** true : la session n'a pas pu être lue (verrou abandonné, délai, réseau) ; ne pas en déduire une déconnexion. */
  indisponible: boolean
}

export async function lireJetonAcces(): Promise<JetonAcces> {
  sAbonner()
  if (jetonEncoreValable(sessionCourante)) return { jeton: sessionCourante.access_token, indisponible: false }
  const lecture = await lireSessionSure(supabase.auth)
  if (!lecture.indisponible) sessionCourante = lecture.session
  return { jeton: lecture.session?.access_token ?? null, indisponible: lecture.indisponible }
}

/** Jeton d'accès courant, ou null (déconnecté ou session inconnue). */
export async function jetonAcces(): Promise<string | null> {
  return (await lireJetonAcces()).jeton
}

/** Tests : oublie la session en cache et l'abonnement. */
export function reinitialiserJetonAcces(): void {
  sessionCourante = null
  abonne = false
}
