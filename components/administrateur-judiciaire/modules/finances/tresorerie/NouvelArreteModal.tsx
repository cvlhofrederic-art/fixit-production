'use client'

import { useState } from 'react'
import {
  aideSoldeBanque,
  eurosArrete,
  saisieDuSolde,
  type ValeursArrete,
} from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import { nomDuCompte } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import type { CompteAffiche, EcritureSolde } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { compteBanque, soldeCompteCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { soldeBanquePropose, type ReleveImporte } from '@/lib/administrateur-judiciaire/domain/import/releves-importes'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Formulaire « Nouvel arrêté » du panneau « Rapprochement » (absent de la maquette, qui montrait un arrêté figé ;
 * formulaires validés le 20/11/2026), sur les composants des formulaires du module (Modal, Field), comme « Nouveau
 * compte ». Saisie : date de l'arrêté (aujourd'hui proposé) et solde banque du relevé. Le solde compta n'est pas saisi :
 * il est montré, calculé sur le sous-compte 512 du compte à la date (le même calcul que l'écriture, db/rapprochements.ts).
 * Ce montant n'est plus figé à l'ouverture (décision du 26/11/2026, PR 799, rb-03 A) : il est recalculé jusqu'à la
 * clôture, et le formulaire le dit. Même décision : un espace avant la ligne du solde compta, qui ne se lit plus comme la
 * suite de l'aide du solde banque (rb-c03 A), et un séparateur des milliers visible (rb-c02 A).
 * Décision du 26/11/2026 (rb-03 C) : le solde banque n'est plus laissé vide quand un relevé CFONB 120 ou camt.053 a été
 * importé sur le compte. Le solde de clôture du dernier relevé clos au plus tard à la date de l'arrêté est proposé dans le
 * champ, avec sa source sous le champ (« relevé du JJ/MM/AAAA ») ; il suit la date tant que le champ n'a pas été touché.
 * Dès que le champ est modifié, c'est la saisie à la main qui vaut, et elle reste quand la date change. Sans relevé
 * importé à la date : champ vide, comme avant.
 * Aucune règle ici : l'écran contrôle la saisie et l'écriture applique le domaine ; un refus est signalé par un toast,
 * la modale restant ouverte.
 */

export interface NouvelArreteModalProps {
  compte: CompteAffiche
  /** Écritures du journal de banque de la copropriété : solde compta montré. */
  ecrituresBanque: readonly EcritureSolde[]
  /** Relevés importés gardés de la copropriété : solde banque proposé (ceux du compte seulement). */
  relevesImportes: readonly ReleveImporte[]
  onClose: () => void
  /** Contrôle et enregistre ; renvoie vrai si la modale peut se fermer. Ne rejette jamais (l'écran signale l'échec). */
  onEnregistrer: (valeurs: ValeursArrete) => Promise<boolean>
}

export function NouvelArreteModal({ compte, ecrituresBanque, relevesImportes, onClose, onEnregistrer }: Readonly<NouvelArreteModalProps>) {
  const [date, setDate] = useState(AUJOURDHUI_ISO)
  // Solde saisi à la main ; null tant que le champ n'a pas été touché : il montre alors le solde proposé, s'il y en a un.
  const [soldeSaisi, setSoldeSaisi] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const propose = soldeSaisi === null ? soldeBanquePropose(relevesImportes, compte.id, date) : null
  const valeurs: ValeursArrete = { date, soldeBanque: soldeSaisi ?? (propose ? saisieDuSolde(propose.centimes) : '') }
  const soldeCompta = estDateIsoValide(valeurs.date) ? (soldeCompteCentimes(ecrituresBanque, compteBanque(compte.id), valeurs.date) ?? 0) : null

  const enregistrer = async () => {
    if (enCours) return
    setEnCours(true)
    if (!(await onEnregistrer(valeurs))) setEnCours(false)
  }

  return (
    <Modal open onClose={onClose} labelledBy="nouvel-arrete-titre">
      <ModalHeader id="nouvel-arrete-titre" icon="check" title={`Nouvel arrêté — ${nomDuCompte(compte)}`} onClose={onClose} />
      <ModalBody>
        <FieldRow>
          <Field label="Date de l’arrêté" name="arrete-date">
            <input type="date" value={valeurs.date} onChange={(evenement) => setDate(evenement.target.value)} />
          </Field>
          <Field label="Solde banque" name="arrete-solde-banque" hint={aideSoldeBanque(propose)} suffix="€">
            <input value={valeurs.soldeBanque} inputMode="decimal" autoComplete="off" onChange={(evenement) => setSoldeSaisi(evenement.target.value)} />
          </Field>
        </FieldRow>
        <p className="muted" style={{ margin: '14px 0 0', fontSize: 12.5 }}>
          {soldeCompta === null ? (
            'Solde compta : date de l’arrêté à saisir.'
          ) : (
            <>
              {`Solde compta du sous-compte 512 au ${dateIsoVersFr(valeurs.date)} : `}
              <b>{eurosArrete(soldeCompta)}</b>
            </>
          )}
        </p>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
          Lignes de relevé importées sur ce compte jusqu’à cette date ; montant recalculé jusqu’à la clôture de l’arrêté,
          puis figé.
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn gold" onClick={() => void enregistrer()} disabled={enCours}>
          <Icon name="check" />
          Enregistrer
        </button>
      </ModalFooter>
    </Modal>
  )
}
