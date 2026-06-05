// Récupération des erreurs de chargement de chunk Next.js (« ChunkLoadError »).
//
// Contexte. Le dashboard charge ses sections en lazy (next/dynamic, ssr:false).
// À chaque déploiement Cloudflare Workers (OpenNext), les chunks `/_next/static`
// sont ré-hashés et les anciens fichiers ne sont PAS conservés (contrairement à
// Vercel qui garde les assets immuables un temps). Un onglet resté ouvert pendant
// un déploiement référence donc des chunks qui n'existent plus : naviguer vers une
// section pas encore chargée déclenche un 404 → ChunkLoadError. Le bouton
// « Réessayer » re-demande le même chunk mort et ne peut pas guérir ; seul un
// rechargement complet récupère le build courant (HTML + manifest à jour).
//
// On recharge UNE fois, protégé par un marqueur sessionStorage, pour ne pas
// boucler à l'infini si le chunk manque réellement dans le build courant
// (déploiement cassé) plutôt que d'être simplement périmé.

const RELOAD_MARKER_KEY = 'vitfix:chunk-reload-at'
const RELOAD_GUARD_MS = 10_000

/** Vrai si l'erreur est un échec de chargement de chunk JS/CSS (et non un bug runtime). */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  if (name === 'ChunkLoadError') return true
  if (typeof message !== 'string') return false
  return (
    /loading chunk [^\s]+ failed/i.test(message) ||
    /failed to load chunk/i.test(message) ||
    /loading css chunk [^\s]+ failed/i.test(message) ||
    /importing a module script failed/i.test(message) // Safari : échec d'import dynamique
  )
}

/** Vrai si un rechargement de récupération a déjà eu lieu très récemment. */
export function hasRecentReload(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const prev = Number(window.sessionStorage.getItem(RELOAD_MARKER_KEY) || '0')
    return prev > 0 && Date.now() - prev < RELOAD_GUARD_MS
  } catch {
    return false
  }
}

function markReload(): void {
  try {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()))
  } catch {
    // sessionStorage indisponible (mode privé strict) : on recharge quand même,
    // sans garde — risque résiduel négligeable (chunk périmé = guéri au 1er reload).
  }
}

// Tente un rechargement de récupération si `error` est un ChunkLoadError et
// qu'aucun reload récent n'a déjà eu lieu. Retourne true si un reload a été
// déclenché — l'appelant ne doit alors rien afficher d'autre (la page part).
export function attemptChunkReload(error: unknown): boolean {
  if (!isChunkLoadError(error)) return false
  if (typeof window === 'undefined') return false
  if (hasRecentReload()) return false
  markReload()
  window.location.reload()
  return true
}
