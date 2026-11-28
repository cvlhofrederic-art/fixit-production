'use client'

import { useEffect, useState } from 'react'
import { Tabs } from '@/components/syndic-dashboard/v54/primitives/tabs'

const sectionHeader: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: 'var(--v54-gold-700)', fontWeight: 600, margin: '32px 0 16px',
}

export default function TabsShowcasePage() {
  const [active, setActive] = useState('pro')
  // Marqueur d'hydratation : permet aux E2E d'attendre que le client soit
  // interactif avant d'envoyer clavier/clic (le dev server hydrate lentement).
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <div data-hydrated={hydrated ? 'true' : undefined}>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 5
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Tabs</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Barre d'onglets (underline gold). Clavier WAI-ARIA : flèches gauche/droite (avec wrap), Home/End, activation
        automatique + roving tabindex (le focus suit l'onglet actif).
      </p>

      <h2 style={sectionHeader}>Contrôlé (icônes + badges)</h2>
      <div data-testid="tabs-controlled">
        <Tabs
          ariaLabel="Canal de comunicações"
          active={active}
          onChange={setActive}
          tabs={[
            { id: 'pro', label: 'Pro', icon: 'wrench', badge: 1 },
            { id: 'int', label: 'Interno', icon: 'building' },
            { id: 'ped', label: 'Pedidos', icon: 'doc', badge: 2 },
          ]}
        />
      </div>
      <p style={{ fontSize: 13, color: 'var(--v54-navy-500)' }} data-testid="tabs-active">
        Actif : <strong>{active}</strong>
      </p>

      <h2 style={sectionHeader}>Non-contrôlé (defaultActive)</h2>
      <div data-testid="tabs-uncontrolled">
        <Tabs
          ariaLabel="Seguros"
          defaultActive="ap"
          tabs={[
            { id: 'ap', icon: 'shield', label: 'Apólices' },
            { id: 'sn', icon: 'alert', label: 'Sinistros' },
          ]}
        />
      </div>
    </div>
  )
}
