'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import { normalizeForSearch, fuzzyFind } from '@/lib/fuzzy-match'
import { generateRapportPDF } from '@/lib/rapport-pdf'
import RapportPDFPreview from '@/components/dashboard/rapports/RapportPDFPreview'
import RapportTableRow from '@/components/dashboard/rapports/RapportTableRow'
import { useThemeVars } from './useThemeVars'
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

export default function RapportsSection({ artisan, bookings, services, onNavigate, orgRole }: { artisan: Artisan | null; bookings: Booking[]; services: Service[]; onNavigate?: (page: string) => void; orgRole?: string }) {
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
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
  const [linkingBooking, setLinkingBooking] = useState(false)

  // Photos chantier pour liaison
  const [availablePhotos, setAvailablePhotos] = useState<PhotoRecord[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [linkedPhotos, setLinkedPhotos] = useState<string[]>([])
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)

  // ── Import depuis base client ──
  const [showClientImport, setShowClientImport] = useState(false)

  // ── Auto-complétion client + motif ──
  const [clientSuggestions, setClientSuggestions] = useState<{ name: string; phone?: string; email?: string; address?: string }[]>([])
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [motifSuggestions, setMotifSuggestions] = useState<{ name: string; id?: string | undefined }[]>([])
  const [showMotifSuggestions, setShowMotifSuggestions] = useState(false)

  // Extraire les clients uniques des bookings + base clients manuelle
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
    // Ajouter les clients manuels (localStorage)
    if (typeof window !== 'undefined' && artisan?.id) {
      try {
        const manual = JSON.parse(localStorage.getItem(`fixit_manual_clients_${artisan.id}`) || '[]')
        for (const c of manual) {
          const name = c.name || ''
          if (name && !map.has(normalizeForSearch(name))) {
            map.set(normalizeForSearch(name), {
              name,
              phone: c.phone || '',
              email: c.email || '',
              address: c.mainAddress || c.address || '',
            })
          }
        }
      } catch { /* ignore */ }
    }
    return Array.from(map.values())
  }, [bookings, artisan?.id])

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

    setLinkingBooking(true)
    try {
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
    } finally {
      setLinkingBooking(false)
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

  // ═══ PDF generation — delegated to lib/rapport-pdf.ts ═══
  const handleGeneratePDF = async (r: RapportIntervention) => {
    setPdfLoading(r.id)
    try {
      if (r.linkedPhotoIds?.length && availablePhotos.length === 0) {
        await loadAvailablePhotos()
      }
      await generateRapportPDF(r, availablePhotos, dateFmtLocale)
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPreviewRapport(null)
      setPdfLoading(null)
    }
  }

  const markRapportSent = (id: string) => {
    const now = new Date().toISOString()
    saveRapports(rapports.map(x => x.id === id ? { ...x, sentStatus: 'envoye' as const, sentAt: now } : x))
  }

  const fv = (v: string | undefined) => v || ''

  return (
    <div className={isV5 ? 'v5-fade' : ''}>
      {/* ── Header ── */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'} style={{ flexDirection: 'column' }}>
        <div>
          <h1 className={isV5 ? '' : 'v22-page-title'}>Rapports d&apos;Intervention</h1>
          <p className={isV5 ? '' : 'v22-page-sub'}>Compte-rendus BTP, liés à vos interventions</p>
        </div>
        <button onClick={openNew} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}>
          + Nouveau rapport
        </button>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
      <div className={isV5 ? 'v5-modal-ov show' : 'v22-modal-overlay open'}>
        {showForm && (
          <div className={isV5 ? 'v5-modal' : 'v22-modal v22-modal--tall'} style={{ maxWidth: '720px' }}>
            <div className={isV5 ? 'v5-modal-h' : 'v22-modal-head'}>
              <span className={isV5 ? 'v5-modal-t' : 'v22-modal-title'}>
                {editingId ? 'Modifier le rapport' : 'Nouveau rapport d\'intervention'}
              </span>
              <span className="v22-ref">{fv(form.rapportNumber)}</span>
              <button onClick={() => setShowForm(false)} className="v22-modal-close">✕</button>
            </div>

            <div className={isV5 ? '' : 'v22-modal-body'}>
              {/* Liaison intervention / mission */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>Import rapide : pre-remplir depuis</span>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button
                      onClick={() => setImportSource('intervention')}
                      className={importSource === 'intervention' ? (isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary') : (isV5 ? 'v5-btn' : 'v22-btn')}
                      style={{ flex: 1 }}
                    >
                      Intervention client
                    </button>
                    <button
                      onClick={() => setImportSource('mission')}
                      className={importSource === 'mission' ? (isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary') : (isV5 ? 'v5-btn' : 'v22-btn')}
                      style={{ flex: 1 }}
                    >
                      Mission syndic / pro
                    </button>
                  </div>

                  {importSource === 'intervention' ? (
                    <select
                      onChange={e => linkBooking(e.target.value)}
                      defaultValue=""
                      className={isV5 ? 'v5-fi' : 'v22-form-input'}
                      disabled={linkingBooking}
                    >
                      <option value="">{linkingBooking ? 'Chargement des donnees client...' : 'Selectionner une intervention pour pre-remplir...'}</option>
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
                        className={isV5 ? 'v5-fi' : 'v22-form-input'}
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
                        <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginTop: '8px', fontStyle: 'italic' }}>Aucune mission disponible. Les missions apparaissent ici depuis vos Ordres de Mission ou missions gestionnaire.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Ref. devis / facture + statut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Lier a un Devis / Facture</label>
                  <select
                    value={fv(form.refDevisFact)}
                    onChange={e => setForm(p => ({ ...p, refDevisFact: e.target.value }))}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'}
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
                    className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ marginTop: '6px' }} />
                </div>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Statut</label>
                  <select value={fv(form.status)} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'}>
                    <option value="termine">Termine</option>
                    <option value="en_cours">En cours</option>
                    <option value="a_reprendre">A reprendre</option>
                    <option value="sous_garantie">Sous garantie</option>
                  </select>
                </div>
              </div>

              {/* Section Client */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>Client</span>
                  <button
                    onClick={() => setShowClientImport(!showClientImport)}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
                    style={{ fontSize: 11 }}
                  >
                    {showClientImport ? 'Fermer' : '📥 Importer depuis base client'}
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {/* Import depuis base client */}
                  {showClientImport && (
                    <div style={{ marginBottom: 12, padding: '10px 12px', background: isV5 ? '#FFFBEB' : '#F9FAFB', borderRadius: 6, border: `1px solid ${isV5 ? '#FDE68A' : '#E5E7EB'}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Selectionner un client :</div>
                      {knownClients.length === 0 ? (
                        <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>Aucun client dans la base. Ajoutez des clients via la section Base clients ou le Portail client.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                          {knownClients.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                selectClientSuggestion(c)
                                setShowClientImport(false)
                              }}
                              className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
                              style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 11 }}
                            >
                              <div><strong>{c.name}</strong></div>
                              <div style={{ color: '#888', fontSize: 10 }}>
                                {[c.phone, c.email, c.address].filter(Boolean).join(' · ') || 'Pas de coordonnees'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ position: 'relative' }}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Nom / Raison sociale *</label>
                      <input type="text" value={fv(form.clientName)} onChange={e => handleClientNameChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                        placeholder="Jean Dupont" className={isV5 ? 'v5-fi' : 'v22-form-input'} autoComplete="off" />
                      {showClientSuggestions && clientSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 180, overflowY: 'auto' }}>
                          {clientSuggestions.map((c, i) => (
                            <button key={i} onMouseDown={() => selectClientSuggestion(c)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--v22-bg)] transition" style={{ borderBottom: `1px solid ${tv.border}` }}>
                              <div style={{ fontWeight: 600 }}>{c.name}</div>
                              {c.phone && <div style={{ color: tv.textMuted, fontSize: 10 }}>{c.phone}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Telephone</label>
                      <input type="tel" value={fv(form.clientPhone)} onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))}
                        placeholder="06 00 00 00 00" className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Email</label>
                      <input type="email" value={fv(form.clientEmail)} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                        placeholder="client@exemple.fr" className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Adresse client</label>
                      <input type="text" value={fv(form.clientAddress)} onChange={e => setForm(p => ({ ...p, clientAddress: e.target.value }))}
                        placeholder="12 rue de la Paix, 13600..." className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Intervention */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>Details de l&apos;intervention</span>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Date *</label>
                      <input type="date" value={fv(form.interventionDate)} onChange={e => setForm(p => ({ ...p, interventionDate: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Heure debut</label>
                      <input type="time" value={fv(form.startTime)} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Heure fin</label>
                      <input type="time" value={fv(form.endTime)} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                  </div>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ marginBottom: '10px' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Adresse du chantier (si differente du client)</label>
                    <input type="text" value={fv(form.siteAddress)} onChange={e => setForm(p => ({ ...p, siteAddress: e.target.value }))}
                      placeholder="Adresse d'intervention..." className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ position: 'relative' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Motif / Description du probleme *</label>
                    <textarea value={fv(form.motif)} onChange={e => handleMotifChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowMotifSuggestions(false), 200)}
                      rows={2} placeholder="Fuite sous evier cuisine, remplacement robinet defectueux..."
                      className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ resize: 'none' }} />
                    {showMotifSuggestions && motifSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 160, overflowY: 'auto' }}>
                        {motifSuggestions.map((m, i) => (
                          <button key={i} onMouseDown={() => selectMotifSuggestion(m)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--v22-bg)] transition" style={{ borderBottom: `1px solid ${tv.border}` }}>
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Travaux realises */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>Travaux realises</span>
                  <button onClick={() => setForm(p => ({ ...p, travaux: [...(p.travaux || []), ''] }))}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}>
                    + Ajouter
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {(form.travaux || ['']).map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <span className={isV5 ? '' : 'v22-card-meta'}>✓</span>
                      <input type="text" value={t} onChange={e => setForm(p => ({ ...p, travaux: (p.travaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                        placeholder="Depose et remplacement du robinet mitigeur..."
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ flex: 1 }} />
                      {(form.travaux || []).length > 1 && (
                        <button onClick={() => setForm(p => ({ ...p, travaux: (p.travaux || []).filter((_, j) => j !== i) }))}
                          className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ color: tv.red }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Materiaux */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>Materiaux utilises</span>
                  <button onClick={() => setForm(p => ({ ...p, materiaux: [...(p.materiaux || []), ''] }))}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}>
                    + Ajouter
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {(form.materiaux || ['']).map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <span className={isV5 ? '' : 'v22-card-meta'}>—</span>
                      <input type="text" value={m} onChange={e => setForm(p => ({ ...p, materiaux: (p.materiaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                        placeholder="Robinet mitigeur Grohe (1u), Joint 3/4 (2u)..."
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ flex: 1 }} />
                      {(form.materiaux || []).length > 1 && (
                        <button onClick={() => setForm(p => ({ ...p, materiaux: (p.materiaux || []).filter((_, j) => j !== i) }))}
                          className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ color: tv.red }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Observations + Recommandations */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Observations</label>
                  <textarea value={fv(form.observations)} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                    rows={3} placeholder="Constatations sur place, etat du materiel existant..."
                    className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ resize: 'none' }} />
                </div>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Recommandations</label>
                  <textarea value={fv(form.recommendations)} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))}
                    rows={3} placeholder="Travaux complementaires conseilles, delai de revision..."
                    className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ resize: 'none' }} />
                </div>
              </div>

              {/* Photos Chantier liees */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>Photos Chantier</span>
                  <button
                    type="button"
                    onClick={() => { setShowPhotoPicker(!showPhotoPicker); if (!showPhotoPicker && availablePhotos.length === 0) loadAvailablePhotos() }}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
                    disabled={photosLoading}
                  >
                    {photosLoading ? 'Chargement...' : showPhotoPicker ? (locale === 'pt' ? '✕ Fechar' : '✕ Fermer') : (locale === 'pt' ? '+ Adicionar fotos' : '+ Ajouter des photos')}
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {/* Photos deja liees */}
                  {linkedPhotos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      {linkedPhotos.map(photoId => {
                        const photo = availablePhotos.find(p => p.id === photoId)
                        return (
                          <div key={photoId} style={{ position: 'relative' }}>
                            {photo ? (
                              <Image src={photo.url || ''} alt="Photo chantier" width={80} height={80} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: `2px solid ${tv.green}` }} unoptimized />
                            ) : (
                              <div style={{ width: '80px', height: '80px', background: tv.bg, borderRadius: '6px', border: `2px solid ${tv.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: tv.textMuted }}>📸</div>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePhotoLink(photoId)}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', background: tv.red, color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
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
                    <p className={isV5 ? '' : 'v22-card-meta'} style={{ fontStyle: 'italic' }}>Aucune photo liee. Ajoutez des photos chantier pour les inclure dans le rapport.</p>
                  )}

                  {/* Picker — grille de photos disponibles */}
                  {showPhotoPicker && (
                    <div style={{ background: tv.bg, borderRadius: '6px', padding: '10px', marginTop: '8px' }}>
                      {photosLoading ? (
                        <div className={isV5 ? '' : 'v22-card-meta'} style={{ textAlign: 'center', padding: '16px' }}>Chargement des photos...</div>
                      ) : availablePhotos.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📸</div>
                          <p className={isV5 ? '' : 'v22-card-meta'}>Aucune photo chantier disponible</p>
                          <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginTop: '2px' }}>Prenez des photos depuis l&apos;app mobile</p>
                        </div>
                      ) : (
                        <>
                          <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginBottom: '8px' }}>Cliquez pour selectionner / deselectionner :</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', maxHeight: '192px', overflowY: 'auto' }}>
                            {availablePhotos.map(photo => {
                              const isLinked = linkedPhotos.includes(photo.id)
                              return (
                                <button
                                  type="button"
                                  key={photo.id}
                                  onClick={() => togglePhotoLink(photo.id)}
                                  style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: isLinked ? `2px solid ${tv.green}` : `2px solid ${tv.border}`, cursor: 'pointer', padding: 0, background: 'none' }}
                                >
                                  <Image src={photo.url || ''} alt="" width={100} height={64} style={{ width: '100%', height: '64px', objectFit: 'cover', display: 'block' }} unoptimized />
                                  {isLinked && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ background: tv.green, color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                                    </div>
                                  )}
                                  <div style={{ fontSize: '8px', color: tv.textMuted, padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {new Date(photo.taken_at).toLocaleDateString(dateFmtLocale)}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginTop: '8px', textAlign: 'right' }}>{linkedPhotos.length} photo{linkedPhotos.length > 1 ? 's' : ''} selectionnee{linkedPhotos.length > 1 ? 's' : ''}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={isV5 ? '' : 'v22-modal-foot'}>
              <button onClick={() => setShowForm(false)} className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1 }}>
                Annuler
              </button>
              <button onClick={saveForm} disabled={!form.clientName || !form.interventionDate || !form.motif}
                className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ flex: 1, opacity: (!form.clientName || !form.interventionDate || !form.motif) ? 0.5 : 1 }}>
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
          <div className={isV5 ? 'v5-card' : 'v22-stats'}>
            <div className={isV5 ? '' : 'v22-stat'}>
              <div className={isV5 ? '' : 'v22-stat-val'}>{rapports.length}</div>
              <div className={isV5 ? '' : 'v22-stat-label'}>Total rapports</div>
            </div>
            <div className={isV5 ? '' : 'v22-stat'}>
              <div className={isV5 ? '' : 'v22-stat-val'} style={{ color: tv.green }}>{rapports.filter(r => r.sentStatus === 'envoye').length}</div>
              <div className={isV5 ? '' : 'v22-stat-label'}>Envoyes</div>
            </div>
            <div className={isV5 ? '' : 'v22-stat'}>
              <div className={isV5 ? '' : 'v22-stat-val'} style={{ color: tv.primary }}>{rapports.filter(r => r.sentStatus !== 'envoye').length}</div>
              <div className={isV5 ? '' : 'v22-stat-label'}>Non envoyes</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Rapport list ── */}
      <div style={{ padding: '14px' }}>
        {rapports.length === 0 ? (
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ marginBottom: '6px' }}>Aucun rapport</div>
            <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginBottom: '16px' }}>Creez votre premier rapport d&apos;intervention BTP</p>
            <button onClick={openNew} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}>
              Creer un rapport
            </button>
          </div>
        ) : (
          <div className={isV5 ? 'v5-card' : 'v22-card'}>
            <div className={isV5 ? '' : 'v22-card-head'}>
              <span className={isV5 ? 'v5-st' : 'v22-card-title'}>Rapports ({rapports.length})</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Client</th>
                  <th>Motif</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'center' }}>Statut</th>
                  <th style={{ textAlign: 'center' }}>Envoi</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rapports.map(r => (
                  <RapportTableRow
                    key={r.id}
                    rapport={r}
                    artisanId={artisan?.id}
                    dateFmtLocale={dateFmtLocale}
                    onEdit={openEdit}
                    onDelete={deleteRapport}
                    onGeneratePDF={handleGeneratePDF}
                    onMarkSent={markRapportSent}
                    pdfLoading={pdfLoading}
                    onNavigate={onNavigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Hidden PDF Template ── */}
      {previewRapport && (
        <RapportPDFPreview
          ref={pdfRef}
          previewRapport={previewRapport}
          availablePhotos={availablePhotos}
          artisanId={artisan?.id}
          dateFmtLocale={dateFmtLocale}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
