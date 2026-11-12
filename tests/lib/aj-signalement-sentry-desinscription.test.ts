// tests/lib/aj-signalement-sentry-desinscription.test.ts
//
// AJ Signalement, PR 3, lot 6 (cahier § 8.2, « Journalisation ») : l'adresse un clic de l'en-tête List-Unsubscribe
// (/api/aj-signalement/desinscription/un-clic/<jeton>) est appelée en clair ; son jeton ne doit pas partir chez Sentry
// (erreurs ni transactions, serveur et edge). Le jeton un clic ne permet que de s'opposer, mais il reste propre à une
// personne : il est effacé de toute chaîne de l'événement avant l'envoi.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { effacerJetonsUnClicQr, effacerJetonsUnClicSentryQr } from '@/lib/aj-signalement/sentry-desinscription'

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
