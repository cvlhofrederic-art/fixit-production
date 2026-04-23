import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const runtime = 'nodejs'

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
})

/**
 * POST /api/auth/login
 * Server-side login with dual rate limiting (IP + email).
 * Replaces client-side signInWithPassword + log-attempt pattern.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  // ── Rate limit layer 1: 5 attempts per minute per IP ──
  if (!(await checkRateLimit(`login_ip_${ip}`, 5, 60_000))) {
    return rateLimitResponse()
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Entrée invalide' }, { status: 400 })
  }

  const { email, password } = parsed.data

  // ── Rate limit layer 2: 10 attempts per 15 minutes per email ──
  const emailKey = `login_email_${email.toLowerCase().trim()}`
  if (!(await checkRateLimit(emailKey, 10, 15 * 60_000))) {
    return rateLimitResponse()
  }

  // Masquer l'email pour les logs (RGPD)
  const maskedEmail = email.length > 5
    ? email.substring(0, 2) + '***' + email.substring(email.indexOf('@'))
    : '***'

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      // Log failed attempt
      await auditLog(
        request,
        null,
        'LOGIN_FAILED',
        'auth.users',
        undefined,
        { email: maskedEmail, reason: error?.message || 'no_session' },
      ).catch(() => {})

      logger.warn(`[auth/login] Failed login for ${maskedEmail} from ${ip}`)

      // Generic message to avoid user enumeration
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Log successful attempt
    await auditLog(
      request,
      data.user.id,
      'LOGIN_SUCCESS',
      'auth.users',
      undefined,
      { email: maskedEmail, role: data.user.user_metadata?.role || 'unknown' },
    ).catch(() => {})

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role,
      },
    })
  } catch (e) {
    logger.error('[auth/login] Unexpected error:', e)
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    )
  }
}
