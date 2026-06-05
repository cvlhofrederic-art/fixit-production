// ── API Route : Simulateur de travaux IA — Dispatcher V1/V2 ──
// POST /api/simulateur-travaux
// Body: { messages: [{role, content}], userId?: string }

import { NextRequest } from 'next/server'
import { validateBody, simulateurTravauxSchema } from '@/lib/validation'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { resolveExperimentArm } from './feature-flag'
import { handleV1 } from './route-v1'
import { handleV2 } from './route-v2'

export const maxDuration = 30
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const ip = getClientIP(req)
  if (!(await checkRateLimit(`sim_travaux_${ip}`, 10, 60_000))) return rateLimitResponse()

  try {
    const body = await req.json()
    const v = validateBody(simulateurTravauxSchema, body)
    if (!v.success) return Response.json({ error: v.error }, { status: 400 })
    const { messages } = v.data

    const userId = (user as { id?: string }).id
    const arm = resolveExperimentArm(req, userId)

    // Extrait le contexte profil du client connecté pour éviter au LLM de
    // redemander code postal / ville déjà saisis dans son compte. Source :
    // user.user_metadata mis à jour via ClientProfileSection.
    const userMeta = (user as { user_metadata?: Record<string, unknown> }).user_metadata ?? {}
    const userContext = {
      postalCode: typeof userMeta.postal_code === 'string' && userMeta.postal_code.trim() ? userMeta.postal_code.trim() : undefined,
      city: typeof userMeta.city === 'string' && userMeta.city.trim() ? userMeta.city.trim() : undefined,
      fullName: typeof userMeta.full_name === 'string' && userMeta.full_name.trim() ? userMeta.full_name.trim() : undefined,
    }

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
    if (arm.setBucketCookie) {
      baseHeaders['Set-Cookie'] = `${arm.setBucketCookie.name}=${arm.setBucketCookie.value}; Path=/; Max-Age=${arm.setBucketCookie.maxAge}; HttpOnly; SameSite=Lax; Secure`
    }

    const response = arm.arm === 'v2'
      ? await handleV2(messages, { userId, userContext, headers: baseHeaders })
      : await handleV1(messages)

    if (arm.setBucketCookie && !response.headers.get('Set-Cookie')) {
      response.headers.set('Set-Cookie', baseHeaders['Set-Cookie'])
    }
    return response
  } catch (err) {
    console.error('[simulateur-travaux] Error:', err)
    return Response.json({ error: 'Erreur du simulateur. Réessayez.' }, { status: 500 })
  }
}
