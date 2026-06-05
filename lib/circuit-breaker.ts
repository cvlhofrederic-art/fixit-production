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

export function createCircuitBreaker(options: CircuitBreakerOptions) {
  const { failureThreshold = 5, resetTimeoutMs = 30000, name } = options

  return async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const circuit = getCircuit(name)

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailure > resetTimeoutMs) {
        circuit.state = 'HALF_OPEN'
      } else {
        throw new Error(`Circuit breaker [${name}] is OPEN — service temporarily unavailable`)
      }
    }

    try {
      const result = await fn()
      circuit.failures = 0
      circuit.state = 'CLOSED'
      circuit.lastSuccess = Date.now()
      return result
    } catch (error) {
      circuit.failures++
      circuit.lastFailure = Date.now()

      if (circuit.failures >= failureThreshold) {
        circuit.state = 'OPEN'
      }

      throw error
    }
  }
}

// Pre-configured circuit breakers for external services
export const groqCircuit = createCircuitBreaker({ name: 'groq', failureThreshold: 5, resetTimeoutMs: 30000 })
export const govApiCircuit = createCircuitBreaker({ name: 'api-gouv', failureThreshold: 3, resetTimeoutMs: 60000 })
