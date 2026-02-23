'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'home' | 'agenda' | 'interventions' | 'documents' | 'settings'
type ProofStep = 'before' | 'during' | 'after' | 'signature'

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
function BookingCard({ booking, onProof, onStatusChange }: {
  booking: any
  onProof: () => void
  onStatusChange: (id: string, status: string) => void
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
  const [motifForm, setMotifForm] = useState({ name: '', duration_minutes: 60, price_ttc: 0, pricing_unit: 'forfait' })
  const [savingMotif, setSavingMotif] = useState(false)
  const [autoAccept, setAutoAccept] = useState(false)
  const [dayServices, setDayServices] = useState<Record<string, string[]>>({})
  const [artisanNotifs, setArtisanNotifs] = useState<{ id: string; title: string; body: string; type: string; read: boolean; created_at: string }[]>([])
  const [notifToast, setNotifToast] = useState<{ title: string; body: string } | null>(null)

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
    const priceHt = motifForm.price_ttc / 1.2
    const { data } = await supabase.from('services').insert({
      artisan_id: artisan.id,
      name: motifForm.name,
      duration_minutes: motifForm.duration_minutes,
      price_ht: Math.round(priceHt * 100) / 100,
      price_ttc: motifForm.price_ttc,
      pricing_unit: motifForm.pricing_unit,
      active: true,
    }).select().single()
    setSavingMotif(false)
    if (data) {
      setServices(prev => [...prev, data])
      setMotifModal(false)
      setMotifForm({ name: '', duration_minutes: 60, price_ttc: 0, pricing_unit: 'forfait' })
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
                    <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price_ttc)}</option>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Durée (min)</label>
                  <input type="number" value={motifForm.duration_minutes} onChange={e => setMotifForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Prix TTC (€)</label>
                  <input type="number" value={motifForm.price_ttc} onChange={e => setMotifForm(p => ({ ...p, price_ttc: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FFC107]" />
                </div>
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

            {/* Quick actions */}
            <div>
              <div className="text-sm font-bold text-gray-700 mb-3">Actions rapides</div>
              <div className="grid grid-cols-4 gap-2">
                <QuickBtn icon="📅" label="Nouveau RDV" onClick={() => setShowNewRdv(true)} />
                <QuickBtn icon="🔧" label="Motif" onClick={() => setMotifModal(true)} />
                <QuickBtn icon="📊" label="Agenda" onClick={() => setActiveTab('agenda')} />
                <QuickBtn icon="💬" label="Demandes" onClick={() => setActiveTab('interventions')} />
              </div>
            </div>

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
                    <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} />
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
                    <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} />
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
                  <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} />
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
                  <BookingCard key={b.id} booking={b} onProof={() => setProofBooking(b)} onStatusChange={updateBookingStatus} />
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
                        <div className="text-xs text-gray-400">{s.duration_minutes} min · {s.pricing_unit}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-green-600">{formatPrice(s.price_ttc)}</div>
                        <div className={`text-[10px] font-medium ${s.active ? 'text-green-500' : 'text-gray-400'}`}>
                          {s.active ? 'Actif' : 'Inactif'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Bottom Navigation */}
      <BottomNav active={activeTab} onChange={setActiveTab} pendingCount={pendingBookings.length} notifCount={artisanNotifs.filter(n => !n.read).length} />
    </div>
  )
}
