// lib/syndic/lea-context-loader.ts
// Hydrate le contexte comptable copropriété depuis la DB pour Léa.
// Résilient : safeQ/safeCount wrappent chaque query — jamais de crash si table absente.

import { resolveCabinetId } from '@/lib/auth-helpers'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface LeaContext {
  cabinet?: { id: string }
  immeubles: Array<{ id: string; nom: string; budget?: number; depenses?: number; nbLots?: number }>
  coproprios_count: number
  appels_charges: Array<{
    id: string
    immeuble?: string
    exercice: string
    montant_total: number
    montant_paye: number
    statut: string
    echeance?: string
  }>
  impayes: Array<{
    id: string
    coproprio?: string
    immeuble?: string
    montant: number
    nature: string
    depuis: string
    nb_relances: number
    statut: string
  }>
  factures: Array<{
    id: string
    numero_facture: string
    emise_le: string
    montant_ttc: number
    statut: string
    description?: string
  }>
  recouvrements: Array<{
    id: string
    procedure: string
    statut: string
    montant_initial: number
    montant_recouvre: number
    date_ouverture: string
  }>
  stats: {
    total_impayes: number
    montant_impayes_total: number
    impayes_critiques: number   // > 3 mois
    factures_a_regler: number
    recouvrements_en_cours: number
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase client polymorphe (generics lourds)
type AnyClient = SupabaseClient<any, any, any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQ<T>(p: any, fallback: T): Promise<T> {
  try {
    const res = await p
    if (res.error) return fallback
    return (res.data ?? fallback) as T
  } catch {
    return fallback
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(p: any): Promise<number> {
  try {
    const res = await p
    return res.count ?? 0
  } catch {
    return 0
  }
}

export async function loadLeaContext(client: AnyClient, user: User): Promise<LeaContext> {
  const cabinetId = await resolveCabinetId(user, client)

  if (!cabinetId) {
    return {
      cabinet: undefined,
      immeubles: [],
      coproprios_count: 0,
      appels_charges: [],
      impayes: [],
      factures: [],
      recouvrements: [],
      stats: {
        total_impayes: 0,
        montant_impayes_total: 0,
        impayes_critiques: 0,
        factures_a_regler: 0,
        recouvrements_en_cours: 0,
      },
    }
  }

  const [imm, coprosCount, appels, impayes, factures, recouvrements] = await Promise.all([
    safeQ<any[]>(
      client
        .from('syndic_immeubles')
        .select('id, nom, budget_annuel, depenses_annee, nb_lots')
        .eq('cabinet_id', cabinetId)
        .limit(30),
      [],
    ),
    safeCount(
      client
        .from('syndic_coproprios')
        .select('*', { count: 'exact', head: true })
        .eq('cabinet_id', cabinetId),
    ),
    safeQ<any[]>(
      client
        .from('syndic_appels_charges')
        .select('id, immeuble_id, exercice, montant_total, montant_paye, statut, echeance')
        .eq('cabinet_id', cabinetId)
        .order('echeance', { ascending: false, nullsFirst: false })
        .limit(50),
      [],
    ),
    safeQ<any[]>(
      client
        .from('syndic_impayes')
        .select('id, coproprio_id, immeuble_id, montant, nature, depuis, nb_relances, statut')
        .eq('cabinet_id', cabinetId)
        .neq('statut', 'solde')
        .order('depuis', { ascending: true })
        .limit(50),
      [],
    ),
    safeQ<any[]>(
      client
        .from('syndic_factures_copro')
        .select('id, numero_facture, emise_le, montant_ttc, statut, description')
        .eq('cabinet_id', cabinetId)
        .order('emise_le', { ascending: false })
        .limit(30),
      [],
    ),
    safeQ<any[]>(
      client
        .from('syndic_recouvrement')
        .select('id, procedure, statut, montant_initial, montant_recouvre, date_ouverture')
        .eq('cabinet_id', cabinetId)
        .order('date_ouverture', { ascending: false })
        .limit(20),
      [],
    ),
  ])

  const immeublesMap = new Map<string, string>(imm.map((i: any) => [i.id, i.nom]))

  const now = Date.now()
  const impayesEnriched = impayes.map((i: any) => ({
    id: i.id,
    coproprio: i.coproprio_id,
    immeuble: i.immeuble_id ? immeublesMap.get(i.immeuble_id) : undefined,
    montant: Number(i.montant),
    nature: i.nature,
    depuis: i.depuis,
    nb_relances: i.nb_relances ?? 0,
    statut: i.statut,
  }))

  const impayesCritiques = impayesEnriched.filter(i => {
    const days = (now - new Date(i.depuis).getTime()) / (1000 * 60 * 60 * 24)
    return days > 90  // > 3 mois
  }).length

  return {
    cabinet: { id: cabinetId },
    immeubles: imm.map((i: any) => ({
      id: i.id,
      nom: i.nom,
      budget: i.budget_annuel,
      depenses: i.depenses_annee,
      nbLots: i.nb_lots,
    })),
    coproprios_count: coprosCount,
    appels_charges: appels.map((a: any) => ({
      id: a.id,
      immeuble: a.immeuble_id ? immeublesMap.get(a.immeuble_id) : undefined,
      exercice: a.exercice,
      montant_total: Number(a.montant_total),
      montant_paye: Number(a.montant_paye),
      statut: a.statut,
      echeance: a.echeance,
    })),
    impayes: impayesEnriched,
    factures: factures.map((f: any) => ({
      id: f.id,
      numero_facture: f.numero_facture,
      emise_le: f.emise_le,
      montant_ttc: Number(f.montant_ttc),
      statut: f.statut,
      description: f.description,
    })),
    recouvrements: recouvrements.map((r: any) => ({
      id: r.id,
      procedure: r.procedure,
      statut: r.statut,
      montant_initial: Number(r.montant_initial),
      montant_recouvre: Number(r.montant_recouvre),
      date_ouverture: r.date_ouverture,
    })),
    stats: {
      total_impayes: impayesEnriched.length,
      montant_impayes_total: impayesEnriched.reduce((s, i) => s + i.montant, 0),
      impayes_critiques: impayesCritiques,
      factures_a_regler: factures.filter(
        (f: any) => f.statut === 'a_regler' || f.statut === 'partiellement_regle',
      ).length,
      recouvrements_en_cours: recouvrements.filter((r: any) => r.statut === 'en_cours').length,
    },
  }
}
