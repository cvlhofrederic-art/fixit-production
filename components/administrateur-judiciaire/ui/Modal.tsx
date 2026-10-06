'use client'

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

/** Éléments recevant le focus dans la boîte de dialogue (liste recalculée à chaque appui sur Tab). */
const SELECTEUR_FOCUSABLES =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Modales ouvertes, dans l'ordre d'ouverture : la dernière est celle « du dessus », seule à traiter Échap et Tab.
 * Écart assumé avec la maquette, où chaque modale réagissait à Échap : deux modales empilées se fermaient
 * ensemble et l'ordre des restitutions laissait body.style.overflow à « hidden » (page bloquée).
 */
const modalesOuvertes: object[] = []

/** Valeur de body.style.overflow relevée à l'ouverture de la première modale, restituée à la fermeture de la dernière. */
let debordementOrigine = ''

/** Enregistre une modale qui s'ouvre et bloque le défilement de la page (verrou compté). */
function enregistrerOuverture(jeton: object) {
  if (modalesOuvertes.length === 0) debordementOrigine = document.body.style.overflow
  modalesOuvertes.push(jeton)
  document.body.style.overflow = 'hidden'
}

/** Retire une modale qui se ferme ; la dernière fermeture restitue le défilement d'origine. */
function enregistrerFermeture(jeton: object) {
  const index = modalesOuvertes.lastIndexOf(jeton)
  if (index === -1) return
  modalesOuvertes.splice(index, 1)
  if (modalesOuvertes.length === 0) document.body.style.overflow = debordementOrigine
}

const estAuDessus = (jeton: object) => modalesOuvertes[modalesOuvertes.length - 1] === jeton

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** id du titre (aria-labelledby). */
  labelledBy?: string
  /** « md » par défaut, « lg » pour le visualiseur de documents. */
  size?: 'md' | 'lg'
  children?: ReactNode
}

/**
 * Boîte de dialogue modale : fond cliquable, Échap pour fermer, focus piégé, défilement de la page bloqué.
 * Rendue dans #aj-root (portail) pour rester sous la feuille de style scopée. Rend null si fermée.
 * L'effet d'installation ne dépend que de [open] : le focus initial n'est pris qu'à l'ouverture, et un onClose
 * recréé à chaque rendu du parent ne le relance plus (dans la maquette, qui dépendait de [open, onClose],
 * chaque rendu du parent renvoyait le focus sur le bouton « Fermer » en pleine saisie).
 */
export function Modal({ open, onClose, labelledBy, size = 'md', children }: ModalProps) {
  const refDialogue = useRef<HTMLDivElement>(null)
  // Dernier onClose reçu : Échap appelle toujours la version courante sans réinstaller l'effet d'ouverture.
  const refOnClose = useRef(onClose)

  useEffect(() => {
    refOnClose.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const jeton = {}
    const focusPrecedent = document.activeElement as HTMLElement | null
    // Recalculée à chaque appel : le contenu de la boîte peut changer tant qu'elle est ouverte.
    const focusablesDuDialogue = () => {
      const dialogue = refDialogue.current
      return dialogue ? dialogue.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLES) : []
    }
    const focusablesInitiaux = focusablesDuDialogue()
    if (focusablesInitiaux[0]) focusablesInitiaux[0].focus()
    const surTouche = (evenement: KeyboardEvent) => {
      if (!estAuDessus(jeton)) return
      if (evenement.key === 'Escape') {
        evenement.stopPropagation()
        refOnClose.current()
        return
      }
      if (evenement.key === 'Tab') {
        const focusables = focusablesDuDialogue()
        if (!focusables.length) return
        const premier = focusables[0]
        const dernier = focusables[focusables.length - 1]
        if (evenement.shiftKey && document.activeElement === premier) {
          dernier.focus()
          evenement.preventDefault()
        } else if (!evenement.shiftKey && document.activeElement === dernier) {
          premier.focus()
          evenement.preventDefault()
        }
      }
    }
    document.addEventListener('keydown', surTouche)
    enregistrerOuverture(jeton)
    return () => {
      document.removeEventListener('keydown', surTouche)
      enregistrerFermeture(jeton)
      if (focusPrecedent && focusPrecedent.focus) focusPrecedent.focus()
    }
  }, [open])

  if (!open) return null
  // Le fond n'est pas un contrôle (role="presentation") : l'équivalent clavier du clic sur le fond est Échap.
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(evenement: MouseEvent<HTMLDivElement>) => {
        if (evenement.target === evenement.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div ref={refDialogue} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>,
    document.getElementById('aj-root') ?? document.body,
  )
}

export interface ModalHeaderProps {
  icon?: string
  title?: ReactNode
  /** Cible d'aria-labelledby de la modale. */
  id?: string
  onClose?: () => void
}

/** En-tête de modale : pictogramme facultatif, titre et bouton de fermeture « Fermer ». */
export function ModalHeader({ icon, title, id, onClose }: ModalHeaderProps) {
  return (
    <header className="modal-head">
      <h2 id={id} className="modal-title">
        {icon && <Icon name={icon} className="modal-title-ico" aria-hidden="true" />}
        <span>{title}</span>
      </h2>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
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

export function ModalBody({ children }: { children?: ReactNode }) {
  return <div className="modal-body">{children}</div>
}

export function ModalFooter({ children }: { children?: ReactNode }) {
  return <footer className="modal-foot">{children}</footer>
}
