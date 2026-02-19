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

  // Protected routes: redirect to login if not authenticated
  if (!user && (pathname.startsWith('/client/dashboard') || pathname.startsWith('/pro/dashboard') || pathname.startsWith('/pro/mobile'))) {
    const url = request.nextUrl.clone()
    if (pathname.startsWith('/pro/')) {
      url.pathname = '/pro/login'
    } else {
      url.pathname = '/auth/login'
    }
    return NextResponse.redirect(url)
  }

  // Role-based access control: artisans can't access client dashboard, vice versa
  if (user) {
    const role = user.user_metadata?.role

    if (pathname.startsWith('/pro/dashboard') && role !== 'artisan') {
      const url = request.nextUrl.clone()
      url.pathname = '/client/dashboard'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/client/dashboard') && role === 'artisan') {
      const url = request.nextUrl.clone()
      url.pathname = '/pro/dashboard'
      return NextResponse.redirect(url)
    }

    // /pro/mobile is artisan-only
    if (pathname.startsWith('/pro/mobile') && role !== 'artisan') {
      const url = request.nextUrl.clone()
      url.pathname = '/client/dashboard'
      return NextResponse.redirect(url)
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
