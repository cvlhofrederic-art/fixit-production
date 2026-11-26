// /api/pro/documents/chantiers — les devis et factures de la société vus depuis l'écran Chantiers, pour un compte qui
// n'en est pas le titulaire (26/11/2026, lot 2 des comptes invités).
//
// L'écran Chantiers (components/dashboard/ChantiersBTPV2.tsx) lisait les devis depuis le navigateur par
// `artisan_id = artisan.id`, et « Lier un devis » les modifiait de la même façon. Pour un compte invité, `artisan.id`
// est son propre compte et la RLS de `devis` ne laisse passer que ses lignes — aucune : listes vides, et surtout une
// liaison qui ne touchait AUCUNE ligne sans renvoyer d'erreur. L'écran annonçait « Devis lié au chantier » ; rien
// n'avait changé.
//
// GET : devis de la société (pour « Importer depuis un devis » et « Lier un devis ») et factures déjà rattachées à un
//   chantier. Chaque famille n'est rendue qu'à un rôle qui la voit (lib/btp/titulaire-documents.ts).
// POST : lie un devis de la société à un chantier de la société. Il faut écrire les devis ET les chantiers : par défaut
//   le co-gérant et la secrétaire. Le devis et le chantier sont tous deux bornés à la société, et une liaison qui ne
//   touche aucune ligne est un échec (404), jamais un succès.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isProSocieteRole } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { lirePerimetreBtp, niveauSur } from '@/lib/btp/perimetre-compte'
import { famillesLisibles, peutEcrireDocuments, societeNonResolue } from '@/lib/btp/titulaire-documents'
import { COLONNES_LIEU_DEVIS } from '@/lib/btp/lieu-devis'
import { colonneRawDataAbsente } from '@/lib/documents/champs-lecture'
import { messageRefusFr, type CodeRefusDocuments } from '@/lib/documents/messages-refus'

/** Colonnes lues par l'écran Chantiers pour un titulaire (COLONNES_DEVIS_IMPORT), plus le chantier rattaché. */
const COLONNES_DEVIS = 'id, numero, client_name, total_ht_cents, items, created_at, status, chantier_id'
const COLONNES_FACTURES = 'id, numero, client_name, total_ht_cents, status, chantier_id'
/** Garde-fou de volume : l'écran du titulaire en propose 50 à l'import ; au-delà, les plus récents d'abord. */
const PLAFOND_DEVIS = 500

const refus = (code: CodeRefusDocuments, status: number) =>
  NextResponse.json({ error: messageRefusFr(code), code }, { status })

async function lireDevis(societeId: string): Promise<Record<string, unknown>[] | null> {
  const lire = (colonnes: string) => supabaseAdmin.from('devis').select(colonnes)
    .eq('artisan_user_id', societeId).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(PLAFOND_DEVIS)
  let resultat = await lire(`${COLONNES_DEVIS}, ${COLONNES_LIEU_DEVIS}`)
  // Base sans colonne raw_data : l'ancienne colonne client_address, comme l'écran du titulaire.
  if (resultat.error && colonneRawDataAbsente(resultat.error.message)) resultat = await lire(`${COLONNES_DEVIS}, client_address`)
  if (resultat.error) {
    logger.error('[pro/documents/chantiers] devis illisibles', { error: resultat.error.message })
    return null
  }
  return (resultat.data ?? []) as unknown as Record<string, unknown>[]
}

async function lireFacturesRattachees(societeId: string): Promise<Record<string, unknown>[] | null> {
  const { data, error } = await supabaseAdmin.from('factures').select(COLONNES_FACTURES)
    .eq('artisan_user_id', societeId).is('deleted_at', null)
  if (error) {
    logger.error('[pro/documents/chantiers] factures illisibles', { error: error.message })
    return null
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).filter(ligne => ligne.chantier_id)
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isProSocieteRole(user)) return NextResponse.json({ error: 'Réservé aux comptes de société' }, { status: 403 })
  if (!(await checkRateLimit(`pro_documents_chantiers_${user.id}`, 30, 60_000))) return rateLimitResponse()

  const perimetre = await lirePerimetreBtp(user, supabaseAdmin)
  if (societeNonResolue(user, perimetre)) return refus('societe_non_resolue', 409)
  const lisibles = new Set(famillesLisibles(perimetre))
  if (lisibles.size === 0) return refus('aucun_droit', 403)

  const [devis, factures] = await Promise.all([
    lisibles.has('devis') ? lireDevis(perimetre.societeId) : Promise.resolve([]),
    lisibles.has('factures') ? lireFacturesRattachees(perimetre.societeId) : Promise.resolve([]),
  ])
  // Une lecture en échec n'est pas une liste vide : l'écran doit pouvoir le dire.
  if (devis === null || factures === null) return refus('lecture_impossible', 500)
  return NextResponse.json({ devis, factures })
}

const schemaLiaison = z.object({
  devisId: z.string().uuid(),
  chantierId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!isProSocieteRole(user)) return NextResponse.json({ error: 'Réservé aux comptes de société' }, { status: 403 })
  if (!(await checkRateLimit(`pro_documents_chantiers_ecriture_${user.id}`, 30, 60_000))) return rateLimitResponse()

  let brut: unknown
  try {
    brut = await request.json()
  } catch {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }
  const v = validateBody(schemaLiaison, brut)
  if (!v.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const { devisId, chantierId } = v.data

  const perimetre = await lirePerimetreBtp(user, supabaseAdmin)
  if (societeNonResolue(user, perimetre)) return refus('societe_non_resolue', 409)
  if (!peutEcrireDocuments(perimetre, 'devis') || niveauSur(perimetre, 'chantiers') !== 'FULL') {
    return refus('aucun_droit_liaison', 403)
  }

  const { data: chantier, error: erreurChantier } = await supabaseAdmin.from('chantiers_btp').select('id')
    .eq('id', chantierId).eq('owner_id', perimetre.societeId).maybeSingle()
  if (erreurChantier) {
    logger.error('[pro/documents/chantiers] chantier illisible', { error: erreurChantier.message })
    return refus('lecture_impossible', 500)
  }
  if (!chantier) return NextResponse.json({ error: 'Chantier introuvable.' }, { status: 404 })

  const { data: lies, error } = await supabaseAdmin.from('devis').update({ chantier_id: chantierId })
    .eq('id', devisId).eq('artisan_user_id', perimetre.societeId).is('deleted_at', null).select('id')
  if (error) {
    logger.error('[pro/documents/chantiers] liaison impossible', { error: error.message })
    return NextResponse.json({ error: 'La liaison a échoué. Réessayez.' }, { status: 500 })
  }
  // Aucune ligne touchée : le devis n'est pas (ou plus) celui de la société. Jamais un succès muet.
  if (!Array.isArray(lies) || lies.length === 0) return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
