// ─── Secteurs proposés à l'inscription d'une société BTP (/pro/register) ──────
// Chaque secteur porte le slug de la spécialité correspondante (table
// `specialties`, supabase/migrations/035_specialties.sql), enregistrée dans
// `profile_specialties` à l'inscription. `slug: null` = hors spécialités
// bâtiment (aucune ligne écrite).

export interface SecteurBtp {
  label: string
  cae: string
  slug: string | null
}

export const SECTEURS_BTP_PT: SecteurBtp[] = [
  { label: 'Alvenaria', cae: 'Atividades de alvenaria e assentamento de tijolos (CAE 43910)', slug: 'gros-oeuvre' },
  { label: 'Eletricidade', cae: 'Instalação elétrica (CAE 43210)', slug: 'electricite' },
  { label: 'Canalização', cae: 'Instalação de canalizações (CAE 43221)', slug: 'plomberie' },
  { label: 'Pintura', cae: 'Pintura e colocação de vidros (CAE 43340)', slug: 'peinture' },
  { label: 'Revestimentos', cae: 'Revestimento de pavimentos e de paredes (CAE 43330)', slug: 'carrelage' },
  { label: 'Carpintaria', cae: 'Montagem de trabalhos de carpintaria e de caixilharia (CAE 43320)', slug: 'menuiserie-bois' },
  { label: 'Estruturas de madeira', cae: 'Fabricação de outros produtos de carpintaria para a construção (CAE 16230)', slug: 'charpente' },
  { label: 'Climatização / AVAC', cae: 'Instalação de climatização (CAE 43222)', slug: 'chauffage' },
  { label: 'Telhados / Cobertura', cae: 'Atividades de colocação de telhados e coberturas (CAE 43410)', slug: 'couverture' },
  { label: 'Serralharia / Ferragem', cae: 'Fabricação de estruturas e partes de estruturas metálicas (CAE 25110)', slug: 'ferronnerie' },
  { label: 'Impermeabilização', cae: 'Outras atividades especializadas de construção diversas, n. e. (CAE 43992)', slug: 'etancheite' },
  { label: 'Isolamento térmico', cae: 'Instalação de isolamento (CAE 43230)', slug: 'isolation' },
  { label: 'Pavimentos', cae: 'Revestimento de pavimentos e de paredes (CAE 43330)', slug: 'carrelage' },
  { label: 'Caixilharia / Janelas', cae: 'Montagem de trabalhos de carpintaria e de caixilharia (CAE 43320)', slug: 'menuiserie-alu-pvc' },
  { label: 'Portas / Portões', cae: 'Fabricação de portas e janelas metálicas (CAE 25120)', slug: 'menuiserie-alu-pvc' },
  { label: 'Estores / Cortinas', cae: 'Comércio a retalho de carpetes, tapetes, cortinados (CAE 47530)', slug: 'menuiserie-alu-pvc' },
  { label: 'Vidraceiro', cae: 'Pintura e colocação de vidros (CAE 43340)', slug: 'menuiserie-alu-pvc' },
  { label: 'Canalizador de gás', cae: 'Instalação de canalizações (CAE 43221)', slug: 'plomberie' },
  { label: 'Eletrodomésticos', cae: 'Reparação e manutenção de equipamento elétrico (CAE 33140)', slug: null },
  { label: 'Limpeza', cae: 'Limpeza geral de edifícios (CAE 81210)', slug: 'nettoyage' },
  { label: 'Jardinagem', cae: 'Atividades dos serviços de plantação e manutenção de jardins (CAE 81300)', slug: 'paysagisme' },
  { label: 'Mudanças', cae: 'Serviços de mudanças (CAE 49420)', slug: 'demenagement' },
  { label: 'Desentupimentos', cae: 'Outras atividades especializadas de construção diversas, n. e. (CAE 43992)', slug: 'debouchage' },
  { label: 'Fachadas', cae: 'Outras atividades de acabamento em edifícios (CAE 43350)', slug: 'facadier' },
  { label: 'Terraços / Varandas', cae: 'Construção de edifícios (CAE 41200)', slug: 'gros-oeuvre' },
  { label: 'Piscinas', cae: 'Outras atividades especializadas de construção diversas, n. e. (CAE 43992)', slug: 'piscine' },
  { label: 'Controlo de pragas', cae: 'Atividades de desinfeção, desratização e similares (CAE 81231)', slug: null },
  { label: 'Bricolagem', cae: 'Outras atividades especializadas de construção diversas, n. e. (CAE 43992)', slug: null },
  { label: 'Construção de edifícios', cae: 'Construção de edifícios residenciais e não residenciais (CAE 41200)', slug: 'renovation-generale' },
  { label: 'Renovação geral', cae: 'Construção de edifícios (CAE 41200)', slug: 'renovation-generale' },
  { label: 'Outro setor', cae: '', slug: null },
]

export const SECTEURS_BTP_FR: SecteurBtp[] = [
  { label: 'Maçonnerie', cae: 'Travaux de maçonnerie générale (NAF 43.99A)', slug: 'gros-oeuvre' },
  { label: 'Électricité', cae: 'Travaux d\'installation électrique (NAF 43.21A)', slug: 'electricite' },
  { label: 'Plomberie', cae: 'Travaux de plomberie et installation de chauffage (NAF 43.22A)', slug: 'plomberie' },
  { label: 'Peinture', cae: 'Travaux de peinture et vitrerie (NAF 43.34Z)', slug: 'peinture' },
  { label: 'Revêtements muraux', cae: 'Travaux de revêtement des sols et des murs (NAF 43.33Z)', slug: 'carrelage' },
  { label: 'Menuiserie', cae: 'Travaux de menuiserie bois et PVC (NAF 43.32A)', slug: 'menuiserie-bois' },
  { label: 'Charpente', cae: 'Travaux de charpente (NAF 43.91A)', slug: 'charpente' },
  { label: 'Climatisation / CVC', cae: 'Travaux d\'installation d\'équipements thermiques (NAF 43.22B)', slug: 'chauffage' },
  { label: 'Toiture / Couverture', cae: 'Travaux de couverture par éléments (NAF 43.91B)', slug: 'couverture' },
  { label: 'Métallerie / Ferronnerie', cae: 'Fabrication de structures métalliques (NAF 25.11Z)', slug: 'ferronnerie' },
  { label: 'Étanchéité', cae: 'Travaux d\'étanchéification (NAF 43.99B)', slug: 'etancheite' },
  { label: 'Isolation thermique', cae: 'Travaux d\'isolation (NAF 43.29A)', slug: 'isolation' },
  { label: 'Revêtements de sols', cae: 'Travaux de revêtement des sols et des murs (NAF 43.33Z)', slug: 'carrelage' },
  { label: 'Menuiseries / Fenêtres', cae: 'Travaux de menuiserie métallique et serrurerie (NAF 43.32B)', slug: 'menuiserie-alu-pvc' },
  { label: 'Portes / Portails', cae: 'Fabrication de portes et fenêtres en métal (NAF 25.12Z)', slug: 'menuiserie-alu-pvc' },
  { label: 'Stores / Rideaux', cae: 'Commerce de détail de tapis et revêtements (NAF 47.53Z)', slug: 'menuiserie-alu-pvc' },
  { label: 'Vitrerie', cae: 'Travaux de peinture et vitrerie (NAF 43.34Z)', slug: 'menuiserie-alu-pvc' },
  { label: 'Plombier gaz', cae: 'Travaux de plomberie (NAF 43.22A)', slug: 'plomberie' },
  { label: 'Électroménager', cae: 'Réparation d\'équipements électriques (NAF 33.14Z)', slug: null },
  { label: 'Nettoyage', cae: 'Nettoyage courant des bâtiments (NAF 81.21Z)', slug: 'nettoyage' },
  { label: 'Jardinage', cae: 'Services d\'aménagement paysager (NAF 81.30Z)', slug: 'paysagisme' },
  { label: 'Déménagement', cae: 'Services de déménagement (NAF 49.42Z)', slug: 'demenagement' },
  { label: 'Débouchage', cae: 'Autres travaux spécialisés de construction (NAF 43.99C)', slug: 'debouchage' },
  { label: 'Façades', cae: 'Autres travaux de finition (NAF 43.31Z)', slug: 'facadier' },
  { label: 'Terrasses / Balcons', cae: 'Construction de bâtiments résidentiels et non résidentiels (NAF 41.20B)', slug: 'gros-oeuvre' },
  { label: 'Piscines', cae: 'Autres travaux spécialisés de construction (NAF 43.99D)', slug: 'piscine' },
  { label: 'Dératisation', cae: 'Désinfection, désinsectisation, dératisation (NAF 81.29A)', slug: null },
  { label: 'Bricolage', cae: 'Autres travaux spécialisés de construction (NAF 43.99Z)', slug: null },
  { label: 'Rénovation générale', cae: 'Construction de bâtiments résidentiels et non résidentiels (NAF 41.20A)', slug: 'renovation-generale' },
  { label: 'Autre secteur', cae: '', slug: null },
]

const SLUG_PAR_SECTEUR = new Map<string, string | null>(
  [...SECTEURS_BTP_FR, ...SECTEURS_BTP_PT].map(s => [s.label, s.slug]),
)

/** Libellés cochés → slugs de spécialités, sans doublon ; les secteurs sans spécialité sont ignorés. */
export function secteursToSlugs(secteurs: string[]): string[] {
  const slugs = secteurs
    .map(s => SLUG_PAR_SECTEUR.get(s) ?? null)
    .filter((s): s is string => s !== null)
  return [...new Set(slugs)]
}
