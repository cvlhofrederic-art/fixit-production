// Helpers partagés des routes IA Alfredo (syndic v54) : auth+rate-limit communs
// et appel Groq tracé Langfuse. Évite la duplication entre les routes Alfredo.
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'
import { traceAgent } from '@/lib/langfuse'
import { getSecret } from '@/lib/env'

type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>
export type SyndicGate = { ok: true; user: AuthUser } | { ok: false; res: Response }

/** Auth syndic + rate-limit communs aux routes Alfredo. */
export async function gateSyndic(req: NextRequest, rateKey: string, limit = 15): Promise<SyndicGate> {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`${rateKey}:${ip}`, limit, 60_000))) return { ok: false, res: rateLimitResponse() }
  const user = await getAuthUser(req)
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  if (!isSyndicRole(user)) return { ok: false, res: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  return { ok: true, user }
}

/** Appel Alfredo (Groq) tracé Langfuse. Retourne le contenu texte (ou JSON brut). */
export async function callAlfredo(userId: string, opts: { system: string; user: string; prompt: string; json?: boolean; maxTokens?: number }): Promise<string> {
  const apiKey = await getSecret('GROQ_API_KEY')
  if (!apiKey) throw new Error('GROQ_API_KEY indisponível')
  const res = await traceAgent(
    { agent_id: 'alfredo', user_id: userId, prompt: opts.prompt },
    () => callGroqWithRetry({
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 1500,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }, { apiKey, maxRetries: 2 }),
  )
  return res.choices?.[0]?.message?.content || ''
}
