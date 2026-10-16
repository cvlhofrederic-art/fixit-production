import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getUserRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

// ════════════════════════════════════════════════════════════════════════════
// Gardes communes des routes de fin d'inscription artisan
// (app/api/pro/register/{finalize-artisan,motifs-artisan,parrainage-artisan}).
//
// Quand la confirmation d'e-mail est active, supabase.auth.signUp ne renvoie
// pas de session : ces routes reçoivent un user_id au lieu d'un Bearer. Même
// garde que /api/auth/create-profile : compte créé il y a moins de 10 minutes,
// plus le rôle artisan lu dans app_metadata (posé par le trigger
// trg_sync_user_role, non forgeable), jamais dans user_metadata.
// ════════════════════════════════════════════════════════════════════════════

export const FENETRE_INSCRIPTION_MS = 10 * 60 * 1000

export type ProfilArtisan = Record<string, unknown> & { id: string }

type Verdict<T> = ({ ok: true } & T) | { ok: false; reponse: NextResponse }

function refus(message: string, status: number): { ok: false; reponse: NextResponse } {
  return { ok: false, reponse: NextResponse.json({ error: message }, { status }) }
}

export async function verifierInscriptionArtisan(userId: string): Promise<Verdict<{ user: User }>> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error || !data?.user) return refus('Utilisateur introuvable', 404)
  if (Date.now() - new Date(data.user.created_at).getTime() > FENETRE_INSCRIPTION_MS) {
    return refus("Délai d'inscription dépassé", 403)
  }
  if (getUserRole(data.user) !== 'artisan') return refus('Réservé aux artisans', 403)
  return { ok: true, user: data.user }
}

// '*' : renvoie les colonnes existantes, sans échouer sur une colonne absente
// (le schéma de prod ne suit pas toujours les migrations).
export async function lireProfilArtisan(userId: string, contexte: string): Promise<Verdict<{ profil: ProfilArtisan }>> {
  const { data: profil, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    logger.error(`[${contexte}] profile fetch error:`, error)
    return refus('Erreur serveur', 500)
  }
  if (!profil) return refus('Profil introuvable', 404)
  return { ok: true, profil }
}
