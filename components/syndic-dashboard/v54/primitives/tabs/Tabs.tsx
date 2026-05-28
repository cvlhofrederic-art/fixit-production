'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import styles from './Tabs.module.css'

export interface TabItem {
  id: string
  label: ReactNode
  icon?: IconName
  /** Compteur affiché en pilule à droite du label. */
  badge?: ReactNode
  /** id du panel associé → pose aria-controls sur le tab (sinon barre nue). */
  panelId?: string
}

export interface TabsProps {
  tabs: TabItem[]
  /** Contrôlé : id du tab actif (fournir avec onChange). */
  active?: string
  /** Contrôlé : callback de sélection. */
  onChange?: (id: string) => void
  /** Non-contrôlé : tab actif initial. */
  defaultActive?: string
  /** Label accessible du tablist. */
  ariaLabel?: string
  className?: string
}

/**
 * Barre d'onglets v54 — port du `Tabs` du bundle V5.7 (hand-rolled, underline gold)
 * + upgrade a11y au pattern WAI-ARIA Tabs complet :
 * roving tabindex (actif = 0, autres = -1), flèches gauche/droite (avec wrap),
 * Home/End (sans wrap), activation automatique (la flèche déplace le focus,
 * change l'actif ET fire onChange). Visuel byte-exact.
 *
 * 2 modes : contrôlé (active/onChange) ou non-contrôlé (defaultActive + state interne).
 * Ne rend pas les panels ; `panelId` par tab pose aria-controls pour les consommateurs
 * qui rendent un `role="tabpanel"` associé.
 */
export default function Tabs({ tabs, active, onChange, defaultActive, ariaLabel, className }: TabsProps) {
  const [internal, setInternal] = useState<string>(defaultActive ?? active ?? tabs[0]?.id)
  const cur = onChange ? active ?? internal : internal
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([])

  const select = (id: string) => {
    if (onChange) onChange(id)
    else setInternal(id)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((t) => t.id === cur)
    let next: number
    switch (e.key) {
      case 'ArrowRight':
        next = (idx + 1) % tabs.length
        break
      case 'ArrowLeft':
        next = (idx - 1 + tabs.length) % tabs.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = tabs.length - 1
        break
      default:
        return
    }
    e.preventDefault()
    const target = tabs[next]
    if (!target) return
    select(target.id) // activation automatique
    btnRefs.current[next]?.focus() // le focus suit le tab actif (roving)
  }

  return (
    <div className={clsx(styles.tabs, className)} role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {tabs.map((t, i) => {
        const selected = cur === t.id
        return (
          <button
            key={t.id}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={t.panelId}
            tabIndex={selected ? 0 : -1}
            className={clsx(styles.tab, selected && styles.active)}
            onClick={() => select(t.id)}
          >
            {t.icon && <Icon name={t.icon} />}
            {t.label}
            {t.badge != null && <span className={styles.badge}>{t.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
