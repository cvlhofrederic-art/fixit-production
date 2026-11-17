// tests/components/btp-pointage-arriere-plan.test.tsx — pointage BTP « téléphone en poche » (appli Vitfix Pro,
// 17/11/2026) : carte de l'onglet Pointer, activation, refus, coupure, zones tenues à jour, retrait quand ce téléphone
// ne pointe plus. Module natif (@capgo/background-geolocation) et pont Capacitor simulés ; serveur simulé en mémoire.

import React, { useCallback, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { chantierPointable, type ChantierDuTelephone, type ContextePointage } from '@/lib/btp/pointage-regles'
import type { ChantierPointable } from '@/lib/btp/pointage-geo'
import type { CorpsPointage, ResultatEnvoi } from '@/components/dashboard/btp/pointage/useContextePointage'

interface Zone { identifier: string; latitude: number; longitude: number; radius: number }

const natif = vi.hoisted(() => ({
  zones: new Map<string, Zone>(),
  configuration: null as null | Record<string, unknown>,
  demande: null as null | Record<string, unknown>,
  permissions: { location: 'granted', backgroundLocation: 'granted' } as Record<string, string>,
  /** Autorisation telle que le système la donne sans rien demander (checkPermissions). */
  actuelles: { location: 'granted', backgroundLocation: 'granted' } as Record<string, string>,
  journal: [] as string[],
  panne: null as null | string,
}))

vi.mock('@capgo/background-geolocation', () => {
  // Chaque appel rend la main avant de finir, comme le pont natif : deux suites d'appels peuvent s'entremêler.
  const pas = async (nom: string) => {
    natif.journal.push(nom)
    await Promise.resolve()
    if (natif.panne === nom) throw new Error(`panne ${nom}`)
  }
  const methodes: Record<string, (...args: never[]) => Promise<unknown>> = {
    requestPermissions: async (options: Record<string, unknown>) => {
      await pas('requestPermissions')
      natif.demande = options
      return { ...natif.permissions }
    },
    checkPermissions: async () => {
      await pas('checkPermissions')
      return { ...natif.actuelles }
    },
    openSettings: async () => { await pas('openSettings') },
    clearGeofenceQueue: async () => { await pas('clearGeofenceQueue') },
    setupGeofencing: async (options: Record<string, unknown>) => {
      await pas('setupGeofencing')
      natif.configuration = options
    },
    getMonitoredGeofences: async () => {
      await pas('getMonitoredGeofences')
      return { regions: [...natif.zones.keys()] }
    },
    removeAllGeofences: async () => {
      await pas('removeAllGeofences')
      natif.zones.clear()
    },
    addGeofence: async (zone: Zone) => {
      await pas('addGeofence')
      natif.zones.set(zone.identifier, zone)
    },
  }
  // Comme le proxy de registerPlugin (@capacitor/core) : toute propriété lue est une méthode, « then » compris. Rendu
  // tel quel par une fonction async, le module serait pris pour une promesse jamais résolue (piège trouvé le 17/11).
  const BackgroundGeolocation = new Proxy({}, {
    get: (_cible, nom) => {
      if (typeof nom === 'symbol') return undefined
      return methodes[nom] ?? (async () => { throw new Error(`"BackgroundGeolocation.${nom}()" is not implemented`) })
    },
  })
  return { BackgroundGeolocation }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { OngletPointer } from '@/components/dashboard/btp/pointage/OngletPointer'
import {
  arreterSurCeTelephone,
  ecrireConfig,
  lireAutorisation,
  lireConfig,
  signatureZones,
  synchroniserZones,
  zonesVoulues,
} from '@/components/dashboard/btp/pointage/arrierePlan'

const CLE = 'vitfix_btp_arriere_plan'
const JETON = `jeton-de-test-${'x'.repeat(29)}`
const URL_EVENEMENT = 'https://vitfix.io/api/btp/pointage/evenement'

const VILLA: ChantierDuTelephone = { id: 'c-villa', titre: 'Villa', adresse: '1 rue des Lilas, 13008 Marseille', latitude: 43.25, longitude: 5.38, rayonM: 50 }
const GARAGE: ChantierDuTelephone = { id: 'c-garage', titre: 'Garage', adresse: '2 avenue du Prado, 13006 Marseille', latitude: 43.28, longitude: 5.39, rayonM: 200 }
const CAVE: ChantierDuTelephone = { id: 'c-cave', titre: 'Cave', adresse: '3 rue Paradis, 13001 Marseille', latitude: null, longitude: null, rayonM: 100 }

const CONTEXTE: ContextePointage = {
  gerant: false,
  rattachement: 'relie',
  moi: { id: 'm-paul', nom: 'Paul Exemple' },
  chantiers: [VILLA, GARAGE, CAVE],
  pointageEnCours: null,
  pointagesOublies: [],
  historique: [],
  pointageAutoActive: true,
  reglageDisponible: true,
  appareilArrierePlan: null,
}

const pointables = (chantiers: ChantierDuTelephone[]): ChantierPointable[] =>
  chantiers.map(chantierPointable).filter((c): c is ChantierPointable => c !== null)

// ── Serveur simulé : /api/btp/pointage { action: 'appareil' | 'appareil_retirer' } et relecture de l'écran ──
const serveur = {
  appareil: null as string | null,
  compteur: 0,
  refus: null as null | string,
  relectureEnPanne: false,
  envois: [] as CorpsPointage[],
}

const envoyer = vi.fn(async (corps: CorpsPointage): Promise<ResultatEnvoi> => {
  serveur.envois.push(corps)
  if (corps.action === 'appareil') {
    if (serveur.refus) return { ok: false, code: serveur.refus, status: 403 }
    serveur.compteur += 1
    serveur.appareil = `app-${serveur.compteur}`
    return { ok: true, pointage: null, donnees: { appareil: serveur.appareil, jeton: JETON, url: URL_EVENEMENT } }
  }
  if (corps.action === 'appareil_retirer') {
    // Le téléphone désigné seulement, s'il est encore celui du compte.
    const retires = serveur.appareil !== null && corps.appareil === serveur.appareil ? 1 : 0
    if (retires === 1) serveur.appareil = null
    return { ok: true, pointage: null, donnees: { retires } }
  }
  return { ok: false, code: 'inattendu', status: 400 }
})

function Banc({ depart, isPt = false }: { depart: ContextePointage; isPt?: boolean }) {
  const [contexte, setContexte] = useState(depart)
  const recharger = useCallback(async () => {
    if (serveur.relectureEnPanne) return
    setContexte(c => ({ ...c, appareilArrierePlan: serveur.appareil }))
  }, [])
  return <OngletPointer contexte={contexte} isPt={isPt} envoyer={envoyer} recharger={recharger} />
}

/** Pont Capacitor injecté par l'appli dans les pages du site. */
function appli({ plateforme = 'android', module = true }: { plateforme?: string; module?: boolean } = {}) {
  Object.assign(window, {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => plateforme,
      isPluginAvailable: (nom: string) => module && nom === 'BackgroundGeolocation',
    },
  })
}

/**
 * Ce téléphone pointe déjà (réglage gardé, zones posées) pour le téléphone `appareilId` de la fiche `membreId` ;
 * zones reposées pour la dernière fois à `reposeLe` (par défaut à l'instant : pas de repose Android d'office).
 */
function dejaActif(
  chantiers: ChantierDuTelephone[],
  { membreId = 'm-paul', appareilId = 'app-1', reposeLe = Date.now() }: { membreId?: string; appareilId?: string; reposeLe?: number } = {},
) {
  const zones = pointables(chantiers)
  localStorage.setItem(CLE, JSON.stringify({ membreId, appareilId, signature: signatureZones(zones), reposeLe }))
  for (const c of zonesVoulues(zones)) {
    natif.zones.set(c.id, { identifier: c.id, latitude: c.latitude, longitude: c.longitude, radius: Math.max(150, c.rayonM) })
  }
}

function stockage(): string {
  const valeurs: string[] = []
  for (let i = 0; i < localStorage.length; i++) valeurs.push(localStorage.getItem(localStorage.key(i) ?? '') ?? '')
  return valeurs.join('\n')
}

const carte = () => screen.queryByText('Pointage téléphone en poche')?.closest<HTMLElement>('.v5-card') ?? null
/** Premier paragraphe de la carte : l'état du mode pour ce compte. */
const statut = () => carte()?.querySelector('p')?.textContent ?? null

beforeEach(() => {
  // Horloge figée (seule la date : les minuteries de waitFor restent réelles).
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2026, 10, 17, 8, 0, 0))
  vi.clearAllMocks()
  localStorage.clear()
  natif.zones.clear()
  natif.configuration = null
  natif.demande = null
  natif.permissions = { location: 'granted', backgroundLocation: 'granted' }
  natif.actuelles = { location: 'granted', backgroundLocation: 'granted' }
  natif.journal = []
  natif.panne = null
  Object.assign(serveur, { appareil: null, compteur: 0, refus: null, relectureEnPanne: false, envois: [] })
})

afterEach(async () => {
  await new Promise(r => setTimeout(r, 0))
  vi.useRealTimers()
  delete (window as Window & { Capacitor?: unknown }).Capacitor
  // Propriétés posées sur l'objet navigator par un test (Object.defineProperty) : retirées, celles du prototype restent.
  const nav = navigator as unknown as Record<string, unknown>
  delete nav.geolocation
  delete nav.permissions
  delete (document as unknown as Record<string, unknown>).visibilityState
})

describe('Onglet Pointer — carte « téléphone en poche » : seulement là où elle peut servir', () => {
  it('site web : ni carte ni module natif ; le pointage page ouverte reste tel quel', () => {
    render(<Banc depart={CONTEXTE} />)
    expect(carte()).toBeNull()
    expect(screen.getByRole('button', { name: 'Activer le pointage automatique' })).toBeTruthy()
    expect(natif.journal).toEqual([])
  })

  it('appli installée avant l’ajout du module (code natif absent) : rien de proposé', () => {
    appli({ module: false })
    render(<Banc depart={CONTEXTE} />)
    expect(carte()).toBeNull()
    expect(natif.journal).toEqual([])
  })

  it('mode automatique coupé par le gérant, ou compte sans fiche reliée : pas de carte', () => {
    appli()
    const { unmount } = render(<Banc depart={{ ...CONTEXTE, pointageAutoActive: false }} />)
    expect(carte()).toBeNull()
    unmount()
    render(<Banc depart={{ ...CONTEXTE, rattachement: 'aucun', moi: null, chantiers: [] }} />)
    expect(carte()).toBeNull()
  })

  it('appli, mode activé : désactivé par défaut, information bien en vue avant toute demande d’autorisation', async () => {
    appli()
    render(<Banc depart={CONTEXTE} />)
    expect(carte()).toBeTruthy()
    expect(statut()).toBe('Désactivé')
    expect(screen.getByText(/même appli fermée ou non utilisée/)).toBeTruthy()
    expect(screen.getByText(/votre position ne quitte jamais le téléphone/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Activer sur ce téléphone' })).toBeTruthy()
    // Seul contrôle sans geste de l'employé : aucune zone restée sur le téléphone. Aucune demande d'autorisation.
    await waitFor(() => expect(natif.journal).toEqual(['getMonitoredGeofences']))
  })

  it('zones restées sur le téléphone sans réglage (données du site effacées, retrait en échec) : retirées, file vidée', async () => {
    appli()
    natif.zones.set('c-villa', { identifier: 'c-villa', latitude: 43.25, longitude: 5.38, radius: 150 })
    render(<Banc depart={CONTEXTE} />)
    await waitFor(() => expect(natif.journal).toEqual(['getMonitoredGeofences', 'removeAllGeofences', 'clearGeofenceQueue']))
    expect(natif.zones.size).toBe(0)
    expect(statut()).toBe('Désactivé')
    expect(serveur.envois).toEqual([])
  })

  it('base de données pas encore à jour (migration du 17/11/2026) : dit, activation impossible', () => {
    appli()
    render(<Banc depart={{ ...CONTEXTE, arrierePlanDisponible: false }} />)
    expect(screen.getByText('Disponible après la mise à jour de la base de données (migration du 17/11/2026).')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Activer sur ce téléphone' })).toHaveProperty('disabled', true)
  })

  it('aucun chantier localisé : rien à suivre, aucune demande d’autorisation possible', () => {
    appli()
    render(<Banc depart={{ ...CONTEXTE, chantiers: [CAVE] }} />)
    expect(screen.getByText(/^Aucun de vos chantiers n’a de position GPS : il n’y a rien à suivre/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Activer sur ce téléphone' })).toHaveProperty('disabled', true)
  })

  it('en portugais', () => {
    appli()
    render(<Banc depart={CONTEXTE} isPt />)
    expect(screen.getByText('Registo com o telemóvel no bolso')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ativar neste telemóvel' })).toBeTruthy()
  })
})

describe('Activation par l’employé', () => {
  it('« Toujours » accordé : téléphone enregistré, module configuré, zones des chantiers localisés (150 m au moins)', async () => {
    appli()
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    await screen.findByText(/^Activé sur ce téléphone/)

    expect(natif.demande).toEqual({ permissions: ['location', 'backgroundLocation'] })
    expect(serveur.envois).toEqual([{ action: 'appareil', plateforme: 'android' }])
    expect(natif.configuration).toStrictEqual({
      url: URL_EVENEMENT,
      headers: { Authorization: `Bearer ${JETON}` },
      notifyOnEntry: true,
      notifyOnExit: true,
      backgroundLocation: true,
      requestPermissions: false,
      payload: { v: 1 },
    })
    // File d'envois d'un éventuel ancien jeton vidée avant de configurer le nouveau (lectures des zones mises à part).
    expect(natif.journal.filter(n => n !== 'getMonitoredGeofences').slice(0, 3))
      .toEqual(['requestPermissions', 'clearGeofenceQueue', 'setupGeofencing'])
    expect([...natif.zones.values()]).toStrictEqual([
      { identifier: 'c-garage', latitude: 43.28, longitude: 5.39, radius: 200 },
      { identifier: 'c-villa', latitude: 43.25, longitude: 5.38, radius: 150 },
    ])
    expect(JSON.parse(localStorage.getItem(CLE) ?? 'null')).toStrictEqual({
      membreId: 'm-paul', appareilId: 'app-1', signature: signatureZones(pointables([VILLA, GARAGE])), reposeLe: expect.any(Number),
    })
    // Le jeton n'est confié qu'au module natif, jamais au stockage du site.
    expect(stockage()).not.toContain(JETON)
    expect(toast.success).toHaveBeenCalledWith('Pointage téléphone en poche activé')
    expect(screen.getByText(/^2 chantiers suivis \(20 au plus\)/)).toBeTruthy()
    // Le pointage page ouverte s'efface : un seul des deux pointe.
    expect(screen.getByText(/^Assuré par le pointage téléphone en poche/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Activer le pointage automatique' })).toBeNull()
  })

  it('iPhone : la plateforme part avec l’enregistrement', async () => {
    appli({ plateforme: 'ios' })
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    await screen.findByText(/^Activé sur ce téléphone/)
    expect(serveur.envois).toEqual([{ action: 'appareil', plateforme: 'ios' }])
  })

  it('autorisation seulement pendant l’utilisation : rien d’enregistré, consigne et accès aux réglages', async () => {
    appli()
    natif.permissions = { location: 'granted', backgroundLocation: 'denied' }
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    expect((await screen.findByRole('alert')).textContent).toContain('« Toujours autoriser »')
    expect(serveur.envois).toEqual([])
    expect(natif.configuration).toBeNull()
    expect(natif.zones.size).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir les réglages' }))
    await waitFor(() => expect(natif.journal).toContain('openSettings'))
  })

  it('localisation refusée : rien d’enregistré', async () => {
    appli()
    natif.permissions = { location: 'denied', backgroundLocation: 'denied' }
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Localisation refusée/)
    expect(serveur.envois).toEqual([])
    expect(localStorage.getItem(CLE)).toBeNull()
  })

  it('refus du serveur (mode coupé entre-temps) : message, module jamais configuré', async () => {
    appli()
    serveur.refus = 'pointage_auto_desactive'
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Le pointage automatique n’est pas activé pour votre société : pointez à la main.'))
    expect(natif.configuration).toBeNull()
    expect(natif.zones.size).toBe(0)
    expect(localStorage.getItem(CLE)).toBeNull()
  })

  it('panne du module : rien ne reste à moitié en place (zones, réglage, jeton du serveur)', async () => {
    appli()
    natif.panne = 'setupGeofencing'
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Le pointage téléphone en poche n’a pas pu être activé. Réessayez.'))
    await waitFor(() => expect(serveur.envois).toEqual([{ action: 'appareil', plateforme: 'android' }, { action: 'appareil_retirer', appareil: 'app-1' }]))
    expect(serveur.appareil).toBeNull()
    expect(natif.zones.size).toBe(0)
    // Zones et envois en attente retirés après la panne.
    const apresPanne = natif.journal.slice(natif.journal.indexOf('setupGeofencing') + 1)
    expect(apresPanne.slice(0, 2)).toEqual(['removeAllGeofences', 'clearGeofenceQueue'])
    expect(localStorage.getItem(CLE)).toBeNull()
    await waitFor(() => expect(statut()).toBe('Désactivé'))
  })

  it('relecture de l’écran impossible juste après (réseau) : l’activation n’est pas défaite', async () => {
    appli()
    serveur.relectureEnPanne = true
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    await screen.findByText(/^Activé sur ce téléphone/)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Couper sur ce téléphone' })).toHaveProperty('disabled', false))
    expect(natif.zones.size).toBe(2)
    expect(localStorage.getItem(CLE)).not.toBeNull()
    // Seul le retrait fait par l'activation elle-même avant de poser les zones ; rien de coupé ensuite.
    expect(natif.journal.filter(n => n === 'removeAllGeofences')).toHaveLength(1)
    expect(natif.journal.lastIndexOf('clearGeofenceQueue')).toBeLessThan(natif.journal.indexOf('setupGeofencing'))
  })

  it('au plus 20 zones (limite de l’iPhone)', async () => {
    appli()
    const nombreux = Array.from({ length: 25 }, (_, i) => ({ ...GARAGE, id: `c-${String(i).padStart(2, '0')}`, latitude: 43 + i / 100 }))
    render(<Banc depart={{ ...CONTEXTE, chantiers: nombreux }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    await screen.findByText(/^20 chantiers suivis/)
    expect(natif.zones.size).toBe(20)
    expect(natif.zones.has('c-19')).toBe(true)
    expect(natif.zones.has('c-20')).toBe(false)
  })
})

describe('Téléphone qui pointe déjà', () => {
  it('coupure par l’employé : zones et envois en attente retirés, réglage effacé, jeton retiré du serveur', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    serveur.appareil = 'app-1'
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Couper sur ce téléphone' }))
    await waitFor(() => expect(statut()).toBe('Désactivé'))
    expect(natif.zones.size).toBe(0)
    expect(natif.journal.slice(natif.journal.indexOf('removeAllGeofences')).slice(0, 2)).toEqual(['removeAllGeofences', 'clearGeofenceQueue'])
    expect(localStorage.getItem(CLE)).toBeNull()
    // Ce téléphone seulement : il est désigné.
    expect(serveur.envois).toEqual([{ action: 'appareil_retirer', appareil: 'app-1' }])
    expect(toast.success).toHaveBeenCalledWith('Pointage téléphone en poche coupé')
    // Le pointage page ouverte redevient possible.
    expect(screen.getByRole('button', { name: 'Activer le pointage automatique' })).toBeTruthy()
  })

  it('activé puis coupé, relecture impossible après la coupure : l’écran dit bien « Désactivé »', async () => {
    appli()
    render(<Banc depart={CONTEXTE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur ce téléphone' }))
    const couper = await screen.findByRole('button', { name: 'Couper sur ce téléphone' })
    await waitFor(() => expect(couper).toHaveProperty('disabled', false))
    serveur.relectureEnPanne = true
    fireEvent.click(couper)
    await waitFor(() => expect(statut()).toBe('Désactivé'))
    expect(serveur.appareil).toBeNull()
    expect(natif.zones.size).toBe(0)
  })

  it('chantiers inchangés et zones toutes surveillées : rien n’est refait', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(natif.journal).toContain('getMonitoredGeofences'))
    await screen.findByText(/^Activé sur ce téléphone/)
    expect(natif.journal).toEqual(['checkPermissions', 'getMonitoredGeofences'])
    expect(serveur.envois).toEqual([])
  })

  it('chantier déplacé ou nouvellement affecté : zones refaites, réglage mis à jour', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    const deplace = { ...GARAGE, latitude: 43.3 }
    const nouveau = { ...VILLA, id: 'c-ecole', titre: 'École', latitude: 43.21 }
    render(<Banc depart={{ ...CONTEXTE, chantiers: [VILLA, deplace, nouveau], appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(natif.zones.size).toBe(3))
    expect(natif.zones.get('c-garage')).toStrictEqual({ identifier: 'c-garage', latitude: 43.3, longitude: 5.39, radius: 200 })
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CLE) ?? 'null')).toStrictEqual({
      membreId: 'm-paul', appareilId: 'app-1', signature: signatureZones(pointables([VILLA, deplace, nouveau])), reposeLe: expect.any(Number),
    }))
    expect(serveur.envois).toEqual([])
  })

  it('iPhone : jamais reposées d’office (le système donne les zones vraiment surveillées) ; disparues : reposées', async () => {
    appli({ plateforme: 'ios' })
    dejaActif([VILLA, GARAGE], { reposeLe: Date.now() - 13 * 3_600_000 })
    const { unmount } = render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(natif.journal).toContain('getMonitoredGeofences'))
    await new Promise(r => setTimeout(r, 0))
    expect(natif.journal).not.toContain('removeAllGeofences')
    unmount()
    natif.zones.clear()
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect([...natif.zones.keys()]).toEqual(['c-garage', 'c-villa']))
  })

  it('Android (la liste du module n’est pas celle du système) : zones reposées si la dernière repose date de plus de 12 h, pas avant', async () => {
    appli()
    dejaActif([VILLA, GARAGE], { reposeLe: Date.now() - 13 * 3_600_000 })
    const { unmount } = render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(natif.journal).toContain('removeAllGeofences'))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CLE) ?? 'null').reposeLe).toBeGreaterThan(Date.now() - 60_000))
    expect([...natif.zones.keys()]).toEqual(['c-garage', 'c-villa'])
    unmount()
    natif.journal = []
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(natif.journal).toContain('getMonitoredGeofences'))
    await new Promise(r => setTimeout(r, 0))
    expect(natif.journal).not.toContain('removeAllGeofences')
  })

  it('autorisation « Toujours » retirée depuis l’activation : averti, réglages proposés, la page ouverte reprend ; relue au retour', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    natif.actuelles = { location: 'granted', backgroundLocation: 'denied' }
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(statut()).toMatch(/^Activé sur ce téléphone, mais la position « Toujours » n’est plus autorisée/))
    expect(screen.getByRole('button', { name: 'Ouvrir les réglages' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Couper sur ce téléphone' })).toBeTruthy()
    // La page ouverte ne reprend pas tant que ce téléphone est enregistré : pointage à la main en attendant.
    expect(screen.queryByRole('button', { name: 'Activer le pointage automatique' })).toBeNull()
    expect(screen.getByText(/^Le pointage téléphone en poche est activé sur ce téléphone mais ne fonctionne pas/)).toBeTruthy()
    // Rien n'est défait : l'autorisation rendue, tout remarche.
    expect(natif.zones.size).toBe(2)
    expect(localStorage.getItem(CLE)).not.toBeNull()
    // Retour dans l'appli après les réglages : autorisation relue.
    natif.actuelles = { location: 'granted', backgroundLocation: 'granted' }
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(statut()).toMatch(/^Activé sur ce téléphone :/))
    expect(screen.queryByRole('button', { name: 'Activer le pointage automatique' })).toBeNull()
  })

  it('un autre téléphone a été activé depuis : celui-ci retire ses zones, sans toucher à l’autre', async () => {
    appli()
    dejaActif([VILLA, GARAGE], { appareilId: 'app-1' })
    serveur.appareil = 'app-2'
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-2' }} />)
    await waitFor(() => expect(natif.zones.size).toBe(0))
    await waitFor(() => expect(localStorage.getItem(CLE)).toBeNull())
    expect(statut()).toMatch(/^Un autre téléphone \(ou une installation précédente de l’appli\) pointe pour vous/)
    expect(serveur.envois).toEqual([])
    expect(serveur.appareil).toBe('app-2')
  })

  it('jeton retiré côté serveur (mode coupé par le gérant puis rétabli, compte retiré) : zones retirées', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: null }} />)
    await waitFor(() => expect(natif.zones.size).toBe(0))
    await waitFor(() => expect(localStorage.getItem(CLE)).toBeNull())
    expect(statut()).toBe('Désactivé')
    expect(serveur.envois).toEqual([])
  })

  it('mode coupé par le gérant : zones retirées, carte masquée', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    render(<Banc depart={{ ...CONTEXTE, pointageAutoActive: false, appareilArrierePlan: null }} />)
    await waitFor(() => expect(natif.zones.size).toBe(0))
    await waitFor(() => expect(localStorage.getItem(CLE)).toBeNull())
    expect(carte()).toBeNull()
  })

  it('autre compte connecté sur ce téléphone : zones de l’ancien compte retirées, rien retiré au serveur', async () => {
    appli()
    dejaActif([VILLA, GARAGE], { membreId: 'm-ancien', appareilId: 'app-9' })
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: null }} />)
    await waitFor(() => expect(natif.zones.size).toBe(0))
    await waitFor(() => expect(localStorage.getItem(CLE)).toBeNull())
    expect(serveur.envois).toEqual([])
  })

  it('compte relié depuis à une autre fiche, téléphone toujours actif au serveur : rien retiré ici (le serveur tranche)', async () => {
    appli()
    dejaActif([VILLA, GARAGE], { membreId: 'm-ancienne-fiche', appareilId: 'app-1' })
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await new Promise(r => setTimeout(r, 0))
    expect(natif.journal).toEqual([])
    expect(natif.zones.size).toBe(2)
    expect(localStorage.getItem(CLE)).not.toBeNull()
    expect(serveur.envois).toEqual([])
  })

  it('compte lu non relié (peut-être une panne passagère) alors que le serveur garde ce téléphone : rien retiré ici', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    serveur.appareil = 'app-1'
    render(<Banc depart={{ ...CONTEXTE, rattachement: 'aucun', moi: null, chantiers: [], pointageAutoActive: false, appareilArrierePlan: 'app-1' }} />)
    await new Promise(r => setTimeout(r, 0))
    expect(natif.zones.size).toBe(2)
    expect(localStorage.getItem(CLE)).not.toBeNull()
    expect(serveur.envois).toEqual([])
  })

  it('réponse incertaine du serveur (panne passagère) : rien retiré, rien refait, l’écran garde ce téléphone actif', async () => {
    appli()
    dejaActif([VILLA, GARAGE])
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: null, arrierePlanIncertain: true }} />)
    await new Promise(r => setTimeout(r, 0))
    expect(natif.zones.size).toBe(2)
    expect(localStorage.getItem(CLE)).not.toBeNull()
    // Aucun appel au module : ni retrait ni mise à jour sur la foi d'une réponse incertaine.
    expect(natif.journal).toEqual([])
    expect(statut()).toMatch(/^Activé sur ce téléphone :/)
  })

  it('zones refusées par le téléphone (localisation coupée) : averti, la page ouverte reprend ; reposées au retour dans l’appli', async () => {
    appli({ plateforme: 'ios' })
    dejaActif([VILLA, GARAGE])
    natif.zones.clear()
    natif.panne = 'addGeofence'
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(statut()).toMatch(/^Activé sur ce téléphone, mais il ne surveille pas tous vos chantiers/))
    expect(screen.getByRole('button', { name: 'Ouvrir les réglages' })).toBeTruthy()
    // La page ouverte ne reprend pas : un pointage qu'elle ouvrirait ne serait refermé par personne.
    expect(screen.queryByRole('button', { name: 'Activer le pointage automatique' })).toBeNull()
    expect(screen.getByText('Chantiers suivis : 0 sur 2.')).toBeTruthy()
    natif.panne = null
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(statut()).toMatch(/^Activé sur ce téléphone :/))
    expect(natif.zones.size).toBe(2)
    expect(screen.queryByRole('button', { name: 'Activer le pointage automatique' })).toBeNull()
  })

  it('le pointage page ouverte ne démarre pas tant que ce téléphone pointe en arrière-plan (même en reprise automatique)', async () => {
    const watchPosition = vi.fn(() => 1)
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition, clearWatch: vi.fn() }, configurable: true })
    Object.defineProperty(navigator, 'permissions', { value: { query: vi.fn(async () => ({ state: 'granted' })) }, configurable: true })
    localStorage.setItem('vitfix_btp_pointage_auto', '1')
    appli()
    dejaActif([VILLA, GARAGE])
    const { unmount } = render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(natif.journal).toContain('getMonitoredGeofences'))
    await waitFor(() => expect(navigator.permissions.query).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    expect(watchPosition).not.toHaveBeenCalled()
    unmount()
    // Témoin : sans le mode arrière-plan sur ce téléphone, la reprise automatique démarre bien la localisation.
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: null }} />)
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1))
  })

  it('mise à jour des zones impossible : avertissement, réglage gardé', async () => {
    appli()
    dejaActif([VILLA])
    natif.panne = 'removeAllGeofences'
    render(<Banc depart={{ ...CONTEXTE, appareilArrierePlan: 'app-1' }} />)
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Les zones du pointage téléphone en poche n’ont pas été mises à jour.'))
    expect(JSON.parse(localStorage.getItem(CLE) ?? 'null')).toMatchObject({ appareilId: 'app-1', signature: signatureZones(pointables([VILLA])) })
  })
})

describe('Enveloppe du module natif (arrierePlan.ts)', () => {
  it('autorisation : « Toujours » accordée, partielle, refusée', () => {
    expect(lireAutorisation({ location: 'granted', backgroundLocation: 'granted' } as never)).toBe('accordee')
    expect(lireAutorisation({ location: 'granted', backgroundLocation: 'always' } as never)).toBe('accordee')
    expect(lireAutorisation({ location: 'granted', backgroundLocation: 'denied' } as never)).toBe('partielle')
    expect(lireAutorisation({ location: 'denied', backgroundLocation: 'when_in_use' } as never)).toBe('partielle')
    expect(lireAutorisation({ location: 'denied', backgroundLocation: 'denied' } as never)).toBe('refusee')
    expect(lireAutorisation({ location: 'prompt', backgroundLocation: 'prompt' } as never)).toBe('refusee')
  })

  it('signature des zones : empreinte sans coordonnées en clair, indifférente à l’ordre, au millionième de degré et au rayon du système', () => {
    const LOIN = { ...VILLA, id: 'c-loin', latitude: 43.123456789, rayonM: 151.4 }
    const signature = signatureZones(pointables([GARAGE, VILLA, CAVE, LOIN]))
    // Empreinte hexadécimale : ni point, ni virgule, ni identifiant de chantier (rien des coordonnées n'est lisible).
    expect(signature).toMatch(/^[0-9a-f]{14}$/)
    expect(signatureZones(pointables([LOIN, CAVE, VILLA, GARAGE]))).toBe(signature)
    // Au millionième de degré et au rayon de la zone du système près : même signature.
    expect(signatureZones(pointables([GARAGE, VILLA, { ...LOIN, latitude: 43.1234574 }]))).toBe(signature)
    expect(signatureZones(pointables([GARAGE, { ...VILLA, rayonM: 120 }, LOIN]))).toBe(signature)
    expect(signatureZones(pointables([GARAGE, VILLA, { ...LOIN, rayonM: 150.6 }]))).toBe(signature)
    // Centre, rayon, identifiant ou liste des zones changés : autre signature.
    for (const autre of [
      [GARAGE, VILLA, { ...LOIN, latitude: 43.123458 }],
      [GARAGE, VILLA, { ...LOIN, longitude: 5.380001 }],
      [GARAGE, VILLA, { ...LOIN, rayonM: 152 }],
      [GARAGE, { ...VILLA, rayonM: 151 }, LOIN],
      [GARAGE, VILLA, { ...LOIN, id: 'c-ailleurs' }],
      [GARAGE, VILLA],
    ]) expect(signatureZones(pointables(autre))).not.toBe(signature)
    // Aucune zone (chantiers sans position valable) : signature vide.
    expect(signatureZones([{ id: 'c-faux', titre: '', latitude: 200, longitude: 5, rayonM: 50 }])).toBe('')
  })

  it('réglage du téléphone : illisible ou ancien format → aucun ; écrit puis effacé', () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    localStorage.setItem(CLE, '{abîmé')
    expect(lireConfig()).toBeNull()
    expect(avertir).toHaveBeenCalled()
    localStorage.setItem(CLE, JSON.stringify({ membreId: 'm-paul', signature: 's' }))
    expect(lireConfig()).toBeNull()
    localStorage.setItem(CLE, JSON.stringify(['m-paul']))
    expect(lireConfig()).toBeNull()
    ecrireConfig({ membreId: 'm-paul', appareilId: 'app-1', signature: 's' })
    expect(lireConfig()).toStrictEqual({ membreId: 'm-paul', appareilId: 'app-1', signature: 's' })
    ecrireConfig({ membreId: 'm-paul', appareilId: 'app-1', signature: 's', reposeLe: 5 })
    expect(lireConfig()).toStrictEqual({ membreId: 'm-paul', appareilId: 'app-1', signature: 's', reposeLe: 5 })
    localStorage.setItem(CLE, JSON.stringify({ membreId: 'm-paul', appareilId: 'app-1', signature: 's', reposeLe: 'hier' }))
    expect(lireConfig()).toStrictEqual({ membreId: 'm-paul', appareilId: 'app-1', signature: 's' })
    ecrireConfig(null)
    expect(localStorage.getItem(CLE)).toBeNull()
    avertir.mockRestore()
  })

  it('les opérations sur les zones passent une à une, même lancées coup sur coup', async () => {
    const synchro = synchroniserZones(pointables([VILLA, GARAGE]), null)
    const arret = arreterSurCeTelephone()
    await Promise.all([synchro, arret])
    expect(natif.journal).toEqual([
      'getMonitoredGeofences', 'removeAllGeofences', 'addGeofence', 'addGeofence', 'getMonitoredGeofences',
      'removeAllGeofences', 'clearGeofenceQueue',
    ])
    expect(natif.zones.size).toBe(0)
  })

  it('une opération en échec ne bloque pas les suivantes', async () => {
    natif.panne = 'getMonitoredGeofences'
    await expect(synchroniserZones(pointables([VILLA]), null)).rejects.toThrow('panne getMonitoredGeofences')
    natif.panne = null
    await arreterSurCeTelephone()
    expect(natif.journal.slice(-2)).toEqual(['removeAllGeofences', 'clearGeofenceQueue'])
  })
})
