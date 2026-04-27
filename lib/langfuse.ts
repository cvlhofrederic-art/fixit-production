// ── Langfuse — Observabilité IA ──────────────────────────────────────────────
// Instrumenter chaque appel LLM Groq pour tracer :
// input, output, tokens, latence, coût, agent, session vocale.
//
// Variables d'environnement requises :
//   LANGFUSE_PUBLIC_KEY  — clé publique Langfuse
//   LANGFUSE_SECRET_KEY  — clé secrète Langfuse
//   LANGFUSE_HOST        — https://cloud.langfuse.com (ou self-hosted)

import { Langfuse } from "langfuse";

// Singleton — initialisé une seule fois, réutilisé partout
let langfuseInstance: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    return null;
  }

  if (!langfuseInstance) {
    langfuseInstance = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
      // Flush automatique toutes les 5s en production
      flushInterval: 5000,
    });
  }

  return langfuseInstance;
}

// Types pour le tracing
interface TraceParams {
  agentName: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

interface GenerationParams {
  model: string;
  input: unknown;
  output?: string;
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs?: number;
  isVoiceCommand?: boolean;
  actionTriggered?: string;
}

/**
 * Crée une trace pour un appel agent IA.
 * Si Langfuse n'est pas configuré, retourne un no-op.
 */
export function traceAgent(params: TraceParams) {
  const langfuse = getLangfuse();
  if (!langfuse) {
    return {
      generation: (_g: GenerationParams) => {},
      event: (_name: string, _data?: Record<string, unknown>) => {},
      end: () => {},
    };
  }

  const trace = langfuse.trace({
    name: params.agentName,
    userId: params.userId,
    sessionId: params.sessionId,
    metadata: params.metadata,
  });

  return {
    generation(gen: GenerationParams) {
      trace.generation({
        name: `${params.agentName}-llm`,
        model: gen.model,
        input: gen.input,
        output: gen.output,
        usage: {
          input: gen.tokensInput,
          output: gen.tokensOutput,
        },
        metadata: {
          latencyMs: gen.latencyMs,
          isVoiceCommand: gen.isVoiceCommand || false,
          actionTriggered: gen.actionTriggered,
        },
      });
    },
    event(name: string, data?: Record<string, unknown>) {
      trace.event({ name, metadata: data });
    },
    end() {
      trace.update({ output: { status: "completed" } });
    },
  };
}

// ── Simulateur V2 trace helper ───────────────────────────────────────────────

export type SimulateurV2TracePayload = {
  arm: 'v1' | 'v2'
  userId?: string
  sessionId?: string
  toolCallsCount: number
  toolCallsDetail?: Array<{ name: string; latencyMs: number; success: boolean }>
  hallucinationsBlocked: number
  unknownPlaceholders: number
  mode?: 'normal' | 'out-of-catalog'
  zoneDetected?: string
  totalMin?: number
  totalMax?: number
  spreadPercent?: number
  latencyMs: number
  error?: string
}

export function traceSimulateurV2(payload: SimulateurV2TracePayload): void {
  const lf = getLangfuse()
  if (!lf) return
  try {
    lf.trace({
      name: 'simulateur-travaux',
      userId: payload.userId,
      sessionId: payload.sessionId,
      tags: [`arm:${payload.arm}`, payload.mode ? `mode:${payload.mode}` : 'mode:none'],
      metadata: {
        arm: payload.arm,
        toolCallsCount: payload.toolCallsCount,
        toolCallsDetail: payload.toolCallsDetail,
        hallucinationsBlocked: payload.hallucinationsBlocked,
        unknownPlaceholders: payload.unknownPlaceholders,
        mode: payload.mode,
        zoneDetected: payload.zoneDetected,
        totalMin: payload.totalMin,
        totalMax: payload.totalMax,
        spreadPercent: payload.spreadPercent,
        latencyMs: payload.latencyMs,
        error: payload.error,
      },
    })
  } catch (e) {
    console.warn('[langfuse] traceSimulateurV2 failed:', e)
  }
}
