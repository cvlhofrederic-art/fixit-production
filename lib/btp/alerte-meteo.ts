/**
 * Alerte météo d'un chantier (décision de Frédéric du 26/11/2026) : « il faudra que l'alerte pluie par exemple sonne
 * uniquement pour les chantiers en extérieur donc il faudra avoir la possibilité de soumettre un chantier à l'alerte
 * météo par notif ou pas si cela le concerne, exemple on fait une dalle béton mais il pleut ».
 *
 * Fonctions pures, partagées par l'écran Météo (seuils), la notification du téléphone
 * (lib/btp/alerte-meteo-telephone.ts) et l'e-mail de la veille (app/api/cron/alerte-meteo) : les trois disent la même
 * chose du même jour.
 */

/** Seuils des alertes de l'écran Météo, repris tels quels pour la notification et l'e-mail. */
export const SEUILS_ALERTE_METEO = {
  /** Vent maximal, au-delà duquel le jour est en alerte rouge (km/h). */
  ventKmh: 60,
  /** Température minimale sous laquelle il gèle (°C). */
  gelC: 0,
  /** Cumul de pluie de la journée au-delà duquel ravalement et béton sont déconseillés (mm). */
  pluieMm: 5,
  /** Température maximale au-delà de laquelle la chaleur gêne le chantier (°C). */
  chaleurC: 33,
} as const

/** Prévision d'une journée, telle que l'écran Météo la lit dans la réponse d'Open-Meteo. */
export interface JourPrevu {
  date: string
  tempMax: number
  tempMin: number
  rain: number
  windMax: number
  weatherCode: number
}

export type TypeMotifAlerte = 'pluie' | 'gel' | 'vent' | 'chaleur'

export interface MotifAlerte {
  type: TypeMotifAlerte
  /** Valeur arrondie : mm de pluie, °C de gel ou de chaleur, km/h de vent. */
  valeur: number
}

const nombreFini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Jours de la réponse quotidienne d'Open-Meteo (`daily`), dans l'ordre. Un jour dont une mesure manque ou n'est pas
 * un nombre est écarté : il ne déclenche jamais d'alerte sur une valeur inventée. Réponse illisible : aucun jour.
 */
export function joursDePrevisions(reponse: unknown): JourPrevu[] {
  if (typeof reponse !== 'object' || reponse === null) return []
  const daily = (reponse as { daily?: unknown }).daily
  if (typeof daily !== 'object' || daily === null) return []
  const d = daily as Record<string, unknown>
  const liste = (cle: string): unknown[] => (Array.isArray(d[cle]) ? d[cle] : [])
  const dates = liste('time')
  const max = liste('temperature_2m_max')
  const min = liste('temperature_2m_min')
  const pluie = liste('precipitation_sum')
  const vent = liste('wind_speed_10m_max')
  const code = liste('weather_code')
  const jours: JourPrevu[] = []
  dates.forEach((date, i) => {
    const valeurs = [max[i], min[i], pluie[i], vent[i]]
    if (typeof date !== 'string' || !valeurs.every(nombreFini)) return
    jours.push({
      date,
      tempMax: max[i] as number,
      tempMin: min[i] as number,
      rain: pluie[i] as number,
      windMax: vent[i] as number,
      weatherCode: nombreFini(code[i]) ? code[i] : 0,
    })
  })
  return jours
}

/** Ce qui met la journée en alerte, dans l'ordre de gravité de l'écran Météo (vent, gel, pluie, chaleur). */
export function motifsDuJour(jour: JourPrevu): MotifAlerte[] {
  const motifs: MotifAlerte[] = []
  if (jour.windMax > SEUILS_ALERTE_METEO.ventKmh) motifs.push({ type: 'vent', valeur: Math.round(jour.windMax) })
  if (jour.tempMin < SEUILS_ALERTE_METEO.gelC) motifs.push({ type: 'gel', valeur: Math.round(jour.tempMin) })
  if (jour.rain > SEUILS_ALERTE_METEO.pluieMm) motifs.push({ type: 'pluie', valeur: Math.round(jour.rain) })
  if (jour.tempMax > SEUILS_ALERTE_METEO.chaleurC) motifs.push({ type: 'chaleur', valeur: Math.round(jour.tempMax) })
  return motifs
}

/**
 * Alerte du lendemain : Open-Meteo est interrogé avec `timezone=auto`, le premier jour de la réponse est donc
 * « aujourd'hui » à l'heure du chantier et le second « demain ». Aucune alerte : null.
 */
export function alerteDuLendemain(jours: readonly JourPrevu[]): { date: string; motifs: MotifAlerte[] } | null {
  const demain = jours[1]
  if (!demain) return null
  const motifs = motifsDuJour(demain)
  return motifs.length > 0 ? { date: demain.date, motifs } : null
}

const LIBELLES: Record<TypeMotifAlerte, { fr: (v: number) => string; pt: (v: number) => string }> = {
  pluie: { fr: v => `pluie ${v} mm`, pt: v => `chuva ${v} mm` },
  gel: { fr: v => `gel ${v} °C`, pt: v => `geada ${v} °C` },
  vent: { fr: v => `vent ${v} km/h`, pt: v => `vento ${v} km/h` },
  chaleur: { fr: v => `chaleur ${v} °C`, pt: v => `calor ${v} °C` },
}

const ICONES: Record<TypeMotifAlerte, string> = { pluie: '🌧️', gel: '❄️', vent: '💨', chaleur: '🌡️' }

/** « pluie 12 mm, vent 65 km/h » (ou en portugais). */
export function libelleMotifs(motifs: readonly MotifAlerte[], isPt: boolean): string {
  return motifs.map(m => (isPt ? LIBELLES[m.type].pt(m.valeur) : LIBELLES[m.type].fr(m.valeur))).join(', ')
}

/** Titre et texte de la notification ou de l'e-mail de la veille, pour un chantier. */
export function texteAlerteDuLendemain(
  titreChantier: string, motifs: readonly MotifAlerte[], isPt: boolean,
): { titre: string; corps: string } {
  const icone = motifs[0] ? ICONES[motifs[0].type] : '⚠️'
  const chantier = titreChantier.trim() || (isPt ? 'Obra' : 'Chantier')
  const detail = libelleMotifs(motifs, isPt)
  return isPt
    ? { titre: `${icone} Alerta meteorológico amanhã: ${chantier}`, corps: `Previsto para amanhã na obra « ${chantier} »: ${detail}.` }
    : { titre: `${icone} Alerte météo demain : ${chantier}`, corps: `Prévu demain sur le chantier « ${chantier} » : ${detail}.` }
}

/** Le chantier est-il suivi par l'alerte ? Seulement s'il est soumis à l'alerte et encore actif. */
export function chantierSoumisAlerte(chantier: { alerte_meteo?: unknown; alerteMeteo?: unknown; statut?: unknown }): boolean {
  const soumis = chantier.alerteMeteo === true || chantier.alerte_meteo === true
  return soumis && chantier.statut !== 'Terminé' && chantier.statut !== 'Annulé'
}
