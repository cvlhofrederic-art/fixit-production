import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_NOTIFICATIONS } from '@/components/administrateur-judiciaire/data/notifications'
import { DEMO_ORDRES_DE_SERVICE } from '@/components/administrateur-judiciaire/data/ordres-de-service'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import type { NotificationLocale } from '@/lib/administrateur-judiciaire/db/schema'
import {
  NOTIFICATIONS_LUES_INITIALES_DEMO,
  SAISIE_ASSISTANT_MANDAT_DEMO,
  alerteLectureBase,
  idsNotificationsLuesInitiales,
  notificationsDuCentre,
  optionsSelonMode,
  saisieAssistantMandatParDefaut,
  selonMode,
} from '@/lib/administrateur-judiciaire/donnees-selon-mode'

/**
 * T01 / T02 (intégration Gestéam, lot 0) : en mode réel, aucune donnée de démonstration ne s'affiche là où l'écran
 * ne porte pas de bandeau « démonstration » (cadre commun, écrans « données réelles »), et une erreur de lecture de
 * la base est visible au lieu de produire une liste vide silencieuse. En démonstration, rien ne change.
 */

const notificationLocale = (surcharge: Partial<NotificationLocale>): NotificationLocale => ({
  id: 'nl-1',
  kind: 'note',
  titre: 'Note',
  description: 'Texte',
  date: new Date(2026, 9, 8, 15, 30),
  lu: false,
  coproprieteId: null,
  createdAt: '2026-10-08T13:30:00.000Z',
  updatedAt: '2026-10-08T13:30:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

describe('selonMode', () => {
  it('renvoie la valeur de démonstration en démo, la valeur réelle en mode réel', () => {
    expect(selonMode('demo', 'D', 'R')).toBe('D')
    expect(selonMode('reel', 'D', 'R')).toBe('R')
  })
})

describe('T01 — centre de notifications (cadre commun, visible sur tous les écrans)', () => {
  it('en démonstration, les notifications de démonstration sont inchangées', () => {
    expect(notificationsDuCentre('demo', DEMO_NOTIFICATIONS, [notificationLocale({})])).toBe(DEMO_NOTIFICATIONS)
    expect(idsNotificationsLuesInitiales('demo', [notificationLocale({ lu: true })])).toEqual(
      NOTIFICATIONS_LUES_INITIALES_DEMO,
    )
  })

  it('en mode réel avec une base vide, le centre est vide — pas les notifications de démonstration', () => {
    expect(notificationsDuCentre('reel', DEMO_NOTIFICATIONS, [])).toEqual([])
    expect(idsNotificationsLuesInitiales('reel', [])).toEqual([])
  })

  it('en mode réel, le centre affiche les notifications de la base, les plus récentes d’abord', () => {
    const centre = notificationsDuCentre('reel', DEMO_NOTIFICATIONS, [
      notificationLocale({ id: 'a', kind: 'legal', titre: 'Ancienne', date: new Date(2026, 9, 1, 9, 0) }),
      notificationLocale({ id: 'b', kind: 'inconnu', titre: 'Récente', description: 'Détail', date: new Date(2026, 9, 8, 15, 30) }),
    ])
    expect(centre.map((n) => n.id)).toEqual(['b', 'a'])
    expect(centre[0]).toEqual({ id: 'b', kind: 'inconnu', icon: 'bell', title: 'Récente', desc: 'Détail', time: '08/10/2026 à 15:30' })
    expect(centre[1].icon).toBe('scale')
    const idsDemo = new Set(DEMO_NOTIFICATIONS.map((n) => n.id))
    expect(centre.some((n) => idsDemo.has(n.id))).toBe(false)
  })

  it('en mode réel, l’état « lu » vient de la base', () => {
    expect(
      idsNotificationsLuesInitiales('reel', [notificationLocale({ id: 'x', lu: true }), notificationLocale({ id: 'y', lu: false })]),
    ).toEqual(['x'])
  })
})

describe('T01 — listes de choix (formulaire d’intervention, Fixy)', () => {
  it('en démonstration, les options de démonstration sont inchangées', () => {
    expect(optionsSelonMode('demo', DEMO_NOMS_COPROPRIETES, ['Réelle'])).toBe(DEMO_NOMS_COPROPRIETES)
  })

  it('en mode réel, les options viennent de la base ; base vide → aucune option de démonstration', () => {
    expect(optionsSelonMode('reel', DEMO_NOMS_COPROPRIETES, ['Résidence réelle'])).toEqual(['Résidence réelle'])
    expect(optionsSelonMode('reel', DEMO_NOMS_COPROPRIETES, [])).toEqual([])
    const nomsPrestataires = DEMO_PRESTATAIRES.map((p) => p.nom)
    expect(optionsSelonMode('reel', nomsPrestataires, [])).toEqual([])
  })

  it('en mode réel, Fixy ne reçoit aucun ordre de service de démonstration', () => {
    expect(selonMode('reel', DEMO_ORDRES_DE_SERVICE, [])).toEqual([])
    expect(selonMode('demo', DEMO_ORDRES_DE_SERVICE, [])).toBe(DEMO_ORDRES_DE_SERVICE)
  })
})

describe('T01 — assistant de mandat : aucune valeur de démonstration pré-remplie en mode réel', () => {
  it('en démonstration, les valeurs par défaut historiques sont conservées', () => {
    expect(saisieAssistantMandatParDefaut('demo', ['Autre'], 'Art. 29-1')).toEqual(SAISIE_ASSISTANT_MANDAT_DEMO('Art. 29-1'))
    expect(SAISIE_ASSISTANT_MANDAT_DEMO('Art. 29-1')).toMatchObject({
      copro: DEMO_NOMS_COPROPRIETES[1],
      tribunal: 'Tribunal judiciaire de Nanterre',
      ordonnance: '04/06/2026',
    })
  })

  it('en mode réel, ni copropriété, ni tribunal, ni RG, ni date, ni durée de démonstration', () => {
    const saisie = saisieAssistantMandatParDefaut('reel', ['Résidence réelle'], 'Art. 29-1')
    expect(saisie).toEqual({
      copro: 'Résidence réelle',
      tribunal: '',
      rg: '',
      ordonnance: '',
      duree: '',
      fondement: 'Art. 29-1',
    })
    expect(DEMO_NOMS_COPROPRIETES).not.toContain(saisie.copro)
  })

  it('en mode réel avec une base vide, la copropriété reste vide', () => {
    expect(saisieAssistantMandatParDefaut('reel', [], 'Art. 29-1').copro).toBe('')
  })
})

describe('T02 — une erreur de lecture de la base est visible en mode réel', () => {
  it('en mode réel, une erreur de lecture produit une alerte qui la cite', () => {
    expect(alerteLectureBase('reel', 'IndexedDB indisponible')).toEqual({
      titre: 'Lecture de la base impossible',
      message: "Vos données n'ont pas pu être lues (IndexedDB indisponible). Les listes affichées peuvent être incomplètes : ne vous y fiez pas avant d'avoir rechargé la page.",
    })
  })

  it('sans erreur, aucune alerte', () => {
    expect(alerteLectureBase('reel', null)).toBeNull()
  })

  it('en démonstration, le comportement existant est conservé (repli sur le jeu de démonstration, pas d’alerte)', () => {
    expect(alerteLectureBase('demo', 'IndexedDB indisponible')).toBeNull()
  })
})
