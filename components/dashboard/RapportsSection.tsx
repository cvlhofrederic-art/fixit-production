'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import { normalizeForSearch, fuzzyFind } from '@/lib/fuzzy-match'
import type { Artisan, Service, Booking } from '@/lib/types'

interface CompanyData {
  name?: string
  address?: string
  phone?: string
  email?: string
  siret?: string
  insuranceName?: string
  insuranceNumber?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface PhotoRecord {
  id: string
  url?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface MissionRecord {
  id: string
  source?: string
  locataire?: string
  titre?: string
  immeuble?: string
  lot?: string
  type?: string
  description?: string
  dateIntervention?: string
  date?: string
  devis?: string
  priorite?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface DevisFactureRef {
  docNumber?: string
  savedAt?: string
  clientName?: string
  docType?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/* ══════════ RAPPORTS D'INTERVENTION ══════════ */

interface RapportIntervention {
  id: string
  rapportNumber: string
  createdAt: string
  linkedBookingId: string | null
  linkedPhotoIds?: string[]
  refDevisFact: string
  // Artisan
  artisanName: string
  artisanAddress: string
  artisanPhone: string
  artisanEmail: string
  artisanSiret: string
  artisanInsurance: string
  // Client
  clientName: string
  clientPhone: string
  clientEmail: string
  clientAddress: string
  // Intervention
  interventionDate: string
  startTime: string
  endTime: string
  siteAddress: string
  motif: string
  // Travaux
  travaux: string[]
  materiaux: string[]
  observations: string
  recommendations: string
  status: 'termine' | 'en_cours' | 'a_reprendre' | 'sous_garantie'
  sentStatus?: 'envoye' | 'non_envoye'
  sentAt?: string
  linkedDevisRef?: string
  linkedFactureRef?: string
  linkedDevisId?: string | null
  linkedFactureId?: string | null
}

const RAPPORT_STATUS_MAP = {
  termine: { label: '✅ Terminé', tagClass: 'v22-tag v22-tag-green' },
  en_cours: { label: '🔄 En cours', tagClass: 'v22-tag v22-tag-gray' },
  a_reprendre: { label: '⚠️ À reprendre', tagClass: 'v22-tag v22-tag-amber' },
  sous_garantie: { label: '🛡️ Sous garantie', tagClass: 'v22-tag v22-tag-gray' },
}

export default function RapportsSection({ artisan, bookings, services, onNavigate }: { artisan: Artisan | null; bookings: Booking[]; services: Service[]; onNavigate?: (page: string) => void }) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_rapports_${artisan?.id}`
  const pdfRef = useRef<HTMLDivElement>(null)

  const [rapports, setRapports] = useState<RapportIntervention[]>([])

  // Charger les rapports quand l'artisan est disponible
  useEffect(() => {
    if (!artisan?.id) return
    try {
      const stored = localStorage.getItem(`fixit_rapports_${artisan.id}`)
      if (stored) setRapports(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [artisan?.id])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [previewRapport, setPreviewRapport] = useState<RapportIntervention | null>(null)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)

  const [form, setForm] = useState<Partial<RapportIntervention>>({})
  const [importSource, setImportSource] = useState<'intervention' | 'mission'>('intervention')

  // Photos chantier pour liaison
  const [availablePhotos, setAvailablePhotos] = useState<PhotoRecord[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [linkedPhotos, setLinkedPhotos] = useState<string[]>([])
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)

  // ── Auto-complétion client + motif ──
  const [clientSuggestions, setClientSuggestions] = useState<{ name: string; phone?: string; email?: string; address?: string }[]>([])
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [motifSuggestions, setMotifSuggestions] = useState<{ name: string; id?: string | undefined }[]>([])
  const [showMotifSuggestions, setShowMotifSuggestions] = useState(false)

  // Extraire les clients uniques des bookings
  const knownClients = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; email?: string; address?: string }>()
    for (const b of bookings) {
      const name = b.client_name || b.name || ''
      if (name && !map.has(normalizeForSearch(name))) {
        map.set(normalizeForSearch(name), {
          name,
          phone: b.client_phone || b.phone || '',
          email: b.client_email || b.email || '',
          address: b.address || b.client_address || '',
        })
      }
    }
    return Array.from(map.values())
  }, [bookings])

  // Noms de services/motifs
  const knownMotifs = useMemo(() => {
    return services.map((s) => ({ name: s.name || '', id: s.id })).filter((m) => m.name)
  }, [services])

  // Recherche client quand l'utilisateur tape
  const handleClientNameChange = (value: string) => {
    setForm(p => ({ ...p, clientName: value }))
    if (value.length >= 2 && knownClients.length > 0) {
      const matches = knownClients.filter(c => {
        const cn = normalizeForSearch(c.name)
        const sv = normalizeForSearch(value)
        return cn.includes(sv) || sv.includes(cn) || cn.split(/\s+/).some(w => w.startsWith(sv)) || sv.split(/\s+/).some(w => cn.includes(w))
      }).slice(0, 5)
      // Ajouter fuzzy match si rien trouvé
      if (matches.length === 0) {
        const fuzzy = fuzzyFind(value, knownClients, c => c.name, 0.7)
        if (fuzzy) matches.push(fuzzy)
      }
      setClientSuggestions(matches)
      setShowClientSuggestions(matches.length > 0)
    } else {
      setShowClientSuggestions(false)
    }
  }

  const selectClientSuggestion = (client: typeof knownClients[0]) => {
    setForm(p => ({
      ...p,
      clientName: client.name,
      clientPhone: client.phone || p.clientPhone || '',
      clientEmail: client.email || p.clientEmail || '',
      clientAddress: client.address || p.clientAddress || '',
    }))
    setShowClientSuggestions(false)
  }

  // Recherche motif quand l'utilisateur tape
  const handleMotifChange = (value: string) => {
    setForm(p => ({ ...p, motif: value }))
    if (value.length >= 2 && knownMotifs.length > 0) {
      const matches = knownMotifs.filter(m => {
        const mn = normalizeForSearch(m.name)
        const sv = normalizeForSearch(value)
        return mn.includes(sv) || sv.includes(mn)
      }).slice(0, 5)
      if (matches.length === 0) {
        const fuzzy = fuzzyFind(value, knownMotifs, m => m.name, 0.7)
        if (fuzzy) matches.push(fuzzy)
      }
      setMotifSuggestions(matches)
      setShowMotifSuggestions(matches.length > 0)
    } else {
      setShowMotifSuggestions(false)
    }
  }

  const selectMotifSuggestion = (motif: { name: string; id?: string }) => {
    setForm(p => ({ ...p, motif: motif.name }))
    setShowMotifSuggestions(false)
  }

  // Load missions from localStorage (syndic + gestionnaire)
  const [availableMissions, setAvailableMissions] = useState<MissionRecord[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const allMissions: MissionRecord[] = []
      // 1. Missions gestionnaire
      const gestKey = `fixit_missions_gest_${artisan.id}`
      try {
        const gest = JSON.parse(localStorage.getItem(gestKey) || '[]')
        gest.forEach((m: MissionRecord) => allMissions.push({ ...m, source: 'gestionnaire' }))
      } catch {}
      // 2. Ordres de mission syndic (canal artisan)
      const artisanKey = `canal_artisan_${(artisan.company_name || artisan.nom || artisan.id || 'artisan').replace(/\s+/g, '_').toLowerCase()}`
      try {
        const ordres = JSON.parse(localStorage.getItem(artisanKey) || '[]')
        ordres.forEach((m: MissionRecord) => allMissions.push({ ...m, source: 'syndic' }))
      } catch {}
      setAvailableMissions(allMissions)
    } catch {}
  }, [artisan?.id, artisan?.company_name, artisan?.nom])

  // Auth helper for API calls
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` }
      }
    } catch {}
    return {}
  }

  // Load available photos chantier for linking
  const loadAvailablePhotos = async () => {
    if (!artisan?.id) return
    setPhotosLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/artisan-photos?artisan_id=${artisan.id}`, { headers })
      const json = await res.json()
      if (json.data) setAvailablePhotos(json.data)
    } catch (e) {
      console.error('Error loading photos for rapport:', e)
    } finally {
      setPhotosLoading(false)
    }
  }

  // Fetch artisan company data once (with auth)
  useEffect(() => {
    if (!artisan?.id) return
    ;(async () => {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`/api/artisan-company?artisan_id=${artisan.id}`, { headers })
        const d = await res.json()
        if (d.company) setCompanyData(d.company)
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artisan?.id])

  const saveRapports = (updated: RapportIntervention[]) => {
    setRapports(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const nextNumber = () => {
    const year = new Date().getFullYear()
    const existing = rapports.filter(r => r.rapportNumber?.startsWith(`RAP-${year}`))
    return `RAP-${year}-${String(existing.length + 1).padStart(3, '0')}`
  }

  const openNew = () => {
    const a: any = artisan || {} // eslint-disable-line @typescript-eslint/no-explicit-any
    const c: any = companyData || {} // eslint-disable-line @typescript-eslint/no-explicit-any
    setEditingId(null)
    setLinkedPhotos([])
    setForm({
      rapportNumber: nextNumber(),
      createdAt: new Date().toISOString(),
      linkedBookingId: null,
      linkedPhotoIds: [],
      refDevisFact: '',
      artisanName: c.name || a.company_name || '',
      artisanAddress: c.address || a.company_address || a.address || '',
      artisanPhone: c.phone || a.phone || '',
      artisanEmail: c.email || a.email || '',
      artisanSiret: c.siret || a.siret || '',
      artisanInsurance: c.insuranceName ? `${c.insuranceName} n°${c.insuranceNumber}` : '',
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      clientAddress: '',
      interventionDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '',
      siteAddress: '',
      motif: '',
      travaux: [''],
      materiaux: [''],
      observations: '',
      recommendations: '',
      status: 'termine',
      sentStatus: 'non_envoye',
    })
    loadAvailablePhotos()
    setShowForm(true)
  }

  const openEdit = (r: RapportIntervention) => {
    setEditingId(r.id)
    setLinkedPhotos(r.linkedPhotoIds || [])
    setForm({ ...r })
    loadAvailablePhotos()
    setShowForm(true)
  }

  // Link to a booking → pre-fill client + site info
  const linkBooking = async (bookingId: string) => {
    if (!bookingId) {
      setForm(prev => ({ ...prev, linkedBookingId: null, clientName: '', clientPhone: '', clientEmail: '', siteAddress: '' }))
      return
    }
    const b = bookings.find(x => x.id === bookingId)
    if (!b) return

    // Parse client info from notes — two formats:
    //   Client booking: "Client: Jean | Tel: 06… | Email: jean@… | notes…"
    //   Artisan RDV:    "Client: Jean Dupont. description…"
    const rawNotes = b.notes || ''
    const hasPipes = rawNotes.includes('|')
    const parseField = (label: string) => {
      if (hasPipes) {
        const m = rawNotes.match(new RegExp(`${label}:\\s*([^|\\n]+)`, 'i'))
        return m ? m[1].trim() : ''
      } else {
        const m = rawNotes.match(new RegExp(`${label}:\\s*([^.\\n]+)`, 'i'))
        return m ? m[1].trim() : ''
      }
    }

    const clientName = parseField('Client')
    const clientPhone = parseField('Tel')
    const clientEmail = parseField('Email')

    setForm(prev => ({
      ...prev,
      linkedBookingId: bookingId,
      clientName: clientName || '',
      clientPhone: clientPhone || '',
      clientEmail: clientEmail && clientEmail !== '-' ? clientEmail : '',
      siteAddress: b.address || '',
      interventionDate: b.booking_date || prev.interventionDate,
      startTime: b.booking_time?.substring(0, 5) || prev.startTime,
      motif: b.services?.name || prev.motif || '',
    }))

    // Enrich via API if client has a Fixit account
    if (b.client_id) {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`/api/artisan-clients?client_id=${b.client_id}`, { headers })
        if (res.ok) {
          const cd = await res.json()
          setForm(prev => ({
            ...prev,
            clientName: cd.name || prev.clientName,
            clientPhone: cd.phone || prev.clientPhone,
            clientEmail: cd.email || prev.clientEmail,
            clientAddress: cd.address || prev.clientAddress,
          }))
        }
      } catch { /* ignore — we already have notes data */ }
    }
  }

  // Import from mission (syndic/gestionnaire) → pre-fill rapport
  const linkMission = (missionId: string) => {
    if (!missionId) {
      setForm(prev => ({ ...prev, linkedBookingId: null, clientName: '', clientPhone: '', clientEmail: '', siteAddress: '', motif: '' }))
      return
    }
    const m = availableMissions.find(x => x.id === missionId)
    if (!m) return

    setForm(prev => ({
      ...prev,
      linkedBookingId: null,
      clientName: m.locataire || m.titre || '',
      clientAddress: m.immeuble ? `${m.immeuble}${m.lot ? ` — Lot ${m.lot}` : ''}` : '',
      siteAddress: m.immeuble ? `${m.immeuble}${m.lot ? ` — Lot ${m.lot}` : ''}` : prev.siteAddress || '',
      motif: m.type || m.titre || m.description || prev.motif || '',
      interventionDate: m.dateIntervention || m.date || prev.interventionDate,
      observations: m.description || '',
      refDevisFact: m.devis || prev.refDevisFact || '',
    }))
  }

  const saveForm = () => {
    const rapport: RapportIntervention = {
      ...form as RapportIntervention,
      travaux: (form.travaux || ['']).filter(t => t.trim()),
      materiaux: (form.materiaux || ['']).filter(m => m.trim()),
      linkedPhotoIds: linkedPhotos,
    }
    if (editingId) {
      saveRapports(rapports.map(r => r.id === editingId ? { ...rapport, id: editingId } : r))
    } else {
      saveRapports([{ ...rapport, id: `rap_${Date.now()}` }, ...rapports])
    }
    setShowForm(false)
  }

  // Toggle photo link
  const togglePhotoLink = (photoId: string) => {
    setLinkedPhotos(prev =>
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    )
  }

  const deleteRapport = (id: string) => {
    if (!confirm('Supprimer ce rapport ?')) return
    saveRapports(rapports.filter(r => r.id !== id))
  }

  // ═══ PDF generation — jsPDF vectoriel haute qualité (comme devis/factures) ═══
  const generatePDF = async (r: RapportIntervention) => {
    setPdfLoading(r.id)
    try {
      // Load photos if rapport has linked photos
      if (r.linkedPhotoIds?.length && availablePhotos.length === 0) {
        await loadAvailablePhotos()
      }
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()  // 210mm
      const pageH = pdf.internal.pageSize.getHeight() // 297mm
      const mL = 18, mR = 18
      const contentW = pageW - mL - mR
      const col = '#1E293B', colLight = '#64748B', colAccent = '#FFC107'

      // ─── Helper functions ───
      const drawLine = (x1: number, yPos: number, x2: number, color = '#E2E8F0', width = 0.3) => {
        pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
      }
      const checkPage = (need: number, currentY: number): number => {
        if (currentY + need > pageH - 15) { pdf.addPage(); return 18 }
        return currentY
      }
      const sectionHeader = (text: string, yPos: number, bgColor = '#1E293B'): number => {
        yPos = checkPage(12, yPos)
        pdf.setFillColor(bgColor)
        pdf.roundedRect(mL, yPos, contentW, 7, 1.5, 1.5, 'F')
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
        pdf.text(text.toUpperCase(), mL + 4, yPos + 4.8)
        return yPos + 8
      }
      const sectionBody = (yStart: number, render: (x: number, y: number, w: number) => number): number => {
        pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
        const bodyY = yStart
        const endY = render(mL + 4, bodyY + 4, contentW - 8)
        pdf.roundedRect(mL, yStart - 0.5, contentW, endY - yStart + 2, 0, 0, 'S')
        return endY + 4
      }
      let y = 0

      // ═══ 1. EN-TÊTE BANDEAU SOMBRE ═══
      pdf.setFillColor('#1E293B')
      pdf.rect(0, 0, pageW, 32, 'F')
      // Titre
      pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
      pdf.text("RAPPORT D'INTERVENTION", mL, 14)
      // Numéro
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#FFC107')
      pdf.text(r.rapportNumber, mL, 21)
      // Date
      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#94A3B8')
      pdf.text(`Établi le ${new Date().toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}`, mL, 27)
      // Référence devis/facture à droite
      if (r.refDevisFact) {
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#94A3B8')
        pdf.text(`Réf : ${r.refDevisFact}`, pageW - mR, 21, { align: 'right' })
      }
      // Bande jaune
      pdf.setFillColor('#FFC107')
      pdf.rect(0, 32, pageW, 1.5, 'F')
      y = 40

      // ═══ 2. ÉMETTEUR + CLIENT (2 colonnes) ═══
      const boxW = (contentW - 6) / 2
      const boxStartY = y

      // Émetteur
      pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
      pdf.setFillColor('#F8FAFC')
      pdf.roundedRect(mL, boxStartY, boxW, 36, 2, 2, 'FD')
      let ey = boxStartY + 4
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(colLight)
      pdf.text('PRESTATAIRE', mL + 4, ey); ey += 5
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(r.artisanName || '', mL + 4, ey); ey += 4
      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#475569')
      if (r.artisanAddress) { pdf.text(r.artisanAddress, mL + 4, ey); ey += 3.2 }
      if (r.artisanPhone) { pdf.text(r.artisanPhone, mL + 4, ey); ey += 3.2 }
      if (r.artisanEmail) { pdf.text(r.artisanEmail, mL + 4, ey); ey += 3.2 }
      if (r.artisanSiret) { pdf.setFontSize(6.5); pdf.setTextColor('#94A3B8'); pdf.text(`SIRET : ${r.artisanSiret}`, mL + 4, ey); ey += 3 }
      if (r.artisanInsurance) { pdf.text(r.artisanInsurance, mL + 4, ey) }

      // Client
      const destX = mL + boxW + 6
      pdf.setFillColor('#FFFBF0')
      pdf.setDrawColor('#FDE68A'); pdf.setLineWidth(0.3)
      pdf.roundedRect(destX, boxStartY, boxW, 36, 2, 2, 'FD')
      // Bord jaune gauche
      pdf.setFillColor('#FFC107')
      pdf.rect(destX, boxStartY + 2, 1.5, 32, 'F')
      let dy = boxStartY + 4
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#B45309')
      pdf.text('CLIENT', destX + 6, dy); dy += 5
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
      pdf.text(r.clientName || '', destX + 6, dy); dy += 4
      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#475569')
      if (r.clientAddress) { pdf.text(r.clientAddress, destX + 6, dy); dy += 3.2 }
      if (r.clientPhone) { pdf.text(r.clientPhone, destX + 6, dy); dy += 3.2 }
      if (r.clientEmail) { pdf.text(r.clientEmail, destX + 6, dy) }

      y = boxStartY + 38

      // ═══ 3. DÉTAILS INTERVENTION ═══
      pdf.setFillColor('#FFFBEB'); pdf.setDrawColor('#FDE68A'); pdf.setLineWidth(0.3)
      pdf.roundedRect(mL, y, contentW, 18, 2, 2, 'FD')
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#92400E')
      pdf.text("DÉTAILS DE L'INTERVENTION", mL + 4, y + 4)
      // 4 colonnes
      const colW4 = contentW / 4
      const detY = y + 9
      const detailCol = (label: string, value: string, cx: number) => {
        pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
        pdf.text(label, cx, detY)
        pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(value || '—', cx, detY + 4)
      }
      detailCol('Date', r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : '—', mL + 4)
      detailCol('Heure début', r.startTime || '—', mL + 4 + colW4)
      detailCol('Heure fin', r.endTime || '—', mL + 4 + colW4 * 2)
      // Durée calculée
      let durationStr = '—'
      if (r.startTime && r.endTime) {
        const [sh, sm] = r.startTime.split(':').map(Number)
        const [eh, em] = r.endTime.split(':').map(Number)
        const mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins > 0) durationStr = `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, '0') : '00'}`
      }
      detailCol('Durée', durationStr, mL + 4 + colW4 * 3)
      // Adresse chantier
      if (r.siteAddress) {
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
        pdf.text('Adresse chantier : ', mL + 4, y + 16)
        pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
        pdf.text(r.siteAddress, mL + 4 + pdf.getTextWidth('Adresse chantier : '), y + 16)
      }
      y += 22

      // ═══ 4. MOTIF D'INTERVENTION ═══
      if (r.motif) {
        y = sectionHeader("Motif d'intervention", y)
        y = sectionBody(y, (x, sy, w) => {
          pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
          const lines = pdf.splitTextToSize(r.motif, w)
          pdf.text(lines, x, sy)
          return sy + lines.length * 3.5 + 1
        })
      }

      // ═══ 5. TRAVAUX RÉALISÉS ═══
      const travaux = r.travaux?.filter(t => t) || []
      if (travaux.length > 0) {
        y = sectionHeader('Travaux réalisés', y)
        y = sectionBody(y, (x, sy, w) => {
          let ty = sy
          travaux.forEach(t => {
            ty = checkPage(5, ty)
            pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#059669')
            pdf.text('✓', x, ty)
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
            const tLines = pdf.splitTextToSize(t, w - 6)
            pdf.text(tLines, x + 5, ty)
            ty += tLines.length * 3.5 + 1
          })
          return ty
        })
      }

      // ═══ 6. MATÉRIAUX UTILISÉS ═══
      const materiaux = r.materiaux?.filter(m => m) || []
      if (materiaux.length > 0) {
        y = sectionHeader('Matériaux utilisés', y)
        y = sectionBody(y, (x, sy, w) => {
          let my = sy
          materiaux.forEach(m => {
            my = checkPage(5, my)
            pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
            pdf.text('•', x, my)
            pdf.setTextColor(col)
            const mLines = pdf.splitTextToSize(m, w - 6)
            pdf.text(mLines, x + 5, my)
            my += mLines.length * 3.5 + 1
          })
          return my
        })
      }

      // ═══ 7. OBSERVATIONS + RECOMMANDATIONS ═══
      if (r.observations || r.recommendations) {
        y = checkPage(25, y)
        const hasObs = !!r.observations
        const hasRec = !!r.recommendations
        const splitW = hasObs && hasRec ? (contentW - 4) / 2 : contentW

        if (hasObs) {
          // Observations
          pdf.setFillColor('#475569')
          pdf.roundedRect(mL, y, splitW, 7, 1.5, 1.5, 'F')
          pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
          pdf.text('OBSERVATIONS', mL + 4, y + 4.8)
          pdf.setDrawColor('#E2E8F0'); pdf.setFillColor('#F8FAFC')
          pdf.roundedRect(mL, y + 7, splitW, 20, 0, 0, 'FD')
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
          const obsLines = pdf.splitTextToSize(r.observations, splitW - 8)
          pdf.text(obsLines, mL + 4, y + 12)
        }

        if (hasRec) {
          const recX = hasObs ? mL + splitW + 4 : mL
          pdf.setFillColor('#2563EB')
          pdf.roundedRect(recX, y, splitW, 7, 1.5, 1.5, 'F')
          pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
          pdf.text('RECOMMANDATIONS', recX + 4, y + 4.8)
          pdf.setDrawColor('#E2E8F0'); pdf.setFillColor('#EFF6FF')
          pdf.roundedRect(recX, y + 7, splitW, 20, 0, 0, 'FD')
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
          const recLines = pdf.splitTextToSize(r.recommendations, splitW - 8)
          pdf.text(recLines, recX + 4, y + 12)
        }
        y += 30
      }

      // ═══ 8. PHOTOS CHANTIER ═══
      const linkedPhotosList = r.linkedPhotoIds?.length
        ? availablePhotos.filter(p => r.linkedPhotoIds?.includes(p.id))
        : []
      if (linkedPhotosList.length > 0) {
        y = checkPage(20, y)
        y = sectionHeader(`Photos chantier (${linkedPhotosList.length})`, y)
        y += 2

        const photoW = (contentW - 6) / 2
        const photoH = 50
        let photoCol = 0

        const loadImage = (url: string): Promise<HTMLImageElement> => {
          return new Promise((resolve, reject) => {
            const img = new window.Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('Image load failed'))
            img.src = url
          })
        }

        for (let i = 0; i < linkedPhotosList.length; i++) {
          const photo = linkedPhotosList[i]
          if (photoCol === 0) y = checkPage(photoH + 16, y)
          const x = mL + photoCol * (photoW + 6)

          try {
            const img = await loadImage(photo.url || '')
            pdf.setDrawColor('#E5E7EB'); pdf.setLineWidth(0.3)
            pdf.roundedRect(x, y, photoW, photoH + 10, 1.5, 1.5, 'S')

            const imgRatio = img.width / img.height
            let drawW = photoW - 4, drawH = photoH - 2
            if (imgRatio > drawW / drawH) { drawH = drawW / imgRatio } else { drawW = drawH * imgRatio }
            const imgX = x + (photoW - drawW) / 2
            const imgY = y + 1 + (photoH - 2 - drawH) / 2

            // Haute résolution 2400px
            const canvas = document.createElement('canvas')
            canvas.width = Math.min(img.width, 2400)
            canvas.height = Math.round(canvas.width / imgRatio)
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              const imgData = canvas.toDataURL('image/jpeg', 0.92)
              pdf.addImage(imgData, 'JPEG', imgX, imgY, drawW, drawH)
            }

            // Info photo
            pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
            const dateStr = photo.taken_at ? new Date(photo.taken_at).toLocaleString(dateFmtLocale) : ''
            if (dateStr) pdf.text(dateStr, x + 2, y + photoH + 3)
            if (photo.lat && photo.lng) {
              pdf.text(`GPS ${Number(photo.lat).toFixed(5)}, ${Number(photo.lng).toFixed(5)}`, x + 2, y + photoH + 6.5)
            }
          } catch {
            pdf.setFillColor('#F3F4F6')
            pdf.roundedRect(x, y, photoW, photoH + 10, 1.5, 1.5, 'FD')
            pdf.setFontSize(7); pdf.setTextColor('#9CA3AF')
            pdf.text('Photo non disponible', x + photoW / 2, y + photoH / 2, { align: 'center' })
          }

          photoCol++
          if (photoCol >= 2) { photoCol = 0; y += photoH + 14 }
        }
        if (photoCol > 0) y += photoH + 14
      }

      // ═══ FOOTER ═══
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#94A3B8')
      const footerText = `${r.artisanName}${r.artisanSiret ? ` — SIRET ${r.artisanSiret}` : ''} — Document généré par Vitfix Pro — ${new Date().toLocaleDateString(dateFmtLocale)}`
      pdf.text(footerText, pageW / 2, pageH - 8, { align: 'center' })

      pdf.save(`${r.rapportNumber}.pdf`)
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPreviewRapport(null)
      setPdfLoading(null)
    }
  }

  const fv = (v: string | undefined) => v || ''

  return (
    <div>
      {/* ── Header ── */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">Rapports d&apos;Intervention</h1>
          <p className="v22-page-sub">Compte-rendus BTP, lies a vos interventions</p>
        </div>
        <button onClick={openNew} className="v22-btn v22-btn-primary">
          + Nouveau rapport
        </button>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
      <div className="v22-modal-overlay open">
        {showForm && (
          <div className="v22-modal v22-modal--tall" style={{ maxWidth: '720px' }}>
            <div className="v22-modal-head">
              <span className="v22-modal-title">
                {editingId ? 'Modifier le rapport' : 'Nouveau rapport d\'intervention'}
              </span>
              <span className="v22-ref">{fv(form.rapportNumber)}</span>
              <button onClick={() => setShowForm(false)} className="v22-modal-close">✕</button>
            </div>

            <div className="v22-modal-body">
              {/* Liaison intervention / mission */}
              <div className="v22-card">
                <div className="v22-card-head">
                  <span className="v22-card-title">Import rapide : pre-remplir depuis</span>
                </div>
                <div className="v22-card-body" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button
                      onClick={() => setImportSource('intervention')}
                      className={importSource === 'intervention' ? 'v22-btn v22-btn-primary' : 'v22-btn'}
                      style={{ flex: 1 }}
                    >
                      Intervention client
                    </button>
                    <button
                      onClick={() => setImportSource('mission')}
                      className={importSource === 'mission' ? 'v22-btn v22-btn-primary' : 'v22-btn'}
                      style={{ flex: 1 }}
                    >
                      Mission syndic / pro
                    </button>
                  </div>

                  {importSource === 'intervention' ? (
                    <select
                      onChange={e => linkBooking(e.target.value)}
                      defaultValue=""
                      className="v22-form-input"
                    >
                      <option value="">Selectionner une intervention pour pre-remplir...</option>
                      {[...bookings].filter(b => b.status === 'confirmed' || b.status === 'completed').slice(0, 20).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.booking_date} {b.booking_time?.substring(0, 5)} — {b.services?.name || 'Intervention'} — {b.address || 'Adresse non definie'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select
                        onChange={e => linkMission(e.target.value)}
                        defaultValue=""
                        className="v22-form-input"
                      >
                        <option value="">Selectionner une mission pour pre-remplir...</option>
                        {availableMissions.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.source === 'syndic' ? '🏛️' : '🏢'} {m.titre || m.type || 'Mission'} — {m.immeuble || m.locataire || 'N/D'} — {m.dateIntervention || m.date || 'Date N/D'}
                            {m.priorite === 'urgente' ? ' ⚠️ URGENT' : ''}
                          </option>
                        ))}
                      </select>
                      {availableMissions.length === 0 && (
                        <p className="v22-card-meta" style={{ marginTop: '8px', fontStyle: 'italic' }}>Aucune mission disponible. Les missions apparaissent ici depuis vos Ordres de Mission ou missions gestionnaire.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Ref. devis / facture + statut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="v22-form-group">
                  <label className="v22-form-label">Lier a un Devis / Facture</label>
                  <select
                    value={fv(form.refDevisFact)}
                    onChange={e => setForm(p => ({ ...p, refDevisFact: e.target.value }))}
                    className="v22-form-input"
                  >
                    <option value="">Aucun document lie</option>
                    {(() => {
                      try {
                        const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                        const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                        return [...docs, ...drafts]
                          .filter((d: DevisFactureRef) => d.docNumber)
                          .sort((a: DevisFactureRef, b: DevisFactureRef) => (b.savedAt || '').localeCompare(a.savedAt || ''))
                          .map((d: DevisFactureRef) => (
                            <option key={d.docNumber} value={d.docNumber}>
                              {d.docNumber} — {d.clientName || 'Client'} — {d.docType === 'devis' ? 'Devis' : 'Facture'}
                            </option>
                          ))
                      } catch { return null }
                    })()}
                  </select>
                  <input type="text" value={fv(form.refDevisFact)} onChange={e => setForm(p => ({ ...p, refDevisFact: e.target.value }))}
                    placeholder="Ou saisir manuellement : DEV-2026-001"
                    className="v22-form-input" style={{ marginTop: '6px' }} />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">Statut</label>
                  <select value={fv(form.status)} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                    className="v22-form-input">
                    <option value="termine">Termine</option>
                    <option value="en_cours">En cours</option>
                    <option value="a_reprendre">A reprendre</option>
                    <option value="sous_garantie">Sous garantie</option>
                  </select>
                </div>
              </div>

              {/* Section Client */}
              <div className="v22-card">
                <div className="v22-card-head">
                  <span className="v22-card-title">Client</span>
                </div>
                <div className="v22-card-body" style={{ padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="v22-form-group" style={{ position: 'relative' }}>
                      <label className="v22-form-label">Nom / Raison sociale *</label>
                      <input type="text" value={fv(form.clientName)} onChange={e => handleClientNameChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                        placeholder="Jean Dupont" className="v22-form-input" autoComplete="off" />
                      {showClientSuggestions && clientSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'var(--v22-surface)', border: '1px solid var(--v22-border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 180, overflowY: 'auto' }}>
                          {clientSuggestions.map((c, i) => (
                            <button key={i} onMouseDown={() => selectClientSuggestion(c)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--v22-bg)] transition" style={{ borderBottom: '1px solid var(--v22-border)' }}>
                              <div style={{ fontWeight: 600 }}>{c.name}</div>
                              {c.phone && <div style={{ color: 'var(--v22-text-muted)', fontSize: 10 }}>{c.phone}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="v22-form-group">
                      <label className="v22-form-label">Telephone</label>
                      <input type="tel" value={fv(form.clientPhone)} onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))}
                        placeholder="06 00 00 00 00" className="v22-form-input" />
                    </div>
                    <div className="v22-form-group">
                      <label className="v22-form-label">Email</label>
                      <input type="email" value={fv(form.clientEmail)} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                        placeholder="client@exemple.fr" className="v22-form-input" />
                    </div>
                    <div className="v22-form-group">
                      <label className="v22-form-label">Adresse client</label>
                      <input type="text" value={fv(form.clientAddress)} onChange={e => setForm(p => ({ ...p, clientAddress: e.target.value }))}
                        placeholder="12 rue de la Paix, 13600..." className="v22-form-input" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Intervention */}
              <div className="v22-card">
                <div className="v22-card-head">
                  <span className="v22-card-title">Details de l&apos;intervention</span>
                </div>
                <div className="v22-card-body" style={{ padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div className="v22-form-group">
                      <label className="v22-form-label">Date *</label>
                      <input type="date" value={fv(form.interventionDate)} onChange={e => setForm(p => ({ ...p, interventionDate: e.target.value }))}
                        className="v22-form-input" />
                    </div>
                    <div className="v22-form-group">
                      <label className="v22-form-label">Heure debut</label>
                      <input type="time" value={fv(form.startTime)} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                        className="v22-form-input" />
                    </div>
                    <div className="v22-form-group">
                      <label className="v22-form-label">Heure fin</label>
                      <input type="time" value={fv(form.endTime)} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                        className="v22-form-input" />
                    </div>
                  </div>
                  <div className="v22-form-group" style={{ marginBottom: '10px' }}>
                    <label className="v22-form-label">Adresse du chantier (si differente du client)</label>
                    <input type="text" value={fv(form.siteAddress)} onChange={e => setForm(p => ({ ...p, siteAddress: e.target.value }))}
                      placeholder="Adresse d'intervention..." className="v22-form-input" />
                  </div>
                  <div className="v22-form-group" style={{ position: 'relative' }}>
                    <label className="v22-form-label">Motif / Description du probleme *</label>
                    <textarea value={fv(form.motif)} onChange={e => handleMotifChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowMotifSuggestions(false), 200)}
                      rows={2} placeholder="Fuite sous evier cuisine, remplacement robinet defectueux..."
                      className="v22-form-input" style={{ resize: 'none' }} />
                    {showMotifSuggestions && motifSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'var(--v22-surface)', border: '1px solid var(--v22-border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 160, overflowY: 'auto' }}>
                        {motifSuggestions.map((m, i) => (
                          <button key={i} onMouseDown={() => selectMotifSuggestion(m)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--v22-bg)] transition" style={{ borderBottom: '1px solid var(--v22-border)' }}>
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Travaux realises */}
              <div className="v22-card">
                <div className="v22-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="v22-card-title">Travaux realises</span>
                  <button onClick={() => setForm(p => ({ ...p, travaux: [...(p.travaux || []), ''] }))}
                    className="v22-btn v22-btn-sm">
                    + Ajouter
                  </button>
                </div>
                <div className="v22-card-body" style={{ padding: '14px' }}>
                  {(form.travaux || ['']).map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <span className="v22-card-meta">✓</span>
                      <input type="text" value={t} onChange={e => setForm(p => ({ ...p, travaux: (p.travaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                        placeholder="Depose et remplacement du robinet mitigeur..."
                        className="v22-form-input" style={{ flex: 1 }} />
                      {(form.travaux || []).length > 1 && (
                        <button onClick={() => setForm(p => ({ ...p, travaux: (p.travaux || []).filter((_, j) => j !== i) }))}
                          className="v22-btn v22-btn-sm" style={{ color: 'var(--v22-red)' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Materiaux */}
              <div className="v22-card">
                <div className="v22-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="v22-card-title">Materiaux utilises</span>
                  <button onClick={() => setForm(p => ({ ...p, materiaux: [...(p.materiaux || []), ''] }))}
                    className="v22-btn v22-btn-sm">
                    + Ajouter
                  </button>
                </div>
                <div className="v22-card-body" style={{ padding: '14px' }}>
                  {(form.materiaux || ['']).map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <span className="v22-card-meta">—</span>
                      <input type="text" value={m} onChange={e => setForm(p => ({ ...p, materiaux: (p.materiaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                        placeholder="Robinet mitigeur Grohe (1u), Joint 3/4 (2u)..."
                        className="v22-form-input" style={{ flex: 1 }} />
                      {(form.materiaux || []).length > 1 && (
                        <button onClick={() => setForm(p => ({ ...p, materiaux: (p.materiaux || []).filter((_, j) => j !== i) }))}
                          className="v22-btn v22-btn-sm" style={{ color: 'var(--v22-red)' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Observations + Recommandations */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="v22-form-group">
                  <label className="v22-form-label">Observations</label>
                  <textarea value={fv(form.observations)} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                    rows={3} placeholder="Constatations sur place, etat du materiel existant..."
                    className="v22-form-input" style={{ resize: 'none' }} />
                </div>
                <div className="v22-form-group">
                  <label className="v22-form-label">Recommandations</label>
                  <textarea value={fv(form.recommendations)} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))}
                    rows={3} placeholder="Travaux complementaires conseilles, delai de revision..."
                    className="v22-form-input" style={{ resize: 'none' }} />
                </div>
              </div>

              {/* Photos Chantier liees */}
              <div className="v22-card">
                <div className="v22-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="v22-card-title">Photos Chantier</span>
                  <button
                    type="button"
                    onClick={() => { setShowPhotoPicker(!showPhotoPicker); if (!showPhotoPicker && availablePhotos.length === 0) loadAvailablePhotos() }}
                    className="v22-btn v22-btn-sm"
                  >
                    {showPhotoPicker ? (locale === 'pt' ? '✕ Fechar' : '✕ Fermer') : (locale === 'pt' ? '+ Adicionar fotos' : '+ Ajouter des photos')}
                  </button>
                </div>
                <div className="v22-card-body" style={{ padding: '14px' }}>
                  {/* Photos deja liees */}
                  {linkedPhotos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      {linkedPhotos.map(photoId => {
                        const photo = availablePhotos.find(p => p.id === photoId)
                        return (
                          <div key={photoId} style={{ position: 'relative' }}>
                            {photo ? (
                              <Image src={photo.url || ''} alt="Photo chantier" width={80} height={80} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '2px solid var(--v22-green)' }} unoptimized />
                            ) : (
                              <div style={{ width: '80px', height: '80px', background: 'var(--v22-bg)', borderRadius: '6px', border: '2px solid var(--v22-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--v22-text-muted)' }}>📸</div>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePhotoLink(photoId)}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--v22-red)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                            {photo?.lat && photo?.lng && (
                              <div style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', padding: '1px 4px', borderRadius: '3px' }}>GPS</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {linkedPhotos.length === 0 && !showPhotoPicker && (
                    <p className="v22-card-meta" style={{ fontStyle: 'italic' }}>Aucune photo liee. Ajoutez des photos chantier pour les inclure dans le rapport.</p>
                  )}

                  {/* Picker — grille de photos disponibles */}
                  {showPhotoPicker && (
                    <div style={{ background: 'var(--v22-bg)', borderRadius: '6px', padding: '10px', marginTop: '8px' }}>
                      {photosLoading ? (
                        <div className="v22-card-meta" style={{ textAlign: 'center', padding: '16px' }}>Chargement des photos...</div>
                      ) : availablePhotos.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📸</div>
                          <p className="v22-card-meta">Aucune photo chantier disponible</p>
                          <p className="v22-card-meta" style={{ marginTop: '2px' }}>Prenez des photos depuis l&apos;app mobile</p>
                        </div>
                      ) : (
                        <>
                          <p className="v22-card-meta" style={{ marginBottom: '8px' }}>Cliquez pour selectionner / deselectionner :</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', maxHeight: '192px', overflowY: 'auto' }}>
                            {availablePhotos.map(photo => {
                              const isLinked = linkedPhotos.includes(photo.id)
                              return (
                                <button
                                  type="button"
                                  key={photo.id}
                                  onClick={() => togglePhotoLink(photo.id)}
                                  style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: isLinked ? '2px solid var(--v22-green)' : '2px solid var(--v22-border)', cursor: 'pointer', padding: 0, background: 'none' }}
                                >
                                  <Image src={photo.url || ''} alt="" width={100} height={64} style={{ width: '100%', height: '64px', objectFit: 'cover', display: 'block' }} unoptimized />
                                  {isLinked && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ background: 'var(--v22-green)', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                                    </div>
                                  )}
                                  <div style={{ fontSize: '8px', color: 'var(--v22-text-muted)', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {new Date(photo.taken_at).toLocaleDateString(dateFmtLocale)}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          <p className="v22-card-meta" style={{ marginTop: '8px', textAlign: 'right' }}>{linkedPhotos.length} photo{linkedPhotos.length > 1 ? 's' : ''} selectionnee{linkedPhotos.length > 1 ? 's' : ''}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="v22-modal-foot">
              <button onClick={() => setShowForm(false)} className="v22-btn" style={{ flex: 1 }}>
                Annuler
              </button>
              <button onClick={saveForm} disabled={!form.clientName || !form.interventionDate || !form.motif}
                className="v22-btn v22-btn-primary" style={{ flex: 1, opacity: (!form.clientName || !form.interventionDate || !form.motif) ? 0.5 : 1 }}>
                {editingId ? 'Mettre a jour' : 'Creer le rapport'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Compteurs ── */}
      {rapports.length > 0 && (
        <div style={{ padding: '16px 14px 0' }}>
          <div className="v22-stats">
            <div className="v22-stat">
              <div className="v22-stat-val">{rapports.length}</div>
              <div className="v22-stat-label">Total rapports</div>
            </div>
            <div className="v22-stat">
              <div className="v22-stat-val" style={{ color: 'var(--v22-green)' }}>{rapports.filter(r => r.sentStatus === 'envoye').length}</div>
              <div className="v22-stat-label">Envoyes</div>
            </div>
            <div className="v22-stat">
              <div className="v22-stat-val" style={{ color: 'var(--v22-amber)' }}>{rapports.filter(r => r.sentStatus !== 'envoye').length}</div>
              <div className="v22-stat-label">Non envoyes</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rapport list ── */}
      <div style={{ padding: '14px' }}>
        {rapports.length === 0 ? (
          <div className="v22-card" style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <div className="v22-card-title" style={{ marginBottom: '6px' }}>Aucun rapport</div>
            <p className="v22-card-meta" style={{ marginBottom: '16px' }}>Creez votre premier rapport d&apos;intervention BTP</p>
            <button onClick={openNew} className="v22-btn v22-btn-primary">
              Creer un rapport
            </button>
          </div>
        ) : (
          <div className="v22-card">
            <div className="v22-card-head">
              <span className="v22-card-title">Rapports ({rapports.length})</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Client</th>
                  <th>Motif</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Envoi</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rapports.map(r => {
                  const st = RAPPORT_STATUS_MAP[r.status] || RAPPORT_STATUS_MAP.termine
                  const duration = r.startTime && r.endTime ? (() => {
                    const [sh, sm] = r.startTime.split(':').map(Number)
                    const [eh, em] = r.endTime.split(':').map(Number)
                    const mins = (eh * 60 + em) - (sh * 60 + sm)
                    if (mins <= 0) return null
                    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, '0') : '00'}`
                  })() : null

                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="v22-ref">{r.rapportNumber}</span>
                        {r.refDevisFact && <div className="v22-card-meta" style={{ marginTop: '2px' }}>{r.refDevisFact}</div>}
                        {(r.linkedDevisId || r.linkedDevisRef) && (() => {
                          let label = r.linkedDevisRef || ''
                          if (r.linkedDevisId && artisan?.id) {
                            try {
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
                              const doc = docs.find((d: { id: string }) => d.id === r.linkedDevisId)
                              if (doc) label = `Devis ${doc.service || doc.clientName || doc.id}`
                            } catch { /* ignore */ }
                          }
                          return (
                            <div
                              className="v22-card-meta"
                              style={{ marginTop: '2px', color: 'var(--v22-yellow)', cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
                              onClick={() => onNavigate?.('devis')}
                            >
                              📋 Lié au devis: {label}
                            </div>
                          )
                        })()}
                        {(r.linkedFactureId || r.linkedFactureRef) && (() => {
                          let label = r.linkedFactureRef || ''
                          if (r.linkedFactureId && artisan?.id) {
                            try {
                              const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
                              const doc = docs.find((d: { id: string }) => d.id === r.linkedFactureId)
                              if (doc) label = `Facture ${doc.service || doc.clientName || doc.id}`
                            } catch { /* ignore */ }
                          }
                          return (
                            <div
                              className="v22-card-meta"
                              style={{ marginTop: '2px', color: 'var(--v22-yellow)', cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
                              onClick={() => onNavigate?.('devis')}
                            >
                              🧾 Lié à la facture: {label}
                            </div>
                          )
                        })()}
                      </td>
                      <td>
                        <span className="v22-client-name">{r.clientName || 'Client non defini'}</span>
                        {r.siteAddress && <div className="v22-card-meta">{r.siteAddress}</div>}
                      </td>
                      <td>
                        <div style={{ maxWidth: '200px' }}>{r.motif}</div>
                        {r.travaux?.filter(t => t).length > 0 && (
                          <div className="v22-card-meta" style={{ marginTop: '2px' }}>
                            {r.travaux.filter(t => t).slice(0, 2).map((t, i) => <span key={i} style={{ marginRight: '8px' }}>✓ {t}</span>)}
                            {r.travaux.filter(t => t).length > 2 && <span>+{r.travaux.filter(t => t).length - 2}</span>}
                          </div>
                        )}
                        {(r.linkedPhotoIds?.length || 0) > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <span className="v22-tag v22-tag-gray">📸 {r.linkedPhotoIds!.length} photo{r.linkedPhotoIds!.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        {r.startTime && <div className="v22-card-meta">{r.startTime}{r.endTime ? ` → ${r.endTime}` : ''}{duration ? ` (${duration})` : ''}</div>}
                      </td>
                      <td><span className={st.tagClass}>{st.label}</span></td>
                      <td>
                        <span className={r.sentStatus === 'envoye' ? 'v22-tag v22-tag-green' : 'v22-tag v22-tag-gray'}>
                          {r.sentStatus === 'envoye' ? 'Envoye' : 'Non envoye'}
                        </span>
                        {r.sentAt && (
                          <div className="v22-card-meta" style={{ marginTop: '2px' }}>
                            {new Date(r.sentAt).toLocaleDateString(dateFmtLocale, { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => generatePDF(r)}
                            disabled={pdfLoading === r.id}
                            className="v22-btn v22-btn-sm"
                          >
                            {pdfLoading === r.id ? '⏳' : 'PDF'}
                          </button>
                          <button onClick={() => openEdit(r)} className="v22-btn v22-btn-sm">✏️</button>
                          <button onClick={() => deleteRapport(r.id)} className="v22-btn v22-btn-sm" style={{ color: 'var(--v22-red)' }}>🗑️</button>
                          {r.sentStatus !== 'envoye' && (
                            <button onClick={() => {
                              const now = new Date().toISOString()
                              saveRapports(rapports.map(x => x.id === r.id ? { ...x, sentStatus: 'envoye' as const, sentAt: now } : x))
                            }}
                              className="v22-btn v22-btn-sm">
                              Marquer envoye
                            </button>
                          )}
                          {r.clientEmail && (
                            <button onClick={() => {
                              const subject = encodeURIComponent(`Rapport ${r.rapportNumber} — ${r.artisanName || 'Fixit'}`)
                              const body = encodeURIComponent(`Bonjour ${r.clientName || ''},\n\nVeuillez trouver ci-joint le rapport d'intervention ${r.rapportNumber} du ${r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : ''}.\n\nCordialement,\n${r.artisanName || ''}${r.artisanPhone ? '\n' + r.artisanPhone : ''}`)
                              window.open(`mailto:${r.clientEmail}?subject=${subject}&body=${body}`)
                              const now = new Date().toISOString()
                              saveRapports(rapports.map(x => x.id === r.id ? { ...x, sentStatus: 'envoye' as const, sentAt: now } : x))
                            }}
                              className="v22-btn v22-btn-sm">
                              Email
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Hidden PDF Template ── */}
      {previewRapport && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', background: '#fff' }}>
          <div ref={pdfRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#1a1a1a', padding: '48px 48px 40px 48px', background: '#fff', width: '794px', boxSizing: 'border-box', lineHeight: '1.5' }}>
            {/* En-tete bandeau */}
            <div style={{ backgroundColor: '#1E293B', margin: '-48px -48px 0 -48px', padding: '30px 48px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.3px' }}>RAPPORT D&apos;INTERVENTION</div>
                <div style={{ fontSize: '13px', color: '#FFC107', fontWeight: '700', marginTop: '6px', letterSpacing: '1px' }}>{previewRapport.rapportNumber}</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                  Etabli le {new Date().toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              {previewRapport.refDevisFact && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '8px' }}>Ref : {previewRapport.refDevisFact}</div>
                </div>
              )}
              {(previewRapport.linkedDevisId || previewRapport.linkedDevisRef) && (() => {
                let label = previewRapport.linkedDevisRef || ''
                if (previewRapport.linkedDevisId && artisan?.id) {
                  try {
                    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
                    const doc = docs.find((d: { id: string }) => d.id === previewRapport.linkedDevisId)
                    if (doc) label = `Devis ${doc.service || doc.clientName || doc.id}`
                  } catch { /* ignore */ }
                }
                return (
                  <div
                    style={{ fontSize: '10px', color: '#FFC107', marginTop: '6px', cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
                    onClick={() => onNavigate?.('devis')}
                  >
                    📋 Lié au devis: {label}
                  </div>
                )
              })()}
              {(previewRapport.linkedFactureId || previewRapport.linkedFactureRef) && (() => {
                let label = previewRapport.linkedFactureRef || ''
                if (previewRapport.linkedFactureId && artisan?.id) {
                  try {
                    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan.id}`) || '[]')
                    const doc = docs.find((d: { id: string }) => d.id === previewRapport.linkedFactureId)
                    if (doc) label = `Facture ${doc.service || doc.clientName || doc.id}`
                  } catch { /* ignore */ }
                }
                return (
                  <div
                    style={{ fontSize: '10px', color: '#FFC107', marginTop: '6px', cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none' }}
                    onClick={() => onNavigate?.('devis')}
                  >
                    🧾 Lié à la facture: {label}
                  </div>
                )
              })()}
            </div>
            {/* Bande jaune decorative */}
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #FFC107 0%, #FFD54F 50%, #FFC107 100%)', margin: '0 -48px 28px -48px' }}></div>

            {/* Artisan + Client */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>Prestataire</div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B', marginBottom: '4px' }}>{previewRapport.artisanName}</div>
                {previewRapport.artisanAddress && <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>{previewRapport.artisanAddress}</div>}
                {previewRapport.artisanPhone && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.artisanPhone}</div>}
                {previewRapport.artisanEmail && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.artisanEmail}</div>}
                {previewRapport.artisanSiret && <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '6px' }}>SIRET : {previewRapport.artisanSiret}</div>}
                {previewRapport.artisanInsurance && <div style={{ fontSize: '9px', color: '#94A3B8' }}>{previewRapport.artisanInsurance}</div>}
              </div>
              <div style={{ background: '#F8FAFC', borderLeft: '4px solid #FFC107', borderRadius: '0 10px 10px 0', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>Client</div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B', marginBottom: '4px' }}>{previewRapport.clientName}</div>
                {previewRapport.clientAddress && <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>{previewRapport.clientAddress}</div>}
                {previewRapport.clientPhone && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.clientPhone}</div>}
                {previewRapport.clientEmail && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.clientEmail}</div>}
              </div>
            </div>

            {/* Details intervention */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>Details de l&apos;intervention</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Date</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.interventionDate ? new Date(previewRapport.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Heure debut</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.startTime || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Heure fin</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.endTime || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Duree</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                    {previewRapport.startTime && previewRapport.endTime ? (() => {
                      const [sh, sm] = previewRapport.startTime.split(':').map(Number)
                      const [eh, em] = previewRapport.endTime.split(':').map(Number)
                      const mins = (eh * 60 + em) - (sh * 60 + sm)
                      return mins > 0 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, '0') : '00'}` : '—'
                    })() : '—'}
                  </div>
                </div>
              </div>
              {previewRapport.siteAddress && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '9px', color: '#6b7280' }}>Adresse chantier : </span>
                  <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.siteAddress}</span>
                </div>
              )}
            </div>

            {/* Motif */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Motif d&apos;intervention
              </div>
              <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC', fontSize: '11px', minHeight: '30px', color: '#1E293B' }}>
                {previewRapport.motif}
              </div>
            </div>

            {/* Travaux */}
            {previewRapport.travaux?.filter(t => t).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Travaux realises
                </div>
                <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC' }}>
                  {previewRapport.travaux.filter(t => t).map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '5px', fontSize: '11px', color: '#1E293B' }}>
                      <span style={{ color: '#059669', fontWeight: 'bold' }}>✓</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Materiaux */}
            {previewRapport.materiaux?.filter(m => m).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Materiaux utilises
                </div>
                <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC' }}>
                  {previewRapport.materiaux.filter(m => m).map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '5px', fontSize: '11px', color: '#1E293B' }}>
                      <span style={{ color: '#64748B' }}>•</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observations + Recommandations */}
            {(previewRapport.observations || previewRapport.recommendations) && (
              <div style={{ display: 'grid', gridTemplateColumns: previewRapport.recommendations ? '1fr 1fr' : '1fr', gap: '14px', marginBottom: '16px' }}>
                {previewRapport.observations && (
                  <div>
                    <div style={{ background: '#475569', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Observations</div>
                    <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC', fontSize: '11px', minHeight: '40px', color: '#1E293B', lineHeight: '1.6' }}>{previewRapport.observations}</div>
                  </div>
                )}
                {previewRapport.recommendations && (
                  <div>
                    <div style={{ background: '#2563EB', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Recommandations</div>
                    <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#EFF6FF', fontSize: '11px', minHeight: '40px', color: '#1E293B', lineHeight: '1.6' }}>{previewRapport.recommendations}</div>
                  </div>
                )}
              </div>
            )}

            {/* Photos chantier */}
            {(previewRapport.linkedPhotoIds?.length || 0) > 0 && (() => {
              const photos = availablePhotos.filter(p => previewRapport.linkedPhotoIds?.includes(p.id))
              return photos.length > 0 ? (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Photos chantier ({photos.length})
                  </div>
                  <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: '#F8FAFC', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {photos.map(photo => (
                      <div key={photo.id} style={{ width: '140px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- Used for html2canvas PDF capture, requires native img */}
                        <img src={photo.url} alt="Photo chantier" style={{ width: '140px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }} crossOrigin="anonymous" />
                        <div style={{ fontSize: '8px', color: '#6b7280', marginTop: '3px' }}>
                          {new Date(photo.taken_at).toLocaleDateString(dateFmtLocale)} {new Date(photo.taken_at).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}
                          {photo.lat && photo.lng ? ` · GPS ${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            })()}

            {/* Footer */}
            <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '2px solid #E2E8F0', textAlign: 'center', fontSize: '8px', color: '#94A3B8' }}>
              {previewRapport.artisanName} — {previewRapport.artisanSiret ? `SIRET ${previewRapport.artisanSiret}` : ''} — Document genere par Vitfix Pro — {new Date().toLocaleDateString(dateFmtLocale)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
