'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import type { ProductLine } from '@/lib/devis-types'
import { supabase } from '@/lib/supabase'

interface LigneAnalysee {
  description: string
  qty: number
  unit: string
  priceHT: number
  totalHT: number
  matched: boolean
  refPrestation?: string
  refPrixMoyen?: number
  refPrixMin?: number
  refPrixMax?: number
  ecartPct?: number
  verdict?: 'trop_bas' | 'ok' | 'trop_haut'
  matchScore?: number
}

interface AnalyseResult {
  lignesAnalysees: LigneAnalysee[]
  totaux: {
    caHT: number
    coutMOBrut: number
    coutChargesPatronales: number
    coutMOTotal: number
    chargesFixesProrata: number
    coutTotal: number
    beneficeNet: number
    margePct: number
    heuresTotal: number
    coutHoraireMoyen: number
    chargesPatronalesPct: number
    chargesFixesMensuelles: number
  }
  stats: {
    nbLignes: number
    nbMatched: number
    nbTropBas: number
    nbOk: number
    nbTropHaut: number
    nbNonAnalysees: number
  }
  niveau: 'critique' | 'attention' | 'correct' | 'excellent'
  constat: string
}

interface Membre {
  id: string
  nom?: string
  prenom?: string
  poste?: string
  type_contrat?: string
  cout_horaire?: number
  salaire_net_mensuel?: number
  charges_patronales_pct?: number
  actif?: boolean
}

interface Props {
  items: ProductLine[]
  totalHT: number
  totalTTC: number
  corpsMetier?: string
  onClose: () => void
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

// ── Mapping statut juridique → taux charges patronales par défaut ───────────
function detectChargesPatronales(statut: string | null | undefined): number {
  if (!statut) return 45
  const s = statut.toLowerCase()
  // Auto-entrepreneur / micro / EI : ~22% (cotisations sur CA)
  if (s.includes('auto') || s.includes('micro') || s.includes('ei') || s.includes('entrepreneur individuel')) return 22
  // SARL / SAS / SASU / EURL / SA : ~45% (CDI standard ouvrier BTP)
  return 45
}

export default function RentabiliteDevisModal({ items, totalHT: _totalHT, totalTTC, corpsMetier, onClose }: Props) {
  const [joursChantier, setJoursChantier] = useState<number>(5)
  const [heuresParJour, setHeuresParJour] = useState<number>(8)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [result, setResult] = useState<AnalyseResult | null>(null)

  // ── Données chargées au mount ─────────────────────────────────────────────
  const [membres, setMembres] = useState<Membre[]>([])
  const [selectedMembreIds, setSelectedMembreIds] = useState<Set<string>>(new Set())
  const [statutJuridique, setStatutJuridique] = useState<string | null>(null)
  const [chargesPatronalesAuto, setChargesPatronalesAuto] = useState<number>(45)
  const [coutHoraireMoyen, setCoutHoraireMoyen] = useState<number>(25)
  const [chargesFixesMensuelles, setChargesFixesMensuelles] = useState<number>(0)
  const [coutHoraireOverride, setCoutHoraireOverride] = useState<string>('')
  const [chargesPctOverride, setChargesPctOverride] = useState<string>('')
  const [chargesFixesOverride, setChargesFixesOverride] = useState<string>('')

  // Charge settings + membres + charges_fixes au mount via /api/btp (Bearer)
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) {
          if (!cancelled) {
            setBootstrapping(false)
            toast.error('Session expirée — reconnecte-toi pour analyser le devis')
          }
          return
        }
        const headers = { Authorization: `Bearer ${token}` }
        const [settingsRes, membresRes, chargesRes] = await Promise.all([
          fetch('/api/btp?table=settings', { headers }),
          fetch('/api/btp?table=membres', { headers }),
          fetch('/api/btp?table=charges_fixes', { headers }),
        ])
        const settings = settingsRes.ok ? (await settingsRes.json()).settings : null
        const membresData = membresRes.ok ? (await membresRes.json()).membres : []
        const chargesData = chargesRes.ok ? (await chargesRes.json()).charges_fixes : []

        if (cancelled) return

        const statut = settings?.statut_juridique || settings?.company_type || null
        setStatutJuridique(statut)
        const tauxAuto = settings?.charges_patronales_pct ?? detectChargesPatronales(statut)
        setChargesPatronalesAuto(tauxAuto)

        const actifs: Membre[] = (membresData || []).filter((m: Membre) => m.actif !== false)
        setMembres(actifs)
        // Pré-sélectionner tous les membres actifs
        setSelectedMembreIds(new Set(actifs.map(m => m.id)))

        // Coût horaire moyen depuis membres
        if (actifs.length > 0) {
          const avg = actifs.reduce((s, m) => s + (m.cout_horaire || 25), 0) / actifs.length
          setCoutHoraireMoyen(Math.round(avg * 10) / 10)
        } else if (settings?.cout_horaire_moyen) {
          setCoutHoraireMoyen(settings.cout_horaire_moyen)
        }

        // Charges fixes mensuelles depuis charges_fixes
        const totalMensuel = (chargesData || []).reduce((sum: number, c: { montant: number; frequence: string }) => {
          const m = c.frequence === 'annuel' ? c.montant / 12
                  : c.frequence === 'trimestriel' ? c.montant / 3
                  : c.montant
          return sum + m
        }, 0)
        setChargesFixesMensuelles(Math.round(totalMensuel))

        setBootstrapping(false)
      } catch (e) {
        console.error('[RentaDevis] bootstrap error', e)
        if (!cancelled) {
          setBootstrapping(false)
          toast.error('Erreur de chargement des données — utilise les overrides manuels')
        }
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  const nbPersonnesEffective = selectedMembreIds.size > 0 ? selectedMembreIds.size : 1

  // Coût horaire moyen calculé dynamiquement depuis les membres sélectionnés
  const coutHoraireSelected = useMemo(() => {
    if (membres.length === 0 || selectedMembreIds.size === 0) return coutHoraireMoyen
    const selected = membres.filter(m => selectedMembreIds.has(m.id))
    if (selected.length === 0) return coutHoraireMoyen
    return selected.reduce((s, m) => s + (m.cout_horaire || 25), 0) / selected.length
  }, [membres, selectedMembreIds, coutHoraireMoyen])

  function toggleMembre(id: string) {
    setSelectedMembreIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleAnalyser() {
    if (!items.length) {
      toast.error('Ajoute au moins une ligne au devis')
      return
    }
    if (membres.length > 0 && selectedMembreIds.size === 0) {
      toast.error('Sélectionne au moins une personne sur le chantier')
      return
    }
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        toast.error('Session expirée — reconnecte-toi')
        setLoading(false)
        return
      }

      const body: Record<string, unknown> = {
        items: items.map(i => ({
          description: i.description,
          qty: i.qty,
          unit: i.unit,
          priceHT: i.priceHT,
          totalHT: i.totalHT,
        })),
        nbPersonnes: nbPersonnesEffective,
        joursChantier,
        heuresParJour,
      }
      if (corpsMetier) body.corpsMetier = corpsMetier

      // Override coût horaire = moyenne des membres sélectionnés ou override manuel
      const coutHoraireFinal = coutHoraireOverride !== ''
        ? parseFloat(coutHoraireOverride)
        : coutHoraireSelected
      if (Number.isFinite(coutHoraireFinal) && coutHoraireFinal > 0) {
        body.coutHoraireOverride = Math.round(coutHoraireFinal * 100) / 100
      }

      // Charges patronales auto-détectées (override manuel si saisi)
      const chargesPctFinal = chargesPctOverride !== ''
        ? parseFloat(chargesPctOverride)
        : chargesPatronalesAuto
      if (Number.isFinite(chargesPctFinal) && chargesPctFinal >= 0) {
        body.chargesPatronalesPctOverride = chargesPctFinal
      }

      // Charges fixes mensuelles (override manuel si saisi)
      const chargesFixesFinal = chargesFixesOverride !== ''
        ? parseFloat(chargesFixesOverride)
        : chargesFixesMensuelles
      if (Number.isFinite(chargesFixesFinal) && chargesFixesFinal >= 0) {
        body.chargesFixesMensuellesOverride = chargesFixesFinal
      }

      const res = await fetch('/api/devis/analyser-rentabilite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as AnalyseResult
      setResult(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Analyse échouée : ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const niveauStyles: Record<string, { bg: string; color: string; border: string; emoji: string; label: string }> = {
    critique:  { bg: '#FEE2E2', color: '#991B1B', border: '#DC2626', emoji: '🚨', label: 'Critique' },
    attention: { bg: '#FEF3C7', color: '#92400E', border: '#F59E0B', emoji: '⚠️', label: 'Attention' },
    correct:   { bg: '#D1FAE5', color: '#065F46', border: '#10B981', emoji: '✅', label: 'Correct' },
    excellent: { bg: '#DBEAFE', color: '#1E3A8A', border: '#3B82F6', emoji: '💎', label: 'Excellent' },
  }

  const verdictStyles: Record<string, { bg: string; color: string; label: string }> = {
    trop_bas:  { bg: '#FEE2E2', color: '#991B1B', label: 'Trop bas' },
    ok:        { bg: '#D1FAE5', color: '#065F46', label: 'OK' },
    trop_haut: { bg: '#FEF3C7', color: '#92400E', label: 'Trop haut' },
  }

  return (
    <div className="rdv-ov" onClick={onClose}>
      <div className="rdv-modal" onClick={(e) => e.stopPropagation()}>
        <style jsx>{`
          .rdv-ov { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
          .rdv-modal { background: #fff; border-radius: 10px; width: 100%; max-width: 880px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; }
          .rdv-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #F0F0F0; }
          .rdv-h h3 { font-size: 17px; font-weight: 700; margin: 0; }
          .rdv-h .rdv-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; padding: 0 6px; }
          .rdv-section-title { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin: 1rem 0 0.5rem; }
          .rdv-employees { background: #FAFAFA; border-radius: 8px; padding: 12px; margin-bottom: 1rem; }
          .rdv-empty-employees { padding: 14px; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; font-size: 12px; color: #92400E; line-height: 1.5; }
          .rdv-emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
          .rdv-emp-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border: 1.5px solid #E0E0E0; border-radius: 6px; cursor: pointer; transition: all .15s; }
          .rdv-emp-item:hover { border-color: #FFC107; }
          .rdv-emp-item.selected { border-color: #FFC107; background: #FFF8E1; }
          .rdv-emp-item input { margin: 0; cursor: pointer; }
          .rdv-emp-item .name { font-weight: 600; font-size: 13px; }
          .rdv-emp-item .meta { font-size: 11px; color: #888; margin-top: 2px; }
          .rdv-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: end; padding: 14px; background: #FAFAFA; border-radius: 8px; margin-bottom: 1rem; }
          .rdv-form label { display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
          .rdv-form input { width: 100%; padding: 8px 10px; border: 1px solid #E0E0E0; border-radius: 6px; font-size: 14px; font-weight: 600; }
          .rdv-form .rdv-btn { padding: 9px 18px; background: #FFC107; border: 1px solid #FFC107; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; color: #1a1a1a; transition: opacity .15s; }
          .rdv-form .rdv-btn:hover:not(:disabled) { opacity: 0.85; }
          .rdv-form .rdv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .rdv-detected { background: #ECFDF5; border: 1px solid #10B981; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #065F46; margin-bottom: 1rem; }
          .rdv-detected strong { font-weight: 700; }
          .rdv-overrides { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px; background: #F9FAFB; border-radius: 8px; margin-bottom: 1rem; border: 1px dashed #D1D5DB; }
          .rdv-overrides label { display: block; font-size: 10px; font-weight: 600; color: #6B7280; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
          .rdv-overrides input { width: 100%; padding: 7px 10px; border: 1px solid #E5E7EB; border-radius: 5px; font-size: 13px; }
          .rdv-niveau { padding: 14px 16px; border-radius: 8px; border: 2px solid; margin-bottom: 1rem; display: flex; gap: 12px; align-items: flex-start; }
          .rdv-niveau .e { font-size: 22px; }
          .rdv-niveau .l { flex: 1; }
          .rdv-niveau .l .lab { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; margin-bottom: 4px; }
          .rdv-niveau .l .txt { font-size: 13px; line-height: 1.55; font-weight: 500; }
          .rdv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 1rem; }
          .rdv-card { padding: 12px; background: #FAFAFA; border-radius: 8px; border: 1px solid #F0F0F0; }
          .rdv-card .lab { font-size: 10px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
          .rdv-card .val { font-size: 17px; font-weight: 700; color: #1a1a1a; }
          .rdv-card .sub { font-size: 11px; color: #888; margin-top: 4px; }
          .rdv-card.benef .val { color: #10B981; }
          .rdv-card.benef.neg .val { color: #DC2626; }
          .rdv-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .rdv-table th { text-align: left; padding: 8px 10px; background: #FAFAFA; font-weight: 600; color: #666; border-bottom: 1px solid #E0E0E0; font-size: 11px; }
          .rdv-table td { padding: 8px 10px; border-bottom: 1px solid #F5F5F5; vertical-align: top; }
          .rdv-table tr.unmatched td { color: #999; font-style: italic; }
          .rdv-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
          .rdv-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #F0F0F0; }
          .rdv-foot button { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; }
          .rdv-loading { text-align: center; padding: 24px; color: #888; font-size: 13px; }
          .rdv-toggle { font-size: 11px; color: #6B7280; cursor: pointer; user-select: none; text-decoration: underline; margin-bottom: 8px; display: inline-block; }
        `}</style>

        <div className="rdv-h">
          <h3>📊 Rentabilité du devis</h3>
          <button className="rdv-close" onClick={onClose} type="button">×</button>
        </div>

        {bootstrapping ? (
          <div className="rdv-loading">⏳ Chargement des données équipe & charges...</div>
        ) : (
          <>
            {/* Données auto-détectées */}
            <div className="rdv-detected">
              <strong>🔍 Données détectées automatiquement</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20, lineHeight: 1.6 }}>
                <li>Statut juridique : <strong>{statutJuridique || 'Non défini'}</strong> → charges patronales <strong>{chargesPatronalesAuto.toFixed(0)}%</strong></li>
                <li>Coût horaire moyen équipe : <strong>{coutHoraireSelected.toFixed(0)}€/h</strong></li>
                <li>Charges fixes mensuelles : <strong>{fmt(chargesFixesMensuelles)}</strong> {chargesFixesMensuelles === 0 && <em>(aucune charge enregistrée)</em>}</li>
              </ul>
            </div>

            {/* Sélection des employés */}
            <div className="rdv-section-title">👷 Personnes sur le chantier</div>
            {membres.length === 0 ? (
              <div className="rdv-empty-employees">
                Aucun membre actif dans ton équipe. Ajoute-les depuis l'onglet <strong>Équipes</strong> pour calculer automatiquement les coûts main d'œuvre.
              </div>
            ) : (
              <div className="rdv-employees">
                <div className="rdv-emp-grid">
                  {membres.map(m => {
                    const selected = selectedMembreIds.has(m.id)
                    const fullName = `${m.prenom || ''} ${m.nom || ''}`.trim() || 'Membre'
                    return (
                      <label key={m.id} className={`rdv-emp-item ${selected ? 'selected' : ''}`}>
                        <input type="checkbox" checked={selected} onChange={() => toggleMembre(m.id)} />
                        <div>
                          <div className="name">{fullName}</div>
                          <div className="meta">
                            {m.poste || m.type_contrat || 'Ouvrier'}
                            {m.cout_horaire ? ` · ${m.cout_horaire}€/h` : ''}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
                  {selectedMembreIds.size} sélectionné(s) sur {membres.length}
                </div>
              </div>
            )}

            {/* Paramètres chantier */}
            <div className="rdv-form">
              <div>
                <label>Jours sur le chantier</label>
                <input type="number" min={0.5} max={365} step={0.5} value={joursChantier}
                  onChange={(e) => setJoursChantier(Math.max(0.5, parseFloat(e.target.value) || 1))} />
              </div>
              <div>
                <label>Heures/jour</label>
                <input type="number" min={1} max={14} value={heuresParJour}
                  onChange={(e) => setHeuresParJour(Math.max(1, Math.min(14, parseInt(e.target.value) || 8)))} />
              </div>
              <button className="rdv-btn" onClick={handleAnalyser} disabled={loading} type="button">
                {loading ? 'Analyse...' : 'Analyser'}
              </button>
            </div>

            {/* Overrides manuels (collapsibles) */}
            <details>
              <summary className="rdv-toggle">Ajuster manuellement les valeurs détectées (avancé)</summary>
              <div className="rdv-overrides">
                <div>
                  <label>Coût horaire (€)</label>
                  <input type="number" min={0} step={1} placeholder={`auto: ${coutHoraireSelected.toFixed(0)}`}
                    value={coutHoraireOverride} onChange={(e) => setCoutHoraireOverride(e.target.value)} />
                </div>
                <div>
                  <label>Charges patronales (%)</label>
                  <input type="number" min={0} max={100} step={1} placeholder={`auto: ${chargesPatronalesAuto.toFixed(0)}`}
                    value={chargesPctOverride} onChange={(e) => setChargesPctOverride(e.target.value)} />
                </div>
                <div>
                  <label>Charges fixes/mois (€)</label>
                  <input type="number" min={0} step={10} placeholder={`auto: ${chargesFixesMensuelles}`}
                    value={chargesFixesOverride} onChange={(e) => setChargesFixesOverride(e.target.value)} />
                </div>
              </div>
            </details>

            {!result && !loading && (
              <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12, marginTop: 8 }}>
                Configure les paramètres ci-dessus puis lance l'analyse pour comparer ce devis aux prix marché 2026 et calculer la rentabilité réelle.
              </div>
            )}

            {result && (
              <>
                <div className="rdv-niveau" style={{
                  background: niveauStyles[result.niveau].bg,
                  color: niveauStyles[result.niveau].color,
                  borderColor: niveauStyles[result.niveau].border,
                }}>
                  <div className="e">{niveauStyles[result.niveau].emoji}</div>
                  <div className="l">
                    <div className="lab">{niveauStyles[result.niveau].label}</div>
                    <div className="txt">{result.constat}</div>
                  </div>
                </div>

                <div className="rdv-grid">
                  <div className="rdv-card">
                    <div className="lab">Chiffre d'affaires HT</div>
                    <div className="val">{fmt(result.totaux.caHT)}</div>
                    <div className="sub">Total TTC : {fmt(totalTTC)}</div>
                  </div>
                  <div className="rdv-card">
                    <div className="lab">Coût main d'œuvre</div>
                    <div className="val">{fmt(result.totaux.coutMOTotal)}</div>
                    <div className="sub">{result.totaux.heuresTotal}h × {result.totaux.coutHoraireMoyen.toFixed(0)}€/h + {result.totaux.chargesPatronalesPct.toFixed(0)}% charges</div>
                  </div>
                  <div className="rdv-card">
                    <div className="lab">Charges fixes prorata</div>
                    <div className="val">{fmt(result.totaux.chargesFixesProrata)}</div>
                    <div className="sub">{joursChantier}j × {fmt(result.totaux.chargesFixesMensuelles)}/mois</div>
                  </div>
                  <div className={`rdv-card benef ${result.totaux.beneficeNet < 0 ? 'neg' : ''}`}>
                    <div className="lab">Bénéfice net</div>
                    <div className="val">{fmt(result.totaux.beneficeNet)}</div>
                    <div className="sub">Marge {result.totaux.margePct.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="rdv-section-title">
                  Analyse ligne par ligne ({result.stats.nbMatched}/{result.stats.nbLignes} matchées)
                </div>
                <table className="rdv-table">
                  <thead>
                    <tr>
                      <th>Prestation devis</th>
                      <th>Prix devis</th>
                      <th>Prix marché moyen</th>
                      <th>Écart</th>
                      <th>Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lignesAnalysees.map((l, i) => (
                      <tr key={i} className={l.matched ? '' : 'unmatched'}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{l.description}</div>
                          {l.refPrestation && (
                            <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>≈ {l.refPrestation}</div>
                          )}
                        </td>
                        <td>{fmt(l.priceHT)}/{l.unit}</td>
                        <td>{l.matched ? `${fmt(l.refPrixMoyen!)}/${l.unit}` : '—'}</td>
                        <td>{l.matched ? fmtPct(l.ecartPct!) : '—'}</td>
                        <td>
                          {l.matched ? (
                            <span className="rdv-badge" style={{
                              background: verdictStyles[l.verdict!].bg,
                              color: verdictStyles[l.verdict!].color,
                            }}>{verdictStyles[l.verdict!].label}</span>
                          ) : (
                            <span style={{ fontSize: 10, color: '#999' }}>Non analysé</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        <div className="rdv-foot">
          <button onClick={onClose} type="button">Fermer</button>
        </div>
      </div>
    </div>
  )
}
