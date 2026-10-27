import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { echapperMotifLike, resoudreCoproprietaire, statutHttpAcces } from '@/lib/coproprietaire/acces'
import { documentVisible, memeNom } from '@/lib/coproprietaire/filtrage'
import { cheminStockageSur } from '@/lib/storage/chemin-sur'

// ── GET /api/coproprietaire/documents/[id] ───────────────────────────────────
// URL signée (10 minutes) d'un document de l'immeuble du copropriétaire connecté, demandée au
// moment où il clique sur « Ouvrir ». Conditions, toutes vérifiées côté serveur : document du
// cabinet de sa fiche, rattaché à SON immeuble, publié par le syndic sur l'extranet (espace commun,
// ou espace personnel de l'une de ses fiches), d'un type consultable (lib/coproprietaire/filtrage.ts),
// compte propriétaire (un locataire ne lit que le règlement, porté par la fiche immeuble).
// Un document hors de ces conditions répond 404, sans dire s'il existe.

const DUREE_URL_SECONDES = 10 * 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LigneDocumentStockage {
  id: string
  immeuble_id: string | null
  type: string | null
  status: string | null
  storage_path: string
  filename: string | null
  mime_type: string | null
  publie_extranet?: boolean | null
  espace_extranet?: string | null
  coproprio_id?: string | null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`copro_document_${ip}`, 60, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  const parametres = request.nextUrl.searchParams
  const acces = await resoudreCoproprietaire(user, supabaseAdmin, { coproprioId: parametres.get('lot'), email: parametres.get('email') })
  if (!acces.ok) return NextResponse.json({ error: acces.code }, { status: statutHttpAcces(acces.code) })
  if (acces.acces.role !== 'proprietaire') return NextResponse.json({ error: 'role_interdit' }, { status: 403 })

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const { cabinetId, fiche, fiches } = acces.acces
  const nomImmeuble = (fiche.immeuble || '').trim()
  if (!nomImmeuble) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const [{ data: doc, error: docErr }, { data: immeubles, error: immErr }] = await Promise.all([
      supabaseAdmin.from('syndic_documents').select('id, immeuble_id, type, status, storage_path, filename, mime_type, publie_extranet, espace_extranet, coproprio_id').eq('id', id).eq('cabinet_id', cabinetId).maybeSingle(),
      supabaseAdmin.from('syndic_immeubles').select('id, nom').eq('cabinet_id', cabinetId).ilike('nom', echapperMotifLike(nomImmeuble)).limit(5),
    ])
    if (docErr || immErr) {
      // Colonnes de publication absentes (migration non appliquée) : rien n'est publié.
      logger.error('[COPRO DOCUMENT] lecture', { document: docErr?.message, immeuble: immErr?.message })
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const idsImmeuble = ((immeubles || []) as Array<{ id: string; nom: string | null }>).filter(i => memeNom(i.nom, nomImmeuble)).map(i => i.id)
    const ligne = doc as LigneDocumentStockage | null
    if (!ligne || !ligne.immeuble_id || !idsImmeuble.includes(ligne.immeuble_id) || !documentVisible(ligne, new Set(fiches.map(f => f.id)))) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (!cheminStockageSur(ligne.storage_path)) {
      logger.error('[COPRO DOCUMENT] chemin de stockage refusé', { document: ligne.id })
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const { data: signee, error: signErr } = await supabaseAdmin.storage
      .from('syndic-documents')
      .createSignedUrl(ligne.storage_path, DUREE_URL_SECONDES)
    if (signErr || !signee?.signedUrl) {
      logger.error('[COPRO DOCUMENT] URL signée', { message: signErr?.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    const reponse = NextResponse.json({
      url: signee.signedUrl,
      expiresInSeconds: DUREE_URL_SECONDES,
      nom: ligne.filename || '',
      mimeType: ligne.mime_type || '',
    })
    reponse.headers.set('Cache-Control', 'private, no-store')
    return reponse
  } catch (e) {
    logger.error('[COPRO DOCUMENT] exception', undefined, e)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
