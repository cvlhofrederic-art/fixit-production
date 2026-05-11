/**
 * Sanitization PII pour prompts LLM.
 *
 * Remplace emails, téléphones FR/PT, IBAN, adresses postales par des tokens
 * <type:hash8>. Conserve un tokenMap pour résolution post-action.
 * Cf. spec §3.7.
 */

const EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
const IBAN_RE =
  /\b([A-Z]{2}[0-9]{2}(?:(?:\s[A-Z0-9]{4}){2,7}(?:\s[A-Z0-9]{1,3})?|[A-Z0-9]{11,30}))\b/g
const PHONE_FR_RE = /(?:\+33|0033|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g
const PHONE_PT_RE = /\+351[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}/g
const ADDRESS_HINT_RE =
  /\b\d+\s+(?:rue|avenue|boulevard|impasse|allée|chemin|place|quai|rua|avenida|travessa|largo)\b[^,\n]{0,80}/gi

interface SanitizeOptions {
  keepFirstName?: boolean
}

interface SanitizeResult<T> {
  sanitized: T
  tokenMap: Map<string, string>
}

function hashToken(value: string, sessionSalt: string): string {
  let hash = 2166136261
  const input = sessionSalt + value
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function sanitizeString(
  value: string,
  tokenMap: Map<string, string>,
  valueToToken: Map<string, string>,
  salt: string,
): string {
  let out = value
  const replace = (re: RegExp, type: string) => {
    out = out.replace(re, (match) => {
      const existing = valueToToken.get(match)
      if (existing) return existing
      const token = `<${type}:${hashToken(match, salt)}>`
      tokenMap.set(token, match)
      valueToToken.set(match, token)
      return token
    })
  }

  // Ordre important : IBAN avant phone (IBAN PT contient des chiffres qui
  // pourraient être confondus avec un numéro PT), email avant adresse.
  replace(IBAN_RE, 'iban')
  replace(EMAIL_RE, 'email')
  replace(PHONE_PT_RE, 'phone')
  replace(PHONE_FR_RE, 'phone')
  replace(ADDRESS_HINT_RE, 'address')

  return out
}

function deepSanitize<T>(
  value: T,
  tokenMap: Map<string, string>,
  valueToToken: Map<string, string>,
  salt: string,
  visited: WeakSet<object>,
  depth: number,
): T {
  if (depth > 50) return value
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return sanitizeString(value, tokenMap, valueToToken, salt) as unknown as T
  }
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    if (visited.has(value)) return value
    visited.add(value)
    return value.map((item) =>
      deepSanitize(item, tokenMap, valueToToken, salt, visited, depth + 1),
    ) as unknown as T
  }
  if (visited.has(value as object)) return value
  visited.add(value as object)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepSanitize(v, tokenMap, valueToToken, salt, visited, depth + 1)
  }
  return out as unknown as T
}

export function sanitizeContextForLLM<T>(
  data: T,
  options?: SanitizeOptions,
): SanitizeResult<T> {
  void options // placeholder pour évolution future (keepFirstName)
  const tokenMap = new Map<string, string>()
  const valueToToken = new Map<string, string>()
  const salt = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const sanitized = deepSanitize(data, tokenMap, valueToToken, salt, new WeakSet(), 0)
  return { sanitized, tokenMap }
}

const TOKEN_RE = /<(email|phone|iban|address):[a-f0-9]{8}>/g
const EXACT_TOKEN_RE = /^<(email|phone|iban|address):[a-f0-9]{8}>$/

export function resolveSanitizedToken(
  input: string,
  tokenMap: Map<string, string>,
): string | null {
  if (EXACT_TOKEN_RE.test(input)) {
    return tokenMap.get(input) ?? null
  }
  return input.replace(TOKEN_RE, (token) => tokenMap.get(token) ?? token)
}
