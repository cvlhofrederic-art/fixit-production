// @vitest-environment node
// tests/lib/equipe-lien-invitation.test.ts
//
// Lien d'invitation d'équipe (pro BTP et syndic) : le jeton du lien est `<jeton de la ligne>.<signature>`.
// La signature, calculée côté serveur, couvre la ligne d'invitation : un jeton lu ou posé dans la base
// ne suffit pas pour accepter.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  jetonDuLien,
  nouvelleInvitation,
  lireJetonDuLien,
  signatureValide,
  compteRattachable,
  sansJetonInvitation,
  type InvitationSignee,
} from '@/lib/equipe/lien-invitation'

const CLE_TEST = 'cle-de-service-de-test'
const invitation: InvitationSignee = {
  id: '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b',
  email: 'claire@exemple.fr',
  invite_token: 'a'.repeat(48),
  equipe_id: '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d',
}

let cleAvant: string | undefined
beforeEach(() => {
  cleAvant = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = CLE_TEST
})
afterEach(() => {
  if (cleAvant === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = cleAvant
})

async function signatureDe(jeton: string): Promise<string> {
  const lu = lireJetonDuLien(jeton)
  if (!lu) throw new Error('jeton illisible')
  return lu.signature
}

describe('jetonDuLien / lireJetonDuLien', () => {
  it('produit `<jeton de la ligne>.<signature hex 64>`', async () => {
    const jeton = await jetonDuLien('pro', invitation)
    expect(jeton).toMatch(/^[a-f0-9]{48}\.[a-f0-9]{64}$/)
    expect(jeton.startsWith(`${invitation.invite_token}.`)).toBe(true)
    expect(lireJetonDuLien(jeton)).toEqual({ jeton: invitation.invite_token, signature: jeton.slice(49) })
  })

  it('refuse un jeton sans signature, mal formé ou vide', () => {
    expect(lireJetonDuLien('a'.repeat(48))).toBeNull()
    expect(lireJetonDuLien(`${'a'.repeat(48)}.`)).toBeNull()
    expect(lireJetonDuLien(`${'a'.repeat(47)}.${'b'.repeat(64)}`)).toBeNull()
    expect(lireJetonDuLien(`${'a'.repeat(48)}.${'b'.repeat(63)}`)).toBeNull()
    expect(lireJetonDuLien(`${'g'.repeat(48)}.${'b'.repeat(64)}`)).toBeNull()
    expect(lireJetonDuLien(`${'a'.repeat(48)}.${'b'.repeat(64)}.x`)).toBeNull()
    expect(lireJetonDuLien('')).toBeNull()
  })
})

describe('nouvelleInvitation', () => {
  it('donne un id, un jeton de ligne et un lien signé pour ces valeurs', async () => {
    const n = await nouvelleInvitation('syndic', invitation.email, invitation.equipe_id)
    expect(n.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(n.invite_token).toMatch(/^[a-f0-9]{48}$/)
    const lu = lireJetonDuLien(n.jetonLien)
    expect(lu?.jeton).toBe(n.invite_token)
    expect(await signatureValide('syndic', lu!.signature, {
      id: n.id, email: invitation.email, invite_token: n.invite_token, equipe_id: invitation.equipe_id,
    })).toBe(true)
  })

  it('échoue sans clé de signature', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(nouvelleInvitation('pro', invitation.email, invitation.equipe_id)).rejects.toThrow()
  })
})

describe('signatureValide', () => {
  it('vraie pour la ligne signée', async () => {
    const signature = await signatureDe(await jetonDuLien('syndic', invitation))
    expect(await signatureValide('syndic', signature, invitation)).toBe(true)
  })

  it.each([
    ['e-mail modifié après envoi', { email: 'autre@exemple.fr' }],
    ['jeton de la ligne modifié', { invite_token: 'b'.repeat(48) }],
    ['autre ligne', { id: '11111111-2222-4333-8444-555555555555' }],
    ['autre équipe', { equipe_id: '99999999-8888-4777-8666-555555555555' }],
  ])('fausse si la ligne ne correspond plus (%s)', async (_cas, modif) => {
    const signature = await signatureDe(await jetonDuLien('pro', invitation))
    expect(await signatureValide('pro', signature, { ...invitation, ...modif })).toBe(false)
  })

  it("fausse si la signature vient de l'autre espace", async () => {
    const signature = await signatureDe(await jetonDuLien('pro', invitation))
    expect(await signatureValide('syndic', signature, invitation)).toBe(false)
  })

  it('fausse si la clé de service a changé', async () => {
    const signature = await signatureDe(await jetonDuLien('pro', invitation))
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'une-autre-cle'
    expect(await signatureValide('pro', signature, invitation)).toBe(false)
  })

  it('fausse pour une signature quelconque', async () => {
    expect(await signatureValide('pro', 'c'.repeat(64), invitation)).toBe(false)
  })
})

describe('clé de signature absente', () => {
  it('refuse de signer et de vérifier sans clé de service', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(jetonDuLien('pro', invitation)).rejects.toThrow()
    await expect(signatureValide('pro', 'c'.repeat(64), invitation)).rejects.toThrow()
  })

  it('refuse la valeur de remplacement utilisée au build', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder-key-for-build'
    await expect(jetonDuLien('pro', invitation)).rejects.toThrow()
  })
})

describe('compteRattachable', () => {
  it.each([
    [{}, true],
    [{ role: '' }, true],
    [{ role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: 'x' }, true],
    [{ role: 'pro_societe', pro_team_role: 'CONDUCTEUR_TRAVAUX' }, true],
    [{ role: 'pro_societe' }, false],
    [{ role: 'pro_societe', pro_team_role: 'GERANT' }, false],
    [{ role: 'artisan' }, false],
    [{ role: 'client' }, false],
    [{ role: 'syndic_tech' }, false],
    [{ role: 'super_admin' }, false],
  ])('pro : %o → %s', (meta, attendu) => {
    expect(compteRattachable('pro', meta)).toBe(attendu)
  })

  it.each([
    [{}, true],
    [{ role: 'syndic_tech', cabinet_id: 'x' }, true],
    [{ role: 'syndic_admin' }, true],
    [{ role: 'syndic' }, false],
    [{ role: 'super_admin' }, false],
    [{ role: 'artisan' }, false],
    [{ role: 'pro_societe', pro_team_role: 'OUVRIER' }, false],
    [{ role: 'coproprio' }, false],
  ])('syndic : %o → %s', (meta, attendu) => {
    expect(compteRattachable('syndic', meta)).toBe(attendu)
  })

  it('sans app_metadata : rattachable', () => {
    expect(compteRattachable('pro', undefined)).toBe(true)
  })

  // AJ Signalement (11/11/2026) : un compte n'est rattaché que s'il porte DÉJÀ le rôle des gestionnaires ; jamais un
  // compte sans rôle (la branche passe avant « sans rôle → rattachable »), jamais un compte d'un autre espace.
  it.each([
    [{}, false],
    [{ role: '' }, false],
    [undefined, false],
    [{ role: 'gestionnaire_signalement' }, true],
    [{ role: 'super_admin' }, false],
    [{ role: 'syndic_gestionnaire' }, false],
    [{ role: 'client' }, false],
    [{ role: 'artisan' }, false],
    [{ role: 'pro_societe', pro_team_role: 'OUVRIER' }, false],
  ])('aj_signalement : %o → %s', (meta, attendu) => {
    expect(compteRattachable('aj_signalement', meta)).toBe(attendu)
  })
})

describe('espace aj_signalement', () => {
  it('un lien AJ Signalement ne vaut pas pour le syndic ni le pro, et inversement', async () => {
    const aj = await signatureDe(await jetonDuLien('aj_signalement', invitation))
    expect(await signatureValide('aj_signalement', aj, invitation)).toBe(true)
    expect(await signatureValide('syndic', aj, invitation)).toBe(false)
    expect(await signatureValide('pro', aj, invitation)).toBe(false)
    const syndic = await signatureDe(await jetonDuLien('syndic', invitation))
    expect(await signatureValide('aj_signalement', syndic, invitation)).toBe(false)
  })

  it('nouvelleInvitation signe l’identifiant de fiche reçu', async () => {
    const inv = await nouvelleInvitation('aj_signalement', 'claire@exemple.fr', invitation.equipe_id)
    const lu = lireJetonDuLien(inv.jetonLien)
    expect(lu?.jeton).toBe(inv.invite_token)
    expect(await signatureValide('aj_signalement', lu?.signature ?? '', { id: inv.id, email: 'claire@exemple.fr', invite_token: inv.invite_token, equipe_id: invitation.equipe_id })).toBe(true)
  })
})

describe('sansJetonInvitation', () => {
  it('retire invite_token et garde le reste', () => {
    expect(sansJetonInvitation({ id: 'm1', email: 'a@b.fr', invite_token: 'x' })).toEqual({ id: 'm1', email: 'a@b.fr' })
  })
})
