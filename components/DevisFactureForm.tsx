'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import NextImage from 'next/image'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { getLocaleFormats, type Locale } from '@/lib/i18n/config'
import ReceiptScanner, { type DevisReceiptLine } from '@/components/common/ReceiptScanner'

// ── Signature types (inline to avoid cross-dependency with syndic) ──
interface SignatureData {
  svg_data: string
  signataire: string
  timestamp: string
  document_ref: string
  hash_sha256: string
}

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

interface ProductLine {
  id: number
  description: string
  qty: number
  unit: string  // valeur courte : u, m2, ml, m3, h, j, f, lot, m, kg, L, t, pce, ens, pt, ou valeur personnalisée
  customUnit?: string  // si unit === 'autre', contient la valeur saisie (max 8 chars)
  priceHT: number
  tvaRate: number
  totalHT: number
  source?: 'etape_motif' | 'manual'  // traçabilité étape → ligne
  etape_id?: string  // lien vers l'étape source
}

// ═══════════════════════════════════════════════
// UNITÉS DE MESURE DEVIS
// ═══════════════════════════════════════════════
const UNITES_DEVIS = [
  { value: 'u',    label: 'u — Unité'           },
  { value: 'm2',   label: 'm² — Mètre carré'    },
  { value: 'ml',   label: 'ml — Mètre linéaire' },
  { value: 'm3',   label: 'm³ — Mètre cube'     },
  { value: 'h',    label: 'h — Heure'           },
  { value: 'j',    label: 'j — Jour'            },
  { value: 'f',    label: 'f — Forfait'         },
  { value: 'lot',  label: 'lot — Lot'           },
  { value: 'm',    label: 'm — Mètre'           },
  { value: 'kg',   label: 'kg — Kilogramme'     },
  { value: 'L',    label: 'L — Litre'           },
  { value: 't',    label: 't — Tonne'           },
  { value: 'pce',  label: 'pce — Pièce'         },
  { value: 'ens',  label: 'ens — Ensemble'      },
  { value: 'pt',   label: 'pt — Point'          },
  { value: 'autre', label: '✏️ Personnalisé...' },
]

const UNITE_VALUES = new Set(UNITES_DEVIS.map(u => u.value))

/** Convertit la valeur stockée en affichage PDF lisible (m2→m², m3→m³) */
const formatUnitForPdf = (unit: string, customUnit?: string): string => {
  if (unit === 'autre') return customUnit || 'u'
  if (unit === 'm2' || unit === 'm²') return 'm²'
  if (unit === 'm3' || unit === 'm³') return 'm³'
  return unit || 'u'
}

/** Résout l'unité effective d'une ligne (gère 'autre' + rétrocompat anciens formats) */
const resolveLineUnit = (line: ProductLine): string => {
  if (line.unit === 'autre') return line.customUnit || 'u'
  return line.unit || 'u'
}

/** Pour le select : si la valeur existante n'est pas dans la liste, traiter comme 'autre' */
const getSelectValue = (line: ProductLine): string => {
  // Rétrocompat : anciennes valeurs m², m³, forfait, tonne → mapper vers nouvelles
  const legacyMap: Record<string, string> = {
    'm²': 'm2', 'm³': 'm3', 'forfait': 'f', 'tonne': 't',
  }
  const mapped = legacyMap[line.unit] || line.unit
  if (UNITE_VALUES.has(mapped)) return mapped
  return 'autre'
}

interface DevisEtape {
  id: string
  ordre: number
  designation: string
  source_etape_id?: string  // id de l'étape template (null si ajoutée manuellement)
}

interface DevisAcompte {
  id: string
  ordre: number
  label: string
  pourcentage: number
  declencheur: string
}

interface DevisFactureData {
  docType: 'devis' | 'facture'
  docNumber: string
  docTitle: string
  // Entreprise
  companyStatus: string
  companyName: string
  companySiret: string
  companyAddress: string
  companyRCS: string
  companyCapital: string
  companyPhone: string
  companyEmail: string
  insuranceNumber: string
  insuranceName: string
  insuranceCoverage: string
  insuranceType: 'rc_pro' | 'decennale' | 'both'
  // Médiateur
  mediatorName: string
  mediatorUrl: string
  isHorsEtablissement: boolean
  // TVA
  tvaEnabled: boolean
  tvaNumber: string
  // Client
  clientName: string
  clientEmail: string
  clientAddress: string
  interventionAddress: string
  clientPhone: string
  clientSiret: string
  // Document
  docDate: string
  docValidity: number
  prestationDate: string
  executionDelay: string
  executionDelayDays: number
  executionDelayType: 'ouvres' | 'calendaires'
  // Payment (facture only)
  paymentMode: string
  paymentDue: string
  paymentCondition: string
  discount: string
  iban: string
  bic: string
  // Lines
  lines: ProductLine[]
  // Étapes d'intervention (descriptif pour le client)
  etapes?: DevisEtape[]
  // Notes
  notes: string
  // Acomptes
  acomptesEnabled?: boolean
  acomptes?: DevisAcompte[]
}

interface ArtisanBasic {
  id: string
  company_name?: string
  company_address?: string
  address?: string
  siret?: string
  phone?: string
  email?: string
  city?: string
  [key: string]: unknown
}

interface ServiceBasic {
  id: string
  name: string
  price_ht?: number
  price_ttc?: number
  duration_minutes?: number
  description?: string
  [key: string]: unknown
}

interface BookingBasic {
  id: string
  booking_date: string
  booking_time: string
  status: string
  client_id?: string
  client_name?: string
  address?: string
  notes?: string
  price_ht?: number
  price_ttc?: number
  service_id?: string
  services?: { name: string }
  [key: string]: unknown
}

interface DevisFactureFormProps {
  artisan: ArtisanBasic
  services: ServiceBasic[]
  bookings: BookingBasic[]
  initialDocType?: 'devis' | 'facture'
  initialData?: Partial<DevisFactureData>
  onBack: () => void
  onSave?: (data: DevisFactureData) => void
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

// Map official legal form labels from API to internal codes
/** Normalise une adresse ALL CAPS (API BAN) en Title Case */
function titleCaseAddress(addr: string): string {
  if (!addr) return addr
  if (addr !== addr.toUpperCase()) return addr
  const lowerWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'l', 'en', 'et', 'au', 'aux', 'sur'])
  const abbrMap: Record<string, string> = {
    'RES': 'Rés.', 'RESIDENCE': 'Résidence', 'BAT': 'Bât.', 'BATIMENT': 'Bâtiment',
    'AV': 'Av.', 'AVENUE': 'Avenue', 'BD': 'Bd', 'BOULEVARD': 'Boulevard',
    'RUE': 'Rue', 'IMPASSE': 'Impasse', 'ALLEE': 'Allée', 'CHEMIN': 'Chemin',
    'PLACE': 'Place', 'ROUTE': 'Route', 'COURS': 'Cours', 'CEDEX': 'Cedex',
  }
  return addr.split(/(\s+|,\s*)/g).map((part, idx) => {
    const t = part.trim()
    if (!t || /^[\s,]+$/.test(part)) return part
    if (/^\d{5}$/.test(t)) return t
    if (abbrMap[t]) return abbrMap[t]
    const lo = t.toLowerCase()
    if (idx > 0 && lowerWords.has(lo)) return lo
    return lo.charAt(0).toUpperCase() + lo.slice(1)
  }).join('')
}

function mapLegalFormToCode(legalForm: string): string {
  if (!legalForm) return 'ei'
  const lower = legalForm.toLowerCase()
  if (lower.includes('auto-entrepreneur') || lower.includes('micro-entrepreneur')) return 'ae'
  if (lower.includes('sarl') && !lower.includes('eurl')) return 'sarl'
  if (lower.includes('eurl')) return 'eurl'
  if (lower.includes('sas') && !lower.includes('sasu')) return 'sas'
  if (lower.includes('sasu')) return 'sas'
  if (lower.includes('entreprise individuelle') || lower.includes('entrepreneur individuel')) return 'ei'
  if (lower.includes('personne physique')) return 'ei'
  // Fallback: look for keywords
  if (lower.includes('sarl')) return 'sarl'
  if (lower.includes('sas')) return 'sas'
  return 'ei'
}

// Map internal code back to display label (locale-aware)
function getStatusLabel(code: string, t?: (key: string, fallback?: string) => string): string {
  if (t) {
    const translated = t(`devis.statusLabels.${code}`)
    if (translated !== `devis.statusLabels.${code}`) return translated
  }
  const labels: Record<string, string> = {
    'ei': 'Entreprise Individuelle (EI)',
    'ae': 'Auto-Entrepreneur',
    'eurl': 'EURL',
    'sarl': 'SARL',
    'sas': 'SAS',
    'eni': 'Empresário em Nome Individual (ENI)',
    'unipessoal': 'Unipessoal Lda.',
    'lda': 'Sociedade por Quotas (Lda.)',
    'sa': 'Sociedade Anónima (SA)',
  }
  return labels[code] || code
}

// Get company statuses for current locale
function getCompanyStatuses(locale: Locale): Array<{ value: string; label: string }> {
  if (locale === 'pt') {
    return [
      { value: 'eni', label: 'Empresário em Nome Individual (ENI)' },
      { value: 'unipessoal', label: 'Unipessoal Lda.' },
      { value: 'lda', label: 'Sociedade por Quotas (Lda.)' },
      { value: 'sa', label: 'Sociedade Anónima (SA)' },
    ]
  }
  return [
    { value: 'ei', label: 'Entreprise Individuelle (EI)' },
    { value: 'ae', label: 'Auto-Entrepreneur' },
    { value: 'eurl', label: 'EURL' },
    { value: 'sarl', label: 'SARL' },
    { value: 'sas', label: 'SAS' },
  ]
}

// Check if status is a société-type (needing capital, RCS etc.)
function isSocieteStatus(status: string, locale: Locale): boolean {
  if (locale === 'pt') return ['lda', 'sa'].includes(status)
  return ['sarl', 'eurl', 'sas'].includes(status)
}

// Check if status is AE/EI equivalent (VAT exempt by default)
function isSmallBusinessStatus(status: string, locale: Locale): boolean {
  if (locale === 'pt') return ['eni'].includes(status)
  return ['ae', 'ei'].includes(status)
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

export default function DevisFactureForm({
  artisan,
  services,
  bookings,
  initialDocType = 'devis',
  initialData,
  onBack,
  onSave,
}: DevisFactureFormProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const localeFormats = useMemo(() => getLocaleFormats(locale), [locale])

  const today = new Date().toISOString().split('T')[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  // ─── Template settings (persisted across new devis) ───
  // Champs récurrents sauvegardés une fois et auto-remplis sur chaque nouveau devis
  const savedTemplate = (() => {
    try {
      const raw = typeof window !== 'undefined'
        ? localStorage.getItem(`fixit_devis_template_${artisan?.id}`)
        : null
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })()
  const tpl = (key: string) => initialData ? undefined : savedTemplate[key]

  // ─── PDF (vector-based jsPDF + autoTable) ───
  const [pdfLoading, setPdfLoading] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // ─── Verified Company Data ───
  const [verifiedCompany, setVerifiedCompany] = useState<any>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)
  const [companyVerified, setCompanyVerified] = useState(false)

  // ─── State ───
  const [docType, setDocType] = useState<'devis' | 'facture'>(initialData?.docType || initialDocType)
  const [companyStatus, setCompanyStatus] = useState(initialData?.companyStatus || tpl('companyStatus') || 'ei')
  const [companyName, setCompanyName] = useState(initialData?.companyName || artisan?.company_name || '')
  const [companySiret, setCompanySiret] = useState(initialData?.companySiret || artisan?.siret || '')
  const [companyAddress, setCompanyAddress] = useState(initialData?.companyAddress || artisan?.company_address || artisan?.address || '')
  const [companyRCS, setCompanyRCS] = useState(initialData?.companyRCS || tpl('companyRCS') || '')
  const [companyCapital, setCompanyCapital] = useState(initialData?.companyCapital || tpl('companyCapital') || '')
  const [companyPhone, setCompanyPhone] = useState(initialData?.companyPhone || artisan?.phone || '')
  const [companyEmail, setCompanyEmail] = useState(initialData?.companyEmail || artisan?.email || '')
  const [insuranceNumber, setInsuranceNumber] = useState(initialData?.insuranceNumber || tpl('insuranceNumber') || '')
  const [insuranceName, setInsuranceName] = useState(initialData?.insuranceName || tpl('insuranceName') || '')
  const [insuranceCoverage, setInsuranceCoverage] = useState(initialData?.insuranceCoverage || tpl('insuranceCoverage') || (locale === 'pt' ? 'Portugal Continental' : 'France métropolitaine'))
  const [insuranceType, setInsuranceType] = useState<'rc_pro' | 'decennale' | 'both'>(initialData?.insuranceType || tpl('insuranceType') || 'rc_pro')
  // Médiateur de la consommation (obligatoire depuis 01/01/2016)
  const [mediatorName, setMediatorName] = useState(initialData?.mediatorName || tpl('mediatorName') || '')
  const [mediatorUrl, setMediatorUrl] = useState(initialData?.mediatorUrl || tpl('mediatorUrl') || '')
  // Droit de rétractation (contrat hors établissement)
  const [isHorsEtablissement, setIsHorsEtablissement] = useState(initialData?.isHorsEtablissement ?? true)
  const [companySiren, setCompanySiren] = useState('')
  const [companyNafLabel, setCompanyNafLabel] = useState('')
  const [officialLegalForm, setOfficialLegalForm] = useState('')

  const [tvaEnabled, setTvaEnabled] = useState(initialData?.tvaEnabled ?? tpl('tvaEnabled') ?? false)
  const [tvaNumber, setTvaNumber] = useState(initialData?.tvaNumber || tpl('tvaNumber') || '')

  const [clientName, setClientName] = useState(initialData?.clientName || '')
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '')
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress || '')
  const [interventionAddress, setInterventionAddress] = useState(initialData?.interventionAddress || '')
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '')
  const [clientSiret, setClientSiret] = useState(initialData?.clientSiret || '')

  const [docDate, setDocDate] = useState(today)
  const [docValidity, setDocValidity] = useState(initialData?.docValidity || 30)
  const [prestationDate, setPrestationDate] = useState(initialData?.prestationDate || '')
  const [executionDelay, setExecutionDelay] = useState(initialData?.executionDelay || '')
  const [executionDelayDays, setExecutionDelayDays] = useState<number>(initialData?.executionDelayDays || 0)
  const [executionDelayType, setExecutionDelayType] = useState<'ouvres' | 'calendaires'>(initialData?.executionDelayType || 'ouvres')
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || t('devis.paymentModeOptions.transfer'))
  const [paymentDue, setPaymentDue] = useState(dueDateStr)
  const [discount, setDiscount] = useState(initialData?.discount || '')
  const [iban, setIban] = useState(initialData?.iban || tpl('iban') || '')
  const [bic, setBic] = useState(initialData?.bic || tpl('bic') || '')
  const [paymentCondition, setPaymentCondition] = useState(initialData?.paymentCondition || t('devis.paymentCondValues.immediate'))

  const [lines, setLines] = useState<ProductLine[]>(initialData?.lines || [])
  const [editingDescLineId, setEditingDescLineId] = useState<number | null>(null)
  const [devisEtapes, setDevisEtapes] = useState<DevisEtape[]>(initialData?.etapes || [])
  const [notes, setNotes] = useState(initialData?.notes || (initialData?.docNumber ? (locale === 'pt' ? `Ref. orçamento: ${initialData.docNumber}` : `Réf. devis : ${initialData.docNumber}`) : ''))
  const [docTitle, setDocTitle] = useState(initialData?.docTitle || '')
  // Acomptes
  const [acomptesEnabled, setAcomptesEnabled] = useState(initialData?.acomptesEnabled !== undefined ? initialData.acomptesEnabled : true)
  const [acomptes, setAcomptes] = useState<DevisAcompte[]>(initialData?.acomptes || [{ id: 'default-1', ordre: 1, pourcentage: 30, declencheur: 'À la signature', label: 'Acompte 1' }])
  // ─── Linked booking for Vitfix channel ───
  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState<'pdf' | 'validate' | null>(null)
  const [showReceiptScanner, setShowReceiptScanner] = useState(false)
  const [sendingVitfix, setSendingVitfix] = useState(false)

  // ─── Attached Rapport ───
  const [attachedRapportId, setAttachedRapportId] = useState<string | null>(null)
  const [availableRapports, setAvailableRapports] = useState<any[]>([])

  // ─── Attached Photos Chantier ───
  const [availablePhotos, setAvailablePhotos] = useState<Array<{ id: string; url: string; label?: string; taken_at?: string; lat?: number; lng?: number; booking_id?: string }>>([])

  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [photosLoading, setPhotosLoading] = useState(false)

  // ─── Signature électronique ───
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const [sigDrawing, setSigDrawing] = useState(false)
  const [sigPoints, setSigPoints] = useState<{ x: number; y: number }[][]>([])
  const [sigCurrentStroke, setSigCurrentStroke] = useState<{ x: number; y: number }[]>([])
  const [sigNom, setSigNom] = useState('')
  const [sigSigning, setSigSigning] = useState(false)

  // Load available rapports from localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const rapports = JSON.parse(localStorage.getItem(`fixit_rapports_${artisan.id}`) || '[]')
      setAvailableRapports(rapports)
    } catch (e) { console.warn('[DevisFactureForm] Failed to load rapports:', e); setAvailableRapports([]) }
  }, [artisan?.id])

  // Load available photos from API
  useEffect(() => {
    if (!artisan?.id) return
    const fetchPhotos = async () => {
      setPhotosLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`/api/artisan-photos?artisan_id=${artisan.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const json = await res.json()
          setAvailablePhotos(json.data || [])
        }
      } catch (e) { console.warn('[DevisFactureForm] Failed to fetch photos:', e) }
      setPhotosLoading(false)
    }
    fetchPhotos()
  }, [artisan?.id])

  const attachedRapport = availableRapports.find(r => r.id === attachedRapportId) || null
  const selectedPhotos = availablePhotos.filter(p => selectedPhotoIds.has(p.id))

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  // ─── Signature Canvas Handlers ───
  const getSigPos = useCallback((e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }, [])

  const sigStartDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = sigCanvasRef.current; if (!canvas) return
    e.preventDefault()
    setSigDrawing(true)
    const pos = getSigPos(e, canvas)
    setSigCurrentStroke([pos])
    const ctx = canvas.getContext('2d')!
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
  }, [getSigPos])

  const sigDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!sigDrawing) return
    const canvas = sigCanvasRef.current; if (!canvas) return
    e.preventDefault()
    const pos = getSigPos(e, canvas)
    setSigCurrentStroke(prev => [...prev, pos])
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1E293B'
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
  }, [sigDrawing, getSigPos])

  const sigEndDraw = useCallback(() => {
    if (!sigDrawing) return
    setSigDrawing(false)
    setSigPoints(prev => [...prev, sigCurrentStroke])
    setSigCurrentStroke([])
  }, [sigDrawing, sigCurrentStroke])

  const sigClearCanvas = useCallback(() => {
    const canvas = sigCanvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSigPoints([]); setSigCurrentStroke([])
  }, [])

  const sigBuildSVG = useCallback(() => {
    const paths = sigPoints.filter(s => s.length > 1).map(stroke => {
      const d = stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      return `<path d="${d}" stroke="#1E293B" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140">${paths}</svg>`
  }, [sigPoints])

  // Generate document number — séquences séparées devis / facture / avoir (art. L441-9 C. com.)
  const isConversion = docType === 'facture' && initialData?.docType === 'devis' && initialData?.docNumber

  const [devisCount] = useState(() => {
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const devisDocs = docs.filter((d: Record<string, unknown>) => d.docType === 'devis')
      return devisDocs.length + 1
    } catch (e) { console.warn('[DevisFactureForm] Failed to count devis:', e); return 1 }
  })
  const [factureCount] = useState(() => {
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      const factureDocs = docs.filter((d: Record<string, unknown>) => d.docType === 'facture')
      return factureDocs.length + 1
    } catch (e) { console.warn('[DevisFactureForm] Failed to count factures:', e); return 1 }
  })

  const docNumber = docType === 'devis'
    ? `DEV-${new Date().getFullYear()}-${String(devisCount).padStart(3, '0')}`
    : `FACT-${new Date().getFullYear()}-${String(factureCount).padStart(3, '0')}`

  // ─── Signature: sign + SVG→PNG conversion ───
  const handleSignDocument = useCallback(async () => {
    if (sigPoints.length === 0 || !sigNom.trim()) return
    setSigSigning(true)
    try {
      const svg = sigBuildSVG()
      const timestamp = new Date().toISOString()
      const payload = `${sigNom}|${timestamp}|${docNumber}|${svg.length}`
      const encoder = new TextEncoder()
      const data = encoder.encode(payload)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      setSignatureData({ svg_data: svg, signataire: sigNom, timestamp, document_ref: docNumber, hash_sha256: hash })
      setShowSignatureModal(false)
    } catch {
      setSignatureData({ svg_data: sigBuildSVG(), signataire: sigNom, timestamp: new Date().toISOString(), document_ref: docNumber, hash_sha256: 'hash_error' })
      setShowSignatureModal(false)
    }
    setSigSigning(false)
  }, [sigPoints, sigNom, sigBuildSVG, docNumber])

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

  // Référence du devis d'origine (si conversion devis → facture)
  const sourceDevisRef = isConversion ? initialData.docNumber : null

  // ─── Auth helper for API calls ───
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` }
      }
    } catch (e) { console.warn('[DevisFactureForm] Failed to get auth headers:', e) }
    return {}
  }

  // ─── Fetch verified company data on mount ───
  useEffect(() => {
    if (artisan?.id) {
      fetchVerifiedCompanyData()
    } else {
      setLoadingCompany(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisan?.id])

  const fetchVerifiedCompanyData = async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/artisan-company?artisan_id=${artisan.id}`, { headers })
      const json = await res.json()

      if (json.company) {
        const c = json.company
        setVerifiedCompany(c)
        setCompanyVerified(json.verified === true)

        // Auto-fill fields with verified data (API > artisan prop fallback)
        if (c.name) setCompanyName(c.name)
        if (c.siret) setCompanySiret(c.siret)
        if (c.siren) setCompanySiren(c.siren)
        // Address: API data > company_address column > address column
        const resolvedAddress = c.address || artisan?.company_address || artisan?.address || ''
        if (resolvedAddress) setCompanyAddress(resolvedAddress)
        // Phone: API > profiles_artisan.phone
        const resolvedPhone = c.phone || artisan?.phone || ''
        if (resolvedPhone) setCompanyPhone(resolvedPhone)
        // Email: API > profiles_artisan.email
        const resolvedEmail = c.email || artisan?.email || ''
        if (resolvedEmail) setCompanyEmail(resolvedEmail)
        if (c.nafLabel) setCompanyNafLabel(c.nafLabel)

        // Auto-fill RCS/RM from SIREN + city/department
        if (c.siren && !companyRCS) {
          const legalLower = (c.legalForm || '').toLowerCase()
          // Determine greffe city from postal code (first 2 digits = department)
          const dept = (c.postalCode || '').substring(0, 2)
          const GREFFE_MAP: Record<string, string> = {
            '13': 'Marseille', '06': 'Nice', '83': 'Toulon', '84': 'Avignon',
            '75': 'Paris', '92': 'Nanterre', '93': 'Bobigny', '94': 'Créteil',
            '69': 'Lyon', '31': 'Toulouse', '33': 'Bordeaux', '59': 'Lille',
            '44': 'Nantes', '67': 'Strasbourg', '34': 'Montpellier', '35': 'Rennes',
            '76': 'Rouen', '21': 'Dijon', '45': 'Orléans', '37': 'Tours',
            '54': 'Nancy', '57': 'Metz', '63': 'Clermont-Ferrand',
          }
          const greffeCity = GREFFE_MAP[dept] || (c.city ? c.city.charAt(0).toUpperCase() + c.city.slice(1).toLowerCase() : '')

          if (greffeCity) {
            // EI / Auto-entrepreneur → RM (Répertoire des Métiers)
            // SARL, SAS, SA, EURL → RCS
            if (legalLower.includes('individuel') || legalLower.includes('auto') || legalLower.includes('personne physique')) {
              setCompanyRCS(`RM ${greffeCity} ${c.siren}`)
            } else {
              setCompanyRCS(`RCS ${greffeCity} ${c.siren}`)
            }
          }
        }

        // Map and lock legal form
        if (c.legalForm) {
          setOfficialLegalForm(c.legalForm)
          const code = mapLegalFormToCode(c.legalForm)
          setCompanyStatus(code)

          // Auto-entrepreneurs et EI : TVA désactivée par défaut
          // (franchise en base, art. 293 B du CGI)
          // Sauf si initialData force explicitement tvaEnabled=true (seuil dépassé)
          if (isSmallBusinessStatus(code, locale) && !initialData?.tvaEnabled) {
            setTvaEnabled(false)
            // Mettre les taux TVA des lignes existantes à 0%
            setLines(prev => prev.map(l => ({ ...l, tvaRate: 0 })))
          }
        }

        // Auto-fill assurance depuis les metadata
        if (c.insuranceNumber && !insuranceNumber) {
          setInsuranceNumber(c.insuranceNumber)
        }
        if (c.insuranceName && !insuranceName) {
          setInsuranceName(c.insuranceName)
        }
      }
    } catch (err) {
      console.error('Error fetching verified company data:', err)
    }
    setLoadingCompany(false)
  }

  // Initialize with one empty line (only if no initial data)
  useEffect(() => {
    if (lines.length === 0) {
      addLine()
    }
  }, [])

  // ─── Product Lines ───
  const defaultTvaRate = tvaEnabled ? (locale === 'pt' ? 23 : 20) : 0

  const addLine = () => {
    setLines(prev => [...prev, {
      id: Date.now(),
      description: '',
      qty: 1,
      unit: 'u',
      priceHT: 0,
      tvaRate: defaultTvaRate,
      totalHT: 0,
    }])
  }

  const updateLine = (id: number, field: keyof ProductLine, value: string | number) => {
    setLines(prev => prev.map(line => {
      if (line.id !== id) return line
      const updated = { ...line, [field]: value }
      updated.totalHT = updated.qty * updated.priceHT
      return updated
    }))
  }

  const removeLine = (id: number) => {
    setLines(prev => prev.filter(l => l.id !== id))
  }

  // Déduire une unité par défaut à partir du nom du service/motif
  const getDefaultUnitByServiceName = (name: string): string => {
    const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Mapping mot-clé → unité par défaut
    const keywordMap: [RegExp, string][] = [
      [/plomberie|plombier|debouchage|fuite|robinet|chauffe[- ]?eau|ballon|cumulus|sanitaire|salle de bain|wc|toilette/, 'h'],
      [/peinture|peintre|ravalement|enduit|revetement mural/, 'm2'],
      [/electricite|electri(?:que|cien)|tableau|prise|interrupteur|eclairage|domotique/, 'f'],
      [/carrelage|carreleur|faience|mosaique|sol|revetement de sol/, 'm2'],
      [/maconnerie|macon|beton|dalle|fondation|agglo|parpaing|mur/, 'm2'],
      [/menuiserie|menuisier|porte|fenetre|volet|placard|escalier|bois/, 'u'],
      [/chauffage|chauffagiste|chaudiere|radiateur|clim|climatisation|pac|pompe a chaleur/, 'f'],
      [/toiture|couvreur|couverture|toit|gouttiere|zinguerie|ardoise|tuile/, 'm2'],
      [/nettoyage|menage|entretien|proprete|lavage|desinfection/, 'm2'],
      [/serrurerie|serrurier|serrure|verrou|blindage|ouverture de porte/, 'f'],
      [/vitrerie|vitrier|vitre|vitrage|double vitrage|miroir/, 'u'],
      [/elagage|abattage|arbre|haie|taille de|souche/, 'u'],
      [/jardinage|jardinier|espaces verts|tonte|debroussaillage|gazon|pelouse/, 'h'],
      [/demenagement|demenageur/, 'f'],
      [/isolation|isolant|combles|laine|polystyrene/, 'm2'],
      [/platrerie|platrier|placo|placoplatre|cloison|faux plafond/, 'm2'],
      [/terrassement|demolition|evacuation|deblai/, 'm3'],
      [/diagnostic|expertise|audit|controle|inspection/, 'f'],
      [/depannage|urgence|intervention/, 'f'],
      [/metre lineaire|pose de|canalisation|conduit|goulotte|cable/, 'ml'],
    ]
    for (const [regex, unit] of keywordMap) {
      if (regex.test(n)) return unit
    }
    return 'u'
  }

  // Extraire l'unité du service (encodée dans description : [unit:m2|min:X|max:Y])
  // et la mapper au format ProductLine (m², m³, ml, h, forfait, u, kg, lot)
  // Fallback : déduire l'unité depuis le nom du service
  const parseServiceUnit = (service: ServiceBasic | null): string => {
    const desc = service?.description || ''
    const match = desc.match(/\[unit:([^|]+)\|/)
    if (match) {
      const unitMap: Record<string, string> = {
        'm2': 'm2', 'ml': 'ml', 'm3': 'm3', 'heure': 'h',
        'forfait': 'f', 'unite': 'u', 'arbre': 'u',
        'tonne': 't', 'kg': 'kg', 'lot': 'lot',
      }
      return unitMap[match[1]] || 'u'
    }
    // Pas d'unité encodée → déduire depuis le nom du service
    return getDefaultUnitByServiceName(service?.name || '')
  }

  const selectMotif = async (lineId: number, serviceId: string) => {
    if (serviceId === 'custom') {
      updateLine(lineId, 'description', '')
      return
    }
    const service = services.find(s => s.id === serviceId)
    if (!service) return

    // Pour un AE/EI sans TVA → price_ttc = prix réel (pas de TVA)
    // Pour une entreprise avec TVA → price_ttc inclut la TVA, price_ht = HT
    const price = tvaEnabled ? (service.price_ht || 0) : (service.price_ttc || service.price_ht || 0)
    // Unité automatique depuis le paramétrage du motif
    const serviceUnit = parseServiceUnit(service)

    // ── Charger les étapes template du motif ──
    let etapesTemplate: { id: string; ordre: number; designation: string }[] = []
    try {
      const res = await fetch(`/api/service-etapes?service_id=${serviceId}`)
      const json = await res.json()
      if (json.etapes?.length) etapesTemplate = json.etapes
    } catch { /* pas d'étapes = pas grave */ }

    if (etapesTemplate.length > 0) {
      // Copier les étapes sur le devis (affichées dans la section "Étapes de l'intervention")
      const copiedEtapes: DevisEtape[] = etapesTemplate.map((et, i) => ({
        id: `etape_${Date.now()}_${i}`,
        ordre: et.ordre,
        designation: et.designation,
        source_etape_id: et.id,
      }))
      setDevisEtapes(copiedEtapes)
    }

    // Comportement unique : une seule ligne avec nom + description
    {
      // Pas d'étapes → comportement classique (une seule ligne)
      // Inclure la description du motif si elle existe (sans les métadonnées [unit:...|min:...|max:...])
      const cleanDesc = service.description?.trim().replace(/\s*\[[^\]]*\]/g, '').trim()
      const fullDesc = cleanDesc
        ? `${service.name}\n${cleanDesc}`
        : service.name
      setLines(prev => prev.map(line => {
        if (line.id !== lineId) return line
        return {
          ...line,
          description: fullDesc,
          unit: serviceUnit,
          priceHT: price,
          tvaRate: defaultTvaRate,
          totalHT: 1 * price,
        }
      }))
    }
  }

  // ─── Import from intervention ───
  const [importingBooking, setImportingBooking] = useState(false)

  const importFromBooking = async (bookingId: string) => {
    if (!bookingId) return
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return

    // Track linked booking for Vitfix channel sending
    setLinkedBookingId(bookingId)
    setImportingBooking(true)
    try {
      // ── Step 1: pre-fill immediately from booking fields ──
      setClientAddress(booking.address || '')
      setPrestationDate(booking.booking_date || '')

      // Service line — utiliser price_ttc (prix affiché au client) comme base
      // Pour un auto-entrepreneur sans TVA, price_ttc = prix réel facturé (pas de TVA)
      // Pour un artisan avec TVA, price_ttc est le montant TTC → on calcule le HT
      const serviceName = booking.services?.name || 'Prestation'
      const bookingPrice = booking.price_ttc || booking.price_ht || 0
      const mainTaxRate = locale === 'pt' ? 1.23 : 1.2
      const linePrice = tvaEnabled ? Math.round((bookingPrice / mainTaxRate) * 100) / 100 : bookingPrice
      const lineTva = tvaEnabled ? (locale === 'pt' ? 23 : 20) : 0
      // Récupérer l'unité du service lié au booking
      const linkedService = services.find(s => s.id === booking.service_id)
      const serviceUnit = parseServiceUnit(linkedService ?? null)
      const serviceDesc = linkedService?.description?.trim()
        ? `${serviceName}\n${linkedService.description.trim()}`
        : serviceName
      setLines([{
        id: Date.now(),
        description: serviceDesc,
        qty: 1,
        unit: serviceUnit,
        priceHT: linePrice,
        tvaRate: lineTva,
        totalHT: linePrice,
      }])

      // ── Step 2: parse client info from notes ──
      // Two formats exist:
      //   Client booking: "Client: Jean | Tel: 06… | Email: jean@… | notes…"
      //   Artisan RDV:    "Client: Jean Dupont. description…"
      const rawNotes = booking.notes || ''
      const hasPipes = rawNotes.includes('|')
      const parseField = (label: string): string => {
        if (hasPipes) {
          // Pipe-delimited format
          const m = rawNotes.match(new RegExp(`${label}:\\s*([^|\\n]+)`, 'i'))
          return m ? m[1].trim() : ''
        } else {
          // Period-delimited format (artisan-created RDVs)
          const m = rawNotes.match(new RegExp(`${label}:\\s*([^.\\n]+)`, 'i'))
          return m ? m[1].trim() : ''
        }
      }
      const nameFromNotes = parseField('Client')
      const phoneFromNotes = parseField('Tel')
      const emailFromNotes = parseField('Email')

      // Set from notes immediately (instant, no network)
      if (nameFromNotes) setClientName(nameFromNotes)
      if (phoneFromNotes) setClientPhone(phoneFromNotes)
      if (emailFromNotes && emailFromNotes !== '-') setClientEmail(emailFromNotes)

      // Notes field stays empty — booking notes are operational, not for devis/facture
      setNotes('')

      // Set docTitle from service name
      if (serviceName && serviceName !== 'Prestation') setDocTitle(serviceName)

      // ── Step 3: if client has a Fixit account → enrich via API ──
      if (booking.client_id) {
        try {
          const headers = await getAuthHeaders()
          const res = await fetch(`/api/artisan-clients?client_id=${booking.client_id}`, { headers })
          if (res.ok) {
            const clientData = await res.json()
            // Overwrite with richer account data if available
            if (clientData.name) setClientName(clientData.name)
            if (clientData.phone) setClientPhone(clientData.phone)
            if (clientData.email) setClientEmail(clientData.email)
            if (!booking.address && clientData.address) setClientAddress(clientData.address)
          }
        } catch { /* ignore — we already have notes data */ }
      }
    } catch (e) {
      console.error('importFromBooking error:', e)
    } finally {
      setImportingBooking(false)
    }
  }

  // ─── Calculations ───
  const subtotalHT = lines.reduce((sum, l) => sum + l.totalHT, 0)
  const totalTVA = tvaEnabled
    ? lines.reduce((sum, l) => sum + (l.totalHT * l.tvaRate / 100), 0)
    : 0
  const totalTTC = subtotalHT + totalTVA

  // ─── Compliance Check ───
  // Adapté au statut : AE/EI n'ont pas besoin de capital social
  // Sociétés (SARL, EURL, SAS / Lda, SA) doivent avoir RCS + capital
  const isSociete = isSocieteStatus(companyStatus, locale)
  const compliance = {
    siret: companySiret.trim().length > 0,
    rcs: companyRCS.trim().length > 0,
    insurance: insuranceNumber.trim().length > 0,
    client: clientName.trim().length > 0,
    lines: lines.some(l => l.description.trim().length > 0 && l.totalHT > 0),
    ...(isSociete ? { capital: companyCapital.trim().length > 0 } : {}),
    ...(tvaEnabled ? { tvaNumber: tvaNumber.trim().length > 0 } : {}),
  }
  const allCompliant = Object.values(compliance).every(Boolean)

  // ─── Legal Mentions ───
  // Adaptées dynamiquement selon le statut juridique et la locale
  const getLegalMentions = () => {
    const mentions: string[] = []
    const isSoc = isSocieteStatus(companyStatus, locale)
    const isClientPro = clientSiret.trim().length > 0
    const rcsDefault = t('devis.legal.rcsDefault')
    const capDefault = t('devis.legal.capitalDefault')
    const dateLocaleStr = locale === 'pt' ? 'pt-PT' : 'fr-FR'

    // ══════════════════════════════════════════════
    // 1. IDENTIFICATION — obligatoire sur tout document commercial
    // ══════════════════════════════════════════════

    if (locale === 'pt') {
      // Portuguese company statuses
      if (companyStatus === 'eni') {
        mentions.push(t('devis.legal.eiStatus'))
      } else if (companyStatus === 'unipessoal') {
        mentions.push(t('devis.legal.eurlCapital').replace('{capital}', companyCapital || capDefault).replace('{rcs}', companyRCS || rcsDefault))
      } else if (companyStatus === 'lda') {
        mentions.push(t('devis.legal.sarlCapital').replace('{capital}', companyCapital || capDefault).replace('{rcs}', companyRCS || rcsDefault))
      } else if (companyStatus === 'sa') {
        mentions.push(t('devis.legal.sasCapital').replace('{capital}', companyCapital || capDefault).replace('{rcs}', companyRCS || rcsDefault))
      }
    } else {
      // French company statuses
      if (companyStatus === 'ae') {
        mentions.push(t('devis.legal.aeDispensed'))
      } else if (companyStatus === 'ei') {
        mentions.push(t('devis.legal.eiStatus'))
      } else if (companyStatus === 'eurl') {
        mentions.push(t('devis.legal.eurlCapital').replace('{capital}', companyCapital || capDefault).replace('{rcs}', companyRCS || rcsDefault))
      } else if (companyStatus === 'sarl') {
        mentions.push(t('devis.legal.sarlCapital').replace('{capital}', companyCapital || capDefault).replace('{rcs}', companyRCS || rcsDefault))
      } else if (companyStatus === 'sas') {
        mentions.push(t('devis.legal.sasCapital').replace('{capital}', companyCapital || capDefault).replace('{rcs}', companyRCS || rcsDefault))
      }
    }

    // ══════════════════════════════════════════════
    // 2. TVA / IVA
    // ══════════════════════════════════════════════
    if (!tvaEnabled) {
      mentions.push(t('devis.legal.tvaExempt'))
    } else if (tvaNumber) {
      mentions.push(t('devis.legal.tvaIntraNumber').replace('{number}', tvaNumber))
    }

    // ══════════════════════════════════════════════
    // 3. ASSURANCE
    // ══════════════════════════════════════════════
    if (insuranceNumber && insuranceName) {
      const insTypeLabel = insuranceType === 'rc_pro' ? t('devis.legal.insuranceRcPro')
        : insuranceType === 'decennale' ? t('devis.legal.insuranceDecennale')
        : t('devis.legal.insuranceBoth')
      mentions.push(t('devis.legal.insuranceLine').replace('{type}', insTypeLabel).replace('{name}', insuranceName).replace('{number}', insuranceNumber).replace('{coverage}', insuranceCoverage))
    }

    // ══════════════════════════════════════════════
    // 4. CONDITIONS DE PAIEMENT (facture)
    // ══════════════════════════════════════════════
    if (docType === 'facture') {
      if (paymentCondition) mentions.push(t('devis.legal.paymentConditions').replace('{condition}', paymentCondition))
      mentions.push(t('devis.legal.latePenalties'))
      mentions.push(t('devis.legal.recoveryFee'))
      if (!discount) mentions.push(t('devis.legal.noDiscount'))
      mentions.push(t('devis.legal.retentionOfTitle'))
      if (sourceDevisRef) {
        const datePart = prestationDate ? t('devis.legal.invoiceFromDevisDate').replace('{date}', new Date(prestationDate).toLocaleDateString(dateLocaleStr)) : ''
        mentions.push(t('devis.legal.invoiceFromDevis').replace('{ref}', sourceDevisRef) + datePart + '.')
      } else if (notes && (notes.includes('Réf. devis') || notes.includes('Ref. orçamento'))) {
        const devisRef = notes.match(/(?:Réf\. devis|Ref\. orçamento)\s*:\s*([^\n]+)/)?.[1]?.trim()
        if (devisRef) mentions.push(t('devis.legal.invoiceFromDevis').replace('{ref}', devisRef) + '.')
      }
      mentions.push(t('devis.legal.contestation'))
      if (!isClientPro) {
        mentions.push(t('devis.legal.consumerGuarantee'))
      }
    }

    // ══════════════════════════════════════════════
    // 5. DEVIS / ORÇAMENTO SPÉCIFIQUE
    // ══════════════════════════════════════════════
    if (docType === 'devis') {
      mentions.push(t('devis.legal.freeQuote'))
      if (executionDelay) {
        mentions.push(t('devis.legal.executionDelay').replace('{delay}', executionDelay))
      }
      if (docValidity) {
        mentions.push(t('devis.legal.quoteValidity').replace('{days}', String(docValidity)))
      }
    }

    // ══════════════════════════════════════════════
    // 6. DROIT DE RÉTRACTATION / DIREITO DE LIVRE RESOLUÇÃO
    // ══════════════════════════════════════════════
    if (docType === 'devis' && isHorsEtablissement && !isClientPro) {
      mentions.push(t('devis.legal.withdrawalRight'))
      mentions.push(t('devis.legal.noPaymentBefore7Days'))
    }

    // ══════════════════════════════════════════════
    // 7. MÉDIATEUR / ENTIDADE RAL
    // ══════════════════════════════════════════════
    if (!isClientPro) {
      if (mediatorName) {
        mentions.push(t('devis.legal.mediatorWithName').replace('{name}', mediatorName + (mediatorUrl ? ' — ' + mediatorUrl : '')))
      } else {
        mentions.push(t('devis.legal.mediatorGeneric'))
      }
    }

    // ══════════════════════════════════════════════
    // 8. MENTIONS SPÉCIFIQUES SOCIÉTÉS
    // ══════════════════════════════════════════════
    if (isSoc) {
      if (companyRCS) {
        mentions.push(t('devis.legal.headOffice').replace('{address}', companyAddress || '—').replace('{rcs}', companyRCS))
      }
    }

    return mentions
  }

  // ─── Actions ───
  const handleSaveDraft = () => {
    const data = buildData()
    // Save to localStorage as draft
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
    drafts.push({ ...data, savedAt: new Date().toISOString(), status: 'brouillon' })
    localStorage.setItem(`fixit_drafts_${artisan?.id}`, JSON.stringify(drafts))
    setSavedMsg(`💾 ${t('devis.draftSaved')}`)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  // ─── TEST PDF V2 (parallel generator, rollback-safe) ───
  const handleTestPdfV2 = async () => {
    setPdfLoading(true)
    try {
      const { generateDevisPdfV2 } = await import('@/lib/pdf/devis-generator-v2')
      // Re-fetch logo_url from DB (may have been updated after page load)
      let freshLogoUrl = (artisan?.logo_url as string) || null
      let freshInsuranceName = insuranceName
      let freshInsuranceNumber = insuranceNumber
      let freshInsuranceCoverage = insuranceCoverage
      let freshInsuranceType = insuranceType
      let freshInsuranceExpiry: string | null = null
      try {
        const { data: freshArtisan } = await supabase.from('profiles_artisan').select('logo_url, insurance_name, insurance_number, insurance_coverage, insurance_type, insurance_expiry').eq('id', artisan?.id).single()
        if (freshArtisan?.logo_url) freshLogoUrl = freshArtisan.logo_url
        if (freshArtisan?.insurance_name && !insuranceName) freshInsuranceName = freshArtisan.insurance_name
        if (freshArtisan?.insurance_number && !insuranceNumber) freshInsuranceNumber = freshArtisan.insurance_number
        if (freshArtisan?.insurance_coverage) freshInsuranceCoverage = freshArtisan.insurance_coverage
        if (freshArtisan?.insurance_type) freshInsuranceType = freshArtisan.insurance_type
        if (freshArtisan?.insurance_expiry) freshInsuranceExpiry = freshArtisan.insurance_expiry
        // Alerte si assurance expirée
        if (freshInsuranceExpiry && new Date(freshInsuranceExpiry) < new Date()) {
          const proceed = confirm(`⚠️ Votre assurance ${freshInsuranceName || 'RC Pro'} a expiré le ${new Date(freshInsuranceExpiry).toLocaleDateString('fr-FR')}.\n\nLe document sera généré mais les mentions légales indiqueront une assurance potentiellement non valide.\n\nVoulez-vous continuer ?`)
          if (!proceed) { setPdfLoading(false); return }
        }
      } catch { /* use cached value */ }
      const input = {
        artisan: {
          logo_url: freshLogoUrl,
          nom: companyName || artisan?.company_name || '',
          siret: companySiret || '',
          rm: (artisan?.rm as string) || null,
          adresse: companyAddress || '',
          telephone: companyPhone || '',
          email: companyEmail || '',
          rc_pro: (artisan?.rc_pro as string) || null,
          insurance_name: freshInsuranceName || null,
          insurance_number: freshInsuranceNumber || null,
          insurance_coverage: freshInsuranceCoverage || null,
          insurance_type: freshInsuranceType || null,
          tva_mention: tvaEnabled ? 'TVA applicable' : 'TVA non applicable, article 293 B du CGI.',
          mode_paiement: paymentMode || 'Virement bancaire',
        },
        client: {
          nom: clientName || '',
          siret: clientSiret || null,
          adresse: clientAddress || null,
          telephone: clientPhone || null,
          email: clientEmail || null,
        },
        devis: {
          numero: docNumber || 'DEVIS-TEST',
          titre: docTitle || (docType === 'devis' ? 'DEVIS' : 'FACTURE'),
          date_emission: new Date(docDate),
          validite_jours: docValidity || 30,
          delai_execution: executionDelay || 'À convenir',
          date_prestation: prestationDate ? new Date(prestationDate) : null,
        },
        mode_affichage: 'bloc' as const,
        lignes: lines.filter(l => l.description.trim()).map(l => ({
          designation: l.description,
          quantite: l.qty,
          unite: l.unit || 'u',
          prix_unitaire: l.priceHT,
          total: l.totalHT,
          section: null,
        })),
        etapes: devisEtapes.filter(e => e.designation.trim()).map(e => ({
          ordre: e.ordre,
          designation: e.designation,
        })),
        acomptes: acomptesEnabled ? acomptes.map(ac => {
          const totalNet = lines.filter(l => l.description.trim()).reduce((s, l) => s + l.totalHT, 0)
          return {
            label: ac.label,
            montant: totalNet * ac.pourcentage / 100,
            declencheur: ac.declencheur,
            statut: 'en attente' as const,
          }
        }) : undefined,
        notes: notes || undefined,
        mediateur: mediatorName || undefined,
        mediateur_url: mediatorUrl || undefined,
      }
      const pdf = await generateDevisPdfV2(input)
      pdf.save(`TEST-V2_${docNumber || 'devis'}.pdf`)
    } catch (err) {
      console.error('PDF V2 error:', err)
      alert('Erreur PDF V2: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPdfLoading(false)
    }
  }

  const handleGeneratePDF = async () => {
    setPdfLoading(true)
    try {
      let jsPDFMod: typeof import('jspdf'), autoTableModule: typeof import('jspdf-autotable')
      try {
        [jsPDFMod, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      } catch (chunkErr) {
        // Chunk invalide (déploiement Vercel en cours) — retry une fois après reload
        const retryKey = 'pdf_chunk_retry'
        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, '1')
          window.location.reload()
        } else {
          sessionStorage.removeItem(retryKey)
          alert('Erreur de chargement PDF. Rechargez la page (Ctrl+R) et réessayez.')
        }
        setPdfLoading(false)
        return
      }
      const { jsPDF } = jsPDFMod
      const autoTable = autoTableModule.default

      // ── PT Fiscal: Register document with AT engine (Portugal only) ──
      let ptFiscalData: {
        docNumber: string; hashDisplay: string; atcudDisplay: string;
        qrCodeString: string; certNumber: string;
      } | null = null

      if (locale === 'pt' && docType === 'facture') {
        try {
          const headers = await getAuthHeaders()
          const fiscalRes = await fetch('/api/portugal-fiscal/register-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              docType,
              issuerNIF: companySiret,
              issuerName: companyName,
              issuerAddress: companyAddress,
              clientNIF: clientSiret || undefined,
              clientName,
              clientAddress,
              fiscalSpace: 'PT',
              lines: lines.filter(l => l.description.trim()).map(l => ({
                description: l.description,
                quantity: l.qty,
                unitPrice: l.priceHT,
                taxRate: l.tvaRate,
                lineTotal: l.totalHT,
              })),
              issueDate: docDate,
            }),
          })
          if (fiscalRes.ok) {
            const { fiscal } = await fiscalRes.json()
            ptFiscalData = fiscal
          } else {
            console.warn('[PT Fiscal] Registration failed, generating PDF without fiscal data')
          }
        } catch (e) {
          console.warn('[PT Fiscal] Error registering document:', e)
        }
      }

      // ════════════════════════════════════════════════════════════════
      // NOUVEAU DESIGN PDF V3 — spec devis_lepore_logo_arbre.pdf
      // ════════════════════════════════════════════════════════════════
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()   // 210mm
      const pageH = pdf.internal.pageSize.getHeight()   // 297mm

      // ─── Couleurs spec ───
      const COLOR_TEXT = '#0D0D0D'
      const COLOR_TEXT_LIGHT = '#888888'
      const COLOR_BG_GRAY = '#F5F5F3'
      const COLOR_BORDER = '#E0E0DC'
      const COLOR_ACCENT = '#E8A020'
      const COLOR_WHITE = '#FFFFFF'

      // ─── Marges (mm) ───
      const mL = 18.0
      const mR = 18.0
      const contentW = pageW - mL - mR  // ~174mm
      const xRight = pageW - mR          // 192mm
      let y = 0  // curseur vertical courant

      // ─── Helpers ───
      const dateLocaleStr = locale === 'pt' ? 'pt-PT' : 'fr-FR'
      const ptToMm = (pt: number) => pt / 2.835
      const totalPages = () => (pdf as any).internal.getNumberOfPages()

      const drawHLine = (x1: number, yPos: number, x2: number, color = COLOR_BORDER, width = 0.18) => {
        pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
      }
      const drawVLine = (x: number, y1: number, y2: number, color = COLOR_BORDER, width = 0.18) => {
        pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x, y1, x, y2)
      }
      const addPageNumber = (pageNum: number, total: number) => {
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(`Page ${pageNum}/${total}`, xRight - 2, pageH - 3.2, { align: 'right' })
      }
      const checkPageBreak = (needed: number): boolean => {
        if (y + needed > pageH - 15) { pdf.addPage(); y = 18; return true }
        return false
      }

      // ═══ 1. LOGO (coin haut-gauche) ═══
      // Re-fetch logo from DB (may have been uploaded after page load)
      let logoUrl = artisan?.logo_url as string | undefined
      try {
        const { data: freshA } = await supabase.from('profiles_artisan').select('logo_url').eq('id', artisan?.id).single()
        if (freshA?.logo_url) logoUrl = freshA.logo_url
      } catch { /* use cached */ }
      if (logoUrl) {
        try {
          const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('Logo load failed'))
            img.src = logoUrl
          })
          const canvas = document.createElement('canvas')
          const maxSize = 500
          const ratio = logoImg.width / logoImg.height
          canvas.width = Math.min(logoImg.width, maxSize)
          canvas.height = Math.round(canvas.width / ratio)
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(logoImg, 0, 0, canvas.width, canvas.height)
            const logoData = canvas.toDataURL('image/png')
            // 23mm max box (65pt / 2.835)
            const logoMaxW = 23, logoMaxH = 23
            let lw = logoMaxW, lh = logoMaxH
            if (ratio > 1) { lh = lw / ratio } else { lw = lh * ratio }
            pdf.addImage(logoData, 'PNG', 5.3, 2.8, lw, lh)
          }
        } catch {
          // pas de logo = on saute
        }
      }

      // ═══ 2. TITRE DOCUMENT (centré) ═══
      y = 25  // ~71pt du haut
      const displayDocNumber = ptFiscalData?.docNumber || docNumber
      if (docTitle) {
        pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(docTitle, pageW / 2, y, { align: 'center' })
        y += 7
      } else {
        // Titre générique
        const genericTitle = docType === 'devis'
          ? (locale === 'pt' ? 'Orçamento' : 'Devis')
          : (locale === 'pt' ? 'Fatura' : 'Facture')
        pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(genericTitle, pageW / 2, y, { align: 'center' })
        y += 7
      }

      // Numéro document
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
      pdf.text(displayDocNumber, pageW / 2, y, { align: 'center' })
      y += 3

      // ── PT Fiscal: ATCUD + Hash ──
      if (ptFiscalData) {
        y += 1
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#1D4ED8')
        pdf.text(ptFiscalData.atcudDisplay, pageW / 2, y, { align: 'center' })
        y += 3
        pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(`Hash: ${ptFiscalData.hashDisplay}`, pageW / 2, y, { align: 'center' })
        y += 3
      }

      // ═══ 3. LIGNE D'ACCENT OR ═══
      y += 1
      pdf.setFillColor(COLOR_ACCENT)
      pdf.rect(mL, y, contentW, ptToMm(3), 'F')  // ~1.06mm de haut
      y += ptToMm(3) + 5  // ~5mm gap

      // ═══ 4. BLOCS ÉMETTEUR & DESTINATAIRE ═══
      const gapBoxes = ptToMm(11)  // ~3.88mm gap
      const emBoxW = ptToMm(235.62)  // ~83.1mm
      const destBoxW = contentW - emBoxW - gapBoxes  // ~87mm
      const boxX_em = mL
      const boxX_dest = mL + emBoxW + gapBoxes
      const boxStartY = y
      const boxPadX = ptToMm(11)  // ~3.88mm padding intérieur
      const boxPadTop = ptToMm(8)  // ~2.82mm padding top

      // ── Mesure hauteur émetteur (PAS de pdf.text ici — FIX doublon V5) ──
      let ey = boxStartY + boxPadTop
      const emTx = boxX_em + boxPadX
      const emMaxW = emBoxW - boxPadX * 2

      ey += ptToMm(18)  // label ÉMETTEUR
      ey += ptToMm(14)  // nom entreprise
      if (companySiret) ey += ptToMm(14)
      if (companyRCS) ey += ptToMm(14)
      if (companyAddress) ey += ptToMm(14)  // adresse sur 1 ligne
      if (companyPhone) ey += ptToMm(14)
      if (companyEmail) ey += ptToMm(14)
      if (tvaEnabled && tvaNumber) ey += ptToMm(14)
      if (companyCapital) ey += ptToMm(14)

      // ── Mesure hauteur destinataire (PAS de pdf.text ici) ──
      let dy2 = boxStartY + boxPadTop
      const destTx = boxX_dest + boxPadX
      const destMaxW = destBoxW - boxPadX * 2

      dy2 += ptToMm(18)  // label DESTINATAIRE
      dy2 += ptToMm(14)  // nom client
      if (clientAddress) dy2 += ptToMm(14)
      if (interventionAddress) dy2 += ptToMm(14)
      if (clientPhone) dy2 += ptToMm(14)
      if (clientEmail) dy2 += ptToMm(14)
      if (clientSiret) dy2 += ptToMm(14)

      // Calculer la hauteur max et dessiner les encadrés
      const boxH = Math.max(ey, dy2) - boxStartY + boxPadTop
      // Fond gris + bordure
      pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
      pdf.rect(boxX_em, boxStartY, emBoxW, boxH, 'FD')
      pdf.rect(boxX_dest, boxStartY, destBoxW, boxH, 'FD')

      // Re-dessiner le texte PAR-DESSUS les fonds (jsPDF dessine dans l'ordre)
      // Émetteur
      let ey2 = boxStartY + boxPadTop
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
      pdf.text(locale === 'pt' ? 'EMITENTE' : 'ÉMETTEUR', emTx, ey2)
      ey2 += ptToMm(18)
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
      pdf.text(companyName, emTx, ey2)
      ey2 += ptToMm(14)
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
      if (companySiret) { pdf.text(`SIRET : ${companySiret}`, emTx, ey2); ey2 += ptToMm(14) }
      if (companyRCS) {
        // FIX RM anti-doublon : ne pas ajouter "RM" si déjà présent
        let rmRaw = companyRCS.trim()
        if (!rmRaw.startsWith('RM ')) rmRaw = `RM ${rmRaw}`
        const rmDisplay = rmRaw.includes(' : ') ? rmRaw : rmRaw.replace(/^(RM\s+[A-Za-zÀ-ÿ\s-]+?)\s+(\d+)$/, '$1 : $2')
        pdf.text(rmDisplay, emTx, ey2); ey2 += ptToMm(14)
      }
      if (companyAddress) {
        // FIX adresse : titleCase + single line (réduire police si trop long)
        const addrNorm = companyAddress !== companyAddress.toUpperCase() ? companyAddress : titleCaseAddress(companyAddress)
        const addrText = `Adresse : ${addrNorm}`
        let addrFs = 10
        pdf.setFontSize(addrFs)
        if (pdf.getTextWidth(addrText) > emMaxW) { addrFs = 9; pdf.setFontSize(addrFs) }
        if (pdf.getTextWidth(addrText) > emMaxW) { addrFs = 8; pdf.setFontSize(addrFs) }
        pdf.text(addrText, emTx, ey2); ey2 += ptToMm(14)
        pdf.setFontSize(10)
      }
      if (companyPhone) { pdf.text(`${locale === 'pt' ? 'Tel' : 'Tél'} : ${companyPhone}`, emTx, ey2); ey2 += ptToMm(14) }
      if (companyEmail) { pdf.text(`E-mail : ${companyEmail}`, emTx, ey2); ey2 += ptToMm(14) }
      if (tvaEnabled && tvaNumber) { pdf.text(`TVA Intra. : ${tvaNumber}`, emTx, ey2); ey2 += ptToMm(14) }
      if (companyCapital) { pdf.text(`Capital : ${companyCapital} EUR`, emTx, ey2); ey2 += ptToMm(14) }

      // Destinataire
      let dy3 = boxStartY + boxPadTop
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
      pdf.text(locale === 'pt' ? 'DESTINATÁRIO' : 'DESTINATAIRE', destTx, dy3)
      dy3 += ptToMm(18)
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
      pdf.text(clientName || '---', destTx, dy3)
      dy3 += ptToMm(14)
      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
      if (clientAddress) {
        const cAL = pdf.splitTextToSize(`Adresse : ${clientAddress}`, destMaxW)
        pdf.text(cAL, destTx, dy3); dy3 += cAL.length * ptToMm(14)
      }
      if (interventionAddress) {
        const iAL = pdf.splitTextToSize(`${locale === 'pt' ? 'Local' : 'Intervention'} : ${interventionAddress}`, destMaxW)
        pdf.text(iAL, destTx, dy3); dy3 += iAL.length * ptToMm(14)
      }
      if (clientPhone) { pdf.text(`${locale === 'pt' ? 'Tel' : 'Tél'} : ${clientPhone}`, destTx, dy3); dy3 += ptToMm(14) }
      if (clientEmail) { pdf.text(`E-mail : ${clientEmail}`, destTx, dy3); dy3 += ptToMm(14) }
      if (clientSiret) { pdf.text(`SIRET : ${clientSiret}`, destTx, dy3); dy3 += ptToMm(14) }

      y = boxStartY + boxH + 4

      // ═══ 5. TABLEAU DES DATES ═══
      const dateBoxH = ptToMm(49)  // ~17.3mm
      const dateSepY = y + ptToMm(20)  // séparateur horizontal labels/valeurs

      // Fond + bordure
      pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
      pdf.rect(mL, y, contentW, dateBoxH, 'FD')

      // Séparateurs verticaux (4 colonnes)
      const dateCols = docType === 'devis'
        ? [
            { label: locale === 'pt' ? 'DATA DE EMISSÃO' : 'DATE D\'ÉMISSION', value: docDate ? new Date(docDate).toLocaleDateString(dateLocaleStr) : '---' },
            { label: locale === 'pt' ? 'VALIDADE' : 'VALIDITÉ', value: docValidity ? `${docValidity} ${locale === 'pt' ? 'dias' : 'jours'}` : '---' },
            { label: locale === 'pt' ? 'PRAZO DE EXECUÇÃO' : 'DÉLAI D\'EXÉCUTION', value: executionDelay || '---' },
            { label: locale === 'pt' ? 'DATA PRESTAÇÃO' : 'DATE PRESTATION', value: prestationDate ? new Date(prestationDate).toLocaleDateString(dateLocaleStr) : '---' },
          ]
        : [
            { label: locale === 'pt' ? 'DATA DE EMISSÃO' : 'DATE D\'ÉMISSION', value: docDate ? new Date(docDate).toLocaleDateString(dateLocaleStr) : '---' },
            { label: locale === 'pt' ? 'DATA PRESTAÇÃO' : 'DATE PRESTATION', value: prestationDate ? new Date(prestationDate).toLocaleDateString(dateLocaleStr) : '---' },
            { label: locale === 'pt' ? 'VENCIMENTO' : 'ÉCHÉANCE', value: paymentDue ? new Date(paymentDue).toLocaleDateString(dateLocaleStr) : '---' },
            { label: locale === 'pt' ? 'MODO PAGAMENTO' : 'MODE RÈGLEMENT', value: paymentMode || '---' },
          ]

      const colW = contentW / dateCols.length
      // Séparateur horizontal
      drawHLine(mL, dateSepY, xRight, COLOR_BORDER, 0.18)
      // Séparateurs verticaux
      for (let i = 1; i < dateCols.length; i++) {
        drawVLine(mL + colW * i, y, y + dateBoxH, COLOR_BORDER, 0.18)
      }

      // Labels (ligne du haut, centrés)
      dateCols.forEach((c, i) => {
        const cx = mL + colW * i + colW / 2
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(c.label, cx, y + ptToMm(14), { align: 'center' })
      })
      // Valeurs (ligne du bas, centrées, bold)
      dateCols.forEach((c, i) => {
        const cx = mL + colW * i + colW / 2
        pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(c.value, cx, dateSepY + ptToMm(17), { align: 'center' })
      })

      y += dateBoxH + 4

      // ═══ 5b. DÉTAIL DE L'INTERVENTION (étapes) ═══
      if (devisEtapes.length > 0) {
        const etapesSorted = [...devisEtapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
        if (etapesSorted.length > 0) {
          checkPageBreak(15 + etapesSorted.length * 5)
          // Titre
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
          pdf.text(locale === 'pt' ? 'DETALHE DA INTERVENÇÃO' : 'ÉTAPES DU CHANTIER', mL + 4, y + 5.5)
          // Fond alterné header
          pdf.setFillColor(COLOR_BG_GRAY)
          pdf.rect(mL, y, contentW, 8, 'F')
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
          pdf.text(locale === 'pt' ? 'DETALHE DA INTERVENÇÃO' : 'ÉTAPES DU CHANTIER', mL + 4, y + 5.5)
          y += 12
          // Liste
          pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
          for (let i = 0; i < etapesSorted.length; i++) {
            const bgColor = i % 2 === 0 ? COLOR_WHITE : COLOR_BG_GRAY
            pdf.setFillColor(bgColor)
            pdf.rect(mL, y - 3, contentW, 5.5, 'F')
            pdf.setTextColor(COLOR_TEXT)
            pdf.text(`${i + 1}. ${etapesSorted[i].designation}`, mL + 6, y)
            y += 5.5
            if (y > pageH - 40) { pdf.addPage(); y = 20 }
          }
          y += 4
        }
      }

      // ═══ 6. TABLEAU PRESTATIONS (autoTable) ═══
      const priceLabel = tvaEnabled ? t('devis.ht') : t('devis.ttc')
      const tableHead = tvaEnabled
        ? [[t('devis.designation'), t('devis.qty'), t('devis.unit'), `${t('devis.unitPrice')} ${priceLabel}`, `${localeFormats.taxLabel} %`, `${t('devis.total')} ${priceLabel}`]]
        : [[t('devis.designation'), t('devis.qty'), t('devis.unit'), `${t('devis.unitPrice')} ${priceLabel}`, `${t('devis.total')} ${priceLabel}`]]

      const tableBody = lines.filter(l => l.description.trim()).map(l => {
        const unitStr = formatUnitForPdf(l.unit, l.customUnit)
        const cleanDesc = l.description.replace(/\s*\[[^\]]*\]/g, '').trim()
        // Séparer titre et description
        const parts = cleanDesc.split('\n')
        const title = parts[0]
        const detail = parts.slice(1).join('\n').trim()
        const displayDesc = detail ? `${title}\n${detail}` : title
        const row = [displayDesc, String(l.qty), unitStr, localeFormats.currencyFormat(l.priceHT)]
        if (tvaEnabled) row.push(`${l.tvaRate}%`)
        row.push(localeFormats.currencyFormat(l.totalHT))
        return row
      })

      if (tableBody.length === 0) {
        tableBody.push(tvaEnabled
          ? [t('devis.noLinesMessage'), '', '', '', '', '']
          : [t('devis.noLinesMessage'), '', '', '', '']
        )
      }

      const colStyles: Record<number, { cellWidth: number; halign: string }> = {
        0: { cellWidth: contentW * 0.40, halign: 'left' },
        1: { cellWidth: contentW * 0.08, halign: 'center' },
        2: { cellWidth: contentW * 0.08, halign: 'center' },
        3: { cellWidth: contentW * 0.16, halign: 'right' },
      }
      if (tvaEnabled) {
        colStyles[4] = { cellWidth: contentW * 0.10, halign: 'center' }
        colStyles[5] = { cellWidth: contentW * 0.18, halign: 'right' }
      } else {
        colStyles[4] = { cellWidth: contentW * 0.28, halign: 'right' }
      }

      const headColStyles: Record<number, { halign: string }> = {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' },
      }
      if (tvaEnabled) {
        headColStyles[4] = { halign: 'center' }
        headColStyles[5] = { halign: 'right' }
      } else {
        headColStyles[4] = { halign: 'right' }
      }

      autoTable(pdf, {
        head: tableHead,
        body: tableBody,
        startY: y,
        margin: { left: mL, right: mR },
        theme: 'plain',
        headStyles: {
          fillColor: [13, 13, 13],       // Noir #0D0D0D
          textColor: [255, 255, 255],     // Blanc
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
          halign: 'left',
          minCellHeight: ptToMm(29),     // 29pt = ~10.2mm
        },
        bodyStyles: {
          fontSize: 10,
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          textColor: [13, 13, 13],
          lineWidth: 0,
          minCellHeight: ptToMm(32),     // 32pt = ~11.3mm
        },
        alternateRowStyles: { fillColor: [245, 245, 243] },  // #F5F5F3
        columnStyles: colStyles as any,
        tableLineColor: [224, 224, 220],
        tableLineWidth: 0,
        didDrawPage: () => {},
        didParseCell: (data: any) => {
          if (data.section === 'head' && headColStyles[data.column.index]) {
            data.cell.styles.halign = headColStyles[data.column.index].halign
          }
          // Description en gris sous le titre
          if (data.section === 'body' && data.column.index === 0 && data.cell.raw) {
            const raw = String(data.cell.raw)
            if (raw.includes('\n')) {
              // On laisse autoTable gérer le multiline, mais on peut pas changer la couleur
              // La description sera affichée en gris via didDrawCell
            }
          }
          // Total ligne en bold
          const lastCol = tvaEnabled ? 5 : 4
          if (data.section === 'body' && data.column.index === lastCol) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
        willDrawCell: (data: any) => {
          // Pour les lignes alternées, dessiner le fond blanc pour les impaires
          if (data.section === 'body' && data.row.index % 2 === 0) {
            data.cell.styles.fillColor = [255, 255, 255]
          }
        },
      })

      y = (pdf as any).lastAutoTable.finalY

      // ═══ 7. SOUS-TOTAL + TVA ═══
      // Bande sous-total (fond gris, pleine largeur)
      const stH = ptToMm(27)  // ~9.5mm
      pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
      pdf.rect(mL, y, contentW, stH, 'FD')

      // Mention TVA (gauche)
      if (!tvaEnabled) {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(locale === 'pt' ? 'IVA não aplicável, art. 53.º CIVA' : 'TVA non applicable, art. 293 B CGI', mL + boxPadX, y + stH / 2 + 1)
      }

      // Sous-total (droite)
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
      const stLabel = tvaEnabled ? (locale === 'pt' ? 'Subtotal HT' : 'Sous-total HT') : (locale === 'pt' ? 'Subtotal' : 'Sous-total')
      pdf.text(stLabel, xRight - 60, y + stH / 2 + 1)
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
      pdf.text(localeFormats.currencyFormat(subtotalHT), xRight - boxPadX, y + stH / 2 + 1, { align: 'right' })

      y += stH

      // Détail TVA par taux (si TVA active)
      if (tvaEnabled) {
        // Calculer TVA par taux
        const tvaByRate: Record<number, { base: number; amount: number }> = {}
        lines.filter(l => l.description.trim()).forEach(l => {
          if (!tvaByRate[l.tvaRate]) tvaByRate[l.tvaRate] = { base: 0, amount: 0 }
          tvaByRate[l.tvaRate].base += l.totalHT
          tvaByRate[l.tvaRate].amount += l.totalHT * l.tvaRate / 100
        })
        Object.entries(tvaByRate).forEach(([rate, { base, amount }]) => {
          if (Number(rate) === 0) return
          pdf.setFillColor(COLOR_WHITE)
          pdf.rect(mL + contentW / 2, y, contentW / 2, 6, 'F')
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
          pdf.text(`TVA ${rate}% sur ${localeFormats.currencyFormat(base)}`, xRight - 60, y + 4)
          pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
          pdf.text(localeFormats.currencyFormat(amount), xRight - boxPadX, y + 4, { align: 'right' })
          y += 6
        })
      }

      // Remise (si applicable)
      if (discount) {
        pdf.setFillColor(COLOR_WHITE)
        pdf.rect(mL + contentW / 2, y, contentW / 2, 6, 'F')
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(locale === 'pt' ? 'Desconto' : 'Remise', xRight - 60, y + 4)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`-${discount}`, xRight - boxPadX, y + 4, { align: 'right' })
        y += 6
      }

      // ═══ 8. BLOC TOTAL NET ═══
      y += 4  // même gap que sous TOTAL NET → BON POUR ACCORD

      const totalVal = tvaEnabled ? totalTTC : subtotalHT
      const totBoxX = boxX_dest
      const totBoxW = destBoxW
      const totH = ptToMm(27)  // ~9.5mm

      pdf.setFillColor(COLOR_BG_GRAY)
      pdf.rect(totBoxX, y, totBoxW, totH, 'F')
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
      const totalLabel = tvaEnabled ? (locale === 'pt' ? 'TOTAL TTC' : 'TOTAL TTC') : (locale === 'pt' ? 'TOTAL' : 'TOTAL NET')
      pdf.text(totalLabel, totBoxX + boxPadX, y + totH / 2 + 1.5)
      pdf.text(localeFormats.currencyFormat(totalVal), totBoxX + totBoxW - boxPadX, y + totH / 2 + 1.5, { align: 'right' })

      y += totH + 6

      // ═══ 9. CONDITIONS + BON POUR ACCORD + ACOMPTES (devis) ou RÈGLEMENT (facture) ═══
      checkPageBreak(55)

      if (docType === 'devis') {
        const condX = mL
        const condW = emBoxW
        const sigX = boxX_dest
        const sigW = destBoxW
        const condStartY = y

        // ── CONDITIONS (côté gauche, fond blanc, pas de bordure) ──
        pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text('CONDITIONS', condX, condStartY + 5)
        let cy = condStartY + 12

        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        const validityStr = docValidity ? `${docValidity} ${locale === 'pt' ? 'dias' : 'jours'}` : `30 ${locale === 'pt' ? 'dias' : 'jours'}`
        const condTextLines = [
          t('devis.pdf.validityCondition').replace('{validity}', validityStr),
          ...(executionDelay ? [t('devis.pdf.executionDelayCondition').replace('{delay}', executionDelay)] : []),
          t('devis.pdf.amendmentClause'),
          ...(paymentMode ? [t('devis.pdf.paymentModeCondition').replace('{mode}', paymentMode)] : []),
          ...(iban ? [`IBAN : ${iban}${bic ? ` | BIC : ${bic}` : ''}`] : []),
        ]
        condTextLines.forEach(line => {
          const wrapped = pdf.splitTextToSize(line, condW - 4)
          pdf.text(wrapped, condX, cy)
          cy += wrapped.length * ptToMm(13)
        })
        if (notes) {
          cy += 2
          pdf.setFont('helvetica', 'italic')
          const noteWrapped = pdf.splitTextToSize(notes, condW - 4)
          pdf.text(noteWrapped, condX, cy)
          cy += noteWrapped.length * ptToMm(13)
        }

        // ── BON POUR ACCORD (côté droit, fond gris, bordure) ──
        const sigContentH = Math.max(cy - condStartY, 46)
        // Fond gris
        pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
        pdf.rect(sigX, condStartY, sigW, sigContentH, 'FD')

        // Titre
        pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text('BON POUR ACCORD', sigX + boxPadX, condStartY + 5)

        let sy = condStartY + 12
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        const approvalText = locale === 'pt'
          ? 'Orçamento recebido antes da execução dos trabalhos, lido e aprovado, bom para acordo.'
          : 'Devis reçu avant exécution des travaux, lu et approuvé, bon pour accord.'
        const appWrapped = pdf.splitTextToSize(approvalText, sigW - boxPadX * 2)
        pdf.text(appWrapped, sigX + boxPadX, sy)
        sy += appWrapped.length * ptToMm(13) + 4

        if (signatureData) {
          // Signature électronique
          try {
            const sigImgDataUrl = await svgToImageDataUrl(signatureData.svg_data, 400, 140)
            const sigImgW = sigW - boxPadX * 2 - 10
            const sigImgH = sigImgW * (140 / 400)
            pdf.addImage(sigImgDataUrl, 'PNG', sigX + boxPadX, sy, sigImgW, sigImgH)
            sy += sigImgH + 2
            pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
            pdf.text(signatureData.signataire, sigX + boxPadX, sy)
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
            pdf.text(new Date(signatureData.timestamp).toLocaleString(dateLocaleStr), sigX + boxPadX, sy + 3)
            sy += 8
            // Audit trail eIDAS
            pdf.setFontSize(4.5); pdf.setTextColor('#9CA3AF')
            pdf.text(`SHA-256: ${signatureData.hash_sha256.substring(0, 32)}...`, sigX + boxPadX, sy)
            pdf.text(locale === 'pt' ? 'Assinatura eletrónica simples art. 25.1 eIDAS' : 'Signature électronique simple art. 25.1 eIDAS', sigX + boxPadX, sy + 2.5)
          } catch {
            pdf.setFontSize(9); pdf.setTextColor(COLOR_TEXT)
            pdf.text(signatureData.signataire, sigX + boxPadX, sy)
          }
        } else {
          // Zones vierges
          pdf.text(`Date : ___ / ___ / ______`, sigX + boxPadX, sy)
          sy += ptToMm(18)
          pdf.text(`Signature :`, sigX + boxPadX, sy)
        }

        y = condStartY + sigContentH + 4

        // ═══ ACOMPTES — carré gris sous BON POUR ACCORD (côté droit) ═══
        if (acomptesEnabled && acomptes.length > 0) {
          const acompteTotal = tvaEnabled ? totalTTC : subtotalHT
          const validAcomptes = acomptes.filter(ac => ac.pourcentage > 0)
          if (validAcomptes.length > 0) {
            const acBlockH = 12 + validAcomptes.length * ptToMm(13) + 4
            checkPageBreak(acBlockH + 4)
            // Carré gris — même largeur et x que BON POUR ACCORD
            pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
            pdf.rect(sigX, y, sigW, acBlockH, 'FD')
            // Titre — même espacement que BON POUR ACCORD
            pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
            pdf.text(locale === 'pt' ? 'PAGAMENTO FASEADO' : 'ÉCHÉANCIER DE PAIEMENT', sigX + boxPadX, y + 5)
            let ay = y + 12
            // Lignes acomptes
            pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
            for (const ac of validAcomptes) {
              const montant = acompteTotal * ac.pourcentage / 100
              const label = ac.label || `${locale === 'pt' ? 'Adiantamento' : 'Acompte'} ${ac.ordre}`
              pdf.text(`${label} : ${ac.pourcentage}% ${ac.declencheur}`, sigX + boxPadX, ay)
              pdf.setFont('helvetica', 'bold')
              pdf.text(localeFormats.currencyFormat(montant), sigX + sigW - boxPadX, ay, { align: 'right' })
              pdf.setFont('helvetica', 'normal')
              ay += ptToMm(13)
            }
            y += acBlockH + 4
          }
        }

      } else if (docType === 'facture') {
        // ── Section RÈGLEMENT pour facture ──
        const payLines: string[] = []
        if (paymentCondition) payLines.push(paymentCondition)
        if (paymentMode) payLines.push(t('devis.pdf.paymentModeLabel').replace('{mode}', paymentMode))
        if (paymentDue) payLines.push(t('devis.pdf.paymentDueLabel').replace('{date}', new Date(paymentDue).toLocaleDateString(dateLocaleStr)))
        if (iban) payLines.push(bic ? t('devis.pdf.ibanBicLabel').replace('{iban}', iban).replace('{bic}', bic) : t('devis.pdf.ibanLabel').replace('{iban}', iban))
        payLines.push(t('devis.pdf.latePenalties'))
        if (discount) payLines.push(t('devis.pdf.earlyDiscountYes').replace('{discount}', discount))
        else payLines.push(t('devis.pdf.earlyDiscountNo'))
        if (sourceDevisRef) {
          const datePart = prestationDate ? ` ${locale === 'pt' ? 'com data de' : 'en date du'} ${new Date(prestationDate).toLocaleDateString(dateLocaleStr)}` : ''
          payLines.push(t('devis.pdf.invoiceFromDevis').replace('{ref}', sourceDevisRef).replace('{date}', datePart))
        } else if (notes && (notes.includes('Réf. devis') || notes.includes('Ref. orçamento'))) {
          const devisRef = notes.match(/(?:Réf\. devis|Ref\. orçamento)\s*:\s*([^\n]+)/)?.[1]?.trim()
          if (devisRef) payLines.push(t('devis.pdf.invoiceFromDevis').replace('{ref}', devisRef).replace('{date}', ''))
        }
        payLines.push(t('devis.pdf.contestationClause'))

        const condStartY = y
        let measureY = condStartY + 10
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
        payLines.forEach(line => {
          const wrapped = pdf.splitTextToSize(line, contentW - 8)
          measureY += wrapped.length * ptToMm(13) + 0.5
        })
        const condH = Math.max(measureY - condStartY + 2, 20)

        pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
        pdf.rect(mL, condStartY, contentW, condH, 'FD')

        pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(locale === 'pt' ? 'CONDIÇÕES DE PAGAMENTO' : 'CONDITIONS DE RÈGLEMENT', mL + boxPadX, condStartY + 5)

        let cy = condStartY + 12
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        payLines.forEach(line => {
          const wrapped = pdf.splitTextToSize(line, contentW - boxPadX * 2)
          pdf.text(wrapped, mL + boxPadX, cy)
          cy += wrapped.length * ptToMm(13) + 0.5
        })
        y = condStartY + condH + 4
      }

      // ═══ 10. RAPPORT JOINT (optionnel) ═══
      if (attachedRapport && !checkPageBreak(20)) {
        pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
        const rapportTextLines: string[] = []
        rapportTextLines.push(t('devis.pdf.attachedReport').replace('{number}', attachedRapport.rapportNumber))
        if (attachedRapport.interventionDate) rapportTextLines.push(t('devis.pdf.reportDate').replace('{date}', new Date(attachedRapport.interventionDate).toLocaleDateString(dateLocaleStr)) + (attachedRapport.startTime ? ` ${locale === 'pt' ? 'das' : 'de'} ${attachedRapport.startTime}` : '') + (attachedRapport.endTime ? ` ${locale === 'pt' ? 'às' : 'à'} ${attachedRapport.endTime}` : ''))
        if (attachedRapport.motif) rapportTextLines.push(t('devis.pdf.reportMotif').replace('{motif}', attachedRapport.motif))
        if (attachedRapport.siteAddress) rapportTextLines.push(t('devis.pdf.reportLocation').replace('{location}', attachedRapport.siteAddress))
        const rapH = rapportTextLines.length * 4 + 4
        pdf.rect(mL, y, contentW, rapH, 'FD')
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(rapportTextLines[0], mL + boxPadX, y + 4)
        pdf.setFont('helvetica', 'normal')
        rapportTextLines.slice(1).forEach((rl, i) => pdf.text(rl, mL + boxPadX, y + 4 + (i + 1) * 3.5))
        y += rapH + 4
      }

      // ═══ 11. PT FISCAL: QR CODE + CERTIFICATION ═══
      if (ptFiscalData) {
        checkPageBreak(35)
        const qrSize = 28
        const qrX = pageW - mR - qrSize
        const qrY = y
        try {
          const QRCode = (await import('qrcode')).default
          const qrDataUrl = await QRCode.toDataURL(ptFiscalData.qrCodeString, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
          pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
        } catch {
          pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.3)
          pdf.rect(qrX, qrY, qrSize, qrSize)
          pdf.setFontSize(5); pdf.setTextColor(COLOR_TEXT_LIGHT)
          pdf.text('QR Code', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' })
        }
        const certY = qrY + 2
        pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#1D4ED8')
        pdf.text(ptFiscalData.atcudDisplay, mL, certY)
        pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(`Hash: ${ptFiscalData.hashDisplay}`, mL, certY + 3.5)
        pdf.text(`Processado por programa certificado n.º ${ptFiscalData.certNumber}`, mL, certY + 7)
        pdf.text('Vitfix Pro — https://vitfix.pt', mL, certY + 10.5)
        y = qrY + qrSize + 4
      }

      // ═══ 12. MENTIONS LÉGALES ═══
      checkPageBreak(25)
      // Trait séparateur optionnel
      drawHLine(mL, y, xRight, COLOR_BORDER, 0.18)
      y += 3

      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)

      // Ligne 1 : Statut + TVA + Assurance
      const statusLabel = getStatusLabel(companyStatus, t)
      let legal1 = `${statusLabel}.`
      if (companyStatus === 'ei') legal1 += ' Loi n°2022-172 du 14 février 2022.'
      if (!tvaEnabled) {
        legal1 += locale === 'pt' ? ' IVA não aplicável, artigo 53.º do CIVA.' : ' TVA non applicable, article 293 B du CGI.'
      } else if (tvaNumber) {
        legal1 += ` TVA intracommunautaire : ${tvaNumber}.`
      }
      if (insuranceName) {
        const insLabel = insuranceType === 'rc_pro' ? 'RC Pro' : insuranceType === 'decennale' ? 'Décennale' : 'RC Pro + Décennale'
        legal1 += ` ${insLabel} ${insuranceName}, contrat n° ${insuranceNumber || 'N/A'}, couverture ${insuranceCoverage || 'France métropolitaine'}.`
      }

      // Ligne 2 : Devis gratuit + rétractation
      let legal2 = locale === 'pt'
        ? 'Orçamento gratuito, conforme o artigo 8.º da Lei n.º 24/96.'
        : 'Devis gratuit, conformément à l\'article L. 111-1 du Code de la consommation.'
      if (isHorsEtablissement && clientSiret.trim().length === 0) {
        legal2 += locale === 'pt'
          ? ' Direito de retratação: 14 dias (Lei n.º 24/96, art. 8.º).'
          : ' Droit de rétractation : 14 jours calendaires à compter de la signature (art. L. 221-18 C. conso.).'
      }

      // Ligne 3 : Paiement + médiation
      let legal3 = ''
      if (isHorsEtablissement && clientSiret.trim().length === 0) {
        legal3 += locale === 'pt'
          ? 'Nenhum pagamento exigível antes de 7 dias após assinatura (Lei n.º 24/96), salvo trabalhos urgentes.'
          : 'Aucun paiement exigible avant 7 jours après signature (art. L. 221-10 C. conso.), sauf travaux urgents.'
      }
      if (locale === 'pt') {
        legal3 += ' Resolução alternativa de litígios (Lei n.º 144/2015).'
      } else {
        legal3 += ' Médiation de la consommation (art. L. 612-1 C. conso.).'
      }
      if (mediatorName) {
        legal3 += ` ${mediatorName}${mediatorUrl ? ` — ${mediatorUrl}` : ''}.`
      }

      // Ligne 4 : Générateur
      const legal4 = `Document généré par Vitfix Pro le ${new Date().toLocaleDateString(dateLocaleStr)}.`

      const fullLegal = `${legal1} ${legal2} ${legal3} ${legal4}`
      const legalWrapped = pdf.splitTextToSize(fullLegal, ptFiscalData ? contentW - 32 : contentW)
      pdf.text(legalWrapped, mL, y)
      y += legalWrapped.length * ptToMm(10)

      // ═══ PAGE 2 — RÉTRACTATION ═══
      if (docType === 'devis' && isHorsEtablissement && clientSiret.trim().length === 0) {
        pdf.addPage()
        let ry = 8

        // Ligne d'accent or en haut
        pdf.setFillColor(COLOR_ACCENT)
        pdf.rect(mL, ry, contentW, ptToMm(3), 'F')
        ry += ptToMm(3) + 8

        // Titre
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(locale === 'pt' ? 'DIREITO DE RETRATAÇÃO' : 'DROIT DE RÉTRACTATION', mL, ry)
        ry += 5
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(locale === 'pt' ? 'Lei n.º 24/96, artigo 8.º' : 'Article L. 221-18 du Code de la consommation', mL, ry)
        ry += 8

        // Texte légal
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        const retTexts = [
          t('devis.pdf.withdrawalText1'),
          t('devis.pdf.withdrawalText2'),
          t('devis.pdf.withdrawalPayment'),
        ]
        retTexts.forEach(txt => {
          const wrapped = pdf.splitTextToSize(txt, contentW)
          pdf.text(wrapped, mL, ry)
          ry += wrapped.length * ptToMm(13) + 4
        })

        ry += 4

        // Formulaire de rétractation
        // Bandeau noir header
        pdf.setFillColor(COLOR_TEXT)
        pdf.rect(mL, ry, contentW, 8, 'F')
        pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_WHITE)
        pdf.text(locale === 'pt' ? 'FORMULÁRIO DE RETRATAÇÃO' : 'FORMULAIRE DE RÉTRACTATION', mL + boxPadX, ry + 5.5)
        ry += 12

        // Contenu formulaire
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        const formAttention = locale === 'pt'
          ? `À atenção de : ${companyName}, ${companyAddress}`
          : `À l'attention de : ${companyName}, ${companyAddress}`
        pdf.setFont('helvetica', 'normal')
        const attParts = formAttention.split(companyName)
        pdf.text(attParts[0], mL + boxPadX, ry)
        const atW = pdf.getTextWidth(attParts[0])
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${companyName}${attParts[1] || ''}`, mL + boxPadX + atW, ry)
        ry += 6

        pdf.setFont('helvetica', 'normal')
        const noticeText = locale === 'pt'
          ? 'Notifico pela presente a minha retratação do contrato relativo à prestação de serviços acima.'
          : 'Je notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessus.'
        pdf.text(noticeText, mL + boxPadX, ry)
        ry += 8

        const formFields = [
          locale === 'pt' ? 'Encomendado em / recebido em :' : 'Commandé le / reçu le :',
          locale === 'pt' ? 'Nome do cliente :' : 'Nom du client :',
          locale === 'pt' ? 'Morada :' : 'Adresse :',
          'Date : ___ / ___ / ______',
          'Signature :',
        ]
        formFields.forEach(f => {
          pdf.text(f, mL + boxPadX, ry)
          if (!f.startsWith('Date') && !f.startsWith('Signature')) {
            const fw = pdf.getTextWidth(f) + 2
            drawHLine(mL + boxPadX + fw, ry + 0.5, xRight - boxPadX, COLOR_BORDER, 0.2)
          }
          ry += 8
        })
      }

      // ═══ ANNEXE PHOTOS CHANTIER ═══
      if (selectedPhotos.length > 0) {
        // Load all selected photos as base64 images
        const loadImage = (url: string): Promise<HTMLImageElement> => {
          return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('Image load failed'))
            img.src = url
          })
        }

        // Photo annexe page(s)
        pdf.addPage()
        let py = 18
        pdf.setFillColor(COLOR_ACCENT)
        pdf.rect(mL, py - 4, contentW, ptToMm(3), 'F')
        py += 2
        pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(`${docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')} ${docNumber} — ${t('devis.pdf.annexePhotos')}`, pageW / 2, py, { align: 'center' })
        py += 5
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(t('devis.pdf.photosGeotagged').replace('{count}', String(selectedPhotos.length)), pageW / 2, py, { align: 'center' })
        py += 8

        // 2 columns layout, 3 rows per page max = 6 photos per page
        const photoW = (contentW - 6) / 2  // ~84mm each
        const photoH = 60  // 60mm height per photo
        const photoGap = 4
        let col2 = 0

        for (let i = 0; i < selectedPhotos.length; i++) {
          const photo = selectedPhotos[i]

          // Check if we need a new page
          if (py + photoH + 12 > pageH - 10 && col2 === 0) {
            pdf.addPage()
            py = 18
            pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
            pdf.text(`${docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')} ${docNumber} — ${t('devis.pdf.annexePhotosSuite')}`, pageW / 2, py, { align: 'center' })
            py += 8
          }

          const x = mL + col2 * (photoW + photoGap)

          try {
            const img = await loadImage(photo.url)
            // Draw photo border
            pdf.setDrawColor('#E5E7EB'); pdf.setLineWidth(0.3)
            pdf.roundedRect(x, py, photoW, photoH + 10, 1.5, 1.5, 'S')

            // Draw photo
            const imgRatio = img.width / img.height
            let drawW = photoW - 4
            let drawH = photoH - 2
            if (imgRatio > drawW / drawH) {
              drawH = drawW / imgRatio
            } else {
              drawW = drawH * imgRatio
            }
            const imgX = x + (photoW - drawW) / 2
            const imgY = py + 1 + (photoH - 2 - drawH) / 2

            // Convert image to canvas → base64 (haute résolution professionnelle)
            const canvas = document.createElement('canvas')
            // Résolution max 2400px pour qualité professionnelle d'impression (300 DPI sur A4)
            const maxRes = 2400
            canvas.width = Math.min(img.width, maxRes)
            canvas.height = Math.round(canvas.width / imgRatio)
            const ctx = canvas.getContext('2d')
            if (ctx) {
              // Anti-aliasing haute qualité
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              // JPEG qualité 0.92 pour un rendu professionnel sans artefacts de compression
              const imgData = canvas.toDataURL('image/jpeg', 0.92)
              pdf.addImage(imgData, 'JPEG', imgX, imgY, drawW, drawH)
            }

            // Photo info below
            const infoY = py + photoH + 1
            pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
            const dateStr = photo.taken_at ? new Date(photo.taken_at).toLocaleString(dateLocaleStr) : 'N/D'
            pdf.text(`📅 ${dateStr}`, x + 2, infoY + 2)
            if (photo.lat && photo.lng) {
              pdf.text(`📍 ${Number(photo.lat).toFixed(5)}, ${Number(photo.lng).toFixed(5)}`, x + 2, infoY + 5.5)
            }
            if (photo.label) {
              pdf.setFont('helvetica', 'bold')
              const labelTrunc = photo.label.length > 35 ? photo.label.substring(0, 35) + '...' : photo.label
              pdf.text(labelTrunc, x + photoW / 2, infoY + 2, { align: 'center' })
            }
          } catch {
            // If image fails to load, show placeholder
            pdf.setFillColor('#F3F4F6')
            pdf.roundedRect(x, py, photoW, photoH + 10, 1.5, 1.5, 'FD')
            pdf.setFontSize(7); pdf.setTextColor('#9CA3AF')
            pdf.text(t('devis.pdf.photoNotAvailable'), x + photoW / 2, py + photoH / 2, { align: 'center' })
          }

          col2++
          if (col2 >= 2) {
            col2 = 0
            py += photoH + 12 + photoGap
          }
        }
      }

      const safeName = clientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_À-ÿ]/g, '') || 'Client'
      const fileLabel = docType === 'devis' ? (locale === 'pt' ? 'Orcamento' : 'Devis') : (locale === 'pt' ? 'Fatura' : 'Facture')
      // PT: utiliser le numéro AT (ex: "FT VTF/1") sanitisé pour le nom de fichier; FR: numéro interne
      const fileDocNumber = (locale === 'pt' && ptFiscalData?.docNumber)
        ? ptFiscalData.docNumber.replace(/\s+/g, '_').replace(/\//g, '-')
        : docNumber
      const filename = `${fileLabel}_${fileDocNumber}_${safeName}.pdf`
      pdf.save(filename)

      // Auto-sauvegarder le template de settings pour les prochains devis
      if (artisan?.id) {
        try {
          const template = {
            companyStatus, companyRCS, companyCapital,
            insuranceNumber, insuranceName, insuranceCoverage, insuranceType,
            mediatorName, mediatorUrl,
            tvaEnabled, tvaNumber,
            iban, bic,
          }
          localStorage.setItem(`fixit_devis_template_${artisan.id}`, JSON.stringify(template))
        } catch {}
      }

      // Auto-sauvegarder le document dans l'historique à chaque génération PDF
      const data = buildData()
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      // Éviter les doublons : remplacer si même numéro existe déjà
      const existingIdx = docs.findIndex((d: Record<string, unknown>) => d.docNumber === data.docNumber)
      const docEntry = { ...data, savedAt: new Date().toISOString(), status: 'envoye' as const, sentAt: new Date().toISOString() }
      if (existingIdx >= 0) {
        docs[existingIdx] = docEntry
      } else {
        docs.push(docEntry)
      }
      localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(docs))
      onSave?.(data)

      // Proposer envoi par email ou Vitfix si clientEmail ou booking lié
      if (clientEmail || linkedBookingId) {
        setTimeout(() => {
          setShowSendModal('pdf')
        }, 600)
      }
    } catch (err) {
      console.error('Erreur PDF:', err)
      setSavedMsg(`❌ ${t('devis.pdfErrorTitle')}`)
      setTimeout(() => setSavedMsg(''), 4000)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleValidateAndSend = () => {
    if (!allCompliant) {
      const missing: string[] = []
      if (!compliance.siret) missing.push(t('devis.complianceSiret'))
      if (!compliance.rcs) missing.push(t('devis.complianceRcs'))
      if (!compliance.insurance) missing.push(t('devis.missingInsurance'))
      if (!compliance.client) missing.push(t('devis.missingClientName'))
      if (!compliance.lines) missing.push(t('devis.missingLines'))
      if ('capital' in compliance && !compliance.capital) missing.push(`${t('devis.missingCapital')} ${getStatusLabel(companyStatus, t)})`)
      if ('tvaNumber' in compliance && !compliance.tvaNumber) missing.push(t('devis.missingTvaNumber'))
      setSavedMsg(`❌ ${t('devis.missingInfo')} : ${missing.join(', ')}`)
      setTimeout(() => setSavedMsg(''), 5000)
      return
    }
    setShowSendModal('validate')
  }

  // ─── Save document helper (used by both send methods in validate mode) ───
  const saveAndFinalize = (mode: 'pdf' | 'validate' | null) => {
    if (mode === 'validate') {
      const data = buildData()
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
      docs.push({ ...data, savedAt: new Date().toISOString(), status: 'envoye', sentAt: new Date().toISOString() })
      localStorage.setItem(`fixit_documents_${artisan?.id}`, JSON.stringify(docs))
      onSave?.(data)
    }
    setShowSendModal(null)
    if (mode === 'validate') onBack()
  }

  // ─── Send via Email ───
  const handleSendViaEmail = () => {
    const currentMode = showSendModal
    const totalVal = tvaEnabled ? totalTTC : subtotalHT
    const totalStr = `${localeFormats.currencyFormat(totalVal)} ${tvaEnabled ? t('devis.ttc') : t('devis.ht')}`
    const docTypeLabel = docType === 'devis' ? t('devis.emailSubjectDevis') : t('devis.emailSubjectFacture')
    const subject = encodeURIComponent(`${docTypeLabel} ${docNumber} — ${companyName}`)
    const emailBody = t('devis.emailBody')
      .replace('{clientName}', clientName)
      .replace('{docType}', docTypeLabel.toLowerCase())
      .replace('{docNumber}', docNumber)
      .replace('{total}', totalStr)
      .replace('{companyName}', companyName + (companyPhone ? '\n' + companyPhone : ''))
    const body = encodeURIComponent(emailBody)
    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`)
    saveAndFinalize(currentMode)
  }

  // ─── Send via Vitfix Channel ───
  const handleSendViaVitfix = async () => {
    if (!linkedBookingId) {
      setSavedMsg(`⚠️ ${t('devis.sendNoBooking')}`)
      setTimeout(() => setSavedMsg(''), 4000)
      return
    }
    const currentMode = showSendModal
    setSendingVitfix(true)
    try {
      const headers = await getAuthHeaders()
      const totalVal = tvaEnabled ? totalTTC : subtotalHT
      const totalStr = `${localeFormats.currencyFormat(totalVal)} ${tvaEnabled ? t('devis.ttc') : t('devis.ht')}`
      const typeLabel = docType === 'devis' ? t('devis.emailSubjectDevis') : t('devis.emailSubjectFacture')

      const messageContent = `📄 ${typeLabel} N°${docNumber} — ${totalStr}`

      const res = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          booking_id: linkedBookingId,
          content: messageContent,
          type: docType === 'devis' ? 'devis_sent' : 'text',
          metadata: docType === 'devis' ? {
            docNumber,
            docTitle,
            totalStr,
            docType,
            prestationDate,
            executionDelayDays,
            executionDelayType,
            artisan_id: artisan?.id,
            companyName,
          } : undefined,
        }),
      })

      if (!res.ok) throw new Error('Erreur envoi')

      setSavedMsg(`✅ ${typeLabel} ${t('devis.sendSuccess')}`)
      setTimeout(() => setSavedMsg(''), 3000)
      saveAndFinalize(currentMode)
    } catch (err) {
      console.error('Erreur envoi Vitfix:', err)
      setSavedMsg(`❌ ${t('devis.sendError')}`)
      setTimeout(() => setSavedMsg(''), 4000)
    } finally {
      setSendingVitfix(false)
    }
  }

  const buildData = (): DevisFactureData => ({
    docType,
    docNumber,
    docTitle,
    companyStatus,
    companyName,
    companySiret,
    companyAddress,
    companyRCS,
    companyCapital,
    companyPhone,
    companyEmail,
    insuranceNumber,
    insuranceName,
    insuranceCoverage,
    insuranceType,
    mediatorName,
    mediatorUrl,
    isHorsEtablissement,
    tvaEnabled,
    tvaNumber,
    clientName,
    clientEmail,
    clientAddress,
    interventionAddress,
    clientPhone,
    clientSiret,
    docDate,
    docValidity,
    prestationDate,
    executionDelay,
    executionDelayDays: typeof executionDelayDays === 'number' ? executionDelayDays : 0,
    executionDelayType,
    paymentMode,
    paymentDue,
    paymentCondition,
    discount,
    iban,
    bic,
    lines,
    etapes: devisEtapes.length > 0 ? devisEtapes : undefined,
    notes,
    acomptesEnabled,
    acomptes: acomptesEnabled && acomptes.length > 0 ? acomptes : undefined,
  })

  // ─── Recent interventions for quick import ───
  const recentBookings = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .slice(0, 10)

  // ─── Locked field style ───
  const lockedFieldClass = 'v22-form-input'
  const lockedFieldStyle: React.CSSProperties = { background: 'var(--v22-bg)', color: 'var(--v22-text-mid)', cursor: 'not-allowed' }
  const normalFieldClass = 'v22-form-input'

  // Are legal fields locked? (verified = data comes from official source)
  const isLegalLocked = companyVerified || !!verifiedCompany?.legalForm

  return (
    <div>
      {/* Top header */}
      <div className="v22-page-header" style={{ margin: 0, padding: '10px 16px', borderBottom: '1px solid var(--v22-border)', background: 'var(--v22-surface)' }}>
        <button onClick={onBack} className="v22-btn v22-btn-ghost v22-btn-sm">← {t('devis.back')}</button>
        <span className="v22-page-title" style={{ fontSize: '14px' }}>
          {docType === 'devis' ? t('devis.newDevis') : t('devis.newFacture')}
          {docTitle && <span className="v22-ref" style={{ fontWeight: 400, marginLeft: 8 }}>— {docTitle}</span>}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Bouton Passer en facture (affiché uniquement en mode devis) */}
          {docType === 'devis' && (
            <button
              onClick={() => {
                if (confirm(t('devis.convertConfirm'))) {
                  setDocType('facture')
                  if (!prestationDate) setPrestationDate(today)
                  const devisRefLabel = locale === 'pt' ? 'Ref. orçamento' : 'Réf. devis'
                  if (!notes.includes('Réf. devis') && !notes.includes('Ref. orçamento')) {
                    setNotes((prev: string) => `${devisRefLabel}: ${docNumber}${prev ? '\n' + prev : ''}`)
                  }
                }
              }}
              className="v22-btn v22-btn-green v22-btn-sm"
            >
              {t('devis.convertToFacture')}
            </button>
          )}
          <div className="v22-tabs">
            <button
              onClick={() => setDocType('devis')}
              className={`v22-tab ${docType === 'devis' ? 'active' : ''}`}
            >
              {t('devis.devisTab')}
            </button>
            <button
              onClick={() => setDocType('facture')}
              className={`v22-tab ${docType === 'facture' ? 'active' : ''}`}
            >
              {t('devis.factureTab')}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

          {/* ═══════════ LEFT: FORM ═══════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Header */}
            <div className="v22-card">
              <div className="v22-card-head" style={{ borderBottomWidth: 2, borderBottomColor: 'var(--v22-yellow)' }}>
                <span className="v22-card-title" style={{ fontSize: 13 }}>
                  {docType === 'devis' ? t('devis.newDevis') : t('devis.newFacture')}
                </span>
                <span className="v22-card-meta">{docNumber}</span>
              </div>
              <div className="v22-card-body">
                {/* Titre / Objet du document */}
                <div className="v22-form-group">
                  <label className="v22-form-label">
                    {t('devis.titleLabel')} {docType === 'devis' ? t('devis.titleLabelDevis') : t('devis.titleLabelFacture')}
                    <span style={{ color: 'var(--v22-text-muted)', fontWeight: 400, marginLeft: 4 }}>{t('devis.titleHint')}</span>
                  </label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    placeholder={t('devis.titlePlaceholder')}
                    className="v22-form-input"
                    style={{ borderColor: 'var(--v22-yellow)', fontWeight: 500 }}
                  />
                </div>

                {/* Legal warning */}
                <div className="v22-alert v22-alert-red" style={{ marginBottom: 12, cursor: 'default' }}>
                  <div>
                    <strong style={{ color: 'var(--v22-red)' }}>{t('devis.legalComplianceTitle')}</strong>
                    <div style={{ fontSize: 11, color: 'var(--v22-red)', marginTop: 2 }}>{t('devis.legalComplianceDesc')}</div>
                  </div>
                </div>

                {/* Quick import */}
                <div className="v22-alert v22-alert-amber" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="v22-card-title" style={{ textTransform: 'none', fontSize: 12 }}>{t('devis.quickImportTitle')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--v22-amber)', marginBottom: 8 }}>{t('devis.quickImportDesc')}</div>
                  {recentBookings.length > 0 ? (
                    <div style={{ position: 'relative' }}>
                      <select
                        onChange={(e) => importFromBooking(e.target.value)}
                        disabled={importingBooking}
                        className="v22-form-input"
                        style={{ cursor: 'pointer' }}
                        defaultValue=""
                      >
                        <option value="">{t('devis.quickImportPlaceholder')}</option>
                        {recentBookings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.booking_date} {b.booking_time?.substring(0, 5)} – {b.services?.name || 'Prestation'} – {formatPrice(b.price_ttc ?? 0)}
                          </option>
                        ))}
                      </select>
                      {importingBooking && (
                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--v22-amber)' }}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--v22-amber)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          {t('devis.loading')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--v22-surface)', borderRadius: 3, padding: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--v22-amber)' }}>{t('devis.quickImportNone')}</div>
                      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4 }}>{t('devis.quickImportNoneHint')}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Section: Entreprise ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.companySection')}</span>
              </div>
              <div className="v22-card-body">
                {/* Verified company banner */}
                {loadingCompany ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--v22-bg)', borderRadius: 3, marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--v22-yellow)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    <span style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>{t('devis.loadingCompanyInfo')}</span>
                  </div>
                ) : isLegalLocked ? (
                  <div className="v22-alert v22-alert-green" style={{ marginBottom: 12, cursor: 'default' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span className="v22-tag v22-tag-green">{t('devis.verifiedDataTitle')}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--v22-green)' }}>{t('devis.verifiedDataDesc')}</div>
                      {officialLegalForm && (
                        <div className="v22-ref" style={{ marginTop: 4 }}>
                          {t('devis.verifiedDataSource')} : {officialLegalForm} — {localeFormats.taxIdLabel} {companySiret}
                          {companyNafLabel && ` — ${companyNafLabel}`}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="v22-alert v22-alert-amber" style={{ marginBottom: 12, cursor: 'default' }}>
                    <div>
                      <strong style={{ color: 'var(--v22-amber)' }}>{t('devis.unverifiedDataTitle')}</strong>
                      <span style={{ fontSize: 11, color: 'var(--v22-amber)' }}> — {t('devis.unverifiedDataDesc')}</span>
                    </div>
                  </div>
                )}

                {/* Statut juridique — LOCKED if verified */}
                <div className="v22-form-group">
                  <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t('devis.legalStatus')} <span style={{ color: 'var(--v22-red)' }}>*</span>
                    {isLegalLocked && <span className="v22-tag v22-tag-green">{t('devis.verified')}</span>}
                  </label>
                  {isLegalLocked ? (
                    <div>
                      <div className={lockedFieldClass} style={{ ...lockedFieldStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>{officialLegalForm || getStatusLabel(companyStatus, t)}</span>
                        <span className="v22-tag v22-tag-gray">{t('devis.notEditable')}</span>
                      </div>
                      <input type="hidden" value={companyStatus} />
                    </div>
                  ) : (
                    <select value={companyStatus} onChange={(e) => setCompanyStatus(e.target.value)}
                      className={normalFieldClass}>
                      {getCompanyStatuses(locale).map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  {/* Nom commercial — LOCKED if verified */}
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t('devis.companyName')} <span style={{ color: 'var(--v22-red)' }}>*</span>
                      {isLegalLocked && <span className="v22-tag v22-tag-green">{t('devis.verified')}</span>}
                    </label>
                    <input type="text" value={companyName}
                      onChange={isLegalLocked ? undefined : (e) => setCompanyName(e.target.value)}
                      readOnly={isLegalLocked}
                      className={lockedFieldClass}
                      style={isLegalLocked ? lockedFieldStyle : undefined} />
                  </div>
                  {/* SIRET — LOCKED if verified */}
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {localeFormats.taxIdLabel} <span style={{ color: 'var(--v22-red)' }}>*</span>
                      {isLegalLocked && <span className="v22-tag v22-tag-green">{t('devis.verified')}</span>}
                    </label>
                    <input type="text" value={companySiret}
                      onChange={isLegalLocked ? undefined : (e) => setCompanySiret(e.target.value)}
                      readOnly={isLegalLocked}
                      placeholder={t('devis.taxIdPlaceholder')}
                      className={lockedFieldClass}
                      style={isLegalLocked ? lockedFieldStyle : undefined} />
                  </div>
                </div>

                {/* SIREN (read-only display if available) */}
                {companySiren && (
                  <div className="v22-form-group">
                    <label className="v22-form-label">SIREN</label>
                    <input type="text" value={companySiren} readOnly className={lockedFieldClass} style={lockedFieldStyle} />
                  </div>
                )}

                {/* Adresse siège social — LOCKED if verified */}
                <div className="v22-form-group">
                  <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t('devis.headOfficeAddress')} <span style={{ color: 'var(--v22-red)' }}>*</span>
                    {isLegalLocked && <span className="v22-tag v22-tag-green">{t('devis.verified')}</span>}
                  </label>
                  <input type="text" value={companyAddress}
                    onChange={isLegalLocked ? undefined : (e) => setCompanyAddress(e.target.value)}
                    readOnly={isLegalLocked}
                    className={lockedFieldClass}
                    style={isLegalLocked ? lockedFieldStyle : undefined} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.registryNumber')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="text" value={companyRCS} onChange={(e) => setCompanyRCS(e.target.value)}
                      placeholder={t('devis.registryPlaceholder')}
                      className={normalFieldClass} />
                  </div>
                  {isSocieteStatus(companyStatus, locale) && (
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.shareCapital')}</label>
                      <input type="text" value={companyCapital} onChange={(e) => setCompanyCapital(e.target.value)}
                        placeholder={t('devis.shareCapitalPlaceholder')}
                        className={normalFieldClass} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.phone')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)}
                      className={normalFieldClass} />
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.email')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)}
                      className={normalFieldClass} />
                  </div>
                </div>

                {/* Assurance décennale / RC Pro */}
                <div className="v22-alert v22-alert-blue" style={{ marginBottom: 12, cursor: 'default' }}>
                  <div>
                    <strong style={{ color: '#1D4ED8', fontSize: 12 }}>{t('devis.insuranceMandatoryTitle')}</strong>
                    <div style={{ fontSize: 11, color: '#1D4ED8', marginTop: 2 }}>{t('devis.insuranceMandatoryDesc')}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.insuranceType')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <select value={insuranceType} onChange={(e) => setInsuranceType(e.target.value as 'rc_pro' | 'decennale' | 'both')}
                      className={normalFieldClass}>
                      <option value="rc_pro">{t('devis.insuranceRcPro')}</option>
                      <option value="decennale">{t('devis.insuranceDecennale')}</option>
                      <option value="both">{t('devis.insuranceBoth')}</option>
                    </select>
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.insuranceName')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="text" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)}
                      placeholder={t('devis.insuranceNamePlaceholder')}
                      className={normalFieldClass} />
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.insuranceContractNumber')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="text" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)}
                      placeholder={t('devis.insuranceContractPlaceholder')}
                      className={normalFieldClass} />
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.insuranceCoverage')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="text" value={insuranceCoverage} onChange={(e) => setInsuranceCoverage(e.target.value)}
                      placeholder={t('devis.insuranceCoveragePlaceholder')}
                      className={normalFieldClass} />
                  </div>
                </div>

                {/* Médiateur de la consommation */}
                <div className="v22-alert v22-alert-purple" style={{ marginBottom: 12, cursor: 'default' }}>
                  <div>
                    <strong style={{ color: '#7C3AED', fontSize: 12 }}>{t('devis.mediatorTitle')}</strong>
                    <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>{t('devis.mediatorDesc')}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.mediatorName')}</label>
                    <input type="text" value={mediatorName} onChange={(e) => setMediatorName(e.target.value)}
                      placeholder={t('devis.mediatorNamePlaceholder')}
                      className={normalFieldClass} />
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.mediatorUrl')}</label>
                    <input type="text" value={mediatorUrl} onChange={(e) => setMediatorUrl(e.target.value)}
                      placeholder={t('devis.mediatorUrlPlaceholder')}
                      className={normalFieldClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Section: TVA ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.taxConfigSection')}</span>
              </div>
              <div className="v22-card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--v22-bg)', borderRadius: 3, marginBottom: 12 }}>
                  <button
                    onClick={() => {
                      const next = !tvaEnabled
                      setTvaEnabled(next)
                      const rate = locale === 'pt' ? 23 : 20
                      setLines(prev => prev.map(l => ({ ...l, tvaRate: next ? rate : 0 })))
                    }}
                    className={`v22-toggle ${tvaEnabled ? 'v22-toggle-on' : 'v22-toggle-off'}`}
                  >
                    <div className={`v22-toggle-knob ${tvaEnabled ? 'v22-toggle-knob-on' : 'v22-toggle-knob-off'}`} />
                  </button>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{tvaEnabled ? t('devis.taxEnabled') : t('devis.taxDisabled')}</div>
                    <div style={{ fontSize: 11, color: 'var(--v22-text-muted)' }}>
                      {tvaEnabled ? t('devis.taxEnabledDesc') : t('devis.taxDisabledDesc')}
                    </div>
                  </div>
                </div>
                {isSmallBusinessStatus(companyStatus, locale) && (
                  <div className={tvaEnabled ? 'v22-tag v22-tag-amber' : 'v22-tag v22-tag-green'} style={{ display: 'block', padding: '6px 10px', fontSize: 11, marginBottom: 12 }}>
                    {tvaEnabled ? t('devis.taxThresholdWarning') : t('devis.taxExemptInfo')}
                  </div>
                )}
                {tvaEnabled && (
                  <div className="v22-form-group">
                    <label className="v22-form-label">{t('devis.taxNumberLabel')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="text" value={tvaNumber} onChange={(e) => setTvaNumber(e.target.value)}
                      placeholder={t('devis.taxNumberPlaceholder')}
                      className={normalFieldClass} />
                  </div>
                )}
              </div>
            </div>

            {/* ─── Section: Client ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.clientSection')}</span>
              </div>
              <div className="v22-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.clientName')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                      placeholder={t('devis.clientNamePlaceholder')}
                      className={normalFieldClass} />
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.clientEmail')}</label>
                    <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                      placeholder={locale === 'pt' ? 'maria.silva@email.pt' : 'marie.dubois@email.fr'}
                      className={normalFieldClass} />
                  </div>
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">{t('devis.clientAddress')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                  <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
                    placeholder={t('devis.clientAddressPlaceholder')}
                    className={normalFieldClass} />
                </div>
                {/* Adresse d'intervention — apparaît dès qu'un SIRET client est renseigné (pro/syndic) */}
                {clientSiret.trim().length > 0 && (
                  <div className="v22-form-group">
                    <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t('devis.interventionAddress')}
                      <span className="v22-tag v22-tag-amber">{t('devis.interventionAddressClientPro')}</span>
                    </label>
                    <input type="text" value={interventionAddress} onChange={(e) => setInterventionAddress(e.target.value)}
                      placeholder={t('devis.interventionAddressPlaceholder')}
                      className={normalFieldClass} />
                    <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 3 }}>{t('devis.interventionAddressHint')}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.clientPhone')}</label>
                    <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                      placeholder={t('devis.clientPhonePlaceholder')}
                      className={normalFieldClass} />
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.clientTaxId')}</label>
                    <input type="text" value={clientSiret} onChange={(e) => setClientSiret(e.target.value)}
                      placeholder={t('devis.clientTaxIdPlaceholder')}
                      className={normalFieldClass} />
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Section: Document Info ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.docInfoSection')}</span>
              </div>
              <div className="v22-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.issueDate')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                      className={normalFieldClass} />
                    {docType === 'facture' && <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 3 }}>{t('devis.issueDateFactureHint')}</div>}
                  </div>
                  {docType === 'devis' && (
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.validityDays')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                      <input type="number" value={docValidity} onChange={(e) => setDocValidity(parseInt(e.target.value) || 30)}
                        className={normalFieldClass} />
                    </div>
                  )}
                  {docType === 'facture' && (
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.prestationDate')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                      <input type="date" value={prestationDate} onChange={(e) => setPrestationDate(e.target.value)}
                        className={normalFieldClass} />
                      <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 3 }}>{t('devis.prestationDateHint')}</div>
                    </div>
                  )}
                </div>
                {docType === 'devis' && (
                  <div className="v22-form-group">
                    <label className="v22-form-label">{t('devis.executionDelay')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" min="0" value={executionDelayDays || ''} onChange={(e) => {
                        const v = parseInt(e.target.value) || 0
                        setExecutionDelayDays(v)
                        setExecutionDelay(`${v} jour${v > 1 ? 's' : ''} ${executionDelayType === 'ouvres' ? 'ouvrés' : 'calendaires'}`)
                      }}
                        placeholder="Nb"
                        className={normalFieldClass}
                        style={{ width: 70, textAlign: 'center' }} />
                      <select value={executionDelayType} onChange={(e) => {
                        const t = e.target.value as 'ouvres' | 'calendaires'
                        setExecutionDelayType(t)
                        if (executionDelayDays > 0) setExecutionDelay(`${executionDelayDays} jour${executionDelayDays > 1 ? 's' : ''} ${t === 'ouvres' ? 'ouvrés' : 'calendaires'}`)
                      }}
                        className={normalFieldClass}
                        style={{ flex: 1 }}>
                        <option value="ouvres">{t('devis.workingDays')}</option>
                        <option value="calendaires">{t('devis.calendarDays')}</option>
                      </select>
                    </div>
                    {executionDelayDays > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4 }}>→ {executionDelay} {t('devis.afterAcceptance')}</div>
                    )}
                  </div>
                )}

                {/* Toggle droit de rétractation (devis uniquement) */}
                {docType === 'devis' && (
                  <div className="v22-alert v22-alert-orange" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => setIsHorsEtablissement(!isHorsEtablissement)}
                        className={`v22-toggle ${isHorsEtablissement ? 'v22-toggle-on-orange' : 'v22-toggle-off'}`}
                      >
                        <div className={`v22-toggle-knob ${isHorsEtablissement ? 'v22-toggle-knob-on' : 'v22-toggle-knob-off'}`} />
                      </button>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#9A3412' }}>
                          {isHorsEtablissement ? t('devis.withdrawalRightEnabled') : t('devis.withdrawalRightDisabled')}
                        </div>
                        <div style={{ fontSize: 11, color: '#EA580C', marginTop: 2 }}>
                          {isHorsEtablissement
                            ? t('devis.withdrawalRightEnabledDesc')
                            : t('devis.withdrawalRightDisabledDesc')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Section: Prestations ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.prestationsSection')}</span>
              </div>
              <div className="v22-card-body" style={{ padding: 0 }}>
                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="v22-devis-table" style={{ minWidth: 600, tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '30%', overflow: 'hidden' }}>{t('devis.designation')}</th>
                        <th style={{ width: '8%' }}>{t('devis.qty')}</th>
                        <th style={{ width: '10%' }}>{t('devis.unit')}</th>
                        <th style={{ width: '14%' }}>{tvaEnabled ? `${t('devis.unitPrice')} ${t('devis.ht')}` : `${t('devis.unitPrice')} ${t('devis.ttc')}`}</th>
                        <th style={{ width: '10%' }}>{localeFormats.taxLabel} %</th>
                        <th style={{ width: '18%' }}>{tvaEnabled ? `${t('devis.total')} ${t('devis.ht')}` : `${t('devis.total')} ${t('devis.ttc')}`}</th>
                        <th style={{ width: '8%' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} style={{ verticalAlign: 'top' }}>
                          <td style={{ verticalAlign: 'top' }}>
                            {line.description ? (
                              (() => {
                                // Nettoyer les métadonnées [unit:...|min:...|max:...]
                                const cleaned = line.description.replace(/\s*\[[^\]]*\]/g, '').trim()
                                const parts = cleaned.split('\n')
                                const title = parts[0]
                                const detail = parts.slice(1).join('\n').trim()
                                // Largeur des boutons : 2 × ~26px + gap 4px = 56px de réservation
                                const BTN_W = 56
                                return (
                                  <div>
                                    {/* Ligne titre — pleine largeur */}
                                    <input
                                      type="text"
                                      value={title}
                                      onChange={(e) => {
                                        const newVal = detail ? `${e.target.value}\n${detail}` : e.target.value
                                        updateLine(line.id, 'description', newVal)
                                      }}
                                      className="v22-form-input"
                                      style={{ fontWeight: 600, width: '100%', boxSizing: 'border-box' }}
                                    />
                                    {detail && (
                                      <div style={{ position: 'relative', marginTop: 4 }}>
                                        {/* Rectangle gris description — pleine largeur du td */}
                                        {editingDescLineId === line.id ? (
                                          <textarea
                                            autoFocus
                                            defaultValue={detail}
                                            rows={2}
                                            onBlur={(e) => {
                                              const newDetail = e.target.value.trim()
                                              updateLine(line.id, 'description', newDetail ? `${title}\n${newDetail}` : title)
                                              setEditingDescLineId(null)
                                            }}
                                            style={{
                                              width: '100%', boxSizing: 'border-box',
                                              padding: '4px 8px', paddingRight: 56,
                                              background: '#f9fafb', border: '1px solid #93c5fd',
                                              borderRadius: 4, fontSize: 11, color: '#374151',
                                              lineHeight: 1.4, resize: 'vertical', outline: 'none',
                                            }}
                                          />
                                        ) : (
                                          <div style={{
                                            width: '100%', boxSizing: 'border-box',
                                            padding: '4px 8px', paddingRight: 56,
                                            background: '#f9fafb', border: '1px solid #e5e7eb',
                                            borderRadius: 4, fontSize: 11, color: '#6b7280',
                                            lineHeight: 1.4,
                                          }}>
                                            {detail}
                                          </div>
                                        )}
                                        {/* Boutons positionnés en absolu à droite — ne poussent pas la largeur */}
                                        <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2 }}>
                                          <button
                                            title="Modifier la description"
                                            onClick={() => setEditingDescLineId(editingDescLineId === line.id ? null : line.id)}
                                            style={{
                                              background: editingDescLineId === line.id ? '#dbeafe' : '#fff',
                                              border: '1px solid #e5e7eb', borderRadius: 4,
                                              padding: '2px 6px', cursor: 'pointer',
                                              fontSize: 11, color: '#6b7280', lineHeight: 1,
                                            }}
                                          >✏️</button>
                                          <button
                                            title="Supprimer la description"
                                            onClick={() => { updateLine(line.id, 'description', title); setEditingDescLineId(null) }}
                                            style={{
                                              background: '#fff', border: '1px solid #e5e7eb',
                                              borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                                              fontSize: 11, color: '#9ca3af', lineHeight: 1,
                                            }}
                                          >✕</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()
                            ) : (
                              <div>
                                <select
                                  onChange={(e) => selectMotif(line.id, e.target.value)}
                                  className="v22-form-input"
                                  defaultValue=""
                                >
                                  <option value="">{t('devis.selectMotif')}</option>
                                  {services.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} - {formatPrice(s.price_ht ?? 0)}
                                    </option>
                                  ))}
                                  <option value="custom">{t('devis.freeEntry')}</option>
                                </select>
                                {line.description === '' && (
                                  <input
                                    type="text"
                                    placeholder={t('devis.freeEntryPlaceholder')}
                                    onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                                    className="v22-form-input"
                                    style={{ display: 'none', marginTop: 4 }}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ verticalAlign: 'top' }}>
                            <input
                              type="number"
                              value={line.qty}
                              onChange={(e) => {
                                const v = e.target.value
                                // Accepter la saisie brute (y compris vide temporairement)
                                updateLine(line.id, 'qty', v === '' ? 0 : parseInt(v) || 0)
                              }}
                              onBlur={(e) => {
                                // Au blur, forcer minimum 1
                                const v = parseInt(e.target.value)
                                if (!v || v < 1) updateLine(line.id, 'qty', 1)
                              }}
                              min={1}
                              className="v22-form-input"
                              style={{ textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <select
                                value={getSelectValue(line)}
                                onChange={(e) => {
                                  const val = e.target.value
                                  updateLine(line.id, 'unit', val)
                                  if (val !== 'autre') {
                                    // Effacer customUnit si on quitte "autre"
                                    setLines(prev => prev.map(l => l.id === line.id ? { ...l, customUnit: undefined } : l))
                                  }
                                }}
                                className="v22-form-input"
                                style={{ flex: 1, minWidth: 0 }}
                              >
                                {UNITES_DEVIS.map(u => (
                                  <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                              </select>
                              {getSelectValue(line) === 'autre' && (
                                <input
                                  type="text"
                                  value={line.customUnit || (line.unit !== 'autre' && !UNITE_VALUES.has(line.unit) ? line.unit : '')}
                                  onChange={(e) => {
                                    const v = e.target.value.slice(0, 8)
                                    setLines(prev => prev.map(l => l.id === line.id ? { ...l, unit: 'autre', customUnit: v } : l))
                                  }}
                                  placeholder="Ex: plant, sujet..."
                                  maxLength={8}
                                  className="v22-form-input"
                                  style={{ width: 80, flex: 'none' }}
                                />
                              )}
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'top' }}>
                            <input
                              type="number"
                              value={line.priceHT}
                              onChange={(e) => updateLine(line.id, 'priceHT', parseFloat(e.target.value) || 0)}
                              step="0.01"
                              className="v22-form-input"
                            />
                          </td>
                          <td style={{ verticalAlign: 'top' }}>
                            <select
                              value={line.tvaRate}
                              onChange={(e) => updateLine(line.id, 'tvaRate', parseFloat(e.target.value))}
                              disabled={!tvaEnabled}
                              className="v22-form-input"
                              style={{ opacity: !tvaEnabled ? 0.5 : 1 }}
                            >
                              {locale === 'pt' ? (
                                <>
                                  <option value={23}>23%</option>
                                  <option value={13}>13%</option>
                                  <option value={6}>6%</option>
                                  <option value={0}>0%</option>
                                </>
                              ) : (
                                <>
                                  <option value={20}>20%</option>
                                  <option value={10}>10%</option>
                                  <option value={5.5}>5,5%</option>
                                  <option value={0}>0%</option>
                                </>
                              )}
                            </select>
                          </td>
                          <td style={{ verticalAlign: 'top' }}>
                            <div className="v22-amount" style={{ padding: '7px 10px', background: 'var(--v22-bg)', borderRadius: 3 }}>
                              {localeFormats.currencyFormat(line.totalHT)}
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'top' }}>
                            <button
                              onClick={() => removeLine(line.id)}
                              className="v22-btn v22-btn-danger v22-btn-sm"
                              style={{ width: '100%' }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: 14, display: 'flex', gap: 8 }}>
                  <button
                    onClick={addLine}
                    className="v22-btn"
                    style={{ flex: 1, border: '1px dashed var(--v22-border-dark)', background: 'var(--v22-surface)' }}
                  >
                    + {t('devis.addLine')}
                  </button>
                  <button
                    onClick={() => setShowReceiptScanner(true)}
                    className="v22-btn"
                    style={{ flex: 1, border: '1px solid #FFC107', background: 'linear-gradient(135deg, #FFF8E1, #FFFDE7)', color: '#F57F17', fontWeight: 600 }}
                  >
                    📷 Scanner ticket
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Étapes : petit bloc gris compact comme la description ─── */}
            {devisEtapes.length > 0 && (
              <div style={{
                margin: '8px 0 12px', padding: '8px 12px',
                background: '#F5F5F3', borderRadius: 8, border: '1px solid #E8E8E5',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: 0.5 }}>
                    ÉTAPES DE L&apos;INTERVENTION
                  </span>
                  <button
                    onClick={() => {
                      const newId = `etape_manual_${Date.now()}`
                      const newOrdre = devisEtapes.length > 0 ? Math.max(...devisEtapes.map(e => e.ordre)) + 1 : 0
                      setDevisEtapes(prev => [...prev, { id: newId, ordre: newOrdre, designation: '' }])
                    }}
                    style={{ fontSize: 10, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    + Ajouter
                  </button>
                </div>
                {devisEtapes.sort((a, b) => a.ordre - b.ordre).map((etape, index) => (
                  <div key={etape.id} style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.5 }}>
                    <span style={{ color: '#999', fontSize: 11, minWidth: 16 }}>{index + 1}.</span>
                    <input
                      type="text"
                      value={etape.designation}
                      onChange={(e) => setDevisEtapes(prev => prev.map(et => et.id === etape.id ? { ...et, designation: e.target.value } : et))}
                      style={{ flex: 1, fontSize: 12, color: '#555', background: 'transparent', border: 'none', outline: 'none', padding: '1px 0' }}
                    />
                    <button
                      onClick={() => setDevisEtapes(prev => prev.filter(et => et.id !== etape.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#ccc', padding: '0 2px' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* ─── Section: Acomptes & Paiement échelonné (Devis only) ─── */}
            {docType === 'devis' && (
              <div className="v22-card">
                <div className="v22-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="v22-card-title">{locale === 'pt' ? 'Adiantamentos & Pagamento faseado' : 'Acomptes & Paiement échelonné'}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={acomptesEnabled} onChange={(e) => {
                      setAcomptesEnabled(e.target.checked)
                      if (e.target.checked && acomptes.length === 0) {
                        setAcomptes([{ id: crypto.randomUUID(), ordre: 1, label: locale === 'pt' ? 'Adiantamento 1' : 'Acompte 1', pourcentage: 0, declencheur: locale === 'pt' ? 'Na assinatura' : 'À la signature' }])
                      }
                    }} />
                    {acomptesEnabled ? 'ON' : 'OFF'}
                  </label>
                </div>
                {acomptesEnabled && (
                  <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {acomptes.map((ac, idx) => {
                      const totalVal = tvaEnabled ? totalTTC : subtotalHT
                      const montant = totalVal * ac.pourcentage / 100
                      return (
                        <div key={ac.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: 8, alignItems: 'center' }}>
                          <select
                            value={ac.declencheur}
                            onChange={(e) => {
                              const updated = [...acomptes]
                              updated[idx] = { ...ac, declencheur: e.target.value }
                              setAcomptes(updated)
                            }}
                            className={normalFieldClass}
                          >
                            <option>{locale === 'pt' ? 'Na assinatura' : 'À la signature'}</option>
                            <option>{locale === 'pt' ? 'No início dos trabalhos' : 'Au démarrage des travaux'}</option>
                            <option>{locale === 'pt' ? 'A meio do projeto' : 'À mi-parcours'}</option>
                            <option>{locale === 'pt' ? 'Na entrega' : 'À la livraison'}</option>
                            <option>{locale === 'pt' ? 'Personalizado' : 'Personnalisé'}</option>
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={ac.pourcentage || ''}
                              onChange={(e) => {
                                const updated = [...acomptes]
                                updated[idx] = { ...ac, pourcentage: parseFloat(e.target.value) || 0 }
                                setAcomptes(updated)
                              }}
                              className={normalFieldClass}
                              style={{ width: 60, textAlign: 'right' }}
                            />
                            <span style={{ fontSize: 13 }}>%</span>
                          </div>
                          <span className="v22-mono" style={{ fontSize: 13, textAlign: 'right' }}>= {localeFormats.currencyFormat(montant)}</span>
                          <button
                            onClick={() => {
                              const updated = acomptes.filter((_, i) => i !== idx).map((a, i) => ({ ...a, ordre: i + 1, label: `${locale === 'pt' ? 'Adiantamento' : 'Acompte'} ${i + 1}` }))
                              setAcomptes(updated)
                              if (updated.length === 0) setAcomptesEnabled(false)
                            }}
                            className="v22-btn" style={{ padding: '2px 6px', fontSize: 14, color: 'var(--v22-red)' }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                    {acomptes.length < 4 ? (
                      <button
                        onClick={() => setAcomptes([...acomptes, { id: crypto.randomUUID(), ordre: acomptes.length + 1, label: `${locale === 'pt' ? 'Adiantamento' : 'Acompte'} ${acomptes.length + 1}`, pourcentage: 0, declencheur: locale === 'pt' ? 'Na entrega' : 'À la livraison' }])}
                        className="v22-btn" style={{ alignSelf: 'flex-start', border: '1px dashed var(--v22-border-dark)', background: 'var(--v22-surface)' }}
                      >
                        + {locale === 'pt' ? 'Adicionar adiantamento' : 'Ajouter un acompte'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--v22-text-muted)' }}>{locale === 'pt' ? 'Máximo 4 adiantamentos atingido' : 'Maximum 4 acomptes atteint'}</span>
                    )}
                    {(() => {
                      const totalPct = acomptes.reduce((s, a) => s + a.pourcentage, 0)
                      const color = totalPct === 100 ? 'var(--v22-green)' : totalPct > 100 ? 'var(--v22-red)' : 'var(--v22-amber)'
                      return (
                        <div style={{ fontSize: 13, fontWeight: 600, color, marginTop: 4 }}>
                          {locale === 'pt' ? 'Total faseado' : 'Total échelonné'} : {totalPct}% {totalPct === 100 ? '✅' : totalPct > 100 ? '❌' : '⚠️'}
                          {totalPct > 100 && <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>{locale === 'pt' ? 'O total dos adiantamentos excede 100%. Ajuste as percentagens.' : 'Le total des acomptes dépasse 100%. Ajustez les pourcentages.'}</div>}
                          {totalPct < 100 && totalPct > 0 && <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>{locale === 'pt' ? `Os ${100 - totalPct}% restantes serão pagos separadamente.` : `Les ${100 - totalPct}% restants seront réglés séparément.`}</div>}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ─── Section: Payment (Facture only) ─── */}
            {docType === 'facture' && (
              <div className="v22-card">
                <div className="v22-card-head">
                  <span className="v22-card-title">{t('devis.paymentSection')}</span>
                </div>
                <div className="v22-card-body">
                  <div className="v22-alert v22-alert-amber" style={{ marginBottom: 12, cursor: 'default' }}>
                    <div style={{ fontSize: 11, color: 'var(--v22-amber)' }}>{t('devis.paymentSectionDesc')}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.paymentCondition')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                      <select value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)}
                        className={normalFieldClass}>
                        <option value={t('devis.paymentCondValues.immediate')}>{t('devis.paymentCondOptions.immediate')}</option>
                        <option value={t('devis.paymentCondValues.30end')}>{t('devis.paymentCondOptions.30end')}</option>
                        <option value={t('devis.paymentCondValues.30date')}>{t('devis.paymentCondOptions.30date')}</option>
                        <option value={t('devis.paymentCondValues.45end')}>{t('devis.paymentCondOptions.45end')}</option>
                        <option value={t('devis.paymentCondValues.60date')}>{t('devis.paymentCondOptions.60date')}</option>
                        <option value={t('devis.paymentCondValues.5050')}>{t('devis.paymentCondOptions.5050')}</option>
                      </select>
                    </div>
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.paymentMode')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                      <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                        className={normalFieldClass}>
                        <option value={t('devis.paymentModeOptions.transfer')}>{t('devis.paymentModeOptions.transfer')}</option>
                        <option value={t('devis.paymentModeOptions.card')}>{t('devis.paymentModeOptions.card')}</option>
                        <option value={t('devis.paymentModeOptions.cheque')}>{t('devis.paymentModeOptions.cheque')}</option>
                        <option value={t('devis.paymentModeOptions.cash')}>{t('devis.paymentModeOptions.cash')}</option>
                        <option value={`${t('devis.paymentModeOptions.transfer')} + ${t('devis.paymentModeOptions.cheque')}`}>{t('devis.paymentModeOptions.transferCheque')}</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.paymentDue')} <span style={{ color: 'var(--v22-red)' }}>*</span></label>
                      <input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)}
                        className={normalFieldClass} />
                    </div>
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.iban')}</label>
                      <input type="text" value={iban} onChange={(e) => setIban(e.target.value)}
                        placeholder={t('devis.ibanPlaceholder')}
                        className={normalFieldClass} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="v22-form-group" style={{ marginBottom: 0 }}>
                      <label className="v22-form-label">{t('devis.bic')}</label>
                      <input type="text" value={bic} onChange={(e) => setBic(e.target.value)}
                        placeholder={t('devis.bicPlaceholder')}
                        className={normalFieldClass} />
                      <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 3 }}>{t('devis.bicHint')}</div>
                    </div>
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: 0 }}>
                    <label className="v22-form-label">{t('devis.discountLabel')}</label>
                    <input type="text" value={discount} onChange={(e) => setDiscount(e.target.value)}
                      placeholder={t('devis.discountPlaceholder')}
                      className={normalFieldClass} />
                  </div>
                </div>
              </div>
            )}

            {/* ─── Section: Notes ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.notesSection')}</span>
              </div>
              <div className="v22-card-body">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t('devis.notesPlaceholder')}
                  className={normalFieldClass}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

            {/* ─── Section: Joindre un rapport ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.attachReportSection')}</span>
              </div>
              <div className="v22-card-body">
                {availableRapports.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select
                      value={attachedRapportId || ''}
                      onChange={(e) => setAttachedRapportId(e.target.value || null)}
                      className={normalFieldClass}
                    >
                      <option value="">{t('devis.noReportAttached')}</option>
                      {availableRapports.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.rapportNumber} — {r.interventionDate ? new Date(r.interventionDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : 'N/D'} — {r.motif || r.clientName || 'Intervention'}
                        </option>
                      ))}
                    </select>
                    {attachedRapport && (
                      <div style={{ background: 'var(--v22-amber-light)', border: '1px solid var(--v22-border)', borderRadius: 3, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--v22-text)' }}>{attachedRapport.rapportNumber}</span>
                          <span className={
                            attachedRapport.status === 'termine' ? 'v22-tag v22-tag-green' :
                            attachedRapport.status === 'en_cours' ? 'v22-tag v22-tag-yellow' :
                            attachedRapport.status === 'a_reprendre' ? 'v22-tag v22-tag-amber' :
                            'v22-tag v22-tag-gray'
                          }>
                            {attachedRapport.status === 'termine' ? t('devis.reportStatus.termine') :
                             attachedRapport.status === 'en_cours' ? t('devis.reportStatus.en_cours') :
                             attachedRapport.status === 'a_reprendre' ? t('devis.reportStatus.a_reprendre') : t('devis.reportStatus.sous_garantie')}
                          </span>
                        </div>
                        {attachedRapport.motif && (
                          <div style={{ fontSize: 12, color: 'var(--v22-amber)', marginBottom: 4 }}>{attachedRapport.motif}</div>
                        )}
                        <div className="v22-ref" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {attachedRapport.interventionDate && (
                            <span>{new Date(attachedRapport.interventionDate).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}
                              {attachedRapport.startTime && ` ${attachedRapport.startTime}`}
                              {attachedRapport.endTime && ` → ${attachedRapport.endTime}`}
                            </span>
                          )}
                          {attachedRapport.siteAddress && <span>{attachedRapport.siteAddress}</span>}
                          {attachedRapport.travaux?.filter(Boolean).length > 0 && (
                            <span>{attachedRapport.travaux.filter(Boolean).length} travaux</span>
                          )}
                        </div>
                        <button
                          onClick={() => setAttachedRapportId(null)}
                          className="v22-btn v22-btn-sm" style={{ marginTop: 8, color: 'var(--v22-red)', borderColor: 'var(--v22-red)' }}
                        >
                          {t('devis.removeReport')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>
                    {t('devis.noReportAvailable')}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Section: Photos chantier ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.attachPhotosSection')}</span>
              </div>
              <div className="v22-card-body">
                <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 10 }}>
                  {t('devis.attachPhotosDesc')}
                </div>
                {photosLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>{t('devis.loadingPhotos')}</div>
                ) : availablePhotos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Filter by booking if a linked booking exists */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPhotoIds(new Set())}
                        className="v22-btn v22-btn-sm"
                      >
                        {t('devis.deselectAll')} ({selectedPhotoIds.size})
                      </button>
                      {linkedBookingId && (
                        <button
                          type="button"
                          onClick={() => {
                            const bookingPhotos = availablePhotos.filter(p => p.booking_id === linkedBookingId)
                            setSelectedPhotoIds(new Set(bookingPhotos.map(p => p.id)))
                          }}
                          className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-amber-light)', color: 'var(--v22-amber)', borderColor: 'var(--v22-amber)' }}
                        >
                          {t('devis.selectLinkedPhotos')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedPhotoIds(new Set(availablePhotos.map(p => p.id)))}
                        className="v22-btn v22-btn-sm v22-btn-primary"
                      >
                        {t('devis.selectAll')}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                      {availablePhotos.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() => togglePhotoSelection(photo.id)}
                          style={{
                            position: 'relative', cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                            border: selectedPhotoIds.has(photo.id) ? '2px solid var(--v22-yellow)' : '1px solid var(--v22-border)',
                            boxShadow: selectedPhotoIds.has(photo.id) ? '0 0 0 2px var(--v22-yellow-border)' : 'none',
                          }}
                        >
                          <NextImage src={photo.url} alt={photo.label || 'Photo'} width={200} height={80} style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }} unoptimized />
                          {selectedPhotoIds.has(photo.id) && (
                            <div style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, background: 'var(--v22-yellow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: 'var(--v22-text)', fontSize: 10, fontWeight: 700 }}>✓</span>
                            </div>
                          )}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '2px 4px' }}>
                            <div style={{ fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {photo.taken_at ? new Date(photo.taken_at).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedPhotoIds.size > 0 && (
                      <div className="v22-tag v22-tag-amber" style={{ alignSelf: 'flex-start' }}>
                        {selectedPhotoIds.size} {t('devis.photosSelected')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>
                    {t('devis.noPhotos')}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Legal Mentions ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.legalMentionsLabel')}</span>
              </div>
              <div className="v22-card-body" style={{ background: 'var(--v22-bg)' }}>
                {getLegalMentions().map((m, i) => (
                  <div key={i} className="v22-ref" style={{ marginBottom: 4, lineHeight: 1.6 }}>{m}</div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════ RIGHT: SUMMARY PANEL ═══════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 16, alignSelf: 'flex-start' }}>
            {/* Totals */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.summary')}</span>
              </div>
              <div className="v22-card-body" style={{ padding: 0 }}>
                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--v22-border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--v22-text-mid)' }}>{tvaEnabled ? t('devis.subtotalHT') : t('devis.subtotal')}</span>
                  <span className="v22-amount">{localeFormats.currencyFormat(subtotalHT)}</span>
                </div>
                {tvaEnabled && (
                  <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--v22-border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--v22-text-mid)' }}>{t('devis.taxLabel')}</span>
                    <span className="v22-amount">{localeFormats.currencyFormat(totalTVA)}</span>
                  </div>
                )}
                <div style={{
                  padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: tvaEnabled ? 'var(--v22-green)' : 'var(--v22-yellow)',
                  color: tvaEnabled ? '#fff' : 'var(--v22-text)',
                  fontWeight: 600, fontSize: 14,
                }}>
                  <span>{tvaEnabled ? t('devis.totalTTC') : t('devis.totalNet')}</span>
                  <span className="v22-mono">{localeFormats.currencyFormat(tvaEnabled ? totalTTC : subtotalHT)}</span>
                </div>
              </div>
            </div>

            {/* Verified Company Info Summary */}
            {isLegalLocked && (
              <div className="v22-card">
                <div className="v22-card-head">
                  <span className="v22-card-title">{t('devis.verifiedCompany')}</span>
                  <span className="v22-tag v22-tag-green" style={{ marginLeft: 'auto' }}>{t('devis.verified')}</span>
                </div>
                <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{companyName}</div>
                    <div className="v22-ref">{officialLegalForm || getStatusLabel(companyStatus, t)}</div>
                  </div>
                  <div className="v22-ref">{localeFormats.taxIdLabel}: {companySiret}</div>
                  {companySiren && <div className="v22-ref">SIREN: {companySiren}</div>}
                  <div className="v22-ref">{companyAddress}</div>
                  {companyNafLabel && <div className="v22-ref">{companyNafLabel}</div>}
                </div>
              </div>
            )}

            {/* Compliance */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.legalCompliance')}</span>
              </div>
              <div className="v22-card-body">
                <div className="v22-ref" style={{ marginBottom: 8, background: 'var(--v22-bg)', padding: '4px 8px', borderRadius: 2 }}>
                  {t('devis.statusLabel')} : <span style={{ fontWeight: 600, color: 'var(--v22-text)' }}>{getStatusLabel(companyStatus, t)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: t('devis.complianceSiret'), ok: compliance.siret },
                    { label: t('devis.complianceRcs'), ok: compliance.rcs },
                    { label: t('devis.complianceInsurance'), ok: compliance.insurance },
                    { label: t('devis.complianceClient'), ok: compliance.client },
                    { label: t('devis.complianceLines'), ok: compliance.lines },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span>{item.label}</span>
                      <span className={item.ok ? 'v22-tag v22-tag-green' : 'v22-tag v22-tag-red'}>{item.ok ? 'OK' : 'X'}</span>
                    </div>
                  ))}
                  {'capital' in compliance && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span>{t('devis.complianceCapital')}</span>
                      <span className={(compliance as any).capital ? 'v22-tag v22-tag-green' : 'v22-tag v22-tag-red'}>{(compliance as any).capital ? 'OK' : 'X'}</span>
                    </div>
                  )}
                  {'tvaNumber' in compliance && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span>{t('devis.complianceTva')}</span>
                      <span className={(compliance as any).tvaNumber ? 'v22-tag v22-tag-green' : 'v22-tag v22-tag-red'}>{(compliance as any).tvaNumber ? 'OK' : 'X'}</span>
                    </div>
                  )}
                  {isLegalLocked && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span>{t('devis.complianceVerified')}</span>
                      <span className="v22-tag v22-tag-green">OK</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Signature électronique (devis only) */}
            {docType === 'devis' && (
              <div className="v22-card">
                <div className="v22-card-head">
                  <span className="v22-card-title">{locale === 'pt' ? 'Assinatura' : 'Signature'}</span>
                  {signatureData && <span className="v22-tag v22-tag-green" style={{ fontSize: 10 }}>{locale === 'pt' ? 'Assinado' : 'Signé'}</span>}
                </div>
                <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {signatureData ? (
                    <div>
                      <div style={{ border: '1px solid var(--v22-border)', borderRadius: 4, padding: 8, background: 'var(--v22-bg)', marginBottom: 6 }}
                        dangerouslySetInnerHTML={{ __html: signatureData.svg_data }}
                      />
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v22-text)' }}>{signatureData.signataire}</div>
                      <div style={{ fontSize: 10, color: 'var(--v22-text-muted)' }}>{new Date(signatureData.timestamp).toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</div>
                      <div style={{ fontSize: 9, color: 'var(--v22-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>SHA-256: {signatureData.hash_sha256.substring(0, 16)}...</div>
                      <button onClick={() => { setSignatureData(null); sigClearCanvas() }}
                        className="v22-btn v22-btn-sm" style={{ marginTop: 6, color: 'var(--v22-red)', fontSize: 11 }}>
                        {locale === 'pt' ? 'Remover assinatura' : 'Retirer la signature'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 4 }}>
                        {locale === 'pt' ? 'Assine o documento antes de gerar o PDF' : 'Signez le document avant de générer le PDF'}
                      </div>
                      <button onClick={() => { setSigNom(companyName); setShowSignatureModal(true) }}
                        className="v22-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px' }}>
                        {locale === 'pt' ? 'Assinar o documento' : 'Signer le document'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.actions')}</span>
              </div>
              <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedMsg && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: savedMsg.startsWith('✅') ? '#d1fae5' : savedMsg.startsWith('❌') ? '#fee2e2' : '#fef3c7', fontSize: 13, fontWeight: 500, color: '#1f2937' }}>
                    {savedMsg}
                  </div>
                )}
                <button
                  onClick={handleSaveDraft}
                  className="v22-btn"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px' }}
                >
                  {t('devis.saveDraft')}
                </button>
                <button
                  onClick={handleGeneratePDF}
                  disabled={pdfLoading}
                  className="v22-btn v22-btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', opacity: pdfLoading ? 0.6 : 1, cursor: pdfLoading ? 'wait' : 'pointer' }}
                >
                  {pdfLoading ? t('devis.generatingPdf') : t('devis.downloadPdf')}
                </button>
                <button
                  onClick={handleTestPdfV2}
                  disabled={pdfLoading}
                  className="v22-btn"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', opacity: pdfLoading ? 0.6 : 1, cursor: pdfLoading ? 'wait' : 'pointer', border: '1px dashed var(--v22-yellow)', color: 'var(--v22-text-mid)', fontSize: 12 }}
                >
                  🧪 Tester PDF v2
                </button>
                <button
                  onClick={handleValidateAndSend}
                  disabled={!allCompliant}
                  className="v22-btn v22-btn-green"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', opacity: !allCompliant ? 0.5 : 1, cursor: !allCompliant ? 'not-allowed' : 'pointer' }}
                >
                  {t('devis.validateAndSend')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MODAL ENVOI — Email ou Vitfix Channel
          ═══════════════════════════════════════════════ */}
      {showSendModal && (
        <div className="v22-modal-overlay">
          <div className="v22-modal" style={{ width: 440 }}>
            <div className="v22-modal-head" style={{ background: 'var(--v22-yellow)', borderBottomColor: 'var(--v22-yellow-border)' }}>
              <span className="v22-modal-title">
                {showSendModal === 'pdf' ? t('devis.sendModalPdfTitle') : `${docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')} ${t('devis.sendModalValidateTitle')}`}
              </span>
              <button onClick={() => setShowSendModal(null)} className="v22-modal-close">✕</button>
            </div>
            <div className="v22-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--v22-text-mid)', marginBottom: 4 }}>{t('devis.sendModalQuestion')}</div>
              {/* Option 1: Email */}
              {clientEmail && (
                <button
                  onClick={handleSendViaEmail}
                  className="v22-btn"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', textAlign: 'left', background: '#EFF6FF', borderColor: '#BFDBFE' }}
                >
                  <div style={{ width: 32, height: 32, background: '#1D4ED8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 14 }}>{'@'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#1E40AF', fontSize: 12 }}>{t('devis.sendViaEmail')}</div>
                    <div className="v22-ref" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clientEmail}</div>
                  </div>
                  <span style={{ color: '#93C5FD' }}>→</span>
                </button>
              )}

              {/* Option 2: Vitfix Channel */}
              <button
                onClick={handleSendViaVitfix}
                disabled={!linkedBookingId || sendingVitfix}
                className="v22-btn"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', textAlign: 'left',
                  background: linkedBookingId ? 'var(--v22-amber-light)' : 'var(--v22-bg)',
                  borderColor: linkedBookingId ? 'var(--v22-yellow-border)' : 'var(--v22-border)',
                  opacity: (!linkedBookingId || sendingVitfix) ? 0.5 : 1,
                  cursor: (!linkedBookingId || sendingVitfix) ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{ width: 32, height: 32, background: linkedBookingId ? 'var(--v22-yellow)' : 'var(--v22-border-dark)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                  {sendingVitfix ? '...' : 'V'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: linkedBookingId ? 'var(--v22-amber)' : 'var(--v22-text-muted)' }}>
                    {sendingVitfix ? t('devis.sending') : t('devis.sendViaVitfix')}
                  </div>
                  <div className="v22-ref">
                    {linkedBookingId
                      ? t('devis.sendViaVitfixDesc')
                      : t('devis.sendViaVitfixImport')}
                  </div>
                </div>
                {linkedBookingId && !sendingVitfix && (
                  <span style={{ color: 'var(--v22-amber)' }}>→</span>
                )}
              </button>
            </div>
            <div className="v22-modal-foot">
              <button
                onClick={() => setShowSendModal(null)}
                className="v22-btn v22-btn-sm"
              >
                {t('devis.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL SIGNATURE ÉLECTRONIQUE ═══ */}
      {showSignatureModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowSignatureModal(false)}>
          <div style={{ background: 'var(--v22-surface, #fff)', borderRadius: 8, maxWidth: 480, width: '100%', border: '1px solid var(--v22-border)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--v22-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--v22-text)' }}>{locale === 'pt' ? 'Assinatura eletrónica' : 'Signature électronique'}</div>
                <div style={{ fontSize: 10, color: 'var(--v22-text-muted)' }}>art. 1367 Code Civil / art. 25.1 eIDAS — SHA-256</div>
              </div>
              <button onClick={() => setShowSignatureModal(false)} style={{ fontSize: 18, color: 'var(--v22-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ background: 'var(--v22-yellow-light, #FFFBE6)', border: '1px solid var(--v22-yellow-border, #FFD600)', borderRadius: 4, padding: '8px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--v22-amber, #8A6000)' }}>{docType === 'devis' ? (locale === 'pt' ? 'Orçamento' : 'Devis') : (locale === 'pt' ? 'Fatura' : 'Facture')} : <span style={{ fontWeight: 600 }}>{docNumber}</span></div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--v22-text-muted)', marginBottom: 4 }}>{locale === 'pt' ? 'Nome do signatário *' : 'Nom du signataire *'}</label>
                <input type="text" value={sigNom} onChange={e => setSigNom(e.target.value)}
                  placeholder={locale === 'pt' ? 'Nome completo' : 'Prénom Nom'}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--v22-border)', borderRadius: 4, fontSize: 13, outline: 'none' }} />
              </div>

              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--v22-text-muted)' }}>{locale === 'pt' ? 'Assinatura *' : 'Signature *'}</label>
                  <button onClick={sigClearCanvas} style={{ fontSize: 11, color: 'var(--v22-red, #C0392B)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {locale === 'pt' ? 'Limpar' : 'Effacer'}
                  </button>
                </div>
                <canvas ref={sigCanvasRef} width={400} height={140}
                  style={{
                    width: '100%', border: `2px ${sigPoints.length > 0 ? 'solid var(--v22-yellow, #FFD600)' : 'dashed var(--v22-border)'} `,
                    borderRadius: 4, cursor: 'crosshair', touchAction: 'none',
                    background: sigPoints.length > 0 ? 'var(--v22-surface, #fff)' : 'var(--v22-bg, #F7F7F5)',
                  }}
                  onMouseDown={sigStartDraw} onMouseMove={sigDraw} onMouseUp={sigEndDraw} onMouseLeave={sigEndDraw}
                  onTouchStart={sigStartDraw} onTouchMove={sigDraw} onTouchEnd={sigEndDraw}
                />
                {sigPoints.length === 0 && (
                  <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', textAlign: 'center', marginTop: 4 }}>
                    {locale === 'pt' ? 'Assine aqui com o rato ou o dedo' : 'Signez ici avec la souris ou le doigt'}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--v22-bg, #F7F7F5)', borderRadius: 4, padding: '6px 10px', marginTop: 8, marginBottom: 12, fontSize: 10, color: 'var(--v22-text-muted)' }}>
                {locale === 'pt' ? 'Carimbo temporal' : 'Horodatage'} : {new Date().toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} — SHA-256
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowSignatureModal(false)}
                  className="v22-btn" style={{ flex: 1, padding: '8px 14px' }}>
                  {locale === 'pt' ? 'Cancelar' : 'Annuler'}
                </button>
                <button onClick={handleSignDocument}
                  disabled={sigPoints.length === 0 || !sigNom.trim() || sigSigning}
                  className="v22-btn v22-btn-primary"
                  style={{ flex: 1, padding: '8px 14px', opacity: (sigPoints.length === 0 || !sigNom.trim() || sigSigning) ? 0.5 : 1 }}>
                  {sigSigning ? '...' : (locale === 'pt' ? 'Assinar' : 'Signer')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PDF is now generated with vector-based jsPDF + autoTable — no hidden HTML template needed ═══ */}

      {/* ═══ Receipt Scanner Modal ═══ */}
      {showReceiptScanner && (
        <ReceiptScanner
          mode="modal"
          onClose={() => setShowReceiptScanner(false)}
          onInject={(receiptLines: DevisReceiptLine[]) => {
            setShowReceiptScanner(false)
            const defaultTva = tvaEnabled ? (locale === 'pt' ? 23 : 20) : 0
            const newLines: ProductLine[] = receiptLines.map((rl, i) => ({
              id: Date.now() + i,
              description: rl.description,
              qty: rl.qty,
              unit: rl.unit,
              priceHT: rl.priceHT,
              tvaRate: defaultTva,
              totalHT: rl.totalHT,
              source: 'manual' as const,
            }))
            setLines(prev => [...prev, ...newLines])
          }}
        />
      )}
    </div>
  )
}
