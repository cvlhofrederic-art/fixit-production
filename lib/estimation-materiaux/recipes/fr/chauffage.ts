import type { Recipe } from '../../types'

/**
 * CHAUFFAGE — audit #18
 *
 * Référentiels FR :
 * - NF DTU 65.3   Chauffage central
 * - NF DTU 65.4   Chaudières
 * - NF DTU 65.7   Radiateurs
 * - NF DTU 65.10  Canalisations chauffage
 * - NF DTU 65.11  Dispositifs sécurité installations chauffage
 * - NF DTU 65.14  Plancher chauffant hydraulique (PCBT)
 * - NF DTU 65.16  Pompes à chaleur
 * - NF DTU 24.1   Conduits de fumée
 * - RE2020        Chauffage bas-carbone favorisé
 */

export const chauffageRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #18.1 RADIATEUR EAU CHAUDE (par radiateur)
  // ══════════════════════════════════════════════════════════
  {
    id: 'radiateur-eau-chaude',
    name: 'Radiateur eau chaude (acier panneau + robinet thermostatique)',
    description: 'Radiateur acier panneau avec robinet thermostatique obligatoire (RE2020). Tés, purgeur, supports inclus.',
    trade: 'chauffage',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 65.7', title: 'Radiateurs' },
      { code: 'NF DTU 65.10', title: 'Canalisations chauffage' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Radiateur acier panneau simple ou double selon puissance',
      'Robinet thermostatique OBLIGATOIRE (RT2012 + RE2020)',
      'Purgeur automatique conseillé (manuel accepté)',
      'Té de réglage sur le retour',
      'Supports muraux + chevilles (fixation béton / BA13 renforcé)',
      'Joints filasse + pâte à joint ou PTFE pour étanchéité raccords',
    ],
    materials: [
      {
        id: 'radiateur-acier-panneau', name: 'Radiateur acier panneau (Acova / Zehnder / Finimetal)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 65.7',
      },
      {
        id: 'robinet-thermostatique', name: 'Robinet thermostatique (RE2020 obligatoire)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'te-reglage-radiateur', name: 'Té de réglage (retour)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'purgeur-auto-radiateur', name: 'Purgeur automatique',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'support-mural-radiateur', name: 'Supports muraux + chevilles',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'teflon-joint-radiateur', name: 'Téflon + pâte à joint',
        category: 'joint', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Kit consommable',
      },
      {
        id: 'raccord-multicouche-radiateur', name: 'Raccords multicouche EF/ECS (2 u aller/retour)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Rebuts',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #18.2 PLANCHER CHAUFFANT HYDRAULIQUE (PCBT)
  // ══════════════════════════════════════════════════════════
  {
    id: 'plancher-chauffant-hydraulique',
    name: 'Plancher chauffant basse température (PCBT) hydraulique',
    description: 'Tubes PER Ø16 en boucles (pas 15 cm) sur isolant rainuré. Collecteur + chape de scellement 5 cm.',
    trade: 'chauffage',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 65.14', title: 'Plancher chauffant basse température' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Tubes PER Ø16 — pas 15 cm moyen → 6 ml/m²',
      'Isolant PSE rainuré/plots (R > 2,5 m²K/W — NF DTU 65.14 §5.2)',
      'Film polyane barrière humidité entre isolant et chape',
      'Bande périphérique 10 mm (désolidarisation mur/chape)',
      '1 collecteur par zone (maison T3 = 1 niveau = 1 collecteur)',
      'Chape CT-C25-F4 ciment 5 cm sur tubes (0,05 m³/m²)',
      'Thermostats d\'ambiance par zone + têtes motorisées',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'isolant-pcbt-rainure', name: 'Isolant PSE rainuré/plots (PCRBT)',
        category: 'isolant', phase: 'preparation', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Découpes',
        dtu: 'NF DTU 65.14 §5.2',
        manufacturerRef: 'Knauf Therm PCRBT / Rehau',
      },
      {
        id: 'film-polyane-pcbt', name: 'Film polyane (barrière humidité)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
      },
      {
        id: 'bande-peripherique-pcbt', name: 'Bande périphérique 10 mm',
        category: 'joint', phase: 'preparation', quantityPerBase: 0.4, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'tube-per-16-pcbt', name: 'Tube PER diffusion Ø16 (pas 15 cm)',
        category: 'plaque', phase: 'principal', quantityPerBase: 6, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + raccords',
        manufacturerRef: 'Rehau Rautitan / Uponor',
        packaging: { unit: 'rouleau', contentQty: 240, contentUnit: 'ml', label: 'couronne 240 ml' },
      },
      {
        id: 'collecteur-pcbt', name: 'Collecteur de réglage (nourrice + circulateur)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.01, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 collecteur pour ~80-100 m² PCBT.',
      },
      {
        id: 'chape-ciment-pcbt', name: 'Chape CT-C25-F4 5 cm sur tubes',
        category: 'liant', phase: 'principal', quantityPerBase: 0.05, unit: 'm3', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Débords',
        dtu: 'NF DTU 26.2',
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'agrafe-fixation-tube-pcbt', name: 'Agrafes fixation tubes (tous 30 cm)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 20, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'thermostat-ambiance-pcbt', name: 'Thermostat d\'ambiance (1 par zone)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.025, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 thermostat par 40 m² environ.',
      },
      {
        id: 'tete-thermo-motorisee', name: 'Tête thermostatique motorisée (sur collecteur)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.025, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #18.3 CHAUDIÈRE GAZ CONDENSATION
  // ══════════════════════════════════════════════════════════
  {
    id: 'chaudiere-gaz-condensation',
    name: 'Chaudière gaz condensation (murale 24-28 kW)',
    description: 'Chaudière gaz HPE avec conduit ventouse concentrique. Groupe sécurité + vase expansion + pot anti-boues.',
    trade: 'chauffage',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 65.4', title: 'Chaudières' },
      { code: 'NF DTU 24.1', title: 'Conduits fumée (ventouse)' },
      { code: 'RE2020', title: 'Performance HPE' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Chaudière murale 24-28 kW (habitation T3-T4)',
      'Conduit concentrique ventouse (pas de cheminée requise)',
      'Groupe sécurité + soupape',
      'Pot anti-boues magnétique (protection circuit)',
      'Robinet arrêt gaz certifié ADG',
      'Raccordement sonde extérieure + pressostat',
      'Interdiction en construction neuve depuis 2022 (RE2020) — rénovation uniquement',
    ],
    materials: [
      {
        id: 'chaudiere-gaz-24kw', name: 'Chaudière gaz condensation murale 24-28 kW',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 65.4',
        manufacturerRef: 'Viessmann Vitodens / ELM Leblanc / Saunier Duval',
      },
      {
        id: 'conduit-concentrique-ventouse', name: 'Conduit concentrique ventouse',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 24.1',
      },
      {
        id: 'groupe-securite-chauff', name: 'Groupe sécurité + soupape',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 65.11',
      },
      {
        id: 'pot-anti-boues-magnetique', name: 'Pot anti-boues magnétique',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'robinet-arret-gaz-adg', name: 'Robinet arrêt gaz certifié ADG',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'flexible-gaz-adg', name: 'Flexible gaz ADG (raccord chaudière)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'sonde-exterieure-chauffage', name: 'Sonde extérieure + câblage',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #18.4 POMPE À CHALEUR AIR/EAU (PAC)
  // ══════════════════════════════════════════════════════════
  {
    id: 'pac-air-eau',
    name: 'Pompe à chaleur air/eau (8 kW + ballon ECS 200 L)',
    description: 'PAC monobloc ou bi-bloc avec unité extérieure + module hydraulique intérieur. Ballon ECS intégré ou séparé.',
    trade: 'chauffage',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 65.16', title: 'PAC air/eau' },
      { code: 'RE2020', title: 'Chauffage bas-carbone privilégié' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Unité extérieure 8 kW (habitation T3-T4 isolée RE2020)',
      'Module hydraulique intérieur avec circulateur + régulation',
      'Ballon ECS 200 L intégré (ou séparé selon modèle)',
      'Liaisons frigorifiques cuivre isolé (aller + retour)',
      'Support châssis anti-vibrations pour UE',
      'Bac évacuation condensats + tuyau PVC Ø32',
      'Crédit MaPrimeRénov\' + CEE disponibles',
    ],
    materials: [
      {
        id: 'unite-ext-pac', name: 'Unité extérieure PAC 8 kW',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 65.16',
        manufacturerRef: 'Atlantic Alféa / Daikin Altherma / Mitsubishi Ecodan',
      },
      {
        id: 'module-hydro-pac', name: 'Module hydraulique intérieur',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'ballon-ecs-200l-pac', name: 'Ballon ECS 200 L',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'liaison-frigo-cuivre', name: 'Liaisons frigorifiques cuivre isolé (aller + retour)',
        category: 'plaque', phase: 'principal', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'support-chassis-pac', name: 'Support châssis anti-vibrations (UE)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'bac-evac-condensats', name: 'Bac évacuation condensats + tuyau PVC Ø32',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'vase-expansion-pac', name: 'Vase d\'expansion + pot anti-boues',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'sonde-exterieure-pac', name: 'Sonde température extérieure',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #18.5 POÊLE À BOIS OU GRANULÉS
  // ══════════════════════════════════════════════════════════
  {
    id: 'poele-granules',
    name: 'Poêle à granulés 8 kW + conduit tubage inox',
    description: 'Poêle granulés Flamme Verte 7★ + conduit tubage inox 316L + chapeau + plaque protection sol.',
    trade: 'chauffage',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF DTU 24.1', title: 'Conduits fumée' },
      { code: 'NF EN 14785', title: 'Poêles granulés' },
      { code: 'Flamme Verte 7★', title: 'Label RE2020' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Poêle à granulés 8 kW (habitation T3-T4)',
      'Label Flamme Verte 7★ (RE2020 + MaPrimeRénov\')',
      'Conduit tubage inox 316L (obligatoire si conduit maçonné existant)',
      'Chapeau anti-pluie / anti-vent',
      'Plaque de protection sol (verre trempé ou acier) OBLIGATOIRE',
      'Kit départ plafond (traversée charpente)',
    ],
    materials: [
      {
        id: 'poele-granules-8kw', name: 'Poêle à granulés 8 kW Flamme Verte 7★',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF EN 14785',
        manufacturerRef: 'MCZ / Palazzetti / Invicta',
      },
      {
        id: 'tubage-inox-316l', name: 'Tubage inox 316L (Ø80 double paroi)',
        category: 'plaque', phase: 'principal', quantityPerBase: 6, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 24.1',
      },
      {
        id: 'chapeau-cheminee-inox', name: 'Chapeau anti-pluie/anti-vent',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'plaque-protection-sol', name: 'Plaque protection sol (verre trempé ou acier)',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: 'OBLIGATOIRE sous poêle (100×100 cm mini).',
      },
      {
        id: 'kit-depart-plafond', name: 'Kit départ plafond (traversée charpente)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'solin-toiture-tubage', name: 'Solin toiture (étanchéité traversée)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #18.6 CONDUIT DE FUMÉE (maçonné neuf ou tubage existant)
  // ══════════════════════════════════════════════════════════
  {
    id: 'conduit-fumee-inox',
    name: 'Conduit de fumée inox double paroi (au ml)',
    description: 'Conduit inox isolé double paroi + souche + chapeau. Pour poêles, cheminées, chaudières bois.',
    trade: 'chauffage',
    baseUnit: 'ml',
    geometryMode: 'length',
    dtuReferences: [
      { code: 'NF DTU 24.1', title: 'Conduits fumée (rev. 2020)' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Tube inox 316L double paroi (intérieur + extérieur séparés par isolant)',
      'Souche émergeante toiture avec solin',
      'Chapeau anti-pluie/anti-vent OBLIGATOIRE',
      'Alternative : boisseaux terre cuite (si construction neuve)',
      'Hauteur minimum selon règlement local + charte départementale',
    ],
    materials: [
      {
        id: 'tube-inox-double-paroi', name: 'Tube inox 316L double paroi',
        category: 'plaque', phase: 'principal', quantityPerBase: 1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 24.1',
      },
      {
        id: 'souche-toiture', name: 'Souche émergeante toiture',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 souche par conduit (~6 ml moyen → 0,17/ml).',
      },
      {
        id: 'chapeau-conduit-fumee', name: 'Chapeau anti-pluie/anti-vent',
        category: 'accessoire', phase: 'principal', quantityPerBase: 0.15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'solin-toiture-conduit', name: 'Solin toiture (étanchéité)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },
]
