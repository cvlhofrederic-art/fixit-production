'use client'

import { useEffect, useRef, useId, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  maxWidth?: number | string
  className?: string
  overlayClassName?: string
  children: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  maxWidth = 640,
  className,
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
  children,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Focus management + scroll lock
  useEffect(() => {
    if (!open) return

    previousFocus.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    const timer = setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    }, 0)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = ''
      previousFocus.current?.focus()
    }
  }, [open])

  // Focus trap
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  const style = typeof maxWidth === 'number'
    ? { maxWidth, width: '100%' }
    : { maxWidth, width: '100%' }

  return (
    <div className={overlayClassName} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={className}
        style={style}
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} className="sr-only">{title}</h2>
        {children}
      </div>
    </div>
  )
}
