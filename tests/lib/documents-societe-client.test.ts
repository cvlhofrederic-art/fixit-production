// tests/lib/documents-societe-client.test.ts — appels « société » d'un compte invité, vus du navigateur
// (lib/documents/societe-client.ts ; relecture du 26/11/2026).
//
// Un échec du navigateur (réseau coupé, session expirée, réponse illisible) était rendu sans code : l'écran affichait
// le texte français tel quel, y compris pour un salarié d'une société portugaise (« Associar orçamento », écran
// « société indisponible »). Il porte désormais un code, traduit comme les refus du serveur.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({ jeton: 'jeton-essai' as string | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: h.jeton ? { access_token: h.jeton } : null } }) } },
}))
vi.mock('@/lib/document-sync', () => ({ fetchDocumentsFromSupabase: vi.fn(async () => []) }))

import { lireDocumentsDesChantiers, lierDevisAuChantierSociete } from '@/lib/documents/societe-client'
import { messageRefusDocuments } from '@/lib/documents/messages-refus'

beforeEach(() => { h.jeton = 'jeton-essai' })
afterEach(() => { vi.restoreAllMocks() })

const repondre = (corps: string, status: number) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(corps, { status, headers: { 'Content-Type': 'application/json' } }))

describe('appels « société » : échecs du navigateur dans la langue de l’écran', () => {
  it('réseau coupé : code reseau_indisponible, texte portugais sur un écran portugais', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const lu = await lireDocumentsDesChantiers()

    expect(lu).toMatchObject({ ok: false, code: 'reseau_indisponible' })
    if (lu.ok) throw new Error('lecture inattendue')
    expect(messageRefusDocuments(lu, true)).toBe('Não foi possível ligar ao servidor. Verifique a sua ligação à rede e tente novamente.')
    expect(messageRefusDocuments(lu, false)).toBe('Connexion au serveur impossible. Vérifiez votre réseau et réessayez.')
  })

  it('sans session : code session_expiree, aucun appel au serveur', async () => {
    h.jeton = null
    const appel = vi.spyOn(globalThis, 'fetch')

    const envoye = await lierDevisAuChantierSociete('devis-1', 'chantier-1')

    expect(envoye).toMatchObject({ ok: false, code: 'session_expiree' })
    expect(appel).not.toHaveBeenCalled()
    if (envoye.ok) throw new Error('envoi inattendu')
    expect(messageRefusDocuments(envoye, true)).toBe('A sessão expirou. Inicie sessão novamente.')
  })

  it('401 sans code : session expirée', async () => {
    repondre(JSON.stringify({ error: 'Non authentifié' }), 401)
    expect(await lireDocumentsDesChantiers()).toMatchObject({ ok: false, code: 'session_expiree' })
  })

  it('429 de la limite de débit (texte anglais, sans code) : traduit', async () => {
    repondre(JSON.stringify({ error: 'Too many requests. Please wait before retrying.' }), 429)

    const lu = await lireDocumentsDesChantiers()

    expect(lu).toMatchObject({ ok: false, code: 'trop_de_requetes' })
    if (lu.ok) throw new Error('lecture inattendue')
    expect(messageRefusDocuments(lu, true)).toBe('Demasiados pedidos em pouco tempo. Aguarde um minuto e tente novamente.')
  })

  it('réponse illisible (page d’erreur) : serveur injoignable', async () => {
    repondre('<html>502</html>', 502)
    expect(await lireDocumentsDesChantiers()).toMatchObject({ ok: false, code: 'reseau_indisponible' })
  })

  it('refus codé du serveur : son code et son texte, inchangés', async () => {
    repondre(JSON.stringify({ error: 'Accès refusé', code: 'aucun_droit_liaison' }), 403)
    expect(await lierDevisAuChantierSociete('devis-1', 'chantier-1')).toEqual({ ok: false, message: 'Accès refusé', code: 'aucun_droit_liaison' })
  })

  it('refus sans code mais avec un texte : le texte du serveur, sans code inventé', async () => {
    repondre(JSON.stringify({ error: 'Corps invalide' }), 400)
    expect(await lierDevisAuChantierSociete('devis-1', 'chantier-1')).toEqual({ ok: false, message: 'Corps invalide', code: undefined })
  })
})
