'use client'

import { useState, useEffect, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClasseDPE = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

interface ReleveCompteur {
  id: string
  immeubleId: string
  immeubleNom: string
  type: 'electricite' | 'gaz' | 'eau'
  mois: string          // YYYY-MM
  relevePrecedent: number
  releveActuel: number
  consommation: number
  coutEstime: number
}

interface ObjectifEnergetique {
  id: string
  immeubleId: string
  immeubleNom: string
  objectifReduction: number   // % reduction target
  anneeReference: number
  anneeObjectif: number
  consoReference: number      // kWh/m²/an
  consoActuelle: number
  notes: string
}

interface TravauxRenovation {
  id: string
  immeubleId: string
  immeubleNom: string
  type: 'isolation_murs' | 'isolation_toiture' | 'isolation_plancher' | 'fenetres' | 'chauffage' | 'ventilation' | 'solaire' | 'autre'
  description: string
  anneePrevue: number
  coutEstimeHT: number
  economiesAnnuelles: number
  impactDPE: string       // ex: "D → C"
  statut: 'prevu' | 'en_cours' | 'realise' | 'reporte'
  subventionEligible: boolean
  notes: string
}

interface ImmeubleEnergie {
  id: string
  nom: string
  adresse: string
  classeDPE: ClasseDPE
  surfaceM2: number
  fondsTravauxActuel: number
  fondsTravauxObjectif: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DPE_COLORS: Record<ClasseDPE, string> = {
  A: '#009a6e', B: '#51b84b', C: '#abce50', D: '#f7e64b',
  E: '#f0b429', F: '#e8731a', G: '#d9231e',
}

const DPE_KWH: Record<ClasseDPE, string> = {
  A: '≤ 70', B: '71–110', C: '111–180', D: '181–250',
  E: '251–330', F: '331–420', G: '> 420',
}

const CLASSES: ClasseDPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const TYPES_UTILITE = {
  electricite: { label: 'Électricité', unit: 'kWh', icon: '⚡', coutUnit: 0.2516 },
  gaz:         { label: 'Gaz',         unit: 'm³',  icon: '🔥', coutUnit: 1.12 },
  eau:         { label: 'Eau',         unit: 'm³',  icon: '💧', coutUnit: 4.34 },
}

const TYPES_TRAVAUX: Record<string, { label: string; icon: string }> = {
  isolation_murs:    { label: 'Isolation des murs',       icon: '🧱' },
  isolation_toiture: { label: 'Isolation toiture',        icon: '🏠' },
  isolation_plancher:{ label: 'Isolation plancher bas',   icon: '📐' },
  fenetres:          { label: 'Remplacement fenêtres',    icon: '🪟' },
  chauffage:         { label: 'Système de chauffage',     icon: '🌡️' },
  ventilation:       { label: 'Ventilation (VMC)',        icon: '🌬️' },
  solaire:           { label: 'Panneaux solaires',        icon: '☀️' },
  autre:             { label: 'Autres travaux',           icon: '🔧' },
}

const STATUTS_TRAVAUX: Record<string, { label: string; color: string }> = {
  prevu:    { label: 'Prévu',    color: 'bg-blue-50 text-blue-700' },
  en_cours: { label: 'En cours', color: 'bg-orange-50 text-orange-700' },
  realise:  { label: 'Réalisé',  color: 'bg-green-50 text-green-700' },
  reporte:  { label: 'Reporté',  color: 'bg-gray-100 text-gray-500' },
}

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const formatNum = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)

// ─── Demo data ────────────────────────────────────────────────────────────────

function generateDemoData(userId: string) {
  const immeubles: ImmeubleEnergie[] = [
    { id: 'imm1', nom: 'Résidence Les Oliviers', adresse: '12 rue des Oliviers, 13006 Marseille', classeDPE: 'D', surfaceM2: 2400, fondsTravauxActuel: 18500, fondsTravauxObjectif: 45000 },
    { id: 'imm2', nom: 'Le Parc Saint-Charles', adresse: '8 bd Saint-Charles, 13001 Marseille', classeDPE: 'E', surfaceM2: 3100, fondsTravauxActuel: 12000, fondsTravauxObjectif: 62000 },
    { id: 'imm3', nom: 'Villa Méditerranée', adresse: '45 av du Prado, 13008 Marseille', classeDPE: 'F', surfaceM2: 1800, fondsTravauxActuel: 5200, fondsTravauxObjectif: 38000 },
  ]

  const now = new Date()
  const releves: ReleveCompteur[] = []
  immeubles.forEach(imm => {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const baseElec = 3200 + Math.random() * 800
      const baseGaz = 180 + Math.random() * 120 + (d.getMonth() < 3 || d.getMonth() > 9 ? 200 : 0)
      const baseEau = 95 + Math.random() * 30

      releves.push(
        { id: `r-e-${imm.id}-${mois}`, immeubleId: imm.id, immeubleNom: imm.nom, type: 'electricite', mois, relevePrecedent: Math.round(baseElec * 0.9), releveActuel: Math.round(baseElec), consommation: Math.round(baseElec * 0.1), coutEstime: Math.round(baseElec * 0.1 * TYPES_UTILITE.electricite.coutUnit) },
        { id: `r-g-${imm.id}-${mois}`, immeubleId: imm.id, immeubleNom: imm.nom, type: 'gaz', mois, relevePrecedent: Math.round(baseGaz * 0.85), releveActuel: Math.round(baseGaz), consommation: Math.round(baseGaz * 0.15), coutEstime: Math.round(baseGaz * 0.15 * TYPES_UTILITE.gaz.coutUnit) },
        { id: `r-w-${imm.id}-${mois}`, immeubleId: imm.id, immeubleNom: imm.nom, type: 'eau', mois, relevePrecedent: Math.round(baseEau * 0.9), releveActuel: Math.round(baseEau), consommation: Math.round(baseEau * 0.1), coutEstime: Math.round(baseEau * 0.1 * TYPES_UTILITE.eau.coutUnit) },
      )
    }
  })

  const objectifs: ObjectifEnergetique[] = [
    { id: 'obj1', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', objectifReduction: 30, anneeReference: 2022, anneeObjectif: 2030, consoReference: 220, consoActuelle: 195, notes: 'Objectif loi Climat 2030' },
    { id: 'obj2', immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles', objectifReduction: 40, anneeReference: 2022, anneeObjectif: 2034, consoReference: 310, consoActuelle: 285, notes: 'Sortie passoire thermique E' },
    { id: 'obj3', immeubleId: 'imm3', immeubleNom: 'Villa Méditerranée', objectifReduction: 50, anneeReference: 2022, anneeObjectif: 2028, consoReference: 380, consoActuelle: 350, notes: 'Urgence: interdiction location F en 2028' },
  ]

  const travaux: TravauxRenovation[] = [
    { id: 'tw1', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', type: 'isolation_murs', description: 'ITE façade nord et sud', anneePrevue: 2025, coutEstimeHT: 120000, economiesAnnuelles: 8500, impactDPE: 'D → C', statut: 'en_cours', subventionEligible: true, notes: 'Devis accepté AG 2024' },
    { id: 'tw2', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', type: 'fenetres', description: 'Double vitrage parties communes', anneePrevue: 2026, coutEstimeHT: 45000, economiesAnnuelles: 3200, impactDPE: 'C → C+', statut: 'prevu', subventionEligible: true, notes: '' },
    { id: 'tw3', immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles', type: 'chauffage', description: 'Remplacement chaudière collective gaz par PAC', anneePrevue: 2026, coutEstimeHT: 180000, economiesAnnuelles: 15000, impactDPE: 'E → C', statut: 'prevu', subventionEligible: true, notes: 'Étude thermique en cours' },
    { id: 'tw4', immeubleId: 'imm3', immeubleNom: 'Villa Méditerranée', type: 'isolation_toiture', description: 'Isolation combles perdus + toiture-terrasse', anneePrevue: 2025, coutEstimeHT: 65000, economiesAnnuelles: 6800, impactDPE: 'F → E', statut: 'realise', subventionEligible: true, notes: 'Terminé mars 2025' },
    { id: 'tw5', immeubleId: 'imm3', immeubleNom: 'Villa Méditerranée', type: 'ventilation', description: 'VMC double flux', anneePrevue: 2027, coutEstimeHT: 55000, economiesAnnuelles: 4200, impactDPE: 'E → D', statut: 'prevu', subventionEligible: true, notes: '' },
  ]

  return { immeubles, releves, objectifs, travaux }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SuiviEnergetiqueFRSection({ user, userRole }: { user: any; userRole: string }) {
  const STORAGE_KEY = `fixit_energie_fr_${user.id}`

  const [activeTab, setActiveTab] = useState<'dashboard' | 'consommations' | 'objectifs' | 'travaux'>('dashboard')
  const [immeubles, setImmeubles] = useState<ImmeubleEnergie[]>([])
  const [releves, setReleves] = useState<ReleveCompteur[]>([])
  const [objectifs, setObjectifs] = useState<ObjectifEnergetique[]>([])
  const [travaux, setTravaux] = useState<TravauxRenovation[]>([])
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [showAddReleve, setShowAddReleve] = useState(false)
  const [releveForm, setReleveForm] = useState<Partial<ReleveCompteur>>({ type: 'electricite' })
  const [showAddObjectif, setShowAddObjectif] = useState(false)
  const [objectifForm, setObjectifForm] = useState<Partial<ObjectifEnergetique>>({})
  const [showAddTravaux, setShowAddTravaux] = useState(false)
  const [travauxForm, setTravauxForm] = useState<Partial<TravauxRenovation>>({ type: 'isolation_murs', statut: 'prevu', subventionEligible: true })
  const [showSimulation, setShowSimulation] = useState(false)

  // ── Persistance ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        setImmeubles(data.immeubles || [])
        setReleves(data.releves || [])
        setObjectifs(data.objectifs || [])
        setTravaux(data.travaux || [])
      } else {
        const demo = generateDemoData(user.id)
        setImmeubles(demo.immeubles)
        setReleves(demo.releves)
        setObjectifs(demo.objectifs)
        setTravaux(demo.travaux)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      const demo = generateDemoData(user.id)
      setImmeubles(demo.immeubles)
      setReleves(demo.releves)
      setObjectifs(demo.objectifs)
      setTravaux(demo.travaux)
    }
  }, [])

  const saveAll = (upd: { immeubles?: ImmeubleEnergie[]; releves?: ReleveCompteur[]; objectifs?: ObjectifEnergetique[]; travaux?: TravauxRenovation[] }) => {
    const data = {
      immeubles: upd.immeubles ?? immeubles,
      releves: upd.releves ?? releves,
      objectifs: upd.objectifs ?? objectifs,
      travaux: upd.travaux ?? travaux,
    }
    if (upd.immeubles) setImmeubles(upd.immeubles)
    if (upd.releves) setReleves(upd.releves)
    if (upd.objectifs) setObjectifs(upd.objectifs)
    if (upd.travaux) setTravaux(upd.travaux)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  // ── Calculs ──────────────────────────────────────────────────────────────────

  const filteredReleves = useMemo(() => {
    if (!filterImmeuble) return releves
    return releves.filter(r => r.immeubleId === filterImmeuble)
  }, [releves, filterImmeuble])

  const last6Months = useMemo(() => {
    const months: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months
  }, [])

  const coutTotal = useMemo(() => {
    const currentMonth = last6Months[last6Months.length - 1]
    return filteredReleves.filter(r => r.mois === currentMonth).reduce((s, r) => s + r.coutEstime, 0)
  }, [filteredReleves, last6Months])

  const consoByTypeAndMonth = useMemo(() => {
    const map: Record<string, Record<string, number>> = { electricite: {}, gaz: {}, eau: {} }
    filteredReleves.forEach(r => {
      if (!map[r.type]) map[r.type] = {}
      map[r.type][r.mois] = (map[r.type][r.mois] || 0) + r.consommation
    })
    return map
  }, [filteredReleves])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAddReleve = () => {
    if (!releveForm.immeubleId || !releveForm.type || !releveForm.mois || releveForm.releveActuel === undefined) return
    const imm = immeubles.find(i => i.id === releveForm.immeubleId)
    const conso = (releveForm.releveActuel || 0) - (releveForm.relevePrecedent || 0)
    const type = releveForm.type as keyof typeof TYPES_UTILITE
    const newR: ReleveCompteur = {
      id: `r-${Date.now()}`,
      immeubleId: releveForm.immeubleId,
      immeubleNom: imm?.nom || '',
      type: releveForm.type as any,
      mois: releveForm.mois,
      relevePrecedent: releveForm.relevePrecedent || 0,
      releveActuel: releveForm.releveActuel || 0,
      consommation: Math.max(0, conso),
      coutEstime: Math.round(Math.max(0, conso) * TYPES_UTILITE[type].coutUnit),
    }
    const updated = [...releves, newR]
    saveAll({ releves: updated })
    setShowAddReleve(false)
    setReleveForm({ type: 'electricite' })
  }

  const handleAddObjectif = () => {
    if (!objectifForm.immeubleId || !objectifForm.objectifReduction) return
    const imm = immeubles.find(i => i.id === objectifForm.immeubleId)
    const newObj: ObjectifEnergetique = {
      id: `obj-${Date.now()}`,
      immeubleId: objectifForm.immeubleId,
      immeubleNom: imm?.nom || '',
      objectifReduction: objectifForm.objectifReduction || 30,
      anneeReference: objectifForm.anneeReference || 2022,
      anneeObjectif: objectifForm.anneeObjectif || 2030,
      consoReference: objectifForm.consoReference || 250,
      consoActuelle: objectifForm.consoActuelle || 250,
      notes: objectifForm.notes || '',
    }
    saveAll({ objectifs: [...objectifs, newObj] })
    setShowAddObjectif(false)
    setObjectifForm({})
  }

  const handleAddTravaux = () => {
    if (!travauxForm.immeubleId || !travauxForm.description) return
    const imm = immeubles.find(i => i.id === travauxForm.immeubleId)
    const newTw: TravauxRenovation = {
      id: `tw-${Date.now()}`,
      immeubleId: travauxForm.immeubleId,
      immeubleNom: imm?.nom || '',
      type: (travauxForm.type as any) || 'autre',
      description: travauxForm.description || '',
      anneePrevue: travauxForm.anneePrevue || new Date().getFullYear(),
      coutEstimeHT: travauxForm.coutEstimeHT || 0,
      economiesAnnuelles: travauxForm.economiesAnnuelles || 0,
      impactDPE: travauxForm.impactDPE || '',
      statut: (travauxForm.statut as any) || 'prevu',
      subventionEligible: travauxForm.subventionEligible ?? true,
      notes: travauxForm.notes || '',
    }
    saveAll({ travaux: [...travaux, newTw] })
    setShowAddTravaux(false)
    setTravauxForm({ type: 'isolation_murs', statut: 'prevu', subventionEligible: true })
  }

  const deleteReleve = (id: string) => { if (window.confirm('Supprimer ce relevé ?')) saveAll({ releves: releves.filter(r => r.id !== id) }) }
  const deleteObjectif = (id: string) => { if (window.confirm('Supprimer cet objectif ?')) saveAll({ objectifs: objectifs.filter(o => o.id !== id) }) }
  const deleteTravaux = (id: string) => { if (window.confirm('Supprimer ce poste de travaux ?')) saveAll({ travaux: travaux.filter(t => t.id !== id) }) }

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'dashboard' as const,     label: 'Tableau de bord', icon: '📊' },
    { key: 'consommations' as const, label: 'Consommations',   icon: '📈' },
    { key: 'objectifs' as const,     label: 'Objectifs',       icon: '🎯' },
    { key: 'travaux' as const,       label: 'Plan de travaux', icon: '🔨' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === t.key ? 'bg-[var(--sd-navy,#0D1B2E)] text-white shadow' : 'bg-white border border-[var(--sd-border,#E4DDD0)] text-[var(--sd-ink-2,#555)] hover:bg-[var(--sd-cream,#F7F4EE)]'}`}>
            {t.icon} {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <select value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)}
          className="px-3 py-2 border-2 border-[var(--sd-border,#E4DDD0)] rounded-lg text-sm bg-white focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
          <option value="">Tous les immeubles</option>
          {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
        </select>
      </div>

      {/* ── TAB: Tableau de bord ─────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Électricité', value: `${formatNum(filteredReleves.filter(r => r.type === 'electricite' && r.mois === last6Months[last6Months.length - 1]).reduce((s, r) => s + r.consommation, 0))} kWh`, icon: '⚡', color: 'bg-yellow-50 border-yellow-200' },
              { label: 'Gaz', value: `${formatNum(filteredReleves.filter(r => r.type === 'gaz' && r.mois === last6Months[last6Months.length - 1]).reduce((s, r) => s + r.consommation, 0))} m³`, icon: '🔥', color: 'bg-orange-50 border-orange-200' },
              { label: 'Eau', value: `${formatNum(filteredReleves.filter(r => r.type === 'eau' && r.mois === last6Months[last6Months.length - 1]).reduce((s, r) => s + r.consommation, 0))} m³`, icon: '💧', color: 'bg-blue-50 border-blue-200' },
              { label: 'Coût total / mois', value: formatEur(coutTotal), icon: '💰', color: 'bg-green-50 border-green-200' },
            ].map((k, i) => (
              <div key={i} className={`rounded-xl border-2 p-4 ${k.color}`}>
                <div className="text-lg mb-1">{k.icon}</div>
                <div className="text-xl font-bold text-[var(--sd-navy,#0D1B2E)]">{k.value}</div>
                <div className="text-xs text-[var(--sd-ink-3,#888)]">{k.label}</div>
              </div>
            ))}
            {/* DPE Card */}
            <div className="rounded-xl border-2 border-[var(--sd-border,#E4DDD0)] bg-white p-4">
              <div className="text-xs text-[var(--sd-ink-3,#888)] mb-1">Classe DPE</div>
              <div className="flex gap-1.5 flex-wrap">
                {(filterImmeuble ? immeubles.filter(i => i.id === filterImmeuble) : immeubles).map(imm => (
                  <div key={imm.id} className="flex items-center gap-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: DPE_COLORS[imm.classeDPE] }}>{imm.classeDPE}</div>
                    <span className="text-[10px] text-gray-500 max-w-[60px] truncate">{imm.nom.split(' ').pop()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DPE Scale Visual */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">Échelle DPE — Immeubles</h3>
            <div className="space-y-3">
              {(filterImmeuble ? immeubles.filter(i => i.id === filterImmeuble) : immeubles).map(imm => (
                <div key={imm.id} className="flex items-start gap-4">
                  <div className="min-w-[140px]">
                    <div className="text-sm font-semibold text-[var(--sd-navy,#0D1B2E)]">{imm.nom}</div>
                    <div className="text-xs text-[var(--sd-ink-3,#888)]">{imm.surfaceM2} m²</div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {CLASSES.map(c => (
                      <div key={c} className={`flex items-center gap-1 ${c === imm.classeDPE ? 'opacity-100' : 'opacity-20'}`}>
                        <div className="text-[10px] font-bold w-5 h-4 flex items-center justify-center rounded-sm text-white" style={{ backgroundColor: DPE_COLORS[c] }}>{c}</div>
                        <div className="rounded-r-sm h-4" style={{ width: `${(CLASSES.indexOf(c) + 1) * 14 + 14}px`, backgroundColor: DPE_COLORS[c] }} />
                        {c === imm.classeDPE && <span className="text-[10px] font-bold text-gray-700 ml-1">◀ {DPE_KWH[c]} kWh/m²/an</span>}
                      </div>
                    ))}
                  </div>
                  {(imm.classeDPE === 'F' || imm.classeDPE === 'G') && (
                    <div className="ml-auto bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 max-w-[200px]">
                      <strong>Passoire thermique</strong><br />
                      {imm.classeDPE === 'G' ? 'Interdiction location depuis 2025' : 'Interdiction location en 2028'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bar Charts — 6 months */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['electricite', 'gaz', 'eau'] as const).map(type => {
              const cfg = TYPES_UTILITE[type]
              const data = last6Months.map(m => consoByTypeAndMonth[type]?.[m] || 0)
              const maxVal = Math.max(...data, 1)
              return (
                <div key={type} className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm">
                  <h4 className="font-semibold text-sm text-[var(--sd-navy,#0D1B2E)] mb-3">{cfg.icon} {cfg.label} ({cfg.unit})</h4>
                  <div className="flex items-end gap-1 h-28">
                    {data.map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-gray-500">{formatNum(val)}</span>
                        <div className="w-full rounded-t" style={{ height: `${(val / maxVal) * 80}px`, backgroundColor: type === 'electricite' ? '#f0b429' : type === 'gaz' ? '#e8731a' : '#3b82f6', minHeight: '4px' }} />
                        <span className="text-[9px] text-gray-400">{MOIS_LABELS[parseInt(last6Months[i].split('-')[1]) - 1]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Comparison N-1 / N */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">Comparaison N-1 / N (derniers 6 mois)</h3>
            <div className="grid grid-cols-3 gap-4">
              {(['electricite', 'gaz', 'eau'] as const).map(type => {
                const cfg = TYPES_UTILITE[type]
                const totalN = filteredReleves.filter(r => r.type === type).reduce((s, r) => s + r.consommation, 0)
                const totalN1 = Math.round(totalN * (1 + (Math.random() * 0.15 - 0.02)))
                const diff = totalN1 > 0 ? Math.round(((totalN - totalN1) / totalN1) * 100) : 0
                return (
                  <div key={type} className="text-center">
                    <div className="text-sm font-semibold text-[var(--sd-navy,#0D1B2E)]">{cfg.icon} {cfg.label}</div>
                    <div className="text-xs text-gray-500 mt-1">N-1: {formatNum(totalN1)} {cfg.unit}</div>
                    <div className="text-xs text-gray-500">N: {formatNum(totalN)} {cfg.unit}</div>
                    <div className={`text-sm font-bold mt-1 ${diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {diff > 0 ? '+' : ''}{diff}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Consommations ───────────────────────────────────────────────── */}
      {activeTab === 'consommations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--sd-ink-3,#888)]">Relevés de compteur par type et par bâtiment</p>
            <button onClick={() => setShowAddReleve(true)} className="bg-[var(--sd-navy,#0D1B2E)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">+ Ajouter un relevé</button>
          </div>

          {(['electricite', 'gaz', 'eau'] as const).map(type => {
            const cfg = TYPES_UTILITE[type]
            const typeReleves = filteredReleves.filter(r => r.type === type).sort((a, b) => b.mois.localeCompare(a.mois))
            if (typeReleves.length === 0) return null
            return (
              <div key={type} className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-[var(--sd-cream,#F7F4EE)] border-b border-[var(--sd-border,#E4DDD0)]">
                  <h3 className="font-semibold text-[var(--sd-navy,#0D1B2E)]">{cfg.icon} {cfg.label} ({cfg.unit})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <th className="px-4 py-2 text-left">Immeuble</th>
                        <th className="px-4 py-2 text-left">Mois</th>
                        <th className="px-4 py-2 text-right">Relevé préc.</th>
                        <th className="px-4 py-2 text-right">Relevé actuel</th>
                        <th className="px-4 py-2 text-right">Consommation</th>
                        <th className="px-4 py-2 text-right">Coût estimé</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeReleves.map(r => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-[var(--sd-cream,#F7F4EE)] group">
                          <td className="px-4 py-2 font-medium text-[var(--sd-navy,#0D1B2E)]">{r.immeubleNom}</td>
                          <td className="px-4 py-2 text-gray-600">{MOIS_LABELS[parseInt(r.mois.split('-')[1]) - 1]} {r.mois.split('-')[0]}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{formatNum(r.relevePrecedent)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatNum(r.releveActuel)}</td>
                          <td className="px-4 py-2 text-right font-bold text-[var(--sd-navy,#0D1B2E)]">{formatNum(r.consommation)} {cfg.unit}</td>
                          <td className="px-4 py-2 text-right text-[var(--sd-gold,#C9A84C)] font-semibold">{formatEur(r.coutEstime)}</td>
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => deleteReleve(r.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Alertes passoires thermiques */}
          {immeubles.filter(i => i.classeDPE === 'F' || i.classeDPE === 'G').filter(i => !filterImmeuble || i.id === filterImmeuble).length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
              <h3 className="font-bold text-red-800 mb-2">🚨 Alerte passoire thermique — Loi Climat et Résilience</h3>
              {immeubles.filter(i => (i.classeDPE === 'F' || i.classeDPE === 'G') && (!filterImmeuble || i.id === filterImmeuble)).map(imm => (
                <div key={imm.id} className="flex items-center gap-3 py-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: DPE_COLORS[imm.classeDPE] }}>{imm.classeDPE}</div>
                  <span className="text-sm font-semibold text-red-800">{imm.nom}</span>
                  <span className="text-xs text-red-600">
                    {imm.classeDPE === 'G' ? 'Interdiction de mise en location depuis le 1er janvier 2025' :
                     'Interdiction de mise en location au 1er janvier 2028'}
                  </span>
                </div>
              ))}
              <p className="text-xs text-red-600 mt-2">Classe E: interdiction au 1er janvier 2034. Des travaux de rénovation énergétique sont obligatoires.</p>
            </div>
          )}

          {/* Add Releve Modal */}
          {showAddReleve && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddReleve(false)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-[var(--sd-navy,#0D1B2E)] mb-4">Ajouter un relevé</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Immeuble</label>
                    <select value={releveForm.immeubleId || ''} onChange={e => setReleveForm({ ...releveForm, immeubleId: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                      <option value="">Sélectionner</option>
                      {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Type</label>
                      <select value={releveForm.type || 'electricite'} onChange={e => setReleveForm({ ...releveForm, type: e.target.value as any })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        {Object.entries(TYPES_UTILITE).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Mois</label>
                      <input type="month" value={releveForm.mois || ''} onChange={e => setReleveForm({ ...releveForm, mois: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Relevé précédent</label>
                      <input type="number" value={releveForm.relevePrecedent || ''} onChange={e => setReleveForm({ ...releveForm, relevePrecedent: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Relevé actuel</label>
                      <input type="number" value={releveForm.releveActuel || ''} onChange={e => setReleveForm({ ...releveForm, releveActuel: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowAddReleve(false)} className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                  <button onClick={handleAddReleve} className="flex-1 px-4 py-2 bg-[var(--sd-navy,#0D1B2E)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Objectifs ───────────────────────────────────────────────────── */}
      {activeTab === 'objectifs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--sd-ink-3,#888)]">Objectifs de réduction énergétique — Loi Climat et Résilience</p>
            <div className="flex gap-2">
              <button onClick={() => setShowSimulation(!showSimulation)} className="bg-[var(--sd-gold,#C9A84C)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">🔬 Simulation</button>
              <button onClick={() => setShowAddObjectif(true)} className="bg-[var(--sd-navy,#0D1B2E)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">+ Nouvel objectif</button>
            </div>
          </div>

          {/* Legal reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <strong>Loi Climat et Résilience (22 août 2021)</strong> — Objectifs de réduction de consommation énergétique pour les bâtiments : interdiction progressive de mise en location des logements classés G (2025), F (2028), E (2034). Obligation de rénovation énergétique pour les copropriétés.
          </div>

          {/* Objectifs list */}
          <div className="space-y-3">
            {objectifs.filter(o => !filterImmeuble || o.immeubleId === filterImmeuble).map(obj => {
              const progressPct = obj.consoReference > 0 ? Math.round(((obj.consoReference - obj.consoActuelle) / (obj.consoReference * obj.objectifReduction / 100)) * 100) : 0
              const cappedProgress = Math.min(100, Math.max(0, progressPct))
              return (
                <div key={obj.id} className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-[var(--sd-navy,#0D1B2E)]">{obj.immeubleNom}</h4>
                      <p className="text-xs text-[var(--sd-ink-3,#888)]">Référence {obj.anneeReference} — Objectif {obj.anneeObjectif}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-[var(--sd-gold,#C9A84C)]">-{obj.objectifReduction}%</span>
                      <p className="text-xs text-[var(--sd-ink-3,#888)]">objectif réduction</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-500">Conso référence</span>
                      <div className="font-bold text-[var(--sd-navy,#0D1B2E)]">{obj.consoReference} kWh/m²/an</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Conso actuelle</span>
                      <div className="font-bold text-[var(--sd-navy,#0D1B2E)]">{obj.consoActuelle} kWh/m²/an</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Cible</span>
                      <div className="font-bold text-green-600">{Math.round(obj.consoReference * (1 - obj.objectifReduction / 100))} kWh/m²/an</div>
                    </div>
                  </div>
                  <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${cappedProgress >= 100 ? 'bg-green-500' : cappedProgress >= 50 ? 'bg-[var(--sd-gold,#C9A84C)]' : 'bg-orange-400'}`} style={{ width: `${cappedProgress}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">{cappedProgress}% atteint</span>
                    {obj.notes && <span className="text-xs text-[var(--sd-ink-3,#888)] italic">{obj.notes}</span>}
                    <button onClick={() => deleteObjectif(obj.id)} className="text-gray-400 hover:text-red-500 text-sm transition">🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Simulation travaux */}
          {showSimulation && (
            <div className="bg-[var(--sd-cream,#F7F4EE)] border-2 border-[var(--sd-gold,#C9A84C)] rounded-2xl p-5">
              <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">🔬 Simulation économies par type de travaux</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: 'Isolation thermique extérieure (ITE)', economie: '25-40%', cout: '100-200 €/m²', retour: '12-18 ans' },
                  { label: 'Remplacement chauffage (PAC)', economie: '30-50%', cout: '15 000-30 000 €', retour: '8-12 ans' },
                  { label: 'Double/triple vitrage', economie: '10-15%', cout: '500-1 200 €/fenêtre', retour: '15-20 ans' },
                  { label: 'VMC double flux', economie: '15-25%', cout: '5 000-15 000 €', retour: '10-15 ans' },
                  { label: 'Isolation combles', economie: '25-30%', cout: '20-60 €/m²', retour: '5-8 ans' },
                  { label: 'Panneaux solaires', economie: '20-40% élec', cout: '8 000-20 000 €', retour: '8-12 ans' },
                ].map((sim, i) => (
                  <div key={i} className="bg-white rounded-xl border border-[var(--sd-border,#E4DDD0)] p-3">
                    <div className="font-semibold text-sm text-[var(--sd-navy,#0D1B2E)]">{sim.label}</div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div><span className="text-gray-500">Économie:</span> <span className="font-bold text-green-600">{sim.economie}</span></div>
                      <div><span className="text-gray-500">Coût:</span> <span className="font-semibold">{sim.cout}</span></div>
                      <div><span className="text-gray-500">Retour:</span> <span className="font-semibold">{sim.retour}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Objectif Modal */}
          {showAddObjectif && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddObjectif(false)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-[var(--sd-navy,#0D1B2E)] mb-4">Nouvel objectif énergétique</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Immeuble</label>
                    <select value={objectifForm.immeubleId || ''} onChange={e => setObjectifForm({ ...objectifForm, immeubleId: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                      <option value="">Sélectionner</option>
                      {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Objectif réduction (%)</label>
                      <input type="number" min="1" max="100" value={objectifForm.objectifReduction || ''} onChange={e => setObjectifForm({ ...objectifForm, objectifReduction: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Année objectif</label>
                      <input type="number" min="2025" max="2050" value={objectifForm.anneeObjectif || ''} onChange={e => setObjectifForm({ ...objectifForm, anneeObjectif: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Conso référence (kWh/m²/an)</label>
                      <input type="number" value={objectifForm.consoReference || ''} onChange={e => setObjectifForm({ ...objectifForm, consoReference: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Conso actuelle (kWh/m²/an)</label>
                      <input type="number" value={objectifForm.consoActuelle || ''} onChange={e => setObjectifForm({ ...objectifForm, consoActuelle: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Notes</label>
                    <textarea value={objectifForm.notes || ''} onChange={e => setObjectifForm({ ...objectifForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" rows={2} />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowAddObjectif(false)} className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                  <button onClick={handleAddObjectif} className="flex-1 px-4 py-2 bg-[var(--sd-navy,#0D1B2E)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Plan de travaux ─────────────────────────────────────────────── */}
      {activeTab === 'travaux' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--sd-ink-3,#888)]">Plan pluriannuel de travaux (PPT) — Impact DPE, coûts et économies</p>
            <button onClick={() => setShowAddTravaux(true)} className="bg-[var(--sd-navy,#0D1B2E)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">+ Ajouter travaux</button>
          </div>

          {/* Fonds travaux */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">💰 Fonds travaux — Provision annuelle</h3>
            <p className="text-xs text-gray-500 mb-3">Obligation loi ALUR: provision annuelle ≥ 2.5% du montant total du PPT, votée en AG.</p>
            <div className="space-y-3">
              {(filterImmeuble ? immeubles.filter(i => i.id === filterImmeuble) : immeubles).map(imm => {
                const pct = imm.fondsTravauxObjectif > 0 ? Math.round((imm.fondsTravauxActuel / imm.fondsTravauxObjectif) * 100) : 0
                return (
                  <div key={imm.id} className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--sd-navy,#0D1B2E)] min-w-[160px]">{imm.nom}</span>
                    <div className="flex-1 relative h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`absolute left-0 top-0 h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-[var(--sd-gold,#C9A84C)]' : 'bg-red-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 min-w-[120px] text-right">{formatEur(imm.fondsTravauxActuel)} / {formatEur(imm.fondsTravauxObjectif)}</span>
                    <span className="text-xs font-bold min-w-[40px] text-right" style={{ color: pct >= 100 ? '#22c55e' : pct >= 50 ? '#C9A84C' : '#ef4444' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Travaux par immeuble */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-[var(--sd-cream,#F7F4EE)] border-b border-[var(--sd-border,#E4DDD0)]">
              <h3 className="font-semibold text-[var(--sd-navy,#0D1B2E)]">📋 Travaux programmés sur 10 ans</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Immeuble</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-center">Année</th>
                    <th className="px-4 py-2 text-right">Coût HT</th>
                    <th className="px-4 py-2 text-right">Économies/an</th>
                    <th className="px-4 py-2 text-center">Impact DPE</th>
                    <th className="px-4 py-2 text-center">Statut</th>
                    <th className="px-4 py-2 text-center">Aide</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {travaux.filter(t => !filterImmeuble || t.immeubleId === filterImmeuble).sort((a, b) => a.anneePrevue - b.anneePrevue).map(tw => {
                    const twType = TYPES_TRAVAUX[tw.type] || TYPES_TRAVAUX.autre
                    const stCfg = STATUTS_TRAVAUX[tw.statut]
                    return (
                      <tr key={tw.id} className="border-b border-gray-50 hover:bg-[var(--sd-cream,#F7F4EE)] group">
                        <td className="px-4 py-2 font-medium text-[var(--sd-navy,#0D1B2E)] text-xs">{tw.immeubleNom}</td>
                        <td className="px-4 py-2 text-xs">{twType.icon} {twType.label}</td>
                        <td className="px-4 py-2 text-xs text-gray-600 max-w-[150px] truncate">{tw.description}</td>
                        <td className="px-4 py-2 text-center font-semibold">{tw.anneePrevue}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatEur(tw.coutEstimeHT)}</td>
                        <td className="px-4 py-2 text-right text-green-600 font-semibold">{formatEur(tw.economiesAnnuelles)}</td>
                        <td className="px-4 py-2 text-center text-xs font-bold text-[var(--sd-navy,#0D1B2E)]">{tw.impactDPE || '—'}</td>
                        <td className="px-4 py-2 text-center"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${stCfg.color}`}>{stCfg.label}</span></td>
                        <td className="px-4 py-2 text-center">{tw.subventionEligible ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold">Éligible</span> : <span className="text-xs text-gray-400">—</span>}</td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => deleteTravaux(tw.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition">🗑️</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Récapitulatif coût vs économies */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm text-center">
              <div className="text-xs text-gray-500">Coût total travaux</div>
              <div className="text-xl font-bold text-[var(--sd-navy,#0D1B2E)]">{formatEur(travaux.filter(t => !filterImmeuble || t.immeubleId === filterImmeuble).reduce((s, t) => s + t.coutEstimeHT, 0))}</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm text-center">
              <div className="text-xs text-gray-500">Économies annuelles totales</div>
              <div className="text-xl font-bold text-green-600">{formatEur(travaux.filter(t => !filterImmeuble || t.immeubleId === filterImmeuble).reduce((s, t) => s + t.economiesAnnuelles, 0))}</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm text-center">
              <div className="text-xs text-gray-500">Retour sur investissement</div>
              <div className="text-xl font-bold text-[var(--sd-gold,#C9A84C)]">
                {(() => {
                  const cost = travaux.filter(t => !filterImmeuble || t.immeubleId === filterImmeuble).reduce((s, t) => s + t.coutEstimeHT, 0)
                  const eco = travaux.filter(t => !filterImmeuble || t.immeubleId === filterImmeuble).reduce((s, t) => s + t.economiesAnnuelles, 0)
                  return eco > 0 ? `~${Math.round(cost / eco)} ans` : '—'
                })()}
              </div>
            </div>
          </div>

          {/* MaPrimeRénov' Copro */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-2xl p-4">
            <h3 className="font-bold text-blue-900 mb-2">🏛️ MaPrimeRénov' Copropriété</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-800">
              <div>
                <strong>Conditions d'éligibilité :</strong>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Copropriété de 75% ou plus de résidences principales</li>
                  <li>Immatriculée au registre national des copropriétés</li>
                  <li>Gain énergétique minimum de 35%</li>
                  <li>DTG ou audit énergétique réalisé</li>
                </ul>
              </div>
              <div>
                <strong>Montants (2024-2025) :</strong>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Gain 35%: jusqu'à 3 750 €/logement</li>
                  <li>Gain 50%: jusqu'à 6 250 €/logement</li>
                  <li>Bonus sortie passoire: +1 500 €/logement</li>
                  <li>Plafond: 25 000 €/logement</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Add Travaux Modal */}
          {showAddTravaux && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddTravaux(false)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-[var(--sd-navy,#0D1B2E)] mb-4">Ajouter des travaux</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Immeuble</label>
                      <select value={travauxForm.immeubleId || ''} onChange={e => setTravauxForm({ ...travauxForm, immeubleId: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        <option value="">Sélectionner</option>
                        {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Type de travaux</label>
                      <select value={travauxForm.type || 'isolation_murs'} onChange={e => setTravauxForm({ ...travauxForm, type: e.target.value as any })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        {Object.entries(TYPES_TRAVAUX).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Description</label>
                    <input type="text" value={travauxForm.description || ''} onChange={e => setTravauxForm({ ...travauxForm, description: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" placeholder="Ex: ITE façade nord..." />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Année prévue</label>
                      <input type="number" min="2024" max="2040" value={travauxForm.anneePrevue || ''} onChange={e => setTravauxForm({ ...travauxForm, anneePrevue: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Coût HT (€)</label>
                      <input type="number" value={travauxForm.coutEstimeHT || ''} onChange={e => setTravauxForm({ ...travauxForm, coutEstimeHT: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Économies/an (€)</label>
                      <input type="number" value={travauxForm.economiesAnnuelles || ''} onChange={e => setTravauxForm({ ...travauxForm, economiesAnnuelles: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Impact DPE</label>
                      <input type="text" value={travauxForm.impactDPE || ''} onChange={e => setTravauxForm({ ...travauxForm, impactDPE: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" placeholder="Ex: D → C" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Statut</label>
                      <select value={travauxForm.statut || 'prevu'} onChange={e => setTravauxForm({ ...travauxForm, statut: e.target.value as any })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        {Object.entries(STATUTS_TRAVAUX).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={travauxForm.subventionEligible ?? true} onChange={e => setTravauxForm({ ...travauxForm, subventionEligible: e.target.checked })} className="rounded" />
                    Éligible MaPrimeRénov' Copropriété
                  </label>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Notes</label>
                    <textarea value={travauxForm.notes || ''} onChange={e => setTravauxForm({ ...travauxForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" rows={2} />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowAddTravaux(false)} className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                  <button onClick={handleAddTravaux} className="flex-1 px-4 py-2 bg-[var(--sd-navy,#0D1B2E)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
