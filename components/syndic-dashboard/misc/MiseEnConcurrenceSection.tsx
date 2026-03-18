'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseMarche = 'consultation' | 'reception_devis' | 'comparaison' | 'vote_ag' | 'attribution' | 'execution' | 'reception_travaux'
type TypeMarche = 'entretien' | 'reparation' | 'renovation' | 'urgence'

interface Devis {
  id: string
  marcheId: string
  entreprise: string
  montantHT: number
  tauxTVA: number // 5.5, 10, 20
  delaiJours: number
  garantie: 'decennale' | 'biennale' | 'aucune'
  materiaux: string
  conditionsPaiement: string
  assuranceRCPro: boolean
  references: number // 1-5
  dateReception: string
}

interface Marche {
  id: string
  titre: string
  description: string
  type: TypeMarche
  immeuble: string
  budgetEstime: number
  phase: PhaseMarche
  progression: number // 0-100
  delai: string // date limite
  prestataireRetenu?: string
  montantRetenu?: number
  dateCloture?: string
  resultat?: string
  dateCreation: string
}

interface ConfigConcurrence {
  seuilMiseEnConcurrence: number // montant voté en AG
}

interface Props {
  user: any
  userRole: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const PHASES_CONFIG: Record<PhaseMarche, { label: string; emoji: string; bg: string; color: string; dot: string }> = {
  consultation:       { label: 'Consultation',       emoji: '📢', bg: '#FEF5E4', color: '#D4830A', dot: '#D4830A' },
  reception_devis:    { label: 'Réception devis',    emoji: '📥', bg: '#EDE8FF', color: '#6C5CE7', dot: '#6C5CE7' },
  comparaison:        { label: 'Comparaison',        emoji: '📊', bg: '#E6F4F2', color: '#1A7A6E', dot: '#1A7A6E' },
  vote_ag:            { label: 'Vote AG',            emoji: '🗳️', bg: '#FFF0F0', color: '#D63031', dot: '#D63031' },
  attribution:        { label: 'Attribution',        emoji: '🏆', bg: '#FCF3CF', color: '#B7950B', dot: '#B7950B' },
  execution:          { label: 'Exécution',          emoji: '🔧', bg: '#D5F5E3', color: '#1E8449', dot: '#1E8449' },
  reception_travaux:  { label: 'Réception travaux',  emoji: '✅', bg: '#F0F9E8', color: '#2D8A4E', dot: '#2D8A4E' },
}

const PHASES_PIPELINE: PhaseMarche[] = ['consultation', 'reception_devis', 'comparaison', 'vote_ag', 'attribution', 'execution', 'reception_travaux']

const TYPES_MARCHE: Record<TypeMarche, { label: string; emoji: string }> = {
  entretien:  { emoji: '🔧', label: 'Entretien courant' },
  reparation: { emoji: '🛠️', label: 'Réparation' },
  renovation: { emoji: '🏗️', label: 'Rénovation' },
  urgence:    { emoji: '🚨', label: 'Travaux urgents' },
}

const GARANTIES: Record<string, string> = {
  decennale: 'Décennale (10 ans)',
  biennale: 'Biennale (2 ans)',
  aucune: 'Aucune',
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const sCard: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 12, padding: 16,
}
const sBtnPrimary: React.CSSProperties = {
  background: 'var(--sd-navy, #0D1B2E)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const sBtnSecondary: React.CSSProperties = {
  background: 'var(--sd-cream, #F7F4EE)', color: 'var(--sd-navy, #0D1B2E)', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const sInput: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--sd-border, #E4DDD0)', borderRadius: 8, fontSize: 14, background: '#fff', outline: 'none',
}
const sLabel: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 6,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const montantTTC = (ht: number, tva: number) => ht * (1 + tva / 100)

function scoreDevis(d: Devis, allDevis: Devis[]): { score: number; detail: { prix: number; delai: number; garantie: number; references: number } } {
  if (allDevis.length === 0) return { score: 0, detail: { prix: 0, delai: 0, garantie: 0, references: 0 } }

  const minHT = Math.min(...allDevis.map(x => x.montantHT))
  const maxHT = Math.max(...allDevis.map(x => x.montantHT))
  const minDelai = Math.min(...allDevis.map(x => x.delaiJours))
  const maxDelai = Math.max(...allDevis.map(x => x.delaiJours))

  const prixScore = maxHT === minHT ? 100 : Math.round(100 - ((d.montantHT - minHT) / (maxHT - minHT)) * 100)
  const delaiScore = maxDelai === minDelai ? 100 : Math.round(100 - ((d.delaiJours - minDelai) / (maxDelai - minDelai)) * 100)
  const garantieScore = d.garantie === 'decennale' ? 100 : d.garantie === 'biennale' ? 60 : 20
  const refScore = Math.round((d.references / 5) * 100)

  const total = Math.round(prixScore * 0.4 + delaiScore * 0.2 + garantieScore * 0.2 + refScore * 0.2)
  return { score: total, detail: { prix: prixScore, delai: delaiScore, garantie: garantieScore, references: refScore } }
}

function joursRestants(dateLimite: string): number {
  return Math.ceil((new Date(dateLimite).getTime() - Date.now()) / 86400000)
}

// ─── Données démo ────────────────────────────────────────────────────────────

function genererDemoData(): { marches: Marche[]; devis: Devis[] } {
  const m1Id = 'demo-marche-001'
  const m2Id = 'demo-marche-002'

  const marches: Marche[] = [
    {
      id: m1Id,
      titre: 'Ravalement de la façade principale',
      description: 'Ravalement complet avec traitement anti-humidité, nettoyage des balcons et peinture des garde-corps. Échafaudage nécessaire sur toute la hauteur.',
      type: 'renovation',
      immeuble: 'Résidence Les Oliviers — 42 av. Jean Jaurès',
      budgetEstime: 45000,
      phase: 'comparaison',
      progression: 35,
      delai: '2026-07-15',
      dateCreation: '2026-02-10',
    },
    {
      id: m2Id,
      titre: 'Remplacement de la chaudière collective',
      description: 'Remplacement de la chaudière gaz collective vétuste par une chaudière à condensation haute performance. Mise aux normes du local technique.',
      type: 'reparation',
      immeuble: 'Résidence Bel Air — 15 rue de la Paix',
      budgetEstime: 28000,
      phase: 'reception_devis',
      progression: 15,
      delai: '2026-09-01',
      dateCreation: '2026-03-01',
    },
  ]

  const devis: Devis[] = [
    // Devis pour ravalement (m1)
    {
      id: 'demo-devis-001', marcheId: m1Id, entreprise: 'Bâtiment Méditerranée SARL',
      montantHT: 42500, tauxTVA: 10, delaiJours: 60, garantie: 'decennale',
      materiaux: 'Enduit siloxane hydrofuge, peinture acrylique façade, zinc pour garde-corps',
      conditionsPaiement: '30% commande, 40% mi-travaux, 30% réception',
      assuranceRCPro: true, references: 4, dateReception: '2026-03-05',
    },
    {
      id: 'demo-devis-002', marcheId: m1Id, entreprise: 'Provence Rénovation SAS',
      montantHT: 38900, tauxTVA: 10, delaiJours: 75, garantie: 'decennale',
      materiaux: 'Enduit minéral chaux, peinture siloxane, acier galvanisé garde-corps',
      conditionsPaiement: '20% commande, 30% à 30 jours, 30% mi-travaux, 20% réception',
      assuranceRCPro: true, references: 5, dateReception: '2026-03-08',
    },
    {
      id: 'demo-devis-003', marcheId: m1Id, entreprise: 'ArtBat Construction',
      montantHT: 47200, tauxTVA: 10, delaiJours: 45, garantie: 'decennale',
      materiaux: 'Enduit RPE isolant thermique, peinture photocatalytique, aluminium laqué',
      conditionsPaiement: '50% commande, 50% réception',
      assuranceRCPro: true, references: 3, dateReception: '2026-03-10',
    },
    // Devis pour chaudière (m2)
    {
      id: 'demo-devis-004', marcheId: m2Id, entreprise: 'Thermo-Sud Installation',
      montantHT: 26800, tauxTVA: 10, delaiJours: 30, garantie: 'biennale',
      materiaux: 'Chaudière condensation Viessmann Vitodens 200, circulateurs Grundfos',
      conditionsPaiement: '40% commande, 60% réception', assuranceRCPro: true, references: 4,
      dateReception: '2026-03-12',
    },
    {
      id: 'demo-devis-005', marcheId: m2Id, entreprise: 'Énergie Confort Pro',
      montantHT: 24500, tauxTVA: 10, delaiJours: 40, garantie: 'decennale',
      materiaux: 'Chaudière condensation De Dietrich Evodens Pro, régulation Siemens',
      conditionsPaiement: '30% commande, 40% à 30 jours, 30% réception', assuranceRCPro: true, references: 5,
      dateReception: '2026-03-11',
    },
    {
      id: 'demo-devis-006', marcheId: m2Id, entreprise: 'Chauffage Express SARL',
      montantHT: 29500, tauxTVA: 10, delaiJours: 21, garantie: 'biennale',
      materiaux: 'Chaudière condensation Atlantic Naema, pompes Wilo',
      conditionsPaiement: '50% commande, 50% réception', assuranceRCPro: false, references: 2,
      dateReception: '2026-03-09',
    },
  ]

  return { marches, devis }
}

// ─── Réglementation ──────────────────────────────────────────────────────────

const ARTICLES_REGLEMENTATION = [
  {
    ref: 'Art. 21 — Loi du 10 juillet 1965',
    titre: 'Obligation de mise en concurrence',
    contenu: 'Le syndic est tenu de soumettre au vote de l\'assemblée générale la question de la mise en concurrence pour tout marché ou contrat dépassant le seuil fixé par l\'assemblée. Ce seuil doit être voté chaque année en AG.',
    importance: 'haute',
  },
  {
    ref: 'Art. 19-2 — Décret du 17 mars 1967',
    titre: 'Conditions de mise en concurrence',
    contenu: 'Le syndic doit recueillir plusieurs devis pour tout projet de travaux dépassant le montant voté en AG. La présentation de trois devis minimum est une pratique recommandée, même si la loi ne fixe pas de nombre précis.',
    importance: 'haute',
  },
  {
    ref: 'Art. 18 al. 2 — Loi du 10 juillet 1965',
    titre: 'Exception : travaux urgents',
    contenu: 'En cas d\'urgence nécessaire à la sauvegarde de l\'immeuble, le syndic peut engager des travaux sans mise en concurrence préalable. Il doit toutefois en informer les copropriétaires dans les meilleurs délais et convoquer une AG extraordinaire si nécessaire.',
    importance: 'moyenne',
  },
  {
    ref: 'Art. 1792 — Code civil',
    titre: 'Garantie décennale',
    contenu: 'Tout constructeur d\'un ouvrage est responsable de plein droit, envers le maître de l\'ouvrage, des dommages qui compromettent la solidité de l\'ouvrage ou le rendent impropre à sa destination. Cette garantie court pendant dix ans à compter de la réception des travaux.',
    importance: 'haute',
  },
  {
    ref: 'Art. 1792-3 — Code civil',
    titre: 'Garantie biennale (bon fonctionnement)',
    contenu: 'Les éléments d\'équipement dissociables de l\'ouvrage (volets, chaudière, robinetterie, etc.) sont couverts par une garantie de bon fonctionnement de deux ans à compter de la réception.',
    importance: 'moyenne',
  },
  {
    ref: 'Loi Spinetta — 4 janvier 1978',
    titre: 'Assurance construction obligatoire',
    contenu: 'Toute personne qui fait réaliser des travaux de construction doit souscrire une assurance dommages-ouvrage. Les entreprises de travaux doivent justifier d\'une assurance responsabilité civile professionnelle et d\'une garantie décennale.',
    importance: 'haute',
  },
  {
    ref: 'TVA travaux — Code général des impôts',
    titre: 'Taux de TVA applicables aux travaux',
    contenu: 'Trois taux s\'appliquent aux travaux en copropriété : 5,5 % pour les travaux de rénovation énergétique (isolation, chaudière à condensation, pompe à chaleur), 10 % pour les travaux de rénovation et d\'amélioration (ravalement, plomberie, électricité), 20 % pour les constructions neuves et les travaux d\'agrandissement.',
    importance: 'haute',
  },
]

// ─── Composant principal ─────────────────────────────────────────────────────

export default function MiseEnConcurrenceSection({ user, userRole }: Props) {
  const uid = user?.id || 'demo'
  const STORAGE_KEY = `fixit_concurrence_fr_${uid}`

  const [activeTab, setActiveTab] = useState<'marches' | 'comparaison' | 'archives' | 'reglementation'>('marches')
  const [marches, setMarches] = useState<Marche[]>([])
  const [devis, setDevis] = useState<Devis[]>([])
  const [config, setConfig] = useState<ConfigConcurrence>({ seuilMiseEnConcurrence: 5000 })

  // Modales
  const [showMarcheModal, setShowMarcheModal] = useState(false)
  const [showDevisModal, setShowDevisModal] = useState(false)
  const [selectedMarche, setSelectedMarche] = useState<Marche | null>(null)
  const [comparaisonMarcheId, setComparaisonMarcheId] = useState<string>('')

  // Formulaires
  const emptyMarcheForm = {
    titre: '', description: '', type: 'entretien' as TypeMarche, immeuble: '', budgetEstime: '', delai: '',
  }
  const emptyDevisForm = {
    marcheId: '', entreprise: '', montantHT: '', tauxTVA: '10', delaiJours: '', garantie: 'decennale' as 'decennale' | 'biennale' | 'aucune',
    materiaux: '', conditionsPaiement: '', assuranceRCPro: true, references: '3',
  }
  const [marcheForm, setMarcheForm] = useState(emptyMarcheForm)
  const [devisForm, setDevisForm] = useState(emptyDevisForm)

  // Archives search
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archiveAnnee, setArchiveAnnee] = useState('')
  const [archiveType, setArchiveType] = useState('')
  const [archiveImmeuble, setArchiveImmeuble] = useState('')

  // ── Persistance ─────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        setMarches(data.marches || [])
        setDevis(data.devis || [])
        if (data.config) setConfig(data.config)
      } else {
        // Charger les données de démo
        const demo = genererDemoData()
        setMarches(demo.marches)
        setDevis(demo.devis)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ marches: demo.marches, devis: demo.devis, config: { seuilMiseEnConcurrence: 5000 } }))
      }
    } catch {
      const demo = genererDemoData()
      setMarches(demo.marches)
      setDevis(demo.devis)
    }
  }, [])

  const save = (m: Marche[], d: Devis[], c?: ConfigConcurrence) => {
    setMarches(m)
    setDevis(d)
    if (c) setConfig(c)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ marches: m, devis: d, config: c || config }))
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAddMarche = () => {
    if (!marcheForm.titre.trim() || !marcheForm.immeuble.trim()) return
    const nouveau: Marche = {
      id: Date.now().toString(),
      titre: marcheForm.titre,
      description: marcheForm.description,
      type: marcheForm.type,
      immeuble: marcheForm.immeuble,
      budgetEstime: parseFloat(marcheForm.budgetEstime) || 0,
      phase: 'consultation',
      progression: 0,
      delai: marcheForm.delai || '',
      dateCreation: new Date().toISOString().split('T')[0],
    }
    save([nouveau, ...marches], devis)
    setShowMarcheModal(false)
    setMarcheForm(emptyMarcheForm)
  }

  const handleAddDevis = () => {
    if (!devisForm.entreprise.trim() || !devisForm.marcheId) return
    const nouveau: Devis = {
      id: Date.now().toString(),
      marcheId: devisForm.marcheId,
      entreprise: devisForm.entreprise,
      montantHT: parseFloat(devisForm.montantHT) || 0,
      tauxTVA: parseFloat(devisForm.tauxTVA) || 10,
      delaiJours: parseInt(devisForm.delaiJours) || 30,
      garantie: devisForm.garantie,
      materiaux: devisForm.materiaux,
      conditionsPaiement: devisForm.conditionsPaiement,
      assuranceRCPro: devisForm.assuranceRCPro,
      references: parseInt(devisForm.references) || 3,
      dateReception: new Date().toISOString().split('T')[0],
    }
    save(marches, [nouveau, ...devis])
    setShowDevisModal(false)
    setDevisForm(emptyDevisForm)
  }

  const avancerPhase = (marcheId: string) => {
    const idx = PHASES_PIPELINE.indexOf(marches.find(m => m.id === marcheId)?.phase || 'consultation')
    if (idx < PHASES_PIPELINE.length - 1) {
      const nextPhase = PHASES_PIPELINE[idx + 1]
      const progression = Math.round(((idx + 2) / PHASES_PIPELINE.length) * 100)
      const updated = marches.map(m => m.id === marcheId ? { ...m, phase: nextPhase, progression } : m)
      save(updated, devis)
    }
  }

  const reculerPhase = (marcheId: string) => {
    const idx = PHASES_PIPELINE.indexOf(marches.find(m => m.id === marcheId)?.phase || 'consultation')
    if (idx > 0) {
      const prevPhase = PHASES_PIPELINE[idx - 1]
      const progression = Math.round((idx / PHASES_PIPELINE.length) * 100)
      const updated = marches.map(m => m.id === marcheId ? { ...m, phase: prevPhase, progression } : m)
      save(updated, devis)
    }
  }

  const cloturerMarche = (marcheId: string, entreprise: string, montant: number) => {
    const updated = marches.map(m => m.id === marcheId ? {
      ...m,
      phase: 'reception_travaux' as PhaseMarche,
      progression: 100,
      prestataireRetenu: entreprise,
      montantRetenu: montant,
      dateCloture: new Date().toISOString().split('T')[0],
      resultat: `Marché attribué à ${entreprise} pour ${formatEur(montant)}`,
    } : m)
    save(updated, devis)
  }

  const supprimerMarche = (marcheId: string) => {
    const updated = marches.filter(m => m.id !== marcheId)
    const updatedDevis = devis.filter(d => d.marcheId !== marcheId)
    save(updated, updatedDevis)
    if (selectedMarche?.id === marcheId) setSelectedMarche(null)
  }

  // ── Données calculées ───────────────────────────────────────────────────────

  const marchesActifs = useMemo(() => marches.filter(m => m.phase !== 'reception_travaux'), [marches])
  const marchesArchives = useMemo(() => marches.filter(m => m.phase === 'reception_travaux' || m.dateCloture), [marches])
  const marchesComparables = useMemo(() => marches.filter(m => {
    const devisCount = devis.filter(d => d.marcheId === m.id).length
    return devisCount >= 1
  }), [marches, devis])

  const archivesFiltrees = useMemo(() => {
    let filteredMarches = marchesArchives
    if (archiveSearch) filteredMarches = filteredMarches.filter(m => m.titre.toLowerCase().includes(archiveSearch.toLowerCase()) || m.immeuble.toLowerCase().includes(archiveSearch.toLowerCase()))
    if (archiveAnnee) filteredMarches = filteredMarches.filter(m => (m.dateCloture || m.dateCreation).startsWith(archiveAnnee))
    if (archiveType) filteredMarches = filteredMarches.filter(m => m.type === archiveType)
    if (archiveImmeuble) filteredMarches = filteredMarches.filter(m => m.immeuble.includes(archiveImmeuble))
    return filteredMarches
  }, [marchesArchives, archiveSearch, archiveAnnee, archiveType, archiveImmeuble])

  const totalBudgetActif = useMemo(() => marchesActifs.reduce((s, m) => s + m.budgetEstime, 0), [marchesActifs])
  const totalDevisRecus = useMemo(() => devis.length, [devis])

  // ── Tab bar ──────────────────────────────────────────────────────────────────

  const TABS: { key: typeof activeTab; label: string; emoji: string }[] = [
    { key: 'marches', label: 'Marchés en cours', emoji: '📋' },
    { key: 'comparaison', label: 'Comparaison devis', emoji: '📊' },
    { key: 'archives', label: 'Archives', emoji: '🗄️' },
    { key: 'reglementation', label: 'Réglementation', emoji: '⚖️' },
  ]

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderProgressBar = (pct: number, color: string) => (
    <div style={{ width: '100%', height: 6, background: 'var(--sd-cream, #F7F4EE)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )

  const renderBadge = (text: string, bg: string, color: string) => (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: bg, color }}>{text}</span>
  )

  // ── Modale formulaire marché ────────────────────────────────────────────────

  const renderMarcheModal = () => {
    if (!showMarcheModal) return null
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)', padding: 20 }} onClick={() => setShowMarcheModal(false)}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, color: 'var(--sd-navy, #0D1B2E)' }}>Nouveau marché de travaux</h3>

          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Titre des travaux *</label>
            <input style={sInput} placeholder="Ex : Ravalement façade nord" value={marcheForm.titre} onChange={e => setMarcheForm({ ...marcheForm, titre: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Description</label>
            <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} placeholder="Détails du marché, spécifications techniques..." value={marcheForm.description} onChange={e => setMarcheForm({ ...marcheForm, description: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Type de travaux</label>
              <select style={sInput} value={marcheForm.type} onChange={e => setMarcheForm({ ...marcheForm, type: e.target.value as TypeMarche })}>
                {Object.entries(TYPES_MARCHE).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={sLabel}>Immeuble *</label>
              <input style={sInput} placeholder="Nom ou adresse" value={marcheForm.immeuble} onChange={e => setMarcheForm({ ...marcheForm, immeuble: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={sLabel}>Budget estimé (EUR HT)</label>
              <input style={sInput} type="number" placeholder="Ex : 45000" value={marcheForm.budgetEstime} onChange={e => setMarcheForm({ ...marcheForm, budgetEstime: e.target.value })} />
            </div>
            <div>
              <label style={sLabel}>Date limite</label>
              <input style={sInput} type="date" value={marcheForm.delai} onChange={e => setMarcheForm({ ...marcheForm, delai: e.target.value })} />
            </div>
          </div>

          {parseFloat(marcheForm.budgetEstime) > 0 && parseFloat(marcheForm.budgetEstime) < config.seuilMiseEnConcurrence && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#795548' }}>
              Ce montant est inférieur au seuil de mise en concurrence ({formatEur(config.seuilMiseEnConcurrence)} voté en AG). La mise en concurrence n&apos;est pas obligatoire mais reste recommandée.
            </div>
          )}

          {marcheForm.type === 'urgence' && (
            <div style={{ background: '#FFF0F0', border: '1px solid #EF9A9A', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#C62828' }}>
              Art. 18 al. 2 loi 1965 : en cas d&apos;urgence pour la sauvegarde de l&apos;immeuble, le syndic peut engager les travaux sans mise en concurrence, mais doit informer les copropriétaires.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={sBtnSecondary} onClick={() => setShowMarcheModal(false)}>Annuler</button>
            <button style={sBtnPrimary} onClick={handleAddMarche}>Créer le marché</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Modale formulaire devis ────────────────────────────────────────────────

  const renderDevisModal = () => {
    if (!showDevisModal) return null
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)', padding: 20 }} onClick={() => setShowDevisModal(false)}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, color: 'var(--sd-navy, #0D1B2E)' }}>Ajouter un devis</h3>

          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Marché concerné *</label>
            <select style={sInput} value={devisForm.marcheId} onChange={e => setDevisForm({ ...devisForm, marcheId: e.target.value })}>
              <option value="">-- Sélectionner --</option>
              {marchesActifs.map(m => <option key={m.id} value={m.id}>{m.titre} ({m.immeuble})</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Entreprise *</label>
            <input style={sInput} placeholder="Nom de l'entreprise" value={devisForm.entreprise} onChange={e => setDevisForm({ ...devisForm, entreprise: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Montant HT (EUR)</label>
              <input style={sInput} type="number" placeholder="Ex : 42500" value={devisForm.montantHT} onChange={e => setDevisForm({ ...devisForm, montantHT: e.target.value })} />
            </div>
            <div>
              <label style={sLabel}>Taux TVA (%)</label>
              <select style={sInput} value={devisForm.tauxTVA} onChange={e => setDevisForm({ ...devisForm, tauxTVA: e.target.value })}>
                <option value="5.5">5,5 % (réno. énergétique)</option>
                <option value="10">10 % (rénovation)</option>
                <option value="20">20 % (neuf)</option>
              </select>
            </div>
            <div>
              <label style={sLabel}>Délai (jours)</label>
              <input style={sInput} type="number" placeholder="Ex : 60" value={devisForm.delaiJours} onChange={e => setDevisForm({ ...devisForm, delaiJours: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Garantie</label>
              <select style={sInput} value={devisForm.garantie} onChange={e => setDevisForm({ ...devisForm, garantie: e.target.value as any })}>
                <option value="decennale">Décennale (10 ans)</option>
                <option value="biennale">Biennale (2 ans)</option>
                <option value="aucune">Aucune</option>
              </select>
            </div>
            <div>
              <label style={sLabel}>Références (1-5)</label>
              <select style={sInput} value={devisForm.references} onChange={e => setDevisForm({ ...devisForm, references: e.target.value })}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}/5</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Matériaux</label>
            <input style={sInput} placeholder="Matériaux principaux..." value={devisForm.materiaux} onChange={e => setDevisForm({ ...devisForm, materiaux: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Conditions de paiement</label>
            <input style={sInput} placeholder="Ex : 30% commande, 40% mi-travaux, 30% réception" value={devisForm.conditionsPaiement} onChange={e => setDevisForm({ ...devisForm, conditionsPaiement: e.target.value })} />
          </div>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="rc-pro" checked={devisForm.assuranceRCPro} onChange={e => setDevisForm({ ...devisForm, assuranceRCPro: e.target.checked })} />
            <label htmlFor="rc-pro" style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)' }}>Assurance RC Professionnelle attestée</label>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={sBtnSecondary} onClick={() => setShowDevisModal(false)}>Annuler</button>
            <button style={sBtnPrimary} onClick={handleAddDevis}>Enregistrer le devis</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Détail marché (side panel) ──────────────────────────────────────────────

  const renderMarcheDetail = () => {
    if (!selectedMarche) return null
    const m = selectedMarche
    const marcheDevis = devis.filter(d => d.marcheId === m.id)
    const phaseConf = PHASES_CONFIG[m.phase]
    const typeConf = TYPES_MARCHE[m.type]
    const jours = m.delai ? joursRestants(m.delai) : null

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.35)' }} onClick={() => setSelectedMarche(null)}>
        <div style={{ background: '#fff', width: '100%', maxWidth: 520, height: '100%', overflow: 'auto', padding: 28, boxShadow: '-4px 0 20px rgba(0,0,0,.1)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: 'var(--sd-navy, #0D1B2E)' }}>{m.titre}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)' }}>{m.immeuble}</p>
            </div>
            <button style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--sd-ink-3, #8A9BB0)' }} onClick={() => setSelectedMarche(null)}>x</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {renderBadge(`${phaseConf.emoji} ${phaseConf.label}`, phaseConf.bg, phaseConf.color)}
            {renderBadge(`${typeConf.emoji} ${typeConf.label}`, 'var(--sd-cream, #F7F4EE)', 'var(--sd-navy, #0D1B2E)')}
            {jours !== null && renderBadge(
              jours > 0 ? `${jours} jours restants` : 'Délai dépassé',
              jours > 14 ? '#E8F5E9' : jours > 0 ? '#FFF8E1' : '#FFEBEE',
              jours > 14 ? '#2E7D32' : jours > 0 ? '#F57F17' : '#C62828'
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>
              <span>Progression</span><span>{m.progression} %</span>
            </div>
            {renderProgressBar(m.progression, phaseConf.dot)}
          </div>

          <div style={{ ...sCard, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.6 }}>{m.description || 'Aucune description.'}</div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Budget estimé</span><br /><strong style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{formatEur(m.budgetEstime)}</strong></div>
              <div><span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Date limite</span><br /><strong style={{ color: 'var(--sd-navy, #0D1B2E)' }}>{m.delai ? new Date(m.delai).toLocaleDateString('fr-FR') : '—'}</strong></div>
              {m.prestataireRetenu && <div><span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Prestataire retenu</span><br /><strong style={{ color: '#2E7D32' }}>{m.prestataireRetenu}</strong></div>}
              {m.montantRetenu && <div><span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Montant retenu</span><br /><strong style={{ color: '#2E7D32' }}>{formatEur(m.montantRetenu)}</strong></div>}
            </div>
          </div>

          {/* Devis associés */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>Devis re\u00e7us ({marcheDevis.length})</h4>
              <button style={{ ...sBtnPrimary, padding: '6px 14px', fontSize: 12 }} onClick={() => { setDevisForm({ ...emptyDevisForm, marcheId: m.id }); setShowDevisModal(true) }}>+ Devis</button>
            </div>
            {marcheDevis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--sd-ink-3, #8A9BB0)', fontSize: 13 }}>Aucun devis enregistré pour ce marché.</div>
            ) : marcheDevis.map(d => {
              const { score } = scoreDevis(d, marcheDevis)
              return (
                <div key={d.id} style={{ ...sCard, marginBottom: 8, borderLeft: `3px solid ${score >= 70 ? '#2E7D32' : score >= 50 ? '#F57F17' : '#C62828'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>{d.entreprise}</strong>
                    <span style={{ fontSize: 13, fontWeight: 700, color: score >= 70 ? '#2E7D32' : score >= 50 ? '#F57F17' : '#C62828' }}>{score}/100</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8, fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                    <div>HT: {formatEur(d.montantHT)}</div>
                    <div>TVA: {d.tauxTVA} %</div>
                    <div>TTC: {formatEur(montantTTC(d.montantHT, d.tauxTVA))}</div>
                    <div>Délai: {d.delaiJours} j</div>
                    <div>Garantie: {GARANTIES[d.garantie]?.split(' (')[0] || d.garantie}</div>
                    <div>RC Pro: {d.assuranceRCPro ? 'Oui' : 'Non'}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PHASES_PIPELINE.indexOf(m.phase) > 0 && (
              <button style={sBtnSecondary} onClick={() => { reculerPhase(m.id); setSelectedMarche({ ...m, phase: PHASES_PIPELINE[PHASES_PIPELINE.indexOf(m.phase) - 1], progression: Math.round((PHASES_PIPELINE.indexOf(m.phase)) / PHASES_PIPELINE.length * 100) }) }}>Phase précédente</button>
            )}
            {PHASES_PIPELINE.indexOf(m.phase) < PHASES_PIPELINE.length - 1 && (
              <button style={sBtnPrimary} onClick={() => { avancerPhase(m.id); setSelectedMarche({ ...m, phase: PHASES_PIPELINE[PHASES_PIPELINE.indexOf(m.phase) + 1], progression: Math.round(((PHASES_PIPELINE.indexOf(m.phase) + 2) / PHASES_PIPELINE.length) * 100) }) }}>Phase suivante</button>
            )}
            <button style={{ ...sBtnSecondary, color: '#C62828', borderColor: '#FFCDD2' }} onClick={() => { supprimerMarche(m.id); setSelectedMarche(null) }}>Supprimer</button>
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB 1 — Marchés en cours (Kanban)
  // ──────────────────────────────────────────────────────────────────────────────

  const renderMarchesTab = () => (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { emoji: '📋', label: 'Marchés actifs', value: marchesActifs.length, color: 'var(--sd-navy, #0D1B2E)' },
          { emoji: '💶', label: 'Budget total estimé', value: formatEur(totalBudgetActif), color: 'var(--sd-gold, #C9A84C)' },
          { emoji: '📄', label: 'Devis reçus', value: totalDevisRecus, color: '#1A7A6E' },
          { emoji: '🏆', label: 'Marchés terminés', value: marchesArchives.length, color: '#2D8A4E' },
        ].map((s, i) => (
          <div key={i} style={{ ...sCard, textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>{s.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, margin: '4px 0' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bouton nouveau marché */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button style={sBtnPrimary} onClick={() => setShowMarcheModal(true)}>+ Nouveau marché</button>
      </div>

      {/* Kanban Pipeline */}
      {marchesActifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15 }}>Aucun marché en cours. Créez votre premier marché de travaux.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 14, minWidth: PHASES_PIPELINE.length * 220 }}>
            {PHASES_PIPELINE.map(phase => {
              const conf = PHASES_CONFIG[phase]
              const inPhase = marchesActifs.filter(m => m.phase === phase)
              return (
                <div key={phase} style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 12, padding: 12, minWidth: 210, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--sd-border, #E4DDD0)' }}>
                    <span style={{ fontSize: 16 }}>{conf.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>{conf.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#fff', background: conf.dot, borderRadius: 10, padding: '2px 8px' }}>{inPhase.length}</span>
                  </div>
                  {inPhase.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', textAlign: 'center', padding: 20 }}>Aucun marché</div>
                  ) : inPhase.map(m => {
                    const typeConf = TYPES_MARCHE[m.type]
                    const nbDevis = devis.filter(d => d.marcheId === m.id).length
                    const jours = m.delai ? joursRestants(m.delai) : null
                    return (
                      <div key={m.id} style={{ ...sCard, marginBottom: 8, cursor: 'pointer', borderLeft: `3px solid ${conf.dot}`, transition: 'box-shadow 0.15s' }}
                        onClick={() => setSelectedMarche(m)}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.08)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 6 }}>{m.titre}</div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>{m.immeuble}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {renderBadge(`${typeConf.emoji} ${typeConf.label}`, conf.bg, conf.color)}
                          {nbDevis > 0 && renderBadge(`${nbDevis} devis`, '#E3F2FD', '#1565C0')}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 6 }}>
                          <span>Budget: {formatEur(m.budgetEstime)}</span>
                          {jours !== null && (
                            <span style={{ color: jours > 14 ? '#2E7D32' : jours > 0 ? '#F57F17' : '#C62828' }}>
                              {jours > 0 ? `${jours}j` : 'Retard'}
                            </span>
                          )}
                        </div>
                        {renderProgressBar(m.progression, conf.dot)}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB 2 — Comparaison devis
  // ──────────────────────────────────────────────────────────────────────────────

  const renderComparaisonTab = () => {
    const marcheId = comparaisonMarcheId || marchesComparables[0]?.id || ''
    const marcheRef = marches.find(m => m.id === marcheId)
    const marcheDevis = devis.filter(d => d.marcheId === marcheId)
    const scored = marcheDevis.map(d => ({ ...d, ...scoreDevis(d, marcheDevis) }))
    const sorted = [...scored].sort((a, b) => b.score - a.score)

    const moinsCher = marcheDevis.length > 0 ? marcheDevis.reduce((a, b) => a.montantHT < b.montantHT ? a : b).id : ''
    const plusRapide = marcheDevis.length > 0 ? marcheDevis.reduce((a, b) => a.delaiJours < b.delaiJours ? a : b).id : ''
    const meilleurScore = sorted.length > 0 ? sorted[0].id : ''

    return (
      <div>
        {/* Sélecteur de marché */}
        <div style={{ marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ ...sLabel, marginBottom: 0 }}>Marché :</label>
          <select style={{ ...sInput, maxWidth: 400 }} value={marcheId} onChange={e => setComparaisonMarcheId(e.target.value)}>
            {marchesComparables.length === 0 && <option value="">Aucun marché avec devis</option>}
            {marchesComparables.map(m => <option key={m.id} value={m.id}>{m.titre} — {m.immeuble} ({devis.filter(d => d.marcheId === m.id).length} devis)</option>)}
          </select>
          <button style={{ ...sBtnPrimary, padding: '8px 14px', fontSize: 12 }} onClick={() => { setDevisForm({ ...emptyDevisForm, marcheId }); setShowDevisModal(true) }}>+ Ajouter un devis</button>
        </div>

        {!marcheRef || marcheDevis.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15 }}>Sélectionnez un marché avec des devis pour comparer.</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Minimum 3 devis recommandés (art. 21 loi 1965, art. 19-2 décret 1967).</div>
          </div>
        ) : (
          <>
            {/* Alerte conformité */}
            {marcheDevis.length < 3 && (
              <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: '#795548' }}>
                Attention : seulement {marcheDevis.length} devis re\u00e7u(s). L&apos;art. 19-2 du décret de 1967 recommande au moins 3 devis pour toute mise en concurrence. Ajoutez des devis supplémentaires.
              </div>
            )}

            {/* Légende highlights */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2E7D32', display: 'inline-block' }} /> Moins cher</span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1565C0', display: 'inline-block' }} /> Plus rapide</span>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--sd-gold, #C9A84C)', display: 'inline-block' }} /> Meilleur rapport</span>
            </div>

            {/* Tableau comparatif */}
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--sd-navy, #0D1B2E)', color: '#fff' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', borderRadius: '10px 0 0 0', fontWeight: 600 }}>Entreprise</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Montant HT</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>TVA</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Montant TTC</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Délai</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Garantie</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Matériaux</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Paiement</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>RC Pro</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', borderRadius: '0 10px 0 0', fontWeight: 600 }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((d, i) => {
                    const isMinPrix = d.id === moinsCher
                    const isMinDelai = d.id === plusRapide
                    const isBest = d.id === meilleurScore
                    const rowBg = isBest ? '#FFFDE7' : i % 2 === 0 ? '#fff' : 'var(--sd-cream, #F7F4EE)'
                    return (
                      <tr key={d.id} style={{ background: rowBg, borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {d.entreprise}
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {isMinPrix && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#E8F5E9', color: '#2E7D32' }}>Moins cher</span>}
                            {isMinDelai && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#E3F2FD', color: '#1565C0' }}>Plus rapide</span>}
                            {isBest && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#FFF8E1', color: '#B7950B' }}>Meilleur rapport</span>}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: isMinPrix ? 700 : 400, color: isMinPrix ? '#2E7D32' : 'var(--sd-ink-2, #4A5E78)' }}>{formatEur(d.montantHT)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{d.tauxTVA} %</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{formatEur(montantTTC(d.montantHT, d.tauxTVA))}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: isMinDelai ? 700 : 400, color: isMinDelai ? '#1565C0' : 'var(--sd-ink-2, #4A5E78)' }}>{d.delaiJours} j</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {renderBadge(
                            GARANTIES[d.garantie]?.split(' (')[0] || d.garantie,
                            d.garantie === 'decennale' ? '#E8F5E9' : d.garantie === 'biennale' ? '#FFF8E1' : '#FFEBEE',
                            d.garantie === 'decennale' ? '#2E7D32' : d.garantie === 'biennale' ? '#F57F17' : '#C62828'
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, maxWidth: 180 }}>{d.materiaux || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, maxWidth: 160 }}>{d.conditionsPaiement || '—'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {d.assuranceRCPro
                            ? <span style={{ color: '#2E7D32', fontWeight: 700 }}>Oui</span>
                            : <span style={{ color: '#C62828', fontWeight: 700 }}>Non</span>
                          }
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: d.score >= 70 ? '#2E7D32' : d.score >= 50 ? '#F57F17' : '#C62828' }}>{d.score}</div>
                          <div style={{ fontSize: 10, color: 'var(--sd-ink-3, #8A9BB0)' }}>/100</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Détail du scoring */}
            <div style={{ ...sCard, borderLeft: '4px solid var(--sd-gold, #C9A84C)', marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>Méthode de notation</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Prix', poids: '40 %', desc: 'Rapport au moins-disant' },
                  { label: 'Délai', poids: '20 %', desc: 'Rapidité d\'exécution' },
                  { label: 'Garantie', poids: '20 %', desc: 'Décennale > Biennale > Aucune' },
                  { label: 'Références', poids: '20 %', desc: 'Réputation (1 à 5)' },
                ].map((c, i) => (
                  <div key={i} style={{ background: 'var(--sd-cream, #F7F4EE)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{c.label} — {c.poids}</div>
                    <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 2 }}>{c.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Barres de score par devis */}
            <div style={{ ...sCard, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>Détail des scores</h4>
              {sorted.map(d => (
                <div key={d.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{d.entreprise}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: d.score >= 70 ? '#2E7D32' : d.score >= 50 ? '#F57F17' : '#C62828' }}>{d.score}/100</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 30px', gap: '4px 8px', fontSize: 12 }}>
                    {[
                      { label: 'Prix', val: d.detail.prix, color: '#2E7D32' },
                      { label: 'Délai', val: d.detail.delai, color: '#1565C0' },
                      { label: 'Garantie', val: d.detail.garantie, color: '#F57F17' },
                      { label: 'Références', val: d.detail.references, color: '#6C5CE7' },
                    ].map((bar, j) => (
                      <React.Fragment key={j}>
                        <span style={{ color: 'var(--sd-ink-3, #8A9BB0)' }}>{bar.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center' }}>{renderProgressBar(bar.val, bar.color)}</div>
                        <span style={{ color: 'var(--sd-ink-2, #4A5E78)', textAlign: 'right' }}>{bar.val}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Action: sélectionner et voter */}
            {marcheRef && marcheRef.phase !== 'reception_travaux' && sorted.length > 0 && (
              <div style={{ ...sCard, borderLeft: '4px solid #2E7D32' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--sd-navy, #0D1B2E)' }}>Attribution du marché</h4>
                <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 14 }}>
                  Sélectionnez l&apos;entreprise retenue pour soumettre au vote en AG. Le prestataire ayant le meilleur score est recommandé.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {sorted.map(d => (
                    <button key={d.id} style={{
                      ...sBtnPrimary,
                      background: d.id === meilleurScore ? '#2E7D32' : 'var(--sd-navy, #0D1B2E)',
                      padding: '8px 16px', fontSize: 12,
                    }} onClick={() => cloturerMarche(marcheId, d.entreprise, d.montantHT)}>
                      {d.id === meilleurScore ? 'Recommandé : ' : ''}Attribuer \u00e0 {d.entreprise}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB 3 — Archives
  // ──────────────────────────────────────────────────────────────────────────────

  const renderArchivesTab = () => {
    const immeublesUniques = [...new Set(marchesArchives.map(m => m.immeuble))].filter(Boolean)
    const anneesUniques = [...new Set(marchesArchives.map(m => (m.dateCloture || m.dateCreation).substring(0, 4)))].sort().reverse()

    return (
      <div>
        {/* Filtres */}
        <div style={{ ...sCard, marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={sLabel}>Recherche</label>
            <input style={sInput} placeholder="Titre ou immeuble..." value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} />
          </div>
          <div style={{ flex: '0 1 140px' }}>
            <label style={sLabel}>Année</label>
            <select style={sInput} value={archiveAnnee} onChange={e => setArchiveAnnee(e.target.value)}>
              <option value="">Toutes</option>
              {anneesUniques.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 160px' }}>
            <label style={sLabel}>Type</label>
            <select style={sInput} value={archiveType} onChange={e => setArchiveType(e.target.value)}>
              <option value="">Tous</option>
              {Object.entries(TYPES_MARCHE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={sLabel}>Immeuble</label>
            <select style={sInput} value={archiveImmeuble} onChange={e => setArchiveImmeuble(e.target.value)}>
              <option value="">Tous</option>
              {immeublesUniques.map(im => <option key={im} value={im}>{im}</option>)}
            </select>
          </div>
        </div>

        {/* Liste */}
        {archivesFiltrees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--sd-ink-3, #8A9BB0)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗄️</div>
            <div style={{ fontSize: 15 }}>Aucun marché archivé{archiveSearch || archiveAnnee || archiveType || archiveImmeuble ? ' correspondant aux filtres' : ''}.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--sd-cream, #F7F4EE)', borderBottom: '2px solid var(--sd-border, #E4DDD0)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Marché</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Immeuble</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Entreprise retenue</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Montant</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Devis</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {archivesFiltrees.map((m, i) => {
                  const typeConf = TYPES_MARCHE[m.type]
                  const nbDevisMarche = devis.filter(d => d.marcheId === m.id).length
                  return (
                    <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--sd-cream, #F7F4EE)', borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                      <td style={{ padding: '10px 14px' }}>{new Date(m.dateCloture || m.dateCreation).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{m.titre}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--sd-ink-2, #4A5E78)' }}>{m.immeuble}</td>
                      <td style={{ padding: '10px 14px' }}>{renderBadge(`${typeConf.emoji} ${typeConf.label}`, 'var(--sd-cream, #F7F4EE)', 'var(--sd-navy, #0D1B2E)')}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#2E7D32' }}>{m.prestataireRetenu || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{m.montantRetenu ? formatEur(m.montantRetenu) : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{nbDevisMarche}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>{m.resultat || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // TAB 4 — Réglementation
  // ──────────────────────────────────────────────────────────────────────────────

  const renderReglementationTab = () => (
    <div>
      {/* Configuration seuil */}
      <div style={{ ...sCard, borderLeft: '4px solid var(--sd-gold, #C9A84C)', marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Seuil de mise en concurrence</h4>
        <p style={{ fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', marginBottom: 14 }}>
          Ce seuil est voté chaque année en assemblée générale (art. 21 loi 1965). Au-del\u00e0 de ce montant, le syndic doit obligatoirement procéder \u00e0 une mise en concurrence.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            style={{ ...sInput, maxWidth: 200, fontWeight: 700, fontSize: 16 }}
            type="number"
            value={config.seuilMiseEnConcurrence}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0
              const newConfig = { ...config, seuilMiseEnConcurrence: val }
              save(marches, devis, newConfig)
            }}
          />
          <span style={{ fontSize: 14, color: 'var(--sd-ink-2, #4A5E78)', fontWeight: 600 }}>EUR HT</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
          Seuil actuel : {formatEur(config.seuilMiseEnConcurrence)}
        </div>
      </div>

      {/* Articles juridiques */}
      <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 16 }}>Textes de référence</h3>

      <div style={{ display: 'grid', gap: 14 }}>
        {ARTICLES_REGLEMENTATION.map((art, i) => (
          <div key={i} style={{
            ...sCard,
            borderLeft: `4px solid ${art.importance === 'haute' ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-border, #E4DDD0)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sd-gold, #C9A84C)', marginBottom: 4 }}>{art.ref}</div>
                <h4 style={{ margin: 0, fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>{art.titre}</h4>
              </div>
              {art.importance === 'haute' && renderBadge('Essentiel', '#FFF8E1', '#B7950B')}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--sd-ink-2, #4A5E78)', lineHeight: 1.7 }}>{art.contenu}</p>
          </div>
        ))}
      </div>

      {/* Récapitulatif TVA */}
      <div style={{ ...sCard, marginTop: 20 }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--sd-navy, #0D1B2E)' }}>Récapitulatif des taux de TVA applicables</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { taux: '5,5 %', label: 'Rénovation énergétique', exemples: 'Isolation, chaudière condensation, pompe à chaleur, panneaux solaires', color: '#2E7D32', bg: '#E8F5E9' },
            { taux: '10 %', label: 'Travaux de rénovation', exemples: 'Ravalement, plomberie, électricité, peinture, menuiserie', color: '#1565C0', bg: '#E3F2FD' },
            { taux: '20 %', label: 'Construction neuve', exemples: 'Constructions neuves, agrandissements, surélévations', color: '#C62828', bg: '#FFEBEE' },
          ].map((t, i) => (
            <div key={i} style={{ background: t.bg, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.taux}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.color, marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>{t.exemples}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 0 }}>
      {/* En-tête */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
          Mise en concurrence
        </h2>
        <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginTop: 4 }}>
          Gestion des marchés de travaux et comparaison des devis — Loi 1965, Décret 1967
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--sd-border, #E4DDD0)', paddingBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: activeTab === tab.key ? 'var(--sd-navy, #0D1B2E)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--sd-ink-2, #4A5E78)',
              border: activeTab === tab.key ? 'none' : '1px solid var(--sd-border, #E4DDD0)',
            }}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu onglet */}
      {activeTab === 'marches' && renderMarchesTab()}
      {activeTab === 'comparaison' && renderComparaisonTab()}
      {activeTab === 'archives' && renderArchivesTab()}
      {activeTab === 'reglementation' && renderReglementationTab()}

      {/* Modales */}
      {renderMarcheModal()}
      {renderDevisModal()}
      {renderMarcheDetail()}
    </div>
  )
}
