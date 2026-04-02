'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader, Brain, BarChart3, User, HardHat, Building2, Coins, Lightbulb, CircleAlert, AlertTriangle, Landmark, PlusCircle, Calendar, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import { useBTPSettings, type BTPSettings, type FraiFixe } from '@/lib/hooks/use-btp-data'
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
  detail_ouvriers: WorkerDetail[]
}

function fmt(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtDec(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// STATUT_LABELS now derived from companyTypes config (handled dynamically below)
const TVA_LABELS: Record<string, string> = {
  reel_normal: 'Réel normal', reel_simplifie: 'Réel simplifié', franchise: 'Franchise de TVA', mini_reel: 'Mini-réel',
}

export function ComptaBTPSection({ artisan }: { artisan: import('@/lib/types').Artisan }) {
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
  // Frais fixes form
  const [newFrai, setNewFrai] = useState<FraiFixe>({ label: '', montant: 0, frequence: 'mensuel' })
  // Membres pour l'onglet équipe
  interface MembreCompta { id: string; prenom?: string; nom?: string; typeCompte?: string; type_compte?: string; type_contrat?: string; cout_horaire?: number; coutHoraire?: number; charges_pct?: number; chargesPct?: number; panier_repas_jour?: number; indemnite_trajet_jour?: number }
  const [membres, setMembres] = useState<MembreCompta[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const headers: Record<string, string> = {}
        if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
        const [rentaRes, membresRes] = await Promise.all([
          fetch('/api/btp?table=rentabilite', { headers }),
          fetch('/api/btp?table=membres', { headers }),
        ])
        if (rentaRes.ok) {
          const j = await rentaRes.json()
          setData(j.rentabilite || [])
        }
        if (membresRes.ok) {
          const j = await membresRes.json()
          setMembres(j.membres || [])
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

  if (loading || loadingS) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 24 }}><Loader size={24} className="animate-spin" /></div>
      <p className="v22-card-meta">{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + Tabs */}
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title"><Brain size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Contabilidade Inteligente' : 'Compta Intelligente'}</h2>
          <p className="v22-page-sub">{isPt ? 'Tudo num só lugar: salário, encargos, lucro real' : 'Tout en un : salaire, charges, bénéfice réel'}</p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {([
          { k: 'dashboard', icon: <BarChart3 size={14} />, label: isPt ? 'Painel' : 'Tableau de bord' },
          { k: 'profil', icon: <User size={14} />, label: isPt ? 'Perfil fiscal' : 'Profil patron' },
          { k: 'equipe', icon: <HardHat size={14} />, label: isPt ? 'Custos equipa' : 'Coûts équipe' },
          { k: 'frais', icon: <Building2 size={14} />, label: isPt ? 'Encargos fixos' : 'Frais fixes' },
        ] as { k: 'dashboard' | 'profil' | 'equipe' | 'frais'; icon: React.ReactNode; label: string }[]).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`v22-tab${tab === t.k ? ' active' : ''}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB: PROFIL PATRON ══════ */}
      {tab === 'profil' && (
        <div className="v22-card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}><User size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'O meu perfil fiscal' : 'Mon profil fiscal'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <label className="v22-form-label">{isPt ? 'Salário mensal' : 'Salaire mensuel'} (€)</label>
              <input type="number" className="v22-form-input" value={settings.salaire_patron_mensuel || ''}
                onChange={e => saveSettings({ salaire_patron_mensuel: Number(e.target.value) })}
                placeholder="3000" />
            </div>
            <div>
              <label className="v22-form-label">{isPt ? 'Tipo de salário' : 'Type de salaire'}</label>
              <select className="v22-form-input" value={settings.salaire_patron_type}
                onChange={e => saveSettings({ salaire_patron_type: e.target.value as 'net' | 'brut' })}>
                <option value="net">Net</option>
                <option value="brut">Brut</option>
              </select>
            </div>
            <div>
              <label className="v22-form-label">{isPt ? 'Cotizações patronais' : 'Cotisations patronales'} (%)</label>
              <input type="number" className="v22-form-input" value={settings.taux_cotisations_patron || ''}
                onChange={e => saveSettings({ taux_cotisations_patron: Number(e.target.value) })}
                placeholder="45" />
            </div>
            <div>
              <label className="v22-form-label">{isPt ? 'País' : 'Pays'}</label>
              <select className="v22-form-input" value={settings.country || 'FR'}
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
            <div>
              <label className="v22-form-label">{isPt ? 'Tipo de empresa' : 'Type de société'}</label>
              <select className="v22-form-input" value={settings.company_type || settings.statut_juridique || 'sarl'}
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
            <div>
              <label className="v22-form-label">{isPt ? 'Regime de IVA' : 'Régime de TVA'}</label>
              <select className="v22-form-input" value={settings.regime_tva}
                onChange={e => saveSettings({ regime_tva: e.target.value })}>
                {Object.entries(TVA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="v22-form-label">{isPt ? 'Taxa IS' : 'Taux IS'} (%)</label>
              <input type="number" className="v22-form-input" value={settings.taux_is || ''}
                onChange={e => saveSettings({ taux_is: Number(e.target.value) })}
                placeholder="25" />
            </div>
            <div>
              <label className="v22-form-label">{isPt ? 'Amortizações mensais' : 'Amortissements mensuels'} (€)</label>
              <input type="number" className="v22-form-input" value={settings.amortissements_mensuels || ''}
                onChange={e => saveSettings({ amortissements_mensuels: Number(e.target.value) })}
                placeholder="500" />
            </div>
            <div>
              <label className="v22-form-label">{isPt ? 'Objetivo de margem' : 'Objectif de marge'} (%)</label>
              <input type="number" className="v22-form-input" value={settings.objectif_marge_pct || ''}
                onChange={e => saveSettings({ objectif_marge_pct: Number(e.target.value) })}
                placeholder="20" />
            </div>
          </div>

          {/* Récap coût patron */}
          <div style={{ marginTop: 20, background: '#FEF5E4', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}><Coins size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Custo real mensal do patrão' : 'Coût réel mensuel du patron'}</div>
            <Row label={isPt ? 'Salário declarado' : 'Salaire déclaré'} value={`${fmt(settings.salaire_patron_mensuel || 0, dl)} € ${settings.salaire_patron_type}`} />
            <Row label={isPt ? 'Custo chargé (c/ cotizações)' : 'Coût chargé (cotisations incluses)'} value={`${fmt(salairePatronCharge, dl)} €`} color="#EF4444" bold />
            <Row label={isPt ? 'Amortizações' : 'Amortissements'} value={`${fmt(settings.amortissements_mensuels || 0, dl)} €`} />
            <Row label={isPt ? 'Encargos fixos' : 'Frais fixes'} value={`${fmt(fraisFixes, dl)} €`} />
            <div style={{ borderTop: '2px solid #C9A84C', marginTop: 8, paddingTop: 8 }}>
              <Row label={isPt ? 'TOTAL por mês a cobrir' : 'TOTAL mensuel à couvrir'} value={`${fmt(coutFixeMensuel, dl)} €`} color="#EF4444" bold />
              <Row label={isPt ? 'Por dia ouvré (22j)' : 'Par jour ouvré (22j)'} value={`${fmt(coutFixeMensuel / 22, dl)} €`} color="#F59E0B" />
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: COÛTS ÉQUIPE ══════ */}
      {tab === 'equipe' && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title"><HardHat size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Custo real por funcionário' : 'Coût réel par employé'}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--v22-border)' }}>
                  {[isPt ? 'Funcionário' : 'Employé', isPt ? 'Tipo' : 'Type', isPt ? 'Contrato' : 'Contrat',
                    isPt ? 'Custo/h' : 'Coût/h', isPt ? 'Encargos' : 'Charges %',
                    isPt ? 'Cesta+Trajeto/j' : 'Panier+Trajet/j',
                    isPt ? 'Custo real/h' : 'Coût réel/h', isPt ? 'Custo real/jour (8h)' : 'Coût réel/jour (8h)'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {membres.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--v22-text-mid)' }}>
                    {isPt ? 'Adicione funcionários em "Equipas"' : 'Ajoutez des employés dans "Équipes"'}
                  </td></tr>
                ) : membres.map((m: MembreCompta) => {
                  const ch = m.cout_horaire || m.coutHoraire || settings.cout_horaire_ouvrier
                  const cp = m.charges_pct || m.chargesPct || settings.charges_patronales_pct
                  const indemnJ = (m.panier_repas_jour || 0) + (m.indemnite_trajet_jour || 0)
                  const coutReelH = ch * (1 + cp / 100)
                  const coutReelJour = coutReelH * 8 + indemnJ
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{m.prenom} {m.nom}</td>
                      <td style={{ padding: '8px 10px' }}><span className="v22-tag v22-tag-gray" style={{ fontSize: 10 }}>{m.typeCompte || m.type_compte}</span></td>
                      <td style={{ padding: '8px 10px', fontSize: 12 }}>{m.type_contrat || 'CDI'}</td>
                      <td style={{ padding: '8px 10px' }}>{ch} €</td>
                      <td style={{ padding: '8px 10px' }}>{cp}%</td>
                      <td style={{ padding: '8px 10px' }}>{indemnJ > 0 ? `${indemnJ} €` : '—'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#EF4444' }}>{fmtDec(coutReelH, dl)} €</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#EF4444' }}>{fmt(coutReelJour, dl)} €</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 16, background: 'var(--v22-bg)', borderTop: '1px solid var(--v22-border)', fontSize: 12, color: '#6B7280' }}>
            <Lightbulb size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt
              ? 'Edite o custo horário e encargos de cada membro em Equipas > Editar membro'
              : 'Modifiez le coût horaire et les charges de chaque membre dans Équipes > Modifier le membre'}
          </div>
        </div>
      )}

      {/* ══════ TAB: FRAIS FIXES ══════ */}
      {tab === 'frais' && (
        <div className="v22-card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}><Building2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Encargos fixos mensais' : 'Frais fixes mensuels'}</h3>
          <p className="v22-card-meta" style={{ marginBottom: 16 }}>
            {isPt
              ? 'Tudo o que paga todos os meses independentemente dos chantiers: renda, seguro, contabilista, viaturas, etc.'
              : 'Tout ce que vous payez chaque mois quel que soit le nombre de chantiers : loyer, assurance, comptable, véhicules, etc.'}
          </p>

          {/* Liste frais existants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {(settings.frais_fixes_mensuels || []).map((f: FraiFixe, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--v22-bg)', borderRadius: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</span>
                  <span className="v22-tag v22-tag-gray" style={{ fontSize: 10, marginLeft: 8 }}>{f.frequence}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#EF4444' }}>{fmt(f.montant, dl)} €{f.frequence === 'annuel' ? '/an' : '/mois'}</span>
                  <button onClick={() => removeFrai(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A' }} aria-label="Supprimer ce frais"><X size={14} /></button>
                </div>
              </div>
            ))}
            {(settings.frais_fixes_mensuels || []).length === 0 && (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <p className="v22-card-meta">{isPt ? 'Nenhum encargo registado' : 'Aucun frais enregistré'}</p>
              </div>
            )}
          </div>

          {/* Formulaire ajout */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <label className="v22-form-label">{isPt ? 'Descrição' : 'Libellé'}</label>
              <input className="v22-form-input" value={newFrai.label} onChange={e => setNewFrai({ ...newFrai, label: e.target.value })}
                placeholder={isPt ? 'ex: Renda do escritório' : 'ex: Loyer bureau'} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="v22-form-label">{isPt ? 'Montante' : 'Montant'} (€)</label>
              <input type="number" className="v22-form-input" value={newFrai.montant || ''} onChange={e => setNewFrai({ ...newFrai, montant: Number(e.target.value) })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="v22-form-label">{isPt ? 'Frequência' : 'Fréquence'}</label>
              <select className="v22-form-input" value={newFrai.frequence} onChange={e => setNewFrai({ ...newFrai, frequence: e.target.value as any })}>
                <option value="mensuel">{isPt ? 'Mensal' : 'Mensuel'}</option>
                <option value="annuel">{isPt ? 'Anual' : 'Annuel'}</option>
              </select>
            </div>
            <button className="v22-btn" onClick={addFrai} disabled={!newFrai.label || !newFrai.montant}><PlusCircle size={14} /></button>
          </div>

          {/* Total */}
          <div style={{ marginTop: 16, background: '#FEF2F2', borderRadius: 8, padding: 12 }}>
            <Row label={isPt ? 'Total encargos fixos mensais' : 'Total frais fixes mensuels'} value={`${fmt(fraisFixes, dl)} € / ${isPt ? 'mês' : 'mois'}`} color="#EF4444" bold />
            <Row label={isPt ? 'Por dia ouvré' : 'Par jour ouvré'} value={`${fmt(fraisFixes / 22, dl)} € / ${isPt ? 'dia' : 'jour'}`} color="#F59E0B" />
          </div>
        </div>
      )}

      {/* ══════ TAB: DASHBOARD ══════ */}
      {tab === 'dashboard' && (
        <>
          {/* KPIs globaux avec frais fixes intégrés */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { label: isPt ? 'Obras' : 'Chantiers', value: String(totals.nbChantiers), color: '#0D1B2E' },
              { label: 'CA', value: `${fmt(totals.ca, dl)} €`, color: '#0D1B2E' },
              { label: isPt ? 'Custos obra' : 'Coûts chantier', value: `${fmt(totals.cout, dl)} €`, color: '#EF4444' },
              { label: isPt ? 'Encargos fixos' : 'Frais fixes', value: `${fmt(totals.fraisFixes, dl)} €`, color: '#F59E0B' },
              { label: isPt ? 'Lucro bruto' : 'Bénéf. brut', value: `${fmt(totals.benefBrut, dl)} €`, color: totals.benefBrut >= 0 ? '#22C55E' : '#EF4444' },
              { label: `${(settings.country || 'FR') === 'FR' ? 'IS' : 'IRC'} (${totals.tauxEffectif}%)`, value: `-${fmt(totals.impots, dl)} €`, color: '#6B7280' },
              { label: isPt ? 'LUCRO LÍQUIDO' : 'BÉNÉF. NET', value: `${fmt(totals.benefApresImpots, dl)} €`, color: totals.benefApresImpots >= 0 ? '#22C55E' : '#EF4444' },
              { label: 'Marge', value: `${totals.marge.toFixed(1)}%`, color: totals.marge >= (settings.objectif_marge_pct || 20) ? '#22C55E' : totals.marge >= 0 ? '#F59E0B' : '#EF4444' },
            ].map((kpi, i) => (
              <div key={i} className="v22-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                <div className="v22-card-meta" style={{ fontSize: 10, marginBottom: 2 }}>{kpi.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
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
                  <div key={i} style={{
                    background: a.type === 'error' ? '#FEF2F2' : a.type === 'warning' ? '#FEF3C7' : '#EFF6FF',
                    borderRadius: 8, padding: 12, fontSize: 13,
                    color: a.type === 'error' ? '#991B1B' : a.type === 'warning' ? '#92400E' : '#1E40AF',
                  }}>
                    {a.type === 'error' ? <CircleAlert size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> : a.type === 'warning' ? <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> : <Lightbulb size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />} {isPt ? a.message_pt : a.message_fr}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Détail fiscal (IS/IRC avec tranches) */}
          {totals.ca > 0 && (
            <div className="v22-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                <Landmark size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Detalhe fiscal' : 'Détail fiscal'} ({(settings.country || 'FR') === 'FR' ? 'IS' : 'IRC'})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--v22-bg)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--v22-text-mid)' }}>{isPt ? 'Taux effectif' : 'Taux effectif'}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{totals.tauxEffectif}%</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--v22-bg)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--v22-text-mid)' }}>{isPt ? 'Imposto' : 'Impôts'}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444' }}>{fmt(totals.impots, dl)} €</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--v22-bg)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--v22-text-mid)' }}>TVA/IVA {isPt ? 'a pagar' : 'à payer'}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>{fmt(totals.tvaAPayer, dl)} €</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: totals.benefApresImpots >= 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--v22-text-mid)' }}>{isPt ? 'Líquido após impostos' : 'Net après impôts'}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: totals.benefApresImpots >= 0 ? '#22C55E' : '#EF4444' }}>{fmt(totals.benefApresImpots, dl)} €</div>
                </div>
              </div>
            </div>
          )}

          {/* Tableau chantiers */}
          {data.length === 0 ? (
            <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}><Brain size={48} /></div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Sem dados' : 'Aucune donnée'}</div>
              <p className="v22-card-meta">{isPt ? 'Crie obras e registe pontuagens' : 'Créez des chantiers et enregistrez des pointages'}</p>
            </div>
          ) : (
            <div className="v22-card">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--v22-border)' }}>
                      {['', isPt ? 'Obra' : 'Chantier', 'CA', 'M.O.', isPt ? 'Encarg.' : 'Charges', isPt ? 'Indemn.' : 'Indemn.',
                        isPt ? 'Desp.' : 'Dép.', isPt ? 'Lucro' : 'Bénéf.', 'Marge',
                        `€/${isPt ? 'H' : 'H'}/${isPt ? 'J' : 'J'}`, isPt ? 'Perda/J' : 'Perte/J', 'Score'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 8px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(d => {
                      const s = getScore(d)
                      const marge = d.ca_reel > 0 ? (d.benefice_net / d.ca_reel) * 100 : 0
                      const isSelected = d.chantier_id === selectedId
                      return (
                        <tr key={d.chantier_id} onClick={() => setSelectedId(isSelected ? null : d.chantier_id)}
                          style={{ borderBottom: '1px solid var(--v22-border)', cursor: 'pointer', background: isSelected ? '#FEF5E4' : undefined }}>
                          <td style={{ padding: '8px 4px' }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color }} /></td>
                          <td style={{ padding: '8px 8px', fontWeight: 600, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titre}</td>
                          <td style={{ padding: '8px 8px' }}>{fmt(d.ca_reel || 0, dl)}</td>
                          <td style={{ padding: '8px 8px', color: '#EF4444' }}>{fmt(d.cout_main_oeuvre_brut, dl)}</td>
                          <td style={{ padding: '8px 8px', color: '#E97451' }}>{fmt(d.cout_charges_patronales, dl)}</td>
                          <td style={{ padding: '8px 8px', color: '#9CA3AF' }}>{fmt(d.cout_indemnites, dl)}</td>
                          <td style={{ padding: '8px 8px', color: '#F59E0B' }}>{fmt(d.total_depenses, dl)}</td>
                          <td style={{ padding: '8px 8px', fontWeight: 700, color: d.benefice_net >= 0 ? '#22C55E' : '#EF4444' }}>{fmt(d.benefice_net, dl)}</td>
                          <td style={{ padding: '8px 8px', fontWeight: 600, color: marge >= 15 ? '#22C55E' : marge >= 0 ? '#F59E0B' : '#EF4444' }}>{marge.toFixed(1)}%</td>
                          <td style={{ padding: '8px 8px', fontWeight: 700, color: d.benefice_par_homme_jour >= 0 ? '#22C55E' : '#EF4444' }}>{fmtDec(d.benefice_par_homme_jour, dl)}</td>
                          <td style={{ padding: '8px 8px', fontWeight: 600, color: '#EF4444' }}>-{fmt(d.perte_par_jour_retard, dl)}</td>
                          <td style={{ padding: '8px 8px' }}><span style={{ fontWeight: 700, color: s.color }}>{s.score}/10</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Détail + Simulateur */}
          {selected && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="v22-card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}><BarChart3 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{selected.titre}</h3>
                <Row label="CA" value={`${fmt(selected.ca_reel || 0, dl)} €`} />
                <Row label={isPt ? 'M.O. bruta' : 'M.O. brute'} value={`${fmt(selected.cout_main_oeuvre_brut, dl)} €`} color="#EF4444" />
                <Row label={isPt ? 'Encargos patronais' : 'Charges patronales'} value={`${fmt(selected.cout_charges_patronales, dl)} €`} color="#E97451" />
                <Row label={isPt ? 'Indemnidades' : 'Indemnités'} value={`${fmt(selected.cout_indemnites, dl)} €`} color="#9CA3AF" />
                <Row label={isPt ? 'Materiais' : 'Matériaux'} value={`${fmt(selected.total_materiaux, dl)} €`} color="#F59E0B" />
                <Row label={isPt ? 'Outras desp.' : 'Autres dép.'} value={`${fmt(selected.total_autres, dl)} €`} color="#6B7280" />
                <div style={{ borderTop: '2px solid var(--v22-border)', marginTop: 8, paddingTop: 8 }}>
                  <Row label={isPt ? 'LUCRO LÍQUIDO' : 'BÉNÉFICE NET'} value={`${fmt(selected.benefice_net, dl)} €`}
                    color={selected.benefice_net >= 0 ? '#22C55E' : '#EF4444'} bold />
                </div>
                <div style={{ background: '#F0FDF4', borderRadius: 8, padding: 12, marginTop: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: selected.benefice_par_homme_jour >= 0 ? '#22C55E' : '#EF4444' }}>
                    {fmtDec(selected.benefice_par_homme_jour, dl)} € / {isPt ? 'homem' : 'homme'} / {isPt ? 'dia' : 'jour'}
                  </div>
                </div>
                <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Perda por dia de atraso' : 'Perte par jour de retard'}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444' }}>-{fmt(selected.perte_par_jour_retard, dl)} € / {isPt ? 'dia' : 'jour'}</div>
                </div>
              </div>
              <div className="v22-card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}><SlidersHorizontal size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{isPt ? 'Simulador' : 'Simulateur'}</h3>
                <div style={{ marginBottom: 16 }}>
                  <label className="v22-form-label"><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Dias de atraso' : 'Jours de retard'}: <strong>{simDays}</strong></label>
                  <input type="range" min={0} max={60} value={simDays} onChange={e => setSimDays(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="v22-form-label"><HardHat size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isPt ? 'Funcionários extra' : 'Ouvriers en plus'}: <strong>+{simWorkers}</strong></label>
                  <input type="range" min={0} max={10} value={simWorkers} onChange={e => setSimWorkers(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                {simResult && (simDays > 0 || simWorkers > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {simDays > 0 && (
                      <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 12, color: '#991B1B' }}>{simDays}j retard =</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#EF4444' }}>-{fmt(simResult.perteRetard, dl)} €</div>
                      </div>
                    )}
                    {simWorkers > 0 && (
                      <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 12, color: '#92400E' }}>+{simWorkers} {isPt ? 'funcionários' : 'ouvriers'} =</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B' }}>-{fmt(simResult.coutOuvrierSup, dl)} €</div>
                      </div>
                    )}
                    <div style={{ background: simResult.nouveauBenef >= 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{isPt ? 'Novo lucro' : 'Nouveau bénéfice'}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: simResult.nouveauBenef >= 0 ? '#22C55E' : '#EF4444' }}>
                        {fmt(simResult.nouveauBenef, dl)} €
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Marge: {simResult.nouvelleMarge.toFixed(1)}%</div>
                    </div>
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
      <span style={{ fontSize: 13, color: '#4A5E78' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 600, color: color || '#0D1B2E' }}>{value}</span>
    </div>
  )
}
