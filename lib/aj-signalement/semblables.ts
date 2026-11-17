// ── Signalements déjà faits au même endroit : règles pures, partagées par le navigateur et le serveur ──
//
// Demande de Hugo du 06/11/2026 : pendant la rédaction, montrer à la personne les signalements déjà faits par
// d'autres dans la même copropriété, le même bâtiment et la même zone des parties communes, pour qu'elle voie si
// c'est le même problème. Sans compte, on ne sait pas qui a fait quoi : la liste peut contenir un signalement
// précédent de la même personne (limite connue).
//   - bâtiment : comparé après normalisation (normaliserBatimentQr) ;
//   - zone : comparée par sa place dans la liste fixe ZONES_COMMUNES, en français comme en portugais (la zone
//     est enregistrée dans la langue de la page) ;
//   - fiche publique : numéro, type, zone, date, statut, rien d'autre. Type et zone sont du texte libre en base
//     (un POST direct peut y mettre n'importe quoi) : seule une valeur des listes fixes sort, sinon « Autre ». La
//     date est le jour civil de Paris (AAAA-MM-JJ), sans l'heure : avec le bâtiment et la zone, l'heure du dépôt
//     aiderait un voisin à deviner qui a signalé (minimisation, RGPD art. 5.1.c). Le tri reste fait sur created_at.

import { TYPES_PROBLEME, ZONES_COMMUNES } from '@/lib/coproprietaire/textes'
import {
  estStatutOuvertQr, numeroSignalementQr, type LangueSignalementQr, type SignalementSemblableQr,
} from '@/lib/aj-signalement/types'

export { STATUTS_OUVERTS_QR } from '@/lib/aj-signalement/types'

/**
 * Règle de gestion (Hugo, 06/11/2026) : un signalement est « récent » pendant 60 jours après son dépôt. Au-delà,
 * il n'est plus proposé comme « déjà fait au même endroit », même s'il est encore ouvert.
 */
export const DELAI_SEMBLABLES_JOURS = 60
/** Au plus 5 signalements montrés, du plus récent au plus ancien. */
export const SEMBLABLES_MAX = 5
/** Lignes lues au plus pour une recherche (avant le filtre du bâtiment, fait ici). */
export const SEMBLABLES_LUS_MAX = 200

const JOUR_MS = 86_400_000

/** Date ISO à partir de laquelle un signalement compte comme récent. */
export const dateLimiteSemblablesQr = (maintenant: Date): string => new Date(maintenant.getTime() - DELAI_SEMBLABLES_JOURS * JOUR_MS).toISOString()

/** Mots qui désignent le bâtiment lui-même (« Bât. B », « Bloc B », « Bloco B » = « B »). */
const MOTS_BATIMENT = new Set(['batiment', 'bat', 'bloc', 'bloco'])
/** Marqueurs de numéro (« n° », « nº », « n.º », « no », « num. », « numéro », « número ») : « Bât n°2 » = « Bâtiment 2 ». */
const MARQUEURS_NUMERO = new Set(['n', 'no', 'num', 'numero'])

interface MotBatiment {
  texte: string
  debut: number
  fin: number
}

const estChiffres = (texte: string): boolean => /^\d+$/.test(texte)

/**
 * Marqueur de numéro à écarter : suivi d'une suite de chiffres dont il est séparé (« n°2 », « no 2 », « n.º 2 »).
 * Collé aux chiffres (« N2 ») ou sans chiffres après (« Bâtiment N »), c'est le nom du bâtiment : il est gardé.
 */
function estMarqueurNumero(mot: MotBatiment, suivant: MotBatiment | undefined): boolean {
  return MARQUEURS_NUMERO.has(mot.texte) && suivant !== undefined && estChiffres(suivant.texte) && suivant.debut > mot.fin
}

/**
 * Bâtiment saisi → clé de comparaison : minuscules sans accents, découpé en suites de lettres et suites de chiffres
 * (« b02 » = « B 2 » = « B-2 »), sans les mots « bâtiment », « bât », « bat », « bloc », « bloco » ni les marqueurs
 * de numéro placés devant des chiffres (« Bât n°2 » = « Bâtiment 2 » = « 2 »), zéros de tête retirés, le tout
 * accolé. Le découpage se fait par mots entiers : « Batignolles » reste « batignolles », « Bâtiment N » reste « n »,
 * « N2 » reste « n2 ». Si la saisie se réduit aux mots du bâtiment (« Bâtiment »), ils sont gardés ; une saisie sans
 * lettre ni chiffre donne ''.
 */
export function normaliserBatimentQr(saisie: string): string {
  const base = saisie.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const mots: MotBatiment[] = Array.from(base.matchAll(/[a-z]+|\d+/g), (m) => {
    const debut = m.index ?? 0
    return { texte: m[0], debut, fin: debut + m[0].length }
  })
  const propres = mots
    .filter((m, i) => !estMarqueurNumero(m, mots[i + 1]))
    .map((m) => (estChiffres(m.texte) ? m.texte.replace(/^0+/, '') || '0' : m.texte))
  const utiles = propres.filter((m) => !MOTS_BATIMENT.has(m))
  return (utiles.length > 0 ? utiles : propres).join('')
}

const AUTRE_ZONE: Record<LangueSignalementQr, string> = { fr: 'Autre', pt: 'Outra' }

function indiceDans(liste: Record<LangueSignalementQr, readonly string[]>, valeur: string): number {
  const propre = valeur.trim()
  const fr = liste.fr.indexOf(propre)
  return fr >= 0 ? fr : liste.pt.indexOf(propre)
}

const estAutreZone = (zone: string): boolean => Object.values(AUTRE_ZONE).includes(zone.trim())

/** Clé d'une zone : sa place dans ZONES_COMMUNES (FR ou PT), « autre » pour Autre / Outra, sinon le texte lui-même. */
export function cleZoneQr(zone: string): string {
  const i = indiceDans(ZONES_COMMUNES, zone)
  if (i >= 0) return `zone-${i}`
  if (estAutreZone(zone)) return 'autre'
  return `libre:${zone.trim().toLowerCase()}`
}

/** Formes d'une zone telles qu'elles peuvent être enregistrées (française et portugaise), pour la requête. */
export function variantesZoneQr(zone: string): string[] {
  const i = indiceDans(ZONES_COMMUNES, zone)
  if (i >= 0) return [ZONES_COMMUNES.fr[i], ZONES_COMMUNES.pt[i]]
  if (estAutreZone(zone)) return [AUTRE_ZONE.fr, AUTRE_ZONE.pt]
  return [zone.trim()]
}

/** Zone montrée au public : celle de la liste fixe, dans la langue de la page ; « Autre » pour tout le reste. */
export function zonePubliqueQr(zone: string, langue: LangueSignalementQr): string {
  const i = indiceDans(ZONES_COMMUNES, zone)
  return i >= 0 ? ZONES_COMMUNES[langue][i] : AUTRE_ZONE[langue]
}

/** Type montré au public : celui de la liste fixe, dans la langue de la page ; le dernier (« Autre ») pour tout le reste. */
export function typePublicQr(type: string, langue: LangueSignalementQr): string {
  const i = indiceDans(TYPES_PROBLEME, type)
  const liste = TYPES_PROBLEME[langue]
  // La liste fixe n'est jamais vide : la chaîne vide n'est qu'une garde de typage.
  return i >= 0 ? liste[i] : (liste.at(-1) ?? '')
}

/** Colonnes lues pour la recherche : toutes de la migration 20261104 (aucun repli sur une colonne absente à prévoir). */
export const COLONNES_SEMBLABLES_QR = 'id, batiment, zone_signalee, type_intervention, statut, est_partie_commune, created_at'

export interface LigneSemblableQr {
  id: string
  batiment: string | null
  zone_signalee: string | null
  type_intervention: string | null
  statut: string | null
  est_partie_commune: boolean | null
  created_at: string | null
}

export interface RechercheSemblablesQr {
  batiment: string
  zone: string
}

/**
 * Signalements semblables parmi des lignes déjà filtrées par copropriété : parties communes, statut ouvert, moins
 * de 60 jours, même zone, même bâtiment normalisé ; au plus 5, du plus récent au plus ancien.
 */
export function selectionnerSemblablesQr(lignes: readonly LigneSemblableQr[], recherche: RechercheSemblablesQr, maintenant: Date): LigneSemblableQr[] {
  const batiment = normaliserBatimentQr(recherche.batiment)
  if (!batiment) return []
  const zone = cleZoneQr(recherche.zone)
  const depuis = maintenant.getTime() - DELAI_SEMBLABLES_JOURS * JOUR_MS
  const quand = (l: LigneSemblableQr): number => Date.parse(l.created_at ?? '')
  return lignes
    .filter((l) => l.est_partie_commune === true && estStatutOuvertQr(l.statut))
    .filter((l) => quand(l) >= depuis)
    .filter((l) => cleZoneQr(l.zone_signalee ?? '') === zone && normaliserBatimentQr(l.batiment ?? '') === batiment)
    .sort((a, b) => quand(b) - quand(a))
    .slice(0, SEMBLABLES_MAX)
}

/** Les immeubles sont en France : le jour d'un dépôt est celui de Paris. */
const JOUR_PARIS = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Jour civil de Paris (AAAA-MM-JJ) d'un horodatage, sans l'heure ; '' si l'horodatage manque ou est illisible. */
export function jourParisQr(horodatage: string | null): string {
  const instant = Date.parse(horodatage ?? '')
  if (Number.isNaN(instant)) return ''
  const parties = JOUR_PARIS.formatToParts(new Date(instant))
  const partie = (type: Intl.DateTimeFormatPartTypes) => parties.find((p) => p.type === type)?.value ?? ''
  return `${partie('year')}-${partie('month')}-${partie('day')}`
}

/** Fiche publique d'un signalement semblable : exactement numéro, type, zone, jour (sans l'heure) et statut. */
export function semblablePublicQr(ligne: LigneSemblableQr, langue: LangueSignalementQr): SignalementSemblableQr {
  return {
    numero: numeroSignalementQr(ligne.id),
    typeIntervention: typePublicQr(ligne.type_intervention ?? '', langue),
    zone: zonePubliqueQr(ligne.zone_signalee ?? '', langue),
    creeLe: jourParisQr(ligne.created_at),
    statut: estStatutOuvertQr(ligne.statut) ? ligne.statut : 'en_attente',
  }
}
