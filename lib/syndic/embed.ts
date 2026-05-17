// Helper d'embedding via Cloudflare Workers AI (modèle BGE-M3, 1024 dims).
// Multilingue de premier rang (top MTEB pour PT), gratuit dans le free tier
// CF Workers AI (10K req/jour). Utilisé pour :
//   - Ingestion (script Node) : embed chaque chunk du corpus juridique
//   - Runtime (route max-ai) : embed la question utilisateur pour retrieval
//
// Variables d'env requises :
//   CLOUDFLARE_ACCOUNT_ID — déjà présent (secret CF)
//   CLOUDFLARE_API_TOKEN  — à ajouter via `wrangler secret put CLOUDFLARE_API_TOKEN`
//                            (token avec Workers AI scope)

const BGE_M3_MODEL = '@cf/baai/bge-m3'
const EMBED_DIM = 1024

interface CloudflareAIResponse {
  result?: {
    shape?: number[]
    data?: number[][]
  }
  success: boolean
  errors?: Array<{ code: number; message: string }>
}

interface EmbedOptions {
  /** Override account ID (default: process.env.CLOUDFLARE_ACCOUNT_ID) */
  accountId?: string
  /** Override API token (default: process.env.CLOUDFLARE_API_TOKEN) */
  apiToken?: string
  /** Timeout en millisecondes (défaut 15s) */
  timeoutMs?: number
}

function getCredentials(opts?: EmbedOptions): { accountId: string; apiToken: string } {
  const accountId = opts?.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = opts?.apiToken ?? process.env.CLOUDFLARE_API_TOKEN
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not configured')
  if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN is not configured')
  return { accountId, apiToken }
}

/**
 * Embed un seul texte. Retourne un vecteur 1024-dimensionnel.
 * Pour batcher, voir embedBatch().
 */
export async function embedText(text: string, opts?: EmbedOptions): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('embedText: input text is empty')
  const { accountId, apiToken } = getCredentials(opts)
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${BGE_M3_MODEL}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: [trimmed] }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 15_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`embedText: CF AI returned ${res.status} — ${errText.slice(0, 200)}`)
  }

  const json = (await res.json()) as CloudflareAIResponse
  if (!json.success) {
    const reason = json.errors?.[0]?.message ?? 'unknown'
    throw new Error(`embedText: CF AI error — ${reason}`)
  }

  const vec = json.result?.data?.[0]
  if (!vec || vec.length !== EMBED_DIM) {
    throw new Error(`embedText: invalid vector shape (expected ${EMBED_DIM}, got ${vec?.length})`)
  }
  return vec
}

/**
 * Embed un batch de textes en un seul appel. BGE-M3 accepte plusieurs textes.
 * Plus efficace que des appels en parallèle pour l'ingestion.
 * Recommandation : batch ≤ 32 pour rester sous les limites de payload.
 */
export async function embedBatch(texts: string[], opts?: EmbedOptions): Promise<number[][]> {
  const cleaned = texts.map((t) => t.trim()).filter((t) => t.length > 0)
  if (cleaned.length === 0) return []
  if (cleaned.length > 100) {
    throw new Error('embedBatch: batch size > 100 is not supported (split before calling)')
  }
  const { accountId, apiToken } = getCredentials(opts)
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${BGE_M3_MODEL}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: cleaned }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 30_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`embedBatch: CF AI returned ${res.status} — ${errText.slice(0, 200)}`)
  }

  const json = (await res.json()) as CloudflareAIResponse
  if (!json.success) {
    const reason = json.errors?.[0]?.message ?? 'unknown'
    throw new Error(`embedBatch: CF AI error — ${reason}`)
  }

  const data = json.result?.data
  if (!Array.isArray(data) || data.length !== cleaned.length) {
    throw new Error(`embedBatch: expected ${cleaned.length} vectors, got ${data?.length}`)
  }
  for (const v of data) {
    if (!Array.isArray(v) || v.length !== EMBED_DIM) {
      throw new Error(`embedBatch: invalid vector shape (expected ${EMBED_DIM})`)
    }
  }
  return data
}

/** Format pgvector pour insertion SQL : "[0.1,0.2,...]" */
export function formatVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`
}

export const EMBED_DIMENSION = EMBED_DIM
