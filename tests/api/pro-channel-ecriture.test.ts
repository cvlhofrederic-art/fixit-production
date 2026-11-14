// @vitest-environment node
// tests/api/pro-channel-ecriture.test.ts
//
// POST /api/pro/channel — écriture d'un message du « Canal Pro » (écran hors menu du tableau de bord pro), dans la
// table de messagerie partagée avec le Syndic. Deux limites côté serveur :
//   - le type du message appartient à la liste que l'écran connaît ;
//   - le destinataire est un prestataire déjà enregistré par l'expéditeur (même règle que la messagerie
//     Syndic ↔ prestataires), ou l'expéditeur lui-même.
// Aucune donnée réelle : comptes d'exemple.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const EXPEDITEUR = '11111111-1111-4111-8111-111111111111'
const PRESTATAIRE = '22222222-2222-4222-8222-222222222222'
const INCONNU = '33333333-3333-4333-8333-333333333333'

type Compte = { id: string; email: string; app_metadata: { role: string }; user_metadata: Record<string, unknown> }

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  user: null as null | Compte,
}))

vi.mock('@/lib/auth-helpers', async (original) => ({
  ...(await original<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) } }))

const { POST } = await import('@/app/api/pro/channel/route')

const ecrire = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/pro/channel', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as { message?: Record<string, unknown>; error?: string } }
}

const messageEcrit = () => appelsDe(h.base, 'syndic_messages', 'insert')[0]?.donnees as Record<string, unknown> | undefined

beforeEach(() => {
  h.base = nouvelleBase()
  h.user = { id: EXPEDITEUR, email: 'societe@exemple.test', app_metadata: { role: 'pro_societe' }, user_metadata: { company_name: 'Société Exemple' } }
  h.base.lignes.syndic_artisans = [{ id: 'fiche-1', cabinet_id: EXPEDITEUR, artisan_user_id: PRESTATAIRE }]
})

describe('POST /api/pro/channel — destinataire', () => {
  it('compte sans lien avec l’expéditeur : 403, rien n’est écrit', async () => {
    const res = await ecrire({ content: 'Bonjour', contact_id: INCONNU })
    expect(res.status).toBe(403)
    expect(appelsDe(h.base, 'syndic_messages', 'insert')).toHaveLength(0)
  })

  it('le lien se lit dans les prestataires enregistrés par l’expéditeur', async () => {
    await ecrire({ content: 'Bonjour', contact_id: INCONNU })
    const [controle] = appelsDe(h.base, 'syndic_artisans', 'select')
    expect(controle.eq).toEqual(expect.arrayContaining([['cabinet_id', EXPEDITEUR], ['artisan_user_id', INCONNU]]))
  })

  it('lecture du lien en erreur : 500, rien n’est écrit', async () => {
    h.base.erreurs['syndic_artisans.select'] = { message: 'panne' }
    const res = await ecrire({ content: 'Bonjour', contact_id: PRESTATAIRE })
    expect(res.status).toBe(500)
    expect(appelsDe(h.base, 'syndic_messages', 'insert')).toHaveLength(0)
  })

  it('prestataire enregistré par l’expéditeur : message écrit à son intention', async () => {
    const res = await ecrire({ content: '  Rendez-vous lundi  ', contact_id: PRESTATAIRE })
    expect(res.status).toBe(200)
    expect(messageEcrit()).toMatchObject({
      cabinet_id: EXPEDITEUR, artisan_user_id: PRESTATAIRE, sender_id: EXPEDITEUR, sender_role: 'pro_societe',
      content: 'Rendez-vous lundi', type: 'text',
    })
  })

  it('sans destinataire : message écrit pour soi, sans contrôle de lien', async () => {
    const res = await ecrire({ content: 'Note' })
    expect(res.status).toBe(200)
    expect(messageEcrit()).toMatchObject({ cabinet_id: EXPEDITEUR, artisan_user_id: EXPEDITEUR })
    expect(appelsDe(h.base, 'syndic_artisans')).toHaveLength(0)
  })
})

describe('POST /api/pro/channel — type du message', () => {
  it.each(['systeme', 'autre', 'inconnu'])('type « %s », inconnu de l’écran : 400, rien n’est écrit', async (type) => {
    const res = await ecrire({ content: 'Bonjour', contact_id: PRESTATAIRE, type })
    expect(res.status).toBe(400)
    expect(appelsDe(h.base, 'syndic_messages', 'insert')).toHaveLength(0)
  })

  // Types envoyés par l'écran (texte, raccourcis et commandes vocales) et types qu'il sait afficher.
  it.each(['text', 'voice', 'voice_location', 'voice_status', 'voice_alert', 'voice_devis', 'file', 'photo', 'rapport', 'devis'])('type « %s » : accepté', async (type) => {
    const res = await ecrire({ content: 'En route vers le chantier', contact_id: PRESTATAIRE, type, metadata: { original: 'en route' } })
    expect(res.status).toBe(200)
    expect(messageEcrit()).toMatchObject({ type, metadata: JSON.stringify({ original: 'en route' }) })
  })
})

describe('POST /api/pro/channel — contrôles inchangés', () => {
  it('401 sans session ; 403 pour un compte qui n’est pas professionnel ; 400 pour un texte vide', async () => {
    expect((await ecrire({ content: '   ', contact_id: PRESTATAIRE })).status).toBe(400)
    h.user = { id: EXPEDITEUR, email: 'client@exemple.test', app_metadata: { role: 'client' }, user_metadata: {} }
    expect((await ecrire({ content: 'Bonjour' })).status).toBe(403)
    h.user = null
    expect((await ecrire({ content: 'Bonjour' })).status).toBe(401)
    expect(appelsDe(h.base, 'syndic_messages', 'insert')).toHaveLength(0)
  })
})
