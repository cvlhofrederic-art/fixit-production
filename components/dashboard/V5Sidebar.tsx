'use client'

/**
 * V5Sidebar — Sidebar for pro_societe dashboard (light theme, 10 sections)
 *
 * Maps 1:1 with vitfix_btp_dashboardpro_v5.html sidebar structure.
 * Every V22 sidebar item for pro_societe is preserved here (zero feature loss).
 */

interface V5SidebarProps {
  activePage: string
  navigateTo: (page: string) => void
  handleLogout: () => void
  isProGerant: boolean
  proCanAccess: (module: string) => boolean
  isModuleEnabled: (module: string) => boolean
  isPt: boolean
  pendingBookings: { length: number }
  unreadMsgCount: number
}

// Prefetch map — hover over sidebar item → preload the JS chunk
const PREFETCH_MAP: Record<string, () => void> = {
  home: () => import('@/components/dashboard/HomeSection'),
  calendar: () => import('@/components/dashboard/CalendarSection'),
  chantiers: () => import('@/components/dashboard/btp/ChantiersBTPSection'),
  equipes: () => import('@/components/dashboard/EquipesBTPV2'),
  gantt: () => import('@/components/dashboard/btp/GanttSection'),
  pointage: () => import('@/components/dashboard/btp/PointageEquipesSection'),
  devis: () => import('@/components/dashboard/DevisSection'),
  factures: () => import('@/components/dashboard/FacturesSection'),
  clients: () => import('@/components/dashboard/ClientsSection'),
  messages: () => import('@/components/dashboard/MessagerieArtisan'),
  comptabilite: () => import('@/components/dashboard/ComptabiliteSection'),
  materiaux: () => import('@/components/dashboard/MateriauxSection'),
  rapports: () => import('@/components/dashboard/RapportsSection'),
  stats: () => import('@/components/dashboard/StatsRevenusSection'),
  settings: () => import('@/components/dashboard/SettingsSection'),
  modules: () => import('@/components/dashboard/ModulesSection'),
  compta_btp: () => import('@/components/dashboard/ComptaBTPSection'),
  rentabilite: () => import('@/components/dashboard/RentabiliteChantierSection'),
  gestion_comptes: () => import('@/components/dashboard/CompteUtilisateursSection'),
  pipeline: () => import('@/components/dashboard/PipelineSection'),
  wallet: () => import('@/components/dashboard/WalletConformiteSection'),
  marketplace_btp: () => import('@/components/dashboard/MarketplaceProBTPSection'),
}
const prefetched = new Set<string>()

function V5SidebarItem({ icon, label, active, badge, onClick, page }: {
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

export default function V5Sidebar({
  activePage, navigateTo, handleLogout,
  isProGerant, proCanAccess, isModuleEnabled,
  isPt, pendingBookings, unreadMsgCount,
}: V5SidebarProps) {
  return (
    <aside className="v5-sb" role="navigation" aria-label={isPt ? 'Menu principal' : 'Menu principal'}>
      <div className="v5-sb-logo">
        <div className="v5-sb-logo-name" style={{ cursor: 'pointer' }} onClick={() => navigateTo('home')}>
          VITFIX <span className="v5-sb-logo-badge">PRO</span>
        </div>
      </div>
      <div className="v5-sb-nav">

        {/* ═══ PILOTAGE ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Pilotagem' : 'Pilotage'}</div>
          <V5SidebarItem icon="📊" label={isPt ? 'Painel' : 'Tableau de bord'} active={activePage === 'home'} onClick={() => navigateTo('home')} page="home" />
          {(isProGerant || proCanAccess('gestion_comptes')) && (
            <V5SidebarItem icon="👥" label={isPt ? 'Contas de utilizadores' : 'Comptes utilisateurs'} active={activePage === 'gestion_comptes'} onClick={() => navigateTo('gestion_comptes')} page="gestion_comptes" />
          )}
          {isModuleEnabled('stats') && (
            <V5SidebarItem icon="📈" label={isPt ? 'Estatísticas' : 'Statistiques'} active={activePage === 'stats'} onClick={() => navigateTo('stats')} page="stats" />
          )}
          {isModuleEnabled('revenus') && (
            <V5SidebarItem icon="💰" label={isPt ? 'Receitas' : 'Revenus'} active={activePage === 'revenus'} onClick={() => navigateTo('revenus')} />
          )}
          <V5SidebarItem icon="🗂️" label={isPt ? 'Prestações' : 'Prestations'} active={activePage === 'prestations' || activePage === 'motifs' || activePage === 'bibliotheque'} onClick={() => navigateTo('prestations')} />
        </div>

        {/* ═══ CHANTIERS ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Obras' : 'Chantiers'}</div>
          {proCanAccess('chantiers') && (
            <V5SidebarItem icon="🏗️" label={isPt ? 'Obras' : 'Chantiers'} active={activePage === 'chantiers'} onClick={() => navigateTo('chantiers')} page="chantiers" />
          )}
          {proCanAccess('gantt') && (
            <V5SidebarItem icon="📊" label={isPt ? 'Planificação Gantt' : 'Planification Gantt'} active={activePage === 'gantt'} onClick={() => navigateTo('gantt')} page="gantt" />
          )}
          {proCanAccess('equipes') && (
            <V5SidebarItem icon="👷" label={isPt ? 'Equipas' : 'Équipes'} active={activePage === 'equipes'} onClick={() => navigateTo('equipes')} page="equipes" />
          )}
          {proCanAccess('pointage') && (
            <V5SidebarItem icon="⏱️" label={isPt ? 'Marcação de horas' : 'Pointage équipes'} active={activePage === 'pointage'} onClick={() => navigateTo('pointage')} page="pointage" />
          )}
          {proCanAccess('calendar') && (
            <V5SidebarItem icon="📅" label={isPt ? 'Agenda' : 'Agenda / Planning'} active={activePage === 'calendar'} badge={pendingBookings.length || undefined} onClick={() => navigateTo('calendar')} page="calendar" />
          )}
          <V5SidebarItem icon="🌤️" label={isPt ? 'Meteorologia' : 'Météo chantiers'} active={activePage === 'meteo'} onClick={() => navigateTo('meteo')} />
          {isModuleEnabled('photos_chantier') && (
            <V5SidebarItem icon="📸" label={isPt ? 'Fotos de obra' : 'Photos Chantier'} active={activePage === 'photos_chantier'} onClick={() => navigateTo('photos_chantier')} />
          )}
          {isModuleEnabled('rapports') && (
            <V5SidebarItem icon="📋" label={isPt ? 'Relatórios de obra' : 'Rapports de chantier'} active={activePage === 'rapports'} onClick={() => navigateTo('rapports')} page="rapports" />
          )}
        </div>

        {/* ═══ COMMERCIAL ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">Commercial</div>
          <V5SidebarItem icon="📊" label="Pipeline" active={activePage === 'pipeline'} onClick={() => navigateTo('pipeline')} page="pipeline" />
          {isModuleEnabled('devis') && (
            <V5SidebarItem icon="📄" label={isPt ? 'Orçamentos' : 'Devis'} active={activePage === 'devis'} onClick={() => navigateTo('devis')} page="devis" />
          )}
          {proCanAccess('dpgf') && (
            <V5SidebarItem icon="📁" label={isPt ? 'Concursos / DPGF' : "Appels d'offres / DPGF"} active={activePage === 'dpgf'} onClick={() => navigateTo('dpgf')} />
          )}
          {isModuleEnabled('marches') && (
            <V5SidebarItem icon="📢" label={isPt ? 'Bolsa de Mercados' : 'Bourse aux Marchés'} active={activePage === 'marches'} onClick={() => navigateTo('marches')} />
          )}
        </div>

        {/* ═══ FACTURATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Faturação' : 'Facturation'}</div>
          {isModuleEnabled('factures') && (
            <V5SidebarItem icon="💳" label={isPt ? 'Faturas' : 'Factures'} active={activePage === 'factures'} onClick={() => navigateTo('factures')} page="factures" />
          )}
          {proCanAccess('situations') && (
            <V5SidebarItem icon="📈" label={isPt ? 'Situações de obra' : 'Situations de travaux'} active={activePage === 'situations'} onClick={() => navigateTo('situations')} />
          )}
          {proCanAccess('garanties') && (
            <V5SidebarItem icon="🔒" label={isPt ? 'Retenções de garantia' : 'Retenues de garantie'} active={activePage === 'garanties'} onClick={() => navigateTo('garanties')} />
          )}
        </div>

        {/* ═══ SOUS-TRAITANCE & ACHATS ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Subempreitada & Compras' : 'Sous-traitance & Achats'}</div>
          {proCanAccess('sous_traitance') && (
            <V5SidebarItem icon="🤝" label={isPt ? 'Subempreitada DC4' : 'Sous-traitance DC4'} active={activePage === 'sous_traitance'} onClick={() => navigateTo('sous_traitance')} />
          )}
          {proCanAccess('sous_traitance_offres') && (
            <V5SidebarItem icon="🔍" label={isPt ? 'Recrutar subempreiteiros' : 'Recruter sous-traitants'} active={activePage === 'sous_traitance_offres'} onClick={() => navigateTo('sous_traitance_offres')} />
          )}
          {proCanAccess('rfq_btp') && (
            <V5SidebarItem icon="📋" label={isPt ? 'Orçamentos Fornecedores' : 'Devis Fournisseurs'} active={activePage === 'rfq_btp'} onClick={() => navigateTo('rfq_btp')} />
          )}
          {isModuleEnabled('marketplace_btp') && (
            <V5SidebarItem icon="🏪" label="Marketplace BTP" active={activePage === 'marketplace_btp'} onClick={() => navigateTo('marketplace_btp')} page="marketplace_btp" />
          )}
        </div>

        {/* ═══ FINANCES ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Finanças' : 'Finances'}</div>
          {proCanAccess('compta_btp') && (
            <V5SidebarItem icon="🧠" label={isPt ? 'Contabilidade IA' : 'Compta Intelligente'} active={activePage === 'compta_btp'} onClick={() => navigateTo('compta_btp')} page="compta_btp" />
          )}
          {proCanAccess('rentabilite') && (
            <V5SidebarItem icon="💰" label={isPt ? 'Rentabilidade' : 'Rentabilité Chantier'} active={activePage === 'rentabilite'} onClick={() => navigateTo('rentabilite')} page="rentabilite" />
          )}
          {isModuleEnabled('comptabilite') && (
            <V5SidebarItem icon="🧮" label={isPt ? 'Contabilidade' : 'Comptabilité'} active={activePage === 'comptabilite'} onClick={() => navigateTo('comptabilite')} page="comptabilite" />
          )}
        </div>

        {/* ═══ COMMUNICATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Comunicação' : 'Communication'}</div>
          {isModuleEnabled('messages') && (
            <V5SidebarItem icon="💬" label={isPt ? 'Mensagens' : 'Messagerie'} active={activePage === 'messages' || activePage === 'comm_pro'} badge={(unreadMsgCount + pendingBookings.length) || undefined} onClick={() => navigateTo('messages')} page="messages" />
          )}
          {isModuleEnabled('clients') && (
            <V5SidebarItem icon="👥" label={isPt ? 'Clientes' : 'Base clients'} active={activePage === 'clients'} onClick={() => navigateTo('clients')} page="clients" />
          )}
          <V5SidebarItem icon="🌐" label={isPt ? 'Portal cliente' : 'Portail client'} active={activePage === 'portail_client'} onClick={() => navigateTo('portail_client')} />
        </div>

        {/* ═══ ADMINISTRATION ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">Administration</div>
          {isModuleEnabled('wallet') && (
            <V5SidebarItem icon="📁" label={isPt ? 'Conformidade' : 'Conformité'} active={activePage === 'wallet'} onClick={() => navigateTo('wallet')} page="wallet" />
          )}
          {isModuleEnabled('contrats') && (
            <V5SidebarItem icon="📑" label={isPt ? 'Contratos' : 'Contrats'} active={activePage === 'contrats'} onClick={() => navigateTo('contrats')} />
          )}
          <V5SidebarItem icon="⏱️" label={isPt ? 'Horários de obra' : 'Horaires chantier'} active={activePage === 'horaires'} onClick={() => navigateTo('horaires')} />
        </div>

        {/* ═══ VITRINE ═══ */}
        <div className="v5-sb-sec">
          <div className="v5-sb-sec-t">{isPt ? 'Montra' : 'Vitrine'}</div>
          {isModuleEnabled('portfolio') && (
            <V5SidebarItem icon="🖼️" label={isPt ? 'Referências de obra' : 'Références chantiers'} active={activePage === 'portfolio'} onClick={() => navigateTo('portfolio')} />
          )}
          {isModuleEnabled('parrainage') && (
            <V5SidebarItem icon="🎁" label={isPt ? 'Apadrinhamento' : 'Parrainage'} active={activePage === 'parrainage'} onClick={() => navigateTo('parrainage')} />
          )}
        </div>

        {/* ═══ COMPTE (bottom) ═══ */}
        <div className="v5-sb-bottom">
          <div className="v5-sb-sec">
            <div className="v5-sb-sec-t">{isPt ? 'Conta' : 'Compte'}</div>
            <V5SidebarItem icon="⚙️" label={isPt ? 'Meu perfil' : 'Mon profil'} active={activePage === 'settings'} onClick={() => navigateTo('settings')} page="settings" />
            <V5SidebarItem icon="🧩" label="Modules" active={activePage === 'modules'} onClick={() => navigateTo('modules')} />
            <V5SidebarItem icon="❓" label={isPt ? 'Ajuda' : 'Aide'} active={activePage === 'help'} onClick={() => navigateTo('help')} />
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
