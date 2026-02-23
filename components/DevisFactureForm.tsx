'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatPrice } from '@/lib/utils'

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

interface ProductLine {
  id: number
  description: string
  qty: number
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

  // ─── PDF ───
  const pdfTemplateRef = useRef<HTMLDivElement>(null)
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
  const [companyAddress, setCompanyAddress] = useState(initialData?.companyAddress || artisan?.address || '')
  const [companyRCS, setCompanyRCS] = useState(initialData?.companyRCS || '')
  const [companyCapital, setCompanyCapital] = useState(initialData?.companyCapital || '')
  const [companyPhone, setCompanyPhone] = useState(initialData?.companyPhone || artisan?.phone || '')
  const [companyEmail, setCompanyEmail] = useState(initialData?.companyEmail || artisan?.email || '')
  const [insuranceNumber, setInsuranceNumber] = useState(initialData?.insuranceNumber || '')
  const [insuranceName, setInsuranceName] = useState(initialData?.insuranceName || '')
  const [companySiren, setCompanySiren] = useState('')
  const [companyNafLabel, setCompanyNafLabel] = useState('')
  const [officialLegalForm, setOfficialLegalForm] = useState('')

  const [tvaEnabled, setTvaEnabled] = useState(initialData?.tvaEnabled || false)
  const [tvaNumber, setTvaNumber] = useState(initialData?.tvaNumber || '')

  const [clientName, setClientName] = useState(initialData?.clientName || '')
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '')
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress || '')
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '')
  const [clientSiret, setClientSiret] = useState(initialData?.clientSiret || '')

  const [docDate, setDocDate] = useState(today)
  const [docValidity, setDocValidity] = useState(initialData?.docValidity || 30)
  const [prestationDate, setPrestationDate] = useState(initialData?.prestationDate || '')
  const [executionDelay, setExecutionDelay] = useState(initialData?.executionDelay || '')
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || 'Virement bancaire')
  const [paymentDue, setPaymentDue] = useState(dueDateStr)
  const [discount, setDiscount] = useState(initialData?.discount || '')

  const [lines, setLines] = useState<ProductLine[]>(initialData?.lines || [])
  const [notes, setNotes] = useState(initialData?.notes || (initialData?.docNumber ? `Réf. devis : ${initialData.docNumber}` : ''))
  const [docTitle, setDocTitle] = useState(initialData?.docTitle || '')
  const [saving, setSaving] = useState(false)

  // Generate document number
  const [devisCount] = useState(4)
  const [factureCount] = useState(16)
  const docNumber = docType === 'devis'
    ? `DEV-${new Date().getFullYear()}-${String(devisCount).padStart(3, '0')}`
    : `FACT-${new Date().getFullYear()}-${String(factureCount).padStart(3, '0')}`

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
      const res = await fetch(`/api/artisan-company?artisan_id=${artisan.id}`)
      const json = await res.json()

      if (json.company) {
        const c = json.company
        setVerifiedCompany(c)
        setCompanyVerified(json.verified === true)

        // Auto-fill fields with verified data
        if (c.name) setCompanyName(c.name)
        if (c.siret) setCompanySiret(c.siret)
        if (c.siren) setCompanySiren(c.siren)
        if (c.address) setCompanyAddress(c.address)
        if (c.phone) setCompanyPhone(c.phone)
        if (c.email) setCompanyEmail(c.email)
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
  const addLine = () => {
    setLines(prev => [...prev, {
      id: Date.now(),
      description: '',
      qty: 1,
      priceHT: 0,
      tvaRate: 20,
      totalHT: 0,
    }])
  }

  const addLineWithData = (desc: string, qty: number, price: number, tva: number) => {
    setLines(prev => [...prev, {
      id: Date.now() + Math.random(),
      description: desc,
      qty,
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

  const selectMotif = (lineId: number, serviceId: string) => {
    if (serviceId === 'custom') {
      updateLine(lineId, 'description', '')
      return
    }
    const service = services.find(s => s.id === serviceId)
    if (service) {
      setLines(prev => prev.map(line => {
        if (line.id !== lineId) return line
        return {
          ...line,
          description: service.name,
          priceHT: service.price_ht || 0,
          totalHT: 1 * (service.price_ht || 0),
        }
      }))
    }
  }

  // ─── Import from intervention ───
  const importFromBooking = (bookingId: string) => {
    if (!bookingId) return
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return

    // Parse client info from notes
    const noteParts = booking.notes?.split(' | ') || []
    const clientNameFromNote = noteParts.find((p: string) => p.startsWith('Client:'))?.replace('Client: ', '') || ''
    const clientPhoneFromNote = noteParts.find((p: string) => p.startsWith('Tel:'))?.replace('Tel: ', '') || ''
    const clientEmailFromNote = noteParts.find((p: string) => p.startsWith('Email:'))?.replace('Email: ', '') || ''

    setClientName(clientNameFromNote)
    setClientPhone(clientPhoneFromNote)
    setClientEmail(clientEmailFromNote !== '-' ? clientEmailFromNote : '')
    setClientAddress(booking.address || '')
    setPrestationDate(booking.booking_date || '')

    // Add service line
    const serviceName = booking.services?.name || 'Prestation'
    setLines([{
      id: Date.now(),
      description: serviceName,
      qty: 1,
      priceHT: booking.price_ht || 0,
      tvaRate: 20,
      totalHT: booking.price_ht || 0,
    }])
  }

  // ─── Calculations ───
  const subtotalHT = lines.reduce((sum, l) => sum + l.totalHT, 0)
  const totalTVA = tvaEnabled
    ? lines.reduce((sum, l) => sum + (l.totalHT * l.tvaRate / 100), 0)
    : 0
  const totalTTC = subtotalHT + totalTVA

  // ─── Compliance Check ───
  const compliance = {
    siret: companySiret.trim().length > 0,
    rcs: companyRCS.trim().length > 0,
    insurance: insuranceNumber.trim().length > 0,
    client: clientName.trim().length > 0,
    lines: lines.some(l => l.description.trim().length > 0 && l.totalHT > 0),
  }
  const allCompliant = Object.values(compliance).every(Boolean)

  // ─── Legal Mentions ───
  const getLegalMentions = () => {
    const mentions: string[] = []
    if (docType === 'devis') {
      mentions.push("Devis gratuit - Conformément à l'article L111-1 du Code de la consommation")
    }
    if (!tvaEnabled) {
      mentions.push('TVA non applicable, article 293 B du CGI (franchise en base)')
    }
    if (companyStatus === 'ae') {
      mentions.push("Dispensé d'immatriculation en application de l'article L. 123-1-1 du Code de commerce")
    }
    if (docType === 'facture') {
      mentions.push('Pénalités de retard : 3,15% (taux BCE + 10 points)')
      mentions.push('Indemnité forfaitaire pour frais de recouvrement : 40€ (article D. 441-5 du Code de commerce)')
    }
    return mentions
  }

  // ─── Actions ───
  const handleSaveDraft = () => {
    const data = buildData()
    // Save to localStorage as draft
    const drafts = JSON.parse(localStorage.getItem('fixit_drafts') || '[]')
    drafts.push({ ...data, savedAt: new Date().toISOString(), status: 'brouillon' })
    localStorage.setItem('fixit_drafts', JSON.stringify(drafts))
    alert('💾 Brouillon enregistré !')
  }

  const handleGeneratePDF = async () => {
    if (!pdfTemplateRef.current) return
    setPdfLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(pdfTemplateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (canvas.height / canvas.width) * pdfWidth
      const pageHeight = pdf.internal.pageSize.getHeight()

      let position = 0
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight)
      while (imgHeight > pageHeight + Math.abs(position)) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight)
      }

      const safeName = clientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_À-ÿ]/g, '') || 'Client'
      const filename = `${docType === 'devis' ? 'Devis' : 'Facture'}_${docNumber}_${safeName}.pdf`
      pdf.save(filename)

      // Proposer envoi par email si clientEmail renseigné
      if (clientEmail) {
        const totalVal = tvaEnabled ? totalTTC : subtotalHT
        const totalStr = `${totalVal.toFixed(2)} € ${tvaEnabled ? 'TTC' : 'HT'}`
        const subject = encodeURIComponent(`${docType === 'devis' ? 'Devis' : 'Facture'} ${docNumber} — ${companyName}`)
        const body = encodeURIComponent(
          `Bonjour ${clientName},\n\nVeuillez trouver en pièce jointe votre ${docType === 'devis' ? 'devis' : 'facture'} N°${docNumber} d'un montant de ${totalStr}.\n\nCordialement,\n${companyName}${companyPhone ? '\n' + companyPhone : ''}`
        )
        setTimeout(() => {
          if (window.confirm('✅ PDF téléchargé ! Voulez-vous l\'envoyer par email au client ?')) {
            window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`)
          }
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
      alert('❌ Informations manquantes :\n\n' + missing.join('\n'))
      return
    }

    const typeLabel = docType === 'devis' ? 'Devis' : 'Facture'
    if (confirm(`✅ ${typeLabel} conforme aux normes françaises.\n\nEnvoyer au client ?`)) {
      const data = buildData()
      const docs = JSON.parse(localStorage.getItem('fixit_documents') || '[]')
      docs.push({ ...data, savedAt: new Date().toISOString(), status: 'envoye' })
      localStorage.setItem('fixit_documents', JSON.stringify(docs))
      onSave?.(data)
      alert(`✅ ${typeLabel} ${docNumber} envoyé avec succès !`)
      onBack()
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
              {docTitle && <span className="text-gray-400 font-normal ml-2">— {docTitle}</span>}
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
                  <span className="text-gray-400 font-normal ml-1">(ex : Nettoyage parc, Rénovation cuisine…)</span>
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
                  <h3 className="font-semibold mb-2 flex items-center gap-2">{'⚡'} Import rapide depuis intervention</h3>
                  <select
                    onChange={(e) => importFromBooking(e.target.value)}
                    className="w-full p-3 border-2 border-[#FFC107] rounded-lg bg-white text-sm cursor-pointer focus:outline-none"
                    defaultValue=""
                  >
                    <option value="">Sélectionner une intervention récente...</option>
                    {recentBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.booking_date} {b.booking_time?.substring(0, 5)} - {b.services?.name || 'Prestation'} - {formatPrice(b.price_ttc)}
                      </option>
                    ))}
                  </select>
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

              {/* Assurance RC Pro */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg mb-4">
                <p className="text-sm text-blue-800 font-semibold">{'📋'} OBLIGATOIRE : Assurance Responsabilité Civile Professionnelle</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">N° police d&apos;assurance <span className="text-red-500">*</span></label>
                  <input type="text" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)}
                    placeholder="Ex: RC-2024-123456"
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nom assureur <span className="text-red-500">*</span></label>
                  <input type="text" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)}
                    placeholder="Ex: MAAF Assurances"
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
                  onClick={() => setTvaEnabled(!tvaEnabled)}
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
                <label className="block text-sm font-medium text-gray-600 mb-1">Adresse complète <span className="text-red-500">*</span></label>
                <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="12 rue de la Paix, 75002 Paris"
                  className={normalFieldClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Téléphone</label>
                  <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className={normalFieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">SIRET (si pro)</label>
                  <input type="text" value={clientSiret} onChange={(e) => setClientSiret(e.target.value)}
                    placeholder="Optionnel"
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
                  </div>
                )}
              </div>
              {docType === 'devis' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Délai d&apos;exécution <span className="text-red-500">*</span></label>
                  <input type="text" value={executionDelay} onChange={(e) => setExecutionDelay(e.target.value)}
                    placeholder="Ex: 5 jours ouvrés après acceptation"
                    className={normalFieldClass} />
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
                      <th className="text-left p-3 font-semibold text-sm rounded-tl-lg" style={{ width: '35%' }}>Désignation</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '10%' }}>Qté</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '15%' }}>Prix U. HT</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '12%' }}>TVA %</th>
                      <th className="text-left p-3 font-semibold text-sm" style={{ width: '18%' }}>Total HT</th>
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
                            className="w-full p-2 border border-gray-200 rounded-md text-sm bg-white focus:border-[#FFC107] focus:outline-none disabled:opacity-50"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Mode de règlement <span className="text-red-500">*</span></label>
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                      className={`${normalFieldClass} bg-white`}>
                      <option value="Virement bancaire">Virement bancaire</option>
                      <option value="Carte bancaire">Carte bancaire</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Espèces">Espèces</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Date limite de paiement <span className="text-red-500">*</span></label>
                    <input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)}
                      className={normalFieldClass} />
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
                  <span className="text-gray-600">Sous-total HT</span>
                  <span className="font-semibold">{subtotalHT.toFixed(2)} €</span>
                </div>
                {tvaEnabled && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">TVA</span>
                    <span className="font-semibold">{totalTVA.toFixed(2)} €</span>
                  </div>
                )}
                <div className={`flex justify-between p-4 -mx-5 -mb-5 rounded-b-2xl text-lg font-bold ${tvaEnabled ? 'bg-green-500 text-white' : 'bg-[#FFC107] text-gray-900'}`}>
                  <span>{tvaEnabled ? 'Total TTC' : 'Total HT'}</span>
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
                    <span className="text-gray-400 flex-shrink-0">{'📋'}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{companyName}</p>
                      <p className="text-gray-500 text-xs">{officialLegalForm || getStatusLabel(companyStatus)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{'🆔'}</span>
                    <span className="text-gray-600">SIRET: {companySiret}</span>
                  </div>
                  {companySiren && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{'🏛️'}</span>
                      <span className="text-gray-600">SIREN: {companySiren}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 flex-shrink-0">{'📍'}</span>
                    <span className="text-gray-600">{companyAddress}</span>
                  </div>
                  {companyNafLabel && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{'🔧'}</span>
                      <span className="text-gray-600 text-xs">{companyNafLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compliance */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-[#2C3E50] mb-4">Conformité légale</h3>
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
                  className="w-full p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {'✉️'} Valider et envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          TEMPLATE PDF CACHÉ — capturé par html2canvas
          Positionné hors écran, jamais visible par l'utilisateur
          Tous les styles en inline (html2canvas ignore Tailwind)
          ═══════════════════════════════════════════════ */}
      <div
        ref={pdfTemplateRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '794px',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '12px',
          color: '#1a1a1a',
          padding: '48px 48px 40px 48px',
          boxSizing: 'border-box',
          lineHeight: '1.5',
        }}
      >
        {/* ─── En-tête ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '20px', borderBottom: '4px solid #FFC107' }}>
          {/* Colonne gauche : Artisan */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2C3E50', marginBottom: '4px' }}>{companyName}</div>
            <div style={{ color: '#666', fontSize: '11px', marginBottom: '2px' }}>{getStatusLabel(companyStatus)}</div>
            {companySiret && <div style={{ color: '#555', fontSize: '11px' }}>SIRET : {companySiret}</div>}
            {companyRCS && <div style={{ color: '#555', fontSize: '11px' }}>RCS/RM : {companyRCS}</div>}
            {companyCapital && <div style={{ color: '#555', fontSize: '11px' }}>Capital : {companyCapital} €</div>}
            {companyAddress && <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>{companyAddress}</div>}
            {companyPhone && <div style={{ color: '#555', fontSize: '11px' }}>{companyPhone}</div>}
            {companyEmail && <div style={{ color: '#555', fontSize: '11px' }}>{companyEmail}</div>}
            {insuranceNumber && (
              <div style={{ color: '#666', fontSize: '10px', marginTop: '6px', padding: '4px 8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                RC Pro : {insuranceName} — N° {insuranceNumber}
              </div>
            )}
          </div>
          {/* Colonne droite : Infos document */}
          <div style={{ textAlign: 'right', minWidth: '180px' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#FFC107', textTransform: 'uppercase', letterSpacing: '2px' }}>
              {docType === 'devis' ? 'DEVIS' : 'FACTURE'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2C3E50', marginBottom: docTitle ? '4px' : '8px' }}>{docNumber}</div>
            {docTitle && (
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#2C3E50', marginBottom: '8px', fontStyle: 'italic' }}>{docTitle}</div>
            )}
            <div style={{ color: '#555', fontSize: '11px' }}>Date : {docDate}</div>
            {docType === 'devis' && docValidity && <div style={{ color: '#555', fontSize: '11px' }}>Validité : {docValidity} jours</div>}
            {docType === 'devis' && prestationDate && <div style={{ color: '#555', fontSize: '11px' }}>Date prestation : {prestationDate}</div>}
            {docType === 'facture' && paymentDue && <div style={{ color: '#555', fontSize: '11px' }}>Échéance : {paymentDue}</div>}
            {tvaEnabled && tvaNumber && <div style={{ color: '#555', fontSize: '10px', marginTop: '4px' }}>N° TVA : {tvaNumber}</div>}
          </div>
        </div>

        {/* ─── Bloc Client ─── */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flex: 1, backgroundColor: '#F8F9FA', borderLeft: '4px solid #FFC107', padding: '14px 16px', borderRadius: '0 8px 8px 0' }}>
            <div style={{ fontWeight: 'bold', color: '#2C3E50', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client</div>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a1a1a' }}>{clientName}</div>
            {clientAddress && <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{clientAddress}</div>}
            {clientEmail && <div style={{ color: '#555', fontSize: '11px' }}>{clientEmail}</div>}
            {clientPhone && <div style={{ color: '#555', fontSize: '11px' }}>{clientPhone}</div>}
            {clientSiret && <div style={{ color: '#888', fontSize: '10px', marginTop: '4px' }}>SIRET : {clientSiret}</div>}
          </div>
        </div>

        {/* ─── Tableau Prestations ─── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#2C3E50', color: '#ffffff' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', width: '45%', fontWeight: 'bold' }}>Désignation</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', width: '8%', fontWeight: 'bold' }}>Qté</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', width: '16%', fontWeight: 'bold' }}>Prix U. HT</th>
              {tvaEnabled && <th style={{ padding: '10px 8px', textAlign: 'center', width: '10%', fontWeight: 'bold' }}>TVA</th>}
              <th style={{ padding: '10px 12px', textAlign: 'right', width: tvaEnabled ? '21%' : '31%', fontWeight: 'bold' }}>Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lines.filter(l => l.description.trim()).map((line, idx) => (
              <tr key={line.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F8F9FA' }}>
                <td style={{ padding: '9px 12px', borderBottom: '1px solid #EBEBEB' }}>{line.description}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', borderBottom: '1px solid #EBEBEB' }}>{line.qty}</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', borderBottom: '1px solid #EBEBEB' }}>{line.priceHT.toFixed(2)} €</td>
                {tvaEnabled && <td style={{ padding: '9px 8px', textAlign: 'center', borderBottom: '1px solid #EBEBEB' }}>{line.tvaRate}%</td>}
                <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid #EBEBEB', fontWeight: '600' }}>{line.totalHT.toFixed(2)} €</td>
              </tr>
            ))}
            {lines.filter(l => l.description.trim()).length === 0 && (
              <tr>
                <td colSpan={tvaEnabled ? 5 : 4} style={{ padding: '16px', textAlign: 'center', color: '#aaa', fontStyle: 'italic' }}>
                  Aucune prestation renseignée
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ─── Totaux ─── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{ width: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E5E7EB', fontSize: '12px' }}>
              <span style={{ color: '#555' }}>Sous-total HT</span>
              <span style={{ fontWeight: '600' }}>{subtotalHT.toFixed(2)} €</span>
            </div>
            {tvaEnabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E5E7EB', fontSize: '12px' }}>
                <span style={{ color: '#555' }}>TVA</span>
                <span style={{ fontWeight: '600' }}>{totalTVA.toFixed(2)} €</span>
              </div>
            )}
            {docType === 'facture' && discount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E5E7EB', fontSize: '12px' }}>
                <span style={{ color: '#555' }}>Escompte</span>
                <span style={{ fontWeight: '600' }}>{discount}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '12px 14px',
              backgroundColor: tvaEnabled ? '#27AE60' : '#FFC107',
              color: tvaEnabled ? '#ffffff' : '#1a1a1a',
              fontWeight: 'bold',
              fontSize: '15px',
              borderRadius: '8px',
              marginTop: '8px',
            }}>
              <span>{tvaEnabled ? 'Total TTC' : 'Total HT'}</span>
              <span>{(tvaEnabled ? totalTTC : subtotalHT).toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* ─── Conditions de paiement (facture uniquement) ─── */}
        {docType === 'facture' && (paymentMode || paymentDue) && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#F8F9FA', borderRadius: '6px', fontSize: '11px', color: '#555' }}>
            {paymentMode && <><strong>Mode de règlement :</strong> {paymentMode}{'  '}</>}
            {paymentDue && <><strong>Échéance :</strong> {paymentDue}</>}
          </div>
        )}

        {/* ─── Notes ─── */}
        {notes && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '11px', color: '#78350F' }}>
            <strong>Notes :</strong> {notes}
          </div>
        )}

        {/* ─── Mentions légales ─── */}
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '14px', fontSize: '9.5px', color: '#9CA3AF', lineHeight: '1.7' }}>
          {getLegalMentions().map((m, i) => (
            <div key={i}>• {m}</div>
          ))}
          {tvaEnabled && tvaNumber && <div>• N° TVA intracommunautaire : {tvaNumber}</div>}
          <div style={{ marginTop: '6px', color: '#C6C6C6', fontSize: '9px' }}>
            Document généré par VitFix Pro — {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>
      </div>
    </div>
  )
}
