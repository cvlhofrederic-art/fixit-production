import type { Recipe } from '../../types'

/**
 * CHARPENTE BOIS — audit #06
 *
 * Référentiels FR :
 * - NF DTU 31.1  Charpentes et escaliers en bois (rev. 2017)
 * - NF DTU 31.2  MOB — Maison à ossature bois (rev. 2019 + A1 2021)
 * - NF DTU 31.3  Charpentes industrielles (fermettes)
 * - NF DTU 31.4  Façades à ossature bois
 * - NF EN 1995   Eurocode 5 — conception structures bois
 * - NF EN 14081  Classement résistance bois
 *
 * Référentiels PT : NP EN 1995 + NP EN 14081
 */

export const charpenteRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #6.1 CHARPENTE TRADITIONNELLE
  // ══════════════════════════════════════════════════════════
  {
    id: 'charpente-traditionnelle',
    name: 'Charpente traditionnelle bois (2 pans)',
    description: 'Pannes sablières + faîtière + intermédiaires + chevrons + arbalétriers. Bois classe 2 traité autoclave.',
    trade: 'charpente',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 31.1', title: 'Charpentes et escaliers en bois (rev. 2017)' },
      { code: 'Eurocode 5', title: 'NF EN 1995-1-1' },
      { code: 'NF EN 14081', title: 'Classement résistance bois C18-C24' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Surface = rampant (pas emprise au sol)',
      'Pannes sablières 75×200 sur murs + pannes intermédiaires 100×200',
      'Chevrons 63×75 entraxe 50-60 cm (1,8 ml/m² rampant)',
      'Essence résineux C18-C24 traité classe 2 autoclave (NF EN 14081)',
      'Ferrures Simpson Strong-Tie pour assemblages',
      'Traitement usine généralement inclus — vérifier avant commande',
    ],
    materials: [
      {
        id: 'panne-sabliere', name: 'Pannes sablières 75×200 (en appui sur murs)',
        category: 'bois', phase: 'principal', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 31.1', normRef: 'NF EN 14081',
        notes: '2 sablières par pan × longueur bâtiment / surface rampant ≈ 0,2 ml/m².',
      },
      {
        id: 'panne-intermediaire', name: 'Pannes faîtière + intermédiaires 100×200',
        category: 'bois', phase: 'principal', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 31.1',
        notes: '3 pannes longitudinales (1 faîtière + 2 intermédiaires).',
      },
      {
        id: 'chevron-63-75', name: 'Chevrons 63×75 (entraxe 50-60 cm)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + chutes',
        dtu: 'NF DTU 31.1',
        normRef: 'NF EN 14081 classe C18 ou C24',
      },
      {
        id: 'arbaletrier', name: 'Arbalétriers (si fermes)',
        category: 'bois', phase: 'principal', quantityPerBase: 0.3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        optional: true,
        condition: 'Si système à fermes (non pour fermettes ni pannes simples)',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'sabot-etrier-simpson', name: 'Sabots + étriers Simpson Strong-Tie',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
        manufacturerRef: 'Simpson Strong-Tie',
        notes: '2 sabots par chevron (jonctions + extrémités).',
      },
      {
        id: 'boulon-traversant-12', name: 'Boulons traversants Ø12 (jonctions pannes/murs)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'vis-tirefond-8-140', name: 'Vis tirefond 8×140 (fixations)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'equerre-simpson', name: 'Équerres Simpson (contreventement)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte',
        manufacturerRef: 'Simpson Strong-Tie',
      },
      {
        id: 'clou-charpente-180', name: 'Clous charpente 6×180 (assemblages cloués)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      // ═══ FINITIONS ═══
      {
        id: 'traitement-fongicide-insecticide', name: 'Traitement fongicide/insecticide (classe 2)',
        category: 'adjuvant', phase: 'finitions', quantityPerBase: 0.5, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Sur-dosage application',
        manufacturerRef: 'Xyladecor / Remmers',
        optional: true,
        condition: 'Si bois non pré-traité usine — à vérifier avant commande',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #6.2 CHARPENTE INDUSTRIELLE (FERMETTES)
  // ══════════════════════════════════════════════════════════
  {
    id: 'charpente-fermettes',
    name: 'Charpente industrielle à fermettes',
    description: 'Fermettes préfabriquées usine (connecteurs métalliques). Pose rapide sur mur pignon.',
    trade: 'charpente',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 31.3', title: 'Charpentes industrielles (fermettes)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Fermettes préfa entraxe 60 cm → 1 fermette tous 1,67 m² rampant',
      'Livrées montées, gain de temps chantier significatif',
      'Liteaux de contreventement (diagonales de stabilité) obligatoires',
      'Entretoises entre fermettes pour rigidité',
    ],
    materials: [
      {
        id: 'fermette-prefa', name: 'Fermette préfabriquée (assemblée usine)',
        category: 'bois', phase: 'principal', quantityPerBase: 0.6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Rebuts livraison',
        dtu: 'NF DTU 31.3',
        manufacturerRef: 'Alpha / Charpentes Françaises',
        notes: '1,67 m²/fermette → 0,6 fermette/m².',
      },
      {
        id: 'liteau-contreventement', name: 'Liteaux contreventement (diagonales)',
        category: 'bois', phase: 'principal', quantityPerBase: 0.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 31.3',
      },
      {
        id: 'entretoise-fermette', name: 'Entretoises entre fermettes',
        category: 'bois', phase: 'principal', quantityPerBase: 0.6, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'sabot-sabliere-fermette', name: 'Sabots sablière/fermette',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
        manufacturerRef: 'Simpson Strong-Tie',
      },
      {
        id: 'vis-fermette', name: 'Vis + clous fixation',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #6.3 MOB — MAISON OSSATURE BOIS (murs)
  // ══════════════════════════════════════════════════════════
  {
    id: 'mob-murs',
    name: 'Murs à ossature bois (MOB)',
    description: 'Panneau complet MOB : lisses + montants + voile OSB contreventement + pare-pluie + isolation laine 145 mm.',
    trade: 'charpente',
    baseUnit: 'm2',
    geometryMode: 'area_minus_openings',
    dtuReferences: [
      { code: 'NF DTU 31.2', title: 'Construction MOB (rev. 2019 + A1 2021)' },
      { code: 'NF EN 1995', title: 'Eurocode 5' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Montants 45×145 entraxe 60 cm → 1,8 ml/m² (déduction ouvertures)',
      'Lisse basse classe 4 (contact béton/humidité) + lisse haute classe 2',
      'Voile OSB 3 18 mm côté intérieur (contreventement) OU diagonales',
      'Pare-pluie HPV côté extérieur (étanchéité air + perméabilité vapeur)',
      'Isolation laine minérale 145 mm entre montants (R ≈ 4)',
      'Fixation sur dalle béton : chevilles chimiques M10',
      'Bande d\'arase EPDM entre dalle et lisse basse',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'bande-arase-epdm', name: 'Bande d\'arase EPDM (sous lisse basse)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 0.6, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 31.2',
      },
      {
        id: 'lisse-basse-mob', name: 'Lisse basse 45×145 classe 4',
        category: 'bois', phase: 'preparation', quantityPerBase: 0.6, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 31.2',
        notes: 'Classe 4 obligatoire (contact dalle béton).',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'montant-mob-45-145', name: 'Montants 45×145 (entraxe 60 cm)',
        category: 'bois', phase: 'principal', quantityPerBase: 1.8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + bords',
        dtu: 'NF DTU 31.2',
        normRef: 'NF EN 14081',
      },
      {
        id: 'lisse-haute-mob', name: 'Lisse haute 45×145',
        category: 'bois', phase: 'principal', quantityPerBase: 0.6, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'voile-osb-3-18', name: 'Voile OSB 3 18 mm (contreventement)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 31.2 §5.3',
      },
      {
        id: 'pare-pluie-hpv', name: 'Pare-pluie HPV (étanchéité air)',
        category: 'etancheite', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        manufacturerRef: 'Delta Maxx / Siga Majpell',
      },
      {
        id: 'laine-145-mob', name: 'Laine minérale 145 mm (isolation entre montants)',
        category: 'isolant', phase: 'principal', quantityPerBase: 0.9, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.07, wasteReason: 'Découpes',
        manufacturerRef: 'Isover / Knauf',
        notes: 'Déduction 10% pour surface montants.',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'vis-tirefond-6-140', name: 'Vis tirefond 6×140 (lisse/montant)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'clou-spi-63', name: 'Clous spiralés 2,8×63 (fixation OSB)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 20, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'equerre-lisse-basse', name: 'Équerres fixation lisse basse',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Perte',
        manufacturerRef: 'Simpson Strong-Tie',
      },
      {
        id: 'cheville-chimique-m10', name: 'Cheville chimique M10 (ancrage dalle)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
        notes: '1 cheville tous 1 ml de lisse basse.',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #6.4 LAMELLÉ-COLLÉ (poutres structurelles)
  // ══════════════════════════════════════════════════════════
  {
    id: 'poutre-lamelle-colle',
    name: 'Poutre lamellé-collé GL24h (section 200×600)',
    description: 'Poutre structurelle grande portée (6 m+). Section sur mesure selon descente de charges.',
    trade: 'charpente',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 31.1', title: 'Charpentes bois', section: '§4.2 lamellé-collé' },
      { code: 'NF EN 14080', title: 'Lamellé-collé' },
      { code: 'Eurocode 5', title: 'NF EN 1995-1-1' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Section type 200×600 mm (portée 6-10 m habitation)',
      'Classe résistance GL24h ou GL28h selon contrainte',
      'Sur mesure — fabricant livre poutre coupée à longueur',
      'Appuis béton à coffrer à part (trade maçonnerie)',
      'Sabots Simpson large section (WM / HWS) pour assemblages',
    ],
    materials: [
      {
        id: 'poutre-lc-gl24', name: 'Poutre lamellé-collé GL24h 200×600',
        category: 'bois', phase: 'principal', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.02, wasteReason: 'Sur mesure',
        dtu: 'NF DTU 31.1 §4.2', normRef: 'NF EN 14080',
        manufacturerRef: 'Schilliger / Weinmann / Hasslacher',
      },
      {
        id: 'sabot-simpson-wm', name: 'Sabots Simpson WM/HWS large section',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Simpson Strong-Tie WM / HWS',
        notes: '2 sabots par poutre (extrémités).',
      },
      {
        id: 'boulon-traversant-m16', name: 'Boulons traversants M16 (fixation sabots)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'cheville-chimique-m16', name: 'Chevilles chimiques M16 (ancrage béton)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Casse',
      },
    ],
  },
]
