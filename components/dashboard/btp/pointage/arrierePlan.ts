// Pointage « téléphone en poche » côté appli Vitfix Pro (17/11/2026) : le géorepérage du système
// (@capgo/background-geolocation) surveille les zones des chantiers affectés à l'employé, même appli fermée ; le code
// natif du module envoie lui-même chaque entrée ou sortie à l'adresse rendue par le serveur, avec le jeton de ce
// téléphone. Seuls le chantier, le sens et l'heure partent : la position ne quitte pas le téléphone.
// Ce fichier enveloppe le module ; useArrierePlan.ts décide quand l'appeler. Comme lib/auth/google-app-mobile.ts, le
// module n'est chargé que dans l'appli (import dynamique) : sur le site, rien n'est chargé ni appelé ; dans une appli
// installée avant l'ajout du module (sans son code natif), le mode n'est pas proposé.
// Tests : tests/components/btp-pointage-arriere-plan.test.tsx.

import type { BackgroundGeolocationPermissionStatus, BackgroundGeolocationPlugin } from '@capgo/background-geolocation'
import { estAppMobile } from '@/lib/app-mobile'
import { ZONES_MAX, rayonZoneSysteme } from '@/lib/btp/pointage-arriere-plan'
import { coordonneesValides, type ChantierPointable } from '@/lib/btp/pointage-geo'

/** Ce téléphone pointe en arrière-plan : fiche employé, téléphone enregistré côté serveur, zones confiées au système. */
export interface ConfigArrierePlan {
  membreId: string
  appareilId: string
  signature: string
  /** Dernière fois que toutes les zones ont été reposées (Android, voir REPOSE_ANDROID_MS). */
  reposeLe?: number
}

/**
 * Sous Android, la liste des zones lue au module est la sienne, pas celle du système : des zones perdues par le
 * système (arrêt forcé, données des services Google effacées, autorisation retirée puis rendue) ne s'y voient pas.
 * Elles sont donc toutes reposées au plus une fois par ce délai. L'iPhone, lui, donne les zones vraiment surveillées.
 */
export const REPOSE_ANDROID_MS = 12 * 3_600_000

export type AutorisationArrierePlan = 'accordee' | 'partielle' | 'refusee'

const CLE_CONFIG = 'vitfix_btp_arriere_plan'
/** Nom sous lequel le code natif du module s'enregistre auprès de Capacitor. */
const NOM_MODULE = 'BackgroundGeolocation'

interface PontCapacitor {
  getPlatform?: () => string
  isPluginAvailable?: (nom: string) => boolean
}

function pont(): PontCapacitor | undefined {
  return typeof window === 'undefined' ? undefined : (window as Window & { Capacitor?: PontCapacitor }).Capacitor
}

/** Appli Vitfix Pro dont le code natif contient le module (une appli plus ancienne ne l'a pas). */
export function appliNative(): boolean {
  return estAppMobile() && pont()?.isPluginAvailable?.(NOM_MODULE) === true
}

export function plateformeNative(): 'android' | 'ios' | null {
  const plateforme = pont()?.getPlatform?.()
  return plateforme === 'android' || plateforme === 'ios' ? plateforme : null
}

let chargement: Promise<{ geo: BackgroundGeolocationPlugin }> | null = null

/**
 * Le module, chargé une seule fois (un échec de chargement sera retenté). Toujours rendu dans un objet : le proxy de
 * Capacitor (registerPlugin) répond à toute méthode, « then » compris ; rendu tel quel par une fonction async ou une
 * promesse, il serait pris pour une promesse qui ne se résout jamais.
 */
function module(): Promise<{ geo: BackgroundGeolocationPlugin }> {
  chargement ??= import('@capgo/background-geolocation').then(
    m => ({ geo: m.BackgroundGeolocation }),
    (err: unknown) => {
      chargement = null
      throw err
    },
  )
  return chargement
}

// Les opérations sur les zones passent une à une : deux mises à jour lancées coup sur coup (écran relu pendant une
// synchronisation, coupure pendant une activation) ne s'entremêlent jamais.
let file: Promise<unknown> = Promise.resolve()

function aLaSuite<T>(operation: () => Promise<T>): Promise<T> {
  const resultat = file.then(operation, operation)
  file = resultat.catch(() => undefined)
  return resultat
}

/** « Toujours autoriser » accordé : accordee ; seulement pendant l'utilisation de l'appli : partielle ; sinon refusee. */
export function lireAutorisation(statut: BackgroundGeolocationPermissionStatus): AutorisationArrierePlan {
  if (statut.backgroundLocation === 'granted' || statut.backgroundLocation === 'always') return 'accordee'
  if (statut.location === 'granted' || statut.backgroundLocation === 'when_in_use') return 'partielle'
  return 'refusee'
}

/** Autorisation actuelle, sans rien demander (relue à chaque ouverture de l'écran : elle peut être retirée). */
export async function lireAutorisationActuelle(): Promise<AutorisationArrierePlan> {
  const { geo } = await module()
  return lireAutorisation(await geo.checkPermissions())
}

/** Demande la localisation, puis « Toujours » (Android 11+ et iPhone peuvent renvoyer vers les réglages). */
export async function demanderAutorisation(): Promise<AutorisationArrierePlan> {
  const { geo } = await module()
  return lireAutorisation(await geo.requestPermissions({ permissions: ['location', 'backgroundLocation'] }))
}

export async function ouvrirReglages(): Promise<void> {
  const { geo } = await module()
  await geo.openSettings()
}

/**
 * Zones voulues : chantiers à position valable, au plus ZONES_MAX (limite de l'iPhone), choisis dans un ordre stable
 * (identifiant) : la liste reçue n'est pas triée et les zones seraient sinon refaites d'une lecture à l'autre.
 */
export function zonesVoulues(chantiers: ChantierPointable[]): ChantierPointable[] {
  return chantiers
    .filter(c => coordonneesValides(c.latitude, c.longitude))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, ZONES_MAX)
}

/** Description des zones voulues : identifiant, centre au millionième de degré et rayon de la zone du système. */
function descriptionZones(chantiers: ChantierPointable[]): string {
  return zonesVoulues(chantiers)
    .map(c => `${c.id}:${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}:${rayonZoneSysteme(c.rayonM)}`)
    .sort((a, b) => a.localeCompare(b))
    .join('|')
}

/**
 * Empreinte cyrb53 (53 bits, en hexadécimal) d'un texte : sert à reconnaître un texte déjà vu, sans permettre de le
 * retrouver. Pas une protection cryptographique, une simple comparaison.
 */
function hashCyrb53(texte: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < texte.length; i++) {
    const code = texte.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/**
 * Signature des zones voulues, gardée dans le stockage du téléphone pour savoir si elles ont changé : empreinte de
 * leur description (identifiant, centre, rayon), jamais les coordonnées des chantiers en clair. Vide sans zone.
 */
export function signatureZones(chantiers: ChantierPointable[]): string {
  const description = descriptionZones(chantiers)
  return description === '' ? '' : hashCyrb53(description)
}

/** Confie au module l'adresse d'envoi et le jeton de ce téléphone ; file d'envois vidée d'abord (jamais un autre jeton). */
export function configurer(url: string, jeton: string): Promise<void> {
  return aLaSuite(async () => {
    const { geo } = await module()
    await geo.clearGeofenceQueue()
    await geo.setupGeofencing({
      url,
      headers: { Authorization: `Bearer ${jeton}` },
      notifyOnEntry: true,
      notifyOnExit: true,
      backgroundLocation: true,
      requestPermissions: false,
      payload: { v: 1 },
    })
  })
}

/** Zones en place après une synchronisation : signature voulue, et nombre de zones voulues que le module surveille. */
export interface ZonesEnPlace {
  signature: string
  surveillees: number
}

/**
 * Zones du système tenues à jour : refaites si les chantiers (position, rayon) ont changé depuis la dernière fois, si
 * le module ne les surveille plus toutes, ou si `reposer` (Android, voir REPOSE_ANDROID_MS). Une zone refusée (par
 * exemple localisation du téléphone coupée) n'arrête pas les autres : le nombre de zones vraiment surveillées est
 * rendu, pour le dire à l'employé. Reposer une zone où se trouve le téléphone lui fait envoyer une arrivée : sans
 * effet si un pointage y est ouvert, ou y a été terminé à la main (journée rejouée côté serveur).
 */
export function synchroniserZones(
  chantiers: ChantierPointable[], signaturePrecedente: string | null, reposer = false,
): Promise<ZonesEnPlace> {
  return aLaSuite(async () => {
    const { geo } = await module()
    const voulues = zonesVoulues(chantiers)
    const signature = signatureZones(voulues)
    const avant = new Set((await geo.getMonitoredGeofences()).regions)
    const completes = voulues.length === avant.size && voulues.every(c => avant.has(c.id))
    if (!reposer && signature === signaturePrecedente && completes) return { signature, surveillees: voulues.length }
    await geo.removeAllGeofences()
    for (const c of voulues) {
      try {
        await geo.addGeofence({ identifier: c.id, latitude: c.latitude, longitude: c.longitude, radius: rayonZoneSysteme(c.rayonM) })
      } catch (err) {
        console.warn('[btp/pointage] zone refusée par le téléphone :', err instanceof Error ? err.message : err)
      }
    }
    const apres = new Set((await geo.getMonitoredGeofences()).regions)
    return { signature, surveillees: voulues.filter(c => apres.has(c.id)).length }
  })
}

/** Coupe tout sur ce téléphone : zones retirées, envois en attente effacés. */
export function arreterSurCeTelephone(): Promise<void> {
  return aLaSuite(async () => {
    const { geo } = await module()
    await geo.removeAllGeofences()
    await geo.clearGeofenceQueue()
  })
}

/**
 * Zones laissées sur ce téléphone sans réglage du site qui les explique (données du site effacées, retrait précédent
 * en échec) : retirées avec les envois en attente. Renvoie vrai s'il y en avait.
 */
export function retirerZonesOrphelines(): Promise<boolean> {
  return aLaSuite(async () => {
    const { geo } = await module()
    if ((await geo.getMonitoredGeofences()).regions.length === 0) return false
    await geo.removeAllGeofences()
    await geo.clearGeofenceQueue()
    return true
  })
}

/** Réglage gardé sur ce téléphone ; null s'il manque ou est illisible (stockage bloqué, valeur abîmée). */
export function lireConfig(): ConfigArrierePlan | null {
  try {
    const valeur = JSON.parse(localStorage.getItem(CLE_CONFIG) ?? 'null') as Partial<ConfigArrierePlan> | null
    if (!valeur || typeof valeur !== 'object') return null
    const { membreId, appareilId, signature, reposeLe } = valeur
    if (typeof membreId !== 'string' || typeof appareilId !== 'string' || typeof signature !== 'string') return null
    return typeof reposeLe === 'number' && Number.isFinite(reposeLe)
      ? { membreId, appareilId, signature, reposeLe }
      : { membreId, appareilId, signature }
  } catch (err) {
    console.warn('[btp/pointage] réglage du téléphone en poche illisible :', err instanceof Error ? err.message : err)
    return null
  }
}

export function ecrireConfig(config: ConfigArrierePlan | null): void {
  try {
    if (config) localStorage.setItem(CLE_CONFIG, JSON.stringify(config))
    else localStorage.removeItem(CLE_CONFIG)
  } catch (err) {
    console.warn('[btp/pointage] réglage du téléphone en poche non gardé :', err instanceof Error ? err.message : err)
  }
}
