// @vitest-environment node
// tests/api/comptable-ai-societe.test.ts — le Comptable IA d'un salarié invité d'une société BTP (25/11/2026).
//
// Deux défauts se suivaient sur ce chemin, et le second se voyait encore moins que le premier :
//
//  1. la garde d'appartenance comparait `profiles_artisan.user_id` au compte CONNECTÉ. La fiche de la société d'un
//     salarié appartient au gérant : 403 avant la moindre lecture ;
//  2. l'enrichissement du contexte lisait `charges_fixes`, `membres_btp`, `pointages_btp`, `chantiers_btp`,
//     `v_rentabilite_chantier`, `devis` et `factures` sous `user.id`. Pour un salarié, tout était vide — et un
//     agent à qui l'on ne donne rien ne dit pas « je n'ai pas accès », il répond « vous n'avez aucune donnée »
//     avec aplomb. Une réponse fausse et sûre d'elle est pire qu'un refus.
//
// Et une garde qui manquait : le contexte financier d'une entreprise (marges, charges fixes, rentabilité par
// chantier) n'a rien à faire entre les mains d'un rôle qui n'a pas la comptabilité.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; app_metadata?: Record<string, unknown> },
  appelerIA: vi.fn(),
  iaDisponible: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})
vi.mock('@/lib/ai/relais', () => ({
  appelerIA: h.appelerIA,
  iaTexteDisponible: h.iaDisponible,
}))

const { POST } = await import('@/app/api/comptable-ai/route')
const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')
const { messageRefusDocuments } = await import('@/lib/documents/messages-refus')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const FICHE_SOCIETE = '7cfb1e10-0000-4000-8000-000000000001'
const FICHE_AILLEURS = '9bd1aaaa-0000-4000-8000-00000000000a'
const AUTRE_COMPTE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

/**
 * `resolveCompanyId` garde la société d'un compte 60 s en mémoire et n'offre aucune purge (lib/auth-helpers.ts) :
 * chaque cas prend donc un compte NEUF, sinon un cas de refus lirait la résolution du cas précédent.
 */
let compteur = 0
const nouveauCompte = () => {
  compteur += 1
  return `00000000-0000-4000-7000-${String(compteur).padStart(12, '0')}`
}

const demander = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/comptable-ai', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

/**
 * Salarié invité : compte neuf, ligne d'équipe active au nom de la société, et la fiche de celle-ci.
 *
 * `niveaux` pose des dérogations du gérant (`pro_role_permissions`), ce qui rend le cas indépendant de la matrice
 * des rôles par défaut : celle-ci est une décision produit qui bouge, et ce banc porte sur la garde, pas sur elle.
 */
function salarieInvite(
  role: string,
  options: { sansLigneEquipe?: boolean; niveaux?: Record<string, string> } = {},
): string {
  const id = nouveauCompte()
  h.user = { id, app_metadata: { role: 'pro_societe', pro_team_role: role, company_id: SOCIETE } }
  if (!options.sansLigneEquipe) {
    h.base.lignes.pro_team_members = [{ id: `membre-${id}`, user_id: id, company_id: SOCIETE, is_active: true }]
  }
  if (options.niveaux) {
    // `company_id` est obligatoire depuis la migration 20261125b : les lectures ignorent toute autre société.
    h.base.lignes.pro_role_permissions = Object.entries(options.niveaux).map(([module_id, access_level]) => ({
      member_id: `membre-${id}`, company_id: SOCIETE, module_id, access_level,
    }))
  }
  h.base.lignes.profiles_artisan = [
    { id: FICHE_SOCIETE, user_id: SOCIETE, company_name: 'Société du Gérant' },
    { id: FICHE_AILLEURS, user_id: AUTRE_COMPTE, company_name: 'Une autre société' },
  ]
  return id
}

/** Filtres de la lecture d'une table, telle qu'elle est partie en base. */
const filtres = (table: string) => requetes(h.base, table, 'select').map(r => r.filtres)

beforeEach(() => {
  h.base = nouvelleBase()
  h.user = null
  h.appelerIA.mockReset()
  h.iaDisponible.mockReset()
  h.appelerIA.mockResolvedValue({ choices: [{ message: { content: 'Réponse de Léa' } }] })
  h.iaDisponible.mockResolvedValue(true)
})

describe('POST /api/comptable-ai — sous quel compte le contexte est lu', () => {
  it('lit le contexte de la SOCIÉTÉ pour un salarié invité', async () => {
    salarieInvite('SECRETAIRE', { niveaux: { comptabilite: 'FULL' } })
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE, numero: 'ORC-2026-001' }]
    h.base.lignes.factures = [{ id: 'f-1', artisan_user_id: SOCIETE, numero: 'FT-2026-001' }]
    h.base.lignes.charges_fixes = [{ id: 'c-1', owner_id: SOCIETE, categorie: 'assurance' }]

    const { status } = await demander({ message: 'Quelle est ma marge ?' })

    expect(status).toBe(200)
    // Les sept lectures visent la société, et aucune le compte du salarié.
    expect(filtres('devis')).toEqual([{ artisan_user_id: SOCIETE }])
    expect(filtres('factures')).toEqual([{ artisan_user_id: SOCIETE }])
    for (const table of ['charges_fixes', 'membres_btp', 'pointages_btp', 'chantiers_btp', 'v_rentabilite_chantier']) {
      expect(filtres(table).map(f => f.owner_id), table).toEqual([SOCIETE])
    }
  })

  it('accepte la fiche de SA société dans le contexte annoncé', async () => {
    // C'est ce que le tableau de bord envoie : la fiche de la société, qui appartient au gérant. Comparée au
    // compte connecté, elle rendait 403 et l'écran restait muet.
    salarieInvite('SECRETAIRE', { niveaux: { comptabilite: 'FULL' } })

    const { status } = await demander({
      message: 'Et mes charges ?',
      financialContext: { artisan_id: FICHE_SOCIETE },
    })

    expect(status).toBe(200)
  })

  it('refuse la fiche d’une autre société', async () => {
    salarieInvite('SECRETAIRE', { niveaux: { comptabilite: 'FULL' } })

    const { status, json } = await demander({
      message: 'Et chez le voisin ?',
      financialContext: { artisan_id: FICHE_AILLEURS },
    })

    expect(status).toBe(403)
    expect(json.error).toMatch(/non autorisé/i)
    // Rien n'est lu : le refus tombe avant l'enrichissement.
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
  })

  it('lit sous son propre compte pour un artisan, sans aucune requête d’équipe', async () => {
    // Règle n° 1 : le côté artisan ne bouge pas, et il ne paie pas un appel de plus.
    const artisan = nouveauCompte()
    h.user = { id: artisan, app_metadata: { role: 'artisan' } }
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: artisan }]

    const { status } = await demander({ message: 'Ma marge ?' })

    expect(status).toBe(200)
    expect(filtres('devis')).toEqual([{ artisan_user_id: artisan }])
    expect(requetes(h.base, 'pro_team_members')).toHaveLength(0)
  })

  it('lit sous son propre compte pour le gérant de la société', async () => {
    h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe', pro_team_role: 'GERANT' } }
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]

    const { status } = await demander({ message: 'Ma marge ?' })

    expect(status).toBe(200)
    expect(filtres('devis')).toEqual([{ artisan_user_id: SOCIETE }])
    expect(requetes(h.base, 'pro_team_members')).toHaveLength(0)
  })
})

describe('POST /api/comptable-ai — qui a droit au contexte financier', () => {
  it('refuse un rôle sans accès à la comptabilité, sans rien lire', async () => {
    // Un ouvrier pointe ses heures ; les marges et les charges fixes de l'entreprise ne le concernent pas.
    salarieInvite('OUVRIER', { niveaux: { comptabilite: 'NONE', compta_btp: 'NONE' } })
    h.base.lignes.devis = [{ id: 'd-1', artisan_user_id: SOCIETE }]

    const { status, json } = await demander({ message: 'Quelle est la marge de la société ?' })

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit_comptabilite')
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
    expect(requetes(h.base, 'charges_fixes', 'select')).toHaveLength(0)
    // Et surtout : aucun appel au modèle, donc aucune réponse inventée sur un contexte vide.
    expect(h.appelerIA).not.toHaveBeenCalled()
  })

  it('rend un motif PROPRE à la comptabilité, que l’écran peut traduire en portugais', async () => {
    // Deux défauts en un, trouvés par la relecture adverse. D'abord le code : `aucun_droit` existe déjà, mais
    // son texte parle « des devis et des factures » — l'afficher ici donnerait le mauvais motif. Ensuite la
    // langue : la route rend le français (une route n'a pas de langue) et c'est l'écran qui traduit. Deux
    // sociétés BTP portugaises sont en production ; leur salarié lisait une phrase française.
    salarieInvite('OUVRIER', { niveaux: { comptabilite: 'NONE', compta_btp: 'NONE' } })

    const { status, json } = await demander({ message: 'Qual é a margem da empresa?' })

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit_comptabilite')
    expect(json.error).toContain('comptabilité')
    // Constante typée : le corps de la réponse arrive en `unknown`, et le contrôle des propriétés en excès de
    // TypeScript refuse un littéral inline face au type étroit de `messageRefusDocuments`.
    const refus = { message: String(json.error), code: String(json.code) }
    expect(messageRefusDocuments(refus, true)).toBe('A sua função na empresa não dá acesso à contabilidade.')
    expect(messageRefusDocuments(refus, false))
      .toBe("Votre rôle dans l'entreprise ne donne pas accès à la comptabilité.")
  })

  it('accepte un rôle à qui le gérant a donné la comptabilité', async () => {
    salarieInvite('COMPTABLE', { niveaux: { compta_btp: 'FULL' } })
    const { status } = await demander({ message: 'Quelle est la marge ?' })
    expect(status).toBe(200)
    expect(filtres('devis')).toEqual([{ artisan_user_id: SOCIETE }])
  })

  it('refuse la LECTURE SEULE : il n’y a pas de demi-accès à ce contexte', async () => {
    // Le contexte injecté contient `membres_btp` en entier — salaires et coûts horaires — et les listes
    // « membres » et « equipes » n'ont aucune vue restreinte : il faut FULL pour les voir (perimetre-compte.ts).
    // L'agent rend du texte, qu'aucune projection ne filtre après coup. READ obtiendrait donc par Léa ce que
    // /api/btp refuse.
    salarieInvite('CHEF_CHANTIER', { niveaux: { comptabilite: 'READ', compta_btp: 'READ' } })
    h.base.lignes.membres_btp = [{ id: 'm-1', owner_id: SOCIETE, nom: 'Dupont', cout_horaire: 42 }]

    const { status, json } = await demander({ message: 'Combien gagne Dupont ?' })

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit_comptabilite')
    expect(requetes(h.base, 'membres_btp', 'select')).toHaveLength(0)
    expect(h.appelerIA).not.toHaveBeenCalled()
  })

  it('refuse en 409 un rattachement que la base ne confirme pas', async () => {
    salarieInvite('SECRETAIRE', { sansLigneEquipe: true, niveaux: { comptabilite: 'FULL' } })

    const { status, json } = await demander({ message: 'Ma marge ?' })

    expect(status).toBe(409)
    expect(json.code).toBe('societe_non_resolue')
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
    expect(h.appelerIA).not.toHaveBeenCalled()
  })

  it('refuse un compte sans session', async () => {
    const { status } = await demander({ message: 'Ma marge ?' })
    expect(status).toBe(401)
  })
})

describe('POST /api/comptable-ai — mode direct (agent copropriété), intouché', () => {
  it('répond sans lire aucun contexte d’entreprise', async () => {
    // Ce mode sert l'agent copropriété : il n'enrichit rien et ne doit pas se mettre à résoudre une société.
    h.user = { id: nouveauCompte(), app_metadata: { role: 'coproprietaire' } }

    const { status, json } = await demander({ messages: [{ role: 'user', content: 'Bonjour' }] })

    expect(status).toBe(200)
    expect(json.reply).toBe('Réponse de Léa')
    expect(requetes(h.base, 'devis', 'select')).toHaveLength(0)
    expect(requetes(h.base, 'charges_fixes', 'select')).toHaveLength(0)
  })
})
