// Cross-encoder reranker via Cloudflare Workers AI (@cf/baai/bge-reranker-base).
// Étape 4 du retrieval multi-étapes : on prend les top-N (~20-50) candidats issus
// de la recherche hybride et on les re-score avec un modèle qui voit la paire
// (query, document) — beaucoup plus précis qu'un score de similarity vectorielle.
//
// Gain typique : +20-30% de precision@5 sur des questions juridiques où le
// vocabulaire de la question diffère du vocabulaire du texte de loi.

const RERANKER_MODEL = '@cf/baai/bge-reranker-base'

interface RerankInput {
  query: string
  /** Documents à scorer (typiquement le contenu d'un chunk) */
  contexts: { text: string }[]
}

interface RerankResponse {
  result?: {
    response?: Array<{ id: number; score: number }>
  }
  success: boolean
  errors?: Array<{ code: number; message: string }>
}

export interface RerankCandidate<T> {
  /** Document original (typed pour préserver les métadonnées) */
  document: T
  /** Texte à scorer face à la query */
  text: string
}

export interface RerankedCandidate<T> {
  document: T
  /** Score du reranker (typiquement entre -10 et +10, plus haut = plus pertinent) */
  rerankScore: number
}

interface RerankOptions {
  accountId?: string
  apiToken?: string
  timeoutMs?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiBinding?: any
}

function getCredentials(opts?: RerankOptions): { accountId: string; apiToken: string } {
  const accountId = opts?.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = opts?.apiToken ?? process.env.CLOUDFLARE_API_TOKEN
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not configured')
  if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN is not configured')
  return { accountId, apiToken }
}

async function tryGetAIBinding(): Promise<unknown | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@opennextjs/cloudflare')
    if (typeof mod.getCloudflareContext === 'function') {
      const ctx = await mod.getCloudflareContext({ async: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx as any)?.env?.AI ?? null
    }
  } catch {
    return null
  }
  return null
}

/**
 * Re-rank une liste de candidats par rapport à une question.
 * Préserve les documents typés (les métadonnées chunk passent à travers).
 * Retourne les candidats triés par score décroissant.
 *
 * Limite : max 100 candidats par appel (au-delà : split + merge nécessaire).
 */
export async function rerank<T>(
  query: string,
  candidates: RerankCandidate<T>[],
  opts?: RerankOptions,
): Promise<RerankedCandidate<T>[]> {
  if (candidates.length === 0) return []
  if (candidates.length > 100) {
    throw new Error('rerank: > 100 candidates not supported (split before calling)')
  }

  // 1. Préfère le binding AI si disponible
  const binding = opts?.aiBinding ?? await tryGetAIBinding()
  if (binding) {
    const timeoutMs = opts?.timeoutMs ?? 8_000
    const bRes = await Promise.race([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (binding as any).run(RERANKER_MODEL, {
        query,
        contexts: candidates.map((c) => ({ text: c.text })),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI binding rerank timeout')), timeoutMs),
      ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ]) as any
    const scores = bRes?.response
    if (!Array.isArray(scores)) {
      throw new Error('rerank: invalid response from binding (missing response array)')
    }
    return scores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => ({
        document: candidates[s.id]?.document as T,
        rerankScore: s.score,
      }))
      .filter((c: RerankedCandidate<T>) => c.document !== undefined)
      .sort((a: RerankedCandidate<T>, b: RerankedCandidate<T>) => b.rerankScore - a.rerankScore)
  }

  // 2. Fallback REST API
  const { accountId, apiToken } = getCredentials(opts)
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${RERANKER_MODEL}`

  const payload: RerankInput = {
    query,
    contexts: candidates.map((c) => ({ text: c.text })),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 15_000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`rerank: CF AI returned ${res.status} — ${errText.slice(0, 200)}`)
  }

  const json = (await res.json()) as RerankResponse
  if (!json.success) {
    const reason = json.errors?.[0]?.message ?? 'unknown'
    throw new Error(`rerank: CF AI error — ${reason}`)
  }

  const scores = json.result?.response
  if (!Array.isArray(scores)) {
    throw new Error('rerank: invalid response (missing result.response array)')
  }

  // BGE-reranker retourne [{id, score}] où id = index dans le contexts[] envoyé.
  return scores
    .map((s) => ({
      document: candidates[s.id]?.document as T,
      rerankScore: s.score,
    }))
    .filter((c) => c.document !== undefined)
    .sort((a, b) => b.rerankScore - a.rerankScore)
}

/**
 * Maximum Marginal Relevance — étape 5 du retrieval pour éviter d'avoir 5 chunks
 * quasi-identiques dans le top final. Sélectionne des chunks pertinents ET divers.
 *
 * @param ranked candidats déjà rerankés (premier = meilleur)
 * @param k taille du top final voulue
 * @param lambda 0..1 — 1 = pertinence pure (ignore diversité), 0 = diversité pure
 * @param sim fonction de similarity entre deux documents (cosine sur embeddings recommandé)
 */
export function mmrFilter<T>(
  ranked: RerankedCandidate<T>[],
  k: number,
  lambda: number,
  sim: (a: T, b: T) => number,
): RerankedCandidate<T>[] {
  if (ranked.length <= k) return ranked
  const selected: RerankedCandidate<T>[] = []
  const remaining = [...ranked]

  // Le premier est toujours le meilleur (selon rerankScore)
  selected.push(remaining.shift()!)

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0
    let bestMmrScore = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]
      // Pertinence normalisée approximative (rerankScore peut être négatif)
      const relevance = candidate.rerankScore
      // Max similarity avec les chunks déjà sélectionnés
      let maxSim = -Infinity
      for (const sel of selected) {
        const s = sim(candidate.document, sel.document)
        if (s > maxSim) maxSim = s
      }
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim
      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore
        bestIdx = i
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0])
  }
  return selected
}

/** Cosine similarity entre deux vecteurs. Utilitaire pour mmrFilter. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
