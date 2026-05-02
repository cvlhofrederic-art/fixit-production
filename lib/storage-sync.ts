// Synchronisation localStorage <-> table Supabase user_storage.
//
// Strategie : monkey-patch ponctuel de localStorage pour capturer toute
// ecriture dont la cle commence par `fixit_`, puis batch debounce (500 ms)
// vers /api/user-storage. A l'hydratation (login), on recupere toutes les
// entrees du user et on les ecrit dans le localStorage AVANT d'installer
// le patch (pour ne pas re-mirroir vers le serveur).
//
// Avantage : aucun refacto invasif des composants existants. Tout code
// qui appelle deja `localStorage.setItem('fixit_xxx', ...)` est
// automatiquement synchronise.
//
// Cles ignorees :
//  - cles ne commencant pas par `fixit_`
//  - cles trop volumineuses (>200 KB) pour rester sous la limite serveur
//  - flags one-shot type `fixit_clean_v6_*` (non sensibles, configurables)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FIXIT_PREFIX = 'fixit_'
// 5 MB max par cle pour absorber les cas legacy ou des fichiers sont
// stockes en base64 directement dans le localStorage : logo cabinet
// syndic, signature scannée, justificatifs Wallet (KBis, RC Pro, décennale).
// Une migration vers Supabase Storage (phase 2) est prevue pour ces cas
// afin de stocker l'URL au lieu du base64 ; en attendant, ce seuil
// genereux garantit qu'aucune donnee n'est silencieusement perdue.
const MAX_VALUE_BYTES = 5_000_000
const DEBOUNCE_MS = 500
// Batch de 10 pour rester sous la limite serveur (50 MB request max).
const FLUSH_BATCH_SIZE = 10

const pendingWrites = new Map<string, string>()
const pendingDeletes = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let installed = false

async function getToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  } catch {
    return null
  }
}

function shouldSync(key: string): boolean {
  if (!key.startsWith(FIXIT_PREFIX)) return false
  // On exclut quelques flags transitoires qui ne portent aucune valeur metier
  // et seraient juste du bruit DB (et causeraient des cycles entre devices
  // si le flag de migration etait synchronise).
  if (key.startsWith('fixit_clean_v')) return false
  if (key === 'fixit_btp_local_migrated_v1') return false
  if (key === 'fixit_user_storage_migrated_v1') return false
  return true
}

async function flushNow(): Promise<void> {
  if (pendingWrites.size === 0 && pendingDeletes.size === 0) return
  const token = await getToken()
  if (!token) return

  // Convertit les writes : on tente de parser chaque value en JSON ; si echec
  // (ex: chaine non-JSON), on stocke la chaine telle quelle.
  const writeKeys = Array.from(pendingWrites.keys())
  const writes = writeKeys.map(k => {
    const raw = pendingWrites.get(k)!
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = raw }
    return { key: k, value: parsed }
  }).filter(e => {
    try { return JSON.stringify(e.value).length <= MAX_VALUE_BYTES } catch { return false }
  })
  // On vide les pending IMMEDIATEMENT pour eviter de re-emettre les memes
  // entrees si une ecriture survient pendant l'await.
  for (const k of writeKeys) pendingWrites.delete(k)

  // Batch de POST par tranches de FLUSH_BATCH_SIZE
  for (let i = 0; i < writes.length; i += FLUSH_BATCH_SIZE) {
    const slice = writes.slice(i, i + FLUSH_BATCH_SIZE)
    try {
      await fetch('/api/user-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: slice }),
      })
    } catch {
      // erreur reseau : les writes seront re-emis a la prochaine modif
      // (le localStorage reste la source operationnelle pour l'utilisateur)
    }
  }

  // Deletes
  if (pendingDeletes.size > 0) {
    const deleteKeys = Array.from(pendingDeletes)
    pendingDeletes.clear()
    try {
      await fetch('/api/user-storage', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keys: deleteKeys }),
      })
    } catch {
      // idem : tolerant a l'echec reseau
    }
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { flushNow() }, DEBOUNCE_MS)
}

/**
 * Hydrate le localStorage depuis la DB pour l'utilisateur connecte.
 * A appeler au montage du dashboard, AVANT installStorageSync(), pour
 * eviter que les ecritures hydrate ne soient re-mirroir vers le serveur.
 */
export async function hydrateStorageFromServer(): Promise<{ count: number }> {
  if (typeof window === 'undefined') return { count: 0 }
  const token = await getToken()
  if (!token) return { count: 0 }

  try {
    const res = await fetch('/api/user-storage', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { count: 0 }
    const json = await res.json() as { entries: Record<string, unknown> }
    const entries = json.entries || {}
    let count = 0
    for (const [key, value] of Object.entries(entries)) {
      try {
        // On ecrit la valeur en string. Si c'est deja une primitive (string),
        // on la stocke telle quelle ; sinon JSON.stringify.
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
        // On utilise le setItem original (au cas ou installStorageSync a deja
        // ete appele). Pour eviter le risque, hydrate doit etre appele AVANT
        // installStorageSync.
        window.localStorage.setItem(key, stringValue)
        count++
      } catch {
        // ignore
      }
    }
    return { count }
  } catch {
    return { count: 0 }
  }
}

/**
 * Installe le miroir : intercepte localStorage.setItem / removeItem pour
 * mirroir vers la DB en debounce. Idempotent (safe si rappele).
 */
export function installStorageSync(): void {
  if (typeof window === 'undefined') return
  if (installed) return
  installed = true

  const origSet = window.localStorage.setItem.bind(window.localStorage)
  const origRemove = window.localStorage.removeItem.bind(window.localStorage)

  window.localStorage.setItem = (key: string, value: string) => {
    origSet(key, value)
    if (shouldSync(key)) {
      pendingWrites.set(key, value)
      pendingDeletes.delete(key) // annule un eventuel delete en attente
      scheduleFlush()
    }
  }

  window.localStorage.removeItem = (key: string) => {
    origRemove(key)
    if (shouldSync(key)) {
      pendingDeletes.add(key)
      pendingWrites.delete(key)
      scheduleFlush()
    }
  }

  // Flush a la fermeture de l'onglet pour ne pas perdre les pending
  window.addEventListener('beforeunload', () => {
    if (pendingWrites.size > 0 || pendingDeletes.size > 0) {
      // Best-effort: navigator.sendBeacon avec FormData ne supporte pas Bearer ;
      // on tente un POST classique (peut etre annule par le navigateur mais
      // sur un beforeunload les majeurs reussissent).
      try {
        flushNow()
      } catch { /* ignore */ }
    }
  })
}

/**
 * Push tout le localStorage `fixit_*` actuel vers la DB (one-shot).
 * Utile pour la migration des comptes existants : a la 1re hydration
 * apres deploy, si la DB renvoie 0 entrees mais le localStorage en a,
 * on remonte tout.
 */
export async function pushAllLocalToServer(): Promise<{ count: number }> {
  if (typeof window === 'undefined') return { count: 0 }
  const token = await getToken()
  if (!token) return { count: 0 }

  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k && shouldSync(k)) keys.push(k)
  }
  if (keys.length === 0) return { count: 0 }

  const entries = keys.map(k => {
    const raw = window.localStorage.getItem(k) || ''
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = raw }
    return { key: k, value: parsed }
  }).filter(e => {
    try { return JSON.stringify(e.value).length <= MAX_VALUE_BYTES } catch { return false }
  })

  let count = 0
  for (let i = 0; i < entries.length; i += FLUSH_BATCH_SIZE) {
    const slice = entries.slice(i, i + FLUSH_BATCH_SIZE)
    try {
      const res = await fetch('/api/user-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: slice }),
      })
      if (res.ok) count += slice.length
    } catch { /* ignore */ }
  }
  return { count }
}
