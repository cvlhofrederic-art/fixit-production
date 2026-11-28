import { ecartJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { BrouillonMandat, Parcelle } from '@/lib/administrateur-judiciaire/domain/import-documents-mandat'
import { normaliserTexteLibre } from '@/lib/administrateur-judiciaire/domain/texte'

/**
 * Immeuble — volet juridique (cartographie Gestéam, tranche 28, onglet « Juridique » de la fiche immeuble) :
 * références cadastrales, règlement de copropriété et diagnostics. Fonctions pures, dates ISO (AAAA-MM-JJ).
 *
 * Gestéam — Réf. cadastrale (plan, préfixe, section, parcelle) ; règlement : date, étude notariale, modifications,
 * non publiées, « À jour loi SRU » ; diagnostics par huit familles, grille Date · Type de document · Validité.
 *
 * Validité : c'est la date portée par le rapport, SAISIE par le gestionnaire. VitFix ne calcule aucune durée légale
 * de validité (elles dépendent du diagnostic, de son résultat et de l'usage : vente, location, travaux).
 * Le seuil « à renouveler » est un réglage de gestion.
 */

/** Les huit familles de diagnostics de la fiche immeuble Gestéam. */
export const FAMILLES_DIAGNOSTIC = {
  amiante_pc: { libelle: 'Amiante parties communes' },
  amiante_pp: { libelle: 'Amiante parties privatives' },
  termites: { libelle: 'Termites' },
  risques_sanitaires: { libelle: 'Autres risques sanitaires' },
  plomb: { libelle: 'Plomb' },
  plomb_eau: { libelle: "Plomb dans l'eau" },
  technique: { libelle: 'Technique, professionnel' },
  juridique: { libelle: 'Juridique' },
} as const satisfies Record<string, { libelle: string }>
export type FamilleDiagnostic = keyof typeof FAMILLES_DIAGNOSTIC

export interface Diagnostic {
  famille: FamilleDiagnostic
  typeDocument: string
  /** Date du rapport. */
  date: string
  /** Date de fin de validité portée par le rapport ; null si le rapport n'en a pas. */
  validite: string | null
}

export function creerDiagnostic(saisie: Diagnostic): Diagnostic {
  if (!Object.hasOwn(FAMILLES_DIAGNOSTIC, saisie.famille)) throw new Error(`Famille de diagnostic inconnue : « ${saisie.famille} ».`)
  const typeDocument = saisie.typeDocument.trim()
  if (!typeDocument) throw new Error('Type de document du diagnostic manquant.')
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date du diagnostic invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
  if (saisie.validite !== null) {
    if (!estDateIsoValide(saisie.validite)) throw new Error(`Date de validité invalide (${saisie.validite}) : AAAA-MM-JJ attendu.`)
    if (saisie.validite < saisie.date) throw new Error('Date de validité antérieure à la date du rapport.')
  }
  return { famille: saisie.famille, typeDocument, date: saisie.date, validite: saisie.validite }
}

export type StatutDiagnostic = 'expire' | 'a_renouveler' | 'valide' | 'sans_validite'

export interface EcheanceDiagnostic extends Diagnostic {
  statut: StatutDiagnostic
  /** Jours jusqu'à la validité (négatif si dépassée) ; null sans validité. */
  joursRestants: number | null
}

/**
 * Échéances des diagnostics au jour donné. Pour un même type de document d'une même famille, seul le rapport le plus
 * récent compte. Tri : par validité croissante, les rapports sans validité en dernier.
 */
export function echeancesDiagnostics(
  diagnostics: Diagnostic[],
  aujourdhui: string,
  { seuilJours = 90 }: { seuilJours?: number } = {},
): EcheanceDiagnostic[] {
  if (!estDateIsoValide(aujourdhui)) throw new Error(`Date de référence invalide (${aujourdhui}) : AAAA-MM-JJ attendu.`)
  const derniers = new Map<string, Diagnostic>()
  for (const diagnostic of diagnostics) {
    const cle = `${diagnostic.famille}|${normaliserTexteLibre(diagnostic.typeDocument)}`
    const existant = derniers.get(cle)
    if (!existant || diagnostic.date > existant.date) derniers.set(cle, diagnostic)
  }
  return [...derniers.values()]
    .map((diagnostic): EcheanceDiagnostic => {
      if (diagnostic.validite === null) return { ...diagnostic, statut: 'sans_validite', joursRestants: null }
      const joursRestants = ecartJours(aujourdhui, diagnostic.validite)
      const statut = joursRestants < 0 ? 'expire' : joursRestants <= seuilJours ? 'a_renouveler' : 'valide'
      return { ...diagnostic, statut, joursRestants }
    })
    .sort((a, b) => (a.validite ?? '9999-12-31').localeCompare(b.validite ?? '9999-12-31'))
}

export interface ReglementCopropriete {
  date: string | null
  notaire: string | null
  /** Dates des actes modificatifs. */
  modificatifs: string[]
  /** Case « À jour loi SRU » de Gestéam ; null = non renseigné. */
  aJourSru: boolean | null
}

export interface ReferencesJuridiques {
  commune: string | null
  codeCommune: string | null
  parcelles: Parcelle[]
  reglement: ReglementCopropriete
  /** Fichiers importés d'où viennent les références. */
  sources: string[]
}

/** Références juridiques de l'immeuble tirées des documents importés (fiche cadastrale, règlement). */
export function referencesDepuisBrouillon(brouillon: BrouillonMandat): ReferencesJuridiques {
  return {
    commune: brouillon.commune,
    codeCommune: brouillon.codeCommune,
    parcelles: brouillon.parcelles,
    reglement: { date: brouillon.dateReglement, notaire: brouillon.notaire, modificatifs: [], aJourSru: null },
    sources: brouillon.sources.filter((s) => s.type === 'reglement' || s.type === 'cadastre').map((s) => s.fichier),
  }
}
