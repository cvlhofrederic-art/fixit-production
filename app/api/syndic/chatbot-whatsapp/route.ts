import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`whatsapp_${ip}`, 20, 60_000))) return rateLimitResponse()

    const { message, conversationHistory, knowledgeBase, buildingContext } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        reply: 'Obrigado pela sua mensagem. Um gestor irá responder em breve.',
        intent: 'other' as const,
        confidence: 0.5,
        shouldCreateIncident: false,
      })
    }

    const systemPrompt = `You are a helpful AI chatbot assistant for a condominium (copropriété) in Portugal.
You respond in European Portuguese. You help residents with:
- Reporting incidents (water leaks, electrical issues, elevator problems, etc.)
- Payment questions (quotas, fund reserves, receipts)
- General information (AG dates, regulation rules, contact info)
- Complaints (noise, parking, common areas)

IMPORTANT RULES:
- Always respond in European Portuguese
- Be concise but helpful (max 3-4 sentences)
- If the resident reports a physical problem (leak, broken equipment, etc.), set shouldCreateIncident to true
- If you're not confident about the answer, set confidence below 0.6

Available knowledge base:
${(knowledgeBase || []).map((k: { question: string; answer: string }) => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n')}

Building context: ${buildingContext || 'No specific building context available'}

Respond in JSON format:
{
  "reply": "your response in Portuguese",
  "intent": "incident|payment|info|complaint|ag|other",
  "confidence": 0.0-1.0,
  "shouldCreateIncident": true/false,
  "suggestedIncidentTitle": "title if incident"
}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).map((m: { sender: string; content: string }) => ({
        role: m.sender === 'resident' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const groqResponse = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!groqResponse.ok) {
      return NextResponse.json({
        reply: 'Obrigado pela sua mensagem. Um gestor irá responder em breve.',
        intent: 'other',
        confidence: 0.5,
        shouldCreateIncident: false,
      })
    }

    const data = await groqResponse.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    try {
      const parsed = JSON.parse(content)
      return NextResponse.json({
        reply: parsed.reply || 'Obrigado pela sua mensagem.',
        intent: parsed.intent || 'other',
        confidence: parsed.confidence || 0.5,
        shouldCreateIncident: parsed.shouldCreateIncident || false,
        suggestedIncidentTitle: parsed.suggestedIncidentTitle || null,
      })
    } catch {
      return NextResponse.json({
        reply: content,
        intent: 'other',
        confidence: 0.5,
        shouldCreateIncident: false,
      })
    }
  } catch (error) {
    console.error('[chatbot-whatsapp] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
