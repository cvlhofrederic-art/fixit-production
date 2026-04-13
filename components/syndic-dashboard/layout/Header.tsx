'use client'

import React, { useRef, useEffect } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { Page, Alerte } from '@/components/syndic-dashboard/types'

interface Notif {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  created_at: string
}

interface NavItem {
  id: Page
  label: string
  emoji: string
}

interface HeaderProps {
  page: Page
  setPage: (page: Page) => void
  navItems: NavItem[]
  companyName: string
  alertes: Alerte[]
  notifs: Notif[]
  notifUnread: number
  notifPanelOpen: boolean
  sidebarOpen?: boolean
  setSidebarOpen?: (open: boolean) => void
  setNotifPanelOpen: (open: boolean) => void
  notifLoading: boolean
  markAllNotifsRead: () => Promise<void>
}

export default function Header({
  page,
  setPage,
  navItems,
  companyName,
  alertes,
  notifs,
  notifUnread,
  notifPanelOpen,
  setNotifPanelOpen,
  notifLoading,
  markAllNotifsRead,
  sidebarOpen,
  setSidebarOpen,
}: HeaderProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const notifBtnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notifPanelOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (notifBtnRef.current && !notifBtnRef.current.contains(e.target as Node)) setNotifPanelOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifPanelOpen, setNotifPanelOpen])

  return (
    <header style={{ background: '#fff', borderBottom: '1px solid var(--sd-border)', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 var(--sd-border), 0 4px 16px rgba(13,27,46,0.04)' }} className="px-4 md:px-9">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        {setSidebarOpen && (
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--sd-border)] bg-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sd-navy)" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
        )}
        <div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 400, color: 'var(--sd-navy)', letterSpacing: '0.2px' }}>
          {navItems.find(n => n.id === page)?.emoji} {navItems.find(n => n.id === page)?.label}
        </h1>
        <p style={{ fontSize: 11, color: 'var(--sd-ink-3)', letterSpacing: '0.3px' }} className="hidden sm:block">
          {companyName} · {new Date().toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Alertes urgentes */}
        {alertes.filter(a => a.urgence === 'haute').length > 0 && (
          <button
            onClick={() => setPage('alertes')}
            title={t('syndicDash.accueil.urgentAlerts')}
            style={{ width: 38, height: 38, border: '1px solid var(--sd-border)', background: 'var(--sd-red-soft)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--sd-red)" strokeWidth="1.5"><path d="M8 2a5 5 0 00-5 5v2l-1 2h12l-1-2V7a5 5 0 00-5-5z"/><path d="M6.5 13a1.5 1.5 0 003 0"/></svg>
            <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, background: 'var(--sd-red)', border: '2px solid #fff', borderRadius: '50%' }} />
          </button>
        )}
        {/* ── Bouton Notifications ── */}
        <div style={{ position: 'relative' }} ref={notifBtnRef}>
          <button
            onClick={() => setNotifPanelOpen(!notifPanelOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, var(--sd-gold), #A8842A)', color: 'var(--sd-navy)', border: 'none', padding: '9px 18px', borderRadius: 9, fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.2px', boxShadow: '0 2px 8px rgba(201,168,76,0.35)', position: 'relative' }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--sd-navy)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5a4.5 4.5 0 00-4.5 4.5v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z"/><path d="M6.5 12.5a1.5 1.5 0 003 0"/></svg>
            {t('syndicDash.common.notifications')}
            {notifUnread > 0 && (
              <span style={{ background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', marginLeft: 2 }}>
                {notifUnread > 9 ? '9+' : notifUnread}
              </span>
            )}
          </button>
          {/* Panel dropdown notifications */}
          {notifPanelOpen && (
            <div style={{ position: 'absolute', right: 0, top: 48, width: 360, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(13,27,46,0.18)', border: '1px solid var(--sd-border)', zIndex: 50, overflow: 'hidden' }}>
              <div style={{ background: 'var(--sd-navy)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>🔔 {t('syndicDash.common.notifications')}</span>
                <button onClick={() => setNotifPanelOpen(false)} aria-label={t('syndicDash.common.close')} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--sd-ink-3)', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                    {t('syndicDash.common.noNotification')}
                  </div>
                ) : notifs.slice(0, 20).map(n => {
                  const diff = Date.now() - new Date(n.created_at).getTime()
                  const mins = Math.floor(diff / 60000)
                  const hrs = Math.floor(diff / 3600000)
                  const days = Math.floor(diff / 86400000)
                  const timeAgo = mins < 1 ? (locale === 'pt' ? 'agora' : "à l'instant") : mins < 60 ? (locale === 'pt' ? `há ${mins}min` : `il y a ${mins}min`) : hrs < 24 ? (locale === 'pt' ? `há ${hrs}h` : `il y a ${hrs}h`) : (locale === 'pt' ? `há ${days}j` : `il y a ${days}j`)
                  const targetPage: Page = n.type === 'rapport_intervention' || n.type === 'new_mission' || n.type === 'mission_completed' ? 'missions' : 'alertes'
                  return (
                    <div
                      key={n.id}
                      onClick={() => { setPage(targetPage); setNotifPanelOpen(false) }}
                      style={{ padding: '12px 16px', borderBottom: '1px solid var(--sd-border)', background: !n.read ? 'rgba(201,168,76,0.06)' : '#fff', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = !n.read ? 'rgba(201,168,76,0.12)' : 'rgba(0,0,0,0.02)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = !n.read ? 'rgba(201,168,76,0.06)' : '#fff' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                          {n.type === 'rapport_intervention' ? '📋' : n.type === 'new_mission' ? '✅' : n.type === 'mission_completed' ? '🏁' : '📣'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: !n.read ? 600 : 500, color: 'var(--sd-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                          {n.body && <p style={{ fontSize: 12, color: 'var(--sd-ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                          <p style={{ fontSize: 11, color: 'var(--sd-gold)', marginTop: 4, fontWeight: 500 }}>{timeAgo}</p>
                        </div>
                        {!n.read && <div style={{ width: 8, height: 8, background: 'var(--sd-gold)', borderRadius: '50%', flexShrink: 0, marginTop: 6 }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
              {notifs.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--sd-border)', display: 'flex', justifyContent: 'center' }}>
                  <button onClick={async () => { await markAllNotifsRead(); setNotifPanelOpen(false) }} disabled={notifLoading} style={{ fontSize: 12, color: 'var(--sd-gold)', background: 'none', border: 'none', cursor: notifLoading ? 'default' : 'pointer', fontWeight: 600, opacity: notifLoading ? 0.6 : 1 }}>
                    ✓ {notifLoading ? '…' : t('syndicDash.common.markAllRead')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
