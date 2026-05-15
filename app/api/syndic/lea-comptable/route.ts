import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, callGroqStreaming } from '@/lib/groq'
import { logger } from '@/lib/logger'
import { traceAgent } from '@/lib/langfuse'
import { buildLeaSystemPromptFR } from '@/lib/syndic/prompts/lea/system-prompt-fr'
import { buildLeaSystemPromptPT } from '@/lib/syndic/prompts/lea/system-prompt-pt'
import type { LeaPromptContext } from '@/lib/syndic/prompts/lea/system-prompt-fr'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import { wrapGroqStreamWithPIIResolution, SSE_HEADERS } from '@/lib/syndic/agent-sse-stream'
import { supabaseAdmin } from '@/lib/supabase-server'
import { loadLeaContext } from '@/lib/syndic/lea-context-loader'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Léa — Assistante Comptable Professionnelle Syndic ────────────────────────
// Modèle : llama-3.3-70b-versatile (Groq)
// Périmètre strict : comptabilité syndic + copropriété (JAMAIS artisan)

interface LeaContext {
  immeuble?: {
    nom?: string; adresse?: string; codePostal?: string; ville?: string;
    typeImmeuble?: string; nbLots?: number; anneeConstruction?: number;
    budgetAnnuel?: number; depensesAnnee?: number; pctBudget?: number;
    reglementTexte?: string; reglementChargesRepartition?: string;
    reglementMajoriteAG?: string; reglementFondsTravaux?: boolean;
    reglementFondsRoulementPct?: number;
  }
  cabinet?: { nom?: string; gestionnaire?: string }
  lots?: Array<{ numero: string | number; proprietaire: string; tantieme: number }>
  ecritures?: Array<{ date: string; journal: string; libelle: string; debit: number; credit: number; compte: string }>
  ecrituresStats?: { totalDebit?: number; totalCredit?: number; solde?: number }
  appels?: Array<{ statut: string; periode: string; totalBudget: number | string }>
  budgets?: Array<{ immeuble: string; annee: string | number; postes?: Array<{ libelle: string; budget: number; realise: number }> }>
  totalTantiemes?: number
  user_name?: string
}

// ── Fallback sans API Groq ────────────────────────────────────────────────────
function generateFallback(message: string, ctx: LeaContext, isPt = false): string {
  const msg = message.toLowerCase()
  const imm = ctx.immeuble || {}

  if (msg.includes('impayé') || msg.includes('relance') || msg.includes('recouvrement') ||
      msg.includes('dívida') || msg.includes('cobrança') || msg.includes('notificação')) {
    if (isPt) {
      return `📋 **Procedimento dívidas de condóminos**\n\n1. **Notificação amigável** — Carta simples recordando o saldo em dívida\n2. **Carta registada com AR** — Interpelação com detalhe dos montantes\n3. **Acordo de pagamento** — Proposta de plano de pagamento\n4. **Procedimento judicial** — Injunção / ação executiva (Art.º 1424.º Código Civil)\n\n⚠️ Configure a chave GROQ_API_KEY para respostas personalizadas com os seus dados reais.`
    }
    return `📋 **Procédure impayés copropriétaires**\n\n1. **Relance amiable** — Courrier simple rappelant le solde dû\n2. **LRAR** — Mise en demeure avec détail des sommes\n3. **Échéancier** — Proposition de plan d'apurement\n4. **Procédure judiciaire** — Référé-provision (art. 19 loi 10/07/1965)\n\n⚠️ Configurez la clé GROQ_API_KEY pour des réponses personnalisées avec vos données réelles.`
  }

  if (msg.includes('budget') || msg.includes('charge') || msg.includes('appel') ||
      msg.includes('orçamento') || msg.includes('quota') || msg.includes('cobrança')) {
    if (isPt) {
      return `💶 **Dados contabilísticos — ${imm.nom || 'Condomínio'}**\n\nOrçamento anual: **${Number(imm.budgetAnnuel || 0).toLocaleString('pt-PT')} €**\nDespesas: **${Number(imm.depensesAnnee || 0).toLocaleString('pt-PT')} €**\nConsumo: **${imm.pctBudget || 0}%**\n\n⚠️ Configure a chave GROQ_API_KEY para uma análise completa.`
    }
    return `💶 **Données comptables — ${imm.nom || 'Copropriété'}**\n\nBudget annuel : **${Number(imm.budgetAnnuel || 0).toLocaleString('fr-FR')} €**\nDépenses : **${Number(imm.depensesAnnee || 0).toLocaleString('fr-FR')} €**\nConsommation : **${imm.pctBudget || 0}%**\n\n⚠️ Configurez la clé GROQ_API_KEY pour une analyse complète.`
  }

  if (msg.includes('artisan') || msg.includes('facture artisan') || msg.includes('tva artisan') ||
      msg.includes('fatura artesão') || msg.includes('iva artesão') || msg.includes('artesão')) {
    if (isPt) {
      return `⚠️ Este pedido pertence ao **módulo Artesão**. Por favor utilize o assistente dedicado no lado do prestador.\n\nA Léa está estritamente dedicada à contabilidade do condomínio e da propriedade horizontal.`
    }
    return `⚠️ Cette demande relève du **module Artisan**. Merci d'utiliser l'assistant dédié côté prestataire.\n\nLéa est strictement dédiée à la comptabilité syndic et copropriété.`
  }

  if (isPt) {
    return `📊 **Léa — Assistente Contabilística Condomínio**\n\nSou especializada em contabilidade de condomínio. Configure a chave GROQ_API_KEY para a IA completa.\n\nPosso ajudá-lo com:\n- Avisos de cobrança e repartição por permilagem\n- Diário contabilístico e lançamentos\n- Orçamento previsional\n- Dívidas e procedimentos de cobrança\n- Reconciliação bancária\n- Encerramento do exercício\n- Preparação AG (anexos contabilísticos)`
  }

  return `📊 **Léa — Assistante Comptable Syndic**\n\nJe suis spécialisée en comptabilité de copropriété. Configurez la clé GROQ_API_KEY pour l'IA complète.\n\nJe peux vous aider sur :\n- Appels de fonds et répartition tantièmes\n- Journal comptable et écritures\n- Budget prévisionnel\n- Impayés et procédures de recouvrement\n- Rapprochement bancaire\n- Clôture d'exercice\n- Préparation AG (annexes comptables)`
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`lea_comptable_${ip}`, 30, 60_000))) {
      return rateLimitResponse()
    }

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, syndic_context: clientContext = {}, conversation_history = [], locale, stream } = body

    const isPt = locale === 'pt'

    // Hydrater le contexte depuis la DB (supabaseAdmin bypass RLS, cohérent avec fixy-syndic)
    let syndic_context: Record<string, unknown> = clientContext
    try {
      const hydrated = await loadLeaContext(supabaseAdmin, user)
      syndic_context = { ...hydrated, ...clientContext }
    } catch (err) {
      logger.warn('[lea] context hydration failed, using client context:', err)
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: isPt ? 'mensagem obrigatória' : 'message requis' }, { status: 400 })
    }

    syndic_context.user_name = user.user_metadata?.full_name || user.email

    const limitedHistory = Array.isArray(conversation_history) ? conversation_history.slice(-30) : []

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        response: generateFallback(message, syndic_context, isPt),
        fallback: true,
      })
    }

    // Masquer les PII avant envoi à Groq (emails, téléphones, IBAN, adresses)
    const { sanitized: sanitizedCtx, tokenMap } = sanitizeContextForLLM(syndic_context as LeaPromptContext)

    const systemPrompt = isPt
      ? buildLeaSystemPromptPT(sanitizedCtx)
      : buildLeaSystemPromptFR(sanitizedCtx)

    const historyMessages = limitedHistory
      .filter((m: { role?: string; content?: string }) => m.role && m.content)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: String(m.content).substring(0, 3000) }))

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ]

    // ── Mode streaming SSE ──
    if (stream) {
      try {
        const rawStream = await callGroqStreaming({
          messages,
          temperature: 0.15,
          max_tokens: 4000,
        })

        // Enveloppe le stream Groq pour résoudre les tokens PII (helper partagé Plan B).
        const readable = wrapGroqStreamWithPIIResolution(rawStream, tokenMap)

        return new Response(readable, { headers: SSE_HEADERS })
      } catch (err) {
        logger.error('[lea-comptable] Streaming error:', err)
        return NextResponse.json({
          response: generateFallback(message, syndic_context, isPt),
          fallback: true,
        })
      }
    }

    // ── Mode classique ──
    let groqData: Awaited<ReturnType<typeof callGroqWithRetry>>
    try {
      groqData = await traceAgent(
        {
          agent_id: 'lea',
          user_id: user.id,
          conversation_id: body.conversation_id,
          prompt: message,
        },
        () => callGroqWithRetry({
          messages,
          temperature: 0.15,
          max_tokens: 4000,
        }),
      )
    } catch (err) {
      logger.error('Groq Léa error:', err)
      return NextResponse.json({
        response: generateFallback(message, syndic_context, isPt),
        fallback: true,
      })
    }

    const rawResponse: string = groqData.choices?.[0]?.message?.content
      || (isPt ? 'Não consegui gerar uma resposta. Tente novamente.' : 'Je n\'ai pas pu générer une réponse. Réessayez.')
    // Résoudre les tokens PII dans la réponse finale
    let response: string = resolveSanitizedToken(rawResponse, tokenMap) ?? rawResponse

    // Extraire l'action comptable si présente
    let comptaAction: Record<string, unknown> | null = null
    const actionMatch = response.match(/##COMPTA_ACTION##([\s\S]*?)##/)
    if (actionMatch) {
      try {
        comptaAction = JSON.parse(actionMatch[1])
        response = response.replace(/##COMPTA_ACTION##[\s\S]*?##/g, '').trim()
      } catch {
        // Ignore les actions malformées
      }
    }

    return NextResponse.json({ response, action: comptaAction })

  } catch (err: unknown) {
    logger.error('Léa Comptable error:', err)
    return NextResponse.json({ error: 'Uma erro interno ocorreu / Une erreur interne est survenue' }, { status: 500 })
  }
}
