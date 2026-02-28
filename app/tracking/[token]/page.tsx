'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface TrackingData {
  token: string
  lat: number | null
  lng: number | null
  status: 'en_route' | 'sur_place' | 'en_cours' | 'termine'
  artisan_nom: string
  artisan_initiales: string
  mission_titre: string
  mission_adresse: string
  photos: string[]
  started_at: string
  updated_at: string
}

const STEPS = [
  { key: 'en_route',   icon: '🚗', label: 'En route',       desc: "L'artisan est en chemin vers vous" },
  { key: 'sur_place',  icon: '📍', label: 'Sur place',       desc: "L'artisan est arrivé" },
  { key: 'en_cours',   icon: '🔧', label: 'En cours',        desc: "Travaux en cours d'exécution" },
  { key: 'termine',    icon: '✅', label: 'Terminé',         desc: "Intervention terminée avec succès" },
]

function formatElapsed(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return "à l'instant"
  if (diff < 60) return `il y a ${diff} min`
  return `il y a ${Math.floor(diff / 60)}h${diff % 60 > 0 ? `${diff % 60}` : ''}`
}

export default function TrackingPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracking/${params.token}`, { cache: 'no-store' })
      if (res.status === 404) { setError('Lien de suivi introuvable'); setLoading(false); return }
      if (res.status === 410) { setError('Ce lien a expiré (24h max)'); setLoading(false); return }
      if (!res.ok) { setError('Erreur de chargement'); setLoading(false); return }
      const json: TrackingData = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Impossible de se connecter')
    } finally {
      setLoading(false)
    }
  }, [params.token])

  useEffect(() => {
    fetchTracking()
    intervalRef.current = setInterval(() => {
      fetchTracking()
      setTick(t => t + 1) // force re-render pour le timer "il y a Xs"
    }, 12000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchTracking])

  // Tick toutes les 10s pour afficher le compteur "Mis à jour il y a..."
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 10000)
    return () => clearInterval(t)
  }, [])

  const currentIdx = data ? STEPS.findIndex(s => s.key === data.status) : 0
  const currentStep = STEPS[Math.max(0, currentIdx)]

  const mapUrl = data?.lat && data?.lng && data.status !== 'termine'
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${data.lng - 0.007},${data.lat - 0.005},${data.lng + 0.007},${data.lat + 0.005}&layer=mapnik&marker=${data.lat},${data.lng}`
    : null

  const statusBg = {
    en_route: 'from-blue-500 to-blue-600',
    sur_place: 'from-amber-500 to-amber-600',
    en_cours:  'from-orange-500 to-orange-600',
    termine:   'from-green-500 to-green-600',
  }[data?.status ?? 'en_route']

  /* ─── ÉTATS ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-3xl animate-pulse">🔧</div>
        <p className="text-gray-500 font-medium text-sm">Chargement du suivi en direct…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-4">
        <div className="text-4xl">😕</div>
        <h2 className="text-lg font-bold text-gray-800">{error}</h2>
        <p className="text-sm text-gray-500 text-center">Demandez à votre artisan un nouveau lien de suivi.</p>
        <div className="mt-4 text-xs text-gray-500">Powered by <span className="font-bold text-amber-500">Fixit</span></div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* ─── Header gradient ─── */}
      <div className={`bg-gradient-to-br ${statusBg} text-white px-5 pt-10 pb-8`}>
        {/* Logo + badge */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-bold tracking-widest opacity-80 uppercase">Fixit • Suivi</span>
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
            🔴 En direct
          </span>
        </div>

        {/* Artisan */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-2xl font-bold">
            {data.artisan_initiales || data.artisan_nom.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">{data.artisan_nom}</h1>
            <p className="text-sm opacity-80">{data.mission_titre}</p>
          </div>
        </div>

        {/* Status */}
        <div className="mt-5 bg-white/15 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">{currentStep.icon}</span>
          <div>
            <p className="font-bold text-base">{currentStep.label}</p>
            <p className="text-xs opacity-80">{currentStep.desc}</p>
          </div>
          {data.updated_at && (
            <span className="ml-auto text-xs opacity-70 flex-shrink-0">
              {formatElapsed(data.updated_at)}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4 mt-4">

        {/* ─── Timeline ─── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Progression</p>
          <div className="flex items-start">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    i < currentIdx  ? 'bg-green-500 border-green-500 text-white' :
                    i === currentIdx ? 'bg-amber-400 border-amber-400 text-white shadow-lg scale-110' :
                                      'bg-gray-100 border-gray-200 text-gray-500'
                  }`}>
                    {i < currentIdx ? '✓' : step.icon}
                  </div>
                  <span className={`text-[10px] mt-1.5 text-center leading-tight font-semibold ${
                    i <= currentIdx ? 'text-gray-700' : 'text-gray-500'
                  }`}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mb-4 mx-0.5 transition-all ${
                    i < currentIdx ? 'bg-green-400' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Carte ─── */}
        {mapUrl ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-gray-700">Position en direct</span>
              </div>
              <span className="text-xs text-gray-500">OpenStreetMap</span>
            </div>
            <iframe
              src={mapUrl}
              width="100%"
              height="230"
              style={{ border: 0, display: 'block' }}
              title="Position artisan"
              loading="lazy"
            />
          </div>
        ) : data.status === 'termine' ? null : (
          <div className="bg-gray-100 rounded-2xl p-6 text-center">
            <p className="text-gray-500 text-sm">📍 Localisation non disponible</p>
          </div>
        )}

        {/* ─── Adresse ─── */}
        {data.mission_adresse && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-base flex-shrink-0">🏠</div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Lieu d'intervention</p>
              <p className="text-sm font-semibold text-gray-800">{data.mission_adresse}</p>
            </div>
          </div>
        )}

        {/* ─── Photos ─── */}
        {data.photos && data.photos.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📸 Photos d'intervention ({data.photos.length})</p>
            <div className="grid grid-cols-2 gap-2">
              {data.photos.map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-36 object-cover rounded-xl"
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Terminé ─── */}
        {data.status === 'termine' && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h3 className="font-bold text-green-800 text-lg">Intervention terminée !</h3>
            <p className="text-sm text-green-600 mt-1">
              Commencée {formatElapsed(data.started_at)}
            </p>
            <p className="text-xs text-green-500 mt-3">
              Un rapport complet vous sera envoyé par votre syndic.
            </p>
          </div>
        )}

        {/* ─── Refresh info ─── */}
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <p className="text-xs text-gray-500">Actualisation automatique toutes les 12 secondes</p>
        </div>

        {/* ─── Footer ─── */}
        <div className="text-center pt-2">
          <p className="text-xs text-gray-300">
            Suivi fourni par{' '}
            <span className="font-bold text-amber-400">Fixit</span>
            {' '}• Plateforme syndic & artisans
          </p>
        </div>
      </div>
    </div>
  )
}
