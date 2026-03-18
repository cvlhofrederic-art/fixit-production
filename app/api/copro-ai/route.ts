import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, callGroqStreaming } from '@/lib/groq'
import { getAuthUser } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 30 req/min
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 30, 60_000))) return rateLimitResponse()

    // ── Auth obligatoire ──
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const { messages, systemPrompt, stream } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array requis' }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ reply: '⚠️ Service IA temporairement indisponible. Veuillez réessayer plus tard.' })
    }

    const groqMessages = [
      { role: 'system', content: systemPrompt || 'Tu es Fixy, un assistant IA pour copropriétaires et locataires. Tu es amical, patient et pédagogue. Réponds toujours en français.' },
      ...messages.slice(-20).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    ]

    // ── Mode streaming SSE ──
    if (stream) {
      try {
        const sseStream = await callGroqStreaming({
          messages: groqMessages,
          temperature: 0.2,
          max_tokens: 3000,
        })
        return new Response(sseStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (err) {
        logger.error('[copro-ai] Streaming error:', err)
        return NextResponse.json({ reply: 'Je rencontre un problème technique. Réessayez dans quelques instants.' }, { status: 500 })
      }
    }

    // ── Mode classique (rétrocompatibilité) ──
    try {
      const groqData = await callGroqWithRetry({
        messages: groqMessages,
        temperature: 0.2,
        max_tokens: 3000,
      })
      const reply = groqData.choices?.[0]?.message?.content || 'Désolée, je n\'ai pas pu générer une réponse.'
      return NextResponse.json({ reply })
    } catch (err) {
      logger.error('Groq API error:', err)
      return NextResponse.json({ reply: 'Je rencontre un problème technique. Réessayez dans quelques instants.' }, { status: 500 })
    }

  } catch (error: unknown) {
    logger.error('[copro-ai] Error:', error)
    return NextResponse.json({ reply: 'Une erreur est survenue. Veuillez réessayer.' }, { status: 500 })
  }
}
