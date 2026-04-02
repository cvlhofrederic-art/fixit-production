'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Trimestre = 'T1' | 'T2' | 'T3' | 'T4'

type EtatPaiement = 'paye' | 'en_retard' | 'impaye'

interface Lot {
  id: string
  numero: string
  etage: string
  type: 'appartement' | 'commerce' | 'parking' | 'cave'
}

interface Coproprietaire {
  id: string
  nom: string
  prenom: string
  email: string
  lots: Lot[]
  tantiemes: number
  tantièmesAscenseur: number
  tantièmesChauffage: number
}

interface AppelFonds {
  id: string
  coproId: string
  trimestre: Trimestre
  annee: number
  chargeGenerale: number
  chargeSpeciale: number
  fondsTravaux: number
  total: number
  etat: EtatPaiement
  datePaiement?: string
  dateEmission: string
}

interface Paiement {
  id: string
  coproId: string
  date: string
  montant: number
  trimestre: Trimestre
  annee: number
  type: 'charge' | 'regularisation' | 'fonds_travaux'
  reference: string
}

interface BudgetAG {
  dateAG: string
  resolution: string
  budgetAnnuel: number
  fondsTravaux: number
  fondsTravauxtPct: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const TRIMESTRES: Trimestre[] = ['T1', 'T2', 'T3', 'T4']
const TRIM_DATES: Record<Trimestre, string> = {
  T1: '1er janvier',
  T2: '1er avril',
  T3: '1er juillet',
  T4: '1er octobre',
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const formatEurInt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const formatDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

function generateDemoData(uid: string) {
  const copros: Coproprietaire[] = [
    { id: 'c1', nom: 'Dupont', prenom: 'Marie', email: 'marie.dupont@email.fr', lots: [{ id: 'l1', numero: 'A-101', etage: '1er', type: 'appartement' }], tantiemes: 85, tantièmesAscenseur: 90, tantièmesChauffage: 80 },
    { id: 'c2', nom: 'Martin', prenom: 'Jean', email: 'j.martin@email.fr', lots: [{ id: 'l2', numero: 'A-202', etage: '2e', type: 'appartement' }, { id: 'l3', numero: 'P-03', etage: 'SS', type: 'parking' }], tantiemes: 120, tantièmesAscenseur: 110, tantièmesChauffage: 115 },
    { id: 'c3', nom: 'Bernard', prenom: 'Sophie', email: 's.bernard@email.fr', lots: [{ id: 'l4', numero: 'B-301', etage: '3e', type: 'appartement' }], tantiemes: 95, tantièmesAscenseur: 100, tantièmesChauffage: 90 },
    { id: 'c4', nom: 'Petit', prenom: 'Luc', email: 'luc.petit@email.fr', lots: [{ id: 'l5', numero: 'A-102', etage: '1er', type: 'appartement' }], tantiemes: 80, tantièmesAscenseur: 85, tantièmesChauffage: 75 },
    { id: 'c5', nom: 'Leroy', prenom: 'Claire', email: 'c.leroy@email.fr', lots: [{ id: 'l6', numero: 'B-401', etage: '4e', type: 'appartement' }, { id: 'l7', numero: 'C-01', etage: 'RDC', type: 'cave' }], tantiemes: 110, tantièmesAscenseur: 120, tantièmesChauffage: 105 },
    { id: 'c6', nom: 'Moreau', prenom: 'Pierre', email: 'p.moreau@email.fr', lots: [{ id: 'l8', numero: 'A-501', etage: '5e', type: 'appartement' }], tantiemes: 100, tantièmesAscenseur: 105, tantièmesChauffage: 95 },
    { id: 'c7', nom: 'Laurent', prenom: 'Anne', email: 'a.laurent@email.fr', lots: [{ id: 'l9', numero: 'B-201', etage: '2e', type: 'appartement' }], tantiemes: 90, tantièmesAscenseur: 95, tantièmesChauffage: 85 },
    { id: 'c8', nom: 'Garcia', prenom: 'Carlos', email: 'c.garcia@email.fr', lots: [{ id: 'l10', numero: 'RDC-01', etage: 'RDC', type: 'commerce' }], tantiemes: 150, tantièmesAscenseur: 0, tantièmesChauffage: 140 },
    { id: 'c9', nom: 'Roux', prenom: 'Isabelle', email: 'i.roux@email.fr', lots: [{ id: 'l11', numero: 'A-302', etage: '3e', type: 'appartement' }], tantiemes: 85, tantièmesAscenseur: 90, tantièmesChauffage: 80 },
    { id: 'c10', nom: 'Fournier', prenom: 'Thomas', email: 't.fournier@email.fr', lots: [{ id: 'l12', numero: 'B-102', etage: '1er', type: 'appartement' }, { id: 'l13', numero: 'P-07', etage: 'SS', type: 'parking' }], tantiemes: 105, tantièmesAscenseur: 100, tantièmesChauffage: 100 },
  ]

  const totalTantiemes = copros.reduce((s, c) => s + c.tantiemes, 0)
  const budgetAG: BudgetAG = {
    dateAG: `${CURRENT_YEAR}-03-15`,
    resolution: `R\u00e9solution n\u00b04 - Budget pr\u00e9visionnel ${CURRENT_YEAR}`,
    budgetAnnuel: 48000,
    fondsTravaux: 2880,
    fondsTravauxtPct: 6,
  }

  const totalAnnuel = budgetAG.budgetAnnuel + budgetAG.fondsTravaux
  const chargeSpecialeAnnuelle = 12000
  const chargeGeneraleAnnuelle = budgetAG.budgetAnnuel - chargeSpecialeAnnuelle
  const totalAscenseur = copros.reduce((s, c) => s + c.tantièmesAscenseur, 0)

  const etats: EtatPaiement[] = ['paye', 'paye', 'paye', 'en_retard', 'paye', 'impaye', 'paye', 'paye', 'en_retard', 'paye']

  const appels: AppelFonds[] = []
  const paiements: Paiement[] = []

  copros.forEach((c, idx) => {
    const cg = (c.tantiemes / totalTantiemes) * chargeGeneraleAnnuelle / 4
    const cs = totalAscenseur > 0 ? (c.tantièmesAscenseur / totalAscenseur) * chargeSpecialeAnnuelle / 4 : 0
    const ft = (c.tantiemes / totalTantiemes) * budgetAG.fondsTravaux / 4

    const etat = etats[idx] || 'paye'
    const appel: AppelFonds = {
      id: `af-${c.id}-T1-${CURRENT_YEAR}`,
      coproId: c.id,
      trimestre: 'T1',
      annee: CURRENT_YEAR,
      chargeGenerale: Math.round(cg * 100) / 100,
      chargeSpeciale: Math.round(cs * 100) / 100,
      fondsTravaux: Math.round(ft * 100) / 100,
      total: Math.round((cg + cs + ft) * 100) / 100,
      etat,
      dateEmission: `${CURRENT_YEAR}-01-01`,
      datePaiement: etat === 'paye' ? `${CURRENT_YEAR}-01-15` : undefined,
    }
    appels.push(appel)

    if (etat === 'paye') {
      paiements.push({
        id: `p-${c.id}-T1`,
        coproId: c.id,
        date: `${CURRENT_YEAR}-01-15`,
        montant: appel.total,
        trimestre: 'T1',
        annee: CURRENT_YEAR,
        type: 'charge',
        reference: `VIR-${c.nom.toUpperCase()}-T1`,
      })
    }
  })

  return { copros, appels, paiements, budgetAG }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppelsFondsSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'demo'
  const STORAGE_KEY = `fixit_appels_fr_${uid}`

  type Tab = 'appels' | 'simulateur' | 'individuel' | 'rapport'
  const [activeTab, setActiveTab] = useState<Tab>('appels')
  const [trimestre, setTrimestre] = useState<Trimestre>('T1')

  // ── State ──
  const [copros, setCopros] = useState<Coproprietaire[]>([])
  const [appels, setAppels] = useState<AppelFonds[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [budgetAG, setBudgetAG] = useState<BudgetAG>({
    dateAG: '',
    resolution: '',
    budgetAnnuel: 48000,
    fondsTravaux: 2880,
    fondsTravauxtPct: 6,
  })

  // ── Simulateur ──
  const [simBudget, setSimBudget] = useState(48000)
  const [simFondsPct, setSimFondsPct] = useState(6)

  // ── Etat individuel ──
  const [selectedCoproId, setSelectedCoproId] = useState<string>('')
  const [pdfLoading, setPdfLoading] = useState(false)

  // ── Load/save ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        setCopros(data.copros || [])
        setAppels(data.appels || [])
        setPaiements(data.paiements || [])
        setBudgetAG(data.budgetAG || {})
        if (data.copros?.length) setSelectedCoproId(data.copros[0].id)
      } else {
        const demo = generateDemoData(uid)
        setCopros(demo.copros)
        setAppels(demo.appels)
        setPaiements(demo.paiements)
        setBudgetAG(demo.budgetAG)
        setSelectedCoproId(demo.copros[0].id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      const demo = generateDemoData(uid)
      setCopros(demo.copros)
      setAppels(demo.appels)
      setPaiements(demo.paiements)
      setBudgetAG(demo.budgetAG)
      setSelectedCoproId(demo.copros[0].id)
    }
  }, [STORAGE_KEY, uid])

  const saveAll = useCallback((c: Coproprietaire[], a: AppelFonds[], p: Paiement[], b: BudgetAG) => {
    setCopros(c); setAppels(a); setPaiements(p); setBudgetAG(b)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ copros: c, appels: a, paiements: p, budgetAG: b }))
  }, [STORAGE_KEY])

  // ── Computed ──
  const totalTantiemes = useMemo(() => copros.reduce((s, c) => s + c.tantiemes, 0), [copros])
  const totalAscenseur = useMemo(() => copros.reduce((s, c) => s + c.tantièmesAscenseur, 0), [copros])
  const trimestriel = budgetAG.budgetAnnuel / 4
  const fondsTrimestre = budgetAG.fondsTravaux / 4

  const appelsForTrim = useMemo(() =>
    appels.filter(a => a.trimestre === trimestre && a.annee === CURRENT_YEAR),
    [appels, trimestre]
  )

  // ── Generate calls for a trimester ──
  const genererAppels = (t: Trimestre) => {
    const chargeSpecialeAnnuelle = 12000
    const chargeGeneraleAnnuelle = budgetAG.budgetAnnuel - chargeSpecialeAnnuelle
    const existing = appels.filter(a => !(a.trimestre === t && a.annee === CURRENT_YEAR))

    const newAppels = copros.map(c => {
      const cg = (c.tantiemes / totalTantiemes) * chargeGeneraleAnnuelle / 4
      const cs = totalAscenseur > 0 ? (c.tantièmesAscenseur / totalAscenseur) * chargeSpecialeAnnuelle / 4 : 0
      const ft = (c.tantiemes / totalTantiemes) * budgetAG.fondsTravaux / 4
      return {
        id: `af-${c.id}-${t}-${CURRENT_YEAR}`,
        coproId: c.id,
        trimestre: t,
        annee: CURRENT_YEAR,
        chargeGenerale: Math.round(cg * 100) / 100,
        chargeSpeciale: Math.round(cs * 100) / 100,
        fondsTravaux: Math.round(ft * 100) / 100,
        total: Math.round((cg + cs + ft) * 100) / 100,
        etat: 'impaye' as EtatPaiement,
        dateEmission: new Date().toISOString().split('T')[0],
      }
    })

    const merged = [...existing, ...newAppels]
    saveAll(copros, merged, paiements, budgetAG)
  }

  const marquerPaye = (appelId: string) => {
    const updated = appels.map(a =>
      a.id === appelId ? { ...a, etat: 'paye' as EtatPaiement, datePaiement: new Date().toISOString().split('T')[0] } : a
    )
    const appel = appels.find(a => a.id === appelId)
    let newPaiements = paiements
    if (appel) {
      const copro = copros.find(c => c.id === appel.coproId)
      newPaiements = [...paiements, {
        id: `p-${Date.now()}`,
        coproId: appel.coproId,
        date: new Date().toISOString().split('T')[0],
        montant: appel.total,
        trimestre: appel.trimestre,
        annee: appel.annee,
        type: 'charge' as const,
        reference: `VIR-${copro?.nom.toUpperCase() || 'X'}-${appel.trimestre}`,
      }]
    }
    saveAll(copros, updated, newPaiements, budgetAG)
  }

  // ── Etat badge ──
  const etatBadge = (e: EtatPaiement) => {
    const cfg: Record<EtatPaiement, { bg: string; color: string; label: string }> = {
      paye: { bg: '#E6F4E6', color: '#1A7A3A', label: 'Pay\u00e9' },
      en_retard: { bg: '#FEF5E4', color: '#D4830A', label: 'En retard' },
      impaye: { bg: '#FDECEA', color: '#C0392B', label: 'Impay\u00e9' },
    }
    const c = cfg[e]
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>
  }

  // ── Tab nav style ──
  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      onClick={() => setActiveTab(t)}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: activeTab === t ? '2px solid var(--sd-gold, #C9A84C)' : '1px solid var(--sd-border, #E4DDD0)',
        background: activeTab === t ? 'var(--sd-navy, #0D1B2E)' : '#fff',
        color: activeTab === t ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  // ── PDF individuel (pré-état daté) ──
  const exportPdfIndividuel = async (coproId: string) => {
    const copro = copros.find(c => c.id === coproId)
    if (!copro) return
    setPdfLoading(true)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210; const M = 20
    let y = 20

    // Header
    doc.setFillColor(13, 27, 46)
    doc.rect(0, 0, W, 40, 'F')
    doc.setTextColor(201, 168, 76)
    doc.setFontSize(14); doc.setFont('helvetica', 'bold')
    doc.text('\u00c9TAT INDIVIDUEL DES CHARGES', W / 2, 16, { align: 'center' })
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`${copro.prenom} ${copro.nom} \u2014 Lot(s) : ${copro.lots.map(l => l.numero).join(', ')}`, W / 2, 26, { align: 'center' })
    doc.text(`Tanti\u00e8mes g\u00e9n\u00e9raux : ${copro.tantiemes}/${totalTantiemes} \u2014 Ann\u00e9e ${CURRENT_YEAR}`, W / 2, 34, { align: 'center' })
    y = 50

    // Historique appels
    doc.setTextColor(13, 27, 46)
    doc.setFontSize(11); doc.setFont('helvetica', 'bold')
    doc.text('HISTORIQUE DES APPELS', M, y); y += 8

    const coproAppels = appels.filter(a => a.coproId === coproId)
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80)
    doc.text('TRIMESTRE', M, y)
    doc.text('G\u00c9N\u00c9RALE', M + 35, y)
    doc.text('SP\u00c9CIALE', M + 65, y)
    doc.text('FONDS TRAV.', M + 95, y)
    doc.text('TOTAL', M + 125, y)
    doc.text('\u00c9TAT', M + 150, y)
    y += 6

    coproAppels.forEach(a => {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0); doc.setFontSize(9)
      doc.text(`${a.trimestre} ${a.annee}`, M, y)
      doc.text(formatEur(a.chargeGenerale), M + 35, y)
      doc.text(formatEur(a.chargeSpeciale), M + 65, y)
      doc.text(formatEur(a.fondsTravaux), M + 95, y)
      doc.setFont('helvetica', 'bold')
      doc.text(formatEur(a.total), M + 125, y)
      doc.text(a.etat === 'paye' ? 'Pay\u00e9' : a.etat === 'en_retard' ? 'En retard' : 'Impay\u00e9', M + 150, y)
      y += 6
    })

    // Solde
    y += 6
    const totalAppele = coproAppels.reduce((s, a) => s + a.total, 0)
    const totalPaye = paiements.filter(p => p.coproId === coproId).reduce((s, p) => s + p.montant, 0)
    const solde = totalPaye - totalAppele

    doc.setFillColor(247, 244, 238)
    doc.rect(M, y - 4, W - 2 * M, 16, 'F')
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(13, 27, 46)
    doc.text(`Solde au ${new Date().toLocaleDateString('fr-FR')} : ${formatEur(solde)}`, M + 5, y + 6)
    y += 24

    // Mention légale
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(138, 155, 176)
    doc.text('Art. 18-2 loi 65-557 du 10 juillet 1965 \u2014 R\u00e9gularisation annuelle des charges', M, y)
    y += 4
    doc.text('Pr\u00e9-\u00e9tat dat\u00e9 au sens de l\'art. L721-2 du Code de la construction et de l\'habitation', M, y)

    doc.save(`etat-individuel-${copro.nom}-${CURRENT_YEAR}.pdf`)
    setPdfLoading(false)
  }

  // ── Simulateur: computed per-copro ──
  const simulations = useMemo(() => {
    const chargeSpecialeAnnuelle = 12000
    const newFonds = simBudget * simFondsPct / 100
    const oldFonds = budgetAG.fondsTravaux
    const oldChargeGen = budgetAG.budgetAnnuel - chargeSpecialeAnnuelle
    const newChargeGen = simBudget - chargeSpecialeAnnuelle

    return copros.map(c => {
      const oldCG = (c.tantiemes / totalTantiemes) * oldChargeGen / 12
      const oldCS = totalAscenseur > 0 ? (c.tantièmesAscenseur / totalAscenseur) * chargeSpecialeAnnuelle / 12 : 0
      const oldFT = (c.tantiemes / totalTantiemes) * oldFonds / 12
      const oldTotal = oldCG + oldCS + oldFT

      const newCG = (c.tantiemes / totalTantiemes) * newChargeGen / 12
      const newCS = oldCS
      const newFT = (c.tantiemes / totalTantiemes) * newFonds / 12
      const newTotal = newCG + newCS + newFT

      const diff = newTotal - oldTotal
      const pct = oldTotal > 0 ? ((newTotal - oldTotal) / oldTotal) * 100 : 0

      return { copro: c, oldTotal, newTotal, diff, pct }
    })
  }, [copros, simBudget, simFondsPct, budgetAG, totalTantiemes, totalAscenseur])

  // ── Rapport: recouvrement par mois ──
  const recouvrementMensuel = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const mois = new Date(CURRENT_YEAR, i).toLocaleDateString('fr-FR', { month: 'short' })
      const appelsInMonth = appels.filter(a => {
        const trimIdx = TRIMESTRES.indexOf(a.trimestre)
        return trimIdx * 3 <= i && i < (trimIdx + 1) * 3 && a.annee === CURRENT_YEAR
      })
      const total = appelsInMonth.reduce((s, a) => s + a.total, 0)
      const paye = appelsInMonth.filter(a => a.etat === 'paye').reduce((s, a) => s + a.total, 0)
      const taux = total > 0 ? (paye / total) * 100 : 0
      return { mois, total, paye, taux }
    })
    return months
  }, [appels])

  // ── Rapport: aging analysis ──
  const agingAnalysis = useMemo(() => {
    const now = new Date()
    const buckets = { j30: 0, j60: 0, j90: 0, j120plus: 0 }
    appels.filter(a => a.etat !== 'paye').forEach(a => {
      const emission = new Date(a.dateEmission)
      const days = Math.floor((now.getTime() - emission.getTime()) / (1000 * 86400))
      if (days <= 30) buckets.j30 += a.total
      else if (days <= 60) buckets.j60 += a.total
      else if (days <= 90) buckets.j90 += a.total
      else buckets.j120plus += a.total
    })
    return buckets
  }, [appels])

  // ── Rapport: budget vs realized ──
  const budgetVsRealise = useMemo(() => {
    const totalAppele = appels.filter(a => a.annee === CURRENT_YEAR).reduce((s, a) => s + a.total, 0)
    const totalEncaisse = paiements.filter(p => p.annee === CURRENT_YEAR).reduce((s, p) => s + p.montant, 0)
    return { budgetPrevu: budgetAG.budgetAnnuel + budgetAG.fondsTravaux, totalAppele, totalEncaisse }
  }, [appels, paiements, budgetAG])

  // ─── TAB 1: Appels de fonds ─────────────────────────────────────────────────

  const renderAppels = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary AG */}
      <div style={{ background: 'var(--sd-cream, #F7F4EE)', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>&#x1F3DB;</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>Budget pr\u00e9visionnel vot\u00e9 en AG</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Date AG &amp; r\u00e9solution</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatDate(budgetAG.dateAG)} \u2014 {budgetAG.resolution}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Budget annuel total</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{formatEurInt(budgetAG.budgetAnnuel)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Fonds travaux (art. 14-2 ALUR)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-gold, #C9A84C)' }}>{formatEurInt(budgetAG.fondsTravaux)} <span style={{ fontSize: 11, fontWeight: 400 }}>({budgetAG.fondsTravauxtPct}%)</span></div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Provision trimestrielle (1/4)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{formatEurInt(trimestriel + fondsTrimestre)}</div>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', fontStyle: 'italic' }}>
          Provisions exigibles au 1er jour de chaque trimestre (art. 14-1 al. 2 loi n\u00b065-557 du 10 juillet 1965)
        </div>
      </div>

      {/* Trimester selector + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TRIMESTRES.map(t => (
            <button
              key={t}
              onClick={() => setTrimestre(t)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: trimestre === t ? '2px solid var(--sd-gold, #C9A84C)' : '1px solid var(--sd-border, #E4DDD0)',
                background: trimestre === t ? 'var(--sd-navy, #0D1B2E)' : '#fff',
                color: trimestre === t ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t} {CURRENT_YEAR}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => genererAppels(trimestre)}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            G\u00e9n\u00e9rer appels {trimestre}
          </button>
          <button
            onClick={() => {
              const enRetardOuImpaye = appelsForTrim.filter(a => a.etat !== 'paye')
              if (enRetardOuImpaye.length === 0) return
              const emails = enRetardOuImpaye.map(a => {
                const c = copros.find(co => co.id === a.coproId)
                return c?.email
              }).filter(Boolean).join(',')
              window.open(`mailto:${emails}?subject=Appel de fonds ${trimestre} ${CURRENT_YEAR}&body=Madame, Monsieur,%0A%0AVeuillez trouver ci-joint votre appel de fonds pour le ${trimestre} ${CURRENT_YEAR}.%0A%0AProvision exigible au ${TRIM_DATES[trimestre]}.%0A%0ACordialement,%0ALe Syndic`)
            }}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--sd-gold, #C9A84C)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Envoyer par email
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                {['Copropri\u00e9taire', 'Lot(s)', 'Tanti\u00e8mes', 'Charge g\u00e9n\u00e9rale', 'Charge sp\u00e9ciale', 'Fonds travaux', 'Total trim.', '\u00c9tat', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 8px', textAlign: i >= 3 && i <= 6 ? 'right' : 'left', fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appelsForTrim.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 13 }}>Aucun appel g\u00e9n\u00e9r\u00e9 pour {trimestre} {CURRENT_YEAR}. Cliquez sur &laquo; G\u00e9n\u00e9rer appels &raquo;.</td></tr>
              ) : (
                appelsForTrim.map((a, idx) => {
                  const c = copros.find(co => co.id === a.coproId)
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', background: idx % 2 === 0 ? '#fff' : 'var(--sd-cream, #F7F4EE)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{c ? `${c.prenom} ${c.nom}` : '—'}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--sd-ink-2, #4A5E78)' }}>{c?.lots.map(l => l.numero).join(', ') || '—'}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--sd-ink-2, #4A5E78)' }}>{c?.tantiemes || 0}/{totalTantiemes}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--sd-ink-2, #4A5E78)' }}>{formatEur(a.chargeGenerale)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--sd-ink-2, #4A5E78)' }}>{formatEur(a.chargeSpeciale)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--sd-gold, #C9A84C)', fontWeight: 600 }}>{formatEur(a.fondsTravaux)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{formatEur(a.total)}</td>
                      <td style={{ padding: '10px 8px' }}>{etatBadge(a.etat)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {a.etat !== 'paye' && (
                          <button onClick={() => marquerPaye(a.id)} style={{ padding: '4px 10px', borderRadius: 6, background: '#E6F4E6', color: '#1A7A3A', fontSize: 10, fontWeight: 600, border: '1px solid #B7DFB7', cursor: 'pointer' }}>Marquer pay\u00e9</button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {appelsForTrim.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--sd-navy, #0D1B2E)' }}>
                  <td colSpan={3} style={{ padding: '10px 8px', fontWeight: 700, color: '#fff', fontSize: 12 }}>TOTAL {trimestre}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>{formatEur(appelsForTrim.reduce((s, a) => s + a.chargeGenerale, 0))}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>{formatEur(appelsForTrim.reduce((s, a) => s + a.chargeSpeciale, 0))}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--sd-gold, #C9A84C)' }}>{formatEur(appelsForTrim.reduce((s, a) => s + a.fondsTravaux, 0))}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff' }}>{formatEur(appelsForTrim.reduce((s, a) => s + a.total, 0))}</td>
                  <td colSpan={2} style={{ padding: '10px 8px', color: 'var(--sd-gold, #C9A84C)', fontSize: 10, fontWeight: 600 }}>{appelsForTrim.filter(a => a.etat === 'paye').length}/{appelsForTrim.length} pay\u00e9s</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legal note */}
      <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', padding: '0 4px', lineHeight: 1.6 }}>
        <strong>R\u00e9f\u00e9rences l\u00e9gales :</strong> Charge g\u00e9n\u00e9rale (art. 10 al. 1 loi 65-557) \u2014 Charge sp\u00e9ciale ascenseur, chauffage (art. 10 al. 2) \u2014 Fonds travaux minimum 5% du budget (art. 14-2 loi ALUR) ou 2,5% du montant PPT
      </div>
    </div>
  )

  // ─── TAB 2: Simulateur ──────────────────────────────────────────────────────

  const renderSimulateur = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Input controls */}
      <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>Simulation de budget</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', display: 'block', marginBottom: 4 }}>Budget annuel propos\u00e9</label>
            <input
              type="number"
              value={simBudget}
              onChange={e => setSimBudget(Number(e.target.value) || 0)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--sd-border, #E4DDD0)', fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}
            />
            <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>Actuel : {formatEurInt(budgetAG.budgetAnnuel)}</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', display: 'block', marginBottom: 4 }}>Fonds travaux : {simFondsPct}% <span style={{ fontSize: 9, color: 'var(--sd-ink-3, #8A9BB0)' }}>(min 5% ALUR ou 2,5% PPT)</span></label>
            <input
              type="range"
              min={2.5}
              max={15}
              step={0.5}
              value={simFondsPct}
              onChange={e => setSimFondsPct(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--sd-gold, #C9A84C)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--sd-ink-3, #8A9BB0)' }}>
              <span>2,5% (PPT)</span>
              <span>5% (ALUR)</span>
              <span>15%</span>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--sd-gold, #C9A84C)' }}>= {formatEurInt(simBudget * simFondsPct / 100)} / an</div>
          </div>
        </div>
      </div>

      {/* Impact table */}
      <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                {['Copropri\u00e9taire', 'Tanti\u00e8mes', 'Charge actuelle/mois', 'Charge simul\u00e9e/mois', 'Diff\u00e9rence', 'Variation'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 8px', textAlign: i >= 2 ? 'right' : 'left', fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {simulations.map((s, idx) => {
                let highlightBg = 'transparent'
                if (s.pct > 15) highlightBg = '#FDECEA'
                else if (s.pct > 10) highlightBg = '#FEF5E4'
                else if (s.pct > 5) highlightBg = '#FFF9E6'

                let pctColor = 'var(--sd-ink-2, #4A5E78)'
                if (s.pct > 15) pctColor = '#C0392B'
                else if (s.pct > 10) pctColor = '#D4830A'
                else if (s.pct > 5) pctColor = '#B8860B'

                return (
                  <tr key={s.copro.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', background: highlightBg || (idx % 2 === 0 ? '#fff' : 'var(--sd-cream, #F7F4EE)') }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{s.copro.prenom} {s.copro.nom}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--sd-ink-2, #4A5E78)' }}>{s.copro.tantiemes}/{totalTantiemes}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--sd-ink-2, #4A5E78)' }}>{formatEur(s.oldTotal)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatEur(s.newTotal)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: s.diff > 0 ? '#C0392B' : '#1A7A3A' }}>
                      {s.diff > 0 ? '+' : ''}{formatEur(s.diff)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, color: pctColor, background: highlightBg || 'transparent' }}>
                        {s.pct > 0 ? '+' : ''}{s.pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend + export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#FFF9E6', marginRight: 4, verticalAlign: 'middle' }}></span> &gt;5%</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#FEF5E4', marginRight: 4, verticalAlign: 'middle' }}></span> &gt;10%</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#FDECEA', marginRight: 4, verticalAlign: 'middle' }}></span> &gt;15%</span>
        </div>
        <button
          onClick={() => {
            const header = 'Copropri\u00e9taire;Tanti\u00e8mes;Actuel/mois;Simul\u00e9/mois;Diff;Variation%\n'
            const rows = simulations.map(s => `${s.copro.prenom} ${s.copro.nom};${s.copro.tantiemes};${s.oldTotal.toFixed(2)};${s.newTotal.toFixed(2)};${s.diff.toFixed(2)};${s.pct.toFixed(1)}%`).join('\n')
            const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `comparatif-charges-${CURRENT_YEAR}.csv`; a.click()
            URL.revokeObjectURL(url)
          }}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Exporter comparatif
        </button>
      </div>
    </div>
  )

  // ─── TAB 3: Etat individuel ─────────────────────────────────────────────────

  const renderIndividuel = () => {
    const copro = copros.find(c => c.id === selectedCoproId)
    const coproAppels = appels.filter(a => a.coproId === selectedCoproId)
    const coproPaiements = paiements.filter(p => p.coproId === selectedCoproId)

    const totalAppele = coproAppels.reduce((s, a) => s + a.total, 0)
    const totalPaye = coproPaiements.reduce((s, p) => s + p.montant, 0)
    const solde = totalPaye - totalAppele

    // Charges d\u00e9ductibles = charges g\u00e9n\u00e9rales + sp\u00e9ciales (hors fonds travaux)
    const chargesDeductibles = coproAppels.reduce((s, a) => s + a.chargeGenerale + a.chargeSpeciale, 0)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Copro selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={selectedCoproId}
            onChange={e => setSelectedCoproId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--sd-border, #E4DDD0)', fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', minWidth: 220 }}
          >
            {copros.map(c => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom} \u2014 {c.lots.map(l => l.numero).join(', ')}</option>
            ))}
          </select>
          <button
            onClick={() => exportPdfIndividuel(selectedCoproId)}
            disabled={pdfLoading}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: pdfLoading ? 'default' : 'pointer', opacity: pdfLoading ? 0.6 : 1 }}
          >
            {pdfLoading ? '\u2026' : 'T\u00e9l\u00e9charger PDF'}
          </button>
        </div>

        {copro && (
          <>
            {/* Copro info card */}
            <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Copropri\u00e9taire</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{copro.prenom} {copro.nom}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Lot(s)</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{copro.lots.map(l => `${l.numero} (${l.type}, ${l.etage})`).join(' | ')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Tanti\u00e8mes g\u00e9n\u00e9raux</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{copro.tantiemes} / {totalTantiemes}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Solde actuel</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: solde >= 0 ? '#1A7A3A' : '#C0392B' }}>{formatEur(solde)}</div>
                </div>
              </div>
            </div>

            {/* Historique charges */}
            <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sd-border, #E4DDD0)', fontWeight: 700, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>Historique des charges</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                    {['P\u00e9riode', 'G\u00e9n\u00e9rale', 'Sp\u00e9ciale', 'Fonds trav.', 'Total', '\u00c9tat', 'Date paiement'].map((h, i) => (
                      <th key={i} style={{ padding: '8px', textAlign: i >= 1 && i <= 4 ? 'right' : 'left', fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coproAppels.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)' }}>Aucun appel enregistr\u00e9</td></tr>
                  ) : coproAppels.map((a, idx) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', background: idx % 2 === 0 ? '#fff' : 'var(--sd-cream, #F7F4EE)' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{a.trimestre} {a.annee}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatEur(a.chargeGenerale)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatEur(a.chargeSpeciale)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--sd-gold, #C9A84C)' }}>{formatEur(a.fondsTravaux)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{formatEur(a.total)}</td>
                      <td style={{ padding: '8px' }}>{etatBadge(a.etat)}</td>
                      <td style={{ padding: '8px', color: 'var(--sd-ink-3, #8A9BB0)' }}>{a.datePaiement ? formatDate(a.datePaiement) : '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paiements */}
            <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sd-border, #E4DDD0)', fontWeight: 700, fontSize: 13, color: 'var(--sd-navy, #0D1B2E)' }}>Paiements re\u00e7us</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                    {['Date', 'R\u00e9f\u00e9rence', 'P\u00e9riode', 'Type', 'Montant'].map((h, i) => (
                      <th key={i} style={{ padding: '8px', textAlign: i === 4 ? 'right' : 'left', fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coproPaiements.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)' }}>Aucun paiement enregistr\u00e9</td></tr>
                  ) : coproPaiements.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)', background: idx % 2 === 0 ? '#fff' : 'var(--sd-cream, #F7F4EE)' }}>
                      <td style={{ padding: '8px', color: 'var(--sd-navy, #0D1B2E)' }}>{formatDate(p.date)}</td>
                      <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 11, color: 'var(--sd-ink-2, #4A5E78)' }}>{p.reference}</td>
                      <td style={{ padding: '8px' }}>{p.trimestre} {p.annee}</td>
                      <td style={{ padding: '8px' }}><span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: p.type === 'charge' ? '#E6F4E6' : p.type === 'regularisation' ? '#FEF5E4' : 'rgba(201,168,76,0.15)', color: p.type === 'charge' ? '#1A7A3A' : p.type === 'regularisation' ? '#D4830A' : '#C9A84C', fontWeight: 600 }}>{p.type === 'charge' ? 'Charge' : p.type === 'regularisation' ? 'R\u00e9gul.' : 'Fonds trav.'}</span></td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#1A7A3A' }}>{formatEur(p.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>R\u00e9gularisation N-1 (art. 18-2)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{formatEur(solde)}</div>
                <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>Solde cr\u00e9diteur = trop-per\u00e7u \u00e0 d\u00e9duire</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Charges d\u00e9ductibles (revenus fonciers)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--sd-gold, #C9A84C)' }}>{formatEur(chargesDeductibles)}</div>
                <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>Hors fonds de travaux (non d\u00e9ductible)</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>Attestation pr\u00e9-\u00e9tat dat\u00e9 (art. L721-2 CCH)</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginTop: 4 }}>Obligatoire en cas de vente</div>
                <button
                  onClick={() => exportPdfIndividuel(selectedCoproId)}
                  disabled={pdfLoading}
                  style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, background: 'var(--sd-navy, #0D1B2E)', color: '#fff', fontSize: 11, fontWeight: 600, border: 'none', cursor: pdfLoading ? 'default' : 'pointer', opacity: pdfLoading ? 0.6 : 1 }}
                >
                  {pdfLoading ? '\u2026' : 'G\u00e9n\u00e9rer attestation PDF'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── TAB 4: Rapport ─────────────────────────────────────────────────────────

  const renderRapport = () => {
    const maxTaux = Math.max(...recouvrementMensuel.map(m => m.taux), 1)
    const agingTotal = agingAnalysis.j30 + agingAnalysis.j60 + agingAnalysis.j90 + agingAnalysis.j120plus

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Taux de recouvrement par mois */}
        <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>Taux de recouvrement par mois</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
            {recouvrementMensuel.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: m.taux >= 80 ? '#1A7A3A' : m.taux >= 50 ? '#D4830A' : '#C0392B' }}>
                  {m.taux > 0 ? `${m.taux.toFixed(0)}%` : ''}
                </div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 40,
                    height: `${(m.taux / 100) * 120}px`,
                    minHeight: m.taux > 0 ? 4 : 0,
                    background: m.taux >= 80
                      ? 'linear-gradient(180deg, #1A7A3A, #2ECC71)'
                      : m.taux >= 50
                        ? 'linear-gradient(180deg, #D4830A, #F39C12)'
                        : m.taux > 0
                          ? 'linear-gradient(180deg, #C0392B, #E74C3C)'
                          : 'var(--sd-border, #E4DDD0)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s',
                  }}
                ></div>
                <div style={{ fontSize: 9, color: 'var(--sd-ink-3, #8A9BB0)', fontWeight: 500 }}>{m.mois}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Aging analysis */}
        <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>Analyse d&apos;anciennet\u00e9 des impay\u00e9s</div>
          {agingTotal === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 13 }}>Aucun impay\u00e9 en cours</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: '0-30 jours', value: agingAnalysis.j30, color: '#3498DB', bg: '#EBF5FB' },
                { label: '31-60 jours', value: agingAnalysis.j60, color: '#D4830A', bg: '#FEF5E4' },
                { label: '61-90 jours', value: agingAnalysis.j90, color: '#E67E22', bg: '#FDEBD0' },
                { label: '120+ jours', value: agingAnalysis.j120plus, color: '#C0392B', bg: '#FDECEA' },
              ].map((b, i) => (
                <div key={i} style={{ background: b.bg, borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: b.color }}>{formatEurInt(b.value)}</div>
                  <div style={{ fontSize: 11, color: b.color, fontWeight: 500, marginTop: 4 }}>{b.label}</div>
                  <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.08)' }}>
                    <div style={{ height: 4, borderRadius: 2, background: b.color, width: `${agingTotal > 0 ? (b.value / agingTotal) * 100 : 0}%`, transition: 'width 0.3s' }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Budget vs R\u00e9alis\u00e9 */}
        <div style={{ background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 12 }}>Comparatif budget / r\u00e9alis\u00e9</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Budget pr\u00e9visionnel</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 4 }}>{formatEurInt(budgetVsRealise.budgetPrevu)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Total appel\u00e9</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-gold, #C9A84C)', marginTop: 4 }}>{formatEurInt(budgetVsRealise.totalAppele)}</div>
              <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)' }}>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--sd-gold, #C9A84C)', width: `${budgetVsRealise.budgetPrevu > 0 ? Math.min((budgetVsRealise.totalAppele / budgetVsRealise.budgetPrevu) * 100, 100) : 0}%` }}></div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Total encaiss\u00e9</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1A7A3A', marginTop: 4 }}>{formatEurInt(budgetVsRealise.totalEncaisse)}</div>
              <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)' }}>
                <div style={{ height: 6, borderRadius: 3, background: '#1A7A3A', width: `${budgetVsRealise.budgetPrevu > 0 ? Math.min((budgetVsRealise.totalEncaisse / budgetVsRealise.budgetPrevu) * 100, 100) : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* R\u00e9gularisation annuelle summary */}
        <div style={{ background: 'var(--sd-cream, #F7F4EE)', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>R\u00e9gularisation annuelle</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Total provisions appel\u00e9es</div>
              <div style={{ fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 2 }}>{formatEur(budgetVsRealise.totalAppele)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Total d\u00e9penses r\u00e9elles</div>
              <div style={{ fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', marginTop: 2 }}>{formatEur(budgetVsRealise.totalEncaisse)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Taux de recouvrement global</div>
              <div style={{ fontWeight: 700, color: budgetVsRealise.totalAppele > 0 && (budgetVsRealise.totalEncaisse / budgetVsRealise.totalAppele) >= 0.8 ? '#1A7A3A' : '#C0392B', marginTop: 2 }}>
                {budgetVsRealise.totalAppele > 0 ? ((budgetVsRealise.totalEncaisse / budgetVsRealise.totalAppele) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Solde \u00e0 r\u00e9gulariser</div>
              <div style={{ fontWeight: 700, color: (budgetVsRealise.totalEncaisse - budgetVsRealise.totalAppele) >= 0 ? '#1A7A3A' : '#C0392B', marginTop: 2 }}>
                {formatEur(budgetVsRealise.totalEncaisse - budgetVsRealise.totalAppele)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)', fontStyle: 'italic' }}>
            La r\u00e9gularisation annuelle doit \u00eatre pr\u00e9sent\u00e9e lors de l&apos;assembl\u00e9e g\u00e9n\u00e9rale (art. 18-2 loi 65-557 du 10 juillet 1965)
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0, fontFamily: "'Playfair Display', serif" }}>
            Appels de fonds
          </h1>
          <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: '4px 0 0' }}>
            Gestion trimestrielle des charges de copropri\u00e9t\u00e9 \u2014 Loi n\u00b065-557 du 10 juillet 1965
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabBtn('appels', 'Appels de fonds')}
        {tabBtn('simulateur', 'Simulateur')}
        {tabBtn('individuel', '\u00c9tat individuel')}
        {tabBtn('rapport', 'Rapport')}
      </div>

      {/* Tab content */}
      {activeTab === 'appels' && renderAppels()}
      {activeTab === 'simulateur' && renderSimulateur()}
      {activeTab === 'individuel' && renderIndividuel()}
      {activeTab === 'rapport' && renderRapport()}
    </div>
  )
}
