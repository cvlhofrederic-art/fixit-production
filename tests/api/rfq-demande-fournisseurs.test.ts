// @vitest-environment node
// tests/api/rfq-demande-fournisseurs.test.ts
//
// POST /api/rfq — « Devis fournisseurs » du tableau de bord BTP : la demande saisie part par e-mail, depuis l'adresse
// d'envoi de la plateforme, à chaque fournisseur actif du pays. Le serveur vérifie désormais :
//   - le compte : une société (rôle pro_societe, ou super admin), comme l'écran qui ne propose ce module qu'à elle ;
//   - le volume : une limite par minute et un plafond par 24 heures, par compte ;
//   - le corps : titre, message et lignes de longueur bornée, 100 lignes au plus ;
//   - le contenu : chaque valeur saisie est échappée dans l'e-mail (lib/email-rfq.ts), l'objet tient sur une ligne.
// La création ordinaire d'une demande par une société reste acceptée telle quelle. Le gabarit de l'e-mail est aussi
// appelé directement, sans la route, en fin de fichier. Données fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildSupplierEmailHTML } from '@/lib/email-rfq'
import type { RFQ, RFQItem } from '@/lib/rfq-types'

type Ligne = Record<string, unknown>
type Envoi = { to: string; subject: string; html: string }

const h = vi.hoisted(() => ({
  compte: null as unknown,
  fournisseurs: [] as Ligne[],
  insertions: [] as Array<{ table: string; donnees: unknown }>,
  clesRefusees: [] as string[],
  limites: [] as Array<{ cle: string; limite: number; fenetre: number }>,
  envois: [] as unknown[],
  /** Ligne d'équipe active d'un compte invité (pro_team_members), lue par resolveCompanyId. */
  equipe: [] as Ligne[],
  /** Filtres .eq posés sur chaque table : [table, colonne, valeur]. */
  filtres: [] as Array<[string, string, unknown]>,
}))

vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string, limite: number, fenetre: number) => {
    h.limites.push({ cle, limite, fenetre })
    return !h.clesRefusees.some((refusee) => cle.startsWith(refusee))
  }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async (message: unknown) => { h.envois.push(message); return { success: true, id: 'id-envoi' } }),
}))
// La route crée ses deux clients (clé publique pour lire la session, clé de service pour la base) par createClient.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => (h.compte ? { data: { user: h.compte }, error: null } : { data: { user: null }, error: { message: 'jeton invalide' } }) },
    from: (table: string) => {
      let insere: Ligne[] | null = null
      const lignes = (): Ligne[] => {
        if (insere) return insere.map((l, i) => ({ id: `${table}-${i + 1}`, ...(table === 'offers' ? { token: `jeton-${i + 1}` } : {}), ...l }))
        return table === 'suppliers' ? h.fournisseurs : []
      }
      const q: Record<string, unknown> = {}
      q.insert = (donnees: Ligne | Ligne[]) => {
        h.insertions.push({ table, donnees })
        insere = Array.isArray(donnees) ? donnees : [donnees]
        return q
      }
      q.select = () => q
      q.eq = (colonne: string, valeur: unknown) => { h.filtres.push([table, colonne, valeur]); return q }
      q.order = () => q
      q.single = async () => ({ data: lignes()[0] ?? null, error: null })
      q.maybeSingle = async () => ({ data: table === 'pro_team_members' ? h.equipe[0] ?? null : lignes()[0] ?? null, error: null })
      q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: lignes(), error: null }).then(ok, ko)
      return q
    },
  }),
}))

const ID_COMPTE = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const compte = (role: string, equipe?: string) => ({
  id: ID_COMPTE, email: 'societe@exemple.test', app_metadata: { role, ...(equipe ? { pro_team_role: equipe } : {}) }, user_metadata: {},
})

/** Le corps tel que l'écran « Devis fournisseurs » l'envoie. */
const corpsEcran = (sur: Record<string, unknown> = {}) => ({
  title: 'Chantier Marseille, lot 3',
  message: 'Livraison souhaitée sous 10 jours.',
  country: 'FR',
  items: [
    { product_name: 'Parpaing 20x20x50', product_ref: 'REF-001', category: 'gros_oeuvre', quantity: 120, unit: 'unité', notes: 'Sur palette' },
    { product_name: 'Ciment 35 kg', quantity: 12.5, unit: 'sac' },
  ],
  ...sur,
})

const { GET, POST } = await import('@/app/api/rfq/route')

const requete = (methode: 'GET' | 'POST', corps?: unknown) => new NextRequest('https://vitfix.io/api/rfq', {
  method: methode,
  headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
  ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
})
const creer = async (corps: unknown) => {
  const res = await POST(requete('POST', corps))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}
const envoi = (i = 0) => h.envois[i] as Envoi
const insertionsDe = (table: string) => h.insertions.filter((i) => i.table === table)

beforeEach(() => {
  // La route lit ces variables à chaque appel (clients créés à la demande).
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://base.exemple.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-publique-de-test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-de-service-de-test')
  h.compte = compte('pro_societe')
  h.fournisseurs = [
    { id: 'f1', name: 'Matériaux Pro', email: 'devis@fournisseur-un.test', country: 'FR', active: true },
    { id: 'f2', name: 'Négoce du Sud', email: 'contact@fournisseur-deux.test', country: 'FR', active: true },
  ]
  h.insertions = []
  h.clesRefusees = []
  h.limites = []
  h.envois = []
  h.equipe = []
  h.filtres = []
})
afterEach(() => { vi.unstubAllEnvs() })

describe('création ordinaire par une société (inchangée)', () => {
  it('201, la demande et ses lignes sont enregistrées, un e-mail par fournisseur actif', async () => {
    const res = await creer(corpsEcran())
    expect(res.status).toBe(201)
    expect(res.json.itemCount).toBe(2)
    expect(insertionsDe('rfqs')[0].donnees).toEqual({
      user_id: ID_COMPTE, title: 'Chantier Marseille, lot 3', message: 'Livraison souhaitée sous 10 jours.', country: 'FR', status: 'pending',
    })
    expect(insertionsDe('rfq_items')[0].donnees).toEqual([
      { product_name: 'Parpaing 20x20x50', product_ref: 'REF-001', category: 'gros_oeuvre', quantity: 120, unit: 'unité', notes: 'Sur palette', rfq_id: 'rfqs-1' },
      { product_name: 'Ciment 35 kg', quantity: 12.5, unit: 'sac', rfq_id: 'rfqs-1' },
    ])
    expect(h.envois.map((e) => (e as Envoi).to)).toEqual(['devis@fournisseur-un.test', 'contact@fournisseur-deux.test'])
    expect(envoi().subject).toBe('Nouvelle demande de devis — Chantier Marseille, lot 3')
    expect(envoi().html).toContain('Bonjour Matériaux Pro,')
    expect(envoi().html).toContain('Parpaing 20x20x50 (REF-001)')
    expect(envoi().html).toContain('/rfq/repondre/jeton-1"')
    expect(envoi(1).html).toContain('/rfq/repondre/jeton-2"')
  })

  // Depuis le 26/11/2026 le serveur lit le module « Devis fournisseurs » (rfq_btp) du rôle d'équipe : la secrétaire l'a,
  // le conducteur de travaux non (salarié de terrain, lib/permissions.ts). Avant, tout membre de l'équipe envoyait.
  it.each([['secrétaire de la société', compte('pro_societe', 'SECRETAIRE')], ['super admin', compte('super_admin')]])(
    '%s : 201', async (_cas, c) => {
      h.compte = c
      expect((await creer(corpsEcran())).status).toBe(201)
    })

  it('secrétaire invitée dans une société : la demande est rangée sous la société, que le gérant voit', async () => {
    const societe = '5c4b3a29-1807-4f6e-9d5c-4b3a29180700'
    h.compte = { id: '6d5c4b3a-2918-4e7f-8a6b-5c4b3a291801', email: 'secretaria@exemple.test', app_metadata: { role: 'pro_societe', pro_team_role: 'SECRETAIRE', company_id: societe }, user_metadata: {} }
    h.equipe = [{ id: 'membre-1', company_id: societe }]
    expect((await creer(corpsEcran())).status).toBe(201)
    expect(insertionsDe('rfqs')[0].donnees).toMatchObject({ user_id: societe })
  })

  it('secrétaire invitée : elle lit les demandes de la société, pas les siennes', async () => {
    const societe = '5c4b3a29-1807-4f6e-9d5c-4b3a29180702'
    h.compte = { id: '6d5c4b3a-2918-4e7f-8a6b-5c4b3a291803', email: 'secretaria@exemple.test', app_metadata: { role: 'pro_societe', pro_team_role: 'SECRETAIRE', company_id: societe }, user_metadata: {} }
    h.equipe = [{ id: 'membre-2', company_id: societe }]
    expect((await GET(requete('GET'))).status).toBe(200)
    expect(h.filtres.filter(([table]) => table === 'rfqs')).toEqual([['rfqs', 'user_id', societe]])
  })

  it('conducteur de travaux (module fermé par défaut) : 403, ni demande ni e-mail', async () => {
    h.compte = compte('pro_societe', 'CONDUCTEUR_TRAVAUX')
    expect((await creer(corpsEcran())).status).toBe(403)
    expect(insertionsDe('rfqs')).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })

  it('champs à leur longueur maximale, 100 lignes : 201', async () => {
    const ligne = { product_name: 'P'.repeat(200), product_ref: 'R'.repeat(100), category: 'C'.repeat(50), quantity: 1, unit: 'U'.repeat(30), notes: 'N'.repeat(500) }
    const res = await creer(corpsEcran({ title: 'T'.repeat(200), message: 'M'.repeat(2000), items: Array.from({ length: 100 }, () => ligne) }))
    expect(res.status).toBe(201)
  })

  it('sans session : 401, rien n\'est enregistré', async () => {
    h.compte = null
    expect((await creer(corpsEcran())).status).toBe(401)
    expect(h.insertions).toHaveLength(0)
  })
})

describe('compte : réservé aux sociétés', () => {
  it.each(['artisan', 'client', 'particulier', 'syndic', 'coproprio', ''])(
    'rôle « %s » : 403, rien n\'est enregistré, aucun e-mail', async (role) => {
      h.compte = compte(role)
      const res = await creer(corpsEcran())
      expect(res.status).toBe(403)
      expect(res.json.error).toMatch(/réservées aux sociétés/)
      expect(h.insertions).toHaveLength(0)
      expect(h.envois).toHaveLength(0)
    })

  it('la lecture de ses propres demandes (GET) n\'est pas concernée', async () => {
    h.compte = compte('artisan')
    expect((await GET(requete('GET'))).status).toBe(200)
  })
})

describe('volume : limite par minute et plafond par 24 heures, par compte', () => {
  it('les deux compteurs portent le compte', async () => {
    await creer(corpsEcran())
    expect(h.limites).toEqual([
      { cle: `rfq_post_${ID_COMPTE}`, limite: 5, fenetre: 60_000 },
      { cle: `rfq_post_jour_${ID_COMPTE}`, limite: 20, fenetre: 24 * 60 * 60 * 1000 },
    ])
  })

  it('limite par minute atteinte : 429, rien n\'est enregistré, aucun e-mail', async () => {
    h.clesRefusees = [`rfq_post_${ID_COMPTE}`]
    expect((await creer(corpsEcran())).status).toBe(429)
    expect(h.insertions).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })

  it('plafond des 24 heures atteint : 429 avec un message en français, rien n\'est enregistré, aucun e-mail', async () => {
    h.clesRefusees = ['rfq_post_jour_']
    const res = await creer(corpsEcran())
    expect(res.status).toBe(429)
    expect(res.json.error).toMatch(/20 demandes par 24 heures/)
    expect(h.insertions).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })

  it('une demande refusée (corps invalide) ne consomme pas le plafond des 24 heures', async () => {
    await creer(corpsEcran({ title: '' }))
    expect(h.limites.filter((l) => l.cle.startsWith('rfq_post_jour_'))).toHaveLength(0)
  })
})

describe('corps : longueurs bornées', () => {
  const ligne = (sur: Record<string, unknown> = {}) => ({ product_name: 'Parpaing', quantity: 1, unit: 'unité', ...sur })

  it.each([
    ['titre de 201 caractères', { title: 'T'.repeat(201) }],
    ['message de 2 001 caractères', { message: 'M'.repeat(2001) }],
    ['101 lignes', { items: Array.from({ length: 101 }, () => ligne()) }],
    ['nom de produit de 201 caractères', { items: [ligne({ product_name: 'P'.repeat(201) })] }],
    ['référence de 101 caractères', { items: [ligne({ product_ref: 'R'.repeat(101) })] }],
    ['catégorie de 51 caractères', { items: [ligne({ category: 'C'.repeat(51) })] }],
    ['unité de 31 caractères', { items: [ligne({ unit: 'U'.repeat(31) })] }],
    ['notes de 501 caractères', { items: [ligne({ notes: 'N'.repeat(501) })] }],
  ])('%s : 400, rien n\'est enregistré, aucun e-mail', async (_cas, sur) => {
    const res = await creer(corpsEcran(sur))
    expect(res.status).toBe(400)
    expect(h.insertions).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })
})

describe('contenu de l\'e-mail aux fournisseurs', () => {
  const balise = (champ: string) => `<b data-champ="${champ}">&'</b>`
  const echappee = (champ: string) => `&lt;b data-champ=&quot;${champ}&quot;&gt;&amp;&#039;&lt;/b&gt;`

  it.each(['FR', 'PT'])('pays %s : chaque valeur saisie est échappée, aucune ne devient du balisage', async (country) => {
    h.fournisseurs = [{ id: 'f1', name: balise('name'), email: 'devis@fournisseur-un.test', country, active: true }]
    const res = await creer({
      title: balise('title'), message: balise('message'), country,
      items: [{ product_name: balise('product_name'), product_ref: balise('product_ref'), category: balise('category'), quantity: 2, unit: 'u', notes: balise('notes') }],
    })
    expect(res.status).toBe(201)
    expect(envoi().html).not.toMatch(/<b data-champ=/)
    for (const champ of ['title', 'message', 'product_name', 'product_ref', 'category', 'notes', 'name']) {
      expect(envoi().html, champ).toContain(echappee(champ))
    }
  })

  it('objet sur une seule ligne', async () => {
    await creer(corpsEcran({ title: 'Chantier\r\nMarseille' }))
    expect(envoi().subject).toBe('Nouvelle demande de devis — Chantier Marseille')
  })
})

describe.each(['FR', 'PT'] as const)('gabarit lib/email-rfq.ts appelé directement, pays %s', (country) => {
  const balise = (champ: string) => `<b data-champ="${champ}">&'</b>`
  const echappee = (champ: string) => `&lt;b data-champ=&quot;${champ}&quot;&gt;&amp;&#039;&lt;/b&gt;`
  const rfq = (sur: Partial<RFQ> = {}): RFQ => ({
    id: 'r1', user_id: 'u1', country, status: 'pending', title: balise('title'), message: balise('message'),
    created_at: '', updated_at: '', ...sur,
  })
  const ligne: RFQItem = {
    id: 'i1', rfq_id: 'r1', product_name: balise('product_name'), product_ref: balise('product_ref'),
    category: balise('category'), quantity: 3, unit: balise('unit'), notes: balise('notes'),
  }

  it('chaque valeur est échappée, unité et nom du fournisseur compris : aucune ne devient du balisage', () => {
    const html = buildSupplierEmailHTML(rfq(), [ligne], 'a'.repeat(64), balise('supplierName'))
    expect(html).not.toMatch(/<b data-champ=/)
    for (const champ of ['title', 'message', 'product_name', 'product_ref', 'category', 'unit', 'notes', 'supplierName']) {
      expect(html, champ).toContain(echappee(champ))
    }
  })

  it('une demande ordinaire garde son texte et son lien de réponse', () => {
    const html = buildSupplierEmailHTML(
      rfq({ title: 'Chantier Marseille, lot 3', message: 'Livraison sous 10 jours.' }),
      [{ id: 'i1', rfq_id: 'r1', product_name: 'Parpaing 20x20x50', product_ref: 'REF-001', quantity: 120, unit: 'unité' }],
      'a'.repeat(64),
      'Matériaux Pro',
    )
    expect(html).toContain('Chantier Marseille, lot 3')
    expect(html).toContain('Livraison sous 10 jours.')
    expect(html).toContain('Parpaing 20x20x50 (REF-001)')
    expect(html).toContain('120 unité')
    expect(html).toMatch(/<a href="[^"<>]*\/rfq\/repondre\/a{64}" style=/)
  })
})
