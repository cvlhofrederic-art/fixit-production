import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, callGroqWithTools, type GroqResponse, type GroqMessageWithTools, type GroqToolsCallOptions } from '@/lib/groq'
import { logger } from '@/lib/logger'
import { traceAgent } from '@/lib/langfuse'
import { buildFixySystemPromptFR, type FixyPromptContext } from '@/lib/syndic/prompts/fixy/system-prompt-fr'
import { buildFixySystemPromptPT } from '@/lib/syndic/prompts/fixy/system-prompt-pt'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import { ROLE_PAGES, SYNDIC_MODULES } from '@/components/syndic-dashboard/config'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Fixy — Assistant Expert Syndic Vitfix Pro ────────────────────────────────
// Modèle : llama-3.3-70b-versatile (Groq)
// Capacités : contexte complet cabinet + actions directes + mémoire + multi-rôles

// ── Résolution dynamique des pages accessibles par rôle + locale ────────────
// La source de vérité est `ROLE_PAGES` (composants/syndic-dashboard/config.ts).
// On filtre par locale pour ne pas exposer à Fixy des pages FR-only quand il
// répond en PT (et inversement). Les modules sans champ `locale` sont bilingues.
const MODULE_LOCALE = new Map<string, 'fr' | 'pt' | undefined>(
  SYNDIC_MODULES.map(m => [m.key, (m as { locale?: 'fr' | 'pt' }).locale]),
)

function getPagesForRoleAndLocale(role: string, locale: 'fr' | 'pt'): string[] {
  const allowed = ROLE_PAGES[role] || ROLE_PAGES['syndic']
  return allowed.filter(p => {
    const moduleLocale = MODULE_LOCALE.get(p)
    return !moduleLocale || moduleLocale === locale
  })
}

// Labels et contexte par rôle. `pages` est ignoré ici (résolu dynamiquement
// par getPagesForRoleAndLocale au moment de la requête) — conservé pour le
// typage et la rétrocompatibilité du shape FixyPromptContext.
const ROLE_CONFIGS: Record<string, { name: string; emoji: string; expertise: string; pages: string[]; actions: string[] }> = {
  // ─── Autonomie totale ──────────────────────────────────────────────────────
  // Le directeur de cabinet et l'admin ont accès à TOUTES les actions Fixy.
  // C'est le mode "secrétaire complet" : recherche dans tous les modules +
  // création/modification de missions, RDV, alertes, factures, impayés,
  // recouvrement, signalements. Limité uniquement par RLS Supabase.
  syndic: {
    name: 'Administrateur Cabinet',
    emoji: '🏢',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    pages: ['missions', 'alertes', 'coproprios', 'reglementaire', 'rapport', 'immeubles', 'artisans', 'planning', 'documents', 'emails', 'parametres', 'facturation', 'equipe', 'comptabilite_tech', 'compta_copro', 'impayés', 'recouvrement', 'signalements_fr', 'ag_digitale', 'appels_fonds', 'sinistres', 'analyse_devis'],
    actions: ['create_mission', 'assign_mission', 'navigate', 'create_alert', 'update_mission', 'send_message', 'create_document', 'create_event', 'update_event', 'delete_event', 'update_signalement', 'create_facture_copro', 'update_facture_copro', 'create_appel_charges', 'update_impaye', 'create_recouvrement'],
  },
  syndic_admin: {
    name: 'Administrateur Cabinet',
    emoji: '👑',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    pages: ['missions', 'alertes', 'coproprios', 'reglementaire', 'rapport', 'immeubles', 'artisans', 'planning', 'documents', 'emails', 'parametres', 'facturation', 'equipe', 'compta_copro', 'impayés', 'recouvrement', 'signalements_fr', 'ag_digitale', 'appels_fonds', 'sinistres'],
    actions: ['create_mission', 'assign_mission', 'navigate', 'create_alert', 'update_mission', 'send_message', 'create_document', 'create_event', 'update_event', 'delete_event', 'update_signalement', 'create_facture_copro', 'update_facture_copro', 'create_appel_charges', 'update_impaye', 'create_recouvrement'],
  },
  syndic_tech: {
    name: 'Gestionnaire Technique',
    emoji: '🔧',
    expertise: 'Interventions techniques, artisans, missions, suivi travaux, comptabilité technique, analyse devis/factures, facturation, copropriétaires, immeubles, emails, proof of work',
    pages: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'facturation', 'planning', 'alertes', 'emails', 'signalements_fr', 'sinistres'],
    actions: ['create_mission', 'assign_mission', 'navigate', 'update_mission', 'send_message', 'create_alert', 'create_event', 'update_event', 'delete_event', 'update_signalement'],
  },
  syndic_secretaire: {
    name: 'Secrétaire',
    emoji: '📋',
    expertise: 'Correspondances, emails, copropriétaires, convocations AG, documents administratifs, accueil, planning et rendez-vous',
    pages: ['coproprios', 'emails', 'documents', 'planning', 'alertes', 'missions', 'immeubles', 'artisans', 'ag_digitale', 'signalements_fr'],
    actions: ['navigate', 'create_document', 'send_message', 'create_alert', 'create_event', 'update_event', 'delete_event', 'create_mission', 'assign_mission', 'update_signalement'],
  },
  syndic_gestionnaire: {
    name: 'Gestionnaire Copropriété',
    emoji: '🏘️',
    expertise: 'Gestion copropriétés, immeubles, réglementaire, assemblées générales, contentieux, artisans, facturation, emails copropriétaires',
    pages: ['immeubles', 'coproprios', 'artisans', 'missions', 'planning', 'reglementaire', 'alertes', 'documents', 'facturation', 'emails', 'compta_copro', 'impayés', 'signalements_fr', 'ag_digitale'],
    actions: ['create_mission', 'assign_mission', 'navigate', 'create_alert', 'create_document', 'send_message', 'create_event', 'update_event', 'delete_event', 'update_signalement', 'create_appel_charges', 'update_impaye'],
  },
  syndic_comptable: {
    name: 'Comptable',
    emoji: '💶',
    expertise: 'Comptabilité syndic, budgets prévisionnels, appels de charges, factures, rapports financiers, impayés, recouvrement',
    pages: ['facturation', 'rapport', 'documents', 'immeubles', 'compta_copro', 'impayés', 'recouvrement', 'appels_fonds'],
    actions: ['navigate', 'create_document', 'create_facture_copro', 'update_facture_copro', 'create_appel_charges', 'update_impaye', 'create_recouvrement', 'send_message'],
  },
}

interface ImmeubleSummary { nom: string; ville: string; nbLots: number; budgetAnnuel?: number; depensesAnnee?: number; pctBudget: number | string }
interface ArtisanSummary { nom: string; metier?: string; statut: string; rcProValide: boolean; rcProExpiration?: string; note: number; vitfixCertifie?: boolean; email?: string; artisan_user_id?: string }
interface MissionSummary { id?: string; priorite?: string; immeuble: string; artisan: string; type: string; description: string; statut: string; dateIntervention?: string; montantDevis?: number }
interface AlerteSummary { urgence?: string; message: string }
interface EcheanceSummary { immeuble: string; label: string; dateEcheance: string }
interface DocumentSummary { type: string; nom: string; immeuble?: string; date: string }

// ── Tool helpers — search_dossier + find_email_thread ────────────────────────

export interface SearchDossierResult {
  coproprios: Array<{ id: string; nom?: string; immeuble?: string }>
  missions: Array<{ id: string; immeuble: string; type: string; description: string; statut: string }>
  signalements: Array<{ id: string; immeuble_nom?: string; type_intervention?: string; statut?: string }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchDossier(client: any, cabinetId: string | null, query: string): Promise<SearchDossierResult> {
  const trimmed = query.trim()
  if (!trimmed || !cabinetId) {
    return { coproprios: [], missions: [], signalements: [] }
  }

  const term = `%${trimmed}%`

  const [coproRes, missionRes, signalRes] = await Promise.all([
    client
      .from('syndic_coproprios')
      .select('id, nom, immeuble')
      .eq('cabinet_id', cabinetId)
      .or(`nom.ilike.${term},immeuble.ilike.${term}`)
      .limit(10),
    client
      .from('syndic_missions')
      .select('id, immeuble, type, description, statut')
      .eq('cabinet_id', cabinetId)
      .or(`immeuble.ilike.${term},description.ilike.${term},type.ilike.${term}`)
      .limit(10),
    client
      .from('syndic_signalements')
      .select('id, immeuble_nom, type_intervention, statut')
      .eq('cabinet_id', cabinetId)
      .or(`immeuble_nom.ilike.${term},type_intervention.ilike.${term}`)
      .limit(10),
  ])

  return {
    coproprios: coproRes.data ?? [],
    missions: missionRes.data ?? [],
    signalements: signalRes.data ?? [],
  }
}

export interface FindEmailThreadResult {
  emails: Array<{ id: string; from_email?: string; subject?: string; received_at?: string; resume_ia?: string; statut?: string }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execFindEmailThread(client: any, syndicId: string, criteria: { email?: string; subject?: string }): Promise<FindEmailThreadResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_emails_analysed')
    .select('id, from_email, subject, received_at, resume_ia, statut')
    .eq('syndic_id', syndicId)
    .order('received_at', { ascending: false })
    .limit(20)

  if (criteria.email) q = q.ilike('from_email', `%${criteria.email}%`)
  if (criteria.subject) q = q.ilike('subject', `%${criteria.subject}%`)

  const { data } = await q
  return { emails: data ?? [] }
}

// ── Tool helpers étendus (Phase 2) ────────────────────────────────────────────
// Tous les tools ci-dessous filtrent par cabinet_id pour rester aligné avec RLS.
// Retour borné (limite 25-30) pour éviter de saturer le contexte LLM.

const FACT_LIMIT = 25
const norm = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchFacturesCopro(client: any, cabinetId: string | null, criteria: { prestataire?: string; mois?: number; annee?: number; statut?: string; montant_min?: number; montant_max?: number; immeuble_id?: string; coproprio_id?: string }) {
  if (!cabinetId) return { factures: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_factures_copro')
    .select('id, numero_facture, emise_le, echeance, montant_ht, tva_taux, montant_ttc, description, statut, coproprio_id, immeuble_id')
    .eq('cabinet_id', cabinetId)
    .order('emise_le', { ascending: false })
    .limit(FACT_LIMIT)
  if (norm(criteria.prestataire)) q = q.ilike('description', `%${criteria.prestataire}%`)
  if (norm(criteria.statut)) q = q.eq('statut', criteria.statut)
  if (criteria.immeuble_id) q = q.eq('immeuble_id', criteria.immeuble_id)
  if (criteria.coproprio_id) q = q.eq('coproprio_id', criteria.coproprio_id)
  if (typeof criteria.montant_min === 'number') q = q.gte('montant_ttc', criteria.montant_min)
  if (typeof criteria.montant_max === 'number') q = q.lte('montant_ttc', criteria.montant_max)
  if (criteria.annee || criteria.mois) {
    const annee = criteria.annee ?? new Date().getFullYear()
    const mois = criteria.mois
    if (mois && mois >= 1 && mois <= 12) {
      const start = `${annee}-${String(mois).padStart(2, '0')}-01`
      const endMonth = mois === 12 ? 1 : mois + 1
      const endYear = mois === 12 ? annee + 1 : annee
      const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
      q = q.gte('emise_le', start).lt('emise_le', end)
    } else if (criteria.annee) {
      q = q.gte('emise_le', `${annee}-01-01`).lt('emise_le', `${annee + 1}-01-01`)
    }
  }
  const { data } = await q
  return { factures: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchImpayes(client: any, cabinetId: string | null, criteria: { coproprio_id?: string; immeuble_id?: string; statut?: string; depuis?: string; nature?: string }) {
  if (!cabinetId) return { impayes: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_impayes')
    .select('id, coproprio_id, immeuble_id, appel_charge_id, montant, nature, depuis, derniere_relance_at, nb_relances, statut, notes')
    .eq('cabinet_id', cabinetId)
    .order('depuis', { ascending: true })
    .limit(FACT_LIMIT)
  if (criteria.coproprio_id) q = q.eq('coproprio_id', criteria.coproprio_id)
  if (criteria.immeuble_id) q = q.eq('immeuble_id', criteria.immeuble_id)
  if (norm(criteria.statut)) q = q.eq('statut', criteria.statut)
  if (norm(criteria.nature)) q = q.eq('nature', criteria.nature)
  if (criteria.depuis) q = q.gte('depuis', criteria.depuis)
  const { data } = await q
  return { impayes: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchAppelsCharges(client: any, cabinetId: string | null, criteria: { immeuble_id?: string; exercice?: string; statut?: string; echeance_avant?: string }) {
  if (!cabinetId) return { appels: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_appels_charges')
    .select('id, immeuble_id, coproprio_id, exercice, periode_debut, periode_fin, montant_total, montant_paye, statut, echeance, notes')
    .eq('cabinet_id', cabinetId)
    .order('periode_debut', { ascending: false })
    .limit(FACT_LIMIT)
  if (criteria.immeuble_id) q = q.eq('immeuble_id', criteria.immeuble_id)
  if (norm(criteria.exercice)) q = q.eq('exercice', criteria.exercice)
  if (norm(criteria.statut)) q = q.eq('statut', criteria.statut)
  if (criteria.echeance_avant) q = q.lte('echeance', criteria.echeance_avant)
  const { data } = await q
  return { appels: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchRecouvrement(client: any, cabinetId: string | null, criteria: { coproprio_id?: string; procedure?: string; statut?: string }) {
  if (!cabinetId) return { procedures: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_recouvrement')
    .select('id, coproprio_id, immeuble_id, impaye_id, procedure, statut, montant_initial, montant_recouvre, date_ouverture, date_cloture, avocat_huissier, prochaine_echeance')
    .eq('cabinet_id', cabinetId)
    .order('date_ouverture', { ascending: false })
    .limit(FACT_LIMIT)
  if (criteria.coproprio_id) q = q.eq('coproprio_id', criteria.coproprio_id)
  if (norm(criteria.procedure)) q = q.eq('procedure', criteria.procedure)
  if (norm(criteria.statut)) q = q.eq('statut', criteria.statut)
  const { data } = await q
  return { procedures: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchSignalements(client: any, cabinetId: string | null, criteria: { immeuble_nom?: string; statut?: string; priorite?: string; type_intervention?: string; date_apres?: string }) {
  if (!cabinetId) return { signalements: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_signalements')
    .select('id, immeuble_nom, demandeur_nom, demandeur_email, type_intervention, description, priorite, statut, batiment, etage, artisan_assigne, created_at')
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: false })
    .limit(FACT_LIMIT)
  if (norm(criteria.immeuble_nom)) q = q.ilike('immeuble_nom', `%${criteria.immeuble_nom}%`)
  if (norm(criteria.statut)) q = q.eq('statut', criteria.statut)
  if (norm(criteria.priorite)) q = q.eq('priorite', criteria.priorite)
  if (norm(criteria.type_intervention)) q = q.ilike('type_intervention', `%${criteria.type_intervention}%`)
  if (criteria.date_apres) q = q.gte('created_at', criteria.date_apres)
  const { data } = await q
  return { signalements: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchAssemblees(client: any, cabinetId: string | null, criteria: { immeuble?: string; statut?: string; type_ag?: string; date_apres?: string }) {
  if (!cabinetId) return { assemblees: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_assemblees')
    .select('id, titre, immeuble, date_ag, lieu, type_ag, statut, quorum, presents')
    .eq('cabinet_id', cabinetId)
    .order('date_ag', { ascending: false })
    .limit(FACT_LIMIT)
  if (norm(criteria.immeuble)) q = q.ilike('immeuble', `%${criteria.immeuble}%`)
  if (norm(criteria.statut)) q = q.eq('statut', criteria.statut)
  if (norm(criteria.type_ag)) q = q.eq('type_ag', criteria.type_ag)
  if (criteria.date_apres) q = q.gte('date_ag', criteria.date_apres)
  const { data } = await q
  return { assemblees: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchPlanning(client: any, cabinetId: string | null, criteria: { assigne_a?: string; date_debut?: string; date_fin?: string; type?: string; statut?: string }) {
  if (!cabinetId) return { events: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_planning_events')
    .select('id, titre, type, date, heure, duree_min, assigne_a, assigne_role, description, statut, cree_par')
    .eq('cabinet_id', cabinetId)
    .order('date', { ascending: true })
    .order('heure', { ascending: true })
    .limit(50)
  if (norm(criteria.assigne_a)) q = q.ilike('assigne_a', `%${criteria.assigne_a}%`)
  if (criteria.date_debut) q = q.gte('date', criteria.date_debut)
  if (criteria.date_fin) q = q.lte('date', criteria.date_fin)
  if (norm(criteria.type)) q = q.eq('type', criteria.type)
  if (norm(criteria.statut)) q = q.eq('statut', criteria.statut)
  const { data } = await q
  return { events: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchArtisans(client: any, cabinetId: string | null, criteria: { metier?: string; ville?: string; nom?: string }) {
  if (!cabinetId) return { artisans: [] }
  // La table syndic_artisans peut ne pas exister selon le déploiement —
  // on tente d'abord la table cabinet, puis profiles_artisan en fallback global.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
    let q: any = client
      .from('syndic_artisans')
      .select('id, nom, metier, statut, email, telephone, ville, rc_pro_valide, rc_pro_expiration, note, vitfix_certifie')
      .eq('cabinet_id', cabinetId)
      .limit(FACT_LIMIT)
    if (norm(criteria.metier)) q = q.ilike('metier', `%${criteria.metier}%`)
    if (norm(criteria.ville)) q = q.ilike('ville', `%${criteria.ville}%`)
    if (norm(criteria.nom)) q = q.ilike('nom', `%${criteria.nom}%`)
    const { data, error } = await q
    if (!error && data && data.length > 0) return { artisans: data }
  } catch {
    // fallback ci-dessous
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
    let q2: any = client
      .from('profiles_artisan')
      .select('id, nom, type_activite, email, telephone, ville')
      .limit(FACT_LIMIT)
    if (norm(criteria.metier)) q2 = q2.ilike('type_activite', `%${criteria.metier}%`)
    if (norm(criteria.ville)) q2 = q2.ilike('ville', `%${criteria.ville}%`)
    if (norm(criteria.nom)) q2 = q2.ilike('nom', `%${criteria.nom}%`)
    const { data } = await q2
    return { artisans: (data ?? []).map((a: { id: string; nom?: string; type_activite?: string; email?: string; telephone?: string; ville?: string }) => ({ id: a.id, nom: a.nom, metier: a.type_activite, email: a.email, telephone: a.telephone, ville: a.ville })) }
  } catch {
    return { artisans: [] }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchImmeubles(client: any, cabinetId: string | null, criteria: { nom?: string; ville?: string; nb_lots_min?: number }) {
  if (!cabinetId) return { immeubles: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_immeubles')
    .select('id, nom, adresse, ville, code_postal, nb_lots, annee_construction, gestionnaire, budget_annuel, depenses_annee')
    .eq('cabinet_id', cabinetId)
    .limit(FACT_LIMIT)
  if (norm(criteria.nom)) q = q.ilike('nom', `%${criteria.nom}%`)
  if (norm(criteria.ville)) q = q.ilike('ville', `%${criteria.ville}%`)
  if (typeof criteria.nb_lots_min === 'number') q = q.gte('nb_lots', criteria.nb_lots_min)
  const { data } = await q
  return { immeubles: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execSearchCoproprios(client: any, cabinetId: string | null, criteria: { nom?: string; immeuble?: string; num_lot?: string; email?: string }) {
  if (!cabinetId) return { coproprios: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_coproprios')
    .select('id, nom, immeuble, email, telephone, num_lot')
    .eq('cabinet_id', cabinetId)
    .limit(FACT_LIMIT)
  if (norm(criteria.nom)) q = q.ilike('nom', `%${criteria.nom}%`)
  if (norm(criteria.immeuble)) q = q.ilike('immeuble', `%${criteria.immeuble}%`)
  if (norm(criteria.num_lot)) q = q.eq('num_lot', criteria.num_lot)
  if (norm(criteria.email)) q = q.ilike('email', `%${criteria.email}%`)
  const { data } = await q
  return { coproprios: data ?? [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execGetMissionDetail(client: any, cabinetId: string | null, mission_id: string) {
  if (!cabinetId || !mission_id) return { mission: null }
  const { data } = await client
    .from('syndic_missions')
    .select('*')
    .eq('cabinet_id', cabinetId)
    .eq('id', mission_id)
    .maybeSingle()
  return { mission: data ?? null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe
export async function execFindTeamMember(client: any, cabinetId: string | null, criteria: { nom?: string; email?: string; role?: string }) {
  if (!cabinetId) return { members: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder Supabase chainable
  let q: any = client
    .from('syndic_team_members')
    .select('id, user_id, email, full_name, role, is_active')
    .eq('cabinet_id', cabinetId)
    .eq('is_active', true)
    .limit(20)
  if (norm(criteria.nom)) q = q.ilike('full_name', `%${criteria.nom}%`)
  if (norm(criteria.email)) q = q.ilike('email', `%${criteria.email}%`)
  if (norm(criteria.role)) q = q.eq('role', criteria.role)
  const { data } = await q
  return { members: data ?? [] }
}

// ── Définitions des tools (native Groq function-calling) ─────────────────────
// Chaque tool ici doit avoir une implémentation correspondante dans dispatchTool().
// Les `parameters` suivent JSONSchema draft-7.

const FIXY_TOOLS: GroqToolsCallOptions['tools'] = [
  {
    type: 'function',
    function: {
      name: 'search_dossier',
      description: 'Recherche globale dans les dossiers : copropriétaires, missions, signalements. Utiliser pour des recherches textuelles transverses ("le dossier Dupont", "tout ce qui touche au Parc Corot").',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terme de recherche (nom, lieu, mot-clé).' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_email_thread',
      description: 'Retrouver un email reçu par le cabinet (analysé par Alfredo).',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Adresse expéditrice (filtre partiel).' },
          subject: { type: 'string', description: 'Objet partiel.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_factures_copro',
      description: 'Recherche dans les factures émises au copropriétaire. Utiliser pour "trouve la facture de février", "factures EDF", "factures impayées".',
      parameters: {
        type: 'object',
        properties: {
          prestataire: { type: 'string', description: 'Nom prestataire (recherche partielle dans description).' },
          mois: { type: 'integer', description: 'Mois 1-12 (filtre par emise_le).' },
          annee: { type: 'integer', description: 'Année 4 chiffres.' },
          statut: { type: 'string', enum: ['a_regler', 'partiellement_regle', 'reglee', 'contestee', 'annulee'] },
          montant_min: { type: 'number' },
          montant_max: { type: 'number' },
          immeuble_id: { type: 'string', description: 'UUID immeuble (optionnel).' },
          coproprio_id: { type: 'string', description: 'UUID copropriétaire (optionnel).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_impayes',
      description: 'Recherche dans les impayés (créances non recouvrées) du cabinet.',
      parameters: {
        type: 'object',
        properties: {
          coproprio_id: { type: 'string' },
          immeuble_id: { type: 'string' },
          statut: { type: 'string', enum: ['ouvert', 'en_recouvrement', 'solde', 'passe_perte'] },
          nature: { type: 'string', enum: ['charges_courantes', 'travaux', 'fonds_reserve', 'interets_retard', 'frais_relance', 'autre'] },
          depuis: { type: 'string', description: 'Date YYYY-MM-DD (impayés à partir de).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_appels_charges',
      description: 'Recherche dans les appels de charges trimestriels.',
      parameters: {
        type: 'object',
        properties: {
          immeuble_id: { type: 'string' },
          exercice: { type: 'string', description: 'Ex: "2026-T2".' },
          statut: { type: 'string', enum: ['a_payer', 'partiellement_paye', 'solde', 'en_retard', 'annule'] },
          echeance_avant: { type: 'string', description: 'Date YYYY-MM-DD.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_recouvrement',
      description: 'Recherche dans les procédures de recouvrement ouvertes.',
      parameters: {
        type: 'object',
        properties: {
          coproprio_id: { type: 'string' },
          procedure: { type: 'string', enum: ['amiable', 'mise_en_demeure', 'huissier', 'tribunal', 'saisie', 'accord_paiement'] },
          statut: { type: 'string', enum: ['en_cours', 'suspendu', 'cloture_succes', 'cloture_echec'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_signalements',
      description: 'Recherche détaillée dans les signalements (incidents techniques).',
      parameters: {
        type: 'object',
        properties: {
          immeuble_nom: { type: 'string' },
          statut: { type: 'string', enum: ['en_attente', 'acceptee', 'en_cours', 'terminee', 'annulee'] },
          priorite: { type: 'string', enum: ['urgente', 'normale', 'planifiee'] },
          type_intervention: { type: 'string', description: 'Plomberie, électricité, etc.' },
          date_apres: { type: 'string', description: 'YYYY-MM-DD.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_assemblees',
      description: 'Recherche dans les assemblées générales du cabinet.',
      parameters: {
        type: 'object',
        properties: {
          immeuble: { type: 'string' },
          statut: { type: 'string' },
          type_ag: { type: 'string', enum: ['ordinaire', 'extraordinaire'] },
          date_apres: { type: 'string', description: 'YYYY-MM-DD.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_planning',
      description: "Recherche dans le planning du cabinet. Permet de lister les rendez-vous d'un membre précis (par nom dans `assigne_a`) ou sur une plage de dates.",
      parameters: {
        type: 'object',
        properties: {
          assigne_a: { type: 'string', description: 'Nom du membre concerné (recherche partielle).' },
          date_debut: { type: 'string', description: 'YYYY-MM-DD inclus.' },
          date_fin: { type: 'string', description: 'YYYY-MM-DD inclus.' },
          type: { type: 'string', description: 'rdv | ag | visite | reunion | autre.' },
          statut: { type: 'string', description: 'planifie | termine | annule.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_artisans',
      description: 'Recherche détaillée des artisans (par métier, ville, nom).',
      parameters: {
        type: 'object',
        properties: {
          metier: { type: 'string' },
          ville: { type: 'string' },
          nom: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_immeubles',
      description: 'Recherche détaillée des immeubles du cabinet.',
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          ville: { type: 'string' },
          nb_lots_min: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_coproprios',
      description: 'Recherche détaillée des copropriétaires (nom, lot, email, immeuble).',
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          immeuble: { type: 'string' },
          num_lot: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mission_detail',
      description: "Lecture complète d'une mission par son UUID (rapport artisan, montants, dates).",
      parameters: {
        type: 'object',
        properties: {
          mission_id: { type: 'string', description: 'UUID de la mission.' },
        },
        required: ['mission_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_team_member',
      description: "Trouver un membre de l'équipe du cabinet (pour résoudre 'agenda de Marie' → user_id). Indispensable avant create_event/update_event sur l'agenda d'un autre membre.",
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: 'Recherche partielle sur full_name.' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable'] },
        },
      },
    },
  },
]

// Exécute un tool_call Groq et retourne le résultat sérialisé pour réinjection.
async function dispatchTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
  args: Record<string, any>,
  ctx: { cabinetId: string | null; userId: string; tokenMap: Map<string, string> },
): Promise<unknown> {
  const tm = ctx.tokenMap
  const r = (v: unknown) => (typeof v === 'string' ? resolveSanitizedToken(v, tm) ?? v : v)
  switch (name) {
    case 'search_dossier':
      return execSearchDossier(supabaseAdmin, ctx.cabinetId, String(r(args.query) ?? ''))
    case 'find_email_thread':
      return execFindEmailThread(supabaseAdmin, ctx.userId, { email: r(args.email) as string | undefined, subject: r(args.subject) as string | undefined })
    case 'search_factures_copro':
      return execSearchFacturesCopro(supabaseAdmin, ctx.cabinetId, {
        prestataire: r(args.prestataire) as string | undefined,
        mois: typeof args.mois === 'number' ? args.mois : undefined,
        annee: typeof args.annee === 'number' ? args.annee : undefined,
        statut: r(args.statut) as string | undefined,
        montant_min: typeof args.montant_min === 'number' ? args.montant_min : undefined,
        montant_max: typeof args.montant_max === 'number' ? args.montant_max : undefined,
        immeuble_id: args.immeuble_id,
        coproprio_id: args.coproprio_id,
      })
    case 'search_impayes':
      return execSearchImpayes(supabaseAdmin, ctx.cabinetId, {
        coproprio_id: args.coproprio_id,
        immeuble_id: args.immeuble_id,
        statut: r(args.statut) as string | undefined,
        nature: r(args.nature) as string | undefined,
        depuis: args.depuis,
      })
    case 'search_appels_charges':
      return execSearchAppelsCharges(supabaseAdmin, ctx.cabinetId, {
        immeuble_id: args.immeuble_id,
        exercice: r(args.exercice) as string | undefined,
        statut: r(args.statut) as string | undefined,
        echeance_avant: args.echeance_avant,
      })
    case 'search_recouvrement':
      return execSearchRecouvrement(supabaseAdmin, ctx.cabinetId, {
        coproprio_id: args.coproprio_id,
        procedure: r(args.procedure) as string | undefined,
        statut: r(args.statut) as string | undefined,
      })
    case 'search_signalements':
      return execSearchSignalements(supabaseAdmin, ctx.cabinetId, {
        immeuble_nom: r(args.immeuble_nom) as string | undefined,
        statut: r(args.statut) as string | undefined,
        priorite: r(args.priorite) as string | undefined,
        type_intervention: r(args.type_intervention) as string | undefined,
        date_apres: args.date_apres,
      })
    case 'search_assemblees':
      return execSearchAssemblees(supabaseAdmin, ctx.cabinetId, {
        immeuble: r(args.immeuble) as string | undefined,
        statut: r(args.statut) as string | undefined,
        type_ag: r(args.type_ag) as string | undefined,
        date_apres: args.date_apres,
      })
    case 'search_planning':
      return execSearchPlanning(supabaseAdmin, ctx.cabinetId, {
        assigne_a: r(args.assigne_a) as string | undefined,
        date_debut: args.date_debut,
        date_fin: args.date_fin,
        type: r(args.type) as string | undefined,
        statut: r(args.statut) as string | undefined,
      })
    case 'search_artisans':
      return execSearchArtisans(supabaseAdmin, ctx.cabinetId, {
        metier: r(args.metier) as string | undefined,
        ville: r(args.ville) as string | undefined,
        nom: r(args.nom) as string | undefined,
      })
    case 'search_immeubles':
      return execSearchImmeubles(supabaseAdmin, ctx.cabinetId, {
        nom: r(args.nom) as string | undefined,
        ville: r(args.ville) as string | undefined,
        nb_lots_min: typeof args.nb_lots_min === 'number' ? args.nb_lots_min : undefined,
      })
    case 'search_coproprios':
      return execSearchCoproprios(supabaseAdmin, ctx.cabinetId, {
        nom: r(args.nom) as string | undefined,
        immeuble: r(args.immeuble) as string | undefined,
        num_lot: r(args.num_lot) as string | undefined,
        email: r(args.email) as string | undefined,
      })
    case 'get_mission_detail':
      return execGetMissionDetail(supabaseAdmin, ctx.cabinetId, String(args.mission_id ?? ''))
    case 'find_team_member':
      return execFindTeamMember(supabaseAdmin, ctx.cabinetId, {
        nom: r(args.nom) as string | undefined,
        email: r(args.email) as string | undefined,
        role: r(args.role) as string | undefined,
      })
    default:
      return { error: `tool_unknown:${name}` }
  }
}

// ── Fallback sans API Groq ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Syndic context from frontend with dynamic shape
function generateFallback(message: string, ctx: Record<string, any>, userRole: string, locale?: string): string {
  const msg = message.toLowerCase()
  const stats = ctx.stats || {}
  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']
  const fmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  if (msg.includes('alerta') || msg.includes('alerte') || msg.includes('urgent')) {
    const alerts = (ctx.alertes as AlerteSummary[] || []).filter((a) => a.urgence === 'haute')
    if (alerts.length === 0) return locale === 'pt' ? '✅ **Nenhum alerta urgente** neste momento.' : '✅ **Aucune alerte urgente** en ce moment.'
    return `🔴 **${alerts.length} alerta(s) urgente(s):**\n\n${alerts.map((a) => `- ${a.message}`).join('\n')}`
  }

  if (msg.includes('budget') || msg.includes('orçamento') || msg.includes('dépense') || msg.includes('despesa') || msg.includes('finance') || msg.includes('finança')) {
    const pct = stats.totalBudget > 0 ? Math.round(stats.totalDepenses / stats.totalBudget * 100) : 0
    if (locale === 'pt') {
      return `💶 **Orçamento global**: ${stats.totalDepenses?.toLocaleString(fmtLocale)}€ / ${stats.totalBudget?.toLocaleString(fmtLocale)}€ (**${pct}% utilizado**)\n\n${pct > 80 ? '⚠️ Atenção: orçamento quase esgotado.' : '✅ Orçamento dentro dos limites.'}`
    }
    return `💶 **Budget global** : ${stats.totalDepenses?.toLocaleString(fmtLocale)}€ / ${stats.totalBudget?.toLocaleString(fmtLocale)}€ (**${pct}% consommé**)\n\n${pct > 80 ? '⚠️ Attention : budget proche de l\'épuisement.' : '✅ Budget dans les limites.'}`
  }

  if (msg.includes('mission') || msg.includes('missão') || msg.includes('missões')) {
    if (locale === 'pt') {
      return `📋 **Missões**: ${ctx.missions?.length || 0} no total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions as MissionSummary[] || []).slice(0, 3).map((m) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan}: ${m.description}`).join('\n')}`
    }
    return `📋 **Missions** : ${ctx.missions?.length || 0} au total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions as MissionSummary[] || []).slice(0, 3).map((m) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
  }

  if (msg.includes('artisan') || msg.includes('profissional') || msg.includes('rc pro')) {
    const expired = (ctx.artisans as ArtisanSummary[] || []).filter((a) => !a.rcProValide)
    if (locale === 'pt') {
      return expired.length > 0
        ? `⚠️ **${expired.length} profissional(ais) com RC Pro expirado:**\n\n${expired.map((a) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Ação necessária: suspender até renovação.`
        : `✅ Todos os profissionais têm **RC Pro válido**.`
    }
    return expired.length > 0
      ? `⚠️ **${expired.length} artisan(s) avec RC Pro expirée :**\n\n${expired.map((a) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Action requise : suspendre jusqu'au renouvellement.`
      : `✅ Tous les artisans ont une **RC Pro valide**.`
  }

  if (locale === 'pt') {
    return `🤖 **Fixy ${roleConfig.emoji} — ${roleConfig.name}**\n\nSou o seu assistente IA Vitfix Pro. Configure a chave GROQ_API_KEY para ativar a IA completa.\n\nPosso ajudá-lo com:\n- As suas missões e profissionais\n- Os seus orçamentos e alertas\n- Redação de correspondência\n- Regulamentação de condomínio`
  }
  return `🤖 **Fixy ${roleConfig.emoji} — ${roleConfig.name}**\n\nJe suis votre assistant IA Vitfix Pro. Configurez la clé GROQ_API_KEY pour activer l'IA complète.\n\nJe peux vous aider sur :\n- Vos missions et artisans\n- Vos budgets et alertes\n- La rédaction de courriers\n- La réglementation copropriété`
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 40, 60_000))) {
      return rateLimitResponse()
    }

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = getUserRole(user) || 'syndic'

    const body = await request.json()
    const { message, syndic_context: clientContext = {}, conversation_history = [], locale } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message requis' }, { status: 400 })
    }

    // Hydrater le contexte depuis la DB (le client envoie souvent un objet vide ou partiel)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contexte dynamique mixte
    let syndic_context: Record<string, any> = clientContext
    try {
      const { loadFixyContext } = await import('@/lib/syndic/fixy-context-loader')
      const hydrated = await loadFixyContext(supabaseAdmin, user)
      // Le client peut surcharger l'hydratation si conflit (ex : vue en cours)
      syndic_context = { ...hydrated, ...clientContext }
    } catch (err) {
      console.warn('[fixy] context hydration failed, using client context only:', err)
    }

    // Ajouter le rôle dans le contexte
    syndic_context.user_role = userRole
    syndic_context.user_name = user.user_metadata?.full_name || user.email

    // Limiter l'historique (max 60 messages pour garder plus de contexte)
    const limitedHistory = Array.isArray(conversation_history) ? conversation_history.slice(-60) : []

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole, locale),
        fallback: true,
      })
    }

    // Résoudre la locale (défaut: 'fr')
    const resolvedLocale: 'fr' | 'pt' = locale === 'pt' ? 'pt' : 'fr'

    // Pré-calculer les données de date (partagées entre FR et PT)
    const now = new Date()
    const fmtLocale = resolvedLocale === 'pt' ? 'pt-PT' : 'fr-FR'
    const today = now.toLocaleDateString(fmtLocale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    const todayISO = now.toISOString().split('T')[0]
    const joursNoms = resolvedLocale === 'pt'
      ? ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
      : ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const dateMapping: string[] = []
    if (resolvedLocale === 'pt') {
      dateMapping.push(`  - "hoje" = ${todayISO} (${joursNoms[now.getDay()]})`)
      const amanha = new Date(now); amanha.setDate(amanha.getDate() + 1)
      dateMapping.push(`  - "amanhã" = ${amanha.toISOString().split('T')[0]} (${joursNoms[amanha.getDay()]})`)
    } else {
      dateMapping.push(`  - "aujourd'hui" = ${todayISO} (${joursNoms[now.getDay()]})`)
      const demain = new Date(now); demain.setDate(demain.getDate() + 1)
      dateMapping.push(`  - "demain" = ${demain.toISOString().split('T')[0]} (${joursNoms[demain.getDay()]})`)
    }
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i)
      dateMapping.push(`  - "${joursNoms[d.getDay()]}" = ${d.toISOString().split('T')[0]}`)
    }
    const nextWeekMonday = new Date(now)
    const dayOfWeek = nextWeekMonday.getDay()
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek
    nextWeekMonday.setDate(nextWeekMonday.getDate() + daysUntilNextMonday)
    if (resolvedLocale === 'pt') {
      dateMapping.push(`  - "próxima semana" = segunda-feira ${nextWeekMonday.toISOString().split('T')[0]}`)
    } else {
      dateMapping.push(`  - "semaine prochaine" = lundi ${nextWeekMonday.toISOString().split('T')[0]}`)
    }

    // Résoudre les pages dynamiquement (ROLE_PAGES × locale × rôle) plutôt que
    // la liste figée de ROLE_CONFIGS — Fixy connaît ainsi les ~85 modules réels
    // du dashboard, filtrés par locale.
    const baseRoleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']
    const dynamicPages = getPagesForRoleAndLocale(userRole, resolvedLocale)
    const roleConfig = { ...baseRoleConfig, pages: dynamicPages }

    // Assembler le FixyPromptContext pour les nouvelles fonctions
    const promptCtx: FixyPromptContext = {
      role: userRole as FixyPromptContext['role'],
      cabinet: syndic_context.cabinet,
      immeubles: syndic_context.immeubles,
      artisans: syndic_context.artisans,
      missions: syndic_context.missions,
      alertes: syndic_context.alertes,
      echeances: syndic_context.echeances,
      documents: syndic_context.documents,
      stats: syndic_context.stats,
      coproprios_count: syndic_context.coproprios_count,
      user_name: syndic_context.user_name,
      date: today,
      dateISO: todayISO,
      dateMappingStr: dateMapping.join('\n'),
      roleConfig,
    }

    // Masquer les PII avant envoi à Groq (emails, téléphones, IBAN, adresses)
    const { sanitized: sanitizedCtx, tokenMap } = sanitizeContextForLLM(promptCtx)

    const systemPrompt = resolvedLocale === 'pt'
      ? buildFixySystemPromptPT(sanitizedCtx)
      : buildFixySystemPromptFR(sanitizedCtx)

    const historyMessages = limitedHistory
      .filter((m: { role?: string; content?: string }) => m.role && m.content)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: String(m.content).substring(0, 3000) }))

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ]

    // ── Boucle native Groq tool-calling (max 5 itérations) ──────────────────
    // Le LLM peut invoquer plusieurs tools en parallèle et chaîner les appels.
    // À chaque tour : on exécute tous les tool_calls, on réinjecte les résultats
    // comme messages role="tool", puis on rappelle Groq. La boucle s'arrête
    // dès que le LLM renvoie une réponse texte sans tool_calls (ou après 5 tours
    // pour éviter les boucles infinies).
    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const toolMessages: GroqMessageWithTools[] = messages.map((m) => ({
      role: m.role as GroqMessageWithTools['role'],
      content: typeof m.content === 'string' ? m.content : null,
    }))

    let response: string = ''
    let toolLoopError: unknown = null
    const MAX_TOOL_ITERATIONS = 5
    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        // L'appel Groq est tracé seulement sur la première itération pour
        // garder la trace Langfuse lisible — les itérations suivantes sont des
        // chaînages internes.
        const callFn = () => callGroqWithTools({
          messages: toolMessages,
          tools: FIXY_TOOLS,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 4000,
        })
        const groqData = iteration === 0
          ? await traceAgent(
              { agent_id: 'fixy', user_id: user.id, conversation_id: body.conversation_id, prompt: message },
              callFn,
            )
          : await callFn()

        const assistantMsg = groqData.message
        // Push le message assistant (avec ses tool_calls éventuels) avant
        // d'exécuter pour respecter le contrat OpenAI/Groq.
        toolMessages.push({
          role: 'assistant',
          content: assistantMsg.content,
          tool_calls: assistantMsg.tool_calls,
        })

        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          response = assistantMsg.content || (locale === 'pt' ? 'Não consegui gerar uma resposta. Tente novamente.' : 'Je n\'ai pas pu générer une réponse. Réessayez.')
          break
        }

        // Exécute tous les tool_calls de cette itération en parallèle
        const dispatchCtx = { cabinetId, userId: user.id, tokenMap }
        const toolResults = await Promise.all(
          assistantMsg.tool_calls.map(async (tc) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args parsé du LLM
            let parsedArgs: any = {}
            try {
              parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
            } catch {
              parsedArgs = {}
            }
            try {
              const result = await dispatchTool(tc.function.name, parsedArgs, dispatchCtx)
              return { tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(result).slice(0, 8000) }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              return { tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify({ error: msg }).slice(0, 2000) }
            }
          }),
        )

        // Réinjecte les résultats des tools comme messages role="tool"
        for (const r of toolResults) {
          toolMessages.push({
            role: 'tool',
            content: r.content,
            tool_call_id: r.tool_call_id,
            name: r.name,
          })
        }

        // Si on atteint la dernière itération sans réponse finale, force un
        // résumé sans tools pour éviter la boucle infinie.
        if (iteration === MAX_TOOL_ITERATIONS - 1) {
          const finalData = await callGroqWithRetry({
            messages: toolMessages.map((m) => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : '',
            })),
            temperature: 0.25,
            max_tokens: 2000,
          })
          response = finalData.choices?.[0]?.message?.content || (locale === 'pt' ? 'Resposta indisponível.' : 'Réponse indisponible.')
        }
      }
    } catch (err) {
      toolLoopError = err
      logger.error('Groq Fixy tool-loop error:', err)
    }

    if (toolLoopError || !response) {
      // Fallback canal classique (regex ##TOOL## hérité ou texte de secours)
      try {
        const fallbackData: GroqResponse = await callGroqWithRetry({
          messages,
          temperature: 0.25,
          max_tokens: 4000,
        })
        response = fallbackData.choices?.[0]?.message?.content || generateFallback(message, syndic_context, userRole, locale)
      } catch {
        return NextResponse.json({
          response: generateFallback(message, syndic_context, userRole, locale),
          fallback: true,
        })
      }
    }

    // Strip des balises ##TOOL## résiduelles (legacy regex pattern) — défensif :
    // depuis la migration vers native Groq tool-calling le LLM ne devrait plus
    // jamais en émettre, mais on garde la garde au cas où.
    response = response.replace(/##TOOL##[\s\S]*?##/g, '').trim()

    // Extraire l'action si présente
    let action: Record<string, unknown> | null = null
    const actionMatch = response.match(/##ACTION##([\s\S]*?)##/)
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1])
        response = response.replace(/##ACTION##[\s\S]*?##/g, '').trim()
        // Si le LLM n'a renvoyé que l'action sans texte, fournir un message par défaut
        if (!response && action) {
          const actionLabels: Record<string, string> = locale === 'pt' ? {
            create_mission: '📋 Missão preparada. Verifique os detalhes abaixo.',
            assign_mission: '📋 Missão atribuída preparada. Verifique os detalhes abaixo.',
            navigate: '🧭 A navegar...',
            create_alert: '🔔 Alerta preparado.',
            update_mission: '📝 Atualização de missão preparada.',
            send_message: '✉️ Mensagem preparada.',
            create_document: '📄 Documento preparado.',
            create_event: '📆 Evento preparado.',
            update_event: '📆 Atualização de evento preparada.',
            delete_event: '🗑️ Eliminação de evento preparada.',
            update_signalement: '📝 Atualização de ocorrência preparada.',
            create_facture_copro: '🧾 Fatura preparada.',
            update_facture_copro: '🧾 Atualização de fatura preparada.',
            create_appel_charges: '💰 Chamamento de quotas preparado.',
            update_impaye: '⚠️ Atualização de dívida preparada.',
            create_recouvrement: '⚖️ Procedimento de recobro preparado.',
          } : {
            create_mission: '📋 Mission préparée. Vérifiez les détails ci-dessous.',
            assign_mission: '📋 Mission assignée préparée. Vérifiez les détails ci-dessous.',
            navigate: '🧭 Navigation en cours...',
            create_alert: '🔔 Alerte préparée.',
            update_mission: '📝 Mise à jour de mission préparée.',
            send_message: '✉️ Message préparé.',
            create_document: '📄 Document préparé.',
            create_event: '📆 Rendez-vous préparé.',
            update_event: '📆 Mise à jour de rendez-vous préparée.',
            delete_event: '🗑️ Suppression de rendez-vous préparée.',
            update_signalement: '📝 Mise à jour de signalement préparée.',
            create_facture_copro: '🧾 Facture copro préparée.',
            update_facture_copro: '🧾 Mise à jour de facture préparée.',
            create_appel_charges: '💰 Appel de charges préparé.',
            update_impaye: '⚠️ Mise à jour d\'impayé préparée.',
            create_recouvrement: '⚖️ Procédure de recouvrement préparée.',
          }
          response = actionLabels[action.type as string] || (locale === 'pt' ? '✅ Ação preparada. Verifique os detalhes abaixo.' : '✅ Action préparée. Vérifiez les détails ci-dessous.')
        }
      } catch {
        // Ignore les actions malformées
      }
    }

    // Résoudre les tokens PII dans la réponse finale (au cas où Groq les répercuterait)
    response = resolveSanitizedToken(response, tokenMap) ?? response

    return NextResponse.json({ response, action, role: userRole })

  } catch (err: unknown) {
    logger.error('[fixy-syndic] Error:', err)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
