import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { resoudreCoproprietaire, statutHttpAcces } from '@/lib/coproprietaire/acces'
import { pdfFactureDisponible } from '@/lib/coproprietaire/filtrage'

// ── GET /api/coproprietaire/factures/[id]/pdf ────────────────────────────────
// URL signée (10 minutes) du PDF d'une facture du copropriétaire connecté (syndic_factures_copro,
// coproprio_id = l'une de ses fiches, cabinet de sa fiche). pdf_url est un chemin du bucket privé
// `syndic-documents` ; une URL brute (http…) stockée par le syndic n'est jamais relayée.

const DUREE_URL_SECONDES = 10 * 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET = 'syndic-documents'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`copro_facture_pdf_${ip}`, 60, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  const parametres = request.nextUrl.searchParams
  const acces = await resoudreCoproprietaire(user, supabaseAdmin, { coproprioId: parametres.get('lot'), email: parametres.get('email') })
  if (!acces.ok) return NextResponse.json({ error: acces.code }, { status: statutHttpAcces(acces.code) })
  if (acces.acces.role !== 'proprietaire') return NextResponse.json({ error: 'role_interdit' }, { status: 403 })

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const { cabinetId, fiches } = acces.acces
  try {
    const { data, error } = await supabaseAdmin
      .from('syndic_factures_copro')
      .select('id, numero_facture, pdf_url')
      .eq('id', id)
      .eq('cabinet_id', cabinetId)
      .in('coproprio_id', fiches.map(f => f.id))
      .maybeSingle()
    if (error) {
      logger.error('[COPRO FACTURE PDF] lecture', { code: error.code, message: error.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    const facture = data as { id: string; numero_facture: string | null; pdf_url: string | null } | null
    if (!facture || !pdfFactureDisponible(facture.pdf_url)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Chemin stocké avec ou sans le nom du bucket en tête.
    const chemin = (facture.pdf_url || '').trim().replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}/`), '')
    const { data: signee, error: signErr } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(chemin, DUREE_URL_SECONDES)
    if (signErr || !signee?.signedUrl) {
      logger.error('[COPRO FACTURE PDF] URL signée', { message: signErr?.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    const reponse = NextResponse.json({ url: signee.signedUrl, expiresInSeconds: DUREE_URL_SECONDES, nom: facture.numero_facture || '' })
    reponse.headers.set('Cache-Control', 'private, no-store')
    return reponse
  } catch (e) {
    logger.error('[COPRO FACTURE PDF] exception', undefined, e)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
