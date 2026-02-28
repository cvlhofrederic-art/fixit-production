// ── Circuit Breaker Pattern ─────────────────────────────────────────────────
// Prevents cascading failures when external services are down
// States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (testing)

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerOptions {
  failureThreshold: number  // failures before opening
  resetTimeoutMs: number    // time before trying again
  name: string
}

interface CircuitBreakerState {
  state: CircuitState
  failures: number
  lastFailure: number
  lastSuccess: number
}

const circuits = new Map<string, CircuitBreakerState>()

function getCircuit(name: string): CircuitBreakerState {
  if (!circuits.has(name)) {
    circuits.set(name, { state: 'CLOSED', failures: 0, lastFailure: 0, lastSuccess: Date.now() })
  }
  return circuits.get(name)!
}

export function createCircuitBreaker(options: CircuitBreakerOptions) {
  const { failureThreshold = 5, resetTimeoutMs = 30000, name } = options

  return async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const circuit = getCircuit(name)

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailure > resetTimeoutMs) {
        circuit.state = 'HALF_OPEN'
      } else {
        throw new Error(`Circuit breaker [${name}] is OPEN — service temporarily unavailable`)
      }
    }

    try {
      const result = await fn()
      // Success: reset circuit
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
