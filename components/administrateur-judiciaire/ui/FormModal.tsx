'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'

/** Champ de FormModal : « select », « textarea » ou tout type d'input (« text » par défaut). */
export interface ChampFormModal {
  name?: string
  label?: ReactNode
  type?: string
  options?: readonly string[]
  placeholder?: string
  value?: string | null
  required?: boolean
  hint?: ReactNode
  full?: boolean
}

/** Valeurs saisies, indexées par name ou, à défaut, par « cm-<index> ». */
export type ValeursFormModal = Record<string, string>

export interface FormModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** « plus » par défaut. */
  icon?: string
  fields?: readonly ChampFormModal[]
  /** « Valider » par défaut. */
  submitLabel?: ReactNode
  /** Appelé après onClose, avec les valeurs saisies. */
  onDone?: (valeurs: ValeursFormModal) => void
}

const cleChamp = (champ: ChampFormModal, index: number) => champ.name || `cm-${index}`

function valeursInitiales(champs: readonly ChampFormModal[]): ValeursFormModal {
  const valeurs: ValeursFormModal = {}
  champs.forEach((champ, index) => {
    // Une liste déroulante prend par défaut sa première option.
    valeurs[cleChamp(champ, index)] =
      champ.value != null ? champ.value : (champ.type === 'select' && champ.options?.[0]) || ''
  })
  return valeurs
}

/**
 * Formulaire générique en modale. Aucune validation (l'astérisque des champs requis est seulement visuel) ;
 * « Valider » ferme la modale puis transmet les valeurs à onDone. L'état est réinitialisé à chaque ouverture.
 */
export function FormModal({
  open,
  onClose,
  title,
  icon,
  fields = [],
  submitLabel = 'Valider',
  onDone,
}: FormModalProps) {
  const [valeurs, setValeurs] = useState<ValeursFormModal>(() => valeursInitiales(fields))

  useEffect(() => {
    // Réinitialisation à l'ouverture uniquement, avec les champs du rendu courant (dépendance [open] de la maquette).
    if (open) setValeurs(valeursInitiales(fields))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const modifier = (cle: string, valeur: string) => setValeurs((precedentes) => ({ ...precedentes, [cle]: valeur }))

  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="cm-t">
      <ModalHeader id="cm-t" icon={icon || 'plus'} title={title} onClose={onClose} />
      <ModalBody>
        <div className="field-row">
          {fields.map((champ, index) => {
            const cle = cleChamp(champ, index)
            return (
              <Field
                label={champ.label}
                name={cle}
                required={champ.required}
                hint={champ.hint}
                full={champ.full}
                key={index}
              >
                {champ.type === 'select' ? (
                  <select value={valeurs[cle] || ''} onChange={(evenement) => modifier(cle, evenement.target.value)}>
                    {(champ.options || []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : champ.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    placeholder={champ.placeholder}
                    value={valeurs[cle] || ''}
                    onChange={(evenement) => modifier(cle, evenement.target.value)}
                  />
                ) : (
                  <input
                    type={champ.type || 'text'}
                    placeholder={champ.placeholder}
                    value={valeurs[cle] || ''}
                    onChange={(evenement) => modifier(cle, evenement.target.value)}
                  />
                )}
              </Field>
            )
          })}
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button
          className="btn gold"
          onClick={() => {
            onClose()
            if (onDone) onDone(valeurs)
          }}
        >
          {submitLabel}
        </button>
      </ModalFooter>
    </Modal>
  )
}
