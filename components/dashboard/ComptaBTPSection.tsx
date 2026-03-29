'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPSettings, type BTPSettings, type FraiFixe } from '@/lib/hooks/use-btp-data'

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
  detail_ouvriers: any[]
}

function fmt(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtDec(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const STATUT_LABELS: Record<string, string> = {
  sarl: 'SARL', sas: 'SAS', eurl: 'EURL', sasu: 'SASU', ei: 'Entreprise individuelle', micro: 'Micro-entreprise', sa: 'SA', scop: 'SCOP',
}
const TVA_LABELS: Record<string, string> = {
  reel_normal: 'Réel normal', reel_simplifie: 'Réel simplifié', franchise: 'Franchise de TVA', mini_reel: 'Mini-réel',
}

export function ComptaBTPSection({ artisan }: { artisan: any }) {
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
  const [membres, setMembres] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [rentaRes, membresRes] = await Promise.all([
          fetch('/api/btp?table=rentabilite'),
          fetch('/api/btp?table=membres'),
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
    if (settings.salaire_patron_type === 'brut') return base * (1 + (settings.taux_cotisations_patron || 45) / 100)
    // net → brut → chargé : approximation net * 1.25 * (1 + charges%)
    return base * 1.25 * (1 + (settings.taux_cotisations_patron || 45) / 100)
  }, [settings])

  const coutFixeMensuel = fraisFixes + salairePatronCharge + (settings.amortissements_mensuels || 0)

  const totals = useMemo(() => {
    const active = data.filter(d => d.statut === 'En cours' || d.statut === 'Terminé')
    const ca = active.reduce((s, d) => s + (d.ca_reel || 0), 0)
    const cout = active.reduce((s, d) => s + d.cout_total, 0)
    const benefBrut = ca - cout
    // Bénéfice net après frais fixes (proratisé sur nb mois d'activité)
    const nbMois = Math.max(1, active.length > 0 ? new Set(active.map(d => (d.date_debut || '').slice(0, 7))).size : 1)
    const totalFraisFixes = coutFixeMensuel * nbMois
    const benefNet = benefBrut - totalFraisFixes
    const impots = Math.max(0, benefNet * (settings.taux_is || 25) / 100)

    return {
      nbChantiers: active.length,
      ca, cout,
      fraisFixes: totalFraisFixes,
      benefBrut,
      benefNet,
      impots,
      benefApresImpots: benefNet - impots,
      marge: ca > 0 ? (benefNet / ca) * 100 : 0,
      heures: active.reduce((s, d) => s + d.total_heures, 0),
      perteJour: active.reduce((s, d) => s + d.perte_par_jour_retard, 0),
    }
  }, [data, coutFixeMensuel, settings.taux_is])

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

  // ── Score ─────────────────────────────────────────────────────────────────
  function getScore(d: RentaData) {
    const marge = d.ca_reel > 0 ? (d.benefice_net / d.ca_reel) * 100 : 0
    let score = 5
    if (marge >= 25) score += 3; else if (marge >= 15) score += 2; else if (marge >= 5) score += 1; else if (marge < 0) score -= 3
    if (d.benefice_par_homme_jour > 100) score += 1
    if (d.benefice_par_homme_jour < 0) score -= 1
    score = Math.max(0, Math.min(10, score))
    if (score >= 7) return { score, label: isPt ? 'Rentável' : 'Rentable', color: '#22C55E', emoji: '🟢' }
    if (score >= 4) return { score, label: isPt ? 'Médio' : 'Moyen', color: '#F59E0B', emoji: '🟡' }
    return { score, label: isPt ? 'Em risco' : 'À risque', color: '#EF4444', emoji: '🔴' }
  }

  // ── Handlers frais fixes ──────────────────────────────────────────────────
  const addFrai = () => {
    if (!newFrai.label || !newFrai.montant) return
    const updated = [...(settings.frais_fixes_mensuels || []), newFrai]
    saveSettings({ frais_fixes_mensuels: updated } as any)
    setNewFrai({ label: '', montant: 0, frequence: 'mensuel' })
  }
  const removeFrai = (idx: number) => {
    const updated = (settings.frais_fixes_mensuels || []).filter((_: any, i: number) => i !== idx)
    saveSettings({ frais_fixes_mensuels: updated } as any)
  }

  if (loading || loadingS) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 24 }}>⏳</div>
      <p className="v22-card-meta">{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + Tabs */}
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title">🧠 {isPt ? 'Contabilidade Inteligente' : 'Compta Intelligente'}</h2>
          <p className="v22-page-sub">{isPt ? 'Tudo num só lugar: salário, encargos, lucro real' : 'Tout en un : salaire, charges, bénéfice réel'}</p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {([
          { k: 'dashboard', icon: '📊', label: isPt ? 'Painel' : 'Tableau de bord' },
          { k: 'profil', icon: '👤', label: isPt ? 'Perfil fiscal' : 'Profil patron' },
          { k: 'equipe', icon: '👷', label: isPt ? 'Custos equipa' : 'Coûts équipe' },
          { k: 'frais', icon: '🏢', label: isPt ? 'Encargos fixos' : 'Frais fixes' },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="v22-btn v22-btn-sm"
            style={{ background: tab === t.k ? 'var(--v22-yellow)' : 'transparent', fontWeight: tab === t.k ? 700 : 400 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB: PROFIL PATRON ══════ */}
      {tab === 'profil' && (
        <div className="v22-card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>👤 {isPt ? 'O meu perfil fiscal' : 'Mon profil fiscal'}</h3>
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
                onChange={e => saveSettings({ salaire_patron_type: e.target.value as any })}>
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
              <label className="v22-form-label">{isPt ? 'Estatuto jurídico' : 'Statut juridique'}</label>
              <select className="v22-form-input" value={settings.statut_juridique}
                onChange={e => saveSettings({ statut_juridique: e.target.value })}>
                {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💰 {isPt ? 'Custo real mensal do patrão' : 'Coût réel mensuel du patron'}</div>
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
            <div className="v22-card-title">👷 {isPt ? 'Custo real por funcionário' : 'Coût réel par employé'}</div>
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
                ) : membres.map((m: any) => {
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
            💡 {isPt
              ? 'Edite o custo horário e encargos de cada membro em Equipas > Editar membro'
              : 'Modifiez le coût horaire et les charges de chaque membre dans Équipes > Modifier le membre'}
          </div>
        </div>
      )}

      {/* ══════ TAB: FRAIS FIXES ══════ */}
      {tab === 'frais' && (
        <div className="v22-card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🏢 {isPt ? 'Encargos fixos mensais' : 'Frais fixes mensuels'}</h3>
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
                  <button onClick={() => removeFrai(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A' }}>✕</button>
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
            <button className="v22-btn" onClick={addFrai} disabled={!newFrai.label || !newFrai.montant}>➕</button>
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
              { label: `IS (${settings.taux_is}%)`, value: `-${fmt(totals.impots, dl)} €`, color: '#6B7280' },
              { label: isPt ? 'LUCRO LÍQUIDO' : 'BÉNÉF. NET', value: `${fmt(totals.benefApresImpots, dl)} €`, color: totals.benefApresImpots >= 0 ? '#22C55E' : '#EF4444' },
              { label: 'Marge', value: `${totals.marge.toFixed(1)}%`, color: totals.marge >= (settings.objectif_marge_pct || 20) ? '#22C55E' : totals.marge >= 0 ? '#F59E0B' : '#EF4444' },
            ].map((kpi, i) => (
              <div key={i} className="v22-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                <div className="v22-card-meta" style={{ fontSize: 10, marginBottom: 2 }}>{kpi.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Alerte objectif marge */}
          {totals.marge < (settings.objectif_marge_pct || 20) && totals.ca > 0 && (
            <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400E' }}>
              ⚠️ {isPt
                ? `A sua margem (${totals.marge.toFixed(1)}%) está abaixo do objetivo de ${settings.objectif_marge_pct}%`
                : `Votre marge (${totals.marge.toFixed(1)}%) est en dessous de l'objectif de ${settings.objectif_marge_pct}%`}
            </div>
          )}

          {/* Tableau chantiers */}
          {data.length === 0 ? (
            <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
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
                          <td style={{ padding: '8px 4px' }}>{s.emoji}</td>
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
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📊 {selected.titre}</h3>
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>⚠️ {isPt ? 'Perda por dia de atraso' : 'Perte par jour de retard'}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444' }}>-{fmt(selected.perte_par_jour_retard, dl)} € / {isPt ? 'dia' : 'jour'}</div>
                </div>
              </div>
              <div className="v22-card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🎮 {isPt ? 'Simulador' : 'Simulateur'}</h3>
                <div style={{ marginBottom: 16 }}>
                  <label className="v22-form-label">📅 {isPt ? 'Dias de atraso' : 'Jours de retard'}: <strong>{simDays}</strong></label>
                  <input type="range" min={0} max={60} value={simDays} onChange={e => setSimDays(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="v22-form-label">👷 {isPt ? 'Funcionários extra' : 'Ouvriers en plus'}: <strong>+{simWorkers}</strong></label>
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
