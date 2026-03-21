// ══════════════════════════════════════════════════════════════════════════════
// lib/stats-resume.ts — Résumé d'activité artisan en une passe
// Requêtes Supabase parallèles pour alimenter les phrases en langage naturel
// ══════════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase-server'

export interface ResumeActivite {
  mois_en_cours: {
    label: string
    revenus_encaisses: number
    chantiers_termines: number
    devis_envoyes: number
    devis_acceptes: number
    taux_conversion: number | null
    nouveaux_clients: number
  }
  alertes: {
    devis_en_attente: number
    devis_en_attente_montant: number
    factures_impayees: number
    factures_impayees_montant: number
    chantiers_sans_facture: number
  }
  records: {
    meilleur_mois_annee: { mois_label: string; revenus: number } | null
    total_annee_en_cours: number
  }
  comparaison: {
    vs_mois_precedent: number | null
    vs_mois_precedent_montant: number | null
  }
  agenda: {
    chantiers_cette_semaine: number
    prochain_chantier_dans_jours: number | null
  }
  calcule_le: string
  artisan_id: string
}

function startOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function endOfMonth(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

export async function getResumeActivite(
  artisanId: string,
  periode: 'mois_en_cours' | 'mois_precedent' | 'annee_en_cours' = 'mois_en_cours'
): Promise<ResumeActivite> {
  const now = new Date()

  // Calculer les bornes selon la période
  let debutPeriode: string
  let finPeriode: string
  let moisLabel: string

  if (periode === 'mois_precedent') {
    const mp = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    debutPeriode = startOfMonth(mp)
    finPeriode = endOfMonth(mp)
    moisLabel = mp.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  } else if (periode === 'annee_en_cours') {
    debutPeriode = `${now.getFullYear()}-01-01`
    finPeriode = toDateStr(now)
    moisLabel = `année ${now.getFullYear()}`
  } else {
    debutPeriode = startOfMonth(now)
    finPeriode = toDateStr(now)
    moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  // Bornes pour les comparaisons
  const debutMoisCourant = startOfMonth(now)
  const debutMoisPrec = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const finMoisPrec = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const debutAnnee = `${now.getFullYear()}-01-01`

  const il7jours = toDateStr(new Date(now.getTime() - 7 * 86400000))
  const il3jours = toDateStr(new Date(now.getTime() - 3 * 86400000))

  const lundi = getMondayOfWeek(now)
  const dimanche = new Date(lundi.getTime() + 6 * 86400000)
  const lundiStr = toDateStr(lundi)
  const dimancheStr = toDateStr(dimanche)

  // Toutes les requêtes en parallèle
  const [
    revenusPeriode,
    chantiersPeriode,
    devisPeriode,
    clientsPeriode,
    devisEnAttente,
    facturesImpayees,
    chantiersSansFacture,
    revenusMoisCourant,
    revenusMoisPrec,
    revenusAnnee,
    bookingsMoisParMois,
    chantiersSemaine,
    prochainChantier,
  ] = await Promise.all([
    // Revenus période sélectionnée (bookings completed)
    supabaseAdmin
      .from('bookings')
      .select('price_ttc')
      .eq('artisan_id', artisanId)
      .eq('status', 'completed')
      .gte('booking_date', debutPeriode)
      .lte('booking_date', finPeriode),

    // Chantiers terminés période
    supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('artisan_id', artisanId)
      .eq('status', 'completed')
      .gte('booking_date', debutPeriode)
      .lte('booking_date', finPeriode),

    // Devis période (safe — table peut être vide)
    Promise.resolve(
      supabaseAdmin
        .from('devis')
        .select('id, status, total_ttc_cents')
        .eq('artisan_id', artisanId)
        .gte('created_at', debutPeriode)
        .lte('created_at', finPeriode + 'T23:59:59')
    ).catch(() => ({ data: null, error: null, count: null })),

    // Nouveaux clients (bookings avec client_id unique cette période)
    supabaseAdmin
      .from('bookings')
      .select('client_id')
      .eq('artisan_id', artisanId)
      .not('client_id', 'is', null)
      .gte('created_at', debutPeriode)
      .lte('created_at', finPeriode + 'T23:59:59'),

    // Devis en attente > 7 jours
    Promise.resolve(
      supabaseAdmin
        .from('devis')
        .select('id, total_ttc_cents')
        .eq('artisan_id', artisanId)
        .eq('status', 'sent')
        .lte('created_at', il7jours + 'T23:59:59')
    ).catch(() => ({ data: null, error: null })),

    // Factures impayées (statut != paid)
    Promise.resolve(
      supabaseAdmin
        .from('factures')
        .select('id, total_ttc_cents')
        .eq('artisan_id', artisanId)
        .neq('status', 'paid')
        .neq('status', 'cancelled')
    ).catch(() => ({ data: null, error: null })),

    // Chantiers terminés sans facture depuis > 3 jours
    // Pas de RPC — on compte côté app
    supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('artisan_id', artisanId)
      .eq('status', 'completed')
      .lte('booking_date', il3jours),

    // Revenus mois courant (pour comparaison)
    supabaseAdmin
      .from('bookings')
      .select('price_ttc')
      .eq('artisan_id', artisanId)
      .eq('status', 'completed')
      .gte('booking_date', debutMoisCourant)
      .lte('booking_date', toDateStr(now)),

    // Revenus mois précédent
    supabaseAdmin
      .from('bookings')
      .select('price_ttc')
      .eq('artisan_id', artisanId)
      .eq('status', 'completed')
      .gte('booking_date', debutMoisPrec)
      .lte('booking_date', finMoisPrec),

    // Revenus année en cours
    supabaseAdmin
      .from('bookings')
      .select('price_ttc')
      .eq('artisan_id', artisanId)
      .eq('status', 'completed')
      .gte('booking_date', debutAnnee),

    // Bookings par mois (pour trouver le meilleur mois)
    supabaseAdmin
      .from('bookings')
      .select('booking_date, price_ttc')
      .eq('artisan_id', artisanId)
      .eq('status', 'completed')
      .gte('booking_date', debutAnnee),

    // Chantiers cette semaine
    supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('artisan_id', artisanId)
      .in('status', ['confirmed', 'pending'])
      .gte('booking_date', lundiStr)
      .lte('booking_date', dimancheStr),

    // Prochain chantier
    supabaseAdmin
      .from('bookings')
      .select('booking_date')
      .eq('artisan_id', artisanId)
      .in('status', ['confirmed', 'pending'])
      .gte('booking_date', toDateStr(now))
      .order('booking_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // Calculer les totaux
  const sumPriceTtc = (rows: { price_ttc: number }[] | null) =>
    (rows || []).reduce((s, r) => s + (r.price_ttc || 0), 0)

  const totalRevenusPeriode = sumPriceTtc(revenusPeriode.data)
  const totalRevenusMoisCourant = sumPriceTtc(revenusMoisCourant.data)
  const totalRevenusMoisPrec = sumPriceTtc(revenusMoisPrec.data)
  const totalRevenusAnnee = sumPriceTtc(revenusAnnee.data)

  // Devis stats
  const devisData = devisPeriode.data || []
  const devisEnvoyes = devisData.length
  const devisAcceptes = devisData.filter((d: any) => d.status === 'accepted' || d.status === 'signed').length
  const tauxConversion = devisEnvoyes > 0 ? Math.round((devisAcceptes / devisEnvoyes) * 100) : null

  // Clients uniques
  const clientIds = new Set((clientsPeriode.data || []).map(b => b.client_id).filter(Boolean))
  const nouveauxClients = clientIds.size

  // Alertes devis
  const devisAttenteData = devisEnAttente.data || []
  const devisAttenteMontant = devisAttenteData.reduce((s: number, d: any) => s + (d.total_ttc_cents || 0), 0) / 100

  // Alertes factures
  const facturesData = facturesImpayees.data || []
  const facturesImpayeesMontant = facturesData.reduce((s: number, f: any) => s + (f.total_ttc_cents || 0), 0) / 100

  // Chantiers sans facture (bookings completed > 3 jours)
  const nbChantiersSansFacture = chantiersSansFacture.count ?? 0

  // Meilleur mois
  const parMois: Record<string, number> = {}
  for (const b of (bookingsMoisParMois.data || [])) {
    const moisKey = (b.booking_date as string).substring(0, 7)
    parMois[moisKey] = (parMois[moisKey] || 0) + (b.price_ttc || 0)
  }
  let meilleurMois: { mois_label: string; revenus: number } | null = null
  for (const [key, rev] of Object.entries(parMois)) {
    if (!meilleurMois || rev > meilleurMois.revenus) {
      const [y, m] = key.split('-')
      const d = new Date(parseInt(y), parseInt(m) - 1, 1)
      meilleurMois = {
        mois_label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        revenus: rev,
      }
    }
  }

  // Comparaison vs mois précédent
  const vsMontant = totalRevenusMoisPrec > 0 ? totalRevenusMoisCourant - totalRevenusMoisPrec : null
  const vsPct = totalRevenusMoisPrec > 0
    ? Math.round(((totalRevenusMoisCourant - totalRevenusMoisPrec) / totalRevenusMoisPrec) * 100)
    : null

  // Prochain chantier
  let joursProchain: number | null = null
  if (prochainChantier.data?.booking_date) {
    const dateProchain = new Date(prochainChantier.data.booking_date + 'T12:00:00')
    joursProchain = Math.ceil((dateProchain.getTime() - now.getTime()) / 86400000)
    if (joursProchain < 0) joursProchain = 0
  }

  return {
    mois_en_cours: {
      label: moisLabel,
      revenus_encaisses: totalRevenusPeriode,
      chantiers_termines: chantiersPeriode.count || 0,
      devis_envoyes: devisEnvoyes,
      devis_acceptes: devisAcceptes,
      taux_conversion: tauxConversion,
      nouveaux_clients: nouveauxClients,
    },
    alertes: {
      devis_en_attente: devisAttenteData.length,
      devis_en_attente_montant: devisAttenteMontant,
      factures_impayees: facturesData.length,
      factures_impayees_montant: facturesImpayeesMontant,
      chantiers_sans_facture: nbChantiersSansFacture,
    },
    records: {
      meilleur_mois_annee: meilleurMois,
      total_annee_en_cours: totalRevenusAnnee,
    },
    comparaison: {
      vs_mois_precedent: vsPct,
      vs_mois_precedent_montant: vsMontant,
    },
    agenda: {
      chantiers_cette_semaine: chantiersSemaine.count || 0,
      prochain_chantier_dans_jours: joursProchain,
    },
    calcule_le: now.toISOString(),
    artisan_id: artisanId,
  }
}
