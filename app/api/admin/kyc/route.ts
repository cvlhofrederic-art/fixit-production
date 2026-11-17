import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'
import { ficheSocieteFrancaise } from '@/lib/btp/fiche-societe-francaise'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { adminKycQuerySchema, adminKycPatchSchema, validateBody } from '@/lib/validation'
import { SEAU_DOCUMENTS, signerValeurs } from '@/lib/storage/liens-stockage'

// Pièces de la fiche, rangées dans le seau privé : la fiche garde leur chemin (ou, pour une fiche ancienne, un
// lien signé peut-être expiré). L'administrateur reçoit un lien frais à chaque lecture de la liste.
const COLONNES_PIECES = ['kbis_url', 'id_document_url', 'id_document_verso_url', 'insurance_url'] as const
const DUREE_LIEN_ADMIN_S = 60 * 60

async function avecLiensFrais(lignes: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  const cibles: Array<{ ligne: number; colonne: (typeof COLONNES_PIECES)[number] }> = []
  lignes.forEach((ligne, i) => {
    for (const colonne of COLONNES_PIECES) if (ligne[colonne]) cibles.push({ ligne: i, colonne })
  })
  if (cibles.length === 0) return lignes
  let liens: Array<string | null>
  try {
    liens = await signerValeurs(SEAU_DOCUMENTS, cibles.map((c) => lignes[c.ligne][c.colonne]), {
      dossiers: 'tout-le-seau',
      dureeS: DUREE_LIEN_ADMIN_S,
      origine: '[admin/kyc]',
    })
  } catch (err) {
    logger.error('[admin/kyc] signature des liens des pièces', { erreur: err instanceof Error ? err.message : String(err) })
    return lignes
  }
  const copies = lignes.map((ligne) => ({ ...ligne }))
  // Valeur impossible à signer (autre site, stockage indisponible) : rendue telle qu'enregistrée, comme avant.
  cibles.forEach((c, i) => { if (liens[i]) copies[c.ligne][c.colonne] = liens[i] })
  return copies
}

interface KycRow {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  siret: string | null
  email: string | null
  phone: string | null
  kyc_status: string | null
  kyc_score: number | null
  kyc_checks: unknown
  kyc_verified_at: string | null
  kyc_reviewed_at: string | null
  kyc_reviewed_by: string | null
  kyc_rejection_reason: string | null
  kbis_extracted: unknown
  certidao_extracted: unknown
  kbis_url: string | null
  id_document_url: string | null
  kyc_market: string | null
  created_at: string | null
}

/**
 * Dossier d'une société BTP française : marché KYC fr_btp (inscription société) et fiche qui n'est pas en portugais
 * (critère commun aux correctifs du BTP pro, lib/btp/fiche-societe-francaise.ts). Une société inscrite en portugais
 * reçoit aussi fr_btp : elle garde le chemin d'avant (Portugal hors de ce correctif).
 */
function estSocieteBtpFrancaise(fiche: Record<string, unknown>): boolean {
  return fiche.kyc_market === 'fr_btp' && ficheSocieteFrancaise(fiche)
}

/** E-mail de décision envoyé et attendu (un envoi lancé sans attente pouvait être coupé à la fin de la requête). */
async function envoyerEmailDecision(corps: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-kyc-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify(corps),
    })
    if (!res.ok) logger.warn('[admin/kyc] e-mail de décision refusé', { status: res.status })
    return res.ok
  } catch (err: unknown) {
    logger.warn('[admin/kyc] e-mail de décision non envoyé', { erreur: err instanceof Error ? err.message : String(err) })
    return false
  }
}

// GET /api/admin/kyc — List artisans by KYC status (paginated)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = adminKycQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })
  }
  const { status, page, limit } = parsed.data
  const from = (page - 1) * limit
  const to = from + limit - 1

  logger.info('[admin/kyc] GET', { status, page, limit, adminId: user.id })

  const { data, error, count } = await supabaseAdmin
    .from('profiles_artisan')
    .select('*', { count: 'exact' })
    .eq('kyc_status', status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    logger.error('[admin/kyc] GET failed', { error: error.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    data: (await avecLiensFrais((data ?? []) as Array<Record<string, unknown>>)) as unknown as KycRow[],
    pagination: { page, limit, total, totalPages },
  })
}

// PATCH /api/admin/kyc — Approve or reject an artisan's KYC
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const v = validateBody(adminKycPatchSchema, rawBody)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { artisan_id, action, rejection_reason } = v.data

  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const reviewedAt = new Date().toISOString()
  const reviewedBy = user.email ?? user.id

  const updatePayload: Record<string, unknown> = {
    kyc_status: newStatus,
    kyc_reviewed_at: reviewedAt,
    kyc_reviewed_by: reviewedBy,
  }
  if (action === 'reject') {
    updatePayload.kyc_rejection_reason = rejection_reason
  }

  logger.info('[admin/kyc] PATCH', { artisan_id, action, reviewedBy })

  // Dossier lu une seule fois, pour choisir le chemin ; une panne de lecture répond 500 sans rien écrire.
  const { data: fiche, error: ficheError } = await supabaseAdmin
    .from('profiles_artisan')
    .select('*')
    .eq('id', artisan_id)
    .maybeSingle()
  if (ficheError) {
    logger.error('[admin/kyc] PATCH dossier illisible', { error: ficheError.message, artisan_id })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Société BTP française : la décision est écrite sans relire first_name ni last_name, colonnes absentes de la
  // production (la requête entière échouait, le statut ne changeait pas) ; l'e-mail part au nom de la société, qui
  // n'a pas de nom de dirigeant dans sa fiche, et son envoi est attendu.
  if (fiche && estSocieteBtpFrancaise(fiche)) {
    // Auteur de la décision : l'identifiant du compte de l'administrateur, pas son e-mail. La fiche, cette colonne
    // comprise, est lisible par la société (tableau de bord, export de ses données).
    const { data: ecrite, error: ecritureError } = await supabaseAdmin
      .from('profiles_artisan')
      .update({ ...updatePayload, kyc_reviewed_by: user.id })
      .eq('id', artisan_id)
      .select('id')
      .single()
    if (ecritureError || !ecrite) {
      logger.error('[admin/kyc] PATCH update failed', { error: ecritureError?.message, artisan_id })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    const societe = typeof fiche.company_name === 'string' ? fiche.company_name.trim() : ''
    const emailEnvoye = await envoyerEmailDecision({
      to: fiche.email,
      name: societe,
      company: societe,
      action,
      rejection_reason,
      market: fiche.kyc_market,
    })
    return NextResponse.json({ success: true, status: newStatus, email_envoye: emailEnvoye })
  }

  // Dossier d'artisan (marché KYC fr_artisan, pt_artisan ou non renseigné, que le pipeline KYC traite en fr_artisan) :
  // même défaut (first_name, last_name). L'e-mail de décision est attendu et la réponse dit s'il est parti. Autres
  // dossiers (société BTP inscrite en portugais, marché inconnu) : chemin d'avant (Portugal BTP exclu).
  if (fiche && estDossierArtisan(fiche)) {
    // Auteur de la décision : l'identifiant du compte de l'administrateur, pas son e-mail. La fiche, cette colonne
    // comprise, est lisible par l'artisan (tableau de bord, export de ses données).
    const { data: ecrite, error: ecritureError } = await supabaseAdmin
      .from('profiles_artisan')
      .update({ ...updatePayload, kyc_reviewed_by: user.id })
      .eq('id', artisan_id)
      .select('id')
      .single()
    if (ecritureError || !ecrite) {
      logger.error('[admin/kyc] PATCH update failed', { error: ecritureError?.message, artisan_id })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    const emailEnvoye = await prevenirArtisan(fiche, action, rejection_reason)
    return NextResponse.json({ success: true, status: newStatus, email_envoye: emailEnvoye })
  }

  const { data: updatedRows, error } = await supabaseAdmin
    .from('profiles_artisan')
    .update(updatePayload)
    .eq('id', artisan_id)
    .select('email, first_name, last_name, company_name, kyc_market')
    .single()

  if (error || !updatedRows) {
    logger.error('[admin/kyc] PATCH update failed', { error: error?.message, artisan_id })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const artisan = updatedRows as {
    email: string | null
    first_name: string | null
    last_name: string | null
    company_name: string | null
    kyc_market: string | null
  }

  // Fire-and-forget — do not await
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-kyc-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify({
      to: artisan.email,
      name: `${artisan.first_name ?? ''} ${artisan.last_name ?? ''}`.trim(),
      company: artisan.company_name,
      action,
      rejection_reason,
      market: artisan.kyc_market,
    }),
  }).catch((err: unknown) => logger.warn('[admin/kyc] Email notification failed:', err))

  return NextResponse.json({ success: true, status: newStatus })
}

/**
 * Dossier d'artisan : marché KYC fr_artisan ou pt_artisan, ou non renseigné (inscription antérieure au marché, que le
 * pipeline KYC traite en fr_artisan). fr_btp, celui des sociétés BTP, et tout autre marché gardent le chemin d'avant.
 */
function estDossierArtisan(fiche: Record<string, unknown>): boolean {
  const marche = fiche.kyc_market
  return marche === null || marche === undefined || marche === '' || marche === 'fr_artisan' || marche === 'pt_artisan'
}

const texte = (valeur: unknown): string => (typeof valeur === 'string' ? valeur.trim() : '')

/**
 * Nom porté par le compte de l'artisan (full_name, posé à l'inscription) : la fiche n'a ni prénom ni nom. Chaîne vide
 * si la fiche n'a pas de compte ou si le compte est illisible.
 */
async function nomDuCompte(userId: unknown): Promise<string> {
  const id = texte(userId)
  if (!id) return ''
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
    if (error) {
      logger.warn('[admin/kyc] compte du dossier illisible', { error: error.message })
      return ''
    }
    return texte(data.user?.user_metadata?.full_name)
  } catch (err: unknown) {
    logger.warn('[admin/kyc] compte du dossier illisible', { error: err instanceof Error ? err.message : String(err) })
    return ''
  }
}

/**
 * E-mail de décision d'un dossier d'artisan. /api/send-kyc-email exige une adresse, un nom et une entreprise non vides :
 * le nom du compte, à défaut celui de l'entreprise, et inversement ; rien n'est envoyé sans adresse ni nom. Portugais
 * pour une fiche en portugais ou un marché pt_artisan : le pipeline KYC réécrit un marché vide en fr_artisan, même pour
 * une fiche portugaise.
 */
async function prevenirArtisan(
  fiche: Record<string, unknown>,
  action: 'approve' | 'reject',
  rejectionReason: string | undefined,
): Promise<boolean> {
  const destinataire = texte(fiche.email)
  const entreprise = texte(fiche.company_name)
  const nom = destinataire ? (await nomDuCompte(fiche.user_id)) || entreprise : ''
  if (!destinataire || !nom) {
    logger.warn('[admin/kyc] e-mail de décision non envoyé : adresse ou nom absent', { artisan_id: fiche.id })
    return false
  }
  const portugais = fiche.language === 'pt' || fiche.kyc_market === 'pt_artisan'
  return envoyerEmailDecision({
    to: destinataire,
    name: nom,
    company: entreprise || nom,
    action,
    rejection_reason: rejectionReason,
    market: portugais ? 'pt_artisan' : 'fr_artisan',
  })
}
