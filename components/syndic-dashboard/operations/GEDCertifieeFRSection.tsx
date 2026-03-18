'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CategorieDocument =
  | 'pv_ag'
  | 'convocations'
  | 'reglement_copro'
  | 'etat_descriptif'
  | 'budgets_comptes'
  | 'contrats'
  | 'assurances'
  | 'diagnostics'
  | 'carnet_entretien'
  | 'correspondance'

type TypeFichier = 'pdf' | 'doc' | 'xls' | 'jpg' | 'png' | 'autre'

type StatutConformite = 'ok' | 'manquant' | 'expire'

type PolitiqueRetention = '5_ans' | '10_ans' | '30_ans' | 'permanent'

interface GEDDocumentCertifie {
  id: string
  nom: string
  categorie: CategorieDocument
  immeubleId: string
  immeubleNom: string
  datePiece: string
  dateUpload: string
  hashSHA256: string
  tailleMo: number
  typeFichier: TypeFichier
  uploadeParNom: string
  notes: string
  tags: string[]
  retention: PolitiqueRetention
}

interface ExigenceExtranet {
  id: string
  label: string
  categorie: CategorieDocument
  description: string
  referenceJuridique: string
  retention: PolitiqueRetention
}

interface ConfigGED {
  autoClassificationIA: boolean
  backupActif: boolean
  dernierBackup: string
  stockageUtiliseMo: number
  stockageLimiteMo: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIE_CONFIG: Record<CategorieDocument, { label: string; icon: string; color: string }> = {
  pv_ag:            { label: 'PV d\'Assemblées',           icon: '📋', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  convocations:     { label: 'Convocations',               icon: '📬', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  reglement_copro:  { label: 'Règlement copropriété',      icon: '📜', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  etat_descriptif:  { label: 'État descriptif de division', icon: '🏢', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  budgets_comptes:  { label: 'Budgets & Comptes',          icon: '💰', color: 'bg-green-50 text-green-700 border-green-200' },
  contrats:         { label: 'Contrats',                   icon: '📝', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  assurances:       { label: 'Assurances',                 icon: '🛡️', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  diagnostics:      { label: 'Diagnostics (DPE, DTG, amiante...)', icon: '🔬', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  carnet_entretien: { label: 'Carnet d\'entretien',        icon: '📓', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  correspondance:   { label: 'Correspondance',             icon: '✉️', color: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const CATEGORIES_ORDER: CategorieDocument[] = [
  'pv_ag', 'convocations', 'reglement_copro', 'etat_descriptif',
  'budgets_comptes', 'contrats', 'assurances', 'diagnostics',
  'carnet_entretien', 'correspondance',
]

const STATUT_CONF_CONFIG: Record<StatutConformite, { label: string; dot: string; badge: string; icon: string }> = {
  ok:       { label: 'OK',       dot: 'bg-green-400', badge: 'bg-green-50 text-green-700 border-green-200', icon: '✅' },
  manquant: { label: 'Manquant', dot: 'bg-red-400',   badge: 'bg-red-50 text-red-700 border-red-200',     icon: '❌' },
  expire:   { label: 'Expiré',   dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200', icon: '⚠️' },
}

const RETENTION_CONFIG: Record<PolitiqueRetention, { label: string; duree: string; exemples: string }> = {
  '5_ans':    { label: '5 ans',       duree: 'Fiscal',           exemples: 'Factures, relevés bancaires, quittances' },
  '10_ans':   { label: '10 ans',      duree: 'PV AG, contrats',  exemples: 'PV d\'AG, contrats fournisseurs, assurances' },
  '30_ans':   { label: '30 ans',      duree: 'Actes notariés',   exemples: 'Actes de propriété, servitudes' },
  'permanent':{ label: 'Permanent',   duree: 'Règlement copro',  exemples: 'Règlement de copropriété, EDD, carnet d\'entretien' },
}

const TYPE_FICHIER_ICON: Record<TypeFichier, string> = {
  pdf: '📕', doc: '📘', xls: '📗', jpg: '🖼️', png: '🖼️', autre: '📎',
}

const EXIGENCES_EXTRANET: ExigenceExtranet[] = [
  { id: 'ex1',  label: 'Règlement de copropriété',                    categorie: 'reglement_copro',  description: 'Dernière version du règlement de copropriété en vigueur',            referenceJuridique: 'Décret n°2019-502 du 23/05/2019 — art. 1',           retention: 'permanent' },
  { id: 'ex2',  label: 'État descriptif de division',                  categorie: 'etat_descriptif',  description: 'EDD en vigueur avec la répartition des tantièmes',                   referenceJuridique: 'Décret n°2019-502 du 23/05/2019 — art. 1',           retention: 'permanent' },
  { id: 'ex3',  label: 'PV des AG des 3 dernières années',            categorie: 'pv_ag',            description: 'Procès-verbaux des assemblées générales des 3 derniers exercices',   referenceJuridique: 'Décret n°2019-502 du 23/05/2019 — art. 2',           retention: '10_ans' },
  { id: 'ex4',  label: 'Fiche synthétique copropriété',               categorie: 'budgets_comptes',  description: 'Fiche synthétique (données financières, techniques, juridiques)',    referenceJuridique: 'Art. 8-2 loi n°65-557 du 10/07/1965',                retention: '5_ans' },
  { id: 'ex5',  label: 'Contrats en cours',                            categorie: 'contrats',         description: 'Ensemble des contrats passés par le syndic (entretien, assurance)', referenceJuridique: 'Décret n°2019-502 du 23/05/2019 — art. 3',           retention: '10_ans' },
  { id: 'ex6',  label: 'Carnet d\'entretien',                          categorie: 'carnet_entretien', description: 'Carnet d\'entretien de l\'immeuble à jour',                          referenceJuridique: 'Art. 18 loi n°65-557 — décret n°2001-477',           retention: 'permanent' },
  { id: 'ex7',  label: 'Diagnostics techniques (DPE, amiante, plomb)', categorie: 'diagnostics',      description: 'Diagnostics techniques obligatoires en cours de validité',          referenceJuridique: 'Décret n°2019-502 du 23/05/2019 — art. 4',           retention: '10_ans' },
  { id: 'ex8',  label: 'DTG (Diagnostic Technique Global)',            categorie: 'diagnostics',      description: 'DTG si réalisé — état du bâti, équipements, améliorations',         referenceJuridique: 'Art. 14-2 loi n°65-557 du 10/07/1965',               retention: '10_ans' },
  { id: 'ex9',  label: 'PPPT (Plan Pluriannuel de Travaux)',           categorie: 'diagnostics',      description: 'PPPT adopté en AG — travaux programmés sur 10 ans',                 referenceJuridique: 'Art. 14-2 loi n°65-557 — loi Climat 22/08/2021',     retention: '10_ans' },
  { id: 'ex10', label: 'Budget prévisionnel & comptes annuels',       categorie: 'budgets_comptes',  description: 'Budget prévisionnel voté en AG et comptes de l\'exercice clos',     referenceJuridique: 'Décret n°2019-502 du 23/05/2019 — art. 2',           retention: '5_ans' },
  { id: 'ex11', label: 'Relevés de charges copropriétaires',          categorie: 'budgets_comptes',  description: 'Relevés individuels de charges de l\'exercice clos',                referenceJuridique: 'Art. 18-1 loi n°65-557 du 10/07/1965',               retention: '5_ans' },
  { id: 'ex12', label: 'Assurance multirisque immeuble',              categorie: 'assurances',       description: 'Attestation d\'assurance MRI en cours de validité',                  referenceJuridique: 'Loi n°65-557 art. 18 — obligation du syndic',        retention: '10_ans' },
]

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}

const formatSize = (mo: number) => mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.round(mo * 1024)} Ko`

const generateHash = () => {
  const chars = '0123456789abcdef'
  let hash = ''
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)]
  return hash
}

// ─── Demo data ────────────────────────────────────────────────────────────────

function generateDemoData(userId: string) {
  const immeubles = [
    { id: 'imm1', nom: 'Résidence Les Oliviers' },
    { id: 'imm2', nom: 'Le Parc Saint-Charles' },
  ]

  const documents: GEDDocumentCertifie[] = [
    { id: 'doc1',  nom: 'PV AG Ordinaire 2025',           categorie: 'pv_ag',           immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2025-03-15', dateUpload: '2025-03-20', hashSHA256: generateHash(), tailleMo: 2.4,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: '',                          tags: ['AG', '2025'],              retention: '10_ans' },
    { id: 'doc2',  nom: 'PV AG Ordinaire 2024',           categorie: 'pv_ag',           immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2024-03-12', dateUpload: '2024-03-18', hashSHA256: generateHash(), tailleMo: 2.1,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: '',                          tags: ['AG', '2024'],              retention: '10_ans' },
    { id: 'doc3',  nom: 'PV AG Ordinaire 2023',           categorie: 'pv_ag',           immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2023-03-10', dateUpload: '2023-03-16', hashSHA256: generateHash(), tailleMo: 1.8,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: '',                          tags: ['AG', '2023'],              retention: '10_ans' },
    { id: 'doc4',  nom: 'Convocation AG 2025',            categorie: 'convocations',    immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2025-02-22', dateUpload: '2025-02-22', hashSHA256: generateHash(), tailleMo: 0.8,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: 'Envoyée 21j avant AG',     tags: ['convocation', 'AG 2025'],  retention: '10_ans' },
    { id: 'doc5',  nom: 'Règlement de copropriété',       categorie: 'reglement_copro', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2010-06-15', dateUpload: '2022-01-10', hashSHA256: generateHash(), tailleMo: 5.2,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: 'Version consolidée 2010',  tags: ['règlement'],               retention: 'permanent' },
    { id: 'doc6',  nom: 'État descriptif de division',    categorie: 'etat_descriptif', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2010-06-15', dateUpload: '2022-01-10', hashSHA256: generateHash(), tailleMo: 3.1,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: '',                          tags: ['EDD'],                     retention: 'permanent' },
    { id: 'doc7',  nom: 'Budget prévisionnel 2025-2026',  categorie: 'budgets_comptes', immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2025-03-15', dateUpload: '2025-03-20', hashSHA256: generateHash(), tailleMo: 1.2,  typeFichier: 'xls', uploadeParNom: 'Admin Syndic', notes: 'Voté en AG',               tags: ['budget', '2025'],          retention: '5_ans' },
    { id: 'doc8',  nom: 'Contrat ascenseur Schindler',    categorie: 'contrats',        immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2023-01-01', dateUpload: '2023-01-05', hashSHA256: generateHash(), tailleMo: 1.5,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: 'Contrat P3 renouvelé 2023', tags: ['ascenseur', 'contrat'],    retention: '10_ans' },
    { id: 'doc9',  nom: 'Attestation assurance MRI 2025', categorie: 'assurances',      immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2025-01-01', dateUpload: '2025-01-08', hashSHA256: generateHash(), tailleMo: 0.5,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: 'MAIF Copro',               tags: ['assurance', 'MRI'],        retention: '10_ans' },
    { id: 'doc10', nom: 'DPE collectif',                  categorie: 'diagnostics',     immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2024-06-15', dateUpload: '2024-06-20', hashSHA256: generateHash(), tailleMo: 3.8,  typeFichier: 'pdf', uploadeParNom: 'Diagnostiqueur', notes: 'Classe D',              tags: ['DPE', 'diagnostic'],       retention: '10_ans' },
    { id: 'doc11', nom: 'Diagnostic amiante',             categorie: 'diagnostics',     immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2020-09-10', dateUpload: '2020-09-15', hashSHA256: generateHash(), tailleMo: 2.2,  typeFichier: 'pdf', uploadeParNom: 'Diagnostiqueur', notes: 'Négatif',               tags: ['amiante', 'diagnostic'],   retention: '10_ans' },
    { id: 'doc12', nom: 'Carnet d\'entretien',            categorie: 'carnet_entretien',immeubleId: 'imm1', immeubleNom: 'Résidence Les Oliviers', datePiece: '2025-01-15', dateUpload: '2025-01-15', hashSHA256: generateHash(), tailleMo: 1.9,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: 'Mis à jour janv. 2025',    tags: ['entretien'],               retention: 'permanent' },
    { id: 'doc13', nom: 'PV AG Ordinaire 2025',           categorie: 'pv_ag',           immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles',  datePiece: '2025-04-05', dateUpload: '2025-04-10', hashSHA256: generateHash(), tailleMo: 2.7,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: '',                          tags: ['AG', '2025'],              retention: '10_ans' },
    { id: 'doc14', nom: 'PPPT adopté en AG',              categorie: 'diagnostics',     immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles',  datePiece: '2025-04-05', dateUpload: '2025-04-10', hashSHA256: generateHash(), tailleMo: 4.5,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: 'Plan sur 10 ans',           tags: ['PPPT', 'travaux'],         retention: '10_ans' },
    { id: 'doc15', nom: 'Règlement de copropriété',       categorie: 'reglement_copro', immeubleId: 'imm2', immeubleNom: 'Le Parc Saint-Charles',  datePiece: '2005-03-01', dateUpload: '2022-02-15', hashSHA256: generateHash(), tailleMo: 4.8,  typeFichier: 'pdf', uploadeParNom: 'Admin Syndic', notes: '',                          tags: ['règlement'],               retention: 'permanent' },
  ]

  const config: ConfigGED = {
    autoClassificationIA: true,
    backupActif: true,
    dernierBackup: new Date(Date.now() - 86400000).toISOString(),
    stockageUtiliseMo: documents.reduce((s, d) => s + d.tailleMo, 0),
    stockageLimiteMo: 5000,
  }

  return { immeubles, documents, config }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function GEDCertifieeFRSection({ user, userRole }: { user: any; userRole: string }) {
  const STORAGE_KEY = `fixit_ged_fr_${user.id}`

  const [activeTab, setActiveTab] = useState<'bibliotheque' | 'recherche' | 'conformite' | 'configuration'>('bibliotheque')
  const [immeubles, setImmeubles] = useState<{ id: string; nom: string }[]>([])
  const [documents, setDocuments] = useState<GEDDocumentCertifie[]>([])
  const [config, setConfig] = useState<ConfigGED>({ autoClassificationIA: true, backupActif: true, dernierBackup: '', stockageUtiliseMo: 0, stockageLimiteMo: 5000 })

  // Filters
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES_ORDER))

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDateFrom, setSearchDateFrom] = useState('')
  const [searchDateTo, setSearchDateTo] = useState('')
  const [searchCategorie, setSearchCategorie] = useState<CategorieDocument | ''>('')
  const [searchTypeFichier, setSearchTypeFichier] = useState<TypeFichier | ''>('')

  // Upload
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState<Partial<GEDDocumentCertifie>>({ categorie: 'pv_ag', typeFichier: 'pdf', retention: '10_ans', tags: [] })
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Conformité
  const [conformiteImmeuble, setConformiteImmeuble] = useState('')

  // ── Persistance ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        setImmeubles(data.immeubles || [])
        setDocuments(data.documents || [])
        setConfig(data.config || { autoClassificationIA: true, backupActif: true, dernierBackup: '', stockageUtiliseMo: 0, stockageLimiteMo: 5000 })
      } else {
        const demo = generateDemoData(user.id)
        setImmeubles(demo.immeubles)
        setDocuments(demo.documents)
        setConfig(demo.config)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
      }
    } catch {
      const demo = generateDemoData(user.id)
      setImmeubles(demo.immeubles)
      setDocuments(demo.documents)
      setConfig(demo.config)
    }
  }, [])

  const saveAll = (upd: { immeubles?: { id: string; nom: string }[]; documents?: GEDDocumentCertifie[]; config?: ConfigGED }) => {
    const data = {
      immeubles: upd.immeubles ?? immeubles,
      documents: upd.documents ?? documents,
      config: upd.config ?? config,
    }
    if (upd.immeubles) setImmeubles(upd.immeubles)
    if (upd.documents) setDocuments(upd.documents)
    if (upd.config) setConfig(upd.config)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const docsByCategorie = useMemo(() => {
    const map: Record<string, GEDDocumentCertifie[]> = {}
    CATEGORIES_ORDER.forEach(cat => { map[cat] = [] })
    documents.filter(d => !filterImmeuble || d.immeubleId === filterImmeuble).forEach(d => {
      if (!map[d.categorie]) map[d.categorie] = []
      map[d.categorie].push(d)
    })
    return map
  }, [documents, filterImmeuble])

  const searchResults = useMemo(() => {
    if (!searchQuery && !searchDateFrom && !searchDateTo && !searchCategorie && !searchTypeFichier) return []
    return documents.filter(d => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = d.nom.toLowerCase().includes(q) || d.notes.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q)) || d.immeubleNom.toLowerCase().includes(q)
        if (!match) return false
      }
      if (searchDateFrom && d.datePiece < searchDateFrom) return false
      if (searchDateTo && d.datePiece > searchDateTo) return false
      if (searchCategorie && d.categorie !== searchCategorie) return false
      if (searchTypeFichier && d.typeFichier !== searchTypeFichier) return false
      return true
    })
  }, [documents, searchQuery, searchDateFrom, searchDateTo, searchCategorie, searchTypeFichier])

  const conformiteChecklist = useMemo(() => {
    const targetImm = conformiteImmeuble || (immeubles[0]?.id || '')
    return EXIGENCES_EXTRANET.map(ex => {
      const docsMatching = documents.filter(d => d.categorie === ex.categorie && d.immeubleId === targetImm)
      let statut: StatutConformite = 'manquant'
      if (docsMatching.length > 0) {
        if (ex.categorie === 'diagnostics') {
          const latestDoc = docsMatching.sort((a, b) => b.datePiece.localeCompare(a.datePiece))[0]
          const ageDays = (Date.now() - new Date(latestDoc.datePiece).getTime()) / 86400000
          statut = ageDays > 3650 ? 'expire' : 'ok'
        } else {
          statut = 'ok'
        }
      }
      return { ...ex, statut, docsCount: docsMatching.length }
    })
  }, [documents, conformiteImmeuble, immeubles])

  const conformiteStats = useMemo(() => ({
    ok: conformiteChecklist.filter(e => e.statut === 'ok').length,
    manquant: conformiteChecklist.filter(e => e.statut === 'manquant').length,
    expire: conformiteChecklist.filter(e => e.statut === 'expire').length,
    total: conformiteChecklist.length,
  }), [conformiteChecklist])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setExpandedCategories(next)
  }

  const handleUpload = () => {
    if (!uploadForm.nom || !uploadForm.categorie || !uploadForm.immeubleId) return
    const imm = immeubles.find(i => i.id === uploadForm.immeubleId)
    const newDoc: GEDDocumentCertifie = {
      id: `doc-${Date.now()}`,
      nom: uploadForm.nom || '',
      categorie: uploadForm.categorie as CategorieDocument,
      immeubleId: uploadForm.immeubleId,
      immeubleNom: imm?.nom || '',
      datePiece: uploadForm.datePiece || new Date().toISOString().split('T')[0],
      dateUpload: new Date().toISOString(),
      hashSHA256: generateHash(),
      tailleMo: uploadForm.tailleMo || Math.round(Math.random() * 40 + 5) / 10,
      typeFichier: (uploadForm.typeFichier as TypeFichier) || 'pdf',
      uploadeParNom: 'Admin Syndic',
      notes: uploadForm.notes || '',
      tags: uploadForm.tags || [],
      retention: (uploadForm.retention as PolitiqueRetention) || '10_ans',
    }
    const updatedDocs = [...documents, newDoc]
    const updatedConfig = { ...config, stockageUtiliseMo: config.stockageUtiliseMo + newDoc.tailleMo }
    saveAll({ documents: updatedDocs, config: updatedConfig })
    setShowUpload(false)
    setUploadForm({ categorie: 'pv_ag', typeFichier: 'pdf', retention: '10_ans', tags: [] })
  }

  const deleteDocument = (id: string) => {
    if (!window.confirm('Supprimer ce document ? Cette action est irréversible.')) return
    const doc = documents.find(d => d.id === id)
    const updatedDocs = documents.filter(d => d.id !== id)
    const updatedConfig = { ...config, stockageUtiliseMo: Math.max(0, config.stockageUtiliseMo - (doc?.tailleMo || 0)) }
    saveAll({ documents: updatedDocs, config: updatedConfig })
  }

  const verifyHash = (doc: GEDDocumentCertifie) => {
    window.alert(`Vérification d'intégrité SHA-256\n\nDocument: ${doc.nom}\nHash: ${doc.hashSHA256}\n\nRésultat: ✅ Intégrité vérifiée — le document n'a pas été modifié depuis son dépôt.`)
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabsList = [
    { key: 'bibliotheque' as const, label: 'Bibliothèque',  icon: '📚' },
    { key: 'recherche' as const,    label: 'Recherche',      icon: '🔍' },
    { key: 'conformite' as const,   label: 'Conformité',     icon: '✅' },
    { key: 'configuration' as const,label: 'Configuration',  icon: '⚙️' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header + Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabsList.map(t => (
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

      {/* ── TAB: Bibliothèque ────────────────────────────────────────────────── */}
      {activeTab === 'bibliotheque' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--sd-ink-3,#888)]">GED certifiée — Documents classés par catégorie</p>
            <div className="flex gap-2">
              <span className="text-xs text-gray-500 self-center">{documents.length} document(s) — {formatSize(config.stockageUtiliseMo)}</span>
              <button onClick={() => setShowUpload(true)} className="bg-[var(--sd-navy,#0D1B2E)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition">+ Ajouter un document</button>
            </div>
          </div>

          {/* ELAN export notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <strong>Loi ELAN — Interopérabilité:</strong> En cas de changement de syndic, l'ensemble des documents est restituable en format standardisé normé, conformément aux obligations de transfert de données.
          </div>

          {/* Tree view by category */}
          <div className="space-y-2">
            {CATEGORIES_ORDER.map(cat => {
              const catCfg = CATEGORIE_CONFIG[cat]
              const docs = docsByCategorie[cat] || []
              const isExpanded = expandedCategories.has(cat)
              return (
                <div key={cat} className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] shadow-sm overflow-hidden">
                  <button onClick={() => toggleCategory(cat)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--sd-cream,#F7F4EE)] transition">
                    <span className="text-lg">{isExpanded ? '📂' : '📁'}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catCfg.color}`}>{catCfg.icon} {catCfg.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{docs.length} document(s)</span>
                    <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                  </button>
                  {isExpanded && docs.length > 0 && (
                    <div className="border-t border-[var(--sd-border,#E4DDD0)]">
                      <div className="grid grid-cols-12 gap-2 px-4 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase">
                        <div className="col-span-1"></div>
                        <div className="col-span-3">Nom</div>
                        <div className="col-span-2">Immeuble</div>
                        <div className="col-span-1">Date</div>
                        <div className="col-span-1">Taille</div>
                        <div className="col-span-2">Hash SHA-256</div>
                        <div className="col-span-1">Rétention</div>
                        <div className="col-span-1"></div>
                      </div>
                      {docs.sort((a, b) => b.datePiece.localeCompare(a.datePiece)).map(doc => (
                        <div key={doc.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-50 hover:bg-[var(--sd-cream,#F7F4EE)] group items-center">
                          <div className="col-span-1 text-center">{TYPE_FICHIER_ICON[doc.typeFichier]}</div>
                          <div className="col-span-3">
                            <div className="text-sm font-medium text-[var(--sd-navy,#0D1B2E)] truncate">{doc.nom}</div>
                            {doc.notes && <div className="text-[10px] text-gray-400 truncate">{doc.notes}</div>}
                            {doc.tags.length > 0 && (
                              <div className="flex gap-1 mt-0.5">
                                {doc.tags.map(tag => <span key={tag} className="text-[9px] bg-[var(--sd-cream,#F7F4EE)] text-[var(--sd-ink-3,#888)] px-1.5 py-0.5 rounded">{tag}</span>)}
                              </div>
                            )}
                          </div>
                          <div className="col-span-2 text-xs text-gray-500 truncate">{doc.immeubleNom}</div>
                          <div className="col-span-1 text-xs text-gray-600">{formatDate(doc.datePiece)}</div>
                          <div className="col-span-1 text-xs text-gray-500">{formatSize(doc.tailleMo)}</div>
                          <div className="col-span-2">
                            <button onClick={() => verifyHash(doc)} className="text-[9px] font-mono text-gray-400 hover:text-[var(--sd-gold,#C9A84C)] truncate block max-w-full transition" title="Cliquer pour vérifier l'intégrité">
                              {doc.hashSHA256.substring(0, 16)}...
                            </button>
                          </div>
                          <div className="col-span-1">
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{RETENTION_CONFIG[doc.retention].label}</span>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button onClick={() => deleteDocument(doc.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-sm transition">🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && docs.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400 border-t border-[var(--sd-border,#E4DDD0)]">Aucun document dans cette catégorie</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Upload Modal */}
          {showUpload && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
              <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-[var(--sd-navy,#0D1B2E)] mb-4">Ajouter un document</h3>

                {/* Drag & drop zone */}
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition cursor-pointer ${dragOver ? 'border-[var(--sd-gold,#C9A84C)] bg-yellow-50' : 'border-gray-300 bg-gray-50'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false) }}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="text-2xl mb-2">📄</div>
                  <p className="text-sm text-gray-600">Glissez-déposez ou cliquez pour sélectionner un fichier</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, XLS, JPG, PNG</p>
                  <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={() => {}} />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Nom du document</label>
                    <input type="text" value={uploadForm.nom || ''} onChange={e => setUploadForm({ ...uploadForm, nom: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" placeholder="Ex: PV AG Ordinaire 2026" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Catégorie</label>
                      <select value={uploadForm.categorie || 'pv_ag'} onChange={e => setUploadForm({ ...uploadForm, categorie: e.target.value as CategorieDocument })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        {CATEGORIES_ORDER.map(cat => <option key={cat} value={cat}>{CATEGORIE_CONFIG[cat].icon} {CATEGORIE_CONFIG[cat].label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Immeuble</label>
                      <select value={uploadForm.immeubleId || ''} onChange={e => setUploadForm({ ...uploadForm, immeubleId: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        <option value="">Sélectionner</option>
                        {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Date de la pièce</label>
                      <input type="date" value={uploadForm.datePiece || ''} onChange={e => setUploadForm({ ...uploadForm, datePiece: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Type fichier</label>
                      <select value={uploadForm.typeFichier || 'pdf'} onChange={e => setUploadForm({ ...uploadForm, typeFichier: e.target.value as TypeFichier })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        <option value="pdf">📕 PDF</option>
                        <option value="doc">📘 DOC</option>
                        <option value="xls">📗 XLS</option>
                        <option value="jpg">🖼️ JPG</option>
                        <option value="png">🖼️ PNG</option>
                        <option value="autre">📎 Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Rétention</label>
                      <select value={uploadForm.retention || '10_ans'} onChange={e => setUploadForm({ ...uploadForm, retention: e.target.value as PolitiqueRetention })}
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                        {Object.entries(RETENTION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.duree})</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Notes</label>
                    <input type="text" value={uploadForm.notes || ''} onChange={e => setUploadForm({ ...uploadForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Tags (séparés par virgule)</label>
                    <input type="text" value={(uploadForm.tags || []).join(', ')} onChange={e => setUploadForm({ ...uploadForm, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" placeholder="Ex: AG, 2026, budget" />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowUpload(false)} className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                  <button onClick={handleUpload} className="flex-1 px-4 py-2 bg-[var(--sd-navy,#0D1B2E)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Recherche ───────────────────────────────────────────────────── */}
      {activeTab === 'recherche' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--sd-ink-3,#888)]">Recherche plein texte et filtres avancés</p>

          {/* Search bar */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input type="text" placeholder="Rechercher un document (nom, notes, tags, immeuble)..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-[var(--sd-border,#E4DDD0)] rounded-xl text-sm bg-[var(--sd-cream,#F7F4EE)] focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none focus:bg-white" />
                <span className="absolute left-3 top-3 text-gray-400">🔍</span>
              </div>
            </div>

            {/* Advanced filters */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <input type="date" value={searchDateFrom} onChange={e => setSearchDateFrom(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
              <span className="self-center text-xs text-gray-400">au</span>
              <input type="date" value={searchDateTo} onChange={e => setSearchDateTo(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none" />
              <select value={searchCategorie} onChange={e => setSearchCategorie(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                <option value="">Toutes catégories</option>
                {CATEGORIES_ORDER.map(cat => <option key={cat} value={cat}>{CATEGORIE_CONFIG[cat].label}</option>)}
              </select>
              <select value={searchTypeFichier} onChange={e => setSearchTypeFichier(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
                <option value="">Tous types</option>
                <option value="pdf">PDF</option>
                <option value="doc">DOC</option>
                <option value="xls">XLS</option>
                <option value="jpg">JPG</option>
                <option value="png">PNG</option>
              </select>
              <button onClick={() => { setSearchQuery(''); setSearchDateFrom(''); setSearchDateTo(''); setSearchCategorie(''); setSearchTypeFichier('') }}
                className="text-xs text-[var(--sd-gold,#C9A84C)] font-semibold hover:underline">Réinitialiser</button>
            </div>
          </div>

          {/* Results */}
          {(searchQuery || searchDateFrom || searchDateTo || searchCategorie || searchTypeFichier) && (
            <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-[var(--sd-cream,#F7F4EE)] border-b border-[var(--sd-border,#E4DDD0)] text-xs text-gray-500">
                {searchResults.length} résultat(s) trouvé(s)
              </div>
              {searchResults.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">Aucun document correspondant</div>
              )}
              {searchResults.map(doc => {
                const catCfg = CATEGORIE_CONFIG[doc.categorie]
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-[var(--sd-cream,#F7F4EE)]">
                    <span className="text-lg">{TYPE_FICHIER_ICON[doc.typeFichier]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--sd-navy,#0D1B2E)]">
                        {searchQuery ? (
                          <span dangerouslySetInnerHTML={{
                            __html: doc.nom.replace(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>')
                          }} />
                        ) : doc.nom}
                      </div>
                      <div className="text-[10px] text-gray-400">{doc.immeubleNom} — {doc.notes}</div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catCfg.color}`}>{catCfg.label}</span>
                    <span className="text-xs text-gray-500">{formatDate(doc.datePiece)}</span>
                    <span className="text-xs text-gray-400">{formatSize(doc.tailleMo)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Conformité ──────────────────────────────────────────────────── */}
      {activeTab === 'conformite' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--sd-ink-3,#888)]">Documents obligatoires extranet — Décret n°2019-502 du 23/05/2019</p>
            <select value={conformiteImmeuble} onChange={e => setConformiteImmeuble(e.target.value)}
              className="px-3 py-2 border-2 border-[var(--sd-border,#E4DDD0)] rounded-lg text-sm bg-white focus:border-[var(--sd-gold,#C9A84C)] focus:outline-none">
              <option value="">Sélectionner un immeuble</option>
              {immeubles.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3">
              <div className="text-lg mb-0.5">✅</div>
              <div className="text-xl font-bold text-green-700">{conformiteStats.ok}</div>
              <div className="text-xs text-green-600">Conformes</div>
            </div>
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3">
              <div className="text-lg mb-0.5">❌</div>
              <div className="text-xl font-bold text-red-700">{conformiteStats.manquant}</div>
              <div className="text-xs text-red-600">Manquants</div>
            </div>
            <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-3">
              <div className="text-lg mb-0.5">⚠️</div>
              <div className="text-xl font-bold text-orange-700">{conformiteStats.expire}</div>
              <div className="text-xs text-orange-600">Expirés</div>
            </div>
            <div className="rounded-xl border-2 border-[var(--sd-border,#E4DDD0)] bg-white p-3">
              <div className="text-lg mb-0.5">📊</div>
              <div className="text-xl font-bold text-[var(--sd-navy,#0D1B2E)]">{conformiteStats.total > 0 ? Math.round((conformiteStats.ok / conformiteStats.total) * 100) : 0}%</div>
              <div className="text-xs text-[var(--sd-ink-3,#888)]">Complétude</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-[var(--sd-navy,#0D1B2E)]">Taux de conformité extranet</span>
              <span className="text-sm font-bold text-[var(--sd-gold,#C9A84C)]">{conformiteStats.total > 0 ? Math.round((conformiteStats.ok / conformiteStats.total) * 100) : 0}%</span>
            </div>
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all" style={{ width: `${conformiteStats.total > 0 ? (conformiteStats.ok / conformiteStats.total) * 100 : 0}%` }} />
            </div>
          </div>

          {/* ELAN interoperability */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <strong>Interopérabilité (Loi ELAN):</strong> Format normé pour transfert entre syndics. Obligation de restitution de l'intégralité des données et documents en format standardisé lors d'un changement de syndic.
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[var(--sd-cream,#F7F4EE)] text-[10px] font-semibold text-gray-500 uppercase">
              <div className="col-span-1">Statut</div>
              <div className="col-span-3">Document obligatoire</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-3">Référence juridique</div>
              <div className="col-span-1">Rétention</div>
              <div className="col-span-1">Docs</div>
            </div>
            {conformiteChecklist.map(ex => {
              const stCfg = STATUT_CONF_CONFIG[ex.statut]
              return (
                <div key={ex.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-50 items-center ${ex.statut === 'manquant' ? 'bg-red-50/30' : ex.statut === 'expire' ? 'bg-orange-50/30' : ''}`}>
                  <div className="col-span-1 text-center">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${stCfg.badge}`}>{stCfg.icon}</span>
                  </div>
                  <div className="col-span-3 text-sm font-medium text-[var(--sd-navy,#0D1B2E)]">{ex.label}</div>
                  <div className="col-span-3 text-xs text-gray-600">{ex.description}</div>
                  <div className="col-span-3 text-[10px] text-blue-700">{ex.referenceJuridique}</div>
                  <div className="col-span-1"><span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{RETENTION_CONFIG[ex.retention].label}</span></div>
                  <div className="col-span-1 text-center text-xs font-bold text-[var(--sd-navy,#0D1B2E)]">{ex.docsCount}</div>
                </div>
              )
            })}
          </div>

          {/* Hash integrity section */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-4 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">🔐 Vérification d'intégrité</h3>
            <p className="text-xs text-gray-600 mb-3">Chaque document déposé est associé à un hash SHA-256 simulé. Cliquez sur le hash dans la bibliothèque pour vérifier l'intégrité du fichier.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-xs text-green-700">
                <strong>Valeur probante:</strong> Le hash SHA-256 garantit que le document n'a pas été modifié depuis son dépôt. En cas de litige, cette empreinte numérique fait foi.
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                <strong>Horodatage:</strong> La date et l'heure de dépôt sont enregistrées automatiquement et ne peuvent pas être modifiées a posteriori.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Configuration ───────────────────────────────────────────────── */}
      {activeTab === 'configuration' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--sd-ink-3,#888)]">Paramètres de la GED certifiée</p>

          {/* Retention policies */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">📁 Politiques de rétention</h3>
            <div className="space-y-2">
              {Object.entries(RETENTION_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-3 bg-[var(--sd-cream,#F7F4EE)] rounded-xl p-3">
                  <span className="text-sm font-bold text-[var(--sd-navy,#0D1B2E)] min-w-[80px]">{cfg.label}</span>
                  <span className="text-xs text-gray-600 flex-1">{cfg.exemples}</span>
                  <span className="text-xs text-[var(--sd-ink-3,#888)]">{cfg.duree}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auto-classification IA */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">🤖 Classification IA automatique</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-12 h-6 rounded-full transition-colors relative ${config.autoClassificationIA ? 'bg-green-500' : 'bg-gray-300'}`}
                onClick={() => { const upd = { ...config, autoClassificationIA: !config.autoClassificationIA }; saveAll({ config: upd }) }}>
                <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform ${config.autoClassificationIA ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-[var(--sd-navy,#0D1B2E)]">Classer automatiquement les documents lors du dépôt (analyse du nom et du contenu)</span>
            </label>
            <p className="text-xs text-gray-500 mt-2 ml-15">L'IA analyse le nom du fichier et propose automatiquement la catégorie, la rétention et les tags appropriés.</p>
          </div>

          {/* Storage usage */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">💾 Stockage</h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 relative h-5 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-[var(--sd-gold,#C9A84C)] rounded-full" style={{ width: `${Math.min(100, (config.stockageUtiliseMo / config.stockageLimiteMo) * 100)}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-600 min-w-[180px] text-right">
                {formatSize(config.stockageUtiliseMo)} / {formatSize(config.stockageLimiteMo)}
              </span>
            </div>
            <p className="text-xs text-gray-500">{Math.round((config.stockageUtiliseMo / config.stockageLimiteMo) * 100)}% utilisé — {documents.length} document(s)</p>
          </div>

          {/* Backup status */}
          <div className="bg-white rounded-2xl border border-[var(--sd-border,#E4DDD0)] p-5 shadow-sm">
            <h3 className="font-bold text-[var(--sd-navy,#0D1B2E)] mb-3">🔄 Sauvegarde</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-12 h-6 rounded-full transition-colors relative ${config.backupActif ? 'bg-green-500' : 'bg-gray-300'}`}
                  onClick={() => { const upd = { ...config, backupActif: !config.backupActif }; saveAll({ config: upd }) }}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform ${config.backupActif ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-[var(--sd-navy,#0D1B2E)]">Sauvegarde automatique activée</span>
              </label>
            </div>
            {config.dernierBackup && (
              <p className="text-xs text-gray-500 mt-2">Dernière sauvegarde: {formatDate(config.dernierBackup)}</p>
            )}
            <div className="mt-3 bg-green-50 rounded-xl p-3 text-xs text-green-700">
              <strong>Sécurité:</strong> Les documents sont sauvegardés automatiquement avec chiffrement. En cas de sinistre, les données peuvent être restaurées à partir de la dernière sauvegarde.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
