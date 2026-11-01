/**
 * Validation des URL avant une redirection ou l'ouverture d'un onglet (lot 3 du brief sécurité
 * Aikido du 28/10/2026, issue 7).
 *
 * Une URL venue d'une API, de la base ou d'un utilisateur peut porter un schéma exécutable
 * (javascript:, data:, vbscript:) ou mener vers un site de phishing. `toSafeUrl` n'accepte que
 * le https (http sur localhost hors production), restreint à une liste d'origines quand elle est
 * fournie, ou un chemin interne quand `allowRelative` est demandé. `safeOpen` et `safeNavigate`
 * refusent tout le reste et l'ouverture se fait toujours avec noopener,noreferrer.
 *
 * Côté appelant : toujours fournir `allowedOrigins`, ou `allowRelative` seul pour une navigation
 * interne. `allowRelative` sans liste d'origines n'accepte que l'origine courante : un chemin
 * (« /dashboard ») ou une URL absolue de la page elle-même ; « https://evil.example » est refusée,
 * ce qui ferme la redirection ouverte du type `safeNavigate(searchParams.get('next'), …)`.
 * Les URL blob: créées localement pour un aperçu PDF ne passent pas par ici (refusées par
 * construction) : elles sont ouvertes directement par le code qui les crée.
 */
export type SafeUrlOptions = { allowedOrigins?: readonly string[]; allowRelative?: boolean }

export function toSafeUrl(raw: unknown, opts: SafeUrlOptions = {}): URL | null {
  if (typeof window === 'undefined' || typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null

  // Chemin interne : « /dashboard » oui, « //evil.example » et « /\evil.example » non
  // (interprétés comme une URL absolue vers un autre hôte).
  if (opts.allowRelative && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    try {
      const url = new URL(value, window.location.origin)
      return url.origin === window.location.origin ? url : null
    } catch {
      return null
    }
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const devLocal =
    process.env.NODE_ENV !== 'production' &&
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  // bloque javascript:, data:, vbscript:, blob:, file:, et http: en production
  if (url.protocol !== 'https:' && !devLocal) return null
  // Navigation interne demandée sans liste d'origines : une URL absolue doit être celle de la page
  // courante (« https:evil.example » est normalisée en https://evil.example/ et arrive ici).
  const origines = opts.allowedOrigins ?? (opts.allowRelative ? [window.location.origin] : undefined)
  if (origines && !origines.includes(url.origin)) return null
  return url
}

/** Ouvre `raw` dans un nouvel onglet (noopener,noreferrer). Vrai si l'URL a été acceptée et ouverte. */
export function safeOpen(raw: unknown, opts: SafeUrlOptions): boolean {
  const url = toSafeUrl(raw, opts)
  if (!url) {
    console.warn('[safe-url] URL refusée')
    return false
  }
  window.open(url.toString(), '_blank', 'noopener,noreferrer')
  return true
}

/** Redirige la page vers `raw`. Vrai si l'URL a été acceptée et la navigation lancée. */
export function safeNavigate(raw: unknown, opts: SafeUrlOptions): boolean {
  const url = toSafeUrl(raw, opts)
  if (!url) {
    console.warn('[safe-url] redirection refusée')
    return false
  }
  window.location.assign(url.toString())
  return true
}

/**
 * Origine du stockage Supabase : les URL signées ou publiques renvoyées par les routes d'upload et
 * de documents (`createSignedUrl`, `getPublicUrl`) sont servies depuis l'URL du projet Supabase.
 * Liste vide si `NEXT_PUBLIC_SUPABASE_URL` manque ou n'est pas une URL : toute ouverture est alors
 * refusée plutôt qu'acceptée sans contrôle.
 */
export function originesSupabase(): string[] {
  const brut = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!brut) {
    console.warn('[safe-url] NEXT_PUBLIC_SUPABASE_URL absente : ouverture des documents refusée')
    return []
  }
  try {
    return [new URL(brut).origin]
  } catch {
    console.warn('[safe-url] NEXT_PUBLIC_SUPABASE_URL invalide : ouverture des documents refusée')
    return []
  }
}

/**
 * Vrai si `raw` est une URL https servie par le stockage Supabase (`originesSupabase()`).
 * Utilisable côté serveur (pas besoin de `window`) : une route qui enregistre en base une URL
 * fournie par le client ne garde ainsi que ce que les pages, via `safeOpen`, accepteront d'ouvrir.
 */
export function estUrlStockageSupabase(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return false
  }
  return url.protocol === 'https:' && originesSupabase().includes(url.origin)
}
