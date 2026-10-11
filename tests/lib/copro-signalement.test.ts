// tests/lib/copro-signalement.test.ts
//
// Espace copropriétaire — envoi d'un signalement au syndic et suivi (lib/copro-signalement.ts) :
// corps attendu par la route, jeton de session en Bearer, codes d'erreur (jamais d'exception),
// mémoire de 30 s du suivi (la route limite les recherches par e-mail), libellés des statuts.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PROFILE_DEMO } from '@/lib/copro-demo-data'
import {
  DESCRIPTION_MIN_SIGNALEMENT, chargerMesSignalements, construireSignalement, emailSignalement,
  envoyerSignalementCopro, libelleStatutSignalement, oublierSuiviSignalements, typeSansPictogramme,
} from '@/lib/copro-signalement'

const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

const formulaire = {
  profile: PROFILE_DEMO,
  type: '🔧 Plomberie (fuite, colonne, robinetterie)',
  description: '  Fuite d’eau au plafond de la salle de bain  ',
  priorite: 'urgente' as const,
  partieCommune: false,
  zone: '',
}

describe('construireSignalement', () => {
  it('corps lu par la route : profil, type sans pictogramme, description nettoyée', () => {
    expect(construireSignalement(formulaire)).toEqual({
      description: 'Fuite d’eau au plafond de la salle de bain',
      demandeurNom: 'Géraldine Xavier',
      demandeurRole: 'coproprio',
      demandeurEmail: 'geraldine.xavier@email.com',
      demandeurTelephone: '06 12 34 56 78',
      immeuble: 'Résidence Le Prado',
      batiment: 'D',
      etage: '4',
      numLot: '12',
      typeIntervention: 'Plomberie (fuite, colonne, robinetterie)',
      priorite: 'urgente',
      estPartieCommune: false,
    })
  })

  it('partie commune : zone transmise, immeuble du profil conservé', () => {
    const corps = construireSignalement({ ...formulaire, partieCommune: true, zone: 'Cave / sous-sol' })
    expect(corps.zoneSignalee).toBe('Cave / sous-sol')
    expect(corps.estPartieCommune).toBe(true)
    expect(corps.immeuble).toBe('Résidence Le Prado')
  })

  it('e-mail absent ou invalide et champs vides : omis (la validation refuse une chaîne vide)', () => {
    const corps = construireSignalement({
      ...formulaire,
      profile: { ...PROFILE_DEMO, email: 'pas-un-email', telephone: '', batiment: '' },
    })
    expect(corps).not.toHaveProperty('demandeurEmail')
    expect(corps).not.toHaveProperty('demandeurTelephone')
    expect(corps).not.toHaveProperty('batiment')
    expect(corps).not.toHaveProperty('zoneSignalee')
  })

  it('téléphone tronqué à 20 caractères (limite du schéma)', () => {
    const corps = construireSignalement({ ...formulaire, profile: { ...PROFILE_DEMO, telephone: '+33 6 12 34 56 78 poste 12' } })
    expect(corps.demandeurTelephone).toHaveLength(20)
  })
})

describe('typeSansPictogramme / emailSignalement', () => {
  it('retire seulement un pictogramme de tête', () => {
    expect(typeSansPictogramme('🛗 Ascenseur')).toBe('Ascenseur')
    expect(typeSansPictogramme('Ascenseur en panne')).toBe('Ascenseur en panne')
    expect(typeSansPictogramme('📦')).toBe('📦')
  })

  it('e-mail en minuscules, null si invalide', () => {
    expect(emailSignalement(' Geraldine.Xavier@Email.com ')).toBe('geraldine.xavier@email.com')
    expect(emailSignalement('geraldine@local')).toBeNull()
    expect(emailSignalement(undefined)).toBeNull()
  })
})

describe('envoyerSignalementCopro', () => {
  const corps = construireSignalement(formulaire)

  it('POST avec le jeton de session en Bearer', async () => {
    const fetchMock = vi.fn(async () => reponse({ signalement: { id: 'sig-42' } }))
    const resultat = await envoyerSignalementCopro(corps, 'jeton-copro', fetchMock as unknown as typeof fetch)
    expect(resultat).toEqual({ ok: true, id: 'sig-42' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/coproprietaire/signalement')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jeton-copro')
    expect(JSON.parse(init.body as string)).toEqual(corps)
  })

  it('sans session : appel public, sans en-tête Authorization', async () => {
    const fetchMock = vi.fn(async () => reponse({ signalement: { id: 'sig-1' } }))
    await envoyerSignalementCopro(corps, null, fetchMock as unknown as typeof fetch)
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it.each([
    [400, 'invalide'],
    [429, 'trop_de_demandes'],
    [500, 'serveur'],
  ])('réponse %i : échec « %s », sans exception', async (status, code) => {
    const fetchMock = vi.fn(async () => reponse({ error: 'x' }, status))
    expect(await envoyerSignalementCopro(corps, 'j', fetchMock as unknown as typeof fetch)).toEqual({ ok: false, code })
  })

  it('réseau coupé : échec « reseau »', async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(await envoyerSignalementCopro(corps, 'j', fetchMock as unknown as typeof fetch)).toEqual({ ok: false, code: 'reseau' })
  })
})

describe('chargerMesSignalements', () => {
  beforeEach(() => oublierSuiviSignalements())

  const liste = { signalements: [{ id: 'sig-1', statut: 'acceptee', artisanAssigne: 'Plomberie du Vieux-Port', typeIntervention: 'Plomberie' }] }

  it('GET par e-mail (minuscules), signalements normalisés', async () => {
    const fetchMock = vi.fn(async () => reponse(liste))
    const resultat = await chargerMesSignalements('Geraldine.Xavier@Email.com', { fetchImpl: fetchMock as unknown as typeof fetch })
    expect(fetchMock).toHaveBeenCalledWith('/api/coproprietaire/signalement?email=geraldine.xavier%40email.com')
    expect(resultat).toEqual({ ok: true, signalements: [expect.objectContaining({ id: 'sig-1', statut: 'acceptee', artisanAssigne: 'Plomberie du Vieux-Port', description: '', priorite: 'normale' })] })
  })

  it('mémoire de 30 s : pas de second appel, sauf « forcer » (Actualiser, après un envoi)', async () => {
    const fetchMock = vi.fn(async () => reponse(liste))
    const f = fetchMock as unknown as typeof fetch
    await chargerMesSignalements('a@b.fr', { fetchImpl: f, maintenant: 1_000 })
    await chargerMesSignalements('a@b.fr', { fetchImpl: f, maintenant: 20_000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await chargerMesSignalements('a@b.fr', { fetchImpl: f, maintenant: 21_000, forcer: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await chargerMesSignalements('a@b.fr', { fetchImpl: f, maintenant: 60_000 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('sans e-mail valide : aucun appel', async () => {
    const fetchMock = vi.fn()
    expect(await chargerMesSignalements('', { fetchImpl: fetchMock as unknown as typeof fetch })).toEqual({ ok: false, code: 'email_absent' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('limite de la route atteinte (429) : « trop_de_demandes »', async () => {
    const fetchMock = vi.fn(async () => reponse({ error: 'rate' }, 429))
    expect(await chargerMesSignalements('a@b.fr', { fetchImpl: fetchMock as unknown as typeof fetch })).toEqual({ ok: false, code: 'trop_de_demandes' })
  })
})

describe('libelleStatutSignalement', () => {
  it('libellés du copropriétaire', () => {
    expect(libelleStatutSignalement('en_attente', '')).toBe('Reçu par le syndic')
    expect(libelleStatutSignalement('acceptee', 'Plomberie du Vieux-Port')).toBe('Mission confiée à Plomberie du Vieux-Port')
    expect(libelleStatutSignalement('acceptee', '')).toBe('Mission confiée à un prestataire')
    expect(libelleStatutSignalement('en_cours', 'Plomberie du Vieux-Port')).toBe('Intervention en cours — Plomberie du Vieux-Port')
    expect(libelleStatutSignalement('terminee', 'X')).toBe('Intervention terminée')
    expect(libelleStatutSignalement('annulee', '')).toBe('Annulé par le syndic')
    expect(libelleStatutSignalement('inconnu', '')).toBe('Reçu par le syndic')
  })

  it('portugais', () => {
    expect(libelleStatutSignalement('acceptee', 'Canalizações Lda', 'pt')).toBe('Intervenção confiada a Canalizações Lda')
    expect(libelleStatutSignalement('en_attente', '', 'pt')).toBe('Recebida pelo administrador')
  })

  it('minimum de description partagé avec la route', () => {
    expect(DESCRIPTION_MIN_SIGNALEMENT).toBe(10)
  })
})
