import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { scanMarches, type ScanOptions } from '@/lib/marches-scanner'
import { callGroqWithRetry } from '@/lib/groq'
import { logger } from '@/lib/logger'

export const maxDuration = 30

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

    const options: ScanOptions = {
      country: body.country || 'both',
      daysBack: Math.min(body.daysBack || 3, 7), // Max 7 days
      metiers: Array.isArray(body.metiers) ? body.metiers : [],
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
