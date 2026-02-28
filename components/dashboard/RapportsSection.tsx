'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/* ══════════ RAPPORTS D'INTERVENTION ══════════ */

interface RapportIntervention {
  id: string
  rapportNumber: string
  createdAt: string
  linkedBookingId: string | null
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
}

const RAPPORT_STATUS_MAP = {
  termine: { label: '✅ Terminé', color: 'bg-green-100 text-green-700' },
  en_cours: { label: '🔄 En cours', color: 'bg-blue-100 text-blue-700' },
  a_reprendre: { label: '⚠️ À reprendre', color: 'bg-amber-100 text-amber-700' },
  sous_garantie: { label: '🛡️ Sous garantie', color: 'bg-purple-100 text-purple-700' },
}

export default function RapportsSection({ artisan, bookings, services }: { artisan: any; bookings: any[]; services: any[] }) {
  const storageKey = `fixit_rapports_${artisan?.id}`
  const pdfRef = useRef<HTMLDivElement>(null)

  const [rapports, setRapports] = useState<RapportIntervention[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(`fixit_rapports_${artisan?.id}`) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [previewRapport, setPreviewRapport] = useState<RapportIntervention | null>(null)
  const [companyData, setCompanyData] = useState<any>(null)

  const [form, setForm] = useState<Partial<RapportIntervention>>({})
  const [importSource, setImportSource] = useState<'intervention' | 'mission'>('intervention')

  // Load missions from localStorage (syndic + gestionnaire)
  const [availableMissions, setAvailableMissions] = useState<any[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const allMissions: any[] = []
      // 1. Missions gestionnaire
      const gestKey = `fixit_missions_gest_${artisan.id}`
      try {
        const gest = JSON.parse(localStorage.getItem(gestKey) || '[]')
        gest.forEach((m: any) => allMissions.push({ ...m, source: 'gestionnaire' }))
      } catch {}
      // 2. Ordres de mission syndic (canal artisan)
      const artisanKey = `canal_artisan_${(artisan.company_name || artisan.nom || artisan.id || 'artisan').replace(/\s+/g, '_').toLowerCase()}`
      try {
        const ordres = JSON.parse(localStorage.getItem(artisanKey) || '[]')
        ordres.forEach((m: any) => allMissions.push({ ...m, source: 'syndic' }))
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
    const a = artisan || {}
    const c = companyData || {}
    setEditingId(null)
    setForm({
      rapportNumber: nextNumber(),
      createdAt: new Date().toISOString(),
      linkedBookingId: null,
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
    })
    setShowForm(true)
  }

  const openEdit = (r: RapportIntervention) => {
    setEditingId(r.id)
    setForm({ ...r })
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
    }
    if (editingId) {
      saveRapports(rapports.map(r => r.id === editingId ? { ...rapport, id: editingId } : r))
    } else {
      saveRapports([{ ...rapport, id: `rap_${Date.now()}` }, ...rapports])
    }
    setShowForm(false)
  }

  const deleteRapport = (id: string) => {
    if (!confirm('Supprimer ce rapport ?')) return
    saveRapports(rapports.filter(r => r.id !== id))
  }

  // PDF generation
  const generatePDF = async (r: RapportIntervention) => {
    setPdfLoading(r.id)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')
      setPreviewRapport(r)
      await new Promise(res => setTimeout(res, 200))
      if (!pdfRef.current) return
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW - 20
      const imgH = (canvas.height * imgW) / canvas.width
      let y = 10
      if (imgH <= pageH - 20) {
        pdf.addImage(imgData, 'JPEG', 10, y, imgW, imgH)
      } else {
        let remaining = imgH
        let srcY = 0
        while (remaining > 0) {
          const sliceH = Math.min(pageH - 20, remaining)
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = canvas.width
          sliceCanvas.height = (sliceH / imgH) * canvas.height
          const ctx = sliceCanvas.getContext('2d')!
          ctx.drawImage(canvas, 0, srcY * canvas.height / imgH, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height)
          pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, 10, imgW, sliceH)
          remaining -= sliceH
          srcY += sliceH
          if (remaining > 0) pdf.addPage()
        }
      }
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
    <div className="animate-fadeIn">
      {/* ── Header ── */}
      <div className="bg-white px-6 lg:px-10 py-6 border-b-2 border-[#FFC107] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold">📋 Rapports d'Intervention</h1>
            <p className="text-gray-500 text-sm mt-1">Compte-rendus BTP — liés à vos interventions, devis et factures</p>
          </div>
          <button onClick={openNew} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2">
            ➕ Nouveau rapport
          </button>
        </div>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl my-4">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-bold text-lg text-gray-900">
                {editingId ? '✏️ Modifier le rapport' : '📋 Nouveau rapport d\'intervention'}
              </h3>
              <span className="text-sm font-mono text-gray-500">{fv(form.rapportNumber)}</span>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Liaison intervention / mission */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">⚡ Import rapide — pré-remplir depuis :</label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setImportSource('intervention')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition ${importSource === 'intervention' ? 'bg-[#FFC107] text-gray-900 shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
                  >
                    🔧 Intervention client
                  </button>
                  <button
                    onClick={() => setImportSource('mission')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition ${importSource === 'mission' ? 'bg-[#FFC107] text-gray-900 shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
                  >
                    📋 Mission syndic / pro
                  </button>
                </div>

                {importSource === 'intervention' ? (
                  <select
                    onChange={e => linkBooking(e.target.value)}
                    defaultValue=""
                    className="w-full border-2 border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] bg-white"
                  >
                    <option value="">Sélectionner une intervention pour pré-remplir...</option>
                    {[...bookings].filter(b => b.status === 'confirmed' || b.status === 'completed').slice(0, 20).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.booking_date} {b.booking_time?.substring(0, 5)} — {b.services?.name || 'Intervention'} — {b.address || 'Adresse non définie'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <select
                      onChange={e => linkMission(e.target.value)}
                      defaultValue=""
                      className="w-full border-2 border-amber-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] bg-white"
                    >
                      <option value="">Sélectionner une mission pour pré-remplir...</option>
                      {availableMissions.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.source === 'syndic' ? '🏛️' : '🏢'} {m.titre || m.type || 'Mission'} — {m.immeuble || m.locataire || 'N/D'} — {m.dateIntervention || m.date || 'Date N/D'}
                          {m.priorite === 'urgente' ? ' ⚠️ URGENT' : ''}
                        </option>
                      ))}
                    </select>
                    {availableMissions.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2 italic">Aucune mission disponible. Les missions apparaissent ici depuis vos Ordres de Mission ou missions gestionnaire.</p>
                    )}
                  </>
                )}
              </div>

              {/* Réf. devis / facture + statut */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">📎 Lier à un Devis / Facture</label>
                  <select
                    value={fv(form.refDevisFact)}
                    onChange={e => setForm(p => ({ ...p, refDevisFact: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] bg-white"
                  >
                    <option value="">Aucun document lié</option>
                    {(() => {
                      try {
                        const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisan?.id}`) || '[]')
                        const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisan?.id}`) || '[]')
                        return [...docs, ...drafts]
                          .filter((d: any) => d.docNumber)
                          .sort((a: any, b: any) => (b.savedAt || '').localeCompare(a.savedAt || ''))
                          .map((d: any) => (
                            <option key={d.docNumber} value={d.docNumber}>
                              {d.docNumber} — {d.clientName || 'Client'} — {d.docType === 'devis' ? '📄 Devis' : '🧾 Facture'}
                            </option>
                          ))
                      } catch { return null }
                    })()}
                  </select>
                  <input type="text" value={fv(form.refDevisFact)} onChange={e => setForm(p => ({ ...p, refDevisFact: e.target.value }))}
                    placeholder="Ou saisir manuellement : DEV-2026-001"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mt-2 focus:outline-none focus:border-[#FFC107] text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Statut</label>
                  <select value={fv(form.status)} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] bg-white">
                    <option value="termine">✅ Terminé</option>
                    <option value="en_cours">🔄 En cours</option>
                    <option value="a_reprendre">⚠️ À reprendre</option>
                    <option value="sous_garantie">🛡️ Sous garantie</option>
                  </select>
                </div>
              </div>

              {/* Section Client */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">👤 Client</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nom / Raison sociale *</label>
                    <input type="text" value={fv(form.clientName)} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                      placeholder="Jean Dupont" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Téléphone</label>
                    <input type="tel" value={fv(form.clientPhone)} onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))}
                      placeholder="06 00 00 00 00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Email</label>
                    <input type="email" value={fv(form.clientEmail)} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                      placeholder="client@exemple.fr" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Adresse client</label>
                    <input type="text" value={fv(form.clientAddress)} onChange={e => setForm(p => ({ ...p, clientAddress: e.target.value }))}
                      placeholder="12 rue de la Paix, 13600..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                </div>
              </div>

              {/* Section Intervention */}
              <div className="border border-gray-200 rounded-xl p-4">
                <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">🗓 Détails de l'intervention</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date *</label>
                    <input type="date" value={fv(form.interventionDate)} onChange={e => setForm(p => ({ ...p, interventionDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Heure début</label>
                    <input type="time" value={fv(form.startTime)} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Heure fin</label>
                    <input type="time" value={fv(form.endTime)} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs text-gray-500 mb-1 block">Adresse du chantier (si différente du client)</label>
                  <input type="text" value={fv(form.siteAddress)} onChange={e => setForm(p => ({ ...p, siteAddress: e.target.value }))}
                    placeholder="Adresse d'intervention..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Motif / Description du problème *</label>
                  <textarea value={fv(form.motif)} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))}
                    rows={2} placeholder="Fuite sous évier cuisine, remplacement robinet défectueux..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107] resize-none" />
                </div>
              </div>

              {/* Travaux réalisés */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">🔧 Travaux réalisés</h4>
                  <button onClick={() => setForm(p => ({ ...p, travaux: [...(p.travaux || []), ''] }))}
                    className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-100 transition">
                    + Ajouter
                  </button>
                </div>
                {(form.travaux || ['']).map((t, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <span className="text-gray-500 mt-2 text-sm">✓</span>
                    <input type="text" value={t} onChange={e => setForm(p => ({ ...p, travaux: (p.travaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                      placeholder="Dépose et remplacement du robinet mitigeur..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                    {(form.travaux || []).length > 1 && (
                      <button onClick={() => setForm(p => ({ ...p, travaux: (p.travaux || []).filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-600 px-2">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Matériaux */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">🧱 Matériaux utilisés</h4>
                  <button onClick={() => setForm(p => ({ ...p, materiaux: [...(p.materiaux || []), ''] }))}
                    className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-100 transition">
                    + Ajouter
                  </button>
                </div>
                {(form.materiaux || ['']).map((m, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <span className="text-gray-500 mt-2 text-sm">—</span>
                    <input type="text" value={m} onChange={e => setForm(p => ({ ...p, materiaux: (p.materiaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                      placeholder="Robinet mitigeur Grohe (1u), Joint 3/4 (2u)..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107]" />
                    {(form.materiaux || []).length > 1 && (
                      <button onClick={() => setForm(p => ({ ...p, materiaux: (p.materiaux || []).filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-600 px-2">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Observations + Recommandations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">📝 Observations</label>
                  <textarea value={fv(form.observations)} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                    rows={3} placeholder="Constatations sur place, état du matériel existant..."
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">💡 Recommandations</label>
                  <textarea value={fv(form.recommendations)} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))}
                    rows={3} placeholder="Travaux complémentaires conseillés, délai de révision..."
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFC107] resize-none" />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowForm(false)} className="flex-1 border-2 border-gray-200 text-gray-600 rounded-xl py-3 font-semibold text-sm hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={saveForm} disabled={!form.clientName || !form.interventionDate || !form.motif}
                className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 rounded-xl py-3 font-bold text-sm transition disabled:opacity-50">
                {editingId ? '💾 Mettre à jour' : '✅ Créer le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rapport list ── */}
      <div className="p-6 lg:p-8">
        {rapports.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Aucun rapport</h3>
            <p className="text-gray-500 text-sm mb-6">Créez votre premier rapport d'intervention BTP</p>
            <button onClick={openNew} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-6 py-3 rounded-xl font-bold transition">
              📋 Créer un rapport
            </button>
          </div>
        ) : (
          <div className="space-y-3">
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
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-shrink-0">
                          <div className="text-xs font-bold text-amber-700 font-mono">{r.rapportNumber}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-gray-900">{r.clientName || 'Client non défini'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                            {r.refDevisFact && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">📎 {r.refDevisFact}</span>}
                          </div>
                          <div className="text-sm text-gray-600 font-medium">{r.motif}</div>
                          <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-gray-500">
                            <span>📅 {r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                            {r.startTime && <span>🕐 {r.startTime}{r.endTime ? ` → ${r.endTime}` : ''}{duration ? ` (${duration})` : ''}</span>}
                            {r.siteAddress && <span>📍 {r.siteAddress}</span>}
                          </div>
                          {r.travaux?.filter(t => t).length > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              {r.travaux.filter(t => t).slice(0, 2).map((t, i) => <span key={i} className="mr-3">✓ {t}</span>)}
                              {r.travaux.filter(t => t).length > 2 && <span className="text-gray-500">+{r.travaux.filter(t => t).length - 2} autres</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => generatePDF(r)}
                          disabled={pdfLoading === r.id}
                          className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-3 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1"
                        >
                          {pdfLoading === r.id ? '⏳' : '📥 PDF'}
                        </button>
                        <button onClick={() => openEdit(r)} className="bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-xl text-sm font-semibold transition">✏️</button>
                        <button onClick={() => deleteRapport(r.id)} className="bg-red-50 border border-red-200 text-red-400 hover:bg-red-100 px-3 py-2 rounded-xl text-sm transition">🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Hidden PDF Template ── */}
      {previewRapport && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', background: '#fff' }}>
          <div ref={pdfRef} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '11px', color: '#1a1a1a', padding: '48px 48px 40px 48px', background: '#fff', width: '794px', boxSizing: 'border-box', lineHeight: '1.5' }}>
            {/* En-tête bandeau */}
            <div style={{ backgroundColor: '#1E293B', margin: '-48px -48px 0 -48px', padding: '30px 48px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.3px' }}>RAPPORT D&apos;INTERVENTION</div>
                <div style={{ fontSize: '13px', color: '#FFC107', fontWeight: '700', marginTop: '6px', letterSpacing: '1px' }}>{previewRapport.rapportNumber}</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                  Établi le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ padding: '8px 16px', background: previewRapport.status === 'termine' ? '#059669' : previewRapport.status === 'en_cours' ? '#2563EB' : previewRapport.status === 'a_reprendre' ? '#D97706' : '#7C3AED', borderRadius: '20px', display: 'inline-block' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#ffffff' }}>
                    {RAPPORT_STATUS_MAP[previewRapport.status]?.label || 'Terminé'}
                  </span>
                </div>
                {previewRapport.refDevisFact && (
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '8px' }}>Réf : {previewRapport.refDevisFact}</div>
                )}
              </div>
            </div>
            {/* Bande jaune décorative */}
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
                {previewRapport.artisanInsurance && <div style={{ fontSize: '9px', color: '#94A3B8' }}>🛡️ {previewRapport.artisanInsurance}</div>}
              </div>
              <div style={{ background: '#F8FAFC', borderLeft: '4px solid #FFC107', borderRadius: '0 10px 10px 0', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#B45309', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>Client</div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B', marginBottom: '4px' }}>{previewRapport.clientName}</div>
                {previewRapport.clientAddress && <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>{previewRapport.clientAddress}</div>}
                {previewRapport.clientPhone && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.clientPhone}</div>}
                {previewRapport.clientEmail && <div style={{ fontSize: '10px', color: '#475569' }}>{previewRapport.clientEmail}</div>}
              </div>
            </div>

            {/* Détails intervention */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>Détails de l&apos;intervention</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Date</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.interventionDate ? new Date(previewRapport.interventionDate + 'T12:00:00').toLocaleDateString('fr-FR') : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Heure début</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.startTime || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Heure fin</div>
                  <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{previewRapport.endTime || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Durée</div>
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
                  Travaux réalisés
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

            {/* Matériaux */}
            {previewRapport.materiaux?.filter(m => m).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ background: '#1E293B', color: 'white', padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Matériaux utilisés
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

            {/* Signatures */}
            <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderTop: '2px solid #E2E8F0', paddingTop: '20px' }}>
              <div style={{ padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', background: '#F8FAFC' }}>
                <div style={{ fontSize: '9px', color: '#64748B', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Signature prestataire</div>
                <div style={{ fontWeight: '700', fontSize: '12px', color: '#1E293B', marginBottom: '30px' }}>{previewRapport.artisanName}</div>
                <div style={{ borderTop: '1px dotted #CBD5E1', width: '180px', paddingTop: '4px', fontSize: '9px', color: '#94A3B8' }}>Signature</div>
              </div>
              <div style={{ padding: '14px', border: '1px solid #E2E8F0', borderRadius: '10px', background: '#F8FAFC' }}>
                <div style={{ fontSize: '9px', color: '#64748B', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Signature client <span style={{ fontStyle: 'italic', fontWeight: '400' }}>&quot;Bon pour accord&quot;</span></div>
                <div style={{ fontWeight: '700', fontSize: '12px', color: '#1E293B', marginBottom: '30px' }}>{previewRapport.clientName}</div>
                <div style={{ borderTop: '1px dotted #CBD5E1', width: '180px', paddingTop: '4px', fontSize: '9px', color: '#94A3B8' }}>Signature</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '2px solid #E2E8F0', textAlign: 'center', fontSize: '8px', color: '#94A3B8' }}>
              {previewRapport.artisanName} — {previewRapport.artisanSiret ? `SIRET ${previewRapport.artisanSiret}` : ''} — Document généré par Vitfix Pro — {new Date().toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
