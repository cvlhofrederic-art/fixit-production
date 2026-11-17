// @vitest-environment node
// tests/api/btp-pointage-evenement.test.ts — POST /api/btp/pointage/evenement : arrivées et départs envoyés par le
// code natif de l'appli Vitfix Pro (géorepérage du système, téléphone en poche, 17/11/2026), y compris livrés dans le
// désordre ou deux fois (file Android), chantiers voisins, pointage terminé à la main sur place.
// Base simulée en mémoire et données fictives : tests/helpers/base-memoire-pointage.ts.

import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { NOTE_A_REGULARISER } from '@/lib/btp/pointage-regles'
import { NOTE_PASSAGE_BREF, empreinteJeton, nouveauJeton } from '@/lib/btp/pointage-arriere-plan'
import {
  C_FINI, C_GARAGE, C_IMMEUBLE, C_JEAN, C_SOC_B, C_VILLA, HEURE, M_JEAN, M_PAUL, MAINTENANT, SOC_A, U_INACTIF, U_PAUL,
  donnees, etat, type Ligne,
} from '../helpers/base-memoire-pointage'

vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/base-memoire-pointage')).supabaseMemoire }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const { POST } = await import('@/app/api/btp/pointage/evenement/route')
const { checkRateLimit } = await import('@/lib/rate-limit')

const MINUTE = 60_000
let JETON = ''
const APPAREIL = randomUUID()

async function appareil(changements: Ligne = {}): Promise<Ligne> {
  return {
    id: APPAREIL, owner_id: SOC_A, membre_id: M_PAUL, user_id: U_PAUL, empreinte: await empreinteJeton(JETON),
    plateforme: 'android', email_fiche: 'paul@a.example', fuseau: 'Europe/Paris', cree_le: '2026-11-16T06:00:00Z',
    vu_le: null, retire_le: null, traite_jusqu_au: null, dernier_evenement_le: null, ...changements,
  }
}

const recevoir = async (corps: unknown, jeton: string | null = JETON) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (jeton !== null) headers.Authorization = `Bearer ${jeton}`
  const res = await POST(new NextRequest('https://vitfix.io/api/btp/pointage/evenement', {
    method: 'POST', headers, body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}
const entree = (chantier: string, time?: number) => recevoir({ identifier: chantier, transition: 'enter', enter: true, time, radius: 150 })
const sortie = (chantier: string, time?: number) => recevoir({ identifier: chantier, transition: 'exit', enter: false, time, radius: 150 })

const telephone = () => etat.tables.pointage_appareils_btp[0]
const ouvertsDePaul = () => (etat.tables.pointages_btp ?? []).filter(p => p.membre_id === M_PAUL && p.heure_depart == null)
const pointagesDePaulLe = (date: string) => (etat.tables.pointages_btp ?? []).filter(p => p.membre_id === M_PAUL && p.date === date)
const iso = (instant: number) => new Date(instant).toISOString()

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  donnees()
  JETON = nouveauJeton()
  etat.tables.pointage_appareils_btp = [await appareil()]
  etat.indexUnique = true
  etat.tablesAbsentes = new Set()
  etat.ecritures = []
  etat.avantMiseAJour = null
})
afterEach(() => { vi.useRealTimers() })

describe('arrivée détectée par le téléphone', () => {
  it('ouvre un pointage automatique daté de la détection (heure murale du fuseau du téléphone)', async () => {
    const r = await entree(C_VILLA, MAINTENANT - 2 * MINUTE)
    expect(r).toEqual({ status: 200, json: { statut: 'arrivee' } })
    const [ouvert] = ouvertsDePaul()
    expect(ouvert).toMatchObject({
      owner_id: SOC_A, chantier_id: C_VILLA, chantier_nom: 'Villa', mode: 'geo_auto', date: '2026-11-16', heure_arrivee: '08:28:00',
      created_at: iso(MAINTENANT - 2 * MINUTE), notes: null,
    })
    // Ni position ni distance enregistrées.
    expect(ouvert.arrivee_lat).toBeUndefined()
    expect(ouvert.distance_m).toBeUndefined()
  })

  it('fuseau du téléphone enregistré à Lisbonne : heure murale de Lisbonne', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ fuseau: 'Europe/Lisbon' })]
    await entree(C_VILLA, MAINTENANT)
    expect(ouvertsDePaul()[0]).toMatchObject({ heure_arrivee: '07:30:00' })
  })

  it('arrivée reçue plus de 15 min après sa détection : note pour le gérant ; 15 min tout juste : aucune', async () => {
    await entree(C_VILLA, MAINTENANT - 40 * MINUTE)
    expect(ouvertsDePaul()[0].notes).toBe('Arrivée reçue 40 min après sa détection par le téléphone (envoi retardé) : à vérifier.')
    donnees()
    etat.tables.pointage_appareils_btp = [await appareil()]
    await entree(C_VILLA, MAINTENANT - 15 * MINUTE)
    expect(ouvertsDePaul()[0].notes).toBeNull()
  })

  it('nouvelle arrivée sur le chantier déjà pointé (zones reposées par le système) : rien de plus', async () => {
    await entree(C_VILLA, MAINTENANT - 2 * MINUTE)
    expect(await entree(C_VILLA, MAINTENANT)).toEqual({ status: 200, json: { statut: 'deja' } })
    expect(ouvertsDePaul()).toHaveLength(1)
  })

  it('chantier affecté par l’équipe : pointé aussi', async () => {
    expect((await entree(C_IMMEUBLE)).json).toEqual({ statut: 'arrivee' })
  })

  it('pointage commencé à la main en cours : jamais terminé par le téléphone, l’arrivée ne compte pas', async () => {
    etat.tables.pointages_btp.push({
      id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-16',
      heure_arrivee: '07:00:00', heure_depart: null, mode: 'manuel', created_at: iso(MAINTENANT - 90 * MINUTE),
    })
    expect((await entree(C_IMMEUBLE)).json).toEqual({ statut: 'pointage_different' })
    expect(ouvertsDePaul().map(p => p.chantier_id)).toEqual([C_VILLA])
    expect(telephone().entree_attente_chantier).toBeNull()
  })

  it('chantier non affecté, terminé ou d’une autre société : ignoré', async () => {
    const chantiers = [C_JEAN, C_FINI, C_SOC_B]
    for (const [i, chantier] of chantiers.entries()) {
      expect((await entree(chantier, MAINTENANT - (chantiers.length - i) * MINUTE)).json).toEqual({ statut: 'chantier_non_affecte' })
    }
    expect(ouvertsDePaul()).toEqual([])
  })

  it('chantier sans position GPS : ignoré', async () => {
    expect((await entree(C_GARAGE)).json).toEqual({ statut: 'chantier_sans_position' })
  })

  it('entrée de la veille livrée ce matin par la file : ignorée', async () => {
    // 15/11 22:00 UTC = 23:00 à Paris, la veille ; moins de 12 h avant maintenant.
    expect((await entree(C_VILLA, Date.UTC(2026, 10, 15, 22, 0, 0))).json).toEqual({ statut: 'jour_passe' })
    expect(ouvertsDePaul()).toEqual([])
  })

  it('deux envois simultanés : un seul pointage (index de la migration 20261116)', async () => {
    etat.courseAvantInsertion = {
      id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-16',
      heure_arrivee: '08:29:00', heure_depart: null, mode: 'geo_auto', created_at: iso(MAINTENANT - MINUTE),
    }
    expect((await entree(C_VILLA)).json).toEqual({ statut: 'deja' })
    expect(ouvertsDePaul()).toHaveLength(1)
  })

  it('pointage terminé à la main sur ce chantier aujourd’hui : arrivées ignorées jusqu’à ce que le téléphone en voie la sortie', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ bloque_chantier: C_VILLA, bloque_le: iso(MAINTENANT - HEURE) })]
    vi.setSystemTime(MAINTENANT + 10 * MINUTE)
    expect((await entree(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'bloque' })
    expect((await entree(C_IMMEUBLE, MAINTENANT + MINUTE)).json).toEqual({ statut: 'arrivee' })
    expect((await sortie(C_IMMEUBLE, MAINTENANT + 2 * MINUTE)).json).toEqual({ statut: 'passage_bref' })
    expect(telephone().bloque_chantier).toBe(C_VILLA)
    expect((await sortie(C_VILLA, MAINTENANT + 5 * MINUTE)).json).toEqual({ statut: 'aucun_pointage_en_cours' })
    expect(telephone().bloque_chantier).toBeNull()
    expect((await entree(C_VILLA, MAINTENANT + 6 * MINUTE)).json).toEqual({ statut: 'arrivee' })
  })

  it('blocage d’un jour précédent : sans effet', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ bloque_chantier: C_VILLA, bloque_le: '2026-11-15T15:00:00.000Z' })]
    expect((await entree(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'arrivee' })
  })
})

describe('départ détecté par le téléphone', () => {
  it('referme le pointage automatique, daté de la sortie vue par le téléphone', async () => {
    await entree(C_VILLA, MAINTENANT)
    vi.setSystemTime(MAINTENANT + 4 * HEURE + 5 * MINUTE)
    expect((await sortie(C_VILLA, MAINTENANT + 4 * HEURE)).json).toEqual({ statut: 'depart' })
    expect(pointagesDePaulLe('2026-11-16')[0]).toMatchObject({ heure_depart: '12:30:00', heures_travaillees: 4 })
  })

  it('entrée puis sortie en moins de 3 min (passage) : refermé sans heures, avec une note', async () => {
    await entree(C_VILLA, MAINTENANT)
    vi.setSystemTime(MAINTENANT + 2 * MINUTE)
    expect((await sortie(C_VILLA, MAINTENANT + 2 * MINUTE)).json).toEqual({ statut: 'passage_bref' })
    expect(pointagesDePaulLe('2026-11-16')[0]).toMatchObject({ heure_depart: '08:30:00', heures_travaillees: 0, notes: NOTE_PASSAGE_BREF })
  })

  it('3 min tout juste : compté', async () => {
    await entree(C_VILLA, MAINTENANT)
    vi.setSystemTime(MAINTENANT + 3 * MINUTE)
    expect((await sortie(C_VILLA, MAINTENANT + 3 * MINUTE)).json).toEqual({ statut: 'depart' })
  })

  it('sortie annoncée dans le futur (horloge du téléphone en avance) : heure de réception', async () => {
    await entree(C_VILLA, MAINTENANT)
    vi.setSystemTime(MAINTENANT + 4 * HEURE)
    await sortie(C_VILLA, MAINTENANT + 4 * HEURE + 5 * MINUTE)
    expect(pointagesDePaulLe('2026-11-16')[0]).toMatchObject({ heure_depart: '12:30:00', heures_travaillees: 4 })
  })

  it('sortie datée d’avant l’arrivée du pointage ouvert (passage précédent livré tard) : ne le termine pas', async () => {
    etat.tables.pointages_btp.push({
      id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-16',
      heure_arrivee: '08:30:00', heure_depart: null, mode: 'geo_auto', created_at: iso(MAINTENANT),
    })
    vi.setSystemTime(MAINTENANT + HEURE)
    expect((await sortie(C_VILLA, MAINTENANT - 30 * MINUTE)).json).toEqual({ statut: 'sortie_anterieure' })
    expect(ouvertsDePaul()).toHaveLength(1)
  })

  it('pointage commencé à la main : jamais terminé par le téléphone', async () => {
    etat.tables.pointages_btp.push({
      id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-16',
      heure_arrivee: '07:00:00', heure_depart: null, mode: 'manuel', created_at: iso(MAINTENANT - 90 * MINUTE),
    })
    expect((await sortie(C_VILLA)).json).toEqual({ statut: 'pointage_different' })
    expect(ouvertsDePaul()).toHaveLength(1)
  })

  it('aucun pointage ouvert sur ce chantier : rien, la sortie est gardée pour son arrivée', async () => {
    expect((await sortie(C_VILLA)).json).toEqual({ statut: 'aucun_pointage_en_cours' })
    expect(telephone()).toMatchObject({ sortie_attente_chantier: C_VILLA, sortie_attente_le: iso(MAINTENANT) })
  })

  it('sortie d’un autre chantier que celui du pointage ouvert : rien de refermé', async () => {
    await entree(C_VILLA, MAINTENANT)
    vi.setSystemTime(MAINTENANT + HEURE)
    expect((await sortie(C_IMMEUBLE, MAINTENANT + HEURE)).json).toEqual({ statut: 'aucun_pointage_en_cours' })
    expect(ouvertsDePaul().map(p => p.chantier_id)).toEqual([C_VILLA])
  })

  it('pointage de la veille refermé par une sortie livrée tard : la vraie fin, pas un oubli', async () => {
    etat.tables.pointages_btp.push({
      id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-15',
      heure_arrivee: '13:00:00', heure_depart: null, mode: 'geo_auto', created_at: '2026-11-15T12:00:00.000Z',
    })
    expect((await sortie(C_VILLA, Date.UTC(2026, 10, 15, 20, 0, 0))).json).toEqual({ statut: 'depart' })
    expect(pointagesDePaulLe('2026-11-15')[0]).toMatchObject({ heure_depart: '21:00:00', heures_travaillees: 8 })
  })
})

describe('chantiers voisins (zones qui se chevauchent)', () => {
  it('arrivée sur le second pendant le pointage du premier : en attente, ouverte à la sortie du premier', async () => {
    await entree(C_VILLA, MAINTENANT - HEURE)
    expect((await entree(C_IMMEUBLE, MAINTENANT - 10 * MINUTE)).json).toEqual({ statut: 'en_attente' })
    expect(ouvertsDePaul().map(p => p.chantier_id)).toEqual([C_VILLA])
    vi.setSystemTime(MAINTENANT + MINUTE)
    expect((await sortie(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'depart' })
    expect(pointagesDePaulLe('2026-11-16').find(p => p.chantier_id === C_VILLA)).toMatchObject({ heure_depart: '08:30:00', heures_travaillees: 1 })
    // Jamais avant la sortie du premier : aucune heure comptée deux fois.
    expect(ouvertsDePaul()).toEqual([expect.objectContaining({ chantier_id: C_IMMEUBLE, heure_arrivee: '08:30:00', mode: 'geo_auto' })])
    expect(telephone().entree_attente_chantier).toBeNull()
  })

  it('sorti du second avant la fin du premier : l’arrivée en attente est oubliée', async () => {
    await entree(C_VILLA, MAINTENANT - HEURE)
    await entree(C_IMMEUBLE, MAINTENANT - 30 * MINUTE)
    expect((await sortie(C_IMMEUBLE, MAINTENANT - 20 * MINUTE)).json).toEqual({ statut: 'aucun_pointage_en_cours' })
    expect(telephone().sortie_attente_chantier).toBeNull()
    await sortie(C_VILLA, MAINTENANT)
    expect(ouvertsDePaul()).toEqual([])
  })
})

describe('envois livrés dans le désordre ou deux fois (file Android)', () => {
  it('arrivée renvoyée après la sortie (réponse perdue) : ignorée, aucune heure comptée deux fois', async () => {
    await entree(C_VILLA, MAINTENANT)
    vi.setSystemTime(MAINTENANT + 4 * HEURE + 5 * MINUTE)
    await sortie(C_VILLA, MAINTENANT + 4 * HEURE)
    vi.setSystemTime(MAINTENANT + 5 * HEURE)
    expect((await entree(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'perime' })
    expect(pointagesDePaulLe('2026-11-16')).toEqual([expect.objectContaining({ heure_depart: '12:30:00', heures_travaillees: 4 })])
  })

  it('sortie renvoyée : ignorée la seconde fois', async () => {
    await entree(C_VILLA, MAINTENANT)
    vi.setSystemTime(MAINTENANT + 4 * HEURE)
    await sortie(C_VILLA, MAINTENANT + 4 * HEURE)
    expect((await sortie(C_VILLA, MAINTENANT + 4 * HEURE)).json).toEqual({ statut: 'perime' })
    expect(pointagesDePaulLe('2026-11-16')).toHaveLength(1)
  })

  it('sortie de la veille livrée après l’arrivée du jour : ignorée, le pointage du jour reste ouvert', async () => {
    etat.tables.pointages_btp.push({
      id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-15',
      heure_arrivee: '13:00:00', heure_depart: null, mode: 'geo_auto', created_at: '2026-11-15T12:00:00.000Z',
    })
    await entree(C_VILLA, MAINTENANT - 10 * MINUTE)
    expect((await sortie(C_VILLA, Date.UTC(2026, 10, 15, 20, 0, 0))).json).toEqual({ statut: 'perime' })
    expect(ouvertsDePaul()).toEqual([expect.objectContaining({ date: '2026-11-16', heure_arrivee: '08:20:00' })])
    // La veille, refermée sans heures « à régulariser » par le gérant (aucune sortie vue avant l'arrivée du jour).
    expect(pointagesDePaulLe('2026-11-15')[0]).toMatchObject({ heures_travaillees: 0, notes: NOTE_A_REGULARISER })
  })

  it('sortie traitée avant son arrivée (envois en attente de réseau livrés ensemble) : passage enregistré en entier', async () => {
    vi.setSystemTime(MAINTENANT + 5 * HEURE)
    expect((await sortie(C_VILLA, MAINTENANT + 4 * HEURE)).json).toEqual({ statut: 'aucun_pointage_en_cours' })
    expect((await entree(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'arrivee_et_depart' })
    expect(pointagesDePaulLe('2026-11-16')).toEqual([expect.objectContaining({
      heure_arrivee: '08:30:00', heure_depart: '12:30:00', heures_travaillees: 4, mode: 'geo_auto',
      notes: 'Arrivée reçue 300 min après sa détection par le téléphone (envoi retardé) : à vérifier.',
    })])
    expect(telephone().sortie_attente_chantier).toBeNull()
    // Arrivée renvoyée encore une fois : plus rien à compléter.
    expect((await entree(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'perime' })
    expect(pointagesDePaulLe('2026-11-16')).toHaveLength(1)
  })

  it('paire de moins de 3 min : refermée sans heures', async () => {
    vi.setSystemTime(MAINTENANT + 10 * MINUTE)
    await sortie(C_VILLA, MAINTENANT + 2 * MINUTE)
    expect((await entree(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'passage_bref' })
    expect(pointagesDePaulLe('2026-11-16')[0]).toMatchObject({ heures_travaillees: 0, notes: expect.stringContaining(NOTE_PASSAGE_BREF) })
  })

  it('sortie ancienne, même avec une sortie gardée sur ce chantier : ignorée, rien de créé', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({
      dernier_evenement_le: iso(MAINTENANT), sortie_attente_chantier: C_VILLA, sortie_attente_le: iso(MAINTENANT),
    })]
    vi.setSystemTime(MAINTENANT + MINUTE)
    expect((await sortie(C_VILLA, MAINTENANT - HEURE)).json).toEqual({ statut: 'perime' })
    expect(pointagesDePaulLe('2026-11-16')).toEqual([])
  })

  it('arrivée ancienne postérieure à la sortie gardée, ou de la veille : pas une paire, ignorée', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({
      dernier_evenement_le: iso(MAINTENANT + HEURE), sortie_attente_chantier: C_VILLA, sortie_attente_le: iso(MAINTENANT),
    })]
    vi.setSystemTime(MAINTENANT + 2 * HEURE)
    expect((await entree(C_VILLA, MAINTENANT + 30 * MINUTE)).json).toEqual({ statut: 'perime' })
    // Sortie gardée à 00:30 (heure de Paris), arrivée la veille à 23:50 : à cheval sur minuit.
    etat.tables.pointage_appareils_btp = [await appareil({
      dernier_evenement_le: iso(Date.UTC(2026, 10, 15, 23, 30, 0)), sortie_attente_chantier: C_VILLA, sortie_attente_le: iso(Date.UTC(2026, 10, 15, 23, 30, 0)),
    })]
    expect((await entree(C_VILLA, Date.UTC(2026, 10, 15, 22, 50, 0))).json).toEqual({ statut: 'perime' })
    expect(pointagesDePaulLe('2026-11-16')).toEqual([])
    expect(pointagesDePaulLe('2026-11-15')).toEqual([])
  })

  it('arrivée ancienne alors qu’un pointage est ouvert : pas de paire (aucune heure comptée deux fois)', async () => {
    // Sans même compter sur l'index « un pointage ouvert par employé » de la base.
    etat.indexUnique = false
    vi.setSystemTime(MAINTENANT + 5 * HEURE)
    await sortie(C_VILLA, MAINTENANT + 2 * HEURE)
    await entree(C_IMMEUBLE, MAINTENANT + 3 * HEURE)
    expect((await entree(C_VILLA, MAINTENANT)).json).toEqual({ statut: 'perime' })
    expect(pointagesDePaulLe('2026-11-16').map(p => p.chantier_id)).toEqual([C_IMMEUBLE])
  })

  it('arrivée ancienne sans sortie gardée pour elle, ou sur un autre chantier : ignorée', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ dernier_evenement_le: iso(MAINTENANT) })]
    expect((await entree(C_VILLA, MAINTENANT - 10 * MINUTE)).json).toEqual({ statut: 'perime' })
    etat.tables.pointage_appareils_btp = [await appareil({
      dernier_evenement_le: iso(MAINTENANT), sortie_attente_chantier: C_IMMEUBLE, sortie_attente_le: iso(MAINTENANT),
    })]
    expect((await entree(C_VILLA, MAINTENANT - 10 * MINUTE)).json).toEqual({ statut: 'perime' })
    expect(ouvertsDePaul()).toEqual([])
    expect(pointagesDePaulLe('2026-11-16')).toEqual([])
  })

  it('état du téléphone écrit et main rendue après chaque envoi', async () => {
    await entree(C_VILLA, MAINTENANT - 2 * MINUTE)
    expect(telephone()).toMatchObject({ dernier_evenement_le: iso(MAINTENANT - 2 * MINUTE), traite_jusqu_au: null, vu_le: iso(MAINTENANT) })
  })

  it('main prise par un autre envoi entre la lecture et la prise : 429, rien d’appliqué', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ traite_jusqu_au: iso(MAINTENANT - 1) })]
    etat.avantMiseAJour = table => {
      if (table === 'pointage_appareils_btp') telephone().traite_jusqu_au = iso(MAINTENANT + 15_000)
    }
    expect(await entree(C_VILLA)).toEqual({ status: 429, json: { statut: 'occupe' } })
    expect(ouvertsDePaul()).toEqual([])
    expect(telephone().traite_jusqu_au).toBe(iso(MAINTENANT + 15_000))
  })

  it('un autre envoi du même téléphone en cours de traitement : 429, le téléphone réessaiera ; main expirée : reprise', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ traite_jusqu_au: iso(MAINTENANT + 10_000) })]
    expect(await entree(C_VILLA)).toEqual({ status: 429, json: { statut: 'occupe' } })
    expect(ouvertsDePaul()).toEqual([])
    etat.tables.pointage_appareils_btp = [await appareil({ traite_jusqu_au: iso(MAINTENANT - 1) })]
    expect((await entree(C_VILLA)).json).toEqual({ statut: 'arrivee' })
    expect(telephone().traite_jusqu_au).toBeNull()
  })
})

describe('événements ignorés, réponses', () => {
  it('pointage automatique coupé par le gérant : ni arrivée ni départ', async () => {
    await entree(C_VILLA, MAINTENANT - 10 * MINUTE)
    etat.tables.pointage_reglages_btp = [{ owner_id: SOC_A, auto_active: false }]
    expect((await sortie(C_VILLA, MAINTENANT - 5 * MINUTE)).json).toEqual({ statut: 'pointage_auto_desactive' })
    expect((await entree(C_IMMEUBLE, MAINTENANT)).json).toEqual({ statut: 'pointage_auto_desactive' })
    expect(ouvertsDePaul()).toHaveLength(1)
  })

  it('jeton absent, inconnu ou retiré : 200 « ignoré » (la file du téléphone se vide), rien d’écrit', async () => {
    expect(await recevoir({ identifier: C_VILLA, transition: 'enter' }, null)).toEqual({ status: 200, json: { statut: 'jeton_absent' } })
    expect((await recevoir({ identifier: C_VILLA, transition: 'enter' }, nouveauJeton())).json).toEqual({ statut: 'appareil_inconnu' })
    etat.tables.pointage_appareils_btp = [await appareil({ retire_le: '2026-11-16T07:00:00Z' })]
    expect((await entree(C_VILLA)).json).toEqual({ statut: 'appareil_inconnu' })
    expect(etat.ecritures).toEqual([])
  })

  it('limite par adresse avant toute lecture du téléphone (jetons inventés en masse) : 429', async () => {
    vi.mocked(checkRateLimit).mockImplementationOnce(async (cle: string) => !cle.startsWith('btp_pointage_evenement_ip_'))
    expect((await entree(C_VILLA)).status).toBe(429)
    expect(etat.ecritures).toEqual([])
    expect(ouvertsDePaul()).toEqual([])
  })

  it('corps illisible ou incomplet : 200 « ignoré » ; démesuré : 413', async () => {
    expect(await recevoir('pas du json')).toEqual({ status: 200, json: { statut: 'corps_invalide' } })
    expect((await recevoir({ identifier: 'bureau', transition: 'enter' })).json).toEqual({ statut: 'corps_invalide' })
    expect((await recevoir({ identifier: C_VILLA, transition: 'enter', payload: 'x'.repeat(5000) })).status).toBe(413)
    // Taille annoncée trop grande : refusé avant de lire le corps.
    const annonce = await POST(new NextRequest('https://vitfix.io/api/btp/pointage/evenement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '999999', Authorization: `Bearer ${JETON}` },
      body: JSON.stringify({ identifier: C_VILLA, transition: 'enter' }),
    }))
    expect(annonce.status).toBe(413)
    expect(ouvertsDePaul()).toEqual([])
  })

  it('compte sorti de la société : téléphone retiré, rien d’enregistré', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ user_id: U_INACTIF, membre_id: M_JEAN })]
    expect((await recevoir({ identifier: C_JEAN, transition: 'enter' })).json).toEqual({ statut: 'compte_inactif' })
    expect(telephone().retire_le).toBe(iso(MAINTENANT))
    expect((etat.tables.pointages_btp ?? []).filter(p => p.membre_id === M_JEAN && p.heure_depart == null)).toEqual([])
  })

  it('fiche passée à une autre adresse e-mail (plus celle de ce compte) : téléphone retiré, rien d’enregistré', async () => {
    etat.tables.membres_btp = etat.tables.membres_btp.map(m => (m.id === M_PAUL ? { ...m, email: 'autre@a.example' } : m))
    expect((await entree(C_VILLA)).json).toEqual({ statut: 'fiche_changee' })
    expect(telephone().retire_le).toBe(iso(MAINTENANT))
    expect(ouvertsDePaul()).toEqual([])
  })

  it('le gérant lui-même peut pointer depuis son téléphone', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ user_id: SOC_A })]
    expect((await entree(C_VILLA)).json).toEqual({ statut: 'arrivee' })
  })

  it('fiche employé retirée ou inactive : ignoré', async () => {
    etat.tables.membres_btp = etat.tables.membres_btp.map(m => (m.id === M_PAUL ? { ...m, actif: false } : m))
    expect((await entree(C_VILLA)).json).toEqual({ statut: 'fiche_absente' })
  })

  it('heure de détection de plus de 12 h : ignoré ; dans le futur (horloge en avance) : heure de réception', async () => {
    expect((await entree(C_VILLA, MAINTENANT - 13 * HEURE)).json).toEqual({ statut: 'horodatage_refuse' })
    expect(ouvertsDePaul()).toEqual([])
    expect((await entree(C_VILLA, MAINTENANT + HEURE)).json).toEqual({ statut: 'arrivee' })
    expect(ouvertsDePaul()[0]).toMatchObject({ heure_arrivee: '08:30:00', created_at: iso(MAINTENANT) })
  })

  it('table des téléphones absente (migration 20261117 non appliquée) : ignoré', async () => {
    etat.tablesAbsentes = new Set(['pointage_appareils_btp'])
    expect((await entree(C_VILLA)).json).toEqual({ statut: 'appareil_inconnu' })
  })

  it('panne de la base : 500 pour que le téléphone réessaie ; main rendue, état inchangé', async () => {
    etat.tablesAbsentes = new Set(['membres_btp'])
    expect((await entree(C_VILLA)).status).toBe(500)
    expect(telephone()).toMatchObject({ traite_jusqu_au: null, dernier_evenement_le: null })
  })
})
