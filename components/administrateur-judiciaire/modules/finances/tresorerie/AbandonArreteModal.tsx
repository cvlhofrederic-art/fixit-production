'use client'

import { useState } from 'react'
import { nomDuCompte } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import type { CompteAffiche } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Confirmation « Abandonner l'arrêté » du panneau « Rapprochement » (décision du 26/11/2026, PR 799, rb-01 A : un arrêté
 * en cours mal saisi ne bloque plus le compte), sur le modèle de la confirmation « Clôturer le compte »
 * (CompteBancaireModal.tsx). L'arrêté reste en base, marqué « Abandonné » ; aucune action ne le reprend depuis l'écran :
 * la confirmation le dit avant le clic. Aucune règle ici : l'écriture (db/rapprochements.ts) applique le domaine, et un
 * refus est signalé par un toast, la modale restant ouverte.
 */

export interface AbandonArreteModalProps {
  compte: CompteAffiche
  /** Arrêté en cours du compte. */
  arrete: ArreteRapprochement
  onClose: () => void
  /** Abandonne ; renvoie vrai si la modale peut se fermer. Ne rejette jamais (l'écran signale l'échec). */
  onConfirmer: () => Promise<boolean>
}

export function AbandonArreteModal({ compte, arrete, onClose, onConfirmer }: Readonly<AbandonArreteModalProps>) {
  const [enCours, setEnCours] = useState(false)
  const confirmer = async () => {
    if (enCours) return
    setEnCours(true)
    if (!(await onConfirmer())) setEnCours(false)
  }
  return (
    <Modal open onClose={onClose} labelledBy="abandon-arrete-titre">
      <ModalHeader id="abandon-arrete-titre" icon="ban" title="Abandonner l’arrêté" onClose={onClose} />
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13 }}>
          <b>{`Arrêté au ${dateIsoVersFr(arrete.dateArrete)}`}</b>
          {` · ${nomDuCompte(compte)}`}
        </p>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          L’arrêté reste dans la base, marqué « Abandonné ». Il ne compte plus : ni arrêté en cours, ni solde, ni période
          arrêtée. Un nouvel arrêté pourra être ouvert sur ce compte. Sans retour depuis cet écran.
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn gold" onClick={() => void confirmer()} disabled={enCours}>
          <Icon name="ban" />
          Abandonner l’arrêté
        </button>
      </ModalFooter>
    </Modal>
  )
}
