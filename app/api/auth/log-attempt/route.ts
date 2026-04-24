import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit'
import { validateBody, loginAttemptSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

// POST /api/auth/log-attempt
// Enregistre les tentatives de connexion (succès/échec) pour audit sécurité
// Appelé côté client après signInWithPassword
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  // Rate limit strict : 10 tentatives de login / minute par IP
  if (!(await checkRateLimit(`login_attempt_${ip}`, 10, 60_000))) {
    return rateLimitResponse()
  }

  try {
    const body = await request.json()
    const v = validateBody(loginAttemptSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { email, success, role, reason } = v.data

    // Masquer l'email pour le log (RGPD)
    const maskedEmail = email.length > 5
      ? email.substring(0, 2) + '***' + email.substring(email.indexOf('@'))
      : '***'

    await auditLog(
      request,
      null, // userId unknown pour les échecs
      success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      'auth.users',
      undefined,
      {
        email: maskedEmail,
        success,
        role: role || 'unknown',
        reason: reason || undefined,
      },
    )

    // Lockout progressif avec backoff exponentiel
    // Palier 1 : 5 échecs en 1min → bloquer 1min
    // Palier 2 : 8 échecs en 5min → bloquer 5min
    // Palier 3 : 12 échecs en 15min → bloquer 15min
    // Palier 4 : 20 échecs en 1h → bloquer 1h
    if (!success) {
      const tier4 = await checkRateLimit(`login_block_1h_${ip}`, 20, 60 * 60_000)
      if (!tier4) {
        return NextResponse.json({
          logged: true,
          warning: 'account_locked',
          message: 'Trop de tentatives. Réessayez dans 1 heure.',
          retry_after: 3600,
        }, { status: 429 })
      }
      const tier3 = await checkRateLimit(`login_block_15m_${ip}`, 12, 15 * 60_000)
      if (!tier3) {
        return NextResponse.json({
          logged: true,
          warning: 'too_many_failures',
          message: 'Trop de tentatives. Réessayez dans 15 minutes.',
          retry_after: 900,
        }, { status: 429 })
      }
      const tier2 = await checkRateLimit(`login_block_5m_${ip}`, 8, 5 * 60_000)
      if (!tier2) {
        return NextResponse.json({
          logged: true,
          warning: 'too_many_failures',
          message: 'Trop de tentatives. Réessayez dans 5 minutes.',
          retry_after: 300,
        }, { status: 429 })
      }
      const tier1 = await checkRateLimit(`login_block_1m_${ip}`, 5, 60_000)
      if (!tier1) {
        return NextResponse.json({
          logged: true,
          warning: 'too_many_failures',
          message: 'Trop de tentatives. Réessayez dans 1 minute.',
          retry_after: 60,
        }, { status: 429 })
      }
    }

    return NextResponse.json({ logged: true })
  } catch (e) {
    // Non-critical — ne pas bloquer le flow d'auth
    logger.warn('[auth/log-attempt] Failed to log attempt:', e)
    return NextResponse.json({ logged: false }, { status: 200 })
  }
}
