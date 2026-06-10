'use client'

// Modale de détail générique — port du DetailModal du mockup v8 :
// paires libellé/valeur en grille 2 colonnes + note de bas de page optionnelle.

import type { ReactNode } from 'react'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import type { IconName } from '@/lib/syndic/icon-names'

export interface DetailField {
  k: ReactNode
  v: ReactNode
  full?: boolean
}

export interface DetailModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  icon?: IconName
  fields: DetailField[]
  footnote?: ReactNode
}

const keyStyle = {
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--v54-navy-300)',
  fontWeight: 600,
  marginBottom: 3,
} as const

export default function DetailModal({ open, onClose, title, icon, fields, footnote }: Readonly<DetailModalProps>) {
  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="dm-t">
      {open && (
        <>
          <ModalHead id="dm-t" icon={icon || 'file'} title={title} onClose={onClose} closeLabel="Fermer" />
          <ModalBody>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              {fields.map((f, i) => (
                <div key={i} style={f.full ? { gridColumn: '1 / -1' } : undefined}>
                  <div style={keyStyle}>{f.k}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--v54-navy-700)' }}>{f.v}</div>
                </div>
              ))}
            </div>
            {footnote && <p style={{ fontSize: 11.5, marginTop: 16, lineHeight: 1.5, color: 'var(--v54-navy-300)' }}>{footnote}</p>}
          </ModalBody>
          <ModalFoot>
            <Button onClick={onClose}>Fermer</Button>
          </ModalFoot>
        </>
      )}
    </Modal>
  )
}
