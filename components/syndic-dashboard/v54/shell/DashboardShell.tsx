'use client'

import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../primitives/icon/Icon'
import { Button } from '../primitives/button'
import { useMessages, useV54Locale } from '@/lib/syndic/v54/i18n'
import { SIDEBAR, SIDE_TITLES, isItem } from './sidebar-config'
import { SIDEBAR_FR, SIDE_TITLES_FR } from './sidebar-config.fr'
import { SHELL_MESSAGES } from './shell.messages'
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
  const locale = useV54Locale()
  const t = useMessages(SHELL_MESSAGES)
  const sidebar = locale === 'fr-FR' ? SIDEBAR_FR : SIDEBAR
  const titles = locale === 'fr-FR' ? SIDE_TITLES_FR : SIDE_TITLES

  // Date côté client uniquement (évite un mismatch d'hydratation SSR vs client).
  useEffect(() => {
    setNow(new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(new Date()))
  }, [locale])

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
      <aside className={clsx(styles.sidebar, sidebarOpen && styles.isOpen)} aria-label={t.navigation}>
        <div className={styles.brand}>
          <div className={styles.mark}>V</div>
          <div>
            <div className={styles.name}>{t.marque}</div>
            <div className={styles.role}>{t.role}</div>
          </div>
        </div>

        <button type="button" className={styles.sideSearch} aria-label={t.rechercherModules}>
          <Icon name="search" aria-hidden />
          <span>{t.rechercherPlaceholder}</span>
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
              <b>{t.utilisateur}</b>
              <span>{t.organisation}</span>
            </div>
            <Icon name="chevronDown" aria-hidden />
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={clsx(styles.backdrop, sidebarOpen && styles.isOpen)}
        aria-label={t.fermerMenu}
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.hamburger} aria-label={t.ouvrirMenu} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className={styles.crumb}>
            <span>{t.ariane}</span>
            <Icon name="chevron" aria-hidden />
            <b>{titles[route] ?? route}</b>
          </div>
          <div className={styles.crumbMobile}>
            <b>{titles[route] ?? route}</b>
          </div>
          <div className={styles.spacer} />
          {now && <div className={styles.crumb}><time>{now}</time></div>}
          <button type="button" className={styles.iconBtn} aria-label={t.rechercher}>
            <Icon name="search" aria-hidden />
          </button>
          <button type="button" className={styles.iconBtn} aria-label={t.notifications}>
            <Icon name="bell" aria-hidden />
            <span className={styles.pulse} aria-hidden />
          </button>
          <Button variant="gold" className={styles.novaMissao}>
            <Icon name="plus" aria-hidden />{t.nouvelleMission}
          </Button>
        </header>

        <section className={styles.content} aria-label={t.page}>
          {renderModule ? renderModule(route, go) : <p className={styles.placeholderTitle}>{titles[route] ?? route}</p>}
        </section>
      </main>
    </div>
  )
}
