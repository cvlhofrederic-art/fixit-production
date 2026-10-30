// Synchronisation localStorage <-> table Supabase user_storage.
//
// Strategie : monkey-patch ponctuel de localStorage pour capturer toute
// ecriture dont la cle commence par `fixit_`, puis batch debounce (1,5 s)
// vers /api/user-storage. A l'hydratation (login), on recupere toutes les
// entrees du user et on les ecrit dans le localStorage sans repasser par le
// patch ; les envois attendent la reponse et le serveur gagne sur les
// ecritures en attente (voir hydrateStorageFromServer).
//
// Avantage : aucun refacto invasif des composants existants. Tout code
// qui appelle deja `localStorage.setItem('fixit_xxx', ...)` est
// automatiquement synchronise.
//
// Cles ignorees :
//  - cles ne commencant pas par `fixit_`
//  - cles trop volumineuses (>200 KB) pour rester sous la limite serveur
//  - flags one-shot type `fixit_clean_v6_*` (non sensibles, configurables)

// Client applicatif partagé (cookies SSR). NE PAS recréer ici un client
// @supabase/supabase-js : il lirait la session dans le localStorage (où elle
// n'est jamais présente — l'auth est en cookies), donc getToken() renverrait
// toujours null et AUCUNE donnée ne serait sauvegardée dans le cloud.
// Régression « base clients qui disparaît » (2026-06-01).
import { supabase } from '@/lib/supabase'

const FIXIT_PREFIX = 'fixit_'
// 5 MB max par cle pour absorber les cas legacy ou des fichiers sont
// stockes en base64 directement dans le localStorage : logo cabinet
// syndic, signature scannée, justificatifs Wallet (KBis, RC Pro, décennale).
// Une migration vers Supabase Storage (phase 2) est prevue pour ces cas
// afin de stocker l'URL au lieu du base64 ; en attendant, ce seuil
// genereux garantit qu'aucune donnee n'est silencieusement perdue.
const MAX_VALUE_BYTES = 5_000_000
// Lot 8 Sentry du 28/10/2026 : avec 500 ms, le chargement du dashboard pro produisait 20 POST en 10 s. Les
// écritures d'un même enchaînement partent maintenant ensemble, en un seul POST tant que la taille le permet.
const DEBOUNCE_MS = 1500
// Un POST regroupe jusqu'à FLUSH_BATCH_SIZE clés (= MAX_ENTRIES_PER_REQUEST de /api/user-storage) et
// FLUSH_BATCH_BYTES de valeurs (une clé peut peser 5 Mo : logo, signature, justificatifs en base64).
const FLUSH_BATCH_SIZE = 50
const FLUSH_BATCH_BYTES = 4_000_000

const pendingWrites = new Map<string, string>()
const pendingDeletes = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let installed = false

// Dernière valeur envoyée au serveur (ou reçue de lui) par clé : une valeur identique n'est pas renvoyée.
const derniereValeurSynchronisee = new Map<string, string>()
// setItem d'origine, capturé à l'installation du miroir : l'hydratation écrit sans repasser par le miroir
// (avant, chaque valeur reçue du serveur repartait en POST 500 ms plus tard).
let ecrireSansMiroirRef: ((key: string, value: string) => void) | null = null
// Hydratations en cours : tant qu'il y en a une, flushNow n'envoie rien (voir flushNow). Un compteur plutôt qu'un
// booléen : Providers peut lancer deux hydratations qui se chevauchent (bootstrap immédiat puis INITIAL_SESSION).
let hydratationsEnCours = 0

function ecrireSansMiroir(key: string, value: string): void {
  if (ecrireSansMiroirRef) ecrireSansMiroirRef(key, value)
  else window.localStorage.setItem(key, value)
}

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

async function flushNow(opts: { keepalive?: boolean } = {}): Promise<void> {
  // Rien ne part pendant l'hydratation : une écriture faite au montage avant la réponse du serveur (jeu par défaut
  // de la bibliothèque ou des prestations, données de démo) écraserait la vraie valeur, saisie sur un autre appareil.
  // L'envoi keepalive de fermeture d'onglet est retenu lui aussi, par choix : si l'onglet se ferme avant la réponse,
  // ces écritures restent dans le localStorage sans partir (une clé absente du serveur repartira à sa prochaine
  // écriture) plutôt que de risquer d'écraser le serveur avec une valeur par défaut. Elles restent en attente et la
  // fin de l'hydratation relance l'envoi.
  if (hydratationsEnCours > 0) return
  if (pendingWrites.size === 0 && pendingDeletes.size === 0) return
  const token = await getToken()
  if (!token) return
  // Une hydratation a pu commencer pendant la lecture du jeton.
  if (hydratationsEnCours > 0) return

  const writeKeys = Array.from(pendingWrites.keys())
  const writes = writeKeys.map(k => {
    const raw = pendingWrites.get(k)!
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = raw }
    return { key: k, value: parsed, raw }
  }).filter(e => {
    try { return JSON.stringify(e.value).length <= MAX_VALUE_BYTES } catch { return false }
  })
  // On vide IMMEDIATEMENT pour ne pas re-emettre les memes entrees si une
  // ecriture survient pendant l'await (perte d'idempotence sinon).
  for (const k of writeKeys) pendingWrites.delete(k)

  // Un seul POST avec toutes les clés modifiées, tant que le nombre et la taille le permettent.
  const lots = grouperEnLots(writes)

  // keepalive: true survit au unload. Necessaire pour beforeunload + tablette
  // qui ferme la session avant la fin de la requete. Limite navigateur ~64 KB
  // par requete keepalive — au-dela on retire keepalive (le user verra ses
  // donnees au prochain login via hydrate).
  for (const slice of lots) {
    const body = JSON.stringify({ entries: slice.map(e => ({ key: e.key, value: e.value })) })
    const useKeepalive = opts.keepalive && body.length < 60_000
    try {
      const res = await fetch('/api/user-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
        keepalive: useKeepalive,
      })
      if (res.ok) for (const e of slice) derniereValeurSynchronisee.set(e.key, e.raw)
    } catch {
      // erreur reseau : tolerance — le localStorage reste la source operationnelle.
      // On re-met les writes en pending pour retry au prochain flush.
      for (const e of slice) pendingWrites.set(e.key, e.raw)
    }
  }

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
        keepalive: opts.keepalive,
      })
    } catch {
      // En cas d'echec on remet les keys en pending pour retry
      for (const k of deleteKeys) pendingDeletes.add(k)
    }
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { flushNow() }, DEBOUNCE_MS)
}

/**
 * Cœur du miroir, appelé par le setItem intercepté. Une valeur identique à la dernière synchronisée n'est pas
 * renvoyée (lot 8 Sentry : réécritures à l'identique au montage du dashboard). Exporté pour les tests : jsdom ne
 * permet pas de remplacer localStorage.setItem (propriété nommée du Storage), les navigateurs le permettent.
 */
export function enregistrerEcritureMiroir(key: string, value: string): void {
  if (!shouldSync(key) || derniereValeurSynchronisee.get(key) === value) return
  pendingWrites.set(key, value)
  pendingDeletes.delete(key) // annule un eventuel delete en attente
  scheduleFlush()
}

/** Cœur du miroir pour removeItem : la clé sera renvoyée si elle est réécrite ensuite. */
export function enregistrerSuppressionMiroir(key: string): void {
  if (!shouldSync(key)) return
  derniereValeurSynchronisee.delete(key)
  pendingDeletes.add(key)
  pendingWrites.delete(key)
  scheduleFlush()
}

type EntreeAEnvoyer = { key: string; value: unknown; raw: string }

/** Lots d'envoi : jusqu'à FLUSH_BATCH_SIZE clés et FLUSH_BATCH_BYTES de valeurs par POST (un seul lot en général). */
function grouperEnLots(entries: EntreeAEnvoyer[]): EntreeAEnvoyer[][] {
  const lots: EntreeAEnvoyer[][] = []
  let tailleLot = 0
  for (const e of entries) {
    const dernier = lots[lots.length - 1]
    if (dernier && dernier.length < FLUSH_BATCH_SIZE && tailleLot + e.raw.length <= FLUSH_BATCH_BYTES) {
      dernier.push(e)
      tailleLot += e.raw.length
    } else {
      lots.push([e])
      tailleLot = e.raw.length
    }
  }
  return lots
}

/**
 * Hydrate le localStorage depuis la DB pour l'utilisateur connecte.
 * Providers l'appelle après installStorageSync() : les valeurs reçues sont écrites sans repasser par le miroir et
 * remplacent les écritures en attente des mêmes clés (le serveur gagne). Les envois sont retenus jusqu'à la fin
 * (voir flushNow) ; ensuite, succès ou échec (réseau, 401), les écritures restées en attente repartent.
 */
export async function hydrateStorageFromServer(): Promise<{ count: number }> {
  if (typeof window === 'undefined') return { count: 0 }
  hydratationsEnCours++
  try {
    return await hydraterDepuisLeServeur()
  } finally {
    hydratationsEnCours--
    // Clés absentes du serveur, écritures faites pendant une hydratation en échec : l'envoi retenu est relancé.
    if (hydratationsEnCours === 0 && (pendingWrites.size > 0 || pendingDeletes.size > 0)) scheduleFlush()
  }
}

async function hydraterDepuisLeServeur(): Promise<{ count: number }> {
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
      // Le serveur gagne, comme avant le lot 8 où l'hydratation passait par le setItem intercepté et remplaçait la
      // valeur en attente : une écriture faite au montage avant la réponse (jeu par défaut, données de démo) ne
      // part pas écraser la vraie valeur. Retirée avant l'écriture locale, qui peut échouer (quota).
      pendingWrites.delete(key)
      pendingDeletes.delete(key)
      try {
        // On ecrit la valeur en string. Si c'est deja une primitive (string),
        // on la stocke telle quelle ; sinon JSON.stringify.
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
        // setItem d'origine : une valeur reçue du serveur ne doit jamais repartir en POST (lot 8 Sentry :
        // Providers installe le miroir avant d'hydrater, chaque clé hydratée était renvoyée).
        ecrireSansMiroir(key, stringValue)
        derniereValeurSynchronisee.set(key, stringValue)
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

  // Stockage bloqué par le navigateur (réglage « bloquer les données des sites », iframe sandboxée, certaines
  // webviews) : la simple lecture de window.localStorage lève une SecurityError. Appelé sur chaque page par
  // Providers : sans ce garde, ces visiteurs tombaient sur une erreur. Pas de miroir possible, le site reste utilisable.
  let stockage: Storage
  try {
    stockage = window.localStorage
  } catch (error) {
    console.warn('[storage-sync] localStorage inaccessible, miroir désactivé :', error)
    return
  }

  const origSet = stockage.setItem.bind(stockage)
  const origRemove = stockage.removeItem.bind(stockage)
  ecrireSansMiroirRef = origSet

  stockage.setItem = (key: string, value: string) => {
    origSet(key, value)
    enregistrerEcritureMiroir(key, value)
  }

  stockage.removeItem = (key: string) => {
    origRemove(key)
    enregistrerSuppressionMiroir(key)
  }

  // Flush a la fermeture de l'onglet pour ne pas perdre les pending writes.
  // Utilisation de fetch keepalive: true qui survit au unload (vs un POST
  // classique annule par le navigateur).
  window.addEventListener('beforeunload', () => {
    if (pendingWrites.size > 0 || pendingDeletes.size > 0) {
      try { void flushNow({ keepalive: true }) } catch { /* ignore */ }
    }
  })
  // Idem pour visibilitychange (mobile : l'onglet est mis en arriere-plan,
  // pas forcement de beforeunload).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && (pendingWrites.size > 0 || pendingDeletes.size > 0)) {
      try { void flushNow({ keepalive: true }) } catch { /* ignore */ }
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

  const entries: EntreeAEnvoyer[] = keys.map(k => {
    const raw = window.localStorage.getItem(k) || ''
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = raw }
    return { key: k, value: parsed, raw }
  }).filter(e => {
    try { return JSON.stringify(e.value).length <= MAX_VALUE_BYTES } catch { return false }
  })

  let count = 0
  for (const slice of grouperEnLots(entries)) {
    try {
      const res = await fetch('/api/user-storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries: slice.map(e => ({ key: e.key, value: e.value })) }),
      })
      if (res.ok) {
        count += slice.length
        for (const e of slice) derniereValeurSynchronisee.set(e.key, e.raw)
      }
    } catch { /* ignore */ }
  }
  return { count }
}
