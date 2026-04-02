'use client'

import { useState, useEffect, RefObject } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

// ─── Compliance Wallet Types ──────────────────────────────────────────────────
const COMPLIANCE_TYPES = [
  { key: 'decennale',      label: 'RC Décennale',         labelKey: 'proDash.wallet.assuranceDecennale', icon: '🛡️', renewYears: 1 },
  { key: 'kbis',           label: 'Extrait KBIS',         labelKey: 'proDash.wallet.kbis',              icon: '📋', renewYears: 0 },
  { key: 'urssaf',         label: 'Attestation URSSAF',   labelKey: 'proDash.wallet.urssaf',            icon: '🏛️', renewYears: 0 },
  { key: 'rge',            label: 'Certificat RGE',       labelKey: 'proDash.wallet.rge',               icon: '♻️', renewYears: 4 },
  { key: 'carte_pro',      label: 'Carte Pro BTP',        labelKey: 'proDash.wallet.carteProBtp',       icon: '🪪', renewYears: 5 },
  { key: 'passeport_prev', label: 'Passeport Prévention', labelKey: 'proDash.wallet.passeportPrevention', icon: '🎓', renewYears: 0 },
  { key: 'assurance_pro',  label: 'Assurance Pro (RC)',   labelKey: 'proDash.wallet.rcPro',             icon: '🔒', renewYears: 1 },
  { key: 'autre',          label: 'Autre document',       labelKey: 'mob.compliance.other',             icon: '📄', renewYears: 0 },
] as const
type ComplianceType = typeof COMPLIANCE_TYPES[number]['key']

interface ComplianceDoc {
  id: string
  type: ComplianceType
  dateExpiration: string | null
  notes: string
  addedAt: string
  ocrData?: {
    rawText?: string
    assureur?: string
    numPolice?: string
    montantGarantie?: string
    activiteCouverte?: string
    detectedType?: ComplianceType
    confidence?: number
    scannedAt?: string
  }
  photoDataUrl?: string
  verificationStatus?: 'pending' | 'verified' | 'rejected'
  passeportPrevention?: string
}

function getComplianceStatus(doc: ComplianceDoc): 'valid' | 'expiring' | 'expired' | 'nodoc' {
  if (!doc.dateExpiration) return 'nodoc'
  const days = Math.ceil((new Date(doc.dateExpiration).getTime() - Date.now()) / 86400000)
  if (days < 0)   return 'expired'
  if (days <= 30) return 'expiring'
  return 'valid'
}

// ─── Proof types (mirrored from parent) ───────────────────────────────────────
interface ProofPhoto {
  dataUrl: string
  timestamp: string
  lat?: number
  lng?: number
  label: string
}

interface InterventionProof {
  bookingId: string
  step: 'before' | 'during' | 'after' | 'signature'
  beforePhotos: ProofPhoto[]
  duringPhotos: ProofPhoto[]
  afterPhotos: ProofPhoto[]
  description: string
  signature?: string
  startedAt?: string
  completedAt?: string
  gpsLat?: number
  gpsLng?: number
}

// ─── RapportIABandeau (inline component) ──────────────────────────────────────
function RapportIABandeau({ bookingId }: { bookingId: string }) {
  const [contenu, setContenu] = useState<{ introduction?: string; travaux_realises?: string; observations?: string; conclusion?: string; source?: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ introduction: '', travaux_realises: '', observations: '', conclusion: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    supabase.from('bookings').select('rapport_ia_texte_brut, rapport_ia_source').eq('id', bookingId).maybeSingle()
      .then(({ data }) => {
        if (data?.rapport_ia_texte_brut) {
          try {
            const parsed = JSON.parse(data.rapport_ia_texte_brut)
            setContenu(parsed)
            setEditData({
              introduction: parsed.introduction || '',
              travaux_realises: parsed.travaux_realises || '',
              observations: parsed.observations || '',
              conclusion: parsed.conclusion || '',
            })
          } catch { /* invalid JSON */ }
        }
      })
  }, [bookingId])

  if (!contenu?.introduction) return null

  const handleSave = async () => {
    setSaving(true)
    const updated = { ...contenu, ...editData }
    await supabase.from('bookings').update({
      rapport_ia_texte_brut: JSON.stringify(updated),
      rapport_ia_source: 'manuel',
    }).eq('id', bookingId)
    setContenu(updated)
    setEditing(false)
    setSaving(false)
  }

  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-emerald-700">
          ✨ Texte rédigé automatiquement
        </span>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs font-semibold text-emerald-600 underline"
        >
          {editing ? 'Fermer' : 'Modifier'}
        </button>
      </div>
      <p className="text-[11px] text-emerald-600 mb-1">
        Généré depuis les données du chantier. Modifiable avant envoi.
      </p>
      {editing && (
        <div className="space-y-2 mt-2">
          {(['introduction', 'travaux_realises', 'observations', 'conclusion'] as const).map(field => (
            <div key={field}>
              <label className="text-[10px] font-bold text-gray-500 uppercase">{
                field === 'travaux_realises' ? 'Travaux réalisés' :
                field.charAt(0).toUpperCase() + field.slice(1)
              }</label>
              <textarea
                value={editData[field]}
                onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                rows={2}
                className="w-full text-xs border border-gray-200 rounded-lg p-2 mt-0.5 resize-none focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300"
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl active:scale-95 transition"
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            {saving ? '⏳ Enregistrement...' : '💾 Sauvegarder les modifications'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface MobileDocumentsSectionProps {
  artisan: any
  bookings: any[]
  services: any[]
  serviceRanges: Record<string, { priceMin: number; priceMax: number; durationEstimate?: string; pricingUnit?: string }>
  completedBookings: any[]
  complianceDocs: ComplianceDoc[]
  locale: string
  dateFmtLocale: string
  t: (key: string, fallback?: string) => string
  isModuleEnabled: (key: string) => boolean
  setMotifModal: (v: boolean) => void
  setShowDevisModal: (v: boolean) => void
  setShowComplianceModal: (v: boolean) => void
  deleteComplianceDoc: (id: string) => void
  copyComplianceProfile: () => void
  complianceCopied: boolean
  // Additional state setters used in the documents section
  setDevisForm: (v: { client: string; service: string; description: string; montantHT: string; tva: string; validite: string }) => void
  setDevisGenere: (v: null) => void
  setOcrResult: (v: null) => void
  setComplianceForm: (fn: (f: any) => any) => void
  ocrInputRef: RefObject<HTMLInputElement | null>
  expiringCount: number
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MobileDocumentsSection({
  artisan,
  bookings,
  services,
  serviceRanges,
  completedBookings,
  complianceDocs,
  locale,
  dateFmtLocale,
  t,
  isModuleEnabled,
  setMotifModal,
  setShowDevisModal,
  setShowComplianceModal,
  deleteComplianceDoc,
  copyComplianceProfile,
  complianceCopied,
  setDevisForm,
  setDevisGenere,
  setOcrResult,
  setComplianceForm,
  ocrInputRef,
  expiringCount,
}: MobileDocumentsSectionProps) {
  return (
    <div>
      <div className="bg-white px-4 pt-12 pb-4 safe-area-pt border-b border-gray-100">
        <div className="text-lg font-bold text-gray-900">📄 {t('mob.docsAndProofs')}</div>
      </div>

      <div className="p-4 space-y-4">
        {/* Proof of work section */}
        <div>
          <div className="text-sm font-bold text-gray-700 mb-3">📸 {t('mob.interventionProofs')}</div>
          {(() => {
            const proofs = JSON.parse(localStorage.getItem('fixit_proofs') || '[]') as InterventionProof[]
            if (proofs.length === 0) {
              return (
                <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
                  <div className="text-4xl mb-2">📸</div>
                  <div className="text-sm text-gray-500">{t('mob.noArchivedProof')}</div>
                  <div className="text-xs text-gray-300 mt-1">{t('mob.proofsAppearAfter')}</div>
                </div>
              )
            }
            return proofs.reverse().map((p, i) => {
              const booking = bookings.find(b => b.id === p.bookingId)
              return (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-lg">✅</div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{booking?.services?.name || 'Intervention'}</div>
                      <div className="text-xs text-gray-500">{p.completedAt ? new Date(p.completedAt).toLocaleDateString(dateFmtLocale) : ''}</div>
                    </div>
                    <div className="ml-auto">
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Archivé</span>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs text-gray-500 flex-wrap">
                    <span>📸 {p.beforePhotos.length} avant</span>
                    <span>📸 {p.afterPhotos.length} après</span>
                    {p.gpsLat && <span>📍 GPS</span>}
                    {p.signature && <span>✍️ Signé</span>}
                  </div>
                  {p.beforePhotos.length > 0 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto">
                      {[...p.beforePhotos, ...p.afterPhotos].slice(0, 4).map((ph, j) => (
                        <Image key={j} src={ph.dataUrl} alt="" width={56} height={56} className="w-14 h-14 object-cover rounded-xl flex-shrink-0" unoptimized />
                      ))}
                    </div>
                  )}
                  {/* Indicateur IA + Rapport fin de chantier PDF */}
                  {isModuleEnabled('rapport_pdf') && <RapportIABandeau bookingId={p.bookingId} />}
                  {isModuleEnabled('rapport_pdf') && (
                  <button
                    onClick={async () => {
                      // Charger le texte IA depuis la DB si disponible
                      const bk = bookings.find(b => b.id === p.bookingId)
                      let contenuIA: { introduction?: string; travaux_realises?: string; observations?: string; conclusion?: string; source?: string } | null = null
                      if (bk?.id) {
                        try {
                          const { data: bkData } = await supabase.from('bookings').select('rapport_ia_texte_brut, rapport_ia_source').eq('id', bk.id).maybeSingle()
                          if (bkData?.rapport_ia_texte_brut) {
                            contenuIA = JSON.parse(bkData.rapport_ia_texte_brut)
                          }
                        } catch { /* pas de texte IA — on continue avec le texte manuel */ }
                      }

                      import('jspdf').then(({ default: jsPDF }) => {
                        const doc = new jsPDF()
                        const nom = artisan?.company_name || 'Artisan'
                        // Header
                        doc.setFillColor(255, 193, 7)
                        doc.rect(0, 0, 210, 30, 'F')
                        doc.setFontSize(18)
                        doc.setTextColor(33, 33, 33)
                        doc.text('RAPPORT DE FIN DE CHANTIER', 15, 20)
                        // Artisan info
                        doc.setFontSize(10)
                        doc.setTextColor(100, 100, 100)
                        doc.text(`Artisan : ${nom}`, 15, 40)
                        doc.text(`Date : ${p.completedAt ? new Date(p.completedAt).toLocaleDateString(dateFmtLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}`, 15, 47)
                        doc.text(`Service : ${bk?.services?.name || 'Intervention'}`, 15, 54)
                        doc.text(`Adresse : ${bk?.address || 'N/A'}`, 15, 61)
                        if (p.gpsLat && p.gpsLng) doc.text(`GPS : ${p.gpsLat.toFixed(5)}, ${p.gpsLng.toFixed(5)}`, 15, 68)
                        if (bk?.price_ttc) doc.text(`Montant TTC : ${(bk.price_ttc / 100 >= 1 ? bk.price_ttc : bk.price_ttc).toFixed(2)} \u20AC`, 15, 75)

                        let y = 88

                        // Contenu IA structuré (si disponible)
                        if (contenuIA?.introduction) {
                          // Introduction
                          doc.setFontSize(11)
                          doc.setTextColor(33, 33, 33)
                          doc.text('Contexte :', 15, y); y += 6
                          doc.setFontSize(10)
                          doc.setTextColor(60, 60, 60)
                          const introLines = doc.splitTextToSize(contenuIA.introduction, 180)
                          doc.text(introLines, 15, y)
                          y += introLines.length * 5 + 6

                          // Travaux réalisés
                          if (contenuIA.travaux_realises) {
                            doc.setFontSize(11)
                            doc.setTextColor(33, 33, 33)
                            doc.text('Travaux réalisés :', 15, y); y += 6
                            doc.setFontSize(10)
                            doc.setTextColor(60, 60, 60)
                            const trLines = doc.splitTextToSize(contenuIA.travaux_realises, 180)
                            doc.text(trLines, 15, y)
                            y += trLines.length * 5 + 6
                          }

                          // Observations
                          if (contenuIA.observations) {
                            doc.setFontSize(11)
                            doc.setTextColor(33, 33, 33)
                            doc.text('Observations :', 15, y); y += 6
                            doc.setFontSize(10)
                            doc.setTextColor(60, 60, 60)
                            const obsLines = doc.splitTextToSize(contenuIA.observations, 180)
                            doc.text(obsLines, 15, y)
                            y += obsLines.length * 5 + 6
                          }

                          // Conclusion
                          if (contenuIA.conclusion) {
                            doc.setFontSize(11)
                            doc.setTextColor(33, 33, 33)
                            doc.text('Conclusion :', 15, y); y += 6
                            doc.setFontSize(10)
                            doc.setTextColor(60, 60, 60)
                            const concLines = doc.splitTextToSize(contenuIA.conclusion, 180)
                            doc.text(concLines, 15, y)
                            y += concLines.length * 5 + 8
                          }
                        } else if (p.description) {
                          // Fallback : description manuelle (comportement d'avant)
                          doc.setFontSize(12)
                          doc.setTextColor(33, 33, 33)
                          doc.text('Description des travaux :', 15, y)
                          y += 8
                          doc.setFontSize(10)
                          const lines = doc.splitTextToSize(p.description, 180)
                          doc.text(lines, 15, y)
                          y += lines.length * 5 + 8
                        }

                        // Photos résumé
                        doc.setFontSize(12)
                        doc.setTextColor(33, 33, 33)
                        doc.text('Photos jointes :', 15, y)
                        y += 8
                        doc.setFontSize(10)
                        doc.setTextColor(80, 80, 80)
                        doc.text(`\u2022 ${p.beforePhotos.length} photo(s) avant intervention`, 20, y); y += 6
                        if (p.duringPhotos?.length) { doc.text(`\u2022 ${p.duringPhotos.length} photo(s) pendant`, 20, y); y += 6 }
                        doc.text(`\u2022 ${p.afterPhotos.length} photo(s) apr\u00E8s intervention`, 20, y); y += 10
                        // Embed photos
                        const allPhotos = [...p.beforePhotos.slice(0, 2), ...p.afterPhotos.slice(0, 2)]
                        for (const photo of allPhotos) {
                          if (y > 230) { doc.addPage(); y = 20 }
                          try {
                            doc.addImage(photo.dataUrl, 'JPEG', 15, y, 80, 60)
                            doc.setFontSize(8)
                            doc.setTextColor(120, 120, 120)
                            doc.text(`${photo.label} \u2014 ${new Date(photo.timestamp).toLocaleString(dateFmtLocale)}`, 15, y + 63)
                            y += 70
                          } catch { /* image format non supporté */ }
                        }
                        // Signature
                        if (p.signature) {
                          if (y > 240) { doc.addPage(); y = 20 }
                          doc.setFontSize(12)
                          doc.setTextColor(33, 33, 33)
                          doc.text('Signature client :', 15, y + 5)
                          doc.setFontSize(8)
                          doc.setTextColor(100, 100, 100)
                          doc.text('\u270D\uFE0F Signature num\u00E9rique archiv\u00E9e \u2014 Valeur probante', 15, y + 12)
                          y += 20
                        }
                        // Footer
                        doc.setFontSize(8)
                        doc.setTextColor(150, 150, 150)
                        doc.text(`G\u00E9n\u00E9r\u00E9 par Vitfix Pro \u2014 ${new Date().toLocaleString(dateFmtLocale)}`, 15, 285)
                        doc.text(contenuIA?.source === 'groq' ? `Rapport g\u00E9n\u00E9r\u00E9 automatiquement le ${new Date().toLocaleDateString(dateFmtLocale)}` : 'Document \u00E0 valeur probante \u2014 GPS + horodatage + signature client', 15, 290)
                        doc.save(`Rapport_${bk?.services?.name?.replace(/\s+/g, '_') || 'chantier'}_${p.completedAt ? new Date(p.completedAt).toISOString().split('T')[0] : 'date'}.pdf`)
                      }).catch(() => toast.error('Erreur lors de la génération du PDF'))
                    }}
                    className="mt-2 w-full bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded-xl text-xs font-bold active:scale-95 transition"
                  >
                    📄 Générer rapport PDF
                  </button>
                  )}
                </div>
              )
            })
          })()}
        </div>

        {/* Motifs section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-700">🔧 Mes motifs ({services.length})</div>
            <button onClick={() => setMotifModal(true)} className="bg-[#FFC107] text-gray-900 text-xs font-bold px-3 py-1.5 rounded-xl">
              + Nouveau
            </button>
          </div>
          {services.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
              <div className="text-4xl mb-2">🔧</div>
              <div className="text-sm text-gray-500">Aucun motif créé</div>
              <button onClick={() => setMotifModal(true)} className="mt-3 text-[#FFC107] text-sm font-semibold">+ Créer un motif</button>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map(s => (
                <div key={s.id} className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{serviceRanges[s.id]?.durationEstimate ? `⏱️ ${serviceRanges[s.id].durationEstimate}` : ''}{serviceRanges[s.id]?.durationEstimate && serviceRanges[s.id]?.pricingUnit ? ' · ' : ''}{serviceRanges[s.id]?.pricingUnit || 'forfait'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-green-600">
                      {serviceRanges[s.id] ? `${serviceRanges[s.id].priceMin}€ - ${serviceRanges[s.id].priceMax}€` : formatPrice(s.price_ttc)}
                    </div>
                    <div className={`text-[10px] font-medium ${s.active ? 'text-green-500' : 'text-gray-500'}`}>
                      {s.active ? 'Actif' : 'Inactif'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* ── Devis Rapide ── */}
        {isModuleEnabled('devis_rapide') && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-700">📝 Devis rapide</div>
            <button
              onClick={() => { setDevisForm({ client: '', service: '', description: '', montantHT: '', tva: '20', validite: '30' }); setDevisGenere(null); setShowDevisModal(true) }}
              className="bg-[#FFC107] text-gray-900 text-xs font-bold px-3 py-1.5 rounded-xl"
            >
              + Créer
            </button>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="text-sm font-semibold text-amber-800 mb-1">📋 Générez un devis en 30 secondes</div>
            <div className="text-xs text-amber-700 mb-3">Renseignez le client, le service et le montant. Le devis formaté est prêt à envoyer par SMS ou email.</div>
            <button
              onClick={() => { setDevisForm({ client: '', service: '', description: '', montantHT: '', tva: '20', validite: '30' }); setDevisGenere(null); setShowDevisModal(true) }}
              className="w-full bg-[#FFC107] text-gray-900 font-bold py-2.5 rounded-xl text-sm active:scale-95 transition"
            >
              📝 Nouveau devis
            </button>
          </div>
        </div>
        )}

        {/* ── Export FEC comptable ── */}
        {isModuleEnabled('export_fec') && (
        <div>
          <div className="text-sm font-bold text-gray-700 mb-3">📊 Export comptable</div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-lg">📊</div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">Fichier des Écritures Comptables</div>
                <div className="text-xs text-gray-500 mt-0.5">Format FEC (Art. L47 A-1 du LPF)</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">Exportez vos écritures au format FEC requis par l&apos;administration fiscale. Inclut toutes les interventions facturées.</p>
            <button
              onClick={() => {
                const headers = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise'
                const lines = [headers]
                const completedB = bookings.filter(b => b.status === 'completed' && b.price_ttc)
                completedB.forEach((b: any, idx: number) => {
                  const num = String(idx + 1).padStart(6, '0')
                  const date = (b.booking_date || '').replace(/-/g, '')
                  const ht = ((b.price_ttc || 0) / 1.2).toFixed(2)
                  const tva = ((b.price_ttc || 0) - Number(ht)).toFixed(2)
                  const ttc = (b.price_ttc || 0).toFixed(2)
                  const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                  const ref = `FAC-${date}-${num}`
                  lines.push(`VE|Journal des Ventes|${num}|${date}|706000|Prestations de services|||${ref}|${date}|${b.services?.name || 'Prestation'}||${ht}||||`)
                  lines.push(`VE|Journal des Ventes|${num}|${date}|445710|TVA collectée 20%|||${ref}|${date}|TVA ${b.services?.name || 'Prestation'}||${tva}||||`)
                  lines.push(`VE|Journal des Ventes|${num}|${date}|411000|Clients|${clientName}|${clientName}|${ref}|${date}|${clientName} - ${b.services?.name || 'Prestation'}|${ttc}|||||`)
                })
                try {
                  const expenses = JSON.parse(localStorage.getItem(`fixit_expenses_${artisan?.id}`) || '[]')
                  expenses.forEach((exp: any, idx: number) => {
                    const num = String(completedB.length + idx + 1).padStart(6, '0')
                    const date = (exp.date || '').replace(/-/g, '')
                    const ref = `ACH-${date}-${num}`
                    lines.push(`AC|Journal des Achats|${num}|${date}|606000|Achats non stockés|||${ref}|${date}|${exp.label || 'Dépense'}|${(exp.amount || 0).toFixed(2)}|||||`)
                    lines.push(`AC|Journal des Achats|${num}|${date}|401000|Fournisseurs|||${ref}|${date}|${exp.label || 'Dépense'}||${(exp.amount || 0).toFixed(2)}||||`)
                  })
                } catch {}
                const content = lines.join('\n')
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `FEC_${artisan?.company_name?.replace(/\s+/g, '_') || 'artisan'}_${new Date().toISOString().split('T')[0]}.txt`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition"
            >
              📥 Télécharger le FEC
            </button>
            <div className="text-[10px] text-gray-500 text-center mt-2">
              {completedBookings.length} écriture(s) de vente · Format compatible DGFiP
            </div>
          </div>
        </div>
        )}

        {/* ── Photos Chantier (banque photos géolocalisées) ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-700">📸 Photos Chantier</div>
            <label className="cursor-pointer bg-[#FFC107] text-gray-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
              📷 Prendre photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !artisan) return
                  e.target.value = ''
                  // GPS obligatoire
                  try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
                    })
                    const lat = pos.coords.latitude
                    const lng = pos.coords.longitude
                    const takenAt = new Date().toISOString()
                    // Demander association booking optionnelle
                    const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending')
                    let selectedBookingId: string | null = null
                    if (activeBookings.length > 0) {
                      const choices = activeBookings.map((b, i) => `${i + 1}. ${b.services?.name || 'RDV'} — ${b.booking_date}`).join('\n')
                      const answer = prompt(`Associer à un chantier ?\n\n${choices}\n\n0. Aucun (photo libre)\n\nEntrez le numéro :`)
                      if (answer && parseInt(answer) > 0 && parseInt(answer) <= activeBookings.length) {
                        selectedBookingId = activeBookings[parseInt(answer) - 1].id
                      }
                    }
                    // Upload
                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('artisan_id', artisan.id)
                    formData.append('lat', String(lat))
                    formData.append('lng', String(lng))
                    formData.append('taken_at', takenAt)
                    formData.append('source', 'mobile')
                    if (selectedBookingId) formData.append('booking_id', selectedBookingId)
                    const session = await supabase.auth.getSession()
                    const token = session.data.session?.access_token
                    const res = await fetch('/api/artisan-photos', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` },
                      body: formData,
                    })
                    if (res.ok) {
                      toast.success('Photo enregistrée avec GPS et horodatage !')
                    } else {
                      const err = await res.json()
                      toast.error(err.error || 'Erreur upload')
                    }
                  } catch (gpsErr) {
                    toast.error('GPS requis pour prendre une photo chantier. Activez la géolocalisation.')
                  }
                }}
              />
            </label>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="text-xs text-gray-500 mb-2">
              📍 Toutes les photos sont géolocalisées et horodatées automatiquement.
              Depuis le dashboard desktop, vous pouvez les associer à vos chantiers et les joindre à vos devis/factures.
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>📱 Prise depuis l&apos;appli uniquement</span>
              <span>•</span>
              <span>📍 GPS obligatoire</span>
              <span>•</span>
              <span>🕐 Horodatage auto</span>
            </div>
          </div>
        </div>

        {/* ── Compliance Wallet OCR ── */}
        {isModuleEnabled('compliance_wallet') && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-gray-700">🪪 {locale === 'pt' ? 'Documentos pro' : 'Documents pro'}</div>
              {expiringCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{expiringCount} {locale === 'pt' ? 'alerta' : 'alerte'}{expiringCount > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setOcrResult(null); setShowComplianceModal(true); ocrInputRef.current?.click() }}
                className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
              >
                📷 Scanner
              </button>
              <button onClick={() => { setOcrResult(null); setShowComplianceModal(true) }} className="bg-[#FFC107] text-gray-900 text-xs font-bold px-3 py-1.5 rounded-xl">
                + Ajouter
              </button>
            </div>
          </div>

          {/* Compliance Health Score */}
          {complianceDocs.length > 0 && (() => {
            const requiredTypes = COMPLIANCE_TYPES.filter(ct => ct.key !== 'autre')
            const validCount = requiredTypes.filter(ct => {
              const doc = complianceDocs.find(d => d.type === ct.key)
              return doc && getComplianceStatus(doc) === 'valid'
            }).length
            const healthScore = Math.round((validCount / requiredTypes.length) * 100)
            const healthColor = healthScore >= 80 ? 'text-green-600' : healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
            const healthBg = healthScore >= 80 ? 'bg-green-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
            return (
              <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600">{locale === 'pt' ? 'Pontuação conformidade' : 'Score compliance'}</span>
                  <span className={`text-lg font-black ${healthColor}`}>{healthScore}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`${healthBg} h-2 rounded-full transition-all duration-500`} style={{ width: `${healthScore}%` }} />
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5">{validCount}/{requiredTypes.length} {locale === 'pt' ? 'documentos válidos' : 'documents valides'}</div>
              </div>
            )
          })()}

          {/* Passeport Prevention Alert Banner */}
          {!complianceDocs.find(d => d.type === 'passeport_prev') && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-3.5 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">🎓</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-purple-800">{locale === 'pt' ? 'Certificado de Atividade em falta' : 'Passeport Prevention obligatoire'}</div>
                  <div className="text-[10px] text-purple-600 mt-0.5">{locale === 'pt' ? 'Adicione o seu certificado de atividade profissional para completar o seu dossiê.' : 'Obligatoire depuis mars 2026 pour tous les artisans du BTP. Ajoutez-le maintenant.'}</div>
                  <button
                    onClick={() => { setOcrResult(null); setComplianceForm(f => ({ ...f, type: 'passeport_prev' })); setShowComplianceModal(true) }}
                    className="mt-2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-lg"
                  >
                    {locale === 'pt' ? '+ Adicionar certificado' : '+ Ajouter mon Passeport'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {complianceDocs.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
              <div className="text-3xl mb-2">🪪</div>
              <div className="text-sm font-semibold text-gray-700 mb-1">{locale === 'pt' ? 'Carteira vazia' : 'Portefeuille vide'}</div>
              <div className="text-xs text-gray-500 mb-3">{locale === 'pt' ? 'Digitalize ou adicione os seus documentos profissionais' : 'Scannez ou ajoutez vos documents pro pour ne jamais rater une echeance'}</div>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setOcrResult(null); setShowComplianceModal(true); setTimeout(() => ocrInputRef.current?.click(), 300) }} className="bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1">
                  📷 {locale === 'pt' ? 'Digitalizar' : 'Scanner un document'}
                </button>
                <button onClick={() => { setOcrResult(null); setShowComplianceModal(true) }} className="text-[#FFC107] text-xs font-bold px-4 py-2 border border-amber-200 rounded-xl">{locale === 'pt' ? '+ Manual' : '+ Manuel'}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {COMPLIANCE_TYPES.map(ct => {
                const doc = complianceDocs.find(d => d.type === ct.key)
                if (!doc) return null
                const status = getComplianceStatus(doc)
                const days = doc.dateExpiration ? Math.ceil((new Date(doc.dateExpiration).getTime() - Date.now()) / 86400000) : null
                const statusCfg = {
                  valid:    { bg: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700', label: days !== null ? `${days}j restants` : 'Valide' },
                  expiring: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: days !== null ? `${days}j restants` : 'Bientot' },
                  expired:  { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',   badge: 'bg-red-100 text-red-700',   label: 'Expire' },
                  nodoc:    { bg: 'bg-gray-50 border-gray-200',   text: 'text-gray-600',  badge: 'bg-gray-100 text-gray-600', label: 'Sans date' },
                }[status]
                const statusIcon = status === 'valid' ? '✅' : status === 'expiring' ? '⚠️' : status === 'expired' ? '❌' : '📄'
                return (
                  <div key={ct.key} className={`rounded-2xl p-3.5 border ${statusCfg.bg} flex items-center gap-3`}>
                    {doc.photoDataUrl ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        <Image src={doc.photoDataUrl} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                      </div>
                    ) : (
                      <span className="text-xl flex-shrink-0">{ct.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                        {t(ct.labelKey, ct.label)}
                        {doc.ocrData && (
                          <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">OCR</span>
                        )}
                      </div>
                      {doc.dateExpiration && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Exp : {new Date(doc.dateExpiration).toLocaleDateString(dateFmtLocale)}
                        </div>
                      )}
                      {doc.verificationStatus && (
                        <div className={`text-[10px] mt-0.5 ${
                          doc.verificationStatus === 'verified' ? 'text-green-600' :
                          doc.verificationStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {doc.verificationStatus === 'verified' ? '✓ Verifie' :
                           doc.verificationStatus === 'rejected' ? '✕ Rejete' : '⏳ En attente'}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${statusCfg.badge}`}>{statusIcon} {statusCfg.label}</span>
                    <button onClick={() => deleteComplianceDoc(doc.id)} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0">✕</button>
                  </div>
                )
              })}

              {/* Partager */}
              <button
                onClick={copyComplianceProfile}
                className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                  complianceCopied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {complianceCopied ? '✅ Profil copie !' : '📤 Partager mon profil compliance'}
              </button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
