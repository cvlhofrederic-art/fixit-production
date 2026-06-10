'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import shell from '@/components/syndic-dashboard/v54/shell/Shell.module.css'
import { SIDEBAR_FR, SIDE_TITLES_FR, isItem } from './sidebar-config'
import { NOTIFICATIONS, COPRO_NAMES, PRESTATAIRES } from '../data/mock'
import { ROLES, RoleProvider, type Role } from '../lib/role-context'
import { TODAY } from '../lib/format'
import CreateModal from '../shared/CreateModal'
import frStyles from './shell-fr.module.css'

export interface ShellFRProps {
  /** Route active initiale (id de module). */
  defaultRoute?: string
  /** Rend le module actif. Si absent, un placeholder titre est affiché. */
  renderModule?: (route: string, navigate: (id: string) => void) => ReactNode
  onLogout?: () => void
}

const NOTIF_KIND_CLASS: Record<string, string> = {
  mission: frStyles.kindMission,
  payment: frStyles.kindPayment,
  debt: frStyles.kindDebt,
  insurance: frStyles.kindInsurance,
  ag: frStyles.kindAg,
  legal: frStyles.kindLegal,
  message: frStyles.kindMessage,
  equipa: frStyles.kindEquipa,
}

/** Notifications déjà lues au premier rendu (port byte-exact du mockup v8). */
const INITIAL_READ = ['n06', 'n07', 'n08', 'n09', 'n10', 'n11', 'n12']

// TODAY est épinglée (mock déterministe) → le format est identique SSR/client,
// pas besoin du pattern useEffect du shell PT (qui formate la date réelle).
const NOW_LABEL = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(TODAY)

/**
 * Shell du dashboard syndic judiciaire FR — port du « App (coque) » du mockup v8.
 * Copie assumée du DashboardShell PT (qui importe sa config en dur) : le shell FR
 * diverge structurellement (drawer notifications, sélecteur de rôle + RoleProvider,
 * CTA « Nouvelle intervention », badge cockpit). Réutilise le CSS du shell PT
 * (Shell.module.css, lecture seule) + shell-fr.module.css pour le neuf.
 *
 * Périmètre v1 (parité avec la v1 PT) : navigation byte-exact + notifications +
 * rôle. Volontairement différés : palette ⌘K (bouton rendu inerte), favoris /
 * récents persistés (localStorage = mismatch d'hydratation), hash-routing.
 */
export default function ShellFR({ defaultRoute = 'cockpit', renderModule, onLogout }: Readonly<ShellFRProps>) {
  const { push } = useToast()
  const [route, setRoute] = useState(defaultRoute)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [role, setRole] = useState<Role>('Direction')
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(INITIAL_READ))
  const [newOSOpen, setNewOSOpen] = useState(false)
  const notifsRef = useRef<HTMLDivElement>(null)
  const notifsBtnRef = useRef<HTMLButtonElement>(null)

  const unreadCount = NOTIFICATIONS.filter((n) => !readIds.has(n.id)).length

  // Fermeture du panneau notifications : clic extérieur + Escape (focus restitué).
  useEffect(() => {
    if (!notifsOpen) return
    const onClick = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setNotifsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifsOpen(false)
        notifsBtnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifsOpen])

  const markNotifRead = (id: string) =>
    setReadIds((prev) => {
      const n = new Set(prev)
      n.add(id)
      return n
    })
  const markAllNotifsRead = () => setReadIds(new Set(NOTIFICATIONS.map((n) => n.id)))

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
    <div className={shell.app}>
      <aside className={clsx(shell.sidebar, sidebarOpen && shell.isOpen)} aria-label="Navigation principale">
        <div className={shell.brand}>
          <div className={shell.mark}>V</div>
          <div>
            <div className={shell.name}>VitFix Pro</div>
            <div className={shell.role}>Syndic judiciaire</div>
          </div>
        </div>

        <button type="button" className={shell.sideSearch} aria-label="Rechercher un module">
          <Icon name="search" aria-hidden />
          <span>Rechercher…</span>
          <kbd>⌘K</kbd>
        </button>

        {SIDEBAR_FR.map((sec) => {
          const isCol = !!collapsed[sec.title]
          return (
            <div key={sec.title} className={clsx(shell.navGroup, isCol && shell.collapsed)}>
              <button type="button" className={shell.groupHead} onClick={() => toggleSection(sec.title)} aria-expanded={!isCol}>
                <span>{sec.title}</span>
                <span className={shell.caret} aria-hidden>▼</span>
              </button>
              {sec.entries.map((e) => {
                if (!isItem(e)) {
                  return (
                    <div key={e.header} className={shell.navSubheader}>
                      <span>{e.header}</span>
                    </div>
                  )
                }
                const active = route === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={clsx(shell.navItem, active && shell.active)}
                    onClick={() => go(e.id)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={e.icon} aria-hidden />
                    <span>{e.label}</span>
                    {e.count != null && <span className={shell.count}>{e.count}</span>}
                    {e.dot && <span className={shell.dotSt} aria-hidden />}
                  </button>
                )
              })}
            </div>
          )
        })}

        <div className={shell.sideFoot}>
          <button
            type="button"
            className={shell.userChip}
            onClick={() => go('parametres')}
            style={{ cursor: 'pointer', textAlign: 'left', width: '100%', border: 'none', background: 'transparent' }}
          >
            <div className={shell.av}>CD</div>
            <div className={shell.who}>
              <b>Cabinet Delaunay</b>
              <span>TJ NANTERRE</span>
            </div>
            <Icon name="chevronDown" aria-hidden />
          </button>
        </div>
      </aside>

      <button
        type="button"
        className={clsx(shell.backdrop, sidebarOpen && shell.isOpen)}
        aria-label="Fermer le menu"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <main className={shell.main}>
        <header className={shell.topbar}>
          <button type="button" className={shell.hamburger} aria-label="Ouvrir le menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className={shell.crumb}>
            <span>VitFix</span>
            <Icon name="chevron" aria-hidden />
            <b>{SIDE_TITLES_FR[route] ?? route}</b>
          </div>
          <div className={shell.crumbMobile}>
            <b>{SIDE_TITLES_FR[route] ?? route}</b>
          </div>
          <div className={shell.spacer} />
          <label className={frStyles.roleField} title="Espace de travail par rôle">
            <Icon name="users" aria-hidden />
            <select className={frStyles.roleSelect} aria-label="Rôle dans le cabinet" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className={shell.crumb}><time dateTime={TODAY.toISOString()}>{NOW_LABEL}</time></div>
          <button type="button" className={shell.iconBtn} aria-label="Rechercher">
            <Icon name="search" aria-hidden />
          </button>
          <div className={frStyles.notifsWrap} ref={notifsRef}>
            <button
              ref={notifsBtnRef}
              type="button"
              className={shell.iconBtn}
              aria-label={`Voir les notifications (${unreadCount} non lues)`}
              aria-haspopup="dialog"
              aria-expanded={notifsOpen}
              onClick={() => setNotifsOpen((o) => !o)}
            >
              <Icon name="bell" aria-hidden />
              {unreadCount > 0 && <span className={shell.pulse} aria-hidden />}
            </button>
            {notifsOpen && (
              <div className={frStyles.notifsPanel} role="dialog" aria-label="Centre de notifications">
                <header className={frStyles.notifsHead}>
                  <div>
                    <h3 className={frStyles.notifsTitle}>Notifications</h3>
                    <p className={frStyles.notifsSub}>{unreadCount === 0 ? 'Tout est à jour' : `${unreadCount} non ${unreadCount === 1 ? 'lue' : 'lues'}`}</p>
                  </div>
                  {unreadCount > 0 && (
                    <button type="button" className={frStyles.notifsMarkAll} onClick={markAllNotifsRead}>
                      Tout marquer comme lu
                    </button>
                  )}
                </header>
                <ul className={frStyles.notifsList}>
                  {NOTIFICATIONS.map((n) => {
                    const u = !readIds.has(n.id)
                    return (
                      <li key={n.id} className={clsx(frStyles.notifsItem, u && frStyles.unread)}>
                        <button
                          type="button"
                          className={frStyles.notifsItemBtn}
                          onClick={() => {
                            markNotifRead(n.id)
                            setNotifsOpen(false)
                          }}
                        >
                          <span className={clsx(frStyles.notifsItemIcon, NOTIF_KIND_CLASS[n.kind])} aria-hidden="true">
                            <Icon name={n.icon} />
                          </span>
                          <span className={frStyles.notifsItemContent}>
                            <span className={frStyles.notifsItemTitle}>{n.title}</span>
                            <span className={frStyles.notifsItemDesc}>{n.desc}</span>
                            <span className={frStyles.notifsItemTime}>{n.time}</span>
                          </span>
                          {u && <span className={frStyles.notifsItemDot} aria-label="Non lue" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <footer className={frStyles.notifsFoot}>
                  <button type="button" className={frStyles.notifsFootBtn} onClick={() => setNotifsOpen(false)}>
                    Voir toutes les notifications →
                  </button>
                </footer>
              </div>
            )}
          </div>
          <Button variant="gold" className={shell.novaMissao} onClick={() => setNewOSOpen(true)}>
            <Icon name="plus" aria-hidden />Nouvelle intervention
          </Button>
        </header>

        <section className={shell.content} aria-label="Page">
          <RoleProvider role={role}>
            {renderModule ? renderModule(route, go) : <p className={shell.placeholderTitle}>{SIDE_TITLES_FR[route] ?? route}</p>}
          </RoleProvider>
        </section>
      </main>

      <CreateModal
        open={newOSOpen}
        onClose={() => setNewOSOpen(false)}
        title="Nouvel ordre de service"
        icon="clipboard"
        fields={[
          { label: 'Copropriété', type: 'select', options: COPRO_NAMES, full: true },
          { label: 'Objet', required: true, full: true },
          { label: 'Prestataire', type: 'select', options: PRESTATAIRES.map((p) => p.nom) },
          { label: 'Urgence', type: 'select', options: ['Normale', 'Prioritaire', 'Urgence'] },
          { label: 'Description', type: 'textarea', full: true },
        ]}
        submitLabel="Créer"
        onDone={() => push({ kind: 'success', title: 'Ordre de service créé', desc: 'Intervention enregistrée' })}
      />
    </div>
  )
}
