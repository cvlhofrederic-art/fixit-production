import type { Recipe } from '../../types'

/**
 * COUVERTURE — audit #07
 *
 * Référentiels FR :
 * - NF DTU 40.21  Tuiles TC à emboîtement ou glissement à relief (rev. 2020)
 * - NF DTU 40.22  Tuiles canal
 * - NF DTU 40.23  Tuiles plates TC
 * - NF DTU 40.24  Tuiles béton à glissement/emboîtement longitudinal
 * - NF DTU 40.11  Ardoises naturelles
 * - NF DTU 40.14  Bardeaux bitumés (shingle)
 * - NF DTU 40.41  Feuilles et bandes métalliques à joint debout (zinc)
 * - NF DTU 40.35  Plaques métalliques nervurées (bac acier)
 * - NF DTU 40.29  Écrans souples de sous-toiture
 *
 * Référentiels PT : NP EN 1304 (tuiles TC), NP EN 490 (tuiles béton),
 *                   NP EN 12326 (ardoises), NP EN 501-514 (zinc/alu/acier)
 *
 * IMPORTANT : la couverture suppose une charpente existante (cf. Trade #06).
 */

export const couvertureRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #7.1 COUVERTURE TUILES TC EMBOÎTEMENT
  // ══════════════════════════════════════════════════════════
  {
    id: 'couv-tuile-tc-emboitement',
    name: 'Couverture tuiles terre cuite à emboîtement',
    description: 'Tuiles TC grand moule (Monier, Imerys, Terreal). Écran sous-toiture HPV + liteaux + contre-liteaux + crochets inox + closoir ventilé.',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 40.21 (Juillet 2020)', title: 'Tuiles TC à emboîtement', section: 'rev. 2020' },
      { code: 'NF DTU 40.29 (Septembre 2017)', title: 'Écrans souples de sous-toiture' },
      { code: 'NF EN 1304 (Octobre 2013)', title: 'Spécifications tuiles TC' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '13 tuiles/m² (hypothèse modèle courant Monier Redland 10 / Imerys Rubis)',
      'Écran HPV (Haute Perméabilité Vapeur) obligatoire avec pente mini réduite',
      'Liteaux bois 27×38 + contre-liteaux 27×27 (bois classe 2 autoclave)',
      'Fixation : 1/3 des tuiles crochetées (plaine), 2/3 zone exposée, 100% crête/bord mer',
      'Closoir ventilé obligatoire au faîtage (écran SC → ventilation DTU 40.29 §7)',
      'Tuiles de rive + tuiles de faîtage à ajouter au linéaire',
      'Solin plomb/alu pour pénétrations (cheminée, VMC) optionnel',
    ],
    materials: [
      // ═══ PRÉPARATION ═══
      {
        id: 'ecran-sous-toit-hpv', name: 'Écran sous-toiture HPV (Delta Maxx / Siplast)',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements 10 cm',
        dtu: 'NF DTU 40.29',
        manufacturerRef: 'Delta Maxx / Siplast / Monarflex',
        packaging: { unit: 'rouleau', contentQty: 75, contentUnit: 'm2', label: 'rouleau 1,50×50 m (75 m²)' },
      },
      {
        id: 'liteau-27-38', name: 'Liteaux bois 27×38 (classe 2 autoclave)',
        category: 'bois', phase: 'preparation', quantityPerBase: 2.85, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + casse',
        dtu: 'NF DTU 40.21 §5.2', normRef: 'NF EN 14081',
        packaging: { unit: 'u', contentQty: 50, contentUnit: 'ml', label: 'botte 50 ml' },
        notes: 'Pureau tuile ≈ 35 cm → 2,85 ml/m².',
      },
      {
        id: 'contre-liteau-27-27', name: 'Contre-liteaux 27×27 (sur chevrons)',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 40.29 §6.2',
        packaging: { unit: 'u', contentQty: 50, contentUnit: 'ml', label: 'botte 50 ml' },
        notes: '1 contre-liteau par chevron (entraxe 60 cm).',
      },
      {
        id: 'clou-galva-3-50', name: 'Clous galvanisés 3×50 (fixation liteaux)',
        category: 'fixation', phase: 'preparation', quantityPerBase: 5.7, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte chantier',
        notes: '2 clous/ml × 2,85 ml/m² ≈ 5,7/m².',
      },
      // ═══ PRINCIPAL ═══
      {
        id: 'tuile-tc-emboitement', name: 'Tuile TC à emboîtement grand moule (10 u/m²)',
        category: 'plaque', phase: 'principal', quantityPerBase: 10.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Casse transport + coupes rives/faîtage',
        dtu: 'NF DTU 40.21', normRef: 'NF EN 1304',
        manufacturerRef: 'Monier Redland 10 / Imerys HP10 / Terreal — 9,9-12 u/m² selon pureau (fiche Imerys HP10)',
        notes: 'Ratio moyen 10,5/m² (Imerys HP10 pureau 388 mm = 10/m² ; pureau réduit 340 mm = 12/m²).',
        packaging: { unit: 'u', contentQty: 240, contentUnit: 'u', label: 'palette 240 tuiles' },
      },
      // ═══ ACCESSOIRES ═══
      {
        id: 'crochet-tuile-inox', name: 'Crochets/pattes de tuile inox A2',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3.5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte chantier',
        dtu: 'NF DTU 40.21 §5.3',
        packaging: { unit: 'u', contentQty: 500, contentUnit: 'u', label: 'boîte 500 crochets' },
        notes: '1 tuile sur 3 fixée × 10,5 tuiles/m² ≈ 3,5/m² (plaine). Zones exposées : majorer.',
      },
      // ═══ ACCESSOIRES RIVES / FAÎTAGE (ajout audit Lot C) ═══
      {
        id: 'tuile-rive-tc', name: 'Tuile de rive (bord de toit — latérale)',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 0.15, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 40.21 §5.4',
        manufacturerRef: 'Monier / Imerys / Terreal',
        notes: 'Ratio 0,15/m² (≈ 3 tuiles/ml de rive × 5 ml rive / 100 m²).',
      },
      {
        id: 'tuile-faitage-tc', name: 'Tuile de faîtage + closoir ventilé',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 0.1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Coupes',
        dtu: 'NF DTU 40.21 §7',
        manufacturerRef: 'Monier / Imerys / Terreal',
        notes: 'Ratio 0,1/m² (≈ 2,5 tuiles/ml faîtage × 4 ml / 100 m²).',
      },
      {
        id: 'closoir-ventile-faitage', name: 'Closoir ventilé faîtage (rouleau alu/butyl)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 0.04, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 40.29 §7 (Septembre 2017)',
        manufacturerRef: 'Onduline Figaro / Siplast Kat\'Up',
        packaging: { unit: 'rouleau', contentQty: 5, contentUnit: 'ml', label: 'rouleau 5 ml × 30 cm' },
        notes: 'Obligatoire avec écran HPV (ventilation sous faîtage).',
      },
      {
        id: 'bande-rive-alu', name: 'Bande de rive alu laqué (finition latérale)',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 0.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + recouvrements',
        dtu: 'NF DTU 40.21 §5.4',
        manufacturerRef: 'Dani Alu / Alprofils',
        notes: 'Ratio 0,05 ml/m² (rives seulement — exclut pignons).',
      },
      {
        id: 'volige-rive-sapin-22', name: 'Volige sapin 22 mm (bord de toit)',
        category: 'bois', phase: 'preparation', quantityPerBase: 0.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes aux angles',
        dtu: 'NF DTU 40.21 §5.4',
        notes: 'Planches rigides supportant bande rive + tuile rive.',
      },
      {
        id: 'chatiere-ventilation-tuile', name: 'Chatière ventilation toiture (1 u / 50 m²)',
        category: 'plaque', phase: 'accessoires', quantityPerBase: 0.02, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 40.29 §7',
        manufacturerRef: 'Monier / Imerys (adaptée modèle tuile)',
        notes: '1 chatière/50 m² pour ventilation comble (si VMC simple flux).',
      },
      // ═══ OPTIONS (solins, fenêtres de toit, etc.) ═══
      {
        id: 'solin-plomb-penetration', name: 'Solin plomb/alu (pénétration cheminée, VMC)',
        category: 'etancheite', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        dtu: 'NF DTU 40.41 (Février 2023)',
        manufacturerRef: 'Umicore VMZinc / Dani Alu',
        optional: true, condition: 'Si cheminée, sortie VMC, conduit gaz ou VMR',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #7.2 COUVERTURE TUILES BÉTON
  // ══════════════════════════════════════════════════════════
  {
    id: 'couv-tuile-beton',
    name: 'Couverture tuiles béton (Monier Tegalit / Imerys Beauvoise)',
    description: 'Tuiles béton grand format (10 u/m²). Plus résistantes au transport que TC (pertes 3% vs 5%). Charpente à valider pour surcharge.',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 40.24 (Mai 2006 + A1 2020)', title: 'Tuiles béton à glissement/emboîtement' },
      { code: 'NF EN 490+A1 (Mars 2018)', title: 'Spécifications tuiles béton' },
      { code: 'NF DTU 40.29 (Septembre 2017)', title: 'Écrans souples sous-toiture' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '10 tuiles béton/m² (grand format vs 13 pour TC)',
      'Pertes tuiles 3% (plus résistantes au transport que TC)',
      'Poids plus élevé → vérifier charpente avant installation (descente de charges)',
      'Idem TC pour écran + liteaux + contre-liteaux + crochets',
    ],
    materials: [
      {
        id: 'ecran-sous-toit-hpv', name: 'Écran sous-toiture HPV',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements', dtu: 'NF DTU 40.29',
        packaging: { unit: 'rouleau', contentQty: 75, contentUnit: 'm2', label: 'rouleau 75 m²' },
      },
      {
        id: 'liteau-27-38', name: 'Liteaux bois 27×38',
        category: 'bois', phase: 'preparation', quantityPerBase: 2.85, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes', dtu: 'NF DTU 40.24 §5',
        packaging: { unit: 'u', contentQty: 50, contentUnit: 'ml', label: 'botte 50 ml' },
      },
      {
        id: 'contre-liteau-27-27', name: 'Contre-liteaux 27×27',
        category: 'bois', phase: 'preparation', quantityPerBase: 1.67, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes', dtu: 'NF DTU 40.29 §6.2',
        packaging: { unit: 'u', contentQty: 50, contentUnit: 'ml', label: 'botte 50 ml' },
      },
      {
        id: 'clou-galva-3-50', name: 'Clous galvanisés 3×50',
        category: 'fixation', phase: 'preparation', quantityPerBase: 5.7, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
      },
      {
        id: 'tuile-beton', name: 'Tuile béton à emboîtement longitudinal',
        category: 'plaque', phase: 'principal', quantityPerBase: 10, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.03, wasteReason: 'Casse transport (tuile béton résistante)',
        dtu: 'NF DTU 40.24', normRef: 'NF EN 490',
        manufacturerRef: 'Monier Tegalit / Imerys Beauvoise',
        packaging: { unit: 'u', contentQty: 240, contentUnit: 'u', label: 'palette 240 tuiles' },
      },
      {
        id: 'crochet-tuile-inox', name: 'Crochets tuile inox A2',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 3.3, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        dtu: 'NF DTU 40.24', notes: '1/3 des tuiles fixées × 10/m² ≈ 3,3/m².',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #7.3 COUVERTURE ARDOISE NATURELLE
  // ══════════════════════════════════════════════════════════
  {
    id: 'couv-ardoise-naturelle',
    name: 'Couverture ardoise naturelle (pose au crochet)',
    description: 'Ardoise 22×32 ou 24×40. Pose crochetée sur voliges + liteaux. Pente mini 22° (DTU 40.11).',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 40.11 (Mai 1993 + A2 2021)', title: 'Couverture en ardoises naturelles' },
      { code: 'NF EN 12326-1 (Septembre 2014)', title: 'Spécifications ardoises' },
    ],
    version: '2.1.0',
    constraints: { note: 'Pente minimum 22° (DTU 40.11 §4.3).' },
    hypothesesACommuniquer: [
      'Ardoise 32×22 (format courant) — ~28 ardoises/m² à pureau 12 cm',
      'Pertes 15-20% (fragile, coupes précises rives/faîtage)',
      'Pose au crochet inox A2 — A4 (316L) en bord de mer',
      '2 crochets par ardoise (56 crochets/m²)',
      'Écran HPV obligatoire, liteaux ou voliges jointives selon technique pose',
      'Closoir plomb faîtage + solins plomb aux pénétrations',
    ],
    materials: [
      {
        id: 'ecran-sous-toit-hpv', name: 'Écran sous-toiture HPV',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements', dtu: 'NF DTU 40.29',
        packaging: { unit: 'rouleau', contentQty: 75, contentUnit: 'm2', label: 'rouleau 75 m²' },
      },
      {
        id: 'liteau-ardoise', name: 'Liteaux bois 27×38 (classe 2)',
        category: 'bois', phase: 'preparation', quantityPerBase: 8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes', dtu: 'NF DTU 40.11',
        packaging: { unit: 'u', contentQty: 50, contentUnit: 'ml', label: 'botte 50 ml' },
        notes: 'Pureau 12 cm → liteaux tous les ~18 cm → 8 ml/m².',
      },
      {
        id: 'ardoise-naturelle-32-22', name: 'Ardoise naturelle 32×22 (Cupa / Strongslate)',
        category: 'plaque', phase: 'principal', quantityPerBase: 28, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.18, wasteReason: 'Coupes précises (18% — fragile)',
        dtu: 'NF DTU 40.11', normRef: 'NF EN 12326',
        manufacturerRef: 'Cupa Pizarras R12/H12',
      },
      {
        id: 'crochet-ardoise-inox', name: 'Crochets ardoise inox A2 (ou A4 bord de mer)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 56, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        dtu: 'NF DTU 40.11',
        packaging: { unit: 'u', contentQty: 1000, contentUnit: 'u', label: 'boîte 1000 crochets' },
        notes: '2 crochets par ardoise × 28/m² = 56/m².',
      },
      {
        id: 'clou-cuivre-ardoise', name: 'Clous cuivre (bord bas + tête de pan)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte + rebut',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #7.4 COUVERTURE ZINC JOINT DEBOUT
  // ══════════════════════════════════════════════════════════
  {
    id: 'couv-zinc-joint-debout',
    name: 'Couverture zinc joint debout (VMZINC / RHEINZINK)',
    description: 'Bande zinc pré-patiné sur voligeage continu. Pattes coulissantes + fixes pour dilatation.',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 40.41 (Février 2023)', title: 'Couverture zinc à joint debout' },
      { code: 'NF EN 988 (Septembre 1996)', title: 'Spécifications zinc' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bande zinc prépatiné ép. 0,65 mm (0,8 mm toitures >30° exposées)',
      'Largeur bande 50 cm + joint debout → ratio 1,15 m² zinc / m² couverture (+15%)',
      'Voliges jointives bois classe 2, épaisseur 18-22 mm, support continu',
      'Écran anti-bruit/anti-condensation obligatoire (Delta-Trela)',
      'Pattes fixes (1 toutes les 15 cm) + pattes coulissantes (dilatation)',
      'Soudure étain pour assemblages spéciaux (larmiers, habillages)',
    ],
    materials: [
      {
        id: 'voliges-bois', name: 'Voliges bois jointives 18-22 mm (classe 2)',
        category: 'bois', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes', dtu: 'NF DTU 40.41 §5.2',
      },
      {
        id: 'ecran-anti-condensation', name: 'Écran anti-bruit / anti-condensation',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        manufacturerRef: 'Delta-Trela',
      },
      {
        id: 'bande-zinc-065', name: 'Bande zinc prépatiné 0,65 mm (VMZINC)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.15, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Chutes + pliures joint debout',
        dtu: 'NF DTU 40.41', normRef: 'NF EN 988',
        manufacturerRef: 'VMZinc / RheinZink / Umicore',
      },
      {
        id: 'patte-zinc', name: 'Pattes zinc (fixes + coulissantes)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 6, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        dtu: 'NF DTU 40.41',
      },
      {
        id: 'etain-soudure-zinc', name: 'Étain soudure zinc',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 0.02, unit: 'kg', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #7.5 COUVERTURE BAC ACIER NERVURÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'couv-bac-acier',
    name: 'Couverture bac acier nervuré (ArcelorMittal Hacierplus)',
    description: 'Plaques nervurées acier prélaqué. Pose rapide pour hangars, appentis, abris.',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 40.35 (Août 2018)', title: 'Plaques nervurées métalliques' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Bac acier 39/333 ou 63/750 (nervure × largeur utile)',
      'Pas d\'écran sous-toiture si bac anti-condensation (feutre sur intrados)',
      'Vis autoforeuses + rondelles EPDM : 6-8/m²',
      'Closoirs mousse en faîtage + rives',
      'Cornières faîtière + rives en longueur périmétrique',
    ],
    materials: [
      {
        id: 'bac-acier-prelaque', name: 'Bac acier prélaqué nervuré (ArcelorMittal Hacierplus)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.05, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.05, wasteReason: 'Recouvrements latéraux',
        dtu: 'NF DTU 40.35',
        manufacturerRef: 'ArcelorMittal Hacierplus / Trilobe',
      },
      {
        id: 'vis-autoforeuse-epdm', name: 'Vis autoforeuse + rondelle EPDM',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 7, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        dtu: 'NF DTU 40.35',
      },
      {
        id: 'closoir-mousse-bac', name: 'Closoir mousse (faîtage + rives)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.2, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'corniere-faitiere-bac', name: 'Cornière faîtière bac acier',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 0.1, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'bande-solin-bac', name: 'Bande de solin (raccord mur)',
        category: 'accessoire', phase: 'finitions', quantityPerBase: 0.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        optional: true,
        condition: 'Si couverture adjacente à un mur',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #7.6 COUVERTURE SHINGLE / BARDEAU BITUMÉ
  // ══════════════════════════════════════════════════════════
  {
    id: 'couv-shingle',
    name: 'Couverture bardeau bitumé / shingle',
    description: 'Bardeaux bitumés (IKO Armourshield / GAF Timberline) sur voliges jointives. Typique abri de jardin, garage, véranda.',
    trade: 'couverture',
    baseUnit: 'm2',
    geometryMode: 'area',
    dtuReferences: [
      { code: 'NF DTU 40.14 (Mai 1993)', title: 'Couverture en bardeaux bitumés' },
      { code: 'NF EN 544+A1 (Mai 2011)', title: 'Spécifications bardeaux' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Support obligatoire : voligeage jointif bois (pas de liteaux)',
      'Feutre bitumé 36S en sous-couche',
      'Pertes 10% (recouvrements + arrondis)',
      '4 clous tête large par bardeau ≈ 20 clous/m²',
      'Colle bitumineuse pour scellement (chaud/soleil naturel)',
      'Bardeau de faîtage spécifique au linéaire',
    ],
    materials: [
      {
        id: 'voliges-shingle', name: 'Voliges bois jointives (support continu)',
        category: 'bois', phase: 'preparation', quantityPerBase: 1, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        dtu: 'NF DTU 40.14',
      },
      {
        id: 'feutre-bitume-36s', name: 'Feutre bitumé 36S sous-couche',
        category: 'etancheite', phase: 'preparation', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements',
        dtu: 'NF DTU 40.14',
      },
      {
        id: 'bardeau-bitume', name: 'Bardeau bitumé (IKO Armourshield / GAF Timberline)',
        category: 'plaque', phase: 'principal', quantityPerBase: 1.10, unit: 'm2', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Recouvrements + arrondis',
        dtu: 'NF DTU 40.14', normRef: 'NF EN 544',
        manufacturerRef: 'IKO / GAF / Onduline',
      },
      {
        id: 'clou-galva-tete-large', name: 'Clous galva tête large (fixation bardeaux)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 20, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Perte',
        notes: '4 clous × ~5 bardeaux/m² = 20/m².',
      },
      {
        id: 'colle-bitume-shingle', name: 'Colle bitumineuse (scellement)',
        category: 'colle', phase: 'accessoires', quantityPerBase: 0.05, unit: 'L', geometryMultiplier: 'none',
        wasteFactor: 1.15, wasteReason: 'Purge cartouche',
      },
      {
        id: 'bardeau-faitage', name: 'Bardeau de faîtage',
        category: 'plaque', phase: 'principal', quantityPerBase: 0.05, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
        notes: '1 bardeau/ml de faîtage au linéaire.',
      },
    ],
  },
]
