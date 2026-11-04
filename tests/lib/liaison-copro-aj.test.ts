// lib/liaison-copro-aj — échanges du navigateur entre le portail copropriétaire (vue super admin) et
// l'Administrateur judiciaire : stockage, actions des deux côtés, abonnement, vues de l'AJ (doléances, cloche).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLE_LIAISON_COPRO_AJ, abonnerLiaison, ajouterMessage, analyserLiaison, changerStatutDemande, deposerDemande, effacerLiaison,
  enregistrerVote, lireLiaison, marquerDemandeVue, marquerNotificationLiaisonVue, marquerVuParAj, publierAvis,
  type SaisieDemandeLiaison,
} from '@/lib/liaison-copro-aj/stockage'
import { doleanceDepuisDemande, lienPortailCoproprietaire, notificationsLiaison, objetDemande } from '@/lib/liaison-copro-aj/vues-aj'
import { maintenantLiaison } from '@/lib/liaison-copro-aj/horloge'

const SAISIE: SaisieDemandeLiaison = {
  codeCopro: 'LM', nomCopro: 'Résidence Le Méridien', coproprietaireId: 'P1', nomCoproprietaire: 'Laurent Mercier', lot: 'Lot 12 — Apt B3',
  type: 'Plomberie', description: 'Fuite sous l’évier de la cuisine', priorite: 'urgente', partieCommune: false, zone: '',
}
const T0 = new Date('2026-06-04T08:00:00.000Z')
const T1 = new Date('2026-06-04T09:00:00.000Z')

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('stockage de la liaison', () => {
  it('état vide sans contenu, contenu illisible ignoré, lignes mal formées écartées', () => {
    expect(lireLiaison()).toEqual({ version: 1, demandes: [], votes: [], avis: [] })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(analyserLiaison('{pas du json')).toEqual({ version: 1, demandes: [], votes: [], avis: [] })
    expect(analyserLiaison(JSON.stringify({ demandes: [{ id: 3 }], votes: 'x', avis: [{ id: 'a', codeCopro: 'LM', titre: 'T' }] })).avis).toHaveLength(1)
  })

  it('demande du portail : enregistrée « reçue », non vue par l’AJ, numéro lisible par le portail (sig-…)', () => {
    const demande = deposerDemande(SAISIE, T0)
    expect(demande).toMatchObject({ statut: 'en_attente', vueParAj: false, creeLe: T0.toISOString(), messages: [] })
    expect(demande.id).toMatch(/^sig-/)
    expect(lireLiaison().demandes).toEqual([demande])
  })

  it('message du copropriétaire : la demande redevient non vue ; réponse du cabinet : vue', () => {
    const { id } = deposerDemande(SAISIE, T0)
    marquerDemandeVue(id)
    expect(lireLiaison().demandes[0].vueParAj).toBe(true)
    ajouterMessage(id, { auteur: 'coproprietaire', nom: 'Laurent Mercier', texte: 'Ça coule encore' }, T1)
    expect(lireLiaison().demandes[0]).toMatchObject({ vueParAj: false, misAJourLe: T1.toISOString() })
    ajouterMessage(id, { auteur: 'administrateur', nom: 'Cabinet Delaunay', texte: 'Plombier demain 9 h' }, T1)
    expect(lireLiaison().demandes[0].vueParAj).toBe(true)
    expect(lireLiaison().demandes[0].messages.map((m) => m.auteur)).toEqual(['coproprietaire', 'administrateur'])
    expect(ajouterMessage('inconnue', { auteur: 'coproprietaire', nom: 'X', texte: 'Y' })).toBeNull()
  })

  it('statut changé par l’AJ', () => {
    const { id } = deposerDemande(SAISIE, T0)
    changerStatutDemande(id, 'en_cours', T1)
    expect(lireLiaison().demandes[0]).toMatchObject({ statut: 'en_cours', misAJourLe: T1.toISOString() })
  })

  it('vote par correspondance : un seul par résolution et par copropriétaire, le dernier l’emporte', () => {
    const vote = { agId: 'ag-lm-2026-2', resolutionNumero: 2, codeCopro: 'LM', coproprietaireId: 'P1', nomCoproprietaire: 'Laurent Mercier' }
    enregistrerVote({ ...vote, choix: 'pour' }, T0)
    enregistrerVote({ ...vote, choix: 'contre' }, T1)
    enregistrerVote({ ...vote, resolutionNumero: 1, choix: 'abstention' }, T1)
    const votes = lireLiaison().votes
    expect(votes).toHaveLength(2)
    expect(votes.find((v) => v.resolutionNumero === 2)).toMatchObject({ choix: 'contre', date: T1.toISOString(), vueParAj: false })
  })

  it('avis publié par l’AJ', () => {
    publierAvis({ codeCopro: 'LM', nomCopro: 'Résidence Le Méridien', categorie: 'Travaux', importance: 'Importante', titre: 'Coupure d’eau', contenu: 'Mardi' }, T0)
    expect(lireLiaison().avis[0]).toMatchObject({ titre: 'Coupure d’eau', date: T0.toISOString() })
    expect(lireLiaison().avis[0].id).toMatch(/^aj-avis-/)
  })

  it('effacer remet la liaison à vide', () => {
    deposerDemande(SAISIE, T0)
    effacerLiaison()
    expect(lireLiaison().demandes).toEqual([])
  })

  it('abonnement : prévenu dans cet onglet (événement dédié) et depuis un autre onglet (storage)', () => {
    const rappel = vi.fn()
    const desabonner = abonnerLiaison(rappel)
    deposerDemande(SAISIE, T0)
    expect(rappel).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new StorageEvent('storage', { key: CLE_LIAISON_COPRO_AJ }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'autre-cle' }))
    expect(rappel).toHaveBeenCalledTimes(2)
    desabonner()
    deposerDemande(SAISIE, T1)
    expect(rappel).toHaveBeenCalledTimes(2)
  })
})

describe('vues de l’AJ', () => {
  it('doléance tirée d’une demande : objet, copropriété, priorité, statut, date « JJ/MM »', () => {
    const demande = deposerDemande(SAISIE, new Date(2026, 5, 4, 10, 15))
    expect(doleanceDepuisDemande(demande)).toEqual(['Plomberie — Lot 12 — Apt B3', 'Résidence Le Méridien', 'Urgente', 'rust', 'Ouverte', 'Fuite sous l’évier de la cuisine', '04/06'])
    expect(objetDemande({ ...demande, partieCommune: true, zone: 'Hall' })).toBe('Plomberie — parties communes (Hall)')
    changerStatutDemande(demande.id, 'terminee')
    expect(doleanceDepuisDemande(lireLiaison().demandes[0])[4]).toBe('Résolue')
  })

  it('cloche : demande puis message du copropriétaire, vote ; lues une fois vues, identifiant renouvelé à chaque échange', () => {
    const { id } = deposerDemande(SAISIE, T0)
    enregistrerVote({ agId: 'ag-lm-2026-2', resolutionNumero: 2, codeCopro: 'LM', coproprietaireId: 'P1', nomCoproprietaire: 'Laurent Mercier', choix: 'pour' }, T1)
    const avant = notificationsLiaison(lireLiaison())
    expect(avant.map((n) => [n.route, n.lue])).toEqual([['copros', false], ['doleances', false]])
    expect(avant[1].title).toBe('Nouvelle demande du portail : Plomberie')

    marquerNotificationLiaisonVue(avant[1].id)
    marquerNotificationLiaisonVue(avant[0].id)
    expect(notificationsLiaison(lireLiaison()).every((n) => n.lue)).toBe(true)

    ajouterMessage(id, { auteur: 'coproprietaire', nom: 'Laurent Mercier', texte: 'Toujours là' }, new Date('2026-06-04T11:00:00.000Z'))
    const apres = notificationsLiaison(lireLiaison()).find((n) => n.route === 'doleances')
    expect(apres).toMatchObject({ lue: false, title: 'Message de Laurent Mercier (portail)' })
    expect(apres?.id).not.toBe(avant[1].id)

    marquerVuParAj()
    expect(notificationsLiaison(lireLiaison()).every((n) => n.lue)).toBe(true)
  })

  it('lien vers le portail relié', () => {
    expect(lienPortailCoproprietaire('LM', 'P1')).toBe('/coproprietaire/dashboard?aj=LM&personne=P1')
  })

  it('horloge : jour figé de la démonstration de l’AJ à l’heure du navigateur, maintenant en mode réel', () => {
    const horloge = new Date(2026, 10, 4, 15, 42, 7)
    const demo = maintenantLiaison('demo', horloge)
    expect([demo.getFullYear(), demo.getMonth(), demo.getDate(), demo.getHours(), demo.getMinutes()]).toEqual([2026, 5, 4, 15, 42])
    expect(maintenantLiaison('reel', horloge)).toBe(horloge)
  })
})
