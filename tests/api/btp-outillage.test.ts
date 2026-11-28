// @vitest-environment node
// tests/api/btp-outillage.test.ts — GET et POST /api/btp/outillage (outillage et vérification du vendredi, 26/11/2026).
//
// Base simulée en mémoire, partagée avec les tests du pointage (tests/helpers/base-memoire-pointage.ts), complétée ici
// d'un encarregado (chef de chantier) affecté au chantier « Villa » et du répertoire de la société A. Société du
// compte et droits résolus par le VRAI code (resolveCompanyId, lirePerimetreBtp, matrice de lib/permissions.ts).

import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import {
  C_FINI, C_GARAGE, C_IMMEUBLE, C_JEAN, C_SOC_B, C_VILLA, GERANT_A, OUVRIER_PAUL, SOC_A, SOC_B, U_PAUL, donnees, etat, type Ligne,
} from '../helpers/base-memoire-pointage'

vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/base-memoire-pointage')).supabaseMemoire }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (original) => {
  const base = await import('../helpers/base-memoire-pointage')
  return { ...(await original<typeof import('@/lib/auth-helpers')>()), getAuthUser: vi.fn(async () => base.etat.user) }
})

const { GET, POST } = await import('@/app/api/btp/outillage/route')

// Vendredi 27/11/2026, 15:00 UTC (15:00 à Lisbonne, 16:00 à Paris).
const VENDREDI = Date.UTC(2026, 10, 27, 15, 0, 0)

const U_CHEF = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e09'
const M_CHEF = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f09'
const CHEF = { id: U_CHEF, email: 'paulo.chefe@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'CHEF_CHANTIER', company_id: SOC_A } }
const ARTISAN = { id: randomUUID(), email: 'artisan@x.example', app_metadata: { role: 'artisan' } }

const O_BETONEIRA = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d01'
const O_ESCADOTES = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d02'
const O_CARRINHA = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d03'
const O_GARAGE = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d04'
const O_RETIRE = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d05'
const O_SOC_B = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d06'

const lire = async (fuseau = 'Europe/Lisbon') => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp/outillage?fuseau=${encodeURIComponent(fuseau)}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- réponse JSON lue par les tests
}
const envoyer = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp/outillage', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- réponse JSON lue par les tests
}
const ecrituresOutillage = () => etat.ecritures.filter(e => e.table === 'outillage_btp' || e.table === 'verifications_outillage_btp')
const verifications = () => (etat.tables.verifications_outillage_btp ?? []) as Ligne[]

interface LigneEnvoyee { outilId: string; presents: number; enPanne: boolean; remarque: string | null }
const toutPresent = (): { action: string; chantierId: string; fuseau: string; observations: string | null; lignes: LigneEnvoyee[] } => ({
  action: 'valider', chantierId: C_VILLA, fuseau: 'Europe/Lisbon', observations: null,
  lignes: [
    { outilId: O_BETONEIRA, presents: 1, enPanne: false, remarque: null },
    { outilId: O_ESCADOTES, presents: 4, enPanne: false, remarque: null },
  ],
})

const outilValide = { type: 'outil', nom: 'Rebarbadora', reference: null, quantite: 2, chantierId: C_VILLA, etat: 'ok', notes: null }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(VENDREDI)
  donnees()
  const t = etat.tables
  t.pro_team_members.push({ id: randomUUID(), company_id: SOC_A, user_id: U_CHEF, email: CHEF.email, role: 'CHEF_CHANTIER', is_active: true })
  t.membres_btp.push({ id: M_CHEF, owner_id: SOC_A, prenom: 'Paulo', nom: 'Chefe', email: 'Paulo.Chefe@a.example', type_compte: 'chef_chantier', actif: true })
  const villa = t.chantiers_btp.find(c => c.id === C_VILLA) as Ligne
  villa.membres_ids = [...(villa.membres_ids as string[]), M_CHEF]
  t.outillage_btp = [
    { id: O_BETONEIRA, owner_id: SOC_A, type: 'outil', nom: 'Betoneira', quantite: 1, chantier_id: C_VILLA, etat: 'ok', created_at: '2026-11-20T09:00:00Z' },
    { id: O_ESCADOTES, owner_id: SOC_A, type: 'outil', nom: 'Escadotes', quantite: 4, chantier_id: C_VILLA, etat: 'ok', created_at: '2026-11-20T09:00:00Z' },
    { id: O_CARRINHA, owner_id: SOC_A, type: 'vehicule', nom: 'Carrinha', reference: 'AA-00-BB', quantite: 1, chantier_id: null, etat: 'ok', created_at: '2026-11-20T09:00:00Z' },
    { id: O_GARAGE, owner_id: SOC_A, type: 'outil', nom: 'Martelo pneumático', quantite: 1, chantier_id: C_GARAGE, etat: 'ok', created_at: '2026-11-20T09:00:00Z' },
    { id: O_RETIRE, owner_id: SOC_A, type: 'outil', nom: 'Ancien', quantite: 1, chantier_id: C_VILLA, etat: 'ok', retire_le: '2026-11-21T09:00:00Z', created_at: '2026-11-01T09:00:00Z' },
    { id: O_SOC_B, owner_id: SOC_B, type: 'outil', nom: 'Outil de la société B', quantite: 1, chantier_id: C_SOC_B, etat: 'ok', created_at: '2026-11-20T09:00:00Z' },
  ]
  t.verifications_outillage_btp = []
  t.pro_role_permissions = []
  etat.user = CHEF
  etat.tablesAbsentes = new Set()
  etat.ecritures = []
})
afterEach(() => { vi.useRealTimers() })

describe('GET /api/btp/outillage — qui voit quoi', () => {
  it('sans session : 401 ; artisan : 403 ; ouvrier (module fermé par défaut) : 403', async () => {
    etat.user = null
    expect((await lire()).status).toBe(401)
    etat.user = ARTISAN
    expect(await lire()).toMatchObject({ status: 403, json: { error: 'reserve_btp' } })
    etat.user = OUVRIER_PAUL
    expect(await lire()).toMatchObject({ status: 403, json: { error: 'acces_refuse' } })
  })

  it('le gérant : tout le répertoire de SA société, tous les chantiers en cours, les lieux', async () => {
    etat.user = GERANT_A
    const { status, json } = await lire()
    expect(status).toBe(200)
    expect(json).toMatchObject({ disponible: true, gestion: true, aujourdhui: '2026-11-27', vendredi: '2026-11-27' })
    expect(json.outils.map((o: Ligne) => o.id).sort()).toEqual([O_BETONEIRA, O_ESCADOTES, O_CARRINHA, O_GARAGE].sort())
    expect(json.chantiers.map((c: Ligne) => c.id).sort()).toEqual([C_VILLA, C_GARAGE, C_IMMEUBLE, C_JEAN].sort())
    expect(json.lieux.map((l: Ligne) => l.id)).toContain(C_FINI)
    expect(json.lieux.map((l: Ligne) => l.id)).not.toContain(C_SOC_B)
    const etats = Object.fromEntries(json.chantiers.map((c: Ligne) => [c.id, c.etat]))
    expect(etats).toMatchObject({ [C_VILLA]: 'a_faire', [C_GARAGE]: 'a_faire', [C_IMMEUBLE]: 'sans_outils' })
    expect(JSON.stringify(json)).not.toContain('société B')
  })

  it('l’encarregado : seulement SON chantier et ses outils — ni le dépôt, ni le chantier d’un autre, ni un outil retiré', async () => {
    // Vérifications de la semaine : la sienne et celle d'un autre chantier de la société, qu'il ne doit pas recevoir.
    etat.tables.verifications_outillage_btp = [
      { id: randomUUID(), owner_id: SOC_A, chantier_id: C_VILLA, chantier_titre: 'Villa', vendredi: '2026-11-20', valide_par: U_CHEF, valide_par_nom: 'Paulo Chefe', lignes: [], manquants: 0, en_panne: 0, created_at: '2026-11-20T16:00:00Z' },
      { id: randomUUID(), owner_id: SOC_A, chantier_id: C_GARAGE, chantier_titre: 'Garage', vendredi: '2026-11-20', valide_par: SOC_A, valide_par_nom: 'Gérant', lignes: [], manquants: 2, en_panne: 0, created_at: '2026-11-20T17:00:00Z' },
    ]
    const { status, json } = await lire()
    expect(json.verifications.map((v: Ligne) => v.chantierId)).toEqual([C_VILLA])
    expect(status).toBe(200)
    expect(json).toMatchObject({ gestion: false, rattachement: 'relie', lieux: [] })
    expect(json.chantiers.map((c: Ligne) => c.id)).toEqual([C_VILLA])
    expect(json.chantiers[0]).toMatchObject({ titre: 'Villa', adresse: '1 rue des Lilas, 13008 Marseille', etat: 'a_faire', derniere: null })
    expect(Object.keys(json.chantiers[0]).sort()).toEqual(['adresse', 'derniere', 'etat', 'id', 'titre'])
    expect(JSON.stringify(json)).not.toContain('Mme X')
    expect(json.outils.map((o: Ligne) => o.id).sort()).toEqual([O_BETONEIRA, O_ESCADOTES].sort())
  })

  it('un encarregado sans fiche employé reliée : aucun chantier, et l’écran sait pourquoi', async () => {
    ;(etat.tables.membres_btp.find(m => m.id === M_CHEF) as Ligne).email = 'autre@a.example'
    const { json } = await lire()
    expect(json).toMatchObject({ rattachement: 'aucun', chantiers: [], outils: [] })
  })

  it('le vendredi est celui du fuseau du téléphone : jeudi 23:30 à Lisbonne, déjà vendredi à Paris', async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 26, 23, 30, 0))
    expect((await lire('Europe/Lisbon')).json).toMatchObject({ aujourdhui: '2026-11-26', vendredi: '2026-11-20' })
    expect((await lire('Europe/Paris')).json).toMatchObject({ aujourdhui: '2026-11-27', vendredi: '2026-11-27' })
  })

  it('le lundi sans vérification : en retard ; migration non appliquée : disponible = false, sans erreur', async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 30, 9, 0, 0))
    expect((await lire()).json.chantiers[0]).toMatchObject({ etat: 'en_retard' })
    etat.tablesAbsentes = new Set(['outillage_btp'])
    expect(await lire()).toMatchObject({ status: 200, json: { disponible: false, outils: [], chantiers: [] } })
  })
})

describe('POST valider — la vérification du vendredi', () => {
  it('l’encarregado valide son chantier : constat signé, liste figée, pour le vendredi de la semaine', async () => {
    const corps = toutPresent()
    corps.lignes[1] = { outilId: O_ESCADOTES, presents: 3, enPanne: true, remarque: 'Uma partida' }
    corps.observations = 'Falta uma rebarbadora'
    const { status, json } = await envoyer(corps)
    expect(status).toBe(201)
    expect(json.verification).toMatchObject({ chantierId: C_VILLA, vendredi: '2026-11-27', par: 'Paulo Chefe', manquants: 1, enPanne: 1, observations: 'Falta uma rebarbadora' })
    expect(verifications()).toHaveLength(1)
    expect(verifications()[0]).toMatchObject({ owner_id: SOC_A, membre_id: M_CHEF, valide_par: U_CHEF, chantier_titre: 'Villa' })
    expect(verifications()[0].lignes).toEqual([
      { outilId: O_BETONEIRA, nom: 'Betoneira', type: 'outil', reference: null, attendus: 1, presents: 1, enPanne: false, remarque: null },
      { outilId: O_ESCADOTES, nom: 'Escadotes', type: 'outil', reference: null, attendus: 4, presents: 3, enPanne: true, remarque: 'Uma partida' },
    ])
    // Rien d'autre n'est écrit : le répertoire ne bouge pas sur la foi d'une vérification.
    expect(ecrituresOutillage().map(e => `${e.table}:${e.op}`)).toEqual(['verifications_outillage_btp:insert'])
    const apres = await lire()
    expect(apres.json.chantiers[0]).toMatchObject({ etat: 'faite', derniere: { par: 'Paulo Chefe', manquants: 1 } })
  })

  it('faite le lundi, elle vaut pour le vendredi précédent', async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 30, 9, 0, 0))
    expect((await envoyer(toutPresent())).json.verification).toMatchObject({ vendredi: '2026-11-27' })
  })

  it('refuse un chantier qui ne lui est pas affecté, sans rien écrire', async () => {
    expect(await envoyer({ ...toutPresent(), chantierId: C_GARAGE, lignes: [{ outilId: O_GARAGE, presents: 1, enPanne: false, remarque: null }] }))
      .toMatchObject({ status: 403, json: { error: 'chantier_non_affecte' } })
    // Même si le chantier de la société B désigne sa fiche : la société est celle du compte, jamais celle du chantier.
    const chantierB = etat.tables.chantiers_btp.find(c => c.id === C_SOC_B) as Ligne
    chantierB.membres_ids = [...(chantierB.membres_ids as string[]), M_CHEF]
    expect(await envoyer({ ...toutPresent(), chantierId: C_SOC_B, lignes: [{ outilId: O_SOC_B, presents: 1, enPanne: false, remarque: null }] }))
      .toMatchObject({ status: 403, json: { error: 'chantier_non_affecte' } })
    expect((await lire()).json.chantiers.map((c: Ligne) => c.id)).toEqual([C_VILLA])
    expect(ecrituresOutillage()).toEqual([])
  })

  it('un chantier sans outil : 422 sans observation, accepté avec une', async () => {
    etat.user = GERANT_A
    const vide = { action: 'valider', chantierId: C_IMMEUBLE, fuseau: 'Europe/Lisbon', lignes: [], observations: null }
    expect(await envoyer(vide)).toMatchObject({ status: 422, json: { error: 'observations_requises' } })
    expect(await envoyer({ ...vide, observations: '   ' })).toMatchObject({ status: 422 })
    expect(ecrituresOutillage()).toEqual([])
    expect((await envoyer({ ...vide, observations: 'Falta um andaime' })).status).toBe(201)
  })

  it('la remarque d’un élément présent et en état n’est pas gardée', async () => {
    const corps = toutPresent()
    corps.lignes[0] = { outilId: O_BETONEIRA, presents: 1, enPanne: false, remarque: 'Levada para Porto' }
    expect((await envoyer(corps)).status).toBe(201)
    expect((verifications()[0].lignes as Ligne[])[0]).toMatchObject({ outilId: O_BETONEIRA, remarque: null })
  })

  it('un co-gérant invité désactivé n’a plus accès (aucune ligne d’équipe active)', async () => {
    const U_COGERANT = randomUUID()
    etat.tables.pro_team_members.push({ id: randomUUID(), company_id: SOC_A, user_id: U_COGERANT, email: 'cogerant@a.example', role: 'GERANT', is_active: false })
    etat.user = { id: U_COGERANT, email: 'cogerant@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'GERANT', company_id: SOC_A } }
    expect(await lire()).toMatchObject({ status: 403, json: { error: 'acces_refuse' } })
    expect(await envoyer({ action: 'creer', outil: outilValide })).toMatchObject({ status: 403 })
    expect(ecrituresOutillage()).toEqual([])
  })

  it('refuse une liste qui n’est plus celle du chantier (outil oublié, outil retiré, outil d’ailleurs) et un excédent', async () => {
    const oubli = toutPresent()
    oubli.lignes = oubli.lignes.slice(0, 1)
    expect(await envoyer(oubli)).toMatchObject({ status: 409, json: { error: 'liste_changee' } })
    const retire = toutPresent()
    retire.lignes.push({ outilId: O_RETIRE, presents: 1, enPanne: false, remarque: null })
    expect(await envoyer(retire)).toMatchObject({ status: 409, json: { error: 'liste_changee' } })
    const ailleurs = toutPresent()
    ailleurs.lignes.push({ outilId: O_CARRINHA, presents: 1, enPanne: false, remarque: null })
    expect(await envoyer(ailleurs)).toMatchObject({ status: 409, json: { error: 'liste_changee' } })
    const exces = toutPresent()
    exces.lignes[1] = { outilId: O_ESCADOTES, presents: 5, enPanne: false, remarque: null }
    expect(await envoyer(exces)).toMatchObject({ status: 422, json: { error: 'quantite_invalide' } })
    expect(ecrituresOutillage()).toEqual([])
  })

  it('sans fiche employé : 409 fiche_absente ; l’ouvrier : 403 ; corps illisible : 400', async () => {
    ;(etat.tables.membres_btp.find(m => m.id === M_CHEF) as Ligne).email = 'autre@a.example'
    expect(await envoyer(toutPresent())).toMatchObject({ status: 409, json: { error: 'fiche_absente' } })
    etat.user = OUVRIER_PAUL
    expect(await envoyer(toutPresent())).toMatchObject({ status: 403, json: { error: 'acces_refuse' } })
    expect((await envoyer({ action: 'valider', chantierId: 'x' })).status).toBe(400)
    expect(ecrituresOutillage()).toEqual([])
  })

  it('le gérant ouvre le module à un ouvrier (dérogation en base) : il valide alors ses propres chantiers', async () => {
    const ligneEquipe = etat.tables.pro_team_members.find(m => m.user_id === U_PAUL) as Ligne
    etat.tables.pro_role_permissions = [{ company_id: SOC_A, member_id: ligneEquipe.id, module_id: 'outillage', access_level: 'READ' }]
    etat.user = OUVRIER_PAUL
    const { status, json } = await envoyer(toutPresent())
    expect(status).toBe(201)
    expect(json.verification).toMatchObject({ par: 'Paul Exemple' })
    // Une dérogation forgée sous une autre société n'ouvre rien (lecture bornée à company_id).
    etat.tables.pro_role_permissions = [{ company_id: U_PAUL, member_id: ligneEquipe.id, module_id: 'outillage', access_level: 'FULL' }]
    expect((await envoyer(toutPresent())).status).toBe(403)
  })

  it('le gérant valide aussi n’importe quel chantier en cours, sans fiche employé', async () => {
    etat.user = GERANT_A
    const { status, json } = await envoyer({ ...toutPresent(), chantierId: C_GARAGE, lignes: [{ outilId: O_GARAGE, presents: 0, enPanne: false, remarque: null }] })
    expect(status).toBe(201)
    expect(json.verification).toMatchObject({ manquants: 1, par: '' })
    expect(verifications()[0]).toMatchObject({ owner_id: SOC_A, membre_id: null, valide_par: SOC_A })
    expect(JSON.stringify(verifications())).not.toContain('gerant@a.example')
    // Avec le nom de son compte (titulaire : il est la société), c'est ce nom qui signe.
    etat.user = { ...GERANT_A, user_metadata: { full_name: 'Frédéric Exemple' } }
    const { json: suite } = await envoyer({ ...toutPresent(), chantierId: C_GARAGE, lignes: [{ outilId: O_GARAGE, presents: 1, enPanne: false, remarque: null }] })
    expect(suite.verification).toMatchObject({ par: 'Frédéric Exemple' })
  })

  it('un sous-compte sans fiche signe du nom posé à l’invitation, jamais du nom qu’il se donne', async () => {
    const U_SEC = randomUUID()
    etat.tables.pro_team_members.push({ id: randomUUID(), company_id: SOC_A, user_id: U_SEC, email: 'sec@a.example', full_name: 'Tatiana Exemple', role: 'SECRETAIRE', is_active: true })
    etat.user = { id: U_SEC, email: 'sec@a.example', user_metadata: { full_name: 'Le Gérant' }, app_metadata: { role: 'pro_societe', pro_team_role: 'SECRETAIRE', company_id: SOC_A } }
    const { status, json } = await envoyer(toutPresent())
    expect(status).toBe(201)
    expect(json.verification).toMatchObject({ par: 'Tatiana Exemple' })
  })

  it('migration non appliquée : 409 migration_requise', async () => {
    etat.tablesAbsentes = new Set(['outillage_btp', 'verifications_outillage_btp'])
    expect(await envoyer(toutPresent())).toMatchObject({ status: 409, json: { error: 'migration_requise' } })
  })
})

describe('POST creer / modifier / retirer — le répertoire', () => {
  it('l’encarregado ne touche pas au répertoire', async () => {
    for (const corps of [
      { action: 'creer', outil: outilValide },
      { action: 'modifier', id: O_BETONEIRA, outil: outilValide },
      { action: 'retirer', id: O_BETONEIRA },
    ]) {
      expect(await envoyer(corps), corps.action).toMatchObject({ status: 403, json: { error: 'reserve_a_la_gestion' } })
    }
    expect(ecrituresOutillage()).toEqual([])
  })

  it('le gérant ajoute : sous SA société, jamais sur le chantier d’une autre', async () => {
    etat.user = GERANT_A
    expect(await envoyer({ action: 'creer', outil: { ...outilValide, chantierId: C_SOC_B } })).toMatchObject({ status: 422, json: { error: 'chantier_inconnu' } })
    expect(ecrituresOutillage()).toEqual([])
    const { status, json } = await envoyer({ action: 'creer', outil: { ...outilValide, nom: '  Rebarbadora  ' } })
    expect(status).toBe(201)
    expect(json.outil).toMatchObject({ nom: 'Rebarbadora', quantite: 2, chantierId: C_VILLA })
    expect((etat.tables.outillage_btp as Ligne[]).find(o => o.id === json.outil.id)).toMatchObject({ owner_id: SOC_A })
    // Au dépôt, ou sur un chantier terminé de la société : accepté.
    expect((await envoyer({ action: 'creer', outil: { ...outilValide, chantierId: null } })).status).toBe(201)
    expect((await envoyer({ action: 'creer', outil: { ...outilValide, chantierId: C_FINI } })).status).toBe(201)
  })

  it('le gérant déplace un outil ; l’outil d’une autre société ou retiré reste introuvable', async () => {
    etat.user = GERANT_A
    const { status, json } = await envoyer({ action: 'modifier', id: O_CARRINHA, outil: { ...outilValide, type: 'vehicule', nom: 'Carrinha', quantite: 1, chantierId: C_GARAGE } })
    expect(status).toBe(200)
    expect(json.outil).toMatchObject({ id: O_CARRINHA, chantierId: C_GARAGE, type: 'vehicule' })
    expect(await envoyer({ action: 'modifier', id: O_SOC_B, outil: outilValide })).toMatchObject({ status: 404, json: { error: 'outil_introuvable' } })
    expect(await envoyer({ action: 'modifier', id: O_RETIRE, outil: outilValide })).toMatchObject({ status: 404 })
    expect((etat.tables.outillage_btp as Ligne[]).find(o => o.id === O_SOC_B)).toMatchObject({ nom: 'Outil de la société B', owner_id: SOC_B })
  })

  it('déplacer un outil remet sa date d’arrivée : le chantier qu’il rejoint n’est pas « en retard » pour un vendredi passé', async () => {
    etat.user = GERANT_A
    // Mercredi 02/12 : la carrinha, au dépôt depuis le 20/11, part sur l'Immeuble (sans outil jusque-là).
    vi.setSystemTime(Date.UTC(2026, 11, 2, 9, 0, 0))
    const deplacement = { action: 'modifier', id: O_CARRINHA, outil: { type: 'vehicule', nom: 'Carrinha', reference: 'AA-00-BB', quantite: 1, chantierId: C_IMMEUBLE, etat: 'ok', notes: null } }
    expect((await envoyer(deplacement)).status).toBe(200)
    const carrinha = (etat.tables.outillage_btp as Ligne[]).find(o => o.id === O_CARRINHA) as Ligne
    expect(carrinha.chantier_depuis).toBe('2026-12-02T09:00:00.000Z')
    const immeuble = (await lire()).json.chantiers.find((c: Ligne) => c.id === C_IMMEUBLE)
    expect(immeuble).toMatchObject({ etat: 'prochaine' })
    // Une modification sans déplacement (nom) ne touche pas à la date d'arrivée.
    vi.setSystemTime(Date.UTC(2026, 11, 3, 9, 0, 0))
    expect((await envoyer({ ...deplacement, outil: { ...deplacement.outil, nom: 'Carrinha Master' } })).status).toBe(200)
    expect(carrinha.chantier_depuis).toBe('2026-12-02T09:00:00.000Z')
    // Le vendredi suivant passé sans vérification, il est bien en retard.
    vi.setSystemTime(Date.UTC(2026, 11, 7, 9, 0, 0))
    expect((await lire()).json.chantiers.find((c: Ligne) => c.id === C_IMMEUBLE)).toMatchObject({ etat: 'en_retard' })
  })

  it('retirer garde la ligne (les vérifications passées la citent) et la sort du répertoire', async () => {
    etat.user = GERANT_A
    expect(await envoyer({ action: 'retirer', id: O_BETONEIRA })).toMatchObject({ status: 200, json: { retire: O_BETONEIRA } })
    expect((etat.tables.outillage_btp as Ligne[]).find(o => o.id === O_BETONEIRA)?.retire_le).toBeTruthy()
    expect((await lire()).json.outils.map((o: Ligne) => o.id)).not.toContain(O_BETONEIRA)
    expect((await envoyer({ action: 'retirer', id: O_BETONEIRA })).status).toBe(404)
    expect((await envoyer({ action: 'retirer', id: O_SOC_B })).status).toBe(404)
  })

  it('la secrétaire (tous pouvoirs) tient aussi le répertoire', async () => {
    const U_SEC = randomUUID()
    etat.tables.pro_team_members.push({ id: randomUUID(), company_id: SOC_A, user_id: U_SEC, email: 'sec@a.example', role: 'SECRETAIRE', is_active: true })
    etat.user = { id: U_SEC, email: 'sec@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'SECRETAIRE', company_id: SOC_A } }
    expect((await lire()).json).toMatchObject({ gestion: true })
    expect((await envoyer({ action: 'creer', outil: outilValide })).status).toBe(201)
  })
})

describe('catégorie d’un outil (migration 20261128d, 28/11/2026)', () => {
  const ligne = (id: string) => (etat.tables.outillage_btp as Ligne[]).find(o => o.id === id) as Ligne

  it('le gérant classe un outil : catégorie enregistrée et rendue ; un véhicule n’en garde jamais', async () => {
    etat.user = GERANT_A
    const { status, json } = await envoyer({ action: 'creer', outil: { ...outilValide, categorie: 'electroportatif' } })
    expect(status).toBe(201)
    expect(json.outil).toMatchObject({ nom: 'Rebarbadora', categorie: 'electroportatif' })
    expect(ligne(json.outil.id)).toMatchObject({ categorie: 'electroportatif' })
    const vehicule = await envoyer({ action: 'creer', outil: { ...outilValide, type: 'vehicule', nom: 'Carrinha 2', categorie: 'machines' } })
    expect(vehicule.status).toBe(201)
    expect(ligne(vehicule.json.outil.id)).toMatchObject({ type: 'vehicule', categorie: null })
    expect((await lire()).json.outils.find((o: Ligne) => o.id === json.outil.id)).toMatchObject({ categorie: 'electroportatif' })
  })

  it('modifier : catégorie changée ou vidée ; absente du formulaire (écran d’avant), elle reste ; devenue véhicule, effacée', async () => {
    etat.user = GERANT_A
    ligne(O_BETONEIRA).categorie = 'machines'
    const betoneira = { type: 'outil', nom: 'Betoneira', reference: null, quantite: 1, chantierId: C_VILLA, etat: 'ok', notes: null }
    expect((await envoyer({ action: 'modifier', id: O_BETONEIRA, outil: { ...betoneira, notes: 'Revista' } })).status).toBe(200)
    expect(ligne(O_BETONEIRA)).toMatchObject({ categorie: 'machines', notes: 'Revista' })
    expect((await envoyer({ action: 'modifier', id: O_BETONEIRA, outil: { ...betoneira, categorie: 'autre' } })).status).toBe(200)
    expect(ligne(O_BETONEIRA).categorie).toBe('autre')
    expect((await envoyer({ action: 'modifier', id: O_BETONEIRA, outil: { ...betoneira, categorie: null } })).status).toBe(200)
    expect(ligne(O_BETONEIRA).categorie).toBeNull()
    ligne(O_BETONEIRA).categorie = 'machines'
    expect((await envoyer({ action: 'modifier', id: O_BETONEIRA, outil: { ...betoneira, type: 'vehicule' } })).status).toBe(200)
    expect(ligne(O_BETONEIRA)).toMatchObject({ type: 'vehicule', categorie: null })
  })

  it('une catégorie inconnue : 400, rien d’écrit', async () => {
    etat.user = GERANT_A
    expect(await envoyer({ action: 'creer', outil: { ...outilValide, categorie: 'grua' } })).toMatchObject({ status: 400 })
    expect(ecrituresOutillage()).toEqual([])
  })

  it('migration 20261128d non appliquée : lecture normale (sans catégorie), écriture d’une catégorie 409 migration_categorie', async () => {
    etat.user = GERANT_A
    etat.colonnesAbsentes.add('outillage_btp.categorie')
    const { status, json } = await lire()
    expect(status).toBe(200)
    expect(json.outils.every((o: Ligne) => o.categorie === null)).toBe(true)
    expect(await envoyer({ action: 'creer', outil: { ...outilValide, categorie: 'main' } })).toMatchObject({ status: 409, json: { error: 'migration_categorie' } })
    // Un écran d'avant la catégorie (champ absent) enregistre encore un outil.
    expect((await envoyer({ action: 'creer', outil: { ...outilValide, chantierId: null } })).status).toBe(201)
    // La vérification du vendredi n'écrit pas dans outillage_btp : elle marche toujours.
    etat.user = CHEF
    expect((await envoyer(toutPresent())).status).toBe(201)
  })
})
