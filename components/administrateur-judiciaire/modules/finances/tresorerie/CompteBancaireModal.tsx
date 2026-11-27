'use client'

import { useState } from 'react'
import { ibanGroupe, type CompteAffiche } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { CaseModifiable } from '@/components/administrateur-judiciaire/modules/technique/sinistres/ChampsFiche'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import type { SaisieCompteBancaire } from '@/lib/administrateur-judiciaire/db/comptes-bancaires'
import { NATURES_COMPTE_BANCAIRE, type NatureCompteBancaire } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Formulaires du panneau « Comptes bancaires du mandat » (absents de la maquette, sur les composants des formulaires du
 * module : Modal, Field, case à cocher de la fiche sinistre) : « Nouveau compte » et « Modifier » (une seule modale), et
 * la confirmation « Clôturer ». Aucune règle ici : l'écriture (db/comptes-bancaires.ts) contrôle par le domaine, et
 * l'écran signale un refus par un toast, la modale restant ouverte.
 * Décision du 26/11/2026 (PR 799, point 2, choix A) : deux champs facultatifs de plus, « Solde d'ouverture » (montant
 * signé en euros) et « au » (date, jamais après aujourd'hui), transmis tels que saisis ; vides : aucun solde d'ouverture.
 */

const NATURES = Object.entries(NATURES_COMPTE_BANCAIRE) as [NatureCompteBancaire, { libelle: string }][]

/** Nom affiché d'un compte : son libellé, sinon le libellé de sa nature. */
export const nomDuCompte = (compte: Pick<CompteAffiche, 'libelle' | 'nature'>): string =>
  compte.libelle || NATURES_COMPTE_BANCAIRE[compte.nature].libelle

interface ValeursCompte {
  nature: NatureCompteBancaire
  libelle: string
  iban: string
  bic: string
  etablissement: string
  tenaitFondsTravaux: boolean
  reserveAuFondsTravaux: boolean
  /** Solde d'ouverture en euros, tel que saisi ; vide : aucun. */
  soldeOuverture: string
  /** Date du solde d'ouverture (AAAA-MM-JJ du champ date) ; vide : aucune. */
  soldeOuvertureAu: string
}

/** Solde d'ouverture enregistré, tel que le champ le reprend : euros à deux décimales, sans séparateur de milliers (« -200,50 »). */
const eurosSaisis = (centimes: number): string => (centimes / 100).toFixed(2).replace('.', ',')

const valeursInitiales = (compte: CompteAffiche | null): ValeursCompte => ({
  nature: compte?.nature ?? 'courant',
  libelle: compte?.libelle ?? '',
  iban: compte?.iban ? ibanGroupe(compte.iban) : '',
  bic: compte?.bic ?? '',
  etablissement: compte?.etablissement ?? '',
  tenaitFondsTravaux: compte?.tenaitFondsTravaux ?? false,
  reserveAuFondsTravaux: compte?.reserveAuFondsTravaux ?? false,
  soldeOuverture: compte?.soldeOuverture ? eurosSaisis(compte.soldeOuverture.centimes) : '',
  soldeOuvertureAu: compte?.soldeOuverture?.au ?? '',
})

/** Saisie transmise : seule la marque du fonds propre à la nature choisie est envoyée. */
const saisieDepuis = (valeurs: ValeursCompte): SaisieCompteBancaire => ({
  nature: valeurs.nature,
  libelle: valeurs.libelle,
  iban: valeurs.iban,
  bic: valeurs.bic,
  etablissement: valeurs.etablissement,
  tenaitFondsTravaux: valeurs.nature === 'repris_ancien_gestionnaire' && valeurs.tenaitFondsTravaux,
  reserveAuFondsTravaux: valeurs.nature === 'placement' && valeurs.reserveAuFondsTravaux,
  soldeOuverture: { montant: valeurs.soldeOuverture, au: valeurs.soldeOuvertureAu },
})

export interface CompteBancaireModalProps {
  /** Compte à modifier ; null : nouveau compte. */
  compte: CompteAffiche | null
  onClose: () => void
  /** Enregistre ; renvoie vrai si la modale peut se fermer. Ne rejette jamais (l'écran signale l'échec). */
  onEnregistrer: (saisie: SaisieCompteBancaire) => Promise<boolean>
}

/** « Nouveau compte » et « Modifier ». La modale est remontée pour chaque compte (clé = id) : son état repart du compte. */
export function CompteBancaireModal({ compte, onClose, onEnregistrer }: Readonly<CompteBancaireModalProps>) {
  const [valeurs, setValeurs] = useState<ValeursCompte>(() => valeursInitiales(compte))
  const [enCours, setEnCours] = useState(false)
  const changer = <K extends keyof ValeursCompte>(cle: K, valeur: ValeursCompte[K]) =>
    setValeurs((precedentes) => ({ ...precedentes, [cle]: valeur }))

  const enregistrer = async () => {
    if (enCours) return
    setEnCours(true)
    const ferme = await onEnregistrer(saisieDepuis(valeurs))
    if (!ferme) setEnCours(false)
  }

  return (
    <Modal open onClose={onClose} labelledBy="compte-bancaire-titre">
      <ModalHeader
        id="compte-bancaire-titre"
        icon="bank"
        title={compte ? `Modifier le compte — ${nomDuCompte(compte)}` : 'Nouveau compte bancaire'}
        onClose={onClose}
      />
      <ModalBody>
        <FieldRow>
          <Field label="Nature" name="compte-nature" full>
            <select value={valeurs.nature} onChange={(evenement) => changer('nature', evenement.target.value as NatureCompteBancaire)}>
              {NATURES.map(([cle, nature]) => (
                <option key={cle} value={cle}>
                  {nature.libelle}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Libellé" name="compte-libelle" full>
            <input value={valeurs.libelle} onChange={(evenement) => changer('libelle', evenement.target.value)} />
          </Field>
          <Field label="IBAN" name="compte-iban" hint="Vide : compte sans IBAN propre." full>
            <input
              value={valeurs.iban}
              autoComplete="off"
              spellCheck={false}
              onChange={(evenement) => changer('iban', evenement.target.value)}
            />
          </Field>
          <Field label="BIC" name="compte-bic">
            <input value={valeurs.bic} autoComplete="off" onChange={(evenement) => changer('bic', evenement.target.value)} />
          </Field>
          <Field label="Établissement" name="compte-etablissement">
            <input value={valeurs.etablissement} onChange={(evenement) => changer('etablissement', evenement.target.value)} />
          </Field>
          <Field label="Solde d’ouverture" name="compte-solde-ouverture" hint="Vide : le compte part de zéro ; négatif : découvert." suffix="€">
            <input
              value={valeurs.soldeOuverture}
              inputMode="decimal"
              autoComplete="off"
              onChange={(evenement) => changer('soldeOuverture', evenement.target.value)}
            />
          </Field>
          <Field label="au" name="compte-solde-ouverture-au" hint="Solde au début de ce jour, avant ses mouvements.">
            <input
              type="date"
              max={AUJOURDHUI_ISO}
              value={valeurs.soldeOuvertureAu}
              onChange={(evenement) => changer('soldeOuvertureAu', evenement.target.value)}
            />
          </Field>
        </FieldRow>
        {valeurs.nature === 'repris_ancien_gestionnaire' && (
          <CaseModifiable
            libelle="Tenait le fonds de travaux"
            cochee={valeurs.tenaitFondsTravaux}
            onChange={(cochee) => changer('tenaitFondsTravaux', cochee)}
          />
        )}
        {valeurs.nature === 'placement' && (
          <CaseModifiable
            libelle="Réservé au fonds de travaux"
            cochee={valeurs.reserveAuFondsTravaux}
            onChange={(cochee) => changer('reserveAuFondsTravaux', cochee)}
          />
        )}
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

export interface ClotureCompteModalProps {
  compte: CompteAffiche
  onClose: () => void
  /** Clôture ; renvoie vrai si la modale peut se fermer. Ne rejette jamais (l'écran signale l'échec). */
  onConfirmer: () => Promise<boolean>
}

/**
 * Confirmation « Clôturer » : le compte reste en base, inactif. Aucune action ne le rouvre depuis l'écran (le tableau
 * n'en propose que pour les comptes actifs) : la confirmation le dit avant le clic.
 */
export function ClotureCompteModal({ compte, onClose, onConfirmer }: Readonly<ClotureCompteModalProps>) {
  const [enCours, setEnCours] = useState(false)
  const confirmer = async () => {
    if (enCours) return
    setEnCours(true)
    if (!(await onConfirmer())) setEnCours(false)
  }
  return (
    <Modal open onClose={onClose} labelledBy="cloture-compte-titre">
      <ModalHeader id="cloture-compte-titre" icon="archive" title="Clôturer le compte" onClose={onClose} />
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13 }}>
          <b>{nomDuCompte(compte)}</b>
          {compte.iban ? ` · ${ibanGroupe(compte.iban)}` : ''}
        </p>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          Le compte reste dans la liste, marqué « Clôturé ». Il ne compte plus dans les contrôles du mandat. Sans retour
          depuis cet écran.
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn gold" onClick={() => void confirmer()} disabled={enCours}>
          <Icon name="archive" />
          Clôturer le compte
        </button>
      </ModalFooter>
    </Modal>
  )
}
