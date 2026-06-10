// ── Langfuse — Observabilité IA ──────────────────────────────────────────────
// Instrumenter chaque appel LLM Groq pour tracer :
// input, output, tokens, latence, coût, agent, session vocale.
//
// Variables d'environnement requises :
//   LANGFUSE_PUBLIC_KEY  — clé publique Langfuse
//   LANGFUSE_SECRET_KEY  — clé secrète Langfuse
//   LANGFUSE_HOST        — https://cloud.langfuse.com (ou self-hosted)

import { Langfuse } from "langfuse";
import { createHash } from "node:crypto";

// ── Pseudonymisation RGPD (audit 2026-06-10, Vague 4) ───────────────────────
// Langfuse est un sous-traitant SaaS : on n'y envoie JAMAIS d'identifiant
// direct (UUID Supabase = donnée personnelle, RGPD art. 4(1)) ni de PII brute
// (emails, téléphones) dans les prompts/réponses. Le hash salé corrèle les
// traces d'un même utilisateur sans permettre de remonter à la personne.
const PII_SALT = process.env.LANGFUSE_PII_SALT || process.env.LANGFUSE_PUBLIC_KEY || "vitfix-lf";

export function pseudonymizeUserId(userId?: string): string | undefined {
  if (!userId) return undefined;
  return createHash("sha256").update(`${PII_SALT}:${userId}`).digest("hex").slice(0, 16);
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Formats FR (+33/0X XX XX XX XX) et PT (+351 XXX XXX XXX, 9 chiffres)
const PHONE_RE = /(?:\+33|\+351|0)\s?[1-9](?:[\s.\-]?\d{2,3}){3,4}/g;
const MAX_TRACE_TEXT = 2000;

// Sérialise puis nettoie une valeur destinée à Langfuse : PII masquée,
// texte tronqué (les prompts complets restent consultables côté serveur via
// les logs internes, pas chez le sous-traitant).
export function scrubForTrace(value: unknown): string | undefined {
  if (value == null) return undefined;
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  let s = raw.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[tel]");
  if (s.length > MAX_TRACE_TEXT) s = `${s.slice(0, MAX_TRACE_TEXT)}… [tronqué ${raw.length} chars]`;
  return s;
}

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
export function createAgentTrace(params: TraceParams) {
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
    userId: pseudonymizeUserId(params.userId),
    sessionId: params.sessionId,
    metadata: params.metadata,
  });

  return {
    generation(gen: GenerationParams) {
      trace.generation({
        name: `${params.agentName}-llm`,
        model: gen.model,
        input: scrubForTrace(gen.input),
        output: scrubForTrace(gen.output),
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

// ── traceAgent générique (Plan D) ────────────────────────────────────────────

import type { AgentId } from './syndic/agent-types'

export interface TraceAgentParams {
  agent_id: AgentId | string
  conversation_id?: string
  user_id: string
  prompt?: string
  response?: string
  tools_called?: string[]
  metadata?: Record<string, unknown>
}

export async function traceAgent<T>(
  params: TraceAgentParams,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now()
  let success = false
  let result: T | undefined
  let error: unknown = null
  try {
    result = await fn()
    success = true
    return result
  } catch (e) {
    error = e
    throw e
  } finally {
    const latency_ms = Date.now() - start
    try {
      const lf = getLangfuse()
      if (lf) {
        const t = lf.trace({
          name: `agent:${params.agent_id}`,
          userId: pseudonymizeUserId(params.user_id),
          sessionId: params.conversation_id,
          input: scrubForTrace(params.prompt),
          output: scrubForTrace(params.response),
          metadata: {
            ...params.metadata,
            latency_ms,
            success,
            error: error instanceof Error ? error.message : undefined,
            tools_called: params.tools_called,
          },
        })
        t.update({ output: { status: success ? 'completed' : 'error' } })
      }
    } catch {
      // Ne jamais bloquer le path utilisateur sur une erreur Langfuse
    }
  }
}

export function traceSimulateurV2(payload: SimulateurV2TracePayload): void {
  const lf = getLangfuse()
  if (!lf) return
  try {
    lf.trace({
      name: 'simulateur-travaux',
      userId: pseudonymizeUserId(payload.userId),
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
