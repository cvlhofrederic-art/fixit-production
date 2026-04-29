// app/api/simulateur-travaux/route-v2.ts
//
// Handler V2 : tool-calling Groq + token substitution + ESTIMATION_DATA payload.
// Boucle plafonnée à 4 itérations. Out-of-catalog en court-circuit serveur si
// lookupVariants renvoie []. Stream final avec validation chunk-par-chunk.

import { callGroqStreaming, callGroqWithTools, type GroqMessageWithTools } from '@/lib/groq'
import { traceSimulateurV2 } from '@/lib/langfuse'
import { TOOL_SCHEMAS, executeTool } from './tools'
import { SYSTEM_PROMPT_V2 } from './system-prompt-v2'
import { validateAndSubstitute, type SubstitutionStats } from './token-substitution'
import { validateQuote } from '@/lib/prix-travaux-2026/validate'
import type { ComputeQuoteResult } from '@/lib/prix-travaux-2026/compute'
import * as Sentry from '@sentry/nextjs'

const MAX_TOOL_ITERATIONS = 4
const SYSTEM_PROMPT_FINAL_REMINDER = `\n\nMaintenant rédige ta réponse finale au client en utilisant EXCLUSIVEMENT les placeholders disponibles. Termine par les deux CTA sur leurs lignes propres.`

type HandleV2Options = {
  userId?: string
  headers?: Record<string, string>
}

export async function handleV2(
  messages: Array<{ role: string; content: string }>,
  opts: HandleV2Options = {}
): Promise<Response> {
  const start = Date.now()
  const stats: SubstitutionStats = { hallucinationsBlocked: 0, unknownPlaceholders: 0 }
  const toolCallsDetail: Array<{ name: string; latencyMs: number; success: boolean }> = []
  let lastQuoteResult: ComputeQuoteResult | null = null

  const conversation: GroqMessageWithTools[] = [
    { role: 'system', content: SYSTEM_PROMPT_V2 },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  // Boucle tool-calling
  let iterations = 0
  let toolCallsCount = 0
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++
    let resp
    try {
      resp = await callGroqWithTools({
        messages: conversation,
        tools: TOOL_SCHEMAS,
        temperature: 0.2,
        max_tokens: 800,
      })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      console.error('[simulateur-v2] tool-call fetch failed:', errMsg, '| iter:', iterations)
      Sentry.captureException(e, { tags: { agent_type: 'simulateur-v2', stage: 'tool-call' } })
      traceSimulateurV2({
        arm: 'v2', userId: opts.userId, toolCallsCount,
        hallucinationsBlocked: 0, unknownPlaceholders: 0,
        latencyMs: Date.now() - start, error: 'tool_call_fetch_failed',
      })
      return fallbackResponse(opts.headers)
    }

    const toolCalls = resp.message.tool_calls
    if (!toolCalls || toolCalls.length === 0) {
      // Pas d'appel d'outil → on passe à la phase de génération finale.
      // Préserve la réponse texte du LLM dans la conversation pour que le
      // final-stream ait le contexte (sinon Groq régénère sans la question
      // posée et peut diverger).
      if (resp.message.content) {
        conversation.push({ role: 'assistant', content: resp.message.content })
      }
      // Si aucun computeQuote n'a été appelé, on force out-of-catalog.
      if (!lastQuoteResult) {
        const synth = executeTool('computeQuote', { items: [], gamme: 'standard', etat: 'bon' })
        if (synth.error || !synth.result) {
          console.error('[simulateur-v2] synthetic out-of-catalog failed:', synth.error)
          Sentry.captureMessage('simulateur-v2: synthetic out-of-catalog failed', { extra: { error: synth.error } })
          return fallbackResponse(opts.headers)
        }
        lastQuoteResult = synth.result as ComputeQuoteResult
        toolCallsCount++
        toolCallsDetail.push({ name: 'computeQuote(synthetic)', latencyMs: 0, success: true })
      }
      break
    }

    // Exécute les tool_calls
    conversation.push({
      role: 'assistant',
      content: resp.message.content ?? null,
      tool_calls: toolCalls,
    })

    for (const call of toolCalls) {
      toolCallsCount++
      const tStart = Date.now()
      let parsedArgs: unknown
      try {
        parsedArgs = JSON.parse(call.function.arguments)
      } catch {
        parsedArgs = {}
      }
      const result = executeTool(call.function.name, parsedArgs)
      const tEnd = Date.now()
      toolCallsDetail.push({
        name: call.function.name,
        latencyMs: tEnd - tStart,
        success: !result.error,
      })

      // Court-circuit serveur : lookupVariants vide → force out-of-catalog
      if (call.function.name === 'lookupVariants' && !result.error && Array.isArray(result.result) && result.result.length === 0) {
        const synth = executeTool('computeQuote', { items: [], ...extractZoneArgs(parsedArgs), gamme: 'standard', etat: 'bon' })
        if (!synth.error && synth.result) {
          lastQuoteResult = synth.result as ComputeQuoteResult
        }
      }

      if (call.function.name === 'computeQuote' && !result.error && result.result) {
        const r = result.result as ComputeQuoteResult
        const v = validateQuote(r)
        if (!v.ok) {
          // Sanitize args before Sentry: drop PII (aidesContext contains revenusFiscaux, foyerTaille)
          const safeArgs = sanitizeComputeArgsForLog(parsedArgs)
          Sentry.captureMessage('simulateur-v2: validateQuote failed', {
            level: 'error',
            extra: { reasons: v.reasons, args: safeArgs },
            tags: { agent_type: 'simulateur-v2' },
          })
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: 'validation_failed', reasons: v.reasons }),
          })
          continue
        }
        lastQuoteResult = r
      }

      conversation.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result.error ? { error: result.error } : result.result),
      })
    }
  }

  if (iterations >= MAX_TOOL_ITERATIONS && !lastQuoteResult) {
    // Au lieu d'un fallback brut, on bascule en synthetic out-of-catalog
    // pour donner au moins le taux horaire artisan via {ARTISAN_RATE_*}.
    // Un fallback total est gardé en filet de sécurité si même synthetic foire.
    console.warn('[simulateur-v2] tool_loop_exceeded → synthetic OOC | iterations:', iterations, 'toolCallsCount:', toolCallsCount)
    Sentry.captureMessage('simulateur-v2: tool_loop_exceeded → synthetic OOC', {
      level: 'warning',
      tags: { agent_type: 'simulateur-v2' },
      extra: { iterations, toolCallsCount },
    })
    const synth = executeTool('computeQuote', { items: [], gamme: 'standard', etat: 'bon' })
    if (synth.error || !synth.result) {
      console.error('[simulateur-v2] synthetic OOC after loop_exceeded failed:', synth.error)
      traceSimulateurV2({
        arm: 'v2', userId: opts.userId, toolCallsCount,
        hallucinationsBlocked: 0, unknownPlaceholders: 0,
        latencyMs: Date.now() - start, error: 'tool_loop_exceeded',
      })
      return fallbackResponse(opts.headers)
    }
    lastQuoteResult = synth.result as ComputeQuoteResult
    toolCallsCount++
    toolCallsDetail.push({ name: 'computeQuote(synthetic-after-loop)', latencyMs: 0, success: true })
  }

  // Phase 2 : streaming final avec placeholders
  conversation.push({
    role: 'system',
    content: SYSTEM_PROMPT_FINAL_REMINDER,
  })

  const ctx = lastQuoteResult!
  let groqStream: ReadableStream<Uint8Array>
  try {
    groqStream = await callGroqStreaming({
      // Preserve tool_call_id and tool_calls — Groq exige ces champs sur les
      // messages role='tool' et 'assistant' avec tool_calls. Le bug initial
      // faisait un map() qui les stripait, causant 400 Bad Request systematique.
      // Note: pour assistant + tool_calls, content peut etre null cote Groq —
      // ne PAS le convertir en chaine '""' (JSON.stringify d'une string vide
      // produit '""' littéral, ce qui n'est pas équivalent à null).
      messages: conversation.map(m => {
        const base: { role: string; content: string | null } = {
          role: m.role,
          content: typeof m.content === 'string' ? m.content : (m.content ?? null),
        }
        return {
          ...base,
          ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
          ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        }
      }),
      temperature: 0.3,
      max_tokens: 1200,
    })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[simulateur-v2] final-stream failed:', errMsg)
    Sentry.captureException(e, { tags: { agent_type: 'simulateur-v2', stage: 'final-stream' } })
    return fallbackResponse(opts.headers)
  }

  // Wrap : substitution + ESTIMATION_DATA append
  const wrapped = wrapStreamWithSubstitution(groqStream, ctx, stats, () => {
    traceSimulateurV2({
      arm: 'v2',
      userId: opts.userId,
      toolCallsCount,
      toolCallsDetail,
      hallucinationsBlocked: stats.hallucinationsBlocked,
      unknownPlaceholders: stats.unknownPlaceholders,
      mode: ctx.mode,
      zoneDetected: ctx.zoneDetected,
      totalMin: ctx.totalMin,
      totalMax: ctx.totalMax,
      spreadPercent: ctx.spreadPercent,
      latencyMs: Date.now() - start,
    })
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...(opts.headers ?? {}),
  }
  return new Response(wrapped, { headers })
}

function sanitizeComputeArgsForLog(args: unknown): Record<string, unknown> {
  if (typeof args !== 'object' || args === null) return {}
  const a = args as Record<string, unknown>
  const safe: Record<string, unknown> = {}
  if (Array.isArray(a.items)) safe.items = a.items
  if (typeof a.region === 'string') safe.region = a.region
  if (typeof a.postalCode === 'string') safe.postalCode = a.postalCode
  if (typeof a.gamme === 'string') safe.gamme = a.gamme
  if (typeof a.etat === 'string') safe.etat = a.etat
  // aidesContext volontairement omis — contient revenusFiscaux, foyerTaille (PII)
  return safe
}

function extractZoneArgs(args: unknown): { region?: string; postalCode?: string } {
  if (typeof args !== 'object' || args === null) return {}
  const a = args as Record<string, unknown>
  const out: { region?: string; postalCode?: string } = {}
  if (typeof a.region === 'string') out.region = a.region
  if (typeof a.postalCode === 'string') out.postalCode = a.postalCode
  return out
}

function wrapStreamWithSubstitution(
  upstream: ReadableStream<Uint8Array>,
  ctx: ComputeQuoteResult,
  stats: SubstitutionStats,
  onClose: () => void
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let pendingPlaceholder = ''
  let closed = false

  // Garde anti-boucle infinie : si le stream upstream émet uniquement des chunks
  // ignorables (ex. data: [DONE] ou JSON malformé) sans jamais faire enqueued=true
  // ni done=true, la boucle interne tournerait jusqu'au timeout Worker (30s).
  // Limite défensive : 10 000 chunks lus sans output utile = abort.
  let chunksWithoutOutput = 0
  const MAX_CHUNKS_WITHOUT_OUTPUT = 10_000

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (closed) return
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Flush any remaining buffered placeholder partial
          if (pendingPlaceholder) {
            const flushed = validateAndSubstitute(pendingPlaceholder, ctx, stats)
            if (flushed) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: flushed })}\n\n`))
            }
            pendingPlaceholder = ''
          }
          // Append ESTIMATION_DATA + DONE
          const payload = JSON.stringify(ctx)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '\n\n[ESTIMATION_DATA]' + payload + '[/ESTIMATION_DATA]\n' })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          closed = true
          try { onClose() } catch { /* ignore */ }
          return
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        let enqueued = false
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') {
            // Ignore upstream DONE — on émet le nôtre après ESTIMATION_DATA
            continue
          }
          try {
            const json = JSON.parse(payload)
            const delta = typeof json.text === 'string' ? json.text : ''
            if (!delta) continue
            // Combine with any pending partial placeholder from previous chunk
            const combined = pendingPlaceholder + delta
            // Detect a trailing unclosed placeholder
            const lastOpen = combined.lastIndexOf('{')
            const lastClose = combined.lastIndexOf('}')
            let toSubstitute: string
            if (lastOpen > lastClose) {
              // Hold the trailing partial in buffer for next chunk
              toSubstitute = combined.slice(0, lastOpen)
              pendingPlaceholder = combined.slice(lastOpen)
            } else {
              toSubstitute = combined
              pendingPlaceholder = ''
            }
            if (!toSubstitute) continue
            const substituted = validateAndSubstitute(toSubstitute, ctx, stats)
            if (substituted) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: substituted })}\n\n`))
              enqueued = true
            }
          } catch {
            // skip malformed JSON
          }
        }
        // Retourner seulement si des données ont été enfilées ; sinon continuer la
        // boucle pour lire le prochain chunk. Évite un blocage si le chunk courant
        // ne contient que des lignes ignorées (ex. "data: [DONE]").
        if (enqueued) {
          chunksWithoutOutput = 0
          return
        }
        chunksWithoutOutput++
        if (chunksWithoutOutput > MAX_CHUNKS_WITHOUT_OUTPUT) {
          console.error('[simulateur-v2] stream loop guard: aborting after', chunksWithoutOutput, 'chunks without output')
          // Force la fermeture propre avec ESTIMATION_DATA pour ne pas casser le client
          const payload = JSON.stringify(ctx)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '\n\n[ESTIMATION_DATA]' + payload + '[/ESTIMATION_DATA]\n' })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          closed = true
          try { onClose() } catch { /* ignore */ }
          return
        }
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {})
    },
  })
}

function fallbackResponse(extraHeaders?: Record<string, string>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const text = 'Désolé, je n\'arrive pas à finaliser cette estimation. Tu peux publier directement ta demande :\n'
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '[CTA_BOURSE_AUX_MARCHES]\n' })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '[CTA_CONSEILLER_VITFIX]\n' })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...(extraHeaders ?? {}),
    },
  })
}
