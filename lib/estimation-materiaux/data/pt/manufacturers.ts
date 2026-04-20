/**
 * Fabricantes PORTUGUESES de referência pelo sector BTP.
 *
 * Lista curada 2026 — empresas com presença estabelecida em Portugal,
 * linhas de produto disponíveis em distribuição corrente (Leroy Merlin PT,
 * Decathlon PT, Maxmat, Aki, BricoMarché, lojas de especialidade).
 *
 * Usage : importer dans les recettes PT comme `manufacturerRef` pour
 * tracabilité commerciale et aide à l'approvisionnement local.
 */

export interface PTManufacturer {
  name: string
  /** Sector principal d'activité */
  sector: string
  /** Exemples de produits phares */
  products?: string[]
  /** Site officiel si pertinent */
  website?: string
}

export const PT_MANUFACTURERS = {
  // ═══ CIMENTOS & BETÃO ═══
  secil: {
    name: 'Secil',
    sector: 'Cimentos, betão pronto, agregados',
    products: ['Secil CEM II/B-L 32,5 N', 'Secil CEM I 42,5 R', 'Secil Pronto (argamassas)'],
    website: 'secil.pt',
  } satisfies PTManufacturer,
  cimpor: {
    name: 'Cimpor',
    sector: 'Cimentos, betão',
    products: ['Cimpor CEM II/B-L 32,5 N', 'Cimpor CEM II/A-L 42,5 R'],
    website: 'cimpor.com',
  } satisfies PTManufacturer,
  betao_liz: {
    name: 'Betão Liz',
    sector: 'Betão pronto (subsidiária Secil)',
    products: ['Betão C25/30', 'Betão C30/37 hidrofugado'],
  } satisfies PTManufacturer,

  // ═══ ALVENARIA ═══
  preceram: {
    name: 'Preceram',
    sector: 'Cerâmica estrutural — tijolo térmico e blocos',
    products: ['Tijolo 30 térmico', 'Bloco 11 cm', 'Bloco de betão 20 cm'],
    website: 'preceram.pt',
  } satisfies PTManufacturer,
  torreense: {
    name: 'Cerâmica Torreense',
    sector: 'Tijolo cerâmico tradicional',
    products: ['Tijolo 11 furos', 'Tijolo 15 térmico'],
  } satisfies PTManufacturer,
  presdouro: {
    name: 'Presdouro',
    sector: 'Blocos de betão pré-fabricados',
    products: ['Bloco 20×20×40', 'Bloco perfurado 15×20×40'],
  } satisfies PTManufacturer,

  // ═══ ARGAMASSAS & REBOCOS ═══
  weber_pt: {
    name: 'Weber Saint-Gobain PT',
    sector: 'Argamassas, rebocos, colas',
    products: ['weber.dur color (reboco fino)', 'weber.col flex (cola flexível)', 'weber.tec plano'],
    website: 'pt.weber',
  } satisfies PTManufacturer,
  sika_pt: {
    name: 'Sika Portugal',
    sector: 'Argamassas técnicas, impermeabilizações, aditivos',
    products: ['SikaTop Seal 107', 'Sika 1 (impermeabilizante)', 'SikaGrout'],
    website: 'prt.sika.com',
  } satisfies PTManufacturer,
  mapei_pt: {
    name: 'Mapei Portugal',
    sector: 'Colas cerâmica, impermeabilizações',
    products: ['Keraflex', 'Mapeband', 'Mapelastic'],
    website: 'mapei.com/pt',
  } satisfies PTManufacturer,

  // ═══ ISOLAMENTO ═══
  volcalis: {
    name: 'Volcalis',
    sector: 'Lã mineral',
    products: ['Lã de rocha MW 40 mm', 'Lã de vidro MW 45 mm'],
    website: 'volcalis.pt',
  } satisfies PTManufacturer,
  fibran_pt: {
    name: 'Fibran PT',
    sector: 'XPS extrudido',
    products: ['XPS 300 ETICS', 'XPS 300 sob betonilha'],
  } satisfies PTManufacturer,
  imperalum: {
    name: 'Imperalum',
    sector: 'Impermeabilização, telas betuminosas',
    products: ['Polyflex SBS 4 kg', 'Polyflex APP 4 kg'],
    website: 'imperalum.com',
  } satisfies PTManufacturer,

  // ═══ COBERTURA ═══
  cs_coelho: {
    name: 'Cerâmica Serradela / CS Coelho',
    sector: 'Telhas cerâmicas',
    products: ['Telha Lusa', 'Telha Canudo Romana'],
  } satisfies PTManufacturer,
  umbelino: {
    name: 'Umbelino Monteiro',
    sector: 'Telhas cerâmicas, acessórios',
    products: ['Telha Lusa Viúva', 'Rincões e cumes'],
    website: 'umbelinomonteiro.pt',
  } satisfies PTManufacturer,

  // ═══ CANALIZAÇÃO ═══
  ferpinta: {
    name: 'Ferpinta',
    sector: 'Tubos e acessórios ferro, aço',
    products: ['Tubos galvanizados', 'Acessórios roscados'],
    website: 'ferpinta.pt',
  } satisfies PTManufacturer,
  uponor_pt: {
    name: 'Uponor Portugal',
    sector: 'Sistemas PEX piso radiante, multicamadas',
    products: ['Tubo PE-Xa 16×2', 'Comfort Port manifold'],
  } satisfies PTManufacturer,
  fersil: {
    name: 'Fersil',
    sector: 'Tubagens PVC evacuação, abastecimento',
    products: ['PVC-U Ø110 mm', 'PVC-U Ø40 mm sifões'],
    website: 'fersil.pt',
  } satisfies PTManufacturer,
  sanindusa: {
    name: 'Sanindusa',
    sector: 'Louças sanitárias',
    products: ['Sanitas suspensas', 'Lavatórios cerâmicos'],
    website: 'sanindusa.pt',
  } satisfies PTManufacturer,

  // ═══ ELETRICIDADE ═══
  efapel: {
    name: 'Efapel',
    sector: 'Aparelhagem eléctrica, domótica',
    products: ['Série Logus 90', 'Série Apolo 5000', 'Disjuntores modulares'],
    website: 'efapel.pt',
  } satisfies PTManufacturer,
  quintela: {
    name: 'Quintela & Penalva',
    sector: 'Cabos eléctricos',
    products: ['XV 3G2.5', 'H07V-U 1×2.5'],
  } satisfies PTManufacturer,
  schneider_pt: {
    name: 'Schneider Electric Portugal',
    sector: 'Quadros eléctricos, proteções',
    products: ['Resi9 quadros', 'iC60N disjuntores'],
  } satisfies PTManufacturer,

  // ═══ TINTAS / PINTURA ═══
  robbialac: {
    name: 'Robbialac',
    sector: 'Tintas, revestimentos',
    products: ['Robbialac Solar (interior)', 'Permatex (exterior)', 'Impermalac'],
    website: 'robbialac.pt',
  } satisfies PTManufacturer,
  cin: {
    name: 'CIN',
    sector: 'Tintas, vernizes',
    products: ['CIN Novatrato', 'CIN Vinylsoft', 'CINOLITE'],
    website: 'cin.pt',
  } satisfies PTManufacturer,
  barbot: {
    name: 'Tintas Barbot',
    sector: 'Tintas decorativas e técnicas',
    products: ['Decolite', 'Viva', 'Protex'],
    website: 'barbot.pt',
  } satisfies PTManufacturer,

  // ═══ CAIXILHARIA ═══
  navarra: {
    name: 'Navarra Aluminium',
    sector: 'Perfis alumínio caixilharia',
    products: ['Serie C35', 'Serie C50 corte térmico'],
  } satisfies PTManufacturer,
  extrusal: {
    name: 'Extrusal',
    sector: 'Perfis alumínio',
    products: ['Serie 2200', 'Serie Esquadria sem corte térmico'],
    website: 'extrusal.pt',
  } satisfies PTManufacturer,

  // ═══ CLIMATIZAÇÃO ═══
  baxi_pt: {
    name: 'Baxi Portugal',
    sector: 'Caldeiras, bombas de calor',
    products: ['Platinum Compact', 'Platinum BC hibrido'],
  } satisfies PTManufacturer,
  vaillant_pt: {
    name: 'Vaillant Portugal',
    sector: 'Caldeiras, bombas de calor, solar',
    products: ['ecoTEC plus', 'aroTHERM plus'],
  } satisfies PTManufacturer,

  // ═══ PISCINAS ═══
  fluidra_pt: {
    name: 'Fluidra / AstralPool PT',
    sector: 'Piscinas, tratamento de água',
    products: ['Bombas filtração', 'Clorador salino'],
  } satisfies PTManufacturer,

  // ═══ CERÂMICOS / REVESTIMENTOS ═══
  aleluia: {
    name: 'Aleluia Cerâmicas',
    sector: 'Cerâmicos pavimentos e revestimentos',
    products: ['Porcelânico técnico', 'Azulejos 20×20'],
    website: 'aleluia.pt',
  } satisfies PTManufacturer,
  love_tiles: {
    name: 'Love Tiles',
    sector: 'Cerâmicos alta gama',
    products: ['Porcelânico grande formato 60×120', 'Azulejos parede'],
  } satisfies PTManufacturer,
  margres: {
    name: 'Margres',
    sector: 'Porcelânico técnico',
    products: ['Porcelânico 60×60 anti-derrapante', 'Exterior R11'],
  } satisfies PTManufacturer,

  // ═══ MADEIRAS / CARPINTARIA ═══
  sonae_arauco: {
    name: 'Sonae Arauco',
    sector: 'Painéis MDF, OSB, aglomerado',
    products: ['OSB 3 18 mm', 'MDF hidrófugo 19 mm'],
  } satisfies PTManufacturer,
  jomazé: {
    name: 'Jomazé',
    sector: 'Portas interiores, carpintaria',
    products: ['Portas maciças', 'Portas HPL'],
  } satisfies PTManufacturer,
} as const

export type PTManufacturerKey = keyof typeof PT_MANUFACTURERS

/**
 * Helper : retourne le string `manufacturerRef` formaté pour une recette.
 * Ex: ptMfr('secil') → "Secil (Cimentos, betão pronto, agregados)"
 */
export function ptMfr(key: PTManufacturerKey): string {
  const m = PT_MANUFACTURERS[key]
  return `${m.name} (${m.sector})`
}
