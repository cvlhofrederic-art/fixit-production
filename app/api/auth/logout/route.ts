// ── POST /api/auth/logout — déconnexion côté serveur ────────────────────────
// Ferme la session Supabase du navigateur même quand le client JS n'y arrive plus (getUser en échec, page bloquée) :
//   1. auth.signOut({ scope: 'local' }) via un client @supabase/ssr dont setAll écrit sur la réponse ;
//   2. quoi qu'il arrive (erreur, exception, Supabase muet), suppression de chaque cookie sb-* de la requête et de la
//      réponse, morceaux .0/.1 et code-verifier compris (Path=/, Max-Age=0, Secure, SameSite=Lax, sans Domain).
// Ne touche QU'À la session Supabase : aucun autre cookie, aucun stockage du navigateur, aucune donnée du compte.
//
// Entrée : corps JSON ou formulaire { locale?: 'fr' | 'pt' | 'en' | 'es' | 'nl' }, validé par Zod. À défaut, cookie
// `locale` validé, puis 'fr'. L'URL de redirection n'est construite qu'avec une langue validée, en chemin relatif.
// Sortie : 303 vers /{locale}/auth/login/ (Cache-Control: no-store) ; 200 { ok: true } pour un fetch JSON
// (Accept: application/json), avec les mêmes Set-Cookie. GET → 405 : une déconnexion ne doit pas être déclenchable
// par un lien, un préchargement ou une balise d'un site tiers.
// CSRF : une requête dont l'en-tête Origin est présent et diffère de l'origine du site est refusée (403), en plus du
// contrôle d'Origin du middleware sur /api/.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { SUPPORTED_LOCALES } from '@/lib/i18n/config'
import { logger } from '@/lib/logger'

const schemaLocale = z.enum(SUPPORTED_LOCALES)
type LocaleDeconnexion = z.infer<typeof schemaLocale>

// Une langue invalide n'invalide pas la déconnexion : elle est ignorée et la langue par défaut s'applique.
const schemaCorps = z.object({
  locale: schemaLocale.optional().catch(undefined),
})

const LOCALE_PAR_DEFAUT: LocaleDeconnexion = 'fr'
const PREFIXE_COOKIES_SESSION = 'sb-'
const SANS_CACHE = 'no-store'
// Au-delà, la route répond sans attendre Supabase : la suppression des cookies suffit à fermer la session du navigateur.
const DELAI_SIGNOUT_MS = 5000

function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}

function origineAutorisee(request: NextRequest): boolean {
  const origine = request.headers.get('origin')
  // Sans en-tête Origin (requête serveur à serveur, navigation ancienne) : même règle que le middleware.
  if (origine === null) return true
  return origine === request.nextUrl.origin
}

async function lireCorps(request: NextRequest): Promise<unknown> {
  const typeContenu = (request.headers.get('content-type') ?? '').toLowerCase()
  try {
    if (typeContenu.includes('application/json')) return await request.json()
    if (typeContenu.includes('application/x-www-form-urlencoded') || typeContenu.includes('multipart/form-data')) {
      const formulaire = await request.formData()
      return { locale: formulaire.get('locale') ?? undefined }
    }
  } catch (erreur) {
    logger.warn('[auth/logout] Corps illisible, langue par défaut', { erreur: messageErreur(erreur) })
  }
  return undefined
}

async function langueDeRedirection(request: NextRequest): Promise<LocaleDeconnexion> {
  const corps = schemaCorps.safeParse(await lireCorps(request))
  if (corps.success && corps.data.locale) return corps.data.locale
  const cookie = schemaLocale.safeParse(request.cookies.get('locale')?.value)
  if (cookie.success) return cookie.data
  return LOCALE_PAR_DEFAUT
}

function reponseApresDeconnexion(request: NextRequest, locale: LocaleDeconnexion): NextResponse {
  const appelJson = (request.headers.get('accept') ?? '').toLowerCase().includes('application/json')
  const reponse = appelJson
    ? NextResponse.json({ ok: true }, { status: 200 })
    : new NextResponse(null, { status: 303, headers: { Location: `/${locale}/auth/login/` } })
  reponse.headers.set('Cache-Control', SANS_CACHE)
  return reponse
}

/** signOut en portée locale ; ne lève jamais. Les cookies que Supabase écrit (setAll) vont sur la réponse. */
async function fermerSessionSupabase(request: NextRequest, reponse: NextResponse): Promise<void> {
  let reponseFigee = false
  let minuteur: ReturnType<typeof setTimeout> | undefined
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-build',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesAEcrire) {
            // Une écriture tardive (après le délai) ne doit pas reposer un cookie de session sur la réponse.
            if (reponseFigee) return
            cookiesAEcrire.forEach(({ name, value, options }) => {
              reponse.cookies.set(name, value, options)
            })
          },
        },
      },
    )
    const issue = await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise<'delai'>((resolve) => {
        minuteur = setTimeout(() => resolve('delai'), DELAI_SIGNOUT_MS)
      }),
    ])
    if (issue === 'delai') {
      logger.warn('[auth/logout] signOut sans réponse, cookies de session supprimés quand même', { delaiMs: DELAI_SIGNOUT_MS })
    } else if (issue.error) {
      logger.warn('[auth/logout] signOut en erreur, cookies de session supprimés quand même', {
        erreur: issue.error.message,
        statut: issue.error.status,
      })
    }
  } catch (erreur) {
    logger.warn('[auth/logout] signOut a levé une exception, cookies de session supprimés quand même', {
      erreur: messageErreur(erreur),
    })
  } finally {
    reponseFigee = true
    clearTimeout(minuteur)
  }
}

export async function POST(request: NextRequest) {
  if (!origineAutorisee(request)) {
    logger.warn('[auth/logout] Origine refusée', { origine: request.headers.get('origin')?.slice(0, 200) })
    return NextResponse.json(
      { error: 'Origine non autorisée' },
      { status: 403, headers: { 'Cache-Control': SANS_CACHE } },
    )
  }

  const locale = await langueDeRedirection(request)
  const reponse = reponseApresDeconnexion(request, locale)

  await fermerSessionSupabase(request, reponse)

  // Suppression forcée : même nom, même Path, sans Domain (cookies posés en host-only), pour qu'aucun ne survive.
  // Noms de la requête ET de la réponse : avec un jeton expiré, signOut rafraîchit d'abord la session et setAll peut
  // poser sur la réponse un fragment sous un nom absent de la requête (nouveau découpage) ; si /logout échoue ensuite,
  // @supabase/ssr ne le supprime pas, et le navigateur garderait une session neuve.
  const nomsSession = new Set<string>()
  for (const { name } of [...request.cookies.getAll(), ...reponse.cookies.getAll()]) {
    if (name.startsWith(PREFIXE_COOKIES_SESSION)) nomsSession.add(name)
  }
  for (const name of nomsSession) {
    reponse.cookies.set(name, '', { path: '/', maxAge: 0, secure: true, sameSite: 'lax' })
  }

  return reponse
}

export function GET() {
  return NextResponse.json(
    { error: 'Méthode non autorisée' },
    { status: 405, headers: { Allow: 'POST', 'Cache-Control': SANS_CACHE } },
  )
}
