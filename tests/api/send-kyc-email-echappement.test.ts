// @vitest-environment node
// tests/api/send-kyc-email-echappement.test.ts — e-mail de décision KYC (POST /api/send-kyc-email), envoyé après
// « Approuver » ou « Rejeter » dans le panneau d'administration.
//
// Le nom et la raison sociale viennent de la fiche, que son titulaire modifie dans « Mon profil » ; le motif de rejet
// est saisi par l'administrateur. Ces valeurs étaient insérées telles quelles dans le HTML de l'e-mail : une balise
// qu'elles contenaient y était interprétée. Contrat vérifié ici, pour tous les dossiers (français et portugais) : dans
// le corps HTML, ces valeurs sont échappées ; l'objet de l'e-mail, en texte brut, les garde telles quelles.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

vi.stubEnv('INTERNAL_API_SECRET', 'secret-de-test')
vi.stubEnv('RESEND_API_KEY', 'cle-de-test')
const { POST } = await import('@/app/api/send-kyc-email/route')

const fetchEnvoi = vi.fn()

beforeEach(() => {
  fetchEnvoi.mockReset().mockResolvedValue(new Response(JSON.stringify({ id: 'courriel-de-test' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchEnvoi)
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** Appelle la route et rend le message transmis au service d'envoi (objet et HTML). */
async function envoyer(corps: Record<string, unknown>) {
  const res = await POST(new NextRequest('https://vitfix.test/api/send-kyc-email', {
    method: 'POST',
    headers: { 'x-internal-secret': 'secret-de-test', 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  expect(res.status).toBe(200)
  expect(fetchEnvoi).toHaveBeenCalledTimes(1)
  return JSON.parse(String((fetchEnvoi.mock.calls[0][1] as RequestInit).body)) as { subject: string; html: string }
}

const NOM = 'Paul <b>Exemple</b> & Fils'
const SOCIETE = 'Bâtiment <i>Exemple</i>'

describe('E-mail de décision KYC : valeurs échappées dans le HTML', () => {
  it('approbation : nom et raison sociale échappés dans le corps, gardés tels quels dans l’objet', async () => {
    const message = await envoyer({ to: 'contact@exemple.fr', name: NOM, company: SOCIETE, action: 'approve', market: 'fr_btp' })

    expect(message.html).toContain('Paul &lt;b&gt;Exemple&lt;/b&gt; &amp; Fils')
    expect(message.html).toContain('Bâtiment &lt;i&gt;Exemple&lt;/i&gt;')
    expect(message.html).not.toContain('<b>Exemple</b>')
    expect(message.html).not.toContain('<i>Exemple</i>')
    expect(message.subject).toBe('Votre compte Bâtiment <i>Exemple</i> est activé sur Vitfix')
  })

  it('rejet : le motif est échappé', async () => {
    const message = await envoyer({
      to: 'contact@exemple.fr', name: 'Paul Exemple', company: 'Bâtiment Exemple', action: 'reject',
      rejection_reason: 'Kbis <a href="https://exemple.fr">illisible</a>', market: 'fr_btp',
    })

    expect(message.html).toContain('Kbis &lt;a href=&quot;https://exemple.fr&quot;&gt;illisible&lt;/a&gt;')
    expect(message.html).not.toContain('<a href="https://exemple.fr">')
  })

  it('dossier portugais : même échappement', async () => {
    const message = await envoyer({
      to: 'contacto@exemplo.pt', name: NOM, company: SOCIETE, action: 'reject',
      rejection_reason: 'Documento <u>ilegível</u>', market: 'pt_artisan',
    })

    expect(message.html).toContain('Paul &lt;b&gt;Exemple&lt;/b&gt; &amp; Fils')
    expect(message.html).toContain('Documento &lt;u&gt;ilegível&lt;/u&gt;')
    expect(message.html).not.toContain('<u>ilegível</u>')
  })

  it('valeurs sans balise : texte inchangé dans l’e-mail', async () => {
    const message = await envoyer({ to: 'contact@exemple.fr', name: 'Paul Exemple', company: 'Bâtiment Exemple', action: 'approve' })

    expect(message.html).toContain('<h2>Félicitations Paul Exemple !</h2>')
    expect(message.html).toContain('<strong>Bâtiment Exemple</strong>')
  })
})
