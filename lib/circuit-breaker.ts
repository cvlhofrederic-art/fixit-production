// ── Circuit Breaker Pattern ─────────────────────────────────────────────────
// Prevents cascading failures when external services are down
// States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (testing)
//
// F08: KNOWN LIMITATION — In-memory state on stateless workers
// This circuit breaker stores state in a module-level Map. On platforms with
// multiple worker instances (Vercel serverless, Cloudflare Workers), each
// isolate gets its own independent state. This means:
//   - Failures on one instance don't trip the breaker on others
//   - The breaker may never reach its threshold if requests spread across instances
//   - After a cold start the breaker resets to CLOSED regardless of service health
// TODO: Migrate circuit state to a shared store (Redis / KV) for cross-instance
// coordination. Track in: https://github.com/your-org/fixit-cf/issues (F08)

import { logger } from '@/lib/logger'

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

const circuits = new Map<string, CircuitBreakerState>()
const MAX_CIRCUITS = 20
const STALE_CIRCUIT_MS = 3_600_000 // 1 hour

function cleanupStaleCircuits() {
  if (circuits.size <= MAX_CIRCUITS) return
  const now = Date.now()
  for (const [name, circuit] of circuits) {
    if (circuit.state === 'CLOSED' && now - circuit.lastSuccess > STALE_CIRCUIT_MS) {
      circuits.delete(name)
    }
  }
}

function getCircuit(name: string): CircuitBreakerState {
  if (!circuits.has(name)) {
    cleanupStaleCircuits()
    circuits.set(name, { state: 'CLOSED', failures: 0, lastFailure: 0, lastSuccess: Date.now() })
  }
  return circuits.get(name)!
}

/**
 * Mutate the circuit's state and emit a `logger.circuitState()` event ONLY
 * when the new value differs from the previous one. The Sentry alert
 * `circuit_breaker_open` (monitoring/sentry-alerts.json) keys on the tag
 * Sentry receives from this helper, so spamming it on every CLOSED tick
 * would drown the alert in noise.
 */
function transition(circuit: CircuitBreakerState, name: string, next: CircuitState) {
  if (circuit.state === next) return
  circuit.state = next
  logger.circuitState(name, next)
}

export function createCircuitBreaker(options: CircuitBreakerOptions) {
  const { failureThreshold = 5, resetTimeoutMs = 30000, name } = options

  return async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const circuit = getCircuit(name)

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailure > resetTimeoutMs) {
        transition(circuit, name, 'HALF_OPEN')
      } else {
        throw new Error(`Circuit breaker [${name}] is OPEN — service temporarily unavailable`)
      }
    }

    try {
      const result = await fn()
      circuit.failures = 0
      transition(circuit, name, 'CLOSED')
      circuit.lastSuccess = Date.now()
      return result
    } catch (error) {
      circuit.failures++
      circuit.lastFailure = Date.now()

      if (circuit.failures >= failureThreshold) {
        transition(circuit, name, 'OPEN')
      }

      throw error
    }
  }
}

// Pre-configured circuit breakers for external services
export const groqCircuit = createCircuitBreaker({ name: 'groq', failureThreshold: 5, resetTimeoutMs: 30000 })
export const govApiCircuit = createCircuitBreaker({ name: 'api-gouv', failureThreshold: 3, resetTimeoutMs: 60000 })

/**
 * Read-only snapshot of a circuit's current state. Used by the health
 * endpoint and the SLO alert pipeline. Returns null if the circuit has
 * never been exercised (the breaker is CLOSED-by-default but we want
 * the consumer to be able to distinguish "never used" from "actively
 * healthy".)
 */
export function getCircuitState(name: string): {
  state: CircuitState
  failures: number
  last_success_at: string | null
  last_failure_at: string | null
} | null {
  const circuit = circuits.get(name)
  if (!circuit) return null
  return {
    state: circuit.state,
    failures: circuit.failures,
    last_success_at: circuit.lastSuccess > 0 ? new Date(circuit.lastSuccess).toISOString() : null,
    last_failure_at: circuit.lastFailure > 0 ? new Date(circuit.lastFailure).toISOString() : null,
  }
}
