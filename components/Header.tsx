'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  email?: string
  user_metadata?: {
    role?: string
    full_name?: string
  }
}

export default function Header() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setShowUserMenu(false)
    router.push('/')
  }

  const userRole = user?.user_metadata?.role
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const userInitials = userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : '?'
  const dashboardUrl = userRole === 'artisan' ? '/pro/dashboard' : '/client/dashboard'

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">{'\u26A1'}</span>
            <span className="text-2xl font-bold text-[#FFC107]">VITFIX</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8" role="navigation" aria-label="Navigation principale">
            <Link
              href="/recherche"
              className="text-gray-700 hover:text-[#FFC107] transition-colors font-medium"
            >
              Trouver un artisan
            </Link>
            <Link
              href="/#comment"
              className="text-gray-700 hover:text-[#FFC107] transition-colors font-medium"
            >
              Comment &ccedil;a marche
            </Link>
            {!user ? (
              <>
                <Link
                  href="/pro/login"
                  className="text-gray-700 hover:text-[#FFC107] transition-colors font-medium"
                >
                  Espace artisan
                </Link>
                <Link
                  href="/auth/login"
                  className="bg-[#FFC107] hover:bg-[#FFB300] text-gray-900 px-6 py-2.5 rounded-xl font-semibold transition-all"
                >
                  Se connecter
                </Link>
              </>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 bg-[#FFC107] hover:bg-[#FFB300] text-gray-900 pl-3 pr-4 py-2.5 rounded-xl font-semibold transition-all"
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                >
                  <span className="w-7 h-7 bg-white/30 rounded-full flex items-center justify-center text-xs font-bold">
                    {userInitials}
                  </span>
                  <span className="hidden sm:inline">{userName.split(' ')[0]}</span>
                  <svg className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50" role="menu" aria-label="Menu utilisateur">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-semibold text-gray-900 text-sm">{userName}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <Link
                        href={dashboardUrl}
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#FFF9E6] transition"
                        role="menuitem"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Mon espace
                      </Link>
                      <Link
                        href="/recherche"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#FFF9E6] transition"
                        role="menuitem"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Trouver un artisan
                      </Link>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition w-full text-left"
                          role="menuitem"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          D&eacute;connexion
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-3 border-t border-gray-100 pt-3" role="navigation" aria-label="Menu mobile">
            <Link
              href="/recherche"
              className="block text-gray-600 hover:text-[#FFC107] transition font-medium py-2"
              onClick={() => setMenuOpen(false)}
            >
              Trouver un artisan
            </Link>
            <Link
              href="/#comment"
              className="block text-gray-600 hover:text-[#FFC107] transition font-medium py-2"
              onClick={() => setMenuOpen(false)}
            >
              Comment &ccedil;a marche
            </Link>
            {!user ? (
              <>
                <Link
                  href="/pro/login"
                  className="block text-gray-600 hover:text-[#FFC107] transition font-medium py-2"
                  onClick={() => setMenuOpen(false)}
                >
                  Espace artisan
                </Link>
                <Link
                  href="/auth/login"
                  className="block text-center bg-[#FFC107] hover:bg-[#FFB300] text-gray-900 px-6 py-2.5 rounded-xl font-semibold transition-all"
                  onClick={() => setMenuOpen(false)}
                >
                  Se connecter
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={dashboardUrl}
                  className="block text-gray-600 hover:text-[#FFC107] transition font-medium py-2"
                  onClick={() => setMenuOpen(false)}
                >
                  Mon espace
                </Link>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false) }}
                  className="block w-full text-left text-red-600 hover:text-red-700 transition font-medium py-2"
                >
                  D&eacute;connexion
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
