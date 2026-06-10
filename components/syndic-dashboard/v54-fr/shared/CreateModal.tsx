'use client'

// Modale de création générique — port du CreateModal du mockup v8 : formulaire
// déclaratif (select / textarea / input), validation = toast côté appelant.

import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'
import { Field } from '@/components/syndic-dashboard/v54/primitives/field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import type { IconName } from '@/lib/syndic/icon-names'
import type { ReactNode } from 'react'

export interface CreateField {
  label: ReactNode
  type?: 'text' | 'date' | 'number' | 'email' | 'tel' | 'select' | 'textarea'
  options?: string[]
  placeholder?: string
  value?: string
  required?: boolean
  hint?: ReactNode
  full?: boolean
}

export interface CreateModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  icon?: IconName
  fields?: CreateField[]
  submitLabel?: string
  onDone?: () => void
}

export default function CreateModal({ open, onClose, title, icon, fields = [], submitLabel = 'Valider', onDone }: Readonly<CreateModalProps>) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="cm-t">
      <ModalHead id="cm-t" icon={icon || 'plus'} title={title} onClose={onClose} closeLabel="Fermer" />
      <ModalBody>
        <FormRow>
          {fields.map((f, i) => (
            <Field key={i} label={f.label} name={`cm-${i}`} required={f.required} hint={f.hint} full={f.full}>
              {f.type === 'select' ? (
                <select defaultValue={f.options?.[0]}>
                  {(f.options || []).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={3} placeholder={f.placeholder} />
              ) : (
                <input type={f.type || 'text'} placeholder={f.placeholder} defaultValue={f.value} />
              )}
            </Field>
          ))}
        </FormRow>
      </ModalBody>
      <ModalFoot>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="gold"
          onClick={() => {
            onClose()
            onDone?.()
          }}
        >
          {submitLabel}
        </Button>
      </ModalFoot>
    </Modal>
  )
}
