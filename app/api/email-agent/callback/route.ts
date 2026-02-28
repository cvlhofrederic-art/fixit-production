import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Reçoit le code OAuth Google, échange en tokens, stocke dans Supabase ─────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // = syndic_id:nonce
  const error = searchParams.get('error')

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/syndic/dashboard?email_error=${error || 'missing_code'}`)
  }

  // CSRF: state = syndic_id:nonce — extract the real syndic_id
  const syndicId = state.split(':')[0]
  if (!syndicId || !/^[0-9a-f-]{36}$/i.test(syndicId)) {
    return NextResponse.redirect(`${APP_URL}/syndic/dashboard?email_error=invalid_state`)
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

  try {
    // 1. Échanger le code contre des tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/email-agent/callback`,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token exchange error:', tokenData)
      return NextResponse.redirect(`${APP_URL}/syndic/dashboard?email_error=token_exchange`)
    }

    // 2. Récupérer l'email du compte Gmail connecté
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()
    const emailCompte = profile.email || 'Inconnu'

    // 3. Calculer l'expiration du token
    const tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()

    // 4. Stocker les tokens dans Supabase (upsert)
    const { error: upsertError } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .upsert({
        syndic_id: syndicId,
        provider: 'gmail',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || '',
        token_expiry: tokenExpiry,
        email_compte: emailCompte,
        scope: tokenData.scope || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'syndic_id' })

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError)
      return NextResponse.redirect(`${APP_URL}/syndic/dashboard?email_error=db_error`)
    }

    // 5. Lancer une première analyse immédiate
    fetch(`${APP_URL}/api/email-agent/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syndic_id: syndicId, first_run: true }),
    }).catch(() => {}) // Fire and forget

    return NextResponse.redirect(`${APP_URL}/syndic/dashboard?email_connected=true&email=${encodeURIComponent(emailCompte)}`)

  } catch (err: any) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${APP_URL}/syndic/dashboard?email_error=server_error`)
  }
}
