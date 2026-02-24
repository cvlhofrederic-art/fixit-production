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

  // Protected routes: redirect to login if not authenticated
  if (!user && (
    pathname.startsWith('/client/dashboard') ||
    pathname.startsWith('/pro/dashboard') ||
    pathname.startsWith('/pro/mobile') ||
    pathname.startsWith('/syndic/dashboard')
  )) {
    const url = request.nextUrl.clone()
    if (pathname.startsWith('/pro/')) {
      url.pathname = '/pro/login'
    } else if (pathname.startsWith('/syndic/')) {
      url.pathname = '/syndic/login'
    } else {
      url.pathname = '/auth/login'
    }
    return NextResponse.redirect(url)
  }

  // Role-based access control
  if (user) {
    const role = user.user_metadata?.role as string | undefined

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

    // Client (particulier): can't access pro or syndic dashboard
    if (!isSyndicRole(role) && role !== 'artisan') {
      if (pathname.startsWith('/pro/dashboard') || pathname.startsWith('/pro/mobile')) {
        const url = request.nextUrl.clone()
        url.pathname = '/client/dashboard'
        return NextResponse.redirect(url)
      }
      // Non-syndic users can't access syndic dashboard → redirect to their login
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
