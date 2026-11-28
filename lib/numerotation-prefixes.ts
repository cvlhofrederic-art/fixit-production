// Préfixes des séries de numérotation, alignés sur la fonction next_doc_number (migrations 20261122 et 20261122b) :
// un titulaire dont une fiche est en portugais reçoit ORC (orçamento), FT (fatura), FA (fatura de adiantamento) et
// NC (nota de crédito) ; tout autre titulaire, DEV, FACT, AC et AV. Sert aux replis locaux des artisans, qui doivent
// donner le même préfixe que le serveur.

export type TypeSerie = 'devis' | 'facture' | 'avoir' | 'acompte'

const PREFIXES_PORTUGAIS: Record<TypeSerie, string> = { devis: 'ORC', facture: 'FT', acompte: 'FA', avoir: 'NC' }
const PREFIXES_FRANCAIS: Record<TypeSerie, string> = { devis: 'DEV', facture: 'FACT', acompte: 'AC', avoir: 'AV' }

/** Préfixe d'une série, comme next_doc_number. */
export function prefixeSerie(type: TypeSerie, portugais: boolean): string {
  return (portugais ? PREFIXES_PORTUGAIS : PREFIXES_FRANCAIS)[type]
}

/**
 * Critère du serveur appliqué à la fiche chargée par le tableau de bord (profiles_artisan, lue en entier) : sa langue
 * est le portugais. Une fiche absente ou sans langue donne false, comme le serveur.
 */
export function fichePortugaise(fiche: unknown): boolean {
  return (fiche as { language?: unknown } | null | undefined)?.language === 'pt'
}
