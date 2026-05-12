// lib/syndic/alfredo-classify.ts
import { callGroqWithRetry } from '@/lib/groq'
import type { Locale } from './agent-types'

interface IncomingEmail {
  from: string
  subject: string
  body_text: string
}

interface ClassifyResult {
  urgence: string
  type_demande: string
  resume_court: string
  immeuble_detecte?: string
  locataire_detecte?: string
}

export async function classifyEmailWithGroq(
  email: IncomingEmail,
  locale: Locale,
): Promise<ClassifyResult> {
  const prompt =
    locale === 'pt'
      ? `Classifica este email recebido por um síndico português. Responde APENAS em JSON estrito :
{ "urgence": "baixa|normal|alta|urgente", "type_demande": "sinistre|reclamacao|questao_administrativa|orcamento|spam|outro", "resume_court": "max 80 chars", "immeuble_detecte": "nom ou null", "locataire_detecte": "nom ou null" }

De : ${email.from}
Assunto : ${email.subject}
Conteúdo : ${email.body_text.slice(0, 1500)}`
      : `Classifie cet email reçu par un syndic français. Réponds UNIQUEMENT en JSON strict :
{ "urgence": "basse|normale|haute|urgente", "type_demande": "sinistre|reclamation|question_administrative|devis|spam|autre", "resume_court": "max 80 chars", "immeuble_detecte": "nom ou null", "locataire_detecte": "nom ou null" }

De : ${email.from}
Sujet : ${email.subject}
Contenu : ${email.body_text.slice(0, 1500)}`

  const response = await callGroqWithRetry({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })

  try {
    const parsed = JSON.parse(
      response.choices?.[0]?.message?.content ?? '{}',
    ) as Partial<ClassifyResult>
    return {
      urgence: parsed.urgence ?? 'normale',
      type_demande: parsed.type_demande ?? 'autre',
      resume_court: parsed.resume_court ?? '',
      immeuble_detecte: parsed.immeuble_detecte ?? undefined,
      locataire_detecte: parsed.locataire_detecte ?? undefined,
    }
  } catch {
    return { urgence: 'normale', type_demande: 'autre', resume_court: '' }
  }
}
