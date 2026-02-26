import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 30 req/min
    const ip = getClientIP(request)
    if (!checkRateLimit(ip, 30, 60_000)) return rateLimitResponse()

    const body = await request.json()
    const { messages, systemPrompt } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array requis' }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({ reply: '⚠️ Service IA temporairement indisponible. Veuillez réessayer plus tard.' })
    }

    const groqMessages = [
      { role: 'system', content: systemPrompt || 'Tu es Sofia, une assistante IA pour copropriétaires. Réponds toujours en français.' },
      ...messages.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
    ]

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.2,
        max_tokens: 2000,
      }),
    })

    if (!groqResponse.ok) {
      const errText = await groqResponse.text()
      console.error('Groq API error:', groqResponse.status, errText)
      return NextResponse.json({ reply: 'Je rencontre un problème technique. Réessayez dans quelques instants.' }, { status: 500 })
    }

    const groqData = await groqResponse.json()
    const reply = groqData.choices?.[0]?.message?.content || 'Désolée, je n\'ai pas pu générer une réponse.'

    return NextResponse.json({ reply })

  } catch (error: any) {
    console.error('Copro AI error:', error)
    return NextResponse.json({ reply: 'Une erreur est survenue. Veuillez réessayer.' }, { status: 500 })
  }
}
