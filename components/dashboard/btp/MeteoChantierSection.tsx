'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useBTPData } from '@/lib/hooks/use-btp-data'

interface ChantierItem {
  id: string; titre: string; adresse: string; latitude?: number; longitude?: number
  statut: string; dateDebut?: string; dateFin?: string
}

interface DayForecast {
  date: string
  tempMax: number
  tempMin: number
  rain: number
  windMax: number
  weatherCode: number
}

interface ChantierMeteo {
  chantier: ChantierItem
  forecast: DayForecast[]
  alert: 'ok' | 'vigilance' | 'rouge'
  alertReasons: string[]
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

function classifyAlert(forecast: DayForecast[]): { alert: 'ok' | 'vigilance' | 'rouge'; reasons: string[] } {
  const reasons: string[] = []
  let level: 'ok' | 'vigilance' | 'rouge' = 'ok'

  for (const day of forecast.slice(0, 3)) {
    if (day.windMax > 60) { level = 'rouge'; reasons.push(`Vent ${Math.round(day.windMax)} km/h le ${day.date}`) }
    if (day.tempMin < 0) { level = level === 'rouge' ? 'rouge' : 'vigilance'; reasons.push(`Gel ${Math.round(day.tempMin)}°C le ${day.date}`) }
    if (day.rain > 5) { level = level === 'rouge' ? 'rouge' : 'vigilance'; reasons.push(`Pluie ${day.rain}mm le ${day.date}`) }
    if (day.tempMax > 33) { level = level === 'rouge' ? 'rouge' : 'vigilance'; reasons.push(`Chaleur ${Math.round(day.tempMax)}°C le ${day.date}`) }
  }
  return { alert: level, reasons: [...new Set(reasons)] }
}

// Géocoder une adresse via Open-Meteo Geocoding API (gratuit, pas de clé)
async function geocodeAdresse(adresse: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(adresse)}&count=1&language=fr`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.results?.[0]) {
      return { lat: json.results[0].latitude, lng: json.results[0].longitude }
    }
    // Essayer juste la ville (dernier mot ou après la virgule)
    const ville = adresse.includes(',') ? adresse.split(',').pop()?.trim() : adresse.split(' ').pop()
    if (ville && ville !== adresse) {
      const res2 = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr`)
      if (!res2.ok) return null
      const json2 = await res2.json()
      if (json2.results?.[0]) return { lat: json2.results[0].latitude, lng: json2.results[0].longitude }
    }
    return null
  } catch { return null }
}

export function MeteoChantierSection({ userId, isPt }: { userId: string; isPt?: boolean }) {
  const { items: chantiers, loading: chantiersLoading } = useBTPData<ChantierItem>({ table: 'chantiers', artisanId: userId, userId })
  const [meteoData, setMeteoData] = useState<ChantierMeteo[]>([])
  const [meteoLoading, setMeteoLoading] = useState(false)
  const [meteoError, setMeteoError] = useState<string | null>(null)
  const [selectedChantier, setSelectedChantier] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  // Filtrer chantiers actifs (pas terminés/annulés) qui ont une adresse
  const chantiersActifs = chantiers.filter(c =>
    c.statut !== 'Terminé' && c.statut !== 'Annulé'
  )
  const chantiersAvecAdresse = chantiersActifs.filter(c => c.adresse?.trim())
  const chantiersSansAdresse = chantiersActifs.filter(c => !c.adresse?.trim())

  const fetchMeteo = useCallback(async (chantiersToFetch: ChantierItem[]) => {
    if (chantiersToFetch.length === 0) return
    setMeteoLoading(true)
    setMeteoError(null)
    try {
      const results: ChantierMeteo[] = (await Promise.all(
        chantiersToFetch.map(async (chantier) => {
          try {
            // Utiliser GPS si dispo, sinon géocoder l'adresse
            let lat = chantier.latitude
            let lng = chantier.longitude
            if (!lat || !lng) {
              const geo = await geocodeAdresse(chantier.adresse)
              if (!geo) return null
              lat = geo.lat; lng = geo.lng
            }
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=7`
            )
            if (!res.ok) return null
            const json = await res.json()
            if (!json.daily?.time) return null
            const forecast: DayForecast[] = json.daily.time.map((date: string, i: number) => ({
              date,
              tempMax: json.daily.temperature_2m_max[i],
              tempMin: json.daily.temperature_2m_min[i],
              rain: json.daily.precipitation_sum[i],
              windMax: json.daily.wind_speed_10m_max[i],
              weatherCode: json.daily.weather_code[i],
            }))
            const { alert, reasons } = classifyAlert(forecast)
            return { chantier, forecast, alert, alertReasons: reasons }
          } catch {
            return null
          }
        })
      )).filter(Boolean) as ChantierMeteo[]
      setMeteoData(results)
      if (results.length === 0 && chantiersToFetch.length > 0) {
        setMeteoError('Impossible de récupérer la météo. Vérifiez les adresses des chantiers.')
      }
    } catch {
      setMeteoError('Erreur lors du chargement des données météo.')
    } finally {
      setMeteoLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!chantiersLoading && chantiersAvecAdresse.length > 0 && !fetchedRef.current) {
      fetchedRef.current = true
      fetchMeteo(chantiersAvecAdresse)
    }
  }, [chantiersLoading, chantiersAvecAdresse.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const nbOk = meteoData.filter(m => m.alert === 'ok').length
  const nbVigilance = meteoData.filter(m => m.alert === 'vigilance').length
  const nbRouge = meteoData.filter(m => m.alert === 'rouge').length
  const nbGel = meteoData.reduce((n, m) => n + (m.forecast.slice(0, 7).some(d => d.tempMin < 0) ? 1 : 0), 0)

  const selected = selectedChantier ? meteoData.find(m => m.chantier.id === selectedChantier) : null

  if (chantiersLoading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>Chargement des chantiers...</div>

  return (
    <div className="v5-fade">
      <div className="v5-pg-t">
        <div>
          <h1>{isPt ? 'Meteorologia dos estaleiros' : 'Météo chantiers'}</h1>
          <p>{isPt ? 'Previsões automáticas por estaleiro — dados Open-Meteo' : 'Prévisions automatiques par chantier — données Open-Meteo'}</p>
        </div>
        {meteoData.length > 0 && (
          <button className="v5-btn v5-btn-p" onClick={() => { fetchedRef.current = false; fetchMeteo(chantiersAvecAdresse) }} disabled={meteoLoading}>
            {meteoLoading ? 'Chargement...' : 'Actualiser'}
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
          <div className="v5-kpi-s">{isPt ? 'chuva/calor' : 'pluie/chaleur'}</div>
        </div>
        <div className="v5-kpi" style={{ borderLeft: '4px solid #EF5350' }}>
          <div className="v5-kpi-l">{isPt ? 'Alerta vermelho' : 'Alerte rouge'}</div>
          <div className="v5-kpi-v" style={{ color: '#EF5350' }}>{meteoLoading ? '...' : nbRouge}</div>
          <div className="v5-kpi-s">{isPt ? 'vento > 60 km/h' : 'vent > 60 km/h'}</div>
        </div>
        <div className="v5-kpi hl">
          <div className="v5-kpi-l">{isPt ? 'Chantiers gel prévu' : 'Chantiers gel prévu'}</div>
          <div className="v5-kpi-v">{meteoLoading ? '...' : nbGel}</div>
          <div className="v5-kpi-s">{isPt ? 'esta semana' : 'cette semaine'}</div>
        </div>
      </div>

      {/* Aucun chantier */}
      {chantiersActifs.length === 0 && (
        <div className="v5-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{isPt ? 'Nenhum estaleiro ativo' : 'Aucun chantier actif'}</h3>
          <p style={{ fontSize: 12, color: '#999' }}>{isPt ? 'Crie estaleiros na secção Chantiers para ver as previsões meteorológicas.' : 'Créez des chantiers dans la section Chantiers pour voir les prévisions météo.'}</p>
        </div>
      )}

      {/* Chantiers sans adresse */}
      {chantiersSansAdresse.length > 0 && (
        <div className="v5-al info" style={{ marginBottom: '.75rem' }}>
          <strong>{chantiersSansAdresse.length} chantier(s) sans adresse</strong> — {isPt ? 'Adicione o endereço na secção Chantiers para ativar a meteorologia.' : 'Ajoutez l\'adresse dans la section Chantiers pour activer la météo.'}
          <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
            {chantiersSansAdresse.slice(0, 5).map(c => c.titre).join(', ')}{chantiersSansAdresse.length > 5 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Erreur météo */}
      {meteoError && (
        <div className="v5-al warning" style={{ marginBottom: '.75rem' }}>
          {meteoError}
          <button className="v5-btn v5-btn-p" style={{ marginLeft: 12, fontSize: 11 }} onClick={() => { fetchedRef.current = false; fetchMeteo(chantiersAvecAdresse) }}>Réessayer</button>
        </div>
      )}

      {/* Liste des chantiers avec météo */}
      {meteoData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '.75rem', marginBottom: '1.25rem' }}>
          {meteoData.map(m => (
            <div
              key={m.chantier.id}
              className="v5-card"
              onClick={() => setSelectedChantier(m.chantier.id === selectedChantier ? null : m.chantier.id)}
              style={{
                cursor: 'pointer',
                borderLeft: `4px solid ${m.alert === 'rouge' ? '#EF5350' : m.alert === 'vigilance' ? '#FFA726' : '#4CAF50'}`,
                background: selectedChantier === m.chantier.id ? 'var(--v5-content-bg)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.chantier.titre}</div>
                  <div style={{ fontSize: 11, color: 'var(--v5-text-light)' }}>{m.chantier.adresse || '—'}</div>
                </div>
                <span className={`v5-badge ${m.alert === 'rouge' ? 'v5-badge-red' : m.alert === 'vigilance' ? 'v5-badge-orange' : 'v5-badge-green'}`}>
                  {m.alert === 'rouge' ? 'Alerte' : m.alert === 'vigilance' ? 'Vigilance' : 'OK'}
                </span>
              </div>
              {/* Mini forecast 3 jours */}
              <div style={{ display: 'flex', gap: 8 }}>
                {m.forecast.slice(0, 3).map((d, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', background: 'rgba(0,0,0,.02)', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: 'var(--v5-text-light)' }}>{new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                    <div style={{ fontSize: 18 }}>{getWeatherIcon(d.weatherCode)}</div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{Math.round(d.tempMax)}°/{Math.round(d.tempMin)}°</div>
                    {d.rain > 0 && <div style={{ fontSize: 10, color: '#1976D2' }}>{d.rain}mm</div>}
                    {d.windMax > 40 && <div style={{ fontSize: 10, color: '#C62828' }}>{Math.round(d.windMax)}km/h</div>}
                  </div>
                ))}
              </div>
              {m.alertReasons.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: m.alert === 'rouge' ? '#C62828' : '#E65100' }}>
                  {m.alertReasons.slice(0, 2).join(' • ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Détail 7 jours */}
      {selected && (
        <div className="v5-card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E8E8E8' }}>
            <div className="v5-st" style={{ margin: 0 }}>Prévisions 7 jours — {selected.chantier.titre}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="v5-dt">
              <thead>
                <tr>
                  <th>Jour</th><th>Météo</th><th>T° max</th><th>T° min</th><th>Pluie</th><th>Vent max</th><th>Impact BTP</th>
                </tr>
              </thead>
              <tbody>
                {selected.forecast.map((d, i) => {
                  const impacts: string[] = []
                  if (d.rain > 5) impacts.push('Pas de ravalement/béton')
                  if (d.windMax > 60) impacts.push('Arrêt grue/échafaudage')
                  if (d.tempMin < 0) impacts.push('Pas de maçonnerie')
                  if (d.tempMax > 33) impacts.push('Horaires aménagés')
                  return (
                    <tr key={i} style={impacts.length > 0 ? { background: 'rgba(255,0,0,.03)' } : undefined}>
                      <td style={{ fontWeight: 600 }}>{new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td style={{ fontSize: 20 }}>{getWeatherIcon(d.weatherCode)}</td>
                      <td style={{ color: d.tempMax > 33 ? '#C62828' : undefined, fontWeight: d.tempMax > 33 ? 600 : 400 }}>{Math.round(d.tempMax)}°C</td>
                      <td style={{ color: d.tempMin < 0 ? '#1565C0' : undefined, fontWeight: d.tempMin < 0 ? 600 : 400 }}>{Math.round(d.tempMin)}°C</td>
                      <td style={{ color: d.rain > 5 ? '#1976D2' : undefined, fontWeight: d.rain > 5 ? 600 : 400 }}>{d.rain > 0 ? `${d.rain}mm` : '—'}</td>
                      <td style={{ color: d.windMax > 60 ? '#C62828' : undefined, fontWeight: d.windMax > 60 ? 600 : 400 }}>{Math.round(d.windMax)} km/h</td>
                      <td style={{ fontSize: 11, color: impacts.length > 0 ? '#C62828' : '#4CAF50' }}>{impacts.length > 0 ? impacts.join(', ') : 'RAS'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seuils BTP */}
      <div style={{ fontSize: 10, color: '#BBB', marginTop: 16, textAlign: 'center' }}>
        Seuils BTP : 🌧️ Pluie {'>'} 5mm = pas de ravalement/béton • 💨 Vent {'>'} 60 km/h = arrêt grue/échafaudage • ❄️ Gel = pas de maçonnerie • 🌡️ {'>'} 33°C = horaires aménagés
      </div>
    </div>
  )
}
