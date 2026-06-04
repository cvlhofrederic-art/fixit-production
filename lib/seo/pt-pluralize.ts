// Plurais corretos em português europeu pour les noms de services Vitfix.
//
// Pour les noms de métiers (eletricista, canalizador, picheleiro, etc.),
// retourne le pluriel direct ("eletricistas", "canalizadores", etc.) -
// "profissionais de eletricista" serait du français-à-portugais maladroit.
//
// Pour les spécialités/activités (pladur, obras, isolamento, etc.), retourne
// "profissionais de X" qui est grammaticalement correct car "X" désigne une
// activité ou un matériau, pas un métier.

const PLURAIS: Record<string, string> = {
  // Métiers - plurial direct
  'Eletricista': 'eletricistas',
  'Canalizador': 'canalizadores',
  'Picheleiro': 'picheleiros',
  'Pintor': 'pintores',
  'Serralheiro': 'serralheiros',
  'Vidraceiro': 'vidraceiros',
  'Azulejador e Ladrilhador': 'azulejadores',
  'Pedreiro e Alvenaria': 'pedreiros',
  'Carpinteiro': 'carpinteiros',
  'Telhador': 'telhadores',
  'Jardineiro': 'jardineiros',
  // Spécialités / activités / matériaux - "profissionais de X" OK
  'Pladur e Tetos Falsos': 'profissionais de pladur',
  'Obras e Remodelação': 'profissionais de obras',
  'Isolamento Térmico e Capoto': 'profissionais de isolamento',
  'Impermeabilização': 'profissionais de impermeabilização',
  'Desentupimento': 'profissionais de desentupimento',
  'Faz Tudo': 'profissionais faz-tudo',
  'Telhado e Cobertura': 'profissionais de telhados',
  'Ar Condicionado': 'profissionais de ar condicionado',
  'Limpeza de Espaços': 'profissionais de limpeza',
  'Poda de Árvores': 'profissionais de poda',
  'Limpeza de Condomínio': 'profissionais de limpeza de condomínios',
  'Estores e Portões': 'profissionais de estores e portões',
}

/**
 * Retourne le label "professionnels" naturel pour un nom de service PT.
 * - Métier (Eletricista) → pluriel direct ("eletricistas")
 * - Spécialité (Pladur) → "profissionais de pladur"
 * - Inconnu → fallback "profissionais de {nome.toLowerCase()}"
 */
export function pluralizarServico(nome: string): string {
  return PLURAIS[nome] || 'profissionais de ' + nome.toLowerCase()
}

/**
 * Retourne true si le service est un nom de métier (singulier de personne),
 * pour adapter les phrases comme "Encontre um {servico}" vs
 * "Encontre profissionais de {servico}".
 */
export function isJobName(nome: string): boolean {
  return [
    'Eletricista', 'Canalizador', 'Picheleiro', 'Pintor', 'Serralheiro',
    'Vidraceiro', 'Azulejador e Ladrilhador', 'Pedreiro e Alvenaria',
    'Carpinteiro', 'Telhador', 'Jardineiro',
  ].includes(nome)
}
