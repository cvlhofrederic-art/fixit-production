import type { Recipe } from '../types'

/**
 * CLIMATISATION — audit #20
 *
 * Référentiels FR :
 * - NF EN 378      Systèmes frigorifiques et PAC (sécurité fluide)
 * - Certification F-Gaz (obligatoire technicien — fluide frigorigène)
 * - NF EN 1363-3   Performance climatisation
 * - NF C 15-100    Raccordement électrique
 *
 * IMPORTANT :
 * - Fluide R32 depuis 2020 (remplace R410A)
 * - Certification F-Gaz obligatoire pour installateur
 */

export const climatisationRecipes: Recipe[] = [

  // ══════════════════════════════════════════════════════════
  //  #20.1 SPLIT MURAL MONO (1 pièce)
  // ══════════════════════════════════════════════════════════
  {
    id: 'clim-split-mural-mono',
    name: 'Climatisation split mural mono (3,5 kW)',
    description: 'Unité intérieure murale + unité extérieure + liaisons frigorifiques + câble de liaison + évacuation condensats.',
    trade: 'climatisation',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 378', title: 'Systèmes frigorifiques et PAC (sécurité fluide)' },
      { code: 'F-Gaz', title: 'Certification technicien obligatoire' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = 1 split mono (1 UI + 1 UE) pour 1 pièce',
      'Puissance 2,5 / 3,5 / 5 kW selon volume pièce',
      'Fluide R32 (depuis 2020 — remplace R410A phasé)',
      'Liaisons frigorifiques cuivre isolé (aller + retour) : 5 ml standard',
      'Câble de liaison 4 brins + terre (entre UI et UE)',
      'Support mural UE (consoles anti-vibrations)',
      'Bac évacuation condensats + tube PVC',
      'Carottage mur étanche pour traversée',
      'Disjoncteur + câblage 230 V dédié au tableau',
      'Attestation fluide F-Gaz obligatoire après installation',
    ],
    materials: [
      {
        id: 'ui-split-mural-35', name: 'Unité intérieure murale 3,5 kW R32',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
        manufacturerRef: 'Daikin Emura / Mitsubishi MSZ / Panasonic Etherea',
      },
      {
        id: 'ue-split-35', name: 'Unité extérieure 3,5 kW R32',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'liaison-frigo-couronne', name: 'Liaisons frigorifiques cuivre isolé (couronne pré-isolée)',
        category: 'plaque', phase: 'principal', quantityPerBase: 10, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes + raccords',
      },
      {
        id: 'cable-liaison-clim', name: 'Câble liaison (4 brins + terre) entre UI et UE',
        category: 'plaque', phase: 'principal', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'support-mural-ue', name: 'Support mural UE (consoles anti-vibrations)',
        category: 'fixation', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'bac-condensats-clim', name: 'Bac évacuation condensats + tube PVC Ø32',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'passage-mur-etanche', name: 'Passage mur étanche (carottage + étanchéité)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Kit',
      },
      {
        id: 'disjoncteur-clim', name: 'Disjoncteur dédié (230 V au tableau) + câblage',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #20.2 CLIMATISATION GAINABLE
  // ══════════════════════════════════════════════════════════
  {
    id: 'clim-gainable',
    name: 'Climatisation gainable (UI faux-plafond + gaines distribution)',
    description: 'Installation multi-pièces par réseau de gaines. Une UE + une UI gainable + bouches soufflage/reprise.',
    trade: 'climatisation',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 378', title: 'Sécurité fluide frigo' },
      { code: 'F-Gaz', title: 'Certification' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      '1 unité = installation gainable T4 complète (4 pièces)',
      'Unité intérieure encastrée en faux-plafond',
      'Unité extérieure 8-14 kW selon surface',
      'Gaines isolées flexibles (2 circuits : soufflage + reprise)',
      '4 bouches soufflage (1 par pièce) + 2 bouches reprise centralisées',
      'Plénum modulaire + regard visite filtres',
      'Thermostat central + thermostats secondaires par pièce',
    ],
    materials: [
      {
        id: 'ui-gainable', name: 'Unité intérieure gainable (faux-plafond)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'ue-gainable-10kw', name: 'Unité extérieure 10 kW R32',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'liaison-frigo-gainable', name: 'Liaisons frigorifiques cuivre isolé',
        category: 'plaque', phase: 'principal', quantityPerBase: 15, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'gaine-isolee-flex-clim', name: 'Gaines isolées flexibles (distribution)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 20, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'bouche-soufflage-clim', name: 'Bouches soufflage (1 par pièce)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 4, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'bouche-reprise-clim', name: 'Bouches reprise (centralisées)',
        category: 'accessoire', phase: 'principal', quantityPerBase: 2, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'plenum-modulaire', name: 'Plénum modulaire',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'regard-filtre-clim', name: 'Regard visite filtres (accès maintenance)',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'thermostat-central-clim', name: 'Thermostat central + thermostats par pièce',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'evac-condensats-clim-gainable', name: 'Évacuation condensats PVC',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 5, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  #20.3 CLIMATISATION CASSETTE (plafond)
  // ══════════════════════════════════════════════════════════
  {
    id: 'clim-cassette-plafond',
    name: 'Climatisation cassette plafond 4 voies (bureau standard)',
    description: 'Cassette encastrée faux-plafond, soufflage 4 voies, dimension standard 60×60 cm (dalle modulaire).',
    trade: 'climatisation',
    baseUnit: 'u',
    geometryMode: 'count',
    dtuReferences: [
      { code: 'NF EN 378', title: 'Sécurité fluide' },
    ],
    version: '2.1.0',
    hypothesesACommuniquer: [
      'Cassette 60×60 cm (format dalle plafond modulaire standard)',
      'Soufflage 4 voies (meilleure répartition)',
      'Puissance 3,5-5 kW (bureau / local 20-30 m²)',
      'Liaisons frigorifiques + câble liaison standard',
      'Découpe plafond 60×60 cm + cadre finition',
    ],
    materials: [
      {
        id: 'cassette-clim-4voies', name: 'Cassette climatisation 4 voies 60×60',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'ue-cassette', name: 'Unité extérieure dédiée',
        category: 'accessoire', phase: 'principal', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'liaison-frigo-cassette', name: 'Liaisons frigorifiques + câble liaison',
        category: 'plaque', phase: 'principal', quantityPerBase: 8, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'cadre-finition-cassette', name: 'Cadre finition cassette',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
      {
        id: 'evac-condensats-cassette', name: 'Évacuation condensats',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 3, unit: 'ml', geometryMultiplier: 'none',
        wasteFactor: 1.10, wasteReason: 'Coupes',
      },
      {
        id: 'telecommande-cassette', name: 'Télécommande + thermostat',
        category: 'accessoire', phase: 'accessoires', quantityPerBase: 1, unit: 'u', geometryMultiplier: 'none',
        wasteFactor: 1.00, wasteReason: 'Pas de perte',
      },
    ],
  },
]
