'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { supabase } from '@/lib/supabase'

interface ChantierItem {
  id: string; titre: string; adresse: string; ville: string; codePostal: string
  latitude?: number; longitude?: number
  statut: string; dateDebut?: string; dateFin?: string; description?: string
}

interface DayForecast {
  date: string
  tempMax: number
  tempMin: number
  rain: number
  windMax: number
  weatherCode: number
}

type AlertLevel = 'ok' | 'vigilance' | 'rouge'

interface DayAlert {
  dayIndex: number
  level: AlertLevel
  reasons: string[]
}

interface ChantierMeteo {
  chantier: ChantierItem
  forecast: DayForecast[]
  alert: AlertLevel
  alertReasons: string[]
  dayAlerts: DayAlert[]
  mainAlertDay: DayAlert | null
}

const WEATHER_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

function getWeatherIcon(code: number): string {
  return WEATHER_ICONS[code] || '🌤️'
}

function classifyAlert(forecast: DayForecast[]): {
  alert: AlertLevel
  reasons: string[]
  dayAlerts: DayAlert[]
  mainAlertDay: DayAlert | null
} {
  let level: AlertLevel = 'ok'
  const allReasons: string[] = []
  const dayAlerts: DayAlert[] = []
  let mainAlertDay: DayAlert | null = null

  for (let i = 0; i < Math.min(forecast.length, 5); i++) {
    const day = forecast[i]
    const dayReasons: string[] = []
    let dayLevel: AlertLevel = 'ok'

    if (day.windMax > 60) {
      dayLevel = 'rouge'
      dayReasons.push(`Vent ${Math.round(day.windMax)} km/h`)
    }
    if (day.tempMin < 0) {
      dayLevel = dayLevel === 'rouge' ? 'rouge' : 'vigilance'
      dayReasons.push(`Gel ${Math.round(day.tempMin)}°C`)
    }
    if (day.rain > 5) {
      dayLevel = dayLevel === 'rouge' ? 'rouge' : 'vigilance'
      dayReasons.push(`Pluie ${day.rain}mm`)
    }
    if (day.tempMax > 33) {
      dayLevel = dayLevel === 'rouge' ? 'rouge' : 'vigilance'
      dayReasons.push(`Chaleur ${Math.round(day.tempMax)}°C`)
    }

    if (dayLevel !== 'ok') {
      const alert: DayAlert = { dayIndex: i, level: dayLevel, reasons: dayReasons }
      dayAlerts.push(alert)
      if (!mainAlertDay || dayLevel === 'rouge') mainAlertDay = alert
      allReasons.push(...dayReasons.map(r => `${r} le ${day.date}`))
    }

    if (dayLevel === 'rouge') level = 'rouge'
    else if (dayLevel === 'vigilance' && level !== 'rouge') level = 'vigilance'
  }

  return { alert: level, reasons: [...new Set(allReasons)], dayAlerts, mainAlertDay }
}

// Extract city candidates from a free-text address — ordered from most to least specific
function extractCityName(adresse: string): string[] {
  const candidates: string[] = []
  const clean = adresse.trim()
  if (!clean) return candidates

  // 1. Extract city after a French postal code: "13001 Marseille" → "Marseille"
  const cpMatch = clean.match(/\b(\d{5})\s+([A-Za-zÀ-ÿ][\w\s-]+)/i)
  if (cpMatch) {
    const city = cpMatch[2].trim().split(/[,\n]/)[0].trim()
    if (city && !candidates.includes(city)) candidates.push(city)
  }

  // 2. After last comma (often the city): "12 rue X, Marseille" → "Marseille"
  if (clean.includes(',')) {
    const parts = clean.split(',')
    const last = parts[parts.length - 1].replace(/\b\d{5}\b/g, '').replace(/\b\d+\b/g, '').trim()
    if (last && last.length >= 3 && !candidates.includes(last)) candidates.push(last)
    // Also try second-to-last if 3+ parts: "12 rue X, 13001, Marseille"
    if (parts.length >= 3) {
      const prev = parts[parts.length - 2].replace(/\b\d{5}\b/g, '').replace(/\b\d+\b/g, '').trim()
      if (prev && prev.length >= 3 && !candidates.includes(prev)) candidates.push(prev)
    }
  }

  // 3. Strip numbers + street prefixes → remaining text
  const stripped = clean
    .replace(/\b\d{5}\b/g, '')
    .replace(/\b\d{1,3}(bis|ter)?\b/gi, '')
    .replace(/\b(rue|av|avenue|bd|boulevard|allée|impasse|place|chemin|route|lot|résidence|rés|bât|bâtiment|immeuble|quartier|zone|zi|za|zac|r\.|av\.|bd\.)\b/gi, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped && stripped.length >= 3 && !candidates.includes(stripped)) candidates.push(stripped)

  // 4. Individual words ≥ 4 chars, capitalized (likely proper nouns / city names)
  const words = stripped.split(' ').filter(w => w.length >= 4 && /^[A-ZÀ-Ÿ]/.test(w))
  for (const w of words) {
    if (!candidates.includes(w)) candidates.push(w)
  }

  // 5. Fallback: any word ≥ 4 chars
  const allWords = stripped.split(' ').filter(w => w.length >= 4)
  for (const w of allWords) {
    if (!candidates.includes(w)) candidates.push(w)
  }

  return candidates.filter(Boolean)
}

function extractShortCity(adresse: string): string {
  const candidates = extractCityName(adresse)
  return candidates[0] || adresse
}

// Geocode with multi-strategy fallback: gouv.fr API → Nominatim → Open-Meteo
async function geocodeAdresse(adresse: string): Promise<{ lat: number; lng: number } | null> {
  if (!adresse?.trim()) return null

  // Strategy 1: api-adresse.data.gouv.fr — best for French addresses
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`, { signal: AbortSignal.timeout(4000) })
    if (res.ok) {
      const json = await res.json()
      const feat = json.features?.[0]
      if (feat?.geometry?.coordinates) {
        const [lng, lat] = feat.geometry.coordinates
        return { lat, lng }
      }
    }
  } catch { /* timeout or network — try next */ }

  // Strategy 2: Nominatim (OpenStreetMap) — handles international + complex addresses
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresse)}&limit=1&accept-language=fr`,
      { headers: { 'User-Agent': 'Vitfix-BTP/1.0' }, signal: AbortSignal.timeout(4000) }
    )
    if (res.ok) {
      const json = await res.json()
      if (json[0]?.lat && json[0]?.lon) {
        return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) }
      }
    }
  } catch { /* timeout or network — try next */ }

  // Strategy 3: Open-Meteo geocoding with extracted city names
  const candidates = extractCityName(adresse)
  for (const candidate of candidates) {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=fr`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (!res.ok) continue
      const json = await res.json()
      if (json.results?.[0]) {
        return { lat: json.results[0].latitude, lng: json.results[0].longitude }
      }
    } catch { continue }
  }

  return null
}

function formatDayShort(dateStr: string, isPt?: boolean): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekday = d.toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { weekday: 'short' })
  const day = d.getDate()
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day}`
}

function getBTPImpactMessage(day: DayForecast, isPt?: boolean): string | null {
  if (day.windMax > 60) {
    return isPt
      ? `Vento ${Math.round(day.windMax)} km/h — INTERDIÇÃO andaimes e grua (regulamentação). Apenas trabalhos interiores autorizados.`
      : `Vent ${Math.round(day.windMax)} km/h — INTERDICTION échafaudage et grue (réglementation). Seuls les lots intérieurs autorisés.`
  }
  if (day.rain > 5) {
    return isPt
      ? `Chuva ${day.rain}mm prevista — ravalement fachada desaconselhado. Prever trabalhos interiores ou adiar.`
      : `Pluie ${day.rain}mm prévue — ravalement façade déconseillé. Prévoir travaux intérieurs ou report.`
  }
  if (day.tempMin < 0) {
    return isPt
      ? `Gelo ${Math.round(day.tempMin)}°C — sem alvenaria nem betão. Risco de fissuras.`
      : `Gel ${Math.round(day.tempMin)}°C — pas de maçonnerie ni béton. Risque de fissuration.`
  }
  if (day.tempMax > 33) {
    return isPt
      ? `Calor ${Math.round(day.tempMax)}°C — horários adaptados obrigatórios (Code du travail).`
      : `Chaleur ${Math.round(day.tempMax)}°C — horaires aménagés obligatoires (Code du travail).`
  }
  return null
}

function getAlertBadgeLabel(m: ChantierMeteo, isPt?: boolean): { label: string; className: string } {
  if (m.alert === 'rouge' && m.mainAlertDay) {
    const day = m.forecast[m.mainAlertDay.dayIndex]
    const dayName = formatDayShort(day.date, isPt)
    if (day.windMax > 60) return { label: `🔴 ${isPt ? 'Vento forte' : 'Vent fort'} ${dayName.split(' ')[0].toLowerCase()}`, className: 'v5-badge v5-badge-red' }
    return { label: `🔴 ${isPt ? 'Alerta' : 'Alerte'} ${dayName.split(' ')[0].toLowerCase()}`, className: 'v5-badge v5-badge-red' }
  }
  if (m.alert === 'vigilance' && m.mainAlertDay) {
    const day = m.forecast[m.mainAlertDay.dayIndex]
    const dayName = formatDayShort(day.date, isPt)
    if (day.rain > 5) return { label: `⚠️ ${isPt ? 'Chuva' : 'Pluie'} ${dayName.split(' ')[0].toLowerCase()}`, className: 'v5-badge v5-badge-orange' }
    if (day.tempMin < 0) return { label: `❄️ ${isPt ? 'Gelo' : 'Gel'} ${dayName.split(' ')[0].toLowerCase()}`, className: 'v5-badge v5-badge-orange' }
    if (day.tempMax > 33) return { label: `🌡️ ${isPt ? 'Calor' : 'Chaleur'} ${dayName.split(' ')[0].toLowerCase()}`, className: 'v5-badge v5-badge-orange' }
    return { label: `⚠️ Vigilance ${dayName.split(' ')[0].toLowerCase()}`, className: 'v5-badge v5-badge-orange' }
  }
  return { label: `✅ RAS`, className: 'v5-badge v5-badge-green' }
}

export function MeteoChantierSection({ userId, authUserId: authUserIdProp, isPt }: { userId: string; authUserId?: string; isPt?: boolean }) {
  // Use auth user ID from prop (matches ChantiersBTPV2 cache key), fallback to resolving
  const [authUserId, setAuthUserId] = useState(authUserIdProp || userId)
  useEffect(() => {
    if (authUserIdProp) { setAuthUserId(authUserIdProp); return }
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setAuthUserId(data.user.id)
    })
  }, [authUserIdProp])

  const { items: chantiers, loading: chantiersLoading, error: chantiersError } = useBTPData<ChantierItem>({
    table: 'chantiers',
    artisanId: userId,
    userId: authUserId,
  })
  const [meteoData, setMeteoData] = useState<ChantierMeteo[]>([])
  const [meteoLoading, setMeteoLoading] = useState(false)
  const [meteoError, setMeteoError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState('')
  const fetchedRef = useRef(false)

  // Filtrer chantiers actifs (pas terminés/annulés) qui ont une ville ou adresse
  const chantiersActifs = chantiers.filter(c =>
    c.statut !== 'Terminé' && c.statut !== 'Annulé'
  )
  const chantiersAvecLocalisation = chantiersActifs.filter(c => c.ville?.trim() || c.adresse?.trim())
  const chantiersSansLocalisation = chantiersActifs.filter(c => !c.ville?.trim() && !c.adresse?.trim())

  const fetchMeteo = useCallback(async (chantiersToFetch: ChantierItem[]) => {
    if (chantiersToFetch.length === 0) return
    setMeteoLoading(true)
    setMeteoError(null)
    setDebugInfo('')
    const failedNames: string[] = []
    try {
      const results: ChantierMeteo[] = (await Promise.all(
        chantiersToFetch.map(async (chantier) => {
          try {
            let lat = chantier.latitude
            let lng = chantier.longitude
            if (!lat || !lng) {
              // Geocode using ville (preferred) then fallback to adresse
              const searchTerm = chantier.ville?.trim() || chantier.adresse
              const geo = await geocodeAdresse(searchTerm)
              if (!geo) {
                failedNames.push(`${chantier.titre} (${chantier.ville || chantier.adresse})`)
                return null
              }
              lat = geo.lat; lng = geo.lng
              // Persist coordinates in Supabase so we never re-geocode this chantier
              supabase.from('chantiers_btp').update({ latitude: lat, longitude: lng }).eq('id', chantier.id).then(() => {})
            }
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=7`
            )
            if (!res.ok) {
              failedNames.push(`${chantier.titre} (API erreur ${res.status})`)
              return null
            }
            const json = await res.json()
            if (!json.daily?.time) {
              failedNames.push(`${chantier.titre} (données vides)`)
              return null
            }
            const forecast: DayForecast[] = json.daily.time.map((date: string, i: number) => ({
              date,
              tempMax: json.daily.temperature_2m_max[i],
              tempMin: json.daily.temperature_2m_min[i],
              rain: json.daily.precipitation_sum[i],
              windMax: json.daily.wind_speed_10m_max[i],
              weatherCode: json.daily.weather_code[i],
            }))
            const { alert, reasons, dayAlerts, mainAlertDay } = classifyAlert(forecast)
            return { chantier, forecast, alert, alertReasons: reasons, dayAlerts, mainAlertDay }
          } catch {
            failedNames.push(`${chantier.titre} (exception)`)
            return null
          }
        })
      )).filter(Boolean) as ChantierMeteo[]
      setMeteoData(results)
      if (results.length === 0 && chantiersToFetch.length > 0) {
        setMeteoError(isPt
          ? `Geocodificação falhou para ${chantiersToFetch.length} obra(s). Verifique os endereços.`
          : `Géocodage échoué pour ${chantiersToFetch.length} chantier(s). Vérifiez les adresses.`)
      } else if (failedNames.length > 0) {
        setDebugInfo(`${isPt ? 'Meteorologia indisponível para' : 'Météo indisponible pour'} : ${failedNames.join(', ')}`)
      }
    } catch {
      setMeteoError(isPt ? 'Erro ao carregar dados meteorológicos.' : 'Erreur lors du chargement des données météo.')
    } finally {
      setMeteoLoading(false)
    }
  }, [isPt])

  // Reset fetchedRef when authUserId changes (ensures re-fetch with correct cache)
  useEffect(() => {
    fetchedRef.current = false
  }, [authUserId])

  // Auto-fetch weather when chantiers are loaded
  useEffect(() => {
    if (chantiersLoading) return
    if (chantiersAvecLocalisation.length === 0) return
    if (fetchedRef.current) return
    fetchedRef.current = true
    // Small delay to ensure Supabase data is settled
    const timer = setTimeout(() => fetchMeteo(chantiersAvecLocalisation), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantiersLoading, chantiersAvecLocalisation.length])

  const nbOk = meteoData.filter(m => m.alert === 'ok').length
  const nbVigilance = meteoData.filter(m => m.alert === 'vigilance').length
  const nbRouge = meteoData.filter(m => m.alert === 'rouge').length
  const nbGel = meteoData.reduce((n, m) => n + (m.forecast.slice(0, 7).some(d => d.tempMin < 0) ? 1 : 0), 0)

  if (chantiersLoading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>{isPt ? 'A carregar obras...' : 'Chargement des chantiers...'}</div>

  return (
    <div className="v5-fade">
      <div className="v5-pg-t" style={{ flexDirection: 'column' }}>
        <div>
          <h1>{isPt ? 'Meteorologia dos estaleiros' : 'Météo chantiers'}</h1>
          <p>{isPt ? 'Previsões automáticas por estaleiro — dados Open-Meteo' : 'Prévisions automatiques par chantier — données Open-Meteo'}</p>
        </div>
        {(meteoData.length > 0 || chantiersAvecLocalisation.length > 0) && (
          <button className="v5-btn v5-btn-p" onClick={() => { fetchedRef.current = true; setMeteoData([]); fetchMeteo(chantiersAvecLocalisation) }} disabled={meteoLoading}>
            {meteoLoading ? (isPt ? 'A carregar...' : 'Chargement...') : (isPt ? 'Atualizar' : 'Actualiser')}
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi" style={{ borderLeft: '4px solid #4CAF50' }}>
          <div className="v5-kpi-l">{isPt ? 'Obras OK' : 'Chantiers OK'}</div>
          <div className="v5-kpi-v" style={{ color: '#4CAF50' }}>{meteoLoading ? '...' : nbOk}</div>
          <div className="v5-kpi-s">{isPt ? 'sem alerta' : "pas d'alerte"}</div>
        </div>
        <div className="v5-kpi" style={{ borderLeft: '4px solid #FFA726' }}>
          <div className="v5-kpi-l">Vigilance</div>
          <div className="v5-kpi-v" style={{ color: '#FFA726' }}>{meteoLoading ? '...' : nbVigilance}</div>
          <div className="v5-kpi-s">{isPt ? 'chuva prevista' : 'pluie prévue'}</div>
        </div>
        <div className="v5-kpi" style={{ borderLeft: '4px solid #EF5350' }}>
          <div className="v5-kpi-l">{isPt ? 'Alerta vermelho' : 'Alerte rouge'}</div>
          <div className="v5-kpi-v" style={{ color: '#EF5350' }}>{meteoLoading ? '...' : nbRouge}</div>
          <div className="v5-kpi-s">{isPt ? 'vento > 60 km/h' : 'vent > 60 km/h'}</div>
        </div>
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{isPt ? 'Dia de gelo previsto' : 'Jour de gel prévu'}</div>
          <div className="v5-kpi-v">{meteoLoading ? '...' : nbGel}</div>
          <div className="v5-kpi-s">{isPt ? 'nenhum esta semana' : 'aucun cette semaine'}</div>
        </div>
      </div>

      {/* Debug info — visible en dev pour diagnostic */}
      {chantiersActifs.length === 0 && chantiers.length > 0 && (
        <div className="v5-al info" style={{ marginBottom: '.75rem', fontSize: 11 }}>
          {chantiers.length} chantier(s) chargés, mais aucun actif (statuts: {chantiers.map(c => c.statut).join(', ')}).
          Seuls les chantiers &quot;En cours&quot; ou &quot;En attente&quot; sont affichés.
        </div>
      )}

      {/* Aucun chantier */}
      {chantiersActifs.length === 0 && chantiers.length === 0 && !chantiersError && (
        <div className="v5-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{isPt ? 'Nenhum estaleiro ativo' : 'Aucun chantier actif'}</h3>
          <p style={{ fontSize: 12, color: '#999' }}>{isPt ? 'Crie estaleiros na secção Chantiers para ver as previsões meteorológicas.' : 'Créez des chantiers dans la section Chantiers pour voir les prévisions météo.'}</p>
        </div>
      )}

      {/* Erreur chargement chantiers */}
      {chantiersError && (
        <div className="v5-al warning" style={{ marginBottom: '.75rem' }}>
          {isPt ? 'Erro ao carregar obras.' : 'Erreur lors du chargement des chantiers.'}
          <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>({chantiersError})</span>
        </div>
      )}

      {/* Chantiers sans adresse */}
      {chantiersSansLocalisation.length > 0 && (
        <div className="v5-al info" style={{ marginBottom: '.75rem' }}>
          <strong>{chantiersSansLocalisation.length} {isPt ? 'obra(s) sem cidade' : 'chantier(s) sans ville'}</strong> — {isPt ? 'Adicione a cidade na secção Chantiers para ativar a meteorologia.' : 'Ajoutez la ville dans la section Chantiers pour activer la météo.'}
          <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
            {chantiersSansLocalisation.slice(0, 5).map(c => c.titre).join(', ')}{chantiersSansLocalisation.length > 5 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Erreur météo */}
      {meteoError && (
        <div className="v5-al warning" style={{ marginBottom: '.75rem' }}>
          {meteoError}
          <button className="v5-btn v5-btn-p" style={{ marginLeft: 12, fontSize: 11 }} onClick={() => { fetchedRef.current = false; fetchMeteo(chantiersAvecLocalisation) }}>{isPt ? 'Tentar novamente' : 'Réessayer'}</button>
        </div>
      )}

      {/* Debug info partiel */}
      {debugInfo && (
        <div className="v5-al info" style={{ marginBottom: '.75rem', fontSize: 11 }}>
          {debugInfo}
        </div>
      )}

      {/* Section title */}
      {meteoData.length > 0 && (
        <div className="v5-st" style={{ marginBottom: '.5rem' }}>
          {isPt ? 'Previsões 5 dias por obra' : 'Prévisions 5 jours par chantier'}
        </div>
      )}

      {/* Liste des chantiers — layout du mockup HTML v6 */}
      {meteoData.map(m => {
        const badge = getAlertBadgeLabel(m, isPt)
        const cityShort = m.chantier.ville || extractShortCity(m.chantier.adresse)
        // Find the worst alert day for the impact message
        const worstDay = m.mainAlertDay ? m.forecast[m.mainAlertDay.dayIndex] : null
        const worstDayLabel = worstDay ? formatDayShort(worstDay.date, isPt) : null
        const impactMsg = worstDay ? getBTPImpactMessage(worstDay, isPt) : null

        // Set of day indices with alerts for highlighting
        const alertDayIndices = new Set(m.dayAlerts.map(a => a.dayIndex))

        return (
          <div key={m.chantier.id} className="v5-card" style={{ marginBottom: '.65rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>🏗️ {m.chantier.titre}</span>
                <span style={{ fontSize: 10, color: '#999', marginLeft: 8 }}>{cityShort}</span>
              </div>
              <span className={badge.className}>{badge.label}</span>
            </div>

            {/* 5-day forecast inline */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '.65rem', flexWrap: 'wrap' }}>
              {m.forecast.slice(0, 5).map((day, i) => {
                const hasAlert = alertDayIndices.has(i)
                const dayAlert = m.dayAlerts.find(a => a.dayIndex === i)
                const isRouge = dayAlert?.level === 'rouge'
                const bgColor = hasAlert ? (isRouge ? '#FFEBEE' : '#FFF3E0') : undefined
                const textColor = hasAlert ? (isRouge ? '#C62828' : '#E65100') : '#999'

                return (
                  <div key={i} style={{
                    textAlign: 'center', flex: 1, minWidth: 60,
                    ...(bgColor ? { background: bgColor, borderRadius: 6, padding: 4 } : {}),
                  }}>
                    <div style={{ fontSize: 10, color: hasAlert ? textColor : '#999', fontWeight: hasAlert ? 600 : 400 }}>
                      {formatDayShort(day.date, isPt)}
                    </div>
                    <div style={{ fontSize: 20 }}>
                      {day.windMax > 60 ? '💨' : getWeatherIcon(day.weatherCode)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: hasAlert ? textColor : undefined }}>
                      {Math.round(day.tempMax)}°
                    </div>
                    <div style={{ fontSize: 9, color: hasAlert ? textColor : '#999' }}>
                      {day.rain > 1
                        ? `🌧 ${day.rain}mm`
                        : `💨 ${Math.round(day.windMax)} km/h`
                      }
                    </div>
                  </div>
                )
              })}
            </div>

            {/* BTP impact alert message */}
            {impactMsg && worstDayLabel && (
              <div
                className={m.alert === 'rouge' ? 'v5-al' : 'v5-al'}
                style={{
                  marginTop: '.65rem',
                  background: m.alert === 'rouge' ? '#FFEBEE' : '#FFF3E0',
                  color: m.alert === 'rouge' ? '#C62828' : '#E65100',
                  padding: '.5rem .75rem',
                  borderRadius: 4,
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {m.alert === 'rouge' ? '🔴' : '⚠️'}{' '}
                <strong>{worstDayLabel} :</strong>{' '}
                {impactMsg}
              </div>
            )}

            {/* RAS for OK chantiers */}
            {m.alert === 'ok' && (
              <div style={{ fontSize: 11, color: '#888', marginTop: '.5rem', padding: '.5rem', background: '#F5F5F5', borderRadius: 4 }}>
                {isPt ? 'Sem impacto meteorológico previsto esta semana.' : 'Pas d\'impact météo prévu cette semaine.'}
              </div>
            )}
          </div>
        )
      })}

      {/* Loading indicator for meteo */}
      {meteoLoading && chantiersAvecLocalisation.length > 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: 12 }}>
          {isPt ? 'A carregar previsões meteorológicas...' : 'Chargement des prévisions météo...'}
        </div>
      )}

      {/* Seuils BTP */}
      <div style={{ fontSize: 10, color: '#999', marginTop: '.75rem' }}>
        {isPt ? 'Limiares BTP' : 'Seuils BTP'} : 🌧️ {isPt ? 'Chuva' : 'Pluie'} {'>'} 5mm = {isPt ? 'sem ravalement/betão' : 'pas de ravalement/béton'} • 💨 {isPt ? 'Vento' : 'Vent'} {'>'} 60 km/h = {isPt ? 'paragem grua/andaimes' : 'arrêt grue/échafaudage'} • ❄️ {isPt ? 'Gelo = sem alvenaria' : 'Gel = pas de maçonnerie'} • 🌡️ {'>'} 33°C = {isPt ? 'horários adaptados obrigatórios' : 'horaires aménagés obligatoires'}
      </div>
    </div>
  )
}
