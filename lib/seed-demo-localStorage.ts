/**
 * Seed localStorage demo data for pro_societe dashboard.
 * Populates: devis, factures, rapports, portfolio — all coherent
 * with the Supabase BTP demo data (same clients, chantiers, amounts).
 *
 * Called once per session from the dashboard if demo data is missing.
 */

const DEMO_ARTISAN_ID = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'

function isAlreadySeeded(artisanId: string): boolean {
  try {
    const docs = localStorage.getItem(`fixit_documents_${artisanId}`)
    if (docs) {
      const parsed = JSON.parse(docs)
      if (Array.isArray(parsed) && parsed.length > 0) return true
    }
  } catch { /* ignore */ }
  return false
}

export function seedDemoLocalStorage(artisanId: string): void {
  if (artisanId !== DEMO_ARTISAN_ID) return
  if (isAlreadySeeded(artisanId)) return

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
  ]

  localStorage.setItem(`fixit_documents_${artisanId}`, JSON.stringify(documents))
  localStorage.setItem(`fixit_drafts_${artisanId}`, JSON.stringify([]))

  // ═══════════════════════════════════════
  // RAPPORTS D'INTERVENTION
  // ═══════════════════════════════════════
  const rapports = [
    {
      id: 'demo-rap-001', rapportNumber: 'RAP-2026-001',
      createdAt: '2026-03-25T17:00:00Z',
      linkedBookingId: null, linkedPhotoIds: [],
      refDevisFact: 'DEV-2026-001',
      artisanName: 'Paca Bti Groupe', artisanAddress: '45 Av. du Prado, 13006 Marseille',
      artisanPhone: '04 91 00 00 00', artisanEmail: 'admincvlho@gmail.com',
      artisanSiret: '12345678900012', artisanInsurance: 'AXA n°RC-2026-4521',
      clientName: 'Mme Dupont Catherine', clientPhone: '06 11 22 33 44',
      clientEmail: 'c.dupont@email.fr', clientAddress: '42 Rue de la République, 13001 Marseille',
      interventionDate: '2026-03-25', startTime: '08:00', endTime: '17:00',
      siteAddress: '42 Rue de la République, 13001 Marseille',
      motif: 'Rénovation complète T3 — Phase démolition + placo',
      travaux: ['Démolition cloisons existantes', 'Évacuation gravats (3 bennes)', 'Pose rails + montants placo BA13', 'Passage gaines électriques'],
      materiaux: ['Placo BA13 standard (40 plaques)', 'Rails R48 + montants M48', 'Vis placo (2 boîtes)', 'Bande à joint (6 rouleaux)'],
      observations: 'Mur porteur identifié côté cuisine — nécessite avis structure avant ouverture. Gaine VMC existante en bon état, réutilisable.',
      recommendations: 'Prévoir étai provisoire pour ouverture mur porteur. Devis complémentaire IPN à chiffrer.',
      status: 'termine' as const, sentStatus: 'envoye' as const, sentAt: '2026-03-25T18:30:00Z',
    },
    {
      id: 'demo-rap-002', rapportNumber: 'RAP-2026-002',
      createdAt: '2026-03-28T17:30:00Z',
      linkedBookingId: null, linkedPhotoIds: [],
      refDevisFact: 'DEV-2026-003',
      artisanName: 'Paca Bti Groupe', artisanAddress: '45 Av. du Prado, 13006 Marseille',
      artisanPhone: '04 91 00 00 00', artisanEmail: 'admincvlho@gmail.com',
      artisanSiret: '12345678900012', artisanInsurance: 'AXA n°RC-2026-4521',
      clientName: 'M. et Mme Garcia', clientPhone: '06 77 88 99 00',
      clientEmail: 'garcia.fam@email.fr', clientAddress: '8 Chemin des Oliviers, 13012 Marseille',
      interventionDate: '2026-03-28', startTime: '07:30', endTime: '16:30',
      siteAddress: '8 Chemin des Oliviers, 13012 Marseille',
      motif: 'SDB complète — Dépose + plomberie + carrelage',
      travaux: ['Dépose baignoire + carrelage existant', 'Reprise alimentation eau chaude/froide', 'Pose receveur douche italienne', 'Étanchéité SPEC + carrelage sol 8m²'],
      materiaux: ['Receveur extra-plat 120x90', 'Paroi verre 8mm', 'Carrelage antidérapant R11', 'Colle flex C2 (3 sacs)', 'Joint époxy gris'],
      observations: 'Évacuation existante en bon état, raccordement direct possible. Mur support sain, pas besoin de reprise.',
      recommendations: 'Prévoir séchage étanchéité 48h avant pose carrelage mural. Faïence murale à poser semaine prochaine.',
      status: 'termine' as const, sentStatus: 'envoye' as const, sentAt: '2026-03-28T18:00:00Z',
    },
    {
      id: 'demo-rap-003', rapportNumber: 'RAP-2026-003',
      createdAt: '2026-04-08T17:00:00Z',
      linkedBookingId: null, linkedPhotoIds: [],
      refDevisFact: 'DEV-2026-004',
      artisanName: 'Paca Bti Groupe', artisanAddress: '45 Av. du Prado, 13006 Marseille',
      artisanPhone: '04 91 00 00 00', artisanEmail: 'admincvlho@gmail.com',
      artisanSiret: '12345678900012', artisanInsurance: 'AXA n°RC-2026-4521',
      clientName: 'M. Rossi Antoine', clientPhone: '06 44 55 66 77',
      clientEmail: 'a.rossi@email.fr', clientAddress: '15 Chemin de Paradis, 13008 Marseille',
      interventionDate: '2026-04-08', startTime: '07:00', endTime: '17:00',
      siteAddress: '15 Chemin de Paradis, 13008 Marseille',
      motif: 'Extension 30m² — Phase fondations + élévation murs',
      travaux: ['Coulage semelles filantes (6ml)', 'Ferraillage HA10 + étriers', 'Montée parpaings 20cm (rang 1 à 8)', 'Chaînage horizontal béton'],
      materiaux: ['Béton C25/30 (4m³)', 'Acier HA10 (200ml)', 'Parpaings creux 20 (480u)', 'Ciment CEM II (40 sacs)', 'Sable 0/4 (2T)'],
      observations: 'Sol porteur confirmé par étude G2 — pas de surprises. Fondations coulées niveau +0, aplomb vérifié au laser.',
      recommendations: 'Attendre 7 jours min avant charge sur fondations. Commande charpente à lancer cette semaine pour livraison S+3.',
      status: 'en_cours' as const, sentStatus: 'non_envoye' as const,
    },
  ]

  localStorage.setItem(`fixit_rapports_${artisanId}`, JSON.stringify(rapports))

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

  console.log('[DEMO] localStorage seeded: 5 devis, 4 factures, 3 rapports, 4 références')
}
