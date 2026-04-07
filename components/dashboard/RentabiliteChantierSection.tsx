'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { DollarSign, Settings, HardHat, MapPin, CheckCircle, AlertTriangle, AlertCircle, Boxes, Truck, Hourglass, SlidersHorizontal } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// RENTABILITÉ CHANTIER — Module PRO BTP
// Affiche la rentabilité réelle de chaque chantier en croisant :
// - Situations de travaux (revenus)
// - Pointage employés × coût horaire (main d'œuvre)
// - Dépenses (matériaux, frais annexes)
// - Devis/factures validés
// ═══════════════════════════════════════════════════════════════════════════════

// ── Types internes (miroir des données localStorage) ─────────────────────────

interface Chantier {
  id: string; titre: string; client: string; adresse: string
  dateDebut: string; dateFin: string; budget: string
  statut: 'En attente' | 'En cours' | 'Terminé' | 'Annulé'
  description: string; equipe: string; createdAt: string
}

interface Pointage {
  id: string; employe: string; poste: string; chantier: string
  date: string; heureArrivee: string; heureDepart: string
  pauseMinutes: number; heuresTravaillees: number; notes: string
}

interface Membre {
  id: string; prenom: string; nom: string; telephone: string; email: string
  typeCompte: string; rolePerso: string; equipeId: string; createdAt: string
}

interface Expense {
  id: string; label: string; amount: string | number
  category: string; date: string; notes: string
  chantierId?: string; chantier?: string
}

interface Situation {
  id: string; chantier: string; client: string; numero: number; date: string
  montantMarche: number
  travaux: { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }[]
  statut: string
}

interface SavedDoc {
  id: string; type: string; clientName?: string; totalTTC?: number; totalHT?: number
  status?: string; created_at?: string; chantier?: string
}

// ── Données agrégées par chantier ────────────────────────────────────────────

interface ChantierFinancials {
  chantier: Chantier
  caFacture: number
  caDevis: number
  caTotal: number
  coutMainOeuvre: number
  coutMateriaux: number
  coutAutres: number
  coutTotal: number
  beneficeNet: number
  margePercent: number
  joursPrevu: number
  joursReel: number
  beneficeParJour: number
  projectionMensuelle: number
  seuilRentabiliteJours: number
  score: number
  badge: 'rentable' | 'moyen' | 'a_risque'
  badgeColor: string
  heuresTotal: number
  nbOuvriers: number
}

// ── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_COUT_HORAIRE = 25
const MOIS_JOURS_OUVRES = 22

const EXPENSE_CATEGORIES_MATERIAUX = ['materiel', 'materiaux']
const EXPENSE_CATEGORIES_AUTRES = ['transport', 'outillage', 'assurance', 'formation', 'logiciel', 'telephone', 'comptable', 'publicite', 'bureau', 'autre', 'carburant', 'location']

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0
  const d1 = new Date(a), d2 = new Date(b)
  return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / 86_400_000))
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
}

function fmtPct(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %'
}

function calcScore(marge: number, joursPrevu: number, joursReel: number, benefice: number): number {
  if (benefice <= 0) return Math.max(0, 2 + marge / 10)
  let s = 5
  s += Math.min(3, Math.floor(marge / 5))
  if (joursPrevu > 0) {
    const ratio = joursReel / joursPrevu
    if (ratio <= 1) s += 1
    else if (ratio > 1.2) s -= 1
  }
  if (benefice > 5000) s += 1
  return Math.max(0, Math.min(10, Math.round(s * 10) / 10))
}

function scoreBadge(score: number): { badge: 'rentable' | 'moyen' | 'a_risque'; color: string } {
  if (score >= 7) return { badge: 'rentable', color: '#2E7D32' }
  if (score >= 4) return { badge: 'moyen', color: '#EF6C00' }
  return { badge: 'a_risque', color: '#C62828' }
}

const BADGE_LABELS: Record<string, { fr: string; pt: string; icon: 'check' | 'warn' | 'risk' }> = {
  rentable: { fr: 'Rentable', pt: 'Rentável', icon: 'check' },
  moyen: { fr: 'Moyen', pt: 'Médio', icon: 'warn' },
  a_risque: { fr: 'À risque', pt: 'Em risco', icon: 'risk' },
}

function BadgeIcon({ type, size = 12 }: { type: 'check' | 'warn' | 'risk'; size?: number }) {
  if (type === 'check') return <CheckCircle size={size} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
  if (type === 'warn') return <AlertTriangle size={size} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
  return <AlertCircle size={size} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function RentabiliteChantierSection({ artisan, orgRole }: { artisan: import('@/lib/types').Artisan; orgRole?: string }) {
  const isV5 = orgRole === 'pro_societe'
  const isPt = typeof document !== 'undefined' && document.cookie.includes('locale=pt')
  const t = (fr: string, pt: string) => isPt ? pt : fr

  // ── Config coût horaire par type de poste ──────────────────────────────────
  const [coutsHoraires, setCoutsHoraires] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`fixit_couts_horaires_${artisan?.id}`)
      return saved ? JSON.parse(saved) : {
        ouvrier: 22, chef_chantier: 30, conducteur_travaux: 40, secretaire: 20, gerant: 45,
      }
    } catch { return { ouvrier: 22, chef_chantier: 30, conducteur_travaux: 40, secretaire: 20, gerant: 45 } }
  })

  const saveCoutsHoraires = (c: Record<string, number>) => {
    setCoutsHoraires(c)
    localStorage.setItem(`fixit_couts_horaires_${artisan?.id}`, JSON.stringify(c))
  }

  // ── Chargement des données ─────────────────────────────────────────────────
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [pointages, setPointages] = useState<Pointage[]>([])
  const [membres, setMembres] = useState<Membre[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [situations, setSituations] = useState<Situation[]>([])
  const [documents, setDocuments] = useState<SavedDoc[]>([])

  useEffect(() => {
    if (!artisan?.id) return
    const load = (key: string) => {
      try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
    }
    async function fetchData() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: sess } = await supabase.auth.getSession()
        const authH: Record<string, string> = sess?.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {}
        const [chRes, mbRes, dpRes, ptRes] = await Promise.all([
          fetch('/api/btp?table=chantiers', { headers: authH }),
          fetch('/api/btp?table=membres', { headers: authH }),
          fetch('/api/btp?table=depenses', { headers: authH }),
          fetch('/api/btp?table=pointages', { headers: authH }),
        ])
        const ch = chRes.ok ? await chRes.json() : null
        const mb = mbRes.ok ? await mbRes.json() : null
        const dp = dpRes.ok ? await dpRes.json() : null
        const pt = ptRes.ok ? await ptRes.json() : null
        if (ch?.chantiers?.length) setChantiers(ch.chantiers.map((c: Record<string, unknown>) => ({
          id: c.id, titre: c.titre || c.title || '', client: c.client || '',
          adresse: c.adresse || c.address || '', dateDebut: c.date_debut || c.dateDebut || '',
          dateFin: c.date_fin || c.dateFin || '', budget: String(c.budget || '0'),
          statut: c.statut || c.status || 'En cours', description: c.description || '',
          equipe: c.equipe || '', createdAt: c.created_at || '',
        })))
        else setChantiers(load(`fixit_chantiers_${artisan.id}`))
        if (mb?.membres?.length) setMembres(mb.membres.map((m: Record<string, unknown>) => ({
          id: m.id, prenom: m.prenom || '', nom: m.nom || '', telephone: m.telephone || '',
          email: m.email || '', typeCompte: m.type_compte || m.typeCompte || 'ouvrier',
          rolePerso: m.role_perso || m.rolePerso || '', equipeId: m.equipe_id || '', createdAt: m.created_at || '',
        })))
        else setMembres(load(`fixit_membres_${artisan.id}`))
        if (dp?.depenses?.length) setExpenses(dp.depenses.map((d: Record<string, unknown>) => ({
          id: d.id, label: d.label || '', amount: d.amount || 0, category: d.category || '',
          date: d.date || '', notes: d.notes || '', chantierId: d.chantier_id || '',
        })))
        else setExpenses(load(`fixit_expenses_${artisan.id}`))
        if (pt?.pointages?.length) setPointages(pt.pointages.map((p: Record<string, unknown>) => ({
          id: p.id, employe: p.employe || '', poste: p.poste || '', chantier: p.chantier || p.chantier_id || '',
          date: p.date || '', heureArrivee: p.heure_arrivee || '', heureDepart: p.heure_depart || '',
          pauseMinutes: p.pause_minutes || 0, heuresTravaillees: p.heures_travaillees || 0, notes: p.notes || '',
        })))
        else setPointages(load(`pointage_${artisan.id}`))
      } catch {
        setChantiers(load(`fixit_chantiers_${artisan.id}`))
        setPointages(load(`pointage_${artisan.id}`))
        setMembres(load(`fixit_membres_${artisan.id}`))
        setExpenses(load(`fixit_expenses_${artisan.id}`))
      }
      setSituations(load(`situations_${artisan.id}`))
      setDocuments(load(`fixit_documents_${artisan.id}`))
    }
    fetchData()
  }, [artisan?.id])

  // ── Sélection chantier + simulateur ────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [simJoursExtra, setSimJoursExtra] = useState(0)
  const [simOuvriersExtra, setSimOuvriersExtra] = useState(0)
  const [simCoutExtra, setSimCoutExtra] = useState(0)

  const resetSim = () => { setSimJoursExtra(0); setSimOuvriersExtra(0); setSimCoutExtra(0) }

  // ── Calcul financier par chantier ──────────────────────────────────────────
  const financials: ChantierFinancials[] = useMemo(() => {
    return chantiers
      .filter(ch => ch.statut !== 'Annulé')
      .map(ch => {
        const titre = ch.titre.toLowerCase().trim()
        const sitsCh = situations.filter(s => s.chantier.toLowerCase().trim() === titre)
        const caFacture = sitsCh
          .filter(s => s.statut === 'validée' || s.statut === 'payée')
          .reduce((sum, s) => sum + s.travaux.reduce((t, p) => t + (p.quantite * p.prixUnit * p.avancement / 100), 0), 0)

        const clientLower = ch.client.toLowerCase().trim()
        const docsClient = documents.filter(d =>
          d.clientName?.toLowerCase().trim() === clientLower && (d.type === 'facture' || d.status === 'signé')
        )
        const caDevis = docsClient.reduce((sum, d) => sum + (d.totalHT || d.totalTTC || 0), 0)
        const caTotal = Math.max(caFacture, caDevis, parseFloat(ch.budget) || 0)

        const pointCh = pointages.filter(p => p.chantier.toLowerCase().trim() === titre)
        const heuresTotal = pointCh.reduce((sum, p) => sum + (p.heuresTravaillees || 0), 0)
        const membreMap = new Map(membres.map(m => [`${m.prenom} ${m.nom}`.toLowerCase(), m.typeCompte]))
        const coutMainOeuvre = pointCh.reduce((sum, p) => {
          const type = membreMap.get(p.employe.toLowerCase()) || 'ouvrier'
          const tarif = coutsHoraires[type] || DEFAULT_COUT_HORAIRE
          return sum + (p.heuresTravaillees || 0) * tarif
        }, 0)
        const ouvriersUniques = new Set(pointCh.map(p => p.employe)).size

        const expCh = expenses.filter(e =>
          e.chantierId === ch.id ||
          e.chantier?.toLowerCase().trim() === titre ||
          (e.notes && e.notes.toLowerCase().includes(titre))
        )
        const coutMateriaux = expCh
          .filter(e => EXPENSE_CATEGORIES_MATERIAUX.includes(e.category))
          .reduce((sum, e) => sum + (typeof e.amount === 'string' ? parseFloat(e.amount) || 0 : e.amount), 0)
        const coutAutres = expCh
          .filter(e => EXPENSE_CATEGORIES_AUTRES.includes(e.category) || e.category === 'mainoeuvre')
          .reduce((sum, e) => sum + (typeof e.amount === 'string' ? parseFloat(e.amount) || 0 : e.amount), 0)
        const coutTotal = coutMainOeuvre + coutMateriaux + coutAutres

        const joursPrevu = daysBetween(ch.dateDebut, ch.dateFin)
        const endDate = ch.statut === 'Terminé' ? ch.dateFin : today()
        const joursReel = daysBetween(ch.dateDebut, endDate)

        const beneficeNet = caTotal - coutTotal
        const margePercent = caTotal > 0 ? (beneficeNet / caTotal) * 100 : 0
        const beneficeParJour = joursReel > 0 ? beneficeNet / joursReel : 0
        const projectionMensuelle = beneficeParJour * MOIS_JOURS_OUVRES

        const coutParJour = joursReel > 0 ? coutTotal / joursReel : 0
        const revenuParJour = joursReel > 0 ? caTotal / joursReel : 0
        const seuilRentabiliteJours = revenuParJour > coutParJour
          ? Math.ceil(coutTotal / (revenuParJour - coutParJour))
          : Infinity

        const score = calcScore(margePercent, joursPrevu, joursReel, beneficeNet)
        const { badge, color: badgeColor } = scoreBadge(score)

        return {
          chantier: ch, caFacture, caDevis, caTotal,
          coutMainOeuvre, coutMateriaux, coutAutres, coutTotal,
          beneficeNet, margePercent, joursPrevu, joursReel,
          beneficeParJour, projectionMensuelle, seuilRentabiliteJours,
          score, badge, badgeColor, heuresTotal, nbOuvriers: ouvriersUniques,
        }
      })
      .sort((a, b) => b.beneficeNet - a.beneficeNet)
  }, [chantiers, pointages, membres, expenses, situations, documents, coutsHoraires])

  const selected = financials.find(f => f.chantier.id === selectedId) || null

  const simulated = useMemo(() => {
    if (!selected) return null
    const extraCoutJours = simJoursExtra * (selected.joursReel > 0 ? selected.coutTotal / selected.joursReel : 0)
    const extraCoutOuvriers = simOuvriersExtra * (coutsHoraires.ouvrier || DEFAULT_COUT_HORAIRE) * 8 * (selected.joursReel + simJoursExtra)
    const newCoutTotal = selected.coutTotal + extraCoutJours + extraCoutOuvriers + simCoutExtra
    const newBenefice = selected.caTotal - newCoutTotal
    const newMarge = selected.caTotal > 0 ? (newBenefice / selected.caTotal) * 100 : 0
    const newJours = selected.joursReel + simJoursExtra
    const newBenefParJour = newJours > 0 ? newBenefice / newJours : 0
    const newScore = calcScore(newMarge, selected.joursPrevu, newJours, newBenefice)
    const { badge: newBadge, color: newBadgeColor } = scoreBadge(newScore)
    return { coutTotal: newCoutTotal, benefice: newBenefice, marge: newMarge, jours: newJours, benefParJour: newBenefParJour, score: newScore, badge: newBadge, badgeColor: newBadgeColor }
  }, [selected, simJoursExtra, simOuvriersExtra, simCoutExtra, coutsHoraires])

  const totals = useMemo(() => {
    const ca = financials.reduce((s, f) => s + f.caTotal, 0)
    const cout = financials.reduce((s, f) => s + f.coutTotal, 0)
    const benef = ca - cout
    const marge = ca > 0 ? (benef / ca) * 100 : 0
    const rentables = financials.filter(f => f.badge === 'rentable').length
    const risque = financials.filter(f => f.badge === 'a_risque').length
    return { ca, cout, benef, marge, rentables, risque, total: financials.length }
  }, [financials])

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div>
      {/* Header + bouton config */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
          <h1>{t('Rentabilité Chantier', 'Rentabilidade da Obra')}</h1>
          <p>{t('Budget prévu vs réalisé', 'Orçamento previsto vs realizado')}</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={isV5 ? 'v5-btn' : 'v22-btn'}
        >
          <Settings size={14} />{t('Coûts horaires', 'Custos por hora')}
        </button>
      </div>

      {showConfig && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
          <div className={isV5 ? 'v5-st' : 'v22-section-title'}>
            {t('Coût horaire par type de poste (€/h)', 'Custo por hora por tipo de posto (€/h)')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {Object.entries({ ouvrier: t('Ouvrier', 'Operário'), chef_chantier: t('Chef de chantier', 'Encarregado'), conducteur_travaux: t('Conducteur', 'Diretor de obra'), secretaire: t('Secrétaire', 'Secretária'), gerant: t('Gérant', 'Gerente') }).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'} style={{ minWidth: 100, marginBottom: 0 }}>{label}</label>
                <input
                  type="number" min={0} max={200}
                  value={coutsHoraires[key] || 0}
                  onChange={e => saveCoutsHoraires({ ...coutsHoraires, [key]: parseFloat(e.target.value) || 0 })}
                  className={isV5 ? 'v5-fi' : 'v22-input'}
                  style={{ width: 70, textAlign: 'right' }}
                />
                <span style={{ fontSize: 11, color: '#999' }}>&euro;/h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUCUN CHANTIER ────────────────────────────────────────────────── */}
      {chantiers.length === 0 && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 48, textAlign: 'center' }}>
          <HardHat size={40} style={{ color: '#BBB', marginBottom: 12 }} />
          <p style={{ color: '#999', fontSize: 12 }}>
            {t('Créez vos chantiers dans la section "Chantiers" pour voir leur rentabilité.', 'Crie as suas obras na secção "Obras" para ver a rentabilidade.')}
          </p>
        </div>
      )}

      {/* ── KPI GLOBAUX ───────────────────────────────────────────────────── */}
      {financials.length > 0 && !selectedId && (
        <>
          <div className={isV5 ? 'v5-kpi-g' : 'v22-kpi-grid'}>
            <div className={isV5 ? 'v5-kpi hl' : 'v22-kpi v22-kpi-hl'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('CA Total', 'Volume Total')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'}>{fmt(totals.ca)} &euro;</div>
              <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'}>{totals.total} {t('chantiers', 'obras')}</div>
            </div>
            <div className={isV5 ? 'v5-kpi' : 'v22-kpi'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('Bénéfice Net', 'Lucro Líquido')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'} style={{ color: totals.benef >= 0 ? '#2E7D32' : '#C62828' }}>{fmt(totals.benef)} &euro;</div>
              <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'}>{fmtPct(totals.marge)}</div>
            </div>
            <div className={isV5 ? 'v5-kpi' : 'v22-kpi'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('Rentables', 'Rentáveis')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'}>{totals.rentables}/{totals.total}</div>
              <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'}>{totals.risque > 0 ? `${totals.risque} ${t('à risque', 'em risco')}` : t('Tous ok', 'Todos ok')}</div>
            </div>
            <div className={isV5 ? 'v5-kpi' : 'v22-kpi'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('Marge moyenne', 'Margem média')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'} style={{ color: totals.marge >= 15 ? '#2E7D32' : totals.marge >= 5 ? '#EF6C00' : '#C62828' }}>{fmtPct(totals.marge)}</div>
            </div>
          </div>

          {/* ── COMPARATIF BUDGÉTAIRE (table v5) ──────────────────────────── */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ overflow: 'auto', marginBottom: 16 }}>
            <div className={isV5 ? 'v5-st' : 'v22-section-title'}>{t('Comparatif budgétaire', 'Comparativo orçamental')}</div>
            <table className={isV5 ? 'v5-dt' : 'v22-table'}>
              <thead>
                <tr>
                  <th>{t('Chantier', 'Obra')}</th>
                  <th>{t('Budget prévu', 'Orçamento previsto')}</th>
                  <th>{t('Réalisé', 'Realizado')}</th>
                  <th>{t('Écart', 'Desvio')}</th>
                  <th>{t('Marge prév.', 'Margem prev.')}</th>
                  <th>{t('Marge réelle', 'Margem real')}</th>
                </tr>
              </thead>
              <tbody>
                {financials.map(f => {
                  const ecart = f.coutTotal - (parseFloat(f.chantier.budget) || 0)
                  const isOverBudget = ecart > 0
                  return (
                    <tr key={f.chantier.id} onClick={() => { setSelectedId(f.chantier.id); resetSim() }} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600, color: isOverBudget ? '#C62828' : undefined }}>
                        {f.chantier.titre}{isOverBudget ? ' ⚠️' : ''}
                      </td>
                      <td>{fmt(parseFloat(f.chantier.budget) || 0)} &euro;</td>
                      <td>{fmt(f.coutTotal)} &euro;</td>
                      <td style={{ color: isOverBudget ? '#C62828' : '#2E7D32', fontWeight: isOverBudget ? 600 : 400 }}>
                        {isOverBudget ? '+' : ''}{fmt(ecart)} &euro;{isOverBudget ? ' dépasst' : ''}
                      </td>
                      <td>—</td>
                      <td style={{ fontWeight: 600, color: f.margePercent >= 15 ? '#2E7D32' : f.margePercent >= 5 ? '#EF6C00' : '#C62828' }}>
                        {fmtPct(f.margePercent)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── BAR CHART ──────────────────────────────────────────────────── */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
            <div className={isV5 ? 'v5-st' : 'v22-section-title'}>{t('Budget prévu vs réalisé', 'Orçamento previsto vs realizado')}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160, padding: '0 8px' }}>
              {financials.slice(0, 6).map(f => {
                const budget = parseFloat(f.chantier.budget) || 0
                const maxVal = Math.max(...financials.slice(0, 6).map(x => Math.max(parseFloat(x.chantier.budget) || 0, x.coutTotal)))
                const budgetH = maxVal > 0 ? (budget / maxVal) * 130 : 0
                const realH = maxVal > 0 ? (f.coutTotal / maxVal) * 130 : 0
                const isOver = f.coutTotal > budget
                return (
                  <div key={f.chantier.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 130 }}>
                      <div style={{ width: 18, height: budgetH, background: '#FFD54F', borderRadius: '3px 3px 0 0', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>{fmt(budget / 1000)}k</span>
                      </div>
                      <div style={{ width: 18, height: realH, background: isOver ? '#EF5350' : '#FFA726', borderRadius: '3px 3px 0 0', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>{fmt(f.coutTotal / 1000)}k{isOver ? ' ⚠️' : ''}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#999', textAlign: 'center' }}>{f.chantier.titre.slice(0, 10)}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 8 }}>
              {t('🟡 Budget prévu  •  🟠 Réalisé  •  🔴 Dépassement', '🟡 Orçamento previsto  •  🟠 Realizado  •  🔴 Ultrapassado')}
            </div>
          </div>

          {/* ── LISTE DES CHANTIERS (cards) ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {financials.map(f => (
              <div
                key={f.chantier.id}
                className={isV5 ? 'v5-card' : 'v22-card'}
                onClick={() => { setSelectedId(f.chantier.id); resetSim() }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${f.badgeColor}` }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: f.badgeColor + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 16, color: f.badgeColor, flexShrink: 0,
                }}>
                  {f.score}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.chantier.titre}</div>
                  <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>
                    {f.chantier.adresse || f.chantier.client} · {f.chantier.statut}
                    {f.joursReel > 0 && ` · ${f.joursReel}j`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: f.beneficeNet >= 0 ? '#2E7D32' : '#C62828' }}>
                    {f.beneficeNet >= 0 ? '+' : ''}{fmt(f.beneficeNet)} &euro;
                  </div>
                  <div style={{ fontSize: 10, color: '#999' }}>
                    {fmtPct(f.margePercent)} · {fmt(f.caTotal)} &euro; CA
                  </div>
                </div>
                <span className={isV5 ? `v5-badge ${f.badge === 'rentable' ? 'v5-badge-green' : f.badge === 'moyen' ? 'v5-badge-orange' : 'v5-badge-red'}` : `v22-tag ${f.badge === 'rentable' ? 'v22-tag-green' : f.badge === 'moyen' ? 'v22-tag-orange' : 'v22-tag-red'}`}>
                  {BADGE_LABELS[f.badge] && <BadgeIcon type={BADGE_LABELS[f.badge].icon} />}{BADGE_LABELS[f.badge]?.[isPt ? 'pt' : 'fr']}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── VUE DÉTAILLÉE D'UN CHANTIER ─────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {selected && (
        <div>
          <button onClick={() => { setSelectedId(null); resetSim() }} className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ marginBottom: 12 }}>
            &larr; {t('Retour aux chantiers', 'Voltar às obras')}
          </button>

          {/* En-tête chantier */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selected.chantier.titre}</div>
              <div style={{ color: '#999', fontSize: 12 }}>
                {selected.chantier.client} · {selected.chantier.adresse}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: selected.badgeColor + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 20, color: selected.badgeColor,
              }}>
                {selected.score}
              </div>
              <span className={isV5 ? `v5-badge ${selected.badge === 'rentable' ? 'v5-badge-green' : selected.badge === 'moyen' ? 'v5-badge-orange' : 'v5-badge-red'}` : `v22-tag ${selected.badge === 'rentable' ? 'v22-tag-green' : selected.badge === 'moyen' ? 'v22-tag-orange' : 'v22-tag-red'}`}>
                {BADGE_LABELS[selected.badge] && <BadgeIcon type={BADGE_LABELS[selected.badge].icon} />}{BADGE_LABELS[selected.badge]?.[isPt ? 'pt' : 'fr']}
              </span>
            </div>
          </div>

          {/* ── 4 KPI CARDS ──────────────────────────────────────────────── */}
          <div className={isV5 ? 'v5-kpi-g' : 'v22-kpi-grid'}>
            <div className={isV5 ? 'v5-kpi hl' : 'v22-kpi v22-kpi-hl'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('Bénéfice net', 'Lucro líquido')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'} style={{ color: selected.beneficeNet >= 0 ? '#2E7D32' : '#C62828' }}>
                {selected.beneficeNet >= 0 ? '+' : ''}{fmt(selected.beneficeNet)} &euro;
              </div>
              <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'}>{fmtPct(selected.margePercent)} {t('de marge', 'de margem')}</div>
            </div>
            <div className={isV5 ? 'v5-kpi' : 'v22-kpi'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('Durée chantier', 'Duração da obra')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'}>{selected.joursReel}j / {selected.joursPrevu}j</div>
              <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'}>{selected.joursReel > selected.joursPrevu
                ? `+${selected.joursReel - selected.joursPrevu}j ${t('de retard', 'de atraso')}`
                : t('Dans les temps', 'Dentro do prazo')}</div>
            </div>
            <div className={isV5 ? 'v5-kpi' : 'v22-kpi'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('Bénéfice / jour', 'Lucro / dia')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'}>{fmt(selected.beneficeParJour)} &euro;</div>
              <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'}>{t('par jour ouvré', 'por dia útil')}</div>
            </div>
            <div className={isV5 ? 'v5-kpi' : 'v22-kpi'}>
              <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{t('Projection mensuelle', 'Projeção mensal')}</div>
              <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'}>{fmt(selected.projectionMensuelle)} &euro;</div>
              <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'}>{MOIS_JOURS_OUVRES}j {t('ouvrés/mois', 'úteis/mês')}</div>
            </div>
          </div>

          {/* ── TABLEAU CENTRAL ─────────────────────────────────────────── */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ overflow: 'auto', marginBottom: 16 }}>
            <table className={isV5 ? 'v5-dt' : 'v22-table'}>
              <thead>
                <tr>
                  <th>{t('Élément', 'Elemento')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Montant', 'Montante')}</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><DollarSign size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t("Chiffre d'affaires", 'Volume de negócios')}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#1565C0' }}>{fmt(selected.caTotal)} &euro;</td>
                  <td style={{ textAlign: 'right', color: '#999' }}>100%</td>
                </tr>
                <tr>
                  <td><HardHat size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t("Main d'œuvre", 'Mão de obra')} <span style={{ color: '#999', fontSize: 10 }}>({fmt(selected.heuresTotal)}h · {selected.nbOuvriers} {t('pers.', 'pess.')})</span></td>
                  <td style={{ textAlign: 'right', color: '#C62828' }}>- {fmt(selected.coutMainOeuvre)} &euro;</td>
                  <td style={{ textAlign: 'right', color: '#999' }}>{selected.caTotal > 0 ? fmtPct(selected.coutMainOeuvre / selected.caTotal * 100) : '—'}</td>
                </tr>
                <tr>
                  <td><Boxes size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('Matériaux', 'Materiais')}</td>
                  <td style={{ textAlign: 'right', color: '#C62828' }}>- {fmt(selected.coutMateriaux)} &euro;</td>
                  <td style={{ textAlign: 'right', color: '#999' }}>{selected.caTotal > 0 ? fmtPct(selected.coutMateriaux / selected.caTotal * 100) : '—'}</td>
                </tr>
                <tr>
                  <td><Truck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('Autres frais', 'Outros custos')}</td>
                  <td style={{ textAlign: 'right', color: '#C62828' }}>- {fmt(selected.coutAutres)} &euro;</td>
                  <td style={{ textAlign: 'right', color: '#999' }}>{selected.caTotal > 0 ? fmtPct(selected.coutAutres / selected.caTotal * 100) : '—'}</td>
                </tr>
                <tr style={{ background: selected.beneficeNet >= 0 ? '#E8F5E9' : '#FFEBEE', fontWeight: 600 }}>
                  <td>{selected.beneficeNet >= 0 ? <CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> : <AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: '#C62828' }} />}{t('BÉNÉFICE NET', 'LUCRO LÍQUIDO')}</td>
                  <td style={{ textAlign: 'right', color: selected.beneficeNet >= 0 ? '#2E7D32' : '#C62828' }}>
                    {selected.beneficeNet >= 0 ? '+' : ''}{fmt(selected.beneficeNet)} &euro;
                  </td>
                  <td style={{ textAlign: 'right', color: selected.beneficeNet >= 0 ? '#2E7D32' : '#C62828' }}>
                    {fmtPct(selected.margePercent)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── SEUIL DE RENTABILITÉ ─────────────────────────────────────── */}
          {selected.seuilRentabiliteJours !== Infinity && (
            <div className={isV5 ? `v5-al ${selected.joursReel >= selected.seuilRentabiliteJours ? 'info' : 'warn'}` : `v22-alert ${selected.joursReel >= selected.seuilRentabiliteJours ? 'v22-alert-blue' : 'v22-alert-amber'}`} style={{ marginBottom: 16 }}>
              {selected.joursReel >= selected.seuilRentabiliteJours ? <CheckCircle size={14} /> : <Hourglass size={14} />}
              <div>
                <strong>{t('Seuil de rentabilité', 'Limiar de rentabilidade')} : {selected.seuilRentabiliteJours} {t('jours', 'dias')}</strong>
                <div style={{ fontSize: 11 }}>
                  {selected.joursReel >= selected.seuilRentabiliteJours
                    ? t(`Atteint au jour ${selected.seuilRentabiliteJours} — vous êtes en zone de profit`, `Atingido no dia ${selected.seuilRentabiliteJours} — está em zona de lucro`)
                    : t(`Encore ${selected.seuilRentabiliteJours - selected.joursReel} jours avant d'être rentable`, `Ainda ${selected.seuilRentabiliteJours - selected.joursReel} dias para ser rentável`)}
                </div>
              </div>
            </div>
          )}

          {/* ── BARRE DE PROGRESSION ────────────────────────────────────── */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
            <div className={isV5 ? 'v5-st' : 'v22-section-title'}>{t('Répartition des coûts', 'Distribuição de custos')}</div>
            <div className={isV5 ? 'v5-prog-row' : 'v22-progress-row'} style={{ height: 28, borderRadius: 6, overflow: 'hidden', background: '#E8E8E8' }}>
              {selected.coutTotal > 0 ? (
                <>
                  <div style={{ width: `${(selected.coutMainOeuvre / selected.coutTotal) * 100}%`, background: '#42A5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600, minWidth: 30 }}>
                    {Math.round((selected.coutMainOeuvre / selected.coutTotal) * 100)}%
                  </div>
                  <div style={{ width: `${(selected.coutMateriaux / selected.coutTotal) * 100}%`, background: '#FFA726', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600, minWidth: 30 }}>
                    {Math.round((selected.coutMateriaux / selected.coutTotal) * 100)}%
                  </div>
                  <div style={{ width: `${(selected.coutAutres / selected.coutTotal) * 100}%`, background: '#AB47BC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600, minWidth: 30 }}>
                    {Math.round((selected.coutAutres / selected.coutTotal) * 100)}%
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 11 }}>
                  {t('Aucun coût enregistré', 'Nenhum custo registado')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: '#999' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#42A5F5', marginRight: 4, verticalAlign: 'middle' }} />{t("Main d'œuvre", 'Mão de obra')}</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#FFA726', marginRight: 4, verticalAlign: 'middle' }} />{t('Matériaux', 'Materiais')}</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#AB47BC', marginRight: 4, verticalAlign: 'middle' }} />{t('Autres', 'Outros')}</span>
            </div>
          </div>

          {/* ── SIMULATEUR ────────────────────────────────────────────────── */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: 16 }}>
            <div className={isV5 ? 'v5-st' : 'v22-section-title'}><SlidersHorizontal size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{t('Simulateur "Et si..."', 'Simulador "E se..."')}</div>
            <p style={{ color: '#999', fontSize: 11, marginTop: 0, marginBottom: 14 }}>
              {t("Testez l'impact de changements sur votre rentabilité", 'Teste o impacto de mudanças na sua rentabilidade')}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('Jours supplémentaires', 'Dias adicionais')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={0} max={30} value={simJoursExtra} onChange={e => setSimJoursExtra(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1565C0', minWidth: 36, textAlign: 'center' }}>+{simJoursExtra}j</span>
                </div>
              </div>
              <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('Ouvriers en plus', 'Operários adicionais')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="range" min={0} max={10} value={simOuvriersExtra} onChange={e => setSimOuvriersExtra(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1565C0', minWidth: 36, textAlign: 'center' }}>+{simOuvriersExtra}</span>
                </div>
              </div>
              <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('Coût imprévu (€)', 'Custo extra (€)')}</label>
                <input
                  type="number" min={0} value={simCoutExtra}
                  onChange={e => setSimCoutExtra(parseFloat(e.target.value) || 0)}
                  className={isV5 ? 'v5-fi' : 'v22-input'}
                />
              </div>
            </div>

            {simulated && (simJoursExtra > 0 || simOuvriersExtra > 0 || simCoutExtra > 0) && (
              <div className={isV5 ? 'v5-kpi-g' : 'v22-kpi-grid'} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <SimKpi label={t('Bénéfice', 'Lucro')} before={`${fmt(selected.beneficeNet)} €`} after={`${fmt(simulated.benefice)} €`} isGood={simulated.benefice >= selected.beneficeNet} />
                <SimKpi label={t('Marge', 'Margem')} before={fmtPct(selected.margePercent)} after={fmtPct(simulated.marge)} isGood={simulated.marge >= selected.margePercent} />
                <SimKpi label={t('Bénéf/jour', 'Lucro/dia')} before={`${fmt(selected.beneficeParJour)} €`} after={`${fmt(simulated.benefParJour)} €`} isGood={simulated.benefParJour >= selected.beneficeParJour} />
                <div className={isV5 ? 'v5-kpi' : 'v22-kpi'} style={{ textAlign: 'center' }}>
                  <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>Score</div>
                  <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'} style={{ color: simulated.badgeColor }}>{simulated.score}</div>
                  <div className={isV5 ? 'v5-kpi-s' : 'v22-kpi-sub'} style={{ color: simulated.badgeColor, fontWeight: 600 }}>
                    {BADGE_LABELS[simulated.badge] && <BadgeIcon type={BADGE_LABELS[simulated.badge].icon} />}{BADGE_LABELS[simulated.badge]?.[isPt ? 'pt' : 'fr']}
                  </div>
                </div>
              </div>
            )}

            {(simJoursExtra > 0 || simOuvriersExtra > 0 || simCoutExtra > 0) && (
              <button onClick={resetSim} className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ marginTop: 10 }}>
                &larr; {t('Réinitialiser', 'Reiniciar')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SimKpi({ label, before, after, isGood }: { label: string; before: string; after: string; isGood: boolean }) {
  return (
    <div className={isV5 ? 'v5-kpi' : 'v22-kpi'} style={{ textAlign: 'center' }}>
      <div className={isV5 ? 'v5-kpi-l' : 'v22-kpi-label'}>{label}</div>
      <div style={{ fontSize: 11, color: '#999', textDecoration: 'line-through' }}>{before}</div>
      <div className={isV5 ? 'v5-kpi-v' : 'v22-kpi-value'} style={{ fontSize: 18, color: isGood ? '#2E7D32' : '#C62828' }}>
        {isGood ? '↑' : '↓'} {after}
      </div>
    </div>
  )
}
