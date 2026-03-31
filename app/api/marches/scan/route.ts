import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { scanMarches, type ScanOptions } from '@/lib/marches-scanner'
import { callGroqWithRetry } from '@/lib/groq'
import { logger } from '@/lib/logger'

export const maxDuration = 120

// ── POST /api/marches/scan — Lance un scan manuel ───────────────────────────
// Body: { country?: 'FR'|'PT'|'both', metiers?: string[], location?: string, budgetMin?: number, budgetMax?: number }
// Retourne les marchés scannés, scorés et filtrés

export async function POST(request: NextRequest) {
  try {
    // Auth required
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    // Rate limit: 3 scans per 5 minutes (heavy operation)
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`scan_marches_${ip}`, 3, 300_000))) return rateLimitResponse()

    const body = await request.json().catch(() => ({}))

    // Require at least one metier — without it, BOAMP returns unfiltered garbage
    const metiers = Array.isArray(body.metiers) ? body.metiers.filter(Boolean) : []
    if (metiers.length === 0) {
      return NextResponse.json(
        { error: 'Sélectionnez un corps de métier pour scanner les marchés', marches: [], meta: { totalScanned: 0, totalFiltered: 0, sources: { boamp: 0, ted: 0, base_gov: 0, marches_online: 0, decp: 0 }, scannedAt: new Date().toISOString(), daysBack: 0 } },
        { status: 400 }
      )
    }

    logger.info(`[scan] Request: metiers=${metiers.join(',')}, location=${body.location}, country=${body.country}`)

    const options: ScanOptions = {
      country: body.country || 'FR',
      daysBack: Math.min(body.daysBack || 5, 14), // Max 14 days
      metiers,
      location: body.location || undefined,
      budgetMin: body.budgetMin || undefined,
      budgetMax: body.budgetMax || undefined,
    }

    const result = await scanMarches(options)

    // Generate AI summaries for top 10 marches (if Groq key available)
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey && result.marches.length > 0) {
      const top10 = result.marches.slice(0, 10)
      try {
        const summaryPrompt = top10.map((m, i) =>
          `${i + 1}. "${m.title}" — ${m.buyer} — ${m.location} — Budget: ${m.budgetMin ? `${m.budgetMin}€` : 'NC'}`
        ).join('\n')

        const groqRes = await callGroqWithRetry({
          messages: [
            {
              role: 'system',
              content: `Tu es un assistant BTP. Pour chaque marché, génère un résumé d'1 phrase (max 100 caractères) qui aide un artisan à comprendre rapidement l'opportunité. Réponds en JSON: { "summaries": ["résumé1", "résumé2", ...] }`,
            },
            { role: 'user', content: `Résume ces marchés :\n${summaryPrompt}` },
          ],
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }, { maxRetries: 1 })

        const parsed = JSON.parse(groqRes.choices[0]?.message?.content || '{}')
        if (Array.isArray(parsed.summaries)) {
          for (let i = 0; i < Math.min(parsed.summaries.length, top10.length); i++) {
            top10[i].aiSummary = parsed.summaries[i]
          }
        }
      } catch (aiErr) {
        logger.warn('[scan] AI summary generation failed:', aiErr)
        // Non-blocking — marches still returned without summaries
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    logger.error('[scan] Unexpected error:', err)
    return NextResponse.json({ error: 'Erreur lors du scan' }, { status: 500 })
  }
}
