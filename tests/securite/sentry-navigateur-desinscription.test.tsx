// tests/securite/sentry-navigateur-desinscription.test.tsx
//
// AJ Signalement, PR 3 (cahier § 7.5, § 8.1, § 8.2 « Journalisation : Sentry … jamais … de jeton » et « Jamais dans une
// URL : … jeton de la page (il est dans le fragment) ») — Sentry du NAVIGATEUR (instrumentation-client.ts, chargé par
// Next sur toutes les pages, y compris la page sans coquille /<identifiant>/desinscription/).
// Constat de la relecture 2 : la page efface le fragment (history.replaceState) ; l'intégration « breadcrumbs » du SDK
// enregistre cette navigation avec l'adresse D'AVANT (« from » : …/desinscription/#<jeton>) ; ce fil d'Ariane part avec
// toute erreur capturée ensuite sur la page (ChunkLoadError après un déploiement, extension, rendu). Une erreur levée
// AVANT l'effacement emporterait aussi le fragment dans request.url.
// Éprouvé avec le VRAI fichier instrumentation-client.ts, le VRAI SDK navigateur (@sentry/browser, celui qu'emporte
// @sentry/nextjs) et le VRAI composant de la page ; le transport est local (enveloppes gardées en mémoire) : aucune
// requête réseau.

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const enveloppes = vi.hoisted(() => [] as string[])

vi.mock('@sentry/nextjs', async () => {
  const navigateur = await vi.importActual<typeof import('@sentry/browser')>('@sentry/browser')
  const { createTransport } = await vi.importActual<typeof import('@sentry/core')>('@sentry/core')
  return {
    ...navigateur,
    captureRouterTransitionStart: () => undefined,
    init: (options: Parameters<typeof navigateur.init>[0]) => navigateur.init({
      ...options,
      // DSN d'exemple (aucun envoi : transport local) ; toutes les autres options sont celles du fichier du projet.
      dsn: 'https://0123456789abcdef0123456789abcdef@o0.ingest.sentry.io/0',
      transport: (o) => createTransport(o, async (requete) => {
        enveloppes.push(typeof requete.body === 'string' ? requete.body : new TextDecoder().decode(requete.body))
        return { statusCode: 200 }
      }),
    }),
  }
})
vi.mock('@/lib/sentry-utilisateur', () => ({ lierUtilisateurSentry: () => undefined }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }))

const SIGNATURE_PAGE = 'b'.repeat(64)
const JETON_PAGE = `${'a'.repeat(32)}.${SIGNATURE_PAGE}`
const SIGNATURE_UN_CLIC = 'd'.repeat(64)
const JETON_UN_CLIC = `${'c'.repeat(32)}.${SIGNATURE_UN_CLIC}`
const ID = 'cabinet-exemple'

/** Réponse de D-P1 simulée (la lecture du lien), et rien d'autre. */
function stubLecture(type: 'page' | 'un_clic'): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    etat: 'valide', type, langue: 'fr', cabinet: 'Cabinet Exemple', copropriete: 'Résidence Exemple',
    ...(type === 'page' ? { emailMasque: 'ma***@exemple.test', levable: false } : {}), oppose: false,
  }), { status: 200, headers: { 'content-type': 'application/json' } })))
}

async function sentry() {
  await import('@/instrumentation-client')
  return import('@sentry/browser')
}

/** Ouvre la page avec ce jeton dans le fragment, attend l'effacement du fragment et la lecture du lien. */
async function ouvrirPage(jeton: string, type: 'page' | 'un_clic'): Promise<void> {
  window.history.replaceState(null, '', `/${ID}/desinscription/#${jeton}`)
  stubLecture(type)
  await sentry()
  const { default: Page } = await import('@/components/aj-signalement/DesinscriptionDiffusionQr')
  render(<Page identifiant={ID} cabinet={{ langue: 'fr', contact: null }} />)
  await waitFor(() => expect(window.location.hash).toBe(''))
  await waitFor(() => expect(document.body.textContent).toContain('Résidence Exemple'))
}

beforeEach(() => {
  enveloppes.length = 0
  vi.unstubAllGlobals()
})

describe('Sentry du navigateur : jamais un jeton de désinscription dans un envoi', () => {
  it('jeton de PAGE : erreur capturée APRÈS l’effacement du fragment (fil d’Ariane de la navigation) → aucun envoi ne porte le jeton', async () => {
    await ouvrirPage(JETON_PAGE, 'page')
    const Sentry = await sentry()
    Sentry.captureException(new Error('ChunkLoadError: Loading chunk 123 failed.'))
    await Sentry.flush(2000)
    const tout = enveloppes.join('\n')
    expect(tout).toContain('ChunkLoadError')                 // l'événement est bien parti (transport local)
    expect(tout).toContain('"category":"navigation"')         // le fil d'Ariane de l'effacement est là…
    expect(tout).toContain(`/${ID}/desinscription/`)          // …avec son chemin (utile au diagnostic)…
    expect(tout).not.toContain(SIGNATURE_PAGE)               // …mais jamais le jeton
    expect(tout).not.toContain(JETON_PAGE.slice(0, 32))
  })

  it('jeton UN CLIC (page ouverte par la redirection D-P5b, jeton dans le fragment) : aucun envoi ne le porte', async () => {
    await ouvrirPage(JETON_UN_CLIC, 'un_clic')
    const Sentry = await sentry()
    Sentry.captureException(new Error('erreur de rendu'))
    await Sentry.flush(2000)
    const tout = enveloppes.join('\n')
    expect(tout).toContain('erreur de rendu')
    expect(tout).not.toContain(SIGNATURE_UN_CLIC)
  })

  it('erreur capturée AVANT l’effacement du fragment (adresse de la page avec le jeton) : request.url sans le jeton', async () => {
    window.history.replaceState(null, '', `/${ID}/desinscription/#${JETON_PAGE}`)
    const Sentry = await sentry()
    Sentry.captureException(new Error('erreur avant l’hydratation'))
    await Sentry.flush(2000)
    const tout = enveloppes.join('\n')
    expect(tout).toContain('erreur avant l’hydratation')
    expect(tout).toContain('"request":{"url":')
    expect(tout).not.toContain(SIGNATURE_PAGE)
    window.history.replaceState(null, '', `/${ID}/desinscription/`)
  })

  it('transaction (pageload, 5 % des pages) : beforeSendTransaction efface le jeton de toute chaîne', async () => {
    const Sentry = await sentry()
    const options = Sentry.getClient()?.getOptions()
    expect(options?.beforeSendTransaction).toEqual(expect.any(Function))
    const transaction = {
      type: 'transaction' as const,
      transaction: `/${ID}/desinscription/`,
      request: { url: `https://vitfix.io/${ID}/desinscription/#${JETON_PAGE}` },
      breadcrumbs: [{ category: 'navigation', data: { from: `/${ID}/desinscription/#${JETON_PAGE}`, to: `/${ID}/desinscription/` } }],
      spans: [{ description: `/${ID}/desinscription/#${JETON_UN_CLIC}`, data: { 'url.full': `https://vitfix.io/${ID}/desinscription/#${JETON_PAGE}` } }],
    }
    const rendu = await options!.beforeSendTransaction!(transaction as never, {})
    const texte = JSON.stringify(rendu)
    expect(texte).not.toContain(SIGNATURE_PAGE)
    expect(texte).not.toContain(SIGNATURE_UN_CLIC)
    expect(texte).toContain(`/${ID}/desinscription/`)
  })

  it('réglages du projet inchangés (échantillonnage, Replay coupé) et caviardage des adresses e-mail toujours actif', async () => {
    const Sentry = await sentry()
    const options = Sentry.getClient()?.getOptions()
    expect(options?.tracesSampleRate).toBe(0.05)
    expect(options?.replaysSessionSampleRate).toBe(0)
    expect(options?.replaysOnErrorSampleRate).toBe(0)
    Sentry.captureException(new Error('échec pour marie.dupont@exemple.test'))
    await Sentry.flush(2000)
    const tout = enveloppes.join('\n')
    expect(tout).toContain('[EMAIL]')
    expect(tout).not.toContain('marie.dupont@exemple.test')
  })
})
