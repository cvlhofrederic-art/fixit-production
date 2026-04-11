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

    // Vérifier le nombre d'échecs récents pour cette IP (lockout soft)
    // Si > 5 échecs en 15 minutes, signaler
    if (!success) {
      const lockoutCheck = await checkRateLimit(`login_failed_${ip}`, 5, 15 * 60_000)
      if (!lockoutCheck) {
        return NextResponse.json({
          logged: true,
          warning: 'too_many_failures',
          message: 'Trop de tentatives échouées. Veuillez patienter avant de réessayer.',
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
