import * as Sentry from '@sentry/nextjs'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchNextDocNumber, type DocSeriesType } from '@/lib/doc-number'
import { dedupeDocsByIdentity } from '@/lib/devis-utils'

// Sync a saved document (devis or facture) to Supabase via server-side API.
// Pattern Pro SaaS 2026 : POST vers /api/devis/sync (Cloudflare Worker)
// avec Authorization Bearer, validation Zod côté serveur, supabaseAdmin
// pour bypass RLS de manière contrôlée, idempotency naturelle via
// (numero, artisan_user_id).
//
// Refonte 2026-05-12 (plan magical-mapping-karp) :
//   - syncDocumentToSupabase retourne désormais un SyncResult discriminé
//     {ok: true, ...} | {ok: false, status, body, kind} au lieu de throw.
//   - Auto-refresh préventif du token si expires_at < 60s.
//   - Retry 1× sur 401 après refreshSession forcé.
//   - Retry exponentiel sur 5xx (3 tentatives, 1s/4s/16s).
//   - Toast contextuel selon kind : auth | conflict | forbidden | network | server.

export type SyncResult =
  | { ok: true; id?: string; numero?: string }
  | { ok: false; status: number; body: string; kind: SyncErrorKind }

export type SyncErrorKind =
  | 'no-session'
  | 'auth'              // 401 — token expiré ou invalide après refresh
  | 'forbidden'         // 403 — ownership ou compte inactif
  | 'conflict'          // 409 — transition de statut interdite (même doc)
  | 'numero-collision'  // 409 — DEUX docs distincts se disputent le même numéro
  | 'validation'        // 400 — payload invalide
  | 'server'            // 5xx
  | 'network'           // fetch throw

// Refresh préventif : si la session expire dans < 60s, on essaie un refresh
// avant de poser le header Authorization. Sans throw — on retombe sur l'ancien
// token si refresh KO (le serveur tranchera).
async function ensureFreshSession(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const expiresAt = session.expires_at ?? 0 // unix seconds
  const nowSec = Math.floor(Date.now() / 1000)
  const secondsLeft = expiresAt - nowSec

  if (secondsLeft < 60) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session?.access_token) {
      return data.session.access_token
    }
  }

  return session.access_token
}

async function postSync(token: string, body: unknown): Promise<{ status: number; text: string }> {
  const res = await fetch('/api/devis/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  return { status: res.status, text }
}

function classifyStatus(status: number): SyncErrorKind {
  if (status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status === 409) return 'conflict'
  if (status === 400) return 'validation'
  if (status >= 500) return 'server'
  return 'server'
}

export async function syncDocumentToSupabase(
  doc: Record<string, unknown>,
  artisanId: string,
): Promise<SyncResult> {
  const docType: 'devis' | 'facture' = doc.docType === 'facture' ? 'facture' : 'devis'
  // Identité : id UUID stable (brouillon / nouveau modèle) OU numero (legacy
  // émis). Un brouillon n'a pas de numéro → on exige au moins l'id pour
  // pouvoir synchroniser (le serveur upsert onConflict='id').
  const id = (doc.id as string) || ''
  const numero = (doc.docNumber as string) || ''
  if (!id && !numero) {
    return { ok: false, status: 0, body: 'missing id and docNumber', kind: 'validation' }
  }

  let token = await ensureFreshSession()
  if (!token) {
    return { ok: false, status: 401, body: 'no active session', kind: 'no-session' }
  }

  const payload = { docType, artisanId, doc }

  // Tentative 1
  let res: { status: number; text: string }
  try {
    res = await postSync(token, payload)
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: err instanceof Error ? err.message : String(err),
      kind: 'network',
    }
  }

  // Retry 1× sur 401 après refresh forcé
  if (res.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session?.access_token) {
      token = data.session.access_token
      try {
        res = await postSync(token, payload)
      } catch (err) {
        return {
          ok: false,
          status: 0,
          body: err instanceof Error ? err.message : String(err),
          kind: 'network',
        }
      }
    }
  }

  // Retry exponentiel sur 5xx (3 tentatives total : déjà 1 faite + 2 retries)
  let attempt = 0
  while (res.status >= 500 && res.status < 600 && attempt < 2) {
    const delay = attempt === 0 ? 1_000 : 4_000
    await new Promise(r => setTimeout(r, delay))
    try {
      res = await postSync(token, payload)
    } catch (err) {
      return {
        ok: false,
        status: 0,
        body: err instanceof Error ? err.message : String(err),
        kind: 'network',
      }
    }
    attempt++
  }

  if (res.status >= 200 && res.status < 300) {
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(res.text) as Record<string, unknown> } catch { /* tolère text vide */ }
    return {
      ok: true,
      id: parsed.id as string | undefined,
      numero: parsed.numero as string | undefined,
    }
  }

  // 409 : on raffine conflict (transition interdite du même doc) vs
  // numero-collision (deux docs distincts, même numéro légal) en lisant le body.
  // Le serveur renvoie `{ error: 'numero_collision' }` dans ce dernier cas.
  let kind = classifyStatus(res.status)
  if (res.status === 409 && /numero_collision/.test(res.text)) {
    kind = 'numero-collision'
  }

  return {
    ok: false,
    status: res.status,
    body: res.text.slice(0, 500),
    kind,
  }
}

// Wrapper safe : remplace le pattern `.catch(() => {})` aux call sites
// (DevisFactureForm.tsx + DevisFactureFormBTP.tsx). Sentry capture + toast
// contextuel selon le kind d'erreur.
//
// Anti-spam toast : 1 seul toast par 30s par kind (auth/conflict/forbidden
// sont rares mais on évite les rafales si la session expire pendant une
// edit lourde).
const _lastToastByKind = new Map<SyncErrorKind, number>()
const SYNC_TOAST_THROTTLE_MS = 30_000

function shouldToast(kind: SyncErrorKind): boolean {
  const now = Date.now()
  const last = _lastToastByKind.get(kind) ?? 0
  if (now - last < SYNC_TOAST_THROTTLE_MS) return false
  _lastToastByKind.set(kind, now)
  return true
}

function toastForKind(kind: SyncErrorKind, status: number, body: string): void {
  // Le toast.action permet à l'utilisateur de réagir directement (reconnexion).
  switch (kind) {
    case 'no-session':
    case 'auth':
      toast.error('Session expirée — reconnecte-toi pour synchroniser', {
        description: 'Tes données restent en sécurité localement.',
        action: {
          label: 'Se reconnecter',
          onClick: () => {
            const locale = typeof window !== 'undefined'
              ? (window.location.pathname.split('/')[1] || 'fr')
              : 'fr'
            window.location.href = `/${locale}/auth/login`
          },
        },
      })
      return
    case 'conflict':
      toast.error('Conflit de statut sur ce document', {
        description: 'Rafraîchis la page pour récupérer la dernière version.',
      })
      return
    case 'numero-collision':
      // Ne devrait s'afficher que si la renumérotation + le resync ont AUSSI
      // échoué (cas rare). Le doc reste sauvé localement, jamais perdu.
      toast.error('Numéro déjà utilisé — renumérotation en attente', {
        description: 'Le document est sauvé localement, il sera resynchronisé.',
      })
      return
    case 'forbidden':
      toast.error('Accès refusé pour la synchronisation', {
        description: 'Vérifie que ton compte est actif (ou contacte le gérant).',
      })
      return
    case 'validation':
      toast.error('Document invalide — sync refusée', {
        description: body.slice(0, 120) || 'Vérifie les champs obligatoires.',
      })
      return
    case 'network':
      toast.error('Réseau indisponible — document sauvé localement', {
        description: 'Réessai automatique au prochain login.',
      })
      return
    case 'server':
    default:
      toast.error('Sync DB échouée — document sauvé localement', {
        description: `Code ${status || '?'}. Réessai au prochain login.`,
      })
      return
  }
}

// Réécrit le numéro légal d'un document DANS le cache localStorage émis
// (`fixit_documents_<artisanId>`). Match par id stable puis, à défaut, par
// ancien numéro. No-op silencieux si le doc n'y figure pas (ex. brouillon
// encore en `fixit_drafts_*`) — l'objet en mémoire reste de toute façon
// renuméroté par l'appelant. Pas de throw : private browsing toléré.
function rewriteDocNumberInCache(
  artisanId: string,
  matchId: string,
  oldNumber: string,
  newNumber: string,
): void {
  if (typeof localStorage === 'undefined') return
  const key = `fixit_documents_${artisanId}`
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const docs = JSON.parse(raw) as Array<Record<string, unknown>>
    if (!Array.isArray(docs)) return
    let changed = false
    for (const d of docs) {
      const sameId = matchId && d.id === matchId
      const sameNumber = oldNumber && d.docNumber === oldNumber
      if (sameId || sameNumber) {
        d.docNumber = newNumber
        d.numero = newNumber
        changed = true
      }
    }
    if (changed) localStorage.setItem(key, JSON.stringify(docs))
  } catch {
    /* private browsing / cache corrompu : on ne bloque pas la renumérotation mémoire */
  }
}

// Mappe un document vers SA série de numérotation. Chaque série a son propre
// compteur (DEV-/FACT-/AC-/AV-) : on dérive du préfixe du numéro existant pour
// qu'un acompte (AC-) ou un avoir (AV-) soit renuméroté sur SA série, et pas sur
// celle du type de base 'facture'. Repli sur docType si le numéro est absent.
function seriesForDoc(doc: Record<string, unknown>): DocSeriesType {
  const num = (doc.docNumber as string) || ''
  if (num.startsWith('AC-')) return 'acompte'
  if (num.startsWith('AV-')) return 'avoir'
  if (num.startsWith('DEV-')) return 'devis'
  if (num.startsWith('FACT-')) return 'facture'
  return doc.docType === 'facture' ? 'facture' : 'devis'
}

export async function syncDocumentSafe(doc: Record<string, unknown>, artisanId: string): Promise<void> {
  try {
    let result = await syncDocumentToSupabase(doc, artisanId)

    // Filet anti-perte : collision de numéro entre DEUX documents distincts.
    // Cause racine du bug « doc qui disparaît » sur device neuf (fallback de
    // numérotation localStorage → numéro déjà pris en base). On NE perd JAMAIS
    // le doc : on tire un nouveau numéro serveur, on le réécrit (mémoire +
    // cache localStorage) et on resynchronise UNE fois. Symétrique artisan/BTP.
    if (!result.ok && result.kind === 'numero-collision') {
      const oldNumber = (doc.docNumber as string) || ''
      const matchId = (doc.id as string) || ''
      let newNumber = ''
      try {
        newNumber = await fetchNextDocNumber(seriesForDoc(doc), artisanId)
      } catch {
        /* fetchNextDocNumber ne throw pas en principe — garde-fou */
      }
      if (newNumber && newNumber !== oldNumber) {
        doc.docNumber = newNumber
        doc.numero = newNumber
        rewriteDocNumberInCache(artisanId, matchId, oldNumber, newNumber)
        Sentry.captureMessage('devis-sync numero_collision résolu par renumérotation', {
          level: 'warning',
          tags: { feature: 'devis-sync', stage: 'numero-collision-renumber', doc_type: (doc.docType as string) || 'devis' },
          extra: { old_number: oldNumber, new_number: newNumber, artisan_id: artisanId, doc_id: matchId },
        })
        // Retry UNIQUE avec le nouveau numéro. S'il réussit, le doc est sauvé.
        result = await syncDocumentToSupabase(doc, artisanId)
      }
    }

    if (result.ok) return

    const numero = (doc.docNumber as string) || '(sans numero)'
    const docType = (doc.docType as string) || 'devis'

    Sentry.captureException(new Error(`devis-sync ${result.kind} ${result.status}: ${result.body.slice(0, 200)}`), {
      tags: {
        feature: 'devis-sync',
        stage: 'client-fetch',
        doc_type: docType,
        sync_kind: result.kind,
        http_status: String(result.status),
      },
      extra: { numero, artisan_id: artisanId, body: result.body.slice(0, 500) },
    })

    if (shouldToast(result.kind)) {
      toastForKind(result.kind, result.status, result.body)
    }
  } catch (err: unknown) {
    // Ne devrait pas arriver — syncDocumentToSupabase ne throw plus, mais
    // belt-and-suspenders pour les bugs futurs.
    Sentry.captureException(err, {
      tags: { feature: 'devis-sync', stage: 'client-fetch-unexpected' },
    })
  }
}

// Fetch documents from Supabase factures + devis tables for the authenticated user.
// Returns an array de document objects shaped to match the localStorage format.
//
// Si la colonne raw_data est presente (migration 074), on retourne le payload
// complet du formulaire — l'utilisateur retrouve l'integralite de son devis
// (corps d'etat BTP, etapes, mediator, notes, etc.) sur n'importe quel
// appareil. Sinon on retombe sur les champs sommaire (comportement legacy).
export async function fetchDocumentsFromSupabase(): Promise<Record<string, unknown>[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const SELECT_FIELDS_FULL = 'id,numero,client_name,status,chantier_id,created_at,total_ht_cents,raw_data'
  const SELECT_FIELDS_LEGACY = 'id,numero,client_name,status,chantier_id,created_at,total_ht_cents'

  const fetchTable = async (table: 'factures' | 'devis'): Promise<Array<Record<string, unknown>>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseQuery = supabase.from(table) as any
    // deleted_at appliqué aux 2 tables : migration 078 l'a ajouté à devis ET factures
    // (conformité loi anti-fraude TVA — soft-delete uniquement, hard-DELETE bloqué par RLS)
    const q = baseQuery.select(SELECT_FIELDS_FULL).eq('artisan_user_id', user.id).is('deleted_at', null)
    let result = await q
    if (result.error && /column .*raw_data.* does not exist/i.test(result.error.message || '')) {
      const q2 = baseQuery.select(SELECT_FIELDS_LEGACY).eq('artisan_user_id', user.id).is('deleted_at', null)
      result = await q2
    }
    if (result.error) {
      console.error(`[document-sync] Failed to fetch ${table}:`, result.error.message)
      return []
    }
    return (result.data as Array<Record<string, unknown>>) || []
  }

  const [facData, devData] = await Promise.all([fetchTable('factures'), fetchTable('devis')])

  const merge = (
    type: 'devis' | 'facture',
    rows: Array<Record<string, unknown>>
  ): Record<string, unknown>[] =>
    rows.map((r) => {
      const raw = (r.raw_data as Record<string, unknown> | null) || null
      if (raw && typeof raw === 'object') {
        return {
          ...raw,
          // id canonique DB (placé APRÈS ...raw pour primer sur un éventuel id
          // local) → le client adopte l'identité stable au hydrate (dédup
          // cross-device + upsert onConflict='id' côté serveur).
          id: r.id as string,
          docType: type,
          docNumber: (r.numero as string) || (raw.docNumber as string) || null,
          status: (r.status as string) || (raw.status as string),
          chantierId: (r.chantier_id as string) || (raw.chantierId as string) || null,
          docDate: (raw.docDate as string) || ((r.created_at as string) || '').slice(0, 10),
          _fromSupabase: true,
        }
      }
      return {
        id: r.id,
        docType: type,
        docNumber: r.numero,
        clientName: r.client_name,
        docDate: r.created_at ? (r.created_at as string).slice(0, 10) : '',
        status: r.status,
        chantierId: r.chantier_id,
        totalHT: r.total_ht_cents != null ? (r.total_ht_cents as number) / 100 : 0,
        _fromSupabase: true,
      }
    })

  return [...merge('facture', facData), ...merge('devis', devData)]
}

// Un document est ÉMIS (et non un brouillon) dès que son statut n'est ni
// 'brouillon' (FR) ni 'draft' (enum DB) ni vide. Filtre canonique, aligné sur
// DevisFactureForm (`isEmitted = !!st && st !== 'brouillon' && st !== 'draft'`).
function isEmittedDoc(doc: Record<string, unknown>): boolean {
  const st = (doc.status as string) || ''
  return !!st && st !== 'brouillon' && st !== 'draft'
}

// Hydrate le cache localStorage des documents ÉMIS à partir de la liste fusionnée
// (DB + local) affichée par le dashboard. Deux objectifs :
//   1. Le fallback de numérotation localStorage (localFallbackDocNumber) calcule
//      max(seq)+1 sur `fixit_documents_<artisanId>`. Sur un device neuf qui n'a
//      jamais vu les docs DB, ce cache est vide → le fallback redémarre à -001 →
//      collision avec un numéro déjà émis en base (cause racine du bug « doc qui
//      disparaît »). En hydratant le cache, max(seq)+1 reste correct même si le
//      RPC de numérotation échoue momentanément.
//   2. Cohérence du cache entre ordinateurs (le local reflète la base).
//
// Invariants :
//   - DÉDUP par identité (dedupeDocsByIdentity) : un doc DB et son jumeau local
//     (id legacy horodaté vs UUID, même numéro légal) ne doublent jamais
//     (incident factures 2026-06-05).
//   - Seuls les documents ÉMIS sont écrits ici ; les brouillons restent dans
//     `fixit_drafts_<artisanId>` (non touché).
//   - No-op si aucun doc émis dans la liste fusionnée : on n'écrase pas un cache
//     émis existant par un tableau vide.
//   - `artisanId` DOIT être la même clé que celle lue par la branche dashboard
//     appelante (profil `artisanData.id` en chemin normal ; `user.id` en chemin
//     admin/sans-profil).
export function persistEmittedDocsToCache(
  artisanId: string,
  mergedDocs: Array<Record<string, unknown>>,
): void {
  if (typeof localStorage === 'undefined' || !artisanId) return
  try {
    // Dédup défensive (la liste est déjà censée l'être côté dashboard, mais on
    // réapplique l'invariant pour ne jamais persister de doublon).
    const deduped = dedupeDocsByIdentity<Record<string, unknown>>([], mergedDocs)
    const emitted = deduped.filter(isEmittedDoc)
    if (emitted.length === 0) return // ne pas clobberer le cache émis avec []
    localStorage.setItem(`fixit_documents_${artisanId}`, JSON.stringify(emitted))
  } catch {
    /* private browsing / quota : best-effort, ne bloque jamais le rendu */
  }
}

// One-time import of all localStorage documents for an artisan into Supabase.
// Returns the count of documents processed.
export async function importLocalStorageDocsToSupabase(artisanId: string): Promise<number> {
  let count = 0
  for (const key of [
    `fixit_documents_${artisanId}`,
    `fixit_drafts_${artisanId}`,
  ]) {
    try {
      const docs = JSON.parse(localStorage.getItem(key) || '[]')
      for (const doc of docs) {
        const result = await syncDocumentToSupabase(doc, artisanId)
        if (result.ok) count++
      }
    } catch {
      // Ignore corrupt localStorage entries
    }
  }
  return count
}
