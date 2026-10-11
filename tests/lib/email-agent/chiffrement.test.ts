// @vitest-environment node
// Chiffrement AES-GCM des identifiants IMAP (lib/email-agent/chiffrement.ts), clé dérivée du
// secret existant OAUTH_TOKENS_ENCRYPTION_KEY.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  chiffrerIdentifiantsImap,
  chiffrerTexte,
  cleChiffrementManquante,
  dechiffrerIdentifiantsImap,
  dechiffrerTexte,
  estTexteChiffre,
} from '@/lib/email-agent/chiffrement'

const CLE = 'cle-de-test-de-32-caracteres-min!!'
const CLE_INITIALE = process.env.OAUTH_TOKENS_ENCRYPTION_KEY
const IDENTIFIANTS = { hote: 'mail.infomaniak.com', port: 993, utilisateur: 'h.carvalho@cabinet.fr', motDePasse: 'abcd efgh ijkl mnop' }

beforeEach(() => {
  process.env.OAUTH_TOKENS_ENCRYPTION_KEY = CLE
})

afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  else process.env.OAUTH_TOKENS_ENCRYPTION_KEY = CLE_INITIALE
})

describe('chiffrement des identifiants IMAP', () => {
  it('aller-retour, sans le mot de passe en clair dans la valeur rangée', async () => {
    const chiffre = await chiffrerIdentifiantsImap(IDENTIFIANTS)
    expect(estTexteChiffre(chiffre)).toBe(true)
    expect(chiffre).toMatch(/^imapv1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/)
    expect(chiffre).not.toContain('abcd')
    expect(chiffre).not.toContain('infomaniak')
    expect(await dechiffrerIdentifiantsImap(chiffre)).toEqual(IDENTIFIANTS)
  })

  it('IV aléatoire : deux chiffrements du même texte diffèrent', async () => {
    const a = await chiffrerTexte('secret')
    const b = await chiffrerTexte('secret')
    expect(a).not.toBe(b)
    expect(await dechiffrerTexte(a)).toBe('secret')
    expect(await dechiffrerTexte(b)).toBe('secret')
  })

  it('valeur altérée ou autre clé → échec du déchiffrement (GCM authentifié)', async () => {
    const chiffre = await chiffrerTexte('mot de passe')
    const [p, iv, ct] = chiffre.split('.')
    const altere = `${p}.${iv}.${ct.slice(0, -2)}${ct.endsWith('A') ? 'BB' : 'AA'}`
    await expect(dechiffrerTexte(altere)).rejects.toThrow()

    process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'une-autre-cle-de-32-caracteres-min!!'
    await expect(dechiffrerTexte(chiffre)).rejects.toThrow()
  })

  it('format inconnu (ancien jeton OAuth en clair) → erreur explicite', async () => {
    await expect(dechiffrerTexte('ya29.a0AfH6SM')).rejects.toThrow('Format de secret chiffré inconnu')
    expect(estTexteChiffre('ya29.a0AfH6SM')).toBe(false)
    expect(estTexteChiffre(null)).toBe(false)
  })

  it('clé absente ou trop courte : signalée, et le chiffrement refuse', async () => {
    expect(cleChiffrementManquante()).toBe(false)
    process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'courte'
    expect(cleChiffrementManquante()).toBe(true)
    await expect(chiffrerTexte('x')).rejects.toThrow(/OAUTH_TOKENS_ENCRYPTION_KEY/)
    delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
    expect(cleChiffrementManquante()).toBe(true)
    await expect(chiffrerTexte('x')).rejects.toThrow(/OAUTH_TOKENS_ENCRYPTION_KEY/)
  })
})
