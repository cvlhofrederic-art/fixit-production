// tests/lib/btp-schema-tables.test.ts — ce que POST /api/btp accepte d'écrire (lib/btp/schema-tables-btp.ts).
//
// 1. Le schéma recopie le relevé des colonnes de la base de PRODUCTION du 11/11/2026 (le schéma de production diffère
//    des migrations du dépôt) : nom, type, NOT NULL, valeur par défaut. Changer l'un sans l'autre fait échouer ce test.
// 2. Ce que les écrans envoient aujourd'hui (mapToSupabase, colonnes de SOURCES_DES_COLONNES) passe les contrôles :
//    la liste blanche ne doit refuser aucun enregistrement que la base acceptait.
// 3. Bornes métier, rattachements, comparaison avec la valeur enregistrée.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))

import {
  BTP_TABLES_ECRIVABLES, COLONNES_BTP, COLONNES_SYSTEME, memeValeur, referencesDeLigne, valeursHorsBornes, verifierLigne,
  type TableEcrivable,
} from '@/lib/btp/schema-tables-btp'
import { SOURCES_DES_COLONNES, colonnesModifiees, mapToSupabase } from '@/lib/hooks/use-btp-data'

// Relevé de production du 11/11/2026 (~/.claude/audits/btp-fondations-2026-11-11/prod-colonnes-2026-11-11.md) :
// `!` = NOT NULL, `*` = valeur par défaut.
const RELEVE_PRODUCTION: Record<TableEcrivable, string> = {
  chantiers_btp: 'id:uuid!*, owner_id:uuid!, titre:text!, client:text, adresse:text, latitude:double precision, longitude:double precision, geo_rayon_m:integer!*, date_debut:date, date_fin:date, budget:numeric, statut:text!*, description:text, equipe:text, created_at:timestamptz!*, updated_at:timestamptz!*, marge_prevue_pct:numeric, tva_taux:numeric*, montant_facture:numeric*, acompte_recu:numeric*, penalite_retard_jour:numeric*, ville:text, code_postal:text, sous_taches:jsonb!*',
  charges_fixes: 'id:uuid!*, owner_id:uuid!, label:text!, montant:numeric!, frequence:text!, categorie:text!, date_debut:date, date_fin:date, created_at:timestamptz*, updated_at:timestamptz*',
  dc4_btp: 'id:uuid!*, owner_id:uuid!, entreprise:text!*, siret:text*, responsable:text*, email:text*, telephone:text*, adresse:text*, chantier:text*, lot:text*, montant_marche:numeric*, taux_tva:numeric*, statut:text!*, date_agrement:date, dc4_genere:boolean*, created_at:timestamptz*, updated_at:timestamptz*, chantier_id:uuid',
  dce_analyses_btp: 'id:uuid!*, owner_id:uuid!, titre:text!*, country:text*, project_type:text*, status:text!*, result:jsonb*, created_at:timestamptz*',
  depenses_btp: 'id:uuid!*, owner_id:uuid!, chantier_id:uuid, label:text!, amount:numeric!, category:text!*, date:date!*, notes:text, created_at:timestamptz!*',
  dpgf_btp: 'id:uuid!*, owner_id:uuid!, titre:text!*, client:text*, date_remise:date, montant_estime:numeric*, statut:text!*, lots:jsonb!*, created_at:timestamptz*, updated_at:timestamptz*',
  equipes_btp: 'id:uuid!*, owner_id:uuid!, nom:text!, metier:text, chantier_id:uuid, created_at:timestamptz!*',
  membres_btp: 'id:uuid!*, owner_id:uuid!, prenom:text!, nom:text!, telephone:text, email:text, type_compte:text!*, role_perso:text, equipe_id:uuid, cout_horaire:numeric!*, charges_pct:numeric!*, created_at:timestamptz!*, salaire_brut_mensuel:numeric, salaire_net_mensuel:numeric, charges_salariales_pct:numeric*, charges_patronales_pct:numeric*, type_contrat:text*, heures_hebdo:numeric*, panier_repas_jour:numeric*, indemnite_trajet_jour:numeric*, prime_mensuelle:numeric*, actif:boolean*',
  pointages_btp: 'id:uuid!*, owner_id:uuid!, membre_id:uuid, chantier_id:uuid, employe:text!, poste:text, chantier_nom:text, date:date!, heure_arrivee:time!, heure_depart:time, pause_minutes:integer!*, heures_travaillees:numeric, notes:text, mode:text!*, arrivee_lat:double precision, arrivee_lng:double precision, depart_lat:double precision, depart_lng:double precision, distance_m:integer, created_at:timestamptz!*',
  rapports_btp: 'id:uuid!*, owner_id:uuid!, chantier_id:uuid, titre:text, date:text, contenu:jsonb, photos:jsonb*, status:text*, created_at:timestamptz*',
  retenues_btp: 'id:uuid!*, owner_id:uuid!, chantier:text!*, client:text*, montant_marche:numeric*, taux_retenue:numeric*, montant_retenu:numeric*, date_fin_travaux:date, date_liberation:date, statut:text!*, caution:boolean*, created_at:timestamptz*, updated_at:timestamptz*, chantier_id:uuid',
  settings_btp: 'owner_id:uuid!, depot_adresse:text, depot_lat:double precision, depot_lng:double precision, depot_rayon_m:integer!*, cout_horaire_ouvrier:numeric!*, cout_horaire_chef_chantier:numeric!*, cout_horaire_conducteur:numeric!*, charges_patronales_pct:numeric!*, geo_pointage_enabled:boolean!*, devise:text!*, updated_at:timestamptz!*, salaire_patron_mensuel:numeric*, salaire_patron_type:text*, statut_juridique:text*, regime_tva:text*, taux_is:numeric*, taux_cotisations_patron:numeric*, frais_fixes_mensuels:jsonb*, objectif_marge_pct:numeric*, amortissements_mensuels:numeric*',
  situations_btp: 'id:uuid!*, owner_id:uuid!, chantier:text!*, client:text*, numero:integer!*, date:date!*, montant_marche:numeric*, travaux:jsonb!*, statut:text!*, created_at:timestamptz*, updated_at:timestamptz*, chantier_id:uuid',
}

const TYPE_DU_RELEVE: Record<string, string> = {
  text: 'texte', uuid: 'uuid', numeric: 'nombre', integer: 'nombre', 'double precision': 'nombre',
  boolean: 'booleen', date: 'date', time: 'heure', jsonb: 'json',
}

function colonnesDuReleve(table: TableEcrivable) {
  return RELEVE_PRODUCTION[table].split(', ').map(entree => {
    const [nom, type] = entree.split(':')
    const nonNul = type.includes('!')
    const parDefaut = type.includes('*')
    return { nom, type: type.replace(/[!*]/g, ''), nonNul, requis: nonNul && !parDefaut }
  }).filter(c => !(COLONNES_SYSTEME as readonly string[]).includes(c.nom))
}

describe('schéma des tables BTP — aligné sur le relevé de production', () => {
  for (const table of BTP_TABLES_ECRIVABLES) {
    it(`${table} : mêmes colonnes, types, NOT NULL et champs à fournir`, () => {
      const releve = colonnesDuReleve(table)
      expect(Object.keys(COLONNES_BTP[table]).sort()).toEqual(releve.map(c => c.nom).sort())
      for (const c of releve) {
        const spec = COLONNES_BTP[table][c.nom]
        expect({ colonne: c.nom, type: spec.type }).toEqual({ colonne: c.nom, type: TYPE_DU_RELEVE[c.type] })
        expect({ colonne: c.nom, nonNul: !!spec.nonNul }).toEqual({ colonne: c.nom, nonNul: c.nonNul })
        expect({ colonne: c.nom, requis: !!spec.requis }).toEqual({ colonne: c.nom, requis: c.requis })
      }
    })
  }
})

// Fiches telles que les formulaires les remplissent (champs du formulaire, avant mapToSupabase).
const TABLES_DU_HOOK = {
  chantiers: 'chantiers_btp', membres: 'membres_btp', equipes: 'equipes_btp', pointages: 'pointages_btp',
  depenses: 'depenses_btp', situations: 'situations_btp', retenues: 'retenues_btp', dc4: 'dc4_btp',
  dce_analyses: 'dce_analyses_btp', dpgf: 'dpgf_btp', rapports: 'rapports_btp',
} as const

const CHANTIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const FICHES_DES_FORMULAIRES: Record<keyof typeof TABLES_DU_HOOK, Record<string, unknown>> = {
  chantiers: { titre: 'Rénovation cuisine', client: 'M. Martin', adresse: '1 rue des Lilas', ville: 'Marseille', codePostal: '13001', latitude: 43.3, longitude: 5.4, dateDebut: '2026-11-01', dateFin: '2026-12-01', budget: '12000', statut: 'En cours', description: 'Cuisine complète', equipe: 'Maçons', sousTaches: [{ id: 't1', nom: 'Dépose' }] },
  membres: { prenom: 'Paul', nom: 'Durand', telephone: '0600000000', email: 'paul@example.test', typeCompte: 'ouvrier', rolePerso: 'Maçon', coutHoraire: 25, chargesPct: 45, salaire_brut_mensuel: 2100, salaire_net_mensuel: 1650, charges_salariales_pct: 22, charges_patronales_pct: 45, type_contrat: 'cdi', heures_hebdo: 35, panier_repas_jour: 10, indemnite_trajet_jour: 5, prime_mensuelle: 0, actif: true },
  equipes: { nom: 'Maçons', metier: 'Maçonnerie', membreIds: [] },
  pointages: { employe: 'Paul Durand', poste: 'ouvrier', chantier: 'Rénovation cuisine', date: '2026-11-15', heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, heuresTravaillees: 8, notes: '' },
  depenses: { label: 'Ciment', amount: '125.50', category: 'materiaux', date: '2026-11-15', notes: '' },
  situations: { chantier_id: CHANTIER, chantier: 'Rénovation cuisine', client: 'M. Martin', numero: 2, date: '2026-11-15', montantMarche: 12000, travaux: [{ poste: 'Gros œuvre', quantite: 1, prixUnit: 3000, avancement: 50 }], statut: 'brouillon' },
  retenues: { chantier_id: CHANTIER, chantier: 'Rénovation cuisine', client: 'M. Martin', montantMarche: 12000, tauxRetenue: 5, montantRetenu: 600, dateFinTravaux: '2026-12-01', dateLiberation: undefined, statut: 'active', caution: false },
  dc4: { chantier_id: CHANTIER, entreprise: 'Sous-traitant SARL', siret: '00000000000000', responsable: 'Mme Petit', email: 'contact@example.test', telephone: '0400000000', adresse: '2 rue du Port', chantier: 'Rénovation cuisine', lot: 'Plomberie', montantMarche: 4000, tauxTVA: 20, statut: 'en_attente', dateAgrement: '', dc4Genere: false },
  dce_analyses: { titre: 'Lycée — lot 3', country: 'FR', projectType: 'public', status: 'pending', result: {} },
  dpgf: { titre: 'Gymnase', client: 'Commune', dateRemise: '2026-12-15', montantEstime: 85000, statut: 'en_cours', lots: [{ numero: 1, intitule: 'Gros œuvre' }] },
  rapports: { rapportNumber: 'R-2026-001', interventionDate: '2026-11-15', chantier_id: CHANTIER, linkedPhotoIds: [], status: 'brouillon', observations: 'RAS' },
}

describe('ce que les écrans envoient aujourd’hui passe les contrôles', () => {
  for (const [court, table] of Object.entries(TABLES_DU_HOOK) as Array<[keyof typeof TABLES_DU_HOOK, TableEcrivable]>) {
    it(`${court} : création (mapToSupabase) et modification de chaque champ du formulaire (colonnesModifiees)`, () => {
      const { membreIds: _membres, ...creation } = mapToSupabase(court, FICHES_DES_FORMULAIRES[court])
      expect(verifierLigne(table, creation, 'creation')).toBeNull()
      expect(valeursHorsBornes(table, creation)).toEqual([])

      for (const champs of Object.values(SOURCES_DES_COLONNES[court] ?? {})) {
        for (const champ of champs) {
          if (champ === 'membreIds') continue
          const modification = colonnesModifiees(court, { [champ]: FICHES_DES_FORMULAIRES[court][champ] })
          expect({ champ, refus: verifierLigne(table, modification, 'modification') }).toEqual({ champ, refus: null })
        }
      }
    })
  }

  it('frais fixes (compta BTP) : ajout d’une charge', () => {
    expect(verifierLigne('charges_fixes', { label: 'Assurance', montant: 100, frequence: 'mensuel', categorie: 'rc_pro' }, 'creation')).toBeNull()
  })
})

describe('verifierLigne — refus clairs', () => {
  it('nomme les champs inconnus, manquants, vidés ou au mauvais format', () => {
    expect(verifierLigne('chantiers_btp', { titre: 'A', couleur: 'rouge' }, 'creation')).toBe('champs non reconnus (couleur)')
    expect(verifierLigne('pointages_btp', { employe: 'Paul' }, 'creation')).toBe('champs obligatoires manquants (date, heure_arrivee)')
    expect(verifierLigne('chantiers_btp', { titre: null }, 'modification')).toBe('ces champs ne peuvent pas être vides (titre)')
    expect(verifierLigne('chantiers_btp', { budget: '12,5' }, 'modification')).toBe('valeur au mauvais format pour budget')
    expect(verifierLigne('situations_btp', { chantier_id: '' }, 'modification')).toBe('valeur au mauvais format pour chantier_id')
  })

  it('accepte ce que la base accepte : nombre en texte, null dans une colonne facultative, modification partielle', () => {
    expect(verifierLigne('chantiers_btp', { budget: ' 12000.50 ' }, 'modification')).toBeNull()
    expect(verifierLigne('chantiers_btp', { budget: null, date_fin: null }, 'modification')).toBeNull()
    expect(verifierLigne('membres_btp', { actif: false }, 'modification')).toBeNull()
    expect(verifierLigne('dce_analyses_btp', { result: '{"lots":[]}' }, 'modification')).toBeNull()
  })
})

describe('valeursHorsBornes', () => {
  it('montant négatif, pourcentage hors 0-100, coordonnées impossibles', () => {
    expect(valeursHorsBornes('chantiers_btp', { budget: -50000, latitude: 95 }).map(h => h.colonne)).toEqual(['budget', 'latitude'])
    expect(valeursHorsBornes('retenues_btp', { taux_retenue: '150' })[0].message)
      .toBe('Valeur refusée pour le taux de retenue (150) : elle doit être comprise entre 0 et 100.')
    expect(valeursHorsBornes('chantiers_btp', { budget: -1 })[0].message)
      .toBe('Valeur refusée pour le budget (-1) : elle doit être positive ou nulle.')
    expect(valeursHorsBornes('settings_btp', { depot_rayon_m: 0 })[0].message)
      .toBe('Valeur refusée pour le rayon du dépôt (0) : elle doit être au moins égale à 1.')
  })

  it('aucune borne pour ce qui relève d’un choix : montant d’une dépense, marge prévue', () => {
    expect(valeursHorsBornes('depenses_btp', { amount: -30 })).toEqual([])
    expect(valeursHorsBornes('chantiers_btp', { marge_prevue_pct: -10 })).toEqual([])
  })
})

describe('referencesDeLigne et memeValeur', () => {
  it('chantier, membre et équipe désignés par une fiche', () => {
    expect(referencesDeLigne('pointages_btp', { chantier_id: CHANTIER, membre_id: null, employe: 'Paul' }))
      .toEqual([{ colonne: 'chantier_id', cible: 'chantiers_btp', id: CHANTIER }])
    expect(referencesDeLigne('membres_btp', { equipe_id: CHANTIER })).toEqual([{ colonne: 'equipe_id', cible: 'equipes_btp', id: CHANTIER }])
  })

  it('même valeur au sens de la base', () => {
    expect(memeValeur(150, '150')).toBe(true)
    expect(memeValeur(150, 150.0)).toBe(true)
    expect(memeValeur(CHANTIER.toUpperCase(), CHANTIER)).toBe(true)
    expect(memeValeur(null, undefined)).toBe(true)
    expect(memeValeur(150, 160)).toBe(false)
    expect(memeValeur('', 0)).toBe(false)
    expect(memeValeur(null, 0)).toBe(false)
  })
})
