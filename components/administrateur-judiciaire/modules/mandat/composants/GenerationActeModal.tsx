'use client'

import { useEffect, useState } from 'react'
import { DEMO_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import { useToast } from '@/components/administrateur-judiciaire/ui/toast'
import { useTrouverCopro } from '@/lib/administrateur-judiciaire/db/hooks'
import { MODELES_ACTES_EXPRESS, type CleActeExpress } from '@/lib/administrateur-judiciaire/domain/actes/actes-express'
import { codeCoproSelectionne } from '@/lib/administrateur-judiciaire/selection'

export interface GenerationActeModalProps {
  open: boolean
  /** Acte express à générer ; la fenêtre ne s'affiche pas sans lui. */
  tplKey?: CleActeExpress
  /** Copropriété proposée ; à défaut, celle du dossier sélectionné, sinon celle du modèle (« CV » en dernier recours). */
  initialCode?: string
  onClose: () => void
}

/**
 * Génération express d'un acte : l'acte est rédigé avec les données de la copropriété choisie. Les options du select
 * viennent des copropriétés de démonstration (pas de la base locale), comme dans la maquette. « Copier » et
 * « Générer & envoyer » sont simulés (toasts uniquement, le presse-papiers n'est pas utilisé).
 */
export function GenerationActeModal({ open, tplKey, initialCode, onClose }: GenerationActeModalProps) {
  const { push } = useToast(),
    trouverCopro = useTrouverCopro(),
    [code, setCode] = useState(initialCode || codeCoproSelectionne('CV'))

  useEffect(() => {
    // Réinitialisation à chaque ouverture ou changement d'acte (effet de la maquette, conservé tel quel).
    const codeModele = (tplKey ? MODELES_ACTES_EXPRESS[tplKey].code : undefined) || 'CV'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setCode(initialCode || codeCoproSelectionne(codeModele))
  }, [open, initialCode, tplKey])

  if (!open || !tplKey) return null

  const modele = MODELES_ACTES_EXPRESS[tplKey],
    acte = modele.fn(trouverCopro(code))

  return (
    <Modal open={open} onClose={onClose} size="lg" labelledBy="doc-t">
      <ModalHeader id="doc-t" icon={modele.icon} title={acte.title} onClose={onClose} />
      <ModalBody>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--navy-300)',
              fontWeight: 600,
            }}
          >
            Copropriété
          </span>
          <select
            aria-label="Copropriété"
            value={code}
            onChange={(evenement) => setCode(evenement.target.value)}
            style={{
              maxWidth: 280,
            }}
          >
            {DEMO_COPROPRIETES.map((copro) => (
              <option value={copro.code} key={copro.code}>
                {copro.nom}
              </option>
            ))}
          </select>
          <Pill kind="sage" noDot>
            Données fusionnées automatiquement
          </Pill>
        </div>
        <div
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: '22px 24px',
            maxHeight: 380,
            overflow: 'auto',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 11.5,
            lineHeight: 1.7,
            color: 'var(--navy-700)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {acte.body}
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={onClose}>
          Fermer
        </button>
        <button
          className="btn"
          onClick={() =>
            push({
              kind: 'success',
              title: 'Simulation',
              desc: "Rien n'a été copié dans le presse-papiers.",
            })
          }
        >
          <Icon name="doc" />
          Copier
        </button>
        <button
          className="btn gold"
          onClick={() => {
            push({
              kind: 'success',
              title: 'Simulation',
              desc: "Aucun document n'a été généré ni envoyé.",
            })
            onClose()
          }}
        >
          <Icon name="download" />
          {'Générer & envoyer'}
        </button>
      </ModalFooter>
    </Modal>
  )
}
