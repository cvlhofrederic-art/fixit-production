// tests/api/user-export-data-btp.test.ts
//
// GET /api/user/export-data (RGPD art. 20) — lot RGPD du BTP pro (audit du 11/11/2026, constat stockage-local-miroir-13) :
// l'export d'une société BTP (rôle pro_societe) contient aussi la sauvegarde du stockage du navigateur (user_storage)
// et les tables du BTP de la société (colonne propriétaire relevée en production le 11/11/2026), lues page par page,
// sans aucune ligne d'un autre compte ni jeton d'invitation. Lecture seule. Une table absente donne une liste vide ;
// une lecture en panne fait échouer l'export (500) plutôt que de rendre un export incomplet présenté comme complet.
// Les autres rôles gardent leur export (règle n° 1 artisan / BTP).
// Données fictives : @exemple.test.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/vitfixsignal-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/vitfixsignal-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/vitfixsignal-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/vitfixsignal-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/vitfixsignal-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/vitfixsignal-routes')).mockLogger())

const { baseQr } = await import('../helpers/vitfixsignal-base')
const { reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/vitfixsignal-routes')
const { GET } = await import('@/app/api/user/export-data/route')
const { reinitialiserReplisQr } = await import('@/lib/vitfixsignal/serveur')

/** Clés de l'export rendu à tout compte avant ce lot (tests/api/user-export-data.test.ts). */
const CLES_EXPORT = [
  'artisan_photos', 'artisan_profile', 'bookings_as_artisan', 'bookings_as_client', 'client_profile', 'devis', 'exported_at', 'factures',
  'messages', 'pt_fiscal_documents', 'pt_fiscal_series', 'rgpd_article', 'services', 'subscription', 'syndic', 'user',
]
const SECTIONS_BTP = [
  'chantiers', 'charges_fixes', 'dc4', 'dce_analyses', 'depenses', 'dpgf', 'equipe_membres', 'equipes', 'marches_candidatures', 'membres',
  'outillage', 'pointage_reglages', 'pointages', 'rapports', 'retenues', 'settings', 'situations', 'team', 'verifications_outillage',
]
const trie = (v: string[]) => [...v].sort((a, b) => a.localeCompare(b))

const SOCIETE = { id: '0d000000-0000-4000-8000-000000000001', email: 'societe@exemple.test', app_metadata: { role: 'pro_societe' } }
const AUTRE = '0d000000-0000-4000-8000-000000000009'
const ARTISAN = { id: '0a000000-0000-4000-8000-000000000001', email: 'artisan@exemple.test', app_metadata: { role: 'artisan' } }
const id = (prefixe: string, n: number) => `${prefixe}000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const POINTAGES_SOCIETE = 1001
// pointage_reglages_btp (migration 20261116, pointage géolocalisé) : une ligne par société, clé primaire owner_id,
// pas de colonne id.
const REGLAGES_POINTAGE_SOCIETE = {
  owner_id: SOCIETE.id, auto_active: true, confirme_le: '2026-11-16T08:00:00Z', confirme_par: SOCIETE.id, modifie_le: '2026-11-16T08:00:00Z',
}

const exporter = async () => {
  const res = await GET(requeteQr('/api/user/export-data'))
  const texte = await res.text()
  return { status: res.status, texte, corps: JSON.parse(texte) as Record<string, unknown> }
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  baseQr.etat.maxLignes = 1000 // max-rows de PostgREST : une réponse plus longue est coupée en silence
  simulQr.user = SOCIETE
  const t = baseQr.etat.tables
  t.chantiers_btp = [
    { id: id('c1', 1), owner_id: SOCIETE.id, titre: 'Chantier Exemple', client: 'Client Exemple' },
    { id: id('c1', 2), owner_id: AUTRE, titre: 'Chantier d’une autre société' },
  ]
  t.membres_btp = [
    { id: id('a1', 1), owner_id: SOCIETE.id, prenom: 'Jean', nom: 'Exemple', telephone: '0600000000', salaire_brut_mensuel: 2000 },
    { id: id('a1', 2), owner_id: AUTRE, prenom: 'Salarié', nom: 'Ailleurs' },
  ]
  t.equipes_btp = [
    { id: id('e1', 1), owner_id: SOCIETE.id, nom: 'Équipe Exemple' },
    { id: id('e1', 2), owner_id: AUTRE, nom: 'Équipe d’une autre société' },
  ]
  t.equipe_membres_btp = [
    { equipe_id: id('e1', 1), membre_id: id('a1', 1) },
    { equipe_id: id('e1', 2), membre_id: id('a1', 2) },
  ]
  t.pointages_btp = [
    ...Array.from({ length: POINTAGES_SOCIETE }, (_v, i) => ({ id: id('b1', i + 1), owner_id: SOCIETE.id, employe: 'Jean Exemple', date: '2026-11-02', heure_arrivee: '08:00' })),
    { id: id('b1', 9999), owner_id: AUTRE, employe: 'Salarié Ailleurs', date: '2026-11-02', heure_arrivee: '08:00' },
  ]
  t.situations_btp = [{ id: id('d1', 1), owner_id: SOCIETE.id, chantier: 'Chantier Exemple', numero: 1 }]
  t.retenues_btp = [{ id: id('d2', 1), owner_id: SOCIETE.id, chantier: 'Chantier Exemple' }]
  t.dc4_btp = [{ id: id('d3', 1), owner_id: SOCIETE.id, entreprise: 'Sous-traitant Exemple' }]
  t.dpgf_btp = [{ id: id('d4', 1), owner_id: SOCIETE.id, titre: 'DPGF Exemple' }]
  t.depenses_btp = [{ id: id('d5', 1), owner_id: SOCIETE.id, label: 'Ciment', amount: 120 }]
  t.dce_analyses_btp = [{ id: id('d6', 1), owner_id: SOCIETE.id, titre: 'Analyse Exemple' }]
  t.rapports_btp = [{ id: id('d7', 1), owner_id: SOCIETE.id, titre: 'Rapport Exemple' }]
  // Outillage et vérifications du vendredi (migration 20261126).
  t.outillage_btp = [{ id: id('d9', 1), owner_id: SOCIETE.id, type: 'outil', nom: 'Perforateur Exemple' }, { id: id('d9', 2), owner_id: AUTRE, type: 'outil', nom: 'Outil ailleurs' }]
  t.verifications_outillage_btp = [{ id: id('da', 1), owner_id: SOCIETE.id, chantier_titre: 'Chantier Exemple', vendredi: '2026-11-27', lignes: [] }]
  t.charges_fixes = [{ id: id('d8', 1), owner_id: SOCIETE.id, label: 'Assurance', montant: 100 }, { id: id('d8', 2), owner_id: AUTRE, label: 'Loyer ailleurs', montant: 900 }]
  t.settings_btp = [{ owner_id: SOCIETE.id, depot_adresse: '1 rue Exemple' }, { owner_id: AUTRE, depot_adresse: '9 rue Ailleurs' }]
  t.pointage_reglages_btp = [
    { ...REGLAGES_POINTAGE_SOCIETE },
    { owner_id: AUTRE, auto_active: true, confirme_le: '2026-11-15T07:00:00Z', confirme_par: AUTRE, modifie_le: '2026-11-15T07:00:00Z' },
  ]
  t.marches_candidatures = [{ id: id('d9', 1), artisan_user_id: SOCIETE.id, price: 1000 }]
  t.pro_team_members = [
    { id: id('f1', 1), company_id: SOCIETE.id, user_id: SOCIETE.id, email: 'societe@exemple.test', full_name: 'Gérant Exemple', role: 'GERANT', invite_token: null },
    { id: id('f1', 2), company_id: SOCIETE.id, user_id: null, email: 'ouvrier@exemple.test', full_name: 'Ouvrier Exemple', role: 'OUVRIER', invite_token: 'jeton-invitation-secret' },
    { id: id('f1', 3), company_id: AUTRE, user_id: null, email: 'autre@exemple.test', full_name: 'Autre Exemple', role: 'OUVRIER' },
  ]
  t.user_storage = [
    { user_id: SOCIETE.id, key: 'fixit_documents_x', value: [{ id: 'doc-1', docNumber: 'FACT-2026-0001' }], updated_at: '2026-11-10T09:00:00Z' },
    { user_id: SOCIETE.id, key: 'fixit_manual_clients_x', value: [{ nom: 'Client Exemple' }], updated_at: '2026-11-09T09:00:00Z' },
    { user_id: AUTRE, key: 'fixit_documents_y', value: [{ id: 'doc-ailleurs' }], updated_at: '2026-11-10T09:00:00Z' },
  ]
})

describe('export d’une société BTP (pro_societe)', () => {
  it('ajoute la sauvegarde du stockage du navigateur et les tables du BTP de la société, sans aucune ligne d’un autre compte', async () => {
    const { status, texte, corps } = await exporter()
    expect(status).toBe(200)
    expect(trie(Object.keys(corps))).toEqual(trie([...CLES_EXPORT, 'btp', 'user_storage']))
    expect(corps.user_storage).toEqual([
      { key: 'fixit_documents_x', value: [{ id: 'doc-1', docNumber: 'FACT-2026-0001' }], updated_at: '2026-11-10T09:00:00Z' },
      { key: 'fixit_manual_clients_x', value: [{ nom: 'Client Exemple' }], updated_at: '2026-11-09T09:00:00Z' },
    ])
    const btp = corps.btp as Record<string, Array<Record<string, unknown>>>
    expect(trie(Object.keys(btp))).toEqual(trie(SECTIONS_BTP))
    expect(btp.chantiers.map((l) => l.titre)).toEqual(['Chantier Exemple'])
    expect(btp.membres).toEqual([expect.objectContaining({ prenom: 'Jean', nom: 'Exemple', telephone: '0600000000', salaire_brut_mensuel: 2000 })])
    expect(btp.equipes.map((l) => l.nom)).toEqual(['Équipe Exemple'])
    expect(btp.equipe_membres).toEqual([{ equipe_id: id('e1', 1), membre_id: id('a1', 1) }])
    for (const section of ['situations', 'retenues', 'dc4', 'dpgf', 'depenses', 'dce_analyses', 'rapports', 'marches_candidatures', 'outillage', 'verifications_outillage']) {
      expect(btp[section], section).toHaveLength(1)
    }
    expect(btp.charges_fixes.map((l) => l.label)).toEqual(['Assurance'])
    expect(btp.settings).toEqual([{ owner_id: SOCIETE.id, depot_adresse: '1 rue Exemple' }])
    expect(btp.pointage_reglages).toEqual([REGLAGES_POINTAGE_SOCIETE])
    expect(btp.team.map((m) => m.email)).toEqual(['societe@exemple.test', 'ouvrier@exemple.test'])
    for (const membre of btp.team) expect(membre).not.toHaveProperty('invite_token')
    for (const donnee of ['Chantier d’une autre société', 'Ailleurs', 'Équipe d’une autre société', 'doc-ailleurs', 'autre@exemple.test', 'Loyer ailleurs', 'Outil ailleurs', 'jeton-invitation-secret']) {
      expect(texte).not.toContain(donnee)
    }
  })

  it('plus de 1 000 lignes dans une table : toutes exportées (lecture page par page)', async () => {
    const { corps } = await exporter()
    const pointages = (corps.btp as Record<string, unknown[]>).pointages
    expect(pointages).toHaveLength(POINTAGES_SOCIETE)
    expect(baseQr.etat.lectures.filter((l) => l.table === 'pointages_btp').length).toBeGreaterThan(1)
  })

  it('sous-compte d’une société : sa propre fiche d’équipe est exportée', async () => {
    simulQr.user = { id: id('0e', 7), email: 'chef@exemple.test', app_metadata: { role: 'pro_societe', pro_team_role: 'CHEF_CHANTIER' } }
    baseQr.etat.tables.pro_team_members.push({ id: id('f1', 4), company_id: SOCIETE.id, user_id: id('0e', 7), email: 'chef@exemple.test', full_name: 'Chef Exemple', role: 'CHEF_CHANTIER', invite_token: null })
    const { corps } = await exporter()
    const btp = corps.btp as Record<string, Array<Record<string, unknown>>>
    expect(btp.team.map((m) => m.email)).toEqual(['chef@exemple.test'])
    expect(btp.chantiers).toEqual([])
  })

  it('table du BTP absente de la base : section vide, export rendu (200)', async () => {
    baseQr.etat.tablesAbsentes = ['rapports_btp', 'equipe_membres_btp', 'pointage_reglages_btp']
    baseQr.etat.codeTableAbsente = 'PGRST205'
    const { status, corps } = await exporter()
    expect(status).toBe(200)
    const btp = corps.btp as Record<string, unknown[]>
    expect(btp.rapports).toEqual([])
    expect(btp.equipe_membres).toEqual([])
    expect(btp.pointage_reglages).toEqual([])
    expect(btp.chantiers).toHaveLength(1)
  })

  it('réglages du pointage lus triés par owner_id : la table n’a pas de colonne id (un tri sur id ferait échouer l’export)', async () => {
    const tris: string[] = []
    const from = baseQr.client.from
    const espion = vi.spyOn(baseQr.client, 'from').mockImplementation((table: string) => {
      const requete = from(table)
      if (table === 'pointage_reglages_btp') {
        const order = requete.order as (colonne: string, options?: unknown) => unknown
        requete.order = (colonne: string, options?: unknown) => {
          tris.push(colonne)
          return order(colonne, options)
        }
      }
      return requete
    })
    try {
      expect((await exporter()).status).toBe(200)
    } finally {
      espion.mockRestore()
    }
    expect(tris).toEqual(['owner_id'])
  })

  it.each(['chantiers_btp', 'user_storage', 'pro_team_members', 'pointage_reglages_btp'])('lecture de %s en panne : 500, jamais un export incomplet présenté comme complet', async (table) => {
    baseQr.etat.erreursPonctuelles[table] = { code: 'XX000', message: 'panne' }
    const { status } = await exporter()
    expect(status).toBe(500)
  })
})

describe('autres comptes : export inchangé', () => {
  it('compte artisan : aucune section BTP ni sauvegarde du stockage du navigateur', async () => {
    simulQr.user = ARTISAN
    baseQr.etat.tables.user_storage.push({ user_id: ARTISAN.id, key: 'fixit_documents_z', value: [{ id: 'doc-artisan' }], updated_at: '2026-11-10T09:00:00Z' })
    const { status, corps } = await exporter()
    expect(status).toBe(200)
    expect(trie(Object.keys(corps))).toEqual(CLES_EXPORT)
    expect(baseQr.etat.lectures.filter((l) => l.table === 'user_storage' || l.table.endsWith('_btp'))).toEqual([])
  })
})
