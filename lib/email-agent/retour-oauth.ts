/**
 * Retour OAuth commun aux fournisseurs de boîte (routes /api/email-agent/callback pour
 * Google, /api/email-agent/callback/microsoft pour Microsoft) : vérification du state
 * « <id utilisateur>:<nonce> » rangé par /api/email-agent/connect, échange du code,
 * enregistrement des jetons (provider compris), effacement du nonce, puis première relève
 * du cabinet après la réponse.
 */

import { NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { setEncryptedToken } from '@/lib/oauth/tokens'
import { ErreurFournisseur, urlApplication, type FournisseurBoite, type JetonsFournisseur } from './fournisseurs'

const RE_UUID = /^[0-9a-f-]{36}$/i

/** Redirection vers le tableau de bord Syndic v54 (écran « E-mails Fixy » au retour). */
export function redirectionTableauDeBord(origine: string, params: Record<string, string>): NextResponse {
  const base = urlApplication() || origine
  return NextResponse.redirect(`${base}/syndic/v54?${new URLSearchParams(params).toString()}`)
}

export interface RetourOAuth {
  fournisseur: FournisseurBoite
  code?: string
  state?: string
  /** Code court d'erreur renvoyé par le fournisseur (déjà normalisé). */
  codeErreur?: string
  /** Origine de la requête : repli de redirection si NEXT_PUBLIC_APP_URL est absent. */
  origine: string
}

export async function traiterRetourOAuth({ fournisseur, code, state, codeErreur, origine }: RetourOAuth): Promise<NextResponse> {
  const prefixe = `[email-agent/callback/${fournisseur.id}]`
  const vers = (params: Record<string, string>) => redirectionTableauDeBord(origine, params)

  if (codeErreur || !code || !state) {
    return vers({ email_error: codeErreur || 'missing_code' })
  }

  // CSRF : state = syndic_id:nonce
  const [syndicId, nonce] = state.split(':')
  if (!syndicId || !RE_UUID.test(syndicId) || !nonce) {
    return vers({ email_error: 'invalid_state' })
  }

  // Le nonce doit être celui rangé par la route connect (10 min).
  const { data: ligne } = await supabaseAdmin
    .from('syndic_oauth_tokens')
    .select('oauth_nonce, oauth_nonce_expires_at')
    .eq('syndic_id', syndicId)
    .single()

  if (!ligne?.oauth_nonce || ligne.oauth_nonce !== nonce) {
    logger.error(`${prefixe} OAuth CSRF : nonce différent`, { syndicId })
    return vers({ email_error: 'csrf_failed' })
  }
  if (ligne.oauth_nonce_expires_at && new Date(ligne.oauth_nonce_expires_at) < new Date()) {
    logger.error(`${prefixe} OAuth CSRF : nonce expiré`, { syndicId })
    return vers({ email_error: 'state_expired' })
  }

  const manquants = fournisseur.configurationManquante()
  if (manquants.length > 0) {
    logger.error(`${prefixe} configuration absente`, { manquants })
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // 1. Échanger le code contre des jetons (+ adresse de la boîte)
    let jetons: JetonsFournisseur
    try {
      jetons = await fournisseur.echangerCode(code)
    } catch (err) {
      if (err instanceof ErreurFournisseur) {
        logger.error(`${prefixe} échange du code refusé`, { code: err.code, ...err.details })
        return vers({ email_error: err.code })
      }
      throw err
    }
    const emailCompte = jetons.email || 'Inconnu'

    // 2a. Écriture chiffrée (Plan B). Non bloquante : la clé passe par set_config(is_local)
    // dans une requête séparée de l'appel RPC, ce qui échoue en production ; les colonnes
    // en clair (2b) sont la source de vérité lue par poll.
    try {
      await setEncryptedToken(supabaseAdmin, {
        syndic_id: syndicId,
        access_token: jetons.accessToken,
        refresh_token: jetons.refreshToken || '',
        expires_at: jetons.expiresAt,
      })
    } catch (encryptErr) {
      logger.warn(`${prefixe} setEncryptedToken indisponible, jetons gardés en colonnes en clair`, {
        erreur: encryptErr instanceof Error ? encryptErr.message.slice(0, 200) : String(encryptErr).slice(0, 200),
      })
    }

    // 2b. Colonnes en clair + fournisseur ; le nonce est effacé.
    const { error: upsertError } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .upsert({
        syndic_id: syndicId,
        provider: fournisseur.id,
        access_token: jetons.accessToken,
        refresh_token: jetons.refreshToken || '',
        token_expiry: jetons.expiresAt,
        email_compte: emailCompte,
        scope: jetons.scope,
        oauth_nonce: null,
        oauth_nonce_expires_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'syndic_id' })

    if (upsertError) {
      logger.error(`${prefixe} enregistrement des jetons`, upsertError)
      return vers({ email_error: 'db_error' })
    }

    // 3. Première relève (30 jours) pour CE cabinet seulement, après l'envoi de la
    // réponse : after() s'appuie sur ctx.waitUntil du Worker (un fetch « fire-and-forget »
    // pouvait être annulé dès la redirection — cf. webhook ALF-1).
    declencherPremiereReleve(syndicId, prefixe)

    return vers({ email_connected: 'true', email: emailCompte, email_provider: fournisseur.id })
  } catch (err: unknown) {
    logger.error(`${prefixe} erreur OAuth`, err)
    return vers({ email_error: 'server_error' })
  }
}

/** Première relève (30 jours) du cabinet après la réponse ; aussi utilisée par connect-imap. */
export function declencherPremiereReleve(syndicId: string, prefixe: string): void {
  const appUrl = urlApplication()
  const internalToken = process.env.INTERNAL_POLL_TOKEN || ''
  if (!appUrl || !internalToken) {
    logger.warn(`${prefixe} NEXT_PUBLIC_APP_URL ou INTERNAL_POLL_TOKEN absent : première relève non lancée`)
    return
  }
  try {
    after(async () => {
      try {
        const pollRes = await fetch(`${appUrl}/api/email-agent/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-trigger': internalToken },
          body: JSON.stringify({ syndic_id: syndicId, first_run: true }),
        })
        if (!pollRes.ok) logger.warn(`${prefixe} première relève non-ok`, { status: pollRes.status })
      } catch (err: unknown) {
        logger.warn(`${prefixe} première relève échouée`, { erreur: err instanceof Error ? err.message : String(err) })
      }
    })
  } catch (err: unknown) {
    logger.warn(`${prefixe} after() indisponible, première relève non lancée`, { erreur: err instanceof Error ? err.message : String(err) })
  }
}
