// app/api/syndic/oc-classif/route.ts
// Phase C — Alfredo : classificateur d'ocorrências. Texte libre → JSON structuré
// (catégorie, priorité, localisation, résumé, suggestion) via Groq JSON-mode.
// Prompt inline FR/PT, auth syndic, rate-limit, traceAgent Langfuse (agent_id 'alfredo').
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'
import { traceAgent } from '@/lib/langfuse'
import { getSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const PROMPT_PT = `És o Alfredo, assistente de gestão de condomínios em Portugal. Classificas uma ocorrência reportada por um condómino (texto livre, estilo mensagem).
Devolve APENAS um objeto JSON válido (sem markdown, sem texto antes ou depois) com exatamente estas chaves:
{
  "categoria": "uma de: Canalização, Eletricidade, Elevador, Telhado/Cobertura, Fachada, Áreas comuns, Segurança, Limpeza, Jardim, Outro",
  "prioridade": "uma de: urgente, alta, normal, baixa",
  "localizacao": "localização provável no edifício (texto curto, '—' se desconhecida)",
  "resumo": "resumo objetivo da ocorrência (1 frase)",
  "sugestao": "ação recomendada ao síndico (1 frase)"
}
Prioridade "urgente" = risco imediato de segurança, água ou eletricidade. Responde em português europeu.`

const PROMPT_FR = `Tu es Alfredo, assistant de gestion de copropriété. Tu classes une occurrence signalée (texte libre).
Réponds UNIQUEMENT par un objet JSON valide (sans markdown) avec exactement ces clés:
{
  "categoria": "une de: Canalização, Eletricidade, Elevador, Telhado/Cobertura, Fachada, Áreas comuns, Segurança, Limpeza, Jardim, Outro",
  "prioridade": "une de: urgente, alta, normal, baixa",
  "localizacao": "localisation probable (texte court, '—' si inconnue)",
  "resumo": "résumé objectif (1 phrase)",
  "sugestao": "action recommandée au syndic (1 phrase)"
}
Priorité "urgente" = risque immédiat sécurité/eau/électricité.`

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`oc-classif:${ip}`, 15, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isSyndicRole(user)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const descricao: string = typeof body.descricao === 'string' ? body.descricao.trim() : ''
  const edificio: string = typeof body.edificio === 'string' ? body.edificio : ''
  const locale: 'fr' | 'pt' = body.locale === 'fr' ? 'fr' : 'pt'
  if (descricao.length < 8) {
    return NextResponse.json({ error: locale === 'fr' ? 'Description trop courte' : 'Descrição demasiado curta' }, { status: 400 })
  }

  const apiKey = await getSecret('GROQ_API_KEY')
  if (!apiKey) return NextResponse.json({ error: 'IA indisponível' }, { status: 503 })

  try {
    const res = await traceAgent(
      { agent_id: 'alfredo', user_id: user.id, prompt: descricao },
      () => callGroqWithRetry({
        messages: [
          { role: 'system', content: locale === 'fr' ? PROMPT_FR : PROMPT_PT },
          { role: 'user', content: `Edifício: ${edificio || '—'}\nOcorrência: ${descricao}` },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }, { apiKey, maxRetries: 2 }),
    )
    const raw = res.choices?.[0]?.message?.content || '{}'
    let classificacao: Record<string, unknown> = {}
    try {
      classificacao = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    } catch {
      logger.warn('[syndic/oc-classif] JSON parse failed')
    }
    return NextResponse.json({ classificacao })
  } catch (err) {
    logger.error('[syndic/oc-classif] error:', err)
    return NextResponse.json({ error: 'Erro ao classificar a ocorrência' }, { status: 500 })
  }
}
