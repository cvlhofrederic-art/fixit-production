'use client'

import { useState, type ReactNode } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

export interface Onglet {
  id: string
  label: ReactNode
  icon?: string
  badge?: ReactNode
}

export interface TabsProps {
  tabs: readonly Onglet[]
  /** Onglet actif en mode contrôlé (avec onChange). */
  active?: string
  onChange?: (id: string) => void
  /** Onglet par défaut (premier onglet sinon) : c'est la vue que l'écran affiche réellement. */
  defaultActive?: string
}

/**
 * Barre d'onglets. En mode autonome (sans onChange), choisir un autre onglet que celui par défaut ne change pas
 * le contenu de l'écran : un bandeau role=status le signale (comportement de la maquette, conservé).
 */
export function Tabs({ tabs, active, onChange, defaultActive }: TabsProps) {
  const [ongletLocal, setOngletLocal] = useState(defaultActive ?? active ?? (tabs[0] && tabs[0].id))
  const ongletActif = onChange ? active : ongletLocal
  const choisir = (id: string) => {
    if (onChange) onChange(id)
    else setOngletLocal(id)
  }
  const ongletParDefaut = defaultActive ?? (tabs[0] && tabs[0].id)
  const vueNonBranchee = !onChange && ongletActif !== ongletParDefaut
  const libelle = (id: string | undefined) => tabs.find((onglet) => onglet.id === id)?.label || id

  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((onglet) => (
          <button
            role="tab"
            aria-selected={ongletActif === onglet.id}
            className={`tab ${ongletActif === onglet.id ? 'active' : ''}`}
            onClick={() => choisir(onglet.id)}
            key={onglet.id}
          >
            {onglet.icon && <Icon name={onglet.icon} />}
            {onglet.label}
            {onglet.badge != null && <span className="badge">{onglet.badge}</span>}
          </button>
        ))}
      </div>
      {vueNonBranchee && (
        <div
          role="status"
          style={{
            fontSize: 12,
            color: 'var(--navy-500)',
            padding: '6px 2px 10px',
          }}
        >
          {'Onglet « '}
          {libelle(ongletActif)}
          {" » : cette vue n'est pas encore branchée sur la base (écran de démonstration) ; l'écran montre « "}
          {libelle(ongletParDefaut)}
          {' ».'}
        </div>
      )}
    </>
  )
}
