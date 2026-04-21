'use client'

/**
 * DevisFactureFormBTP — Formulaire devis pixel-perfect calqué sur la maquette
 * `vitfix_btp_dashboardpro_v8_settings.html` (id `pg-devis`).
 *
 * Spécifique au rôle `pro_societe` (compte BTP super admin). Le composant
 * standard `DevisFactureForm` reste utilisé pour les artisans / conciergerie
 * / gestionnaire — aucune régression sur ces parcours.
 *
 * Persistance compatible avec la liste V5 (`DevisSection.tsx`) :
 * - `localStorage["fixit_documents_<artisan.id>"]`  → devis envoyés/finalisés
 * - `localStorage["fixit_drafts_<artisan.id>"]`     → brouillons
 * - même shape que `DevisFactureForm` (docNumber, docTitle, lines, status…)
 *
 * Les helpers PDF (jsPDF V3) sont mutualisés avec le composant standard via
 * `lib/pdf/build-v2-input.ts` + `lib/pdf/devis-pdf-v3.ts`.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import NextImage from 'next/image'
import { toast } from 'sonner'
import {
  type ProductLine,
  type DevisAcompte,
  type DevisEtape,
  type DevisFactureFormProps,
  type ServiceBasic,
} from '@/lib/devis-types'
import { mapLegalFormToCode } from '@/lib/devis-utils'
import { generateDevisPdfV3 } from '@/lib/pdf/devis-pdf-v3'
import type { PdfV3Photo } from '@/lib/pdf/devis-pdf-v3'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { supabase } from '@/lib/supabase'
import { SEED_PREST, SEED_MAT } from '@/components/dashboard/PrestationsBTPSection'

/* ─────────────────────────────────────────────────────────────────
   CONSTANTES
   ───────────────────────────────────────────────────────────────── */

const STATUTS_JURIDIQUES = [
  'Entreprise Individuelle (EI)',
  'EURL',
  'SARL',
  'SAS',
  'SASU',
  'SA',
  'Auto-entrepreneur',
] as const

// Unités BTP complètes — alignées avec le catalogue prestations (UNITES_DEVIS)
const UNITES_TABLEAU = [
  // Géométrie
  { value: 'm2',       label: 'm² — Mètre carré' },
  { value: 'ml',       label: 'ml — Mètre linéaire' },
  { value: 'm',        label: 'm — Mètre' },
  { value: 'm3',       label: 'm³ — Mètre cube' },
  // Comptage
  { value: 'u',        label: 'u — Unité' },
  { value: 'pce',      label: 'pce — Pièce' },
  { value: 'ens',      label: 'ens — Ensemble' },
  { value: 'lot',      label: 'lot — Lot' },
  { value: 'pt',       label: 'pt — Point' },
  // Poids / volume liquide
  { value: 'kg',       label: 'kg — Kilogramme' },
  { value: 't',        label: 't — Tonne' },
  { value: 'L',        label: 'L — Litre' },
  // Conditionnement chantier
  { value: 'sac',      label: 'sac — Sac' },
  { value: 'rl',       label: 'rl — Rouleau' },
  { value: 'palette',  label: 'palette' },
  { value: 'benne',    label: 'benne' },
  { value: 'camion',   label: 'camion' },
  // Temps
  { value: 'h',        label: 'h — Heure' },
  { value: 'j',        label: 'j — Jour' },
  { value: 'sem',      label: 'sem — Semaine' },
  // Facturation
  { value: 'f',        label: 'f — Forfait' },
] as const

const TVA_RATES = [20, 10, 5.5, 0] as const

// Mapping catalogue BTP → devis (identifiants courts). Partagé entre
// l'aliment allServices et selectMotif (étapes).
const UNIT_CATALOGUE_TO_DEVIS: Record<string, string> = {
  'm²': 'm2', 'm2': 'm2', 'ml': 'ml', 'm': 'm', 'm³': 'm3', 'm3': 'm3',
  'u': 'u', 'pce': 'pce', 'ens': 'ens', 'lot': 'lot', 'pt': 'pt',
  'kg': 'kg', 't': 't', 'L': 'L', 'l': 'L',
  'sac': 'sac', 'rl': 'rl', 'palette': 'palette', 'benne': 'benne', 'camion': 'camion',
  'h': 'h', 'jour': 'j', 'j': 'j', 'semaine': 'sem', 'sem': 'sem',
  'forfait': 'f', 'f': 'f',
}
function mapCatalogueUnit(u?: string): string {
  if (!u) return 'u'
  return UNIT_CATALOGUE_TO_DEVIS[u] || 'u'
}

const DECLENCHEURS_ACOMPTE = [
  'À la signature',
  'Au démarrage',
  'À mi-chantier',
  'À la livraison',
  '30 jours',
  '60 jours',
] as const

const MODES_PAIEMENT = [
  'Virement bancaire',
  'Chèque',
  'Carte bancaire',
  'Espèces (≤ 1000 €)',
  'Prélèvement SEPA',
] as const

const DELAIS_PAIEMENT = [
  'Comptant à réception',
  '30 jours',
  '45 jours fin de mois',
  '60 jours',
] as const

const ESCOMPTES = [
  'Aucun escompte accordé pour paiement anticipé',
  '1 % pour paiement à 10 jours',
  '2 % pour paiement comptant',
] as const

const TYPES_ASSURANCE = [
  { value: 'rc_pro',    label: 'RC Professionnelle' },
  { value: 'decennale', label: 'Décennale' },
  { value: 'both',      label: 'RC Pro + Décennale' },
] as const

/* ─────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const generateDocNumber = (artisanId?: string): string => {
  const year = new Date().getFullYear()
  try {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisanId}`) || '[]')
    const all = [...docs, ...drafts]
    const nums = all
      .map((d: { docNumber?: string }) => d.docNumber || '')
      .filter((n: string) => n.startsWith(`DEV-${year}-`))
      .map((n: string) => parseInt(n.split('-')[2] || '0', 10))
      .filter((n: number) => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `DEV-${year}-${String(next).padStart(3, '0')}`
  } catch {
    return `DEV-${year}-001`
  }
}

/* ─────────────────────────────────────────────────────────────────
   COMPOSANT
   ───────────────────────────────────────────────────────────────── */

export default function DevisFactureFormBTP({
  artisan,
  services,
  bookings,
  initialDocType = 'devis',
  initialData,
  onBack,
  onSave,
}: DevisFactureFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const { t } = useTranslation()
  const locale = useLocale()

  /* ──────── State ──────── */
  const [docType, setDocType] = useState<'devis' | 'facture'>(
    (initialData?.docType as 'devis' | 'facture') || initialDocType
  )
  const [docNumber] = useState<string>(initialData?.docNumber || generateDocNumber(artisan?.id))
  const [docTitle, setDocTitle] = useState(initialData?.docTitle || '')

  // Entreprise
  const [statutJuridique, setStatutJuridique] = useState(() => {
    if (initialData?.companyStatus) return initialData.companyStatus
    if (artisan?.legal_form) {
      const code = mapLegalFormToCode(artisan.legal_form)
      // Map code retourné → valeur exacte STATUTS_JURIDIQUES
      const codeToLabel: Record<string, string> = {
        'ei': 'Entreprise Individuelle (EI)',
        'eurl': 'EURL',
        'sarl': 'SARL',
        'sas': 'SAS',
        'sasu': 'SASU',
        'ae': 'Auto-entrepreneur',
        'sa': 'SA',
      }
      return codeToLabel[code] || 'Entreprise Individuelle (EI)'
    }
    return 'Entreprise Individuelle (EI)'
  })
  const [companyName, setCompanyName] = useState(initialData?.companyName || artisan?.company_name || '')
  const [companySiret, setCompanySiret] = useState(initialData?.companySiret || artisan?.siret || '')
  const [companyAddress, setCompanyAddress] = useState(initialData?.companyAddress || artisan?.company_address || artisan?.address || '')
  const [companyRCS, setCompanyRCS] = useState(() => {
    if (initialData?.companyRCS) return initialData.companyRCS
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { companyRCS?: string }) => d.companyRCS)
      if (last?.companyRCS) return last.companyRCS
    } catch { /* ignore */ }
    return ''
  })
  const [companyPhone, setCompanyPhone] = useState(initialData?.companyPhone || artisan?.phone || '')
  const [companyEmail, setCompanyEmail] = useState(initialData?.companyEmail || artisan?.email || '')
  const [tvaNumber, setTvaNumber] = useState(() => {
    if (initialData?.tvaNumber) return initialData.tvaNumber
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { tvaNumber?: string }) => d.tvaNumber)
      if (last?.tvaNumber) return last.tvaNumber
    } catch { /* ignore */ }
    return ''
  })
  const [companyAPE, setCompanyAPE] = useState(() => {
    if ((initialData as { companyAPE?: string })?.companyAPE) return (initialData as { companyAPE?: string }).companyAPE!
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { companyAPE?: string }) => d.companyAPE)
      if (last?.companyAPE) return last.companyAPE
    } catch { /* ignore */ }
    return ''
  })
  const [companyCapital, setCompanyCapital] = useState(() => {
    if (initialData?.companyCapital) return initialData.companyCapital
    // Cherche le capital dans les derniers documents créés
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { companyCapital?: string }) => d.companyCapital)
      if (last?.companyCapital) return last.companyCapital
    } catch { /* ignore */ }
    return ''
  })

  // Assurance & Médiation — fallback depuis derniers documents
  const [insuranceType, setInsuranceType] = useState<'rc_pro' | 'decennale' | 'both'>(() => {
    if (initialData?.insuranceType) return initialData.insuranceType
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { insuranceType?: string }) => d.insuranceType)
      if (last?.insuranceType) return last.insuranceType as 'rc_pro' | 'decennale' | 'both'
    } catch { /* ignore */ }
    if ((artisan as { insurance_type?: string })?.insurance_type) {
      return (artisan as { insurance_type: 'rc_pro' | 'decennale' | 'both' }).insurance_type
    }
    return 'rc_pro'
  })
  const [insuranceName, setInsuranceName] = useState(() => {
    if (initialData?.insuranceName) return initialData.insuranceName
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { insuranceName?: string }) => d.insuranceName)
      if (last?.insuranceName) return last.insuranceName
    } catch { /* ignore */ }
    return (artisan as { insurance_name?: string })?.insurance_name || ''
  })
  const [insuranceNumber, setInsuranceNumber] = useState(() => {
    if (initialData?.insuranceNumber) return initialData.insuranceNumber
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { insuranceNumber?: string }) => d.insuranceNumber)
      if (last?.insuranceNumber) return last.insuranceNumber
    } catch { /* ignore */ }
    return (artisan as { insurance_number?: string })?.insurance_number || ''
  })
  const [insuranceCoverage, setInsuranceCoverage] = useState(() => {
    if (initialData?.insuranceCoverage) return initialData.insuranceCoverage
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { insuranceCoverage?: string }) => d.insuranceCoverage)
      if (last?.insuranceCoverage) return last.insuranceCoverage
    } catch { /* ignore */ }
    return (artisan as { insurance_coverage?: string })?.insurance_coverage || 'France métropolitaine'
  })
  const [mediatorName, setMediatorName] = useState(() => {
    if (initialData?.mediatorName) return initialData.mediatorName
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { mediatorName?: string }) => d.mediatorName)
      if (last?.mediatorName) return last.mediatorName
    } catch { /* ignore */ }
    return ''
  })
  const [mediatorUrl, setMediatorUrl] = useState(() => {
    if (initialData?.mediatorUrl) return initialData.mediatorUrl
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
      const last = [...docs, ...drafts].find((d: { mediatorUrl?: string }) => d.mediatorUrl)
      if (last?.mediatorUrl) return last.mediatorUrl
    } catch { /* ignore */ }
    return ''
  })

  // TVA
  const [tvaEnabled] = useState(true) // Sociétés pro : TVA obligatoire

  // Client
  const [clientType, setClientType] = useState<'particulier' | 'professionnel'>(
    (initialData?.clientType as 'particulier' | 'professionnel') || 'particulier'
  )
  const [clientName, setClientName] = useState(initialData?.clientName || '')
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '')
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '')
  const [clientSiret, setClientSiret] = useState(initialData?.clientSiret || '')
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress || '')
  const [interventionAddress, setInterventionAddress] = useState(initialData?.interventionAddress || '')
  const [interventionBatiment, setInterventionBatiment] = useState(initialData?.interventionBatiment || '')
  const [interventionEtage, setInterventionEtage] = useState(initialData?.interventionEtage || '')
  const [interventionEspacesCommuns, setInterventionEspacesCommuns] = useState(initialData?.interventionEspacesCommuns || '')
  const [interventionExterieur, setInterventionExterieur] = useState(initialData?.interventionExterieur || '')

  // Document
  const [docDate, setDocDate] = useState(initialData?.docDate || today)
  const [docValidity, setDocValidity] = useState<number>(initialData?.docValidity || 30)
  const [executionDelayDays, setExecutionDelayDays] = useState<number>(initialData?.executionDelayDays || 0)
  const [executionDelayType, setExecutionDelayType] = useState<string>(initialData?.executionDelayType || 'ouvres')

  // Lignes prestations
  const [lines, setLines] = useState<ProductLine[]>(
    initialData?.lines && initialData.lines.length > 0
      ? initialData.lines
      : [{ id: 1, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 20, totalHT: 0 }]
  )
  // Lignes matériaux (section séparée)
  const [materialLines, setMaterialLines] = useState<ProductLine[]>(
    [{ id: 1, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 20, totalHT: 0 }]
  )

  // Dropdown prestation ouvert (lineId ou null)
  const [openPrestaDrop, setOpenPrestaDrop] = useState<number | null>(null)
  useEffect(() => {
    if (!openPrestaDrop) return
    const close = () => setOpenPrestaDrop(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openPrestaDrop])

  // Acomptes — load saved defaults from localStorage when no initialData
  const [acomptesEnabled, setAcomptesEnabled] = useState(initialData?.acomptesEnabled ?? true)
  const [acomptes, setAcomptes] = useState<DevisAcompte[]>(() => {
    if (initialData?.acomptes && initialData.acomptes.length > 0) return initialData.acomptes
    try {
      const saved = localStorage.getItem(`fixit_echeancier_default_${artisan?.id || 'default'}`)
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ label: string; pourcentage: number }>
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p, i) => ({
            id: `a${i + 1}`,
            ordre: i + 1,
            label: `Acompte ${i + 1}`,
            pourcentage: p.pourcentage,
            declencheur: p.label,
          }))
        }
      }
    } catch { /* ignore corrupt data */ }
    return [{ id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 30, declencheur: 'À la signature' }]
  })

  // Modalités paiement
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || 'Virement bancaire')
  const [paymentDelay, setPaymentDelay] = useState((initialData as { paymentDelay?: string })?.paymentDelay || 'Comptant à réception')
  const [penaltyRate, setPenaltyRate] = useState((initialData as { penaltyRate?: string })?.penaltyRate || "3 × taux d'intérêt légal en vigueur")
  const [recoveryFee, setRecoveryFee] = useState((initialData as { recoveryFee?: string })?.recoveryFee || '40 € (BtoB uniquement)')
  const [escompte, setEscompte] = useState((initialData as { escompte?: string })?.escompte || ESCOMPTES[0])

  // Notes
  const [notes, setNotes] = useState(initialData?.notes || '')

  // Rapport d'intervention joint
  const [attachedRapportId, setAttachedRapportId] = useState<string | null>(null)
  const [availableRapports, setAvailableRapports] = useState<Record<string, unknown>[]>([])

  // Photos chantier
  const [availablePhotos, setAvailablePhotos] = useState<Array<{
    id: string; url: string; label?: string; taken_at?: string;
    lat?: number; lng?: number; booking_id?: string
  }>>([])
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [photosLoading, setPhotosLoading] = useState(false)

  // Import intervention sélectionnée
  const [selectedBookingId, setSelectedBookingId] = useState('')

  // Import devis fournisseur
  const [supplierScanning, setSupplierScanning] = useState(false)

  // Saving / loading flags
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Modals
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clientDb, setClientDb] = useState<Array<{ id: string; name: string; email?: string; phone?: string; siret?: string; mainAddress?: string; address?: string; interventionAddresses?: Array<{ id: string; label: string; address: string }> }>>([])
  const [clientDbSearch, setClientDbSearch] = useState('')
  const [clientDbLoading, setClientDbLoading] = useState(false)
  const [selectedClientInterventionAddresses, setSelectedClientInterventionAddresses] = useState<Array<{ id: string; label: string; address: string }>>([])

  /* ──────── Prestations BTP (merge Supabase services + localStorage catalogue) ──────── */

  const allServices = useMemo(() => {
    const supaServices: ServiceBasic[] = (services as ServiceBasic[]) || []
    const storageKey = `fixit_prestations_btp_v4_${artisan?.id || 'guest'}`
    let localPrest: ServiceBasic[] = []
    try {
      let raw = localStorage.getItem(storageKey)

      // Seed le localStorage si vide (même logique que PrestationsBTPSection)
      if (!raw && artisan?.id) {
        const all = [...SEED_PREST, ...SEED_MAT].map((p, i) => ({ id: i + 1, ...p }))
        localStorage.setItem(storageKey, JSON.stringify(all))
        raw = localStorage.getItem(storageKey)
      }

      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: number; name: string; type: string; description?: string; price?: { min?: number; max?: number }; unit?: string; etapes?: Array<string | { label: string; price?: number }> }>
        // Map unit from catalogue format → devis format (identifiant court)
        const mapUnit = (u?: string): string => {
          if (!u) return 'u'
          const m: Record<string, string> = {
            // Géométrie
            'm²': 'm2', 'm2': 'm2', 'ml': 'ml', 'm': 'm', 'm³': 'm3', 'm3': 'm3',
            // Comptage
            'u': 'u', 'pce': 'pce', 'ens': 'ens', 'lot': 'lot', 'pt': 'pt',
            // Poids / volume
            'kg': 'kg', 't': 't', 'L': 'L', 'l': 'L',
            // Conditionnement
            'sac': 'sac', 'rl': 'rl', 'palette': 'palette', 'benne': 'benne', 'camion': 'camion',
            // Temps
            'h': 'h', 'jour': 'j', 'j': 'j', 'semaine': 'sem', 'sem': 'sem',
            // Facturation
            'forfait': 'f', 'f': 'f',
          }
          return m[u] || 'u'
        }
        localPrest = parsed
          .filter(p => p.type === 'prest')
          .map(p => {
            const devisUnit = mapUnit(p.unit)
            const baseDesc = p.description || ''
            // Embed unit marker so selectMotif picks the right default unit
            const descWithUnit = `${baseDesc} [unit:${devisUnit}]`.trim()
            return {
              id: `btp_${p.id}`,
              name: p.name,
              price_ht: p.price?.min || 0,
              description: descWithUnit,
            }
          })
      }
    } catch { /* ignore */ }

    const names = new Set(supaServices.map(s => s.name.toLowerCase()))
    return [...supaServices, ...localPrest.filter(lp => !names.has(lp.name.toLowerCase()))]
  }, [services, artisan?.id])

  // Matériaux catalogue (from localStorage, type === 'mat')
  const allMaterials = useMemo(() => {
    const storageKey = `fixit_prestations_btp_v4_${artisan?.id || 'guest'}`
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: number; name: string; type: string; price?: { min?: number; max?: number }; unit?: string }>
        return parsed
          .filter(p => p.type === 'mat')
          .map(p => ({
            id: `btp_mat_${p.id}`,
            name: p.name,
            price_ht: p.price?.min || 0,
          }))
      }
    } catch { /* ignore */ }
    return [] as Array<{ id: string; name: string; price_ht: number }>
  }, [artisan?.id])

  /* ──────── Calculs ──────── */

  // Recalcule totalHT à chaque modif d'une ligne
  const recalcLine = useCallback((line: ProductLine): ProductLine => {
    const totalHT = (line.qty || 0) * (line.priceHT || 0)
    return { ...line, totalHT }
  }, [])

  const totaux = useMemo(() => {
    const allLines = [...lines, ...materialLines]
    const subTotalBrut = allLines.reduce((s, l) => s + (l.qty || 0) * (l.priceHT || 0), 0)
    const remise = 0 // pas de remise globale dans la maquette V1
    const totalHT = subTotalBrut - remise

    // Ventilation TVA par taux
    const tvaMap = new Map<number, number>()
    if (!tvaEnabled) {
      // entreprise sans TVA → toute la ventilation à 0 / non applicable
    } else {
      allLines.forEach((l) => {
        const ht = (l.qty || 0) * (l.priceHT || 0)
        const taux = l.tvaRate || 0
        tvaMap.set(taux, (tvaMap.get(taux) || 0) + ht * (taux / 100))
      })
    }
    const tvaEntries = Array.from(tvaMap.entries()).sort((a, b) => b[0] - a[0])
    const totalTva = tvaEntries.reduce((s, [, v]) => s + v, 0)
    const totalTTC = totalHT + totalTva

    return { subTotalBrut, remise, totalHT, tvaEntries, totalTva, totalTTC }
  }, [lines, materialLines, tvaEnabled])

  /* ──────── Conformité légale (checklist sidebar) ──────── */

  const conformite = useMemo(() => {
    return {
      siret: companySiret.replace(/\s/g, '').length === 14,
      rcs: companyRCS.trim().length > 0,
      assurance: insuranceName.trim().length > 0 && insuranceNumber.trim().length > 0,
      mediateur: mediatorName.trim().length > 0 && mediatorUrl.trim().length > 0,
      client: clientName.trim().length > 0,
      prestations: [...lines, ...materialLines].some((l) => l.description.trim().length > 0 && l.priceHT > 0),
      penalites: true, // mention auto dans bloc légal
      escompte: true,  // mention auto dans bloc légal
    }
  }, [companySiret, companyRCS, insuranceName, insuranceNumber, mediatorName, mediatorUrl, clientName, lines, materialLines])

  /* ──────── Handlers tableau prestations ──────── */

  const addLine = () => {
    const nextId = Math.max(0, ...lines.map((l) => l.id)) + 1
    setLines([...lines, { id: nextId, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 20, totalHT: 0 }])
  }

  const removeLine = (id: number) => {
    if (lines.length === 1) {
      toast.error('Au moins une ligne est requise')
      return
    }
    // Supprimer uniquement la première occurrence par index : si des IDs dupliqués
    // existent (imports multiples, drafts restaurés), on ne supprime qu'une ligne
    setLines(prev => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx < 0) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  const updateLine = (id: number, patch: Partial<ProductLine>) => {
    setLines(lines.map((l) => (l.id === id ? recalcLine({ ...l, ...patch }) : l)))
  }

  /* ──────── Handlers matériaux ──────── */

  const addMaterialLine = () => {
    const nextId = Math.max(0, ...materialLines.map((l) => l.id)) + 1
    setMaterialLines([...materialLines, { id: nextId, description: '', qty: 1, unit: 'u', priceHT: 0, tvaRate: 20, totalHT: 0 }])
  }

  const removeMaterialLine = (id: number) => {
    if (materialLines.length === 1) {
      toast.error('Au moins une ligne est requise')
      return
    }
    // Suppression par index : robuste aux IDs dupliqués (cf. removeLine)
    setMaterialLines(prev => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx < 0) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  const updateMaterialLine = (id: number, patch: Partial<ProductLine>) => {
    setMaterialLines(materialLines.map((l) => (l.id === id ? recalcLine({ ...l, ...patch }) : l)))
  }

  /* ──────── Import devis fournisseur (PDF → lignes matériaux) ──────── */

  const supplierFileRef = useCallback((input: HTMLInputElement | null) => {
    if (input) input.value = ''
  }, [])

  const handleSupplierImport = useCallback(async (file: File) => {
    if (!file) return
    setSupplierScanning(true)

    try {
      // Convert file to base64 image — for PDF we render page 1 via canvas
      let imageBase64: string
      let mimeType = file.type || 'image/jpeg'

      if (file.type === 'application/pdf') {
        // Use pdfjs to render first page as image
        const arrayBuffer = await file.arrayBuffer()
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        imageBase64 = canvas.toDataURL('image/png')
        mimeType = 'image/png'
      } else {
        // Image file — read as data URL
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      const res = await fetch('/api/supplier-invoice-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const { result, error } = await res.json()
      if (error) {
        toast.error(`Analyse échouée : ${error}`)
        return
      }

      if (!result?.lines?.length) {
        toast.error('Aucune ligne de matériau détectée dans ce document')
        return
      }

      // Inject lines into materialLines
      const baseId = Math.max(0, ...materialLines.map(l => l.id)) + 1
      const newLines: ProductLine[] = result.lines.map((sl: { name: string; qty: number; unit: string; unitPriceHT: number; tvaRate: number }, i: number) => ({
        id: baseId + i,
        description: sl.name,
        qty: sl.qty,
        unit: sl.unit,
        priceHT: sl.unitPriceHT,
        tvaRate: sl.tvaRate,
        totalHT: sl.qty * sl.unitPriceHT,
      }))

      // Replace empty first line or append
      const hasOnlyEmptyLine = materialLines.length === 1 && !materialLines[0].description.trim() && materialLines[0].priceHT === 0
      setMaterialLines(hasOnlyEmptyLine ? newLines : [...materialLines, ...newLines])

      const confEmoji = result.confidence === 'haute' ? '🟢' : result.confidence === 'moyenne' ? '🟡' : '🔴'
      toast.success(`${confEmoji} ${result.lines.length} matériaux importés${result.supplier ? ` — ${result.supplier}` : ''}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[DevisBTP] supplier import failed', err)
      toast.error(`Erreur import : ${msg}`)
    } finally {
      setSupplierScanning(false)
    }
  }, [materialLines])

  /* ──────── Handlers acomptes ──────── */

  const addAcompte = () => {
    const nextOrdre = acomptes.length + 1
    setAcomptes([
      ...acomptes,
      {
        id: `a${Date.now()}`,
        ordre: nextOrdre,
        label: `Acompte ${nextOrdre}`,
        pourcentage: 0,
        declencheur: 'À la livraison',
      },
    ])
  }

  const updateAcompte = (id: string, patch: Partial<DevisAcompte>) => {
    setAcomptes(acomptes.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const removeAcompte = (id: string) => {
    setAcomptes(acomptes.filter((a) => a.id !== id))
  }

  const saveEcheancierAsDefault = () => {
    try {
      const toSave = acomptes
        .filter((a) => a.pourcentage > 0)
        .map((a) => ({ label: a.declencheur, pourcentage: a.pourcentage }))
      localStorage.setItem(`fixit_echeancier_default_${artisan?.id || 'default'}`, JSON.stringify(toSave))
      toast.success('Échéancier enregistré comme défaut')
    } catch (err) {
      console.warn('[DevisBTP] écheancier save failed', err)
      toast.error('Impossible d\'enregistrer l\'échéancier')
    }
  }

  const totalAcomptePct = acomptes.reduce((s, a) => s + (a.pourcentage || 0), 0)

  /* ──────── Import client ──────── */

  const openClientPicker = async () => {
    if (!artisan?.id) return
    setShowClientPicker(true)
    setClientDbLoading(true)
    setClientDbSearch('')
    try {
      const res = await fetch(`/api/artisan-clients?artisan_id=${artisan.id}`)
      const data = await res.json()
      const authClients = (data.clients || []).map((c: Record<string, unknown>) => ({ ...c }))
      const manualRaw = localStorage.getItem(`fixit_manual_clients_${artisan.id}`)
      const manualClients = manualRaw ? JSON.parse(manualRaw) : []
      setClientDb([...authClients, ...manualClients])
    } catch {
      setClientDb([])
    }
    setClientDbLoading(false)
  }

  const selectClient = (c: typeof clientDb[0]) => {
    setClientName(c.name || '')
    setClientEmail(c.email || '')
    setClientPhone(c.phone || '')
    setClientSiret(c.siret || '')
    setClientAddress(c.mainAddress || c.address || '')
    // Charger la liste des lieux d'intervention enregistrés pour ce client
    setSelectedClientInterventionAddresses(c.interventionAddresses || [])
    // Réinitialiser les champs lieu d'intervention (l'artisan choisira dans le dropdown)
    setInterventionAddress('')
    setInterventionBatiment('')
    setInterventionEtage('')
    setInterventionEspacesCommuns('')
    setInterventionExterieur('')
    setShowClientPicker(false)
  }

  /* ──────── Import depuis intervention (booking confirmé/terminé) ──────── */

  const importableBookings = useMemo(() => {
    return (bookings || [])
      .filter((b) => ['confirmed', 'completed', 'terminé', 'confirmé'].includes((b.status || '').toLowerCase()))
      .slice(0, 20)
  }, [bookings])

  const importFromBooking = (bookingId: string) => {
    const b = bookings.find((x) => x.id === bookingId)
    if (!b) return
    setClientName(b.client_name || clientName)
    setInterventionAddress(b.address || interventionAddress)
    if (b.services?.name) {
      // Utiliser setState fonctionnel : calcule l'ID sur l'état frais, évite les
      // collisions d'ID entre imports successifs (bug : suppression groupée à la croix)
      setLines(prev => {
        const filtered = prev.filter((l) => l.description.trim().length > 0)
        const nextId = Math.max(0, ...prev.map((l) => Number(l.id) || 0)) + 1
        const newLine: ProductLine = {
          id: nextId,
          description: b.services!.name,
          qty: 1,
          unit: 'f',
          priceHT: b.price_ht || 0,
          tvaRate: 20,
          totalHT: b.price_ht || 0,
        }
        return [...filtered, newLine]
      })
    }
    // Notes complémentaires : laisser vide par défaut, l'artisan les remplit s'il veut
    toast.success('Pré-rempli depuis l\'intervention')
  }

  /* ──────── Sauvegarde ──────── */

  const buildPayload = useCallback(() => {
    return {
      id: initialData?.docNumber === docNumber && (initialData as { id?: string })?.id ? (initialData as { id?: string }).id : Date.now().toString(),
      docType,
      docNumber,
      docTitle,
      docDate,
      docValidity,
      executionDelayDays,
      executionDelayType,
      // Entreprise
      companyStatus: statutJuridique,
      companyName,
      companySiret,
      companyAddress,
      companyRCS,
      companyCapital,
      companyPhone,
      companyEmail,
      tvaEnabled,
      tvaNumber,
      companyAPE,
      // Assurance
      insuranceType,
      insuranceName,
      insuranceNumber,
      insuranceCoverage,
      mediatorName,
      mediatorUrl,
      isHorsEtablissement: clientType === 'particulier',
      // Client
      clientType,
      clientName,
      clientEmail,
      clientPhone,
      clientSiret,
      clientAddress,
      interventionAddress,
      interventionBatiment,
      interventionEtage,
      interventionEspacesCommuns,
      interventionExterieur,
      // Lignes
      lines,
      materialLines,
      // Acomptes
      acomptesEnabled,
      acomptes,
      // Paiement
      paymentMode,
      paymentDelay,
      penaltyRate,
      recoveryFee,
      escompte,
      // Notes
      notes,
    }
  }, [
    initialData, docNumber, docType, docTitle, docDate, docValidity, executionDelayDays, executionDelayType,
    statutJuridique, companyName, companySiret, companyAddress, companyRCS, companyCapital, companyPhone, companyEmail,
    tvaEnabled, tvaNumber, companyAPE,
    insuranceType, insuranceName, insuranceNumber, insuranceCoverage, mediatorName, mediatorUrl,
    clientName, clientEmail, clientPhone, clientSiret, clientAddress,
    interventionAddress, interventionBatiment, interventionEtage, interventionEspacesCommuns, interventionExterieur,
    lines, materialLines, acomptesEnabled, acomptes,
    paymentMode, paymentDelay, penaltyRate, recoveryFee, escompte,
    notes,
  ])

  const saveDraft = () => {
    if (!artisan?.id) {
      toast.error('Compte non identifié')
      return
    }
    setSaving(true)
    try {
      const payload = { ...buildPayload(), status: 'brouillon', savedAt: new Date().toISOString() }
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan.id}`) || '[]')
      const filtered = drafts.filter((d: { docNumber?: string }) => d.docNumber !== payload.docNumber)
      filtered.push(payload)
      localStorage.setItem(`fixit_drafts_${artisan.id}`, JSON.stringify(filtered))
      toast.success('Brouillon enregistré')
      onSave?.(payload as never)
    } catch (err) {
      console.error('[DevisBTP] saveDraft failed', err)
      toast.error('Impossible d\'enregistrer le brouillon')
    } finally {
      setSaving(false)
    }
  }

  const saveAndSend = () => {
    if (!artisan?.id) return
    if (!clientName.trim()) { toast.error('Renseignez le nom du client'); return }
    if (![...lines, ...materialLines].some((l) => l.description.trim().length > 0 && l.priceHT > 0)) {
      toast.error('Ajoutez au moins une prestation ou un matériau chiffré'); return
    }
    setSaving(true)
    try {
      const payload = { ...buildPayload(), status: 'envoye', savedAt: new Date().toISOString(), sentAt: new Date().toISOString() }
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
      const filtered = docs.filter((d: { docNumber?: string }) => d.docNumber !== payload.docNumber)
      filtered.push(payload)
      localStorage.setItem(`fixit_documents_${artisan.id}`, JSON.stringify(filtered))
      // Retire des brouillons s'il y était
      const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan.id}`) || '[]')
      const newDrafts = drafts.filter((d: { docNumber?: string }) => d.docNumber !== payload.docNumber)
      localStorage.setItem(`fixit_drafts_${artisan.id}`, JSON.stringify(newDrafts))
      toast.success('Devis validé')
      onSave?.(payload as never)
      onBack()
    } catch (err) {
      console.error('[DevisBTP] saveAndSend failed', err)
      toast.error('Impossible de valider le devis')
    } finally {
      setSaving(false)
    }
  }

  /* ──────── Génération PDF ──────── */

  /* ──────── Rapports & Photos — chargement ──────── */

  // Derived rapport object for PDF
  const attachedRapport = useMemo(() => {
    if (!attachedRapportId) return null
    const r = availableRapports.find((rap: Record<string, unknown>) => rap.id === attachedRapportId)
    if (!r) return null
    return {
      rapportNumber: (r.rapportNumber as string) || '',
      interventionDate: (r.interventionDate as string) || undefined,
      startTime: (r.startTime as string) || undefined,
      endTime: (r.endTime as string) || undefined,
      motif: (r.motif as string) || undefined,
      siteAddress: (r.siteAddress as string) || undefined,
    }
  }, [attachedRapportId, availableRapports])

  // Derived selected photos for PDF
  const selectedPhotos: PdfV3Photo[] = useMemo(() => {
    return availablePhotos.filter(p => selectedPhotoIds.has(p.id)).map(p => ({
      id: p.id, url: p.url, label: p.label, taken_at: p.taken_at, lat: p.lat, lng: p.lng,
    }))
  }, [availablePhotos, selectedPhotoIds])

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId); else next.add(photoId)
      return next
    })
  }, [])

  // Load rapports from localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const rapports = JSON.parse(localStorage.getItem(`fixit_rapports_${artisan.id}`) || '[]')
      setAvailableRapports(rapports)
    } catch { setAvailableRapports([]) }
  }, [artisan?.id])

  // Load photos from API
  useEffect(() => {
    if (!artisan?.id) return
    const fetchPhotos = async () => {
      setPhotosLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) { setPhotosLoading(false); return }
        const res = await fetch(`/api/artisan-photos?artisan_id=${artisan.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) { const json = await res.json(); setAvailablePhotos(json.data || []) }
      } catch { /* pas de photos = pas grave */ }
      setPhotosLoading(false)
    }
    fetchPhotos()
  }, [artisan?.id])

  /* ──────── Motif/Service selector ──────── */

  const selectMotif = useCallback(async (lineId: number, serviceId: string) => {
    if (serviceId === 'custom' || !serviceId) {
      if (serviceId === 'custom') setLines(prev => prev.map(l => l.id === lineId ? { ...l, description: '' } : l))
      return
    }
    const service = allServices.find(s => s.id === serviceId)
    if (!service) return

    const price = tvaEnabled ? (service.price_ht || 0) : (service.price_ttc || service.price_ht || 0)
    // Parse unit from description metadata [unit:m2]
    const descRaw = service.description || ''
    const unitMatch = descRaw.match(/\[unit:(\w+)\]/)
    let serviceUnit = unitMatch ? unitMatch[1] : 'u'
    if (!unitMatch) {
      const name = service.name.toLowerCase()
      if (name.includes('m²') || name.includes('m2') || name.includes('carrelage') || name.includes('peinture')) serviceUnit = 'm2'
      else if (name.includes('ml') || name.includes('mètre linéaire')) serviceUnit = 'ml'
      else if (name.includes('m³') || name.includes('m3')) serviceUnit = 'm3'
      else if (name.includes('heure') || name.includes('/h')) serviceUnit = 'h'
      else if (name.includes('jour')) serviceUnit = 'j'
      else if (name.includes('forfait')) serviceUnit = 'f'
    }

    // Fetch etapes + description: try API first, then fallback to localStorage BTP prestations
    let copiedEtapes: DevisEtape[] = []
    let prestDescription = ''
    if (serviceId.startsWith('btp_')) {
      // BTP prestation from localStorage — étapes are in the seed data
      try {
        // Try v5 first (with auto-computed étape prices/units), fall back to v4
        const raw = localStorage.getItem(`fixit_prestations_btp_v5_${artisan?.id || 'guest'}`)
          || localStorage.getItem(`fixit_prestations_btp_v4_${artisan?.id || 'guest'}`)
        if (raw) {
          const parsed = JSON.parse(raw) as Array<{ id: number; description?: string; etapes?: Array<string | { label: string; price?: number; unit?: string }> }>
          const numId = parseInt(serviceId.replace('btp_', ''), 10)
          const prest = parsed.find(p => p.id === numId)
          if (prest?.description) prestDescription = prest.description
          if (prest?.etapes?.length) {
            copiedEtapes = prest.etapes.map((et, i) => {
              // Backward compat: old format was string[], new is {label, price?, unit?}[]
              const label = typeof et === 'string' ? et : et.label
              const price = typeof et === 'string' ? undefined : et.price
              const unit = typeof et === 'string' ? undefined : et.unit
              return {
                id: `etape_${Date.now()}_${i}`,
                ordre: i + 1,
                designation: label,
                ...(price != null ? { prixHT: price } : {}),
                ...(unit ? { unit: mapCatalogueUnit(unit) } : {}),
              }
            })
          }
        }
      } catch { /* ignore */ }
    } else {
      try {
        const res = await fetch(`/api/service-etapes?service_id=${serviceId}`)
        const json = await res.json()
        if (json.etapes?.length) {
          copiedEtapes = json.etapes.map((et: { id: string; ordre: number; designation: string }, i: number) => ({
            id: `etape_${Date.now()}_${i}`, ordre: i + 1,
            designation: et.designation, source_etape_id: et.id,
          }))
        }
      } catch { /* pas d'étapes = pas grave */ }
    }

    // Only put the service name in the description field (title).
    // Description goes to lineDetail, étapes as structured data.
    setLines(prev => prev.map(line => {
      if (line.id !== lineId) return line
      return { ...line, description: service.name, lineDetail: prestDescription || line.lineDetail || '',
               unit: serviceUnit, priceHT: price,
               tvaRate: 20, totalHT: 1 * price,
               etapes: copiedEtapes.length > 0 ? copiedEtapes : undefined }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allServices, tvaEnabled])

  const svgToImageDataUrl = useCallback((svgString: string, width: number, height: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width * 2
        canvas.height = height * 2
        const ctx = canvas.getContext('2d')!
        ctx.scale(2, 2)
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')) }
      img.src = url
    })
  }, [])

  const generatePdf = async (action: 'preview' | 'download') => {
    setPdfLoading(true)
    try {
      const delayTypeLabel = executionDelayType === 'ouvres' ? 'ouvrés' : executionDelayType
      const delayStr = executionDelayDays > 0 ? `${executionDelayDays} jours ${delayTypeLabel}` : 'À convenir'
      const validLabor = lines.filter(l => (l.description || '').trim())
      const validMaterials = materialLines.filter(l => (l.description || '').trim())
      const validLines = [...validLabor, ...validMaterials]
      const totalNet = validLines.reduce((s, l) => s + l.totalHT, 0)
      const currencyFormat = (n: number) => {
        const formatted = n.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        // Replace narrow no-break space (\u202F) and no-break space (\u00A0)
        // with regular space — jsPDF's helvetica font renders them as '/'
        return formatted.replace(/[\u202F\u00A0]/g, ' ') + ' €'
      }

      // Map display label → internal code for V3 generator
      const statusCode = mapLegalFormToCode(statutJuridique)

      await generateDevisPdfV3({
        action,
        locale: locale as 'fr' | 'pt' | 'en',
        localeFormats: { currencyFormat, taxLabel: locale === 'pt' ? 'IVA' : 'TVA' },
        t,
        docType, docNumber, docTitle: docTitle || `Devis ${docNumber}`, docDate, docValidity,
        prestationDate: docDate,
        executionDelay: delayStr,
        companyStatus: statusCode,
        companyName, companySiret, companyAddress, companyRCS: companyRCS || '', companyCapital: companyCapital || '',
        companyPhone, companyEmail,
        tvaEnabled, tvaNumber: tvaNumber || '', companyAPE: companyAPE || '',
        insuranceName: insuranceName || '', insuranceNumber: insuranceNumber || '', insuranceCoverage: insuranceCoverage || '', insuranceType,
        mediatorName: mediatorName || '', mediatorUrl: mediatorUrl || '', isHorsEtablissement: clientType === 'particulier',
        clientName: clientName || '', clientEmail: clientEmail || '', clientAddress: clientAddress || '', clientPhone: clientPhone || '', clientSiret: clientSiret || '', clientType,
        interventionAddress: interventionAddress || '', interventionBatiment: interventionBatiment || '', interventionEtage: interventionEtage || '',
        interventionEspacesCommuns: interventionEspacesCommuns || '', interventionExterieur: interventionExterieur || '',
        paymentMode: paymentMode || 'Virement bancaire',
        paymentDue: paymentDelay || '30 jours',
        paymentCondition: escompte || '', discount: '', penaltyRate: penaltyRate || '', recoveryFee: recoveryFee || '', iban: '', bic: '',
        lines: validLines.length > 0 ? validLines : lines,
        laborLines: validLabor,
        materialLines: validMaterials,
        subtotalHT: totalNet,
        totalTTC: tvaEnabled ? totalNet * 1.2 : totalNet,
        acomptesEnabled: acomptesEnabled || false,
        acomptes: acomptes || [],
        notes: notes || '', sourceDevisRef: null,
        signatureData: null, attachedRapport, selectedPhotos,
        artisan: artisan ? {
          id: artisan.id,
          logo_url: ((artisan as Record<string, unknown>).logo_url as string) || undefined,
          company_name: artisan.company_name || undefined,
          rm: companyRCS || undefined,
          rc_pro: insuranceNumber || undefined,
        } : null,
        ptFiscalData: null,
        svgToImageDataUrl,
        fetchFreshLogo: async () => {
          try {
            const { data: freshA } = await supabase.from('profiles_artisan').select('logo_url').eq('id', artisan?.id).single()
            return (freshA?.logo_url as string) || null
          } catch { return null }
        },
      })

      toast.success(action === 'download' ? 'PDF téléchargé' : 'PDF généré')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[DevisBTP] PDF failed', err)
      toast.error(`Erreur PDF : ${msg}`)
    } finally {
      setPdfLoading(false)
    }
  }

  /* ──────── Rentabilité (placeholder) ──────── */
  const [showRentaModal, setShowRentaModal] = useState(false)
  const [showImportList, setShowImportList] = useState(false)

  /* ──────── Effect : pré-remplir docTitle si initialData ──────── */
  useEffect(() => {
    if (initialData?.docTitle) setDocTitle(initialData.docTitle)
  }, [initialData?.docTitle])

  /* ─────────────────────────────────────────────────────────────────
     RENDU
     ───────────────────────────────────────────────────────────────── */

  return (
    <div className="dvbtp-root">
      {/* ============ STYLES `.dv-*` (issus de la maquette HTML) ============ */}
      <style jsx>{`
        .dvbtp-root {
          --primary-yellow: #FFC107;
          --primary-yellow-dark: #FFA000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          font-size: 13px;
          color: #1a1a1a;
          background: #FAFAFA;
          padding: 14px;
          min-height: 100%;
        }

        /* Top bar */
        .devis-top-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px; }
        .devis-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #666; cursor: pointer; font-weight: 500; border: none; background: none; font-family: inherit; padding: 0; }
        .devis-back:hover { color: var(--primary-yellow-dark); }
        .devis-top-title { font-size: 17px; font-weight: 600; color: #1a1a1a; }
        .dv-doc-num { font-size: 11px; color: #999; font-weight: 500; padding: 3px 8px; background: #F5F5F5; border-radius: 3px; font-variant-numeric: tabular-nums; }
        .devis-top-right { display: flex; align-items: center; gap: 8px; }
        .devis-top-btn { padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; color: #555; font-family: inherit; transition: all .15s; }
        .devis-top-btn:hover { background: #F5F5F5; }
        .devis-top-btn.cta { background: #2E7D32; color: #fff; border-color: #2E7D32; }
        .devis-top-btn.cta:hover { background: #256d29; }
        .devis-top-btn:disabled { opacity: .5; cursor: not-allowed; }
        .dv-doc-type-switch { display: inline-flex; background: #F0F0F0; border-radius: 6px; padding: 3px; gap: 2px; }
        .dv-doc-type-switch button { border: none; background: none; padding: 5px 12px; font-size: 11px; font-weight: 600; color: #888; cursor: pointer; border-radius: 4px; font-family: inherit; transition: all .15s; }
        .dv-doc-type-switch button.active { background: #fff; color: var(--primary-yellow-dark); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .dv-doc-type-switch button:not(.active):hover { color: #555; }

        /* Layout */
        .devis-layout { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; align-items: start; }
        @media (max-width: 1100px) { .devis-layout { grid-template-columns: 1fr; } }

        /* Sections */
        .dv-section { background: #fff; border: 1px solid #E8E8E8; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
        .dv-section-t { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1a1a1a; margin-bottom: .85rem; letter-spacing: .2px; }
        .dv-section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .85rem; gap: 1rem; flex-wrap: wrap; }
        .dv-section-head .dv-section-t { margin-bottom: 0; }

        /* Form groups */
        .dv-row { display: grid; grid-template-columns: 1fr 1fr; gap: .85rem; margin-bottom: .85rem; }
        .dv-row.col3 { grid-template-columns: 1fr 1fr 1fr; }
        .dv-row.col1 { grid-template-columns: 1fr; }
        .dv-fg { display: flex; flex-direction: column; gap: 6px; }
        .dv-fg label { font-size: 11px; font-weight: 600; color: #444; }
        .dv-fg label .req { color: #E53935; }
        .dv-fg input, .dv-fg select, .dv-fg textarea {
          width: 100%; padding: 8px 10px; border: 1px solid #E0E0E0; border-radius: 5px;
          font-size: 12px; font-family: inherit; background: #fff; color: #333; transition: border-color .15s;
        }
        .dv-fg input:focus, .dv-fg select:focus, .dv-fg textarea:focus {
          outline: none; border-color: var(--primary-yellow); box-shadow: 0 0 0 2px rgba(255,193,7,.12);
        }
        .dv-fg textarea { min-height: 70px; resize: vertical; }
        .dv-fg input::placeholder, .dv-fg textarea::placeholder { color: #BBB; }

        /* Masquer les flèches spinner des inputs number */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; appearance: textfield; }

        /* Alertes */
        .dv-alert { padding: .7rem 1rem; border-radius: 6px; font-size: 12px; line-height: 1.5; margin-bottom: 1rem; }
        .dv-alert.green  { background: #E8F5E9; color: #2E7D32; border-left: 3px solid #4CAF50; }
        .dv-alert.orange { background: #FFF3E0; color: #E65100; border-left: 3px solid #FF9800; }
        .dv-alert.red    { background: #FFEBEE; color: #C62828; border-left: 3px solid #E53935; }
        .dv-alert.blue   { background: #E3F2FD; color: #1565C0; border-left: 3px solid #2196F3; }
        .dv-alert.yellow { background: #FFF8E1; color: #8B7D00; border-left: 3px solid #FFC107; }
        .dv-alert strong { font-weight: 700; }

        /* Toggle row */
        .dv-toggle-row { display: flex; align-items: center; gap: 10px; padding: .6rem 0; }
        .dv-toggle-label { font-size: 12px; color: #444; font-weight: 600; }
        .dv-toggle-sub { font-size: 11px; color: #999; }
        .tgl { position: relative; display: inline-block; width: 38px; height: 22px; flex-shrink: 0; }
        .tgl input { opacity: 0; width: 0; height: 0; }
        .tgl .sl { position: absolute; cursor: pointer; inset: 0; background: #ccc; transition: .2s; border-radius: 22px; }
        .tgl .sl::before { position: absolute; content: ''; height: 16px; width: 16px; left: 3px; top: 3px; background: white; transition: .2s; border-radius: 50%; }
        .tgl input:checked + .sl { background: var(--primary-yellow); }
        .tgl input:checked + .sl::before { transform: translateX(16px); }

        /* Import card */
        .dv-import-card { background: linear-gradient(180deg, #FFFBEF 0%, #FFF8E1 100%); border: 1px solid #F5C741; border-radius: 8px; padding: 1rem 1.1rem; margin-top: .5rem; }
        .dv-import-trigger { background: #fff; border: 1px solid #E0E0E0; border-radius: 6px; padding: 10px 22px; font-size: 13px; font-weight: 600; color: #7A5C00; cursor: pointer; transition: all .15s; }
        .dv-import-trigger:hover { border-color: #F5A623; background: #FFFBF0; }
        .dv-import-close { background: none; border: none; font-size: 11px; color: #999; cursor: pointer; margin-top: 8px; padding: 4px 0; }
        .dv-import-close:hover { color: #666; }
        .dv-import-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: .3rem; }
        .dv-import-title { font-size: 13px; font-weight: 700; color: #7A5C00; letter-spacing: .2px; }
        .dv-import-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; background: var(--primary-yellow); color: #5A4500; padding: 3px 8px; border-radius: 10px; }
        .dv-import-sub { font-size: 11px; color: #8B7D00; margin-bottom: .75rem; line-height: 1.4; }
        .dv-import-empty { text-align: center; padding: .85rem; background: rgba(255,255,255,.6); border: 1px dashed #E6C04A; border-radius: 6px; color: #8B7D00; font-size: 12px; }
        .dv-import-empty strong { color: #5A4500; display: block; margin-bottom: 2px; }
        .dv-import-empty .hint { display: block; font-size: 11px; color: #A89000; font-style: italic; }
        .dv-import-list { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
        .dv-import-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,.85); border: 1px solid #F5C741; border-radius: 5px; cursor: pointer; transition: background .15s; }
        .dv-import-item:hover { background: #fff; }
        .dv-import-item .nm { font-size: 12px; font-weight: 600; color: #5A4500; }
        .dv-import-item .meta { font-size: 11px; color: #A89000; }

        /* Info strip */
        .dv-info-strip { display: flex; align-items: center; gap: 10px; padding: .7rem .85rem; background: #F5F5F5; border-radius: 6px; border-left: 3px solid #BDBDBD; }
        .dv-info-strip .ico { width: 28px; height: 28px; border-radius: 50%; background: #E8E8E8; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #666; flex-shrink: 0; }
        .dv-info-strip .txt { flex: 1; }
        .dv-info-strip .ttl { font-size: 12px; font-weight: 600; color: #333; }
        .dv-info-strip .sub { font-size: 11px; color: #888; line-height: 1.4; margin-top: 1px; }

        /* Tableau prestations */
        .dv-presta-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: .6rem; table-layout: fixed; }
        .dv-presta-table th { text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; border-bottom: 2px solid #E8E8E8; letter-spacing: .2px; white-space: nowrap; }
        .dv-presta-table td { padding: 6px 8px; border-bottom: 1px solid #F0F0F0; vertical-align: top !important; }
        .dv-presta-table input, .dv-presta-table select { padding: 6px 8px; border: 1px solid #E0E0E0; border-radius: 4px; font-size: 12px; font-family: inherit; width: 100%; }
        .dv-presta-table input:focus, .dv-presta-table select:focus { outline: none; border-color: var(--primary-yellow); }
        .dv-presta-table td.amount { font-weight: 600; text-align: right; color: #1a1a1a; font-variant-numeric: tabular-nums; }
        .dv-presta-table .col-ht { background: #FAFAFA; }
        .dv-presta-del { width: 28px; height: 28px; border-radius: 4px; border: 1px solid #FFCDD2; background: #fff; color: #E53935; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all .15s; }
        .dv-presta-del:hover { background: #FFEBEE; }
        .dv-add-line { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #666; cursor: pointer; padding: 8px 14px; border: 1px dashed #D0D0D0; border-radius: 5px; background: #fff; font-family: inherit; font-weight: 600; letter-spacing: .2px; transition: all .15s; margin-top: 4px; }
        .dv-add-line:hover { color: #F57C00; border-color: #FFC107; background: #FFFBF0; }
        .dv-scanner-btn { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 5px; background: var(--primary-yellow); border: none; color: #333; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .dv-scanner-btn:hover { background: #FFB800; }

        /* Acomptes */
        .dv-acompte-row { display: grid; grid-template-columns: 1fr 64px 110px 28px; align-items: center; gap: 6px; margin-bottom: .5rem; }
        .dv-acompte-row select { min-width: 0; width: 100%; padding: 7px 10px; border: 1px solid #E0E0E0; border-radius: 5px; font-size: 12px; font-family: inherit; }
        .dv-acompte-input-pct { display: flex; align-items: center; border: 1px solid #E0E0E0; border-radius: 5px; background: #fff; width: 64px; }
        .dv-acompte-input-pct input { border: none !important; outline: none; text-align: center; padding: 4px 0 4px 6px; font-size: 12px; font-family: inherit; width: 36px; min-width: 0; background: transparent; -moz-appearance: textfield; }
        .dv-acompte-input-pct input::-webkit-inner-spin-button, .dv-acompte-input-pct input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .dv-acompte-input-pct input:focus { box-shadow: none; }
        .dv-acompte-input-pct span { font-size: 12px; color: #333; padding-right: 6px; }
        .dv-acompte-eq { font-size: 12px; color: #888; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; overflow: hidden; text-overflow: ellipsis; }
        .dv-acompte-del { width: 24px; height: 24px; border-radius: 50%; border: 1px solid #E0E0E0; background: none; cursor: pointer; color: #999; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .dv-acompte-del:hover { border-color: #E53935; color: #E53935; background: #FFEBEE; }
        .dv-echelon-warning { font-size: 12px; font-weight: 600; margin-top: .65rem; padding: .5rem .75rem; border-radius: 5px; }
        .dv-echelon-warning.orange { background: #FFF3E0; color: #E65100; border-left: 3px solid #FF9800; }
        .dv-echelon-warning.green  { background: #E8F5E9; color: #2E7D32; border-left: 3px solid #4CAF50; }
        .dv-echelon-warning .sub { font-size: 11px; font-weight: 400; color: #888; display: block; margin-top: 2px; }

        /* Mentions légales */
        .dv-mentions { font-size: 11px; color: #888; line-height: 1.6; padding: .75rem; background: #FAFAFA; border-radius: 6px; }

        /* Btn link client */
        .btn-link-client { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 5px; background: #fff; border: 1px solid var(--primary-yellow); color: var(--primary-yellow-dark); font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
        .btn-link-client:hover { background: #FFF8E1; }

        /* Sidebar */
        .dv-sidebar { position: sticky; top: 0; }
        .dv-sidebar-card { background: #fff; border: 1px solid #E8E8E8; border-radius: 8px; padding: 1rem; margin-bottom: .85rem; }
        .dv-sidebar-t { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1a1a1a; margin-bottom: .75rem; letter-spacing: .2px; }

        .dv-resume-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 1rem; padding: .35rem 0; font-size: 12px; color: #555; }
        .dv-resume-row > span:last-child { font-variant-numeric: tabular-nums; text-align: right; min-width: 80px; }
        .dv-resume-row.subtotal { border-top: 1px dashed #E0E0E0; padding-top: .5rem; margin-top: .25rem; font-weight: 600; color: #1a1a1a; }
        .dv-resume-row.tva { color: #888; font-size: 11px; padding: .2rem 0; }
        .dv-resume-row.tva-total { font-weight: 600; color: #555; }
        .dv-resume-row.total { background: var(--primary-yellow); color: #333; font-weight: 700; font-size: 13px; padding: .55rem .7rem; border-radius: 5px; margin-top: .5rem; }

        .dv-conf-status { font-size: 12px; color: #888; margin-bottom: .65rem; padding-bottom: .5rem; border-bottom: 1px solid #F0F0F0; }
        .dv-conf-item { display: flex; align-items: center; justify-content: space-between; padding: .3rem .4rem; margin: 0 -.4rem; font-size: 12px; color: #555; cursor: pointer; border-radius: 4px; }
        .dv-conf-item:hover { background: #FAFAFA; }
        .dv-conf-x { color: #E53935; font-weight: 700; font-size: 13px; }
        .dv-conf-check { color: #4CAF50; font-weight: 700; font-size: 13px; }

        .dv-sidebar-btn { width: 100%; padding: 9px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; color: #555; font-family: inherit; transition: all .15s; margin-bottom: .4rem; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .dv-sidebar-btn:hover { background: #FAFAFA; border-color: #CCC; }
        .dv-sidebar-btn.yellow { background: var(--primary-yellow); border-color: var(--primary-yellow); color: #333; }
        .dv-sidebar-btn.yellow:hover { background: #FFB800; }
        .dv-sidebar-btn.green { background: #4CAF50; border-color: #4CAF50; color: #fff; }
        .dv-sidebar-btn.green:hover { background: #43A047; }
        .dv-sidebar-btn.outline-blue { border-color: #1565C0; color: #1565C0; }
        .dv-sidebar-btn.outline-blue:hover { background: #E3F2FD; }
        .dv-sidebar-btn:disabled { opacity: .5; cursor: not-allowed; }

        .dv-apercu { width: 100%; padding: 10px 14px; border: 1px solid #E8E8E8; border-radius: 5px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 600; color: #666; cursor: pointer; background: #FAFAFA; transition: all .15s; }
        .dv-apercu:hover { border-color: var(--primary-yellow); color: #333; background: #FFF8E1; }
        .dv-apercu::before { content: "📄"; font-size: 14px; }

        /* Modal client picker */
        .dvbtp-modal-ov { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .dvbtp-modal { background: #fff; border-radius: 8px; width: 100%; max-width: 520px; max-height: 80vh; overflow-y: auto; padding: 1.5rem; }
        .dvbtp-modal h3 { font-size: 15px; font-weight: 600; margin-bottom: 1rem; }
        .dvbtp-modal .picker-search { width: 100%; padding: 8px 10px; border: 1px solid #E0E0E0; border-radius: 5px; font-size: 12px; margin-bottom: 1rem; }
        .dvbtp-modal .picker-list { max-height: 50vh; overflow-y: auto; }
        .dvbtp-modal .picker-item { padding: 10px 12px; border: 1px solid #F0F0F0; border-radius: 5px; margin-bottom: 6px; cursor: pointer; transition: all .15s; }
        .dvbtp-modal .picker-item:hover { background: #FFF8E1; border-color: var(--primary-yellow); }
        .dvbtp-modal .picker-item .nm { font-size: 13px; font-weight: 600; color: #333; }
        .dvbtp-modal .picker-item .meta { font-size: 11px; color: #888; margin-top: 2px; }
        .dvbtp-modal-foot { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; padding-top: .85rem; border-top: 1px solid #F0F0F0; }
        .dvbtp-modal-btn { padding: 7px 14px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E0E0E0; background: #fff; }
        .dvbtp-modal-btn.primary { background: var(--primary-yellow); border-color: var(--primary-yellow); color: #333; }
      `}</style>

      {/* ========== RETOUR ========== */}
      <button className="devis-back" onClick={onBack} type="button">← Retour</button>

      {/* ========== TOP BAR ========== */}
      {/* Titre + numéro à gauche (empilés) / Switch Devis|Facture proforma à droite */}
      <div className="devis-top-bar" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="devis-top-title">
            {docType === 'devis' ? 'Devis' : 'Facture proforma'}
          </span>
          <span className="dv-doc-num" style={{ alignSelf: 'flex-start' }}>{docNumber}</span>
        </div>
        <div className="devis-top-right">
          <span className="dv-doc-type-switch" role="tablist">
            <button type="button" className={docType === 'devis' ? 'active' : ''} onClick={() => setDocType('devis')}>Devis</button>
            <button type="button" className={docType === 'facture' ? 'active' : ''} onClick={() => setDocType('facture')}>Facture proforma</button>
          </span>
        </div>
      </div>

      {/* ========== LAYOUT 2 COL ========== */}
      <div className="devis-layout">

        {/* ─────────── LEFT : MAIN FORM ─────────── */}
        <div>

          {/* 1. OBJET DU DEVIS */}
          <div className="dv-section">
            <div className="dv-section-t">OBJET DU DEVIS</div>
            <div className="dv-fg" style={{ marginBottom: '.75rem' }}>
              <label>Titre / Objet <span style={{ fontWeight: 400, color: '#999' }}>(ex : Nettoyage parc, Rénovation cuisine…)</span></label>
              <input type="text" placeholder="Ex : Nettoyage parc résidence Les Acacias" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            </div>

            <div className="dv-alert green">
              <strong>CONFORMITÉ LÉGALE FRANÇAISE</strong><br />
              Ce document respecte les obligations légales françaises (Code de commerce, Code de la consommation). Toutes les mentions obligatoires sont incluses.
            </div>

            <div className="dv-import-card">
              <div className="dv-import-head">
                <span className="dv-import-title">Import rapide depuis intervention ⚡</span>
                <span className="dv-import-badge">Gain de temps</span>
              </div>
              <div className="dv-import-sub">Pré-remplit automatiquement vos infos, celles du client et le motif — tout reste modifiable</div>
              <select
                value={selectedBookingId}
                onChange={(e) => { const v = e.target.value; setSelectedBookingId(v); if (v) importFromBooking(v) }}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: `1px solid ${selectedBookingId ? '#4CAF50' : '#E0E0E0'}`, borderRadius: 8,
                  background: selectedBookingId ? '#f0fdf4' : '#fff', fontSize: 12, fontFamily: 'inherit',
                  cursor: 'pointer', outline: 'none', color: '#333',
                }}
              >
                <option value="">Sélectionner une intervention…</option>
                {importableBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.booking_date || ''} – {b.client_name || 'Client'} – {b.services?.name || 'Intervention'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. INFORMATIONS ENTREPRISE */}
          <div className="dv-section">
            <div className="dv-section-t">INFORMATIONS ENTREPRISE (PRESTATAIRE)</div>
            <div className="dv-alert orange">
              <strong>Données non vérifiées</strong> — Les informations entreprise n&apos;ont pas pu être confirmées via le registre officiel. Remplissez manuellement.
            </div>

            <div className="dv-fg" style={{ marginBottom: '.85rem' }}>
              <label>Statut juridique <span className="req">*</span></label>
              <input type="text" value={statutJuridique} disabled style={{ background: '#F5F5F5', color: '#333', cursor: 'not-allowed' }} />
              <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>Défini à l&apos;inscription (Kbis) — non modifiable</div>
            </div>

            <div className="dv-row">
              <div className="dv-fg"><label>Raison sociale <span className="req">*</span></label><input type="text" value={companyName} disabled style={{ background: '#F5F5F5', color: '#333', cursor: 'not-allowed' }} /></div>
              <div className="dv-fg"><label>SIRET <span className="req">*</span></label><input type="text" value={companySiret} disabled style={{ background: '#F5F5F5', color: '#333', cursor: 'not-allowed' }} /></div>
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 10 }}>Raison sociale et SIRET verrouillés — données issues du Kbis</div>
            <div className="dv-row col1">
              <div className="dv-fg"><label>Adresse siège social <span className="req">*</span></label><input type="text" placeholder="Adresse complète" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} /></div>
            </div>
            <div className="dv-row col1">
              <div className="dv-fg"><label>RCS / RM <span className="req">*</span></label><input type="text" placeholder="Ex : RM Marseille 953951589" value={companyRCS} onChange={(e) => setCompanyRCS(e.target.value)} /></div>
            </div>
            <div className="dv-row col1">
              <div className="dv-fg"><label>N° TVA intracommunautaire</label><input type="text" placeholder="FR 00 123456789" value={tvaNumber} onChange={(e) => setTvaNumber(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Téléphone <span className="req">*</span></label><input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} /></div>
              <div className="dv-fg"><label>Email <span className="req">*</span></label><input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Code APE / NAF</label><input type="text" placeholder="Ex : 4339Z" value={companyAPE} onChange={(e) => setCompanyAPE(e.target.value)} /></div>
              <div className="dv-fg">
                <label>Capital social {['SARL','EURL','SAS','SASU','SA'].includes(statutJuridique)
                  ? <span className="req">*</span>
                  : <span style={{ color: '#999', fontWeight: 400 }}>(SARL/SAS/SA)</span>}
                </label>
                <input type="text" placeholder="Ex : 10 000 €" value={companyCapital} onChange={(e) => setCompanyCapital(e.target.value)} />
              </div>
            </div>
          </div>

          {/* 3. ASSURANCE & MÉDIATION */}
          <div className="dv-section">
            <div className="dv-section-t">ASSURANCE &amp; MÉDIATION</div>
            <div className="dv-alert orange" style={{ marginBottom: '1rem' }}>
              <strong>OBLIGATOIRE : Assurance Décennale / RC Pro (Loi Pinel 2014)</strong><br />
              Mention obligatoire sur tous les devis et factures BTP — Absence sanctionnée jusqu&apos;à 75 000 €
            </div>

            <div className="dv-row">
              <div className="dv-fg">
                <label>Type d&apos;assurance <span className="req">*</span></label>
                <select value={insuranceType} onChange={(e) => setInsuranceType(e.target.value as 'rc_pro' | 'decennale' | 'both')}>
                  {TYPES_ASSURANCE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="dv-fg">
                <label>Nom de l&apos;assureur <span className="req">*</span></label>
                <input type="text" placeholder="Ex : MAAF Assurances" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)} />
              </div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>N° de contrat <span className="req">*</span></label><input type="text" placeholder="Ex : RC-2024-123456" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} /></div>
              <div className="dv-fg"><label>Couverture géographique <span className="req">*</span></label><input type="text" placeholder="France métropolitaine" value={insuranceCoverage} onChange={(e) => setInsuranceCoverage(e.target.value)} /></div>
            </div>

            <div className="dv-alert blue" style={{ marginTop: '.5rem' }}>
              <strong>OBLIGATOIRE : Médiateur de la consommation (depuis 01/01/2016)</strong><br />
              Tout professionnel doit communiquer les coordonnées de son médiateur — Absence sanctionnée jusqu&apos;à 15 000 €
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Nom du médiateur</label><input type="text" placeholder="Ex : Médiation de la consommation — CNPM" value={mediatorName} onChange={(e) => setMediatorName(e.target.value)} /></div>
              <div className="dv-fg"><label>Site web du médiateur</label><input type="text" placeholder="Ex : https://www.cnpm-mediation.fr" value={mediatorUrl} onChange={(e) => setMediatorUrl(e.target.value)} /></div>
            </div>
          </div>

          {/* 4. CONFIGURATION TVA — supprimé, champ TVA intra déplacé dans section entreprise */}

          {/* 5. INFORMATIONS CLIENT */}
          <div className="dv-section">
            <div className="dv-section-head">
              <div className="dv-section-t">INFORMATIONS CLIENT</div>
              <button className="btn-link-client" type="button" onClick={openClientPicker}>+ Importer depuis la base client</button>
            </div>
            <div className="dv-row">
              <div className="dv-fg">
                <label>Type de client <span className="req">*</span></label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid #E0E0E0', borderRadius: 5, overflow: 'hidden', background: '#fff' }}>
                  {(['particulier', 'professionnel'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setClientType(t)} style={{
                      flex: 1, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: 'none', fontFamily: 'inherit', letterSpacing: '.2px', transition: 'all .15s',
                      background: clientType === t ? '#1a1a1a' : 'transparent',
                      color: clientType === t ? '#fff' : '#888',
                    }}>{t === 'particulier' ? 'Particulier' : 'Professionnel'}</button>
                  ))}
                </div>
              </div>
              <div className="dv-fg"><label>Nom / Raison sociale <span className="req">*</span></label><input type="text" placeholder={clientType === 'particulier' ? 'Ex : Marie Dubois' : 'Ex : SCI Le Mail, Syndic Foncia'} value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Email</label><input type="email" placeholder="contact@email.fr" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} /></div>
              <div className="dv-fg"><label>Téléphone</label><input type="text" placeholder="06 …" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} /></div>
            </div>
            {clientType === 'professionnel' && (
            <div className="dv-row">
              <div className="dv-fg"><label>SIRET</label><input type="text" placeholder="123 456 789 00012" value={clientSiret} onChange={(e) => setClientSiret(e.target.value)} /></div>
            </div>
            )}
            <div className="dv-row col1">
              <div className="dv-fg"><label>Adresse complète (siège / domicile) <span className="req">*</span></label><input type="text" placeholder="12 rue de la Paix, 75002 Paris" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></div>
            </div>
            <div className="dv-row col1">
              <div className="dv-fg">
                <label>Lieu d&apos;intervention</label>
                {selectedClientInterventionAddresses.length > 0 ? (
                  <>
                    <select
                      value={
                        selectedClientInterventionAddresses.some(a => a.address === interventionAddress)
                          ? interventionAddress
                          : (interventionAddress ? '__custom__' : '')
                      }
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === '__custom__') setInterventionAddress('')
                        else setInterventionAddress(v)
                      }}
                      style={{ marginBottom: 6 }}
                    >
                      <option value="">-- Sélectionner un lieu enregistré --</option>
                      {selectedClientInterventionAddresses.map(addr => (
                        <option key={addr.id} value={addr.address}>
                          {addr.label}{addr.address ? ` — ${addr.address}` : ''}
                        </option>
                      ))}
                      <option value="__custom__">Saisir un autre lieu…</option>
                    </select>
                    {(interventionAddress === '' || !selectedClientInterventionAddresses.some(a => a.address === interventionAddress)) && (
                      <input
                        type="text"
                        placeholder="Ex : Résidence Le Mail, 15 rue des Lilas, 13001 Marseille"
                        value={interventionAddress}
                        onChange={(e) => setInterventionAddress(e.target.value)}
                      />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    placeholder="Ex : Résidence Le Mail, 15 rue des Lilas, 13001 Marseille"
                    value={interventionAddress}
                    onChange={(e) => setInterventionAddress(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Bâtiment</label><input type="text" placeholder="Ex : B" value={interventionBatiment} onChange={(e) => setInterventionBatiment(e.target.value)} /></div>
              <div className="dv-fg"><label>Étage</label><input type="text" placeholder="Ex : 6" value={interventionEtage} onChange={(e) => setInterventionEtage(e.target.value)} /></div>
            </div>
            <div className="dv-row">
              <div className="dv-fg"><label>Espaces communs</label><input type="text" placeholder="Ex : Hall, cage d'escalier" value={interventionEspacesCommuns} onChange={(e) => setInterventionEspacesCommuns(e.target.value)} /></div>
              <div className="dv-fg"><label>Extérieur</label><input type="text" placeholder="Ex : Parking, jardin" value={interventionExterieur} onChange={(e) => setInterventionExterieur(e.target.value)} /></div>
            </div>
          </div>

          {/* 6. INFORMATIONS DOCUMENT */}
          <div className="dv-section">
            <div className="dv-section-t">INFORMATIONS DOCUMENT</div>
            <div className="dv-row">
              <div className="dv-fg"><label>Date d&apos;émission <span className="req">*</span></label><input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></div>
              <div className="dv-fg"><label>Validité (jours) <span className="req">*</span></label><input type="number" value={docValidity} min={1} onChange={(e) => setDocValidity(parseInt(e.target.value) || 30)} /></div>
            </div>
            <div className="dv-fg" style={{ marginBottom: '.85rem' }}>
              <label>Délai d&apos;exécution <span className="req">*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" placeholder="Nb" style={{ width: 80 }} value={executionDelayDays || ''} onChange={(e) => setExecutionDelayDays(parseInt(e.target.value) || 0)} />
                <select style={{ flex: 1 }} value={executionDelayType} onChange={(e) => setExecutionDelayType(e.target.value)}>
                  <option value="ouvres">jours ouvrés</option>
                  <option value="calendaires">jours calendaires</option>
                  <option value="semaines">semaines</option>
                  <option value="mois">mois</option>
                </select>
              </div>
            </div>
            <div className="dv-info-strip">
              <div className="ico">⚖️</div>
              <div className="txt">
                <div className="ttl">Droit de rétractation 14 jours inclus</div>
                <div className="sub">Contrat hors établissement (domicile du client, chantier, démarchage, à distance) — Mention obligatoire art. L. 221-18 C. conso.</div>
              </div>
            </div>
          </div>

          {/* 7. MAIN D'ŒUVRE */}
          <div className="dv-section">
            <div className="dv-section-t">MAIN D&apos;ŒUVRE</div>
            <table className="dv-presta-table">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>DÉSIGNATION</th>
                  <th style={{ textAlign: 'center' }}>QTÉ</th>
                  <th style={{ textAlign: 'center' }}>UNITÉ</th>
                  <th style={{ textAlign: 'center' }}>PRIX HT</th>
                  <th style={{ textAlign: 'center' }}>TVA %</th>
                  <th style={{ textAlign: 'right' }}>TOTAL HT</th>
                  <th style={{ textAlign: 'right' }}>TOTAL TTC</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const lineHT = (l.qty || 0) * (l.priceHT || 0)
                  const lineTTC = lineHT * (1 + (l.tvaRate || 0) / 100)
                  return (
                    <tr key={l.id}>
                      <td>
                        {/* Titre motif */}
                        <div style={{ position: 'relative' }}>
                          <input type="text" placeholder="Saisissez ou sélectionnez une prestation…" value={l.description || ''}
                            onChange={(e) => updateLine(l.id, { description: e.target.value })}
                            style={{ paddingRight: 28 }} />
                          <button type="button" tabIndex={-1}
                            onClick={(e) => { e.stopPropagation(); setOpenPrestaDrop(openPrestaDrop === l.id ? null : l.id) }}
                            style={{ position: 'absolute', right: 1, top: 1, bottom: 1, width: 26, background: 'none', border: 'none', borderLeft: '1px solid #E8E8E8', cursor: 'pointer', color: '#999', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ▾
                          </button>
                          {openPrestaDrop === l.id && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 220, overflowY: 'auto', background: '#fff', border: '1px solid #E8E8E8', borderRadius: 5, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginTop: 2 }}>
                              {allServices.map((s) => (
                                <div key={s.id}
                                  onClick={() => { selectMotif(l.id, s.id); setOpenPrestaDrop(null) }}
                                  onMouseDown={(e) => e.preventDefault()}
                                  style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 11, borderBottom: '1px solid #f5f5f5', transition: 'background .1s' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f5')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                                  {s.name}{s.price_ht ? ` — ${fmt(s.price_ht)}` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Description libre */}
                        {(l.description || '').trim() && (
                          <input type="text" placeholder="Description de la prestation…" value={l.lineDetail || ''}
                            onChange={(e) => updateLine(l.id, { lineDetail: e.target.value })}
                            style={{ width: '100%', marginTop: 4, border: '1px dashed #E0E0E0', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#555', background: '#fafaf8' }} />
                        )}
                        {/* Étapes */}
                        {l.etapes && l.etapes.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Étapes</div>
                            {l.etapes.map((et, ei) => (
                              <div key={et.id} style={{ display: 'flex', alignItems: 'stretch', gap: 7, marginBottom: 6 }}>
                                {/* Rectangle blanc : numéro + désignation (largeur totale, cohérent avec le motif du haut) */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #E0E0E0', borderRadius: 4, padding: '0 11px', minHeight: 34 }}>
                                  <span style={{ color: '#999', fontSize: 12, fontWeight: 600, marginRight: 9, minWidth: 16 }}>{ei + 1}.</span>
                                  <input type="text" value={et.designation}
                                    placeholder="Ex : Diagnostic visuel"
                                    style={{ flex: 1, fontSize: 12.5, color: '#1a1a1a', background: 'transparent', border: 'none', outline: 'none', padding: '9px 0', width: '100%', fontFamily: 'inherit' }}
                                    onChange={(e) => {
                                      const newEtapes = [...(l.etapes || [])]
                                      newEtapes[ei] = { ...newEtapes[ei], designation: e.target.value }
                                      updateLine(l.id, { etapes: newEtapes })
                                    }} />
                                </div>
                                <button type="button" aria-label="Supprimer étape"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#c00', padding: '0 4px' }}
                                  onClick={() => updateLine(l.id, { etapes: (l.etapes || []).filter((_, j) => j !== ei) })}>✕</button>
                              </div>
                            ))}
                            <button type="button"
                              style={{ fontSize: 11, color: '#666', cursor: 'pointer', marginTop: 2, background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
                              onClick={() => updateLine(l.id, { etapes: [...(l.etapes || []), { id: `etape_${Date.now()}`, ordre: (l.etapes?.length || 0) + 1, designation: '' }] })}>
                              + étape
                            </button>
                          </div>
                        )}
                      </td>
                      <td><input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" value={l.qty || ''} onChange={(e) => updateLine(l.id, { qty: e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0 })} /></td>
                      <td>
                        <select value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value })}>
                          {UNITES_TABLEAU.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </td>
                      <td><input type="number" min={0} step={0.01} placeholder="0" value={l.priceHT || ''} onChange={(e) => updateLine(l.id, { priceHT: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })} /></td>
                      <td>
                        <select value={l.tvaRate} onChange={(e) => updateLine(l.id, { tvaRate: parseFloat(e.target.value) })} disabled={!tvaEnabled}>
                          {TVA_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}><input type="number" min={0} step={0.01} value={lineHT ? lineHT.toFixed(2) : ''} placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          const q = l.qty || 1
                          updateLine(l.id, { priceHT: v / q })
                        }}
                        style={{ textAlign: 'right', maxWidth: 108, marginLeft: 'auto', display: 'block' }} /></td>
                      <td style={{ textAlign: 'right' }}><input type="number" min={0} step={0.01} value={lineTTC ? lineTTC.toFixed(2) : ''} placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          const ht = v / (1 + (l.tvaRate || 0) / 100)
                          const q = l.qty || 1
                          updateLine(l.id, { priceHT: ht / q })
                        }}
                        style={{ textAlign: 'right', maxWidth: 108, marginLeft: 'auto', display: 'block' }} /></td>
                      <td><button className="dv-presta-del" type="button" aria-label="Supprimer la ligne" onClick={() => removeLine(l.id)}>✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem' }}>
              <button className="dv-add-line" type="button" onClick={addLine}>+ Ajouter une ligne</button>
            </div>
          </div>

          {/* 7b. MATÉRIAUX */}
          <div className="dv-section">
            <div className="dv-section-t">MATÉRIAUX</div>
            <table className="dv-presta-table">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>DÉSIGNATION</th>
                  <th style={{ textAlign: 'center' }}>QTÉ</th>
                  <th style={{ textAlign: 'center' }}>UNITÉ</th>
                  <th style={{ textAlign: 'center' }}>PRIX HT</th>
                  <th style={{ textAlign: 'center' }}>TVA %</th>
                  <th style={{ textAlign: 'right' }}>TOTAL HT</th>
                  <th style={{ textAlign: 'right' }}>TOTAL TTC</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {materialLines.map((l) => {
                  const lineHT = (l.qty || 0) * (l.priceHT || 0)
                  const lineTTC = lineHT * (1 + (l.tvaRate || 0) / 100)
                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ position: 'relative' }}>
                          <input type="text" placeholder="Saisissez ou sélectionnez un matériau…" value={l.description || ''}
                            onChange={(e) => updateMaterialLine(l.id, { description: e.target.value })}
                            style={{ paddingRight: 28 }} />
                          <button type="button" tabIndex={-1}
                            onClick={(e) => { e.stopPropagation(); setOpenPrestaDrop(openPrestaDrop === -l.id ? null : -l.id) }}
                            style={{ position: 'absolute', right: 1, top: 1, bottom: 1, width: 26, background: 'none', border: 'none', borderLeft: '1px solid #E8E8E8', cursor: 'pointer', color: '#999', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ▾
                          </button>
                          {openPrestaDrop === -l.id && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 220, overflowY: 'auto', background: '#fff', border: '1px solid #E8E8E8', borderRadius: 5, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginTop: 2 }}>
                              {allMaterials.length > 0 ? allMaterials.map((s) => (
                                <div key={s.id}
                                  onClick={() => { updateMaterialLine(l.id, { description: s.name, priceHT: s.price_ht || 0 }); setOpenPrestaDrop(null) }}
                                  onMouseDown={(e) => e.preventDefault()}
                                  style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 11, borderBottom: '1px solid #f5f5f5', transition: 'background .1s' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f5')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                                  {s.name}{s.price_ht ? ` — ${fmt(s.price_ht)}` : ''}
                                </div>
                              )) : (
                                <div style={{ padding: '10px', fontSize: 11, color: '#999', textAlign: 'center' }}>Aucun matériau dans le catalogue</div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td><input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" value={l.qty || ''} onChange={(e) => updateMaterialLine(l.id, { qty: e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0 })} /></td>
                      <td>
                        <select value={l.unit} onChange={(e) => updateMaterialLine(l.id, { unit: e.target.value })}>
                          {UNITES_TABLEAU.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </td>
                      <td><input type="number" min={0} step={0.01} placeholder="0" value={l.priceHT || ''} onChange={(e) => updateMaterialLine(l.id, { priceHT: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })} /></td>
                      <td>
                        <select value={l.tvaRate} onChange={(e) => updateMaterialLine(l.id, { tvaRate: parseFloat(e.target.value) })} disabled={!tvaEnabled}>
                          {TVA_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}><input type="number" min={0} step={0.01} value={lineHT ? lineHT.toFixed(2) : ''} placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          const q = l.qty || 1
                          updateMaterialLine(l.id, { priceHT: v / q })
                        }}
                        style={{ textAlign: 'right', maxWidth: 108, marginLeft: 'auto', display: 'block' }} /></td>
                      <td style={{ textAlign: 'right' }}><input type="number" min={0} step={0.01} value={lineTTC ? lineTTC.toFixed(2) : ''} placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                          const ht = v / (1 + (l.tvaRate || 0) / 100)
                          const q = l.qty || 1
                          updateMaterialLine(l.id, { priceHT: ht / q })
                        }}
                        style={{ textAlign: 'right', maxWidth: 108, marginLeft: 'auto', display: 'block' }} /></td>
                      <td><button className="dv-presta-del" type="button" aria-label="Supprimer la ligne" onClick={() => removeMaterialLine(l.id)}>✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem' }}>
              <button className="dv-add-line" type="button" onClick={addMaterialLine}>+ Ajouter un matériau</button>
              <label className="dv-scanner-btn" style={{ cursor: supplierScanning ? 'wait' : 'pointer', opacity: supplierScanning ? 0.6 : 1 }}>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  ref={supplierFileRef}
                  disabled={supplierScanning}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleSupplierImport(f)
                    e.target.value = ''
                  }}
                />
                {supplierScanning ? '⏳ Analyse en cours…' : '📄 Importer devis fournisseur'}
              </label>
            </div>
          </div>

          {/* 8. ACOMPTES & PAIEMENT ÉCHELONNÉ */}
          <div className="dv-section">
            <div className="dv-section-head">
              <div className="dv-section-t">ACOMPTES &amp; PAIEMENT ÉCHELONNÉ</div>
              <label className="tgl"><input type="checkbox" checked={acomptesEnabled} onChange={(e) => setAcomptesEnabled(e.target.checked)} /><span className="sl"></span></label>
            </div>
            {acomptesEnabled && (
              <>
                {acomptes.map((a) => {
                  const eq = totaux.totalTTC * (a.pourcentage / 100)
                  return (
                    <div key={a.id} className="dv-acompte-row">
                      <select value={a.declencheur} onChange={(e) => updateAcompte(a.id, { declencheur: e.target.value })}>
                        {DECLENCHEURS_ACOMPTE.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <div className="dv-acompte-input-pct">
                        <input type="number" min={0} max={100} value={a.pourcentage} onChange={(e) => updateAcompte(a.id, { pourcentage: parseFloat(e.target.value) || 0 })} />
                        <span>%</span>
                      </div>
                      <span className="dv-acompte-eq">= {fmt(eq)}</span>
                      <button className="dv-acompte-del" type="button" onClick={() => removeAcompte(a.id)}>✕</button>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: '.5rem' }}>
                  <button className="devis-top-btn" type="button" style={{ fontSize: 11 }} onClick={addAcompte}>+ Ajouter un acompte</button>
                  <button className="devis-top-btn" type="button" style={{ fontSize: 11 }} onClick={saveEcheancierAsDefault}>Enregistrer comme défaut</button>
                </div>
                <div className={`dv-echelon-warning ${totalAcomptePct === 100 ? 'green' : 'orange'}`}>
                  Total échelonné : {totalAcomptePct.toFixed(0)}% {totalAcomptePct === 100 ? '✓' : '⚠️'}
                  <span className="sub">
                    {totalAcomptePct === 100
                      ? 'Le règlement est intégralement réparti.'
                      : `Les ${(100 - totalAcomptePct).toFixed(0)}% restants seront réglés séparément.`
                    }
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 9. MODALITÉS DE PAIEMENT */}
          <div className="dv-section">
            <div className="dv-section-t">MODALITÉS DE PAIEMENT</div>
            <div className="dv-row">
              <div className="dv-fg">
                <label>Mode de paiement accepté <span className="req">*</span></label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="dv-fg">
                <label>Délai de paiement <span className="req">*</span></label>
                <select value={paymentDelay} onChange={(e) => setPaymentDelay(e.target.value)}>
                  {DELAIS_PAIEMENT.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="dv-row">
              <div className="dv-fg">
                <label>Taux des pénalités de retard <span className="req">*</span> <span style={{ color: '#999', fontWeight: 400 }}>(art. L. 441-10)</span></label>
                <input type="text" value={penaltyRate} onChange={(e) => setPenaltyRate(e.target.value)} />
              </div>
              <div className="dv-fg">
                <label>Indemnité forfaitaire frais de recouvrement <span className="req">*</span></label>
                <input type="text" value={recoveryFee} onChange={(e) => setRecoveryFee(e.target.value)} />
              </div>
            </div>
            <div className="dv-fg" style={{ marginBottom: '.85rem' }}>
              <label>Escompte pour paiement anticipé <span className="req">*</span> <span style={{ color: '#999', fontWeight: 400 }}>(art. L. 441-9 — obligatoire même si nul)</span></label>
              <select value={escompte} onChange={(e) => setEscompte(e.target.value)}>
                {ESCOMPTES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="dv-info-strip">
              <div className="ico">ℹ️</div>
              <div className="txt">
                <div className="ttl">RIB &amp; coordonnées bancaires</div>
                <div className="sub">Le RIB sera ajouté automatiquement au pied du PDF (depuis vos paramètres entreprise).</div>
              </div>
            </div>
          </div>

          {/* 10. GARANTIES LÉGALES */}
          <div className="dv-section">
            <div className="dv-section-t">GARANTIES LÉGALES (CLIENT PARTICULIER)</div>
            <div className="dv-info-strip">
              <div className="ico">🛡️</div>
              <div className="txt">
                <div className="ttl">Garanties légales applicables (mention automatique sur le PDF)</div>
                <div className="sub">Garantie de parfait achèvement (1 an, art. 1792-6 C. civ.) · Garantie biennale de bon fonctionnement (2 ans, art. 1792-3) · Garantie décennale (10 ans, art. 1792) · Garantie légale de conformité (art. L. 217-3 C. conso.) · Garantie des vices cachés (art. 1641 C. civ.).</div>
              </div>
            </div>
          </div>

          {/* 11. NOTES COMPLÉMENTAIRES */}
          <div className="dv-section">
            <div className="dv-section-t">NOTES COMPLÉMENTAIRES</div>
            <div className="dv-fg">
              <textarea placeholder="Notes optionnelles visibles par le client (conditions particulières, précisions techniques, etc.)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* 12. RAPPORT D'INTERVENTION */}
          <div className="dv-section">
            <div className="dv-section-t">JOINDRE UN RAPPORT D&apos;INTERVENTION</div>
            {availableRapports.length > 0 ? (
              <>
                <select value={attachedRapportId || ''} onChange={(e) => setAttachedRapportId(e.target.value || null)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e0dc', borderRadius: 5, fontSize: 12, marginBottom: 8 }}>
                  <option value="">— Aucun rapport joint —</option>
                  {availableRapports.map((r: Record<string, unknown>) => (
                    <option key={r.id as string} value={r.id as string}>
                      {r.rapportNumber as string} — {r.interventionDate as string || 'N/D'} — {(r.motif as string || '').substring(0, 50)}
                    </option>
                  ))}
                </select>
                {attachedRapportId && (() => {
                  const r = availableRapports.find((rap: Record<string, unknown>) => rap.id === attachedRapportId)
                  if (!r) return null
                  const statusMap: Record<string, { label: string; color: string }> = {
                    termine: { label: '✅ Terminé', color: '#dcfce7' },
                    en_cours: { label: '🔄 En cours', color: '#e5e7eb' },
                    a_reprendre: { label: '⚠️ À reprendre', color: '#fef3c7' },
                  }
                  const st = statusMap[(r.status as string) || ''] || { label: r.status as string, color: '#e5e7eb' }
                  return (
                    <div style={{ background: '#f7f7f5', border: '1px solid #e0e0dc', borderRadius: 6, padding: '10px 12px', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <strong>{r.rapportNumber as string}</strong>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: st.color }}>{st.label}</span>
                      </div>
                      {r.motif ? <div style={{ color: '#444', marginBottom: 3 }}>Motif : {String(r.motif)}</div> : null}
                      {r.interventionDate ? <div style={{ color: '#666' }}>Date : {String(r.interventionDate)} {r.startTime ? `de ${String(r.startTime)}` : ''} {r.endTime ? `à ${String(r.endTime)}` : ''}</div> : null}
                      {r.siteAddress ? <div style={{ color: '#666' }}>Adresse : {String(r.siteAddress)}</div> : null}
                      {r.travaux ? <div style={{ color: '#666', marginTop: 3 }}>{(Array.isArray(r.travaux) ? r.travaux : []).length} travaux réalisés</div> : null}
                      <button type="button" onClick={() => setAttachedRapportId(null)}
                        style={{ marginTop: 6, fontSize: 11, color: '#c00', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
                        Retirer le rapport
                      </button>
                    </div>
                  )
                })()}
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>Aucun rapport disponible. Créez d&apos;abord un rapport dans l&apos;onglet Rapports.</div>
            )}
          </div>

          {/* 13. PHOTOS CHANTIER */}
          <div className="dv-section">
            <div className="dv-section-t">JOINDRE DES PHOTOS CHANTIER</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: '.4rem' }}>
              Photos géolocalisées et horodatées prises depuis l&apos;application mobile. Elles seront ajoutées en annexe du document PDF.
            </div>
            {photosLoading ? (
              <div style={{ fontSize: 12, color: '#999' }}>Chargement des photos…</div>
            ) : availablePhotos.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {selectedPhotoIds.size > 0 && (
                    <button type="button" onClick={() => setSelectedPhotoIds(new Set())}
                      style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #e0e0dc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>
                      Tout désélectionner ({selectedPhotoIds.size})
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedPhotoIds(new Set(availablePhotos.map(p => p.id)))}
                    style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #e0e0dc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>
                    Tout sélectionner
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                  {availablePhotos.map((photo) => {
                    const isSelected = selectedPhotoIds.has(photo.id)
                    return (
                      <div key={photo.id} onClick={() => togglePhotoSelection(photo.id)}
                        style={{ position: 'relative', cursor: 'pointer', borderRadius: 6, overflow: 'hidden',
                          border: isSelected ? '2px solid #FFC107' : '2px solid transparent', opacity: isSelected ? 1 : 0.7,
                          transition: 'all .15s' }}>
                        <NextImage src={photo.url} alt={photo.label || 'Photo chantier'} width={200} height={80}
                          style={{ width: '100%', height: 80, objectFit: 'cover' }} unoptimized />
                        {isSelected && (
                          <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                            background: '#FFC107', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff' }}>✓</div>
                        )}
                        {photo.taken_at && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.5)',
                            color: '#fff', fontSize: 9, padding: '2px 4px', textAlign: 'center' }}>
                            {new Date(photo.taken_at).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {selectedPhotoIds.size > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, padding: '4px 10px', background: '#FFF8E1', borderRadius: 4, display: 'inline-block', color: '#92400E' }}>
                    📷 {selectedPhotoIds.size} photo{selectedPhotoIds.size > 1 ? 's' : ''} sélectionnée{selectedPhotoIds.size > 1 ? 's' : ''} — sera{selectedPhotoIds.size > 1 ? 'ont' : ''} ajoutée{selectedPhotoIds.size > 1 ? 's' : ''} en annexe PDF
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
                Aucune photo disponible. Prenez des photos depuis l&apos;application mobile (onglet Documents → Photos Chantier).
              </div>
            )}
          </div>

          {/* 14. MENTIONS LÉGALES */}
          <div className="dv-section">
            <div className="dv-section-t">{locale === 'pt' ? 'MENÇÕES LEGAIS AUTOMÁTICAS' : 'MENTIONS LÉGALES AUTOMATIQUES'}</div>
            <div className="dv-mentions">

              {/* ═══ 1. IDENTIFICATION — statut juridique ═══ */}
              {locale === 'pt' ? (
                <>Empresário em Nome Individual (ENI) — Código Comercial Português.<br /></>
              ) : (
                <>
                  {statutJuridique === 'Entreprise Individuelle (EI)' && (
                    <>Entrepreneur individuel (EI) — Loi n°2022-172 du 14 février 2022 relative au statut de l&apos;entrepreneur individuel.<br /></>
                  )}
                  {statutJuridique === 'Auto-entrepreneur' && (
                    <>Micro-entrepreneur — Dispensé d&apos;immatriculation au RCS/RM (art. L. 123-1-1 C. com.). TVA non applicable, article 293 B du CGI.<br /></>
                  )}
                  {(statutJuridique === 'SARL' || statutJuridique === 'EURL') && (
                    <>{statutJuridique} au capital de {companyCapital || '[capital à renseigner]'} € — Immatriculée au RCS de {companyRCS || '[RCS à renseigner]'}. Siège social : {companyAddress || '[adresse à renseigner]'}.<br /></>
                  )}
                  {(statutJuridique === 'SAS' || statutJuridique === 'SASU') && (
                    <>{statutJuridique} au capital de {companyCapital || '[capital à renseigner]'} € — Immatriculée au RCS de {companyRCS || '[RCS à renseigner]'}. Siège social : {companyAddress || '[adresse à renseigner]'}.<br /></>
                  )}
                  {statutJuridique === 'SA' && (
                    <>SA au capital de {companyCapital || '[capital à renseigner]'} € — Immatriculée au RCS de {companyRCS || '[RCS à renseigner]'}. Siège social : {companyAddress || '[adresse à renseigner]'}.<br /></>
                  )}
                </>
              )}

              {/* ═══ 2. TVA / IVA ═══ */}
              {!tvaEnabled && locale !== 'pt' && (
                <>TVA non applicable, article 293 B du CGI (franchise en base de TVA).<br /></>
              )}
              {!tvaEnabled && locale === 'pt' && (
                <>IVA não aplicável, artigo 53.º do CIVA (regime de isenção).<br /></>
              )}
              {tvaEnabled && tvaNumber && (
                <>{locale === 'pt' ? 'NIF intracomunitário' : 'N° TVA intracommunautaire'} : {tvaNumber}.<br /></>
              )}

              {/* TVA taux réduit — remplace le CERFA supprimé en fév. 2025 (loi de finances 2025, art. 41) */}
              {tvaEnabled && locale !== 'pt' && totaux.tvaEntries.some(([taux]) => taux === 5.5) && (
                <>Travaux de rénovation énergétique sur un logement achevé depuis plus de 2 ans, éligibles au taux réduit de 5,5 % (art. 278-0 bis A du CGI). Attestation remplacée par la présente mention (loi de finances 2025, art. 41).<br /></>
              )}
              {tvaEnabled && locale !== 'pt' && totaux.tvaEntries.some(([taux]) => taux === 10) && (
                <>Travaux d&apos;amélioration, transformation, aménagement ou entretien sur un logement achevé depuis plus de 2 ans, éligibles au taux réduit de 10 % (art. 279-0 bis du CGI). Attestation remplacée par la présente mention (loi de finances 2025, art. 41).<br /></>
              )}

              {/* ═══ 3. ASSURANCE — obligatoire BTP ═══ */}
              {insuranceName && insuranceNumber && (
                <>
                  {locale === 'pt' ? 'Seguro' : 'Assurance'}{' '}
                  {insuranceType === 'rc_pro' ? 'RC Pro' : insuranceType === 'decennale' ? (locale === 'pt' ? 'Decenal' : 'Décennale') : (locale === 'pt' ? 'RC Pro + Decenal' : 'RC Pro + Décennale')}{' '}
                  : {insuranceName}, {locale === 'pt' ? 'apólice' : 'contrat'} n° {insuranceNumber}, {locale === 'pt' ? 'cobertura' : 'couverture'} {insuranceCoverage || (locale === 'pt' ? 'Portugal continental' : 'France métropolitaine')}.<br />
                </>
              )}

              {/* ═══ 4. MENTIONS DEVIS ═══ */}
              {docType === 'devis' && (
                <>
                  {locale === 'pt' ? (
                    <>
                      Orçamento gratuito, conforme o artigo 8.º da Lei n.º 24/96 (Defesa do Consumidor).<br />
                      Este orçamento é válido por {docValidity} dias a partir da data de emissão.<br />
                      {executionDelayDays > 0 && (
                        <>Prazo de execução estimado : {executionDelayDays} dias {executionDelayType === 'ouvres' ? 'úteis' : executionDelayType === 'calendaires' ? 'corridos' : executionDelayType}.<br /></>
                      )}
                      Orçamento recebido antes da execução dos trabalhos.<br /><br />
                    </>
                  ) : (
                    <>
                      Devis gratuit — Conformément à l&apos;article L. 111-1 du Code de la consommation.<br />
                      Ce devis est valable {docValidity} jours à compter de sa date d&apos;émission.<br />
                      {executionDelayDays > 0 && (
                        <>Délai d&apos;exécution estimé : {executionDelayDays} jours {executionDelayType}.<br /></>
                      )}
                      Devis reçu avant l&apos;exécution des travaux — Arrêté du 24 janvier 2017 relatif à la publicité des prix des prestations de dépannage, réparation et entretien.<br /><br />
                    </>
                  )}
                </>
              )}

              {/* ═══ 5. MENTIONS FACTURE ═══ */}
              {docType === 'facture' && (
                <>
                  {locale === 'pt' ? (
                    <>
                      Condições de pagamento : {paymentDelay}.<br />
                      Penalidades por atraso : taxa de juro legal em vigor (Decreto-Lei n.º 62/2013).<br />
                      Indemnização de cobrança : 40 € (apenas B2B, Decreto-Lei n.º 62/2013).<br />
                      {escompte && <>{escompte}.<br /></>}
                    </>
                  ) : (
                    <>
                      Conditions de paiement : {paymentDelay}. Mode de règlement : {paymentMode}.<br />
                      Pénalités de retard : {penaltyRate} (art. L. 441-10 C. com.).<br />
                      Indemnité forfaitaire de recouvrement : {recoveryFee} (art. D. 441-5 C. com.).<br />
                      {escompte && <>{escompte}.<br /></>}
                    </>
                  )}
                </>
              )}

              {/* ═══ 6. ACCEPTATION ═══ */}
              {docType === 'devis' && (
                <>
                  {locale === 'pt' ? (
                    <>ACEITAÇÃO : O PDF gerado inclui zona de assinatura do cliente e do prestador. Assinatura eletrónica conforme eIDAS igualmente proposta no envio.<br /><br /></>
                  ) : (
                    <>ACCEPTATION : Le PDF généré inclut une zone signature client + prestataire. La mention manuscrite « Bon pour accord » est recommandée mais non obligatoire (Cass. 1re civ., 30 oct. 2008). Signature électronique conforme eIDAS également proposée à l&apos;envoi.<br /><br /></>
                  )}
                </>
              )}

              {/* ═══ 7. DROIT DE RÉTRACTATION — FR uniquement, client particulier, contrat hors établissement ═══ */}
              {/* Au Portugal, le droit de rétractation NE S'APPLIQUE PAS à la construction (DL 24/2014, art. 4.º, n.º 1, al. f) */}
              {docType === 'devis' && locale !== 'pt' && clientSiret.trim().length === 0 && (
                <>
                  DROIT DE RÉTRACTATION (contrat hors établissement) : Conformément à l&apos;article L. 221-18 du Code de la consommation, le client consommateur dispose d&apos;un délai de 14 jours calendaires à compter de la signature pour exercer son droit de rétractation, sans motif ni pénalité. Un formulaire-type de rétractation est joint au PDF (annexe art. R. 221-1 C. conso.).<br /><br />
                  Aucun paiement ne peut être exigé avant l&apos;expiration d&apos;un délai de 7 jours à compter de la signature (art. L. 221-10 C. conso.), sauf travaux d&apos;entretien ou réparation demandés en urgence (plafond 200 € TTC pour pièces et fournitures).<br /><br />
                </>
              )}

              {/* ═══ 8. GARANTIES LÉGALES BTP ═══ */}
              {locale === 'pt' ? (
                <>GARANTIAS LEGAIS : garantia de defeitos de construção (5 anos, art. 1225.º do Código Civil Português). Garantia legal de conformidade (Lei n.º 24/96). Garantia de vícios ocultos (art. 913.º do Código Civil).<br /><br /></>
              ) : (
                <>GARANTIES LÉGALES : parfait achèvement (1 an), bon fonctionnement (2 ans), décennale (10 ans) — articles 1792 et suivants du Code civil. Garantie légale de conformité (art. L. 217-3 C. conso.) et garantie des vices cachés (art. 1641 C. civ.).<br /><br /></>
              )}

              {/* ═══ 9. GESTION DES DÉCHETS — obligatoire BTP France depuis 01/07/2021 (loi AGEC) ═══ */}
              {locale !== 'pt' && docType === 'devis' && (
                <>
                  DÉCHETS DE CHANTIER (Décret n°2020-1817 du 29/12/2020, loi AGEC) : une estimation des quantités de déchets générés, les modalités de tri sur chantier, les points de collecte identifiés et les coûts associés à leur gestion sont détaillés dans le descriptif des prestations ou en annexe.<br /><br />
                </>
              )}

              {/* ═══ 10. MÉDIATION / ENTIDADE RAL ═══ */}
              {clientSiret.trim().length === 0 && (
                <>
                  {locale === 'pt' ? (
                    <>
                      Resolução alternativa de litígios (Lei n.º 144/2015) : em caso de litígio, o cliente pode recorrer gratuitamente a uma entidade de resolução alternativa de litígios.
                      {mediatorName && <> Entidade RAL : {mediatorName}{mediatorUrl ? ` — ${mediatorUrl}` : ''}.</>}
                    </>
                  ) : (
                    <>
                      Médiation de la consommation (art. L. 612-1 C. conso.) : en cas de litige, le client peut recourir gratuitement à un médiateur de la consommation.
                      {mediatorName && <> Médiateur désigné : {mediatorName}{mediatorUrl ? ` — ${mediatorUrl}` : ''}.</>}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

        {/* ─────────── RIGHT : SIDEBAR ─────────── */}
        <div className="dv-sidebar">

          {/* RÉSUMÉ */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">RÉSUMÉ</div>
            <div className="dv-resume-row"><span>Sous-total brut</span><span>{fmt(totaux.subTotalBrut)}</span></div>
            <div className="dv-resume-row"><span>Remise</span><span>− {fmt(totaux.remise)}</span></div>
            <div className="dv-resume-row subtotal"><span>Total HT</span><span>{fmt(totaux.totalHT)}</span></div>
            {tvaEnabled ? (
              totaux.tvaEntries.length === 0 ? (
                <div className="dv-resume-row tva"><span>TVA 20 %</span><span>{fmt(0)}</span></div>
              ) : (
                <>
                  {totaux.tvaEntries.map(([taux, montant]) => (
                    <div key={taux} className="dv-resume-row tva">
                      <span>TVA {taux} %</span>
                      <span>{fmt(montant)}</span>
                    </div>
                  ))}
                  {totaux.tvaEntries.length > 1 && (
                    <div className="dv-resume-row tva-total"><span>Total TVA</span><span>{fmt(totaux.totalTva)}</span></div>
                  )}
                </>
              )
            ) : null}
            <div className="dv-resume-row total"><span>TOTAL TTC</span><span>{fmt(totaux.totalTTC)}</span></div>
          </div>

          {/* CONFORMITÉ LÉGALE */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">CONFORMITÉ LÉGALE</div>
            <div className="dv-conf-status">Statut : <strong>{statutJuridique}</strong></div>
            {([
              ['SIRET', conformite.siret],
              ['RCS / RM', conformite.rcs],
              ['Assurance RC Pro', conformite.assurance],
              ['Médiateur conso.', conformite.mediateur],
              ['Client renseigné', conformite.client],
              ['Prestations détaillées', conformite.prestations],
              ['Pénalités de retard', conformite.penalites],
              ['Escompte (mention)', conformite.escompte],
            ] as [string, boolean][]).map(([label, ok]) => (
              <div key={label} className="dv-conf-item">
                <span>{label}</span>
                <span className={ok ? 'dv-conf-check' : 'dv-conf-x'}>{ok ? '✓' : '✕'}</span>
              </div>
            ))}
          </div>

          {/* RENTABILITÉ */}
          <div className="dv-sidebar-card">
            <button className="dv-sidebar-btn outline-blue" type="button" onClick={() => setShowRentaModal(true)}>📊 Rentabilité du devis</button>
          </div>

          {/* APERÇU */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">APERÇU</div>
            <div className="dv-apercu" onClick={() => generatePdf('preview')}>
              {pdfLoading ? 'Génération…' : 'Cliquez pour prévisualiser le PDF'}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="dv-sidebar-card">
            <div className="dv-sidebar-t">ACTIONS</div>
            <button className="dv-sidebar-btn" type="button" disabled={saving} onClick={saveDraft}>
              {saving ? 'Enregistrement…' : 'Enregistrer brouillon'}
            </button>
            <button className="dv-sidebar-btn yellow" type="button" disabled={pdfLoading} onClick={() => generatePdf('download')}>
              {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
            </button>
            <button className="dv-sidebar-btn green" type="button" disabled={saving} onClick={saveAndSend}>
              {saving ? 'Validation…' : 'Valider et envoyer'}
            </button>
          </div>

        </div>
      </div>

      {/* ============ MODAL : Client picker ============ */}
      {showClientPicker && (
        <div className="dvbtp-modal-ov" onClick={() => setShowClientPicker(false)}>
          <div className="dvbtp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Importer depuis la base client</h3>
            <input
              className="picker-search"
              type="text"
              placeholder="Rechercher (nom, email, SIRET…)"
              value={clientDbSearch}
              onChange={(e) => setClientDbSearch(e.target.value)}
              autoFocus
            />
            <div className="picker-list">
              {clientDbLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: 12 }}>Chargement…</div>
              ) : clientDb.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: 12 }}>
                  Aucun client trouvé. Créez vos clients depuis l&apos;onglet Clients.
                </div>
              ) : (
                clientDb
                  .filter((c) => {
                    if (!clientDbSearch.trim()) return true
                    const q = clientDbSearch.toLowerCase()
                    return (c.name || '').toLowerCase().includes(q)
                      || (c.email || '').toLowerCase().includes(q)
                      || (c.siret || '').toLowerCase().includes(q)
                  })
                  .slice(0, 30)
                  .map((c) => (
                    <div key={c.id} className="picker-item" onClick={() => selectClient(c)}>
                      <div className="nm">{c.name}</div>
                      <div className="meta">
                        {[c.email, c.phone, c.siret].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  ))
              )}
            </div>
            <div className="dvbtp-modal-foot">
              <button className="dvbtp-modal-btn" type="button" onClick={() => setShowClientPicker(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL : Rentabilité (placeholder) ============ */}
      {showRentaModal && (
        <div className="dvbtp-modal-ov" onClick={() => setShowRentaModal(false)}>
          <div className="dvbtp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📊 Rentabilité du devis</h3>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 16 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>Total TTC :</strong> {fmt(totaux.totalTTC)} ({fmt(totaux.totalHT)} HT)
              </p>
              <p style={{ marginBottom: 8 }}>
                Le module complet (calcul coût salarié + marge + frais généraux) est disponible
                dans le composant standard. Une version BTP enrichie sera branchée prochainement.
              </p>
            </div>
            <div className="dvbtp-modal-foot">
              <button className="dvbtp-modal-btn" type="button" onClick={() => setShowRentaModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

