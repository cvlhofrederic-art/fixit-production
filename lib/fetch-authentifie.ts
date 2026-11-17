/**
 * fetch vers les routes /api authentifiées par l'en-tête `Authorization: Bearer` (lib/auth-helpers.ts :
 * `getAuthUser` ne lit jamais les cookies, le middleware n'authentifie pas /api).
 *
 * Lot 4 de l'analyse Sentry du 28/10/2026 : `/api/artisan-clients` répondait 401 « Non authentifié » sur le
 * dashboard pro connecté parce que deux appelants (AiChatBot à chaque chargement, sélecteur client du formulaire
 * BTP) envoyaient un `fetch` nu, sans jeton ; un 401 traité ne remonte pas dans Sentry, le bug était invisible.
 * Tous les appels authentifiés passent par ce wrapper, qui ajoute le jeton de la session courante.
 */
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-client'

/** Jeton d'accès de la session locale, ou null (déconnecté, ou lecture impossible). Ne lève jamais. */
export async function jetonSession(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/**
 * Comme `fetch`, avec `Authorization: Bearer <jeton>` et `Content-Type: application/json` (sauf FormData).
 * Sans jeton, l'appel part quand même : la route répond 401 et l'appelant l'affiche, au lieu d'un échec silencieux.
 */
export async function fetchAuthentifie(url: string, options: RequestInit = {}): Promise<Response> {
  const jeton = await jetonSession()
  if (!jeton) return fetch(url, options)
  return authFetch(url, jeton, options)
}
