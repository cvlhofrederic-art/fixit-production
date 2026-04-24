import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── i18n constants (duplicated from lib/i18n/config to avoid import issues in middleware) ───
const SUPPORTED_LOCALES = ['fr', 'pt', 'en', 'nl', 'es']
const DEFAULT_LOCALE = 'fr'

function getLocaleFromPath(pathname: string): string | null {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return null
}

function stripLocalePrefix(pathname: string, locale: string): string {
  if (pathname === `/${locale}`) return '/'
  if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1)
  return pathname
}

// Francophone countries — auto-detect FR
const FRANCOPHONE_COUNTRIES = [
  'FR','BE','CH','LU','MC','CA','SN','CI','ML','BF','NE','TG','BJ','GN',
  'CG','CD','CM','GA','TD','CF','DJ','KM','MG','RE','GP','MQ','GF','YT','NC','PF','WF',
]
// Lusophone countries — auto-detect PT
const LUSOPHONE_COUNTRIES = ['PT','BR','AO','MZ','CV','GW','TL','ST']

function detectPreferredLocale(request: NextRequest): string {
  // 1. Cookie (user's explicit choice always wins)
  const cookieLocale = request.cookies.get('locale')?.value
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) return cookieLocale
  // 2. Vercel geolocation (available on Vercel Edge Runtime)
  const country = (request as any).geo?.country
  if (country) {
    if (LUSOPHONE_COUNTRIES.includes(country)) return 'pt'
    if (FRANCOPHONE_COUNTRIES.includes(country)) return 'fr'
  }
  // 3. Accept-Language header (check pt and en before falling back to fr)
  const acceptLang = request.headers.get('accept-language') || ''
  if (acceptLang.toLowerCase().includes('pt')) return 'pt'
  if (acceptLang.toLowerCase().includes('en')) return 'en'
  if (acceptLang.toLowerCase().includes('nl')) return 'nl'
  if (acceptLang.toLowerCase().includes('es')) return 'es'
  // 4. Default
  return DEFAULT_LOCALE
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── CSP nonce (replaces static unsafe-inline for script-src) ──
  const nonce = btoa(crypto.randomUUID())
  const isDev = process.env.NODE_ENV === 'development'
  const cspHeader = [
    "default-src 'self'",
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.groq.com https://recherche-entreprises.api.gouv.fr https://api-adresse.data.gouv.fr https://nominatim.openstreetmap.org https://geocoding-api.open-meteo.com https://api.open-meteo.com https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.vercel-insights.com",
    "frame-src https://js.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')

  // ── Skip locale logic for API routes, internal Next.js routes, and admin routes ──
  const isInternalRoute = pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/admin/')

  // ── CSRF Protection : vérifier Origin pour les requêtes mutantes sur /api/ ──
  if (pathname.startsWith('/api/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin')
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'https://vitfix.io',
      'https://fixit-production.vercel.app',  // Vercel preview/staging
      'capacitor://localhost',     // iOS Capacitor
      'https://localhost',         // F13: Android Capacitor (androidScheme: https)
    ]
    // Permettre les requêtes server-to-server (pas d'origin) et les requêtes valides
    const isOriginAllowed = (o: string): boolean => {
      try {
        const parsed = new URL(o)
        return allowedOrigins.some(allowed => {
          const allowedUrl = new URL(allowed)
          return parsed.protocol === allowedUrl.protocol && parsed.hostname === allowedUrl.hostname && parsed.port === allowedUrl.port
        })
      } catch {
        return false
      }
    }
    if (origin && !isOriginAllowed(origin)) {
      return new NextResponse(JSON.stringify({ error: 'CSRF: Origin non autorisé' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Content-Security-Policy': cspHeader },
      })
    }
  }

  // ── LOCALE DETECTION & REDIRECT ──
  let locale: string = DEFAULT_LOCALE
  let strippedPathname = pathname

  if (!isInternalRoute) {
    const pathLocale = getLocaleFromPath(pathname)

    if (!pathLocale) {
      // No locale prefix → redirect to /{detected-locale}/...
      locale = detectPreferredLocale(request)
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}${pathname}`
      const response = NextResponse.redirect(url)
      response.cookies.set('locale', locale, { path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
      response.headers.set('Content-Security-Policy', cspHeader)
      return response
    }

    // Has locale prefix → extract and strip for auth route checks
    locale = pathLocale
    strippedPathname = stripLocalePrefix(pathname, locale)

    // Admin routes live outside locale folders — strip the prefix and redirect
    if (strippedPathname.startsWith('/admin/') || strippedPathname === '/admin') {
      const url = request.nextUrl.clone()
      url.pathname = strippedPathname
      const response = NextResponse.redirect(url)
      response.headers.set('Content-Security-Policy', cspHeader)
      return response
    }
  }

  // ── Inject nonce/locale into request headers so the app (layout.tsx) can read them ──
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-locale', locale)
  const supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  // ── PERF: Skip auth for public routes that never need authentication ──
  // These are SEO pages, blog, static content — no auth check saves 50-200ms per request
  const needsAuth = !isInternalRoute && (
    strippedPathname === '' || strippedPathname === '/' || strippedPathname === '/auth/login' ||
    strippedPathname.startsWith('/client/dashboard') ||
    strippedPathname.startsWith('/pro/dashboard') ||
    strippedPathname.startsWith('/pro/mobile') ||
    strippedPathname.startsWith('/pro/login') ||
    strippedPathname.startsWith('/pro/espace-pro') ||
    strippedPathname.startsWith('/syndic/') ||
    strippedPathname.startsWith('/admin/') ||
    strippedPathname.startsWith('/coproprietaire/')
  )

  if (!needsAuth) {
    if (!isInternalRoute) {
      supabaseResponse.cookies.set('locale', locale, { path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    }
    supabaseResponse.headers.set('X-API-Version', '1.0.0')
    supabaseResponse.headers.set('Content-Security-Policy', cspHeader)
    return supabaseResponse
  }

  // ── SUPABASE AUTH (pattern officiel @supabase/ssr — NE PAS recréer NextResponse dans setAll) ──
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // ✅ Pattern officiel Supabase : écrire UNIQUEMENT sur la réponse existante
          // ❌ NE PAS recréer NextResponse.next() ici (détruit les cookies précédents)
          // ❌ NE PAS écrire sur request.cookies (cause des bugs avec Next.js)
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: DO NOT remove this line — it refreshes the auth token
  // DO NOT add any code between createServerClient and getUser()
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase unreachable — treat as unauthenticated and continue
  }

  // Helper: check if role is a syndic role
  const isSyndicRole = (role: string | undefined) =>
    role === 'syndic' || (typeof role === 'string' && role.startsWith('syndic_'))

  // SÉCURITÉ : uniquement app_metadata (server-only, non forgeable)
  const role = user?.app_metadata?.role as string | undefined

  // Helper: create a redirect with locale prefix — ALWAYS copies refreshed auth cookies
  const localeRedirect = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = isInternalRoute ? path : `/${locale}${path}`
    const resp = NextResponse.redirect(url)
    if (!isInternalRoute) {
      resp.cookies.set('locale', locale, { path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    }
    // Propager les cookies Supabase rafraîchis vers le browser
    supabaseResponse.cookies.getAll().forEach(cookie => {
      resp.cookies.set(cookie.name, cookie.value, { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    })
    resp.headers.set('Content-Security-Policy', cspHeader)
    return resp
  }

  // Super admin : accès libre à toutes les routes (pas de redirection forcée)
  if (role === 'super_admin') {
    supabaseResponse.cookies.set('locale', locale, { path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    supabaseResponse.headers.set('X-API-Version', '1.0.0')
    supabaseResponse.headers.set('Content-Security-Policy', cspHeader)
    return supabaseResponse
  }

  // Authenticated user on landing/login pages → redirect to their dashboard
  const isLandingOrLogin = strippedPathname === '' || strippedPathname === '/' || strippedPathname === '/auth/login'
  if (user && isLandingOrLogin) {
    if (role === 'artisan') return localeRedirect('/artisan/dashboard')
    if (['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role || '')) return localeRedirect('/pro/dashboard')
    if (isSyndicRole(role)) return localeRedirect('/syndic/dashboard')
    if (role === 'coproprio') return localeRedirect('/coproprietaire/dashboard')
    return localeRedirect('/client/dashboard')
  }

  // Protected routes: redirect to login if not authenticated
  if (!user && (
    strippedPathname.startsWith('/client/dashboard') ||
    strippedPathname.startsWith('/pro/dashboard') ||
    strippedPathname.startsWith('/pro/mobile') ||
    strippedPathname.startsWith('/artisan/dashboard') ||
    strippedPathname.startsWith('/syndic/dashboard') ||
    strippedPathname.startsWith('/admin/dashboard') ||
    strippedPathname.startsWith('/coproprietaire/dashboard')
  )) {
    if (strippedPathname.startsWith('/pro/') || strippedPathname.startsWith('/artisan/')) {
      return localeRedirect('/auth/login')
    } else if (strippedPathname.startsWith('/syndic/')) {
      return localeRedirect('/syndic/login')
    } else if (strippedPathname.startsWith('/admin/')) {
      return localeRedirect('/admin/login')
    } else if (strippedPathname.startsWith('/coproprietaire/')) {
      return localeRedirect('/coproprietaire/portail')
    } else {
      return localeRedirect('/auth/login')
    }
  }

  // Role-based access control
  if (user) {
    // Syndic users: redirect away from non-syndic dashboards
    if (isSyndicRole(role)) {
      if (
        strippedPathname.startsWith('/client/dashboard') ||
        strippedPathname.startsWith('/pro/dashboard') ||
        strippedPathname.startsWith('/pro/mobile') ||
        strippedPathname.startsWith('/artisan/dashboard')
      ) {
        return localeRedirect('/syndic/dashboard')
      }
    }

    // Artisan: URL dédiée /artisan/dashboard — redirige /pro/dashboard vers /artisan/dashboard
    if (role === 'artisan') {
      if (strippedPathname.startsWith('/client/dashboard') || strippedPathname.startsWith('/syndic/dashboard')) {
        return localeRedirect('/artisan/dashboard')
      }
      if (strippedPathname.startsWith('/pro/dashboard')) {
        return localeRedirect('/artisan/dashboard')
      }
    }

    // Pro roles (societe, conciergerie, gestionnaire) — restent sur /pro/dashboard
    const isProRole = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role || '')
    if (isProRole) {
      if (strippedPathname.startsWith('/client/dashboard') || strippedPathname.startsWith('/syndic/dashboard')) {
        return localeRedirect('/pro/dashboard')
      }
      if (strippedPathname.startsWith('/artisan/dashboard')) {
        return localeRedirect('/pro/dashboard')
      }
    }

    // Coproprietaire / Locataire: redirect away from pro and syndic dashboards
    const isCoproRole = role === 'coproprio' || role === 'locataire'
    if (isCoproRole) {
      if (strippedPathname.startsWith('/pro/dashboard') || strippedPathname.startsWith('/pro/mobile') || strippedPathname.startsWith('/artisan/dashboard') || strippedPathname.startsWith('/syndic/dashboard')) {
        return localeRedirect('/coproprietaire/dashboard')
      }
    }

    // Client (particulier): can't access pro or syndic dashboard
    if (!isSyndicRole(role) && role !== 'artisan' && !isProRole && !isCoproRole) {
      if (strippedPathname.startsWith('/pro/dashboard') || strippedPathname.startsWith('/pro/mobile') || strippedPathname.startsWith('/artisan/dashboard')) {
        return localeRedirect('/client/dashboard')
      }
      if (strippedPathname.startsWith('/syndic/dashboard')) {
        return localeRedirect('/auth/login')
      }
    }
  }

  // Set locale cookie on all responses
  if (!isInternalRoute) {
    supabaseResponse.cookies.set('locale', locale, { path: '/', maxAge: 365 * 24 * 60 * 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  }

  supabaseResponse.headers.set('X-API-Version', '1.0.0')
  supabaseResponse.headers.set('Content-Security-Policy', cspHeader)

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2|woff|ico|mp4)$).*)',
  ],
}
