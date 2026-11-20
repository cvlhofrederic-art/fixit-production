'use client'

import { nomDuCompte } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/CompteBancaireModal'
import { ibanGroupe, type CompteAffiche } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/comptes-bancaires-vue'
import { Field } from '@/components/administrateur-judiciaire/ui/Field'

/**
 * Liste d'un compte bancaire actif de la copropriété, partagée par « Importer un relevé » et « Rapprochement » de
 * l'écran « Banque et recouvrement » : comptes lus par l'écran (useComptesBancaires), clôturés jamais proposés. Dans une
 * grille de deux colonnes (card-grid cols-2) : demi-largeur sur ordinateur, pleine largeur sur téléphone.
 */

/** Lecture des comptes bancaires par l'écran. */
export type EtatComptes = 'chargement' | 'erreur' | 'lu'

export const AUCUN_COMPTE_ACTIF = 'Aucun compte bancaire actif : enregistrer d’abord le compte dans « Comptes bancaires du mandat ».'

/** Libellé d'un compte dans la liste : son nom et son IBAN groupé. */
export const libelleCompte = (compte: CompteAffiche): string =>
  compte.iban ? `${nomDuCompte(compte)} · ${ibanGroupe(compte.iban)}` : nomDuCompte(compte)

/** Comptes proposés : les comptes actifs, une fois les comptes lus. */
export const comptesActifs = (comptes: readonly CompteAffiche[], etat: EtatComptes): CompteAffiche[] =>
  etat === 'lu' ? comptes.filter((compte) => compte.actif) : []

export interface ChoixCompteBancaireProps {
  label: string
  name: string
  etat: EtatComptes
  actifs: readonly CompteAffiche[]
  /** Compte choisi ; null : aucun. */
  choisi: CompteAffiche | null
  choisir: (id: string) => void
  /** Plusieurs comptes : première option « Choisir le compte… » (aucun compte choisi d'office). */
  choixExige?: boolean
}

export function ChoixCompteBancaire({ label, name, etat, actifs, choisi, choisir, choixExige = false }: Readonly<ChoixCompteBancaireProps>) {
  const indisponible = etat === 'chargement' ? 'Chargement…' : 'Comptes bancaires illisibles'
  return (
    <div className="card-grid cols-2">
      <Field label={label} name={name} hint={etat === 'lu' && actifs.length === 0 ? AUCUN_COMPTE_ACTIF : undefined}>
        <select value={choisi?.id ?? ''} disabled={etat !== 'lu' || actifs.length === 0} onChange={(evenement) => choisir(evenement.target.value)}>
          {etat !== 'lu' && <option value="">{indisponible}</option>}
          {etat === 'lu' && actifs.length === 0 && <option value="">Aucun compte actif</option>}
          {choixExige && actifs.length > 1 && <option value="">Choisir le compte…</option>}
          {actifs.map((compte) => (
            <option key={compte.id} value={compte.id}>
              {libelleCompte(compte)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}
