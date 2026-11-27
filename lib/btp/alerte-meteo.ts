/**
 * Alerte météo d'un chantier (décision de Frédéric du 26/11/2026) : « il faudra que l'alerte pluie par exemple sonne
 * uniquement pour les chantiers en extérieur donc il faudra avoir la possibilité de soumettre un chantier à l'alerte
 * météo par notif ou pas si cela le concerne, exemple on fait une dalle béton mais il pleut ».
 *
 * Fonctions pures, partagées par l'écran Météo (seuils), la notification du téléphone
 * (lib/btp/alerte-meteo-telephone.ts) et l'e-mail de la veille (app/api/cron/alerte-meteo) : mêmes seuils, même
 * texte, et une seule règle pour dire qu'un chantier est suivi tel jour (chantierSuiviLe). Un jour de prévision est
 * toujours cherché par sa date, jamais par sa place dans la réponse (un jour incomplet est écarté, et le premier jour
 * de la réponse est celui du chantier, pas forcément celui du téléphone).
 */

import { coordonneesValides } from '@/lib/btp/meteo-url'
import { STATUT_EN_COURS } from '@/lib/btp/pointage-regles'

/** Statut d'un chantier créé et pas encore commencé (valeur par défaut de la fiche et de la base). */
export const STATUT_EN_ATTENTE = 'En attente'

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

export interface AlerteDuJour {
  date: string
  motifs: MotifAlerte[]
}

/** Ce qu'il faut d'un chantier pour savoir s'il est suivi : la case, le statut et la date de début. */
export interface ChantierSoumis {
  alerte_meteo?: unknown
  alerteMeteo?: unknown
  statut?: unknown
  date_debut?: unknown
  dateDebut?: unknown
}

const nombreFini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const FORME_DATE = /^\d{4}-\d{2}-\d{2}/

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

/** Jour de la prévision qui porte cette date (AAAA-MM-JJ) ; absent de la réponse ou écarté car incomplet : null. */
export function jourDeLaDate(jours: readonly JourPrevu[], date: string): JourPrevu | null {
  return jours.find(j => j.date === date) ?? null
}

/** Alerte de la journée qui porte cette date ; journée sans alerte ou absente de la prévision : null. */
export function alerteDuJour(jours: readonly JourPrevu[], date: string): AlerteDuJour | null {
  const jour = jourDeLaDate(jours, date)
  if (!jour) return null
  const motifs = motifsDuJour(jour)
  return motifs.length > 0 ? { date, motifs } : null
}

/** Date du calendrier décalée d'un nombre de jours (AAAA-MM-JJ, sans fuseau ni changement d'heure). */
export function dateDecalee(date: string, jours: number): string {
  const [annee, mois, jour] = date.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(annee, mois - 1, jour + jours)).toISOString().slice(0, 10)
}

/** Date AAAA-MM-JJ d'un instant, à l'heure de l'appareil (jamais toISOString, qui donne la date UTC). */
export function dateLocale(instant: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${instant.getFullYear()}-${deux(instant.getMonth() + 1)}-${deux(instant.getDate())}`
}

/**
 * Décalage horaire du chantier, en secondes, que donne la réponse d'Open-Meteo interrogé avec `timezone=auto`
 * (`utc_offset_seconds`, changement d'heure compris) ; absent ou hors bornes : null.
 */
export function decalageDuChantier(reponse: unknown): number | null {
  if (typeof reponse !== 'object' || reponse === null) return null
  const valeur = (reponse as { utc_offset_seconds?: unknown }).utc_offset_seconds
  return nombreFini(valeur) && Math.abs(valeur) <= 18 * 3600 ? valeur : null
}

/** Date et heure au chantier à cet instant, et la date du lendemain au chantier. */
export function momentAuChantier(instantMs: number, decalageS: number): { date: string; heure: number; demain: string } {
  const local = new Date(instantMs + decalageS * 1000)
  const date = local.toISOString().slice(0, 10)
  return { date, heure: local.getUTCHours(), demain: dateDecalee(date, 1) }
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

/** « vendredi 27 novembre » / « sexta-feira, 27 de novembro » ; date illisible : null. */
export function jourEnLettres(date: string, isPt: boolean): string | null {
  if (!FORME_DATE.test(date)) return null
  const [annee, mois, jour] = date.slice(0, 10).split('-').map(Number)
  const instant = new Date(Date.UTC(annee, mois - 1, jour))
  if (Number.isNaN(instant.getTime())) return null
  return new Intl.DateTimeFormat(isPt ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(instant)
}

/**
 * Titre et texte de la notification ou de l'e-mail de la veille, pour un chantier. Le jour visé est écrit en lettres :
 * un e-mail lu le lendemain matin ne laisse pas de doute sur la journée. `datePrevision` : jour où la prévision a été
 * lue, quand ce n'est pas la veille (notification programmée le vendredi pour le dimanche soir) ; il est alors dit.
 */
export function texteAlerteDuLendemain(
  titreChantier: string, motifs: readonly MotifAlerte[], isPt: boolean, date?: string, datePrevision?: string,
): { titre: string; corps: string } {
  const icone = motifs[0] ? ICONES[motifs[0].type] : '⚠️'
  const chantier = titreChantier.trim() || (isPt ? 'Obra' : 'Chantier')
  const detail = libelleMotifs(motifs, isPt)
  const jour = date ? jourEnLettres(date, isPt) : null
  const lue = datePrevision ? jourEnLettres(datePrevision, isPt) : null
  if (isPt) {
    const quando = jour ? `amanhã, ${jour},` : 'amanhã'
    const origem = lue ? ` (previsão de ${lue})` : ''
    return { titre: `${icone} Alerta meteorológico amanhã: ${chantier}`, corps: `Previsto para ${quando} na obra « ${chantier} »: ${detail}${origem}.` }
  }
  const quand = jour ? `demain, ${jour},` : 'demain'
  const origine = lue ? ` (prévision du ${lue})` : ''
  return { titre: `${icone} Alerte météo demain : ${chantier}`, corps: `Prévu ${quand} sur le chantier « ${chantier} » : ${detail}${origine}.` }
}

/** La case « Alerte météo par notification » du chantier est-elle cochée ? */
export function caseAlerteCochee(chantier: ChantierSoumis): boolean {
  return chantier.alerteMeteo === true || chantier.alerte_meteo === true
}

/** Date de début du chantier (AAAA-MM-JJ), sous son nom de la base ou de l'écran ; absente : null. */
export function debutDuChantier(chantier: ChantierSoumis): string | null {
  const valeur = chantier.date_debut ?? chantier.dateDebut
  return typeof valeur === 'string' && FORME_DATE.test(valeur) ? valeur.slice(0, 10) : null
}

/**
 * Le chantier est-il suivi par l'alerte pour la journée `date` ? La case doit être cochée, et le chantier « En cours »,
 * ou « En attente » quand cette journée est son premier jour (le chantier se crée « En attente » et ne passe « En cours »
 * qu'à la main, souvent le matin du premier jour : sans cela, la veille du premier jour, celle de la dalle, était
 * manquée). Un chantier « En attente » qui ne commence que plus tard, terminé ou annulé : jamais.
 */
export function chantierSuiviLe(chantier: ChantierSoumis, date: string): boolean {
  if (!caseAlerteCochee(chantier)) return false
  if (chantier.statut === STATUT_EN_COURS) return true
  return chantier.statut === STATUT_EN_ATTENTE && debutDuChantier(chantier) === date
}

/** Position utilisable par l'alerte : celle dont l'URL des prévisions a besoin (lib/btp/meteo-url.ts). */
export function positionPourAlerte(latitude: unknown, longitude: unknown): boolean {
  return coordonneesValides(latitude, longitude) !== null
}
