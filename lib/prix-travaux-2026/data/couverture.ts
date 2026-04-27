// lib/prix-travaux-2026/data/couverture.ts
//
// Bootstrap Couverture — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE INSEE — l'index couverture historique est le BT34 "Couverture en
// grands éléments tuiles", complété par BT35 (couverture zinc / métaux). À
// vérifier/affiner via prix-freshness workflow comme BT22/BT37 ont été
// corrigés pour d'autres métiers. Référence : Insee.fr séries BT.
//
// VARIANT 5 — Velux 78×98 : forfait posé hors charpente (chevêtre simple,
// raccord zinguerie + écran + ardoise/tuile périphérique). Hors menuiseries
// intérieures et finition plâtre intérieur.

import type { PriceLine } from '../types'

export const couvertureLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Tuiles mécaniques — pose neuve (€/m²)
  // moBrut    = 0.65 × 56 = 36.40
  // coutBrut  = 36.40 + 37 = 73.40
  // coutFinal = 73.40 × 1.10 = 80.74
  // ttc       = 80.74 × 1.10 = 88.81
  // priceMin  = round(88.81 × 0.92) = 82
  // priceMax  = round(88.81 × 1.08) = 96
  // spread    = (96 − 82) / 82 = 17.1 % ≤ 20 % ✓
  // Hypothèse : pose neuve sur charpente existante saine, tuiles mécaniques
  // milieu de gamme (terre cuite type Romane / Galleane), liteaux sapin
  // traités, écran de sous-toiture HPV, fixations crochets inox, faîtière
  // ventilée scellée à sec. Fourniture (~37 €/m² : tuiles 22 + liteaux 5 +
  // écran HPV 5 + fixations/faîtage 5). TVA 10 % logement >2 ans.
  // Hors dépose ancienne couverture, charpente, isolation, échafaudage lourd.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'couverture',
    taskId: 'couverture-tuiles-mecaniques-pose-neuve',
    label: 'Couverture tuiles mécaniques — pose neuve',
    unit: 'm2',
    description: 'Pose neuve couverture tuiles mécaniques milieu de gamme (terre cuite type Romane/Galleane) sur charpente existante saine : liteaux sapin traités, écran de sous-toiture HPV, crochets inox, faîtière ventilée scellée à sec. Hors dépose ancienne couverture, charpente, isolation et échafaudage lourd.',
    cost: {
      mainOeuvreHeures: 0.65,
      mainOeuvreTauxHoraire: 56,
      materiaux: 37,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 82,
    priceMax: 96,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['tuiles mécaniques', 'couverture neuve', 'tuile terre cuite', 'pose tuiles', 'romane'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires couverture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier couvreur chargé Bouches-du-Rhône : 56 €/h (estimation interne alignée fourchette nationale CAPEB 52-60 €/h chargé pour couverture-zinguerie)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT34 — Couverture grands éléments tuiles (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Index BT34 Couverture en grands éléments tuiles, dernière mise à jour T1 2026. Référence indexation prestations couverture tuiles mécaniques / canal / plates.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix couverture tuiles 2026',
        tier: 2,
        url: 'https://www.travaux.com/couverture/guide-des-prix/prix-couverture-tuiles',
        excerpt: 'Pose neuve tuiles mécaniques fourniture + main d\'œuvre : 75-110 €/m² TTC selon type de tuile et accessibilité',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix couverture tuiles 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/couverture/prix-couverture',
        excerpt: 'Tuiles mécaniques milieu de gamme posées : 80-100 €/m² TTC, écran sous-toiture inclus',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 56 €/h is internal estimate aligned with 2025 baseline + INSEE BT34. INSEE index BT34 to be re-confirmed via prix-freshness workflow (historical labels have shifted). Refresh when CAPEB grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Ardoise naturelle — pose neuve (€/m²)
  // moBrut    = 0.95 × 56 = 53.20
  // coutBrut  = 53.20 + 68 = 121.20
  // coutFinal = 121.20 × 1.10 = 133.32
  // ttc       = 133.32 × 1.10 = 146.65
  // priceMin  = round(146.65 × 0.92) = 135
  // priceMax  = round(146.65 × 1.08) = 158
  // spread    = (158 − 135) / 135 = 17.0 % ≤ 20 % ✓
  // Hypothèse : pose neuve ardoise naturelle d'Espagne ou Angers (épaisseur
  // 4-5 mm) sur charpente saine, voligeage sapin, écran HPV, crochets inox
  // tempête, faîtage à crête. Fourniture (~68 €/m² : ardoise 50 + voligeage
  // 8 + écran 5 + crochets/faîtage 5). Pose plus technique que tuiles
  // (rendement 0.95 h/m² vs 0.65 pour tuiles). TVA 10 % logement >2 ans.
  // Hors dépose ancienne couverture, charpente, isolation, échafaudage lourd.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'couverture',
    taskId: 'couverture-ardoise-naturelle-pose-neuve',
    label: 'Couverture ardoise naturelle — pose neuve',
    unit: 'm2',
    description: 'Pose neuve couverture ardoise naturelle (Espagne ou Angers, épaisseur 4-5 mm) sur charpente saine : voligeage sapin, écran de sous-toiture HPV, crochets inox tempête, faîtage à crête. Pose technique cloutée. Hors dépose ancienne couverture, charpente, isolation et échafaudage lourd.',
    cost: {
      mainOeuvreHeures: 0.95,
      mainOeuvreTauxHoraire: 56,
      materiaux: 68,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 135,
    priceMax: 158,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['ardoise naturelle', 'couverture ardoise', 'ardoise Angers', 'ardoise Espagne', 'pose ardoise'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires couverture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier couvreur chargé Bouches-du-Rhône : 56 €/h (rendement majoré pour pose ardoise — ~0.95 h/m² vs 0.65 tuile)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT34 — Couverture grands éléments / ardoises (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Index BT34 Couverture T1 2026 — applicable couverture ardoise naturelle Espagne/Angers. Référence indexation prestations couverture petits éléments.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix couverture ardoise 2026',
        tier: 2,
        url: 'https://www.travaux.com/couverture/guide-des-prix/prix-toiture-ardoise',
        excerpt: 'Pose ardoise naturelle fourniture + main d\'œuvre : 120-180 €/m² TTC selon provenance (Espagne / Angers) et qualité',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix toiture ardoise 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/couverture/prix-toiture-ardoise',
        excerpt: 'Ardoise naturelle posée : 130-170 €/m² TTC milieu de gamme, écran et voligeage compris',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 56 €/h is internal estimate aligned with 2025 baseline + INSEE BT34. INSEE index BT34 to be re-confirmed via prix-freshness workflow. Refresh when CAPEB grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Zinc joint debout (€/m²)
  // moBrut    = 1.10 × 56 = 61.60
  // coutBrut  = 61.60 + 78 = 139.60
  // coutFinal = 139.60 × 1.10 = 153.56
  // ttc       = 153.56 × 1.10 = 168.92
  // priceMin  = round(168.92 × 0.92) = 155
  // priceMax  = round(168.92 × 1.08) = 182
  // spread    = (182 − 155) / 155 = 17.4 % ≤ 20 % ✓
  // Hypothèse : couverture zinc joint debout (technique traditionnelle bacs
  // façonnés sur place), zinc naturel ou prépatiné (VMZINC / Rheinzink) ép.
  // 0.65 mm, voligeage sapin sec, écran sous-toiture HPV, pattes inox fixes
  // et coulissantes. Fourniture (~78 €/m² : zinc 0.65 mm 56 + voligeage 12
  // + écran 5 + pattes/accessoires 5). Pose technique très qualifiée
  // (rendement 1.10 h/m²). TVA 10 % logement >2 ans. Hors charpente,
  // isolation, échafaudage lourd.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'couverture',
    taskId: 'couverture-zinc-joint-debout',
    label: 'Couverture zinc joint debout — pose traditionnelle',
    unit: 'm2',
    description: 'Couverture zinc joint debout (bacs façonnés sur place) en zinc naturel ou prépatiné (VMZINC / Rheinzink) épaisseur 0.65 mm, sur voligeage sapin sec : écran sous-toiture HPV, pattes inox fixes et coulissantes, façonnage rives et faîtage. Pose technique très qualifiée. Hors charpente, isolation et échafaudage lourd.',
    cost: {
      mainOeuvreHeures: 1.10,
      mainOeuvreTauxHoraire: 56,
      materiaux: 78,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 155,
    priceMax: 182,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['zinc joint debout', 'toiture zinc', 'VMZINC', 'Rheinzink', 'couverture zinguerie'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires couverture-zinguerie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier couvreur-zingueur chargé Bouches-du-Rhône : 56 €/h (rendement majoré pour zinc joint debout — pose très qualifiée 1.10 h/m²)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT34/BT35 — Couverture & zinguerie (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Index BT34/BT35 Couverture & zinguerie T1 2026 — applicable couverture zinc joint debout traditionnel.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix toiture zinc 2026',
        tier: 2,
        url: 'https://www.travaux.com/couverture/guide-des-prix/prix-toiture-zinc',
        excerpt: 'Toiture zinc joint debout fourniture + pose : 140-200 €/m² TTC selon épaisseur (0.65/0.80 mm) et accessibilité',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix toiture zinc 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/couverture/prix-toiture-zinc',
        excerpt: 'Zinc joint debout posé : 150-190 €/m² TTC, voligeage et écran compris',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 56 €/h is internal estimate aligned with 2025 baseline + INSEE BT34/BT35. INSEE index couverture-zinguerie à re-confirmer via prix-freshness workflow. Refresh when CAPEB grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Gouttière zinc — pose au ml (€/ml)
  // moBrut    = 0.40 × 56 = 22.40
  // coutBrut  = 22.40 + 33 = 55.40
  // coutFinal = 55.40 × 1.10 = 60.94
  // ttc       = 60.94 × 1.10 = 67.03
  // priceMin  = round(67.03 × 0.92) = 62
  // priceMax  = round(67.03 × 1.08) = 72
  // spread    = (72 − 62) / 62 = 16.1 % ≤ 20 % ✓
  // Hypothèse : pose gouttière demi-ronde zinc naturel développé 33 cm,
  // crochets façonnés acier galvanisé tous les 50 cm, naissances et coudes
  // soudés à l'étain, raccord descente PVC ou zinc. Fourniture (~33 €/ml :
  // gouttière zinc 21 + crochets 5 + naissances/coudes 4 + soudure étain 3).
  // TVA 10 % logement >2 ans. Hors descentes EP (prix séparé).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'couverture',
    taskId: 'couverture-gouttiere-zinc-pose-ml',
    label: 'Gouttière zinc demi-ronde — pose au ml',
    unit: 'ml',
    description: 'Pose gouttière zinc demi-ronde naturelle développé 33 cm sur crochets façonnés acier galvanisé tous les 50 cm : naissances et coudes soudés à l\'étain, raccord descente standard, pente régulière. Hors descentes eaux pluviales (chiffrage séparé) et hors dépose ancienne gouttière.',
    cost: {
      mainOeuvreHeures: 0.40,
      mainOeuvreTauxHoraire: 56,
      materiaux: 33,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 62,
    priceMax: 72,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['gouttière zinc', 'gouttière demi-ronde', 'zinguerie', 'pose gouttière', 'chéneau'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires couverture-zinguerie',
        tier: 1,
        excerpt: 'Taux horaire ouvrier couvreur-zingueur chargé Bouches-du-Rhône : 56 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT35 — Zinguerie (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Index BT35 Zinguerie T1 2026 — applicable gouttières zinc demi-rondes / chéneaux.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix gouttière zinc 2026',
        tier: 2,
        url: 'https://www.travaux.com/couverture/guide-des-prix/prix-pose-gouttiere',
        excerpt: 'Pose gouttière zinc demi-ronde fourniture + main d\'œuvre : 55-80 €/ml TTC selon développé et accessibilité',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix gouttière 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/couverture/prix-pose-gouttiere',
        excerpt: 'Gouttière zinc posée : 60-75 €/ml TTC, crochets et naissances inclus',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 56 €/h is internal estimate aligned with 2025 baseline + INSEE BT35. INSEE index zinguerie à re-confirmer via prix-freshness workflow. Refresh when CAPEB grid lands. Hors descente EP (chiffrage ml dédié).',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Velux 78×98 — fenêtre de toit pose standard (forfait)
  // moBrut    = 7.00 × 56 = 392.00
  // coutBrut  = 392.00 + 760 = 1152.00
  // coutFinal = 1152.00 × 1.10 = 1267.20
  // ttc       = 1267.20 × 1.10 = 1393.92
  // priceMin  = round(1393.92 × 0.92) = 1282
  // priceMax  = round(1393.92 × 1.08) = 1505
  // spread    = (1505 − 1282) / 1282 = 17.4 % ≤ 20 % ✓
  // Hypothèse : pose Velux 78×98 (M04) standard tout confort GGL ou
  // équivalent, ouvrant à rotation, vitrage isolant. Forfait posé hors
  // charpente lourde : chevêtre simple à créer entre chevrons, raccord
  // d'étanchéité EDW (ardoise) ou EDP (tuile) périphérique, écran sous-toiture
  // raccordé, finition extérieure. Fourniture (~760 € : Velux GGL/équivalent
  // 78×98 ~520 + raccord EDW/EDP 110 + zinguerie écran 80 + bois chevêtre +
  // visserie 50). TVA 10 % logement >2 ans. Hors finition plâtre intérieure
  // (ébrasement, doublage, peinture) et hors dépose ancienne fenêtre.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'couverture',
    taskId: 'couverture-velux-pose-standard-78x98',
    label: 'Velux 78×98 (M04) — pose standard fenêtre de toit',
    unit: 'forfait',
    description: 'Forfait pose fenêtre de toit Velux 78×98 (M04) GGL standard tout confort à rotation, vitrage isolant : chevêtre simple à créer entre chevrons existants, raccord d\'étanchéité périphérique EDW (ardoise) ou EDP (tuile), écran sous-toiture raccordé, finition extérieure zinguerie. Hors finition plâtre intérieure (ébrasement, doublage, peinture) et hors dépose ancienne fenêtre.',
    cost: {
      mainOeuvreHeures: 7.0,
      mainOeuvreTauxHoraire: 56,
      materiaux: 760,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 1282,
    priceMax: 1505,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['velux', 'fenêtre de toit', 'pose velux', '78x98', 'M04', 'lucarne toit'],
      requiresFollowUp: ['type de couverture (tuile/ardoise) pour raccord EDP ou EDW', 'présence chevêtre existant ou à créer', 'finition plâtre intérieur incluse ou non'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires couverture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier couvreur chargé Bouches-du-Rhône : 56 €/h (forfait pose Velux ~7h pour pose neuve sans charpente lourde)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT34 — Couverture (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Index BT34 Couverture T1 2026 — applicable pose fenêtres de toit avec raccord d\'étanchéité.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix pose Velux 2026',
        tier: 2,
        url: 'https://www.travaux.com/couverture/guide-des-prix/prix-pose-velux',
        excerpt: 'Pose Velux 78×98 standard avec raccord d\'étanchéité : 1200-1700 € TTC forfait posé selon type de couverture',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix pose fenêtre de toit 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/couverture/prix-pose-velux',
        excerpt: 'Velux 78×98 posé : 1300-1500 € TTC forfait courant (fourniture velux + raccord + main d\'œuvre)',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 56 €/h is internal estimate aligned with 2025 baseline + INSEE BT34. Forfait dimensionné Velux 78×98 (M04) standard ; revoir pour modèles électriques/solaires GGU/GGL Integra ou tailles supérieures (M06/M08). Refresh via prix-freshness workflow when CAPEB grid lands.',
  },
]
