// POST /api/auth/update-password — { password } : fin du parcours « mot de passe oublié » ouvert par le lien de
// l'e-mail (GET /auth/confirm/, parcours complet et raisons : lib/auth/lien-email.ts).
//
// Le jeton vient du cookie httpOnly posé par /auth/confirm (SameSite=Lax, envoyé seulement à /api/auth/, jamais par
// un POST venu d'un autre site) ; le middleware refuse en plus tout POST /api/ venu d'une autre origine. Vérification
// du jeton (verifyOtp) et changement du mot de passe dans un client Supabase sans stockage : la session de récupération
// ne quitte pas le serveur, aucun cookie de session n'est posé, l'utilisateur se connecte ensuite avec son nouveau mot
// de passe. Le mot de passe est contrôlé AVANT verifyOtp, qui consomme le jeton : une règle non respectée ne grille
// pas le lien. Jamais le jeton ni le mot de passe au journal.
import { createClient, type AuthError, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  CHEMIN_COOKIE_LIEN_MDP,
  COOKIE_LIEN_MDP,
  jetonLienValide,
  motDePasseConforme,
  type ErreurNouveauMotDePasse,
} from '@/lib/auth/lien-email'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

const CorpsRequete = z.object({ password: z.string().max(200) })

function reponse(corps: { ok: true } | { erreur: ErreurNouveauMotDePasse }, statut: number, effacerCookie: boolean) {
  const resultat = NextResponse.json(corps, { status: statut, headers: { 'Cache-Control': 'private, no-store' } })
  if (effacerCookie) {
    resultat.cookies.set(COOKIE_LIEN_MDP, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: CHEMIN_COOKIE_LIEN_MDP,
      maxAge: 0,
    })
  }
  return resultat
}

const echec = (erreur: ErreurNouveauMotDePasse, statut: number, effacerCookie = false) =>
  reponse({ erreur }, statut, effacerCookie)

/** Nouveau mot de passe lu et contrôlé, ou réponse de refus (jeton jamais consommé à ce stade). */
async function lireMotDePasse(request: NextRequest): Promise<string | NextResponse> {
  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return echec('requete-invalide', 400)
  }
  const lecture = CorpsRequete.safeParse(corps)
  if (!lecture.success) return echec('requete-invalide', 400)
  if (!motDePasseConforme(lecture.data.password)) return echec('mot-de-passe-faible', 400)
  return lecture.data.password
}

/** Refus de verifyOtp. GoTrue saturé ou injoignable : jeton intact, cookie gardé, l'utilisateur peut réessayer. */
function refusVerification(erreur: AuthError): NextResponse {
  const statut = erreur.status ?? 0
  if (statut === 429) return echec('trop-de-tentatives', 429)
  if (statut === 0 || statut >= 500) {
    logger.error('[auth/update-password] vérification du lien impossible', { code: erreur.code, statut })
    return echec('reessayer', 503)
  }
  // Jeton expiré, déjà utilisé ou inconnu.
  logger.warn('[auth/update-password] lien refusé par Supabase', { code: erreur.code, statut })
  return echec('lien-invalide', 400, true)
}

/** Refus de updateUser : le jeton est déjà consommé, le cookie ne sert plus. */
function refusMiseAJour(erreur: AuthError): NextResponse {
  if (erreur.code === 'same_password') return echec('meme-mot-de-passe', 422, true)
  if (erreur.code === 'weak_password') return echec('mot-de-passe-refuse', 422, true)
  logger.error('[auth/update-password] mot de passe non modifié', { code: erreur.code, statut: erreur.status })
  return echec('lien-invalide', 500, true)
}

/** Ferme la session de récupération ouverte pour ce seul changement ; un échec est journalisé, jamais renvoyé. */
async function revoquerSession(supabase: SupabaseClient) {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) logger.warn('[auth/update-password] session de récupération non révoquée', { code: error.code })
  } catch (erreur) {
    logger.warn('[auth/update-password] session de récupération non révoquée', { erreur: erreur instanceof Error ? erreur.name : 'inconnue' })
  }
}

export async function POST(request: NextRequest) {
  // Chaque essai part du Worker vers GoTrue : limite par visiteur, avant d'entamer celle de GoTrue.
  if (!(await checkRateLimit(`auth_update_password_${getClientIP(request)}`, 10, 300_000))) {
    return echec('trop-de-tentatives', 429)
  }

  const motDePasse = await lireMotDePasse(request)
  if (typeof motDePasse !== 'string') return motDePasse

  const jeton = request.cookies.get(COOKIE_LIEN_MDP)?.value ?? null
  if (!jetonLienValide(jeton)) return echec('lien-invalide', 400, true)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  let resultat: NextResponse
  try {
    const { error: erreurVerification } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: jeton })
    if (erreurVerification) return refusVerification(erreurVerification)
    const { error: erreurMiseAJour } = await supabase.auth.updateUser({ password: motDePasse })
    resultat = erreurMiseAJour ? refusMiseAJour(erreurMiseAJour) : reponse({ ok: true }, 200, true)
  } catch (erreur) {
    logger.error('[auth/update-password] échange avec Supabase interrompu', {}, erreur)
    return echec('reessayer', 503)
  }

  // Jeton vérifié : la session de récupération est fermée, que le mot de passe ait changé ou non.
  await revoquerSession(supabase)
  return resultat
}
