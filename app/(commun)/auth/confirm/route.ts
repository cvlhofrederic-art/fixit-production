// GET /auth/confirm/?token_hash=…&type=recovery — lien de l'e-mail Supabase « Reset password » (modèle et ordre de
// bascule : docs/auth-liens-email.md ; parcours complet et raisons : lib/auth/lien-email.ts).
//
// Ne consomme PAS le jeton et n'appelle pas Supabase : il le range dans un cookie httpOnly réservé à /api/auth/, puis
// renvoie vers /{fr|pt}/auth/update-password/?lien=1, où POST /api/auth/update-password le vérifie à l'envoi du
// formulaire. Aucune session n'est ouverte ici : un lien piégé avec le jeton d'un autre compte ne connecte personne.
// Lien incomplet, malformé ou d'un autre type : page d'arrivée avec ?erreur=lien-invalide.
// Chemin sans langue dans l'e-mail : le middleware le préfixe par la langue du visiteur (en-tête x-locale lu ici) ;
// /fr et /pt sont réécrits vers cette route par /…/auth/:path*, en, nl et es par leurs règles de next.config.ts.
import { NextResponse, type NextRequest } from 'next/server'
import {
  CHEMIN_COOKIE_LIEN_MDP,
  COOKIE_LIEN_MDP,
  DUREE_COOKIE_LIEN_MDP_S,
  cheminArrivee,
  jetonLienValide,
  langueArrivee,
  typeLienEmail,
} from '@/lib/auth/lien-email'
import { logger } from '@/lib/logger'

export function GET(request: NextRequest) {
  const parametres = request.nextUrl.searchParams
  const type = typeLienEmail(parametres.get('type'))
  const jeton = parametres.get('token_hash')
  const langue = langueArrivee(request.headers.get('x-locale'), request.cookies.get('locale')?.value)
  const accepte = type !== null && jetonLienValide(jeton)

  const reponse = NextResponse.redirect(new URL(cheminArrivee(type, langue, accepte), request.url), 303)
  // Jamais mise en cache : elle porte le jeton en cookie.
  reponse.headers.set('Cache-Control', 'private, no-store')
  if (!accepte || jeton === null) {
    // Jamais le jeton au journal.
    logger.warn('[auth/confirm] lien refusé', { typeAccepte: type !== null, jeton: jeton !== null })
    return reponse
  }

  reponse.cookies.set(COOKIE_LIEN_MDP, jeton, {
    httpOnly: true,
    // Lax : envoyé par le POST de la page vitfix.io, jamais par un POST venu d'un autre site. Strict conviendrait
    // aussi, mais Lax reste sûr dans les navigateurs intégrés aux messageries (iOS compris).
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: CHEMIN_COOKIE_LIEN_MDP,
    maxAge: DUREE_COOKIE_LIEN_MDP_S,
  })
  return reponse
}
