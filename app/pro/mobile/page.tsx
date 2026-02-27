'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'agenda' | 'interventions' | 'documents' | 'settings'
type ProofStep = 'before' | 'during' | 'after' | 'signature'

// ─── Compliance Wallet ───────────────────────────────────────────────────────
const COMPLIANCE_TYPES = [
  { key: 'decennale',  label: 'RC Décennale',         icon: '🛡️', renewYears: 1 },
  { key: 'kbis',       label: 'Extrait KBIS',          icon: '📋', renewYears: 0 },
  { key: 'urssaf',     label: 'Attestation URSSAF',    icon: '🏛️', renewYears: 0 },
  { key: 'rge',        label: 'Certificat RGE',         icon: '♻️', renewYears: 4 },
  { key: 'carte_pro',      label: 'Carte Pro BTP',          icon: '🪪', renewYears: 5 },
  { key: 'passeport_prev', label: 'Passeport Prévention',   icon: '🎓', renewYears: 0 },
  { key: 'assurance_pro',  label: 'Assurance Pro (RC)',      icon: '🔒', renewYears: 1 },
  { key: 'autre',          label: 'Autre document',          icon: '📄', renewYears: 0 },
] as const
type ComplianceType = typeof COMPLIANCE_TYPES[number]['key']

interface ComplianceDoc {
  id: string
  type: ComplianceType
  dateExpiration: string | null
  notes: string
  addedAt: string
  // OCR fields
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

interface ProofPhoto {
  dataUrl: string
  timestamp: string
  lat?: number
  lng?: number
  label: string
}

interface InterventionProof {
  bookingId: string
  step: ProofStep
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

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'completed': return 'bg-green-100 text-green-700 border-green-200'
    case 'cancelled': return 'bg-red-100 text-red-700 border-red-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'confirmed': return 'Confirmé'
    case 'pending': return 'En attente'
    case 'completed': return 'Terminé'
    case 'cancelled': return 'Annulé'
    default: return status
  }
}

const formatDateFR = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Bottom Nav Component ──────────────────────────────────────────────────────
function BottomNav({ active, onChange, pendingCount, notifCount }: { active: Tab; onChange: (t: Tab) => void; pendingCount: number; notifCount?: number }) {
  const items: { tab: Tab; icon: string; label: string; badge?: number }[] = [
    { tab: 'home', icon: '🏠', label: 'Accueil', badge: notifCount && notifCount > 0 ? notifCount : undefined },
    { tab: 'agenda', icon: '📅', label: 'Agenda' },
    { tab: 'interventions', icon: '🔧', label: 'RDV', badge: pendingCount },
    { tab: 'documents', icon: '📄', label: 'Docs' },
    { tab: 'settings', icon: '⚙️', label: 'Compte' },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
      <div className="flex">
        {items.map((item) => (
          <button
            key={item.tab}
            onClick={() => onChange(item.tab)}
            className={`flex-1 flex flex-col items-center justify-center py-2 pt-3 transition-all relative ${
              active === item.tab ? 'text-[#FFC107]' : 'text-gray-400'
            }`}
          >
            {item.badge ? (
              <span className="absolute top-1 right-1/4 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold z-10">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            ) : null}
            <span className="text-2xl leading-none">{item.icon}</span>
            <span className={`text-[10px] mt-1 font-medium ${active === item.tab ? 'text-[#FFC107]' : 'text-gray-400'}`}>
              {item.label}
            </span>
            {active === item.tab && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#FFC107] rounded-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─── Proof of Work Component ───────────────────────────────────────────────────
function ProofOfWork({ booking, artisan, onClose, onComplete }: {
  booking: any
  artisan: any
  onClose: () => void
  onComplete: (proof: InterventionProof) => void
}) {
  const [step, setStep] = useState<ProofStep>('before')
  const [proof, setProof] = useState<InterventionProof>({
    bookingId: booking.id,
    step: 'before',
    beforePhotos: [],
    duringPhotos: [],
    afterPhotos: [],
    description: '',
    startedAt: new Date().toISOString(),
  })
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [signaturePad, setSignaturePad] = useState<{ drawing: boolean; path: string }>({ drawing: false, path: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [signaturePoints, setSignaturePoints] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Get GPS on mount
  useEffect(() => {
    setGpsStatus('loading')
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setProof(p => ({ ...p, gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude }))
          setGpsStatus('ok')
        },
        () => setGpsStatus('error'),
        { timeout: 10000 }
      )
    } else {
      setGpsStatus('error')
    }
  }, [])

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const photo: ProofPhoto = {
          dataUrl: ev.target?.result as string,
          timestamp: new Date().toISOString(),
          lat: gpsCoords?.lat,
          lng: gpsCoords?.lng,
          label: step === 'before' ? 'Photo avant' : step === 'during' ? 'Étape' : 'Photo après',
        }
        setProof(p => {
          if (step === 'before') return { ...p, beforePhotos: [...p.beforePhotos, photo] }
          if (step === 'during') return { ...p, duringPhotos: [...p.duringPhotos, photo] }
          return { ...p, afterPhotos: [...p.afterPhotos, photo] }
        })
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const currentPhotos = step === 'before' ? proof.beforePhotos : step === 'during' ? proof.duringPhotos : proof.afterPhotos
  const minPhotos = step === 'before' || step === 'after' ? 3 : 0

  // Anti-fraude : GPS obligatoire pour valider les étapes photo
  const canProceed = (step === 'during' || currentPhotos.length >= minPhotos) && gpsStatus === 'ok'

  // Retry GPS si refusé
  const retryGps = () => {
    setGpsStatus('loading')
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setProof(p => ({ ...p, gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude }))
          setGpsStatus('ok')
        },
        () => setGpsStatus('error'),
        { timeout: 10000 }
      )
    } else {
      setGpsStatus('error')
    }
  }

  // Garde mobile uniquement : bloquer l'accès depuis desktop
  const isNativePlatform = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true
  const isMobileContext = typeof window !== 'undefined' &&
    (window.innerWidth <= 900 || 'ontouchstart' in window || isNativePlatform)

  if (!isMobileContext) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col items-center justify-center p-8">
        <div className="text-7xl mb-5">📱</div>
        <h2 className="text-white text-xl font-bold text-center mb-3">
          Fonctionnalité mobile uniquement
        </h2>
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          Le Proof of Work nécessite l'application mobile VitFix Pro pour accéder à la caméra native et au GPS.
          <br />Cette fonctionnalité est conçue pour éviter les fraudes.
        </p>
        <button
          onClick={onClose}
          className="mt-8 bg-[#FFC107] text-gray-900 px-8 py-3 rounded-xl font-bold text-sm"
        >
          Fermer
        </button>
      </div>
    )
  }

  // Signature pad handlers
  const getPoint = (e: React.TouchEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startSign = (e: React.TouchEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const pt = getPoint(e)
    setSignaturePad({ drawing: true, path: `M ${pt.x} ${pt.y}` })
    setSignaturePoints(prev => [...prev, `M ${pt.x} ${pt.y}`])
    e.preventDefault()
  }

  const drawSign = (e: React.TouchEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    if (!signaturePad.drawing) return
    const pt = getPoint(e)
    const newPath = signaturePad.path + ` L ${pt.x} ${pt.y}`
    setSignaturePad(p => ({ ...p, path: newPath }))
    setSignaturePoints(prev => {
      const last = prev[prev.length - 1]
      return [...prev.slice(0, -1), last + ` L ${pt.x} ${pt.y}`]
    })
    e.preventDefault()
  }

  const endSign = () => {
    setSignaturePad(p => ({ ...p, drawing: false }))
  }

  const clearSignature = () => {
    setSignaturePad({ drawing: false, path: '' })
    setSignaturePoints([])
  }

  const handleSubmit = async () => {
    setSaving(true)
    const finalProof = {
      ...proof,
      signature: signaturePoints.join(' '),
      completedAt: new Date().toISOString(),
      step: 'signature' as ProofStep,
    }
    // Save proof to localStorage (+ optionally Supabase storage)
    const existingProofs = JSON.parse(localStorage.getItem('fixit_proofs') || '[]')
    localStorage.setItem('fixit_proofs', JSON.stringify([...existingProofs, finalProof]))
    // Update booking status to completed
    await supabase.from('bookings').update({
      status: 'completed',
      completed_at: finalProof.completedAt,
    }).eq('id', booking.id)
    setSaving(false)
    onComplete(finalProof)
  }

  const steps: { key: ProofStep; label: string; icon: string }[] = [
    { key: 'before', label: 'Avant', icon: '📸' },
    { key: 'during', label: 'Pendant', icon: '⚙️' },
    { key: 'after', label: 'Après', icon: '✅' },
    { key: 'signature', label: 'Signature', icon: '✍️' },
  ]

  const currentStepIdx = steps.findIndex(s => s.key === step)

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#FFC107] px-4 py-3 flex items-center gap-3 safe-area-pt">
        <button onClick={onClose} className="text-gray-900 text-xl p-1">✕</button>
        <div>
          <div className="font-bold text-gray-900 text-sm">Proof of Work</div>
          <div className="text-[11px] text-gray-800 opacity-80">{booking.services?.name || 'Intervention'}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {gpsStatus === 'ok' && <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-medium">📍 GPS</span>}
          {gpsStatus === 'loading' && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">📍 GPS...</span>}
          {gpsStatus === 'error' && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">📍 Non</span>}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        {steps.map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div className={`flex flex-col items-center ${idx <= currentStepIdx ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 ${
                idx < currentStepIdx ? 'bg-green-500 text-white' :
                idx === currentStepIdx ? 'bg-[#FFC107] text-gray-900' :
                'bg-gray-200 text-gray-500'
              }`}>
                {idx < currentStepIdx ? '✓' : s.icon}
              </div>
              <span className="text-[9px] text-gray-500 font-medium">{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 mb-4 mx-1 ${idx < currentStepIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">

        {/* AVANT / PENDANT / APRÈS */}
        {step !== 'signature' && (
          <div className="p-4">
            <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">
                {step === 'before' ? '📸 Photos AVANT intervention' :
                 step === 'during' ? '⚙️ Photos pendant (optionnel)' :
                 '✅ Photos APRÈS intervention'}
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                {step === 'before' ? `Minimum 3 photos requises (${currentPhotos.length}/3) — zone générale, problème, compteur` :
                 step === 'during' ? 'Photos d\'étapes importantes (optionnel)' :
                 `Minimum 3 photos requises (${currentPhotos.length}/3) — résultat final`}
              </p>

              {/* GPS Info */}
              {gpsCoords && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3">
                  <span className="text-green-600 text-sm">📍</span>
                  <span className="text-[11px] text-green-700 font-medium">
                    GPS : {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                  </span>
                  <span className="text-[10px] text-green-600 ml-auto">Horodatage auto ✓</span>
                </div>
              )}

              {/* Photo grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {currentPhotos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-gray-200">
                    <img src={photo.dataUrl} alt={photo.label} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                      <div className="text-[8px] text-white">{new Date(photo.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <button
                      onClick={() => setProof(p => {
                        if (step === 'before') return { ...p, beforePhotos: p.beforePhotos.filter((_, i) => i !== idx) }
                        if (step === 'during') return { ...p, duringPhotos: p.duringPhotos.filter((_, i) => i !== idx) }
                        return { ...p, afterPhotos: p.afterPhotos.filter((_, i) => i !== idx) }
                      })}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]"
                    >✕</button>
                  </div>
                ))}

                {/* Add photo button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-[#FFC107] bg-amber-50 flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-2xl">📷</span>
                  <span className="text-[10px] text-amber-600 font-medium">Ajouter</span>
                </button>
              </div>

              {/* capture="environment" force la caméra arrière native (anti-galerie) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
              />

              {step === 'after' && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description des travaux effectués *</label>
                  <textarea
                    value={proof.description}
                    onChange={e => setProof(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    placeholder="Décrivez brièvement les travaux réalisés..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
                  />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentStepIdx > 0 && (
                <button
                  onClick={() => setStep(steps[currentStepIdx - 1].key)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold text-sm"
                >
                  ← Retour
                </button>
              )}
              <button
                disabled={!canProceed}
                onClick={() => {
                  if (step === 'after') {
                    setStep('signature')
                  } else {
                    setStep(steps[currentStepIdx + 1].key)
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                  canProceed
                    ? 'bg-[#FFC107] text-gray-900 shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {step === 'after' ? 'Signature client →' : 'Suivant →'}
              </button>
            </div>

            {!canProceed && minPhotos > 0 && currentPhotos.length < minPhotos && (
              <p className="text-center text-[11px] text-red-500 mt-2">
                {minPhotos - currentPhotos.length} photo(s) manquante(s)
              </p>
            )}
            {gpsStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center mt-3">
                <p className="text-xs text-red-600 font-semibold">⚠️ GPS requis pour valider l&apos;intervention</p>
                <p className="text-[10px] text-red-400 mt-1">Activez la localisation dans vos réglages téléphone</p>
                <button
                  onClick={retryGps}
                  className="mt-2 text-red-600 text-xs font-semibold underline"
                >
                  Réessayer la géolocalisation
                </button>
              </div>
            )}
            {gpsStatus === 'loading' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center mt-3">
                <p className="text-xs text-amber-600 font-semibold">📍 Acquisition GPS en cours...</p>
              </div>
            )}
          </div>
        )}

        {/* SIGNATURE */}
        {step === 'signature' && (
          <div className="p-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <h2 className="font-bold text-gray-900 mb-1">✍️ Signature du client</h2>
              <p className="text-xs text-gray-500 mb-4">
                Le client confirme que les travaux sont terminés et conformes à la demande.
              </p>

              {/* Summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs space-y-1">
                <div className="font-semibold text-amber-800">📋 Récapitulatif</div>
                <div className="text-amber-700">📸 {proof.beforePhotos.length} photos avant</div>
                {proof.duringPhotos.length > 0 && <div className="text-amber-700">📸 {proof.duringPhotos.length} photos pendant</div>}
                <div className="text-amber-700">📸 {proof.afterPhotos.length} photos après</div>
                {proof.description && <div className="text-amber-700">📝 Description : {proof.description.substring(0, 60)}...</div>}
                {gpsCoords && <div className="text-amber-700">📍 GPS enregistré</div>}
              </div>

              {/* Client declaration */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-700 leading-relaxed">
                  <strong>Déclaration :</strong> Je soussigné(e) certifie que les travaux effectués par{' '}
                  <strong>{artisan?.company_name}</strong> sont terminés et conformes à ma demande.
                  <br />
                  <span className="text-gray-400">Date : {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </p>
              </div>

              {/* Signature area */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">Signature ici :</span>
                  <button onClick={clearSignature} className="text-[11px] text-red-500 underline">Effacer</button>
                </div>
                <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
                  <svg
                    ref={svgRef}
                    width="100%"
                    height="160"
                    className="cursor-crosshair"
                    onMouseDown={startSign}
                    onMouseMove={drawSign}
                    onMouseUp={endSign}
                    onTouchStart={startSign}
                    onTouchMove={drawSign}
                    onTouchEnd={endSign}
                  >
                    {signaturePoints.length === 0 && (
                      <text x="50%" y="50%" textAnchor="middle" fill="#D1D5DB" fontSize="13" dy="0.3em">
                        Signez ici avec le doigt
                      </text>
                    )}
                    {signaturePoints.map((d, i) => (
                      <path key={i} d={d} fill="none" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                  </svg>
                </div>
              </div>

              <div className="text-[10px] text-gray-400 text-center mb-4">
                🔒 Signature horodatée et archivée — Valeur légale
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('after')}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold text-sm"
              >
                ← Retour
              </button>
              <button
                disabled={signaturePoints.length < 3 || saving}
                onClick={handleSubmit}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                  signaturePoints.length >= 3 && !saving
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Enregistrement...' : '✅ Valider & Terminer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Booking Card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, onProof, onStatusChange, trackingToken, onStartTracking, onStopTracking, onCopyLink, linkCopied }: {
  booking: any
  onProof: () => void
  onStatusChange: (id: string, status: string) => void
  trackingToken?: string
  onStartTracking?: () => void
  onStopTracking?: () => void
  onCopyLink?: () => void
  linkCopied?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const clientName = booking.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer active:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
          booking.status === 'confirmed' ? 'bg-blue-100' :
          booking.status === 'pending' ? 'bg-amber-100' :
          booking.status === 'completed' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {booking.status === 'completed' ? '✓' : booking.status === 'confirmed' ? '📅' : booking.status === 'pending' ? '⏳' : '✕'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{clientName}</div>
          <div className="text-xs text-gray-500 truncate">{booking.services?.name || 'Service'}</div>
          <div className="text-xs text-gray-400 mt-0.5">{formatDateFR(booking.booking_date)} · {booking.booking_time?.substring(0, 5)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusColor(booking.status)}`}>
            {getStatusLabel(booking.status)}
          </span>
          {booking.price_ttc && <span className="text-xs font-bold text-green-600">{formatPrice(booking.price_ttc)}</span>}
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {booking.address && (
            <div className="flex items-start gap-2 mb-3">
              <span className="text-sm">📍</span>
              <span className="text-xs text-gray-600">{booking.address}</span>
            </div>
          )}
          {booking.notes && (
            <div className="flex items-start gap-2 mb-3">
              <span className="text-sm">📝</span>
              <span className="text-xs text-gray-600">{booking.notes}</span>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {booking.status === 'pending' && (
              <>
                <button
                  onClick={() => onStatusChange(booking.id, 'confirmed')}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-xl text-xs font-semibold"
                >
                  ✓ Confirmer
                </button>
                <button
                  onClick={() => onStatusChange(booking.id, 'cancelled')}
                  className="flex-1 bg-red-100 text-red-600 py-2 rounded-xl text-xs font-semibold"
                >
                  ✕ Refuser
                </button>
              </>
            )}
            {booking.status === 'confirmed' && (
              <button
                onClick={onProof}
                className="flex-1 bg-[#FFC107] text-gray-900 py-2.5 rounded-xl text-xs font-bold shadow-sm"
              >
                📸 Commencer intervention (Proof of Work)
              </button>
            )}
            {booking.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-600 text-xs font-semibold">
                <span>✅</span>
                <span>Intervention terminée avec preuve archivée</span>
              </div>
            )}
          </div>

          {/* ── Tracking GPS en temps réel ── */}
          {(booking.status === 'confirmed' || booking.status === 'pending') && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              {!trackingToken ? (
                /* Pas encore de tracking actif */
                <button
                  onClick={onStartTracking}
                  className="w-full bg-blue-50 border border-blue-200 text-blue-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  📍 Démarrer le suivi GPS client
                </button>
              ) : (
                /* Tracking actif */
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-700 flex-1">Suivi actif — position partagée</span>
                    <button
                      onClick={onStopTracking}
                      className="text-xs text-red-500 font-semibold hover:text-red-700"
                    >
                      Arrêter
                    </button>
                  </div>
                  <button
                    onClick={onCopyLink}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                      linkCopied
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-white border-gray-200 text-gray-700'
                    }`}
                  >
                    {linkCopied ? '✅ Lien copié !' : '🔗 Copier le lien de suivi (client)'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Quick Action Button ───────────────────────────────────────────────────────
function QuickBtn({ icon, label, onClick, color = 'bg-white' }: { icon: string; label: string; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`${color} rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm border border-gray-100 active:scale-95 transition-transform`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">{label}</span>
    </button>
  )
}

// ─── Artisan Modules ──────────────────────────────────────────────────────────
const ARTISAN_MODULES = [
  { key: 'ponctualite', label: 'Score de ponctualité', icon: '⏱️', description: 'Affiche votre taux de réalisation sur l\'accueil', default: true },
  { key: 'revenus', label: 'Dashboard revenus', icon: '💰', description: 'Suivi mensuel du CA et top services', default: true },
  { key: 'devis_rapide', label: 'Devis rapide', icon: '📝', description: 'Générer et envoyer des devis en 30 secondes', default: true },
  { key: 'export_fec', label: 'Export FEC comptable', icon: '📊', description: 'Export des écritures au format fiscal', default: false },
  { key: 'compliance_wallet', label: 'Compliance Wallet', icon: '🪪', description: 'Portefeuille de documents professionnels', default: true },
  { key: 'proof_of_work', label: 'Proof of Work', icon: '📸', description: 'Photos avant/après + signature client', default: true },
  { key: 'gps_tracking', label: 'GPS Tracking', icon: '📍', description: 'Partagez votre position en temps réel', default: false },
  { key: 'rapport_pdf', label: 'Rapport PDF fin de chantier', icon: '📄', description: 'Générer un rapport PDF probatoire', default: false },
  { key: 'notifications', label: 'Notifications syndic', icon: '📣', description: 'Recevoir les notifications du syndic', default: true },
] as const
type ArtisanModuleKey = typeof ARTISAN_MODULES[number]['key']

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MobileDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [artisan, setArtisan] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [proofBooking, setProofBooking] = useState<any>(null)
  const [showNewRdv, setShowNewRdv] = useState(false)
  const [newRdv, setNewRdv] = useState({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '' })
  const [savingRdv, setSavingRdv] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ company_name: '', phone: '', bio: '' })
  const [savingSettings, setSavingSettings] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [motifModal, setMotifModal] = useState(false)
  const [motifForm, setMotifForm] = useState({ name: '', duration_estimate: '', price_min: '', price_max: '', pricing_unit: 'forfait' })
  const [savingMotif, setSavingMotif] = useState(false)
  const [serviceRanges, setServiceRanges] = useState<Record<string, { priceMin: number; priceMax: number; durationEstimate?: string; pricingUnit?: string }>>({})
  const [autoAccept, setAutoAccept] = useState(false)
  const [dayServices, setDayServices] = useState<Record<string, string[]>>({})
  const [artisanNotifs, setArtisanNotifs] = useState<{ id: string; title: string; body: string; type: string; read: boolean; created_at: string }[]>([])
  const [notifToast, setNotifToast] = useState<{ title: string; body: string } | null>(null)
  // ── Compliance Wallet ──
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDoc[]>([])
  const [showComplianceModal, setShowComplianceModal] = useState(false)
  const [complianceForm, setComplianceForm] = useState<{ type: ComplianceType; dateExpiration: string; notes: string }>({ type: 'decennale', dateExpiration: '', notes: '' })
  const [complianceCopied, setComplianceCopied] = useState(false)
  // ── OCR Compliance ──
  const [ocrScanning, setOcrScanning] = useState(false)
  const [ocrResult, setOcrResult] = useState<any>(null)
  const ocrInputRef = useRef<HTMLInputElement>(null)
  // ── Tracking en temps réel ──
  const [activeTrackings, setActiveTrackings] = useState<Record<string, string>>({}) // bookingId → token
  const trackingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({})
  const [trackingCopied, setTrackingCopied] = useState<string | null>(null)
  // ── Modules personnalisables ──
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})
  // ── Devis rapide ──
  const [showDevisModal, setShowDevisModal] = useState(false)
  const [devisForm, setDevisForm] = useState({ client: '', service: '', description: '', montantHT: '', tva: '20', validite: '30' })
  const [devisGenere, setDevisGenere] = useState<string | null>(null)
  const [devisCopied, setDevisCopied] = useState(false)

  const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/pro/login'); return }
      await loadData(session.user)
    }
    init()
  }, [])

  // Supabase Realtime — notifications artisan in-app
  useEffect(() => {
    if (!artisan?.user_id) return

    // Charger les notifs existantes
    fetch(`/api/syndic/notify-artisan?artisan_id=${artisan.user_id}&limit=20`)
      .then(r => r.json())
      .then(d => { if (d.notifications) setArtisanNotifs(d.notifications) })
      .catch(() => {})

    const channel = supabase
      .channel(`artisan_notifs_${artisan.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'artisan_notifications',
        filter: `artisan_id=eq.${artisan.user_id}`,
      }, (payload) => {
        const n = payload.new as any
        setArtisanNotifs(prev => [{ id: n.id, title: n.title, body: n.body, type: n.type, read: false, created_at: n.created_at }, ...prev])
        // Afficher toast in-app
        setNotifToast({ title: n.title, body: n.body })
        setTimeout(() => setNotifToast(null), 5000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [artisan?.user_id])

  const loadData = async (user: any) => {
    const { data: artisanData } = await supabase
      .from('profiles_artisan').select('*').eq('user_id', user.id).single()
    if (!artisanData) { router.push('/pro/login'); return }
    setArtisan(artisanData)
    setSettingsForm({ company_name: artisanData.company_name || '', phone: artisanData.phone || '', bio: (artisanData.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim() })

    const { data: bData } = await supabase.from('bookings').select('*, services(name)')
      .eq('artisan_id', artisanData.id).order('booking_date', { ascending: false }).limit(50)
    setBookings(bData || [])

    const { data: sData } = await supabase.from('services').select('*').eq('artisan_id', artisanData.id)
    setServices(sData || [])

    try {
      const r = await fetch(`/api/availability?artisan_id=${artisanData.id}`)
      const j = await r.json()
      setAvailability(j.data || [])
    } catch { setAvailability([]) }

    try {
      const r = await fetch(`/api/availability-services?artisan_id=${artisanData.id}`)
      const j = await r.json()
      if (j.data) setDayServices(j.data)
    } catch {}

    const savedAA = localStorage.getItem(`fixit_auto_accept_${artisanData.id}`)
    if (savedAA !== null) setAutoAccept(savedAA === 'true')

    // Compliance wallet
    try {
      const saved = localStorage.getItem(`fixit_compliance_${artisanData.id}`)
      if (saved) setComplianceDocs(JSON.parse(saved))
    } catch {}

    // Service price ranges
    try {
      const savedRanges = localStorage.getItem(`fixit_service_ranges_${artisanData.id}`)
      if (savedRanges) setServiceRanges(JSON.parse(savedRanges))
    } catch {}

    // Load enabled modules
    try {
      const savedModules = localStorage.getItem(`fixit_modules_artisan_${artisanData.id}`)
      if (savedModules) {
        setEnabledModules(JSON.parse(savedModules))
      } else {
        const defaults: Record<string, boolean> = {}
        ARTISAN_MODULES.forEach(m => { defaults[m.key] = m.default })
        setEnabledModules(defaults)
      }
    } catch {}

    setLoading(false)
  }

  const pendingBookings = bookings.filter(b => b.status === 'pending')
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed')
  const completedBookings = bookings.filter(b => b.status === 'completed')
  const totalRevenue = completedBookings.reduce((s, b) => s + (b.price_ttc || 0), 0)

  const todayBookings = bookings.filter(b => b.booking_date === new Date().toISOString().split('T')[0])
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()
  const tomorrowBookings = bookings.filter(b => b.booking_date === tomorrowStr)
  const selectedDateBookings = bookings.filter(b => b.booking_date === selectedDate)

  const initials = artisan?.company_name
    ? artisan.company_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'PR'

  const updateBookingStatus = async (id: string, status: string) => {
    const updates: any = { status }
    if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
    if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()
    if (status === 'completed') updates.completed_at = new Date().toISOString()
    await supabase.from('bookings').update(updates).eq('id', id)
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))

    // Notifications locales (uniquement sur app native)
    if (status === 'confirmed') {
      const booking = bookings.find(b => b.id === id)
      if (booking) {
        import('@/lib/notifications').then(({ scheduleInterventionReminder }) => {
          scheduleInterventionReminder({
            id: booking.id,
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            address: booking.address,
            serviceName: booking.services?.name,
          }).catch(() => {})
        }).catch(() => {})
      }
    }
    if (status === 'cancelled') {
      import('@/lib/notifications').then(({ cancelInterventionReminder }) => {
        cancelInterventionReminder(id).catch(() => {})
      }).catch(() => {})
    }
  }

  // ── Compliance Wallet ──
  const saveCompliance = (docs: ComplianceDoc[]) => {
    if (!artisan) return
    setComplianceDocs(docs)
    localStorage.setItem(`fixit_compliance_${artisan.id}`, JSON.stringify(docs))
  }

  const addComplianceDoc = () => {
    const doc: ComplianceDoc = {
      id: Date.now().toString(),
      type: complianceForm.type,
      dateExpiration: complianceForm.dateExpiration || null,
      notes: complianceForm.notes,
      addedAt: new Date().toISOString(),
      // Include OCR data if available
      ...(ocrResult ? {
        ocrData: {
          detectedType: ocrResult.detectedType,
          confidence: ocrResult.confidence,
          scannedAt: ocrResult.scannedAt,
        },
        photoDataUrl: ocrResult.photoDataUrl,
        verificationStatus: 'pending' as const,
      } : {}),
    }
    // Remplacer si même type existe déjà
    const updated = [...complianceDocs.filter(d => d.type !== complianceForm.type), doc]
    saveCompliance(updated)
    setShowComplianceModal(false)
    setComplianceForm({ type: 'decennale', dateExpiration: '', notes: '' })
    setOcrResult(null)
  }

  const processOCR = async (file: File) => {
    setOcrScanning(true)
    try {
      // Convert to base64 for display
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })

      const result: any = {
        scannedAt: new Date().toISOString(),
        photoDataUrl: dataUrl,
      }

      // Detect document type from filename/metadata
      const fileName = file.name.toLowerCase()
      if (fileName.includes('decennale') || fileName.includes('rc')) {
        result.detectedType = 'decennale'
        result.confidence = 85
      } else if (fileName.includes('kbis')) {
        result.detectedType = 'kbis'
        result.confidence = 90
      } else if (fileName.includes('urssaf') || fileName.includes('vigilance')) {
        result.detectedType = 'urssaf'
        result.confidence = 85
      } else if (fileName.includes('rge') || fileName.includes('qualibat') || fileName.includes('qualit')) {
        result.detectedType = 'rge'
        result.confidence = 80
      } else if (fileName.includes('carte') || fileName.includes('btp')) {
        result.detectedType = 'carte_pro'
        result.confidence = 80
      } else if (fileName.includes('passeport') || fileName.includes('prevention')) {
        result.detectedType = 'passeport_prev'
        result.confidence = 85
      } else if (fileName.includes('assurance') || fileName.includes('responsabilite')) {
        result.detectedType = 'assurance_pro'
        result.confidence = 80
      }

      // Suggest expiration based on detected type renewal period
      const typeInfo = COMPLIANCE_TYPES.find(t => t.key === result.detectedType)
      if (typeInfo && typeInfo.renewYears > 0) {
        const suggestedDate = new Date()
        suggestedDate.setFullYear(suggestedDate.getFullYear() + typeInfo.renewYears)
        result.suggestedExpiration = suggestedDate.toISOString().split('T')[0]
      }

      setOcrResult(result)

      // Auto-fill the form with detected data
      if (result.detectedType) {
        setComplianceForm(prev => ({
          ...prev,
          type: result.detectedType,
          dateExpiration: result.suggestedExpiration || prev.dateExpiration,
        }))
      }
    } catch (err) {
      console.error('OCR error:', err)
    } finally {
      setOcrScanning(false)
    }
  }

  const deleteComplianceDoc = (id: string) => {
    saveCompliance(complianceDocs.filter(d => d.id !== id))
  }

  const copyComplianceProfile = () => {
    const nom = artisan?.company_name || artisan?.user_metadata?.full_name || 'Artisan'
    const lines = [`📋 Profil compliance — ${nom}`, `Date : ${new Date().toLocaleDateString('fr-FR')}`, '']
    COMPLIANCE_TYPES.forEach(ct => {
      const doc = complianceDocs.find(d => d.type === ct.key)
      if (doc) {
        const status = getComplianceStatus(doc)
        const icon = status === 'valid' ? '✅' : status === 'expiring' ? '⚠️' : '❌'
        const expiry = doc.dateExpiration ? `Exp. ${new Date(doc.dateExpiration).toLocaleDateString('fr-FR')}` : 'Sans date'
        lines.push(`${icon} ${ct.icon} ${ct.label} — ${expiry}`)
      }
    })
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setComplianceCopied(true)
      setTimeout(() => setComplianceCopied(false), 2500)
    }).catch(() => {})
  }

  const expiringCount = complianceDocs.filter(d => ['expiring', 'expired'].includes(getComplianceStatus(d))).length

  // ── Module helpers ──
  const isModuleEnabled = (key: string): boolean => {
    if (Object.keys(enabledModules).length === 0) {
      return ARTISAN_MODULES.find(m => m.key === key)?.default ?? true
    }
    return enabledModules[key] ?? ARTISAN_MODULES.find(m => m.key === key)?.default ?? true
  }

  const toggleModule = (key: string) => {
    const updated = { ...enabledModules, [key]: !isModuleEnabled(key) }
    setEnabledModules(updated)
    if (artisan) localStorage.setItem(`fixit_modules_artisan_${artisan.id}`, JSON.stringify(updated))
  }

  // ── Démarrer le suivi GPS temps réel ──
  const startTracking = (booking: any) => {
    if (!isModuleEnabled('gps_tracking')) return
    if (activeTrackings[booking.id]) return // déjà actif
    const token = `TRK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    setActiveTrackings(prev => ({ ...prev, [booking.id]: token }))

    const sendPosition = (status: string = 'en_route') => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition((pos) => {
        const clientName = booking.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
        const nom = artisan?.company_name || artisan?.user_metadata?.full_name || 'Artisan'
        const initiales = nom.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        fetch('/api/tracking/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            status,
            artisanNom: nom,
            artisanInitiales: initiales,
            missionTitre: booking.services?.name || 'Intervention',
            missionAdresse: booking.address || '',
            photos: [],
            startedAt: new Date().toISOString(),
          }),
        }).catch(() => {})
      }, () => {
        // Sans GPS : envoyer quand même sans coordonnées
        const nom = artisan?.company_name || artisan?.user_metadata?.full_name || 'Artisan'
        fetch('/api/tracking/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token, lat: null, lng: null, status,
            artisanNom: nom,
            artisanInitiales: nom.charAt(0).toUpperCase(),
            missionTitre: booking.services?.name || 'Intervention',
            missionAdresse: booking.address || '',
            photos: [], startedAt: new Date().toISOString(),
          }),
        }).catch(() => {})
      })
    }

    // Envoi immédiat puis toutes les 30s
    sendPosition('en_route')
    const intervalId = setInterval(() => {
      const currentToken = activeTrackings[booking.id] || token
      if (!currentToken) { clearInterval(intervalId); return }
      sendPosition('en_route')
    }, 30000)
    trackingIntervalsRef.current[booking.id] = intervalId
  }

  const updateTrackingStatus = (bookingId: string, status: string) => {
    const token = activeTrackings[bookingId]
    if (!token) return
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return
    const nom = artisan?.company_name || artisan?.user_metadata?.full_name || 'Artisan'
    fetch('/api/tracking/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token, lat: null, lng: null, status,
        artisanNom: nom,
        artisanInitiales: nom.charAt(0).toUpperCase(),
        missionTitre: booking.services?.name || 'Intervention',
        missionAdresse: booking.address || '',
        photos: [],
      }),
    }).catch(() => {})
  }

  const stopTracking = (bookingId: string) => {
    const intervalId = trackingIntervalsRef.current[bookingId]
    if (intervalId) { clearInterval(intervalId); delete trackingIntervalsRef.current[bookingId] }
    const token = activeTrackings[bookingId]
    if (token) {
      fetch(`/api/tracking/${token}`, { method: 'DELETE' }).catch(() => {})
    }
    setActiveTrackings(prev => { const n = { ...prev }; delete n[bookingId]; return n })
  }

  const copyTrackingLink = (bookingId: string) => {
    const token = activeTrackings[bookingId]
    if (!token) return
    const url = `${window.location.origin}/tracking/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setTrackingCopied(bookingId)
      setTimeout(() => setTrackingCopied(null), 2500)
    }).catch(() => {
      // Fallback pour les vieux navigateurs
      const el = document.createElement('textarea')
      el.value = url; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
      setTrackingCopied(bookingId)
      setTimeout(() => setTrackingCopied(null), 2500)
    })
  }

  const createRdv = async () => {
    if (!artisan || !newRdv.date || !newRdv.time || !newRdv.service_id) return
    setSavingRdv(true)
    const service = services.find(s => s.id === newRdv.service_id)
    const status = autoAccept ? 'confirmed' : 'pending'
    const { data, error } = await supabase.from('bookings').insert({
      artisan_id: artisan.id,
      service_id: newRdv.service_id,
      status,
      booking_date: newRdv.date,
      booking_time: newRdv.time,
      duration_minutes: service?.duration_minutes || 60,
      address: newRdv.address || 'À définir',
      notes: newRdv.client_name ? `Client: ${newRdv.client_name}. ${newRdv.notes || ''}` : newRdv.notes,
      price_ht: service?.price_ht,
      price_ttc: service?.price_ttc,
    }).select('*, services(name)').single()
    setSavingRdv(false)
    if (!error && data) {
      setBookings(prev => [data, ...prev])
      setShowNewRdv(false)
      setNewRdv({ client_name: '', service_id: '', date: '', time: '', address: '', notes: '' })

      // Programmer rappel J-1 si RDV directement confirmé (auto-accept activé)
      if (status === 'confirmed') {
        const service = services.find(s => s.id === newRdv.service_id)
        import('@/lib/notifications').then(({ scheduleInterventionReminder }) => {
          scheduleInterventionReminder({
            id: data.id,
            booking_date: data.booking_date,
            booking_time: data.booking_time,
            address: data.address,
            serviceName: service?.name,
          }).catch(() => {})
        }).catch(() => {})
      }
    }
  }

  const saveSettings = async () => {
    if (!artisan) return
    setSavingSettings(true)
    await supabase.from('profiles_artisan').update({ company_name: settingsForm.company_name, phone: settingsForm.phone }).eq('id', artisan.id)
    setArtisan({ ...artisan, ...settingsForm })
    setSavingSettings(false)
  }

  const saveMotif = async () => {
    if (!artisan || !motifForm.name) return
    setSavingMotif(true)
    const pMin = motifForm.price_min ? parseFloat(motifForm.price_min) : 0
    const pMax = motifForm.price_max ? parseFloat(motifForm.price_max) : pMin
    const avgTTC = pMin && pMax ? (pMin + pMax) / 2 : pMin || pMax || 0
    const priceHt = avgTTC / 1.2
    const { data } = await supabase.from('services').insert({
      artisan_id: artisan.id,
      name: motifForm.name,
      duration_minutes: 60,
      price_ht: Math.round(priceHt * 100) / 100,
      price_ttc: Math.round(avgTTC * 100) / 100,
      active: true,
    }).select().single()
    setSavingMotif(false)
    if (data) {
      setServices(prev => [...prev, data])
      // Save price range + duration estimate + pricing unit in localStorage
      const updatedRanges = { ...serviceRanges, [data.id]: { priceMin: pMin, priceMax: pMax, durationEstimate: motifForm.duration_estimate || '', pricingUnit: motifForm.pricing_unit || 'forfait' } }
      setServiceRanges(updatedRanges)
      localStorage.setItem(`fixit_service_ranges_${artisan.id}`, JSON.stringify(updatedRanges))
      setMotifModal(false)
      setMotifForm({ name: '', duration_estimate: '', price_min: '', price_max: '', pricing_unit: 'forfait' })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/pro/login')
  }

  const toggleAutoAccept = () => {
    const v = !autoAccept
    setAutoAccept(v)
    if (artisan) localStorage.setItem(`fixit_auto_accept_${artisan.id}`, String(v))
  }

  const toggleDayAvailability = async (day: number) => {
    if (!artisan) return
    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artisan_id: artisan.id, day_of_week: day })
    })
    const r = await fetch(`/api/availability?artisan_id=${artisan.id}`)
    const { data } = await r.json()
    setAvailability(data || [])
  }

  // Calendar helpers
  const getMonthDays = () => {
    const [y, m] = selectedDate.substring(0, 7).split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6
    const days: Date[] = []
    const start = new Date(firstDay)
    start.setDate(start.getDate() - startDay)
    for (let i = 0; i < 35; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return { days, m }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFC107]">
        <div className="text-4xl font-black text-gray-900 mb-6">FIXIT</div>
        <div className="animate-spin w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full" />
        <p className="text-gray-900 font-medium mt-4 text-sm">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 safe-area-pt" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ─── Toast notification in-app artisan ─── */}
      {notifToast && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-fade-in">
          <div className="bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3">
            <span className="text-xl flex-shrink-0">📣</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{notifToast.title}</p>
              {notifToast.body && <p className="text-xs text-gray-300 mt-0.5 truncate">{notifToast.body}</p>}
            </div>
            <button onClick={() => setNotifToast(null)} className="text-gray-400 text-lg leading-none flex-shrink-0">×</button>
          </div>
        </div>
      )}

      {/* ─── Proof of Work Overlay ─── */}
      {proofBooking && (
        <ProofOfWork
          booking={proofBooking}
          artisan={artisan}
          onClose={() => setProofBooking(null)}
          onComplete={async (proof) => {
            // 1. Mettre à jour le statut booking
            await updateBookingStatus(proofBooking.id, 'completed')

            // 2. Si booking a un syndic_id → envoyer rapport automatiquement
            const syndicId = proofBooking?.syndic_id || proofBooking?.metadata?.syndic_id
            if (syndicId && artisan) {
              try {
                // Extraire les dataUrl des photos pour l'envoi
                const photosBase64Before = proof.beforePhotos.slice(0, 3).map(p => p.dataUrl)
                const photosBase64After = proof.afterPhotos.slice(0, 3).map(p => p.dataUrl)
                const firstGps = proof.beforePhotos.find(p => p.lat && p.lng) || proof.afterPhotos.find(p => p.lat && p.lng)

                await fetch('/api/syndic/mission-report', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    syndic_id: syndicId,
                    artisan_id: artisan.user_id,
                    artisan_name: artisan.company_name,
                    booking_id: proofBooking.id,
                    mission_description: proofBooking.notes || proofBooking.services?.name || 'Intervention',
                    description: proof.description,
                    photos_before: photosBase64Before,
                    photos_after: photosBase64After,
                    signature_svg: proof.signature,
                    gps: firstGps ? `${firstGps.lat},${firstGps.lng}` : (proof.gpsLat && proof.gpsLng ? `${proof.gpsLat},${proof.gpsLng}` : null),
                    completed_at: proof.completedAt || new Date().toISOString(),
                    immeuble: proofBooking?.address || '',
                  }),
                })
              } catch (e) {
                console.warn('Auto-rapport syndic failed:', e)
              }
            }

            setProofBooking(null)
          }}
        />
      )}

      {/* ─── New RDV Modal ─── */}
      {showNewRdv && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Nouveau RDV</h2>
              <button onClick={() => setShowNewRdv(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Client</label>
                <input value={newRdv.client_name} onChange={e => setNewRdv(p => ({ ...p, client_name: e.target.value }))}
                  placeholder="Nom du client" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Motif *</label>
                <select value={newRdv.service_id} onChange={e => setNewRdv(p => ({ ...p, service_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]">
                  <option value="">Choisir un motif</option>
                  {services.filter(s => s.active).map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {serviceRanges[s.id] ? `${serviceRanges[s.id].priceMin}€ - ${serviceRanges[s.id].priceMax}€` : formatPrice(s.price_ttc)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Date *</label>
                  <input type="date" value={newRdv.date} onChange={e => setNewRdv(p => ({ ...p, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Heure *</label>
                  <input type="time" value={newRdv.time} onChange={e => setNewRdv(p => ({ ...p, time: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Adresse</label>
                <input value={newRdv.address} onChange={e => setNewRdv(p => ({ ...p, address: e.target.value }))}
                  placeholder="Adresse d'intervention" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
                <textarea value={newRdv.notes} onChange={e => setNewRdv(p => ({ ...p, notes: e.target.value }))}
                  rows={2} placeholder="Notes additionnelles" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] resize-none" />
              </div>
              <button disabled={savingRdv || !newRdv.date || !newRdv.time || !newRdv.service_id} onClick={createRdv}
                className="w-full bg-[#FFC107] text-gray-900 py-4 rounded-xl font-bold text-sm disabled:opacity-50">
                {savingRdv ? 'Création...' : '+ Créer le RDV'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Motif Modal ─── */}
      {motifModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Nouveau motif</h2>
              <button onClick={() => setMotifModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Nom du motif *</label>
                <input value={motifForm.name} onChange={e => setMotifForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Installation prise électrique" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Durée estimée <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input type="text" value={motifForm.duration_estimate} onChange={e => setMotifForm(p => ({ ...p, duration_estimate: e.target.value }))}
                  placeholder="Ex : 1h à 3h, ~2h, une demi-journée…" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                <p className="text-[10px] text-gray-400 mt-1">Libre — visible par le client uniquement si rempli.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Prix TTC (€)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={motifForm.price_min} onChange={e => setMotifForm(p => ({ ...p, price_min: e.target.value }))}
                    placeholder="Min" className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                  <span className="text-gray-400 text-sm font-medium">à</span>
                  <input type="number" value={motifForm.price_max} onChange={e => setMotifForm(p => ({ ...p, price_max: e.target.value }))}
                    placeholder="Max" className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                  <span className="text-xs text-gray-400 flex-shrink-0">€</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Fourchette tarifaire. Le prix exact sera ajusté selon le devis.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Unité de facturation</label>
                <select value={motifForm.pricing_unit} onChange={e => setMotifForm(p => ({ ...p, pricing_unit: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]">
                  <option value="forfait">Forfait</option>
                  <option value="heure">À l&apos;heure</option>
                  <option value="m2">Au m²</option>
                </select>
              </div>
              <button disabled={savingMotif || !motifForm.name} onClick={saveMotif}
                className="w-full bg-[#FFC107] text-gray-900 py-4 rounded-xl font-bold text-sm disabled:opacity-50">
                {savingMotif ? 'Création...' : '+ Créer le motif'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────── HOME ────────────────────────── */}
      {activeTab === 'home' && (
        <div>
          {/* Hero header */}
          <div className="bg-gradient-to-br from-[#FFC107] to-[#FFD54F] px-5 pt-12 pb-6 safe-area-pt">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-black text-gray-900">FIXIT <span className="text-sm font-bold bg-gray-900 text-[#FFC107] px-2 py-0.5 rounded-full ml-1">PRO</span></div>
                <div className="text-sm font-medium text-gray-800 mt-0.5">Bonjour, {artisan?.company_name?.split(' ')[0]} 👋</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center text-[#FFC107] font-bold text-lg shadow-lg">
                {initials}
              </div>
            </div>

            {/* Today alert */}
            {todayBookings.length > 0 && (
              <div className="bg-white/80 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{todayBookings.length} RDV aujourd&apos;hui</div>
                  <div className="text-xs text-gray-600">Prochain : {todayBookings[0]?.booking_time?.substring(0, 5)} — {todayBookings[0]?.services?.name}</div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-gray-900">{pendingBookings.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">RDV en attente</div>
                {pendingBookings.length > 0 && <div className="text-[10px] text-red-500 font-semibold mt-1">Action requise</div>}
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-green-600">{formatPrice(totalRevenue)}</div>
                <div className="text-xs text-gray-500 mt-0.5">Chiffre d&apos;affaires</div>
                <div className="text-[10px] text-gray-400 mt-1">{completedBookings.length} terminées</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-blue-600">{confirmedBookings.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Confirmés</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-black text-amber-500">⭐ {artisan?.rating_avg || '5.0'}</div>
                <div className="text-xs text-gray-500 mt-0.5">Note moyenne</div>
                <div className="text-[10px] text-gray-400 mt-1">{artisan?.rating_count || 0} avis</div>
              </div>
            </div>

            {/* Score de ponctualité */}
            {isModuleEnabled('ponctualite') && (() => {
              const total = bookings.filter(b => ['completed', 'confirmed', 'cancelled'].includes(b.status)).length
              const rate = total > 0 ? Math.round((completedBookings.length / total) * 100) : 0
              if (total < 3) return null
              const isGood = rate >= 90
              const isMedium = rate >= 70 && rate < 90
              return (
                <div className={`rounded-2xl p-4 flex items-center gap-4 ${isGood ? 'bg-green-50 border border-green-200' : isMedium ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isGood ? 'bg-green-100' : isMedium ? 'bg-amber-100' : 'bg-red-100'}`}>
                    <span className={`text-2xl font-black ${isGood ? 'text-green-700' : isMedium ? 'text-amber-700' : 'text-red-700'}`}>{rate}%</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800">⏱️ Score de ponctualité</div>
                    <div className="text-xs text-gray-500 mt-0.5">{completedBookings.length}/{total} interventions réalisées</div>
                    {isGood && <div className="text-[10px] text-green-600 font-semibold mt-1">🏅 Excellent — Badge visible par vos clients</div>}
                    {isMedium && <div className="text-[10px] text-amber-600 font-semibold mt-1">⚡ Bon score — Continuez ainsi !</div>}
                    {!isGood && !isMedium && <div className="text-[10px] text-red-600 font-semibold mt-1">⚠️ À améliorer pour fidéliser vos clients</div>}
                  </div>
                </div>
              )
            })()}

            {/* Quick actions */}
            <div>
              <div className="text-sm font-bold text-gray-700 mb-3">Actions rapides</div>
              <div className="grid grid-cols-4 gap-2">
                <QuickBtn icon="📅" label="Nouveau RDV" onClick={() => setShowNewRdv(true)} />
                <QuickBtn icon="🔧" label="Motif" onClick={() => setMotifModal(true)} />
                <QuickBtn icon="📝" label="Devis" onClick={() => { setDevisForm({ client: '', service: '', description: '', montantHT: '', tva: '20', validite: '30' }); setDevisGenere(null); setShowDevisModal(true) }} />
                <QuickBtn icon="💬" label="Demandes" onClick={() => setActiveTab('interventions')} />
              </div>
            </div>

            {/* Revenus du mois */}
            {isModuleEnabled('revenus') && (() => {
              const now = new Date()
              const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const lastMonth = now.getMonth() === 0
                ? `${now.getFullYear() - 1}-12`
                : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`
              const completedThisMonth = bookings.filter(b => b.status === 'completed' && b.booking_date?.startsWith(thisMonth))
              const completedLastMonth = bookings.filter(b => b.status === 'completed' && b.booking_date?.startsWith(lastMonth))
              const revThisMonth = completedThisMonth.reduce((s: number, b: any) => s + (b.services?.price_ttc || 0), 0)
              const revLastMonth = completedLastMonth.reduce((s: number, b: any) => s + (b.services?.price_ttc || 0), 0)
              const diff = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : 0
              const topServices = services
                .map(s => ({ ...s, count: bookings.filter(b => b.service_id === s.id && b.status === 'completed').length }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
              return (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-gray-700">💰 Revenus</div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)}% vs mois préc.
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-green-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-0.5">Ce mois</div>
                      <div className="text-xl font-black text-green-600">{formatPrice(revThisMonth)}</div>
                      <div className="text-[10px] text-gray-400">{completedThisMonth.length} interv.</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs text-gray-500 mb-0.5">Mois préc.</div>
                      <div className="text-xl font-black text-gray-600">{formatPrice(revLastMonth)}</div>
                      <div className="text-[10px] text-gray-400">{completedLastMonth.length} interv.</div>
                    </div>
                  </div>
                  {topServices.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 font-medium mb-2">Top services</div>
                      <div className="space-y-1.5">
                        {topServices.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-4">{i + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-800 truncate">{s.name}</div>
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">{s.count} fois · {serviceRanges[s.id] ? `${serviceRanges[s.id].priceMin}€ - ${serviceRanges[s.id].priceMax}€` : formatPrice(s.price_ttc)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {topServices.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-2">
                      Complétez des interventions pour voir vos stats
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Pending bookings alert */}
            {pendingBookings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⏳</span>
                  <span className="font-bold text-amber-800 text-sm">{pendingBookings.length} demande(s) en attente</span>
                </div>
                {pendingBookings.slice(0, 2).map(b => {
                  const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                  return (
                    <div key={b.id} className="bg-white rounded-xl p-3 mb-2 border border-amber-100 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-900">{clientName}</div>
                        <div className="text-xs text-gray-500">{b.services?.name} · {formatDateFR(b.booking_date)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">✓</button>
                        <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="bg-red-100 text-red-500 px-3 py-1.5 rounded-lg text-xs font-semibold">✕</button>
                      </div>
                    </div>
                  )
                })}
                {pendingBookings.length > 2 && (
                  <button onClick={() => setActiveTab('interventions')} className="text-amber-600 text-xs font-semibold mt-1">
                    Voir tout ({pendingBookings.length}) →
                  </button>
                )}
              </div>
            )}

            {/* Today's bookings */}
            {todayBookings.length > 0 && (
              <div>
                <div className="text-sm font-bold text-gray-700 mb-3">Aujourd&apos;hui</div>
                <div className="space-y-2">
                  {todayBookings.map(b => (
                    <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} trackingToken={activeTrackings[b.id]} onStartTracking={() => startTracking(b)} onStopTracking={() => stopTracking(b.id)} onCopyLink={() => copyTrackingLink(b.id)} linkCopied={trackingCopied === b.id} />
                  ))}
                </div>
              </div>
            )}

            {/* Tomorrow */}
            {tomorrowBookings.length > 0 && (
              <div>
                <div className="text-sm font-bold text-gray-700 mb-3">Demain</div>
                <div className="space-y-2">
                  {tomorrowBookings.map(b => (
                    <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} trackingToken={activeTrackings[b.id]} onStartTracking={() => startTracking(b)} onStopTracking={() => stopTracking(b.id)} onCopyLink={() => copyTrackingLink(b.id)} linkCopied={trackingCopied === b.id} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────── AGENDA ────────────────────────── */}
      {activeTab === 'agenda' && (
        <div>
          <div className="bg-white px-4 pt-12 pb-4 safe-area-pt border-b border-gray-100 sticky top-0 z-10">
            <div className="text-lg font-bold text-gray-900 mb-3">📅 Agenda</div>

            {/* Mini Calendar */}
            <div className="rounded-2xl overflow-hidden border border-gray-100">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                <button onClick={() => {
                  const d = new Date(selectedDate); d.setMonth(d.getMonth() - 1)
                  setSelectedDate(d.toISOString().split('T')[0])
                }} className="text-gray-400 text-lg p-1">◀</button>
                <span className="text-sm font-semibold text-gray-700 capitalize">
                  {new Date(selectedDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => {
                  const d = new Date(selectedDate); d.setMonth(d.getMonth() + 1)
                  setSelectedDate(d.toISOString().split('T')[0])
                }} className="text-gray-400 text-lg p-1">▶</button>
              </div>

              <div className="grid grid-cols-7 bg-gray-50">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 bg-white p-1">
                {getMonthDays().days.map((day, i) => {
                  const ds = day.toISOString().split('T')[0]
                  const isToday = ds === new Date().toISOString().split('T')[0]
                  const isSelected = ds === selectedDate
                  const isCurrentMonth = ds.substring(0, 7) === selectedDate.substring(0, 7)
                  const hasBookings = bookings.filter(b => b.booking_date === ds).length > 0
                  return (
                    <button key={i} onClick={() => setSelectedDate(ds)}
                      className={`aspect-square flex flex-col items-center justify-center rounded-xl m-0.5 relative transition-all ${
                        isSelected ? 'bg-[#FFC107] text-gray-900 font-bold' :
                        isToday ? 'bg-amber-50 text-[#FFC107] font-bold' :
                        isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                      <span className="text-[11px]">{day.getDate()}</span>
                      {hasBookings && !isSelected && (
                        <span className="w-1 h-1 rounded-full bg-[#FFC107] mt-0.5 absolute bottom-1" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Selected day bookings */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-gray-700 capitalize">
                {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <button onClick={() => setShowNewRdv(true)} className="bg-[#FFC107] text-gray-900 text-xs font-bold px-3 py-1.5 rounded-xl">
                + RDV
              </button>
            </div>

            {selectedDateBookings.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-sm text-gray-400">Aucun RDV ce jour</div>
                <button onClick={() => setShowNewRdv(true)} className="mt-3 text-[#FFC107] text-sm font-semibold">+ Créer un RDV</button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateBookings.sort((a, b) => a.booking_time?.localeCompare(b.booking_time)).map(b => (
                  <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} trackingToken={activeTrackings[b.id]} onStartTracking={() => startTracking(b)} onStopTracking={() => stopTracking(b.id)} onCopyLink={() => copyTrackingLink(b.id)} linkCopied={trackingCopied === b.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────── INTERVENTIONS ────────────────────────── */}
      {activeTab === 'interventions' && (
        <div>
          <div className="bg-white px-4 pt-12 pb-4 safe-area-pt border-b border-gray-100">
            <div className="text-lg font-bold text-gray-900">🔧 Interventions</div>
            <div className="text-xs text-gray-400 mt-0.5">{bookings.length} au total</div>
          </div>

          <div className="p-4">
            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {['Tous', 'En attente', 'Confirmés', 'Terminés'].map((f) => {
                const count = f === 'Tous' ? bookings.length :
                  f === 'En attente' ? pendingBookings.length :
                  f === 'Confirmés' ? confirmedBookings.length :
                  completedBookings.length
                return (
                  <button key={f} className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                    {f}
                    {count > 0 && <span className="bg-[#FFC107] text-gray-900 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">{count}</span>}
                  </button>
                )
              })}
            </div>

            {/* Proof of work info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 flex items-start gap-3">
              <span className="text-lg">📸</span>
              <div>
                <div className="font-semibold text-blue-800 text-xs">Proof of Work activé</div>
                <div className="text-[11px] text-blue-600 mt-0.5">Pour chaque intervention confirmée, documentez avant/après avec photos + signature client</div>
              </div>
            </div>

            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">📭</div>
                <div className="text-sm font-medium text-gray-500">Aucune intervention</div>
                <button onClick={() => setShowNewRdv(true)} className="mt-4 bg-[#FFC107] text-gray-900 px-5 py-2.5 rounded-xl text-sm font-bold">
                  + Créer un RDV
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => (
                  <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} trackingToken={activeTrackings[b.id]} onStartTracking={() => startTracking(b)} onStopTracking={() => stopTracking(b.id)} onCopyLink={() => copyTrackingLink(b.id)} linkCopied={trackingCopied === b.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────── DOCUMENTS ────────────────────────── */}
      {activeTab === 'documents' && (
        <div>
          <div className="bg-white px-4 pt-12 pb-4 safe-area-pt border-b border-gray-100">
            <div className="text-lg font-bold text-gray-900">📄 Documents & Preuves</div>
          </div>

          <div className="p-4 space-y-4">
            {/* Proof of work section */}
            <div>
              <div className="text-sm font-bold text-gray-700 mb-3">📸 Preuves d&apos;intervention</div>
              {(() => {
                const proofs = JSON.parse(localStorage.getItem('fixit_proofs') || '[]') as InterventionProof[]
                if (proofs.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
                      <div className="text-4xl mb-2">📸</div>
                      <div className="text-sm text-gray-400">Aucune preuve archivée</div>
                      <div className="text-xs text-gray-300 mt-1">Les preuves apparaîtront après vos interventions</div>
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
                          <div className="text-xs text-gray-400">{p.completedAt ? new Date(p.completedAt).toLocaleDateString('fr-FR') : ''}</div>
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
                            <img key={j} src={ph.dataUrl} alt="" className="w-14 h-14 object-cover rounded-xl flex-shrink-0" />
                          ))}
                        </div>
                      )}
                      {/* Rapport fin de chantier PDF */}
                      {isModuleEnabled('rapport_pdf') && (
                      <button
                        onClick={() => {
                          import('jspdf').then(({ default: jsPDF }) => {
                            const doc = new jsPDF()
                            const nom = artisan?.company_name || 'Artisan'
                            const bk = bookings.find(b => b.id === p.bookingId)
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
                            doc.text(`Date : ${p.completedAt ? new Date(p.completedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}`, 15, 47)
                            doc.text(`Service : ${bk?.services?.name || 'Intervention'}`, 15, 54)
                            doc.text(`Adresse : ${bk?.address || 'N/A'}`, 15, 61)
                            if (p.gpsLat && p.gpsLng) doc.text(`GPS : ${p.gpsLat.toFixed(5)}, ${p.gpsLng.toFixed(5)}`, 15, 68)
                            if (bk?.price_ttc) doc.text(`Montant TTC : ${(bk.price_ttc / 100 >= 1 ? bk.price_ttc : bk.price_ttc).toFixed(2)} \u20AC`, 15, 75)
                            // Description
                            let y = 88
                            if (p.description) {
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
                                doc.text(`${photo.label} \u2014 ${new Date(photo.timestamp).toLocaleString('fr-FR')}`, 15, y + 63)
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
                            doc.text(`G\u00E9n\u00E9r\u00E9 par VitFix Pro \u2014 ${new Date().toLocaleString('fr-FR')}`, 15, 285)
                            doc.text('Document \u00E0 valeur probante \u2014 GPS + horodatage + signature client', 15, 290)
                            doc.save(`Rapport_${bk?.services?.name?.replace(/\s+/g, '_') || 'chantier'}_${p.completedAt ? new Date(p.completedAt).toISOString().split('T')[0] : 'date'}.pdf`)
                          }).catch(() => alert('Erreur lors de la g\u00E9n\u00E9ration du PDF'))
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
                  <div className="text-sm text-gray-400">Aucun motif créé</div>
                  <button onClick={() => setMotifModal(true)} className="mt-3 text-[#FFC107] text-sm font-semibold">+ Créer un motif</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-400">{serviceRanges[s.id]?.durationEstimate ? `⏱️ ${serviceRanges[s.id].durationEstimate}` : ''}{serviceRanges[s.id]?.durationEstimate && serviceRanges[s.id]?.pricingUnit ? ' · ' : ''}{serviceRanges[s.id]?.pricingUnit || 'forfait'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-green-600">
                          {serviceRanges[s.id] ? `${serviceRanges[s.id].priceMin}€ - ${serviceRanges[s.id].priceMax}€` : formatPrice(s.price_ttc)}
                        </div>
                        <div className={`text-[10px] font-medium ${s.active ? 'text-green-500' : 'text-gray-400'}`}>
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
                    <div className="text-xs text-gray-400 mt-0.5">Format FEC (Art. L47 A-1 du LPF)</div>
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
                <div className="text-[10px] text-gray-400 text-center mt-2">
                  {completedBookings.length} écriture(s) de vente · Format compatible DGFiP
                </div>
              </div>
            </div>
            )}

            {/* ── Compliance Wallet OCR ── */}
            {isModuleEnabled('compliance_wallet') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-gray-700">🪪 Documents pro</div>
                  {expiringCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{expiringCount} alerte{expiringCount > 1 ? 's' : ''}</span>
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
                      <span className="text-xs font-semibold text-gray-600">Score compliance</span>
                      <span className={`text-lg font-black ${healthColor}`}>{healthScore}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${healthBg} h-2 rounded-full transition-all duration-500`} style={{ width: `${healthScore}%` }} />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1.5">{validCount}/{requiredTypes.length} documents valides</div>
                  </div>
                )
              })()}

              {/* Passeport Prevention Alert Banner */}
              {!complianceDocs.find(d => d.type === 'passeport_prev') && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-3.5 mb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🎓</span>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-purple-800">Passeport Prevention obligatoire</div>
                      <div className="text-[10px] text-purple-600 mt-0.5">Obligatoire depuis mars 2026 pour tous les artisans du BTP. Ajoutez-le maintenant.</div>
                      <button
                        onClick={() => { setOcrResult(null); setComplianceForm(f => ({ ...f, type: 'passeport_prev' })); setShowComplianceModal(true) }}
                        className="mt-2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-lg"
                      >
                        + Ajouter mon Passeport
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {complianceDocs.length === 0 ? (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
                  <div className="text-3xl mb-2">🪪</div>
                  <div className="text-sm font-semibold text-gray-700 mb-1">Portefeuille vide</div>
                  <div className="text-xs text-gray-400 mb-3">Scannez ou ajoutez vos documents pro pour ne jamais rater une echeance</div>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => { setOcrResult(null); setShowComplianceModal(true); setTimeout(() => ocrInputRef.current?.click(), 300) }} className="bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1">
                      📷 Scanner un document
                    </button>
                    <button onClick={() => { setOcrResult(null); setShowComplianceModal(true) }} className="text-[#FFC107] text-xs font-bold px-4 py-2 border border-amber-200 rounded-xl">+ Manuel</button>
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
                            <img src={doc.photoDataUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <span className="text-xl flex-shrink-0">{ct.icon}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                            {ct.label}
                            {doc.ocrData && (
                              <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">OCR</span>
                            )}
                          </div>
                          {doc.dateExpiration && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Exp : {new Date(doc.dateExpiration).toLocaleDateString('fr-FR')}
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
      )}

      {/* ── Modal Compliance OCR ── */}
      {showComplianceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setShowComplianceModal(false); setOcrResult(null) }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Ajouter un document</h3>
              <button onClick={() => { setShowComplianceModal(false); setOcrResult(null) }} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">

              {/* OCR Scan Button */}
              <div className="relative">
                <input
                  ref={ocrInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) processOCR(file)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => ocrInputRef.current?.click()}
                  disabled={ocrScanning}
                  className={`w-full py-3 rounded-xl text-sm font-bold border-2 border-dashed transition-all flex items-center justify-center gap-2 ${
                    ocrScanning ? 'border-blue-300 bg-blue-50 text-blue-500' :
                    ocrResult ? 'border-green-300 bg-green-50 text-green-700' :
                    'border-blue-300 bg-blue-50 text-blue-600 active:bg-blue-100'
                  }`}
                >
                  {ocrScanning ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Analyse en cours...
                    </>
                  ) : ocrResult ? (
                    <>
                      ✅ Document scanne — Rescanner
                    </>
                  ) : (
                    <>
                      📷 Scanner un document
                    </>
                  )}
                </button>
              </div>

              {/* OCR Preview & Results */}
              {ocrResult && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <div className="flex gap-3 items-start">
                    {ocrResult.photoDataUrl && (
                      <div className="w-16 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <img src={ocrResult.photoDataUrl} alt="Document scanne" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {ocrResult.detectedType ? (
                        <>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-bold text-gray-700">Type detecte :</span>
                            <span className="text-xs font-bold text-blue-600">
                              {COMPLIANCE_TYPES.find(ct => ct.key === ocrResult.detectedType)?.label || ocrResult.detectedType}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-gray-500">Confiance :</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                              <div
                                className={`h-1.5 rounded-full ${ocrResult.confidence >= 80 ? 'bg-green-500' : ocrResult.confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${ocrResult.confidence || 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-gray-600">{ocrResult.confidence}%</span>
                          </div>
                          {ocrResult.suggestedExpiration && (
                            <div className="text-[10px] text-gray-500">
                              Expiration suggeree : {new Date(ocrResult.suggestedExpiration).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-amber-600 font-semibold">
                          ⚠️ Type non reconnu — selectionnez manuellement
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Document Type Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Type de document
                  {ocrResult?.detectedType && <span className="text-blue-500 font-normal ml-1">(auto-detecte)</span>}
                </label>
                <select
                  value={complianceForm.type}
                  onChange={e => setComplianceForm(f => ({ ...f, type: e.target.value as ComplianceType }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  {COMPLIANCE_TYPES.map(ct => (
                    <option key={ct.key} value={ct.key}>{ct.icon} {ct.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Date d&apos;expiration
                  {ocrResult?.suggestedExpiration && <span className="text-blue-500 font-normal ml-1">(suggeree)</span>}
                </label>
                <input
                  type="date"
                  value={complianceForm.dateExpiration}
                  onChange={e => setComplianceForm(f => ({ ...f, dateExpiration: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <input
                  type="text"
                  value={complianceForm.notes}
                  onChange={e => setComplianceForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="N° de police, assureur..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setShowComplianceModal(false); setOcrResult(null) }} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold">Annuler</button>
              <button onClick={addComplianceDoc} className="flex-1 py-2.5 bg-amber-400 text-gray-900 rounded-xl text-sm font-bold flex items-center justify-center gap-1">
                {ocrResult ? '📷 Enregistrer (OCR)' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────── SETTINGS ────────────────────────── */}
      {activeTab === 'settings' && (
        <div>
          <div className="bg-white px-4 pt-12 pb-6 safe-area-pt border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFC107] to-[#FFD54F] flex items-center justify-center text-2xl font-black text-gray-900 shadow-lg">
                {initials}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{artisan?.company_name}</div>
                <div className="text-xs text-gray-400">{artisan?.category || 'Artisan'}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-amber-400 text-sm">⭐</span>
                  <span className="text-xs font-semibold text-gray-600">{artisan?.rating_avg || '5.0'}/5</span>
                  <span className="text-xs text-gray-400">({artisan?.rating_count || 0} avis)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Auto-accept toggle */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-gray-900">Acceptation automatique</div>
                  <div className="text-xs text-gray-400 mt-0.5">Confirme les RDV automatiquement</div>
                </div>
                <button
                  onClick={toggleAutoAccept}
                  className={`w-12 h-7 rounded-full transition-all relative ${autoAccept ? 'bg-[#FFC107]' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${autoAccept ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* Modules personnalisables */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-sm text-gray-900">🧩 Mes modules</div>
                <span className="text-[10px] text-gray-400">{ARTISAN_MODULES.filter(m => isModuleEnabled(m.key)).length}/{ARTISAN_MODULES.length} actifs</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">Activez uniquement les fonctionnalités dont vous avez besoin</p>
              <div className="space-y-2">
                {ARTISAN_MODULES.map(mod => {
                  const enabled = isModuleEnabled(mod.key)
                  return (
                    <div key={mod.key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${enabled ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      <span className="text-xl flex-shrink-0">{mod.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{mod.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{mod.description}</div>
                      </div>
                      <button
                        onClick={() => toggleModule(mod.key)}
                        className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-[#FFC107]' : 'bg-gray-200'}`}
                      >
                        <div className="bg-white rounded-full shadow absolute transition-all" style={{ width: '18px', height: '18px', left: enabled ? '22px' : '2px', top: '3px' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Availability */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="font-semibold text-sm text-gray-900 mb-3">🕐 Jours travaillés</div>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 0].map(day => {
                  const isActive = availability.some(a => a.day_of_week === day)
                  return (
                    <button key={day} onClick={() => toggleDayAvailability(day)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive ? 'bg-[#FFC107] text-gray-900' : 'bg-gray-100 text-gray-400'
                      }`}>
                      {DAY_NAMES[day]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Profile form */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="font-semibold text-sm text-gray-900 mb-3">⚙️ Informations</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nom de l&apos;entreprise</label>
                  <input value={settingsForm.company_name} onChange={e => setSettingsForm(p => ({ ...p, company_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Téléphone</label>
                  <input value={settingsForm.phone} onChange={e => setSettingsForm(p => ({ ...p, phone: e.target.value }))}
                    type="tel" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Bio / Description</label>
                  <textarea value={settingsForm.bio} onChange={e => setSettingsForm(p => ({ ...p, bio: e.target.value }))}
                    rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] resize-none" />
                </div>
                <button disabled={savingSettings} onClick={saveSettings}
                  className="w-full bg-[#FFC107] text-gray-900 py-3 rounded-xl font-bold text-sm disabled:opacity-50">
                  {savingSettings ? 'Enregistrement...' : 'Sauvegarder'}
                </button>
              </div>
            </div>

            {/* Logout */}
            <button onClick={handleLogout}
              className="w-full border border-red-200 text-red-500 py-3 rounded-2xl font-semibold text-sm bg-red-50">
              🚪 Déconnexion
            </button>

            <div className="text-center text-[10px] text-gray-300 pb-2">
              VitFix Pro v1.0 · {artisan?.siret && `SIRET ${artisan.siret}`}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Devis Rapide ── */}
      {showDevisModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowDevisModal(false)}>
          <div className="bg-white rounded-t-3xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-5 pb-2 pt-1 flex items-center justify-between border-b border-gray-100">
              <div className="text-base font-bold text-gray-900">📝 Devis rapide</div>
              <button onClick={() => setShowDevisModal(false)} className="text-gray-400 text-xl p-1">✕</button>
            </div>

            {!devisGenere ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Client *</label>
                  <input
                    type="text"
                    value={devisForm.client}
                    onChange={e => setDevisForm(p => ({ ...p, client: e.target.value }))}
                    placeholder="Nom du client"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Prestation *</label>
                  <input
                    type="text"
                    value={devisForm.service}
                    onChange={e => setDevisForm(p => ({ ...p, service: e.target.value }))}
                    placeholder="ex: Remplacement robinet, peinture plafond…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Description (optionnel)</label>
                  <textarea
                    value={devisForm.description}
                    onChange={e => setDevisForm(p => ({ ...p, description: e.target.value }))}
                    rows={2}
                    placeholder="Détails de l'intervention…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Montant HT (€) *</label>
                    <input
                      type="number"
                      value={devisForm.montantHT}
                      onChange={e => setDevisForm(p => ({ ...p, montantHT: e.target.value }))}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">TVA (%)</label>
                    <select
                      value={devisForm.tva}
                      onChange={e => setDevisForm(p => ({ ...p, tva: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] bg-white"
                    >
                      <option value="0">0% (exonéré)</option>
                      <option value="5.5">5,5% (réduit)</option>
                      <option value="10">10% (intermédiaire)</option>
                      <option value="20">20% (normal)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Validité (jours)</label>
                  <select
                    value={devisForm.validite}
                    onChange={e => setDevisForm(p => ({ ...p, validite: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107] bg-white"
                  >
                    <option value="15">15 jours</option>
                    <option value="30">30 jours</option>
                    <option value="60">60 jours</option>
                    <option value="90">90 jours</option>
                  </select>
                </div>

                {/* Preview montants */}
                {devisForm.montantHT && parseFloat(devisForm.montantHT) > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Montant HT</span>
                      <span className="font-semibold">{formatPrice(parseFloat(devisForm.montantHT))}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>TVA {devisForm.tva}%</span>
                      <span className="font-semibold">{formatPrice(parseFloat(devisForm.montantHT) * parseFloat(devisForm.tva) / 100)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                      <span>Total TTC</span>
                      <span className="text-green-600">{formatPrice(parseFloat(devisForm.montantHT) * (1 + parseFloat(devisForm.tva) / 100))}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!devisForm.client || !devisForm.service || !devisForm.montantHT) return
                    const ht = parseFloat(devisForm.montantHT)
                    const tva = parseFloat(devisForm.tva)
                    const ttc = ht * (1 + tva / 100)
                    const dateDevis = new Date().toLocaleDateString('fr-FR')
                    const dateValidite = new Date(Date.now() + parseInt(devisForm.validite) * 86400000).toLocaleDateString('fr-FR')
                    const num = `DEV-${Date.now().toString().slice(-6)}`
                    const texte = `📋 DEVIS ${num}
━━━━━━━━━━━━━━━━━━━━━
Artisan : ${artisan?.company_name || 'VitFix Pro'}
Date : ${dateDevis}
Valide jusqu&apos;au : ${dateValidite}
━━━━━━━━━━━━━━━━━━━━━
Client : ${devisForm.client}
Prestation : ${devisForm.service}${devisForm.description ? `\nDétail : ${devisForm.description}` : ''}
━━━━━━━━━━━━━━━━━━━━━
Montant HT : ${ht.toFixed(2)} €
TVA (${tva}%) : ${(ht * tva / 100).toFixed(2)} €
Total TTC : ${ttc.toFixed(2)} €
━━━━━━━━━━━━━━━━━━━━━
Ce devis est valable ${devisForm.validite} jours.
Pour accepter, répondez OUI.`
                    setDevisGenere(texte)
                  }}
                  disabled={!devisForm.client || !devisForm.service || !devisForm.montantHT}
                  className="w-full bg-[#FFC107] disabled:opacity-40 text-gray-900 font-bold py-4 rounded-2xl text-sm active:scale-95 transition"
                >
                  ✨ Générer le devis
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="text-xs text-green-700 font-bold bg-green-100 px-3 py-2 rounded-xl">
                  ✅ Devis généré — prêt à envoyer
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{devisGenere}</pre>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      if (devisGenere) {
                        navigator.clipboard?.writeText(devisGenere).then(() => {
                          setDevisCopied(true)
                          setTimeout(() => setDevisCopied(false), 2000)
                        })
                      }
                    }}
                    className={`py-3 rounded-2xl text-sm font-bold border transition active:scale-95 ${devisCopied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700'}`}
                  >
                    {devisCopied ? '✅ Copié !' : '📋 Copier'}
                  </button>
                  <a
                    href={`sms:?body=${encodeURIComponent(devisGenere || '')}`}
                    className="py-3 rounded-2xl text-sm font-bold bg-blue-600 text-white text-center active:scale-95 transition"
                  >
                    💬 Envoyer SMS
                  </a>
                </div>
                <a
                  href={`mailto:?subject=Devis%20-%20${encodeURIComponent(devisForm.service)}&body=${encodeURIComponent(devisGenere || '')}`}
                  className="block w-full py-3 rounded-2xl text-sm font-bold border border-purple-200 text-purple-700 bg-purple-50 text-center active:scale-95 transition"
                >
                  📧 Envoyer par email
                </a>
                <button
                  onClick={() => { setDevisGenere(null) }}
                  className="w-full text-gray-400 text-sm py-2"
                >
                  ← Modifier le devis
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav active={activeTab} onChange={setActiveTab} pendingCount={pendingBookings.length} notifCount={artisanNotifs.filter(n => !n.read).length} />
    </div>
  )
}
