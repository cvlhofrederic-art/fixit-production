import { mapLegalFormToCode } from '@/lib/devis-utils'

/** Forme juridique portugaise : motif reconnu, code interne du PDF, libellé affiché, capital social exigé. */
export interface FormePortugaise {
  motif: RegExp
  code: string
  libelle: string
  capital: boolean
}

/**
 * Formes juridiques portugaises, celles de l'inscription portugaise (lib/config/companyTypes.ts, libellés portugais et
 * français) et leurs abréviations : libellé affiché et code interne (getStatusLabel). Elles servent au formulaire de
 * devis BTP (lib/statut-juridique-btp.ts) comme au formulaire artisan. mapLegalFormToCode ne les connaît pas et les
 * rendait toutes en 'ei' : une société par quotas s'affichait « Entreprise Individuelle (EI) ». Ordre : Unipessoal
 * avant Lda (« Unipessoal Lda. » contient « Lda »). Aucune forme française ne contient ces mots (la SNC, l'EIRL et la
 * coopérative françaises restent à mapLegalFormToCode : seuls les libellés « (Portugal) » de l'inscription sont pris).
 * Capital social exigé dans les mentions : sociétés par quotas et anonymes (art. 171.º du Código das Sociedades
 * Comerciais) ; pas la société en nom collectif, la commandite simple, la coopérative ni l'entrepreneur individuel.
 */
const FORMES_PORTUGAISES: ReadonlyArray<FormePortugaise> = [
  { motif: /\bunipessoal\b/, code: 'unipessoal', libelle: 'Sociedade Unipessoal por Quotas (Unipessoal Lda.)', capital: true },
  { motif: /\bquotas\b|\blda\b/, code: 'lda', libelle: 'Sociedade por Quotas (Lda.)', capital: true },
  { motif: /\banonima\b|^sa \(portugal\)$/, code: 'sa', libelle: 'Sociedade Anónima (SA)', capital: true },
  { motif: /\bestabelecimento individual\b|^eirl \(portugal\)$/, code: 'eirl_pt', libelle: 'Estabelecimento Individual de Responsabilidade Limitada (EIRL)', capital: false },
  { motif: /\bnome coletivo\b|^snc \(portugal\)$/, code: 'snc_pt', libelle: 'Sociedade em Nome Coletivo', capital: false },
  { motif: /\bcomandita\b/, code: 'comandita', libelle: 'Sociedade em Comandita', capital: false },
  { motif: /\bcooperativa\b|^cooperative \(portugal\)$/, code: 'cooperativa', libelle: 'Cooperativa', capital: false },
  { motif: /\bnome individual\b|\beni\b/, code: 'eni', libelle: 'Empresário em Nome Individual (ENI)', capital: false },
]

/** Sans accents, majuscules ni points, espaces simples (comme mapLegalFormToCode). */
export function normaliserForme(forme: string): string {
  return forme.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

/** Forme portugaise reconnue dans le libellé d'une forme juridique, sinon undefined. */
export function formePortugaise(forme: string | null | undefined): FormePortugaise | undefined {
  const texte = normaliserForme(String(forme || ''))
  return texte ? FORMES_PORTUGAISES.find(({ motif }) => motif.test(texte)) : undefined
}

/**
 * Code interne (ei, sarl, lda, eni…) d'une forme juridique : forme portugaise d'abord, sinon mapLegalFormToCode. Les
 * formes françaises donnent exactement le même code qu'avant.
 */
export function codeFormeJuridique(forme: string | null | undefined): string {
  return formePortugaise(forme)?.code ?? mapLegalFormToCode(String(forme || ''))
}
