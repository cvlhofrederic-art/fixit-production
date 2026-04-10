/**
 * Seed localStorage demo data for pro_societe dashboard.
 * Populates: devis, factures, rapports, portfolio — all coherent
 * with the Supabase BTP demo data (same clients, chantiers, amounts).
 *
 * Called once per session from the dashboard if demo data is missing.
 */

const DEMO_ARTISAN_ID = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const SEED_VERSION = 3 // Increment to force re-seed after adding new data

function isAlreadySeeded(artisanId: string): boolean {
  try {
    const version = localStorage.getItem(`fixit_demo_seed_version_${artisanId}`)
    if (version && parseInt(version, 10) >= SEED_VERSION) return true
  } catch { /* ignore */ }
  return false
}

export function seedDemoLocalStorage(artisanId: string): void {
  if (isAlreadySeeded(artisanId)) return
  // Only seed for the known demo account OR for accounts with no existing documents
  const hasExistingDocs = (() => {
    try {
      const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
      return docs.length > 0
    } catch { return false }
  })()
  if (artisanId !== DEMO_ARTISAN_ID && hasExistingDocs) return

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

  // Stamp version to prevent re-seeding on next load
  localStorage.setItem(`fixit_demo_seed_version_${artisanId}`, String(SEED_VERSION))

  console.log('[DEMO] localStorage seeded v' + SEED_VERSION + ': 5 devis, 4 factures, 3 rapports, 4 références, 5 clients, 16 dépenses, 3 situations, 3 retenues, 3 DC4, 2 DCE, 2 DPGF, 2 équipes, 8 pointages, 4 membres, 3 absences, portail client')
}
