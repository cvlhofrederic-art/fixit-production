import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth-helpers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { supabaseAdmin } from '@/lib/supabase-server'
import { validateBody, docNumberSchema } from '@/lib/validation'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { lirePerimetreBtp } from '@/lib/btp/perimetre-compte'
import { familleDuTypeSerie, peutEcrireDocuments, societeNonResolue } from '@/lib/btp/titulaire-documents'
import { messageRefusFr } from '@/lib/documents/messages-refus'

/** Jeton de l'en-tête Authorization (même lecture que getAuthUser), ou null. */
function jetonDeLEnTete(request: NextRequest): string | null {
  const entete = request.headers.get('Authorization')
  if (!entete?.startsWith('Bearer ')) return null
  return entete.replace('Bearer ', '').trim() || null
}

/** Client porteur de la session de l'utilisateur (jeton déjà vérifié par getAuthUser) : auth.uid() y est renseigné. */
function clientDeSession(jeton: string): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

// POST /api/doc-number — Génère le prochain numéro séquentiel (devis/facture/avoir)
// Utilise la fonction DB next_doc_number() pour garantir l'atomicité (art. L441-3 C. com.)
export async function POST(request: NextRequest) {
  // Essaye d'abord via Bearer token, puis fallback cookies (@supabase/ssr)
  let user = await getAuthUser(request)
  const jetonVerifie = user ? jetonDeLEnTete(request) : null
  // Client de la session lue dans les cookies, quand c'est elle qui authentifie la requête.
  let clientCookies: SupabaseClient | null = null
  if (!user) {
    try {
      const serverClient = await createServerSupabaseClient()
      const { data } = await serverClient.auth.getUser()
      user = data.user
      if (user) clientCookies = serverClient
    } catch { /* noop */ }
  }
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  if (!(await checkRateLimit(`doc_num_${user.id}`, 30, 60_000))) return rateLimitResponse()

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const v = validateBody(docNumberSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const docType = v.data.docType
  const year = v.data.year || new Date().getFullYear()

  // ── Titulaire de la série ────────────────────────────────────────────────────────────────────────────────
  // Jusqu'au 25/11/2026 la série était celle du compte qui appelle. Un salarié invité d'une société BTP ouvrait
  // donc sa propre série, à côté de celle du gérant : deux DEV-2026-001 pour la même entreprise, ce que
  // l'art. 242 nonies A I 2° du CGI (séquence continue, sans rupture) interdit. La société est résolue ici, côté
  // serveur, et rien de ce que le client propose n'est lu. Pour un artisan, un gérant ou un super_admin, la
  // société résolue vaut son propre identifiant : comportement inchangé.
  const perimetre = await lirePerimetreBtp(user, supabaseAdmin)

  if (societeNonResolue(user, perimetre)) {
    return NextResponse.json({ error: messageRefusFr('societe_non_resolue'), code: 'societe_non_resolue' }, { status: 409 })
  }

  // Garde de rôle : la fonction SQL accepte tout membre actif de la société sans regarder son rôle. Sans ce
  // contrôle, un OUVRIER ou un CHEF_CHANTIER (devis NONE, factures NONE) incrémenterait le compteur de la société
  // sans jamais enregistrer de document — un trou dans la série légale du gérant, à chaque clic.
  const famille = familleDuTypeSerie(docType)
  if (!famille || !peutEcrireDocuments(perimetre, famille)) {
    return NextResponse.json(
      { error: "Votre rôle dans l'entreprise ne permet pas d'émettre ce document.", code: 'aucun_droit' },
      { status: 403 },
    )
  }

  // Société BTP (audit du 11/11/2026, constat base-de-donnees-10) : la fonction est appelée avec la session de
  // l'utilisateur, qu'elle reconnaît comme titulaire de la série. Avec la clé de service, auth.uid() y est vide et son
  // passe-droit lit un ancien réglage du jeton que PostgREST ne pose plus : refus à chaque appel. Artisan : inchangé.
  const sessionBtp = user.app_metadata?.role === 'pro_societe'
    ? (jetonVerifie ? clientDeSession(jetonVerifie) : clientCookies)
    : null
  const { data, error } = await (sessionBtp ?? supabaseAdmin).rpc('next_doc_number', {
    p_artisan_user_id: perimetre.societeId,
    p_doc_type: docType,
    p_year: year,
  })

  if (error) {
    logger.error('[doc-number] RPC error:', { error: error.message })
    return NextResponse.json({ error: 'Erreur de génération du numéro' }, { status: 500 })
  }

  return NextResponse.json({ number: data })
}
