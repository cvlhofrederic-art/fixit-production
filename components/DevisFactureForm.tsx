'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

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
  // Payment (facture only)
  paymentMode: string
  paymentDue: string
  discount: string
  // Lines
  lines: ProductLine[]
  // Notes
  notes: string
}

interface DevisFactureFormProps {
  artisan: any
  services: any[]
  bookings: any[]
  initialDocType?: 'devis' | 'facture'
  initialData?: any // Données d'un devis à convertir en facture
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

// Map internal code back to display label
function getStatusLabel(code: string): string {
  const labels: Record<string, string> = {
    'ei': 'Entreprise Individuelle (EI)',
    'ae': 'Auto-Entrepreneur',
    'eurl': 'EURL',
    'sarl': 'SARL',
    'sas': 'SAS',
  }
  return labels[code] || code
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
  const today = new Date().toISOString().split('T')[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  // ─── PDF (vector-based jsPDF + autoTable) ───
  const [pdfLoading, setPdfLoading] = useState(false)

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
  const [insuranceCoverage, setInsuranceCoverage] = useState(initialData?.insuranceCoverage || 'France métropolitaine')
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
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || 'Virement bancaire')
  const [paymentDue, setPaymentDue] = useState(dueDateStr)
  const [discount, setDiscount] = useState(initialData?.discount || '')
  const [iban, setIban] = useState(initialData?.iban || '')
  const [bic, setBic] = useState(initialData?.bic || '')
  const [paymentCondition, setPaymentCondition] = useState(initialData?.paymentCondition || 'Paiement comptant à réception de facture')

  const [lines, setLines] = useState<ProductLine[]>(initialData?.lines || [])
  const [notes, setNotes] = useState(initialData?.notes || (initialData?.docNumber ? `Réf. devis : ${initialData.docNumber}` : ''))
  const [docTitle, setDocTitle] = useState(initialData?.docTitle || '')
  const [saving, setSaving] = useState(false)

  // ─── Linked booking for Vitfix channel ───
  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null)
  const [linkedClientId, setLinkedClientId] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState<'pdf' | 'validate' | null>(null)
  const [sendingVitfix, setSendingVitfix] = useState(false)

  // ─── Attached Rapport ───
  const [attachedRapportId, setAttachedRapportId] = useState<string | null>(null)
  const [availableRapports, setAvailableRapports] = useState<any[]>([])

  // Load available rapports from localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const rapports = JSON.parse(localStorage.getItem(`fixit_rapports_${artisan.id}`) || '[]')
      setAvailableRapports(rapports)
    } catch { setAvailableRapports([]) }
  }, [artisan?.id])

  const attachedRapport = availableRapports.find(r => r.id === attachedRapportId) || null

  // Generate document number — séquences séparées devis / facture / avoir (art. L441-9 C. com.)
  const isConversion = docType === 'facture' && initialData?.docType === 'devis' && initialData?.docNumber

  const [devisCount] = useState(() => {
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id || 'default'}`) || '[]')
      const devisDocs = docs.filter((d: any) => d.docType === 'devis')
      return devisDocs.length + 1
    } catch { return 1 }
  })
  const [factureCount] = useState(() => {
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id || 'default'}`) || '[]')
      const factureDocs = docs.filter((d: any) => d.docType === 'facture')
      return factureDocs.length + 1
    } catch { return 1 }
  })

  const docNumber = docType === 'devis'
    ? `DEV-${new Date().getFullYear()}-${String(devisCount).padStart(3, '0')}`
    : `FACT-${new Date().getFullYear()}-${String(factureCount).padStart(3, '0')}`

  // Référence du devis d'origine (si conversion devis → facture)
  const sourceDevisRef = isConversion ? initialData.docNumber : null

  // ─── Auth helper for API calls ───
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` }
      }
    } catch {}
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
          if ((code === 'ae' || code === 'ei') && !initialData?.tvaEnabled) {
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
  const defaultTvaRate = tvaEnabled ? 20 : 0

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

  const addLineWithData = (desc: string, qty: number, price: number, tva: number) => {
    setLines(prev => [...prev, {
      id: Date.now() + Math.random(),
      description: desc,
      qty,
      unit: 'u',
      priceHT: price,
      tvaRate: tva,
      totalHT: qty * price,
    }])
  }

  const updateLine = (id: number, field: keyof ProductLine, value: any) => {
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

  // Extraire l'unité du service (encodée dans description : [unit:m2|min:X|max:Y])
  // et la mapper au format ProductLine (m², m³, ml, h, forfait, u, kg, lot)
  const parseServiceUnit = (service: any): string => {
    const desc = service?.description || ''
    const match = desc.match(/\[unit:([^|]+)\|/)
    if (!match) return 'u'
    const unitMap: Record<string, string> = {
      'm2': 'm²', 'ml': 'ml', 'm3': 'm³', 'heure': 'h',
      'forfait': 'forfait', 'unite': 'u', 'arbre': 'u',
      'tonne': 'kg', 'kg': 'kg', 'lot': 'lot',
    }
    return unitMap[match[1]] || 'u'
  }

  const selectMotif = (lineId: number, serviceId: string) => {
    if (serviceId === 'custom') {
      updateLine(lineId, 'description', '')
      return
    }
    const service = services.find(s => s.id === serviceId)
    if (service) {
      // Pour un AE/EI sans TVA → price_ttc = prix réel (pas de TVA)
      // Pour une entreprise avec TVA → price_ttc inclut la TVA, price_ht = HT
      const price = tvaEnabled ? (service.price_ht || 0) : (service.price_ttc || service.price_ht || 0)
      // Unité automatique depuis le paramétrage du motif
      const serviceUnit = parseServiceUnit(service)
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
    setLinkedClientId(booking.client_id || null)

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
      const linePrice = tvaEnabled ? Math.round((bookingPrice / 1.2) * 100) / 100 : bookingPrice
      const lineTva = tvaEnabled ? 20 : 0
      // Récupérer l'unité du service lié au booking
      const linkedService = services.find(s => s.id === booking.service_id)
      const serviceUnit = parseServiceUnit(linkedService)
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
  // Sociétés (SARL, EURL, SAS) doivent avoir RCS + capital
  const isSociete = ['sarl', 'eurl', 'sas'].includes(companyStatus)
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
  // Adaptées dynamiquement selon le statut juridique (AE, EI, EURL, SARL, SAS)
  const getLegalMentions = () => {
    const mentions: string[] = []
    const isSociete = ['sarl', 'eurl', 'sas'].includes(companyStatus)
    const isClientPro = clientSiret.trim().length > 0

    // ══════════════════════════════════════════════
    // 1. IDENTIFICATION — obligatoire sur tout document commercial
    // ══════════════════════════════════════════════

    // ── Statut juridique spécifique ──
    if (companyStatus === 'ae') {
      mentions.push("Auto-entrepreneur — Dispensé d'immatriculation au RCS (art. L. 123-1-1 C. com.)")
    } else if (companyStatus === 'ei') {
      mentions.push('Entrepreneur individuel (EI) — Loi n°2022-172 du 14 février 2022 relative au statut de l\'entrepreneur individuel')
    } else if (companyStatus === 'eurl') {
      mentions.push(`EURL au capital de ${companyCapital || '—'} € — ${companyRCS || 'RCS non renseigné'}`)
    } else if (companyStatus === 'sarl') {
      mentions.push(`SARL au capital de ${companyCapital || '—'} € — ${companyRCS || 'RCS non renseigné'}`)
    } else if (companyStatus === 'sas') {
      mentions.push(`SAS au capital de ${companyCapital || '—'} € — ${companyRCS || 'RCS non renseigné'}`)
    }

    // ══════════════════════════════════════════════
    // 2. TVA
    // ══════════════════════════════════════════════
    if (!tvaEnabled) {
      mentions.push('TVA non applicable, article 293 B du CGI (franchise en base de TVA)')
    } else if (tvaNumber) {
      mentions.push(`N° TVA intracommunautaire : ${tvaNumber}`)
    }

    // ══════════════════════════════════════════════
    // 3. ASSURANCE — obligatoire BTP (Loi Pinel 2014, art. L. 241-1 C. assurances)
    // ══════════════════════════════════════════════
    if (insuranceNumber && insuranceName) {
      const insTypeLabel = insuranceType === 'rc_pro' ? 'Assurance Responsabilité Civile Professionnelle (RC Pro)'
        : insuranceType === 'decennale' ? 'Assurance Responsabilité Civile Décennale'
        : 'Assurance RC Professionnelle et Décennale'
      mentions.push(`${insTypeLabel} : ${insuranceName} — Contrat n° ${insuranceNumber} — Couverture : ${insuranceCoverage}`)
    }

    // ══════════════════════════════════════════════
    // 4. CONDITIONS DE PAIEMENT (facture)
    // ══════════════════════════════════════════════
    if (docType === 'facture') {
      // Conditions de paiement
      if (paymentCondition) mentions.push(`Conditions de paiement : ${paymentCondition}`)
      mentions.push('Pénalités de retard exigibles sans rappel : taux légal majoré de 10 points (art. L. 441-10 C. com.)')
      mentions.push('Indemnité forfaitaire pour frais de recouvrement : 40 € (art. D. 441-5 C. com.)')
      if (!discount) mentions.push('Pas d\'escompte pour paiement anticipé, sauf accord préalable')
      // Réserve de propriété (si fourniture de matériel)
      mentions.push('Le matériel fourni reste la propriété de l\'entreprise jusqu\'au paiement intégral de la facture.')
      // Référence au devis signé (lien juridique devis ↔ facture)
      if (sourceDevisRef) {
        mentions.push(`Facture établie conformément au devis signé n° ${sourceDevisRef}${prestationDate ? ` en date du ${new Date(prestationDate).toLocaleDateString('fr-FR')}` : ''}.`)
      } else if (notes && notes.includes('Réf. devis')) {
        const devisRef = notes.match(/Réf\. devis\s*:\s*([^\n]+)/)?.[1]?.trim()
        if (devisRef) mentions.push(`Facture établie conformément au devis signé n° ${devisRef}.`)
      }
      // Clause de contestation
      mentions.push('En cas de contestation, celle-ci devra être formulée par écrit dans un délai de 8 jours suivant réception de la facture.')
      // Garantie — seulement pour clients particuliers (B2C)
      if (!isClientPro) {
        mentions.push('Garantie légale de conformité : 2 ans minimum (art. L. 217-3 C. conso.)')
      }
    }

    // ══════════════════════════════════════════════
    // 5. DEVIS SPÉCIFIQUE
    // ══════════════════════════════════════════════
    if (docType === 'devis') {
      mentions.push("Devis gratuit — Conformément à l'article L. 111-1 du Code de la consommation")
      if (executionDelay) {
        mentions.push(`Délai d'exécution prévu : ${executionDelay}`)
      }
      // Validité du devis
      if (docValidity) {
        mentions.push(`Ce devis est valable ${docValidity} jours à compter de sa date d'émission`)
      }
    }

    // ══════════════════════════════════════════════
    // 6. DROIT DE RÉTRACTATION (contrat hors établissement — B2C uniquement)
    // ══════════════════════════════════════════════
    if (docType === 'devis' && isHorsEtablissement && !isClientPro) {
      mentions.push('DROIT DE RÉTRACTATION : Conformément à l\'article L. 221-18 du Code de la consommation, le client dispose d\'un délai de 14 jours à compter de la signature pour exercer son droit de rétractation, sans motif ni pénalité.')
      mentions.push('Aucun paiement ne peut être exigé avant l\'expiration d\'un délai de 7 jours à compter de la signature (art. L. 221-10 C. conso.), sauf travaux urgents demandés expressément par le client.')
    }

    // ══════════════════════════════════════════════
    // 7. MÉDIATEUR DE LA CONSOMMATION (obligatoire depuis 01/01/2016 — B2C)
    // ══════════════════════════════════════════════
    if (!isClientPro) {
      if (mediatorName) {
        mentions.push(`Médiation de la consommation (art. L. 612-1 C. conso.) : ${mediatorName}${mediatorUrl ? ' — ' + mediatorUrl : ''}`)
      } else {
        mentions.push('Médiation de la consommation (art. L. 612-1 C. conso.) : en cas de litige, le client peut recourir gratuitement à un médiateur de la consommation.')
      }
    }

    // ══════════════════════════════════════════════
    // 8. MENTIONS SPÉCIFIQUES SOCIÉTÉS (SARL, EURL, SAS)
    // ══════════════════════════════════════════════
    if (isSociete) {
      if (companyRCS) {
        mentions.push(`Siège social : ${companyAddress || '—'} — ${companyRCS}`)
      }
    }

    return mentions
  }

  // ─── Actions ───
  const handleSaveDraft = () => {
    const data = buildData()
    // Save to localStorage as draft
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id || 'default'}`) || '[]')
    drafts.push({ ...data, savedAt: new Date().toISOString(), status: 'brouillon' })
    localStorage.setItem(`fixit_drafts_${artisan?.id || 'default'}`, JSON.stringify(drafts))
    alert('💾 Brouillon enregistré !')
  }

  const handleGeneratePDF = async () => {
    setPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default

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
      const leftText = (text: string, x: number, yPos: number, size: number, style: string = 'normal', color: string = col) => {
        pdf.setFontSize(size); pdf.setFont('helvetica', style); pdf.setTextColor(color)
        pdf.text(text, x, yPos)
      }
      const rightText = (text: string, x: number, yPos: number, size: number, style: string = 'normal', color: string = col) => {
        pdf.setFontSize(size); pdf.setFont('helvetica', style); pdf.setTextColor(color)
        pdf.text(text, x, yPos, { align: 'right' })
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

      // ═══ 1. TITRE ═══
      // Titre de l'intervention/projet en gros
      if (docTitle) {
        centerText(docTitle.toUpperCase(), y, 14, 'bold')
        y += 5
      }
      // Numéro du document — sans répéter "Devis" ou "Facture" si docTitle présent
      centerText(docNumber, y, 8, 'normal', colLight)
      y += 4
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
      pdf.text('ÉMETTEUR', emCenterX, boxStartY + boxPad, { align: 'center' })
      // petit trait centré sous le header
      drawLine(emCenterX - 8, boxStartY + boxPad + 2, emCenterX + 8, '#E2E8F0', 0.2)
      let ey = boxStartY + boxPad + 5
      const emMaxW = boxW - boxPad * 2
      // We need to position text within the left box
      const emLx = emX + boxPad
      ey += labelValue('Société : ', companyName, emLx, ey, emMaxW)
      if (companySiret) ey += labelValue('SIRET : ', companySiret, emLx, ey, emMaxW)
      if (companyRCS) ey += labelValue('RCS/RM : ', companyRCS, emLx, ey, emMaxW)
      if (companyCapital) ey += labelValue('Capital : ', `${companyCapital} €`, emLx, ey, emMaxW)
      if (companyAddress) ey += labelValue('Adresse : ', companyAddress, emLx, ey, emMaxW)
      if (companyPhone) ey += labelValue('Tél : ', companyPhone, emLx, ey, emMaxW)
      if (companyEmail) ey += labelValue('Email : ', companyEmail, emLx, ey, emMaxW)
      if (tvaEnabled && tvaNumber) ey += labelValue('N° TVA : ', tvaNumber, emLx, ey, emMaxW)
      if (insuranceName) {
        ey += 1
        const insLabel = insuranceType === 'rc_pro' ? 'RC Pro' : insuranceType === 'decennale' ? 'Décennale' : 'RC Pro + Déc.'
        ey += labelValue(`${insLabel} : `, insuranceName, emLx, ey, emMaxW)
      }
      if (insuranceNumber) ey += labelValue('N° contrat : ', insuranceNumber, emLx, ey, emMaxW)
      if (insuranceCoverage) ey += labelValue('Couverture : ', insuranceCoverage, emLx, ey, emMaxW)

      // ── Destinataire box ──
      const destX = emX + boxW + 6
      const destCenterX = destX + boxW / 2
      // Header — centré dans la box droite
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text('DESTINATAIRE', destCenterX, boxStartY + boxPad, { align: 'center' })
      drawLine(destCenterX - 8, boxStartY + boxPad + 2, destCenterX + 8, '#E2E8F0', 0.2)
      let dy = boxStartY + boxPad + 5
      const destLx = destX + boxPad
      const destMaxW = boxW - boxPad * 2
      dy += labelValue('Nom : ', clientName, destLx, dy, destMaxW)
      if (clientAddress) dy += labelValue('Adresse : ', clientAddress, destLx, dy, destMaxW)
      if (interventionAddress) dy += labelValue('Lieu intervention : ', interventionAddress, destLx, dy, destMaxW)
      if (clientPhone) dy += labelValue('Tél : ', clientPhone, destLx, dy, destMaxW)
      if (clientEmail) dy += labelValue('Email : ', clientEmail, destLx, dy, destMaxW)
      if (clientSiret) dy += labelValue('SIRET : ', clientSiret, destLx, dy, destMaxW)

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
      drawInfo("Date d'émission : ", docDate ? new Date(docDate).toLocaleDateString('fr-FR') : docDate)
      if (docType === 'devis') {
        if (docValidity) drawInfo('Validité : ', `${docValidity} jours`)
        if (executionDelay) drawInfo("Délai d'exécution : ", executionDelay)
        if (prestationDate) drawInfo('Date prestation : ', new Date(prestationDate).toLocaleDateString('fr-FR'))
      }
      if (docType === 'facture') {
        // Date de prestation (quand les travaux ont été réalisés) — distincte de la date d'émission
        if (prestationDate) drawInfo('Prestation : ', new Date(prestationDate).toLocaleDateString('fr-FR'))
        if (paymentDue) drawInfo('Échéance : ', new Date(paymentDue).toLocaleDateString('fr-FR'))
        // Référence au devis d'origine
        if (sourceDevisRef) drawInfo('Réf. devis : ', sourceDevisRef)
      }
      y += 12

      // ═══ 4. TABLEAU PRESTATIONS (autoTable) ═══
      const priceLabel = tvaEnabled ? 'HT' : 'TTC'
      const tableHead = tvaEnabled
        ? [['Désignation', 'Qté', 'Unité', `Prix U. ${priceLabel}`, 'TVA', `Total ${priceLabel}`]]
        : [['Désignation', 'Qté', 'Unité', `Prix U. ${priceLabel}`, `Total ${priceLabel}`]]

      const tableBody = lines.filter(l => l.description.trim()).map(l => {
        const unitStr = l.unit ? (l.unit === 'u' ? 'u' : l.unit) : 'u'
        const row = [l.description, String(l.qty), unitStr, `${l.priceHT.toFixed(2)} €`]
        if (tvaEnabled) row.push(`${l.tvaRate}%`)
        row.push(`${l.totalHT.toFixed(2)} €`)
        return row
      })

      if (tableBody.length === 0) {
        tableBody.push(tvaEnabled
          ? ['Aucune prestation renseignée', '', '', '', '', '']
          : ['Aucune prestation renseignée', '', '', '', '']
        )
      }

      const colCount = tvaEnabled ? 6 : 5
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
      pdf.text(tvaEnabled ? 'Sous-total HT' : 'Sous-total', totBoxX + 3, y + 5)
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(`${subtotalHT.toFixed(2)} €`, totBoxX + totBoxW - 3, y + 5, { align: 'right' })
      y += 7

      if (tvaEnabled) {
        pdf.setFillColor('#F8FAFC')
        pdf.rect(totBoxX, y, totBoxW, 7, 'FD')
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
        pdf.text('TVA', totBoxX + 3, y + 5)
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(`${totalTVA.toFixed(2)} €`, totBoxX + totBoxW - 3, y + 5, { align: 'right' })
        y += 7
      }

      if (docType === 'facture' && discount) {
        pdf.setFillColor('#F8FAFC')
        pdf.rect(totBoxX, y, totBoxW, 7, 'FD')
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
        pdf.text('Escompte', totBoxX + 3, y + 5)
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(discount, totBoxX + totBoxW - 3, y + 5, { align: 'right' })
        y += 7
      }

      // Total final — bande accent
      const totalVal = tvaEnabled ? totalTTC : subtotalHT
      pdf.setFillColor(colAccent)
      pdf.rect(totBoxX, y, totBoxW, 10, 'F')
      pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(tvaEnabled ? 'TOTAL TTC' : 'TOTAL NET', totBoxX + 3, y + 7)
      pdf.text(`${totalVal.toFixed(2)} €`, totBoxX + totBoxW - 3, y + 7, { align: 'right' })
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
        pdf.text('CONDITIONS', condCenterX, condStartY + 4, { align: 'center' })
        drawLine(condCenterX - 8, condStartY + 6, condCenterX + 8, '#E2E8F0', 0.2)
        let cy = condStartY + 10
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#475569')
        const condLines = [
          `Validité du devis : ${docValidity ? `${docValidity} jours` : '30 jours'} à compter de la date d'émission.`,
          ...(executionDelay ? [`Délai d'exécution : ${executionDelay}.`] : []),
          "Toute modification des travaux fera l'objet d'un avenant signé par les deux parties.",
          ...(paymentMode ? [`Mode de règlement : ${paymentMode}.`] : []),
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
        pdf.text('BON POUR ACCORD', sigCenterX, condStartY + 4, { align: 'center' })
        drawLine(sigCenterX - 10, condStartY + 6, sigCenterX + 10, '#E2E8F0', 0.2)
        pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
        pdf.text('Mention manuscrite :', sigX + 4, condStartY + 10)
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(5.5); pdf.setTextColor('#9CA3AF')
        const mentionText = '"Devis reçu avant l\'exécution des travaux, lu et approuvé, bon pour accord"'
        const mentionWrapped = pdf.splitTextToSize(mentionText, sigW - 8)
        pdf.text(mentionWrapped, sigX + 4, condStartY + 14)
        const mentionEndY = condStartY + 14 + mentionWrapped.length * 2.5
        drawLine(sigX + 4, mentionEndY + 3, sigX + sigW - 4, '#D1D5DB', 0.2)
        pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
        pdf.text('Date : ___/___/______', sigX + 4, mentionEndY + 7)
        pdf.text('Signature :', sigX + 4, mentionEndY + 11)
        pdf.roundedRect(sigX, condStartY, sigW, condH, 1.5, 1.5, 'S')

        y = condStartY + condH + 6
      } else if (docType === 'facture') {
        // Section complète CONDITIONS DE RÈGLEMENT pour facture
        const payLines: string[] = []
        if (paymentCondition) payLines.push(paymentCondition)
        if (paymentMode) payLines.push(`Mode de règlement : ${paymentMode}`)
        if (paymentDue) payLines.push(`Date limite de paiement : ${new Date(paymentDue).toLocaleDateString('fr-FR')}`)
        if (iban) payLines.push(`IBAN : ${iban}${bic ? '  —  BIC : ' + bic : ''}`)
        payLines.push("Pénalités de retard : tout retard de paiement entraînera l'application de pénalités calculées au taux légal majoré de 10 points (art. L. 441-10 C. com.) ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. D. 441-5 C. com.).")
        if (discount) payLines.push(`Escompte pour paiement anticipé : ${discount}`)
        else payLines.push("Pas d'escompte pour paiement anticipé, sauf accord préalable.")
        // Référence au devis signé (lien juridique)
        if (sourceDevisRef) {
          payLines.push(`Facture établie conformément au devis signé n° ${sourceDevisRef}${prestationDate ? ` en date du ${new Date(prestationDate).toLocaleDateString('fr-FR')}` : ''}.`)
        } else if (notes && notes.includes('Réf. devis')) {
          const devisRef = notes.match(/Réf\. devis\s*:\s*([^\n]+)/)?.[1]?.trim()
          if (devisRef) payLines.push(`Facture établie conformément au devis signé n° ${devisRef}.`)
        }
        // Clause contestation
        payLines.push("En cas de contestation, celle-ci devra être formulée par écrit dans un délai de 8 jours suivant réception de la facture.")

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
        pdf.text('CONDITIONS DE RÈGLEMENT', condCenterX, condStartY + 4, { align: 'center' })
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
        const noteWrapped = pdf.splitTextToSize(`Notes : ${notes}`, contentW - 8)
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
        rapportLines.push(`Rapport d'intervention joint — ${attachedRapport.rapportNumber}`)
        if (attachedRapport.interventionDate) rapportLines.push(`Date : ${new Date(attachedRapport.interventionDate).toLocaleDateString('fr-FR')}${attachedRapport.startTime ? ` de ${attachedRapport.startTime}` : ''}${attachedRapport.endTime ? ` à ${attachedRapport.endTime}` : ''}`)
        if (attachedRapport.motif) rapportLines.push(`Motif : ${attachedRapport.motif}`)
        if (attachedRapport.siteAddress) rapportLines.push(`Lieu : ${attachedRapport.siteAddress}`)
        const rapportH = rapportLines.length * 3.5 + 6
        pdf.roundedRect(mL, y, contentW, rapportH, 1.5, 1.5, 'FD')
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#9A3412')
        pdf.text(rapportLines[0], mL + 4, y + 4)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#78350F')
        rapportLines.slice(1).forEach((rl, i) => pdf.text(rl, mL + 4, y + 4 + (i + 1) * 3.5))
        y += rapportH + 4
      }

      // ═══ 9. MENTIONS LÉGALES ═══
      if (y > pageH - 20) { pdf.addPage(); y = 18 }
      drawLine(mL, y, pageW - mR, '#E5E7EB', 0.2)
      y += 3
      pdf.setFontSize(5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#9CA3AF')
      const legalText = `Mentions légales : ${getLegalMentions().join(' — ')}${tvaEnabled && tvaNumber ? ` — N° TVA intracommunautaire : ${tvaNumber}` : ''} — Document généré par Vitfix Pro le ${new Date().toLocaleDateString('fr-FR')} — Conformité : Code de commerce, Code de la consommation, Loi Pinel 2014.`
      const legalWrapped = pdf.splitTextToSize(legalText, contentW)
      pdf.text(legalWrapped, mL, y)

      // ═══ PAGE 2 — RÉTRACTATION ═══
      if (docType === 'devis' && isHorsEtablissement && clientSiret.trim().length === 0) {
        pdf.addPage()
        let ry = 18
        // Petit trait accent en haut
        drawLine(pageW / 2 - 15, ry - 4, pageW / 2 + 15, colAccent, 0.8)
        centerText(`${docType === 'devis' ? 'Devis' : 'Facture'} ${docNumber} — ${companyName} — Page 2/2`, ry, 7, 'normal', colLight)
        ry += 8

        // Encadré rétractation
        pdf.setFillColor('#FFF8F0'); pdf.setDrawColor('#F59E0B'); pdf.setLineWidth(0.5)
        const retBoxH = 110
        pdf.roundedRect(mL, ry, contentW, retBoxH, 2, 2, 'FD')

        centerText('DROIT DE RÉTRACTATION — Article L. 221-18 du Code de la consommation', ry + 7, 9, 'bold', '#B45309')
        ry += 14
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#92400E')
        const retLines = [
          "Le client dispose d'un délai de 14 jours calendaires à compter de la signature du présent devis pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.",
          "",
          "Pour exercer ce droit, le client peut utiliser le formulaire de rétractation ci-dessous ou adresser toute déclaration dénuée d'ambiguïté exprimant sa volonté de se rétracter.",
        ]
        retLines.forEach(rl => {
          if (rl === '') { ry += 2; return }
          const wrapped = pdf.splitTextToSize(rl, contentW - 12)
          pdf.text(wrapped, mL + 6, ry)
          ry += wrapped.length * 3.2
        })
        ry += 2
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#92400E')
        const urgentText = "Aucun paiement ne peut être exigé avant l'expiration d'un délai de 7 jours à compter de la signature (art. L. 221-10 C. conso.), sauf travaux urgents d'entretien ou de réparation demandés expressément par le client."
        const urgentWrapped = pdf.splitTextToSize(urgentText, contentW - 12)
        pdf.text(urgentWrapped, mL + 6, ry)
        ry += urgentWrapped.length * 3.2 + 4

        // Formulaire
        drawLine(mL + 10, ry, pageW - mR - 10, '#F59E0B', 0.3)
        ry += 5
        centerText('FORMULAIRE DE RÉTRACTATION', ry, 8, 'bold', '#B45309')
        ry += 5
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#92400E')
        pdf.text(`À l'attention de : ${companyName}, ${companyAddress}`, mL + 6, ry); ry += 4
        pdf.text("Je notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessus.", mL + 6, ry); ry += 6
        const formFields = ['Commandé le / reçu le :', 'Nom du client :', 'Adresse du client :', 'Signature du client :', 'Date :']
        formFields.forEach(f => {
          pdf.text(f, mL + 6, ry)
          const fw = pdf.getTextWidth(f) + 2
          drawLine(mL + 6 + fw, ry + 0.5, pageW - mR - 10, '#D1D5DB', 0.2)
          ry += 6
        })
      }

      const safeName = clientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_À-ÿ]/g, '') || 'Client'
      const filename = `${docType === 'devis' ? 'Devis' : 'Facture'}_${docNumber}_${safeName}.pdf`
      pdf.save(filename)

      // Auto-sauvegarder le document dans l'historique à chaque génération PDF
      const data = buildData()
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id || 'default'}`) || '[]')
      // Éviter les doublons : remplacer si même numéro existe déjà
      const existingIdx = docs.findIndex((d: any) => d.docNumber === data.docNumber)
      const docEntry = { ...data, savedAt: new Date().toISOString(), status: 'envoye' as const }
      if (existingIdx >= 0) {
        docs[existingIdx] = docEntry
      } else {
        docs.push(docEntry)
      }
      localStorage.setItem(`fixit_documents_${artisan?.id || 'default'}`, JSON.stringify(docs))
      onSave?.(data)

      // Proposer envoi par email ou Vitfix si clientEmail ou booking lié
      if (clientEmail || linkedBookingId) {
        setTimeout(() => {
          setShowSendModal('pdf')
        }, 600)
      }
    } catch (err) {
      console.error('Erreur PDF:', err)
      alert('❌ Erreur lors de la génération du PDF. Veuillez réessayer.')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleValidateAndSend = () => {
    if (!allCompliant) {
      const missing: string[] = []
      if (!compliance.siret) missing.push('SIRET')
      if (!compliance.rcs) missing.push('RCS/RM')
      if (!compliance.insurance) missing.push("N° assurance RC Pro")
      if (!compliance.client) missing.push('Nom client')
      if (!compliance.lines) missing.push('Au moins une prestation')
      if ('capital' in compliance && !compliance.capital) missing.push('Capital social (obligatoire pour ' + getStatusLabel(companyStatus) + ')')
      if ('tvaNumber' in compliance && !compliance.tvaNumber) missing.push('N° TVA intracommunautaire')
      alert('❌ Informations manquantes :\n\n' + missing.join('\n'))
      return
    }
    setShowSendModal('validate')
  }

  // ─── Save document helper (used by both send methods in validate mode) ───
  const saveAndFinalize = (mode: 'pdf' | 'validate' | null) => {
    if (mode === 'validate') {
      const data = buildData()
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id || 'default'}`) || '[]')
      docs.push({ ...data, savedAt: new Date().toISOString(), status: 'envoye' })
      localStorage.setItem(`fixit_documents_${artisan?.id || 'default'}`, JSON.stringify(docs))
      onSave?.(data)
    }
    setShowSendModal(null)
    if (mode === 'validate') onBack()
  }

  // ─── Send via Email ───
  const handleSendViaEmail = () => {
    const currentMode = showSendModal
    const totalVal = tvaEnabled ? totalTTC : subtotalHT
    const totalStr = `${totalVal.toFixed(2)} € ${tvaEnabled ? 'TTC' : 'HT'}`
    const subject = encodeURIComponent(`${docType === 'devis' ? 'Devis' : 'Facture'} ${docNumber} — ${companyName}`)
    const body = encodeURIComponent(
      `Bonjour ${clientName},\n\nVeuillez trouver en pièce jointe votre ${docType === 'devis' ? 'devis' : 'facture'} N°${docNumber} d'un montant de ${totalStr}.\n\nCordialement,\n${companyName}${companyPhone ? '\n' + companyPhone : ''}`
    )
    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`)
    saveAndFinalize(currentMode)
  }

  // ─── Send via Vitfix Channel ───
  const handleSendViaVitfix = async () => {
    if (!linkedBookingId) {
      alert('Aucune intervention liée. Veuillez importer depuis une intervention pour utiliser le canal Vitfix.')
      return
    }
    const currentMode = showSendModal
    setSendingVitfix(true)
    try {
      const headers = await getAuthHeaders()
      const totalVal = tvaEnabled ? totalTTC : subtotalHT
      const totalStr = `${totalVal.toFixed(2)} € ${tvaEnabled ? 'TTC' : 'HT'}`
      const typeLabel = docType === 'devis' ? 'Devis' : 'Facture'

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

      alert(`✅ ${typeLabel} envoyé via le canal Vitfix ! Le client recevra une notification.`)
      saveAndFinalize(currentMode)
    } catch (err) {
      console.error('Erreur envoi Vitfix:', err)
      alert('❌ Erreur lors de l\'envoi via Vitfix. Veuillez réessayer.')
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
    paymentMode,
    paymentDue,
    discount,
    lines,
    notes,
  })

  // ─── Recent interventions for quick import ───
  const recentBookings = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .slice(0, 10)

  // ─── Locked field style ───
  const lockedFieldClass = 'w-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed'
  const normalFieldClass = 'w-full p-3 border border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20'

  // Are legal fields locked? (verified = data comes from official source)
  const isLegalLocked = companyVerified || !!verifiedCompany?.legalForm

  return (
    <div className="animate-fadeIn">
      {/* Top header */}
      <div className="bg-white px-6 lg:px-10 py-4 border-b-2 border-[#FFC107] shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-700 font-semibold transition">
              ← Retour
            </button>
            <h1 className="text-xl font-semibold">
              {docType === 'devis' ? '📄 Nouveau Devis' : '🧾 Nouvelle Facture'}
              {docTitle && <span className="text-gray-500 font-normal ml-2">— {docTitle}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Bouton Passer en facture (affiché uniquement en mode devis) */}
            {docType === 'devis' && (
              <button
                onClick={() => {
                  if (confirm('Convertir ce devis en facture ? Toutes les informations seront conservées.')) {
                    setDocType('facture')
                    // Pré-remplir la date de prestation avec aujourd'hui si vide
                    if (!prestationDate) setPrestationDate(today)
                    // Ajouter la référence devis dans les notes
                    if (!notes.includes('Réf. devis')) {
                      setNotes((prev: string) => `Réf. devis : ${docNumber}${prev ? '\n' + prev : ''}`)
                    }
                  }
                }}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition flex items-center gap-2 shadow-sm"
              >
                🧾 Passer en facture
              </button>
            )}
            <div className="flex gap-1 bg-[#F8F9FA] p-1 rounded-lg">
              <button
                onClick={() => setDocType('devis')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition ${docType === 'devis' ? 'bg-[#FFC107] text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                📄 Devis
              </button>
              <button
                onClick={() => setDocType('facture')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition ${docType === 'facture' ? 'bg-[#FFC107] text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                🧾 Facture
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

          {/* ═══════════ LEFT: FORM ═══════════ */}
          <div className="space-y-6">

            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 pb-4 border-b-[3px] border-[#FFC107]">
                <h2 className="text-2xl font-bold text-[#2C3E50]">
                  {docType === 'devis' ? 'Nouveau Devis' : 'Nouvelle Facture'}
                </h2>
                <span className="text-lg text-gray-500 font-semibold">{docNumber}</span>
              </div>

              {/* Titre / Objet du document */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  🏷️ Titre / Objet du {docType === 'devis' ? 'devis' : 'de la facture'}
                  <span className="text-gray-500 font-normal ml-1">(ex : Nettoyage parc, Rénovation cuisine…)</span>
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="Ex : Nettoyage parc résidence Les Acacias"
                  className="w-full p-3 border-2 border-[#FFC107] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFC107]/30 text-[#2C3E50] font-medium text-lg placeholder:text-gray-300 placeholder:font-normal placeholder:text-sm"
                />
              </div>

              {/* Legal warning */}
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
                <p className="text-sm text-red-800">
                  <strong>{'⚠️'} CONFORMITÉ LÉGALE FRANÇAISE</strong><br />
                  Ce document respecte les obligations légales françaises (Code de commerce, Code de la consommation).
                  Toutes les mentions obligatoires sont incluses.
                </p>
              </div>

              {/* Quick import */}
              {recentBookings.length > 0 && (
                <div className="bg-gradient-to-r from-[#FFF9E6] to-[#FFE082] p-4 rounded-xl border-2 border-[#FFC107]">
                  <h3 className="font-semibold mb-1 flex items-center gap-2">{'⚡'} Import rapide depuis intervention</h3>
                  <p className="text-xs text-amber-700 mb-3">Pré-remplit automatiquement vos infos, celles du client et le motif — tout reste modifiable</p>
                  <div className="relative">
                    <select
                      onChange={(e) => importFromBooking(e.target.value)}
                      disabled={importingBooking}
                      className="w-full p-3 border-2 border-[#FFC107] rounded-lg bg-white text-sm cursor-pointer focus:outline-none disabled:opacity-60"
                      defaultValue=""
                    >
                      <option value="">Sélectionner une intervention récente...</option>
                      {recentBookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.booking_date} {b.booking_time?.substring(0, 5)} – {b.services?.name || 'Prestation'} – {formatPrice(b.price_ttc)}
                        </option>
                      ))}
                    </select>
                    {importingBooking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-amber-700 text-xs font-medium">
                        <span className="inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        Chargement…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Section: Entreprise ─── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                {'🏢'} Informations Entreprise (Prestataire)
              </h3>

              {/* Verified company banner */}
              {loadingCompany ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#FFC107] border-t-transparent"></div>
                  <span className="text-sm text-gray-500">Chargement des informations officielles...</span>
                </div>
              ) : isLegalLocked ? (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600 font-bold text-sm flex items-center gap-1">
                      {'✅'} DONNÉES VÉRIFIÉES — Registre officiel des entreprises
                    </span>
                  </div>
                  <p className="text-xs text-green-700">
                    Les informations ci-dessous sont issues du registre national des entreprises (INSEE/SIRENE).
                    Le statut juridique, la raison sociale, le SIRET et l&apos;adresse du siège social ne sont pas modifiables
                    pour garantir la conformité légale. Pour toute modification, veuillez mettre à jour votre KBIS.
                  </p>
                  {officialLegalForm && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      {'📋'} Source : {officialLegalForm} — SIRET {companySiret}
                      {companyNafLabel && ` — ${companyNafLabel}`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-4">
                  <p className="text-sm text-amber-800">
                    <strong>{'⚠️'} Données non vérifiées</strong> — Les informations entreprise n&apos;ont pas pu être confirmées
                    via le registre officiel. Remplissez manuellement.
                  </p>
                </div>
              )}

              {/* Statut juridique — LOCKED if verified */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                  Statut juridique <span className="text-red-500">*</span>
                  {isLegalLocked && (
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {'🔒'} Vérifié
                    </span>
                  )}
                </label>
                {isLegalLocked ? (
                  <div className="relative">
                    <div className={`${lockedFieldClass} flex items-center justify-between`}>
                      <span className="font-medium">{officialLegalForm || getStatusLabel(companyStatus)}</span>
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">{'🔒'} Non modifiable</span>
                    </div>
                    <input type="hidden" value={companyStatus} />
                  </div>
                ) : (
                  <select value={companyStatus} onChange={(e) => setCompanyStatus(e.target.value)}
                    className={`${normalFieldClass} bg-white`}>
                    <option value="ei">Entreprise Individuelle (EI)</option>
                    <option value="ae">Auto-Entrepreneur</option>
                    <option value="eurl">EURL</option>
                    <option value="sarl">SARL</option>
                    <option value="sas">SAS</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Nom commercial — LOCKED if verified */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                    Raison sociale <span className="text-red-500">*</span>
                    {isLegalLocked && (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {'🔒'} Vérifié
                      </span>
                    )}
                  </label>
                  <input type="text" value={companyName}
                    onChange={isLegalLocked ? undefined : (e) => setCompanyName(e.target.value)}
                    readOnly={isLegalLocked}
                    className={isLegalLocked ? lockedFieldClass : normalFieldClass} />
                </div>
                {/* SIRET — LOCKED if verified */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                    SIRET <span className="text-red-500">*</span>
                    {isLegalLocked && (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {'🔒'} Vérifié
                      </span>
                    )}
                  </label>
                  <input type="text" value={companySiret}
                    onChange={isLegalLocked ? undefined : (e) => setCompanySiret(e.target.value)}
                    readOnly={isLegalLocked}
                    placeholder="123 456 789 00012"
                    className={isLegalLocked ? lockedFieldClass : normalFieldClass} />
                </div>
              </div>

              {/* SIREN (read-only display if available) */}
              {companySiren && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-1">SIREN</label>
                  <input type="text" value={companySiren} readOnly className={lockedFieldClass} />
                </div>
              )}

              {/* Adresse siège social — LOCKED if verified */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                  Adresse siège social <span className="text-red-500">*</span>
                  {isLegalLocked && (
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {'🔒'} Vérifié
                    </span>
                  )}
                </label>
                <input type="text" value={companyAddress}
                  onChange={isLegalLocked ? undefined : (e) => setCompanyAddress(e.target.value)}
                  readOnly={isLegalLocked}
                  className={isLegalLocked ? lockedFieldClass : normalFieldClass} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">RCS / RM <span className="text-red-500">*</span></label>
                  <input type="text" value={companyRCS} onChange={(e) => setCompanyRCS(e.target.value)}
                    placeholder="Ex: RM Marseille 953951589"
                    className={normalFieldClass} />
                </div>
                {(companyStatus === 'sarl' || companyStatus === 'eurl' || companyStatus === 'sas') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Capital social</label>
                    <input type="text" value={companyCapital} onChange={(e) => setCompanyCapital(e.target.value)}
                      placeholder="Ex: 10000"
                      className={normalFieldClass} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Téléphone <span className="text-red-500">*</span></label>
                  <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)}
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)}
                    className={normalFieldClass} />
                </div>
              </div>

              {/* Assurance décennale / RC Pro */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg mb-4">
                <p className="text-sm text-blue-800 font-semibold">{'🛡️'} OBLIGATOIRE : Assurance Décennale / RC Pro (Loi Pinel 2014)</p>
                <p className="text-xs text-blue-600 mt-1">Mention obligatoire sur tous les devis et factures BTP — Absence sanctionnée jusqu&apos;à 75 000 €</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Type d&apos;assurance <span className="text-red-500">*</span></label>
                  <select value={insuranceType} onChange={(e) => setInsuranceType(e.target.value as 'rc_pro' | 'decennale' | 'both')}
                    className={normalFieldClass}>
                    <option value="rc_pro">RC Professionnelle</option>
                    <option value="decennale">Décennale</option>
                    <option value="both">RC Pro + Décennale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nom assureur <span className="text-red-500">*</span></label>
                  <input type="text" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)}
                    placeholder="Ex: MAAF Assurances"
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">N° contrat <span className="text-red-500">*</span></label>
                  <input type="text" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)}
                    placeholder="Ex: RC-2024-123456"
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Couverture géographique <span className="text-red-500">*</span></label>
                  <input type="text" value={insuranceCoverage} onChange={(e) => setInsuranceCoverage(e.target.value)}
                    placeholder="France métropolitaine"
                    className={normalFieldClass} />
                </div>
              </div>

              {/* Médiateur de la consommation */}
              <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded-r-lg mb-4 mt-6">
                <p className="text-sm text-purple-800 font-semibold">{'⚖️'} OBLIGATOIRE : Médiateur de la consommation (depuis 01/01/2016)</p>
                <p className="text-xs text-purple-600 mt-1">Tout professionnel doit communiquer les coordonnées de son médiateur — Absence sanctionnée jusqu&apos;à 15 000 €</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nom du médiateur</label>
                  <input type="text" value={mediatorName} onChange={(e) => setMediatorName(e.target.value)}
                    placeholder="Ex: Médiation de la consommation — CNPM"
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Site web du médiateur</label>
                  <input type="text" value={mediatorUrl} onChange={(e) => setMediatorUrl(e.target.value)}
                    placeholder="Ex: https://www.cnpm-mediation.fr"
                    className={normalFieldClass} />
                </div>
              </div>
            </div>

            {/* ─── Section: TVA ─── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                {'💶'} Configuration TVA
              </h3>
              <div className="flex items-center gap-4 p-4 bg-[#F8F9FA] rounded-xl mb-4">
                <button
                  onClick={() => {
                    const next = !tvaEnabled
                    setTvaEnabled(next)
                    // Mettre à jour le taux TVA de toutes les lignes existantes
                    setLines(prev => prev.map(l => ({ ...l, tvaRate: next ? 20 : 0 })))
                  }}
                  className={`w-14 h-7 rounded-full relative transition-colors flex-shrink-0 ${tvaEnabled ? 'bg-green-400' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${tvaEnabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
                </button>
                <div>
                  <div className="font-semibold">{tvaEnabled ? 'TVA activée' : 'Entreprise sans TVA'}</div>
                  <div className="text-sm text-gray-500">
                    {tvaEnabled ? 'TVA applicable sur les prestations' : 'Auto-entrepreneur ou franchise en base (art. 293 B du CGI)'}
                  </div>
                </div>
              </div>
              {(companyStatus === 'ae' || companyStatus === 'ei') && (
                <div className={`text-xs p-3 rounded-lg mb-4 ${tvaEnabled ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                  {tvaEnabled
                    ? '⚠️ En tant qu\'auto-entrepreneur/EI, vous ne facturez TVA que si vous avez dépassé le seuil de franchise (37 500 € pour les services, 85 000 € pour la vente). Vérifiez votre situation.'
                    : '✅ TVA non applicable — mention « TVA non applicable, art. 293 B du CGI » ajoutée automatiquement sur vos documents.'}
                </div>
              )}
              {tvaEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Numéro de TVA intracommunautaire <span className="text-red-500">*</span></label>
                  <input type="text" value={tvaNumber} onChange={(e) => setTvaNumber(e.target.value)}
                    placeholder="Ex: FR12345678900"
                    className={normalFieldClass} />
                </div>
              )}
            </div>

            {/* ─── Section: Client ─── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                {'👤'} Informations Client
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nom / Raison sociale <span className="text-red-500">*</span></label>
                  <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Marie Dubois"
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="marie.dubois@email.fr"
                    className={normalFieldClass} />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">Adresse complète (siège / domicile) <span className="text-red-500">*</span></label>
                <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="12 rue de la Paix, 75002 Paris"
                  className={normalFieldClass} />
              </div>
              {/* Adresse d'intervention — apparaît dès qu'un SIRET client est renseigné (pro/syndic) */}
              {clientSiret.trim().length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                    📍 Adresse d&apos;intervention
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Client pro</span>
                  </label>
                  <input type="text" value={interventionAddress} onChange={(e) => setInterventionAddress(e.target.value)}
                    placeholder="Adresse du chantier / lieu d'intervention (si différent du siège)"
                    className={normalFieldClass} />
                  <p className="text-xs text-gray-400 mt-1">Pour les syndics et professionnels, le lieu d&apos;intervention peut différer de l&apos;adresse du siège social</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Téléphone</label>
                  <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">SIRET (si pro / syndic)</label>
                  <input type="text" value={clientSiret} onChange={(e) => setClientSiret(e.target.value)}
                    placeholder="Optionnel — renseigner pour afficher l'adresse d'intervention"
                    className={normalFieldClass} />
                </div>
              </div>
            </div>

            {/* ─── Section: Document Info ─── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                {'📋'} Informations Document
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Date d&apos;émission <span className="text-red-500">*</span></label>
                  <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                    className={normalFieldClass} />
                  {docType === 'facture' && <p className="text-[10px] text-gray-400 mt-1">Date à laquelle la facture est créée (aujourd&apos;hui)</p>}
                </div>
                {docType === 'devis' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Validité (jours) <span className="text-red-500">*</span></label>
                    <input type="number" value={docValidity} onChange={(e) => setDocValidity(parseInt(e.target.value) || 30)}
                      className={normalFieldClass} />
                  </div>
                )}
                {docType === 'facture' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Date de prestation <span className="text-red-500">*</span></label>
                    <input type="date" value={prestationDate} onChange={(e) => setPrestationDate(e.target.value)}
                      className={normalFieldClass} />
                    <p className="text-[10px] text-gray-400 mt-1">Date à laquelle les travaux ont été réalisés (peut être différente)</p>
                  </div>
                )}
              </div>
              {docType === 'devis' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Délai d&apos;exécution <span className="text-red-500">*</span></label>
                  <div className="flex gap-3 items-center">
                    <input type="number" min="0" value={executionDelayDays || ''} onChange={(e) => {
                      const v = parseInt(e.target.value) || 0
                      setExecutionDelayDays(v)
                      setExecutionDelay(`${v} jour${v > 1 ? 's' : ''} ${executionDelayType === 'ouvres' ? 'ouvrés' : 'calendaires'}`)
                    }}
                      placeholder="Nb"
                      className="w-20 p-3 border border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20 text-center" />
                    <select value={executionDelayType} onChange={(e) => {
                      const t = e.target.value as 'ouvres' | 'calendaires'
                      setExecutionDelayType(t)
                      if (executionDelayDays > 0) setExecutionDelay(`${executionDelayDays} jour${executionDelayDays > 1 ? 's' : ''} ${t === 'ouvres' ? 'ouvrés' : 'calendaires'}`)
                    }}
                      className="flex-1 p-3 border border-gray-200 rounded-lg focus:border-[#FFC107] focus:outline-none focus:ring-2 focus:ring-[#FFC107]/20">
                      <option value="ouvres">jours ouvrés</option>
                      <option value="calendaires">jours calendaires</option>
                    </select>
                  </div>
                  {executionDelayDays > 0 && (
                    <p className="text-xs text-gray-500 mt-1.5">→ {executionDelay} après acceptation du devis</p>
                  )}
                </div>
              )}

              {/* Toggle droit de rétractation (devis uniquement) */}
              {docType === 'devis' && (
                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsHorsEtablissement(!isHorsEtablissement)}
                      className={`w-14 h-7 rounded-full relative transition-colors flex-shrink-0 ${isHorsEtablissement ? 'bg-orange-400' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isHorsEtablissement ? 'translate-x-7' : 'translate-x-0.5'}`} />
                    </button>
                    <div>
                      <div className="font-semibold text-sm text-orange-900">
                        {isHorsEtablissement ? '📋 Droit de rétractation 14 jours inclus' : 'Droit de rétractation désactivé'}
                      </div>
                      <div className="text-xs text-orange-700 mt-0.5">
                        {isHorsEtablissement
                          ? 'Contrat hors établissement (domicile du client, chantier, démarchage, à distance) — Mention obligatoire art. L. 221-18 C. conso.'
                          : 'Activez si le devis est signé hors de vos locaux professionnels. Attention : l\'absence de cette mention prolonge le délai de rétractation à 12 mois + 14 jours.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Section: Prestations ─── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                {'🔧'} Détail des Prestations
              </h3>

              {/* Table header */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[#2C3E50] text-white">
                      <th className="text-left p-3 font-semibold text-sm rounded-tl-lg" style={{ width: '30%' }}>Désignation</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '8%' }}>Qté</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '10%' }}>Unité</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '14%' }}>{tvaEnabled ? 'Prix U. HT' : 'Prix U. TTC'}</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '10%' }}>TVA %</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '18%' }}>{tvaEnabled ? 'Total HT' : 'Total TTC'}</th>
                      <th className="p-3 rounded-tr-lg" style={{ width: '8%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b border-gray-100">
                        <td className="p-2">
                          {line.description ? (
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-md text-sm focus:border-[#FFC107] focus:outline-none"
                            />
                          ) : (
                            <div>
                              <select
                                onChange={(e) => selectMotif(line.id, e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-md text-sm focus:border-[#FFC107] focus:outline-none bg-white"
                                defaultValue=""
                              >
                                <option value="">Choisir un motif...</option>
                                {services.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} - {formatPrice(s.price_ht)}
                                  </option>
                                ))}
                                <option value="custom">{'➕'} Saisie libre</option>
                              </select>
                              {line.description === '' && (
                                <input
                                  type="text"
                                  placeholder="Saisie libre..."
                                  onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                                  className="w-full p-2 border border-gray-200 rounded-md text-sm mt-1 focus:border-[#FFC107] focus:outline-none"
                                  style={{ display: 'none' }}
                                />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={line.qty}
                            onChange={(e) => updateLine(line.id, 'qty', parseInt(e.target.value) || 1)}
                            min={1}
                            className="w-full p-2 border border-gray-200 rounded-md text-sm text-center focus:border-[#FFC107] focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={line.unit || 'u'}
                            onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-md text-sm bg-white focus:border-[#FFC107] focus:outline-none"
                          >
                            <option value="u">Unité</option>
                            <option value="m²">m²</option>
                            <option value="m³">m³</option>
                            <option value="ml">ml</option>
                            <option value="h">Heure</option>
                            <option value="forfait">Forfait</option>
                            <option value="kg">kg</option>
                            <option value="lot">Lot</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={line.priceHT}
                            onChange={(e) => updateLine(line.id, 'priceHT', parseFloat(e.target.value) || 0)}
                            step="0.01"
                            className="w-full p-2 border border-gray-200 rounded-md text-sm focus:border-[#FFC107] focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={line.tvaRate}
                            onChange={(e) => updateLine(line.id, 'tvaRate', parseFloat(e.target.value))}
                            disabled={!tvaEnabled}
                            className="w-full p-2 border border-gray-200 rounded-md text-sm bg-white focus:border-[#FFC107] focus:outline-none disabled:opacity-60"
                          >
                            <option value={20}>20%</option>
                            <option value={10}>10%</option>
                            <option value={5.5}>5,5%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <div className="p-2 bg-gray-50 rounded-md text-sm font-semibold text-right">
                            {line.totalHT.toFixed(2)} €
                          </div>
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => removeLine(line.id)}
                            className="w-full bg-red-500 hover:bg-red-600 text-white p-2 rounded-md text-sm transition"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addLine}
                className="mt-4 w-full p-3 bg-white border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-semibold hover:border-[#FFC107] hover:text-[#FFC107] hover:bg-[#FFF9E6] transition"
              >
                + Ajouter une ligne
              </button>
            </div>

            {/* ─── Section: Payment (Facture only) ─── */}
            {docType === 'facture' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                  {'💳'} Conditions de Paiement (OBLIGATOIRE)
                </h3>
                <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg mb-4">
                  <p className="text-xs text-amber-800">Ces mentions sont obligatoires sur toute facture (art. L. 441-3 Code de commerce). L&apos;absence de pénalités de retard ou d&apos;indemnité de recouvrement est automatiquement ajoutée.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Conditions de paiement <span className="text-red-500">*</span></label>
                    <select value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)}
                      className={`${normalFieldClass} bg-white`}>
                      <option value="Paiement comptable à réception de facture">Paiement comptant à réception</option>
                      <option value="Paiement à 30 jours fin de mois">30 jours fin de mois</option>
                      <option value="Paiement à 30 jours date de facture">30 jours date de facture</option>
                      <option value="Paiement à 45 jours fin de mois">45 jours fin de mois</option>
                      <option value="Paiement à 60 jours date de facture">60 jours date de facture</option>
                      <option value="Paiement en 2 fois : 50% à la commande, solde à la réception">50% / 50%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Mode de règlement <span className="text-red-500">*</span></label>
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                      className={`${normalFieldClass} bg-white`}>
                      <option value="Virement bancaire">Virement bancaire</option>
                      <option value="Carte bancaire">Carte bancaire</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Espèces">Espèces</option>
                      <option value="Virement bancaire + Chèque">Virement + Chèque</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Date limite de paiement <span className="text-red-500">*</span></label>
                    <input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)}
                      className={normalFieldClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">IBAN</label>
                    <input type="text" value={iban} onChange={(e) => setIban(e.target.value)}
                      placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                      className={normalFieldClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">BIC</label>
                    <input type="text" value={bic} onChange={(e) => setBic(e.target.value)}
                      placeholder="BNPAFRPP"
                      className={normalFieldClass} />
                    <p className="text-[10px] text-gray-400 mt-1">IBAN + BIC recommandés si virement — évite les retards de paiement</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Escompte si paiement anticipé</label>
                  <input type="text" value={discount} onChange={(e) => setDiscount(e.target.value)}
                    placeholder="Ex: 2% si paiement sous 8 jours"
                    className={normalFieldClass} />
                </div>
              </div>
            )}

            {/* ─── Section: Notes ─── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                {'📝'} Notes complémentaires
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes optionnelles..."
                className={`${normalFieldClass} resize-none`}
              />
            </div>

            {/* ─── Section: Joindre un rapport ─── */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4 flex items-center gap-2 text-lg">
                {'📋'} Joindre un rapport d&apos;intervention
              </h3>
              {availableRapports.length > 0 ? (
                <div className="space-y-3">
                  <select
                    value={attachedRapportId || ''}
                    onChange={(e) => setAttachedRapportId(e.target.value || null)}
                    className={normalFieldClass}
                  >
                    <option value="">— Aucun rapport joint —</option>
                    {availableRapports.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.rapportNumber} — {r.interventionDate ? new Date(r.interventionDate).toLocaleDateString('fr-FR') : 'N/D'} — {r.motif || r.clientName || 'Intervention'}
                      </option>
                    ))}
                  </select>
                  {attachedRapport && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-900 text-sm">{attachedRapport.rapportNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          attachedRapport.status === 'termine' ? 'bg-green-100 text-green-700' :
                          attachedRapport.status === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                          attachedRapport.status === 'a_reprendre' ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {attachedRapport.status === 'termine' ? 'Terminé' :
                           attachedRapport.status === 'en_cours' ? 'En cours' :
                           attachedRapport.status === 'a_reprendre' ? 'À reprendre' : 'Sous garantie'}
                        </span>
                      </div>
                      {attachedRapport.motif && (
                        <p className="text-sm text-amber-800">{'🔧'} {attachedRapport.motif}</p>
                      )}
                      <div className="text-xs text-amber-600 space-y-0.5">
                        {attachedRapport.interventionDate && (
                          <p>{'📅'} {new Date(attachedRapport.interventionDate).toLocaleDateString('fr-FR')}
                            {attachedRapport.startTime && ` à ${attachedRapport.startTime}`}
                            {attachedRapport.endTime && ` → ${attachedRapport.endTime}`}
                          </p>
                        )}
                        {attachedRapport.siteAddress && <p>{'📍'} {attachedRapport.siteAddress}</p>}
                        {attachedRapport.travaux?.filter(Boolean).length > 0 && (
                          <p>{'✅'} {attachedRapport.travaux.filter(Boolean).length} travaux effectués</p>
                        )}
                      </div>
                      <button
                        onClick={() => setAttachedRapportId(null)}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                      >
                        Retirer le rapport
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Aucun rapport disponible. Créez d&apos;abord un rapport dans l&apos;onglet Rapports.
                </p>
              )}
            </div>

            {/* ─── Legal Mentions ─── */}
            <div className="bg-[#F8F9FA] rounded-xl p-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                <strong className="text-gray-800">Mentions légales automatiques :</strong><br />
                {getLegalMentions().map((m, i) => (
                  <span key={i}>{'📋'} {m}<br /></span>
                ))}
              </p>
            </div>
          </div>

          {/* ═══════════ RIGHT: SUMMARY PANEL ═══════════ */}
          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            {/* Totals */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4">Résumé</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">{tvaEnabled ? 'Sous-total HT' : 'Sous-total'}</span>
                  <span className="font-semibold">{subtotalHT.toFixed(2)} €</span>
                </div>
                {tvaEnabled && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">TVA</span>
                    <span className="font-semibold">{totalTVA.toFixed(2)} €</span>
                  </div>
                )}
                <div className={`flex justify-between p-4 -mx-5 -mb-5 rounded-b-2xl text-lg font-bold ${tvaEnabled ? 'bg-green-500 text-white' : 'bg-[#FFC107] text-gray-900'}`}>
                  <span>{tvaEnabled ? 'TOTAL TTC' : 'TOTAL NET'}</span>
                  <span>{(tvaEnabled ? totalTTC : subtotalHT).toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Verified Company Info Summary */}
            {isLegalLocked && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-[#2C3E50] mb-3 flex items-center gap-2">
                  {'🏢'} Entreprise vérifiée
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 flex-shrink-0">{'📋'}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{companyName}</p>
                      <p className="text-gray-500 text-xs">{officialLegalForm || getStatusLabel(companyStatus)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{'🆔'}</span>
                    <span className="text-gray-600">SIRET: {companySiret}</span>
                  </div>
                  {companySiren && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{'🏛️'}</span>
                      <span className="text-gray-600">SIREN: {companySiren}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 flex-shrink-0">{'📍'}</span>
                    <span className="text-gray-600">{companyAddress}</span>
                  </div>
                  {companyNafLabel && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{'🔧'}</span>
                      <span className="text-gray-600 text-xs">{companyNafLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compliance */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-3">Conformité légale</h3>
              <div className="text-xs text-gray-500 mb-3 bg-gray-50 px-3 py-1.5 rounded-lg">
                Statut : <span className="font-semibold text-gray-700">{getStatusLabel(companyStatus)}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>SIRET</span>
                  <span className={compliance.siret ? 'text-green-500' : 'text-red-500'}>{compliance.siret ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>RCS/RM</span>
                  <span className={compliance.rcs ? 'text-green-500' : 'text-red-500'}>{compliance.rcs ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Assurance RC Pro</span>
                  <span className={compliance.insurance ? 'text-green-500' : 'text-red-500'}>{compliance.insurance ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Client renseigné</span>
                  <span className={compliance.client ? 'text-green-500' : 'text-red-500'}>{compliance.client ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Prestations détaillées</span>
                  <span className={compliance.lines ? 'text-green-500' : 'text-red-500'}>{compliance.lines ? '✅' : '❌'}</span>
                </div>
                {'capital' in compliance && (
                  <div className="flex justify-between items-center">
                    <span>Capital social</span>
                    <span className={(compliance as any).capital ? 'text-green-500' : 'text-red-500'}>{(compliance as any).capital ? '✅' : '❌'}</span>
                  </div>
                )}
                {'tvaNumber' in compliance && (
                  <div className="flex justify-between items-center">
                    <span>N° TVA intracom.</span>
                    <span className={(compliance as any).tvaNumber ? 'text-green-500' : 'text-red-500'}>{(compliance as any).tvaNumber ? '✅' : '❌'}</span>
                  </div>
                )}
                {isLegalLocked && (
                  <div className="flex justify-between items-center">
                    <span>Données entreprise vérifiées</span>
                    <span className="text-green-500">✅</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleSaveDraft}
                  className="w-full p-3 bg-white text-gray-600 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  {'💾'} Enregistrer brouillon
                </button>
                <button
                  onClick={handleGeneratePDF}
                  disabled={pdfLoading}
                  className="w-full p-3 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-lg font-semibold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                >
                  {pdfLoading ? (
                    <><span className="inline-block animate-spin">⏳</span> Génération PDF...</>
                  ) : (
                    <><span>📄</span> Télécharger PDF</>
                  )}
                </button>
                <button
                  onClick={handleValidateAndSend}
                  disabled={!allCompliant}
                  className="w-full p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {'✉️'} Valider et envoyer
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#FFC107] to-[#FFD54F] p-5">
              <h3 className="text-lg font-bold text-gray-900">
                {showSendModal === 'pdf' ? '✅ PDF téléchargé !' : `✅ ${docType === 'devis' ? 'Devis' : 'Facture'} conforme`}
              </h3>
              <p className="text-gray-700 text-sm mt-1">
                Comment souhaitez-vous envoyer ce document au client ?
              </p>
            </div>
            <div className="p-5 space-y-3">
              {/* Option 1: Email */}
              {clientEmail && (
                <button
                  onClick={handleSendViaEmail}
                  className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-blue-200 transition group"
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl">{'✉️'}</span>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-blue-900">Envoyer par email</div>
                    <div className="text-xs text-blue-600 truncate max-w-[200px]">{clientEmail}</div>
                  </div>
                  <span className="ml-auto text-blue-400 group-hover:translate-x-1 transition-transform">{'→'}</span>
                </button>
              )}

              {/* Option 2: Vitfix Channel */}
              <button
                onClick={handleSendViaVitfix}
                disabled={!linkedBookingId || sendingVitfix}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition group ${
                  linkedBookingId
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-200'
                    : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  linkedBookingId ? 'bg-[#FFC107]' : 'bg-gray-300'
                }`}>
                  {sendingVitfix ? (
                    <span className="text-white text-xl animate-spin">{'⏳'}</span>
                  ) : (
                    <span className="text-white text-xl">{'💬'}</span>
                  )}
                </div>
                <div className="text-left">
                  <div className={`font-semibold ${linkedBookingId ? 'text-amber-900' : 'text-gray-500'}`}>
                    {sendingVitfix ? 'Envoi en cours...' : 'Envoyer via Vitfix'}
                  </div>
                  <div className={`text-xs ${linkedBookingId ? 'text-amber-600' : 'text-gray-500'}`}>
                    {linkedBookingId
                      ? 'Message direct dans le canal client'
                      : 'Importez depuis une intervention'}
                  </div>
                </div>
                {linkedBookingId && !sendingVitfix && (
                  <span className="ml-auto text-amber-400 group-hover:translate-x-1 transition-transform">{'→'}</span>
                )}
              </button>

              {/* Cancel */}
              <button
                onClick={() => setShowSendModal(null)}
                className="w-full p-3 text-gray-500 hover:text-gray-700 text-sm font-medium transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PDF is now generated with vector-based jsPDF + autoTable — no hidden HTML template needed ═══ */}
    </div>
  )
}
