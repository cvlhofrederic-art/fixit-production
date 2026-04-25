'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import type { ProductLine } from '@/lib/devis-types'

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

interface Props {
  items: ProductLine[]
  totalHT: number
  totalTTC: number
  corpsMetier?: string
  onClose: () => void
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

export default function RentabiliteDevisModal({ items, totalHT, totalTTC, corpsMetier, onClose }: Props) {
  const [nbPersonnes, setNbPersonnes] = useState<number>(2)
  const [joursChantier, setJoursChantier] = useState<number>(5)
  const [heuresParJour, setHeuresParJour] = useState<number>(8)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyseResult | null>(null)

  async function handleAnalyser() {
    if (!items.length) {
      toast.error('Ajoute au moins une ligne au devis')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/btp/analyser-rentabilite-devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            description: i.description,
            qty: i.qty,
            unit: i.unit,
            priceHT: i.priceHT,
            totalHT: i.totalHT,
          })),
          nbPersonnes,
          joursChantier,
          heuresParJour,
          corpsMetier,
        }),
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
          .rdv-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #F0F0F0; }
          .rdv-h h3 { font-size: 17px; font-weight: 700; margin: 0; }
          .rdv-h .rdv-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; padding: 0 6px; }
          .rdv-form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; padding: 14px; background: #FAFAFA; border-radius: 8px; margin-bottom: 1rem; }
          .rdv-form label { display: block; font-size: 11px; font-weight: 600; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
          .rdv-form input { width: 100%; padding: 8px 10px; border: 1px solid #E0E0E0; border-radius: 6px; font-size: 14px; font-weight: 600; }
          .rdv-form .rdv-btn { padding: 9px 18px; background: #FFC107; border: 1px solid #FFC107; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; color: #1a1a1a; transition: opacity .15s; }
          .rdv-form .rdv-btn:hover:not(:disabled) { opacity: 0.85; }
          .rdv-form .rdv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
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
          .rdv-section-title { font-size: 12px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin: 1rem 0 0.5rem; }
          .rdv-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .rdv-table th { text-align: left; padding: 8px 10px; background: #FAFAFA; font-weight: 600; color: #666; border-bottom: 1px solid #E0E0E0; font-size: 11px; }
          .rdv-table td { padding: 8px 10px; border-bottom: 1px solid #F5F5F5; vertical-align: top; }
          .rdv-table tr.unmatched td { color: #999; font-style: italic; }
          .rdv-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
          .rdv-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid #F0F0F0; }
          .rdv-foot button { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; }
        `}</style>

        <div className="rdv-h">
          <h3>📊 Rentabilité du devis</h3>
          <button className="rdv-close" onClick={onClose} type="button">×</button>
        </div>

        <div className="rdv-form">
          <div>
            <label>Personnes</label>
            <input type="number" min={1} max={50} value={nbPersonnes} onChange={(e) => setNbPersonnes(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div>
            <label>Jours chantier</label>
            <input type="number" min={0.5} max={365} step={0.5} value={joursChantier} onChange={(e) => setJoursChantier(Math.max(0.5, parseFloat(e.target.value) || 1))} />
          </div>
          <div>
            <label>Heures/jour</label>
            <input type="number" min={1} max={14} value={heuresParJour} onChange={(e) => setHeuresParJour(Math.max(1, Math.min(14, parseInt(e.target.value) || 8)))} />
          </div>
          <button className="rdv-btn" onClick={handleAnalyser} disabled={loading} type="button">
            {loading ? 'Analyse...' : 'Analyser'}
          </button>
        </div>

        {!result && !loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
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

        <div className="rdv-foot">
          <button onClick={onClose} type="button">Fermer</button>
        </div>
      </div>
    </div>
  )
}
