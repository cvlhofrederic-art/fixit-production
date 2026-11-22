// ── CRM du secrétariat : réponses communes des routes app/api/crm/* ─────────
// Aucun détail interne dans les réponses (codes courts) ; le détail part dans le journal serveur.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { z } from 'zod'
import { logger } from '@/lib/logger'
import { nomAuteur, reponseErreurCrm } from './acces'
import { idSchema } from './schemas'
import { ErreurCrm, type AuteurCrm } from './serveur'

export const SANS_CACHE = { 'Cache-Control': 'private, no-store' }

export function jsonCrm(corps: unknown, status = 200): Response {
  return NextResponse.json(corps, { status, headers: SANS_CACHE })
}

export function auteurDe(user: User): AuteurCrm {
  return { id: user.id, nom: nomAuteur(user) }
}

/** Corps JSON validé par le schéma, ou réponse 400 (JSON illisible ou champ refusé, avec le nom des champs). */
export async function lireCorps<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; reponse: Response }> {
  let brut: unknown
  try {
    brut = await request.json()
  } catch {
    return { ok: false, reponse: reponseErreurCrm(400, 'json_invalide') }
  }
  const resultat = schema.safeParse(brut)
  if (!resultat.success) {
    const champs = [...new Set(resultat.error.issues.map((i) => i.path.join('.') || i.message))]
    return { ok: false, reponse: NextResponse.json({ error: 'saisie_invalide', champs }, { status: 400 }) }
  }
  return { ok: true, data: resultat.data }
}

/** Identifiant de l'URL (UUID), ou réponse 400. */
export function lireId(id: string): { ok: true; id: string } | { ok: false; reponse: Response } {
  const resultat = idSchema.safeParse(id)
  return resultat.success ? { ok: true, id: resultat.data } : { ok: false, reponse: reponseErreurCrm(400, 'id_invalide') }
}

/** Erreur levée par lib/crm/serveur.ts → 404, 409 ou 500 (journalisée). */
export function reponseErreurServeur(erreur: unknown, contexte: string): Response {
  if (erreur instanceof ErreurCrm && erreur.code === 'introuvable') return reponseErreurCrm(404, 'introuvable')
  if (erreur instanceof ErreurCrm && erreur.code === 'conflit') return reponseErreurCrm(409, 'conflit')
  logger.error(`[crm] ${contexte}`, { module: 'crm' }, erreur)
  return reponseErreurCrm(500, 'erreur_serveur')
}
