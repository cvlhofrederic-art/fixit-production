'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import LocaleLink from '@/components/common/LocaleLink'
import LanguageSwitcher from '@/components/common/LanguageSwitcher'

const SIMULATEUR_LABEL: Record<string, string> = {
  fr: '🧮 Simulateur de devis',
  pt: '🧮 Simulador de orçamento',
  en: '🧮 Quote calculator',
}
const SIMULATEUR_HREF: Record<string, string> = {
  fr: '/simulateur-devis',
  pt: '/simulador-orcamento',
  en: '/recherche',
}

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
  const { t } = useTranslation()
  const locale = useLocale()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
    router.push(`/${locale}/`)
  }

  const userRole = user?.user_metadata?.role
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const userInitials = userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : '?'
  const dashboardUrl = userRole === 'artisan' ? '/pro/dashboard' : '/client/dashboard'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[68px] flex items-center justify-between px-[clamp(1.5rem,5%,5rem)] bg-white/97 backdrop-blur-[16px] border-b border-[#EFEFEF]">
      {/* Logo */}
      <LocaleLink href="/" className="font-display font-black text-[1.7rem] text-dark no-underline flex items-center tracking-[-0.03em] uppercase">
        <span className="text-yellow">VIT</span>FIX
      </LocaleLink>

      {/* Desktop CTA */}
      <div className="hidden md:flex items-center gap-3">
        <LanguageSwitcher compact className="mr-1" />
        {!user ? (
          <>
            <LocaleLink
              href={SIMULATEUR_HREF[locale] || '/simulateur-devis'}
              className="px-[18px] py-2 text-dark text-[0.88rem] font-medium no-underline hover:text-yellow transition-all"
            >
              {SIMULATEUR_LABEL[locale] || SIMULATEUR_LABEL.fr}
            </LocaleLink>
            <LocaleLink
              href="/auth/login"
              className="px-[18px] py-2 border-[1.5px] border-dark rounded-full bg-transparent text-dark text-[0.88rem] font-medium no-underline hover:bg-dark hover:text-white transition-all"
            >
              {t('nav.login') || 'Se connecter'}
            </LocaleLink>
            <LocaleLink
              href="/recherche"
              className="px-5 py-2.5 rounded-full bg-yellow text-dark text-[0.88rem] font-semibold no-underline hover:bg-yellow-light hover:-translate-y-px transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]"
            >
              {t('nav.findArtisan') || 'Trouver un artisan'} →
            </LocaleLink>
          </>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 bg-yellow hover:bg-yellow-light text-dark pl-3 pr-4 py-2 rounded-full font-semibold transition-all cursor-pointer border-none"
              aria-expanded={showUserMenu}
              aria-haspopup="true"
            >
              <span className="w-7 h-7 bg-white/30 rounded-full flex items-center justify-center text-xs font-bold">
                {userInitials}
              </span>
              <span className="hidden sm:inline text-sm">{userName.split(' ')[0]}</span>
              <svg className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-border py-2 z-50" role="menu">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="font-semibold text-dark text-sm">{userName}</p>
                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                  </div>
                  <LocaleLink
                    href={dashboardUrl}
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-mid hover:bg-warm-gray transition no-underline"
                    role="menuitem"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    {t('nav.mySpace') || 'Mon espace'}
                  </LocaleLink>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition w-full text-left cursor-pointer border-none bg-transparent"
                      role="menuitem"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {t('nav.logout') || 'Déconnexion'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile Hamburger */}
      <div className="md:hidden flex items-center gap-2">
        <button
          className="p-2 text-mid hover:text-dark rounded-lg transition-colors cursor-pointer border-none bg-transparent"
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

      {/* Mobile Menu — simplifié, pas de liens nav */}
      {menuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-border shadow-lg md:hidden">
          <div className="px-[5%] py-4 space-y-1">
            {!user ? (
              <>
                <LocaleLink href="/auth/login" className="block text-center py-2.5 text-mid font-medium no-underline" onClick={() => setMenuOpen(false)}>
                  {t('nav.login') || 'Se connecter'}
                </LocaleLink>
                <LocaleLink href={SIMULATEUR_HREF[locale] || '/simulateur-devis'} className="block text-center py-2.5 text-mid font-medium no-underline" onClick={() => setMenuOpen(false)}>
                  {SIMULATEUR_LABEL[locale] || SIMULATEUR_LABEL.fr}
                </LocaleLink>
                <LocaleLink href="/recherche" className="block text-center bg-yellow text-dark rounded-full py-3 font-semibold no-underline mt-2" onClick={() => setMenuOpen(false)}>
                  {t('nav.findArtisan') || 'Trouver un artisan'} →
                </LocaleLink>
              </>
            ) : (
              <>
                <LocaleLink href={dashboardUrl} className="block text-mid hover:text-yellow transition font-medium py-2.5 no-underline" onClick={() => setMenuOpen(false)}>
                  {t('nav.mySpace') || 'Mon espace'}
                </LocaleLink>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false) }}
                  className="block w-full text-left text-red-600 hover:text-red-700 transition font-medium py-2.5 cursor-pointer border-none bg-transparent"
                >
                  {t('nav.logout') || 'Déconnexion'}
                </button>
              </>
            )}
            <div className="flex justify-center pt-3 border-t border-border mt-2">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
