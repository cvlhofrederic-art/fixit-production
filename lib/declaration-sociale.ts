// ══════════════════════════════════════════════════════════════════════════════
// lib/declaration-sociale.ts — Calcul cotisations sociales FR + PT
// Taux officiels 2026 (URSSAF / Segurança Social)
// ══════════════════════════════════════════════════════════════════════════════

// ── TAUX OFFICIELS FRANCE — URSSAF 2026 ──────────────────────────────────────

export const TAUX_URSSAF_2026: Record<string, {
  taux_cotisations: number
  taux_cfp: number
  taux_total: number
  plafond_ca_annuel: number
  label: string
  label_court: string
}> = {
  bic_ventes: {
    taux_cotisations: 0.121,
    taux_cfp: 0.001,
    taux_total: 0.122,
    plafond_ca_annuel: 203100,
    label: 'Vente de marchandises (BIC)',
    label_court: 'BIC Ventes',
  },
  bic_services: {
    taux_cotisations: 0.241,
    taux_cfp: 0.003,
    taux_total: 0.244,
    plafond_ca_annuel: 83600,
    label: 'Prestations de services artisanales (BIC)',
    label_court: 'BIC Services',
  },
  bnc_general: {
    taux_cotisations: 0.256,
    taux_cfp: 0.002,
    taux_total: 0.258,
    plafond_ca_annuel: 83600,
    label: 'Activité libérale (BNC régime général)',
    label_court: 'BNC Général',
  },
  bnc_cipav: {
    taux_cotisations: 0.232,
    taux_cfp: 0.002,
    taux_total: 0.234,
    plafond_ca_annuel: 83600,
    label: 'Profession libérale CIPAV',
    label_court: 'BNC CIPAV',
  },
}

// ── TAUX OFFICIELS PORTUGAL — SEGURANÇA SOCIAL 2026 ──────────────────────────

export const TAUX_SS_PORTUGAL_2026: Record<string, {
  taux_contributif: number
  base_incidence: number
  minimum_mensuel: number
  label: string
  label_court: string
}> = {
  prestadores_servicos: {
    taux_contributif: 0.214,
    base_incidence: 0.70,
    minimum_mensuel: 20,
    label: 'Prestação de serviços',
    label_court: 'Prestador',
  },
  producao_venda_bens: {
    taux_contributif: 0.214,
    base_incidence: 0.20,
    minimum_mensuel: 20,
    label: 'Produção e venda de bens',
    label_court: 'Produção',
  },
  empresarios_nome_individual: {
    taux_contributif: 0.252,
    base_incidence: 0.70,
    minimum_mensuel: 20,
    label: 'Empresário em nome individual',
    label_court: 'ENI',
  },
}

// ── URLs DÉCLARATION ─────────────────────────────────────────────────────────

export const URL_DECLARATION_FR = 'https://www.autoentrepreneur.urssaf.fr/portail/accueil/declarer-et-payer.html'
export const URL_DECLARATION_PT = 'https://www.seg-social.pt/declaracoes-trimestrais'

// ── PÉRIODES ──────────────────────────────────────────────────────────────────

export interface PeriodeDeclaration {
  label: string
  date_debut: Date
  date_fin: Date
  date_limite: Date
  periode_type: 'mois' | 'trimestre'
  est_en_retard: boolean
  jours_restants: number
}

export function getPeriodeActuelle(
  pays: 'FR' | 'PT',
  periodicite: 'mensuelle' | 'trimestrielle',
  dateRef: Date = new Date()
): PeriodeDeclaration {
  let debut: Date
  let fin: Date
  let dateLimite: Date
  let label: string
  let periodeType: 'mois' | 'trimestre'

  if (pays === 'FR' && periodicite === 'mensuelle') {
    // Mois précédent
    debut = new Date(dateRef.getFullYear(), dateRef.getMonth() - 1, 1)
    fin = new Date(dateRef.getFullYear(), dateRef.getMonth(), 0)
    dateLimite = new Date(dateRef.getFullYear(), dateRef.getMonth() + 1, 0)
    label = debut.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    periodeType = 'mois'
  } else {
    // Trimestriel FR ou PT — trimestre précédent
    const mois = dateRef.getMonth()
    let qStartMonth: number
    let year = dateRef.getFullYear()

    if (mois < 3) { qStartMonth = 9; year -= 1 }
    else if (mois < 6) { qStartMonth = 0 }
    else if (mois < 9) { qStartMonth = 3 }
    else { qStartMonth = 6 }

    debut = new Date(year, qStartMonth, 1)
    fin = new Date(year, qStartMonth + 3, 0)

    // Date limite
    if (pays === 'PT') {
      // PT: dernier jour de jan/avr/jul/oct
      const limitMonth = [0, 3, 6, 9]
      const qIndex = Math.floor(qStartMonth / 3)
      const nextLimitMonth = limitMonth[(qIndex + 1) % 4]
      const nextLimitYear = qIndex === 3 ? year + 1 : (qStartMonth === 9 ? year + 1 : year + (mois < 3 ? 0 : 0))
      dateLimite = new Date(mois < 3 ? year + 1 : dateRef.getFullYear(), nextLimitMonth + 1, 0)
    } else {
      // FR: fin du mois suivant la fin du trimestre
      dateLimite = new Date(year, qStartMonth + 4, 0)
    }

    const qNum = Math.floor(qStartMonth / 3) + 1
    label = `T${qNum} ${year}`
    periodeType = 'trimestre'
  }

  const joursRestants = Math.ceil((dateLimite.getTime() - dateRef.getTime()) / 86400000)

  return {
    label,
    date_debut: debut,
    date_fin: fin,
    date_limite: dateLimite,
    periode_type: periodeType,
    est_en_retard: joursRestants < 0,
    jours_restants: joursRestants,
  }
}

// ── CALCUL COTISATIONS ───────────────────────────────────────────────────────

export interface ResultatCotisations {
  ca_base: number
  taux_label: string
  taux_total: number
  cotisations_estimees: number
  detail: string
  disclaimer: string
}

export function calculerCotisations(
  ca_periode: number,
  pays: 'FR' | 'PT',
  type_activite: string,
  options: { acre_actif?: boolean; periode_type?: 'mois' | 'trimestre' } = {}
): ResultatCotisations {
  if (pays === 'FR') {
    const config = TAUX_URSSAF_2026[type_activite] || TAUX_URSSAF_2026.bic_services
    let taux = config.taux_total

    if (options.acre_actif) {
      taux = taux * 0.5
    }

    const cotisations = Math.round(ca_periode * taux * 100) / 100

    return {
      ca_base: ca_periode,
      taux_label: options.acre_actif
        ? `${(taux * 100).toFixed(1)}% (ACRE -50%)`
        : `${(config.taux_total * 100).toFixed(1)}% (${config.label_court})`,
      taux_total: taux,
      cotisations_estimees: cotisations,
      detail: `${(taux * 100).toFixed(1)}% sur ${formaterEuro(ca_periode)} de CA`,
      disclaimer: 'Estimation basée sur vos factures VITFIX. Seul le CA encaissé est déclarable à l\'URSSAF. Vérifiez toujours le montant sur le site officiel.',
    }
  }

  // Portugal
  const config = TAUX_SS_PORTUGAL_2026[type_activite] || TAUX_SS_PORTUGAL_2026.prestadores_servicos
  const rendimentoRelevante = ca_periode * config.base_incidence
  const rendimentoMensal = options.periode_type === 'trimestre'
    ? rendimentoRelevante / 3
    : rendimentoRelevante

  let cotisationMensuelle = rendimentoMensal * config.taux_contributif
  cotisationMensuelle = Math.max(cotisationMensuelle, config.minimum_mensuel)

  const cotisations = options.periode_type === 'trimestre'
    ? Math.round(cotisationMensuelle * 3 * 100) / 100
    : Math.round(cotisationMensuelle * 100) / 100

  return {
    ca_base: ca_periode,
    taux_label: `${(config.taux_contributif * 100).toFixed(1)}% × ${(config.base_incidence * 100).toFixed(0)}% (${config.label_court})`,
    taux_total: config.taux_contributif,
    cotisations_estimees: cotisations,
    detail: `${formaterEuro(ca_periode)} × ${(config.base_incidence * 100).toFixed(0)}% (rend. relevante) × ${(config.taux_contributif * 100).toFixed(1)}%`,
    disclaimer: 'Estimativa baseada nas suas faturas VITFIX. A Segurança Social calcula com base na declaração trimestral.',
  }
}

// ── CA FACTURES ──────────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase-server'

export async function getCAFactures(
  artisanId: string,
  dateDebut: Date,
  dateFin: Date,
  pays: 'FR' | 'PT'
): Promise<{ montant: number; nb_factures: number }> {
  const debutStr = dateDebut.toISOString().split('T')[0]
  const finStr = dateFin.toISOString().split('T')[0]

  if (pays === 'FR') {
    // FR : CA encaissé = factures payées dans la période
    const { data } = await supabaseAdmin
      .from('factures')
      .select('total_ht_cents')
      .eq('artisan_id', artisanId)
      .eq('status', 'paid')
      .gte('paid_at', debutStr)
      .lte('paid_at', finStr + 'T23:59:59')

    const montant = (data || []).reduce((s: number, f: any) => s + (f.total_ht_cents || 0), 0) / 100
    return { montant, nb_factures: (data || []).length }
  }

  // PT : CA émis = factures émises dans la période (quel que soit le paiement)
  const { data } = await supabaseAdmin
    .from('factures')
    .select('total_ht_cents')
    .eq('artisan_id', artisanId)
    .gte('created_at', debutStr)
    .lte('created_at', finStr + 'T23:59:59')

  const montant = (data || []).reduce((s: number, f: any) => s + (f.total_ht_cents || 0), 0) / 100
  return { montant, nb_factures: (data || []).length }
}

// Fallback : CA depuis les bookings (si pas de factures)
export async function getCABookings(
  artisanId: string,
  dateDebut: Date,
  dateFin: Date
): Promise<{ montant: number; nb_bookings: number }> {
  const debutStr = dateDebut.toISOString().split('T')[0]
  const finStr = dateFin.toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('bookings')
    .select('price_ttc')
    .eq('artisan_id', artisanId)
    .eq('status', 'completed')
    .gte('booking_date', debutStr)
    .lte('booking_date', finStr)

  const montant = (data || []).reduce((s: number, b: any) => s + (b.price_ttc || 0), 0)
  return { montant, nb_bookings: (data || []).length }
}

// ── UTILITAIRE ───────────────────────────────────────────────────────────────

function formaterEuro(montant: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(montant)
}

// ── TYPES DE CONFIG ──────────────────────────────────────────────────────────

export const TYPES_ACTIVITE_FR = [
  { key: 'bic_services', label: 'Artisan / Prestataire de services (BIC)', recommended: true },
  { key: 'bic_ventes', label: 'Vente de marchandises (BIC)', recommended: false },
  { key: 'bnc_general', label: 'Activité libérale (BNC)', recommended: false },
  { key: 'bnc_cipav', label: 'Profession libérale CIPAV', recommended: false },
]

export const TYPES_ACTIVITE_PT = [
  { key: 'prestadores_servicos', label: 'Prestador de serviços', recommended: true },
  { key: 'producao_venda_bens', label: 'Produção e venda de bens', recommended: false },
  { key: 'empresarios_nome_individual', label: 'Empresário em nome individual', recommended: false },
]
