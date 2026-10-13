// Grille PT (21 métiers x 22 concelhos) sous forme de listes de slugs légères, importables par le
// middleware (lib/seo/pt-consolidacao.ts, phase 2 du plan SEO PT) sans charger
// lib/data/seo-pages-data.ts dans le bundle edge. tests/seo/pt-phase-2-consolidation.test.ts
// vérifie qu'elles restent égales aux données.

export const METIERS_PT_SLUGS = [
  'ar-condicionado', 'azulejador', 'canalizador', 'carpinteiro', 'desentupimento', 'eletricista',
  'estores-portoes', 'faz-tudo', 'impermeabilizacao', 'isolamento-termico', 'jardineiro',
  'limpeza-condominio', 'limpeza-espacos', 'obras-remodelacao', 'pedreiro', 'pintor', 'pladur',
  'poda-arvores', 'serralheiro', 'telhador', 'vidraceiro',
] as const

export const CIDADES_PT_SLUGS = [
  'agueda', 'amarante', 'aveiro', 'baiao', 'braga', 'felgueiras', 'gondomar', 'lousada', 'maia',
  'marco-de-canaveses', 'matosinhos', 'ovar', 'pacos-de-ferreira', 'paredes', 'penafiel', 'porto',
  'povoa-de-varzim', 'santo-tirso', 'trofa', 'valongo', 'vila-do-conde', 'vila-nova-de-gaia',
] as const
