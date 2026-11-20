import type { Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { COMPTE_BANQUE_NON_RATTACHE, compteBanque } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { dateVersIso } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  dedoublonnerReleve,
  parserReleveBancaire,
  proposerImputations,
  type ConfianceImputation,
  type LigneReleve,
  type PropositionImputation,
} from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'

/**
 * Analyse d'un relevé avant son import, pour l'écran « Banque et recouvrement » (ImportRelevePanel.tsx) : lecture,
 * doublons et imputations proposées, sur le compte bancaire choisi. Aucune règle propre à l'écran : lecture et
 * dédoublonnage sont ceux du domaine (domain/import/). Fonctions pures.
 * Doublons d'un CSV : lignes déjà enregistrées sur le sous-compte 512 du compte choisi, et lignes non rattachées
 * (« 512 » seul, importées avant le choix du compte, dont le compte n'est pas connu) ; sans compte choisi, toutes les
 * lignes de banque de la copropriété, comme avant.
 */

/** Pastille de confiance d'un rapprochement proposé (clés = champ confiance de proposerImputations). */
export const PILL_CONFIANCE_RAPPROCHEMENT: Record<ConfianceImputation, { kind: string; label: string }> = {
  forte: {
    kind: 'sage',
    label: 'Forte',
  },
  probable: {
    kind: 'amber',
    label: 'Probable',
  },
}

/** Copropriétaire proposé à l'imputation d'un encaissement. */
export interface CoproprietaireImputable {
  id: string
  nom: string
  solde: number
}

/** Copropriétaire choisi pour chaque ligne retenue (index de ligne → id, « » = ne pas imputer). */
export type SelectionsImputation = Record<string, string>

/** Relevé analysé : lignes retenues et doublons écartés, rapprochements proposés, erreurs de lecture. */
export interface AnalyseReleve {
  /** Compte bancaire choisi au moment de l'analyse ; null : aucun (import impossible). */
  compteId: string | null
  retenues: LigneReleve[]
  doublons: LigneReleve[]
  rapprochements: PropositionImputation<LigneReleve, CoproprietaireImputable>[]
  /** Lignes non lues. */
  erreurs: string[]
}

export interface EntreeAnalyseReleve {
  texte: string
  /** Compte bancaire choisi ; null : aucun. */
  compte: { id: string; iban: string | null } | null
  /** Écritures de banque (« 512 » et sous-comptes) du journal de la copropriété. */
  lignesBanque: readonly Pick<Ecriture, 'compte' | 'date' | 'libelle' | 'montant' | 'sens'>[]
  personnes: readonly CoproprietaireImputable[]
}

/** Ligne de relevé d'une écriture de banque : date ISO, montant signé (débit = encaissement positif). */
const ligneDeLEcriture = (ecriture: Pick<Ecriture, 'date' | 'libelle' | 'montant' | 'sens'>): LigneReleve => ({
  date: dateVersIso(ecriture.date) || '',
  libelle: ecriture.libelle,
  montant: ecriture.sens === 'debit' ? ecriture.montant : -ecriture.montant,
})

/** Lignes déjà enregistrées comparées au relevé : voir l'en-tête. */
function lignesExistantes(entree: EntreeAnalyseReleve): LigneReleve[] {
  const comptes = entree.compte ? new Set([compteBanque(entree.compte.id), COMPTE_BANQUE_NON_RATTACHE]) : null
  return entree.lignesBanque.filter((ecriture) => comptes === null || comptes.has(ecriture.compte)).map(ligneDeLEcriture)
}

/** Analyse du relevé collé ou choisi, sur le compte choisi. */
export function analyserReleve(entree: EntreeAnalyseReleve): AnalyseReleve {
  const lecture = parserReleveBancaire(entree.texte),
    { retenues, doublons } = dedoublonnerReleve(lecture.lignes, lignesExistantes(entree))
  return {
    compteId: entree.compte?.id ?? null,
    retenues,
    doublons,
    rapprochements: proposerImputations(retenues, [...entree.personnes]),
    erreurs: lecture.erreurs,
  }
}
