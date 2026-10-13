// Métiers réellement liés (phase 4 du plan SEO PT : chaque page métier x ville lie 2 à 4 métiers
// proches, pas les 20 autres). Table établie le 14/10/2026 à partir des interventions qui
// s'enchaînent sur un même chantier (toiture et étanchéité, pladur et peinture, etc.).

export const METIERS_LIGADOS: Record<string, string[]> = {
  eletricista: ['ar-condicionado', 'estores-portoes', 'faz-tudo'],
  canalizador: ['desentupimento', 'impermeabilizacao', 'azulejador'],
  pintor: ['pladur', 'isolamento-termico', 'faz-tudo'],
  pladur: ['pintor', 'eletricista', 'isolamento-termico'],
  'obras-remodelacao': ['pedreiro', 'pintor', 'azulejador', 'carpinteiro'],
  'isolamento-termico': ['impermeabilizacao', 'pintor', 'telhador'],
  impermeabilizacao: ['telhador', 'isolamento-termico', 'canalizador'],
  desentupimento: ['canalizador', 'limpeza-espacos'],
  'faz-tudo': ['eletricista', 'canalizador', 'carpinteiro', 'pintor'],
  serralheiro: ['estores-portoes', 'carpinteiro', 'vidraceiro'],
  telhador: ['impermeabilizacao', 'isolamento-termico', 'pedreiro'],
  vidraceiro: ['serralheiro', 'carpinteiro', 'estores-portoes'],
  azulejador: ['pedreiro', 'canalizador', 'pintor'],
  pedreiro: ['obras-remodelacao', 'azulejador', 'impermeabilizacao'],
  'ar-condicionado': ['eletricista', 'isolamento-termico'],
  carpinteiro: ['faz-tudo', 'serralheiro', 'vidraceiro'],
  jardineiro: ['poda-arvores', 'limpeza-espacos'],
  'limpeza-espacos': ['limpeza-condominio', 'jardineiro', 'obras-remodelacao'],
  'poda-arvores': ['jardineiro', 'limpeza-espacos'],
  'limpeza-condominio': ['limpeza-espacos', 'jardineiro', 'faz-tudo'],
  'estores-portoes': ['serralheiro', 'eletricista', 'carpinteiro'],
}
