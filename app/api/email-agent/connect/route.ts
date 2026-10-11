import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getUserRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { validateBody, emailAgentConnectSchema } from '@/lib/validation'

/**
 * Rôles autorisés à connecter la boîte Gmail du cabinet : le syndic titulaire et le
 * super admin (dont le cabinet est son propre compte, resolveCabinetId). Les tokens
 * sont rangés par syndic_id = id du compte, que lisent poll, Alfredo et send-response.
 */
const ROLES_CONNEXION_GMAIL = new Set(['syndic', 'super_admin'])

// ── Initie le flux OAuth2 Gmail ──────────────────────────────────────────────
// Réponse : redirection vers Google, ou { url } avec ?format=json (le tableau de bord
// appelle la route avec l'en-tête Authorization et redirige lui-même : le jeton de
// session ne passe pas dans l'URL).
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const v = validateBody(emailAgentConnectSchema, params)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

    // Jeton : en-tête Authorization (tableau de bord v54) ou ?token= (ancien bouton).
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.replace('Bearer ', '') || v.data.token

    if (!bearerToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(bearerToken)
    if (error || !user || !ROLES_CONNEXION_GMAIL.has(getUserRole(user))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google OAuth non configuré' }, { status: 500 })
    }

    const googleOAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    googleOAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    googleOAuthUrl.searchParams.set('redirect_uri', `${APP_URL}/api/email-agent/callback`)
    googleOAuthUrl.searchParams.set('response_type', 'code')
    googleOAuthUrl.searchParams.set('scope', [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '))
    googleOAuthUrl.searchParams.set('access_type', 'offline')
    googleOAuthUrl.searchParams.set('prompt', 'consent') // Force refresh_token
    // CSRF protection: state = syndic_id:random_nonce
    const nonce = crypto.randomUUID()
    googleOAuthUrl.searchParams.set('state', `${user.id}:${nonce}`)

    // Nonce rangé en base pour que le callback le vérifie (10 min). Première connexion :
    // la ligne n'existe pas et access_token / token_expiry sont NOT NULL → ligne créée
    // avec des valeurs vides que le callback remplace. Ligne existante (reconnexion) :
    // seul le nonce change, les tokens en place ne sont pas écrasés.
    const maintenant = new Date().toISOString()
    const nonceExpire = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { data: existante, error: lectureErr } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .select('syndic_id')
      .eq('syndic_id', user.id)
      .maybeSingle()
    if (lectureErr) {
      logger.error('[email-agent/connect] lecture syndic_oauth_tokens', lectureErr)
      return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }
    const { error: ecritureErr } = existante
      ? await supabaseAdmin
          .from('syndic_oauth_tokens')
          .update({ oauth_nonce: nonce, oauth_nonce_expires_at: nonceExpire, updated_at: maintenant })
          .eq('syndic_id', user.id)
      : await supabaseAdmin
          .from('syndic_oauth_tokens')
          .insert({
            syndic_id: user.id,
            provider: 'gmail',
            access_token: '',
            token_expiry: maintenant,
            oauth_nonce: nonce,
            oauth_nonce_expires_at: nonceExpire,
            updated_at: maintenant,
          })
    if (ecritureErr) {
      logger.error('[email-agent/connect] écriture du nonce', ecritureErr)
      return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }

    if (request.nextUrl.searchParams.get('format') === 'json') {
      return NextResponse.json({ url: googleOAuthUrl.toString() })
    }
    return NextResponse.redirect(googleOAuthUrl)
  } catch (err) {
    logger.error('[email-agent/connect/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
