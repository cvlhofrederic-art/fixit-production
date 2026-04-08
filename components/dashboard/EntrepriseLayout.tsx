'use client'

import React from 'react'

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
  const totalMessages = unreadMsgCount + pendingBookingsCount

  const sections: NavSection[] = [
    {
      title: 'PRINCIPAL',
      items: [
        { icon: '🏠', label: 'Tableau de bord', page: 'home' },
        { icon: '📋', label: 'Chantiers', page: 'chantiers' },
        { icon: '📅', label: 'Planning', page: 'calendar' },
        { icon: '📅', label: 'Gantt', page: 'gantt' },
        { icon: '👷', label: 'Équipes', page: 'equipes' },
      ],
    },
    {
      title: 'OPÉRATIONS',
      items: [
        { icon: '⏱️', label: 'Pointage', page: 'pointage' },
        { icon: '📊', label: 'Situations', page: 'situations' },
        { icon: '🤝', label: 'Sous-traitance', page: 'sous_traitance' },
        { icon: '🔒', label: 'Garanties', page: 'garanties' },
        { icon: '🛒', label: 'Achats', page: 'achats_fournisseurs' },
        { icon: '📦', label: 'Stocks', page: 'stocks_materiels' },
      ],
    },
    {
      title: 'COMMUNICATION',
      items: [
        { icon: '💬', label: 'Messagerie', page: 'messages', badge: totalMessages },
        { icon: '👥', label: 'Base clients', page: 'clients' },
      ],
    },
    {
      title: 'FACTURATION',
      items: [
        { icon: '📄', label: 'Devis', page: 'devis' },
        { icon: '🧾', label: 'Factures', page: 'factures' },
        { icon: '📋', label: 'DPGF', page: 'dpgf' },
        { icon: '📋', label: 'Rapports', page: 'rapports' },
        { icon: '📸', label: 'Photos chantier', page: 'photos_chantier' },
        { icon: '📑', label: 'Documents', page: 'documents_btp' },
      ],
    },
    {
      title: 'ANALYSE',
      items: [
        { icon: '📊', label: 'Statistiques', page: 'stats' },
        { icon: '💰', label: 'Revenus', page: 'revenus' },
        { icon: '🧮', label: 'Comptabilité', page: 'comptabilite' },
        { icon: '🛒', label: 'Matériaux IA', page: 'materiaux' },
        { icon: '🏛️', label: 'Bourse aux marchés', page: 'marches' },
      ],
    },
    {
      title: 'CONFORMITÉ',
      items: [
        { icon: '🗂️', label: 'Wallet', page: 'wallet' },
        { icon: '🛡️', label: 'Sécurité', page: 'conformite_securite' },
        { icon: '🔧', label: 'SAV', page: 'sav_maintenance' },
      ],
    },
    {
      title: 'COMPTE',
      items: [
        { icon: '⚙️', label: 'Paramètres', page: 'settings' },
        { icon: '🧩', label: 'Modules', page: 'settings', settingsTab: 'modules' },
        { icon: '❓', label: 'Aide', page: 'help' },
        { icon: '🚪', label: 'Déconnexion', page: '', action: onLogout },
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

  const companyName = artisan?.company_name || (artisan as unknown as { name?: string })?.name || 'Entreprise'

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
