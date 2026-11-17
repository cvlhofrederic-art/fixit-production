/**
 * Rôles qu'un compte peut s'attribuer lui-même après son inscription.
 *
 * Deux chemins posent app_metadata.role (lu par le middleware et les routes serveur) à partir d'une valeur choisie
 * par le navigateur :
 *   - POST /api/auth/init-role (app/api/auth/init-role/route.ts) ;
 *   - le trigger trg_sync_user_role sur auth.users (fonction public.sync_user_role_to_app_metadata), qui recopie
 *     user_metadata.role — écrit par le client via supabase.auth.signUp / updateUser — quand app_metadata.role est
 *     vide.
 * Les deux doivent accepter exactement ROLES_AUTO_ATTRIBUABLES (lib/auth/roles-auto-attribuables.ts).
 *
 * La liste du trigger (migration du 29/04/2026) n'avait pas suivi le resserrement d'init-role du 10/06/2026 ; ce
 * test empêche que les deux divergent à nouveau.
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLES_AUTO_ATTRIBUABLES, estRoleAutoAttribuable } from '@/lib/auth/roles-auto-attribuables'

// Rôles à privilèges ou dormants : attribués seulement côté serveur (invitation, réglage administrateur).
const ROLES_PRIVILEGIES = [
  'super_admin',
  'admin',
  'syndic',
  'syndic_admin',
  'syndic_tech',
  'syndic_secretaire',
  'syndic_comptable',
  'coproprio',
  'pro_conciergerie',
  'pro_gestionnaire',
  // AJ Signalement (PR 2) : posé par le serveur seul, à l'acceptation d'une invitation signée (lib/aj-signalement/serveur-acces.ts).
  'gestionnaire_signalement',
]

describe('rôle gestionnaire_signalement (AJ Signalement, PR 2)', () => {
  it('le commentaire de sécurité de la liste le nomme parmi les rôles attribués côté serveur seulement', () => {
    const source = readFileSync(join(process.cwd(), 'lib/auth/roles-auto-attribuables.ts'), 'utf-8')
    const securite = /\/\/ SÉCURITÉ :([\s\S]*?)export const/.exec(source)?.[1] ?? ''
    expect(securite).toContain('gestionnaire_signalement')
    expect(estRoleAutoAttribuable('gestionnaire_signalement')).toBe(false)
  })
})

const DOSSIER_MIGRATIONS = join(process.cwd(), 'supabase/migrations')

interface DefinitionSql {
  fichier: string
  entete: string
  corps: string
  sqlFichier: string
}

// Dernière définition de la fonction dans l'ordre d'application des migrations (ordre des noms de fichier,
// celui de la CLI Supabase) : c'est elle qui est en place une fois toutes les migrations passées.
function derniereDefinition(): DefinitionSql {
  const fichiers = readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  const motif =
    /create\s+or\s+replace\s+function\s+public\.sync_user_role_to_app_metadata\s*\(\s*\)([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\2\$/gi
  let trouvee: DefinitionSql | null = null
  for (const fichier of fichiers) {
    const sqlFichier = readFileSync(join(DOSSIER_MIGRATIONS, fichier), 'utf-8')
    for (const m of sqlFichier.matchAll(motif)) {
      trouvee = { fichier, entete: m[1], corps: m[3], sqlFichier }
    }
  }
  if (!trouvee) throw new Error('Aucune migration ne définit public.sync_user_role_to_app_metadata()')
  return trouvee
}

function litteraux(liste: string): string[] {
  return [...liste.matchAll(/'([^']*)'/g)].map((m) => m[1])
}

const trie = (valeurs: readonly string[]) => [...valeurs].sort()

describe('ROLES_AUTO_ATTRIBUABLES', () => {
  it("ne contient aucun rôle à privilèges ou dormant", () => {
    for (const role of ROLES_PRIVILEGIES) expect(ROLES_AUTO_ATTRIBUABLES).not.toContain(role)
    for (const role of ROLES_AUTO_ATTRIBUABLES) expect(role.startsWith('syndic')).toBe(false)
  })

  it('estRoleAutoAttribuable refuse les valeurs non textuelles et les rôles hors liste', () => {
    expect(estRoleAutoAttribuable('artisan')).toBe(true)
    expect(estRoleAutoAttribuable('syndic')).toBe(false)
    expect(estRoleAutoAttribuable('Artisan')).toBe(false)
    expect(estRoleAutoAttribuable(undefined)).toBe(false)
    expect(estRoleAutoAttribuable(['artisan'])).toBe(false)
  })
})

describe('trigger trg_sync_user_role — même liste que init-role', () => {
  const definition = derniereDefinition()

  it('la dernière définition de la fonction filtre sur exactement ROLES_AUTO_ATTRIBUABLES', () => {
    const listes = [...definition.corps.matchAll(/\bnot\s+in\s*\(([^)]*)\)/gi)].map((m) => litteraux(m[1]))
    expect(listes, `${definition.fichier} : une seule liste « not in (...) » attendue`).toHaveLength(1)
    expect(trie(listes[0])).toEqual(trie(ROLES_AUTO_ATTRIBUABLES))
  })

  it('reste SECURITY DEFINER avec un search_path vide', () => {
    expect(definition.entete).toMatch(/security\s+definer/i)
    expect(definition.entete).toMatch(/set\s+search_path\s*=\s*''/i)
  })

  it("aucune liste de rôles de la migration (reprise de données comprise) ne sort de ROLES_AUTO_ATTRIBUABLES", () => {
    const connus = new Set([...ROLES_AUTO_ATTRIBUABLES, ...ROLES_PRIVILEGIES])
    for (const m of definition.sqlFichier.matchAll(/\bin\s*\(([^()]*'[^()]*)\)/gi)) {
      const valeurs = litteraux(m[1])
      if (!valeurs.some((v) => connus.has(v))) continue
      for (const v of valeurs) expect(ROLES_AUTO_ATTRIBUABLES, `${definition.fichier} : '${v}'`).toContain(v)
    }
  })
})

// ── POST /api/auth/init-role applique la même liste ─────────────────────────────
const h = vi.hoisted(() => ({
  utilisateur: null as null | { id: string; app_metadata: Record<string, unknown> },
  updateUserById: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.utilisateur) }))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { auth: { admin: { updateUserById: h.updateUserById } } },
}))

async function initRole(role: string) {
  const { POST } = await import('@/app/api/auth/init-role/route')
  const requete = new Request('http://localhost:3000/api/auth/init-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  return POST(requete as never)
}

describe('POST /api/auth/init-role', () => {
  beforeEach(() => {
    h.utilisateur = { id: 'utilisateur-1', app_metadata: {} }
    h.updateUserById.mockReset().mockResolvedValue({ error: null })
  })

  it.each([...ROLES_AUTO_ATTRIBUABLES])("pose le rôle auto-attribuable « %s »", async (role) => {
    const reponse = await initRole(role)
    expect(reponse.status).toBe(200)
    expect(h.updateUserById).toHaveBeenCalledWith('utilisateur-1', { app_metadata: { role } })
  })

  it.each(ROLES_PRIVILEGIES)("refuse le rôle « %s » (403), sans écrire app_metadata", async (role) => {
    const reponse = await initRole(role)
    expect(reponse.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })
})
