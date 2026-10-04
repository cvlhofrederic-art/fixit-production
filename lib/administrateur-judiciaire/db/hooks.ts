'use client'

import { useEffect, useMemo } from 'react'
import {
  DEMO_COPROPRIETES,
  trouverCoproDemo,
  type CoproprieteDemo,
} from '@/components/administrateur-judiciaire/data/coproprietes'
import { useDonneesStore, type EtatDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import type { Copropriete, Mandat } from '@/lib/administrateur-judiciaire/db/schema'
import {
  COPRO_VIDE,
  formaterDatesCoproVue,
  fusionnerCoproMandat,
  type CoproprieteVue,
  type CoproprieteVueFormatee,
} from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'

/**
 * Hooks de lecture de la base locale. Chacun déclenche le chargement du store (loadAll) tant qu'il n'a pas eu lieu.
 */

/** Fusionne chaque copropriété avec son mandat (le dernier mandat trouvé pour une copropriété l'emporte). */
function fusionnerCoprosMandats(coproprietes: Copropriete[], mandats: Mandat[]): CoproprieteVue[] {
  const mandatsParCopro = new Map(mandats.map((mandat) => [mandat.coproprieteId, mandat]))
  return coproprietes.map((copro) => fusionnerCoproMandat(copro, mandatsParCopro.get(copro.id)))
}

export interface ResultatCoproprietes {
  /** Vues copropriété, dates non formatées. */
  copros: CoproprieteVue[]
  loading: boolean
  erreur: string | null
  create: EtatDonneesStore['createCopropriete']
  update: EtatDonneesStore['updateCopropriete']
}

export function useCoproprietes(): ResultatCoproprietes {
  const {
    coproprietes,
    mandats,
    loaded,
    erreur,
    loadAll,
    createCopropriete,
    updateCopropriete,
  } = useDonneesStore()
  useEffect(() => {
    if (!loaded) loadAll()
  }, [loaded, loadAll])
  // Mémorisé sur les tableaux du store (remplacés à chaque écriture) : résultat identique à un recalcul par rendu.
  const copros = useMemo(() => fusionnerCoprosMandats(coproprietes, mandats), [coproprietes, mandats])
  return {
    copros,
    loading: !loaded,
    erreur,
    create: createCopropriete,
    update: updateCopropriete,
  }
}

export interface ResultatPrestataires {
  prestataires: EtatDonneesStore['prestataires']
  loading: boolean
  create: EtatDonneesStore['createPrestataire']
  update: EtatDonneesStore['updatePrestataire']
}

export function usePrestataires(): ResultatPrestataires {
  const { prestataires, loaded, loadAll, createPrestataire, updatePrestataire } = useDonneesStore()
  useEffect(() => {
    if (!loaded) loadAll()
  }, [loaded, loadAll])
  return {
    prestataires,
    loading: !loaded,
    create: createPrestataire,
    update: updatePrestataire,
  }
}

/** Copropriété affichable : vue de la base (dates « JJ/MM/AAAA ») ou copropriété de démonstration. */
export type CoproprieteAffichee = CoproprieteVueFormatee | CoproprieteDemo

/**
 * Copropriétés à afficher. Mode réel : liste vide pendant le chargement, puis les vues de la base.
 * Mode démo : les copropriétés de démonstration pendant le chargement ou en cas d'erreur, puis les vues de la base.
 */
export function useCoproprietesAffichees(): CoproprieteAffichee[] {
  const { copros, loading, erreur } = useCoproprietes()
  return MODE_ACTIF === 'reel'
    ? loading
      ? []
      : copros.map(formaterDatesCoproVue)
    : loading || erreur
      ? DEMO_COPROPRIETES
      : copros.map(formaterDatesCoproVue)
}

/**
 * Résolution d'une copropriété par code parmi les copropriétés affichées ; à défaut, COPRO_VIDE en mode réel,
 * la copropriété de démonstration du code (ou la première) en mode démo.
 */
export function useTrouverCopro(): (code: string | null | undefined) => CoproprieteAffichee {
  const affichees = useCoproprietesAffichees()
  return (code) =>
    affichees.find((copro) => copro.code === code) || (MODE_ACTIF === 'reel' ? COPRO_VIDE : trouverCoproDemo(code))
}

/** Copropriété d'un code (voir useTrouverCopro). */
export function useCoproParCode(code: string | null | undefined): CoproprieteAffichee {
  return useTrouverCopro()(code)
}

export interface DonneesLocales {
  loading: boolean
  erreur: string | null
  /** Vues copropriété, dates non formatées. */
  copros: CoproprieteVue[]
  lots: EtatDonneesStore['lots']
  coproprietaires: EtatDonneesStore['coproprietaires']
  prestataires: EtatDonneesStore['prestataires']
  echeances: EtatDonneesStore['echeances']
  taches: EtatDonneesStore['taches']
  notifications: EtatDonneesStore['notifications']
  contrats: EtatDonneesStore['contrats']
  sinistres: EtatDonneesStore['sinistres']
  impayes: EtatDonneesStore['impayes']
  ecritures: EtatDonneesStore['ecritures']
  journaux: EtatDonneesStore['journaux']
  documents: EtatDonneesStore['documents']
  importerReleve: EtatDonneesStore['importerReleve']
  imputerEncaissement: EtatDonneesStore['imputerEncaissement']
  avancerRecouvrement: EtatDonneesStore['avancerRecouvrement']
  importerCoproprietaires: EtatDonneesStore['importerCoproprietaires']
  basculerPieceReprise: EtatDonneesStore['basculerPieceReprise']
  creerNote: EtatDonneesStore['creerNote']
  createCopropriete: EtatDonneesStore['createCopropriete']
}

/** Toutes les données de la base locale et les actions d'écriture (écrans « données réelles »). */
export function useDonneesLocales(): DonneesLocales {
  const etat = useDonneesStore(),
    { loaded, loadAll } = etat
  useEffect(() => {
    if (!loaded) loadAll()
  }, [loaded, loadAll])
  // Mémorisé sur les tableaux du store (remplacés à chaque écriture) : résultat identique à un recalcul par rendu.
  const copros = useMemo(
    () => fusionnerCoprosMandats(etat.coproprietes, etat.mandats),
    [etat.coproprietes, etat.mandats],
  )
  return {
    loading: !etat.loaded,
    erreur: etat.erreur,
    copros,
    lots: etat.lots,
    coproprietaires: etat.coproprietaires,
    prestataires: etat.prestataires,
    echeances: etat.echeances,
    taches: etat.taches,
    notifications: etat.notifications,
    contrats: etat.contrats,
    sinistres: etat.sinistres,
    impayes: etat.impayes,
    ecritures: etat.ecritures,
    journaux: etat.journaux,
    documents: etat.documents,
    importerReleve: etat.importerReleve,
    imputerEncaissement: etat.imputerEncaissement,
    avancerRecouvrement: etat.avancerRecouvrement,
    importerCoproprietaires: etat.importerCoproprietaires,
    basculerPieceReprise: etat.basculerPieceReprise,
    creerNote: etat.creerNote,
    createCopropriete: etat.createCopropriete,
  }
}
