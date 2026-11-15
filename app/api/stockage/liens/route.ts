import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody } from '@/lib/validation'
import { DUREE_LIEN_7_JOURS_S, SEAU_DOCUMENTS, signerValeurs } from '@/lib/storage/liens-stockage'

/**
 * POST /api/stockage/liens — liens frais vers les documents du compte connecté, dans le seau privé.
 *
 * Le dossier Conformité (Wallet) et les Références gardent, pour chaque document, la valeur rendue au dépôt par
 * /api/upload : un lien signé qui cesse de s'ouvrir au bout de 7 jours. Cette route en retrouve le chemin et crée un
 * lien frais, de 7 jours comme au dépôt (il sert aussi au dossier envoyé par e-mail). Rien n'est réécrit.
 *
 * Corps : { valeurs: string[] } (100 au plus). Réponse : { liens: Array<string | null> }, dans le même ordre ; null
 * pour une valeur qui n'est pas un document du compte (seuls les dossiers wallet/ et portfolio/ du compte ou de sa
 * fiche, ceux que /api/upload réserve à leur propriétaire).
 */

const corpsSchema = z.object({
  valeurs: z.array(z.string().max(2048)).max(100),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`stockage_liens_${ip}`, 30, 60_000))) return rateLimitResponse()

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }
  const v = validateBody(corpsSchema, corps)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  const { valeurs } = v.data
  if (valeurs.length === 0) return NextResponse.json({ liens: [] })

  try {
    const { data: fiches, error: ficheError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
    if (ficheError) {
      logger.error('[stockage/liens] lecture de la fiche', { message: ficheError.message })
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    const proprietaires = [user.id, ...(fiches ?? []).map((f: { id: string }) => f.id)]
    const dossiers = proprietaires.flatMap((id) => [`wallet/${id}/`, `portfolio/${id}/`])

    const liens = await signerValeurs(SEAU_DOCUMENTS, valeurs, {
      dossiers,
      dureeS: DUREE_LIEN_7_JOURS_S,
      origine: '[stockage/liens]',
    })
    return NextResponse.json({ liens }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err: unknown) {
    logger.error('[stockage/liens] exception', { message: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
