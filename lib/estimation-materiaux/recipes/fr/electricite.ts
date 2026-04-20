import type { Recipe } from '../../types'

/**
 * ÉLECTRICITÉ COURANT FORT — audit #21
 *
 * Référentiels FR :
 * - NF C 15-100 — installations électriques basse tension (édition 2015 + A1-A5)
 *   AMENDEMENT A5 (2023) : IRVE, pilotage, sécurité incendie
 * - NF DTU 70.1 — installations électriques habitation
 * - NF C 14-100 — branchement
 * - NF C 15-722 — spécifique IRVE
 * - UTE C 15-712-1 — photovoltaïque
 *
 * Référentiels PT :
 * - RTIEBT (Regras Técnicas Instalações Elétricas Baixa Tensão, DL 101/2007)
 * - Portaria 949-A/2006
 */

export const electriciteRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #21.1 TABLEAU ÉLECTRIQUE (appartement T3 standard)
  // ══════════════════════════════════════════════════════════
  {
    id: 'elec-tableau-principal',
    name: 'Tableau électrique principal (GTL + coffret + disjoncteurs)',
    description: 'Coffret 2-4 rangées T2-T5 selon nb circuits. Disjoncteurs diff 30 mA type AC/A + magnéto-thermiques. NF C 15-100 amendement A5.',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF C 15-100', title: 'Installations électriques basse tension', section: 'Édition 2015 + A5 2023' },
      { code: 'NF EN 61439-3', title: 'Tableaux' },
      { code: 'UTE C 15-712-1', title: 'Installations photovoltaïques' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'T3 standard : 3 rangées 13 modules, 18-20 disjoncteurs magnéto-thermiques',
      'GTL (Gaine Technique Logement) 600×2300 mm obligatoire (NF C 15-100 §771.558)',
      'Disjoncteur différentiel 30 mA type AC : 2 u (circuits lumière + prises 16A)',
      'Disjoncteur différentiel 30 mA type A : 1 u (lave-linge, IRVE, PAC — A5 2023)',
      '1 unité = 1 logement complet (coffret + tous les disjoncteurs)',
      'Consuel obligatoire après installation (démarche administrative)',
    ],
    materials: [
      {
        id: 'gtl-coffret', name: 'GTL (Gaine Technique Logement) 600×2300 mm',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §771.558',
      },
      {
        id: 'coffret-tableau-3r-13m', name: 'Coffret tableau 3 rangées × 13 modules',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        normRef: 'NF EN 61439-3',
        manufacturerRef: 'Hager Volta / Schneider Resi9 / Legrand Drivia',
      },
      {
        id: 'disjoncteur-diff-30ma-ac', name: 'Disjoncteur différentiel 30 mA 40 A type AC',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §411.3.2.5',
      },
      {
        id: 'disjoncteur-diff-30ma-a', name: 'Disjoncteur différentiel 30 mA 40 A type A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §531.2.1.4 (A5)',
        notes: 'Obligatoire circuits lave-linge, IRVE, PAC (amendement A5 2023).',
      },
      {
        id: 'disjoncteur-mt-10a', name: 'Disjoncteurs magnéto-thermiques 10A/16A/20A/32A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 18, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §771.314',
        notes: 'T3 : ~18 disjoncteurs (éclairage × 4, prises × 6, spécialisés × 5, chauffage × 3).',
      },
      {
        id: 'peigne-tableau', name: 'Peignes de raccordement (barrettes d\'alimentation)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
        notes: '1 peigne par rangée.',
      },
      {
        id: 'bornier-terre-neutre', name: 'Bornier de terre + bornier de neutre',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
        dtu: 'NF C 15-100',
      },
      {
        id: 'etiquetage-circuits', name: 'Étiquetage circuits (planche autocollante + schéma)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §514.5',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #21.2 CÂBLAGE CFO (par circuit)
  // ══════════════════════════════════════════════════════════
  {
    id: 'elec-cablage-circuit',
    name: 'Câblage électrique CFO (1 circuit standard prises 16A ou éclairage)',
    description: 'Un circuit complet : gaine ICTA + fils (phase/neutre/terre) + boîtes + appareillage + bornes Wago. Moyenne ~30 ml par circuit.',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF C 15-100', title: 'Installations électriques BT', section: '§771 équipements logement' },
      { code: 'NF C 15-100', title: 'Section conducteurs', section: '§531.2' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 u = 1 circuit électrique (éclairage OU prises OU spécialisé)',
      'Section selon usage : 1,5 mm² éclairage, 2,5 mm² prises 16A, 6 mm² 32A (four/plaque/IRVE)',
      'Estimation 30 ml gaine par circuit (mix longueurs selon pièce)',
      'Fils H07V-U rigides 3 couleurs : phase (rouge/marron) + neutre (bleu) + terre (vert/jaune)',
      'Bornes à levier Wago 221 remplacent les anciens dominos (meilleur contact)',
      'Max 8 prises par circuit 16A / max 8 points lumineux par circuit 10A (NF C 15-100 §771.314)',
    ],
    materials: [
      {
        id: 'gaine-icta-20', name: 'Gaine ICTA Ø20 mm (protection câble)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + traversées',
        dtu: 'NF C 15-100',
        manufacturerRef: 'Iboco / Ledvance',
        packaging: { unit: 'rouleau', contentQty: 25, contentUnit: 'ml', label: 'couronne 25 ml' },
      },
      {
        id: 'fil-h07vu-15-phase', name: 'Fil H07V-U 1,5 mm² phase (rouge ou marron)',
        category: 'plaque', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + dénudage',
        dtu: 'NF C 15-100 §531.2',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'bobine 100 m' },
      },
      {
        id: 'fil-h07vu-15-neutre', name: 'Fil H07V-U 1,5 mm² neutre (bleu)',
        category: 'plaque', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'bobine 100 m' },
      },
      {
        id: 'fil-h07vu-15-terre', name: 'Fil H07V-U 1,5 mm² terre (vert/jaune)',
        category: 'plaque', phase: 'principal', quantityPerBase: 33, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        packaging: { unit: 'rouleau', contentQty: 100, contentUnit: 'ml', label: 'bobine 100 m' },
      },
      {
        id: 'boite-encastrement-placo', name: 'Boîtes d\'encastrement (DCL + prises)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse',
        dtu: 'NF C 15-100 §771.314',
        manufacturerRef: 'Legrand Mosaic 65 mm / Schneider Odace 65 mm',
      },
      {
        id: 'prise-16a-complete', name: 'Prises de courant 16A complètes (mécanisme + plaque)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Legrand Mosaic / Schneider Odace',
        optional: true,
        condition: 'Si circuit prises (pas éclairage)',
      },
      {
        id: 'interrupteur-va-et-vient', name: 'Interrupteurs simple / va-et-vient',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si circuit éclairage',
      },
      {
        id: 'borne-wago-221', name: 'Bornes à levier Wago 221 (connexions)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        manufacturerRef: 'Wago 221',
        packaging: { unit: 'u', contentQty: 100, contentUnit: 'u', label: 'boîte 100 u' },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #21.3 MISE À LA TERRE
  // ══════════════════════════════════════════════════════════
  {
    id: 'elec-mise-terre',
    name: 'Mise à la terre (piquet + câble 25 mm² + barrette + liaisons équipotentielles)',
    description: 'Installation MALT complète maison individuelle : piquet 1,50 m + câble cuivre nu 25 mm² + barrette de coupure + LEP.',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF C 15-100', title: 'Mise à la terre', section: '§542' },
      { code: 'NF C 15-100', title: 'Liaisons équipotentielles', section: '§541' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Piquet de terre 1,50 m acier galvanisé ou cuivre (1 u minimum)',
      'Objectif Ra < 100 Ω (si disjoncteur diff 30 mA)',
      'Câble cuivre nu 25 mm² : piquet → répartiteur (~15 ml moyen)',
      'Câble H07V-K 6 mm² : liaisons équipotentielles vers tuyauterie eau/gaz/chauffage',
      'Barrette de coupure OBLIGATOIRE (accessible pour test)',
      'Test résistance après installation (démarche Consuel)',
    ],
    materials: [
      {
        id: 'piquet-terre-galva', name: 'Piquet de terre 1,50 m (acier galvanisé ou cuivre)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §542.2.1',
        manufacturerRef: 'nVent Erico',
      },
      {
        id: 'cable-cuivre-nu-25', name: 'Câble cuivre nu 25 mm² (liaison piquet → répartiteur)',
        category: 'plaque', phase: 'principal', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Chutes',
        dtu: 'NF C 15-100 §542',
      },
      {
        id: 'cable-h07vk-6', name: 'Câble H07V-K 6 mm² (liaisons équipotentielles)',
        category: 'plaque', phase: 'principal', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF C 15-100 §541',
      },
      {
        id: 'barrette-coupure-terre', name: 'Barrette de coupure mise à la terre',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §542.4.2',
      },
      {
        id: 'cosse-sertissage-terre', name: 'Cosses sertissage (liaisons tuyauterie)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 8, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'collier-liaison-equipotentielle', name: 'Colliers liaison équipotentielle (serrage tuyau)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        notes: '1 par tuyauterie : eau EF + eau EC + gaz (si présent).',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #21.4 ÉCLAIRAGE EXTÉRIEUR
  // ══════════════════════════════════════════════════════════
  {
    id: 'elec-eclairage-exterieur',
    name: 'Éclairage extérieur (1 point lumineux mural ou borne)',
    description: '1 point d\'éclairage extérieur IP44 min + câblage enterré obligatoire avec grillage avertisseur rouge.',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF C 15-100', title: 'Appareillage et luminaires éclairage extérieur', section: '§559 (IP min 44)' },
      { code: 'NF C 15-100', title: 'Câbles enterrés', section: '§528' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 point lumineux extérieur (applique, borne, spot enterré)',
      'Indice protection IP 44 minimum (contre projections eau)',
      'Câble U-1000 R2V 3G1,5 enterré min 60 cm sous grillage rouge',
      'Gaine TPC rouge Ø40 protège le câble',
      'Boîte de dérivation étanche IP 65 pour jonctions',
      'Détecteur de mouvement optionnel (économie énergie)',
      'Estimation câble 10 ml par point (vers source)',
    ],
    materials: [
      {
        id: 'luminaire-ext-ip44', name: 'Luminaire extérieur IP 44 (applique / borne / spot)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §559',
      },
      {
        id: 'cable-u1000-3g15', name: 'Câble U-1000 R2V 3G1,5 (enterré)',
        category: 'plaque', phase: 'principal', quantityPerBase: 11, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + raccords',
        dtu: 'NF C 15-100 §528',
      },
      {
        id: 'gaine-tpc-40', name: 'Gaine TPC rouge Ø40 (protection enterré)',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF C 15-100',
      },
      {
        id: 'grillage-avertisseur-rouge', name: 'Grillage avertisseur rouge (enterré >60 cm)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Recouvrements',
        dtu: 'NF C 15-100',
      },
      {
        id: 'boite-derivation-etanche-ip65', name: 'Boîte de dérivation étanche IP 65',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: '1 boîte tous 2 points lumineux.',
      },
      {
        id: 'detecteur-mouvement', name: 'Détecteur de mouvement (option économie)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        optional: true,
        condition: 'Si éclairage de sécurité ou allée (économie consommation)',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #21.5 BORNE DE RECHARGE VÉHICULE ÉLECTRIQUE (IRVE)
  // ══════════════════════════════════════════════════════════
  {
    id: 'elec-borne-irve-7kw',
    name: 'Borne de recharge VE Wallbox 7 kW (Mode 3 Type 2)',
    description: 'Wallbox murale 7 kW avec protection dédiée au tableau. Installateur certifié IRVE obligatoire.',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF C 15-100', title: 'Amendement A5 2023 — IRVE' },
      { code: 'NF C 15-722', title: 'Spécifique IRVE' },
      { code: 'Décret LOM', title: 'Pré-équipement IRVE obligatoire logements neufs' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Wallbox 7 kW Mode 3 Type 2 (recharge VE habitat individuel standard)',
      'Fabricants : Schneider EV-Link / Legrand Green\'Up / Wallbox Pulsar',
      'Disjoncteur différentiel 30 mA TYPE A OBLIGATOIRE (IRVE)',
      'Disjoncteur magnéto-thermique 32 A amont',
      'Câble U-1000 R2V 3G6 mm² (selon longueur/puissance)',
      'Estimation 15 ml câble entre tableau et borne',
      'Installateur certifié IRVE obligatoire (mention RGE requise)',
      'Crédit d\'impôt CITE + aides ADVENIR disponibles',
    ],
    materials: [
      {
        id: 'wallbox-7kw', name: 'Wallbox 7 kW Mode 3 Type 2',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-722',
        manufacturerRef: 'Schneider EV-Link / Legrand Green\'Up / Wallbox Pulsar',
      },
      {
        id: 'disjoncteur-diff-30ma-a-irve', name: 'Disjoncteur différentiel 30 mA type A (IRVE)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §531.2.1.4 (A5)',
        notes: 'Type A obligatoire pour IRVE.',
      },
      {
        id: 'disjoncteur-mt-32a-irve', name: 'Disjoncteur magnéto-thermique 32 A',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        notes: 'Calibrage 32 A pour Wallbox 7 kW (230 V).',
      },
      {
        id: 'cable-u1000-3g6', name: 'Câble U-1000 R2V 3G6 mm² (tableau → borne)',
        category: 'plaque', phase: 'principal', quantityPerBase: 16.5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + raccords',
        dtu: 'NF C 15-100',
        notes: '15 ml × 1,10 pertes = 16,5 ml par borne.',
      },
      {
        id: 'gaine-tpc-40-irve', name: 'Gaine TPC Ø40 (si passage enterré)',
        category: 'accessoire', phase: 'preparation', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        optional: true,
        condition: 'Si câble passage enterré (>60 cm sous grillage)',
      },
      {
        id: 'etiquetage-irve', name: 'Étiquetage IRVE (risque électrique + indication)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #21.6 PARAFOUDRE (obligatoire zones foudroyées)
  // ══════════════════════════════════════════════════════════
  {
    id: 'elec-parafoudre-type2',
    name: 'Parafoudre Type 2 (protection surtension)',
    description: 'Parafoudre 2 modules DIN + disjoncteur amont dédié. Obligatoire NF C 15-100 A5 2023 pour zones densité foudroiement > 2,5.',
    trade: 'electricite',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF C 15-100', title: 'Protection surtensions', section: '§534 + A5 2023' },
      { code: 'NF EN 61643-11', title: 'Parafoudres BT' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Parafoudre Type 2 suffisant pour logement individuel',
      'Type 1+2 obligatoire si bâtiment avec paratonnerre',
      'Obligatoire depuis A5 2023 dans zones à densité foudroiement NG > 2,5 (carte météo)',
      'Disjoncteur amont dédié (25 A minimum) OBLIGATOIRE — protège le parafoudre',
      'Installation en tête de tableau (juste après disjoncteur général)',
    ],
    materials: [
      {
        id: 'parafoudre-type2', name: 'Parafoudre Type 2 (2 modules DIN)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §534', normRef: 'NF EN 61643-11',
        manufacturerRef: 'Hager SPD / Schneider iQuick PRD / Legrand',
      },
      {
        id: 'disjoncteur-mt-25a-parafoudre', name: 'Disjoncteur magnéto-thermique 25 A amont parafoudre',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF C 15-100 §534',
      },
      {
        id: 'cable-parafoudre-terre', name: 'Câble liaison terre parafoudre (10 mm² min)',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },
]
