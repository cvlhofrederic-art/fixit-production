'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import NextImage from 'next/image'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { getLocaleFormats, type Locale } from '@/lib/i18n/config'
import ReceiptScanner, { type DevisReceiptLine } from '@/components/common/ReceiptScanner'
import {
  type SignatureData,
  type ProductLine,
  type DevisEtape,
  type DevisAcompte,
  type DevisFactureData,
  type DevisFactureFormProps,
  type ServiceBasic,
  UNITES_DEVIS,
  UNITE_VALUES,
} from '@/lib/devis-types'
import {
  resolveLineUnit,
  getSelectValue,
  mapLegalFormToCode,
  getStatusLabel,
  getCompanyStatuses,
  isSocieteStatus,
  isSmallBusinessStatus,
} from '@/lib/devis-utils'
import { toast } from 'sonner'
import { buildV2Input } from '@/lib/pdf/build-v2-input'
import { generateDevisPdfV3 } from '@/lib/pdf/devis-pdf-v3'
import type { PdfV3PtFiscalData } from '@/lib/pdf/devis-pdf-v3'

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
  const [facturxLoading, setFacturxLoading] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // ─── Verified Company Data ───
  const [verifiedCompany, setVerifiedCompany] = useState<any>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)
  const [companyVerified, setCompanyVerified] = useState(false)

  // ─── State ───
  const [docType, setDocType] = useState<'devis' | 'facture'>(initialData?.docType || initialDocType)
  const [companyStatus, setCompanyStatus] = useState(
    initialData?.companyStatus || tpl('companyStatus') || (artisan?.legal_form ? mapLegalFormToCode(artisan.legal_form) : 'ei')
  )
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
  const [interventionBatiment, setInterventionBatiment] = useState(initialData?.interventionBatiment || '')
  const [interventionEtage, setInterventionEtage] = useState(initialData?.interventionEtage || '')
  const [interventionEspacesCommuns, setInterventionEspacesCommuns] = useState(initialData?.interventionEspacesCommuns || '')
  const [interventionExterieur, setInterventionExterieur] = useState(initialData?.interventionExterieur || '')
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '')
  const [clientSiret, setClientSiret] = useState(initialData?.clientSiret || '')
  const [clientType, setClientType] = useState(initialData?.clientType || '')

  // ─── Client Database Picker ───
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clientDbList, setClientDbList] = useState<Array<{ id: string; name: string; email?: string; phone?: string; type?: string; siret?: string; mainAddress?: string; address?: string; interventionAddresses?: Array<{ id: string; label: string; address: string }> }>>([])
  const [clientDbSearch, setClientDbSearch] = useState('')
  const [clientDbLoading, setClientDbLoading] = useState(false)
  const [selectedClientInterventionAddresses, setSelectedClientInterventionAddresses] = useState<Array<{ id: string; label: string; address: string }>>([])

  // Fetch client database when picker opens
  const loadClientDb = useCallback(async () => {
    if (!artisan?.id) return
    setClientDbLoading(true)
    try {
      // Fetch auth clients from API
      const res = await fetch(`/api/artisan-clients?artisan_id=${artisan.id}`)
      const data = await res.json()
      const authClients = (data.clients || []).map((c: Record<string, unknown>) => ({ ...c, source: 'auth' }))
      // Fetch manual clients from localStorage
      const manualRaw = localStorage.getItem(`fixit_manual_clients_${artisan.id}`)
      const manualClients = manualRaw ? JSON.parse(manualRaw).map((c: Record<string, unknown>) => ({ ...c, source: 'manual' })) : []
      setClientDbList([...authClients, ...manualClients])
    } catch { setClientDbList([]) }
    setClientDbLoading(false)
  }, [artisan?.id])

  const openClientPicker = () => {
    setShowClientPicker(true)
    setClientDbSearch('')
    loadClientDb()
  }

  const selectClientFromDb = (client: typeof clientDbList[0]) => {
    setClientName(client.name || '')
    setClientEmail(client.email || '')
    setClientPhone(client.phone || '')
    setClientAddress(client.mainAddress || client.address || '')
    setClientSiret(client.siret || '')
    setClientType(client.type || '')
    // Store intervention addresses for dropdown
    setSelectedClientInterventionAddresses(client.interventionAddresses || [])
    // Reset intervention fields
    setInterventionAddress('')
    setInterventionBatiment('')
    setInterventionEtage('')
    setInterventionEspacesCommuns('')
    setInterventionExterieur('')
    setShowClientPicker(false)
  }

  const isProClient = clientSiret.trim().length > 0 || ['syndic', 'professionnel', 'societe', 'conciergerie', 'agence_immobiliere', 'promoteur', 'architecte', 'collectivite', 'association', 'artisan_sous_traitant'].includes(clientType)

  const [docDate, setDocDate] = useState(initialData?.docDate || today)
  const [docValidity, setDocValidity] = useState(initialData?.docValidity || 30)
  const [prestationDate, setPrestationDate] = useState(initialData?.prestationDate || '')
  const [executionDelay, setExecutionDelay] = useState(initialData?.executionDelay || '')
  const [executionDelayDays, setExecutionDelayDays] = useState<number>(initialData?.executionDelayDays || 0)
  const [executionDelayType, setExecutionDelayType] = useState<'ouvres' | 'calendaires'>(initialData?.executionDelayType || 'ouvres')
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || t('devis.paymentModeOptions.transfer'))
  const [paymentDue, setPaymentDue] = useState(initialData?.paymentDue || dueDateStr)
  const [discount, setDiscount] = useState(initialData?.discount || '')
  const [iban, setIban] = useState(initialData?.iban || tpl('iban') || '')
  const [bic, setBic] = useState(initialData?.bic || tpl('bic') || '')
  const [paymentCondition, setPaymentCondition] = useState(initialData?.paymentCondition || t('devis.paymentCondValues.immediate'))

  const [lines, setLines] = useState<ProductLine[]>(initialData?.lines || [])
  const [editingDescLineId, setEditingDescLineId] = useState<number | null>(null)
  const [devisEtapes, setDevisEtapes] = useState<DevisEtape[]>(initialData?.etapes || [])
  const [notes, setNotes] = useState(initialData?.notes || (initialData?.docNumber ? (locale === 'pt' ? `Ref. orçamento: ${initialData.docNumber}` : `Réf. devis : ${initialData.docNumber}`) : ''))
  const [docTitle, setDocTitle] = useState(initialData?.docTitle || '')
  // Acomptes — charger l'échéancier par défaut si pas de données initiales
  const echeancierStorageKey = `fixit_echeancier_default_${artisan?.id || 'default'}`
  const loadDefaultEcheancier = (): DevisAcompte[] => {
    if (typeof window === 'undefined') return [{ id: 'default-1', ordre: 1, pourcentage: 30, declencheur: 'À la signature', label: 'Acompte 1' }]
    try {
      const saved = localStorage.getItem(echeancierStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as { label: string; pourcentage: number }[]
        if (parsed.length > 0) return parsed.map((s, i) => ({ id: crypto.randomUUID(), ordre: i + 1, label: `Acompte ${i + 1}`, pourcentage: s.pourcentage, declencheur: s.label }))
      }
    } catch (err) {
      console.warn('Failed to parse saved écheancier from localStorage:', err)
    }
    return [{ id: 'default-1', ordre: 1, pourcentage: 30, declencheur: 'À la signature', label: 'Acompte 1' }]
  }
  const [acomptesEnabled, setAcomptesEnabled] = useState(initialData?.acomptesEnabled !== undefined ? initialData.acomptesEnabled : true)
  const [acomptes, setAcomptes] = useState<DevisAcompte[]>(initialData?.acomptes || loadDefaultEcheancier())
  const [echeancierSaved, setEcheancierSaved] = useState(false)
  const saveEcheancierAsDefault = () => {
    try {
      const toSave = acomptes.filter(a => a.pourcentage > 0).map(a => ({ label: a.declencheur, pourcentage: a.pourcentage }))
      localStorage.setItem(echeancierStorageKey, JSON.stringify(toSave))
      setEcheancierSaved(true)
      setTimeout(() => setEcheancierSaved(false), 2000)
    } catch (err) {
      console.warn('Failed to save écheancier to localStorage:', err)
    }
  }
  // ─── Linked booking for Vitfix channel ───
  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState<'pdf' | 'validate' | null>(null)
  const [showReceiptScanner, setShowReceiptScanner] = useState(false)
  const [sendingVitfix, setSendingVitfix] = useState(false)

  // ─── Rentabilité BTP Pro Modal ───
  const [showRentaModal, setShowRentaModal] = useState(false)
  const [rentaNbEmployees, setRentaNbEmployees] = useState(1)
  const [rentaNbDays, setRentaNbDays] = useState(1)
  const [rentaMarginPct, setRentaMarginPct] = useState(30)
  const [rentaOverhead, setRentaOverhead] = useState(0)
  const [rentaMateriauxPct, setRentaMateriauxPct] = useState(15)
  const [rentaEmployees, setRentaEmployees] = useState<Array<{
    id: string; name: string; role: string; daily_cost: number;
    cost_per_hour: number; net_salary: number; employer_charges: number; btp_extras: number;
  }>>([])
  const [rentaLoading, setRentaLoading] = useState(false)
  const [rentaCountry, setRentaCountry] = useState<'FR' | 'PT'>('FR')

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
      } catch (e) { console.warn('[DevisFactureForm] Failed to fetch photos:', e); toast.error('Impossible de charger les photos') }
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

  // Generate document number — séquence atomique serveur (art. L441-9 C. com.)
  const isConversion = docType === 'facture' && initialData?.docType === 'devis' && initialData?.docNumber

  const [docNumber, setDocNumber] = useState('')
  const docNumberRef = useRef('')

  // Fetch next sequential number from server (atomic DB sequence)
  const fetchDocNumber = async (): Promise<string> => {
    if (docNumberRef.current) return docNumberRef.current
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader: Record<string, string> = session?.access_token
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : {}
      const res = await fetch('/api/doc-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ docType, year: new Date().getFullYear() }),
      })
      if (!res.ok) throw new Error(`Erreur serveur ${res.status}`)
      const { number } = await res.json()
      docNumberRef.current = number
      setDocNumber(number)
      return number
    } catch (err) {
      console.error('[DevisFactureForm] Failed to fetch doc number:', err)
      // Fallback visible — never silent N/A
      const fallback = `${docType === 'devis' ? 'DEV' : 'FACT'}-${new Date().getFullYear()}-DRAFT`
      setDocNumber(fallback)
      return fallback
    }
  }

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
    } catch (e) { console.warn('[DevisFactureForm] Failed to get auth headers:', e); toast.error('Erreur d\'authentification, veuillez vous reconnecter') }
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
      toast.error('Impossible de charger les données entreprise vérifiées')
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

    // Stocker les étapes sur la ligne (pas en global)
    const copiedEtapes: DevisEtape[] = etapesTemplate.map((et, i) => ({
      id: `etape_${Date.now()}_${i}`,
      ordre: i + 1,
      designation: et.designation,
      source_etape_id: et.id,
    }))

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
          etapes: copiedEtapes.length > 0 ? copiedEtapes : undefined,
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

      // Prefer explicit booking fields (set by client side) over notes parsing
      const finalName = booking.client_name || nameFromNotes
      const finalPhone = booking.client_phone || phoneFromNotes
      const finalEmail = booking.client_email || emailFromNotes
      const finalAddress = booking.client_address || booking.address || ''
      if (finalName) setClientName(finalName)
      if (finalPhone) setClientPhone(finalPhone)
      if (finalEmail && finalEmail !== '-') setClientEmail(finalEmail)
      if (finalAddress) setClientAddress(finalAddress)

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
        } catch (err) { /* ignore — we already have notes data */ console.warn('Could not enrich client data from account:', err) }
      }
    } catch (e) {
      console.error('importFromBooking error:', e)
      toast.error('Impossible d\'importer la réservation')
    } finally {
      setImportingBooking(false)
    }
  }

  // ─── Rentabilité BTP Pro ───
  const openRentaModal = useCallback(async () => {
    setShowRentaModal(true)
    setRentaLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
      const [membresRes, settingsRes] = await Promise.all([
        fetch('/api/btp?table=membres', { headers }),
        fetch('/api/btp?table=settings', { headers }),
      ])
      const membresData = membresRes.ok ? await membresRes.json() : { membres: [] }
      const settingsData = settingsRes.ok ? await settingsRes.json() : { settings: {} }
      const country = settingsData.settings?.country || 'FR'
      setRentaCountry(country)
      setRentaMarginPct(settingsData.settings?.objectif_marge_pct || 30)

      const { calculateEmployeeCost } = await import('@/lib/payroll/engine')
      const { resolveCompanyType } = await import('@/lib/config/companyTypes')

      const actifs = (membresData.membres || []).filter((m: { actif?: boolean; [key: string]: unknown }) => m.actif !== false)
      const mapped = actifs.map((m: { salaire_net_mensuel?: number; salaire_net?: number; heures_hebdo?: number; panier_repas_jour?: number; indemnite_trajet_jour?: number; prime_mensuelle?: number; charges_salariales_pct?: number; charges_patronales_pct?: number; nom?: string; prenom?: string; poste?: string; [key: string]: unknown }) => {
        const companyType = settingsData.settings?.company_type || settingsData.settings?.statut_juridique || (country === 'FR' ? 'sarl' : 'lda')
        const netSalary = m.salaire_net_mensuel || m.salaire_net || 0
        let dailyCost = 0, costH = 0, empCharges = 0, btpExtras = 0

        if (netSalary > 0) {
          const breakdown = calculateEmployeeCost({
            country, company_type: companyType, net_salary: netSalary,
            heures_hebdo: m.heures_hebdo || 35,
            panier_repas_jour: m.panier_repas_jour || 0,
            indemnite_trajet_jour: m.indemnite_trajet_jour || 0,
            prime_mensuelle: m.prime_mensuelle || 0,
            overrides: {
              employee_charge_rate: m.charges_salariales_pct ? m.charges_salariales_pct / 100 : undefined,
              employer_charge_rate: m.charges_patronales_pct ? m.charges_patronales_pct / 100 : undefined,
            },
          })
          dailyCost = breakdown.cost_per_day
          costH = breakdown.cost_per_hour
          empCharges = breakdown.employer_charges
          btpExtras = breakdown.btp_total
        } else {
          // Fallback : coût horaire simple
          const ch = m.cout_horaire || settingsData.settings?.cout_horaire_ouvrier || 15
          const cp = (m.charges_patronales_pct || m.charges_pct || settingsData.settings?.charges_patronales_pct || 45) / 100
          costH = ch * (1 + cp)
          dailyCost = costH * 7
          empCharges = ch * cp * 151.67
          btpExtras = 0
        }

        return {
          id: m.id || crypto.randomUUID(),
          name: `${m.prenom || ''} ${m.nom || ''}`.trim() || 'Employé',
          role: m.role || m.poste || m.type_contrat || 'Ouvrier',
          daily_cost: Math.round(dailyCost * 100) / 100,
          cost_per_hour: Math.round(costH * 100) / 100,
          net_salary: netSalary,
          employer_charges: Math.round(empCharges),
          btp_extras: Math.round(btpExtras),
        }
      })

      setRentaEmployees(mapped)
      setRentaNbEmployees(mapped.length || 1)
    } catch (e) {
      console.error('Rentabilité load error:', e)
      toast.error('Impossible de charger les données de rentabilité')
    }
    setRentaLoading(false)
  }, [])

  // ─── Calculations ───
  const subtotalHT = lines.reduce((sum, l) => sum + l.totalHT, 0)
  const totalTVA = tvaEnabled
    ? lines.reduce((sum, l) => sum + (l.totalHT * l.tvaRate / 100), 0)
    : 0
  const totalTTC = subtotalHT + totalTVA

  // Calculs rentabilité (dépend de subtotalHT)
  const rentaResult = useMemo(() => {
    if (!showRentaModal || rentaEmployees.length === 0) return null
    const selected = rentaEmployees.slice(0, rentaNbEmployees)
    const totalMO = selected.reduce((s, e) => s + e.daily_cost * rentaNbDays, 0)
    const materiauxEstime = subtotalHT > 0 ? subtotalHT * (rentaMateriauxPct / 100) : totalMO * (rentaMateriauxPct / 100)
    const coutTotal = totalMO + rentaOverhead + materiauxEstime
    const prixVente = subtotalHT > 0 ? subtotalHT : coutTotal / (1 - Math.min(rentaMarginPct, 99) / 100)
    const benefice = prixVente - coutTotal
    const margeReelle = prixVente > 0 ? (benefice / prixVente) * 100 : 0
    const status: 'profit' | 'warning' | 'loss' =
      margeReelle >= 25 ? 'profit' : margeReelle >= 10 ? 'warning' : 'loss'

    const employeeDetails = selected.map(e => {
      const cost = e.daily_cost * rentaNbDays
      const contribution = totalMO > 0 ? benefice * (cost / totalMO) : 0
      return { ...e, total_cost: Math.round(cost), contribution: Math.round(contribution) }
    })

    return {
      employees: employeeDetails,
      total_mo: Math.round(totalMO),
      materiaux_estime: Math.round(materiauxEstime),
      overhead: rentaOverhead,
      cout_total: Math.round(coutTotal),
      prix_vente: Math.round(prixVente),
      benefice: Math.round(benefice),
      marge_reelle: Math.round(margeReelle * 10) / 10,
      status,
    }
  }, [showRentaModal, rentaEmployees, rentaNbEmployees, rentaNbDays, rentaMarginPct, rentaOverhead, rentaMateriauxPct, subtotalHT])

  // ─── Compliance Check ───
  // Adapté au statut : AE/EI n'ont pas besoin de capital social
  // Sociétés (SARL, EURL, SAS / Lda, SA) doivent avoir RCS + capital
  const isSociete = isSocieteStatus(companyStatus, locale)
  const compliance = {
    siret: companySiret.trim().length > 0,
    rcs: companyRCS.trim().length > 0,
    insurance: insuranceName.trim().length > 0 && insuranceNumber.trim().length > 0,
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

  // ─── Shared V2 input builder helper ───
  const freshArtisanData = async () => {
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
    } catch { /* use cached value */ }
    return { freshLogoUrl, freshInsuranceName, freshInsuranceNumber, freshInsuranceCoverage, freshInsuranceType, freshInsuranceExpiry }
  }

  const getV2InputParams = (overrides: { logoUrl: string | null; insName: string | null; insNumber: string | null; insCoverage: string | null; insType: string | null }) => {
    return buildV2Input({
      logoUrl: overrides.logoUrl,
      companyName, artisanCompanyName: artisan?.company_name,
      companySiret, artisanRm: artisan?.rm as string | null,
      companyAddress, companyPhone, companyEmail,
      artisanRcPro: artisan?.rc_pro as string | null,
      insuranceName: overrides.insName, insuranceNumber: overrides.insNumber,
      insuranceCoverage: overrides.insCoverage, insuranceType: overrides.insType,
      tvaEnabled, paymentMode,
      clientName, clientSiret, clientAddress, clientPhone, clientEmail,
      interventionAddress, interventionBatiment, interventionEtage, interventionEspacesCommuns, interventionExterieur,
      docType, docNumber, docTitle, docDate, docValidity, executionDelay, prestationDate,
      lines, acomptesEnabled, acomptes, notes, mediatorName, mediatorUrl,
    })
  }

  // ─── TEST PDF V2 (parallel generator, rollback-safe) ───
  const handleTestPdfV2 = async () => {
    // Bloquer si assurance RC Pro manquante (art. L243-2 C. assurances)
    if (!insuranceName.trim() && !insuranceNumber.trim() && !artisan?.rc_pro) {
      toast.error(locale === 'pt'
        ? 'Seguro profissional obrigatório. Preencha o nome e número da apólice antes de gerar o PDF.'
        : 'Assurance RC Pro obligatoire. Renseignez le nom et le numéro de contrat avant de générer le PDF.')
      return
    }
    // Bloquer si acomptes activés mais total != 100%
    if (acomptesEnabled && acomptes.length > 0) {
      const totalPct = acomptes.reduce((s, a) => s + a.pourcentage, 0)
      if (totalPct !== 100) {
        toast.error(locale === 'pt'
          ? `O total dos adiantamentos deve ser 100% (atualmente ${totalPct}%).`
          : `Le total des acomptes doit être égal à 100% (actuellement ${totalPct}%).`)
        return
      }
    }
    setPdfLoading(true)
    try {
      const { generateDevisPdfV2 } = await import('@/lib/pdf/devis-generator-v2')
      const fresh = await freshArtisanData()
      // Alerte si assurance expirée
      if (fresh.freshInsuranceExpiry && new Date(fresh.freshInsuranceExpiry) < new Date()) {
        alert(`⚠️ Votre assurance ${fresh.freshInsuranceName || 'RC Pro'} a expiré le ${new Date(fresh.freshInsuranceExpiry).toLocaleDateString('fr-FR')}.\n\nVous ne pouvez pas générer de document avec une assurance expirée. Renouvelez votre assurance avant de continuer.`)
        setPdfLoading(false)
        return
      }
      const input = getV2InputParams({
        logoUrl: fresh.freshLogoUrl,
        insName: fresh.freshInsuranceName,
        insNumber: fresh.freshInsuranceNumber,
        insCoverage: fresh.freshInsuranceCoverage,
        insType: fresh.freshInsuranceType,
      })
      const numero = await fetchDocNumber()
      input.devis.numero = numero
      const pdf = await generateDevisPdfV2(input)
      pdf.save(`${numero || 'devis'}.pdf`)
    } catch (err) {
      console.error('PDF V2 error:', err)
      toast.error('Erreur PDF V2: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPdfLoading(false)
    }
  }

  const handlePreviewPdf = async () => {
    if (!insuranceName.trim() && !insuranceNumber.trim() && !artisan?.rc_pro) {
      toast.error(locale === 'pt'
        ? 'Seguro profissional obrigatório. Preencha o nome e número da apólice antes de gerar o PDF.'
        : 'Assurance RC Pro obligatoire. Renseignez le nom et le numéro de contrat avant de générer le PDF.')
      return
    }
    // Bloquer si acomptes activés mais total != 100%
    if (acomptesEnabled && acomptes.length > 0) {
      const totalPct = acomptes.reduce((s, a) => s + a.pourcentage, 0)
      if (totalPct !== 100) {
        toast.error(locale === 'pt'
          ? `O total dos adiantamentos deve ser 100% (atualmente ${totalPct}%).`
          : `Le total des acomptes doit être égal à 100% (actuellement ${totalPct}%).`)
        return
      }
    }
    setPdfLoading(true)
    try {
      const { generateDevisPdfV2 } = await import('@/lib/pdf/devis-generator-v2')
      const fresh = await freshArtisanData()
      const input = getV2InputParams({
        logoUrl: fresh.freshLogoUrl,
        insName: fresh.freshInsuranceName,
        insNumber: fresh.freshInsuranceNumber,
        insCoverage: fresh.freshInsuranceCoverage,
        insType: fresh.freshInsuranceType,
      })
      const numero = await fetchDocNumber()
      input.devis.numero = numero
      const pdf = await generateDevisPdfV2(input)
      const blob = pdf.output('blob')
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
    } catch (err) {
      console.error('PDF Preview error:', err)
      toast.error('Erreur aperçu: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPdfLoading(false)
    }
  }

  // ─── FACTUR-X EXPORT (facturation électronique 2026) ───
  const handleExportFacturX = async () => {
    if (docType !== 'facture' || locale !== 'fr') return
    // Bloquer si assurance RC Pro manquante (art. L243-2 C. assurances)
    if (!insuranceName.trim() && !insuranceNumber.trim() && !artisan?.rc_pro) {
      toast.error('Assurance RC Pro obligatoire. Renseignez le nom et le numéro de contrat avant de générer le PDF.')
      return
    }
    setFacturxLoading(true)
    try {
      const payload = {
        data: {
          docType: 'facture' as const,
          docNumber: docNumber || 'FACT-DRAFT',
          docTitle: docTitle || 'FACTURE',
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
          clientType,
          docDate,
          docValidity,
          prestationDate,
          executionDelay,
          executionDelayDays,
          executionDelayType,
          paymentMode,
          paymentDue,
          paymentCondition,
          discount,
          iban,
          bic,
          lines: lines.filter(l => l.description.trim()).map(l => ({
            id: l.id,
            description: l.description,
            qty: l.qty,
            unit: l.unit || 'u',
            customUnit: l.customUnit,
            priceHT: l.priceHT,
            tvaRate: l.tvaRate,
            totalHT: l.totalHT,
            source: l.source,
          })),
          notes,
        },
      }
      const res = await fetch('/api/facturx/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Erreur serveur ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `facturx_${(docNumber || 'facture').replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Factur-X] Export error:', err)
      toast.error('Erreur export Factur-X: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setFacturxLoading(false)
    }
  }

  const handleGeneratePDF = async () => {
    // Bloquer si acomptes activés mais total != 100%
    if (acomptesEnabled && acomptes.length > 0) {
      const totalPct = acomptes.reduce((s, a) => s + a.pourcentage, 0)
      if (totalPct !== 100) {
        toast.error(locale === 'pt'
          ? `O total dos adiantamentos deve ser 100% (atualmente ${totalPct}%).`
          : `Le total des acomptes doit être égal à 100% (actuellement ${totalPct}%).`)
        return
      }
    }
    setPdfLoading(true)
    try {
      // ── PT Fiscal: Register document with AT engine (Portugal only) ──
      let ptFiscalData: PdfV3PtFiscalData | null = null

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

      // Generate PDF via extracted V3 generator
      await generateDevisPdfV3({
        locale, localeFormats, t,
        docType, docNumber, docTitle, docDate, docValidity,
        prestationDate, executionDelay,
        companyStatus, companyName, companySiret, companyAddress,
        companyRCS, companyCapital, companyPhone, companyEmail,
        tvaEnabled, tvaNumber, companyAPE: '',
        insuranceName, insuranceNumber, insuranceCoverage, insuranceType,
        mediatorName, mediatorUrl, isHorsEtablissement,
        clientName, clientEmail, clientAddress, clientPhone, clientSiret,
        clientType: (clientSiret.trim().length > 0 || isProClient) ? 'professionnel' : 'particulier',
        interventionAddress, interventionBatiment, interventionEtage,
        interventionEspacesCommuns, interventionExterieur,
        paymentMode, paymentDue, paymentCondition, discount, penaltyRate: '', recoveryFee: '', iban, bic,
        lines, subtotalHT, totalTTC,
        acomptesEnabled, acomptes,
        notes: notes ?? null, sourceDevisRef: sourceDevisRef ?? null,
        signatureData, attachedRapport, selectedPhotos,
        artisan: artisan ? { id: artisan.id, logo_url: artisan.logo_url as string | null, company_name: artisan.company_name, rm: artisan.rm as string | null, rc_pro: artisan.rc_pro as string | null } : null,
        ptFiscalData,
        svgToImageDataUrl,
        fetchFreshLogo: async () => {
          let logoUrl = (artisan?.logo_url as string) || null
          try {
            const { data: freshA } = await supabase.from('profiles_artisan').select('logo_url').eq('id', artisan?.id).single()
            if (freshA?.logo_url) logoUrl = freshA.logo_url
          } catch { /* use cached */ }
          return logoUrl
        },
      })

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
    interventionBatiment,
    interventionEtage,
    interventionEspacesCommuns,
    interventionExterieur,
    clientPhone,
    clientSiret,
    clientType: (clientSiret.trim().length > 0 || isProClient) ? 'professionnel' : 'particulier',
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
    etapes: lines.some(l => l.etapes?.length) ? lines.flatMap(l => l.etapes || []) : undefined,
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
    <div className="devis-create">
      {/* Top bar */}
      <div className="devis-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.85rem' }}>
          <button className="devis-back" onClick={onBack}>← {t('devis.back')}</button>
          <div style={{ width: 1, height: 18, background: '#E0E0E0' }} />
          <span className="devis-top-title">
            {docType === 'devis' ? t('devis.newDevis') : t('devis.newFacture')}
            {docTitle && <span style={{ fontWeight: 400, marginLeft: 8, color: '#999' }}>— {docTitle}</span>}
          </span>
        </div>
        <div className="devis-top-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="devis-doc-tabs">
            <button
              onClick={() => setDocType('devis')}
              className={`devis-doc-tab ${docType === 'devis' ? 'active' : ''}`}
            >
              {t('devis.devisTab')}
            </button>
            <button
              onClick={() => setDocType('facture')}
              className={`devis-doc-tab ${docType === 'facture' ? 'active' : ''}`}
            >
              {t('devis.factureTab')}
            </button>
          </div>
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
              className="devis-cta-btn green"
            >
              {t('devis.convertToFacture')}
            </button>
          )}
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

                {/* Quick import — yellow gradient pill (legacy design) */}
                {recentBookings.length > 0 ? (
                  <div style={{
                    background: 'linear-gradient(90deg, #FFF9E6 0%, #FFE082 100%)',
                    border: '2px solid #FFC107',
                    borderRadius: 12,
                    padding: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: '#333', marginBottom: 8 }}>
                      <span>⚡</span>
                      <span>{t('devis.quickImportTitle')}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <select
                        onChange={(e) => importFromBooking(e.target.value)}
                        disabled={importingBooking}
                        defaultValue=""
                        style={{
                          width: '100%', padding: '10px 12px',
                          border: '2px solid #FFC107', borderRadius: 8,
                          background: '#fff', fontSize: 12, fontFamily: 'inherit',
                          cursor: 'pointer', outline: 'none', color: '#333',
                        }}
                      >
                        <option value="">{t('devis.quickImportPlaceholder')}</option>
                        {recentBookings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.booking_date} {b.booking_time?.substring(0, 5)} – {b.services?.name || 'Prestation'} – {formatPrice(b.price_ttc ?? 0)}
                          </option>
                        ))}
                      </select>
                      {importingBooking && (
                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8B7D00' }}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #8B7D00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          {t('devis.loading')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="v22-alert v22-alert-amber" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="v22-card-title" style={{ textTransform: 'none', fontSize: 12 }}>{t('devis.quickImportTitle')}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--v22-amber)', marginBottom: 8 }}>{t('devis.quickImportDesc')}</div>
                    <div style={{ background: 'var(--v22-surface)', borderRadius: 3, padding: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--v22-amber)' }}>{t('devis.quickImportNone')}</div>
                      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 4 }}>{t('devis.quickImportNoneHint')}</div>
                    </div>
                  </div>
                )}
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

              </div>
            </div>

            {/* ─── Section: Assurance & Médiation ─── */}
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('devis.insuranceMediationSection')}</span>
              </div>
              <div className="v22-card-body">
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
              <div className="v22-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="v22-card-title">{t('devis.clientSection')}</span>
                <button type="button" onClick={openClientPicker}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--v22-border)', background: 'var(--v22-bg)', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--v22-primary)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  Ajouter client depuis base client
                </button>
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
                {/* Lieu d'intervention — tous types de clients */}
                <div className="v22-form-group" style={{ background: 'var(--v22-bg-alt, #f9fafb)', borderRadius: 10, padding: 12, border: '1px solid var(--v22-border)' }}>
                    <label className="v22-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      Lieu d&apos;intervention
                      {isProClient && <span className="v22-tag v22-tag-amber">Client pro</span>}
                    </label>
                    {/* Combobox éditable : texte libre + dropdown natif HTML */}
                    <input
                      type="text"
                      list={selectedClientInterventionAddresses.length > 0 ? 'intervention-addr-list' : undefined}
                      value={interventionAddress}
                      onChange={(e) => setInterventionAddress(e.target.value)}
                      placeholder={selectedClientInterventionAddresses.length > 0
                        ? 'Sélectionner un lieu enregistré ou saisir...'
                        : 'Ex: Résidence Le Mail, 15 rue des Lilas, 13001 Marseille'}
                      className={normalFieldClass}
                      style={{ marginBottom: 8 }}
                    />
                    {selectedClientInterventionAddresses.length > 0 && (
                      <datalist id="intervention-addr-list">
                        {selectedClientInterventionAddresses.map(addr => {
                          const combined = addr.label && addr.address ? `${addr.label}, ${addr.address}` : (addr.address || addr.label)
                          return <option key={addr.id} value={combined} />
                        })}
                      </datalist>
                    )}
                    {/* Bâtiment + Étage */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label className="v22-form-label" style={{ fontSize: 11, marginBottom: 3 }}>Bâtiment</label>
                        <input type="text" value={interventionBatiment} onChange={(e) => setInterventionBatiment(e.target.value)}
                          placeholder="Ex: B"
                          className={normalFieldClass}
                          style={{ textAlign: 'center' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="v22-form-label" style={{ fontSize: 11, marginBottom: 3 }}>Étage</label>
                        <input type="text" value={interventionEtage} onChange={(e) => setInterventionEtage(e.target.value)}
                          placeholder="Ex: 6"
                          className={normalFieldClass}
                          style={{ textAlign: 'center' }} />
                      </div>
                    </div>
                    {/* Espaces communs + Extérieur */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label className="v22-form-label" style={{ fontSize: 11, marginBottom: 3 }}>Espaces communs</label>
                        <input type="text" value={interventionEspacesCommuns} onChange={(e) => setInterventionEspacesCommuns(e.target.value)}
                          placeholder="Ex: Hall, cage d'escalier"
                          className={normalFieldClass} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="v22-form-label" style={{ fontSize: 11, marginBottom: 3 }}>Extérieur</label>
                        <input type="text" value={interventionExterieur} onChange={(e) => setInterventionExterieur(e.target.value)}
                          placeholder="Ex: Parking, jardin"
                          className={normalFieldClass} />
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--v22-text-muted)', marginTop: 6 }}>
                      Adresse du chantier si différente du siège social du client
                    </div>
                </div>
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

            {/* ─── Modal: Sélection client depuis base ─── */}
            {showClientPicker && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowClientPicker(false) }}>
                <div style={{ background: 'var(--v22-card-bg, #fff)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--v22-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Sélectionner un client</h3>
                    <button type="button" onClick={() => setShowClientPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--v22-text-muted)' }}>&times;</button>
                  </div>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--v22-border)' }}>
                    <input type="text" value={clientDbSearch} onChange={(e) => setClientDbSearch(e.target.value)}
                      placeholder="Rechercher par nom, email, SIRET..."
                      autoFocus
                      className={normalFieldClass}
                      style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
                    {clientDbLoading ? (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--v22-text-muted)' }}>Chargement...</div>
                    ) : (() => {
                      const searchLower = clientDbSearch.toLowerCase()
                      const filteredClients = clientDbList.filter(c => {
                        if (!clientDbSearch) return true
                        return [c.name, c.email, c.phone, c.siret, c.mainAddress || c.address].filter(Boolean).some(v => String(v).toLowerCase().includes(searchLower))
                      })
                      if (filteredClients.length === 0) return <div style={{ textAlign: 'center', padding: 20, color: 'var(--v22-text-muted)' }}>Aucun client trouvé</div>
                      return filteredClients.map(c => {
                        const isPro = Boolean(c.siret?.trim()) || ['syndic', 'professionnel', 'societe', 'conciergerie', 'agence_immobiliere', 'promoteur', 'architecte', 'collectivite', 'association', 'artisan_sous_traitant'].includes(c.type || '')
                        return (
                          <button key={c.id} type="button" onClick={() => selectClientFromDb(c)}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--v22-border)', background: 'var(--v22-bg)', marginBottom: 6, cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--v22-bg-hover, #f3f4f6)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--v22-bg)')}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                              {isPro && <span className="v22-tag v22-tag-amber" style={{ fontSize: 10 }}>{c.type === 'syndic' ? 'Syndic' : 'Pro'}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--v22-text-muted)', marginTop: 2 }}>
                              {[c.email, c.phone, c.siret ? `SIRET: ${c.siret}` : null].filter(Boolean).join(' · ')}
                            </div>
                            {(c.mainAddress || c.address) && (
                              <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 2 }}>{c.mainAddress || c.address}</div>
                            )}
                            {c.interventionAddresses && c.interventionAddresses.length > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--v22-primary)', marginTop: 2 }}>
                                {c.interventionAddresses.length} lieu{c.interventionAddresses.length > 1 ? 'x' : ''} d&apos;intervention enregistré{c.interventionAddresses.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </button>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
            )}

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
                        <th style={{ width: '14%' }}>{tvaEnabled ? `${t('devis.total')} ${t('devis.ht')}` : `${t('devis.total')} ${t('devis.ttc')}`}</th>
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
                                    {/* Étapes — petit bloc gris sous la description (par ligne) */}
                                    {(line.etapes && line.etapes.length > 0) && (
                                      <div style={{
                                        marginTop: 4, padding: '4px 8px',
                                        background: '#f3f4f6', border: '1px solid #e5e7eb',
                                        borderRadius: 4, fontSize: 11, color: '#6b7280', lineHeight: 1.6,
                                      }}>
                                        {[...line.etapes].sort((a, b) => a.ordre - b.ordre).map((et, i) => (
                                          <div key={et.id} style={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                                            <span style={{ color: '#9ca3af', minWidth: 14 }}>{i+1}.</span>
                                            <input
                                              type="text" value={et.designation}
                                              onChange={(e) => setLines(prev => prev.map(ln => ln.id !== line.id ? ln : { ...ln, etapes: (ln.etapes || []).map(x => x.id === et.id ? {...x, designation: e.target.value} : x) }))}
                                              style={{ flex: 1, fontSize: 11, color: '#6b7280', background: 'transparent', border: 'none', outline: 'none', padding: 0 }}
                                            />
                                            <button onClick={() => setLines(prev => prev.map(ln => ln.id !== line.id ? ln : { ...ln, etapes: (ln.etapes || []).filter(x => x.id !== et.id) }))}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: '#d1d5db', padding: 0 }}>✕</button>
                                          </div>
                                        ))}
                                        <button onClick={() => {
                                          const newId = `etape_manual_${Date.now()}`
                                          setLines(prev => prev.map(ln => ln.id !== line.id ? ln : { ...ln, etapes: [...(ln.etapes || []), { id: newId, ordre: (ln.etapes || []).length + 1, designation: '' }] }))
                                        }} style={{ fontSize: 10, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 0' }}>+ étape</button>
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
                              value={line.qty === 0 ? '' : line.qty}
                              onChange={(e) => {
                                const v = e.target.value
                                // Accepter la saisie brute (y compris vide temporairement)
                                updateLine(line.id, 'qty', v === '' ? 0 : parseInt(v) || 0)
                              }}
                              onFocus={(e) => e.target.select()}
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
                            <input
                              type="number"
                              value={line.totalHT === 0 ? '' : line.totalHT}
                              onChange={(e) => {
                                const raw = e.target.value
                                const newTotal = raw === '' ? 0 : parseFloat(raw) || 0
                                const qty = line.qty > 0 ? line.qty : 1
                                const newPrice = newTotal / qty
                                setLines(prev => prev.map(l => l.id !== line.id ? l : { ...l, priceHT: newPrice, totalHT: newTotal }))
                              }}
                              onFocus={(e) => e.target.select()}
                              step="0.01"
                              className="v22-form-input"
                            />
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

            {/* Étapes moved inside prestation table, under description */}

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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {acomptes.length < 4 ? (
                        <button
                          onClick={() => setAcomptes([...acomptes, { id: crypto.randomUUID(), ordre: acomptes.length + 1, label: `${locale === 'pt' ? 'Adiantamento' : 'Acompte'} ${acomptes.length + 1}`, pourcentage: 0, declencheur: locale === 'pt' ? 'Na entrega' : 'À la livraison' }])}
                          className="v22-btn" style={{ border: '1px dashed var(--v22-border-dark)', background: 'var(--v22-surface)' }}
                        >
                          + {locale === 'pt' ? 'Adicionar adiantamento' : 'Ajouter un acompte'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--v22-text-muted)' }}>{locale === 'pt' ? 'Máximo 4 adiantamentos atingido' : 'Maximum 4 acomptes atteint'}</span>
                      )}
                      <button
                        onClick={saveEcheancierAsDefault}
                        className="v22-btn"
                        style={{ border: '1px solid var(--v22-border-dark)', background: echeancierSaved ? '#dcfce7' : 'var(--v22-surface)', color: echeancierSaved ? '#16a34a' : 'inherit', fontSize: 12, transition: 'all 0.2s' }}
                      >
                        {echeancierSaved ? '✓ Enregistré !' : '💾 Enregistrer comme défaut'}
                      </button>
                    </div>
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
              <div className="v22-card-body">
                <div style={{ padding: '.35rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#555' }}>
                  <span>{tvaEnabled ? t('devis.subtotalHT') : t('devis.subtotal')}</span>
                  <span style={{ fontWeight: 600 }}>{localeFormats.currencyFormat(subtotalHT)}</span>
                </div>
                {tvaEnabled && (
                  <div style={{ padding: '.35rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#555' }}>
                    <span>{t('devis.taxLabel')}</span>
                    <span style={{ fontWeight: 600 }}>{localeFormats.currencyFormat(totalTVA)}</span>
                  </div>
                )}
                <div style={{
                  padding: '.6rem .75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: tvaEnabled ? 'var(--v22-green)' : 'var(--v5-primary-yellow)',
                  color: tvaEnabled ? '#fff' : '#333',
                  fontWeight: 700, fontSize: 13, borderRadius: 7, marginTop: '.5rem',
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

            {/* ══════ RENTABILITÉ BTP PRO ══════ */}
            <div className="v22-card">
              <div className="v22-card-body" style={{ padding: 12 }}>
                <button onClick={openRentaModal}
                  className="v22-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1', fontWeight: 600 }}>
                  📊 {locale === 'pt' ? 'Rentabilidade do orçamento' : 'Rentabilité du devis'}
                </button>
              </div>
            </div>

            {/* Modal Rentabilité */}
            {showRentaModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={() => setShowRentaModal(false)}>
                <div style={{ background: 'white', borderRadius: 12, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>
                      📊 {locale === 'pt' ? 'Análise de rentabilidade' : 'Analyse de rentabilité'}
                    </h3>
                    <button onClick={() => setShowRentaModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>✕</button>
                  </div>

                  {rentaLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ fontSize: 24 }}>⏳</div>
                      <p style={{ color: '#6B7280', marginTop: 8 }}>{locale === 'pt' ? 'A carregar dados...' : 'Chargement...'}</p>
                    </div>
                  ) : (
                    <>
                      {/* Paramètres */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                            👷 {locale === 'pt' ? 'Empregados' : 'Employés'}
                          </label>
                          <input type="number" min={1} max={rentaEmployees.length || 20} value={rentaNbEmployees}
                            onChange={e => setRentaNbEmployees(Math.max(1, Number(e.target.value)))}
                            className="v22-form-input" style={{ textAlign: 'center' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                            📅 {locale === 'pt' ? 'Dias no projeto' : 'Jours sur le projet'}
                          </label>
                          <input type="number" min={1} value={rentaNbDays}
                            onChange={e => setRentaNbDays(Math.max(1, Number(e.target.value)))}
                            className="v22-form-input" style={{ textAlign: 'center' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                            🎯 {locale === 'pt' ? 'Margem obj.' : 'Marge obj.'} (%)
                          </label>
                          <input type="number" min={0} max={90} value={rentaMarginPct}
                            onChange={e => setRentaMarginPct(Number(e.target.value))}
                            className="v22-form-input" style={{ textAlign: 'center' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                            🏗️ {locale === 'pt' ? 'Materiais' : 'Matériaux'} (%)
                          </label>
                          <input type="number" min={0} max={80} value={rentaMateriauxPct}
                            onChange={e => setRentaMateriauxPct(Number(e.target.value))}
                            className="v22-form-input" style={{ textAlign: 'center' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>
                            🏢 {locale === 'pt' ? 'Overhead' : 'Frais fixes'} (€)
                          </label>
                          <input type="number" min={0} value={rentaOverhead}
                            onChange={e => setRentaOverhead(Number(e.target.value))}
                            className="v22-form-input" style={{ textAlign: 'center' }} />
                        </div>
                      </div>

                      {/* Tableau employés */}
                      {rentaEmployees.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                            {locale === 'pt' ? 'Detalhe por empregado' : 'Détail par employé'}
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                                  {[locale === 'pt' ? 'Nome' : 'Nom', locale === 'pt' ? 'Função' : 'Rôle',
                                    locale === 'pt' ? 'Custo/dia' : 'Coût/jour', locale === 'pt' ? 'Dias' : 'Jours',
                                    locale === 'pt' ? 'Custo total' : 'Coût total',
                                    locale === 'pt' ? 'Contribuição' : 'Contribution'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#6B7280', fontWeight: 600, fontSize: 11 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rentaEmployees.slice(0, rentaNbEmployees).map((e, i) => {
                                  const totalCost = Math.round(e.daily_cost * rentaNbDays)
                                  const rentaEmp = rentaResult?.employees.find(re => re.id === e.id)
                                  const contribution = rentaEmp?.contribution ?? 0
                                  return (
                                    <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                      <td style={{ padding: '6px 8px' }}>
                                        <input value={e.name} onChange={ev => {
                                          const updated = [...rentaEmployees]; updated[i] = { ...updated[i], name: ev.target.value }; setRentaEmployees(updated)
                                        }} style={{ border: 'none', background: 'transparent', fontWeight: 600, width: '100%', fontSize: 12 }} />
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        <input value={e.role} onChange={ev => {
                                          const updated = [...rentaEmployees]; updated[i] = { ...updated[i], role: ev.target.value }; setRentaEmployees(updated)
                                        }} style={{ border: 'none', background: 'transparent', fontSize: 12, width: '100%', color: '#6B7280' }} />
                                      </td>
                                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{e.daily_cost.toFixed(0)} €</td>
                                      <td style={{ padding: '6px 8px' }}>{rentaNbDays}</td>
                                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#EF4444' }}>{totalCost.toLocaleString('fr-FR')} €</td>
                                      <td style={{ padding: '6px 8px', fontWeight: 600, color: contribution >= 0 ? '#22C55E' : '#EF4444' }}>
                                        {contribution >= 0 ? '+' : ''}{contribution.toLocaleString('fr-FR')} €
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                          {rentaEmployees.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 20, color: '#6B7280', fontSize: 13 }}>
                              {locale === 'pt'
                                ? 'Nenhum empregado registado. Adicione na secção "Equipas".'
                                : 'Aucun employé enregistré. Ajoutez-en dans "Équipes".'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Résumé */}
                      {rentaResult && (
                        <div style={{
                          background: rentaResult.status === 'profit' ? '#F0FDF4' : rentaResult.status === 'warning' ? '#FEF3C7' : '#FEF2F2',
                          borderRadius: 10, padding: 16,
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{locale === 'pt' ? 'Custo M.O.' : 'Coût M.O.'}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444' }}>{rentaResult.total_mo.toLocaleString('fr-FR')} €</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{locale === 'pt' ? 'Materiais est.' : 'Matériaux est.'}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>{rentaResult.materiaux_estime.toLocaleString('fr-FR')} €</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{locale === 'pt' ? 'Overhead' : 'Frais fixes'}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#6B7280' }}>{rentaResult.overhead.toLocaleString('fr-FR')} €</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{locale === 'pt' ? 'Custo total' : 'Coût total'}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2E' }}>{rentaResult.cout_total.toLocaleString('fr-FR')} €</div>
                            </div>
                          </div>
                          <div style={{ borderTop: '2px solid rgba(0,0,0,0.1)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{locale === 'pt' ? 'Preço de venda' : 'Prix de vente'}</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#0D1B2E' }}>{rentaResult.prix_vente.toLocaleString('fr-FR')} €</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{locale === 'pt' ? 'Lucro' : 'Bénéfice'}</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: rentaResult.benefice >= 0 ? '#22C55E' : '#EF4444' }}>
                                {rentaResult.benefice >= 0 ? '+' : ''}{rentaResult.benefice.toLocaleString('fr-FR')} €
                              </div>
                            </div>
                          </div>
                          <div style={{ marginTop: 12, textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 700,
                              background: rentaResult.status === 'profit' ? '#22C55E' : rentaResult.status === 'warning' ? '#F59E0B' : '#EF4444',
                              color: 'white',
                            }}>
                              {rentaResult.status === 'profit' ? '✅' : rentaResult.status === 'warning' ? '⚠️' : '🔴'}{' '}
                              {locale === 'pt' ? 'Margem' : 'Marge'}: {rentaResult.marge_reelle}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Bouton fermer */}
                      <button onClick={() => setShowRentaModal(false)}
                        className="v22-btn" style={{ width: '100%', marginTop: 16, padding: '10px 14px' }}>
                        {locale === 'pt' ? 'Fechar' : 'Fermer'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Signature électronique (devis only) */}
            {docType === 'devis' && (
              <div className="v22-card">
                <div className="v22-card-head">
                  <span className="v22-card-title">{locale === 'pt' ? 'Pré-visualização' : 'Aperçu'}</span>
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
                    <button onClick={handlePreviewPdf}
                      disabled={pdfLoading || !compliance.insurance}
                      className="v22-btn v22-btn-sm"
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: (pdfLoading || !compliance.insurance) ? 0.6 : 1, cursor: (pdfLoading || !compliance.insurance) ? 'not-allowed' : 'pointer' }}>
                      👁️ {pdfLoading ? '...' : (locale === 'pt' ? 'Pré-visualização' : 'Aperçu')}
                    </button>
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
                  onClick={handleTestPdfV2}
                  disabled={pdfLoading || !compliance.insurance}
                  className="v22-btn v22-btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', opacity: (pdfLoading || !compliance.insurance) ? 0.6 : 1, cursor: (pdfLoading || !compliance.insurance) ? 'not-allowed' : 'pointer' }}
                >
                  {pdfLoading ? t('devis.generatingPdf') : t('devis.downloadPdf')}
                </button>
                {docType === 'facture' && locale === 'fr' && (
                  <button
                    onClick={handleExportFacturX}
                    disabled={facturxLoading || !compliance.insurance}
                    className="v22-btn"
                    title="Exporter en format Factur-X (PDF/A-3 + XML CII) — obligatoire à partir de sept. 2026"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', opacity: (facturxLoading || !compliance.insurance) ? 0.6 : 1, cursor: (facturxLoading || !compliance.insurance) ? 'not-allowed' : 'pointer', fontSize: 12, border: '1px solid #e8a020', color: '#b07810' }}
                  >
                    {facturxLoading ? 'Génération...' : '📄 Exporter Factur-X'}
                  </button>
                )}
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
