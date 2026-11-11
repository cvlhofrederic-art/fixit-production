// Maps each PT service slug to a hero illustration category.
// SVG files live in public/services/ and are 1200×630 (OG-compatible).
// Used by app/pt/servicos/[slug]/page.tsx for both visible <Image>
// and JSON-LD / OG metadata.

export type ServiceCategory =
  | 'plumbing'
  | 'electrical'
  | 'painting'
  | 'masonry'
  | 'carpentry'
  | 'roofing'
  | 'garden'
  | 'general'

const SERVICE_CATEGORY_MAP: Record<string, ServiceCategory> = {
  eletricista: 'electrical',
  'ar-condicionado': 'electrical',
  canalizador: 'plumbing',
  desentupimento: 'plumbing',
  pintor: 'painting',
  pladur: 'carpentry',
  carpinteiro: 'carpentry',
  'obras-remodelacao': 'masonry',
  pedreiro: 'masonry',
  azulejador: 'masonry',
  telhador: 'roofing',
  'isolamento-termico': 'roofing',
  impermeabilizacao: 'roofing',
  jardineiro: 'garden',
  'poda-arvores': 'garden',
  'limpeza-espacos': 'garden',
  'limpeza-condominio': 'garden',
  'faz-tudo': 'general',
  serralheiro: 'general',
  vidraceiro: 'general',
  'estores-portoes': 'general',
}

export function getServiceCategory(serviceSlug: string): ServiceCategory {
  return SERVICE_CATEGORY_MAP[serviceSlug] ?? 'general'
}

export function getServiceHeroImagePath(serviceSlug: string): string {
  return `/services/${getServiceCategory(serviceSlug)}.svg`
}

export function getServiceHeroImageUrl(serviceSlug: string, baseUrl = 'https://vitfix.io'): string {
  return `${baseUrl}${getServiceHeroImagePath(serviceSlug)}`
}
