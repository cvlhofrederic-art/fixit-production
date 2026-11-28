// lib/equipe/session-invite.ts
//
// Connexion de l'invité d'une équipe pro au moment où il accepte son invitation (/api/pro/invite), comme dans les
// grands logiciels : il n'a pas à se reconnecter ensuite, et un compte existant n'est rattaché qu'après la preuve
// qu'il est le sien (son mot de passe actuel).
//
// Client Supabase anonyme sans session conservée, comme /api/auth/login : rien n'est écrit dans les cookies de la
// requête, les jetons sont rendus à la page, qui les pose elle-même (supabase.auth.setSession).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export interface SessionInvite {
  access_token: string
  refresh_token: string
  expires_in: number
}

/** Verdict sur le mot de passe d'un compte existant : « erreur » = le service n'a pas pu répondre (ni oui ni non). */
export type VerdictMotDePasse = 'valide' | 'refuse' | 'erreur'

function clientAnonyme(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Erreur d'identifiants (mauvais mot de passe, adresse non confirmée) : statut 400 de Supabase Auth. */
function refusDIdentifiants(erreur: { status?: number }): boolean {
  return erreur.status === 400
}

/**
 * Le mot de passe est-il celui du compte de cette adresse ? Vérifié par une connexion, aussitôt fermée : la session
 * ouverte pour l'invité vient après le rattachement (ouvrirSessionInvite), avec son nouveau rôle dans le jeton.
 */
export async function verifierMotDePasseDuCompte(email: string, motDePasse: string): Promise<VerdictMotDePasse> {
  try {
    const client = clientAnonyme()
    const { data, error } = await client.auth.signInWithPassword({ email, password: motDePasse })
    if (error) {
      if (refusDIdentifiants(error)) return 'refuse'
      logger.error('[PRO_INVITE] vérification du mot de passe impossible', { status: error.status, code: error.code })
      return 'erreur'
    }
    if (!data.session) return 'erreur'
    const { error: fermeture } = await client.auth.signOut({ scope: 'local' })
    if (fermeture) logger.warn('[PRO_INVITE] session de vérification non fermée', { message: fermeture.message })
    return 'valide'
  } catch (err) {
    logger.error('[PRO_INVITE] vérification du mot de passe impossible', err instanceof Error ? err.message : err)
    return 'erreur'
  }
}

/**
 * Session de l'invité une fois l'invitation acceptée (compte créé ou rattaché) : son jeton porte déjà le rôle et la
 * société. null si la connexion échoue : l'invitation reste acceptée, la page propose alors « Se connecter ».
 */
export async function ouvrirSessionInvite(email: string, motDePasse: string): Promise<SessionInvite | null> {
  try {
    const { data, error } = await clientAnonyme().auth.signInWithPassword({ email, password: motDePasse })
    if (error || !data.session) {
      logger.warn('[PRO_INVITE] session non ouverte après acceptation', { status: error?.status, code: error?.code })
      return null
    }
    const { access_token, refresh_token, expires_in } = data.session
    return { access_token, refresh_token, expires_in }
  } catch (err) {
    logger.warn('[PRO_INVITE] session non ouverte après acceptation', err instanceof Error ? err.message : err)
    return null
  }
}
