// @vitest-environment node
// tests/api/pro-equipe-invitation-email.test.ts
//
// POST /api/pro/team — invitation d'un membre par le gérant d'une société BTP : l'e-mail part de l'adresse d'envoi de
// la plateforme, avec le nom de l'invité (saisi par le gérant) et le nom de la société (que le compte renseigne
// lui-même). Le serveur :
//   - échappe ces valeurs dans le HTML (gabarit réel de lib/email.ts, seul l'envoi est simulé) ;
//   - ramène le nom de la société à une ligne de 200 caractères au plus, pour le corps comme pour l'objet ;
//   - plafonne les invitations par compte et par 24 heures, avant toute écriture.
// L'invitation ordinaire reste envoyée telle quelle. Le lien signé et l'acceptation sont couverts par
// tests/api/equipe-invitation.test.ts. Données fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

type Envoi = { to: string; subject: string; html: string; tags?: unknown }

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  compte: null as unknown,
  clesRefusees: [] as string[],
  limites: [] as Array<{ cle: string; limite: number; fenetre: number }>,
  envois: [] as unknown[],
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string, limite: number, fenetre: number) => {
    h.limites.push({ cle, limite, fenetre })
    return !h.clesRefusees.some((refusee) => cle.startsWith(refusee))
  }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
// Gabarits réels : seul l'envoi est simulé.
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  sendEmail: vi.fn(async (message: unknown) => { h.envois.push(message); return { success: true, id: 'id-envoi' } }),
}))
// Rôles réels (isProSocieteRole, isProGerant) : seule la lecture de la session est simulée.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.compte),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: (table: string) => clientMemoire(h.base).from(table) },
}))

const { POST } = await import('@/app/api/pro/team/route')

const ID_SOCIETE = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const gerant = (metadonnees: Record<string, unknown> = { company_name: 'Bâtiment Durand SARL' }) => ({
  id: ID_SOCIETE, email: 'gerant@exemple.test', app_metadata: { role: 'pro_societe' }, user_metadata: metadonnees,
})

const inviter = async (sur: Record<string, unknown> = {}) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/pro/team', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'claire@exemple.test', full_name: 'Claire Martin', memberRole: 'CONDUCTEUR_TRAVAUX', ...sur }),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}
const envoi = (i = 0) => h.envois[i] as Envoi
const ecritures = () => h.base.appels.filter((a) => a.op !== 'select')

let cleAvant: string | undefined
beforeEach(() => {
  cleAvant = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-service-de-test'
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  h.base = nouvelleBase()
  h.compte = gerant()
  h.clesRefusees = []
  h.limites = []
  h.envois = []
})
afterEach(() => {
  vi.unstubAllEnvs()
  if (cleAvant === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = cleAvant
})

describe('invitation ordinaire (inchangée)', () => {
  it('200, un e-mail à l\'adresse invitée, avec le texte, l\'objet et le lien d\'avant', async () => {
    const res = await inviter()
    expect(res.status).toBe(200)
    expect(res.json.email_sent).toBe(true)
    expect(h.envois).toHaveLength(1)
    expect(envoi().to).toBe('claire@exemple.test')
    expect(envoi().subject).toBe('Bâtiment Durand SARL vous invite à rejoindre l\'équipe VITFIX')
    expect(envoi().html).toContain('Bonjour <strong>Claire Martin</strong>,')
    expect(envoi().html).toContain('L\'entreprise <strong>Bâtiment Durand SARL</strong> vous invite à rejoindre son équipe en tant que <strong>Conducteur de travaux</strong>')
    expect(envoi().html).toMatch(/<a href="https:\/\/vitfix\.io\/pro\/invite\?token=[0-9a-f]+\.[0-9a-f]+"/)
    expect(envoi().tags).toEqual([{ name: 'template', value: 'pro_team_invite' }, { name: 'company_id', value: ID_SOCIETE }])
    expect(appelsDe(h.base, 'pro_team_members', 'insert')).toHaveLength(1)
  })

  it('société sans nom renseigné : « Entreprise », comme avant', async () => {
    h.compte = gerant({})
    await inviter()
    expect(envoi().subject).toBe('Entreprise vous invite à rejoindre l\'équipe VITFIX')
  })
})

describe('contenu de l\'e-mail d\'invitation', () => {
  const balise = (champ: string) => `<b data-champ="${champ}">&'</b>`
  const echappee = (champ: string) => `&lt;b data-champ=&quot;${champ}&quot;&gt;&amp;&#039;&lt;/b&gt;`

  it('nom de l\'invité et nom de la société échappés, aucun ne devient du balisage', async () => {
    h.compte = gerant({ company_name: balise('company_name') })
    const res = await inviter({ full_name: balise('full_name') })
    expect(res.status).toBe(200)
    expect(envoi().html).not.toMatch(/<b data-champ=/)
    expect(envoi().html).toContain(echappee('full_name'))
    expect(envoi().html).toContain(echappee('company_name'))
  })

  it('nom de la société : une ligne de 200 caractères au plus, dans l\'objet comme dans le corps', async () => {
    h.compte = gerant({ company_name: `Ligne 1\r\nLigne 2 ${'x'.repeat(5000)}` })
    await inviter()
    const nomAttendu = `Ligne 1 Ligne 2 ${'x'.repeat(184)}`
    expect(nomAttendu).toHaveLength(200)
    expect(envoi().subject).toBe(`${nomAttendu} vous invite à rejoindre l'équipe VITFIX`)
    expect(envoi().html).toContain(`<strong>${nomAttendu}</strong>`)
    expect(envoi().html).not.toContain('x'.repeat(185))
  })

  it('nom de société qui n\'est pas un texte : rendu comme un texte, sans erreur', async () => {
    h.compte = gerant({ company_name: 12345 })
    expect((await inviter()).status).toBe(200)
    expect(envoi().subject).toBe('12345 vous invite à rejoindre l\'équipe VITFIX')
  })
})

describe('volume : plafond d\'invitations par compte et par 24 heures', () => {
  it('le compteur porte le compte, en plus de la limite par adresse Internet d\'avant', async () => {
    await inviter()
    expect(h.limites).toEqual([
      { cle: 'pro_team_post_127.0.0.1', limite: 10, fenetre: 60_000 },
      { cle: `pro_team_invite_jour_${ID_SOCIETE}`, limite: 40, fenetre: 24 * 60 * 60 * 1000 },
    ])
  })

  it('plafond atteint : 429 avec un message en français, aucune écriture en base, aucun e-mail', async () => {
    h.clesRefusees = ['pro_team_invite_jour_']
    const res = await inviter()
    expect(res.status).toBe(429)
    expect(res.json.error).toMatch(/40 invitations par 24 heures/)
    expect(ecritures()).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })

  it('une demande refusée (corps invalide, membre déjà présent) ne consomme pas le plafond', async () => {
    await inviter({ email: 'pas une adresse' })
    h.base.lignes.pro_team_members = [{ id: 'm1', company_id: ID_SOCIETE, email: 'claire@exemple.test' }]
    expect((await inviter()).status).toBe(409)
    expect(h.limites.filter((l) => l.cle.startsWith('pro_team_invite_jour_'))).toHaveLength(0)
  })

  it('membre déjà présent : 409 avec le message français d\'avant et le code « deja_membre » que l\'écran traduit', async () => {
    h.base.lignes.pro_team_members = [{ id: 'm1', company_id: ID_SOCIETE, email: 'claire@exemple.test' }]
    const res = await inviter({ email: 'Claire@Exemple.test' })
    expect(res.status).toBe(409)
    expect(res.json).toEqual({ error: 'Cet email est déjà membre de votre équipe', code: 'deja_membre' })
    expect(ecritures()).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })
})

describe('catégorie professionnelle à l\'invitation (25/11/2026)', () => {
  const ligneInseree = () => appelsDe(h.base, 'pro_team_members', 'insert')[0].donnees as Record<string, unknown>

  it('saisie : enregistrée sur la ligne, blancs réduits ; l\'e-mail garde le rôle', async () => {
    const res = await inviter({ memberRole: 'CHEF_CHANTIER', job_title: '  Encarregado  geral ' })
    expect(res.status).toBe(200)
    expect(ligneInseree().job_title).toBe('Encarregado geral')
    expect(ligneInseree().role).toBe('CHEF_CHANTIER')
    expect(envoi().html).toContain('<strong>Chef de chantier</strong>')
  })

  it.each([['absente', {}], ['vide', { job_title: '   ' }], ['null', { job_title: null }]])(
    'catégorie %s : la colonne n\'est pas écrite (invitation possible avant la migration)', async (_cas, sur) => {
      expect((await inviter(sur)).status).toBe(200)
      expect(ligneInseree()).not.toHaveProperty('job_title')
    })

  it.each([['81 caractères', 'a'.repeat(81)], ['caractère de contrôle', `Servente${String.fromCodePoint(7)}`]])(
    'catégorie refusée (%s) : 400, rien n\'est écrit ni envoyé', async (_cas, job_title) => {
      const res = await inviter({ job_title })
      expect(res.status).toBe(400)
      expect(ecritures()).toHaveLength(0)
      expect(h.envois).toHaveLength(0)
    })
})

describe('invitation par un co-gérant (gérant invité dans la société d\'un autre compte, 25/11/2026)', () => {
  const COGERANT = 'c0c0c0c0-1111-4222-8333-444444444444'
  // resolveCompanyId garde sa réponse 60 s par compte : un identifiant par situation.
  const coGerant = (societe: string | null = ID_SOCIETE, id = COGERANT) => {
    h.compte = { id, email: 'cogerant@exemple.test', app_metadata: { role: 'pro_societe', pro_team_role: 'GERANT', company_id: ID_SOCIETE }, user_metadata: { company_name: 'Nom à moi' } }
    h.base.lignes.pro_team_members = societe ? [{ id: 'ligne-cogerant', user_id: id, company_id: societe, is_active: true, role: 'GERANT' }] : []
    h.base.lignes.profiles_artisan = [{ id: 'fiche-societe', user_id: ID_SOCIETE, company_name: 'VITFIX CONSTRUÇÕES, LDA', language: 'pt' }]
  }
  const insertion = () => appelsDe(h.base, 'pro_team_members', 'insert')[0]?.donnees as Record<string, unknown> | undefined

  it('salarié invité dans la société du titulaire, e-mail au nom et dans la langue de la société (pas du co-gérant)', async () => {
    coGerant()
    const res = await inviter({ memberRole: 'OUVRIER' })
    expect(res.status).toBe(200)
    expect(insertion()).toMatchObject({ company_id: ID_SOCIETE, role: 'OUVRIER' })
    expect(envoi().subject).toBe('VITFIX CONSTRUÇÕES, LDA convida-o(a) para a equipa VITFIX')
    expect(envoi().tags).toEqual([{ name: 'template', value: 'pro_team_invite' }, { name: 'company_id', value: ID_SOCIETE }])
  })

  it('invitation d\'un GÉRANT : réservée au titulaire, 403, rien n\'est écrit ni envoyé', async () => {
    coGerant()
    const res = await inviter({ memberRole: 'GERANT' })
    expect(res.status).toBe(403)
    expect(ecritures()).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })

  it('co-gérant sans ligne d\'équipe active : 409, aucune équipe fantôme à son nom', async () => {
    coGerant(null, 'c2c2c2c2-1111-4222-8333-444444444444')
    const res = await inviter({ memberRole: 'OUVRIER', email: 'fantome@exemple.test' })
    expect(res.status).toBe(409)
    expect(ecritures()).toHaveLength(0)
    expect(h.envois).toHaveLength(0)
  })

  it('le titulaire invite toujours un gérant (co-gérant), dans sa société', async () => {
    const res = await inviter({ memberRole: 'GERANT' })
    expect(res.status).toBe(200)
    expect(insertion()).toMatchObject({ company_id: ID_SOCIETE, role: 'GERANT' })
  })
})
