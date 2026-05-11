import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, getUserRole, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, callGroqStreaming, type GroqResponse } from '@/lib/groq'
import { logger } from '@/lib/logger'
import { traceAgent } from '@/lib/langfuse'
import { validateBody, syndicMaxAiSchema } from '@/lib/validation'
import { buildMaxSystemPromptFR } from '@/lib/syndic/prompts/max/system-prompt-fr'
import { buildMaxSystemPromptPT } from '@/lib/syndic/prompts/max/system-prompt-pt'
import type { MaxPromptContext } from '@/lib/syndic/prompts/max/system-prompt-fr'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Max — Expert-Conseil IA Syndic (lecture seule, pas d'actions) ─────────────
// Modèle : llama-3.3-70b-versatile (Groq)
// Rôle : conseiller expert copropriété, réglementation, comptabilité, contentieux

const ROLE_CONFIGS: Record<string, { name: string; namePt: string; emoji: string; expertise: string; expertisePt: string }> = {
  syndic: {
    name: 'Administrateur Cabinet', namePt: 'Administrador do Gabinete',
    emoji: '🏢',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    expertisePt: 'Administração completa do gabinete, gestão financeira, jurídica, equipa, artesãos, condóminos',
  },
  syndic_admin: {
    name: 'Administrateur Cabinet', namePt: 'Administrador do Gabinete',
    emoji: '👑',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    expertisePt: 'Administração completa do gabinete, gestão financeira, jurídica, equipa, artesãos, condóminos',
  },
  syndic_tech: {
    name: 'Gestionnaire Technique', namePt: 'Gestor Técnico',
    emoji: '🔧',
    expertise: 'Interventions techniques, artisans, missions, suivi travaux, comptabilité technique, analyse devis/factures, réglementation BTP',
    expertisePt: 'Intervenções técnicas, artesãos, missões, acompanhamento de obras, contabilidade técnica, análise orçamentos/faturas, regulamentação construção',
  },
  syndic_secretaire: {
    name: 'Secrétaire', namePt: 'Secretário(a)',
    emoji: '📋',
    expertise: 'Correspondances, emails, copropriétaires, convocations AG, documents administratifs',
    expertisePt: 'Correspondências, emails, condóminos, convocatórias AG, documentos administrativos',
  },
  syndic_gestionnaire: {
    name: 'Gestionnaire Copropriété', namePt: 'Gestor de Condomínio',
    emoji: '🏘️',
    expertise: 'Gestion copropriétés, immeubles, réglementaire, assemblées générales, contentieux, facturation',
    expertisePt: 'Gestão de condomínios, edifícios, regulamentação, assembleias gerais, contencioso, faturação',
  },
  syndic_comptable: {
    name: 'Comptable', namePt: 'Contabilista',
    emoji: '💶',
    expertise: 'Comptabilité syndic, budgets prévisionnels, appels de charges, factures, rapports financiers, impayés',
    expertisePt: 'Contabilidade condomínio, orçamentos previsionais, quotas, faturas, relatórios financeiros, dívidas',
  },
}

interface ImmeubleSummary { nom: string; ville: string; nbLots: number; budgetAnnuel?: number; depensesAnnee?: number; pctBudget: number | string }
interface ArtisanSummary { nom: string; metier: string; statut: string; rcProValide: boolean; rcProExpiration?: string; note: number; vitfixCertifie?: boolean }
interface MissionSummary { priorite?: string; immeuble: string; artisan: string; type: string; description: string; statut: string; dateIntervention?: string; montantDevis?: number }
interface AlerteSummary { urgence?: string; message: string }
interface EcheanceSummary { immeuble: string; label: string; dateEcheance: string }
interface DocumentSummary { type: string; nom: string; immeuble?: string; date: string }
interface CopropriSummary { prenom?: string; nom?: string; immeuble: string; batiment?: string; etage?: string; porte?: string; email?: string; telephone?: string; locataire?: string }

// ── Fallback sans API Groq ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Syndic context from frontend with dynamic shape
function generateFallback(message: string, ctx: Record<string, any>, userRole: string, isPt: boolean): string {
  const msg = message.toLowerCase()
  const stats = ctx.stats || {}
  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']
  const roleName = isPt ? roleConfig.namePt : roleConfig.name

  if (msg.includes('alerta') || msg.includes('alerte') || msg.includes('urgent')) {
    const alerts = (ctx.alertes as AlerteSummary[] || []).filter((a) => a.urgence === 'haute')
    if (alerts.length === 0) return isPt ? '✅ **Nenhum alerta urgente** de momento.' : '✅ **Aucune alerte urgente** en ce moment.'
    return `🔴 **${alerts.length} ${isPt ? 'alerta(s) urgente(s)' : 'alerte(s) urgente(s)'} :**\n\n${alerts.map((a) => `- ${a.message}`).join('\n')}`
  }

  if (msg.includes('budget') || msg.includes('orçamento') || msg.includes('dépense') || msg.includes('despesa') || msg.includes('finance') || msg.includes('finanç')) {
    const loc = isPt ? 'pt-PT' : 'fr-FR'
    const pct = stats.totalBudget > 0 ? Math.round(stats.totalDepenses / stats.totalBudget * 100) : 0
    return isPt
      ? `💶 **Orçamento global** : ${stats.totalDepenses?.toLocaleString(loc)}€ / ${stats.totalBudget?.toLocaleString(loc)}€ (**${pct}% consumido**)\n\n${pct > 80 ? '⚠️ Atenção: orçamento próximo do limite.' : '✅ Orçamento dentro dos limites.'}`
      : `💶 **Budget global** : ${stats.totalDepenses?.toLocaleString(loc)}€ / ${stats.totalBudget?.toLocaleString(loc)}€ (**${pct}% consommé**)\n\n${pct > 80 ? '⚠️ Attention : budget proche de l\'épuisement.' : '✅ Budget dans les limites.'}`
  }

  if (msg.includes('mission') || msg.includes('missão') || msg.includes('intervenção')) {
    return isPt
      ? `📋 **Missões** : ${ctx.missions?.length || 0} no total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions as MissionSummary[] || []).slice(0, 3).map((m) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
      : `📋 **Missions** : ${ctx.missions?.length || 0} au total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions as MissionSummary[] || []).slice(0, 3).map((m) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
  }

  if (msg.includes('artisan') || msg.includes('artesão') || msg.includes('rc pro')) {
    const expired = (ctx.artisans as ArtisanSummary[] || []).filter((a) => !a.rcProValide)
    return expired.length > 0
      ? isPt
        ? `⚠️ **${expired.length} artesão(s) com RC Pro expirado :**\n\n${expired.map((a) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Ação necessária: suspender até renovação.`
        : `⚠️ **${expired.length} artisan(s) avec RC Pro expirée :**\n\n${expired.map((a) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Action requise : suspendre jusqu'au renouvellement.`
      : isPt
        ? `✅ Todos os artesãos têm **RC Pro válido**.`
        : `✅ Tous les artisans ont une **RC Pro valide**.`
  }

  return isPt
    ? `🎓 **Max — Consultor Especialista ${roleName}**\n\nSou o vosso consultor especialista IA. Configure a chave GROQ_API_KEY para ativar a IA completa.\n\nPosso aconselhar-vos sobre:\n- Direito do condomínio (Código Civil, Lei 8/2022)\n- Regulamentação técnica (SCE, RGEU, SCIE)\n- Gestão de artesãos\n- Contabilidade condomínio\n- Contencioso e procedimentos`
    : `🎓 **Max — Expert-Conseil ${roleName}**\n\nJe suis votre expert-conseil IA. Configurez la clé GROQ_API_KEY pour activer l'IA complète.\n\nJe peux vous conseiller sur :\n- Le droit de la copropriété\n- La réglementation technique\n- La gestion des artisans\n- La comptabilité syndic\n- Les contentieux et procédures`
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 40, 60_000))) {
      return rateLimitResponse()
    }

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = getUserRole(user) || 'syndic'

    const rawBody = await request.json()
    const v = validateBody(syndicMaxAiSchema, rawBody)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- syndic_context has dynamic shape
    const syndic_context = (v.data.syndic_context || {}) as Record<string, any>
    const { message, conversation_history = [], locale, stream } = v.data

    const isPt = locale === 'pt'

    syndic_context.user_role = userRole
    syndic_context.user_name = user.user_metadata?.full_name || user.email

    const limitedHistory = Array.isArray(conversation_history) ? conversation_history.slice(-40) : []

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole, isPt),
        fallback: true,
      })
    }

    // Masquer les PII avant envoi à Groq (emails, téléphones, IBAN, adresses)
    const { sanitized: sanitizedCtx, tokenMap } = sanitizeContextForLLM(syndic_context as MaxPromptContext)

    const systemPrompt = isPt
      ? buildMaxSystemPromptPT(sanitizedCtx, userRole)
      : buildMaxSystemPromptFR(sanitizedCtx, userRole)

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
          temperature: 0.4,
          max_tokens: 4000,
        })

        // Envelopper le stream pour résoudre les tokens PII dans chaque chunk SSE.
        // Buffering pour éviter les tokens coupés entre deux chunks (ex: `<email:abc` / `12345>`).
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        let chunkBuffer = ''

        const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            const text = decoder.decode(chunk, { stream: true })
            // Chaque chunk peut contenir plusieurs lignes SSE
            const lines = text.split('\n')
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data: ')) {
                // Lignes vides ou autres — passer telles quelles
                controller.enqueue(encoder.encode(line + '\n'))
                continue
              }
              const payload = trimmed.slice(6)
              if (payload === '[DONE]') {
                // Flush le buffer résiduel avant [DONE]
                if (chunkBuffer) {
                  const resolved = resolveSanitizedToken(chunkBuffer, tokenMap) ?? chunkBuffer
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: resolved })}\n\n`))
                  chunkBuffer = ''
                }
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                continue
              }
              try {
                const json = JSON.parse(payload)
                const delta: string | undefined = json.text
                if (delta === undefined) {
                  // Chunk sans texte (ex: métadonnées) — passer tel quel
                  controller.enqueue(encoder.encode(line + '\n'))
                  continue
                }
                chunkBuffer += delta
                // Détection d'un token en cours de formation (ouvert mais pas encore fermé)
                const lastOpen = chunkBuffer.lastIndexOf('<')
                const lastClose = chunkBuffer.lastIndexOf('>')
                if (lastOpen > lastClose) {
                  // Token potentiellement coupé : flush jusqu'au '<' et garder la suite
                  const toFlush = chunkBuffer.slice(0, lastOpen)
                  chunkBuffer = chunkBuffer.slice(lastOpen)
                  if (toFlush) {
                    const resolved = resolveSanitizedToken(toFlush, tokenMap) ?? toFlush
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: resolved })}\n\n`))
                  }
                } else {
                  // Pas de token en cours — flush tout
                  const resolved = resolveSanitizedToken(chunkBuffer, tokenMap) ?? chunkBuffer
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: resolved })}\n\n`))
                  chunkBuffer = ''
                }
              } catch {
                // Chunk JSON malformé — passer tel quel
                controller.enqueue(encoder.encode(line + '\n'))
              }
            }
          },
          flush(controller) {
            // Flush final au cas où le stream se termine sans [DONE]
            if (chunkBuffer) {
              const resolved = resolveSanitizedToken(chunkBuffer, tokenMap) ?? chunkBuffer
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: resolved })}\n\n`))
              chunkBuffer = ''
            }
          },
        })

        rawStream.pipeTo(writable).catch(() => { /* stream annulé côté client — ignorer */ })

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (err) {
        logger.error('[max-ai] Streaming error:', err)
        return NextResponse.json({
          response: generateFallback(message, syndic_context, userRole, isPt),
          fallback: true,
        })
      }
    }

    // ── Mode classique (rétrocompatibilité) ──
    let groqData: GroqResponse
    try {
      groqData = await traceAgent(
        {
          agent_id: 'max',
          user_id: user.id,
          conversation_id: rawBody.conversation_id,
          prompt: message,
        },
        () => callGroqWithRetry({
          messages,
          temperature: 0.4,
          max_tokens: 4000,
        }),
      )
    } catch (err) {
      logger.error('Groq Max error:', err)
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole, isPt),
        fallback: true,
      })
    }

    const fallbackMsg = isPt
      ? 'Não consegui gerar uma resposta. Tente novamente.'
      : 'Je n\'ai pas pu générer une réponse. Réessayez.'

    const rawResponse: string = groqData.choices?.[0]?.message?.content || fallbackMsg
    // Résoudre les tokens PII dans la réponse finale
    const response = resolveSanitizedToken(rawResponse, tokenMap) ?? rawResponse

    return NextResponse.json({ response, role: userRole })

  } catch (err: unknown) {
    logger.error('[max-ai] Error:', err)
    const errMsg = 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
