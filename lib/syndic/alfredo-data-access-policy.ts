// lib/syndic/alfredo-data-access-policy.ts
import type { SyndicRole } from './agent-types'

export type AlfredoDataSource =
  | 'coproprios'
  | 'syndic_artisans'
  | 'syndic_locataires'
  | 'syndic_emails_analysed'
  | 'syndic_messages'
  | 'syndic_documents'
  | 'syndic_missions'
  | 'syndic_planning'
  | 'syndic_devis'
  | 'syndic_factures'
  | 'syndic_appels_charges'
  | 'syndic_impayes'
  | 'syndic_recouvrement'
  | 'syndic_sinistres'
  | 'syndic_signalements'
  | 'syndic_ocorrencias'
  | 'syndic_alertes'
  | 'syndic_immeubles'
  | 'syndic_carnet_entretien'
  | 'syndic_pppt'
  | 'syndic_assemblees'

type Policy = Record<SyndicRole, AlfredoDataSource[]>

const ALL_SOURCES: AlfredoDataSource[] = [
  'coproprios', 'syndic_artisans', 'syndic_locataires',
  'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
  'syndic_missions', 'syndic_planning', 'syndic_devis', 'syndic_factures',
  'syndic_appels_charges', 'syndic_impayes', 'syndic_recouvrement',
  'syndic_sinistres', 'syndic_signalements', 'syndic_ocorrencias',
  'syndic_alertes', 'syndic_immeubles', 'syndic_carnet_entretien',
  'syndic_pppt', 'syndic_assemblees',
]

const POLICY: Policy = {
  syndic: ALL_SOURCES,
  syndic_admin: ALL_SOURCES,
  syndic_gestionnaire: ALL_SOURCES.filter(s => s !== 'syndic_recouvrement'),
  syndic_tech: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages',
    'syndic_missions', 'syndic_planning',
    'syndic_sinistres', 'syndic_signalements', 'syndic_ocorrencias',
    'syndic_alertes', 'syndic_immeubles', 'syndic_carnet_entretien',
    'syndic_pppt',
  ],
  syndic_juriste: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
    'syndic_missions', 'syndic_sinistres',
    'syndic_recouvrement', 'syndic_immeubles', 'syndic_assemblees',
  ],
  syndic_comptable: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
    'syndic_devis', 'syndic_factures',
    'syndic_appels_charges', 'syndic_impayes', 'syndic_recouvrement',
    'syndic_immeubles',
  ],
  syndic_secretaire: [
    'coproprios', 'syndic_artisans', 'syndic_locataires',
    'syndic_emails_analysed', 'syndic_messages', 'syndic_documents',
    'syndic_missions', 'syndic_planning',
    'syndic_signalements', 'syndic_ocorrencias',
    'syndic_alertes', 'syndic_immeubles', 'syndic_assemblees',
  ],
}

export const ALFREDO_DATA_ACCESS_POLICY = {
  sources: ALL_SOURCES,
  policy: POLICY,
}

export function canAccessSource(role: SyndicRole, source: AlfredoDataSource): boolean {
  const allowed = POLICY[role] ?? []
  return allowed.includes(source)
}

interface ContextLike {
  identity?: unknown
  immeuble?: unknown
  history_summary?: unknown
  recent_interactions?: unknown
  open_items?: unknown
  financial?: unknown
  immeuble_context?: unknown
}

const FIELD_TO_SOURCES: Record<string, AlfredoDataSource[]> = {
  financial: ['syndic_appels_charges', 'syndic_impayes', 'syndic_recouvrement'],
  immeuble_context: ['syndic_carnet_entretien', 'syndic_pppt', 'syndic_alertes', 'syndic_assemblees'],
}

export function filterContextByRole<T extends ContextLike>(
  role: SyndicRole,
  context: T,
): T & { rbac_omitted_fields: string[] } {
  const omitted: string[] = []
  const out = { ...context, rbac_omitted_fields: [] as string[] }

  for (const [field, requiredSources] of Object.entries(FIELD_TO_SOURCES)) {
    const hasAccess = requiredSources.every(src => canAccessSource(role, src))
    if (!hasAccess && field in out) {
      delete (out as Record<string, unknown>)[field]
      omitted.push(field)
    }
  }

  out.rbac_omitted_fields = omitted
  return out
}
