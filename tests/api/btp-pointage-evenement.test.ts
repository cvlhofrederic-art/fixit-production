// @vitest-environment node
// tests/api/btp-pointage-evenement.test.ts — POST /api/btp/pointage/evenement : arrivées et départs envoyés par le
// code natif de l'appli Vitfix Pro (géorepérage du système, téléphone en poche, 17/11/2026). Envois gardés au journal
// et journée rejouée : livrés dans le désordre ou deux fois (file Android), chantiers voisins, pointages à la main ou
// modifiés qui priment, journée finie sans sortie, refus et réponses.
// Base simulée en mémoire et données fictives : tests/helpers/base-memoire-pointage.ts.

import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { NOTE_A_REGULARISER } from '@/lib/btp/pointage-regles'
import { empreinteJeton, nouveauJeton } from '@/lib/btp/pointage-arriere-plan'
import {
  C_FINI, C_GARAGE, C_IMMEUBLE, C_JEAN, C_SOC_B, C_VILLA, M_JEAN, M_PAUL, SOC_A, U_INACTIF, U_PAUL,
  donnees, etat, type Ligne,
} from '../helpers/base-memoire-pointage'

vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/base-memoire-pointage')).supabaseMemoire }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const { POST } = await import('@/app/api/btp/pointage/evenement/route')
const { checkRateLimit } = await import('@/lib/rate-limit')

/** Heure murale de Paris (UTC+1 en novembre) ; le 16/11/2026 par défaut. */
const paris = (heure: number, minute = 0, jour = 16) => Date.UTC(2026, 10, jour, heure - 1, minute)
const iso = (instant: number) => new Date(instant).toISOString()
let JETON = ''
const APPAREIL = randomUUID()

async function appareil(changements: Ligne = {}): Promise<Ligne> {
  return {
    id: APPAREIL, owner_id: SOC_A, membre_id: M_PAUL, user_id: U_PAUL, empreinte: await empreinteJeton(JETON),
    plateforme: 'android', email_fiche: 'paul@a.example', fuseau: 'Europe/Paris', cree_le: '2026-11-16T06:00:00Z',
    vu_le: null, retire_le: null, traite_jusqu_au: null, ...changements,
  }
}

async function initialiser() {
  donnees()
  JETON = nouveauJeton()
  etat.tables.pointage_appareils_btp = [await appareil()]
  etat.indexUnique = true
  etat.tablesAbsentes = new Set()
  etat.ecritures = []
  etat.avantMiseAJour = null
  etat.courseAvantInsertion = null
}

const recevoir = async (corps: unknown, jeton: string | null = JETON, entetes: Record<string, string> = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...entetes }
  if (jeton !== null) headers.Authorization = `Bearer ${jeton}`
  const res = await POST(new NextRequest('https://vitfix.io/api/btp/pointage/evenement', {
    method: 'POST', headers, body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}
/** Envoi du téléphone détecté à `detecte`, reçu à `recu` (par défaut une minute après la détection). */
const envoi = (chantier: string, transition: 'enter' | 'exit', detecte: number, recu = detecte + 60_000) => {
  vi.setSystemTime(recu)
  return recevoir({ identifier: chantier, transition, enter: transition === 'enter', time: detecte, radius: 150 })
}
const entree = (chantier: string, detecte: number, recu?: number) => envoi(chantier, 'enter', detecte, recu)
const sortie = (chantier: string, detecte: number, recu?: number) => envoi(chantier, 'exit', detecte, recu)

const telephone = () => etat.tables.pointage_appareils_btp[0]
const lignesDePaul = (date = '2026-11-16') => (etat.tables.pointages_btp ?? [])
  .filter(p => p.membre_id === M_PAUL && p.date === date)
  .sort((a, b) => String(a.heure_arrivee).localeCompare(String(b.heure_arrivee)))
/** Pointages de Paul ce jour-là : chantier, arrivée, départ, heures. */
const resume = (date = '2026-11-16') => lignesDePaul(date).map(p => [p.chantier_id, p.heure_arrivee, p.heure_depart ?? null, p.heures_travaillees ?? null])
const journal = () => etat.tables.pointage_evenements_btp ?? []
const liens = () => etat.tables.pointage_lignes_appareil_btp ?? []

function permutations<T>(liste: readonly T[]): T[][] {
  if (liste.length <= 1) return [[...liste]]
  return liste.flatMap((x, i) => permutations([...liste.slice(0, i), ...liste.slice(i + 1)]).map(reste => [x, ...reste]))
}

type Envoi = [chantier: string, sens: 'enter' | 'exit', detecte: number]
/** Une journée d'envois livrée d'un bloc, dans chacun des ordres possibles : le même résultat à chaque fois. */
async function dansTousLesOrdres(envois: Envoi[], recu: number) {
  const resultats = new Set<string>()
  for (const ordre of permutations(envois)) {
    await initialiser()
    for (const [chantier, sens, detecte] of ordre) await envoi(chantier, sens, detecte, recu)
    resultats.add(JSON.stringify(resume()))
  }
  expect([...resultats]).toHaveLength(1)
  return JSON.parse([...resultats][0]) as unknown[]
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(paris(8, 30))
  await initialiser()
})
afterEach(() => { vi.useRealTimers() })

describe('en direct : arrivée puis départ', () => {
  it('arrivée : gardée au journal, pointage automatique ouvert à l’heure de détection, écrit par le téléphone', async () => {
    expect(await entree(C_VILLA, paris(8, 28))).toEqual({ status: 200, json: { statut: 'enregistre' } })
    expect(lignesDePaul()).toEqual([expect.objectContaining({
      owner_id: SOC_A, chantier_id: C_VILLA, chantier_nom: 'Villa', mode: 'geo_auto', heure_arrivee: '08:28:00',
      heure_depart: null, created_at: iso(paris(8, 28)), notes: null,
    })])
    // Ni position ni distance enregistrées.
    expect(lignesDePaul()[0].arrivee_lat).toBeUndefined()
    expect(journal()).toEqual([expect.objectContaining({
      appareil_id: APPAREIL, chantier_id: C_VILLA, chantier_nom: 'Villa', sens: 'enter', detecte_le: iso(paris(8, 28)), recu_le: iso(paris(8, 29)),
    })])
    expect(liens()).toEqual([expect.objectContaining({ pointage_id: lignesDePaul()[0].id, appareil_id: APPAREIL, date: '2026-11-16' })])
    expect(telephone()).toMatchObject({ traite_jusqu_au: null, vu_le: iso(paris(8, 29)) })
  })

  it('départ : pointage refermé à l’heure de la sortie vue par le téléphone', async () => {
    await entree(C_VILLA, paris(8, 30))
    expect((await sortie(C_VILLA, paris(12, 30))).json).toEqual({ statut: 'enregistre' })
    expect(resume()).toEqual([[C_VILLA, '08:30:00', '12:30:00', 4]])
  })

  it('fuseau du téléphone enregistré à Lisbonne : heure murale de Lisbonne', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ fuseau: 'Europe/Lisbon' })]
    await entree(C_VILLA, paris(8, 30))
    expect(lignesDePaul()[0]).toMatchObject({ heure_arrivee: '07:30:00' })
  })

  it('même envoi reçu deux fois : « doublon », rien de plus', async () => {
    await entree(C_VILLA, paris(8, 30))
    expect((await entree(C_VILLA, paris(8, 30), paris(9))).json).toEqual({ statut: 'doublon' })
    expect(journal()).toHaveLength(1)
    expect(lignesDePaul()).toHaveLength(1)
  })

  it('passage de moins de 3 min : le pointage ouvert à l’arrivée est retiré', async () => {
    await entree(C_VILLA, paris(8, 30))
    expect(lignesDePaul()).toHaveLength(1)
    await sortie(C_VILLA, paris(8, 32))
    expect(lignesDePaul()).toEqual([])
    expect(liens()).toEqual([])
  })

  it('arrivée reçue plus de 15 min après sa détection : note pour le gérant ; 15 min tout juste : aucune', async () => {
    await entree(C_VILLA, paris(8), paris(8, 40))
    expect(lignesDePaul()[0].notes).toBe('Arrivée reçue 40 min après sa détection par le téléphone (envoi retardé) : à vérifier.')
    await initialiser()
    await entree(C_VILLA, paris(8), paris(8, 15))
    expect(lignesDePaul()[0].notes).toBeNull()
  })

  it('chantier affecté par l’équipe : pointé aussi', async () => {
    await entree(C_IMMEUBLE, paris(8, 30))
    expect(resume()).toEqual([[C_IMMEUBLE, '08:30:00', null, null]])
  })
})

describe('journée livrée d’un bloc, dans n’importe quel ordre (file Android)', () => {
  it('pause déjeuner : 08:00-12:00 et 12:30-17:00 dans chacun des 24 ordres', async () => {
    expect(await dansTousLesOrdres([
      [C_VILLA, 'enter', paris(8)], [C_VILLA, 'exit', paris(12)], [C_VILLA, 'enter', paris(12, 30)], [C_VILLA, 'exit', paris(17)],
    ], paris(17, 5))).toEqual([[C_VILLA, '08:00:00', '12:00:00', 4], [C_VILLA, '12:30:00', '17:00:00', 4.5]])
  })

  it('changement de chantier : la villa le matin, l’immeuble l’après-midi', async () => {
    expect(await dansTousLesOrdres([
      [C_VILLA, 'enter', paris(8)], [C_VILLA, 'exit', paris(12)], [C_IMMEUBLE, 'enter', paris(12, 30)], [C_IMMEUBLE, 'exit', paris(17)],
    ], paris(17, 5))).toEqual([[C_VILLA, '08:00:00', '12:00:00', 4], [C_IMMEUBLE, '12:30:00', '17:00:00', 4.5]])
  })

  it('chantiers voisins : l’immeuble prend le relais à la sortie de la villa, aucune heure comptée deux fois', async () => {
    expect(await dansTousLesOrdres([
      [C_VILLA, 'enter', paris(8)], [C_IMMEUBLE, 'enter', paris(10)], [C_VILLA, 'exit', paris(12)], [C_IMMEUBLE, 'exit', paris(17)],
    ], paris(17, 5))).toEqual([[C_VILLA, '08:00:00', '12:00:00', 4], [C_IMMEUBLE, '12:00:00', '17:00:00', 5]])
  })

  it('deux zones franchies à la même heure (même position) : rien de perdu, une seule compte', async () => {
    expect(await dansTousLesOrdres([
      [C_VILLA, 'enter', paris(8)], [C_IMMEUBLE, 'enter', paris(8)], [C_VILLA, 'exit', paris(17)], [C_IMMEUBLE, 'exit', paris(17)],
    ], paris(17, 5))).toEqual([[C_VILLA, '08:00:00', '17:00:00', 9]])
  })

  it('reçue en direct puis rejouée : la sortie de midi arrivée après le retour corrige le pointage', async () => {
    await entree(C_VILLA, paris(8))
    await entree(C_VILLA, paris(12, 30), paris(12, 31))
    expect(resume()).toEqual([[C_VILLA, '08:00:00', null, null]])
    await sortie(C_VILLA, paris(12), paris(12, 35))
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '12:00:00', 4], [C_VILLA, '12:30:00', null, null]])
  })
})

const aLaMain = (debut: string, fin: string | null, heures: number | null): Ligne => ({
    id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-16',
    heure_arrivee: debut, heure_depart: fin, heures_travaillees: heures, pause_minutes: 0, mode: 'manuel',
    created_at: iso(paris(Number(debut.slice(0, 2)), Number(debut.slice(3, 5)))),
})

describe('pointages qui ne viennent pas du téléphone : ils priment', () => {

  it('pointage à la main le matin, téléphone l’après-midi : seul l’après-midi vient du téléphone', async () => {
    etat.tables.pointages_btp.push(aLaMain('08:00:00', '12:10:00', 4.17))
    for (const [chantier, sens, detecte] of [
      [C_VILLA, 'enter', paris(7, 58)], [C_VILLA, 'exit', paris(12)], [C_VILLA, 'enter', paris(13)], [C_VILLA, 'exit', paris(17)],
    ] as Envoi[]) await envoi(chantier, sens, detecte, paris(17, 5))
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '12:10:00', 4.17], [C_VILLA, '13:00:00', '17:00:00', 4]])
  })

  it('fin à la main sur place, puis zones reposées par le système : pas de nouveau pointage', async () => {
    await entree(C_VILLA, paris(8))
    // L'employé termine son pointage à la main à 17:00, toujours sur le chantier (écrit par la route principale).
    Object.assign(lignesDePaul()[0], { heure_depart: '17:00:00', heures_travaillees: 9 })
    expect((await entree(C_VILLA, paris(17, 5), paris(17, 6))).json).toEqual({ statut: 'enregistre' })
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '17:00:00', 9]])
    // Il n'appartient plus au téléphone : sa sortie ne le change pas.
    expect(liens()).toEqual([])
    await sortie(C_VILLA, paris(17, 10), paris(17, 11))
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '17:00:00', 9]])
  })

  it('pointage du téléphone corrigé par le gérant : jamais réécrit ensuite', async () => {
    await entree(C_VILLA, paris(8))
    await sortie(C_VILLA, paris(12), paris(12, 1))
    Object.assign(lignesDePaul()[0], { heure_depart: '11:30:00', heures_travaillees: 3.5, notes: 'Corrigé' })
    await entree(C_VILLA, paris(8), paris(13))
    await sortie(C_VILLA, paris(12, 30), paris(13, 1))
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '11:30:00', 3.5]])
  })

  it('pointage modifié par l’employé pendant le rejeu : jamais écrasé, il n’appartient plus au téléphone', async () => {
    await entree(C_VILLA, paris(8))
    // Entre la lecture du pointage et son écriture, l'employé le termine à la main (route principale).
    etat.avantMiseAJour = table => {
      if (table !== 'pointages_btp') return false
      Object.assign(lignesDePaul()[0], { heure_depart: '11:00:00', heures_travaillees: 3 })
      return true
    }
    await sortie(C_VILLA, paris(12), paris(12, 1))
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '11:00:00', 3]])
    // Au rejeu suivant, il n'est plus au téléphone et n'est toujours pas réécrit.
    await entree(C_IMMEUBLE, paris(13), paris(13, 1))
    expect(liens().map(l => l.pointage_id)).not.toContain(lignesDePaul()[0].id)
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '11:00:00', 3], [C_IMMEUBLE, '13:00:00', null, null]])
  })

  it('pointage du téléphone supprimé par le gérant : la suppression prime, il n’est jamais recréé', async () => {
    await entree(C_VILLA, paris(8))
    await sortie(C_VILLA, paris(12), paris(12, 1))
    etat.tables.pointages_btp = etat.tables.pointages_btp.filter(p => !(p.membre_id === M_PAUL && p.date === '2026-11-16'))
    await entree(C_IMMEUBLE, paris(13), paris(13, 1))
    await sortie(C_VILLA, paris(12), paris(13, 2))
    expect(resume()).toEqual([[C_IMMEUBLE, '13:00:00', null, null]])
  })

  it('pointage automatique ouvert avant l’activation et confié au téléphone : refermé à sa sortie', async () => {
    // État laissé par l'enregistrement (route principale) : lien sur le pointage de la page ouverte, arrivée au journal.
    const ouvert: Ligne = {
      ...aLaMain('07:50:00', null, null), mode: 'geo_auto', notes: null, created_at: iso(paris(7, 50)),
    }
    etat.tables.pointages_btp.push(ouvert)
    etat.tables.pointage_lignes_appareil_btp = [{
      pointage_id: ouvert.id, appareil_id: APPAREIL, date: '2026-11-16',
      ecrit: { chantier_id: C_VILLA, date: '2026-11-16', heure_arrivee: '07:50:00', heure_depart: null, heures_travaillees: null, notes: null, created_at: iso(paris(7, 50)) },
    }]
    etat.tables.pointage_evenements_btp = [{
      id: randomUUID(), appareil_id: APPAREIL, chantier_id: C_VILLA, chantier_nom: 'Villa', sens: 'enter',
      detecte_le: iso(paris(7, 50)), recu_le: iso(paris(7, 50)),
    }]
    // Zones posées sur place : le système renvoie une arrivée (déjà dedans), puis la sortie du soir.
    await entree(C_VILLA, paris(8), paris(8, 1))
    await sortie(C_VILLA, paris(17), paris(17, 1))
    expect(resume()).toEqual([[C_VILLA, '07:50:00', '17:00:00', 9.17]])
    expect(lignesDePaul()[0].id).toBe(ouvert.id)
  })

  it('pointage commencé à la main en cours : le téléphone n’ouvre rien par-dessus', async () => {
    etat.tables.pointages_btp.push({ ...aLaMain('07:00:00', null, null), chantier_id: C_IMMEUBLE })
    await entree(C_VILLA, paris(8, 30))
    expect(lignesDePaul().map(p => p.chantier_id)).toEqual([C_IMMEUBLE])
  })

  it('pointage ouvert à la main pendant le traitement (index « un ouvert par employé ») : rien d’écrit, rien de cassé', async () => {
    etat.courseAvantInsertion = { ...aLaMain('08:29:00', null, null), chantier_id: C_IMMEUBLE }
    expect((await entree(C_VILLA, paris(8, 30))).json).toEqual({ statut: 'enregistre' })
    expect(lignesDePaul().map(p => p.chantier_id)).toEqual([C_IMMEUBLE])
    expect(liens()).toEqual([])
  })
})

describe('réécriture des pointages du téléphone', () => {
  it('passage plus ancien livré tard : les pointages déjà justes gardent leur identifiant', async () => {
    await entree(C_VILLA, paris(8))
    await sortie(C_VILLA, paris(12), paris(12, 1))
    await entree(C_VILLA, paris(13), paris(13, 1))
    await sortie(C_VILLA, paris(17), paris(17, 1))
    const avant = lignesDePaul().map(p => p.id)
    // Sortie reçue d’abord (sans effet seule), puis son arrivée : la journée gagne un pointage en tête.
    await sortie(C_IMMEUBLE, paris(7), paris(17, 30))
    await entree(C_IMMEUBLE, paris(6), paris(17, 31))
    expect(resume()).toEqual([
      [C_IMMEUBLE, '06:00:00', '07:00:00', 1], [C_VILLA, '08:00:00', '12:00:00', 4], [C_VILLA, '13:00:00', '17:00:00', 4],
    ])
    expect(lignesDePaul().slice(1).map(p => p.id)).toEqual(avant)
  })

  it('relais d’un chantier voisin : pas de note d’arrivée tardive (l’heure vient de la sortie du premier)', async () => {
    await entree(C_VILLA, paris(8))
    await entree(C_IMMEUBLE, paris(10), paris(11))
    await sortie(C_VILLA, paris(12), paris(12, 1))
    expect(lignesDePaul().find(p => p.chantier_id === C_IMMEUBLE)).toMatchObject({ heure_arrivee: '12:00:00', notes: null })
  })

  it('pointage ajouté par le gérant (heure de création quelconque) : lu à l’heure murale du fuseau du téléphone', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ fuseau: 'Europe/Lisbon' })]
    etat.tables.pointages_btp.push({
      ...aLaMain('10:00:00', '11:00:00', 1), created_at: '2026-11-16T15:00:00.000Z',
    })
    // Lisbonne : UTC+0 en novembre.
    await entree(C_IMMEUBLE, Date.UTC(2026, 10, 16, 9, 0), Date.UTC(2026, 10, 16, 12, 1))
    await sortie(C_IMMEUBLE, Date.UTC(2026, 10, 16, 12, 0), Date.UTC(2026, 10, 16, 12, 2))
    expect(resume().filter(p => p[0] === C_IMMEUBLE)).toEqual([
      [C_IMMEUBLE, '09:00:00', '10:00:00', 1], [C_IMMEUBLE, '11:00:00', '12:00:00', 1],
    ])
  })
})

describe('veille rejouée, écritures en échec', () => {
  it('écriture de pointage en échec : envoi gardé (200), refaite au rejeu suivant', async () => {
    await entree(C_VILLA, paris(8))
    etat.avantMiseAJour = table => {
      if (table === 'pointages_btp') throw new Error('panne d’écriture')
      return false
    }
    expect((await sortie(C_VILLA, paris(12), paris(12, 1))).json).toEqual({ statut: 'enregistre' })
    expect(resume()).toEqual([[C_VILLA, '08:00:00', null, null]])
    etat.avantMiseAJour = null
    await entree(C_IMMEUBLE, paris(13), paris(13, 1))
    expect(resume()).toEqual([[C_VILLA, '08:00:00', '12:00:00', 4], [C_IMMEUBLE, '13:00:00', null, null]])
  })

  it('veille rejouée au premier envoi du jour : sa sortie déjà au journal referme son pointage resté ouvert', async () => {
    await entree(C_VILLA, paris(13, 0, 15), paris(13, 1, 15))
    // La sortie de la veille est arrivée mais son écriture a échoué : le pointage est resté ouvert.
    etat.avantMiseAJour = table => {
      if (table === 'pointages_btp') throw new Error('panne d’écriture')
      return false
    }
    await sortie(C_VILLA, paris(20, 0, 15), paris(20, 1, 15))
    etat.avantMiseAJour = null
    expect(resume('2026-11-15')).toEqual([[C_VILLA, '13:00:00', null, null]])
    await entree(C_IMMEUBLE, paris(8), paris(8, 1))
    expect(resume('2026-11-15')).toEqual([[C_VILLA, '13:00:00', '20:00:00', 7]])
    expect(resume()).toEqual([[C_IMMEUBLE, '08:00:00', null, null]])
  })
})

describe('journées finies', () => {
  it('sortie de la veille livrée le lendemain matin : referme le pointage de la veille à sa vraie heure', async () => {
    await entree(C_VILLA, paris(13, 0, 15), paris(13, 1, 15))
    await sortie(C_VILLA, paris(20, 0, 15), paris(7, 0, 16))
    expect(resume('2026-11-15')).toEqual([[C_VILLA, '13:00:00', '20:00:00', 7]])
  })

  it('arrivée de la veille livrée ce matin sans sortie : refermée sans heures, à régulariser', async () => {
    await entree(C_VILLA, paris(22, 0, 15), paris(7, 0, 16))
    expect(lignesDePaul('2026-11-15')).toEqual([expect.objectContaining({
      heure_arrivee: '22:00:00', heure_depart: '22:00:00', heures_travaillees: 0, notes: expect.stringContaining(NOTE_A_REGULARISER),
    })])
  })

  it('pointage de la veille resté ouvert : refermé à régulariser avant d’ouvrir celui du jour', async () => {
    await entree(C_VILLA, paris(18, 0, 15), paris(18, 1, 15))
    await entree(C_VILLA, paris(8), paris(8, 1))
    expect(lignesDePaul('2026-11-15')[0]).toMatchObject({ heure_depart: '18:00:00', heures_travaillees: 0, notes: NOTE_A_REGULARISER })
    expect(resume()).toEqual([[C_VILLA, '08:00:00', null, null]])
  })
})

describe('envois ignorés, réponses', () => {
  it('arrivée sur un chantier non affecté, terminé, d’une autre société ou sans position : ignorée, pas au journal', async () => {
    const motifs = [[C_JEAN, 'chantier_non_affecte'], [C_FINI, 'chantier_non_affecte'], [C_SOC_B, 'chantier_non_affecte'], [C_GARAGE, 'chantier_sans_position']]
    for (const [i, [chantier, motif]] of motifs.entries()) {
      expect((await entree(chantier, paris(8, i))).json).toEqual({ statut: motif })
    }
    expect(journal()).toEqual([])
    expect(lignesDePaul()).toEqual([])
  })

  it('sortie : toujours gardée au journal (elle ne compte que si son arrivée y est)', async () => {
    expect((await sortie(C_JEAN, paris(8))).json).toEqual({ statut: 'enregistre' })
    expect(journal()).toHaveLength(1)
    expect(lignesDePaul()).toEqual([])
  })

  it('pointage automatique coupé par le gérant : ignoré, pas au journal, téléphone retiré', async () => {
    etat.tables.pointage_reglages_btp = [{ owner_id: SOC_A, auto_active: false }]
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'pointage_auto_desactive' })
    expect(journal()).toEqual([])
    expect(telephone().retire_le).toBe(iso(paris(8, 1)))
  })

  it('réglage illisible (panne passagère) : 500, le téléphone réessaiera ; rien de décidé', async () => {
    etat.tablesAbsentes = new Set(['pointage_reglages_btp'])
    // Table absente : réglage connu (mode coupé) ; une autre erreur, elle, n'est pas une réponse.
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'pointage_auto_desactive' })
    etat.tables.pointage_appareils_btp = [await appareil()]
    const lire = vi.spyOn(await import('@/lib/btp/pointage-serveur'), 'lireDonneesSociete')
    lire.mockImplementationOnce(async () => ({
      societeId: SOC_A, membres: [], chantiersEnCours: [], equipes: [], pointageAutoActive: false, reglageDisponible: true, reglageLu: false,
    }))
    expect((await entree(C_VILLA, paris(8, 1))).status).toBe(500)
    lire.mockRestore()
    expect(journal()).toEqual([])
    expect(telephone().traite_jusqu_au).toBeNull()
  })

  it('jeton absent, inconnu ou retiré : 200 « ignoré » (la file du téléphone se vide), rien d’écrit', async () => {
    expect(await recevoir({ identifier: C_VILLA, transition: 'enter' }, null)).toEqual({ status: 200, json: { statut: 'jeton_absent' } })
    expect((await recevoir({ identifier: C_VILLA, transition: 'enter' }, nouveauJeton())).json).toEqual({ statut: 'appareil_inconnu' })
    etat.tables.pointage_appareils_btp = [await appareil({ retire_le: '2026-11-16T07:00:00Z' })]
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'appareil_inconnu' })
    expect(etat.ecritures).toEqual([])
  })

  it('limite par adresse avant toute lecture du téléphone (jetons inventés en masse) : 429', async () => {
    vi.mocked(checkRateLimit).mockImplementationOnce(async (cle: string) => !cle.startsWith('btp_pointage_evenement_ip_'))
    expect((await entree(C_VILLA, paris(8))).status).toBe(429)
    expect(etat.ecritures).toEqual([])
  })

  it('corps illisible ou incomplet : 200 « ignoré » ; démesuré ou annoncé démesuré : 413', async () => {
    expect(await recevoir('pas du json')).toEqual({ status: 200, json: { statut: 'corps_invalide' } })
    expect((await recevoir({ identifier: 'bureau', transition: 'enter' })).json).toEqual({ statut: 'corps_invalide' })
    expect((await recevoir({ identifier: C_VILLA, transition: 'enter', payload: 'x'.repeat(5000) })).status).toBe(413)
    expect((await recevoir({ identifier: C_VILLA, transition: 'enter' }, JETON, { 'Content-Length': '999999' })).status).toBe(413)
    expect(journal()).toEqual([])
  })

  it('compte sorti de la société : téléphone retiré, rien d’enregistré', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ user_id: U_INACTIF, membre_id: M_JEAN })]
    expect((await entree(C_JEAN, paris(8))).json).toEqual({ statut: 'compte_inactif' })
    expect(telephone().retire_le).toBe(iso(paris(8, 1)))
    expect(journal()).toEqual([])
  })

  it('fiche passée à une autre adresse e-mail (plus celle de ce compte) : téléphone retiré, rien d’enregistré', async () => {
    etat.tables.membres_btp = etat.tables.membres_btp.map(m => (m.id === M_PAUL ? { ...m, email: 'autre@a.example' } : m))
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'fiche_changee' })
    expect(telephone().retire_le).toBe(iso(paris(8, 1)))
    expect(journal()).toEqual([])
  })

  it('fiche employé inactive ou supprimée : ignoré, téléphone retiré', async () => {
    etat.tables.membres_btp = etat.tables.membres_btp.map(m => (m.id === M_PAUL ? { ...m, actif: false } : m))
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'fiche_absente' })
    expect(telephone().retire_le).toBe(iso(paris(8, 1)))
    await initialiser()
    etat.tables.membres_btp = etat.tables.membres_btp.filter(m => m.id !== M_PAUL)
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'fiche_absente' })
    expect(telephone().retire_le).toBe(iso(paris(8, 1)))
  })

  it('le gérant lui-même peut pointer depuis son téléphone', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ user_id: SOC_A })]
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'enregistre' })
  })

  it('heure de détection de plus de 12 h : ignoré ; future (horloge en avance) : heure de réception', async () => {
    expect((await entree(C_VILLA, paris(8) - 13 * 3_600_000, paris(8))).json).toEqual({ statut: 'horodatage_refuse' })
    expect((await entree(C_VILLA, paris(9, 30), paris(8, 30))).json).toEqual({ statut: 'enregistre' })
    expect(lignesDePaul()[0]).toMatchObject({ heure_arrivee: '08:30:00', created_at: iso(paris(8, 30)) })
  })

  it('table des téléphones absente (migration 20261117 non appliquée) : ignoré', async () => {
    etat.tablesAbsentes = new Set(['pointage_appareils_btp'])
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'appareil_inconnu' })
  })

  it('un autre envoi du même téléphone en cours : 429, le téléphone réessaiera ; main expirée : reprise', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ traite_jusqu_au: iso(paris(8, 1) + 10_000) })]
    expect(await entree(C_VILLA, paris(8))).toEqual({ status: 429, json: { statut: 'occupe' } })
    expect(journal()).toEqual([])
    etat.tables.pointage_appareils_btp = [await appareil({ traite_jusqu_au: iso(paris(8, 1) - 1) })]
    expect((await entree(C_VILLA, paris(8))).json).toEqual({ statut: 'enregistre' })
    expect(telephone().traite_jusqu_au).toBeNull()
  })

  it('main prise par un autre envoi entre la lecture et la prise : 429, rien d’appliqué', async () => {
    etat.tables.pointage_appareils_btp = [await appareil({ traite_jusqu_au: iso(paris(8) - 1) })]
    etat.avantMiseAJour = table => {
      if (table !== 'pointage_appareils_btp') return false
      telephone().traite_jusqu_au = iso(paris(8, 1) + 15_000)
      return true
    }
    expect(await entree(C_VILLA, paris(8))).toEqual({ status: 429, json: { statut: 'occupe' } })
    expect(journal()).toEqual([])
  })

  it('panne de la base : 500 pour que le téléphone réessaie ; main rendue', async () => {
    etat.tablesAbsentes = new Set(['membres_btp'])
    expect((await entree(C_VILLA, paris(8))).status).toBe(500)
    expect(telephone().traite_jusqu_au).toBeNull()
  })
})
