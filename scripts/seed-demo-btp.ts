/**
 * Seed Demo BTP Pro — Données de démonstration
 *
 * Usage:
 *   npx tsx scripts/seed-demo-btp.ts          → Insère les données de démo
 *   npx tsx scripts/seed-demo-btp.ts --clean   → Supprime les données de démo
 *
 * Toutes les données de démo ont le tag __demo: true dans la description/metadata
 * pour pouvoir les identifier et les supprimer facilement.
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
  // Chercher dans settings_btp
  const { data: settings } = await supabase
    .from('settings_btp')
    .select('owner_id')
    .limit(1)
    .single()
  if (settings?.owner_id) return settings.owner_id

  // Sinon chercher dans membres_btp
  const { data: membres } = await supabase
    .from('membres_btp')
    .select('owner_id')
    .limit(1)
    .single()
  if (membres?.owner_id) return membres.owner_id

  // Sinon chercher dans chantiers_btp
  const { data: chantiers } = await supabase
    .from('chantiers_btp')
    .select('owner_id')
    .limit(1)
    .single()
  if (chantiers?.owner_id) return chantiers.owner_id

  // Dernier recours : auth users
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1 })
  if (users?.users?.[0]) return users.users[0].id

  console.error('❌ Aucun utilisateur trouvé')
  process.exit(1)
}

// ── SEED ──
async function seed() {
  // Allow --owner=<uuid> to force a specific owner
  const ownerArg = process.argv.find(a => a.startsWith('--owner='))
  const ownerId = ownerArg ? ownerArg.split('=')[1] : await getOwnerId()
  console.log(`📌 Owner ID: ${ownerId}`)

  // 1. Équipe de 4 membres
  // Colonnes dispo: prenom, nom, telephone, email, type_compte, role_perso, cout_horaire, charges_pct
  // + migration 030: salaire_brut_mensuel, salaire_net_mensuel, charges_salariales_pct, charges_patronales_pct
  //   type_contrat, heures_hebdo, panier_repas_jour, indemnite_trajet_jour, prime_mensuelle, actif
  // Note: on tag via role_perso qui contient [DEMO] pour pouvoir supprimer ensuite
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
    .from('membres_btp')
    .insert(membres)
    .select()
  if (errMembres) { console.error('❌ Membres:', errMembres.message); return }
  console.log(`✅ ${insertedMembres!.length} membres créés`)

  const membreIds = insertedMembres!.map((m: any) => m.id)

  // 2. Chantiers
  const today = new Date()
  const chantiers = [
    {
      owner_id: ownerId,
      titre: 'Rénovation complète T3 — Rue de la République',
      client: 'Mme Dupont Catherine',
      adresse: '42 Rue de la République, 13001 Marseille',
      latitude: 43.2965, longitude: 5.3698,
      geo_rayon_m: 100,
      date_debut: '2026-03-10', date_fin: '2026-04-04',
      budget: 28500,
      statut: 'En cours',
      description: `${DEMO_TAG} Rénovation complète T3 : démolition, placo, électricité, peinture, carrelage SDB + cuisine`,
      equipe: 'Équipe A',
      marge_prevue_pct: 30,
      tva_taux: 10, // TVA réduite rénovation
      montant_facture: 28500,
      acompte_recu: 8550,
      penalite_retard_jour: 150,
    },
    {
      owner_id: ownerId,
      titre: 'Ravalement façade immeuble — Bd Longchamp',
      client: 'Syndic Foncia — Résidence Les Pins',
      adresse: '18 Boulevard Longchamp, 13001 Marseille',
      latitude: 43.2988, longitude: 5.3890,
      geo_rayon_m: 150,
      date_debut: '2026-04-14', date_fin: '2026-05-16',
      budget: 45000,
      statut: 'En attente',
      description: `${DEMO_TAG} Ravalement R+4, échafaudage, nettoyage HP, enduit, peinture façade, zinguerie`,
      equipe: 'Équipe A',
      marge_prevue_pct: 25,
      tva_taux: 10,
      montant_facture: 45000,
      acompte_recu: 0,
      penalite_retard_jour: 200,
    },
    {
      owner_id: ownerId,
      titre: 'SDB complète — Villa Les Oliviers',
      client: 'M. et Mme Garcia',
      adresse: '8 Chemin des Oliviers, 13012 Marseille',
      latitude: 43.3102, longitude: 5.4320,
      geo_rayon_m: 80,
      date_debut: '2026-03-17',
      date_fin: '2026-03-28',
      budget: 12800,
      statut: 'En cours',
      description: `${DEMO_TAG} Salle de bain complète : dépose, plomberie, carrelage sol+murs, meuble vasque, douche italienne`,
      equipe: 'Équipe A',
      marge_prevue_pct: 35,
      tva_taux: 10,
      montant_facture: 12800,
      acompte_recu: 3840,
      penalite_retard_jour: 100,
    },
    {
      owner_id: ownerId,
      titre: 'Extension maison individuelle — Chemin de Paradis',
      client: 'M. Rossi Antoine',
      adresse: '15 Chemin de Paradis, 13008 Marseille',
      latitude: 43.2580, longitude: 5.3895,
      geo_rayon_m: 100,
      date_debut: '2026-04-01', date_fin: '2026-05-30',
      budget: 62000,
      statut: 'En cours',
      description: `${DEMO_TAG} Extension 30m² : fondations, élévation murs, charpente, toiture, menuiseries, isolation, finitions intérieures`,
      equipe: 'Équipe A',
      marge_prevue_pct: 28,
      tva_taux: 20,
      montant_facture: 62000,
      acompte_recu: 18600,
      penalite_retard_jour: 250,
    },
    {
      owner_id: ownerId,
      titre: 'Réhabilitation local commercial — Cours Julien',
      client: 'SCI Les Terrasses du Sud',
      adresse: '24 Cours Julien, 13006 Marseille',
      latitude: 43.2925, longitude: 5.3835,
      geo_rayon_m: 120,
      date_debut: '2026-03-25', date_fin: '2026-04-25',
      budget: 38000,
      statut: 'En cours',
      description: `${DEMO_TAG} Transformation local commercial 80m² : décloisonnement, dalle béton, plomberie, électricité NFC, faux plafond, vitrine`,
      equipe: 'Équipe B',
      marge_prevue_pct: 22,
      tva_taux: 20,
      montant_facture: 38000,
      acompte_recu: 11400,
      penalite_retard_jour: 180,
    },
  ]

  console.log('🏗️ Insertion des 5 chantiers...')
  const { data: insertedChantiers, error: errChantiers } = await supabase
    .from('chantiers_btp')
    .insert(chantiers)
    .select()
  if (errChantiers) { console.error('❌ Chantiers:', errChantiers.message); return }
  console.log(`✅ ${insertedChantiers!.length} chantiers créés`)

  // 3. Settings BTP (si pas encore configuré)
  console.log('⚙️ Vérification/mise à jour settings...')
  await supabase
    .from('settings_btp')
    .upsert({
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

  // 4. Devis
  // Vérifier si la table devis a artisan_id ou artisan_user_id
  const { data: artisan } = await supabase
    .from('artisans')
    .select('id')
    .eq('user_id', ownerId)
    .single()

  const artisanId = artisan?.id || ownerId

  const devisData = [
    {
      artisan_id: artisanId,
      artisan_user_id: ownerId,
      numero: 'DEV-DEMO-001',
      client_name: 'Mme Dupont Catherine',
      client_email: 'c.dupont@demo.fr',
      client_phone: '06 11 22 33 44',
      client_address: '42 Rue de la République, 13001 Marseille',
      status: 'signed',
      currency: 'EUR',
      country: 'FR',
      tax_rate: 10,
      tax_label: 'TVA 10%',
      total_ht_cents: 2850000, // 28 500 €
      total_tax_cents: 285000, // 2 850 €
      total_ttc_cents: 3135000, // 31 350 €
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
      artisan_id: artisanId,
      artisan_user_id: ownerId,
      numero: 'DEV-DEMO-002',
      client_name: 'Syndic Foncia — Résidence Les Pins',
      client_email: 'foncia.pins@demo.fr',
      client_phone: '04 91 00 00 00',
      client_address: '18 Boulevard Longchamp, 13001 Marseille',
      status: 'sent',
      currency: 'EUR',
      country: 'FR',
      tax_rate: 10,
      tax_label: 'TVA 10%',
      total_ht_cents: 4500000,
      total_tax_cents: 450000,
      total_ttc_cents: 4950000,
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
      artisan_id: artisanId,
      artisan_user_id: ownerId,
      numero: 'DEV-DEMO-003',
      client_name: 'M. et Mme Garcia',
      client_email: 'garcia.fam@demo.fr',
      client_phone: '06 77 88 99 00',
      client_address: '8 Chemin des Oliviers, 13012 Marseille',
      status: 'signed',
      currency: 'EUR',
      country: 'FR',
      tax_rate: 10,
      tax_label: 'TVA 10%',
      total_ht_cents: 1280000,
      total_tax_cents: 128000,
      total_ttc_cents: 1408000,
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
      artisan_id: artisanId,
      artisan_user_id: ownerId,
      numero: 'DEV-DEMO-004',
      client_name: 'M. Rossi Antoine',
      client_email: 'a.rossi@demo.fr',
      client_phone: '06 44 55 66 77',
      client_address: '15 Chemin de Paradis, 13008 Marseille',
      status: 'signed',
      currency: 'EUR',
      country: 'FR',
      tax_rate: 20,
      tax_label: 'TVA 20%',
      total_ht_cents: 6200000,
      total_tax_cents: 1240000,
      total_ttc_cents: 7440000,
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
      artisan_id: artisanId,
      artisan_user_id: ownerId,
      numero: 'DEV-DEMO-005',
      client_name: 'SCI Les Terrasses du Sud',
      client_email: 'contact@terrasses-sud.fr',
      client_phone: '04 91 55 66 77',
      client_address: '24 Cours Julien, 13006 Marseille',
      status: 'signed',
      currency: 'EUR',
      country: 'FR',
      tax_rate: 20,
      tax_label: 'TVA 20%',
      total_ht_cents: 3800000,
      total_tax_cents: 760000,
      total_ttc_cents: 4560000,
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
  const { data: insertedDevis, error: errDevis } = await supabase
    .from('devis')
    .insert(devisData)
    .select()
  if (errDevis) {
    console.error('❌ Devis:', errDevis.message)
    // Continue — devis table might not exist or have different schema
  } else {
    console.log(`✅ ${insertedDevis!.length} devis créés`)
  }

  // 5. Quelques dépenses liées aux chantiers
  if (insertedChantiers && insertedChantiers.length >= 5) {
    const depenses = [
      { owner_id: ownerId, chantier_id: insertedChantiers[0].id, date: '2026-03-12', label: `${DEMO_TAG} Matériaux placo + rails`, amount: 1450, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[0].id, date: '2026-03-15', label: `${DEMO_TAG} Peinture Tollens (4 seaux)`, amount: 380, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[0].id, date: '2026-03-18', label: `${DEMO_TAG} Électricité — câbles + tableau`, amount: 820, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[0].id, date: '2026-03-20', label: `${DEMO_TAG} Location benne gravats`, amount: 350, category: 'location' },
      { owner_id: ownerId, chantier_id: insertedChantiers[2].id, date: '2026-03-18', label: `${DEMO_TAG} Carrelage + faïence SDB`, amount: 1100, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[2].id, date: '2026-03-19', label: `${DEMO_TAG} Receveur douche + paroi`, amount: 890, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[2].id, date: '2026-03-21', label: `${DEMO_TAG} Meuble vasque + miroir`, amount: 750, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[3].id, date: '2026-04-02', label: `${DEMO_TAG} Béton fondations + ferraillage`, amount: 3200, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[3].id, date: '2026-04-05', label: `${DEMO_TAG} Parpaings + ciment élévation`, amount: 2100, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[3].id, date: '2026-04-07', label: `${DEMO_TAG} Location mini-pelle 3j`, amount: 580, category: 'location' },
      { owner_id: ownerId, chantier_id: insertedChantiers[4].id, date: '2026-03-26', label: `${DEMO_TAG} Démolition — location marteau-piqueur`, amount: 320, category: 'location' },
      { owner_id: ownerId, chantier_id: insertedChantiers[4].id, date: '2026-03-28', label: `${DEMO_TAG} Béton prêt à l'emploi dalle (6m³)`, amount: 1800, category: 'materiaux' },
      { owner_id: ownerId, chantier_id: insertedChantiers[4].id, date: '2026-04-01', label: `${DEMO_TAG} Câblage électrique NFC`, amount: 1250, category: 'materiaux' },
    ]

    console.log('💸 Insertion des dépenses...')
    const { data: insertedDep, error: errDep } = await supabase
      .from('depenses_btp')
      .insert(depenses)
      .select()
    if (errDep) {
      console.error('❌ Dépenses:', errDep.message)
    } else {
      console.log(`✅ ${insertedDep!.length} dépenses créées`)
    }
  }

  console.log('\n🎉 Seed terminé ! Données de démo insérées avec succès.')
  console.log('Pour supprimer : npx tsx scripts/seed-demo-btp.ts --clean')
}

// ── CLEAN ──
async function clean() {
  const ownerArg = process.argv.find(a => a.startsWith('--owner='))
  const ownerId = ownerArg ? ownerArg.split('=')[1] : await getOwnerId()
  console.log(`📌 Owner ID: ${ownerId}`)
  console.log('🧹 Suppression des données de démo...\n')

  // Dépenses
  const { data: dep } = await supabase
    .from('depenses_btp')
    .select('id')
    .eq('owner_id', ownerId)
    .like('label', `%${DEMO_TAG}%`)
  if (dep && dep.length > 0) {
    await supabase.from('depenses_btp').delete().in('id', dep.map(d => d.id))
    console.log(`✅ ${dep.length} dépenses supprimées`)
  }

  // Chantiers
  const { data: ch } = await supabase
    .from('chantiers_btp')
    .select('id')
    .eq('owner_id', ownerId)
    .like('description', `%${DEMO_TAG}%`)
  if (ch && ch.length > 0) {
    // D'abord supprimer pointages liés
    await supabase.from('pointages_btp').delete().in('chantier_id', ch.map(c => c.id))
    await supabase.from('depenses_btp').delete().in('chantier_id', ch.map(c => c.id))
    await supabase.from('chantiers_btp').delete().in('id', ch.map(c => c.id))
    console.log(`✅ ${ch.length} chantiers supprimés`)
  }

  // Membres
  const { data: mb } = await supabase
    .from('membres_btp')
    .select('id')
    .eq('owner_id', ownerId)
    .like('role_perso', `%${DEMO_TAG}%`)
  if (mb && mb.length > 0) {
    await supabase.from('membres_btp').delete().in('id', mb.map(m => m.id))
    console.log(`✅ ${mb.length} membres supprimés`)
  }

  // Devis
  const { data: dv } = await supabase
    .from('devis')
    .select('id')
    .eq('artisan_user_id', ownerId)
    .like('notes', `%${DEMO_TAG}%`)
  if (dv && dv.length > 0) {
    // Supprimer factures liées d'abord
    await supabase.from('factures').delete().in('devis_id', dv.map(d => d.id))
    await supabase.from('devis').delete().in('id', dv.map(d => d.id))
    console.log(`✅ ${dv.length} devis supprimés`)
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
