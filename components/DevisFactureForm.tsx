'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import NextImage from 'next/image'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { getLocaleFormats, type Locale } from '@/lib/i18n/config'

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
  unit: string  // 'u' | 'm²' | 'm³' | 'ml' | 'h' | 'forfait' | 'kg' | 'lot'
  priceHT: number
  tvaRate: number
  totalHT: number
  source?: 'etape_motif' | 'manual'  // traçabilité étape → ligne
  etape_id?: string  // lien vers l'étape source
}

interface DevisEtape {
  id: string
  ordre: number
  designation: string
  source_etape_id?: string  // id de l'étape template (null si ajoutée manuellement)
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

  // ─── PDF (vector-based jsPDF + autoTable) ───
  const [pdfLoading, setPdfLoading] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // ─── Verified Company Data ───
  const [verifiedCompany, setVerifiedCompany] = useState<any>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)
  const [companyVerified, setCompanyVerified] = useState(false)

  // ─── State ───
  const [docType, setDocType] = useState<'devis' | 'facture'>(initialData?.docType || initialDocType)
  const [companyStatus, setCompanyStatus] = useState(initialData?.companyStatus || 'ei')
  const [companyName, setCompanyName] = useState(initialData?.companyName || artisan?.company_name || '')
  const [companySiret, setCompanySiret] = useState(initialData?.companySiret || artisan?.siret || '')
  const [companyAddress, setCompanyAddress] = useState(initialData?.companyAddress || artisan?.company_address || artisan?.address || '')
  const [companyRCS, setCompanyRCS] = useState(initialData?.companyRCS || '')
  const [companyCapital, setCompanyCapital] = useState(initialData?.companyCapital || '')
  const [companyPhone, setCompanyPhone] = useState(initialData?.companyPhone || artisan?.phone || '')
  const [companyEmail, setCompanyEmail] = useState(initialData?.companyEmail || artisan?.email || '')
  const [insuranceNumber, setInsuranceNumber] = useState(initialData?.insuranceNumber || '')
  const [insuranceName, setInsuranceName] = useState(initialData?.insuranceName || '')
  const [insuranceCoverage, setInsuranceCoverage] = useState(initialData?.insuranceCoverage || (locale === 'pt' ? 'Portugal Continental' : 'France métropolitaine'))
  const [insuranceType, setInsuranceType] = useState<'rc_pro' | 'decennale' | 'both'>(initialData?.insuranceType || 'rc_pro')
  // Médiateur de la consommation (obligatoire depuis 01/01/2016)
  const [mediatorName, setMediatorName] = useState(initialData?.mediatorName || '')
  const [mediatorUrl, setMediatorUrl] = useState(initialData?.mediatorUrl || '')
  // Droit de rétractation (contrat hors établissement)
  const [isHorsEtablissement, setIsHorsEtablissement] = useState(initialData?.isHorsEtablissement ?? true)
  const [companySiren, setCompanySiren] = useState('')
  const [companyNafLabel, setCompanyNafLabel] = useState('')
  const [officialLegalForm, setOfficialLegalForm] = useState('')

  const [tvaEnabled, setTvaEnabled] = useState(initialData?.tvaEnabled || false)
  const [tvaNumber, setTvaNumber] = useState(initialData?.tvaNumber || '')

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
  const [iban, setIban] = useState(initialData?.iban || '')
  const [bic, setBic] = useState(initialData?.bic || '')
  const [paymentCondition, setPaymentCondition] = useState(initialData?.paymentCondition || t('devis.paymentCondValues.immediate'))

  const [lines, setLines] = useState<ProductLine[]>(initialData?.lines || [])
  const [devisEtapes, setDevisEtapes] = useState<DevisEtape[]>(initialData?.etapes || [])
  const [notes, setNotes] = useState(initialData?.notes || (initialData?.docNumber ? (locale === 'pt' ? `Ref. orçamento: ${initialData.docNumber}` : `Réf. devis : ${initialData.docNumber}`) : ''))
  const [docTitle, setDocTitle] = useState(initialData?.docTitle || '')
  // ─── Linked booking for Vitfix channel ───
  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState<'pdf' | 'validate' | null>(null)
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
      [/peinture|peintre|ravalement|enduit|revetement mural/, 'm²'],
      [/electricite|electri(?:que|cien)|tableau|prise|interrupteur|eclairage|domotique/, 'forfait'],
      [/carrelage|carreleur|faience|mosaique|sol|revetement de sol/, 'm²'],
      [/maconnerie|macon|beton|dalle|fondation|agglo|parpaing|mur/, 'm²'],
      [/menuiserie|menuisier|porte|fenetre|volet|placard|escalier|bois/, 'u'],
      [/chauffage|chauffagiste|chaudiere|radiateur|clim|climatisation|pac|pompe a chaleur/, 'forfait'],
      [/toiture|couvreur|couverture|toit|gouttiere|zinguerie|ardoise|tuile/, 'm²'],
      [/nettoyage|menage|entretien|proprete|lavage|desinfection/, 'm²'],
      [/serrurerie|serrurier|serrure|verrou|blindage|ouverture de porte/, 'forfait'],
      [/vitrerie|vitrier|vitre|vitrage|double vitrage|miroir/, 'u'],
      [/elagage|abattage|arbre|haie|taille de|souche/, 'u'],
      [/jardinage|jardinier|espaces verts|tonte|debroussaillage|gazon|pelouse/, 'h'],
      [/demenagement|demenageur/, 'forfait'],
      [/isolation|isolant|combles|laine|polystyrene/, 'm²'],
      [/platrerie|platrier|placo|placoplatre|cloison|faux plafond/, 'm²'],
      [/terrassement|demolition|evacuation|deblai/, 'm³'],
      [/diagnostic|expertise|audit|controle|inspection/, 'forfait'],
      [/depannage|urgence|intervention/, 'forfait'],
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
        'm2': 'm²', 'ml': 'ml', 'm3': 'm³', 'heure': 'h',
        'forfait': 'forfait', 'unite': 'u', 'arbre': 'u',
        'tonne': 'kg', 'kg': 'kg', 'lot': 'lot',
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
      // Copier les étapes sur le devis
      const copiedEtapes: DevisEtape[] = etapesTemplate.map((et, i) => ({
        id: `etape_${Date.now()}_${i}`,
        ordre: et.ordre,
        designation: et.designation,
        source_etape_id: et.id,
      }))
      setDevisEtapes(copiedEtapes)

      // Remplacer la ligne actuelle par N lignes (une par étape)
      // La première reprend la ligne existante, les suivantes sont ajoutées
      const newLines: ProductLine[] = etapesTemplate.map((et, i) => ({
        id: Date.now() + i,
        description: et.designation,
        qty: 1,
        unit: serviceUnit,
        priceHT: 0,  // Prix NULL → artisan doit remplir
        tvaRate: defaultTvaRate,
        totalHT: 0,
        source: 'etape_motif' as const,
        etape_id: `etape_${Date.now()}_${i}`,
      }))

      // Remplacer la ligne placeholder par les lignes étapes
      setLines(prev => {
        const filtered = prev.filter(l => l.id !== lineId)
        return [...filtered, ...newLines]
      })
    } else {
      // Pas d'étapes → comportement classique (une seule ligne)
      setLines(prev => prev.map(line => {
        if (line.id !== lineId) return line
        return {
          ...line,
          description: service.name,
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
      setLines([{
        id: Date.now(),
        description: serviceName,
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

  const handleGeneratePDF = async () => {
    setPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTableModule = await import('jspdf-autotable')
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

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()  // 210mm
      const pageH = pdf.internal.pageSize.getHeight() // 297mm
      const mL = 18, mR = 18  // margins
      const contentW = pageW - mL - mR
      const col = '#1E293B', colLight = '#64748B', colAccent = '#FFC107'
      let y = 18

      // ─── Helper functions ───
      const drawLine = (x1: number, yPos: number, x2: number, color = '#E2E8F0', width = 0.3) => {
        pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
      }
      const centerText = (text: string, yPos: number, size: number, style: string = 'normal', color: string = col) => {
        pdf.setFontSize(size); pdf.setFont('helvetica', style); pdf.setTextColor(color)
        pdf.text(text, pageW / 2, yPos, { align: 'center' })
      }
      const labelValue = (label: string, value: string, x: number, yPos: number, maxW: number) => {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
        pdf.text(label, x, yPos)
        const labelW = pdf.getTextWidth(label)
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        const valLines = pdf.splitTextToSize(value, maxW - labelW - 1)
        pdf.text(valLines, x + labelW + 1, yPos)
        return valLines.length * 3.2
      }

      const dateLocaleStr = locale === 'pt' ? 'pt-PT' : 'fr-FR'

      // ═══ 1. TITRE ═══
      // Titre de l'intervention/projet en gros
      if (docTitle) {
        centerText(docTitle.toUpperCase(), y, 14, 'bold')
        y += 5
      }
      // Numéro du document — pour PT afficher le numéro fiscal AT (ex: "FT VTF/1"), sinon numéro interne
      const displayDocNumber = (ptFiscalData?.docNumber) ? ptFiscalData.docNumber : docNumber
      centerText(displayDocNumber, y, 8, 'normal', colLight)
      y += 4

      // ── PT Fiscal: ATCUD + Hash (Portugal invoices only) ──
      if (ptFiscalData) {
        centerText(ptFiscalData.atcudDisplay, y, 7, 'bold', '#1D4ED8')
        y += 3.5
        centerText(`Hash: ${ptFiscalData.hashDisplay}`, y, 6, 'normal', colLight)
        y += 3.5
      }

      // Petit trait centré
      drawLine(pageW / 2 - 15, y, pageW / 2 + 15, colAccent, 0.8)
      y += 6

      // ═══ 2. ÉMETTEUR + DESTINATAIRE ═══
      const boxW = (contentW - 6) / 2
      const boxStartY = y
      const boxPad = 4

      // ── Émetteur box ──
      const emX = mL
      pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
      // Header — centré dans la box gauche (pas au milieu de la page)
      const emCenterX = emX + boxW / 2
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(t('devis.pdf.emitter'), emCenterX, boxStartY + boxPad, { align: 'center' })
      // petit trait centré sous le header
      drawLine(emCenterX - 8, boxStartY + boxPad + 2, emCenterX + 8, '#E2E8F0', 0.2)
      let ey = boxStartY + boxPad + 5
      const emMaxW = boxW - boxPad * 2
      // We need to position text within the left box
      const emLx = emX + boxPad
      ey += labelValue(t('devis.pdf.company'), companyName, emLx, ey, emMaxW)
      if (companySiret) ey += labelValue(t('devis.pdf.siret'), companySiret, emLx, ey, emMaxW)
      if (companyRCS) ey += labelValue(t('devis.pdf.rcsRm'), companyRCS, emLx, ey, emMaxW)
      if (companyCapital) ey += labelValue(t('devis.pdf.capital'), `${companyCapital} €`, emLx, ey, emMaxW)
      if (companyAddress) ey += labelValue(t('devis.pdf.address'), companyAddress, emLx, ey, emMaxW)
      if (companyPhone) ey += labelValue(t('devis.pdf.tel'), companyPhone, emLx, ey, emMaxW)
      if (companyEmail) ey += labelValue(t('devis.pdf.email'), companyEmail, emLx, ey, emMaxW)
      if (tvaEnabled && tvaNumber) ey += labelValue(t('devis.pdf.tvaNumber'), tvaNumber, emLx, ey, emMaxW)
      if (insuranceName) {
        ey += 1
        const insLabel = insuranceType === 'rc_pro' ? t('devis.pdf.rcPro') : insuranceType === 'decennale' ? t('devis.pdf.decennale') : t('devis.pdf.rcProDec')
        ey += labelValue(`${insLabel} : `, insuranceName, emLx, ey, emMaxW)
      }
      if (insuranceNumber) ey += labelValue(t('devis.pdf.contractNumber'), insuranceNumber, emLx, ey, emMaxW)
      if (insuranceCoverage) ey += labelValue(t('devis.pdf.coverage'), insuranceCoverage, emLx, ey, emMaxW)

      // ── Destinataire box ──
      const destX = emX + boxW + 6
      const destCenterX = destX + boxW / 2
      // Header — centré dans la box droite
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(t('devis.pdf.recipient'), destCenterX, boxStartY + boxPad, { align: 'center' })
      drawLine(destCenterX - 8, boxStartY + boxPad + 2, destCenterX + 8, '#E2E8F0', 0.2)
      let dy = boxStartY + boxPad + 5
      const destLx = destX + boxPad
      const destMaxW = boxW - boxPad * 2
      dy += labelValue(t('devis.pdf.name'), clientName, destLx, dy, destMaxW)
      if (clientAddress) dy += labelValue(t('devis.pdf.address'), clientAddress, destLx, dy, destMaxW)
      if (interventionAddress) dy += labelValue(t('devis.pdf.interventionLocation'), interventionAddress, destLx, dy, destMaxW)
      if (clientPhone) dy += labelValue(t('devis.pdf.tel'), clientPhone, destLx, dy, destMaxW)
      if (clientEmail) dy += labelValue(t('devis.pdf.email'), clientEmail, destLx, dy, destMaxW)
      if (clientSiret) dy += labelValue(t('devis.pdf.siret'), clientSiret, destLx, dy, destMaxW)

      const boxH = Math.max(ey, dy) - boxStartY + 2
      // Draw box borders
      pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
      pdf.roundedRect(emX, boxStartY, boxW, boxH, 1.5, 1.5, 'S')
      pdf.roundedRect(destX, boxStartY, boxW, boxH, 1.5, 1.5, 'S')
      // Les headers ÉMETTEUR et DESTINATAIRE sont déjà correctement centrés dans leurs boxes respectives

      y = boxStartY + boxH + 6

      // ═══ 3. DATE / VALIDITÉ / DÉLAI ═══
      pdf.setFillColor('#F8FAFC'); pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
      pdf.roundedRect(mL, y, contentW, 8, 1.5, 1.5, 'FD')
      let infoX = mL + 4
      const infoY = y + 5.5
      pdf.setFontSize(7.5)
      const drawInfo = (label: string, val: string) => {
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
        pdf.text(label, infoX, infoY)
        infoX += pdf.getTextWidth(label) + 0.5
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(val, infoX, infoY)
        infoX += pdf.getTextWidth(val) + 6
      }
      // Date d'émission = TOUJOURS la date de création du document (aujourd'hui)
      drawInfo(t('devis.pdf.issueDate'), docDate ? new Date(docDate).toLocaleDateString(dateLocaleStr) : docDate)
      if (docType === 'devis') {
        if (docValidity) drawInfo(t('devis.pdf.validity'), `${docValidity} ${t('devis.pdf.days')}`)
        if (executionDelay) drawInfo(t('devis.pdf.executionDelay'), executionDelay)
        if (prestationDate) drawInfo(t('devis.pdf.prestationDate'), new Date(prestationDate).toLocaleDateString(dateLocaleStr))
      }
      if (docType === 'facture') {
        if (prestationDate) drawInfo(t('devis.pdf.prestation'), new Date(prestationDate).toLocaleDateString(dateLocaleStr))
        if (paymentDue) drawInfo(t('devis.pdf.dueDate'), new Date(paymentDue).toLocaleDateString(dateLocaleStr))
        if (sourceDevisRef) drawInfo(t('devis.pdf.devisRef'), sourceDevisRef)
      }
      y += 12

      // ═══ 4. TABLEAU PRESTATIONS (autoTable) ═══
      const priceLabel = tvaEnabled ? t('devis.ht') : t('devis.ttc')
      const tableHead = tvaEnabled
        ? [[t('devis.designation'), t('devis.qty'), t('devis.unit'), `${t('devis.unitPrice')} ${priceLabel}`, `${localeFormats.taxLabel} %`, `${t('devis.total')} ${priceLabel}`]]
        : [[t('devis.designation'), t('devis.qty'), t('devis.unit'), `${t('devis.unitPrice')} ${priceLabel}`, `${t('devis.total')} ${priceLabel}`]]

      const tableBody = lines.filter(l => l.description.trim()).map(l => {
        const unitStr = l.unit ? (l.unit === 'u' ? 'u' : l.unit) : 'u'
        const row = [l.description, String(l.qty), unitStr, localeFormats.currencyFormat(l.priceHT)]
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

      const colStyles: any = {
        0: { cellWidth: contentW * 0.36, halign: 'left' },    // Désignation — aligné à gauche
        1: { cellWidth: contentW * 0.08, halign: 'center' },  // Qté — centré
        2: { cellWidth: contentW * 0.08, halign: 'center' },  // Unité — centré
        3: { cellWidth: contentW * 0.16, halign: 'right' },   // Prix U.
      }
      if (tvaEnabled) {
        colStyles[4] = { cellWidth: contentW * 0.10, halign: 'center' }  // TVA
        colStyles[5] = { cellWidth: contentW * 0.22, halign: 'right' }   // Total
      } else {
        colStyles[4] = { cellWidth: contentW * 0.32, halign: 'right' }   // Total
      }

      // Head styles par colonne — alignement identique header/body
      const headColStyles: any = {
        0: { halign: 'left' },     // Désignation
        1: { halign: 'center' },   // Qté
        2: { halign: 'center' },   // Unité
        3: { halign: 'right' },    // Prix U.
      }
      if (tvaEnabled) {
        headColStyles[4] = { halign: 'center' }  // TVA
        headColStyles[5] = { halign: 'right' }   // Total
      } else {
        headColStyles[4] = { halign: 'right' }   // Total
      }

      autoTable(pdf, {
        head: tableHead,
        body: tableBody,
        startY: y,
        margin: { left: mL, right: mR },
        theme: 'plain',
        headStyles: {
          fillColor: [255, 193, 7],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 3,
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          textColor: [30, 41, 59],
          lineWidth: 0.1,
          lineColor: [241, 245, 249],
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: colStyles,
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.3,
        didDrawPage: () => {},
        didParseCell: (data: any) => {
          // Appliquer l'alignement cohérent aux headers
          if (data.section === 'head' && headColStyles[data.column.index]) {
            data.cell.styles.halign = headColStyles[data.column.index].halign
          }
        },
      })

      y = (pdf as any).lastAutoTable.finalY + 6

      // ═══ 5. TOTAUX (aligné à droite) ═══
      const totBoxW = 70, totBoxX = pageW - mR - totBoxW
      pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
      // Sous-total
      pdf.setFillColor('#F8FAFC')
      pdf.rect(totBoxX, y, totBoxW, 7, 'FD')
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
      pdf.text(tvaEnabled ? t('devis.pdf.subtotalHT') : t('devis.pdf.subtotal'), totBoxX + 3, y + 5)
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(localeFormats.currencyFormat(subtotalHT), totBoxX + totBoxW - 3, y + 5, { align: 'right' })
      y += 7

      if (tvaEnabled) {
        pdf.setFillColor('#F8FAFC')
        pdf.rect(totBoxX, y, totBoxW, 7, 'FD')
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
        pdf.text(t('devis.pdf.tva'), totBoxX + 3, y + 5)
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(localeFormats.currencyFormat(totalTVA), totBoxX + totBoxW - 3, y + 5, { align: 'right' })
        y += 7
      }

      if (docType === 'facture' && discount) {
        pdf.setFillColor('#F8FAFC')
        pdf.rect(totBoxX, y, totBoxW, 7, 'FD')
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
        pdf.text(t('devis.pdf.discount'), totBoxX + 3, y + 5)
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(discount, totBoxX + totBoxW - 3, y + 5, { align: 'right' })
        y += 7
      }

      // Total final — bande accent
      const totalVal = tvaEnabled ? totalTTC : subtotalHT
      pdf.setFillColor(colAccent)
      pdf.rect(totBoxX, y, totBoxW, 10, 'F')
      pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(tvaEnabled ? t('devis.pdf.totalTTC') : t('devis.pdf.totalNet'), totBoxX + 3, y + 7)
      pdf.text(localeFormats.currencyFormat(totalVal), totBoxX + totBoxW - 3, y + 7, { align: 'right' })
      y += 16

      // ═══ 6. CONDITIONS + SIGNATURE (devis) ou CONDITIONS DE PAIEMENT (facture) ═══
      if (y > pageH - 80) { pdf.addPage(); y = 18 }

      if (docType === 'devis') {
        const condW = contentW * 0.55
        const sigW = contentW - condW - 6
        const condX = mL, sigX = mL + condW + 6
        const condStartY = y

        // Conditions box
        pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        const condCenterX = condX + condW / 2
        pdf.text(t('devis.pdf.conditions'), condCenterX, condStartY + 4, { align: 'center' })
        drawLine(condCenterX - 8, condStartY + 6, condCenterX + 8, '#E2E8F0', 0.2)
        let cy = condStartY + 10
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#475569')
        const validityStr = docValidity ? `${docValidity} ${t('devis.pdf.days')}` : `30 ${t('devis.pdf.days')}`
        const condLines = [
          t('devis.pdf.validityCondition').replace('{validity}', validityStr),
          ...(executionDelay ? [t('devis.pdf.executionDelayCondition').replace('{delay}', executionDelay)] : []),
          t('devis.pdf.amendmentClause'),
          ...(paymentMode ? [t('devis.pdf.paymentModeCondition').replace('{mode}', paymentMode)] : []),
        ]
        condLines.forEach(line => {
          const wrapped = pdf.splitTextToSize(line, condW - 8)
          pdf.text(wrapped, condX + 4, cy)
          cy += wrapped.length * 3
        })
        const condH = Math.max(cy - condStartY + 2, 35)
        pdf.roundedRect(condX, condStartY, condW, condH, 1.5, 1.5, 'S')

        // Signature box
        const sigCenterX = sigX + sigW / 2
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(t('devis.pdf.approvalTitle'), sigCenterX, condStartY + 4, { align: 'center' })
        drawLine(sigCenterX - 10, condStartY + 6, sigCenterX + 10, '#E2E8F0', 0.2)

        if (signatureData) {
          // ── Signature électronique présente → embed dans le PDF ──
          pdf.setFontSize(6); pdf.setFont('helvetica', 'italic'); pdf.setTextColor('#6B7280')
          pdf.text(locale === 'pt' ? 'Bom para acordo' : 'Bon pour accord', sigX + 4, condStartY + 10)

          // Render SVG signature as PNG image
          try {
            const sigImgDataUrl = await svgToImageDataUrl(signatureData.svg_data, 400, 140)
            const sigImgW = sigW - 8
            const sigImgH = sigImgW * (140 / 400) // maintain aspect ratio
            pdf.addImage(sigImgDataUrl, 'PNG', sigX + 4, condStartY + 12, sigImgW, sigImgH)

            // Signer name + date below signature
            const sigInfoY = condStartY + 12 + sigImgH + 2
            pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
            pdf.text(signatureData.signataire, sigX + 4, sigInfoY)
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
            const sigDateStr = new Date(signatureData.timestamp).toLocaleString(dateLocaleStr)
            pdf.text(sigDateStr, sigX + 4, sigInfoY + 3.5)
          } catch {
            // Fallback: just show text if SVG render fails
            pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
            pdf.text(signatureData.signataire, sigX + 4, condStartY + 14)
            pdf.setFontSize(6); pdf.setTextColor('#6B7280')
            pdf.text(new Date(signatureData.timestamp).toLocaleString(dateLocaleStr), sigX + 4, condStartY + 18)
          }

          // Audit trail (eIDAS art. 25.1)
          pdf.setFontSize(4.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#9CA3AF')
          const auditY = condStartY + condH - 8
          pdf.text(`SHA-256: ${signatureData.hash_sha256.substring(0, 32)}...`, sigX + 4, auditY)
          pdf.text(locale === 'pt' ? 'Assinatura eletrónica simples — art. 25.1 eIDAS' : 'Signature électronique simple — art. 25.1 eIDAS', sigX + 4, auditY + 3)
        } else {
          // ── Pas de signature → zones vierges à remplir à la main ──
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
          pdf.text(t('devis.pdf.handwrittenMention'), sigX + 4, condStartY + 10)
          pdf.setFont('helvetica', 'italic'); pdf.setFontSize(5.5); pdf.setTextColor('#9CA3AF')
          const mentionText = t('devis.pdf.approvalText')
          const mentionWrapped = pdf.splitTextToSize(mentionText, sigW - 8)
          pdf.text(mentionWrapped, sigX + 4, condStartY + 14)
          const mentionEndY = condStartY + 14 + mentionWrapped.length * 2.5
          drawLine(sigX + 4, mentionEndY + 3, sigX + sigW - 4, '#D1D5DB', 0.2)
          pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
          pdf.text(t('devis.pdf.dateField'), sigX + 4, mentionEndY + 7)
          pdf.text(t('devis.pdf.signatureField'), sigX + 4, mentionEndY + 11)
        }
        pdf.roundedRect(sigX, condStartY, sigW, condH, 1.5, 1.5, 'S')

        y = condStartY + condH + 6
      } else if (docType === 'facture') {
        // Section complète CONDITIONS DE RÈGLEMENT pour facture
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

        // Calcul hauteur dynamique d'abord
        const condStartY = y
        const condCenterX = mL + contentW / 2
        let measureY = condStartY + 10
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
        payLines.forEach(line => {
          const wrapped = pdf.splitTextToSize(line, contentW - 8)
          measureY += wrapped.length * 3 + 0.5
        })
        const condH = Math.max(measureY - condStartY + 2, 20)

        // Dessiner le fond en premier
        pdf.setFillColor('#EFF6FF'); pdf.setDrawColor('#BFDBFE'); pdf.setLineWidth(0.3)
        pdf.roundedRect(mL, condStartY, contentW, condH, 1.5, 1.5, 'FD')

        // Header
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#1D4ED8')
        pdf.text(t('devis.pdf.paymentConditionsTitle'), condCenterX, condStartY + 4, { align: 'center' })
        drawLine(condCenterX - 15, condStartY + 6, condCenterX + 15, '#BFDBFE', 0.2)

        // Contenu
        let cy = condStartY + 10
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#1E40AF')
        payLines.forEach(line => {
          const wrapped = pdf.splitTextToSize(line, contentW - 8)
          pdf.text(wrapped, mL + 4, cy)
          cy += wrapped.length * 3 + 0.5
        })
        y = condStartY + condH + 4
      }

      // ═══ 7. NOTES ═══
      if (notes && y < pageH - 30) {
        pdf.setFillColor('#FFFBEB'); pdf.setDrawColor('#FDE68A'); pdf.setLineWidth(0.3)
        const noteWrapped = pdf.splitTextToSize(t('devis.pdf.notes').replace('{notes}', notes), contentW - 8)
        const noteH = noteWrapped.length * 3.5 + 6
        pdf.roundedRect(mL, y, contentW, noteH, 1.5, 1.5, 'FD')
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#78350F')
        pdf.text(noteWrapped, mL + 4, y + 4)
        y += noteH + 4
      }

      // ═══ 8. RAPPORT JOINT ═══
      if (attachedRapport && y < pageH - 25) {
        pdf.setFillColor('#FFF7ED'); pdf.setDrawColor('#FED7AA'); pdf.setLineWidth(0.3)
        const rapportLines: string[] = []
        rapportLines.push(t('devis.pdf.attachedReport').replace('{number}', attachedRapport.rapportNumber))
        if (attachedRapport.interventionDate) rapportLines.push(t('devis.pdf.reportDate').replace('{date}', new Date(attachedRapport.interventionDate).toLocaleDateString(dateLocaleStr)) + (attachedRapport.startTime ? ` ${locale === 'pt' ? 'das' : 'de'} ${attachedRapport.startTime}` : '') + (attachedRapport.endTime ? ` ${locale === 'pt' ? 'às' : 'à'} ${attachedRapport.endTime}` : ''))
        if (attachedRapport.motif) rapportLines.push(t('devis.pdf.reportMotif').replace('{motif}', attachedRapport.motif))
        if (attachedRapport.siteAddress) rapportLines.push(t('devis.pdf.reportLocation').replace('{location}', attachedRapport.siteAddress))
        const rapportH = rapportLines.length * 3.5 + 6
        pdf.roundedRect(mL, y, contentW, rapportH, 1.5, 1.5, 'FD')
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#9A3412')
        pdf.text(rapportLines[0], mL + 4, y + 4)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#78350F')
        rapportLines.slice(1).forEach((rl, i) => pdf.text(rl, mL + 4, y + 4 + (i + 1) * 3.5))
        y += rapportH + 4
      }

      // ═══ 9. PT FISCAL: QR CODE + CERTIFICATION ═══
      if (ptFiscalData) {
        if (y > pageH - 55) { pdf.addPage(); y = 18 }

        // QR Code — bottom right
        const qrSize = 28 // 28mm QR code
        const qrX = pageW - mR - qrSize
        const qrY = y

        try {
          const QRCode = (await import('qrcode')).default
          const qrDataUrl = await QRCode.toDataURL(ptFiscalData.qrCodeString, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'M',
          })
          pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
        } catch (qrErr) {
          console.warn('[PT Fiscal] QR code generation failed:', qrErr)
          // Fallback: draw placeholder
          pdf.setDrawColor('#D1D5DB'); pdf.setLineWidth(0.3)
          pdf.rect(qrX, qrY, qrSize, qrSize)
          pdf.setFontSize(5); pdf.setTextColor('#9CA3AF')
          pdf.text('QR Code', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' })
        }

        // Certification mention — left of QR code
        const certY = qrY + 2
        pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#1D4ED8')
        pdf.text(ptFiscalData.atcudDisplay, mL, certY)

        pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
        pdf.text(`Hash: ${ptFiscalData.hashDisplay}`, mL, certY + 3.5)
        pdf.text(`Processado por programa certificado n.º ${ptFiscalData.certNumber}`, mL, certY + 7)
        pdf.text('Vitfix Pro — https://vitfix.pt', mL, certY + 10.5)

        y = qrY + qrSize + 4
      }

      // ═══ 10. MENTIONS LÉGALES ═══
      if (y > pageH - 20) { pdf.addPage(); y = 18 }
      drawLine(mL, y, pageW - mR, '#E5E7EB', 0.2)
      y += 3
      pdf.setFontSize(5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#9CA3AF')
      const legalMentionsJoined = getLegalMentions().join(' — ')
      const tvaIntraSuffix = tvaEnabled && tvaNumber ? ` — ${t('devis.legal.tvaIntraNumber').replace('{number}', tvaNumber)}` : ''
      const legalText = t('devis.pdf.legalMentionsFull')
        .replace('{mentions}', legalMentionsJoined + tvaIntraSuffix)
        .replace('{date}', new Date().toLocaleDateString(dateLocaleStr))
      const legalWrapped = pdf.splitTextToSize(legalText, ptFiscalData ? contentW - 32 : contentW)
      pdf.text(legalWrapped, mL, y)

      // ═══ PAGE 2 — RÉTRACTATION ═══
      if (docType === 'devis' && isHorsEtablissement && clientSiret.trim().length === 0) {
        pdf.addPage()
        let ry = 18
        // Petit trait accent en haut
        drawLine(pageW / 2 - 15, ry - 4, pageW / 2 + 15, colAccent, 0.8)
        const docLabel = docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')
        centerText(`${docLabel} ${docNumber} — ${companyName} — ${t('devis.pdf.page2of2')}`, ry, 7, 'normal', colLight)
        ry += 8

        // Encadré rétractation
        pdf.setFillColor('#FFF8F0'); pdf.setDrawColor('#F59E0B'); pdf.setLineWidth(0.5)
        const retBoxH = 110
        pdf.roundedRect(mL, ry, contentW, retBoxH, 2, 2, 'FD')

        centerText(t('devis.pdf.withdrawalTitle'), ry + 7, 9, 'bold', '#B45309')
        ry += 14
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#92400E')
        const retLines = [
          t('devis.pdf.withdrawalText1'),
          "",
          t('devis.pdf.withdrawalText2'),
        ]
        retLines.forEach(rl => {
          if (rl === '') { ry += 2; return }
          const wrapped = pdf.splitTextToSize(rl, contentW - 12)
          pdf.text(wrapped, mL + 6, ry)
          ry += wrapped.length * 3.2
        })
        ry += 2
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#92400E')
        const urgentText = t('devis.pdf.withdrawalPayment')
        const urgentWrapped = pdf.splitTextToSize(urgentText, contentW - 12)
        pdf.text(urgentWrapped, mL + 6, ry)
        ry += urgentWrapped.length * 3.2 + 4

        // Formulaire
        drawLine(mL + 10, ry, pageW - mR - 10, '#F59E0B', 0.3)
        ry += 5
        centerText(t('devis.pdf.withdrawalFormTitle'), ry, 8, 'bold', '#B45309')
        ry += 5
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#92400E')
        pdf.text(t('devis.pdf.withdrawalFormTo').replace('{company}', companyName).replace('{address}', companyAddress), mL + 6, ry); ry += 4
        pdf.text(t('devis.pdf.withdrawalFormNotice'), mL + 6, ry); ry += 6
        const formFields = [t('devis.pdf.withdrawalFormOrderDate'), t('devis.pdf.withdrawalFormClientName'), t('devis.pdf.withdrawalFormClientAddress'), t('devis.pdf.withdrawalFormClientSignature'), t('devis.pdf.withdrawalFormDate')]
        formFields.forEach(f => {
          pdf.text(f, mL + 6, ry)
          const fw = pdf.getTextWidth(f) + 2
          drawLine(mL + 6 + fw, ry + 0.5, pageW - mR - 10, '#D1D5DB', 0.2)
          ry += 6
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
        drawLine(pageW / 2 - 15, py - 4, pageW / 2 + 15, colAccent, 0.8)
        centerText(`${docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')} ${docNumber} — ${t('devis.pdf.annexePhotos')}`, py, 9, 'bold', col)
        py += 5
        centerText(t('devis.pdf.photosGeotagged').replace('{count}', String(selectedPhotos.length)), py, 7, 'normal', colLight)
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
            centerText(`${docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')} ${docNumber} — ${t('devis.pdf.annexePhotosSuite')}`, py, 7, 'normal', colLight)
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

            {/* ─── Section: Étapes de l'intervention ─── */}
            {devisEtapes.length > 0 && (
              <div className="v22-card" style={{ marginBottom: 16 }}>
                <div className="v22-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="v22-card-title">{'📋'} {locale === 'pt' ? 'Etapas da intervenção' : 'Étapes de l\'intervention'}</span>
                  <span style={{ fontSize: 11, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>
                    {locale === 'pt' ? 'Visível pelo cliente no orçamento' : 'Visible par le client sur le devis'}
                  </span>
                </div>
                <div className="v22-card-body" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    {devisEtapes.sort((a, b) => a.ordre - b.ordre).map((etape, index) => (
                      <div key={etape.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px', borderRadius: 6,
                        border: '1px solid var(--v22-border)', background: 'var(--v22-surface)',
                        fontSize: 13,
                      }}>
                        <span style={{ color: 'var(--v22-text-muted)', fontSize: 11, minWidth: 22, textAlign: 'center' }}>
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          value={etape.designation}
                          onChange={(e) => {
                            const newDesignation = e.target.value
                            setDevisEtapes(prev => prev.map(et =>
                              et.id === etape.id ? { ...et, designation: newDesignation } : et
                            ))
                            // Sync: mettre à jour la ligne de devis liée
                            setLines(prev => prev.map(l =>
                              l.etape_id === etape.id ? { ...l, description: newDesignation } : l
                            ))
                          }}
                          className="v22-form-input"
                          style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: 'none', background: 'transparent' }}
                        />
                        <button
                          onClick={() => {
                            setDevisEtapes(prev => prev.filter(et => et.id !== etape.id))
                            // Proposer de supprimer la ligne de devis liée
                            const linkedLine = lines.find(l => l.etape_id === etape.id)
                            if (linkedLine) {
                              setLines(prev => prev.filter(l => l.etape_id !== etape.id))
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', color: 'var(--v22-red)' }}
                          title={locale === 'pt' ? 'Remover' : 'Supprimer'}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Ajouter une étape manuellement */}
                  <button
                    onClick={() => {
                      const newId = `etape_manual_${Date.now()}`
                      const newOrdre = devisEtapes.length > 0 ? Math.max(...devisEtapes.map(e => e.ordre)) + 1 : 0
                      setDevisEtapes(prev => [...prev, { id: newId, ordre: newOrdre, designation: '' }])
                      // Créer aussi une ligne de devis vide
                      setLines(prev => [...prev, {
                        id: Date.now(),
                        description: '',
                        qty: 1,
                        unit: 'forfait',
                        priceHT: 0,
                        tvaRate: defaultTvaRate,
                        totalHT: 0,
                        source: 'etape_motif',
                        etape_id: newId,
                      }])
                    }}
                    className="v22-btn v22-btn-sm"
                    style={{ fontSize: 12 }}
                  >
                    + {locale === 'pt' ? 'Adicionar etapa' : 'Ajouter une étape'}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 8, fontStyle: 'italic' }}>
                    {'ℹ️'} {locale === 'pt'
                      ? 'Estas etapas não modificam o template do motivo nos seus parâmetros.'
                      : 'Ces étapes ne modifient pas le template du motif dans vos paramètres.'}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Section: Prestations ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.prestationsSection')}</span>
              </div>
              <div className="v22-card-body" style={{ padding: 0 }}>
                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="v22-devis-table" style={{ minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>{t('devis.designation')}</th>
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
                        <tr key={line.id}>
                          <td>
                            {line.description ? (
                              <input
                                type="text"
                                value={line.description}
                                onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                                className="v22-form-input"
                              />
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
                          <td>
                            <input
                              type="number"
                              value={line.qty}
                              onChange={(e) => updateLine(line.id, 'qty', parseInt(e.target.value) || 1)}
                              min={1}
                              className="v22-form-input"
                              style={{ textAlign: 'center' }}
                            />
                          </td>
                          <td>
                            <select
                              value={line.unit || 'u'}
                              onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                              className="v22-form-input"
                            >
                              <option value="u">{t('devis.unitOptions.u')}</option>
                              <option value="m²">{t('devis.unitOptions.m2')}</option>
                              <option value="m³">{t('devis.unitOptions.m3')}</option>
                              <option value="ml">{t('devis.unitOptions.ml')}</option>
                              <option value="h">{t('devis.unitOptions.h')}</option>
                              <option value="forfait">{t('devis.unitOptions.forfait')}</option>
                              <option value="kg">{t('devis.unitOptions.kg')}</option>
                              <option value="tonne">{t('devis.unitOptions.tonne')}</option>
                              <option value="lot">{t('devis.unitOptions.lot')}</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              value={line.priceHT}
                              onChange={(e) => updateLine(line.id, 'priceHT', parseFloat(e.target.value) || 0)}
                              step="0.01"
                              className="v22-form-input"
                            />
                          </td>
                          <td>
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
                          <td>
                            <div className="v22-amount" style={{ padding: '7px 10px', background: 'var(--v22-bg)', borderRadius: 3 }}>
                              {localeFormats.currencyFormat(line.totalHT)}
                            </div>
                          </td>
                          <td>
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

                <div style={{ padding: 14 }}>
                  <button
                    onClick={addLine}
                    className="v22-btn"
                    style={{ width: '100%', border: '1px dashed var(--v22-border-dark)', background: 'var(--v22-surface)' }}
                  >
                    + {t('devis.addLine')}
                  </button>
                </div>
              </div>
            </div>

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
    </div>
  )
}
