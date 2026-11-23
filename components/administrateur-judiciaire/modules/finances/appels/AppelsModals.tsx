'use client'

import { useState } from 'react'
import { NATURES_APPEL } from '@/components/administrateur-judiciaire/modules/finances/appels/appels-vue'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/administrateur-judiciaire/ui/Modal'
import { CODE_CLE_GENERALE } from '@/lib/administrateur-judiciaire/db/appels-de-fonds'
import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { CleRepartition, NatureEcheance } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Formulaires de l'écran « Appels de fonds » en données réelles, sur les composants des formulaires du module (Modal,
 * Field), comme ceux des comptes bancaires (CompteBancaireModal) : « Nouvel appel de fonds » (saisie minimale d'une
 * échéance, validée le 20/11/2026), « Ouvrir l'exercice » et la confirmation « Écrire l'appel ». Aucune règle ici :
 * l'écriture (db/appels-de-fonds.ts) contrôle par le domaine, et l'écran signale un refus par un toast, la modale restant
 * ouverte. Chaque `onEnregistrer` / `onConfirmer` renvoie vrai si la modale peut se fermer et ne rejette jamais.
 */

/** Valeur de l'option « clé générale à créer » (aucune clé « 001 » enregistrée). */
const CLE_A_CREER = ''

export interface SaisieFormulaireAppel {
  libelle: string
  nature: NatureEcheance
  exigibilite: string
  /** Montant tel que saisi (euros), converti par l'écran. */
  montant: string
  /** null : clé générale « 001 » à créer depuis les tantièmes des lots. */
  cleId: string | null
}

const NATURES = Object.entries(NATURES_APPEL) as [NatureEcheance, string][]

export interface NouvelAppelModalProps {
  cles: readonly Pick<CleRepartition, 'id' | 'code' | 'libelle'>[]
  onClose: () => void
  onEnregistrer: (saisie: SaisieFormulaireAppel) => Promise<boolean>
}

/** « Nouvel appel de fonds » : une échéance du syndicat, sur une de ses clés ou sur la clé générale à créer. */
export function NouvelAppelModal({ cles, onClose, onEnregistrer }: Readonly<NouvelAppelModalProps>) {
  const triees = [...cles].sort((a, b) => a.code.localeCompare(b.code))
  const cleGeneraleACreer = !triees.some((c) => c.code === CODE_CLE_GENERALE)
  const [valeurs, setValeurs] = useState<Omit<SaisieFormulaireAppel, 'cleId'> & { cle: string }>({
    libelle: '',
    nature: 'budget',
    exigibilite: '',
    montant: '',
    cle: cleGeneraleACreer ? CLE_A_CREER : (triees[0]?.id ?? CLE_A_CREER),
  })
  const [enCours, setEnCours] = useState(false)
  const changer = <K extends keyof typeof valeurs>(cle: K, valeur: (typeof valeurs)[K]) => setValeurs((avant) => ({ ...avant, [cle]: valeur }))

  const enregistrer = async () => {
    if (enCours) return
    setEnCours(true)
    const { cle, ...reste } = valeurs
    if (!(await onEnregistrer({ ...reste, cleId: cle === CLE_A_CREER ? null : cle }))) setEnCours(false)
  }

  return (
    <Modal open onClose={onClose} labelledBy="nouvel-appel-titre">
      <ModalHeader id="nouvel-appel-titre" icon="mail" title="Nouvel appel de fonds" onClose={onClose} />
      <ModalBody>
        <FieldRow>
          <Field label="Libellé" name="appel-libelle" full>
            <input value={valeurs.libelle} onChange={(evenement) => changer('libelle', evenement.target.value)} />
          </Field>
          <Field label="Nature" name="appel-nature" full>
            <select value={valeurs.nature} onChange={(evenement) => changer('nature', evenement.target.value as NatureEcheance)}>
              {NATURES.map(([cle, libelle]) => (
                <option key={cle} value={cle}>
                  {libelle}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Clé de répartition" name="appel-cle" full>
            <select value={valeurs.cle} onChange={(evenement) => changer('cle', evenement.target.value)}>
              {/* Libellé court : « à créer » reste lisible à 375 px (défaut 1 du 22/11/2026) ; la clé créée garde son nom complet. */}
              {cleGeneraleACreer && <option value={CLE_A_CREER}>{`${CODE_CLE_GENERALE} — Charges générales (à créer)`}</option>}
              {triees.map((cle) => (
                <option key={cle.id} value={cle.id}>{`${cle.code} — ${cle.libelle}`}</option>
              ))}
            </select>
          </Field>
          <Field label="Date d’exigibilité" name="appel-exigibilite" full>
            <input type="date" value={valeurs.exigibilite} onChange={(evenement) => changer('exigibilite', evenement.target.value)} />
          </Field>
          <Field label="Montant" name="appel-montant" suffix="€" hint="Montant de l’échéance, réparti au tantième sur la clé." full>
            <input
              value={valeurs.montant}
              inputMode="decimal"
              autoComplete="off"
              onChange={(evenement) => changer('montant', evenement.target.value)}
            />
          </Field>
        </FieldRow>
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

export interface OuvrirExerciceModalProps {
  /** Exigibilité à couvrir (première exigibilité hors des exercices du syndicat). */
  exigibilite: string
  onClose: () => void
  onEnregistrer: (bornes: { ouverture: string; cloture: string }) => Promise<boolean>
}

/** « Ouvrir l'exercice » : bornes d'un exercice du syndicat, en préparation. */
export function OuvrirExerciceModal({ exigibilite, onClose, onEnregistrer }: Readonly<OuvrirExerciceModalProps>) {
  const [bornes, setBornes] = useState({ ouverture: '', cloture: '' })
  const [enCours, setEnCours] = useState(false)
  const enregistrer = async () => {
    if (enCours) return
    setEnCours(true)
    if (!(await onEnregistrer(bornes))) setEnCours(false)
  }
  return (
    <Modal open onClose={onClose} labelledBy="ouvrir-exercice-titre">
      <ModalHeader id="ouvrir-exercice-titre" icon="calendar" title="Ouvrir l’exercice" onClose={onClose} />
      <ModalBody>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 12.5 }}>
          {`L’exigibilité du ${dateIsoVersFr(exigibilite)} doit y être comprise : la date comptable de l’appel est contrôlée sur les exercices du syndicat. L’exercice est créé « en préparation », sans budget voté.`}
        </p>
        <FieldRow>
          <Field label="Ouverture" name="exercice-ouverture">
            <input type="date" value={bornes.ouverture} onChange={(evenement) => setBornes((avant) => ({ ...avant, ouverture: evenement.target.value }))} />
          </Field>
          <Field label="Clôture" name="exercice-cloture">
            <input type="date" value={bornes.cloture} onChange={(evenement) => setBornes((avant) => ({ ...avant, cloture: evenement.target.value }))} />
          </Field>
        </FieldRow>
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

export interface ConfirmerAppelModalProps {
  dateComptable: string
  nombreEcheances: number
  totalCentimes: number
  onClose: () => void
  onConfirmer: () => Promise<boolean>
}

/** Confirmation « Écrire l'appel » : la pièce s'enregistre, les échéances passent « Appelé ». */
export function ConfirmerAppelModal({ dateComptable, nombreEcheances, totalCentimes, onClose, onConfirmer }: Readonly<ConfirmerAppelModalProps>) {
  const [enCours, setEnCours] = useState(false)
  const confirmer = async () => {
    if (enCours) return
    setEnCours(true)
    if (!(await onConfirmer())) setEnCours(false)
  }
  const pluriel = nombreEcheances > 1 ? 's' : ''
  return (
    <Modal open onClose={onClose} labelledBy="ecrire-appel-titre">
      <ModalHeader id="ecrire-appel-titre" icon="coin" title="Écrire l’appel de fonds" onClose={onClose} />
      <ModalBody>
        <p style={{ margin: 0, fontSize: 13 }}>
          {`Pièce « Appel de fonds » du ${dateIsoVersFr(dateComptable)} : ${nombreEcheances} échéance${pluriel}, total ${formatEurosCentimes(totalCentimes / 100)}.`}
        </p>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          {`${nombreEcheances > 1 ? 'Les échéances passent' : 'L’échéance passe'} « Appelé ». Une annulation se fera par une écriture contraire, qui n’est pas encore proposée sur cet écran.`}
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn ghost" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn gold" onClick={() => void confirmer()} disabled={enCours}>
          <Icon name="check" />
          Écrire l’appel
        </button>
      </ModalFooter>
    </Modal>
  )
}
