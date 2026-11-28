// tests/lib/notifications.test.ts — rappels d'intervention J-1 de l'espace mobile artisan (lib/notifications.ts).
// Dans l'appli Vitfix Pro, @capacitor/local-notifications rend le proxy de registerPlugin (@capacitor/core), qui répond
// à toute propriété lue, « then » compris : rendu par une fonction async, il était pris pour une promesse jamais
// résolue, et aucun rappel n'était programmé ni annulé, sans erreur visible pour l'artisan (trouvé le 17/11/2026).
// L'appli est simulée comme sous Android (pont androidBridge, lu par le vrai @capacitor/core) et le module natif par un
// proxy qui se comporte comme celui de registerPlugin.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor, registerPlugin } from '@capacitor/core'

interface Appel { methode: string; options: unknown }
type Notification = Record<string, unknown> & { id: number }

const natif = {
  /** Évaluations du module natif (vi.doMock, reposé avant chaque test, fait relancer la fabrique à l'import suivant). */
  chargements: 0,
  /**
   * Lectures de LocalNotifications dans le module, une par import mené à bien par lib/notifications : le cache des
   * modules de Vitest rendant le même module à chaque import, seul ce compte montre que le module n'est importé qu'une
   * fois.
   */
  lectures: 0,
  /** Imports à faire échouer (fichier du module introuvable, réseau coupé). */
  echecsDeChargement: 0,
  appels: [] as Appel[],
  /** Réponse du système à la demande d'autorisation. */
  affichage: 'granted',
  /** État lu sans dialogue (checkPermissions) : 'prompt' tant que la question n'a jamais été posée. */
  etat: 'granted',
  /** Identifiants des notifications encore en attente (getPending) ; null : la lecture échoue. */
  enAttente: [] as number[] | null,
}

function moduleNatifSimule() {
  natif.chargements += 1
  if (natif.echecsDeChargement > 0) {
    natif.echecsDeChargement -= 1
    throw new Error('chargement du module impossible')
  }
  const reponses: Record<string, () => unknown> = {
    requestPermissions: () => ({ display: natif.affichage }),
    checkPermissions: () => ({ display: natif.etat }),
    schedule: () => ({ notifications: [] }),
    cancel: () => undefined,
    getPending: () => {
      if (natif.enAttente === null) throw new Error('lecture impossible')
      return { notifications: natif.enAttente.map(id => ({ id })) }
    },
  }
  // Comme le proxy de registerPlugin : toute propriété lue est une méthode, « then » compris. Une méthode que le code
  // natif ne connaît pas rend une promesse rejetée et ne rappelle jamais les fonctions reçues : un module rendu par une
  // fonction async laisse donc l'appelant en attente pour toujours.
  const LocalNotifications = new Proxy({}, {
    get: (_cible, nom) => {
      if (typeof nom === 'symbol') return undefined
      return async (options?: unknown) => {
        natif.appels.push({ methode: nom, options })
        await Promise.resolve()
        const reponse = reponses[nom]
        if (!reponse) throw new Error(`"LocalNotifications.${nom}()" is not implemented on android`)
        return reponse()
      }
    },
  })
  return {
    get LocalNotifications() {
      natif.lectures += 1
      return LocalNotifications
    },
  }
}

type Globale = Record<string, unknown>

/** Pont injecté par l'appli Android dans les pages du site : @capacitor/core répond alors « plateforme native ». */
function dansLAppli() {
  (globalThis as unknown as Globale).androidBridge = {}
  expect(Capacitor.isNativePlatform()).toBe(true)
}

/** Le résultat de l'opération ; un échec du test, et non une attente sans fin, si elle ne se termine jamais. */
async function sansBlocage<T>(operation: Promise<T>): Promise<T> {
  let minuterie: ReturnType<typeof setTimeout> | undefined
  const blocage = new Promise<never>((_resoudre, rejeter) => {
    minuterie = setTimeout(() => rejeter(new Error('opération restée en attente (module natif pris pour une promesse ?)')), 5000)
  })
  try {
    return await Promise.race([operation, blocage])
  } finally {
    clearTimeout(minuterie)
  }
}

/** lib/notifications neuf à chaque test (module natif pas encore chargé). */
const notifications = () => import('@/lib/notifications')

const notificationsProgrammees = (appel: Appel | undefined) =>
  (appel?.options as { notifications: Notification[] } | undefined)?.notifications ?? []

const RDV = {
  id: '0b7c6a52-9f1e-4a8e-b0c4-3c2d1e0f9a87',
  booking_date: '2026-11-19',
  booking_time: '09:30:00',
  address: '12 rue des Lilas, 13008 Marseille',
  serviceName: 'Débouchage',
}

beforeEach(() => {
  // Horloge figée (seule la date : la minuterie de sansBlocage reste réelle).
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 17, 8, 0, 0))
  Object.assign(natif, { chargements: 0, lectures: 0, echecsDeChargement: 0, appels: [], affichage: 'granted', etat: 'granted', enAttente: [] })
  vi.resetModules()
  vi.doMock('@capacitor/local-notifications', moduleNatifSimule)
})

afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as unknown as Globale).androidBridge
})

describe('rappels J-1 dans l’appli : le module natif est le proxy de registerPlugin', () => {
  it('programme le rappel la veille à la même heure, sans rester bloqué', async () => {
    dansLAppli()
    const { scheduleInterventionReminder } = await notifications()

    await sansBlocage(scheduleInterventionReminder(RDV))

    expect(natif.appels.map(a => a.methode)).toEqual(['requestPermissions', 'schedule'])
    const [rappel] = notificationsProgrammees(natif.appels[1])
    expect(rappel).toMatchObject({
      title: '🔧 Rappel intervention demain',
      body: 'Débouchage demain à 09:30 — 12 rue des Lilas, 13008 Marseille',
      schedule: { at: new Date(2026, 10, 18, 9, 30, 0), allowWhileIdle: true },
      extra: { bookingId: RDV.id },
    })
    expect(Number.isInteger(rappel.id)).toBe(true)
    expect(natif.chargements).toBe(1)
    expect(natif.lectures).toBe(1)
  })

  it('annule le rappel programmé (même identifiant), sans rester bloqué ni réimporter le module', async () => {
    dansLAppli()
    const { scheduleInterventionReminder, cancelInterventionReminder } = await notifications()

    await sansBlocage(scheduleInterventionReminder(RDV))
    await sansBlocage(cancelInterventionReminder(RDV.id))

    expect(natif.appels.map(a => a.methode)).toEqual(['requestPermissions', 'schedule', 'cancel'])
    const [rappel] = notificationsProgrammees(natif.appels[1])
    expect(natif.appels[2].options).toEqual({ notifications: [{ id: rappel.id }] })
    expect(natif.lectures).toBe(1)
  })

  it('annule sans rester bloqué quand c’est le premier appel depuis l’ouverture de l’appli', async () => {
    dansLAppli()
    const { cancelInterventionReminder } = await notifications()

    await sansBlocage(cancelInterventionReminder(RDV.id))

    expect(natif.appels.map(a => a.methode)).toEqual(['cancel'])
    expect(natif.chargements).toBe(1)
  })

  it('autorisation refusée : rien n’est programmé, et rien ne reste bloqué', async () => {
    dansLAppli()
    natif.affichage = 'denied'
    const { scheduleInterventionReminder } = await notifications()

    await sansBlocage(scheduleInterventionReminder(RDV))

    expect(natif.appels.map(a => a.methode)).toEqual(['requestPermissions'])
  })

  it('date ou heure vide ou mal formée : aucun rappel (sous Android, il partirait sur-le-champ)', async () => {
    dansLAppli()
    const { scheduleInterventionReminder } = await notifications()

    // page.tsx passe '' pour une date ou une heure absente ; « at » d'une date invalide partirait à null.
    await sansBlocage(scheduleInterventionReminder({ ...RDV, booking_date: '' }))
    await sansBlocage(scheduleInterventionReminder({ ...RDV, booking_time: '' }))
    await sansBlocage(scheduleInterventionReminder({ ...RDV, booking_time: '9h30' }))

    expect(natif.appels.map(a => a.methode)).not.toContain('schedule')
  })

  it('la notification immédiate part aussi sans rester bloquée', async () => {
    dansLAppli()
    const { sendImmediateNotification } = await notifications()

    await sansBlocage(sendImmediateNotification('Nouveau RDV', 'Débouchage le 19/11 à 09:30'))

    expect(natif.appels.map(a => a.methode)).toEqual(['requestPermissions', 'schedule'])
    expect(notificationsProgrammees(natif.appels[1])[0]).toMatchObject({ title: 'Nouveau RDV', body: 'Débouchage le 19/11 à 09:30' })
  })

  it('un échec de chargement du module remonte à l’appelant, puis le chargement est retenté', async () => {
    dansLAppli()
    natif.echecsDeChargement = 1
    const { scheduleInterventionReminder } = await notifications()

    await expect(sansBlocage(scheduleInterventionReminder(RDV))).rejects.toThrow()
    expect(natif.appels).toEqual([])

    await sansBlocage(scheduleInterventionReminder(RDV))
    expect(natif.appels.map(a => a.methode)).toEqual(['requestPermissions', 'schedule'])
    expect(natif.chargements).toBe(2)
    expect(natif.lectures).toBe(1)
  })
})

// ── Alerte météo des chantiers BTP (programmerNotification, annulerNotification, notificationEnAttente, 26/11/2026) ──

const ALERTE = { cle: 'alerte-meteo:c-dalle:2026-11-18', titre: '🌧️ Alerte météo demain : Dalle', corps: 'Prévu demain : pluie 12 mm.' }

describe('alerte météo dans l’appli', () => {
  it('heure future : programmée à cette heure, sous l’identifiant de la clé, sans dialogue d’autorisation', async () => {
    dansLAppli()
    const { programmerNotification } = await notifications()
    const a = new Date(2026, 10, 17, 18, 0, 0)

    expect(await sansBlocage(programmerNotification({ ...ALERTE, a, extra: { chantierId: 'c-dalle' } }))).toBe(true)

    expect(natif.appels.map(x => x.methode)).toEqual(['checkPermissions', 'schedule'])
    const [notification] = notificationsProgrammees(natif.appels[1])
    expect(notification).toMatchObject({
      title: ALERTE.titre, body: ALERTE.corps, schedule: { at: a, allowWhileIdle: true }, extra: { chantierId: 'c-dalle' },
    })
    expect(Number.isInteger(notification.id)).toBe(true)
  })

  it('heure absente, passée ou à moins d’une seconde : affichée tout de suite, sans heure', async () => {
    dansLAppli()
    const { programmerNotification } = await notifications()
    for (const a of [undefined, new Date(2026, 10, 17, 7, 0), new Date(Date.now() + 500), new Date(Number.NaN)]) {
      natif.appels = []
      expect(await sansBlocage(programmerNotification({ ...ALERTE, a }))).toBe(true)
      expect(notificationsProgrammees(natif.appels[1])[0].schedule).toBeUndefined()
    }
  })

  it('la même clé donne le même identifiant pour programmer, annuler et chercher en attente', async () => {
    dansLAppli()
    const { programmerNotification, annulerNotification, notificationEnAttente } = await notifications()
    await sansBlocage(programmerNotification({ ...ALERTE, a: new Date(2026, 10, 17, 18, 0) }))
    const id = notificationsProgrammees(natif.appels[1])[0].id

    await sansBlocage(annulerNotification(ALERTE.cle))
    expect(natif.appels[2]).toEqual({ methode: 'cancel', options: { notifications: [{ id }] } })

    natif.enAttente = [id]
    expect(await sansBlocage(notificationEnAttente(ALERTE.cle))).toBe(true)
    natif.enAttente = [id + 1]
    expect(await sansBlocage(notificationEnAttente(ALERTE.cle))).toBe(false)
  })

  it('lecture des notifications en attente impossible : vrai (l’alerte est remontrée sous le même identifiant)', async () => {
    dansLAppli()
    const { notificationEnAttente } = await notifications()
    natif.enAttente = null
    expect(await sansBlocage(notificationEnAttente(ALERTE.cle))).toBe(true)
  })

  it('autorisation refusée : false, rien n’est programmé, et aucun dialogue n’est rouvert', async () => {
    dansLAppli()
    natif.etat = 'denied'
    const { programmerNotification } = await notifications()
    expect(await sansBlocage(programmerNotification(ALERTE))).toBe(false)
    expect(natif.appels.map(x => x.methode)).toEqual(['checkPermissions'])
  })

  it('autorisationNotifications : le dialogue ne s’ouvre que si la question n’a jamais été posée', async () => {
    dansLAppli()
    const { autorisationNotifications } = await notifications()
    natif.etat = 'prompt'
    expect(await sansBlocage(autorisationNotifications())).toBe(true)
    expect(natif.appels.map(x => x.methode)).toEqual(['checkPermissions', 'requestPermissions'])
    natif.etat = 'prompt'
    natif.affichage = 'denied'
    expect(await sansBlocage(autorisationNotifications())).toBe(false)
    // Après un refus : plus aucun dialogue (sous Android 13+, un second refus serait définitif).
    for (const etat of ['denied', 'prompt-with-rationale']) {
      natif.appels = []
      natif.etat = etat
      expect(await sansBlocage(autorisationNotifications())).toBe(false)
      expect(natif.appels.map(x => x.methode)).toEqual(['checkPermissions'])
    }
    natif.appels = []
    natif.etat = 'granted'
    expect(await sansBlocage(autorisationNotifications())).toBe(true)
    expect(natif.appels.map(x => x.methode)).toEqual(['checkPermissions'])
  })

  it('module natif introuvable : false et aucune exception (programmer comme annuler)', async () => {
    dansLAppli()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    natif.echecsDeChargement = 3
    const { programmerNotification, annulerNotification, autorisationNotifications } = await notifications()
    expect(await sansBlocage(programmerNotification(ALERTE))).toBe(false)
    expect(await sansBlocage(annulerNotification(ALERTE.cle))).toBe(false)
    expect(await sansBlocage(autorisationNotifications())).toBe(false)
    expect(natif.appels).toEqual([])
    expect(await sansBlocage(annulerNotification(ALERTE.cle))).toBe(true)
  })
})

describe('hors de l’appli (site web)', () => {
  it('rien n’est chargé ni appelé', async () => {
    expect(Capacitor.isNativePlatform()).toBe(false)
    const {
      scheduleInterventionReminder, cancelInterventionReminder, sendImmediateNotification,
      programmerNotification, annulerNotification, notificationEnAttente, autorisationNotifications,
    } = await notifications()

    await sansBlocage(scheduleInterventionReminder(RDV))
    await sansBlocage(cancelInterventionReminder(RDV.id))
    await sansBlocage(sendImmediateNotification('Nouveau RDV', 'Débouchage'))
    expect(await sansBlocage(programmerNotification(ALERTE))).toBe(false)
    expect(await sansBlocage(annulerNotification(ALERTE.cle))).toBe(false)
    expect(await sansBlocage(notificationEnAttente(ALERTE.cle))).toBe(false)
    expect(await sansBlocage(autorisationNotifications())).toBe(false)

    expect(natif.chargements).toBe(0)
    expect(natif.lectures).toBe(0)
    expect(natif.appels).toEqual([])
  })
})

describe('le piège lui-même', () => {
  // Témoin de la cause, sur le vrai @capacitor/core. Si une version future neutralise « then », ce test passera au
  // rouge sans que le code soit en cause : retirer alors ce test, pas l'objet { plugin }.
  it('le vrai proxy de registerPlugin (@capacitor/core) a une méthode « then » : d’où l’objet { plugin }', () => {
    const proxy = registerPlugin<Record<string, unknown>>('EssaiProxyNotifications')
    expect(typeof proxy.then).toBe('function')
  })
})
