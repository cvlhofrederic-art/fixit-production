'use client'

import React from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { getRoleLabel } from '@/components/syndic-dashboard/types'
import type { Page } from '@/components/syndic-dashboard/types'

interface SidebarCategory {
  key: string
  label: string
}

interface NavItem {
  id: Page
  label: string
  emoji: string
  category: string
  badge?: number
}

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  page: Page
  setPage: (page: Page) => void
  navItems: NavItem[]
  sidebarCategories: SidebarCategory[]
  userRole: string
  userName: string
  initials: string
  handleLogout: () => void
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  page,
  setPage,
  navItems,
  sidebarCategories,
  userRole,
  userName,
  initials,
  handleLogout,
}: SidebarProps) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <>
    {/* Mobile overlay backdrop */}
    {sidebarOpen && (
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={() => setSidebarOpen(false)}
      />
    )}
    <aside
      role="navigation"
      aria-label={t('syndicDash.sidebar.navigation') || 'Navigation principale'}
      className={`fixed md:relative z-50 md:z-auto transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      style={{ width: sidebarOpen ? 240 : 64, background: 'var(--sd-navy)', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--sd-border-dark)', position: undefined, overflowY: 'auto', height: '100vh', top: 0, left: 0 }}
    >
      {/* Grid texture overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ padding: '0 20px', height: 80, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--sd-border-dark)', position: 'relative', gap: 12, flexShrink: 0 }}>
        {/* Logo mark — always visible */}
        <div
          style={{ width: 36, height: 36, background: 'linear-gradient(135deg,var(--sd-gold),#A8842A)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", color: 'var(--sd-navy)', fontSize: 17, fontWeight: 600, boxShadow: '0 4px 12px rgba(201,168,76,0.3)', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? t('syndicDash.sidebar.collapse') : t('syndicDash.sidebar.expand')}
        >V</div>
        {sidebarOpen && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", color: '#fff', fontSize: 16, lineHeight: 1.1, letterSpacing: '0.5px' }}>VitFix Pro</div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--sd-gold)', marginTop: 3 }}>
              {t(`syndicDash.roles.${userRole}`) || 'Gestionnaire Pro'}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8, overflowY: 'auto', position: 'relative' }}>
        {/* ── Catégories sidebar groupées ── */}
        {sidebarCategories.map(cat => {
          const catItems = navItems.filter(item => item.category === cat.key)
          if (catItems.length === 0) return null
          return (
            <div key={cat.key}>
              {sidebarOpen && (
                <div style={{ padding: '20px 24px 6px', fontSize: 9, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}>
                  {cat.label}
                </div>
              )}
              {catItems.map(item => {
                const isActive = page === item.id
                return (
                  <button
                    key={item.id}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => { setPage(item.id); if (window.innerWidth < 768) setSidebarOpen(false) }}
                    style={{
                      width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11,
                      padding: '10px 16px', margin: '1px 8px',
                      borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 500 : 400,
                      fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                      transition: 'all 0.18s ease', border: isActive ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent', textAlign: 'left',
                      background: isActive ? 'var(--sd-gold-dim)' : 'transparent',
                      color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.45)',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)' } }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' } }}
                  >
                    {isActive && <div style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: 'var(--sd-gold)', borderRadius: '0 3px 3px 0' }} />}
                    <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0, filter: isActive ? 'none' : 'grayscale(30%)' }}>{item.emoji}</span>
                    {sidebarOpen && (
                      <>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span style={{ marginLeft: 'auto', background: isActive ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.1)', color: isActive ? 'var(--sd-gold-light)' : 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
        <button
          onClick={handleLogout}
          style={{ width: 'calc(100% - 16px)', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', margin: '1px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.45)', textAlign: 'left', transition: 'all 0.15s', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,57,43,0.15)'; (e.currentTarget as HTMLElement).style.color = '#e74c3c' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
        >
          <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>🚪</span>
          {sidebarOpen && <span>{t('syndicDash.sidebar.logout')}</span>}
        </button>
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--sd-border-dark)', position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'default' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,var(--sd-gold),#A8842A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sd-navy)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          {sidebarOpen && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '0.4px', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t(`syndicDash.roles.${userRole}`) || getRoleLabel(userRole, locale) || 'Admin Cabinet'}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}
