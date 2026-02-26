import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: DO NOT remove this line - it refreshes the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Helper: check if role is a syndic role
  const isSyndicRole = (role: string | undefined) =>
    role === 'syndic' || (typeof role === 'string' && role.startsWith('syndic_'))

  const role = user?.user_metadata?.role as string | undefined
  const isAdminOverride = user?.user_metadata?._admin_override === true

  const originalRole = user?.user_metadata?._original_role as string | undefined

  // Super admin : accès libre à tout, pas de redirection
  if (role === 'super_admin' && !isAdminOverride) {
    // Redirige vers le dashboard admin si pas déjà dessus
    if (!pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/dashboard'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Admin revenant d'un sous-dashboard (rôle changé mais _original_role = super_admin)
  // Laisser passer vers /admin/* pour que la page restaure le rôle
  if (originalRole === 'super_admin' && pathname.startsWith('/admin')) {
    return supabaseResponse
  }

  // Mode admin override : laisser passer vers n'importe quel dashboard
  if (isAdminOverride) {
    return supabaseResponse
  }

  // Protected routes: redirect to login if not authenticated
  if (!user && (
    pathname.startsWith('/client/dashboard') ||
    pathname.startsWith('/pro/dashboard') ||
    pathname.startsWith('/pro/mobile') ||
    pathname.startsWith('/syndic/dashboard') ||
    pathname.startsWith('/admin/dashboard') ||
    pathname.startsWith('/coproprietaire/dashboard')
  )) {
    const url = request.nextUrl.clone()
    if (pathname.startsWith('/pro/')) {
      url.pathname = '/pro/login'
    } else if (pathname.startsWith('/syndic/')) {
      url.pathname = '/syndic/login'
    } else if (pathname.startsWith('/admin/')) {
      url.pathname = '/admin/login'
    } else if (pathname.startsWith('/coproprietaire/')) {
      url.pathname = '/coproprietaire/portail'
    } else {
      url.pathname = '/auth/login'
    }
    return NextResponse.redirect(url)
  }

  // Role-based access control
  if (user) {
    // Syndic users: redirect away from non-syndic dashboards
    if (isSyndicRole(role)) {
      if (
        pathname.startsWith('/client/dashboard') ||
        pathname.startsWith('/pro/dashboard') ||
        pathname.startsWith('/pro/mobile')
      ) {
        const url = request.nextUrl.clone()
        url.pathname = '/syndic/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Artisan: can't access client or syndic dashboard
    if (role === 'artisan') {
      if (pathname.startsWith('/client/dashboard') || pathname.startsWith('/syndic/dashboard')) {
        const url = request.nextUrl.clone()
        url.pathname = '/pro/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Pro roles (société, conciergerie, gestionnaire)
    const isProRole = ['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role || '')
    if (isProRole) {
      if (pathname.startsWith('/client/dashboard') || pathname.startsWith('/syndic/dashboard')) {
        const url = request.nextUrl.clone()
        url.pathname = '/pro/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Copropriétaire / Locataire: redirect away from pro and syndic dashboards
    const isCoproRole = role === 'coproprio' || role === 'locataire'
    if (isCoproRole) {
      if (pathname.startsWith('/pro/dashboard') || pathname.startsWith('/pro/mobile') || pathname.startsWith('/syndic/dashboard')) {
        const url = request.nextUrl.clone()
        url.pathname = '/coproprietaire/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Client (particulier): can't access pro or syndic dashboard
    if (!isSyndicRole(role) && role !== 'artisan' && !isProRole && !isCoproRole) {
      if (pathname.startsWith('/pro/dashboard') || pathname.startsWith('/pro/mobile')) {
        const url = request.nextUrl.clone()
        url.pathname = '/client/dashboard'
        return NextResponse.redirect(url)
      }
      if (pathname.startsWith('/syndic/dashboard')) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
      }
    }
  }

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
