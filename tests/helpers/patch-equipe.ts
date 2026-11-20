// tests/helpers/patch-equipe.ts
//
// Cas communs des tests d'un PATCH d'équipe qui vérifie le compte visé par un changement de rôle avant toute écriture :
// compte supprimé, lecture ou écriture du compte en échec, ligne sans compte ni invitation, rôle inconnu. Chaque test
// de route l'appelle avec sa route, son faux Supabase et les rôles de son espace, et garde ses propres cas.

import { expect, it, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

/** Requête PATCH authentifiée sur une route d'équipe. */
export function requetePatch(url: string, corps: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
}

/** Réponse de supabase.auth.admin.getUserById pour un compte existant. */
export function compteExistant(id: string, appMetadata: Record<string, unknown>) {
  return { data: { user: { id, app_metadata: appMetadata } }, error: null }
}

/** La route et son faux Supabase. */
export interface RouteSimulee {
  /** Appelle la route avec ce corps. */
  modifier: (corps: Record<string, unknown>) => Promise<Response>
  /** Faux supabase.auth.admin de la route. */
  admin: { getUserById: Mock; updateUserById: Mock }
  /** Mises à jour de la table d'équipe faites par la route. */
  misesAJour: () => Array<{ donnees?: unknown }>
  /** Remplace la ligne visée par une copie aux champs modifiés. */
  poserLigne: (modif: Record<string, unknown>) => void
}

/** La ligne visée, son compte (app_metadata d'un membre légitime), un rôle valide autre que le sien, un rôle refusé. */
export interface DonneesEspace {
  idLigne: string
  idCompte: string
  membre: Record<string, unknown>
  roleValide: string
  roleInconnu: string
}

/** Message journalisé quand app_metadata ne s'écrit pas, et le logger.error simulé. */
export interface JournalSimule { message: string; loggerError: unknown }

/** Cas qui valent pour les deux espaces ; à appeler dans un describe du test de route. */
export function casCommunsDuPatch(route: RouteSimulee, donnees: DonneesEspace, journal: JournalSimule): void {
  const o = { ...route, ...donnees }
  const changerRole = (role = o.roleValide) => o.modifier({ member_id: o.idLigne, role })
  const rienNEstEcrit = () => {
    expect(o.admin.updateUserById).not.toHaveBeenCalled()
    expect(o.misesAJour()).toHaveLength(0)
  }

  it.each([
    ['compte supprimé (ligne orpheline) : 403, comme un compte hors de l’équipe', { message: 'User not found', status: 404, code: 'user_not_found' }, 403],
    ['lecture du compte visé en échec : 500', { message: 'timeout' }, 500],
  ])('%s ; rien n’est écrit', async (_cas, erreur, statut) => {
    o.admin.getUserById.mockResolvedValue({ data: { user: null }, error: erreur })
    const res = await changerRole()
    rienNEstEcrit()
    expect(res.status).toBe(statut)
  })

  it.each([
    ['erreur rendue', (admin: RouteSimulee['admin']) => admin.updateUserById.mockResolvedValue({ data: null, error: { message: 'timeout' } })],
    ['exception', (admin: RouteSimulee['admin']) => admin.updateUserById.mockRejectedValue(new Error('réseau'))],
  ])('écriture de app_metadata en échec (%s) : 500 et journalisé, plutôt qu’un 200 qui laisserait les droits du compte', async (_cas, echec) => {
    o.admin.getUserById.mockResolvedValue(compteExistant(o.idCompte, o.membre))
    echec(o.admin)
    const res = await changerRole()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/pas pu être appliqué au compte/)
    expect(journal.loggerError).toHaveBeenCalledWith(journal.message, { member_id: o.idLigne }, expect.anything())
  })

  it('ligne sans compte ni invitation (ajout direct) : rôle changé sur la ligne seule, aucun compte lu ni écrit', async () => {
    o.poserLigne({ user_id: null, invite_token: null })
    const res = await changerRole()
    expect(res.status).toBe(200)
    expect(o.misesAJour()[0].donnees).toEqual({ role: o.roleValide })
    expect(o.admin.getUserById).not.toHaveBeenCalled()
    expect(o.admin.updateUserById).not.toHaveBeenCalled()
  })

  it('rôle inconnu : 400, rien n’est lu ni écrit', async () => {
    const res = await changerRole(o.roleInconnu)
    expect(res.status).toBe(400)
    expect(o.admin.getUserById).not.toHaveBeenCalled()
    rienNEstEcrit()
  })
}
