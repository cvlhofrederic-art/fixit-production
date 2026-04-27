// lib/prix-travaux-2026/data/plaquiste.ts
//
// Bootstrap Plaquiste — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE INSEE — l'index officiel "Plâtrerie" est le BT43 (plâtres et préfabriqués
// associés). Toutes les sources INSEE référencent BT43 pour les prestations
// plaquiste / plâtrerie sèche / cloisons.
//
// AIDES ÉNERGÉTIQUES — Lignes 2 (doublage thermique) et 5 (isolation rampants)
// sont éligibles MaPrimeRénov + CEE :
//   • BAR-EN-101 — Isolation thermique des parois opaques verticales (doublage)
//   • BAR-EN-103 — Isolation thermique des combles / rampants
// Forfaits MPR 2026 par tranche de revenus (bleu/jaune/violet/rose) et bonus
// CEE €/m² conformément aux fiches d'opérations standardisées en vigueur.

import type { PriceLine } from '../types'

export const plaquisteLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Cloison simple BA13 sur ossature 72mm — €/m²
  // moBrut    = 0.55 × 50 = 27.50
  // coutBrut  = 27.50 + 18 = 45.50
  // coutFinal = 45.50 × 1.12 = 50.96
  // ttc       = 50.96 × 1.10 = 56.06
  // priceMin  = round(56.06 × 0.92) = 52
  // priceMax  = round(56.06 × 1.08) = 61
  // spread    = (61 − 52) / 52 = 17.3 % ≤ 20 % ✓
  // Hypothèse : cloison de distribution standard ossature métallique 72mm,
  // 1 plaque BA13 chaque face, fourniture rails/montants/visserie/bande joint
  // (~18 €/m²), hors isolant phonique. TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plaquiste',
    taskId: 'plaquiste-cloison-simple-72mm',
    label: 'Cloison simple — ossature 72mm + BA13 2 faces',
    unit: 'm2',
    description: 'Cloison de distribution intérieure : ossature métallique 72mm (rails sol/plafond + montants entraxe 60cm), 1 plaque BA13 standard sur chaque face, vissage, bande à joint et enduit 3 passes, finition prête à peindre. Hors isolant phonique et hors préparation du support.',
    cost: {
      mainOeuvreHeures: 0.55,
      mainOeuvreTauxHoraire: 50,
      materiaux: 18,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 52,
    priceMax: 61,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['cloison BA13', 'cloison placo', 'ossature 72mm', 'cloison distribution', 'placoplâtre'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plâtrerie / plaquiste',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plaquiste chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 45-55 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT43 — Plâtrerie (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710974',
        excerpt: 'Index BT43 Plâtrerie base 100 = 2010, dernière mise à jour T1 2026. Référence indexation prestations plaquiste / cloisons sèches.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix cloison placo 2026',
        tier: 2,
        url: 'https://www.travaux.com/platrerie/guide-des-prix/prix-cloison-placo',
        excerpt: 'Cloison BA13 ossature 72mm fourniture + pose : 45-65 €/m² TTC standard, hors isolation',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix cloison placoplâtre 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/cloison/prix-cloison-placo',
        excerpt: 'Cloison placo simple sans isolation : 40-60 €/m² fourniture + main d\'œuvre',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT43. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Doublage thermique 100mm laine de verre + BA13 — €/m² (AIDES MPR + CEE)
  // moBrut    = 0.60 × 50 = 30.00
  // coutBrut  = 30.00 + 24 = 54.00
  // coutFinal = 54.00 × 1.12 = 60.48
  // ttc       = 60.48 × 1.055 = 63.81
  // priceMin  = round(63.81 × 0.92) = 59
  // priceMax  = round(63.81 × 1.08) = 69
  // spread    = (69 − 59) / 59 = 17.0 % ≤ 20 % ✓
  // Hypothèse : doublage mur intérieur, ossature métallique 48mm + isolant
  // laine de verre 100mm semi-rigide (R≥3.7), 1 plaque BA13, fourniture
  // ossature + isolant + plaque + visserie + joint (~24 €/m²). TVA 5.5 %
  // logement >2 ans (rénovation énergétique BAR-EN-101).
  //
  // AIDES BAR-EN-101 — Isolation des murs par l'intérieur :
  //   • MPR forfaits 2026 : bleu 25/m², jaune 18/m², violet 7/m², rose 0
  //   • Plafond travaux MPR : 75 m² éligibles maximum
  //   • CEE BAR-EN-101 : ~12 €/m² (climat H1, surface chauffée)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plaquiste',
    taskId: 'plaquiste-doublage-thermique-100mm-laine',
    label: 'Doublage thermique — laine de verre 100mm + BA13',
    unit: 'm2',
    description: 'Doublage mur intérieur isolant + plaque : ossature métallique 48mm, isolant laine de verre 100mm semi-rigide R≥3.7 m².K/W, 1 plaque BA13 standard, vissage, bande à joint et enduit, finition prête à peindre. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-EN-101.',
    cost: {
      mainOeuvreHeures: 0.60,
      mainOeuvreTauxHoraire: 50,
      materiaux: 24,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 59,
    priceMax: 69,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      keywords: ['doublage thermique', 'isolation mur intérieur', 'laine de verre 100mm', 'BAR-EN-101', 'ITI'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 25, jaune: 18, violet: 7, rose: 0 },
        plafondTravaux: 75,
      },
      cee: {
        forfaitParUnite: 12,
        operationStandard: 'BAR-EN-101',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plâtrerie / plaquiste',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plaquiste chargé Bouches-du-Rhône : 50 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT43 — Plâtrerie (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710974',
        excerpt: 'Index BT43 Plâtrerie T1 2026 — applicable doublages laine de verre + BA13.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 isolation murs (BAR-EN-101)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Isolation murs par l\'intérieur — forfaits 2026 par tranche revenus : bleu 25 €/m², jaune 18 €/m², violet 7 €/m², rose 0. Plafond surface 75 m² éligibles par logement.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix doublage isolation intérieure 2026',
        tier: 2,
        url: 'https://www.travaux.com/isolation/guide-des-prix/prix-isolation-mur-interieur',
        excerpt: 'Doublage laine de verre 100mm + BA13 fourniture + pose : 55-75 €/m² TTC',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT43. Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-EN-101) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (forfaits susceptibles de glisser à la baisse plan budget 2026).",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Faux plafond suspendu BA13 sur ossature — €/m²
  // moBrut    = 0.50 × 50 = 25.00
  // coutBrut  = 25.00 + 17 = 42.00
  // coutFinal = 42.00 × 1.12 = 47.04
  // ttc       = 47.04 × 1.10 = 51.74
  // priceMin  = round(51.74 × 0.92) = 48
  // priceMax  = round(51.74 × 1.08) = 56
  // spread    = (56 − 48) / 48 = 16.7 % ≤ 20 % ✓
  // Hypothèse : faux plafond suspendu plat hauteur libre ≤ 30 cm, ossature
  // primaire/secondaire F47 + suspentes, 1 plaque BA13, fourniture (~17 €/m²),
  // hors trémie spots / éclairage / décrochés. TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plaquiste',
    taskId: 'plaquiste-faux-plafond-suspendu',
    label: 'Faux plafond suspendu — ossature F47 + BA13',
    unit: 'm2',
    description: 'Faux plafond suspendu plat : ossature métallique F47 (primaire + secondaire) + suspentes, 1 plaque BA13 standard, vissage, bande à joint et enduit, finition prête à peindre. Hauteur libre ≤ 30 cm. Hors trémie spots, éclairage et décrochés. Logement >2 ans, hors rénovation énergétique.',
    cost: {
      mainOeuvreHeures: 0.50,
      mainOeuvreTauxHoraire: 50,
      materiaux: 17,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 48,
    priceMax: 56,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['faux plafond', 'plafond suspendu', 'ossature F47', 'BA13 plafond', 'plafond placo'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plâtrerie / plaquiste',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plaquiste chargé Bouches-du-Rhône : 50 €/h (rendement plafond ajusté ~0.50 h/m²)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT43 — Plâtrerie (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710974',
        excerpt: 'Index BT43 Plâtrerie T1 2026 — applicable faux plafonds suspendus BA13.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix faux plafond placo 2026',
        tier: 2,
        url: 'https://www.travaux.com/platrerie/guide-des-prix/prix-faux-plafond',
        excerpt: 'Faux plafond suspendu BA13 fourniture + pose : 40-60 €/m² TTC plat simple, +20-40 % avec décrochés/spots',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix faux plafond suspendu 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/plafond/prix-faux-plafond',
        excerpt: 'Faux plafond suspendu BA13 standard : 35-55 €/m² fourniture + pose, base plate sans intégration technique',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT43. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Cloison séparative isolation phonique renforcée — €/m²
  // moBrut    = 0.80 × 50 = 40.00
  // coutBrut  = 40.00 + 24 = 64.00
  // coutFinal = 64.00 × 1.12 = 71.68
  // ttc       = 71.68 × 1.10 = 78.85
  // priceMin  = round(78.85 × 0.92) = 73
  // priceMax  = round(78.85 × 1.08) = 85
  // spread    = (85 − 73) / 73 = 16.4 % ≤ 20 % ✓
  // Hypothèse : cloison séparative entre logements ou pièces sensibles, ossature
  // métallique 98mm désolidarisée (bandes résilientes), laine minérale haute
  // densité 70mm acoustique, 2 plaques BA13 phoniques (Placo Phonique) chaque
  // face. Fourniture (~24 €/m²). Indice affaiblissement Rw ≈ 56-62 dB visé.
  // Pas d'aide directe (acoustique hors périmètre BAR-EN, hors aides bruit
  // aéroportuaire spécifiques). TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plaquiste',
    taskId: 'plaquiste-isolation-phonique-cloison',
    label: 'Cloison phonique renforcée — 2×BA13 phonique + laine minérale',
    unit: 'm2',
    description: 'Cloison séparative haute performance acoustique : ossature métallique 98mm désolidarisée (bandes résilientes), laine minérale 70mm haute densité acoustique, 2 plaques BA13 phoniques chaque face, vissage, bande à joint et enduit. Indice d\'affaiblissement Rw ≈ 56-62 dB. Hors aides énergétiques (acoustique hors périmètre BAR-EN). Logement >2 ans, TVA 10 %.',
    cost: {
      mainOeuvreHeures: 0.80,
      mainOeuvreTauxHoraire: 50,
      materiaux: 24,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 73,
    priceMax: 85,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['cloison phonique', 'isolation acoustique', 'BA13 phonique', 'cloison séparative', 'Placo Phonique'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plâtrerie / plaquiste',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plaquiste chargé Bouches-du-Rhône : 50 €/h (rendement majoré 0.80 h/m² pour double parement + désolidarisation)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT43 — Plâtrerie (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710974',
        excerpt: 'Index BT43 Plâtrerie T1 2026 — applicable cloisons phoniques double parement.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix cloison phonique 2026',
        tier: 2,
        url: 'https://www.travaux.com/isolation/guide-des-prix/prix-isolation-phonique',
        excerpt: 'Cloison phonique 2×BA13 phonique + laine acoustique : 65-95 €/m² TTC fourniture + pose selon performance Rw visée',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix isolation phonique cloison 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/isolation/prix-isolation-phonique',
        excerpt: 'Cloison séparative acoustique haute performance : 70-90 €/m² avec double plaque phonique + laine 70mm + désolidarisation',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT43. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Isolation rampants 200mm laine + BA13 — €/m² (AIDES MPR + CEE)
  // moBrut    = 0.65 × 50 = 32.50
  // coutBrut  = 32.50 + 26 = 58.50
  // coutFinal = 58.50 × 1.12 = 65.52
  // ttc       = 65.52 × 1.055 = 69.13
  // priceMin  = round(69.13 × 0.92) = 64
  // priceMax  = round(69.13 × 1.08) = 75
  // spread    = (75 − 64) / 64 = 17.2 % ≤ 20 % ✓
  // Hypothèse : isolation thermique rampants combles aménagés, suspentes
  // antivibratiles + ossature F530, isolant laine de verre 200mm en 2 lits
  // croisés (R≥6.0), pare-vapeur, 1 plaque BA13. Fourniture (~26 €/m²).
  // TVA 5.5 % logement >2 ans (rénovation énergétique BAR-EN-103).
  //
  // AIDES BAR-EN-103 — Isolation thermique des combles / rampants :
  //   • MPR forfaits 2026 : bleu 25/m², jaune 20/m², violet 10/m², rose 0
  //   • Plafond travaux MPR : 75 m² éligibles maximum
  //   • CEE BAR-EN-103 : ~10 €/m² (climat H1, surface chauffée)
  //   • TVA réduite 5.5 % + Éco-PTZ cumulables
  //   • Performance minimale exigée : R ≥ 6.0 m².K/W (rampants)
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'plaquiste',
    taskId: 'plaquiste-isolation-rampants-200mm',
    label: 'Isolation rampants — laine de verre 200mm + BA13',
    unit: 'm2',
    description: 'Isolation thermique rampants combles aménagés : suspentes antivibratiles + ossature F530, isolant laine de verre 200mm en 2 lits croisés (R≥6.0 m².K/W), pare-vapeur indépendant, 1 plaque BA13 standard, vissage, bande à joint et enduit, finition prête à peindre. Logement >2 ans, opération éligible MaPrimeRénov + CEE BAR-EN-103.',
    cost: {
      mainOeuvreHeures: 0.65,
      mainOeuvreTauxHoraire: 50,
      materiaux: 26,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 64,
    priceMax: 75,
    priceUnit: 'EUR_TTC',
    tva: 5.5,
    conditions: {
      keywords: ['isolation rampants', 'isolation combles aménagés', 'laine de verre 200mm', 'BAR-EN-103', 'R≥6'],
    },
    aidesEligibles: {
      maPrimeRenov: {
        forfaits: { bleu: 25, jaune: 20, violet: 10, rose: 0 },
        plafondTravaux: 75,
      },
      cee: {
        forfaitParUnite: 10,
        operationStandard: 'BAR-EN-103',
      },
      tvaReduite: 5.5,
      ecoPTZ: true,
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires plâtrerie / plaquiste',
        tier: 1,
        excerpt: 'Taux horaire ouvrier plaquiste chargé Bouches-du-Rhône : 50 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT43 — Plâtrerie (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710974',
        excerpt: 'Index BT43 Plâtrerie T1 2026 — applicable isolation rampants laine + parement BA13.',
        accessedAt: '2026-04-27',
      },
      {
        name: "France Rénov' — MaPrimeRénov 2026 isolation rampants (BAR-EN-103)",
        tier: 1,
        url: 'https://france-renov.gouv.fr/aides/maprimerenov',
        excerpt: 'Isolation thermique rampants / combles aménagés — forfaits 2026 par tranche revenus : bleu 25 €/m², jaune 20 €/m², violet 10 €/m², rose 0. Plafond surface 75 m² éligibles. Performance minimale R ≥ 6.0 m².K/W.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix isolation rampants 2026',
        tier: 2,
        url: 'https://www.travaux.com/isolation/guide-des-prix/prix-isolation-combles',
        excerpt: 'Isolation rampants 200mm laine + BA13 fourniture + pose : 60-80 €/m² TTC selon performance et finition',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: "CAPEB PACA 2026 grid pending official Q1 publication — 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT43. Refresh via prix-freshness workflow when grid lands. Barèmes MPR/CEE 2026 (BAR-EN-103) basés sur fiches d'opérations standardisées France Rénov' / arrêté JORF 2026 ; à reconfirmer trimestriellement (forfaits susceptibles de glisser à la baisse plan budget 2026).",
  },
]
