/**
 * Seed Demo BTP Pro — Données de démonstration COMPLÈTES
 *
 * Usage:
 *   npx tsx scripts/seed-demo-btp.ts          → Insère les données de démo
 *   npx tsx scripts/seed-demo-btp.ts --clean   → Supprime les données de démo
 *   npx tsx scripts/seed-demo-btp.ts --owner=<uuid>  → Force un owner spécifique
 *
 * Toutes les données de démo ont le tag [DEMO] pour identification/suppression.
 * Couvre TOUTES les sections du dashboard société BTP Pro.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const DEMO_TAG = '[DEMO]'

// ── Trouver le owner_id (premier artisan trouvé) ──
async function getOwnerId(): Promise<string> {
  const { data: settings } = await supabase.from('settings_btp').select('owner_id').limit(1).single()
  if (settings?.owner_id) return settings.owner_id

  const { data: membres } = await supabase.from('membres_btp').select('owner_id').limit(1).single()
  if (membres?.owner_id) return membres.owner_id

  const { data: chantiers } = await supabase.from('chantiers_btp').select('owner_id').limit(1).single()
  if (chantiers?.owner_id) return chantiers.owner_id

  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1 })
  if (users?.users?.[0]) return users.users[0].id

  console.error('❌ Aucun utilisateur trouvé')
  process.exit(1)
}

// ── SEED ──
async function seed() {
  const ownerArg = process.argv.find(a => a.startsWith('--owner='))
  const ownerId = ownerArg ? ownerArg.split('=')[1] : await getOwnerId()
  console.log(`📌 Owner ID: ${ownerId}`)

  // ═══════════════════════════════════════
  // 1. MEMBRES — 4 ouvriers
  // ═══════════════════════════════════════
  const membres = [
    {
      owner_id: ownerId,
      prenom: 'Lucas', nom: 'Ferreira',
      role_perso: `${DEMO_TAG} Chef de chantier`,
      type_compte: 'chef_chantier', type_contrat: 'cdi',
      cout_horaire: 18.50, charges_pct: 45,
      salaire_brut_mensuel: 2800, salaire_net_mensuel: 2184,
      charges_salariales_pct: 22, charges_patronales_pct: 45,
      heures_hebdo: 35, panier_repas_jour: 12, indemnite_trajet_jour: 8,
      prime_mensuelle: 200, actif: true,
      telephone: '06 12 34 56 78', email: 'lucas.f@demo.fr',
    },
    {
      owner_id: ownerId,
      prenom: 'Romain', nom: 'Duval',
      role_perso: `${DEMO_TAG} Maçon N3P2`,
      type_compte: 'ouvrier', type_contrat: 'cdi',
      cout_horaire: 15.00, charges_pct: 45,
      salaire_brut_mensuel: 2200, salaire_net_mensuel: 1716,
      charges_salariales_pct: 22, charges_patronales_pct: 45,
      heures_hebdo: 35, panier_repas_jour: 12, indemnite_trajet_jour: 8,
      prime_mensuelle: 0, actif: true,
      telephone: '06 22 33 44 55', email: 'romain.d@demo.fr',
    },
    {
      owner_id: ownerId,
      prenom: 'Karim', nom: 'Benali',
      role_perso: `${DEMO_TAG} Plaquiste / Peintre`,
      type_compte: 'ouvrier', type_contrat: 'cdi',
      cout_horaire: 14.00, charges_pct: 45,
      salaire_brut_mensuel: 2000, salaire_net_mensuel: 1560,
      charges_salariales_pct: 22, charges_patronales_pct: 45,
      heures_hebdo: 35, panier_repas_jour: 12, indemnite_trajet_jour: 6,
      prime_mensuelle: 0, actif: true,
      telephone: '06 55 66 77 88', email: 'karim.b@demo.fr',
    },
    {
      owner_id: ownerId,
      prenom: 'Yassine', nom: 'Toumi',
      role_perso: `${DEMO_TAG} Apprenti 2ème année`,
      type_compte: 'ouvrier', type_contrat: 'apprenti',
      cout_horaire: 8.50, charges_pct: 30,
      salaire_brut_mensuel: 1200, salaire_net_mensuel: 1020,
      charges_salariales_pct: 15, charges_patronales_pct: 30,
      heures_hebdo: 35, panier_repas_jour: 10, indemnite_trajet_jour: 5,
      prime_mensuelle: 0, actif: true,
      telephone: '06 99 00 11 22', email: 'yassine.t@demo.fr',
    },
  ]

  console.log('👷 Insertion des 4 membres...')
  const { data: insertedMembres, error: errMembres } = await supabase
    .from('membres_btp').insert(membres).select()
  if (errMembres) { console.error('❌ Membres:', errMembres.message); return }
  console.log(`✅ ${insertedMembres!.length} membres créés`)

  // ═══════════════════════════════════════
  // 2. CHANTIERS — 5 projets
  // ═══════════════════════════════════════
  const chantiers = [
    {
      owner_id: ownerId,
      titre: 'Rénovation complète T3 — Rue de la République',
      client: 'Mme Dupont Catherine',
      adresse: '42 Rue de la République, 13001 Marseille',
      latitude: 43.2965, longitude: 5.3698, geo_rayon_m: 100,
      date_debut: '2026-03-10', date_fin: '2026-04-04',
      budget: 28500, statut: 'En cours',
      description: `${DEMO_TAG} Rénovation complète T3 : démolition, placo, électricité, peinture, carrelage SDB + cuisine`,
      equipe: 'Équipe A', marge_prevue_pct: 30,
      tva_taux: 10, montant_facture: 28500, acompte_recu: 8550, penalite_retard_jour: 150,
    },
    {
      owner_id: ownerId,
      titre: 'Ravalement façade immeuble — Bd Longchamp',
      client: 'Syndic Foncia — Résidence Les Pins',
      adresse: '18 Boulevard Longchamp, 13001 Marseille',
      latitude: 43.2988, longitude: 5.3890, geo_rayon_m: 150,
      date_debut: '2026-04-14', date_fin: '2026-05-16',
      budget: 45000, statut: 'En attente',
      description: `${DEMO_TAG} Ravalement R+4, échafaudage, nettoyage HP, enduit, peinture façade, zinguerie`,
      equipe: 'Équipe A', marge_prevue_pct: 25,
      tva_taux: 10, montant_facture: 45000, acompte_recu: 0, penalite_retard_jour: 200,
    },
    {
      owner_id: ownerId,
      titre: 'SDB complète — Villa Les Oliviers',
      client: 'M. et Mme Garcia',
      adresse: '8 Chemin des Oliviers, 13012 Marseille',
      latitude: 43.3102, longitude: 5.4320, geo_rayon_m: 80,
      date_debut: '2026-03-17', date_fin: '2026-03-28',
      budget: 12800, statut: 'En cours',
      description: `${DEMO_TAG} Salle de bain complète : dépose, plomberie, carrelage sol+murs, meuble vasque, douche italienne`,
      equipe: 'Équipe A', marge_prevue_pct: 35,
      tva_taux: 10, montant_facture: 12800, acompte_recu: 3840, penalite_retard_jour: 100,
    },
    {
      owner_id: ownerId,
      titre: 'Extension maison individuelle — Chemin de Paradis',
      client: 'M. Rossi Antoine',
      adresse: '15 Chemin de Paradis, 13008 Marseille',
      latitude: 43.2580, longitude: 5.3895, geo_rayon_m: 100,
      date_debut: '2026-04-01', date_fin: '2026-05-30',
      budget: 62000, statut: 'En cours',
      description: `${DEMO_TAG} Extension 30m² : fondations, élévation murs, charpente, toiture, menuiseries, isolation, finitions intérieures`,
      equipe: 'Équipe A', marge_prevue_pct: 28,
      tva_taux: 20, montant_facture: 62000, acompte_recu: 18600, penalite_retard_jour: 250,
    },
    {
      owner_id: ownerId,
      titre: 'Réhabilitation local commercial — Cours Julien',
      client: 'SCI Les Terrasses du Sud',
      adresse: '24 Cours Julien, 13006 Marseille',
      latitude: 43.2925, longitude: 5.3835, geo_rayon_m: 120,
      date_debut: '2026-03-25', date_fin: '2026-04-25',
      budget: 38000, statut: 'En cours',
      description: `${DEMO_TAG} Transformation local commercial 80m² : décloisonnement, dalle béton, plomberie, électricité NFC, faux plafond, vitrine`,
      equipe: 'Équipe B', marge_prevue_pct: 22,
      tva_taux: 20, montant_facture: 38000, acompte_recu: 11400, penalite_retard_jour: 180,
    },
  ]

  console.log('🏗️ Insertion des 5 chantiers...')
  const { data: insertedChantiers, error: errChantiers } = await supabase
    .from('chantiers_btp').insert(chantiers).select()
  if (errChantiers) { console.error('❌ Chantiers:', errChantiers.message); return }
  console.log(`✅ ${insertedChantiers!.length} chantiers créés`)

  const chantierIds = insertedChantiers!.map((c: any) => c.id)
  const membreIds = insertedMembres!.map((m: any) => m.id)

  // ═══════════════════════════════════════
  // 3. ÉQUIPES — 2 équipes avec affectations
  // ═══════════════════════════════════════
  const equipes = [
    { owner_id: ownerId, nom: `${DEMO_TAG} Équipe A — Rénovation`, metier: 'Tous corps d\'état', chantier_id: chantierIds[0] },
    { owner_id: ownerId, nom: `${DEMO_TAG} Équipe B — Gros œuvre`, metier: 'Maçonnerie / Structure', chantier_id: chantierIds[4] },
  ]

  console.log('👥 Insertion des 2 équipes...')
  const { data: insertedEquipes, error: errEquipes } = await supabase
    .from('equipes_btp').insert(equipes).select()
  if (errEquipes) { console.error('❌ Équipes:', errEquipes.message) }
  else {
    console.log(`✅ ${insertedEquipes!.length} équipes créées`)

    // Affectations : Équipe A = Lucas + Karim + Yassine, Équipe B = Romain + Yassine
    const affectations = [
      { equipe_id: insertedEquipes![0].id, membre_id: membreIds[0] }, // Lucas → Équipe A
      { equipe_id: insertedEquipes![0].id, membre_id: membreIds[2] }, // Karim → Équipe A
      { equipe_id: insertedEquipes![0].id, membre_id: membreIds[3] }, // Yassine → Équipe A
      { equipe_id: insertedEquipes![1].id, membre_id: membreIds[1] }, // Romain → Équipe B
      { equipe_id: insertedEquipes![1].id, membre_id: membreIds[3] }, // Yassine → Équipe B
    ]
    const { error: errAff } = await supabase.from('equipe_membres_btp').insert(affectations)
    if (errAff) console.error('❌ Affectations:', errAff.message)
    else console.log('✅ 5 affectations équipes créées')
  }

  // ═══════════════════════════════════════
  // 4. SETTINGS BTP
  // ═══════════════════════════════════════
  console.log('⚙️ Vérification/mise à jour settings...')
  await supabase.from('settings_btp').upsert({
    owner_id: ownerId,
    country: 'FR',
    company_type: 'sarl',
    statut_juridique: 'sarl',
    salaire_patron_mensuel: 3500,
    salaire_patron_type: 'net',
    taux_cotisations_patron: 45,
    taux_is: 25,
    charges_patronales_pct: 45,
    cout_horaire_ouvrier: 15,
    objectif_marge_pct: 25,
    amortissements_mensuels: 400,
    regime_tva: 'reel_simplifie',
    frais_fixes_mensuels: [
      { label: 'Loyer dépôt/bureau', montant: 1200, frequence: 'mensuel' },
      { label: 'Assurance RC Pro + Décennale', montant: 350, frequence: 'mensuel' },
      { label: 'Expert-comptable', montant: 250, frequence: 'mensuel' },
      { label: 'Véhicules (leasing + essence)', montant: 800, frequence: 'mensuel' },
      { label: 'Téléphonie + Internet', montant: 120, frequence: 'mensuel' },
    ],
    updated_at: new Date().toISOString(),
  })
  console.log('✅ Settings configurés')

  // ═══════════════════════════════════════
  // 5. DEVIS — 5 devis
  // ═══════════════════════════════════════
  const { data: artisan } = await supabase
    .from('artisans').select('id').eq('user_id', ownerId).single()
  const artisanId = artisan?.id || ownerId

  const devisData = [
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'DEV-DEMO-001',
      client_name: 'Mme Dupont Catherine', client_email: 'c.dupont@demo.fr',
      client_phone: '06 11 22 33 44', client_address: '42 Rue de la République, 13001 Marseille',
      status: 'signed', currency: 'EUR', country: 'FR',
      tax_rate: 10, tax_label: 'TVA 10%',
      total_ht_cents: 2850000, total_tax_cents: 285000, total_ttc_cents: 3135000,
      notes: `${DEMO_TAG} Rénovation complète T3 — Rue de la République`,
      items: JSON.stringify([
        { description: 'Démolition cloisons + évacuation gravats', qty: 1, priceHT: 2200, totalHT: 2200, unite: 'forfait', tvaRate: 10 },
        { description: 'Placo BA13 — fourniture + pose (85m²)', qty: 85, priceHT: 45, totalHT: 3825, unite: 'm²', tvaRate: 10 },
        { description: 'Électricité — mise aux normes NFC 15-100', qty: 1, priceHT: 4800, totalHT: 4800, unite: 'forfait', tvaRate: 10 },
        { description: 'Peinture 2 couches (murs + plafonds 120m²)', qty: 120, priceHT: 28, totalHT: 3360, unite: 'm²', tvaRate: 10 },
        { description: 'Carrelage sol SDB (12m²)', qty: 12, priceHT: 85, totalHT: 1020, unite: 'm²', tvaRate: 10 },
        { description: 'Faïence murale SDB (18m²)', qty: 18, priceHT: 75, totalHT: 1350, unite: 'm²', tvaRate: 10 },
        { description: 'Cuisine — pose meubles + plan travail', qty: 1, priceHT: 3500, totalHT: 3500, unite: 'forfait', tvaRate: 10 },
        { description: 'Plomberie SDB + cuisine', qty: 1, priceHT: 4200, totalHT: 4200, unite: 'forfait', tvaRate: 10 },
        { description: 'Parquet stratifié séjour + chambres (45m²)', qty: 45, priceHT: 52, totalHT: 2340, unite: 'm²', tvaRate: 10 },
        { description: 'Nettoyage fin de chantier', qty: 1, priceHT: 1905, totalHT: 1905, unite: 'forfait', tvaRate: 10 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'DEV-DEMO-002',
      client_name: 'Syndic Foncia — Résidence Les Pins', client_email: 'foncia.pins@demo.fr',
      client_phone: '04 91 00 00 00', client_address: '18 Boulevard Longchamp, 13001 Marseille',
      status: 'sent', currency: 'EUR', country: 'FR',
      tax_rate: 10, tax_label: 'TVA 10%',
      total_ht_cents: 4500000, total_tax_cents: 450000, total_ttc_cents: 4950000,
      notes: `${DEMO_TAG} Ravalement façade R+4 — Bd Longchamp`,
      items: JSON.stringify([
        { description: 'Installation échafaudage R+4 (façade 320m²)', qty: 1, priceHT: 6500, totalHT: 6500, unite: 'forfait', tvaRate: 10 },
        { description: 'Nettoyage haute pression façade', qty: 320, priceHT: 12, totalHT: 3840, unite: 'm²', tvaRate: 10 },
        { description: 'Réparation fissures + rebouchage', qty: 1, priceHT: 3200, totalHT: 3200, unite: 'forfait', tvaRate: 10 },
        { description: 'Enduit de façade monocouche (320m²)', qty: 320, priceHT: 42, totalHT: 13440, unite: 'm²', tvaRate: 10 },
        { description: 'Peinture façade 2 couches (320m²)', qty: 320, priceHT: 25, totalHT: 8000, unite: 'm²', tvaRate: 10 },
        { description: 'Zinguerie — gouttières + descentes EP', qty: 1, priceHT: 4800, totalHT: 4800, unite: 'forfait', tvaRate: 10 },
        { description: 'Démontage échafaudage + nettoyage', qty: 1, priceHT: 5220, totalHT: 5220, unite: 'forfait', tvaRate: 10 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'DEV-DEMO-003',
      client_name: 'M. et Mme Garcia', client_email: 'garcia.fam@demo.fr',
      client_phone: '06 77 88 99 00', client_address: '8 Chemin des Oliviers, 13012 Marseille',
      status: 'signed', currency: 'EUR', country: 'FR',
      tax_rate: 10, tax_label: 'TVA 10%',
      total_ht_cents: 1280000, total_tax_cents: 128000, total_ttc_cents: 1408000,
      notes: `${DEMO_TAG} SDB complète — Villa Les Oliviers`,
      items: JSON.stringify([
        { description: 'Dépose sanitaires + carrelage existant', qty: 1, priceHT: 1200, totalHT: 1200, unite: 'forfait', tvaRate: 10 },
        { description: 'Plomberie complète (alimentation + évacuation)', qty: 1, priceHT: 2800, totalHT: 2800, unite: 'forfait', tvaRate: 10 },
        { description: 'Carrelage sol antidérapant (8m²)', qty: 8, priceHT: 95, totalHT: 760, unite: 'm²', tvaRate: 10 },
        { description: 'Faïence murale (22m²)', qty: 22, priceHT: 78, totalHT: 1716, unite: 'm²', tvaRate: 10 },
        { description: 'Receveur douche italienne + paroi', qty: 1, priceHT: 2200, totalHT: 2200, unite: 'forfait', tvaRate: 10 },
        { description: 'Meuble vasque double + miroir', qty: 1, priceHT: 1800, totalHT: 1800, unite: 'forfait', tvaRate: 10 },
        { description: 'Sèche-serviette électrique', qty: 1, priceHT: 520, totalHT: 520, unite: 'u', tvaRate: 10 },
        { description: 'Finitions + joints silicone + nettoyage', qty: 1, priceHT: 1804, totalHT: 1804, unite: 'forfait', tvaRate: 10 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'DEV-DEMO-004',
      client_name: 'M. Rossi Antoine', client_email: 'a.rossi@demo.fr',
      client_phone: '06 44 55 66 77', client_address: '15 Chemin de Paradis, 13008 Marseille',
      status: 'signed', currency: 'EUR', country: 'FR',
      tax_rate: 20, tax_label: 'TVA 20%',
      total_ht_cents: 6200000, total_tax_cents: 1240000, total_ttc_cents: 7440000,
      notes: `${DEMO_TAG} Extension maison individuelle — Chemin de Paradis`,
      items: JSON.stringify([
        { description: 'Terrassement + fondations semelles filantes', qty: 1, priceHT: 8500, totalHT: 8500, unite: 'forfait', tvaRate: 20 },
        { description: 'Élévation murs parpaing (30m²)', qty: 30, priceHT: 180, totalHT: 5400, unite: 'm²', tvaRate: 20 },
        { description: 'Charpente traditionnelle + couverture tuiles', qty: 1, priceHT: 14000, totalHT: 14000, unite: 'forfait', tvaRate: 20 },
        { description: 'Menuiseries alu (3 fenêtres + 1 baie vitrée)', qty: 4, priceHT: 2800, totalHT: 11200, unite: 'u', tvaRate: 20 },
        { description: 'Isolation thermique ITE (60m²)', qty: 60, priceHT: 120, totalHT: 7200, unite: 'm²', tvaRate: 20 },
        { description: 'Électricité + plomberie extension', qty: 1, priceHT: 6200, totalHT: 6200, unite: 'forfait', tvaRate: 20 },
        { description: 'Placo + peinture finitions intérieures', qty: 1, priceHT: 9500, totalHT: 9500, unite: 'forfait', tvaRate: 20 },
      ]),
    },
    {
      artisan_id: artisanId, artisan_user_id: ownerId,
      numero: 'DEV-DEMO-005',
      client_name: 'SCI Les Terrasses du Sud', client_email: 'contact@terrasses-sud.fr',
      client_phone: '04 91 55 66 77', client_address: '24 Cours Julien, 13006 Marseille',
      status: 'signed', currency: 'EUR', country: 'FR',
      tax_rate: 20, tax_label: 'TVA 20%',
      total_ht_cents: 3800000, total_tax_cents: 760000, total_ttc_cents: 4560000,
      notes: `${DEMO_TAG} Réhabilitation local commercial — Cours Julien`,
      items: JSON.stringify([
        { description: 'Démolition cloisons + évacuation', qty: 1, priceHT: 3200, totalHT: 3200, unite: 'forfait', tvaRate: 20 },
        { description: 'Dalle béton surfacée (80m²)', qty: 80, priceHT: 65, totalHT: 5200, unite: 'm²', tvaRate: 20 },
        { description: 'Plomberie complète (sanitaires + cuisine pro)', qty: 1, priceHT: 5500, totalHT: 5500, unite: 'forfait', tvaRate: 20 },
        { description: 'Mise aux normes électrique NFC 15-100', qty: 1, priceHT: 7200, totalHT: 7200, unite: 'forfait', tvaRate: 20 },
        { description: 'Faux plafond acoustique (80m²)', qty: 80, priceHT: 55, totalHT: 4400, unite: 'm²', tvaRate: 20 },
        { description: 'Vitrine commerciale alu + verre feuilleté', qty: 1, priceHT: 8500, totalHT: 8500, unite: 'forfait', tvaRate: 20 },
        { description: 'Peinture + finitions', qty: 1, priceHT: 4000, totalHT: 4000, unite: 'forfait', tvaRate: 20 },
      ]),
    },
  ]

  console.log('📄 Insertion des 5 devis...')
  const { data: insertedDevis, error: errDevis } = await supabase.from('devis').insert(devisData).select()
  if (errDevis) console.error('❌ Devis:', errDevis.message)
  else console.log(`✅ ${insertedDevis!.length} devis créés`)

  // ═══════════════════════════════════════
  // 6. DÉPENSES — 13 dépenses
  // ═══════════════════════════════════════
  const depenses = [
    { owner_id: ownerId, chantier_id: chantierIds[0], date: '2026-03-12', label: `${DEMO_TAG} Matériaux placo + rails`, amount: 1450, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[0], date: '2026-03-15', label: `${DEMO_TAG} Peinture Tollens (4 seaux)`, amount: 380, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[0], date: '2026-03-18', label: `${DEMO_TAG} Électricité — câbles + tableau`, amount: 820, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[0], date: '2026-03-20', label: `${DEMO_TAG} Location benne gravats`, amount: 350, category: 'location' },
    { owner_id: ownerId, chantier_id: chantierIds[2], date: '2026-03-18', label: `${DEMO_TAG} Carrelage + faïence SDB`, amount: 1100, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[2], date: '2026-03-19', label: `${DEMO_TAG} Receveur douche + paroi`, amount: 890, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[2], date: '2026-03-21', label: `${DEMO_TAG} Meuble vasque + miroir`, amount: 750, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[3], date: '2026-04-02', label: `${DEMO_TAG} Béton fondations + ferraillage`, amount: 3200, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[3], date: '2026-04-05', label: `${DEMO_TAG} Parpaings + ciment élévation`, amount: 2100, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[3], date: '2026-04-07', label: `${DEMO_TAG} Location mini-pelle 3j`, amount: 580, category: 'location' },
    { owner_id: ownerId, chantier_id: chantierIds[4], date: '2026-03-26', label: `${DEMO_TAG} Démolition — location marteau-piqueur`, amount: 320, category: 'location' },
    { owner_id: ownerId, chantier_id: chantierIds[4], date: '2026-03-28', label: `${DEMO_TAG} Béton prêt à l'emploi dalle (6m³)`, amount: 1800, category: 'materiaux' },
    { owner_id: ownerId, chantier_id: chantierIds[4], date: '2026-04-01', label: `${DEMO_TAG} Câblage électrique NFC`, amount: 1250, category: 'materiaux' },
  ]

  console.log('💸 Insertion des 13 dépenses...')
  const { data: insertedDep, error: errDep } = await supabase.from('depenses_btp').insert(depenses).select()
  if (errDep) console.error('❌ Dépenses:', errDep.message)
  else console.log(`✅ ${insertedDep!.length} dépenses créées`)

  // ═══════════════════════════════════════
  // 7. POINTAGES — 20 pointages (5 jours × 4 ouvriers)
  // ═══════════════════════════════════════
  const pointages: any[] = []
  const joursPointage = ['2026-04-07', '2026-04-08', '2026-04-09', '2026-04-04', '2026-04-03']
  const membresNoms = ['Lucas Ferreira', 'Romain Duval', 'Karim Benali', 'Yassine Toumi']
  const membresPostes = ['Chef de chantier', 'Maçon N3P2', 'Plaquiste / Peintre', 'Apprenti']

  for (let d = 0; d < joursPointage.length; d++) {
    for (let m = 0; m < 4; m++) {
      const heureArr = m === 0 ? '07:00' : m === 3 ? '08:00' : '07:30'
      const heureDep = m === 3 ? '16:00' : '17:00'
      const pause = 60
      const heuresTrav = m === 3 ? 7.0 : (m === 0 ? 9.0 : 8.5)
      // Assign to different chantiers
      const chIdx = d < 2 ? 0 : d < 4 ? 3 : 4

      pointages.push({
        owner_id: ownerId,
        membre_id: membreIds[m],
        chantier_id: chantierIds[chIdx],
        employe: membresNoms[m],
        poste: `${DEMO_TAG} ${membresPostes[m]}`,
        chantier_nom: insertedChantiers![chIdx].titre,
        date: joursPointage[d],
        heure_arrivee: heureArr,
        heure_depart: heureDep,
        pause_minutes: pause,
        heures_travaillees: heuresTrav,
        notes: d === 0 && m === 0 ? `${DEMO_TAG} RAS — avancement normal` : null,
        mode: d < 3 ? 'geo_confirme' : 'manuel',
        arrivee_lat: insertedChantiers![chIdx].latitude + (Math.random() - 0.5) * 0.0005,
        arrivee_lng: insertedChantiers![chIdx].longitude + (Math.random() - 0.5) * 0.0005,
        depart_lat: insertedChantiers![chIdx].latitude + (Math.random() - 0.5) * 0.0005,
        depart_lng: insertedChantiers![chIdx].longitude + (Math.random() - 0.5) * 0.0005,
        distance_m: Math.floor(Math.random() * 50) + 5,
      })
    }
  }

  console.log('⏱️ Insertion des 20 pointages...')
  const { data: insertedPt, error: errPt } = await supabase.from('pointages_btp').insert(pointages).select()
  if (errPt) console.error('❌ Pointages:', errPt.message)
  else console.log(`✅ ${insertedPt!.length} pointages créés`)

  // ═══════════════════════════════════════
  // 8. SITUATIONS DE TRAVAUX — 3 situations
  // ═══════════════════════════════════════
  const situations = [
    {
      owner_id: ownerId,
      chantier: insertedChantiers![0].titre,
      client: 'Mme Dupont Catherine',
      numero: 1,
      date: '2026-03-25',
      montant_marche: 28500,
      statut: 'validée',
      travaux: [
        { poste: 'Démolition cloisons', quantite: 1, unite: 'forfait', prixUnit: 2200, avancement: 100 },
        { poste: 'Placo BA13 (85m²)', quantite: 85, unite: 'm²', prixUnit: 45, avancement: 80 },
        { poste: 'Électricité NFC 15-100', quantite: 1, unite: 'forfait', prixUnit: 4800, avancement: 60 },
        { poste: 'Peinture 2 couches', quantite: 120, unite: 'm²', prixUnit: 28, avancement: 30 },
        { poste: 'Carrelage SDB', quantite: 12, unite: 'm²', prixUnit: 85, avancement: 0 },
        { poste: 'Plomberie', quantite: 1, unite: 'forfait', prixUnit: 4200, avancement: 50 },
      ],
    },
    {
      owner_id: ownerId,
      chantier: insertedChantiers![3].titre,
      client: 'M. Rossi Antoine',
      numero: 1,
      date: '2026-04-08',
      montant_marche: 62000,
      statut: 'envoyée',
      travaux: [
        { poste: 'Terrassement + fondations', quantite: 1, unite: 'forfait', prixUnit: 8500, avancement: 100 },
        { poste: 'Élévation murs parpaing', quantite: 30, unite: 'm²', prixUnit: 180, avancement: 70 },
        { poste: 'Charpente + couverture', quantite: 1, unite: 'forfait', prixUnit: 14000, avancement: 0 },
        { poste: 'Menuiseries alu', quantite: 4, unite: 'u', prixUnit: 2800, avancement: 0 },
        { poste: 'Isolation ITE', quantite: 60, unite: 'm²', prixUnit: 120, avancement: 0 },
        { poste: 'Électricité + plomberie', quantite: 1, unite: 'forfait', prixUnit: 6200, avancement: 10 },
        { poste: 'Finitions intérieures', quantite: 1, unite: 'forfait', prixUnit: 9500, avancement: 0 },
      ],
    },
    {
      owner_id: ownerId,
      chantier: insertedChantiers![4].titre,
      client: 'SCI Les Terrasses du Sud',
      numero: 1,
      date: '2026-04-05',
      montant_marche: 38000,
      statut: 'payée',
      travaux: [
        { poste: 'Démolition cloisons', quantite: 1, unite: 'forfait', prixUnit: 3200, avancement: 100 },
        { poste: 'Dalle béton 80m²', quantite: 80, unite: 'm²', prixUnit: 65, avancement: 100 },
        { poste: 'Plomberie', quantite: 1, unite: 'forfait', prixUnit: 5500, avancement: 60 },
        { poste: 'Électricité NFC', quantite: 1, unite: 'forfait', prixUnit: 7200, avancement: 40 },
        { poste: 'Faux plafond', quantite: 80, unite: 'm²', prixUnit: 55, avancement: 0 },
        { poste: 'Vitrine commerciale', quantite: 1, unite: 'forfait', prixUnit: 8500, avancement: 0 },
        { poste: 'Peinture + finitions', quantite: 1, unite: 'forfait', prixUnit: 4000, avancement: 0 },
      ],
    },
  ]

  console.log('📊 Insertion des 3 situations de travaux...')
  const { data: insertedSit, error: errSit } = await supabase.from('situations_btp').insert(situations).select()
  if (errSit) console.error('❌ Situations:', errSit.message)
  else console.log(`✅ ${insertedSit!.length} situations créées`)

  // ═══════════════════════════════════════
  // 9. RETENUES DE GARANTIE — 3 retenues
  // ═══════════════════════════════════════
  const retenues = [
    {
      owner_id: ownerId,
      chantier: insertedChantiers![0].titre,
      client: 'Mme Dupont Catherine',
      montant_marche: 28500,
      taux_retenue: 5,
      montant_retenu: 1425,
      date_fin_travaux: '2026-04-04',
      date_liberation: null,
      statut: 'active',
      caution: false,
    },
    {
      owner_id: ownerId,
      chantier: insertedChantiers![3].titre,
      client: 'M. Rossi Antoine',
      montant_marche: 62000,
      taux_retenue: 5,
      montant_retenu: 3100,
      date_fin_travaux: '2026-05-30',
      date_liberation: null,
      statut: 'active',
      caution: false,
    },
    {
      owner_id: ownerId,
      chantier: insertedChantiers![4].titre,
      client: 'SCI Les Terrasses du Sud',
      montant_marche: 38000,
      taux_retenue: 5,
      montant_retenu: 1900,
      date_fin_travaux: '2026-04-25',
      date_liberation: null,
      statut: 'mainlevée_demandée',
      caution: true,
    },
  ]

  console.log('🔒 Insertion des 3 retenues de garantie...')
  const { data: insertedRet, error: errRet } = await supabase.from('retenues_btp').insert(retenues).select()
  if (errRet) console.error('❌ Retenues:', errRet.message)
  else console.log(`✅ ${insertedRet!.length} retenues créées`)

  // ═══════════════════════════════════════
  // 10. SOUS-TRAITANCE DC4 — 3 sous-traitants
  // ═══════════════════════════════════════
  const dc4 = [
    {
      owner_id: ownerId,
      entreprise: `${DEMO_TAG} SARL Élec Sud`,
      siret: '44455566677788',
      responsable: 'M. Martinez Paul',
      email: 'contact@elec-sud.demo.fr',
      telephone: '04 91 22 33 44',
      adresse: '12 Rue Paradis, 13001 Marseille',
      chantier: insertedChantiers![0].titre,
      lot: 'Lot 3 — Électricité',
      montant_marche: 4800,
      taux_tva: 10,
      statut: 'agréé',
      date_agrement: '2026-03-08',
      dc4_genere: true,
    },
    {
      owner_id: ownerId,
      entreprise: `${DEMO_TAG} ETS Plomberie Martin`,
      siret: '55566677788899',
      responsable: 'M. Martin Gérard',
      email: 'martin.plomberie@demo.fr',
      telephone: '06 33 44 55 66',
      adresse: '5 Avenue du Prado, 13008 Marseille',
      chantier: insertedChantiers![2].titre,
      lot: 'Lot 2 — Plomberie complète',
      montant_marche: 2800,
      taux_tva: 10,
      statut: 'agréé',
      date_agrement: '2026-03-15',
      dc4_genere: true,
    },
    {
      owner_id: ownerId,
      entreprise: `${DEMO_TAG} Menuiseries Alu Provence`,
      siret: '66677788899900',
      responsable: 'Mme Leroy Sophie',
      email: 'contact@alu-provence.demo.fr',
      telephone: '04 91 77 88 99',
      adresse: '28 Bd Michelet, 13009 Marseille',
      chantier: insertedChantiers![3].titre,
      lot: 'Lot 5 — Menuiseries extérieures',
      montant_marche: 11200,
      taux_tva: 20,
      statut: 'en_attente',
      date_agrement: null,
      dc4_genere: false,
    },
  ]

  console.log('📋 Insertion des 3 sous-traitants DC4...')
  const { data: insertedDc4, error: errDc4 } = await supabase.from('dc4_btp').insert(dc4).select()
  if (errDc4) console.error('❌ DC4:', errDc4.message)
  else console.log(`✅ ${insertedDc4!.length} sous-traitants DC4 créés`)

  // ═══════════════════════════════════════
  // 11. DPGF / APPELS D'OFFRES — 2 AO
  // ═══════════════════════════════════════
  const dpgf = [
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} AO — Rénovation école primaire Jean Jaurès`,
      client: 'Mairie de Marseille — Direction des bâtiments',
      date_remise: '2026-04-20',
      montant_estime: 185000,
      statut: 'en_cours',
      lots: [
        { numero: 'Lot 1', designation: 'Gros œuvre — Maçonnerie', montantHT: 52000 },
        { numero: 'Lot 2', designation: 'Charpente / Couverture', montantHT: 38000 },
        { numero: 'Lot 3', designation: 'Électricité CFO/CFA', montantHT: 31000 },
        { numero: 'Lot 4', designation: 'Plomberie / CVC', montantHT: 28000 },
        { numero: 'Lot 5', designation: 'Menuiseries intérieures + extérieures', montantHT: 22000 },
        { numero: 'Lot 6', designation: 'Peinture / Revêtements', montantHT: 14000 },
      ],
    },
    {
      owner_id: ownerId,
      titre: `${DEMO_TAG} AO — Résidence seniors Les Calanques`,
      client: 'Habitat Marseille Provence (HMP)',
      date_remise: '2026-05-10',
      montant_estime: 320000,
      statut: 'soumis',
      lots: [
        { numero: 'Lot 1', designation: 'VRD + Terrassement', montantHT: 45000 },
        { numero: 'Lot 2', designation: 'Gros œuvre', montantHT: 95000 },
        { numero: 'Lot 3', designation: 'Étanchéité + Isolation', montantHT: 42000 },
        { numero: 'Lot 4', designation: 'Menuiseries PMR', montantHT: 35000 },
        { numero: 'Lot 5', designation: 'Plomberie + Sanitaires adaptés', montantHT: 38000 },
        { numero: 'Lot 6', designation: 'Électricité + SSI', montantHT: 41000 },
        { numero: 'Lot 7', designation: 'Finitions + Signalétique', montantHT: 24000 },
      ],
    },
  ]

  console.log('📑 Insertion des 2 appels d\'offres DPGF...')
  const { data: insertedDpgf, error: errDpgf } = await supabase.from('dpgf_btp').insert(dpgf).select()
  if (errDpgf) console.error('❌ DPGF:', errDpgf.message)
  else console.log(`✅ ${insertedDpgf!.length} AO/DPGF créés`)

  // ═══════════════════════════════════════
  // 12. COMPTES UTILISATEURS FICTIFS — 5 comptes d'équipe
  // ═══════════════════════════════════════
  const proTeamMembers = [
    {
      company_id: ownerId,
      user_id: null,
      email: 'lucas.ferreira@demo-paca-bti.fr',
      full_name: `${DEMO_TAG} Lucas Ferreira`,
      phone: '06 12 34 56 78',
      role: 'CHEF_CHANTIER',
      assigned_chantiers: [chantierIds[0], chantierIds[2]],
      invite_sent_at: '2026-03-01T10:00:00Z',
      accepted_at: '2026-03-01T14:30:00Z',
      last_login_at: '2026-04-08T07:15:00Z',
      is_active: true,
    },
    {
      company_id: ownerId,
      user_id: null,
      email: 'romain.duval@demo-paca-bti.fr',
      full_name: `${DEMO_TAG} Romain Duval`,
      phone: '06 22 33 44 55',
      role: 'OUVRIER',
      assigned_chantiers: [chantierIds[3], chantierIds[4]],
      invite_sent_at: '2026-03-01T10:00:00Z',
      accepted_at: '2026-03-02T09:00:00Z',
      last_login_at: '2026-04-07T07:30:00Z',
      is_active: true,
    },
    {
      company_id: ownerId,
      user_id: null,
      email: 'nadia.sekrane@demo-paca-bti.fr',
      full_name: `${DEMO_TAG} Nadia Sekrane`,
      phone: '06 88 77 66 55',
      role: 'SECRETAIRE',
      assigned_chantiers: [],
      invite_sent_at: '2026-02-15T09:00:00Z',
      accepted_at: '2026-02-15T11:00:00Z',
      last_login_at: '2026-04-09T08:45:00Z',
      is_active: true,
    },
    {
      company_id: ownerId,
      user_id: null,
      email: 'pierre.blanchard@demo-paca-bti.fr',
      full_name: `${DEMO_TAG} Pierre Blanchard`,
      phone: '06 11 00 99 88',
      role: 'CONDUCTEUR_TRAVAUX',
      assigned_chantiers: [chantierIds[0], chantierIds[1], chantierIds[3]],
      invite_sent_at: '2026-02-20T10:00:00Z',
      accepted_at: '2026-02-20T16:00:00Z',
      last_login_at: '2026-04-09T06:30:00Z',
      is_active: true,
    },
    {
      company_id: ownerId,
      user_id: null,
      email: 'marie.comptable@demo-paca-bti.fr',
      full_name: `${DEMO_TAG} Marie Lefèvre`,
      phone: '04 91 33 22 11',
      role: 'COMPTABLE',
      assigned_chantiers: [],
      invite_sent_at: '2026-01-10T09:00:00Z',
      accepted_at: '2026-01-10T10:00:00Z',
      last_login_at: '2026-04-08T09:00:00Z',
      is_active: true,
    },
  ]

  console.log('👤 Insertion des 5 comptes utilisateurs fictifs...')
  const { data: insertedTeam, error: errTeam } = await supabase.from('pro_team_members').insert(proTeamMembers).select()
  if (errTeam) console.error('❌ Comptes utilisateurs:', errTeam.message)
  else console.log(`✅ ${insertedTeam!.length} comptes utilisateurs fictifs créés`)

  // ═══════════════════════════════════════
  // 13. CLIENTS MANUELS — 5 clients (via la table clients_manuels si elle existe)
  // ═══════════════════════════════════════
  // Note: la table clients_manuels utilise artisan_id (pas owner_id) et stocke en localStorage fallback
  // On tente l'insert Supabase, si la table n'existe pas c'est OK
  const clientsManuels = [
    {
      artisan_id: artisanId,
      name: `${DEMO_TAG} Mme Dupont Catherine`,
      email: 'c.dupont@email.fr', phone: '06 11 22 33 44',
      type: 'particulier',
      address: '42 Rue de la République, 13001 Marseille',
      notes: 'Cliente fidèle — 2ème chantier avec nous',
      source: 'recommandation',
    },
    {
      artisan_id: artisanId,
      name: `${DEMO_TAG} Syndic Foncia — Résidence Les Pins`,
      email: 'foncia.pins@foncia.fr', phone: '04 91 00 00 00',
      type: 'syndic',
      address: '18 Boulevard Longchamp, 13001 Marseille',
      notes: 'Contact: M. Bernard (gestionnaire)',
      source: 'appel_offres',
    },
    {
      artisan_id: artisanId,
      name: `${DEMO_TAG} M. et Mme Garcia`,
      email: 'garcia.fam@email.fr', phone: '06 77 88 99 00',
      type: 'particulier',
      address: '8 Chemin des Oliviers, 13012 Marseille',
      notes: 'Projet SDB — recommandés par Mme Dupont',
      source: 'recommandation',
    },
    {
      artisan_id: artisanId,
      name: `${DEMO_TAG} M. Rossi Antoine`,
      email: 'a.rossi@email.fr', phone: '06 44 55 66 77',
      type: 'particulier',
      address: '15 Chemin de Paradis, 13008 Marseille',
      notes: 'Extension maison — permis déposé en janvier',
      source: 'site_web',
    },
    {
      artisan_id: artisanId,
      name: `${DEMO_TAG} SCI Les Terrasses du Sud`,
      email: 'contact@terrasses-sud.fr', phone: '04 91 55 66 77',
      type: 'societe',
      siret: '88899900011122',
      address: '24 Cours Julien, 13006 Marseille',
      notes: 'Gérant: M. Castellani — projet resto/bar',
      source: 'réseau_pro',
    },
  ]

  console.log('📇 Tentative insertion clients manuels...')
  const { data: insertedClients, error: errClients } = await supabase.from('clients_manuels').insert(clientsManuels).select()
  if (errClients) {
    console.warn('⚠️ clients_manuels: table inexistante ou erreur —', errClients.message)
    console.log('   → Les clients seront visibles via le Portail Client (dérivés des chantiers)')
  } else {
    console.log(`✅ ${insertedClients!.length} clients manuels créés`)
  }

  // ═══════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════
  console.log('\n═══════════════════════════════════════')
  console.log('🎉 SEED COMPLET — Données de démo insérées :')
  console.log('   • 4 membres (ouvriers)')
  console.log('   • 5 chantiers')
  console.log('   • 2 équipes + 5 affectations')
  console.log('   • 5 devis')
  console.log('   • 13 dépenses')
  console.log('   • 20 pointages')
  console.log('   • 3 situations de travaux')
  console.log('   • 3 retenues de garantie')
  console.log('   • 3 sous-traitants DC4')
  console.log('   • 2 appels d\'offres DPGF')
  console.log('   • 5 comptes utilisateurs fictifs')
  console.log('   • 5 clients manuels')
  console.log('   • Settings BTP configurés')
  console.log('═══════════════════════════════════════')
  console.log('\nPour supprimer : npx tsx scripts/seed-demo-btp.ts --clean')
}

// ── CLEAN ──
async function clean() {
  const ownerArg = process.argv.find(a => a.startsWith('--owner='))
  const ownerId = ownerArg ? ownerArg.split('=')[1] : await getOwnerId()
  console.log(`📌 Owner ID: ${ownerId}`)
  console.log('🧹 Suppression des données de démo...\n')

  // Comptes utilisateurs fictifs
  const { data: tm } = await supabase.from('pro_team_members').select('id').eq('company_id', ownerId).like('full_name', `%${DEMO_TAG}%`)
  if (tm && tm.length > 0) {
    await supabase.from('pro_team_members').delete().in('id', tm.map(t => t.id))
    console.log(`✅ ${tm.length} comptes utilisateurs supprimés`)
  }

  // DPGF
  const { data: dp } = await supabase.from('dpgf_btp').select('id').eq('owner_id', ownerId).like('titre', `%${DEMO_TAG}%`)
  if (dp && dp.length > 0) {
    await supabase.from('dpgf_btp').delete().in('id', dp.map(d => d.id))
    console.log(`✅ ${dp.length} DPGF supprimés`)
  }

  // DC4
  const { data: dc } = await supabase.from('dc4_btp').select('id').eq('owner_id', ownerId).like('entreprise', `%${DEMO_TAG}%`)
  if (dc && dc.length > 0) {
    await supabase.from('dc4_btp').delete().in('id', dc.map(d => d.id))
    console.log(`✅ ${dc.length} DC4 supprimés`)
  }

  // Retenues
  const { data: rt } = await supabase.from('retenues_btp').select('id').eq('owner_id', ownerId)
  if (rt && rt.length > 0) {
    await supabase.from('retenues_btp').delete().in('id', rt.map(r => r.id))
    console.log(`✅ ${rt.length} retenues supprimées`)
  }

  // Situations
  const { data: st } = await supabase.from('situations_btp').select('id').eq('owner_id', ownerId)
  if (st && st.length > 0) {
    await supabase.from('situations_btp').delete().in('id', st.map(s => s.id))
    console.log(`✅ ${st.length} situations supprimées`)
  }

  // Pointages
  const { data: pt } = await supabase.from('pointages_btp').select('id').eq('owner_id', ownerId).like('poste', `%${DEMO_TAG}%`)
  if (pt && pt.length > 0) {
    await supabase.from('pointages_btp').delete().in('id', pt.map(p => p.id))
    console.log(`✅ ${pt.length} pointages supprimés`)
  }

  // Dépenses
  const { data: dep } = await supabase.from('depenses_btp').select('id').eq('owner_id', ownerId).like('label', `%${DEMO_TAG}%`)
  if (dep && dep.length > 0) {
    await supabase.from('depenses_btp').delete().in('id', dep.map(d => d.id))
    console.log(`✅ ${dep.length} dépenses supprimées`)
  }

  // Équipe-membres (cascade from equipes)
  // Équipes
  const { data: eq } = await supabase.from('equipes_btp').select('id').eq('owner_id', ownerId).like('nom', `%${DEMO_TAG}%`)
  if (eq && eq.length > 0) {
    await supabase.from('equipe_membres_btp').delete().in('equipe_id', eq.map(e => e.id))
    await supabase.from('equipes_btp').delete().in('id', eq.map(e => e.id))
    console.log(`✅ ${eq.length} équipes supprimées`)
  }

  // Chantiers (after dependents are cleared)
  const { data: ch } = await supabase.from('chantiers_btp').select('id').eq('owner_id', ownerId).like('description', `%${DEMO_TAG}%`)
  if (ch && ch.length > 0) {
    await supabase.from('pointages_btp').delete().in('chantier_id', ch.map(c => c.id))
    await supabase.from('depenses_btp').delete().in('chantier_id', ch.map(c => c.id))
    await supabase.from('chantiers_btp').delete().in('id', ch.map(c => c.id))
    console.log(`✅ ${ch.length} chantiers supprimés`)
  }

  // Membres
  const { data: mb } = await supabase.from('membres_btp').select('id').eq('owner_id', ownerId).like('role_perso', `%${DEMO_TAG}%`)
  if (mb && mb.length > 0) {
    await supabase.from('membres_btp').delete().in('id', mb.map(m => m.id))
    console.log(`✅ ${mb.length} membres supprimés`)
  }

  // Devis
  const { data: dv } = await supabase.from('devis').select('id').eq('artisan_user_id', ownerId).like('notes', `%${DEMO_TAG}%`)
  if (dv && dv.length > 0) {
    await supabase.from('factures').delete().in('devis_id', dv.map(d => d.id))
    await supabase.from('devis').delete().in('id', dv.map(d => d.id))
    console.log(`✅ ${dv.length} devis supprimés`)
  }

  // Clients manuels
  const { data: cl } = await supabase.from('clients_manuels').select('id').like('name', `%${DEMO_TAG}%`)
  if (cl && cl.length > 0) {
    await supabase.from('clients_manuels').delete().in('id', cl.map(c => c.id))
    console.log(`✅ ${cl.length} clients manuels supprimés`)
  }

  console.log('\n🧹 Nettoyage terminé ! Toutes les données de démo ont été supprimées.')
}

// ── MAIN ──
const isClean = process.argv.includes('--clean')
if (isClean) {
  clean().catch(console.error)
} else {
  seed().catch(console.error)
}
