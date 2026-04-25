'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader, Brain, BarChart3, User, HardHat, Building2, Coins, Lightbulb, CircleAlert, AlertTriangle, Landmark, PlusCircle, Calendar, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import { useBTPSettings, type BTPSettings, type FraiFixe } from '@/lib/hooks/use-btp-data'
import { formatPrice } from '@/lib/utils'
import { calculateBossCost, calculateEmployeeCost } from '@/lib/payroll/engine'
import { getCompanyTypesByCountry, resolveCompanyType } from '@/lib/config/companyTypes'
import { calculateChantierProfitability, calculateGlobalProfitability } from '@/lib/services/profitability'
import { simulateTax } from '@/lib/services/tax-simulation'
import type { ChantierContext, ChantierCosts, ChantierProfitability, KPIAlert, WorkerDetail } from '@/lib/services/pipeline-types'

// ═══════════════════════════════════════════════════════════════════════════════
// COMPTA BTP INTELLIGENTE — Version complète
// Salaire patron, charges détaillées, frais fixes, situation fiscale,
// coût réel par homme/jour, perte par jour de retard, simulateur
// ═══════════════════════════════════════════════════════════════════════════════

interface RentaData {
  chantier_id: string; titre: string; client: string; budget: number
  date_debut: string; date_fin: string; statut: string
  marge_prevue_pct: number; tva_taux: number; montant_facture: number
  acompte_recu: number; penalite_retard_jour: number
  jours_prevu: number; total_heures: number; nb_ouvriers: number
  nb_jours_pointes: number
  cout_main_oeuvre_brut: number; cout_charges_patronales: number; cout_indemnites: number; cout_main_oeuvre_total: number
  total_materiaux: number; total_autres: number; total_depenses: number
  cout_total: number; ca_reel: number; benefice_net: number
  benefice_par_homme_jour: number; perte_par_jour_retard: number
  // Factures/devis liés (depuis v_rentabilite_chantier)
  montant_facture_ht_lie?: number; montant_devis_ht_lie?: number
  nb_factures_liees?: number; nb_devis_lies?: number
  total_frais_annexes_factures?: number; total_frais_annexes_devis?: number
  detail_ouvriers: WorkerDetail[]
}

function fmt(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtDec(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// STATUT_LABELS now derived from companyTypes config (handled dynamically below)
const TVA_LABELS: Record<string, string> = {
  reel_normal: 'Réel normal', reel_simplifie: 'Réel simplifié', franchise: 'Franchise de TVA', mini_reel: 'Mini-réel',
}

export function ComptaBTPSection({ artisan, orgRole }: { artisan: import('@/lib/types').Artisan; orgRole?: string }) {
  const isV5 = orgRole === 'pro_societe'
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dl = isPt ? 'pt-PT' : 'fr-FR'
  const { settings, save: saveSettings, loading: loadingS } = useBTPSettings()

  const [data, setData] = useState<RentaData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'dashboard' | 'profil' | 'equipe' | 'frais'>('dashboard')
  const [simDays, setSimDays] = useState(0)
  const [simWorkers, setSimWorkers] = useState(0)
  // Frais fixes form (JSONB legacy)
  const [newFrai, setNewFrai] = useState<FraiFixe>({ label: '', montant: 0, frequence: 'mensuel' })
  // Relational charges_fixes
  const [chargesFixes, setChargesFixes] = useState<Array<{ id: string; label: string; montant: number; frequence: string; categorie: string }>>([])
  const [newChargeCategorie, setNewChargeCategorie] = useState<string>('autre')
  const [newChargeFrequence, setNewChargeFrequence] = useState<string>('mensuel')
  const [newChargeLabel, setNewChargeLabel] = useState<string>('')
  const [newChargeMontant, setNewChargeMontant] = useState<number>(0)
  // Membres pour l'onglet équipe
  interface MembreCompta { id: string; prenom?: string; nom?: string; typeCompte?: string; type_compte?: string; type_contrat?: string; cout_horaire?: number; coutHoraire?: number; charges_pct?: number; chargesPct?: number; panier_repas_jour?: number; indemnite_trajet_jour?: number }
  const [membres, setMembres] = useState<MembreCompta[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const headers: Record<string, string> = {}
        if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
        const [rentaRes, membresRes, chargesRes] = await Promise.all([
          fetch('/api/btp?table=rentabilite', { headers }),
          fetch('/api/btp?table=membres', { headers }),
          fetch('/api/btp?table=charges_fixes', { headers }),
        ])
        if (rentaRes.ok) {
          const j = await rentaRes.json()
          setData(j.rentabilite || [])
        }
        if (membresRes.ok) {
          const j = await membresRes.json()
          setMembres(j.membres || [])
        }
        if (chargesRes.ok) {
          const j = await chargesRes.json()
          setChargesFixes(j.charges_fixes || [])
        }
      } catch { /* silent */ }
      setLoading(false)
    }
    load()
  }, [])

  const selected = useMemo(() => data.find(d => d.chantier_id === selectedId) || null, [data, selectedId])

  // ── Calculs globaux ───────────────────────────────────────────────────────
  const fraisFixes = useMemo(() => {
    const list = settings.frais_fixes_mensuels || []
    return list.reduce((s: number, f: FraiFixe) => s + (f.frequence === 'annuel' ? f.montant / 12 : f.montant), 0)
  }, [settings.frais_fixes_mensuels])

  const totalFixesMensuel = useMemo(() => {
    return chargesFixes.reduce((sum, c) => {
      if (c.frequence === 'mensuel') return sum + c.montant
      if (c.frequence === 'trimestriel') return sum + c.montant / 3
      if (c.frequence === 'annuel') return sum + c.montant / 12
      return sum
    }, 0)
  }, [chargesFixes])

  const salairePatronCharge = useMemo(() => {
    const base = settings.salaire_patron_mensuel || 0
    if (base <= 0) return 0
    const result = calculateBossCost({
      country: settings.country || 'FR',
      company_type: settings.company_type || settings.statut_juridique || 'sarl',
      salary: base,
      salary_type: settings.salaire_patron_type || 'net',
      override_charge_rate: settings.taux_cotisations_patron ? settings.taux_cotisations_patron / 100 : undefined,
    })
    return result.total_cost
  }, [settings])

  const coutFixeMensuel = fraisFixes + salairePatronCharge + (settings.amortissements_mensuels || 0)

  // ── Profitabilité par chantier (via service) ──
  const chantierProfits = useMemo(() => {
    const active = data.filter(d => d.statut === 'En cours' || d.statut === 'Terminé')
    return active.map(d => {
      const ctx: ChantierContext = {
        id: d.chantier_id, titre: d.titre, client: d.client, budget: d.budget,
        montant_facture: d.montant_facture, acompte_recu: d.acompte_recu,
        date_debut: d.date_debut, date_fin: d.date_fin, statut: d.statut,
        marge_prevue_pct: d.marge_prevue_pct, tva_taux: d.tva_taux,
        penalite_retard_jour: d.penalite_retard_jour,
      }
      const costs: ChantierCosts = {
        chantier_id: d.chantier_id, total_heures: d.total_heures,
        nb_ouvriers: d.nb_ouvriers, nb_jours_pointes: d.nb_jours_pointes,
        cout_main_oeuvre_brut: d.cout_main_oeuvre_brut, cout_charges_patronales: d.cout_charges_patronales,
        cout_indemnites: d.cout_indemnites, cout_main_oeuvre_total: d.cout_main_oeuvre_total,
        total_materiaux: d.total_materiaux, total_autres: d.total_autres,
        total_depenses: d.total_depenses, cout_total: d.cout_total,
        ca_reel: d.ca_reel, detail_ouvriers: d.detail_ouvriers || [],
      }
      return calculateChantierProfitability(ctx, costs)
    })
  }, [data])

  // ── Profitabilité globale (via service) ──
  const totals = useMemo(() => {
    const active = data.filter(d => d.statut === 'En cours' || d.statut === 'Terminé')
    const nbMois = Math.max(1, active.length > 0 ? new Set(active.map(d => (d.date_debut || '').slice(0, 7))).size : 1)

    const gp = calculateGlobalProfitability({
      chantiers: chantierProfits,
      frais_fixes_mensuel: fraisFixes,
      salaire_patron_charge: salairePatronCharge,
      amortissements: settings.amortissements_mensuels || 0,
      taux_is: (settings.taux_is || 25) / 100,
      nb_mois: nbMois,
    })

    // Simulation fiscale avec tranches (FR 15/25% — PT 17/21%)
    const country = (settings.country || 'FR') as 'FR' | 'PT'
    const tax = simulateTax({
      country,
      regime: country === 'FR' ? 'is' : 'irc',
      benefice_imposable: gp.benefice_brut,
      ca_total_ht: gp.total_ca,
      tva_taux: country === 'FR' ? 0.20 : 0.23,
      total_achats_ht: gp.total_cout_chantiers * 0.3, // ~30% matériaux = achats HT
      salaire_patron_net: settings.salaire_patron_mensuel || 0,
    })

    return {
      nbChantiers: gp.nb_chantiers,
      ca: gp.total_ca,
      cout: gp.total_cout_chantiers,
      fraisFixes: gp.frais_fixes_mensuel,
      benefBrut: gp.benefice_brut,
      benefNet: gp.benefice_brut,
      impots: tax.is_total,
      benefApresImpots: tax.benefice_apres_impots,
      marge: gp.marge_globale_pct,
      heures: active.reduce((s, d) => s + d.total_heures, 0),
      perteJour: active.reduce((s, d) => s + d.perte_par_jour_retard, 0),
      tauxEffectif: tax.taux_effectif,
      tvaAPayer: tax.tva_a_payer,
      irAlternative: tax.ir_alternative,
      recommendation: tax.recommendation,
    }
  }, [data, chantierProfits, fraisFixes, salairePatronCharge, settings])

  // ── Simulateur ────────────────────────────────────────────────────────────
  const simResult = useMemo(() => {
    if (!selected) return null
    const perteRetard = selected.perte_par_jour_retard * simDays
    const coutOuvrierSup = simWorkers * 8 * settings.cout_horaire_ouvrier * (1 + settings.charges_patronales_pct / 100)
    const coutOuvrierTotal = coutOuvrierSup * Math.max(1, selected.nb_jours_pointes || 1)
    const nouveauBenef = selected.benefice_net - perteRetard - coutOuvrierTotal
    return {
      perteRetard, coutOuvrierSup: coutOuvrierTotal, nouveauBenef,
      nouvelleMarge: selected.ca_reel > 0 ? (nouveauBenef / selected.ca_reel) * 100 : 0,
    }
  }, [selected, simDays, simWorkers, settings])

  // ── Score (utilise le service profitability) ──
  function getScore(d: RentaData) {
    const cp = chantierProfits.find(p => p.chantier_id === d.chantier_id)
    const score = cp?.score ?? 5
    const status = cp?.status ?? 'warning'
    if (status === 'profit') return { score, label: isPt ? 'Rentável' : 'Rentable', color: '#22C55E' }
    if (status === 'warning') return { score, label: isPt ? 'Médio' : 'Moyen', color: '#F59E0B' }
    return { score, label: isPt ? 'Em risco' : 'À risque', color: '#EF4444' }
  }

  // ── Handlers frais fixes ──────────────────────────────────────────────────
  const addFrai = () => {
    if (!newFrai.label || !newFrai.montant) return
    const updated = [...(settings.frais_fixes_mensuels || []), newFrai]
    saveSettings({ frais_fixes_mensuels: updated })
    setNewFrai({ label: '', montant: 0, frequence: 'mensuel' })
  }
  const removeFrai = (idx: number) => {
    const updated = (settings.frais_fixes_mensuels || []).filter((_: FraiFixe, i: number) => i !== idx)
    saveSettings({ frais_fixes_mensuels: updated })
  }

  const fetchChargesFixes = useCallback(async () => {
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
      const res = await fetch('/api/btp?table=charges_fixes', { headers })
      if (res.ok) {
        const j = await res.json()
        setChargesFixes(j.charges_fixes || [])
      }
    } catch { /* silent */ }
  }, [])

  const addChargeFix = async (label: string, montant: number, frequence: string, categorie: string) => {
    if (!label || !montant) return
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
      await fetch('/api/btp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ table: 'charges_fixes', action: 'insert', data: { label, montant, frequence, categorie } }),
      })
      await fetchChargesFixes()
    } catch { /* silent */ }
  }

  const removeChargeFix = async (id: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
      await fetch('/api/btp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ table: 'charges_fixes', action: 'delete', id }),
      })
      setChargesFixes(prev => prev.filter(c => c.id !== id))
    } catch { /* silent */ }
  }

  if (loading || loadingS) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 200 }}>
      <Loader size={24} className="animate-spin" />
      <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <h1>{isPt ? 'Contabilidade Inteligente BTP' : 'Compta Intelligente BTP'}</h1>
        <p>{isPt ? 'Vista contabilística especializada BTP' : 'Vue comptable spécialisée BTP'}</p>
      </div>

      {/* Navigation tabs */}
      <div className={isV5 ? "v5-tabs" : "v22-tabs"}>
        {([
          { k: 'dashboard', icon: <BarChart3 size={12} />, label: isPt ? 'Painel' : 'Tableau de bord' },
          { k: 'profil', icon: <User size={12} />, label: isPt ? 'Perfil fiscal' : 'Profil patron' },
          { k: 'equipe', icon: <HardHat size={12} />, label: isPt ? 'Custos equipa' : 'Coûts équipe' },
          { k: 'frais', icon: <Building2 size={12} />, label: isPt ? 'Encargos fixos' : 'Frais fixes' },
        ] as { k: 'dashboard' | 'profil' | 'equipe' | 'frais'; icon: React.ReactNode; label: string }[]).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={isV5 ? `v5-tab-b${tab === t.k ? ' active' : ''}` : `v22-tab ${tab === t.k ? 'active' : ''}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB: PROFIL PATRON ══════ */}
      {tab === 'profil' && (
        <div className={isV5 ? "v5-card" : "v22-card"} style={{ padding: 20 }}>
          <div className={isV5 ? "v5-st" : "v22-section-title"}><User size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'O meu perfil fiscal' : 'Mon profil fiscal'}</div>
          <div className={isV5 ? "v5-fr" : "v22-form-row"} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Salário mensal' : 'Salaire mensuel'} (&euro;)</label>
              <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={settings.salaire_patron_mensuel || ''}
                onChange={e => saveSettings({ salaire_patron_mensuel: Number(e.target.value) })}
                placeholder="3000" />
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Tipo de salário' : 'Type de salaire'}</label>
              <select className={isV5 ? "v5-fi" : "v22-input"} value={settings.salaire_patron_type}
                onChange={e => saveSettings({ salaire_patron_type: e.target.value as 'net' | 'brut' })}>
                <option value="net">Net</option>
                <option value="brut">Brut</option>
              </select>
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Cotizações patronais' : 'Cotisations patronales'} (%)</label>
              <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={settings.taux_cotisations_patron || ''}
                onChange={e => saveSettings({ taux_cotisations_patron: Number(e.target.value) })}
                placeholder="45" />
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'País' : 'Pays'}</label>
              <select className={isV5 ? "v5-fi" : "v22-input"} value={settings.country || 'FR'}
                onChange={e => {
                  const c = e.target.value as 'FR' | 'PT'
                  const defType = c === 'FR' ? 'sarl' : 'lda'
                  const config = resolveCompanyType(defType, c)
                  saveSettings({
                    country: c,
                    company_type: defType,
                    statut_juridique: defType,
                    taux_is: Math.round(config.default_taux_is * 100),
                    charges_patronales_pct: Math.round(config.employer_charge_rate * 100),
                  })
                }}>
                <option value="FR">France</option>
                <option value="PT">Portugal</option>
              </select>
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Tipo de empresa' : 'Type de société'}</label>
              <select className={isV5 ? "v5-fi" : "v22-input"} value={settings.company_type || settings.statut_juridique || 'sarl'}
                onChange={e => {
                  const ct = e.target.value
                  const config = resolveCompanyType(ct, (settings.country || 'FR') as 'FR' | 'PT')
                  saveSettings({
                    company_type: ct,
                    statut_juridique: ct,
                    taux_is: Math.round(config.default_taux_is * 100),
                    charges_patronales_pct: Math.round(config.employer_charge_rate * 100),
                    taux_cotisations_patron: Math.round(config.boss_charge_rate * 100),
                  })
                }}>
                {getCompanyTypesByCountry((settings.country || 'FR') as 'FR' | 'PT').map(ct => (
                  <option key={ct.key} value={ct.key}>{isPt ? ct.label_pt : ct.label_fr}</option>
                ))}
              </select>
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Regime de IVA' : 'Régime de TVA'}</label>
              <select className={isV5 ? "v5-fi" : "v22-input"} value={settings.regime_tva}
                onChange={e => saveSettings({ regime_tva: e.target.value })}>
                {Object.entries(TVA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Taxa IS' : 'Taux IS'} (%)</label>
              <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={settings.taux_is || ''}
                onChange={e => saveSettings({ taux_is: Number(e.target.value) })}
                placeholder="25" />
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Amortizações mensais' : 'Amortissements mensuels'} (&euro;)</label>
              <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={settings.amortissements_mensuels || ''}
                onChange={e => saveSettings({ amortissements_mensuels: Number(e.target.value) })}
                placeholder="500" />
            </div>
            <div className={isV5 ? "v5-fg" : "v22-form-group"}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Objetivo de margem' : 'Objectif de marge'} (%)</label>
              <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={settings.objectif_marge_pct || ''}
                onChange={e => saveSettings({ objectif_marge_pct: Number(e.target.value) })}
                placeholder="20" />
            </div>
          </div>

          {/* Récap coût patron */}
          <div className={isV5 ? "v5-kpi hl" : "v22-kpi v22-kpi-hl"} style={{ marginTop: 20, padding: 16 }}>
            <div className={isV5 ? "v5-st" : "v22-section-title"}><Coins size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Custo real mensal do patrão' : 'Coût réel mensuel du patron'}</div>
            <Row label={isPt ? 'Salário declarado' : 'Salaire déclaré'} value={`${fmt(settings.salaire_patron_mensuel || 0, dl)} € ${settings.salaire_patron_type}`} />
            <Row label={isPt ? 'Custo chargé (c/ cotizações)' : 'Coût chargé (cotisations incluses)'} value={`${fmt(salairePatronCharge, dl)} €`} color="#C62828" bold />
            <Row label={isPt ? 'Amortizações' : 'Amortissements'} value={`${fmt(settings.amortissements_mensuels || 0, dl)} €`} />
            <Row label={isPt ? 'Encargos fixos' : 'Frais fixes'} value={`${fmt(fraisFixes, dl)} €`} />
            <div style={{ borderTop: '2px solid #C9A84C', marginTop: 8, paddingTop: 8 }}>
              <Row label={isPt ? 'TOTAL por mês a cobrir' : 'TOTAL mensuel à couvrir'} value={`${fmt(coutFixeMensuel, dl)} €`} color="#C62828" bold />
              <Row label={isPt ? 'Por dia ouvré (22j)' : 'Par jour ouvré (22j)'} value={`${fmt(coutFixeMensuel / 22, dl)} €`} color="#EF6C00" />
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: COÛTS ÉQUIPE ══════ */}
      {tab === 'equipe' && (
        <div className={isV5 ? "v5-card" : "v22-card"}>
          <div className={isV5 ? "v5-st" : "v22-section-title"}><HardHat size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Custo real por funcionário' : 'Coût réel par employé'}</div>
          <div style={{ overflowX: 'auto' }}>
            <table className={isV5 ? "v5-dt" : "v22-table"}>
              <thead>
                <tr>
                  <th>{isPt ? 'Funcionário' : 'Employé'}</th>
                  <th>{isPt ? 'Tipo' : 'Type'}</th>
                  <th>{isPt ? 'Contrato' : 'Contrat'}</th>
                  <th>{isPt ? 'Custo/h' : 'Coût/h'}</th>
                  <th>{isPt ? 'Encargos' : 'Charges %'}</th>
                  <th>{isPt ? 'Cesta+Trajeto/j' : 'Panier+Trajet/j'}</th>
                  <th>{isPt ? 'Custo real/h' : 'Coût réel/h'}</th>
                  <th>{isPt ? 'Custo real/jour (8h)' : 'Coût réel/jour (8h)'}</th>
                </tr>
              </thead>
              <tbody>
                {membres.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                    {isPt ? 'Adicione funcionários em "Equipas"' : 'Ajoutez des employés dans "Équipes"'}
                  </td></tr>
                ) : membres.map((m: MembreCompta) => {
                  const ch = m.cout_horaire || m.coutHoraire || settings.cout_horaire_ouvrier
                  const cp = m.charges_pct || m.chargesPct || settings.charges_patronales_pct
                  const indemnJ = (m.panier_repas_jour || 0) + (m.indemnite_trajet_jour || 0)
                  const coutReelH = ch * (1 + cp / 100)
                  const coutReelJour = coutReelH * 8 + indemnJ
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.prenom} {m.nom}</td>
                      <td><span className={isV5 ? "v5-badge v5-badge-gray" : "v22-tag v22-tag-gray"}>{m.typeCompte || m.type_compte}</span></td>
                      <td>{m.type_contrat || 'CDI'}</td>
                      <td>{ch} &euro;</td>
                      <td>{cp}%</td>
                      <td>{indemnJ > 0 ? `${indemnJ} €` : '—'}</td>
                      <td style={{ fontWeight: 600, color: '#C62828' }}>{fmtDec(coutReelH, dl)} &euro;</td>
                      <td style={{ fontWeight: 600, color: '#C62828' }}>{fmt(coutReelJour, dl)} &euro;</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={isV5 ? "v5-al info" : "v22-alert v22-alert-blue"} style={{ marginTop: 12 }}>
            <Lightbulb size={12} />{isPt
              ? 'Edite o custo horário e encargos de cada membro em Equipas > Editar membro'
              : 'Modifiez le coût horaire et les charges de chaque membre dans Équipes > Modifier le membre'}
          </div>
        </div>
      )}

      {/* ══════ TAB: FRAIS FIXES ══════ */}
      {tab === 'frais' && (
        <div className={isV5 ? "v5-card" : "v22-card"}>
          <div className={isV5 ? "v5-st" : "v22-section-title"}><Building2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Encargos fixos mensais' : 'Frais fixes mensuels'}</div>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
            {isPt
              ? 'Tudo o que paga todos os meses independentemente dos chantiers: renda, seguro, contabilista, viaturas, etc.'
              : 'Tout ce que vous payez chaque mois quel que soit le nombre de chantiers : loyer, assurance, comptable, véhicules, etc.'}
          </p>

          {/* Alertes contextuelles */}
          {settings.country === 'FR' && !chargesFixes.some(c => c.categorie === 'decennale') && (
            <div className={isV5 ? "v5-al warn" : "v22-alert v22-alert-amber"} style={{ marginBottom: 12 }}>
              <AlertTriangle size={14} /> {"Tu n'as pas renseigné d'assurance décennale. C'est obligatoire en BTP."}
            </div>
          )}
          {settings.country === 'PT' && !chargesFixes.some(c => c.categorie === 'rc_pro') && (
            <div className={isV5 ? "v5-al warn" : "v22-alert v22-alert-amber"} style={{ marginBottom: 12 }}>
              <AlertTriangle size={14} /> {"Seguro de acidentes de trabalho não registado. É obrigatório na construção."}
            </div>
          )}

          {/* Groupes par catégorie */}
          {([
            { label: isPt ? 'Seguros' : 'Assurances', categories: ['decennale', 'rc_pro'] },
            { label: isPt ? 'Local & veículos' : 'Local & véhicule', categories: ['loyer', 'leasing', 'vehicule'] },
            { label: isPt ? 'Administrativo' : 'Administratif', categories: ['comptabilite', 'telephone', 'logiciel', 'formation'] },
            { label: isPt ? 'Outros' : 'Autres', categories: ['autre'] },
          ] as { label: string; categories: string[] }[]).map(group => {
            const items = chargesFixes.filter(c => group.categories.includes(c.categorie))
            if (items.length === 0) return null
            return (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{group.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E8E8E8' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{c.label}</span>
                        <span className={isV5 ? "v5-badge v5-badge-gray" : "v22-tag v22-tag-gray"} style={{ marginLeft: 8 }}>{c.categorie}</span>
                        <span className={isV5 ? "v5-badge v5-badge-gray" : "v22-tag v22-tag-gray"} style={{ marginLeft: 4 }}>{c.frequence}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: '#C62828', fontSize: 12 }}>
                          {formatPrice(c.montant, locale)}{c.frequence === 'annuel' ? isPt ? '/ano' : '/an' : c.frequence === 'trimestriel' ? isPt ? '/trim.' : '/trim.' : isPt ? '/mês' : '/mois'}
                        </span>
                        <button onClick={() => removeChargeFix(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C62828' }} aria-label={isPt ? 'Remover encargo' : 'Supprimer ce frais'}><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {chargesFixes.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 12, marginBottom: 16 }}>
              {isPt ? 'Nenhum encargo registado' : 'Aucun frais enregistré'}
            </div>
          )}

          {/* Formulaire ajout */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', borderTop: '1px solid #E8E8E8', paddingTop: 16 }}>
            <div style={{ flex: 2, minWidth: 140 }}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Descrição' : 'Libellé'}</label>
              <input className={isV5 ? "v5-fi" : "v22-input"} value={newChargeLabel}
                onChange={e => setNewChargeLabel(e.target.value)}
                placeholder={isPt ? 'ex: Seguro decenário' : 'ex: Assurance décennale'} />
            </div>
            <div style={{ flex: 1, minWidth: 90 }}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Montante' : 'Montant'} (&euro;)</label>
              <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={newChargeMontant || ''}
                onChange={e => setNewChargeMontant(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Frequência' : 'Fréquence'}</label>
              <select className={isV5 ? "v5-fi" : "v22-input"} value={newChargeFrequence}
                onChange={e => setNewChargeFrequence(e.target.value)}>
                <option value="mensuel">{isPt ? 'Mensal' : 'Mensuel'}</option>
                <option value="trimestriel">{isPt ? 'Trimestral' : 'Trimestriel'}</option>
                <option value="annuel">{isPt ? 'Anual' : 'Annuel'}</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Categoria' : 'Catégorie'}</label>
              <select className={isV5 ? "v5-fi" : "v22-input"} value={newChargeCategorie}
                onChange={e => setNewChargeCategorie(e.target.value)}>
                <option value="decennale">{isPt ? 'Seguro decenário' : 'Décennale'}</option>
                <option value="rc_pro">{isPt ? 'RC Profissional' : 'RC Pro'}</option>
                <option value="loyer">{isPt ? 'Renda' : 'Loyer'}</option>
                <option value="leasing">Leasing</option>
                <option value="vehicule">{isPt ? 'Veículo' : 'Véhicule'}</option>
                <option value="comptabilite">{isPt ? 'Contabilidade' : 'Comptabilité'}</option>
                <option value="telephone">{isPt ? 'Telefone' : 'Téléphone'}</option>
                <option value="logiciel">Logiciel</option>
                <option value="formation">{isPt ? 'Formação' : 'Formation'}</option>
                <option value="autre">{isPt ? 'Outro' : 'Autre'}</option>
              </select>
            </div>
            <button className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"}
              onClick={async () => {
                await addChargeFix(newChargeLabel, newChargeMontant, newChargeFrequence, newChargeCategorie)
                setNewChargeLabel('')
                setNewChargeMontant(0)
                setNewChargeFrequence('mensuel')
                setNewChargeCategorie('autre')
              }}
              disabled={!newChargeLabel || !newChargeMontant}>
              <PlusCircle size={14} />
            </button>
          </div>

          {/* Total mensuel */}
          <div className={isV5 ? "v5-kpi" : "v22-kpi"} style={{ marginTop: 16, padding: 12 }}>
            <Row label={isPt ? 'TOTAL mensal' : 'TOTAL mensuel'} value={`${formatPrice(totalFixesMensuel, locale)} / ${isPt ? 'mês' : 'mois'}`} color="#C62828" bold />
            <Row label={isPt ? 'Por dia ouvré (÷22)' : 'Par jour ouvré (÷22)'} value={`${formatPrice(totalFixesMensuel / 22, locale)} / ${isPt ? 'dia' : 'jour'}`} color="#EF6C00" />
          </div>
        </div>
      )}

      {/* ══════ TAB: DASHBOARD ══════ */}
      {tab === 'dashboard' && (
        <>
          {/* KPIs globaux */}
          <div className={isV5 ? "v5-kpi-g" : "v22-kpi-grid"}>
            <div className={isV5 ? "v5-kpi hl" : "v22-kpi v22-kpi-hl"}>
              <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>CA HT {isPt ? 'acumulado' : 'cumulé'}</div>
              <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"}>{fmt(totals.ca, dl)} &euro;</div>
              <div className={isV5 ? "v5-kpi-s" : "v22-kpi-sub"}>{totals.nbChantiers} {isPt ? 'obras' : 'chantiers'}</div>
            </div>
            <div className={isV5 ? "v5-kpi" : "v22-kpi"}>
              <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>{isPt ? 'Encargos subempreitada' : 'Charges sous-traitance'}</div>
              <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"}>{fmt(totals.cout, dl)} &euro;</div>
              <div className={isV5 ? "v5-kpi-s" : "v22-kpi-sub"}>{totals.ca > 0 ? `${Math.round(totals.cout / totals.ca * 100)}% du CA` : '—'}</div>
            </div>
            <div className={isV5 ? "v5-kpi" : "v22-kpi"}>
              <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>{isPt ? 'Margem bruta' : 'Marge brute'}</div>
              <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"}>{totals.marge.toFixed(1)}%</div>
              <div className={isV5 ? "v5-kpi-s" : "v22-kpi-sub"}>{isPt ? 'objetivo' : 'objectif'} {settings.objectif_marge_pct || 20}%</div>
            </div>
            <div className={isV5 ? "v5-kpi" : "v22-kpi"}>
              <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>{isPt ? 'Tesouraria' : 'Trésorerie'}</div>
              <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"}>{fmt(totals.benefApresImpots, dl)} &euro;</div>
              <div className={isV5 ? "v5-kpi-s" : "v22-kpi-sub"}>{isPt ? 'líquido' : 'net après impôts'}</div>
            </div>
          </div>

          {/* Alertes intelligentes */}
          {(() => {
            const alerts: KPIAlert[] = []
            if (totals.marge < (settings.objectif_marge_pct || 20) && totals.ca > 0) {
              alerts.push({ type: totals.marge < 0 ? 'error' : 'warning',
                message_fr: `Marge (${totals.marge.toFixed(1)}%) en dessous de l'objectif de ${settings.objectif_marge_pct || 20}%`,
                message_pt: `Margem (${totals.marge.toFixed(1)}%) abaixo do objetivo de ${settings.objectif_marge_pct || 20}%` })
            }
            const losses = chantierProfits.filter(c => c.status === 'loss')
            if (losses.length > 0) {
              alerts.push({ type: 'error',
                message_fr: `${losses.length} chantier(s) en perte`,
                message_pt: `${losses.length} obra(s) com prejuízo` })
            }
            const delays = chantierProfits.filter(c => c.retard_jours > 0)
            if (delays.length > 0) {
              const totalRetard = delays.reduce((s, c) => s + c.retard_jours, 0)
              alerts.push({ type: 'warning',
                message_fr: `${delays.length} chantier(s) en retard (${totalRetard}j cumulés)`,
                message_pt: `${delays.length} obra(s) com atraso (${totalRetard} dias acumulados)` })
            }
            if (totals.irAlternative !== undefined && totals.recommendation) {
              const rec = totals.recommendation
              if (rec === 'ir') alerts.push({ type: 'info',
                message_fr: `L'IR serait plus avantageux (${fmt(totals.irAlternative, dl)}€ vs IS ${fmt(totals.impots, dl)}€)`,
                message_pt: `O IRS seria mais vantajoso (${fmt(totals.irAlternative, dl)}€ vs IRC ${fmt(totals.impots, dl)}€)` })
              if (rec === 'is') alerts.push({ type: 'info',
                message_fr: `L'IS est le choix optimal (${fmt(totals.impots, dl)}€ vs IR ${fmt(totals.irAlternative, dl)}€)`,
                message_pt: `O IRC é a escolha ideal (${fmt(totals.impots, dl)}€ vs IRS ${fmt(totals.irAlternative, dl)}€)` })
            }
            if (alerts.length === 0) return null
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alerts.map((a, i) => (
                  <div key={i} className={isV5 ? `v5-al ${a.type === 'error' ? 'err' : a.type === 'warning' ? 'warn' : 'info'}` : `v22-alert ${a.type === 'error' ? 'v22-alert-red' : a.type === 'warning' ? 'v22-alert-amber' : 'v22-alert-blue'}`}>
                    {a.type === 'error' ? <CircleAlert size={14} /> : a.type === 'warning' ? <AlertTriangle size={14} /> : <Lightbulb size={14} />} {isPt ? a.message_pt : a.message_fr}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Détail fiscal */}
          {totals.ca > 0 && (
            <div className={isV5 ? "v5-kpi-g" : "v22-kpi-grid"} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <div className={isV5 ? "v5-kpi" : "v22-kpi"}>
                <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>{isPt ? 'Taux effectif' : 'Taux effectif'}</div>
                <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"} style={{ fontSize: 20 }}>{totals.tauxEffectif}%</div>
              </div>
              <div className={isV5 ? "v5-kpi" : "v22-kpi"}>
                <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>{isPt ? 'Imposto' : 'Impôts'}</div>
                <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"} style={{ fontSize: 20, color: '#C62828' }}>{fmt(totals.impots, dl)} &euro;</div>
              </div>
              <div className={isV5 ? "v5-kpi" : "v22-kpi"}>
                <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>TVA/IVA {isPt ? 'a pagar' : 'à payer'}</div>
                <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"} style={{ fontSize: 20, color: '#EF6C00' }}>{fmt(totals.tvaAPayer, dl)} &euro;</div>
              </div>
              <div className={isV5 ? "v5-kpi" : "v22-kpi"} style={{ background: totals.benefApresImpots >= 0 ? '#E8F5E9' : '#FFEBEE' }}>
                <div className={isV5 ? "v5-kpi-l" : "v22-kpi-label"}>{isPt ? 'Líquido após impostos' : 'Net après impôts'}</div>
                <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"} style={{ fontSize: 20, color: totals.benefApresImpots >= 0 ? '#2E7D32' : '#C62828' }}>{fmt(totals.benefApresImpots, dl)} &euro;</div>
              </div>
            </div>
          )}

          {/* Tableau ventilation chantiers */}
          {data.length === 0 ? (
            <div className={isV5 ? "v5-card" : "v22-card"} style={{ padding: 40, textAlign: 'center' }}>
              <Brain size={40} style={{ color: '#BBB', marginBottom: 12 }} />
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{isPt ? 'Sem dados' : 'Aucune donnée'}</div>
              <p style={{ fontSize: 12, color: '#999' }}>{isPt ? 'Crie obras e registe pontuagens' : 'Créez des chantiers et enregistrez des pointages'}</p>
            </div>
          ) : (
            <div className={isV5 ? "v5-card" : "v22-card"} style={{ overflow: 'auto' }}>
              <div className={isV5 ? "v5-st" : "v22-section-title"}>{isPt ? 'Ventilação por obra' : 'Ventilation par chantier'}</div>
              <table className={isV5 ? "v5-dt" : "v22-table"}>
                <thead>
                  <tr>
                    <th />
                    <th>{isPt ? 'Obra' : 'Chantier'}</th>
                    <th>CA</th>
                    <th>M.O.</th>
                    <th>{isPt ? 'Encarg.' : 'Charges'}</th>
                    <th>{isPt ? 'Indemn.' : 'Indemn.'}</th>
                    <th>{isPt ? 'Desp.' : 'Dép.'}</th>
                    <th>{isPt ? 'Lucro' : 'Bénéf.'}</th>
                    <th>Marge</th>
                    <th>&euro;/H/J</th>
                    <th>{isPt ? 'Perda/J' : 'Perte/J'}</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => {
                    const s = getScore(d)
                    const marge = d.ca_reel > 0 ? (d.benefice_net / d.ca_reel) * 100 : 0
                    const isSelected = d.chantier_id === selectedId
                    return (
                      <tr key={d.chantier_id} onClick={() => setSelectedId(isSelected ? null : d.chantier_id)}
                        style={{ cursor: 'pointer', background: isSelected ? 'var(--v5-highlight-yellow)' : undefined }}>
                        <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color }} /></td>
                        <td style={{ fontWeight: 600 }}>{d.titre}</td>
                        <td>{fmt(d.ca_reel || 0, dl)}</td>
                        <td style={{ color: '#C62828' }}>{fmt(d.cout_main_oeuvre_brut, dl)}</td>
                        <td style={{ color: '#EF6C00' }}>{fmt(d.cout_charges_patronales, dl)}</td>
                        <td style={{ color: '#999' }}>{fmt(d.cout_indemnites, dl)}</td>
                        <td style={{ color: '#EF6C00' }}>{fmt(d.total_depenses, dl)}</td>
                        <td style={{ fontWeight: 600, color: d.benefice_net >= 0 ? '#2E7D32' : '#C62828' }}>{fmt(d.benefice_net, dl)}</td>
                        <td style={{ fontWeight: 600, color: marge >= 15 ? '#2E7D32' : marge >= 0 ? '#EF6C00' : '#C62828' }}>{marge.toFixed(1)}%</td>
                        <td style={{ fontWeight: 600, color: d.benefice_par_homme_jour >= 0 ? '#2E7D32' : '#C62828' }}>{fmtDec(d.benefice_par_homme_jour, dl)}</td>
                        <td style={{ fontWeight: 600, color: '#C62828' }}>-{fmt(d.perte_par_jour_retard, dl)}</td>
                        <td><span style={{ fontWeight: 700, color: s.color }}>{s.score}/10</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Détail + Simulateur */}
          {selected && (
            <div className={isV5 ? "v5-sg2" : "v22-split-grid"}>
              <div className={isV5 ? "v5-card" : "v22-card"}>
                <div className={isV5 ? "v5-st" : "v22-section-title"}><BarChart3 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{selected.titre}</div>
                <Row label="CA" value={`${fmt(selected.ca_reel || 0, dl)} €`} />
                <Row label={isPt ? 'M.O. bruta' : 'M.O. brute'} value={`${fmt(selected.cout_main_oeuvre_brut, dl)} €`} color="#C62828" />
                <Row label={isPt ? 'Encargos patronais' : 'Charges patronales'} value={`${fmt(selected.cout_charges_patronales, dl)} €`} color="#EF6C00" />
                <Row label={isPt ? 'Indemnidades' : 'Indemnités'} value={`${fmt(selected.cout_indemnites, dl)} €`} color="#999" />
                <Row label={isPt ? 'Materiais' : 'Matériaux'} value={`${fmt(selected.total_materiaux, dl)} €`} color="#EF6C00" />
                <Row label={isPt ? 'Outras desp.' : 'Autres dép.'} value={`${fmt(selected.total_autres, dl)} €`} color="#666" />
                <div style={{ borderTop: '2px solid #E8E8E8', marginTop: 8, paddingTop: 8 }}>
                  <Row label={isPt ? 'LUCRO LÍQUIDO' : 'BÉNÉFICE NET'} value={`${fmt(selected.benefice_net, dl)} €`}
                    color={selected.benefice_net >= 0 ? '#2E7D32' : '#C62828'} bold />
                </div>
                <div className={isV5 ? "v5-kpi" : "v22-kpi"} style={{ marginTop: 12, textAlign: 'center', padding: 12 }}>
                  <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"} style={{ color: selected.benefice_par_homme_jour >= 0 ? '#2E7D32' : '#C62828' }}>
                    {fmtDec(selected.benefice_par_homme_jour, dl)} &euro;
                  </div>
                  <div className={isV5 ? "v5-kpi-s" : "v22-kpi-sub"}>/ {isPt ? 'homem' : 'homme'} / {isPt ? 'dia' : 'jour'}</div>
                </div>
                <div className={isV5 ? "v5-al err" : "v22-alert v22-alert-red"} style={{ marginTop: 8 }}>
                  <AlertTriangle size={14} />{isPt ? 'Perda por dia de atraso' : 'Perte par jour de retard'}: <strong>-{fmt(selected.perte_par_jour_retard, dl)} &euro;</strong>
                </div>
              </div>
              <div className={isV5 ? "v5-card" : "v22-card"}>
                <div className={isV5 ? "v5-st" : "v22-section-title"}><SlidersHorizontal size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Simulador' : 'Simulateur'}</div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Dias de atraso' : 'Jours de retard'}: <strong>{simDays}</strong></label>
                  <input type="range" min={0} max={60} value={simDays} onChange={e => setSimDays(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}><HardHat size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Funcionários extra' : 'Ouvriers en plus'}: <strong>+{simWorkers}</strong></label>
                  <input type="range" min={0} max={10} value={simWorkers} onChange={e => setSimWorkers(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                {simResult && (simDays > 0 || simWorkers > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {simDays > 0 && (
                      <div className={isV5 ? "v5-al err" : "v22-alert v22-alert-red"}>
                        {simDays}j retard = <strong>-{fmt(simResult.perteRetard, dl)} &euro;</strong>
                      </div>
                    )}
                    {simWorkers > 0 && (
                      <div className={isV5 ? "v5-al warn" : "v22-alert v22-alert-amber"}>
                        +{simWorkers} {isPt ? 'funcionários' : 'ouvriers'} = <strong>-{fmt(simResult.coutOuvrierSup, dl)} &euro;</strong>
                      </div>
                    )}
                    <div className={isV5 ? "v5-kpi" : "v22-kpi"} style={{ textAlign: 'center', background: simResult.nouveauBenef >= 0 ? '#E8F5E9' : '#FFEBEE', padding: 16 }}>
                      <div style={{ fontSize: 12 }}>{isPt ? 'Novo lucro' : 'Nouveau bénéfice'}</div>
                      <div className={isV5 ? "v5-kpi-v" : "v22-kpi-value"} style={{ color: simResult.nouveauBenef >= 0 ? '#2E7D32' : '#C62828' }}>
                        {fmt(simResult.nouveauBenef, dl)} &euro;
                      </div>
                      <div className={isV5 ? "v5-kpi-s" : "v22-kpi-sub"}>Marge: {simResult.nouvelleMarge.toFixed(1)}%</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Chat box */}
          {data.length > 0 && (
            <div className={isV5 ? "v5-card" : "v22-card"} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FAFAFA', borderBottom: '1px solid #E8E8E8' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--v5-primary-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  <Brain size={14} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>Léa BTP</div>
                  <div style={{ fontSize: 10, color: '#999' }}>{isPt ? 'Agente IA Contabilidade' : 'Agent IA Comptabilité'}</div>
                </div>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {totals.cout / totals.ca > 0.3 && totals.ca > 0 && (
                  <div style={{ background: '#E3F2FD', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1565C0' }}>
                    {isPt
                      ? `A subempreitada representa ${Math.round(totals.cout / totals.ca * 100)}% do CA.`
                      : `Votre sous-traitance représente ${Math.round(totals.cout / totals.ca * 100)}% du CA — pensez à l'autoliquidation TVA.`}
                  </div>
                )}
                {chantierProfits.filter(c => c.status === 'loss').length > 0 && (
                  <div style={{ background: '#FFEBEE', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#C62828' }}>
                    {isPt
                      ? `${chantierProfits.filter(c => c.status === 'loss').length} obra(s) em prejuízo. Reveja os custos.`
                      : `${chantierProfits.filter(c => c.status === 'loss').length} chantier(s) en perte. Revoyez les coûts.`}
                  </div>
                )}
                {totals.marge < (settings.objectif_marge_pct || 20) && totals.ca > 0 && (
                  <div style={{ background: '#FFF3E0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#EF6C00' }}>
                    {isPt
                      ? `Margem (${totals.marge.toFixed(1)}%) abaixo do objetivo. Controle os custos dos materiais.`
                      : `Marge (${totals.marge.toFixed(1)}%) en dessous de l'objectif. Surveillez les coûts matériaux.`}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 600, color: color || '#1a1a1a' }}>{value}</span>
    </div>
  )
}
