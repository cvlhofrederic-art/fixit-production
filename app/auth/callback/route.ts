import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

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
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    // Detect locale from cookie (set by middleware / i18n context) with fr as default
    const localeCookie = cookieStore.get('locale')?.value
    const locale = localeCookie === 'pt' ? 'pt' : 'fr'

    if (!error && data.user) {
      // Redirect based on user role
      const role = data.user.app_metadata?.role
      if (role === 'artisan') {
        return NextResponse.redirect(`${origin}/${locale}/artisan/dashboard`)
      } else if (['pro_societe', 'pro_conciergerie', 'pro_gestionnaire'].includes(role)) {
        return NextResponse.redirect(`${origin}/${locale}/pro/dashboard`)
      } else {
        return NextResponse.redirect(`${origin}/${locale}/client/dashboard`)
      }
    }

    return NextResponse.redirect(`${origin}/${locale}/auth/login`)
  }

  // If no code, redirect to login (default fr)
  return NextResponse.redirect(`${origin}/fr/auth/login`)
}
