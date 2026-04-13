'use client'

/**
 * V5SidebarArtisan — Sidebar for artisan dashboard (V5 light theme)
 *
 * Same V5 design as pro_societe sidebar, adapted for artisan modules.
 * Every V22 artisan sidebar item is preserved here (zero feature loss).
 */

interface V5SidebarArtisanProps {
  activePage: string
  navigateTo: (page: string) => void
  handleLogout: () => void
  isModuleEnabled: (module: string) => boolean
  isPt: boolean
  pendingBookings: { length: number }
  unreadMsgCount: number
}

// Prefetch map — hover over sidebar item → preload the JS chunk
const PREFETCH_MAP: Record<string, () => void> = {
  home: () => import('@/components/dashboard/HomeSection'),
  calendar: () => import('@/components/dashboard/CalendarSection'),
  chantiers_v22: () => import('@/components/dashboard/ChantiersSection'),
  motifs: () => import('@/components/dashboard/MotifsSection'),
  horaires: () => import('@/components/dashboard/HorairesSection'),
  devis: () => import('@/components/dashboard/DevisSection'),
  factures: () => import('@/components/dashboard/FacturesSection'),
  pipeline: () => import('@/components/dashboard/PipelineSection'),
  clients: () => import('@/components/dashboard/ClientsSection'),
  messages: () => import('@/components/dashboard/MessagerieArtisan'),
  comptabilite: () => import('@/components/dashboard/ComptabiliteSection'),
  materiaux: () => import('@/components/dashboard/MateriauxSection'),
  rapports: () => import('@/components/dashboard/RapportsSection'),
  stats: () => import('@/components/dashboard/StatsRevenusSection'),
  settings: () => import('@/components/dashboard/SettingsSection'),
  wallet: () => import('@/components/dashboard/WalletConformiteSection'),
  bibliotheque: () => import('@/components/dashboard/BibliothequeSection'),
  photos_chantier: () => import('@/components/dashboard/PhotosChantierSection'),
  marketplace_btp: () => import('@/components/dashboard/MarketplaceProBTPSection'),
}
const prefetched = new Set<string>()

function V5ArtisanItem({ icon, label, active, badge, onClick, page }: {
  icon: string; label: string; active?: boolean; badge?: number; onClick: () => void; page?: string
}) {
  const handleHover = () => {
    if (page && !prefetched.has(page) && PREFETCH_MAP[page]) {
      prefetched.add(page)
      PREFETCH_MAP[page]()
    }
  }
  return (
    <button type="button" onClick={onClick} onMouseEnter={handleHover} className={`v5-sb-i${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="v5-sb-icon" aria-hidden="true">{icon}</span>
      <span className="v5-sb-label">{label}</span>
      {badge != null && badge > 0 && <span className="v5-sb-badge" aria-label={`${badge} en attente`}>{badge}</span>}
    </button>
  )
}

export default function V5SidebarArtisan({
  activePage, navigateTo, handleLogout,
  isModuleEnabled, isPt, pendingBookings, unreadMsgCount,
}: V5SidebarArtisanProps) {
  return (
    <aside className="v5-sb" role="navigation" aria-label="Menu principal">
      <div className="v5-sb-logo">
        <div className="v5-sb-logo-name" style={{ cursor: 'pointer' }} onClick={() => navigateTo('home')}>
          VITFIX <span className="v5-sb-logo-badge">PRO</span>
        </div>
      </div>
      <div className="v5-sb-nav">

        {/* ═══ PRINCIPAL ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Principal' : 'Principal'}</div>
          <V5ArtisanItem icon="📊" label={isPt ? 'Painel' : 'Tableau de bord'} active={activePage === 'home'} onClick={() => navigateTo('home')} page="home" />
          <V5ArtisanItem icon="📅" label={isPt ? 'Agenda' : 'Agenda'} active={activePage === 'calendar'} badge={pendingBookings.length || undefined} onClick={() => navigateTo('calendar')} page="calendar" />
          <V5ArtisanItem icon="🏗️" label={isPt ? 'Obras' : 'Chantiers'} active={activePage === 'chantiers_v22'} onClick={() => navigateTo('chantiers_v22')} page="chantiers_v22" />
          <V5ArtisanItem icon="🗂️" label={isPt ? 'Motivos' : 'Motifs'} active={activePage === 'motifs'} onClick={() => navigateTo('motifs')} page="motifs" />
          <V5ArtisanItem icon="⏱️" label={isPt ? 'Horários' : 'Horaires'} active={activePage === 'horaires'} onClick={() => navigateTo('horaires')} page="horaires" />
        </div>

        {/* ═══ COMMERCIAL ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">Commercial</div>
          <V5ArtisanItem icon="📊" label="Pipeline" active={activePage === 'pipeline'} onClick={() => navigateTo('pipeline')} page="pipeline" />
          {isModuleEnabled('devis') && (
            <V5ArtisanItem icon="📄" label={isPt ? 'Orçamentos' : 'Devis'} active={activePage === 'devis'} onClick={() => navigateTo('devis')} page="devis" />
          )}
          {isModuleEnabled('marches') && (
            <V5ArtisanItem icon="📢" label={isPt ? 'Bolsa de Mercados' : 'Bourse aux Marchés'} active={activePage === 'marches'} onClick={() => navigateTo('marches')} />
          )}
        </div>

        {/* ═══ FACTURATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Faturação' : 'Facturation'}</div>
          {isModuleEnabled('factures') && (
            <V5ArtisanItem icon="💳" label={isPt ? 'Faturas' : 'Factures'} active={activePage === 'factures'} onClick={() => navigateTo('factures')} page="factures" />
          )}
          {isModuleEnabled('rapports') && (
            <V5ArtisanItem icon="📋" label={isPt ? 'Relatórios' : 'Rapports'} active={activePage === 'rapports'} onClick={() => navigateTo('rapports')} page="rapports" />
          )}
          <V5ArtisanItem icon="📸" label={isPt ? 'Fotos de obra' : 'Photos Chantier'} active={activePage === 'photos_chantier'} onClick={() => navigateTo('photos_chantier')} page="photos_chantier" />
          <V5ArtisanItem icon="📚" label={isPt ? 'Biblioteca' : 'Bibliothèque'} active={activePage === 'bibliotheque'} onClick={() => navigateTo('bibliotheque')} page="bibliotheque" />
        </div>

        {/* ═══ COMMUNICATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Comunicação' : 'Communication'}</div>
          {isModuleEnabled('messages') && (
            <V5ArtisanItem icon="💬" label={isPt ? 'Mensagens' : 'Messagerie'} active={activePage === 'messages' || activePage === 'comm_pro'} badge={(unreadMsgCount + pendingBookings.length) || undefined} onClick={() => navigateTo('messages')} page="messages" />
          )}
          {isModuleEnabled('clients') && (
            <V5ArtisanItem icon="👥" label={isPt ? 'Clientes' : 'Base clients'} active={activePage === 'clients'} onClick={() => navigateTo('clients')} page="clients" />
          )}
        </div>

        {/* ═══ ANALYSE ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Análise' : 'Analyse'}</div>
          {isModuleEnabled('stats') && (
            <V5ArtisanItem icon="📈" label={isPt ? 'Estatísticas' : 'Statistiques'} active={activePage === 'stats'} onClick={() => navigateTo('stats')} page="stats" />
          )}
          {isModuleEnabled('revenus') && (
            <V5ArtisanItem icon="💰" label={isPt ? 'Receitas' : 'Revenus'} active={activePage === 'revenus'} onClick={() => navigateTo('revenus')} />
          )}
          {isModuleEnabled('comptabilite') && (
            <V5ArtisanItem icon="🧮" label={isPt ? 'Contabilidade' : 'Comptabilité'} active={activePage === 'comptabilite'} onClick={() => navigateTo('comptabilite')} page="comptabilite" />
          )}
          {isModuleEnabled('materiaux') && (
            <V5ArtisanItem icon="🧱" label={isPt ? 'Materiais' : 'Matériaux'} active={activePage === 'materiaux'} onClick={() => navigateTo('materiaux')} page="materiaux" />
          )}
          {isModuleEnabled('marketplace_btp') && (
            <V5ArtisanItem icon="🏪" label="Marketplace BTP" active={activePage === 'marketplace_btp'} onClick={() => navigateTo('marketplace_btp')} page="marketplace_btp" />
          )}
        </div>

        {/* ═══ PROFIL PRO ═══ */}
        {(isModuleEnabled('wallet') || isModuleEnabled('portfolio') || isModuleEnabled('parrainage')) && (
          <div className="v5-sb-sec">
            <div className="v5-sb-sec-t">{isPt ? 'Perfil Pro' : 'Profil Pro'}</div>
            {isModuleEnabled('wallet') && (
              <V5ArtisanItem icon="📁" label={isPt ? 'Conformidade' : 'Conformité'} active={activePage === 'wallet'} onClick={() => navigateTo('wallet')} page="wallet" />
            )}
            {isModuleEnabled('portfolio') && (
              <V5ArtisanItem icon="🖼️" label={isPt ? 'Referências' : 'Portfolio'} active={activePage === 'portfolio'} onClick={() => navigateTo('portfolio')} />
            )}
            {isModuleEnabled('parrainage') && (
              <V5ArtisanItem icon="🎁" label={isPt ? 'Apadrinhamento' : 'Parrainage'} active={activePage === 'parrainage'} onClick={() => navigateTo('parrainage')} />
            )}
          </div>
        )}

        {/* ═══ COMPTE (bottom) ═══ */}
        <div className="v5-sb-bottom">
          <div className="v5-sb-sec">
            <div className="v5-sb-sec-t">{isPt ? 'Conta' : 'Compte'}</div>
            <V5ArtisanItem icon="⚙️" label={isPt ? 'Meu perfil' : 'Mon profil'} active={activePage === 'settings'} onClick={() => navigateTo('settings')} page="settings" />
            <V5ArtisanItem icon="🧩" label="Modules" active={activePage === 'modules'} onClick={() => navigateTo('modules')} />
            <V5ArtisanItem icon="❓" label={isPt ? 'Ajuda' : 'Aide'} active={activePage === 'help'} onClick={() => navigateTo('help')} />
            <div className="v5-sb-i logout" onClick={handleLogout}>
              <span className="v5-sb-icon">🚪</span>
              <span className="v5-sb-label">{isPt ? 'Sair' : 'Déconnexion'}</span>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
