'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPSettings } from '@/lib/hooks/use-btp-data'

// ═══════════════════════════════════════════════════════════════════════════════
// COMPTA BTP INTELLIGENTE
// Vue en 5 secondes : combien je gagne/perds par homme par jour par chantier
// ═══════════════════════════════════════════════════════════════════════════════

interface RentaData {
  chantier_id: string; titre: string; client: string; budget: number
  date_debut: string; date_fin: string; statut: string
  jours_prevu: number; total_heures: number; nb_ouvriers: number
  nb_jours_pointes: number; cout_main_oeuvre: number
  total_materiaux: number; total_autres: number; total_depenses: number
  cout_total: number; benefice_net: number
  benefice_par_homme_jour: number; perte_par_jour_retard: number
}

function fmt(n: number, locale: string): string {
  return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDec(n: number, locale: string): string {
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000))
}

export function ComptaBTPSection({ artisan }: { artisan: any }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dateLocale = isPt ? 'pt-PT' : 'fr-FR'
  const { settings, save: saveSettings } = useBTPSettings()

  const [data, setData] = useState<RentaData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [simDays, setSimDays] = useState(0) // jours de retard simulés
  const [simWorkers, setSimWorkers] = useState(0) // ouvriers supplémentaires

  // Fetch from the Supabase view
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/btp?table=rentabilite')
        if (res.ok) {
          const json = await res.json()
          setData(json.rentabilite || [])
        }
      } catch { /* silent */ }
      setLoading(false)
    }
    load()
  }, [])

  const selected = useMemo(() => data.find(d => d.chantier_id === selectedId) || null, [data, selectedId])

  // ── KPIs globaux ──────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const active = data.filter(d => d.statut === 'En cours')
    return {
      nbChantiers: active.length,
      caTotal: active.reduce((s, d) => s + (d.budget || 0), 0),
      coutTotal: active.reduce((s, d) => s + d.cout_total, 0),
      beneficeTotal: active.reduce((s, d) => s + d.benefice_net, 0),
      heuresTotal: active.reduce((s, d) => s + d.total_heures, 0),
      perteJourRetard: active.reduce((s, d) => s + d.perte_par_jour_retard, 0),
    }
  }, [data])

  const margeGlobale = totals.caTotal > 0 ? (totals.beneficeTotal / totals.caTotal) * 100 : 0

  // ── Simulateur retard ─────────────────────────────────────────────────────
  const simResult = useMemo(() => {
    if (!selected) return null
    const coutJourRetard = selected.perte_par_jour_retard
    const perteRetard = coutJourRetard * simDays
    const coutOuvrierSup = simWorkers * 8 * settings.cout_horaire_ouvrier * (1 + settings.charges_patronales_pct / 100)
    const coutOuvrierTotal = coutOuvrierSup * Math.max(1, selected.nb_jours_pointes || 1)
    const nouveauBenef = selected.benefice_net - perteRetard - coutOuvrierTotal

    return {
      perteRetard,
      coutOuvrierSup: coutOuvrierTotal,
      nouveauBenef,
      nouvelleMarge: selected.budget > 0 ? (nouveauBenef / selected.budget) * 100 : 0,
      gain_par_homme_jour_ajuste: (selected.nb_ouvriers + simWorkers) > 0 && selected.nb_jours_pointes > 0
        ? nouveauBenef / ((selected.nb_ouvriers + simWorkers) * (selected.nb_jours_pointes + simDays))
        : 0,
    }
  }, [selected, simDays, simWorkers, settings])

  // ── Score chantier ────────────────────────────────────────────────────────
  function getScore(d: RentaData): { score: number; label: string; color: string; emoji: string } {
    const marge = d.budget > 0 ? (d.benefice_net / d.budget) * 100 : 0
    const retard = d.date_fin ? Math.max(0, daysBetween(d.date_fin, new Date().toISOString().split('T')[0])) : 0

    let score = 5
    if (marge >= 25) score += 3
    else if (marge >= 15) score += 2
    else if (marge >= 5) score += 1
    else if (marge < 0) score -= 3

    if (retard === 0) score += 1
    else if (retard > 14) score -= 2
    else if (retard > 7) score -= 1

    if (d.benefice_par_homme_jour > 100) score += 1
    if (d.benefice_par_homme_jour < 0) score -= 1

    score = Math.max(0, Math.min(10, score))

    if (score >= 7) return { score, label: isPt ? 'Rentável' : 'Rentable', color: '#22C55E', emoji: '🟢' }
    if (score >= 4) return { score, label: isPt ? 'Médio' : 'Moyen', color: '#F59E0B', emoji: '🟡' }
    return { score, label: isPt ? 'Em risco' : 'À risque', color: '#EF4444', emoji: '🔴' }
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 24 }}>⏳</div>
      <p className="v22-card-meta">{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title">🧠 {isPt ? 'Contabilidade Inteligente' : 'Compta Intelligente'}</h2>
          <p className="v22-page-sub">
            {isPt ? 'Quanto ganho por homem/dia, quanto perco por dia de atraso' : 'Combien je gagne par homme/jour, combien je perds par jour de retard'}
          </p>
        </div>
        <button className="v22-btn v22-btn-sm" onClick={() => setShowSettings(!showSettings)}
          style={{ background: showSettings ? 'var(--v22-yellow)' : 'var(--v22-bg)', border: '1px solid var(--v22-border)' }}>
          ⚙️ {isPt ? 'Configurações' : 'Paramètres'}
        </button>
      </div>

      {/* Paramètres coûts horaires */}
      {showSettings && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">⚙️ {isPt ? 'Custos por defeito' : 'Coûts par défaut'}</div>
          </div>
          <div className="v22-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label className="v22-form-label">{isPt ? 'Custo/hora operário' : 'Coût/h ouvrier'} (€)</label>
                <input type="number" className="v22-form-input" value={settings.cout_horaire_ouvrier}
                  onChange={e => saveSettings({ cout_horaire_ouvrier: Number(e.target.value) })} />
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Custo/hora chefe obra' : 'Coût/h chef chantier'} (€)</label>
                <input type="number" className="v22-form-input" value={settings.cout_horaire_chef_chantier}
                  onChange={e => saveSettings({ cout_horaire_chef_chantier: Number(e.target.value) })} />
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Custo/hora condutor' : 'Coût/h conducteur'} (€)</label>
                <input type="number" className="v22-form-input" value={settings.cout_horaire_conducteur}
                  onChange={e => saveSettings({ cout_horaire_conducteur: Number(e.target.value) })} />
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Encargos patronais' : 'Charges patronales'} (%)</label>
                <input type="number" className="v22-form-input" value={settings.charges_patronales_pct}
                  onChange={e => saveSettings({ charges_patronales_pct: Number(e.target.value) })} />
              </div>
              <div>
                <label className="v22-form-label">📡 {isPt ? 'Pointagem GPS' : 'Pointage GPS'}</label>
                <button className="v22-btn v22-btn-sm" onClick={() => saveSettings({ geo_pointage_enabled: !settings.geo_pointage_enabled })}
                  style={{ background: settings.geo_pointage_enabled ? '#22C55E' : '#EF4444', color: '#fff', width: '100%' }}>
                  {settings.geo_pointage_enabled ? '✅ ON' : '❌ OFF'}
                </button>
              </div>
              {settings.geo_pointage_enabled && (
                <>
                  <div>
                    <label className="v22-form-label">📍 {isPt ? 'Morada do depósito' : 'Adresse du dépôt'}</label>
                    <input className="v22-form-input" value={settings.depot_adresse || ''} placeholder={isPt ? 'Morada...' : 'Adresse...'}
                      onChange={e => saveSettings({ depot_adresse: e.target.value })} />
                  </div>
                  <div>
                    <label className="v22-form-label">{isPt ? 'Raio depósito' : 'Rayon dépôt'} (m)</label>
                    <input type="number" className="v22-form-input" value={settings.depot_rayon_m}
                      onChange={e => saveSettings({ depot_rayon_m: Number(e.target.value) })} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPIs globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {[
          { label: isPt ? 'Obras ativas' : 'Chantiers actifs', value: totals.nbChantiers, suffix: '', color: '#0D1B2E' },
          { label: 'CA', value: fmt(totals.caTotal, dateLocale), suffix: ' €', color: '#0D1B2E' },
          { label: isPt ? 'Custos totais' : 'Coûts totaux', value: fmt(totals.coutTotal, dateLocale), suffix: ' €', color: '#EF4444' },
          { label: isPt ? 'Lucro líquido' : 'Bénéfice net', value: fmt(totals.beneficeTotal, dateLocale), suffix: ' €', color: totals.beneficeTotal >= 0 ? '#22C55E' : '#EF4444' },
          { label: 'Marge', value: margeGlobale.toFixed(1), suffix: '%', color: margeGlobale >= 15 ? '#22C55E' : '#F59E0B' },
          { label: isPt ? 'Perda/dia atraso' : 'Perte/jour retard', value: fmt(totals.perteJourRetard, dateLocale), suffix: ' €', color: '#EF4444' },
        ].map((kpi, i) => (
          <div key={i} className="v22-card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div className="v22-card-meta" style={{ fontSize: 11, marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color }}>{kpi.value}{kpi.suffix}</div>
          </div>
        ))}
      </div>

      {/* Tableau chantiers */}
      {data.length === 0 ? (
        <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            {isPt ? 'Sem dados' : 'Aucune donnée'}
          </div>
          <p className="v22-card-meta">
            {isPt
              ? 'Crie obras e registe pontuagens para ver a contabilidade inteligente.'
              : 'Créez des chantiers et enregistrez des pointages pour voir la compta intelligente.'}
          </p>
        </div>
      ) : (
        <div className="v22-card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--v22-border)' }}>
                  {[
                    '', isPt ? 'Obra' : 'Chantier', 'Budget', isPt ? 'M.O.' : 'M.O.', isPt ? 'Despesas' : 'Dépenses',
                    isPt ? 'Lucro' : 'Bénéf.', 'Marge',
                    isPt ? '€/homme/jour' : '€/homme/jour', isPt ? 'Perda/jour retard' : 'Perte/jour retard',
                    isPt ? 'Funcionários' : 'Ouvriers', isPt ? 'Horas' : 'Heures', 'Score',
                  ].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 10px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(d => {
                  const s = getScore(d)
                  const marge = d.budget > 0 ? (d.benefice_net / d.budget) * 100 : 0
                  const isSelected = d.chantier_id === selectedId
                  return (
                    <tr key={d.chantier_id} onClick={() => setSelectedId(isSelected ? null : d.chantier_id)}
                      style={{ borderBottom: '1px solid var(--v22-border)', cursor: 'pointer', background: isSelected ? '#FEF5E4' : undefined }}>
                      <td style={{ padding: '10px 6px', fontSize: 16 }}>{s.emoji}</td>
                      <td style={{ padding: '10px 10px', fontWeight: 600 }}>{d.titre}</td>
                      <td style={{ padding: '10px 10px' }}>{fmt(d.budget || 0, dateLocale)} €</td>
                      <td style={{ padding: '10px 10px', color: '#EF4444' }}>{fmt(d.cout_main_oeuvre, dateLocale)} €</td>
                      <td style={{ padding: '10px 10px', color: '#F59E0B' }}>{fmt(d.total_depenses, dateLocale)} €</td>
                      <td style={{ padding: '10px 10px', fontWeight: 700, color: d.benefice_net >= 0 ? '#22C55E' : '#EF4444' }}>
                        {fmt(d.benefice_net, dateLocale)} €
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: 700, color: marge >= 15 ? '#22C55E' : marge >= 0 ? '#F59E0B' : '#EF4444' }}>
                        {marge.toFixed(1)}%
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: 700, color: d.benefice_par_homme_jour >= 0 ? '#22C55E' : '#EF4444' }}>
                        {fmtDec(d.benefice_par_homme_jour, dateLocale)} €
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: 700, color: '#EF4444' }}>
                        -{fmt(d.perte_par_jour_retard, dateLocale)} €
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center' }}>{d.nb_ouvriers}</td>
                      <td style={{ padding: '10px 10px', color: 'var(--v22-yellow)', fontWeight: 600 }}>{d.total_heures}h</td>
                      <td style={{ padding: '10px 10px' }}>
                        <span style={{ fontWeight: 700, color: s.color }}>{s.score}/10</span>
                        <span style={{ fontSize: 10, marginLeft: 4, color: s.color }}>{s.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Détail chantier sélectionné + Simulateur */}
      {selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Détail */}
          <div className="v22-card" style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📊 {selected.titre}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label={isPt ? 'Orçamento' : 'Budget'} value={`${fmt(selected.budget || 0, dateLocale)} €`} />
              <Row label={isPt ? 'Mão de obra (c/ encargos)' : 'Main d\'oeuvre (chargée)'} value={`${fmt(selected.cout_main_oeuvre, dateLocale)} €`} color="#EF4444" />
              <Row label={isPt ? 'Materiais' : 'Matériaux'} value={`${fmt(selected.total_materiaux, dateLocale)} €`} color="#F59E0B" />
              <Row label={isPt ? 'Outras despesas' : 'Autres dépenses'} value={`${fmt(selected.total_autres, dateLocale)} €`} color="#6B7280" />
              <div style={{ borderTop: '2px solid var(--v22-border)', paddingTop: 8 }}>
                <Row label={isPt ? 'LUCRO LÍQUIDO' : 'BÉNÉFICE NET'} value={`${fmt(selected.benefice_net, dateLocale)} €`}
                  color={selected.benefice_net >= 0 ? '#22C55E' : '#EF4444'} bold />
              </div>
              <div style={{ borderTop: '1px solid var(--v22-border)', paddingTop: 8, marginTop: 4 }}>
                <Row label={isPt ? 'Funcionários' : 'Ouvriers'} value={`${selected.nb_ouvriers}`} />
                <Row label={isPt ? 'Dias pontados' : 'Jours pointés'} value={`${selected.nb_jours_pointes}`} />
                <Row label={isPt ? 'Total horas' : 'Total heures'} value={`${selected.total_heures}h`} />
              </div>
              <div style={{ background: '#F0FDF4', borderRadius: 8, padding: 12, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                  💰 {isPt ? 'Ganho por homem por dia' : 'Gain par homme par jour'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: selected.benefice_par_homme_jour >= 0 ? '#22C55E' : '#EF4444' }}>
                  {fmtDec(selected.benefice_par_homme_jour, dateLocale)} € / {isPt ? 'homem' : 'homme'} / {isPt ? 'dia' : 'jour'}
                </div>
              </div>
              <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 4 }}>
                  ⚠️ {isPt ? 'Se ultrapassa o prazo' : 'Si ça dépasse le délai'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444' }}>
                  -{fmt(selected.perte_par_jour_retard, dateLocale)} € / {isPt ? 'dia' : 'jour'}
                </div>
                <div style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>
                  {isPt
                    ? `= custo diário de ${selected.nb_ouvriers} funcionários × ${settings.cout_horaire_ouvrier}€/h × 8h × ${(1 + settings.charges_patronales_pct / 100).toFixed(2)} (encargos)`
                    : `= coût journalier de ${selected.nb_ouvriers} ouvriers × ${settings.cout_horaire_ouvrier}€/h × 8h × ${(1 + settings.charges_patronales_pct / 100).toFixed(2)} (charges)`}
                </div>
              </div>
            </div>
          </div>

          {/* Simulateur */}
          <div className="v22-card" style={{ padding: 20 }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
              🎮 {isPt ? 'Simulador' : 'Simulateur'} : {isPt ? 'Et si...' : 'Et si...'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Slider retard */}
              <div>
                <label className="v22-form-label">
                  📅 {isPt ? 'Dias de atraso' : 'Jours de retard'}: <strong>{simDays}</strong>
                </label>
                <input type="range" min={0} max={60} value={simDays}
                  onChange={e => setSimDays(Number(e.target.value))}
                  style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
                  <span>0</span><span>15</span><span>30</span><span>45</span><span>60</span>
                </div>
              </div>

              {/* Slider ouvriers sup */}
              <div>
                <label className="v22-form-label">
                  👷 {isPt ? 'Funcionários extra' : 'Ouvriers supplémentaires'}: <strong>+{simWorkers}</strong>
                </label>
                <input type="range" min={0} max={10} value={simWorkers}
                  onChange={e => setSimWorkers(Number(e.target.value))}
                  style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
                  <span>0</span><span>2</span><span>5</span><span>8</span><span>10</span>
                </div>
              </div>

              {/* Résultats simulateur */}
              {simResult && (simDays > 0 || simWorkers > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {simDays > 0 && (
                    <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, color: '#991B1B' }}>
                        📅 {simDays} {isPt ? 'dias de atraso' : 'jours de retard'} =
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#EF4444' }}>
                        -{fmt(simResult.perteRetard, dateLocale)} €
                      </div>
                    </div>
                  )}
                  {simWorkers > 0 && (
                    <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, color: '#92400E' }}>
                        👷 +{simWorkers} {isPt ? 'funcionários' : 'ouvriers'} =
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B' }}>
                        -{fmt(simResult.coutOuvrierSup, dateLocale)} €
                      </div>
                    </div>
                  )}

                  <div style={{
                    background: simResult.nouveauBenef >= 0 ? '#F0FDF4' : '#FEF2F2',
                    borderRadius: 8, padding: 16, marginTop: 4,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {isPt ? 'Novo lucro líquido' : 'Nouveau bénéfice net'} :
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: simResult.nouveauBenef >= 0 ? '#22C55E' : '#EF4444' }}>
                      {fmt(simResult.nouveauBenef, dateLocale)} €
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                      Marge: {simResult.nouvelleMarge.toFixed(1)}% — {fmtDec(simResult.gain_par_homme_jour_ajuste, dateLocale)} €/{isPt ? 'homem' : 'homme'}/{isPt ? 'dia' : 'jour'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mini-composant ligne détail
function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 13, color: '#4A5E78' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 600, color: color || '#0D1B2E' }}>{value}</span>
    </div>
  )
}
