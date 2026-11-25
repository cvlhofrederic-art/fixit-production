// POST /api/pro/documents/etat — deux mutations que le navigateur ne peut pas faire pour un salarié invité.
//
// « Marquer payée » et la suppression d'un brouillon étaient écrites DEPUIS LE NAVIGATEUR, en comptant sur la RLS
// pour borner la ligne touchée. Pour un salarié invité, la RLS ne renvoie pas d'erreur : elle FILTRE. L'UPDATE
// touchait zéro ligne, `error` valait null, et l'écran annonçait « payée » avant de la retrouver impayée au
// rechargement. Un mensonge silencieux sur l'état d'une facture est le pire défaut possible pour une secrétaire.
//
// Ces deux écritures passent donc par ici quand le compte n'est pas le titulaire de la société : rôle vérifié,
// ligne bornée au propriétaire côté serveur, et un échec qui se voit.
//
// Deux refus de principe :
//   - cible désignée par son seul numéro : refusée. Une société BTP peut porter deux documents distincts au même
//     numéro (lib/devis-utils.ts, conserverIdsDistincts) ; viser par numéro marquerait payée la mauvaise facture.
//     Les documents d'un salarié viennent tous de la base, avec un identifiant stable.
//   - suppression d'un document ÉMIS : refusée. Un document émis s'ANNULE (/api/document-cancel), il ne se
//     supprime pas — la série légale ne doit pas perdre de numéro.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isProSocieteRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { isStableDocId } from '@/lib/devis-utils'
import { proprietairePourEcriture } from '@/lib/btp/titulaire-documents'

export const maxDuration = 15

const schemaEtat = z.object({
  action: z.enum(['marquer_payee', 'supprimer_brouillon']),
  docType: z.enum(['devis', 'facture']),
  id: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Réservé aux comptes de société' }, { status: 403 })
  }
  if (!(await checkRateLimit(`pro_doc_etat_${user.id}`, 30, 60_000))) return rateLimitResponse()

  let brut: unknown
  try {
    brut = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }
  const v = validateBody(schemaEtat, brut)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { action, docType, id } = v.data
  const table: 'devis' | 'factures' = docType === 'facture' ? 'factures' : 'devis'

  if (!isStableDocId(id)) {
    return NextResponse.json(
      { error: 'Ce document n’a pas d’identifiant stable : rouvrez-le depuis la liste avant de le modifier.' },
      { status: 400 },
    )
  }
  if (action === 'marquer_payee' && table !== 'factures') {
    return NextResponse.json({ error: 'Seule une facture peut être marquée payée.' }, { status: 400 })
  }

  const acces = await proprietairePourEcriture(user, supabaseAdmin, table)
  if (!acces.ok) return NextResponse.json({ error: acces.message }, { status: acces.status })

  // Ligne bornée au propriétaire : un identifiant connu d'ailleurs ne suffit pas à toucher le document d'une
  // autre société.
  const { data: existante, error: erreurLecture } = await supabaseAdmin
    .from(table)
    .select('id, status, deleted_at')
    .eq('id', id)
    .eq('artisan_user_id', acces.proprietaire)
    .maybeSingle()

  if (erreurLecture) {
    logger.error('[pro/documents/etat] lecture impossible', { table, error: erreurLecture.message })
    return NextResponse.json({ error: 'Document illisible. Réessayez dans un instant.' }, { status: 500 })
  }
  if (!existante) {
    return NextResponse.json({ error: 'Document introuvable dans votre entreprise.' }, { status: 404 })
  }

  const statut = (existante as { status?: string | null }).status ?? null

  if (action === 'supprimer_brouillon') {
    // Un document émis ne se supprime pas : il s'annule. Sinon la série légale perdrait un numéro.
    if (statut !== 'draft') {
      return NextResponse.json(
        { error: 'Ce document est émis : il doit être annulé, pas supprimé.' },
        { status: 409 },
      )
    }
    const { error } = await supabaseAdmin
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('artisan_user_id', acces.proprietaire)
    if (error) {
      logger.error('[pro/documents/etat] suppression impossible', { table, error: error.message })
      return NextResponse.json({ error: 'La suppression a échoué. Réessayez.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabaseAdmin
    .from('factures')
    .update({ status: 'paid' })
    .eq('id', id)
    .eq('artisan_user_id', acces.proprietaire)
  if (error) {
    logger.error('[pro/documents/etat] passage en payée impossible', { error: error.message })
    return NextResponse.json({ error: "L'enregistrement « payée » a échoué. Réessayez." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
