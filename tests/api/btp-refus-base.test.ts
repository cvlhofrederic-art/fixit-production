// @vitest-environment node
// tests/api/btp-refus-base.test.ts — POST /api/btp quand la base refuse l'écriture (constats donnees-btp-12,
// base-de-donnees-13 et api-coeur-15 pour la partie /api/btp, 15/11/2026).
//
// Avant : tout refus de la base devenait « Erreur serveur ». Supprimer un chantier auquel une situation, une retenue,
// un sous-traitant, un devis ou une facture est rattaché échouait sans que l'on sache pourquoi.
// Maintenant : le refus est traduit en message clair (409 pour une suppression bloquée par une fiche rattachée,
// 404 pour une fiche introuvable, 400 pour une valeur refusée). Le détail brut de la base, qui peut contenir les
// valeurs de la ligne, ne part jamais vers le navigateur.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; app_metadata?: Record<string, unknown> },
}))

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})

const { POST } = await import('@/app/api/btp/route')
const { nouvelleBase } = await import('../helpers/faux-supabase-btp')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const CHANTIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const MEMBRE = 'd4d4d4d4-0000-4000-8000-000000000001'

const poster = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  const texte = await res.text()
  return { status: res.status, texte, json: JSON.parse(texte) as Record<string, unknown> }
}

/** Refus de suppression tel que PostgreSQL le formule (clé étrangère sans règle de suppression). */
const refusCleEtrangere = (supprimee: string, rattachee: string) => ({
  code: '23503',
  message: `update or delete on table "${supprimee}" violates foreign key constraint "${rattachee}_chantier_id_fkey" on table "${rattachee}"`,
  details: `Key (id)=(${CHANTIER}) is still referenced from table "${rattachee}".`,
})

beforeEach(() => {
  h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
  h.base = nouvelleBase({
    chantiers_btp: [{ id: CHANTIER, owner_id: SOCIETE, titre: 'Rénovation cuisine' }],
    membres_btp: [{ id: MEMBRE, owner_id: SOCIETE, prenom: 'Paul', nom: 'Durand' }],
  })
})

describe('POST /api/btp — suppression d’un chantier refusée par la base', () => {
  const CAS: Array<[string, string]> = [
    ['situations_btp', 'une situation de travaux y est rattachée'],
    ['retenues_btp', 'une retenue de garantie y est rattachée'],
    ['dc4_btp', 'un sous-traitant (DC4) y est rattaché'],
    ['devis', 'un devis y est rattaché'],
    ['factures', 'une facture y est rattachée'],
  ]

  for (const [rattachee, raison] of CAS) {
    it(`${rattachee} rattaché : 409 « Ce chantier ne peut pas être supprimé : ${raison}. »`, async () => {
      h.base.erreurs.push({ table: 'chantiers_btp', operation: 'delete', erreur: refusCleEtrangere('chantiers_btp', rattachee) })

      const res = await poster({ table: 'chantiers_btp', action: 'delete', id: CHANTIER })

      expect(res.status).toBe(409)
      expect(res.json).toEqual({ error: `Ce chantier ne peut pas être supprimé : ${raison}.` })
      expect(h.base.lignes.chantiers_btp).toHaveLength(1)
    })
  }

  it('fiche rattachée non reconnue dans le message : refus clair quand même', async () => {
    h.base.erreurs.push({ table: 'chantiers_btp', operation: 'delete', erreur: { code: '23503', message: 'foreign key violation' } })
    const res = await poster({ table: 'chantiers_btp', action: 'delete', id: CHANTIER })
    expect(res.status).toBe(409)
    expect(res.json.error).toBe('Ce chantier ne peut pas être supprimé : d\'autres données y sont rattachées.')
  })

  it('membre de l’équipe encore cité par un pointage : 409 avec le bon sujet', async () => {
    h.base.erreurs.push({
      table: 'membres_btp', operation: 'delete',
      erreur: { code: '23503', message: 'update or delete on table "membres_btp" violates foreign key constraint "pointages_btp_membre_id_fkey" on table "pointages_btp"' },
    })
    const res = await poster({ table: 'membres_btp', action: 'delete', id: MEMBRE })
    expect(res.status).toBe(409)
    expect(res.json.error).toBe('Ce membre de l\'équipe ne peut pas être supprimé : un pointage y est rattaché.')
  })
})

describe('POST /api/btp — autres refus de la base', () => {
  it('modification d’une fiche introuvable (supprimée, ou d’un autre compte) : 404', async () => {
    const res = await poster({ table: 'chantiers_btp', action: 'update', id: 'f0f0f0f0-0000-4000-8000-000000000009', data: { statut: 'Terminé' } })
    expect(res.status).toBe(404)
    expect(res.json.error).toMatch(/Fiche introuvable/)
  })

  it('valeur refusée par une contrainte de la base : 400 qui nomme le champ', async () => {
    h.base.erreurs.push({
      table: 'chantiers_btp', operation: 'insert',
      erreur: { code: '23514', message: 'new row for relation "chantiers_btp" violates check constraint "chantiers_btp_statut_check"', details: 'Failing row contains (Rénovation, M. Martin, 06 00 00 00 00).' },
    })
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Rénovation', statut: 'Archivé' } })
    expect(res.status).toBe(400)
    expect(res.json.error).toBe('Enregistrement refusé : valeur non autorisée pour statut.')
    expect(res.texte).not.toMatch(/Failing row|06 00 00/)
  })

  it('champ obligatoire selon la base : 400 qui le nomme, sans les valeurs de la ligne', async () => {
    h.base.erreurs.push({
      table: 'pointages_btp', operation: 'insert',
      erreur: { code: '23502', message: 'null value in column "employe" of relation "pointages_btp" violates not-null constraint', details: 'Failing row contains (Paul Durand, 2026-11-15).' },
    })
    const res = await poster({ table: 'pointages_btp', action: 'insert', data: { employe: 'Paul Durand', date: '2026-11-15', heure_arrivee: '08:00' } })
    expect(res.status).toBe(400)
    expect(res.json.error).toBe('Enregistrement refusé : champ obligatoire manquant (employe).')
    expect(res.texte).not.toMatch(/Failing row/)
  })

  it('valeur au mauvais format selon la base (date impossible) : 400', async () => {
    h.base.erreurs.push({ table: 'chantiers_btp', operation: 'insert', erreur: { code: '22008', message: 'date/time field value out of range: "2026-02-31"' } })
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture', date_debut: '2026-02-31' } })
    expect(res.status).toBe(400)
    expect(res.json.error).toMatch(/bon format/)
    expect(res.texte).not.toMatch(/2026-02-31/)
  })

  it('fiche déjà existante (unicité) : 409', async () => {
    h.base.erreurs.push({ table: 'charges_fixes', operation: 'insert', erreur: { code: '23505', message: 'duplicate key value violates unique constraint "charges_fixes_pkey"' } })
    const res = await poster({ table: 'charges_fixes', action: 'insert', data: { label: 'Loyer', montant: 900, frequence: 'mensuel', categorie: 'loyer' } })
    expect(res.status).toBe(409)
    expect(res.json.error).toMatch(/existe déjà/)
  })

  it('témoin : panne quelconque, toujours « Erreur serveur », sans détail interne', async () => {
    h.base.erreurs.push({ table: 'chantiers_btp', operation: 'insert', erreur: { code: '57014', message: 'canceling statement due to statement timeout' } })
    const res = await poster({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Toiture' } })
    expect(res.status).toBe(500)
    expect(res.json).toEqual({ error: 'Erreur serveur' })
  })
})
