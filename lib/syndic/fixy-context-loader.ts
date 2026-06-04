// lib/syndic/fixy-context-loader.ts
// Hydrate le contexte cabinet du user depuis la DB pour injection dans les prompts Fixy.
// Résilient : chaque query wrap dans un .catch() — jamais de crash si table absente.

import { resolveCabinetId } from '@/lib/auth-helpers'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FixyContext {
  cabinet?: { id: string; nom?: string }
  immeubles: Array<{ id: string; nom: string; ville?: string; nbLots?: number; budget?: number; depenses?: number }>
  artisans: Array<{ id: string; nom?: string; metier?: string; statut?: string; rcProValide?: boolean; rcProExpiration?: string; vitfixCertifie?: boolean; email?: string }>
  missions: Array<{ id: string; immeuble?: string; type?: string; description?: string; priorite?: string; statut?: string; date_intervention?: string; montant_devis?: number }>
  alertes: Array<{ id: string; titre?: string; severity?: string; created_at?: string }>
  signalements: Array<{ id: string; titre?: string; statut?: string; priorite?: string; immeuble?: string }>
  echeances: Array<{ id: string; immeuble?: string; label?: string; date?: string }>
  documents: Array<{ id: string; nom?: string; type?: string; immeuble?: string; created_at?: string }>
  stats: { totalBudget: number; totalDepenses: number; missionsUrgentes: number; coproprios_count: number; artisansRcExpiree: number }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe (generics lourds)
type AnyClient = SupabaseClient<any, any, any>

export async function loadFixyContext(client: AnyClient, user: User): Promise<FixyContext> {
  const cabinetId = await resolveCabinetId(user, client)

  if (!cabinetId) {
    return {
      cabinet: undefined,
      immeubles: [], artisans: [], missions: [], signalements: [],
      alertes: [], echeances: [], documents: [],
      stats: { totalBudget: 0, totalDepenses: 0, missionsUrgentes: 0, coproprios_count: 0, artisansRcExpiree: 0 },
    }
  }

  // Queries en parallèle — wrapper try/catch pour être résilients aux tables manquantes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase builder non compatible avec Promise<T> générique
  const safeQ = async (q: any): Promise<{ data: any[] }> => {
    try {
      const res = await q
      return { data: Array.isArray(res.data) ? res.data : [] }
    } catch {
      return { data: [] }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
  const safeCount = async (q: any): Promise<{ count: number }> => {
    try {
      const res = await q
      return { count: (res.count as number | null | undefined) ?? 0 }
    } catch {
      return { count: 0 }
    }
  }

  const [immRes, artisansRes, missionsRes, sigRes, notifsRes, coprosCountRes] = await Promise.all([
    safeQ(
      client
        .from('syndic_immeubles')
        .select('id, nom, ville, nb_lots, budget_annuel, depenses_annee')
        .eq('cabinet_id', cabinetId)
        .limit(50)
    ),
    safeQ(
      client
        .from('syndic_artisans')
        .select('id, nom, metier, statut, rc_pro_valide, rc_pro_expiration, vitfix_certifie, email')
        .eq('cabinet_id', cabinetId)
        .limit(50)
    ),
    safeQ(
      client
        .from('syndic_missions')
        .select('id, immeuble, type, description, priorite, statut, date_intervention, montant_devis')
        .eq('cabinet_id', cabinetId)
        .order('created_at', { ascending: false })
        .limit(30)
    ),
    safeQ(
      client
        .from('syndic_signalements')
        .select('id, type_intervention, statut, priorite, immeuble_nom')
        .eq('cabinet_id', cabinetId)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    // Utilise syndic_notifications comme source d'alertes (syndic_alertes peut ne pas exister encore)
    safeQ(
      client
        .from('syndic_notifications')
        .select('id, type, message, created_at')
        .eq('cabinet_id', cabinetId)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    safeCount(
      client
        .from('syndic_coproprios')
        .select('*', { count: 'exact', head: true })
        .eq('cabinet_id', cabinetId)
    ),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- données dynamiques Supabase
  const immeubles = ((immRes.data ?? []) as any[]).map((i) => ({
    id: i.id,
    nom: i.nom,
    ville: i.ville,
    nbLots: i.nb_lots,
    budget: i.budget_annuel,
    depenses: i.depenses_annee,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- données dynamiques Supabase
  const artisans = ((artisansRes.data ?? []) as any[]).map((a) => ({
    id: a.id,
    nom: a.nom,
    metier: a.metier,
    statut: a.statut,
    rcProValide: a.rc_pro_valide,
    rcProExpiration: a.rc_pro_expiration,
    vitfixCertifie: a.vitfix_certifie,
    email: a.email,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- données dynamiques Supabase
  const missions = ((missionsRes.data ?? []) as any[]).map((m) => ({
    id: m.id,
    immeuble: m.immeuble,
    type: m.type,
    description: m.description,
    priorite: m.priorite,
    statut: m.statut,
    date_intervention: m.date_intervention,
    montant_devis: m.montant_devis,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- données dynamiques Supabase
  const signalements = ((sigRes.data ?? []) as any[]).map((s) => ({
    id: s.id,
    titre: s.type_intervention,
    statut: s.statut,
    priorite: s.priorite,
    immeuble: s.immeuble_nom,
  }))

  // Alertes depuis syndic_notifications (fallback jusqu'à ce que syndic_alertes soit créée)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- données dynamiques Supabase
  const alertes = ((notifsRes.data ?? []) as any[]).map((n) => ({
    id: n.id,
    titre: (n.message as string | undefined)?.slice(0, 80) ?? n.type,
    severity: n.type,
    created_at: n.created_at,
  }))

  const totalBudget = immeubles.reduce((s, i) => s + (i.budget ?? 0), 0)
  const totalDepenses = immeubles.reduce((s, i) => s + (i.depenses ?? 0), 0)
  const missionsUrgentes = missions.filter(m => m.priorite === 'urgente' || m.priorite === 'haute').length
  const artisansRcExpiree = artisans.filter(a => a.rcProValide === false).length
  const coprosCount = coprosCountRes.count ?? 0

  return {
    cabinet: { id: cabinetId },
    immeubles,
    artisans,
    missions,
    signalements,
    alertes,
    echeances: [], // Table syndic_echeances non encore créée
    documents: [], // Table syndic_documents non encore créée
    stats: {
      totalBudget,
      totalDepenses,
      missionsUrgentes,
      coproprios_count: coprosCount,
      artisansRcExpiree,
    },
  }
}
