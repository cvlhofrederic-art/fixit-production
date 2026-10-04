'use client'

import { useEffect, useState } from 'react'
import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'

/** Saisie d'une nouvelle automatisation. */
export interface NouvelleAutomatisation {
  nom: string
  type: string
  freq: string
  agenda: string
  copro: string
}

const TYPES_AUTOMATISATION = [
  'Sauvegarde',
  'Recouvrement',
  'Échéance légale',
  'Rapport',
  'Convocation',
  'Notification',
  'Taxation',
]

const FREQUENCES_AUTOMATISATION = ['Quotidien', 'Hebdomadaire', 'Mensuel', 'Date relative (J- avant échéance)']

/** Formulaire vide (nouvel objet à chaque appel). */
const formulaireVide = (): NouvelleAutomatisation => ({
  nom: '',
  type: 'Sauvegarde',
  freq: 'Hebdomadaire',
  agenda: '',
  copro: 'Toutes les copropriétés',
})

export interface CreerAutomatisationModalProps {
  open: boolean
  onClose: () => void
  onCreate: (automatisation: NouvelleAutomatisation) => void
}

/**
 * Fenêtre « Créer une automatisation » : formulaire réinitialisé à chaque ouverture ; seul le nom est exigé
 * (sans message : un nom vide n'a aucun effet).
 */
export function CreerAutomatisationModal({ open, onClose, onCreate }: CreerAutomatisationModalProps) {
  const [formulaire, setFormulaire] = useState<NouvelleAutomatisation>(formulaireVide)

  useEffect(() => {
    // Réinitialisation à chaque ouverture (effet de la maquette, conservé tel quel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setFormulaire(formulaireVide())
  }, [open])

  if (!open) return null

  const modifier = (champ: keyof NouvelleAutomatisation, valeur: string) =>
    setFormulaire((precedent) => ({
      ...precedent,
      [champ]: valeur,
    }))

  const creer = () => {
    if (formulaire.nom.trim()) {
      onCreate(formulaire)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" labelledBy="tc-t">
      <ModalHeader id="tc-t" icon="bot" title="Créer une automatisation" onClose={onClose} />
      <ModalBody>
        <div className="field-row">
          <Field label="Nom de l'automatisation" name="tc-nom" required full>
            <input
              type="text"
              value={formulaire.nom}
              onChange={(evenement) => modifier('nom', evenement.target.value)}
              placeholder="Ex. Relance des impayés supérieurs à 30 jours"
            />
          </Field>
          <Field label="Type" name="tc-type">
            <select value={formulaire.type} onChange={(evenement) => modifier('type', evenement.target.value)}>
              {TYPES_AUTOMATISATION.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Fréquence" name="tc-freq">
            <select value={formulaire.freq} onChange={(evenement) => modifier('freq', evenement.target.value)}>
              {FREQUENCES_AUTOMATISATION.map((frequence) => (
                <option key={frequence}>{frequence}</option>
              ))}
            </select>
          </Field>
          <Field label="Heure / déclencheur" name="tc-agenda" full>
            <input
              type="text"
              value={formulaire.agenda}
              onChange={(evenement) => modifier('agenda', evenement.target.value)}
              placeholder="Ex. Chaque lundi à 10 h — ou J-30 avant l'AG"
            />
          </Field>
          <Field label="Périmètre" name="tc-copro" full>
            <select value={formulaire.copro} onChange={(evenement) => modifier('copro', evenement.target.value)}>
              {['Toutes les copropriétés', ...DEMO_NOMS_COPROPRIETES].map((copro) => (
                <option key={copro}>{copro}</option>
              ))}
            </select>
          </Field>
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn gold" onClick={creer}>
          <Icon name="plus" />
          {"Créer l'automatisation"}
        </button>
      </ModalFooter>
    </Modal>
  )
}
