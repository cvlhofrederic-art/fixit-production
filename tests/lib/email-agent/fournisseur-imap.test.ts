// @vitest-environment node
// Fournisseur « Autre messagerie (IMAP) » branché sur l'abstraction des boîtes : ligne
// provider 'imap' reconnue, identifiants déchiffrés pour la relève (fenêtre 30 puis 7
// jours, 20 e-mails), erreurs IMAP converties en ErreurFournisseur, pas d'OAuth.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/email-agent/imap/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email-agent/imap/client')>()),
  releverBoiteImap: vi.fn(async () => []),
}))

import { ErreurImap, releverBoiteImap } from '@/lib/email-agent/imap/client'
import { chiffrerIdentifiantsImap, chiffrerTexte } from '@/lib/email-agent/chiffrement'
import { ErreurFournisseur, FOURNISSEURS, estIdFournisseur, fournisseurDeLigne } from '@/lib/email-agent/fournisseurs'
import { fournisseurImap } from '@/lib/email-agent/fournisseurs/imap'

const CLE_INITIALE = process.env.OAUTH_TOKENS_ENCRYPTION_KEY
const IDENTIFIANTS = { hote: 'imap.mail.me.com', port: 993, utilisateur: 'cabinet@icloud.com', motDePasse: 'xxxx-yyyy-zzzz-wwww' }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'cle-de-test-de-32-caracteres-min!!'
})

afterEach(() => {
  vi.useRealTimers()
  if (CLE_INITIALE === undefined) delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  else process.env.OAUTH_TOKENS_ENCRYPTION_KEY = CLE_INITIALE
})

describe('fournisseur IMAP', () => {
  it('enregistré dans l\'abstraction (provider imap), sans rafraîchissement', () => {
    expect(estIdFournisseur('imap')).toBe(true)
    expect(FOURNISSEURS.imap).toBe(fournisseurImap)
    expect(fournisseurDeLigne('imap')).toBe(fournisseurImap)
    expect(fournisseurImap.sansRafraichissement).toBe(true)
    expect(fournisseurImap.nom).toBe('Autre messagerie (IMAP)')
  })

  it('configuration : clé de chiffrement exigée', () => {
    expect(fournisseurImap.configurationManquante()).toEqual([])
    delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
    expect(fournisseurImap.configurationManquante()).toEqual(['OAUTH_TOKENS_ENCRYPTION_KEY'])
  })

  it('pas d\'OAuth : autorisation, échange et rafraîchissement refusés', async () => {
    expect(() => fournisseurImap.urlAutorisation('u:n')).toThrow(ErreurFournisseur)
    await expect(fournisseurImap.echangerCode('code')).rejects.toBeInstanceOf(ErreurFournisseur)
    await expect(fournisseurImap.rafraichir('')).rejects.toBeInstanceOf(ErreurFournisseur)
  })

  it.each([
    [true, '2026-09-11T12:00:00.000Z'],
    [false, '2026-10-04T12:00:00.000Z'],
  ])('relève (première : %s) : identifiants déchiffrés, fenêtre et plafond communs', async (premiereReleve, depuis) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'))
    const message = { id: 'm1@x.fr', threadId: null, from: 'a@b.fr', subject: 'Objet', bodyText: 'Corps', receivedAt: '2026-10-10T08:00:00.000Z' }
    vi.mocked(releverBoiteImap).mockResolvedValueOnce([message])

    const messages = await fournisseurImap.recupererMessages(await chiffrerIdentifiantsImap(IDENTIFIANTS), { premiereReleve })

    expect(messages).toEqual([message])
    expect(releverBoiteImap).toHaveBeenCalledWith(IDENTIFIANTS, { depuis: new Date(depuis), max: 20, longueurCorps: 1000 })
  })

  it('identifiants refusés (mot de passe changé) → ErreurFournisseur au code IMAP, sans le mot de passe', async () => {
    vi.mocked(releverBoiteImap).mockRejectedValueOnce(new ErreurImap('identifiants_refuses', 'Identifiant ou mot de passe refusé', 'NO [AUTHENTICATIONFAILED]'))
    const err = await fournisseurImap.recupererMessages(await chiffrerIdentifiantsImap(IDENTIFIANTS), { premiereReleve: false }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ErreurFournisseur)
    expect((err as ErreurFournisseur).code).toBe('identifiants_refuses')
    expect((err as ErreurFournisseur).details).toEqual({ hote: 'imap.mail.me.com', detail: 'NO [AUTHENTICATIONFAILED]' })
    expect(JSON.stringify((err as ErreurFournisseur).details)).not.toContain(IDENTIFIANTS.motDePasse)
  })

  it('valeur rangée illisible (autre clé, jeton OAuth) → identifiants_illisibles, aucune connexion', async () => {
    const autreCle = await chiffrerTexte('{"v":1}')
    process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'une-autre-cle-de-32-caracteres-min!!'
    for (const valeur of [autreCle, 'ya29.jeton-google']) {
      const err = await fournisseurImap.recupererMessages(valeur, { premiereReleve: false }).catch((e: unknown) => e)
      expect((err as ErreurFournisseur).code).toBe('identifiants_illisibles')
    }
    expect(releverBoiteImap).not.toHaveBeenCalled()
  })
})
