'use client'

import { useDonneesLocales } from '@/lib/administrateur-judiciaire/db/hooks'
import type {
  Contrat,
  Coproprietaire,
  EcheanceSuivi,
  Lot,
  Prestataire,
  Sinistre,
} from '@/lib/administrateur-judiciaire/db/schema'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import {
  construireFiche360Copropriete,
  construireFiche360Personne,
  type Fiche360Copropriete,
  type Fiche360Personne,
} from '@/lib/administrateur-judiciaire/domain/fiche-360'

/** Fiches 360 (copropriété et personne) assemblées à partir des données de la base locale. */

export type Fiche360CoproprieteLocale = Fiche360Copropriete<
  CoproprieteVue,
  Lot,
  Coproprietaire,
  EcheanceSuivi,
  Contrat,
  Sinistre,
  Prestataire
>

export interface ResultatFiche360Copropriete {
  loading: boolean
  erreur: string | null
  fiche: Fiche360CoproprieteLocale | null
}

/** Fiche 360 de la copropriété d'un code ; fiche null pendant le chargement ou si le code est inconnu. */
export function useFiche360Copropriete(code: string | null | undefined): ResultatFiche360Copropriete {
  const donnees = useDonneesLocales()
  if (donnees.loading)
    return {
      loading: true,
      erreur: null,
      fiche: null,
    }
  const copro = donnees.copros.find((vue) => vue.code === code)
  return copro
    ? {
        loading: false,
        erreur: donnees.erreur,
        fiche: construireFiche360Copropriete(copro, donnees),
      }
    : {
        loading: false,
        erreur: donnees.erreur,
        fiche: null,
      }
}

export type Fiche360PersonneLocale = Fiche360Personne<Coproprietaire, Lot, CoproprieteVue>

/** Entrée du sélecteur de personnes : nom de la copropriété et numéro du lot, « · » si inconnus. */
export interface PersonneListee {
  personne: Coproprietaire
  copro: string
  lot: string
}

export interface ResultatFiche360Personne {
  loading: boolean
  erreur: string | null
  fiche: Fiche360PersonneLocale | null
  /** Tous les copropriétaires, triés par copropriété puis par nom (ordre français). */
  personnes: PersonneListee[]
}

/** Fiche 360 d'un copropriétaire ; à défaut d'identifiant connu, celle du premier copropriétaire de la base. */
export function useFiche360Personne(coproprietaireId: string | null | undefined): ResultatFiche360Personne {
  const donnees = useDonneesLocales(),
    personnes = donnees.coproprietaires
      .map((personne) => {
        const lot = donnees.lots.find((candidat) => candidat.id === personne.lotId),
          copro = lot ? donnees.copros.find((candidate) => candidate.id === lot.coproprieteId) : undefined
        return {
          personne,
          copro: copro ? copro.nom : '·',
          lot: lot ? lot.numero : '·',
        }
      })
      .sort((a, b) => a.copro.localeCompare(b.copro, 'fr') || a.personne.nom.localeCompare(b.personne.nom, 'fr'))
  if (donnees.loading)
    return {
      loading: true,
      erreur: null,
      fiche: null,
      personnes: [],
    }
  const personne =
    donnees.coproprietaires.find((candidat) => candidat.id === coproprietaireId) || donnees.coproprietaires[0]
  return personne
    ? {
        loading: false,
        erreur: donnees.erreur,
        fiche: construireFiche360Personne(personne, donnees),
        personnes,
      }
    : {
        loading: false,
        erreur: donnees.erreur,
        fiche: null,
        personnes,
      }
}
