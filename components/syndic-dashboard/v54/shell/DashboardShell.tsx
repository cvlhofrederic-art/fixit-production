'use client'

import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../primitives/icon/Icon'
import { Button } from '../primitives/button'
import { SIDEBAR, SIDE_TITLES, isItem, applySidebarPrefs } from './sidebar-config'
import { useSyndicData } from '@/lib/syndic/v54/data-context'
import styles from './Shell.module.css'

export interface DashboardShellProps {
  /** Route active initiale (id de module). */
  defaultRoute?: string
  /** Rend le module actif. Si absent, un placeholder titre est affiché. */
  renderModule?: (route: string, navigate: (id: string) => void) => ReactNode
  onLogout?: () => void
}

/**
 * Shell du dashboard syndic v54 — port byte-exact du « App: Sidebar + Router »
 * du bundle V5.7 (coquille : sidebar navy + topbar + zone contenu + drawer
 * mobile). Réutilise la primitive Icon + la config sidebar (12 sections / 80
 * modules). Le contenu de chaque module est délégué via `renderModule(route)`.
 *
 * Périmètre v1 (shell core) : navigation byte-exact (sections collapsibles,
 * sous-en-têtes, item actif, compteurs, drawer responsive ≤1024). Volontairement
 * différés (incréments suivants) : palette ⌘K, centre de notifications, favoris
 * /récents persistés. Les en-têtes de section et le backdrop sont des <button>
 * (équivalence clavier — évite jsx-a11y S1082 du clic sur élément non-interactif).
 */
export default function DashboardShell({ defaultRoute = 'dashboard', renderModule, onLogout }: Readonly<DashboardShellProps>) {
  const [route, setRoute] = useState(defaultRoute)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [now, setNow] = useState('')

  // Phase A3 : barre latérale réordonnée/filtrée selon les préférences du cabinet
  // (gated : sans prefs → SIDEBAR par défaut, rendu byte-exact préservé).
  const { dashboardPrefs } = useSyndicData()
  const sidebar = applySidebarPrefs(SIDEBAR, dashboardPrefs)

  // Date côté client uniquement (évite un mismatch d'hydratation SSR vs client).
  useEffect(() => {
    setNow(new Intl.DateTimeFormat('pt-PT', { dateStyle: 'full', timeStyle: 'short' }).format(new Date()))
  }, [])

  const go = (id: string) => {
    if (id === 'logout') {
      onLogout?.()
      return
    }
    setRoute(id)
    setSidebarOpen(false)
  }
  const toggleSection = (title: string) => setCollapsed((c) => ({ ...c, [title]: !c[title] }))

  return (
    <div className={styles.app}>
      <aside className={clsx(styles.sidebar, sidebarOpen && styles.isOpen)} aria-label="Navegação principal">
        <div className={styles.brand}>
          <div className={styles.mark}>V</div>
          <div>
            <div className={styles.name}>VitFix Pro</div>
            <div className={styles.role}>Administrador</div>
          </div>
        </div>

        <button type="button" className={styles.sideSearch} aria-label="Pesquisar módulos">
          <Icon name="search" aria-hidden />
          <span>Pesquisar…</span>
          <kbd>⌘K</kbd>
        </button>

        {sidebar.map((sec) => {
          const isCol = !!collapsed[sec.title]
          return (
            <div key={sec.title} className={clsx(styles.navGroup, isCol && styles.collapsed)}>
              <button type="button" className={styles.groupHead} onClick={() => toggleSection(sec.title)} aria-expanded={!isCol}>
                <span>{sec.title}</span>
                <span className={styles.caret} aria-hidden>▼</span>
              </button>
              {sec.entries.map((e) => {
                if (!isItem(e)) {
                  return (
                    <div key={e.header} className={styles.navSubheader}>
                      <span>{e.header}</span>
                    </div>
                  )
                }
                const active = route === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={clsx(styles.navItem, active && styles.active)}
                    onClick={() => go(e.id)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={e.icon} aria-hidden />
                    <span>{e.label}</span>
                    {e.count != null && <span className={styles.count}>{e.count}</span>}
                    {e.dot && <span className={styles.dotSt} aria-hidden />}
                  </button>
                )
              })}
            </div>
          )
        })}

        <div className={styles.sideFoot}>
          <div className={styles.userChip}>
            <div className={styles.av}>SA</div>
            <div className={styles.who}>
              <b>Super Admin</b>
              <span>VITFIX</span>
            </div>
            <Icon name="chevronDown" aria-hidden />
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={clsx(styles.backdrop, sidebarOpen && styles.isOpen)}
        aria-label="Fechar menu"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.hamburger} aria-label="Abrir menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className={styles.crumb}>
            <span>VitFix</span>
            <Icon name="chevron" aria-hidden />
            <b>{SIDE_TITLES[route] ?? route}</b>
          </div>
          <div className={styles.crumbMobile}>
            <b>{SIDE_TITLES[route] ?? route}</b>
          </div>
          <div className={styles.spacer} />
          {now && <div className={styles.crumb}><time>{now}</time></div>}
          <button type="button" className={styles.iconBtn} aria-label="Pesquisar">
            <Icon name="search" aria-hidden />
          </button>
          <button type="button" className={styles.iconBtn} aria-label="Notificações">
            <Icon name="bell" aria-hidden />
            <span className={styles.pulse} aria-hidden />
          </button>
          <Button variant="gold" className={styles.novaMissao}>
            <Icon name="plus" aria-hidden />Nova missão
          </Button>
        </header>

        <section className={styles.content} aria-label="Página">
          {renderModule ? renderModule(route, go) : <p className={styles.placeholderTitle}>{SIDE_TITLES[route] ?? route}</p>}
        </section>
      </main>
    </div>
  )
}
