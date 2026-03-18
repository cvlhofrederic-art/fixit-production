import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// ── Initie le flux OAuth2 Gmail ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Récupérer le token depuis query param (envoyé par le client)
  const token = searchParams.get('token')
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace('Bearer ', '') || token

  if (!bearerToken) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(bearerToken)
  if (error || !user || user.user_metadata?.role !== 'syndic') {
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
  // Generate a cryptographically stronger nonce
  const nonce = crypto.randomUUID()
  googleOAuthUrl.searchParams.set('state', `${user.id}:${nonce}`)

  // Store the nonce in Supabase so the callback can verify it
  await supabaseAdmin
    .from('syndic_oauth_tokens')
    .upsert({
      syndic_id: user.id,
      provider: 'gmail',
      oauth_nonce: nonce,
      oauth_nonce_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
      updated_at: new Date().toISOString(),
    }, { onConflict: 'syndic_id' })

  return NextResponse.redirect(googleOAuthUrl)
}
