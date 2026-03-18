'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'import' | 'en_attente' | 'traitees' | 'anomalies' | 'configuration'

type CategorieFacture = 'Maintenance' | 'Energie' | 'Assurance' | 'Travaux' | 'Nettoyage' | 'Honoraires' | 'Autre'
type TauxTVA = '5.5' | '10' | '20'

type ConfidenceLevel = 'high' | 'medium' | 'low'

interface ChampExtrait<T = string> {
  valeur: T
  confidence: number
}

interface FactureExtraite {
  id: string
  fichierNom: string
  fichierType: 'pdf' | 'jpg' | 'png'
  thumbnailUrl?: string
  dateImport: string
  statut: 'en_cours' | 'extrait' | 'valide' | 'rejete' | 'erreur'
  // Champs extraits par IA
  fournisseur: ChampExtrait
  siret: ChampExtrait
  numeroFacture: ChampExtrait
  dateFacture: ChampExtrait
  montantHT: ChampExtrait<number>
  tauxTVA: ChampExtrait<TauxTVA>
  montantTTC: ChampExtrait<number>
  ibanFournisseur: ChampExtrait
  description: ChampExtrait
  // Classification
  categorie: CategorieFacture
  imputationImmeuble: string
  cleRepartition: 'charges_generales' | 'charges_speciales'
  // Metadata
  erreurMessage?: string
}

type AnomalieType = 'doublon' | 'montant_anormal' | 'fournisseur_inconnu' | 'tva_incorrecte'

interface Anomalie {
  id: string
  type: AnomalieType
  factureId: string
  factureNumero: string
  fournisseur: string
  detail: string
  actionRecommandee: string
  montantEconomie?: number
  statut: 'active' | 'ignoree' | 'corrigee'
}

interface FournisseurRef {
  id: string
  nom: string
  siret: string
  iban: string
  categorie: CategorieFacture
}

interface SeuilAlerte {
  categorie: CategorieFacture
  montantMax: number
}

interface ConfigIA {
  fournisseurs: FournisseurRef[]
  seuils: SeuilAlerte[]
  autoClassification: boolean
  ocrLangue: string
}

interface SaisieIAData {
  factures: FactureExtraite[]
  anomalies: Anomalie[]
  config: ConfigIA
}

// ─── Demo Data ─────────────────────────────────────────────────────────────────

function generateDemoData(): SaisieIAData {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString()

  const factures: FactureExtraite[] = [
    // 3 pending
    {
      id: 'f1', fichierNom: 'facture_engie_mars2026.pdf', fichierType: 'pdf', dateImport: fmt(new Date(now.getTime() - 86400000)),
      statut: 'extrait',
      fournisseur: { valeur: 'ENGIE Entreprises', confidence: 97 },
      siret: { valeur: '54210765113030', confidence: 95 },
      numeroFacture: { valeur: 'FE-2026-03-0847', confidence: 99 },
      dateFacture: { valeur: '2026-03-01', confidence: 98 },
      montantHT: { valeur: 2845.60, confidence: 96 },
      tauxTVA: { valeur: '20', confidence: 92 },
      montantTTC: { valeur: 3414.72, confidence: 94 },
      ibanFournisseur: { valeur: 'FR76 3000 4025 7800 0100 0657 324', confidence: 88 },
      description: { valeur: 'Fourniture gaz naturel - Résidence Les Oliviers - Période fév 2026', confidence: 91 },
      categorie: 'Energie', imputationImmeuble: 'Résidence Les Oliviers', cleRepartition: 'charges_generales',
    },
    {
      id: 'f2', fichierNom: 'decompte_veolia_fev.pdf', fichierType: 'pdf', dateImport: fmt(new Date(now.getTime() - 172800000)),
      statut: 'extrait',
      fournisseur: { valeur: 'Veolia Eau', confidence: 94 },
      siret: { valeur: '57202552600477', confidence: 89 },
      numeroFacture: { valeur: 'VE-2026-0215', confidence: 97 },
      dateFacture: { valeur: '2026-02-15', confidence: 95 },
      montantHT: { valeur: 1523.40, confidence: 93 },
      tauxTVA: { valeur: '5.5', confidence: 78 },
      montantTTC: { valeur: 1607.19, confidence: 90 },
      ibanFournisseur: { valeur: 'FR76 3000 4008 9100 0206 7890 145', confidence: 65 },
      description: { valeur: 'Consommation eau froide collective - Résidence du Parc', confidence: 85 },
      categorie: 'Energie', imputationImmeuble: 'Résidence du Parc', cleRepartition: 'charges_generales',
    },
    {
      id: 'f3', fichierNom: 'facture_otis_ascenseur.jpg', fichierType: 'jpg', dateImport: fmt(new Date(now.getTime() - 259200000)),
      statut: 'extrait',
      fournisseur: { valeur: 'OTIS France', confidence: 99 },
      siret: { valeur: '54210020100013', confidence: 96 },
      numeroFacture: { valeur: 'OT-MRS-2026-0302', confidence: 98 },
      dateFacture: { valeur: '2026-03-02', confidence: 97 },
      montantHT: { valeur: 4200.00, confidence: 99 },
      tauxTVA: { valeur: '10', confidence: 85 },
      montantTTC: { valeur: 4620.00, confidence: 97 },
      ibanFournisseur: { valeur: 'FR76 1820 6000 5563 2416 7000 164', confidence: 92 },
      description: { valeur: 'Maintenance annuelle ascenseur - Bâtiment A - Résidence Les Oliviers', confidence: 93 },
      categorie: 'Maintenance', imputationImmeuble: 'Résidence Les Oliviers', cleRepartition: 'charges_speciales',
    },
    // 4 validated
    {
      id: 'f4', fichierNom: 'facture_axa_assurance_2026.pdf', fichierType: 'pdf', dateImport: fmt(new Date(now.getTime() - 604800000)),
      statut: 'valide',
      fournisseur: { valeur: 'AXA France IARD', confidence: 99 },
      siret: { valeur: '72205746001425', confidence: 98 },
      numeroFacture: { valeur: 'AXA-IMM-2026-0145', confidence: 99 },
      dateFacture: { valeur: '2026-01-15', confidence: 99 },
      montantHT: { valeur: 8750.00, confidence: 99 },
      tauxTVA: { valeur: '20', confidence: 99 },
      montantTTC: { valeur: 10500.00, confidence: 99 },
      ibanFournisseur: { valeur: 'FR76 3000 4000 3700 0010 0000 632', confidence: 97 },
      description: { valeur: 'Prime annuelle MRH copropriété - Résidence Les Oliviers', confidence: 98 },
      categorie: 'Assurance', imputationImmeuble: 'Résidence Les Oliviers', cleRepartition: 'charges_generales',
    },
    {
      id: 'f5', fichierNom: 'facture_nettservice_jan.pdf', fichierType: 'pdf', dateImport: fmt(new Date(now.getTime() - 1209600000)),
      statut: 'valide',
      fournisseur: { valeur: 'NettService Pro', confidence: 96 },
      siret: { valeur: '82345678901234', confidence: 94 },
      numeroFacture: { valeur: 'NS-2026-0087', confidence: 98 },
      dateFacture: { valeur: '2026-01-31', confidence: 97 },
      montantHT: { valeur: 1850.00, confidence: 98 },
      tauxTVA: { valeur: '20', confidence: 99 },
      montantTTC: { valeur: 2220.00, confidence: 98 },
      ibanFournisseur: { valeur: 'FR76 1027 8060 0100 0207 6900 130', confidence: 91 },
      description: { valeur: 'Nettoyage parties communes - Janvier 2026 - Résidence du Parc', confidence: 95 },
      categorie: 'Nettoyage', imputationImmeuble: 'Résidence du Parc', cleRepartition: 'charges_generales',
    },
    {
      id: 'f6', fichierNom: 'facture_plomberie_dupont.png', fichierType: 'png', dateImport: fmt(new Date(now.getTime() - 1814400000)),
      statut: 'valide',
      fournisseur: { valeur: 'Plomberie Dupont SARL', confidence: 93 },
      siret: { valeur: '91234567890123', confidence: 90 },
      numeroFacture: { valeur: 'PD-2026-042', confidence: 95 },
      dateFacture: { valeur: '2026-02-10', confidence: 96 },
      montantHT: { valeur: 1320.00, confidence: 97 },
      tauxTVA: { valeur: '10', confidence: 88 },
      montantTTC: { valeur: 1452.00, confidence: 95 },
      ibanFournisseur: { valeur: 'FR76 2004 1010 1205 0006 3M03 277', confidence: 86 },
      description: { valeur: 'Remplacement vanne ECS + détartrage colonne montante - Bât B', confidence: 91 },
      categorie: 'Travaux', imputationImmeuble: 'Résidence Les Oliviers', cleRepartition: 'charges_speciales',
    },
    {
      id: 'f7', fichierNom: 'honoraires_syndic_t1.pdf', fichierType: 'pdf', dateImport: fmt(new Date(now.getTime() - 2419200000)),
      statut: 'valide',
      fournisseur: { valeur: 'Cabinet Martin Syndic', confidence: 99 },
      siret: { valeur: '45678901234567', confidence: 98 },
      numeroFacture: { valeur: 'CMS-HON-2026-T1', confidence: 99 },
      dateFacture: { valeur: '2026-01-05', confidence: 99 },
      montantHT: { valeur: 3200.00, confidence: 99 },
      tauxTVA: { valeur: '20', confidence: 99 },
      montantTTC: { valeur: 3840.00, confidence: 99 },
      ibanFournisseur: { valeur: 'FR76 1234 5000 0141 2300 0000 042', confidence: 99 },
      description: { valeur: 'Honoraires de gestion T1 2026 - Forfait courant', confidence: 99 },
      categorie: 'Honoraires', imputationImmeuble: 'Résidence Les Oliviers', cleRepartition: 'charges_generales',
    },
    // 1 with anomaly
    {
      id: 'f8', fichierNom: 'facture_engie_mars_doublon.pdf', fichierType: 'pdf', dateImport: fmt(new Date(now.getTime() - 43200000)),
      statut: 'extrait',
      fournisseur: { valeur: 'ENGIE Entreprises', confidence: 97 },
      siret: { valeur: '54210765113030', confidence: 95 },
      numeroFacture: { valeur: 'FE-2026-03-0847', confidence: 99 },
      dateFacture: { valeur: '2026-03-01', confidence: 98 },
      montantHT: { valeur: 2845.60, confidence: 96 },
      tauxTVA: { valeur: '20', confidence: 92 },
      montantTTC: { valeur: 3414.72, confidence: 94 },
      ibanFournisseur: { valeur: 'FR76 3000 4025 7800 0100 0657 324', confidence: 88 },
      description: { valeur: 'Fourniture gaz naturel - Résidence Les Oliviers - Période fév 2026', confidence: 91 },
      categorie: 'Energie', imputationImmeuble: 'Résidence Les Oliviers', cleRepartition: 'charges_generales',
    },
  ]

  const anomalies: Anomalie[] = [
    {
      id: 'a1', type: 'doublon', factureId: 'f8', factureNumero: 'FE-2026-03-0847', fournisseur: 'ENGIE Entreprises',
      detail: 'Facture identique (meme numero, meme montant) deja importee le ' + new Date(now.getTime() - 86400000).toLocaleDateString('fr-FR'),
      actionRecommandee: 'Supprimer le doublon et conserver la premiere importation',
      montantEconomie: 3414.72, statut: 'active',
    },
    {
      id: 'a2', type: 'montant_anormal', factureId: 'f3', factureNumero: 'OT-MRS-2026-0302', fournisseur: 'OTIS France',
      detail: 'Montant TTC (4 620,00 EUR) superieur de 35% a la moyenne historique (3 420,00 EUR)',
      actionRecommandee: 'Verifier le contrat de maintenance et comparer avec le devis initial',
      montantEconomie: 1200.00, statut: 'active',
    },
    {
      id: 'a3', type: 'tva_incorrecte', factureId: 'f2', factureNumero: 'VE-2026-0215', fournisseur: 'Veolia Eau',
      detail: 'TVA a 5,5% detectee mais le montant TTC ne correspond pas (ecart de 0,20 EUR)',
      actionRecommandee: 'Recalculer la TVA et ajuster le montant TTC',
      statut: 'active',
    },
  ]

  const config: ConfigIA = {
    fournisseurs: [
      { id: 'fr1', nom: 'ENGIE Entreprises', siret: '54210765113030', iban: 'FR76 3000 4025 7800 0100 0657 324', categorie: 'Energie' },
      { id: 'fr2', nom: 'Veolia Eau', siret: '57202552600477', iban: 'FR76 3000 4008 9100 0206 7890 145', categorie: 'Energie' },
      { id: 'fr3', nom: 'OTIS France', siret: '54210020100013', iban: 'FR76 1820 6000 5563 2416 7000 164', categorie: 'Maintenance' },
      { id: 'fr4', nom: 'AXA France IARD', siret: '72205746001425', iban: 'FR76 3000 4000 3700 0010 0000 632', categorie: 'Assurance' },
      { id: 'fr5', nom: 'NettService Pro', siret: '82345678901234', iban: 'FR76 1027 8060 0100 0207 6900 130', categorie: 'Nettoyage' },
    ],
    seuils: [
      { categorie: 'Maintenance', montantMax: 5000 },
      { categorie: 'Energie', montantMax: 4000 },
      { categorie: 'Assurance', montantMax: 12000 },
      { categorie: 'Travaux', montantMax: 10000 },
      { categorie: 'Nettoyage', montantMax: 3000 },
      { categorie: 'Honoraires', montantMax: 5000 },
      { categorie: 'Autre', montantMax: 2000 },
    ],
    autoClassification: true,
    ocrLangue: 'fr',
  }

  return { factures, anomalies, config }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function getConfidenceLevel(c: number): ConfidenceLevel {
  if (c >= 90) return 'high'
  if (c >= 70) return 'medium'
  return 'low'
}

function getConfidenceColor(c: number): string {
  if (c >= 90) return '#27AE60'
  if (c >= 70) return '#E67E22'
  return '#E74C3C'
}

function getConfidenceBg(c: number): string {
  if (c >= 90) return '#EAFAF1'
  if (c >= 70) return '#FEF5E7'
  return '#FDEDEC'
}

const CATEGORIES: CategorieFacture[] = ['Maintenance', 'Energie', 'Assurance', 'Travaux', 'Nettoyage', 'Honoraires', 'Autre']
const TAUX_TVA: TauxTVA[] = ['5.5', '10', '20']
const ANOMALIE_LABELS: Record<AnomalieType, string> = {
  doublon: 'Doublon',
  montant_anormal: 'Montant anormal',
  fournisseur_inconnu: 'Fournisseur inconnu',
  tva_incorrecte: 'TVA incorrecte',
}
const ANOMALIE_COLORS: Record<AnomalieType, { bg: string; color: string }> = {
  doublon: { bg: '#FDEDEC', color: '#E74C3C' },
  montant_anormal: { bg: '#FEF5E7', color: '#E67E22' },
  fournisseur_inconnu: { bg: '#EBF5FB', color: '#2980B9' },
  tva_incorrecte: { bg: '#F5EEF8', color: '#8E44AD' },
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'import', label: 'Import factures', icon: '\u2B06' },
  { id: 'en_attente', label: 'En attente', icon: '\u23F3' },
  { id: 'traitees', label: 'Traitees', icon: '\u2705' },
  { id: 'anomalies', label: 'Anomalies', icon: '\u26A0' },
  { id: 'configuration', label: 'Configuration', icon: '\u2699' },
]

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SaisieIAFacturesSection({ user, userRole }: { user: any; userRole: string }) {
  const uid = user?.id || 'demo'
  const storageKey = `fixit_saisie_ia_${uid}`

  // ── State ──
  const [activeTab, setActiveTab] = useState<TabId>('import')
  const [data, setData] = useState<SaisieIAData>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return generateDemoData()
  })

  // Persist
  const saveData = useCallback((updated: SaisieIAData) => {
    setData(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }, [storageKey])

  // ── Import tab state ──
  const [dragOver, setDragOver] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<{ id: string; name: string; type: string; status: 'pending' | 'processing' | 'done' | 'error' }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── En attente tab state ──
  const [editingField, setEditingField] = useState<{ factureId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // ── Traitees tab state ──
  const [filterFournisseur, setFilterFournisseur] = useState('')
  const [filterCategorie, setFilterCategorie] = useState<CategorieFacture | ''>('')
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterMontantMin, setFilterMontantMin] = useState('')
  const [filterMontantMax, setFilterMontantMax] = useState('')

  // ── Configuration tab state ──
  const [showAddFournisseur, setShowAddFournisseur] = useState(false)
  const [fournisseurForm, setFournisseurForm] = useState({ nom: '', siret: '', iban: '', categorie: 'Autre' as CategorieFacture })
  const [showAddSeuil, setShowAddSeuil] = useState(false)
  const [seuilForm, setSeuilForm] = useState({ categorie: 'Autre' as CategorieFacture, montantMax: '' })

  // ── Computed ──
  const pending = useMemo(() => data.factures.filter(f => f.statut === 'extrait'), [data.factures])
  const validated = useMemo(() => data.factures.filter(f => f.statut === 'valide'), [data.factures])
  const activeAnomalies = useMemo(() => data.anomalies.filter(a => a.statut === 'active'), [data.anomalies])

  // ── File upload simulation ──
  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files)
    const validFiles = arr.filter(f => {
      const ext = f.name.toLowerCase()
      return ext.endsWith('.pdf') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png')
    })
    if (validFiles.length === 0) return

    const newQueue = validFiles.map(f => ({
      id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      type: f.name.split('.').pop()?.toLowerCase() || 'pdf',
      status: 'pending' as const,
    }))
    setUploadQueue(prev => [...prev, ...newQueue])

    // Simulate processing
    newQueue.forEach((item, idx) => {
      setTimeout(() => {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q))
      }, idx * 800)

      setTimeout(() => {
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q))
        // Add as extracted invoice after "OCR"
        const newFacture: FactureExtraite = {
          id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          fichierNom: item.name,
          fichierType: (item.type === 'jpg' || item.type === 'jpeg' ? 'jpg' : item.type === 'png' ? 'png' : 'pdf') as 'pdf' | 'jpg' | 'png',
          dateImport: new Date().toISOString(),
          statut: 'extrait',
          fournisseur: { valeur: 'Fournisseur detecte', confidence: 75 },
          siret: { valeur: '00000000000000', confidence: 60 },
          numeroFacture: { valeur: `FACT-${Date.now().toString().slice(-6)}`, confidence: 80 },
          dateFacture: { valeur: new Date().toISOString().split('T')[0], confidence: 85 },
          montantHT: { valeur: 0, confidence: 50 },
          tauxTVA: { valeur: '20', confidence: 70 },
          montantTTC: { valeur: 0, confidence: 50 },
          ibanFournisseur: { valeur: '', confidence: 30 },
          description: { valeur: 'Description a completer', confidence: 40 },
          categorie: 'Autre',
          imputationImmeuble: '',
          cleRepartition: 'charges_generales',
        }
        setData(prev => {
          const updated = { ...prev, factures: [newFacture, ...prev.factures] }
          localStorage.setItem(storageKey, JSON.stringify(updated))
          return updated
        })
      }, idx * 800 + 2500)
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  // ── Validation handlers ──
  const handleValidateFacture = (id: string) => {
    const updated = {
      ...data,
      factures: data.factures.map(f => f.id === id ? { ...f, statut: 'valide' as const } : f),
    }
    saveData(updated)
  }

  const handleRejectFacture = (id: string) => {
    const updated = {
      ...data,
      factures: data.factures.map(f => f.id === id ? { ...f, statut: 'rejete' as const } : f),
    }
    saveData(updated)
  }

  const handleFieldEdit = (factureId: string, field: string, value: string | number) => {
    const updated = {
      ...data,
      factures: data.factures.map(f => {
        if (f.id !== factureId) return f
        const copy = { ...f }
        if (field === 'categorie') {
          copy.categorie = value as CategorieFacture
        } else if (field === 'imputationImmeuble') {
          copy.imputationImmeuble = value as string
        } else if (field === 'cleRepartition') {
          copy.cleRepartition = value as 'charges_generales' | 'charges_speciales'
        } else {
          const champKey = field as keyof FactureExtraite
          const champ = copy[champKey]
          if (champ && typeof champ === 'object' && 'valeur' in champ) {
            (copy as any)[champKey] = { ...(champ as ChampExtrait), valeur: value, confidence: 100 }
          }
        }
        return copy
      }),
    }
    saveData(updated)
    setEditingField(null)
  }

  // ── Anomaly handlers ──
  const handleIgnoreAnomalie = (id: string) => {
    const updated = {
      ...data,
      anomalies: data.anomalies.map(a => a.id === id ? { ...a, statut: 'ignoree' as const } : a),
    }
    saveData(updated)
  }

  const handleFixAnomalie = (id: string) => {
    const updated = {
      ...data,
      anomalies: data.anomalies.map(a => a.id === id ? { ...a, statut: 'corrigee' as const } : a),
    }
    saveData(updated)
  }

  // ── Config handlers ──
  const handleAddFournisseur = () => {
    if (!fournisseurForm.nom.trim()) return
    const newFr: FournisseurRef = { id: `fr_${Date.now()}`, ...fournisseurForm }
    const updated = { ...data, config: { ...data.config, fournisseurs: [...data.config.fournisseurs, newFr] } }
    saveData(updated)
    setShowAddFournisseur(false)
    setFournisseurForm({ nom: '', siret: '', iban: '', categorie: 'Autre' })
  }

  const handleDeleteFournisseur = (id: string) => {
    const updated = { ...data, config: { ...data.config, fournisseurs: data.config.fournisseurs.filter(f => f.id !== id) } }
    saveData(updated)
  }

  const handleAddSeuil = () => {
    if (!seuilForm.montantMax) return
    const existing = data.config.seuils.findIndex(s => s.categorie === seuilForm.categorie)
    let updatedSeuils = [...data.config.seuils]
    if (existing >= 0) {
      updatedSeuils[existing] = { categorie: seuilForm.categorie, montantMax: parseFloat(seuilForm.montantMax) }
    } else {
      updatedSeuils.push({ categorie: seuilForm.categorie, montantMax: parseFloat(seuilForm.montantMax) })
    }
    const updated = { ...data, config: { ...data.config, seuils: updatedSeuils } }
    saveData(updated)
    setShowAddSeuil(false)
    setSeuilForm({ categorie: 'Autre', montantMax: '' })
  }

  const handleToggleAutoClassification = () => {
    const updated = { ...data, config: { ...data.config, autoClassification: !data.config.autoClassification } }
    saveData(updated)
  }

  // ── Traitees filters ──
  const filteredValidated = useMemo(() => {
    return validated.filter(f => {
      if (filterFournisseur && !f.fournisseur.valeur.toLowerCase().includes(filterFournisseur.toLowerCase())) return false
      if (filterCategorie && f.categorie !== filterCategorie) return false
      if (filterImmeuble && !f.imputationImmeuble.toLowerCase().includes(filterImmeuble.toLowerCase())) return false
      if (filterMontantMin && f.montantTTC.valeur < parseFloat(filterMontantMin)) return false
      if (filterMontantMax && f.montantTTC.valeur > parseFloat(filterMontantMax)) return false
      return true
    })
  }, [validated, filterFournisseur, filterCategorie, filterImmeuble, filterMontantMin, filterMontantMax])

  // Totals for Traitees
  const totalParCategorie = useMemo(() => {
    const map: Record<string, number> = {}
    filteredValidated.forEach(f => {
      map[f.categorie] = (map[f.categorie] || 0) + f.montantTTC.valeur
    })
    return map
  }, [filteredValidated])

  const totalParFournisseur = useMemo(() => {
    const map: Record<string, number> = {}
    filteredValidated.forEach(f => {
      map[f.fournisseur.valeur] = (map[f.fournisseur.valeur] || 0) + f.montantTTC.valeur
    })
    return map
  }, [filteredValidated])

  const totalGeneral = useMemo(() => filteredValidated.reduce((s, f) => s + f.montantTTC.valeur, 0), [filteredValidated])

  // Anomalie stats
  const totalEconomies = useMemo(() => data.anomalies.filter(a => a.montantEconomie).reduce((s, a) => s + (a.montantEconomie || 0), 0), [data.anomalies])

  // ── Export Excel (CSV) ──
  const handleExportCSV = () => {
    const headers = ['Fournisseur', 'SIRET', 'N Facture', 'Date', 'Montant HT', 'TVA %', 'Montant TTC', 'Categorie', 'Immeuble', 'Description']
    const rows = filteredValidated.map(f => [
      f.fournisseur.valeur, f.siret.valeur, f.numeroFacture.valeur, f.dateFacture.valeur,
      f.montantHT.valeur.toString(), f.tauxTVA.valeur, f.montantTTC.valeur.toString(),
      f.categorie, f.imputationImmeuble, f.description.valeur,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `factures_traitees_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ────────────────────────────── RENDER ──────────────────────────────────────

  // Shared styles
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 12,
    padding: 24,
  }

  const btnPrimary: React.CSSProperties = {
    background: 'var(--sd-gold, #C9A84C)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  }

  const btnSecondary: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--sd-navy, #0D1B2E)',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  }

  const btnDanger: React.CSSProperties = {
    background: '#FDEDEC',
    color: '#E74C3C',
    border: '1px solid #F5C6CB',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--sd-border, #E4DDD0)',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--sd-navy, #0D1B2E)',
    background: '#fff',
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--sd-ink-2, #4A5E78)',
    marginBottom: 4,
    display: 'block',
  }

  // ── Confidence badge ──
  const ConfBadge = ({ c }: { c: number }) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: getConfidenceBg(c), color: getConfidenceColor(c),
      marginLeft: 6,
    }}>
      {c}%
    </span>
  )

  // ── Editable field ──
  const EditableField = ({ factureId, field, label, value, confidence, isNumber }: {
    factureId: string; field: string; label: string; value: string | number; confidence: number; isNumber?: boolean
  }) => {
    const isEditing = editingField?.factureId === factureId && editingField?.field === field
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)' }}>{label}</span>
          <ConfBadge c={confidence} />
        </div>
        {isEditing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type={isNumber ? 'number' : 'text'}
              style={{ ...inputStyle, flex: 1 }}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleFieldEdit(factureId, field, isNumber ? parseFloat(editValue) || 0 : editValue)
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
            <button
              style={{ ...btnPrimary, padding: '6px 12px', fontSize: 11 }}
              onClick={() => handleFieldEdit(factureId, field, isNumber ? parseFloat(editValue) || 0 : editValue)}
            >OK</button>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 6, border: '1px solid transparent',
              transition: 'border-color 0.15s',
            }}
            onClick={() => { setEditingField({ factureId, field }); setEditValue(String(value)) }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sd-border, #E4DDD0)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
            title="Cliquer pour modifier"
          >
            {isNumber ? formatPrice(value as number) : (value || '—')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 26, fontWeight: 700,
          color: 'var(--sd-navy, #0D1B2E)',
          margin: 0, marginBottom: 6,
        }}>
          Saisie IA des factures
        </h2>
        <p style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', margin: 0 }}>
          Import, extraction automatique et validation des factures fournisseurs
        </p>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24,
      }}>
        <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{'\uD83D\uDCC4'}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>{data.factures.length}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Factures totales</div>
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEF5E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{'\u23F3'}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#E67E22', lineHeight: 1 }}>{pending.length}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>En attente</div>
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EAFAF1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{'\u2705'}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#27AE60', lineHeight: 1 }}>{validated.length}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Validees</div>
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FDEDEC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{'\u26A0\uFE0F'}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#E74C3C', lineHeight: 1 }}>{activeAnomalies.length}</div>
            <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Anomalies</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 24,
        borderBottom: '2px solid var(--sd-border, #E4DDD0)',
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--sd-gold, #C9A84C)' : 'var(--sd-ink-2, #4A5E78)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--sd-gold, #C9A84C)' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.id === 'en_attente' && pending.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: '#FEF5E7', color: '#E67E22',
              }}>{pending.length}</span>
            )}
            {tab.id === 'anomalies' && activeAnomalies.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: '#FDEDEC', color: '#E74C3C',
              }}>{activeAnomalies.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ TAB 1: IMPORT ═══════════════════════ */}
      {activeTab === 'import' && (
        <div>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...cardStyle,
              border: dragOver ? '2px dashed var(--sd-gold, #C9A84C)' : '2px dashed var(--sd-border, #E4DDD0)',
              background: dragOver ? 'rgba(201,168,76,0.05)' : 'var(--sd-cream, #F7F4EE)',
              textAlign: 'center',
              cursor: 'pointer',
              padding: 48,
              transition: 'border-color 0.2s, background 0.2s',
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'\uD83D\uDCC1'}</div>
            <div style={{
              fontSize: 16, fontWeight: 600,
              color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8,
            }}>
              Glissez-deposez vos factures ici
            </div>
            <div style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 16 }}>
              Formats acceptes : PDF, JPG, PNG — Import par lot supporte
            </div>
            <button style={btnPrimary}>
              Parcourir les fichiers
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {/* Upload queue */}
          {uploadQueue.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>
                File d'importation
              </h3>
              {uploadQueue.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: item.type === 'pdf' ? '#FDEDEC' : '#EBF5FB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    color: item.type === 'pdf' ? '#E74C3C' : '#2980B9',
                  }}>
                    {item.type.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sd-navy, #0D1B2E)' }}>{item.name}</div>
                  </div>
                  <div>
                    {item.status === 'pending' && (
                      <span style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>En file...</span>
                    )}
                    {item.status === 'processing' && (
                      <span style={{ fontSize: 11, color: '#E67E22', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block', width: 14, height: 14,
                          border: '2px solid #E67E22', borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'saisie-spin 0.8s linear infinite',
                        }} />
                        En cours de traitement
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span style={{ fontSize: 11, color: '#27AE60', fontWeight: 600 }}>Extrait</span>
                    )}
                    {item.status === 'error' && (
                      <span style={{ fontSize: 11, color: '#E74C3C', fontWeight: 600 }}>Erreur</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Spinner animation */}
          <style>{`
            @keyframes saisie-spin { to { transform: rotate(360deg) } }
          `}</style>
        </div>
      )}

      {/* ═══════════════════════ TAB 2: EN ATTENTE ═══════════════════════ */}
      {activeTab === 'en_attente' && (
        <div>
          {pending.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u2705'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>
                Aucune facture en attente
              </div>
              <div style={{ fontSize: 13, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                Toutes les factures ont ete traitees
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pending.map(facture => (
                <div key={facture.id} style={{ ...cardStyle }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    marginBottom: 16, flexWrap: 'wrap', gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: facture.fichierType === 'pdf' ? '#FDEDEC' : '#EBF5FB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                        color: facture.fichierType === 'pdf' ? '#E74C3C' : '#2980B9',
                      }}>
                        {facture.fichierType.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>
                          {facture.fournisseur.valeur}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                          {facture.fichierNom} — Importe le {new Date(facture.dateImport).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={btnPrimary} onClick={() => handleValidateFacture(facture.id)}>
                        Valider
                      </button>
                      <button style={btnDanger} onClick={() => handleRejectFacture(facture.id)}>
                        Rejeter
                      </button>
                    </div>
                  </div>

                  {/* Fields grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                  }}>
                    <EditableField factureId={facture.id} field="fournisseur" label="Fournisseur" value={facture.fournisseur.valeur} confidence={facture.fournisseur.confidence} />
                    <EditableField factureId={facture.id} field="siret" label="SIRET" value={facture.siret.valeur} confidence={facture.siret.confidence} />
                    <EditableField factureId={facture.id} field="numeroFacture" label="N\u00B0 Facture" value={facture.numeroFacture.valeur} confidence={facture.numeroFacture.confidence} />
                    <EditableField factureId={facture.id} field="dateFacture" label="Date facture" value={facture.dateFacture.valeur} confidence={facture.dateFacture.confidence} />
                    <EditableField factureId={facture.id} field="montantHT" label="Montant HT" value={facture.montantHT.valeur} confidence={facture.montantHT.confidence} isNumber />
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)' }}>TVA</span>
                        <ConfBadge c={facture.tauxTVA.confidence} />
                      </div>
                      <select
                        style={selectStyle}
                        value={facture.tauxTVA.valeur}
                        onChange={e => handleFieldEdit(facture.id, 'tauxTVA', e.target.value)}
                      >
                        {TAUX_TVA.map(t => (
                          <option key={t} value={t}>{t}%</option>
                        ))}
                      </select>
                    </div>
                    <EditableField factureId={facture.id} field="montantTTC" label="Montant TTC" value={facture.montantTTC.valeur} confidence={facture.montantTTC.confidence} isNumber />
                    <EditableField factureId={facture.id} field="ibanFournisseur" label="IBAN fournisseur" value={facture.ibanFournisseur.valeur} confidence={facture.ibanFournisseur.confidence} />
                  </div>

                  {/* Description (full width) */}
                  <EditableField factureId={facture.id} field="description" label="Description" value={facture.description.valeur} confidence={facture.description.confidence} />

                  {/* Classification row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12, marginTop: 8,
                    padding: 12, borderRadius: 8,
                    background: 'var(--sd-cream, #F7F4EE)',
                  }}>
                    <div>
                      <label style={labelStyle}>Categorie</label>
                      <select
                        style={selectStyle}
                        value={facture.categorie}
                        onChange={e => handleFieldEdit(facture.id, 'categorie', e.target.value)}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Imputation immeuble</label>
                      <input
                        style={inputStyle}
                        value={facture.imputationImmeuble}
                        onChange={e => handleFieldEdit(facture.id, 'imputationImmeuble', e.target.value)}
                        placeholder="Nom de l'immeuble"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Cle de repartition</label>
                      <select
                        style={selectStyle}
                        value={facture.cleRepartition}
                        onChange={e => handleFieldEdit(facture.id, 'cleRepartition', e.target.value)}
                      >
                        <option value="charges_generales">Charges generales</option>
                        <option value="charges_speciales">Charges speciales</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB 3: TRAITEES ═══════════════════════ */}
      {activeTab === 'traitees' && (
        <div>
          {/* Filters */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12, alignItems: 'end',
            }}>
              <div>
                <label style={labelStyle}>Fournisseur</label>
                <input style={inputStyle} value={filterFournisseur} onChange={e => setFilterFournisseur(e.target.value)} placeholder="Filtrer..." />
              </div>
              <div>
                <label style={labelStyle}>Categorie</label>
                <select style={selectStyle} value={filterCategorie} onChange={e => setFilterCategorie(e.target.value as CategorieFacture | '')}>
                  <option value="">Toutes</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Immeuble</label>
                <input style={inputStyle} value={filterImmeuble} onChange={e => setFilterImmeuble(e.target.value)} placeholder="Filtrer..." />
              </div>
              <div>
                <label style={labelStyle}>Montant min</label>
                <input style={inputStyle} type="number" value={filterMontantMin} onChange={e => setFilterMontantMin(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Montant max</label>
                <input style={inputStyle} type="number" value={filterMontantMax} onChange={e => setFilterMontantMax(e.target.value)} placeholder="99999" />
              </div>
              <div>
                <button style={btnPrimary} onClick={handleExportCSV}>
                  Exporter Excel
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                    {['Fournisseur', 'N\u00B0 Facture', 'Date', 'Montant HT', 'TVA', 'Montant TTC', 'Categorie', 'Immeuble'].map(h => (
                      <th key={h} style={{
                        padding: '12px 14px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--sd-ink-2, #4A5E78)',
                        borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredValidated.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)' }}>
                        Aucune facture traitee pour ces criteres
                      </td>
                    </tr>
                  ) : filteredValidated.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{f.fournisseur.valeur}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{f.numeroFacture.valeur}</td>
                      <td style={{ padding: '10px 14px' }}>{new Date(f.dateFacture.valeur).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>{formatPrice(f.montantHT.valeur)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>{f.tauxTVA.valeur}%</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{formatPrice(f.montantTTC.valeur)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                          background: 'rgba(201,168,76,0.12)', color: 'var(--sd-gold, #C9A84C)',
                        }}>{f.categorie}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>{f.imputationImmeuble || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          {filteredValidated.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16, marginTop: 16,
            }}>
              {/* Total par categorie */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 12px' }}>
                  Total par categorie
                </h4>
                {Object.entries(totalParCategorie).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                  <div key={cat} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                    fontSize: 13,
                  }}>
                    <span style={{ color: 'var(--sd-ink-2, #4A5E78)' }}>{cat}</span>
                    <span style={{ fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatPrice(total)}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0 0', marginTop: 8,
                  fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)',
                }}>
                  <span>Total general</span>
                  <span>{formatPrice(totalGeneral)}</span>
                </div>
              </div>

              {/* Total par fournisseur */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 12px' }}>
                  Total par fournisseur
                </h4>
                {Object.entries(totalParFournisseur).sort((a, b) => b[1] - a[1]).map(([fr, total]) => (
                  <div key={fr} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                    fontSize: 13,
                  }}>
                    <span style={{ color: 'var(--sd-ink-2, #4A5E78)' }}>{fr}</span>
                    <span style={{ fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>{formatPrice(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB 4: ANOMALIES ═══════════════════════ */}
      {activeTab === 'anomalies' && (
        <div>
          {/* Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12, marginBottom: 20,
          }}>
            <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FDEDEC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{'\u26A0\uFE0F'}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', lineHeight: 1 }}>{data.anomalies.length}</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Anomalies detectees</div>
              </div>
            </div>
            <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EAFAF1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{'\uD83D\uDCB0'}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#27AE60', lineHeight: 1 }}>{formatPrice(totalEconomies)}</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>Economies identifiees</div>
              </div>
            </div>
            <div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEF5E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{'\uD83D\uDD0D'}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#E67E22', lineHeight: 1 }}>{activeAnomalies.length}</div>
                <div style={{ fontSize: 11, color: 'var(--sd-ink-3, #8A9BB0)' }}>A traiter</div>
              </div>
            </div>
          </div>

          {/* Anomaly list */}
          {data.anomalies.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u2705'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                Aucune anomalie detectee
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.anomalies.map(anomalie => {
                const ac = ANOMALIE_COLORS[anomalie.type]
                return (
                  <div key={anomalie.id} style={{
                    ...cardStyle,
                    opacity: anomalie.statut !== 'active' ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      flexWrap: 'wrap', gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 5,
                            background: ac.bg, color: ac.color,
                          }}>
                            {ANOMALIE_LABELS[anomalie.type]}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                            {anomalie.factureNumero} — {anomalie.fournisseur}
                          </span>
                          {anomalie.statut !== 'active' && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                              background: anomalie.statut === 'corrigee' ? '#EAFAF1' : '#F5F5F5',
                              color: anomalie.statut === 'corrigee' ? '#27AE60' : '#999',
                            }}>
                              {anomalie.statut === 'corrigee' ? 'Corrigee' : 'Ignoree'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 6 }}>
                          {anomalie.detail}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)', fontStyle: 'italic' }}>
                          Action recommandee : {anomalie.actionRecommandee}
                        </div>
                        {anomalie.montantEconomie && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#27AE60', marginTop: 4 }}>
                            Economie potentielle : {formatPrice(anomalie.montantEconomie)}
                          </div>
                        )}
                      </div>
                      {anomalie.statut === 'active' && (
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button style={btnPrimary} onClick={() => handleFixAnomalie(anomalie.id)}>
                            Corriger
                          </button>
                          <button style={btnSecondary} onClick={() => handleIgnoreAnomalie(anomalie.id)}>
                            Ignorer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ TAB 5: CONFIGURATION ═══════════════════════ */}
      {activeTab === 'configuration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Fournisseurs referencies */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                Fournisseurs references
              </h3>
              <button style={btnPrimary} onClick={() => setShowAddFournisseur(true)}>
                + Ajouter
              </button>
            </div>

            {/* Add fournisseur form */}
            {showAddFournisseur && (
              <div style={{
                padding: 16, marginBottom: 16, borderRadius: 10,
                background: 'var(--sd-cream, #F7F4EE)',
                border: '1px solid var(--sd-border, #E4DDD0)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nom</label>
                    <input style={inputStyle} value={fournisseurForm.nom} onChange={e => setFournisseurForm(p => ({ ...p, nom: e.target.value }))} placeholder="Nom du fournisseur" />
                  </div>
                  <div>
                    <label style={labelStyle}>SIRET</label>
                    <input style={inputStyle} value={fournisseurForm.siret} onChange={e => setFournisseurForm(p => ({ ...p, siret: e.target.value }))} placeholder="14 chiffres" />
                  </div>
                  <div>
                    <label style={labelStyle}>IBAN</label>
                    <input style={inputStyle} value={fournisseurForm.iban} onChange={e => setFournisseurForm(p => ({ ...p, iban: e.target.value }))} placeholder="FR76 ..." />
                  </div>
                  <div>
                    <label style={labelStyle}>Categorie</label>
                    <select style={selectStyle} value={fournisseurForm.categorie} onChange={e => setFournisseurForm(p => ({ ...p, categorie: e.target.value as CategorieFacture }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={btnPrimary} onClick={handleAddFournisseur}>Enregistrer</button>
                  <button style={btnSecondary} onClick={() => setShowAddFournisseur(false)}>Annuler</button>
                </div>
              </div>
            )}

            {/* Fournisseurs list */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--sd-cream, #F7F4EE)' }}>
                    {['Nom', 'SIRET', 'IBAN', 'Categorie', ''].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--sd-ink-2, #4A5E78)',
                        borderBottom: '1px solid var(--sd-border, #E4DDD0)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.config.fournisseurs.map(fr => (
                    <tr key={fr.id} style={{ borderBottom: '1px solid var(--sd-border, #E4DDD0)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{fr.nom}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{fr.siret}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>{fr.iban}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                          background: 'rgba(201,168,76,0.12)', color: 'var(--sd-gold, #C9A84C)',
                        }}>{fr.categorie}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          style={{ background: 'none', border: 'none', color: '#E74C3C', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                          onClick={() => handleDeleteFournisseur(fr.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.config.fournisseurs.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--sd-ink-3, #8A9BB0)' }}>
                        Aucun fournisseur reference
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seuils d'alerte */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: 0 }}>
                Seuils d'alerte par categorie
              </h3>
              <button style={btnPrimary} onClick={() => setShowAddSeuil(true)}>
                + Modifier
              </button>
            </div>

            {showAddSeuil && (
              <div style={{
                padding: 16, marginBottom: 16, borderRadius: 10,
                background: 'var(--sd-cream, #F7F4EE)',
                border: '1px solid var(--sd-border, #E4DDD0)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 400 }}>
                  <div>
                    <label style={labelStyle}>Categorie</label>
                    <select style={selectStyle} value={seuilForm.categorie} onChange={e => setSeuilForm(p => ({ ...p, categorie: e.target.value as CategorieFacture }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Montant max (EUR)</label>
                    <input style={inputStyle} type="number" value={seuilForm.montantMax} onChange={e => setSeuilForm(p => ({ ...p, montantMax: e.target.value }))} placeholder="5000" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={btnPrimary} onClick={handleAddSeuil}>Enregistrer</button>
                  <button style={btnSecondary} onClick={() => setShowAddSeuil(false)}>Annuler</button>
                </div>
              </div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}>
              {data.config.seuils.map(s => (
                <div key={s.categorie} style={{
                  padding: 12, borderRadius: 8,
                  background: 'var(--sd-cream, #F7F4EE)',
                  border: '1px solid var(--sd-border, #E4DDD0)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 4 }}>
                    {s.categorie}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)' }}>
                    {formatPrice(s.montantMax)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-classification & OCR */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--sd-navy, #0D1B2E)', margin: '0 0 16px' }}>
              Parametres IA
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 16, borderRadius: 10,
                background: 'var(--sd-cream, #F7F4EE)',
                border: '1px solid var(--sd-border, #E4DDD0)',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)' }}>
                    Auto-classification
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)' }}>
                    Classification automatique des factures par categorie
                  </div>
                </div>
                <button
                  onClick={handleToggleAutoClassification}
                  style={{
                    width: 48, height: 26, borderRadius: 13, border: 'none',
                    background: data.config.autoClassification ? 'var(--sd-gold, #C9A84C)' : '#D5D5D5',
                    cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 10,
                    background: '#fff',
                    position: 'absolute', top: 3,
                    left: data.config.autoClassification ? 25 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>

              <div style={{
                padding: 16, borderRadius: 10,
                background: 'var(--sd-cream, #F7F4EE)',
                border: '1px solid var(--sd-border, #E4DDD0)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 8 }}>
                  Langue OCR
                </div>
                <select
                  style={{ ...selectStyle, maxWidth: 250 }}
                  value={data.config.ocrLangue}
                  onChange={e => {
                    const updated = { ...data, config: { ...data.config, ocrLangue: e.target.value } }
                    saveData(updated)
                  }}
                >
                  <option value="fr">Francais</option>
                  <option value="en">Anglais</option>
                  <option value="de">Allemand</option>
                  <option value="es">Espagnol</option>
                  <option value="pt">Portugais</option>
                  <option value="it">Italien</option>
                </select>
              </div>

              <div style={{
                padding: 16, borderRadius: 10,
                background: 'var(--sd-cream, #F7F4EE)',
                border: '1px solid var(--sd-border, #E4DDD0)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sd-navy, #0D1B2E)', marginBottom: 4 }}>
                  Regles de classification automatique
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-3, #8A9BB0)', marginBottom: 12 }}>
                  Les factures sont classees automatiquement en fonction du fournisseur reference et des mots-cles detectes dans la description.
                </div>
                <div style={{ fontSize: 12, color: 'var(--sd-ink-2, #4A5E78)' }}>
                  <div style={{ marginBottom: 4 }}><strong>Energie</strong> : EDF, ENGIE, Veolia, gaz, electricite, eau</div>
                  <div style={{ marginBottom: 4 }}><strong>Maintenance</strong> : OTIS, Schindler, ascenseur, maintenance, entretien</div>
                  <div style={{ marginBottom: 4 }}><strong>Assurance</strong> : AXA, Allianz, MAIF, prime, MRH, assurance</div>
                  <div style={{ marginBottom: 4 }}><strong>Nettoyage</strong> : nettoyage, proprete, parties communes</div>
                  <div style={{ marginBottom: 4 }}><strong>Travaux</strong> : plomberie, electricite, peinture, reparation, renovation</div>
                  <div style={{ marginBottom: 4 }}><strong>Honoraires</strong> : honoraires, syndic, gestion, forfait</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
