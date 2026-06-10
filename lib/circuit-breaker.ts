// ── Circuit Breaker Pattern ─────────────────────────────────────────────────
// Prevents cascading failures when external services are down.
// States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (testing).
//
// État PARTAGÉ via Upstash Redis (audit 2026-06-10, ex-limitation « F08 »).
// Auparavant l'état vivait dans un Map module-level : sur Cloudflare Workers /
// serverless multi-isolate, chaque isolate avait son propre compteur → le
// breaker ne déclenchait jamais (échecs répartis) et se réinitialisait à chaque
// cold start. Désormais l'état est lu/écrit dans Redis (partagé entre isolates),
// avec TTL natif (plus de setInterval, inopérant sur Workers). Fallback en
// mémoire si Redis non configuré (dev local) — même pattern que lib/rate-limit.ts
// et lib/pending-confirmations.ts.
//
// Budget réseau : 1 lecture Redis par appel (loadState), écriture UNIQUEMENT sur
// changement d'état (succès qui referme un breaker, ou échec).
//
// ⚠️ NB (2026-06-10) : groqCircuit/govApiCircuit sont exportés mais ne sont
// PAS encore câblés dans lib/groq.ts ni ailleurs. Ce module est donc correct
// « quand utilisé » ; le câblage sur le chemin Groq est un changement de
// comportement à décider séparément (un breaker OPEN bloque tout l'IA).

import { Redis } from '@upstash/redis'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeoutMs: number
  name: string
}

interface CircuitBreakerState {
  state: CircuitState
  failures: number
  lastFailure: number
  lastSuccess: number
}

// ── Backend Redis (production) ───────────────────────────────────────────────
let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}
const REDIS_PREFIX = 'fixit:cb:'
const STATE_TTL_SEC = 3_600 // 1 h — purge auto des breakers inactifs

// ── Fallback mémoire (dev local sans Redis) ──────────────────────────────────
const circuits = new Map<string, CircuitBreakerState>()
const MAX_CIRCUITS = 20
const STALE_CIRCUIT_MS = 3_600_000

function cleanupStaleCircuits() {
  if (circuits.size <= MAX_CIRCUITS) return
  const now = Date.now()
  for (const [name, circuit] of circuits) {
    if (circuit.state === 'CLOSED' && now - circuit.lastSuccess > STALE_CIRCUIT_MS) {
      circuits.delete(name)
    }
  }
}

function defaultState(): CircuitBreakerState {
  return { state: 'CLOSED', failures: 0, lastFailure: 0, lastSuccess: Date.now() }
}

async function loadState(name: string): Promise<CircuitBreakerState> {
  if (redis) {
    try {
      const s = await redis.get<CircuitBreakerState>(REDIS_PREFIX + name)
      return s ?? defaultState()
    } catch (e) {
      console.warn('[circuit-breaker] Redis get failed, fallback mémoire:', e)
    }
  }
  if (!circuits.has(name)) {
    cleanupStaleCircuits()
    circuits.set(name, defaultState())
  }
  return circuits.get(name)!
}

async function saveState(name: string, st: CircuitBreakerState): Promise<void> {
  if (redis) {
    try {
      await redis.set(REDIS_PREFIX + name, st, { ex: STATE_TTL_SEC })
      return
    } catch (e) {
      console.warn('[circuit-breaker] Redis set failed, fallback mémoire:', e)
    }
  }
  circuits.set(name, st)
}

export function createCircuitBreaker(options: CircuitBreakerOptions) {
  const { failureThreshold = 5, resetTimeoutMs = 30000, name } = options

  return async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const circuit = await loadState(name) // 1 lecture

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailure > resetTimeoutMs) {
        // Fenêtre de test : on laisse passer cet appel (HALF_OPEN). L'état final
        // sera persisté selon l'issue (succès → CLOSED, échec → OPEN).
        circuit.state = 'HALF_OPEN'
      } else {
        throw new Error(`Circuit breaker [${name}] is OPEN — service temporarily unavailable`)
      }
    }

    try {
      const result = await fn()
      // Écriture seulement si l'état change réellement (referme un breaker).
      if (circuit.state !== 'CLOSED' || circuit.failures !== 0) {
        circuit.state = 'CLOSED'
        circuit.failures = 0
        circuit.lastSuccess = Date.now()
        await saveState(name, circuit)
      }
      return result
    } catch (error) {
      circuit.failures++
      circuit.lastFailure = Date.now()
      if (circuit.failures >= failureThreshold) {
        circuit.state = 'OPEN'
      }
      await saveState(name, circuit)
      throw error
    }
  }
}

// Pre-configured circuit breakers for external services
export const groqCircuit = createCircuitBreaker({ name: 'groq', failureThreshold: 5, resetTimeoutMs: 30000 })
export const govApiCircuit = createCircuitBreaker({ name: 'api-gouv', failureThreshold: 3, resetTimeoutMs: 60000 })
