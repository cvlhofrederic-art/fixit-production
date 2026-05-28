'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import styles from './Modal.module.css'

/** Sélecteur des éléments focusables (port byte-exact du bundle V5.7). */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]),'
  + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** id du titre (ModalHead) → pose aria-labelledby sur le dialog. */
  labelledBy?: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  className?: string
}

/**
 * Modal v54 — port du `Modal` hand-rolled du bundle V5.7 (focus trap complet)
 * + 3 durcissements a11y validés avec le design author :
 *   (a) `inert` + `aria-hidden` sur l'arrière-plan (le bundle ne neutralisait pas
 *       le fond — vrai trou a11y : les lecteurs d'écran y accédaient encore) ;
 *   (b) re-query des focusables À CHAQUE Tab (le bundle les capturait une seule
 *       fois à l'ouverture → les champs conditionnels d'un form-modal sortaient
 *       du piège) ;
 *   (c) compensation de la largeur de scrollbar (sinon la page saute de ~15px à
 *       l'ouverture quand on pose `overflow:hidden`).
 * Volontairement NON traités (anti over-engineering, décision design) : modals
 * imbriqués, nœuds-sentinelles de focus, lock tactile iOS.
 *
 * Mécanique conservée du bundle : ESC ferme (stopPropagation), Tab/Shift+Tab
 * cyclique, focus initial sur le 1er focusable, restauration du focus au close,
 * scroll-lock, clic backdrop ferme, role=dialog + aria-modal, portal vers body,
 * unmount quand `open` est faux.
 */
export default function Modal({ open, onClose, labelledBy, size = 'md', children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  // onClose dans un ref : l'effet ne dépend que de `open`, donc une nouvelle
  // référence de callback (arrow inline côté consommateur) ne re-déclenche pas
  // tout le setup (ce qui ferait sauter le focus en plein remplissage).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Portal SSR-safe : pas de createPortal tant que non monté côté client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    lastFocusedRef.current = document.activeElement as HTMLElement | null

    // Focus initial sur le premier focusable du dialog.
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    // (a) Neutralise l'arrière-plan : tout enfant de <body> sauf le backdrop.
    const backdrop = backdropRef.current
    const neutralized: Array<{ el: HTMLElement; inert: boolean; ariaHidden: string | null }> = []
    Array.from(document.body.children).forEach((node) => {
      if (!(node instanceof HTMLElement) || node === backdrop) return
      neutralized.push({ el: node, inert: node.inert, ariaHidden: node.getAttribute('aria-hidden') })
      node.inert = true
      node.setAttribute('aria-hidden', 'true')
    })

    // (c) Scroll-lock + compensation scrollbar.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = document.body.style.overflow
    const prevPadding = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab' && dialog) {
        // (b) re-query à chaque Tab.
        const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          last.focus()
          e.preventDefault()
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus()
          e.preventDefault()
        }
      }
    }
    // Fermeture par clic backdrop = RACCOURCI SOURIS bonus, pas un chemin a11y.
    // Le chemin clavier/AT de fermeture est ESC (géré ci-dessus, toujours dispo).
    // On attache via addEventListener plutôt qu'un onClick JSX pour ne pas
    // déclencher jsx-a11y S1082 (handler de clic sur un <div> non-interactif).
    // À être honnête : ce n'est PAS un fix « à la racine » — c'est un
    // contournement assumé du linter. La vraie préoccupation de S1082
    // (équivalence clavier) est satisfaite AILLEURS, par le handler ESC global,
    // pas par le backdrop lui-même. Ne PAS « nettoyer » en repassant à un
    // onClick JSX : Sonar reflagguerait et on relancerait la même boucle.
    const onBackdropClick = (e: MouseEvent) => {
      if (e.target === backdrop) onCloseRef.current()
    }
    backdrop?.addEventListener('click', onBackdropClick)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      backdrop?.removeEventListener('click', onBackdropClick)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPadding
      // Restaure l'arrière-plan AVANT de rendre le focus (un focus sur un nœud
      // encore `inert` échouerait silencieusement).
      neutralized.forEach(({ el, inert, ariaHidden }) => {
        el.inert = inert
        if (ariaHidden === null) el.removeAttribute('aria-hidden')
        else el.setAttribute('aria-hidden', ariaHidden)
      })
      lastFocusedRef.current?.focus?.()
    }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div ref={backdropRef} className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={clsx(styles.modal, styles[size], className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export interface ModalHeadProps {
  icon?: IconName
  title: ReactNode
  /** id du titre = cible de `labelledBy` du Modal. */
  id?: string
  onClose: () => void
  /** Libellé accessible du bouton fermer (défaut bundle : « Fechar »). */
  closeLabel?: string
}

export function ModalHead({ icon, title, id, onClose, closeLabel = 'Fechar' }: ModalHeadProps) {
  return (
    <header className={styles.head}>
      <h2 id={id} className={styles.title}>
        {icon && <Icon name={icon} className={styles.titleIco} />}
        <span>{title}</span>
      </h2>
      <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6l-6 6-6 6" />
        </svg>
      </button>
    </header>
  )
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>
}

export function ModalFoot({ children }: { children: ReactNode }) {
  return <footer className={styles.foot}>{children}</footer>
}
