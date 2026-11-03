/**
 * Utilisateur Sentry côté navigateur : identifiant seul, jamais d'e-mail ni de nom (RGPD).
 *
 * Lot 9 de l'analyse Sentry du 28/10/2026 : toutes les issues affichaient « 0 utilisateur » parce que
 * `Sentry.setUser` n'était jamais appelé. L'identifiant est posé dès que la session est connue (INITIAL_SESSION,
 * SIGNED_IN, TOKEN_REFRESHED) et retiré à la déconnexion (SIGNED_OUT ou session absente). Le callback est
 * synchrone : aucun appel Supabase dans un callback onAuthStateChange (interblocage documenté par Supabase).
 */
import * as Sentry from '@sentry/nextjs'

export interface SessionMinimale {
  user?: { id?: string | null } | null
}

export interface AuthEvenements {
  onAuthStateChange(callback: (event: string, session: SessionMinimale | null) => void): unknown
}

/** Identifiant à transmettre à Sentry pour un événement d'auth, ou null (déconnexion, session inconnue). */
export function utilisateurSentryPourEvenement(event: string, session: SessionMinimale | null): { id: string } | null {
  if (event === 'SIGNED_OUT') return null
  const id = session?.user?.id
  return typeof id === 'string' && id.length > 0 ? { id } : null
}

/** Abonne Sentry aux événements d'auth. Ne lève jamais (l'observabilité ne casse pas l'application). */
export function lierUtilisateurSentry(auth: AuthEvenements): void {
  try {
    auth.onAuthStateChange((event, session) => {
      Sentry.setUser(utilisateurSentryPourEvenement(event, session))
    })
  } catch (erreur) {
    console.warn('[Sentry] identifiant utilisateur non lié :', erreur)
  }
}
