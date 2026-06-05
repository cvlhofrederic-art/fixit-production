'use client'

import React from 'react'
import { useTranslation } from '@/lib/i18n/context'

interface EntrepriseLayoutProps {
  children: React.ReactNode
  artisan: import('@/lib/types').Artisan
  activePage: string
  navigateTo: (page: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  unreadMsgCount: number
  pendingBookingsCount: number
  onLogout: () => void
}

interface NavItem {
  icon: string
  label: string
  page: string
  settingsTab?: string
  badge?: number
  action?: () => void
}

interface NavSection {
  title: string
  items: NavItem[]
}

export default function EntrepriseLayout({
  children,
  artisan,
  activePage,
  navigateTo,
  sidebarOpen,
  setSidebarOpen,
  unreadMsgCount,
  pendingBookingsCount,
  onLogout,
}: EntrepriseLayoutProps) {
  const { t } = useTranslation()
  const totalMessages = unreadMsgCount + pendingBookingsCount

  const sections: NavSection[] = [
    {
      title: 'PRINCIPAL',
      items: [
        { icon: '🏠', label: t('proDash.entrepriseLayout.tableauDeBord'), page: 'home' },
        { icon: '📋', label: t('proDash.entrepriseLayout.chantiers'), page: 'chantiers' },
        { icon: '📅', label: t('proDash.entrepriseLayout.planning'), page: 'calendar' },
        { icon: '📅', label: t('proDash.entrepriseLayout.gantt'), page: 'gantt' },
        { icon: '👷', label: t('proDash.entrepriseLayout.equipes'), page: 'equipes' },
      ],
    },
    {
      title: t('proDash.entrepriseLayout.operations'),
      items: [
        { icon: '⏱️', label: t('proDash.entrepriseLayout.pointage'), page: 'pointage' },
        { icon: '📊', label: t('proDash.entrepriseLayout.situations'), page: 'situations' },
        { icon: '🤝', label: t('proDash.entrepriseLayout.sousTraitance'), page: 'sous_traitance' },
        { icon: '🔒', label: t('proDash.entrepriseLayout.garanties'), page: 'garanties' },
        { icon: '🛒', label: t('proDash.entrepriseLayout.achats'), page: 'achats_fournisseurs' },
        { icon: '📦', label: t('proDash.entrepriseLayout.stocks'), page: 'stocks_materiels' },
      ],
    },
    {
      title: t('proDash.sidebar.communication'),
      items: [
        { icon: '💬', label: t('proDash.entrepriseLayout.messagerie'), page: 'messages', badge: totalMessages },
        { icon: '👥', label: t('proDash.entrepriseLayout.baseClients'), page: 'clients' },
      ],
    },
    {
      title: t('proDash.sidebar.facturation'),
      items: [
        { icon: '📄', label: t('proDash.entrepriseLayout.devis'), page: 'devis' },
        { icon: '🧾', label: t('proDash.entrepriseLayout.factures'), page: 'factures' },
        { icon: '📋', label: t('proDash.entrepriseLayout.dpgf'), page: 'dpgf' },
        { icon: '📋', label: t('proDash.entrepriseLayout.rapports'), page: 'rapports' },
        { icon: '📸', label: t('proDash.entrepriseLayout.photosChantier'), page: 'photos_chantier' },
        { icon: '📑', label: t('proDash.entrepriseLayout.documents'), page: 'documents_btp' },
      ],
    },
    {
      title: t('proDash.sidebar.analyse'),
      items: [
        { icon: '📊', label: t('proDash.entrepriseLayout.statistiques'), page: 'stats' },
        { icon: '💰', label: t('proDash.entrepriseLayout.revenus'), page: 'revenus' },
        { icon: '🧮', label: t('proDash.entrepriseLayout.comptabilite'), page: 'comptabilite' },
        { icon: '🛒', label: t('proDash.entrepriseLayout.materiauxIA'), page: 'materiaux' },
        { icon: '🏛️', label: t('proDash.entrepriseLayout.bourseMarches'), page: 'marches' },
      ],
    },
    {
      title: t('proDash.entrepriseLayout.conformite'),
      items: [
        { icon: '🗂️', label: t('proDash.entrepriseLayout.wallet'), page: 'wallet' },
        { icon: '🛡️', label: t('proDash.entrepriseLayout.securite'), page: 'conformite_securite' },
        { icon: '🔧', label: t('proDash.entrepriseLayout.sav'), page: 'sav_maintenance' },
      ],
    },
    {
      title: t('proDash.sidebar.compte'),
      items: [
        { icon: '⚙️', label: t('proDash.entrepriseLayout.parametres'), page: 'settings' },
        { icon: '🧩', label: t('proDash.entrepriseLayout.modules'), page: 'settings', settingsTab: 'modules' },
        { icon: '❓', label: t('proDash.entrepriseLayout.aide'), page: 'help' },
        { icon: '🚪', label: t('proDash.entrepriseLayout.deconnexion'), page: '', action: onLogout },
      ],
    },
  ]

  const handleNavClick = (item: NavItem) => {
    if (item.action) {
      item.action()
      return
    }
    navigateTo(item.page)
    setSidebarOpen(false)
  }

  const isActive = (item: NavItem) => {
    if (item.settingsTab) return false
    return activePage === item.page
  }

  const companyName = artisan?.company_name || (artisan as unknown as { name?: string })?.name || t('proDash.entrepriseLayout.entreprise')

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#F5F4F0' }}>
      {/* Topbar */}
      <header
        className="h-12 flex items-center justify-between px-4 shrink-0 z-30"
        style={{ backgroundColor: '#1A1916' }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-white p-1"
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <span className="text-white text-sm font-semibold tracking-wide">
            VITFIX <span style={{ color: '#C8460A' }}>PRO</span>
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
          style={{ backgroundColor: '#2A2A26', color: '#9C9A92' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2A6B3C' }} />
          <span className="truncate max-w-[160px]">{companyName}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed top-12 bottom-0 left-0 z-20
            lg:static lg:z-auto
            w-[220px] shrink-0 overflow-y-auto
            border-r bg-white
            transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
          style={{ borderColor: '#D8D6CE' }}
        >
          <nav className="py-2">
            {sections.map((section) => (
              <div key={section.title} className="mb-1">
                <div
                  className="px-4 pt-3 pb-1 font-mono font-medium tracking-wider"
                  style={{ fontSize: '10px', color: '#9C9A92' }}
                >
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const active = isActive(item)
                  return (
                    <button
                      key={`${item.page}-${item.label}`}
                      onClick={() => handleNavClick(item)}
                      className={`
                        w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-left
                        transition-colors duration-100
                        ${active
                          ? 'border-l-2 bg-orange-50/60'
                          : 'border-l-2 border-transparent hover:bg-gray-50'
                        }
                      `}
                      style={active ? { borderColor: '#C8460A', color: '#1A1916' } : { color: '#5C5A54' }}
                    >
                      <span className="text-base leading-none shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span
                          className="ml-auto text-[10px] font-medium text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                          style={{ backgroundColor: '#C8460A' }}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  )
}
