import type { ReactNode } from 'react'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'

/** Ligne de la fiche détail : libellé, valeur, et pleine largeur facultative. */
export interface ChampDetail {
  k: ReactNode
  v: ReactNode
  full?: boolean
}

export interface DetailModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** « file » par défaut. */
  icon?: string
  fields: readonly ChampDetail[]
  footnote?: ReactNode
}

/** Fiche détail en lecture seule (grille de couples libellé / valeur sur deux colonnes). */
export function DetailModal({ open, onClose, title, icon, fields, footnote }: DetailModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="dm-t">
      {open && (
        <>
          <ModalHeader id="dm-t" icon={icon || 'file'} title={title} onClose={onClose} />
          <ModalBody>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px 24px',
              }}
            >
              {fields.map((champ, index) => (
                <div style={champ.full ? { gridColumn: '1 / -1' } : undefined} key={index}>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--navy-300)',
                      fontWeight: 600,
                      marginBottom: 3,
                    }}
                  >
                    {champ.k}
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: 'var(--navy-700)',
                    }}
                  >
                    {champ.v}
                  </div>
                </div>
              ))}
            </div>
            {footnote && (
              <p
                className="muted"
                style={{
                  fontSize: 11.5,
                  marginTop: 16,
                  lineHeight: 1.5,
                }}
              >
                {footnote}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
