// ── Fin de connexion par fournisseur externe (Google) ──────────────────────
// Échange côté serveur du code PKCE contre la session, puis aiguillage selon le rôle. Le vérificateur PKCE
// est dans les cookies du navigateur qui appelle cette route : c'est lui, et lui seul, qui peut terminer la
// connexion ouverte depuis ce même navigateur.
//
// `app=1` : l'appel vient de l'appli Vitfix Pro, qui a ouvert Google dans une fenêtre du navigateur du
// système et récupéré la main par un lien profond (lib/auth/google-app-mobile.ts). Un artisan y retrouve
// alors l'espace mobile au lieu du tableau de bord d'ordinateur. Ce drapeau ne change que la destination.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { destinationApresConnexion } from '@/lib/auth/destination-par-role'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const appMobile = searchParams.get('app') === '1'

  const cookieStore = await cookies()
  // Langue posée par le middleware / le contexte i18n, « fr » par défaut.
  const localeCookie = cookieStore.get('locale')?.value
  const locale = localeCookie === 'pt' ? 'pt' : 'fr'

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/auth/login`)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (erreur) {
            // Dans un Route Handler l'écriture est permise : un échec ici veut dire session perdue, et
            // l'utilisateur rebondira entre son espace et la connexion. Jamais silencieux.
            logger.error('[auth/callback] cookies de session non posés', erreur)
          }
        },
      },
    }
  )

  // Code expiré, déjà utilisé, ou vérificateur absent (lien profond forgé par une autre application, ou
  // adresse de retour de l'appli absente des Redirect URLs du projet Supabase) : aucune session n'est
  // ouverte, retour au formulaire de connexion. L'échange peut aussi lever (réseau, Supabase indisponible) :
  // sans ce filet, l'appli afficherait sa page « hors connexion » sur une 500, sans retour possible.
  let utilisateur = null
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) {
      logger.warn('[auth/callback] échange refusé', { motif: error?.message ?? 'aucun utilisateur', appMobile })
    } else {
      utilisateur = data.user
    }
  } catch (erreur) {
    logger.error('[auth/callback] échange impossible', erreur)
  }

  if (!utilisateur) {
    return NextResponse.redirect(`${origin}/${locale}/auth/login`)
  }

  // Même table de destinations que la page de connexion : une seule source (lib/auth/destination-par-role).
  const destination = destinationApresConnexion(utilisateur.app_metadata?.role, locale, { appMobile })
  return NextResponse.redirect(`${origin}${destination}`)
}
