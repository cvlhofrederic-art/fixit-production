// lib/syndic/alfredo-load-client-context.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { SyndicRole, Locale } from './agent-types'
import { canAccessSource, filterContextByRole } from './alfredo-data-access-policy'

export interface ClientContext {
  client_token: string
  copro_status: 'identified' | 'unknown' | 'artisan' | 'locataire'

  identity?: {
    role: 'coproprietaire' | 'locataire' | 'artisan' | 'tiers'
    lot_ref_anonymized?: string
    tantiemes?: number
    statut?: 'occupant' | 'bailleur'
    anciennete_mois?: number
  }
  immeuble?: { ref_anonymized: string; ville: string; nb_lots: number }

  history_summary: {
    total_emails: number
    last_topics: string[]
    sentiment_drift: 'positif' | 'neutre' | 'tendu'
    last_resolved_topics: string[]
  }
  recent_interactions: Array<{
    date: string
    subject: string
    channel: string
    resolution: string
  }>

  open_items: {
    missions: Array<{ id: string; titre: string; statut: string; artisan_token?: string }>
    devis_en_cours: Array<{ ref_anonymized: string; montant: number; statut: string }>
    sinistres: Array<{ id: string; titre: string; statut: string; depuis: string }>
    signalements: Array<{ id: string; titre: string; priorite: string }>
  }

  financial?: {
    statut_paiement: 'a_jour' | 'en_retard' | 'en_recouvrement'
    impayes: Array<{ montant: number; depuis: string; nature: string }>
    derniers_appels: Array<{ exercice: string; montant: number; paye: boolean }>
  }

  immeuble_context?: {
    travaux_en_cours: Array<{ ref_anonymized: string; titre: string; statut: string }>
    derniere_ag?: { date: string; resolutions_concernant: string[] }
    alertes_actives: Array<{ titre: string; severite: string }>
  }

  missing_info_hints: string[]
  rbac_omitted_fields: string[]
}

export interface LoadContextParams {
  syndicId: string
  syndicRole: SyndicRole
  emailAddress: string
  locale: Locale
}

// SupabaseClient générique — typings stricts non requis pour ce helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

function deterministicToken(emailAddress: string, syndicId: string): string {
  return 'ct_' + createHash('sha256')
    .update(`${syndicId}|${emailAddress}`)
    .digest('hex')
    .slice(0, 12)
}

export async function loadClientContext(
  client: AnyClient,
  params: LoadContextParams,
): Promise<ClientContext> {
  const { syndicId, syndicRole, emailAddress } = params

  // Wrapper résilient — retourne null si la table n'existe pas encore
  const safeCall = async <T>(promise: PromiseLike<T> | null): Promise<T | null> => {
    if (!promise) return null
    try { return await promise } catch { return null }
  }

  const coproQuery = client
    .from('syndic_coproprios')
    .select('id, nom, email, lot_ref, tantiemes, statut, immeuble_id')
    .eq('email', emailAddress)
    .maybeSingle()

  const emailsQuery = client
    .from('syndic_emails_analysed')
    .select('id, from_email, subject, body_preview, received_at, type_demande, urgence')
    .eq('syndic_id', syndicId)
    .eq('from_email', emailAddress)
    .order('received_at', { ascending: false })
    .limit(20)

  const artisanQuery = canAccessSource(syndicRole, 'syndic_artisans')
    ? client
        .from('syndic_artisans')
        .select('id, nom, email')
        .eq('email', emailAddress)
        .maybeSingle()
    : null

  const [copro, emails, artisan] = await Promise.all([
    safeCall(coproQuery),
    safeCall(emailsQuery),
    safeCall(artisanQuery),
  ])

  const coproRow = (copro as { data?: Record<string, unknown> | null } | null)?.data ?? null
  const emailsData = (emails as { data?: unknown[] } | null)?.data ?? []
  const artisanRow = (artisan as { data?: unknown | null } | null)?.data ?? null

  const isIdentified = !!coproRow
  const isArtisan = !!artisanRow

  let copro_status: ClientContext['copro_status'] = 'unknown'
  if (isArtisan) copro_status = 'artisan'
  else if (isIdentified) copro_status = 'identified'

  const baseContext: ClientContext = {
    client_token: deterministicToken(emailAddress, syndicId),
    copro_status,
    history_summary: {
      total_emails: emailsData.length,
      last_topics: extractTopics(emailsData as Array<{ type_demande?: string | null }>),
      sentiment_drift: 'neutre',
      last_resolved_topics: [],
    },
    recent_interactions: (emailsData as Array<{ received_at?: string; subject?: string | null }>).slice(0, 5).map(e => ({
      date: e.received_at ?? '',
      subject: e.subject ?? '',
      channel: 'email',
      resolution: 'pending',
    })),
    open_items: {
      missions: [],
      devis_en_cours: [],
      sinistres: [],
      signalements: [],
    },
    missing_info_hints: [],
    rbac_omitted_fields: [],
  }

  if (coproRow) {
    const lot_ref = (coproRow as { lot_ref?: unknown }).lot_ref
    const tantiemes = (coproRow as { tantiemes?: unknown }).tantiemes
    const statut = (coproRow as { statut?: unknown }).statut
    baseContext.identity = {
      role: 'coproprietaire',
      lot_ref_anonymized: lot_ref
        ? `lot_${createHash('sha256').update(String(lot_ref)).digest('hex').slice(0, 6)}`
        : undefined,
      tantiemes: typeof tantiemes === 'number' ? tantiemes : undefined,
      statut: statut === 'bailleur' || statut === 'occupant'
        ? (statut as 'bailleur' | 'occupant')
        : undefined,
    }
  }

  if (!isIdentified && !isArtisan) {
    baseContext.missing_info_hints.push(
      'Aucune correspondance copro/artisan pour cet email — Alfredo demandera clarification.',
    )
  }

  // Hydrater financial si autorisé
  if (coproRow && canAccessSource(syndicRole, 'syndic_impayes')) {
    const impayesRes = await safeCall(
      client
        .from('syndic_impayes')
        .select('montant, depuis, nature')
        .eq('coproprio_id', (coproRow as { id: string }).id)
        .limit(10),
    )
    const impayes =
      (impayesRes as { data?: Array<{ montant: number; depuis: string; nature: string }> } | null)
        ?.data ?? []
    baseContext.financial = {
      statut_paiement: impayes.length > 0 ? 'en_retard' : 'a_jour',
      impayes,
      derniers_appels: [],
    }
  }

  // Documenter les champs inaccessibles par rôle même s'ils ne sont pas encore hydratés
  const RBAC_GUARDED: Array<{ field: string; sources: Parameters<typeof canAccessSource>[1][] }> = [
    { field: 'financial', sources: ['syndic_appels_charges', 'syndic_impayes', 'syndic_recouvrement'] },
    { field: 'immeuble_context', sources: ['syndic_carnet_entretien', 'syndic_pppt', 'syndic_alertes', 'syndic_assemblees'] },
  ]
  for (const { field, sources } of RBAC_GUARDED) {
    const hasAccess = sources.every(src => canAccessSource(syndicRole, src))
    if (!hasAccess && !baseContext.rbac_omitted_fields.includes(field)) {
      baseContext.rbac_omitted_fields.push(field)
    }
  }

  return filterContextByRole(syndicRole, baseContext) as ClientContext
}

function extractTopics(emails: Array<{ type_demande?: string | null }>): string[] {
  const topics = new Set<string>()
  for (const e of emails.slice(0, 10)) {
    if (e.type_demande) topics.add(e.type_demande)
  }
  return Array.from(topics).slice(0, 5)
}
