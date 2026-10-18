import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { resoudreCoproprietaire, statutHttpAcces } from '@/lib/coproprietaire/acces'
import { memeNom, nombre, statutAssemblee } from '@/lib/coproprietaire/filtrage'
import { voteOuvert } from '@/lib/coproprietaire/api'

// ── POST /api/coproprietaire/assemblees/vote ─────────────────────────────────
// Vote par correspondance du copropriétaire connecté sur une résolution d'une assemblée de SON
// immeuble, au statut « convoquée », tant que la date limite n'est pas passée (trois jours avant la
// séance, décret n° 67-223 art. 9 bis ; loi du 10 juillet 1965 art. 17-1 A). Un seul vote par
// copropriétaire et par résolution, toutes ses fiches de l'immeuble confondues (loi de 1965 art. 22 :
// les voix d'un copropriétaire sont celles de tous ses lots) : il remplace un vote précédent jusqu'à
// la date limite. Le syndic reporte ce choix sur le formulaire officiel et consolide en séance ; les
// compteurs vote_pour/contre/abstention de la résolution ne sont jamais touchés ici.

const schema = z.object({
  resolutionId: z.string().uuid(),
  vote: z.enum(['pour', 'contre', 'abstention']),
})

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`copro_vote_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  const parametres = request.nextUrl.searchParams
  const acces = await resoudreCoproprietaire(user, supabaseAdmin, { coproprioId: parametres.get('lot'), email: parametres.get('email') })
  if (!acces.ok) return NextResponse.json({ error: acces.code }, { status: statutHttpAcces(acces.code) })
  if (acces.acces.role !== 'proprietaire') return NextResponse.json({ error: 'role_interdit' }, { status: 403 })

  const corps: unknown = await request.json().catch(() => null)
  const validation = schema.safeParse(corps)
  if (!validation.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const { resolutionId, vote } = validation.data

  const { cabinetId, fiche, fiches } = acces.acces
  const nomImmeuble = (fiche.immeuble || '').trim()
  // Toutes mes fiches de cet immeuble : un seul vote, avec les voix de tous mes lots.
  const fichesImmeuble = fiches.filter(f => memeNom(f.immeuble, nomImmeuble))
  const mesIds = (fichesImmeuble.length > 0 ? fichesImmeuble : [fiche]).map(f => f.id)
  const tantiemes = Math.round((fichesImmeuble.length > 0 ? fichesImmeuble : [fiche]).reduce((s, f) => s + nombre(f.tantieme), 0))

  try {
    const { data: res, error: resErr } = await supabaseAdmin
      .from('syndic_resolutions')
      .select('id, assemblee_id')
      .eq('id', resolutionId)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (resErr) {
      logger.error('[COPRO VOTE] lecture de la résolution', { code: resErr.code, message: resErr.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    const resolution = res as { id: string; assemblee_id: string } | null
    if (!resolution) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const { data: ag, error: agErr } = await supabaseAdmin
      .from('syndic_assemblees')
      .select('id, immeuble, date_ag, statut')
      .eq('id', resolution.assemblee_id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (agErr) {
      logger.error('[COPRO VOTE] lecture de l’assemblée', { code: agErr.code, message: agErr.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    const assemblee = ag as { id: string; immeuble: string | null; date_ag: string | null; statut: string | null } | null
    if (!assemblee || !memeNom(assemblee.immeuble, nomImmeuble)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (statutAssemblee(assemblee.statut) !== 'convoquee') return NextResponse.json({ error: 'vote_ferme' }, { status: 409 })
    if (!assemblee.date_ag || !voteOuvert(assemblee.date_ag)) return NextResponse.json({ error: 'vote_clos' }, { status: 409 })

    const nomVotant = `${fiche.prenom_proprietaire || ''} ${fiche.nom_proprietaire || ''}`.trim().slice(0, 200)
    const aujourdhui = new Date().toISOString().slice(0, 10)

    const { data: existants, error: exErr } = await supabaseAdmin
      .from('syndic_votes_correspondance')
      .select('id, created_at')
      .eq('resolution_id', resolutionId)
      .eq('cabinet_id', cabinetId)
      .in('coproprio_id', mesIds)
      .order('created_at', { ascending: false })
      .limit(10)
    if (exErr) {
      logger.error('[COPRO VOTE] lecture du vote existant', { code: exErr.code, message: exErr.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    const ids = ((existants || []) as Array<{ id: string }>).map(v => v.id)
    // Plusieurs lignes (votes papier saisis lot par lot par le syndic) : la plus récente porte le vote,
    // les autres sont retirées — un seul vote par copropriétaire (index unique de la migration 20261017).
    const [idConserve, ...idsEnTrop] = ids
    if (idsEnTrop.length > 0) {
      const { error: suppressionErr } = await supabaseAdmin.from('syndic_votes_correspondance').delete().in('id', idsEnTrop).eq('cabinet_id', cabinetId)
      if (suppressionErr) logger.warn('[COPRO VOTE] doublons non retirés', { code: suppressionErr.code, message: suppressionErr.message })
    }

    const enregistreLe = new Date().toISOString()
    const valeurs: Record<string, unknown> = { vote, date_reception: aujourdhui, tantiemes, 'copropriétaire': nomVotant, coproprio_id: fiche.id }
    // Provenance et horodatage (migration 20261017) : retirés si les colonnes manquent encore (42703).
    const provenance = { source: 'portail', horodatage: enregistreLe }
    const ecrire = (v: Record<string, unknown>) => (idConserve
      ? supabaseAdmin.from('syndic_votes_correspondance').update(v).eq('id', idConserve).eq('cabinet_id', cabinetId)
      : supabaseAdmin.from('syndic_votes_correspondance').insert({ resolution_id: resolutionId, cabinet_id: cabinetId, ...v }))
    let { error: ecritureErr } = await ecrire({ ...valeurs, ...provenance })
    if (ecritureErr?.code === '42703') {
      logger.warn('[COPRO VOTE] colonnes source/horodatage absentes (migration 20261017 non appliquée)')
      ;({ error: ecritureErr } = await ecrire(valeurs))
    }
    if (ecritureErr) {
      // 23505 : vote déjà enregistré entre la lecture et l'écriture (double clic) → le remplacer.
      if (ecritureErr.code === '23505') {
        const { error: reprise } = await supabaseAdmin.from('syndic_votes_correspondance').update(valeurs).eq('resolution_id', resolutionId).eq('cabinet_id', cabinetId).in('coproprio_id', mesIds)
        if (!reprise) return NextResponse.json({ vote: { resolutionId, vote, enregistreLe, modifie: true } })
        logger.error('[COPRO VOTE] reprise après doublon', { code: reprise.code, message: reprise.message })
      } else {
        logger.error('[COPRO VOTE] enregistrement', { code: ecritureErr.code, message: ecritureErr.message })
      }
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    return NextResponse.json({ vote: { resolutionId, vote, enregistreLe, modifie: Boolean(idConserve) } })
  } catch (e) {
    logger.error('[COPRO VOTE] exception', undefined, e)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
