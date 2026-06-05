// Helper partagé pour les routes d'agents IA en mode streaming SSE.
// Enveloppe le ReadableStream Groq dans un TransformStream qui résout les tokens
// PII (sanitization Plan B) en buffering les chunks pour éviter les coupures
// de tokens (`<email:abc` / `12345>`).
//
// Utilisé par : max-ai/route.ts, lea-comptable/route.ts (et alfredo-chat futur).

import { resolveSanitizedToken } from '@/lib/ai/sanitize-context'

/**
 * Enveloppe un ReadableStream SSE Groq pour résoudre les tokens PII à la volée.
 * Gère le buffering anti-coupure (un token `<type:hash>` peut être split entre
 * 2 chunks SSE).
 *
 * @param rawStream — flux SSE brut de l'API Groq
 * @param tokenMap — map de tokens à résoudre (créée par sanitizeContextForLLM)
 * @returns ReadableStream prêt à renvoyer comme Response body
 */
export function wrapGroqStreamWithPIIResolution(
  rawStream: ReadableStream<Uint8Array>,
  tokenMap: Map<string, string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let chunkBuffer = ''

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true })
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

  rawStream.pipeTo(writable).catch(() => {
    // stream annulé côté client — ignorer
  })

  return readable
}

/**
 * Headers standards pour une réponse SSE.
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
} as const
