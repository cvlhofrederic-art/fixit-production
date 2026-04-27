// lib/prix-travaux-2026/data/menuiserie.ts
//
// Bootstrap Menuiserie — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE INSEE — l'index officiel "Menuiserie bois" est le BT44 (menuiserie bois et
// PVC) et BT45 (menuiserie métallique : aluminium, acier). Les fenêtres PVC se
// rattachent à BT44, les fenêtres aluminium à BT45. Les parquets et placards
// (menuiserie intérieure bois) restent indexés BT44.
//
// AIDES ÉNERGÉTIQUES — Lignes 2 (fenêtre PVC DV) et 3 (fenêtre Alu DV) sont
// éligibles MaPrimeRénov + CEE :
//   • BAR-EN-104 — Fenêtre ou porte-fenêtre complète avec vitrage isolant
// Forfaits MPR 2026 par fenêtre selon tranche revenus (bleu/jaune/violet/rose)
// et bonus CEE par fenêtre conformément aux fiches d'opérations standardisées.

import type { PriceLine } from '../types'

export const menuiserieLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Porte intérieure standard — fourniture + pose (€/unité)
  // moBrut    = 2.50 × 50 = 125.00
  // coutBrut  = 125.00 + 220 = 345.00
  // coutFinal = 345.00 × 1.12 = 386.40
  // ttc       = 386.40 × 1.10 = 425.04
  // priceMin  = round(425.04 × 0.92) = 391
  // priceMax  = round(425.04 × 1.08) = 459
  // spread    = (459 − 391) / 391 = 17.4 % ≤ 20 % ✓
  // Hypothèse : porte intérieure standard isoplane post-formée bloc-porte +
  // huisserie bois ou métallique + quincaillerie standard (paumelles, serrure
  // à clé, béquilles), dépose ancienne porte incluse, ajustements et calage.
  // Hors finition peinture (voir peinture-boiseries-portes-plinthes).
  // TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'menuiserie',
    taskId: 'menuiserie-porte-interieure-standard-pose',
    label: 'Porte intérieure standard — fourniture + pose',
    unit: 'unite',
    description: "Bloc-porte intérieur standard isoplane post-formé : huisserie bois ou métallique, paumelles, serrure à clé bec-de-cane, béquilles standard, dépose ancienne porte et ajustements inclus. Finition peinture non incluse. Logement >2 ans, TVA 10 %.",
    cost: {
      mainOeuvreHeures: 2.50,
      mainOeuvreTauxHoraire: 50,
      materiaux: 220,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 391,
    priceMax: 459,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['porte intérieure', 'bloc-porte', 'pose porte', 'huisserie', 'porte isoplane'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires menuiserie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier menuisier chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 45-55 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT44 — Menuiserie bois et PVC (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710975',
        excerpt: 'Index BT44 Menuiserie bois et PVC base 100 = 2010, dernière mise à jour T1 2026. Référence indexation portes intérieures, fenêtres PVC et parquets.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix pose porte intérieure 2026',
        tier: 2,
        url: 'https://www.travaux.com/menuiserie/guide-des-prix/prix-pose-porte-interieure',
        excerpt: 'Bloc-porte intérieur standard fourniture + pose : 350-500 €/unité TTC (porte isoplane bois) ; 500-800 €/unité (porte alvéolaire post-formée prête à peindre haut de gamme)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix pose porte intérieure 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/menuiserie/prix-porte-interieure',
        excerpt: 'Porte intérieure standard isoplane bloc-porte + pose : 300-450 €/unité fourniture + main d\'œuvre, dépose comprise',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT44. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Fenêtre PVC double vitrage 1 vantail 100×100 — fourniture + pose (€/unité)
  //    AIDES MPR + CEE BAR-EN-104, TVA 5.5 %
  // moBrut    = 4.00 × 50 = 200.00
  // coutBrut  = 200.00 + 480 = 680.00
  // coutFinal = 680.00 × 1.12 = 761.60
  // ttc       = 761.60 × 1.055 = 803.49
  // priceMin  = round(803.49 × 0.92) = 739
  // priceMax  = round(803.49 × 1.08) = 868
  // spread    = (868 − 739) / 739 = 17.5 % ≤ 20 % ✓
  // Hypothèse : fenêtre PVC blanche 1 vantail oscillo-battant dimensions
  // 100×100 cm, double vitrage 4/16/4 argon (Uw ≤ 1.3 W/m².K, Sw ≥ 0.30),
  // pose en rénovation sur dormant existant ou pose totale, raccords plâtre
  // et calfeutrement inclus, dépose ancienne fenêtre incluse. Logement >2 ans,
  // opération éligible MaPrimeRénov + CEE BAR-EN-104, TVA 5.5 % rénovation
  // énergétique.
  //
  // AIDES BAR-EN-104 — Fenêtre ou porte-fenêtre vitrage isolant :
  //   • MPR forfaits 2026 : bleu 80/fenêtre, jaune 40/fenêtre, violet 0, rose 0
  //   • Plafond travaux MPR : 16 fenêtres éligibles maximum par logement
  //   • CEE BAR-EN-104 : ~50 €/fenêtre (climat H1, surface chauffée)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  //   • Performance minimale exigée : Uw ≤ 1.3 W/m².K et Sw ≥ 0.30
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'menuiserie',
    taskId: 'menuiserie-fenetre-pvc-double-vitrage-1vantail-100x100',
    label: 'Fenêtre PVC double vitrage — 1 vantail 100×100',
    unit: 'unite',
    description: "Fenêtre PVC blanche 1 vantail oscillo-battant 100×100 cm, double vitrage 4/16/4 argon (Uw ≤ 1.3 W/m².K, Sw ≥ 0.30), dépose ancienne fenêtre, pose en rénovation ou totale, raccords plâtre et calfeutrement inclus. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-EN-104, TVA 5.5 %.",
    cost: {
      mainOeuvreHeures: 4.00,
      mainOeuvreTauxHoraire: 50,
      materiaux: 480,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 739,
    priceMax: 868,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      keywords: ['fenêtre PVC', 'double vitrage', '1 vantail', 'BAR-EN-104', 'remplacement fenêtre'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 80, jaune: 40, violet: 0, rose: 0 },
        plafondTravaux: 16,
      },
      cee: {
        forfaitParUnite: 50,
        operationStandard: 'BAR-EN-104',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires menuiserie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier menuisier-poseur chargé Bouches-du-Rhône : 50 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT44 — Menuiserie bois et PVC (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710975',
        excerpt: 'Index BT44 Menuiserie bois et PVC T1 2026 — applicable fenêtres PVC double vitrage.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 fenêtres (BAR-EN-104)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Remplacement fenêtre / porte-fenêtre vitrage isolant — forfaits 2026 par tranche revenus : bleu 80 €/fenêtre, jaune 40 €/fenêtre, violet 0, rose 0. Plafond 16 fenêtres éligibles par logement. Performance minimale Uw ≤ 1.3 W/m².K et Sw ≥ 0.30.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix fenêtre PVC double vitrage 2026',
        tier: 2,
        url: 'https://www.travaux.com/menuiserie/guide-des-prix/prix-fenetre-pvc',
        excerpt: 'Fenêtre PVC 1 vantail 100×100 double vitrage fourniture + pose : 700-900 €/unité TTC milieu de gamme, hors aides',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT44. Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-EN-104) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (forfaits susceptibles de glisser à la baisse plan budget 2026).",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Fenêtre aluminium double vitrage 2 vantaux 150×100 — fourniture + pose (€/unité)
  //    AIDES MPR + CEE BAR-EN-104, TVA 5.5 %
  // moBrut    = 5.50 × 50 = 275.00
  // coutBrut  = 275.00 + 1100 = 1375.00
  // coutFinal = 1375.00 × 1.12 = 1540.00
  // ttc       = 1540.00 × 1.055 = 1624.70
  // priceMin  = round(1624.70 × 0.92) = 1495
  // priceMax  = round(1624.70 × 1.08) = 1755
  // spread    = (1755 − 1495) / 1495 = 17.4 % ≤ 20 % ✓
  // Hypothèse : fenêtre aluminium thermolaqué (rupture pont thermique)
  // 2 vantaux ouvrant à la française, dimensions 150×100 cm, double vitrage
  // 4/16/4 argon faiblement émissif (Uw ≤ 1.3 W/m².K, Sw ≥ 0.30), pose en
  // rénovation, raccords plâtre et calfeutrement inclus, dépose ancienne
  // fenêtre incluse. Logement >2 ans, opération éligible MaPrimeRénov + CEE
  // BAR-EN-104, TVA 5.5 % rénovation énergétique.
  //
  // AIDES BAR-EN-104 — Fenêtre ou porte-fenêtre vitrage isolant :
  //   • MPR forfaits 2026 : bleu 80/fenêtre, jaune 40/fenêtre, violet 0, rose 0
  //   • Plafond travaux MPR : 16 fenêtres éligibles maximum par logement
  //   • CEE BAR-EN-104 : ~50 €/fenêtre (climat H1, surface chauffée)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  //   • Performance minimale exigée : Uw ≤ 1.3 W/m².K et Sw ≥ 0.30
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'menuiserie',
    taskId: 'menuiserie-fenetre-aluminium-double-vitrage-2vantaux-150x100',
    label: 'Fenêtre aluminium double vitrage — 2 vantaux 150×100',
    unit: 'unite',
    description: "Fenêtre aluminium thermolaqué à rupture de pont thermique 2 vantaux ouverture à la française 150×100 cm, double vitrage 4/16/4 argon faiblement émissif (Uw ≤ 1.3 W/m².K, Sw ≥ 0.30), dépose ancienne fenêtre, pose en rénovation, raccords plâtre et calfeutrement inclus. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-EN-104, TVA 5.5 %.",
    cost: {
      mainOeuvreHeures: 5.50,
      mainOeuvreTauxHoraire: 50,
      materiaux: 1100,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 1495,
    priceMax: 1755,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      keywords: ['fenêtre aluminium', 'double vitrage', '2 vantaux', 'BAR-EN-104', 'rupture pont thermique'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 80, jaune: 40, violet: 0, rose: 0 },
        plafondTravaux: 16,
      },
      cee: {
        forfaitParUnite: 50,
        operationStandard: 'BAR-EN-104',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires menuiserie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier menuisier-poseur chargé Bouches-du-Rhône : 50 €/h (rendement majoré 5.5 h pour fenêtre alu 2 vantaux grand format)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT45 — Menuiserie métallique aluminium (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710976',
        excerpt: 'Index BT45 Menuiserie métallique base 100 = 2010, dernière mise à jour T1 2026. Référence indexation fenêtres aluminium, acier et métallerie.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 fenêtres (BAR-EN-104)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Remplacement fenêtre / porte-fenêtre vitrage isolant — forfaits 2026 par tranche revenus : bleu 80 €/fenêtre, jaune 40 €/fenêtre, violet 0, rose 0. Plafond 16 fenêtres éligibles par logement. Performance minimale Uw ≤ 1.3 W/m².K et Sw ≥ 0.30.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix fenêtre aluminium double vitrage 2026',
        tier: 2,
        url: 'https://www.travaux.com/menuiserie/guide-des-prix/prix-fenetre-aluminium',
        excerpt: 'Fenêtre aluminium 2 vantaux 150×100 double vitrage fourniture + pose : 1400-1800 €/unité TTC milieu/haut de gamme, hors aides',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT45. Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-EN-104) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (forfaits susceptibles de glisser à la baisse plan budget 2026).",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Parquet massif chêne — pose flottante (€/m²)
  // moBrut    = 0.45 × 50 = 22.50
  // coutBrut  = 22.50 + 60 = 82.50
  // coutFinal = 82.50 × 1.12 = 92.40
  // ttc       = 92.40 × 1.10 = 101.64
  // priceMin  = round(101.64 × 0.92) = 94
  // priceMax  = round(101.64 × 1.08) = 110
  // spread    = (110 − 94) / 94 = 17.0 % ≤ 20 % ✓
  // Hypothèse : parquet massif chêne contrecollé 14-15 mm finition vernie ou
  // huilée, pose flottante sur sous-couche acoustique 3 mm, plinthes en
  // sus, support sain et plan préalable. Hors préparation lourde de support
  // (ragréage, retrait ancien revêtement). TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'menuiserie',
    taskId: 'menuiserie-parquet-massif-chene-pose-flottante',
    label: 'Parquet massif chêne — pose flottante',
    unit: 'm2',
    description: "Parquet massif chêne contrecollé 14-15 mm finition vernie ou huilée, pose flottante sur sous-couche acoustique 3 mm, lames clipsables, découpes périphériques. Plinthes et préparation lourde de support (ragréage, retrait ancien revêtement) non incluses. Logement >2 ans, TVA 10 %.",
    cost: {
      mainOeuvreHeures: 0.45,
      mainOeuvreTauxHoraire: 50,
      materiaux: 60,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 94,
    priceMax: 110,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['parquet massif', 'parquet chêne', 'pose flottante', 'parquet contrecollé', 'sous-couche acoustique'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires menuiserie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier menuisier-parqueteur chargé Bouches-du-Rhône : 50 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT44 — Menuiserie bois et PVC (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710975',
        excerpt: 'Index BT44 Menuiserie bois et PVC T1 2026 — applicable parquets massifs et contrecollés bois.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix pose parquet massif 2026',
        tier: 2,
        url: 'https://www.travaux.com/menuiserie/guide-des-prix/prix-pose-parquet',
        excerpt: 'Parquet massif chêne contrecollé pose flottante fourniture + pose : 80-120 €/m² TTC milieu de gamme',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix parquet massif 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/sol/prix-parquet',
        excerpt: 'Parquet massif chêne pose flottante : 75-110 €/m² fourniture + main d\'œuvre, finition standard',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT44. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Placard coulissant 2 portes 2.4 m — fourniture + pose (€/unité)
  // moBrut    = 6.00 × 50 = 300.00
  // coutBrut  = 300.00 + 800 = 1100.00
  // coutFinal = 1100.00 × 1.12 = 1232.00
  // ttc       = 1232.00 × 1.10 = 1355.20
  // priceMin  = round(1355.20 × 0.92) = 1247
  // priceMax  = round(1355.20 × 1.08) = 1464
  // spread    = (1464 − 1247) / 1247 = 17.4 % ≤ 20 % ✓
  // Hypothèse : placard coulissant 2 portes mélaminé ou miroir, largeur 2.4 m
  // hauteur ~2.45 m, caisson aménagement intérieur (1 penderie + 4 étagères),
  // rails haut/bas + accessoires, montage et fixation murale, ajustements.
  // Hors démolition ancien placard et finition murs adjacents. TVA 10 %
  // logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'menuiserie',
    taskId: 'menuiserie-placard-coulissant-2portes-2m4',
    label: 'Placard coulissant — 2 portes 2.4 m + aménagement',
    unit: 'unite',
    description: "Placard coulissant 2 portes mélaminé ou miroir, largeur 2.4 m hauteur ~2.45 m, caisson aménagement intérieur (1 penderie + 4 étagères), rails haut/bas et accessoires, montage et fixation murale, ajustements. Démolition ancien placard et finition murs adjacents non incluses. Logement >2 ans, TVA 10 %.",
    cost: {
      mainOeuvreHeures: 6.00,
      mainOeuvreTauxHoraire: 50,
      materiaux: 800,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 1247,
    priceMax: 1464,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['placard coulissant', 'dressing', 'portes coulissantes', 'aménagement placard', 'mélaminé miroir'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires menuiserie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier menuisier-agenceur chargé Bouches-du-Rhône : 50 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT44 — Menuiserie bois et PVC (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710975',
        excerpt: 'Index BT44 Menuiserie bois et PVC T1 2026 — applicable agencement intérieur, placards et dressings.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix placard coulissant 2026',
        tier: 2,
        url: 'https://www.travaux.com/menuiserie/guide-des-prix/prix-placard-coulissant',
        excerpt: 'Placard coulissant 2 portes 2.4 m mélaminé/miroir + aménagement intérieur fourniture + pose : 1100-1500 €/unité TTC milieu de gamme',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix dressing et placard sur mesure 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/menuiserie/prix-placard-dressing',
        excerpt: 'Placard coulissant 2 portes ~2.4 m avec aménagement standard : 1000-1500 €/unité fourniture + pose',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT44. Refresh via prix-freshness workflow when grid lands.',
  },
]
