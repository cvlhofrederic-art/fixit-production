/**
 * Seed localStorage demo data for pro_societe dashboard.
 * Populates: devis, factures, rapports, portfolio — all coherent
 * with the Supabase BTP demo data (same clients, chantiers, amounts).
 *
 * Called once per session from the dashboard if demo data is missing.
 */

const DEMO_ARTISAN_ID = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const SEED_VERSION = 8 // Increment to force re-seed after adding new data

function isAlreadySeeded(artisanId: string): boolean {
  try {
    const version = localStorage.getItem(`fixit_demo_seed_version_${artisanId}`)
    if (version && parseInt(version, 10) >= SEED_VERSION) return true
  } catch { /* ignore */ }
  return false
}

export function seedDemoLocalStorage(artisanId: string, isAdminOverride = false): void {
  if (isAlreadySeeded(artisanId)) return
  // Seed pour le compte demo OU pour les admins en override (même données demo)
  if (artisanId !== DEMO_ARTISAN_ID && !isAdminOverride) return

  // ═══════════════════════════════════════
  // DEVIS + FACTURES (fixit_documents_*)
  // ═══════════════════════════════════════
  const documents = [
    // --- 5 DEVIS ---
    {
      id: 'demo-dev-001', docType: 'devis', docNumber: 'DEV-2026-001',
      docTitle: 'Rénovation T3 — Rue de la République',
      docDate: '2026-03-05', savedAt: '2026-03-05T10:00:00Z',
      clientName: 'Mme Dupont Catherine', clientEmail: 'c.dupont@email.fr',
      companyCapital: '10 000 €', companyRCS: 'RCS Marseille 847 261 935',
      status: 'signed', sentAt: '2026-03-06T09:00:00Z',
      lines: [
        { description: 'Démolition cloisons + évacuation gravats', qty: 1, priceHT: 2200, totalHT: 2200, unite: 'forfait', tvaRate: 10 },
        { description: 'Placo BA13 — fourniture + pose (85m²)', qty: 85, priceHT: 45, totalHT: 3825, unite: 'm²', tvaRate: 10 },
        { description: 'Électricité — mise aux normes NFC 15-100', qty: 1, priceHT: 4800, totalHT: 4800, unite: 'forfait', tvaRate: 10 },
        { description: 'Peinture 2 couches (120m²)', qty: 120, priceHT: 28, totalHT: 3360, unite: 'm²', tvaRate: 10 },
        { description: 'Carrelage sol SDB (12m²)', qty: 12, priceHT: 85, totalHT: 1020, unite: 'm²', tvaRate: 10 },
        { description: 'Plomberie SDB + cuisine', qty: 1, priceHT: 4200, totalHT: 4200, unite: 'forfait', tvaRate: 10 },
        { description: 'Parquet stratifié (45m²)', qty: 45, priceHT: 52, totalHT: 2340, unite: 'm²', tvaRate: 10 },
        { description: 'Nettoyage fin de chantier', qty: 1, priceHT: 1905, totalHT: 1905, unite: 'forfait', tvaRate: 10 },
      ],
      total_ht_cents: 2850000, total_tax_cents: 285000, total_ttc_cents: 3135000,
    },
    {
      id: 'demo-dev-002', docType: 'devis', docNumber: 'DEV-2026-002',
      docTitle: 'Ravalement façade — Bd Longchamp',
      docDate: '2026-03-20', savedAt: '2026-03-20T14:00:00Z',
      clientName: 'Syndic Foncia — Résidence Les Pins', clientEmail: 'foncia.pins@foncia.fr',
      status: 'envoye', sentAt: '2026-03-21T08:00:00Z',
      lines: [
        { description: 'Installation échafaudage R+4', qty: 1, priceHT: 6500, totalHT: 6500, unite: 'forfait', tvaRate: 10 },
        { description: 'Nettoyage HP façade (320m²)', qty: 320, priceHT: 12, totalHT: 3840, unite: 'm²', tvaRate: 10 },
        { description: 'Enduit monocouche (320m²)', qty: 320, priceHT: 42, totalHT: 13440, unite: 'm²', tvaRate: 10 },
        { description: 'Peinture façade 2 couches', qty: 320, priceHT: 25, totalHT: 8000, unite: 'm²', tvaRate: 10 },
        { description: 'Zinguerie gouttières + EP', qty: 1, priceHT: 4800, totalHT: 4800, unite: 'forfait', tvaRate: 10 },
      ],
      total_ht_cents: 4500000, total_tax_cents: 450000, total_ttc_cents: 4950000,
    },
    {
      id: 'demo-dev-003', docType: 'devis', docNumber: 'DEV-2026-003',
      docTitle: 'SDB complète — Villa Les Oliviers',
      docDate: '2026-03-12', savedAt: '2026-03-12T11:00:00Z',
      clientName: 'M. et Mme Garcia', clientEmail: 'garcia.fam@email.fr',
      status: 'signed', sentAt: '2026-03-13T10:00:00Z',
      lines: [
        { description: 'Dépose sanitaires existants', qty: 1, priceHT: 1200, totalHT: 1200, unite: 'forfait', tvaRate: 10 },
        { description: 'Plomberie complète', qty: 1, priceHT: 2800, totalHT: 2800, unite: 'forfait', tvaRate: 10 },
        { description: 'Carrelage sol (8m²)', qty: 8, priceHT: 95, totalHT: 760, unite: 'm²', tvaRate: 10 },
        { description: 'Faïence murale (22m²)', qty: 22, priceHT: 78, totalHT: 1716, unite: 'm²', tvaRate: 10 },
        { description: 'Douche italienne + paroi', qty: 1, priceHT: 2200, totalHT: 2200, unite: 'forfait', tvaRate: 10 },
        { description: 'Meuble vasque + miroir', qty: 1, priceHT: 1800, totalHT: 1800, unite: 'forfait', tvaRate: 10 },
      ],
      total_ht_cents: 1280000, total_tax_cents: 128000, total_ttc_cents: 1408000,
    },
    {
      id: 'demo-dev-004', docType: 'devis', docNumber: 'DEV-2026-004',
      docTitle: 'Extension maison — Chemin de Paradis',
      docDate: '2026-03-18', savedAt: '2026-03-18T15:00:00Z',
      clientName: 'M. Rossi Antoine', clientEmail: 'a.rossi@email.fr',
      status: 'signed', sentAt: '2026-03-19T09:00:00Z',
      lines: [
        { description: 'Terrassement + fondations', qty: 1, priceHT: 8500, totalHT: 8500, unite: 'forfait', tvaRate: 20 },
        { description: 'Élévation murs parpaing (30m²)', qty: 30, priceHT: 180, totalHT: 5400, unite: 'm²', tvaRate: 20 },
        { description: 'Charpente + couverture tuiles', qty: 1, priceHT: 14000, totalHT: 14000, unite: 'forfait', tvaRate: 20 },
        { description: 'Menuiseries alu (4 pièces)', qty: 4, priceHT: 2800, totalHT: 11200, unite: 'u', tvaRate: 20 },
        { description: 'Isolation ITE (60m²)', qty: 60, priceHT: 120, totalHT: 7200, unite: 'm²', tvaRate: 20 },
        { description: 'Électricité + plomberie', qty: 1, priceHT: 6200, totalHT: 6200, unite: 'forfait', tvaRate: 20 },
        { description: 'Finitions intérieures', qty: 1, priceHT: 9500, totalHT: 9500, unite: 'forfait', tvaRate: 20 },
      ],
      total_ht_cents: 6200000, total_tax_cents: 1240000, total_ttc_cents: 7440000,
    },
    {
      id: 'demo-dev-005', docType: 'devis', docNumber: 'DEV-2026-005',
      docTitle: 'Local commercial — Cours Julien',
      docDate: '2026-03-22', savedAt: '2026-03-22T16:00:00Z',
      clientName: 'SCI Les Terrasses du Sud', clientEmail: 'contact@terrasses-sud.fr',
      status: 'signed', sentAt: '2026-03-23T08:30:00Z',
      lines: [
        { description: 'Démolition + évacuation', qty: 1, priceHT: 3200, totalHT: 3200, unite: 'forfait', tvaRate: 20 },
        { description: 'Dalle béton (80m²)', qty: 80, priceHT: 65, totalHT: 5200, unite: 'm²', tvaRate: 20 },
        { description: 'Plomberie sanitaires + cuisine', qty: 1, priceHT: 5500, totalHT: 5500, unite: 'forfait', tvaRate: 20 },
        { description: 'Électricité NFC 15-100', qty: 1, priceHT: 7200, totalHT: 7200, unite: 'forfait', tvaRate: 20 },
        { description: 'Faux plafond acoustique (80m²)', qty: 80, priceHT: 55, totalHT: 4400, unite: 'm²', tvaRate: 20 },
        { description: 'Vitrine commerciale alu', qty: 1, priceHT: 8500, totalHT: 8500, unite: 'forfait', tvaRate: 20 },
      ],
      total_ht_cents: 3800000, total_tax_cents: 760000, total_ttc_cents: 4560000,
    },

    // --- 4 FACTURES ---
    {
      id: 'demo-fac-001', docType: 'facture', docNumber: 'FAC-2026-001',
      docTitle: 'Acompte 30% — Rénovation T3',
      docDate: '2026-03-10', savedAt: '2026-03-10T09:00:00Z',
      clientName: 'Mme Dupont Catherine', clientEmail: 'c.dupont@email.fr',
      status: 'paid', sentAt: '2026-03-10T10:00:00Z',
      paymentDue: '2026-04-10',
      lines: [
        { description: 'Acompte 30% — Rénovation T3 Rue de la République', qty: 1, priceHT: 8550, totalHT: 8550, unite: 'forfait', tvaRate: 10 },
      ],
      total_ht_cents: 855000, total_tax_cents: 85500, total_ttc_cents: 940500,
    },
    {
      id: 'demo-fac-002', docType: 'facture', docNumber: 'FAC-2026-002',
      docTitle: 'Acompte 30% — SDB Villa Les Oliviers',
      docDate: '2026-03-17', savedAt: '2026-03-17T11:00:00Z',
      clientName: 'M. et Mme Garcia', clientEmail: 'garcia.fam@email.fr',
      status: 'paid', sentAt: '2026-03-17T14:00:00Z',
      paymentDue: '2026-04-17',
      lines: [
        { description: 'Acompte 30% — SDB complète Villa Les Oliviers', qty: 1, priceHT: 3840, totalHT: 3840, unite: 'forfait', tvaRate: 10 },
      ],
      total_ht_cents: 384000, total_tax_cents: 38400, total_ttc_cents: 422400,
    },
    {
      id: 'demo-fac-003', docType: 'facture', docNumber: 'FAC-2026-003',
      docTitle: 'Acompte 30% — Extension Chemin de Paradis',
      docDate: '2026-04-01', savedAt: '2026-04-01T08:00:00Z',
      clientName: 'M. Rossi Antoine', clientEmail: 'a.rossi@email.fr',
      status: 'paid', sentAt: '2026-04-01T09:30:00Z',
      paymentDue: '2026-05-01',
      lines: [
        { description: 'Acompte 30% — Extension maison individuelle', qty: 1, priceHT: 18600, totalHT: 18600, unite: 'forfait', tvaRate: 20 },
      ],
      total_ht_cents: 1860000, total_tax_cents: 372000, total_ttc_cents: 2232000,
    },
    {
      id: 'demo-fac-004', docType: 'facture', docNumber: 'FAC-2026-004',
      docTitle: 'Situation n°1 — Local commercial Cours Julien',
      docDate: '2026-04-05', savedAt: '2026-04-05T14:00:00Z',
      clientName: 'SCI Les Terrasses du Sud', clientEmail: 'contact@terrasses-sud.fr',
      status: 'envoye', sentAt: '2026-04-06T08:00:00Z',
      paymentDue: '2026-05-05',
      lines: [
        { description: 'Situation n°1 — Démolition + dalle béton (100%)', qty: 1, priceHT: 8400, totalHT: 8400, unite: 'forfait', tvaRate: 20 },
        { description: 'Plomberie (60%)', qty: 1, priceHT: 3300, totalHT: 3300, unite: 'forfait', tvaRate: 20 },
      ],
      total_ht_cents: 1170000, total_tax_cents: 234000, total_ttc_cents: 1404000,
    },
    {
      id: 'demo-fac-005', docType: 'facture', docNumber: 'FAC-2026-005',
      docTitle: 'Acompte 20% — Ravalement façade Bd Longchamp',
      docDate: '2026-04-08', savedAt: '2026-04-08T10:00:00Z',
      clientName: 'Syndic Foncia — Résidence Les Pins', clientEmail: 'foncia.pins@foncia.fr',
      status: 'envoye', sentAt: '2026-04-08T11:00:00Z',
      paymentDue: '2026-05-08',
      lines: [
        { description: 'Acompte 20% — Ravalement façade Résidence Les Pins', qty: 1, priceHT: 9000, totalHT: 9000, unite: 'forfait', tvaRate: 10 },
      ],
      total_ht_cents: 900000, total_tax_cents: 90000, total_ttc_cents: 990000,
    },
  ]

  localStorage.setItem(`fixit_documents_${artisanId}`, JSON.stringify(documents))
  localStorage.setItem(`fixit_drafts_${artisanId}`, JSON.stringify([]))

  // ═══════════════════════════════════════
  // CHANTIERS BTP (fixit_chantiers_*)
  // Cohérents avec les devis, factures, situations, retenues, équipes
  // ═══════════════════════════════════════
  const chantiers = [
    {
      id: 'demo-ch-001', titre: 'Rénovation T3 — Rue de la République', client: 'Mme Dupont Catherine',
      adresse: '45 rue de la République', ville: 'Marseille', codePostal: '13001',
      dateDebut: '2026-03-10', dateFin: '2026-05-15', budget: '28500',
      statut: 'En cours', description: 'Rénovation complète T3 : démolition cloisons, placo, électricité NFC 15-100, peinture, carrelage SDB, plomberie, parquet.',
      equipe: 'Équipe A — Rénovation', createdAt: '2026-03-05T10:00:00Z',
      latitude: 43.2965, longitude: 5.3698,
    },
    {
      id: 'demo-ch-002', titre: 'Ravalement façade — Bd Longchamp', client: 'Syndic Foncia — Résidence Les Pins',
      adresse: '120 bd Longchamp', ville: 'Marseille', codePostal: '13001',
      dateDebut: '2026-04-15', dateFin: '2026-06-30', budget: '45000',
      statut: 'En attente', description: 'Ravalement complet R+4 : échafaudage, nettoyage HP, enduit monocouche, peinture façade, zinguerie gouttières.',
      equipe: '', createdAt: '2026-03-20T14:00:00Z',
      latitude: 43.2988, longitude: 5.3863,
    },
    {
      id: 'demo-ch-003', titre: 'SDB complète — Villa Les Oliviers', client: 'M. et Mme Garcia',
      adresse: '8 chemin des Oliviers', ville: 'Aix-en-Provence', codePostal: '13090',
      dateDebut: '2026-03-17', dateFin: '2026-04-20', budget: '12800',
      statut: 'En cours', description: 'SDB complète : dépose sanitaires, plomberie, carrelage sol + faïence murale, douche italienne, meuble vasque + miroir.',
      equipe: 'Équipe A — Rénovation', createdAt: '2026-03-12T11:00:00Z',
      latitude: 43.5298, longitude: 5.4474,
    },
    {
      id: 'demo-ch-004', titre: 'Extension maison — Chemin de Paradis', client: 'M. Rossi Antoine',
      adresse: '22 chemin de Paradis', ville: 'Cassis', codePostal: '13260',
      dateDebut: '2026-04-01', dateFin: '2026-08-30', budget: '62000',
      statut: 'En cours', description: 'Extension 35m² : terrassement, fondations, murs parpaing, charpente tuiles, menuiseries alu, isolation ITE, électricité + plomberie, finitions.',
      equipe: 'Équipe B — Gros œuvre', createdAt: '2026-03-18T15:00:00Z',
      latitude: 43.2142, longitude: 5.5382,
    },
    {
      id: 'demo-ch-005', titre: 'Local commercial — Cours Julien', client: 'SCI Les Terrasses du Sud',
      adresse: '15 cours Julien', ville: 'Marseille', codePostal: '13006',
      dateDebut: '2026-03-25', dateFin: '2026-06-15', budget: '38000',
      statut: 'En cours', description: 'Aménagement local 80m² : démolition, dalle béton, plomberie, électricité NFC, faux plafond acoustique, vitrine alu.',
      equipe: 'Équipe B — Gros œuvre', createdAt: '2026-03-22T16:00:00Z',
      latitude: 43.2935, longitude: 5.3840,
    },
  ]

  localStorage.setItem(`fixit_chantiers_${artisanId}`, JSON.stringify(chantiers))

  // ═══════════════════════════════════════
  // RAPPORTS D'INTERVENTION
  // ═══════════════════════════════════════
  const rapports = [
    {
      id: 'demo-rap-001', rapportNumber: 'RAP-2026-001',
      createdAt: '2026-03-25T17:00:00Z',
      linkedBookingId: null, linkedPhotoIds: [],
      refDevisFact: 'DEV-2026-001',
      artisanName: 'BATIPRO MÉDITERRANÉE', artisanAddress: '12 Boulevard Longchamp, 13001 Marseille',
      artisanPhone: '04 91 52 74 38', artisanEmail: 'contact@batipro-med.fr',
      artisanSiret: '84726193500024', artisanInsurance: 'SMABTP n°DEC-2025-MRS-007841',
      clientName: 'Mme Dupont Catherine', clientPhone: '06 11 22 33 44',
      clientEmail: 'c.dupont@email.fr', clientAddress: '42 Rue de la République, 13001 Marseille',
      interventionDate: '2026-03-25', startTime: '08:00', endTime: '17:00',
      siteAddress: '42 Rue de la République, 13001 Marseille',
      motif: 'Rénovation complète T3 — Phase démolition + placo',
      travaux: ['Démolition cloisons existantes', 'Évacuation gravats (3 bennes)', 'Pose rails + montants placo BA13', 'Passage gaines électriques'],
      materiaux: ['Placo BA13 standard (40 plaques)', 'Rails R48 + montants M48 (1 lot)', 'Vis placo (2 boîtes)', 'Bande à joint (6 rouleaux)'],
      observations: 'Mur porteur identifié côté cuisine — nécessite avis structure avant ouverture. Gaine VMC existante en bon état, réutilisable.',
      recommendations: 'Prévoir étai provisoire pour ouverture mur porteur. Devis complémentaire IPN à chiffrer.',
      status: 'termine' as const, sentStatus: 'envoye' as const, sentAt: '2026-03-25T18:30:00Z',
    },
    {
      id: 'demo-rap-002', rapportNumber: 'RAP-2026-002',
      createdAt: '2026-03-28T17:30:00Z',
      linkedBookingId: null, linkedPhotoIds: [],
      refDevisFact: 'DEV-2026-003',
      artisanName: 'BATIPRO MÉDITERRANÉE', artisanAddress: '12 Boulevard Longchamp, 13001 Marseille',
      artisanPhone: '04 91 52 74 38', artisanEmail: 'contact@batipro-med.fr',
      artisanSiret: '84726193500024', artisanInsurance: 'SMABTP n°DEC-2025-MRS-007841',
      clientName: 'M. et Mme Garcia', clientPhone: '06 77 88 99 00',
      clientEmail: 'garcia.fam@email.fr', clientAddress: '8 Chemin des Oliviers, 13012 Marseille',
      interventionDate: '2026-03-28', startTime: '07:30', endTime: '16:30',
      siteAddress: '8 Chemin des Oliviers, 13012 Marseille',
      motif: 'SDB complète — Dépose + plomberie + carrelage',
      travaux: ['Dépose baignoire + carrelage existant', 'Reprise alimentation eau chaude/froide', 'Pose receveur douche italienne', 'Étanchéité SPEC + carrelage sol 8m²'],
      materiaux: ['Receveur extra-plat 120×90 (1 u)', 'Paroi verre 8 mm (1 u)', 'Carrelage antidérapant R11 (8 m²)', 'Colle flex C2 (3 sacs)', 'Joint époxy gris (1 u)'],
      observations: 'Évacuation existante en bon état, raccordement direct possible. Mur support sain, pas besoin de reprise.',
      recommendations: 'Prévoir séchage étanchéité 48h avant pose carrelage mural. Faïence murale à poser semaine prochaine.',
      status: 'termine' as const, sentStatus: 'envoye' as const, sentAt: '2026-03-28T18:00:00Z',
    },
    {
      id: 'demo-rap-003', rapportNumber: 'RAP-2026-003',
      createdAt: '2026-04-08T17:00:00Z',
      linkedBookingId: null, linkedPhotoIds: [],
      refDevisFact: 'DEV-2026-004',
      artisanName: 'BATIPRO MÉDITERRANÉE', artisanAddress: '12 Boulevard Longchamp, 13001 Marseille',
      artisanPhone: '04 91 52 74 38', artisanEmail: 'contact@batipro-med.fr',
      artisanSiret: '84726193500024', artisanInsurance: 'SMABTP n°DEC-2025-MRS-007841',
      clientName: 'M. Rossi Antoine', clientPhone: '06 44 55 66 77',
      clientEmail: 'a.rossi@email.fr', clientAddress: '15 Chemin de Paradis, 13008 Marseille',
      interventionDate: '2026-04-08', startTime: '07:00', endTime: '17:00',
      siteAddress: '15 Chemin de Paradis, 13008 Marseille',
      motif: 'Extension 30m² — Phase fondations + élévation murs',
      travaux: ['Coulage semelles filantes (6ml)', 'Ferraillage HA10 + étriers', 'Montée parpaings 20cm (rang 1 à 8)', 'Chaînage horizontal béton'],
      materiaux: ['Béton C25/30 (4 m³)', 'Acier HA10 (200 ml)', 'Parpaings creux 20 (480 u)', 'Ciment CEM II (40 sacs)', 'Sable 0/4 (2 T)'],
      observations: 'Sol porteur confirmé par étude G2 — pas de surprises. Fondations coulées niveau +0, aplomb vérifié au laser.',
      recommendations: 'Attendre 7 jours min avant charge sur fondations. Commande charpente à lancer cette semaine pour livraison S+3.',
      status: 'en_cours' as const, sentStatus: 'non_envoye' as const,
    },
  ]

  localStorage.setItem(`fixit_rapports_${artisanId}`, JSON.stringify(rapports))

  // ═══════════════════════════════════════
  // BOOKINGS (demandes d'intervention clients)
  // ═══════════════════════════════════════
  const bookings = [
    {
      id: 'demo-bk-001', artisan_id: artisanId, service_id: null, client_id: null,
      status: 'confirmed' as const,
      booking_date: '2026-04-12', booking_time: '09:00:00',
      duration_minutes: 240,
      address: '42 Rue de la République, 13001 Marseille',
      notes: 'Client: Mme Dupont Catherine | Tel: 06 11 22 33 44 | Email: c.dupont@email.fr | Rénovation T3 — phase finitions peinture + parquet salon',
      price_ht: 2400, price_ttc: 2640,
      confirmed_at: '2026-04-10T14:00:00Z',
      created_at: '2026-04-10T10:00:00Z',
      services: { name: 'Rénovation intérieure — Finitions' },
      client_name: 'Mme Dupont Catherine',
      client_phone: '06 11 22 33 44',
      client_email: 'c.dupont@email.fr',
    },
    {
      id: 'demo-bk-002', artisan_id: artisanId, service_id: null, client_id: null,
      status: 'completed' as const,
      booking_date: '2026-04-08', booking_time: '07:30:00',
      duration_minutes: 540,
      address: '8 Chemin des Oliviers, 13012 Marseille',
      notes: 'Client: M. et Mme Garcia | Tel: 06 77 88 99 00 | Email: garcia.fam@email.fr | SDB complète — pose faïence murale + raccordements finaux',
      price_ht: 1850, price_ttc: 2035,
      confirmed_at: '2026-04-05T09:00:00Z',
      completed_at: '2026-04-08T17:00:00Z',
      created_at: '2026-04-04T11:00:00Z',
      services: { name: 'Plomberie + Carrelage' },
      client_name: 'M. et Mme Garcia',
      client_phone: '06 77 88 99 00',
      client_email: 'garcia.fam@email.fr',
    },
    {
      id: 'demo-bk-003', artisan_id: artisanId, service_id: null, client_id: null,
      status: 'confirmed' as const,
      booking_date: '2026-04-15', booking_time: '08:00:00',
      duration_minutes: 480,
      address: '15 Chemin de Paradis, 13008 Marseille',
      notes: 'Client: M. Rossi Antoine | Tel: 06 44 55 66 77 | Email: a.rossi@email.fr | Extension 30m² — montée murs parpaings (rang 9 à 16)',
      price_ht: 3200, price_ttc: 3840,
      confirmed_at: '2026-04-12T16:00:00Z',
      created_at: '2026-04-11T10:00:00Z',
      services: { name: 'Maçonnerie — Gros œuvre' },
      client_name: 'M. Rossi Antoine',
      client_phone: '06 44 55 66 77',
      client_email: 'a.rossi@email.fr',
    },
  ]

  localStorage.setItem(`fixit_bookings_${artisanId}`, JSON.stringify(bookings))

  // ═══════════════════════════════════════
  // PORTFOLIO / RÉFÉRENCES CHANTIERS
  // ═══════════════════════════════════════
  const portfolio = [
    {
      id: 'demo-port-001',
      url: '',
      title: 'Rénovation T3 — Rue de la République',
      category: 'Rénovation intérieure',
      uploadedAt: '2026-03-25T18:00:00Z',
      maitreOuvrage: 'Mme Dupont Catherine',
      montantHT: '28 500',
      corps: 'Second œuvre',
    },
    {
      id: 'demo-port-002',
      url: '',
      title: 'SDB complète — Villa Les Oliviers',
      category: 'Plomberie / Carrelage',
      uploadedAt: '2026-03-28T18:00:00Z',
      maitreOuvrage: 'M. et Mme Garcia',
      montantHT: '12 800',
      corps: 'Second œuvre',
    },
    {
      id: 'demo-port-003',
      url: '',
      title: 'Extension 30m² — Chemin de Paradis',
      category: 'Gros œuvre / Maçonnerie',
      uploadedAt: '2026-04-08T18:00:00Z',
      maitreOuvrage: 'M. Rossi Antoine',
      montantHT: '62 000',
      corps: 'Gros œuvre',
    },
    {
      id: 'demo-port-004',
      url: '',
      title: 'Local commercial — Cours Julien',
      category: 'Tous corps d\'état',
      uploadedAt: '2026-04-05T18:00:00Z',
      maitreOuvrage: 'SCI Les Terrasses du Sud',
      montantHT: '38 000',
      corps: 'Tous corps d\'état',
    },
  ]

  localStorage.setItem(`fixit_portfolio_${artisanId}`, JSON.stringify(portfolio))

  // ═══════════════════════════════════════
  // CLIENTS MANUELS (fixit_manual_clients_*)
  // ═══════════════════════════════════════
  const manualClients = [
    {
      id: 'demo-cli-001', name: 'Mme Dupont Catherine', email: 'c.dupont@email.fr',
      phone: '06 11 22 33 44', type: 'particulier',
      mainAddress: '42 Rue de la République, 13001 Marseille',
      notes: 'Rénovation T3 — cliente satisfaite, recommandation possible',
      source: 'bouche-à-oreille',
    },
    {
      id: 'demo-cli-002', name: 'Syndic Foncia — Résidence Les Pins', email: 'foncia.pins@foncia.fr',
      phone: '04 91 55 66 77', type: 'professionnel', siret: '32345678900025',
      mainAddress: '18 Boulevard Longchamp, 13001 Marseille',
      notes: 'Syndic copropriété — ravalement façade R+4, bon payeur',
      source: 'appel d\'offres',
    },
    {
      id: 'demo-cli-003', name: 'M. et Mme Garcia', email: 'garcia.fam@email.fr',
      phone: '06 77 88 99 00', type: 'particulier',
      mainAddress: '8 Chemin des Oliviers, 13012 Marseille',
      notes: 'SDB complète villa — budget respecté, chantier en avance',
      source: 'site internet',
    },
    {
      id: 'demo-cli-004', name: 'M. Rossi Antoine', email: 'a.rossi@email.fr',
      phone: '06 44 55 66 77', type: 'particulier',
      mainAddress: '15 Chemin de Paradis, 13008 Marseille',
      notes: 'Extension 30m² — permis de construire obtenu, étude G2 OK',
      source: 'recommandation',
    },
    {
      id: 'demo-cli-005', name: 'SCI Les Terrasses du Sud', email: 'contact@terrasses-sud.fr',
      phone: '04 91 22 33 44', type: 'professionnel', siret: '98765432100012',
      mainAddress: '24 Cours Julien, 13006 Marseille',
      notes: 'Transformation local commercial 80m² — contact M. Belkacem',
      source: 'réseau professionnel',
    },
  ]

  localStorage.setItem(`fixit_manual_clients_${artisanId}`, JSON.stringify(manualClients))

  // ═══════════════════════════════════════
  // DÉPENSES / EXPENSES (fixit_expenses_*)
  // ═══════════════════════════════════════
  const expenses = [
    { id: 'demo-exp-001', label: 'Placo BA13 + rails R48/M48', amount: 1450, category: 'materiel', date: '2026-03-12', notes: 'Chantier Rue de la République' },
    { id: 'demo-exp-002', label: 'Peinture Tollens (4 seaux)', amount: 380, category: 'materiel', date: '2026-03-15', notes: 'Chantier Rue de la République' },
    { id: 'demo-exp-003', label: 'Câbles + tableau électrique NFC', amount: 820, category: 'materiel', date: '2026-03-18', notes: 'Chantier Rue de la République' },
    { id: 'demo-exp-004', label: 'Location benne gravats 8m³', amount: 350, category: 'vehicule', date: '2026-03-20', notes: 'Chantier Rue de la République' },
    { id: 'demo-exp-005', label: 'Carrelage antidérapant + faïence SDB', amount: 1100, category: 'materiel', date: '2026-03-18', notes: 'Chantier Villa Les Oliviers' },
    { id: 'demo-exp-006', label: 'Receveur douche italienne + paroi verre', amount: 890, category: 'materiel', date: '2026-03-19', notes: 'Chantier Villa Les Oliviers' },
    { id: 'demo-exp-007', label: 'Meuble vasque double + miroir LED', amount: 750, category: 'materiel', date: '2026-03-21', notes: 'Chantier Villa Les Oliviers' },
    { id: 'demo-exp-008', label: 'Béton C25/30 fondations (4m³)', amount: 3200, category: 'materiel', date: '2026-04-02', notes: 'Chantier Extension Paradis' },
    { id: 'demo-exp-009', label: 'Parpaings creux 20cm + ciment CEM II', amount: 2100, category: 'materiel', date: '2026-04-05', notes: 'Chantier Extension Paradis' },
    { id: 'demo-exp-010', label: 'Location mini-pelle 3 jours', amount: 580, category: 'vehicule', date: '2026-04-07', notes: 'Chantier Extension Paradis' },
    { id: 'demo-exp-011', label: 'Location marteau-piqueur', amount: 320, category: 'vehicule', date: '2026-03-26', notes: 'Chantier Cours Julien' },
    { id: 'demo-exp-012', label: 'Béton prêt à l\'emploi dalle (6m³)', amount: 1800, category: 'materiel', date: '2026-03-28', notes: 'Chantier Cours Julien' },
    { id: 'demo-exp-013', label: 'Câblage électrique NFC 15-100', amount: 1250, category: 'materiel', date: '2026-04-01', notes: 'Chantier Cours Julien' },
    { id: 'demo-exp-014', label: 'Carburant fourgon chantiers', amount: 280, category: 'vehicule', date: '2026-03-31', notes: 'Mars 2026 — 1800km' },
    { id: 'demo-exp-015', label: 'Assurance RC Pro — trimestrielle', amount: 1850, category: 'assurance', date: '2026-04-01', notes: 'AXA n°RC-2026-4521 — Q2 2026' },
    { id: 'demo-exp-016', label: 'Expert-comptable — honoraires mars', amount: 600, category: 'charges', date: '2026-04-05', notes: 'Cabinet Martin & Associés' },
  ]

  localStorage.setItem(`fixit_expenses_${artisanId}`, JSON.stringify(expenses))

  // ═══════════════════════════════════════
  // COÛTS HORAIRES (fixit_couts_horaires_*)
  // ═══════════════════════════════════════
  const coutsHoraires = {
    ouvrier: 22, chef_chantier: 32, conducteur_travaux: 42, secretaire: 20, gerant: 48, apprenti: 12,
  }

  localStorage.setItem(`fixit_couts_horaires_${artisanId}`, JSON.stringify(coutsHoraires))

  // ═══════════════════════════════════════
  // ABSENCES (fixit_absences_*)
  // ═══════════════════════════════════════
  const absences = [
    { id: 'demo-abs-001', type: 'conge', start: '2026-04-21', end: '2026-04-25', motif: 'Congés annuels — Pâques', employe: 'Martin R.' },
    { id: 'demo-abs-002', type: 'maladie', start: '2026-03-14', end: '2026-03-15', motif: 'Arrêt maladie', employe: 'Benoît K.' },
    { id: 'demo-abs-003', type: 'formation', start: '2026-04-14', end: '2026-04-14', motif: 'Formation SST renouvellement', employe: 'Samir E.' },
  ]

  localStorage.setItem(`fixit_absences_${artisanId}`, JSON.stringify(absences))

  // ═══════════════════════════════════════
  // POINTAGES localStorage fallback (pointage_*)
  // ═══════════════════════════════════════
  const pointages = [
    { id: 'demo-pt-001', employe: 'Martin R.', poste: 'Chef de chantier', chantier: 'Rénovation T3 — République', date: '2026-03-25', heures: 8, arrivee: '07:30', depart: '16:30', pause: 1 },
    { id: 'demo-pt-002', employe: 'Samir E.', poste: 'Ouvrier qualifié', chantier: 'Rénovation T3 — République', date: '2026-03-25', heures: 8, arrivee: '07:30', depart: '16:30', pause: 1 },
    { id: 'demo-pt-003', employe: 'Lucas P.', poste: 'Ouvrier', chantier: 'Rénovation T3 — République', date: '2026-03-25', heures: 8, arrivee: '08:00', depart: '17:00', pause: 1 },
    { id: 'demo-pt-004', employe: 'Benoît K.', poste: 'Ouvrier qualifié', chantier: 'SDB Villa Les Oliviers', date: '2026-03-28', heures: 9, arrivee: '07:00', depart: '17:00', pause: 1 },
    { id: 'demo-pt-005', employe: 'Martin R.', poste: 'Chef de chantier', chantier: 'Extension Paradis', date: '2026-04-08', heures: 10, arrivee: '06:30', depart: '17:30', pause: 1 },
    { id: 'demo-pt-006', employe: 'Samir E.', poste: 'Ouvrier qualifié', chantier: 'Extension Paradis', date: '2026-04-08', heures: 10, arrivee: '06:30', depart: '17:30', pause: 1 },
    { id: 'demo-pt-007', employe: 'Lucas P.', poste: 'Ouvrier', chantier: 'Local Cours Julien', date: '2026-04-01', heures: 8, arrivee: '08:00', depart: '17:00', pause: 1 },
    { id: 'demo-pt-008', employe: 'Benoît K.', poste: 'Ouvrier qualifié', chantier: 'Local Cours Julien', date: '2026-04-01', heures: 8, arrivee: '08:00', depart: '17:00', pause: 1 },
  ]

  localStorage.setItem(`pointage_${artisanId}`, JSON.stringify(pointages))

  // ═══════════════════════════════════════
  // MEMBRES localStorage fallback (fixit_membres_*)
  // ═══════════════════════════════════════
  const membres = [
    { id: 'demo-mb-001', nom: 'Martin', prenom: 'Raphaël', poste: 'Chef de chantier', telephone: '06 12 34 56 78', email: 'r.martin@pacabti.fr', statut: 'actif', dateEmbauche: '2024-09-01' },
    { id: 'demo-mb-002', nom: 'Elouardi', prenom: 'Samir', poste: 'Ouvrier qualifié', telephone: '06 23 45 67 89', email: 's.elouardi@pacabti.fr', statut: 'actif', dateEmbauche: '2025-01-15' },
    { id: 'demo-mb-003', nom: 'Keller', prenom: 'Benoît', poste: 'Ouvrier qualifié', telephone: '06 34 56 78 90', email: 'b.keller@pacabti.fr', statut: 'actif', dateEmbauche: '2025-03-01' },
    { id: 'demo-mb-004', nom: 'Perrin', prenom: 'Lucas', poste: 'Ouvrier', telephone: '06 45 67 89 01', email: 'l.perrin@pacabti.fr', statut: 'actif', dateEmbauche: '2025-06-01' },
  ]

  localStorage.setItem(`fixit_membres_${artisanId}`, JSON.stringify(membres))

  // ═══════════════════════════════════════
  // SITUATIONS DE TRAVAUX localStorage fallback (situations_*)
  // ═══════════════════════════════════════
  const situations = [
    {
      id: 'demo-sit-001', chantier: 'Rénovation T3 — Rue de la République', client: 'Mme Dupont Catherine',
      numero: 1, date: '2026-03-20', montantMarche: 28500, statut: 'validee',
      travaux: [
        { poste: 'Démolition + évacuation', quantite: 1, unite: 'forfait', prixUnit: 2200, avancement: 100 },
        { poste: 'Placo BA13 (85m²)', quantite: 85, unite: 'm²', prixUnit: 45, avancement: 80 },
        { poste: 'Électricité NFC 15-100', quantite: 1, unite: 'forfait', prixUnit: 4800, avancement: 60 },
        { poste: 'Peinture 2 couches (120m²)', quantite: 120, unite: 'm²', prixUnit: 28, avancement: 0 },
      ],
    },
    {
      id: 'demo-sit-002', chantier: 'SDB complète — Villa Les Oliviers', client: 'M. et Mme Garcia',
      numero: 1, date: '2026-03-28', montantMarche: 12800, statut: 'validee',
      travaux: [
        { poste: 'Dépose sanitaires', quantite: 1, unite: 'forfait', prixUnit: 1200, avancement: 100 },
        { poste: 'Plomberie complète', quantite: 1, unite: 'forfait', prixUnit: 2800, avancement: 100 },
        { poste: 'Carrelage sol (8m²)', quantite: 8, unite: 'm²', prixUnit: 95, avancement: 100 },
        { poste: 'Faïence murale (22m²)', quantite: 22, unite: 'm²', prixUnit: 78, avancement: 50 },
        { poste: 'Douche italienne + paroi', quantite: 1, unite: 'forfait', prixUnit: 2200, avancement: 90 },
      ],
    },
    {
      id: 'demo-sit-003', chantier: 'Extension — Chemin de Paradis', client: 'M. Rossi Antoine',
      numero: 1, date: '2026-04-08', montantMarche: 62000, statut: 'en_cours',
      travaux: [
        { poste: 'Terrassement + fondations', quantite: 1, unite: 'forfait', prixUnit: 8500, avancement: 100 },
        { poste: 'Élévation murs (30m²)', quantite: 30, unite: 'm²', prixUnit: 180, avancement: 60 },
        { poste: 'Charpente + couverture', quantite: 1, unite: 'forfait', prixUnit: 14000, avancement: 0 },
        { poste: 'Menuiseries alu (4u)', quantite: 4, unite: 'u', prixUnit: 2800, avancement: 0 },
      ],
    },
  ]

  localStorage.setItem(`situations_${artisanId}`, JSON.stringify(situations))

  // ═══════════════════════════════════════
  // RETENUES DE GARANTIE localStorage fallback (retenues_*)
  // ═══════════════════════════════════════
  const retenues = [
    {
      id: 'demo-ret-001', chantier: 'Rénovation T3 — Rue de la République', client: 'Mme Dupont Catherine',
      montantMarche: 28500, tauxRetenue: 5, montantRetenue: 1425,
      dateDebutGarantie: '2026-04-10', dateLiberation: '2027-04-10',
      statut: 'retenue_en_cours', notes: 'Garantie parfait achèvement 1 an',
    },
    {
      id: 'demo-ret-002', chantier: 'SDB complète — Villa Les Oliviers', client: 'M. et Mme Garcia',
      montantMarche: 12800, tauxRetenue: 5, montantRetenue: 640,
      dateDebutGarantie: '2026-04-01', dateLiberation: '2027-04-01',
      statut: 'retenue_en_cours', notes: 'Garantie parfait achèvement 1 an',
    },
    {
      id: 'demo-ret-003', chantier: 'Extension — Chemin de Paradis', client: 'M. Rossi Antoine',
      montantMarche: 62000, tauxRetenue: 5, montantRetenue: 3100,
      dateDebutGarantie: '', dateLiberation: '',
      statut: 'non_applicable', notes: 'Retenue applicable à la réception des travaux',
    },
  ]

  localStorage.setItem(`retenues_${artisanId}`, JSON.stringify(retenues))

  // ═══════════════════════════════════════
  // DC4 SOUS-TRAITANCE localStorage fallback (dc4_*)
  // ═══════════════════════════════════════
  const dc4 = [
    {
      id: 'demo-dc4-001', soustraitant: 'Électricité Méditerranée SARL', siret: '44455566677788',
      chantier: 'Rénovation T3 — Rue de la République', lot: 'Électricité',
      montant: 4800, dateDebut: '2026-03-15', dateFin: '2026-03-28',
      attestationRC: true, attestationURSSAF: true, statut: 'en_cours',
      contact: 'M. Fernandez', telephone: '04 91 88 99 00',
    },
    {
      id: 'demo-dc4-002', soustraitant: 'Plomberie Pro 13', siret: '55566677788899',
      chantier: 'Extension — Chemin de Paradis', lot: 'Plomberie + Sanitaire',
      montant: 6200, dateDebut: '2026-05-05', dateFin: '2026-05-20',
      attestationRC: true, attestationURSSAF: false, statut: 'a_venir',
      contact: 'Mme Nguyen', telephone: '06 11 33 55 77',
    },
    {
      id: 'demo-dc4-003', soustraitant: 'Alu Design Concept', siret: '66677788899900',
      chantier: 'Local commercial — Cours Julien', lot: 'Vitrine commerciale + menuiseries alu',
      montant: 8500, dateDebut: '2026-04-10', dateFin: '2026-04-20',
      attestationRC: true, attestationURSSAF: true, statut: 'en_cours',
      contact: 'M. Lazrak', telephone: '06 22 44 66 88',
    },
  ]

  localStorage.setItem(`dc4_${artisanId}`, JSON.stringify(dc4))

  // ═══════════════════════════════════════
  // DCE ANALYSES localStorage fallback (dce_analyses_*)
  // ═══════════════════════════════════════
  const dceAnalyses = [
    {
      id: 'demo-dce-001', nom: 'AO — Rénovation école primaire Jean Jaurès',
      maitreOuvrage: 'Mairie de Marseille', dateDepot: '2026-04-30',
      montantEstime: 180000, statut: 'en_analyse',
      lots: ['Gros œuvre', 'Second œuvre', 'Électricité', 'Plomberie'],
      notes: 'Appel d\'offres public — marchés travaux. Visite obligatoire 15 avril.',
    },
    {
      id: 'demo-dce-002', nom: 'AO — Aménagement bureaux Euroméditerranée',
      maitreOuvrage: 'SAS Eurobureau', dateDepot: '2026-05-15',
      montantEstime: 95000, statut: 'soumis',
      lots: ['Cloisons', 'Faux plafonds', 'Sols', 'Peinture'],
      notes: 'Marché privé — réponse attendue fin mai.',
    },
  ]

  localStorage.setItem(`dce_analyses_${artisanId}`, JSON.stringify(dceAnalyses))

  // ═══════════════════════════════════════
  // DPGF localStorage fallback (dpgf_*)
  // ═══════════════════════════════════════
  const dpgf = [
    {
      id: 'demo-dpgf-001', titre: 'DPGF — Rénovation école Jean Jaurès',
      affaire: 'AO Mairie de Marseille', date: '2026-04-20', statut: 'en_cours',
      lots: [
        { lot: 'Lot 1 — Gros œuvre', postes: [
          { designation: 'Démolition cloisons existantes', unite: 'forfait', quantite: 1, prixUnit: 4500 },
          { designation: 'Reprise maçonnerie (15m²)', unite: 'm²', quantite: 15, prixUnit: 180 },
          { designation: 'Coulage dalles béton (40m²)', unite: 'm²', quantite: 40, prixUnit: 85 },
        ]},
        { lot: 'Lot 2 — Second œuvre', postes: [
          { designation: 'Placo BA13 (200m²)', unite: 'm²', quantite: 200, prixUnit: 42 },
          { designation: 'Peinture (350m²)', unite: 'm²', quantite: 350, prixUnit: 22 },
          { designation: 'Carrelage sol (120m²)', unite: 'm²', quantite: 120, prixUnit: 65 },
        ]},
      ],
    },
    {
      id: 'demo-dpgf-002', titre: 'DPGF — Bureaux Euroméditerranée',
      affaire: 'SAS Eurobureau', date: '2026-05-05', statut: 'soumis',
      lots: [
        { lot: 'Lot 1 — Cloisons + faux plafonds', postes: [
          { designation: 'Cloisons vitrées bureau (8 modules)', unite: 'u', quantite: 8, prixUnit: 2200 },
          { designation: 'Faux plafond acoustique (180m²)', unite: 'm²', quantite: 180, prixUnit: 48 },
        ]},
        { lot: 'Lot 2 — Sols + peinture', postes: [
          { designation: 'Dalles PVC bureau (180m²)', unite: 'm²', quantite: 180, prixUnit: 35 },
          { designation: 'Peinture murs + plafonds (400m²)', unite: 'm²', quantite: 400, prixUnit: 18 },
        ]},
      ],
    },
  ]

  localStorage.setItem(`dpgf_${artisanId}`, JSON.stringify(dpgf))

  // ═══════════════════════════════════════
  // ÉQUIPES BTP localStorage fallback (fixit_equipes_btp_*)
  // ═══════════════════════════════════════
  const equipes = [
    {
      id: 'demo-eq-001', nom: 'Équipe A — Rénovation', metier: 'Tous corps d\'état',
      membres: ['Martin R.', 'Samir E.', 'Lucas P.'],
      chantierActuel: 'Rénovation T3 — Rue de la République',
    },
    {
      id: 'demo-eq-002', nom: 'Équipe B — Gros œuvre', metier: 'Maçonnerie / Structure',
      membres: ['Benoît K.', 'Lucas P.'],
      chantierActuel: 'Extension — Chemin de Paradis',
    },
  ]

  localStorage.setItem(`fixit_equipes_btp_${artisanId}`, JSON.stringify(equipes))

  // ═══════════════════════════════════════
  // PORTAIL CLIENT — états (fixit_portal_states_*)
  // ═══════════════════════════════════════
  const portalStates: Record<string, { accessEnabled: boolean; lastShared?: string }> = {
    'Mme Dupont Catherine': { accessEnabled: true, lastShared: '2026-03-25T18:00:00Z' },
    'M. et Mme Garcia': { accessEnabled: true, lastShared: '2026-03-28T18:00:00Z' },
    'M. Rossi Antoine': { accessEnabled: false },
    'Syndic Foncia — Résidence Les Pins': { accessEnabled: false },
    'SCI Les Terrasses du Sud': { accessEnabled: true, lastShared: '2026-04-06T08:00:00Z' },
  }

  localStorage.setItem(`fixit_portal_states_${artisanId}`, JSON.stringify(portalStates))

  // ═══════════════════════════════════════
  // BIBLIOTHÈQUE D'OUVRAGES (fixit_bibliotheque_*)
  // Cohérent avec les 5 chantiers demo
  // ═══════════════════════════════════════
  const bibliotheque = [
    // --- OUVRAGES (prestations composites) ---
    { id: 1,  nom: 'Démolition cloisons + évacuation gravats',       type: 'ouvrage',  unite: 'forfait', rev: 1800,  marge: 22,  corps: 'Gros œuvre' },
    { id: 2,  nom: 'Pose placo BA13 sur ossature métallique',        type: 'ouvrage',  unite: 'm²',      rev: 28,    marge: 60,  corps: 'Second œuvre' },
    { id: 3,  nom: 'Électricité NFC 15-100 — rénovation complète',   type: 'ouvrage',  unite: 'forfait', rev: 3200,  marge: 50,  corps: 'Électricité' },
    { id: 4,  nom: 'Peinture acrylique mat 2 couches',               type: 'ouvrage',  unite: 'm²',      rev: 12,    marge: 130, corps: 'Second œuvre' },
    { id: 5,  nom: 'Ravalement façade — nettoyage + enduit',         type: 'ouvrage',  unite: 'm²',      rev: 35,    marge: 45,  corps: 'Gros œuvre' },
    { id: 6,  nom: 'Échafaudage façade — montage/démontage',         type: 'ouvrage',  unite: 'ml',      rev: 18,    marge: 55,  corps: 'Matériel' },
    { id: 7,  nom: 'Dépose + pose SDB complète',                     type: 'ouvrage',  unite: 'forfait', rev: 5500,  marge: 55,  corps: 'Second œuvre' },
    { id: 8,  nom: 'Étanchéité SPEC sous carrelage',                 type: 'ouvrage',  unite: 'm²',      rev: 22,    marge: 50,  corps: 'Second œuvre' },
    { id: 9,  nom: 'Pose carrelage antidérapant R11',                type: 'ouvrage',  unite: 'm²',      rev: 32,    marge: 50,  corps: 'Second œuvre' },
    { id: 10, nom: 'Faïence murale 30×60',                           type: 'ouvrage',  unite: 'm²',      rev: 28,    marge: 55,  corps: 'Second œuvre' },
    { id: 11, nom: 'Terrassement — décaissement fondations',         type: 'ouvrage',  unite: 'm³',      rev: 24,    marge: 45,  corps: 'VRD / Gros œuvre' },
    { id: 12, nom: 'Coulage semelles filantes béton C25/30',         type: 'ouvrage',  unite: 'ml',      rev: 85,    marge: 40,  corps: 'Gros œuvre' },
    { id: 13, nom: 'Maçonnerie parpaings creux 20cm',                type: 'ouvrage',  unite: 'm²',      rev: 38,    marge: 50,  corps: 'Gros œuvre' },
    { id: 14, nom: 'Chaînage horizontal béton armé',                 type: 'ouvrage',  unite: 'ml',      rev: 42,    marge: 45,  corps: 'Gros œuvre' },
    { id: 15, nom: 'Charpente bois traditionnelle — pose',           type: 'ouvrage',  unite: 'm²',      rev: 55,    marge: 50,  corps: 'Charpente / Couverture' },
    { id: 16, nom: 'Dalle béton armé 15cm (local commercial)',       type: 'ouvrage',  unite: 'm²',      rev: 65,    marge: 40,  corps: 'Gros œuvre' },
    { id: 17, nom: 'Cloisons + faux plafond BA13 local',             type: 'ouvrage',  unite: 'm²',      rev: 42,    marge: 55,  corps: 'Second œuvre' },
    { id: 18, nom: 'Menuiserie alu — vitrine commerciale',           type: 'ouvrage',  unite: 'unité',   rev: 2800,  marge: 30,  corps: 'Sous-traitance' },
    { id: 19, nom: 'Enduit de façade projeté monocouche',            type: 'ouvrage',  unite: 'm²',      rev: 24,    marge: 55,  corps: 'Gros œuvre' },
    { id: 20, nom: 'Nettoyage fin de chantier',                      type: 'ouvrage',  unite: 'forfait', rev: 800,   marge: 50,  corps: 'Autre' },
    // --- MATÉRIAUX ---
    { id: 21, nom: 'Placo BA13 standard (plaque 2,50m)',             type: 'materiau', unite: 'unité',   rev: 4.80,  marge: 40,  corps: 'Second œuvre' },
    { id: 22, nom: 'Rail R48 + montant M48 (3m)',                    type: 'materiau', unite: 'ml',      rev: 1.60,  marge: 45,  corps: 'Second œuvre' },
    { id: 23, nom: 'Câble électrique H07VR 2,5mm²',                  type: 'materiau', unite: 'ml',      rev: 1.20,  marge: 35,  corps: 'Électricité' },
    { id: 24, nom: 'Tableau électrique 3 rangées NF',                type: 'materiau', unite: 'unité',   rev: 180,   marge: 40,  corps: 'Électricité' },
    { id: 25, nom: 'Peinture acrylique mat Tollens (15L)',           type: 'materiau', unite: 'unité',   rev: 65,    marge: 45,  corps: 'Second œuvre' },
    { id: 26, nom: 'Enduit façade Weber monocouche (25kg)',          type: 'materiau', unite: 'sac',     rev: 12,    marge: 40,  corps: 'Gros œuvre' },
    { id: 27, nom: 'Peinture façade Tollens Façacryl (15L)',         type: 'materiau', unite: 'unité',   rev: 85,    marge: 35,  corps: 'Gros œuvre' },
    { id: 28, nom: 'Receveur douche extra-plat 120×90',              type: 'materiau', unite: 'unité',   rev: 280,   marge: 35,  corps: 'Second œuvre' },
    { id: 29, nom: 'Paroi douche verre 8mm 120cm',                   type: 'materiau', unite: 'unité',   rev: 320,   marge: 30,  corps: 'Second œuvre' },
    { id: 30, nom: 'Carrelage grès cérame antidérapant R11',         type: 'materiau', unite: 'm²',      rev: 22,    marge: 40,  corps: 'Second œuvre' },
    { id: 31, nom: 'Faïence murale 30×60 blanc satiné',              type: 'materiau', unite: 'm²',      rev: 18,    marge: 45,  corps: 'Second œuvre' },
    { id: 32, nom: 'Colle carrelage C2 flex (25kg)',                  type: 'materiau', unite: 'sac',     rev: 14,    marge: 40,  corps: 'Second œuvre' },
    { id: 33, nom: 'Joint époxy gris (5kg)',                          type: 'materiau', unite: 'unité',   rev: 28,    marge: 40,  corps: 'Second œuvre' },
    { id: 34, nom: 'Meuble vasque double 120cm',                     type: 'materiau', unite: 'unité',   rev: 450,   marge: 25,  corps: 'Second œuvre' },
    { id: 35, nom: 'Béton prêt C25/30 (livré toupie)',               type: 'materiau', unite: 'm³',      rev: 145,   marge: 30,  corps: 'Gros œuvre' },
    { id: 36, nom: 'Acier HA ø10 (barre 6m)',                        type: 'materiau', unite: 'ml',      rev: 1.80,  marge: 35,  corps: 'Gros œuvre' },
    { id: 37, nom: 'Parpaing creux 20×20×50',                        type: 'materiau', unite: 'unité',   rev: 1.10,  marge: 40,  corps: 'Gros œuvre' },
    { id: 38, nom: 'Ciment Portland CEM II (25kg)',                   type: 'materiau', unite: 'sac',     rev: 6.50,  marge: 40,  corps: 'Gros œuvre' },
    { id: 39, nom: 'Sable 0/4 (big bag 1T)',                         type: 'materiau', unite: 't',       rev: 45,    marge: 35,  corps: 'Gros œuvre' },
    { id: 40, nom: 'Tuile canal terre cuite',                        type: 'materiau', unite: 'unité',   rev: 1.80,  marge: 35,  corps: 'Charpente / Couverture' },
    // --- MAIN-D'ŒUVRE ---
    { id: 41, nom: "Main-d'œuvre chef de chantier",                  type: 'mo',       unite: 'heure',   rev: 32,    marge: 60,  corps: 'Équipe' },
    { id: 42, nom: "Main-d'œuvre ouvrier qualifié",                  type: 'mo',       unite: 'heure',   rev: 22,    marge: 55,  corps: 'Équipe' },
    { id: 43, nom: "Main-d'œuvre ouvrier",                           type: 'mo',       unite: 'heure',   rev: 16,    marge: 50,  corps: 'Équipe' },
    { id: 44, nom: "Main-d'œuvre conducteur de travaux",             type: 'mo',       unite: 'heure',   rev: 42,    marge: 65,  corps: 'Équipe' },
    { id: 45, nom: 'Sous-traitant électricité — forfait',            type: 'mo',       unite: 'forfait', rev: 4800,  marge: 25,  corps: 'Sous-traitance' },
    { id: 46, nom: 'Sous-traitant plomberie — forfait',              type: 'mo',       unite: 'forfait', rev: 6200,  marge: 25,  corps: 'Sous-traitance' },
    { id: 47, nom: 'Sous-traitant menuiserie alu — forfait',         type: 'mo',       unite: 'forfait', rev: 8500,  marge: 20,  corps: 'Sous-traitance' },
    { id: 48, nom: 'Location benne gravats 8m³',                     type: 'mo',       unite: 'jour',    rev: 120,   marge: 40,  corps: 'Matériel' },
    { id: 49, nom: 'Location nacelle 12m',                           type: 'mo',       unite: 'jour',    rev: 280,   marge: 30,  corps: 'Matériel' },
    { id: 50, nom: 'Location mini-pelle 1,5T',                       type: 'mo',       unite: 'jour',    rev: 195,   marge: 35,  corps: 'Matériel' },
  ]

  localStorage.setItem(`fixit_bibliotheque_${artisanId}`, JSON.stringify(bibliotheque))

  // Stamp version to prevent re-seeding on next load
  localStorage.setItem(`fixit_demo_seed_version_${artisanId}`, String(SEED_VERSION))

  console.log('[DEMO] localStorage seeded v' + SEED_VERSION + ': 5 chantiers, 5 devis, 4 factures, 3 rapports, 4 références, 5 clients, 16 dépenses, 3 situations, 3 retenues, 3 DC4, 2 DCE, 2 DPGF, 2 équipes, 8 pointages, 4 membres, 3 absences, portail client, 50 ouvrages/matériaux')
}
