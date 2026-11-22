// @vitest-environment node
// tests/mobile/publier-play.test.ts — envoi d'un bundle Android sur la Google Play Console.
// L'API de Google exige quatre appels dans l'ordre : ouvrir une modification, envoyer le bundle, rattacher
// le versionCode au canal, puis VALIDER. Sans la validation finale, tout paraît réussi et rien n'arrive aux
// testeurs. Un workflow qui ne tourne que sur demande ne donne aucun signal avant l'envoi réel : ces appels
// sont donc vérifiés ici, pas en production.

import { generateKeyPairSync, createVerify } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'

type Appel = { url: string; init: { method?: string; headers?: Record<string, string>; body?: unknown } }

type Publier = (options: {
  compte: unknown
  paquet: string
  aab: Uint8Array
  canal: string
  statut?: string
  notes?: string
  appelerHttp?: (url: string, init: Appel['init']) => Promise<Response>
  maintenant?: () => number
  journal?: (message: string) => void
}) => Promise<number | string>

let publierSurPlay: Publier

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const CLE_PRIVEE = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const compte = { client_email: 'envoi@vitfix.iam.gserviceaccount.com', private_key: CLE_PRIVEE }
const AAB = new Uint8Array([0x50, 0x4b, 0x03, 0x04])

const reponse = (corps: unknown, status = 200) =>
  new Response(corps === undefined ? '' : JSON.stringify(corps), { status })

// Faux transport : garde chaque appel et répond ce qu'attend l'étape suivante.
function transport(surcharges: Partial<Record<number, Response>> = {}) {
  const appels: Appel[] = []
  const parDefaut = [
    reponse({ access_token: 'jeton-test' }),
    reponse({ id: 'edit-42' }),
    reponse({ versionCode: 77 }),
    reponse({}),
    reponse({}),
  ]
  const appelerHttp = async (url: string, init: Appel['init']) => {
    appels.push({ url, init })
    return surcharges[appels.length - 1] ?? parDefaut[appels.length - 1] ?? reponse({})
  }
  return { appels, appelerHttp }
}

beforeAll(async () => {
  ;({ publierSurPlay } = (await import('../../scripts/mobile/publier-play.mjs')) as unknown as {
    publierSurPlay: Publier
  })
})

describe('publierSurPlay — les quatre étapes de l’API Google Play', () => {
  it('ouvre, envoie, rattache au canal puis valide, dans cet ordre', async () => {
    const { appels, appelerHttp } = transport()

    const versionCode = await publierSurPlay({
      compte,
      paquet: 'io.vitfix.pro',
      aab: AAB,
      canal: 'internal',
      appelerHttp,
      journal: () => {},
    })

    expect(versionCode).toBe(77)
    expect(appels).toHaveLength(5)

    const [jeton, ouverture, envoi, canal, validation] = appels
    expect(jeton.url).toBe('https://oauth2.googleapis.com/token')

    expect(ouverture.init.method).toBe('POST')
    expect(ouverture.url).toBe(
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/io.vitfix.pro/edits',
    )

    // L'envoi passe par le domaine d'upload : l'API normale rejette un corps binaire.
    expect(envoi.url).toBe(
      'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/io.vitfix.pro/edits/edit-42/bundles?uploadType=media',
    )
    expect(envoi.init.method).toBe('POST')
    expect(envoi.init.headers?.['content-type']).toBe('application/octet-stream')
    expect(envoi.init.body).toBe(AAB)

    expect(canal.init.method).toBe('PUT')
    expect(canal.url).toContain('/edits/edit-42/tracks/internal')
    // Statut par défaut « draft » : Google refuse « completed » tant que l'appli n'a jamais été publiée.
    expect(JSON.parse(String(canal.init.body))).toEqual({
      track: 'internal',
      releases: [{ versionCodes: ['77'], status: 'draft' }],
    })

    // Sans cet appel, la modification reste ouverte et aucun testeur ne reçoit la version.
    expect(validation.init.method).toBe('POST')
    expect(validation.url).toContain('/edits/edit-42:commit')
  })

  it('présente le jeton obtenu sur chacun des appels suivants', async () => {
    const { appels, appelerHttp } = transport()
    await publierSurPlay({ compte, paquet: 'io.vitfix.pro', aab: AAB, canal: 'internal', appelerHttp, journal: () => {} })

    for (const appel of appels.slice(1)) {
      expect(appel.init.headers?.authorization).toBe('Bearer jeton-test')
    }
  })

  it('signe un JWT que la clé publique du compte vérifie, pour la bonne portée', async () => {
    const { appels, appelerHttp } = transport()
    await publierSurPlay({
      compte,
      paquet: 'io.vitfix.pro',
      aab: AAB,
      canal: 'internal',
      appelerHttp,
      maintenant: () => 1_700_000_000,
      journal: () => {},
    })

    const assertion = new URLSearchParams(String(appels[0].init.body)).get('assertion') ?? ''
    const [entete, corps, signature] = assertion.split('.')
    expect(createVerify('RSA-SHA256').update(`${entete}.${corps}`).verify(publicKey, signature, 'base64url')).toBe(true)

    expect(JSON.parse(Buffer.from(corps, 'base64url').toString())).toEqual({
      iss: compte.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    })
  })

  it('transmet le statut demandé quand l’appli a déjà été publiée', async () => {
    const { appels, appelerHttp } = transport()
    await publierSurPlay({
      compte,
      paquet: 'io.vitfix.pro',
      aab: AAB,
      canal: 'internal',
      statut: 'completed',
      appelerHttp,
      journal: () => {},
    })

    expect(JSON.parse(String(appels[3].init.body)).releases[0].status).toBe('completed')
  })

  it('ajoute les notes de version seulement quand elles sont fournies', async () => {
    const { appels, appelerHttp } = transport()
    await publierSurPlay({
      compte,
      paquet: 'io.vitfix.pro',
      aab: AAB,
      canal: 'internal',
      notes: 'Première version interne.',
      appelerHttp,
      journal: () => {},
    })

    expect(JSON.parse(String(appels[3].init.body)).releases[0].releaseNotes).toEqual([
      { language: 'fr-FR', text: 'Première version interne.' },
    ])
  })
})

describe('publierSurPlay — échecs rendus lisibles plutôt que muets', () => {
  it('refuse un canal inconnu avant le moindre appel réseau', async () => {
    const { appels, appelerHttp } = transport()
    await expect(
      publierSurPlay({ compte, paquet: 'io.vitfix.pro', aab: AAB, canal: 'interne', appelerHttp, journal: () => {} }),
    ).rejects.toThrow(/canal inconnu/)
    expect(appels).toHaveLength(0)
  })

  it('refuse un statut inconnu avant le moindre appel réseau', async () => {
    const { appels, appelerHttp } = transport()
    await expect(
      publierSurPlay({
        compte,
        paquet: 'io.vitfix.pro',
        aab: AAB,
        canal: 'internal',
        statut: 'brouillon',
        appelerHttp,
        journal: () => {},
      }),
    ).rejects.toThrow(/statut inconnu/)
    expect(appels).toHaveLength(0)
  })

  it('refuse un bundle vide avant le moindre appel réseau', async () => {
    const { appels, appelerHttp } = transport()
    await expect(
      publierSurPlay({
        compte,
        paquet: 'io.vitfix.pro',
        aab: new Uint8Array(),
        canal: 'internal',
        appelerHttp,
        journal: () => {},
      }),
    ).rejects.toThrow(/bundle vide/)
    expect(appels).toHaveLength(0)
  })

  it('nomme l’étape et rend le message de Google quand l’API refuse', async () => {
    const { appelerHttp } = transport({ 2: reponse({ error: { message: 'versionCode 77 already used' } }, 403) })
    await expect(
      publierSurPlay({ compte, paquet: 'io.vitfix.pro', aab: AAB, canal: 'internal', appelerHttp, journal: () => {} }),
    ).rejects.toThrow(/envoi du bundle : HTTP 403 — .*already used/)
  })

  it('refuse une clé de compte de service incomplète', async () => {
    const { appels, appelerHttp } = transport()
    await expect(
      publierSurPlay({
        compte: { client_email: 'envoi@vitfix.iam.gserviceaccount.com' },
        paquet: 'io.vitfix.pro',
        aab: AAB,
        canal: 'internal',
        appelerHttp,
        journal: () => {},
      }),
    ).rejects.toThrow(/compte de service incomplète/)
    expect(appels).toHaveLength(0)
  })
})
