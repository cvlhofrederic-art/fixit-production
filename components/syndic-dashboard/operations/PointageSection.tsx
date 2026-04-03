'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { Immeuble, PointageSession, PointageActif } from '../types'
import { haversineMetres, RAYON_DETECTION_DEFAUT } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

export default function PointageSection({ immeubles, user, onUpdateImmeuble }: { immeubles: Immeuble[]; user: User; onUpdateImmeuble: (imm: Immeuble) => void }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const uid = user?.id || 'demo'
  const SESSIONS_KEY = `fixit_pointage_sessions_${uid}`
  const ACTIF_KEY = `fixit_pointage_actif_${uid}`

  // Immeubles avec géoloc activée et coordonnées renseignées
  const immeublesGeoActifs = immeubles.filter(i => i.geolocActivee && i.latitude != null && i.longitude != null)

  const [sessions, setSessions] = useState<PointageSession[]>(() => {
    try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]') } catch { return [] }
  })
  const [sessionActive, setSessionActive] = useState<PointageActif | null>(() => {
    try { return JSON.parse(localStorage.getItem(ACTIF_KEY) || 'null') } catch { return null }
  })

  const [selectedImmId, setSelectedImmId] = useState('')
  const [pointageMode, setPointageMode] = useState<'manuel' | 'geo'>('manuel')
  const [activeTab, setActiveTab] = useState<'pointer' | 'historique'>('pointer')
  const [notes, setNotes] = useState('')

  // History filters
  const [histChip, setHistChip] = useState<'tout' | 'ce_mois' | 'manuel' | 'geo'>('tout')
  const [histSearch, setHistSearch] = useState('')

  // Géolocalisation
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [geoPosition, setGeoPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState('')
  const [proches, setProches] = useState<{ immeuble: Immeuble; distance: number; rayon: number }[]>([])
  const watchRef = useRef<number | null>(null)

  // Géocodage en cours (par immeuble id)
  const [geocodingId, setGeocodingId] = useState<string | null>(null)

  // Timer live
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const saveSessions = (s: PointageSession[]) => { setSessions(s); localStorage.setItem(SESSIONS_KEY, JSON.stringify(s)) }

  // Géocoder l'adresse d'un immeuble via API adresse.data.gouv.fr
  const geocoderImmeuble = async (imm: Immeuble) => {
    const adresse = `${imm.adresse} ${imm.codePostal} ${imm.ville}`.trim()
    if (!adresse) return
    setGeocodingId(imm.id)
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`, {
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates
        onUpdateImmeuble({ ...imm, latitude: lat, longitude: lng, geolocActivee: true, rayonDetection: imm.rayonDetection || RAYON_DETECTION_DEFAUT })
      }
    } catch (geoErr) {
      console.warn('[PointageSection] Geocoding failed for:', adresse, geoErr instanceof Error ? geoErr.message : geoErr)
    }
    setGeocodingId(null)
  }

  const startGeo = () => {
    if (!navigator.geolocation) { setGeoError(t('syndicDash.pointage.geoUnavailable')); setGeoStatus('error'); return }
    setGeoStatus('loading')
    setGeoError('')
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoPosition({ lat, lng })
        setGeoStatus('ok')
        const p: { immeuble: Immeuble; distance: number; rayon: number }[] = []
        immeublesGeoActifs.forEach(imm => {
          const rayon = imm.rayonDetection || RAYON_DETECTION_DEFAUT
          const d = haversineMetres(lat, lng, imm.latitude!, imm.longitude!)
          if (d <= rayon) p.push({ immeuble: imm, distance: Math.round(d), rayon })
        })
        setProches(p.sort((a, b) => a.distance - b.distance))
      },
      (err) => { setGeoStatus('error'); setGeoError(err.code === 1 ? t('syndicDash.pointage.permissionDenied') : t('syndicDash.pointage.positionUnavailable')) },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
  }

  const stopGeo = () => {
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null }
    setGeoStatus('idle')
    setGeoPosition(null)
    setProches([])
  }

  const demarrerDepuis = (imm: Immeuble, mode: 'manuel' | 'geo') => {
    const actif: PointageActif = {
      immeubleId: imm.id,
      immeubleNom: imm.nom,
      immeubleAdresse: `${imm.adresse}, ${imm.codePostal} ${imm.ville}`,
      dateDebut: new Date().toISOString(),
      mode,
    }
    setSessionActive(actif)
    localStorage.setItem(ACTIF_KEY, JSON.stringify(actif))
    setSelectedImmId('')
    if (mode === 'geo') stopGeo()
  }

  const arreter = () => {
    if (!sessionActive) return
    const dateFin = new Date().toISOString()
    const dureeSecondes = Math.round((new Date(dateFin).getTime() - new Date(sessionActive.dateDebut).getTime()) / 1000)
    saveSessions([{ id: Date.now().toString(), ...sessionActive, dateFin, dureeSecondes }, ...sessions])
    setSessionActive(null)
    localStorage.removeItem(ACTIF_KEY)
    setNotes('')
    setActiveTab('historique')
  }

  const deleteSession = (id: string) => saveSessions(sessions.filter(s => s.id !== id))

  const fmtDuree = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
    return `${m}m`
  }

  const formatHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  const elapsedSec = sessionActive ? Math.round((now - new Date(sessionActive.dateDebut).getTime()) / 1000) : 0
  const chronoDisplay = `${String(Math.floor(elapsedSec / 3600)).padStart(2, '0')}:${String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`

  // Monthly stats
  const monthSessions = useMemo(() => {
    const n = new Date()
    const monthStart = new Date(n.getFullYear(), n.getMonth(), 1)
    return sessions.filter(s => new Date(s.dateDebut) >= monthStart)
  }, [sessions])

  const totalMonthSeconds = monthSessions.reduce((sum, s) => sum + s.dureeSecondes, 0)
  const monthVisitCount = monthSessions.length
  const avgSeconds = monthVisitCount > 0 ? Math.round(totalMonthSeconds / monthVisitCount) : 0

  const fmtHourMin = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  }

  // Filtered sessions for history
  const histFilteredSessions = useMemo(() => {
    let filtered = sessions
    if (histChip === 'ce_mois') {
      const n = new Date()
      const monthStart = new Date(n.getFullYear(), n.getMonth(), 1)
      filtered = filtered.filter(s => new Date(s.dateDebut) >= monthStart)
    } else if (histChip === 'manuel') {
      filtered = filtered.filter(s => s.mode === 'manuel')
    } else if (histChip === 'geo') {
      filtered = filtered.filter(s => s.mode === 'geo')
    }
    if (histSearch) {
      const q = histSearch.toLowerCase()
      filtered = filtered.filter(s => s.immeubleNom.toLowerCase().includes(q) || s.immeubleAdresse?.toLowerCase().includes(q))
    }
    return filtered
  }, [sessions, histChip, histSearch])

  const histTotalSeconds = histFilteredSessions.reduce((sum, s) => sum + s.dureeSecondes, 0)

  // CSV Export
  const exportCSV = () => {
    const header = 'Date,Résidence,Adresse,Arrivée,Départ,Durée,Méthode\n'
    const rows = histFilteredSessions.map(s => {
      const d = new Date(s.dateDebut)
      const fin = new Date(s.dateFin)
      return `${d.toLocaleDateString(dateFmtLocale)},${s.immeubleNom},"${s.immeubleAdresse}",${formatHHMM(d)},${formatHHMM(fin)},${fmtDuree(s.dureeSecondes)},${s.mode}`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pointage_terrain_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 860 }}>
      {/* ── Hero ── */}
      <div className="sd-pt-hero">
        <div>
          <div className="sd-pt-hero-title">📍 {t('syndicDash.pointage.title')}</div>
          <div className="sd-pt-hero-sub">Enregistrez vos présences et durées sur les copropriétés</div>
        </div>
        <div className="sd-pt-view-toggle">
          <button
            className={`sd-pt-vt-btn ${activeTab === 'pointer' ? 'active' : ''}`}
            onClick={() => setActiveTab('pointer')}
          >
            ▶ {t('syndicDash.pointage.tabPointer')}
          </button>
          <button
            className={`sd-pt-vt-btn ${activeTab === 'historique' ? 'active' : ''}`}
            onClick={() => setActiveTab('historique')}
          >
            📋 {t('syndicDash.pointage.tabHistory')}
          </button>
        </div>
      </div>

      {/* ════════ VUE POINTER ════════ */}
      {activeTab === 'pointer' && (
        <>
          {/* Stats rapides */}
          <div className="sd-pt-stats-row">
            <div className="sd-pt-stat-card">
              <div className="sd-pt-stat-label">Ce mois</div>
              <div className="sd-pt-stat-value">{fmtHourMin(totalMonthSeconds)}</div>
              <div className="sd-pt-stat-sub">Temps total terrain</div>
            </div>
            <div className="sd-pt-stat-card">
              <div className="sd-pt-stat-label">Visites</div>
              <div className="sd-pt-stat-value">{monthVisitCount}</div>
              <div className="sd-pt-stat-sub">Interventions ce mois</div>
            </div>
            <div className="sd-pt-stat-card">
              <div className="sd-pt-stat-label">Moyenne</div>
              <div className="sd-pt-stat-value">{monthVisitCount > 0 ? fmtHourMin(avgSeconds) : '—'}</div>
              <div className="sd-pt-stat-sub">Par visite terrain</div>
            </div>
          </div>

          {/* Live Timer (visible quand session active) */}
          {sessionActive && (
            <div className="sd-pt-live-timer">
              <div className="sd-pt-lt-pulse" />
              <div className="sd-pt-lt-info">
                <div className="sd-pt-lt-label">Pointage en cours</div>
                <div className="sd-pt-lt-site">{sessionActive.immeubleNom}</div>
              </div>
              <div className="sd-pt-lt-time">{chronoDisplay}</div>
            </div>
          )}

          {/* ── Carte Pointage ── */}
          <div className="sd-pt-card">
            {/* Method tabs (masqués quand session active) */}
            {!sessionActive && (
              <div className="sd-pt-method-tabs">
                <button
                  className={`sd-pt-method-tab ${pointageMode === 'manuel' ? 'active' : ''}`}
                  onClick={() => { setPointageMode('manuel'); stopGeo() }}
                >
                  <span style={{ fontSize: 15 }}>✋</span> {t('syndicDash.pointage.modeManual')}
                </button>
                <button
                  className={`sd-pt-method-tab ${pointageMode === 'geo' ? 'active' : ''}`}
                  onClick={() => { setPointageMode('geo'); if (geoStatus === 'idle') startGeo() }}
                >
                  <span style={{ fontSize: 15 }}>📡</span> {t('syndicDash.pointage.modeGeo')}
                </button>
              </div>
            )}

            {/* ── Panel Manuel ── */}
            {(pointageMode === 'manuel' || sessionActive) && (
              <div className="sd-pt-card-body">
                <div className="sd-pt-form-field">
                  <label className="sd-pt-field-label">{t('syndicDash.pointage.coproLabel')}</label>
                  {!sessionActive ? (
                    <select
                      className="sd-pt-field-select"
                      value={selectedImmId}
                      onChange={e => setSelectedImmId(e.target.value)}
                    >
                      <option value="">{t('syndicDash.pointage.selectCopro')}</option>
                      {immeubles.map(imm => (
                        <option key={imm.id} value={imm.id}>{imm.nom} — {imm.adresse}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      padding: '12px 16px', background: 'var(--sd-cream)', border: '1px solid var(--sd-border)',
                      borderRadius: 10, fontSize: 13, color: 'var(--sd-navy)', fontWeight: 500
                    }}>
                      {sessionActive.immeubleNom}
                      {sessionActive.mode === 'geo' && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--sd-ink-3)' }}>📡 Géoloc</span>}
                    </div>
                  )}
                </div>

                <div className="sd-pt-time-row">
                  <div>
                    <label className="sd-pt-field-label">Heure d&apos;arrivée</label>
                    <input
                      type="time"
                      className="sd-pt-field-input"
                      value={sessionActive ? formatHHMM(new Date(sessionActive.dateDebut)) : ''}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="sd-pt-field-label">Heure de départ</label>
                    <input
                      type="time"
                      className="sd-pt-field-input"
                      value=""
                      readOnly
                      placeholder="En cours..."
                    />
                  </div>
                </div>

                <div className="sd-pt-form-field">
                  <label className="sd-pt-field-label">
                    Notes de visite{' '}
                    <span style={{ color: 'var(--sd-ink-3)', fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }}>(optionnel)</span>
                  </label>
                  <textarea
                    className="sd-pt-field-textarea"
                    placeholder="Observations, travaux constatés, remarques…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <button
                  className={`sd-pt-start-btn ${sessionActive ? 'running' : ''}`}
                  disabled={!sessionActive && !selectedImmId}
                  onClick={() => {
                    if (!sessionActive) {
                      const imm = immeubles.find(i => i.id === selectedImmId)
                      if (imm) demarrerDepuis(imm, 'manuel')
                    } else {
                      arreter()
                    }
                  }}
                >
                  <span style={{ fontSize: 18 }}>{sessionActive ? '⏹' : '▶'}</span>
                  {sessionActive ? t('syndicDash.pointage.stopPointing') : t('syndicDash.pointage.startPointing')}
                </button>
              </div>
            )}

            {/* ── Panel Géolocalisation ── */}
            {!sessionActive && pointageMode === 'geo' && (
              <>
                <div className="sd-pt-card-body" style={{ paddingBottom: 0 }}>
                  {/* GPS Status Banner */}
                  <div className="sd-pt-geo-info">
                    <span style={{ fontSize: 16 }}>📡</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 1 }}>
                        {geoStatus === 'loading' && t('syndicDash.pointage.geoLocating')}
                        {geoStatus === 'ok' && 'Détection automatique active'}
                        {geoStatus === 'error' && (geoError || 'Erreur GPS')}
                        {geoStatus === 'idle' && t('syndicDash.pointage.gpsInactive')}
                      </div>
                      <div style={{ color: 'var(--sd-ink-2)' }}>
                        {geoStatus === 'ok' && 'Le pointage démarre dès votre arrivée dans le périmètre défini.'}
                        {geoStatus === 'idle' && 'Activez le GPS pour détecter les copropriétés à proximité.'}
                        {geoStatus === 'loading' && 'Acquisition de la position en cours...'}
                        {geoStatus === 'error' && 'Vérifiez les autorisations de localisation.'}
                      </div>
                    </div>
                    {geoStatus === 'idle' ? (
                      <button
                        onClick={startGeo}
                        disabled={immeublesGeoActifs.length === 0}
                        className="sd-pt-hist-export-btn"
                        style={{ flexShrink: 0 }}
                      >
                        {t('syndicDash.pointage.startGps')}
                      </button>
                    ) : (
                      <button
                        onClick={stopGeo}
                        className="sd-pt-hist-export-btn"
                        style={{ flexShrink: 0, color: 'var(--sd-red)' }}
                      >
                        {t('syndicDash.pointage.stopGps')}
                      </button>
                    )}
                  </div>

                  {/* Nearby buildings */}
                  {geoStatus === 'ok' && proches.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      {proches.map(({ immeuble: imm, distance }) => (
                        <div key={imm.id} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 18px', borderRadius: 10,
                          border: '1px solid rgba(26,122,110,0.3)', background: 'var(--sd-teal-soft)',
                          marginBottom: 8
                        }}>
                          <div style={{ flex: 1 }}>
                            <div className="sd-pt-geo-name">{imm.nom}</div>
                            <div className="sd-pt-geo-addr">{imm.adresse} · <span style={{ color: 'var(--sd-teal)', fontWeight: 600 }}>{distance}m</span></div>
                          </div>
                          <button
                            onClick={() => demarrerDepuis(imm, 'geo')}
                            className="sd-pt-start-btn"
                            style={{ width: 'auto', padding: '8px 18px', fontSize: 13, boxShadow: 'none' }}
                          >
                            ▶ {t('syndicDash.pointage.start')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {geoStatus === 'ok' && proches.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--sd-ink-3)' }}>
                      {t('syndicDash.pointage.noCoproNearby')}
                      <div style={{ fontSize: 11, marginTop: 4 }}>{immeublesGeoActifs.length} {t('syndicDash.pointage.coproWithGeo')}</div>
                    </div>
                  )}

                  {immeublesGeoActifs.length === 0 && (
                    <div style={{
                      background: 'var(--sd-amber-soft)', border: '1px solid rgba(212,131,10,0.2)',
                      borderRadius: 10, padding: '13px 16px', marginTop: 12,
                      fontSize: 12, color: 'var(--sd-amber)'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>📍 {t('syndicDash.pointage.noCoproGeo')}</div>
                      <div style={{ color: 'var(--sd-ink-2)' }}>{t('syndicDash.pointage.noCoproGeoDesc')}</div>
                    </div>
                  )}
                </div>

                {/* All buildings list with toggles */}
                <div className="sd-pt-geo-list">
                  {immeubles.map(imm => {
                    const isActive = !!imm.geolocActivee
                    const hasCoords = imm.latitude != null && imm.longitude != null
                    const rayon = imm.rayonDetection || RAYON_DETECTION_DEFAUT
                    return (
                      <div key={imm.id} className="sd-pt-geo-item">
                        <div className={`sd-pt-geo-radio ${isActive && hasCoords ? 'checked' : ''}`} />
                        <div style={{ flex: 1 }}>
                          <div className="sd-pt-geo-name">{imm.nom}</div>
                          <div className="sd-pt-geo-addr">{imm.adresse}, {imm.codePostal} {imm.ville}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {isActive && (
                            <select
                              value={rayon}
                              onChange={e => {
                                const newRayon = parseInt(e.target.value)
                                const updated = { ...imm, rayonDetection: newRayon }
                                if (!hasCoords) geocoderImmeuble(updated)
                                else onUpdateImmeuble(updated)
                              }}
                              style={{
                                padding: '4px 8px', borderRadius: 6,
                                border: '1px solid var(--sd-border)', background: 'var(--sd-cream)',
                                fontSize: 11, color: 'var(--sd-gold)', fontWeight: 600,
                                cursor: 'pointer', outline: 'none',
                                fontFamily: "'Outfit', sans-serif"
                              }}
                            >
                              <option value={50}>50m</option>
                              <option value={100}>100m</option>
                              <option value={150}>150m</option>
                              <option value={200}>200m</option>
                              <option value={300}>300m</option>
                              <option value={500}>500m</option>
                            </select>
                          )}
                          <div
                            className={`sd-pt-toggle ${isActive ? 'on' : ''}`}
                            onClick={() => {
                              const updated = { ...imm, geolocActivee: !isActive }
                              if (!isActive && !hasCoords) geocoderImmeuble(updated)
                              else onUpdateImmeuble(updated)
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {immeubles.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--sd-ink-3)' }}>
                      Aucune résidence configurée
                    </div>
                  )}
                </div>

                {/* Footer stats */}
                <div className="sd-pt-geo-footer">
                  <div className={`sd-pt-geo-stat ${immeublesGeoActifs.length > 0 ? 'active-stat' : 'inactive-stat'}`}>
                    {immeublesGeoActifs.length} activée{immeublesGeoActifs.length > 1 ? 's' : ''}
                  </div>
                  <div className="sd-pt-geo-stat inactive-stat">
                    {immeubles.filter(i => !i.geolocActivee).length} désactivée{immeubles.filter(i => !i.geolocActivee).length > 1 ? 's' : ''}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ════════ VUE HISTORIQUE ════════ */}
      {activeTab === 'historique' && (
        <>
          {/* Session active banner */}
          {sessionActive && (
            <div className="sd-pt-live-timer" style={{ marginBottom: 20 }}>
              <div className="sd-pt-lt-pulse" />
              <div className="sd-pt-lt-info">
                <div className="sd-pt-lt-label">Pointage en cours</div>
                <div className="sd-pt-lt-site">
                  {sessionActive.immeubleNom}
                  <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                    {sessionActive.mode === 'geo' ? '📡' : '✋'}
                  </span>
                </div>
              </div>
              <div className="sd-pt-lt-time">{chronoDisplay}</div>
              <button
                onClick={arreter}
                className="sd-pt-start-btn running"
                style={{ width: 'auto', padding: '10px 20px', fontSize: 13 }}
              >
                ⏹ {t('syndicDash.pointage.stop')}
              </button>
            </div>
          )}

          <div className="sd-pt-card" style={{ marginBottom: 0 }}>
            {/* Header */}
            <div className="sd-pt-card-header">
              <div>
                <div className="sd-pt-card-title">
                  <span style={{ fontSize: 17 }}>📋</span> Historique des pointages
                </div>
                <div className="sd-pt-card-sub">
                  {new Date().toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })} · {monthVisitCount} visite{monthVisitCount > 1 ? 's' : ''} enregistrée{monthVisitCount > 1 ? 's' : ''}
                </div>
              </div>
              <button className="sd-pt-hist-export-btn" onClick={exportCSV}>
                ⬇ Exporter CSV
              </button>
            </div>

            {/* Filter chips + search */}
            <div className="sd-pt-hist-filters">
              {[
                { key: 'tout' as const, label: 'Tout' },
                { key: 'ce_mois' as const, label: 'Ce mois' },
                { key: 'manuel' as const, label: 'Manuel' },
                { key: 'geo' as const, label: 'Géoloc' },
              ].map(chip => (
                <button
                  key={chip.key}
                  className={`sd-pt-hist-chip ${histChip === chip.key ? 'active' : ''}`}
                  onClick={() => setHistChip(chip.key)}
                >
                  {chip.label}
                </button>
              ))}
              <div className="sd-pt-hist-search">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--sd-ink-3)' }}>
                  <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
                </svg>
                <input
                  type="text"
                  className="sd-pt-hist-search-input"
                  placeholder="Rechercher résidence…"
                  value={histSearch}
                  onChange={e => setHistSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            {histFilteredSessions.length > 0 ? (
              <>
                <table className="sd-pt-hist-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Résidence</th>
                      <th>Arrivée</th>
                      <th>Départ</th>
                      <th>Durée</th>
                      <th>Méthode</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {histFilteredSessions.map(s => {
                      const dStart = new Date(s.dateDebut)
                      const dEnd = new Date(s.dateFin)
                      const dateStr = dStart.toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long' })
                      const dayStr = dStart.toLocaleDateString(dateFmtLocale, { weekday: 'long' })
                      const dayCapitalized = dayStr.charAt(0).toUpperCase() + dayStr.slice(1)
                      return (
                        <tr key={s.id}>
                          <td>
                            <div className="sd-pt-hist-date">{dateStr}</div>
                            <div className="sd-pt-hist-day">{dayCapitalized}</div>
                          </td>
                          <td>
                            <div className="sd-pt-hist-site">{s.immeubleNom}</div>
                            <div className="sd-pt-hist-addr">{s.immeubleAdresse}</div>
                          </td>
                          <td>{formatHHMM(dStart)}</td>
                          <td>{formatHHMM(dEnd)}</td>
                          <td>
                            <div className="sd-pt-hist-duration">{fmtDuree(s.dureeSecondes)}</div>
                          </td>
                          <td>
                            <span className={`sd-pt-hist-method-tag ${s.mode === 'manuel' ? 'sd-pt-hmt-manual' : 'sd-pt-hmt-geo'}`}>
                              {s.mode === 'manuel' ? '✋ Manuel' : '📡 Géoloc'}
                            </span>
                          </td>
                          <td>
                            <div className="sd-pt-hist-actions">
                              <button className="sd-pt-hist-action-btn" title="Voir">👁</button>
                              <button
                                className="sd-pt-hist-action-btn danger"
                                title="Supprimer"
                                onClick={() => deleteSession(s.id)}
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Footer */}
                <div className="sd-pt-hist-footer">
                  <div className="sd-pt-hist-total">
                    {histFilteredSessions.length} entrée{histFilteredSessions.length > 1 ? 's' : ''} affichée{histFilteredSessions.length > 1 ? 's' : ''} · Total : <strong>{fmtHourMin(histTotalSeconds)}</strong>
                  </div>
                  <button className="sd-pt-hist-export-btn" onClick={exportCSV}>
                    ⬇ Exporter CSV
                  </button>
                </div>
              </>
            ) : (
              <div className="sd-pt-empty">
                <div className="sd-pt-empty-icon">📋</div>
                <div className="sd-pt-empty-title">{t('syndicDash.pointage.noSession')}</div>
                <div className="sd-pt-empty-sub">{t('syndicDash.pointage.noSessionDesc')}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
