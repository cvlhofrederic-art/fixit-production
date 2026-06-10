'use client'

// Modale de génération d'acte — port du DocModal du mockup v8. Fusionne les
// données de l'ordonnance dans le modèle choisi (DOC_TEMPLATES) ; le sélecteur
// de copropriété re-fusionne à la volée. Actions Copier / Générer = toasts démo.

import { useEffect, useState } from 'react'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import { Pill } from '@/components/syndic-dashboard/v54/primitives/pill'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { COPROS, byCode } from '../data/mock'
import { DOC_TEMPLATES, type DocTemplateKey } from '../data/doc-templates'

export interface DocModalProps {
  open: boolean
  tplKey: DocTemplateKey | null
  initialCode?: string
  onClose: () => void
}

export default function DocModal({ open, tplKey, initialCode, onClose }: Readonly<DocModalProps>) {
  const { push } = useToast()
  const [code, setCode] = useState(initialCode || 'CV')
  useEffect(() => {
    if (open) setCode(initialCode || (tplKey ? DOC_TEMPLATES[tplKey].code : 'CV'))
  }, [open, initialCode, tplKey])
  if (!open || !tplKey) return null
  const tpl = DOC_TEMPLATES[tplKey]
  const doc = tpl.fn(byCode(code))
  return (
    <Modal open={open} onClose={onClose} size="lg" labelledBy="doc-t">
      <ModalHead id="doc-t" icon={tpl.icon} title={doc.title} onClose={onClose} closeLabel="Fermer" />
      <ModalBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v54-navy-300)', fontWeight: 600 }}>Copropriété</span>
          <select aria-label="Copropriété" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 280 }}>
            {COPROS.map((c) => (
              <option key={c.code} value={c.code}>{c.nom}</option>
            ))}
          </select>
          <Pill kind="sage" noDot>Données fusionnées automatiquement</Pill>
        </div>
        <div
          style={{
            background: 'var(--v54-paper)',
            border: '1px solid var(--v54-line)',
            borderRadius: 10,
            padding: '22px 24px',
            maxHeight: 380,
            overflow: 'auto',
            fontFamily: 'var(--v54-font-mono)',
            fontSize: 11.5,
            lineHeight: 1.7,
            color: 'var(--v54-navy-700)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {doc.body}
        </div>
      </ModalBody>
      <ModalFoot>
        <Button onClick={onClose}>Fermer</Button>
        <Button onClick={() => push({ kind: 'success', title: 'Copié', desc: 'Acte copié dans le presse-papier' })}>
          <Icon name="doc" aria-hidden />Copier
        </Button>
        <Button
          variant="gold"
          onClick={() => {
            push({ kind: 'success', title: 'Document généré', desc: `${doc.title} — prêt (PDF + LRAR)` })
            onClose()
          }}
        >
          <Icon name="download" aria-hidden />Générer & envoyer
        </Button>
      </ModalFoot>
    </Modal>
  )
}
