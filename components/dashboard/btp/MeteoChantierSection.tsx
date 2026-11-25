'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useBTPData } from '@/lib/hooks/use-btp-data'
import { adresseComplete, geocoderAdresse, type Pays } from '@/lib/btp/geocodage'
import { supabase } from '@/lib/supabase'
import { urlPrevisionsMeteo } from '@/lib/btp/meteo-url'
import {
  COLONNES_LIEU_DEVIS, PREFIXE_CARTE_DEVIS, ajouterLieuMeteo, champsAdresseDuLieu, cleLieuxMeteo, libelleChoixDevis,
  lieuDuDevis, lieuxMeteoValides, type LieuDevis, type LieuMeteoDevis,
} from '@/lib/btp/lieu-devis'

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

// Libellés portugais, à l'affichage seulement, des statuts de chantier enregistrés en français (mêmes libellés que la
// liste des obras) et du message d'erreur renvoyé par useBTPData (lib/hooks/use-btp-data.ts).
const STATUTS_PT: Record<string, string> = { 'En attente': 'Pendente', 'En cours': 'Em curso', 'Terminé': 'Concluída', 'Annulé': 'Anulada' }
const ERREURS_CHARGEMENT_PT: Record<string, string> = { 'Erreur de chargement': 'erro de carregamento' }

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

// ── Position d'un chantier sans coordonnées, pour la météo seulement ──
// Jamais enregistrée dans la fiche : la position de la fiche déclenche le pointage automatique des employés et ne se
// règle que par un geste du gérant (bouton GPS de la fiche, Pointage › Affectations). Ici, une position approximative
// (centre de la commune) suffit. Les résultats sont gardés sur le téléphone et les appels espacés d'au moins une seconde :
// la politique d'utilisation de Nominatim l'exige, et l'adresse d'un chantier ne change pas à chaque visite.

type PositionMeteo = { lat: number; lng: number }
type PositionGardee = { lat?: number; lng?: number; t: number }

const CLE_CACHE_POSITIONS = 'vitfix_btp_meteo_positions'
const DUREE_CACHE_MS = 30 * 86_400_000
/** Adresse introuvable : gardé moins longtemps (adresse corrigée entre-temps, service rétabli). */
const DUREE_CACHE_ECHEC_MS = 86_400_000
/** Au moins une seconde entre deux géocodages (Nominatim : une requête par seconde au plus). */
const ECART_APPELS_MS = 1100

function lirePositionsGardees(): Record<string, PositionGardee> {
  try {
    const lu: unknown = JSON.parse(localStorage.getItem(CLE_CACHE_POSITIONS) ?? '{}')
    return lu && typeof lu === 'object' ? (lu as Record<string, PositionGardee>) : {}
  } catch {
    // Stockage indisponible ou illisible : sans cache, les appels restent espacés.
    return {}
  }
}

function garderPositions(positions: Record<string, PositionGardee>): void {
  try {
    localStorage.setItem(CLE_CACHE_POSITIONS, JSON.stringify(positions))
  } catch (err) {
    console.warn('[MeteoChantier] positions non gardées :', err)
  }
}

/** Dernier recours : Open-Meteo par nom de ville, en préférant une ville du pays de la société (« Porto » au Portugal). */
async function parOpenMeteo(adresse: string, pays: Pays): Promise<PositionMeteo | null> {
  for (const candidate of extractCityName(adresse)) {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=5&language=${pays === 'PT' ? 'pt' : 'fr'}`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (!res.ok) continue
      const json = await res.json() as { results?: Array<{ latitude: number; longitude: number; country_code?: string }> }
      const resultat = json.results?.find(r => r.country_code === pays) ?? json.results?.[0]
      if (resultat) return { lat: resultat.latitude, lng: resultat.longitude }
    } catch (err) {
      console.warn('[MeteoChantier] Open-Meteo injoignable :', err)
    }
  }
  return null
}

/** Position pour la météo : l'adresse (même approximative : la BAN en France, Nominatim au Portugal), sinon la ville. */
async function positionMeteo(chantier: ChantierItem, pays: Pays): Promise<PositionMeteo | null> {
  const trouve = await geocoderAdresse(chantier, pays)
  if (trouve) return { lat: trouve.latitude, lng: trouve.longitude }
  return parOpenMeteo(chantier.ville?.trim() || chantier.adresse || '', pays)
}

/** Positions des chantiers sans coordonnées : gardées d'une visite à l'autre, une par une sinon, appels espacés. */
async function positionsPourMeteo(chantiers: ChantierItem[], pays: Pays): Promise<Map<string, PositionMeteo>> {
  const positions = new Map<string, PositionMeteo>()
  const gardees = lirePositionsGardees()
  let finDernierAppel = 0
  let modifiees = false
  for (const chantier of chantiers) {
    if (chantier.latitude && chantier.longitude) continue
    const cle = `${pays}|${adresseComplete(chantier)}`
    const gardee = gardees[cle]
    const trouveeAvant = typeof gardee?.lat === 'number' && typeof gardee.lng === 'number'
    if (gardee && Date.now() - gardee.t < (trouveeAvant ? DUREE_CACHE_MS : DUREE_CACHE_ECHEC_MS)) {
      if (trouveeAvant) positions.set(chantier.id, { lat: gardee.lat as number, lng: gardee.lng as number })
      continue
    }
    const attente = finDernierAppel + ECART_APPELS_MS - Date.now()
    if (attente > 0) await new Promise(resolve => setTimeout(resolve, attente))
    const trouvee = await positionMeteo(chantier, pays)
    finDernierAppel = Date.now()
    gardees[cle] = trouvee ? { ...trouvee, t: finDernierAppel } : { t: finDernierAppel }
    modifiees = true
    if (trouvee) positions.set(chantier.id, trouvee)
  }
  if (modifiees) garderPositions(gardees)
  return positions
}

// ── Lieux de devis suivis (bouton « Importer une adresse depuis un devis ») ──
// Prévisions du lieu d'intervention d'un devis qui n'est pas (encore) un chantier, sans retaper l'adresse. Le devis
// n'est pas modifié ; les lieux suivis restent sur l'appareil (lib/btp/lieu-devis.ts).

interface DevisChoix { id: string; numero: string | null; client_name: string | null; lieu: LieuDevis }

/** Devis de la fiche (les plus récents d'abord) qui portent un lieu d'intervention, ou à défaut l'adresse du client. */
async function chargerDevisAvecLieu(ficheId: string): Promise<DevisChoix[]> {
  const base = 'id, numero, client_name, created_at'
  const requete = (colonnes: string) => supabase.from('devis').select(colonnes)
    .eq('artisan_id', ficheId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100)
  let { data, error } = await requete(`${base}, ${COLONNES_LIEU_DEVIS}`)
  // Base sans colonne raw_data (migration 074 absente) : l'ancienne colonne client_address seule (que la
  // synchronisation n'écrit plus : demandée seulement ici).
  if (error) ({ data, error } = await requete(`${base}, client_address`))
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).flatMap(d => {
    const lieu = lieuDuDevis(d)
    if (!lieu || typeof d.id !== 'string') return []
    return [{ id: d.id, numero: typeof d.numero === 'string' ? d.numero : null, client_name: typeof d.client_name === 'string' ? d.client_name : null, lieu }]
  })
}

function lireLieuxMeteo(ficheId: string): LieuMeteoDevis[] {
  if (!ficheId) return []
  try {
    return lieuxMeteoValides(JSON.parse(localStorage.getItem(cleLieuxMeteo(ficheId)) ?? '[]'))
  } catch (err) {
    console.warn('[MeteoChantier] lieux de devis illisibles :', err)
    return []
  }
}

function garderLieuxMeteo(ficheId: string, lieux: LieuMeteoDevis[]): void {
  if (!ficheId) return
  try {
    localStorage.setItem(cleLieuxMeteo(ficheId), JSON.stringify(lieux))
  } catch (err) {
    console.warn('[MeteoChantier] lieux de devis non gardés :', err)
  }
}

/** Carte météo d'un lieu de devis, traitée comme un chantier (position, prévisions) sous un identifiant à part. */
function carteDuLieu(l: LieuMeteoDevis, isPt?: boolean): ChantierItem {
  const ref = l.numero || (isPt ? 'rascunho' : 'brouillon')
  const devis = `${isPt ? 'Orçamento' : 'Devis'} ${ref}`
  return {
    id: `${PREFIXE_CARTE_DEVIS}${l.devisId}`,
    titre: [devis, l.client].filter(Boolean).join(' · '),
    ...champsAdresseDuLieu(l.lieu, isPt ? 'PT' : 'FR'),
    statut: 'En attente',
  }
}

function formatDayShort(dateStr: string, isPt?: boolean): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekday = d.toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { weekday: 'short' })
  const day = d.getDate()
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day}`
}

// Seuils et consignes issus de la pratique française (le français cite le Code du travail et la réglementation) : en
// portugais, les consignes de vent et de chaleur restent des conseils, sans interdiction ni texte de loi portugais qui
// n'ont pas été vérifiés (limites du fabricant de la grue, plan de segurança e saúde de l'obra).
function getBTPImpactMessage(day: DayForecast, isPt?: boolean): string | null {
  if (day.windMax > 60) {
    return isPt
      ? `Vento ${Math.round(day.windMax)} km/h. Trabalhos em andaimes e com grua desaconselhados: respeite os limites do fabricante e o plano de segurança e saúde. Prever trabalhos interiores.`
      : `Vent ${Math.round(day.windMax)} km/h — INTERDICTION échafaudage et grue (réglementation). Seuls les lots intérieurs autorisés.`
  }
  if (day.rain > 5) {
    return isPt
      ? `Chuva de ${day.rain} mm prevista. Rebocos de fachada desaconselhados. Prever trabalhos interiores ou adiar.`
      : `Pluie ${day.rain}mm prévue — ravalement façade déconseillé. Prévoir travaux intérieurs ou report.`
  }
  if (day.tempMin < 0) {
    return isPt
      ? `Gelo ${Math.round(day.tempMin)} °C. Sem alvenaria nem betonagem. Risco de fissuração.`
      : `Gel ${Math.round(day.tempMin)}°C — pas de maçonnerie ni béton. Risque de fissuration.`
  }
  if (day.tempMax > 33) {
    return isPt
      ? `Calor ${Math.round(day.tempMax)} °C. Prever horários de trabalho adaptados.`
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
    return { label: `⚠️ ${isPt ? 'Aviso' : 'Vigilance'} ${dayName.split(' ')[0].toLowerCase()}`, className: 'v5-badge v5-badge-orange' }
  }
  return { label: isPt ? '✅ Sem alertas' : `✅ RAS`, className: 'v5-badge v5-badge-green' }
}

/** Aucun lieu de devis : même tableau d'un rendu à l'autre, pour ne pas relancer les calculs qui en dépendent. */
const AUCUN_LIEU: LieuMeteoDevis[] = []

/**
 * `importDevis` : le compte lit-il les devis ? Sinon (salarié de terrain, 25/11/2026 : il ne reçoit que la météo de
 * ses chantiers), ni bouton « Importer une adresse depuis un devis », ni lieux de devis suivis : sa liste de devis
 * serait vide, et des lieux gardés sur un appareil partagé ne le concernent pas.
 */
export function MeteoChantierSection({ userId, authUserId: authUserIdProp, isPt, importDevis = true }: { userId: string; authUserId?: string; isPt?: boolean; importDevis?: boolean }) {
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

  // Lieux de devis suivis : lus dès le premier rendu, pour que le premier chargement des prévisions les compte, et relus
  // si la fiche affichée change sans que la page soit démontée (ceux d'une fiche ne passent jamais sous une autre).
  const [lieuxEtat, setLieuxEtat] = useState(() => ({ fiche: userId, lieux: lireLieuxMeteo(userId) }))
  if (lieuxEtat.fiche !== userId) setLieuxEtat({ fiche: userId, lieux: lireLieuxMeteo(userId) })
  const lieuxDevis = importDevis ? lieuxEtat.lieux : AUCUN_LIEU
  const changerLieux = (lieux: LieuMeteoDevis[]) => {
    setLieuxEtat({ fiche: userId, lieux })
    garderLieuxMeteo(userId, lieux)
  }
  const cartesLieux = useMemo(() => lieuxDevis.map(l => carteDuLieu(l, isPt)), [lieuxDevis, isPt])
  /** Tout ce dont la météo se charge : chantiers actifs localisés, puis lieux de devis. */
  const elementsMeteo = [...chantiersAvecLocalisation, ...cartesLieux]
  /** Cartes dont le dernier chargement a échoué (pas encore chargée : « Chargement », pas « indisponible »). */
  const [cartesEnEchec, setCartesEnEchec] = useState<ReadonlySet<string>>(() => new Set())
  const [choixDevisOuvert, setChoixDevisOuvert] = useState(false)
  /** Devis proposés à l'import ; null pendant le chargement. */
  const [devisChoix, setDevisChoix] = useState<DevisChoix[] | null>(null)
  const [erreurDevis, setErreurDevis] = useState(false)

  /**
   * Charge les prévisions de `chantiersToFetch`. `ajout` : un lieu de devis vient d'être importé, ses prévisions
   * s'ajoutent aux cartes affichées au lieu de les remplacer.
   */
  const fetchMeteo = useCallback(async (chantiersToFetch: ChantierItem[], ajout = false) => {
    if (chantiersToFetch.length === 0) return
    setMeteoLoading(true)
    if (!ajout) {
      setMeteoError(null)
      setDebugInfo('')
    }
    const failedNames: string[] = []
    // Échecs : les cartes rechargées n'en sont plus pendant le chargement (« Chargement », pas « indisponibles ») ; un
    // rechargement complet efface les précédents, un ajout ne touche que ses cartes.
    const charges = new Set(chantiersToFetch.map(c => c.id))
    setCartesEnEchec(prev => (ajout ? new Set([...prev].filter(id => !charges.has(id))) : new Set()))
    const noterEchecs = (echoues: ChantierItem[]) => {
      if (echoues.length > 0) setCartesEnEchec(prev => new Set([...prev, ...echoues.map(c => c.id)]))
    }
    try {
      const positions = await positionsPourMeteo(chantiersToFetch, isPt ? 'PT' : 'FR')
      const results: ChantierMeteo[] = (await Promise.all(
        chantiersToFetch.map(async (chantier) => {
          try {
            let lat = chantier.latitude
            let lng = chantier.longitude
            if (!lat || !lng) {
              // Position pour la météo seulement, jamais enregistrée dans la fiche (voir positionsPourMeteo).
              const geo = positions.get(chantier.id)
              if (!geo) {
                failedNames.push(`${chantier.titre} (${chantier.ville || chantier.adresse})`)
                return null
              }
              lat = geo.lat; lng = geo.lng
            }
            // Coordonnées converties, bornées et passées en paramètres d'URL (lib/btp/meteo-url.ts)
            const urlMeteo = urlPrevisionsMeteo(lat, lng)
            if (!urlMeteo) {
              failedNames.push(`${chantier.titre} (${isPt ? 'coordenadas inválidas' : 'coordonnées invalides'})`)
              return null
            }
            const res = await fetch(urlMeteo)
            if (!res.ok) {
              failedNames.push(`${chantier.titre} (${isPt ? 'erro da API' : 'API erreur'} ${res.status})`)
              return null
            }
            const json = await res.json()
            if (!json.daily?.time) {
              failedNames.push(`${chantier.titre} (${isPt ? 'dados vazios' : 'données vides'})`)
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
            failedNames.push(`${chantier.titre} (${isPt ? 'erro inesperado' : 'exception'})`)
            return null
          }
        })
      )).filter(Boolean) as ChantierMeteo[]
      const reussis = new Set(results.map(r => r.chantier.id))
      noterEchecs(chantiersToFetch.filter(c => !reussis.has(c.id)))
      if (ajout) {
        const remplaces = new Set(chantiersToFetch.map(c => c.id))
        setMeteoData(prev => [...prev.filter(m => !remplaces.has(m.chantier.id)), ...results])
        if (failedNames.length > 0) setDebugInfo(`${isPt ? 'Meteorologia indisponível para:' : 'Météo indisponible pour :'} ${failedNames.join(', ')}`)
        return
      }
      setMeteoData(results)
      if (results.length === 0 && chantiersToFetch.length > 0) {
        setMeteoError(isPt
          ? `A geocodificação falhou para ${chantiersToFetch.length} obra(s). Verifique as moradas.`
          : `Géocodage échoué pour ${chantiersToFetch.length} chantier(s). Vérifiez les adresses.`)
      } else if (failedNames.length > 0) {
        setDebugInfo(`${isPt ? 'Meteorologia indisponível para:' : 'Météo indisponible pour :'} ${failedNames.join(', ')}`)
      }
    } catch {
      noterEchecs(chantiersToFetch)
      setMeteoError(isPt ? 'Erro ao carregar os dados meteorológicos.' : 'Erreur lors du chargement des données météo.')
    } finally {
      setMeteoLoading(false)
    }
  }, [isPt])

  // Reset fetchedRef when authUserId changes (ensures re-fetch with correct cache)
  useEffect(() => {
    fetchedRef.current = false
  }, [authUserId])

  // Auto-fetch weather when chantiers are loaded (hash IDs+adresses to detect content changes)
  const chantiersKey = elementsMeteo.map(c => `${c.id}:${c.ville || c.adresse}`).join(',')
  useEffect(() => {
    if (chantiersLoading) return
    if (elementsMeteo.length === 0) return
    if (fetchedRef.current) return
    fetchedRef.current = true
    const timer = setTimeout(() => { void fetchMeteo(elementsMeteo) }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantiersLoading, chantiersKey])

  /** Ouvre la liste des devis (rechargée à chaque ouverture : un devis vient peut-être d'être créé). */
  const ouvrirChoixDevis = () => {
    if (choixDevisOuvert) { setChoixDevisOuvert(false); return }
    setChoixDevisOuvert(true)
    setDevisChoix(null)
    setErreurDevis(false)
    chargerDevisAvecLieu(userId)
      .then(setDevisChoix)
      .catch((err: unknown) => {
        console.warn('[MeteoChantier] devis non chargés :', err)
        setErreurDevis(true)
        setDevisChoix([])
      })
  }

  const importerLieuDevis = (devis: DevisChoix) => {
    const nouveau: LieuMeteoDevis = {
      devisId: devis.id, numero: devis.numero ?? '', client: devis.client_name ?? '', lieu: devis.lieu.texte, source: devis.lieu.source,
    }
    changerLieux(ajouterLieuMeteo(lieuxDevis, nouveau))
    setChoixDevisOuvert(false)
    // Rien de chargé encore (page sans chantier localisé) : le chargement automatique part avec ce lieu ; sinon, seules
    // ses prévisions s'ajoutent (la liste est désactivée pendant un chargement : pas de course avec « Actualiser »).
    if (fetchedRef.current) void fetchMeteo([carteDuLieu(nouveau, isPt)], true)
    const ref = nouveau.numero || (isPt ? 'rascunho' : 'brouillon')
    toast.success(isPt
      ? `Meteorologia adicionada para o local do orçamento ${ref}.${nouveau.source === 'client' ? ' Sem local de intervenção no orçamento: é a morada do cliente.' : ''}`
      : `Météo ajoutée pour le lieu du devis ${ref}.${nouveau.source === 'client' ? ' Pas de lieu d’intervention sur ce devis : c’est l’adresse du client.' : ''}`)
  }

  const retirerLieuDevis = (devisId: string) => {
    changerLieux(lieuxDevis.filter(l => l.devisId !== devisId))
    const carteId = `${PREFIXE_CARTE_DEVIS}${devisId}`
    setMeteoData(prev => prev.filter(m => m.chantier.id !== carteId))
    setCartesEnEchec(prev => new Set([...prev].filter(id => id !== carteId)))
  }

  // Les indicateurs comptent les chantiers seulement ; les lieux de devis ont leurs cartes à part.
  const meteoChantiers = meteoData.filter(m => !m.chantier.id.startsWith(PREFIXE_CARTE_DEVIS))
  const meteoParCarte = new Map(meteoData.map(m => [m.chantier.id, m]))
  const nbOk = meteoChantiers.filter(m => m.alert === 'ok').length
  const nbVigilance = meteoChantiers.filter(m => m.alert === 'vigilance').length
  const nbRouge = meteoChantiers.filter(m => m.alert === 'rouge').length
  const nbGel = meteoChantiers.reduce((n, m) => n + (m.forecast.slice(0, 7).some(d => d.tempMin < 0) ? 1 : 0), 0)

  if (chantiersLoading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>{isPt ? 'A carregar obras...' : 'Chargement des chantiers...'}</div>

  return (
    <div className="v5-fade">
      <div className="v5-pg-t" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h1>{isPt ? 'Meteorologia das obras' : 'Météo chantiers'}</h1>
          <p>{isPt ? 'Previsões automáticas por obra · dados Open-Meteo' : 'Prévisions automatiques par chantier — données Open-Meteo'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Désactivé pendant un chargement : sa fin remplacerait les cartes, sans le lieu importé entre-temps. */}
          {importDevis && (
            <button className="v5-btn" onClick={ouvrirChoixDevis} disabled={meteoLoading} aria-expanded={choixDevisOuvert}>
              📄 {isPt ? 'Importar morada de um orçamento' : 'Importer une adresse depuis un devis'}
            </button>
          )}
          {(meteoData.length > 0 || elementsMeteo.length > 0) && (
            <button className="v5-btn v5-btn-p" onClick={() => { fetchedRef.current = true; setChoixDevisOuvert(false); setMeteoData([]); void fetchMeteo(elementsMeteo) }} disabled={meteoLoading}>
              {meteoLoading ? (isPt ? 'A carregar...' : 'Chargement...') : (isPt ? 'Atualizar' : 'Actualiser')}
            </button>
          )}
        </div>
      </div>

      {/* Choix du devis dont le lieu d'intervention reçoit ses prévisions */}
      {importDevis && choixDevisOuvert && (
        <div style={{ background: '#E3F2FD', borderRadius: 6, padding: 12, border: '1px solid #90CAF9', marginBottom: '.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label htmlFor="meteo-choix-devis" style={{ fontSize: 11, fontWeight: 600, color: '#1565C0' }}>
              📄 {isPt ? 'Local de intervenção de um orçamento' : 'Lieu d’intervention d’un devis'}
            </label>
            <button className="v5-btn v5-btn-sm" onClick={() => setChoixDevisOuvert(false)} aria-label={isPt ? 'Fechar' : 'Fermer'}>✕</button>
          </div>
          {contenuChoixDevis()}
          <div style={{ fontSize: 10, color: '#666', marginTop: 6 }}>
            {isPt
              ? 'As previsões deste local aparecem abaixo das obras. O orçamento não é alterado.'
              : 'Les prévisions de ce lieu s’affichent sous les chantiers. Le devis n’est pas modifié.'}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="v5-kpi-g">
        <div className="v5-kpi" style={{ borderLeft: '4px solid #4CAF50' }}>
          <div className="v5-kpi-l">{isPt ? 'Obras OK' : 'Chantiers OK'}</div>
          <div className="v5-kpi-v" style={{ color: '#4CAF50' }}>{meteoLoading ? '...' : nbOk}</div>
          <div className="v5-kpi-s">{isPt ? 'sem alerta' : "pas d'alerte"}</div>
        </div>
        <div className="v5-kpi" style={{ borderLeft: '4px solid #FFA726' }}>
          <div className="v5-kpi-l">{isPt ? 'Avisos' : 'Vigilance'}</div>
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
          {isPt
            ? `${chantiers.length} obra(s) carregada(s), mas nenhuma ativa (estados: ${chantiers.map(c => STATUTS_PT[c.statut] ?? c.statut).join(', ')}). Apenas são apresentadas as obras "Em curso" ou "Pendente".`
            : `${chantiers.length} chantier(s) chargés, mais aucun actif (statuts: ${chantiers.map(c => c.statut).join(', ')}). Seuls les chantiers "En cours" ou "En attente" sont affichés.`
          }
        </div>
      )}

      {/* Aucun chantier */}
      {chantiersActifs.length === 0 && chantiers.length === 0 && !chantiersError && (
        <div className="v5-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{isPt ? 'Nenhuma obra ativa' : 'Aucun chantier actif'}</h3>
          <p style={{ fontSize: 12, color: '#999' }}>{isPt ? 'Crie obras na secção Obras para ver as previsões meteorológicas.' : 'Créez des chantiers dans la section Chantiers pour voir les prévisions météo.'}</p>
        </div>
      )}

      {/* Erreur chargement chantiers */}
      {chantiersError && (
        <div className="v5-al warning" style={{ marginBottom: '.75rem' }}>
          {isPt ? 'Erro ao carregar as obras.' : 'Erreur lors du chargement des chantiers.'}
          <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>({isPt ? ERREURS_CHARGEMENT_PT[chantiersError] ?? chantiersError : chantiersError})</span>
        </div>
      )}

      {/* Chantiers sans adresse */}
      {chantiersSansLocalisation.length > 0 && (
        <div className="v5-al info" style={{ marginBottom: '.75rem' }}>
          <strong>{chantiersSansLocalisation.length} {isPt ? 'obra(s) sem cidade' : 'chantier(s) sans ville'}</strong>{isPt ? '. ' : ' — '}{isPt ? 'Adicione a cidade na secção Obras para ativar a meteorologia.' : 'Ajoutez la ville dans la section Chantiers pour activer la météo.'}
          <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
            {chantiersSansLocalisation.slice(0, 5).map(c => c.titre).join(', ')}{chantiersSansLocalisation.length > 5 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Erreur météo */}
      {meteoError && (
        <div className="v5-al warning" style={{ marginBottom: '.75rem' }}>
          {meteoError}
          <button className="v5-btn v5-btn-p" style={{ marginLeft: 12, fontSize: 11 }} disabled={meteoLoading} onClick={() => { fetchedRef.current = false; setChoixDevisOuvert(false); void fetchMeteo(elementsMeteo) }}>{isPt ? 'Tentar novamente' : 'Réessayer'}</button>
        </div>
      )}

      {/* Debug info partiel */}
      {debugInfo && (
        <div className="v5-al info" style={{ marginBottom: '.75rem', fontSize: 11 }}>
          {debugInfo}
        </div>
      )}

      {/* Section title */}
      {meteoChantiers.length > 0 && (
        <div className="v5-st" style={{ marginBottom: '.5rem' }}>
          {isPt ? 'Previsões a 5 dias por obra' : 'Prévisions 5 jours par chantier'}
        </div>
      )}

      {/* Liste des chantiers — layout du mockup HTML v6 */}
      {meteoChantiers.map(m => carteMeteo(m))}

      {/* Lieux de devis suivis : une carte par lieu, même sans prévisions (pour pouvoir le retirer) */}
      {lieuxDevis.length > 0 && (
        <div className="v5-st" style={{ margin: '1rem 0 .5rem' }}>
          {isPt ? 'Locais de intervenção dos orçamentos' : 'Lieux d’intervention des devis'}
        </div>
      )}
      {lieuxDevis.map((lieu, i) => {
        const carte = cartesLieux[i]
        const suivi = { texte: lieu.lieu, retirer: () => retirerLieuDevis(lieu.devisId) }
        const m = meteoParCarte.get(carte.id)
        if (m) return carteMeteo(m, suivi)
        return (
          <div key={carte.id} className="v5-card" style={{ marginBottom: '.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>📄 {carte.titre}</span>
                <span style={{ fontSize: 10, color: '#999', marginLeft: 8 }}>{lieu.lieu}</span>
              </div>
              {boutonRetirer(suivi.retirer)}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: '.5rem', padding: '.5rem', background: '#F5F5F5', borderRadius: 4 }}>
              {messageSansPrevisions(carte.id)}
            </div>
          </div>
        )
      })}

      {/* Loading indicator for meteo */}
      {meteoLoading && elementsMeteo.length > 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: 12 }}>
          {isPt ? 'A carregar previsões meteorológicas...' : 'Chargement des prévisions météo...'}
        </div>
      )}

      {/* Seuils BTP (pratique française, voir getBTPImpactMessage) */}
      <div style={{ fontSize: 10, color: '#999', marginTop: '.75rem' }}>
        {isPt
          ? 'Limiares de obra: 🌧️ Chuva > 5 mm = sem rebocos/betonagem • 💨 Vento > 60 km/h = grua/andaimes desaconselhados • ❄️ Gelo = sem alvenaria • 🌡️ > 33 °C = horários adaptados'
          : <>Seuils BTP : 🌧️ Pluie {'>'} 5mm = pas de ravalement/béton • 💨 Vent {'>'} 60 km/h = arrêt grue/échafaudage • ❄️ Gel = pas de maçonnerie • 🌡️ {'>'} 33°C = horaires aménagés obligatoires</>}
      </div>
    </div>
  )

  /** Liste des devis à importer, ou ce qui en tient lieu (chargement, erreur, aucun devis). */
  function contenuChoixDevis() {
    if (devisChoix === null) {
      return <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'A carregar os orçamentos...' : 'Chargement des devis...'}</div>
    }
    if (erreurDevis) {
      return <div style={{ fontSize: 11, color: '#C62828' }}>{isPt ? 'Não foi possível carregar os orçamentos. Tente novamente.' : 'Impossible de charger les devis. Réessayez.'}</div>
    }
    if (devisChoix.length === 0) {
      return <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Nenhum orçamento com local de intervenção ou morada do cliente.' : 'Aucun devis avec un lieu d’intervention ou une adresse du client.'}</div>
    }
    const liste = devisChoix
    return (
      // Désactivée pendant un chargement (voir le bouton d'ouverture).
      <select
        id="meteo-choix-devis"
        className="v5-fi"
        style={{ width: '100%', fontSize: 11 }}
        value=""
        disabled={meteoLoading}
        onChange={e => {
          const devis = liste.find(d => d.id === e.target.value)
          if (devis) importerLieuDevis(devis)
        }}
      >
        <option value="">{isPt ? 'Selecionar um orçamento...' : '— Sélectionner un devis —'}</option>
        {liste.map(d => (
          <option key={d.id} value={d.id} title={d.lieu.texte}>{libelleChoixDevis(d, d.lieu, !!isPt)}</option>
        ))}
      </select>
    )
  }

  /** Carte d'un lieu de devis sans prévisions : en cours de chargement, ou dernier essai échoué. */
  function messageSansPrevisions(carteId: string) {
    if (!cartesEnEchec.has(carteId)) return isPt ? 'A carregar previsões meteorológicas...' : 'Chargement des prévisions météo...'
    // Une adresse introuvable reste en échec une journée (positionsPourMeteo) : la corriger dans le devis et réimporter
    // le devis donne une nouvelle adresse, donc un nouvel essai ; « Actualiser » ne sert que si le service était coupé.
    return isPt
      ? 'Previsões indisponíveis para este local (morada não encontrada ou serviço meteorológico inacessível). Se a morada estiver errada, corrija-a no orçamento e importe-o novamente; caso contrário, tente mais tarde com «Atualizar».'
      : 'Prévisions indisponibles pour ce lieu (adresse introuvable ou service météo injoignable). Si l’adresse est fausse, corrigez-la dans le devis puis réimportez-le ; sinon, réessayez plus tard avec « Actualiser ».'
  }

  function boutonRetirer(retirer: () => void) {
    const libelle = isPt ? 'Retirar este local da meteorologia' : 'Retirer ce lieu de la météo'
    return <button className="v5-btn v5-btn-sm" onClick={retirer} aria-label={libelle} title={libelle}>✕</button>
  }

  /** Carte de prévisions d'un chantier, ou d'un lieu de devis suivi (`suivi` : son texte entier et le bouton Retirer). */
  function carteMeteo(m: ChantierMeteo, suivi?: { texte: string; retirer: () => void }) {
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
                <span style={{ fontWeight: 600, fontSize: 13 }}>{suivi ? '📄' : '🏗️'} {m.chantier.titre}</span>
                <span style={{ fontSize: 10, color: '#999', marginLeft: 8 }} title={suivi?.texte}>{cityShort}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span className={badge.className}>{badge.label}</span>
                {suivi && boutonRetirer(suivi.retirer)}
              </div>
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
                        ? (isPt ? `🌧 ${day.rain} mm` : `🌧 ${day.rain}mm`)
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
                className="v5-al"
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
                <strong>{worstDayLabel}{isPt ? ':' : ' :'}</strong>{' '}
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
  }
}
