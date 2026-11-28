'use client'

import { useState } from 'react'
import { eurosArrete, type ValeursArrete } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/arretes-vue'
import { nomDuCompte } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import type { CompteAffiche, EcritureSolde } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { soldeCompteBancaireCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Formulaire « Nouvel arrêté » du panneau « Rapprochement » (absent de la maquette, qui montrait un arrêté figé ;
 * formulaires validés le 20/11/2026), sur les composants des formulaires du module (Modal, Field), comme « Nouveau
 * compte ». Saisie : date de l'arrêté (aujourd'hui proposé) et solde banque du relevé. Le solde compta n'est pas saisi :
 * il est montré, calculé sur le sous-compte 512 du compte à la date (le même calcul que l'écriture, db/rapprochements.ts).
 * Ce montant n'est plus figé à l'ouverture (décision du 26/11/2026, PR 799, rb-03 A) : il est recalculé jusqu'à la
 * clôture, et le formulaire le dit. Même décision : un espace avant la ligne du solde compta, qui ne se lit plus comme la
 * suite de l'aide du solde banque (rb-c03 A), et un séparateur des milliers visible (rb-c02 A).
 * Décision du 26/11/2026 (PR 799, point 2, choix A) : ce solde reprend le solde d'ouverture du compte quand l'arrêté est
 * daté de son jour ou d'après, et la phrase d'explication le dit alors. Le libellé devient dans ce cas « Solde compta du
 * compte » (relecture du 27/11/2026) : ce montant n'est plus le solde du sous-compte 512 au journal, où le solde
 * d'ouverture n'est pas écrit et où restent les lignes datées avant lui.
 * Réponse du référent métier du 28/11/2026 (PR 848, point 2, choix B) : solde d'ouverture de fin de journée, seules les
 * lignes datées après son jour s'y ajoutent, et la phrase d'explication le dit. Un arrêté daté avant lui est refusé à
 * l'écriture (point 5, « solde inconnu avant le JJ/MM/AAAA ») : le formulaire montre encore, pour cette date, le solde
 * du sous-compte 512.
 * Aucune règle ici : l'écran contrôle la saisie et l'écriture applique le domaine ; un refus est signalé par un toast,
 * la modale restant ouverte.
 */

export interface NouvelArreteModalProps {
  compte: CompteAffiche
  /** Écritures du journal de banque de la copropriété : solde compta montré. */
  ecrituresBanque: readonly EcritureSolde[]
  onClose: () => void
  /** Contrôle et enregistre ; renvoie vrai si la modale peut se fermer. Ne rejette jamais (l'écran signale l'échec). */
  onEnregistrer: (valeurs: ValeursArrete) => Promise<boolean>
}

export function NouvelArreteModal({ compte, ecrituresBanque, onClose, onEnregistrer }: Readonly<NouvelArreteModalProps>) {
  const [valeurs, setValeurs] = useState<ValeursArrete>({ date: AUJOURDHUI_ISO, soldeBanque: '' })
  const [enCours, setEnCours] = useState(false)
  const soldeCompta = estDateIsoValide(valeurs.date)
    ? (soldeCompteBancaireCentimes(ecrituresBanque, compte.id, compte.soldeOuverture, valeurs.date) ?? 0)
    : null
  // Solde d'ouverture du compte, quand il entre dans le solde compta montré (arrêté daté de son jour ou d'après).
  const ouvertureComptee = compte.soldeOuverture && soldeCompta !== null && valeurs.date >= compte.soldeOuverture.au ? compte.soldeOuverture : null

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
            <input type="date" value={valeurs.date} onChange={(evenement) => setValeurs((v) => ({ ...v, date: evenement.target.value }))} />
          </Field>
          <Field label="Solde banque" name="arrete-solde-banque" hint="Solde du relevé de la banque à cette date ; négatif : découvert." suffix="€">
            <input
              value={valeurs.soldeBanque}
              inputMode="decimal"
              autoComplete="off"
              onChange={(evenement) => setValeurs((v) => ({ ...v, soldeBanque: evenement.target.value }))}
            />
          </Field>
        </FieldRow>
        <p className="muted" style={{ margin: '14px 0 0', fontSize: 12.5 }}>
          {soldeCompta === null ? (
            'Solde compta : date de l’arrêté à saisir.'
          ) : (
            <>
              {`Solde compta du ${ouvertureComptee ? 'compte' : 'sous-compte 512'} au ${dateIsoVersFr(valeurs.date)} : `}
              <b>{eurosArrete(soldeCompta)}</b>
            </>
          )}
        </p>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
          {ouvertureComptee
            ? `Solde d’ouverture du ${dateIsoVersFr(ouvertureComptee.au)} et lignes de relevé importées sur ce compte datées après ce jour, jusqu’à la date de l’arrêté`
            : 'Lignes de relevé importées sur ce compte jusqu’à cette date'}
          {' ; montant recalculé jusqu’à la clôture de l’arrêté, puis figé.'}
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
