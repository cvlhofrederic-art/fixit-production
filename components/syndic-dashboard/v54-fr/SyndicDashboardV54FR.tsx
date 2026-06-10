'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ToastProvider, useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import ShellFR from './shell/ShellFR'
import { SIDE_TITLES_FR } from './shell/sidebar-config'
import { MODULES_FR } from './modules'

/**
 * Racine du dashboard syndic judiciaire FR — port du mockup v8 sur l'architecture
 * v54 : ToastProvider (labels FR) > ShellFR (sidebar + topbar + notifs + rôle) >
 * module actif via le registre MODULES_FR (rempli par les lots de modules).
 * Tout est mock — le branchement /api/syndic/* viendra en lots ultérieurs (pas de
 * SyndicDataProvider ici, contrairement au PT).
 */

const eyebrowStyle = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
} as const

function PlaceholderFR({ route }: Readonly<{ route: string }>) {
  return (
    <div>
      <p style={eyebrowStyle}>Module</p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 30, margin: '4px 0 0' }}>{SIDE_TITLES_FR[route] ?? route}</h1>
      <div style={{ marginTop: 40, padding: '60px 24px', textAlign: 'center', border: '1px dashed var(--v54-line-strong)', borderRadius: 'var(--v54-r-lg)', background: '#fff' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--v54-navy-500)' }}>Contenu de ce module en cours de portage.</p>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--v54-navy-300)' }}>La coquille (shell) et la navigation sont fonctionnelles.</p>
      </div>
    </div>
  )
}

function renderModule(route: string, navigate: (id: string) => void): ReactNode {
  const Mod = MODULES_FR[route]
  if (Mod) return <Mod onNavigate={navigate} />
  return <PlaceholderFR route={route} />
}

function DashboardInner() {
  const { push } = useToast()
  return (
    <ShellFR
      defaultRoute="cockpit"
      renderModule={renderModule}
      onLogout={() => push({ kind: 'info', title: 'Déconnexion', desc: 'Fin de session (démonstration)' })}
    />
  )
}

export default function SyndicDashboardV54FR() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  // margin négative pour annuler le padding 32px du gate et obtenir un dashboard plein écran.
  return (
    <div data-hydrated={hydrated ? 'true' : undefined} style={{ margin: -32 }}>
      <ToastProvider closeLabel="Fermer la notification" regionLabel="Notifications">
        <DashboardInner />
      </ToastProvider>
    </div>
  )
}
