// tests/lib/aj-signalement-sentry-desinscription.test.ts
//
// AJ Signalement, PR 3, lot 6 (cahier § 8.2, « Journalisation ») : l'adresse un clic de l'en-tête List-Unsubscribe
// (/api/aj-signalement/desinscription/un-clic/<jeton>) est appelée en clair ; son jeton ne doit pas partir chez Sentry
// (erreurs ni transactions, serveur et edge). Le jeton un clic ne permet que de s'opposer, mais il reste propre à une
// personne : il est effacé de toute chaîne de l'événement avant l'envoi.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  effacerJetonsDesinscriptionQr, effacerJetonsDesinscriptionSentryQr, effacerJetonsUnClicQr, effacerJetonsUnClicSentryQr,
} from '@/lib/aj-signalement/sentry-desinscription'

const JETON = `${'a1'.repeat(16)}.${'b2'.repeat(32)}`
const CHEMIN = `/api/aj-signalement/desinscription/un-clic/${JETON}`

describe('effacement du jeton un clic', () => {
  it('chemin, adresse complète, requête et ancre : le jeton devient [jeton], le reste est gardé', () => {
    expect(effacerJetonsUnClicQr(`POST ${CHEMIN}`)).toBe('POST /api/aj-signalement/desinscription/un-clic/[jeton]')
    expect(effacerJetonsUnClicQr(`https://vitfix.io${CHEMIN}?x=1`)).toBe('https://vitfix.io/api/aj-signalement/desinscription/un-clic/[jeton]?x=1')
    expect(effacerJetonsUnClicQr(`${CHEMIN}/`)).toBe('/api/aj-signalement/desinscription/un-clic/[jeton]/')
    // Valeur encodée, ou hors format : effacée aussi (tout ce qui suit le segment, jusqu'au prochain séparateur).
    expect(effacerJetonsUnClicQr('/api/aj-signalement/desinscription/un-clic/abc%2Edef ok')).toBe('/api/aj-signalement/desinscription/un-clic/[jeton] ok')
    expect(effacerJetonsUnClicQr(`${CHEMIN} puis ${CHEMIN}`)).not.toContain(JETON)
  })

  it('les autres chemins ne changent pas (dont la route paramétrée et la page de désinscription, dont le jeton est dans le fragment)', () => {
    for (const texte of [
      'POST /api/aj-signalement/desinscription/un-clic/[jeton]', '/api/aj-signalement/desinscription/lecture',
      '/cabinet-exemple/desinscription/', 'rien à voir', '',
    ]) {
      expect(effacerJetonsUnClicQr(texte)).toBe(texte)
    }
  })

  it('événement Sentry : toutes les chaînes, à toute profondeur (requête, transaction, fils d’Ariane, spans, contextes)', () => {
    const evenement = {
      message: `échec ${CHEMIN}`,
      transaction: `POST ${CHEMIN}`,
      request: { url: `https://vitfix.io${CHEMIN}`, headers: { referer: `https://vitfix.io${CHEMIN}` } },
      breadcrumbs: [{ message: CHEMIN, data: { url: CHEMIN, status_code: 503 } }],
      spans: [{ description: `POST ${CHEMIN}`, data: { 'http.url': CHEMIN, 'url.full': `https://vitfix.io${CHEMIN}` } }],
      contexts: { trace: { data: { 'http.target': CHEMIN } } },
      exception: { values: [{ value: `introuvable : ${CHEMIN}` }] },
      tags: { ok: 'garde' },
      nombre: 3,
      nul: null,
    }
    const resultat = effacerJetonsUnClicSentryQr(evenement)
    expect(JSON.stringify(resultat)).not.toContain(JETON)
    expect(JSON.stringify(resultat)).not.toContain(JETON.slice(33))
    expect(resultat.request.url).toBe('https://vitfix.io/api/aj-signalement/desinscription/un-clic/[jeton]')
    expect(resultat.tags).toEqual({ ok: 'garde' })
    expect(resultat.breadcrumbs[0].data.status_code).toBe(503)
    expect(resultat.nombre).toBe(3)
    expect(resultat.nul).toBeNull()
  })

  it('structure cyclique ou très profonde : aucune boucle, aucune exception', () => {
    const a: Record<string, unknown> = { url: CHEMIN }
    a.moi = a
    let profond: Record<string, unknown> = { url: CHEMIN }
    for (let i = 0; i < 100; i++) profond = { suite: profond }
    expect(() => effacerJetonsUnClicSentryQr({ a, profond })).not.toThrow()
    expect(a.url).toBe('/api/aj-signalement/desinscription/un-clic/[jeton]')
  })

  it.each(['sentry.server.config.ts', 'sentry.edge.config.ts'])('%s : beforeSend ET beforeSendTransaction effacent le jeton', (fichier) => {
    const texte = readFileSync(join(process.cwd(), fichier), 'utf-8')
    expect(texte).toContain("from './lib/aj-signalement/sentry-desinscription'")
    expect(texte).toMatch(/beforeSend\s*\([\s\S]*?effacerJetonsUnClicSentryQr\(/)
    expect(texte).toMatch(/beforeSendTransaction\s*\([\s\S]*?effacerJetonsUnClicSentryQr\(/)
  })
})

// Relecture 2 de la PR 3 : le Sentry du NAVIGATEUR voyait le jeton du fragment de la page de désinscription (fil d'Ariane
// de l'effacement par history.replaceState, request.url d'une erreur levée avant). Éprouvé de bout en bout, avec le vrai
// SDK et le vrai composant : tests/securite/sentry-navigateur-desinscription.test.tsx.
describe('effacement de tout jeton de lien de diffusion (navigateur : fragment de la page)', () => {
  const PAGE = `/cabinet-exemple/desinscription/#${JETON}`

  it('fragment de la page, adresse complète, majuscules, texte libre : le jeton devient [jeton], le chemin reste', () => {
    expect(effacerJetonsDesinscriptionQr(PAGE)).toBe('/cabinet-exemple/desinscription/#[jeton]')
    expect(effacerJetonsDesinscriptionQr(`https://vitfix.io${PAGE}`)).toBe('https://vitfix.io/cabinet-exemple/desinscription/#[jeton]')
    expect(effacerJetonsDesinscriptionQr(`lien ${JETON.toUpperCase()} fin`)).toBe('lien [jeton] fin')
    expect(effacerJetonsDesinscriptionQr(CHEMIN)).toBe('/api/aj-signalement/desinscription/un-clic/[jeton]')
    for (const texte of ['/cabinet-exemple/desinscription/', `${'a'.repeat(32)}.${'b'.repeat(63)}`, 'rien à voir', '']) {
      expect(effacerJetonsDesinscriptionQr(texte)).toBe(texte)
    }
  })

  it('fil d’Ariane « navigation » de l’effacement du fragment : from et to sans jeton, catégorie gardée', () => {
    const fil = { category: 'navigation', data: { from: PAGE, to: '/cabinet-exemple/desinscription/' } }
    expect(effacerJetonsDesinscriptionSentryQr(fil)).toEqual({
      category: 'navigation', data: { from: '/cabinet-exemple/desinscription/#[jeton]', to: '/cabinet-exemple/desinscription/' },
    })
  })

  it('instrumentation-client.ts : fils d’Ariane, erreurs (avant le caviardage des téléphones) et transactions passent par l’effacement', () => {
    const texte = readFileSync(join(process.cwd(), 'instrumentation-client.ts'), 'utf-8')
    expect(texte).toContain('from "@/lib/aj-signalement/sentry-desinscription"')
    expect(texte).toMatch(/beforeBreadcrumb\s*\([\s\S]*?effacerJetonsDesinscriptionSentryQr\(/)
    expect(texte).toMatch(/beforeSendTransaction\s*\([\s\S]*?effacerJetonsDesinscriptionSentryQr\(/)
    expect(texte).toMatch(/beforeSend\s*\(event\)\s*\{[\s\S]*?effacerJetonsDesinscriptionSentryQr\(event\);[\s\S]*?redactPII/)
  })
})
