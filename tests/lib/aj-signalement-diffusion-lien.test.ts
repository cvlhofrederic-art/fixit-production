// @vitest-environment node
// tests/lib/aj-signalement-diffusion-lien.test.ts
//
// Liens de désinscription d'une diffusion (cahier PR 3 § 8.1, décision H5 de Hugo appliquée par défaut) :
//   - deux liens par message, même forme `<id du destinataire, 32 hex>.<HMAC-SHA-256, 64 hex>`, signés pour deux usages
//     distincts : la PAGE (bouton du corps, jeton dans le fragment « # ») et le UN CLIC (en-tête List-Unsubscribe, jeton
//     dans le chemin, RFC 8058) ; un jeton d'un usage ne vaut rien pour l'autre ;
//   - clé HMAC dérivée par HKDF-SHA-256 (sel « vitfix », info « aj-signalement-desinscription-v1 ») du secret dédié
//     AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION ; message signé JSON ['v1', usage, destinataireId] ; aucun stockage : le lien
//     se recalcule à l'identique ;
//   - rotation : AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE (facultative) ; un lien signé par elle est « expiré » ;
//   - vérification : signature fausse → « inconnu » (même si l'identifiant existe, jamais le repli) ; signature bonne
//     mais identifiant absent de la base (diffusion purgée) → « ancien » ; cabinet du chemin différent → « inconnu » ;
//     365 jours après la diffusion → « expiré » ;
//   - secret absent → configuration_incomplete ; ni « @ », ni identifiant de signalement ou de copropriété dans un lien.
// Les secrets de ces tests sont des valeurs de test, passées dans un objet d'environnement : process.env n'est pas lu.

import { createHmac, hkdfSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FORMAT_JETON_DIFFUSION_QR, LONGUEUR_MIN_CLE_LIENS_DIFFUSION_QR, ORIGINE_LIENS_DIFFUSION_QR, VALIDITE_LIEN_DIFFUSION_JOURS,
  cleLiensDiffusionConfigureeQr, etatLienDiffusionQr, signerLiensDiffusionQr, urlPageDesinscriptionQr,
  urlUnClicDesinscriptionQr, verifierJetonDiffusionQr, type JetonSigneDiffusionQr, type VerificationJetonDiffusionQr,
} from '@/lib/aj-signalement/diffusion-lien'

const CLE_A = 'cle-de-test-courante-pour-les-liens-de-diffusion'
const CLE_B = 'autre-cle-de-test-pour-la-rotation-des-liens'
const ENV = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_A }
const DESTINATAIRE = '3f2b8c1d-4e5a-4b6c-9d7e-8f9a0b1c2d3e'
const DESTINATAIRE_HEX = DESTINATAIRE.replaceAll('-', '')
const AUTRE_DESTINATAIRE = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const SIGNALEMENT = '5f2c9a1e-1111-4222-8333-444444444444'
const COPROPRIETE = '7c6b5a49-3827-4165-9504-a3b2c1d0e9f8'

/** Signature attendue, calculée par node:crypto (oracle indépendant de crypto.subtle). */
function signatureAttendue(secret: string, usage: string, id: string): string {
  const cle = Buffer.from(hkdfSync('sha256', secret, 'vitfix', 'aj-signalement-desinscription-v1', 32))
  return createHmac('sha256', cle).update(JSON.stringify(['v1', usage, id])).digest('hex')
}

async function liens(id = DESTINATAIRE, env: Record<string, string | undefined> = ENV) {
  const r = await signerLiensDiffusionQr(id, env)
  if (!r.ok) throw new Error(`signature impossible : ${r.code}`)
  return r
}

/** Remplace le caractère d'indice i (hexadécimal) par un autre. */
function alterer(jeton: string, i: number): string {
  const autre = jeton[i] === '0' ? '1' : '0'
  return `${jeton.slice(0, i)}${autre}${jeton.slice(i + 1)}`
}

const signe = (v: VerificationJetonDiffusionQr) => (v.statut === 'signe' ? v : null)

describe('signature des deux liens', () => {
  it('forme `<id 32 hex>.<HMAC 64 hex>` pour la page et le un clic, même identifiant, signatures différentes', async () => {
    const { page, unClic } = await liens()
    expect(page).toMatch(FORMAT_JETON_DIFFUSION_QR)
    expect(unClic).toMatch(FORMAT_JETON_DIFFUSION_QR)
    expect(FORMAT_JETON_DIFFUSION_QR.source).toBe('^[a-f0-9]{32}\\.[a-f0-9]{64}$')
    expect(page.slice(0, 32)).toBe(DESTINATAIRE_HEX)
    expect(unClic.slice(0, 32)).toBe(DESTINATAIRE_HEX)
    expect(page).not.toBe(unClic)
  })

  it('construction exacte du cahier : HKDF (sel vitfix, info aj-signalement-desinscription-v1), JSON [v1, usage, id]', async () => {
    const { page, unClic } = await liens()
    expect(page).toBe(`${DESTINATAIRE_HEX}.${signatureAttendue(CLE_A, 'aj-diffusion-page', DESTINATAIRE)}`)
    expect(unClic).toBe(`${DESTINATAIRE_HEX}.${signatureAttendue(CLE_A, 'aj-diffusion-un-clic', DESTINATAIRE)}`)
  })

  it('aucun stockage nécessaire : la même entrée redonne exactement les mêmes liens', async () => {
    expect(await liens()).toEqual(await liens())
  })

  it('identifiant en majuscules : ramené à la forme canonique (minuscules)', async () => {
    expect(await liens(DESTINATAIRE.toUpperCase())).toEqual(await liens())
  })

  it('identifiant qui n’est pas un UUID : refusé, aucune signature', async () => {
    for (const id of ['', 'abc', DESTINATAIRE_HEX, `${DESTINATAIRE}x`, 'marie@exemple.test']) {
      expect(await signerLiensDiffusionQr(id, ENV)).toEqual({ ok: false, code: 'identifiant_invalide' })
    }
  })

  it('une autre clé donne d’autres signatures ; la clé de l’environnement est relue à chaque appel', async () => {
    const a = await liens()
    const b = await liens(DESTINATAIRE, { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_B })
    expect(b.page).not.toBe(a.page)
    expect(b.page).toBe(`${DESTINATAIRE_HEX}.${signatureAttendue(CLE_B, 'aj-diffusion-page', DESTINATAIRE)}`)
    expect(await liens()).toEqual(a)
  })
})

describe('clé absente ou trop courte : configuration_incomplete', () => {
  const sansCle = [
    {},
    { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: '' },
    { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: '   ' },
    { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: 'x'.repeat(LONGUEUR_MIN_CLE_LIENS_DIFFUSION_QR - 1) },
    // La clé précédente seule ne permet ni de signer ni de vérifier.
    { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE: CLE_A },
  ]

  it('32 caractères au moins', () => {
    expect(LONGUEUR_MIN_CLE_LIENS_DIFFUSION_QR).toBe(32)
    expect(cleLiensDiffusionConfigureeQr({ AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: 'x'.repeat(32) })).toBe(true)
  })

  it.each(sansCle)('signature impossible : %o', async (env) => {
    expect(cleLiensDiffusionConfigureeQr(env)).toBe(false)
    expect(await signerLiensDiffusionQr(DESTINATAIRE, env)).toEqual({ ok: false, code: 'configuration_incomplete' })
  })

  it.each(sansCle)('vérification impossible (jamais « inconnu » ni « signé ») : %o', async (env) => {
    const { page } = await liens()
    expect(await verifierJetonDiffusionQr(page, ['page'], env)).toEqual({ statut: 'configuration_incomplete' })
  })

  describe('environnement par défaut : process.env', () => {
    let avant: string | undefined
    beforeEach(() => {
      avant = process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
      delete process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
    })
    afterEach(() => {
      if (avant === undefined) delete process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
      else process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION = avant
    })

    it('sans la variable : configuration_incomplete', async () => {
      expect(cleLiensDiffusionConfigureeQr()).toBe(false)
      expect(await signerLiensDiffusionQr(DESTINATAIRE)).toEqual({ ok: false, code: 'configuration_incomplete' })
    })

    it('avec la variable : mêmes liens qu’avec l’objet d’environnement', async () => {
      process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION = CLE_A
      expect(cleLiensDiffusionConfigureeQr()).toBe(true)
      expect(await signerLiensDiffusionQr(DESTINATAIRE)).toEqual(await liens())
    })
  })
})

describe('vérification de la signature', () => {
  it('jeton de page attendu et reçu : signé, clé courante, identifiant rendu sous forme UUID', async () => {
    const { page } = await liens()
    expect(await verifierJetonDiffusionQr(page, ['page'], ENV)).toEqual({
      statut: 'signe', destinataireId: DESTINATAIRE, usage: 'page', cle: 'courante',
    })
  })

  it('jeton un clic attendu et reçu : signé, usage un_clic', async () => {
    const { unClic } = await liens()
    expect(signe(await verifierJetonDiffusionQr(unClic, ['un_clic'], ENV))).toMatchObject({ usage: 'un_clic', cle: 'courante' })
  })

  it('jeton un clic refusé là où un jeton de page est attendu, et l’inverse', async () => {
    const { page, unClic } = await liens()
    expect(await verifierJetonDiffusionQr(unClic, ['page'], ENV)).toEqual({ statut: 'inconnu' })
    expect(await verifierJetonDiffusionQr(page, ['un_clic'], ENV)).toEqual({ statut: 'inconnu' })
  })

  it('les deux usages acceptés (lecture de la page) : l’usage du jeton est rendu', async () => {
    const { page, unClic } = await liens()
    expect(signe(await verifierJetonDiffusionQr(page, ['page', 'un_clic'], ENV))?.usage).toBe('page')
    expect(signe(await verifierJetonDiffusionQr(unClic, ['page', 'un_clic'], ENV))?.usage).toBe('un_clic')
  })

  it('aucun usage accepté : inconnu', async () => {
    const { page } = await liens()
    expect(await verifierJetonDiffusionQr(page, [], ENV)).toEqual({ statut: 'inconnu' })
  })

  it('signature altérée (chaque position) : inconnu', async () => {
    const { page } = await liens()
    for (const i of [33, 40, 64, 96]) {
      expect(await verifierJetonDiffusionQr(alterer(page, i), ['page'], ENV)).toEqual({ statut: 'inconnu' })
    }
  })

  it('identifiant altéré, signature gardée : inconnu (la signature couvre l’identifiant)', async () => {
    const { page } = await liens()
    for (const i of [0, 12, 31]) {
      expect(await verifierJetonDiffusionQr(alterer(page, i), ['page'], ENV)).toEqual({ statut: 'inconnu' })
    }
  })

  it('signature d’un autre destinataire recollée sur cet identifiant : inconnu', async () => {
    const { page } = await liens()
    const autre = await liens(AUTRE_DESTINATAIRE)
    expect(await verifierJetonDiffusionQr(`${DESTINATAIRE_HEX}.${autre.page.slice(33)}`, ['page'], ENV)).toEqual({ statut: 'inconnu' })
    expect(page.slice(33)).not.toBe(autre.page.slice(33))
  })

  it('format faux : inconnu, sans erreur', async () => {
    const { page } = await liens()
    for (const jeton of ['', page.toUpperCase(), `${page}0`, page.slice(0, -1), page.replace('.', '-'), `${page}.x`, ` ${page}`,
      `${DESTINATAIRE}.${page.slice(33)}`, 'marie@exemple.test']) {
      expect(await verifierJetonDiffusionQr(jeton, ['page', 'un_clic'], ENV)).toEqual({ statut: 'inconnu' })
    }
  })

  it('autre clé courante, sans clé précédente : inconnu', async () => {
    const { page } = await liens()
    expect(await verifierJetonDiffusionQr(page, ['page'], { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_B })).toEqual({ statut: 'inconnu' })
  })

  it('rotation : un lien signé par la clé précédente est reconnu comme tel (puis traité comme expiré)', async () => {
    const { page, unClic } = await liens()
    const apres = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_B, AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE: CLE_A }
    expect(await verifierJetonDiffusionQr(page, ['page'], apres)).toEqual({
      statut: 'signe', destinataireId: DESTINATAIRE, usage: 'page', cle: 'precedente',
    })
    // Le un clic signé par l'ancienne clé reste identifiable : la route D-P5 l'honore (H5 : un clic honoré même expiré).
    expect(signe(await verifierJetonDiffusionQr(unClic, ['un_clic'], apres))).toMatchObject({ usage: 'un_clic', cle: 'precedente' })
    // L'usage reste vérifié sous la clé précédente.
    expect(await verifierJetonDiffusionQr(unClic, ['page'], apres)).toEqual({ statut: 'inconnu' })
    // Les nouveaux liens sont signés par la clé courante.
    expect((await liens(DESTINATAIRE, apres)).page).toBe(`${DESTINATAIRE_HEX}.${signatureAttendue(CLE_B, 'aj-diffusion-page', DESTINATAIRE)}`)
  })

  it('clé précédente trop courte : ignorée', async () => {
    const { page } = await liens()
    const env = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: CLE_B, AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE: CLE_A.slice(0, 10) }
    expect(await verifierJetonDiffusionQr(page, ['page'], env)).toEqual({ statut: 'inconnu' })
  })
})

describe('état du lien (signature + ligne lue par signalements_qr_diffusion_lien)', () => {
  const CREE_LE = '2026-11-13T09:00:00.000Z'
  const JOUR = 24 * 60 * 60 * 1000
  const ligne = { cabinet_identifiant: 'cabinet-exemple', diffusion_cree_le: CREE_LE }
  const signePage: JetonSigneDiffusionQr = { statut: 'signe', destinataireId: DESTINATAIRE, usage: 'page', cle: 'courante' }
  const apres = (ms: number) => new Date(Date.parse(CREE_LE) + ms)
  const etat = (sur: Partial<Parameters<typeof etatLienDiffusionQr>[0]> = {}) => etatLienDiffusionQr({
    verification: signePage, ligne, identifiantChemin: 'cabinet-exemple', maintenant: apres(JOUR), ...sur,
  })

  it('signature bonne, ligne du même cabinet, moins d’un an : valide', () => {
    expect(etat()).toBe('valide')
  })

  it('365 jours : la veille et le jour même valides, le lendemain expiré', () => {
    expect(VALIDITE_LIEN_DIFFUSION_JOURS).toBe(365)
    expect(etat({ maintenant: apres(364 * JOUR) })).toBe('valide')
    expect(etat({ maintenant: apres(365 * JOUR) })).toBe('valide')
    expect(etat({ maintenant: apres(365 * JOUR + 1) })).toBe('expire')
    expect(etat({ maintenant: apres(366 * JOUR) })).toBe('expire')
  })

  it('signature fausse sur un identifiant qui existe en base : inconnu, jamais le repli', () => {
    expect(etat({ verification: { statut: 'inconnu' } })).toBe('inconnu')
    expect(etat({ verification: { statut: 'inconnu' }, maintenant: apres(400 * JOUR) })).toBe('inconnu')
  })

  it('clé absente : inconnu pour les pages publiques', () => {
    expect(etat({ verification: { statut: 'configuration_incomplete' } })).toBe('inconnu')
  })

  it('signature bonne, identifiant absent de la base (diffusion purgée) : ancien', () => {
    expect(etat({ ligne: null })).toBe('ancien')
    expect(etat({ ligne: null, verification: { ...signePage, cle: 'precedente' } })).toBe('ancien')
  })

  it('cabinet du chemin différent de celui de la diffusion : inconnu', () => {
    expect(etat({ identifiantChemin: 'autre-cabinet' })).toBe('inconnu')
    expect(etat({ identifiantChemin: 'Cabinet-Exemple' })).toBe('inconnu')
  })

  it('signé par la clé précédente : expiré, même dans l’année', () => {
    expect(etat({ verification: { ...signePage, cle: 'precedente' } })).toBe('expire')
  })

  it('jeton un clic : mêmes états (la route D-P5 honore l’opposition même expirée)', () => {
    const unClic: JetonSigneDiffusionQr = { ...signePage, usage: 'un_clic' }
    expect(etat({ verification: unClic })).toBe('valide')
    expect(etat({ verification: unClic, maintenant: apres(400 * JOUR) })).toBe('expire')
  })

  it('date de diffusion illisible : expiré (le repli permet encore de s’opposer)', () => {
    expect(etat({ ligne: { ...ligne, diffusion_cree_le: 'pas une date' } })).toBe('expire')
  })

  it('maintenant par défaut : l’heure courante', () => {
    expect(etatLienDiffusionQr({ verification: signePage, ligne: { ...ligne, diffusion_cree_le: new Date().toISOString() }, identifiantChemin: 'cabinet-exemple' })).toBe('valide')
    expect(etatLienDiffusionQr({ verification: signePage, ligne: { ...ligne, diffusion_cree_le: '2020-01-01T00:00:00Z' }, identifiantChemin: 'cabinet-exemple' })).toBe('expire')
  })
})

describe('adresses des liens', () => {
  it('page : https://vitfix.io/<identifiant>/desinscription/#<jeton de page> (jeton dans le fragment seulement)', async () => {
    const { page } = await liens()
    const url = urlPageDesinscriptionQr('cabinet-exemple', page)
    expect(ORIGINE_LIENS_DIFFUSION_QR).toBe('https://vitfix.io')
    expect(url).toBe(`https://vitfix.io/cabinet-exemple/desinscription/#${page}`)
    expect(new URL(url).pathname).toBe('/cabinet-exemple/desinscription/')
    expect(new URL(url).search).toBe('')
  })

  it('un clic : https://vitfix.io/api/aj-signalement/desinscription/un-clic/<jeton un clic> (dans le chemin, RFC 8058)', async () => {
    const { unClic } = await liens()
    const url = urlUnClicDesinscriptionQr(unClic)
    expect(url).toBe(`https://vitfix.io/api/aj-signalement/desinscription/un-clic/${unClic}`)
    expect(new URL(url).hash).toBe('')
    // Alphabet sûr pour un en-tête : aucun espace, chevron, retour, virgule ni point-virgule.
    expect(url).toMatch(/^[A-Za-z0-9:/._-]+$/)
  })

  it('ni « @ », ni identifiant de signalement ou de copropriété, ni adresse dans un lien', async () => {
    const { page, unClic } = await liens()
    for (const url of [urlPageDesinscriptionQr('cabinet-exemple', page), urlUnClicDesinscriptionQr(unClic)]) {
      expect(url).not.toContain('@')
      expect(url).not.toContain(SIGNALEMENT)
      expect(url).not.toContain(SIGNALEMENT.replaceAll('-', ''))
      expect(url).not.toContain(COPROPRIETE)
      expect(url).not.toContain(COPROPRIETE.replaceAll('-', ''))
      expect(url).not.toContain(CLE_A)
    }
  })

  it('jeton ou identifiant hors format : erreur, aucune adresse construite', async () => {
    const { page, unClic } = await liens()
    expect(() => urlPageDesinscriptionQr('cabinet-exemple', `${page}\r\nBcc: x`)).toThrow(TypeError)
    expect(() => urlPageDesinscriptionQr('Cabinet Exemple', page)).toThrow(TypeError)
    expect(() => urlPageDesinscriptionQr('cabinet-exemple/../admin', page)).toThrow(TypeError)
    expect(() => urlUnClicDesinscriptionQr(`${unClic}>, <https://exemple.test`)).toThrow(TypeError)
    expect(() => urlUnClicDesinscriptionQr('')).toThrow(TypeError)
  })
})
